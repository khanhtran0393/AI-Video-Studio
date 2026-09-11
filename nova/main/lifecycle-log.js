'use strict';
/**
 * Ghi log lifecycle Electron ra FILE (userData/lifecycle.log) + console.
 * Mục đích: khi test UI tự động (smoke-cdp/smoke-runtime), biết CHÍNH XÁC app
 * thoát vì lý do gì (window-all-closed / before-quit / quit) và renderer hay
 * tiến trình con (Chrome CfT, GPU, utility…) chết với reason/exitCode nào —
 * thay vì chỉ thấy "process exited" phía script test.
 * Chỉ quan sát, KHÔNG thay đổi hành vi thoát/hiển thị gì cả.
 */
const fs = require('fs');
const path = require('path');

const LOG_FILE = 'lifecycle.log';
const MAX_BYTES = 512 * 1024;   // quá nửa MB thì xoá ghi lại — không phình vô hạn

function logLifecycle(app, event, detail) {
  const line = `[${new Date().toISOString()}] ${event}${detail ? ' ' + detail : ''}`;
  try { console.log('[lifecycle]', line); } catch (_) {}
  try {
    const file = path.join(app.getPath('userData'), LOG_FILE);
    try { if (fs.statSync(file).size > MAX_BYTES) fs.rmSync(file, { force: true }); } catch (_) {}
    fs.appendFileSync(file, line + '\n');
  } catch (_) {}
}

function _detail(d) {
  if (!d) return '';
  const parts = [];
  for (const k of ['type', 'reason', 'exitCode', 'name']) {
    if (d && d[k] !== undefined && d[k] !== null) parts.push(k + '=' + d[k]);
  }
  // exitCodeHex: exitCode thập phân kiểu -1 là mơ hồ (0xFFFFFFFF) — hex giúp đối
  // chiếu mã NTSTATUS/Win32 khi điều tra crash GPU/Network+renderer chết cụm.
  if (d && typeof d.exitCode === 'number') {
    try { parts.push('exitCodeHex=0x' + (d.exitCode >>> 0).toString(16)); } catch (_) {}
  }
  return parts.join(' ');
}

function installLifecycleLogging(app) {
  for (const ev of ['before-quit', 'will-quit', 'quit', 'window-all-closed']) {
    app.on(ev, () => logLifecycle(app, ev));
  }
  app.on('child-process-gone', (_e, details) => logLifecycle(app, 'child-process-gone', _detail(details)));
  app.on('render-process-gone', (_e, wc, details) => {
    let url = '';
    try { url = (wc && wc.getURL && wc.getURL()) || ''; } catch (_) {}
    logLifecycle(app, 'render-process-gone', (_detail(details) + ' url=' + String(url).slice(0, 80)).trim());
  });
  // Mọi cửa sổ (chính + splash + popup đăng nhập): treo/phục hồi/renderer chết.
  app.on('browser-window-created', (_e, win) => {
    try {
      win.on('unresponsive', () => logLifecycle(app, 'window-unresponsive'));
      win.on('responsive', () => logLifecycle(app, 'window-responsive'));
      win.webContents.on('render-process-gone', (_ev, details) => logLifecycle(app, 'window-render-process-gone', _detail(details)));
    } catch (_) {}
  });
  // Trạng thái GPU lúc khởi động — một dòng duy nhất, phục vụ điều tra crash cụm
  // (GPU+Network+renderer chết cùng giây): biết lúc crash GPU có bị block/disable không.
  try {
    app.whenReady().then(() => {
      try { logLifecycle(app, 'gpu-feature-status', JSON.stringify(app.getGPUFeatureStatus())); } catch (_) {}
    });
  } catch (_) {}
}

module.exports = { installLifecycleLogging, logLifecycle };