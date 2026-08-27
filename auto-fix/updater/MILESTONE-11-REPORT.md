# Milestone 11 — Updater

STATUS: PASS

## Scope

Implements the updater from spec sections 25–26 and 33–35 as a **standalone,
disconnected module** under `auto-fix/updater/`. It models the full lifecycle —
version check, download-model staging, hash verification, signature
verification, safe-stop (as a recorded lifecycle transition), install with
backup, deterministic health check, and automatic rollback — without performing
network I/O, spawning processes, or touching the real installed application.

Consistent with `CONTROL.md` (auto-update authority remains "EXISTING APP
ONLY", rollback authority remains OFF) and the still-incomplete M10 signing
infrastructure, this module is a fail-closed control-plane implementation that
never grants rollout or rollback authority to the AI or to production.

## Components

| File | Responsibility |
|------|----------------|
| `metadata.js` | Untrusted update-metadata validation and deterministic semver-like version comparison. Rejects malformed versions, channels, hashes, and signatures. |
| `verify.js` | SHA-256 artifact hashing plus detached Ed25519 signature verification over `version:sha256`. Verification is fail-closed. |
| `installer.js` | Staged install with `current`/`previous`/`staging` directories, atomic copy, and rollback restore. Rejects install roots containing denied directory names. |
| `health-check.js` | Deterministic post-update health evaluation. Critical probe failures fail; no probes fail closed. |
| `history.js` | Append-only update-attempt and rollback-incident history. No delete API. |
| `index.js` | `UpdaterEngine` orchestrator composing the full lifecycle with audit hooks. |
| `test/*.test.js` | Assert-based tests following repo convention (mkdtemp + finally cleanup). |

## Verification

```powershell
npm --prefix auto-fix/updater test
# or, from the auto-fix root:
npm --prefix auto-fix run test:updater
```

Result: 5/5 test files PASS (metadata, verify, installer, health-check, index).

The engine also runs as part of the root `npm --prefix auto-fix run test:all`
entrypoint.

## Security notes

- No new npm dependencies; uses only `node:crypto` and the shared
  `bug-intelligence/store.js` `JsonStore`.
- No network I/O, no child processes, no shell execution, no access to the
  real `resources/app` or installed application.
- Signature verification is bound to both version and artifact hash, preventing
  version/hash substitution and replay of an old valid signature.
- Install root is sandboxed and rejects `resources`, `dist`, `node_modules`,
  and `.git` directory names.
- Update and incident history is append-only, matching the regression case
  store's no-delete discipline.

## Known limitations

- This is a lifecycle model, not a wired `electron-updater` replacement. The
  packaged app's `electron-updater` remains disabled by default
  (`AI_VIDEO_STUDIO_ENABLE_UPDATES=1` gate, `publish: null`, and
  `verifyUpdateCodeSignature: false`).
- No real network download is performed; the "download" phase stages a
  caller-provided local artifact, so TLS/transport trust is out of scope here.
- `verifyUpdateCodeSignature` remains `false` in the existing builder
  configuration; enabling production code-signature verification is a
  controlled-signing (M10/M12) concern, not this module.
- File-backed history is appropriate for a standalone control-plane module,
  not production scale (no concurrent-run locking).

## Next milestone

MILESTONE 12 — CANARY / MONITORING (staged rollout, metrics, thresholds,
automatic stop, kill switch).