# Milestone 0 - Discovery / Architecture

**Status: PASS (discovery only)**

> M0 chỉ khảo sát và lập kế hoạch. Không có production behavior nào được thay đổi.

## 1. Repository snapshot

- Workspace: `D:\AI Video Studio`
- Git metadata: không tìm thấy thư mục `.git`.
- Đây là Windows packaged output, không phải source repository đầy đủ.
- Các artifact đã thấy: `AI Video Studio.exe`, `build-output\AI-Video-Studio-0.1.34-*.exe`.
- App payload đang có tại `D:\AI Video Studio\resources\app`.

## 2. Technology and build system

- Desktop framework: Electron.
- Electron version: `33.4.11`.
- Node.js kiểm tra tại workspace: `v24.15.0`.
- npm kiểm tra tại workspace: `11.12.1`.
- Module style: CommonJS (`require`).
- Runtime package: `resources\app\package.json`, app version `0.1.34`.
- Build package: `build-project\package.json`.
- Packager: `electron-builder 26.15.3`.
- Build targets: Windows x64 `portable` và `nsis`.
- Packaging: `asar: true`; native binaries được unpack riêng.

## 3. Existing tests and checks

Các lệnh hiện có trong `resources\app\package.json`:

- `npm run check:syntax` -> **PASS**, 97 JavaScript files.
- `npm run check:ipc` -> **PASS**, inventory 86 IPC channels và 15 progress events.
- `npm run check:parity` -> **PASS**, 7 protected/plain pairs.
- `npm run test:foundation` -> **PASS**, foundation tests.

Chưa phát hiện unit/integration framework riêng như Jest, Vitest, Playwright hoặc pytest trong package app. Test hiện tại là Node scripts dùng `assert` và static checks.

## 4. Current error handling

Entry point cần ưu tiên về sau:

- `D:\AI Video Studio\resources\app\main.plain.js`
- `D:\AI Video Studio\resources\app\main.js` (protected/obfuscated pair)
- `D:\AI Video Studio\resources\app\preload.js`

Hiện tại `main.plain.js`:

- đăng ký `process.on('uncaughtException')` và `process.on('unhandledRejection')`;
- hiển thị friendly dialog cho một số lỗi file (`ENOSPC`, `EACCES`, `EPERM`, `EROFS`);
- ghi lỗi còn lại ra `console.error`;
- chưa có CrashReport schema, fingerprint/deduplication, bounded event ring buffer, sanitizer, local offline queue hoặc HTTPS crash upload.

## 5. Current updater and packaging integration

- `electron-updater` đã là dependency.
- `main.plain.js` đang gọi `autoUpdater.checkForUpdates()`, hỗ trợ download/install IPC.
- `preload.js` expose `appVersion`, update status, download và install.
- `resources\app\app-update.yml` hiện diện.
- `build-project\electron-builder.yml` có NSIS/portable output.
- Cảnh báo quan trọng: `win.verifyUpdateCodeSignature` hiện là `false`.
- Chưa thấy flow đầy đủ cho hash/signature verification, separate updater process, post-update health check hoặc automatic rollback theo specification.

## 6. Integration points proposed

### Client plane

1. Error reporter trong main process, đặt sau khi có source repository đầy đủ; không nuốt lỗi hiện hữu.
2. Event recorder dạng bounded ring buffer ở lớp IPC/use-case, chỉ ghi event metadata tối thiểu.
3. Environment fingerprint dùng OS/build/arch/runtime/dependency/config fingerprint; không đọc arbitrary files.
4. Local queue đặt trong `app.getPath('userData')`, dùng atomic storage và retry/backoff.
5. Health check tách khỏi executable update flow; updater process không tự overwrite executable đang chạy.

### Control plane

Chưa tồn tại trong packaged app. Cần source/backend riêng cho Crash Collector, sanitizer, dedupe, BugCase, queue, agent supervisor, release/update metadata, flags, kill switch và monitoring.

### Execution plane

Cần hạ tầng riêng, không chạy AI sandbox trên máy production/client: isolated worktree, reproduction environment/VM, CI runner, clean-machine test, security scanner và controlled signing service.

## 7. Security-sensitive modules

