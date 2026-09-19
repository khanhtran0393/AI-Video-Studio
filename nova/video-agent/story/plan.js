'use strict';
// §11 Story Plan — mô tả câu chuyện ở cấp scene/beat, KHÔNG chứa chi tiết renderer.
// Beat timing lấy từ câu trong TTS (§1.1 TTS là Master Clock): không để scene vượt audio boundary.
// PT3 (video gen Flow làm nền): options.flowVideo.enabled + group !== false → bỏ qua ranh giới
// scene của script, GOM câu thành scene ~clipSecs (8s — đúng cỡ 1 clip Flow) để độ lệch
// thời lượng clip vs cảnh là nhỏ nhất (kinh nghiệm "cura đôi 50/50" — mỗi bên gánh 1 phần).
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

/* PT3 — gom câu liên tiếp thành scene có span ≈ targetSecs (greedy, deterministic).
 * Metadata scene kế thừa từ script scene CHỒNG LẤN NHIỀU NHẤT theo thời gian (fallback:
 * scene theo tỉ lệ tuyến tính). Trả [{ scene, sentences }] — scene đã có sceneId riêng. */
function groupSentencesToScenes(sentences, targetSecs, scriptScenes) {
  const target = Math.max(2, Number(targetSecs) || 8);
  const tolerance = target * 1.15;
  const groups = [];
  let cur = null;
  for (const sen of sentences) {
    if (!cur) { cur = { start: sen.start, sentences: [sen] }; continue; }
    if (sen.end - cur.start <= tolerance || !cur.sentences.length) cur.sentences.push(sen);
    else { groups.push(cur); cur = { start: sen.start, sentences: [sen] }; }
  }
  if (cur && cur.sentences.length) groups.push(cur);
  return groups.map((g, gi) => {
    const end = g.sentences[g.sentences.length - 1].end;
    const src = inheritScriptScene(g.start, end, scriptScenes, gi);
    return {
      scene: {
        sceneId: 'scene_f' + String(gi + 1).padStart(2, '0'),
        summary: g.sentences.map(s => s.text).join(' '),
        characters: (src && src.characters) || [],
        location: (src && src.location) || null,
        actions: (src && src.actions) || [],
        mood: (src && src.mood) || null,
        importance: (src && src.importance) || 'normal',
      },
      beats: g.sentences,   // cùng khoá `beats` với assignSentences → buildStoryPlan đọc chung
    };
  });
}

function inheritScriptScene(start, end, scriptScenes, gi) {
  if (!Array.isArray(scriptScenes) || !scriptScenes.length) return null;
  let best = null, bestOverlap = -1;
  for (const s of scriptScenes) {
    const ss = Number(s.start) || 0, se = Number(s.end) || 0;
    const overlap = Math.min(se, end) - Math.max(ss, start);
    if (overlap > bestOverlap) { bestOverlap = overlap; best = s; }
  }
  return best || scriptScenes[Math.min(gi, scriptScenes.length - 1)];
}

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

function buildStoryPlan(scriptAnalysis, tts, options = {}) {
  const fv = (options.flowVideo || {});
  const grouped = !!(fv.enabled && fv.group !== false);
  const sentences = tts.sentences || [];
  const audioDuration = ROUND3(Number(tts.duration) || (sentences.length ? sentences[sentences.length - 1].end : 0));

  // PT3: gom câu thành scene ~clipSecs thay vì dùng ranh giới scene của script.
  const assigned = (grouped
    ? groupSentencesToScenes(sentences, fv.clipSecs, scriptAnalysis.scenes || [])
        .map(g => ({ scene: g.scene, beats: g.beats,
          start: g.beats.length ? g.beats[0].start : 0,
          end: g.beats.length ? g.beats[g.beats.length - 1].end : 0 }))
    : assignSentences(scriptAnalysis.scenes || [], sentences));
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
  // Enrich metadata (học hỏi seedance-2.0): Directing Read + Continuity Ledger.
  // Chỉ thêm field mới — giữ nguyên mọi field cũ, không phá vỡ consumer (§1 hợp đồng).
  // Lazy-require tránh vòng require (§5) khi story/plan được nạp từ nhiều nơi.
  const { directingRead } = require('../script/directing-read');
  const { buildContinuityLedger } = require('./continuity');
  const enriched = plan.map((p) => Object.assign({}, p, { directing: directingRead(p) }));
  return { chapterId: scriptAnalysis.chapterId, audioDuration, scenes: enriched,
    continuity: buildContinuityLedger({ scenes: enriched }),
    ...(grouped ? { grouped: true, groupTargetSecs: Math.max(2, Number(fv.clipSecs) || 8) } : {}) };
}

module.exports = { buildStoryPlan, assignSentences, groupSentencesToScenes };

