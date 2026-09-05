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

- **Đóng gói sau tính năng Novel — KẾT LUẬN**: `dist\win-unpacked\` MỚI hoàn chỉnh
  (AI Video Studio.exe 225MB + app.asar 476MB @ 21:21, verified chứa `tsNovelBtn` +
  `tsGenerateNovel`) — chạy trực tiếp được, CÓ nút Novel (boot smoke: app sống 30s;
  bridge EADDRINUSE + render crash khi smoke là do dev app đang mở song song chiếm
  cổng 8793-8796 + profile — test lại khi chỉ chạy MỘT mình). NSIS Setup/Portable
  KHÔNG ra sau 6 lần build (1 fail mmap NSIS; 3 lần bị kill nhầm giữa chừng vì tưởng
  treo — thực ra 7za -mx=9 nén rất lâu; 1 fail ENOENT rename electron.exe vì
  win-unpacked dở dang sót; 1 lần nsis.7z phình 3.1GB + Setup 0.5MB hỏng do các
  build đè chồng dữ liệu). Rác 3.1GB đã xoá; Portable 9/4 mất khi dọn dist.
  **Muốn có installer lần sau**: xoá `dist\win-unpacked` + `*.nsis.7z` TRƯỚC,
  chạy MỘT `npm run build:win` duy nhất, không kill giữa chừng (~45-60 phút;
  7za -mx=9 một mình đã chiếm ~20 phút, CPU nghìn giây là BÌNH THƯỜNG).
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
