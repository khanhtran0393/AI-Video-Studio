# Nova main process — kiến trúc module

`main.plain.js` (137 dòng) giờ chỉ là **composition root** (điểm lắp ráp): nạp các
module, lắp các sự kiện vòng đời của app, không chứa logic nghiệp vụ.

```
main.plain.js  ──┬── main/identity.js      app.setName / setAppUserModelId / userData dir
                  ├── main/state.js         trạng thái dùng chung (mainWindow, localServer, isQuitting…)
                  ├── main/global-errors.js uncaughtException / unhandledRejection → hộp lỗi tiếng Việt
                  ├── main/error-reporter.js  error reporter (opt-in qua AI_VIDEO_STUDIO_ERROR_REPORTING=1)
                  ├── main/menu.js          buildMenu()
                  ├── main/splash.js        createSplashWindow / closeSplashWindow (min display ≥5s)
                  ├── main/server.js        resolveStartUrl() — local server 127.0.0.1, port 47280–47283
                  ├── main/window.js        createWindow() (show sau khi load, selectAll có điều kiện)
                  ├── main/updater.js       setupAutoUpdate() (chỉ khi AI_VIDEO_STUDIO_ENABLE_UPDATES=1)
                  ├── main/lifecycle.js     shutdownOwnedResources() — timer auto-push, bridges, voice,
                  │                         watermark, closeGuestCaptcha (idempotent)
                  └── main/ipc/index.js     registerAllIpc() — gọi một lần TRƯỚC app.whenReady()
                        ├── ipc/flow.js        flow, flow-cft-*, flowChrome, flow-push-ext, flowExt,
                        │                     flowBridgeStatus, flow-ext-export + autoPushExt (15s/40p)
                        ├── ipc/native-tools.js render-video, ffmpeg-info, render-video-cancel
                        ├── ipc/upscale.js    upscale-*, nova:parallaxClip, wm-inpaint, open-path
                        ├── ipc/llm.js        llm-fetch, tts-fetch (đi qua main để tránh CORS)
                        ├── ipc/files.js      read-file-b64, pick-folder, pick-media-file, save-file
                        ├── ipc/voice.js      voice-* (OmniVoice) + onLog → 'voice-log'
                        ├── ipc/watermark.js  wm-* (WatermarkRemover-AI) + onLog → 'wm-log'
                        └── ipc/system.js     login-window, sys-stats, app-version, export-dir,
                                              update-download, update-install
```

## Module hỗ trợ trong `main/` (không được root nạp trực tiếp)

- `brand.js` — tên/mã nhận diện thương hiệu (dùng bởi identity).
- `fs-utils.js` — helper đường dẫn asar-unpacked, cpSync an toàn.
- `friendly-errors.js` — dịch lỗi ENOSPC/EACCES/EROFS sang tiếng Việt.

## IPC đăng ký NGOÀI `main/ipc/` (giữ nguyên như cũ)

- `storage/settings-store.js` → `registerSettingsIpc` (kho API key, sendSync).
- `auto-fix/client-error-reporter/electron-bridge.js` → `registerElectronErrorBridge`.
- `editor-pro/register.js` → `registerEditorPro` (464 kênh `documentary:*`/`videoAgent:*`…,
  gọi từ root tại `app.whenReady`, dùng userDataDir riêng tư). Lưu ý: UI cũ
  `editor.html` + `style.css`/`editor.css`/`nova-theme.css` + `assets/cursors/`
  đã **GỠ** (MEMORY 2026-09-10o — trang mồ côi: 254/257 tài nguyên tham chiếu
  không tồn tại, không loader nào mở nó); register.js chỉ còn phục vụ IPC.

## Bridge cục bộ (khởi động trong `ipc/index.js`, dọn dẹp trong `lifecycle.js`)

- CLI bridge (8795/8796), MCP bridge (8794), Flow extension bridge (flow-bridge.plain).

## Các thư mục extension Chrome — ai là NGUỒN, ai là OUTPUT

