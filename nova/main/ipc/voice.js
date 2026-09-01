'use strict';
/**
 * IPC cho backend giọng nói (OmniVoice / voice-studio) đóng gói kèm app.
 */
const path = require('path');
const fs = require('fs');
const { app, shell, dialog, ipcMain } = require('electron');
const state = require('../state');
const { novaRoot, unpackedNovaRoot, canWriteDir } = require('../fs-utils');
const voiceNative = require('../../voice-native.plain');

function registerVoiceIpc() {
  // ── Voice native: khởi động backend giọng nói (OmniVoice) khi mở tab Tạo giọng nói ──
  ipcMain.handle('voice-start', () => voiceNative.start());
  ipcMain.handle('voice-status', () => voiceNative.status());
  ipcMain.handle('voice-probe', () => { try { return voiceNative.probe(); } catch (e) { return { hasRoot: false, hasPython: false }; } });
  ipcMain.handle('voice-pick-root', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, { title: 'Chọn thư mục voice-studio đã cài', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return voiceNative.setRoot(r.filePaths[0]);
    } catch (e) { return { error: String(e) }; }
  });
  // Chép backend giọng nói (đóng gói sẵn trong app) TỰ ĐỘNG vào thư mục trong app — khách KHÔNG cần chọn nơi lưu
  ipcMain.handle('voice-install-backend', async () => {
    try {
      // File nằm trong app.asar.unpacked (asarUnpack) — dùng đường dẫn THẬT để cpSync/opendir đọc/ghi được
      const base = unpackedNovaRoot();
      // Nơi cài cố định: <thư mục app>/voice-studio. Không ghi được thì dùng userData/voice-studio.
      let dest = path.join(base, 'voice-studio');
      if (!canWriteDir(base)) {
        try { dest = path.join(app.getPath('userData'), 'voice-studio'); } catch { return { error: 'Không xác định được thư mục cài.' }; }
      }
      let src = path.join(base, 'voice-backend');
      if (!fs.existsSync(path.join(src, 'backend', 'app.py'))) {
        const alt = path.join(novaRoot(), 'voice-backend');   // dự phòng (dev/npm start)
        if (fs.existsSync(path.join(alt, 'backend', 'app.py'))) src = alt;
        else return { error: 'Không tìm thấy backend đóng gói trong app.' };
      }
      fs.cpSync(src, dest, { recursive: true });
      const set = voiceNative.setRoot(dest);
      try { shell.openPath(dest); } catch {}
      return { ok: true, path: dest, warn: set && set.error ? set.error : null };
    } catch (e) { return { error: String(e) }; }
  });
  voiceNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('voice-log', line); } catch {} });
}

module.exports = { registerVoiceIpc };
