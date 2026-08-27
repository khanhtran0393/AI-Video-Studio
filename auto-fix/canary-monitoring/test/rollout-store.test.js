'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RolloutStore, ROLLOUT_STATUSES } = require('../rollout-store');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'canary-store-'));
try {
  const audit = [];
  const store = new RolloutStore(path.join(temp, 'rollout.json'), { audit: (ev) => audit.push(ev) });

  let state = store.current();
  assert.strictEqual(state.status, 'idle');
  assert.strictEqual(state.percent, 0);

  state = store.start('1.2.0');
  assert.strictEqual(state.status, 'active');
  assert.strictEqual(state.percent, 5);
  assert.strictEqual(state.release.version, '1.2.0');
  assert.strictEqual(state.history.length, 1);

  assert.throws(() => store.start('1.2.1'), /already in progress/);

  state = store.promoteToStage(1);
  assert.strictEqual(state.percent, 25);
  assert.strictEqual(state.history[state.history.length - 1].event, 'promoted');

  // sequential promotion is enforced
  assert.throws(() => store.promoteToStage(3), /sequentially/);

  state = store.hold({ reason: 'manual review' });
  assert.strictEqual(state.status, 'held');
  state = store.promoteToStage(2);
  assert.strictEqual(state.status, 'active');
  assert.strictEqual(state.percent, 50);

  state = store.stop({ reason: 'threshold breach', breaches: [{ metric: 'crash_rate' }] });
  assert.strictEqual(state.status, 'stopped');
  assert.throws(() => store.promoteToStage(3), /cannot promote/);

  // full promotion then completion
  const store2 = new RolloutStore(path.join(temp, 'rollout2.json'));
  store2.start('1.3.0');
  store2.promoteToStage(1);
  store2.promoteToStage(2);
  store2.promoteToStage(3);
  const completed = store2.complete();
  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.percent, 100);

  // rollback and idempotence guard
  const store3 = new RolloutStore(path.join(temp, 'rollout3.json'));
  store3.start('1.4.0');
  const rolled = store3.rollback({ reason: 'critical crash', breaches: [{ metric: 'crash_rate', severity: 'critical' }] });
  assert.strictEqual(rolled.status, 'rolled_back');
  assert.throws(() => store3.rollback({}), /already rolled back/);

  assert.ok(ROLLOUT_STATUSES.includes('rolled_back'));
  assert.ok(audit.some((ev) => ev.event === 'rollout-started'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('rollout-store tests: passed');