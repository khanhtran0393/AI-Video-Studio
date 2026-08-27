'use strict';

// Milestone 11 — update metadata validation and version comparison.
// Deterministic, no network I/O, no process spawning. All metadata is treated
// as untrusted input (spec section 32).

const MAX_VERSION = 64;
const MAX_URL = 2048;
const MAX_NOTES = 4096;
const SHA256_RE = /^[0-9a-f]{64}$/;
const ALLOWED_ALGORITHMS = ['ed25519'];
const ALLOWED_CHANNELS = ['stable', 'canary'];

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function parseVersion(version) {
  if (!isString(version, MAX_VERSION)) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  if (prerelease !== undefined && /^-|-$/.test(prerelease)) return null;
  return {
    raw: version,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease || null,
  };
}

// Deterministic semver-like comparison without external dependencies.
// Prerelease strings are compared lexicographically; a release is newer than
// any prerelease of the same numeric triple.
function compareVersions(left, right) {
  const a = parseVersion(String(left));
  const b = parseVersion(String(right));
  if (!a || !b) throw new Error(`invalid version for comparison: ${left} / ${right}`);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  if (a.prerelease === b.prerelease) return 0;
  return a.prerelease < b.prerelease ? -1 : 1;
}

function isNewer(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, errors: ['metadata must be an object'] };
  }
  const errors = [];
  if (!isString(metadata.version, MAX_VERSION) || !parseVersion(metadata.version)) {
    errors.push('metadata.version must be a valid semver-like version');
  }
  if (metadata.channel !== undefined && !ALLOWED_CHANNELS.includes(metadata.channel)) {
    errors.push(`metadata.channel must be one of: ${ALLOWED_CHANNELS.join(', ')}`);
  }
  if (!metadata.artifact || typeof metadata.artifact !== 'object' || Array.isArray(metadata.artifact)) {
    errors.push('metadata.artifact must be an object');
  } else {
    const a = metadata.artifact;
    if (!isString(a.filename, 256)) errors.push('metadata.artifact.filename is required (<=256 chars)');
    if (!SHA256_RE.test(String(a.sha256 || ''))) errors.push('metadata.artifact.sha256 must be a 64-char lowercase hex string');
    if (a.bytes !== undefined && (!Number.isInteger(a.bytes) || a.bytes <= 0)) errors.push('metadata.artifact.bytes must be a positive integer');
    if (a.url !== undefined && !isString(a.url, MAX_URL)) errors.push('metadata.artifact.url must be a string (<=2048 chars)');
  }
  if (!metadata.signature || typeof metadata.signature !== 'object' || Array.isArray(metadata.signature)) {
    errors.push('metadata.signature must be an object');
  } else {
    const s = metadata.signature;
    if (!ALLOWED_ALGORITHMS.includes(s.algorithm)) errors.push('metadata.signature.algorithm must be ed25519');
    if (!isString(s.publicKeyPem, 4096)) errors.push('metadata.signature.publicKeyPem is required');
    if (!isString(s.signature, 4096)) errors.push('metadata.signature.signature is required');
  }
  if (metadata.notes !== undefined && !isString(metadata.notes, MAX_NOTES)) {
    errors.push('metadata.notes must be a string (<=4096 chars)');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { parseVersion, compareVersions, isNewer, validateMetadata, ALLOWED_CHANNELS, ALLOWED_ALGORITHMS, MAX_VERSION };