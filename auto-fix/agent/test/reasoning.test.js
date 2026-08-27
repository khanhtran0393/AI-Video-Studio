'use strict';

const assert = require('assert');
const { buildReport } = require('../reasoning');
const { EVIDENCE_THRESHOLD } = require('../diagnosis');
const { loadPolicy } = require('../../policy');

const policy = loadPolicy();

// Helper: minimal diagnosis object
function minimalDiagnosis(overrides = {}) {
  return {
    errorType: 'TypeError',
    normalizedMessage: 'Cannot read property x of undefined',
    frames: [{ line: 'at file.js:1:2', function: 'foo', file: 'file.js', lineNumber: 1, column: 2 }],
    hypotheses: [
      { id: 'H1', statement: 'Null/undefined member access', evidence: ['message pattern'], confidence: 0.6 },
    ],
    topHypothesis: { id: 'H1', statement: 'Null/undefined member access', evidence: ['message pattern'], confidence: 0.6 },
    rootCauseConfidence: 0.6,
    primaryFile: 'file.js',
    recommendation: 'diagnose',
    ...overrides,
  };
}

// Helper: minimal context
function minimalContext() {
  return {
    schemaVersion: 1,
    bug: { crash_id: 'crash-1', fingerprint: 'abcd', error_type: 'TypeError', message: 'Cannot read property', stack_trace: '...', app_version: '1.0', build_id: 'b1', timestamp: '2026-01-01', environment_id: 'env', event_sequence_id: 'seq' },
    environment: null,
    eventSequence: null,
    source: [],
    history: [],
  };
}

// Test 1: buildReport with diagnosis-complete
(function testDiagnosisComplete() {
  const diagnosis = minimalDiagnosis();
  const context = minimalContext();
  const patchProposal = { status: 'proposed', risk: 'low', target_file: 'file.js', unified_diff: 'diff', confidence: 0.5, hypothesis_id: 'H1' };
  const report = buildReport({ context, diagnosis, sourceSearch: { matches: [] }, historySearch: { matches: [] }, patchProposal, policy });
  assert.strictEqual(report.outcome, 'diagnosis-complete');
  assert.strictEqual(report.root_cause.confidence, 0.6);
  assert.strictEqual(report.root_cause.status, 'unconfirmed');
  assert.ok(report.reasoning.steps.length >= 5);
  assert.strictEqual(report.patch_proposal, patchProposal);
  console.log('testDiagnosisComplete: PASS');
})();

// Test 2: escalate-high-risk
(function testEscalateHighRisk() {
  const diagnosis = minimalDiagnosis();
  const context = minimalContext();
  const patchProposal = { status: 'escalate-high-risk', risk: 'high', target_file: 'auth.js', unified_diff: 'diff', confidence: 0.3, hypothesis_id: 'H1' };
  const report = buildReport({ context, diagnosis, sourceSearch: { matches: [] }, historySearch: { matches: [] }, patchProposal, policy });
  assert.strictEqual(report.outcome, 'escalate-high-risk');
  assert.ok(report.risk.escalation);
  assert.strictEqual(report.risk.escalation.reason, 'patch targets a high-risk subsystem');
  assert.ok(report.risk.factors.some(f => f.includes('high-risk subsystem')));
  console.log('testEscalateHighRisk: PASS');
})();

// Test 3: escalate-insufficient-evidence
(function testEscalateInsufficientEvidence() {
  const diagnosis = minimalDiagnosis({ rootCauseConfidence: 0.1, topHypothesis: null, hypotheses: [] });
  const context = minimalContext();
  const patchProposal = { status: 'not-proposed', reason: 'no-hypothesis' };
  const report = buildReport({ context, diagnosis, sourceSearch: { matches: [] }, historySearch: { matches: [] }, patchProposal, policy });
  assert.strictEqual(report.outcome, 'escalate-insufficient-evidence');
  assert.ok(report.risk.escalation);
  assert.strictEqual(report.risk.escalation.reason, 'insufficient evidence to confirm a root cause');
  assert.strictEqual(report.risk.escalation.observedConfidence, 0.1);
  console.log('testEscalateInsufficientEvidence: PASS');
})();

// Test 4: diagnosis-complete but no patch proposed
(function testDiagnosisCompleteNoPatch() {
  const diagnosis = minimalDiagnosis();
  const context = minimalContext();
  const patchProposal = { status: 'not-proposed', reason: 'no-localized-target-from-available-evidence' };
  const report = buildReport({ context, diagnosis, sourceSearch: { matches: [] }, historySearch: { matches: [] }, patchProposal, policy });
  assert.strictEqual(report.outcome, 'diagnosis-complete');
  assert.ok(report.risk.factors.some(f => f.includes('no localized patch target')));
  console.log('testDiagnosisCompleteNoPatch: PASS');
})();

// Test 5: confidence block
(function testConfidenceBlock() {
  const diagnosis = minimalDiagnosis({ rootCauseConfidence: 0.7 });
  const context = minimalContext();
  const patchProposal = { confidence: 0.6 };
  const report = buildReport({ context, diagnosis, sourceSearch: { matches: [] }, historySearch: { matches: [] }, patchProposal, policy });
  assert.strictEqual(report.confidence.root_cause, 0.7);
  assert.strictEqual(report.confidence.patch, 0.6);
  assert.strictEqual(report.confidence.reproduction, null);
  assert.strictEqual(report.confidence.release, null);
  console.log('testConfidenceBlock: PASS');
})();

console.log('REASONING TEST: PASS');