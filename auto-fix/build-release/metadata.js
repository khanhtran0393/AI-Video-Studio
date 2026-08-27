'use strict';

const crypto = require('crypto');

// Milestone 10 — deterministic release metadata (spec sections 25, 26, 32).
// Produces the machine-readable release record a future updater (M11) will
// consume to check version, download, and verify hash/signature. This is
// pure data assembly: no network, no publishing, no signing.

const MAX_VERSION = 64;
const MAX_SHA = 128;
const MAX_ID = 128;
const MAX_URL = 2048;
const MAX_NOTE = 2048;

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Builds a deterministic release metadata document from an artifact + release.
 * Returns { metadata } on success or { errors: [...] } when required fields
 * are missing. The output is intended for the M11 updater contract.
 */
function buildReleaseMetadata({ artifact, release, notes }) {
  const errors = [];
  if (!artifact || typeof artifact !== 'object') errors.push('artifact is required');
  if (!release || typeof release !== 'object') errors.push('release is required');
  if (errors.length) return { metadata: null, errors };

  if (!isString(artifact.version, MAX_VERSION)) errors.push('artifact.version is required');
  if (!isString(artifact.hash, MAX_SHA)) errors.push('artifact.hash is required (sha256)');
  if (!isString(release.release_id, MAX_ID)) errors.push('release.release_id is required');
  if (!isString(release.artifact_id, MAX_ID)) errors.push('release.artifact_id is required');
  if (release.artifact_id !== artifact.artifact_id) {
    errors.push('release.artifact_id does not match artifact.artifact_id');
  }
  if (artifact.signature_metadata !== null && typeof artifact.signature_metadata !== 'object') {
    errors.push('artifact.signature_metadata must be null or an object');
  }

  if (errors.length) return { metadata: null, errors };

  const document = {
    schemaVersion: 1,
    release_id: release.release_id,
    version: artifact.version,
    artifact_id: artifact.artifact_id,
    rollout_state: release.rollout_state,
    canary_percentage: release.canary_percentage ?? 0,
    files: Array.isArray(artifact.files) ? artifact.files.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      sha256: file.sha256,
    })) : [],
    signature: artifact.signature_metadata
      ? {
        algorithm: artifact.signature_metadata.algorithm,
        subject: artifact.signature_metadata.subject,
        artifact_hash: artifact.signature_metadata.artifact_hash,
        public_key_sha256: artifact.signature_metadata.public_key_sha256,
      }
      : null,
    notes: isString(notes, MAX_NOTE) ? notes : null,
  };

  const canonical = JSON.stringify(document, Object.keys(document).sort());
  const documentHash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');

  return {
    metadata: { ...document, release_metadata_sha256: documentHash },
    errors: [],
  };
}

module.exports = { buildReleaseMetadata };