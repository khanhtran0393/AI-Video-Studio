'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  RolloutStore,
  RolloutController,
  ROLLOUT_STAGES,
  DEFAULT_THRESHOLDS,
  evaluateHealth,
} = require('../index');
const { RegressionCaseStore } = require('../../regression-engine/case');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'canary-index-'));
try {
  const store = new RolloutStore(path.join(temp, 'rollout.json'));
  const controller = new RolloutController({ store });

  function metrics(overrides = {}) {
    return {
      sample_size: 1000,
      crash_rate: 0.01,
      error_rate: 0.02,
      startup_failure_rate: 0.01,
      update_failure_rate: 0.01,
      performance_p95_ms: 1000,
      feature_failure_rate: 0.01,
      ...overrides,
    };
  }

  // End-to-end staged rollout: 5% -> 25% -> 50% -> 100% -> complete.
  const baseline = metrics();
  store.start('2.0.0');
  const staged = [];
  for (let i = 0; i < ROLLOUT_STAGES.length - 1; i += 1) {
    const decision = controller.evaluate({ metrics: metrics(), baseline });
    assert.strictEqual(decision.decision, 'promote');
    staged.push(decision.state.percent);
  }
  assert.deepStrictEqual(staged, [25, 50, 100]);

  const final = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(final.decision, 'complete');
  assert.strictEqual(final.state.status, 'completed');

  // Rollback scenario: critical breach -> rollback, then record a permanent
  // regression case (spec section 23 requires the incident to become a
  // reusable regression/reproduction case).
  const rstore = new RolloutStore(path.join(temp, 'rollout2.json'));
  const rctrl = new RolloutController({ store: rstore });
  rstore.start('2.1.0');
  const rolled = rctrl.evaluate({ metrics: metrics({ crash_rate: 0.5 }), baseline });
  assert.strictEqual(rolled.decision, 'rollback');
  assert.strictEqual(rolled.state.status, 'rolled_back');

  const cases = new RegressionCaseStore(path.join(temp, 'regression-cases.json'));
  const failingEvent = { seq: 2, ts: '2026-02-01T00:00:02.000Z', type: 'startup_crash' };
  const sequence = {
    sequence_id: 'seq-rollback-1',
    events: [
      { seq: 1, ts: '2026-02-01T00:00:01.000Z', type: 'start' },
      failingEvent,
    ],
    final_failing_event: failingEvent,
  };
  const incidentCase = cases.create({
    regression_id: 'REG-ROLLBACK-1',
    bug_id: 'BUG-ROLLBACK-1',
    fingerprint: 'fp-rollback-1',
    source_kind: 'rollback-incident',
    source_note: 'canary 2.1.0 rolled back after critical crash-rate breach',
    reproduction: {
      reproduction_id: 'rep-rollback-1',
      expected_fingerprint: 'fp-rollback-1',
      sequence,
    },
    replay_spec: [
      { when: { type: 'start' }, then: { handled: true } },
      { when: { type: 'startup_crash' }, then: { failed: true, fingerprint: 'fp-rollback-1' } },
    ],
  });
  assert.strictEqual(incidentCase.source_kind, 'rollback-incident');
  assert.strictEqual(cases.stats().cases, 1);

  // Health helper remains reachable from the index exports.
  const health = evaluateHealth({ metrics: metrics(), baseline, thresholds: DEFAULT_THRESHOLDS });
  assert.strictEqual(health.status, 'healthy');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('index tests: passed');