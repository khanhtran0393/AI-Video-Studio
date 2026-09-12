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
ipcMain.handle('voice-engines', () => require('../../voice-native/engines').listEngines());
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

  // ── Lịch sử "Đã tạo" (tab Tạo giọng nói) persist trên đĩa ────────────────
  // HAI vùng lưu, cùng cơ chế file (audio nhị phân + meta .json cùng tên):
  //   • userData/voice-history — SẢN PHẨM CUỐI (bản gộp / bản gen đơn lẻ).
  //   • userData/voice-cache   — CACHE ĐOẠN TÁCH khi gen kịch bản nhiều đoạn
  //     (cache riêng của profile — tắt mở app vẫn còn, khác voice-history để
  //     dọn/sự cố không đụng sản phẩm cuối; voice-sample-clear cũng không đụng).
  // Handler dùng chung, phân vùng bằng cờ `cache` trong payload/tham số.
  function voiceHistoryDir(){ return path.join(app.getPath('userData'), 'voice-history'); }
  function voiceCacheDir(){ return path.join(app.getPath('userData'), 'voice-cache'); }
  function voiceZoneDir(cache){ return cache ? voiceCacheDir() : voiceHistoryDir(); }

  function voiceZoneSave(payload){
    const { khi, ext, buf, meta, cache } = payload || {};
    const id = String(khi || '').replace(/[^0-9]/g, '').slice(0, 16);
    if (!id || !(buf instanceof Uint8Array) || !buf.length) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
    const dir = voiceZoneDir(!!cache);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + (ext === '.mp3' ? '.mp3' : '.wav')), Buffer.from(buf));
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(meta && typeof meta === 'object' ? meta : {}), 'utf8');
    return { ok: true };
  }
  // Liệt kê 1 vùng + prune (≤40 bản mới nhất, ≤64MB — phần cũ xoá cho nhẹ đĩa).
  function voiceZoneList(cache){
    const dir = voiceZoneDir(!!cache);
    if (!fs.existsSync(dir)) return { ok: true, items: [] };
    const entries = [];
    for (const f of fs.readdirSync(dir)){
      if (!f.endsWith('.json')) continue;
      const audio = f.slice(0, -5);
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const size = fs.statSync(path.join(dir, audio)).size;
        entries.push({ meta, audio, size });
      } catch (_) {   // json mồ côi (mất file audio) — dọn luôn
        try { fs.rmSync(path.join(dir, f), { force: true }); } catch (_) {}
      }
    }
    entries.sort((a, b) => (b.meta && b.meta.khi || 0) - (a.meta && a.meta.khi || 0));
    const giu = []; let tong = 0;
    for (const e of entries){
      if (giu.length < 40 && tong + e.size <= 64 * 1024 * 1024){ giu.push(e); tong += e.size; }
      else { try { fs.rmSync(path.join(dir, e.audio), { force: true }); } catch (_) {} try { fs.rmSync(path.join(dir, e.audio + '.json'), { force: true }); } catch (_) {} }
    }
    const items = [];
    for (const e of giu){
      try { items.push({ meta: e.meta, buf: new Uint8Array(fs.readFileSync(path.join(dir, e.audio))) }); } catch (_) {}
    }
    return { ok: true, items };
  }
  // Xoá 1 bản khỏi vùng chỉ định — xoá cả audio lẫn meta json.
  function voiceZoneDelete(khi, cache){
    const id = String(khi || '').replace(/[^0-9]/g, '').slice(0, 16);
    if (!id) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
    const dir = voiceZoneDir(!!cache);
    for (const f of [id + '.mp3', id + '.wav', id + '.json']){
      try { fs.rmSync(path.join(dir, f), { force: true }); } catch (_) {}
    }
    return { ok: true };
  }

  ipcMain.handle('voice-history-save', (_e, payload = {}) => {
    try { return voiceZoneSave(payload); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  });
  ipcMain.handle('voice-history-list', (_e, cache) => {
    try { return voiceZoneList(!!cache); }
    catch (e) { return { error: String((e && e.message) || e), items: [] }; }
  });
  ipcMain.handle('voice-history-delete', (_e, khi, cache) => {
    try { return voiceZoneDelete(khi, !!cache); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  });

  voiceNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('voice-log', line); } catch {} });
}

module.exports = { registerVoiceIpc };
