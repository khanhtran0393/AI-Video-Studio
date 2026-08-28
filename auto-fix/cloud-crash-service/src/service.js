'use strict';

const { validateCrashReport } = require('./crash-schema');
const { sanitizeReport } = require('./crash-sanitizer');
const { serverFingerprint, validClientFingerprint } = require('./crash-fingerprint');
const { pseudonymizeInstallation } = require('./security');

class CrashJobService {
  constructor(options) {
    this.store = options.store;
    this.devicePepper = options.devicePepper;
    this.leaseSeconds = Number.isInteger(options.leaseSeconds) && options.leaseSeconds > 0
      ? options.leaseSeconds : 120;
    this.clock = options.clock || (() => new Date());
  }

  async ingest(report) {
    const validation = validateCrashReport(report);
    if (!validation.valid) return { ok: false, status: 400, body: { error: 'invalid-report', details: validation.errors } };
    const sanitized = sanitizeReport(report);
    const clientFingerprint = validClientFingerprint(report.fingerprint) ? report.fingerprint.toLowerCase() : null;
    const fingerprint = serverFingerprint(report);
    sanitized.fingerprint = fingerprint;
    sanitized.client_fingerprint = clientFingerprint;
    delete sanitized.client_installation_id;
    const receivedAt = this.clock().toISOString();
    const result = await this.store.ingestCrash({
      report: sanitized,
      clientFingerprint,
      fingerprint,
      deviceHash: pseudonymizeInstallation(report.client_installation_id, this.devicePepper),
      receivedAt,
    });
    return {
      ok: true,
      status: result.duplicateCrash || result.deduplicated ? 200 : 201,
      body: {
        crash_id: result.crashId, bug_id: result.bugId, status: 'ingested',
        duplicate_crash: result.duplicateCrash, deduplicated: result.deduplicated,
        job_created: result.jobCreated,
      },
    };
  }

  claim(workerId) {
    return this.store.claimJob({ workerId, leaseSeconds: this.leaseSeconds, now: this.clock().toISOString() });
  }
  heartbeat(jobId, leaseToken) {
    return this.store.heartbeat({ jobId, leaseToken, leaseSeconds: this.leaseSeconds, now: this.clock().toISOString() });
  }
  complete(jobId, leaseToken, result) {
    return this.store.complete({ jobId, leaseToken, result, now: this.clock().toISOString() });
  }
  fail(jobId, leaseToken, error, retryable) {
    return this.store.fail({ jobId, leaseToken, error, retryable, now: this.clock().toISOString() });
  }
}

module.exports = { CrashJobService };
