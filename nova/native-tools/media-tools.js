'use strict';
/* ── media-tools.js — Công cụ FFmpeg cho người dùng cuối (sidebar "Công cụ FFmpeg"):
      tách MP3/M4A/WAV, cắt, ghép, loop, nén, trích frame, xoá tiếng, đổi định dạng,
      ghép nhạc, xuất GIF.
      Dùng lại FFMPEG/FFPROBE/probeDur của ./ffmpeg.js. KHÔNG fallback ngầm (Luật 10):
      thiếu file/binary/tham số sai → reject lộ liễu với error code FFX_*.
      Progress: parse "time=HH:MM:SS" trên stderr của ffmpeg, so với totalSec đo bằng
      ffprobe → phát % về renderer qua callback onProgress. Huỷ: registry 1 job
      đang chạy (ffxJob) → cancelRunning() kill process; exit ≠ 0 khi có yêu cầu huỷ
      → lỗi FFX_CANCELLED (caller hiển thị "Đã huỷ", không phải lỗi FFmpeg). ── */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG, FFPROBE, probeDur } = require('./ffmpeg');

/* ── Job đang chạy (chỉ 1 tác vụ FFmpeg cùng lúc — chống nghẽn I/O đĩa) ── */
let ffxJob = null;
let ffxCancelReq = false;

function cancelRunning() {
  if (!ffxJob) return { ok: false, error: 'FFX_CANCEL_NONE: không có tác vụ FFmpeg nào đang chạy' };
  ffxCancelReq = true;
  try { ffxJob.kill(); } catch (_) { /* đã chết sẵn thì bỏ qua */ }
  return { ok: true };
}

/* Spawn ffmpeg, gắn job registry + progress. Reject khi exit ≠ 0 (lộ liễu). */
function spawnRun(bin, args, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    if (!bin || !fs.existsSync(bin)) { const e = new Error('FFX_BINARY: không tìm thấy FFmpeg binary'); e.code = 'FFX_BINARY'; return reject(e); }
    const cp = spawn(bin, args, { windowsHide: true });
    ffxJob = cp; ffxCancelReq = false;
    let err = '';
    cp.stderr.on('data', (d) => {
      const s = String(d); err += s;
      if (o.onProgress && o.totalSec > 0) {
        const m = /time=(\d+):(\d+):(\d+(?:[.,]\d+)?)/.exec(s);
        if (m) {
          const t = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3].replace(',', '.'));
          o.onProgress(Math.min(99, Math.round((t / o.totalSec) * 100)));
        }
      }
    });
    cp.on('error', (e) => { ffxJob = null; reject(e); });
    cp.on('close', (code) => {
      ffxJob = null;
      if (code === 0) return resolve(err);
      if (ffxCancelReq) { const e = new Error('FFX_CANCELLED: đã huỷ theo yêu cầu người dùng'); e.code = 'FFX_CANCELLED'; return reject(e); }
      return reject(new Error('FFmpeg lỗi (' + code + '): ' + err.slice(-400)));
    });
  });
}

/* ── Validate helpers ── */
function assertInput(p, code) {
  if (!p || typeof p !== 'string') { const e = new Error(code + ': thiếu đường dẫn file'); e.code = code; throw e; }
  if (!fs.existsSync(p)) { const e = new Error(code + ': file không tồn tại — ' + p); e.code = code; throw e; }
}

