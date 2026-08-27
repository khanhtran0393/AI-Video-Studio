'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');

const MAX_ID = 128;
const MAX_REASON = 2048;
const STATUSES = ['requested', 'in-progress', 'completed', 'failed'];

function emptyData() {
  return { schemaVersion: 1, incidents: {} };
}

function normalizeStatus(status) {
  if (!status || !STATUSES.includes(status)) return 'requested';
  return status;
}

class IncidentStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  create(incident, now = new Date().toISOString()) {
    if (!incident || typeof incident !== 'object' || Array.isArray(incident)) {
      throw new Error('incident must be an object');
    }
    if (!isString(incident.incident_id, MAX_ID)) {
      throw new Error('incident_id is required (<=128 chars)');
    }
    if (!isString(incident.release_id, MAX_ID)) {
      throw new Error('release_id is required (<=128 chars)');
    }
    const db = this.read();
    if (db.incidents[incident.incident_id]) {
      throw new Error(`incident already exists: ${incident.incident_id}`);
    }

    const entry = {
      incident_id: incident.incident_id,
      release_id: incident.release_id,
      reason: typeof incident.reason === 'string' ? incident.reason.slice(0, MAX_REASON) : null,
      status: normalizeStatus(incident.status),
      regression_case_id: null, // filled later when created
      created_at: now,
      updated_at: now,
      completed_at: null,
      failure_details: incident.failure_details && typeof incident.failure_details === 'object'
        ? JSON.parse(JSON.stringify(incident.failure_details))
        : null,
    };

    db.incidents[entry.incident_id] = entry;
    this.write(db);
    this.auditEvent('rollback-incident-created', {
      incident_id: entry.incident_id,
      release_id: entry.release_id,
      status: entry.status,
    });
    return JSON.parse(JSON.stringify(entry));
  }

  update(incidentId, patch, now = new Date().toISOString()) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('patch must be an object');
    }
    const db = this.read();
    const entry = db.incidents[incidentId];
    if (!entry) throw new Error('incident not found');

    if (patch.status !== undefined) {
      entry.status = normalizeStatus(patch.status);
    }
    if (patch.reason !== undefined) {
      entry.reason = typeof patch.reason === 'string' ? patch.reason.slice(0, MAX_REASON) : null;
    }
    if (patch.regression_case_id !== undefined) {
      if (patch.regression_case_id !== null && !isString(patch.regression_case_id, MAX_ID)) {
        throw new Error('regression_case_id must be null or <=128 chars');
      }
      entry.regression_case_id = patch.regression_case_id;
    }
    if (patch.failure_details !== undefined) {
      entry.failure_details = patch.failure_details && typeof patch.failure_details === 'object'
        ? JSON.parse(JSON.stringify(patch.failure_details))
        : null;
    }
    if (patch.completed_at !== undefined) {
      entry.completed_at = patch.completed_at || null;
    }
    entry.updated_at = now;
    this.write(db);
    return JSON.parse(JSON.stringify(entry));
  }

  get(incidentId) {
    const entry = this.read().incidents[incidentId];
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }

  listForRelease(releaseId) {
    return JSON.parse(JSON.stringify(
      Object.values(this.read().incidents)
        .filter((inc) => inc.release_id === releaseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    ));
  }

  stats() {
    const incidents = Object.values(this.read().incidents);
    const byStatus = {};
    for (const status of STATUSES) byStatus[status] = 0;
    for (const inc of incidents) byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
    return { incidents: incidents.length, byStatus };
  }
}

module.exports = { IncidentStore, STATUSES };