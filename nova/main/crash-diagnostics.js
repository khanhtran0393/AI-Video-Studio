'use strict';
/**
 * Chẩn đoán crash native (minidump) cho renderer/GPU/utility process.
 * Bối cảnh: lifecycle.log 09-03→09-11 ghi 117 dòng crash, pattern renderer +
 * Network(+GPU) chết CÙNG GIÂY (WER bắt được 1 sự kiện exception 0x80000003
 * STATUS_BREAKPOINT trong electron.exe). crashReporter chưa từng được bật nên
 * KHÔNG có dump nào tồn tại — giờ bật để MỌI crash thật tiếp theo để lại file
 * .dmp trong userData/crash-dumps (phân tích cục bộ, KHÔNG upload đi đâu:
 * uploadToServer: false — dữ liệu crash ở lại máy user).
 * Kèm bật chromium logging ra file (chrome-debug.log): khi CHECK()/DCHECK của
 * Chromium fail, message "Check failed: ..." kèm file:line được ghi ngay trước
 * khi crash → chỉ thẳng thủ phạm mà không cần symbol server.
 * Chỉ quan sát/thu thập — KHÔNG thay đổi hành vi chạy/thoát của app.
 */
const path = require('path');

function installCrashDiagnostics(app) {
  const dumpDir = path.join(app.getPath('userData'), 'crash-dumps');
  // Crashpad YÊU CẦU thư mục tồn tại trước khi start — thiếu là registration
  // protocol fail âm thầm (registration_protocol_win.cc CreateFile 0x2) và
  // không bao giờ có dump. Tạo chắc chắn trước.
  try { require('fs').mkdirSync(dumpDir, { recursive: true }); } catch (_) {}
  // Dẫn Crashpad DB về dumpDir: cách ĐÚNG là app.setPath('crashDumps') TRƯỚC
  // khi start crashReporter (options crashDumpsDir không được Electron tôn
  // trọng — dump mặc định rơi vào <userData>/Crashpad/reports).
  try { app.setPath('crashDumps', dumpDir); } catch (_) {}
  // Crashpad: bắt minidump cho main + renderer + GPU + utility process.
  // Phải gọi TRƯỚC app ready để không bỏ sót crash lúc khởi động.
  try {
    require('electron').crashReporter.start({
      submitToServer: false,
      uploadToServer: false,
      compress: true,
      ignoreSystemCrashReporter: true,
      crashDumpsDir: dumpDir,
    });
  } catch (e) {
    try { console.warn('[crash-diagnostics] crashReporter.start lỗi:', (e && e.message) || e); } catch (_) {}
  }
  // Chromium logging ra FILE: CHECK failed / DCHECK / lỗi renderer nghiêm trọng
  // được ghi trước lúc chết — nguồn root-cause trực tiếp khi kết hợp .dmp.
  try {
    app.commandLine.appendSwitch('enable-logging');
    app.commandLine.appendSwitch('log-file', path.join(dumpDir, 'chrome-debug.log'));
  } catch (e) { /* */ }
  // Hook kiểm tra pipeline dump: NOVA_CRASH_TEST=main → process.crash() 8s sau
  // khi ready. process.crash() là exception thật đi qua Crashpad → phải thấy
  // file .dmp trong dumpDir. (khác với forcefullyCrashRenderer của renderer —
  // TerminateProcess, KHÔNG sinh dump).
  if (process.env.NOVA_CRASH_TEST === 'main') {
    try {
      app.whenReady().then(() => {
        setTimeout(() => { try { process.crash(); } catch (_) { process.abort(); } }, 8000);
      });
    } catch (e) { /* */ }
  }
  return dumpDir;
}

module.exports = { installCrashDiagnostics };
