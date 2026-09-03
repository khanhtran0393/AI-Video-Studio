'use strict';
/**
 * Bảo vệ ổ đĩa cho các thao tác ghi nặng (render MP4…):
 * - freeBytes(dir): dung lượng trống của ổ chứa dir (fs.statfsSync, Node ≥ 18.15).
 * - estimateRenderBytes(payload, imgs): ước lượng tổng byte CẦN GHI (file tạm input
 *   + MP4 output + đệm an toàn) — kiểm tra TRƯỚC khi chạm xuống đĩa.
 * - ensureFreeBytes(dir, required): { ok, freeBytes, requiredBytes }.
 * - pruneDirectoryOlder(root, days): xoá các thư mục job cũ hơn N ngày (chỉ gọi
 *   tường minh qua IPC disk-guard:prune-artifacts — KHÔNG tự xoá sản phẩm của user).
 */
const fs = require('fs');
const path = require('path');

function freeBytes(dir) {
  try {
    if (typeof fs.statfsSync !== 'function') return null;   // Node quá cũ → không chặn
    const st = fs.statfsSync(dir);
    const free = Number(st.bavail) * Number(st.bsize);
    return Number.isFinite(free) && free >= 0 ? free : null;
  } catch (_) { return null; }
}

// Ước lượng tổng byte sẽ ghi xuống đĩa cho 1 lần renderVideo.
function estimateRenderBytes(payload, imgs) {
  const list = Array.isArray(imgs) ? imgs : [];
  let inputBytes = 0;
  for (const im of list) {
    const s = im && im.dataUrl ? String(im.dataUrl) : '';
    if (s) inputBytes += Math.floor(s.length * 0.75);   // base64 → binary ~ 3/4
  }
  const defaultDur = Math.max(0.3, Number(payload && payload.defaultDur) || 4);
  let dur = 0;
  for (const im of list) dur += Math.max(0.3, Number(im && im.dur) || defaultDur);
  // Video ~8 Mbps mặc định (CRF) + audio 192 kbps; bit tùy chọn của user thì dùng nó.
  const bitrateBps = (payload && payload.videoBitrateK)
    ? Math.max(200, Math.round(Number(payload.videoBitrateK))) * 1000
    : 8_000_000;
  const outputBytes = ((bitrateBps + 192_000) / 8) * dur;
  const safety = 64 * 1024 * 1024;   // đệm cho filter graph + rơi về CPU encode
  return Math.round(inputBytes + outputBytes + safety);
}

function ensureFreeBytes(dir, requiredBytes) {
  const required = Math.max(0, Number(requiredBytes) || 0);
  const free = freeBytes(dir);
  if (free == null) return { ok: true, freeBytes: null, requiredBytes: required, unknown: true };
  return { ok: free > required, freeBytes: free, requiredBytes: required };
}

// Xoá các thư mục con của root cũ hơn `days` ngày (theo mtime). Trả thống kê.
function pruneDirectoryOlder(root, days, now = Date.now()) {
  const base = path.resolve(String(root || ''));
  const d = Math.round(Number(days));
  if (!base || !d || d <= 0) throw new Error('pruneDirectoryOlder: cần root hợp lệ và days > 0');
  const cutoff = now - d * 24 * 60 * 60 * 1000;
  const stats = { root: base, days: d, removed: [], bytes: 0 };
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (e) { stats.error = e.message; return stats; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const p = path.join(base, entry.name);
    let st;
    try { st = fs.statSync(p); } catch (_) { continue; }
    if (st.mtimeMs >= cutoff) continue;
    try {
      const bytes = _dirSize(p);
      fs.rmSync(p, { recursive: true, force: true });
      stats.removed.push(entry.name);
      stats.bytes += bytes;
    } catch (_) {}
  }
  return stats;
}

function _dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory()) walk(p);
        else total += fs.statSync(p).size || 0;
      } catch (_) {}
    }
  };
  walk(dir);
  return total;
}

module.exports = { freeBytes, estimateRenderBytes, ensureFreeBytes, pruneDirectoryOlder };