- `resources\app\flow-chrome.js` và `flow-cft.plain.js`: điều khiển Chrome, token/cookie/session và process spawning.
- `resources\app\storage\settings-store.js`: lưu cấu hình/key trong userData (`nova-settings.json`).
- `resources\app\main.plain.js`: Electron main process, IPC registration, native process integration và updater.
- `resources\app\preload.js`: bridge từ renderer sang IPC; phải giữ allowlist, không expose shell tùy ý.
- `resources\app\native-tools.js`, `voice-native.js`, `watermark-native.js`, `cli-bridge-native.js`: native executable/Python/child-process boundaries.
- `resources\app\mcp-server\`: cần review riêng trước mọi AI/tool integration.
- `build-project\electron-builder.yml`: artifact, installer, unpack rules và signing/update policy.

Các module trên mặc định là **HIGH risk**; AI không được tự sửa/release.

## 8. Unknowns / blockers

1. Historical finding: source repository/Git history had not yet been identified; superseded by the canonical-source update in section 10.
2. Chưa biết backend/server, database, auth provider và nơi phát hành release thực tế.
3. Chưa có crash API endpoint, retention policy, consent/privacy policy hoặc incident notification.
4. Chưa có test VM/clean machine/golden profiles.
5. Chưa có signing certificate/service và key-isolation design.
6. `main.js`/các protected files có obfuscation; không nên chỉnh trực tiếp.
7. Chưa xác định canonical source build path so với packaged `resources\app`.
8. Chưa có baseline metrics cho crash/startup/update/rollback.

## 9. M0 architecture decision

Không đưa Auto-Fix code vào `resources\app` ở M0. Quản lý chức năng ở thư mục độc lập `D:\AI Video Studio\auto-fix`; các milestone sau chỉ kết nối qua interface rõ ràng sau khi source/Git và security design đã được bổ sung.

## 10. 2026-08-27 canonical-source update

Khảo sát ban đầu ở trên phản ánh packaged workspace trước khi source được đưa vào Git và được giữ lại làm historical record. Canonical Electron source hiện đã được đăng ký bằng `config/canonical-source.json`:

- remote `https://github.com/khanhtran0393/AI-Novel.git`;
- branch `nova-logic`;
- baseline `d936dc4054bfc1e38d0e01e345010d02b8f4ebf0`;
- build config `electron-builder.json` và lockfile v3.

Independent clone đã qua `npm ci`, syntax/IPC/parity/foundation checks và unpacked Windows build với publishing disabled. CI definitions và governance runbooks đã được thêm sau discovery, nhưng M1 vẫn `BLOCKED` do chưa có workflow-run/required-check evidence, branch protection, approved provenance, controlled signing/release infrastructure và completed security review. Không bật crash upload hay bất kỳ AI write/build/release authority nào.

## 11. Kiến trúc chi tiết theo repository hiện tại (xác minh 2026-08-27)

Khảo sát lại tại workspace `D:\AI Video Studio` (HEAD `6787f6e`, branch `feature/auto-fix-master-specification`, tracked `origin/nova-logic`).

### 11.1 Công nghệ & build (xác minh)
- Electron desktop; root `package.json` khai báo `electron ^43.0.0` (devDependency) — packaged runtime cũ ghi nhận 33.4.11; entry `nova/main.plain.js`, CommonJS.
- Runtime deps: `electron-updater ^6.3.9`, `ffmpeg-static`, `ffprobe-static`, `onnxruntime-node ^1.27.0`, `ws ^8.21.1`.
- Packager `electron-builder ^26.0.0` qua `electron-builder.json`: target NSIS + portable (x64), `asar: true`, `publish: null` (chưa signing/update server).
- `node nova/scripts/syntax-check.js` → PASS, 101 files (doc cũ ghi 97; số mới phản ánh source đã sync).

### 11.2 Test hiện có (xác minh)
- App checks: `syntax-check`, `ipc-inventory`, `parity-check`, `foundation-test`, `packaged-smoke` — Node scripts dùng `assert`, không có Jest/Vitest/Playwright.
- Auto-Fix control plane: `npm --prefix auto-fix test` → PASS (policy, control-plane, artifact-provenance); `check:policy` → PASS, mode `observe-only`, authorities deny-by-default.
- Client error reporter (M2, standalone): 7 test files `assert`-based.

### 11.3 Kiến trúc ánh xạ theo specification
- Client plane: `nova/main.plain.js` (global error handlers + `setupAutoUpdate()`), `nova/preload.js` (contextBridge allowlist), `nova/editor-pro/ipc-*.js` (IPC handlers), `nova/storage/settings-store.js`. Điểm gắn ErrorReporter/Updater đã được định vị nhưng CHƯA sửa.
- Control plane: `auto-fix/` — policy, gates, repository-adapter, path-boundary, redaction, audit, tool-registry, canonical-source manifest. Chưa kết nối runtime Electron.
- Execution plane: chưa tồn tại (cần sandbox/worktree/reproduction VM/CI runner/signing service — thuộc M5-M10).

