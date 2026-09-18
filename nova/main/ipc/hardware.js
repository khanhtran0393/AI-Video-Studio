'use strict';
/**
 * IPC "Máy của bạn & Tối ưu" (Cài đặt):
 *   - hardware:profile          → dò phần cứng thật (hardware-profile.js)
 *   - hardware:cuda-status      → trạng thái lane torch CPU/CUDA của giọng đọc
 *   - hardware:cuda-install     → cài Runtime AI CUDA (verify thật, auto-rollback)
 *   - hardware:cuda-rollback    → quay về torch CPU chủ động
 * Tiến trình cài đẩy event 'hardware:cuda-progress' lên renderer.
 */
const { ipcMain } = require('electron');
const state = require('../state');
const { probeHardware } = require('../hardware-profile');
const voiceCuda = require('../voice-cuda');

// Mỗi dòng tiến trình gửi thẳng lên cửa sổ đang mở (UI hiển thị log).
function _progressSink() {
  return (p) => {
    try {
      const w = state.mainWindow;
      if (w && !w.isDestroyed()) w.webContents.send('hardware:cuda-progress', p);
    } catch (_) {}
  };
}

function registerHardwareIpc() {
  ipcMain.handle('hardware:profile', () => probeHardware());
  ipcMain.handle('hardware:cuda-status', () => voiceCuda.status());
  ipcMain.handle('hardware:cuda-install', async () => {
    try { return await voiceCuda.install(_progressSink()); }
    catch (e) { return { error: 'VOICE_CUDA_CRASH: ' + String((e && e.message) || e) }; }
  });
  ipcMain.handle('hardware:cuda-rollback', async () => {
    try { return await voiceCuda.rollback(_progressSink()); }
    catch (e) { return { error: 'VOICE_CUDA_CRASH: ' + String((e && e.message) || e) }; }
  });
}

module.exports = { registerHardwareIpc };
