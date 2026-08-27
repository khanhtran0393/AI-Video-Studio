'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RegressionEngine } = require('../index');
const { BugCaseStore } = require('../../bug-intelligence/bug-case');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-engine-'));
try {
  const auditEvents = [];
  const bugCases = new BugCaseStore(path.join(temp, 'bug-cases.json'));
  const engine = new RegressionEngine({
    baseDir: temp,
    bugCases,
    audit: (ev) => auditEvents.push(ev),
  });

  const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'null_ref' };
  const sequence = {
    sequence_id: 'seq-eng-1',
    events: [
      { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
      failingEvent,
    ],
    final_failing_event: failingEvent,
  };

  // Create the bug case first so the regression test can back‑reference it.
  bugCases.create({
    bug_id: 'BUG-ENG-1',
    fingerprint: 'fp-eng-1',
    status: 'confirmed',
    title: 'Test bug for regression',
    description: 'Bug used in regression engine test',
    environment: { environment_id: 'env-eng-1' },
  });

  const stored = engine.generateRegressionTest({
    bug: { bug_id: 'BUG-ENG-1', fingerprint: 'fp-eng-1' },
    reproduction: {
      reproduction_id: 'rep-eng-1',
      expected_fingerprint: 'fp-eng-1',
      sequence,
      environment: { environment_id: 'env-eng-1' },
    },
    knowledge: { summary: 'engine e2e', root_cause: 'guard missing', environment_specific: false },
  });

  assert.strictEqual(stored.regression_id, 'REG-BUG-ENG-1');

  // Back‑reference was added to the bug case's regression_test_refs
  const bug = bugCases.get('BUG-ENG-1');
  assert.ok(bug, 'bug case should exist');
  assert.ok(bug.regression_test_refs.includes('REG-BUG-ENG-1'));

  // historical suite executes the stored case and passes
  const report = engine.runRegressionSuite();
  assert.strictEqual(report.total, 1);
  assert.strictEqual(report.passed, 1);
  assert.strictEqual(report.failed, 0);

  const stats = engine.stats();
  assert.strictEqual(stats.cases.cases, 1);

  assert.ok(auditEvents.some((ev) => ev.event === 'regression-test-generated'));
  assert.ok(auditEvents.some((ev) => ev.event === 'regression-suite-run'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('index tests: passed');