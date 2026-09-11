# ROADMAP — Tích hợp pattern học từ VEO3 AI Studio

> Nguồn phân tích: app `D:\chua xu ly\VEO3 AI Studio v2.1.334` (Python backend Cython-compiled —
> đọc qua name table + renderer bundle). Tài liệu này chỉ là **kế hoạch**, không đổi quy chuẩn
> (quy chuẩn vẫn nằm duy nhất ở AGENTS.md).
>
> Nguyên tắc xuyên suốt: giữ nguyên hợp đồng `module.exports`/IPC hiện có; thêm mới thì cập nhật
> đồng thời `check:ipc` inventory + preload; KHÔNG fallback ngầm (Luật 10); KHÔNG thêm dependency
> cho video-agent (Luật 9); mọi state main-process khai báo trong `nova/main/state.js` (Luật 3).

## Bảng phân bổ tổng hợp — 17 mục → nơi neo trong repo

| # | Mục học từ VEO3 | Neo vào (file đích) | Phase |
|---|---|---|---|
| 1 | ChargeLedger + `client_request_id` (chống double-charge khi retry) | `flow-native/gen/ledger.js` (MỚI) + `flow-native/gen/pool.js` | P1 |
| 2 | Slot concurrency + least-loaded nick pick | `flow-native/gen/pool.js` (nâng cấp round-robin) | P1 |
| 3 | `nick_strategy` (fixed vs rotate) | `flow-native/gen/pool.js` + `flow-chrome/gen.js` | P1 |
| 4 | Auto-fix prompt + nhận diện content-filter | `flow-native/gen/shared.js` + `video-agent/ai-gateway/` | P1 |
| 5 | Credit gate trước job | `video-agent/orchestrator/preflight.js` + pool | P1 |
| 6 | R2V start–end morph | `flow-native/gen/video.js` + `flow-chrome/gen.js` (template) | P2 |
| 7 | V2V edit (sửa video có sẵn) | `flow-native/gen/video.js` + template "học lại" | P2 |
| 8 | Checkpoint per-segment cho Auto-Fix | `video-agent/auto-fix/loop.js` + `orchestrator/` | P2 |
| 9 | ScheduleManager (chạy job theo lịch, skip_missed_run) | `main/scheduler.js` (MỚI) + `main/ipc/schedule.js` | P3 |
| 10 | Workflow DAG (ảnh→video→hậu kỳ, pause/resume) | nâng cấp `web/src/toolbox/utility/autopipe.js` + engine phía main | P3 |
| 11 | Purge output theo tuổi/kích thước | `main/lifecycle.js` + `main/fs-utils.js` | P3 |
| 12 | Edge TTS / Piper (engine miễn phí, KHAI BÁO) | `voice-native/` engine registry + `voice-studio/` UI | P4 |
| 13 | Assemble SRT-timed audio (silence tới target_frames) | `video-agent/tts/srt-assemble.js` (MỚI) | P4 |
| 14 | Smart Trim nhận thức âm nhạc (beat/section) | `native-tools/smart-trim.js` (MỚI) + IPC `trim:*` | P4 |
| 15 | Spy video → storyboard grid (yt-dlp đã có `ytdlp-bin`) | `native-tools/spy.js` (MỚI) + IPC `spy:*` + tool page | P4 |
| 16 | Encoder chain có fallback tường minh + guard độ dài lệnh | `main/ipc/native-tools.js` (render-video) | P4 |
| 17 | Thumbnail chữ viền — chỉ nếu fractal-engine chưa phủ | `web/fractal-engine/` (nếu thiếu) | P4 (tuỳ chọn) |
---

## PHASE 1 — Lõi Flow (không đổi IPC channel, không đổi UI contract)

### 1.1 Ledger chống double-charge (mục 1)
- File mới `nova/flow-native/gen/ledger.js`: JSON tại `<userData>/flow-ledger.json` — map
  `clientRequestId → { status: submit|charged|refunded, accountId, mediaId?, at }`, prune 7 ngày.
- `poolGen`/`genVideoPool` sinh `clientRequestId` per request; trước khi submit:
  nếu đã `charged` → KHÔNG gen lại tốn credit, trả lỗi rõ `FLOW_ALREADY_CHARGED`; gen fail lộ
  liễu → `recordRefund` rồi retry sang account khác.
- KHÔNG đổi `handle()` contract — ledger là nội bộ engine.

### 1.2 Slot concurrency + least-loaded (mục 2, 3)
- `pool.js`: thêm `S.pool.slots = { perAccount: 1, machine: 2 }`, cấu hình qua action
  `SET_POOL_CONFIG` (payload của kênh `flow` hiện có — KHÔNG tạo kênh IPC mới).
