'use strict';
/**
 * IPC cho backend giọng nói (OmniVoice / voice-studio) đóng gói kèm app.
 */
const path = require('path');
const fs = require('fs');
const { app, shell, dialog, ipcMain } = require('electron');
const state = require('../state');
const { novaRoot, unpackedNovaRoot, canWriteDir } = require('../fs-utils');
const voiceNative = require('../../voice-native');

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
  // ── Cache mẫu nghe thử trên đĩa (userData/voice-sample-cache) ──────────
  // Mẫu nghe thử ~4 giây chỉ nên sinh MỘT lần: model nạp lười lần đầu
  // 30-60s, để mỗi lần bấm nghe thử lại tạo mới thì khách tưởng app treo.
  // Renderer tự quản khoá (phiên bản cache + engine + khoá giọng); main chỉ
  // ghi/đọc/xoá file — file là dataURL ASCII nên dễ đọc lại thành Blob.
  function voiceSampleFile(key){
    const safe = String(key || '').replace(/[/\\:*?"<>|]+/g, '_').replace(/\.\.+/g, '_').slice(0, 180);
    return path.join(app.getPath('userData'), 'voice-sample-cache', safe + '.txt');
  }
  ipcMain.handle('voice-sample-save', (_e, payload = {}) => {
    try {
      const { key, dataUrl } = payload || {};
      if (!key || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || dataUrl.length > 16 * 1024 * 1024) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
      const file = voiceSampleFile(key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, dataUrl, 'utf8');
      return { ok: true };
    } catch (e) { return { error: String((e && e.message) || e) }; }
  });
  ipcMain.handle('voice-sample-load', (_e, key) => {
    try {
      const file = voiceSampleFile(key);
      if (!fs.existsSync(file)) return { missing: true };
      const dataUrl = fs.readFileSync(file, 'utf8');
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return { missing: true };
      return { ok: true, dataUrl };
    } catch (e) { return { missing: true }; }
  });
  ipcMain.handle('voice-sample-clear', (_e, key) => {
    try {
      if (key == null || key === ''){
        fs.rmSync(path.join(app.getPath('userData'), 'voice-sample-cache'), { recursive: true, force: true });
        return { ok: true };
      }
      try { fs.rmSync(voiceSampleFile(key), { force: true }); } catch (_) {}
      return { ok: true };
    } catch (e) { return { error: String((e && e.message) || e) }; }
  });

  voiceNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('voice-log', line); } catch {} });
}

module.exports = { registerVoiceIpc };