| Thư mục | Vai trò |
|---|---|
| `nova/flow-extension/` | **NGUỒN** chính (chỉnh sửa ở đây). `flow-ext-export` cpSync sang `<app>/chrome-extension` để user "Tải tiện ích chưa đóng gói" vào Chrome. Ship qua `scripts/sync-extension.mjs`. |
| `nova/nova-studio/` | **BIẾN THỂ CÓ CHỦ Ý** của flow-extension (logic captcha/aborted khác) — README sync-extension ghi rõ "KHÔNG copy chéo giữa 2 dòng extension". Chỉnh sửa độc lập. |
| `nova/chrome-extension/` | **OUTPUT runtime** (dev) — được sinh bởi IPC `flow-ext-export`, Chrome tự thêm `_metadata/` khi load. Đã `.gitignore` + untrack; KHÔNG coi là nguồn, KHÔNG edit tay. |

Tương tự, `flow-chrome.js` (điều khiển Chrome đa profile — `flowChrome.handle(...)`) và `flow-native.js` (BrowserWindow Electron đa profile — `flowNative.handle(...)`) là **2 module khác nhau**, không phải bản sao của nhau — cả hai được `main/ipc/flow.js` require song song.

## Web renderer — tách file lớn thành thư mục script thường

Renderer không có build step nên mọi file là **script thường (KHÔNG module)**:
tên cấp đầu dùng chung toàn cục, chỉ thứ tự nạp trong HTML là ràng buộc. Không
dùng import/export ở đây.

### `web/nguon-web/` (từ `nguon-web.js` 1.086 dòng, nạp trong `index.html`)

| File | Nội dung |
|---|---|
| `nguon-web/nen-tang.js` | Sổ 55 nền tảng (`NOVA_WEB_NEN_TANG`), nhóm, luật lọc URL, giấy phép cấm. |
| `nguon-web/ha-tang.js` | Phanh nhịp `_WEB_NHIP`, bộ nhớ đệm `_webNho`, cầu nối main `_webNative`, HTTP `_webGet`/`_webJson`. |
| `nguon-web/api.js` | `_WEB_API` — 5 API tìm riêng (archive, wikimedia, dailymotion, peertube, ytdlp). |
| `nguon-web/tim-web.js` | Tìm web lùi về (DDG/Bing/Brave/SearXNG), khoá API tìm kiếm, `_webTimQuaCongCu`. |
| `nguon-web/bang.js` | Bảng chọn nền tảng + kiểm tra + vẽ (`webMoBang`, `webKiemTra`, `webRenderBang`…). |
| `nguon-web/chinh.js` | `searchWebSources`, `webLayClip`, `webNhan` + xuất tên ra `window`. |

Thứ tự nạp: nen-tang → ha-tang → api → tim-web → bang → chinh. Khi thêm file
mới phải giữ nguyên tính chất "script thường, tên global" — renderer không có
build step nên không dùng import/export ở đây.

### `web/fractal-engine/` (từ `fractal-engine.js` 683 dòng, nạp trong `fractal-antarctica-render.html`)

| File | Nội dung |
|---|---|
| `fractal-engine/nen-tang.js` | Primitives động học: `bezier`, `EASINGS`, `easeFn`, `cl01`/`seg`/`lerp`, `el`/`px`; `archetype`, `media`/`stripes`, registry `AR = {}`. |
| `fractal-engine/ve-1.js` | 8 renderer `AR.*`: title, lowerThird, wipe, callout, cta, logo, counter, hud. |
| `fractal-engine/ve-2.js` | 13 renderer `AR.*`: shape → outro (list, frame, background, avatar, browser, search, chart, nodePath, cards, newspaper, highlight…). |
| `fractal-engine/chuyen.js` | `AR.transitionAB` (23 kiểu chuyển cảnh A→B) + `clockPt`. |

Thứ tự nạp: nen-tang → ve-1 → ve-2 → chuyen. Trang render ghi đè `media` sau
khi nạp (thay nền gradient bằng ảnh thật) — function declaration là global
nên ghi đè xuyên file vẫn đúng, đừng đổi thành `const`.

### `web/src/toolbox/utility/` (từ god-file `utility.js` 13.780 dòng / 889 hàm, nạp trong `index.html`)

