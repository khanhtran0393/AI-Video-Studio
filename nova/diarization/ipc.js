'use strict';
/* ============================================================
   DIARIZATION — IPC (main process) — kênh `diarize:*`
   ------------------------------------------------------------
   Bước 3 lộ trình ezmaxsub: tách người nói + gán giọng theo
   giới tính. video/SRT (dialog thật) → engine.analyze → speakers
   + SRT đã tách prefix "Tên:" + gán giọng OmniVoice theo giới
   tính. WAV tạm trong userData/diarize-tmp, tự dọn sau chạy.
   Mọi đường dẫn đến từ dialog — KHÔNG nhận đường dẫn repo ngoài
   từ GUI. Lỗi lộ liễu mã DIAZ_* (Luật 10). Chạy 1 lần tại một
   thời điểm; cancel qua cờ + kill tiến trình con. Đăng ký qua
   registerDiarizeIpc(ipcMain, {...}) — pattern giống hardsub.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const E = require('./engine');

function registerDiarizeIpc(ipcMain, { getState } = {}) {
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
  const errOf = (e) => String((e && e.message) || e);
  const codeOf = (e) => (e && e.code) || 'DIAZ_ERROR';

  /* Chạy 1 lần phân tích tại một thời điểm; cancel qua cờ + kill con. */
  let run = null; // { cancelled, children:Set, wavPath }

  const tmpRoot = () => path.join(app.getPath('userData'), 'diarize-tmp');

  /* ── chọn video/audio nguồn (dialog thật) ── */
  handle('diarize:pickVideo', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video/audio để tách người nói',
      properties: ['openFile'],
      filters: [{ name: 'Video/Audio', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v', 'ts', 'mp3', 'wav', 'm4a', 'aac', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  /* ── phân tích: video + SRT (+voices tuỳ chọn) → speakers + SRT tách người ── */
  handle('diarize:analyze', async (e, p = {}) => {
    if (run) return { ok: false, error: 'Đang có phiên tách người nói chạy — huỷ trước khi chạy lại.', code: 'DIAZ_BUSY' };
    const videoPath = String(p.videoPath || '').trim();
    const srtText = String(p.srtText || '');
    if (!videoPath) return { ok: false, error: 'Thiếu video/audio nguồn.', code: 'DIAZ_NO_VIDEO' };
    if (!srtText.trim()) return { ok: false, error: 'Thiếu nội dung SRT.', code: 'DIAZ_SRT_BAD' };
    const job = { cancelled: false, children: new Set(), wavPath: '' };
    run = job;
    const sendProgress = (payload) => {
      try { e.sender.send('diarize:progress', payload); } catch (_) {}
    };
    try {
      job.wavPath = path.join(tmpRoot(), 'run-' + Date.now() + '.wav');
      const res = await E.analyze({
        videoPath,
        srtText,
        wavPath: job.wavPath,
        voices: Array.isArray(p.voices) ? p.voices : [],
        onProgress: sendProgress,
        onChild: (cp) => {
          job.children.add(cp);
          try { cp.on('close', () => job.children.delete(cp)); } catch (_) {}
        },
        isCancelled: () => job.cancelled,
      });
      return res;
    } catch (err) {
      if (job.cancelled) return { ok: false, error: 'Đã huỷ.', code: 'DIAZ_CANCELLED' };
      return { ok: false, error: errOf(err), code: codeOf(err) };
    } finally {
      for (const cp of job.children) { try { cp.kill(); } catch (_) {} }
      if (job.wavPath) { try { fs.unlinkSync(job.wavPath); } catch (_) {} }
      run = null;
    }
  });

  /* ── huỷ phiên đang chạy ── */
  handle('diarize:cancel', async () => {
    if (!run) return { ok: true, idle: true };
    run.cancelled = true;
    for (const cp of run.children) { try { cp.kill(); } catch (_) {} }
    return { ok: true };
  });

  /* ── lưu SRT đã tách người nói ra file người dùng chọn ── */
  handle('diarize:saveSrt', async (_e, p = {}) => {
    const srtText = String(p.srtText || '').trim();
    if (!srtText || (!srtText.includes('-->') )) {
      return { ok: false, error: 'Nội dung SRT không hợp lệ (thiếu timestamp).', code: 'DIAZ_SRT_BAD' };
    }
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu SRT đã tách người nói',
      defaultPath: String(p.defaultName || 'speakers.srt'),
      filters: [{ name: 'SRT', extensions: ['srt'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    try {
      fs.writeFileSync(r.filePath, '\uFEFF' + srtText, 'utf8');
      return { ok: true, path: r.filePath };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });
}

module.exports = { registerDiarizeIpc };
