'use strict';

/**
 * §14 — MOTION DIRECTOR. Chọn motion type + preset cho mỗi visual beat dựa trên:
 * narration, visual importance, available asset, segmentation quality, scene
 * duration, continuity, computational cost. AI chỉ trả kế hoạch — local engine
 * thực thi preset (§15). Tôn trọng Visual Continuity (§12) + Visual Diversity (§13).
 */

const { parseStructured } = require('../core/llm-json');
const { PRESETS, normalizeMotionPlan } = require('../pipeline/motion-presets');

const MOTION_PLAN_SCHEMA = {
  type: 'object',
  required: ['preset', 'intensity'],
  properties: {
    preset: { type: 'string', enum: Object.keys(PRESETS) },
    intensity: { type: 'number', minimum: 0, maximum: 1 },
    duration: { type: 'number', minimum: 0 },
    direction: { type: 'string' },
  },
};

const COST_RANK = {
  STATIC: 0, KEN_BURNS: 1, OBJECT_MOTION: 1, MOTION_GRAPHICS: 2, MAP_ANIMATION: 2,
  HAND_DRAWN_STYLE: 2, LAYERED_CAMERA: 2, DEPTH_ZOOM: 2, CHARACTER_FOCUS: 2,
  PARALLAX_2_5D: 3, PHOTO_RECONSTRUCTION: 4, CAMERA_ORBIT: 4, LIGHTING_ANIMATION: 3, PARTICLE_EFFECT: 3, IMAGE_TO_VIDEO: 5,
};

const DEFAULT_FALLBACK = {
  high: 'ParallaxReveal',
  medium: 'DocumentaryPush',
  low: 'DocumentaryPush',
};

/** Chọn preset heuristic: ưu tiên diversity (tránh lặp preset N shot gần). */
function heuristicPreset({ visualPlan, beat, anchor, history }) {
  const importance = (visualPlan && visualPlan.visualImportance) || (anchor && anchor.anchor && anchor.anchor.importance) || 'medium';
  let preset = DEFAULT_FALLBACK[importance] || 'DocumentaryPush';
  // Map / lãnh thổ → MapExpansion.
  if (visualPlan && visualPlan.requiredAssetType === 'map') preset = 'MapExpansion';
  // Có segmentation → parallax mạnh hơn.
  else if (beat && beat.segmentation && beat.segmentation.quality === 'good') preset = 'ParallaxReveal';
  // Diversity: nếu preset vừa được dùng trong 2 shot gần → xoay sang preset khác (deterministic).
  const recent = (history || []).slice(-2);
  if (recent.includes(preset)) {
    const alternatives = Object.keys(PRESETS).filter(name => !recent.includes(name));
    preset = alternatives[0] || preset;
  }
  const intensity = importance === 'high' ? 0.7 : importance === 'medium' ? 0.5 : 0.35;
  const direction = preset === 'MapExpansion' ? 'north' : preset === 'ParallaxReveal' ? 'forward' : 'forward';
  return { preset, intensity, direction, duration: Number(beat && beat.endSec && beat.startSec != null ? (beat.endSec - beat.startSec) : 0) };
}

function createMotionDirector({ providers, cache, costs, logger } = {}) {
  return {
    MOTION_PLAN_SCHEMA,
    /**
     * @param beatPlans [{ beatId, sceneId, plan: visualPlan }] (từ visual-planner §7)
     * @param anchors  narrative anchors theo sceneId (§4)
     * @param context  { history: [preset,...], worldState, segmentationByBeat }
     */
    async direct(beatPlans, anchors, context = {}) {
      const byScene = new Map((anchors || []).map(item => [item.sceneId, item]));
      const hasLLM = providers && providers.has('analyze');
      const history = Array.isArray(context.history) ? context.history.slice() : [];
      const segByBeat = context.segmentationByBeat || {};
      const plans = [];
      for (let index = 0; index < (beatPlans || []).length; index += 1) {
        const entry = beatPlans[index];
        const beat = { ...entry.beat || {}, segmentation: segByBeat[entry.beatId] };
        let motionPlan = null;
        if (hasLLM) {
          try {
            const prompt = `Choose a motion plan for this documentary beat. Return JSON: { preset (one of ${Object.keys(PRESETS).join('|')}), intensity (0-1), duration, direction }.\nBeat: "${entry.beat && entry.beat.text}"\nVisual importance: ${entry.plan && entry.plan.visualImportance}\nRecent presets to avoid: ${history.slice(-2).join(', ')}`;
            const result = await providers.call('analyze', 'analyze', { prompt });
            if (costs) costs.recordFromProvider(result);
            const parsed = parseStructured(result.content || '', MOTION_PLAN_SCHEMA);
            if (parsed.ok) motionPlan = parsed.value;
            else if (logger) logger(`motion-director: invalid LLM output, fallback`);
          } catch (error) {
            if (logger) logger(`motion-director: provider failed (${error.message}), fallback`);
          }
        }
        if (!motionPlan) {
          const anchor = byScene.get(entry.sceneId);
          const heuristic = heuristicPreset({ visualPlan: entry.plan, beat, anchor, history });
          const key = cache ? cache.key('motion', { text: entry.beat && entry.beat.text, importance: entry.plan && entry.plan.visualImportance, history: history.slice(-2) }) : null;
          if (cache) {
            const { value, cached } = await cache.wrap(key, async () => heuristic);
            if (cached && costs) costs.record('cacheHits');
            motionPlan = value;
          } else motionPlan = heuristic;
        }
        const normalized = normalizeMotionPlan(motionPlan);
        history.push(normalized.preset);
        plans.push({ beatId: entry.beatId, sceneId: entry.sceneId, motion: normalized });
      }
      return { plans, history };
    },
  };
}

module.exports = { createMotionDirector, heuristicPreset, MOTION_PLAN_SCHEMA };