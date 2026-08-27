'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SnapshotStore, fileNameFor } = require('../snapshots');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-snapshots-'));
try {
  const store = new SnapshotStore(temp);

  const captured = store.capture('before-run', { profile: 'env-1', app_state: 'idle', password: 'hunter2' });
  assert.ok(fs.existsSync(captured.file));

  const raw = JSON.parse(fs.readFileSync(captured.file, 'utf8'));
  assert.ok(!JSON.stringify(raw).includes('hunter2'), 'secret values must not be persisted');
  assert.strictEqual(raw.state.password, '[REDACTED]');

  const restored = store.restore('before-run');
  assert.strictEqual(restored.restored, true);
  assert.strictEqual(restored.state.app_state, 'idle');

  const file = fileNameFor(temp, 'before-run');
  const tampered = JSON.parse(fs.readFileSync(file, 'utf8'));
  tampered.state.app_state = 'corrupted';
  fs.writeFileSync(file, JSON.stringify(tampered, null, 2), 'utf8');
  const badRestore = store.restore('before-run');
  assert.strictEqual(badRestore.restored, false);
  assert.strictEqual(badRestore.reason, 'integrity-mismatch');

  const missing = store.restore('nope');
  assert.strictEqual(missing.restored, false);
  assert.strictEqual(missing.reason, 'snapshot-not-found');

  assert.deepStrictEqual(store.list(), ['before-run']);

  assert.throws(() => fileNameFor(temp, '../escape'), /snapshot name/);
  assert.throws(() => store.restore('../escape'), /snapshot name/);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('snapshots tests: passed');