### 11.4 Các module nhạy cảm (HIGH risk)
- `nova/flow-chrome.js`, `nova/flow-cft.plain.js`: Chrome/CDP, token/cookie/session, process spawn.
- `nova/storage/settings-store.js`: API key/config trong userData.
- `nova/main.plain.js` + `nova/preload.js`: main process, IPC, updater.
- Native/child-process boundaries: `native-tools`, `voice-native`, `watermark-native`, `cli-bridge-native`, `mcp-bridge-native`.
- `nova/mcp-server/`: bắt buộc review riêng trước mọi AI/tool integration.

### 11.5 Quan sát trình tự & rủi ro
- M1 hiện `BLOCKED` nhưng đã có commit `89e0f84 feat(m2): add client error reporter` — M2 được commit trước khi M1 PASS, vi phạm nguyên tắc tuần tự của specification. Cần ghi nhận và không coi M2 đã được chấp nhận vào production (module vẫn standalone, chưa wire vào app).
- Worktree dirty: `build-project/` (staged deletes), `package.json` + `nova/scripts/packaged-smoke.js` (modified), `build-project.old/` (untracked).
- Quyết định kiến trúc giữ nguyên: Auto-Fix tách biệt trong `auto-fix/`, KHÔNG nhúng vào `nova/`/`resources/app`; mọi authority `false`; quan sát là chính.

## 12. M0 re-validation — 2026-08-27 (branch `feature/auto-fix-master-specification`)

Khảo sát lại để xác nhận discovery vẫn đúng so với repository hiện tại. Kết quả kiểm tra:

- `npm run check:syntax` → PASS (101 files).
- `npm run check:ipc` → PASS (86 channels, 15 events, 101 files).
- `npm run check:parity` → PASS (7 protected/plain pairs).
- `npm run test:foundation` → PASS.
- `npm --prefix auto-fix run check:policy` → PASS, mode `observe-only`, authorities deny-by-default.
- `npm --prefix auto-fix run test` → PASS (policy, control-plane, artifact-provenance).

Canonical source hiện lấy từ `config/canonical-source.json` (machine-readable, authoritative): remote `https://github.com/khanhtran0393/AI-Video-Studio.git`, branch `main`, baseline `d936dc4054bfc1e38d0e01e345010d02b8f4ebf0`. Các mục cũ hơn trong tài liệu này (remote `AI-Novel.git`/branch `nova-logic`) là historical record và đã bị supersede.

### Finding: aggregate `test:all` FAILS tại crash-server fuzz test (M3)

`npm --prefix auto-fix run test:all` thất bại (exit 1) tại `crash-server/test/fuzz.test.js`, thuộc M3 — KHÔNG phải code M0:

- Tất cả test trước đó PASS: control-plane (3), client-reporter (7), crash-server schema/sanitizer/fingerprint/database/rate-limit/auth/api (7).
- Fuzz test (untracked file `crash-server/test/fuzz.test.js`) sinh `error_type` là object không thể ép kiểu (`randomValue()` trả về object). `serverFingerprint` tại `crash-server/fingerprint.js:65` gọi trực tiếp `String(safe.error_type || '')`, ném `TypeError: Cannot convert object to primitive value`.
- Root cause: `fingerprint.js` chưa thực thi đúng contract "fuzz input không bao giờ throw" mà chính fuzz test yêu cầu. Các helper `normalizeMessage`/`normalizeStack`/`normalizeErrorCode` đã dùng `String(... || '')` an toàn, nhưng dòng 65 không dùng helper đó.

### Quyết định (đúng phạm vi M0)

- M0 là discovery/architecture; không sửa code. Defect trên thuộc M3 (`crash-server`), sẽ được ghi nhận và xử lý khi làm milestone M3, không thuộc phạm vi hiện tại.
- Không claim M0 PASS dựa trên `test:all` xanh vì `test:all` hiện FAIL. M0 PASS được xác nhận dựa trên phạm vi discovery: khảo sát đúng, test baseline của các module thuộc M0/control-plane PASS, và không có production behavior nào thay đổi.
- `test:all` aggregate FAIL là known limitation và là blocker cho các milestone sau nếu không được sửa ở M3.
