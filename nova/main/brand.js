'use strict';
/**
 * Logo/thương hiệu: chép sẵn tài sản brand vào nova/web để splash & cửa sổ chính dùng.
 */
const path = require('path');
const fs = require('fs');
const { WEB_DIR } = require('./state');

function ensureBrandAsset() {
  const target = path.join(WEB_DIR, 'brand-logo.ico');
  if (fs.existsSync(target)) return target;
  const candidates = [
    path.join(__dirname, '..', 'build', 'logo.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'novastudio.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'novastudio.ico'),
  ];
  for (const source of candidates) {
    try {
      if (source && fs.existsSync(source)) {
        // Nếu là PNG, copy sang target (nhưng target là .ico, nên cần chuyển đổi hoặc dùng trực tiếp)
        // Để đơn giản, nếu source là PNG thì copy sang brand-logo.png và dùng luôn.
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
  const candidates = [
    path.join(WEB_DIR, 'brand-logo.png'),
    path.join(WEB_DIR, 'brand-logo.ico'),
    path.join(__dirname, '..', 'build', 'logo.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'novastudio.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'novastudio.ico'),
  ];
  return candidates.find((candidate) => {
    try { return fs.existsSync(candidate); } catch (_) { return false; }
  });
}

module.exports = { ensureBrandAsset, brandIconPath };
