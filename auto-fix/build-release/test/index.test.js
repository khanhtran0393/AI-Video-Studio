'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { BuildRelease } = require('../index');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-release-index-'));
try {
  const auditEvents = [];
  const baseDir = temp;
  const br = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: false, sign: false, release: false, rollout: false, rollback: false },
  });

  const desc = br.describePackaging();
  assert.ok(desc.descriptor);

  const denied = br.registerArtifact({ artifact_id: 'test' });
  assert.strictEqual(denied.allowed, false);
  assert.strictEqual(denied.authority, 'build');
  assert.strictEqual(denied.reason, 'deny-by-default');

  const brBuild = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: true, sign: false, release: false, rollout: false, rollback: false },
  });
  const artifactInput = {
    artifact_id: 'win64-v1',
    version: '1.0.0',
    hash: '0'.repeat(64),
    files: [{ path: 'app.exe', bytes: 123, sha256: '1'.repeat(64) }],
  };
  const reg = brBuild.registerArtifact(artifactInput);
  assert.strictEqual(reg.allowed, true);
  assert.strictEqual(reg.artifact.artifact_id, 'win64-v1');

  const signDenied = brBuild.integrateSignature({ artifactId: 'win64-v1', subject: 'app.exe', signatureHex: '00', publicKeyPem: 'invalid' });
  assert.strictEqual(signDenied.allowed, false);
  assert.strictEqual(signDenied.authority, 'sign');

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const payload = `app.exe\n1.0.0\n${'0'.repeat(64)}`;
  const signature = crypto.sign('sha256', Buffer.from(payload, 'utf8'), privateKey);
  const signatureHex = signature.toString('hex');

  const brSign = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: true, sign: true, release: false, rollout: false, rollback: false },
    artifacts: brBuild.artifacts,
  });
  const signResult = brSign.integrateSignature({
    artifactId: 'win64-v1',
    subject: 'app.exe',
    signatureHex,
    publicKeyPem: publicKey,
  });
  assert.strictEqual(signResult.allowed, true);
  assert.strictEqual(signResult.artifact.release_status, 'signed');

  const releaseDenied = brSign.createRelease({ release_id: 'release-1', version: '1.0.0', artifact_id: 'win64-v1' });
  assert.strictEqual(releaseDenied.allowed, false);
  assert.strictEqual(releaseDenied.authority, 'release');

  const brRel = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: true, sign: true, release: true, rollout: false, rollback: false },
    artifacts: brBuild.artifacts,
    releases: new (require('../release').ReleaseStore)(path.join(baseDir, 'releases.json'), { audit: (ev) => auditEvents.push(ev) }),
  });
  const relResult = brRel.createRelease({ release_id: 'release-1', version: '1.0.0', artifact_id: 'win64-v1' });
  assert.strictEqual(relResult.allowed, true);
  assert.strictEqual(relResult.release.release_id, 'release-1');

  const rolloutDenied = brRel.setRollout('release-1', { rollout_state: 'stable' });
  assert.strictEqual(rolloutDenied.allowed, false);
  assert.strictEqual(rolloutDenied.authority, 'rollout');

  const brRollout = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: true, sign: true, release: true, rollout: true, rollback: false },
    artifacts: brBuild.artifacts,
    releases: brRel.releases,
  });
  const rolloutResult = brRollout.setRollout('release-1', { rollout_state: 'stable', canary_percentage: 100 });
  assert.strictEqual(rolloutResult.allowed, true);
  assert.strictEqual(rolloutResult.release.rollout_state, 'stable');

  const rollbackDenied = brRollout.rollback('release-1', 'bad');
  assert.strictEqual(rollbackDenied.allowed, false);
  assert.strictEqual(rollbackDenied.authority, 'rollback');

  const brRollback = new BuildRelease({
    baseDir,
    audit: (ev) => auditEvents.push(ev),
    authorities: { build: true, sign: true, release: true, rollout: true, rollback: true },
    artifacts: brBuild.artifacts,
    releases: brRel.releases,
  });
  const rollbackResult = brRollback.rollback('release-1', 'high error rate');
  assert.strictEqual(rollbackResult.allowed, true);
  assert.strictEqual(rollbackResult.release.rollout_state, 'rolled-back');

  const meta = brRollback.buildMetadata('win64-v1', 'release-1');
  assert.ok(meta.metadata);
  assert.strictEqual(meta.metadata.release_id, 'release-1');

  const stats = brRollback.stats();
  assert.strictEqual(stats.artifacts.artifacts, 1);
  assert.strictEqual(stats.releases.releases, 1);

  assert.ok(auditEvents.some(ev => ev.event === 'build-release-artifact-registered'));
  assert.ok(auditEvents.some(ev => ev.event === 'build-release-signature-integrated'));
  assert.ok(auditEvents.some(ev => ev.event === 'build-release-release-created'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('index tests: passed');