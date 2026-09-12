'use strict';
/* ── media-tools.js — Công cụ FFmpeg cho người dùng cuối (sidebar "Công cụ FFmpeg").
      16 tool nâng cấp chuyên nghiệp (2026-09-12e + gói E):
        1. Tách âm thanh: MP3/M4A/WAV/FLAC + smart-copy AAC + loudnorm + kênh/sample + khoảnh đoạn
        2. Cắt: copy nhanh | chính xác frame (re-encode) + fade + multi-segment
        3. Ghép: concat copy | auto-hoà chuẩn (probe khác codec/size/fps → chuẩn hoá rồi ghép) | transitions xfade
        4. Loop: N lần | tổng thời lượng | ping-pong | crossfade vòng lặp
        5. Nén: CRF (GPU nvenc/qsv/amf nếu máy hỗ trợ) | dung lượng mục tiêu (2-pass chính xác)
        6. Trích frame: mỗi N giây | tại giây | theo số frame | theo cảnh | lưới contact-sheet (+ timestamp)
        7. Xoá tiếng: tất cả track | giữ 1 track cụ thể + giữ phụ đề mềm
        8. Đổi định dạng: H.264/H.265 (GPU) + giữ sub + scale/fps đích
       9. Ghép nhạc: mix (volume 2 bên, offset, fade in/out, loop nhạc, loudnorm) | replace
      10. GIF: loop N lần | palette màu | dithering | slideshow theo cảnh
      11. Shorts 9:16: ngang → dọc 1080x1920 (nền mờ blur-pad | cắt giữa) + faststart
      12. Đóng phụ đề cứng: SRT (force_style fontsize) | ASS nguyên bản
      13. Faststart remux: moov atom lên đầu MP4/M4A/MOV — copy stream, không re-encode
      14. Chuẩn hoá âm lượng: EBU R128 loudnorm 2-pass (đo rồi chỉnh tuyến tính)
      15. Bỏ lời / tách giọng thô: karaoke center-cancel (cần nguồn stereo)
      16. Fade in/out: video + audio (mở/khép màn hình và âm thanh)
     (Gói E 2026-09-12: nhóm 1 đa kênh + nhóm 4 âm thanh sâu.)
       KHÔNG fallback ngầm (Luật 10): mọi lỗi reject lộ liễu với error code FFX_*.
      Progress: parse time=/fps=/speed= trên stderr → onProgress({pct,fps,speed}). ── */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG, FFPROBE, probeDur } = require('./ffmpeg');
const { gpuEncoder, qualityArgs, label: gpuLabel } = require('../editor-pro/gpu-encoder');

/* ── Job đang chạy (chỉ 1 tác vụ FFmpeg cùng lúc — chống nghẽn I/O đĩa) ── */
let ffxJob = null;
let ffxCancelReq = false;

function cancelRunning() {
  if (!ffxJob) return { ok: false, error: 'FFX_CANCEL_NONE: không có tác vụ FFmpeg nào đang chạy' };
  ffxCancelReq = true;
  try { ffxJob.kill(); } catch (_) { /* đã chết sẵn thì bỏ qua */ }
  return { ok: true };
}

