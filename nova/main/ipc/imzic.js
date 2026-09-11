'use strict';
/**
 * IPC cho tool I-MZic (nova/web/img-to-vid.html) — ghép video câm (webm) với
 * nhạc GỐC bằng FFmpeg có sẵn trong app (-c copy: không mã hoá lại → không giảm chất lượng).
 *
 * Kênh: 'imzic-mux' (ipcMain.handle, gọi từ preload `window.native.imzicMux`).
 * Luồng: renderer gửi 2 buffer (Uint8Array) → ghi file tạm trong os.tmpdir →
 * chạy ffmpeg → dialog chọn chỗ lưu → copy kết quả tới đích → dọn file tạm.
 *
 * Không fallback ngầm (Luật 10): thiếu ffmpeg / payload lỗi / ffmpeg exit != 0
 * đều trả về { ok:false, code, message } có ý nghĩa; người dùng bỏ dialog → { canceled:true }.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { dialog, BrowserWindow, ipcMain } = require('electron');

function ffmpegPath() {
  try {
    const p = require('ffmpeg-static');
    if (p) return p.replace('app.asar', 'app.asar.unpacked');
  } catch (_) {
    // ffmpeg-static chưa cài — trả null, caller báo lỗi lộ liễu với error code
  }
  return null;
}

function safeExt(name, fallback) {
  const m = String(name || '').match(/(\.[a-zA-Z0-9]{1,8})$/);
  return (m && m[1]) || fallback;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = ffmpegPath();
    if (!ff) {
      return reject(Object.assign(new Error('Không tìm thấy ffmpeg binary (ffmpeg-static)'), { code: 'IMZIC_FFMPEG_UNAVAILABLE' }));
    }
    const proc = spawn(ff, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });
    proc.on('error', err => reject(Object.assign(err, { code: 'IMZIC_FFMPEG_SPAWN' })));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error('ffmpeg exit ' + code + ': ' + stderr.slice(-800)), { code: 'IMZIC_FFMPEG_EXIT' }));
    });
  });
}

function registerImzicIpc() {
  ipcMain.handle('imzic-mux', async (event, payload) => {
    let tmpDir = null;
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const isBytes = v => v && (v instanceof Uint8Array || v instanceof ArrayBuffer || Buffer.isBuffer(v));
      if (!isBytes(p.video) || !isBytes(p.audio)) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu dữ liệu video hoặc nhạc để ghép.' };
      }
      const videoBuf = Buffer.from(p.video instanceof ArrayBuffer ? new Uint8Array(p.video) : p.video);
      const audioBuf = Buffer.from(p.audio instanceof ArrayBuffer ? new Uint8Array(p.audio) : p.audio);
      if (!videoBuf.length || !audioBuf.length) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'File video hoặc nhạc rỗng (0 byte).' };
      }

      const stamp = process.pid + '_' + Date.now();
      tmpDir = path.join(os.tmpdir(), 'imzic-mux-' + stamp);
      fs.mkdirSync(tmpDir, { recursive: true });
      const vidPath = path.join(tmpDir, 'video' + safeExt(p.videoName, '.webm'));
      const audPath = path.join(tmpDir, 'audio' + safeExt(p.audioName, '.bin'));
      const outPath = path.join(tmpDir, 'muxed.mkv');
      fs.writeFileSync(vidPath, videoBuf);
      fs.writeFileSync(audPath, audioBuf);

      try {
        // -c copy: giữ nguyên video VP8/VP9 + audio gốc (mp3/aac/opus/wav…) trong mkv
        await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', vidPath, '-i', audPath, '-c', 'copy', '-shortest', outPath]);
      } catch (err) {
        return { ok: false, code: err.code || 'IMZIC_FFMPEG_EXIT', message: err.message || String(err) };
      }

      const defaultName = 'ket_qua_' + new Date().toISOString().slice(0, 10) + '.mkv';
      const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
      const save = await dialog.showSaveDialog(parent, {
        title: 'Chọn chỗ lưu video đã ghép nhạc',
        defaultPath: defaultName,
        filters: [{ name: 'Video MKV', extensions: ['mkv'] }],
      });
      if (save.canceled || !save.filePath) {
        return { canceled: true };
      }
      fs.copyFileSync(outPath, save.filePath);
      return { ok: true, path: save.filePath };
    } catch (err) {
      return { ok: false, code: err.code || 'IMZIC_MUX_FAILED', message: err && err.message ? err.message : String(err) };
    } finally {
      // dọn file tạm kể cả khi thành công / lỗi / người dùng huỷ
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
    }
  });

  // Kênh 'imzic-offline-export' — "⚡ Xuất nhanh" của tool I-MZic: renderer đã
  // encode video H.264 (Annex B) bằng WebCodecs theo đồng hồ logic (offline,
  // deterministic), gửi bytes + nhạc gốc về đây → ffmpeg ghép thành .mp4:
  //   • -f h264 -r fps: raw Annex B stream đúng tần số khung
  //   • trim (trimStart/trimEnd) áp lên input nhạc (-ss/-t); video đã render
  //     đúng khoảng trim từ renderer nên không cần cắt lại
  //   • fadeIn/fadeOut → filter afade; có filter thì âm thanh mã hoá lại AAC
  //     192k, không thì copy stream giữ nguyên chất lượng gốc
  // Không fallback ngầm (Luật 10): thiếu ffmpeg / payload lỗi / exit != 0 trả
  // { ok:false, code, message } lộ rõ; bỏ dialog lưu → { canceled:true }.
  ipcMain.handle('imzic-offline-export', async (event, payload) => {
    let tmpDir = null;
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const isBytes = v => v && (v instanceof Uint8Array || v instanceof ArrayBuffer || Buffer.isBuffer(v));
      if (!isBytes(p.video) || !isBytes(p.audio)) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu dữ liệu video H.264 hoặc nhạc để ghép.' };
      }
      const videoBuf = Buffer.from(p.video instanceof ArrayBuffer ? new Uint8Array(p.video) : p.video);
      const audioBuf = Buffer.from(p.audio instanceof ArrayBuffer ? new Uint8Array(p.audio) : p.audio);
      if (!videoBuf.length || !audioBuf.length) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Dữ liệu video hoặc nhạc rỗng (0 byte).' };
      }
      const fps = Math.max(24, Math.min(60, +p.fps || 30));
      const trimStart = Math.max(0, +p.trimStart || 0);
      const trimEnd = Math.max(0, +p.trimEnd || 0);
      const fadeIn = Math.max(0, +p.fadeIn || 0);
      const fadeOut = Math.max(0, +p.fadeOut || 0);

      const stamp = process.pid + '_' + Date.now();
      tmpDir = path.join(os.tmpdir(), 'imzic-offline-' + stamp);
      fs.mkdirSync(tmpDir, { recursive: true });
      const vidPath = path.join(tmpDir, 'video.h264');
      const audPath = path.join(tmpDir, 'audio' + safeExt(p.audioName, '.bin'));
      const outPath = path.join(tmpDir, 'offline.mp4');
      fs.writeFileSync(vidPath, videoBuf);
      fs.writeFileSync(audPath, audioBuf);

      // -ss/-t đặt TRƯỚC -i thứ hai → chỉ áp lên input nhạc (video đã đúng khoảng)
      const args = ['-y', '-hide_banner', '-loglevel', 'error',
        '-fflags', '+genpts', '-f', 'h264', '-r', String(fps), '-i', vidPath];
      if (trimStart > 0) args.push('-ss', String(trimStart));
      if (trimEnd > trimStart) args.push('-t', String(trimEnd - trimStart));
      args.push('-i', audPath);
      const filters = [];
      if (fadeIn > 0) filters.push('afade=t=in:st=0:d=' + fadeIn);
      if (fadeOut > 0 && trimEnd > trimStart) {
        const dur = trimEnd - trimStart;
        filters.push('afade=t=out:st=' + Math.max(0, dur - fadeOut).toFixed(3) + ':d=' + fadeOut);
      }
      if (filters.length) {
        args.push('-af', filters.join(','));
        args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
      } else {
        args.push('-c:v', 'copy', '-c:a', 'copy');
      }
      args.push('-shortest', outPath);

      try {
        await runFfmpeg(args);
      } catch (err) {
        return { ok: false, code: err.code || 'IMZIC_FFMPEG_EXIT', message: err.message || String(err) };
      }

      const defaultName = 'video_imzic_' + new Date().toISOString().slice(0, 10) + '.mp4';
      const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
      const save = await dialog.showSaveDialog(parent, {
        title: 'Chọn chỗ lưu video xuất nhanh (.mp4)',
        defaultPath: defaultName,
        filters: [{ name: 'Video MP4', extensions: ['mp4'] }],
      });
      if (save.canceled || !save.filePath) {
        return { canceled: true };
      }
      fs.copyFileSync(outPath, save.filePath);
      return { ok: true, path: save.filePath };
    } catch (err) {
      return { ok: false, code: err.code || 'IMZIC_OFFLINE_FAILED', message: err && err.message ? err.message : String(err) };
    } finally {
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
    }
  });
}

module.exports = { registerImzicIpc };
