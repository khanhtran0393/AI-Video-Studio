'use strict';

const assert = require('assert');
const { PatchLoop, RESULT_STATUS } = require('../patch-loop');

function buildAdapters(overrides = {}) {
  return {
    createBranch: (args) => ({ ok: true, branch: args.branchName }),
    applyPatch: () => ({ ok: true }),
    runTargetedTest: () => ({ status: 'passed' }),
    runReproduction: () => ({ status: 'reproduced' }),
    runRegressionSuite: () => ({ status: 'passed' }),
    analyzeFailure: () => ({ hypothesis: { id: 'H2', statement: 'updated', confidence: 0.8 } }),
    planPatch: () => ({ files: [{ path: 'src/x.js' }], addedLines: 1 }),
    ...overrides,
  };
}

const bug = { bug_id: 'BUG-1' };
const branch = 'ai-fix/BUG-1';
const minimalPatch = { files: [{ path: 'src/x.js' }], addedLines: 1 };

(function testSuccessFirstIteration() {
  const loop = new PatchLoop({ maxIterations: 5, ...buildAdapters() });
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch, targetedTestId: 't1', reproductionId: 'r1' });
  assert.strictEqual(result.status, RESULT_STATUS.SUCCESS);
  assert.strictEqual(result.reason, 'all-steps-passed');
  assert.strictEqual(result.iterations_used, 1);
  assert.strictEqual(result.iterations.length, 1);
  assert.strictEqual(result.iterations[0].passed, true);
  assert.ok(result.attempt_id.startsWith('apt-'));
  assert.ok(result.final_result);
  assert.ok(result.iterations[0].steps.create_branch);
  assert.ok(result.iterations[0].steps.apply_patch);
  assert.ok(result.iterations[0].steps.targeted_test);
  assert.ok(result.iterations[0].steps.reproduction);
  assert.ok(result.iterations[0].steps.regression);
  console.log('testSuccessFirstIteration: PASS');
})();

(function testIterativeRepair() {
  let runs = 0;
  const adapters = buildAdapters({
    runTargetedTest: () => {
      runs += 1;
      return runs === 1 ? { status: 'failed', logs: ['assert failed'] } : { status: 'passed' };
    },
    analyzeFailure: () => ({ hypothesis: { id: 'H2', statement: 'recompute bounds', confidence: 0.9 } }),
    planPatch: () => ({ files: [{ path: 'src/x.js' }], addedLines: 2 }),
  });
  const loop = new PatchLoop({ maxIterations: 5, ...adapters });
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.strictEqual(result.status, RESULT_STATUS.SUCCESS);
  assert.strictEqual(result.iterations_used, 2);
  assert.strictEqual(result.iterations.length, 2);
  assert.strictEqual(result.iterations[0].passed, false);
  assert.strictEqual(result.iterations[0].failure_reason, 'targeted-test-failed');
  assert.strictEqual(result.iterations[0].updated_hypothesis.id, 'H2');
  assert.strictEqual(result.iterations[1].passed, true);
  console.log('testIterativeRepair: PASS');
})();

(function testMaxIterationsExhausted() {
  const adapters = buildAdapters({
    runTargetedTest: () => ({ status: 'failed', logs: ['still broken'] }),
    analyzeFailure: () => ({ hypothesis: { id: 'Hx', statement: 'retry', confidence: 0.3 } }),
    planPatch: () => ({ files: [{ path: 'src/x.js' }], addedLines: 1 }),
  });
  const loop = new PatchLoop({ maxIterations: 3, ...adapters });
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.strictEqual(result.status, RESULT_STATUS.ESCALATE_ITERATIONS_EXHAUSTED);
  assert.strictEqual(result.reason, 'max-iterations-exhausted');
  assert.strictEqual(result.iterations_used, 3);
  assert.strictEqual(result.iterations.length, 3);
  assert.ok(result.iterations.every((it) => it.passed === false));
  console.log('testMaxIterationsExhausted: PASS');
})();

(function testInvalidInputs() {
  const loop = new PatchLoop({ ...buildAdapters() });
  assert.strictEqual(loop.run({ bug, branchName: 'main' }).reason, 'invalid-branch');
  assert.strictEqual(loop.run({ bug, branchName: 'ai-fix/../evil' }).reason, 'invalid-branch');
  assert.strictEqual(loop.run({ bug: null, branchName: branch }).reason, 'invalid-bug');
  assert.strictEqual(loop.run({ bug: {}, branchName: branch }).reason, 'invalid-bug');
  assert.strictEqual(loop.run({ bug, branchName: branch }).status, RESULT_STATUS.SUCCESS);
  console.log('testInvalidInputs: PASS');
})();

(function testMissingAdapter() {
  const loop = new PatchLoop({});
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.strictEqual(result.status, RESULT_STATUS.BLOCKED);
  assert.ok(result.reason.startsWith('missing-adapter'));
  console.log('testMissingAdapter: PASS');
})();

(function testPatchExceedsPolicy() {
  const loop = new PatchLoop({
    maxIterations: 5,
    maxFiles: 1,
    maxAddedLines: 10,
    ...buildAdapters(),
  });
  const bigPatch = { files: [{ path: 'a' }, { path: 'b' }], addedLines: 1 };
  const result = loop.run({ bug, branchName: branch, initialPatch: bigPatch });
  assert.strictEqual(result.status, RESULT_STATUS.ESCALATE_INSUFFICIENT_EVIDENCE);
  assert.strictEqual(result.reason, 'patch-exceeds-policy');
  assert.strictEqual(result.iterations_used, 1);
  console.log('testPatchExceedsPolicy: PASS');
})();

(function testBranchCreationFails() {
  const adapters = buildAdapters({ createBranch: () => ({ ok: false, reason: 'protected' }) });
  const loop = new PatchLoop({ maxIterations: 5, ...adapters });
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.strictEqual(result.status, RESULT_STATUS.BLOCKED);
  assert.strictEqual(result.reason, 'branch-creation-failed');
  assert.strictEqual(result.iterations_used, 1);
  console.log('testBranchCreationFails: PASS');
})();

(function testReproductionGate() {
  const adapters = buildAdapters({ runReproduction: () => ({ status: 'not-reproduced' }) });
  const loop = new PatchLoop({ maxIterations: 2, ...adapters });
  const result = loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.strictEqual(result.status, RESULT_STATUS.ESCALATE_ITERATIONS_EXHAUSTED);
  assert.strictEqual(result.iterations[0].failure_reason, 'reproduction-not-reproduced');
  console.log('testReproductionGate: PASS');
})();

(function testNoPatchPlanned() {
  const adapters = buildAdapters({ planPatch: () => null });
  const loop = new PatchLoop({ maxIterations: 5, ...adapters });
  const result = loop.run({ bug, branchName: branch });
  assert.strictEqual(result.status, RESULT_STATUS.ESCALATE_INSUFFICIENT_EVIDENCE);
  assert.strictEqual(result.reason, 'no-patch-planned');
  console.log('testNoPatchPlanned: PASS');
})();

(function testAuditHook() {
  const events = [];
  const loop = new PatchLoop({
    maxIterations: 5,
    audit: (ev) => events.push(ev.event),
    ...buildAdapters(),
  });
  loop.run({ bug, branchName: branch, initialPatch: minimalPatch });
  assert.ok(events.includes('patch-loop-started'));
  assert.ok(events.includes('patch-loop-success'));
  console.log('testAuditHook: PASS');
})();

console.log('PATCH LOOP TEST: PASS');