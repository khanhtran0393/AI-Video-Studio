'use strict';
// §7 Asset Intelligence Layer (Phase 1: manifest + metadata + semantic tags + characterId mapping).
// §8-9 (rembg/SAM/character identity) là hook analyzeAsset cho Phase 3 — không duplicate engine.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHAR_HINT = /(char|nhan[-_ ]?vat|nhân[-_ ]?vật|portrait)/i;
const BG_HINT = /(bg|background|nền|nen|backdrop)/i;

function fileHash(p) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16); } catch (_) { return 'nohash'; }
}

// Đọc kích thước PNG/JPEG không cần thư viện ngoài (IHDR / SOF marker).
function imageSize(p) {
  try {
    const buf = fs.readFileSync(p);
    if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch (_) {}
  return { width: null, height: null };
}

function tokensOf(relPath) {
  return path.basename(relPath).replace(/\.[^.]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^a-zA-ZÀ-ỹ0-9]+/)
    .map(t => t.toLowerCase()).filter(t => t && !/^(scene|img|image|anh|frame|final|copy)$/i.test(t));
}

function classify(relPath, config) {
  // Mapping tường minh trong config.assetTypes thắng heuristic tên file.
  const key = path.basename(relPath).toLowerCase();
  for (const [type, re] of Object.entries(config.assetTypes || {})) {
    try { if (new RegExp(re, 'i').test(key)) return String(type); } catch (_) {}
  }
  if (CHAR_HINT.test(key)) return 'character';
  if (BG_HINT.test(key)) return 'background';
  return 'scene';
}

function characterIdFor(relPath, config, index) {
  const key = path.basename(relPath).replace(/\.[^.]+$/, '');
  for (const c of config.characters || []) {
    if (c.id && (key.toLowerCase().includes(String(c.name || c.id).toLowerCase()) || key.toLowerCase().includes(String(c.id).toLowerCase()))) return String(c.id);
  }
  return 'CHAR_' + String(index + 1).padStart(3, '0');
}

async function buildAssetManifest(project, options = {}) {
  const { files, config } = project;
  const entries = [];
  let ci = 0;
  for (const img of files.images || []) {
    const rel = path.relative(project.root, img).replace(/\\/g, '/');
    const type = classify(rel, config);
    const size = imageSize(img);
    let entry = {
      assetId: 'img_' + String(entries.length + 1).padStart(3, '0'),
      source: img, relPath: rel, type,
      tags: tokensOf(rel),
      characterId: type === 'character' ? characterIdFor(rel, config, ci++) : null,
      width: size.width, height: size.height,
      hash: fileHash(img),
      confidence: 0.6, // Phase 1 heuristic; Phase 3 (vision) nâng lên.
      status: 'ready',
      subjects: [], background: null,  // Phase 3 segmentation điền vào đây (§7)
    };
    if (typeof options.analyzeAsset === 'function') {
      try { entry = Object.assign(entry, await options.analyzeAsset(entry, { config })); } catch (_) {}
    }
    entries.push(entry);
  }
  for (const m of files.music || []) entries.push({ assetId: 'aud_' + String(entries.length + 1).padStart(3, '0'),
    source: m, relPath: path.relative(project.root, m).replace(/\\/g, '/'), type: 'music', tags: ['music'], status: 'ready' });
  for (const s of files.sfx || []) entries.push({ assetId: 'aud_' + String(entries.length + 1).padStart(3, '0'),
    source: s, relPath: path.relative(project.root, s).replace(/\\/g, '/'), type: 'sfx', tags: ['sfx'], status: 'ready' });
  return { chapterId: project.chapterId, assets: entries };
}

module.exports = { buildAssetManifest, classify, imageSize, tokensOf, fileHash };
