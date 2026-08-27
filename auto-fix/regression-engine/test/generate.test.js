'use strict';

const assert = require('assert');
const { RegressionTestGenerator, buildReplaySpec } = require('../generate');

const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'null_ref' };
const sequence = {
  sequence_id: 'seq-gen-1',
  events: [
    { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
    failingEvent,
  ],
  final_failing_event: failingEvent,
};

const generator = new RegressionTestGenerator();

const definition = generator.generate({
  bug: { bug_id: 'BUG-42', fingerprint: 'fp-42' },
  reproduction: {
    reproduction_id: 'rep-42',
    expected_fingerprint: 'fp-42',
    sequence,
    environment: { environment_id: 'env-42', kind: 'user-like' },
  },
  knowledge: { summary: 'null pointer on load', root_cause: 'unchecked handle', environment_specific: true },
  source_note: 'acceptance regression',
});

assert.strictEqual(definition.regression_id, 'REG-BUG-42');
assert.strictEqual(definition.bug_id, 'BUG-42');
assert.strictEqual(definition.fingerprint, 'fp-42');
assert.strictEqual(definition.source_kind, 'production-bug');
assert.strictEqual(definition.reproduction.expected_fingerprint, 'fp-42');
assert.deepStrictEqual(definition.reproduction.sequence, sequence);
assert.strictEqual(definition.replay_spec.length, 2);
assert.deepStrictEqual(definition.replay_spec[0].then, { handled: true });
assert.deepStrictEqual(definition.replay_spec[1].then, { failed: true, fingerprint: 'fp-42' });
assert.strictEqual(definition.knowledge.environment_specific, true);

// missing final_failing_event must be rejected (reproduction not confirmed)
assert.throws(() => generator.generate({
  bug: { bug_id: 'BUG-43', fingerprint: 'fp-43' },
  reproduction: {
    expected_fingerprint: 'fp-43',
    sequence: {
      sequence_id: 'seq-43',
      events: [{ seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' }],
    },
  },
}), /final_failing_event/);

// invalid sequence must be rejected
assert.throws(() => generator.generate({
  bug: { bug_id: 'BUG-44', fingerprint: 'fp-44' },
  reproduction: { expected_fingerprint: 'fp-44', sequence: { sequence_id: 'x', events: 'nope', final_failing_event: {} } },
}), /sequence invalid/);

// missing bug_id must be rejected
assert.throws(() => generator.generate({
  bug: { fingerprint: 'fp-45' },
  reproduction: { expected_fingerprint: 'fp-45', sequence },
}), /bug\.bug_id/);

// buildReplaySpec is deterministic and serializable
const spec = buildReplaySpec(sequence, 'fp-x');
assert.deepStrictEqual(JSON.parse(JSON.stringify(spec)), spec);

console.log('generate tests: passed');