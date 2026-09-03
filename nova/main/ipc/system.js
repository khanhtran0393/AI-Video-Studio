'use strict';
/**
 * IPC hệ thống: thông số máy (RAM/CPU), thu nhỏ/phóng cửa sổ khi đăng nhập,
 * version app, thư mục xuất mặc định, điều khiển auto-update.
 */
const os = require('os');
const path = require('path');
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const state = require('../state');
const { appTempDir, cleanupTempOrphans } = require('../../core/temp');
const { freeBytes, pruneDirectoryOlder } = require('../../storage/disk-guard');

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

  // ── Bảo vệ ổ đĩa (NVMe/SSD): xem dung lượng trống + dọn file tạm + retention job cũ ──
  ipcMain.handle('disk-guard:status', () => {
    const drives = [];
    for (const key of ['videos', 'downloads', 'home']) {
      try { const p = app.getPath(key); if (p) { drives.push({ name: 'export', dir: p, freeBytes: freeBytes(p) }); break; } } catch (e) {}
    }
    try { drives.push({ name: 'temp', dir: appTempDir(), freeBytes: freeBytes(appTempDir()) }); } catch (e) {}
    try { const p = app.getPath('userData'); drives.push({ name: 'userData', dir: p, freeBytes: freeBytes(p) }); } catch (e) {}
    return { drives };
  });

  // Dọn file tạm mồ côi của app (mặc định cũ hơn 1 ngày; truyền days để đổi).
  ipcMain.handle('disk-guard:cleanup-temp', (_e, days) => {
    try {
      const ms = Number(days) > 0 ? Number(days) * 24 * 60 * 60 * 1000 : undefined;
      return { ok: true, ...cleanupTempOrphans(ms) };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Retention job cũ: XOÁ hẳn thư mục job cũ hơn N ngày — chỉ chạy khi user chủ động
  // gọi kèm root (thư mục chứa các job, vd D:\AI Video Studio\artifacts) + số ngày. Không tự chạy.
  ipcMain.handle('disk-guard:prune-artifacts', (_e, args) => {
    try {
      const root = args && String(args.root || '');
      const days = Math.round(Number(args && args.days));
      if (!path.isAbsolute(root)) return { ok: false, error: 'Cần đường dẫn gốc tuyệt đối (thư mục cha của các job).' };
      if (!(days > 0)) return { ok: false, error: 'Số ngày phải > 0 để tránh xoá nhầm job mới.' };
      return { ok: true, ...pruneDirectoryOlder(root, days) };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}

module.exports = { registerSystemIpc };
