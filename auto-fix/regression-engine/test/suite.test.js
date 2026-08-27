'use strict';

const assert = require('assert');
const { RegressionSuite, handlerFromSpec } = require('../suite');

const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'null_ref' };
const sequence = {
  sequence_id: 'seq-suite-1',
  events: [
    { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
    failingEvent,
  ],
  final_failing_event: failingEvent,
};

function makeCase(regressionId, bugId, fingerprint, overrides = {}) {
  return {
    regression_id: regressionId,
    bug_id: bugId,
    fingerprint,
    reproduction: { sequence, expected_fingerprint: fingerprint },
    replay_spec: [
      { when: { type: 'start' }, then: { handled: true } },
      { when: { type: 'null_ref' }, then: { failed: true, fingerprint } },
    ],
    ...overrides,
  };
}

const audit = [];
const suite = new RegressionSuite({ audit: (ev) => audit.push(ev) });

// two PASS and one FAIL (wrong fingerprint in the failing rule)
const report = suite.execute([
  makeCase('REG-1', 'BUG-1', 'fp-1'),
  makeCase('REG-2', 'BUG-2', 'fp-2'),
  makeCase('REG-3', 'BUG-3', 'fp-3', {
    replay_spec: [
      { when: { type: 'start' }, then: { handled: true } },
      { when: { type: 'null_ref' }, then: { failed: true, fingerprint: 'WRONG' } },
    ],
  }),
]);

assert.strictEqual(report.total, 3);
assert.strictEqual(report.passed, 2);
assert.strictEqual(report.failed, 1);
assert.strictEqual(report.results[0].status, 'PASS');
assert.strictEqual(report.results[2].status, 'FAIL');
assert.strictEqual(report.results[2].replay.fingerprint_matches, false);

// malformed case with missing reproduction fails loudly, not skipped
const malformed = suite.execute([
  { regression_id: 'REG-BROKEN', bug_id: 'BUG-BROKEN', fingerprint: 'fp-broken', reproduction: {}, replay_spec: [] },
]);
assert.strictEqual(malformed.total, 1);
assert.strictEqual(malformed.failed, 1);
assert.strictEqual(malformed.results[0].status, 'FAIL');

assert.ok(audit.length > 0);
assert.ok(handlerFromSpec([{ when: { type: 'x' }, then: { failed: true, fingerprint: 'f' } }])({ type: 'y' }).handled === true);

console.log('suite tests: passed');