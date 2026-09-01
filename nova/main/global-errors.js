'use strict';
/**
 * Bắt lỗi toàn cục để KHÔNG hiện hộp "A JavaScript error occurred" khó hiểu cho khách.
 * Lỗi hay gặp: ENOSPC (ổ đĩa đầy khi tải video/ghi file) → hiện thông báo tiếng Việt rõ ràng, không văng app.
 */
const { dialog } = require('electron');
const state = require('./state');
const { friendlyMainError } = require('./friendly-errors');
const { closeSplashWindow } = require('./splash');

function installGlobalErrorHandlers() {
  process.on('uncaughtException', (err) => {
    if (state.errorReporter) { try { state.errorReporter.report(err); } catch (_) {} }
    const friendly = friendlyMainError(err);
    if (friendly) {
      try { closeSplashWindow(true); } catch (_) {}
      try { dialog.showErrorBox('Không thể lưu file', friendly); } catch (e) { /* */ }
      return;
    }
    try { closeSplashWindow(true); } catch (_) {}
    try { dialog.showErrorBox('Lỗi', String((err && (err.message || err)) || err)); } catch (e) { /* */ }
    console.error('[uncaught]', err);
  });
  process.on('unhandledRejection', (reason) => {
    if (state.errorReporter) {
      try {
        const _err = reason instanceof Error ? reason : new Error(String(reason));
        _err.name = 'UnhandledRejection';
        state.errorReporter.report(_err);
      } catch (_) {}
    }
    const friendly = friendlyMainError(reason);
    if (friendly) {
      try { closeSplashWindow(true); } catch (_) {}
      try { dialog.showErrorBox('Không thể lưu file', friendly); } catch (e) { /* */ }
      return;
    }
    try { closeSplashWindow(true); } catch (_) {}
    console.error('[unhandledRejection]', reason);
  });
}

module.exports = { installGlobalErrorHandlers };
