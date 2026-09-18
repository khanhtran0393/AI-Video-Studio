'use strict';
/* ============================================================
   REVIEW — TEST hàm thuần engine (node nova/review/test.js)
   Chỉ test pure functions của nova/review/engine.js — KHÔNG
   electron, KHÔNG mạng, KHÔNG ffmpeg. Pipeline thật (OCR/AI/TTS/
   dựng) chạy trong app qua dialog — Luật 6 (dữ liệu thật).
   ============================================================ */
const path = require('path');
const E = require('./engine');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' (got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b) + ')'); }
function throws(fn, code, name) {
  try { fn(); fail++; failures.push(name); console.log('  ✗ ' + name + ' (không ném lỗi)'); }
  catch (e) { ok(e.code === code, name + ' [code=' + e.code + ']'); }
}
const cue = (s, e2, t) => ({ startMs: s, endMs: e2, text: t });

/* ── 1. chunksFromCues ── */
console.log('\n[1] chunksFromCues');
{
  const cues = [
    cue(0, 1000, 'một hai ba'),
    cue(2000, 3000, 'bốn năm'),
    cue(8 * 60 * 1000 + 500, 8 * 60 * 1000 + 1500, 'chunk hai bắt đầu'),
    cue(17 * 60 * 1000, 17 * 60 * 1000 + 1000, 'chunk ba'),
  ];
  const ch = E.chunksFromCues(cues, { chunkDurMs: 480000 });
  eq(ch.length, 3, 'chia 3 chunk theo mốc 8 phút');
  eq(ch[0].idx, 0, 'chunk đầu idx 0');
  eq(ch[0].startMs, 0, 'chunk đầu start 0');
  ok(ch[1].text.includes('chunk hai'), 'chunk 1 chứa text đúng');
  ok(E.chunksFromCues([cue(0, 100, 'a b c')]).length === 1, '1 cue → 1 chunk');
  throws(() => E.chunksFromCues([]), 'RV_NO_SOURCE_TEXT', 'transcript rỗng → RV_NO_SOURCE_TEXT');
  throws(() => E.chunksFromCues([cue(0, 100, '  ')]), 'RV_NO_SOURCE_TEXT', 'toàn cue trắng → RV_NO_SOURCE_TEXT');
}

/* ── 2. wordsOf + estimateFromCues ── */
console.log('\n[2] wordsOf + estimateFromCues');
{
  eq(E.wordsOf('một hai  ba'), 3, 'wordsOf đếm từ');
  eq(E.wordsOf('xinchào-đây tiếng-Việt 123'), 5, 'wordsOf: gạch nối tách từ, số đếm là từ');
  const est = E.estimateFromCues([cue(0, 1, ' '.repeat(0) + 'a b c d')], { ratioLen: 0.5 });
  eq(est.words, 4, 'estimate đếm đúng từ');
  eq(est.targetWords, 2, 'estimate target = 50%');
  ok(est.estScenes >= 1, 'estimate estScenes >= 1');
}

/* ── 3. buildChunkPrompt ── */
console.log('\n[3] buildChunkPrompt');
{
  const { system, user, targetWords } = E.buildChunkPrompt(
    { idx: 0, words: 200, text: 'transcript...' },
    { language: 'vi', ratioLen: 0.2, chunkTotal: 3, totalWords: 600 },
  );
  ok(system.includes('JSON'), 'system yêu cầu JSON');
  ok(system.includes('TIẾNG VIỆT'), 'system khai báo ngôn ngữ');
  ok(user.includes('~40 từ'), 'user khai báo target từ (20% của 200)');
  eq(targetWords, 40, 'targetWords = 20% chunk');
  const floor = E.buildChunkPrompt({ idx: 0, words: 100, text: 'x' }, { ratioLen: 0.2 });
  eq(floor.targetWords, 30, 'floor 30 từ — hook không quá cụt');
  const p2 = E.buildChunkPrompt({ idx: 1, words: 50, text: 'x' }, { language: 'en', ratioLen: 0.1, customPrompt: 'nhấn cảm xúc' });
  ok(p2.user.includes('nhấn cảm xúc'), 'customPrompt đi vào prompt');
}

