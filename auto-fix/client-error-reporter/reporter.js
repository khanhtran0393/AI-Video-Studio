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
    this.flushIntervalMs = options.flushIntervalMs != null ? options.flushIntervalMs : 30 * 1000;
    this.retryBaseMs = options.retryBaseMs != null ? options.retryBaseMs : 5 * 1000;
    this.retryMaxMs = options.retryMaxMs != null ? options.retryMaxMs : 5 * 60 * 1000;
    this._flushPromise = null;
    this._timer = null;
    this._failureCount = 0;
    this._lifecycleActive = false;
    this._lifecycleCleanup = null;
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
      ...(fp.errorCode ? { error_code: fp.errorCode } : {}),
      ...(fp.module ? { module: fp.module } : {}),
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

  flush() {
    if (!this.uploader) return Promise.resolve({ sent: 0, skipped: 0, failed: 0 });
    if (this._flushPromise) return this._flushPromise;
    this._flushPromise = (async () => {
      let sent = 0;
      let skipped = 0;
      let failed = 0;
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
        } catch (error) {
          failed++;
          if (error && error.retryable === false) {
            // A malformed/unauthorized report cannot recover by waiting. Drop it
            // so it cannot permanently block newer reports in the FIFO queue.
            this.queue.remove(item.id);
            continue;
          }
          break; // transient failure: retain current and later reports
        }
      }
      this._failureCount = failed ? this._failureCount + 1 : 0;
      return { sent, skipped, failed };
    })().finally(() => { this._flushPromise = null; });
    return this._flushPromise;
  }

  _schedule(delayMs) {
    if (!this.uploader || !this._lifecycleActive || this._timer) return;
    this._timer = setTimeout(async () => {
      this._timer = null;
      const result = await this.flush().catch(() => ({ failed: 1 }));
      const failures = result && result.failed ? this._failureCount : 0;
      const delay = failures
        ? Math.min(this.retryBaseMs * Math.pow(2, Math.max(0, failures - 1)), this.retryMaxMs)
        : this.flushIntervalMs;
      this._schedule(delay);
    }, Math.max(0, Number(delayMs) || 0));
    if (this._timer && typeof this._timer.unref === 'function') this._timer.unref();
  }

  startLifecycle(options = {}) {
    if (!this.uploader) return () => {};
    this.stopLifecycle();
    this._lifecycleActive = true;
    const networkTarget = options.networkTarget;
    const onlineEvent = options.onlineEvent || 'online';
    const onOnline = () => { this.flush().catch(() => {}); };
    if (networkTarget && typeof networkTarget.on === 'function') networkTarget.on(onlineEvent, onOnline);
    this._schedule(0);
    const cleanup = () => {
      this._lifecycleActive = false;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (networkTarget && typeof networkTarget.removeListener === 'function') networkTarget.removeListener(onlineEvent, onOnline);
    };
    this._lifecycleCleanup = cleanup;
    return cleanup;
  }

  stopLifecycle() {
    if (this._lifecycleCleanup) this._lifecycleCleanup();
    this._lifecycleCleanup = null;
  }

  async shutdown(timeoutMs = 2000) {
    this.stopLifecycle();
    if (!this.uploader) return { sent: 0, skipped: 0, failed: 0 };
    let timer = null;
    try {
      return await Promise.race([
        this.flush(),
        new Promise((resolve) => { timer = setTimeout(() => resolve({ sent: 0, skipped: 0, failed: 0, timedOut: true }), Math.max(0, timeoutMs)); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
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