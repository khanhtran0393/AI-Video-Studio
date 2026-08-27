'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { buildSigningRequest, verifySignature, buildSignatureMetadata } = require('../signing');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const artifactHash = 'a'.repeat(64);
const version = '1.0.0';
const subject = 'app.exe';

const request = buildSigningRequest({ artifactHash, version, subject });
assert.strictEqual(request.schemaVersion, 1);
assert.strictEqual(request.algorithm, 'sha256');
assert.strictEqual(request.artifact_hash, artifactHash);

const payload = `${subject}\n${version}\n${artifactHash}`;
const signature = crypto.sign('sha256', Buffer.from(payload, 'utf8'), privateKey);
const signatureHex = signature.toString('hex');

assert.ok(verifySignature(request, signatureHex, publicKey));

const wrongSig = signatureHex.slice(0, -2) + '00';
assert.ok(!verifySignature(request, wrongSig, publicKey));

const { publicKey: otherPublic } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
assert.ok(!verifySignature(request, signatureHex, otherPublic));

const metadata = buildSignatureMetadata({ request, signatureHex, publicKeyPem: publicKey });
assert.strictEqual(metadata.algorithm, 'sha256');
assert.strictEqual(metadata.subject, subject);
assert.strictEqual(metadata.artifact_hash, artifactHash);
assert.strictEqual(metadata.signature_hex, signatureHex.toLowerCase());
assert.ok(metadata.public_key_sha256.length === 64);

assert.throws(() => buildSignatureMetadata({ request, signatureHex: 'invalid', publicKeyPem: publicKey }), /verification failed/);

console.log('signing tests: passed');