'use strict';
/* ============================================================
   WHITEBOARD STUDIO — FF-RUNTIME (ffmpeg/ffprobe nội bộ)
   ------------------------------------------------------------
   Quy tắc "runtime nội bộ thật" của module (đúng yêu cầu):
   1. KHÔNG nhận đường dẫn repo ngoài từ GUI — mọi đường dẫn
      binary đều tự resolve trong runtime này.
   2. spawn KHÔNG chạy được file trong app.asar (lỗi ENOTDIR đã
      đo) → dùng cùng pattern unasar() của nova/editor-pro/ff-path.js.
   3. Thứ tự resolve: app.asar.unpacked → node_modules cạnh app
      → node_modules repo dev → PATH của hệ thống.
   ============================================================ */
const fs = require('fs');
const path = require('path');

function unasar(p) {
  if (!p) return null;
  const s = String(p);
  return s.includes('app.asar') && !s.includes('app.asar.unpacked')
    ? s.replace('app.asar', 'app.asar.unpacked') : s;
}

function firstExisting(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return null;
}

/** ffmpeg.exe theo nền tảng; tự tìm, không nhận tham chiếu từ GUI. */
function resolveFfmpeg() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const dirs = [];
  try {
    // 1) app.asar.unpacked (electron-builder đã pack ffmpeg-static)
    const ffmpegStatic = require('ffmpeg-static');
    const real = unasar(ffmpegStatic);
    if (real) return real;
    if (typeof ffmpegStatic === 'string') dirs.push(path.dirname(ffmpegStatic));
  } catch (_) {}
  try {
    // 2) node_modules ffmpeg-static cạnh app hoặc trong repo dev
    const nm = require.resolve('ffmpeg-static');
    const real = unasar(nm);
    if (real && fs.existsSync(real)) return real;
    dirs.push(path.dirname(nm));
  } catch (_) {}
  // 3) các vị trí quen thuộc trong repo (dev mode: nova/../node_modules)
  const here = __dirname;
  dirs.push(
    path.join(here, '..', '..', 'node_modules', 'ffmpeg-static'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static'),
    path.join(process.resourcesPath || '', '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static')
  );
  const found = firstExisting(dirs.map((d) => path.join(d, exe)));
  return found || exe;   // 4) PATH hệ thống
}

function resolveFfprobe() {
  const exe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const dirs = [];
  try {
    const p = require('ffprobe-static');
    const q = unasar(p.path || p);
    if (q) return q;
  } catch (_) {}
  try {
    const nm = require.resolve('ffprobe-static');
    const real = unasar(nm);
    if (real && fs.existsSync(real)) return real;
    dirs.push(path.dirname(nm));
  } catch (_) {}
  const here = __dirname;
  dirs.push(
    path.join(here, '..', '..', 'node_modules', 'ffprobe-static', 'bin', process.platform, process.arch === 'x64' ? 'x64' : 'ia32'),
    path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', process.platform, 'x64'),
    path.join(process.resourcesPath || '', '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', process.platform, 'x64')
  );
  const found = firstExisting(dirs.map((d) => path.join(d, exe)));
  return found || exe;
}

const FFMPEG = resolveFfmpeg();
const FFPROBE = resolveFfprobe();

function ffmpegAvailable() {
  try { return fs.existsSync(FFMPEG) || !path.isAbsolute(FFMPEG); } catch (_) { return false; }
}

module.exports = { FFMPEG, FFPROBE, ffmpegAvailable, unasar };
