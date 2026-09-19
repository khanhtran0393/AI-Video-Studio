'use strict';
/* ── PT1 — Chuẩn hoá thời lượng clip Flow về ĐÚNG thời lượng cảnh (TTS master clock, §1.1).
 * Nguyên tắc rút từ kinh nghiệm cộng đồng dubbing (thread "audio TTS dài hơn timestamp"):
 *   KHÔNG BAO GIỜ bóp méo giọng đọc — sự lệch thời lượng do HÌNH gánh. Clip Flow bị
 *   MUTE (-an) vì tiếng trong video final là TTS + nhạc do renderer mux (tệ nhất là
 *   chèn lẫn audio của clip). Thang chiến lược (mọi hệ số KHAI BÁO trong plan — Luật 10):
 *     - clip dài hơn:  ratio ≤ maxSpeedUp → 'speed' (setpts tăng tốc hình nhẹ, audio đã mute)
 *                     ratio  > maxSpeedUp → 'cut'   (-t cắt tại đúng targetSec)
 *     - clip ngắn hơn: factor ≤ maxSlow   → 'slow'  (setpts giãn hình chậm nhẹ)
 *                      factor  > maxSlow  → 'slow+freeze' (giãn tới trần rồi tpad clone
 *                                          đóng băng khung cuối phần còn lại)
 * Hàm thuần (planNormalize/buildNormalizeArgs) tách riêng để test bằng node thuần;
 * phần IO (probe/extract/normalize) chỉ bọc spawnSync. ── */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULTS = { maxSpeedUp: 1.15, maxSlow: 1.5, eps: 0.05 };
const NORMALIZE_STRATEGIES = ['ok', 'cut', 'speed', 'slow', 'slow+freeze'];
const ROUND4 = (v) => Math.round(v * 10000) / 10000;

function ffPaths(override) {
  if (override && override.ffmpeg && override.ffprobe) return override;
  try { const m = require('../../editor-pro/ff-path'); return { ffmpeg: m.FFMPEG, ffprobe: m.FFPROBE }; }
  catch (_) { return { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }; }
}

/* Tính chiến lược normalize từ thời lượng clip thật vs target (giây). Thuần. */
function planNormalize(clipSec, targetSec, opts = {}) {
  const { maxSpeedUp, maxSlow, eps } = { ...DEFAULTS, ...opts };
  const clip = Number(clipSec), target = Number(targetSec);
  if (!Number.isFinite(clip) || clip <= 0) throw Object.assign(new Error('planNormalize: clipSec không hợp lệ'), { code: 'VA_FLOW_NORMALIZE_BAD_INPUT' });
  if (!Number.isFinite(target) || target <= 0) throw Object.assign(new Error('planNormalize: targetSec không hợp lệ'), { code: 'VA_FLOW_NORMALIZE_BAD_INPUT' });
  const diff = clip - target;
  if (Math.abs(diff) <= eps) return { strategy: 'ok', clipSec: clip, targetSec: target, speed: 1, freezeSec: 0 };
  if (diff > 0) {
    const ratio = clip / target;
    if (ratio <= maxSpeedUp) return { strategy: 'speed', clipSec: clip, targetSec: target, speed: ROUND4(ratio), freezeSec: 0 };
    return { strategy: 'cut', clipSec: clip, targetSec: target, speed: 1, freezeSec: 0 };
  }
  const factor = target / clip;
  if (factor <= maxSlow) return { strategy: 'slow', clipSec: clip, targetSec: target, speed: ROUND4(1 / factor), freezeSec: 0 };
  const slowed = clip * maxSlow;
  return { strategy: 'slow+freeze', clipSec: clip, targetSec: target, speed: ROUND4(1 / maxSlow), freezeSec: ROUND4(target - slowed) };
}

/* Dựng argv ffmpeg cho plan — thuần (test bằng so sánh mảng). Luôn mute + cap -t targetSec. */
function buildNormalizeArgs({ input, output, targetSec, plan }) {
  if (!input || !output) throw Object.assign(new Error('buildNormalizeArgs: thiếu input/output'), { code: 'VA_FLOW_NORMALIZE_BAD_INPUT' });
  if (!plan || !NORMALIZE_STRATEGIES.includes(plan.strategy)) throw Object.assign(new Error('buildNormalizeArgs: plan.strategy không hợp lệ'), { code: 'VA_FLOW_NORMALIZE_BAD_INPUT' });
  const args = ['-y', '-i', input, '-an'];
  const vf = [];
  if (plan.strategy === 'speed') vf.push('setpts=PTS/' + plan.speed);
  else if (plan.strategy === 'slow') vf.push('setpts=PTS*' + plan.speed);
  else if (plan.strategy === 'slow+freeze') vf.push('setpts=PTS*' + plan.speed + ',tpad=stop_mode=clone:stop_duration=' + plan.freezeSec);
  if (vf.length) args.push('-vf', vf.join(','));
  args.push('-t', String(targetSec),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', output);
  return args;
}

/* Đo thời lượng video thật (giây) bằng ffprobe; lỗi → ném lộ liễu (không bịa duration). */
function probeDurationSec(file, ff) {
  const { ffprobe } = ffPaths(ff);
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8', timeout: 20000 });
  const d = Number(String(r.stdout || '').trim());
  if (r.status !== 0 || !Number.isFinite(d) || d <= 0) {
    throw Object.assign(new Error('ffprobe không đọc được thời lượng: ' + file + ' — ' + String(r.stderr || '').slice(0, 200)),
      { code: 'VA_FLOW_PROBE_FAIL' });
  }
  return d;
}

/* Trích khung CUỐI clip ra ảnh (PT4 — dùng làm reference cho clip kế). Trả đường dẫn ảnh. */
function extractLastFrame(file, outImage, ff) {
  const { ffmpeg } = ffPaths(ff);
  fs.mkdirSync(path.dirname(outImage), { recursive: true });
  const r = spawnSync(ffmpeg, ['-y', '-sseof', '-0.25', '-i', file, '-frames:v', '1', '-q:v', '2', outImage],
    { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0 || !fs.existsSync(outImage)) {
    throw Object.assign(new Error('Không trích được khung cuối: ' + file + ' — ' + String(r.stderr || '').slice(0, 200)),
      { code: 'VA_FLOW_FRAME_FAIL' });
  }
  return outImage;
}

/* Chuẩn hoá 1 clip về targetSec theo thang chiến lược. Trả { plan, durationSec, output }. */
function normalizeClip({ input, output, targetSec, ff, opts }) {
  const { ffmpeg } = ffPaths(ff);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const clipSec = probeDurationSec(input, ff);
  const plan = planNormalize(clipSec, targetSec, opts);
  const args = buildNormalizeArgs({ input, output, targetSec, plan });
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0 || !fs.existsSync(output)) {
    throw Object.assign(new Error('ffmpeg normalize thất bại: ' + String(r.stderr || '').slice(-300)),
      { code: 'VA_FLOW_NORMALIZE_FAIL', plan });
  }
  const durationSec = probeDurationSec(output, ff);
  return { plan, durationSec, output };
}

module.exports = { DEFAULTS, NORMALIZE_STRATEGIES, planNormalize, buildNormalizeArgs, probeDurationSec, extractLastFrame, normalizeClip, ffPaths };

