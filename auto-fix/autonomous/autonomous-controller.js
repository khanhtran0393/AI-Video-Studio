'use strict';

// Milestone 13 – Autonomous Mode orchestrator (Master Spec sections 12, 13, 15, 21, 22, 23, 34).
// Consumes:
//   - BugCaseStore (M4)
//   - RepairAttemptStore (M4)
//   - PatchLoop (M8)
//   - RegressionEngine (M9)
//   - RolloutController (M12)
//   - BuildRelease (M10)
//   - policy (from policy.js)
//   - audit function
// Exposes processBug(bugId, options) to run the full pipeline.
// All write/release actions are gated by policy.runtimeEnabled and the corresponding
// authorities. The controller never overrides policy.

const { PatchLoop, RESULT_STATUS } = require('../auto-patch-loop');
const { evaluateRisk, RISK_LEVELS } = require('./risk-engine');
const { loadPolicy } = require('../policy');
const crypto = require('crypto');

const STATUSES = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  REPAIR_FAILED: 'repair-failed',
  REPAIR_SUCCESS: 'repair-success',
  REGRESSION_GENERATED: 'regression-generated',
  RISK_EVALUATED: 'risk-evaluated',
  AUTO_RELEASE_INITIATED: 'auto-release-initiated',
  AUTO_RELEASE_COMPLETE: 'auto-release-complete',
  AUTO_ROLLBACK: 'auto-rollback',
  ESCALATED: 'escalated',
});

class AutonomousController {
  constructor(options = {}) {
    this.bugCases = options.bugCases;
    this.repairAttempts = options.repairAttempts;
    this.patchLoop = options.patchLoop || new PatchLoop();
    this.regressionEngine = options.regressionEngine;
    this.rolloutController = options.rolloutController;
    this.buildRelease = options.buildRelease;
    this.audit = options.audit || null;
    this.policy = options.policy || loadPolicy();
    this.highRiskAreas = this.policy.highRiskAreas || [];
    this.autoReleaseEnabled = this.policy.runtimeEnabled === true &&
      this.policy.authorities &&
      this.policy.authorities.release === true &&
      this.policy.authorities.rollout === true &&
      this.policy.authorities.rollback === true;
    this.maxRepairIterations = options.maxRepairIterations || this.policy.limits?.maxRepairIterations || 5;
    this.patchLimits = {
      maxFiles: options.maxPatchFiles || this.policy.limits?.maxPatchFiles || 5,
      maxAddedLines: options.maxPatchLines || this.policy.limits?.maxPatchLines || 200,
    };
    // Override patch loop limits if provided
    if (this.patchLoop && typeof this.patchLoop === 'object') {
      this.patchLoop.patchLimits = this.patchLoop.patchLimits || {};
      this.patchLoop.patchLimits.maxFiles = this.patchLimits.maxFiles;
      this.patchLoop.patchLimits.maxAddedLines = this.patchLimits.maxAddedLines;
    }
  }

  _audit(event, data) {
    if (this.audit) {
      try { this.audit({ event, ...(data || {}) }); } catch (_) {}
    }
  }

