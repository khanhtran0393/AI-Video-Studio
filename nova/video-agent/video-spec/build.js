'use strict';
// §15 build Video Spec từ Story Plan + Visual Plan + manifest + timing. Single source of truth cho renderer.
const grammar = require('../visual-grammar/grammar');
const { legacyBehaviorsFromSpec } = require('../behavior-engine/legacy');
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

function resolveAsset(manifest, assetId) { return manifest.assets.find(a => a.assetId === assetId) || null; }

function buildVideoSpec({ storyPlan, visualPlan, manifest, config, audio }) {
  const style = (config && config.style) || {};
  const fps = Number(style.fps) || 30;
  const scenes = storyPlan.scenes.map((sp, i) => {
    const vp = (visualPlan.scenes[i] && visualPlan.scenes[i].visuals) || {};
    const bg = vp.background ? resolveAsset(manifest, vp.background) : null;
    const chars = (vp.character || []).map(id => resolveAsset(manifest, id)).filter(Boolean);
    const cam = grammar.cameraFor(vp.camera);
    // Bố cục nhân vật: 1 → giữa; 2 → trái phải.
    const elements = chars.map((c, idx) => {
      const x = chars.length === 1 ? 50 : (idx === 0 ? 28 : 64);
      return { elementId: `EL_${sp.sceneId}_${String(idx + 1).padStart(3, '0')}`, asset: c.assetId,
        kind: c.characterId ? 'character' : 'object', x, y: 48, scale: 0.8,
        animation: vp.characterAnimation || 'breathe', characterId: c.characterId,
        capabilities: { movable: true, scalable: true, rotatable: true } };
    });
    const tInfo = grammar.transitionFor(vp.transition);
    const dur = ROUND3(sp.end - sp.start);
    // Caption theo giây NỘI-CẢNH, kẹp trong [0, dur] — beat chỉ nằm trong scene sau khi story plan đã ép liền kề.
    const captions = sp.beats.map((b, bi) => {
      const cs = Math.max(0, Math.min(dur, ROUND3(b.start - sp.start)));
      const ce = Math.max(cs + 0.05, Math.min(dur, ROUND3(b.end - sp.start)));
      return { id: `cap_${sp.sceneId}_${bi + 1}`, text: b.intent, start: cs, end: ce };
    });
    return {
      id: sp.sceneId, start: ROUND3(sp.start), end: ROUND3(sp.end),
      background: { asset: bg ? bg.assetId : null },
      elements, camera: { type: vp.camera, from: cam.from, to: cam.to },
      captions, transition: vp.transition, transDur: tInfo.dur,
    };
  });
  const spec = {
    project: storyPlan.chapterId, fps, resolution: { width: style.width || 1920, height: style.height || 1080 },
    audio: { voice: (audio && audio.voice) || '' },
    style: { bg: style.bg || '#0b0d12', accent: style.accent || '#f5c542', text: style.text || '#f5f5f5', font: style.font || 'sans-serif' },
    scenes,
  };
  spec.behaviors = legacyBehaviorsFromSpec(spec);
  return spec;
}

module.exports = { buildVideoSpec, resolveAsset };
