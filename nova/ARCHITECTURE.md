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

## Kiểm tra

```bash
cd nova
npm run check:syntax   # node --check toàn bộ .js nguồn (trừ node_modules/bundle/build)
npm run check:ipc      # sinh ipc-inventory.json: mọi kênh IPC của main + renderer
npm start              # smoke test: splash ≥5s → main window → IPC → quit sạch
```
