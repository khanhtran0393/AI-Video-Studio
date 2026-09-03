'use strict';

/**
 * §Errors — Thông báo lỗi tiếng Việt cho Documentary pipeline.
 * Nguyên tắc (khớp video-agent/errors.js):
 *  - Mọi lỗi ném ra renderer phải có message tiếng Việt rõ ràng, kèm hành động.
 *  - Giữ nguyên code/stage/original để auto-fix (job.json, project.render) đọc.
 *  - App lỗi KHÔNG tạo file output, KHÔNG tạo thư mục tạm (dọn phía caller).
 */

const { viSystemError, VI_MESSAGES } = require('../video-agent/errors');

/** Mã lỗi riêng của Documentary (DOC_*) — message tiếng Việt. */
const DOC_MESSAGES = {
  DOC_ROOT_REQUIRED: 'Thiếu thư mục dữ liệu của app (rootDir). Khởi động lại app.',
  DOC_PROJECT_ID_INVALID: 'Mã dự án chỉ được chứa chữ, số, gạch dưới (_) hoặc gạch ngang (-), tối đa 120 ký tự.',
  DOC_PROJECT_EXISTS: 'Dự án đã tồn tại. Chọn tên khác hoặc bật ghi đè (overwrite).',
  DOC_PROJECT_NOT_FOUND: 'Không tìm thấy dự án. Kiểm tra danh sách dự án rồi thử lại.',
  DOC_PROJECT_INVALID: 'Dự án không hợp lệ',
  DOC_VERSION_NOT_FOUND: 'Không tìm thấy phiên bản cần khôi phục. Xem lại danh sách phiên bản.',
  DOC_NARRATION_LOCKED: 'Kịch bản đã bị khóa nội dung. Bấm Unlock trước khi thay đổi.',
  DOC_UNLOCK_FAILED: 'Không mở khóa được nội dung kịch bản. Thử lại hoặc mở dự án lại.',
  DOC_JOB_FAILED: 'Công việc xử lý thất bại',
  DOC_RENDER_FAILED: 'Không render được video',
  DOC_WINDOW_UNAVAILABLE: 'Không mở được cửa sổ Documentary từ môi trường này.',
};

/**
 * Bảng quy luật dịch thông điệp tiếng Anh thường gặp → tiếng Việt.
 * Regex khớp đầu tiên thắng; nhóm () (nếu có) được chèn vào chuỗi kết quả.
 */
const PATTERNS = [
  [/^Documentary project already exists:?\s*(.*)$/i, 'Dự án $1 đã tồn tại. Chọn tên khác hoặc bật ghi đè (overwrite).'],
  [/^Documentary project not found:?\s*(.*)$/i, 'Không tìm thấy dự án $1. Kiểm tra danh sách dự án rồi thử lại.'],
  [/^Version not found:?\s*(.*)$/i, 'Không tìm thấy phiên bản $1.'],
  [/^projectId must contain only.*$/i, DOC_MESSAGES.DOC_PROJECT_ID_INVALID],
  [/^project is required$/i, 'Thiếu dữ liệu dự án để lưu trữ.'],
  [/^rootDir and projectId are required$/i, 'Thiếu thư mục dữ liệu hoặc mã dự án.'],
  [/^documentary rootDir is required$/i, DOC_MESSAGES.DOC_ROOT_REQUIRED],
  [/^Narration is locked.*Unlock the project first\.*$/i, DOC_MESSAGES.DOC_NARRATION_LOCKED],
  [/^Invalid documentary project:?\s*(.*)$/i, 'Dự án không hợp lệ: $1.'],
  [/^Documentary window opening is not available.*$/i, DOC_MESSAGES.DOC_WINDOW_UNAVAILABLE],
  [/^job failed$/i, 'Công việc xử lý thất bại.'],
  [/^task function is required$/i, 'Lỗi nội bộ: thiếu hàm xử lý công việc.'],
  [/^ipcMain\.(handle|on) is required$/i, 'Lỗi nội bộ: IPC chưa sẵn sàng.'],
];

/** Dịch 1 chuỗi thông điệp (đã strip prefix) sang tiếng Việt nếu nhận ra. */
function viMessage(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  // VA_* đã có sẵn tiếng Việt ở video-agent/errors — giữ nguyên.
  for (const [pattern, template] of PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const captured = (m[1] != null ? String(m[1]).trim() : '');
      return template.replace('$1', captured);
    }
  }
  return '';
}

/** Lỗi hệ thống (ENOSPC/EACCES/EROFS/ENOENT…) → tiếng Việt, trả '' nếu không khớp. */
function systemMessage(error) {
  const raw = String((error && (error.message || error)) || '');
  return viSystemError(raw) || '';
}

/**
 * Chuẩn hoá mọi lỗi thành Error tiếng Việt.
 * @param {Error|any} error lỗi gốc (giữ ở .original)
 * @param {string} stage channel/giai đoạn sinh lỗi (để auto-fix định vị)
 * @returns {Error} Error mới: message tiếng Việt, .code, .stage, .original
 */
function viError(error, stage) {
  const rawMessage = String((error && error.message) || error || '').trim();
  // Bóc bọc lỗi kiểu "Error invoking remote method 'x': <lỗi thật>" / "Error: <msg>"
  const cleaned = rawMessage.replace(/^Error invoking remote method '[^']*':\s*/i, '').replace(/^Error:\s*/i, '');
  const code = (error && error.code) || codeFor(cleaned) || 'DOC_UNKNOWN';
  // Thứ tự ưu tiên: pattern tiếng Anh đã biết → lỗi hệ thống → mã VA_*/DOC_* →
  // fallback tiếng Việt kèm chi tiết gốc (giữ nguyên chi tiết để báo lỗi đúng).
  const text =
    viMessage(cleaned) ||
    systemMessage(error) ||
    viText(code, '') ||
    (cleaned
      ? `Lỗi trong quá trình xử lý: ${cleaned}`
      : 'Lỗi không xác định. Hãy thử lại; nếu còn lỗi thì khởi động lại app.');
  const out = new Error(text);
  out.code = code;
  out.stage = stage || (error && error.stage) || null;
  out.original = rawMessage || null;
  return out;
}

/** Chọn mã DOC_* theo nội dung thông điệp (auto-fix phân nhánh theo code). */
function codeFor(text) {
  const t = String(text || '');
  if (/already exists/i.test(t)) return 'DOC_PROJECT_EXISTS';
  if (/project not found/i.test(t)) return 'DOC_PROJECT_NOT_FOUND';
  if (/Invalid documentary project/i.test(t)) return 'DOC_PROJECT_INVALID';
  if (/Version not found/i.test(t)) return 'DOC_VERSION_NOT_FOUND';
  if (/Narration is locked/i.test(t)) return 'DOC_NARRATION_LOCKED';
  if (/projectId must contain/i.test(t)) return 'DOC_PROJECT_ID_INVALID';
  if (/rootDir is required/i.test(t)) return 'DOC_ROOT_REQUIRED';
  if (/window opening is not available/i.test(t)) return 'DOC_WINDOW_UNAVAILABLE';
  return null;
}

/** Text tiếng Việt cho mã đã biết (VA_* hoặc DOC_*). */
function viText(code, fallback) {
  const text = (DOC_MESSAGES[code] || VI_MESSAGES[code] || '').trim();
  if (text) return text;
  const fb = String(fallback || '').trim();
  if (!fb) return '';
  const vi = viMessage(fb.replace(/^Error:\s*/i, ''));
  return vi || fb;
}

module.exports = { DOC_MESSAGES, viError, viText, viMessage };
