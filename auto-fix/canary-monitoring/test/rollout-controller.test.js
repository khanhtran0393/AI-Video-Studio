'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RolloutStore } = require('../rollout-store');
const { RolloutController, DECISIONS } = require('../rollout-controller');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'canary-controller-'));
try {
  const audit = [];
  const controller = new RolloutController({
    store: new RolloutStore(path.join(temp, 'rollout.json'), { audit: (ev) => audit.push(ev) }),
    audit: (ev) => audit.push(ev),
  });

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

  // missing store -> blocked
  assert.strictEqual(new RolloutController({ store: null }).evaluate({ metrics: metrics() }).decision, 'blocked');

  // insufficient metrics -> hold; never promote without evidence
  controller.store.start('1.5.0');
  let decision = controller.evaluate({ metrics: { sample_size: 0 }, baseline: metrics() });
  assert.strictEqual(decision.decision, 'hold');
  assert.strictEqual(decision.reason, 'insufficient-metrics');

  // healthy -> promote through every stage -> complete
  const baseline = metrics();
  decision = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(decision.decision, 'promote');
  assert.strictEqual(decision.state.percent, 25);

  decision = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(decision.decision, 'promote');
  assert.strictEqual(decision.state.percent, 50);

  decision = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(decision.decision, 'promote');
  assert.strictEqual(decision.state.percent, 100);

  decision = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(decision.decision, 'complete');
  assert.strictEqual(decision.state.status, 'completed');

  decision = controller.evaluate({ metrics: metrics(), baseline });
  assert.strictEqual(decision.decision, 'blocked');

  // degraded breach -> stop
  const controller2 = new RolloutController({ store: new RolloutStore(path.join(temp, 'rollout2.json')) });
  controller2.store.start('1.6.0');
  const degraded = controller2.evaluate({ metrics: metrics({ performance_p95_ms: 9000 }), baseline });
  assert.strictEqual(degraded.decision, 'stop');
  assert.strictEqual(degraded.state.status, 'stopped');
  assert.strictEqual(degraded.health.status, 'degraded');

  // critical breach -> rollback
  const audit3 = [];
  const controller3 = new RolloutController({
    store: new RolloutStore(path.join(temp, 'rollout3.json'), { audit: (ev) => audit3.push(ev) }),
    audit: (ev) => audit3.push(ev),
  });
  controller3.store.start('1.7.0');
  const critical = controller3.evaluate({ metrics: metrics({ crash_rate: 0.2 }), baseline });
  assert.strictEqual(critical.decision, 'rollback');
  assert.strictEqual(critical.state.status, 'rolled_back');
  assert.strictEqual(critical.health.status, 'critical');

  // after rollback -> blocked
  assert.strictEqual(controller3.evaluate({ metrics: metrics(), baseline }).decision, 'blocked');

  assert.ok(DECISIONS.includes('rollback'));
  assert.ok(audit3.some((ev) => ev.event === 'rollout-rollback'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('rollout-controller tests: passed');