'use strict';

/**
 * §25 UI WINDOW — mở Video Agent NGAY TRONG cửa sổ chính của app (tab "Video Agent"
 * trên sidebar → switchTool('toolvideoagent'), panel của nova/web/video-agent-panel.js).
 *
 * Chính sách: MỌI công cụ chức năng phải chạy trong app — KHÔNG tạo BrowserWindow riêng.
 * Ngoại lệ duy nhất được phép mở cửa sổ ngoài là đăng nhập tài khoản bên thứ 3
 * (popup Google/Firebase trong nova/main/window.js, cửa sổ Flow trong nova/flow-native).
 *
 * Giữ tên export `openVideoAgentWindow` để các nơi đang require (menu, ipc §25) không đổi.
 * Lazy require electron để module vẫn nạp được ngoài main process (test, plain node).
 */

const state = require('../main/state');

function openVideoAgentWindow() {
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

module.exports = { openVideoAgentWindow };
