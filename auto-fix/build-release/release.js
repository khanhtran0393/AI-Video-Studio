'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');

// Milestone 10 - Release master data object (spec section 5).
// Releases are immutable: every state change is recorded as an append-only
// history entry, and the release_id can never be created twice. Rollout
// decisions are never made here - this store only records authorized state.

const MAX_ID = 128;
const MAX_VERSION = 64;
const MAX_ARTIFACT_ID = 128;
const MAX_NOTE = 1024;
const MAX_HISTORY = 200;
const ROLLOUT_STATES = ['draft', 'pending-approval', 'canary', 'expanding', 'stable', 'paused', 'rolled-back', 'cancelled'];
const ROLLBACK_STATES = ['none', 'requested', 'in-progress', 'completed', 'failed'];

function emptyData() {
  return { schemaVersion: 1, releases: {} };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizePercent(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('canary_percentage must be a number in [0,100]');
  }
  return value;
}

class ReleaseStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  create(release, now = new Date().toISOString()) {
    if (!isObject(release)) throw new Error('release must be an object');
    if (!isString(release.release_id, MAX_ID)) throw new Error('release_id is required (<=128 chars)');
    if (!isString(release.version, MAX_VERSION)) throw new Error('version is required (<=64 chars)');
    if (!isString(release.artifact_id, MAX_ARTIFACT_ID)) throw new Error('artifact_id is required (<=128 chars)');

    const db = this.read();
    if (db.releases[release.release_id]) throw new Error(`release already exists: ${release.release_id}`);

    const rolloutState = ROLLOUT_STATES.includes(release.rollout_state) ? release.rollout_state : 'draft';
    const canary = normalizePercent(release.canary_percentage);
    const entry = {
      release_id: release.release_id,
      version: release.version,
      artifact_id: release.artifact_id,
      rollout_state: rolloutState,
      canary_percentage: canary,
      health_metrics: isObject(release.health_metrics) ? JSON.parse(JSON.stringify(release.health_metrics)) : null,
      rollback_state: ROLLBACK_STATES.includes(release.rollback_state) ? release.rollback_state : 'none',
      history: [{
        at: now,
        action: 'created',
        rollout_state: rolloutState,
        canary_percentage: canary ?? 0,
        rollback_state: 'none',
        reason: typeof release.reason === 'string' ? release.reason.slice(0, MAX_NOTE) : null,
      }],
      created_at: now,
      updated_at: now,
    };

    db.releases[entry.release_id] = entry;
    this.write(db);
    this.auditEvent('release-created', { release_id: entry.release_id, version: entry.version, rollout_state: rolloutState });
    return JSON.parse(JSON.stringify(entry));
  }

  _transition(releaseId, action, patch, now) {
    if (!isString(releaseId, MAX_ID)) throw new Error('release_id is required');
    if (!isObject(patch)) throw new Error('patch must be an object');
    const db = this.read();
    const entry = db.releases[releaseId];
    if (!entry) throw new Error('release not found');

    if (patch.rollout_state !== undefined && !ROLLOUT_STATES.includes(patch.rollout_state)) {
      throw new Error(`unknown rollout_state: ${patch.rollout_state}`);
    }
    if (patch.rollback_state !== undefined && !ROLLBACK_STATES.includes(patch.rollback_state)) {
      throw new Error(`unknown rollback_state: ${patch.rollback_state}`);
    }

    if (patch.rollout_state !== undefined) entry.rollout_state = patch.rollout_state;
    if (patch.canary_percentage !== undefined) entry.canary_percentage = normalizePercent(patch.canary_percentage);
    if (patch.health_metrics !== undefined) {
      entry.health_metrics = isObject(patch.health_metrics) ? JSON.parse(JSON.stringify(patch.health_metrics)) : null;
    }
    if (patch.rollback_state !== undefined) entry.rollback_state = patch.rollback_state;

    entry.history = Array.isArray(entry.history) ? entry.history : [];
    entry.history.push({
      at: now,
      action,
      rollout_state: entry.rollout_state,
      canary_percentage: entry.canary_percentage,
      rollback_state: entry.rollback_state,
      reason: typeof patch.reason === 'string' ? patch.reason.slice(0, MAX_NOTE) : null,
    });
    if (entry.history.length > MAX_HISTORY) entry.history = entry.history.slice(-MAX_HISTORY);
    entry.updated_at = now;

    this.write(db);
    this.auditEvent(`release-${action}`, { release_id: releaseId, rollout_state: entry.rollout_state, canary_percentage: entry.canary_percentage });
    return JSON.parse(JSON.stringify(entry));
  }

  setRollout(releaseId, patch, now = new Date().toISOString()) {
    return this._transition(releaseId, 'rollout-changed', patch, now);
  }

  recordHealth(releaseId, healthMetrics, now = new Date().toISOString()) {
    return this._transition(releaseId, 'health-recorded', { health_metrics: healthMetrics }, now);
  }

  requestRollback(releaseId, reason, now = new Date().toISOString()) {
    return this._transition(releaseId, 'rollback-requested', { rollout_state: 'rolled-back', rollback_state: 'requested', reason }, now);
  }

  completeRollback(releaseId, now = new Date().toISOString()) {
    return this._transition(releaseId, 'rollback-completed', { rollback_state: 'completed' }, now);
  }

  get(releaseId) {
    const release = this.read().releases[releaseId];
    return release ? JSON.parse(JSON.stringify(release)) : null;
  }

  listByVersion(version) {
    return JSON.parse(JSON.stringify(Object.values(this.read().releases)
      .filter((entry) => entry.version === version)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))));
  }

  stats() {
    const releases = Object.values(this.read().releases);
    const byState = {};
    for (const state of ROLLOUT_STATES) byState[state] = 0;
    for (const entry of releases) byState[entry.rollout_state] = (byState[entry.rollout_state] || 0) + 1;
    return { releases: releases.length, byState };
  }
}

module.exports = { ReleaseStore, ROLLOUT_STATES, ROLLBACK_STATES };