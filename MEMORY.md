# MEMORY.md â€” Bá»™ nhá»› trÆ°á»ng tá»“n cá»§a dá»± Ã¡n

File nÃ y ghi **tráº¡ng thÃ¡i dÃ i háº¡n vÃ  lá»‹ch sá»­ quyáº¿t Ä‘á»‹nh**. AGENTS.md chá»©a quy chuáº©n
á»•n Ä‘á»‹nh; má»i thá»© cÃ³ tÃ­nh "hiá»‡n táº¡i / Ä‘ang treo / Ä‘Ã£ quyáº¿t" náº±m á»Ÿ Ä‘Ã¢y.

## Giao thá»©c cáº­p nháº­t

- Agent/dev nÃ o táº¡o thay Ä‘á»•i Ä‘Ã¡ng ká»ƒ (kiáº¿n trÃºc, há»£p Ä‘á»“ng module, quyáº¿t Ä‘á»‹nh
  ká»¹ thuáº­t, phÃ¡t hiá»‡n bug há»‡ thá»‘ng) **pháº£i** thÃªm 1 dÃ²ng vÃ o "Nháº­t kÃ½ thay Ä‘á»•i"
  dÆ°á»›i dáº¡ng: `[YYYY-MM-DD] <viá»‡c> â€” <lÃ½ do/áº£nh hÆ°á»Ÿng>`.
- KhÃ´ng xoÃ¡ dÃ²ng cÅ© (Ä‘á»ƒ truy váº¿t); má»¥c nÃ o lá»—i thá»i thÃ¬ Ä‘Ã¡nh dáº¥u `~~gáº¡ch~~` kÃ¨m chÃº thÃ­ch.
- Má»¥c "Äang treo" chá»‰ xoÃ¡ khi Ä‘Ã£ giáº£i quyáº¿t xong vÃ  ghi vÃ o nháº­t kÃ½.

## Tráº¡ng thÃ¡i hiá»‡n táº¡i (2026-09-05)

- **Báº£n cháº¥t**: app Electron Ä‘á»™c láº­p "AI Video Studio Independent" (package
  `ai-video-studio` v1.0.1), entry `nova/main.plain.js`, GUI mirror tá»« AI Video
  Studio 0.1.34. KhÃ´ng Next.js, khÃ´ng backend AI Novel, khÃ´ng nháº­p dá»¯ liá»‡u app cÅ©.
- **ÄÄƒng nháº­p**: Ä‘Ã£ gá»¡ bá» hoÃ n toÃ n; Pro/Max má»Ÿ sáºµn; Google Flow (Settings) lÃ 
  dá»‹ch vá»¥ ngoÃ i, giá»¯ nguyÃªn.
- **ToÃ n bá»™ main-process source Ä‘Ã£ readable má»™t nguá»“n**: cáº·p obfuscate
  `protect.js`/`unprotect.js` Ä‘Ã£ xoÃ¡, `parity-check.js` giá»¯ lÃ m guard no-op
  (0 pairs), entry Electron luÃ´n lÃ  `main.plain.js` á»Ÿ dev láº«n build.
- **Auto-Fix M1**: `BLOCKED` â€” Ä‘Äƒng kÃ½ canonical source + CI definition Ä‘Ã£ cÃ³
  nhÆ°ng chÆ°a cÃ³ operational evidence / branch protection; runtime Auto-Fix
  KHÃ”NG báº­t. Xem `auto-fix/M1-READINESS-REPORT.md`.
- CI: `m1-validation.yml` (cháº¡y `check:shared`), `windows-package.yml`.

## Kiáº¿n trÃºc Ä‘Ã£ á»•n Ä‘á»‹nh (khÃ´ng tÃ¡i cáº¥u trÃºc khi khÃ´ng cáº§n)

- `main.plain.js` = composition root 137 dÃ²ng; logic trong `nova/main/`
  (identity, state, splash, server 127.0.0.1:47280â€“47283, ipc/index).
- 3 bridge cá»¥c bá»™: CLI (8795/8796), MCP (8794), Flow extension bridge.
- 2 dÃ²ng extension Chrome: `flow-extension/` (NGUá»’N) vs `nova-studio/` (biáº¿n thá»ƒ
  cÃ³ chá»§ Ã½) â€” khÃ´ng copy chÃ©o; `chrome-extension/` lÃ  OUTPUT runtime, khÃ´ng sá»­a tay.
- Flow cÃ³ 2 engine song song: `flow-chrome/` (Chrome Ä‘a profile) vÃ 
  `flow-native/` (BrowserWindow Ä‘a profile) â€” khÃ¡c nhau, khÃ´ng pháº£i báº£n sao.
- Video Agent: 17-state pipeline, 12 kÃªnh `videoAgent:*` qua
  `editor-pro/register.js`; TTS master clock, Video Spec SSOT, deterministic
  timeline, Auto-Fix â‰¤5 attempt, S3 SigV4 tá»± kÃ½ (khÃ´ng aws-sdk).
- Renderer `nova/web/`: script thÆ°á»ng khÃ´ng build step (nguon-web/, fractal-engine/
  tÃ¡ch theo thá»© tá»± náº¡p HTML); `editor-pro/niche/` láº¡i lÃ  CommonJS main-process â€”
  hai kiá»ƒu tÃ¡ch KHÃ”NG trá»™n láº«n.

## Äang treo / ná»£ ká»¹ thuáº­t
- **Niche Finder hỗ trợ trending theo khu vực (gl)** (2026-09-07 → 2026-09-08): Đã sửa `searchVideos` trong `loi.js` để khi `query` rỗng, dùng `https://www.youtube.com/feed/trending` và thêm tham số `gl` từ `opts.gl`; đồng thời de-duplicate hàm `searchVideos` (bản merge cũ còn sót 2 định nghĩa). `ipc-niche.js` truyền `gl` từ payload vào `opt()`. Frontend `nova/web/index.html`: thêm dropdown `<select id="nfGl">` (26 mã quốc gia: US/GB/CA/AU/DE/FR/ES/IT/JP/KR/BR/IN/MX/ID/VN/TH/PH/SG/RU/NL/PL/TR/SA/EG/ZA/NG) vào header tool Niche Finder; `nfRun()` đọc giá trị dropdown rồi gán `payload.gl` khi khác rỗng. Kiểm định `npm run check` PASS (syntax 374 file, IPC 158 kênh, parity 0, shared 17 state keys). Script tạm `tmp-fix-loi.js`/`tmp-fix-emoji.js` đã xoá.
- **UI Flow model refresh** (2026-09-06): ThÃªm nÃºt `â†»` cáº¡nh dropdown Model trong tab Video (Tool 6) vÃ  hÃ m `tvRefreshModels()` gá»i `VIDEO_MODEL_STATUS` Ä‘á»ƒ cáº­p nháº­t danh sÃ¡ch model tá»« extension/native. `tvRenderModelOptions()` gá»™p model built-in + model há»c Ä‘Æ°á»£c tá»« Flow. Kiá»ƒm Ä‘á»‹nh `npm run check` PASS (syntax 367, IPC 154/20, parity 0). ChÆ°a test runtime vá»›i Flow cÃ³ nhiá»u model thá»±c táº¿.

- ~~**ÄÃ³ng gÃ³i sau tÃ­nh nÄƒng Novel â€” CHáº¨N ÄOÃN CUá»I**~~ **ÄÃƒ GIáº¢I QUYáº¾T (22:50)**:
  root cause lÃ  `asarUnpack` kÃ©o `nova/voice-backend/**/*` (venv .venv-omni 1.3GB)
  + `nova/tdt-studio/**/*` (runtime/venv PySide6 805MB) â†’ nsis.7z 3.1GB > ngÆ°á»¡ng
  mmap 2GB cá»§a makensis 32-bit â†’ Setup há»ng. **Fix phÆ°Æ¡ng Ã¡n 1** (user duyá»‡t): thÃªm
  2 exclude vÃ o `files` cá»§a `electron-builder.json`:
  `!nova/voice-backend/.venv-omni{,/**/*}` + `!nova/tdt-studio/runtime/venv{,/**/*}`
  â†’ nsis.7z cÃ²n 1.38GB <2GB â†’ build THÃ€NH CÃ”NG cáº£ 2 target:
  `dist\AI-Video-Studio-Setup-1.0.1-x64.exe` 1382.7MB + Portable 1380.8MB
  (22:50), asar verified chá»©a `tsNovelBtn`/`tsGenerateNovel`.
  **DEGRADE CÃ“ CHá»¦ Ã + KHAI BÃO (Luáº­t 10)**: báº£n packaged KHÃ”NG chá»©a venv
  OmniVoice (`.venv-omni`) vÃ  venv PySide6 cá»§a TDT Studio â†’ Voice engine
  OmniVoice + tool ðŸŽ¬ Studio (PyQt) sáº½ KHÃ”NG cháº¡y Ä‘Æ°á»£c trong báº£n Ä‘Ã³ng gÃ³i cho
  tá»›i khi user cháº¡y `nova/voice-backend/setup-omni.bat` (cÃ i láº¡i venv) / TDT tá»±
  táº¡o venv láº§n Ä‘áº§u; báº£n full-runtime 9GB cÃ²n giá»¯ á»Ÿ
  `dist\win-unpacked-novel-ok\` (21:21) â€” XOÃ ÄÆ¯á»¢C khi khÃ´ng cáº§n (giáº£i phÃ³ng 9GB).
- `nova/scripts/` cÃ²n nhiá»u script `tmp-*` dÃ¹ng má»™t láº§n (tmp-watch-dist,
  tmp-voice-crash, tmp-watch-build, tmp-check-index-html-js, tmp-smoke-novelâ€¦) â€”
  chÆ°a dá»n thÃ nh archive.
- Binary runtime tá»± táº£i (upscaler-bin, inpaint-bin, voice-backend, sqlite-bin,
  onnx-bin, ytdlp-bin, editor-pro/remotion-browser) â€” khÃ´ng track trong git.
- Video Agent Phase 3: model rembg/SAM (u2net ~170MB) chÆ°a táº£i â†’ segmentation
  degrade heuristic; identity chá»‰ dHash 64-bit, chÆ°a lÃªn CLIP embedding.
- Repo gá»‘c cÃ²n file launchæ®‹ç•™ á»Ÿ root (chrome_crashpad, debug.log, snapshot_*,
  vulkan/d3d dllâ€¦) â€” khÃ´ng track, chá»‰ hiá»‡n trÃªn mÃ¡y dev.

## Nháº­t kÃ½ thay Ä‘á»•i
- [2026-09-08] Fix o Xem truoc Tool 7 (Dung Video) qua nho: xoa hang nut mini du thua trong section Xem truoc cua nova/web/index.html - ban goc da go hang nay nen _t7SyncColHeight tru ngoaiKhung khong bi chrome day lam co nho. Giu nguyen 3 cho container-type:size da phuc hoi truoc do. Kiem dinh npm run check PASS (28 files, 17 state keys).
- [2026-09-06] **Whiteboard Studio: bá» Ä‘iá»ƒm káº¹t "chá»n má»™t cáº£nh trÆ°á»›c"** â€” user báº¥m nÃºt
  "ðŸ–¼ áº¢nh cho cáº£nh Ä‘ang chá»n" khi chÆ°a click chá»n cáº£nh nÃ o (log: âš  chá»n má»™t cáº£nhâ€¦ Ã—2).
  Handler giá»: (a) chÆ°a cÃ³ cáº£nh nÃ o â†’ log dáº«n tháº³ng tá»›i ðŸ–¼ðŸ–¼ Chá»n nhiá»u áº£nh / BÆ°á»›c 1;
  (b) cÃ³ cáº£nh nhÆ°ng chÆ°a chá»n â†’ Tá»° chá»n cáº£nh Ä‘áº§u tiÃªn chÆ°a cÃ³ áº£nh (log â„¹), rá»“i má»Ÿ dialog
  luÃ´n â€” khÃ´ng cháº·n ná»¯a. Log user cÃ²n cho tháº¥y `deps âœ—` (venv cÃ³, thiáº¿u cv2/numpy/av/PIL)
  â†’ user pháº£i báº¥m âš™ Chuáº©n bá»‹ Python trong hero (prepare() sáº½ pip install pháº§n thiáº¿u qua
  prepare_env.py; cáº§n Ctrl+R app trÆ°á»›c vÃ¬ app Ä‘ang cháº¡y lÃ  báº£n cÅ©). Smoke DOM: 0 cáº£nh â†’
  báº¥m "Chá»n nhiá»u áº£nh" â†’ 3 cáº£nh/3 áº£nh, cáº£nh bÃ¡o má»›i Ä‘Ãºng, khÃ´ng lá»—i runtime (1 láº§n smoke
  fail chá»‰ vÃ¬ mock thiáº¿u probeImage â€” khÃ´ng pháº£i lá»—i panel). `npm run check` PASS.
- [2026-09-06] **Whiteboard Studio: nháº­p áº£nh hÃ ng loáº¡t + xÃ¡c minh "chá»n áº£nh khÃ´ng Ä‘Æ°á»£c"** â€” user
  khÃ´ng tÃ¬m ra cÃ¡ch nháº­p áº£nh. ÄÃ£ soi toÃ n chuá»—i (panel renderer / preload / ipcMain /
  dialog) â€” code Ä‘Ãºng á»Ÿ má»i táº§ng; xÃ¡c minh báº±ng **smoke DOM Electron** (file tmp, Ä‘Ã£ dá»n):
  load panel + mock `window.native` â†’ dÃ¡n ká»‹ch báº£n â†’ 2 cáº£nh â†’ báº¥m ðŸ–¼ â†’ áº£nh gÃ¡n, log âœ“.
  NguyÃªn nhÃ¢n tháº­t: IPC `whiteboard:pickImages`/`pickImagesDir` cÃ³ sáºµn á»Ÿ preload + ipc.js
  nhÆ°ng panel **khÃ´ng cÃ³ nÃºt nÃ o gá»i** â†’ chá»‰ nháº­p Ä‘Æ°á»£c tá»«ng áº£nh/tá»«ng cáº£nh. Fix renderer-only:
  BÆ°á»›c 2 thÃªm 2 nÃºt ðŸ–¼ðŸ–¼ Chá»n nhiá»u áº£nh / ðŸ“ ThÆ° má»¥c áº£nh â†’ `assignImages(paths)` gÃ¡n tuáº§n tá»±
  vÃ o cáº£nh chÆ°a cÃ³ áº£nh, áº£nh dÆ° tá»± táº¡o cáº£nh má»›i (6s, "Cáº£nh tá»« áº£nh (khÃ´ng SRT)"); empty-state
  hint cáº­p nháº­t. Smoke: 2 cáº£nh + 3 áº£nh â†’ 4 cáº£nh, 4/4 cÃ³ áº£nh. `npm run check` PASS (360 file,
  148 kÃªnh). LÆ°u Ã½: app cÅ© Ä‘ang cháº¡y cáº§n Ctrl+R / restart Ä‘á»ƒ tháº¥y nÃºt má»›i.
- [2026-09-06] **Whiteboard Studio: empty-state BÆ°á»›c 2** â€” user khÃ´ng tÃ¬m ra chá»— nháº­p áº£nh vÃ¬
  nÃºt chá»n áº£nh chá»‰ hiá»‡n khi Ä‘Ã£ cÃ³ cáº£nh (má»—i cáº£nh 1 áº£nh, theo workflow repo). renderSceneList()
  giá» hiá»ƒn thá»‹ Ã´ hÆ°á»›ng dáº«n nÃ©t Ä‘á»©t ("ChÆ°a cÃ³ cáº£nh nÃ o â€” táº¡o á»Ÿ BÆ°á»›c 1â€¦") khi danh sÃ¡ch trá»‘ng;
  thÃªm CSS `.wb-items-empty` trong index.html. Kiá»ƒm Ä‘á»‹nh: node --check + `npm run check` PASS.
- [2026-09-06] **Whiteboard Studio: UI identity v2 "báº£ng váº½"** â€” panel trÆ°á»›c dÃ¹ng nguyÃªn bá»™ var CSS
  chung nÃªn khÃ´ng khÃ¡c biá»‡t gÃ¬ so vá»›i cÃ¡c tool khÃ¡c. Thiáº¿t káº¿ riÃªng (renderer-only, 2 file:
  `nova/web/index.html` thÃªm block CSS `.wb-root-v2` ~50 dÃ²ng; `whiteboard-studio-panel.js` Ä‘á»•i
  SHELL_HTML + `refreshEngine()` + `log()`): (a) **hero banner** gradient ink tá»‘i (Ä‘en-tÃ­m) vá»›i
  mark ðŸ–Š, tagline pipeline, engine status dáº¡ng **chips mÃ u** repo/venv/deps/ffmpeg/whisper
  (âœ“ xanh/âœ— Ä‘á») thay dÃ²ng chá»¯ muted; (b) **5 bÆ°á»›c = 5 mÃ u bÃºt** (xanh/teal/amber/há»“ng/tÃ­m) â€”
  viá»n trÃ¡i + badge sá»‘ trÃ²n mÃ u riÃªng tá»«ng group, title tÃ¡ch step-name + step-hint; (c) chi tiáº¿t:
  textarea ká»‹ch báº£n viá»n nÃ©t Ä‘á»©t, item cáº£nh teal + hover nhÃ­ch, báº£ng annotation hover amber,
  progress bar sá»c cháº¡y animation (`@keyframes wb-ink-move`), log kiá»ƒu terminal ná»n tá»‘i vá»›i mÃ u
  tá»± Ä‘á»™ng theo tiá»n tá»‘ âœ“/âŒ/âš , nÃºt Xuáº¥t MP4 gradient tÃ­m. **Há»£p Ä‘á»“ng ID giá»¯ nguyÃªn tuyá»‡t Ä‘á»‘i**
  (37/37 `#wb-*` khá»›p bind() â€” kiá»ƒm báº±ng script tmp Ä‘Ã£ dá»n); khÃ´ng Ä‘á»¥ng IPC/main/preload
  (`check:ipc` khÃ´ng Ä‘á»•i). Kiá»ƒm Ä‘á»‹nh: node --check OK, `npm run check` PASS.
- [2026-09-06] **Whiteboard Studio: fix `pyPrepare` spawn python ENOENT** (`nova/whiteboard-studio/py-backend.js`,
  README.md). Triá»‡u chá»©ng: báº¥m âš™ Chuáº©n bá»‹ Python (sau khi ðŸ§  CÃ i Whisper Ä‘Ã£ xong) â†’
  `prepare_env.py tháº¥t báº¡i: spawn python ENOENT` â€” process Electron khÃ´ng resolvable `python.exe`
  qua PATH dÃ¹ shell tháº¥y. Gá»‘c rá»…: `prepare()` luÃ´n spawn python há»‡ thá»‘ng cháº¡y `prepare_env.py`
  ká»ƒ cáº£ khi `.venv` Ä‘Ã£ tá»“n táº¡i. Fix 2 táº§ng: (a) fast-path â€” venv cÃ³ sáºµn thÃ¬ chá»‰ `status()` Ä‘á»‘i
  chiáº¿u, khÃ´ng spawn python há»‡ thá»‘ng; (b) khi pháº£i dá»±ng venv tháº­t â€” dÃ² interpreter khai bÃ¡o
  `NOVA_WB_PYTHON` â†’ `python` â†’ `py -3` â†’ `python3` (cache `_sysPy`, log tá»«ng láº§n thá»­), thiáº¿u
  háº¿t thÃ¬ fail lá»™ liá»…u `WB_PY_NOT_FOUND` kÃ¨m hÆ°á»›ng dáº«n (Luáº­t 10). Kiá»ƒm Ä‘á»‹nh: node --check OK,
  `prepare()` PASS cáº£ PATH thÆ°á»ng láº«n PATH rá»—ng (mÃ´ phá»ng Electron), `npm run check` PASS
  (147 kÃªnh IPC giá»¯ nguyÃªn).
