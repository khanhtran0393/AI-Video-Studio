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

// ── Danh sách host tin cậy (NGUỒN CHÂN LÝ) ──
// window.js dựng Set<string> từ 2 mảng này cho security-policy.js
// (isAllowlistedHost khớp host & subdomain — thay cho cặp regex cũ
// AUTH_HOSTS/EXTERNAL_LINK_HOSTS đã gỡ). Thêm host mới: sửa mảng ở đây,
// KHÔNG nhái tên host ở file khác.
const AUTH_HOST_NAMES = [
  'accounts.google.com', 'google.com', 'firebaseapp.com', 'novastudio.com',
];
const EXTERNAL_LINK_HOST_NAMES = [
  'console.anthropic.com', 'platform.openai.com', 'aistudio.google.com',
  'console.cloud.google.com', 'platform.deepseek.com', 'openrouter.ai',
  'console.groq.com', 'console.mistral.ai', 'dashboard.cohere.com',
  'docs.perplexity.ai', 'api.together.xyz', 'fireworks.ai',
  'pexels.com', 'pixabay.com', 'unsplash.com',
];

module.exports = {
  // ── Hằng số ──
  WEB_DIR,
  NOVA_REMOTION_DIR,
  // Danh sách host gốc (NGUỒN CHÂN LÝ) — window.js dựng Set<string> cho
  // security-policy.js (isAllowlistedHost khớp host & subdomain, thay regex cũ).
  AUTH_HOST_NAMES,
  EXTERNAL_LINK_HOST_NAMES,
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
  // electron.app handle — dùng trong test runner (window.js e2e) làm fallback
  // khi require('electron') không khả dụng (chạy ngoài Electron, vd CI script).
  // Ở runtime thật require('electron') luôn thành công nên nhánh này chỉ chạy
  // khi fallback path kích hoạt.
  app: null,
};
