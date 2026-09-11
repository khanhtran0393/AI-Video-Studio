# NOVA VIDEO AGENT — Phase 1 + 3 + 4 + 5 (`nova/video-agent/`)

Cài đặt theo spec **NOVA VIDEO AGENT v1.0** (§38: Phase 1 core + Phase 3 Asset Intelligence,
Phase 4 Vision QA, Phase 5 S3/CDN uploader — tái dùng hệ thống sẵn có, không duplicate engine).

## Kiến trúc — reuse từ repo hiện có
- **Renderer**: tái dùng **Nova Scene engine** (`nova/editor-pro/nova-remotion/`, composition `NovaSequence`) qua
  `renderNovaScenes()`. Visual Grammar (§13) map 1-1 vào preset `anim.js` + `transitions.json` đang có.
- **TTS fallback**: tái dùng `nova/documentary/core/alignment.js` + `ffprobe-static` (duration audio thật).
- **Không thêm dependency mới** — validator tự viết (không zod), cache/versioning file-based (không Redis/BullMQ).

## Luồng (§26 state machine)
`DISCOVERING → ANALYZING_SCRIPT → ANALYZING_TTS → ANALYZING_ASSETS → PROCESSING_ASSETS → BUILDING_STORY_PLAN → BUILDING_VISUAL_PLAN → BUILDING_VIDEO_SPEC → BUILDING_TIMELINE → PREVIEW_RENDER → PREVIEW_QA → (AUTO_FIX ≤5 → NEEDS_REVIEW) → FULL_RENDER → FINAL_QA → UPLOADING → COMPLETED | FAILED | CANCELLED`

## Nguyên tắc giữ vững
- **TTS là Master Clock** (§1.1): scene = end của cảnh trước → end câu cuối; không vượt `audio.duration`.
- **Video Spec là SSOT** (§1.2): mọi tầng đọc/ghi spec, validate bằng `video-spec/schema.js` (error code cấu trúc).
- **Deterministic** (§16): timeline có hash SHA-1 ổn định; AI chỉ chọn tên preset, engine diễn giải (§1.3).
- **Auto-Fix có giới hạn** (§21): max 5 attempt, mỗi attempt 1 version (§22), bản mới tệ hơn không nhận.
- **Không upload khi Final QA FAIL** (§32.12), không render full khi preview chưa xong (§32.11).

## Dùng
```js
const { createVideoJob } = require('./nova/video-agent/orchestrator');
const job = createVideoJob({ projectDir: 'D:/projects/chapter-001', adapters: { render, upload } });
job.on(e => console.log(e.stage, e.progress));
const res = await job.run(); // res.url, res.output, res.spec, res.timeline, res.qa
```
Trong Electron: `registerVideoAgentIpc(ipcMain, { adapters })` → 12 channel `videoAgent:*` (§25), gồm native project picker/inspect.

## Nối vào app Electron (đã wire sẵn)
- **Main process**: `nova/editor-pro/register.js` gọi `registerVideoAgentIpc(ipcMain, { adapters: opts.videoAgentAdapters })`
  (chạy cùng `registerEditorPro` từ `main.plain.js` — không cần sửa main).
- **Preload bridge**: `window.native.videoAgent` — `run/status/spec/timeline/qa/cancel/retry/restore/versions/inspect/pickProject/openWindow`
  + `onEvent(cb)` stream kênh `videoAgent:event` (mỗi stage/job event).
- **UI**: cửa sổ riêng `nova/web/video-agent.html` (7 panel: cấu hình → tiến trình 17-state → kết quả → scenes →
  timeline → QA → versions/restore), mở qua kênh `videoAgent:openWindow` (`nova/video-agent/window.js`).
- **Job runtime**: metadata ghi tại `output/job.json`, được `inspect` khôi phục để retry sau restart; mặc định tối đa 1 job,
  mỗi stage timeout 30 phút và preflight yêu cầu tối thiểu 1 GiB trống (đều cấu hình qua options).
- **Preflight cấu trúc** (`orchestrator/preflight.js`): trước khi chạy, job thu thập danh sách issue
  `{ code, message, fixHint, blocking }` (dự án tồn tại, dung lượng đĩa, output ghi được, renderer khả dụng).
  Issue blocking → job FAILED lộ liễu với mã VA_* (Luật 10); danh sách issue persist vào `job.json`
  (trường `preflight`) để `inspect` hiển thị. Hợp đồng cũ giữ nguyên: `options.skipDiskPreflight` +
  `options.minFreeBytes`. Pattern học từ TDTStudio `core/export_preflight.py`.