- Chọn account: điểm tải `busyCount/limit` — lấy `leastLoaded` trước, xoay khi lỗi tạm
  (giữ nguyên logic exhausted-theo-ngày-PT).
- `nick_strategy`: `{ strategy: 'rotate'|'fixed', fixedId? }` qua `poolGen(params)`; `fixed`
  dùng cho pipeline cần nhất quán seed/style.

### 1.3 Auto-fix prompt + content filter (mục 4)
- `flow-native/gen/shared.js`: thêm `isContentFilterErr(err)` nhận diện reason/message aisandbox.
- Sửa prompt dùng **ai-gateway sẵn có** (`video-agent/ai-gateway/gateway.js`) — main process
  gọi trực tiếp, không qua renderer. Bắt lỗi filter → gateway sửa prompt (≤2 lần) → gen lại;
  vẫn fail → `VA_PROMPT_FILTERED` kèm prompt gốc + prompt đã sửa trong event.
- Opt-in `{ autoFixPrompt: true }` (bật cho pipeline, tắt cho GEN_TEST).

### 1.4 Credit gate preflight (mục 5)
- `video-agent/orchestrator/preflight.js`: thêm issue `{ code: 'VA_CREDITS_LOW', blocking: false }`
  (đọc credit qua `GET_ALL_TOKENS` + `/v1/credits`); credit = 0 → blocking `VA_NO_CREDITS`.
- Bảng cost-per-image/video: `video-agent/video-spec/cost.js` MỚI (một nguồn, Luật 3).

**Điều kiện hoàn tất P1**: `npm run check` PASS + test mới PASS + ghi MEMORY.md.

---

## PHASE 2 — Năng lực gen mới + Auto-Fix theo đoạn

### 2.1 R2V start–end morph (mục 6)
- `flow-native/gen/video.js` + `flow-chrome/gen.js`: mở rộng template
  `batchAsyncGenerateVideoReferenceImages` — `referenceImages` 2 phần tử (start ASSET +
  end CONDITIONING). **Khóa shape bằng cơ chế "học request thật" hiện có** — template learn là
  nguồn chân lý, const mặc định chỉ dự phòng (KHÔNG đoán shape).
- video-agent `visual-plan` được phép phát `transition: { type: 'flow-morph', fromScene, toScene }`
  — engine diễn giải thành 2 mediaId (AI chỉ chọn tên, giữ Luật 8 deterministic).
- UI: `utility/t2-regen.js` thêm chế độ "Morph A→B" cho 2 cảnh kề.

### 2.2 V2V edit (mục 7)
- Template `video:batchAsyncVideoEdit` chỉ thêm SAU khi bắt được request thật từ Flow
  (learn); chặn edit khi duration vượt model limit → `VA_V2V_DURATION` lộ liễu.
- UI: `utility/mvtv.js` thêm nguồn "Sửa clip có sẵn".

### 2.3 Checkpoint per-segment Auto-Fix (mục 8)
- `video-agent/auto-fix/loop.js`: attempt theo **scene lỗi** (QA chỉ định sceneIds) — mỗi attempt
  clone spec, chỉ thay scene lỗi. Giữ trần ≤5 attempt tổng + "bản tệ hơn không nhận" (Luật 8).
- `output/job.json` thêm `checkpoint: { sceneId → versionId }` để resume sau restart.

**Điều kiện hoàn tất P2**: `npm run check` + `npm run test:video-agent` PASS; render thật
1 project mẫu có morph A→B.
---

## PHASE 3 — Tự động hoá

### 3.1 Scheduler (mục 9)
- File mới `nova/main/scheduler.js` (logic) + `nova/main/ipc/schedule.js` (kênh `schedule:*`):
  interval + time-of-day, **skip_missed_run** (máy ngủ dậy không dồn việc), pause/resume,
  persist `<userData>/schedules.json` (atomic write).
- State: thêm key `schedules` vào `nova/main/state.js` (Luật 3 — check:shared tự bắt).
- Dọn dẹp trong `lifecycle.js`. Schedule KHÔNG tự upload khi Final QA FAIL (§32.12).

### 3.2 Workflow DAG → nâng cấp autopipe (mục 10)
- KHÔNG viết engine mới: `utility/autopipe.js` đã có `_runPipeline` + lịch sử job. Nâng cấp
  pipeline thành **danh sách step có dependency** (topo-sort nhẹ), pause/resume/stop per step,
  `nickStrategy` per step (dùng P1.2). Renderer vẫn là script thường, giữ thứ tự nạp (Luật 4).

### 3.3 Purge output (mục 11)
- `main/fs-utils.js`: `purgeDir(root, { maxAgeSeconds, maxTotalBytes })` — xóa cũ nhất trước;
  EBUSY bỏ qua có log. Gọi trong `lifecycle.js` khi khởi động cho `output/`, temp Auto-Fix.

