'use strict';

const crypto = require('crypto');

// Milestone 10 — signing integration boundary (spec sections 10, 20, 32).
// This module never holds a private key and never signs anything. It only:
//   1. builds a deterministic signing REQUEST (what a separated signing
//      service would sign), and
//   2. VERIFIES a returned signature with a PUBLIC key.
// Private-key custody remains entirely outside the control plane.

const MAX_SUBJECT = 256;
const MAX_ALGORITHM = 64;
const MAX_SIGNATURE_HEX = 4096;
const SUPPORTED_ALGORITHMS = ['sha256'];

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Deterministically serializes the bytes that a signing service must sign.
 * Only the artifact hash, version and subject are included so the signed
 * payload is small, stable, and free of secrets or arbitrary metadata.
 */
function buildSigningRequest({ artifactHash, version, subject }) {
  if (!isString(artifactHash, 128) || !/^[0-9a-f]{64}$/i.test(artifactHash)) {
    throw new Error('artifactHash must be a 64-char hex string');
  }
  if (!isString(version, 64)) throw new Error('version is required (<=64 chars)');
  if (!isString(subject, MAX_SUBJECT)) throw new Error('subject is required (<=256 chars)');

  const payload = `${subject}\n${version}\n${artifactHash.toLowerCase()}`;
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  return {
    schemaVersion: 1,
    algorithm: 'sha256',
    subject,
    version,
    artifact_hash: artifactHash.toLowerCase(),
    digest_sha256: digest,
  };
}

/**
 * Verifies a returned signature against a public key (PEM). Returns true only
 * when the signature is valid for the given request. Any malformed input,
 * unsupported algorithm, missing public key, or verification failure returns
 * false — this is a fail-closed boundary.
 */
function verifySignature(request, signatureHex, publicKeyPem) {
  if (!request || request.schemaVersion !== 1) return false;
  if (!SUPPORTED_ALGORITHMS.includes(request.algorithm)) return false;
  if (!isString(signatureHex, MAX_SIGNATURE_HEX)) return false;
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) return false;

  try {
    const signature = Buffer.from(signatureHex, 'hex');
    const payload = `${request.subject}\n${request.version}\n${request.artifact_hash}`;
    const verifier = crypto.createVerify('sha256');
    verifier.update(payload, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyPem, signature);
  } catch (_) {
    return false;
  }
}

/**
 * Constructs signature metadata to store on a BuildArtifact. The private key
 * is never present; metadata records only what a future updater can use for
 * independent verification (public key fingerprint + subject + algorithm).
 */
function buildSignatureMetadata({ request, signatureHex, publicKeyPem }) {
  if (!verifySignature(request, signatureHex, publicKeyPem)) {
    throw new Error('signature verification failed; metadata cannot be recorded');
  }
  const publicFingerprint = crypto
    .createHash('sha256')
    .update(publicKeyPem, 'utf8')
    .digest('hex');
  return {
    algorithm: request.algorithm,
    subject: request.subject,
    artifact_hash: request.artifact_hash,
    digest_sha256: request.digest_sha256,
    signature_hex: signatureHex.toLowerCase(),
    public_key_sha256: publicFingerprint,
    verified_at: new Date().toISOString(),
  };
}

module.exports = {
  SUPPORTED_ALGORITHMS,
  buildSigningRequest,
  buildSignatureMetadata,
  verifySignature,
};