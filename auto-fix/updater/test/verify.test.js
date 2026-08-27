'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sha256File, verifySignature, verifyArtifactHash, signaturePayload } = require('../verify');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-verify-'));
try {
  const file = path.join(temp, 'artifact.bin');
  fs.writeFileSync(file, 'artifact bytes');

  const expectedSha256 = crypto.createHash('sha256').update('artifact bytes').digest('hex');
  assert.strictEqual(sha256File(file), expectedSha256);

  const hashOk = verifyArtifactHash(file, expectedSha256, Buffer.byteLength('artifact bytes'));
  assert.strictEqual(hashOk.ok, true);
  assert.strictEqual(hashOk.sha256, expectedSha256);

  const hashBad = verifyArtifactHash(file, 'b'.repeat(64), undefined);
  assert.strictEqual(hashBad.ok, false);
  assert.strictEqual(hashBad.reason, 'sha256-mismatch');

  const sizeBad = verifyArtifactHash(file, expectedSha256, 999);
  assert.strictEqual(sizeBad.ok, false);
  assert.strictEqual(sizeBad.reason, 'size-mismatch');

  // Ed25519 signature round-trip.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const payload = Buffer.from(signaturePayload('1.0.1', expectedSha256), 'utf8');
  const signature = crypto.sign(null, payload, privateKey).toString('base64');

  assert.strictEqual(
    verifySignature({
      version: '1.0.1',
      sha256: expectedSha256,
      algorithm: 'ed25519',
      publicKeyPem,
      signature,
    }),
    true,
  );

  // Tampered version must fail.
  assert.strictEqual(
    verifySignature({
      version: '1.0.2',
      sha256: expectedSha256,
      algorithm: 'ed25519',
      publicKeyPem,
      signature,
    }),
    false,
  );

  // Unsupported algorithm must throw.
  assert.throws(
    () => verifySignature({ version: '1.0.1', sha256: expectedSha256, algorithm: 'rsa', publicKeyPem, signature }),
    /unsupported signature algorithm/,
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('verify tests: passed');