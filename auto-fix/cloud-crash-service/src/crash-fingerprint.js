'use strict';

const crypto = require('crypto');

// Coerce untrusted field values to a string without ever invoking a hostile
// object's toString (which can throw or run code — spec section 32 treats all
// telemetry as untrusted). Only primitives are stringified; objects, arrays,
// functions and symbols collapse to ''.
function safeString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

// Normalize volatile tokens so identical failures collapse to one fingerprint.
// Mirrors the client fingerprint normalization so server and client agree.
function normalizeMessage(message) {
  return safeString(message)
    .replace(/0x[0-9a-f]+/gi, '<HEX>')
    .replace(/\b\d+\b/g, '<N>')
    .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<PATH>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

function normalizeStack(stack) {
  return safeString(stack)
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

function normalizeErrorCode(value) {
  if (value === null || value === undefined || value === '') return '';
  return safeString(value).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
}

function extractModule(report) {
  if (report && typeof report.module === 'string') {
    const module = String(report.module).trim().replace(/[\\/]/g, '/').replace(/^.*\//, '').replace(/\?.*$/, '');
    if (module) return module.toLowerCase();
  }
  const lines = safeString(report && report.stack_trace).split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (match && match[2]) {
      return String(match[2])
        .replace(/^[A-Za-z]:[\\/]/, '')
        .replace(/[\\/]/g, '/')
        .split('/')
        .pop()
        .split('?')[0]
        .toLowerCase();
    }
  }
  return '';
}

/**
 * Server-side canonical fingerprint computed from stable technical fields.
 * Stored alongside the client fingerprint for reconciliation in Milestone 4.
 */
function serverFingerprint(report) {
  const safe = report && typeof report === 'object' ? report : {};
  const basis = [
    safeString(safe.error_type),
    normalizeErrorCode(safe.error_code),
    normalizeMessage(safe.message),
    normalizeStack(safe.stack_trace),
    extractModule(safe),
  ].join('\n');
  return crypto.createHash('sha256').update(basis, 'utf8').digest('hex');
}

function validClientFingerprint(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{16,64}$/.test(value);
}

/**
 * Dedup key resolution: trust a well-formed client fingerprint when present,
 * otherwise fall back to the server-computed fingerprint.
 */
function dedupKeyFor(report) {
  const client = report && typeof report === 'object' ? report.fingerprint : undefined;
  return validClientFingerprint(client)
    ? String(client).toLowerCase()
    : serverFingerprint(report);
}

module.exports = { serverFingerprint, dedupKeyFor, validClientFingerprint, normalizeMessage, normalizeStack, normalizeErrorCode, extractModule, safeString };