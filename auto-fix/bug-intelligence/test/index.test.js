'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BugIntelligence } = require('../index');
const { EnvironmentProfileStore } = require('../environment-profile');
const { EventSequenceStore } = require('../event-sequence');
const { RepairAttemptStore } = require('../repair-attempt');
const { BugCaseStore } = require('../bug-case');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-intel-'));
try {
  const base = path.join(temp, 'data');
  fs.mkdirSync(base, { recursive: true });

  const auditEvents = [];
  const audit = (ev) => auditEvents.push(ev);

  const bi = new BugIntelligence({
    baseDir: base,
    audit,
    bugCases: new BugCaseStore(path.join(base, 'bug-cases.json'), { audit }),
    environments: new EnvironmentProfileStore(path.join(base, 'environments.json'), { audit }),
    sequences: new EventSequenceStore(path.join(base, 'sequences.json'), { audit }),
    repairAttempts: new RepairAttemptStore(path.join(base, 'repair-attempts.json'), { audit }),
  });

  // Simulate a crash report
  const crash = {
    crash_id: 'c1',
    app_version: '1.0.0',
    build_id: 'b1',
    fingerprint: 'abcdef1234567890abcdef1234567890',
    timestamp: new Date().toISOString(),
    error_type: 'TypeError',
    message: 'Cannot read property x of undefined at 0x1234',
    stack_trace: 'TypeError: ...\\n    at run (C:\\\\app\\\\main.js:10:3)',
    client_installation_id: 'inst-1',
    environment_id: 'env-win10',
    environment: {
      environment_id: 'env-win10',
      OS: 'Windows 10',
      architecture: 'x64',
    },
    sanitized_logs: {
      sequence_id: 'seq-1',
      events: [
        { seq: 1, type: 'start', params: {} },
        { seq: 2, type: 'operation', params: { op: 'load' } },
      ],
    },
  };

  const result = bi.ingestCrash(crash);
  assert.strictEqual(result.reconciliation.canonicalFingerprint.length, 32);
  assert.ok(result.attachment);
  assert.strictEqual(result.errors.length, 0);

  const stats = bi.stats();
  assert.strictEqual(stats.bugCases.cases, 1);
  assert.strictEqual(stats.environments.profiles, 1);
  assert.strictEqual(stats.sequences.sequences, 1);
  assert.strictEqual(stats.repairAttempts.attempts, 0);

  // Check that bug case has been created with affected versions and environments
  const bug = bi.bugCases.get(result.attachment.bugId);
  assert.ok(bug);
  assert.ok(bug.affected_versions.includes('1.0.0'));
  assert.ok(bug.affected_environments.includes('env-win10'));
  assert.ok(bug.sample_installation_ids.includes('inst-1'));

  // Another crash with same fingerprint should attach to same case
  const crash2 = {
    ...crash,
    crash_id: 'c2',
    client_installation_id: 'inst-2',
  };
  const result2 = bi.ingestCrash(crash2);
  assert.strictEqual(result2.attachment.bugId, result.attachment.bugId);
  assert.strictEqual(result2.attachment.created, false);

  // Check occurrence count
  const bug2 = bi.bugCases.get(result.attachment.bugId);
  assert.strictEqual(bug2.occurrences, 2);
  assert.ok(bug2.sample_installation_ids.includes('inst-2'));

  // Check audit events
  assert.ok(auditEvents.some(e => e.event === 'bug-intelligence-ingest'));
  assert.ok(auditEvents.some(e => e.event === 'bug-case-attached'));

  // Test stats
  const finalStats = bi.stats();
  assert.strictEqual(finalStats.bugCases.totalOccurrences, 2);

} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('index tests: passed');