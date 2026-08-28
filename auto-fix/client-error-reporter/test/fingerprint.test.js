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