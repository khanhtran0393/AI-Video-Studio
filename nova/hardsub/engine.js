'use strict';
/* ============================================================
   HARDSUB OCR — ENGINE (main process, orchestrate ffmpeg + python)
   ------------------------------------------------------------
   Bước 2 lộ trình ezmaxsub — trích SRT từ phụ đề chèn sẵn:
     video → ffmpeg trích khung vùng đáy khung (crop, fps lấy mẫu)
     → worker python `worker/hardsub_ocr.py` chạy RapidOCR
     (PP-OCR ONNX trong venv voice-backend/.venv-omni) → JSON
     per-frame → gộp cue (cues.js — hàm thuần) → cues.
   Khung ảnh lưu vào framesDir do caller cấp (userData tmp), tự
   dọn sau khi chạy (kể cả khi lỗi). Lỗi lộ liễu mã HS_* (Luật 10):
   thiếu video/python/ffmpeg, ffmpeg lỗi, worker lỗi, JSON sai —
   KHÔNG fallback ngầm. Cancel qua isCancelled() + onChild cho
   caller giữ handle kill tiến trình con.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG, probeDur } = require('../native-tools/ffmpeg');
const cues = require('./cues');

function errCode(code, msg, detail) {
  const e = new Error(code + ': ' + msg);
  e.code = code;
  if (detail) e.detail = String(detail).slice(-1500);
  return e;
}

/* ── Python của venv OmniVoice (đã chứa rapidocr + onnxruntime) ── */
function pythonExe() {
  let p = path.join(__dirname, '..', 'voice-backend', '.venv-omni', 'Scripts', 'python.exe');
  // app đóng gói: voice-backend được bung app.asar.unpacked để spawn được
  if (p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
  return p;
}

/* ── Đếm khung PNG hiện có (tiến độ giai đoạn trích khung) ── */
function countFrames(framesDir) {
  try { return fs.readdirSync(framesDir).filter((f) => /^frame_\d+\.png$/.test(f)).length; }
  catch (_) { return 0; }
}

function rmRf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

/* ── Pipeline chính. Trả { ok, cues, count, frameCount, sampleFps, bottomPct, model }. ── */
async function extract(opts = {}) {
  const videoPath = String(opts.videoPath || '').trim();
  const framesDir = String(opts.framesDir || '').trim();
  const sampleFps = opts.sampleFps != null ? Number(opts.sampleFps) : 2;
  const bottomPct = opts.bottomPct != null ? Number(opts.bottomPct) : 30;
  const startSec = Math.max(0, Number(opts.startSec) || 0);
  const endSec = opts.endSec != null ? Number(opts.endSec) : null;
  const minScore = opts.minScore != null ? Number(opts.minScore) : 0.5;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};
  const onChild = typeof opts.onChild === 'function' ? opts.onChild : () => {};
  const cancelled = typeof opts.isCancelled === 'function' ? opts.isCancelled : () => false;
  const keepFrames = !!opts.keepFrames;

  if (!videoPath) throw errCode('HS_NO_VIDEO', 'Thiếu đường dẫn video.');
  if (!framesDir) throw errCode('HS_NO_FRAMES_DIR', 'Thiếu thư mục làm việc (framesDir).');
  const vf = cues.cropFilter({ sampleFps, bottomPct }); // throw HS_FPS_INVALID / HS_REGION_INVALID — trước mọi IO
  if (!fs.existsSync(videoPath)) throw errCode('HS_NO_VIDEO', 'File video không tồn tại: ' + videoPath);
  if (!FFMPEG || !fs.existsSync(FFMPEG)) throw errCode('HS_NO_FFMPEG', 'Không tìm thấy FFmpeg binary.');
  const py = pythonExe();
  if (!fs.existsSync(py)) throw errCode('HS_NO_PYTHON', 'Không tìm thấy Python venv OmniVoice: ' + py + ' — chạy nova/voice-backend/setup-omni.bat.');

  rmRf(framesDir);
  fs.mkdirSync(framesDir, { recursive: true });
  const jsonPath = path.join(framesDir, 'ocr-result.json');

  try {
    return await runPipeline({
      videoPath, framesDir, jsonPath, vf, py, sampleFps, bottomPct, startSec, endSec,
      minScore, dur0: await probeDur(videoPath), onProgress, onChild, cancelled,
    });
  } finally {
    if (!keepFrames) rmRf(framesDir); // dọn rác khung ảnh tạm — cả khi lỗi
  }
}

