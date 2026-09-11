'use strict';
/**
 * Dọn dẹp tài nguyên main process sở hữu khi thoát app:
 * timer auto-push, các bridge (extension/CLI/MCP), voice, watermark, captcha Chrome.
 */
const flowExtBridge = require('../flow-bridge');
const cliBridge = require('../cli-bridge-native');
const mcpBridge = require('../mcp-bridge-native');
const voiceNative = require('../voice-native');
const watermarkNative = require('../watermark-native');
const flowChrome = require('../flow-chrome');
const scheduler = require('./scheduler');
const { stopFlowAutoPush } = require('./ipc/flow');

let _shutdownDone = false;
function shutdownOwnedResources() {
  if (_shutdownDone) return;
  _shutdownDone = true;
  stopFlowAutoPush();
  try { scheduler.stop(); } catch (_) {}
  try { flowExtBridge.stop(); } catch (_) {}
  try { cliBridge.stopAll(); } catch (_) {}
  try { mcpBridge.stopAll(); } catch (_) {}
  try { voiceNative.stop(); } catch (_) {}
  try { watermarkNative.cancel(); } catch (_) {}
  try { flowChrome.closeGuestCaptcha && flowChrome.closeGuestCaptcha(); } catch (_) {}
}

module.exports = { shutdownOwnedResources };
