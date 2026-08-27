'use strict';

const assert = require('assert');
const { reconcileReport, normalizeClientFingerprint } = require('../fingerprint');

// Test client fingerprint normalization.
assert.strictEqual(normalizeClientFingerprint('ab12cd34ef56ab12cd34ef56ab12cd34'), 'ab12cd34ef56ab12cd34ef56ab12cd34');
assert.strictEqual(normalizeClientFingerprint('AB12CD34EF56AB12CD34EF56AB12CD34'), 'ab12cd34ef56ab12cd34ef56ab12cd34');
assert.strictEqual(normalizeClientFingerprint('short'), null);
assert.strictEqual(normalizeClientFingerprint(null), null);

// Test reconciliation: server fingerprint is canonical.
const report = {
  error_type: 'TypeError',
  message: 'boom at 0x1234',
  stack_trace: 'TypeError: boom\\n    at run (C:\\\\app\\\\nova\\\\run.js:10:3)',
  fingerprint: 'ab12cd34ef56ab12cd34ef56ab12cd34',
};
const result = reconcileReport(report);
assert.strictEqual(result.clientFingerprint, 'ab12cd34ef56ab12cd34ef56ab12cd34');
assert.ok(result.serverFingerprint && result.serverFingerprint.length === 32);
assert.strictEqual(result.canonicalFingerprint, result.serverFingerprint);

// Volatile details should not change server fingerprint.
const report2 = {
  error_type: 'TypeError',
  message: 'boom at 0x5678',
  stack_trace: 'TypeError: boom\\n    at run (D:\\\\other\\\\nova\\\\run.js:99:7)',
  fingerprint: 'ab12cd34ef56ab12cd34ef56ab12cd34',
};
const result2 = reconcileReport(report2);
assert.strictEqual(result2.serverFingerprint, result.serverFingerprint);

console.log('fingerprint tests: passed');