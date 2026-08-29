'use strict';

/**
 * §16/§17 — LAYER SEGMENTATION + 2.5D PARALLAX. Interface tách background/
 * midground/foreground/subject/objects. Có SegmentationProvider → dùng model;
 * không có → deterministic fallback: 1 layer + depth giả định, ghi rõ quality
 * 'none' để Motion Director không chọn parallax mạnh. Không phá hủy asset gốc:
 * chỉ lưu masks/layers/depth là metadata.
 */

const crypto = require('crypto');

function segmentationFingerprint(asset) {
  return crypto.createHash('sha256').update(JSON.stringify({ id: asset.id, path: asset.path || asset.src })).digest('hex');
}

/** Fallback: chưa tách layer được → 1 layer duy nhất, quality 'none'. */
function fallbackSegmentation(asset) {
  return {
    fingerprint: segmentationFingerprint(asset),
    quality: 'none',
    provider: 'fallback',
    layers: [{ name: 'full', role: 'full', depth: 1, source: 'original' }],
    depthMap: null,
  };
}

function createSegmenter({ providers, cache, costs, logger } = {}) {
  return {
    async segment(asset) {
      const fingerprint = segmentationFingerprint(asset);
      if (asset && asset.segmentation && asset.segmentation.fingerprint === fingerprint) return asset.segmentation;
      const key = cache ? cache.key('segmentation', { fingerprint }) : null;
      const compute = async () => {
        if (providers && providers.has('vision')) {
          try {
            const result = await providers.call('vision', 'vision', {
              imageDataUrl: asset.dataUrl || asset.src,
              prompt: 'Segment this image into layers. Return JSON: { quality: "good"|"partial"|"none", layers: [{ name, role: background|midground|foreground|subject|object, depth: 0-2 }] }.',
            });
            if (costs) costs.record('visionCalls');
            const parsed = require('../core/llm-json').parseStructured(result.content || '', {
              type: 'object', required: ['quality', 'layers'],
              properties: { quality: { type: 'string', enum: ['good', 'partial', 'none'] }, layers: { type: 'array', items: { type: 'object', required: ['name', 'role'], properties: { name: { type: 'string' }, role: { type: 'string' }, depth: { type: 'number', minimum: 0, maximum: 2 } } } } },
            });
            if (parsed.ok && parsed.value.layers.length) {
              return { fingerprint, quality: parsed.value.quality, provider: 'vision-provider', layers: parsed.value.layers.map(layer => ({ name: layer.name, role: layer.role, depth: layer.depth === undefined ? 1 : layer.depth, source: 'model' })), depthMap: null };
            }
          } catch (error) {
            if (logger) logger(`segmenter: provider failed (${error.message}), fallback`);
          }
        }
        return fallbackSegmentation(asset);
      };
      if (cache) {
        const { value, cached } = await cache.wrap(key, compute);
        if (cached) return value;
        return value;
      }
      return compute();
    },
    /** §17: sinh parallax params deterministic từ segmentation + intensity. */
    parallaxParams(segmentation, intensity = 0.5) {
      const clamp = value => Math.min(1.5, Math.max(0, Number(value) || 0));
      if (!segmentation || !Array.isArray(segmentation.layers) || segmentation.quality === 'none') {
        return { supported: false, layers: [{ role: 'full', factor: 1 }] };
      }
      const factors = { background: 0.3, midground: 0.6, subject: 0.8, object: 0.9, foreground: 1.2, full: 1 };
      return {
        supported: true,
        layers: segmentation.layers.map(layer => ({ role: layer.role, name: layer.name, depth: layer.depth, factor: Number((clamp(factors[layer.role] ?? 1) * intensity).toFixed(3)) })),
      };
    },
  };
}

module.exports = { createSegmenter, fallbackSegmentation };