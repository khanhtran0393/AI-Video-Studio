'use strict';
/**
 * Single-instance lock — đảm bảo chỉ MỘT tiến trình AI Video Studio chạy thật.
 *
 * - Instance thứ hai gọi vào sẽ KHÔNG tạo cửa sổ / KHÔNG chiếm cổng bridge
 *   (8793-8796) — trả false để composition root thoát ngay (exit sạch).
 * - Instance ĐẦU nhận sự kiện 'second-instance' → hiện & focus cửa sổ chính,
 *   dùng đúng logic focus đang dùng ở Agent Bridge (actionFocus trong
 *   agent-bridge.js): restore nếu minimize → show → focus.
 *
 * Lưu ý: lock gắn với userData do applyAppIdentity() đặt — bắt buộc gọi
 * ensureSingleInstance() SAU applyAppIdentity().
 */
const { app } = require('electron');
const state = require('./state');

function ensureSingleInstance() {
  let gotLock = false;
  try {
    gotLock = app.requestSingleInstanceLock();
  } catch (e) {
    // Không nuốt lỗi âm thầm (Luật 10) — chỉ log rồi coi như có lock để app
    // vẫn khởi động; Electron chưa từng fail ở đây trên Windows/macOS.
    console.warn('[single-instance] requestSingleInstanceLock lỗi:', e && e.message);
    return true;
  }
  if (!gotLock) {
    console.log('[single-instance] một instance khác đang chạy — instance này thoát ngay.');
    return false;
  }
  app.on('second-instance', () => {
    try {
      const win = state.mainWindow;
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    } catch (e) {
      console.warn('[single-instance] focus cửa sổ thất bại:', e && e.message);
    }
  });
  return true;
}

module.exports = { ensureSingleInstance };
