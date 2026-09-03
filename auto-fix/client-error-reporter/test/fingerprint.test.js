'use strict';

const assert = require('assert');
const { fingerprintException, normalizeMessage } = require('../fingerprint');

// Same error yields the same fingerprint.
const a = new TypeError('Cannot read property 0x12 of undefined');
a.stack = 'TypeError: Cannot read property 0x12 of undefined\n    at render (C:\\app\\nova\\render.js:42:7)';
const b = new TypeError('Cannot read property 0x99 of undefined');
b.stack = 'TypeError: Cannot read property 0x99 of undefined\n    at render (C:\\app\\nova\\render.js:42:7)';
assert.strictEqual(fingerprintException(a).fingerprint, fingerprintException(b).fingerprint);
assert.match(fingerprintException(a).fingerprint, /^[0-9a-f]{64}$/, 'fingerprints must retain the full SHA-256 digest');

// Different error types yield different fingerprints.
const c = new RangeError('Invalid array length 5');
c.stack = 'RangeError: Invalid array length 5\n    at run (C:\\app\\nova\\run.js:1:1)';
assert.notStrictEqual(fingerprintException(a).fingerprint, fingerprintException(c).fingerprint);

// Normalization strips volatile tokens.
assert.strictEqual(normalizeMessage('error at 0x1A2B line 99'), 'error at <HEX> line <N>');

// Regression 2026-09-03: cùng lỗi logic trên 2 thư mục cài khác nhau (dev
// checkout vs máy trắng AppData\Local\Programs\...\app.asar) phải ra CÙNG
// fingerprint — đường dẫn cài không được vào basis (đã tái hiện 2 hash
// khác nhau trước khi sửa).
const devPath = new TypeError('Cannot read property x of undefined');
devPath.stack = 'TypeError: Cannot read property x of undefined\n    at render (D:\\work\\AI Video Studio\\nova\\web\\render.js:42:7)';
const cleanPath = new TypeError('Cannot read property x of undefined');
cleanPath.stack = 'TypeError: Cannot read property x of undefined\n    at render (C:\\Users\\Khach\\AppData\\Local\\Programs\\AI Video Studio\\resources\\app.asar\\nova\\web\\render.js:42:7)';
assert.strictEqual(
  fingerprintException(devPath).fingerprint,
  fingerprintException(cleanPath).fingerprint,
  'install path must not change the fingerprint',
);
assert.strictEqual(fingerprintException(devPath).module, 'render.js', 'module must be the basename, not the install path');

// Regression 2026-09-03: dịch line/column giữa các build (42:7 → 99:13) là
// dữ liệu bay — không được đổi fingerprint (mirror crash-server :<N>:<N>).
const lineShift = new TypeError('Cannot read property x of undefined');
lineShift.stack = 'TypeError: Cannot read property x of undefined\n    at render (D:\\work\\AI Video Studio\\nova\\web\\render.js:99:13)';
assert.strictEqual(
  fingerprintException(devPath).fingerprint,
  fingerprintException(lineShift).fingerprint,
  'line/column shifts must not change the fingerprint',
);

// Sau khi bỏ line:column khỏi frame, sự khác nhau thật phải vẫn đến từ tên hàm.
const otherFn = new TypeError('Cannot read property x of undefined');
otherFn.stack = 'TypeError: Cannot read property x of undefined\n    at paint (D:\\work\\AI Video Studio\\nova\\web\\render.js:42:7)';
assert.notStrictEqual(
  fingerprintException(devPath).fingerprint,
  fingerprintException(otherFn).fingerprint,
  'different function names must still produce different fingerprints',
);

// Frame chuẩn hoá không còn số dòng/cột.
assert.strictEqual(
  fingerprintException(devPath).frames[0],
  'render@render.js:<N>:<N>',
);

// Relevant error codes are included in the fingerprint basis.
const stack = 'TypeError: boom\n    at read (read.js:1:1)';
const withCodeA = new TypeError('boom');
withCodeA.code = 'ENOENT';
withCodeA.stack = stack;
const withCodeB = new TypeError('boom');
withCodeB.code = 'EACCES';
withCodeB.stack = stack;
assert.strictEqual(fingerprintException(withCodeA).errorCode, 'ENOENT');
assert.strictEqual(fingerprintException(withCodeB).errorCode, 'EACCES');
assert.notStrictEqual(fingerprintException(withCodeA).fingerprint, fingerprintException(withCodeB).fingerprint);

console.log('fingerprint tests: passed');