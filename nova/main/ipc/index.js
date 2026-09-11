'use strict';
/**
 * Đăng ký TOÀN BỘ IPC của main process + khởi động các bridge cục bộ (CLI/MCP).
 * Gọi một lần khi app nạp (trước app.whenReady()) — giữ đúng hành vi cũ.
 */
const { BrowserWindow, ipcMain } = require('electron');   // ipcMain: registerWhiteboardIpc nhận ipcMain làm tham số
const state = require('../state');
const nativeTools = require('../../native-tools');   // shim → ./native-tools/ (đã tách như flow-native)
const upscaleNative = require('../../upscale-native');
const watermarkNative = require('../../watermark-native');
const cliBridge = require('../../cli-bridge-native');
const mcpBridge = require('../../mcp-bridge-native');
const { registerFlowIpc } = require('./flow');
const { registerNativeToolsIpc } = require('./native-tools');
const { registerUpscaleIpc } = require('./upscale');
const { registerLlmIpc } = require('./llm');
const { registerFilesIpc } = require('./files');
const { registerVoiceIpc } = require('./voice');
const { registerSystemIpc } = require('./system');
const { registerSecretVaultIpc } = require('./secret-vault');
const { registerImzicIpc } = require('./imzic');
const { registerScheduleIpc } = require('./schedule');
const { registerSpyIpc } = require('./spy');
const { registerWhiteboardIpc } = require('../../whiteboard-studio/ipc');
const { registerSrtTranslateIpc } = require('../../srt-translate/ipc');

function registerAllIpc() {
  registerFlowIpc();
  registerNativeToolsIpc();
  registerUpscaleIpc();
  registerLlmIpc();
  registerFilesIpc();
  registerVoiceIpc();
  registerSystemIpc();
  registerSecretVaultIpc();
  registerImzicIpc();
  registerScheduleIpc();
  registerSpyIpc();

  // ── Whiteboard Studio (port TPL Studio Stories) — module độc lập,
  //    runtime ffmpeg nội bộ riêng, không phụ thuộc app cũ ──
  try {
    registerWhiteboardIpc(ipcMain, { getState: () => state });
  } catch (e) { console.warn('[whiteboard-studio]', e && e.message); }

  // ── Dịch SRT — port hành vi "AI Translate Subtitles" của app tham chiếu,
  //    AI qua API đã cấu hình (nova/editor-pro/niche), file SRT thật trên đĩa ──
  try {
    registerSrtTranslateIpc(ipcMain, { getState: () => state });
  } catch (e) { console.warn('[srt-translate]', e && e.message); }

  // ── CLI bridge native: app tự chạy gói Claude/ChatGPT của user (localhost:8795/8796) ──
  try { cliBridge.startAll(); } catch (e) { console.warn('[cli-bridge]', e && e.message); }

  // ── MCP bridge native: cho AI agent (MCP) điều khiển dựng video/nâng cấp/xoá watermark (localhost:8794) ──
  try {
    mcpBridge.startAll({
      nativeTools, upscaleNative, watermarkNative,
      getWindow: () => (state.mainWindow && !state.mainWindow.isDestroyed() ? state.mainWindow : BrowserWindow.getFocusedWindow()),
    });
  } catch (e) { console.warn('[mcp-bridge]', e && e.message); }
}

module.exports = { registerAllIpc };
