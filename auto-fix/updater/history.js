'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');

// Milestone 11 — append-only update attempt and rollback-incident history
// (spec sections 23, 35). There is intentionally NO delete API. Every attempt
// and incident is recorded for audit, mirroring the regression case store.

const MAX_ID = 128;
const MAX_REASON = 1024;

function emptyData() {
  return { schemaVersion: 1, attempts: [], incidents: [] };
}

class UpdateHistory extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  recordAttempt(attempt, now = new Date().toISOString()) {
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) throw new Error('attempt must be an object');
    const entry = {
      attempt_id: isString(attempt.attempt_id, MAX_ID) ? attempt.attempt_id : `update-${Date.now()}`,
      from_version: attempt.from_version || null,
      to_version: attempt.to_version || null,
      status: attempt.status || 'unknown',
      reason: isString(attempt.reason, MAX_REASON) ? attempt.reason.slice(0, MAX_REASON) : null,
      recorded_at: now,
    };
    const db = this.read();
    db.attempts.push(entry);
    this.write(db);
    this.auditEvent('update-attempt-recorded', { attempt_id: entry.attempt_id, status: entry.status });
    return JSON.parse(JSON.stringify(entry));
  }

  recordIncident(incident, now = new Date().toISOString()) {
    const entry = {
      incident_id: isString(incident && incident.incident_id, MAX_ID) ? incident.incident_id : `incident-${Date.now()}`,
      reason: isString(incident && incident.reason, MAX_REASON) ? incident.reason.slice(0, MAX_REASON) : 'update-health-failure',
      to_version: (incident && incident.to_version) || null,
      restored_version: (incident && incident.restored_version) || null,
      recorded_at: now,
    };
    const db = this.read();
    db.incidents.push(entry);
    this.write(db);
    this.auditEvent('rollback-incident-recorded', { incident_id: entry.incident_id, reason: entry.reason });
    return JSON.parse(JSON.stringify(entry));
  }

  stats() {
    const db = this.read();
    return {
      attempts: db.attempts.length,
      incidents: db.incidents.length,
      lastAttempt: db.attempts[db.attempts.length - 1] || null,
    };
  }
}

module.exports = { UpdateHistory };