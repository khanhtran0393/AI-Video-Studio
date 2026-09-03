'use strict';

const fs = require('fs');
const { assetPath } = require('./asset-matcher');
const { buildGraphicLayers } = require('./motion-graphics');

function mediaType(asset) {
  const type = String(asset && (asset.type || asset.assetType || asset.mediaType) || '').toLowerCase();
  if (type === 'video' || /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(assetPath(asset))) return 'video';
  return 'image';
}

/** Map motion preset descriptor sang hold-animation params cho renderer. */
function holdAnimation(motion) {
  if (!motion || !motion.motionType) return { preset: 'kenIn', amp: 0.4 };
  const map = {
    KEN_BURNS: { preset: 'kenIn', amp: 0.4 + 0.25 * Number(motion.intensity || 0.5) },
    PARALLAX_2_5D: { preset: 'parallax', amp: 0.55, parallax: motion.described && motion.described.layers },
    DEPTH_ZOOM: { preset: 'depthZoom', amp: 0.5 },
    CHARACTER_FOCUS: { preset: 'focus', amp: 0.45, vignette: 0.35 },
    CAMERA_ORBIT: { preset: 'orbit', amp: 0.4 },
    MAP_ANIMATION: { preset: 'kenIn', amp: 0.3, map: true },
    OBJECT_MOTION: { preset: 'kenIn', amp: 0.3, highlight: true },
    MOTION_GRAPHICS: { preset: 'static' },
    HAND_DRAWN_STYLE: { preset: 'stroke', amp: 0.5 },
    PHOTO_RECONSTRUCTION: { preset: 'kenIn', amp: 0.3 },
  };
  return map[motion.motionType] || { preset: 'kenIn', amp: 0.4 };
}

/**
 * §16/§17 — LAYER THẬT từ segmentation materialized. Nếu beat có các file PNG
 * đã tách (subject/background) thì thay layer ảnh đơn bằng chồng lớp: nền dưới,
 * chủ thể trên, mỗi lớp một biên độ pan riêng → parallax thật khi render.
 * Layer nào thiếu file thì bỏ (không phá cảnh), không có lớp nào → null →
 * giữ hành vi cũ (1 layer ảnh gốc) để tương thích ngược.
 * §16.5 word sync: nếu beat có wordSync (từ khớp asset được phát âm), các lớp
 * CHỦ THỂ delay `at` tới đúng offsetSec đó + pop-in — nền vẫn hiện từ đầu.
 */
const PARALLAX_AMP = { background: 0.22, midground: 0.5, subject: 0.85, object: 0.75, foreground: 1.2, full: 1 };

/**
 * §16.5: mắt người xem cần ~250ms để "đón" hình mới — cho chủ thể hiện TRƯỚC
 * từ được đọc một nhịp nhỏ thay vì đúng lúc: cảm giác đồng bộ chính xác hơn.
 * Tự động (zero-config), clamp về 0 khi từ nằm ngay đầu beat.
 */
const WORD_SYNC_LEAD_SEC = 0.25;

function wordSyncSubjectAt(scene, durationSec) {
  const sync = scene && scene.wordSync;
  if (!sync || !sync.hasSync || !sync.events.length) return 0;
  const offset = Number(sync.events[0].offsetSec) || 0;
  // Không để chủ thể vào quá muộn: chừa ít nhất 1s để pop-in + parallax.
  return Number(Math.max(0, Math.min(offset - WORD_SYNC_LEAD_SEC, Math.max(0, durationSec - 1))).toFixed(3));
}

