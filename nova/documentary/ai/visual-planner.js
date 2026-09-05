'use strict';

/**
 * §7 — VISUAL PLANNER. Pipeline bắt buộc: Narration → Narrative Analysis →
 * Visual Intent → Prompt. Không tạo prompt trực tiếp từ narration.
 * Mỗi visual beat có: visual intent, subject, shot type, camera, mood,
 * required asset type, desired motion, transition.
 */

const { parseStructured } = require('../core/llm-json');

const VISUAL_PLAN_SCHEMA = {
  type: 'object',
  required: ['visualIntent', 'shotType', 'requiredAssetType'],
  properties: {
    visualIntent: { type: 'string' },
    subject: { type: 'array', items: { type: 'string' } },
    action: { type: 'string' },
    environment: { type: 'string' },
    composition: { type: 'string' },
    camera: { type: 'string' },
    shotType: { type: 'string', enum: ['wide', 'medium', 'close-up', 'detail', 'map', 'environment', 'portrait'] },
    mood: { type: 'string' },
    visualImportance: { type: 'string', enum: ['low', 'medium', 'high'] },
    requiredAssetType: { type: 'string', enum: ['image', 'video', 'map', 'motion-graphics', 'any'] },
    desiredMotion: { type: 'string' },
    transition: { type: 'string' },
    // Ngữ pháp điện ảnh cho prompt sinh ảnh (mở rộng §7, 2026-09) — AI chỉ CHỌN tên, enum cố định.
    lens: { type: 'string', enum: ['wide-angle', 'standard', 'telephoto', 'macro', 'anamorphic'] },
    lighting: { type: 'string', enum: ['golden-hour', 'overcast', 'harsh-noon', 'night', 'studio', 'candlelight'] },
    grade: { type: 'string', enum: ['natural', 'warm-vintage', 'cold-documentary', 'high-contrast', 'bleach-bypass'] },
    visualPrompt: { type: 'string' },
    negativePrompt: { type: 'string' },
  },
};

const SHOT_ROTATION = ['wide', 'medium', 'close-up', 'detail', 'environment'];

function heuristicPlan(beat, anchor, index) {
  const a = anchor && anchor.anchor ? anchor.anchor : {};
  const importance = a.importance || 'medium';
  const shotType = SHOT_ROTATION[index % SHOT_ROTATION.length];
  const subjects = [...(a.who || []), ...(a.location || [])].filter(Boolean);
  return {
    visualIntent: `Show ${(a.who && a.who[0]) || 'the subject'} ${a.action && a.action[0] || 'present'} in ${a.environment || 'the setting'}`.trim(),
    subject: subjects.length ? subjects : ['scene subject'],
    action: (a.action && a.action[0]) || '',
    environment: a.environment || '',
    composition: shotType === 'close-up' ? 'centered subject, shallow depth' : 'rule of thirds, layered depth',
    camera: shotType === 'wide' ? 'slow push in' : shotType === 'close-up' ? 'subtle drift' : 'gentle pan',
    shotType,
    mood: a.mood || 'neutral',
    visualImportance: importance,
    requiredAssetType: (a.location && /map|bản đồ|lãnh thổ|empire|mở rộng/.test((a.location || []).join(' '))) ? 'map' : 'image',
    desiredMotion: importance === 'high' ? 'parallax' : 'ken-burns',
    transition: 'crossfade',
    // Heuristic điện ảnh: ánh sáng theo mood, lens theo shotType — deterministic, không đổi khi same input.
    lens: shotType === 'wide' || shotType === 'environment' ? 'wide-angle' : shotType === 'detail' ? 'macro' : shotType === 'portrait' ? 'telephoto' : 'standard',
    lighting: /somber|dark|night|tối|hạ/i.test(a.mood || '') ? 'night' : /warm|golden|ấm/i.test(a.mood || '') ? 'golden-hour' : 'overcast',
    grade: /old|ancient|lịch sử|xưa|vintage/i.test((a.location || []).join(' ')) ? 'warm-vintage' : 'natural',
    visualPrompt: '',
    negativePrompt: 'text, watermark, low quality, distorted faces',
  };
}

function buildPromptFromPlan(plan, beat) {
  const parts = [
    plan.visualIntent,
    plan.subject && plan.subject.length ? `subject: ${plan.subject.join(', ')}` : '',
    plan.environment ? `environment: ${plan.environment}` : '',
    plan.action ? `action: ${plan.action}` : '',
    `${plan.shotType} shot, ${plan.composition}`,
    plan.lens ? `${plan.lens} lens` : '',
    plan.lighting ? `${plan.lighting} lighting` : '',
    plan.grade ? `${plan.grade} color grade` : '',
    plan.mood ? `mood: ${plan.mood}` : '',
    'photorealistic documentary cinematography, cinematic lighting, 16:9',
  ].filter(Boolean);
  return parts.join(', ');
}

function createVisualPlanner({ providers, cache, costs, logger } = {}) {
  return {
    VISUAL_PLAN_SCHEMA,
    /**
     * @param beats [{ beatId, sceneId, text, startSec, endSec }]
     * @param anchors narrative anchors theo sceneId (§4)
     */
    async plan(beats, anchors) {
      const byScene = new Map((anchors || []).map(item => [item.sceneId, item]));
      const hasLLM = providers && providers.has('analyze');
      const plans = [];
      for (let index = 0; index < (beats || []).length; index += 1) {
        const beat = beats[index];
        const anchor = byScene.get(beat.sceneId);
        let plan = null;
        if (hasLLM) {
          try {
            const context = anchor ? JSON.stringify(anchor.anchor) : '{}';
            const prompt = `Design a visual plan for this documentary beat. Return JSON with keys: visualIntent, subject (array), action, environment, composition, camera, shotType (wide|medium|close-up|detail|map|environment|portrait), mood, visualImportance (low|medium|high), requiredAssetType (image|video|map|motion-graphics|any), desiredMotion, transition, lens (wide-angle|standard|telephoto|macro|anamorphic), lighting (golden-hour|overcast|harsh-noon|night|studio|candlelight), grade (natural|warm-vintage|cold-documentary|high-contrast|bleach-bypass).\nNarration beat: "${beat.text}"\nNarrative anchor: ${context}`;
            const result = await providers.call('analyze', 'analyze', { prompt });
            if (costs) costs.recordFromProvider(result);
            const parsed = parseStructured(result.content || '', VISUAL_PLAN_SCHEMA);
            if (parsed.ok) plan = { ...heuristicPlan(beat, anchor, index), ...parsed.value };
            else if (logger) logger(`visual-planner: invalid LLM output, fallback`);
          } catch (error) {
            if (logger) logger(`visual-planner: provider failed (${error.message}), fallback`);
          }
        }
        if (!plan) {
          const key = cache ? cache.key('visual-plan', { text: beat.text, sceneId: beat.sceneId, index }) : null;
          if (cache) {
            const { value, cached } = await cache.wrap(key, async () => heuristicPlan(beat, anchor, index));
            if (cached && costs) costs.record('cacheHits');
            plan = value;
          } else {
            plan = heuristicPlan(beat, anchor, index);
          }
        }
        plan.visualPrompt = plan.visualPrompt || buildPromptFromPlan(plan, beat);
        plans.push({ beatId: beat.beatId, sceneId: beat.sceneId, plan });
      }
      return plans;
    },
  };
}

module.exports = { createVisualPlanner, heuristicPlan, buildPromptFromPlan, VISUAL_PLAN_SCHEMA };