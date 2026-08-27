'use strict';

const MAX_EVENTS = 200;

function isTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * Validates an EventSequence (spec section 5): ordered events, timestamps,
 * sanitized parameters, and an optional final failing event.
 */
function validateEventSequence(sequence) {
  if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) {
    return { valid: false, errors: ['sequence must be an object'] };
  }
  const errors = [];
  if (!Object.prototype.hasOwnProperty.call(sequence, 'sequence_id')
    || typeof sequence.sequence_id !== 'string' || sequence.sequence_id.length === 0) {
    errors.push('sequence_id must be a non-empty string');
  }
  if (!Array.isArray(sequence.events)) {
    errors.push('events must be an array');
  } else if (sequence.events.length > MAX_EVENTS) {
    errors.push(`events must contain <= ${MAX_EVENTS} events`);
  } else {
    sequence.events.forEach((event, index) => {
      if (!event || typeof event !== 'object') errors.push(`events[${index}] must be an object`);
      else {
        if (event.type === undefined) errors.push(`events[${index}].type is required`);
        if (event.seq !== undefined && !Number.isInteger(event.seq)) errors.push(`events[${index}].seq must be an integer`);
        if (event.ts !== undefined && !isTimestamp(event.ts)) errors.push(`events[${index}].ts must be an ISO-8601 parseable string`);
      }
    });
  }
  if (sequence.final_failing_event !== undefined && sequence.final_failing_event !== null
    && typeof sequence.final_failing_event !== 'object') {
    errors.push('final_failing_event must be an object');
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

function sameEvent(a, b) {
  if (!a || !b) return false;
  if (b.seq !== undefined) return a.seq === b.seq;
  return a.type === b.type;
}

/**
 * Deterministic in-process replay engine. It never spawns a process and never
 * touches the network; it drives a caller-supplied handler(event, context)
 * function so the lab remains sandboxed by construction.
 *
 * Handler contract:
 *   return { handled: true }                       -> event processed, continue
 *   return { failed: true, fingerprint }           -> crash at this event, stop
 *   throw                                          -> treated as a crash, stop
 */
class ReplayEngine {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents != null ? options.maxEvents : MAX_EVENTS;
    this.audit = options.audit || null;
  }

  replay(sequence, handler, options = {}) {
    if (typeof handler !== 'function') {
      return {
        status: 'invalid-handler',
        sequence_id: sequence && sequence.sequence_id,
        errors: ['handler must be a function'],
        events_replayed: 0,
      };
    }

    const validation = validateEventSequence(sequence);
    if (!validation.valid) {
      return {
        status: 'invalid-sequence',
        sequence_id: sequence && sequence.sequence_id,
        errors: validation.errors,
        events_replayed: 0,
      };
    }

    const started = Date.now();
    const ordered = [...sequence.events].sort((a, b) => {
      const aTs = Date.parse(a.ts);
      const bTs = Date.parse(b.ts);
      const aKey = Number.isFinite(aTs) ? aTs : 0;
      const bKey = Number.isFinite(bTs) ? bTs : 0;
      if (aKey !== bKey) return aKey - bKey;
      return (a.seq || 0) - (b.seq || 0);
    });

    if (ordered.length > this.maxEvents) {
      return {
        status: 'truncated',
        sequence_id: sequence.sequence_id,
        errors: [`sequence has ${ordered.length} events but maxEvents is ${this.maxEvents}`],
        events_replayed: 0,
        total_events: ordered.length,
      };
    }

    let eventsReplayed = 0;
    let matchedFingerprint = null;
    let finalFailingEventReached = false;
    const failures = [];
    const context = { sequence_id: sequence.sequence_id };

    for (const event of ordered) {
      let outcome;
      try {
        outcome = handler(event, context) || {};
      } catch (error) {
        outcome = { failed: true, reason: String((error && error.message) || error).slice(0, 256) };
      }
      eventsReplayed += 1;
      if (outcome.fingerprint) matchedFingerprint = outcome.fingerprint;
      if (outcome.failed === true) {
        failures.push({ type: event.type, seq: event.seq, reason: outcome.reason || null });
        if (sameEvent(event, sequence.final_failing_event)) finalFailingEventReached = true;
        break;
      }
      if (outcome.handled === false) {
        failures.push({ type: event.type, seq: event.seq, reason: outcome.reason || 'unhandled' });
      }
    }

    const expected = options.expectedFingerprint;
    const fingerprintMatches = expected ? matchedFingerprint === expected : Boolean(matchedFingerprint);
    const status = fingerprintMatches ? 'reproduced' : 'not-reproduced';

    const result = {
      status,
      sequence_id: sequence.sequence_id,
      events_replayed: eventsReplayed,
      total_events: ordered.length,
      matched_fingerprint: matchedFingerprint,
      expected_fingerprint: expected || null,
      fingerprint_matches: fingerprintMatches,
      final_failing_event_reached: finalFailingEventReached,
      failures,
      duration_ms: Date.now() - started,
    };

    if (this.audit) {
      this.audit({ event: 'replay-completed', sequence_id: sequence.sequence_id, status, events_replayed: eventsReplayed });
    }
    return result;
  }
}

module.exports = { ReplayEngine, validateEventSequence, MAX_EVENTS };