'use strict';

const { tokenize } = require('../core/alignment');

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map(value => value.trim())
    .filter(Boolean);
}

function analyzeStory(narration) {
  const sentences = splitSentences(narration);
  const source = sentences.length ? sentences : tokenize(narration).reduce((groups, word, index) => {
    const group = Math.floor(index / 18);
    (groups[group] ||= []).push(word);
    return groups;
  }, []).map(words => words.join(' '));
  return source.map((text, index) => ({
    sceneId: `scene_${index + 1}`,
    index,
    text,
    keywords: [...new Set(tokenize(text)
      .map(word => word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter(word => word.length > 2))],
    role: index === 0 ? 'hook' : index === source.length - 1 ? 'close' : 'body',
  }));
}

module.exports = { splitSentences, analyzeStory };