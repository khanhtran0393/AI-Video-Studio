'use strict';
/**
 * imzic-helpers.js — hàm thuần dùng chung của IPC I-MZic (nova/main/ipc/imzic.js).
 * Tách ngày 2026-09-15 để kiểm định được bằng sandbox (test:imzic — imzic-core-test.js
 * nạp NGUYÊN VĂN file này, không cần Electron): mọi hàm ở đây KHÔNG đụng electron,
 * chỉ dùng path/fs/os/child_process thuần.
 * Không fallback ngầm (Luật 10): lỗi hết đĩa / copy thất bại đều ném Error có code.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

function safeExt(name, fallback) {
  const m = String(name || '').match(/(\.[a-zA-Z0-9]{1,8})$/);
  return (m && m[1]) || fallback;
}

// Tên file đích an toàn cho tự-lưu của hàng chờ: bỏ ký tự cấm trên Windows +
// mọi thành phần đường dẫn (chống path traversal), rỗng thì dùng tên mặc định.
function safeBaseName(name, fallback) {
  const s = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return s || fallback;
}

// D2: ghi đích NGUYÊN TỬ — copy ra "<đích>.part" rồi rename (cùng ổ đĩa → rename
// là nguyên tử). Mất điện / crash giữa chừng không còn để lại file MP4 hỏng
// trông như thành công. Lỗi copy → xoá .part rồi ném lại (không nuốt — Luật 10).
function atomicCopyFile(src, dest) {
  const part = dest + '.part';
  try {
    fs.copyFileSync(src, part);
    fs.renameSync(part, dest);
  } catch (err) {
    try { fs.unlinkSync(part); } catch (_) {}
    throw err;
  }
}

// D1: preflight dung lượng đĩa trước khi ghi tmp + đích. statfs có sẵn Node ≥18.15;
// không đọc được dung lượng (hệ file lạ) → trả Infinity coi như "không chặn" —
// đây là khai báo rõ, không phải fallback âm thầm (ffmpeg chết đĩa đầy vẫn lộ).
function diskFreeBytes(dirPath) {
  try {
    const s = fs.statfsSync(dirPath || os.tmpdir());
    return s.bavail * s.bsize;
  } catch (_) {
    return Infinity;
  }
}

// need = 2×(video + nhạc) [tmp + đích] + 256 MB dư cho muxer/metadata.
// Lỗi → ném IMZIC_DISK_FULL kèm số MB còn / cần.
function assertDiskSpace(needBytes, dirPath) {
  const free = diskFreeBytes(dirPath);
  if (free === Infinity) return;
  if (free < needBytes) {
    throw Object.assign(
      new Error('Dung lượng đĩa còn ' + Math.round(free / 1048576) + ' MB — cần khoảng '
        + Math.round(needBytes / 1048576) + ' MB để xuất video (thư mục tạm + đích lưu). '
        + 'Hãy dọn đĩa rồi thử lại.'),
      { code: 'IMZIC_DISK_FULL' });
  }
}

// D4: kill CẢ CÂY tiến trình — proc.kill() chỉ giết ffmpeg.exe, nếu ffmpeg từng
// spawn tiến trình con (pipe, script) sẽ để zombie chiếm file tmp vĩnh viễn.
// Windows: taskkill /T /F; platform khác: kill() đủ (SIGTERM không có tree concept).
function killProcessTree(proc) {
  if (process.platform === 'win32' && proc && proc.pid) {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
      return;
    } catch (_) { /* rơi xuống kill() thường */ }
  }
  try { proc.kill(); } catch (_) {}
}

// D1: ước lượng byte nhạc của payload IPC — audioPath đọc size trên đĩa, bytes
// đọc length. Không đọc được size (path vừa bị xoá…) → 0, preflight vẫn chạy
// phần video (không nuốt lỗi bước sau — copy/ghi thật vẫn fail lộ nếu hết đĩa).
function payloadAudioBytes(p) {
  try {
    if (p && typeof p.audioPath === 'string' && p.audioPath) return fs.statSync(p.audioPath).size;
  } catch (_) {}
  const a = p && p.audio;
  if (a instanceof Uint8Array) return a.byteLength;
  if (a instanceof ArrayBuffer) return a.byteLength;
  if (a && Buffer.isBuffer(a)) return a.length;
  return 0;
}

// A3: dọn file tạm tồn đọng của phiên cũ (app crash / mất điện giữa lúc export —
// `finally` của handler không kịp chạy): dir imzic-mux-* / imzic-offline-* cũ hơn
// 24h trong os.tmpdir(). Best-effort housekeeping, không chặn đăng ký IPC.
function sweepStaleImzicTmp() {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (!/^imzic-(mux|offline)-/.test(name)) continue;
      const full = path.join(os.tmpdir(), name);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory() && st.mtimeMs < cutoff) fs.rmSync(full, { recursive: true, force: true });
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[imzic] quét dọn tmp thất bại:', err && err.message ? err.message : String(err));
  }
}

module.exports = { safeExt, safeBaseName, atomicCopyFile, diskFreeBytes, assertDiskSpace, killProcessTree, sweepStaleImzicTmp, payloadAudioBytes };
