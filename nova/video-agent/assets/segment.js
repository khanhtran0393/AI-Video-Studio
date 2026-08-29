'use strict';
// §8 Asset Segmentation (Phase 3) — tách nhân vật khỏi nền (rembg/SAM qua ONNX).
// Provider ONNX lazy-require onnxruntime-node (đã có trong deps) + file model (u2net/rembg).
// Không có model/ortx → trả { unavailable: true } — orchestrator vẫn chạy (fallback heuristic Phase 1).
const fs = require('fs');
const path = require('path');

// Từ mặt nạ alpha (Uint8/Float) + kích thước → bbox chủ thể + độ che phủ (0..1). Hàm thuần, test được.
function subjectBoxFromMask(alpha, w, h) {
  if (!alpha || w <= 0 || h <= 0) return null;
  const n = alpha.length;
  let minX = w, minY = h, maxX = -1, maxY = -1, fg = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = alpha[y * w + x];
      if (v > 16) { // ngưỡng cắt nền: > ~6% opacity
        fg++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (fg === 0 || maxX < 0) return null;
  return {
    bbox: { x: ROUND3(minX / w * 100), y: ROUND3(minY / h * 100),
      w: ROUND3((maxX - minX + 1) / w * 100), h: ROUND3((maxY - minY + 1) / h * 100) },
    coverage: ROUND3(fg / (w * h)),
    pixels: fg,
  };
}
function ROUND3(v) { return Math.round(v * 1000) / 1000; }

// Provider 'onnx': nạp model 1 lần, chạy inference, trả mặt nạ alpha (Uint8Array w×h).
// Model rembg/u2net: 1 input RGB 320×320 → 1 output mask 320×320 (float32 [0,1]).
function createOnnxProvider({ modelPath } = {}) {
  let session = null, loading = null, unavailable = null;
  async function load() {
    if (session) return session;
    if (unavailable) return null;
    if (!modelPath || !fs.existsSync(modelPath)) { unavailable = 'Thiếu model: ' + modelPath; return null; }
    if (loading) return loading;
    loading = (async () => {
      let ort;
      try { ort = require('onnxruntime-node'); }
      catch (e) { unavailable = 'onnxruntime-node không nạp được: ' + (e && e.message); return null; }
      try {
        const buf = fs.readFileSync(modelPath);
        session = await ort.InferenceSession.create(buf);
        return session;
      } catch (e) { unavailable = 'Tạo session lỗi: ' + (e && e.message); return null; }
    })();
    return loading;
  }
  return {
    name: 'onnx',
    async analyze(imagePath, { size = 320 } = {}) {
      const s = await load();
      if (!s) return { unavailable: true, reason: unavailable };
      const pixels = readImageRGB(imagePath, size); // Uint8 RGB 320×320
      if (!pixels) return { unavailable: true, reason: 'Không decode ảnh (cần ffmpeg)' };
      const feeds = {}; feeds[s.inputNames[0]] = rgbToTensor(pixels, size);
      const out = await s.run(feeds);
      const tensor = out[s.outputNames[0]];
      const data = tensor.data; // float32 [0,1]
      const mask = new Uint8Array(size * size);
      for (let i = 0; i < mask.length; i++) mask[i] = Math.round(data[i] * 255);
      const sb = subjectBoxFromMask(mask, size, size);
      return { mask, subject: sb };
    },
  };
}

function createSegmentationProvider(opts = {}) {
  const provider = String(opts.provider || 'auto');
  if (provider === 'none') return { name: 'none', analyze: async () => ({ unavailable: true, reason: 'none provider' }) };
  if (provider === 'onnx' || provider === 'auto') {
    // auto = onnx nếu model tồn tại, không thì degrade như 'none'.
    if (provider === 'auto' && (!opts.modelPath || !fs.existsSync(opts.modelPath))) {
      return { name: 'none', analyze: async () => ({ unavailable: true, reason: 'auto: không có model' }) };
    }
    return createOnnxProvider(opts);
  }
  return { name: 'none', analyze: async () => ({ unavailable: true, reason: 'provider không rõ: ' + provider }) };
}

// Decode ảnh → RGB 320×320 raw bằng ffmpeg. Trả null nếu lỗi.
function readImageRGB(imagePath, size) {
  let bin, spawnSync;
  try { spawnSync = require('child_process').spawnSync; bin = require('../../editor-pro/ff-path').FFMPEG; }
  catch (_) { return null; }
  const r = spawnSync(bin, ['-i', imagePath, '-vf', 'scale=' + size + ':' + size, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: size * size * 3 + 4096, windowsHide: true });
  if (r.status !== 0 || !r.stdout || r.stdout.length < size * size * 3) return null;
  return new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, size * size * 3);
}
function rgbToTensor(rgb, size) {
  const n = size * size, f32 = new Float32Array(n * 3), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < n; i++) f32[c * n + i] = (rgb[i * 3 + c] / 255 - mean[c]) / std[c];
  return f32;
}

// Phase-3 analyzer tổng hợp: identity hash + segmentation — đóng vai analyzeAsset cho manifest.
function createPhase3Analyzer({ ffmpeg, segmentation: segOpts } = {}) {
  const identity = require('./identity').createIdentityAnalyzer({ ffmpeg });
  const seg = createSegmentationProvider(segOpts || {});
  return async function analyzeAsset(entry, ctx = {}) {
    const out = {};
    try { Object.assign(out, await identity(entry, ctx)); } catch (_) {}
    // Chỉ segment ảnh nhân vật (tách nền); ảnh cảnh/nền không cần.
    if (entry.type === 'character' && typeof seg.analyze === 'function') {
      try {
        const r = await seg.analyze(entry.source);
        if (r && r.subject) out.subjects = [r.subject];
        if (r && r.unavailable) out.segmentation = { provider: seg.name, unavailable: true, reason: r.reason };
        else out.segmentation = { provider: seg.name, unavailable: false };
        if (r && r.subject && r.subject.coverage > 0.04) out.confidence = 0.88; // có cutout thật → tự tin hơn heuristic
      } catch (_) { out.segmentation = { provider: seg.name, unavailable: true, reason: 'lỗi runtime' }; }
    }
    return out;
  };
}

module.exports = { createSegmentationProvider, createOnnxProvider, subjectBoxFromMask, createPhase3Analyzer };
