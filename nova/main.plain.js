/**
 * AI Video Studio Desktop (Electron) — Cách B: đóng gói UI vào app + auto-update.
 * - Production: phục vụ web/index.html qua local server chỉ lắng nghe trên 127.0.0.1.
 * - Dev: đặt NOVA_STUDIO_DEV_URL=http://localhost:5500 để load bản đang sửa.
 * - Auto-update tùy chọn, chỉ bật khi có máy chủ phát hành riêng của Nova.
 *
 * File này giờ là "composition root" (điểm lắp ráp): toàn bộ logic đã tách theo
 * chức năng sang nova/main/ (state, splash, server, cửa sổ, menu, updater,
 * lifecycle…) và nova/main/ipc/ (từng nhóm IPC). Xem nova/ARCHITECTURE.md.
 */

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

const { applyAppIdentity } = require('./main/identity');
const { ensureSingleInstance } = require('./main/single-instance');
const state = require('./main/state');
const { installGlobalErrorHandlers } = require('./main/global-errors');
const { setupErrorReporter } = require('./main/error-reporter');
const { buildMenu } = require('./main/menu');
const { createSplashWindow, closeSplashWindow } = require('./main/splash');
const { resolveStartUrl } = require('./main/server');
const { createWindow } = require('./main/window');
const { setupAutoUpdate } = require('./main/updater');
const { shutdownOwnedResources } = require('./main/lifecycle');
const { installLifecycleLogging } = require('./main/lifecycle-log');
const { registerAllIpc } = require('./main/ipc');
const { userDataPath } = require('./core/paths');
const { runStartupJanitor, runQuitJanitor } = require('./main/janitor');
const { registerSettingsIpc } = require('./storage/settings-store');
const { registerElectronErrorBridge } = require('../auto-fix/client-error-reporter/electron-bridge');

// Identity và vùng dữ liệu riêng của AI Video Studio.
// Phải cấu hình trước app.whenReady() để Electron không dùng lại profile của app khác.
try { applyAppIdentity(); } catch (error) {
  console.warn('[startup] không thể chuẩn bị vùng dữ liệu Nova:', error && error.message);
}

// Single-instance (phải SAU applyAppIdentity vì lock gắn với userData): instance
// thứ hai thoát ngay — instance đầu nhận 'second-instance' và focus cửa sổ.
if (!ensureSingleInstance()) {
  app.quit();
  return;
}

// Tắt bớt log rác nội bộ của Chromium (vd "ffmpeg_common Unsupported pixel format") cho terminal sạch.
// KHÔNG ảnh hưởng log console.log của app (Node) — vẫn thấy các dòng [flow].
try { app.commandLine.appendSwitch('log-level', '3'); } catch (e) { /* */ }
// Studio (TDTStudio PyQt nhúng) vẽ bằng GDI vào HWND con (WS_CHILD) của cửa sổ
// app. Mặc định Chromium Windows render qua DirectComposition bằng child
// window "Intermediate D3D Window" (WS_EX_LAYERED | WS_EX_NOREDIRECTIONBITMAP)
// phủ kín client area → cửa sổ con GDI KHÔNG có bề mặt để vẽ → Studio chỉ thấy
// nền trắng/trống. Tắt DirectComposition để Chromium quay lại đường present
// cổ điển (swap chain + redirection surface): GPU vẫn tăng tốc, nhưng HWND con
// GDI vẽ được bình thường. Bắt buộc đặt TRƯỚC app.whenReady().
if (process.platform === 'win32') {
  try { app.commandLine.appendSwitch('disable-direct-composition'); } catch (e) { /* */ }
}

// Bắt lỗi toàn cục (uncaughtException/unhandledRejection) → thông báo thân thiện, không văng app.
installGlobalErrorHandlers();

// Log lifecycle (quit / render-process-gone / child-process-gone / unresponsive)
// ra userData/lifecycle.log — để chẩn đoán exit code khi test UI tự động.
installLifecycleLogging(app);

// ── Kho cài đặt (API key…) → FILE trong userData ────────────────────────────
// localStorage của UI gắn vào origin "http://localhost:<port>". Port có thể đổi
// (47280 bận → 47281/47282/… → ngẫu nhiên), và Chromium cũng có quyền dọn kho
// localStorage của origin http → "nhập key, thoát ra vào lại là mất trắng".
// File này không dính origin nên key sống qua mọi lần mở app / đổi port.
// sendSync: preload nạp kho TRƯỚC khi script trang chạy; ghi atomic xong mới trả về.
registerSettingsIpc(ipcMain, {
  file: path.join(userDataPath(app), 'nova-settings.json'),
  logger: console,
});

