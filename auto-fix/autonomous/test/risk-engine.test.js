'use strict';

const assert = require('assert');
const { evaluateRisk, RISK_LEVELS } = require('../risk-engine');

// Test risk evaluation
const testCases = [
  {
    name: 'low risk: small patch, no high-risk areas, high confidence, reproduction success',
    input: {
      patch: { files: ['a.js'], addedLines: 5 },
      affectedAreas: ['logging'],
      aiConfidence: { root_cause_confidence: 0.95, patch_confidence: 0.9, release_confidence: 0.9 },
      reproductionResult: { status: 'reproduced' },
    },
    expectedLevel: 'low',
  },
  {
    name: 'medium risk: medium patch, one high-risk area, moderate confidence',
    input: {
      patch: { files: ['a.js', 'b.js'], addedLines: 60 },
      affectedAreas: ['authentication'],
      aiConfidence: { root_cause_confidence: 0.7, patch_confidence: 0.6, release_confidence: 0.6 },
      reproductionResult: { status: 'reproduced' },
    },
    expectedLevel: 'medium',
  },
  {
    name: 'high risk: large patch, two high-risk areas, low confidence, reproduction failed',
    input: {
      patch: { files: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js', 'f.js'], addedLines: 250 },
      affectedAreas: ['authentication', 'encryption'],
      aiConfidence: { root_cause_confidence: 0.4, patch_confidence: 0.3, release_confidence: 0.3 },
      reproductionResult: { status: 'failed' },
    },
    expectedLevel: 'high',
  },
];

for (const tc of testCases) {
  const result = evaluateRisk(tc.input);
  assert.strictEqual(
    result.level,
    tc.expectedLevel,
    `Expected ${tc.expectedLevel} for "${tc.name}", got ${result.level} (total=${result.total})`
  );
}

console.log('risk-engine tests: passed');