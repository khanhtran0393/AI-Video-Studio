'use strict';
/**
 * "Dịch" lỗi hệ thống thành thông báo tiếng Việt dễ hiểu cho khách.
 * Lỗi hay gặp: ENOSPC (ổ đĩa đầy khi tải video/ghi file) → không văng hộp
 * "A JavaScript error occurred" khó hiểu.
 */
function friendlyMainError(err) {
  const msg = String((err && (err.message || err)) || '');
  if (/ENOSPC|no space left/i.test(msg)) return 'Ổ đĩa đã ĐẦY — không còn chỗ để lưu file.\n\nHãy dọn bớt dung lượng (xoá file không dùng, dọn Thùng rác), để trống ít nhất vài GB rồi thử lại. Bạn cũng có thể chọn thư mục lưu ở ổ đĩa khác còn trống.';
  if (/EACCES|EPERM/i.test(msg)) return 'Không có quyền ghi vào thư mục lưu.\n\nHãy chọn thư mục lưu khác (vd Desktop) hoặc chạy app với quyền phù hợp.';
  if (/EROFS/i.test(msg)) return 'Thư mục lưu ở ổ chỉ-đọc.\n\nHãy chọn thư mục lưu khác còn ghi được.';
  return null; // không phải lỗi "đã biết" → để cơ chế mặc định xử lý
}

module.exports = { friendlyMainError };
