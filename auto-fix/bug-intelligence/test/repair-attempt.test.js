'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RepairAttemptStore } = require('../repair-attempt');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-attempt-'));
try {
  const file = path.join(temp, 'attempts.json');
  const store = new RepairAttemptStore(file);

  const attempt = {
    attempt_id: 'att-1',
    bug_id: 'BUG-123',
    branch: 'fix/123',
    patch: { files: ['main.js'], diff: '...' },
    tests: { passed: true },
    build: { status: 'success' },
    risk_score: 0.2,
    ai_confidence: { root_cause_confidence: 0.9, reproduction_confidence: 0.8, patch_confidence: 0.7, release_confidence: 0.6 },
    status: 'draft',
  };

  const created = store.create(attempt);
  assert.strictEqual(created.attempt_id, 'att-1');
  assert.strictEqual(created.bug_id, 'BUG-123');
  assert.strictEqual(created.status, 'draft');
  assert.strictEqual(created.risk_score, 0.2);
  assert.strictEqual(created.ai_confidence.root_cause_confidence, 0.9);

  // duplicate attempt must fail
  assert.throws(() => store.create({ attempt_id: 'att-1', bug_id: 'BUG-123' }), /already exists/);

  // update
  const updated = store.update('att-1', {
    status: 'verified',
    risk_score: 0.1,
    ai_confidence: { root_cause_confidence: 0.95, reproduction_confidence: 0.9, patch_confidence: 0.8, release_confidence: 0.7 },
  });
  assert.strictEqual(updated.status, 'verified');
  assert.strictEqual(updated.risk_score, 0.1);
  assert.strictEqual(updated.ai_confidence.root_cause_confidence, 0.95);

  // get
  const retrieved = store.get('att-1');
  assert.strictEqual(retrieved.attempt_id, 'att-1');

  // listForBug
  const list = store.listForBug('BUG-123');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].attempt_id, 'att-1');

  // stats
  const stats = store.stats();
  assert.strictEqual(stats.attempts, 1);
  assert.strictEqual(stats.byStatus.verified, 1);

  // invalid confidence
  assert.throws(() => store.create({ attempt_id: 'bad', bug_id: 'x', ai_confidence: { root_cause_confidence: 1.5 } }), /must be a number in \[0,1\]/);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('repair-attempt tests: passed');