/* ── 3 giai đoạn: ffmpeg trích khung (0–10%) → OCR (10–95%) → gộp (95–100%) ── */
async function runPipeline(ctx) {
  const { videoPath, framesDir, jsonPath, vf, py, sampleFps, bottomPct, startSec, endSec,
    minScore, dur0, onProgress, onChild, cancelled } = ctx;

  /* Giai đoạn 1 — ffmpeg trích khung vùng phụ đề */
  onProgress({ phase: 'extract', pct: 0, detail: 'Trích khung vùng phụ đề…' });
  const args = ['-y', '-hide_banner'];
  if (startSec > 0) args.push('-ss', String(startSec));
  args.push('-i', videoPath);
  if (endSec && endSec > startSec) args.push('-t', String(endSec - startSec));
  args.push('-vf', vf, '-start_number', '1', '-q:v', '2', path.join(framesDir, 'frame_%06d.png'));

  const ff = await new Promise((resolve, reject) => {
    const cp = spawn(FFMPEG, args, { windowsHide: true });
    onChild(cp);
    let err = '';
    cp.stderr.on('data', (d) => { err += String(d); });
    cp.on('error', (e) => reject(errCode('HS_FFMPEG', 'Không spawn được ffmpeg: ' + e.message)));
    cp.on('close', (code) => resolve({ code, err }));
  });
  if (cancelled()) throw errCode('HS_CANCELLED', 'Đã huỷ bởi người dùng.');
  if (ff.code !== 0) throw errCode('HS_FFMPEG', 'FFmpeg lỗi khi trích khung.', ff.err);
  const frameCount = countFrames(framesDir);
  if (!frameCount) throw errCode('HS_EMPTY_FRAMES', 'FFmpeg không trích được khung nào.');

  /* Giai đoạn 2 — OCR từng khung qua worker python (RapidOCR) */
  onProgress({ phase: 'ocr', pct: 10, detail: frameCount + ' khung — nhận diện chữ…' });
  const ocr = await new Promise((resolve, reject) => {
    const cp = spawn(py, [
      path.join(__dirname, 'worker', 'hardsub_ocr.py'),
      '--frames-dir', framesDir,
      '--out', jsonPath,
      '--min-score', String(minScore),
    ], { windowsHide: true });
    onChild(cp);
    let out = '', err = '';
    cp.stdout.on('data', (d) => {
      out += String(d);
      const m = String(d).match(/PROG (\d+)\/(\d+)/);
      if (m) {
        const pct = 10 + Math.round((Number(m[1]) / Math.max(1, Number(m[2]))) * 85);
        onProgress({ phase: 'ocr', pct, detail: 'OCR khung ' + m[1] + '/' + m[2] });
      }
    });
    cp.stderr.on('data', (d) => { err += String(d); });
    cp.on('error', (e) => reject(errCode('HS_OCR_SPAWN', 'Không spawn được python worker: ' + e.message)));
    cp.on('close', (code) => resolve({ code, out, err }));
  });
  if (cancelled()) throw errCode('HS_CANCELLED', 'Đã huỷ bởi người dùng.');
  if (ocr.code !== 0) {
    const code = /HS_OCR_MISSING/.test(ocr.err) ? 'HS_OCR_MISSING' : 'HS_OCR_FAIL';
    throw errCode(code, 'Worker OCR lỗi (exit ' + ocr.code + ').', ocr.err || ocr.out);
  }
  if (!fs.existsSync(jsonPath)) throw errCode('HS_OCR_FAIL', 'Worker không ghi file kết quả JSON.');

  /* Giai đoạn 3 — JSON → frames → gộp cue */
  onProgress({ phase: 'merge', pct: 95, detail: 'Gộp khung thành cue…' });
  let jsonObj;
  try { jsonObj = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
  catch (e) { throw errCode('HS_OCR_BADJSON', 'JSON worker không đọc được: ' + e.message); }
  const frames = cues.framesFromWorkerJson(jsonObj, { minScore });
  const endVideoMs = endSec && endSec > 0 ? Math.round(endSec * 1000) : (dur0 > 0 ? Math.round(dur0 * 1000) : null);
  const result = cues.cuesFromFrameTexts(frames, { sampleFps, startSec, endVideoMs });
  onProgress({ phase: 'done', pct: 100, detail: result.length + ' cue từ ' + frameCount + ' khung.' });
  return { ok: true, cues: result, count: result.length, frameCount, sampleFps, bottomPct, model: jsonObj.model || '' };
}

module.exports = { extract, pythonExe };