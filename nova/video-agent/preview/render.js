'use strict';
// §18 Preview Render — render nhẹ (giảm hoặc chọn cảnh) trước full render để phát hiện lỗi sớm.
// Không render full video mỗi lần sửa (§32.11: không render full khi preview chưa PASS).

function selectScenesForPreview(spec, opts = {}) {
  const max = Number(opts.maxScenes) || 0;
  const ids = Array.isArray(opts.sceneIds) ? opts.sceneIds : null;
  if (ids) return (spec.scenes || []).filter(s => ids.includes(s.id));
  if (max > 0) return (spec.scenes || []).slice(0, max);
  return spec.scenes || [];
}

function buildPreviewSpec(spec, opts = {}) {
  const scenes = selectScenesForPreview(spec, opts);
  if (!scenes.length) return null;
  // Preview: giãn thời gian/keep nguyên timing (TTS master clock không được thay đổi §1.1) — chỉ giảm nội dung.
  return {
    project: spec.project + '-preview', fps: spec.fps,
    resolution: { width: opts.width || 854, height: opts.height || 480 }, // 480p (§18)
    audio: spec.audio, style: spec.style, scenes, _preview: true,
  };
}

async function renderPreview({ adapter, spec, manifest, projectDir, voicePath, musicPath, opts = {}, onProgress }) {
  const previewSpec = buildPreviewSpec(spec, opts);
  if (!previewSpec) return { ok: false, code: 'VA_PREVIEW_EMPTY', error: 'Không có cảnh để preview' };
  const fs = require('fs'), path = require('path');
  const outDir = path.join(projectDir, 'output'); try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
  const outputPath = path.join(outDir, `preview-${Date.now()}.mp4`);
  const r = await adapter.render({ spec: previewSpec, manifest, outputPath, quality: 'preview', voicePath, musicPath, onProgress });
  return Object.assign({}, r, { preview: true, outputPath: r.outputPath || outputPath });
}

module.exports = { renderPreview, buildPreviewSpec, selectScenesForPreview };
