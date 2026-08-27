'use strict';

const assert = require('assert');
const { EventBuffer } = require('../event-buffer');

// Basic size and sequence
const buffer = new EventBuffer({ maxSize: 3, sequenceId: 'seq-1' });
assert.strictEqual(buffer.size, 0);

buffer.record('app_start', { feature: 'editor' });
buffer.record('open_project');
buffer.record('load_file', { path: 'clip.mp4' });
assert.strictEqual(buffer.size, 3);
assert.strictEqual(buffer.snapshot().sequence_id, 'seq-1');
assert.strictEqual(buffer.snapshot().events[0].type, 'app_start');
assert.strictEqual(buffer.snapshot().events[0].seq, 1);

// Ring buffer eviction
buffer.record('exception', { code: 'E1' });
assert.strictEqual(buffer.size, 3);
assert.strictEqual(buffer.snapshot().events[0].type, 'open_project');
assert.strictEqual(buffer.snapshot().events[2].type, 'exception');
assert.strictEqual(buffer.snapshot().events[2].seq, 4);

// Mark final and snapshot includes it
const buffer2 = new EventBuffer({ maxSize: 5 });
buffer2.record('start');
buffer2.record('work');
buffer2.record('error', { msg: 'fail' }, { isFinal: true });
const snap = buffer2.snapshot();
assert.strictEqual(snap.final_failing_event.type, 'error');
assert.strictEqual(snap.final_failing_event.params.msg, 'fail');
assert.strictEqual(snap.final_failing_event.seq, 3);

// markFinal() copies the last event
buffer2.markFinal(); // should overwrite with same last event
assert.strictEqual(buffer2.finalFailingEvent.type, 'error');

// After eviction, final event remains (copy)
buffer2.record('extra1');
buffer2.record('extra2');
buffer2.record('extra3'); // now size > 5? Actually maxSize=5, we have 6 events, so oldest evicted
// The final event (seq 3) is no longer in the buffer, but the copy persists.
const snap2 = buffer2.snapshot();
assert.strictEqual(snap2.final_failing_event.seq, 3);
assert.strictEqual(snap2.final_failing_event.type, 'error');

// Clear resets final
buffer2.clear();
assert.strictEqual(buffer2.size, 0);
assert.strictEqual(buffer2.finalFailingEvent, null);
assert.strictEqual(buffer2.snapshot().final_failing_event, null);

// Snapshot is a copy, not a live reference
const snap3 = buffer2.snapshot();
snap3.events.push({ seq: 99, type: 'injected' });
assert.strictEqual(buffer2.size, 0);

console.log('event-buffer tests: passed');