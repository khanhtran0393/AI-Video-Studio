'use strict';
// §11 Story Plan — mô tả câu chuyện ở cấp scene/beat, KHÔNG chứa chi tiết renderer.
// Beat timing lấy từ câu trong TTS (§1.1 TTS là Master Clock): không để scene vượt audio boundary.
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

// Phân câu cho các cảnh theo trọng số độ dài text (proportional, deterministic).
// sceneCount có thể != sentenceCount: gộp/chia để mỗi cảnh ≥ 1 câu.
function assignSentences(scenes, sentences) {
  if (!sentences.length) return scenes.map(s => ({ scene: s, beats: [], start: 0, end: 0 }));
  const weights = scenes.map(s => Math.max(1, String(s.text || s.summary || '').length));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const out = [];
  let cursor = 0;
  scenes.forEach((s, i) => {
    const isLast = i === scenes.length - 1;
    const want = isLast ? sentences.length - cursor
      : Math.max(1, Math.round((weights[i] / totalW) * sentences.length));
    const take = Math.max(1, Math.min(want, sentences.length - cursor - (scenes.length - 1 - i)));
    const mine = sentences.slice(cursor, cursor + take);
    cursor += take;
    out.push({ scene: s, beats: mine, start: mine.length ? mine[0].start : 0, end: mine.length ? mine[mine.length - 1].end : 0 });
  });
  // Cảnh không có câu nào (kịch bản nhiều cảnh hơn câu): mượn câu cuối của cảnh trước có câu.
  for (let guard = 0; guard < out.length; guard++) {
    const i = out.findIndex((g, idx) => idx > 0 && !g.beats.length);
    if (i < 0) break;
    for (let p = i - 1; p >= 0; p--) {
      if (out[p].beats.length) {
        const last = out[p].beats.pop(); out[i].beats = [last];
        out[i].start = last.start; out[i].end = last.end; break;
      }
    }
  }
  return out;
}

function buildStoryPlan(scriptAnalysis, tts) {
  const scenes = scriptAnalysis.scenes || [];
  const sentences = tts.sentences || [];
  const audioDuration = ROUND3(Number(tts.duration) || (sentences.length ? sentences[sentences.length - 1].end : 0));

  const assigned = assignSentences(scenes, sentences);
  const plan = [];
  let prevEnd = 0;
  assigned.forEach((a, i) => {
    // Cảnh PHẢI liền kề: start = end của cảnh trước (khoảng lặng giữa câu thuộc cảnh trước),
    // end = kết thúc câu cuối của nhóm. Cảnh cuối phủ hết phần audio còn lại (§16 không blank frame).
    let end = ROUND3(a.end);
    if (i === assigned.length - 1) end = audioDuration;
    end = Math.min(Math.max(end, prevEnd + 0.05), audioDuration);
    const start = prevEnd; prevEnd = end;
    plan.push({
      sceneId: a.scene.sceneId, summary: a.scene.summary, characters: a.scene.characters || [],
      location: a.scene.location, actions: a.scene.actions || [], mood: a.scene.mood,
      importance: a.scene.importance || 'normal',
      start, end,
      beats: a.beats.map((sen, bi) => ({ beatId: `beat_${String(bi + 1).padStart(2, '0')}`,
        intent: String(sen.text || ''), start: ROUND3(sen.start), end: ROUND3(sen.end) })),
    });
  });
  return { chapterId: scriptAnalysis.chapterId, audioDuration, scenes: plan };
}

module.exports = { buildStoryPlan, assignSentences };