- [2026-09-06] **NghiÃªn cá»©u NgÃ¡ch (tool ðŸ”Ž toolniche): sá»­a 5 Ä‘iá»ƒm yáº¿u + song song hoÃ¡ + handoff/copy**
  (`nova/editor-pro/niche/loi.js`, `thi-truong.js`, `kenh.js`, `nova/web/index.html`; KHÃ”NG Ä‘á»•i
  kÃªnh IPC, KHÃ”NG Ä‘á»•i module.exports â€” `ipc-niche.js`/`register.js`/preload khÃ´ng Ä‘á»¥ng).
  (1) **Luáº­t 10 â€” háº¿t nuá»‘t lá»—i**: `hotTopics` vÃ  `similarChannels` gom lá»—i tá»«ng gÃ³c quÃ©t
  yt-dlp vÃ o `failedQueries` (UI bÃ¡o "x/y gÃ³c lá»—i"); `channelScorecard` tráº£ `analysisError`
  khi Claude há»ng thay vÃ¬ Ä‘á»ƒ Ã´ phÃ¢n tÃ­ch trá»‘ng láº·ng láº½; á»©ng viÃªn kÃªnh há»ng cÃ³ `partialError`.
  (2) **Cache**: key scorecard gá»™p `count` + cá» `analyze` (soi 20 video rá»“i Ä‘á»•i 30 khÃ´ng Äƒn
  nháº§m cache cÅ©); Ä‘Ä©a náº¡p 1 láº§n giá»¯ Ä‘á»“ng bá»™ qua `cacheSave` (khÃ´ng Ä‘á»c cáº£ file má»—i miss);
  prune entry háº¿t háº¡n + tráº§n 200 entry khi save â€” `~/.nova/niche-cache.json` khÃ´ng phÃ¬nh.
  (3) **TÄƒng tá»‘c**: thÃªm helper `pool(items, concurrency, fn)` trong `loi.js` (xuáº¥t qua
  module.exports, chá»‰ thÃªm tÃªn â€” giá»¯ nguyÃªn tÃªn cÅ©); quÃ©t 4 gÃ³c hot vÃ  cháº¥m candidates
  similar cháº¡y 2 luá»“ng â†’ nhanh ~2x.
  (4) **Renderer**: nÃºt ðŸ“‹ copy káº¿t quáº£ gáº§n nháº¥t ra clipboard dáº¡ng Markdown (5 Ã´, dÃ¹ng
  `_nfLast` + `navigator.clipboard` + fallback execCommand â€” khÃ´ng thÃªm IPC); nÃºt ðŸŽ¬
  "LÃ m video nÃ y" trÃªn card Chá»§ Ä‘á» Hot / Ã½ tÆ°á»Ÿng Attention / tiÃªu Ä‘á» thay tháº¿ B&W â€”
  Ä‘áº©y chá»§ Ä‘á» vÃ o `tsTopic` rá»“i `switchTool('toolscript')` (Workflow D: research â†’ production).
  Registry `_nfIdeas` + index truyá»n vÃ o onclick Ä‘á»ƒ trÃ¡nh vá»¡ chuá»—i vá»›i tiÃªu Ä‘á» cÃ³ kÃ½ tá»± láº¡.
  Kiá»ƒm Ä‘á»‹nh: `node --check` 3 file niche OK; `npm run check` PASS (ipc/shared khÃ´ng Ä‘á»•i).
- [2026-09-06] **NghiÃªn cá»©u NgÃ¡ch: Ã´ má»›i "âš¡ Äá»™t phÃ¡ view"** â€” video/kÃªnh nÃ o Ä‘ang nháº£y view
  máº¡nh nháº¥t. TÃ­nh nÄƒng Má»šI theo yÃªu cáº§u user ("trend 24h qua video/kÃªnh nÃ o nháº£y view cao nháº¥t").
  Core: yt-dlp chá»‰ tráº£ view táº¡i thá»i Ä‘iá»ƒm quÃ©t â†’ Ä‘o báº±ng **2 áº¢NH CHá»¤P**: má»—i láº§n quÃ©t lÆ°u
  snapshot view tá»«ng video vÃ o `~/.nova/niche-snapshots.json` (tráº§n 20 ngÃ¡ch), láº§n sau so
  diff â†’ leaderboard video (delta + %) vÃ  gom theo kÃªnh (`KÃŠNH ÄANG BÃ™NG`); cá»­a sá»• = khoáº£ng
  cÃ¡ch 2 láº§n quÃ©t, hiá»ƒn thá»‹ trung thá»±c "cÃ¡ch Ä‘Ã¢y Xh" (khÃ´ng cá»‘ Ä‘á»‹nh 24h vÃ¬ YouTube khÃ´ng cho
  lá»‹ch sá»­ view miá»…n phÃ­). Báº¯t video má»›i qua truy váº¥n sáº¯p theo NGÃ€Y ÄÄ‚NG â€” **phÃ¡t hiá»‡n:
  yt-dlp â‰¥2024 Ä‘Ã£ XOÃ prefix `ytsearchdate`** (lá»—i "Unsupported url scheme") â†’ dÃ¹ng URL
  `/results?search_query=â€¦&sp=CAI%3D` (filter sort-by-upload-date cá»§a chÃ­nh YouTube) +
  `--playlist-end N`; `searchVideos` thÃªm tham sá»‘ `opts.sort` (tiá»‡n cho module sau tÃ¡i dÃ¹ng).
  File má»›i `nova/editor-pro/niche/do-pha.js` (`viewSpikes`); lá»—i tá»«ng gÃ³c vÃ o `failedQueries`
  (Luáº­t 10); AI phÃ¢n tÃ­ch tÃ¹y chá»n cÃ³ `analysisError`. Báº£o vá»‡ má»‘c: báº¥m 2 láº§n <30 phÃºt khÃ´ng
  ghi Ä‘Ã¨ má»‘c cÅ© (`baselineKept`). **CÃ³ 1 kÃªnh IPC má»›i `nova:niche:spike`** â€” cáº­p nháº­t Ä‘á»“ng bá»™
  `ipc-niche.js` + `preload.js` + `nova/ipc-inventory.json` (147â†’148, sinh láº¡i bá»Ÿi `check:ipc`);
  export `niche/index.js` chá»‰ THÃŠM tÃªn `viewSpikes`. UI: tile/panel 6th (`nf-panel-spike`),
  khÃ´ng cache (má»—i láº§n báº¥m = 1 phÃ©p Ä‘o má»›i), cÃ³ ðŸ“‹ copy + ðŸŽ¬ "LÃ m video nÃ y"; `.nf-grid` Ä‘á»•i
  tá»« `repeat(4,1fr)` cá»©ng sang `auto-fit minmax(200px,1fr)` Ä‘á»ƒ 5-6 tile tá»± xuá»‘ng dÃ²ng Ä‘áº¹p.
  Kiá»ƒm Ä‘á»‹nh: test tÃ­ch há»£p live 2 láº§n quÃ©t (giáº£ láº­p má»‘c cÅ© 3h, -3000 view/video) â†’ delta
  +3.0K/video, kÃªnh +15.0K = 5 video, overlap 21/26, báº¯t Ä‘Ãºng 1 video má»›i xuáº¥t hiá»‡n;
  syntax-check 7 script inline index.html PASS; `npm run check` PASS (353 files, 148 IPC).
- [2026-09-06] **Äá»™t phÃ¡ view: + "ðŸš€ Bá»©c tá»‘c theo má»‘c YouTube"** â€” user há»i sao khÃ´ng dÃ¹ng má»‘c
  cá»§a YouTube ("video x256â€¦"). Giáº£i trÃ¬nh: xN lÃ  bá»™i sá»‘ view tÃ­ch luá»¹ Cáº¢ Äá»œI, khÃ´ng cÃ³ chiá»u
  thá»i gian; YouTube miá»…n phÃ­ chá»‰ cho 2 má»‘c: NGÃ€Y ÄÄ‚NG (chÃ­nh xÃ¡c tá»›i ngÃ y) + view lÃ m trÃ²n.
  Bá»• sung: bá»©c tá»‘c = view/sá»‘ ngÃ y tuá»•i, video â‰¤ 7 ngÃ y (â‰¥ 500 view) xáº¿p theo vel, xN so vá»›i
  trung vá»‹ vel video â‰¥ 14 ngÃ y (`medVel`, cáº§n â‰¥ 3 video cÅ©) â†’ biáº¿t video nÃ o Ä‘ang bÃ¹ng NGAY
  tá»« Láº¦N QUÃ‰T Äáº¦U, khÃ´ng cáº§n 2 áº£nh chá»¥p. `do-pha.js` thÃªm `rockets` + `medVel` (additive),
  import `median` tá»« loi; rockets cÅ©ng vÃ o prompt Claude; renderer thÃªm báº£ng + nÃºt ðŸŽ¬;
  Markdown copy thÃªm dÃ²ng ðŸš€. Giá»›i háº¡n Ä‘Ã£ khai bÃ¡o trong code: video < 1 ngÃ y tuá»•i bá»‹ Æ°á»›c
  lÆ°á»£ng vel tháº¥p (upload_date chá»‰ tá»›i NGÃ€Y). Test live: ngÃ¡ch "truyá»‡n ma" â†’ 3 rockets,
  top 42.7K/ngÃ y = x48.5 (medVel 880/ngÃ y) Â· `npm run check` PASS (exit 0).
- [2026-09-06] **NghiÃªn cá»©u NgÃ¡ch: nÃ¢ng "ðŸ‘¥ KÃªnh giá»‘ng" thÃ nh Ã´ riÃªng** â€” user bÃ¡o UI chá»‰ tháº¥y 5
  cÃ´ng nÄƒng. ÄÃºng: "KÃªnh giá»‘ng" (cÃ´ng nÄƒng 6, IPC `nova:niche:similar`) bá»‹ chÃ´n lÃ m hÃ ng áº©n
  trong panel Tháº» Ä‘iá»ƒm kÃªnh (chá»‰ hiá»‡n sau khi soi kÃªnh). Fix renderer-only (khÃ´ng Ä‘á»¥ng
  IPC/preload/main): thÃªm tile `nf-tile-similar` + panel `nf-panel-similar` cÃ³ Ã´ nháº­p riÃªng
  `nfSimSeed` + â†» (fresh) + ðŸ“‹; xoÃ¡ hÃ m Ä‘áº·c biá»‡t `nfRunSimilar` + hÃ ng `nfSimRow`, thay báº±ng
  entry `NF_MAP.similar` (key 'channel') â†’ cháº¡y qua cÆ¡ cháº¿ chung `nfRun` (progress/copy/
  `_nfLast`/disable nÃºt tá»± lo), render tÃ¡ch thÃ nh `nfRenderSimilar`; soi kÃªnh xong tá»± Ä‘iá»n
  kÃªnh vÃ o `nfSimSeed` (khÃ´ng Ä‘Ã¨ náº¿u ngÆ°á»i dÃ¹ng Ä‘ang nháº­p kÃªnh khÃ¡c). Giá» UI Ä‘á»§ 6 tile/6
  panel = 6 cÃ´ng nÄƒng. Kiá»ƒm Ä‘á»‹nh: 0 tham chiáº¿u cÅ© cÃ²n láº¡i; 6 tile/6 panel; syntax 7 script
  inline PASS; `npm run check` PASS (360 files, 148 IPC).

- [2026-09-06] **Whiteboard Studio: +3 tÃ­nh nÄƒng tá»« báº£n app Ä‘á»™c láº­p (voiceâ†’SRT, nháº¡c ná»n, timeline tá»« ká»‹ch báº£n dÃ¡n)**
  (`nova/whiteboard-studio/voice_to_srt.py` má»›i; `py-backend.js`, `ipc.js`, `nova/preload.js`,
  `nova/web/whiteboard-studio-panel.js`, `index.html` CSS, README). Quyáº¿t Ä‘á»‹nh: tÃ­ch há»£p vÃ o
  ðŸ–Š Whiteboard Studio (khÃ´ng pháº£i âœï¸ Váº½ Tay áº¢nh â€” giá»¯ ranh giá»›i module theo AGENTS.md Â§2).
  (1) **Voice â†’ SRT local**: kÃªnh má»›i `whiteboard:generateSrt` + `whiteboard:whisperPrepare`
  â€” cháº¡y `voice_to_srt.py` (script Cá»¦A NOVA, Ä‘áº·t cáº¡nh `render-progress-bridge.py`, khÃ´ng cháº¡m
  repo vendored) báº±ng venv python; faster-whisper CPU int8, `language="vi"`, VAD, beam 5.
  ÄÃ£ `pip install faster-whisper` 1.2.1 vÃ o `.venv` cÃ³ sáºµn; model Whisper láº§n cháº¡y Ä‘áº§u tá»± táº£i
  (~vÃ i trÄƒm MB, cache local). `status()` giá» tráº£ thÃªm `whisper` (cache trong process).
  (2) **Nháº¡c ná»n**: `whiteboard:pickMusic` + `musicTrack` trong payload export; mux ffmpeg
  `-stream_loop -1` + `amix` (voice 1.0 / nháº¡c 0.16 máº·c Ä‘á»‹nh, select 0.10â€“0.40) â€” cÃ´ng thá»©c cá»§a
  app Ä‘á»™c láº­p; chá»‰-music cÅ©ng Ã¡p volume. `muxAudio` Ä‘á»•i chá»¯ kÃ½
  `(video, voice, music, out, onLog, opts)` â€” chá»‰ dÃ¹ng ná»™i bá»™ py-backend.
  (3) **Timeline tá»« ká»‹ch báº£n dÃ¡n**: thuáº§n renderer â€” chia Ä‘oáº¡n theo dÃ²ng trá»‘ng, Æ°á»›c lÆ°á»£ng
  thá»i lÆ°á»£ng ~2.5 tá»«/s káº¹p 2.5â€“20s (deterministic), khÃ´ng cáº§n SRT.
  Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS (147 kÃªnh IPC, 3 kÃªnh má»›i cÃ³ trong inventory), node --check
  + py_compile OK, logic chia cáº£nh/annotation test node PASS.
- [2026-09-06] **Äá»“ng bá»™ QUY MÃ” form "Sáº£n xuáº¥t video tá»± Ä‘á»™ng" (Dashboard) vá»›i tab Táº¡o Ká»‹ch Báº£n**
  (`nova/web/index.html`, renderer-only): form trÆ°á»›c cÃ³ 1 Ã´ "Sá»‘ lÆ°á»£ng tá»«" (default 800, Æ°á»›c lÆ°á»£ng
  150 wpm) lá»‡ch vá»›i khá»‘i QUY MÃ” tháº­t cá»§a tab. Giá» Dashboard dÃ¹ng **ChÆ°Æ¡ng Ã— Tá»«/chÆ°Æ¡ng Ã— NgÃ´n ngá»¯**
  (default 1 / 1200, Æ°á»›c lÆ°á»£ng 140 wpm "Tá»•ng dá»± tÃ­nh ~X phÃºt Â· â‰ˆ Y phÃºt/chÆ°Æ¡ng" â€” cÃ¹ng cÃ´ng thá»©c
  tsUpdateScale). Danh sÃ¡ch 27 ngÃ´n ngá»¯ clone tá»« `tsLang` lÃºc render (má»™t nguá»“n, khÃ´ng nhÃ¢n Ä‘Ã´i);
  giÃ¡ trá»‹ mirror tab. `queueAdd` lÆ°u `job.chapters/wpc/lang`, `words = ch Ã— wpc`. BÆ°á»›c pipeline
  `script`: set `tsChapters/tsWordsPerChapter/tsLang` rá»“i gá»i `tsUpdateScale()` â†’ tá»± ghi `tsWords`
  VÃ€ tá»± báº­t Cháº¿ Ä‘á»™ Novel khi â‰¥2 chÆ°Æ¡ng (Ä‘Ãºng hÃ nh vi chá»‰nh tay trÃªn tab); job cÅ© chá»‰ cÃ³ `words`
  giá»¯ Ä‘Æ°á»ng cÅ©. `dashToggleStart` áº©n cáº£ khá»‘i QUY MÃ” khi startFrom='scenes'. Kiá»ƒm Ä‘á»‹nh: render
  test PASS (thiáº¿u QUY MÃ” = FAIL, sÃ³t Ã´ cÅ© = FAIL), 7/7 inline script há»£p cÃº phÃ¡p, `npm run check`
  PASS. GUI smoke `npm start` khÃ´ng cháº¡y Ä‘Æ°á»£c (single-instance guard cháº·n vÃ¬ app Ä‘ang má»Ÿ) â€”
  cáº§n restart app tháº­t Ä‘á»ƒ soi báº±ng máº¯t.
- [2026-09-06] **Dashboard (`nova/web/index.html`) sá»­a láº¡i cho khá»›p app hiá»‡n táº¡i** â€” renderer-only,
  khÃ´ng Ä‘á»¥ng IPC/main/preload (`check:ipc` khÃ´ng Ä‘á»•i). CÃ¡c thay Ä‘á»•i:
  (a) bá» lá»i chÃ o Ä‘á»c `#userName` (element Ä‘Ã£ xoÃ¡ cÃ¹ng há»‡ Ä‘Äƒng nháº­p) â†’ header "Trung tÃ¢m sáº£n
  xuáº¥t video" + phá»¥ Ä‘á» pháº£n Ã¡nh pipeline & "Pro/Max má»Ÿ khoÃ¡ sáºµn";
  (b) `_dashStats` thÃªm chá»‰ sá»‘ "Trong hÃ ng Ä‘á»£i" (6 tháº» thá»‘ng kÃª);
  (c) `_dashWorkflow` cáº­p nháº­t 7 bÆ°á»›c Ä‘Ãºng tool tháº­t hiá»‡n táº¡i (thÃªm Giá»ng Ä‘á»c = t7State.audioFile,
  Dá»±ng video = t7State.clips; Prompt nhÃ¢n váº­t Ä‘Ã£ gá»™p vÃ o PhÃ¢n Cáº£nh), má»—i bÆ°á»›c gáº¯n `tool` Ä‘á»ƒ nÃºt
  "Tiáº¿p tá»¥c bÆ°á»›c nÃ y" nháº£y Ä‘Ãºng chá»—;
  (d) khÃ´i phá»¥c 3 khá»‘i vá»‘n lÃ  code cháº¿t (CSS + biáº¿n cÃ³ sáºµn nhÆ°ng khÃ´ng render): "Truy cáº­p nhanh"
  (.dqa/qa(), 15 tool hiá»‡n táº¡i ká»ƒ cáº£ Video Agent/Whiteboard/Váº½ Tay/I-MZic/Studio TDT),
  "Tiáº¿n Ä‘á»™ video hiá»‡n táº¡i" (.dstep/stepHtml), "KÃªnh cá»§a báº¡n" (.dproj/projs);
  (e) xoÃ¡ 3 nhÃ¡nh gate tier cháº¿t (queueAdd + runQueue) â€” canAutoRun() luÃ´n true,
  getMaxQueue() Infinity, message "gÃ³i SÃ¡ng táº¡oâ€¦" lá»—i thá»i vÃ¬ tier Ä‘Ã£ gá»¡.
  TDZ Ä‘Ã£ kiá»ƒm chá»©ng: renderDashboard chá»‰ gá»i sau khi toÃ n bá»™ script eval (DOMContentLoaded/event),
  `typeof`-guard cho t7State/_prodQueue an toÃ n. Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS (syntax 342
  file, IPC 144 kÃªnh, parity 0, shared 28 file/16 state key);
  `nova/scripts/tmp-dashboard-check.js` â€” 7/7 khá»‘i <script> inline há»£p cÃº phÃ¡p;
  `nova/scripts/tmp-dashboard-render-test.js` â€” render vá»›i stub: 15 quick action, 7 bÆ°á»›c
  stepper, 6 tháº» thá»‘ng kÃª, Ä‘á»§ cÃ¡c section. Nháº­n xÃ©t: check:syntax chÆ°a phá»§ inline script trong
  .html â€” hai tmp script trÃªn giá»¯ lÃ m cÃ¡ch kiá»ƒm tra nhanh khi sá»­a renderer lá»›n.
