'use strict';

const crypto = require('crypto');
const { Pool } = require('pg');
const { randomToken, sha256 } = require('./security');

function identifier(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}
function bugId(fingerprint) { return `BUG-${String(fingerprint).slice(0, 16).toUpperCase()}`; }

class PostgresStore {
  constructor(options = {}) {
    if (!options.connectionString) throw new Error('DATABASE_URL is required');
    this.pool = options.pool || new Pool({ connectionString: options.connectionString, max: 5 });
    this.maxJobAttempts = Number.isInteger(options.maxJobAttempts) && options.maxJobAttempts > 0
      ? options.maxJobAttempts : 5;
  }

  async ingestCrash(input) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT bug_id FROM crash_reports WHERE crash_id = $1', [input.report.crash_id]);
      if (existing.rowCount) {
        await client.query('COMMIT');
        return { crashId: input.report.crash_id, bugId: existing.rows[0].bug_id, duplicateCrash: true, deduplicated: true, jobCreated: false };
      }
      const id = bugId(input.fingerprint);
      const insertedCase = await client.query(
        `INSERT INTO bug_cases (id, fingerprint_sha256, first_seen_at, last_seen_at, created_at, updated_at)
         VALUES ($1,$2,$3,$3,$3,$3)
         ON CONFLICT (fingerprint_sha256) DO UPDATE SET occurrence_count=bug_cases.occurrence_count+1,
           last_seen_at=EXCLUDED.last_seen_at, updated_at=EXCLUDED.updated_at
         RETURNING id, (xmax = 0) AS created`, [id, input.fingerprint, input.receivedAt]);
      const bug = insertedCase.rows[0];
      await client.query(
        `INSERT INTO installations (device_hash, first_seen_at, last_seen_at) VALUES ($1,$2,$2)
         ON CONFLICT (device_hash) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,
        [input.deviceHash, input.receivedAt]);
      await client.query(
        `INSERT INTO crash_reports (crash_id,bug_id,fingerprint_sha256,client_fingerprint,device_hash,
          app_version,build_id,git_commit_sha,artifact_sha256,report,occurred_at,received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
        [input.report.crash_id, bug.id, input.fingerprint, input.clientFingerprint, input.deviceHash,
          input.report.app_version, input.report.build_id, input.report.git_commit_sha || null,
          input.report.artifact_sha256 || null, JSON.stringify(input.report), input.report.timestamp, input.receivedAt]);
      let jobId = null;
      if (bug.created) {
        jobId = identifier('job');
        const job = await client.query(
          `INSERT INTO jobs (id,bug_id,crash_id,type,idempotency_key,max_attempts,available_at,created_at,updated_at)
           VALUES ($1,$2,$3,'observe-diagnosis',$4,$5,$6,$6,$6)
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
          [jobId, bug.id, input.report.crash_id, `observe-diagnosis:${bug.id}:v1`, this.maxJobAttempts, input.receivedAt]);
        if (!job.rowCount) jobId = null;
      }
      await client.query(
        `INSERT INTO audit_events (event,subject_id,data,created_at) VALUES ('crash-ingested',$1,$2::jsonb,$3)`,
        [input.report.crash_id, JSON.stringify({ bug_id: bug.id, fingerprint: input.fingerprint, job_created: Boolean(jobId) }), input.receivedAt]);
      await client.query('COMMIT');
      return { crashId: input.report.crash_id, bugId: bug.id, duplicateCrash: false, deduplicated: !bug.created, jobCreated: Boolean(jobId), jobId };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async claimJob({ workerId, leaseSeconds, now }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const leaseToken = randomToken();
      await client.query(
        `WITH exhausted AS (
           SELECT id FROM jobs WHERE status='leased' AND lease_expires_at<=$1 AND attempt_count>=max_attempts
           FOR UPDATE SKIP LOCKED
         ), dead AS (
           UPDATE jobs j SET status='dead-letter',last_error='lease-expired-after-final-attempt',
             lease_token_hash=NULL,lease_expires_at=NULL,updated_at=$1
           FROM exhausted WHERE j.id=exhausted.id RETURNING j.id,j.attempt_count
         )
         UPDATE job_attempts a SET finished_at=$1,status='dead-letter',error='lease expired after final attempt'
         FROM dead WHERE a.job_id=dead.id AND a.attempt=dead.attempt_count AND a.finished_at IS NULL`, [now]);
      const claimed = await client.query(
        `WITH candidate AS (SELECT id FROM jobs WHERE attempt_count<max_attempts AND available_at<=$1
           AND (status='pending' OR (status='leased' AND lease_expires_at<=$1))
           ORDER BY priority,created_at FOR UPDATE SKIP LOCKED LIMIT 1)
         UPDATE jobs j SET status='leased',worker_id=$2,attempt_count=j.attempt_count+1,
           lease_token_hash=$3,lease_expires_at=$1+($4*interval '1 second'),updated_at=$1
         FROM candidate WHERE j.id=candidate.id RETURNING j.*`,
        [now, workerId, sha256(leaseToken), leaseSeconds]);
      if (!claimed.rowCount) { await client.query('COMMIT'); return null; }
      const job = claimed.rows[0];
      await client.query(
        `UPDATE job_attempts SET finished_at=$1,status='lease-expired',error='lease expired before completion'
         WHERE job_id=$2 AND finished_at IS NULL AND attempt<$3`, [now, job.id, job.attempt_count]);
      await client.query(
        `INSERT INTO job_attempts (job_id,attempt,worker_id,started_at,status) VALUES ($1,$2,$3,$4,'leased')`,
        [job.id, job.attempt_count, workerId, now]);
      const crash = await client.query('SELECT report FROM crash_reports WHERE crash_id=$1', [job.crash_id]);
      if (!crash.rowCount) throw new Error(`crash report missing for job ${job.id}`);
      await client.query('COMMIT');
      return { job_id: job.id, bug_id: job.bug_id, type: job.type, attempt: job.attempt_count,
        lease_token: leaseToken, lease_expires_at: job.lease_expires_at, crash: crash.rows[0].report };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async heartbeat({ jobId, leaseToken, leaseSeconds, now }) {
    const updated = await this.pool.query(
      `UPDATE jobs SET lease_expires_at=$1+($4*interval '1 second'),updated_at=$1
       WHERE id=$2 AND status='leased' AND lease_token_hash=$3 AND lease_expires_at>$1
       RETURNING lease_expires_at`, [now, jobId, sha256(leaseToken), leaseSeconds]);
    return updated.rowCount ? updated.rows[0] : null;
  }

  async complete({ jobId, leaseToken, result, now }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE jobs SET status='completed',result=$4::jsonb,completed_at=$1,updated_at=$1,
          lease_token_hash=NULL,lease_expires_at=NULL WHERE id=$2 AND status='leased'
          AND lease_token_hash=$3 AND lease_expires_at>$1 RETURNING attempt_count`,
        [now, jobId, sha256(leaseToken), JSON.stringify(result)]);
      if (!updated.rowCount) { await client.query('ROLLBACK'); return false; }
      await client.query(
        `UPDATE job_attempts SET finished_at=$1,status='completed',result=$3::jsonb
         WHERE job_id=$2 AND attempt=$4`, [now, jobId, JSON.stringify(result), updated.rows[0].attempt_count]);
      await client.query('COMMIT');
      return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async fail({ jobId, leaseToken, error, retryable, now }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT attempt_count,max_attempts FROM jobs WHERE id=$1 AND status='leased'
         AND lease_token_hash=$2 AND lease_expires_at>$3 FOR UPDATE`, [jobId, sha256(leaseToken), now]);
      if (!locked.rowCount) { await client.query('ROLLBACK'); return null; }
      const job = locked.rows[0];
      const retry = retryable && job.attempt_count < job.max_attempts;
      const delay = Math.min(300, Math.pow(2, Math.max(0, job.attempt_count - 1)) * 10);
      const status = retry ? 'pending' : 'dead-letter';
      await client.query(
        `UPDATE jobs SET status=$1,last_error=$2,available_at=$3+($4*interval '1 second'),
         lease_token_hash=NULL,lease_expires_at=NULL,updated_at=$3 WHERE id=$5`,
        [status, String(error).slice(0, 2048), now, retry ? delay : 0, jobId]);
      await client.query(
        `UPDATE job_attempts SET finished_at=$1,status=$2,error=$3 WHERE job_id=$4 AND attempt=$5`,
        [now, status, String(error).slice(0, 2048), jobId, job.attempt_count]);
      await client.query('COMMIT');
      return { status, retryAfterSeconds: retry ? delay : null };
    } catch (caught) { await client.query('ROLLBACK'); throw caught; } finally { client.release(); }
  }

  async health() { await this.pool.query('SELECT 1'); return { database: 'ok' }; }
}

module.exports = { PostgresStore, bugId, identifier };

