'use strict';

// Section 32 — Abuse protection (Master Spec sections 6, 32, 33). Defense in
// depth above rate limiting: inspects untrusted telemetry for structural
// abuse signals (prototype-pollution keys, excessive depth, oversized key
// counts, code-execution hints) and keeps per-client/IP violation counters so
// repeat offenders can be blocked for a configurable window. Pure analysis —
// nothing found in a payload is ever executed, only reported.

const DANGEROUS_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);
const EXEC_HINTS = /\b(?:eval|exec|spawn|child_process|require\s*\(|process\s*\.\s*\w+\s*\(|new\s+Function\s*\()\b/i;
const MAX_DEPTH = 24;
const MAX_TOTAL_KEYS = 2000;

function measureDepth(value, depth = 0) {
  if (depth > MAX_DEPTH) return depth;
  if (value === null || typeof value !== 'object') return depth;
  let max = depth;
  for (const key of Object.keys(value)) {
    max = Math.max(max, measureDepth(value[key], depth + 1));
  }
  return max;
}

function countKeys(value) {
  if (value === null || typeof value !== 'object') return 0;
  let count = 0;
  for (const key of Object.keys(value)) {
    count += 1 + countKeys(value[key]);
  }
  return count;
}

function findDangerousKeys(value, prefix = '') {
  const found = [];
  if (value === null || typeof value !== 'object') return found;
  for (const key of Object.keys(value)) {
    const current = prefix ? `${prefix}.${key}` : key;
    if (DANGEROUS_KEYS.includes(key)) found.push(current);
    found.push(...findDangerousKeys(value[key], current));
  }
  return found;
}

function findExecHints(value) {
  const hints = [];
  if (typeof value === 'string' && EXEC_HINTS.test(value)) hints.push(value.slice(0, 120));
  else if (Array.isArray(value)) {
    for (const item of value) hints.push(...findExecHints(item));
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) hints.push(...findExecHints(value[key]));
  }
  return hints.slice(0, 8);
}

function inspectReport(report) {
  if (!report || typeof report !== 'object') return { safe: false, findings: ['not-an-object'] };
  const findings = [];

  const dangerous = findDangerousKeys(report);
  if (dangerous.length) findings.push(`prototype-pollution-keys:${dangerous.slice(0, 8).join(',')}`);

  const depth = measureDepth(report);
  if (depth > MAX_DEPTH) findings.push(`excessive-depth:${depth}`);

  const keys = countKeys(report);
  if (keys > MAX_TOTAL_KEYS) findings.push(`too-many-keys:${keys}`);

  const execHints = findExecHints(report);
  if (execHints.length) findings.push(`code-execution-hints:${execHints.slice(0, 3).join(' | ')}`);

  return findings.length ? { safe: false, findings } : { safe: true, findings: [] };
}

class AbuseProtector {
  constructor(options = {}) {
    this.maxViolations = Number.isInteger(options.maxViolations) ? options.maxViolations : 3;
    this.blockWindowMs = Number.isInteger(options.blockWindowMs) ? options.blockWindowMs : 10 * 60 * 1000;
    this.violations = new Map();
    this.blocked = new Map();
  }

  recordViolation(clientId, ip) {
    const key = `${clientId || 'anon'}:${ip || 'unknown'}`;
    const list = this.violations.get(key) || [];
    list.push(Date.now());
    this.violations.set(key, list);
    if (list.length >= this.maxViolations) {
      this.blocked.set(key, Date.now() + this.blockWindowMs);
      return { blocked: true, key };
    }
    return { blocked: false, key, violations: list.length };
  }

  isBlocked(clientId, ip) {
    const key = `${clientId || 'anon'}:${ip || 'unknown'}`;
    const until = this.blocked.get(key);
    if (!until) return false;
    if (Date.now() > until) {
      this.blocked.delete(key);
      this.violations.delete(key);
      return false;
    }
    return true;
  }

  check(report, { clientId, ip }) {
    if (this.isBlocked(clientId, ip)) return { allowed: false, reason: 'blocked-client', findings: [] };
    const inspection = inspectReport(report);
    if (inspection.safe) return { allowed: true, inspection };
    const result = this.recordViolation(clientId, ip);
    return {
      allowed: false,
      reason: result.blocked ? 'abuse-blocked' : 'abuse-detected',
      findings: inspection.findings,
    };
  }
}

module.exports = { AbuseProtector, inspectReport };