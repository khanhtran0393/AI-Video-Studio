'use strict';
// Ngân sách CPU cho tiến trình con nặng (ffmpeg con ghép audio, các spawn ffmpeg của editor-pro).
//
// Học từ core/cpu_budget.py của TDTStudio (Job Object hard-cap trên Windows), nhưng Node
// KHÔNG gọi được Win32 Job Object / SetProcessAffinityMask nếu không thêm native module —
// điều bị cấm với video-agent (Luật 9). Nên dùng 2 đòn bẩy có sẵn của Node:
//   1. os.setPriority()  → hạ ưu tiên tiến trình con xuống BELOW_NORMAL: khi render/mux,
//      UI Electron và các tác vụ khác vẫn mượt (đây là phần giá trị nhất trên máy yếu).
//   2. -threads <n>      → giới hạn số thread ffmpeg dùng theo % ngân sách CPU.
// Cả hai đều là degrade CÓ CHỦ ĐÍCH và được khai báo qua giá trị trả về (Luật 10):
// không hạ được ưu tiên KHÔNG phải lý do huỷ render, nhưng kết quả trả {ok:false, error}
// để caller ghi nhận vào log/sự kiện thay vì im lặng.

const os = require('os');

// Số thread cho ffmpeg theo % ngân sách CPU (kẹp 25–100, mặc định 75). Luôn ≥1.
function videoThreads(percent) {
  const cores = Math.max(1, (os.cpus() || [{}, {}]).length || 4);
  const pct = Math.min(100, Math.max(25, Number(percent) || 75));
  return Math.max(1, Math.round((cores * pct) / 100));
}

// Hạ ưu tiên tiến trình con (best-effort — không ném, trả kết quả để caller ghi nhận).
function applyLowPriority(child) {
  try {
    if (!child || !child.pid) return { ok: false, error: 'tiến trình con chưa có pid' };
    os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = { videoThreads, applyLowPriority };