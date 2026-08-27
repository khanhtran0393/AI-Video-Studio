'use strict';

const { JsonStore, isString } = require('./store');

// Whitelisted technical, non-personal fields (spec section 5 + section 28:
// data minimization). Arbitrary extra keys are dropped.
const ALLOWED_FIELDS = [
  'OS',
  'OS build',
  'architecture',
  'runtime',
  'dependency versions',
  'configuration fingerprint',
  'locale',
  'timezone',
  'timezone_offset_minutes',
  'gpu',
  'driver',
];
const MAX_ENV_ID = 128;

function emptyData() {
  return { schemaVersion: 1, profiles: {} };
}

class EnvironmentProfileStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  _normalize(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error('environment profile must be an object');
    }
    if (!isString(profile.environment_id, MAX_ENV_ID)) {
      throw new Error('environment_id is required (<=128 chars)');
    }
    const output = { environment_id: profile.environment_id };
    for (const key of ALLOWED_FIELDS) {
      const value = profile[key];
      if (value === undefined) continue;
      if (typeof value === 'string') output[key] = value.slice(0, 512);
      else if (typeof value === 'number' || typeof value === 'boolean') output[key] = value;
      else if (value === null) output[key] = null;
      else if (typeof value === 'object') output[key] = JSON.parse(JSON.stringify(value));
    }
    return output;
  }

  upsert(profile, now = new Date().toISOString()) {
    const normalized = this._normalize(profile);
    const db = this.read();
    const existing = db.profiles[normalized.environment_id];
    const entry = existing
      ? { ...existing, ...normalized, known: true, last_seen: now, crash_count: (existing.crash_count || 0) + 1 }
      : { ...normalized, known: true, first_seen: now, last_seen: now, crash_count: 1 };
    db.profiles[normalized.environment_id] = entry;
    this.write(db);
    this.auditEvent('environment-profile-upserted', { environment_id: entry.environment_id });
    return JSON.parse(JSON.stringify(entry));
  }

  touch(environmentId, now = new Date().toISOString()) {
    if (!isString(environmentId, MAX_ENV_ID)) throw new Error('environment_id must be a string (<=128 chars)');
    const db = this.read();
    const existing = db.profiles[environmentId] || { environment_id: environmentId, known: false, first_seen: now };
    existing.crash_count = (existing.crash_count || 0) + 1;
    existing.last_seen = now;
    db.profiles[environmentId] = existing;
    this.write(db);
    return JSON.parse(JSON.stringify(existing));
  }

  get(environmentId) {
    const profile = this.read().profiles[environmentId];
    return profile ? JSON.parse(JSON.stringify(profile)) : null;
  }

  list() {
    return JSON.parse(JSON.stringify(Object.values(this.read().profiles)));
  }

  stats() {
    const profiles = Object.values(this.read().profiles);
    return {
      profiles: profiles.length,
      known: profiles.filter((profile) => profile.known).length,
      totalCrashes: profiles.reduce((sum, profile) => sum + (profile.crash_count || 0), 0),
    };
  }
}

module.exports = { EnvironmentProfileStore };