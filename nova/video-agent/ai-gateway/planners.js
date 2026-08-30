'use strict';
const { scriptPlanSchema, scenePlanSchema, behaviorPlanSchema } = require('./schemas');
const { validateVideoSpec } = require('../video-spec/schema');

function json(value) { return JSON.stringify(value, null, 2); }
function createPlanningAdapters(gateway, options = {}) {
  const preferredProviders = options.preferredProviders || [];
  const signal = options.signal;
  return {
    async analyzeScript(text, ctx = {}) {
      const fallback = () => ctx.fallback || {};
      const result = await gateway.execute('script.plan', { schema: scriptPlanSchema, preferredProviders, fallback, signal,
        system: 'You are Nova Script Planner. Return JSON only. Preserve facts and names. Do not invent renderer details.',
        prompt: `Analyze this scene into semantic metadata. Configured characters must be selected by id when present.\nCONFIG:\n${json(ctx.config || {})}\nSCENE:\n${text}` });
      return result.data;
    },
    async planVisual(current, storyPlan) {
      const scene = (storyPlan.scenes || []).find(x => x.sceneId === current.sceneId) || {};
      const context = current.aiContext || {};
      const fallback = () => current.visuals;
      const result = await gateway.execute('scene.plan', { schema: scenePlanSchema, preferredProviders, fallback, signal,
        system: 'You are Nova Scene Planner. Choose only ids and grammar values supplied by the prompt. Return JSON only.',
        prompt: `Refine one renderer-neutral visual plan. Never invent asset ids.\nSCENE:\n${json(scene)}\nAVAILABLE ASSETS:\n${json(context.assets || [])}\nVALID BASELINE:\n${json(current.visuals)}` });
      return result.data;
    },
    async planBehaviors(spec) {
      const fallback = () => ({ behaviors: spec.behaviors || [] });
      const compact = { duration: Math.max(0, ...(spec.scenes || []).map(x => Number(x.end) || 0)),
        scenes: (spec.scenes || []).map(s => ({ id: s.id, start: s.start, end: s.end,
          entities: (s.elements || []).map(e => ({ elementId: e.elementId, kind: e.kind, capabilities: e.capabilities })),
          captions: (s.captions || []).map(c => ({ id: c.id, start: s.start + c.start, end: s.start + c.end })) })),
        baseline: spec.behaviors || [] };
      const result = await gateway.execute('behavior.plan', { schema: behaviorPlanSchema, preferredProviders, fallback, signal,
        system: 'You are Nova Behavior Planner. Return registered behaviors only. Absolute timing must stay inside project duration. Use only supplied entity ids. Avoid property conflicts.',
        prompt: `Refine the behavior graph. Keep useful baseline behaviors and return JSON {"behaviors":[]}.\nWORLD:\n${json(compact)}` });
      const candidate = { ...spec, behaviors: result.data.behaviors };
      const checked = validateVideoSpec(candidate, { audioDuration: compact.duration });
      return checked.ok ? checked.spec.behaviors : spec.behaviors;
    },
  };
}

module.exports = { createPlanningAdapters };
