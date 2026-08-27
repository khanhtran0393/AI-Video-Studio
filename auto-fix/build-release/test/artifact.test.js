'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BuildArtifactStore } = require('../artifact');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-artifact-'));
try {
  const file = path.join(temp, 'artifacts.json');
  const auditEvents = [];
  const store = new BuildArtifactStore(file, { audit: (ev) => auditEvents.push(ev) });

  const input = {
    artifact_id: 'win64-v1',
    version: '1.0.0',
    git_commit: 'a'.repeat(40),
    build_id: 'build-123',
    hash: '0'.repeat(64),
    files: [{ path: 'app.exe', bytes: 123456, sha256: '1'.repeat(64) }],
    download_location: 'https://example.com/app.exe',
  };
  const created = store.create(input);
  assert.strictEqual(created.artifact_id, 'win64-v1');
  assert.strictEqual(created.release_status, 'unsigned');

  assert.throws(() => store.create(input), /already exists/);

  const signed = store.markSigned('win64-v1', { sig: 'abc' });
  assert.strictEqual(signed.release_status, 'signed');

  const released = store.markReleased('win64-v1');
  assert.strictEqual(released.release_status, 'released');
  assert.throws(() => store.markSigned('win64-v1', {}), /released artifact is immutable/);

  const gotten = store.get('win64-v1');
  assert.strictEqual(gotten.artifact_id, 'win64-v1');

  const list = store.listByVersion('1.0.0');
  assert.strictEqual(list.length, 1);

  const stats = store.stats();
  assert.strictEqual(stats.artifacts, 1);
  assert.strictEqual(stats.byStatus.released, 1);

  assert.ok(auditEvents.some(ev => ev.event === 'build-artifact-created'));
  assert.ok(auditEvents.some(ev => ev.event === 'build-artifact-signed'));
  assert.ok(auditEvents.some(ev => ev.event === 'build-artifact-released'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('artifact tests: passed');