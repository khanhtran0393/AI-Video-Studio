'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BugCaseStore } = require('../bug-case');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-case-'));
try {
  const file = path.join(temp, 'cases.json');
  const auditEvents = [];
  const store = new BugCaseStore(file, { audit: (ev) => auditEvents.push(ev) });

  // create a case manually
  const created = store.create({ bug_id: 'BUG-123', fingerprint: 'fp-test-1' });
  assert.strictEqual(created.bug_id, 'BUG-123');
  assert.strictEqual(created.fingerprint, 'fp-test-1');
  assert.strictEqual(created.occurrences, 0);
  assert.strictEqual(created.current_status, 'open');

  // duplicate creation must fail
  assert.throws(() => store.create({ bug_id: 'BUG-123', fingerprint: 'fp-other' }), /already exists/);

  // attach a crash to an existing fingerprint
  const crash = {
    app_version: '1.0.0',
    environment_id: 'env-1',
    client_installation_id: 'inst-1',
    fingerprint: 'fp-test-1',
  };
  const result = store.attach(crash, new Date().toISOString(), { canonicalFingerprint: 'fp-test-1' });
  assert.strictEqual(result.bugId, 'BUG-123');
  assert.strictEqual(result.created, false);
  assert.strictEqual(result.matchedBy, 'fingerprint');

  const updated = store.get('BUG-123');
  assert.strictEqual(updated.occurrences, 1);
  assert.ok(updated.affected_versions.includes('1.0.0'));
  assert.ok(updated.affected_environments.includes('env-1'));
  assert.ok(updated.sample_installation_ids.includes('inst-1'));
  assert.strictEqual(updated.affected_users, 1);
  assert.deepStrictEqual(updated.environment_distribution, { 'env-1': 1 });

  // attach a crash with a new fingerprint creates a new case
  const crash2 = {
    app_version: '1.0.1',
    fingerprint: 'fp-new',
  };
  const result2 = store.attach(crash2, new Date().toISOString(), { canonicalFingerprint: 'fp-new' });
  assert.strictEqual(result2.created, true);
  assert.strictEqual(result2.bugId.startsWith('BUG-'), true);

  // getByFingerprint works with canonical and aliases
  const byFp = store.getByFingerprint('fp-test-1');
  assert.strictEqual(byFp.bug_id, 'BUG-123');

  // update fields
  const patch = {
    reproduction_status: 'reproduced',
    root_cause: 'null pointer dereference',
    confidence: { root_cause_confidence: 0.9, reproduction_confidence: 0.8 },
    risk: 'medium',
    current_status: 'investigating',
    regression_test_refs: ['test-1'],
  };
  const updated2 = store.update('BUG-123', patch);
  assert.strictEqual(updated2.reproduction_status, 'reproduced');
  assert.strictEqual(updated2.root_cause, 'null pointer dereference');
  assert.strictEqual(updated2.confidence.root_cause_confidence, 0.9);
  assert.strictEqual(updated2.risk, 'medium');
  assert.strictEqual(updated2.current_status, 'investigating');
  assert.ok(updated2.regression_test_refs.includes('test-1'));

  // recordFix
  store.recordFix('BUG-123', 'attempt-1', 'fixed null pointer');
  const withFix = store.get('BUG-123');
  assert.strictEqual(withFix.fix_history.length, 1);
  assert.strictEqual(withFix.fix_history[0].attempt_id, 'attempt-1');

  // list and stats
  const list = store.list();
  assert.strictEqual(list.length, 2);
  const stats = store.stats();
  assert.strictEqual(stats.cases, 2);
  assert.strictEqual(stats.totalOccurrences, 2); // BUG-123 + the new case created by the second attach
  assert.ok(stats.byStatus.open > 0);

  assert.ok(auditEvents.length > 0);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('bug-case tests: passed');