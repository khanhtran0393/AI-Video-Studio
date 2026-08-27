'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventSequenceStore } = require('../event-sequence');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'event-seq-'));
try {
  const file = path.join(temp, 'seqs.json');
  const store = new EventSequenceStore(file);

  const events = [
    { seq: 1, ts: '2024-01-01T00:00:00Z', type: 'start', params: { user: 'test' } },
    { seq: 2, ts: '2024-01-01T00:00:01Z', type: 'operation', params: { op: 'open' } },
  ];
  const final = { type: 'exception', error_type: 'TypeError', message: 'boom', timestamp: '2024-01-01T00:00:02Z' };

  const stored = store.store('seq-123', events, final);
  assert.strictEqual(stored.sequence_id, 'seq-123');
  assert.strictEqual(stored.events.length, 2);
  assert.strictEqual(stored.event_count, 2);
  assert.strictEqual(stored.final_failing_event.type, 'exception');
  assert.strictEqual(stored.final_failing_event.message, 'boom');

  // Get
  const retrieved = store.get('seq-123');
  assert.strictEqual(retrieved.sequence_id, 'seq-123');
  assert.strictEqual(retrieved.events[0].type, 'start');

  // Append final event to existing sequence
  const newFinal = { type: 'error', error_type: 'RangeError', message: 'out of range' };
  const updated = store.appendFinalEvent('seq-123', newFinal);
  assert.strictEqual(updated.final_failing_event.type, 'error');
  assert.strictEqual(updated.final_failing_event.message, 'out of range');

  // Non-existent sequence throws
  assert.throws(() => store.appendFinalEvent('missing', {}), /sequence not found/);

  // List and stats
  const list = store.list();
  assert.strictEqual(list.length, 1);
  const stats = store.stats();
  assert.strictEqual(stats.sequences, 1);
  assert.strictEqual(stats.totalEvents, 2);

  // Cap event count
  const manyEvents = Array.from({ length: 250 }, (_, i) => ({ seq: i }));
  assert.throws(() => store.store('overflow', manyEvents), /exceed cap/);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('event-sequence tests: passed');