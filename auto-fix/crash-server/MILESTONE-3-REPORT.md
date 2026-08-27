# Milestone 3 — Crash Server

STATUS: PASS

## Scope

Implements the server-side crash ingestion layer (spec sections 3.B, 5, 8, 32,
33) as a **standalone, disconnected module** under `auto-fix/crash-server/`.
It accepts the exact report envelope produced by the M2 client error reporter
(`crash_id, app_version, build_id, fingerprint, timestamp, error_type, message,
stack_trace, environment_id, event_sequence_id, sanitized_logs,
client_installation_id, status`), but is not bound to a public endpoint and is
not wired into the packaged Electron app.

## Components

| File | Responsibility |
|------|----------------|
| `schema.js` | Untrusted-input validation: required fields, types, length caps, event-count cap. |
| `sanitizer.js` | Server-side redaction (defense-in-depth) on top of the shared `auto-fix/redaction.js`. |
| `fingerprint.js` | Server-side canonical fingerprint + dedup-key resolution (trusts a well-formed client fingerprint, else falls back to server-computed). |
| `database.js` | File-backed crash store (atomic tmp+rename), retention pruning, occurrence/dedup accounting with per-fingerprint sample caps. |
| `rate-limit.js` | In-memory sliding-window rate limiting across client, IP, fingerprint, and burst. |
| `auth.js` | Static bearer-token auth: SHA-256-hashed keys only, timing-safe comparison, scoped authorization. |
| `api.js` | HTTP server factory: `POST /v1/crashes`, `GET /v1/crashes/:id`, `GET /v1/health`. |
| `server.js` | Bootstrap wiring config, database, limiter, and append-only redacted audit via `auto-fix/audit.js`. |
| `scripts/make-api-key.js` | Generates a client API key and its SHA-256 hash. |
| `config.json` | Localhost-only default config with a dev key hash (no plaintext keys). |
| `.gitignore` | Excludes runtime db and audit artifacts. |

## Verification

All tests are `assert`-based Node scripts following the repo convention.

```
schema tests: passed
sanitizer tests: passed
fingerprint tests: passed
database tests: passed
rate-limit tests: passed
auth tests: passed
api tests: passed
```

Run with:

```powershell
npm --prefix auto-fix/crash-server test
```

All `.js` files also pass `node --check`.

### Live smoke test

Booted the real server against `config.json` and exercised the wire:

- `GET /v1/health` -> 200, database stats returned
- `POST /v1/crashes` with the dev bearer key -> 201, `deduplicated: false`
- Persisted `crash-db.json` contains the sanitized report with `server_fingerprint`
  and a `dedup` entry with occurrence count
- `crash-audit.log` contains a hashed append-only audit record

## Security notes

- Only SHA-256 hashes of API keys are stored; plaintext keys never touch the
  server filesystem, and token comparison is timing-safe.
- All telemetry is treated as untrusted: authenticated first, rate-limited,
  size-capped (configurable `maxBodyBytes`), schema-validated, then server-side
  sanitized before storage. Error responses never leak internals.
- Rate limiting guards per client, per IP, per fingerprint, and per burst,
  returning `429` with `Retry-After`.
- Audit records are append-only and redacted through the existing control-plane
  policy (`auto-fix/audit.js` + `auto-fix/policy.json`).
- No new npm dependencies; only Node built-ins and the shared `redaction.js` /
  `audit.js` / `policy.js` modules. The supply chain is unchanged.
- Default config binds to `127.0.0.1` only. A production deployment must
  terminate TLS at a reverse proxy and use real per-client keys.

## Known limitations

- Database and audit storage are single-file JSON/append-only logs; a
  production deployment needs a real database and a shared rate-limit store for
  multi-process serving.
- Rate limiter is in-memory (per-process), not distributed.
- The dev API key hash in `config.json` is a placeholder for local testing only
  and must not be used outside development.
- Fingerprint reconciliation between the client and server normalizers is
  deferred to Milestone 4 (Bug Intelligence), which introduces BugCase /
  EnvironmentProfile / EventSequence models.

## Next milestone

MILESTONE 4 — BUG INTELLIGENCE (fingerprinting, bug cases, environment
profiles, event sequences, repair attempt history).