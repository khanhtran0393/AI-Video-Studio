'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TelemetryStore } = require('../store');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-store-'));
try {
  const store = new TelemetryStore(path.join(temp, 'telemetry.json'), { audit: () => {} });

  const event1 = { type: 'crash', version: '1.0.0', timestamp: new Date().toISOString(), client_id: 'c1', environment_id: 'e1', data: { stack: '...' } };
  const event2 = { type: 'startup_success', version: '1.0.0', timestamp: new Date(Date.now() - 60000).toISOString(), client_id: 'c2', data: { duration_ms: 123 } };
  const event3 = { type: 'startup_failure', version: '1.0.0', timestamp: new Date(Date.now() - 120000).toISOString() };

  store.addEvent(event1);
  store.addEvent(event2);
  store.addEvent(event3);

  assert.strictEqual(store.stats().total, 3);
  assert.strictEqual(store.stats().byType.crash, 1);
  assert.strictEqual(store.stats().byType.startup_success, 1);
  assert.strictEqual(store.stats().byType.startup_failure, 1);

  const all = store.getEvents();
  assert.strictEqual(all.length, 3);

  const crashes = store.getEvents({ type: 'crash' });
  assert.strictEqual(crashes.length, 1);
  assert.strictEqual(crashes[0].type, 'crash');

  const byVersion = store.getEvents({ version: '1.0.0' });
  assert.strictEqual(byVersion.length, 3);

  const byClient = store.getEvents({ client_id: 'c1' });
  assert.strictEqual(byClient.length, 1);

  // prune
  const result = store.prune(0); // keep nothing
  assert.strictEqual(result.removed, 3);
  assert.strictEqual(result.remaining, 0);

  // add more
  store.addEvent(event1);
  assert.strictEqual(store.stats().total, 1);

  // delete by version
  const del = store.deleteEvents({ version: '1.0.0' });
  assert.strictEqual(del.removed, 1);
  assert.strictEqual(del.remaining, 0);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('store tests: passed');