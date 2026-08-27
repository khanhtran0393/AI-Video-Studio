'use strict';

const path = require('path');
const { reconcileReport } = require('./fingerprint');
const { BugCaseStore } = require('./bug-case');
const { EnvironmentProfileStore } = require('./environment-profile');
const { EventSequenceStore } = require('./event-sequence');
const { RepairAttemptStore } = require('./repair-attempt');

/**
 * Bug Intelligence service composing the four master data objects from spec
 * section 5: BugCase, EnvironmentProfile, EventSequence and RepairAttempt.
 * Each optional sub-block of an incoming crash is processed with a safe
 * fallback so a malformed optional payload can never abort case attachment.
 */
class BugIntelligence {
  constructor(options = {}) {
    const base = path.resolve(options.baseDir || '.');
    const audit = options.audit || null;
    this.audit = audit;
    this.bugCases = options.bugCases || new BugCaseStore(options.bugCaseFile || path.join(base, 'bug-cases.json'), { audit });
    this.environments = options.environments || new EnvironmentProfileStore(options.environmentFile || path.join(base, 'environments.json'), { audit });
    this.sequences = options.sequences || new EventSequenceStore(options.sequenceFile || path.join(base, 'sequences.json'), { audit });
    this.repairAttempts = options.repairAttempts || new RepairAttemptStore(options.repairAttemptFile || path.join(base, 'repair-attempts.json'), { audit });
  }

  ingestCrash(crash, now = new Date().toISOString()) {
    const reconciliation = reconcileReport(crash);
    const errors = [];

    // 1) Environment profile (optional; falls back to an id-only touch).
    try {
      const hasEnvironmentObject = crash && crash.environment
        && typeof crash.environment === 'object' && !Array.isArray(crash.environment);
      if (hasEnvironmentObject) {
        this.environments.upsert(crash.environment, now);
      } else if (crash && crash.environment_id) {
        this.environments.touch(crash.environment_id, now);
      }
    } catch (error) {
      errors.push(`environment: ${error.message}`);
    }

    // 2) Event sequence (optional; only stored when an event array is present).
    try {
      if (crash && crash.sanitized_logs && typeof crash.sanitized_logs === 'object'
        && Array.isArray(crash.sanitized_logs.events) && crash.sanitized_logs.events.length) {
        const sequenceId = crash.event_sequence_id
          || crash.sanitized_logs.sequence_id
          || `${reconciliation.canonicalFingerprint}-events`;
        this.sequences.store(sequenceId, crash.sanitized_logs.events, {
          type: 'exception',
          error_type: crash.error_type,
          message: crash.message,
          timestamp: crash.timestamp,
        }, now);
      }
    } catch (error) {
      errors.push(`event-sequence: ${error.message}`);
    }

    // 3) Bug case attachment (core output; failures propagate to the caller).
    const attachment = this.bugCases.attach(crash, now, reconciliation);

    if (this.audit) {
      try {
        this.audit({
          event: 'bug-intelligence-ingest',
          bug_id: attachment.bugId,
          created: attachment.created,
          matchedBy: attachment.matchedBy,
          fingerprint: reconciliation.canonicalFingerprint,
          ...(errors.length ? { errors } : {}),
        });
      } catch (_) {}
    }

    return { reconciliation, attachment, errors };
  }

  stats() {
    return {
      bugCases: this.bugCases.stats(),
      environments: this.environments.stats(),
      sequences: this.sequences.stats(),
      repairAttempts: this.repairAttempts.stats(),
    };
  }
}

module.exports = { BugIntelligence };