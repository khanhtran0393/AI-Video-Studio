'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { IncidentStore } = require('../incident');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-'));
try {
  const file = path.join(temp, 'incidents.json');
  const store = new IncidentStore(file);

  const incident = {
    incident_id: 'inc-1',
    release_id: 'rel-123',
    reason: 'Health check failed',
    status: 'requested',
    failure_details: { error: 'crash', count: 5 },
  };

  const created = store.create(incident);
  assert.strictEqual(created.incident_id, 'inc-1');
  assert.strictEqual(created.release_id, 'rel-123');
  assert.strictEqual(created.status, 'requested');
  assert.ok(created.failure_details);
  assert.strictEqual(created.failure_details.error, 'crash');

  // duplicate
  assert.throws(() => store.create({ incident_id: 'inc-1', release_id: 'x' }), /already exists/);

  // update
  const updated = store.update('inc-1', {
    status: 'in-progress',
    regression_case_id: 'case-456',
  });
  assert.strictEqual(updated.status, 'in-progress');
  assert.strictEqual(updated.regression_case_id, 'case-456');

  // get
  const retrieved = store.get('inc-1');
  assert.strictEqual(retrieved.incident_id, 'inc-1');
  assert.strictEqual(retrieved.status, 'in-progress');

  // listForRelease
  const list = store.listForRelease('rel-123');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].incident_id, 'inc-1');

  // stats
  const stats = store.stats();
  assert.strictEqual(stats.incidents, 1);
  assert.strictEqual(stats.byStatus['in-progress'], 1);

  // invalid status defaults to 'requested'
  const bad = store.create({ incident_id: 'bad', release_id: 'x', status: 'unknown' });
  assert.strictEqual(bad.status, 'requested');

  console.log('incident tests passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}