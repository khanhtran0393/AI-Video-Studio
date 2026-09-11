'use strict';
/**
 * Shared filesystem helpers (path and writeability helpers).
 */
const fs = require('fs');
const path = require('path');

const NOVA_ROOT = path.join(__dirname, '..', '..'); // Nova root (directory containing this file's parent: nova/)

// Base Nova folder used for dev fallback.
function novaRoot() {
  return NOVA_ROOT;
}

/**
 * app.asar version path is virtual; to access packaged unpacked files we need the
 * real path in app.asar.unpacked/nova.
 */
function unpackedNovaRoot() {
  if (!NOVA_ROOT.includes('app.asar')) return NOVA_ROOT;
  const marker = `${path.sep}app.asar`;
  const i = NOVA_ROOT.lastIndexOf(marker);
  if (i >= 0) {
    return path.join(NOVA_ROOT.slice(0, i), 'app.asar.unpacked', 'nova');
  }
  return NOVA_ROOT.replace('app.asar', 'app.asar.unpacked');
}

// Test whether we can create/write/delete a marker file in a folder.
function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const marker = path.join(dir, '.can-write-test');
    fs.writeFileSync(marker, 'ok');
    fs.unlinkSync(marker);
    return true;
  } catch {
    return false;
  }
}

// ── purgeDir (P3 roadmap, học từ VEO3 output purge): dọn output CŨ theo tuổi /
// tổng dung lượng. Chỉ xoá file (recursive), không xoá thư mục gốc; không ném —
// trả thống kê. Caller quyết định gọi khi nào (janitor startup — opt-in).
function purgeDir(root, { maxAgeSeconds, maxTotalBytes } = {}) {
  const stats = { removed: 0, bytesFreed: 0, remainingFiles: 0 };
  if (!root) return stats;
  let files = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) {
        try { const st = fs.statSync(p); files.push({ p, mtimeMs: st.mtimeMs, size: st.size }); }
        catch { /* file biến mất giữa chừng — bỏ qua */ }
      }
    }
  })(root);
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);   // cũ trước
  const now = Date.now();
  const del = (f) => { try { fs.rmSync(f.p, { force: true }); stats.removed++; stats.bytesFreed += f.size; } catch { /* giữ, không ném */ } };
  if (maxAgeSeconds > 0) {
    const cutoff = now - maxAgeSeconds * 1000;
    files = files.filter((f) => { if (f.mtimeMs < cutoff) { del(f); return false; } return true; });
  }
  if (maxTotalBytes > 0) {
    let total = files.reduce((a, f) => a + f.size, 0);
    for (const f of files) {   // đã sort cũ → mới: xoá cũ đến khi đủ
      if (total <= maxTotalBytes) break;
      del(f); total -= f.size;
    }
  }
  (function count(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) count(p);
      else if (ent.isFile()) stats.remainingFiles++;
    }
  })(root);
  return stats;
}

module.exports = { novaRoot, unpackedNovaRoot, canWriteDir, purgeDir };

