'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function timingSafeEqualHex(actual, expected) {
  if (!/^[0-9a-f]{64}$/i.test(String(actual)) || !/^[0-9a-f]{64}$/i.test(String(expected))) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function bearerToken(header) {
  const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
  return match ? match[1].trim() : null;
}

function authorize(header, expectedHash) {
  const token = bearerToken(header);
  return Boolean(token && expectedHash && timingSafeEqualHex(sha256(token), expectedHash));
}

function pseudonymizeInstallation(installationId, pepper) {
  if (!pepper || String(pepper).length < 32) throw new Error('DEVICE_ID_PEPPER must contain at least 32 characters');
  return crypto.createHmac('sha256', pepper).update(String(installationId), 'utf8').digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { authorize, bearerToken, pseudonymizeInstallation, randomToken, sha256, timingSafeEqualHex };
