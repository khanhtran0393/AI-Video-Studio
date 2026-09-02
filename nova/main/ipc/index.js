'use strict';
/**
 * Đăng ký TOÀN BỘ IPC của main process + khởi động các bridge cục bộ (CLI/MCP).
 * Gọi một lần khi app nạp (trước app.whenReady()) — giữ đúng hành vi cũ.
 */
const { BrowserWindow } = require('electron');
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
const { registerWatermarkIpc } = require('./watermark');
const { registerSystemIpc } = require('./system');

function registerAllIpc() {
  registerFlowIpc();
  registerNativeToolsIpc();
  registerUpscaleIpc();
  registerLlmIpc();
  registerFilesIpc();
  registerVoiceIpc();
  registerWatermarkIpc();
  registerSystemIpc();

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
