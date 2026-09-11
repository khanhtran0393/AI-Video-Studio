'use strict';
/**
 * IPC hệ thống: thư mục xuất mặc định, điều khiển auto-update.
 * (Đã gỡ: 'login-window', 'sys-stats', 'app-version', 'disk-guard:*' — renderer
 *  không bao giờ gọi; MEMORY 2026-09-11q.)
 */
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

function registerSystemIpc() {
  // Thư mục xuất mặc định. Trên Windows getPath('videos'/'downloads') đọc known-folder
  // từ profile — nếu thư mục đó bị xoá/redirect (OneDrive không mount...) thì Electron ném
  // lỗi. Phải thử lần lượt rồi rơi về home/userData, KHÔNG để exception thoát handler
  // (lỗi cũ: catch lại gọi getPath('downloads') lần nữa → ném tiếp).
  ipcMain.handle('export-dir', () => {
    for (const key of ['videos', 'downloads', 'home']) {
      try { const p = app.getPath(key); if (p) return p; } catch (e) {}
    }
    try { return app.getPath('userData'); } catch (e) { return ''; }
  });
  ipcMain.handle('update-download', () => { try { autoUpdater.downloadUpdate(); return true; } catch (e) { return false; } });
  ipcMain.handle('update-install', () => { try { autoUpdater.quitAndInstall(); return true; } catch (e) { return false; } });
}

module.exports = { registerSystemIpc };
