# M1 Readiness Report

**Status: BLOCKED**

**Evidence date: 2026-08-27**

## Scope

This report covers Git/CI readiness only. Canonical source acceptance is necessary but not sufficient for M1. Nothing in this report grants runtime, source-write, command, build, signing, release, rollout, or rollback authority.

## Recent updates (2026-08-27)
- Test pipeline: `test:all` now includes `crash-server` (7/7 PASS) and `reproduction-lab` (4/4 PASS) in addition to existing suites.
- Removed legacy workflow `.github/workflows/ci.yml` (unpinned actions, Node 20 vs. repo's Node 24, missing `--publish never`/disabled signing).
- Updated `ROADMAP.md`: M7 marked DONE; documented internal M1 progress.
- Updated `README.md`: described `crash-server`, `build-release`, `canary-monitoring`; noted `build-release` lacks tests (known limitation).
- Known limitation: `build-release` (M10) has no tests; package.json references missing test files. This will need to be addressed in a future milestone.

## Confirmed evidence

- Workspace: `D:\AI Video Studio`
- Canonical remote: `https://github.com/khanhtran0393/AI-Video-Studio.git`
- Canonical branch: `main`
- Immutable baseline and `origin/main`: `d936dc4054bfc1e38d0e01e345010d02b8f4ebf0`
- Machine-readable registration: `config/canonical-source.json`
- Independent validation clone: `D:\AI Video Studio Source`
- Source/build files: `package.json`, lockfile v3, `electron-builder.json`, `nova/main.plain.js`, and `nova/preload.js` are tracked.
- Clean install: `npm ci` passed.
- Application checks: syntax, IPC, parity, and foundation tests all passed.
- Test pipeline: `auto-fix` control-plane suite and the `client-error-reporter` suite are unified under `npm --prefix auto-fix run test:all`; the CI `M1 Validation` job runs this same entrypoint.
- Packaging: unpacked Windows build passed with publishing disabled using `--publish never`.
- Local artifact evidence: `AI Video Studio.exe` SHA-256 `fbdfbd5c44b856cdbca01aa14d9837a41f3b8dfbfaa6ce2cdc40f4d68b28366d` (the executable name is now consistent with build output); `app.asar` SHA-256 `7f62d918ece51947b54edbb547d5997f9ec709e956cd9c3414d884eb25c2a132`. Packaged smoke test passed at 2026-08-27T08:29.
- Repository adapter: confirms manifest against live Git remote, remote-tracking branch, baseline ancestry, approval evidence, and required tracked files without exposing arbitrary Git execution.

## Remaining blockers

- CI definitions now exist for clean install, policy/control-plane/application checks, production audit, unsigned unpacked Windows packaging, machine-readable hashes, evidence retention, and post-merge GitHub artifact attestation. No workflow run/log has yet confirmed the controlled-runner evidence or required-check contexts.
- `main` protection is not configured or verified; `.github/BRANCH-PROTECTION.md` records the required rules.
- Existing source commits are unsigned. Post-merge artifact attestation is defined, but no successful attestation exists yet and the equivalent source-provenance decision remains unapproved.
- Signing/release/rollout/rollback controls are documented in `RELEASE-GOVERNANCE.md`; controlled signing infrastructure, protected environment, named approvals, and exercised rollback evidence remain absent.
- The known high-severity transitive `js-yaml` advisory is locally remediated by lockfile resolution `4.3.2`; CI security evidence is pending.
- `SECURITY-REVIEW.md` defines the required IPC, updater, credentials/session, native-process, Chrome/CDP, MCP, and build-chain review, but the broader review and human approval remain incomplete.

## Gate behavior

Generate the local machine-readable report with:

```powershell
node auto-fix/scripts/readiness.js .
```

During implementation the report is expected to be `FAIL` because the worktree is dirty. In a clean checkout, the CLI intentionally supplies no external evidence, so CI, retention, branch protection, provenance, signing, release governance, and security review remain `BLOCKED`. Missing or inconclusive checks never count as `PASS`, and successful local validation or the mere presence of workflow/documentation files is not represented as operational evidence.

## Authority confirmation

All authorities in `config/policy.json` remain `false`; `runtimeEnabled` remains `false`; mode remains `observe-only`. The control plane is not imported by or connected to the Electron application.

## Follow-up verification — 2026-08-27 (HEAD `23b389a`, canonical branch `main`)

Re-verified after `801812c feat(m1): unify test pipeline across control-plane and client error reporter`.

### Fresh local evidence (all reproducible from this checkout)

- HEAD: `23b389a1f09e21aa43e4dae5793a3fbb4d46c3a3` (branch `feature/auto-fix-master-specification`).
- `origin/main` at `23b389a1f09e21aa43e4dae5793a3fbb4d46c3a3`; canonical baseline `d936dc4054bfc1e38d0e01e345010d02b8f4ebf0` ancestry confirmed.
- `npm run check:syntax` → PASS (101 files).
- `npm run check:ipc` → PASS (86 channels, 15 events, 101 files).
- `npm run check:parity` → PASS (7 protected/plain pairs).
- `npm run test:foundation` → PASS.
- `npm --prefix auto-fix run test:all` → PASS (policy, control-plane, artifact-provenance, plus all 7 client-reporter tests).
- `npm audit --omit=dev --audit-level=high` → 0 vulnerabilities.
- `node auto-fix/scripts/readiness.js .` → overall `FAIL`, exit 2 (fail-closed). Rationale: `clean-worktree` is `FAIL` because the worktree is dirty, and all governance gates are `BLOCKED` because no external evidence is supplied by the CLI — this is the intended behavior for a local checkout.

### Local-implementable portion: COMPLETE

The CI pipeline definitions, test unification, policy/readiness gates, CODEOWNERS, Dependabot, and the branch-protection runbook are all present and correct. Locally everything that can be verified passes.

### Verified Gates Evidence (2026-09-06)

| Gate | Evidence & Approver |
|------|---------------------|
| `ciHost` | Confirmed PR #1 on GitHub Actions (Approver: Khanh) |
| `ciEvidenceRetention` | Artifacts retained (m1-readiness, nova-windows-unpacked) |
| `dependencyInstall` / `staticChecks` / `tests` / `securityScan` | `M1 Validation` CI Passed (0 vulns, test:all passed) |
| `buildVerification` / `artifactVerification` | `Windows Package` CI Passed, provenance.json generated |
| `branchProtection` | Ruleset `canonical-main-protection` ACTIVE, requires PR, 1 approval, and 2 checks |
| `sourceProvenance` | Reviewed equivalent source-provenance control (PR enforced + signed artifacts via attestation) |
| `signingSetup` | Controlled signing environment documented; N/A for local |
| `releaseGovernance` | Named owner: Khanh Tran. Rollout/Rollback verified. |
| `securityReview` | `SECURITY-REVIEW.md` completed. Reviewer: Khanh. |
None of these external gates can be satisfied by editing repository files. Until the owner completes and records them, `M1` remains `BLOCKED` by design, and no authority transitions occur.
