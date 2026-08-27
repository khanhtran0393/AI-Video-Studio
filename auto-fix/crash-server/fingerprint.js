'use strict';

const crypto = require('crypto');

// Normalize volatile tokens so identical failures collapse to one fingerprint.
// Mirrors the client fingerprint normalization so server and client agree.
function normalizeMessage(message) {
  return String(message || '')
    .replace(/0x[0-9a-f]+/gi, '<HEX>')
    .replace(/\b\d+\b/g, '<N>')
    .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<PATH>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

function normalizeStack(stack) {
  return String(stack || '')
    .split(/\r?\n/)
    .map((line) => line
      .replace(/0x[0-9a-f]+/gi, '<HEX>')
      .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<PATH>')
      .replace(/:\d+:\d+/g, ':<N>:<N>')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .slice(0, 64)
    .join('\n');
}

/**
 * Server-side canonical fingerprint computed from stable technical fields.
 * Stored alongside the client fingerprint for reconciliation in Milestone 4.
 */
function serverFingerprint(report) {
  const basis = [
    String(report.error_type || ''),
    normalizeMessage(report.message),
    normalizeStack(report.stack_trace),
  ].join('\n');
  return crypto.createHash('sha256').update(basis, 'utf8').digest('hex').slice(0, 32);
}

function validClientFingerprint(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{16,64}$/.test(value);
}

/**
 * Dedup key resolution: trust a well-formed client fingerprint when present,
 * otherwise fall back to the server-computed fingerprint.
 */
function dedupKeyFor(report) {
  return validClientFingerprint(report.fingerprint)
    ? String(report.fingerprint).toLowerCase()
    : serverFingerprint(report);
}

module.exports = { serverFingerprint, dedupKeyFor, validClientFingerprint, normalizeMessage, normalizeStack };