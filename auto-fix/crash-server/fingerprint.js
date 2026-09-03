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

// Chuẩn hoá từng dòng stack:
// - Dòng frame chuẩn "at <fn> (<file>:<line>:<col>)" (hoặc "at <file>:<line>:<col>"):
//   giữ tên hàm + basename file, bỏ đường dẫn và số dòng/cột — đồng bộ quy tắc
//   với client fingerprint (frames dạng "<fn>@<basename>:<N>:<N>").
//   Regex path cũ `[A-Za-z]:[\\/][^\\s'"]+` không match path chứa dấu cách
//   ("D:\\AI Video Studio\\...") → thay một phần, sót đuôi path trong basis làm
//   fingerprint lệch giữa máy cài (tái hiện 2026-09-03: dev path vs
//   AppData\\...\\app.asar path ra 2 hash khác nhau). Path tương đối không có
//   drive-letter cũng bị sót nguyên trước đây.
// - Dòng khác (thông điệp lỗi, dòng rác): giữ thay <PATH>/<N> như cũ.
function normalizeStack(stack) {
  return safeString(stack)
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw
        .replace(/0x[0-9a-f]+/gi, '<HEX>')
        .replace(/\s+/g, ' ')
        .trim();
      const m = line.match(/^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (m) {
        const fn = String(m[1] || '<anonymous>').replace(/[0-9a-f]{8,}/gi, '<HEX>');
        const base = String(m[2])
          .replace(/\\/g, '/')
          .split('/')
          .pop()
          .split('?')[0]
          .toLowerCase();
        return `at ${fn} (${base}:<N>:<N>)`;
      }
      return line
        .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<PATH>')
        .replace(/:\d+:\d+/g, ':<N>:<N>');
    })
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