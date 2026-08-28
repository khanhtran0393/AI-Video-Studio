'use strict';

const { JsonStore, isString } = require('./store');
const { normalizeClientFingerprint } = require('./fingerprint');

// Master data object from spec section 5: BugCase.
const MAX_BUG_ID = 128;
const MAX_FINGERPRINT = 64;
const MAX_VERSION = 64;
const MAX_ENV_ID = 128;
const MAX_INSTALL_ID = 256;
const MAX_ROOT_CAUSE = 8192;
const MAX_REF = 256;
const MAX_SUMMARY = 512;
const MAX_VERSIONS = 50;
const MAX_ENVIRONMENTS = 200;
const MAX_USERS = 500;
const MAX_FIX_HISTORY = 200;
const MAX_REGRESSION_REFS = 200;
const MAX_ALIASES = 200;

const CASE_STATUSES = ['open', 'investigating', 'reproduced', 'patch-proposed', 'testing', 'resolved', 'closed', 'escalated'];
const REPRODUCTION_STATUSES = ['unattempted', 'in-progress', 'reproduced', 'not-reproduced', 'failed'];
const RISK_LEVELS = ['low', 'medium', 'high'];
const CONFIDENCE_KEYS = ['root_cause_confidence', 'reproduction_confidence', 'patch_confidence', 'release_confidence'];

function emptyData() {
  return { schemaVersion: 1, cases: {}, byFingerprint: {}, byAlias: {} };
}

