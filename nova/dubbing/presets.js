'use strict';
/* ============================================================
   DUBBING PRESETS — lưu/nạp cấu hình Lồng Tiếng (main process,
   thuần Node — KHÔNG electron, dir truyền vào để test được)
   ------------------------------------------------------------
   Preset = tên + bộ cấu hình form Lồng Tiếng (giọng, ngôn ngữ,
   dịch, nhạc nền, nhân vật…). Lưu JSON trong <userData>/dub-
   presets/dub-presets.json — ghi nguyên tử (.tmp + rename).
   CHỈ nhận trường trong whitelist PRESET_KEYS — JSON lạ từ ngoài
   không vào được. File hỏng → lỗi lộ liễu DUB_PRESET_CORRUPT
   (KHÔNG tự xoá/reset ngầm — Luật 10).
   ============================================================ */
const fs = require('fs');
const path = require('path');

const PRESET_FILE = 'dub-presets.json';
const MAX_NAME = 60;
const MAX_PRESETS = 100;

/* Trường cấu hình được lưu — khớp payload dub:render trên panel. */
const PRESET_KEYS = [
  'voicePid', 'voiceName', 'language', 'translateTo',
  'maxSpeed', 'mixMode', 'origVolume',
  'speakerMode', 'speakerVoices',
  'musicPath', 'musicVolume', 'duck',
];

function errCode(code, msg) { const e = new Error(code + ': ' + msg); e.code = code; return e; }

function sanitizeName(name) {
  const s = String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
  if (!s) throw errCode('DUB_PRESET_NAME', 'Tên preset không được để trống.');
  if (s.length > MAX_NAME) throw errCode('DUB_PRESET_NAME', 'Tên preset tối đa ' + MAX_NAME + ' ký tự.');
  return s;
}

/* Chỉ lấy trường whitelist, ép kiểu đúng — JSON lạ từ payload bị bỏ. */
function pickConfig(config) {
  const src = (config && typeof config === 'object' && !Array.isArray(config)) ? config : {};
  const out = {};
  for (const k of PRESET_KEYS) {
    const v = src[k];
    if (v === undefined || v === null) continue;
    if (k === 'maxSpeed' || k === 'origVolume' || k === 'musicVolume') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
      continue;
    }
    if (k === 'speakerMode' || k === 'duck') { out[k] = !!v; continue; }
    if (k === 'speakerVoices') {
      if (Array.isArray(v)) out[k] = v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8);
      continue;
    }
    out[k] = String(v);
  }
  return out;
}

function readFileSafe(dir) {
  const file = path.join(dir, PRESET_FILE);
  if (!fs.existsSync(file)) return []; // chưa có file = trạng thái rỗng hợp lệ
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw errCode('DUB_PRESET_CORRUPT', 'File preset hỏng không đọc được — ' + file + ' (' + e.message + ').'); }
  return Array.isArray(j) ? j.filter((x) => x && typeof x === 'object' && x.name) : [];
}

function writeFile(dir, list) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, PRESET_FILE);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function listPresets(dir) { return readFileSafe(dir); }

/* Lưu (upsert theo tên — đè đúng tên là có chủ đích). Trả danh sách mới. */
function savePreset(dir, name, config) {
  const n = sanitizeName(name);
  const cfg = pickConfig(config);
  const list = readFileSafe(dir);
  const entry = { name: n, savedAt: new Date().toISOString(), config: cfg };
  const idx = list.findIndex((x) => x.name === n);
  if (idx >= 0) list[idx] = entry;
  else {
    if (list.length >= MAX_PRESETS) throw errCode('DUB_PRESET_FULL', 'Tối đa ' + MAX_PRESETS + ' preset — xoá bớt trước khi lưu.');
    list.push(entry);
  }
  writeFile(dir, list);
  return list;
}

/* Xoá preset theo tên — không có → lỗi lộ liễu DUB_PRESET_MISSING. */
function deletePreset(dir, name) {
  const n = sanitizeName(name);
  const list = readFileSafe(dir);
  const next = list.filter((x) => x.name !== n);
  if (next.length === list.length) throw errCode('DUB_PRESET_MISSING', 'Không có preset tên: ' + n);
  writeFile(dir, next);
  return next;
}

module.exports = { PRESET_KEYS, listPresets, savePreset, deletePreset };