function assertOutput(p) {
  if (!p || typeof p !== 'string') { const e = new Error('FFX_OUTPUT: thiếu đường dẫn file output'); e.code = 'FFX_OUTPUT'; throw e; }
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function num(v, code) {
  const n = Number(v);
  if (!Number.isFinite(n)) { const e = new Error(code + ': giá trị phải là số'); e.code = code; throw e; }
  return n;
}

function validBitrate(br) {
  const b = String(br || '192k').trim();
  if (!/^\d+k$/.test(b)) { const e = new Error('FFX_BITRATE: bitrate không hợp lệ — ' + b); e.code = 'FFX_BITRATE'; throw e; }
  return b;
}

/* Đo metadata bằng ffprobe — reject lộ liễu (khác probeDur trả 0 im lặng). */
function probeMedia(file) {
  return new Promise((resolve, reject) => {
    if (!FFPROBE) { const e = new Error('FFX_PROBE: không tìm thấy ffprobe binary'); e.code = 'FFX_PROBE'; return reject(e); }
    if (!file || !fs.existsSync(file)) { const e = new Error('FFX_PROBE: file không tồn tại — ' + file); e.code = 'FFX_PROBE'; return reject(e); }
    const cp = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', file], { windowsHide: true });
    let out = '';
    cp.stdout.on('data', (d) => { out += d; });
    cp.on('error', reject);
    cp.on('close', () => {
      try {
        const j = JSON.parse(out);
        resolve({
          durationSec: Math.max(0, Number(j.format && j.format.duration) || 0),
          sizeBytes: Math.max(0, Number(j.format && j.format.size) || 0),
        });
      } catch (_) { const e = new Error('FFX_PROBE: ffprobe trả dữ liệu không đọc được — ' + file); e.code = 'FFX_PROBE'; reject(e); }
    });
  });
}

/* ── 1) Tách âm thanh → MP3 (libmp3lame) / M4A (aac) / WAV (pcm) ── */
async function extractAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const fmt = String(o.format || 'mp3').toLowerCase();
  let args;
  if (fmt === 'wav') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'pcm_s16le', o.outputPath];
  else if (fmt === 'm4a') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'aac', '-b:a', validBitrate(o.bitrate), o.outputPath];
  else if (fmt === 'mp3') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'libmp3lame', '-b:a', validBitrate(o.bitrate), o.outputPath];
  else { const e = new Error('FFX_FORMAT: định dạng âm thanh không hỗ trợ — ' + fmt); e.code = 'FFX_FORMAT'; throw e; }
  const total = await probeDur(o.inputPath);
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 2) Cắt video [startSec, endSec] — copy stream, không re-encode ── */
async function cutVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const s = num(o.startSec, 'FFX_START');
  const e2 = num(o.endSec, 'FFX_END');
  if (s < 0) { const e = new Error('FFX_START: giây bắt đầu phải ≥ 0'); e.code = 'FFX_START'; throw e; }
  if (e2 <= s) { const e = new Error('FFX_RANGE: giây kết thúc phải LỚN HƠN giây bắt đầu'); e.code = 'FFX_RANGE'; throw e; }
  await spawnRun(FFMPEG,
    ['-y', '-ss', String(s), '-to', String(e2), '-i', o.inputPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', o.outputPath],
    { totalSec: e2 - s });
  return { ok: true, path: o.outputPath };
}