function normalizeConfidence(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('confidence must be an object');
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

function bugIdFor(fingerprint, taken) {
  const base = `BUG-${String(fingerprint).slice(0, 12).toUpperCase()}`;
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * BugCaseStore keys one case per canonical server fingerprint so identical
 * failures collapse into one investigation (spec section 8). Client
 * fingerprints are retained as aliases for reverse lookup and auditing.
 */
class BugCaseStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  _newCaseEntry(bugId, fingerprint, now) {
    return {
      bug_id: bugId,
      fingerprint,
      aliases: [],
      affected_versions: [],
      affected_environments: [],
      environment_distribution: {},
      affected_users: 0,
      sample_installation_ids: [],
      occurrences: 0,
      reproduction_status: 'unattempted',
      root_cause: null,
      confidence: null,
      risk: null,
      current_status: 'open',
      fix_history: [],
      regression_test_refs: [],
      first_seen: null,
      last_seen: null,
      created_at: now,
      updated_at: now,
    };
  }

  _cleanList(values, max, maxLength, label) {
    const out = [];
    for (const value of values) {
      if (!isString(value, maxLength)) throw new Error(`${label} entries must be non-empty strings (<=${maxLength} chars)`);
      if (!out.includes(value)) out.push(value);
      if (out.length >= max) break;
    }
    return out;
  }

  // Manual creation for non-crash-derived cases (e.g. human-reported bugs).
  create(caseData, now = new Date().toISOString()) {
    if (!caseData || typeof caseData !== 'object' || Array.isArray(caseData)) throw new Error('case must be an object');
    if (!isString(caseData.bug_id, MAX_BUG_ID)) throw new Error('bug_id is required (<=128 chars)');
    if (!isString(caseData.fingerprint, MAX_FINGERPRINT)) throw new Error('fingerprint is required (<=64 chars)');

    const db = this.read();
    if (db.cases[caseData.bug_id]) throw new Error(`bug case already exists: ${caseData.bug_id}`);
    if (db.byFingerprint[caseData.fingerprint]) throw new Error(`fingerprint already assigned to ${db.byFingerprint[caseData.fingerprint]}`);

    const entry = this._newCaseEntry(caseData.bug_id, caseData.fingerprint, now);
    const confidence = caseData.confidence !== undefined ? caseData.confidence : caseData.ai_confidence;
    if (confidence !== undefined) entry.confidence = normalizeConfidence(confidence);
    if (caseData.current_status !== undefined) {
      if (!CASE_STATUSES.includes(caseData.current_status)) throw new Error(`unknown status: ${caseData.current_status}`);
      entry.current_status = caseData.current_status;
    } else if (CASE_STATUSES.includes(caseData.status)) {
      // Accept recognized legacy status values while storing only the canonical field.
      entry.current_status = caseData.status;
    }
    db.cases[entry.bug_id] = entry;
    db.byFingerprint[entry.fingerprint] = entry.bug_id;
    this.write(db);
    this.auditEvent('bug-case-created', { bug_id: entry.bug_id, fingerprint: entry.fingerprint });
    return JSON.parse(JSON.stringify(entry));
  }

  attach(crash, now = new Date().toISOString(), reconciliation = {}) {
    const canonical = reconciliation.canonicalFingerprint;
    if (!isString(canonical, MAX_FINGERPRINT)) throw new Error('cannot attach crash: canonical fingerprint is missing');

    const aliasFp = reconciliation.clientFingerprint
      || normalizeClientFingerprint(crash && crash.fingerprint)
      || null;

    const db = this.read();
    let bugId = db.byFingerprint[canonical] || (aliasFp && db.byAlias[aliasFp]) || null;
    let matchedBy = 'new';
    const created = !bugId;

    if (!bugId) {
      bugId = bugIdFor(canonical, new Set(Object.keys(db.cases)));
      matchedBy = 'fingerprint';
      db.cases[bugId] = this._newCaseEntry(bugId, canonical, now);
      db.byFingerprint[canonical] = bugId;
    } else if (db.byFingerprint[canonical] === bugId) {
      matchedBy = 'fingerprint';
    } else {
      matchedBy = 'alias';
    }

    const entry = db.cases[bugId];
    if (!entry) throw new Error('bug case missing after lookup');

    entry.occurrences += 1;
    entry.last_seen = now;
    if (!entry.first_seen) entry.first_seen = now;

    if (aliasFp && !entry.aliases.includes(aliasFp)) {
      entry.aliases.push(aliasFp);
      if (entry.aliases.length > MAX_ALIASES) entry.aliases = entry.aliases.slice(-MAX_ALIASES);
      if (!db.byAlias[aliasFp]) db.byAlias[aliasFp] = bugId;
    }

    if (crash && isString(crash.app_version, MAX_VERSION) && !entry.affected_versions.includes(crash.app_version)) {
      entry.affected_versions.push(crash.app_version);
      if (entry.affected_versions.length > MAX_VERSIONS) entry.affected_versions = entry.affected_versions.slice(-MAX_VERSIONS);
    }

    const envId = crash && (crash.environment_id || (crash.environment && crash.environment.environment_id));
    if (isString(envId, MAX_ENV_ID)) {
      if (!entry.affected_environments.includes(envId)) {
        entry.affected_environments.push(envId);
        if (entry.affected_environments.length > MAX_ENVIRONMENTS) entry.affected_environments = entry.affected_environments.slice(-MAX_ENVIRONMENTS);
      }
      if (!entry.environment_distribution || typeof entry.environment_distribution !== 'object' || Array.isArray(entry.environment_distribution)) {
        entry.environment_distribution = {};
      }
      entry.environment_distribution[envId] = (entry.environment_distribution[envId] || 0) + 1;
    }

    const installId = crash && crash.client_installation_id;
    if (isString(installId, MAX_INSTALL_ID)) {
      if (!entry.sample_installation_ids.includes(installId)) entry.sample_installation_ids.push(installId);
      if (entry.sample_installation_ids.length > MAX_USERS) entry.sample_installation_ids = entry.sample_installation_ids.slice(-MAX_USERS);
      entry.affected_users = entry.sample_installation_ids.length;
    }

    entry.updated_at = now;
    this.write(db);
    this.auditEvent('bug-case-attached', { bug_id: bugId, occurrences: entry.occurrences, matchedBy, created });
    return { bugId, created, matchedBy };
  }


  update(bugId, patch, now = new Date().toISOString()) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('patch must be an object');
    const db = this.read();
    const entry = db.cases[bugId];
    if (!entry) throw new Error('bug case not found');

    if ('reproduction_status' in patch) {
      if (!REPRODUCTION_STATUSES.includes(patch.reproduction_status)) throw new Error(`unknown reproduction_status: ${patch.reproduction_status}`);
      entry.reproduction_status = patch.reproduction_status;
    }
    if ('root_cause' in patch) {
      const value = patch.root_cause;
      if (value !== null && typeof value !== 'string') throw new Error('root_cause must be a string or null');
      entry.root_cause = value === null ? null : value.slice(0, MAX_ROOT_CAUSE);
    }
    if ('confidence' in patch) entry.confidence = normalizeConfidence(patch.confidence);
    if ('risk' in patch) {
      if (patch.risk !== null && !RISK_LEVELS.includes(patch.risk)) throw new Error(`unknown risk level: ${patch.risk}`);
      entry.risk = patch.risk;
    }
    if ('current_status' in patch) {
      if (!CASE_STATUSES.includes(patch.current_status)) throw new Error(`unknown status: ${patch.current_status}`);
      entry.current_status = patch.current_status;
    }
    if (Array.isArray(patch.affected_versions)) entry.affected_versions = this._cleanList(patch.affected_versions, MAX_VERSIONS, MAX_VERSION, 'affected_versions');
    if (Array.isArray(patch.regression_test_refs)) entry.regression_test_refs = this._cleanList(patch.regression_test_refs, MAX_REGRESSION_REFS, MAX_REF, 'regression_test_refs');

    entry.updated_at = now;
    this.write(db);
    this.auditEvent('bug-case-updated', { bug_id: bugId });
    return JSON.parse(JSON.stringify(entry));
  }


  recordFix(bugId, attemptId, summary, now = new Date().toISOString()) {
    if (!isString(attemptId, MAX_BUG_ID)) throw new Error('attempt_id must be a string (<=128 chars)');
    const db = this.read();
    const entry = db.cases[bugId];
    if (!entry) throw new Error('bug case not found');

    entry.fix_history.push({
      attempt_id: attemptId,
      summary: typeof summary === 'string' ? summary.slice(0, MAX_SUMMARY) : '',
      recorded_at: now,
    });
    if (entry.fix_history.length > MAX_FIX_HISTORY) entry.fix_history = entry.fix_history.slice(-MAX_FIX_HISTORY);
    entry.updated_at = now;
    this.write(db);
    this.auditEvent('bug-case-fix-recorded', { bug_id: bugId, attempt_id: attemptId });
    return JSON.parse(JSON.stringify(entry));
  }


  get(bugId) {
    const entry = this.read().cases[bugId];
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }


  getByFingerprint(fingerprint) {
    const key = typeof fingerprint === 'string' ? fingerprint.toLowerCase() : '';
    const db = this.read();
    const bugId = db.byFingerprint[key] || db.byAlias[key];
    return bugId ? this.get(bugId) : null;
  }


  list() {
    return JSON.parse(JSON.stringify(Object.values(this.read().cases)));
  }


  stats() {
    const cases = Object.values(this.read().cases);
    const byStatus = {};
    for (const status of CASE_STATUSES) byStatus[status] = 0;
    for (const entry of cases) byStatus[entry.current_status] = (byStatus[entry.current_status] || 0) + 1;
    return {
      cases: cases.length,
      totalOccurrences: cases.reduce((sum, entry) => sum + (entry.occurrences || 0), 0),
      byStatus,
    };
  }

}

module.exports = { BugCaseStore, CASE_STATUSES, REPRODUCTION_STATUSES, RISK_LEVELS };