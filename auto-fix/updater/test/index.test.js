'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { UpdaterEngine } = require('../index');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-engine-'));
try {
  const artifactPath = path.join(temp, 'artifact.bin');
  fs.writeFileSync(artifactPath, 'new release bytes');
  const sha256 = crypto.createHash('sha256').update('new release bytes').digest('hex');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const signature = crypto.sign(null, Buffer.from(`1.0.1:${sha256}`, 'utf8'), privateKey).toString('base64');

  const metadata = {
    version: '1.0.1',
    channel: 'stable',
    artifact: {
      filename: 'app.exe',
      sha256,
      bytes: Buffer.byteLength('new release bytes'),
      url: 'https://example.com/app.exe',
    },
    signature: { algorithm: 'ed25519', publicKeyPem, signature },
  };

  const audits = [];
  const engine = new UpdaterEngine({
    baseDir: temp,
    installRoot: path.join(temp, 'install'),
    audit: (ev) => audits.push(ev),
  });

  // Version check.
  const decision = engine.checkForUpdate(metadata, '1.0.0');
  assert.strictEqual(decision.status, 'OK');
  assert.strictEqual(decision.updateAvailable, true);
  assert.strictEqual(engine.checkForUpdate(metadata, '1.0.1').updateAvailable, false);
  assert.strictEqual(engine.checkForUpdate(metadata, '2.0.0').updateAvailable, false);

  // Blocked on invalid metadata.
  const blocked = engine.checkForUpdate({ version: 'bad' }, '1.0.0');
  assert.strictEqual(blocked.status, 'BLOCKED');

  // Happy path: PASS.
  const passResult = engine.runUpdate({
    metadata,
    currentVersion: '1.0.0',
    artifactPath,
    healthProbes: [
      { id: 'startup', passed: true, critical: true },
      { id: 'window', passed: true, critical: true },
    ],
    attemptId: 'UPD-1',
  });
  assert.strictEqual(passResult.status, 'PASS');
  assert.strictEqual(passResult.phase, 'health-check');

  // History records one PASS attempt.
  assert.strictEqual(engine.stats().history.attempts, 1);
  assert.strictEqual(engine.stats().history.lastAttempt.status, 'PASS');

  // Health-failure path: ROLLED-BACK.
  const rollbackResult = engine.runUpdate({
    metadata,
    currentVersion: '1.0.0',
    artifactPath,
    healthProbes: [{ id: 'startup', passed: false, critical: true, error: 'crashed' }],
    attemptId: 'UPD-2',
  });
  assert.strictEqual(rollbackResult.status, 'ROLLED-BACK');
  assert.strictEqual(rollbackResult.phase, 'health-check');
  assert.match(rollbackResult.reason, /startup/);

  // History now has attempts + an incident.
  assert.strictEqual(engine.stats().history.attempts, 2);
  assert.strictEqual(engine.stats().history.incidents, 1);
  assert.strictEqual(engine.stats().history.lastAttempt.status, 'ROLLED-BACK');

  // Signature failure path: FAIL with no install.
  const tampered = { ...metadata, signature: { ...metadata.signature, signature: 'AAAA' } };
  const sigResult = engine.runUpdate({
    metadata: tampered,
    currentVersion: '1.0.0',
    artifactPath,
    healthProbes: [{ id: 'startup', passed: true, critical: true }],
    attemptId: 'UPD-3',
  });
  assert.strictEqual(sigResult.status, 'FAIL');
  assert.strictEqual(sigResult.phase, 'signature-verification');

  // Hash failure path.
  const wrongHash = { ...metadata, artifact: { ...metadata.artifact, sha256: 'f'.repeat(64) } };
  const hashResult = engine.runUpdate({
    metadata: wrongHash,
    currentVersion: '1.0.0',
    artifactPath,
    healthProbes: [{ id: 'startup', passed: true, critical: true }],
    attemptId: 'UPD-4',
  });
  assert.strictEqual(hashResult.status, 'FAIL');
  assert.strictEqual(hashResult.phase, 'hash-verification');

  // Not-newer path records a BLOCKED attempt without install.
  const sameVersion = engine.runUpdate({
    metadata,
    currentVersion: '1.0.1',
    artifactPath,
    healthProbes: [{ id: 'startup', passed: true, critical: true }],
    attemptId: 'UPD-5',
  });
  assert.strictEqual(sameVersion.status, 'OK');
  assert.strictEqual(sameVersion.phase, 'version-check');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('index tests: passed');