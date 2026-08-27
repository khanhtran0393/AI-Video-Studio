'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ReproductionLab } = require('../lab');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-lab-'));
try {
  const lab = new ReproductionLab({ snapshotDirectory: temp });

  const profiles = lab.profiles();
  assert.ok(profiles['user-like']);
  assert.ok(profiles.clean);
  assert.ok(profiles.golden);

  const matrix = lab.compatibilityMatrix();
  assert.ok(Object.keys(matrix).length >= 1);

  const failingEvent = { seq: 2, ts: '2026-01-01T00:00:02.000Z', type: 'null_ref' };
  const sequence = {
    sequence_id: 'seq-lab-1',
    events: [
      { seq: 1, ts: '2026-01-01T00:00:01.000Z', type: 'start' },
      failingEvent,
    ],
    final_failing_event: failingEvent,
  };

  const record = lab.runReproduction({
    sequence,
    profile: profiles['user-like'],
    expectedFingerprint: 'fp-lab-1',
    handler: (event) => (event.seq === 2 ? { failed: true, fingerprint: 'fp-lab-1' } : { handled: true }),
  });
  assert.strictEqual(record.status, 'reproduced');
  assert.strictEqual(record.profile_kind, 'user-like');
  assert.ok(record.reproduction_id.startsWith('rep-'));

  const invalid = lab.runReproduction({ sequence, profile: {}, handler: () => ({}), expectedFingerprint: 'x' });
  assert.strictEqual(invalid.status, 'invalid-profile');

  const snap = lab.captureSnapshot('lab-checkpoint', { phase: 'pre-replay' });
  assert.ok(snap.hash);
  const restored = lab.restoreSnapshot('lab-checkpoint');
  assert.strictEqual(restored.restored, true);
  assert.strictEqual(restored.state.phase, 'pre-replay');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('lab tests: passed');