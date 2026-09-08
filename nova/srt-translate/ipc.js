'use strict';
/* ============================================================
   SRT TRANSLATE — IPC (main process)
   ------------------------------------------------------------
   Kênh `srt-translate:*`. Mọi đường dẫn media đến từ
   dialog.showOpenDialog / showSaveDialog (người dùng chọn thật
   trong GUI) — KHÔNG nhận đường dẫn repo ngoài từ GUI.
   Đăng ký qua registerSrtTranslateIpc(ipcMain, {...}) — pattern
   giống nova/main/ipc/index.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const E = require('./engine');

function registerSrtTranslateIpc(ipcMain, { getState } = {}) {
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
  const codeOf = (e) => (e && e.code) || 'SRTT_ERROR';

  /* ── chọn file SRT nguồn (dialog thật) → cues ── */
  handle('srt-translate:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT cần dịch',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    try {
      const raw = fs.readFileSync(r.filePaths[0], 'utf8');
      const cues = E.parseSrtCues(raw);
      if (!cues.length) return { ok: false, error: 'File SRT không đọc được dòng thoại nào.', code: 'SRTT_EMPTY' };
      return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]), cues, count: cues.length };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── dịch file SRT đã chọn → ghi file mới (path người dùng chọn) ── */
  handle('srt-translate:translate', async (_e, p = {}) => {
    const srcPath = String(p.srcPath || '').trim();
    const outPath = String(p.outPath || '').trim();
    if (!srcPath) return { ok: false, error: 'Thiếu file SRT nguồn (srcPath).', code: 'SRTT_NO_SRC' };
    if (!outPath) return { ok: false, error: 'Thiếu đường dẫn xuất (outPath).', code: 'SRTT_NO_OUT' };
    try {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const cues = E.parseSrtCues(raw);
      if (!cues.length) return { ok: false, error: 'File SRT không có dòng thoại nào.', code: 'SRTT_EMPTY' };
      const translated = await E.translateCues(cues, {
        sourceLang: p.sourceLang,
        targetLang: p.targetLang,
        batchSize: p.batchSize,
        model: p.model,
        maxConcurrent: p.maxConcurrent,
      });
      const srt = E.serializeSrt(translated);
      fs.writeFileSync(outPath, '\uFEFF' + srt, 'utf8');
      return { ok: true, outPath, count: translated.length };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err), detail: (err && err.detail) || '' };
    }
  });

  /* ── gợi ý đường dẫn xuất (dialog thật) ── */
  handle('srt-translate:pickOutput', async (_e, p = {}) => {
    const defaultPath = String(p && p.defaultName ? p.defaultName : 'translated.srt');
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu file SRT đã dịch',
      defaultPath,
      filters: [{ name: 'SRT', extensions: ['srt'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    return { path: r.filePath };
  });
}

module.exports = { registerSrtTranslateIpc };