BEGIN;

CREATE TABLE IF NOT EXISTS installations (
  device_hash char(64) PRIMARY KEY,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_cases (
  id text PRIMARY KEY,
  fingerprint_sha256 char(64) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open',
  occurrence_count bigint NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS crash_reports (
  crash_id text PRIMARY KEY,
  bug_id text NOT NULL REFERENCES bug_cases(id),
  fingerprint_sha256 char(64) NOT NULL,
  client_fingerprint text,
  device_hash char(64) NOT NULL REFERENCES installations(device_hash),
  app_version text NOT NULL,
  build_id text NOT NULL,
  git_commit_sha text,
  artifact_sha256 char(64),
  report jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS crash_reports_bug_id_idx ON crash_reports (bug_id, received_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  bug_id text NOT NULL REFERENCES bug_cases(id),
  crash_id text NOT NULL REFERENCES crash_reports(crash_id),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL UNIQUE,
  priority integer NOT NULL DEFAULT 100,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL,
  lease_token_hash char(64),
  lease_expires_at timestamptz,
  worker_id text,
  result jsonb,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK (status IN ('pending', 'leased', 'completed', 'dead-letter'))
);
CREATE INDEX IF NOT EXISTS jobs_claim_idx ON jobs (status, available_at, priority, created_at);

CREATE TABLE IF NOT EXISTS job_attempts (
  id bigserial PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  attempt integer NOT NULL,
  worker_id text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,
  error text,
  result jsonb,
  UNIQUE (job_id, attempt)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  subject_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
