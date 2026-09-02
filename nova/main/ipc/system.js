'use strict';
/**
 * IPC hệ thống: thông số máy (RAM/CPU), thu nhỏ/phóng cửa sổ khi đăng nhập,
 * version app, thư mục xuất mặc định, điều khiển auto-update.
 */
const os = require('os');
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const state = require('../state');

function registerSystemIpc() {
  // Thu nhỏ cửa sổ khi ở màn đăng nhập, phóng lại khi vào app.
  ipcMain.handle('login-window', (_e, isLogin) => {
    try {
      const win = state.mainWindow;
      if (!win || win.isDestroyed()) return;
      if (isLogin) {
        if (win.isMaximized()) win.unmaximize();
        win.setResizable(false);
        win.setMinimumSize(420, 560);
        win.setSize(460, 720, true);
        win.center();
      } else {
        win.setResizable(true);
        win.setMinimumSize(1024, 640);
        win.setSize(1440, 900, true);
        win.center();
      }
    } catch (e) {}
  });

  // ── Thông số hệ thống THẬT cho thanh trạng thái (RAM/CPU) ──
  ipcMain.handle('sys-stats', () => {
    try {
      const total = os.totalmem(), free = os.freemem();
      return { ramTotal: total, ramUsed: total - free, cpuCount: (os.cpus() || []).length, platform: os.platform() };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('app-version', () => app.getVersion());
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
