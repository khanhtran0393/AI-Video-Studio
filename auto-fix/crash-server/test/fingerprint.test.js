'use strict';

const assert = require('assert');
const { serverFingerprint, dedupKeyFor, validClientFingerprint, normalizeErrorCode, extractModule } = require('../fingerprint');

const base = {
  error_type: 'TypeError',
  message: 'boom at 0x1234 on 42',
  stack_trace: 'TypeError: boom\n    at run (C:\\app\\nova\\run.js:10:3)',
};

const volatile = {
  error_type: 'TypeError',
  message: 'boom at 0x5678 on 99',
  stack_trace: 'TypeError: boom\n    at run (D:\\other\\nova\\run.js:99:7)',
};

assert.strictEqual(serverFingerprint(base), serverFingerprint(volatile), 'volatile tokens must normalize away');

assert.strictEqual(validClientFingerprint('ab12cd34ef56ab12cd34ef56ab12cd34'), true);
assert.strictEqual(validClientFingerprint('not a fingerprint'), false);
assert.strictEqual(validClientFingerprint('ab12'), false);

assert.strictEqual(dedupKeyFor({ fingerprint: 'AB12CD34EF56AB12CD34EF56AB12CD34' }), 'ab12cd34ef56ab12cd34ef56ab12cd34', 'must lowercase well-formed client fingerprint');
assert.strictEqual(dedupKeyFor({ ...base, fingerprint: 'bad' }), serverFingerprint({ ...base, fingerprint: 'bad' }), 'must fall back to server fingerprint');

// Error codes are part of the stable basis.
assert.strictEqual(normalizeErrorCode('ENOENT'), 'ENOENT');
assert.strictEqual(normalizeErrorCode(' not-a-code !'), 'not-a-code');
assert.strictEqual(normalizeErrorCode(null), '');
assert.strictEqual(extractModule({ module: 'Run.js' }), 'run.js');
assert.strictEqual(extractModule({ stack_trace: base.stack_trace }), 'run.js');
assert.notStrictEqual(
  serverFingerprint({ ...base, error_code: 'ENOENT' }),
  serverFingerprint({ ...base, error_code: 'EACCES' }),
  'different error codes must not collapse',
);
assert.strictEqual(
  serverFingerprint({ ...base, module: 'run.js' }),
  serverFingerprint(base),
  'explicit module must match module parsed from the stack',
);

console.log('fingerprint tests: passed');