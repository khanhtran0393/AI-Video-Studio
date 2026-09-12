'use strict';
// §19-20 Video QA — 4 lớp. Phase 1 chạy Spatial + Temporal đầy đủ (trên spec+timeline, không cần render);
// Semantic + Continuity có hook provider (Phase 4: Vision QA trên frame render thật).
const { inspectTimeline } = require('../timeline/engine');
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

const boxOf = (el) => { const w = 26 * (el.scale || 1); return { x1: (el.x || 0) - w / 2, x2: (el.x || 0) + w / 2, y1: (el.y || 0), y2: (el.y || 0) + 55 * (el.scale || 1) }; };
const overlap = (a, b) => a.x1 < b.x2 - 1 && b.x1 < a.x2 - 1; // chat chạm 1% coi như ok

function spatialQA(spec) {
  const errors = [];
  (spec.scenes || []).forEach((sc) => {
    (sc.elements || []).forEach((el, j) => {
      const b = boxOf(el);
      if (b.x1 < -2 || b.x2 > 102 || (el.y || 0) < 0 || (el.y || 0) > 100)
        errors.push({ scene: sc.id, type: 'element_out_of_frame', severity: 'high', which: j,
          suggestedFix: { type: 'clamp_element', index: j } });
    });
    for (let a = 0; a < (sc.elements || []).length; a++) for (let b = a + 1; b < (sc.elements || []).length; b++) {
      if (overlap(boxOf(sc.elements[a]), boxOf(sc.elements[b])))
        errors.push({ scene: sc.id, type: 'character_overlap', severity: 'medium', which: b,
          suggestedFix: { type: 'nudge_element', index: b } });
    }
    (sc.captions || []).forEach((c, j) => {
      if (c.y != null && (c.y < 0 || c.y > 100))
        errors.push({ scene: sc.id, type: 'caption_placement', severity: 'medium', which: j,
          suggestedFix: { type: 'move_caption', index: j, y: 78 } });
    });
  });
  return errors;
}

function temporalQA(spec, timeline, audioDuration) {
  const errors = [];
  const tl = inspectTimeline(timeline);
  tl.issues.forEach(i => errors.push({ scene: i.scene, type: i.code.toLowerCase(), severity: i.severity === 'low' ? 'low' : i.severity,
    start: null, end: null, suggestedFix: i.code === 'VA_TL_TRANS_LONG' ? { type: 'clamp_transition', scene: i.scene } : null }));
  (spec.scenes || []).forEach((sc) => {
    (sc.captions || []).forEach((c, j) => {
      if (c.start < -0.04 || c.end > (sc.end - sc.start) + 0.04)
        errors.push({ scene: sc.id, type: 'caption_timing', severity: 'high', which: j,
          start: ROUND3(sc.start + Math.max(0, c.start)), end: ROUND3(sc.start + Math.max(0, c.end)),
          suggestedFix: { type: 'clamp_caption', index: j } });
      else if (c.end - c.start < 0.4)
        errors.push({ scene: sc.id, type: 'caption_too_short', severity: 'low', which: j,
          suggestedFix: { type: 'extend_caption', index: j } });
    });
  });
  if (Number.isFinite(audioDuration) && timeline.durationSec > audioDuration + 0.5) {
    const overrun = ROUND3(timeline.durationSec - audioDuration);
    // Vai QA_Agent (AutoGen đối kháng) — chỉ CHẨN ĐOÁN: ghi số đo cụ thể (overrunSec)
    // để Fixer (auto-fix/fixer.js) quyết định cách sửa; loại này không có rule cứng
    // nên không tự ý gắn suggestedFix.
    errors.push({ scene: null, type: 'tts_out_of_sync', severity: 'high', suggestedFix: null,
      message: `Timeline ${timeline.durationSec}s tràn ${overrun}s so với giọng đọc TTS (${audioDuration}s)`,
      audioDuration, timelineDurationSec: timeline.durationSec, overrunSec: overrun });
  }
  return errors;
}

// providers.semantic / providers.continuity: async ({spec, timeline, storyPlan, manifest, frames}) → errors[]
// (Phase 4: frames = stats frame render thật — xem qa/vision.js)
async function runQA({ spec, timeline, storyPlan, manifest, audioDuration, providers = {}, frames = null }) {
  const errors = [];
  const groups = { spatial: spatialQA(spec), temporal: temporalQA(spec, timeline, audioDuration),
    semantic: [], continuity: [] };
  const ctx = { spec, timeline, storyPlan, manifest, frames };
  if (typeof providers.semantic === 'function') { try { groups.semantic = await providers.semantic(ctx) || []; } catch (_) {} }
  if (typeof providers.continuity === 'function') { try { groups.continuity = await providers.continuity(ctx) || []; } catch (_) {} }
  for (const g of Object.values(groups)) errors.push(...g);

  const score = (list) => list.length ? Math.max(0, 1 - list.reduce((a, e) => a + (e.severity === 'high' ? 0.25 : e.severity === 'medium' ? 0.08 : 0.02), 0)) : 1;
  const scores = { timing: ROUND3(score(groups.temporal)), composition: ROUND3(score(groups.spatial)),
    continuity: ROUND3(score(groups.continuity)), caption: ROUND3(score([...groups.spatial.filter(e => e.type.startsWith('caption')), ...groups.temporal.filter(e => e.type.startsWith('caption'))])),
    semantic: ROUND3(score(groups.semantic)) };
  const hasHigh = errors.some(e => e.severity === 'high');
  const status = hasHigh || Object.values(scores).some(s => s < 0.6) ? 'fail'
    : errors.some(e => e.severity !== 'low') || Object.values(scores).some(s => s < 0.85) ? 'warning' : 'pass';
  return { status, scores, errors, generatedAt: new Date().toISOString() };
}

module.exports = { runQA, spatialQA, temporalQA };
