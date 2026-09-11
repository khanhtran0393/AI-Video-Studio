'use strict';
// Watermark/logo QA (Phase 4 extension — học từ NNLauncher): phát hiện watermark/logo
// trên FRAME render thật bằng engine WatermarkRemover-AI có sẵn (nova/watermark-native.js)
// ở chế độ --preview — CHỈ detection (Florence-2), KHÔNG xử lý ảnh, KHÔNG thêm dependency.
// Không có engine → degrade có chủ đích: meta ghi { unavailable: true, reason: 'VA_WM_*' }
// và provider trả mảng rỗng (QA vẫn chạy phần khác — L10: degrade phải khai báo rõ).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveFfmpeg(ffmpeg) {
  if (ffmpeg) return ffmpeg;
  try { return require('../../editor-pro/ff-path').FFMPEG; } catch (_) { return 'ffmpeg'; }
}

// Engine WatermarkRemover-AI — lazy-require (module Electron-aware, try/catch khi chạy plain node).
let _wmNative = null;
function wmNative() {
  if (_wmNative !== null) return _wmNative;
  try { _wmNative = require('../../watermark-native') || false; } catch (_) { _wmNative = false; }
  return _wmNative;
}

// Probe engine: { available, root } hoặc { available: false, reason }.
function probeEngine() {
  const wm = wmNative();
  if (!wm || typeof wm.probe !== 'function') return { available: false, reason: 'VA_WM_ENGINE_UNAVAILABLE' };
  try {
    const p = wm.probe();
    if (!p || !p.hasRoot) return { available: false, reason: 'VA_WM_ENGINE_UNAVAILABLE' };
    if (!p.hasPython) return { available: false, reason: 'VA_WM_ENGINE_NO_PYTHON' };
    return { available: true, root: p.root };
  } catch (_) { return { available: false, reason: 'VA_WM_ENGINE_UNAVAILABLE' }; }
}

// Trích 1 frame PNG full-res tại giây t (dùng cho detection — KHÔNG phải stats 32×32 của vision.js).
function extractFrame(videoPath, t, outPath, ffmpeg) {
  const r = spawnSync(resolveFfmpeg(ffmpeg),
    ['-ss', String(t), '-i', videoPath, '-frames:v', '1', '-y', outPath],
    { maxBuffer: 1 << 20, windowsHide: true });
  return r.status === 0 && fs.existsSync(outPath);
}

// Thời điểm lấy frame cho mỗi cảnh: GIỮA cảnh (mô phỏng đúng cursor-accumulation của
// qa/vision.js — mốc thời gian = tổng duration các cảnh trước, không phải sc.start).
// Quá maxFrames cảnh → lấy đều (deterministic, không random) để giới hạn số lần model load.
function sceneFrameTimes(spec, maxFrames = 12) {
  const scenes = (spec && spec.scenes) || [];
  const all = [];
  let cursor = 0;
  for (const sc of scenes) {
    const dur = Math.max(0.05, (sc.end - sc.start));
    all.push({ sceneId: sc.id, t: Math.max(0, Math.round((cursor + dur / 2) * 1000) / 1000) });
    cursor += dur;
  }
  const cap = Math.max(1, Number(maxFrames) || 12);
  if (all.length <= cap) return all;
  const picked = [];
  for (let i = 0; i < cap; i++) {
    const idx = cap === 1 ? Math.floor(all.length / 2) : Math.round(i * (all.length - 1) / (cap - 1));
    const item = all[idx];
    if (!picked.some((p) => p.sceneId === item.sceneId)) picked.push(item);
  }
  return picked;
}

// Chuẩn hoá kết quả preview của remwm: { boxes: [...] } → mảng hộp số hợp lệ.
function normalizeBoxes(previewResult) {
  const raw = previewResult && Array.isArray(previewResult.boxes) ? previewResult.boxes : [];
  const out = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const x1 = Number(b.x1 != null ? b.x1 : b.left), y1 = Number(b.y1 != null ? b.y1 : b.top);
    const x2 = Number(b.x2 != null ? b.x2 : b.right), y2 = Number(b.y2 != null ? b.y2 : b.bottom);
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    if (x2 <= x1 || y2 <= y1) continue;
    const box = { x1, y1, x2, y2 };
    const score = Number(b.score != null ? b.score : b.confidence);
    if (Number.isFinite(score)) box.score = Math.round(score * 1000) / 1000;
    out.push(box);
  }
  return out;
}

