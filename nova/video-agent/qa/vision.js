'use strict';
// §20 Vision QA (Phase 4) — QA trên FRAME render thật: đen/trắng/không chi tiết/đông cứng.
// Trích frame bằng ffmpeg (gray 32×32) → mean/std/dHash. Không cần model vision, chỉ đo pixel.
const { spawnSync } = require('child_process');

function resolveFfmpeg(ffmpeg) {
  if (ffmpeg) return ffmpeg;
  try { return require('../../editor-pro/ff-path').FFMPEG; } catch (_) { return 'ffmpeg'; }
}

// Lấy 1 frame tại giây t → { t, mean, std, hash } (gray 32×32 = 1024 byte).
function frameStats(videoPath, t, ffmpeg) {
  const bin = resolveFfmpeg(ffmpeg);
  const r = spawnSync(bin, ['-ss', String(t), '-i', videoPath, '-frames:v', '1',
    '-vf', 'scale=32:32', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 20, windowsHide: true });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 1024) return null;
  const px = new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, 1024);
  let sum = 0;
  for (let i = 0; i < px.length; i++) sum += px[i];
  const mean = sum / px.length;
  let varSum = 0;
  for (let i = 0; i < px.length; i++) varSum += (px[i] - mean) * (px[i] - mean);
  const std = Math.sqrt(varSum / px.length);
  // dHash 64-bit cho so sánh tổng thể.
  let bits = '';
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) bits += px[row * 32 + col] > px[row * 32 + col + 1] ? '1' : '0';
  let hash = '';
  for (let i = 0; i < 64; i += 4) hash += ((bits[i] << 3) | (bits[i+1] << 2) | (bits[i+2] << 1) | bits[i+3]).toString(16);
  return { t: Math.round((t) * 1000) / 1000, mean: Math.round(mean * 10) / 10, std: Math.round(std * 10) / 10, hash, px };
}

// Sai khác tuyệt đối trung bình giữa 2 frame (0 = giống hệt từng pixel).
function meanAbsDiff(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

// Hàm thuần hamming hex (test được độc lập).
function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}

// Lấy stats cho mỗi cảnh (lấy giữa cảnh + sát biên cuối). Trả: stats[] theo thứ tự cảnh. (Đồng bộ — spawnSync)
function extractSceneStats({ videoPath, spec, ffmpeg, padding = 0.1 }) {
  const scenes = (spec && spec.scenes) || [];
  const stats = [];
  if (!scenes.length || !videoPath) return stats;
  let cursor = 0;
  for (const sc of scenes) {
    const dur = Math.max(0.05, (sc.end - sc.start));
    const mid = cursor + dur / 2;
    const s1 = frameStats(videoPath, Math.max(0, mid - padding), ffmpeg);
    const s2 = frameStats(videoPath, Math.max(0, cursor + dur - padding), ffmpeg);
    const frames = [s1, s2].filter(Boolean);
    if (frames.length) stats.push({ sceneId: sc.id, start: cursor, mid, end: cursor + dur, frames });
    cursor += dur;
  }
  return stats;
}

// Tạo providers semantic + continuity từ stats. Mỗi lỗi: { scene, type, severity, suggestedFix }.
function createVisionProviders({ stats = [] } = {}) {
  const semantic = async () => {
    const errors = [];
    for (const s of stats) {
      const mid = s.frames[0] || s.frames[1];
      if (!mid) continue;
      if (mid.mean < 12) errors.push({ scene: s.sceneId, type: 'black_frame', severity: 'high', start: mid.t, end: null,
        suggestedFix: { type: 'check_render', scene: s.sceneId } });
      else if (mid.mean > 243) errors.push({ scene: s.sceneId, type: 'white_frame', severity: 'high', start: mid.t, end: null,
        suggestedFix: { type: 'check_render', scene: s.sceneId } });
      if (mid.std < 4) errors.push({ scene: s.sceneId, type: 'flat_frame', severity: 'medium', start: mid.t, end: null,
        suggestedFix: { type: 'check_layers', scene: s.sceneId } });
    }
    return errors;
  };
  const continuity = async () => {
    const errors = [];
    for (let i = 1; i < stats.length; i++) {
      const a = stats[i - 1].frames[stats[i - 1].frames.length - 1];
      const b = stats[i].frames[0];
      // Đông cứng: 2 frame biên giới khác nhau tới từng pixel (diff < 1/255).
      if (a && b && a.px && b.px && meanAbsDiff(a.px, b.px) < 1) {
        errors.push({ scene: stats[i].sceneId, type: 'frozen_frame', severity: 'medium', start: a.t, end: b.t,
          suggestedFix: { type: 'check_transition', scene: stats[i].sceneId } });
      }
    }
    return errors;
  };
  return { semantic, continuity };
}

module.exports = { frameStats, extractSceneStats, createVisionProviders, hamming, meanAbsDiff };
