'use strict';
/**
 * IPC cho tool I-MZic (nova/web/img-to-vid.html) — ghép video câm (webm) với
 * nhạc GỐC bằng FFmpeg có sẵn trong app (-c copy: không mã hoá lại → không giảm chất lượng).
 *
 * Kênh: 'imzic-mux', 'imzic-offline-export' (ipcMain.handle, gọi từ preload
 * `window.native.imzicMux` / `window.native.imzicOfflineExport`) và
 * 'imzic-cancel' (huỷ ffmpeg đang chạy giữa chừng theo cancelId).
 * Luồng: renderer gửi video bytes + nhạc (bytes HOẶC đường dẫn gốc `audioPath`
 * — Electron webUtils, né copy lớn qua IPC) → ghi file tạm trong os.tmpdir →
 * chạy ffmpeg → dialog chọn chỗ lưu → copy kết quả tới đích → dọn file tạm.
 *
 * Không fallback ngầm (Luật 10): thiếu ffmpeg / payload lỗi / ffmpeg exit != 0
 * / timeout / bị huỷ đều trả về { ok:false, code, message } có ý nghĩa;
 * người dùng bỏ dialog → { canceled:true }.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { dialog, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
// Hàm thuần (an toàn tên file, copy nguyên tử, preflight đĩa, kill-tree, dọn tmp)
// tách sang imzic-helpers.js để kiểm định sandbox được (test:imzic) — hợp đồng
// module.exports của file này GIỮ NGUYÊN: { registerImzicIpc }.
const {
  safeExt, safeBaseName, atomicCopyFile,
  assertDiskSpace, killProcessTree, sweepStaleImzicTmp, payloadAudioBytes,
} = require('./imzic-helpers');

// ---- registry tiến trình ffmpeg đang chạy theo cancelId (huỷ giữa chừng) ----
const imzicRunning = new Map();        // cancelId → ChildProcess
const imzicCancelRequested = new Set(); // cancelId đã nhận lệnh huỷ (để đặt code đúng)

function ffmpegPath() {
  try {
    const p = require('ffmpeg-static');
    if (p) return p.replace('app.asar', 'app.asar.unpacked');
  } catch (_) {
    // ffmpeg-static chưa cài — trả null, caller báo lỗi lộ liễu với error code
  }
  return null;
}


function runFfmpeg(args, opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs || 600000; // mặc định 10 phút
  return new Promise((resolve, reject) => {
    const ff = ffmpegPath();
    if (!ff) {
      return reject(Object.assign(new Error('Không tìm thấy ffmpeg binary (ffmpeg-static)'), { code: 'IMZIC_FFMPEG_UNAVAILABLE' }));
    }
    const proc = spawn(ff, args, { windowsHide: true });
    if (o.cancelId) imzicRunning.set(o.cancelId, proc);
    // D3: stderr chỉ giữ đuôi 64KB (ring) — log của ffmpeg trên file hỏng có thể
    // phình hàng trăm MB nếu tích luỹ cả bài; lỗi chỉ cần 800 ký tự cuối.
    let stderr = '';
    let done = false;
    let timer = null;
    const finish = (fn) => {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      if (o.cancelId) {
        imzicRunning.delete(o.cancelId);
        imzicCancelRequested.delete(o.cancelId);
      }
      fn();
    };
    // watchdog: ffmpeg treo (file hỏng, đĩa đầy, antivirus khoá file tạm) phải
    // chết có chủ đích — không được phép kẹt IPC vĩnh viễn (IMZIC_FFMPEG_TIMEOUT)
    timer = setTimeout(() => {
      killProcessTree(proc);
      finish(() => reject(Object.assign(
        new Error('ffmpeg chạy quá ' + Math.round(timeoutMs / 1000) + 's không xong — đã bị kill (file hỏng / đĩa đầy / tiến trình bị treo).'),
        { code: 'IMZIC_FFMPEG_TIMEOUT' })));
    }, timeoutMs);
    proc.stderr.on('data', d => { stderr = (stderr + String(d)).slice(-65536); });
    // D6: -progress pipe:1 — ffmpeg ghi "out_time_us=<giá trị>" ra stdout
    // (cả out_time_ms cũng là MICRO-giây — bug giữ nguyên để tương thích).
    // Chỉ bật khi opts.onProgress truyền vào; file lỗi → stdout im, vô hại.
    if (typeof o.onProgress === 'function') {
      let pbuf = '';
      proc.stdout.on('data', d => {
        pbuf = (pbuf + String(d)).slice(-2048);
        const lines = pbuf.split(/\r?\n/);
        pbuf = lines.pop() || '';
        let sec = null;
        for (const line of lines) {
          const m = /^(out_time_us|out_time_ms)=(\d+)\s*$/.exec(line.trim());
          if (m) sec = Number(m[2]) / 1e6;
        }
        if (sec !== null) { try { o.onProgress(sec); } catch (_) {} }
      });
    }
    proc.on('error', err => finish(() => reject(Object.assign(err, { code: 'IMZIC_FFMPEG_SPAWN' }))));
    proc.on('close', code => {
      finish(() => {
        if (code === 0) resolve();
        else if (o.cancelId && imzicCancelRequested.has(o.cancelId)) {
          reject(Object.assign(new Error('ffmpeg đã bị huỷ theo yêu cầu người dùng.'), { code: 'IMZIC_FFMPEG_CANCELLED' }));
        } else {
          reject(Object.assign(new Error('ffmpeg exit ' + code + ': ' + stderr.slice(-800)), { code: 'IMZIC_FFMPEG_EXIT' }));
        }
      });
    });
  });
}

// Chuẩn bị file nhạc tạm: ưu tiên ĐƯỜNG DẪN GỐC (renderer gửi `audioPath` qua
// webUtils — nhạc nằm sẵn trên đĩa, né copy cả file qua IPC); không có path mới
// nhận bytes. Thiếu cả hai → lỗi lộ liễu IMZIC_BAD_PAYLOAD (Luật 10).
function prepareAudioTmp(p, tmpDir, tag) {
  const isBytes = v => v && (v instanceof Uint8Array || v instanceof ArrayBuffer || Buffer.isBuffer(v));
  if (typeof p.audioPath === 'string' && p.audioPath) {
    if (!fs.existsSync(p.audioPath)) {
      throw Object.assign(new Error('audioPath không tồn tại trên đĩa: ' + p.audioPath), { code: 'IMZIC_BAD_PAYLOAD' });
    }
    const dest = path.join(tmpDir, tag + safeExt(p.audioName, path.extname(p.audioPath) || '.bin'));
    fs.copyFileSync(p.audioPath, dest);
    return dest;
  }
  if (!isBytes(p.audio)) {
    throw Object.assign(new Error('Thiếu dữ liệu nhạc (cần audioPath hoặc audio bytes).'), { code: 'IMZIC_BAD_PAYLOAD' });
  }
  const buf = Buffer.from(p.audio instanceof ArrayBuffer ? new Uint8Array(p.audio) : p.audio);
  if (!buf.length) {
    throw Object.assign(new Error('File nhạc rỗng (0 byte).'), { code: 'IMZIC_BAD_PAYLOAD' });
  }
  const dest = path.join(tmpDir, tag + safeExt(p.audioName, '.bin'));
  fs.writeFileSync(dest, buf);
  return dest;
}

function registerImzicIpc() {
  sweepStaleImzicTmp();

  // Kênh huỷ: kill tiến trình ffmpeg đang chạy theo cancelId do renderer sinh.
  // Không tìm thấy id (ffmpeg đã xong / chưa bắt đầu) → { ok:true, found:false }
  // — không phải lỗi, chỉ là trạng thái khai báo rõ.
  ipcMain.handle('imzic-cancel', (_event, cancelId) => {
    if (typeof cancelId !== 'string' || !cancelId) {
      return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu cancelId để huỷ.' };
    }
    const proc = imzicRunning.get(cancelId);
    if (!proc) return { ok: true, found: false };
    imzicCancelRequested.add(cancelId);
    killProcessTree(proc);
    return { ok: true, found: true };
  });

  ipcMain.handle('imzic-mux', async (event, payload) => {
    let tmpDir = null;
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const isBytes = v => v && (v instanceof Uint8Array || v instanceof ArrayBuffer || Buffer.isBuffer(v));
      if (!isBytes(p.video)) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu dữ liệu video để ghép.' };
      }
      const videoBuf = Buffer.from(p.video instanceof ArrayBuffer ? new Uint8Array(p.video) : p.video);
      if (!videoBuf.length) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'File video rỗng (0 byte).' };
      }
      // D1: preflight dung lượng đĩa — tmp (video + nhạc) + đích lưu ≈ 2× nguồn
      // + 256 MB dư cho muxer. Hết đĩa phải lộ ngay IMZIC_DISK_FULL thay vì chết
      // ở watchdog với thông điệp mơ hồ "file hỏng".
      assertDiskSpace(2 * (videoBuf.length + payloadAudioBytes(p)) + 268435456);

      const stamp = process.pid + '_' + Date.now();
      tmpDir = path.join(os.tmpdir(), 'imzic-mux-' + stamp);
      fs.mkdirSync(tmpDir, { recursive: true });
      const vidPath = path.join(tmpDir, 'video' + safeExt(p.videoName, '.webm'));
      const audPath = prepareAudioTmp(p, tmpDir, 'audio');
      const outPath = path.join(tmpDir, 'muxed.mkv');
      fs.writeFileSync(vidPath, videoBuf);

      try {
        // -c copy: giữ nguyên video VP8/VP9 + audio gốc (mp3/aac/opus/wav…) trong mkv
        // copy stream thường xong < 1 phút — timeout 5 phút là dư an toàn
        await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', vidPath, '-i', audPath, '-c', 'copy', '-shortest', outPath],
          { cancelId: (typeof p.cancelId === 'string' && p.cancelId) || null, timeoutMs: 300000 });
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
      atomicCopyFile(outPath, save.filePath); // D2: nguyên tử qua .part + rename
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
      if (!isBytes(p.video)) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu dữ liệu video H.264 để ghép.' };
      }
      const videoBuf = Buffer.from(p.video instanceof ArrayBuffer ? new Uint8Array(p.video) : p.video);
      if (!videoBuf.length) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Dữ liệu video rỗng (0 byte).' };
      }
      // D1: preflight dung lượng đĩa — tmp (video.h264 + nhạc + offline.mp4) + đích
      // lưu ≈ 2×(video + nhạc) + 256 MB dư. Hết đĩa lộ ngay IMZIC_DISK_FULL.
      assertDiskSpace(2 * (videoBuf.length + payloadAudioBytes(p)) + 268435456);
      const fps = Math.max(24, Math.min(60, +p.fps || 30));
      const trimStart = Math.max(0, +p.trimStart || 0);
      const trimEnd = Math.max(0, +p.trimEnd || 0);
      const fadeIn = Math.max(0, +p.fadeIn || 0);
      const fadeOut = Math.max(0, +p.fadeOut || 0);
      const loudnorm = !!p.loudnorm; // C3: chuẩn hoá âm lượng EBU R128 (-14 LUFS)

      const stamp = process.pid + '_' + Date.now();
      tmpDir = path.join(os.tmpdir(), 'imzic-offline-' + stamp);
      fs.mkdirSync(tmpDir, { recursive: true });
      const vidPath = path.join(tmpDir, 'video.h264');
      const audPath = prepareAudioTmp(p, tmpDir, 'audio');
      const outPath = path.join(tmpDir, 'offline.mp4');
      fs.writeFileSync(vidPath, videoBuf);

      // -ss/-t đặt TRƯỚC -i thứ hai → chỉ áp lên input nhạc (video đã đúng khoảng)
      const args = ['-y', '-hide_banner', '-loglevel', 'error',
        '-progress', 'pipe:1', '-nostats', // D6: đẩy tiến độ mux về renderer
        '-fflags', '+genpts', '-f', 'h264', '-r', String(fps), '-i', vidPath];
      if (trimStart > 0) args.push('-ss', String(trimStart));
      if (trimEnd > trimStart) args.push('-t', String(trimEnd - trimStart));
      args.push('-i', audPath);
      // Map stream TƯỜNG MINH (Luật 8 deterministic + Luật 10 fail-loud): video lấy
      // từ input 0 (raw H.264 của WebCodecs), nhạc lấy từ input 1. Nếu file "nhạc"
      // không có track audio, ffmpeg báo "matches no streams" lộ lỗi thay vì im lặng
      // xuất video không nhạc (đã từng xảy ra: chọn video Flow gen làm input nhạc).
      args.push('-map', '0:v:0', '-map', '1:a:0');
      const filters = [];
      // C3: loudnorm ĐỨNG TRƯỚC afade — chuẩn hoá toàn bài rồi mới đổ dần,
      // dáng fade in/out giữ nguyên như preview.
      if (loudnorm) filters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
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
      // Cắt đầu ra theo THỜI LƯỢNG ĐÍCH thay cho -shortest: tổ hợp "-shortest +
      // -c copy" từng làm muxer dừng trước khi ghi gói nhạc nào (repro thật
      // 2026-09-11 với output/gen-e2e video Flow gen 8s làm input nhạc →
      // "audio:0kB", file .mp4 ra không có tiếng). Renderer luôn gửi totalDur =
      // thời lượng video đã encode; có trim thì đích = trimEnd - trimStart.
      const targetDur = (trimEnd > trimStart) ? (trimEnd - trimStart) : (+p.totalDur || 0);
      if (targetDur <= 0) {
        return { ok: false, code: 'IMZIC_BAD_PAYLOAD', message: 'Thiếu totalDur (thời lượng video đích) — không thể cắt nhạc đúng chỗ.' };
      }
      args.push('-movflags', '+faststart'); // C2: moov atom lên đầu — MP4 seek/stream ngay, chuẩn khi đăng YouTube
      // C4: metadata chuyên nghiệp — dọn rác gốc, tiêu đề theo tên bài nhạc
      const metaTitle = safeBaseName(String(p.audioName || '').replace(/\.[^.]+$/, ''), 'I-MZic video');
      args.push('-map_metadata', '-1', '-metadata', 'title=' + metaTitle);
      args.push('-t', targetDur.toFixed(3), outPath);

      try {
        // encode aac + copy video: thường ~50× realtime — timeout 10 phút dư an toàn
        const ffCancelId = (typeof p.cancelId === 'string' && p.cancelId) || null;
        let lastProgMs = 0;
        await runFfmpeg(args,
          { cancelId: ffCancelId, timeoutMs: 600000,
            // D6: % mux → event 'imzic-progress' cho renderer (throttle 400ms)
            onProgress: (sec) => {
              const now = Date.now();
              if (now - lastProgMs < 400) return;
              lastProgMs = now;
              const pct = (targetDur > 0) ? Math.min(99, Math.max(0, sec / targetDur * 100)) : 0;
              try { event.sender.send('imzic-progress', { cancelId: ffCancelId, stage: 'mux', pct }); } catch (_) {}
            } });
      } catch (err) {
        return { ok: false, code: err.code || 'IMZIC_FFMPEG_EXIT', message: err.message || String(err) };
      }

      // D6: tên file mặc định theo TÊN BÀI NHẠC + ngày — có nghĩa hơn mốc thời gian
      const songStem = safeBaseName(String(p.audioName || '').replace(/\.[^.]+$/, ''), '');
      const defaultName = (songStem ? songStem + '_' : 'video_') + 'imzic_'
        + new Date().toISOString().slice(0, 10) + '.mp4';
      // Hàng chờ (renderer imzic-workflow.js) truyền saveDir + saveName → tự lưu
      // thẳng vào thư mục đã chọn, KHÔNG mở dialog, KHÔNG ghi đè file có sẵn
      // (trùng tên → thêm hậu tố " (2)", " (3)"…). Không có saveDir → dialog như cũ.
      let targetPath;
      if (p.saveDir && typeof p.saveDir === 'string') {
        let st = null;
        try { st = fs.statSync(p.saveDir); } catch (_) {}
        if (!st || !st.isDirectory()) {
          return { ok: false, code: 'IMZIC_BAD_SAVEDIR', message: 'Thư mục lưu hàng chờ không tồn tại: ' + p.saveDir };
        }
        const base = safeBaseName(p.saveName, defaultName);
        targetPath = path.join(p.saveDir, base);
        if (fs.existsSync(targetPath)) {
          const ext = path.extname(base);
          const stem = base.slice(0, base.length - ext.length);
          for (let n = 2; ; n++) {
            const cand = path.join(p.saveDir, stem + ' (' + n + ')' + ext);
            if (!fs.existsSync(cand)) { targetPath = cand; break; }
          }
        }
      } else {
        const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
        const save = await dialog.showSaveDialog(parent, {
          title: 'Chọn chỗ lưu video xuất nhanh (.mp4)',
          defaultPath: defaultName,
          filters: [{ name: 'Video MP4', extensions: ['mp4'] }],
        });
        if (save.canceled || !save.filePath) {
          return { canceled: true };
        }
        targetPath = save.filePath;
      }
      atomicCopyFile(outPath, targetPath); // D2: nguyên tử qua .part + rename
      return { ok: true, path: targetPath };
    } catch (err) {
      return { ok: false, code: err.code || 'IMZIC_OFFLINE_FAILED', message: err && err.message ? err.message : String(err) };
    } finally {
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} }
    }
  });

  // Kênh 'imzic-pick-dir' — chọn THƯ MỤC lưu cho hàng chờ xuất (imzic-workflow.js).
  // Chọn 1 lần, renderer nhớ (localStorage) rồi truyền saveDir vào imzic-offline-export.
  ipcMain.handle('imzic-pick-dir', async (event) => {
    try {
      const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
      const res = await dialog.showOpenDialog(parent, {
        title: 'Chọn thư mục lưu video hàng chờ',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || !res.filePaths || !res.filePaths[0]) return { canceled: true };
      return { ok: true, path: res.filePaths[0] };
    } catch (err) {
      return { ok: false, code: 'IMZIC_PICK_DIR_FAILED', message: err && err.message ? err.message : String(err) };
    }
  });
}

module.exports = { registerImzicIpc };
