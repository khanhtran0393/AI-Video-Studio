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
  gọi từ root tại `app.whenReady`, dùng userDataDir riêng tư).

## Bridge cục bộ (khởi động trong `ipc/index.js`, dọn dẹp trong `lifecycle.js`)

- CLI bridge (8795/8796), MCP bridge (8794), Flow extension bridge (flow-bridge.plain).

## Các thư mục extension Chrome — ai là NGUỒN, ai là OUTPUT

| Thư mục | Vai trò |
|---|---|
| `nova/flow-extension/` | **NGUỒN** chính (chỉnh sửa ở đây). `flow-ext-export` cpSync sang `<app>/chrome-extension` để user "Tải tiện ích chưa đóng gói" vào Chrome. Ship qua `scripts/sync-extension.mjs`. |
| `nova/nova-studio/` | **BIẾN THỂ CÓ CHỦ Ý** của flow-extension (logic captcha/aborted khác) — README sync-extension ghi rõ "KHÔNG copy chéo giữa 2 dòng extension". Chỉnh sửa độc lập. |
| `nova/chrome-extension/` | **OUTPUT runtime** (dev) — được sinh bởi IPC `flow-ext-export`, Chrome tự thêm `_metadata/` khi load. Đã `.gitignore` + untrack; KHÔNG coi là nguồn, KHÔNG edit tay. |

Tương tự, `flow-chrome.js` (điều khiển Chrome đa profile — `flowChrome.handle(...)`) và `flow-native.plain.js` là **2 module khác nhau**, không phải bản sao của nhau — cả hai được `main/ipc/flow.js` require song song.

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
- Hằng số của `state.js` (WEB_DIR, NOVA_REMOTION_DIR, AUTH_HOSTS, SPLASH_MIN_MS,
  SPLASH_MAX_MS) chỉ được định nghĩa một nơi duy nhất.
- Cổng bridge 8793/8794/8795/8796 cấm hardcode trong `main/` (chủ sở hữu: module bridge
  gốc ở `nova/`); cổng web 47280–47283 chỉ được đặt trong `main/server.js` (PREFERRED).
  Comment không tính là vi phạm.
- `process.env.<TÊN>` phải theo tiền tố `AI_VIDEO_STUDIO_` / `NOVA_` / `ELECTRON_` /
  `NODE_` — chặn typo tên biến môi trường.

Lệnh gộp: `npm run check` = syntax + ipc + parity + shared. CI (`m1-validation.yml`)
chạy `check:shared` ở bước "Run application checks".