/* Spawn ffmpeg: gắn job registry + progress (pct từ time=, kèm fps/speed nếu stderr có). */
function spawnRun(bin, args, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    if (!bin || !fs.existsSync(bin)) { const e = new Error('FFX_BINARY: không tìm thấy FFmpeg binary'); e.code = 'FFX_BINARY'; return reject(e); }
    const cp = spawn(bin, args, { windowsHide: true });
    ffxJob = cp; ffxCancelReq = false;
    let err = '';
    let lastPct = 0;
    cp.stderr.on('data', (d) => {
      const s = String(d); err += s;
      if (!o.onProgress) return;
      const fps = /fps=\s*([\d.]+)/.exec(s);
      const spd = /speed=\s*([\d.]+)x/.exec(s);
      const tm = /time=(\d+):(\d+):(\d+(?:[.,]\d+)?)/.exec(s);
      if (!tm && !fps && !spd) return;
      if (tm && o.totalSec > 0) {
        const t = (+tm[1]) * 3600 + (+tm[2]) * 60 + parseFloat(tm[3].replace(',', '.'));
        lastPct = Math.min(99, Math.round((t / o.totalSec) * 100));
      }
      o.onProgress({
        pct: lastPct,
        fps: fps ? Number(fps[1]) : undefined,
        speed: spd ? Number(spd[1]) : undefined,
      });
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

/* Kéo dài file tạm khi xử lý nhiều bước (chuẩn hoá/cắt segment) — caller tự xoá. */
function tempDir(prefix) {
  const dir = path.join(os.tmpdir(), prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* tạm — dọn được thì dọn */ }
}

/* Chạy 1 lệnh ffprobe -show_format -show_streams, parse JSON đầy đủ. */
function ffprobeJson(file) {
  return new Promise((resolve, reject) => {
    if (!FFPROBE) { const e = new Error('FFX_PROBE: không tìm thấy ffprobe binary'); e.code = 'FFX_PROBE'; return reject(e); }
    if (!file || !fs.existsSync(file)) { const e = new Error('FFX_PROBE: file không tồn tại — ' + file); e.code = 'FFX_PROBE'; return reject(e); }
    const cp = spawn(FFPROBE, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { windowsHide: true });
    let out = '';
    cp.stdout.on('data', (d) => { out += d; });
    cp.on('error', reject);
    cp.on('close', () => {
      try { resolve(JSON.parse(out)); }
      catch (_) { const e = new Error('FFX_PROBE: ffprobe trả dữ liệu không đọc được — ' + file); e.code = 'FFX_PROBE'; reject(e); }
    });
  });
}

/* Metadata đầy đủ: duration/size + video (codec, size, fps) + danh sách track audio + số sub. */
async function probeStreams(file) {
  const j = await ffprobeJson(file);
  const streams = Array.isArray(j.streams) ? j.streams : [];
  const v = streams.find((s) => s.codec_type === 'video') || null;
  const audio = streams.filter((s) => s.codec_type === 'audio').map((s) => ({
    index: typeof s.index === 'number' ? s.index : 0,
    codec: s.codec_name || '?',
    channels: s.channels || 0,
  }));
  const subs = streams.filter((s) => s.codec_type === 'subtitle').length;
  let fps = 0;
  if (v) {
    const m = String(v.avg_frame_rate || '').match(/^(\d+)\/(\d+)$/);
    if (m && +m[2] > 0) fps = Math.round((+m[1] / +m[2]) * 100) / 100;
    else fps = Number(v.r_frame_rate) || 0;
  }
  return {
    durationSec: Math.max(0, Number(j.format && j.format.duration) || 0),
    sizeBytes: Math.max(0, Number(j.format && j.format.size) || 0),
    video: v ? { codec: v.codec_name || '?', width: v.width || 0, height: v.height || 0, fps } : null,
    audioTracks: audio,
    subCount: subs,
  };
}

/* probeMedia ngắn gọn (tương thích renderer cũ). */
async function probeMedia(file) {
  const j = await ffprobeJson(file);
  return {
    durationSec: Math.max(0, Number(j.format && j.format.duration) || 0),
    sizeBytes: Math.max(0, Number(j.format && j.format.size) || 0),
  };
}

/* ── 1) Tách âm thanh: MP3/M4A/WAV/FLAC ──
   opts: format, bitrate, smart (m4a + nguồn AAC → copy stream không re-encode),
   loudnorm (EBU R128), channels ('keep'|'stereo'|'mono'), sampleRate (44100|48000),
   startSec/endSec (khoảnh đoạn). */
async function extractAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const fmt = String(o.format || 'mp3').toLowerCase();
  if (!['mp3', 'm4a', 'wav', 'flac'].includes(fmt)) { const e = new Error('FFX_FORMAT: định dạng âm thanh không hỗ trợ — ' + fmt); e.code = 'FFX_FORMAT'; throw e; }

  let args = ['-y'];
  if (o.smart && fmt === 'm4a') {
    // Smart copy: chỉ khi nguồn thật sự là AAC (probe — không đoán đuôi file)
    const info = await probeStreams(o.inputPath);
    if (info.audioTracks.length && info.audioTracks[0].codec === 'aac') {
      args.push('-map', '0:a:0', '-c:a', 'copy', o.outputPath);
      await spawnRun(FFMPEG, args, {});
      return { ok: true, path: o.outputPath, smartCopy: true };
    }
  }
  if (Number.isFinite(Number(o.startSec)) && Number(o.startSec) > 0) args.push('-ss', String(Number(o.startSec)));
  args.push('-i', o.inputPath);
  const s = Number(o.startSec) || 0;
  const e2 = Number(o.endSec);
  if (Number.isFinite(e2) && e2 > s) args.push('-t', String(e2 - s));
  args.push('-vn');
  if (fmt === 'wav') args.push('-c:a', 'pcm_s16le');
  else if (fmt === 'flac') args.push('-c:a', 'flac');
  else if (fmt === 'm4a') args.push('-c:a', 'aac', '-b:a', validBitrate(o.bitrate));
  else args.push('-c:a', 'libmp3lame', '-b:a', validBitrate(o.bitrate));
  const filters = [];
  if (o.loudnorm) filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  if (o.channels === 'mono') filters.push('pan=mono|c0=c0');
  else if (o.channels === 'stereo') filters.push('pan=stereo|c0=c0|c1=c1');
  if (filters.length) args.push('-af', filters.join(','));
  if (o.sampleRate === 44100 || o.sampleRate === 48000) args.push('-ar', String(o.sampleRate));
  else if (o.loudnorm) args.push('-ar', '48000');   // loudnorm ép 192kHz — cần hạ về 48k
  args.push(o.outputPath);
  const total = await probeDur(o.inputPath);
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* Tham số video cho chế độ cắt chính xác (CPU h264 — đoạn ngắn nên đủ nhanh). */
function accurateVideoArgs(crf) {
  return ['-c:v', 'libx264', '-crf', String(Number.isFinite(Number(crf)) ? Number(crf) : 20), '-preset', 'fast'];
}

/* Cắt 1 đoạn: mode 'copy' (tại keyframe — nhanh) | 'accurate' (re-encode đúng frame + fade tuỳ chọn). */
async function cutVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const s = num(o.startSec, 'FFX_START');
  const e2 = num(o.endSec, 'FFX_END');
  if (s < 0) { const e = new Error('FFX_START: giây bắt đầu phải ≥ 0'); e.code = 'FFX_START'; throw e; }
  if (e2 <= s) { const e = new Error('FFX_RANGE: giây kết thúc phải LỚN HƠN giây bắt đầu'); e.code = 'FFX_RANGE'; throw e; }
  const len = e2 - s;
  if (o.mode === 'accurate') {
    const fade = Number(o.fade) || 0;
    if (fade > 0 && fade >= len / 2) { const e = new Error('FFX_FADE: fade phải nhỏ hơn một nửa độ dài đoạn'); e.code = 'FFX_FADE'; throw e; }
    const args = ['-y', '-ss', String(s), '-i', o.inputPath, '-t', String(len)];
    if (fade > 0) {
      args.push('-vf', 'fade=t=in:st=0:d=' + fade + ',fade=t=out:st=' + (len - fade) + ':d=' + fade);
      args.push('-af', 'afade=t=in:st=0:d=' + fade + ',afade=t=out:st=' + (len - fade) + ':d=' + fade);
    }
    args.push(...accurateVideoArgs(), '-c:a', 'aac', '-b:a', '192k', o.outputPath);
    await spawnRun(FFMPEG, args, { totalSec: len });
    return { ok: true, path: o.outputPath, mode: 'accurate' };
  }
  await spawnRun(FFMPEG,
    ['-y', '-ss', String(s), '-to', String(e2), '-i', o.inputPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', o.outputPath],
    { totalSec: len });
  return { ok: true, path: o.outputPath, mode: 'copy' };
}

/* Cắt N đoạn rồi tự ghép thành 1 file (multi-segment). */
async function cutMulti(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const segs = Array.isArray(o.segments) ? o.segments : [];
  if (segs.length < 1) { const e = new Error('FFX_SEGMENTS: cần ít nhất 1 đoạn cắt'); e.code = 'FFX_SEGMENTS'; throw e; }
  const mode = o.mode === 'accurate' ? 'accurate' : 'copy';
  const tmp = tempDir('ffx-cut');
  try {
    const parts = [];
    const dur = await probeDur(o.inputPath);
    for (let i = 0; i < segs.length; i++) {
      const part = path.join(tmp, 'seg-' + i + '.mp4');
      const base = Math.round((i / segs.length) * 100);
      const span = Math.round(100 / segs.length);
      const onProg = o.onProgress ? (p) => o.onProgress({ pct: Math.min(99, base + Math.round((p.pct || 0) / 100 * span)), fps: p.fps, speed: p.speed }) : null;
      await cutVideo({ inputPath: o.inputPath, outputPath: part, startSec: segs[i].startSec, endSec: segs[i].endSec, mode, onProgress: onProg || undefined });
      parts.push(part);
    }
    const listPath = path.join(tmp, 'list.txt');
    fs.writeFileSync(listPath, parts.map((p) => "file '" + p.replace(/'/g, "'\\''") + "'").join('\n'), 'utf8');
    const totalOut = segs.reduce((acc, sg) => acc + (num(sg.endSec, 'FFX_END') - num(sg.startSec, 'FFX_START')), 0);
    await spawnRun(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', o.outputPath], { totalSec: dur > 0 ? totalOut : 0 });
    return { ok: true, path: o.outputPath, segments: segs.length };
  } finally { cleanupDir(tmp); }
}

/* Dò cảnh chuyển (scene detection): trả danh sách thời điểm (giây) — KHÔNG ghi file. */
async function detectScenes(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  const th = Number(o.threshold);
  const t = Number.isFinite(th) && th > 0 && th < 1 ? th : 0.3;
  const dur = await probeDur(o.inputPath);
  const args = ['-y', '-i', o.inputPath, '-vf', "select='gt(scene," + t + ")',showinfo", '-f', 'null', (process.platform === 'win32' ? 'NUL' : os.devNull)];
  const log = await spawnRun(FFMPEG, args, { totalSec: dur });
  const times = [0];
  const re = /pts_time:([0-9]+(?:\.[0-9]+)?)/g;
  let m;
  while ((m = re.exec(log)) !== null) {
    const t2 = Number(m[1]);
    if (Number.isFinite(t2) && t2 > 0 && times[times.length - 1] !== t2) times.push(t2);
  }
  return { ok: true, times, threshold: t };
}

/* Ghi file concat list (chuỗi đường dẫn) — dùng chung bởi ghép/pingpong. */
function writeConcatList(listPath, paths) {
  fs.writeFileSync(listPath, paths.map((p) => "file '" + String(p).replace(/'/g, "'\\''") + "'").join('\n'), 'utf8');
}

/* Đối chiếu thông số kỹ thuật các clip: trả về danh sách điểm KHÁC nhau
   (codec video / kích thước / fps / codec âm thanh). Nguồn chân lý duy nhất
   cho cả concatVideos (chặn sớm lỗi) lẫn concatAuto (quyết định re-encode). */
function concatParamDiffs(infos) {
  const vids = infos.map((i) => i.video);
  const diffs = [];
  if (vids.some((v) => v.codec !== vids[0].codec)) diffs.push('codec video (' + vids.map((v) => v.codec).join(', ') + ')');
  if (vids.some((v) => v.width !== vids[0].width || v.height !== vids[0].height)) diffs.push('kích thước (' + vids.map((v) => v.width + 'x' + v.height).join(', ') + ')');
  if (vids.some((v) => Math.abs((v.fps || 0) - (vids[0].fps || 0)) >= 0.05)) diffs.push('fps (' + vids.map((v) => v.fps).join(', ') + ')');
  const acodecs = infos.map((i) => (i.audioTracks.length ? i.audioTracks[0].codec : 'không có âm thanh'));
  if (acodecs.some((c) => c !== acodecs[0])) diffs.push('codec âm thanh (' + acodecs.join(', ') + ')');
  return diffs;
}

/* ── 3a) Ghép copy (clip cùng chuẩn) ── */
async function concatVideos(opts) {
  const o = opts || {};
  if (!Array.isArray(o.inputPaths) || o.inputPaths.length < 2) {
    const e = new Error('FFX_INPUTS: cần ít nhất 2 video để ghép'); e.code = 'FFX_INPUTS'; throw e;
  }
  o.inputPaths.forEach((p) => assertInput(p, 'FFX_INPUTS'));
  assertOutput(o.outputPath);
  // Chặn sớm (Luật 10): concat copy-mode yêu cầu các clip CÙNG chuẩn. Khác chuẩn
  // → fail lộ liễu kèm chi tiết thay vì xuất file lỗi (âm thanh lệch/lặp khung).
  const infos = [];
  for (const p of o.inputPaths) infos.push(await probeStreams(p));
  if (infos.some((i) => !i.video)) { const e = new Error('FFX_VIDEO_ONLY: có file không chứa video — ghép copy chỉ nhận video'); e.code = 'FFX_VIDEO_ONLY'; throw e; }
  const diffs = concatParamDiffs(infos);
  if (diffs.length) {
    const e = new Error('FFX_JOIN_MISMATCH: các clip KHÔNG cùng chuẩn — ' + diffs.join('; ') + '. Chuyển sang chế độ "Auto-hoà chuẩn" để tự re-encode về chung một chuẩn.');
    e.code = 'FFX_JOIN_MISMATCH'; e.details = diffs; throw e;
  }
  let total = 0;
  for (const p of o.inputPaths) total += await probeDur(p);
  const listPath = path.join(os.tmpdir(), 'ffx-concat-' + Date.now() + '.txt');
  writeConcatList(listPath, o.inputPaths);
  try {
    await spawnRun(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', o.outputPath], { totalSec: total });
  } finally { try { fs.unlinkSync(listPath); } catch (_) { /* tạm */ } }
  return { ok: true, path: o.outputPath };
}

/* ── 3b) Ghép auto-hoà: probe các clip — cùng chuẩn thì concat copy, khác chuẩn thì
   tự re-encode về chuẩn chung (chiều cao nhỏ nhất — không upscale, fps nhỏ nhất) rồi ghép. */
async function concatAuto(opts) {
  const o = opts || {};
  if (!Array.isArray(o.inputPaths) || o.inputPaths.length < 2) {
    const e = new Error('FFX_INPUTS: cần ít nhất 2 video để ghép'); e.code = 'FFX_INPUTS'; throw e;
  }
  o.inputPaths.forEach((p) => assertInput(p, 'FFX_INPUTS'));
  assertOutput(o.outputPath);
  const infos = [];
  for (const p of o.inputPaths) infos.push(await probeStreams(p));
  const vids = infos.map((i) => i.video);
  if (vids.some((v) => !v)) { const e = new Error('FFX_VIDEO_ONLY: có file không chứa video'); e.code = 'FFX_VIDEO_ONLY'; throw e; }
  // Tiêu chí "cùng chuẩn" dùng chung concatParamDiffs với concatVideos — không nhân bản logic.
  const same = concatParamDiffs(infos).length === 0;
  if (same) return concatVideos({ inputPaths: o.inputPaths, outputPath: o.outputPath, onProgress: o.onProgress });

  // Khác chuẩn → chuẩn hoá từng clip về: H = chiều cao nhỏ nhất, fps = fps nhỏ nhất, h264 crf 23
  const heights = vids.map((v) => v.height).filter((h) => h > 0);
  const fpss = vids.map((v) => v.fps).filter((f) => f > 0);
  const H = heights.length ? Math.min(...heights) : 720;
  const F = fpss.length ? Math.min(...fpss) : 30;
  const tmp = tempDir('ffx-norm');
  try {
    const norm = [];
    const span = 100 / o.inputPaths.length;
    for (let i = 0; i < o.inputPaths.length; i++) {
      const part = path.join(tmp, 'norm-' + i + '.mp4');
      const base = Math.round(i * span);
      const onProg = o.onProgress ? (p) => o.onProgress({ pct: Math.min(99, base + Math.round((p.pct || 0) / 100 * span)), fps: p.fps, speed: p.speed }) : null;
      await spawnRun(FFMPEG, ['-y', '-i', o.inputPaths[i],
        '-vf', 'scale=-2:' + H + ',setsar=1,fps=' + F + ',format=yuv420p',
        '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', part], { onProgress });
      norm.push(part);
    }
    const listPath = path.join(tmp, 'list.txt');
    writeConcatList(listPath, norm);
    const dur = infos.reduce((a, i) => a + i.durationSec, 0);
    await spawnRun(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', o.outputPath], { totalSec: dur });
    return { ok: true, path: o.outputPath, normalized: true, height: H, fps: F };
  } finally { cleanupDir(tmp); }
}

/* ── 3c) Ghép có transition (xfade giữa các clip, re-encode) ──
   transition: fade|wipeleft|wiperight|slideleft|slideright|circleopen|circleclose|smoothleft|smoothright|dissolve|pixelize|radial */
const XFADE_LIST = ['fade', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleopen', 'circleclose', 'smoothleft', 'smoothright', 'dissolve', 'pixelize', 'radial'];

async function concatTransition(opts) {
  const o = opts || {};
  if (!Array.isArray(o.inputPaths) || o.inputPaths.length < 2) {
    const e = new Error('FFX_INPUTS: cần ít nhất 2 video để ghép'); e.code = 'FFX_INPUTS'; throw e;
  }
  o.inputPaths.forEach((p) => assertInput(p, 'FFX_INPUTS'));
  assertOutput(o.outputPath);
  const tr = String(o.transition || 'fade');
  if (!XFADE_LIST.includes(tr)) { const e = new Error('FFX_TRANSITION: kiểu chuyển cảnh không hỗ trợ — ' + tr); e.code = 'FFX_TRANSITION'; throw e; }
  const fade = Number(o.fadeDur) > 0 ? Number(o.fadeDur) : 0.5;
  const infos = [];
  for (const p of o.inputPaths) infos.push(await probeStreams(p));
  const durs = infos.map((i) => i.durationSec);
  if (durs.some((d) => d <= 0)) { const e = new Error('FFX_DURATION: không đo được thời lượng một clip'); e.code = 'FFX_DURATION'; throw e; }
  if (durs.some((d) => fade >= d / 2)) { const e = new Error('FFX_FADE: thời lượng transition phải nhỏ hơn một nửa clip ngắn nhất'); e.code = 'FFX_FADE'; throw e; }
  const heights = infos.map((i) => i.video && i.video.height).filter((h) => h > 0);
  const fpss = infos.map((i) => i.video && i.video.fps).filter((f) => f > 0);
  const H = heights.length ? Math.min(...heights) : 720;
  const F = fpss.length ? Math.min(...fpss) : 30;
  const n = o.inputPaths.length;
  const args = ['-y'];
  for (const p of o.inputPaths) args.push('-i', p);
  const chains = [];
  for (let i = 0; i < n; i++) chains.push('[' + i + ':v]scale=-2:' + H + ',setsar=1,fps=' + F + ',format=yuv420p[v' + i + ']');
  let prev = 'v0';
  let off = 0;
  for (let i = 1; i < n; i++) {
    off = off + durs[i - 1] - fade;
    const out = i < n - 1 ? 'x' + i : 'vx';
    chains.push('[' + prev + '][v' + i + ']xfade=transition=' + tr + ':duration=' + fade + ':offset=' + off.toFixed(3) + '[' + out + ']');
    prev = out;
  }
  const allAudio = infos.every((i) => i.audioTracks.length > 0);
  let aout = null;
  if (allAudio) {
    let aprev = '0:a';
    for (let i = 1; i < n; i++) {
      const ax = i < n - 1 ? 'a' + i : 'ax';
      chains.push('[' + aprev + '][' + i + ':a]acrossfade=d=' + fade + '[' + ax + ']');
      aprev = ax;
    }
    aout = aprev;
  }
  const total = durs.reduce((a, d) => a + d, 0) - (n - 1) * fade;
  args.push('-filter_complex', chains.join(';'));
  args.push('-map', '[vx]');
  if (aout) args.push('-map', '[' + aout + ']');
  args.push('-c:v', 'libx264', '-crf', '20', '-preset', 'fast');
  if (aout) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push(o.outputPath);
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath, transition: tr, fade: fade, clips: n };
}

/* ── 4) Loop: mode 'times' (N lần) | 'total' (tổng thời lượng mục tiêu) — copy stream ── */
async function loopVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const dur = await probeDur(o.inputPath);
  let n;
  if (o.mode === 'total') {
    const target = num(o.targetSec, 'FFX_TARGET');
    if (target <= 0) { const e = new Error('FFX_TARGET: thời lượng mục tiêu phải > 0'); e.code = 'FFX_TARGET'; throw e; }
    if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng video nguồn'); e.code = 'FFX_DURATION'; throw e; }
    n = Math.max(2, Math.ceil(target / dur));
  } else {
    n = num(o.times, 'FFX_TIMES');
    if (!(n >= 2) || Math.floor(n) !== n) { const e = new Error('FFX_TIMES: số lần lặp phải là số nguyên ≥ 2'); e.code = 'FFX_TIMES'; throw e; }
  }
  await spawnRun(FFMPEG, ['-y', '-stream_loop', String(n - 1), '-i', o.inputPath, '-c', 'copy', o.outputPath], { totalSec: dur * n });
  return { ok: true, path: o.outputPath, times: n };
}

/* ── 4b) Ping-pong loop (xuôi + ngược xen kẽ — không giật ở điểm nối). Video only.
   Giới hạn: clip ≤ 120s (filter reverse giữ video trong RAM). ── */
async function loopPingPong(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const n = num(o.times, 'FFX_TIMES');
  if (!(n >= 2) || Math.floor(n) !== n) { const e = new Error('FFX_TIMES: số đoạn phải là số nguyên ≥ 2'); e.code = 'FFX_TIMES'; throw e; }
  const dur = await probeDur(o.inputPath);
  if (dur > 120) { const e = new Error('FFX_PINGPONG_LONG: ping-pong chỉ phù hợp clip ngắn (≤ 120 giây) — clip này ' + Math.round(dur) + 's'); e.code = 'FFX_PINGPONG_LONG'; throw e; }
  const tmp = tempDir('ffx-pp');
  try {
    const rev = path.join(tmp, 'rev.mp4');
    await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-vf', 'reverse', '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', rev], { totalSec: dur });
    const seq = [];
    for (let i = 0; i < n; i++) seq.push(i % 2 === 0 ? o.inputPath : rev);
    const listPath = path.join(tmp, 'list.txt');
    writeConcatList(listPath, seq);
    await spawnRun(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-an', o.outputPath], { totalSec: dur * n });
    return { ok: true, path: o.outputPath, times: n, mode: 'pingpong' };
  } finally { cleanupDir(tmp); }
}

/* ── 4c) Crossfade loop — N bản ghép với xfade giữa các vòng (re-encode). times ≤ 20. ── */
async function loopCrossfade(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const n = num(o.times, 'FFX_TIMES');
  if (!(n >= 2) || Math.floor(n) !== n) { const e = new Error('FFX_TIMES: số vòng phải là số nguyên ≥ 2'); e.code = 'FFX_TIMES'; throw e; }
  if (n > 20) { const e = new Error('FFX_TIMES_TOO_MANY: crossfade loop giới hạn ≤ 20 vòng'); e.code = 'FFX_TIMES_TOO_MANY'; throw e; }
  const fade = Number(o.fadeDur) > 0 ? Number(o.fadeDur) : 0.5;
  const dur = await probeDur(o.inputPath);
  if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng video nguồn'); e.code = 'FFX_DURATION'; throw e; }
  if (fade >= dur / 2) { const e = new Error('FFX_FADE: fade phải nhỏ hơn một nửa độ dài clip'); e.code = 'FFX_FADE'; throw e; }
  const args = ['-y'];
  for (let i = 0; i < n; i++) args.push('-i', o.inputPath);
  const chains = [];
  for (let i = 0; i < n; i++) chains.push('[' + i + ':v]format=yuv420p[v' + i + ']');
  let prev = 'v0';
  for (let i = 1; i < n; i++) {
    const out = i < n - 1 ? 'x' + i : 'vx';
    chains.push('[' + prev + '][v' + i + ']xfade=transition=fade:duration=' + fade + ':offset=' + (i * (dur - fade)).toFixed(3) + '[' + out + ']');
    prev = out;
  }
  let aout = null;
  const hasAudio = (await probeStreams(o.inputPath)).audioTracks.length > 0;
  if (hasAudio) {
    let aprev = '0:a';
    for (let i = 1; i < n; i++) {
      const ax = i < n - 1 ? 'a' + i : 'ax';
      chains.push('[' + aprev + '][' + i + ':a]acrossfade=d=' + fade + '[' + ax + ']');
      aprev = ax;
    }
    aout = aprev;
  }
  args.push('-filter_complex', chains.join(';'), '-map', '[vx]');
  if (aout) args.push('-map', '[' + aout + ']', '-c:a', 'aac', '-b:a', '192k');
  else args.push('-an');
  args.push('-c:v', 'libx264', '-crf', '20', '-preset', 'fast', o.outputPath);
  await spawnRun(FFMPEG, args, { totalSec: n * dur - (n - 1) * fade });
  return { ok: true, path: o.outputPath, times: n, mode: 'crossfade' };
}

/* ── 4d) Loop nhạc/âm thanh — lặp đến đủ targetSec hoặc N lần (nhạc nền dài). ── */
async function loopAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const dur = await probeDur(o.inputPath);
  if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng âm thanh nguồn'); e.code = 'FFX_DURATION'; throw e; }
  let n, total;
  if (o.targetSec !== undefined && o.targetSec !== null && o.targetSec !== '') {
    const target = num(o.targetSec, 'FFX_TARGET');
    if (target <= 0) { const e = new Error('FFX_TARGET: thời lượng mục tiêu phải > 0'); e.code = 'FFX_TARGET'; throw e; }
    n = Math.max(1, Math.ceil(target / dur));
    total = target;
  } else {
    n = num(o.times, 'FFX_TIMES');
    if (!(n >= 1) || Math.floor(n) !== n) { const e = new Error('FFX_TIMES: số lần lặp phải là số nguyên ≥ 1'); e.code = 'FFX_TIMES'; throw e; }
    total = dur * n;
  }
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  const codecArgs = ext === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '192k']
    : ext === 'm4a' ? ['-c:a', 'aac', '-b:a', '192k']
    : ext === 'wav' ? ['-c:a', 'pcm_s16le']
    : ext === 'flac' ? ['-c:a', 'flac']
    : null;
  if (!codecArgs) { const e = new Error('FFX_FORMAT: đích loop nhạc chỉ hỗ trợ mp3/m4a/wav/flac — .' + ext); e.code = 'FFX_FORMAT'; throw e; }
  const args = ['-y', '-stream_loop', String(n - 1), '-i', o.inputPath].concat(codecArgs);
  if (o.targetSec !== undefined && o.targetSec !== null && o.targetSec !== '') args.push('-t', String(num(o.targetSec, 'FFX_TARGET')));
  args.push(o.outputPath);
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath, times: n };
}

/* ── 5) Nén video ──
   mode 'crf': crf + useGpu (nvenc/qsv/amf — dò thật qua gpu-encoder)
   mode 'size': targetMB → 2-pass CPU chính xác (GPU không hỗ trợ multipass). */
async function compressVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const dur = await probeDur(o.inputPath);
  const crf = Number.isFinite(Number(o.crf)) ? Number(o.crf) : 28;
  if (crf < 14 || crf > 40) { const e = new Error('FFX_CRF: CRF phải trong khoảng 14–40'); e.code = 'FFX_CRF'; throw e; }
  // Giới hạn chiều cao (preset nền tảng) — 0/bỏ trống = giữ nguyên.
  const mh = Number(o.maxHeight) || 0;
  if (mh !== 0 && (mh < 144 || mh > 2160)) { const e = new Error('FFX_HEIGHT: chiều cao phải 144–2160 (0 = giữ nguyên)'); e.code = 'FFX_HEIGHT'; throw e; }
  const scaleArgs = mh > 0 ? ['-vf', 'scale=-2:' + mh] : [];
  if (o.mode === 'size') {
    const mb = num(o.targetMB, 'FFX_TARGET');
    if (mb < 1) { const e = new Error('FFX_TARGET: dung lượng mục tiêu phải ≥ 1 MB'); e.code = 'FFX_TARGET'; throw e; }
    if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng — 2-pass cần duration'); e.code = 'FFX_DURATION'; throw e; }
    const audioK = 128;
    const bitK = Math.max(100, Math.floor((mb * 8192) / dur) - audioK);
    const passStamp = 'ffx-pass-' + Date.now();
    const passLog = path.join(os.tmpdir(), passStamp);
    const base = ['-y', '-i', o.inputPath].concat(scaleArgs, ['-c:v', 'libx264', '-b:v', bitK + 'k', '-preset', 'fast', '-pix_fmt', 'yuv420p']);
    try {
      await spawnRun(FFMPEG, base.concat(['-pass', '1', '-passlogfile', passLog, '-an', '-f', 'null', (process.platform === 'win32' ? 'NUL' : os.devNull)]),
        { totalSec: dur, onProgress: o.onProgress ? (p) => o.onProgress({ pct: Math.round((p.pct || 0) / 2), fps: p.fps, speed: p.speed }) : undefined });
      await spawnRun(FFMPEG, base.concat(['-pass', '2', '-passlogfile', passLog, '-c:a', 'aac', '-b:a', audioK + 'k', o.outputPath]),
        { totalSec: dur, onProgress: o.onProgress ? (p) => o.onProgress({ pct: 50 + Math.round((p.pct || 0) / 2), fps: p.fps, speed: p.speed }) : undefined });
    } finally {
      try {
        for (const f of fs.readdirSync(os.tmpdir())) {
          if (f.indexOf(passStamp) === 0) { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch (_) { /* tạm */ } }
        }
      } catch (_) { /* tạm */ }
    }
    return { ok: true, path: o.outputPath, mode: 'size', targetMB: mb, bitrateK: bitK, twoPass: true };
  }
  const enc = o.useGpu ? gpuEncoder('h264') : null;
  const vArgs = enc ? ['-c:v', enc].concat(qualityArgs(enc, { crf })) : ['-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast'];
  await spawnRun(FFMPEG, ['-y', '-i', o.inputPath].concat(vArgs, scaleArgs, ['-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', o.outputPath]), { totalSec: dur });
  return { ok: true, path: o.outputPath, mode: 'crf', crf: crf, gpu: enc ? gpuLabel(enc) : null };
}

/* ── 6) Trích frame — 5 mode: every | single | count | scene | grid (+ timestamp) ── */
const FRAME_PREFIX = 'ffx-frame-';

/* drawtext timestamp góc frame — font Arial hệ thống (libfreetype luôn có trong build). */
function stampFilter() {
  const font = 'C\\:/Windows/Fonts/arial.ttf';
  if (!fs.existsSync('C:\\Windows\\Fonts\\arial.ttf')) { const e = new Error('FFX_FONT: không tìm thấy arial.ttf để đóng timestamp'); e.code = 'FFX_FONT'; throw e; }
  return "drawtext=text='%{pts\\:hms}':fontfile='" + font + "':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10";
}

async function extractFrames(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  const fmt = String(o.format || 'png').toLowerCase();
  if (fmt !== 'png' && fmt !== 'jpg') { const e = new Error('FFX_FORMAT: chỉ hỗ trợ png/jpg'); e.code = 'FFX_FORMAT'; throw e; }
  if (!o.outputDir || typeof o.outputDir !== 'string') { const e = new Error('FFX_OUTDIR: thiếu thư mục lưu ảnh'); e.code = 'FFX_OUTDIR'; throw e; }
  fs.mkdirSync(o.outputDir, { recursive: true });
  const dur = await probeDur(o.inputPath);
  const stamp = o.stamp ? stampFilter() : null;
  const withStamp = (vf) => (stamp ? stamp + ',' + vf : vf);

  if (o.mode === 'single') {
    const s = num(o.atSec, 'FFX_AT');
    if (s < 0) { const e = new Error('FFX_AT: giây trích phải ≥ 0'); e.code = 'FFX_AT'; throw e; }
    const vf = withStamp('null');
    const args = ['-y', '-ss', String(s), '-i', o.inputPath, '-frames:v', '1'];
    if (o.stamp) args.push('-vf', vf);
    args.push(path.join(o.outputDir, FRAME_PREFIX + '0.' + fmt));
    await spawnRun(FFMPEG, args, {});
    return { ok: true, path: path.join(o.outputDir, FRAME_PREFIX + '0.' + fmt), count: 1 };
  }

  if (o.mode === 'grid') {
    const cols = num(o.cols, 'FFX_COLS');
    if (!(cols >= 2 && cols <= 10) || Math.floor(cols) !== cols) { const e = new Error('FFX_COLS: số cột lưới phải nguyên 2–10'); e.code = 'FFX_COLS'; throw e; }
    const count = num(o.count, 'FFX_COUNT');
    if (!(count >= 2 && count <= 100)) { const e = new Error('FFX_COUNT: số frame lưới phải 2–100'); e.code = 'FFX_COUNT'; throw e; }
    const rows = Math.ceil(count / cols);
    if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng'); e.code = 'FFX_DURATION'; throw e; }
    const rate = count / dur;
    let vf = 'fps=' + rate.toFixed(4) + ',scale=320:-1,tile=' + cols + 'x' + rows;
    if (o.stamp) vf = stamp + ',' + vf;
    const out = path.join(o.outputDir, 'ffx-grid.' + fmt);
    await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-vf', vf, '-frames:v', '1', out], { totalSec: dur });
    return { ok: true, path: out, count: count, mode: 'grid' };
  }

  let rate = null;
  if (o.mode === 'every') {
    const n = num(o.everySec, 'FFX_EVERY');
    if (!(n >= 0.1)) { const e = new Error('FFX_EVERY: khoảng cách giữa 2 frame phải ≥ 0.1 giây'); e.code = 'FFX_EVERY'; throw e; }
    rate = 1 / n;
  } else if (o.mode === 'count') {
    const n = num(o.count, 'FFX_COUNT');
    if (!(n >= 1) || Math.floor(n) !== n) { const e = new Error('FFX_COUNT: số frame phải nguyên ≥ 1'); e.code = 'FFX_COUNT'; throw e; }
    if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng'); e.code = 'FFX_DURATION'; throw e; }
    rate = n / dur;
  } else if (o.mode !== 'scene') {
    const e = new Error('FFX_MODE: chế độ trích frame không hỗ trợ — ' + o.mode); e.code = 'FFX_MODE'; throw e;
  }

  const outPattern = path.join(o.outputDir, FRAME_PREFIX + '%04d.' + fmt);
  if (o.mode === 'scene') {
    const th = Number(o.threshold);
    const t = Number.isFinite(th) && th > 0 && th < 1 ? th : 0.3;
    let vf = "select='gt(scene," + t + ")'";
    if (o.stamp) vf = stamp + ',' + vf;
    await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-vf', vf, '-vsync', 'vfr', outPattern], { totalSec: dur });
  } else {
    const vf = withStamp('fps=' + rate.toFixed(4));
    await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-vf', vf, outPattern], { totalSec: dur });
  }
  const count = fs.readdirSync(o.outputDir).filter((f) => f.indexOf(FRAME_PREFIX) === 0).length;
  return { ok: true, path: o.outputDir, count };
}

/* ── 7) Xoá tiếng — track 'all' | số track giữ lại; keepSubs giữ phụ đề mềm ── */
async function removeAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const total = await probeDur(o.inputPath);
  const subs = o.keepSubs === false ? [] : ['-map', '0:s?', '-c:s', 'copy'];
  // Chế độ "chỉ câm trong khoảng": video copy, audio re-encode aac với volume=0 trong window.
  const rs = Number(o.rangeStartSec);
  const re_ = Number(o.rangeEndSec);
  const hasRange = o.rangeStartSec !== undefined && o.rangeStartSec !== null && o.rangeStartSec !== ''
    && o.rangeEndSec !== undefined && o.rangeEndSec !== null && o.rangeEndSec !== '';
  if (hasRange && (!(rs >= 0) || !(re_ > rs))) {
    const e = new Error('FFX_RANGE: khoảng xoá tiếng không hợp lệ — cần 0 ≤ bắt đầu < kết thúc'); e.code = 'FFX_RANGE'; throw e;
  }
  let args;
  if (hasRange) {
    if (o.track !== undefined && o.track !== null && o.track !== '' && o.track !== 'all') {
      const e = new Error('FFX_TRACK: xoá theo khoảng chỉ áp dụng cho toàn bộ track — bỏ chọn track'); e.code = 'FFX_TRACK'; throw e;
    }
    const win = "volume=enable='between(t," + rs + "," + re_ + ")':volume=0";
    args = ['-y', '-i', o.inputPath, '-map', '0:v'].concat(subs, ['-c:v', 'copy', '-af', win, '-c:a', 'aac', '-b:a', '192k', o.outputPath]);
  } else if (o.track === 'all' || o.track === undefined || o.track === null || o.track === '') {
    args = ['-y', '-i', o.inputPath, '-map', '0:v'].concat(subs, ['-c:v', 'copy', '-an', o.outputPath]);
  } else {
    const idx = num(o.track, 'FFX_TRACK');
    const info = await probeStreams(o.inputPath);
    if (idx < 0 || idx >= info.audioTracks.length) {
      const e = new Error('FFX_TRACK: video chỉ có ' + info.audioTracks.length + ' track audio — không có track ' + idx); e.code = 'FFX_TRACK'; throw e;
    }
    args = ['-y', '-i', o.inputPath, '-map', '0:v', '-map', '0:a:' + idx].concat(subs, ['-c:v', 'copy', '-c:a', 'copy', o.outputPath]);
  }
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 8) Đổi định dạng — codec h264|h265 (GPU nếu có), giữ sub, scale/fps đích ── */
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
  else if (ext === 'flac') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'flac', o.outputPath];
  else if (ext === 'ogg') args = ['-y', '-i', o.inputPath, '-vn', '-c:a', 'libopus', '-b:a', '192k', o.outputPath];
  else if (ext === 'webm') {
    // VP9 CPU (không có GPU vp9 trong danh sách dò) — realtime deadline cho nhanh
    args = ['-y', '-i', o.inputPath, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '5', '-crf', '34', '-b:v', '0', '-c:a', 'libopus', o.outputPath];
  } else if (ext === 'mp4' || ext === 'mov' || ext === 'mkv') {
    const wantH265 = o.codec === 'h265';
    const enc = o.useGpu ? gpuEncoder(wantH265 ? 'h265' : 'h264') : null;
    const vArgs = enc
      ? ['-c:v', enc].concat(qualityArgs(enc, { crf: wantH265 ? 24 : 23 }))
      : (wantH265 ? ['-c:v', 'libx265', '-crf', '26', '-preset', 'fast'] : ['-c:v', 'libx264', '-crf', '23', '-preset', 'fast']);
    const vfParts = [];
    const h = Number(o.height) || 0;
    if (h > 0) vfParts.push('scale=-2:' + h);
    const f = Number(o.fps) || 0;
    if (f > 0) vfParts.push('fps=' + f);
    if (vfParts.length) vfParts.push('format=yuv420p');
    args = ['-y', '-i', o.inputPath, '-map', '0:v:0', '-map', '0:a:0?'];
    if (o.keepSubs && (ext === 'mkv' || ext === 'mp4' || ext === 'mov')) {
      args.push('-map', '0:s?');
      args.push('-c:s', ext === 'mkv' ? 'copy' : 'mov_text');
    }
    if (vfParts.length) args.push('-vf', vfParts.join(','));
    args = args.concat(vArgs, ['-c:a', 'aac', '-b:a', '192k', o.outputPath]);
  } else { const e = new Error('FFX_FORMAT: định dạng đích không hỗ trợ — ' + ext); e.code = 'FFX_FORMAT'; throw e; }
  await spawnRun(FFMPEG, args, { totalSec: total });
  return { ok: true, path: o.outputPath };
}

/* ── 9) Ghép nhạc — mix (volume 2 bên, offset, fade in/out, loop nhạc, loudnorm) | replace ── */
async function addMusic(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertInput(o.musicPath, 'FFX_MUSIC');
  assertOutput(o.outputPath);
  const m = String(o.mode || 'mix');
  if (m !== 'mix' && m !== 'replace') { const e = new Error('FFX_MUSIC_MODE: chế độ phải là mix hoặc replace'); e.code = 'FFX_MUSIC_MODE'; throw e; }
  const mv = num(o.musicVolume, 'FFX_MUSIC_VOL');
  if (mv < 0 || mv > 2) { const e = new Error('FFX_MUSIC_VOL: âm lượng nhạc phải 0–2'); e.code = 'FFX_MUSIC_VOL'; throw e; }
  const vv = Number.isFinite(Number(o.videoVolume)) ? Math.max(0, Math.min(2, Number(o.videoVolume))) : 1;
  const start = Number(o.musicStartSec) > 0 ? Number(o.musicStartSec) : 0;
  const fi = Number(o.fadeInSec) > 0 ? Number(o.fadeInSec) : 0;
  const fo = Number(o.fadeOutSec) > 0 ? Number(o.fadeOutSec) : 0;
  const vDur = await probeDur(o.inputPath);
  if (fo > 0 && vDur <= 0) { const e = new Error('FFX_FADE: fade-out cần biết thời lượng video'); e.code = 'FFX_FADE'; throw e; }
  const outFadeSt = fo > 0 ? Math.max(0, vDur - fo) : 0;
  const musicChainParts = [];
  if (o.normalizeMusic) musicChainParts.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  if (fi > 0) musicChainParts.push('afade=t=in:st=0:d=' + fi);
  if (fo > 0) musicChainParts.push('afade=t=out:st=' + outFadeSt + ':d=' + fo);
  // Vùng video nghe nhạc (tuỳ chọn): ngoài [playStartSec, playEndSec] nhạc bị câm.
  // Điền cả 2 = vùng [từ, đến]; chỉ điền Từ = từ đó đến hết video; chỉ điền Đến = lỗi lộ liễu.
  const hasPs = o.playStartSec !== undefined && o.playStartSec !== null && o.playStartSec !== '';
  const hasPe = o.playEndSec !== undefined && o.playEndSec !== null && o.playEndSec !== '';
  let ps = Number(o.playStartSec);
  let pe = hasPe ? Number(o.playEndSec) : vDur;
  if (hasPe && !hasPs) { const e = new Error('FFX_PLAY_RANGE: vùng nghe nhạc cần cả "Từ" và "Đến" (hoặc chỉ "Từ" = đến hết video)'); e.code = 'FFX_PLAY_RANGE'; throw e; }
  if (hasPs && (!(ps >= 0) || !(pe > ps) || !(vDur <= 0 || ps < vDur))) {
    const e = new Error('FFX_PLAY_RANGE: vùng nghe nhạc không hợp lệ — cần 0 ≤ bắt đầu < kết thúc ≤ thời lượng video'); e.code = 'FFX_PLAY_RANGE'; throw e;
  }
  if (hasPs) musicChainParts.push("volume=enable='between(t," + ps + "," + pe + ")':volume=0");
  const musicChain = musicChainParts.join(',');
  let args;
  if (m === 'replace') {
    args = ['-y', '-i', o.inputPath];
    if (o.loopMusic) args.push('-stream_loop', '-1');
    if (start > 0) args.push('-ss', String(start));
    args.push('-i', o.musicPath, '-map', '0:v', '-map', '1:a', '-shortest');
    const afParts = [];
    if (mv !== 1) afParts.push('volume=' + mv);
    if (musicChain) afParts.push(musicChain);
    if (afParts.length) args.push('-af', afParts.join(','));
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', o.outputPath);
  } else {
    args = ['-y', '-i', o.inputPath];
    if (o.loopMusic) args.push('-stream_loop', '-1');
    if (start > 0) args.push('-ss', String(start));
    args.push('-i', o.musicPath);
    const chains = [];
    if (musicChain) chains.push('[1:a]' + musicChain + '[m]');
    const mRef = musicChain ? 'm' : '1:a';
    chains.push('[0:a][' + mRef + ']amix=inputs=2:duration=first:weights=' + vv + ' ' + mv + '[aout]');
    args.push('-filter_complex', chains.join(';'), '-map', '0:v', '-map', '[aout]');
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', o.outputPath);
  }
  await spawnRun(FFMPEG, args, { totalSec: vDur });
  return { ok: true, path: o.outputPath, mode: m };
}

/* ── 10) Xuất GIF — loop N lần, palette max_colors, dithering, slideshow theo cảnh ── */
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
  const colors = [64, 128, 256].includes(Number(o.maxColors)) ? Number(o.maxColors) : 256;
  const dither = o.dither === 'bayer' ? 'bayer' : 'sierra2_4a';
  const chain = [];
  if (o.slideshow) chain.push("select='gt(scene,0.2)'");
  chain.push('fps=' + f);
  chain.push('scale=' + w + ':-1:flags=lanczos');
  const vf = chain.join(',') + ',split[s0][s1];[s0]palettegen=max_colors=' + colors + '[p];[s1][p]paletteuse=dither=' + dither + (dither === 'bayer' ? ':bayer_scale=4' : '');
  const loop = [0, -1].includes(Number(o.loopCount)) ? Number(o.loopCount) : (Number.isInteger(Number(o.loopCount)) && Number(o.loopCount) >= 1 ? Number(o.loopCount) : 0);
  const args = ['-y', '-ss', String(s), '-i', o.inputPath];
  if (dur > 0) args.push('-t', String(dur));
  args.push('-vf', vf, '-loop', String(loop), o.outputPath);
  await spawnRun(FFMPEG, args, { totalSec: dur > 0 ? dur : totalAll });
  return { ok: true, path: o.outputPath, loop: loop, colors: colors, dither: dither };
}

/* ── 10b) Thumbnail — trích 1 frame jpg cache theo đường dẫn (grid thẻ Ghép Video). ── */
async function makeThumb(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  const dir = path.join(os.tmpdir(), 'ffx-thumbs');
  fs.mkdirSync(dir, { recursive: true });
  const crypto = require('crypto');
  const key = crypto.createHash('md5').update(o.inputPath + '|' + String(o.atSec || 1)).digest('hex').slice(0, 20);
  const out = path.join(dir, key + '.jpg');
  if (!fs.existsSync(out)) {
    const at = Math.max(0, Number(o.atSec) || 1);
    await spawnRun(FFMPEG, ['-y', '-ss', String(at), '-i', o.inputPath, '-frames:v', '1', '-vf', 'scale=320:-2', out], { totalSec: 0 });
  }
  if (!fs.existsSync(out)) { const e = new Error('FFX_THUMB: không sinh được thumbnail — ' + o.inputPath); e.code = 'FFX_THUMB'; throw e; }
  return { ok: true, path: out };
}

/* ── 11) Shorts 9:16 — video ngang → dọc 1080x1920 (nền mờ blur-pad | cắt giữa) ── */
const SHORTS_W = 1080, SHORTS_H = 1920;

/* Bộ args encode H.264 dùng chung cho Shorts/burn-sub/fade (GPU nếu máy hỗ trợ, CRF 20). */
function shortsVArgs(useGpu) {
  const enc = useGpu ? gpuEncoder('h264') : null;
  return {
    args: enc ? ['-c:v', enc].concat(qualityArgs(enc, { crf: 20 })) : ['-c:v', 'libx264', '-crf', '20', '-preset', 'medium'],
    gpu: enc ? gpuLabel(enc) : null,
  };
}

async function shortsVideo(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  if (ext !== 'mp4' && ext !== 'mov') { const e = new Error('FFX_FORMAT: Shorts 9:16 chỉ xuất MP4/MOV — đích .' + ext); e.code = 'FFX_FORMAT'; throw e; }
  const mode = String(o.mode || 'blur');
  if (mode !== 'blur' && mode !== 'crop') { const e = new Error("FFX_SHORTS_MODE: chế độ phải là 'blur' (nền mờ) hoặc 'crop' (cắt giữa)"); e.code = 'FFX_SHORTS_MODE'; throw e; }
  const info = await probeStreams(o.inputPath);
  if (!info.video || !info.video.width || !info.video.height) {
    const e = new Error('FFX_INPUT: file không chứa video đọc được kích thước — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e;
  }
  const dur = info.durationSec;
  const vw = info.video.width, vh = info.video.height;
  let args;
  if (mode === 'crop') {
    let vf;
    if (vw / vh <= 9 / 16) {
      // Nguồn đã dọc ≤ 9:16 — cắt ngang sẽ mất nội dung → scale + pad viền (khai báo rõ, không ngầm).
      vf = 'scale=' + SHORTS_W + ':' + SHORTS_H + ':force_original_aspect_ratio=decrease,pad=' + SHORTS_W + ':' + SHORTS_H + ':(ow-iw)/2:(oh-ih)/2,format=yuv420p';
    } else {
      vf = 'crop=ih*9/16:ih,scale=' + SHORTS_W + ':' + SHORTS_H + ',format=yuv420p';
    }
    args = ['-y', '-i', o.inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf].concat(shortsVArgs(o.useGpu).args, shortsOutArgs(o));
  } else {
    // Nền mờ: phóng phủ khung 1080x1920 → blur + tối nhẹ làm nền, video gốc lồng giữa.
    // pushUp: đẩy nội dung lên ~1/4 khung — tránh vùng caption/nút UI mà TikTok/Shorts che ở đáy.
    const fc = '[0:v]split=2[bg][fg];' +
      '[bg]scale=' + SHORTS_W + ':' + SHORTS_H + ':force_original_aspect_ratio=increase,crop=' + SHORTS_W + ':' + SHORTS_H + ',boxblur=24:2,eq=brightness=-0.08[bgf];' +
      '[fg]scale=' + SHORTS_W + ':' + SHORTS_H + ':force_original_aspect_ratio=decrease[fgf];' +
      '[bgf][fgf]overlay=(W-w)/2:' + (o.pushUp ? '(H-h)*0.25' : '(H-h)/2') + ',format=yuv420p[v]';
    args = ['-y', '-i', o.inputPath, '-filter_complex', fc, '-map', '[v]', '-map', '0:a:0?'].concat(shortsVArgs(o.useGpu).args, shortsOutArgs(o));
  }
  await spawnRun(FFMPEG, args, { totalSec: dur });
  const warn = dur > 180 ? 'Video dài ' + Math.round(dur) + 's — quá 3 phút, YouTube có thể không tính là Shorts' : null;
  return { ok: true, path: o.outputPath, mode: mode, size: SHORTS_W + 'x' + SHORTS_H, warn: warn || undefined };
}

/* ── 12) Đóng phụ đề cứng (SRT/ASS) vào video ── */
function subsFilterPath(p) {
  // Path trong filter graph phải escape: \ → /, : → \:, ' → \', , ; [ ] → escaped, rồi bọc trong '…'
  return String(p)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function subStyleArgs(fontSize, color, pos) {
  const fsz = num(fontSize, 'FFX_SUB_SIZE');
  if (fsz < 10 || fsz > 72) { const e = new Error('FFX_SUB_SIZE: cỡ chữ phụ đề phải 10–72'); e.code = 'FFX_SUB_SIZE'; throw e; }
  const primary = color === 'yellow' ? '&H0000FFFF' : '&H00FFFFFF';
  // Alignment theo numpad ASS: 2 = đáy giữa, 5 = giữa màn hình, 8 = đỉnh giữa.
  const align = pos === 'middle' ? 'Alignment=5,MarginV=0' : pos === 'top' ? 'Alignment=8,MarginV=25' : 'Alignment=2,MarginV=25';
  return 'FontName=Arial,FontSize=' + fsz + ',PrimaryColour=' + primary + ',OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,' + align;
}

/* Filter `subtitles` chỉ đọc UTF-8: file UTF-16 (BOM) → convert sang file UTF-8 tạm (khai báo
   converted trong kết quả, xoá sau khi chạy); byte không hợp lệ UTF-8 → FFX_SUB_ENCODING lộ liễu (Luật 10). */
function subEncoding(p) {
  const buf = fs.readFileSync(p);
  if (buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff))) {
    const body = buf.subarray(2);
    if (buf[0] === 0xfe) { // UTF-16BE → đổi cặp byte thành LE để decode
      for (let i = 0; i + 1 < body.length; i += 2) { const t = body[i]; body[i] = body[i + 1]; body[i + 1] = t; }
    }
    const tmp = path.join(os.tmpdir(), 'ffx-sub-utf8-' + Date.now() + '-' + path.basename(p));
    fs.writeFileSync(tmp, '\ufeff' + body.toString('utf16le'), 'utf8');
    return { path: tmp, converted: true };
  }
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return { path: p, converted: false }; }
  catch (_) {
    const e = new Error("FFX_SUB_ENCODING: file phụ đề không phải UTF-8/UTF-16 — FFmpeg chỉ đọc được UTF-8 nên chữ sẽ hiển thị sai. Mở lại và lưu dạng 'UTF-8' (VS Code: góc dưới bên phải / Notepad: Save As → Encoding): " + p);
    e.code = 'FFX_SUB_ENCODING';
    throw e;
  }
}

function subVideoFilter(subPath, subExt, style) {
  const f = subsFilterPath(subPath);
  return subExt === 'ass' ? "subtitles='" + f + "'" : "subtitles='" + f + "':force_style='" + style + "'";
}

async function burnSubs(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertInput(o.subPath, 'FFX_SUB');
  assertOutput(o.outputPath);
  const subExt = path.extname(o.subPath).slice(1).toLowerCase();
  if (subExt !== 'srt' && subExt !== 'ass') { const e = new Error('FFX_FORMAT: file phụ đề phải .srt hoặc .ass — nhận .' + subExt); e.code = 'FFX_FORMAT'; throw e; }
  const fsz = num(o.fontSize, 'FFX_SUB_SIZE');
  if (fsz < 10 || fsz > 72) { const e = new Error('FFX_SUB_SIZE: cỡ chữ phụ đề phải 10–72'); e.code = 'FFX_SUB_SIZE'; throw e; }
  const info = await probeStreams(o.inputPath);
  if (!info.video) { const e = new Error('FFX_INPUT: file không chứa video — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e; }
  const enc = subEncoding(o.subPath);
  const vf = subVideoFilter(enc.path, subExt, subStyleArgs(fsz, o.color, o.pos));
  // Audio: copy khi codec copy-thẳng được; ngược lại re-encode AAC 192k (khai báo rõ trong kết quả).
  const codec = (info.audioTracks[0] || {}).codec || '';
  const copyable = ['aac', 'mp3', 'ac3', 'eac3', 'opus', 'flac'].indexOf(codec) >= 0;
  const v = shortsVArgs(o.useGpu);
  const args = ['-y', '-i', o.inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf]
    .concat(v.args)
    .concat(copyable ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k'])
    .concat(['-movflags', '+faststart', o.outputPath]);
  try {
    await spawnRun(FFMPEG, args, { totalSec: info.durationSec });
  } finally {
    if (enc.converted) { try { fs.unlinkSync(enc.path); } catch (_) { /* file tạm đã biến mất — không chặn kết quả */ } }
  }
  return { ok: true, path: o.outputPath, subExt: subExt, audio: copyable ? 'copy:' + codec : 'aac192', encoding: enc.converted ? 'utf16→utf8' : 'utf8' };
}

/* ── 12b) Xem thử phụ đề: render 1 khung hình (mặc định mốc 30% thời lượng) — không encode cả video ── */
async function previewBurnSubs(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertInput(o.subPath, 'FFX_SUB');
  const subExt = path.extname(o.subPath).slice(1).toLowerCase();
  if (subExt !== 'srt' && subExt !== 'ass') { const e = new Error('FFX_FORMAT: file phụ đề phải .srt hoặc .ass — nhận .' + subExt); e.code = 'FFX_FORMAT'; throw e; }
  const fsz = num(o.fontSize, 'FFX_SUB_SIZE');
  if (fsz < 10 || fsz > 72) { const e = new Error('FFX_SUB_SIZE: cỡ chữ phụ đề phải 10–72'); e.code = 'FFX_SUB_SIZE'; throw e; }
  const info = await probeStreams(o.inputPath);
  if (!info.video) { const e = new Error('FFX_INPUT: file không chứa video — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e; }
  let at = Number(o.atSec);
  if (!Number.isFinite(at) || at < 0) at = info.durationSec * 0.3;
  if (info.durationSec > 0 && at >= info.durationSec) at = info.durationSec / 2;
  const enc = subEncoding(o.subPath);
  const vf = subVideoFilter(enc.path, subExt, subStyleArgs(fsz, o.color, o.pos));
  const out = o.outputPath || path.join(os.tmpdir(), 'ffx-sub-preview-' + Date.now() + '.jpg');
  const args = ['-y', '-ss', at.toFixed(3), '-i', o.inputPath, '-vf', vf, '-frames:v', '1', '-q:v', '3', out];
  try {
    await spawnRun(FFMPEG, args, {});
  } finally {
    if (enc.converted) { try { fs.unlinkSync(enc.path); } catch (_) { /* file tạm đã biến mất — không chặn kết quả */ } }
  }
  return { ok: true, path: out, atSec: Math.round(at * 100) / 100 };
}

/* Args audio/faststart đích dùng chung cho Shorts (AAC 192k + moov lên đầu — chuẩn upload mạng xã hội). */
function shortsOutArgs(o) {
  return ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', o.outputPath];
}

/* ── 13) Faststart remux — chuyển moov atom lên đầu (copy toàn bộ stream, không re-encode) ── */
/* Quét top-level MP4/MOV atoms: moov đứng trước mdat → file đã faststart, không cần remux lại. */
function mp4MoovFirst(p) {
  const fd = fs.openSync(p, 'r');
  try {
    const st = fs.fstatSync(fd);
    const hdr = Buffer.alloc(16);
    let off = 0;
    while (off + 8 <= st.size) {
      if (fs.readSync(fd, hdr, 0, 8, off) < 8) return false;
      let size = hdr.readUInt32BE(0);
      const type = hdr.toString('ascii', 4, 8);
      let head = 8;
      if (size === 1) { // largesize 64-bit
        if (fs.readSync(fd, hdr, 0, 16, off) < 16) return false;
        size = Number(hdr.readBigUInt64BE(8));
        head = 16;
      } else if (size === 0) size = st.size - off; // atom kéo tới cuối file
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (size < head) return false; // cấu trúc lạ — coi như chưa faststart
      off += size;
    }
    return false;
  } finally { fs.closeSync(fd); }
}

async function faststartRemux(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  if (['mp4', 'm4a', 'mov'].indexOf(ext) < 0) {
    const e = new Error('FFX_FORMAT: faststart chỉ áp dụng cho MP4/M4A/MOV — đích .' + ext); e.code = 'FFX_FORMAT'; throw e;
  }
  const info = await probeStreams(o.inputPath);
  if (info.subCount > 0) {
    // Phụ đề mềm không copy thẳng sang MP4 được — không âm thầm drop dữ liệu (Luật 10).
    const e = new Error('FFX_SUBS: file có ' + info.subCount + ' track phụ đề mềm — faststart remux không giữ được; hãy burn cứng (Đóng Phụ Đề) hoặc Đổi Định Dạng trước'); e.code = 'FFX_SUBS'; throw e;
  }
  if (mp4MoovFirst(o.inputPath)) {
    // moov đã ở đầu — copy nguyên file sang đích, không remux lại vô ích (khai báo already).
    fs.copyFileSync(o.inputPath, o.outputPath);
    return { ok: true, path: o.outputPath, remux: false, already: true };
  }
  await spawnRun(FFMPEG, ['-y', '-i', o.inputPath, '-map', '0', '-c', 'copy', '-movflags', '+faststart', o.outputPath], { totalSec: info.durationSec });
  return { ok: true, path: o.outputPath, remux: true };
}

/* ── 14) Chuẩn hoá âm lượng EBU R128 — loudnorm 2-pass (pass 1 đo → pass 2 chỉnh tuyến tính) ── */
const NORM_EXT = ['mp3', 'm4a', 'wav', 'flac'];

function normCodecArgs(ext) {
  return ext === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '192k'] :
    ext === 'm4a' ? ['-c:a', 'aac', '-b:a', '192k'] :
      ext === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'flac'];
}

async function normalizeAudio(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const keepVideo = !!o.keepVideo;
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  const okExt = keepVideo ? ['mp4', 'mov'] : NORM_EXT;
  if (okExt.indexOf(ext) < 0) {
    const e = new Error('FFX_FORMAT: chuẩn hoá xuất MP3/M4A/WAV/FLAC' + (keepVideo ? ' — giữ video thì đích phải MP4/MOV' : '') + ' — đích .' + ext); e.code = 'FFX_FORMAT'; throw e;
  }
  const target = num(o.targetLU, 'FFX_TARGET_LU');
  if (target < -40 || target > -5) { const e = new Error('FFX_TARGET_LU: mục tiêu LUFS phải trong khoảng -40 … -5'); e.code = 'FFX_TARGET_LU'; throw e; }
  const info = await probeStreams(o.inputPath);
  if (!info.audioTracks.length) { const e = new Error('FFX_INPUT: file không có track âm thanh — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e; }
  const dur = info.durationSec;
  if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng nguồn'); e.code = 'FFX_DURATION'; throw e; }
  const nullDev = process.platform === 'win32' ? 'NUL' : os.devNull;
  // Pass 1: đo loudness → JSON trên stderr.
  const measured = await new Promise((resolve, reject) => {
    const cp = spawn(FFMPEG, ['-hide_banner', '-i', o.inputPath, '-vn', '-af',
      'loudnorm=I=' + target + ':TP=-1.5:LRA=11:print_format=json', '-f', 'null', nullDev], { windowsHide: true });
    let err = '';
    cp.stderr.on('data', (d) => { err += String(d); });
    cp.on('error', reject);
    cp.on('close', (code) => {
      if (code !== 0) { const e = new Error('FFX_LOUDNORM_MEASURE: pass đo âm lượng lỗi (' + code + '): ' + err.slice(-300)); e.code = 'FFX_LOUDNORM_MEASURE'; return reject(e); }
      const blocks = err.match(/\{[^{}]*\}/g) || [];
      for (let i = blocks.length - 1; i >= 0; i--) {
        try { const j = JSON.parse(blocks[i]); if (j.input_i !== undefined) return resolve(j); } catch (_) { /* khối JSON khác — bỏ qua */ }
      }
      const e = new Error('FFX_LOUDNORM_MEASURE: không đọc được kết quả đo loudnorm'); e.code = 'FFX_LOUDNORM_MEASURE'; reject(e);
    });
  });
  const mi = Number(measured.input_i), mtp = Number(measured.input_tp), mlra = Number(measured.input_lra), mth = Number(measured.input_thresh);
  const linear = [mi, mtp, mlra, mth].every(Number.isFinite) && mi > -70;
  let af;
  if (linear) {
    af = 'loudnorm=I=' + target + ':TP=-1.5:LRA=11:measured_I=' + measured.input_i + ':measured_TP=' + measured.input_tp +
      ':measured_LRA=' + measured.input_lra + ':measured_thresh=' + measured.input_thresh +
      (Number.isFinite(Number(measured.target_offset)) ? ':offset=' + measured.target_offset : '') + ':linear=true';
  } else {
    // Nguồn gần câm / số đo bất thường — 1 pass động (khai báo rõ trong kết quả, không ngầm).
    af = 'loudnorm=I=' + target + ':TP=-1.5:LRA=11';
  }
  let args;
  if (keepVideo) {
    // Giữ nguyên hình ảnh: copy stream video, chỉ encode lại âm thanh đã chuẩn hoá.
    args = ['-hide_banner', '-y', '-i', o.inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', '-af', af,
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', o.outputPath];
  } else {
    args = ['-hide_banner', '-y', '-i', o.inputPath, '-vn', '-af', af].concat(normCodecArgs(ext), [o.outputPath]);
  }
  await spawnRun(FFMPEG, args, { totalSec: dur });
  return {
    ok: true, path: o.outputPath, targetLU: target, linear: linear, keepVideo: keepVideo,
    measured: { inputI: Number.isFinite(mi) ? mi : null, inputTp: Number.isFinite(mtp) ? mtp : null, inputLra: Number.isFinite(mlra) ? mlra : null },
  };
}

/* ── 15) Bỏ lời / tách giọng thô — karaoke center-cancel (cần nguồn stereo) ── */
async function removeVocals(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  if (NORM_EXT.indexOf(ext) < 0) {
    const e = new Error('FFX_FORMAT: xuất MP3/M4A/WAV/FLAC — đích .' + ext); e.code = 'FFX_FORMAT'; throw e;
  }
  const mode = String(o.mode || 'instrumental');
  if (mode !== 'instrumental' && mode !== 'vocal') {
    const e = new Error("FFX_VOCAL_MODE: chế độ phải là 'instrumental' (bỏ lời giữ nhạc) hoặc 'vocal' (tách giọng thô)"); e.code = 'FFX_VOCAL_MODE'; throw e;
  }
  const info = await probeStreams(o.inputPath);
  if (!info.audioTracks.length) { const e = new Error('FFX_INPUT: file không có track âm thanh — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e; }
  const ch = info.audioTracks[0].channels;
  if (ch !== 2) {
    const e = new Error('FFX_CHANNELS: bỏ lời/tách giọng cần nguồn STEREO (2 kênh) — nguồn hiện tại ' + ch + ' kênh'); e.code = 'FFX_CHANNELS'; throw e;
  }
  // Tuỳ chọn chuẩn hoá ngay sau khi xử lý (1 pass động, cùng 1 lần chạy ffmpeg — không chạy 2 lần).
  let norm = null;
  if (o.normalizeLU !== undefined && o.normalizeLU !== null && o.normalizeLU !== '') {
    norm = num(o.normalizeLU, 'FFX_TARGET_LU');
    if (norm < -40 || norm > -5) { const e = new Error('FFX_TARGET_LU: mục tiêu LUFS phải trong khoảng -40 … -5'); e.code = 'FFX_TARGET_LU'; throw e; }
  }
  // instrumental: center-cancel bằng pan (L−R / R−L) — giọng hát thường nằm giữa 2 kênh nên bị triệt tiêu.
  // vocal (thô, heuristic): lấy kênh giữa + băng tần lời hát 200–3800 Hz — KHÔNG phải AI separation.
  const baseAf = mode === 'instrumental' ? 'pan=stereo|c0=c0-c1|c1=c1-c0' : 'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=200,lowpass=f=3800';
  const af = norm !== null ? baseAf + ',loudnorm=I=' + norm + ':TP=-1.5:LRA=11' : baseAf;
  await spawnRun(FFMPEG, ['-hide_banner', '-y', '-i', o.inputPath, '-vn', '-af', af].concat(normCodecArgs(ext), [o.outputPath]),
    { totalSec: info.durationSec });
  return { ok: true, path: o.outputPath, mode: mode, rough: mode === 'vocal', normalized: norm };
}

/* ── 16) Fade in/out video + audio (mở/khép màn hình và âm thanh) ── */
async function addFades(opts) {
  const o = opts || {};
  assertInput(o.inputPath, 'FFX_INPUT');
  assertOutput(o.outputPath);
  const ext = path.extname(o.outputPath).slice(1).toLowerCase();
  if (ext !== 'mp4' && ext !== 'mov') { const e = new Error('FFX_FORMAT: fade xuất MP4/MOV — đích .' + ext); e.code = 'FFX_FORMAT'; throw e; }
  const vi = Number(o.videoInSec) || 0, vo = Number(o.videoOutSec) || 0;
  const ai = Number(o.audioInSec) || 0, ao = Number(o.audioOutSec) || 0;
  const vals = [['video in', vi], ['video out', vo], ['audio in', ai], ['audio out', ao]];
  if (!vals.some((x) => x[1] > 0)) { const e = new Error('FFX_FADE: cần ít nhất 1 giá trị fade > 0'); e.code = 'FFX_FADE'; throw e; }
  for (const pair of vals) {
    if (pair[1] < 0 || pair[1] > 10) { const e = new Error('FFX_FADE: fade ' + pair[0] + ' phải trong khoảng 0–10 giây'); e.code = 'FFX_FADE'; throw e; }
  }
  const info = await probeStreams(o.inputPath);
  if (!info.video) { const e = new Error('FFX_INPUT: file không chứa video — ' + o.inputPath); e.code = 'FFX_INPUT'; throw e; }
  const dur = info.durationSec;
  if (dur <= 0) { const e = new Error('FFX_DURATION: không đo được thời lượng video'); e.code = 'FFX_DURATION'; throw e; }
  if ((vo > 0 && vo >= dur) || (ao > 0 && ao >= dur)) {
    const e = new Error('FFX_FADE: fade-out (' + Math.max(vo, ao) + 's) phải NHỎ HƠN thời lượng video (' + Math.round(dur) + 's)'); e.code = 'FFX_FADE'; throw e;
  }
  if ((ai > 0 || ao > 0) && !info.audioTracks.length) {
    const e = new Error('FFX_INPUT: video không có âm thanh — không fade audio được'); e.code = 'FFX_INPUT'; throw e;
  }
  const vfParts = [];
  if (vi > 0) vfParts.push('fade=t=in:st=0:d=' + vi);
  if (vo > 0) vfParts.push('fade=t=out:st=' + Math.max(0, dur - vo).toFixed(3) + ':d=' + vo);
  if (vi > 0 || vo > 0) vfParts.push('format=yuv420p');
  const v = shortsVArgs(o.useGpu);
  let args = ['-y', '-i', o.inputPath, '-map', '0:v:0', '-map', '0:a:0?'];
  if (vfParts.length) {
    args.push('-vf', vfParts.join(','));
    args = args.concat(v.args);
  } else {
    // Không có fade video → copy stream video, không re-encode vô ích.
    args.push('-c:v', 'copy');
  }
  if (ai > 0 || ao > 0) {
    const afParts = [];
    if (ai > 0) afParts.push('afade=t=in:st=0:d=' + ai);
    if (ao > 0) afParts.push('afade=t=out:st=' + Math.max(0, dur - ao).toFixed(3) + ':d=' + ao);
    args = args.concat(['-af', afParts.join(','), '-c:a', 'aac', '-b:a', '192k']);
  } else {
    args = args.concat(['-c:a', 'copy']);
  }
  args = args.concat(['-movflags', '+faststart', o.outputPath]);
  await spawnRun(FFMPEG, args, { totalSec: dur });
  return { ok: true, path: o.outputPath, fade: { videoIn: vi, videoOut: vo, audioIn: ai, audioOut: ao }, videoCopy: vfParts.length === 0 };
}

module.exports = {
  cancelRunning, probeMedia, probeStreams, detectScenes,
  extractAudio, cutVideo, cutMulti, concatVideos, concatAuto, concatTransition,
  loopVideo, loopPingPong, loopCrossfade, loopAudio, compressVideo,
  extractFrames, removeAudio, convertMedia, addMusic, toGif, makeThumb,
  shortsVideo, burnSubs, previewBurnSubs, faststartRemux, normalizeAudio, removeVocals, addFades,
};