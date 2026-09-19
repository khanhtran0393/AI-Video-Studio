'use strict';
// §26 trạng thái chuẩn + helper chung của orchestrator.
// GENERATING_SCENE_VIDEOS là stage TÙY CHỌN (chỉ khi options.flowVideo.enabled — video gen
// Flow làm nền): PROGRESS chèn 58 giữa BUILDING_VISUAL_PLAN và BUILDING_VIDEO_SPEC.
const PROGRESS = { CREATED: 0, DISCOVERING: 5, ANALYZING_SCRIPT: 12, ANALYZING_TTS: 20, ANALYZING_ASSETS: 30,
  PROCESSING_ASSETS: 35, BUILDING_STORY_PLAN: 42, BUILDING_VISUAL_PLAN: 50, GENERATING_SCENE_VIDEOS: 58,
  BUILDING_VIDEO_SPEC: 63, BUILDING_TIMELINE: 68, PREVIEW_RENDER: 74, PREVIEW_QA: 80, AUTO_FIX: 85,
  FULL_RENDER: 89, FINAL_QA: 93, UPLOADING: 97, COMPLETED: 100 };
const hashMap = (m) => Object.fromEntries((m.assets || []).map(a => [a.assetId, a.hash || 'x']));
const styleVer = (cfg) => 'sty' + JSON.stringify((cfg && cfg.style) || {}).length;
module.exports = { PROGRESS, hashMap, styleVer };
