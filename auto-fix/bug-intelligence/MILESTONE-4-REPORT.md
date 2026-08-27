# Milestone 4 — Bug Intelligence

STATUS: PASS

## Scope

Implements the Bug Intelligence layer as specified in sections 5, 8, and 30 of the master specification. This module provides fingerprint reconciliation, bug case management, environment profiles, event sequences, and repair attempt history. It is a standalone, disconnected module under `auto-fix/bug-intelligence/` and is not wired into the packaged Electron application.

## Components

| File | Responsibility |
|------|----------------|
| `fingerprint.js` | Reconciliation between client and server fingerprints; canonical fingerprint is server-computed. |
| `bug-case.js` | BugCaseStore: keyed by canonical fingerprint, tracks affected versions, environments, users, occurrences, reproduction status, root cause, confidence, risk, fix history, regression test refs. Supports create, attach, update, recordFix, get, getByFingerprint, list, stats. |
| `environment-profile.js` | EnvironmentProfileStore: stores and updates environment profiles with allowed non-personal fields, tracks crash counts and first/last seen. |
| `event-sequence.js` | EventSequenceStore: stores bounded event sequences with a final failing event, supports append. |
| `repair-attempt.js` | RepairAttemptStore: tracks repair attempts with status, branch, patch, tests, build, risk score, AI confidence. |
| `store.js` | Shared JsonStore base with atomic writes and audit hook. |
| `index.js` | BugIntelligence service: composes all stores, ingests crashes, attaches to bug cases, and updates environment/sequence stores. |

## Verification

All tests are `assert`-based Node scripts following the repository convention.

```
fingerprint tests: passed
bug-case tests: passed
environment-profile tests: passed
event-sequence tests: passed
repair-attempt tests: passed
index tests: passed
```

Run with:

```powershell
npm --prefix auto-fix/bug-intelligence test
```

or from the root:

```powershell
npm --prefix auto-fix run test:bug-intelligence
```

All `.js` files also pass `node --check`.

### Live smoke test

The `index.test.js` exercises the full `ingestCrash` flow with a realistic crash report and verifies:

- Fingerprint reconciliation yields a canonical server fingerprint.
- A new bug case is created or existing is attached.
- Affected versions, environments, and installation IDs are aggregated.
- Occurrence counts increment.
- Environment and event sequence stores are updated.
- Audit events are emitted.

## Security notes

- No secrets or personal data are collected; fields are whitelisted and redacted via shared `redaction.js`.
- Data minimization enforced: only technical environment fields, event sequences, and aggregated user counts are stored.
- All stores use atomic writes with tmp+rename to avoid corruption.
- Audit hooks are optional and only receive non-sensitive identifiers.
- No new npm dependencies; only Node built-ins and the existing control-plane modules are used.

## Known limitations

- Stores are file-based JSON; production would need a real database for high throughput.
- No distributed locking; concurrent writes may conflict (single-writer assumption).
- Fingerprint reconciliation is heuristic and may still produce different canonical fingerprints for semantically identical failures; future tuning may be needed.
- Not yet wired into the crash-server or AI agent; integration deferred to later milestones.

## Next milestone

MILESTONE 5 — AGENT TOOL LAYER (controlled tools, sandbox, path/command policy, audit logging).