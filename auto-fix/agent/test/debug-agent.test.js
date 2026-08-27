'use strict';

const assert = require('assert');
const { runDebugAgent } = require('../debug-agent');
const { loadPolicy } = require('../../policy');

const policy = loadPolicy();

// Helper: minimal crash
function validCrash() {
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
  };
}

// Test 1: successful run with valid input
(function testValidRun() {
  const result = runDebugAgent({
    crash: validCrash(),
    policy,
  });
  assert.strictEqual(result.outcome, 'diagnosis-complete');
  assert.ok(result.bug);
  assert.ok(result.hypotheses);
  assert.ok(result.root_cause);
  assert.ok(result.reasoning);
  assert.ok(result.confidence);
  assert.ok(result.generated_at);
  console.log('testValidRun: PASS');
})();

// Test 2: blocked due to invalid policy (write authority enabled)
(function testBlockedWriteAuthority() {
  const badPolicy = { ...policy, authorities: { ...policy.authorities, writeSource: true } };
  const result = runDebugAgent({
    crash: validCrash(),
    policy: badPolicy,
  });
  assert.strictEqual(result.outcome, 'blocked');
  // The runDebugAgent first validates policy, so with writeSource=true it will be 'invalid-policy'
  // because validatePolicy requires all authorities to be false.
  assert.strictEqual(result.reason, 'invalid-policy');
  assert.ok(result.errors.some(e => e.includes('authority must remain disabled: writeSource')));
  console.log('testBlockedWriteAuthority: PASS');
})();

// Test 3: blocked due to invalid crash
(function testBlockedInvalidCrash() {
  const result = runDebugAgent({
    crash: null,
    policy,
  });
  assert.strictEqual(result.outcome, 'blocked');
  assert.strictEqual(result.reason, 'invalid-bug-case');
  console.log('testBlockedInvalidCrash: PASS');
})();

// Test 4: blocked due to missing required fields
(function testBlockedMissingFields() {
  const result = runDebugAgent({
    crash: { crash_id: 'crash-123' }, // missing fingerprint, error_type, message
    policy,
  });
  assert.strictEqual(result.outcome, 'blocked');
  assert.strictEqual(result.reason, 'invalid-bug-case');
  console.log('testBlockedMissingFields: PASS');
})();

// Test 5: with sourceExcerpts and historyEntries
(function testWithExcerpts() {
  const sourceExcerpts = [{ path: 'app.js', content: 'function main() { return null; }' }];
  const historyEntries = [{ commit: 'abc', message: 'Fix bug in main' }];
  const result = runDebugAgent({
    crash: validCrash(),
    sourceExcerpts,
    historyEntries,
    policy,
  });
  assert.strictEqual(result.outcome, 'diagnosis-complete');
  assert.ok(result.source_search);
  assert.ok(result.history_search);
  console.log('testWithExcerpts: PASS');
})();

// Test 6: with custom options
(function testCustomOptions() {
  const result = runDebugAgent({
    crash: validCrash(),
    policy,
    options: { maxSearchResults: 5 },
  });
  assert.strictEqual(result.outcome, 'diagnosis-complete');
  // The search results should be capped at 5
  assert.ok(result.source_search.matches.length <= 5);
  assert.ok(result.history_search.matches.length <= 5);
  console.log('testCustomOptions: PASS');
})();

// Test 7: when diagnosis has no top hypothesis
(function testNoTopHypothesis() {
  const crash = {
    crash_id: 'crash-456',
    fingerprint: 'efgh5678',
    error_type: 'Unknown',
    message: 'some weird error',
    stack_trace: '',
  };
  const result = runDebugAgent({
    crash,
    policy,
  });
  // Should still produce a report, maybe escalate-insufficient-evidence
  assert.ok(result.outcome === 'escalate-insufficient-evidence' || result.outcome === 'diagnosis-complete');
  console.log('testNoTopHypothesis: PASS');
})();

console.log('DEBUG-AGENT TEST: PASS');