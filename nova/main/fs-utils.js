'use strict';
/**
 * Helper filesystem dùng chung (kiểm quyền ghi thư mục, đường dẫn nova/ gốc & unpacked).
 */
const fs = require('fs');
const path = require('path');

const NOVA_ROOT = path.join(__dirname, '..', '..');   // thư mục nova/

// Thư mục gốc nova/ (dùng cho fallback đường dẫn dev/npm start).
function novaRoot() { return NOVA_ROOT; }

// File nằm trong app.asar.unpacked (asarUnpack) — dùng đường dẫn THẬT để cpSync/opendir đọc/ghi được.
function unpackedNovaRoot() {
  return NOVA_ROOT.includes('app.asar') ? NOVA_ROOT.replace('app.asar', 'app.asar.unpacked') : NOVA_ROOT;
}

// Thử ghi vào thư mục để biết có cài được "trong app" không (VD cài ở Program Files thì không ghi được)
function canWriteDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, '.ghi-thu'); fs.writeFileSync(t, 'ok'); fs.unlinkSync(t); return true; }
  catch { return false; }
}

module.exports = { novaRoot, unpackedNovaRoot, canWriteDir };

