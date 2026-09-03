/* ── cli-bridge-native/debug-log — log debug của bridge, RAM-FIRST để bảo vệ ổ đĩa.
      Trước đây mỗi HTTP request appendFileSync thẳng xuống %TEMP%/ckm-cli-debug.txt
      (không giới hạn, ghi liên tục xuống NVMe/SSD). Giờ:
      - Gom dòng trong RAM (buffer vòng, tối đa MAX_BUFFER_LINES / MAX_BUFFER_BYTES).
      - Flush thành 1 lần / mỗi FLUSH_INTERVAL_MS (30s) hoặc khi buffer đầy.
      - File cap MAX_FILE_BYTES (512KB): quá thì xoá ghi lại — không phình vô hạn.
      Xem ckm-cli-debug vẫn như cũ (dùng dlog) — chỉ thay đổi cơ chế ghi. ── */
const os = require('os');
const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = 512 * 1024;        // cap file debug — giống lifecycle.log
const MAX_BUFFER_LINES = 200;
const MAX_BUFFER_BYTES = 32 * 1024;       // đầy sớm → flush ngay
const FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_LINE_CHARS = 2000;              // chặn dòng quái vật

function createDebugLog(engine, file) {
  const target = file || path.join(os.tmpdir(), 'ckm-cli-debug.txt');
  let lines = [];
  let buffered = 0;
  let timer = null;

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!lines.length) return;
    const chunk = lines.join('\n') + '\n';
    lines = [];
    buffered = 0;
    try {
      let size = 0;
      try { size = fs.statSync(target).size; } catch (_) {}
      // Giữ file dưới cap: nếu flush này vượt MAX_FILE_BYTES thì xoá ghi lại.
      const flag = (size + Buffer.byteLength(chunk, 'utf8')) > MAX_FILE_BYTES ? 'w' : 'a';
      fs.writeFileSync(target, chunk, { flag });
    } catch (_) {}
  }

  const log = function dlog(s) {
    const line = ('[' + engine + '] ' + String(s)).slice(0, MAX_LINE_CHARS);
    lines.push(line);
    buffered += line.length;
    if (!timer) {
      try { timer = setTimeout(() => { timer = null; flush(); }, FLUSH_INTERVAL_MS); } catch (_) {}
    }
    if (lines.length >= MAX_BUFFER_LINES || buffered >= MAX_BUFFER_BYTES) flush();
  };
  log.flush = flush;

  // Thoát tiến trình (kể cả kill mềm) → xả nốt phần còn trong RAM.
  try { process.on('exit', () => flush()); } catch (_) {}
  return log;
}

module.exports = { createDebugLog, MAX_FILE_BYTES };
