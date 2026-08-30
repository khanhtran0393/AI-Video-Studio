'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ErrorReporter } = require('../reporter');
const { validateCrashReport } = require('../../crash-server/schema');
const { serverFingerprint } = require('../../crash-server/fingerprint');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-contract-'));
try {
  const reporter = new ErrorReporter({
    appVersion: '1.0.1',
    buildId: 'integration-test',
    clientInstallationId: 'test-installation',
    queueFile: path.join(temp, 'queue.json'),
  });
  const error = new TypeError('renderer failed at 0x1234');
  error.stack = 'TypeError: renderer failed at 0x1234\n    at render (C:\\app\\nova\\renderer.js:10:3)';
  const report = reporter.captureException(error, { source: 'renderer' });

  assert.strictEqual(validateCrashReport(report).valid, true, 'client report must satisfy crash-server schema');
  assert.match(report.fingerprint, /^[0-9a-f]{64}$/);
  assert.match(serverFingerprint(report), /^[0-9a-f]{64}$/);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(report, 'error_code'), false);

  const coded = new Error('file missing');
  coded.code = 'ENOENT';
  coded.stack = 'Error: file missing\n    at read (C:\\app\\nova\\reader.js:4:2)';
  const codedReport = reporter.captureException(coded);
  assert.strictEqual(codedReport.error_code, 'ENOENT');
  assert.strictEqual(validateCrashReport(codedReport).valid, true);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('client/server crash contract tests: passed');
