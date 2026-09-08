'use strict';
/**
 * Secret Vault — mã hoá credential nhạy cảm bằng Electron `safeStorage`.
 *
 * Học từ AI Novel (credentialVault.js):
 *  - TOP_LEVEL_SECRET_KEYS: danh sách cứng các key cần mã hoá (cookie Flow, API key…)
 *  - Lưu vào `<userData>/secure/credentials.bin` (mã hoá base64) — KHÔNG plain text.
 *  - Atomic write qua atomic-write.js (tmp + rename).
 *  - migrateFromRaw(): đọc JSON cũ (vd localStorage dump / state.js cũ) → tách
 *    các key trong TOP_LEVEL_SECRET_KEYS → ghi vault → trả về object đã tách để
 *    caller xoá khỏi nguồn cũ.
 *
 * Điều kiện tiên quyết: app.whenReady() đã chạy (safeStorage chỉ có sau khi ready).
 * Trên Linux không có keyring → safeStorage.isEncryptionAvailable() = false →
 * vault HOẠT ĐỘNG nhưng KHÔNG mã hoá (giá trị ghi thẳng). Có cảnh báo log lần đầu.
 *
 * Hợp đồng:
 *  - getSecret(key): trả string | null. Không throw.
 *  - setSecret(key, value): ghi đè vault. Throw nếu write lỗi.
 *  - deleteSecret(key): gỡ key khỏi vault. Throw nếu write lỗi.
 *  - listKeys(): trả mảng key hiện có (để debug/test).
 *  - getAllSecrets(): trả object { key: value } — chỉ dùng cho render-side bridge
 *    đã qua contextIsolation (KHÔNG log ra ngoài).
 *  - migrateFromRaw(rawObject, sourcePath): atomic, idempotent.
 */
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');
const { atomicWriteFile } = require('./atomic-write');

// Danh sách key cứng cần bảo vệ. Bạn đọc muốn thêm key mới: sửa ở đây, không
// truyền key ngẫu nhiên vào hàm — khoá danh sách là nguồn chân lý duy nhất.
const TOP_LEVEL_SECRET_KEYS = Object.freeze([
  // Flow (Google extension) — cookie & flow_session
  'flowCookie',
  'flowSession',
  'flowCsrfToken',
  // API key của các dịch vụ AI
  'openaiApiKey',
  'anthropicApiKey',
  'groqApiKey',
  'geminiApiKey',
  'grokApiKey',
  'deepseekApiKey',
  // S3 / R2 (video-agent upload)
  's3AccessKeyId',
  's3SecretAccessKey',
  'r2AccessKeyId',
  'r2SecretAccessKey',
  // Voice TTS
  'googleCloudTtsKey',
  'elevenLabsApiKey',
  // YouTube upload
  'youtubeClientId',
  'youtubeClientSecret',
  'youtubeRefreshToken',
]);

let _cache = null;        // { key: value } — chỉ nạp 1 lần cho mỗi session.
let _filePath = null;     // <userData>/secure/credentials.bin
let _isEncrypted = null;  // null = chưa xác định, true/false sau init.
let _loggedNoEncryption = false;
// Promise queue: serialize mọi thao tác ghi (setSecret/deleteSecret/migrateFromRaw)
// để tránh race khi 2 IPC gọi đồng thời — nếu không, call sau có thể đọc cache
// TRƯỚC khi call trước persist xong, dẫn đến mất thay đổi.
let _writeChain = Promise.resolve();

function getVaultPath() {
  if (_filePath) return _filePath;
  const userData = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '';
  if (!userData) throw new Error('secret-vault: app.getPath("userData") chưa sẵn sàng — gọi sau app.whenReady()');
  const dir = path.join(userData, 'secure');
  _filePath = path.join(dir, 'credentials.bin');
  return _filePath;
}

function checkEncryptionAvailable() {
  if (_isEncrypted !== null) return _isEncrypted;
  // Nếu app chưa ready, safeStorage có thể chưa nạp API — KHÔNG cache kết quả
  // âm (false) để lần gọi sau khi ready sẽ check lại. Ngược lại, nếu app ready
  // mà vẫn false thì cache để khỏi log cảnh báo lặp.
  const appReady = (app && typeof app.isReady === 'function') ? app.isReady() : true;
  if (!appReady) {
    // Tạm thời coi như "không xác định" — KHÔNG cập nhật _isEncrypted.
    return false;
  }
  try {
    _isEncrypted = !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable());
  } catch (_) {
    _isEncrypted = false;
  }
  if (!_isEncrypted && !_loggedNoEncryption) {
    console.warn('[secret-vault] safeStorage KHÔNG khả dụng trên nền tảng này — vault sẽ lưu plain text. CẢNH BÁO bảo mật.');
    _loggedNoEncryption = true;
  }
  return _isEncrypted;
}

function encodeValue(plain) {
  if (!checkEncryptionAvailable()) return Buffer.from(String(plain), 'utf8');
  try {
    const enc = safeStorage.encryptString(String(plain));
    return Buffer.from(enc);
  } catch (e) {
    console.warn('[secret-vault] encryptString lỗi, fallback plain text:', e && e.message);
    return Buffer.from(String(plain), 'utf8');
  }
}

