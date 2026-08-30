'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LocalQueue } = require('../queue');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'err-queue-'));
try {
  const file = path.join(temp, 'queue.json');
  const queue = new LocalQueue(file, { maxSize: 2 });

  const r1 = queue.enqueue({ fingerprint: 'fp-1', message: 'first' });
  assert.strictEqual(r1.queued, true);
  assert.strictEqual(queue.peek().length, 1);

  // Duplicate within the dedup window is skipped.
  const r2 = queue.enqueue({ fingerprint: 'fp-1', message: 'duplicate' });
  assert.strictEqual(r2.queued, false);
  assert.strictEqual(r2.reason, 'duplicate');
  assert.strictEqual(queue.peek().length, 1);

  // Different fingerprint queues.
  queue.enqueue({ fingerprint: 'fp-2', message: 'second' });
  assert.strictEqual(queue.peek().length, 2);

  // Max size trims oldest.
  queue.enqueue({ fingerprint: 'fp-3', message: 'third' });
  assert.strictEqual(queue.peek().length, 2);
  assert.strictEqual(queue.peek()[0].fingerprint, 'fp-2');

  // Persistence survives a new instance.
  const reloaded = new LocalQueue(file);
  assert.strictEqual(reloaded.peek().length, 2);

  // remove() deletes by id.
  const toRemove = reloaded.peek()[0];
  reloaded.remove(toRemove.id);
  assert.strictEqual(reloaded.peek().length, 1);
  assert.strictEqual(reloaded.peek()[0].fingerprint, 'fp-3');

  // Rate limiting per fingerprint.
  const q2 = new LocalQueue(path.join(temp, 'q2.json'), { minIntervalMs: 1000 });
  assert.strictEqual(q2.allowSend('x'), true);
  assert.strictEqual(q2.allowSend('x'), true, 'an attempted send is not rate-limited until success');
  q2.markSent('x');
  assert.strictEqual(q2.allowSend('x'), false, 'successful send within interval must be rejected');
  assert.strictEqual(q2.allowSend('y'), true);

  // Even when time-window dedup is disabled, one fingerprint cannot fill the queue.
  const q3 = new LocalQueue(path.join(temp, 'q3.json'), { dedupWindowMs: 0, maxPendingPerFingerprint: 2, maxSize: 10 });
  assert.strictEqual(q3.enqueue({ fingerprint: 'hot' }).queued, true);
  assert.strictEqual(q3.enqueue({ fingerprint: 'hot' }).queued, true);
  const capped = q3.enqueue({ fingerprint: 'hot' });
  assert.strictEqual(capped.queued, false);
  assert.strictEqual(capped.reason, 'fingerprint-limit');
  assert.strictEqual(q3.enqueue({ fingerprint: 'other' }).queued, true);

  // Corrupt file recovers to empty.
  fs.writeFileSync(path.join(temp, 'bad.json'), '{not json', 'utf8');
  assert.deepStrictEqual(new LocalQueue(path.join(temp, 'bad.json')).read(), []);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('queue tests: passed');