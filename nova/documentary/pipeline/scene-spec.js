'use strict';

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

function makeSceneSpec(scene, options = {}) {
  const durationSec = Math.max(0.5, Number(scene && scene.durationSec) || 3);
  const source = assetPath(scene && scene.asset);
  const motion = scene && scene.motion;
  const hold = holdAnimation(motion);
  const layers = source
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

module.exports = { mediaType, makeSceneSpec, makeSceneSpecs, holdAnimation };