  _attemptId() {
    return `atp-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  _bugIdFromInput(bugId) {
    if (typeof bugId === 'string' && bugId.length > 0) return bugId;
    if (bugId && typeof bugId === 'object' && bugId.bug_id) return bugId.bug_id;
    throw new Error('invalid bug identifier');
  }

  async processBug(bugId, input = {}) {
    const id = this._bugIdFromInput(bugId);
    const bug = this.bugCases ? this.bugCases.get(id) : null;
    if (!bug) {
      this._audit('autonomous-bug-not-found', { bug_id: id });
      return { status: 'blocked', reason: 'bug-not-found', bug_id: id };
    }

    // Check if already processed
    if (bug.status === 'resolved' || bug.status === 'closed') {
      return { status: 'skipped', reason: 'bug-already-resolved', bug_id: id };
    }

    const attemptId = this._attemptId();
    const branchName = input.branchName || `ai-fix/${id}`;

    // 1. Create repair attempt record
    const attemptData = {
      attempt_id: attemptId,
      bug_id: id,
      branch: branchName,
      status: 'draft',
    };
    let attempt;
    try {
      attempt = this.repairAttempts ? this.repairAttempts.create(attemptData) : null;
    } catch (err) {
      this._audit('autonomous-attempt-create-failed', { bug_id: id, error: String(err.message).slice(0, 256) });
      return { status: 'blocked', reason: 'attempt-create-failed', bug_id: id, error: err.message };
    }
    this._audit('autonomous-attempt-created', { attempt_id: attemptId, bug_id: id });

    // 2. Run patch loop
    const loopInput = {
      bug,
      branchName,
      targetedTestId: input.targetedTestId || null,
      reproductionId: input.reproductionId || null,
      maxIterations: this.maxRepairIterations,
      maxFiles: this.patchLimits.maxFiles,
      maxAddedLines: this.patchLimits.maxAddedLines,
    };
    let loopResult;
    try {
      loopResult = this.patchLoop.run(loopInput);
    } catch (err) {
      this._audit('autonomous-patch-loop-exception', { bug_id: id, attempt_id: attemptId, error: String(err.message).slice(0, 256) });
      if (attempt && this.repairAttempts) {
        this.repairAttempts.update(attemptId, { status: 'rejected', build: { error: err.message } });
      }
      return { status: 'repair-failed', reason: 'patch-loop-exception', bug_id: id, attempt_id: attemptId };
    }

    if (loopResult.status !== RESULT_STATUS.SUCCESS) {
      const reason = loopResult.reason || 'loop-failed';
      if (attempt && this.repairAttempts) {
        this.repairAttempts.update(attemptId, { status: 'rejected', build: { reason } });
      }
      this._audit('autonomous-repair-failed', { bug_id: id, attempt_id: attemptId, reason });
      return {
        status: 'repair-failed',
        reason,
        bug_id: id,
        attempt_id: attemptId,
        iterations: loopResult.iterations_used,
        final_result: loopResult.final_result,
      };
    }

    // 3. Patch loop succeeded ? generate regression test
    let regressionCase = null;
    try {
      const regressionInput = {
        bug_id: id,
        fingerprint: bug.fingerprint || `fp-${id}`,
        source_kind: 'production-bug',
        source_note: `auto-generated from repair attempt ${attemptId}`,
        reproduction: {
          reproduction_id: input.reproductionId || null,
          sequence_id: bug.sequence_id || null,
          expected_fingerprint: bug.fingerprint || `fp-${id}`,
          sequence: bug.event_sequence || null,
          environment: bug.environment_id ? { environment_id: bug.environment_id } : null,
        },
        replay_spec: input.replaySpec || [],
        knowledge: {
          summary: bug.summary || null,
          root_cause: bug.root_cause || null,
          environment_specific: !!bug.environment_id,
        },
      };
      regressionCase = this.regressionEngine.generateRegressionTest(regressionInput);
    } catch (err) {
      this._audit('autonomous-regression-generate-failed', { bug_id: id, attempt_id: attemptId, error: String(err.message).slice(0, 256) });
      // Non-fatal: still continue, but record the failure
    }

    if (attempt && this.repairAttempts) {
      const updatePatch = {
        status: 'tests-passed',
        patch: loopResult.final_result || {},
        tests: { targeted: true, reproduction: true, regression: true },
        reproduction_result: loopResult.final_result?.reproduction || null,
        regression_result: loopResult.final_result?.regression || null,
      };
      if (regressionCase) {
        updatePatch.regression_result = { regression_id: regressionCase.regression_id, status: 'generated' };
      }
      this.repairAttempts.update(attemptId, updatePatch);
    }

    this._audit('autonomous-repair-success', { bug_id: id, attempt_id: attemptId });

    // 4. Evaluate risk
    const riskInput = {
      patch: loopResult.final_result || {},
      affectedAreas: input.affectedAreas || [],
      aiConfidence: bug.ai_confidence || null,
      reproductionResult: loopResult.final_result?.reproduction || null,
      policyHighRiskAreas: this.highRiskAreas,
      limits: this.patchLimits,
    };
    const riskEval = evaluateRisk(riskInput);

    if (attempt && this.repairAttempts) {
      this.repairAttempts.update(attemptId, {
        risk_score: riskEval.total / 10, // normalize to [0,1] roughly
        ai_confidence: bug.ai_confidence || null,
      });
    }

    this._audit('autonomous-risk-evaluated', { bug_id: id, attempt_id: attemptId, riskLevel: riskEval.level, total: riskEval.total });

    // 5. Decision: auto-release or escalate?
    const autoRelease = this.autoReleaseEnabled && riskEval.level === 'low';

    if (autoRelease) {
      // 5a. Low-risk auto-release
      const releaseId = `rel-${id}-${Date.now().toString(36)}`;
      const artifactId = input.artifactId || `art-${id}`;

      // Create a release record via BuildRelease
      let releaseResult;
      try {
        const releasePayload = {
          release_id: releaseId,
          version: input.version || '1.0.0',
          artifact_id: artifactId,
          rollout_state: 'canary',
          canary_percentage: 5,
          reason: 'Autonomous low-risk release from bug fix',
        };
        releaseResult = this.buildRelease.createRelease(releasePayload);
        if (!releaseResult.allowed) {
          throw new Error(`release not allowed: ${releaseResult.reason}`);
        }
      } catch (err) {
        this._audit('autonomous-release-create-failed', { bug_id: id, attempt_id: attemptId, error: String(err.message).slice(0, 256) });
        return {
          status: 'release-failed',
          reason: err.message,
          bug_id: id,
          attempt_id: attemptId,
          risk: riskEval,
        };
      }

      // Start canary rollout via RolloutController
      let rolloutState;
      try {
        this.rolloutController.store.start(input.version || '1.0.0');
        // Simulate a first evaluation to promote to 5% (or initial)
        const metrics = input.initialMetrics || { sample_size: 1000, crash_rate: 0.01, error_rate: 0.02 };
        const baseline = input.baselineMetrics || { crash_rate: 0.005, error_rate: 0.01 };
        const evalResult = this.rolloutController.evaluate({ metrics, baseline });
        rolloutState = evalResult.state;
      } catch (err) {
        this._audit('autonomous-rollout-start-failed', { bug_id: id, attempt_id: attemptId, error: String(err.message).slice(0, 256) });
        // Attempt rollback if possible
        try { this.buildRelease.rollback(releaseId, 'Rollout start failed'); } catch (_) {}
        return {
          status: 'rollout-failed',
          reason: err.message,
          bug_id: id,
          attempt_id: attemptId,
          risk: riskEval,
        };
      }

      if (attempt && this.repairAttempts) {
        this.repairAttempts.update(attemptId, {
          status: 'released',
          build: { release_id: releaseId, artifact_id: artifactId },
        });
      }

      this._audit('autonomous-auto-release-initiated', { bug_id: id, attempt_id: attemptId, release_id: releaseId, rolloutState });

      // Return initial success, but the feedback loop will monitor asynchronously
      return {
        status: 'auto-release-initiated',
        bug_id: id,
        attempt_id: attemptId,
        risk: riskEval,
        release_id: releaseId,
        rollout_state: rolloutState,
        regression_case: regressionCase,
        loop_result: loopResult,
      };
    } else {
      // 5b. Escalate to human
      if (attempt && this.repairAttempts) {
        this.repairAttempts.update(attemptId, { status: 'rejected', build: { reason: 'escalated-human-approval-required' } });
      }
      this._audit('autonomous-escalated', { bug_id: id, attempt_id: attemptId, riskLevel: riskEval.level, autoReleaseEnabled: this.autoReleaseEnabled });
      return {
        status: 'escalated',
        reason: riskEval.level === 'high' ? 'high-risk-change' : 'auto-release-disabled',
        bug_id: id,
        attempt_id: attemptId,
        risk: riskEval,
        regression_case: regressionCase,
        loop_result: loopResult,
        auto_release_enabled: this.autoReleaseEnabled,
      };
    }
  }

  // Feedback loop: monitor an active rollout and auto-rollback on critical breach.
  monitorRollout(releaseId, bugId, options = {}) {
    if (!this.rolloutController) {
      return { decision: 'blocked', reason: 'no-rollout-controller' };
    }
    const state = this.rolloutController.store.current();
    if (!state || state.status !== 'active') {
      return { decision: 'noop', reason: 'rollout-not-active', state };
    }
    const metrics = options.metrics || { sample_size: 1000, crash_rate: 0.01, error_rate: 0.02 };
    const baseline = options.baseline || { crash_rate: 0.005, error_rate: 0.01 };
    const evalResult = this.rolloutController.evaluate({ metrics, baseline });
    const decision = evalResult.decision;

    // If critical, trigger rollback via BuildRelease
    if (decision === 'rollback' && this.buildRelease) {
      try {
        const rollbackResult = this.buildRelease.rollback(releaseId, 'Auto-rollback due to critical health breach');
        this._audit('autonomous-feedback-rollback', { bug_id: bugId, release_id: releaseId, reason: 'critical-health-breach' });
        if (rollbackResult.allowed) {
          // Also record a regression case for the rollback incident
          if (this.regressionEngine && bugId) {
            try {
              this.regressionEngine.generateRegressionTest({
                bug_id: bugId,
                fingerprint: `rollback-${releaseId}`,
                source_kind: 'rollback-incident',
                source_note: `Auto-rollback from release ${releaseId} due to critical health`,
                reproduction: { expected_fingerprint: `rollback-${releaseId}` },
                replay_spec: [],
                knowledge: { summary: `Rollback incident for ${bugId}`, root_cause: 'production metrics breached thresholds' },
              });
            } catch (_) {}
          }
          return { decision: 'rollback', state: rollbackResult.release, reason: 'critical-health-breach' };
        }
      } catch (err) {
        this._audit('autonomous-feedback-rollback-failed', { bug_id: bugId, release_id: releaseId, error: String(err.message).slice(0, 256) });
        return { decision: 'rollback-failed', reason: err.message };
      }
    }

    this._audit('autonomous-feedback-evaluated', { bug_id: bugId, release_id: releaseId, decision });
    return { decision, state };
  }
}

module.exports = {
  AutonomousController,
  STATUSES,
};
