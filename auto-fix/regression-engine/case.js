'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');

// Milestone 9 — permanent regression case storage (spec section 15).
// Regression cases are immutable by convention: there is intentionally NO
// delete or update API, so the historical regression suite can never silently
// lose an entry. The only way to add coverage is to create a new case.

const MAX_ID = 128;
const MAX_FINGERPRINT = 64;
const MAX_SUMMARY = 512;
const MAX_ROOT_CAUSE = 8192;
const MAX_SOURCE_NOTE = 1024;
const MAX_TYPE = 128;
const SOURCE_KINDS = ['production-bug', 'manual', 'clean-machine', 'rollback-incident'];

function emptyData() {
  return { schemaVersion: 1, cases: {} };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateReplaySpec(spec) {
  if (!Array.isArray(spec) || spec.length === 0) return 'replay_spec must be a non-empty array';
  for (let i = 0; i < spec.length; i += 1) {
    const rule = spec[i];
    if (!isObject(rule)) return `replay_spec[${i}] must be an object`;
    if (!isObject(rule.when)) return `replay_spec[${i}].when must be an object`;
    if (!isObject(rule.then)) return `replay_spec[${i}].then must be an object`;
    if (rule.then.failed !== undefined && typeof rule.then.failed !== 'boolean') {
      return `replay_spec[${i}].then.failed must be a boolean`;
    }
    if (rule.then.handled !== undefined && typeof rule.then.handled !== 'boolean') {
      return `replay_spec[${i}].then.handled must be a boolean`;
    }
    if (rule.then.fingerprint !== undefined && !isString(rule.then.fingerprint, MAX_FINGERPRINT)) {
      return `replay_spec[${i}].then.fingerprint must be a non-empty string (<=${MAX_FINGERPRINT} chars)`;
    }
  }
  return null;
}

function sanitizeRule(rule) {
  const when = {};
  if (isString(rule.when.type, MAX_TYPE)) when.type = rule.when.type;
  if (Number.isInteger(rule.when.seq)) when.seq = rule.when.seq;
  const then = {};
  if (typeof rule.then.failed === 'boolean') then.failed = rule.then.failed;
  if (typeof rule.then.handled === 'boolean') then.handled = rule.then.handled;
  if (isString(rule.then.fingerprint, MAX_FINGERPRINT)) then.fingerprint = rule.then.fingerprint;
  return { when, then };
}

class RegressionCaseStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  create(caseData, now = new Date().toISOString()) {
    if (!isObject(caseData)) throw new Error('case must be an object');
    if (!isString(caseData.regression_id, MAX_ID)) throw new Error('regression_id is required (<=128 chars)');
    if (!isString(caseData.bug_id, MAX_ID)) throw new Error('bug_id is required (<=128 chars)');
    if (!isString(caseData.fingerprint, MAX_FINGERPRINT)) throw new Error('fingerprint is required (<=64 chars)');
    if (!isObject(caseData.reproduction)) throw new Error('reproduction must be an object');
    if (!isString(caseData.reproduction.expected_fingerprint, MAX_FINGERPRINT)) {
      throw new Error('reproduction.expected_fingerprint is required (<=64 chars)');
    }
    const specError = validateReplaySpec(caseData.replay_spec);
    if (specError) throw new Error(specError);

    const db = this.read();
    if (db.cases[caseData.regression_id]) throw new Error(`regression case already exists: ${caseData.regression_id}`);

    const sourceKind = SOURCE_KINDS.includes(caseData.source_kind) ? caseData.source_kind : 'production-bug';
    const entry = {
      regression_id: caseData.regression_id,
      bug_id: caseData.bug_id,
      fingerprint: caseData.fingerprint,
      source_kind: sourceKind,
      source_note: isString(caseData.source_note, MAX_SOURCE_NOTE) ? caseData.source_note.slice(0, MAX_SOURCE_NOTE) : null,
      reproduction: {
        reproduction_id: isString(caseData.reproduction.reproduction_id, MAX_ID) ? caseData.reproduction.reproduction_id : null,
        sequence_id: isString(caseData.reproduction.sequence_id, MAX_ID) ? caseData.reproduction.sequence_id : null,
        expected_fingerprint: caseData.reproduction.expected_fingerprint,
        sequence: isObject(caseData.reproduction.sequence) ? JSON.parse(JSON.stringify(caseData.reproduction.sequence)) : null,
        environment: isObject(caseData.reproduction.environment) ? JSON.parse(JSON.stringify(caseData.reproduction.environment)) : null,
      },
      replay_spec: caseData.replay_spec.map(sanitizeRule),
      knowledge: {
        summary: isString(caseData.knowledge && caseData.knowledge.summary, MAX_SUMMARY) ? caseData.knowledge.summary.slice(0, MAX_SUMMARY) : null,
        root_cause: isString(caseData.knowledge && caseData.knowledge.root_cause, MAX_ROOT_CAUSE) ? caseData.knowledge.root_cause.slice(0, MAX_ROOT_CAUSE) : null,
        environment_specific: !!(caseData.knowledge && caseData.knowledge.environment_specific),
      },
      created_at: now,
      updated_at: now,
    };

    db.cases[entry.regression_id] = entry;
    this.write(db);
    this.auditEvent('regression-case-created', { regression_id: entry.regression_id, bug_id: entry.bug_id, fingerprint: entry.fingerprint });
    return JSON.parse(JSON.stringify(entry));
  }

  get(regressionId) {
    const entry = this.read().cases[regressionId];
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }

  list() {
    return JSON.parse(JSON.stringify(Object.values(this.read().cases)));
  }

  listForBug(bugId) {
    return JSON.parse(JSON.stringify(Object.values(this.read().cases).filter((entry) => entry.bug_id === bugId)));
  }

  stats() {
    const cases = Object.values(this.read().cases);
    const bySource = {};
    for (const kind of SOURCE_KINDS) bySource[kind] = 0;
    for (const entry of cases) bySource[entry.source_kind] = (bySource[entry.source_kind] || 0) + 1;
    const byBug = {};
    for (const entry of cases) byBug[entry.bug_id] = (byBug[entry.bug_id] || 0) + 1;
    return { cases: cases.length, bySource, byBug };
  }
}

module.exports = { RegressionCaseStore, SOURCE_KINDS };