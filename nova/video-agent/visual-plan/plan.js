'use strict';
// §12 Visual Plan — chuyển Story Plan thành quyết định hình ảnh, chọn từ Visual Grammar (§13).
// Deterministic scoring; LLM-optional qua options.planVisual (async fn(scene, ctx) -> partial visuals)
// — kết quả LLM được validate lại theo grammar trước khi nhận (§1.3 AI chọn, engine giữ ràng buộc).
const grammar = require('../visual-grammar/grammar');
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

const CAMERAS = ['push-in', 'pull-out', 'pan-left', 'pan-right'];
const ACTIONS_ANIM = { walk: 'walk', 'đi': 'walk', run: 'run', 'chạy': 'run',
  enter: 'enter-left', 'vào': 'enter-left', leave: 'enter-right', 'ra': 'enter-right', look: 'look-left', 'nhìn': 'look-left' };

function scoreAsset(entry, scene) {
  let s = 0;
  if (entry.type === 'background') s += 2;
  const loc = String(scene.location || '').toLowerCase();
  if (loc && entry.tags.some(t => loc.includes(t) || t.includes(loc))) s += 3;
  const words = String(scene.summary || '').toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (entry.tags.some(t => words.some(w => w.includes(t) || t.includes(w)))) s += 1;
  return s;
}

function pickBackground(scene, manifest, used) {
  const images = manifest.assets.filter(a => a.type === 'background' || a.type === 'scene');
  if (!images.length) return null;
  const ranked = images.map(a => ({ a, s: scoreAsset(a, scene) - (used.get(a.assetId) || 0) * 0.5 }))
    .sort((x, y) => y.s - x.s || x.a.assetId.localeCompare(y.a.assetId));
  const pick = ranked[0].a;
  used.set(pick.assetId, (used.get(pick.assetId) || 0) + 1);
  return pick;
}

function pickCharacters(scene, manifest) {
  const want = new Set(scene.characters || []);
  const chars = manifest.assets.filter(a => a.type === 'character');
  if (!chars.length) return [];
  const matched = chars.filter(a => want.has(a.characterId));
  return (matched.length ? matched : chars).slice(0, 2); // tối đa 2 nhân vật/ cảnh (Phase 1)
}

function visualsFor(scene, index, manifest, used, config) {
  const bg = pickBackground(scene, manifest, used);
  const chars = pickCharacters(scene, manifest);
  const camera = CAMERAS[index % CAMERAS.length];
  const actionAnim = (scene.actions || []).map(a => ACTIONS_ANIM[String(a).toLowerCase()]).find(Boolean);
  const transition = index === 0 ? 'cut' : (config && config.transitions && config.transitions[index - 1]) || (index % 5 === 4 ? 'dissolve' : 'cut');
  return {
    sceneId: scene.sceneId,
    visuals: {
      background: bg ? bg.assetId : null,
      character: chars.map(c => c.assetId),
      camera,
      characterAnimation: actionAnim || 'breathe',
      transition,
    },
  };
}

async function buildVisualPlan(storyPlan, manifest, config = {}, options = {}) {
  const used = new Map();
  let plans = storyPlan.scenes.map((s, i) => visualsFor(s, i, manifest, used, config));
  if (typeof options.planVisual === 'function') {
    const refined = await Promise.all(plans.map(async (p) => {
      try { return Object.assign({}, p, { visuals: await options.planVisual(p, storyPlan) }); } catch (_) { return p; }
    }));
    plans = refined.map((r) => {
      const v = r.visuals || {};
      return { sceneId: r.sceneId, visuals: {
        background: v.background != null ? String(v.background) : r.visuals.background,
        character: Array.isArray(v.character) ? v.character.map(String) : r.visuals.character,
        camera: grammar.isCamera(v.camera) ? v.camera : r.visuals.camera,
        characterAnimation: grammar.isAnim(v.characterAnimation) ? v.characterAnimation : r.visuals.characterAnimation,
        transition: grammar.isTransition(v.transition) ? v.transition : r.visuals.transition,
      } };
    });
  }
  return { chapterId: storyPlan.chapterId, scenes: plans };
}

module.exports = { buildVisualPlan, visualsFor, scoreAsset, CAMERAS, ACTIONS_ANIM };