- **Cancel thật**: truyền xuống Remotion `cancelSignal`, ffmpeg mux và S3 `AbortSignal`; partial output/temp/staged assets được dọn.
- **Renderer thật**: adapter mặc định lazy-require `renderNovaScenes` (engine Nova Scene) — chạy được trong Electron
  main process (bundle `nova-remotion/bundle` + `@remotion/renderer` có sẵn trong app); ngoài Electron trả
  `VA_RENDERER_UNAVAILABLE` — test dùng mock. `renderNovaScenes` tự chép asset cục bộ vào bundle và mux
  voice/music qua ffmpeg, nên bridge chỉ cần truyền `scenes + voiceB64/musicB64`.

## V5 core — Behavior + Frame Engine
- `behavior-engine/` là registry renderer-independent gồm contract, validator capability/timing, resolver property track,
  deterministic executor và bridge từ Visual Grammar cũ. MVP có 12 behavior đăng ký (`transform.*`, `character.*`,
  `camera.*`, `visual.*`, `caption.*`); AI chỉ được phát type có trong registry.
- `frame-engine/` tạo World State, kiểm property ownership/conflict/dependency/visual budget, biên dịch giây → frame
  và resolve `FrameState` có trace `entity.property → behaviorId → beatId/reason`.
- `VideoSpec` mới có `elementId`, `capabilities`, canonical `behaviors`; spec cũ không có behaviors vẫn được dịch tự động.
  `timeline.behaviorGraph` chứa hash/status/error để behavior thay đổi làm thay đổi timeline hash.

## Test
```
node nova/video-agent/test.js        # §33 acceptance — 29/29 PASS
node nova/video-agent/test-ipc.js    # IPC-SMOKE-OK (12 channel)
node nova/video-agent/test-bridge.js # BRIDGE-CONTRACT-OK — specToNovaScenes() khớp hợp đồng NovaScene thật
node nova/video-agent/test-render-real.js  # (qua Electron: npx electron nova/video-agent/test-render-real.js)
                                       # REAL-RENDER-OK — render Remotion THẬT: bridge → renderNovaScenes → mp4 1080p
node nova/video-agent/check.js       # syntax all files
node nova/video-agent/test-phases.js # Phase 3/4/5 acceptance — 52/52 PASS (dùng ffmpeg thật sinh fixture)
```
`test-bridge.js` đối chiếu tầng dữ liệu với **mã nguồn engine** (preset IN/OUT/HOLD bóc từ `anim.js`,
transition id bóc từ `transitions.json` + legacy map) — render thật cần Electron + `@remotion/renderer`
(không có ở môi trường dev plain-node).

## V5 Phase B — AI Gateway + Provider Registry
- `ai-gateway/registry.js` đăng ký/routing provider theo capability flags `vision`, `structuredOutput`, `toolCalling`;
  thứ tự chọn ổn định theo preferred provider → priority → name. `describe()` chỉ trả metadata công khai, không trả API key.
- `ai-gateway/gateway.js` là cổng planning duy nhất: validate JSON theo schema, repair một lần, failover sang provider tiếp
  theo capability, rồi luôn có `local-deterministic` làm safety net. Pipeline vì vậy vẫn chạy offline và reproducible.
- Provider có sẵn: OpenAI-compatible (OpenAI, DeepSeek, Gemini OpenAI endpoint, local/CLI bridge tùy `baseUrl`) và
  Anthropic native. HTTP dùng `fetch` có timeout, retry/backoff, AbortSignal; không thêm dependency.
- Orchestrator tự nối AI vào `script.plan`, `scene.plan`, `behavior.plan`. AI chỉ đề xuất: visual grammar lọc scene plan;
  `validateVideoSpec()` + constraint solver là authority cuối cho behavior graph. Adapter inject cũ vẫn được ưu tiên.