Tách verbatim theo dải dòng (không sửa thân hàm), kiểm chứng bằng partition
1..N + multiset (tên hàm & dòng phi-rỗng **0 mất / 0 dư**, `node --check` 28/28,
`scripts/web-origin-qa.js` PASS). Kernel giữ **16 hàm dùng chéo** tại chỗ vì hợp đồng
`web-origin-qa.js` yêu cầu `_t7FileUrl` + `/local-media` nằm trong `utility.js`.

| File | Nội dung chính |
|---|---|
| `utility.js` (kernel, 164 dòng/16 hàm) | `escapeHtml`, `copyText`, `parseSRT`, `_t7FileUrl`/`hdFileUrl`/`wbFileUrl`, debounce, fmt thời lượng… |
| `utility/keys.js` | API key, provider switch, CLI login (`onProviderChange`, `renderKeyFields`…). |
| `utility/tier.js` | Pro/Max gate (`isPro`, `gateTool`, upgrade modal) + admin dashboard (`adm*`). |
| `utility/shell.js` | Theme, nav filter, sidebar/user box, toast, link hỗ trợ, cập nhật app. |
| `utility/dashboard.js` | `renderDashboard` + thống kê + điều khiển auto-run nhanh. |
| `utility/autopipe.js` | `_runPipeline`, lịch sử job (`_hist*`), cấu hình kênh (`applyChannelCfg`). |
| `utility/llm.js` | Cài đặt API, `callLLM` + provider (Anthropic/OpenAI/Compat/Claude), usage. |
| `utility/nav.js` | `switchTool` — điều hướng giữa các tool panel. |
| `utility/upscale.js` | Hàng đợi upscale ảnh (`up*`). |
| `utility/ts.js` | Tool kịch bản / novel architect (`_tsNovel*`). |
| `utility/voice.js` | OmniVoice/TTS: `voice*`, `giong*` (nạp, vẽ, thử, ghép, backend). |
| `utility/mvtv.js` | Motion vision (`_mv*`) + sinh video TV (`tvGenerate`, model keys). |
| `utility/promptlib.js` | Sửa prompt tại chỗ, style tail, thư viện asset (`_getLib`). |
| `utility/profiles.js` | Cloud state (`saveState`), profile CRUD, style preset & style images. |
| `utility/tf.js` | Google Flow engine UI: `tf*`, `bulk*`, `fc*`, `tfGenScenes`/`tfGenAssets`. |
| `utility/t2-split.js` | Nạp kịch bản, tách cảnh fast/smart/AI, `balanceScenes`. |
| `utility/t2-scenes.js` | Kiểm soát cảnh, nguồn (`nguon`), tags canon, wardrobe. |
| `utility/t2-prompts.js` | `doSplit`/`doPrescan`/`doAssign`, `buildSceneGenPrompt`, prompt B. |
| `utility/t2-audio.js` | Auto audio, whisper keys, `syncTool2`, `renderSceneTimeline`. |
| `utility/t2-cast.js` | Thu cast → assets (`_collectCastToAssets`), `renderT2Assets`, `renderPreview`. |
| `utility/t2-regen.js` | Pool sinh lại cảnh (`_t2Regen*`), `renderTable`, videoAgent event bridge. |
| `utility/t2-edit.js` | Renumber, sửa/gộp/thêm cảnh, SRT, `restoreUI`. |
| `utility/t3-assets.js` | Prompt nhân vật/bối cảnh, dropzone, renamer, zip. |
| `utility/stock.js` | Tìm media đa nguồn (Pexels/Pixabay/Unsplash/archives), web picker, CSV/SRT. |
| `utility/veo.js` | Cache prompt Veo (`_t6Veo*`) + `genSingleVeoPrompt`, `renderVeoPrompts`. |
| `utility/t7.js` | Nova timeline/editor: `_t7*` (clips, layers, AI edit, export, rails). |
| `utility/transcribe.js` | `_t8TranscribeBlob`, wav 16k, `groupWordsIntoLines`, `_t9SnapChapters`, `_t11*` keys. |
| `utility/niche.js` | Ngách (`nf*`), t9 ref topic, `_giongCloud`. |

