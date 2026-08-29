'use strict';

/**
 * §28 — IMAGE-TO-VIDEO. CHỈ dùng khi: cảnh quan trọng + motion thực sự cần +
 * static/parallax không đủ + user bật chế độ + có VideoProvider. Không mặc định
 * dùng cho toàn bộ project. Hỗ trợ provider/model/duration/prompt/seed/status/
 * retry/cost/output asset.
 */

function createImageToVideoGate({ providers, costs, logger } = {}) {
  return {
    /**
     * @param beats [{ beatId, visualPlan, motion }] — beat đã có motion plan
     * @param options { enabled, minImportance }
     * @returns mỗi beat được annotate `imageToVideo` plan (status: skipped|planned|queued).
     */
    plan(beats, options = {}) {
      const enabled = options.enabled === true && providers && providers.has('video');
      const minImportance = options.minImportance || 'high';
      const rank = { low: 0, medium: 1, high: 2 };
      return (beats || []).map(beat => {
        const importance = beat.visualPlan && beat.visualPlan.visualImportance || 'medium';
        const motionHeavy = beat.motion && ['PARALLAX_2_5D', 'CAMERA_ORBIT', 'PHOTO_RECONSTRUCTION'].includes(beat.motion.motionType);
        if (!options.enabled) {
          return { ...beat, imageToVideo: { status: 'skipped', reason: 'disabled-by-user' } };
        }
        if (!enabled) {
          return { ...beat, imageToVideo: { status: 'skipped', reason: 'no-video-provider' } };
        }
        if (rank[importance] < rank[minImportance] || !motionHeavy) {
          return { ...beat, imageToVideo: { status: 'skipped', reason: 'not-needed' } };
        }
        return {
          ...beat,
          imageToVideo: {
            status: 'planned',
            provider: 'video',
            prompt: beat.visualPlan.visualPrompt,
            duration: Math.min(10, Math.max(2, Number(beat.endSec) - Number(beat.startSec))),
            seed: null,
            estimatedCost: 0.3,
          },
        };
      });
    },
    /** Thực thi qua provider; retry do job queue bên ngoài đảm nhiệm (§24). */
    async generate(plan, { assetPath } = {}) {
      if (!plan || plan.status !== 'planned') throw new Error('imageToVideo plan must be planned');
      try {
        const result = await providers.call('video', 'generate', { prompt: plan.prompt, duration: plan.duration, image: assetPath });
        if (costs) costs.record('imageToVideoCalls');
        return { status: 'complete', outputAsset: result && result.outputAsset || null, cost: result && result.cost || 0.3 };
      } catch (error) {
        if (logger) logger(`image-to-video: generation failed (${error.message})`);
        return { status: 'failed', error: String(error && error.message || error) };
      }
    },
  };
}

module.exports = { createImageToVideoGate };