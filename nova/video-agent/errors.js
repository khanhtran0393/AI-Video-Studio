'use strict';
// §32.17 — Báo lỗi tiếng Việt rõ ràng khi app lỗi (§1.6 lỗi phải dễ hiểu).
// Nguyên tắc khi job LỖI:
//   1. `message` luôn là tiếng Việt, con người đọc hiểu ngay.
//   2. KHÔNG để lại file output (preview/full render) — xoá sạch bằng cleanupArtifacts().
//   3. KHÔNG để lại thư mục tạm/rác — removeDirIfEmpty() dọn thư mục output rỗng.
//   4. VẪN giữ dữ liệu cho auto-fix: error object giữ `code` + `original` + `details`,
//      job.json + version store không bị xoá (đó là metadata, không phải file output).

const fs = require('fs');

// Bảng mã lỗi VA_* → thông điệp tiếng Việt. Mã lỗi là khoá để auto-fix phân loại
// (không dịch/đổi mã), chỉ chữ hiển thị cho người dùng là tiếng Việt.
const VI_MESSAGES = {
  VA_PROJECT_NOT_FOUND: 'Không tìm thấy thư mục dự án. Hãy chọn lại thư mục dự án Video Agent.',
  VA_SCRIPT_MISSING: 'Không tìm thấy kịch bản (.md/.txt) trong thư mục script/ hoặc thư mục gốc của dự án. Hãy thêm file kịch bản rồi chạy lại.',
  VA_CONFIG_INVALID: 'File config.json của dự án bị hỏng, không đọc được JSON. Hãy sửa lại config.json rồi thử lại.',
  VA_DISK_SPACE: 'Ổ đĩa không đủ dung lượng trống để render. Hãy dọn bớt file (dọn Thùng rác, xoá video cũ) hoặc chọn ổ đĩa khác còn trống ít nhất vài GB.',
  VA_STAGE_TIMEOUT: 'Một bước trong quy trình kéo dài quá lâu nên đã bị dừng. Hãy thử lại; nếu video quá dài, hãy cắt ngắn lại.',
  VA_CANCELLED: 'Đã huỷ job theo yêu cầu.',
  VA_PREVIEW_EMPTY: 'Không có cảnh nào để dựng bản xem trước (preview). Kiểm tra lại kịch bản/timestamps TTS.',
  VA_PREVIEW_FAIL: 'Không dựng được bản xem trước (preview).',
  VA_RENDER_FAIL: 'Không render được video hoàn chỉnh.',
  VA_FINAL_QA_FAIL: 'Kiểm tra chất lượng cuối cùng KHÔNG ĐẠT nên video không được xuất ra. Dữ liệu lỗi đã lưu — chế độ auto-fix có thể chạy lại.',
  VA_UPLOAD_FAIL: 'Không tải lên được video kết quả.',
  VA_UPLOAD_SOURCE_MISSING: 'File video cần tải lên không tồn tại.',
  VA_RENDERER_UNAVAILABLE: 'Không nạp được bộ render Remotion. Chạy lệnh: node editor-pro/nova-remotion/build.js rồi thử lại.',
  VA_S3_NO_CONFIG: 'Chưa cấu hình bucket S3 để tải lên. Hãy khai báo bucket trong phần cài đặt upload.',
  VA_S3_NO_CREDS: 'Thiếu khoá S3 (access key / secret) để tải lên. Hãy khai báo VA_S3_ACCESS_KEY_ID và VA_S3_SECRET_ACCESS_KEY.',
  VA_BUSY: 'Đang có một job Video Agent khác chạy. Vui lòng đợi job hiện tại xong rồi thử lại.',
  VA_UNKNOWN: 'Lỗi không xác định. Vui lòng chạy lại; nếu vẫn lỗi, gửi báo cáo lỗi kèm chi tiết bên dưới.',
};

// Lỗi hệ thống (errno) → dịch thô khi code không có trong bảng.
function viSystemError(raw) {
  const msg = String(raw || '');
  if (/ENOSPC|no space left/i.test(msg)) return 'Ổ đĩa đã đầy — không còn chỗ để ghi file. Hãy dọn bớt dung lượng rồi thử lại.';
  if (/EACCES|EPERM/i.test(msg)) return 'Không có quyền ghi vào thư mục dự án. Hãy chọn thư mục khác (vd Desktop) hoặc chạy app với quyền phù hợp.';
  if (/EROFS/i.test(msg)) return 'Thư mục dự án nằm trên ổ chỉ-đọc. Hãy chọn thư mục khác còn ghi được.';
  if (/ENOENT/i.test(msg)) return 'Không tìm thấy file/thư mục cần dùng. Kiểm tra lại các file trong dự án.';
  return null;
}

// Thông điệp tiếng Việt cho 1 lỗi: ưa mã lỗi đã biết, sau đó dịch lỗi hệ thống,
// cuối cùng giữ nguyên thông điệp gốc (nhiều nơi đã viết tiếng Việt sẵn).
function viText(code, fallback) {
  // Mã lỗi đã biết (khác VA_UNKNOWN) luôn thắng — auto-fix phân loại theo mã.
  if (code && code !== 'VA_UNKNOWN' && VI_MESSAGES[code]) return VI_MESSAGES[code];
  // Mã chưa biết → thử dịch lỗi hệ thống (ENOSPC/EACCES…) trước khi chịu thua.
  const sys = viSystemError(fallback);
  if (sys) return sys;
  if (code && VI_MESSAGES[code]) return VI_MESSAGES[code];
  const raw = String((fallback || '')).trim();
  return raw || VI_MESSAGES.VA_UNKNOWN;
}

// Chuẩn hoá mọi lỗi thành object thống nhất để UI + auto-fix cùng dùng:
//   { code, stage, message (tiếng Việt), original (thông điệp gốc), details (QA errors…) }
function viError(err, stage) {
  const code = (err && err.code) || 'VA_UNKNOWN';
  const original = String((err && (err.message || err)) || '');
  return {
    code,
    stage: stage || (err && err.stage) || null,
    message: viText(code, original),
    original,
    details: (err && (err.details || (err.qa && err.qa.errors))) || null,
  };
}

// Khi app lỗi: xoá mọi file output (preview/full render) đã tạo trong run này.
// Chỉ xoá đúng file được truy vết — không đụng file của job khác hay dữ liệu người dùng.
function cleanupArtifacts(files) {
  const removed = [];
  for (const f of Array.isArray(files) ? files : [files]) {
    if (!f) continue;
    try {
      if (fs.existsSync(f)) { fs.unlinkSync(f); removed.push(f); }
    } catch (_) { /* hết quyền/timing — bỏ qua, không để lỗi dọn rác đè lỗi gốc */ }
  }
  return removed;
}

// Khi app lỗi: nếu thư mục output rỗng (chưa kịp render gì, job.json ghi hỏng)
// thì dọn luôn để không để lại thư mục rác. Chỉ xoá khi THẬT SỰ rỗng.
function removeDirIfEmpty(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) return false;
    if (fs.readdirSync(dir).length) return false;
    fs.rmdirSync(dir);
    return true;
  } catch (_) { return false; }
}

module.exports = { VI_MESSAGES, viText, viError, viSystemError, cleanupArtifacts, removeDirIfEmpty };