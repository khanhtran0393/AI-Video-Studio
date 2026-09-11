/* ── native-tools/spy.js — Spy video → storyboard grid (P4.4, mục 15 roadmap VEO3).
     yt-dlp (ytdlp-bin đóng gói sẵn) tải video YouTube ≤720p → ffmpeg trích N frame
     đều theo thời lượng → ghép lưới storyboard.jpg. KHÔNG thêm dependency mới:
     tái dùng resolveYtdlp (editor-pro/ytdlp-path.js) + FFMPEG/probeDur (./ffmpeg).
     Lỗi lộ liễu với error code có ý nghĩa — không fallback ngầm (Luật 10). ── */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG, probeDur } = require('./ffmpeg');
const { YTDLP, YTDLP_BUNDLED } = require('../editor-pro/ytdlp-path');

// Whitelist YouTube — mọi URL khác bị chặn trước khi chạm yt-dlp.
function isYouTubeUrl(u) {
  try {
    const h = new URL(String(u || '')).hostname.toLowerCase();
    return h === 'youtube.com' || h === 'www.youtube.com' || h === 'm.youtube.com' ||
      h === 'music.youtube.com' || h === 'youtu.be' || h === 'www.youtu.be';
  } catch (e) { return false; }
}

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || ('spy-' + Date.now());
}

// Gốc output: <userData>/output/spy/<jobId>/ — KHÔNG ghi vào thư mục cài đặt app.
function spyRoot() {
  try { return path.join(require('electron').app.getPath('userData'), 'output', 'spy'); }
  catch (e) { return path.join(__dirname, '..', '..', 'output', 'spy'); }
}

const _active = new Map();   // jobId → ChildProcess đang chạy (yt-dlp hoặc ffmpeg)

function _spawnTracked(bin, args, jobId) {
  return new Promise((resolve, reject) => {
    if (!bin || !fs.existsSync(bin)) return reject(new Error('SPY_BIN_MISSING: ' + bin));
    const cp = spawn(bin, args, { windowsHide: true });
    if (jobId) _active.set(jobId, cp);
    let err = '', out = '';
    cp.stdout.on('data', (d) => { out += d; });
    cp.stderr.on('data', (d) => { err += String(d); });
    cp.on('error', (e) => { if (jobId) _active.delete(jobId); reject(e); });
    cp.on('close', (code) => {
      if (jobId) _active.delete(jobId);
      if (code === 0) return resolve({ out, err });
      const e = new Error('SPY_PROC_EXIT(' + code + '): ' + (err || out).slice(-600));
      e.cancelled = /cancell|Premature|Interrupted by user/i.test(err);
      reject(e);
    });
  });
}

// ── Chạy 1 job spy đầy đủ: tải → trích frame → ghép lưới. ──
async function spyRun({ url, jobId, frames: wantFrames = 12, cols = 4, dir, maxHeight = 720 } = {}) {
  if (!isYouTubeUrl(url)) throw new Error('SPY_URL_NOT_YOUTUBE: chỉ chấp nhận URL YouTube (youtube.com, youtu.be, music.youtube.com)');
  if (!YTDLP_BUNDLED) console.warn('[spy] yt-dlp không có bản bundled — dựa vào PATH máy');
  const id = slug(jobId || ((new URL(url).searchParams.get('v') || 'yt') + '-' + Date.now()));
  const outDir = dir ? path.resolve(dir) : path.join(spyRoot(), id);
  fs.mkdirSync(outDir, { recursive: true });

  const source = path.join(outDir, 'source.mp4');
  const fmt = 'bv*[height<=' + Number(maxHeight || 720) + ']+ba/b[height<=' + Number(maxHeight || 720) + ']/b';
  try {
    await _spawnTracked(YTDLP,
      ['--no-playlist', '-f', fmt, '--merge-output-format', 'mp4', '--no-progress', '-o', source, String(url)], id);
  } catch (e) {
    if (e.cancelled) throw new Error('SPY_CANCELLED');
    throw new Error('SPY_DOWNLOAD_FAILED: ' + (e.message || e));
  }
  if (!fs.existsSync(source)) throw new Error('SPY_DOWNLOAD_FAILED: yt-dlp thoát sạch nhưng thiếu source.mp4');

  const dur = await probeDur(source);
  if (!dur) throw new Error('SPY_PROBE_FAILED: không đo được thời lượng source.mp4');

  // Số frame chuẩn hoá thành bội số của cols để tile luôn đủ ô.
  const nCols = Math.max(1, Math.min(8, Number(cols) || 4));
  let n = Math.max(1, Math.min(48, Number(wantFrames) || 12));
  const rows = Math.ceil(n / nCols); n = nCols * rows;

  const frames = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) * dur) / n;                       // giữa mỗi khoảng → tránh frame đen đầu/cuối
    const f = path.join(outDir, 'frame-' + String(k + 1).padStart(2, '0') + '.jpg');
    await _spawnTracked(FFMPEG, ['-y', '-ss', t.toFixed(2), '-i', source, '-frames:v', '1', '-q:v', '3', f], id);
    frames.push(f);
  }

  const storyboard = path.join(outDir, 'storyboard.jpg');
  await _spawnTracked(FFMPEG, ['-y', '-start_number', '1', '-i', path.join(outDir, 'frame-%02d.jpg'),
    '-vf', 'scale=320:180:force_original_aspect_ratio=increase,crop=320:180,tile=' + nCols + 'x' + rows,
    '-frames:v', '1', storyboard], id);

  return { ok: true, jobId: id, url, dir: outDir, source, durationSec: dur, frames, storyboard, cols: nCols, rows };
}

// ── Huỷ job đang chạy (giết tiến trình yt-dlp/ffmpeg của jobId). ──
function spyCancel(jobId) {
  const cp = _active.get(String(jobId || ''));
  if (!cp) return { ok: false, error: 'SPY_JOB_UNKNOWN: không có tiến trình đang chạy cho job này' };
  try { cp.kill('SIGKILL'); } catch (e) {}
  _active.delete(String(jobId));
  return { ok: true };
}

// ── Liệt kê các job spy đã có trên đĩa (mới nhất trước). ──
function spyList() {
  const root = spyRoot();
  let dirs = [];
  try { dirs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'source.mp4'))); } catch (e) {}
  return dirs.map((d) => {
    const p = path.join(root, d);
    let mtime = 0;
    try { mtime = fs.statSync(path.join(p, 'source.mp4')).mtimeMs; } catch (e) {}
    return {
      jobId: d, dir: p, mtime,
      storyboard: fs.existsSync(path.join(p, 'storyboard.jpg')) ? path.join(p, 'storyboard.jpg') : null,
      source: path.join(p, 'source.mp4'),
    };
  }).sort((a, b) => b.mtime - a.mtime);
}

module.exports = { spyRun, spyCancel, spyList, isYouTubeUrl, spyRoot };

