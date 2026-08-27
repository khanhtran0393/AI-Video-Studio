'use strict';

const { redact } = require('../redaction');

const LIMITS = Object.freeze({ maxSourceExcerpts: 32, maxHistoryEntries: 64 });

const REQUIRED_CRASH_FIELDS = ['crash_id', 'fingerprint', 'error_type', 'message'];

function boundText(value, max) {
  const str = String(value == null ? '' : value);
  return str.length > max ? `${str.slice(0, max)}…[TRUNCATED]` : str;
}

/**
 * Build a bounded, redacted agent context from a crash record plus optional
 * environment/event-sequence data and pre-fetched source/history excerpts.
 * This is the ONLY data the agent may reason over: it never reads the live
 * filesystem or spawns processes itself (spec sections 6, 9, 11, 28).
 */
function buildContext({ crash, environment = null, eventSequence = null, sourceExcerpts = [], historyEntries = [], policy }) {
  if (!crash || typeof crash !== 'object' || Array.isArray(crash)) {
    return { valid: false, errors: ['crash must be an object'], context: null };
  }
  const missing = REQUIRED_CRASH_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(crash, field));
  if (missing.length) {
    return { valid: false, errors: missing.map((field) => `missing crash field: ${field}`), context: null };
  }

  const maxString = (policy && policy.limits && Number.isInteger(policy.limits.maxEvidenceStringLength))
    ? policy.limits.maxEvidenceStringLength : 1024;
  const safeCrash = redact(crash, { maxStringLength: maxString, maxItems: 64, maxDepth: 8 });

  const bug = {
    crash_id: boundText(safeCrash.crash_id, 128),
    fingerprint: boundText(safeCrash.fingerprint, 64),
    error_type: boundText(safeCrash.error_type, 128),
    message: boundText(safeCrash.message, 4096),
    stack_trace: boundText(safeCrash.stack_trace, 16384),
    app_version: boundText(safeCrash.app_version, 64),
    build_id: boundText(safeCrash.build_id, 64),
    timestamp: boundText(safeCrash.timestamp, 64),
    environment_id: boundText(safeCrash.environment_id, 128),
    event_sequence_id: boundText(safeCrash.event_sequence_id, 128),
  };

  const source = (Array.isArray(sourceExcerpts) ? sourceExcerpts : [])
    .slice(0, LIMITS.maxSourceExcerpts)
    .map((item) => ({
      path: boundText(item && item.path, 512),
      content: redact(boundText(item && item.content, maxString), { maxStringLength: maxString }),
    }));

  const history = (Array.isArray(historyEntries) ? historyEntries : [])
    .slice(0, LIMITS.maxHistoryEntries)
    .map((item) => ({
      commit: boundText(item && item.commit, 64),
      author: boundText(item && item.author, 128),
      date: boundText(item && item.date, 64),
      message: boundText(item && item.message, 1024),
      diff: redact(boundText(item && item.diff, maxString), { maxStringLength: maxString }),
    }));

  const context = {
    schemaVersion: 1,
    bug,
    environment: environment ? redact(environment, { maxStringLength: maxString, maxItems: 64, maxDepth: 8 }) : null,
    eventSequence: eventSequence ? redact(eventSequence, { maxStringLength: maxString, maxItems: 64, maxDepth: 8 }) : null,
    source,
    history,
  };

  return { valid: true, errors: [], context };
}

module.exports = { buildContext, LIMITS };