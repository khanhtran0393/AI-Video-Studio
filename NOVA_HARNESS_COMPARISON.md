# NOVA HARNESS COMPARISON (Observed)

Last verified: `2026-09-01`

This comparison captures how the current NOVA implementation aligns with the
intended harness boundaries and where gaps remain.

## 1) Orchestrator harness

- **Observed source**: `nova/video-agent/orchestrator/index.js` (+ `orchestrator/states.js`)
- **Model**: explicit `createVideoJob({ projectDir, adapters, options })` that returns `on`, `run`, `cancel`, `result`.
- **State timeline** is deterministic and event-driven:
  - `CREATED`, `DISCOVERING`, `ANALYZING_*`, `BUILDING_*`, `BUILDING_TIMELINE`, `PREVIEW_RENDER`, `PREVIEW_QA`, `AUTO_FIX`, `FULL_RENDER`, `FINAL_QA`, `UPLOADING`, `COMPLETED`.
- **Adapter pattern** is in place:
  - render adapter via `createRendererAdapter()` in `remotion/bridge.js`
  - upload adapter via `createUploader(...)` (local + s3/custom)
  - QA provider hooks via `adapters.qaProviders` and optional preview/vision providers
- **Control features**:
  - step timeout via `options.stageTimeoutMs` (default 30m)
  - cancel with `AbortController` + external callback
  - persisted `output/job.json` with recent events.

## 2) Discovery/analysis harness

| Concern | Observed implementation | Evidence
| --- | --- | --- |
| Folder discovery | `project/discover.js` infers `script`, `tts`, `images`, `music`, `sfx` | script/timestamps matching logic and config loader
| Script parsing | `script/analyzer.js` | deterministic scene segmentation, optional AI refinement
| TTS alignment | `tts/analyzer.js` | prefer timestamps JSON, fallback to deterministic alignment with ffprobe duration
| Story planning | `story/plan.js` | deterministic sentence-to-scene assignment and timing continuity
| Visual planning | `visual-plan/plan.js` | deterministic heuristic + optional AI visual refinement
| Spec build | `video-spec/build.js` | builds SSOT spec with background/elements/transitions/captions and behavior fallback

## 3) Validation and timeline harness

- **Schema validation**: `video-spec/schema.js`
  - IDs, scene ordering, camera/transition validity
  - caption boundaries inside scene
  - audio bound check (`VA_SPEC_AUDIO_BOUND`)
  - optional behavior/world-state/constraint integration
- **Timeline engine**: `timeline/engine.js`
  - deterministic `frameAt`, timeline hash, behaviorGraph metadata
  - timeline inspection includes overlaps/gaps/transition-length bounds (`VA_TL_*` semantics in returned issues).

## 4) QA harness

- Baseline QA: `qa/qa.js`
  - Spatial, temporal, plus optional semantic/continuity providers
  - score aggregation and pass/warning/fail decision
- Vision QA: `qa/vision.js`
  - frame sampling via ffmpeg, per-scene stats (mean/std/hash)
  - errors like `black_frame`, `white_frame`, `flat_frame`, `frozen_frame`
  - used via provider factory and passed into `runQA()` when supplied.

## 5) Render/uploader harness

- `remotion/bridge.js`:
  - `specToNovaScenes` maps spec→scene layers/camera/transitions/captions.
  - default adapter lazy-requires `../../editor-pro/ipc-remotion-render`.
  - missing renderer returns `VA_RENDERER_UNAVAILABLE` (safe fail behavior in non-Electron/plain context).
- `preview/render.js`:
  - preview subset of scenes before full render
  - output default 480p for quick iteration.
- `uploader/local.js`:
  - default file URL provider and local metadata.
- `uploader/s3.js`:
  - direct SigV4 PUT path; configurable creds/envs; dedicated error codes documented in module behavior.

## 6) Auto-Fix control-plane harness alignment

- Policy: deny-by-default, observe-only, read-only authority posture confirmed by `auto-fix/policy.js` and `config/policy.json`.
- Command/path enforcement: `auto-fix/agent/command-policy.js`, `path-boundary.js`, `agent/sandbox.js`.
- Tool mediation: `agent/tool-definitions.js`, `supervisor.js`, `agent-tool-layer.js`.
- Readiness/evidence gates: `repository-adapter.js` + `gates.js` + `scripts/readiness.js`.

## 7) Gap / mismatch log (currently observed)

- `nova/video-agent/analyze/index.js` is not present as a file in this tree snapshot;
  current analysis entrypoint is `orchestrator/analyze.js`.
- `nova/video-agent/timeline/index.js` is not present; timeline entry is `timeline/engine.js`.
- `auto-fix/agent/tool-registry.js` path is absent in this snapshot; separate control-plane registry remains at `auto-fix/tool-registry.js`.
- `auto-fix/agent/index.js` and `auto-fix/agent/README.md` are not present here.

## 8) Recommended harness updates from gap log

1. Update architecture docs to the verified entrypoints above (avoid stale `index.js` references).
2. Keep references to `nova/main.plain.js` as Electron startup composition point instead of minified `nova/main.js`.
3. Mark Auto-Fix tool surfaces as **proposal/read-only-first**, with explicit “not applied” semantics in current milestone.

## 9) Confidence

This file is a **code-grounded comparison** derived from direct reads of current source files.
