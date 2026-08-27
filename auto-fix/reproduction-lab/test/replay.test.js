'use strict';

const assert = require('assert');
const { ReplayEngine, validateEventSequence } = require('../replay');

function sequence(events, finalFailingEvent = null) {
  return { sequence_id: 'seq-1', events, final_failing_event: finalFailingEvent };
}

const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'divide_by_zero', params: { a: 1, b: 0 } };
const engine = new ReplayEngine();

// Reproduced: handler reaches the failing event and the fingerprint matches.
{
  const result = engine.replay(
    sequence(
      [
        { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
        failingEvent,
        { seq: 3, ts: '2026-01-01T00:00:03.000Z', type: 'finish' },
      ],
      failingEvent,
    ),
    (event) => (event.seq === 2 ? { failed: true, fingerprint: 'fp-1' } : { handled: true }),
    { expectedFingerprint: 'fp-1' },
  );
  assert.strictEqual(result.status, 'reproduced');
  assert.strictEqual(result.fingerprint_matches, true);
  assert.strictEqual(result.final_failing_event_reached, true);
  assert.strictEqual(result.events_replayed, 2, 'replay must stop at the failing event');
}

// Crash without a fingerprint -> not reproduced.
{
  const result = engine.replay(sequence([failingEvent], failingEvent), () => ({ failed: true }), {});
  assert.strictEqual(result.status, 'not-reproduced');
  assert.strictEqual(result.fingerprint_matches, false);
}

// Wrong expected fingerprint -> not reproduced.
{
  const result = engine.replay(
    sequence([failingEvent], failingEvent),
    () => ({ failed: true, fingerprint: 'other' }),
    { expectedFingerprint: 'fp-1' },
  );
  assert.strictEqual(result.status, 'not-reproduced');
  assert.strictEqual(result.matched_fingerprint, 'other');
}

// Invalid sequence and handler fail closed.
{
  assert.strictEqual(engine.replay({ nope: true }, () => ({})).status, 'invalid-sequence');
  assert.strictEqual(engine.replay(sequence([failingEvent]), null).status, 'invalid-handler');
}

// Events replay in timestamp order regardless of input order.
{
  const order = [];
  const result = engine.replay(
    sequence([
      { seq: 3, ts: '2026-01-01T00:00:03.000Z', type: 'c' },
      { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'a' },
      { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'b' },
    ]),
    (event) => { order.push(event.type); return { handled: true }; },
  );
  assert.deepStrictEqual(order, ['a', 'b', 'c']);
  assert.strictEqual(result.status, 'not-reproduced');
}

// A throwing handler is contained, never propagated.
{
  const result = engine.replay(sequence([failingEvent], failingEvent), () => { throw new Error('boom'); });
  assert.strictEqual(result.status, 'not-reproduced');
  assert.strictEqual(result.failures.length, 1);
}

// Truncation when an engine's maxEvents is lower than the sequence length.
{
  const small = new ReplayEngine({ maxEvents: 2 });
  const result = small.replay(
    sequence([
      { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'a' },
      { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'b' },
      { seq: 3, ts: '2026-01-01T00:00:03.000Z', type: 'c' },
    ]),
    () => ({ handled: true }),
  );
  assert.strictEqual(result.status, 'truncated');
  assert.strictEqual(result.total_events, 3);
}

assert.strictEqual(validateEventSequence({ sequence_id: 's', events: [] }).valid, true);
assert.strictEqual(validateEventSequence(null).valid, false);
assert.strictEqual(validateEventSequence({ sequence_id: 's', events: 'nope' }).valid, false);

console.log('replay tests: passed');