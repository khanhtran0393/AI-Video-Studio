'use strict';
/**
 * Application menu (thanh menu Tệp/Sửa/Xem/Cửa sổ — ẩn mặc định trên Windows/Linux).
 * Menu Sửa để Cmd/Ctrl+C/V/X/A hoạt động trong ô nhập.
 */
const { Menu } = require('electron');

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Tệp', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    // Menu Sửa: cho phép Cmd/Ctrl + C/V/X/A hoạt động trong ô nhập.
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle', label: 'Dán theo định dạng' }, { role: 'delete', label: 'Xoá' }, { role: 'selectAll', label: 'Chọn tất cả' }]
                : [{ role: 'delete', label: 'Xoá' }, { type: 'separator' }, { role: 'selectAll', label: 'Chọn tất cả' }]),
    ] },
    { label: 'Xem', submenu: [
      { role: 'reload', label: 'Tải lại' }, { role: 'forceReload', label: 'Tải lại (bỏ cache)' },
      { role: 'toggleDevTools', label: 'Công cụ nhà phát triển' }, { type: 'separator' },
      { role: 'resetZoom', label: 'Cỡ mặc định' }, { role: 'zoomIn', label: 'Phóng to' }, { role: 'zoomOut', label: 'Thu nhỏ' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Toàn màn hình' },
    ] },
    // Menu Cửa sổ: Video Agent mở NGAY TRONG app (tab sidebar "Video Agent" của cửa sổ chính)
    // — không tạo BrowserWindow riêng theo chính sách "mọi công cụ trong app".
    { label: 'Cửa sổ', submenu: [
      { label: 'Nova Video Agent', click: () => {
        try { require('../video-agent/window').openVideoAgentWindow(); }
        catch (e) { console.warn('[menu] mở Video Agent lỗi:', e && e.message); }
      } },
    ] },
  ]));
}

module.exports = { buildMenu };
