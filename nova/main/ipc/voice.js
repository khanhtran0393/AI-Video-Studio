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

function hasVoiceBackend(root) {
  if (!root) return false;
  try {
    return fs.existsSync(path.join(root, 'backend', 'app.py'))
      && fs.existsSync(path.join(root, 'backend', 'config.py'));
  } catch {
    return false;
  }
}

function resolveBundledVoiceBackendRoot() {
  const candidates = [
    // Phiên bản đóng gói theo Electron: .../app.asar.unpacked/nova/voice-backend
    path.join(unpackedNovaRoot(), 'voice-backend'),
    // fallback cho dev/npm start
    path.join(novaRoot(), 'voice-backend'),
  ];

  for (const c of candidates) {
    if (hasVoiceBackend(c)) return c;
  }
  return null;
}

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

  // Chép backend giọng nói (đóng gói sẵn trong app) TỰ ĐỘNG vào thư viện ứng dụng.
  ipcMain.handle('voice-install-backend', async () => {
    try {
      const src = resolveBundledVoiceBackendRoot();
      if (!src) return { error: 'Không tìm thấy backend đóng gói trong app.' };

      // Luôn ưu tiên cài vào app (đúng thư mục unpacked/nova) nếu có quyền ghi; nếu không thì fallback sang userData.
      let dest = path.join(unpackedNovaRoot(), 'voice-studio');
      if (!canWriteDir(dest)) {
        try {
          dest = path.join(app.getPath('userData'), 'voice-studio');
        } catch {
          return { error: 'Không xác định được thư mục cài.' };
        }
      }

      fs.cpSync(src, dest, { recursive: true });
      const set = voiceNative.setRoot(dest);
      try { shell.openPath(dest); } catch {}
      return { ok: true, path: dest, warn: set && set.error ? set.error : null };
    } catch (e) {
      return { error: String(e) };
    }
  });
  voiceNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('voice-log', line); } catch {} });
}

module.exports = { registerVoiceIpc };
