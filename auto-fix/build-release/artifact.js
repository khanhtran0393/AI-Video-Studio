'use strict';

const { JsonStore, isString } = require('../bug-intelligence/store');

// Milestone 10 - BuildArtifact master data object (spec section 5).
// Artifacts are immutable once created: there is intentionally NO delete and
// NO mutable update API, so a release can never silently point at a changed
// artifact. Signature metadata is recorded but the private key is never seen.

const MAX_ID = 128;
const MAX_VERSION = 64;
const MAX_SHA = 128;
const MAX_PATH_LENGTH = 512;
const MAX_FILES = 64;
const MAX_METADATA_BYTES = 4096;
const ARTIFACT_STATUSES = ['unsigned', 'signing-requested', 'signed', 'released', 'rejected'];
const FILE_STATUSES = ['complete', 'missing', 'hash-mismatch'];

function emptyData() {
  return { schemaVersion: 1, artifacts: {} };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSha(value) {
  if (value === null || value === undefined) return null;
  if (!isString(value, MAX_SHA) || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('sha256 must be a 64-char hex string');
  }
  return value.toLowerCase();
}

function normalizeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('files must be a non-empty array');
  const out = [];
  for (let i = 0; i < files.length; i += 1) {
    const item = files[i];
    if (!isObject(item)) throw new Error(`files[${i}] must be an object`);
    if (!isString(item.path, MAX_PATH_LENGTH)) throw new Error(`files[${i}].path is required`);
    const status = item.status || 'complete';
    if (!FILE_STATUSES.includes(status)) throw new Error(`files[${i}].status is invalid`);
    out.push({
      path: item.path,
      bytes: Number.isInteger(item.bytes) && item.bytes >= 0 ? item.bytes : null,
      sha256: normalizeSha(item.sha256),
      status,
    });
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

class BuildArtifactStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  create(artifact, now = new Date().toISOString()) {
    if (!isObject(artifact)) throw new Error('artifact must be an object');
    if (!isString(artifact.artifact_id, MAX_ID)) throw new Error('artifact_id is required (<=128 chars)');
    if (!isString(artifact.version, MAX_VERSION)) throw new Error('version is required (<=64 chars)');
    if (artifact.git_commit !== null && artifact.git_commit !== undefined
      && !(typeof artifact.git_commit === 'string' && /^[0-9a-f]{7,64}$/i.test(artifact.git_commit))) {
      throw new Error('git_commit must be null or a hex commit (7-64 chars)');
    }
    const status = ARTIFACT_STATUSES.includes(artifact.status) ? artifact.status : 'unsigned';
    const db = this.read();
    if (db.artifacts[artifact.artifact_id]) throw new Error(`artifact already exists: ${artifact.artifact_id}`);

    const signatureMetadata = isObject(artifact.signature_metadata) ? artifact.signature_metadata : null;
    const entry = {
      artifact_id: artifact.artifact_id,
      version: artifact.version,
      git_commit: artifact.git_commit || null,
      build_id: isString(artifact.build_id, MAX_ID) ? artifact.build_id : null,
      hash: normalizeSha(artifact.hash),
      files: normalizeFiles(artifact.files),
      signature_metadata: signatureMetadata ? JSON.parse(JSON.stringify(signatureMetadata)) : null,
      download_location: typeof artifact.download_location === 'string'
        ? artifact.download_location.slice(0, MAX_PATH_LENGTH)
        : null,
      release_status: status,
      created_at: now,
      updated_at: now,
    };

    const encoded = JSON.stringify(entry);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_METADATA_BYTES) {
      throw new Error(`artifact metadata exceeds ${MAX_METADATA_BYTES} bytes`);
    }

    db.artifacts[entry.artifact_id] = entry;
    this.write(db);
    this.auditEvent('build-artifact-created', { artifact_id: entry.artifact_id, version: entry.version, status });
    return JSON.parse(JSON.stringify(entry));
  }

  markSigned(artifactId, signatureMetadata, now = new Date().toISOString()) {
    if (!isString(artifactId, MAX_ID)) throw new Error('artifact_id is required');
    if (!isObject(signatureMetadata)) throw new Error('signature_metadata must be an object');
    const db = this.read();
    const entry = db.artifacts[artifactId];
    if (!entry) throw new Error('artifact not found');
    if (entry.release_status === 'released') throw new Error('a released artifact is immutable');
    entry.signature_metadata = JSON.parse(JSON.stringify(signatureMetadata));
    entry.release_status = 'signed';
    entry.updated_at = now;
    this.write(db);
    this.auditEvent('build-artifact-signed', { artifact_id: artifactId });
    return JSON.parse(JSON.stringify(entry));
  }

  markReleased(artifactId, now = new Date().toISOString()) {
    if (!isString(artifactId, MAX_ID)) throw new Error('artifact_id is required');
    const db = this.read();
    const entry = db.artifacts[artifactId];
    if (!entry) throw new Error('artifact not found');
    if (entry.release_status !== 'signed') throw new Error('only a signed artifact can be released');
    entry.release_status = 'released';
    entry.updated_at = now;
    this.write(db);
    this.auditEvent('build-artifact-released', { artifact_id: artifactId });
    return JSON.parse(JSON.stringify(entry));
  }

  get(artifactId) {
    const entry = this.read().artifacts[artifactId];
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }

  listByVersion(version) {
    return JSON.parse(JSON.stringify(Object.values(this.read().artifacts)
      .filter((entry) => entry.version === version)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))));
  }

  stats() {
    const artifacts = Object.values(this.read().artifacts);
    const byStatus = {};
    for (const status of ARTIFACT_STATUSES) byStatus[status] = 0;
    for (const entry of artifacts) byStatus[entry.release_status] = (byStatus[entry.release_status] || 0) + 1;
    return { artifacts: artifacts.length, byStatus };
  }
}

module.exports = { BuildArtifactStore, ARTIFACT_STATUSES, FILE_STATUSES };