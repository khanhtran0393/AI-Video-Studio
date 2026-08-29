'use strict';

/**
 * §19 — AUDIO-DRIVEN VISUAL EMPHASIS (Attention Controller). Mỗi thời điểm có
 * attention target; tại emphasis thì brightness/particle/scale/motion thay đổi.
 * Không để mọi layer chuyển động mạnh cùng lúc: chỉ 1 target active tại mỗi mốc.
 */

const EMPHASIS_LEXICON = ['bùng', 'bùng lên', 'vĩ đại', 'sụp đổ', 'khủng khiếp', 'đột ngột', 'tuyệt đối', 'không bao giờ', 'explodes', 'collapses', 'suddenly', 'never', 'greatest', 'terrible'];

function detectEmphasis(beatText, words) {
  const text = String(beatText || '').toLowerCase();
  const targets = [];
  for (const entry of words || []) {
    const word = String(entry.word || '');
    const isCaps = word.length > 2 && word === word.toUpperCase() && /[A-ZÀ-Ỹ]/.test(word);
    const isLexicon = EMPHASIS_LEXICON.some(key => key === word.toLowerCase() || text.includes(word.toLowerCase()) && EMPHASIS_LEXICON.includes(word.toLowerCase()));
    if (isCaps || isLexicon) {
      targets.push({ word, start: Number(entry.start) || 0, end: Number(entry.end) || 0, kind: 'word-emphasis' });
    }
  }
  // Fallback: emphasis đầu beat nếu không tìm thấy từ nhấn mạnh.
  return targets.slice(0, 3);
}

/**
 * Tạo attention timeline cho một beat: emphasis → visual response params.
 * Response vẫn deterministic: tăng brightness nhẹ + scale subject + (tuỳ chọn) particle.
 */
function buildAttention(beat, alignmentWords) {
  const words = (alignmentWords || []).filter(word => word.start >= (beat.startSec || 0) - 0.01 && word.end <= (beat.endSec || 0) + 0.01);
  const emphasis = detectEmphasis(beat.text, words.length ? words : []);
  const targets = emphasis.map((item, index) => ({
    kind: item.kind,
    word: item.word,
    start: item.start,
    end: item.end,
    response: index === 0
      ? { brightness: 0.18, scale: 0.06, particle: 'embers', cameraPush: 0.04 }
      : { brightness: 0.1, scale: 0.03, particle: null, cameraPush: 0.02 },
  }));
  return { beatId: beat.beatId, hasEmphasis: targets.length > 0, targets };
}

module.exports = { detectEmphasis, buildAttention, EMPHASIS_LEXICON };