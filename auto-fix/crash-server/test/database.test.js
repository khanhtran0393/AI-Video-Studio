'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CrashDatabase, emptyDb } = require('../database');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crash-db-'));
try {
  const file = path.join(temp, 'crash-db.json');
  const auditEvents = [];
  const db = new CrashDatabase(file, { audit: (evidence) => auditEvents.push(evidence) });

  assert.deepStrictEqual(db.read(), emptyDb(), 'missing file must read as empty db');
  assert.deepStrictEqual(db.stats(), { crashRecords: 0, fingerprints: 0, totalOccurrences: 0 });

  const r1 = db.ingest({ crash_id: 'c1', fingerprint: 'fp-1', received_at: new Date().toISOString() });
  assert.strictEqual(r1.deduplicated, false);
  assert.strictEqual(db.stats().crashRecords, 1);
  assert.strictEqual(db.stats().fingerprints, 1);
  assert.strictEqual(db.stats().totalOccurrences, 1);

  const r2 = db.ingest({ crash_id: 'c2', fingerprint: 'fp-1', received_at: new Date().toISOString() });
  assert.strictEqual(r2.deduplicated, true, 'same fingerprint must dedupe');
  assert.strictEqual(db.stats().totalOccurrences, 2, 'occurrence count must increment');
  assert.strictEqual(db.getDedup('fp-1').count, 2);

  db.ingest({ crash_id: 'c3', fingerprint: 'fp-2', received_at: new Date().toISOString() });
  assert.strictEqual(db.stats().fingerprints, 2);

  assert.ok(db.getCrash('c1'));
  assert.strictEqual(db.getCrash('missing'), null);

  const sampleDb = new CrashDatabase(path.join(temp, 'samples.json'), { maxSamplesPerFingerprint: 1, audit: () => {} });
  sampleDb.ingest({ crash_id: 's1', fingerprint: 'fp-x', received_at: new Date().toISOString() });
  const sampleResult = sampleDb.ingest({ crash_id: 's2', fingerprint: 'fp-x', received_at: new Date().toISOString() });
  assert.strictEqual(sampleResult.deduplicated, true);
  assert.strictEqual(sampleDb.stats().crashRecords, 1, 'sample cap must limit stored records');

  assert.strictEqual(auditEvents.length >= 2, true, 'audit callback must fire on ingest');
  assert.strictEqual(auditEvents[0].event, 'crash-ingested');

  assert.ok(fs.existsSync(file), 'db file must persist after ingest');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('database tests: passed');