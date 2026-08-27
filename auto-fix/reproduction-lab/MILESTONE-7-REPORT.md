# Milestone 7 — Reproduction Lab

STATUS: PASS

## Scope

Implements the isolated reproduction environment system (spec sections 5, 14, 17,
and milestone 7) as a **standalone, disconnected module** under
`auto-fix/reproduction-lab/`. It provides environment profiles (user-like, clean,
golden) plus a compatibility matrix, a deterministic in-process event replay
engine, and file-backed snapshot/restore with integrity verification.

The module is not wired into the packaged Electron app, does not spawn arbitrary
processes, and performs no network I/O. Reproduction is driven entirely through a
caller-supplied handler function, so the lab is sandboxed by construction.

## Components

| File | Responsibility |
|------|----------------|
| `profiles.js` | `userLikeProfile`, `cleanProfile`, `goldenProfile`, `compatibilityMatrix`, and untrusted-input `validateProfile`. Environment ids are derived from stable technical fields and include the profile kind so variants never collide. |
| `replay.js` | `ReplayEngine` and `validateEventSequence`: deterministic ordered replay with timing-tolerant sorting, fingerprint matching, final-failing-event detection, handler-error containment, and a bounded event cap. |
| `snapshots.js` | `SnapshotStore`: atomic (tmp+rename) snapshot writes, SHA-256 integrity on restore, secret redaction via the shared `auto-fix/redaction.js`, and strict name validation against path traversal. |
| `lab.js` | `ReproductionLab` orchestrator wiring profiles, replay, and snapshot/restore into structured reproduction attempts with audit hooks. |
| `package.json` | `npm test` entrypoint chaining all four test scripts; zero new npm dependencies. |
| `test/*.test.js` | Assert-based tests following the repo convention; each uses a `mkdtempSync` temp dir cleaned in a `finally` block. |

## Verification

All tests are `assert`-based Node scripts matching the M2/M3 convention.

```
profiles tests: passed
replay tests: passed
snapshots tests: passed
lab tests: passed
```

Run with:

```powershell
npm --prefix auto-fix/reproduction-lab test
# or, from the auto-fix root:
npm --prefix auto-fix run test:reproduction-lab
```

All four `.js` source files also pass `node --check`.

The pre-existing suites were re-run to confirm the additive `package.json` /
`README.md` edits introduced no regression:

```
auto-fix control-plane: POLICY TEST: PASS / CONTROL-PLANE TEST: PASS / ARTIFACT PROVENANCE TEST: PASS
client-error-reporter: sanitizer, event-buffer, fingerprint, environment, queue, uploader, reporter — all passed
crash-server: schema, sanitizer, fingerprint, database, rate-limit, auth, api — all passed (exit code 0)
```

## Security notes

- No new npm dependencies; only Node built-ins plus the existing shared modules
  (`client-error-reporter/environment.js`, `auto-fix/redaction.js`). The supply
  chain is unchanged.
- Replay never spawns a process and never opens a socket; thrown handler errors
  are caught and become `not-reproduced` outcomes rather than propagating.
- Snapshot persistence redacts secret-keyed values before write and verifies a
  SHA-256 hash on restore; tampered snapshots fail closed with
  `integrity-mismatch`. Snapshot names are constrained to
  `[A-Za-z0-9._-]{1,128}` to prevent path traversal.
- Profiles carry only technical fields (OS, build, architecture, runtime,
  dependency versions, configuration fingerprint); clean profiles explicitly
  omit locale/timezone, and no personal or secret data is collected.

## Known limitations

- Environments are **profile data + deterministic replay**, not real VMs or
  containers. True OS-level isolation (VM/container/sandbox tooling) is deferred
  until a deployment target is selected.
- Replay is deterministic but logic-only: it cannot execute the actual packaged
  application binary. It exercises the event-driven failure path, not compiled
  code paths.
- Snapshots are single-file JSON with a bounded state size; they do not image a
  full filesystem.
- The `test:reproduction-lab` script is additive and not yet chained into
  `test:all`; both entrypoints were verified manually in this milestone.

## Next milestone

MILESTONE 8 — AUTO PATCH LOOP (isolated branch, patch application, targeted
test, iterative repair, max iteration policy). This builds on the existing
`bug-intelligence/` (M4) and `agent/` (M5/M6) modules already present in the
repository.