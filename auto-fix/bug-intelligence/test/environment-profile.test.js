'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EnvironmentProfileStore } = require('../environment-profile');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'env-profile-'));
try {
  const file = path.join(temp, 'envs.json');
  const store = new EnvironmentProfileStore(file);

  const profile = {
    environment_id: 'env-123',
    OS: 'Windows 10',
    'OS build': '19042',
    architecture: 'x64',
    runtime: 'node-v14.17.0',
    'dependency versions': { electron: '12.0.0' },
    locale: 'en-US',
    timezone: 'America/New_York',
    gpu: 'NVIDIA',
    driver: '456.71',
  };

  const stored = store.upsert(profile);
  assert.strictEqual(stored.environment_id, 'env-123');
  assert.strictEqual(stored.OS, 'Windows 10');
  assert.strictEqual(stored.known, true);
  assert.strictEqual(stored.crash_count, 1);

  // Upsert again increments count
  const stored2 = store.upsert({ environment_id: 'env-123', OS: 'Windows 11' });
  assert.strictEqual(stored2.crash_count, 2);
  assert.strictEqual(stored2.OS, 'Windows 11'); // updated

  // Touch with only id
  const touched = store.touch('env-456');
  assert.strictEqual(touched.environment_id, 'env-456');
  assert.strictEqual(touched.known, false);
  assert.strictEqual(touched.crash_count, 1);

  // Get
  const get = store.get('env-123');
  assert.strictEqual(get.environment_id, 'env-123');
  assert.strictEqual(get.crash_count, 2);

  // List and stats
  const list = store.list();
  assert.strictEqual(list.length, 2);
  const stats = store.stats();
  assert.strictEqual(stats.profiles, 2);
  assert.strictEqual(stats.known, 1);
  assert.strictEqual(stats.totalCrashes, 3); // env-123 has 2, env-456 has 1

  // Reject disallowed fields
  const bad = { environment_id: 'bad', secret: 'should-not-store' };
  const storedBad = store.upsert(bad);
  assert.strictEqual(storedBad.secret, undefined);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('environment-profile tests: passed');