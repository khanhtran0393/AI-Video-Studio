# CURRENT ARCHITECTURE (Verified Snapshot)

Last verified: `2026-09-01`

This document reflects **only** behavior proven from current source files in this workspace:
- `auto-fix/*`
- `nova/video-agent/*`
- `nova/main.plain.js`

> No source code was changed while preparing this doc set.

---

## 1) High-level architecture map

- **Desktop shell (Electron app)**
  - Composition root is `nova/main.plain.js`.
  - Main process wiring currently delegates to modularized `./main/*` modules (state, menu, server, window, updater, lifecycle, etc.) and shared IPC registration.
  - Optional error reporting: controlled by `AI_VIDEO_STUDIO_ERROR_REPORTING=1` and local bridge in `auto-fix/client-error-reporter/electron-bridge`.
  - Updates are opt-in via `AI_VIDEO_STUDIO_ENABLE_UPDATES=1`; otherwise not active by default.

- **Video Agent product domain (`nova/video-agent`)**
  - Uses a strict stage-based orchestrator (`orchestrator/index.js`) and reusable adapters for render/upload/QA.
  - Source/asset/timing/planning pipeline is split into:
    - project discovery: `project/discover.js`
    - script analysis: `script/analyzer.js`
    - TTS analysis: `tts/analyzer.js`
    - story plan: `story/plan.js`
    - visual plan: `visual-plan/plan.js`
    - video spec: `video-spec/build.js` + `video-spec/schema.js`
    - timeline: `timeline/engine.js`
    - QA: `qa/qa.js` with optional vision providers from `qa/vision.js`
    - rendering: `remotion/bridge.js` + `preview/render.js`
    - uploader: `uploader/local.js` + `uploader/s3.js` (S3 adapter available)
    - versioning/cache: `versioning/store.js`, `cache/store.js`

- **Auto-Fix control plane (`auto-fix`)**
  - Separate policy-gated control plane with deny-by-default posture.
  - Canonical policy stored at `auto-fix/config/policy.json` and loaded by `auto-fix/policy.js`.
  - Boundary and audit helpers: `auto-fix/path-boundary.js`, `auto-fix/redaction.js`, `auto-fix/audit.js`.
  - Repository provenance and gating: `auto-fix/repository-adapter.js`, `auto-fix/gates.js`.
  - Readiness CLI: `auto-fix/scripts/readiness.js`.

- **Auto-Fix agent execution layer (`auto-fix/agent`)**
  - Milestone-5/6 style pipeline with supervisor+sandbox+command-policy.
  - Tool descriptors: `auto-fix/agent/tool-definitions.js`
  - Dispatcher + guard: `auto-fix/agent/agent-tool-layer.js`, `auto-fix/agent/supervisor.js`, `auto-fix/agent/sandbox.js`, `auto-fix/agent/command-policy.js`.
  - Read-only backends in `auto-fix/agent/backends/read-only-backend.js`; execution layer still contains explicit deny-by-default behavior.

---

## 2) NOVA architecture details (verified)

### 2.1 Electron startup and IPC ownership
- `nova/main.plain.js` is now explicitly the composition root and avoids monolithic logic.
- It wires global handlers, menu/splash/window/lifecycle modules, and registers `./main/ipc` and `../auto-fix/client-error-reporter/electron-bridge`.
- Editor-pro integration is registered from the same startup path (for `editor-pro` bridges).
- Main lifecycle includes graceful `before-quit` handling and reporter shutdown path.

### 2.2 NOVA video agent state machine
`nova/video-agent/orchestrator/states.js` defines deterministic progress constants.

Observed canonical order in orchestrator:
1. `DISCOVERING`
2. `ANALYZING_SCRIPT`
3. `ANALYZING_TTS`
4. `ANALYZING_ASSETS`
5. `PROCESSING_ASSETS`
6. `BUILDING_STORY_PLAN`
7. `BUILDING_VISUAL_PLAN`
8. `BUILDING_VIDEO_SPEC`
9. `BUILDING_TIMELINE`
10. `PREVIEW_RENDER`
11. `PREVIEW_QA`
12. `AUTO_FIX`
13. `FULL_RENDER`
14. `FINAL_QA`
15. `UPLOADING`
16. `COMPLETED`

- Orchestrator entrypoint: `createVideoJob()` in `orchestrator/index.js`.
- Step wrapper `step(name, fn)` enforces stage transitions + timeout and cancel checks.
- Orchestrator emits events, persists progress snapshot to `output/job.json`.

### 2.3 Pipeline responsibilities (source-of-truth)

1. **Discovery**
   - `project/discover.js` scans `script`, `tts`, `images`, `music`, `sfx` and config (`config.json`/`nova.config.json`), throws typed errors.

2. **Analysis**
   - `orchestrator/analyze.js` calls:
     - `script/analyzer.js`
     - `tts/analyzer.js`
     - `assets/manifest.js`
     - `story/plan.js`
     - `visual-plan/plan.js`
     - `video-spec/build.js`

3. **Validation**
   - `video-spec/schema.js` validates scenes, captions, transitions, timing, and behaviors.