/* ── 4. parseScenesJson ── */
console.log('\n[4] parseScenesJson');
{
  const a = E.parseScenesJson('```json\n[{"start": 0, "dur": 5, "text": "cảnh một"}, {"start": 5, "text": "cảnh hai"}]\n```');
  eq(a.length, 2, 'fence ```json đọc được');
  eq(a[0].durSec, 5, 'dur giữ nguyên');
  eq(a[1].durSec, null, 'thiếu dur → null');
  const b = E.parseScenesJson('{"scenes":[{"start":"01:02","dur":4,"text":"mm:ss ăn được"}]}');
  eq(b[0].startSec, 62, 'start "01:02" → 62s');
  const c = E.parseScenesJson('{"canh":[{"giay": 3, "thoi_luong": 6, "noi_dung": "tên khoá Việt"}]}');
  eq(c[0].text, 'tên khoá Việt', 'object bọc "canh" + key Việt');
  const d = E.parseScenesJson('blah blah\n{"start": 1, "text": "dòng lẻ"}\n{"text": "dòng lẻ 2"}');
  eq(d.length, 2, 'JSON từng dòng lẻ ăn được');
  throws(() => E.parseScenesJson('không có json'), 'RV_AI_BADJSON', 'không JSON → RV_AI_BADJSON');
  throws(() => E.parseScenesJson('[{"start":1},{"start":2}]'), 'RV_AI_BADJSON', 'toàn cảnh thiếu text → RV_AI_BADJSON');
}

/* ── 5. scenesFromParsed ── */
console.log('\n[5] scenesFromParsed');
{
  const r = E.scenesFromParsed(
    [
      { startSec: 0, durSec: 4, text: 'a' },
      { startSec: 2, durSec: 4, text: 'b' },      // chồng lấn → đẩy về sau cảnh a
      { startSec: 900, durSec: 4, text: 'ngoài khung' }, // ngoài chunk → clamp
      { startSec: 5000, durSec: 4, text: 'quá xa' },     // ngoài video → drop
    ],
    { chunkStartMs: 0, chunkEndMs: 60 * 1000, videoDurMs: 60 * 1000 },
  );
  ok(r.scenes.length >= 2, 'giữ cảnh hợp lệ');
  ok(r.scenes[1].startMs >= r.scenes[0].endMs, 'khử chồng lấn: cảnh sau bắt đầu sau cảnh trước kết thúc');
  ok(r.clamped > 0 && r.dropped > 0, 'khai báo số clamp/drop');
  ok(r.scenes.every((s) => s.endMs <= 60 * 1000), 'clamp vào thời lượng video');
}

