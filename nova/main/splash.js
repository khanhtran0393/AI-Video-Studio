'use strict';
/**
 * Cửa sổ splash (logo khi khởi động).
 * - Transparent, không alwaysOnTop, không hiện taskbar.
 * - Logo phải hiện đủ SPLASH_MIN_MS; mốc tính từ ready-to-show (lúc logo THỰC SỰ lên màn hình).
 */
const path = require('path');
const { BrowserWindow } = require('electron');
const state = require('./state');
const { ensureBrandAsset, brandIconPath } = require('./brand');

function createSplashWindow() {
  if (state.isQuitting) return null;
  ensureBrandAsset();
  state.splashShownAt = 0;
  state.splashWindow = new BrowserWindow({
    width: 820,
    height: 360,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    // Không ghim splash lên trên mọi cửa sổ. Đây là cửa sổ tạm thời; nếu tiến trình
    // bị kill đột ngột, alwaysOnTop có thể để lại một mảng đen nổi trên desktop.
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    icon: brandIconPath(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  state.splashWindow.loadFile(path.join(__dirname, '..', 'electron', 'splash.html'));
  // Không ghi đè logo vì splash.html đã có src đúng.
  state.splashWindow.once('ready-to-show', () => {
    if (state.splashWindow && !state.splashWindow.isDestroyed()) {
      state.splashShownAt = Date.now();   // mốc tính "hiển thị đủ 5 giây" là lúc logo thực sự lên màn hình
      state.splashWindow.show();
    }
  });
  state.splashWindow.webContents.once('did-fail-load', () => closeSplashWindow(true));
  state.splashWindow.on('closed', () => { state.splashWindow = null; });
  return state.splashWindow;
}

function closeSplashWindow(immediate = false) {
  if (state.splashCloseTimer) {
    clearTimeout(state.splashCloseTimer);
    state.splashCloseTimer = null;
  }
  if (!state.splashWindow || state.splashWindow.isDestroyed()) return;
  const current = state.splashWindow;
  state.splashWindow = null;
  if (immediate) {
    try { current.setAlwaysOnTop(false); } catch (_) {}
    try { current.destroy(); } catch (_) { /* already closed */ }
    return;
  }
  try {
    current.webContents.executeJavaScript(`document.body.style.transition = 'opacity .28s ease'; document.body.style.opacity = '0';`)
      .catch(() => {})
      .finally(() => {
        state.splashCloseTimer = setTimeout(() => {
          state.splashCloseTimer = null;
          // PHẢI destroy() chứ không close(): splash tạo với closable:false và
          // trên Windows close() với cửa sổ closable:false là NO-OP → splash tàng
          // hình sống mãi → window-all-closed không bao giờ fire → app không bao
          // giờ thoát (harness phải force-kill, exit code rác); cửa sổ trong suốt
          // còn chặn click chuột vào vùng 820x360 của cửa sổ chính.
          if (!current.isDestroyed()) current.destroy();
        }, 300);
      });
  } catch (_) {
    try { current.destroy(); } catch (_) { /* ignore */ }
  }
}

module.exports = { createSplashWindow, closeSplashWindow };
