'use strict';

// Milestone 8 — Auto patch loop (Master Spec section 12).
// Orchestrates the iterative repair loop:
//   analyze -> minimal patch -> isolated ai-fix branch -> apply patch ->
//   targeted test -> reproduction -> regression.
// On failure it collects logs, updates the hypothesis, and plans the next
// patch. After maxIterations it escalates with a structured investigation
// package.
//
// Safety: this module never touches git, the filesystem, or the network itself.
// Branch creation, patch application, and every test run happen only through
// injected adapters, so the loop can never modify the protected production
// branch. Adapters operate inside the isolated ai-fix branch and must reject
// any attempt to write the protected branch.

const crypto = require('crypto');
const {
  clampIterations,
  isIsolatedBranchName,
  validatePatch,
  DEFAULT_PATCH_LIMITS,
} = require('./patch-policy');

const RESULT_STATUS = Object.freeze({
  SUCCESS: 'success',
  ESCALATE_ITERATIONS_EXHAUSTED: 'escalate-iterations-exhausted',
  ESCALATE_INSUFFICIENT_EVIDENCE: 'escalate-insufficient-evidence',
  BLOCKED: 'blocked',
});

function attemptId(now = Date.now()) {
  return `apt-${now.toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class PatchLoop {
  constructor(options = {}) {
    this.maxIterations = clampIterations(options.maxIterations);
    this.patchLimits = {
      maxFiles: options.maxFiles !== undefined ? options.maxFiles : DEFAULT_PATCH_LIMITS.maxFiles,
      maxAddedLines: options.maxAddedLines !== undefined ? options.maxAddedLines : DEFAULT_PATCH_LIMITS.maxAddedLines,
    };
    this.audit = options.audit || null;
    this.adapters = {
      createBranch: options.createBranch,
      applyPatch: options.applyPatch,
      runTargetedTest: options.runTargetedTest,
      runReproduction: options.runReproduction,
      runRegressionSuite: options.runRegressionSuite,
      analyzeFailure: options.analyzeFailure,
      planPatch: options.planPatch,
    };
  }

  auditEvent(event, evidence) {
    if (this.audit) {
      try { this.audit({ event, ...(evidence || {}) }); } catch (_) {}
    }
  }

  missingAdapters() {
    const required = ['createBranch', 'applyPatch', 'runTargetedTest', 'runReproduction', 'runRegressionSuite', 'analyzeFailure', 'planPatch'];
    return required.filter((name) => typeof this.adapters[name] !== 'function');
  }

  run(input = {}) {
    const result = {
      status: RESULT_STATUS.BLOCKED,
      reason: null,
      attempt_id: null,
      bug_id: input.bug && input.bug.bug_id ? input.bug.bug_id : null,
      branch: input.branchName || null,
      iterations_used: 0,
      max_iterations: this.maxIterations,
      iterations: [],
      final_result: null,
    };

    if (!input.bug || typeof input.bug !== 'object' || Array.isArray(input.bug)
      || typeof input.bug.bug_id !== 'string' || input.bug.bug_id.length === 0) {
      result.reason = 'invalid-bug';
      return result;
    }

    const branchName = input.branchName;
    if (!isIsolatedBranchName(branchName)) {
      result.reason = 'invalid-branch';
      return result;
    }

    const missing = this.missingAdapters();
    if (missing.length) {
      result.reason = `missing-adapter: ${missing.join(', ')}`;
      return result;
    }

    result.attempt_id = attemptId();
    this.auditEvent('patch-loop-started', { attempt_id: result.attempt_id, bug_id: result.bug_id, branch: branchName });

    let hypothesis = input.initialHypothesis || null;
    let patch = input.initialPatch || null;

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const record = {
        iteration,
        hypothesis: clone(hypothesis),
        patch: null,
        steps: {},
        passed: false,
        failure_reason: null,
        updated_hypothesis: null,
      };

      // 1. Ensure a patch exists (plan it if none was supplied).
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        patch = this.adapters.planPatch({ bug: input.bug, hypothesis, iteration, branch: branchName });
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        record.failure_reason = 'no-patch-planned';
        result.iterations.push(record);
        result.iterations_used = iteration;
        result.reason = 'no-patch-planned';
        result.status = RESULT_STATUS.ESCALATE_INSUFFICIENT_EVIDENCE;
        this.auditEvent('patch-loop-escalated', { attempt_id: result.attempt_id, bug_id: result.bug_id, reason: result.reason });
        break;
      }
      record.patch = clone(patch);

      // 2. Enforce the minimal-patch policy before anything is applied.
      const patchCheck = validatePatch(patch, this.patchLimits);
      if (!patchCheck.ok) {
        record.failure_reason = `patch-exceeds-policy: ${patchCheck.errors.join('; ')}`;
        result.iterations.push(record);
        result.iterations_used = iteration;
        result.reason = 'patch-exceeds-policy';
        result.status = RESULT_STATUS.ESCALATE_INSUFFICIENT_EVIDENCE;
        this.auditEvent('patch-loop-escalated', { attempt_id: result.attempt_id, bug_id: result.bug_id, reason: result.reason });
        break;
      }

      // 3. Create the isolated ai-fix branch once, before the first apply.
      if (iteration === 1) {
        const branch = this.adapters.createBranch({ branchName, bug: input.bug });
        record.steps.create_branch = branch;
        if (!branch || branch.ok !== true) {
          record.failure_reason = 'branch-creation-failed';
          result.iterations.push(record);
          result.iterations_used = iteration;
          result.reason = 'branch-creation-failed';
          result.status = RESULT_STATUS.BLOCKED;
          this.auditEvent('patch-loop-blocked', { attempt_id: result.attempt_id, bug_id: result.bug_id, reason: result.reason });
          break;
        }
      }

      // 4. Apply the patch inside the isolated branch.
      const applied = this.adapters.applyPatch({ patch, branch: branchName, bug: input.bug });
      record.steps.apply_patch = applied;

      if (applied && applied.ok === true) {
        // 5. Targeted test.
        const targeted = this.adapters.runTargetedTest({ testId: input.targetedTestId, branch: branchName, bug: input.bug });
        record.steps.targeted_test = targeted;

        if (targeted && targeted.status === 'passed') {
          // 6. Reproduction.
          const reproduction = this.adapters.runReproduction({ reproductionId: input.reproductionId, branch: branchName, bug: input.bug });
          record.steps.reproduction = reproduction;

          if (reproduction && reproduction.status === 'reproduced') {
            // 7. Regression suite.
            const regression = this.adapters.runRegressionSuite({ branch: branchName, bug: input.bug });
            record.steps.regression = regression;

            if (regression && regression.status === 'passed') {
              record.passed = true;
            } else {
              record.failure_reason = 'regression-failed';
            }
          } else if (reproduction && reproduction.status === 'failed') {
            record.failure_reason = 'reproduction-error';
          } else {
            record.failure_reason = 'reproduction-not-reproduced';
          }
        } else {
          record.failure_reason = 'targeted-test-failed';
        }
      } else {
        record.failure_reason = 'patch-apply-failed';
      }

      if (record.passed) {
        result.iterations_used = iteration;
        result.iterations.push(record);
        result.final_result = {
          targeted_test: record.steps.targeted_test,
          reproduction: record.steps.reproduction,
          regression: record.steps.regression,
        };
        result.status = RESULT_STATUS.SUCCESS;
        result.reason = 'all-steps-passed';
        this.auditEvent('patch-loop-success', { attempt_id: result.attempt_id, bug_id: result.bug_id, iteration });
        break;
      }

      // 8. Failure: collect logs, update hypothesis, plan the next patch.
      const logs = {
        branch: branchName,
        iteration,
        hypothesis: clone(hypothesis),
        patch: clone(patch),
        steps: record.steps,
        reason: record.failure_reason,
      };
      const analysis = this.adapters.analyzeFailure({ bug: input.bug, hypothesis, logs, iteration, branch: branchName });
      record.updated_hypothesis = analysis && analysis.hypothesis ? clone(analysis.hypothesis) : null;
      result.iterations.push(record);
      this.auditEvent('patch-loop-iteration-failed', {
        attempt_id: result.attempt_id, bug_id: result.bug_id, iteration, reason: record.failure_reason,
      });

      if (iteration >= this.maxIterations) {
        result.iterations_used = iteration;
        result.status = RESULT_STATUS.ESCALATE_ITERATIONS_EXHAUSTED;
        result.reason = 'max-iterations-exhausted';
        this.auditEvent('patch-loop-escalated', { attempt_id: result.attempt_id, bug_id: result.bug_id, reason: result.reason });
        break;
      }

      hypothesis = (analysis && analysis.hypothesis) || hypothesis;
      patch = this.adapters.planPatch({ bug: input.bug, hypothesis, iteration: iteration + 1, branch: branchName });
    }

    return result;
  }
}

module.exports = { PatchLoop, RESULT_STATUS };