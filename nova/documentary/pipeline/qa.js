'use strict';

const { validateTimeline } = require('./timeline');
const { validateAssetReferences } = require('./asset-matcher');

function runQa(project) {
  const errors = [];
  const warnings = [];
  const timelineErrors = validateTimeline(project && project.timeline);
  errors.push(...timelineErrors.map(item => ({ ...item, message: `Timeline ${item.code}` })));
  errors.push(...validateAssetReferences(project && project.timeline && project.timeline.scenes));
  const alignment = project && project.alignment;
  if (!alignment || !Array.isArray(alignment.words) || !alignment.words.length) errors.push({ code: 'missing-alignment', message: 'No word alignment is available' });
  if (alignment && alignment.provider === 'deterministic') warnings.push({ code: 'alignment-fallback', message: 'Deterministic timing is being used; provide an external alignment adapter for production.' });

  // §22 nâng cấp — QA mức beat: asset thiếu + confidence thấp (cảnh báo, không chặn).
  const scenes = (project && project.timeline && project.timeline.scenes) || [];
  let beatCount = 0;
  for (const scene of scenes) {
    for (const beat of scene.beats || []) {
      beatCount += 1;
      if (!beat.assetId) warnings.push({ code: 'missing-beat-asset', sceneId: scene.sceneId, beatId: beat.beatId, message: `No asset matched for beat ${beat.beatId}` });
      else if (Number(beat.confidence) > 0 && Number(beat.confidence) < 0.15) warnings.push({ code: 'low-confidence', sceneId: scene.sceneId, beatId: beat.beatId, message: `Asset confidence ${beat.confidence} below threshold for beat ${beat.beatId}` });
      if (beat.motion && !beat.motion.preset) errors.push({ code: 'invalid-motion', sceneId: scene.sceneId, beatId: beat.beatId, message: `Motion plan missing preset for beat ${beat.beatId}` });
    }
  }
  // §21 hard rule 1: video duration phải khớp audio (alignment là master).
  const audioEnd = alignment && Array.isArray(alignment.words) && alignment.words.length ? alignment.words[alignment.words.length - 1].end : 0;
  if (audioEnd > 0 && Math.abs(Number(project.timeline.durationSec) - audioEnd) > 0.5) {
    warnings.push({ code: 'duration-drift', message: `Timeline duration ${project.timeline.durationSec}s differs from audio end ${audioEnd}s` });
  }
  const status = errors.length ? 'fail' : warnings.length ? 'pass-with-warnings' : 'pass';
  return { status, errors, warnings, beatsChecked: beatCount };
}

function autoFix(project, options = {}) {
  if (!project || !project.timeline || !Array.isArray(project.timeline.scenes)) return project;
  let cursor = 0;
  const scenes = project.timeline.scenes.map(scene => {
    const durationSec = Math.max(0.5, Number(scene.durationSec) || 0.5);
    const fixed = { ...scene, startSec: Number(cursor.toFixed(3)), durationSec: Number(durationSec.toFixed(3)), endSec: Number((cursor + durationSec).toFixed(3)) };
    // Đồng bộ lại beat offsets sau khi kéo timeline (beat nối tiếp trong scene).
    if (Array.isArray(scene.beats) && scene.beats.length) {
      let beatCursor = fixed.startSec;
      fixed.beats = scene.beats.map(beat => {
        const beatDuration = Math.max(0.3, (Number(beat.endSec) - Number(beat.startSec)) || 1);
        const fixedBeat = { ...beat, startSec: Number(beatCursor.toFixed(3)), endSec: Number((beatCursor + beatDuration).toFixed(3)) };
        beatCursor += beatDuration;
        return fixedBeat;
      });
    }
    cursor += durationSec;
    return fixed;
  });
  project.timeline = { ...project.timeline, scenes, durationSec: Number(cursor.toFixed(3)) };
  if (options.mark) project.pipeline = { ...(project.pipeline || {}), autoFixed: true };
  return project;
}

module.exports = { runQa, autoFix };