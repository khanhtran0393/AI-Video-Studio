'use strict';

const path = require('path');
const { EventBuffer } = require('./event-buffer');
const { fingerprintException } = require('./fingerprint');
const { environmentProfile } = require('./environment');
const { LocalQueue } = require('./queue');
const { Uploader, httpsPostJson } = require('./uploader');
const { sanitizeString, sanitizeCrashReport } = require('./sanitizer');

/**
 * Client error reporter. Composes exception capture, a bounded event buffer,
 * an environment fingerprint, a persistent local queue, privacy sanitization
 * and a non-blocking HTTPS uploader. Reporting failures never throw into the
 * host application (spec section 6, rule 8).
 */
class ErrorReporter {
  constructor(options = {}) {
    this.appVersion = options.appVersion || '0.0.0';
    this.buildId = options.buildId || 'dev';
    this.clientInstallationId = options.clientInstallationId || 'unknown';
    const identity = options.releaseIdentity && typeof options.releaseIdentity === 'object'
      ? options.releaseIdentity
      : {};
    this.releaseIdentity = {
      ...(typeof identity.git_commit_sha === 'string' ? { git_commit_sha: identity.git_commit_sha } : {}),
      ...(typeof identity.artifact_sha256 === 'string' ? { artifact_sha256: identity.artifact_sha256 } : {}),
    };
    this.buffer = options.buffer || new EventBuffer({ maxSize: options.eventBufferSize });
    this.queue = options.queue
      || new LocalQueue(options.queueFile || path.join(process.cwd(), 'crash-queue.json'), options.queue);
    this.uploader = options.uploader || null;
    this.environment = options.environment || environmentProfile();
    this._sending = false;
  }

  // Sanitize before recording so no raw sensitive content enters the buffer.
  recordEvent(type, params = {}) {
    const sanitizedParams = sanitizeCrashReport({ params }).params;
    this.buffer.record(type, sanitizedParams);
  }

  captureException(error, extra = {}) {
    const fp = fingerprintException(error);
    // Record the exception event and mark it as the final failing event.
    this.buffer.record('exception', {
      error_type: fp.errorType,
      error_code: fp.errorCode,
      message: fp.normalizedMessage,
      stack_trace: sanitizeString(String((error && (error.stack || error.message)) || ''), { maxStringLength: 8192 }),
    }, { isFinal: true });
    const report = {
      ...extra,
      crash_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      app_version: this.appVersion,
      build_id: this.buildId,
      fingerprint: fp.fingerprint,
      timestamp: new Date().toISOString(),
      error_type: fp.errorType,
      error_code: fp.errorCode,
      module: fp.module,
      message: fp.normalizedMessage,
      stack_trace: sanitizeString(String((error && (error.stack || error.message)) || ''), { maxStringLength: 8192 }),
      environment_id: this.environment.environment_id,
      event_sequence_id: this.buffer.sequenceId,
      sanitized_logs: sanitizeCrashReport(this.buffer.snapshot()),
      client_installation_id: this.clientInstallationId,
      ...this.releaseIdentity,
      status: 'queued',
    };
    return sanitizeCrashReport(report);
  }

  // Capture, sanitize, queue locally, then attempt a background flush.
  // This method never throws: reporting must not break the main application.
  report(error, extra = {}) {
    try {
      const report = this.captureException(error, extra);
      const enqueued = this.queue.enqueue(report);
      if (enqueued.queued && this.uploader) {
        this.flush().catch(() => {});
      }
      return { report, ...enqueued };
    } catch (_) {
      return { queued: false, reason: 'report-failed' };
    }
  }

  async flush() {
    if (this._sending || !this.uploader) return { sent: 0, skipped: 0 };
    this._sending = true;
    try {
      let sent = 0;
      let skipped = 0;
      for (const item of this.queue.peek()) {
        if (!this.queue.allowSend(item.fingerprint)) {
          skipped++;
          continue;
        }
        try {
          await this.uploader.send(item);
          this.queue.markSent(item.fingerprint);
          this.queue.remove(item.id);
          sent++;
        } catch (_) {
          break; // keep the report queued for the next flush
        }
      }
      return { sent, skipped };
    } finally {
      this._sending = false;
    }
  }

  // Install process-level handlers on an injectable emitter (default: process).
  // Returns an uninstall function. Electron currently uses its existing global
  // handlers to preserve host error UX while forwarding reports here.
  installGlobalHandlers(target = process) {
    const uncaught = (error) => { this.report(error); };
    const rejection = (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      err.name = 'UnhandledRejection';
      this.report(err);
    };
    target.on('uncaughtException', uncaught);
    target.on('unhandledRejection', rejection);
    return function uninstall() {
      target.removeListener('uncaughtException', uncaught);
      target.removeListener('unhandledRejection', rejection);
    };
  }
}

module.exports = {
  ErrorReporter,
  EventBuffer,
  LocalQueue,
  Uploader,
  fingerprintException,
  environmentProfile,
  sanitizeString,
  sanitizeCrashReport,
  httpsPostJson,
};