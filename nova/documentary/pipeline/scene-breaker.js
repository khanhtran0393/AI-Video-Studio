'use strict';

/**
 * §3 — STORY ANALYZER nâng cấp: chia narration thành SCENE, mỗi scene có nhiều
 * VISUAL BEAT. Không dùng quy tắc "1 câu = 1 scene". Beat lấy timestamp thật từ
 * alignment (audio là master — §6). Narration giữ nguyên (§2 content lock).
 */

const { tokenize } = require('../core/alignment');

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map(value => value.trim())
    .filter(Boolean);
}

/**
 * Nhóm câu thành scene theo đoạn (paragraph). Một paragraph = một scene,
 * mỗi câu (hoặc cụm) trong đó là một visual beat. wordCount giúp map beats
 * sang alignment words để có timestamp.
 */
function breakIntoScenes(narration, options = {}) {
  const minBeatWords = Math.max(1, Number(options.minBeatWords) || 4);
  const paragraphs = String(narration || '')
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  const scenes = [];
  let sceneIndex = 0;
  let sentenceCounter = 0;
  for (let pIndex = 0; pIndex < paragraphs.length; pIndex += 1) {
    const sentences = splitSentences(paragraphs[pIndex]);
    if (!sentences.length) continue;
    sceneIndex += 1;
    const sceneId = `scene_${String(sceneIndex).padStart(3, '0')}`;
    const beats = [];
    for (const sentence of sentences) {
      const words = tokenize(sentence);
      // Câu quá dài → tách thành beat theo cụm ~minBeatWords*2.
      const chunkSize = Math.max(minBeatWords, Math.ceil(words.length / Math.min(3, Math.ceil(words.length / minBeatWords))));
      for (let i = 0; i < words.length; i += chunkSize) {
        sentenceCounter += 1;
        beats.push({
          beatId: `beat_${String(sentenceCounter).padStart(4, '0')}`,
          sceneId,
          text: words.slice(i, i + chunkSize).join(' '),
          wordStart: null, // gán sau khi map sang alignment (xem assignTimestamps)
          wordEnd: null,
        });
      }
    }
    scenes.push({
      sceneId,
      index: sceneIndex - 1,
      sourceText: paragraphs[pIndex],
      role: sceneIndex === 1 ? 'hook' : pIndex === paragraphs.length - 1 ? 'close' : 'body',
      beats,
    });
  }
  return scenes;
}

/** Map beats sang word indices của alignment để gán startSec/endSec thật. */
function assignTimestamps(scenes, alignment) {
  const words = Array.isArray(alignment && alignment.words) ? alignment.words : [];
  let cursor = 0;
  for (const scene of scenes) {
    let sceneStart = null;
    let sceneEnd = 0;
    for (const beat of scene.beats) {
      const count = tokenize(beat.text).length;
      const slice = words.slice(cursor, cursor + count);
      cursor += count;
      if (slice.length) {
        beat.startSec = Number(slice[0].start) || 0;
        beat.endSec = Number(slice[slice.length - 1].end) || (beat.startSec + 1);
      } else {
        beat.startSec = sceneEnd || 0;
        beat.endSec = beat.startSec + 1;
      }
      if (sceneStart === null) sceneStart = beat.startSec;
      sceneEnd = Math.max(sceneEnd, beat.endSec);
    }
    scene.startSec = sceneStart !== null ? sceneStart : 0;
    scene.endSec = sceneEnd;
    scene.durationSec = Number((scene.endSec - scene.startSec).toFixed(3));
    // text legacy field cho asset-matcher/timeline cũ: dùng source text của scene.
    scene.text = scene.sourceText;
    scene.keywords = [...new Set(tokenize(scene.sourceText).map(word => word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '')).filter(word => word.length > 2))];
  }
  return { scenes, totalDuration: scenes.length ? scenes[scenes.length - 1].endSec : 0 };
}

module.exports = { breakIntoScenes, assignTimestamps, splitSentences };