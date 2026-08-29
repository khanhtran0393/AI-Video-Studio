'use strict';
// §26 trạng thái chuẩn + helper chung của orchestrator.
const PROGRESS = { CREATED: 0, DISCOVERING: 5, ANALYZING_SCRIPT: 12, ANALYZING_TTS: 20, ANALYZING_ASSETS: 30,
  PROCESSING_ASSETS: 35, BUILDING_STORY_PLAN: 42, BUILDING_VISUAL_PLAN: 50, BUILDING_VIDEO_SPEC: 58,
  BUILDING_TIMELINE: 65, PREVIEW_RENDER: 72, PREVIEW_QA: 78, AUTO_FIX: 84, FULL_RENDER: 88, FINAL_QA: 93,
  UPLOADING: 97, COMPLETED: 100 };
const hashMap = (m) => Object.fromEntries((m.assets || []).map(a => [a.assetId, a.hash || 'x']));
const styleVer = (cfg) => 'sty' + JSON.stringify((cfg && cfg.style) || {}).length;
module.exports = { PROGRESS, hashMap, styleVer };
