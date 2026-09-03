/* ── flow-cft/chrome — tìm/tải Chrome for Testing ghim 149 (không banner). Tách từ flow-cft.plain.js. ── */
const { app } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { existing } = require('./shared');

const cftRoot = () => path.join(app.getPath('userData'), 'cft');
// Bản CfT GHIM cố định — KHÔNG có banner "chỉ dành cho kiểm thử tự động" (bản v150+ mới có banner).
const PINNED_CFT = '149.0.7827.55';
const cftMarker = () => path.join(cftRoot(), 'PINNED_VERSION');
function cftIsPinned() { try { return fs.readFileSync(cftMarker(), 'utf8').trim() === PINNED_CFT; } catch { return false; } }

function cachedCft() {
  try {
    const root = cftRoot();
    if (!fs.existsSync(root)) return null;
    const hits = [];
    (function walk(d, depth) {
      if (depth > 5) return;
      for (const f of fs.readdirSync(d)) {
        const full = path.join(d, f);
        let st; try { st = fs.statSync(full); } catch { continue; }
        if (st.isDirectory()) walk(full, depth + 1);
        else if (f === 'Google Chrome for Testing' || f === 'chrome' || f === 'chrome.exe') hits.push(full);
      }
    })(root, 0);
    return hits[0] || null;
  } catch { return null; }
}
// Chỉ Chrome for Testing (đã tải về hoặc cài sẵn) — icon RIÊNG, không đụng Chrome cá nhân của khách.
function findCft() {
  const c = cachedCft();
  if (c) return c;
  const app = process.platform === 'darwin'
    ? '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    : null;
  if (app && existing(app)) return app;
  return null;
}

function findChrome() {
  const plat = process.platform;
  // Ưu tiên Chrome for Testing (cửa sổ riêng, tắt hẳn không đụng Chrome cá nhân) rồi mới rơi về Chrome thật.
  const cft = findCft();
  if (cft) return cft;
  const cands = plat === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : plat === 'win32' ? [
    (process.env['PROGRAMFILES'] || 'C:\\Program Files') + '\\Google\\Chrome\\Application\\chrome.exe',
    (process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)') + '\\Google\\Chrome\\Application\\chrome.exe',
    (process.env['LOCALAPPDATA'] || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  for (const p of cands) { if (existing(p)) return p; }
  return null;
}

function cftPlatform() {
  const a = process.arch;
  if (process.platform === 'darwin') return a === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (process.platform === 'win32') return a === 'x64' ? 'win64' : 'win32';
  return 'linux64';
}
function httpGetJSON(url) {
  return new Promise((res, rej) => {
    https.get(url, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
function urlOk(url) {
  return new Promise((res) => {
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (r) => { res(r.statusCode >= 200 && r.statusCode < 400); });
    req.on('error', () => res(false)); req.on('timeout', () => { req.destroy(); res(false); });
    req.end();
  });
}
function download(url, dest, onEvent) {
  return new Promise((res, rej) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => https.get(u, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location); }
      if (r.statusCode !== 200) { rej(new Error('HTTP ' + r.statusCode)); return; }
      const total = parseInt(r.headers['content-length'] || '0'); let got = 0;
      r.on('data', (c) => { got += c.length; if (total && onEvent) onEvent({ type: 'download', pct: Math.round(got / total * 100) }); });
      r.pipe(file); file.on('finish', () => file.close(() => res()));
    }).on('error', rej);
    get(url);
  });
}
async function _ensureChrome(onEvent) {
  // Ưu tiên Chrome for Testing thật sự (cửa sổ riêng, tắt hẳn) — tải về nếu máy chưa có.
  const cft = findCft();
  if (cft && cftIsPinned()) return cft;                 // đã là bản ghim 149 (không banner) → dùng luôn
  if (cft && !cftIsPinned()) {                          // bản cũ có banner → gỡ, tải lại bản sạch
    onEvent && onEvent({ type: 'status', msg: 'Đang thay Chrome for Testing bằng bản không có banner…' });
    try { fs.rmSync(cftRoot(), { recursive: true, force: true }); } catch {}
  } else {
    onEvent && onEvent({ type: 'status', msg: 'Đang tải Chrome for Testing (~180MB, chỉ lần đầu)…' });
  }
  const plat = cftPlatform();
  let url = `https://storage.googleapis.com/chrome-for-testing-public/${PINNED_CFT}/${plat}/chrome-${plat}.zip`;
  // Dự phòng: nếu bản ghim không tải được thì rơi về Stable mới nhất.
  try { if (!(await urlOk(url))) throw new Error('pinned 404'); }
  catch {
    try {
      const data = await httpGetJSON('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json');
      const dl = data.channels.Stable.downloads.chrome.find((x) => x.platform === plat);
      if (dl) url = dl.url;
    } catch {}
  }
  fs.mkdirSync(cftRoot(), { recursive: true });
  const zip = path.join(cftRoot(), 'chrome.zip');
  try { fs.unlinkSync(zip); } catch {}   // bỏ zip dở dang của lần chạy trước bị gián đoạn
  try {
    await download(url, zip, onEvent);
    onEvent && onEvent({ type: 'status', msg: 'Đang giải nén…' });
    await unzip(zip, cftRoot());
  } catch (e) {
    // Dọn sạch trạng thái nửa vời (zip hỏng + chrome.exe giải nén lởm) — không để
    // cachedCft() nhặt CfT THIẾU FILE ở các lần mở app sau rồi spawn Chrome hỏng.
    try { fs.rmSync(cftRoot(), { recursive: true, force: true }); } catch {}
    throw e;
  }
  try { fs.unlinkSync(zip); } catch {}
  const bin = cachedCft();
  if (!bin) throw new Error('Giải nén xong nhưng không thấy chrome');
  try { fs.chmodSync(bin, 0o755); } catch {}
  try { fs.writeFileSync(cftMarker(), url.includes(PINNED_CFT) ? PINNED_CFT : 'stable'); } catch {}   // đánh dấu bản đã tải
  if (process.platform === 'darwin') {
    try {
      const appDir = bin.replace(/\/Contents\/MacOS\/.*/, '');
      await new Promise((r) => { const c = spawn('xattr', ['-dr', 'com.apple.quarantine', appDir]); c.on('close', r); c.on('error', r); });
    } catch {}
  }
  return bin;
}
// Chống gọi đồng thời: restore() lúc mở app tải CfT NỀN (~180MB), user có thể bấm
// "thêm tài khoản Chrome" ngay trong lúc đó → trước đây 2 luồng cùng ghi chrome.zip
// và giải nén vào cftRoot (zip hỏng, Expand-Archive xung đột → flow chết ngang).
// Giờ mọi caller chạy trong cùng lúc chia sẻ 1 promise; caller sau nhận đúng kết quả
// (không lặp lại events tiến trình — chấp nhận, vì kết quả download là như nhau).
let _ensureInflight = null;
function ensureChrome(onEvent) {
  if (!_ensureInflight) _ensureInflight = _ensureChrome(onEvent).finally(() => { _ensureInflight = null; });
  return _ensureInflight;
}
function unzip(zip, dir) {
  return new Promise((res, rej) => {
    const cmd = process.platform === 'win32'
      ? spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path "${zip}" -DestinationPath "${dir}"`])
      : spawn('unzip', ['-q', '-o', zip, '-d', dir]);
    cmd.on('close', (code) => code === 0 ? res() : rej(new Error('unzip lỗi ' + code)));
    cmd.on('error', rej);
  });
}
module.exports = { cftIsPinned, findCft, findChrome, ensureChrome };
