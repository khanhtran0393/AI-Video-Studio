'use strict';

const crypto = require('crypto');
const { environmentProfile } = require('../client-error-reporter/environment');

const PROFILE_KINDS = Object.freeze(['user-like', 'clean', 'golden']);

const REQUIRED_FIELDS = [
  'environment_id',
  'OS',
  'OS build',
  'architecture',
  'runtime',
  'configuration fingerprint',
];

function stableEnvironmentId(parts) {
  return crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 24);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates an EnvironmentProfile (spec section 5). Treats input as untrusted:
 * required-field presence plus type/length checks.
 */
function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return { valid: false, errors: ['profile must be an object'] };
  }
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(profile, field)) errors.push(`missing required field: ${field}`);
  }
  if (profile.environment_id !== undefined && !isNonEmptyString(profile.environment_id)) errors.push('environment_id must be a non-empty string');
  if (profile.kind !== undefined && !PROFILE_KINDS.includes(profile.kind)) errors.push('kind must be one of user-like, clean, golden');
  if (profile['dependency versions'] !== undefined
    && (typeof profile['dependency versions'] !== 'object' || Array.isArray(profile['dependency versions']))) {
    errors.push('dependency versions must be an object');
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

/**
 * Builds a profile of the given kind from the live host fingerprint unless
 * overridden. The environment id is derived from stable technical fields only
 * and includes the kind so user-like / clean / golden never collide.
 */
function buildProfile(kind, overrides = {}) {
  const base = overrides.base || environmentProfile();
  const environment_id = overrides.environment_id
    || stableEnvironmentId([kind, base.OS, base['OS build'], base.architecture, base.runtime]);
  const defaultConfigFingerprint = kind === 'user-like'
    ? (base['configuration fingerprint'] || environment_id)
    : environment_id;

  return {
    environment_id,
    kind,
    OS: overrides.OS != null ? overrides.OS : base.OS,
    'OS build': overrides['OS build'] != null ? overrides['OS build'] : base['OS build'],
    architecture: overrides.architecture != null ? overrides.architecture : base.architecture,
    runtime: overrides.runtime != null ? overrides.runtime : base.runtime,
    'dependency versions': overrides['dependency versions'] != null ? overrides['dependency versions'] : base['dependency versions'],
    'GPU/driver': overrides['GPU/driver'] != null ? overrides['GPU/driver'] : (base['GPU/driver'] || null),
    'configuration fingerprint': overrides['configuration fingerprint'] != null ? overrides['configuration fingerprint'] : defaultConfigFingerprint,
    locale: overrides.locale !== undefined ? overrides.locale : base.locale,
    timezone: overrides.timezone !== undefined ? overrides.timezone : base.timezone,
  };
}

/** User-like environment: mirrors the live host's technical fingerprint. */
function userLikeProfile(overrides = {}) {
  return buildProfile('user-like', overrides);
}

/** Clean machine: no user configuration artifacts; locale/timezone omitted. */
function cleanProfile(overrides = {}) {
  return buildProfile('clean', { locale: null, timezone: null, ...overrides });
}

/** Golden environment: reference known-good configuration. */
function goldenProfile(overrides = {}) {
  return buildProfile('golden', overrides);
}

/** Compatibility matrix: groups profile ids by (OS, architecture, kind). */
function compatibilityMatrix(profiles = []) {
  const matrix = {};
  for (const profile of profiles) {
    const check = validateProfile(profile);
    if (!check.valid) continue; // skip invalid entries
    const dimension = `${profile.OS}|${profile.architecture}|${profile.kind}`;
    if (!matrix[dimension]) matrix[dimension] = [];
    matrix[dimension].push(profile.environment_id);
  }
  return matrix;
}

module.exports = {
  PROFILE_KINDS,
  buildProfile,
  cleanProfile,
  compatibilityMatrix,
  goldenProfile,
  userLikeProfile,
  validateProfile,
};