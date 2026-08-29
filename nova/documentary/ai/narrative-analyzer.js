'use strict';

/**
 * §4 — NARRATIVE ANALYSIS. Tạo Narrative Anchor (who/what/where/when/why/action/
 * object/environment/emotion/importance) cho từng scene. LLM là planner; nếu không
 * có cloud provider → heuristic deterministic fallback (tên riêng viết hoa, bảng
 * từ vựng hành động/thời gian/cảm xúc Việt+Anh). Output luôn validate schema (§35).
 */

const { parseStructured } = require('../core/llm-json');

const ANCHOR_SCHEMA = {
  type: 'object',
  required: ['who', 'action', 'location', 'time', 'mood', 'importance'],
  properties: {
    who: { type: 'array', items: { type: 'string' } },
    what: { type: 'array', items: { type: 'string' } },
    action: { type: 'array', items: { type: 'string' } },
    location: { type: 'array', items: { type: 'string' } },
    time: { type: 'array', items: { type: 'string' } },
    object: { type: 'array', items: { type: 'string' } },
    environment: { type: 'string' },
    emotion: { type: 'string' },
    mood: { type: 'string' },
    historicalContext: { type: 'string' },
    importantFacts: { type: 'array', items: { type: 'string' } },
    importance: { type: 'string', enum: ['low', 'medium', 'high'] },
    emphasis: { type: 'array', items: { type: 'string' } },
  },
};

// Bảng từ vựng heuristic (vi + en) — fallback khi không có LLM.
const LEXICON = {
  action: ['tiến', 'hành quân', 'chiến đấu', 'xây dựng', 'phá hủy', 'mở rộng', 'khám phá', 'di chuyển', 'attack', 'march', 'build', 'destroy', 'expand', 'explore', 'travel', 'rise', 'fall'],
  location: ['rừng', 'biển', 'núi', 'thành phố', 'làng', 'đền', 'cung điện', 'sông', 'sa mạc', 'forest', 'sea', 'mountain', 'city', 'village', 'temple', 'river', 'desert', 'phía bắc', 'phía nam', 'north', 'south'],
  time: ['đêm', 'ban đêm', 'ban ngày', 'sáng', 'chiều', 'tối', 'năm', 'thế kỷ', 'night', 'day', 'morning', 'evening', 'century', 'era', 'ancient', 'ngày xưa', 'thời'],
  mood: ['tense', 'hoành tráng', 'buồn', 'vui', 'hùng vĩ', 'thảm khốc', 'epic', 'somber', 'triumphant', 'tragic', 'hopeful', 'mysterious', 'bí ẩn', 'hào hùng', 'tồi tệ'],
  emphasis: ['bùng', 'bùng lên', 'đột ngột', 'vĩ đại', 'khủng khiếp', 'sụp đổ', 'suddenly', 'great', 'terrible', 'collapse', 'không bao giờ', 'tuyệt đối'],
};

/** Heuristic: từ viết hoa không ở đầu câu → entity (who/where). */
function extractProperNouns(text) {
  const found = [];
  for (const sentence of String(text || '').split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ-]*/g) || [];
    words.forEach((word, index) => {
      if (index > 0 && /^[A-ZÀ-Ỹ]/.test(word) && word.length > 2) found.push(word);
    });
  }
  return [...new Set(found)].slice(0, 6);
}

function matchLexicon(text, keys) {
  const lower = String(text || '').toLowerCase();
  return keys.filter(key => lower.includes(key));
}

function heuristicAnchor(scene, index, total) {
  const text = String(scene.text || '');
  const proper = extractProperNouns(text);
  const locations = matchLexicon(text, LEXICON.location);
  return {
    who: proper.filter(word => !locations.some(location => location.toLowerCase() === word.toLowerCase())),
    action: matchLexicon(text, LEXICON.action).slice(0, 3),
    location: locations.slice(0, 3),
    time: matchLexicon(text, LEXICON.time).slice(0, 2),
    environment: locations[0] || '',
    emotion: '',
    mood: matchLexicon(text, LEXICON.mood)[0] || 'neutral',
    importantFacts: [],
    importance: index === 0 || index === total - 1 || matchLexicon(text, LEXICON.emphasis).length ? 'high' : 'medium',
    emphasis: matchLexicon(text, LEXICON.emphasis).slice(0, 3),
  };
}

function createNarrativeAnalyzer({ providers, cache, costs, logger } = {}) {
  async function analyze(scenes) {
    const list = Array.isArray(scenes) ? scenes : [];
    const hasLLM = providers && providers.has('analyze');
    const anchors = [];
    for (let index = 0; index < list.length; index += 1) {
      const scene = list[index];
      let anchor = null;
      if (hasLLM) {
        try {
          const prompt = `Analyze this documentary narration scene, return JSON with keys: who, what, action, location, time, object, environment, emotion, mood, historicalContext, importantFacts, importance (low|medium|high), emphasis.\nNarration: "${scene.text}"`;
          const result = await providers.call('analyze', 'analyze', { prompt });
          if (costs) costs.recordFromProvider(result);
          const parsed = parseStructured(result.content || '', ANCHOR_SCHEMA);
          if (parsed.ok) anchor = { ...heuristicAnchor(scene, index, list.length), ...parsed.value };
          else if (logger) logger(`narrative-analyzer: invalid LLM output (${parsed.errors.join('; ')}), fallback`);
        } catch (error) {
          if (logger) logger(`narrative-analyzer: provider failed (${error.message}), fallback`);
        }
      }
      if (!anchor) {
        const key = cache ? cache.key('anchor', { text: scene.text, index, total: list.length }) : null;
        if (cache) {
          const { value, cached } = await cache.wrap(key, async () => heuristicAnchor(scene, index, list.length));
          if (cached && costs) costs.record('cacheHits');
          anchor = value;
        } else {
          anchor = heuristicAnchor(scene, index, list.length);
        }
      }
      anchors.push({ sceneId: scene.sceneId, sourceText: scene.text, anchor });
    }
    return anchors;
  }

  return { ANCHOR_SCHEMA, analyze };
}

module.exports = { createNarrativeAnalyzer, heuristicAnchor, ANCHOR_SCHEMA, LEXICON };