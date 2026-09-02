/* ── flow-cft/cookies — đọc + giải mã cookie (SQLite + Keychain Mac / DPAPI Win). Tách từ flow-cft.plain.js. ── */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { LOG, existing } = require('./shared');

function cookiesDbPath(profileDir) {
  const cands = [
    path.join(profileDir, 'Default', 'Network', 'Cookies'),
    path.join(profileDir, 'Default', 'Cookies'),
  ];
  for (const p of cands) { if (existing(p)) return p; }
  return null;
}

// sqlite3: Mac/Linux dùng CLI hệ thống; Windows dùng bản đóng gói kèm app (sqlite-bin/sqlite3.exe).
function sqliteBin() {
  if (process.platform !== 'win32') return 'sqlite3';
  const real = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
  const p = path.join(real, 'sqlite-bin', 'sqlite3.exe');
  return existing(p) ? p : 'sqlite3.exe';
}

// Chép DB (kèm -wal/-shm) ra temp rồi truy vấn bằng sqlite3 CLI (tránh khoá của Chrome đang chạy).
function sqliteQuery(dbPath, sql) {
  const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckq-'));
  try {
    for (const suf of ['', '-wal', '-shm']) {
      try { fs.copyFileSync(dbPath + suf, path.join(tdir, 'Cookies' + suf)); } catch {}
    }
    const out = execFileSync(sqliteBin(), ['-readonly', '-separator', '\x1f', '-newline', '\x1e', path.join(tdir, 'Cookies'), sql], { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
    return out;
  } finally {
    try { fs.rmSync(tdir, { recursive: true, force: true }); } catch {}
  }
}

// Có cookie phiên Google chưa? (đã đăng nhập xong)
function hasLoginCookie(dbPath) {
  try {
    const out = sqliteQuery(dbPath, "SELECT name FROM cookies WHERE host_key LIKE '%google.com' AND name IN ('__Secure-1PSID','SID');");
    const names = out.split('\x1e').map((r) => r.trim()).filter(Boolean);
    return names.includes('__Secure-1PSID') || names.includes('SID');
  } catch { return false; }
}

// Lấy mật khẩu "Safe Storage" từ Keychain (Mac) để tạo khoá giải mã.
function macSafeStoragePassword(binPath) {
  let service = 'Chrome Safe Storage', account = 'Chrome';
  if (/Chromium/.test(binPath)) { service = 'Chromium Safe Storage'; account = 'Chromium'; }
  else if (/Microsoft Edge|msedge/.test(binPath)) { service = 'Microsoft Edge Safe Storage'; account = 'Microsoft Edge'; }
  else if (/for Testing/.test(binPath)) { service = 'Chromium Safe Storage'; account = 'Chromium'; }
  for (const args of [['-w', '-s', service, '-a', account], ['-w', '-s', service]]) {
    try {
      const out = execFileSync('security', ['find-generic-password', ...args], { encoding: 'utf8' }).trim();
      if (out) { LOG('lấy được khóa Keychain từ:', service); return out; }
    } catch (e) { LOG('Keychain "' + service + '" chưa lấy được:', e && e.message); }
  }
  LOG('KHÔNG lấy được khóa Keychain → dùng mặc định (giải mã có thể rỗng)');
  return 'peanuts';   // Chromium không có Keychain → khoá mặc định
}

function macKey(binPath) {
  const pw = macSafeStoragePassword(binPath);
  return crypto.pbkdf2Sync(pw, 'saltysalt', 1003, 16, 'sha1');
}

// Giải mã 1 giá trị cookie (Mac v10). Trả về chuỗi value.
function decryptMac(encHex, key, hostKey) {
  const buf = Buffer.from(encHex, 'hex');
  if (!buf.length) return '';
  const prefix = buf.slice(0, 3).toString('latin1');
  if (prefix !== 'v10' && prefix !== 'v11') return buf.toString('utf8');   // chưa mã hoá
  try {
    const iv = Buffer.alloc(16, ' ');
    const dec = crypto.createDecipheriv('aes-128-cbc', key, iv);
    dec.setAutoPadding(false);
    let out = Buffer.concat([dec.update(buf.slice(3)), dec.final()]);
    const pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) out = out.slice(0, out.length - pad);   // bỏ PKCS7
    // Chrome v130+ chèn 32 byte SHA256(host_key) trước value → cắt bỏ nếu có.
    if (out.length >= 32) {
      const h = crypto.createHash('sha256').update(hostKey).digest();
      if (out.slice(0, 32).equals(h)) out = out.slice(32);
    }
    return out.toString('utf8');
  } catch { return ''; }
}

// ── Windows: khoá AES-256-GCM nằm trong "Local State", bọc bằng DPAPI (theo tài khoản Windows). ──
// Gọi DPAPI qua PowerShell (không cần native module) — truyền base64 qua biến môi trường cho gọn/an toàn.
function winDpapiUnprotect(buf) {
  const ps = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:CKM_DPAPI); $k=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'); [Convert]::ToBase64String($k)`;
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', env: { ...process.env, CKM_DPAPI: buf.toString('base64') } }).trim();
  return Buffer.from(out, 'base64');
}
// Đọc + giải bọc khoá 32 byte từ Local State của profile.
function winKey(profileDir) {
  const ls = JSON.parse(fs.readFileSync(path.join(profileDir, 'Local State'), 'utf8'));
  const enc = ls && ls.os_crypt && ls.os_crypt.encrypted_key;
  if (!enc) throw new Error('NO_ENCRYPTED_KEY');
  let raw = Buffer.from(enc, 'base64');
  if (raw.slice(0, 5).toString('latin1') === 'DPAPI') raw = raw.slice(5);   // bỏ tiền tố "DPAPI"
  const key = winDpapiUnprotect(raw);
  if (!key || key.length !== 32) throw new Error('BAD_WIN_KEY_LEN_' + (key && key.length));
  return key;
}
// Giải mã 1 giá trị cookie Windows (v10/v11 = AES-256-GCM: 'v10' + nonce(12) + ciphertext + tag(16)).
function decryptWin(encHex, key, hostKey) {
  const buf = Buffer.from(encHex, 'hex');
  if (!buf.length) return '';
  const prefix = buf.slice(0, 3).toString('latin1');
  if (prefix === 'v10' || prefix === 'v11') {
    try {
      const nonce = buf.slice(3, 15);
      const tag = buf.slice(buf.length - 16);
      const ct = buf.slice(15, buf.length - 16);
      const dec = crypto.createDecipheriv('aes-256-gcm', key, nonce);
      dec.setAuthTag(tag);
      let out = Buffer.concat([dec.update(ct), dec.final()]);
      // Chrome v130+ chèn 32 byte SHA256(host_key) trước value → cắt bỏ nếu có.
      if (out.length >= 32) { const h = crypto.createHash('sha256').update(hostKey).digest(); if (out.slice(0, 32).equals(h)) out = out.slice(32); }
      return out.toString('utf8');
    } catch { return ''; }
  }
  // Cookie cũ (không tiền tố v10) → DPAPI trực tiếp cả blob.
  try { return winDpapiUnprotect(buf).toString('utf8'); } catch { return ''; }
}