// Detection thật qua remwm --preview (JSON {boxes} ra stdout, KHÔNG sửa ảnh).
async function detectBoxes(imagePath, opts = {}) {
  const wm = wmNative();
  if (!wm || typeof wm.preview !== 'function')
    throw Object.assign(new Error('Watermark QA: engine không khả dụng'), { code: 'VA_WM_ENGINE_UNAVAILABLE' });
  const res = await wm.preview(imagePath, { overwrite: false, detectionPrompt: opts.detectionPrompt || 'watermark, logo' });
  return normalizeBoxes(res);
}

// Provider Watermark QA — trả async (ctx) => errors[] để ghép vào nhóm semantic của runQA().
// - Lỗi: { scene, type: 'watermark_detected', severity: 'high', boxes, suggestedFix: remove_watermark }
//   (severity high → Final QA FAIL chặn upload §32.12 — watermark KHÔNG auto-fix được,
//   Auto-Fix bỏ qua suggestedFix lạ nên job rơi vào NEEDS_REVIEW: người dùng chạy tool
//   Xoá watermark ngoài pipeline rồi render lại).
// - meta (object truyền vào): ghi engine/checked/detected hoặc { unavailable, reason }.
// - detect: inject được cho test; mặc định dùng engine thật.
// - Cache theo (videoPath, t): Auto-Fix gọi QA lại ≤5 lần trên CÙNG file preview → không detect trùng.
function createWatermarkProvider({ videoPath, ffmpeg, maxFrames = 12, detectionPrompt, meta = null, onLog = null, detect = null } = {}) {
  const cache = new Map();
  return async function watermarkProvider(ctx) {
    if (!videoPath || !fs.existsSync(videoPath)) return [];
    const injected = typeof detect === 'function';
    const probe = injected ? { available: true, root: 'injected' } : probeEngine();
    const usableDetect = injected ? detect : (probe.available ? detectBoxes : null);
    if (meta) Object.assign(meta, probe.available
      ? { engine: injected ? 'injected' : 'watermark-remover', root: probe.root, maxFrames }
      : { unavailable: true, reason: probe.reason }); // L10: khai báo rõ thay vì im lặng
    if (!usableDetect) {
      if (onLog) { try { onLog('Watermark QA bỏ qua: ' + probe.reason); } catch (_) {} }
      return [];
    }
    const times = sceneFrameTimes(ctx && ctx.spec, maxFrames);
    if (meta) meta.checked = times.length;
    const errors = [];
    let dir = null;
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'va-wmqa-'));
      for (const { sceneId, t } of times) {
        const key = videoPath + '|' + t;
        let boxes = cache.get(key);
        if (boxes === undefined) {
          const frame = path.join(dir, 'f-' + String(t).replace('.', '-') + '.png');
          if (!extractFrame(videoPath, t, frame, ffmpeg)) { cache.set(key, []); continue; }
          try { boxes = normalizeBoxes(await usableDetect(frame, { detectionPrompt })); }
          catch (e) {
            if (meta && !meta.detectionError) meta.detectionError = String((e && e.code) || (e && e.message) || e);
            boxes = [];
          }
          cache.set(key, boxes);
        }
        if (boxes.length) errors.push({ scene: sceneId, type: 'watermark_detected', severity: 'high',
          start: t, end: null, count: boxes.length, boxes,
          suggestedFix: { type: 'remove_watermark', scene: sceneId } });
      }
    } finally {
      if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
    }
    if (meta) meta.detected = errors.length;
    return errors;
  };
}

module.exports = { sceneFrameTimes, normalizeBoxes, extractFrame, probeEngine, detectBoxes, createWatermarkProvider };