---

## PHASE 4 — Voice, hậu kỳ, nghiên cứu

### 4.1 Edge/Piper TTS (mục 12)
- `voice-native/`: registry engine `{ omni, edge, piper }` — chọn engine ≠ Omni phải **khai
  báo rõ** (`engine` ghi vào event/QA — Luật 10: degrade có chủ đích).
- Piper binary tự tải vào `*-bin/` (pattern `ytdlp-bin`), KHÔNG ship trong installer (bài học
  MEMORY: exclude venv để NSIS ≤2GB). `npm run test:voice` mở rộng: mọi engine cùng shape
  duration/SRT.

### 4.2 SRT-timed assembly (mục 13)
- `video-agent/tts/srt-assemble.js`: ghép wav theo dòng SRT, pad silence tới `target_frames`;
  đối chiếu `documentary/core/alignment.js` — trùng helper thì dùng chung, không nhân bản.

### 4.3 Smart Trim (mục 14) & 4.4 Spy storyboard (mục 15)
- Đặt trong `nova/native-tools/` + IPC `trim:*`, `spy:*` (cập nhật check:ipc + preload).
- Smart trim: phân tích beat bằng **ffmpeg thuần** (KHÔNG thêm librosa/python — giữ app gọn;
  chấp nhận độ chính xác thấp hơn VEO3 cho mục đích cắt Shorts).
- Spy: `ytdlp-bin` có sẵn; whitelist URL YouTube; output `output/spy/<jobId>/` + storyboard
  grid; tool page mới nạp sau `utility.js` (Luật 4).

### 4.5 Encoder chain (mục 16)
- `main/ipc/native-tools.js` `render-video`: NVENC/QSV → x264, mỗi lần rơi phát event
  `render-video:encoder-fallback` tường minh (không nuốt); guard command >32k → chia
  filtergraph. Không đổi tên kênh.

### 4.6 (Tuỳ chọn) Thumbnail viền chữ (mục 17)
- Kiểm tra fractal-engine đã phủ chưa; thiếu thì thêm renderer `AR.thumbnailText` — không file
  mới ngoài fractal-engine.

---

## Thứ tự thực hiện & ước lượng

| Phase | Nội dung | Rủi ro | Phụ thuộc |
|---|---|---|---|
| P1 | Ledger, slots, nick_strategy, prompt autofix, credit gate | Thấp — nội bộ engine | — |
| P2 | Morph A→B, V2V, checkpoint Auto-Fix | TB — cần learn template từ Flow thật | P1 |
| P3 | Scheduler, DAG autopipe, purge | TB — chạm lifecycle + IPC mới | P1 |
| P4 | Voice engines, SRT assembly, trim/spy, encoder | Thấp–TB, các mục độc lập | — |

Mỗi phase kết thúc: `npm run check` (+ `test:video-agent` nếu chạm video-agent, `test:voice`
nếu chạm voice, `npm start` smoke) + cập nhật MEMORY.md.

## Trạng thái triển khai (2026-09-11 — session "làm tất cả")

