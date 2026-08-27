# Milestone 12 — Canary / Monitoring

STATUS: PASS

## Scope

Implements canary rollout and production monitoring from spec section 22 and
milestone 12 as a **standalone, disconnected module** under
`auto-fix/canary-monitoring/`. The module models a staged rollout of
`5% -> 25% -> 50% -> 100%`, compares each stage's health metrics against the
previous stable baseline and configured thresholds, promotes only while
healthy, stops automatically on a degraded breach, and rolls back on a critical
breach.

The module is not wired into the packaged Electron app, performs no network or
release actions itself, and grants no write/release authority. The controller
only mutates its own store and emits audit events, so the model can never drive
real production rollout on its own.

## Components

| File | Responsibility |
|------|----------------|
| `rollout-policy.js` | Pure staged-rollout primitives: fixed `5/25/50/100%` stages, stage-index validation, sequential promotion helpers. |
| `thresholds.js` | Metric definitions (`crash_rate`, `error_rate`, `startup_failure_rate`, `update_failure_rate`, `performance_p95_ms`, `feature_failure_rate`), default thresholds, and `evaluateHealth` comparing against the previous stable baseline (absolute and relative breach detection, `healthy/degraded/critical` classification). |
| `rollout-store.js` | `RolloutStore`: durable rollout state with append-only history (`idle/active/held/stopped/rolled_back/completed`). No delete API; stages can only advance sequentially; the only backward path is `rollback()`. |
| `rollout-controller.js` | `RolloutController` state machine: `healthy -> promote`, `degraded -> stop`, `critical -> rollback`, missing/invalid metrics -> `hold`. |
| `index.js` | Exports the policy, threshold, store, and controller pieces. |
| `test/*.test.js` | Assert-based tests following the repo convention; each uses a `mkdtempSync` temp dir cleaned in a `finally` block. |

## Verification

Run with:

```powershell
npm --prefix auto-fix/canary-monitoring test
# or, from the auto-fix root:
npm --prefix auto-fix run test:canary-monitoring
```

## Security notes

- No new npm dependencies; reuses only the shared `bug-intelligence/store.js`.
- The controller never reaches the network, filesystem (beyond its own injected
  store), release pipeline, or updater. It emits decisions + audit records only.
- Rollback incidents can be turned into permanent M9 regression cases via the
  existing `source_kind: "rollback-incident"`, demonstrated in `test/index.test.js`.
- State transitions are sequential and idempotence-guarded (`start` while
  active, `rollback` twice, `promote` out of order, and `complete` before the
  final stage all throw).

## Known limitations

- This is a decision/state layer only; real metric ingestion from client
  telemetry and real kill-switch/updater enforcement belong to their own
  milestones (M2 telemetry, M11 updater) and controlled infrastructure.
- Threshold constants are defaults for demonstration; production would tune
  them per-application and enforce a minimum sample window.
- File-backed JSON state; production scale would need a database and
  concurrent-run locking.

## Next milestone

MILESTONE 13 — AUTONOMOUS MODE (only after all previous milestones are stable:
low-risk auto release, high-risk human approval, autonomous repair/regression/
feedback loop, cost/token/iteration budget, audit and emergency disable).