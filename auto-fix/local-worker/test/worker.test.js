'use strict';

const assert = require('assert');
const { ObserveWorker } = require('../worker');
const { observeOnlyDiagnosis } = require('../diagnose');

const crash = {
  crash_id: 'crash-00000001', fingerprint: 'a'.repeat(64), error_type: 'TypeError',
  message: "Cannot read properties of undefined (reading 'x')",
  stack_trace: 'TypeError: failed\n    at render (C:\\app\\nova\\render.js:42:9)',
  app_version: '1.0.0', build_id: 'build-1', timestamp: '2026-08-27T10:00:00Z',
};

(async () => {
  const calls = [];
  const client = {
    async claim() { calls.push('claim'); return { job: { job_id: 'job-1', type: 'observe-diagnosis', lease_token: 'lease', crash } }; },
    async heartbeat() { calls.push('heartbeat'); },
    async complete(id, lease, result) { calls.push('complete'); assert.strictEqual(result.mode, 'observe-only'); },
    async fail() { calls.push('fail'); },
  };
  const worker = new ObserveWorker({ client, workerId: 'test-worker', heartbeatIntervalMs: 10000, logger: { info() {}, error() {} } });
  assert.strictEqual(await worker.processOne(), true);
  assert.deepStrictEqual(calls, ['claim', 'complete']);

  const output = observeOnlyDiagnosis({ type: 'observe-diagnosis', crash });
  assert.strictEqual(output.mode, 'observe-only');
  assert.strictEqual(output.processor, 'deterministic-debug-agent');
  assert.strictEqual(output.diagnosis.bug.crash_id, crash.crash_id);
  assert.notStrictEqual(output.diagnosis.outcome, 'blocked');
  assert.throws(() => observeOnlyDiagnosis({ type: 'write-patch', crash }), /unsupported or malformed job/);

  const invalidConfigWorker = new ObserveWorker({
    client, workerId: 'test-worker', pollIntervalMs: -1, heartbeatIntervalMs: 1.5,
    logger: { info() {}, error() {} },
  });
  assert.strictEqual(invalidConfigWorker.pollIntervalMs, 10000);
  assert.strictEqual(invalidConfigWorker.heartbeatIntervalMs, 30000);

  let failed = false;
  const failureWorker = new ObserveWorker({
    client: { async claim() { return { job: { job_id: 'job-2', type: 'observe-diagnosis', lease_token: 'lease', crash } }; },
      async heartbeat() {}, async complete() {}, async fail() { failed = true; } },
    workerId: 'test-worker', processor: async () => { throw new Error('diagnosis failed'); }, logger: { info() {}, error() {} },
  });
  await failureWorker.processOne();
  assert.strictEqual(failed, true);
  console.log('local worker tests: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
