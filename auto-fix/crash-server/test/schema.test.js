'use strict';

const assert = require('assert');
const { validateCrashReport } = require('../schema');

function validReport(overrides = {}) {
  return {
    crash_id: 'crash-1',
    app_version: '0.1.34',
    build_id: 'build-1',
    fingerprint: 'ab12cd34ef56ab12cd34ef56ab12cd34',
    timestamp: new Date().toISOString(),
    error_type: 'TypeError',
    message: 'boom',
    stack_trace: 'TypeError: boom\n    at run (C:\\app\\main.js:1:2)',
    client_installation_id: 'inst-1',
    environment_id: 'env-1',
    event_sequence_id: 'seq-1',
    sanitized_logs: { sequence_id: 'seq-1', events: [{ seq: 1, type: 'start', params: {} }] },
    ...overrides,
  };
}

assert.strictEqual(validateCrashReport(null).valid, false);
assert.strictEqual(validateCrashReport([]).valid, false);
assert.strictEqual(validateCrashReport({}).valid, false);

const missingField = validReport();
delete missingField.crash_id;
assert.ok(!validateCrashReport(missingField).valid, 'missing crash_id must fail');

assert.ok(!validateCrashReport(validReport({ timestamp: 'not-a-date' })).valid, 'bad timestamp must fail');
assert.ok(!validateCrashReport(validReport({ stack_trace: 42 })).valid, 'non-string stack must fail');
assert.ok(!validateCrashReport(validReport({ sanitized_logs: 'x' })).valid, 'non-object sanitized_logs must fail');
assert.ok(!validateCrashReport(validReport({ sanitized_logs: { events: 'x' } })).valid, 'non-array events must fail');
assert.ok(!validateCrashReport(validReport({ fingerprint: '' })).valid, 'empty fingerprint must fail');
assert.ok(!validateCrashReport(validReport({ message: 'x'.repeat(5000) })).valid, 'overlong message must fail');
assert.ok(!validateCrashReport(validReport({ stack_trace: 'x'.repeat(20000) })).valid, 'overlong stack must fail');

const overflow = validReport({ sanitized_logs: { events: Array.from({ length: 201 }, (_, i) => ({ seq: i })) } });
assert.ok(!validateCrashReport(overflow).valid, 'event overflow must fail');

assert.strictEqual(validateCrashReport(validReport()).valid, true);
assert.strictEqual(validateCrashReport(validReport({ environment_id: null, event_sequence_id: null })).valid, true);

assert.ok(!validateCrashReport(validReport({ error_code: 123 })).valid, 'non-string error_code must fail');
assert.ok(!validateCrashReport(validReport({ module: '' })).valid, 'empty module must fail');
assert.strictEqual(validateCrashReport(validReport({ error_code: 'ENOENT', module: 'run.js' })).valid, true);
assert.strictEqual(validateCrashReport(validReport({ error_code: null, module: null })).valid, true);

console.log('schema tests: passed');