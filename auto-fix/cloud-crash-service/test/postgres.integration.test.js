'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PostgresStore } = require('../src/postgres-store');

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  console.log('postgres integration tests: skipped (set TEST_DATABASE_URL to a dedicated disposable database)');
} else {
  (async () => {
    const pool = new Pool({ connectionString, max: 8 });
    const store = new PostgresStore({ connectionString, pool, maxJobAttempts: 2 });
    const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_initial.sql'), 'utf8');
    await pool.query(migration);
    await pool.query('TRUNCATE audit_events, job_attempts, jobs, crash_reports, bug_cases, installations RESTART IDENTITY CASCADE');

    const baseTime = new Date('2026-08-27T10:00:00.000Z');
    const input = (crashId, timestamp = baseTime.toISOString()) => ({
      report: { crash_id: crashId, app_version: '1.0.0', build_id: 'build-1', timestamp,
        error_type: 'TypeError', message: 'boom', stack_trace: 'at run (app.js:1:1)', fingerprint: 'a'.repeat(64) },
      fingerprint: 'f'.repeat(64), clientFingerprint: 'a'.repeat(64), deviceHash: 'd'.repeat(64), receivedAt: timestamp,
    });

    const first = await store.ingestCrash(input('crash-pg-1'));
    const second = await store.ingestCrash(input('crash-pg-2', new Date(baseTime.getTime() + 1000).toISOString()));
    const duplicate = await store.ingestCrash(input('crash-pg-1'));
    assert.strictEqual(first.jobCreated, true);
    assert.strictEqual(second.deduplicated, true);
    assert.strictEqual(second.jobCreated, false);
    assert.strictEqual(duplicate.duplicateCrash, true);
    const counts = await pool.query('SELECT occurrence_count FROM bug_cases');
    assert.strictEqual(Number(counts.rows[0].occurrence_count), 2);

    const claimAt = new Date(baseTime.getTime() + 2000).toISOString();
    const [claimA, claimB] = await Promise.all([
      store.claimJob({ workerId: 'worker-a', leaseSeconds: 30, now: claimAt }),
      store.claimJob({ workerId: 'worker-b', leaseSeconds: 30, now: claimAt }),
    ]);
    const claimed = claimA || claimB;
    assert.ok(claimed);
    assert.ok(!(claimA && claimB), 'SKIP LOCKED must prevent duplicate concurrent claims');
    assert.strictEqual(await store.complete({ jobId: claimed.job_id, leaseToken: 'wrong', result: { ok: true }, now: new Date(baseTime.getTime() + 3000).toISOString() }), false);
    assert.strictEqual(await store.complete({ jobId: claimed.job_id, leaseToken: claimed.lease_token, result: { ok: true }, now: new Date(baseTime.getTime() + 3000).toISOString() }), true);
    assert.strictEqual(await store.complete({ jobId: claimed.job_id, leaseToken: claimed.lease_token, result: { ok: true }, now: new Date(baseTime.getTime() + 4000).toISOString() }), false);

    await store.ingestCrash({ ...input('crash-pg-3', new Date(baseTime.getTime() + 5000).toISOString()), fingerprint: 'e'.repeat(64) });
    const retryClaim = await store.claimJob({ workerId: 'worker-a', leaseSeconds: 1, now: new Date(baseTime.getTime() + 6000).toISOString() });
    const retry = await store.fail({ jobId: retryClaim.job_id, leaseToken: retryClaim.lease_token, error: 'retry', retryable: true, now: new Date(baseTime.getTime() + 6500).toISOString() });
    assert.strictEqual(retry.status, 'pending');
    const finalClaim = await store.claimJob({ workerId: 'worker-b', leaseSeconds: 1, now: new Date(baseTime.getTime() + 17000).toISOString() });
    assert.strictEqual(finalClaim.attempt, 2);
    const dead = await store.fail({ jobId: finalClaim.job_id, leaseToken: finalClaim.lease_token, error: 'final', retryable: true, now: new Date(baseTime.getTime() + 17500).toISOString() });
    assert.strictEqual(dead.status, 'dead-letter');

    await store.ingestCrash({ ...input('crash-pg-4', new Date(baseTime.getTime() + 18000).toISOString()), fingerprint: 'c'.repeat(64) });
    const expired1 = await store.claimJob({ workerId: 'worker-a', leaseSeconds: 1, now: new Date(baseTime.getTime() + 19000).toISOString() });
    const expired2 = await store.claimJob({ workerId: 'worker-b', leaseSeconds: 1, now: new Date(baseTime.getTime() + 21000).toISOString() });
    assert.strictEqual(expired2.job_id, expired1.job_id);
    assert.strictEqual(expired2.attempt, 2);
    assert.strictEqual(await store.claimJob({ workerId: 'worker-c', leaseSeconds: 1, now: new Date(baseTime.getTime() + 23000).toISOString() }), null);
    const status = await pool.query('SELECT status FROM jobs WHERE id=$1', [expired1.job_id]);
    assert.strictEqual(status.rows[0].status, 'dead-letter');

    await pool.end();
    console.log('postgres integration tests: ok');
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