function ssName(v) {
  const n = parseInt(v);
  if (n === 0) return 'no_restriction';
  if (n === 1) return 'lax';
  if (n === 2) return 'strict';
  return 'unspecified';
}

// Đọc toàn bộ cookie Google + giải mã → mảng cho addAccountByCookie.
function harvestCookies(dbPath, binPath, profileDir) {
  const sql = "SELECT host_key,name,path,is_secure,is_httponly,expires_utc,samesite,hex(encrypted_value) FROM cookies WHERE host_key LIKE '%google.com' OR host_key LIKE '%labs.google' OR host_key LIKE '%googleusercontent.com';";
  const raw = sqliteQuery(dbPath, sql);
  const isWin = process.platform === 'win32';
  const key = process.platform === 'darwin' ? macKey(binPath) : (isWin ? winKey(profileDir) : null);
  const rows = raw.split('\x1e').map((r) => r.replace(/\n$/, '')).filter((r) => r.length);
  LOG('đọc được', rows.length, 'dòng cookie Google từ DB');
  const out = [];
  for (const line of rows) {
    const f = line.split('\x1f');
    if (f.length < 8) continue;
    const [host, name, cpath, isSecure, isHttp, expUtc, samesite, encHex] = f;
    if (!name) continue;
    let value = '';
    if (key) value = isWin ? decryptWin(encHex, key, host) : decryptMac(encHex, key, host);
    if (value === '' && name !== 'OTZ') { /* giữ cookie rỗng cũng không hại, nhưng bỏ để gọn */ }
    const expSec = (Number(expUtc) > 0) ? Math.round(Number(expUtc) / 1e6 - 11644473600) : undefined;
    out.push({
      name, value,
      domain: host,
      path: cpath || '/',
      secure: isSecure === '1',
      httpOnly: isHttp === '1',
      expirationDate: expSec,
      sameSite: ssName(samesite),
    });
  }
  return out;
}
module.exports = { cookiesDbPath, hasLoginCookie, harvestCookies };