- [2026-09-06] **Agent Bridge cho AI agent ngoÃ i (Zisu_AI) â€” tÃ­nh "Ä‘iá»u khiá»ƒn app
  tá»« ngoÃ i"**: thÃªm `nova/main/agent-bridge.js` (má»›i) + gáº¯n route
  `POST /agent/command` vÃ o local server sáºµn cÃ³ trong `server.js` (127.0.0.1,
  port 47280-47283 â€” khÃ´ng má»Ÿ cá»•ng má»›i, khÃ´ng thÃªm IPC/renderer â†’ inventory IPC
  vÃ  preload khÃ´ng Ä‘á»•i, `check:shared`/`check:ipc` PASS). Bridge lÃ  Ä‘iá»ƒm vÃ o
  HTTP kiá»ƒu `{action, params}` â†’ `{ok, data|error{code,message}}`, lá»—i lá»™ liá»…u
  theo Luáº­t 10 (`AVS_AGENT_*`: METHOD_NOT_ALLOWED, BODY_TOO_LARGE, BAD_JSON,
  NO_ACTION, UNKNOWN_ACTION, NO_WINDOW). Action: `ping`, `status`, `focus`.
  Äá»‘i tÃ¡c tiÃªu thá»¥: repo `D:\Zisu_AI` (fork Tuan3d/Zisu_AI) vá»›i skill má»›i
  `ai_video_studio` (regex L2) + `core/ai_video_studio_helper.py` (probe port
  47280-47283, dÃ¹ng urllib stdlib) + gáº¯n `core/executor.py`, router Ä‘Ã£ train láº¡i
  (56 máº«u), regression `python -m eval.run_eval` 5/5 PASS. Kiá»ƒm Ä‘á»‹nh:
  `nova/scripts/tmp-agent-bridge-test.js` 7/7 PASS (cháº¡y node thÆ°á»ng, khÃ´ng
  Electron); e2e `tmp-agent-bridge-e2e.js` + `D:\Zisu_AI\tmp-e2e.py`: lá»‡nh tiáº¿ng
  Viá»‡t "kiá»ƒm tra ai video studio cÃ³ Ä‘ang cháº¡y khÃ´ng" â†’ status SUCCESS,
  "hiá»‡n ai video studio lÃªn" â†’ lá»—i lá»™ liá»…u AVS_AGENT_NO_WINDOW khi chÆ°a cÃ³
  cá»­a sá»• (Ä‘Ãºng chá»§ Ä‘Ã­ch ngoÃ i Electron). LÆ°u Ã½ runtime: khi probe bridge tá»«
  process khÃ¡c, KHÃ”NG dÃ¹ng `spawnSync` á»Ÿ node giá»¯ server (cháº·n event loop â†’
  deadlock) â€” pháº£i dÃ¹ng `spawn` async.
- [2026-09-06] **Nghiá»‡m thu GUI THáº¬T hoÃ n táº¥t**: cháº¡y `npm start` tháº­t (splash â†’
  cá»­a sá»• chÃ­nh, port 47280), pipeline Zisu `python tmp-e2e.py` cho káº¿t quáº£
  2/2 STEP_SUCCESS: `status` â†’ "cá»­a sá»• chÃ­nh Ä‘ang má»Ÿ, server port 47280",
  `focus` â†’ cá»­a sá»• tháº­t Ä‘Æ°á»£c hiá»‡n & focus (láº§n Ä‘áº§u `focus` cháº¡y thÃ nh cÃ´ng
  trÃªn cá»­a sá»• Electron tháº­t, khÃ´ng cÃ²n AVS_AGENT_NO_WINDOW). Táº§ng "app tá»± má»Ÿ
  cá»­a + agent ngoÃ i gá»i vÃ o" Ä‘Ã£ Ä‘Ã³ng dáº¥u nghiá»‡m thu end-to-end.


- [2026-09-05] Táº¡o Ká»‹ch Báº£n â€” **cháº¿ Ä‘á»™ Novel (chip ðŸ“–)**: port pattern quáº£n lÃ½ ngá»¯ cáº£nh
  cá»§a repo `D:\repo\ainovel-cli-main` (fork tiáº¿ng Viá»‡t cá»§a ainovel-cli, Go â€” KHÃ”NG tÃ­ch
  há»£p binary, chá»‰ mÆ°á»£n thuáº­t toÃ¡n) sang JS thuáº§n renderer, theo yÃªu cáº§u "nhá»› ngá»¯ cáº£nh /
  ná»™i dung / nhÃ¢n váº­t xuyÃªn suá»‘t ká»‹ch báº£n". ToÃ n bá»™ náº±m trong `nova/web/index.html`
  (global script, khÃ´ng import/export, khÃ´ng Ä‘á»¥ng IPC/main/preload â†’ inventory IPC
  khÃ´ng Ä‘á»•i, khÃ´ng dependency má»›i):
  (a) UI: chip toggle `tsNovelBtn` + hint giáº£i thÃ­ch; tráº¡ng thÃ¡i lÆ°u localStorage
      `ts_novel_mode`, khÃ´i phá»¥c trong `tsInit`;
  (b) `tsGenerate` ráº½ nhÃ¡nh `tsGenerateNovel()` khi chip Báº¬T â€” luá»“ng thÆ°á»ng
      (1 láº§n gá»i LLM) giá»¯ nguyÃªn 100% khi chip Táº®T;
  (c) pipeline 3 pha mÃ´ phá»ng Architectâ†’Writerâ†’Editor cá»§a ainovel-cli:
      Architect (`_tsNovelArchitect`, callLLMJson) dá»±ng story bible JSON (tiá»n Ä‘á»,
      hÆ°á»›ng káº¿t cá»¥c, 3â€“7 nhÃ¢n váº­t, 3â€“6 tuyáº¿n, káº¿ hoáº¡ch ~450 tá»«/chÆ°Æ¡ng); Writer viáº¿t
      tá»«ng chÆ°Æ¡ng vá»›i prompt kÃ¨m STORY MEMORY (`_tsNovelMemBlock`: 3 chÆ°Æ¡ng gáº§n nháº¥t
      tÃ³m táº¯t Ä‘áº§y Ä‘á»§, chÆ°Æ¡ng cÅ© nÃ©n 1 cÃ¢u â€” pattern "ngá»¯ cáº£nh phÃ¢n táº§ng nÃ©n dáº§n");
      Editor (`_tsNovelRemember`) sau má»—i chÆ°Æ¡ng trÃ­ch {summary, stateChanges
      (entity/field/from/to/reason), threads (open/advanced/resolved)} rá»“i
      `_tsNovelMerge` vÃ o memory cho chÆ°Æ¡ng sau;
  (d) Luáº­t 10: lá»—i trÃ­ch memory â†’ cáº£nh bÃ¡o status + degrade khai bÃ¡o rÃµ (dÃ¹ng 4 cÃ¢u
      Ä‘áº§u chÆ°Æ¡ng lÃ m tÃ³m táº¯t thay tháº¿, khÃ´ng nuá»‘t); output ghi dáº§n tá»«ng chÆ°Æ¡ng vÃ o
      tsOutput nÃªn lá»—i giá»¯a chá»«ng khÃ´ng máº¥t pháº§n Ä‘Ã£ viáº¿t.
  Kiá»ƒm Ä‘á»‹nh: node --check 6/6 inline script block PASS (`scripts/tmp-check-index-html-js.js`);
  `npm run check` PASS (328 file, 143 kÃªnh IPC); smoke logic `scripts/tmp-smoke-novel.js`
  PASS (mock LLM: 2 chÆ°Æ¡ng viáº¿t, 1 architect + 1 remember, prompt chÆ°Æ¡ng 2 chá»©a Ä‘á»§
  summary + stateChange `location=nhÃ  kho` + tuyáº¿n T1); `npm start` boot 35s sáº¡ch
  (bridge 8793â€“8796 lÃªn, khÃ´ng stderr). CÃ²n treo: chÆ°a cÃ³ nÃºt "tiáº¿p tá»¥c viáº¿t thÃªm
  chÆ°Æ¡ng" (memory chá»‰ sá»‘ng trong 1 láº§n generate, khÃ´ng persist sang job sau).
- [2026-09-05] Handdraw/Whiteboard â€” **dá»n rÃ¡c khi lá»—i/huá»· export** (tiáº¿p ná»‘i hdlasso6):
  phÃ¡t hiá»‡n qua cÃ¢u há»i audit "cÃ³ xoÃ¡ rÃ¡c khi tiáº¿n trÃ¬nh lá»—i/huá»·?". TrÆ°á»›c Ä‘Ã¢y chá»‰ cÃ³
  `finally` xoÃ¡ workdir `wb-stream-*` sau 5s nhÆ°ng `catch(_){}` nuá»‘t lá»—i xoÃ¡ (Windows
  giá»¯ handle â†’ orphan vÄ©nh viá»…n), app thoÃ¡t trÆ°á»›c 5s â†’ orphan, vÃ  KHÃ”NG cÃ³ sweep â€”
  báº±ng chá»©ng 31 dir rÃ¡c + 14 mp4 smoke náº±m trong %TEMP%. ÄÃ£ vÃ¡ trong
  `whiteboard-studio/py-backend.js` (há»£p Ä‘á»“ng `module.exports` giá»¯ nguyÃªn, chá»‰ thÃªm
  `sweepStale`):
  (a) `removeDirWithRetry()`: xoÃ¡ workdir NGAY trÃªn má»i Ä‘Æ°á»ng thoÃ¡t (ok/lá»—i/huá»·/
  timed-out), Windows cÃ²n giá»¯ handle thÃ¬ retry 5sâ†’15s, háº¿t lÆ°á»£t thÃ¬ say('âš â€¦') lá»™
  liá»…u (Luáº­t 10 Ã¡p dá»¥ng cho rÃ¡c);
  (b) helper `fail()` trong exportVideo: má»i return lá»—i giá» xoÃ¡ **file bÃ¡n pháº§n táº¡i
  outputPath ngÆ°á»i dÃ¹ng** (Desktop) náº¿u export nÃ y vá»«a ghi ra Ä‘Ã³ (merge ghi tháº³ng
  Ä‘Ã­ch khi khÃ´ng audio / mux ghi tháº³ng Ä‘Ã­ch) â€” trÆ°á»›c Ä‘Ã¢y Ä‘á»ƒ láº¡i file há»ng trÃªn mÃ¡y
  user; cá» `wroteOutput` Ä‘áº·t táº¡i 3 Ä‘iá»ƒm ghi Ä‘Ã­ch; LÆ¯U Ã TDZ: fail/say pháº£i Ä‘á»‹nh
  nghÄ©a TRÆ¯á»šC lá»‡nh `await status()` Ä‘áº§u hÃ m;
  (c) `sweepStale()` gá»i tá»« `status()` (panel má»Ÿ tool), guard 1 láº§n/giá»: xoÃ¡
  `wb-stream-*` >1h, `wb-studio-preview-*` + `hd-smoke-*` >24h trong os.tmpdir();
  `status()` tráº£ thÃªm `swept`.
  Kiá»ƒm Ä‘á»‹nh: tmp-test-cleanup.js PASS (sweep 24/31 dir má»“ cÃ´i tháº­t; huá»· giá»¯a render:
  kill 1 con python, tráº£ lá»—i, khÃ´ng partial file, 0 dir rÃ¡c má»›i â€” test Ä‘Ã£ xoÃ¡);
  `node --check`; `_smoke_handdraw.js` PASS (0.56MB hand + 0.29MB pen); `npm run
  check` PASS (324 file, 135 kÃªnh IPC).
- [2026-09-05] Khá»Ÿi táº¡o bá»™ tÃ i liá»‡u chuáº©n cho AI agent (AGENTS.md, CLAUDE.md,
  MEMORY.md) â€” há»c pattern AGENTS/CLAUDE/MEMORY cá»§a repo AI-Novel, ná»™i dung viáº¿t
  láº¡i 100% theo thá»±c táº¿ AI Video Studio. Má»¥c Ä‘Ã­ch: má»i agent/dev sá»­a code theo
  cÃ¹ng quy chuáº©n, khÃ´ng phÃ¡ há»£p Ä‘á»“ng há»‡ thá»‘ng.
- [2026-09-05] Chuáº©n hoÃ¡ "1 nguá»“n rule": AGENTS.md lÃ  nguá»“n duy nháº¥t; CLAUDE.md
  vÃ  .clinerules giáº£m thÃ nh pointer; thÃªm pointer cho Copilot
  (.github/copilot-instructions.md), Gemini CLI (GEMINI.md), Cursor
  (.cursor/rules/ai-video-studio.mdc). CÆ¡ cháº¿ ghi rÃµ táº¡i AGENTS.md Â§9 â€” cáº¥m
  nhÃ¢n báº£n quy chuáº©n vÃ o pointer.
- [2026-09-05] Handdraw Studio â€” hiá»‡n tÆ°á»£ng "thanh tiáº¿n trÃ¬nh káº¹t 5%": phÃ¢n tÃ­ch
  hiá»‡n trÆ°á»ng cho tháº¥y **video ÄÃƒ xuáº¥t thÃ nh cÃ´ng** (`Desktop\handdraw_animation.mp4`
  1.26MB, 15:05:18; khÃ´ng process python/ff nÃ o treo, workdir táº¡m Ä‘Ã£ dá»n) â€” lá»—i chá»‰
  cÃ²n á»Ÿ phÃ­a renderer khÃ´ng hiá»ƒn thá»‹ tráº¡ng thÃ¡i cuá»‘i. ÄÃ£ cá»©ng hoÃ¡ 3 lá»›p:
  (a) panel `hdlasso6`: bá»c try/catch TOÃ€N Bá»˜ Ä‘oáº¡n sau `await export` (ráº¥t cÃ³ thá»ƒ
  exception cháº¿t tháº§m á»Ÿ Ä‘Ã¢y giá»¯ bar káº¹t giá»¯a chá»«ng â€” Luáº­t 10), xá»­ lÃ½ káº¿t quáº£
  báº¥t thÆ°á»ng (`r` undefined/non-object), watchdog 60s khÃ´ng-event thÃ¬ log cáº£nh bÃ¡o
  lá»™ liá»…u, listener `onExportProgress` bá»c try/catch;
  (b) `whiteboard-studio/ipc.js`: sau khi PyBackend settle, relay káº¿t quáº£ qua
  KÃŠNH EVENT (`percent:100 status:'done'` / `status:'error â€¦'`) â€” náº¿u reply
  invoke bá»‹ láº¡c, renderer váº«n nháº­n tráº¡ng thÃ¡i cuá»‘i; Ä‘á»“ng thá»i console.log
  `[whiteboard:export] OK/FAIL` á»Ÿ main Ä‘á»ƒ cháº©n Ä‘oÃ¡n qua terminal `npm start`;
  (c) marker phiÃªn báº£n `[hdlasso6]` + `?v=hdlasso6` trong index.html.
  Kiá»ƒm Ä‘á»‹nh PASS: check, _check_hd_ids, _smoke_handdraw (0.56MB hand + 0.29MB pen).
  BÃ i há»c encoding: **Cáº¤M dÃ¹ng PowerShell `Get-Content -Raw`/`Set-Content` cho
  file UTF-8 chá»©a tiáº¿ng Viá»‡t** (PS5.1 Ä‘á»c khÃ´ng-BOM file thÃ nh CP1252 â†’ mojibake
  toÃ n file khi ghi láº¡i; Ä‘Ã£ Ä‘áº£o ngÆ°á»£c cÆ¡ há»c báº±ng node script CP1252 vÃ  phá»¥c há»“i
  panel.js + index.html). Tá»« nay má»i bump version marker/sá»­a file UTF-8 pháº£i dÃ¹ng
  editor tool hoáº·c node script (fs.readFileSync/`'utf8'`/writeFileSync).
