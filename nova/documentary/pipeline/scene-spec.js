'use strict';

const { assetPath } = require('./asset-matcher');

function mediaType(asset) {
  const type = String(asset && (asset.type || asset.assetType || asset.mediaType) || '').toLowerCase();
  if (type === 'video' || /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(assetPath(asset))) return 'video';
  return 'image';
}

function makeSceneSpec(scene, options = {}) {
  const durationSec = Math.max(0.5, Number(scene && scene.durationSec) || 3);
  const source = assetPath(scene && scene.asset);
  const layers = source
    ? [{ type: mediaType(scene.asset), src: source, box: { x: 0, y: 0, w: 100, h: 100 }, style: { fit: 'cover' }, at: 0, in: { preset: 'fade', dur: 0.35 }, hold: { preset: 'kenIn', amp: 0.4 }, out: { preset: 'fade', dur: 0.3 }, z: 1 }]
    : [{ type: 'shape', shape: 'rect', box: { x: 0, y: 0, w: 100, h: 100 }, style: { fill: options.missingColor || '#24211e' }, at: 0, z: 1 }];
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
  };
}

function makeSceneSpecs(scenes, options = {}) {
  return (Array.isArray(scenes) ? scenes : []).map(scene => makeSceneSpec(scene, options));
}

module.exports = { mediaType, makeSceneSpec, makeSceneSpecs };