// Đăng ký toàn bộ IPC + khởi động các bridge cục bộ (CLI/MCP/Flow extension).
registerAllIpc();

app.on('before-quit', (event) => {
  state.isQuitting = true;
  try { closeSplashWindow(true); } catch (_) {}
  try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.hide(); } catch (_) {}
  try { if (state.localServer) { state.localServer.close(); state.localServer = null; } } catch (_) {}
  shutdownOwnedResources();
  // Electron does not await event handlers. Delay quit once while the reporter
  // joins any active flush, but never keep the app alive beyond the timeout.
  if (state.errorReporter && !state.reporterQuitReady) {
    event.preventDefault();
    if (!state.reporterShutdownPromise) {
      state.reporterShutdownPromise = state.errorReporter.shutdown(2000).catch(() => {}).finally(() => {
        state.reporterQuitReady = true;
        app.quit();
      });
    }
  }
});
app.on('will-quit', () => {
  state.isQuitting = true;
  // Janitor lúc thoát: xoá file .tmp mồ côi trong userData (rẻ, không chặn thoát).
  try { runQuitJanitor(app); } catch (_) {}
  if (state.unregisterErrorBridge) { try { state.unregisterErrorBridge(); } catch (_) {} state.unregisterErrorBridge = null; }
  try { closeSplashWindow(true); } catch (_) {}
  try { if (state.localServer) { state.localServer.close(); state.localServer = null; } } catch (_) {}
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.destroy();
    }
  } catch (_) {}
});

app.whenReady().then(async () => {
  // Observe-only error reporter. Initialize before IPC registration/window creation
  // so startup and renderer failures are not missed. Disabled unless explicitly
  // opted in; missing/invalid upload configuration remains local-only.
  if (process.env.AI_VIDEO_STUDIO_ERROR_REPORTING === '1') {
    try {
      state.errorReporter = setupErrorReporter();
      if (state.errorReporter) {
        try { state.errorReporter.recordEvent('app_start', { platform: process.platform }); } catch (_) {}
        state.errorReporter.startLifecycle({ networkTarget: app, onlineEvent: 'online' });
      }
    } catch (e) { console.warn('[error-reporter] setup:', e && e.message); }
  }
  try {
    state.unregisterErrorBridge = registerElectronErrorBridge({ app, ipcMain, getReporter: () => state.errorReporter });
  } catch (e) { console.warn('[error-reporter] bridge:', e && e.message); }

  // Không tạo BrowserWindow splash riêng. Cửa sổ frameless tạm thời có thể bị
  // Windows giữ lại thành một mảng đen nếu tiến trình cũ bị kill/crash. Giao diện
  // chính vẫn được giữ show:false và chỉ hiện sau khi load xong ở createWindow().
  // Icon trên Dock (macOS) ngay cả bản dev — dùng logo AutoVideo Studio.
  if (process.platform === 'darwin' && app.dock) {
    try { const ic = path.join(__dirname, 'build', 'icon.png'); if (fs.existsSync(ic)) app.dock.setIcon(ic); } catch (e) { /* */ }
  }
  // Janitor: dọn rác của phiên trước (crash/kill/rebrand để lại) — chạy 1 lần
  // khi mở app: file tạm mồ côi trong os.tmpdir(), file .tmp atomic-write dở
  // dang trong userData, userData của tên app cũ (mỗi bản ~430MB Chrome CfT),
  // và (chỉ dev) log/script rác ở thư mục dự án. Xem nova/main/janitor.js.
  try { runStartupJanitor(app); } catch (e) { console.warn('[janitor] startup:', e && e.message); }

  buildMenu();
  // Đăng ký IPC của Editor Pro (nhúng qua <webview>) — dùng chung userData Nova nhưng không dùng session app khác.
  try {
    require('./editor-pro/register').registerEditorPro(ipcMain, { userDataDir: app.getPath('userData') });
  } catch (e) { console.warn('[EditorPro] register:', e && e.message); }
  createSplashWindow();
  try {
    const startUrl = await resolveStartUrl();
    if (!state.isQuitting) createWindow(startUrl);
  } catch (err) {
    console.error('[startup]', err);
    closeSplashWindow(true);
    app.quit();
  }
  // Bản private không đọc app-update.yml/repository của AI Video Studio.
  // Khi có release server riêng, bật lại bằng AI_VIDEO_STUDIO_ENABLE_UPDATES=1.
  if (app.isPackaged && process.env.AI_VIDEO_STUDIO_ENABLE_UPDATES === '1') setupAutoUpdate();
  app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(await resolveStartUrl()); });
});

app.on('window-all-closed', () => {
  shutdownOwnedResources();
  if (process.platform !== 'darwin') app.quit();
});

