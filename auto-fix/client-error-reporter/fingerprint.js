'use strict';

const crypto = require('crypto');

// Normalize volatile tokens so identical failures collapse to one fingerprint.
function normalizeMessage(message) {
  return String(message || '')
    .replace(/0x[0-9a-f]+/gi, '<HEX>')
    .replace(/\b\d+\b/g, '<N>')
    .replace(/[A-Za-z]:[\\/][^\s'"]+/g, '<PATH>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

function normalizeErrorCode(error) {
  const code = error && (error.code || error.errno || error.exitCode || error.hResult);
  return code === null || code === undefined || code === ''
    ? ''
    : String(code).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
}

// Tách basename của file trong stack: đường dẫn đầy đủ đổi theo máy cài
// (dev checkout, AppData\Local\Programs, resources\app.asar) nên phải loại khỏi
// fingerprint. Mirror extractModule bên crash-server/fingerprint.js.
function basenameOf(file) {
  return String(file || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .split('?')[0]
    .toLowerCase();
}

// Chuẩn hoá một frame stack: chỉ giữ tên hàm + tên file (basename) + vị trí đã
// thay số bằng <N>. Đường dẫn cài và line:column là dữ liệu bay theo máy/build
// — giữ nguyên chúng làm cùng một lỗi ra fingerprint khác nhau trên máy dev và
// máy trắng (đã tái hiện 2026-09-03: render.js:42:7 ở 2 thư mục cài khác nhau
// ra 2 hash khác nhau), phá dedup phía crash-server vì dedupKeyFor tin
// fingerprint client khi hợp lệ. Mirror normalizeStack bên crash-server
// (cũng thay :<N>:<N>).
function normalizeFrame(frame) {
  if (!frame) return '';
  const file = basenameOf(frame.file || frame.fileName || '');
  const fn = String(frame.function || frame.functionName || frame.methodName || '<anonymous>')
    .replace(/[0-9a-f]{8,}/gi, '<HEX>');
  return `${fn}@${file}:<N>:<N>`;
}

function extractFrames(error) {
  if (!error || !error.stack) return [];
  const lines = String(error.stack).split(/\r?\n/).slice(1);
  const frames = [];
  for (const line of lines) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (match) {
      frames.push({
        function: match[1] || '',
        file: match[2],
        lineNumber: Number(match[3]),
        columnNumber: Number(match[4]),
      });
    }
  }
  return frames.slice(0, 8);
}

/**
 * Stable technical fingerprint: exception type + normalized message +
 * normalized stack frames + originating module. Volatile data is excluded so
 * many reports collapse to a single fingerprint (one BugCase, one AI run).
 */
function fingerprintException(error) {
  const frames = extractFrames(error);
  const normalizedMessage = normalizeMessage(error && error.message);
  const normalizedFrames = frames.map(normalizeFrame).join('|');
  // Basename + lowercase: mirror extractModule của crash-server để module không
  // chứa đường dẫn cài (Windows stack dùng backslash, split('/') không tách được).
  const moduleName = basenameOf(frames[0] && frames[0].file);
  const errorType = String(
    (error && error.name)
    || (error && error.constructor && error.constructor.name)
    || 'Error',
  );
  const errorCode = normalizeErrorCode(error);
  const basis = [errorType, errorCode, normalizedMessage, normalizedFrames, moduleName].join('\n');
  const hash = crypto.createHash('sha256').update(basis, 'utf8').digest('hex');
  return {
    fingerprint: hash,
    errorType,
    errorCode,
    normalizedMessage,
    frames: frames.map(normalizeFrame),
    module: moduleName,
  };
}

module.exports = { fingerprintException, normalizeMessage, normalizeFrame, normalizeErrorCode, extractFrames };