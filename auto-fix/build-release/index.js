'use strict';

const path = require('path');
const { describePackaging, validateDescriptor } = require('./packaging');
const { BuildArtifactStore } = require('./artifact');
const { ReleaseStore } = require('./release');
const { buildSigningRequest, buildSignatureMetadata, verifySignature } = require('./signing');
const { buildReleaseMetadata } = require('./metadata');

// Milestone 10 — Build / Release orchestrator (spec sections 20, 21, 22, 32).
// Every mutating operation is deny-by-default: it refuses unless the matching
// authority was explicitly injected as `true` by the caller. The control
// plane NEVER grants these itself, and production policy keeps all of them
// false. This mirrors the milestone pattern used by M5-M9.

const AUTHORITIES = Object.freeze(['build', 'sign', 'release', 'rollout', 'rollback']);

class BuildRelease {
  constructor(options = {}) {
    const base = path.resolve(options.baseDir || '.');
    const audit = options.audit || null;
    this.audit = audit;
    this.authorities = options.authorities || {
      build: false,
      sign: false,
      release: false,
      rollout: false,
      rollback: false,
    };
    this.artifacts = options.artifacts || new BuildArtifactStore(path.join(base, 'build-artifacts.json'), { audit });
    this.releases = options.releases || new ReleaseStore(path.join(base, 'releases.json'), { audit });
    this.repositoryRoot = options.repositoryRoot || path.join(__dirname, '..', '..');
  }

  _denied(authority) {
    return { allowed: false, authority, reason: 'deny-by-default' };
  }

  /**
   * Read-only: describe the intended packaging config. Never builds anything.
   */
  describePackaging(now = new Date().toISOString()) {
    const described = describePackaging(this.repositoryRoot, now);
    described.descriptor.problems = validateDescriptor(described.descriptor);
    return described;
  }

  /**
   * Register a completed build artifact. Requires `build` authority.
   */
  registerArtifact(artifact, now = new Date().toISOString()) {
    if (this.authorities.build !== true) return this._denied('build');
    const stored = this.artifacts.create(artifact, now);
    if (this.audit) this.audit({ event: 'build-release-artifact-registered', artifact_id: stored.artifact_id });
    return { allowed: true, artifact: stored };
  }

  /**
   * Build a signing request + verify a returned signature with a public key.
   * Requires `sign` authority. The private key never enters this control plane.
   */
  integrateSignature({ artifactId, subject, signatureHex, publicKeyPem }, now = new Date().toISOString()) {
    if (this.authorities.sign !== true) return this._denied('sign');
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return { allowed: false, reason: 'artifact-not-found' };
    const request = buildSigningRequest({
      artifactHash: artifact.hash,
      version: artifact.version,
      subject,
    });
    const metadata = buildSignatureMetadata({ request, signatureHex, publicKeyPem });
    const updated = this.artifacts.markSigned(artifactId, metadata, now);
    if (this.audit) this.audit({ event: 'build-release-signature-integrated', artifact_id: artifactId });
    return { allowed: true, request, artifact: updated };
  }

  /**
   * Create a release record for an already-signed artifact. Requires `release`.
   */
  createRelease(release, now = new Date().toISOString()) {
    if (this.authorities.release !== true) return this._denied('release');
    const artifact = this.artifacts.get(release.artifact_id);
    if (!artifact) return { allowed: false, reason: 'artifact-not-found' };
    if (artifact.release_status !== 'signed') return { allowed: false, reason: 'artifact-not-signed' };
    const stored = this.releases.create(release, now);
    if (this.audit) this.audit({ event: 'build-release-release-created', release_id: stored.release_id });
    return { allowed: true, release: stored };
  }

  /**
   * Update rollout state (canary %, stage). Requires `rollout`.
   */
  setRollout(releaseId, patch, now = new Date().toISOString()) {
    if (this.authorities.rollout !== true) return this._denied('rollout');
    const updated = this.releases.setRollout(releaseId, patch, now);
    return { allowed: true, release: updated };
  }

  /**
   * Request or complete a rollback. Requires `rollback`.
   */
  rollback(releaseId, reason, now = new Date().toISOString()) {
    if (this.authorities.rollback !== true) return this._denied('rollback');
    const updated = this.releases.requestRollback(releaseId, reason, now);
    return { allowed: true, release: updated };
  }

  completeRollback(releaseId, now = new Date().toISOString()) {
    if (this.authorities.rollback !== true) return this._denied('rollback');
    const updated = this.releases.completeRollback(releaseId, now);
    return { allowed: true, release: updated };
  }

  /**
   * Build deterministic release metadata for the M11 updater. Read-only.
   */
  buildMetadata(artifactId, releaseId) {
    const artifact = this.artifacts.get(artifactId);
    const release = this.releases.get(releaseId);
    if (!artifact || !release) return { metadata: null, errors: ['artifact or release not found'] };
    return buildReleaseMetadata({ artifact, release });
  }

  stats() {
    return {
      artifacts: this.artifacts.stats(),
      releases: this.releases.stats(),
    };
  }
}

module.exports = { BuildRelease, AUTHORITIES };