Thứ tự nạp trong `index.html`: `shared-consts.js` → kernel `utility.js` → 27 file
`utility/*.js` → các `tool-*.js`. Cả 28 file đều chỉ chứa function declaration
hoisted (0 lệnh chạy lúc nạp) nên thứ tự GIỮA chúng không quan trọng; ràng buộc
duy nhất là nạp **sau `shared-consts.js`** — 74 hàm trùng tên peer trong đó vẫn
được utility override đúng như thời god-file. EOL chuẩn hoá LF khi tách.

### `web/src/styles/` (từ 18 khối `<style>` inline trong `index.html`, nạp ngay tại vị trí cũ)

Rút verbatim từng khối (không sửa CSS), thay bằng `<link rel="stylesheet">`
**tại đúng vị trí cũ** → thứ tự cascade bất biến. Verify: reverse-rebuild
(replace ngược link → style) khớp gốc sau normalize LF + multiset dòng
(0 mất / 0 dư). `index.html` **6.100 → 3.604 dòng** — rời warning `check:size`.

| File | Nội dung |
|---|---|
| `styles/base.css` (1.215 dòng) | Design tokens `:root`, reset, layout khung, sidebar/nav/toast, dashboard nền. |
| `styles/video-agent.css` | Wizard Video Agent từng bước (whiteboard studio). |
| `styles/build-video.css` (605 dòng) | Màn Dựng video redesign: bin \| preview \| inspector + timeline. |
| `styles/tool-{script,2,6,9,10,imzic,anim,niche,flow,upscale,voice}.css` | CSS riêng từng tool. |
| `styles/admin-dash.css` | Bảng admin dashboard (`#admDash`). |
| `styles/{upgrade,gate,update}-modal.css` | 3 modal hệ thống. |

MIME `.css` phục vụ bởi `main/server.js` (text/css, no-cache, không CSP).
2 `url(data:image/svg+xml…)` trong build-video/upscale là data:URI — không phụ
thuộc base URL nên chuyển external an toàn.

## editor-pro/niche — tách module CommonJS (khác kiểu với web renderer)

`editor-pro/niche.js` (517 dòng, Tìm Ngách/Niche Finder) là module **CommonJS
của main process**, không phải script thường: tên không global mà nằm trong
scope module, nên cách tách khác hẳn phần web ở trên — chia bằng
`require`/`module.exports` thay vì thứ tự nạp HTML.

| File | Nội dung |
|---|---|
| `editor-pro/niche/loi.js` | Nguyên 243 dòng đầu bản gốc: `run` (spawn yt-dlp), AI `_KHO`/`_NHA_CC`/`_goiApi`/`claude` (API cấu hình trước, CLI bridge lùi), `safeJson`/`cookies`/`daysSince`/`kfmt`, cache TTL 6h, `searchVideos`, `median`, `sweepQueries`. Xuất các hàm dùng chung cho 2 file dưới. |
| `editor-pro/niche/kenh.js` | Phần KÊNH: `channelScorecard` (5 chỉ số VPS/VPH/longform/ổn định/xu hướng) + `similarChannels` (đồng xuất hiện). |
| `editor-pro/niche/thi-truong.js` | `hotTopics` (chủ đề bùng), `bwScore` (chấm ý tưởng đen–trắng), `attentionMarkets` (tệp khán giả động). |
| `editor-pro/niche/index.js` | Điểm vào: gộp lại và tái xuất **đúng hợp đồng `module.exports` cũ** (8 tên, gồm `claude`/`_goiApi`/`_KHO` cho test). |
| `editor-pro/niche.js` | **Shim**: `module.exports = require('./niche/index.js')` + khối CLI `require.main`. Giữ nguyên mọi đường require cũ — `require('./niche')` (ipc-niche.js) lẫn `require('./nova/editor-pro/niche.js')` (test ở root) đều ra module như xưa (Node ưu tiên file trước thư mục). |

