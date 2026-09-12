'use strict';
/**
 * IPC "Công cụ FFmpeg" (sidebar): tách MP3/M4A/WAV, cắt, ghép, loop, nén,
 * trích frame, xoá tiếng, đổi định dạng, ghép nhạc, xuất GIF.
 * Chạy FFmpeg local qua native-tools/media-tools — dialog chọn file THẬT (main process),
 * không nhận đường dẫn hard-code từ GUI. Progress phát sự kiện `ffx:progress` về renderer.
 */
const fs = require('fs');
const path = require('path');
const { dialog, ipcMain } = require('electron');
const state = require('../state');
const mediaTools = require('../../native-tools/media-tools');

const VIDEO_FILTERS = [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts'] }];
const AUDIO_FILTERS = [{ name: 'Âm thanh', extensions: ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'opus'] }];
const MEDIA_FILTERS = [
  { name: 'Media', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts', 'mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'] },
];
const SUB_FILTERS = [{ name: 'Phụ đề', extensions: ['srt', 'ass'] }];

/* Bọc handler chung: lỗi lộ liễu trả {error}, lỗi huỷ đánh dấu riêng cho renderer hiển thị "Đã huỷ". */
function errOf(e) {
  const msg = (e && e.message) || String(e);
  const cancelled = e && e.code === 'FFX_CANCELLED';
  return cancelled ? { error: msg, cancelled: true } : { error: msg };
}

/* onProgress → gửi {pct, fps?, speed?} về đúng cửa sổ đã gọi (bọc try — cửa sổ đóng giữa chừng thì bỏ qua). */
function progressSender(e) {
  return (p) => {
    try { e.sender.send('ffx:progress', { pct: Math.max(0, Math.min(100, Math.round(Number(p && p.pct) || 0))), fps: p && p.fps, speed: p && p.speed }); } catch (_) { /* bỏ qua */ }
  };
}

/* Handler op FFmpeg: fn(payload, onProgress) → { ok, path, ... } | { error } | { cancelled } */
function handleOp(channel, fn) {
  ipcMain.handle(channel, async (e, payload) => {
    try { return await fn(payload || {}, progressSender(e)); }
    catch (err) { return errOf(err); }
  });
}

function registerFfmpegToolsIpc() {
  // ── Dialog chọn nguồn ──
  // Chọn 1 video nguồn (tách MP3 / cắt / loop / nén / xoá tiếng / ghép nhạc / GIF)
  ipcMain.handle('ffx:pick-input', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn video', properties: ['openFile'], filters: VIDEO_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // Chọn N video nguồn (ghép video — đúng thứ tự chọn)
  ipcMain.handle('ffx:pick-inputs', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn các video cần ghép (đúng thứ tự)', properties: ['openFile', 'multiSelections'], filters: VIDEO_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths.length) return { canceled: true };
      return { paths: r.filePaths };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // Chọn file nhạc (ghép nhạc vào video)
  ipcMain.handle('ffx:pick-audio', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn file nhạc', properties: ['openFile'], filters: AUDIO_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // Chọn media bất kỳ (đổi định dạng)
  ipcMain.handle('ffx:pick-media', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn video hoặc âm thanh', properties: ['openFile'], filters: MEDIA_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // Chọn file phụ đề SRT/ASS (Đóng phụ đề cứng)
  ipcMain.handle('ffx:pick-sub', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn file phụ đề (.srt / .ass)', properties: ['openFile'], filters: SUB_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // Chọn nơi lưu output. Trả cờ `exists` để renderer xác nhận GHI ĐÈ trước khi chạy
  // (ffmpeg -y ghi đè lặng lẽ — cấm hành vi ngầm, Luật 10). defaultDir = thư mục lần trước.
  ipcMain.handle('ffx:pick-output', async (_e, payload = {}) => {
    try {
      let defaultPath = String(payload.defaultName || 'output');
      const dir = payload.defaultDir ? String(payload.defaultDir) : '';
      if (dir && fs.existsSync(dir)) defaultPath = path.join(dir, defaultPath);
      const r = await dialog.showSaveDialog(state.mainWindow, { title: 'Chọn nơi lưu', defaultPath });
      if (r.canceled || !r.filePath) return { canceled: true };
      return { path: r.filePath, exists: fs.existsSync(r.filePath) };
    } catch (e) { return { error: e.message || String(e) }; }
  });

  // ── Đo metadata + Huỷ ──
  ipcMain.handle('ffx:probe', async (_e, payload = {}) => {
    try { return await mediaTools.probeStreams(payload.path); }
    catch (err) { return errOf(err); }
  });
  ipcMain.handle('ffx:cancel', () => mediaTools.cancelRunning());
  // Dò cảnh chuyển (scene detection) — trả danh sách thời điểm để UI gợi ý cắt/trích
  ipcMain.handle('ffx:scenes', async (_e, payload = {}) => {
    try { return await mediaTools.detectScenes(payload || {}); }
    catch (err) { return errOf(err); }
  });

  // ── Các tác vụ FFmpeg (onProgress → ffx:progress) ──
  handleOp('ffx:extract-audio', (p, onProgress) => mediaTools.extractAudio(Object.assign({}, p, { onProgress })));
  handleOp('ffx:cut-video', (p, onProgress) => mediaTools.cutVideo(Object.assign({}, p, { onProgress })));
  handleOp('ffx:cut-multi', (p, onProgress) => mediaTools.cutMulti(Object.assign({}, p, { onProgress })));
  handleOp('ffx:concat-videos', (p, onProgress) => mediaTools.concatVideos(Object.assign({}, p, { onProgress })));
  handleOp('ffx:concat-auto', (p, onProgress) => mediaTools.concatAuto(Object.assign({}, p, { onProgress })));
  handleOp('ffx:concat-transition', (p, onProgress) => mediaTools.concatTransition(Object.assign({}, p, { onProgress })));
  handleOp('ffx:loop-video', (p, onProgress) => mediaTools.loopVideo(Object.assign({}, p, { onProgress })));
  handleOp('ffx:loop-pingpong', (p, onProgress) => mediaTools.loopPingPong(Object.assign({}, p, { onProgress })));
  handleOp('ffx:loop-crossfade', (p, onProgress) => mediaTools.loopCrossfade(Object.assign({}, p, { onProgress })));
  handleOp('ffx:loop-audio', (p, onProgress) => mediaTools.loopAudio(Object.assign({}, p, { onProgress })));
  handleOp('ffx:compress-video', (p, onProgress) => mediaTools.compressVideo(Object.assign({}, p, { onProgress })));
  handleOp('ffx:extract-frames', (p, onProgress) => mediaTools.extractFrames(Object.assign({}, p, { onProgress })));
  handleOp('ffx:remove-audio', (p, onProgress) => mediaTools.removeAudio(Object.assign({}, p, { onProgress })));
  handleOp('ffx:convert-media', (p, onProgress) => mediaTools.convertMedia(Object.assign({}, p, { onProgress })));
  handleOp('ffx:add-music', (p, onProgress) => mediaTools.addMusic(Object.assign({}, p, { onProgress })));
  handleOp('ffx:to-gif', (p, onProgress) => mediaTools.toGif(Object.assign({}, p, { onProgress })));
  // ── Gói E (2026-09-12): nhóm 1 đa kênh + nhóm 4 âm thanh sâu ──
  handleOp('ffx:shorts-video', (p, onProgress) => mediaTools.shortsVideo(Object.assign({}, p, { onProgress })));
  handleOp('ffx:burn-subs', (p, onProgress) => mediaTools.burnSubs(Object.assign({}, p, { onProgress })));
  handleOp('ffx:sub-preview', (p, onProgress) => mediaTools.previewBurnSubs(Object.assign({}, p, { onProgress })));
  handleOp('ffx:faststart', (p, onProgress) => mediaTools.faststartRemux(Object.assign({}, p, { onProgress })));
  handleOp('ffx:normalize-audio', (p, onProgress) => mediaTools.normalizeAudio(Object.assign({}, p, { onProgress })));
  handleOp('ffx:remove-vocals', (p, onProgress) => mediaTools.removeVocals(Object.assign({}, p, { onProgress })));
  handleOp('ffx:add-fades', (p, onProgress) => mediaTools.addFades(Object.assign({}, p, { onProgress })));
  // Thumbnail 1 frame (grid thẻ Ghép Video) — nhanh, không cần progress.
  ipcMain.handle('ffx:thumb', async (_e, payload = {}) => {
    try { return await mediaTools.makeThumb(payload || {}); }
    catch (err) { return errOf(err); }
  });
}

module.exports = { registerFfmpegToolsIpc };