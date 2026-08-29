'use strict';

/**
 * §10 — ASSET DATABASE. Lưu metadata, embeddings, vision, segmentation, usage/
 * rejection history. Hỗ trợ semantic search: narration → embedding → top N.
 * Embedding qua provider nếu có; không có → deterministic hash embedding (bag
 * of tokens → vector cố định chiều), vẫn hoạt động và reproducible offline.
 */

const crypto = require('crypto');
const { tokenize } = require('../core/alignment');

const EMBED_DIM = 64;

/** Deterministic hash embedding: mỗi token → hash → mod dim, cộng +1. Vector normalize. */
function deterministicEmbed(text) {
  const vec = new Array(EMBED_DIM).fill(0);
  for (const token of tokenize(String(text || ''))) {
    const key = token.toLowerCase();
    const hash = crypto.createHash('sha1').update(key, 'utf8').digest();
    const index = hash.readUInt32BE(0) % EMBED_DIM;
    vec[index] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map(value => Number((value / norm).toFixed(6)));
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

function createAssetDatabase({ providers, cache, costs, logger } = {}) {
  const index = new Map(); // assetId → record

  async function embedText(text) {
    const key = cache ? cache.key('embed', { text }) : null;
    const compute = async () => {
      if (providers && providers.has('embed')) {
        try {
          const vector = await providers.call('embed', 'embed', { text });
          if (costs) costs.record('embedCalls');
          if (Array.isArray(vector) && vector.length) return vector;
        } catch (error) {
          if (logger) logger(`asset-database: embed provider failed, fallback deterministic`);
        }
      }
      return deterministicEmbed(text);
    };
    if (cache) {
      const { value, cached } = await cache.wrap(key, compute);
      if (cached && costs) costs.record('cacheHits');
      return value;
    }
    return compute();
  }

  return {
    embedText,
    deterministicEmbed,
    upsert(asset, vision, embedding) {
      const id = String(asset && (asset.id || asset.assetId));
      if (!id) throw new Error('asset id is required');
      const record = index.get(id) || { id, asset: { ...asset, id }, vision: null, embedding: null, usage: 0, rejections: 0, prompt: asset && asset.prompt };
      record.asset = { ...record.asset, ...asset };
      if (vision) record.vision = vision;
      if (Array.isArray(embedding)) record.embedding = embedding;
      index.set(id, record);
      return record;
    },
    get(id) { const record = index.get(String(id)); return record ? { ...record } : null; },
    list() { return [...index.values()].map(record => ({ ...record })); },
    markUsed(id) { const record = index.get(String(id)); if (record) record.usage += 1; return record; },
    markRejected(id) { const record = index.get(String(id)); if (record) record.rejections += 1; return record; },
    size() { return index.size; },
    /**
     * Semantic search (§10): query embedding → cosine top N.
     * Bỏ asset có qualityScore thấp hoặc bị reject quá nhiều.
     */
    async search(query, { topN = 10, minQuality = 0 } = {}) {
      const queryVec = await embedText(query);
      const ranked = [...index.values()]
        .filter(record => (record.vision && record.vision.qualityScore || 1) >= minQuality)
        .map(record => ({ assetId: record.id, score: record.embedding ? cosine(queryVec, record.embedding) : 0, record }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
      return ranked.map(item => ({ assetId: item.assetId, score: Number(item.score.toFixed(4)), asset: item.record.asset, vision: item.record.vision }));
    },
    /** Index toàn bộ asset: vision + embedding song song qua queue (§29). */
    async indexAll(assets, visionAnalyzer, queue) {
      const results = [];
      const tasks = (assets || []).map(asset => ({
        key: `assetdb:${asset.id || asset.assetId}`,
        task: async () => {
          const vision = visionAnalyzer ? await visionAnalyzer.analyze(asset) : null;
          const embedding = await embedText([asset.title, asset.tags, vision && vision.description].filter(Boolean).join(' '));
          return this.upsert(asset, vision, embedding);
        },
      }));
      if (queue) {
        const outcomes = await queue.runAll(tasks);
        for (const outcome of outcomes) if (outcome.ok && outcome.result) results.push(outcome.result);
      } else {
        for (const task of tasks) results.push(await task.task());
      }
      return results;
    },
  };
}

module.exports = { createAssetDatabase, deterministicEmbed, cosine, EMBED_DIM };