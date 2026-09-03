'use strict';
/**
 * Quản lý file tạm tập trung của AI Video Studio — bảo vệ ổ đĩa (đặc biệt NVMe/SSD):
 * - Mọi file trung gian (ảnh gửi CLI, input render FFmpeg…) nằm trong 1 thư mục tạm
 *   DUY NHẤT của app: <os.tmpdir()>/ai-video-studio (đè bằng env NOVA_TEMP_DIR).
 * - cleanupTempOrphans(): xoá file/thư mục tạm "mồ côi" (app crash/kill giữa chừng
 *   để lại) cũ hơn maxAge — gọi 1 lần khi app khởi động.
 * - Kết quả cuối (MP4…) vẫn do người dùng chọn nơi lưu — không nằm ở đây.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;   // 1 ngày

function appTempDir() {
  const override = process.env.NOVA_TEMP_DIR;
  if (override) return override;
  return path.join(os.tmpdir(), 'ai-video-studio');
}

function ensureAppTempDir() {
  const dir = appTempDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

// Đường dẫn file tạm duy nhất bên trong thư mục tạm của app.
function tempFile(prefix, suffix) {
  const name = (prefix || 'nova-') + Date.now() + '-' + Math.floor(Math.random() * 1e6) + (suffix || '');
  return path.join(ensureAppTempDir(), name);
}

function _walk(dir, cutoff, stats) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    let st;
    try { st = fs.statSync(p); } catch (_) { continue; }
    if (st.isDirectory()) {
      _walk(p, cutoff, stats);
      // Thư mục con quá hạn → xoá cả nhánh; rỗng → xoá luôn cho gọn.
      try {
        if (st.mtimeMs < cutoff) { fs.rmSync(p, { recursive: true, force: true }); stats.dirsRemoved++; }
        else if (fs.readdirSync(p).length === 0) { fs.rmSync(p, { force: true }); stats.dirsRemoved++; }
      } catch (_) {}
    } else if (st.mtimeMs < cutoff) {
      try { fs.rmSync(p, { force: true }); stats.removed++; stats.bytes += st.size || 0; } catch (_) {}
    }
  }
}

// Xoá mọi file/thư mục tạm cũ hơn maxAgeMs. Trả thống kê (không ném lỗi).
function cleanupTempOrphans(maxAgeMs) {
  const age = Number(maxAgeMs) > 0 ? Number(maxAgeMs) : DEFAULT_MAX_AGE_MS;
  const cutoff = Date.now() - age;
  const stats = { dir: appTempDir(), removed: 0, dirsRemoved: 0, bytes: 0 };
  try { _walk(stats.dir, cutoff, stats); } catch (_) {}
  return stats;
}

module.exports = { appTempDir, ensureAppTempDir, tempFile, cleanupTempOrphans, DEFAULT_MAX_AGE_MS };
