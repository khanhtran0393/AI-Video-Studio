'use strict';
const assert = require('assert');
const { buildReleaseMetadata } = require('../metadata');

const artifact = {
  artifact_id: 'win64-v1',
  version: '1.0.0',
  hash: '0'.repeat(64),
  files: [{ path: 'app.exe', bytes: 123456, sha256: '1'.repeat(64) }],
  signature_metadata: {
    algorithm: 'sha256',
    subject: 'app.exe',
    artifact_hash: '0'.repeat(64),
    public_key_sha256: 'f'.repeat(64),
  },
};
const release = {
  release_id: 'release-1',
  artifact_id: 'win64-v1',
  rollout_state: 'stable',
  canary_percentage: 100,
};
const result = buildReleaseMetadata({ artifact, release, notes: 'test notes' });
assert.ok(result.metadata);
assert.strictEqual(result.errors.length, 0);
assert.strictEqual(result.metadata.schemaVersion, 1);
assert.strictEqual(result.metadata.release_id, 'release-1');
assert.strictEqual(result.metadata.version, '1.0.0');
assert.strictEqual(result.metadata.artifact_id, 'win64-v1');
assert.strictEqual(result.metadata.rollout_state, 'stable');
assert.strictEqual(result.metadata.canary_percentage, 100);
assert.strictEqual(result.metadata.files.length, 1);
assert.ok(result.metadata.signature);
assert.strictEqual(result.metadata.notes, 'test notes');
assert.ok(result.metadata.release_metadata_sha256.length === 64);

const bad = buildReleaseMetadata({ release });
assert.strictEqual(bad.metadata, null);
assert.ok(bad.errors.includes('artifact is required'));

const mismatched = buildReleaseMetadata({ artifact: { ...artifact, artifact_id: 'win64-v2' }, release });
assert.ok(mismatched.errors.some(e => e.includes('does not match')));

console.log('metadata tests: passed');