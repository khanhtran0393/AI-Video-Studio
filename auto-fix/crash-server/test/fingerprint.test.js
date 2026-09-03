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

// Regression 2026-09-03: path cài chứa dấu cách (dev checkout "D:\AI Video Studio\...")
// trước đây chỉ bị thay MỘT PHẦN bởi regex path (token không-khoảng-trắng), sót
// đuôi path trong basis → fingerprint lệch giữa máy cài. Path máy trắng
// (AppData\...\app.asar, không dấu cách) và path dev phải ra cùng fingerprint.
const spacedDev = {
  error_type: 'TypeError',
  message: 'boom at 0x1234 on 42',
  stack_trace: 'TypeError: boom\n    at run (D:\\AI Video Studio\\nova\\run.js:10:3)',
};
const spacedClean = {
  error_type: 'TypeError',
  message: 'boom at 0x5678 on 99',
  stack_trace: 'TypeError: boom\n    at run (C:\\Users\\Khach\\AppData\\Local\\Programs\\ai-video-studio\\resources\\app.asar\\nova\\run.js:99:7)',
};
assert.strictEqual(
  serverFingerprint(spacedDev),
  serverFingerprint(spacedClean),
  'install paths (with or without spaces) must not change the fingerprint',
);

// Regression 2026-09-03: path tương đối không drive-letter trước đây không match
// regex path → sót nguyên trong basis. Phải chuẩn hoá như path tuyệt đối.
const relative = { ...base, stack_trace: 'TypeError: boom\n    at run (nova/run.js:10:3)' };
assert.strictEqual(
  serverFingerprint(base),
  serverFingerprint(relative),
  'relative frame paths must normalize the same as absolute ones',
);

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