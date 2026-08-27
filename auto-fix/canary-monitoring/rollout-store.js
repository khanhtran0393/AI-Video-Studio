'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');
const { ROLLOUT_STAGES, isStageIndex, stagePercent } = require('./rollout-policy');

// Milestone 12 — Durable canary rollout state (Master Spec sections 22, 23).
// Records the active release version, current stage percentage, rollout status,
// and an append-only history of promotion/hold/stop/rollback events. There is
// intentionally NO delete API and no way to move backwards except rollback().

const MAX_VERSION = 64;
const MAX_REASON = 1024;
const MAX_HISTORY = 500;
const ROLLOUT_STATUSES = Object.freeze(['idle', 'active', 'held', 'stopped', 'rolled_back', 'completed']);

function emptyData() {
  return { schemaVersion: 1, release: null, stage_index: 0, percent: 0, status: 'idle', history: [] };
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanReason(value) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, MAX_REASON) : null;
}

class RolloutStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  current() {
    return clone(this.read());
  }

  start(version, now = new Date().toISOString()) {
    if (!isString(version, MAX_VERSION)) throw new Error(`version must be a non-empty string (<=${MAX_VERSION} chars)`);
    const db = this.read();
    if (db.status === 'active' || db.status === 'held') throw new Error(`rollout already in progress (status: ${db.status})`);
    db.release = { version, artifact_id: null, started_at: now, started_from: db.status === 'rolled_back' ? db.status : null };
    db.stage_index = 0;
    db.percent = stagePercent(0);
    db.status = 'active';
    db.history = [{ event: 'started', version, percent: db.percent, at: now }];
    this.write(db);
    this.auditEvent('rollout-started', { version, percent: db.percent });
    return this.current();
  }

  _push(db, event, evidence, now) {
    db.history.push({ event, ...(evidence || {}), at: now });
    if (db.history.length > MAX_HISTORY) db.history = db.history.slice(-MAX_HISTORY);
  }

  promoteToStage(index, evidence = {}, now = new Date().toISOString()) {
    if (!isStageIndex(index)) throw new Error(`invalid stage index: ${index}`);
    const db = this.read();
    if (db.status !== 'active' && db.status !== 'held') throw new Error(`cannot promote while status is ${db.status}`);
    if (index !== db.stage_index + 1) throw new Error(`stages must be promoted sequentially (current ${db.stage_index}, requested ${index})`);
    db.stage_index = index;
    db.percent = stagePercent(index);
    db.status = 'active';
    this._push(db, 'promoted', { percent: db.percent, reason: cleanReason(evidence.reason) }, now);
    this.write(db);
    this.auditEvent('rollout-promoted', { percent: db.percent });
    return this.current();
  }

  hold(evidence = {}, now = new Date().toISOString()) {
    const db = this.read();
    if (db.status !== 'active') throw new Error(`cannot hold while status is ${db.status}`);
    db.status = 'held';
    this._push(db, 'held', { reason: cleanReason(evidence.reason), breaches: evidence.breaches || [] }, now);
    this.write(db);
    this.auditEvent('rollout-held', { reason: cleanReason(evidence.reason) });
    return this.current();
  }

  stop(evidence = {}, now = new Date().toISOString()) {
    const db = this.read();
    if (db.status !== 'active' && db.status !== 'held') throw new Error(`cannot stop while status is ${db.status}`);
    db.status = 'stopped';
    this._push(db, 'stopped', { reason: cleanReason(evidence.reason), breaches: evidence.breaches || [] }, now);
    this.write(db);
    this.auditEvent('rollout-stopped', { reason: cleanReason(evidence.reason) });
    return this.current();
  }

  rollback(evidence = {}, now = new Date().toISOString()) {
    const db = this.read();
    if (db.status === 'rolled_back') throw new Error('rollout is already rolled back');
    const previousStatus = db.status;
    db.status = 'rolled_back';
    this._push(db, 'rolled_back', {
      from_status: previousStatus,
      version: db.release && db.release.version ? db.release.version : null,
      reason: cleanReason(evidence.reason),
      breaches: evidence.breaches || [],
    }, now);
    this.write(db);
    this.auditEvent('rollout-rolled-back', { version: db.release && db.release.version, reason: cleanReason(evidence.reason) });
    return this.current();
  }

  complete(now = new Date().toISOString()) {
    const db = this.read();
    if (db.status !== 'active') throw new Error(`cannot complete while status is ${db.status}`);
    if (db.stage_index !== ROLLOUT_STAGES.length - 1) throw new Error('cannot complete before the final stage');
    db.status = 'completed';
    db.percent = 100;
    this._push(db, 'completed', { percent: 100 }, now);
    this.write(db);
    this.auditEvent('rollout-completed', { version: db.release && db.release.version });
    return this.current();
  }

  stats() {
    const db = this.read();
    return {
      status: db.status,
      percent: db.percent,
      stage_index: db.stage_index,
      version: db.release && db.release.version ? db.release.version : null,
      historyLength: db.history.length,
    };
  }
}

module.exports = { ROLLOUT_STATUSES, RolloutStore };