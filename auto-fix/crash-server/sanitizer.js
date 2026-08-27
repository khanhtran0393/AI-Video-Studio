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
  }
  return sanitized && typeof sanitized === 'object' ? sanitized : {};
}

module.exports = { sanitizeReport };