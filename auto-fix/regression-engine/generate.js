'use strict';

const { validateEventSequence } = require('../reproduction-lab/replay');

const MAX_ID = 128;
const MAX_FINGERPRINT = 64;

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function sameEvent(a, b) {
  if (!a || !b) return false;
  if (b.seq !== undefined) return a.seq === b.seq;
  return a.type === b.type;
}

/**
 * Builds a serializable replay_spec from an event sequence. Each event gets a
 * deterministic rule; the final failing event fails with the expected
 * fingerprint and every other event is handled. This is plain data (never a
 * function), so the suite can reconstruct the handler on every run.
 */
function buildReplaySpec(sequence, expectedFingerprint) {
  const failing = sequence.final_failing_event || null;
  return sequence.events.map((event) => {
    const when = { type: event.type };
    if (event.seq !== undefined) when.seq = event.seq;
    const isFailing = failing ? sameEvent(event, failing) : false;
    return isFailing
      ? { when, then: { failed: true, fingerprint: expectedFingerprint } }
      : { when, then: { handled: true } };
  });
}

/**
 * Deterministic regression test generator (spec section 15). Converts a
 * CONFIRMED production bug — bug case, reproduction evidence, optional
 * environment profile, and knowledge — into a permanent, self-contained
 * regression case. A bug with no final failing event is rejected: confirmed
 * reproduction is a hard precondition, never silently skipped.
 */
class RegressionTestGenerator {
  generate(input, now = new Date().toISOString()) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object');
    const bug = input.bug;
    const reproduction = input.reproduction;
    if (!bug || typeof bug !== 'object' || Array.isArray(bug)) throw new Error('bug must be an object');
    if (!reproduction || typeof reproduction !== 'object' || Array.isArray(reproduction)) {
      throw new Error('reproduction must be an object');
    }

    if (!isString(bug.bug_id, MAX_ID)) throw new Error('bug.bug_id is required (<=128 chars)');
    if (!isString(bug.fingerprint, MAX_FINGERPRINT)) throw new Error('bug.fingerprint is required (<=64 chars)');
    if (!isString(reproduction.expected_fingerprint, MAX_FINGERPRINT)) {
      throw new Error('reproduction.expected_fingerprint is required (<=64 chars)');
    }

    const sequence = reproduction.sequence;
    const sequenceCheck = validateEventSequence(sequence);
    if (!sequenceCheck.valid) throw new Error(`reproduction.sequence invalid: ${sequenceCheck.errors.join(', ')}`);

    if (!sequence.final_failing_event) {
      throw new Error('reproduction not confirmed: sequence.final_failing_event is required');
    }

    const regressionId = `REG-${String(bug.bug_id).slice(0, MAX_ID - 4)}`;
    const knowledge = input.knowledge && typeof input.knowledge === 'object' && !Array.isArray(input.knowledge)
      ? input.knowledge
      : {};
    const environment = reproduction.environment && typeof reproduction.environment === 'object' && !Array.isArray(reproduction.environment)
      ? reproduction.environment
      : null;

    return {
      regression_id: regressionId,
      bug_id: bug.bug_id,
      fingerprint: bug.fingerprint,
      source_kind: input.source_kind || 'production-bug',
      source_note: input.source_note || null,
      reproduction: {
        reproduction_id: reproduction.reproduction_id || null,
        sequence_id: sequence.sequence_id || null,
        expected_fingerprint: reproduction.expected_fingerprint,
        sequence,
        environment,
      },
      replay_spec: buildReplaySpec(sequence, reproduction.expected_fingerprint),
      knowledge: {
        summary: knowledge.summary || null,
        root_cause: knowledge.root_cause || null,
        environment_specific: !!knowledge.environment_specific,
      },
      created_at: now,
      updated_at: now,
    };
  }
}

module.exports = { RegressionTestGenerator, buildReplaySpec };