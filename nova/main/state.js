'use strict';
/**
 * Trạng thái & hằng số dùng chung của main process.
 * Các module trong nova/main/ chia sẻ qua object này thay vì biến toàn cục rải rác
 * — muốn thêm trạng thái mới: khai báo ở đây rồi đọc/ghi qua `state.<tên>`.
 */
const path = require('path');

// Thư mục giao diện tĩnh do local server phục vụ (127.0.0.1).
const WEB_DIR = path.join(__dirname, '..', 'web');
// Bundle "Nova Scene" — bộ THÔNG DỊCH cảnh do ta tự build (editor-pro/nova-remotion).
// AI sinh SPEC JSON cho từng cảnh, engine cố định diễn giải → thời lượng luôn bằng đúng giây của cảnh.
const NOVA_REMOTION_DIR = path.join(__dirname, '..', 'editor-pro', 'nova-remotion', 'bundle');

module.exports = {
  // ── Hằng số ──
  WEB_DIR,
  NOVA_REMOTION_DIR,
  // Host được phép mở cửa sổ đăng nhập popup (Google/Firebase), còn lại mở trình duyệt ngoài.
  AUTH_HOSTS: /(^|\.)(accounts\.google\.com|google\.com|firebaseapp\.com|novastudio\.com)$/i,
  // Logo phải hiển thị tối thiểu 5 giây khi khởi động; nếu app tải lâu hơn thì
  // splash giữ nguyên cho tới khi trang chính tải xong (reveal chờ did-finish-load).
  SPLASH_MIN_MS: 5000,
  SPLASH_MAX_MS: 12000,

  // ── Trạng thái runtime (mutable) ──
  mainWindow: null,
  splashWindow: null,
  localServer: null,
  serverPort: 0,
  isQuitting: false,
  splashCloseTimer: null,
  splashShownAt: 0,   // thời điểm logo splash THỰC SỰ hiện ra (ready-to-show)
  errorReporter: null,
  unregisterErrorBridge: null,
  reporterShutdownPromise: null,
  reporterQuitReady: false,
};