Lưu ý khi tách module CommonJS: file dời sâu 1 cấp phải sửa require tương đối
nội bộ (`./ytdlp-path` → `../ytdlp-path` — 3 dòng duy nhất không giữ nguyên
byte); còn thân hàm giữ nguyên byte vì tên hứng qua destructuring `require('./loi')`.

## `flow-chrome/` — tách module CommonJS có STATE HOLDER (pattern khác niche)

`nova/flow-chrome.js` (1.276 dòng, engine "Chrome THẬT đa profile") KHÔNG tách được
theo kiểu byte-preserve của `editor-pro/niche`: nó có **state `let` top-level bị
GÁN LẠI xuyên file** — `order`/`nextId` (gán trong `restore()`), `_busy`,
`_lastTokenExpiry`, `_captchaId` — mà destructuring `require` chỉ *snapshot* giá
trị lúc nạp, các file khác sẽ giữ giá trị cũ → bug runtime âm thầm. Giải pháp:
state dùng chung gom vào object `S` (`trang-thai.js`), tham chiếu đổi `x` → `S.x`
(~50 dòng nội bộ đổi; hợp đồng `module.exports` 21 tên và mọi đường require của
consumer giữ nguyên byte).

| File | Nội dung |
|---|---|
| `flow-chrome/trang-thai.js` | State holder `S = { order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens }` — bắt buộc qua object vì CommonJS không có live binding. |
| `flow-chrome/nen-tang.js` | Dòng gốc 1–147: log sink/`LOG`, `FLOW_URL`/`FLOW_API_*`, `profilesRoot`/`storeFile`, kho account (`persist`/`restore`/`statusPayload`), helper CDP (`readDevToolsPort`/`httpJSON`/`flowPageWs`/`cdpConnect`/`evalInPage`/`evalInPageT`). |
| `flow-chrome/tien-trinh.js` | 148–344: launch/kill/wipe/close/free profile, `openForOperation` (chuỗi `_openChain`), `captureToken`, `readCookies`, `apiFetch`. |
| `flow-chrome/dang-nhap.js` | 345–561: login/relogin 4 bước, `loginAuto`, `gracefulQuit`, quản lý account (`setEnabled`/`setProxy`/`removeAccount`/`refreshOne`), `verifyAccount`. |
| `flow-chrome/token-captcha.js` | 562–682 + 711–745: `ensureLive`, máy captcha account & guest (xoay profile), `getTokenFresh`, `pageEval`, `pageFetchImage`, `getToken`. |
| `flow-chrome/gen.js` | 746–1241 + 683–709: gen ảnh test, pipeline video học request thật, upscale 1080p, tắt watermark, `genVideo`, `resolveVideoForApp`, `getAllTokens`. `getAccountData` hoán vị từ 683–709 về cuối file (hạ gợi chu trình require). |
| `flow-chrome/index.js` | 1242–1276: dispatcher `handle` + `listAccounts` + **nguyên văn dòng `module.exports` cũ (21 tên)**. |
| `flow-chrome.js` | **Shim**: re-export `./flow-chrome/index.js` + bọc `restore()` giữ đúng thứ tự gốc (`_loadCapMode()` chạy TRƯỚC khi nạp kho account — dòng 48 gốc). 3 đường require cũ (`main/ipc/flow.js`, `main/lifecycle.js`, `flow-native.plain.js`) không đổi. |

Quy tắc rút ra khi tách module CommonJS có state gán lại:

- **Đồ thị require phải TUYẾN TÍNH**: `trang-thai → nen-tang → tien-trinh →
  dang-nhap / token-captcha → gen → index`. Vòng require với destructuring sẽ nạp
  module chưa hoàn chỉnh.
- `tokens` (Map) đưa vào `S` dù chỉ mutation — vì `persist`/`restore` (nen-tang)
  cần nó; để nguyên chỗ cũ (token-captcha) sẽ tạo vòng nen-tang ↔ token-captcha.
- `_loadCapMode()` (dòng 48 gốc trong `restore`) sống ở token-captcha — nếu
  nen-tang import nó sẽ tạo vòng, nên shim gọi lại đúng vị trí.
