'use strict';
// Preflight cấu trúc cho Video Agent — kiểm tra HẾT điều kiện cần TRƯỚC khi đốt thời gian
// render (pattern PreflightIssue học từ core/export_preflight.py của TDTStudio, thích ứng
// với hợp đồng mã lỗi VA_* của dự án).
//
// Nguyên tắc:
//   1. Mỗi vấn đề là 1 issue object { code, message, fixHint, blocking }:
//      - `code`     : mã VA_* đã đăng ký trong ../errors.js (auto-fix phân loại theo mã).
//      - `message`  : tiếng Việt, con người đọc hiểu ngay (§32.17).
//      - `fixHint`  : gợi ý cách sửa, UI có thể hiện thẳng cho người dùng.
//      - `blocking` : true → chặn job ngay (fail lộ liễu — Luật 10); false → chỉ ghi nhận.
//   2. KHÔNG fallback ngầm: thiếu điều kiện thì trả issue, không "coi như ổn".
//   3. Preflight không đụng state/IPC — chỉ chạy nội bộ orchestrator, kết quả được persist
//      vào output/job.json (trường `preflight`) để `videoAgent:inspect` đọc lại được.

const fs = require('fs');
const path = require('path');

const DEFAULT_MIN_FREE_BYTES = 1024 * 1024 * 1024; // ≥1 GiB (đúng hợp đồng cũ của orchestrator)

function issue(code, message, fixHint, blocking) {
  return { code, message, fixHint: fixHint || '', blocking: blocking !== false };
}

// Thu thập mọi vấn đề preflight của job. Trả về MẢNG (có thể rỗng) — không ném lỗi,
// việc ném là trách nhiệm của orchestrator (để đi đúng luồng cleanup/persist hiện có).
function collectPreflightIssues({ projectDir, options = {}, probeRenderer } = {}) {
  const issues = [];

  // 1) Thư mục dự án phải tồn tại — không có dự án thì không kiểm tra gì thêm được.
  if (!projectDir || !fs.existsSync(projectDir)) {
    issues.push(issue('VA_PROJECT_NOT_FOUND',
      'Không tìm thấy thư mục dự án. Hãy chọn lại thư mục dự án Video Agent.',
      'Chọn lại thư mục dự án đúng (chứa script/, voice/…) rồi chạy lại.'));
    return issues;
  }

  // 2) Dung lượng đĩa — giữ nguyên hợp đồng cũ: skipDiskPreflight + minFreeBytes.
  const minFreeBytes = Number(options.minFreeBytes) || DEFAULT_MIN_FREE_BYTES;
  if (typeof fs.statfsSync === 'function' && options.skipDiskPreflight !== true) {
    try {
      const disk = fs.statfsSync(path.resolve(projectDir));
      const freeBytes = Number(disk.bavail) * Number(disk.bsize);
      if (Number.isFinite(freeBytes) && freeBytes < minFreeBytes) {
        issues.push(issue('VA_DISK_SPACE',
          `Không đủ dung lượng trống để render (cần tối thiểu ${minFreeBytes} byte, ổ còn ${freeBytes} byte).`,
          'Dọn Thùng rác / video cũ, hoặc chọn thư mục dự án ở ổ khác còn trống ít nhất vài GB.'));
      }
    } catch (e) {
      // Không đọc được thông số ổ đĩa → KHÔNG nuốt lỗi: báo issue non-blocking để người
      // dùng biết preflight thiếu dữ liệu an toàn (render vẫn có thể chạy bình thường).
      issues.push(issue('VA_DISK_SPACE',
        `Không đọc được dung lượng trống của ổ chứa dự án: ${String((e && e.message) || e)}`,
        'Kiểm tra lại ổ đĩa của thư mục dự án.', false));
    }
  }

  // 3) Thư mục output phải GHI ĐƯỢC (probe file nhỏ rồi xoá ngay — không để rác).
  const outDir = path.join(projectDir, 'output');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const probe = path.join(outDir, `.preflight-probe-${Date.now()}`);
    fs.writeFileSync(probe, 'preflight');
    fs.unlinkSync(probe);
  } catch (e) {
    issues.push(issue('VA_OUTPUT_NOT_WRITABLE',
      `Thư mục output của dự án không ghi được (${outDir}): ${String((e && e.message) || e)}`,
      'Chọn thư mục dự án khác (vd Desktop) hoặc chạy app với quyền ghi phù hợp.'));
  }

  // 4) Renderer mặc định khả dụng — CHỈ probe khi orchestrator dùng adapter mặc định
  //    (adapter inject từ IPC/test được coi là hợp lệ, không probe).
  if (typeof probeRenderer === 'function') {
    try {
      const p = probeRenderer();
      if (!p || p.available !== true) {
        issues.push(issue('VA_RENDERER_UNAVAILABLE',
          `Không nạp được bộ render Remotion: ${String((p && p.error) || 'không rõ lý do')}`,
          'Chạy lệnh: node editor-pro/nova-remotion/build.js rồi thử lại.'));
      }
    } catch (e) {
      issues.push(issue('VA_RENDERER_UNAVAILABLE',
        `Không probe được bộ render Remotion: ${String((e && e.message) || e)}`,
        'Chạy lệnh: node editor-pro/nova-remotion/build.js rồi thử lại.'));
    }
  }

  return issues;
}

// Issue đầu tiên chặn job (null nếu không có — job được phép chạy).
function firstBlocking(issues) {
  return (Array.isArray(issues) ? issues : []).find((i) => i && i.blocking) || null;
}

module.exports = { collectPreflightIssues, firstBlocking, preflightIssue: issue };