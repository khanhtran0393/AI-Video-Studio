'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ErrorReporter } = require('../reporter');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'err-reporter-'));
(async () => {
try {
  const fakeEmitter = {
    handlers: new Map(),
    on(channel, fn) { this.handlers.set(channel, fn); },
    removeListener(channel, fn) { if (this.handlers.get(channel) === fn) this.handlers.delete(channel); },
  };

  const reporter = new ErrorReporter({
    appVersion: '0.1.34',
    buildId: 'build-1',
    clientInstallationId: 'inst-1',
    releaseIdentity: { git_commit_sha: 'a'.repeat(40), artifact_sha256: 'b'.repeat(64), build_id: 'must-not-override' },
    queueFile: path.join(temp, 'crash-queue.json'),
  });

  // Event recording sanitizes params before entering the buffer.
  reporter.recordEvent('open_project', { apiKey: 'secret', name: 'demo' });
  assert.strictEqual(reporter.buffer.size, 1);

  // captureException produces a sanitized, stable report.
  const error = new TypeError('boom at 0x12');
  error.stack = 'TypeError: boom at 0x12\n    at run (C:\\app\\nova\\run.js:10:3)';
  const report = reporter.captureException(error, { user_note: 'password=hunter2' });
  assert.ok(report.fingerprint);
  assert.strictEqual(report.app_version, '0.1.34');
  assert.strictEqual(report.build_id, 'build-1');
  assert.strictEqual(report.git_commit_sha, 'a'.repeat(40));
  assert.strictEqual(report.artifact_sha256, 'b'.repeat(64));
  assert.strictEqual(report.client_installation_id, 'inst-1');
  assert.strictEqual(report.status, 'queued');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(report, 'error_code'), false, 'empty optional error_code must be omitted');
  const canonical = reporter.captureException(error, { crash_id: 'caller-id', build_id: 'caller-build', status: 'completed' });
  assert.notStrictEqual(canonical.crash_id, 'caller-id');
  assert.strictEqual(canonical.build_id, 'build-1');
  assert.strictEqual(canonical.status, 'queued');
  assert.ok(!JSON.stringify(report).includes('hunter2'), 'secrets must not leak into the report');
  assert.ok(report.stack_trace.includes('[REDACTED]') || !report.stack_trace.includes('hunter2'));

  // report() queues locally and never throws even without an uploader.
  const result = reporter.report(error);
  assert.strictEqual(result.queued, true);
  assert.strictEqual(reporter.queue.peek().length, 1);

  // Duplicate report is deduplicated.
  const dup = reporter.report(error);
  assert.strictEqual(dup.queued, false);
  assert.strictEqual(dup.reason, 'duplicate');

  // installGlobalHandlers registers on the injectable emitter.
  const uninstall = reporter.installGlobalHandlers(fakeEmitter);
  assert.ok(fakeEmitter.handlers.has('uncaughtException'));
  assert.ok(fakeEmitter.handlers.has('unhandledRejection'));
  uninstall();
  assert.strictEqual(fakeEmitter.handlers.size, 0);

  // A concurrent shutdown joins the active flush instead of returning early.
  let releaseUpload;
  const slowReporter = new ErrorReporter({
    queueFile: path.join(temp, 'slow.json'),
    uploader: { send: () => new Promise((resolve) => { releaseUpload = resolve; }) },
  });
  slowReporter.queue.enqueue({ id: 'slow', fingerprint: 'slow-fp' });
  const activeFlush = slowReporter.flush();
  while (!releaseUpload) await new Promise((resolve) => setImmediate(resolve));
  const shutdown = slowReporter.shutdown(200);
  releaseUpload({ status: 200 });
  assert.strictEqual((await activeFlush).sent, 1);
  assert.strictEqual((await shutdown).sent, 1);

  // Online recovery immediately retries reports retained after a transient error.
  let uploads = 0;
  const online = { handlers: new Map(), on(n, f) { this.handlers.set(n, f); }, removeListener(n, f) { if (this.handlers.get(n) === f) this.handlers.delete(n); } };
  const recoveryReporter = new ErrorReporter({
    queueFile: path.join(temp, 'recovery.json'), flushIntervalMs: 10000,
    uploader: { send: async () => { uploads++; if (uploads === 1) throw new Error('offline'); return { status: 200 }; } },
  });
  recoveryReporter.queue.enqueue({ id: 'recovery', fingerprint: 'recovery-fp' });
  await recoveryReporter.flush();
  assert.strictEqual(recoveryReporter.queue.peek().length, 1);
  recoveryReporter.startLifecycle({ networkTarget: online });
  online.handlers.get('online')();
  while (recoveryReporter.queue.peek().length) await new Promise((resolve) => setTimeout(resolve, 2));
  recoveryReporter.stopLifecycle();
  assert.strictEqual(uploads >= 2, true);
  assert.strictEqual(online.handlers.size, 0);

  const timeoutReporter = new ErrorReporter({ queueFile: path.join(temp, 'timeout.json'), uploader: { send: () => new Promise(() => {}) } });
  timeoutReporter.queue.enqueue({ id: 'timeout', fingerprint: 'timeout-fp' });
  const timedOut = await timeoutReporter.shutdown(5);
  assert.strictEqual(timedOut.timedOut, true);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('reporter tests: passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });