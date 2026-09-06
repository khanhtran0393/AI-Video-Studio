# MEMORY.md — Bộ nhớ trường tồn của dự án

File này ghi **trạng thái dài hạn và lịch sử quyết định**. AGENTS.md chứa quy chuẩn
ổn định; mọi thứ có tính "hiện tại / đang treo / đã quyết" nằm ở đây.

## Giao thức cập nhật

- Agent/dev nào tạo thay đổi đáng kể (kiến trúc, hợp đồng module, quyết định
  kỹ thuật, phát hiện bug hệ thống) **phải** thêm 1 dòng vào "Nhật ký thay đổi"
  dưới dạng: `[YYYY-MM-DD] <việc> — <lý do/ảnh hưởng>`.
- Không xoá dòng cũ (để truy vết); mục nào lỗi thời thì đánh dấu `~~gạch~~` kèm chú thích.
- Mục "Đang treo" chỉ xoá khi đã giải quyết xong và ghi vào nhật ký.

## Trạng thái hiện tại (2026-09-05)

- **Bản chất**: app Electron độc lập "AI Video Studio Independent" (package
  `ai-video-studio` v1.0.1), entry `nova/main.plain.js`, GUI mirror từ AI Video
  Studio 0.1.34. Không Next.js, không backend AI Novel, không nhập dữ liệu app cũ.
- **Đăng nhập**: đã gỡ bỏ hoàn toàn; Pro/Max mở sẵn; Google Flow (Settings) là
  dịch vụ ngoài, giữ nguyên.
- **Toàn bộ main-process source đã readable một nguồn**: cặp obfuscate
  `protect.js`/`unprotect.js` đã xoá, `parity-check.js` giữ làm guard no-op
  (0 pairs), entry Electron luôn là `main.plain.js` ở dev lẫn build.
- **Auto-Fix M1**: `BLOCKED` — đăng ký canonical source + CI definition đã có
  nhưng chưa có operational evidence / branch protection; runtime Auto-Fix
  KHÔNG bật. Xem `auto-fix/M1-READINESS-REPORT.md`.
- CI: `m1-validation.yml` (chạy `check:shared`), `windows-package.yml`.

## Kiến trúc đã ổn định (không tái cấu trúc khi không cần)

- `main.plain.js` = composition root 137 dòng; logic trong `nova/main/`
  (identity, state, splash, server 127.0.0.1:47280–47283, ipc/index).
- 3 bridge cục bộ: CLI (8795/8796), MCP (8794), Flow extension bridge.
- 2 dòng extension Chrome: `flow-extension/` (NGUỒN) vs `nova-studio/` (biến thể
  có chủ ý) — không copy chéo; `chrome-extension/` là OUTPUT runtime, không sửa tay.
- Flow có 2 engine song song: `flow-chrome/` (Chrome đa profile) và
  `flow-native/` (BrowserWindow đa profile) — khác nhau, không phải bản sao.
- Video Agent: 17-state pipeline, 12 kênh `videoAgent:*` qua
  `editor-pro/register.js`; TTS master clock, Video Spec SSOT, deterministic
  timeline, Auto-Fix ≤5 attempt, S3 SigV4 tự ký (không aws-sdk).
- Renderer `nova/web/`: script thường không build step (nguon-web/, fractal-engine/
  tách theo thứ tự nạp HTML); `editor-pro/niche/` lại là CommonJS main-process —
  hai kiểu tách KHÔNG trộn lẫn.

## Đang treo / nợ kỹ thuật

- ~~**Đóng gói sau tính năng Novel — CHẨN ĐOÁN CUỐI**~~ **ĐÃ GIẢI QUYẾT (22:50)**:
  root cause là `asarUnpack` kéo `nova/voice-backend/**/*` (venv .venv-omni 1.3GB)
  + `nova/tdt-studio/**/*` (runtime/venv PySide6 805MB) → nsis.7z 3.1GB > ngưỡng
  mmap 2GB của makensis 32-bit → Setup hỏng. **Fix phương án 1** (user duyệt): thêm
  2 exclude vào `files` của `electron-builder.json`:
  `!nova/voice-backend/.venv-omni{,/**/*}` + `!nova/tdt-studio/runtime/venv{,/**/*}`
  → nsis.7z còn 1.38GB <2GB → build THÀNH CÔNG cả 2 target:
  `dist\AI-Video-Studio-Setup-1.0.1-x64.exe` 1382.7MB + Portable 1380.8MB
  (22:50), asar verified chứa `tsNovelBtn`/`tsGenerateNovel`.
  **DEGRADE CÓ CHỦ Ý + KHAI BÁO (Luật 10)**: bản packaged KHÔNG chứa venv
  OmniVoice (`.venv-omni`) và venv PySide6 của TDT Studio → Voice engine
  OmniVoice + tool 🎬 Studio (PyQt) sẽ KHÔNG chạy được trong bản đóng gói cho
  tới khi user chạy `nova/voice-backend/setup-omni.bat` (cài lại venv) / TDT tự
  tạo venv lần đầu; bản full-runtime 9GB còn giữ ở
  `dist\win-unpacked-novel-ok\` (21:21) — XOÁ ĐƯỢC khi không cần (giải phóng 9GB).
- `nova/scripts/` còn nhiều script `tmp-*` dùng một lần (tmp-watch-dist,
  tmp-voice-crash, tmp-watch-build, tmp-check-index-html-js, tmp-smoke-novel…) —
  chưa dọn thành archive.
- Binary runtime tự tải (upscaler-bin, inpaint-bin, voice-backend, sqlite-bin,
  onnx-bin, ytdlp-bin, editor-pro/remotion-browser) — không track trong git.
- Video Agent Phase 3: model rembg/SAM (u2net ~170MB) chưa tải → segmentation
  degrade heuristic; identity chỉ dHash 64-bit, chưa lên CLIP embedding.
- Repo gốc còn file launch残留 ở root (chrome_crashpad, debug.log, snapshot_*,
  vulkan/d3d dll…) — không track, chỉ hiện trên máy dev.

## Nhật ký thay đổi
- [2026-09-06] **Dashboard (`nova/web/index.html`) sửa lại cho khớp app hiện tại** — renderer-only,
  không đụng IPC/main/preload (`check:ipc` không đổi). Các thay đổi:
  (a) bỏ lời chào đọc `#userName` (element đã xoá cùng hệ đăng nhập) → header "Trung tâm sản
  xuất video" + phụ đề phản ánh pipeline & "Pro/Max mở khoá sẵn";
  (b) `_dashStats` thêm chỉ số "Trong hàng đợi" (6 thẻ thống kê);
  (c) `_dashWorkflow` cập nhật 7 bước đúng tool thật hiện tại (thêm Giọng đọc = t7State.audioFile,
  Dựng video = t7State.clips; Prompt nhân vật đã gộp vào Phân Cảnh), mỗi bước gắn `tool` để nút
  "Tiếp tục bước này" nhảy đúng chỗ;
  (d) khôi phục 3 khối vốn là code chết (CSS + biến có sẵn nhưng không render): "Truy cập nhanh"
  (.dqa/qa(), 15 tool hiện tại kể cả Video Agent/Whiteboard/Vẽ Tay/I-MZic/Studio TDT),
  "Tiến độ video hiện tại" (.dstep/stepHtml), "Kênh của bạn" (.dproj/projs);
  (e) xoá 3 nhánh gate tier chết (queueAdd + runQueue) — canAutoRun() luôn true,
  getMaxQueue() Infinity, message "gói Sáng tạo…" lỗi thời vì tier đã gỡ.
  TDZ đã kiểm chứng: renderDashboard chỉ gọi sau khi toàn bộ script eval (DOMContentLoaded/event),
  `typeof`-guard cho t7State/_prodQueue an toàn. Kiểm định: `npm run check` PASS (syntax 342
  file, IPC 144 kênh, parity 0, shared 28 file/16 state key);
  `nova/scripts/tmp-dashboard-check.js` — 7/7 khối <script> inline hợp cú pháp;
  `nova/scripts/tmp-dashboard-render-test.js` — render với stub: 15 quick action, 7 bước
  stepper, 6 thẻ thống kê, đủ các section. Nhận xét: check:syntax chưa phủ inline script trong
  .html — hai tmp script trên giữ làm cách kiểm tra nhanh khi sửa renderer lớn.
- [2026-09-06] **Agent Bridge cho AI agent ngoài (Zisu_AI) — tính "điều khiển app
  từ ngoài"**: thêm `nova/main/agent-bridge.js` (mới) + gắn route
  `POST /agent/command` vào local server sẵn có trong `server.js` (127.0.0.1,
  port 47280-47283 — không mở cổng mới, không thêm IPC/renderer → inventory IPC
  và preload không đổi, `check:shared`/`check:ipc` PASS). Bridge là điểm vào
  HTTP kiểu `{action, params}` → `{ok, data|error{code,message}}`, lỗi lộ liễu
  theo Luật 10 (`AVS_AGENT_*`: METHOD_NOT_ALLOWED, BODY_TOO_LARGE, BAD_JSON,
  NO_ACTION, UNKNOWN_ACTION, NO_WINDOW). Action: `ping`, `status`, `focus`.
  Đối tác tiêu thụ: repo `D:\Zisu_AI` (fork Tuan3d/Zisu_AI) với skill mới
  `ai_video_studio` (regex L2) + `core/ai_video_studio_helper.py` (probe port
  47280-47283, dùng urllib stdlib) + gắn `core/executor.py`, router đã train lại
  (56 mẫu), regression `python -m eval.run_eval` 5/5 PASS. Kiểm định:
  `nova/scripts/tmp-agent-bridge-test.js` 7/7 PASS (chạy node thường, không
  Electron); e2e `tmp-agent-bridge-e2e.js` + `D:\Zisu_AI\tmp-e2e.py`: lệnh tiếng
  Việt "kiểm tra ai video studio có đang chạy không" → status SUCCESS,
  "hiện ai video studio lên" → lỗi lộ liễu AVS_AGENT_NO_WINDOW khi chưa có
  cửa sổ (đúng chủ đích ngoài Electron). Lưu ý runtime: khi probe bridge từ
  process khác, KHÔNG dùng `spawnSync` ở node giữ server (chặn event loop →
  deadlock) — phải dùng `spawn` async.
- [2026-09-06] **Nghiệm thu GUI THẬT hoàn tất**: chạy `npm start` thật (splash →
  cửa sổ chính, port 47280), pipeline Zisu `python tmp-e2e.py` cho kết quả
  2/2 STEP_SUCCESS: `status` → "cửa sổ chính đang mở, server port 47280",
  `focus` → cửa sổ thật được hiện & focus (lần đầu `focus` chạy thành công
  trên cửa sổ Electron thật, không còn AVS_AGENT_NO_WINDOW). Tầng "app tự mở
  cửa + agent ngoài gọi vào" đã đóng dấu nghiệm thu end-to-end.


- [2026-09-05] Tạo Kịch Bản — **chế độ Novel (chip 📖)**: port pattern quản lý ngữ cảnh
  của repo `D:\repo\ainovel-cli-main` (fork tiếng Việt của ainovel-cli, Go — KHÔNG tích
  hợp binary, chỉ mượn thuật toán) sang JS thuần renderer, theo yêu cầu "nhớ ngữ cảnh /
  nội dung / nhân vật xuyên suốt kịch bản". Toàn bộ nằm trong `nova/web/index.html`
  (global script, không import/export, không đụng IPC/main/preload → inventory IPC
  không đổi, không dependency mới):
  (a) UI: chip toggle `tsNovelBtn` + hint giải thích; trạng thái lưu localStorage
      `ts_novel_mode`, khôi phục trong `tsInit`;
  (b) `tsGenerate` rẽ nhánh `tsGenerateNovel()` khi chip BẬT — luồng thường
      (1 lần gọi LLM) giữ nguyên 100% khi chip TẮT;
  (c) pipeline 3 pha mô phỏng Architect→Writer→Editor của ainovel-cli:
      Architect (`_tsNovelArchitect`, callLLMJson) dựng story bible JSON (tiền đề,
      hướng kết cục, 3–7 nhân vật, 3–6 tuyến, kế hoạch ~450 từ/chương); Writer viết
      từng chương với prompt kèm STORY MEMORY (`_tsNovelMemBlock`: 3 chương gần nhất
      tóm tắt đầy đủ, chương cũ nén 1 câu — pattern "ngữ cảnh phân tầng nén dần");
      Editor (`_tsNovelRemember`) sau mỗi chương trích {summary, stateChanges
      (entity/field/from/to/reason), threads (open/advanced/resolved)} rồi
      `_tsNovelMerge` vào memory cho chương sau;
  (d) Luật 10: lỗi trích memory → cảnh báo status + degrade khai báo rõ (dùng 4 câu
      đầu chương làm tóm tắt thay thế, không nuốt); output ghi dần từng chương vào
      tsOutput nên lỗi giữa chừng không mất phần đã viết.
  Kiểm định: node --check 6/6 inline script block PASS (`scripts/tmp-check-index-html-js.js`);
  `npm run check` PASS (328 file, 143 kênh IPC); smoke logic `scripts/tmp-smoke-novel.js`
  PASS (mock LLM: 2 chương viết, 1 architect + 1 remember, prompt chương 2 chứa đủ
  summary + stateChange `location=nhà kho` + tuyến T1); `npm start` boot 35s sạch
  (bridge 8793–8796 lên, không stderr). Còn treo: chưa có nút "tiếp tục viết thêm
  chương" (memory chỉ sống trong 1 lần generate, không persist sang job sau).
- [2026-09-05] Handdraw/Whiteboard — **dọn rác khi lỗi/huỷ export** (tiếp nối hdlasso6):
  phát hiện qua câu hỏi audit "có xoá rác khi tiến trình lỗi/huỷ?". Trước đây chỉ có
  `finally` xoá workdir `wb-stream-*` sau 5s nhưng `catch(_){}` nuốt lỗi xoá (Windows
  giữ handle → orphan vĩnh viễn), app thoát trước 5s → orphan, và KHÔNG có sweep —
  bằng chứng 31 dir rác + 14 mp4 smoke nằm trong %TEMP%. Đã vá trong
  `whiteboard-studio/py-backend.js` (hợp đồng `module.exports` giữ nguyên, chỉ thêm
  `sweepStale`):
  (a) `removeDirWithRetry()`: xoá workdir NGAY trên mọi đường thoát (ok/lỗi/huỷ/
  timed-out), Windows còn giữ handle thì retry 5s→15s, hết lượt thì say('⚠…') lộ
  liễu (Luật 10 áp dụng cho rác);
  (b) helper `fail()` trong exportVideo: mọi return lỗi giờ xoá **file bán phần tại
  outputPath người dùng** (Desktop) nếu export này vừa ghi ra đó (merge ghi thẳng
  đích khi không audio / mux ghi thẳng đích) — trước đây để lại file hỏng trên máy
  user; cờ `wroteOutput` đặt tại 3 điểm ghi đích; LƯU Ý TDZ: fail/say phải định
  nghĩa TRƯỚC lệnh `await status()` đầu hàm;
  (c) `sweepStale()` gọi từ `status()` (panel mở tool), guard 1 lần/giờ: xoá
  `wb-stream-*` >1h, `wb-studio-preview-*` + `hd-smoke-*` >24h trong os.tmpdir();
  `status()` trả thêm `swept`.
  Kiểm định: tmp-test-cleanup.js PASS (sweep 24/31 dir mồ côi thật; huỷ giữa render:
  kill 1 con python, trả lỗi, không partial file, 0 dir rác mới — test đã xoá);
  `node --check`; `_smoke_handdraw.js` PASS (0.56MB hand + 0.29MB pen); `npm run
  check` PASS (324 file, 135 kênh IPC).
- [2026-09-05] Khởi tạo bộ tài liệu chuẩn cho AI agent (AGENTS.md, CLAUDE.md,
  MEMORY.md) — học pattern AGENTS/CLAUDE/MEMORY của repo AI-Novel, nội dung viết
  lại 100% theo thực tế AI Video Studio. Mục đích: mọi agent/dev sửa code theo
  cùng quy chuẩn, không phá hợp đồng hệ thống.
- [2026-09-05] Chuẩn hoá "1 nguồn rule": AGENTS.md là nguồn duy nhất; CLAUDE.md
  và .clinerules giảm thành pointer; thêm pointer cho Copilot
  (.github/copilot-instructions.md), Gemini CLI (GEMINI.md), Cursor
  (.cursor/rules/ai-video-studio.mdc). Cơ chế ghi rõ tại AGENTS.md §9 — cấm
  nhân bản quy chuẩn vào pointer.
- [2026-09-05] Handdraw Studio — hiện tượng "thanh tiến trình kẹt 5%": phân tích
  hiện trường cho thấy **video ĐÃ xuất thành công** (`Desktop\handdraw_animation.mp4`
  1.26MB, 15:05:18; không process python/ff nào treo, workdir tạm đã dọn) — lỗi chỉ
  còn ở phía renderer không hiển thị trạng thái cuối. Đã cứng hoá 3 lớp:
  (a) panel `hdlasso6`: bọc try/catch TOÀN BỘ đoạn sau `await export` (rất có thể
  exception chết thầm ở đây giữ bar kẹt giữa chừng — Luật 10), xử lý kết quả
  bất thường (`r` undefined/non-object), watchdog 60s không-event thì log cảnh báo
  lộ liễu, listener `onExportProgress` bọc try/catch;
  (b) `whiteboard-studio/ipc.js`: sau khi PyBackend settle, relay kết quả qua
  KÊNH EVENT (`percent:100 status:'done'` / `status:'error …'`) — nếu reply
  invoke bị lạc, renderer vẫn nhận trạng thái cuối; đồng thời console.log
  `[whiteboard:export] OK/FAIL` ở main để chẩn đoán qua terminal `npm start`;
  (c) marker phiên bản `[hdlasso6]` + `?v=hdlasso6` trong index.html.
  Kiểm định PASS: check, _check_hd_ids, _smoke_handdraw (0.56MB hand + 0.29MB pen).
  Bài học encoding: **CẤM dùng PowerShell `Get-Content -Raw`/`Set-Content` cho
  file UTF-8 chứa tiếng Việt** (PS5.1 đọc không-BOM file thành CP1252 → mojibake
  toàn file khi ghi lại; đã đảo ngược cơ học bằng node script CP1252 và phục hồi
  panel.js + index.html). Từ nay mọi bump version marker/sửa file UTF-8 phải dùng
  editor tool hoặc node script (fs.readFileSync/`'utf8'`/writeFileSync).
- [2026-09-05] Handdraw Studio — 5 feedback item đã xong: (1) multi-lasso region
  point-in-polygon (pvPointInRegion, Shift+kép vùng mới đè vùng cũ, chuột phải
  xoá theo polygon); (2) chia giờ 8:2 chuẩn + nút "↻ Phân lại giờ 2/8"; (3) AI
  vision khoanh vùng (hdImageDataUrl → callLLMJson với image part, toạ độ 0–1000
  → pixel); (4) tách card "Bước 3 · Mẫu bút vẽ & bàn tay" (tip/ink/fill thumbnail
  canvas) khỏi "Bước 4 · Xuất MP4"; (5) export hardening. Bài học RẤT QUAN TRỌNG:
  - **Bug "Xuất MP4 chết thầm"**: panel gọi `pickOutput({ defaultName })` (object)
    trong khi preload.js chữ ký là `pickOutput(defaultName: string)` → main nhận
    `p.defaultName` = object → Electron `showSaveDialog` ném "Default path must
    be a string" và handler cũ KHÔNG try/catch → promise reject thầm, thanh tiến
    trình không chạy. Đã sửa cả 2 phía (panel truyền chuỗi; ipc.js cưỡng chế kiểu
    + try/catch trả `{ok:false,error}`) và panel hiển thị lỗi pickOutput ra Log box.
  - Smoke test mock `window.native` phải nhân bản **chữ ký từng hàm của preload
    thật** (không phải chỉ kênh IPC) — nếu không sẽ không bắt được lệch contract
    kiểu này. `web/_smoke_handdraw.js` giờ mô phỏng cả validation Electron
    (defaultPath phải string) + bước [4b] assert contract; `web/_check_hd_ids.js`
    assert SHELL_HTML ↔ bind() ↔ els.*.
  - `nova/main/server.js` giờ gửi `Cache-Control: no-cache` cho static file —
    renderer không bao giờ chạy JS cũ sau khi dev sửa (gốc rễ 2 lần "panel chết
    vì cache"). Marker phiên bản trong Log: dòng đầu `[hdlasso5] panel Vẽ Tay Ảnh
    đã khởi động`. App đóng gói trong `dist/` build 9/4 KHÔNG có tool handdraw —
    user phải chạy dev từ `nova/`, không chạy exe trong dist.
  - Kiểm định: `npm run check` PASS; `npm run test:whiteboard` PASS;
    `node nova/web/_smoke_handdraw.js` PASS (export MP4 thật 0.56MB hand +
    0.29MB pen).
- [2026-09-05] Voice Studio — tính năng **cao độ (pitch)** triển khai ở TẦNG
  BACKEND: `TTSBody.pitch` (nửa cung, -12..+12, mặc định 0) +
  `audio_utils.pitch_shift_wav()` (ffmpeg `asetrate→aresample→atempo`, giữ
  tempo, ghi đè tại chỗ qua `os.replace`) áp TRƯỚC `wav_duration` để SRT đúng;
  xử lý trung tâm trong `_run_tts` nên cả 3 engine OmniVoice/VieNeu/XTTS đều
  có pitch mà không sửa engine nào, không thêm dependency Python. UI
  (`web/index.html`): slider Cao độ (voicePitch) giữa Tốc độ và Nghỉ giữa câu;
  đổi thứ tự cột phải thành Backend → Ngôn ngữ → Giọng đọc → Tốc độ → Cao độ →
  Nghỉ giữa câu; gửi `pitch` trong POST /api/tts; lưu theo profile
  (`_VOICE_FIELDS`). Contract test mục 10 chốt toàn chuỗi. Kiểm định: `npm run
  check` PASS, `test:voice` PASS, E2E qua venv-omni production PASS (tỉ lệ tần
  số +5st = 1.3352 vs lý thuyết 1.3348; -7st = 0.6673 vs 0.6674; tempo giữ
  nguyên ±0.02s). Lưu ý: `__pycache__` cpython-311 xuất hiện trong source là
  do backend chạy thật từ source (runtime bình thường, đã git-ignore) — chạy
  `test:voice` sau khi backend chạy cần dọn `backend/__pycache__` +
  `backend/engines/__pycache__` trước.
- [2026-09-05] Mở rộng Visual Grammar theo pattern seedance-2.0 (từ vựng góc máy điện ảnh) — 3 tầng: (1) `nova/video-agent/visual-grammar/grammar.js`: CAMERA 5→9 (`pan-up`/`pan-down` map `panU`/`panD`, `crane-in`, `handheld`), TRANSITIONS 7→18 (map 1-1 sang `transitions.json` sẵn có: dip-white, flash-cut, zoom-through, match-zoom, push-left/up, barn-door, shutter, iris, paper-slide, grain) — giữ nguyên module.exports, ai-gateway tự nhận enum mới qua `Object.keys(grammar.CAMERA)`. `visual-plan/plan.js`: CAMERAS rotation 4→8 + TRANSITION_CYCLE deterministic (cut chủ đạo, nhấn match-zoom/whip định kỳ); `behavior-engine/legacy.js`: pan-up/down → `camera.pan` y±5, crane-in → `camera.push_in`. (2) Renderer: HOLD preset mới `handheld` (rung sin 2 trục lệch pha) + `craneIn` (scale+translateY) thêm ĐỒNG THỜI ở `nova/editor-pro/nova-remotion/src/anim.js` VÀ `bundle/bundle.js` (bundle là runtime, phải sửa cả hai). (3) Documentary `ai/visual-planner.js` §7: schema + heuristic + buildPromptFromPlan + LLM prompt thêm `lens`/`lighting`/`grade` (enum cố định, AI chỉ chọn tên — Luật 8). Kiểm định: `npm run check` PASS (syntax 329 file, IPC 143 kênh, parity, shared); `test:video-agent` 6 suite PASS (114 pass, BRIDGE-CONTRACT HOLD=13 xác nhận preset mới); `nova/documentary/test.js` PASS; `test:video-agent:render` REAL-RENDER-OK (2.454s). Ghi chú: không dùng trực tiếp repo github seedance-2.0 (đó là prompt-skill docs, không phải module) — chỉ port tư duy vocabulary vào grammar hiện có.
- [2026-09-05] Toolscript — sửa lệch giữa hint và logic **Chế độ Novel**
  (`nova/web/index.html`): hint cũ ghi "≈450 từ/chương" nhưng logic thật lấy số
  chương & số từ/chương từ khối QUY MÔ (`tsChapters` × `tsWordsPerChapter`),
  khiến `TS_NOVEL_CH_WORDS=450` thành dead code (element luôn tồn tại nên nhánh
  fallback không bao giờ chạy). Fix 3 điểm: (1) nhánh Novel trong `tsGenerate`
  clamp `n >= 2` — nếu QUY MÔ để 1 chương thì tự tách theo ~450 từ/chương giữ
  đúng tổng số từ (trước đây n=1 làm Architect validate `chapters.length >= 2`
  chết sau 3 tries hoặc LLM tự trả 2×1200=2400 từ, gấp đôi yêu cầu); (2)
  `chWords = Math.round(words/n)` thay vì đọc thẳng `tsWordsPerChapter` để hết
  lệch tổng khi user chọn số từ bằng chip `tsSetWords()`; (3) `tsUpdateScale`
  đồng bộ đủ 3 lớp (class + localStorage `ts_novel_mode` + hint) khi auto
  bật/tắt chip theo QUY MÔ — trước đây chỉ đổi class nên phiên sau `tsInit`
  khôi phục sai trạng thái. Hint UI viết lại mô tả đúng hành vi. Renderer-only,
  không đụng IPC/contract. Kiểm định: `npm run check` PASS; node sanity test
  các case 1×1200 / 2×1200 / 5×1000 / chip-3000-từ / 800-từ-1-chương đều giữ
  đúng tổng số từ.

- [2026-09-05] Tích hợp công cụ **I-MZic** vào sidebar trái bằng iframe trong `nova/web/index.html`:
  - Thêm nav item `toolimzic` (label: I-MZic), thêm section `<div class="tool" id="tool-toolimzic">` với `<iframe id="imzicFrame" data-src="img-to-vid.html">`.
  - Lazy-load `img-to-vid.html` trong `switchTool('toolimzic')` khi mở lần đầu.
  - Thêm CSS cho section `#tool-toolimzic` và `#tool-toolimzic iframe` để chiếm toàn bộ vùng tool, tránh lỗi hiển thị khi render.
  - File `nova/web/img-to-vid.html` đã được copy từ `ImgToVid Ver1.4.html` để giữ nguyên UI/logic gốc I-MZic.

- [2026-09-05] Toolscript — **thay quyết định phía trên**: bỏ hẳn hành vi
  "tự tách ~450 từ/chương", thay bằng **điều kiện tường minh: Chế độ Novel chỉ
  bật được khi QUY MÔ ≥ 2 chương**. Lý do: tách ngầm làm user khó hiểu nguồn
  gốc số chương (feedback trực tiếp). Thay đổi trong `nova/web/index.html`:
  (1) `tsToggleNovel` chặn bật + báo lỗi rõ khi CHƯƠNG < 2; (2) nhánh Novel
  trong `tsGenerate` fail lộ liễu nếu n < 2 lọt qua state lệch (Luật 10 —
  không tự tách ngầm); (3) xoá hằng chết `TS_NOVEL_CH_WORDS`; (4) `tsInit`
  chỉ khôi phục chip từ localStorage khi QUY MÔ vẫn ≥ 2 chương, lệch thì xoá;
  (5) `tsUpdateScale` tự tắt chip + báo status khi CHƯƠNG quay về 1; (6) hint
  UI ghi rõ điều kiện "tối thiểu 2 chương, số chương & từ/chương lấy đúng theo
  QUY MÔ". Renderer-only. Kiểm định: `npm run check` PASS.
- [2026-09-05] UI dropdown **Chủ đề** — sửa không chọn lại được placeholder.
  Nguyên nhân: option placeholder `-- Chọn Chủ Đề --` bị gắn `disabled` ở CẢ HAI
  chỗ trong `nova/web/index.html` (dropdown của tool Tạo Kịch Bản, dòng ~1804,
  và dropdown Dashboard tự động `dashTopicRow`, dòng ~6382), trong khi dropdown
  **Phong cách** kề bên không `disabled` → user chọn lại/đặt lại được phong cách
  nhưng không thể chọn lại "-- Chọn Chủ Đề --" sau khi đã chọn chủ đề. Fix: gỡ
  `disabled` ở cả 2 placeholder + làm chắc handler `onchange` ghép chuỗi
  `(m && s) ? (m + ' - ' + s) : (m || s || '')` để chọn lại placeholder không
  sinh chuỗi thừa `" - "`. Renderer-only, không đụng IPC/contract. `_autoTopic`
  rỗng đã có guard sẵn (dòng ~6639). Kiểm định: `npm run check` PASS
  (syntax 331 file, IPC 143 kênh, parity, shared).
- [2026-09-05] UI dropdown **Chủ đề** — fix lại logic ghép chuỗi để bật lại placeholder thực sự.
  Người dùng vẫn không thể `-- Chọn Chủ Đề --` sau chọn chủ đề vì logic `onchange` trước đó
  giữ lại giá trị phong cách khi chủ đề bị trống, tạo ra chuỗi dính hoặc không clear input.
  Điều chỉnh 4 handler (Tạo Kịch Bản + Dashboard, Chủ đề/Phong cách) thành dạng:
  `m ? (m + (s ? ' - ' : '') + s) : ''` cho input topic, và `(m && s) ? (m + ' - ' + s) : (m || '')` cho hai ô style.
  Renderer-only, không đụng IPC/contract. Kiểm định: `npm run check` PASS
  (syntax 331 file, IPC 143 kênh, parity, shared).
- [2026-09-05] Auto-Fix — kiểm định toàn bộ hệ sinh thái `auto-fix/` và **bật/
  xác minh live error-reporting runtime (observe-only, opt-in)**. Phát hiện BUG
  thật trong wiring production: `client-error-reporter/reporter.js` constructor
  gán `this.queue = options.queue || new LocalQueue(...)` — trong khi
  `nova/main/error-reporter.js` truyền `queue` là OBJECT CẤU HÌNH thuần
  (`{dedupWindowMs, maxPendingPerFingerprint}`) cùng `queueFile` → object truthy
  thay thế LocalQueue → mọi `report()` trong app thật fail thầm với reason
  `report-failed` (Luật 10 vi phạm ngầm). Test wiring cũ chỉ assert TEXT trong
  source nên không bắt được. Fix: constructor chỉ coi object có `enqueue()` là
  queue inject, còn lại là options cho LocalQueue. Thêm regression test vào
  `client-error-reporter/test/reporter.test.js` mô phỏng đúng hình thức
  constructor production. Chứng minh E2E qua Electron thật bằng probe
  `nova/scripts/tmp-error-reporter-e2e.js` (identity thật, code path thật
  `nova/main/error-reporter.js`): trước fix `queued:false/report-failed`, sau
  fix `queued:true` + `crash-queue.json` ghi đúng cấu trúc (fingerprint SHA-256,
  environment_id, event sequence, installation-id) trong
  `%APPDATA%\AI Video Studio Independent`. Đã xoá report demo khỏi queue
  production. Kiểm định: `npm --prefix auto-fix run test:all` PASS (13 suite,
  exit 0), `npm run check` PASS (IPC 143 kênh, shared 16 state keys),
  `test:video-agent` PASS (114 test). Lưu ý: Auto-Fix M1 runtime vẫn
  `observe-only`/`runtimeEnabled:false` — chỉ error reporting opt-in
  (`AI_VIDEO_STUDIO_ERROR_REPORTING=1`) được xác minh hoạt động; 13 gate
  governance M1 vẫn BLOCKED chờ external evidence (CI run, branch protection,
  signing, security review).

- [2026-09-05] Bộ khởi động môi trường Crash Reporter + Crash Service/Worker:
  - `start-stage.ps1`: chọn `-Stage dev|test|prod`, `-Target app|worker|env`,
    `-NoLaunch`, `-Force` + các tham số `-AppUploadUrl/-AppUploadToken/-BuildId/
    -CrashServiceUrl/-WorkerToken/-WorkerId` — tự set env nhóm `AI_VIDEO_STUDIO_ERROR_*`,
    `CRASH_SERVICE_URL`, `WORKER_*`, `DATABASE_URL`, `*_TOKEN_HASH`, `DEVICE_ID_PEPPER`,
    in cảnh báo thiếu biến theo stage.
  - `start-stage.bat`: không tham số / `gui` / `-gui` / `/gui` → mở GUI
    `start-stage-ui.ps1`; có tham số khác → forward toàn bộ vào `start-stage.ps1`.
  - `start-stage-ui.ps1`: GUI WinForms chọn Stage/Target, nhập biến tùy chọn,
    checkbox NoLaunch/Force, nút Run (spawn PowerShell mới) + Copy command.
  - `auto-fix/crash-environment-templates.ps1`: in template `.env` DEV/TEST/PROD
    (không chứa secret thật) để copy nhanh.
  - **Fix cú pháp GUI (PS 5.1)**: dòng `return [string]::Join(' ', $cmdParts | ForEach-Object {...})`
    bị parse error vì PS 5.1 không cho pipeline trực tiếp làm argument trong
    method-call paren — đã tách ra `$quotedParts = @($cmdParts | ...)` rồi Join.
  - Kiểm định: parser PASS cả 2 file `.ps1`; smoke `-Stage dev|test -Target env|app
    -NoLaunch` qua `.bat` in/check env đúng (WARN thiếu biến là behavior chuẩn);
    `npm run check` PASS (syntax 331 file, IPC 143 kênh, parity, shared, exit 0).

- [2026-09-05] Handdraw Studio — **fix "thanh tiến trình không cập nhật" giữa
  render** (tiếp nối hdlasso6): bar kẹt 5% + label kẹt "khởi động…" suốt lúc
  render vì (1) panel chỉ vẽ %, label `progressMsg` không theo `s.status` của
  event `whiteboard:exportProgress`; (2) engine Python vendored KHÔNG phát %
  từng khung hình (script chỉ print đầu/cuối, cam kết không sửa nguồn repo) nên
  `report()` chỉ có mốc thô 2→5→85→92→100; (3) ipc.js relay lỗi dạng
  `status:'error: …'` nhưng panel chỉ so `=== 'error'` → nhánh reset
  `exporting` qua event không khớp. Đã sửa:
  - `nova/web/handdraw-studio-panel.js` (marker **hdlasso7**): listener cập nhật
    cả `progressMsg` (cắt 90 ký tự) theo `s.status`; reset `exporting` khi
    `status === 'done'` HOẶC tiền tố `error` (khớp định dạng relay thật).
  - `nova/whiteboard-studio/py-backend.js` (`exportVideo`, `module.exports`
    giữ nguyên): `report(1,…)` TRƯỚC bước `status()` (deps check mất vài giây);
    **ticker ước tính 1.5s/cảnh** — lũy tiến tiệm cận trong phạm vi
    [5+80·i/N, 5+80·(i+1)/N), cap `sceneEnd−1` đảm bảo không vượt/giảm so với
    mốc thật, dọn bằng `finally`, `unref` để không giữ tiến trình node khi thoát,
    status ghi rõ "ước tính, đã Xs" (Luật 10: không giả vờ là % thật).
    Re-check sau fix: cap cứng thêm `estCeil = max(sceneStart, sceneEnd−1)` cho
    edge case >80 cảnh (dải mỗi cảnh <1% — tránh % tụt giảm ngược).
  Kiểm định: `node --check` 2 file PASS; `_check_hd_ids.js` PASS (SHELL_HTML ↔
  bind() ↔ els.*); `_smoke_handdraw.js` PASS E2E (0.56MB hand + 0.29MB pen) —
  log thấy event ước tính chảy liên tục 26s rồi nhảy mốc thật (xong cảnh →
  sao chép → done); `npm run check` PASS (331 file, 143 kênh IPC, parity,
  shared 16 state keys). Không đụng kênh IPC/preload/repo vendored.

- [2026-09-05] I-MZic — rà soát lỗi phát sinh sau khi nhúng tool. Phát hiện &
  fix 2 lỗi thật:
  (1) **Chuyển tool giữa chừng lúc export làm video đứng hình**: iframe
  `imzicFrame` bị `switchTool` ẩn → Chromium throttle canvas trong iframe ẩn →
  MediaRecorder ghi đứng hình; warning `visibilitychange` của trang con nằm
  bên trong iframe đã ẩn nên người dùng không thấy. Fix: expose cờ
  `window.__imzicExporting` (getter đọc `isExporting`) trong
  `nova/web/img-to-vid.html` + guard trong `switchTool` (`index.html`, ~dòng
  8155): đang ghi thì chặn chuyển tool + `novaToast` giải thích.
  (2) **`await audioEl.play()` không catch → `isExporting` kẹt vĩnh viễn**:
  nếu `play()` reject, cờ giữ `true`, recorder không stop, 2 nút export chết
  đến reload. Fix: try/catch đặt `aborted`, `recorder.stop()`, status lỗi lộ rõ
  nguyên nhân (Luật 10), reset `isExporting` + `onstop` phân nhánh aborted.
  Rủi ro chấp nhận (không fix): Google Fonts CDN — đã là pattern sẵn của
  `index.html`, offline chỉ fallback font; `<a download>` blob trong iframe →
  Electron save dialog mặc định (app không có handler `will-download`);
  hàm `bindRange` chết & `state.colorTouched` khởi tạo ngầm (không gây bug).
  Renderer-only, không đụng IPC/contract. Kiểm định: extract `<script>`
  `img-to-vid.html` qua `node --check` PASS (39.569 bytes); `npm run check`
  PASS (syntax 331 file, IPC 143 kênh, parity, shared 25 file/16 state keys).

- [2026-09-05] I-MZic — **"sửa toàn bộ cho ổn định"**: harden tiếp `img-to-vid.html`
  sau vòng audit 1 (6 nhóm sửa, giữ nguyên kiến trúc iframe + hợp đồng
  `__imzicExporting`):
  1. `playBtn`: `await audioEl.play()` không catch → unhandled rejection; giờ
  try/catch + status lỗi rõ nguyên nhân.
  2. Chọn ảnh: thêm validate loại file (image/* | đuôi png/jpg/gif/webp/bmp/avif),
  `Image.onerror` (file hỏng báo ngay, không im lặng), revoke object URL cũ —
  hết rò rỉ bộ nhớ khi đổi ảnh nhiều lần.
  3. Chọn nhạc: thêm `audioEl.onerror` (file hỏng trước đó để seekBar kẹt
  disable không thông báo), revoke URL cũ, seekBar max xử lý duration
  `Infinity` (webm), thêm state `audioReady` — `checkReady` giờ yêu cầu metadata
  đã nạp; `recordAndExport` chặn export khi chưa ready.
  4. Export: thêm `recorder.onerror` (lỗi giữa chừng trước đó kẹt `isExporting`
  vĩnh viễn — flag `failed`, không tải file nửa vời), watchdog dừng recorder
  sau `duration+15s` (hoặc cap 2h nếu duration không finite) phòng `ended`
  không bao giờ đến, `try/catch` quanh `recorder.start()`, cleanup dừng track
  canvas (giữ nguyên audio track dùng chung `streamDest`), revoke blob URL
  video/nhạc sau 60s.
  5. Guard đang ghi: `playBtn`/`restartBtn`/`seekBar` bị chặn thao tác khi
  `isExporting` (pause/seek giữa lúc ghi trước đó phá bản ghi — video lệch
  nhịp/đứng khung).
  6. Dọn code chết: xoá hàm `bindRange` (chưa từng gọi, chứa dòng no-op),
  khai báo tường minh `state.colorTouched:false`.
  Renderer-only, không đụng IPC/contract/env. Kiểm định: extract `<script>`
  → `node --check` PASS (43.294 bytes); cả 4 script check PASS riêng lẻ
  (syntax 331 file, IPC 143 kênh/20 events, parity 0, shared 25 file/16 key).

- [2026-09-06] I-MZic — harden vòng 2 (các thao tác phá bản ghi giữa lúc ghi,
  `nova/web/img-to-vid.html`):
  1. **Đổi ảnh/nhạc/SRT giữa lúc ghi**: guard ở `imgInput`/`audInput`/`srtInput`/
  `loadSrtPasteBtn` — chặn + xoá selection + status giải thích (đổi file giữa
  lúc MediaRecorder chạy sẽ phá track hình/âm của bản ghi).
  2. **Đổi khổ hình giữa lúc ghi**: guard `applyLandscapeCustomSize` (hoàn tác
  ô customW/customH về đúng canvas hiện tại) + `setOrientation` (biến
  `appliedOrientation` hoàn tác `state.orientation` & chip vì chip click đã
  mutate state trước khi guard chạy). Đổi `canvas.width/height` giữa lúc
  `captureStream` đang ghi làm hỏng track video.
  3. **Đổi leadMs giữa lúc ghi**: guard + hoàn tác slider về `state.leadMs` —
  đổi `delayNode.delayTime` giữa lúc ghi làm lệch nhịp audio của chính bản ghi.
  4. **Bug `isSeeking` kẹt vĩnh viễn**: nhánh chặn seek khi đang ghi trả về
  mà không reset `isSeeking` → `timeupdate` bị khoá vĩnh viễn sau khi ghi xong
  (seekBar đứng im). Fix: reset `isSeeking=false` trước khi return.
  5. **`f.text()` không catch** (srtInput): unhandled rejection nếu file SRT
  không đọc được → try/catch + status lỗi (Luật 10).
  6. **`recordAndExport` early-return im lặng**: bấm export khi đang ghi /
  thiếu file trước đây không báo gì → giờ có status message rõ.
  Renderer-only. Kiểm định: extract `<script>` → `node --check` exit 0;
  `npm run check` PASS (CHECK_EXIT:0 — syntax 331, IPC 143, parity 0,
  shared 25 file/16 key). Đã xác minh `novaToast` (index.html dòng 6161)
  tồn tại → guard chặn chuyển tool ở `switchTool` hiển thị thông báo đúng.

- [2026-09-06] I-MZic — **gói 4 cải tiến** (#1–#4 + #9 + #12, theo lựa chọn của user):
  1. **#1 Bug UI**: chip "🌧 Mưa bay" bị lặp 2 lần trong `effectChips` → xoá 1 dòng.
  2. **#2 Tiến trình ghi**: thanh progress (`progWrap/progBar/progText`) cập nhật
     trong render loop theo `audioEl.currentTime/duration` khi `isExporting`.
  3. **#3 Huỷ ghi**: nút "✕ Huỷ ghi" — `activeExportCancel` (closure trong
     `recordAndExport`) dừng nhạc + chốt recorder; `onstop` thấy `aborted` (tái dùng
     cơ chế cũ) + `abortMsg` phân biệt "user huỷ" vs "không phát được nhạc" →
     KHÔNG tải file nửa vời. Mọi điểm reset UI gom về `finishExportUI()` (điểm gán
     `isExporting=false` duy nhất).
  4. **#4 Nhớ cài đặt**: localStorage key `imzic:settings:v1` — lưu mọi range/
     color/select/customW-H + 6 nhóm chip + nội dung srtPaste (cap 20k chars).
     Khôi phục bằng set value + dispatch event để listener sẵn có tự cập nhật
     state/nhãn/rebuild (không nhân bản logic). `loadSettings()` phải gọi SAU
     `let isExporting` (TDZ: listener leadMs/setOrientation đọc isExporting).
  5. **#9 Xuất 1080p**: tách hệ toạ độ LOGIC (`logicW/logicH`, mặc định 720×1280)
     khỏi canvas VẬT LÝ — khi ghi, canvas phóng `EXPORT_UPSCALE=1.5` (cap 4096px,
     bitrate 8→14 Mbps khi phóng) rồi render() áp `ctx.setTransform(canvas/logic)`
     nên mọi hiệu ứng giữ nguyên hệ toạ độ; `cleanup()` trả canvas về khổ preview.
     Đã đổi `rebuildParticles/drawWave/drawLyrics/drawParticles/updateParticle/
     applyLandscapeCustomSize/setOrientation` sang dùng logic dims.
  6. **#12 Ghép nhạc tự động**: kênh IPC MỚI `imzic-mux` (main `nova/main/ipc/imzic.js`
     — ffmpeg-static, `-c copy -shortest` ra .mkv, save dialog, dọn tmp, error code
     `IMZIC_*` theo Luật 10), đăng ký trong `nova/main/ipc/index.js`, preload
     `window.native.imzicMux`. Renderer: nút "⚡ Ghép nhạc tự động" hiện sau khi
     xuất video câm (`lastSilentBlob`), mượn `window.parent.native` vì tool chạy
     trong iframe cùng origin (bridge `native` chỉ expose ở main frame).
  Kiểm định: extract `<script>` → `node --check` PASS (55.235 bytes);
  `node --check` imzic.js/index.js/preload.js PASS; `npm run check` PASS
  (syntax 333 file, IPC 144 kênh/20 events — +1 kênh `imzic-mux`, parity 0,
  shared 26 file/16 key). Script tạm `tmp-imzic-check.js` đã xoá.

- [2026-09-06] I-MZic — **tối ưu tốc độ render loop, KHÔNG đổi tiêu chuẩn đầu ra**
  (theo yêu cầu: nhanh hơn nhưng không giảm/hỏng chất lượng; renderer-only,
  `nova/web/img-to-vid.html`):
  1. **Raster cache ảnh nền** (điểm nóng #1): trước đây `ctx.drawImage` resample
     ảnh GỐC (có thể 6000px) MỖI FRAME — nặng nhất khi ghi 1080×1920. Giờ quét
     MỘT LẦN vào offscreen canvas khổ `cover(canvas vật lý) × zoomMax` (zoomMax
     làm tròn LÊN bước 0.05 → kéo slider không rebuild liên tục), mỗi frame vẽ
     từ raster. Raster luôn ≥ khổ hiển thị (chỉ downscale ≤ zoomMax, không bao
     giờ upscale — đã mô phỏng verify 4 case PASS) + bước quét dùng
     `imageSmoothingQuality:'high'` → độ nét tương đương hoặc TỐT HƠN trước.
     Key = img.src + dims + canvas dims + zq; đổi ảnh/vào-ra chế độ ghi tự
     rebuild, canvas không resize khi key giữ nguyên → không phá track ghi.
     Raster cho ảnh 6000×4000 chỉ 3024×2016 (downscale to 1 lần, nhẹ hơn nhiều
     so với 60 lần full-res mỗi giây).
  2. **Cache wrap lời**: `wrapLyricTextCached` — bỏ `measureText` từng chữ mỗi
     frame, chỉ tính lại khi đổi SRT (`lyricsVersion++` trong
     `loadLyricsFromText`) / dòng / font / cỡ / khung. Kết quả wrap giữ nguyên
     → vị trí chữ trên video KHÔNG đổi.
  3. **Throttle UI tiến trình 100ms** (#2): DOM writes 60 lần/giây → 10 lần/giây,
     refs `progEls` hoisted — thuần UI ngoài canvas, không dính file xuất.
  4. **Memoize `hexToRgba`**: parse hex cache theo chuỗi màu (hàng trăm lần gọi
     mỗi frame từ bead/dot/bar của sóng) — chuỗi rgba trả về GIỮ NGUYÊN từng ký tự.
  KHÔNG đụng: bitrate, độ phân giải, shadowBlur, gradient động, số segment,
  logic particle/zoom/timing/lead — mọi đặc tính hình ảnh của file xuất giữ nguyên
  (CPU dư → ít rơi frame khi ghi → chất lượng file còn ổn định hơn).
  Kiểm định: extract `<script>` → `node --check` PASS (58.762 bytes); mô phỏng
  toán raster 4 case ALL-PASS; `npm run check` PASS (syntax 333, IPC 144/20,
  parity 0, shared 26/16). `tmp-imzic-check.js` đã xoá sau dùng.

- [2026-09-06] I-MZic — **tách 3 dải tần số từ FFT có sẵn** (theo yêu cầu user:
  zoom theo bass, particle nhịp theo treble, sóng giữ nguyên; renderer-only,
  `nova/web/img-to-vid.html`):
  1. Cùng MỘT lần `getByteFrequencyData` mỗi frame, chia phổ (fftSize 256 → 128
     bin × ~172 Hz/bin @44.1 kHz): bass = bin 0-3 (0-~690 Hz), treble = bin 24-63
     (~4.1-11 kHz, nhân 1.4 vì biên độ bin treble vốn nhỏ). Helper `avgFreqRange`
     chuẩn hoá 0..1; guard khi `freqData` null.
  2. **Zoom ảnh nền giờ ăn đúng dải trầm** (trước đây trộn ~15 bin đầu gồm cả
     giọng hát) → nhịp phóng "đấm" theo kick rõ hơn; vẫn qua `state.sensitivity`
     + smoothing theo `state.smoothness` như cũ.
  3. **Particle (tuyết/hoa/stars/mưa) pulse theo treble**: `smoothedTreble`
     attack/decay nhanh (pow(0.72, dt)) để "phập" theo hi-hat; `drawParticles`
     nhận `treblePulse` → hạt nở tối đa +30% cỡ (`grow`) và sáng +25% (`boost`,
     alpha clamp 1). **treble=0 → grow=boost=1 → hình ảnh giống hệt hệ cũ** (nhạc
     trầm/im lặng không đổi) — đây là bảo đảm "không hỏng baseline".
  4. Sóng nhạc: KHÔNG đụng — `waveEnergyAt` vẫn ánh xạ toàn bộ 128 bin như trước.
  Không thêm dependency, không đổi IPC/state key. Kiểm định: extract `<script>`
  → `node --check` PASS (60.454 bytes); `npm run check` PASS (syntax 337,
  IPC 144/20, parity 0, shared 26/16). `tmp-imzic-check.js` đã xoá sau dùng.
- [2026-09-06] Handdraw Studio — **tiến trình thật + ETA + phát hiện kẹt trong
  export MP4** (tiếp nối hdlasso7; user feedback: "thanh tiến trình chưa đúng,
  dự tính thời gian chưa chính xác, không biết đang làm gì hay bị kẹt"):
  - Gốc rễ: engine vendored `render_stream_whiteboard.py` KHÔNG phát gì trong lúc
    render (chỉ print đầu/cuối) → giải pháp cũ là ticker "bò % ước tính" giả.
  - **`nova/whiteboard-studio/render-progress-bridge.py` (file MỚI của Nova,
    repo vendored KHÔNG sửa)**: bọc `cv2.VideoWriter` bằng subclass đếm khung
    (mọi khung engine ghi đều qua `write()`) + bọc `stream_render.transcode_h264`
    → phát stderr flush từng dòng: `WBPROG open fps=/w=/h=`, `WBPROG frame=N`
    (mỗi 5 khung), `WBPROG transcode`, `WBPROG error`. Chạy vendored script y

- [2026-09-06] CI/M1 — **sửa CI fail ở bước Checkout của cả 2 workflow**
  (repo vừa chuyển public, giờ verify trực tiếp GitHub API được):
  - Gốc rễ: git index có **gitlink** `nova/whiteboard-studio/srt-whiteboard-animation`
    (mode 160000, có từ các commit sync whiteboard `76a8a975`/`9ec9c9f8`) nhưng
    repo chính **không có `.gitmodules`** → `actions/checkout@v7` fail
    `git exit 128: "No url found for submodule path ... in .gitmodules"` ngay ở
    step "Checkout full source history" → mọi step sau bị skip. Cả M1 Validation
    lẫn Windows Package fail y hệt (run #24, #23 và các run trước trên PR #3).
  - Fix commit `1594d406`: tạo `.gitmodules` khai báo submodule
    `https://github.com/khanhtran0393/srt-whiteboard-animation.git` (fork public
    của user); đã `git submodule init` local. CI không bật `submodules: true`
    nên checkout chỉ cần .gitmodules hợp lệ, không clone nội dung submodule.
  - Đồng thời push commit `6b378f4` của submodule lên fork (`696a724..6b378f4`)
    để SHA gitlink pin thực sự tồn tại trên remote.
  - Sau khi checkout được (run #25 trên `1594d406`), M1 Validation vẫn fail tiếp ở
    step 6 (`npm --prefix auto-fix run test:all`): **`control-plane.test.js:54`**
    — CI checkout PR ở **detached HEAD** → `git symbolic-ref --short -q HEAD`
    exit 1 → `runGit` **throw** (không trả falsy) → fallback `|| 'DETACHED'`
    không bao giờ chạy → `branch` giữ `null`. Fix commit `2d6957b4`: bọc riêng
    lệnh symbolic-ref trong try/catch map sang `'DETACHED'` (contract mà test đã
    assert; detached HEAD là trạng thái hợp lệ, không phải lỗi). Đã mô phỏng
    detached HEAD trên repo tạm: `branch=DETACHED isGit=true dirty=false` PASS;
    `npm --prefix auto-fix run test:all` PASS; `npm run check` PASS.
  - Lỗi CI thứ 3 (`dependency-scan.test.js:22`): `runDependencyAudit` chạy
    `npm audit --json --prefix <root>`; trên Windows spawn 'npm' (npm.cmd)
    ENOENT → BLOCKED (test pass "tự nhiên"), nhưng trên Linux npm audit với
    `--prefix` trỏ dir không tồn tại **im lặng audit nhầm project ở cwd** →
    trả ok:true (false-positive, fail-open). Fix commit `af72c6a9`: guard
    fail-closed — kiểm tra root + package-lock.json tồn tại trước khi audit.
  - Lỗi CI thứ 4 (`foundation-test.js:38`): test hard-code path Windows
    `X:\data` cho `userDataPath` (dùng `path.resolve`) → trên ubuntu
    `path.resolve('X:\data')` = `<cwd>/X:\data`. Fix commit `b970e95f`: dùng
    absolute path của chính platform (`path.resolve(os.tmpdir(), ...)`).
  - Lỗi CI thứ 5 (step Audit): **lỗ hổng thật** — `fast-uri@3.1.3` (transitive:
    electron-builder → app-builder-lib → ajv) dính 6 advisory GHSA high
    (host confusion/SSRF). Fix commit `1a699d9b`: `npm audit fix` bump
    fast-uri 3.1.3 → 3.1.7 trong lockfile (18 dòng), audit 0 vulnerabilities
    cả full lẫn --omit=dev.
  - Lỗi CI thứ 6 (step readiness fail-closed): readiness báo `FAIL` thay vì
    `BLOCKED` vì **`dirty: true`** — step application checks chạy `check:ipc`
    regenerate `nova/ipc-inventory.json` (trường `generatedAt` luôn đổi) làm
    worktree bẩn → gate clean-worktree FAIL. Đây là vấn đề **thứ tự step**.
    Fix commit `3582758d`: chuyển khối "Verify readiness remains fail-closed"
    + upload artifact lên ngay sau npm ci, TRƯỚC mọi step ghi file.
  - **KẾT QUẢ: M1 Validation run #30 + Windows Package run #30 (commit
    `3582758d`) đều SUCCESS toàn bộ step** (kể cả readiness BLOCKED/exit 2
    đúng thiết kế + upload artifact m1-readiness). PR #3 chuyển
    `mergeable_state: clean` — sẵn sàng merge vào main. Sau khi merge:
    workflow push→main sẽ chạy job `windows-attestation` (đang skipped) →
    lấy run URL làm bằng chứng `sourceProvenance`.
  - Kỹ thuật lấy log CI không cần gh CLI: dùng `git credential fill` (PAT của
    GCM) + API `actions/jobs/<id>/logs` (302 redirect → tải trực tiếp URL
    location không kèm auth). Token tạm đã xoá sau khi dùng.
  - Còn WIP chưa commit của phiên trước (Agent Bridge): `MEMORY.md`,
    `nova/main/server.js`, `nova/main/agent-bridge.js`, `start.bat` — chủ
    kho cần hoàn thiện rồi commit riêng, sẽ làm PR update CI.
  - Kiểm chứng GitHub-side: PR #3 (62 commits, mergeable, `mergeable_state:
    unstable` do CI đỏ), `main` vẫn ở `d973330d` và **chưa protected**;
    **rulesets = `[]`** → gate `branchProtection` trong M1-READINESS-REPORT hiện
    CHƯA có bằng chứng thật (cần tạo ruleset thật ở GitHub Settings → Rules).
    `windows-attestation` job `skipped` đúng thiết kế (chỉ chạy khi push vào main).
  - Lưu ý: bằng chứng `sourceProvenance` (attestation) vẫn chưa thể có run URL
    cho tới khi merge PR #3 vào `main`. Worktree còn WIP chưa commit của phiên
    trước: `MEMORY.md`, `nova/main/server.js`, `nova/main/agent-bridge.js`.

    nguyên qua `runpy` forward argv + exit code. Subclass cv2.VideoWriter đã
    test thủ công với venv thật trước khi áp dụng.
  - `py-backend.js` exportVideo: render qua bridge (args không đổi, bridge tự
    thêm RENDER_SCRIPT); parser stderr/stderr line-buffer tách WBPROG (không vào
    Log renderer) → **% thật = khung đã ghi / (durationMs×fps)**, clamp `estCeil`
    giữ tính đơn điệu; status dạng `cảnh i/N · khung X/Y · Z khung/s · còn ~Ts
    · sau đó k cảnh ≈ ~Ts` (ETA cảnh theo tốc độ khung thật, ETA các cảnh còn
    theo trung bình cảnh đã xong); ticker 2s BỎ crawl giả — chỉ gán nhãn giai
    đoạn im lặng (>4s "đang nét vùng tiếp theo", >25s ⚠ kẹt, trước khung đầu
    "đang tính vùng/nét CPU") + throttle IPC 400ms; `PYTHONUNBUFFERED=1` trong
    childEnv (stdout engine chảy live); `runCapture` thêm opts.onStdout.
  - **Sửa bug tiềm ẩn**: `prepare()` gọi `report(1,…)` — `report` không tồn tại
    ở scope đó (ReferenceError khi bấm "dựng môi trường" lần đầu) → đổi sang
    `onLog`.
  - Panel `handdraw-studio-panel.js` (marker **hdlasso8**): label cắt 90→140 ký
    tự (đủ chứa khung/tốc độ/ETA), watchdog 60s/20s → **15s/5s và cảnh báo
    THẲNG vào label** (phân biệt "engine bận nhưng event vẫn chảy" vs "luồng chết").
  - Kiểm định: node --check + py_compile PASS; `_check_hd_ids.js` PASS;
    `_smoke_handdraw.js` E2E render MP4 thật 2 lần PASS — dòng tiến trình
    `khung 110/300 · 16.3 khung/s · còn ~12s` chảy đều, estTotal khớp đúng 300
    khung thật, nhãn transcode/hoàn tất đúng giai đoạn; `npm run check` PASS
    (syntax 332, IPC 144/20, parity 0, shared 26/16).


## 2026-09-06 - start.bat: chong chay doi instance + khoi chay tach roi console
- Van de: start.bat cu mo instance thu hai khi app dang chay (xung dot cong bridge 8793-8796, EADDRINUSE) va dong cua so console lam chet app (call npm start).
- Giai phap: truoc khi mo, ping Agent Bridge POST /agent/command {action:"ping"} tren 47280-47283 (node -e, khong them dependency):
  - Dang chay -> goi {action:"focus"} dua cua so len truoc roi exit 0, khong mo instance moi.
  - Chua chay -> `start "" /D "%~dp0" electron.exe .` khoi chay TACH ROI console, doi bridge len toi da 30s (ping -n 2 lam sleep, vi timeout loi khi stdin redirect).
- Bug da sua trong lan dau: `^&^&` trong chuoi JS nam trong dau nhay kep la ky tu literal (caret khong escape trong quotes) -> node -e loi cu phap, probe luon fail -> bo && thay bang if long nhau.
- Luu y: ban dong goi "AI Video Studio.exe" (build truoc khi co agent-bridge) phan hoi 404 tren /agent/command -> probe dung coi la "khong co bridge" va mo ban dev song song; neu gap EADDRINUSE 8793-8796 thi do ban packaged dang giu cong.
- Nghiem thu: kich ban lanh (mo moi -> bridge 47280, cmd thoat, app song) PASS; kich ban chay lan 2 (nhan dien DANG CHAY + focus) PASS; npm run check PASS (syntax 332, IPC 144/20, parity 0, shared 27/16).

## 2026-09-06 (2) - single-instance lock: phong cap cuoi cho chay doi
- Kiem tra ky phat hien: app KHONG co requestSingleInstanceLock -> double-click start.bat 2 lan nhanh (truoc khi bridge len) van ra 2 instance; start.bat chi la lop thu 1, app phai tu chan o lop goc.
- Them `nova/main/single-instance.js`: ensureSingleInstance() goi app.requestSingleInstanceLock() SAU applyAppIdentity (lock gan voi userData); that bai -> app.quit() + return o main.plain.js; instance dau nhan su kien second-instance -> restore/show/focus cua so (dung logic giong actionFocus cua agent-bridge).
- Khong anh huong test: test:video-agent:render chay entry khac, packaged-smoke tu killAppExes truoc khi smoke.
- Nghiem thu: instance thu 2 thoat sau ~0.5s voi log "[single-instance] mot instance khac dang chay", instance dau song nguyen + bridge 47280 van tra loi status; start.bat kich ban 2 van DANG CHAY + focus; npm run check PASS (343 files, IPC 144/20, parity 0, shared 28/16).

## 2026-09-06 (3) - hoa thien: test chinh thuc + don tmp + commit
- Nang `tmp-agent-bridge-test.js` thanh `nova/scripts/agent-bridge-test.js` + npm script `test:agent-bridge` (7 case, khong can Electron). Xoa cac script dung mot lan: `tmp-agent-bridge-test.js`, `tmp-agent-bridge-e2e.js` (phu thuoc path cung d:\Zisu_AI, khong hop lam test chinh thuc) va `Zisu_AI/tmp-e2e.py`.
- Commit khoi Agent Bridge tren 2 repo: AVS (agent-bridge.js, single-instance.js, server.js, main.plain.js, start.bat, agent-bridge-test.js, package.json, MEMORY.md, ipc-inventory.json) + Zisu_AI (skill ai_video_studio, helper, executor, router, regression).