- Hàm tham chiếu hằng/ helper của lát SAU nhưng đứng TRƯỚC ranh giới (vd
  `getAccountData` gọi `TRPC_CREATE_PROJECT` của gen) → hoán vị hàm sang lát
  chứa hằng đó thay vì tạo vòng.
- Kiểm định: multiset 1.227 dòng phi-rỗng (0 mất/0 dư, tính biến đổi `S.x`),
  `node --check` 8/8, smoke electron-fake: 3 đường require chung 1 instance, 21
  tên export đều là function, `handle('PING')` → `{ok, engine:'chrome'}`,
  live-binding `S.order` → `listAccounts()` phản ánh gán lại.


## `flow-native/` — tách theo pattern state-holder của `flow-chrome/`

`nova/flow-native.plain.js` (1.302 dòng, engine "BrowserWindow Electron đa profile" của Flow)
tách giống `flow-chrome/`: 7 biến `let` top-level bị **gán lại xuyên file** (`order`/`nextId`
trong `restore()`/`addAccount*`, `pool` trong `poolReset()`, `_poolAbort` qua
`handle(POOL_ABORT)`, `_capChain` trong `_withCapLock()`, `_autoTimer`/`_genActive` trong
token-captcha) → object `S` trong `trang-thai.js`, tham chiếu đổi `S.x` (~45 dòng nội bộ);
hợp đồng `module.exports { handle, restore }` giữ nguyên byte.

| File | Nội dung |
|---|---|
| `flow-native/trang-thai.js` | State holder `S = { order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive }` — bắt buộc qua object vì CommonJS không có live binding. |
| `flow-native/nen-tang.js` | Dòng gốc 1–184: hằng số endpoint (`FLOW_API_BASE`/`FLOW_API_KEY`/`TRPC_CREATE_PROJECT`/`UPLOAD_IMAGE_URL`/`FLOW_TAB_URL`/`SITE_KEY`…), `sleep`, kho account (`accounts`/`storeFile`/`persist`/`acctSession`/`hookToken`), helpers thuần (`deepFindProjectId`/`extractApiError`). |
| `flow-native/tien-trinh.js` | 79–164 + 515–518: `ensureWindow`, `pageEval`/`pageFetch`/`pageFetchImage`, `solveCaptcha`, `_withCapLock`. `ensureWindow` lazy-`require('./gen')` cho 2 hook học video/upscale — điểm vòng duy nhất, chỉ resolve lúc runtime. |
| `flow-native/token-captcha.js` | 186–270 + 569–635: `readCookieExpiry`, dò email (session + page), `refreshAccount`, `triggerTokenRefresh`, `ensurePoolTokens`, tự làm mới token định kỳ (`withGen`/`refreshAccountToken`/`autoRefreshTokens`/`startAutoRefresh`). |
| `flow-native/dang-nhap.js` | 525–538 + 691–830: `primary`/`syncChromeAccounts` (đặt đây để `gen` require 1 chiều — tránh vòng gen ↔ dang-nhap qua `statusPayload`), thêm account (cửa sổ / chuỗi cookie), `refreshOne`, bật/tắt/xoá, `setProxy`, `scanAll`, `statusPayload`. |
| `flow-native/gen.js` | 272–497 + 502–689 + 832–1259: tRPC project/upload, `genImage` + upsample 2K/4K, POOL round-robin (`poolGen`/`acquireAccount`), video Veo (`submitVideo`/`pollVideo`/`resolveVideoData`/`genVideoPool`), template "học" video/upscale (`loadVideoLearn`/`loadUpscaleLearn` chạy lúc nạp module). |
| `flow-native/index.js` | 44–57 + 1261–1301: `restore()` + dispatcher `handle` + **nguyên văn dòng `module.exports = { handle, restore }` cũ**. |
| `flow-native.js` | **Shim**: `module.exports = require('./flow-native/index.js')` — `main/ipc/flow.js` đổi require từ `.plain` sang shim; hợp đồng 2 tên không đổi. |

