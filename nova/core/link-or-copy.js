'use strict';
/**
 * Hardlink-restore cho file media lớn (học từ TDTStudio export_plate_cache.py):
 * thay fs.copyFileSync bằng fs.linkSync khi có thể — cùng ổ đĩa thì hardlink gần
 * như 0 I/O ghi và 0 dung lượng thêm (2 tên cùng chỉ vào 1 inode).
 *
 * Ứng dụng thực tế trong repo: `editor-pro/ipc-remotion-render.js` → stageLocalAssets()
 * chép asset video/ảnh cục bộ vào nova-remotion/bundle/assets trước MỖI lần render.
 * (SceneCache của video-agent chỉ cache METADATA, không cache file media — nên pattern
 * "plate cache restore" của TDTStudio không có chỗ gắn khác.)
 *
 * An toàn với luồng hiện có:
 * - cleanupStaged() chỉ fs.unlinkSync file trong bundle/assets → chỉ bỏ LINK, inode
 *   (file gốc của người dùng) nguyên vẹn. Giữ link càng an toàn hơn copy.
 * - Fallback copy khi fs.linkSync thất bại (khác ổ đĩa EXDEV, FS không hỗ trợ EPERM,
 *   quá nhiều link EMLINK…) — đây là DEGRADE CÓ KHAI BÁO (trả mã 'copy:<code>'),
 *   không phải fallback ngầm kiểu Luật 10 cấm: copy là hành vi đúng và cũ.
 * - copy lỗi thật sự → NÉM (caller đã có catch + comment riêng).
 */
const fs = require('fs');

/**
 * @param {string} src  file nguồn (asset gốc)
 * @param {string} dest file đích trong bundle
 * @param {{linkFn?: Function}} [di] inject fs.linkSync cho test
 * @returns {string} 'link' | 'copy:<mã lỗi link>'
 */
function hardlinkOrCopy(src, dest, di) {
  const linkFn = (di && di.linkFn) || fs.linkSync.bind(fs);
  try {
    linkFn(src, dest);
    return 'link';
  } catch (err) {
    const code = (err && err.code) || 'UNKNOWN';
    fs.copyFileSync(src, dest);
    return 'copy:' + code;
  }
}

module.exports = { hardlinkOrCopy };
