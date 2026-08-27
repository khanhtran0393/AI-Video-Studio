'use strict';

const path = require('path');
const { validateMetadata, compareVersions } = require('./metadata');
const { verifySignature, verifyArtifactHash } = require('./verify');
const { Installer } = require('./installer');
const { evaluateHealth } = require('./health-check');
const { UpdateHistory } = require('./history');

// Milestone 11 — Updater orchestrator (spec section 25). Deterministic,
// disconnected, deny-by-default. Full lifecycle:
//   version check -> download-model staging -> hash verify -> signature verify
//   -> safe-stop (recorded) -> backup -> install -> health check -> rollback.
// It never spawns processes, performs no network I/O, and mutates only the
// caller-provided installRoot sandbox and the update history file.

class UpdaterEngine {
  constructor(options = {}) {
    const base = path.resolve(options.baseDir || '.');
    this.history = options.history
      || new UpdateHistory(options.historyFile || path.join(base, 'update-history.json'), { audit: options.audit || null });
    this.installer = options.installer || new Installer(options.installRoot || path.join(base, 'update-install'));
    this.audit = options.audit || null;
  }

  checkForUpdate(metadata, currentVersion) {
    const validation = validateMetadata(metadata);
    if (!validation.valid) {
      return { status: 'BLOCKED', reason: `invalid-metadata: ${validation.errors.join('; ')}`, updateAvailable: false };
    }
    let updateAvailable = false;
    try {
      updateAvailable = compareVersions(metadata.version, currentVersion) > 0;
    } catch (_) {
      return { status: 'BLOCKED', reason: 'invalid-current-version', updateAvailable: false };
    }
    return {
      status: 'OK',
      reason: null,
      updateAvailable,
      currentVersion,
      targetVersion: metadata.version,
      channel: metadata.channel || 'stable',
    };
  }

  runUpdate({ metadata, currentVersion, artifactPath, healthProbes, attemptId }, now = new Date().toISOString()) {
    const decision = this.checkForUpdate(metadata, currentVersion);
    if (decision.status !== 'OK' || !decision.updateAvailable) {
      this.history.recordAttempt({
        attempt_id: attemptId,
        from_version: currentVersion,
        to_version: metadata && metadata.version ? metadata.version : null,
        status: decision.status,
        reason: decision.reason,
      }, now);
      return { status: decision.status, phase: 'version-check', reason: decision.reason, decision };
    }

    // 1. Download-model: stage the artifact and verify hash + size.
    let staged;
    try {
      staged = this.installer.stageArtifact(artifactPath, metadata.artifact.filename);
      const hashCheck = verifyArtifactHash(staged, metadata.artifact.sha256, metadata.artifact.bytes);
      if (!hashCheck.ok) {
        this.history.recordAttempt({
          attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
          status: 'FAIL', reason: hashCheck.reason,
        }, now);
        return { status: 'FAIL', phase: 'hash-verification', reason: hashCheck.reason, detail: hashCheck };
      }
    } catch (error) {
      this.history.recordAttempt({
        attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
        status: 'FAIL', reason: 'download-stage-failed',
      }, now);
      return { status: 'FAIL', phase: 'download', reason: `download-stage-failed: ${String((error && error.message) || error)}` };
    }

    // 2. Signature verification — fail-closed.
    let signatureOk;
    try {
      signatureOk = verifySignature({
        version: metadata.version,
        sha256: metadata.artifact.sha256,
        algorithm: metadata.signature.algorithm,
        publicKeyPem: metadata.signature.publicKeyPem,
        signature: metadata.signature.signature,
      });
    } catch (error) {
      signatureOk = false;
      this.audit && this.audit({ event: 'update-signature-error', error: String((error && error.message) || error).slice(0, 256) });
    }
    if (!signatureOk) {
      this.history.recordAttempt({
        attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
        status: 'FAIL', reason: 'signature-verification-failed',
      }, now);
      return { status: 'FAIL', phase: 'signature-verification', reason: 'signature-verification-failed' };
    }

    // 3. Safe-stop is modeled as a lifecycle transition; install proceeds via
    //    backup (previous) -> stage (current) so rollback is always possible.
    let commitResult;
    try {
      this.installer.prepareBackup(now);
      commitResult = this.installer.commit(staged, now);
    } catch (error) {
      let restored = null;
      try { restored = this.installer.rollback(now); } catch (_) {}
      this.history.recordAttempt({
        attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
        status: 'FAIL', reason: 'install-failed',
      }, now);
      this.history.recordIncident({ reason: 'install-failed', to_version: metadata.version, restored_version: currentVersion }, now);
      return { status: 'FAIL', phase: 'install', reason: `install-failed: ${String((error && error.message) || error)}`, restored };
    }

    // 4. Post-update health check — fail-closed.
    const health = evaluateHealth(healthProbes, now);
    if (health.status === 'PASS') {
      this.history.recordAttempt({
        attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
        status: 'PASS', reason: null,
      }, now);
      return { status: 'PASS', phase: 'health-check', reason: null, commitResult, health };
    }

    // 5. Automatic rollback on health failure.
    let restored;
    try {
      restored = this.installer.rollback(now);
    } catch (rollbackError) {
      this.history.recordAttempt({
        attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
        status: 'FAIL', reason: 'rollback-failed',
      }, now);
      this.history.recordIncident({ reason: 'rollback-failed', to_version: metadata.version, restored_version: currentVersion }, now);
      return { status: 'FAIL', phase: 'rollback', reason: `rollback-failed: ${String((rollbackError && rollbackError.message) || rollbackError)}`, health };
    }

    this.history.recordAttempt({
      attempt_id: attemptId, from_version: currentVersion, to_version: metadata.version,
      status: 'ROLLED-BACK', reason: health.reason,
    }, now);
    this.history.recordIncident({ reason: health.reason, to_version: metadata.version, restored_version: currentVersion }, now);
    return { status: 'ROLLED-BACK', phase: 'health-check', reason: health.reason, health, restored };
  }

  stats() {
    return { history: this.history.stats() };
  }
}

module.exports = { UpdaterEngine };