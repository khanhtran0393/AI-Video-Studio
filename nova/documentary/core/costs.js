'use strict';

/**
 * §36 — COST CONTROL. Theo dõi token, API calls, image/vision/TTS/i2v + cost ước tính.
 * Không gọi AI nếu cache hit — engine ghi nhận cả cache hits để UI hiển thị tiết kiệm.
 */

function createCostTracker({ pricing = {} } = {}) {
  // Đơn giá mặc định (USD / 1k đơn vị) — chỉ để ước tính, override được qua config.
  const rates = {
    inputTokens: 0.00015,
    outputTokens: 0.0006,
    visionCalls: 0.003,
    embedCalls: 0.00002,
    ttsSeconds: 0.015,
    imageGenerations: 0.04,
    imageToVideo: 0.3,
    ...pricing,
  };
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    apiCalls: 0,
    visionCalls: 0,
    embedCalls: 0,
    ttsSeconds: 0,
    imageGenerations: 0,
    imageToVideoCalls: 0,
    cacheHits: 0,
  };
  const api = {
    usage,
    rates,
    record(kind, amount = 1) {
      if (!(kind in usage)) throw new TypeError(`Unknown usage kind: ${kind}`);
      usage[kind] += amount;
      if (kind !== 'cacheHits') usage.apiCalls += 1;
      return api;
    },
    recordFromProvider(result) {
      if (!result || typeof result !== 'object') return api;
      const u = result.usage;
      if (u && typeof u === 'object') {
        if (u.prompt_tokens) usage.inputTokens += Number(u.prompt_tokens) || 0;
        if (u.completion_tokens) usage.outputTokens += Number(u.completion_tokens) || 0;
      }
      usage.apiCalls += 1;
      return api;
    },
    estimatedCost() {
      return Number((
        usage.inputTokens / 1000 * rates.inputTokens +
        usage.outputTokens / 1000 * rates.outputTokens +
        usage.visionCalls * rates.visionCalls +
        usage.embedCalls * rates.embedCalls +
        usage.ttsSeconds * rates.ttsSeconds +
        usage.imageGenerations * rates.imageGenerations +
        usage.imageToVideoCalls * rates.imageToVideo
      ).toFixed(6));
    },
    snapshot() { return { usage: { ...usage }, estimatedCost: api.estimatedCost() }; },
  };
  return api;
}

module.exports = { createCostTracker };