Khác `flow-chrome`: `flow-native.js` từng thuộc TARGETS của `scripts/protect.js`/`unprotect.js`
và có cặp `.plain.js` — khi tách xong phải (1) xoá khỏi cả 2 TARGETS kẻo build bảo vệ obfuscate
lại từ `.plain.js` đè shim, (2) xoá khỏi `pairs` của `scripts/parity-check.js`
(script này đã xoá hẳn 2026-09-11, thay bằng `exports-contract-check.js`), (3) xoá
`flow-native.plain.js` (nguồn đã rã thành thư mục, git history giữ bản gốc),
(4) `scripts/foundation-test.js` đọc nguồn flow đổi sang 8 file split.

Kiểm định: multiset dòng phi-rỗng **0 mất / 0 dư** (ngoài glue header/require/exports và các
dòng đổi `S.x`), `node --check` 8/8, smoke electron-fake: 3 đường require chung 1 instance,
`handle('PING')` → `{ok, native:true}`, live-binding `S.order` → `GET_STATUS`, `restore()` set
`S._autoTimer`, `VIDEO_LEARN_STATUS` chạy qua lazy require không chết vòng.

Sau đó chuỗi retire tiếp tục hoàn tất cho TẤT CẢ các cặp còn lại: `native-tools`,
`flow-cft`, `cli-bridge-native`, `voice-native` (tách module + shim cùng pattern),
`flow-bridge` (130 dòng state machine khớp chặt — không tách được verbatim, thay blob
obfuscated bằng nguồn readable trực tiếp), và `main` (bản obfuscated `main.js` xoá hẳn —
entry của Electron luôn là `main.plain.js` ở cả dev lẫn build đóng gói). Kết quả:
`scripts/protect.js`/`unprotect.js` đã xoá (dep `javascript-obfuscator` cũng không còn),
`scripts/parity-check.js` (guard no-op 0 pairs) đã XOÁ hẳn (2026-09-11) — thay bằng
`scripts/exports-contract-check.js` (`check:exports`): baseline `nova/exports-contract.json`
cưỡng chế tên/thứ tự `module.exports` của shim `nova/*.js` + module `nova/main/*.js`
(Luật 1 AGENTS.md).
Từ đây mọi main-process source trong repo đều là JS readable duy nhất một nguồn.

## Kiểm tra

```bash
cd nova
npm run check:syntax   # node --check toàn bộ .js nguồn (trừ node_modules/bundle/build)
npm run check:ipc      # sinh ipc-inventory.json: mọi kênh IPC của main + renderer
npm run check:shared   # tên dùng chung: state keys, hằng số, cổng, env — xem bên dưới
npm start              # smoke test: splash ≥5s → main window → IPC → quit sạch
```

## Bảo vệ TÊN DÙNG CHUNG (check:shared)

`nova/scripts/shared-names-check.js` cưỡng chế các hợp đồng tên giữa `nova/main/` và
`main.plain.js` — fail ngay khi có vi phạm:

- `state.<key>` và destructuring từ `state` phải khớp key khai báo trong `main/state.js`;
  key khai báo mà không module nào dùng cũng bị báo (state chết phải xoá).
- Không module main được ghi biến `global.*` — mọi trạng thái chia sẻ qua `state.js`.
- Hằng số của `state.js` (WEB_DIR, NOVA_REMOTION_DIR, AUTH_HOST_NAMES,
  EXTERNAL_LINK_HOST_NAMES, SPLASH_MIN_MS,
  SPLASH_MAX_MS) chỉ được định nghĩa một nơi duy nhất.
- Cổng bridge 8793/8794/8795/8796 cấm hardcode trong `main/` (chủ sở hữu: module bridge
  gốc ở `nova/`); cổng web 47280–47283 chỉ được đặt trong `main/server.js` (PREFERRED).
  Comment không tính là vi phạm.
- `process.env.<TÊN>` phải theo tiền tố `AI_VIDEO_STUDIO_` / `NOVA_` / `ELECTRON_` /
  `NODE_` — chặn typo tên biến môi trường.

Lệnh gộp: `npm run check` = syntax + ipc + exports + shared + shadow + size +
toplevel + docs. CI (`m1-validation.yml`) chạy toàn bộ chuỗi này + `test:foundation`
ở bước "Run application checks".

