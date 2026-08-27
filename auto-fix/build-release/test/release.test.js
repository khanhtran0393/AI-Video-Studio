'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ReleaseStore } = require('../release');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-release-'));
try {
  const file = path.join(temp, 'releases.json');
  const auditEvents = [];
  const store = new ReleaseStore(file, { audit: (ev) => auditEvents.push(ev) });

  const input = {
    release_id: 'release-1',
    version: '1.0.0',
    artifact_id: 'win64-v1',
    rollout_state: 'canary',
    canary_percentage: 10,
    reason: 'initial canary',
  };
  const created = store.create(input);
  assert.strictEqual(created.release_id, 'release-1');
  assert.strictEqual(created.rollout_state, 'canary');
  assert.strictEqual(created.canary_percentage, 10);
  assert.strictEqual(created.history.length, 1);

  assert.throws(() => store.create(input), /already exists/);

  const updated = store.setRollout('release-1', { rollout_state: 'stable', canary_percentage: 100, reason: 'full rollout' });
  assert.strictEqual(updated.rollout_state, 'stable');
  assert.strictEqual(updated.canary_percentage, 100);
  assert.strictEqual(updated.history.length, 2);

  const health = store.recordHealth('release-1', { errorRate: 0.01, latency: 120 });
  assert.deepStrictEqual(health.health_metrics, { errorRate: 0.01, latency: 120 });
  assert.strictEqual(health.history.length, 3);

  const rollback = store.requestRollback('release-1', 'high error rate');
  assert.strictEqual(rollback.rollout_state, 'rolled-back');
  assert.strictEqual(rollback.rollback_state, 'requested');
  assert.strictEqual(rollback.history.length, 4);

  const completed = store.completeRollback('release-1');
  assert.strictEqual(completed.rollback_state, 'completed');
  assert.strictEqual(completed.history.length, 5);

  const gotten = store.get('release-1');
  assert.strictEqual(gotten.release_id, 'release-1');

  const list = store.listByVersion('1.0.0');
  assert.strictEqual(list.length, 1);

  const stats = store.stats();
  assert.strictEqual(stats.releases, 1);
  assert.strictEqual(stats.byState['rolled-back'], 1);

  assert.ok(auditEvents.some(ev => ev.event === 'release-created'));
  assert.ok(auditEvents.some(ev => ev.event === 'release-rollout-changed'));
  assert.ok(auditEvents.some(ev => ev.event === 'release-health-recorded'));
  assert.ok(auditEvents.some(ev => ev.event === 'release-rollback-requested'));
  assert.ok(auditEvents.some(ev => ev.event === 'release-rollback-completed'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('release tests: passed');