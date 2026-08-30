'use strict';

// Private preload -> main telemetry channel. It is deliberately not exposed on
// window.native: renderer code can only emit bounded error envelopes.
const RENDERER_ERROR_CHANNEL = '__nova:renderer-error';
const NETWORK_ONLINE_CHANNEL = '__nova:network-online';

function bounded(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
  return String(value).slice(0, max);
}

function errorFromPayload(payload) {
  const safe = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const error = new Error(bounded(safe.message, 2048) || 'Renderer error');
  error.name = bounded(safe.name, 128) || 'RendererError';
  const stack = bounded(safe.stack, 8192);
  if (stack) error.stack = stack;
  const code = bounded(safe.code, 64).replace(/[^A-Za-z0-9_.-]/g, '');
  if (code) error.code = code;
  return error;
}

function reportPayload(reporter, payload, source) {
  if (!reporter || typeof reporter.report !== 'function') return false;
  try {
    reporter.report(errorFromPayload(payload), { source: bounded(source, 64) || 'renderer' });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Registers Electron-only event forwarding while keeping the reporter module
 * itself usable in plain Node tests. getReporter is evaluated per event so the
 * opt-in reporter may be initialized after handlers are installed.
 */
function registerElectronErrorBridge({ app, ipcMain, getReporter }) {
  const resolveReporter = typeof getReporter === 'function' ? getReporter : () => null;
  const rendererError = (_event, payload) => {
    reportPayload(resolveReporter(), payload, 'renderer');
  };
  const networkOnline = () => {
    const reporter = resolveReporter();
    if (reporter && typeof reporter.flush === 'function') reporter.flush().catch(() => {});
  };
  const rendererGone = (_event, _webContents, details = {}) => {
    reportPayload(resolveReporter(), {
      name: 'RendererProcessGone',
      message: `Renderer process gone: ${bounded(details.reason, 128) || 'unknown'}`,
      code: details.exitCode,
    }, 'render-process-gone');
  };

  ipcMain.on(RENDERER_ERROR_CHANNEL, rendererError);
  ipcMain.on(NETWORK_ONLINE_CHANNEL, networkOnline);
  app.on('render-process-gone', rendererGone);
  return function unregister() {
    ipcMain.removeListener(RENDERER_ERROR_CHANNEL, rendererError);
    ipcMain.removeListener(NETWORK_ONLINE_CHANNEL, networkOnline);
    app.removeListener('render-process-gone', rendererGone);
  };
}

module.exports = {
  RENDERER_ERROR_CHANNEL,
  NETWORK_ONLINE_CHANNEL,
  bounded,
  errorFromPayload,
  reportPayload,
  registerElectronErrorBridge,
};
