'use strict';
/* ============================================================
   WHITEBOARD STUDIO — IPC (main process)
   ------------------------------------------------------------
   Port hành vi TPL Studio Stories (chọn ảnh/SRT/voice thật trên
   đĩa, đo thời lượng thật, export MP4 thật) nhưng chạy ĐỘC LẬP
   trong Nova:
   - mọi đường dẫn media đến từ dialog.showOpenDialog (người dùng
     chọn trong GUI) — KHÔNG nhận đường dẫn repo ngoài hard-code.
   - frame render ở renderer (canvas 2D) → lưu PNG tạm qua
     whiteboard:saveFrames → ghép bằng ffmpeg nội bộ.
   Đăng ký qua registerWhiteboardIpc(ipcMain, {...}) giống pattern
   nova/video-agent/ipc.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dialog } = require('electron');
const Core = require('../web/whiteboard-studio-core.js');
const { FFPROBE, FFMPEG, ffmpegAvailable } = require('./ff-runtime');
const { probeDuration, generateFramePrompts, generateTopicKeywords } = require('./prompt-worker');
const { exportVideo, cancelExport } = require('./video-exporter');

const IMG_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;

function listImages(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => IMG_EXT.test(f))
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
      .map((f) => path.join(dir, f));
  } catch (_) { return []; }
}

function registerWhiteboardIpc(ipcMain, { getState, llmBridge } = {}) {
  const handle = (ch, fn) => {
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, fn);
  };
  const ownerWin = () => {
    try {
      const st = getState && getState();
      return (st && st.mainWindow && !st.mainWindow.isDestroyed()) ? st.mainWindow : undefined;
    } catch (_) { return undefined; }
  };
  // ── runtime info: ffmpeg nội bộ có sẵn không ──
  handle('whiteboard:runtime', async () => ({
    ok: true, ffmpeg: ffmpegAvailable(), ffmpegPath: FFMPEG, ffprobePath: FFPROBE,
    version: Core.VERSION,
  }));

  // ── chọn 1 file SRT (dialog thật) ──
  handle('whiteboard:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT (phụ đề)',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const raw = fs.readFileSync(r.filePaths[0], 'utf8');
    const entries = Core.parseSrt(raw);
    return { path: r.filePaths[0], entries, count: entries.length };
  });

  // ── chọn 1 file voice/audio → đo thời lượng THẬT bằng ffprobe ──
  handle('whiteboard:pickAudio', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file voice-over',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const duration = await probeDuration(r.filePaths[0]);
    return { path: r.filePaths[0], duration };
  });

  // ── chọn 1 ảnh ──
  handle('whiteboard:pickImage', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn ảnh',
      properties: ['openFile'],
      filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { path: r.filePaths[0] };
  });

  // ── chọn thư mục ảnh → ĐẾM ẢNH THẬT trên đĩa ──
  handle('whiteboard:pickImagesDir', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn thư mục ảnh (whiteboard)',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const images = listImages(r.filePaths[0]);
    return { path: r.filePaths[0], images, count: images.length };
  });

  // ── đo thời lượng media bất kỳ (đường dẫn người dùng đã chọn) ──
  handle('whiteboard:probeDuration', async (_e, p) => {
    if (!p || !fs.existsSync(p)) return { ok: false, error: 'File không tồn tại: ' + p };
    const d = await probeDuration(p);
    return d != null ? { ok: true, duration: d } : { ok: false, error: 'Không đo được (ffprobe)' };
  });

  // ── prompt worker (Gemini qua llmBridge) ──
  handle('whiteboard:framePrompts', async (_e, payload) => {
    try { return await generateFramePrompts(payload || {}); }
    catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });
  handle('whiteboard:topicKeywords', async (_e, p = {}) => {
    try {
      const keywords = await generateTopicKeywords(p.topic, p.count, llmBridge);
      return { ok: true, keywords };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  // ── build project (auto generator — core thuần, test được) ──
  handle('whiteboard:buildAutoProject', async (_e, p = {}) => {
    try {
      const built = Core.buildAutoProject({
        images: (p.images || []).filter((x) => x && fs.existsSync(x)),
        srtEntries: p.srtEntries || [],
        audioDuration: Number(p.audioDuration) || 0,
        config: p.config || {},
      });
      return { ok: true, project: serializeProject(built) };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  // ── save frames PNG từ renderer (base64) → thư mục tạm THẬT ──
  // startIndex: đánh số LIÊN TỤC qua nhiều lần gọi (export theo chunk —
  // renderer render từng batch 150 frame rồi gọi lại với cùng dir).
  handle('whiteboard:saveFrames', async (_e, payload = {}) => {
    try {
      const dir = payload.dir && fs.existsSync(payload.dir)
        ? payload.dir
        : fs.mkdtempSync(path.join(os.tmpdir(), 'wb-studio-'));
      const startIdx = Math.max(0, Math.floor(Number(payload.startIndex) || 0));
      const saved = [];
      for (const fr of payload.frames || []) {
        if (!fr || !fr.dataUrl) continue;
        const b64 = String(fr.dataUrl).replace(/^data:image\/\w+;base64,/, '');
        if (!b64) continue;
        const file = path.join(dir, 'f' + String(startIdx + saved.length).padStart(6, '0') + '.png');
        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
        saved.push(file);
      }
      return { ok: true, dir, frames: saved, count: saved.length, total: startIdx + saved.length };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  // ── export MP4 thật bằng ffmpeg nội bộ ──
  handle('whiteboard:export', async (_e, payload = {}) => {
    try {
      const res = await exportVideo({
        framePaths: payload.framePaths || [],
        outputPath: payload.outputPath || null,
        outputDir: payload.outputDir || null,
        fps: payload.fps, width: payload.width, height: payload.height,
        audioTracks: (payload.audioTracks || []).filter((t) => t && t.path && fs.existsSync(t.path)),
        onProgress: (s) => {
          try {
            const st = getState && getState();
            if (st && st.mainWindow && !st.mainWindow.isDestroyed()) {
              st.mainWindow.webContents.send('whiteboard:exportProgress', s);
            }
          } catch (_) {}
        },
      });
      return res;
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  // ── chọn nơi lưu MP4 (dialog thật) ──
  handle('whiteboard:pickOutput', async (_e, p = {}) => {
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Xuất video MP4',
      defaultPath: p.defaultName || 'whiteboard_video.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    return { path: r.filePath };
  });

  handle('whiteboard:exportCancel', async () => ({ ok: cancelExport() }));

  return true;
}

function serializeProject(built) {
  return {
    frames: built.frames,
    items: (built.items || []).map((it) => ({
      item_id: it.item_id, item_type: it.item_type, label: it.label,
      start_time: it.start_time, duration: it.duration, draw_duration: it.draw_duration,
      text: it.text, font_size: it.font_size, color: it.color,
      image_path: it.image_path, image_x: it.image_x, image_y: it.image_y,
      image_w: it.image_w, image_h: it.image_h, reveal_dir: it.reveal_dir,
      media_offset: it.media_offset,
    })),
    totalDuration: built.totalDuration,
    warnings: built.warnings,
  };
}

module.exports = { registerWhiteboardIpc };
