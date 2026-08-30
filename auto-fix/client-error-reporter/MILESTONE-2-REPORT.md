# Milestone 2 — Client Error Reporter

STATUS: PASS

## Scope

Implements the client-side error reporting layer from the master specification
(section 6, 7, 8, 28). The observe-only reporter is packaged and wired into the
Electron main and renderer processes behind `AI_VIDEO_STUDIO_ERROR_REPORTING=1`.
It remains disabled by default and grants no mutation, release, rollout, or
rollback authority. Without both a valid HTTPS endpoint and bearer token,
reports stay only in the bounded local queue under Electron `userData`.

## Components

| File | Responsibility |
|------|----------------|
| `sanitizer.js` | Privacy sanitization on top of `auto-fix/redaction.js`: JWT/AWS/GitHub/Slack token patterns, bearer/basic credential redaction, local-path normalization. |
| `event-buffer.js` | Bounded in-memory event ring buffer with sequence ids and copy-on-snapshot. |
| `fingerprint.js` | Stable technical fingerprint: exception type + normalized message + normalized stack frames + originating module (full SHA-256, 64 hex chars). Volatile tokens (hex addresses, numbers, paths, emails) are normalized away so many reports collapse to one fingerprint. |
| `environment.js` | Environment fingerprint: platform, OS build, arch, runtime versions, configuration hash. Locale/timezone identifiers are intentionally NOT collected (only numeric UTC offset). |
| `queue.js` | Persistent local JSON-array queue for offline reporting, with in-window dedup, a pending cap per fingerprint, max-size trimming, and per-fingerprint rate limiting. |
| `uploader.js` | HTTPS JSON POST transport (http supported for tests) with retry/error classification and exponential backoff. |
| `reporter.js` | Orchestrator: capture/report, joined flushes, periodic/network-aware lifecycle retry with backoff, bounded shutdown flush, and injectable global handlers. |

## Verification

All tests are `assert`-based Node scripts following the repo convention
(`... tests: passed`, non-zero exit code on failure).

```
sanitizer tests: passed
event-buffer tests: passed
fingerprint tests: passed
environment tests: passed
queue tests: passed
uploader tests: passed
reporter tests: passed
```

Run with:

```powershell
node auto-fix/client-error-reporter/test/sanitizer.test.js
node auto-fix/client-error-reporter/test/event-buffer.test.js
node auto-fix/client-error-reporter/test/fingerprint.test.js
node auto-fix/client-error-reporter/test/environment.test.js
node auto-fix/client-error-reporter/test/queue.test.js
node auto-fix/client-error-reporter/test/uploader.test.js
node auto-fix/client-error-reporter/test/reporter.test.js
```

or

```powershell
npm --prefix auto-fix/client-error-reporter test
```

All modules also pass `node --check` syntax validation.

## Security notes

- No passwords, tokens, cookies, private keys, or arbitrary filesystem contents
  are collected; explicit redaction is applied before any data enters the event
  buffer or report.
- The reporter never crashes the host application: `report()` swallows its own
  failures and the uploader runs as a background promise.
- No new npm dependencies; only Node built-ins and the existing control-plane
  `redaction.js` are used. This keeps the supply chain unchanged.
- The module exposes no upload endpoint by default; an endpoint must be
  injected (`endpoint` or `transport` option), and no secrets are embedded.

## Runtime configuration

- `AI_VIDEO_STUDIO_ERROR_REPORTING=1` enables observe-only collection.
- `AI_VIDEO_STUDIO_ERROR_UPLOAD_URL=https://<host>/v1/crashes` and
  `AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN=<dedicated uploader token>` are both
  required to upload. HTTP and partial configuration fail closed to local queue.
- Optional CI release identity: `AI_VIDEO_STUDIO_BUILD_ID`,
  `AI_VIDEO_STUDIO_GIT_COMMIT_SHA`, `AI_VIDEO_STUDIO_ARTIFACT_SHA256`.
- Never commit any raw token, TLS private key, or `.env` file.

## Known limitations

- Fingerprint stability is heuristic; Milestone 4 stores the independent full
  SHA-256 server fingerprint as canonical and retains the client value as alias.
- Plain `ErrorReporter` consumers default the queue to `process.cwd()`; Electron
  wiring explicitly places `crash-queue.json` under `app.getPath('userData')`.

## Next milestone

MILESTONE 3 — CRASH SERVER (API, database, crash ingestion, authentication,
rate limiting, deduplication).