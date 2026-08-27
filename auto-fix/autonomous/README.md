# Autonomous Mode – Milestone 13

Orchestrates the end‑to‑end auto‑fix pipeline:

1. **Repair** – runs the `PatchLoop` (M8) on a bug.
2. **Regression** – generates a permanent regression test via `RegressionEngine` (M9).
3. **Risk** – evaluates patch size, affected high‑risk areas, and AI confidence to classify as low / medium / high.
4. **Decision**:
   - **Low** + `runtimeEnabled` + `release/rollout/rollback` authorities → **auto‑release** (starts canary).
   - Otherwise → **escalate** to human.
5. **Feedback** – monitors the canary and auto‑rollbacks on critical health breaches.

## Policy Requirements

To enable autonomous releases, update `auto-fix/config/policy.json`:

```json
{
  "runtimeEnabled": true,
  "authorities": {
    "release": true,
    "rollout": true,
    "rollback": true
  }
}
```

All other authorities (`writeSource`, `executeCommands`, etc.) should remain `false` unless explicitly reviewed. The autonomous controller never overrides policy.

## Usage

```js
const { AutonomousController } = require('./autonomous');
const controller = new AutonomousController({ bugCases, repairAttempts, patchLoop, regressionEngine, rolloutController, buildRelease, policy });
const result = await controller.processBug('BUG-123', { version: '1.5.0' });
if (result.status === 'auto-release-initiated') {
  // Monitor the rollout
  const feedback = controller.monitorRollout(result.release_id, 'BUG-123', { metrics, baseline });
}
```

## Tests

Run `npm run test:autonomous` from `auto-fix/` to execute the unit tests.