'use strict';
/**
 * Logo/thương hiệu: chép sẵn tài sản brand vào nova/web để splash & cửa sổ chính dùng.
 */
const path = require('path');
const fs = require('fs');
const { WEB_DIR } = require('./state');

function ensureBrandAsset() {
  // ƯU TIÊN .ICO VUÔNG (build/icon.ico) — ảnh banner 2048x768 KHÔNG dùng được làm
  // icon cửa sổ/taskbar trên Windows (phải là ảnh vuông). Banner PNG chỉ là
  // phương án cuối cùng cho splash/favicon.
  const target = path.join(WEB_DIR, 'brand-logo.ico');
  if (fs.existsSync(target)) return target;   // đã có — không copy lại mỗi lần khởi động
  const candidates = [
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),        // build/ GỐC repo — icon vuông multi-size
    path.join(__dirname, '..', '..', 'build', 'icon-square.png'), // 256x256 vuông
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon-square.png'),
    path.join(__dirname, '..', 'build', 'logo.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'novastudio.ico'),     // bản đóng gói (extraResources)
  ];
  for (const source of candidates) {
    try {
      if (source && fs.existsSync(source)) {
        // PNG vuông (icon-square.png) không dùng được trực tiếp làm .ico của web →
        // copy sang brand-logo.png (đúng kiểu file); .ico thì copy sang brand-logo.ico.
        if (source.endsWith('.png')) {
          const pngTarget = path.join(WEB_DIR, 'brand-logo.png');
          fs.copyFileSync(source, pngTarget);
          return pngTarget;
        } else {
          fs.copyFileSync(source, target);
          return target;
        }
      }
    } catch (_) { /* try the next packaged/source fallback */ }
  }
  return null;
}

function brandIconPath() {
  // Thứ tự ưu tiên: .ICO VUÔNG trước (multi-size chuẩn cho taskbar Windows),
  // sau đó icon-square.png 256x256; banner 2048x768 chỉ là phương án cuối vì
  // ảnh KHÔNG vuông làm taskbar icon bị MẤT (trống).
  const candidates = [
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),        // build/ GỐC repo — icon vuông multi-size
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(WEB_DIR, 'brand-logo.ico'),                          // do ensureBrandAsset() chép
    path.join(process.resourcesPath || '', 'novastudio.ico'),      // bản đóng gói (extraResources)
    path.join(__dirname, '..', '..', 'build', 'icon-square.png'), // 256x256 vuông
    path.join(__dirname, '..', 'build', 'icon-square.png'),
    path.join(WEB_DIR, 'brand-logo.png'),
    path.join(__dirname, '..', 'build', 'logo.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];
  return candidates.find((candidate) => {
    try { return fs.existsSync(candidate); } catch (_) { return false; }
  });
}

module.exports = { ensureBrandAsset, brandIconPath };
