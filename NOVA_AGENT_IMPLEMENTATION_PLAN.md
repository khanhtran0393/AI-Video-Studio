# NOVA AGENT IMPLEMENTATION PLAN (Verified + Aligned)

Status snapshot: this plan is aligned to current codebase behavior and is **documentation-only**.

## 0) Baseline constraints (must preserve)

- NOVA video-agent must continue to use current SSOT spec/timeline/validator chain.
- Auto-Fix control plane remains deny-by-default (`auto-fix/config/policy.json`, `auto-fix/policy.js`).
- No behavior changes were introduced in this pass; this file only documents alignment and next implementation steps.

---

## 1) What is already implemented (confirmed)

### 1.1 Core NOVA job harness
- `createVideoJob` exists and already provides full lifecycle: run, cancel, events, results (`orchestrator/index.js`).
- Stage progression and state persistence exists (`orchestrator/states.js`, `orchestrator/index.js`, `persist` to `output/job.json`).
- Timeout/cancel path, preview-before-full gate, final QA gate, and uploader boundary already implemented.

### 1.2 Agentic planning chain
- Discovery/analysis modules for script/TTS/assets/story/visual/spec are present and wired.
- Spec schema validator and timeline hashing already in place.
- QA baseline + optional vision providers are available.

### 1.3 Auto-Fix + bounded mutation logic
- `auto-fix/loop.js` exists with capped attempt loop and non-degradation acceptance.

### 1.4 Control-plane guardrails
- Auto-Fix policy, boundaries, audit, provenance, readiness gates, and repository checks are present and validated by tests.

### 1.5 Tool mediation (agent)
- Milestone-5/6 tool mediation stack exists under `auto-fix/agent/` with supervisor/sandbox/policy layers.
- Proposed edits remain proposal-only by default in current milestone (`agent-tools.js`, `read-only-backend.js`, `patch-proposal.js`).

---

## 2) Implementation plan to complete harness alignment

### Phase A — Documentation consolidation (this pass, done)
1. Align docs to verified entrypoints and remove stale paths.
2. Keep terminology consistent:
   - `orchestrator/analyze.js` (not `analyze/index.js`)
   - `timeline/engine.js` (not `timeline/index.js`)
   - `auto-fix/agent/tool-definitions.js` (not missing `auto-fix/agent/tool-registry.js`)

### Phase B — Runtime hardening (future, no behavior edits yet)
1. Add a focused startup health check for NOVA job adapters:
   - verify `createRendererAdapter`, `createUploader`, `remotion/bridge` path, and `vision` optional provider existence.
2. Surface clear adapter capability diagnostics in `output/job.json` metadata.

### Phase C — Harness compatibility (future)
1. Add a small doc/trace map for tool invocation contracts in `auto-fix/agent/tool-definitions.js` consumed by `supervisor` outputs.
2. Add explicit status mapping for blocked reasons to UI-facing diagnostics for `runDebugAgent`/agent CLI.

### Phase D — Milestone progression (if enabling writes)
1. Keep proposal-first behavior until policy authorities are intentionally enabled.
2. For any future authority enablement:
   - gate by explicit milestone checks,
   - maintain `highRiskRequiresHumanApproval` workflow,
   - expand evidence logs and readiness gates in lockstep.

---

## 3) Work completed from architecture perspective

- Verified all required entrypoint paths and recorded mismatches.
- Recorded authoritative control-plane posture and role boundaries.
- Updated doc set to avoid claims not currently supported by source.

---

## 4) Risks and dependencies to watch

- **Path drift risk**: auto-generated docs and tool names must match exact file paths in repo.
- **Renderer path dependency**: `remotion/bridge.js` requires renderer availability in Electron environments.
- **Policy coupling risk**: if future runtime writes are added, tests and readiness gates must be adjusted first.
- **Worktree consistency**: root and `.kilo/worktrees/alkaline-hook` may diverge; docs should be kept in both only when explicitly synchronized.

---

## 5) Acceptance criteria (code-grounded)

1. Running reads/analyses should only reference verified files.
2. No docs should assert features from non-existent paths in this tree snapshot.
3. Policy remains observe-only unless a later change explicitly flips authorities and updates tests accordingly.
4. NOVA harness behavior remains SSOT on `orchestrator/index.js` + `video-spec/schema.js` + `timeline/engine.js` + `qa/qa.js`.

## 6) Source anchors (evidence)

- `d:\AI Video Studio\nova\video-agent\orchestrator\index.js`
- `d:\AI Video Studio\nova\video-agent\orchestrator\states.js`
- `d:\AI Video Studio\nova\video-agent\orchestrator\analyze.js`
- `d:\AI Video Studio\nova\video-agent\project\discover.js`
- `d:\AI Video Studio\nova\video-agent\script\analyzer.js`
- `d:\AI Video Studio\nova\video-agent\tts\analyzer.js`
- `d:\AI Video Studio\nova\video-agent\story\plan.js`
- `d:\AI Video Studio\nova\video-agent\visual-plan\plan.js`
- `d:\AI Video Studio\nova\video-agent\video-spec\build.js`
- `d:\AI Video Studio\nova\video-agent\video-spec\schema.js`
- `d:\AI Video Studio\nova\video-agent\timeline\engine.js`
- `d:\AI Video Studio\nova\video-agent\qa\qa.js`
- `d:\AI Video Studio\nova\video-agent\qa\vision.js`
- `d:\AI Video Studio\auto-fix\config\policy.json`
- `d:\AI Video Studio\auto-fix\policy.js`
- `d:\AI Video Studio\auto-fix\path-boundary.js`
- `d:\AI Video Studio\auto-fix\audit.js`
- `d:\AI Video Studio\auto-fix\gates.js`
- `d:\AI Video Studio\auto-fix\agent\tool-definitions.js`
- `d:\AI Video Studio\auto-fix\agent\supervisor.js`
- `d:\AI Video Studio\auto-fix\agent\sandbox.js`
- `d:\AI Video Studio\auto-fix\agent\command-policy.js`
- `d:\AI Video Studio\auto-fix\agent\agent-tool-layer.js`
