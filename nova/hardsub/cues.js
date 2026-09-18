'use strict';
/* ============================================================
   HARDSUB OCR — HÀM THUẦN (không Electron, không spawn tiến trình)
   ------------------------------------------------------------
   Bước 2 lộ trình ezmaxsub: trích SRT từ phụ đề chèn sẵn
   (hardsub) — recipe tham chiếu của D:\ezmaxsub: ffmpeg trích
   khung vùng phụ đề (crop đáy khung) → RapidOCR (PP-OCR ONNX)
   nhận diện → gộp các khung có chữ GIỐNG NHAU liền kề → cue.
   File này chỉ chứa phần thuần để unit-test: dựng filter
   ffmpeg, chuẩn hoá text, quy đổi frame→thời gian, gộp cue,
   kiểm tra JSON do worker python trả về. Lỗi lộ liễu mã HS_*
   (Luật 10 — không fallback ngầm).
   ============================================================ */

const HS_MIN_FPS = 0.1;
const HS_MAX_FPS = 10;
const HS_MIN_REGION = 10;   // % đáy khung tối thiểu
const HS_MAX_REGION = 90;   // % đáy khung tối đa

function errCode(code, msg) {
  const e = new Error(code + ': ' + msg);
  e.code = code;
  return e;
}

/* ── Chuẩn hoá text để so khớp "khung giống nhau": gập khoảng trắng ── */
function normalizeText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/* ── Dựng chuỗi -vf cho ffmpeg: lấy mẫu fps + crop vùng đáy khung ──
   bottomPct là PHẦN TRĂM ĐÁY khung giữ lại (30 = 30% dưới cùng). */
function cropFilter({ sampleFps = 2, bottomPct = 30 } = {}) {
  const fps = Number(sampleFps);
  if (!(fps >= HS_MIN_FPS && fps <= HS_MAX_FPS)) {
    throw errCode('HS_FPS_INVALID', 'sampleFps phải trong [' + HS_MIN_FPS + ', ' + HS_MAX_FPS + '], nhận: ' + sampleFps);
  }
  const pct = Number(bottomPct);
  if (!(pct >= HS_MIN_REGION && pct <= HS_MAX_REGION)) {
    throw errCode('HS_REGION_INVALID', 'bottomPct (đáy khung %) phải trong [' + HS_MIN_REGION + ', ' + HS_MAX_REGION + '], nhận: ' + bottomPct);
  }
  const p = Math.round(pct) / 100;
  const y = (1 - p).toFixed(4);
  return 'fps=' + fps + ',crop=iw:ih*' + p.toFixed(4) + ':0:ih*' + y;
}

/* ── frame idx (1-based theo %06d) → thời điểm ms trong video ── */
function frameTimeMs(idx, sampleFps, startSec) {
  const f = Math.max(1, Math.floor(Number(idx) || 1));
  const fps = Number(sampleFps);
  if (!(fps > 0)) throw errCode('HS_FPS_INVALID', 'sampleFps phải > 0');
  const start = Math.max(0, Number(startSec) || 0);
  return Math.round(start * 1000 + (f - 1) * (1000 / fps));
}

/* ── JSON worker → danh sách frame [{idx, text, score}] ──
   Nhận diện thiếu/mất text (khung không phụ đề), lọc theo điểm
   tin cậy, bắt JSON sai cấu trúc LỘ LIỂU HS_OCR_BADJSON. */
function framesFromWorkerJson(jsonObj, { minScore = 0.5 } = {}) {
  if (!jsonObj || typeof jsonObj !== 'object' || !Array.isArray(jsonObj.frames)) {
    throw errCode('HS_OCR_BADJSON', 'JSON worker OCR thiếu mảng "frames".');
  }
  const min = Number(minScore) > 0 ? Number(minScore) : 0.5;
  const out = [];
  for (const f of jsonObj.frames) {
    if (!f || typeof f !== 'object') continue;
    const idx = Math.floor(Number(f.idx));
    if (!(idx >= 1)) continue;
    const score = Number(f.score) || 0;
    const text = normalizeText(f.text);
    if (!text) continue;              // khung trống — không phụ đề
    if (score < min) continue;        // nhận diện mờ — bỏ, không bịa
    out.push({ idx, text, score });
  }
  out.sort((a, b) => a.idx - b.idx);
  return out;
}

/* ── Gộp frame thành cue: các khung LIỀN KỀ có text giống nhau
   (đã chuẩn hoá) thành 1 cue. start = thời điểm khung đầu của
   nhóm; end = thời điểm khung NGAY SAU nhóm (viền ngoài), nhóm
   cuối dùng +1 khoảng lấy mẫu, có trần endVideoMs nếu biết.
   Kheo minDurationMs, chống cue-đè-cue (end <= start cue sau). ── */
function cuesFromFrameTexts(frames, {
  sampleFps = 2, startSec = 0, endVideoMs = null,
  minDurationMs = 400,
} = {}) {
  if (!Array.isArray(frames)) throw errCode('HS_BAD_FRAMES', 'frames phải là mảng.');
  const cues = [];
  let i = 0;
  while (i < frames.length) {
    const first = frames[i];
    const norm = normalizeText(first.text);
    let j = i;
    while (j + 1 < frames.length && normalizeText(frames[j + 1].text) === norm) j++;
    const startMs = frameTimeMs(first.idx, sampleFps, startSec);
    const after = frames[j + 1];
    let endMs = after
      ? frameTimeMs(after.idx, sampleFps, startSec)
      : (endVideoMs > startMs ? endVideoMs : startMs + Math.round(1000 / sampleFps));
    // đảm bảo thời lượng tối thiểu…
    if (endMs - startMs < minDurationMs) endMs = startMs + minDurationMs;
    cues.push({ startMs, endMs, text: first.text });
    i = j + 1;
  }
  // chống cue-đè-cue: end của cue trước không vượt start cue sau
  for (let k = 0; k < cues.length - 1; k++) {
    if (cues[k].endMs > cues[k + 1].startMs) cues[k].endMs = cues[k + 1].startMs;
  }
  return cues.filter((c) => c.endMs > c.startMs && c.text);
}

module.exports = {
  normalizeText,
  cropFilter,
  frameTimeMs,
  framesFromWorkerJson,
  cuesFromFrameTexts,
  HS_MIN_FPS, HS_MAX_FPS, HS_MIN_REGION, HS_MAX_REGION,
};