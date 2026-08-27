'use strict';

const { JsonStore, isString } = require('./store');

const STATUSES = ['draft', 'patch-applied', 'tests-passed', 'verified', 'rejected', 'released'];
const MAX_ID = 128;
const CONFIDENCE_KEYS = ['root_cause_confidence', 'reproduction_confidence', 'patch_confidence', 'release_confidence'];

function emptyData() {
  return { schemaVersion: 1, attempts: {} };
}

function normalizeScore(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a number in [0,1]`);
  }
  return value;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('ai_confidence must be an object');
  const output = {};
  for (const key of CONFIDENCE_KEYS) {
    const entry = value[key];
    if (entry !== null && entry !== undefined && (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1)) {
      throw new Error(`${key} must be a number in [0,1] or null`);
    }
    output[key] = entry === undefined ? null : entry;
  }
  return output;
}

class RepairAttemptStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  create(attempt, now = new Date().toISOString()) {
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) throw new Error('attempt must be an object');
    if (!isString(attempt.attempt_id, MAX_ID)) throw new Error('attempt_id is required (<=128 chars)');
    if (!isString(attempt.bug_id, MAX_ID)) throw new Error('bug_id is required (<=128 chars)');
    const status = attempt.status || 'draft';
    if (!STATUSES.includes(status)) throw new Error(`unknown attempt status: ${status}`);
    const db = this.read();
    if (db.attempts[attempt.attempt_id]) throw new Error(`attempt already exists: ${attempt.attempt_id}`);

    const entry = {
      attempt_id: attempt.attempt_id,
      bug_id: attempt.bug_id,
      branch: typeof attempt.branch === 'string' ? attempt.branch.slice(0, 256) : null,
      patch: attempt.patch && typeof attempt.patch === 'object' ? JSON.parse(JSON.stringify(attempt.patch)) : null,
      tests: attempt.tests && typeof attempt.tests === 'object' ? JSON.parse(JSON.stringify(attempt.tests)) : null,
      reproduction_result: attempt.reproduction_result && typeof attempt.reproduction_result === 'object'
        ? JSON.parse(JSON.stringify(attempt.reproduction_result))
        : null,
      regression_result: attempt.regression_result && typeof attempt.regression_result === 'object'
        ? JSON.parse(JSON.stringify(attempt.regression_result))
        : null,
      build: attempt.build && typeof attempt.build === 'object' ? JSON.parse(JSON.stringify(attempt.build)) : null,
      risk_score: normalizeScore(attempt.risk_score, 'risk_score'),
      ai_confidence: normalizeConfidence(attempt.ai_confidence),
      status,
      created_at: now,
      updated_at: now,
    };
    db.attempts[entry.attempt_id] = entry;
    this.write(db);
    this.auditEvent('repair-attempt-created', { attempt_id: entry.attempt_id, bug_id: entry.bug_id, status });
    return JSON.parse(JSON.stringify(entry));
  }

  update(attemptId, patch, now = new Date().toISOString()) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('patch must be an object');
    const db = this.read();
    const entry = db.attempts[attemptId];
    if (!entry) throw new Error('attempt not found');

    for (const key of ['branch', 'patch', 'tests', 'reproduction_result', 'regression_result', 'build', 'status', 'risk_score', 'ai_confidence']) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (key === 'status') {
        if (!STATUSES.includes(patch.status)) throw new Error(`unknown attempt status: ${patch.status}`);
        entry.status = patch.status;
      } else if (key === 'risk_score') {
        entry.risk_score = normalizeScore(patch.risk_score, 'risk_score');
      } else if (key === 'ai_confidence') {
        entry.ai_confidence = normalizeConfidence(patch.ai_confidence);
      } else if (key === 'branch') {
        entry.branch = typeof patch.branch === 'string' ? patch.branch.slice(0, 256) : null;
      } else {
        entry[key] = patch[key] && typeof patch[key] === 'object' ? JSON.parse(JSON.stringify(patch[key])) : patch[key];
      }
    }
    entry.updated_at = now;
    this.write(db);
    return JSON.parse(JSON.stringify(entry));
  }

  get(attemptId) {
    const attempt = this.read().attempts[attemptId];
    return attempt ? JSON.parse(JSON.stringify(attempt)) : null;
  }

  listForBug(bugId) {
    return JSON.parse(JSON.stringify(Object.values(this.read().attempts).filter((attempt) => attempt.bug_id === bugId)));
  }

  stats() {
    const attempts = Object.values(this.read().attempts);
    const byStatus = {};
    for (const status of STATUSES) byStatus[status] = 0;
    for (const attempt of attempts) byStatus[attempt.status] = (byStatus[attempt.status] || 0) + 1;
    return { attempts: attempts.length, byStatus };
  }
}

module.exports = { RepairAttemptStore, STATUSES };