/* ── 6. narrationPlan — TTS là master clock ── */
console.log('\n[6] narrationPlan');
{
  const scenes = [
    { startMs: 0, endMs: 5000, text: 'Câu một đây.' },
    { startMs: 5000, endMs: 9000, text: 'Câu hai. Câu ba dài hơn một chút.' },
    { startMs: 9000, endMs: 12000, text: 'Câu bốn.' },
  ];
  const durs = [3000, 2500, 4000, 2000];
  const r = E.narrationPlan(scenes, durs, { videoDurMs: 20000, gapMs: 100 });
  eq(r.sentenceCount, 4, '4 câu tổng');
  eq(r.plan[0].startMs, 0, 'cảnh 1 bắt đầu 0');
  eq(r.plan[0].sceneDur, 3000, 'TTS master clock: cảnh = thời lượng lời bình');
  eq(r.plan[1].startMs, 3000, 'cảnh 2 nối sau cảnh 1');
  eq(r.plan[1].narrMs, 2500 + 100 + 4000, 'narrMs = tổng câu + gap');
  eq(r.plan[1].sourceStartMs, 5000, 'sourceStart giữ mốc AI chọn');
  eq(r.totalMs, 3000 + 6600 + 2500, 'totalMs = tổng sceneDur');
  eq(r.shortfalls.length, 0, 'đủ hình → không shortfall');

  const short = E.narrationPlan(scenes, durs, { videoDurMs: 9500, gapMs: 100 });
  ok(short.shortfalls.length >= 1, 'thiếu hình → shortfall khai báo');
  ok(short.plan[short.plan.length - 1].sourceDurMs <= Math.max(0, 9500 - short.plan[short.plan.length - 1].sourceStartMs), 'sourceDur kẹp trong video');

  throws(() => E.narrationPlan(scenes, [3000, 2500, 0, 2000], {}), 'RV_PROBE', 'thiếu thời lượng → RV_PROBE (không bịa)');
  throws(() => E.narrationPlan([], []), 'RV_NO_SCENES', 'không cảnh → RV_NO_SCENES');

  /* câu rỗng → cảnh trống minSceneMs, không bệnh */
  const rEmpty = E.narrationPlan([{ startMs: 0, text: '  ' }], [], { minSceneMs: 2500 });
  eq(rEmpty.plan[0].sceneDur, 2500, 'cảnh không lời → minSceneMs');
}

/* ── 7. sentenceCues ── */
console.log('\n[7] sentenceCues');
{
  const plan = [
    { startMs: 0, sentIdx: [0, 1] },
    { startMs: 10000, sentIdx: [2] },
  ];
  const sents = ['a', 'b', 'c'];
  const durs = [2000, 3000, 1500];
  const cues = E.sentenceCues(plan, sents, durs, { gapMs: 500 });
  eq(cues.length, 3, '3 cue');
  eq([cues[0].startMs, cues[0].endMs], [0, 2000], 'câu 1 đúng mốc');
  eq(cues[1].startMs, 2500, 'câu 2 = sau câu 1 + gap');
  eq(cues[2].startMs, 10000, 'câu 3 theo cảnh 2');
  eq(cues[2].text, 'c', 'text khớp');
}

/* ── 8. clusterCues ── */
console.log('\n[8] clusterCues');
{
  const cues = [
    cue(0, 1000, 'một hai ba'),
    cue(1000, 2000, 'bốn năm'),
    cue(2000, 3000, 'sáu bảy tám chín mười mười một'),
    cue(3000, 4000, 'mười hai'),
  ];
  const cl = E.clusterCues(cues, { maxWords: 8 });
  ok(cl.length === 3, 'gộp theo trần 8 từ: 3 cụm (got ' + cl.length + ')');
  eq(cl[0].text, 'một hai ba bốn năm', 'cụm 1 gộp 5 từ');
  eq(cl[0].endMs, 2000, 'end cụm = end câu cuối');
  const one = E.clusterCues(cues, { maxWords: 2 });
  ok(one.length >= 4, 'trần 2 từ → hầu như không gộp');
}

/* ── 9. buildScriptMd ── */
console.log('\n[9] buildScriptMd');
{
  const md = E.buildScriptMd(
    [{ startMs: 0, endMs: 4000, text: 'Cảnh mở đầu.' }, { startMs: 65000, endMs: 70000, text: 'Cảnh sau.' }],
    { title: 'phim.mp4', language: 'vi', ratioLen: 0.2 },
  );
  ok(md.includes('# Kịch bản Review — phim.mp4'), 'tiêu đề');
  ok(md.includes('[0:00 → 0:04]'), 'mốc mm:ss cảnh 1');
  ok(md.includes('[1:05 → 1:10]'), 'mốc mm:ss cảnh 2');
  ok(md.includes('Cảnh mở đầu.'), 'lời cảnh vào md');
}

console.log('\n=== KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail ===');
if (fail) { console.log('FAIL: ' + failures.join(' | ')); process.exit(1); }
console.log('PASS');