- Cấu hình trong `config.json` hoặc `options.ai`: `{ "providers": [{ "type": "openai", "model": "gpt-4o-mini" }] }`.
  Key lấy từ `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`; cũng có thể inject `apiKey`
  runtime. Provider thiếu cả key lẫn custom `baseUrl` không được đăng ký, nên không có request mạng ngoài ý muốn.
- Acceptance: `test-ai-gateway.js` kiểm capability routing, malformed JSON failover, local fallback, request OpenAI-compatible,
  và tích hợp đủ ba planner trong orchestrator.

## Render thật (đã chạy PASS trên Windows)
Cần: `@remotion/renderer` + `@remotion/bundler` + `remotion` + `@remotion/transitions` + `react` cùng version
(4.0.518, cài ở root `node_modules`), bundle rebuild bằng `node editor-pro/nova-remotion/build.js`.
Chạy: `npx electron nova/video-agent/test-render-real.js` — render 2 cảnh text-only (2.4s, 72 frame, 1080p)
qua đúng đường ống production (`specToNovaScenes` → `renderNovaScenes`), verify mp4 bằng ffprobe.
Lần đầu chạy Remotion tự tải Chrome Headless Shell (~113MB, cache lại cho các lần sau).

## Phase 3 — Asset Intelligence thật (§8-9)
- `assets/identity.js` — **character identity**: dHash 64-bit (decode ảnh → gray 9×8 bằng ffmpeg, không thêm
  thư viện) + Hamming distance → `buildCharacterRegistry()` gom các ảnh cùng một nhân vật
  (mapping tên trong `config.characters` thắng heuristic; không có config thì gom theo hash gần nhau ≤10).
- `assets/segment.js` — **segmentation** (rembg/SAM): provider `onnx` lazy-require `onnxruntime-node`
  (đã có trong deps) + file model (u2net 320×320); **không có model → `unavailable: true`, degrade về
  heuristic Phase 1** (không crash). `subjectBoxFromMask()` là hàm thuần: mask alpha → bbox chủ thể (%) + coverage.
- `createPhase3Analyzer({ ffmpeg, segmentation })` = identity + segmentation, đóng vai adapter
  `analyzeAsset` cho `buildAssetManifest()` (điền `identityHash`, `subjects`, nâng `confidence` khi có cutout).
  **IPC mặc định luôn bật** (`ipc.js` → `mergeAdapters`), payload có thể đè bằng `payload.adapters.analyzeAsset`.

## Phase 4 — Vision QA trên frame render thật (§19-20)
- `qa/vision.js` — trích 2 frame mỗi cảnh (giữa + sát biên cuối) bằng ffmpeg → `{mean, std, dHash, px}`;
  `createVisionProviders({stats})` trả cặp provider `{semantic, continuity}`:
  - **semantic**: `black_frame` (mean<12, high), `white_frame` (mean>243, high), `flat_frame` (std<4, medium) —
    mỗi lỗi có `suggestedFix` để Auto-Fix dùng (§21).
  - **continuity**: `frozen_frame` — 2 frame biên giới giống nhau tới từng pixel (mean-abs-diff < 1/255).
- Orchestrator tự bơm: sau `PREVIEW_RENDER` và `FULL_RENDER` gọi `extractSceneStats()` (fail-safe — file
  giả/hỏng → không có vision, giữ hành vi Phase 1); `runQA()` giờ truyền `frames` vào provider context
  (`adapters.qaProviders` của caller vẫn thắng default vision).
- **Watermark/logo QA** (học từ NNLauncher, `qa/watermark.js`) — mở rộng semantic của đường MẶC ĐỊNH:
  extract 1 frame PNG full-res giữa mỗi cảnh (quá 12 cảnh → sample đều, deterministic) rồi detect qua
  engine WatermarkRemover-AI có sẵn (`nova/watermark-native.js`) ở chế độ `--preview` — **chỉ detection
  (Florence-2), không xử lý ảnh, không thêm dependency**. Phát hiện hộp → lỗi `watermark_detected`
  (severity `high`, mang `boxes` + `suggestedFix: {type:'remove_watermark'}`) → Final QA FAIL chặn upload
  (§32.12). Auto-Fix không sửa được lỗi này (chiến lược `fix-in-post` trong `auto-fix/loop.js`) → job rơi
  `NEEDS_REVIEW` cho người dùng chạy tool Xoá watermark rồi render lại. Kết quả detect cache theo
  (video, mốc-giây) nên Auto-Fix gọi QA lại ≤5 lần không đốt thêm model load. Metadata luôn gắn vào
  `qaReport.watermark`: `{engine, checked, detected}` hoặc `{unavailable: true, reason: 'VA_WM_*'}` khi
  thiếu engine/python (degrade khai báo rõ — Luật 10). Tắt bằng `options.watermarkQa === false`;
  adapter `qaProviders` inject từ ngoài vẫn thắng (không bị bọc thêm).

