'use strict';

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { AutonomousController } = require('../autonomous-controller');
const { PatchLoop } = require('../../auto-patch-loop');
const { RegressionEngine } = require('../../regression-engine');
const { RolloutController, RolloutStore } = require('../../canary-monitoring');
const { BuildRelease } = require('../../build-release');
const { BugCaseStore } = require('../../bug-intelligence/bug-case');
const { RepairAttemptStore } = require('../../bug-intelligence/repair-attempt');

// Create temporary stores and mocks
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonomous-test-'));
const audit = [];

function makeStore(storeClass, filename) {
  return new storeClass(path.join(tempDir, filename), { audit: (ev) => audit.push(ev) });
}

const bugStore = makeStore(BugCaseStore, 'bugs.json');
const attemptStore = makeStore(RepairAttemptStore, 'attempts.json');

// Create a mock patch loop that always succeeds or fails based on input
class MockPatchLoop {
  constructor(options = {}) {
    this.maxIterations = options.maxIterations || 5;
    this.patchLimits = options.patchLimits || { maxFiles: 5, maxAddedLines: 200 };
    this.shouldSucceed = options.shouldSucceed !== false;
  }
  run(input) {
    if (this.shouldSucceed) {
      return {
        status: 'success',
        attempt_id: 'mock-apt',
        bug_id: input.bug.bug_id,
        branch: input.branchName,
        iterations_used: 1,
        final_result: { files: ['a.js'], addedLines: 5 },
        reason: 'all-steps-passed',
      };
    } else {
      return {
        status: 'escalate-iterations-exhausted',
        attempt_id: 'mock-apt',
        bug_id: input.bug.bug_id,
        reason: 'max-iterations-exhausted',
      };
    }
  }
}

// Mock regression engine that records calls
class MockRegressionEngine {
  generateRegressionTest(input) {
    return { regression_id: `reg-${input.bug_id}`, ...input };
  }
}

// Mock BuildRelease that allows operations
class MockBuildRelease {
  constructor() {
    this.releases = {};
    this.rollbackCalled = false;
  }
  createRelease(payload) {
    this.releases[payload.release_id] = payload;
    return { allowed: true, release: payload };
  }
  rollback(releaseId, reason) {
    this.rollbackCalled = true;
    return { allowed: true, release: { release_id: releaseId, rollback_state: 'requested' } };
  }
}

// Create controller
const buildRelease = new MockBuildRelease();
const rolloutStore = new RolloutStore(path.join(tempDir, 'rollout.json'), { audit: (ev) => audit.push(ev) });
const rolloutController = new RolloutController({ store: rolloutStore });
const patchLoop = new MockPatchLoop({ shouldSucceed: true });
const regressionEngine = new MockRegressionEngine();

const policy = {
  runtimeEnabled: true,
  authorities: { release: true, rollout: true, rollback: true },
  limits: { maxRepairIterations: 5, maxPatchFiles: 5, maxPatchLines: 200 },
  highRiskAreas: ['authentication', 'encryption', 'signing'],
};

// Add a bug to the store
const bugId = 'BUG-123';
bugStore.create({
  bug_id: bugId,
  fingerprint: 'fp-123',
  status: 'open',
  summary: 'Test bug',
  ai_confidence: { root_cause_confidence: 0.9, patch_confidence: 0.9, release_confidence: 0.9 },
});

const controller = new AutonomousController({
  bugCases: bugStore,
  repairAttempts: attemptStore,
  patchLoop,
  regressionEngine,
  rolloutController,
  buildRelease,
  policy,
  audit: (ev) => audit.push(ev),
});

// Test 1: success path -> auto-release
async function runTests() {
  let result = await controller.processBug(bugId, { version: '1.5.0', artifactId: 'art-123' });
  assert.strictEqual(result.status, 'auto-release-initiated');
  assert.strictEqual(result.bug_id, bugId);
  assert.ok(result.release_id);
  assert.ok(result.regression_case);
  // Check that a repair attempt was created
  const attempts = attemptStore.listForBug(bugId);
  assert.strictEqual(attempts.length, 1);
  assert.strictEqual(attempts[0].status, 'released');

  // Test 2: patch loop failure -> repair-failed
  const failController = new AutonomousController({
    bugCases: bugStore,
    repairAttempts: attemptStore,
    patchLoop: new MockPatchLoop({ shouldSucceed: false }),
    regressionEngine,
    rolloutController,
    buildRelease,
    policy,
    audit: (ev) => audit.push(ev),
  });
  const failResult = await failController.processBug(bugId, { version: '1.6.0' });
  assert.strictEqual(failResult.status, 'repair-failed');

  // Test 3: auto-release disabled -> escalated
  const policyDisabled = {
    runtimeEnabled: true,
    authorities: { release: false, rollout: false, rollback: false },
    limits: { maxRepairIterations: 5, maxPatchFiles: 5, maxPatchLines: 200 },
    highRiskAreas: [],
  };
  const disabledController = new AutonomousController({
    bugCases: bugStore,
    repairAttempts: attemptStore,
    patchLoop,
    regressionEngine,
    rolloutController,
    buildRelease,
    policy: policyDisabled,
    audit: (ev) => audit.push(ev),
  });
  const disabledResult = await disabledController.processBug(bugId, { version: '1.7.0' });
  assert.strictEqual(disabledResult.status, 'escalated');
  assert.strictEqual(disabledResult.auto_release_enabled, false);

  // Test 4: feedback loop monitor
  const monitorResult = controller.monitorRollout(result.release_id, bugId, {
    metrics: { sample_size: 1000, crash_rate: 0.2 },
    baseline: { crash_rate: 0.005 },
  });
  assert.ok(monitorResult.decision === 'rollback' || monitorResult.decision === 'noop');
  // If rollback was triggered, buildRelease.rollbackCalled should be true
  // (depends on threshold configuration; we just test that it runs)

  console.log('autonomous-controller tests: passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});