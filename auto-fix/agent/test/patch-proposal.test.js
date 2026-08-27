'use strict';

const assert = require('assert');
const { proposePatch, riskLevel } = require('../patch-proposal');
const { loadPolicy } = require('../../policy');

const policy = loadPolicy();

// Test riskLevel
(function testRiskLevel() {
  assert.strictEqual(riskLevel('src/auth/login.js', policy), 'high');
  assert.strictEqual(riskLevel('src/encryption/crypto.js', policy), 'high');
  assert.strictEqual(riskLevel('src/utils/helpers.js', policy), 'low');
  // Subsystem patterns (sensitive names)
  assert.strictEqual(riskLevel('src/authentication.js', policy), 'high');
  assert.strictEqual(riskLevel('src/token.js', policy), 'high');
  // The pattern /main(\\.|$)/i will match 'src/main.js' as high risk because 'main' is followed by '.'
  assert.strictEqual(riskLevel('src/main.js', policy), 'high');
  console.log('testRiskLevel: PASS');
})();

// Test proposePatch with no hypothesis
(function testNoHypothesis() {
  const diagnosis = { topHypothesis: null };
  const result = proposePatch(diagnosis, { policy });
  assert.strictEqual(result.status, 'not-proposed');
  assert.strictEqual(result.reason, 'no-hypothesis');
  assert.strictEqual(result.unified_diff, null);
  console.log('testNoHypothesis: PASS');
})();

// Test proposePatch with low risk
(function testLowRisk() {
  const diagnosis = {
    topHypothesis: { id: 'H1', statement: 'Fix null check', confidence: 0.8 },
    primaryFile: 'src/utils/helpers.js',
  };
  const result = proposePatch(diagnosis, { policy });
  assert.strictEqual(result.status, 'proposed');
  assert.strictEqual(result.risk, 'low');
  assert.ok(result.unified_diff.includes('src/utils/helpers.js'));
  assert.ok(result.confidence >= 0.6 && result.confidence <= 0.8);
  assert.strictEqual(result.hypothesis_id, 'H1');
  console.log('testLowRisk: PASS');
})();

// Test proposePatch with high risk
(function testHighRisk() {
  const diagnosis = {
    topHypothesis: { id: 'H2', statement: 'Fix auth', confidence: 0.9 },
    primaryFile: 'src/auth/login.js',
  };
  const result = proposePatch(diagnosis, { policy });
  assert.strictEqual(result.status, 'escalate-high-risk');
  assert.strictEqual(result.risk, 'high');
  assert.ok(result.unified_diff.includes('src/auth/login.js'));
  // Confidence should be reduced by high risk penalty
  assert.ok(result.confidence <= 0.7);
  console.log('testHighRisk: PASS');
})();

// Test proposePatch with targetFile option
(function testTargetFileOption() {
  const diagnosis = {
    topHypothesis: { id: 'H3', statement: 'Fix bug', confidence: 0.7 },
    primaryFile: null,
  };
  const result = proposePatch(diagnosis, { policy, targetFile: 'src/main.js' });
  assert.strictEqual(result.target_file, 'src/main.js');
  assert.ok(result.unified_diff.includes('src/main.js'));
  console.log('testTargetFileOption: PASS');
})();

// Test proposePatch with policy highRiskAreas
(function testCustomHighRisk() {
  const customPolicy = { ...policy, highRiskAreas: ['custom-sensitive'] };
  const diagnosis = {
    topHypothesis: { id: 'H4', statement: 'Fix bug', confidence: 0.8 },
    primaryFile: 'src/custom-sensitive/file.js',
  };
  const result = proposePatch(diagnosis, { policy: customPolicy });
  assert.strictEqual(result.risk, 'high');
  console.log('testCustomHighRisk: PASS');
})();

console.log('PATCH-PROPOSAL TEST: PASS');