- [2026-09-05] Handdraw Studio â€” 5 feedback item Ä‘Ã£ xong: (1) multi-lasso region
  point-in-polygon (pvPointInRegion, Shift+kÃ©p vÃ¹ng má»›i Ä‘Ã¨ vÃ¹ng cÅ©, chuá»™t pháº£i
  xoÃ¡ theo polygon); (2) chia giá» 8:2 chuáº©n + nÃºt "â†» PhÃ¢n láº¡i giá» 2/8"; (3) AI
  vision khoanh vÃ¹ng (hdImageDataUrl â†’ callLLMJson vá»›i image part, toáº¡ Ä‘á»™ 0â€“1000
  â†’ pixel); (4) tÃ¡ch card "BÆ°á»›c 3 Â· Máº«u bÃºt váº½ & bÃ n tay" (tip/ink/fill thumbnail
  canvas) khá»i "BÆ°á»›c 4 Â· Xuáº¥t MP4"; (5) export hardening. BÃ i há»c Ráº¤T QUAN TRá»ŒNG:
  - **Bug "Xuáº¥t MP4 cháº¿t tháº§m"**: panel gá»i `pickOutput({ defaultName })` (object)
    trong khi preload.js chá»¯ kÃ½ lÃ  `pickOutput(defaultName: string)` â†’ main nháº­n
    `p.defaultName` = object â†’ Electron `showSaveDialog` nÃ©m "Default path must
    be a string" vÃ  handler cÅ© KHÃ”NG try/catch â†’ promise reject tháº§m, thanh tiáº¿n
    trÃ¬nh khÃ´ng cháº¡y. ÄÃ£ sá»­a cáº£ 2 phÃ­a (panel truyá»n chuá»—i; ipc.js cÆ°á»¡ng cháº¿ kiá»ƒu
    + try/catch tráº£ `{ok:false,error}`) vÃ  panel hiá»ƒn thá»‹ lá»—i pickOutput ra Log box.
  - Smoke test mock `window.native` pháº£i nhÃ¢n báº£n **chá»¯ kÃ½ tá»«ng hÃ m cá»§a preload
    tháº­t** (khÃ´ng pháº£i chá»‰ kÃªnh IPC) â€” náº¿u khÃ´ng sáº½ khÃ´ng báº¯t Ä‘Æ°á»£c lá»‡ch contract
    kiá»ƒu nÃ y. `web/_smoke_handdraw.js` giá» mÃ´ phá»ng cáº£ validation Electron
    (defaultPath pháº£i string) + bÆ°á»›c [4b] assert contract; `web/_check_hd_ids.js`
    assert SHELL_HTML â†” bind() â†” els.*.
  - `nova/main/server.js` giá» gá»­i `Cache-Control: no-cache` cho static file â€”
    renderer khÃ´ng bao giá» cháº¡y JS cÅ© sau khi dev sá»­a (gá»‘c rá»… 2 láº§n "panel cháº¿t
    vÃ¬ cache"). Marker phiÃªn báº£n trong Log: dÃ²ng Ä‘áº§u `[hdlasso5] panel Váº½ Tay áº¢nh
    Ä‘Ã£ khá»Ÿi Ä‘á»™ng`. App Ä‘Ã³ng gÃ³i trong `dist/` build 9/4 KHÃ”NG cÃ³ tool handdraw â€”
    user pháº£i cháº¡y dev tá»« `nova/`, khÃ´ng cháº¡y exe trong dist.
  - Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS; `npm run test:whiteboard` PASS;
    `node nova/web/_smoke_handdraw.js` PASS (export MP4 tháº­t 0.56MB hand +
    0.29MB pen).
- [2026-09-05] Voice Studio â€” tÃ­nh nÄƒng **cao Ä‘á»™ (pitch)** triá»ƒn khai á»Ÿ Táº¦NG
  BACKEND: `TTSBody.pitch` (ná»­a cung, -12..+12, máº·c Ä‘á»‹nh 0) +
  `audio_utils.pitch_shift_wav()` (ffmpeg `asetrateâ†’aresampleâ†’atempo`, giá»¯
  tempo, ghi Ä‘Ã¨ táº¡i chá»— qua `os.replace`) Ã¡p TRÆ¯á»šC `wav_duration` Ä‘á»ƒ SRT Ä‘Ãºng;
  xá»­ lÃ½ trung tÃ¢m trong `_run_tts` nÃªn cáº£ 3 engine OmniVoice/VieNeu/XTTS Ä‘á»u
  cÃ³ pitch mÃ  khÃ´ng sá»­a engine nÃ o, khÃ´ng thÃªm dependency Python. UI
  (`web/index.html`): slider Cao Ä‘á»™ (voicePitch) giá»¯a Tá»‘c Ä‘á»™ vÃ  Nghá»‰ giá»¯a cÃ¢u;
  Ä‘á»•i thá»© tá»± cá»™t pháº£i thÃ nh Backend â†’ NgÃ´n ngá»¯ â†’ Giá»ng Ä‘á»c â†’ Tá»‘c Ä‘á»™ â†’ Cao Ä‘á»™ â†’
  Nghá»‰ giá»¯a cÃ¢u; gá»­i `pitch` trong POST /api/tts; lÆ°u theo profile
  (`_VOICE_FIELDS`). Contract test má»¥c 10 chá»‘t toÃ n chuá»—i. Kiá»ƒm Ä‘á»‹nh: `npm run
  check` PASS, `test:voice` PASS, E2E qua venv-omni production PASS (tá»‰ lá»‡ táº§n
  sá»‘ +5st = 1.3352 vs lÃ½ thuyáº¿t 1.3348; -7st = 0.6673 vs 0.6674; tempo giá»¯
  nguyÃªn Â±0.02s). LÆ°u Ã½: `__pycache__` cpython-311 xuáº¥t hiá»‡n trong source lÃ 
  do backend cháº¡y tháº­t tá»« source (runtime bÃ¬nh thÆ°á»ng, Ä‘Ã£ git-ignore) â€” cháº¡y
  `test:voice` sau khi backend cháº¡y cáº§n dá»n `backend/__pycache__` +
  `backend/engines/__pycache__` trÆ°á»›c.
- [2026-09-05] Má»Ÿ rá»™ng Visual Grammar theo pattern seedance-2.0 (tá»« vá»±ng gÃ³c mÃ¡y Ä‘iá»‡n áº£nh) â€” 3 táº§ng: (1) `nova/video-agent/visual-grammar/grammar.js`: CAMERA 5â†’9 (`pan-up`/`pan-down` map `panU`/`panD`, `crane-in`, `handheld`), TRANSITIONS 7â†’18 (map 1-1 sang `transitions.json` sáºµn cÃ³: dip-white, flash-cut, zoom-through, match-zoom, push-left/up, barn-door, shutter, iris, paper-slide, grain) â€” giá»¯ nguyÃªn module.exports, ai-gateway tá»± nháº­n enum má»›i qua `Object.keys(grammar.CAMERA)`. `visual-plan/plan.js`: CAMERAS rotation 4â†’8 + TRANSITION_CYCLE deterministic (cut chá»§ Ä‘áº¡o, nháº¥n match-zoom/whip Ä‘á»‹nh ká»³); `behavior-engine/legacy.js`: pan-up/down â†’ `camera.pan` yÂ±5, crane-in â†’ `camera.push_in`. (2) Renderer: HOLD preset má»›i `handheld` (rung sin 2 trá»¥c lá»‡ch pha) + `craneIn` (scale+translateY) thÃªm Äá»’NG THá»œI á»Ÿ `nova/editor-pro/nova-remotion/src/anim.js` VÃ€ `bundle/bundle.js` (bundle lÃ  runtime, pháº£i sá»­a cáº£ hai). (3) Documentary `ai/visual-planner.js` Â§7: schema + heuristic + buildPromptFromPlan + LLM prompt thÃªm `lens`/`lighting`/`grade` (enum cá»‘ Ä‘á»‹nh, AI chá»‰ chá»n tÃªn â€” Luáº­t 8). Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS (syntax 329 file, IPC 143 kÃªnh, parity, shared); `test:video-agent` 6 suite PASS (114 pass, BRIDGE-CONTRACT HOLD=13 xÃ¡c nháº­n preset má»›i); `nova/documentary/test.js` PASS; `test:video-agent:render` REAL-RENDER-OK (2.454s). Ghi chÃº: khÃ´ng dÃ¹ng trá»±c tiáº¿p repo github seedance-2.0 (Ä‘Ã³ lÃ  prompt-skill docs, khÃ´ng pháº£i module) â€” chá»‰ port tÆ° duy vocabulary vÃ o grammar hiá»‡n cÃ³.
- [2026-09-05] Toolscript â€” sá»­a lá»‡ch giá»¯a hint vÃ  logic **Cháº¿ Ä‘á»™ Novel**
  (`nova/web/index.html`): hint cÅ© ghi "â‰ˆ450 tá»«/chÆ°Æ¡ng" nhÆ°ng logic tháº­t láº¥y sá»‘
  chÆ°Æ¡ng & sá»‘ tá»«/chÆ°Æ¡ng tá»« khá»‘i QUY MÃ” (`tsChapters` Ã— `tsWordsPerChapter`),
  khiáº¿n `TS_NOVEL_CH_WORDS=450` thÃ nh dead code (element luÃ´n tá»“n táº¡i nÃªn nhÃ¡nh
  fallback khÃ´ng bao giá» cháº¡y). Fix 3 Ä‘iá»ƒm: (1) nhÃ¡nh Novel trong `tsGenerate`
  clamp `n >= 2` â€” náº¿u QUY MÃ” Ä‘á»ƒ 1 chÆ°Æ¡ng thÃ¬ tá»± tÃ¡ch theo ~450 tá»«/chÆ°Æ¡ng giá»¯
  Ä‘Ãºng tá»•ng sá»‘ tá»« (trÆ°á»›c Ä‘Ã¢y n=1 lÃ m Architect validate `chapters.length >= 2`
  cháº¿t sau 3 tries hoáº·c LLM tá»± tráº£ 2Ã—1200=2400 tá»«, gáº¥p Ä‘Ã´i yÃªu cáº§u); (2)
  `chWords = Math.round(words/n)` thay vÃ¬ Ä‘á»c tháº³ng `tsWordsPerChapter` Ä‘á»ƒ háº¿t
  lá»‡ch tá»•ng khi user chá»n sá»‘ tá»« báº±ng chip `tsSetWords()`; (3) `tsUpdateScale`
  Ä‘á»“ng bá»™ Ä‘á»§ 3 lá»›p (class + localStorage `ts_novel_mode` + hint) khi auto
  báº­t/táº¯t chip theo QUY MÃ” â€” trÆ°á»›c Ä‘Ã¢y chá»‰ Ä‘á»•i class nÃªn phiÃªn sau `tsInit`
  khÃ´i phá»¥c sai tráº¡ng thÃ¡i. Hint UI viáº¿t láº¡i mÃ´ táº£ Ä‘Ãºng hÃ nh vi. Renderer-only,
  khÃ´ng Ä‘á»¥ng IPC/contract. Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS; node sanity test
  cÃ¡c case 1Ã—1200 / 2Ã—1200 / 5Ã—1000 / chip-3000-tá»« / 800-tá»«-1-chÆ°Æ¡ng Ä‘á»u giá»¯
  Ä‘Ãºng tá»•ng sá»‘ tá»«.

- [2026-09-05] TÃ­ch há»£p cÃ´ng cá»¥ **I-MZic** vÃ o sidebar trÃ¡i báº±ng iframe trong `nova/web/index.html`:
  - ThÃªm nav item `toolimzic` (label: I-MZic), thÃªm section `<div class="tool" id="tool-toolimzic">` vá»›i `<iframe id="imzicFrame" data-src="img-to-vid.html">`.
  - Lazy-load `img-to-vid.html` trong `switchTool('toolimzic')` khi má»Ÿ láº§n Ä‘áº§u.
  - ThÃªm CSS cho section `#tool-toolimzic` vÃ  `#tool-toolimzic iframe` Ä‘á»ƒ chiáº¿m toÃ n bá»™ vÃ¹ng tool, trÃ¡nh lá»—i hiá»ƒn thá»‹ khi render.
  - File `nova/web/img-to-vid.html` Ä‘Ã£ Ä‘Æ°á»£c copy tá»« `ImgToVid Ver1.4.html` Ä‘á»ƒ giá»¯ nguyÃªn UI/logic gá»‘c I-MZic.

- [2026-09-05] Toolscript â€” **thay quyáº¿t Ä‘á»‹nh phÃ­a trÃªn**: bá» háº³n hÃ nh vi
  "tá»± tÃ¡ch ~450 tá»«/chÆ°Æ¡ng", thay báº±ng **Ä‘iá»u kiá»‡n tÆ°á»ng minh: Cháº¿ Ä‘á»™ Novel chá»‰
  báº­t Ä‘Æ°á»£c khi QUY MÃ” â‰¥ 2 chÆ°Æ¡ng**. LÃ½ do: tÃ¡ch ngáº§m lÃ m user khÃ³ hiá»ƒu nguá»“n
  gá»‘c sá»‘ chÆ°Æ¡ng (feedback trá»±c tiáº¿p). Thay Ä‘á»•i trong `nova/web/index.html`:
  (1) `tsToggleNovel` cháº·n báº­t + bÃ¡o lá»—i rÃµ khi CHÆ¯Æ NG < 2; (2) nhÃ¡nh Novel
  trong `tsGenerate` fail lá»™ liá»…u náº¿u n < 2 lá»t qua state lá»‡ch (Luáº­t 10 â€”
  khÃ´ng tá»± tÃ¡ch ngáº§m); (3) xoÃ¡ háº±ng cháº¿t `TS_NOVEL_CH_WORDS`; (4) `tsInit`
  chá»‰ khÃ´i phá»¥c chip tá»« localStorage khi QUY MÃ” váº«n â‰¥ 2 chÆ°Æ¡ng, lá»‡ch thÃ¬ xoÃ¡;
  (5) `tsUpdateScale` tá»± táº¯t chip + bÃ¡o status khi CHÆ¯Æ NG quay vá» 1; (6) hint
  UI ghi rÃµ Ä‘iá»u kiá»‡n "tá»‘i thiá»ƒu 2 chÆ°Æ¡ng, sá»‘ chÆ°Æ¡ng & tá»«/chÆ°Æ¡ng láº¥y Ä‘Ãºng theo
  QUY MÃ”". Renderer-only. Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS.
- [2026-09-05] UI dropdown **Chá»§ Ä‘á»** â€” sá»­a khÃ´ng chá»n láº¡i Ä‘Æ°á»£c placeholder.
  NguyÃªn nhÃ¢n: option placeholder `-- Chá»n Chá»§ Äá» --` bá»‹ gáº¯n `disabled` á»Ÿ Cáº¢ HAI
  chá»— trong `nova/web/index.html` (dropdown cá»§a tool Táº¡o Ká»‹ch Báº£n, dÃ²ng ~1804,
  vÃ  dropdown Dashboard tá»± Ä‘á»™ng `dashTopicRow`, dÃ²ng ~6382), trong khi dropdown
  **Phong cÃ¡ch** ká» bÃªn khÃ´ng `disabled` â†’ user chá»n láº¡i/Ä‘áº·t láº¡i Ä‘Æ°á»£c phong cÃ¡ch
  nhÆ°ng khÃ´ng thá»ƒ chá»n láº¡i "-- Chá»n Chá»§ Äá» --" sau khi Ä‘Ã£ chá»n chá»§ Ä‘á». Fix: gá»¡
  `disabled` á»Ÿ cáº£ 2 placeholder + lÃ m cháº¯c handler `onchange` ghÃ©p chuá»—i
  `(m && s) ? (m + ' - ' + s) : (m || s || '')` Ä‘á»ƒ chá»n láº¡i placeholder khÃ´ng
  sinh chuá»—i thá»«a `" - "`. Renderer-only, khÃ´ng Ä‘á»¥ng IPC/contract. `_autoTopic`
  rá»—ng Ä‘Ã£ cÃ³ guard sáºµn (dÃ²ng ~6639). Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS
  (syntax 331 file, IPC 143 kÃªnh, parity, shared).
- [2026-09-05] UI dropdown **Chá»§ Ä‘á»** â€” fix láº¡i logic ghÃ©p chuá»—i Ä‘á»ƒ báº­t láº¡i placeholder thá»±c sá»±.
  NgÆ°á»i dÃ¹ng váº«n khÃ´ng thá»ƒ `-- Chá»n Chá»§ Äá» --` sau chá»n chá»§ Ä‘á» vÃ¬ logic `onchange` trÆ°á»›c Ä‘Ã³
  giá»¯ láº¡i giÃ¡ trá»‹ phong cÃ¡ch khi chá»§ Ä‘á» bá»‹ trá»‘ng, táº¡o ra chuá»—i dÃ­nh hoáº·c khÃ´ng clear input.
  Äiá»u chá»‰nh 4 handler (Táº¡o Ká»‹ch Báº£n + Dashboard, Chá»§ Ä‘á»/Phong cÃ¡ch) thÃ nh dáº¡ng:
  `m ? (m + (s ? ' - ' : '') + s) : ''` cho input topic, vÃ  `(m && s) ? (m + ' - ' + s) : (m || '')` cho hai Ã´ style.
  Renderer-only, khÃ´ng Ä‘á»¥ng IPC/contract. Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS
  (syntax 331 file, IPC 143 kÃªnh, parity, shared).
- [2026-09-05] Auto-Fix â€” kiá»ƒm Ä‘á»‹nh toÃ n bá»™ há»‡ sinh thÃ¡i `auto-fix/` vÃ  **báº­t/
  xÃ¡c minh live error-reporting runtime (observe-only, opt-in)**. PhÃ¡t hiá»‡n BUG
  tháº­t trong wiring production: `client-error-reporter/reporter.js` constructor
  gÃ¡n `this.queue = options.queue || new LocalQueue(...)` â€” trong khi
  `nova/main/error-reporter.js` truyá»n `queue` lÃ  OBJECT Cáº¤U HÃŒNH thuáº§n
  (`{dedupWindowMs, maxPendingPerFingerprint}`) cÃ¹ng `queueFile` â†’ object truthy
  thay tháº¿ LocalQueue â†’ má»i `report()` trong app tháº­t fail tháº§m vá»›i reason
  `report-failed` (Luáº­t 10 vi pháº¡m ngáº§m). Test wiring cÅ© chá»‰ assert TEXT trong
  source nÃªn khÃ´ng báº¯t Ä‘Æ°á»£c. Fix: constructor chá»‰ coi object cÃ³ `enqueue()` lÃ 
  queue inject, cÃ²n láº¡i lÃ  options cho LocalQueue. ThÃªm regression test vÃ o
  `client-error-reporter/test/reporter.test.js` mÃ´ phá»ng Ä‘Ãºng hÃ¬nh thá»©c
  constructor production. Chá»©ng minh E2E qua Electron tháº­t báº±ng probe
  `nova/scripts/tmp-error-reporter-e2e.js` (identity tháº­t, code path tháº­t
  `nova/main/error-reporter.js`): trÆ°á»›c fix `queued:false/report-failed`, sau
  fix `queued:true` + `crash-queue.json` ghi Ä‘Ãºng cáº¥u trÃºc (fingerprint SHA-256,
  environment_id, event sequence, installation-id) trong
  `%APPDATA%\AI Video Studio Independent`. ÄÃ£ xoÃ¡ report demo khá»i queue
  production. Kiá»ƒm Ä‘á»‹nh: `npm --prefix auto-fix run test:all` PASS (13 suite,
  exit 0), `npm run check` PASS (IPC 143 kÃªnh, shared 16 state keys),
  `test:video-agent` PASS (114 test). LÆ°u Ã½: Auto-Fix M1 runtime váº«n
  `observe-only`/`runtimeEnabled:false` â€” chá»‰ error reporting opt-in
  (`AI_VIDEO_STUDIO_ERROR_REPORTING=1`) Ä‘Æ°á»£c xÃ¡c minh hoáº¡t Ä‘á»™ng; 13 gate
  governance M1 váº«n BLOCKED chá» external evidence (CI run, branch protection,
  signing, security review).

- [2026-09-05] Bá»™ khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng Crash Reporter + Crash Service/Worker:
  - `start-stage.ps1`: chá»n `-Stage dev|test|prod`, `-Target app|worker|env`,
    `-NoLaunch`, `-Force` + cÃ¡c tham sá»‘ `-AppUploadUrl/-AppUploadToken/-BuildId/
    -CrashServiceUrl/-WorkerToken/-WorkerId` â€” tá»± set env nhÃ³m `AI_VIDEO_STUDIO_ERROR_*`,
    `CRASH_SERVICE_URL`, `WORKER_*`, `DATABASE_URL`, `*_TOKEN_HASH`, `DEVICE_ID_PEPPER`,
    in cáº£nh bÃ¡o thiáº¿u biáº¿n theo stage.
  - `start-stage.bat`: khÃ´ng tham sá»‘ / `gui` / `-gui` / `/gui` â†’ má»Ÿ GUI
    `start-stage-ui.ps1`; cÃ³ tham sá»‘ khÃ¡c â†’ forward toÃ n bá»™ vÃ o `start-stage.ps1`.
  - `start-stage-ui.ps1`: GUI WinForms chá»n Stage/Target, nháº­p biáº¿n tÃ¹y chá»n,
    checkbox NoLaunch/Force, nÃºt Run (spawn PowerShell má»›i) + Copy command.
  - `auto-fix/crash-environment-templates.ps1`: in template `.env` DEV/TEST/PROD
    (khÃ´ng chá»©a secret tháº­t) Ä‘á»ƒ copy nhanh.
  - **Fix cÃº phÃ¡p GUI (PS 5.1)**: dÃ²ng `return [string]::Join(' ', $cmdParts | ForEach-Object {...})`
    bá»‹ parse error vÃ¬ PS 5.1 khÃ´ng cho pipeline trá»±c tiáº¿p lÃ m argument trong
    method-call paren â€” Ä‘Ã£ tÃ¡ch ra `$quotedParts = @($cmdParts | ...)` rá»“i Join.
  - Kiá»ƒm Ä‘á»‹nh: parser PASS cáº£ 2 file `.ps1`; smoke `-Stage dev|test -Target env|app
    -NoLaunch` qua `.bat` in/check env Ä‘Ãºng (WARN thiáº¿u biáº¿n lÃ  behavior chuáº©n);
    `npm run check` PASS (syntax 331 file, IPC 143 kÃªnh, parity, shared, exit 0).

- [2026-09-05] Handdraw Studio â€” **fix "thanh tiáº¿n trÃ¬nh khÃ´ng cáº­p nháº­t" giá»¯a
  render** (tiáº¿p ná»‘i hdlasso6): bar káº¹t 5% + label káº¹t "khá»Ÿi Ä‘á»™ngâ€¦" suá»‘t lÃºc
  render vÃ¬ (1) panel chá»‰ váº½ %, label `progressMsg` khÃ´ng theo `s.status` cá»§a
  event `whiteboard:exportProgress`; (2) engine Python vendored KHÃ”NG phÃ¡t %
  tá»«ng khung hÃ¬nh (script chá»‰ print Ä‘áº§u/cuá»‘i, cam káº¿t khÃ´ng sá»­a nguá»“n repo) nÃªn
  `report()` chá»‰ cÃ³ má»‘c thÃ´ 2â†’5â†’85â†’92â†’100; (3) ipc.js relay lá»—i dáº¡ng
  `status:'error: â€¦'` nhÆ°ng panel chá»‰ so `=== 'error'` â†’ nhÃ¡nh reset
  `exporting` qua event khÃ´ng khá»›p. ÄÃ£ sá»­a:
  - `nova/web/handdraw-studio-panel.js` (marker **hdlasso7**): listener cáº­p nháº­t
    cáº£ `progressMsg` (cáº¯t 90 kÃ½ tá»±) theo `s.status`; reset `exporting` khi
    `status === 'done'` HOáº¶C tiá»n tá»‘ `error` (khá»›p Ä‘á»‹nh dáº¡ng relay tháº­t).
  - `nova/whiteboard-studio/py-backend.js` (`exportVideo`, `module.exports`
    giá»¯ nguyÃªn): `report(1,â€¦)` TRÆ¯á»šC bÆ°á»›c `status()` (deps check máº¥t vÃ i giÃ¢y);
    **ticker Æ°á»›c tÃ­nh 1.5s/cáº£nh** â€” lÅ©y tiáº¿n tiá»‡m cáº­n trong pháº¡m vi
    [5+80Â·i/N, 5+80Â·(i+1)/N), cap `sceneEndâˆ’1` Ä‘áº£m báº£o khÃ´ng vÆ°á»£t/giáº£m so vá»›i
    má»‘c tháº­t, dá»n báº±ng `finally`, `unref` Ä‘á»ƒ khÃ´ng giá»¯ tiáº¿n trÃ¬nh node khi thoÃ¡t,
    status ghi rÃµ "Æ°á»›c tÃ­nh, Ä‘Ã£ Xs" (Luáº­t 10: khÃ´ng giáº£ vá» lÃ  % tháº­t).
    Re-check sau fix: cap cá»©ng thÃªm `estCeil = max(sceneStart, sceneEndâˆ’1)` cho
    edge case >80 cáº£nh (dáº£i má»—i cáº£nh <1% â€” trÃ¡nh % tá»¥t giáº£m ngÆ°á»£c).
  Kiá»ƒm Ä‘á»‹nh: `node --check` 2 file PASS; `_check_hd_ids.js` PASS (SHELL_HTML â†”
  bind() â†” els.*); `_smoke_handdraw.js` PASS E2E (0.56MB hand + 0.29MB pen) â€”
  log tháº¥y event Æ°á»›c tÃ­nh cháº£y liÃªn tá»¥c 26s rá»“i nháº£y má»‘c tháº­t (xong cáº£nh â†’
  sao chÃ©p â†’ done); `npm run check` PASS (331 file, 143 kÃªnh IPC, parity,
  shared 16 state keys). KhÃ´ng Ä‘á»¥ng kÃªnh IPC/preload/repo vendored.

- [2026-09-05] I-MZic â€” rÃ  soÃ¡t lá»—i phÃ¡t sinh sau khi nhÃºng tool. PhÃ¡t hiá»‡n &
  fix 2 lá»—i tháº­t:
  (1) **Chuyá»ƒn tool giá»¯a chá»«ng lÃºc export lÃ m video Ä‘á»©ng hÃ¬nh**: iframe
  `imzicFrame` bá»‹ `switchTool` áº©n â†’ Chromium throttle canvas trong iframe áº©n â†’
  MediaRecorder ghi Ä‘á»©ng hÃ¬nh; warning `visibilitychange` cá»§a trang con náº±m
  bÃªn trong iframe Ä‘Ã£ áº©n nÃªn ngÆ°á»i dÃ¹ng khÃ´ng tháº¥y. Fix: expose cá»
  `window.__imzicExporting` (getter Ä‘á»c `isExporting`) trong
  `nova/web/img-to-vid.html` + guard trong `switchTool` (`index.html`, ~dÃ²ng
  8155): Ä‘ang ghi thÃ¬ cháº·n chuyá»ƒn tool + `novaToast` giáº£i thÃ­ch.
  (2) **`await audioEl.play()` khÃ´ng catch â†’ `isExporting` káº¹t vÄ©nh viá»…n**:
  náº¿u `play()` reject, cá» giá»¯ `true`, recorder khÃ´ng stop, 2 nÃºt export cháº¿t
  Ä‘áº¿n reload. Fix: try/catch Ä‘áº·t `aborted`, `recorder.stop()`, status lá»—i lá»™ rÃµ
  nguyÃªn nhÃ¢n (Luáº­t 10), reset `isExporting` + `onstop` phÃ¢n nhÃ¡nh aborted.
  Rá»§i ro cháº¥p nháº­n (khÃ´ng fix): Google Fonts CDN â€” Ä‘Ã£ lÃ  pattern sáºµn cá»§a
  `index.html`, offline chá»‰ fallback font; `<a download>` blob trong iframe â†’
  Electron save dialog máº·c Ä‘á»‹nh (app khÃ´ng cÃ³ handler `will-download`);
  hÃ m `bindRange` cháº¿t & `state.colorTouched` khá»Ÿi táº¡o ngáº§m (khÃ´ng gÃ¢y bug).
  Renderer-only, khÃ´ng Ä‘á»¥ng IPC/contract. Kiá»ƒm Ä‘á»‹nh: extract `<script>`
  `img-to-vid.html` qua `node --check` PASS (39.569 bytes); `npm run check`
  PASS (syntax 331 file, IPC 143 kÃªnh, parity, shared 25 file/16 state keys).

- [2026-09-05] I-MZic â€” **"sá»­a toÃ n bá»™ cho á»•n Ä‘á»‹nh"**: harden tiáº¿p `img-to-vid.html`
  sau vÃ²ng audit 1 (6 nhÃ³m sá»­a, giá»¯ nguyÃªn kiáº¿n trÃºc iframe + há»£p Ä‘á»“ng
  `__imzicExporting`):
  1. `playBtn`: `await audioEl.play()` khÃ´ng catch â†’ unhandled rejection; giá»
  try/catch + status lá»—i rÃµ nguyÃªn nhÃ¢n.
  2. Chá»n áº£nh: thÃªm validate loáº¡i file (image/* | Ä‘uÃ´i png/jpg/gif/webp/bmp/avif),
  `Image.onerror` (file há»ng bÃ¡o ngay, khÃ´ng im láº·ng), revoke object URL cÅ© â€”
  háº¿t rÃ² rá»‰ bá»™ nhá»› khi Ä‘á»•i áº£nh nhiá»u láº§n.
  3. Chá»n nháº¡c: thÃªm `audioEl.onerror` (file há»ng trÆ°á»›c Ä‘Ã³ Ä‘á»ƒ seekBar káº¹t
  disable khÃ´ng thÃ´ng bÃ¡o), revoke URL cÅ©, seekBar max xá»­ lÃ½ duration
  `Infinity` (webm), thÃªm state `audioReady` â€” `checkReady` giá» yÃªu cáº§u metadata
  Ä‘Ã£ náº¡p; `recordAndExport` cháº·n export khi chÆ°a ready.
  4. Export: thÃªm `recorder.onerror` (lá»—i giá»¯a chá»«ng trÆ°á»›c Ä‘Ã³ káº¹t `isExporting`
  vÄ©nh viá»…n â€” flag `failed`, khÃ´ng táº£i file ná»­a vá»i), watchdog dá»«ng recorder
  sau `duration+15s` (hoáº·c cap 2h náº¿u duration khÃ´ng finite) phÃ²ng `ended`
  khÃ´ng bao giá» Ä‘áº¿n, `try/catch` quanh `recorder.start()`, cleanup dá»«ng track
  canvas (giá»¯ nguyÃªn audio track dÃ¹ng chung `streamDest`), revoke blob URL
  video/nháº¡c sau 60s.
  5. Guard Ä‘ang ghi: `playBtn`/`restartBtn`/`seekBar` bá»‹ cháº·n thao tÃ¡c khi
  `isExporting` (pause/seek giá»¯a lÃºc ghi trÆ°á»›c Ä‘Ã³ phÃ¡ báº£n ghi â€” video lá»‡ch
  nhá»‹p/Ä‘á»©ng khung).
  6. Dá»n code cháº¿t: xoÃ¡ hÃ m `bindRange` (chÆ°a tá»«ng gá»i, chá»©a dÃ²ng no-op),
  khai bÃ¡o tÆ°á»ng minh `state.colorTouched:false`.
  Renderer-only, khÃ´ng Ä‘á»¥ng IPC/contract/env. Kiá»ƒm Ä‘á»‹nh: extract `<script>`
  â†’ `node --check` PASS (43.294 bytes); cáº£ 4 script check PASS riÃªng láº»
  (syntax 331 file, IPC 143 kÃªnh/20 events, parity 0, shared 25 file/16 key).

- [2026-09-06] I-MZic â€” harden vÃ²ng 2 (cÃ¡c thao tÃ¡c phÃ¡ báº£n ghi giá»¯a lÃºc ghi,
  `nova/web/img-to-vid.html`):
  1. **Äá»•i áº£nh/nháº¡c/SRT giá»¯a lÃºc ghi**: guard á»Ÿ `imgInput`/`audInput`/`srtInput`/
  `loadSrtPasteBtn` â€” cháº·n + xoÃ¡ selection + status giáº£i thÃ­ch (Ä‘á»•i file giá»¯a
  lÃºc MediaRecorder cháº¡y sáº½ phÃ¡ track hÃ¬nh/Ã¢m cá»§a báº£n ghi).
  2. **Äá»•i khá»• hÃ¬nh giá»¯a lÃºc ghi**: guard `applyLandscapeCustomSize` (hoÃ n tÃ¡c
  Ã´ customW/customH vá» Ä‘Ãºng canvas hiá»‡n táº¡i) + `setOrientation` (biáº¿n
  `appliedOrientation` hoÃ n tÃ¡c `state.orientation` & chip vÃ¬ chip click Ä‘Ã£
  mutate state trÆ°á»›c khi guard cháº¡y). Äá»•i `canvas.width/height` giá»¯a lÃºc
  `captureStream` Ä‘ang ghi lÃ m há»ng track video.
  3. **Äá»•i leadMs giá»¯a lÃºc ghi**: guard + hoÃ n tÃ¡c slider vá» `state.leadMs` â€”
  Ä‘á»•i `delayNode.delayTime` giá»¯a lÃºc ghi lÃ m lá»‡ch nhá»‹p audio cá»§a chÃ­nh báº£n ghi.
  4. **Bug `isSeeking` káº¹t vÄ©nh viá»…n**: nhÃ¡nh cháº·n seek khi Ä‘ang ghi tráº£ vá»
  mÃ  khÃ´ng reset `isSeeking` â†’ `timeupdate` bá»‹ khoÃ¡ vÄ©nh viá»…n sau khi ghi xong
  (seekBar Ä‘á»©ng im). Fix: reset `isSeeking=false` trÆ°á»›c khi return.
  5. **`f.text()` khÃ´ng catch** (srtInput): unhandled rejection náº¿u file SRT
  khÃ´ng Ä‘á»c Ä‘Æ°á»£c â†’ try/catch + status lá»—i (Luáº­t 10).
  6. **`recordAndExport` early-return im láº·ng**: báº¥m export khi Ä‘ang ghi /
  thiáº¿u file trÆ°á»›c Ä‘Ã¢y khÃ´ng bÃ¡o gÃ¬ â†’ giá» cÃ³ status message rÃµ.
  Renderer-only. Kiá»ƒm Ä‘á»‹nh: extract `<script>` â†’ `node --check` exit 0;
  `npm run check` PASS (CHECK_EXIT:0 â€” syntax 331, IPC 143, parity 0,
  shared 25 file/16 key). ÄÃ£ xÃ¡c minh `novaToast` (index.html dÃ²ng 6161)
  tá»“n táº¡i â†’ guard cháº·n chuyá»ƒn tool á»Ÿ `switchTool` hiá»ƒn thá»‹ thÃ´ng bÃ¡o Ä‘Ãºng.

- [2026-09-06] I-MZic â€” **gÃ³i 4 cáº£i tiáº¿n** (#1â€“#4 + #9 + #12, theo lá»±a chá»n cá»§a user):
  1. **#1 Bug UI**: chip "ðŸŒ§ MÆ°a bay" bá»‹ láº·p 2 láº§n trong `effectChips` â†’ xoÃ¡ 1 dÃ²ng.
  2. **#2 Tiáº¿n trÃ¬nh ghi**: thanh progress (`progWrap/progBar/progText`) cáº­p nháº­t
     trong render loop theo `audioEl.currentTime/duration` khi `isExporting`.
  3. **#3 Huá»· ghi**: nÃºt "âœ• Huá»· ghi" â€” `activeExportCancel` (closure trong
     `recordAndExport`) dá»«ng nháº¡c + chá»‘t recorder; `onstop` tháº¥y `aborted` (tÃ¡i dÃ¹ng
     cÆ¡ cháº¿ cÅ©) + `abortMsg` phÃ¢n biá»‡t "user huá»·" vs "khÃ´ng phÃ¡t Ä‘Æ°á»£c nháº¡c" â†’
     KHÃ”NG táº£i file ná»­a vá»i. Má»i Ä‘iá»ƒm reset UI gom vá» `finishExportUI()` (Ä‘iá»ƒm gÃ¡n
     `isExporting=false` duy nháº¥t).
  4. **#4 Nhá»› cÃ i Ä‘áº·t**: localStorage key `imzic:settings:v1` â€” lÆ°u má»i range/
     color/select/customW-H + 6 nhÃ³m chip + ná»™i dung srtPaste (cap 20k chars).
     KhÃ´i phá»¥c báº±ng set value + dispatch event Ä‘á»ƒ listener sáºµn cÃ³ tá»± cáº­p nháº­t
     state/nhÃ£n/rebuild (khÃ´ng nhÃ¢n báº£n logic). `loadSettings()` pháº£i gá»i SAU
     `let isExporting` (TDZ: listener leadMs/setOrientation Ä‘á»c isExporting).
  5. **#9 Xuáº¥t 1080p**: tÃ¡ch há»‡ toáº¡ Ä‘á»™ LOGIC (`logicW/logicH`, máº·c Ä‘á»‹nh 720Ã—1280)
     khá»i canvas Váº¬T LÃ â€” khi ghi, canvas phÃ³ng `EXPORT_UPSCALE=1.5` (cap 4096px,
     bitrate 8â†’14 Mbps khi phÃ³ng) rá»“i render() Ã¡p `ctx.setTransform(canvas/logic)`
     nÃªn má»i hiá»‡u á»©ng giá»¯ nguyÃªn há»‡ toáº¡ Ä‘á»™; `cleanup()` tráº£ canvas vá» khá»• preview.
     ÄÃ£ Ä‘á»•i `rebuildParticles/drawWave/drawLyrics/drawParticles/updateParticle/
     applyLandscapeCustomSize/setOrientation` sang dÃ¹ng logic dims.
  6. **#12 GhÃ©p nháº¡c tá»± Ä‘á»™ng**: kÃªnh IPC Má»šI `imzic-mux` (main `nova/main/ipc/imzic.js`
     â€” ffmpeg-static, `-c copy -shortest` ra .mkv, save dialog, dá»n tmp, error code
     `IMZIC_*` theo Luáº­t 10), Ä‘Äƒng kÃ½ trong `nova/main/ipc/index.js`, preload
     `window.native.imzicMux`. Renderer: nÃºt "âš¡ GhÃ©p nháº¡c tá»± Ä‘á»™ng" hiá»‡n sau khi
     xuáº¥t video cÃ¢m (`lastSilentBlob`), mÆ°á»£n `window.parent.native` vÃ¬ tool cháº¡y
     trong iframe cÃ¹ng origin (bridge `native` chá»‰ expose á»Ÿ main frame).
  Kiá»ƒm Ä‘á»‹nh: extract `<script>` â†’ `node --check` PASS (55.235 bytes);
  `node --check` imzic.js/index.js/preload.js PASS; `npm run check` PASS
  (syntax 333 file, IPC 144 kÃªnh/20 events â€” +1 kÃªnh `imzic-mux`, parity 0,
  shared 26 file/16 key). Script táº¡m `tmp-imzic-check.js` Ä‘Ã£ xoÃ¡.

- [2026-09-06] I-MZic â€” **tá»‘i Æ°u tá»‘c Ä‘á»™ render loop, KHÃ”NG Ä‘á»•i tiÃªu chuáº©n Ä‘áº§u ra**
  (theo yÃªu cáº§u: nhanh hÆ¡n nhÆ°ng khÃ´ng giáº£m/há»ng cháº¥t lÆ°á»£ng; renderer-only,
  `nova/web/img-to-vid.html`):
  1. **Raster cache áº£nh ná»n** (Ä‘iá»ƒm nÃ³ng #1): trÆ°á»›c Ä‘Ã¢y `ctx.drawImage` resample
     áº£nh Gá»C (cÃ³ thá»ƒ 6000px) Má»–I FRAME â€” náº·ng nháº¥t khi ghi 1080Ã—1920. Giá» quÃ©t
     Má»˜T Láº¦N vÃ o offscreen canvas khá»• `cover(canvas váº­t lÃ½) Ã— zoomMax` (zoomMax
     lÃ m trÃ²n LÃŠN bÆ°á»›c 0.05 â†’ kÃ©o slider khÃ´ng rebuild liÃªn tá»¥c), má»—i frame váº½
     tá»« raster. Raster luÃ´n â‰¥ khá»• hiá»ƒn thá»‹ (chá»‰ downscale â‰¤ zoomMax, khÃ´ng bao
     giá» upscale â€” Ä‘Ã£ mÃ´ phá»ng verify 4 case PASS) + bÆ°á»›c quÃ©t dÃ¹ng
     `imageSmoothingQuality:'high'` â†’ Ä‘á»™ nÃ©t tÆ°Æ¡ng Ä‘Æ°Æ¡ng hoáº·c Tá»T HÆ N trÆ°á»›c.
     Key = img.src + dims + canvas dims + zq; Ä‘á»•i áº£nh/vÃ o-ra cháº¿ Ä‘á»™ ghi tá»±
     rebuild, canvas khÃ´ng resize khi key giá»¯ nguyÃªn â†’ khÃ´ng phÃ¡ track ghi.
     Raster cho áº£nh 6000Ã—4000 chá»‰ 3024Ã—2016 (downscale to 1 láº§n, nháº¹ hÆ¡n nhiá»u
     so vá»›i 60 láº§n full-res má»—i giÃ¢y).
  2. **Cache wrap lá»i**: `wrapLyricTextCached` â€” bá» `measureText` tá»«ng chá»¯ má»—i
     frame, chá»‰ tÃ­nh láº¡i khi Ä‘á»•i SRT (`lyricsVersion++` trong
     `loadLyricsFromText`) / dÃ²ng / font / cá»¡ / khung. Káº¿t quáº£ wrap giá»¯ nguyÃªn
     â†’ vá»‹ trÃ­ chá»¯ trÃªn video KHÃ”NG Ä‘á»•i.
  3. **Throttle UI tiáº¿n trÃ¬nh 100ms** (#2): DOM writes 60 láº§n/giÃ¢y â†’ 10 láº§n/giÃ¢y,
     refs `progEls` hoisted â€” thuáº§n UI ngoÃ i canvas, khÃ´ng dÃ­nh file xuáº¥t.
  4. **Memoize `hexToRgba`**: parse hex cache theo chuá»—i mÃ u (hÃ ng trÄƒm láº§n gá»i
     má»—i frame tá»« bead/dot/bar cá»§a sÃ³ng) â€” chuá»—i rgba tráº£ vá» GIá»® NGUYÃŠN tá»«ng kÃ½ tá»±.
  KHÃ”NG Ä‘á»¥ng: bitrate, Ä‘á»™ phÃ¢n giáº£i, shadowBlur, gradient Ä‘á»™ng, sá»‘ segment,
  logic particle/zoom/timing/lead â€” má»i Ä‘áº·c tÃ­nh hÃ¬nh áº£nh cá»§a file xuáº¥t giá»¯ nguyÃªn
  (CPU dÆ° â†’ Ã­t rÆ¡i frame khi ghi â†’ cháº¥t lÆ°á»£ng file cÃ²n á»•n Ä‘á»‹nh hÆ¡n).
  Kiá»ƒm Ä‘á»‹nh: extract `<script>` â†’ `node --check` PASS (58.762 bytes); mÃ´ phá»ng
  toÃ¡n raster 4 case ALL-PASS; `npm run check` PASS (syntax 333, IPC 144/20,
  parity 0, shared 26/16). `tmp-imzic-check.js` Ä‘Ã£ xoÃ¡ sau dÃ¹ng.

- [2026-09-06] I-MZic â€” **tÃ¡ch 3 dáº£i táº§n sá»‘ tá»« FFT cÃ³ sáºµn** (theo yÃªu cáº§u user:
  zoom theo bass, particle nhá»‹p theo treble, sÃ³ng giá»¯ nguyÃªn; renderer-only,
  `nova/web/img-to-vid.html`):
  1. CÃ¹ng Má»˜T láº§n `getByteFrequencyData` má»—i frame, chia phá»• (fftSize 256 â†’ 128
     bin Ã— ~172 Hz/bin @44.1 kHz): bass = bin 0-3 (0-~690 Hz), treble = bin 24-63
     (~4.1-11 kHz, nhÃ¢n 1.4 vÃ¬ biÃªn Ä‘á»™ bin treble vá»‘n nhá»). Helper `avgFreqRange`
     chuáº©n hoÃ¡ 0..1; guard khi `freqData` null.
  2. **Zoom áº£nh ná»n giá» Äƒn Ä‘Ãºng dáº£i tráº§m** (trÆ°á»›c Ä‘Ã¢y trá»™n ~15 bin Ä‘áº§u gá»“m cáº£
     giá»ng hÃ¡t) â†’ nhá»‹p phÃ³ng "Ä‘áº¥m" theo kick rÃµ hÆ¡n; váº«n qua `state.sensitivity`
     + smoothing theo `state.smoothness` nhÆ° cÅ©.
  3. **Particle (tuyáº¿t/hoa/stars/mÆ°a) pulse theo treble**: `smoothedTreble`
     attack/decay nhanh (pow(0.72, dt)) Ä‘á»ƒ "pháº­p" theo hi-hat; `drawParticles`
     nháº­n `treblePulse` â†’ háº¡t ná»Ÿ tá»‘i Ä‘a +30% cá»¡ (`grow`) vÃ  sÃ¡ng +25% (`boost`,
     alpha clamp 1). **treble=0 â†’ grow=boost=1 â†’ hÃ¬nh áº£nh giá»‘ng há»‡t há»‡ cÅ©** (nháº¡c
     tráº§m/im láº·ng khÃ´ng Ä‘á»•i) â€” Ä‘Ã¢y lÃ  báº£o Ä‘áº£m "khÃ´ng há»ng baseline".
  4. SÃ³ng nháº¡c: KHÃ”NG Ä‘á»¥ng â€” `waveEnergyAt` váº«n Ã¡nh xáº¡ toÃ n bá»™ 128 bin nhÆ° trÆ°á»›c.
  KhÃ´ng thÃªm dependency, khÃ´ng Ä‘á»•i IPC/state key. Kiá»ƒm Ä‘á»‹nh: extract `<script>`
  â†’ `node --check` PASS (60.454 bytes); `npm run check` PASS (syntax 337,
  IPC 144/20, parity 0, shared 26/16). `tmp-imzic-check.js` Ä‘Ã£ xoÃ¡ sau dÃ¹ng.
- [2026-09-06] Handdraw Studio â€” **tiáº¿n trÃ¬nh tháº­t + ETA + phÃ¡t hiá»‡n káº¹t trong
  export MP4** (tiáº¿p ná»‘i hdlasso7; user feedback: "thanh tiáº¿n trÃ¬nh chÆ°a Ä‘Ãºng,
  dá»± tÃ­nh thá»i gian chÆ°a chÃ­nh xÃ¡c, khÃ´ng biáº¿t Ä‘ang lÃ m gÃ¬ hay bá»‹ káº¹t"):
  - Gá»‘c rá»…: engine vendored `render_stream_whiteboard.py` KHÃ”NG phÃ¡t gÃ¬ trong lÃºc
    render (chá»‰ print Ä‘áº§u/cuá»‘i) â†’ giáº£i phÃ¡p cÅ© lÃ  ticker "bÃ² % Æ°á»›c tÃ­nh" giáº£.
  - **`nova/whiteboard-studio/render-progress-bridge.py` (file Má»šI cá»§a Nova,
    repo vendored KHÃ”NG sá»­a)**: bá»c `cv2.VideoWriter` báº±ng subclass Ä‘áº¿m khung
    (má»i khung engine ghi Ä‘á»u qua `write()`) + bá»c `stream_render.transcode_h264`
    â†’ phÃ¡t stderr flush tá»«ng dÃ²ng: `WBPROG open fps=/w=/h=`, `WBPROG frame=N`
    (má»—i 5 khung), `WBPROG transcode`, `WBPROG error`. Cháº¡y vendored script y

- [2026-09-06] CI/M1 â€” **sá»­a CI fail á»Ÿ bÆ°á»›c Checkout cá»§a cáº£ 2 workflow**
  (repo vá»«a chuyá»ƒn public, giá» verify trá»±c tiáº¿p GitHub API Ä‘Æ°á»£c):
  - Gá»‘c rá»…: git index cÃ³ **gitlink** `nova/whiteboard-studio/srt-whiteboard-animation`
    (mode 160000, cÃ³ tá»« cÃ¡c commit sync whiteboard `76a8a975`/`9ec9c9f8`) nhÆ°ng
    repo chÃ­nh **khÃ´ng cÃ³ `.gitmodules`** â†’ `actions/checkout@v7` fail
    `git exit 128: "No url found for submodule path ... in .gitmodules"` ngay á»Ÿ
    step "Checkout full source history" â†’ má»i step sau bá»‹ skip. Cáº£ M1 Validation
    láº«n Windows Package fail y há»‡t (run #24, #23 vÃ  cÃ¡c run trÆ°á»›c trÃªn PR #3).
  - Fix commit `1594d406`: táº¡o `.gitmodules` khai bÃ¡o submodule
    `https://github.com/khanhtran0393/srt-whiteboard-animation.git` (fork public
    cá»§a user); Ä‘Ã£ `git submodule init` local. CI khÃ´ng báº­t `submodules: true`
    nÃªn checkout chá»‰ cáº§n .gitmodules há»£p lá»‡, khÃ´ng clone ná»™i dung submodule.
  - Äá»“ng thá»i push commit `6b378f4` cá»§a submodule lÃªn fork (`696a724..6b378f4`)
    Ä‘á»ƒ SHA gitlink pin thá»±c sá»± tá»“n táº¡i trÃªn remote.
  - Sau khi checkout Ä‘Æ°á»£c (run #25 trÃªn `1594d406`), M1 Validation váº«n fail tiáº¿p á»Ÿ
    step 6 (`npm --prefix auto-fix run test:all`): **`control-plane.test.js:54`**
    â€” CI checkout PR á»Ÿ **detached HEAD** â†’ `git symbolic-ref --short -q HEAD`
    exit 1 â†’ `runGit` **throw** (khÃ´ng tráº£ falsy) â†’ fallback `|| 'DETACHED'`
    khÃ´ng bao giá» cháº¡y â†’ `branch` giá»¯ `null`. Fix commit `2d6957b4`: bá»c riÃªng
    lá»‡nh symbolic-ref trong try/catch map sang `'DETACHED'` (contract mÃ  test Ä‘Ã£
    assert; detached HEAD lÃ  tráº¡ng thÃ¡i há»£p lá»‡, khÃ´ng pháº£i lá»—i). ÄÃ£ mÃ´ phá»ng
    detached HEAD trÃªn repo táº¡m: `branch=DETACHED isGit=true dirty=false` PASS;
    `npm --prefix auto-fix run test:all` PASS; `npm run check` PASS.
  - Lá»—i CI thá»© 3 (`dependency-scan.test.js:22`): `runDependencyAudit` cháº¡y
    `npm audit --json --prefix <root>`; trÃªn Windows spawn 'npm' (npm.cmd)
    ENOENT â†’ BLOCKED (test pass "tá»± nhiÃªn"), nhÆ°ng trÃªn Linux npm audit vá»›i
    `--prefix` trá» dir khÃ´ng tá»“n táº¡i **im láº·ng audit nháº§m project á»Ÿ cwd** â†’
    tráº£ ok:true (false-positive, fail-open). Fix commit `af72c6a9`: guard
    fail-closed â€” kiá»ƒm tra root + package-lock.json tá»“n táº¡i trÆ°á»›c khi audit.
  - Lá»—i CI thá»© 4 (`foundation-test.js:38`): test hard-code path Windows
    `X:\data` cho `userDataPath` (dÃ¹ng `path.resolve`) â†’ trÃªn ubuntu
    `path.resolve('X:\data')` = `<cwd>/X:\data`. Fix commit `b970e95f`: dÃ¹ng
    absolute path cá»§a chÃ­nh platform (`path.resolve(os.tmpdir(), ...)`).
  - Lá»—i CI thá»© 5 (step Audit): **lá»— há»•ng tháº­t** â€” `fast-uri@3.1.3` (transitive:
    electron-builder â†’ app-builder-lib â†’ ajv) dÃ­nh 6 advisory GHSA high
    (host confusion/SSRF). Fix commit `1a699d9b`: `npm audit fix` bump
    fast-uri 3.1.3 â†’ 3.1.7 trong lockfile (18 dÃ²ng), audit 0 vulnerabilities
    cáº£ full láº«n --omit=dev.
  - Lá»—i CI thá»© 6 (step readiness fail-closed): readiness bÃ¡o `FAIL` thay vÃ¬
    `BLOCKED` vÃ¬ **`dirty: true`** â€” step application checks cháº¡y `check:ipc`
    regenerate `nova/ipc-inventory.json` (trÆ°á»ng `generatedAt` luÃ´n Ä‘á»•i) lÃ m
    worktree báº©n â†’ gate clean-worktree FAIL. ÄÃ¢y lÃ  váº¥n Ä‘á» **thá»© tá»± step**.
    Fix commit `3582758d`: chuyá»ƒn khá»‘i "Verify readiness remains fail-closed"
    + upload artifact lÃªn ngay sau npm ci, TRÆ¯á»šC má»i step ghi file.
  - **Káº¾T QUáº¢: M1 Validation run #30 + Windows Package run #30 (commit
    `3582758d`) Ä‘á»u SUCCESS toÃ n bá»™ step** (ká»ƒ cáº£ readiness BLOCKED/exit 2
    Ä‘Ãºng thiáº¿t káº¿ + upload artifact m1-readiness). PR #3 chuyá»ƒn
    `mergeable_state: clean` â€” sáºµn sÃ ng merge vÃ o main. Sau khi merge:
    workflow pushâ†’main sáº½ cháº¡y job `windows-attestation` (Ä‘ang skipped) â†’
    láº¥y run URL lÃ m báº±ng chá»©ng `sourceProvenance`.
  - Ká»¹ thuáº­t láº¥y log CI khÃ´ng cáº§n gh CLI: dÃ¹ng `git credential fill` (PAT cá»§a
    GCM) + API `actions/jobs/<id>/logs` (302 redirect â†’ táº£i trá»±c tiáº¿p URL
    location khÃ´ng kÃ¨m auth). Token táº¡m Ä‘Ã£ xoÃ¡ sau khi dÃ¹ng.
  - CÃ²n WIP chÆ°a commit cá»§a phiÃªn trÆ°á»›c (Agent Bridge): `MEMORY.md`,
    `nova/main/server.js`, `nova/main/agent-bridge.js`, `start.bat` â€” chá»§
    kho cáº§n hoÃ n thiá»‡n rá»“i commit riÃªng, sáº½ lÃ m PR update CI.
  - Kiá»ƒm chá»©ng GitHub-side: PR #3 (62 commits, mergeable, `mergeable_state:
    unstable` do CI Ä‘á»), `main` váº«n á»Ÿ `d973330d` vÃ  **chÆ°a protected**;
    **rulesets = `[]`** â†’ gate `branchProtection` trong M1-READINESS-REPORT hiá»‡n
    CHÆ¯A cÃ³ báº±ng chá»©ng tháº­t (cáº§n táº¡o ruleset tháº­t á»Ÿ GitHub Settings â†’ Rules).
    `windows-attestation` job `skipped` Ä‘Ãºng thiáº¿t káº¿ (chá»‰ cháº¡y khi push vÃ o main).
  - LÆ°u Ã½: báº±ng chá»©ng `sourceProvenance` (attestation) váº«n chÆ°a thá»ƒ cÃ³ run URL
    cho tá»›i khi merge PR #3 vÃ o `main`. Worktree cÃ²n WIP chÆ°a commit cá»§a phiÃªn
    trÆ°á»›c: `MEMORY.md`, `nova/main/server.js`, `nova/main/agent-bridge.js`.

    nguyÃªn qua `runpy` forward argv + exit code. Subclass cv2.VideoWriter Ä‘Ã£
    test thá»§ cÃ´ng vá»›i venv tháº­t trÆ°á»›c khi Ã¡p dá»¥ng.
  - `py-backend.js` exportVideo: render qua bridge (args khÃ´ng Ä‘á»•i, bridge tá»±
    thÃªm RENDER_SCRIPT); parser stderr/stderr line-buffer tÃ¡ch WBPROG (khÃ´ng vÃ o
    Log renderer) â†’ **% tháº­t = khung Ä‘Ã£ ghi / (durationMsÃ—fps)**, clamp `estCeil`
    giá»¯ tÃ­nh Ä‘Æ¡n Ä‘iá»‡u; status dáº¡ng `cáº£nh i/N Â· khung X/Y Â· Z khung/s Â· cÃ²n ~Ts
    Â· sau Ä‘Ã³ k cáº£nh â‰ˆ ~Ts` (ETA cáº£nh theo tá»‘c Ä‘á»™ khung tháº­t, ETA cÃ¡c cáº£nh cÃ²n
    theo trung bÃ¬nh cáº£nh Ä‘Ã£ xong); ticker 2s Bá»Ž crawl giáº£ â€” chá»‰ gÃ¡n nhÃ£n giai
    Ä‘oáº¡n im láº·ng (>4s "Ä‘ang nÃ©t vÃ¹ng tiáº¿p theo", >25s âš  káº¹t, trÆ°á»›c khung Ä‘áº§u
    "Ä‘ang tÃ­nh vÃ¹ng/nÃ©t CPU") + throttle IPC 400ms; `PYTHONUNBUFFERED=1` trong
    childEnv (stdout engine cháº£y live); `runCapture` thÃªm opts.onStdout.
  - **Sá»­a bug tiá»m áº©n**: `prepare()` gá»i `report(1,â€¦)` â€” `report` khÃ´ng tá»“n táº¡i
    á»Ÿ scope Ä‘Ã³ (ReferenceError khi báº¥m "dá»±ng mÃ´i trÆ°á»ng" láº§n Ä‘áº§u) â†’ Ä‘á»•i sang
    `onLog`.
  - Panel `handdraw-studio-panel.js` (marker **hdlasso8**): label cáº¯t 90â†’140 kÃ½
    tá»± (Ä‘á»§ chá»©a khung/tá»‘c Ä‘á»™/ETA), watchdog 60s/20s â†’ **15s/5s vÃ  cáº£nh bÃ¡o
    THáº²NG vÃ o label** (phÃ¢n biá»‡t "engine báº­n nhÆ°ng event váº«n cháº£y" vs "luá»“ng cháº¿t").
  - Kiá»ƒm Ä‘á»‹nh: node --check + py_compile PASS; `_check_hd_ids.js` PASS;
    `_smoke_handdraw.js` E2E render MP4 tháº­t 2 láº§n PASS â€” dÃ²ng tiáº¿n trÃ¬nh
    `khung 110/300 Â· 16.3 khung/s Â· cÃ²n ~12s` cháº£y Ä‘á»u, estTotal khá»›p Ä‘Ãºng 300
    khung tháº­t, nhÃ£n transcode/hoÃ n táº¥t Ä‘Ãºng giai Ä‘oáº¡n; `npm run check` PASS
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


## 2026-09-06 (5) - I-MZic: gom chip-group thanh dropdown + them 6 FX toan khung vao canvas
- Sai pham vi truoc do: goi FX vao Tool 7 cua index.html, trong khi user muon thay trong
  I-MZic (nova/web/img-to-vid.html) - tool "Anh & Nhac". Lan nay sua dung cho.
- Gom 6 nhom chip thanh dropdown select.sel (Hiá»‡u á»©ng bay, HÆ°á»›ng bay, SÃ³ng nháº¡c,
  Kiá»ƒu sÃ³ng 14 chip, Khung dá»c/ngang, BÃ³ng chá»¯): setupChips/setChipValue -> setupSel/
  setSelValue (hop dong state[key] giu nguyen; setSelValue KHONG ban change de tranh
  de quy khi hoan tac khong trong luc ghi). CSS .chip/.chip-group chet da xoa.
- Luu cai dat: SETTINGS_SELECT_IDS them 8 select, xoa SETTINGS_CHIP_GROUPS; save khong
  con object chips; load co migration LEGACY_CHIP_TO_SEL (ban cu {chips:{}} -> dispatch
  change len select moi) nen nguoi dung khong mat cai dat cu.
- Them muc "6. Hiá»‡u á»©ng FX toÃ n khung" (muc 6/7 cu danh lai thanh 7/8): fxSel (none +
  glitch/vhs/zoomblur/motionblur/noise/pulse) + fxLevel 10-100%. Engine applyFx() la
  post-process VE LEN CANVAS (toan do vat ly qua setTransform don vi, dung ca khi ghi
  xuat phong 1.5x) -> tu dong nam trong video xuat MediaRecorder, khong can sua export.
  Deterministic (Luat 8): fxH01 sin-hash theo so khung + 4 tile noise mulberry32 seed
  co dinh; pulse la vignette co-giat theo bass FFT THAt (smoothedEnergy) - I-MZic co
  audio that nen music-reactive that, khac pulse BPM cua Remotion.
- Nghiem thu: extract inline script -> node --check PASS; smoke Electron (BrowserWindow
  an) PASS: 7 dropdown, 14 kieu song, 7 option FX, 0 chip con lai, chon Mua tu dat
  huong "Xuong", nhan fxLevel 100% cap nhat nhan, render loop chay that 700ms voi
  glitch bat ma KHONG co loi console trang; npm run check PASS (344 file, IPC 144/20,
  parity 0, shared 28/16).

## 2026-09-06 (4) - FX overlay music-reactive (glitch/VHS/blur/noise/pulse) + gom UI dropdown
- Them `nova/editor-pro/nova-remotion/src/effects.js`: bang FX 6 hieu ung phu toan khung
  viet bang CSS thuan (khong dependency moi - Luat 9): glitch, vhs, zoom-blur,
  motion-blur, noise, pulse. Deterministic (Luat 8): pseudo-random `h01(n)` =
  fract(sin(n*127.1+311.7)*43758.5453) theo frame index, KHONG Math.random; grain =
  SVG feTurbulence data URL inline. "Music-reactive" = pulse theo tham so `bpm` khai
  bao (khong FFT that) de render lap lai giong het.
- SSOT: `fxOverlay(name,t,fps,opts)` tra mang style object dung chung cho CA HAI
  consumer - `FxLayer` trong NovaScene.js (render Remotion that) va nhanh `type:'fx'`
  trong preview.js (Tool 7 xem truoc DOM) - xem truoc va xuat khong the lech nhau.
- templates.js: them 6 goi mau `fx-*` (label "FX Â· ...", z:90) -> tu dong vao catalog
  AI/UI qua `sceneTemplates` IPC, khong sua index.html bang tay cho catalog.
- index.html: `_t7LayerHtml` them nhanh `kind:'fx'` (dung pieces main tinh san);
  loai `fx-` khoi bo loc tab "Chu"; them `_t7FxSwatchLoad()` - swatch CSS SONG cho
  the fx-* lay tu `previewLayers` (engine that, cache 1 lan, khong can anh JPG).
- Gom UI dropdown (yeu cau user): toc do xem truoc `t7Rate` span chu ky -> `<select>`
  (them `t7SetRate`, giu `t7CycleRate` lam alias); 5 kieu phu de `t7RenderSubStyleChips`
  tach chip -> 1 menu tháº£ + o xem truoc "Aa" (state.t7SubStyle giu nguyen).
- Rebuild bundle nova-remotion (BUNDLE OK). Nghiem thu: render still frame 36 qua
  bundle that - co fx 1,088,341 bytes vs khong fx 34,429 bytes, hash khac nhau
  (overlay that su ve len); previewAt tra fx z:90 voi 6/3 pieces; `npm run check`
  PASS (syntax 344, IPC 144/20, parity 0, shared 28/16).

## 2026-09-06 (6) - I-MZic: section "Song nhac" gom thanh dropdown co dong/mo
- Yeu cau user: phan "4. Song nhac" trong sidebar tool I-MZic (img-to-vid.html)
  chiem nhieu cho -> gom thanh dropdown de gon.
- Lam bang pattern `<details>/<summary>` native ( cung pattern index.html dang dung,
  khong them JS framework): summary giau marker webkit, co chevron xoay khi mo,
  noi dung boc trong `.section-body`.
- Summary hien hint trang thai ("Tat" hoac ten kieu song dang chay, vd "â–®â–®â–® Cot
  nhac guong") - cap nhat tu `state.waveOn` + option text cua `waveStyleSel`, nen
  khoi dung section van biet song dang o che do nao.
- Trang thai mo/dong luu rieng key `imzic:waveSectionOpen:v1` (best-effort
  try/catch nhu saveSettings - khong doi schema `imzic:settings:v1`). Mac dinh
  dong; ID cac field giu nguyen hoan toan -> save/load settings, state, render
  song khong anh huong.
- Nghiem thu: extract inline script -> node --check PASS; `npm run check` PASS
  (syntax 346, IPC 144/20, parity 0, shared 28/16).

## 2026-09-06 (7) - I-MZic: Má»ŒI section sidebar gom thÃ nh dropdown (báº¯t tay tá»« sÃ³ng nháº¡c)
- Má»Ÿ rá»™ng (6): 8/8 section cá»§a tool I-MZic (img-to-vid.html) Ä‘á»u chuyá»ƒn sang
  `<details>/<summary>` cÃ¹ng pattern: 1.Tá»‡p gá»‘c(secFiles) 2.Zoom theo nhá»‹p(secZoom)
  3.Hiá»‡u á»©ng bay(secEffect) 4.SÃ³ng nháº¡c(waveSection, tá»« láº§n trÆ°á»›c) 5.Äá»“ng bá»™ sá»›m
  (secLead) 6.FX toÃ n khung(secFx) 7.Khung hÃ¬nh(secFrame) 8.Lá»i .srt(secLyric).
  CSS `details.section > summary.section-title` tá»•ng quÃ¡t hoÃ¡ (khÃ´ng cÃ²n riÃªng sÃ³ng).
- Hint trÃªn má»—i tiÃªu Ä‘á» (element `<span class="hint2" id="<secId>Hint">`): secFiles
  = "áº¢nh âœ“/âœ— Â· Nháº¡c âœ“/âœ—" (Ä‘á»c state.imgFile/audioFile set Ä‘á»“ng bá»™ trong handler
  change); secZoom = "1.00â€“1.18x" (zoomMinâ€“zoomMax); secEffect/secFx/waveSection =
  text option select (Táº¯t/KhÃ´ng khi off); secLead = text `#v-lead`; secFrame =
  text ratioSel; secLyric = "N dÃ²ng"/"ChÆ°a cÃ³" (state.lyricsCues).
- JS má»™t cÆ¡ cháº¿ chung: SECTION_HINTS map id->hÃ m, refreshSectionHints() cháº¡y 1 láº§n
  sau loadSettings() + listener Cá»˜NG THÃŠM trÃªn control nguá»“n (khÃ´ng Ä‘á»¥ng listener
  cÅ©); loadLyricsFromText() gá»i refreshSectionHints() vÃ¬ lá»i khÃ´ng cÃ³ event riÃªng.
- Nhá»› má»Ÿ/Ä‘Ã³ng: 1 key JSON `imzic:sectionsOpen:v1` {secId:bool}, máº·c Ä‘á»‹nh ÄÃ“NG cho
  gá»n; key cÅ© `imzic:waveSectionOpen:v1` Ä‘Æ°á»£c Ä‘á»c chuyá»ƒn tiáº¿p cho waveSection náº¿u
  chÆ°a cÃ³ trong key má»›i (khÃ´ng máº¥t lá»±a chá»n ngÆ°á»i dÃ¹ng). Best-effort try/catch.
- LÆ°u Ã½ tooling: file img-to-vid.html cÃ³ mixed line endings (vÃ¹ng cÅ© CRLF, vÃ¹ng
  patch trÆ°á»›c LF); editor tool chá»‰ khá»›p anchor CRLF nÃªn 1 edit (Ä‘Ã³ng section 8)
  pháº£i vÃ¡ qua node script táº¡m (Ä‘Ã£ dá»n). ID field giá»¯ nguyÃªn 100% -> settings,
  state, IPC khÃ´ng Ä‘á»•i.
- Nghiem thu: script kiá»ƒm Ä‘á»‹nh cáº¥u trÃºc 8 details/8 summary/8 section-body/0 div
  section cÅ© + tháº» div cÃ¢n báº±ng depth=0 + node --check inline script PASS (script
  táº¡m Ä‘Ã£ dá»n); `npm run check` PASS (syntax 345, IPC 144/20, parity 0, shared 28/16).

## 2026-09-06 (7) - Kiem dinh sau I-MZic sau dropdown + FX (khong tim thay bug app)
- User yeu cau "check thu va kiem tra loi phat sinh" cho thay doi I-MZic (muc 5).
- Quet diff git: khong con tham chieu chip cu; `waveStyleField` chua tung co JS
  toggle an/hien (ca truoc va sau khi sua) -> khong pha gi.
- Smoke sau (Electron that, qua partition rieng): (B1) migration ban luu CU
  `{v:1, inputs, chips:{...}}` -> dung 100%: rain/left/on/spiral/landscape/off,
  density 120, canvas 1280; (B2) lan luot 6 FX chay render 400ms khong loi
  console; (B3) luu dinh dang moi (khong con `chips`, fxSel=vhs, ratio=portrait,
  fxLevel=100, canvas 720); (B4) reload phuc hoi dung vhs/100%/portrait/720.
- Chung minh pixel (nhan anh thuc qua duong file-input cua app bang DataTransfer
  + File tong hop): ca 6 FX deu cho hash pixel khac nhau va khac baseline "none";
  FX dong (glitch/vhs/noise) doi pixel qua khung; "none" on dinh. PASS.
- Phat hien quan trong VE KIEM THU (khong phai bug app): cua so an (show:false)
  lam rAF bi throttle ~1Hz -> FX nao khong duoc frame nao thi canvas giu trang
  thai FX truoc (hash "trung cap" gia). `paintWhenInitiallyHidden` KHONG du;
  phai dung cua so hien thi dat ngoai man hinh (x/y -2600) + showInactive.
  motionblur tren nen mau dong nhat = vo thieng (hinh hoc), chi hien tren anh co
  chi tiet - dung nhu thiet ke.
- Luu y khi viet script test: `location.reload()` trong executeJavaScript lam
  context bi huy -> promise khong resolve -> script treo vinh vien; phai dung
  `win.webContents.reload()` tu main + timeout an toan. Script tmp-* da xoa.
- `npm run check` PASS (IPC 144/20, parity 0, shared 28/16); 0 process Electron
  con lai cua repo.

## 2026-09-06 (8) - Cai dat (index.html): gan link "Lay Key â†—" cho 6 o API key
- Nguon canh: user hoi link lay API (YouTube phan tich doi thu / Whisper timing /
  stock Pexels-Pixabay) va khong thay cho de dan key tren UI. Kiem tra phat hien:
  trang Cai dat (tool-toolsettings) DA co du 4 nhom o nhap key (t11YtKey,
  setWhisperKey + setWhisperKeyOpenai, pexelsKey, pixabayKey, unsplashKey) voi
  ham save/populate tuong ung â€” chi thieu link lay key bam-la-mo.
- Thay doi: them <a target=_blank rel=noopener> "Láº¥y Key â†—" (float:right trong
  label, dung dung pattern style cua #getKeyLink san co) cho 6 o: YouTube
  (console.cloud.google.com/apis/credentials), Groq (console.groq.com/keys),
  OpenAI (platform.openai.com/api-keys), Pexels (pexels.com/api),
  Pixabay (pixabay.com/api/docs), Unsplash (unsplash.com/developers). Rieng
  YouTube them 2 link huong dan buoc: Enable YouTube Data API v3
  (console.cloud.google.com/apis/library/youtube.googleapis.com - bat buoc
  truoc khi key chay duoc) + Create Credentials â†’ API key.
- Chi sua index.html (renderer, global script â€” khong import/export, khong doi
  ID field, khong them JS, khong chan IPC/state) -> khong anh huong check:ipc /
  check:shared. Key sau khi dan van duoc luu ben qua novaStore sync
  nova-settings.json nhu truoc.
- Nghiem thu: `npm run check` PASS (syntax 347, IPC 147/20, parity 0,
  shared 28/16); grep xac nhan 6 link moi + 2 link buoc YouTube nam dung cho.

## 2026-09-06 (9) - "Lay Key â†—" mo duoc trinh duyet: bo sung EXTERNAL_LINK_HOSTS
- Van de: setWindowOpenHandler cua main window DENY tat ca link target=_blank
  (chi popup dang nhap AUTH_HOSTS duoc phep) -> bam "Lay Key â†—" khong co gi
  xay ra (dong ca link getKeyLink AI provider cu).
- Giai phap: them hang so EXTERNAL_LINK_HOSTS (regex suffix, dat canh AUTH_HOSTS
  trong nova/main/state.js â€” dung Luat 3 "hang so mot noi") gom 15 host lay key:
  console.anthropic/platform.openai/aistudio.google.com/console.cloud.google.com/
  platform.deepseek/openrouter/console.groq/console.mistral/dashboard.cohere/
  docs.perplexity/api.together.xyz/fireworks/pexels/pixabay/unsplash.
  window.js kiem EXTERNAL_LINK_HOSTS TRUOC AUTH_HOSTS roi shell.openExternal
  (mo trinh duyet mac dinh he thong, bat promise .catch) + deny (khong tao cua
  so trong app). Thu tu kiem QUAN TRONG: console.cloud.google.com va
  aistudio.google.com la subdomain google.com â€” neu AUTH_HOSTS khop truoc se bi
  mo nham popup dang nhap 500x660 trong app. Popup dang nhap (AUTH_HOSTS) giu
  nguyen; moi URL khac van deny + log nhu truoc.
- Khong them/doi kenh IPC, khong doi preload, khong sua renderer â€” chi
  state.js + window.js (main). Kiem thu rieng regex 15 host duong (khongæ¼)
  + 5 host am (khong false-positive: accounts.google.com, novastudio.com
  khong bi EXTERNAL bat) â€” ALL PASS.
- Nghiem thu: `npm run check` PASS (syntax 348, IPC 148/20, parity 0,
  shared 28/17). Luu y: so kenh IPC 147â†’148 va files 2294â†’2299 KHONG phai tu
  thay doi nay â€” do cac script nova/scripts/tmp-* cua session agent khac chay
  song song hom nay (14:27â€“14:51: tmp-patch-va-panel, tmp-va-panel-smoke,
  tmp-tdt-*, tmp-survey-tools, tmp-va-snippet-*) + niche/do-pha.js them kenh
  nova:niche:spike. Khong xoa file cua session khac.
- User can KHOI DONG LAI app (thoat + npm start / start.bat) de window.js moi
  co hieu luc â€” instance dang chay van giu behavior deny cu trong bo nho.


## 2026-09-06 (9) - Panel Video Agent (che Do): nhan du lieu tu tool khac + 2 luong render
nova/web/video-agent-panel.js (renderer, CRLF, da qua script node vi editor khong match):
- Buoc 1 them cum <details> ðŸ“¥ Nhan du lieu tu tool khac: doc state.script (Tao Kich Ban),
  state.scenes (Phan Canh, join \n\n thanh narration), t9State.result.titles[0] / #t9Title
  (YouTube SEO), _giongSu (Giong Noi â€” blob giu trong phien, ext mp3/wav theo blob.type),
  state.characterImages (Prompt Nhan vat & Boi Canh). state cua app bi panel che ten nen doc qua
  indirect eval (0,eval)('state'); _giongSu/t9State khong bi che. Chi DOC, khong ghi tool goc.
  Tool chua dung -> binding vang -> UI hien chÆ°a co (degrade khai bao, khong gia du lieu - Luat 10).
- Buoc 3 them checkbox pipeline day du 17 buoc: tu BAT khi nhan giong doc (user bo tick duoc),
  auto-render rieng bi khoa khi pipeline bat. Luong chay runEasyPipeline(): pickFolder -> gom
  thu muc du an chuan Â§4 (script/script.md bat buoc, tts/voice.<ext> khi co giong doc, images/
  tu characterImages + assets B2 (copy qua readFileB64), config.json {title}) -> videoAgent.run
  { projectDir, options:{skipPreview:false} }. Toan bo ghi qua native.saveFile/pickFolder co san â€”
  KHONG them IPC moi (Luat 1). b64 UTF-8 qua TextEncoder+btoa, blob qua arrayBuffer+chunk 0x8000.
- videoAgent:event: 1 listener duy nhat o init, dispatch theo state.easyPipeline -> UI De
  (onEasyVaEvent: log + progress Buoc 3) hay UI Nang cao (onAdvEvent nhu cu).
- runEasy restructure: kiem narration + dispatch pipeline TRUOC khi can doc() bridge.
- Kiem dinh: node --check OK; npm run check PASS (syntax 350, IPC 147/20, parity 0, shared 28/16);
  npm run test:video-agent PASS (114 test + bridge + behavior + gateway); smoke fake-DOM
  nova/scripts/tmp-va-panel-smoke.js PASS 16 assert (do kich ban, nhan giong doc -> checkbox tu bat,
  thu muc Â§4 that tren dia: script.md/tts/voice.mp3/images/minh.png/config.json, payload run dung).
  Script tmp-* (survey/patch/snippet/smoke) de theo conventions tmp-.


## 2026-09-06 (10) - Panel Video Agent (De): UI refresh khac biet (hero + rail + the nguon + the luong)
nova/web/video-agent-panel.js + nova/web/index.html (style block #tool-toolvideoagent), ca hai CRLF,
va lai qua 5 script node (nova/scripts/tmp-va-ui-{a,b,c,d,fix}.js + tmp-va-ui-css{1,2}.js) vi editor
tool khong match CRLF. CHI DOI MARKUP + CSS, hanh vi/giao thuc giu nguyen:
- buildEasy: them banner va-hero (gradient + badge NOVA VIDEO AGENT + chips) va thanh tien trinh
  va-rail 4 nut (Lá»i thoáº¡i / áº¢nh / Táº¡o video / Xem video) â€” setStepState dong bo class active/done
  va dau âœ“ len rail node tuong ung. Hero/rail nam TRONG easyBox (root van [notice, tabs, easyBox,
  advBox] â€” smoke phu thuoc children[2]).
- Cum ðŸ“¥ Nhan du lieu: details class moi va-import, summary co badge dem so nguon san sang
  (renderImportBox dem card class .ok trong importBody). importRow chuyen tu dong va-check-row
  thanh the va-src (icon vuong mau, ten, trang thai xanh khi co nut Dung / mo khi chua co).
  appendVoiceImport: the va-src ok wide chua select + nut Nhan (giu nguyen text nut de smoke tim).
- Buoc 3: 2 checkbox GIU NGUYEN (smoke can dung 2 checkbox, autoRender co attr checked) nhung
  wrap thanh 2 the luong va-flow: Nhanh (div, bam = tat pipeline + mo khoa auto-render, ho tro
  keydown Enter/Space) va Pipeline day du (label checkbox an, bam = tick). syncFlowCards()
  (module-level) toggle class .on; goi o listener checkbox, appendVoiceImport (nhan giong doc
  tu chuyen sang Pipeline) va cuoi buildEasy.
- Nut run them class va-cta (gradient + glow, full width). CSS ~120 dong chen sau dong @media
  cuoi cua style block (web khong co build step â€” CSS nam trong index.html, class va-*).
  Tab chuyen thanh segmented control (ap dung ca tab Nang cao â€” nhat quan).
Loi gap: new_text cua editor tool NUOT ky tu backslash khi tao script patch C (\s thanh s) â†’
  regex badge badge thanh /s+/; da sua lai bang split khoang trang. Lan sau: tranh backslash
  trong script patch tao qua editor, hoac kiem tra lai file sau khi tao.
Kiem dinh: tmp-va-panel-smoke PASS 21/21 (them assert hero/rail/2 the luong/5 the nguon/badge=5);
npm run check PASS (syntax 362, IPC 148/20, parity 0, shared 28/17); npm run test:video-agent
PASS (42+56+16, IPC/bridge OK). Khong them IPC, khong doi state key.

## 2026-09-06 (11) - "Lay Key â†—" van bi copy link: RENDERER chan click TRUOC main
- User bao: bam "Láº¥y Key â†—" (vd console.groq.com/keys) â†’ app hien toast "App khÃ´ng
  má»Ÿ cá»­a sá»• ngoÃ i â€” Ä‘Ã£ sao chÃ©p liÃªn káº¿t". Fix main (má»¥c 9) KHÃ”NG Ä‘á»§: sá»± kiá»‡n
  window-open khÃ´ng bao giá» tá»›i main vÃ¬ RENDERER cháº·n ngay tá»« click.
- Root cause: `nova/web/index.html` cÃ³ document-level capture click handler
  (dÃ²ng ~6568) báº¯t Má»ŒI `a[target="_blank"]`, `preventDefault`+`stopPropagation`
  rá»“i `novaCopyLink()` (copy clipboard + toast) â€” chá»‰ host khá»›p
  `NOVA_AUTH_LINK_HOSTS` (dÃ²ng 6526, mirror AUTH_HOSTS: accounts.google.com/
  google.com/firebaseapp.com/novastudio.com) Ä‘Æ°á»£c Ä‘i qua. ÄÃ¢y lÃ  hÃ nh vi cÅ©
  cÃ³ chá»§ Ä‘Ã­ch (link ngoÃ i khÃ¡c váº«n copy nhÆ° cÅ© â€” GIá»® NGUYÃŠN).
- Fix: thÃªm regex `NOVA_GET_KEY_LINK_HOSTS` (dÃ²ng ~6532, 15 host â€” copy Y NGUYÃŠN
  EXTERNAL_LINK_HOSTS cá»§a `nova/main/state.js`) + trong click handler kiá»ƒm
  get-key TRÆ¯á»šC auth rá»“i `return` (khÃ´ng preventDefault) â†’ click Ä‘i qua â†’
  main `setWindowOpenHandler` (Ä‘Ã£ sá»­a má»¥c 9) má»Ÿ shell.openExternal. Renderer
  chá»‰ NGá»ªNG cháº·n; viá»‡c má»Ÿ trÃ¬nh duyá»‡t ngoÃ i/popup/deny váº«n do main quyáº¿t Ä‘á»‹nh.
- Thá»© tá»± & Ä‘á»“ng bá»™ QUAN TRá»ŒNG: console.cloud.google.com / aistudio.google.com
  khá»›p Cáº¢ get-key láº«n auth (subdomain google.com) â€” cáº£ renderer láº«n main Ä‘á»u
  kiá»ƒm get-key TRÆ¯á»šC nÃªn má»Ÿ Ä‘Ãºng trÃ¬nh duyá»‡t ngoÃ i. Khi thÃªm host má»›i: sá»­a
  Äá»’NG THá»œI EXTERNAL_LINK_HOSTS (main/state.js) + NOVA_GET_KEY_LINK_HOSTS
  (web/index.html) â€” khÃ´ng cÃ³ check tá»± Ä‘á»™ng Ã©p Ä‘á»“ng bá»™ (Ä‘Ã£ test thá»§ cÃ´ng).
- Kiem dinh: script tmp so khop 2 regex trÃªn 20 host (15 duong + 5 am) â†’
  0 mismatch, IN SYNC; `npm run check` PASS (syntax 362, IPC 148/20, parity 0,
  shared 28/17). Script tmp-linkscan da xoa. Chi sua index.html renderer.
- User van phai KHOI DONG LAI app de nap láº¡i renderer + main moi (Ctrl+R
  renderer Ä‘á»§ cho pháº§n nÃ y vÃ¬ cáº£ 2 thay Ä‘á»•i náº±m trong file renderer láº«n main â€”
  main window.js/state.js cá»§a má»¥c 9 cáº§n restart tiáº¿n trÃ¬nh).


## 2026-09-06 (11) â€” Video Agent cháº¿ Ä‘á»™ Dá»…: sá»­a láº¡i framing "láº¯p rÃ¡p nguyÃªn liá»‡u sáºµn cÃ³"
User phanh pha: Video Agent KHÃ”NG pháº£i tool viáº¿t lá»i thoáº¡i â€” nÃ³ nháº­n cÃ¡c Ä‘áº§u ra sáºµn
cÃ³ cá»§a tool phÃ­a trÃªn (ká»‹ch báº£n, TTS + timestamps/SRT, prompt áº£nh, áº£nh Ä‘Ã£ táº¡o tá»«
prompt) rá»“i chia cáº£nh theo timeline TTS vÃ  xáº¿p áº£nh. ÄÃºng pipeline tháº­t Â§4
(project/discover.js: script/ báº¯t buá»™c, tts/ audio+json timestamps, images/).
nova/web/video-agent-panel.js â€” chá»‰ Ä‘á»•i nhÃ£n/thÃªm 1 nguá»“n nháº­p, khÃ´ng Ä‘á»•i hÃ nh vi:
- Hero: "Táº¡o video faceless trong 4 bÆ°á»›c" â†’ "Láº¯p rÃ¡p video faceless trong 4 bÆ°á»›c";
  sub nÃ³i rÃµ nháº­n ká»‹ch báº£n/TTS/áº£nh tá»« tool phÃ­a trÃªn, Agent chia cáº£nh theo timeline
  giá»ng Ä‘á»c; chips â†’ Ká»‹ch báº£n Ä‘Ã£ cÃ³ / Giá»ng Ä‘á»c TTS lÃ m Ä‘á»“ng há»“ / áº¢nh Ä‘Ã£ táº¡o tá»« prompt.
- RAIL_LABELS[0] + stepCard(1): "Viáº¿t lá»i thoáº¡i" â†’ "Nháº­n nguyÃªn liá»‡u"; label Ã´ nháº­p
  thÃ nh "Ká»‹ch báº£n / lá»i thoáº¡i (narration)", placeholder lÃ  nÆ¡i DÃN náº¿u chÆ°a nháº­n
  tá»« tool trÃªn; guard runEasy Ä‘á»•i thÃ´ng bÃ¡o tÆ°Æ¡ng á»©ng.
- Import box: summary "Nháº­n dá»¯ liá»‡u tá»« tool khÃ¡c trong app" â†’ "Nháº­n dá»¯ liá»‡u tá»« cÃ¡c
  tool phÃ­a trÃªn"; thÃªm tháº» nguá»“n Má»šI "áº¢nh cáº£nh Ä‘Ã£ táº¡o (tool PhÃ¢n Cáº£nh Â· Prompt
  áº£nh)" Ä‘á»c state.sceneImages (binding global cá»§a index.html, read-only qua
  appGlobals â†’ eval('state'), cÃ¹ng shape {base64, mediaType, fileName?} nhÆ°
  characterImages) â†’ nÃºt DÃ¹ng push vÃ o state.importedImages â†’ runEasyPipeline ghi
  images/canh-<id>.png. Giá» badge Ä‘áº¿m tá»‘i Ä‘a 6 nguá»“n.
- BÆ°á»›c 2/3: mÃ´ táº£ láº¡i theo hÆ°á»›ng xáº¿p áº£nh theo timeline giá»ng Ä‘á»c (TTS master clock).
Kiem Ä‘á»‹nh: tmp-va-panel-smoke cáº­p nháº­t (state giáº£ thÃªm sceneImages '001', assert
details text má»›i, 6 tháº» nguá»“n, badge=6, click DÃ¹ng áº£nh cáº£nh, verify
images/canh-001.png ghi ra Ä‘Ä©a) â€” PASS 22/22; npm run check PASS (syntax 361,
IPC 148/20, parity 0, shared 28/17); npm run test:video-agent PASS (42+56+16,
IPC/bridge OK). KhÃ´ng thÃªm IPC, khÃ´ng Ä‘á»•i state key, khÃ´ng cháº¡m main process.

## 2026-09-06 (12) â€” Panel Video Agent (De): Gá»  Ã” "TiÃªu Ä‘á»" khá»i BÆ°á»›c 1
User chon phuong an: title khong con la o nhap tay â€” chi nhan qua the nguon
"TiÃªu Ä‘á» (tool YouTube SEO)" / mo du an da luu / vi du mau; chua nhan thi
pipeline TU DAT TEN tu dong dau kich ban. nova/web/video-agent-panel.js:
- XoÃ  ui.titleInput (khai bÃ¡o + Ã´ input va-label á»Ÿ BÆ°á»›c 1). Thay bang bien
  closure `easyTitle` (khai bÃ¡o cáº¡nh SAMPLE_TITLE, KHÃ”NG thÃªm state key â€”
  check:shared khÃ´ng bá»‹ áº£nh hÆ°á»Ÿng).
- `easyProjectTitle()` (helper moi, Ä‘áº·t cáº¡nh fillSample): easyTitle â†’ dÃ²ng Ä‘áº§u
  ká»‹ch báº£n (cap 60 kÃ½ tá»±) â†’ fallback 'Video'. DÃ¹ng chung cho runEasy
  (bridge.create.title + log) va runEasyPipeline (Ä‘áº§u trang script.md + config.json).
- The nguon YouTube SEO: click "DÃ¹ng" â†’ `easyTitle = seoTitle` + notice moi;
  fillSample â†’ easyTitle = SAMPLE_TITLE; openEasyProject â†’ easyTitle =
  project.title. Va-lbl "TiÃªu Ä‘á»" trong BÆ°á»›c 1 bá»‹ xoÃ¡ â€” BÆ°á»›c 1 giá» chá»‰ cÃ²n
  "Ká»‹ch báº£n / lá»i thoáº¡i (narration)" (nguyÃªn liá»‡u báº¯t buá»™c Â§4).
Kiem dinh: smoke them assert "0 input text trong easyBox" â€” PASS 23/23
(script.md '# TiÃªu Ä‘á» SEO hay' + config.json title van dung nhan tu the nguon);
npm run check PASS (syntax 360, IPC 148/20, parity 0, shared 28/17).
Khong them IPC, khong doi state key, khong cham main process.

- [2026-09-06] Niche Finder â€” ná»‘i dÃ¢y 3 subtool bÃ¬nh luáº­n/theo dÃµi/so sÃ¡nh
  (web UI â†’ preload â†’ IPC â†’ dispatcher): `ipc-niche.js` thÃªm 3 kÃªnh
  `nova:niche:comments` (N.commentMining), `nova:niche:watchlist` (action
  list/add/remove/tick â†’ watchlistList/Add/Remove/Tick), `nova:niche:compare`
  (N.compareChannels vá»›i máº£ng channels); `niche/index.js` xuáº¥t thÃªm
  commentMining + 4 hÃ m watchlist + compareChannels. preload.js Ä‘Ã£ cÃ³ sáºµn 3
  bridge `window.native.niche.{comments,watchlist,compare}` nÃªn chá»‰ ná»‘i backend.
  Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS (syntax 365, IPC 151/20, parity 0, shared
  28/17) â€” exit 0. KhÃ´ng Ä‘á»•i tÃªn kÃªnh cÅ©, khÃ´ng cháº¡m main process. UI khÃ´ng gá»i
  3 method nÃ y báº±ng tÃªn tÄ©nh (tham chiáº¿u Ä‘á»™ng) nÃªn chÆ°a verify payload shape
  runtime; cáº§n test thá»§ cÃ´ng tá»«ng subtool khi cÃ³ dá»¯ liá»‡u tháº­t.

- [2026-09-06] NOVA Video Agent â€” tÃ­ch há»£p há»c há»i tá»« repo ngoÃ i
  `khanhtran0393/seedance-2.0` (skill pack Seedance 2.0) mÃ  KHÃ”NG phÃ¡ vá»¡ há»‡
  thá»‘ng Ä‘ang cháº¡y â€” giá»¯ nguyÃªn Luáº­t 8 (deterministic, AI chá»‰ chá»n preset):
  1. ThÃªm `script/directing-read.js` â€” Directing Read heuristic (há»c "Director's
     Read"): phÃ¢n loáº¡i lane narrative/non-narrative (CTA/demo khÃ´ng bá»‹a drama),
     map mood â†’ carriers (camera/light/behavior bias) dáº¡ng metadata bá»• sung.
     NguyÃªn táº¯c "carriers not labels": khÃ´ng Ä‘Æ°a nhÃ£n cáº£m xÃºc vÃ o render.
  2. ThÃªm `story/continuity.js` â€” Continuity Ledger deterministic (há»c
     "continuity locks"): ghi nháº­n nhÃ¢n váº­t `new/continued` giá»¯a cÃ¡c scene +
     screenDirection `left-to-right`, giÃºp lá»›p visual plan trÃ¡nh Ä‘á»•i diá»‡n máº¡o
     nhÃ¢n váº­t giá»¯a cÃ¡c scene liá»n ká».
  3. Sá»­a `story/plan.js` â€” enrich metadata: má»—i scene thÃªm field `directing`,
     story plan thÃªm field `continuity`. Chá»‰ THÃŠM field má»›i, giá»¯ nguyÃªn má»i
     field cÅ© (khÃ´ng phÃ¡ consumer Â§1). Lazy-require trÃ¡nh vÃ²ng require (Â§5).
  4. Sá»­a `auto-fix/loop.js` â€” thÃªm `classifyFixStrategy()` (há»c "retake
     protocol"): phÃ¢n loáº¡i fix theo táº§ng keep/fix-in-post/edit/re-roll thay vÃ¬
     retry mÃ¹. KHÃ”NG Ä‘á»•i hÃ nh vi applyFixes, chá»‰ thÃªm metadata cho UI/history.
  Kiá»ƒm Ä‘á»‹nh: `npm run check` PASS (syntax 369, IPC 154/20, parity 0, shared
  28/17); `npm run test:video-agent` PASS (42+56+16 = 114 test, 0 FAIL). KhÃ´ng
  thÃªm IPC, khÃ´ng Ä‘á»•i state key, khÃ´ng cháº¡m main process. ChÆ°a tiÃªu thá»¥ cÃ¡c
  field má»›i (`directing`, `continuity`, `classifyFixStrategy`) á»Ÿ táº§ng visual
  plan/UI â€” cáº§n ná»‘i dÃ¢y tiáº¿p khi muá»‘n dÃ¹ng thá»±c cháº¥t.

- [2026-09-06] NOVA Video Agent â€” **ná»‘i dÃ¢y `directing` vÃ  `continuity` vÃ o táº§ng visual plan**,
   hoÃ n táº¥t tÃ­ch há»£p há»c há»i tá»« seedance-2.0:
   1. **`visual-plan/plan.js`**: `pickCharacters` giá» tÃ¡i dÃ¹ng nhÃ¢n váº­t cáº£nh trÆ°á»›c
      (`continuity.locks.characters`) khi cáº£nh hiá»‡n táº¡i khÃ´ng khai bÃ¡o rÃµ â€” trÃ¡nh
      Ä‘á»•i diá»‡n máº¡o Ä‘á»™t ngá»™t giá»¯a cáº£nh liá»n ká» (há»c "continuity locks").
   2. **`visual-plan/plan.js`**: `visualsFor` nháº­n `ctx.directing` vÃ  dÃ¹ng
      `cameraBias` tá»« mood carrier Ä‘á»ƒ chá»n preset camera (náº¿u há»£p lá»‡ qua
      `grammar.isCamera`), váº«n Ä‘áº£m báº£o deterministic & khÃ´ng sinh tá»± do (Luáº­t 8).
   3. **`auto-fix/loop.js`**: thÃªm `summarizeStrategies()` gá»™p chiáº¿n lÆ°á»£c fix
      thÃ nh Ä‘áº¿m `{keep, fix-in-post, edit, re-roll}`; ghi `strategies` vÃ o má»—i
      entry trong `history` (cáº£ láº§n Ä‘áº§u vÃ  má»—i attempt) Ä‘á»ƒ UI/history hiá»ƒn thá»‹ Ä‘Æ°á»£c.
   Kiá»ƒm Ä‘á»‹nh: `npm run check:syntax` PASS (369 files); `npm run test:video-agent`
   PASS (114 tests, 0 FAIL). KhÃ´ng Ä‘á»•i IPC/state/main-process; má»i thay Ä‘á»•i lÃ 
   additive metadata hoáº·c tiÃªu thá»¥ field Ä‘Ã£ cÃ³, giá»¯ nguyÃªn há»£p Ä‘á»“ng Â§1.

- [2026-09-06] SRT Translate â€” **Ä‘á»•i engine dá»‹ch sang Google AI Studio (Gemini) lÃ m máº·c Ä‘á»‹nh + song song hÃ³a lÃ´**:
  1. `nova/editor-pro/niche/loi.js`: `claude(sys, content, opts)` nháº­n thÃªm tham sá»‘
     thá»© 3 ghi Ä‘Ã¨ `api_provider`/`api_model`/`api_base_url` tá»« caller â€” KHÃ”NG Ä‘á»•i
     há»£p Ä‘á»“ng cÅ© (cÃ¡c caller hiá»‡n há»¯u váº«n gá»i 2 tham sá»‘ nhÆ° trÆ°á»›c).
  2. `nova/srt-translate/engine.js`: thÃªm báº£ng `MODELS` (`gemini-2.5-flash-lite`
     máº·c Ä‘á»‹nh, `claude-haiku-4.5` dá»± phÃ²ng); `translateCues()` cháº¥p nháº­n
     `opts.model` + `opts.maxConcurrent`, chuyá»ƒn vÃ²ng `for` tuáº§n tá»± thÃ nh worker
     pool song song (giá»›i háº¡n concurrency, máº·c Ä‘á»‹nh 3, clamp 1â€“10); `batchSize`
     máº·c Ä‘á»‹nh giáº£m 30 â†’ 15 Ä‘á»ƒ giáº£m payload má»—i láº§n gá»i.
  3. `nova/srt-translate/ipc.js`: truyá»n `p.model` + `p.maxConcurrent` xuá»‘ng engine.
  4. `nova/web/srt-translate-panel.js`: thÃªm dropdown Model AI (Gemini máº·c Ä‘á»‹nh /
     Claude) + input "LÃ´ song song (1â€“10)"; state máº·c Ä‘á»‹nh `model:'gemini'`,
     `batchSize:15`, `maxConcurrent:3`; truyá»n 2 tham sá»‘ má»›i khi gá»i `translate`.
  5. `nova/editor-pro/niche/loi.js`: Ä‘á»•i `claude()` sang clone config (`Object.assign({},
     _KHO())`) trÆ°á»›c khi override provider/model/baseUrl (`opts`) Ä‘á»ƒ khÃ´ng
     Ä‘á»™t biáº¿n state cÃ i Ä‘áº·t toÃ n cá»¥c.
  Kiá»ƒm Ä‘á»‹nh: `node --check` 5 file PASS; `npm run check` PASS (syntax 374 files,
  IPC 158/20, parity 0, shared 28 file/17 key). KhÃ´ng Ä‘á»•i kÃªnh IPC/state key.
  CÃ²n treo: chÆ°a test runtime vá»›i key Gemini tháº­t + chÆ°a Ä‘o rate limit thá»±c táº¿ Ä‘á»ƒ
  hiá»‡u chá»‰nh `maxConcurrent` (dá»± kiáº¿n 2â€“3Ã— nhanh hÆ¡n, 100 dÃ²ng ~15â€“20s â†’ ~5â€“8s).

- [2026-09-07] Nghiên cứu Ngách (Niche Finder) — sửa lỗi renderer bị hỏng do ghép sai `nfRenderSpike`:
  Nguyên nhân: 4 hàm render mới (`nfRenderPain`, `nfRenderForecast`, `nfRenderKeywords`,
  `nfRenderBreakdown`) bị chèn vào giữa thân `nfRenderSpike` → mất cân bằng dấu `{}`
  → parser JS lỗi → toàn bộ nút trong tool Niche Finder tắt hoàn toàn.
  Fix: thay nguyên khối từ `function nfRenderSpike(r){` đến trước `function
  _nfRegIdea(idea){` bằng `nfRenderSpike` hoàn chỉnh + 4 hàm render mới đặt sau
  (script Python thay theo dòng, tránh lỗi quoting PowerShell/Node); xoá 1 dòng
  thừa `document.getElementById('nfForecastState') && ...`.
  Kiểm định: `npm run check` PASS (syntax); đếm mỗi hàm render tồn tại đúng 1 lần.
  Còn treo: chưa test runtime 4 panel mới (Pain Point / Forecast / Keywords /
  Breakdown) và nút “Làm video này” — cần kiểm thử thủ công trên app.
- [2026-09-07] Niche Finder – cho phép bỏ trống ô từ khóa (tự động lấy hot):
  - Frontend (`nova/web/index.html`): bỏ kiểm tra seed rỗng trong `nfRun`, cho phép gửi seed rỗng xuống backend.
  - Backend (`nova/editor-pro/ipc-niche.js`): 7 handler (`attention`, `hot`, `spike`, `pain`, `forecast`, `keywords`, `breakdown`) thay vì báo lỗi, tự động gán seed = `"hot"` nếu seed rỗng.
  - Kiểm định: `npm run check` chỉ báo lỗi syntax ở file khác (`video-agent/project/import.js`), không ảnh hưởng đến thay đổi này.
  - Còn treo: cần kiểm thử runtime thủ công trên app: để trống ô từ khóa, bấm các nút và xác nhận hiển thị kết quả hot/trending.

- [2026-09-07] Voice prewarm — fix backend không nhận engine frontend gửi lên (giảm latency
  lần đọc đầu của giọng clone):
  Frontend `nova/web/index.html` (`voicePrewarm`, dòng ~9474) gọi
  `POST /api/prewarm` với `Content-Type: application/json` + body `{"engine": eng}`,
  nhưng backend canonical `nova/voice-backend/backend/app.py` khai báo
  `def api_prewarm(body: dict = None):` — FastAPI coi tham số `dict` trần là query
  param, KHÔNG parse JSON body → `body` luôn `None` → chỉ nạp engine mặc định, không
  nạp engine đang chọn. Fix: import `Body` và đổi thành
  `def api_prewarm(body: dict = Body(default=None)):` (giữ nguyên behaviour khi không
  body → fallback `config.TTS_ENGINE`).
  Kiểm định: `npm run test:voice` PASS; đã dọn `__pycache__` + không còn file
  `tmp-*.py`. Endpoint prewarm + timings (`queue_wait_ms`/`chunking_ms`/`synth_total_ms`/
  `total_ms` trong `/api/status`) đã có từ bước trước.
  Đã test runtime (TestClient, venv `.venv-omni`): OpenAPI route giờ có `requestBody`
  JSON (trước là query param); `no-body`/`{}` → fallback `mock` (200); `{"engine": ...}`
  → body được parse đúng (response trả đúng tên engine). Lưu ý: `_resolve_tts_engine`
  có fallback nội bộ nên engine tên lạ KHÔNG raise 400 mà trả 200 với engine đã fallback
  (behavior có sẵn, ngoài scope fix này).
  Còn treo: chưa chạy backend thật (uvicorn) để đo `timings` giảm cold-start trên giọng clone.

- [2026-09-07] Sửa lỗi syntax phát sinh ngoài scope (phát hiện khi chạy `npm run check`):
  `nova/video-agent/project/import.js` dòng 106 — hàm `analyzeScriptFromData` (trong
  `createScriptAnalyzerForImport`) dùng `await Promise.all(...)` ở dòng 134 nhưng khai báo
  hàm thường (không `async`) → parser `node --check` fail → toàn bộ `npm run check` exit 1.
  Fix tối thiểu: đổi `return function analyzeScriptFromData(...)` → `return async function
  analyzeScriptFromData(...)`. Không đổi hợp đồng `module.exports`, không thêm log/dependency.
  Kiểm định: `npm run check` PASS (syntax 374 file, IPC 158/20, parity 0, shared 28/17);
  `npm run test:voice` PASS. File này nằm ngoài scope voice-prewarm nhưng cần sửa để repo
  xanh lại `check`.
- [2026-09-07] API key Flow — thêm ô nhập + nút "Lấy Key ↗" (mục "🔌 Tài khoản Flow"):
  - UI (`nova/web/index.html`, panel KẾT NỐI): label "API Key Flow (dùng chung)", link
    "Lấy Key ↗" → https://aistudio.google.com/apikey, input password `#flowApiKey`,
    nút "💾 Lưu" → `saveFlowApiKey()`, status `#flowApiKeyStatus`.
  - Script quản lý (global script, đặt trước `</body>`): đọc key từ
    `window.novaStore.seed["api_key_flow"]` (fallback localStorage `flowApiKey`), lưu qua
    `window.novaStore.set("api_key_flow", key)`.
  - Phát hiện quan trọng: `window.novaStore` (preload.js) CHỈ có `seed`/`set`/`del`,
    KHÔNG có `get`; `set` dùng `sendSync` trả boolean (đồng bộ), không trả Promise. Bản
    script đầu giả định `.get().then()` là SAI — đã sửa về dùng `seed` + `set` đồng bộ.
  - Sửa vị trí: block script đầu bị chèn nhầm vào giữa `<label id="t7ExpGpuRow">`
    (phá cấu trúc HTML), đã gỡ và chèn lại trước `</body>`.
  - Dọn: xóa file rác `ova/web/index.html` (do edit path sai ở phiên trước).
  - Kiểm định: `npm run check` PASS (syntax 374, IPC 158/20, parity 0, shared 28/17).

- [2026-09-07] API key Flow — cho phép nhập nhiều key, mỗi key một dòng:
  - UI (`nova/web/index.html`): đổi `<input type="password">` thành `<textarea rows="4">`
    (resize vertical, placeholder "Mỗi key một dòng…").
  - Script: khi lưu, tách theo newline, `trim` từng dòng, bỏ dòng rỗng, nối lại bằng `\n`
    rồi ghi qua `window.novaStore.set("api_key_flow", ...)`; khi load thì đếm số key để
    hiển thị "Đã tải N key". Status hiển thị số key đã lưu/tải.
  - Khoá vẫn là 1 chuỗi duy nhất (các key cách nhau bởi newline) trong settings store —
    giữ nguyên hợp đồng `api_key_flow` là string, không tạo consumer mới.
  - Kiểm định: `npm run check` PASS (syntax 374, IPC 158/20, parity 0, shared 28/17).

