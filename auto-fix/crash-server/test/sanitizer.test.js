'use strict';

const assert = require('assert');
const { sanitizeReport } = require('../sanitizer');

const out = sanitizeReport({
  fingerprint: 'abc123',
  message: 'failed with token=supersecret and Bearer abcdef123456',
  api_key: 'topsecret',
  nested: { password: 'hunter2', safe: 1 },
});

assert.strictEqual(out.fingerprint, 'abc123', 'stable field must be preserved');
assert.strictEqual(out.api_key, '[REDACTED]');
assert.strictEqual(out.nested.password, '[REDACTED]');
assert.strictEqual(out.nested.safe, 1);
assert.ok(!JSON.stringify(out).includes('supersecret'));
assert.ok(!JSON.stringify(out).includes('abcdef123456'));
assert.ok(!JSON.stringify(out).includes('hunter2'));

assert.deepStrictEqual(sanitizeReport(null), {}, 'non-object input must degrade to empty object');

console.log('sanitizer tests: passed');