## Phase 5 — S3/CDN uploader (§24)
- `uploader/s3.js` — PUT thẳng S3 bằng `fetch` (Node 24) + **AWS Signature V4 tự ký bằng node crypto**
  (không aws-sdk, không dependency mới). Hỗ trợ `sessionToken`, `keyPrefix`, `cdnBase` (URL cuối là CDN nếu có).
  Creds từ opts hoặc env: `VA_S3_ACCESS_KEY_ID/VA_S3_SECRET_ACCESS_KEY/VA_S3_BUCKET/VA_S3_REGION/
  VA_S3_KEY_PREFIX/VA_S3_CDN_BASE` (hoặc `AWS_*` chuẩn). Chữ ký đã **verify với vector chính thức của AWS
  SigV4 Test Suite** (get-vanilla, signature `5fa00fa3…bf31`).
- `createUploader('s3', opts)` / `createUploader({name, upload})` (adapter object) / 'local' / function —
  orchestrator không đổi. Qua IPC: `videoAgent:run` nhận `payload.upload = { provider:'s3', bucket, region,
  keyPrefix, cdnBase, accessKeyId, secretAccessKey }`.
- Lỗi có code riêng: `VA_S3_NO_CONFIG`, `VA_S3_NO_CREDS`, `VA_S3_PUT_FAIL`, `VA_S3_NETWORK`.

## TTS local fallback — backend Voice Studio (học từ NNLauncher)
- `tts/synthesize.js` — tổng hợp giọng offline qua **backend Voice Studio đóng gói kèm app**
  (`nova/voice-studio/backend/app.py`, uvicorn `127.0.0.1:8771` do `voice-native` quản) đúng hợp đồng
  `/api/tts`: `POST /api/tts {text, language, preset_id, speed}` → `{task_id}` → poll
  `GET /api/status/{tid}` tới `completed|failed` → tải `results.merged` (`output.mp3`) + `results.srt`.
  Không thêm dependency (fetch Node 24). Cổng đọc lại từ `voice-native.URL` (một nguồn); env
  `VA_TTS_BACKEND_URL` để trỏ chỗ khác.
- Hook vào orchestrator (`orchestrator/analyze.js`, cả `runAnalysis` lẫn `runAnalysisFromData`):
  bật `options.autoTts` mà dự án chưa có audio TTS → tự tổng hợp từ `autoTts.text` / `autoTts.textPath`
  / nội dung script (`.txt`/`.md`) ra `<root>/voice/auto-tts.mp3` (+ `.srt`), rồi gán vào
  `project.files.ttsAudio` để renderer dùng đúng file đó. Đã có giọng sẵn → skip, không gọi backend.
- **Fail lộ liễu (Luật 10)**: backend không chạy → `VA_TTS_BACKEND_UNAVAILABLE` (job FAILED, không retry
  cloud ngầm); backend lỗi tổng hợp → `VA_TTS_SYNTH_FAIL`; không xác định được văn bản →
  `VA_TTS_AUTO_NO_TEXT`; quá thời gian → `VA_TTS_SYNTH_TIMEOUT`. Hướng dẫn fix nằm ngay message (tiếng Việt):
  mở tab Tạo giọng nói để khởi động backend, hoặc tắt `options.autoTts`.

## Còn lại (mở rộng tự nhiên, không chặn luồng chính)
- Phase 3: rembg/SAM segmentation + character identity thật (`assets/manifest.js` đã có hook `analyzeAsset`).
- Phase 4: Vision QA trên frame render (`qa/qa.js` đã có hook `providers.semantic/continuity`).
- Phase 5: S3/CDN uploader (`uploader/local.js` đã có interface), worker/queue phân tán.
- Tải file model rembg/SAM thật (u2net ~170MB) để bật segment thật; identity nâng lên embedding clip khi cần.
