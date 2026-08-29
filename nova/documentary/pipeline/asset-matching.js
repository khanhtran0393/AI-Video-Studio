'use strict';

/**
 * §11/12/13 — ASSET MATCHING nâng cấp. KHÔNG cho LLM xem toàn bộ thư viện.
 * Pipeline: narrative embedding → vector search top N → semantic ranking →
 * continuity filtering (World State) → diversity filtering → final selection.
 * Scoring: semantic + narrative + temporal + quality + continuity + diversity
 * → overall confidence.
 */

const { isUsableAsset, assetPath } = require('./asset-matcher');

function createAssetMatcher({ database, logger } = {}) {
  if (!database) throw new Error('asset database is required');

  /** World State (§12): characters/locations/era được dùng gần đây. */
  function worldStateFrom(selections) {
    const state = { characters: {}, locations: {}, era: {}, lastAssetIds: [] };
    for (const item of (selections || [])) {
      if (!item || !item.vision) continue;
      for (const subject of item.vision.subjects || []) state.characters[subject] = (state.characters[subject] || 0) + 1;
      if (item.vision.location) state.locations[item.vision.location] = (state.locations[item.vision.location] || 0) + 1;
      if (item.vision.era) state.era[item.vision.era] = (state.era[item.vision.era] || 0) + 1;
      state.lastAssetIds.push(item.assetId);
    }
    return state;
  }

  /** Continuity score (§12): thưởng asset khớp subjects/locations của world state. */
  function continuityScore(candidate, worldState) {
    if (!candidate || !candidate.vision) return 0.5;
    let score = 0.5;
    const subjects = candidate.vision.subjects || [];
    const overlap = subjects.filter(subject => worldState.characters[subject]).length;
    score += Math.min(0.3, overlap * 0.15);
    if (candidate.vision.location && worldState.locations[candidate.vision.location]) score += 0.15;
    if (candidate.vision.era && worldState.era[candidate.vision.era]) score += 0.05;
    return Math.min(1, score);
  }

  /** Diversity score (§13): phạt lặp asset + lặp shotType trong N shot gần. */
  function diversityScore(candidate, recent, { windowSize = 4 } = {}) {
    const recentAssets = recent.slice(-windowSize).map(item => item && item.assetId).filter(Boolean);
    const recentShots = recent.slice(-windowSize).map(item => item && item.vision && item.vision.shotType).filter(Boolean);
    let score = 1;
    if (recentAssets.includes(candidate.assetId)) score -= 0.6;
    if (candidate.vision && recentShots.filter(shot => shot === candidate.vision.shotType).length >= 2) score -= 0.3;
    return Math.max(0, score);
  }

  return {
    worldStateFrom,
    /**
     * Match assets cho từng beat.
     * @param beats [{ beatId, sceneId, text }]
     * @param anchors [{ sceneId, anchor }] (§4)
     * @param options { topN, minConfidence }
     */
    async match(beats, anchors, options = {}) {
      const topN = Math.max(3, Number(options.topN) || 8);
      const minConfidence = Number(options.minConfidence) || 0.1;
      const anchorByScene = new Map((anchors || []).map(item => [item.sceneId, item.anchor]));
      const selections = [];
      for (const beat of beats || []) {
        const anchor = anchorByScene.get(beat.sceneId) || {};
        // Truy vấn semantic: text beat + anchor context.
        const query = [beat.text, anchor.who, anchor.location, anchor.action].flat().filter(Boolean).join(' ');
        const candidates = await database.search(query, { topN });
        const recent = selections.map(item => ({ assetId: item.assetId, vision: item.vision }));
        const worldState = worldStateFrom(selections);
        const ranked = candidates
          .filter(candidate => isUsableAsset(candidate.asset))
          .map(candidate => {
            const semantic = Math.max(0, candidate.score);
            const narrative = anchor.who && candidate.vision && (candidate.vision.subjects || []).some(subject => anchor.who.includes(subject)) ? 1 : 0.5;
            const quality = candidate.vision && candidate.vision.qualityScore !== undefined ? candidate.vision.qualityScore : 0.5;
            const continuity = continuityScore(candidate, worldState);
            const diversity = diversityScore(candidate, recent);
            const overall = Number((semantic * 0.4 + narrative * 0.15 + quality * 0.15 + continuity * 0.15 + diversity * 0.15).toFixed(4));
            return { assetId: candidate.assetId, asset: candidate.asset, vision: candidate.vision, scores: { semantic, narrative, quality, continuity, diversity, overall }, confidence: overall };
          })
          .sort((a, b) => b.confidence - a.confidence);
        const best = ranked[0] && ranked[0].confidence >= minConfidence ? ranked[0] : null;
        if (best) {
          database.markUsed(best.assetId);
          selections.push({ beatId: beat.beatId, sceneId: beat.sceneId, assetId: best.assetId, asset: best.asset, vision: best.vision, confidence: best.confidence, candidates: ranked.slice(0, 5).map(item => ({ assetId: item.assetId, confidence: item.confidence })) });
        } else {
          for (const item of ranked.slice(0, 3)) database.markRejected(item.assetId);
          selections.push({ beatId: beat.beatId, sceneId: beat.sceneId, assetId: null, asset: null, vision: null, confidence: 0, candidates: ranked.slice(0, 5).map(item => ({ assetId: item.assetId, confidence: item.confidence })) });
        }
      }
      return selections;
    },
    /** Tìm asset thay thế cho một beat (user override / auto-fix §23). */
    async findReplacement(beat, anchors, excludeAssetIds = []) {
      const anchorByScene = new Map((anchors || []).map(item => [item.sceneId, item.anchor]));
      const anchor = anchorByScene.get(beat.sceneId) || {};
      const query = [beat.text, anchor.who, anchor.location].flat().filter(Boolean).join(' ');
      const candidates = await database.search(query, { topN: 12 });
      const pick = candidates.find(candidate => !excludeAssetIds.includes(candidate.assetId) && isUsableAsset(candidate.asset));
      return pick || null;
    },
  };
}

module.exports = { createAssetMatcher };