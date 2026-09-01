'use strict';
/**
 * IPC xoá watermark/logo (đặc biệt watermark Flow/Veo) bằng WatermarkRemover-AI.
 */
const path = require('path');
const { dialog, shell, ipcMain } = require('electron');
const state = require('../state');
const watermarkNative = require('../../watermark-native');

function registerWatermarkIpc() {
  // ── Watermark native: xoá watermark/logo (đặc biệt watermark Flow/Veo) bằng WatermarkRemover-AI ──
  ipcMain.handle('wm-probe', () => { try { return watermarkNative.probe(); } catch (e) { return { hasRoot: false, hasPython: false }; } });
  ipcMain.handle('wm-remove-file', (e, { input, output, opts } = {}) => watermarkNative.removeFile(input, output, opts).catch((err) => ({ error: String(err && err.message || err) })));
  ipcMain.handle('wm-remove-folder', (e, { input, output, opts } = {}) => watermarkNative.removeFolder(input, output, opts).catch((err) => ({ error: String(err && err.message || err) })));
  ipcMain.handle('wm-preview', (e, { input, opts } = {}) => watermarkNative.preview(input, opts).catch((err) => ({ error: String(err && err.message || err) })));
  ipcMain.handle('wm-cancel', () => { try { watermarkNative.cancel(); return true; } catch { return false; } });
  ipcMain.handle('wm-pick-root', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, { title: 'Chọn thư mục WatermarkRemover-AI đã cài (chứa remwm.py)', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return watermarkNative.setRoot(r.filePaths[0]);
    } catch (e) { return { error: String(e) }; }
  });
  // Thử 1 ảnh: chọn file → xoá watermark ra bản _clean (giữ ảnh gốc) → mở cả 2 để so sánh.
  ipcMain.handle('wm-test-file', async (e, { opts } = {}) => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, { title: 'Chọn 1 ảnh để thử xoá watermark', properties: ['openFile'], filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      const input = r.filePaths[0];
      const ext = path.extname(input);
      const output = path.join(path.dirname(input), path.basename(input, ext) + '_clean' + ext);
      await watermarkNative.removeFile(input, output, opts || {});
      try { shell.openPath(output); } catch {}
      try { shell.showItemInFolder(output); } catch {}
      return { ok: true, input, output };
    } catch (err) { return { error: String(err && err.message || err) }; }
  });
  watermarkNative.onLog((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('wm-log', line); } catch {} });
}

module.exports = { registerWatermarkIpc };