/* ── 3) Ghép nhiều video — concat demuxer (-c copy), list tạm tự xoá ── */
async function concatVideos(opts) {
  const o = opts || {};
  if (!Array.isArray(o.inputPaths) || o.inputPaths.length < 2) {
    const e = new Error('FFX_INPUTS: cần ít nhất 2 video để ghép'); e.code = 'FFX_INPUTS'; throw e;
  }
  o.inputPaths.forEach((p) => assertInput(p, 'FFX_INPUTS'));
  assertOutput(o.outputPath);
  let total = 0;
  for (const p of o.inputPaths) total += await probeDur(p);
  const listPath = path.join(os.tmpdir(), 'ffx-concat-' + Date.now() + '.txt');
  const lines = o.inputPaths.map((p) => "file '" + String(p).replace(/'/g, "'\\''") + "'");
  fs.writeFileSync(listPath, lines.join('\n'), 'utf8');
  try {
    await spawnRun(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', o.outputPath], { totalSec: total });
  } finally {
    try { fs.unlinkSync(listPath); } catch (_) { /* file tạm — dọn được thì dọn */ }
  }
  return { ok: true, path: o.outputPath };
}

/* ── 4) Loop video N lần (times ≥ 2) — -stream_loop, copy stream ── */
async function loopVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const n = num(o.times, 'FFX_TIMES');
  if (!(n >= 2) || Math.floor(n) !== n) { const e = new Error('FFX_TIMES: số lần lặp phải là số nguyên ≥ 2'); e.code = 'FFX_TIMES'; throw e; }
  const total = (await probeDur(o.inputPath)) * n;
  await spawnRun(FFMPEG, ['-y', '-stream_loop', String(n - 1), '-i', o.inputPath, '-c', 'copy', o.outputPath], { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 5) Nén video — H.264 + CRF (mặc định 28 = cân bằng), audio AAC 128k ── */
async function compressVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const q = num(o.crf, 'FFX_CRF');
  if (q < 14 || q > 40) { const e = new Error('FFX_CRF: CRF phải trong khoảng 14–40'); e.code = 'FFX_CRF'; throw e; }
  const total = await probeDur(o.inputPath);
  await spawnRun(FFMPEG,
    ['-y', '-i', o.inputPath, '-c:v', 'libx264', '-crf', String(q), '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', o.outputPath],
    { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 6) Trích frame — 1 ảnh tại giây atSec, hoặc mỗi everySec giây 1 ảnh vào outputDir ── */
const FRAME_PREFIX = 'ffx-frame-';

async function extractFrames(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  const fmt = String(o.format || 'png').toLowerCase();
  if (fmt !== 'png' && fmt !== 'jpg') { const e = new Error('FFX_FORMAT: chỉ hỗ trợ png/jpg'); e.code = 'FFX_FORMAT'; throw e; }
  if (!o.outputDir || typeof o.outputDir !== 'string') { const e = new Error('FFX_OUTDIR: thiếu thư mục lưu ảnh'); e.code = 'FFX_OUTDIR'; throw e; }
  fs.mkdirSync(o.outputDir, { recursive: true });
  let args;
  if (o.mode === 'single') {
    const s = num(o.atSec, 'FFX_AT');
    if (s < 0) { const e = new Error('FFX_AT: giây trích phải ≥ 0'); e.code = 'FFX_AT'; throw e; }
    args = ['-y', '-ss', String(s), '-i', o.inputPath, '-frames:v', '1', path.join(o.outputDir, FRAME_PREFIX + '0.' + fmt)];
    await spawnRun(FFMPEG, args, {});
    return { ok: true, path: path.join(o.outputDir, FRAME_PREFIX + '0.' + fmt), count: 1 };
  }
  const n = num(o.everySec, 'FFX_EVERY');
  if (!(n >= 0.1)) { const e = new Error('FFX_EVERY: khoảng cách giữa 2 frame phải ≥ 0.1 giây'); e.code = 'FFX_EVERY'; throw e; }
  const total = await probeDur(o.inputPath);
  args = ['-y', '-i', o.inputPath, '-vf', 'fps=1/' + n, path.join(o.outputDir, FRAME_PREFIX + '%04d.' + fmt)];
  await spawnRun(FFMPEG, args, { totalSec: total });
  const count = fs.readdirSync(o.outputDir).filter((f) => f.indexOf(FRAME_PREFIX) === 0).length;
  return { ok: true, path: o.outputDir, count };
}

/* ── 7) Xoá tiếng — bỏ track audio (-an), copy video nguyên bản ── */
async function removeAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const total = await probeDur(o.inputPath);
  await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-an', '-c:v', 'copy', o.outputPath], { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 8) Đổi định dạng — target theo đuôi file output (mp4/webm/mkv/mov hoặc mp3/m4a/wav) ── */
async function convertMedia(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  const total = await probeDur(o.inputPath);
  let args;
  if (ext === 'mp3') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', o.outputPath];
  else if (ext === 'm4a') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'aac', '-b:a', '192k', o.outputPath];
  else if (ext === 'wav') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'pcm_s16le', o.outputPath];
  else if (ext === 'webm') args = ['-y', '-i', o.inputPath, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '5', '-crf', '34', '-b:v', '0', '-c:a', 'libopus', o.outputPath];
  else if (ext === 'mp4' || ext === 'mov' || ext === 'mkv') args = ['-y', '-i', o.inputPath, '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', o.outputPath];
  else { const e = new Error('FFX_FORMAT: định dạng đích không hỗ trợ — ' + ext); e.code = 'FFX_FORMAT'; throw e; }
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 9) Ghép nhạc vào video — mix (amix, volume 0–2) hoặc thay thế tiếng gốc ── */
async function addMusic(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertInput(o.musicPath, 'FFX_MUSIC');
  assertOutput(o.outputPath);
  const m = String(o.mode || 'mix');
  if (m !== 'mix' && m !== 'replace') { const e = new Error('FFX_MUSIC_MODE: chế độ phải là mix hoặc replace'); e.code = 'FFX_MUSIC_MODE'; throw e; }
  const v = num(o.musicVolume, 'FFX_MUSIC_VOL');
  if (v < 0 || v > 2) { const e = new Error('FFX_MUSIC_VOL: âm lượng nhạc phải trong khoảng 0–2'); e.code = 'FFX_MUSIC_VOL'; throw e; }
  const total = await probeDur(o.inputPath);
  const audio = ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'];
  let args;
  if (m === 'replace') {
    args = ['-y', '-i', o.inputPath, '-i', o.musicPath, '-map', '0:v', '-map', '1:a', '-shortest'].concat(audio, [o.outputPath]);
  } else {
    const fc = '[1:a]volume=' + v + '[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[aout]';
    args = ['-y', '-i', o.inputPath, '-i', o.musicPath, '-filter_complex', fc, '-map', '0:v', '-map', '[aout]'].concat(audio, [o.outputPath]);
  }
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 10) Xuất GIF — palette 2 pass trong 1 lệnh, loop vô hạn; [startSec, endSec] tuỳ chọn ── */
async function toGif(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const w = num(o.width, 'FFX_GIF_W');
  if (w < 160 || w > 1280) { const e = new Error('FFX_GIF_W: bề rộng GIF phải 160–1280'); e.code = 'FFX_GIF_W'; throw e; }
  const f = num(o.fps, 'FFX_GIF_FPS');
  if (f < 5 || f > 30) { const e = new Error('FFX_GIF_FPS: fps GIF phải 5–30'); e.code = 'FFX_GIF_FPS'; throw e; }
  const s = num(o.startSec || 0, 'FFX_START');
  if (s < 0) { const e = new Error('FFX_START: giây bắt đầu phải ≥ 0'); e.code = 'FFX_START'; throw e; }
  let dur = 0;
  const totalAll = await probeDur(o.inputPath);
  if (o.endSec !== null && o.endSec !== undefined && String(o.endSec) !== '') {
    const e2 = num(o.endSec, 'FFX_END');
    if (e2 <= s) { const e = new Error('FFX_RANGE: giây kết thúc phải LỚN HƠN giây bắt đầu'); e.code = 'FFX_RANGE'; throw e; }
    dur = e2 - s;
  }
  const vf = 'fps=' + f + ',scale=' + w + ':-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';
  const args = ['-y', '-ss', String(s), '-i', o.inputPath];
  if (dur > 0) args.push('-t', String(dur));
  args.push('-vf', vf, '-loop', '0', o.outputPath);
  await spawnRun(FFMPEG, args, { totalSec: dur > 0 ? dur : totalAll });
  return { ok: true, path: o.outputPath };
}

module.exports = {
  cancelRunning, probeMedia,
  extractAudio, cutVideo, concatVideos, loopVideo,
  compressVideo, extractFrames, removeAudio, convertMedia, addMusic, toGif,
};