function segmentationImageLayers(scene, motion, durationSec) {
  const seg = scene && scene.segmentation;
  if (!seg || !seg.materialized || !Array.isArray(seg.layers) || !seg.layers.length) return null;
  const usable = seg.layers
    .filter(layer => layer && layer.source && layer.role && layer.role !== 'full')
    .map(layer => ({ ...layer, source: String(layer.source).replace(/^file:\/\//i, '') }))
    .filter(layer => fs.existsSync(layer.source))
    .sort((a, b) => (Number(a.depth) || 0) - (Number(b.depth) || 0));
  if (!usable.length) return null;
  // Biên độ parallax: nhân theo role (nền chậm, chủ thể nhanh) x cường độ motion.
  const intensity = Math.max(0, Math.min(1, Number(motion && motion.intensity) || 0.5));
  const gain = 0.6 + intensity;
  // §16.5: chủ thể xuất hiện trước từ được nhắc một nhịp (anticipation), pop-in.
  // Có wordSync → LUÔN dùng pop cho chủ thể (kể cả at=0 do clamp) — ngôn ngữ
  // hình ảnh nhất quán, không phụ thuộc vị trí từ trong beat.
  const subjectAt = wordSyncSubjectAt(scene, durationSec);
  const wordSyncOn = !!(scene && scene.wordSync && scene.wordSync.hasSync);
  return usable.map((layer, index) => {
    const isSubject = layer.role !== 'background' && layer.role !== 'midground';
    const at = isSubject ? subjectAt : 0;
    return {
    type: 'image',
    src: layer.source,
    box: { x: 0, y: 0, w: 100, h: 100 },
    style: layer.role === 'subject'
      ? { fit: 'cover', shadow: 0.5 }
      : { fit: 'cover' },
    at,
    in: isSubject && wordSyncOn
      ? { preset: 'pop', dur: 0.5 }
      : { preset: 'fade', dur: index ? 0.4 : 0.3 },
    out: { preset: 'fade', dur: 0.3 },
    hold: { preset: 'panR', amp: Number(((PARALLAX_AMP[layer.role] || 1) * gain).toFixed(3)) },
    z: 1 + index,
    segmentation: { role: layer.role, depth: layer.depth, name: layer.name },
    };
  });
}

function makeSceneSpec(scene, options = {}) {
  const durationSec = Math.max(0.5, Number(scene && scene.durationSec) || 3);
  const source = assetPath(scene && scene.asset);
  const motion = scene && scene.motion;
  const hold = holdAnimation(motion);
  const segLayers = segmentationImageLayers(scene, motion, durationSec);
  const layers = segLayers
    ? segLayers
    : source
      ? [{ type: mediaType(scene.asset), src: source, box: { x: 0, y: 0, w: 100, h: 100 }, style: { fit: 'cover' }, at: 0, in: { preset: 'fade', dur: 0.35 }, hold, out: { preset: 'fade', dur: 0.3 }, z: 1, ...(motion && motion.preset ? { motion: motion.preset } : {}) }]
      : [{ type: 'shape', shape: 'rect', box: { x: 0, y: 0, w: 100, h: 100 }, style: { fill: options.missingColor || '#24211e' }, at: 0, z: 1 }];
  // §18 motion graphics overlays khi scene có graphics intent.
  const graphics = scene && scene.graphics;
  if (Array.isArray(graphics) && graphics.length) {
    layers.push(...buildGraphicLayers(graphics, { accent: '#e07a46', labelText: scene && scene.labelText }));
  }
  // §19 attention: thêm emphasis flash layer nếu có.
  if (scene && scene.attention && scene.attention.hasEmphasis) {
    layers.push({ type: 'shape', shape: 'circle', box: { x: 36, y: 28, w: 28, h: 38 }, style: { fill: 'none', stroke: '#ffd166', strokeW: 3, opacity: 0 }, at: 0.4, in: { preset: 'pop', dur: 0.4 }, out: { preset: 'fade', dur: 0.3 }, z: 13, attention: scene.attention });
  }
  // §16.5 word sync (ảnh phẳng, chưa segmentation): ring nhấn đúng giây từ
  // khớp asset được phát âm — "nói núi" → highlight hiện núi ngay lúc đó
  // (trừ trước 1 nhịp anticipation, clamp để không bị cắt muộn).
  const sync = scene && scene.wordSync;
  if (sync && sync.hasSync && sync.events.length && !segLayers) {
    const offset = Number(sync.events[0].offsetSec) || 0;
    const at = Number(Math.max(0, Math.min(offset - WORD_SYNC_LEAD_SEC, Math.max(0, durationSec - 0.8))).toFixed(3));
    layers.push({ type: 'shape', shape: 'circle', box: { x: 38, y: 30, w: 24, h: 32 }, style: { fill: 'none', stroke: '#e07a46', strokeW: 3, opacity: 0 }, at, in: { preset: 'pop', dur: 0.4 }, out: { preset: 'fade', dur: 0.3 }, z: 12, wordSync: sync });
  }
  layers.push({
    type: 'text',
    text: String(scene && scene.text || ''),
    box: { x: 8, y: 72, w: 84, h: 22, align: 'left', vAlign: 'bottom' },
    style: { size: Number(options.textSize) || 46, color: '#ffffff', font: 'Helvetica Neue, Helvetica, Arial, sans-serif', weight: 700, shadow: true, bg: 'rgba(0,0,0,.42)', pad: 12, radius: 8 },
    at: 0.25, in: { preset: 'rise', dur: 0.45 }, out: { preset: 'fade', dur: 0.3 }, z: 20,
  });
  return {
    id: String(scene && scene.sceneId || 'scene'),
    durationSec,
    theme: { bg: '#0d0c0b', text: '#ffffff', accent: '#e07a46', font: 'Helvetica Neue, Helvetica, Arial, sans-serif' },
    layers,
    transition: String(scene && scene.transition || 'none'),
    trans: String(scene && scene.transition || 'none'),
    ...(motion && motion.preset ? { motion: motion.preset } : {}),
  };
}

function makeSceneSpecs(scenes, options = {}) {
  return (Array.isArray(scenes) ? scenes : []).map(scene => makeSceneSpec(scene, options));
}

module.exports = { mediaType, makeSceneSpec, makeSceneSpecs, holdAnimation, segmentationImageLayers, wordSyncSubjectAt };