'use strict';
/**
 * IPC cho native tools chạy local (FFmpeg dựng video…).
 */
const { BrowserWindow, ipcMain } = require('electron');
const nativeTools = require('../../native-tools');   // shim → ./native-tools/ (đã tách như flow-native)

function registerNativeToolsIpc() {
  // ── Native tools chạy local (FFmpeg dựng video, sắp có Whisper) ──
  ipcMain.handle('render-video', (e, payload) => nativeTools.renderVideo(payload, BrowserWindow.fromWebContents(e.sender)));
  ipcMain.handle('ffmpeg-info', () => nativeTools.ffmpegInfo());
  ipcMain.handle('render-video-cancel', () => nativeTools.cancelRender());
}

module.exports = { registerNativeToolsIpc };
