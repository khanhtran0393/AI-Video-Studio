'use strict';
// Bundle selfcheck — kiểm tra artifact/bundle đóng gói KHÔNG CẦN GUI, KHÔNG gọi mạng
// (học từ --selfcheck của core/packaged_selfcheck.py trong TDTStudio).
//
// Mục đích: bắt sớm lỗi "thiếu file runtime" mà smoke test giao diện không thấy
// (bundle Nova Scene chưa build, ffmpeg rơi vào app.asar, chrome-headless-shell chưa tải…).
//
// Chạy:  node nova/scripts/bundle-selfcheck.js
// Thoát: 0 khi mọi kiểm tra BẮT BUỘC đạt, 1 khi có FAIL. Kiểm tra WARN không ảnh hưởng exit code.
//
// Quy ước kiểm định: FAIL = thiếu thứ mà render/exports chắc chắn sẽ chết.
// WARN = thiếu thứ có thể tự phục hồi lúc chạy (vd Chrome tự tải lần đầu) — không chặn.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UNPACKED = ROOT.includes('app.asar') && !ROOT.includes('app.asar.unpacked')
  ? ROOT.replace('app.asar', 'app.asar.unpacked') : ROOT;
function onDisk(rel) {
  const a = path.join(UNPACKED, rel);
  if (fs.existsSync(a)) return a;
  return path.join(ROOT, rel);            // chạy từ mã nguồn (dev)
}
const EDITOR_PRO = onDisk(path.join('nova', 'editor-pro'));

const results = [];
function report(status, name, detail) {
  results.push({ status, name, detail: detail || '' });
  const extra = detail ? ' ' + detail : '';
  console.log(`${status.padEnd(4)} ${name}${extra}`);
}

function checkFfmpeg() {
  let FFMPEG = null;
  try { FFMPEG = require(path.join(EDITOR_PRO, 'ff-path')).FFMPEG; } catch (_) {}
  if (!FFMPEG) { report('FAIL', 'ff-path:FFMPEG', '— không require được nova/editor-pro/ff-path.js'); return; }
  if (FFMPEG === 'ffmpeg') {
    report('FAIL', 'ffmpeg:binary', `— ffmpeg-static không resolve được, spawn sẽ chết (path="${FFMPEG}")`);
    return;
  }
  if (String(FFMPEG).includes('app.asar') && !String(FFMPEG).includes('app.asar.unpacked')) {
    report('FAIL', 'ffmpeg:binary', `— ffmpeg nằm TRONG app.asar, spawn sẽ ENOTDIR: ${FFMPEG}`);
    return;
  }
  report(fs.existsSync(FFMPEG) ? 'OK' : 'FAIL', 'ffmpeg:binary', FFMPEG);
}

function checkNovaBundle() {
  const bundle = onDisk(path.join('nova', 'editor-pro', 'nova-remotion', 'bundle'));
  if (!fs.existsSync(bundle)) {
    report('FAIL', 'nova-remotion:bundle', `— thiếu ${bundle} (chạy: node editor-pro/nova-remotion/build.js)`);
    return;
  }
  const hasIndex = fs.existsSync(path.join(bundle, 'index.html'));
  report(hasIndex ? 'OK' : 'FAIL', 'nova-remotion:bundle', bundle + (hasIndex ? '' : ' — thiếu index.html, bundle chưa build xong'));
}

function checkChrome() {
  const root = onDisk(path.join('nova', 'editor-pro', 'remotion-browser'));
  let found = null;
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      if (e.isDirectory()) stack.push(path.join(d, e.name));
      else if (e.name === 'chrome-headless-shell') { found = path.join(d, e.name); break; }
    }
    if (found) break;
  }
  // WARN chứ không FAIL: renderer tự tải Chrome lần đầu chạy thật (test:video-agent:render).
  report(found ? 'OK' : 'WARN', 'remotion:chrome-headless-shell', found || `— chưa có trong ${root} (sẽ tự tải khi render thật lần đầu)`);
}

function checkRemotionBinaries() {
  try {
    const pkg = require.resolve('@remotion/compositor-win32-x64-msvc/package.json', { paths: [EDITOR_PRO, ROOT] });
    const inAsar = pkg.includes('app.asar') && !pkg.includes('app.asar.unpacked');
    if (inAsar) {
      const unpacked = pkg.replace('app.asar', 'app.asar.unpacked');
      report(fs.existsSync(unpacked) ? 'OK' : 'FAIL', 'remotion:compositor-unpacked',
        fs.existsSync(unpacked) ? unpacked : `— compositor nằm trong asar mà thiếu bản unpacked: ${pkg}`);
    } else {
      report('OK', 'remotion:compositor', path.dirname(pkg));
    }
  } catch (_) {
    report('WARN', 'remotion:compositor', '— không resolve được @remotion/compositor-win32-x64-msvc (dev thiếu dep hoặc platform khác)');
  }
}

function checkWeb() {
  const index = onDisk(path.join('nova', 'web', 'index.html'));
  report(fs.existsSync(index) ? 'OK' : 'FAIL', 'web:index.html', index);
}

function checkUserDataWritable() {
  const base = process.env.APPDATA || process.env.LOCALAPPDATA || ROOT;
  const dir = path.join(base, 'AI Video Studio Independent');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.selfcheck-probe-${Date.now()}`);
    fs.writeFileSync(probe, 'selfcheck');
    fs.unlinkSync(probe);
    report('OK', 'userdata:writable', dir);
  } catch (e) {
    report('FAIL', 'userdata:writable', `${dir} — ${String((e && e.message) || e)}`);
  }
}

function main() {
  console.log('=== Bundle selfcheck — AI Video Studio (không GUI, không mạng) ===');
  report(fs.existsSync(EDITOR_PRO) ? 'OK' : 'FAIL', 'editor-pro:dir', EDITOR_PRO);
  checkFfmpeg();
  checkNovaBundle();
  checkChrome();
  checkRemotionBinaries();
  checkWeb();
  checkUserDataWritable();
  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  console.log(`\nKết quả: ${results.length - fails.length - warns.length} OK, ${warns.length} WARN, ${fails.length} FAIL`);
  if (fails.length) {
    console.log('Có kiểm tra BẮT BUỘC thất bại — bundle đóng gói/runtime chưa đủ để render (Luật 10: không bỏ qua ngầm).');
    process.exit(1);
  }
  process.exit(0);
}

main();