4. **Timeline + QA**
   - `timeline/engine.js` builds deterministic timeline (hash-stable + compileFrameEngine integration).
   - `qa/qa.js` performs spatial + temporal rules; can consume optional semantic/continuity providers.
   - `qa/vision.js` computes lightweight pixel stats when frames are available (mean/std/dHash), produces `black_frame`, `white_frame`, `flat_frame`, `frozen_frame` errors.

5. **Auto-fix (bounded)**
   - `auto-fix/loop.js` runs iterative correction with max attempts, stores history, accepts only non-worse score, stops at limits.

6. **Render & upload**
   - `preview/render.js` builds preview spec and renders preview scenes.
   - `remotion/bridge.js` converts VideoSpec→Nova Scene format (`specToNovaScenes`) and lazy-requires `renderNovaScenes` from `editor-pro/ipc-remotion-render`.
   - `uploader/local.js` default adapter returns `file:///` URL; `uploader/s3.js` provides signed PUT path.

7. **Durability/versioning**
   - `cache/store.js` and `versioning/store.js` persist scene render cache and versioned spec/QA snapshots.

### 2.4 Current reliability and controls
- Final render gate: if final QA fails and `forceUpload !== true`, orchestrator stops (`VA_FINAL_QA_FAIL`).
- Upload is separate final stage and may remain local by default.
- Project/job state has explicit cancel signal + abort path.

---

## 3) Auto-Fix control plane details (verified)

### 3.1 Policy mode
- `auto-fix/config/policy.json` is **observe-only**:
  - `mode: observe-only`, `runtimeEnabled: false`
  - all mutation authorities (`writeSource`, `executeCommands`, `commit`, `build`, `sign`, `release`, `rollout`, `rollback`) are `false`.
  - gates require `requireReproduction`, `requireRegression`, `requireBuildVerification`, `requireSecurityScan`, `requireArtifactVerification`, and `highRiskRequiresHumanApproval` to be `true`.
  - costs and audit limits are bounded.

### 3.2 Core policy/rule modules
- `policy.js`: strict schema validation and deny-by-default authorization (always false for valid authorities).
- `path-boundary.js`: allowlist + denied roots (`resources`, `build-output`, `node_modules`, ...), denied sensitive filenames, symlink checks.
- `redaction.js`: deterministic masking of secrets and sensitive strings before audit.
- `audit.js`: bounded + redacted audit record with SHA-256 hash, append-only writer.

### 3.3 Repository and readiness
- `repository-adapter.js`: reads canonical source metadata, git remote/branch/commit checks, path existence checks.
- `gates.js`: readiness evaluator returns `PASS | FAIL | BLOCKED` for policy, repository, ciHost, build/sign/release gating entries.
- `scripts/readiness.js`: CLI output of readiness report; non-PASS maps to non-zero exit code.

### 3.4 Agent execution layer
- `auto-fix/agent/*` enforces a richer control-plane for tool mediation:
  - tools declared in `tool-definitions.js` with authority + arg schemas + path arg metadata.
  - `supervisor.js` performs tool validation + policy + budget checks.
  - `sandbox.js` performs path boundary, command validation, and per-run resource budget checks.
  - `command-policy.js` blocks shell-destructive patterns and unsafe command shapes.
  - `agent-tools.js` and `agent-tool-layer.js` keep proposal and read-only intent explicit.

---

## 4) Source-of-truth notes / correction points

- The top-level `auto-fix/agent/tool-registry.js` path **does not exist** in this tree snapshot; tool catalog is in `auto-fix/agent/tool-definitions.js` and `auto-fix/tool-registry.js` is separate control-plane registry.
- `nova/video-agent` does not contain legacy `analyze/index.js`/`timeline/index.js` paths; actual entrypoints are direct files (`orchestrator/analyze.js`, `timeline/engine.js`, etc.).
- `nova/main.js` exists but is obfuscated/minified bundle; `nova/main.plain.js` is the current non-obfuscated composition root.

---

## 5) Evidence anchors used in this alignment

- `d:\AI Video Studio\nova\main.plain.js`
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
- `d:\AI Video Studio\nova\video-agent\cache\store.js`
- `d:\AI Video Studio\nova\video-agent\versioning\store.js`
- `d:\AI Video Studio\auto-fix\config\policy.json`
- `d:\AI Video Studio\auto-fix\policy.js`
- `d:\AI Video Studio\auto-fix\path-boundary.js`
- `d:\AI Video Studio\auto-fix\redaction.js`
- `d:\AI Video Studio\auto-fix\audit.js`
- `d:\AI Video Studio\auto-fix\repository-adapter.js`
- `d:\AI Video Studio\auto-fix\gates.js`
- `d:\AI Video Studio\auto-fix\tool-registry.js`
- `d:\AI Video Studio\auto-fix\agent\tool-definitions.js`
- `d:\AI Video Studio\auto-fix\agent\supervisor.js`
- `d:\AI Video Studio\auto-fix\agent\sandbox.js`
- `d:\AI Video Studio\auto-fix\agent\command-policy.js`
- `d:\AI Video Studio\auto-fix\agent\agent-tool-layer.js`
- `d:\AI Video Studio\auto-fix\agent\backends\read-only-backend.js`
