'use strict';
/**
 * Atomic write — ghi file an toàn tránh hỏng khi crash/giật điện.
 *
 * Quy ước: ghi nội dung ra `<target>.tmp.<pid>.<ts>` rồi `renameSync` thành `<target>`.
 * - Trên cùng volume (Node đảm bảo khi cùng `dirname`), rename là atomic trên
 *   Windows NTFS / Linux ext4 / macOS APFS.
 * - Nếu target đã tồn tại sẽ bị thay thế. Nếu từng quá trình chết giữa lúc ghi
 *   tmp, file tmp mồ côi sẽ được janitor.startupJanitor() dọn (xem main/janitor.js).
 *
 * Dùng cho: settings-store.json, job.json, video-agent/cache, secret-vault.bin…
 * Học từ credentialVault của AI Novel (atomic write + mã hoá tên file).
 */
const fs = require('fs');
const path = require('path');

/**
 * Ghi text an toàn vào file. Trả về true nếu thành công.
 * @param {string} filePath đường dẫn tuyệt đối
 * @param {string} content  nội dung
 * @param {object} [opts]   { encoding?, mode? } — encoding mặc định 'utf8'
 */
function atomicWriteFile(filePath, content, opts = {}) {
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error('atomicWriteFile: đường dẫn tuyệt đối bắt buộc (' + String(filePath) + ')');
  }
  const encoding = opts.encoding || 'utf8';
  const mode = opts.mode;
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  // Tên tmp: cùng thư mục với file đích (rename cùng volume = atomic).
  // <base>.tmp.<pid>.<hrtime-ms>: tránh trùng giữa nhiều tiến trình + nhiều lần ghi.
  const base = path.basename(filePath);
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const tmp = path.join(dir, base + '.tmp.' + process.pid + '.' + stamp);
  let bytes;
  if (Buffer.isBuffer(content)) bytes = content;
  else bytes = Buffer.from(content, encoding);
  const fd = fs.openSync(tmp, 'w', mode);
  try {
    fs.writeSync(fd, bytes, 0, bytes.length, 0);
    try { fs.fsyncSync(fd); } catch (_) { /* một số FS không hỗ trợ */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    // Windows: renameSync fail nếu file đích đang mở bằng quyền đọc — thử lại 1 lần.
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
  return true;
}

/**
 * Ghi Buffer nhị phân (cipher, ảnh…) an toàn.
 */
function atomicWriteBuffer(filePath, buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('atomicWriteBuffer: cần Buffer, nhận ' + typeof buffer);
  }
  return atomicWriteFile(filePath, buffer, Object.assign({}, opts, { encoding: undefined }));
}

/**
 * Liệt kê file .tmp mồ côi trong 1 thư mục — dùng cho janitor.
 * Trả về danh sách đường dẫn tuyệt đối.
 */
function listOrphanTmp(dir) {
  const out = [];
  if (!dir) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_) { return out; }
  const re = /\.tmp\.\d+\.[a-z0-9-]+$/i;
  for (const name of entries) {
    if (re.test(name)) out.push(path.join(dir, name));
  }
  return out;
}

module.exports = { atomicWriteFile, atomicWriteBuffer, listOrphanTmp };
