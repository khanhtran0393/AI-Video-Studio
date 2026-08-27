'use strict';

const crypto = require('crypto');

/**
 * Static bearer-token authentication. Only SHA-256 hashes of API keys live in
 * configuration; plaintext keys never touch the server's filesystem. Comparison
 * is timing-safe to resist remote timing attacks.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractBearer(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function authenticate(header, clients) {
  const token = extractBearer(header);
  if (!token) return { ok: false, reason: 'missing-token' };
  const hash = hashToken(token);
  const client = (clients || []).find((entry) => entry && timingSafeEqual(entry.keyHash, hash));
  if (!client) return { ok: false, reason: 'invalid-token' };
  return { ok: true, clientId: client.clientId, scopes: Array.isArray(client.scopes) ? client.scopes : [] };
}

function authorize(client, requiredScope) {
  return Boolean(client && Array.isArray(client.scopes) && client.scopes.includes(requiredScope));
}

module.exports = { hashToken, authenticate, authorize, extractBearer, timingSafeEqual };