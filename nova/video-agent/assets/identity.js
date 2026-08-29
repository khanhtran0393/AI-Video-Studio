'use strict';
// §9 Character Identity (Phase 3) — nhận diện "cùng một nhân vật" giữa các asset ảnh.
// Thuật toán: dHash (difference hash) 64-bit — decode ảnh về grayscale 9×8 bằng ffmpeg
// (đã có ffmpeg-static trong deps, không thêm thư viện), so Hamming distance để gom nhóm.
// Ảnh giống hệt → distance 0; cùng nhân vật chụp khác tư thế thường < 10; khác ảnh → > 12.
const { spawnSync } = require('child_process');

function resolveFfmpeg(ffmpeg) {
  if (ffmpeg) return ffmpeg;
  try { return require('../../editor-pro/ff-path').FFMPEG; } catch (_) { return 'ffmpeg'; }
}

// Decode ảnh → 9×8 grayscale raw (72 byte) → 64-bit dHash dạng hex.
// Trả null nếu ffmpeg lỗi (ảnh hỏng, không phải ảnh...) — caller tự degrade.
function dHash(filePath, ffmpeg) {
  const bin = resolveFfmpeg(ffmpeg);
  const r = spawnSync(bin, ['-i', filePath, '-vf', 'scale=9:8', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 20, windowsHide: true });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 72) return null;
  const px = r.stdout;
  const bits = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      bits.push(px[row * 9 + col] > px[row * 9 + col + 1] ? 1 : 0); // gradient ngang
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  return hex;
}

function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// Registry nhân vật: gom asset type=character theo (1) mapping tên trong config.characters
// (tường minh, tin cậy nhất), (2) dHash gần nhau (distance <= threshold).
function buildCharacterRegistry(manifest, { config = {}, threshold = 10 } = {}) {
  const chars = (config.characters || []).filter(Boolean);
  const groups = []; // { characterId, name, assetIds, hash }
  const assets = (manifest.assets || []).filter(a => a.type === 'character');

  const byName = (a) => {
    const base = String(a.relPath || '').split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    for (const c of chars) {
      const n = String(c.name || '').toLowerCase(), id = String(c.id || '').toLowerCase();
      if ((n && base.includes(n)) || (id && base.includes(id))) return c.id || n;
    }
    return null;
  };

  for (const a of assets) {
    const named = byName(a);
    const hash = a.identityHash || null;
    let g = null;
    if (named) g = groups.find(x => x.characterId === named);
    if (!g && hash) g = groups.find(x => x.hash && hamming(x.hash, hash) <= threshold);
    if (!g) {
      g = { characterId: named || ('CHAR_' + String(groups.length + 1).padStart(3, '0')),
        name: named || null, assetIds: [], hash };
      groups.push(g);
    }
    g.assetIds.push(a.assetId);
    if (hash && !g.hash) g.hash = hash;
  }
  const idOf = {}; groups.forEach(g => g.assetIds.forEach(id => { idOf[id] = g.characterId; }));
  return { registry: groups, idOf, threshold };
}

// analyzeAsset-compatible: đính identityHash vào entry (Phase 3 hook §7).
function createIdentityAnalyzer({ ffmpeg } = {}) {
  return async function analyzeAsset(entry) {
    if (entry.type !== 'character' && entry.type !== 'scene') return {};
    const hash = dHash(entry.source, ffmpeg);
    return hash ? { identityHash: hash } : {};
  };
}

module.exports = { dHash, hamming, buildCharacterRegistry, createIdentityAnalyzer };
