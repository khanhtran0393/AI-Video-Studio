'use strict';
/**
 * Cửa sổ chính của app (AI Video Studio).
 * - Tạo BrowserWindow, reveal sau khi trang tải xong (chờ splash đủ SPLASH_MIN_MS).
 * - Popup đăng nhập chỉ cho host trong AUTH_HOSTS; còn lại mở trình duyệt ngoài.
 * - Menu chuột phải tiếng Việt cho ô nhập.
 */
const path = require('path');
const { BrowserWindow, Menu, shell } = require('electron');
const state = require('./state');
const { AUTH_HOSTS, SPLASH_MIN_MS, SPLASH_MAX_MS } = require('./state');
const { NOVA_PARTITION } = require('./identity');
const { brandIconPath } = require('./brand');
const { closeSplashWindow } = require('./splash');

function createWindow(startUrl) {
  state.mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    autoHideMenuBar: true,   // ẩn thanh menu Tệp/Sửa/Xem (Windows/Linux) — nhấn Alt để hiện tạm; phím tắt copy/paste vẫn chạy
    title: 'AI Video Studio', backgroundColor: '#050505', show: false,
    icon: brandIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      partition: NOVA_PARTITION,
      webviewTag: true,   // cho phép nhúng Editor Pro qua <webview>
    },
  });
  let shown = false;
  const startedAt = Date.now();
  const reveal = () => {
    if (shown || !state.mainWindow || state.mainWindow.isDestroyed()) return;
    // Nếu splash chưa kịp hiện (ready-to-show chưa chạy) thì đợi thêm một nhịp rồi
    // thử lại, để mốc 5 giây tính từ lúc logo THỰC SỰ lên màn hình. Splash bị lỗi
    // (did-fail-load → đóng, splashWindow = null) thì hết điều kiện chờ, dùng startedAt.
    if (!state.splashShownAt && state.splashWindow && !state.splashWindow.isDestroyed()) {
      setTimeout(reveal, 100);
      return;
    }
    shown = true;
    // Đếm 5 giây từ lúc splash THỰC SỰ hiện (splashShownAt), không phải từ lúc
    // createWindow được gọi — nếu trang tải nhanh, logo vẫn phải đủ 5 giây thực tế.
    // Nếu splash không hiện được (did-fail-load) thì quay về startedAt để không chờ vô hạn.
    const base = state.splashShownAt || startedAt;
    const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - base));
    setTimeout(() => {
      if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
      state.mainWindow.show();
      closeSplashWindow();
    }, wait);
  };
  // Transparent splash window handles the branded loading screen.
  state.mainWindow.webContents.on('did-finish-load', reveal);
  state.mainWindow.webContents.on('did-fail-load', (_event, _code, _description, _validatedURL, isMainFrame) => {
    if (isMainFrame) reveal();
  });
  setTimeout(reveal, SPLASH_MAX_MS);
  state.mainWindow.loadURL(startUrl).catch(() => reveal());
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (AUTH_HOSTS.test(new URL(url).hostname)) {
        return { action: 'allow', overrideBrowserWindowOptions: { width: 500, height: 660, autoHideMenuBar: true, webPreferences: { partition: NOVA_PARTITION, contextIsolation: true, nodeIntegration: false } } };
      }
    } catch {}
    shell.openExternal(url);
    return { action: 'deny' };
  });
  attachContextMenu(state.mainWindow.webContents);
  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
    closeSplashWindow(true);
  });
}

// Menu chuột phải: Cắt / Sao chép / Dán / Chọn tất cả (cho ô nhập).
function attachContextMenu(wc) {
  wc.on('context-menu', (_e, params) => {
    const canText = params.isEditable || (params.selectionText && params.selectionText.trim().length);
    if (!canText) return;
    const items = [];
    if (params.editFlags.canCut) items.push({ role: 'cut', label: 'Cắt' });
    if (params.editFlags.canCopy) items.push({ role: 'copy', label: 'Sao chép' });
    if (params.editFlags.canPaste) items.push({ role: 'paste', label: 'Dán' });
    if (params.isEditable && params.editFlags.canSelectAll) items.push({ type: 'separator' }, { role: 'selectAll', label: 'Chọn tất cả' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(wc) });
  });
}

module.exports = { createWindow, attachContextMenu };
