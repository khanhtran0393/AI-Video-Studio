'use strict';

/**
 * §9 — VISION ANALYSIS. Phân tích ảnh MỘT LẦN, lưu metadata; không gọi lại nếu
 * asset chưa đổi (hash cache). Có VisionProvider → dùng cloud; không có → fallback
 * suy ra metadata từ filename/title/tags của asset (deterministic).
 */

const crypto = require('crypto');
const fs = require('fs');
const { parseStructured } = require('../core/llm-json');

const VISION_SCHEMA = {
  type: 'object',
  required: ['description', 'subjects', 'environment', 'shotType', 'qualityScore'],
  properties: {
    description: { type: 'string' },
    subjects: { type: 'array', items: { type: 'string' } },
    people: { type: 'array', items: { type: 'string' } },
    objects: { type: 'array', items: { type: 'string' } },
    environment: { type: 'string' },
    location: { type: 'string' },
    era: { type: 'string' },
    action: { type: 'string' },
    mood: { type: 'string' },
    composition: { type: 'string' },
    shotType: { type: 'string', enum: ['wide', 'medium', 'close-up', 'detail', 'map', 'environment', 'portrait'] },
    orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
    ocrText: { type: 'string' },
    qualityScore: { type: 'number', minimum: 0, maximum: 1 },
    visualStyle: { type: 'string' },
    estimatedDepth: { type: 'string' },
    segmentationCandidates: { type: 'array', items: { type: 'string' } },
  },
};

function assetFingerprint(asset) {
  const source = String(asset && (asset.path || asset.src || asset.file || asset.id) || '');
  let fileHash = '';
  try {
    if (source && !/^(?:https?|data):/i.test(source) && fs.existsSync(source)) {
      fileHash = crypto.createHash('sha256').update(fs.readFileSync(source).slice(0, 1024 * 512)).digest('hex').slice(0, 16);
    }
  } catch (_) { /* remote hoặc unreadable: hash nội dung metadata */ }
  return crypto.createHash('sha256').update(JSON.stringify({ source, fileHash, title: asset.title, tags: asset.tags })).digest('hex');
}

function inferOrientation(asset) {
  const width = Number(asset && asset.width) || 0;
  const height = Number(asset && asset.height) || 0;
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}

/** Fallback: dựng vision metadata từ metadata có sẵn của asset. */
function heuristicVision(asset) {
  const source = String(asset && (asset.title || asset.name || '') || '');
  const tags = (Array.isArray(asset && asset.tags) ? asset.tags : String(asset && asset.tags || '').split(',')).map(tag => String(tag).trim()).filter(Boolean);
  const words = [...tags, ...source.split(/[\s_\-./]+/)].filter(Boolean).map(word => word.toLowerCase());
  const description = [source || 'Untitled visual', tags.length ? `(${tags.join(', ')})` : ''].filter(Boolean).join(' ');
  return {
    description,
    subjects: words.slice(0, 5),
    people: [],
    objects: tags.slice(0, 8),
    environment: words[0] || '',
    location: '',
    era: '',
    action: '',
    mood: '',
    composition: '',
    shotType: words.includes('map') ? 'map' : words.includes('closeup') || words.includes('close-up') ? 'close-up' : 'wide',
    orientation: inferOrientation(asset),
    ocrText: '',
    qualityScore: 0.6,
    visualStyle: '',
    estimatedDepth: '',
    segmentationCandidates: [],
    provider: 'heuristic',
  };
}

function createVisionAnalyzer({ providers, cache, costs, logger } = {}) {
  return {
    VISION_SCHEMA,
    async analyze(asset) {
      const fingerprint = assetFingerprint(asset);
      // §9: không phân tích lại nếu asset chưa đổi.
      if (asset && asset.vision && asset.vision.fingerprint === fingerprint) return asset.vision;
      const key = cache ? cache.key('vision', { fingerprint }) : null;
      const compute = async () => {
        const hasVision = providers && providers.has('vision');
        if (!hasVision) return { fingerprint, ...heuristicVision(asset) };
        try {
          const result = await providers.call('vision', 'vision', { imageDataUrl: asset.dataUrl || asset.src, prompt: 'Describe this image as JSON with keys: description, subjects, people, objects, environment, location, era, action, mood, composition, shotType (wide|medium|close-up|detail|map|environment|portrait), orientation, ocrText, qualityScore (0-1), visualStyle, estimatedDepth, segmentationCandidates.' });
          if (costs) { costs.record('visionCalls'); costs.recordFromProvider(result); }
          const parsed = parseStructured(result.content || '', VISION_SCHEMA);
          if (parsed.ok) return { fingerprint, provider: 'vision-provider', ...parsed.value };
          if (logger) logger('vision-analyzer: invalid provider output, fallback heuristic');
        } catch (error) {
          if (logger) logger(`vision-analyzer: provider failed (${error.message}), fallback heuristic`);
        }
        return { fingerprint, ...heuristicVision(asset) };
      };
      if (cache) {
        const { value, cached } = await cache.wrap(key, compute);
        if (cached && costs) costs.record('cacheHits');
        return value;
      }
      return compute();
    },
    /** Phân tích batch qua job queue (§29 parallelize). */
    async analyzeAll(assets, queue) {
      if (!queue) {
        const results = [];
        for (const asset of assets || []) results.push({ assetId: asset.id, vision: await this.analyze(asset) });
        return results;
      }
      const results = await queue.runAll((assets || []).map(asset => ({
        key: `vision:${asset.id}`,
        task: async () => ({ assetId: asset.id, vision: await this.analyze(asset) }),
      })));
      return results.filter(result => result.ok).map(result => result.result);
    },
  };
}

module.exports = { createVisionAnalyzer, heuristicVision, assetFingerprint, VISION_SCHEMA };