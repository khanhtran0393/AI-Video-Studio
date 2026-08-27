'use strict';

const crypto = require('crypto');
const fs = require('fs');

// Milestone 11 — artifact hash and signature verification (spec sections 13,
// 25). Built only on node:crypto. The detached Ed25519 signature covers the
// string `${version}:${sha256}` so a valid signature is bound to both the
// version and the exact artifact bytes. Verification is fail-closed.

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function signaturePayload(version, sha256) {
  return `${version}:${sha256}`;
}

function verifySignature({ version, sha256, algorithm, publicKeyPem, signature }) {
  if (algorithm !== 'ed25519') throw new Error(`unsupported signature algorithm: ${algorithm}`);
  const payload = Buffer.from(signaturePayload(version, sha256), 'utf8');
  const signatureBuffer = Buffer.from(signature, 'base64');
  return crypto.verify(null, payload, publicKeyPem, signatureBuffer);
}

function verifyArtifactHash(file, expectedSha256, expectedBytes) {
  const actualSha256 = sha256File(file);
  if (actualSha256 !== expectedSha256) {
    return { ok: false, reason: 'sha256-mismatch', actualSha256, expectedSha256 };
  }
  if (expectedBytes !== undefined) {
    const actualBytes = fs.statSync(file).size;
    if (actualBytes !== expectedBytes) {
      return { ok: false, reason: 'size-mismatch', actualBytes, expectedBytes };
    }
  }
  return { ok: true, sha256: actualSha256 };
}

module.exports = { sha256File, verifySignature, verifyArtifactHash, signaturePayload };