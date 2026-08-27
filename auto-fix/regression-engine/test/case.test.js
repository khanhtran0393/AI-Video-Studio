'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RegressionCaseStore, SOURCE_KINDS } = require('../case');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-case-'));
try {
  const file = path.join(temp, 'cases.json');
  const auditEvents = [];
  const store = new RegressionCaseStore(file, { audit: (ev) => auditEvents.push(ev) });

  const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'null_ref' };
  const sequence = {
    sequence_id: 'seq-1',
    events: [
      { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
      failingEvent,
    ],
    final_failing_event: failingEvent,
  };

  const created = store.create({
    regression_id: 'REG-BUG-1',
    bug_id: 'BUG-1',
    fingerprint: 'fp-1',
    source_kind: 'production-bug',
    source_note: 'from acceptance run',
    reproduction: {
      reproduction_id: 'rep-1',
      sequence_id: 'seq-1',
      expected_fingerprint: 'fp-1',
      sequence,
      environment: { environment_id: 'env-1', OS: 'win32' },
    },
    replay_spec: [
      { when: { type: 'start' }, then: { handled: true } },
      { when: { type: 'null_ref' }, then: { failed: true, fingerprint: 'fp-1' } },
    ],
    knowledge: { summary: 'null ref crash', root_cause: 'missing guard', environment_specific: false },
  });

  assert.strictEqual(created.regression_id, 'REG-BUG-1');
  assert.strictEqual(created.bug_id, 'BUG-1');
  assert.strictEqual(created.fingerprint, 'fp-1');
  assert.strictEqual(created.source_kind, 'production-bug');
  assert.strictEqual(created.reproduction.expected_fingerprint, 'fp-1');
  assert.deepStrictEqual(created.reproduction.sequence, sequence);

  // duplicate creation must fail
  assert.throws(() => store.create({ regression_id: 'REG-BUG-1', bug_id: 'BUG-2', fingerprint: 'fp-2', reproduction: { expected_fingerprint: 'fp-2' }, replay_spec: [{ when: { type: 'x' }, then: { handled: true } }] }), /already exists/);

  // invalid replay_spec must fail
  assert.throws(() => store.create({ regression_id: 'REG-BAD', bug_id: 'BUG-BAD', fingerprint: 'fp-bad', reproduction: { expected_fingerprint: 'fp-bad' }, replay_spec: [] }), /replay_spec/);

  // invalid then.fingerprint type must fail
  assert.throws(() => store.create({ regression_id: 'REG-BAD2', bug_id: 'BUG-BAD2', fingerprint: 'fp-bad2', reproduction: { expected_fingerprint: 'fp-bad2' }, replay_spec: [{ when: { type: 'x' }, then: { failed: true, fingerprint: 123 } }] }), /fingerprint/);

  const fetched = store.get('REG-BUG-1');
  assert.ok(fetched);
  assert.strictEqual(fetched.knowledge.summary, 'null ref crash');

  const byBug = store.listForBug('BUG-1');
  assert.strictEqual(byBug.length, 1);

  const all = store.list();
  assert.strictEqual(all.length, 1);

  const stats = store.stats();
  assert.strictEqual(stats.cases, 1);
  assert.strictEqual(stats.bySource['production-bug'], 1);
  assert.ok(SOURCE_KINDS.length >= 4);

  assert.ok(auditEvents.some((ev) => ev.event === 'regression-case-created'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('case tests: passed');