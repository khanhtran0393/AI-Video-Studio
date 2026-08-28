# Cloud Crash Service

Vercel Functions + PostgreSQL service for authenticated crash ingestion and leased observe-only jobs.

## Setup

1. Create a Vercel-compatible PostgreSQL database and run `migrations/001_initial.sql`.
2. Copy `.env.example` values into Vercel environment variables.
3. Generate separate random uploader/worker bearer tokens and store only their SHA-256 hex digests in `CRASH_WRITE_TOKEN_HASH` and `WORKER_TOKEN_HASH`.
4. Set a stable random `DEVICE_ID_PEPPER` (at least 32 characters). Losing it changes installation pseudonyms.
5. Configure Electron with `AI_VIDEO_STUDIO_ERROR_REPORTING=1`, `AI_VIDEO_STUDIO_ERROR_UPLOAD_URL=https://<deployment>/v1/crashes`, and the raw uploader token in `AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN`.
6. Supply release provenance from CI through `AI_VIDEO_STUDIO_BUILD_ID`, `AI_VIDEO_STUDIO_GIT_COMMIT_SHA`, and `AI_VIDEO_STUDIO_ARTIFACT_SHA256` (the artifact digest must be calculated after packaging).
7. Deploy this directory as the Vercel project root.

Routes are exposed as `/v1/crashes`, `/v1/health`, and `/v1/worker/jobs/...` through `vercel.json` rewrites.

`npm test` always runs unit/domain tests. Set `TEST_DATABASE_URL` to also migrate and run destructive PostgreSQL integration tests; it must point to a dedicated disposable database because the suite truncates pipeline tables. The suite deliberately never falls back to the deployment `DATABASE_URL`.

## Guarantees

- The server recomputes a canonical 64-hex SHA-256 fingerprint; client fingerprints are advisory only.
- Each unique `crash_id` is idempotent. Repeated fingerprints create occurrences but only the first creates one `BugCase` and one `observe-diagnosis` job.
- Claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, random lease tokens stored only as hashes, expiry, retries, and a dead-letter state.
- Raw `client_installation_id` is never persisted; an HMAC pseudonym is stored.
