'use strict';

const { redact, redactString } = require('../redaction');

/**
 * Server-side sanitization (defense-in-depth). The M2 client already redacts
 * before upload, but a compromised or buggy client cannot be trusted, so the
 * server re-runs the shared redaction pass on every accepted report.
 */
function sanitizeReport(report) {
  const sanitized = redact(report, { maxDepth: 8, maxStringLength: 16384, maxItems: 256 });
  if (sanitized && typeof sanitized === 'object') {
    if (typeof sanitized.stack_trace === 'string') {
      sanitized.stack_trace = redactString(sanitized.stack_trace, { maxStringLength: 16384 });
    }
    if (typeof report.fingerprint === 'string' && /^[0-9a-f]{16,64}$/i.test(report.fingerprint)) sanitized.fingerprint = report.fingerprint.toLowerCase();
    if (typeof report.git_commit_sha === 'string' && /^[0-9a-f]{40,64}$/i.test(report.git_commit_sha)) sanitized.git_commit_sha = report.git_commit_sha.toLowerCase();
    if (typeof report.artifact_sha256 === 'string' && /^[0-9a-f]{64}$/i.test(report.artifact_sha256)) sanitized.artifact_sha256 = report.artifact_sha256.toLowerCase();
  }
  return sanitized && typeof sanitized === 'object' ? sanitized : {};
}

module.exports = { sanitizeReport };