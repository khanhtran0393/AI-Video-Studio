'use strict';

/**
 * §32 — UI WINDOW. Mở panel Documentary NGAY TRONG cửa sổ chính của app.
 *
 * Chính sách: MỌI công cụ chức năng phải chạy trong app — KHÔNG tạo BrowserWindow
 * riêng. UI Documentary trong app là tab "🎬 Video Agent" trên sidebar
 * (nova/web/video-agent-panel.js chạy trên bridge window.native.documentary —
 * create/list/read/runFull/render/unlock/presets/providers), nên mở Documentary
 * = focus cửa sổ chính rồi switchTool('toolvideoagent'), đúng pattern
 * nova/video-agent/window.js. Bản web/documentary.html + documentary-panel.js
 * giờ chỉ là di sản (không còn điểm mở) — giữ lại để đối chiếu.
 * Ngoại lệ duy nhất được phép mở cửa sổ ngoài là đăng nhập tài khoản bên thứ 3
 * (popup Google/Firebase trong nova/main/window.js, cửa sổ Flow trong nova/flow-native).
 *
 * Giữ tên export `openDocumentaryWindow` để các nơi đang require
 * (editor-pro/register.js, ipc §32) không đổi.
 * Lazy require electron để module vẫn nạp được ngoài main process (test, plain node).
 */

const state = require('../main/state');

function openDocumentaryWindow() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return null;   // không có cửa sổ chính → không mở gì cả (không sinh cửa sổ ngoài)
  const switchToTab = () => {
    try {
      win.webContents
        .executeJavaScript("(() => { if (typeof switchTool === 'function') { switchTool('toolvideoagent'); return true; } return false; })()", true)
        .catch(() => {});
    } catch (_) {}
  };
  try { if (win.isMinimized()) win.restore(); } catch (_) {}
  try { win.show(); win.focus(); } catch (_) {}
  if (win.webContents.isLoadingMainFrame()) {
    try { win.webContents.once('did-finish-load', switchToTab); } catch (_) {}
  } else {
    switchToTab();
  }
  return win;
}

module.exports = { openDocumentaryWindow };