'use strict';

function makeTimeline(scenes, alignment, options = {}) {
  const source = Array.isArray(scenes) ? scenes : [];
  const words = Array.isArray(alignment && alignment.words) ? alignment.words : [];
  const defaultDuration = Math.max(0.5, Number(options.defaultDurationSec) || 3);
  let cursor = 0;
  let wordCursor = 0;
  const planned = source.map((scene, index) => {
    const wordCount = String(scene.text || '').match(/\S+/g)?.length || 0;
    const matching = words.slice(wordCursor, wordCursor + wordCount);
    wordCursor += wordCount;
    const alignedDuration = matching.length
      ? (Number(matching[matching.length - 1].end) || 0) - (Number(matching[0].start) || 0)
      : 0;
    const durationSec = Math.max(0.5, Number((alignedDuration || defaultDuration).toFixed(3)));
    const item = {
      ...scene,
      index,
      startSec: Number(cursor.toFixed(3)),
      durationSec,
      endSec: Number((cursor + durationSec).toFixed(3)),
      transition: index ? 'crossfade' : 'none',
    };
    cursor += durationSec;
    return item;
  });
  return {
    durationSec: Number(cursor.toFixed(3)),
    scenes: planned,
    tracks: [{ id: 'narration', type: 'audio', locked: true }, { id: 'visuals', type: 'visual' }],
  };
}

function validateTimeline(timeline) {
  const errors = [];
  let end = 0;
  for (const scene of (timeline && timeline.scenes) || []) {
    const start = Number(scene.startSec);
    const duration = Number(scene.durationSec);
    const sceneEnd = Number(scene.endSec);
    if (![start, duration, sceneEnd].every(Number.isFinite) || start < 0 || duration <= 0) errors.push({ code: 'invalid-timing', sceneId: scene.sceneId });
    if (start < end - 0.001) errors.push({ code: 'overlap', sceneId: scene.sceneId });
    if (start > end + 0.001) errors.push({ code: 'gap', sceneId: scene.sceneId });
    if (Math.abs(sceneEnd - (start + duration)) > 0.002) errors.push({ code: 'end-mismatch', sceneId: scene.sceneId });
    end = Math.max(end, sceneEnd);
  }
  if (timeline && Math.abs(Number(timeline.durationSec) - end) > 0.002) errors.push({ code: 'duration-mismatch' });
  return errors;
}

module.exports = { makeTimeline, validateTimeline };