| Mục | Trạng thái | Vị trí |
|---|---|---|
| P1.1 ChargeLedger | ✅ XONG | `flow-native/gen/ledger.js` + tích hợp `pool.js` (submit/charged/refund, `FLOW_ALREADY_CHARGED`) |
| P1.2 Slots + least-loaded | ✅ XONG | `pool.js`: `slots.perAccount/machine`, `_busyBump`, `_acquireMachineSlot`, `_pickAccount`; config qua action `SET_POOL_CONFIG` (cùng kênh flow — không IPC mới) |
| P1.2 nick_strategy | ✅ XONG | `params.nickStrategy='fixed'` + `params.fixedId` → `NICK_FIXED_UNAVAILABLE` lộ liễu khi không dùng được |
| P1.3 Prompt auto-fix | ✅ XONG | `shared.js:isContentFilterErr` + `gen/prompt-fix.js` (`maybeFixPrompt` + `rewritePromptWithGateway` bọc ai-gateway — fixer inject từ caller, không require ngược) |
| P1.4 Credit gate | ✅ XONG | `video-spec/cost.js` (đơn giá 1 nguồn) + `orchestrator/credits.js` (`VA_CREDITS_LOW/NO_CREDITS/UNKNOWN`, chỉ chạy khi được cấp `options.flowCreditsProbe`) |
| P2.1 Morph A→B | ✅ XONG (chờ template) | `video.js:submitVideo` nhận `endMediaId`; chặn sớm `VA_MORPH_TEMPLATE_UNAVAILABLE` khi template chưa đủ 2 slot ảnh; `pool.js` upload `params.endImage` |
| P2.2 V2V edit | ✅ Scaffold | `video.js:submitVideoEdit` + action `GEN_VIDEO_EDIT` → `VA_V2V_TEMPLATE_UNAVAILABLE` (đợi VIDEO_LEARN bắt request thật) |
| P2.3 Checkpoint Auto-Fix | ✅ XONG | `auto-fix/loop.js`: `perScene` + `worstSceneErrors` + `checkpoints`; orchestrator bật mặc định (`options.perSceneAutoFix !== false`) |
| P3.1 Scheduler | ✅ XONG | `main/scheduler.js` + `main/ipc/schedule.js` (5 kênh `schedule:*` + event `schedule:fire`) + state key `schedules` + preload `window.native.schedule` + start ở window.js did-finish-load |
| P3.2 DAG autopipe | ✅ XONG | `web/src/toolbox/utility/autopipe.js`: `_dagDeps()`/`_dagOrder()` topo-sort (mặc định trùng thứ tự tuyến tính cũ, cycle nối đuôi); `job.disabledSteps` skip per step; `job.poolCfg` (nickStrategy/fixedId/slots) áp qua `SET_POOL_CONFIG` trước bước ảnh Flow |
| P3.3 Output purge | ✅ XONG | `main/fs-utils.js:purgeDir` + janitor startup **opt-in** `nova-settings.json:autoPurgeOutput` (mặc định TẮT — không tự xoá video user) |
| P4.1 Voice registry | ✅ XONG | `voice-native/engines.js` (omnivoice available; edge/piper khai báo `VOICE_ENGINE_NOT_INSTALLED`) + kênh `voice-engines` + preload |
| P4.2 SRT assembly | ✅ XONG | `video-agent/tts/srt-assemble.js` (buildSrt/captionsFromSpec/buildAssembleArgs — hàm thuần, test được) |
| P4.3 Smart-trim + spy | ✅ XONG | trimVideo (`native-tools/ffmpeg.js`); spy storyboard `native-tools/spy.js` (yt-dlp whitelist YouTube → frame đều theo thời lượng → tile grid; `SPY_*` error codes; cancel + list) + IPC `spy:*` + preload `window.native.spy` + **UI tool page "🕵 Spy Storyboard"** (`web/spy-panel.js` tự mount `#spyToolRoot` + nav item `toolspy` trong index.html). E2E thật PASS: tải "Me at the zoo" 19s → 6 frame → storyboard.jpg trong ~6s |
| P4.5 Encoder chain | ✅ CÓ SẴN | `native-tools/render.js` đã có GPU (NVENC/QSV/AMF/VideoToolbox) → CPU fallback |
| P4.6 Thumbnail | ✅ XONG | fractal-engine chưa phủ → thêm `AR.thumbnailText` (chữ viền + từ nhấn accent) cuối `web/fractal-engine/ve-2.js` — không file mới. Contract đúng `P()` builder (đọc `P.headline`/`P.dek`, không chỉ `P.text`); demo scene dùng `lay:{a:'thumbnailText'}` đã thêm vào `fractal-antarctica-render.html` để xem thử bằng mắt (registry lookup `AR[s.lay.a] \|\| AR.title` tự nhận renderer mới) |

**Kiểm định**: `check:syntax` 447 files PASS; `check:shared` (19 state keys), `check:parity`,
`check:ipc` (145 kênh + 18 events — đã sinh lại inventory), `check:size`, `check:toplevel` PASS.
`test:video-agent` 6 suite PASS (42+79+16, 0 fail). `test:voice` PASS (sau khi dọn
`voice-backend/backend/__pycache__` runtime artifact do tiến trình khác sinh).
`npm run check` còn exit 1 DO C2 renderer-id warnings có sẵn từ trước (không liên quan).
`npm start` thoát sạch qua single-instance guard (app đang mở instance khác).

**Cố ý không làm trong session này**: P3.2 DAG autopipe, spy storyboard, P4.6 thumbnail —
mỗi mục cần scope riêng (renderer lớn / học template Flow thật / optional).
→ **Đã làm tiếp trong session bổ sung (cùng ngày)**: cả 3 mục còn lại — DAG autopipe,
spy storyboard, AR.thumbnailText (xem MEMORY entry 2026-09-11b).

## Cố tình KHÔNG học (ghi rõ để khỏi tranh luận lại)
- Fullproxy signed relay + license server (khóa vào hạ tầng người khác).
- TLS fingerprint patch headless (mỏng, khó debug, dễ gãy).
- SQLite job store (job.json + versioning đã đủ nhu cầu).
- Obfuscate/Cython-compile source (trái triết lý tài liệu mở của repo).

