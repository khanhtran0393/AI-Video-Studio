'use strict';
/**
 * IPC cho backend giọng nói (OmniVoice / voice-studio) đóng gói kèm app.
 */
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { app, shell, dialog, ipcMain } = require('electron');
const state = require('../state');
const { novaRoot, unpackedNovaRoot, canWriteDir } = require('../fs-utils');
const voiceNative = require('../../voice-native');
const { FFMPEG, run } = require('../../native-tools/ffmpeg');

// ── Trần nén WAV khi persist (khớp trần prune 64MB/bản của voiceZoneList) ──
// Bản gộp kịch bản dài (WAV PCM 16-bit ~10MB/phút) vượt trần này → nếu ghi
// nguyên bản, lần list sau prune sẽ xoá ngay; renderer cũng âm thầm bỏ qua.
// Giải pháp: nén sang MP3 bằng ffmpeg-static có sẵn (~1/5 kích thước) — lỗi
// nén trả lỗi lộ liễu VOICE_COMPRESS_FAILED (Luật 10, không fallback ngầm).
const VOICE_WAV_COMPRESS_BYTES = 64 * 1024 * 1024;
async function nenWavNeuTo(dir, id, buf) {
  if (buf.length <= VOICE_WAV_COMPRESS_BYTES) return { buf, ext: '.wav' };
  const wavPath = path.join(dir, id + '.tmp-nen.wav');
  const mp3Path = path.join(dir, id + '.tmp-nen.mp3');
  try {
    await fsp.writeFile(wavPath, Buffer.from(buf));
    await run(FFMPEG, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path]);
    const mp3 = await fsp.readFile(mp3Path);
    if (!mp3.length) throw new Error('MP3 rỗng sau nén');
    return { buf: new Uint8Array(mp3), ext: '.mp3' };
  } finally {
    try { await fsp.rm(wavPath, { force: true }); } catch (_) {}
    try { await fsp.rm(mp3Path, { force: true }); } catch (_) {}
  }
}

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
  function voiceSampleDir(){
    return path.join(app.getPath('userData'), 'voice-sample-cache');
  }
  // Trần dung lượng cache mẫu nghe thử: vượt trần thì dọn file CŨ NHẤT trước (LRU)
  // để cache không phình vô hạn khi người dùng nghe thử nhiều giọng.
  const VOICE_SAMPLE_CAP_BYTES = 50 * 1024 * 1024;
  async function voiceSampleGomDu(){
    try {
      const dir = voiceSampleDir();
      let names;
      try { names = await fsp.readdir(dir); } catch { return; }
      const stats = await Promise.all(names.filter((f) => f.endsWith('.txt')).map(async (f) => {
        try {
          const st = await fsp.stat(path.join(dir, f));
          return { file: path.join(dir, f), bytes: st.size, mtime: st.mtimeMs };
        } catch { return null; }
      }));
      const files = stats.filter(Boolean);
      let total = files.reduce((s, x) => s + x.bytes, 0);
      files.sort((a, b) => a.mtime - b.mtime);   // cũ nhất trước
      for (const x of files){
        if (total <= VOICE_SAMPLE_CAP_BYTES) break;
        try { await fsp.rm(x.file, { force: true }); total -= x.bytes; } catch (_) {}
      }
    } catch (_) {}
  }
  ipcMain.handle('voice-sample-save', async (_e, payload = {}) => {
    try {
      const { key, dataUrl, sp, p } = payload || {};
      if (!key || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || dataUrl.length > 16 * 1024 * 1024) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
      const file = voiceSampleFile(key);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      // Format v2: gói tham số tốc độ/cao độ lúc gen cùng dataURL — renderer đọc ra
      // so khớp, lệch tham số thì gen lại và ghi đè (đĩa luôn 1 file / giọng + engine).
      await fsp.writeFile(file, JSON.stringify({ v: 2, sp: typeof sp === 'number' ? sp : null, p: typeof p === 'number' ? p : null, dataUrl }), 'utf8');
      await voiceSampleGomDu();
      return { ok: true };
    } catch (e) { return { error: String((e && e.message) || e) }; }
  });
  ipcMain.handle('voice-sample-load', async (_e, key) => {
    try {
      const file = voiceSampleFile(key);
      let raw;
      try { raw = await fsp.readFile(file, 'utf8'); } catch { return { missing: true }; }
      if (typeof raw !== 'string' || !raw.length) return { missing: true };
      // Format v2 (JSON có tham số): trả nguyên object để renderer so khớp tham số.
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.dataUrl === 'string' && obj.dataUrl.startsWith('data:')){
          return { ok: true, dataUrl: obj.dataUrl, sp: typeof obj.sp === 'number' ? obj.sp : null, p: typeof obj.p === 'number' ? obj.p : null };
        }
      } catch (_) {}
      // File v1 cũ (dataURL trần) — trả sp/p trống, renderer coi là lệch tham số
      // và sẽ gen lại + ghi đè, không cần migration.
      if (raw.startsWith('data:')) return { ok: true, dataUrl: raw, sp: null, p: null };
      return { missing: true };
    } catch (e) { return { missing: true }; }
  });
  // Danh sách mẫu đã cache trên đĩa: renderer dùng để vẽ badge "đã có mẫu — phát
  // ngay" trên nút ▶ mà không phải probe từng giọng (mỗi lần load là 1 dataURL nặng).
  ipcMain.handle('voice-sample-list', async () => {
    try {
      const dir = voiceSampleDir();
      let names;
      try { names = await fsp.readdir(dir); } catch { return { ok: true, items: [] }; }
      const items = (await Promise.all(names.filter((f) => f.endsWith('.txt')).map(async (f) => {
        try {
          const st = await fsp.stat(path.join(dir, f));
          return { key: f.slice(0, -4), bytes: st.size, mtime: st.mtimeMs };
        } catch { return null; }
      }))).filter(Boolean);
      return { ok: true, items };
    } catch (e) { return { error: String((e && e.message) || e) }; }
  });
  ipcMain.handle('voice-sample-clear', async (_e, key) => {
    try {
      if (key == null || key === ''){
        await fsp.rm(path.join(app.getPath('userData'), 'voice-sample-cache'), { recursive: true, force: true });
        return { ok: true };
      }
      try { await fsp.rm(voiceSampleFile(key), { force: true }); } catch (_) {}
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

  async function voiceZoneSave(payload){
    const { khi, ext, buf, meta, cache } = payload || {};
    const id = String(khi || '').replace(/[^0-9]/g, '').slice(0, 16);
    if (!id || !(buf instanceof Uint8Array) || !buf.length) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
    // WAV quá to (>64MB — bản gộp kịch bản dài) → nén MP3 trước khi ghi để nằm
    // trong trần prune của vùng; meta.ext đuổi theo định dạng lưu THẬT.
    let luu;
    try { luu = await nenWavNeuTo(voiceZoneDir(!!cache), id, buf); }
    catch (e) { return { error: 'VOICE_COMPRESS_FAILED: nén WAV quá lớn thất bại — ' + String((e && e.message) || e) }; }
    const metaLuu = Object.assign({}, (meta && typeof meta === 'object') ? meta : {}, { ext: luu.ext });
    const dir = voiceZoneDir(!!cache);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, id + luu.ext), Buffer.from(luu.buf));
    await fsp.writeFile(path.join(dir, id + '.json'), JSON.stringify(metaLuu), 'utf8');
    return { ok: true, ext: luu.ext };
  }
  // Liệt kê 1 vùng + prune (≤40 bản mới nhất, ≤64MB — phần cũ xoá cho nhẹ đĩa).
  async function voiceZoneList(cache){
    const dir = voiceZoneDir(!!cache);
    let names;
    try { names = await fsp.readdir(dir); } catch { return { ok: true, items: [] }; }
    const entries = [];
    for (const f of names){
      if (!f.endsWith('.json')) continue;
      const audio = f.slice(0, -5);
      try {
        const meta = JSON.parse(await fsp.readFile(path.join(dir, f), 'utf8'));
        const size = (await fsp.stat(path.join(dir, audio))).size;
        entries.push({ meta, audio, size });
      } catch (_) {   // json mồ côi (mất file audio) — dọn luôn
        try { await fsp.rm(path.join(dir, f), { force: true }); } catch (_) {}
      }
    }
    entries.sort((a, b) => (b.meta && b.meta.khi || 0) - (a.meta && a.meta.khi || 0));
    const giu = []; let tong = 0;
    for (const e of entries){
      if (giu.length < 40 && tong + e.size <= 64 * 1024 * 1024){ giu.push(e); tong += e.size; }
      else { try { await fsp.rm(path.join(dir, e.audio), { force: true }); } catch (_) {} try { await fsp.rm(path.join(dir, e.audio + '.json'), { force: true }); } catch (_) {} }
    }
    const items = [];
    for (const e of giu){
      try { items.push({ meta: e.meta, buf: new Uint8Array(await fsp.readFile(path.join(dir, e.audio))) }); } catch (_) {}
    }
    return { ok: true, items };
  }
  // Xoá 1 bản khỏi vùng chỉ định — xoá cả audio lẫn meta json.
  async function voiceZoneDelete(khi, cache){
    const id = String(khi || '').replace(/[^0-9]/g, '').slice(0, 16);
    if (!id) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
    const dir = voiceZoneDir(!!cache);
    for (const f of [id + '.mp3', id + '.wav', id + '.json']){
      try { await fsp.rm(path.join(dir, f), { force: true }); } catch (_) {}
    }
    return { ok: true };
  }

  ipcMain.handle('voice-history-save', async (_e, payload = {}) => {
    try { return await voiceZoneSave(payload); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  });
  ipcMain.handle('voice-history-list', async (_e, cache) => {
    try { return await voiceZoneList(!!cache); }
    catch (e) { return { error: String((e && e.message) || e), items: [] }; }
  });
  ipcMain.handle('voice-history-delete', async (_e, khi, cache) => {
    try { return await voiceZoneDelete(khi, !!cache); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  });
  // Đường dẫn file audio của 1 bản "Đã tạo" (khi + cache) — cho tính năng khác
  // (vd Whiteboard Studio "🎙 Dùng giọng đã tạo") dùng lại giọng ĐÃ SINH mà không
  // mở dialog chọn file. Không đọc/ghi nội dung — chỉ trả path nếu file còn tồn
  // tại; bị xoá/prune → lỗi lộ liễu (không fallback ngầm — Luật 10).
  async function voiceZonePath(khi, cache){
    const id = String(khi || '').replace(/[^0-9]/g, '').slice(0, 16);
    if (!id) return { error: 'DỮ_LIỆU_KHÔNG_HỢP_LỆ' };
    const dir = voiceZoneDir(!!cache);
    for (const f of [id + '.mp3', id + '.wav']){
      const p = path.join(dir, f);
      try { await fsp.access(p); return { ok: true, path: p }; } catch (_) {}
    }
    return { error: 'WB_VOICE_GONE: bản giọng không còn trên đĩa (đã bị xoá/prune) — tạo lại giọng.' };
  }
  ipcMain.handle('voice-history-path', async (_e, khi, cache) => {
    try { return await voiceZonePath(khi, !!cache); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  });

  voiceNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('voice-log', line); } catch {} });
}

module.exports = { registerVoiceIpc };
