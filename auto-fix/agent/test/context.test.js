'use strict';

const assert = require('assert');
const { buildContext, LIMITS } = require('../context');
const { loadPolicy } = require('../../policy');

const policy = loadPolicy();

// Helper: create a minimal valid crash object.
function validCrash(overrides = {}) {
  return {
    crash_id: 'crash-123',
    fingerprint: 'abcd1234',
    error_type: 'TypeError',
    message: 'Cannot read property x of undefined',
    stack_trace: 'TypeError: ...\n    at main (app.js:10:5)',
    app_version: '1.0.0',
    build_id: 'build-1',
    timestamp: new Date().toISOString(),
    environment_id: 'env-1',
    event_sequence_id: 'seq-1',
    ...overrides,
  };
}

// Test 1: valid context
(function testValidContext() {
  const crash = validCrash();
  const result = buildContext({ crash, policy });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.ok(result.context);
  assert.strictEqual(result.context.schemaVersion, 1);
  assert.strictEqual(result.context.bug.crash_id, 'crash-123');
  assert.strictEqual(result.context.bug.fingerprint, 'abcd1234');
  assert.strictEqual(result.context.bug.error_type, 'TypeError');
  assert.strictEqual(result.context.bug.message, 'Cannot read property x of undefined');
  console.log('testValidContext: PASS');
})();

// Test 2: missing required fields
(function testMissingFields() {
  const crash = { crash_id: 'crash-123' }; // missing fingerprint, error_type, message
  const result = buildContext({ crash, policy });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length >= 1);
  assert.ok(result.errors.some(e => e.includes('missing crash field')));
  console.log('testMissingFields: PASS');
})();

// Test 3: invalid crash (non-object)
(function testInvalidCrash() {
  const result = buildContext({ crash: null, policy });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('crash must be an object'));
  console.log('testInvalidCrash: PASS');
})();

// Test 4: bounded text truncation
(function testBoundedText() {
  const longMsg = 'a'.repeat(5000);
  const crash = validCrash({ message: longMsg });
  const result = buildContext({ crash, policy });
  assert.strictEqual(result.valid, true);
  // message should be truncated to 4096 + "[TRUNCATED]" if over
  const msg = result.context.bug.message;
  assert.ok(msg.length <= 4096 + 12); // 4096 + "[TRUNCATED]"
  console.log('testBoundedText: PASS');
})();

// Test 5: sourceExcerpts and historyEntries limits
(function testLimits() {
  const crash = validCrash();
  const sourceExcerpts = Array.from({ length: 50 }, (_, i) => ({
    path: `file${i}.js`,
    content: `console.log(${i});`,
  }));
  const historyEntries = Array.from({ length: 80 }, (_, i) => ({
    commit: `abc${i}`,
    author: 'test',
    date: '2026-01-01',
    message: `commit ${i}`,
    diff: `diff ${i}`,
  }));
  const result = buildContext({ crash, sourceExcerpts, historyEntries, policy });
  assert.strictEqual(result.valid, true);
  assert.ok(result.context.source.length <= LIMITS.maxSourceExcerpts);
  assert.ok(result.context.history.length <= LIMITS.maxHistoryEntries);
  console.log('testLimits: PASS');
})();

// Test 6: redaction applied
(function testRedaction() {
  const crash = validCrash({
    message: 'password=secret123 token=xyz',
  });
  const result = buildContext({ crash, policy });
  assert.strictEqual(result.valid, true);
  // The redaction should mask sensitive patterns
  const msg = result.context.bug.message;
  assert.ok(!msg.includes('secret123'));
  assert.ok(!msg.includes('xyz'));
  console.log('testRedaction: PASS');
})();

console.log('CONTEXT TEST: PASS');