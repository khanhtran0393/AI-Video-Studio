# Milestone 9 — Regression Engine

STATUS: PASS

## Scope

Implements the regression engine from spec section 15 and milestone 9 as a
**standalone, disconnected module** under `auto-fix/regression-engine/`. Every
confirmed production bug can be converted into a permanent, self-contained
regression case (reproduction + replay spec + environment + knowledge), stored
forever, and re-executed by the historical regression suite on future builds.

The module is not wired into the packaged Electron app, spawns no processes,
performs no network I/O, and grants no write/release authority.

## Components

| File | Responsibility |
|------|----------------|
| `case.js` | `RegressionCaseStore`: permanent case storage. **No delete/update API** — coverage can only ever be added, never silently removed. |
| `generate.js` | `RegressionTestGenerator`: converts a confirmed bug (bug case + reproduction + optional environment + knowledge) into a deterministic, serializable regression case. Rejects bugs without a final failing event. |
| `suite.js` | `RegressionSuite`: executes the full historical suite through the M7 `ReplayEngine`, reconstructing the handler from each case's `replay_spec`. A case passes only when the exact fingerprint is reproduced. |
| `index.js` | `RegressionEngine` orchestrator wiring store + generator + suite, with optional M4 `BugCaseStore` back-linking via `regression_test_refs`. |
| `test/*.test.js` | Assert-based tests following the repo convention; each uses a `mkdtempSync` temp dir cleaned in a `finally` block. |

## Verification

Run with:

```powershell
npm --prefix auto-fix/regression-engine test
# or, from the auto-fix root:
npm --prefix auto-fix run test:regression-engine
```

## Security notes

- No new npm dependencies; reuses `bug-intelligence/store.js` and
  `reproduction-lab/replay.js` only.
- Replay is deterministic and in-process; the replay spec is plain data, never
  executable code or a function reference.
- Regression cases are append-only by design, preventing silent suite erosion.
- All persisted data is sanitized through the shared redaction discipline of the
  existing modules.

## Known limitations

- The `auto-patch-loop` (M8) directory still contains only a `package.json`
  stub and no implementation or tests; its `test:auto-patch-loop` entrypoint
  references files that do not exist. This is a pre-existing gap outside the
  scope of M9 and should be resolved as part of M8.
- The suite replays event-driven failure paths, not compiled application code
  (same limitation inherited from M7's deterministic ReplayEngine).
- Regression cases are file-backed JSON; production scale would need a real
  database and concurrent-run locking.

## Next milestone

MILESTONE 10 — BUILD / RELEASE (package, artifact, signing integration,
release metadata).