'use strict';
/* ============================================================
   HARDSUB OCR — IPC (main process) — kênh `hardsub:*`
   ------------------------------------------------------------
   Bước 2 lộ trình ezmaxsub: trích SRT từ phụ đề chèn sẵn.
   video (dialog thật) → engine.extract → cues trả về renderer
   (nạp thẳng panel Dịch SRT / Lồng Tiếng); saveSrt ghi file người
   dùng chọn. Mọi đường dẫn đến từ dialog — KHÔNG nhận đường dẫn
   repo ngoài từ GUI. Lỗi lộ liễu mã HS_* (Luật 10). Chạy 1 lần
   tại một thời điểm; cancel qua cờ + kill tiến trình con.
   Đăng ký qua registerHardsubIpc(ipcMain, {...}) — pattern
   giống nova/main/ipc/index.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const E = require('./engine');

function registerHardsubIpc(ipcMain, { getState } = {}) {
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
  const codeOf = (e) => (e && e.code) || 'HS_ERROR';

  /* Chạy 1 lần OCR tại một thời điểm; cancel qua cờ + kill con. */
  let run = null; // { cancelled, children:Set }

  const tmpRoot = () => path.join(app.getPath('userData'), 'hardsub-tmp');

  /* ── chọn video nguồn (dialog thật) ── */
  handle('hardsub:pickVideo', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video có phụ đề chèn sẵn (hardsub)',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'ts', 'm4v'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  /* ── chạy OCR: video → cues (khung tạm trong userData, tự dọn) ── */
  handle('hardsub:run', async (e, p = {}) => {
    if (run) return { ok: false, error: 'Đang có phiên OCR chạy — huỷ trước khi chạy lại.', code: 'HS_BUSY' };
    const videoPath = String(p.videoPath || '').trim();
    if (!videoPath) return { ok: false, error: 'Thiếu video nguồn.', code: 'HS_NO_VIDEO' };
    const job = { cancelled: false, children: new Set() };
    run = job;
    const sendProgress = (payload) => {
      try { e.sender.send('hardsub:progress', payload); } catch (_) {}
    };
    try {
      const framesDir = path.join(tmpRoot(), 'run-' + Date.now());
      const res = await E.extract({
        videoPath,
        framesDir,
        sampleFps: p.sampleFps,
        bottomPct: p.bottomPct,
        startSec: p.startSec,
        endSec: p.endSec,
        minScore: p.minScore,
        onProgress: sendProgress,
        onChild: (cp) => {
          job.children.add(cp);
          try { cp.on('close', () => job.children.delete(cp)); } catch (_) {}
        },
        isCancelled: () => job.cancelled,
      });
      return res;
    } catch (err) {
      if (job.cancelled) return { ok: false, error: 'Đã huỷ.', code: 'HS_CANCELLED' };
      return { ok: false, error: errOf(err), code: codeOf(err), detail: (err && err.detail) || '' };
    } finally {
      for (const cp of job.children) { try { cp.kill(); } catch (_) {} }
      run = null;
    }
  });

  /* ── huỷ phiên đang chạy ── */
  handle('hardsub:cancel', async () => {
    if (!run) return { ok: true, idle: true };
    run.cancelled = true;
    for (const cp of run.children) { try { cp.kill(); } catch (_) {} }
    return { ok: true };
  });

  /* ── lưu cues (renderer dựng SRT text) ra file người dùng chọn ── */
  handle('hardsub:saveSrt', async (_e, p = {}) => {
    const srtText = String(p.srtText || '').trim();
    if (!srtText || !srtText.includes('--&gt;') && !srtText.includes('-->')) {
      return { ok: false, error: 'Nội dung SRT không hợp lệ (thiếu timestamp).', code: 'HS_SRT_BAD' };
    }
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu SRT đã trích từ video',
      defaultPath: String(p.defaultName || 'extracted.srt'),
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

module.exports = { registerHardsubIpc };