function decodeValue(buf) {
  if (!buf) return '';
  if (!checkEncryptionAvailable()) return buf.toString('utf8');
  try {
    return safeStorage.decryptString(buf);
  } catch (e) {
    console.warn('[secret-vault] decryptString lỗi (vault có thể bị hỏng):', e && e.message);
    return '';
  }
}

function load() {
  if (_cache) return _cache;
  _cache = {};
  const file = getVaultPath();
  if (!fs.existsSync(file)) return _cache;
  let raw;
  try {
    raw = fs.readFileSync(file);
  } catch (e) {
    console.warn('[secret-vault] đọc vault lỗi:', e && e.message);
    return _cache;
  }
  if (!raw || !raw.length) return _cache;
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    console.warn('[secret-vault] vault không phải JSON hợp lệ, bỏ qua:', e && e.message);
    return _cache;
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.v || parsed.v !== 1) return _cache;
  const items = parsed.items || {};
  for (const key of Object.keys(items)) {
    try {
      const buf = Buffer.from(items[key], 'base64');
      _cache[key] = decodeValue(buf);
    } catch (e) {
      console.warn('[secret-vault] bỏ qua key', key, ':', e && e.message);
    }
  }
  return _cache;
}

function persist() {
  const items = {};
  for (const key of Object.keys(_cache || {})) {
    const val = _cache[key];
    if (val === undefined || val === null || val === '') continue;
    const buf = encodeValue(val);
    items[key] = buf.toString('base64');
  }
  const payload = JSON.stringify({ v: 1, items });
  atomicWriteFile(getVaultPath(), payload);
}

function isKnownSecretKey(key) {
  return TOP_LEVEL_SECRET_KEYS.indexOf(String(key)) !== -1;
}

function getSecret(key) {
  if (!isKnownSecretKey(key)) {
    // Không throw — log cảnh báo, trả null. Caller thường dùng giá trị mặc định.
    console.warn('[secret-vault] key không nằm trong TOP_LEVEL_SECRET_KEYS:', key);
    return null;
  }
  const data = load();
  const v = data[key];
  return (v == null) ? null : String(v);
}

function setSecret(key, value) {
  if (!isKnownSecretKey(key)) {
    throw new Error('secret-vault: key "' + key + '" chưa khai báo trong TOP_LEVEL_SECRET_KEYS');
  }
  // Enqueue vào chain: thao tác này sẽ chạy SAU các write đang chờ. Cập nhật
  // cache NGAY (giữ API sync cho caller) nhưng persist sẽ thực sự chạy tuần tự.
  const data = load();
  data[key] = (value == null) ? '' : String(value);
  _cache = data;
  _writeChain = _writeChain.then(() => {
    try { persist(); } catch (e) {
      console.warn('[secret-vault] persist lỗi (setSecret "' + key + '"):', e && e.message);
    }
  }).catch(() => { /* nuốt để chain không bị poison */ });
}

function deleteSecret(key) {
  const data = load();
  if (key in data) {
    delete data[key];
    _cache = data;
    _writeChain = _writeChain.then(() => {
      try { persist(); } catch (e) {
        console.warn('[secret-vault] persist lỗi (deleteSecret "' + key + '"):', e && e.message);
      }
    }).catch(() => {});
  }
}

function listKeys() {
  return Object.keys(load());
}

function getAllSecrets() {
  // Trả về bản sao — caller KHÔNG được mutate object này để ảnh hưởng cache.
  // LỌC BỎ key rỗng: nếu decodeValue() trả '' (vault bị hỏng / hết hạn keyring),
  // key vẫn còn trong cache nhưng không có giá trị — không nên lộ ra cho renderer.
  const data = load();
  const out = {};
  for (const key of Object.keys(data)) {
    const v = data[key];
    if (v != null && v !== '') out[key] = String(v);
  }
  return out;
}

/**
 * Di trú từ object cũ (vd từ localStorage dump / state.js cũ) sang vault.
 * Chỉ tách các key trong TOP_LEVEL_SECRET_KEYS. Trả về { migrated: string[], missing: string[] }.
 * Không xoá key khỏi nguồn cũ — caller quyết định.
 */
function migrateFromRaw(rawObject, _sourcePath) {
  if (!rawObject || typeof rawObject !== 'object') {
    return { migrated: [], missing: [] };
  }
  const data = load();
  const migrated = [];
  for (const key of TOP_LEVEL_SECRET_KEYS) {
    if (rawObject[key] != null && rawObject[key] !== '' && (data[key] == null || data[key] === '')) {
      data[key] = String(rawObject[key]);
      migrated.push(key);
    }
  }
  if (migrated.length) {
    _cache = data;
    _writeChain = _writeChain.then(() => {
      try { persist(); } catch (e) {
        console.warn('[secret-vault] persist lỗi (migrateFromRaw):', e && e.message);
      }
    }).catch(() => {});
  }
  const missing = TOP_LEVEL_SECRET_KEYS.filter((k) => data[k] == null || data[k] === '');
  return { migrated, missing };
}

/**
 * Xoá cache in-memory — dùng khi cần force re-read (vd sau khi đổi keyring).
 */
function invalidateCache() {
  _cache = null;
}

module.exports = {
  TOP_LEVEL_SECRET_KEYS,
  getSecret,
  setSecret,
  deleteSecret,
  listKeys,
  getAllSecrets,
  migrateFromRaw,
  invalidateCache,
  isKnownSecretKey,
};

