'use strict';
/* ============================================================
   VIRAL CUT — TEST ENGINE (unit, không cần Electron)
   Chạy: npm run test:viral-cut  →  node nova/viral-cut/test.js
   Che phủ: parser JSON lỏng lẻo, buildSentences, heuristic,
   non-overlap, energy, best-hook, map LLM, slug, export plan,
   concat plan (ghép tất cả clip).
   ============================================================ */
const assert = require('assert');
const E = require('./engine');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  [OK] ' + name); }
  catch (e) { console.error('  [FAIL] ' + name + ' → ' + (e && e.message)); process.exitCode = 1; }
}

/* ── 1. parseJsonListLoose — bài học ViralCut ── */
t('parseJsonListLoose: JSON thuần', () => {
  const out = E.parseJsonListLoose('[{"a":1},{"a":2}]');
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[1].a, 2);
});
t('parseJsonListLoose: fence ```json + đoạn văn bao quanh', () => {
  const raw = 'Đây là kết quả:\n```json\n[{"start":0,"end":5}]\n```\nHy vọng giúp được bạn.';
  const out = E.parseJsonListLoose(raw);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].end, 5);
});
t('parseJsonListLoose: object cuối cụt (mảng bị cắt ngang)', () => {
  const raw = '[{"start":0,"end":5,"title":"ok"},{"start":8,"end":12,"tit';
  const out = E.parseJsonListLoose(raw);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].title, 'ok');
});
t('parseJsonListLoose: dấu phẩy thừa trước ]', () => {
  const out = E.parseJsonListLoose('[{"a":1},{"b":2},]');
  assert.strictEqual(out.length, 2);
});
t('parseJsonListLoose: chuỗi có ] / \\" trong text không loạn bracket', () => {
  const raw = '[{"title":"kéo [x2] \\"hook\\" mạnh"},{"title":"thứ hai"}]';
  const out = E.parseJsonListLoose(raw);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].title, 'kéo [x2] "hook" mạnh');
});
t('parseJsonListLoose: rác hoàn toàn → null', () => {
  assert.strictEqual(E.parseJsonListLoose('xin chào không có gì hết'), null);
});

/* ── 2. buildSentences ── */
const CUES = [
  { index: 1, startMs: 0, endMs: 4000, text: 'Bạn có biết bí mật này không?' },
  { index: 2, startMs: 4000, endMs: 9000, text: 'Đây là điều mà 90% người làm sai.' },
  { index: 3, startMs: 9000, endMs: 14000, text: 'Hôm nay tôi sẽ chỉ cho bạn cách.' },
  { index: 4, startMs: 14000, endMs: 20000, text: 'Nó thay đổi mọi thứ, thật đấy!' },
];
t('buildSentences: ngắt đúng tại dấu câu, gộp đúng mốc thời gian', () => {
  const s = E.buildSentences(CUES);
  assert.strictEqual(s.length, 4);
  assert.strictEqual(s[0].text, 'Bạn có biết bí mật này không?');
  assert.strictEqual(s[1].startMs, 4000);
  assert.ok(s[3].words > 0);
});

/* ── 3. heuristic ── */
t('scoreText: hook keyword + câu hỏi + con số được cộng điểm', () => {
  const sc = E.scoreText('Bạn có biết bí mật này không? 90% người sai');
  assert.ok(sc.hookHits >= 2);
  assert.strictEqual(sc.q, 1);
  assert.ok(sc.reasons.length >= 3);
});
t('heuristicCandidates: chỉ trả cửa sổ trong [minLen, maxLen]', () => {
  const sents = E.buildSentences(CUES);
  const cands = E.heuristicCandidates(sents, { minLen: 9, maxLen: 20 });
  for (const c of cands) assert.ok(c.durMs >= 9000 && c.durMs <= 20000, 'cửa sổ lệch: ' + c.durMs);
  assert.ok(cands.length > 0);
});
t('pickTopNonOverlap: tôn trọng maxClips + không chồng lấn', () => {
  const cands = [
    { startMs: 0, endMs: 10000, score: 9 },
    { startMs: 5000, endMs: 15000, score: 10 },
    { startMs: 20000, endMs: 30000, score: 5 },
    { startMs: 31000, endMs: 40000, score: 4 },
  ];
  const picked = E.pickTopNonOverlap(cands, 2);
  assert.strictEqual(picked.length, 2);
  assert.strictEqual(picked[0].startMs, 5000);
  assert.ok(picked[1].startMs >= 20000);
});

/* ── 4. energy ── */
function fakeWins(vals, windowSec) {
  return vals.map((rms, i) => ({ t: i * (windowSec || 1), rms }));
}
t('pickHighlightsByEnergy: chọn cửa sổ năng lượng cao nhất, không chồng lấn', () => {
  const vals = [];
  for (let i = 0; i < 120; i++) {
    let v = 0.1;
    if (i >= 30 && i < 60) v = 0.9;
    if (i >= 80 && i < 100) v = 0.6;
    vals.push(v);
  }
  const top = E.pickHighlightsByEnergy(fakeWins(vals), { minLen: 15, maxLen: 30, maxClips: 2 });
  assert.strictEqual(top.length, 2);
  assert.ok(top[0].startMs <= 35000 && top[0].endMs >= 45000, 'phải phủ vùng 30–60s');
  assert.ok(top[1].startMs >= top[0].endMs, 'hai highlight không chồng lấn');
});
t('pcmFromWav: đọc đúng chunk fmt/data của WAV tổng hợp', () => {
  const sr = 48000, ch = 1, bits = 16, frames = 100;
  const data = Buffer.alloc(frames * 2);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(ch, 2); fmt.writeUInt32LE(sr, 4);
  fmt.writeUInt32LE(sr * ch * bits / 8, 8); fmt.writeUInt16LE(ch * bits / 8, 12); fmt.writeUInt16LE(bits, 14);
  const riffSize = Buffer.alloc(4); riffSize.writeUInt32LE(4 + 8 + 16 + 8 + data.length, 0);
  const fmtSize = Buffer.alloc(4); fmtSize.writeUInt32LE(16, 0);
  const dataSize = Buffer.alloc(4); dataSize.writeUInt32LE(data.length, 0);
  const buf = Buffer.concat([
    Buffer.from('RIFF'), riffSize, Buffer.from('WAVE'),
    Buffer.from('fmt '), fmtSize, fmt,
    Buffer.from('data'), dataSize, data,
  ]);
  const info = E.pcmFromWav(buf);
  assert.strictEqual(info.sampleRate, sr);
  assert.strictEqual(info.channels, ch);
  assert.strictEqual(info.bitsPerSample, bits);
  assert.strictEqual(info.dataOffset, 44);
  assert.strictEqual(info.dataLen, data.length);
});
t('pcmFromWav: file không phải WAV → lỗi lộ liễu', () => {
  assert.throws(() => E.pcmFromWav(Buffer.from('khong phai wav')), /VC_WAV/);
});

/* ── 5. bestHook ── */
t('bestHook: cửa sổ ≤ maxWords, không ăn 20% cuối highlight', () => {
  const sents = [
    { startMs: 10000, endMs: 13000, text: 'Bạn có biết', words: 3 },
    { startMs: 13000, endMs: 17000, text: 'bí mật này là một điều cực kỳ quan trọng và dài', words: 9 },
    { startMs: 17000, endMs: 21000, text: 'và đây là phần cao trào cuối cùng của clip', words: 9 },
  ];
  const hook = E.bestHook(sents, 10000, 21000, { maxWords: 12 });
  assert.ok(hook, 'phải tìm được hook');
  assert.ok(hook.endMs <= 10000 + (21000 - 10000) * 0.8 + 1, 'hook không được spoil 20% cuối');
  const words = hook.text.split(/\s+/).length;
  assert.ok(words <= 12, 'hook vượt maxWords: ' + words);
});
t('bestHook: không có câu nào → null (không đoán mò)', () => {
  assert.strictEqual(E.bestHook([], 0, 10000), null);
});

/* ── 6. mapLlmHighlights ── */
const SENT = [
  { startMs: 0, endMs: 8000, text: 'a', words: 5 },
  { startMs: 8000, endMs: 16000, text: 'b', words: 5 },
  { startMs: 16000, endMs: 24000, text: 'c', words: 5 },
  { startMs: 24000, endMs: 32000, text: 'd', words: 5 },
  { startMs: 32000, endMs: 40000, text: 'e', words: 5 },
  { startMs: 40000, endMs: 48000, text: 'f', words: 5 },
];
t('mapLlmHighlights: idx đảo ngược + vượt maxLen được clamp về câu khít', () => {
  const out = E.mapLlmHighlights(
    [{ start: 4, end: 0, title: 'x', score: 99, reason: 'r' }],
    SENT, { minLen: 10, maxLen: 20, maxClips: 3 }
  );
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].startMs, 0);
  assert.ok(out[0].endMs <= 20000 + 1, 'vượt maxLen phải cắt lùi: ' + out[0].endMs);
  assert.ok(out[0].score <= 10, 'score phải clamp 0-10');
});
t('mapLlmHighlights: chồng lấn → giữ điểm cao, cap maxClips', () => {
  const out = E.mapLlmHighlights(
    [
      { start: 0, end: 2, title: 'a', score: 5 },
      { start: 1, end: 3, title: 'b', score: 9 },
      { start: 4, end: 5, title: 'c', score: 7 },
    ],
    SENT, { minLen: 5, maxLen: 30, maxClips: 2 }
  );
  assert.strictEqual(out.length, 2);
  assert.ok(out.some((h) => h.title === 'b'));
  assert.ok(out.some((h) => h.title === 'c'));
});
t('mapLlmHighlights: item rác (không số) bị bỏ, không crash', () => {
  const out = E.mapLlmHighlights([{ bad: true }, null, 'x'], SENT, {});
  assert.strictEqual(out.length, 0);
});

/* ── 7. slug / title / export plan ── */
t('slugify: bỏ dấu tiếng Việt + ký tự lạ', () => {
  assert.strictEqual(E.slugify('Bí Mật 90% Người Sai!'), 'bi-mat-90-nguoi-sai');
  assert.strictEqual(E.slugify('---'), 'clip');
});
t('buildExportPlan: tên file thứ tự + crop916 + thiếu outDir → lỗi lộ liễu', () => {
  const hl = [{ startMs: 1000, endMs: 2000, title: 'Bí mật' }, { startMs: 3000, endMs: 4000, title: '' }];
  const plan = E.buildExportPlan(hl, { outDir: 'D:\\out', crop916: true });
  assert.strictEqual(plan.length, 2);
  assert.ok(plan[0].outPath.includes('viralcut-01-bi-mat.mp4'));
  assert.ok(plan[1].outPath.includes('viralcut-02-clip.mp4'));
  assert.strictEqual(plan[0].crop916, true);
  assert.strictEqual(plan[0].startSec, 1);
  assert.throws(() => E.buildExportPlan(hl, { outDir: '' }), /VC_NO_OUTDIR/);
});
t('genTitleLocal: deterministic, bỏ dấu câu cuối', () => {
  const title = E.genTitleLocal('Bạn có biết bí mật này không? Đây là phần tiếp theo rất dài để cắt bớt cho vừa giới hạn');
  assert.ok(title.length <= 60, 'title quá dài: ' + title);
  assert.ok(!/[?,.;:]$/.test(title));
});

/* ── 7b. buildConcatPlan (ghép tất cả clip thành 1 video) ── */
t('buildConcatPlan: tên file theo video nguồn + list đúng thứ tự + escape nháy đơn', () => {
  const cc = E.buildConcatPlan(['D:\\out\\a.mp4', "D:\\out\\it's.mp4"], { outDir: 'D:\\out', videoName: 'Buổi Học.mp4' });
  assert.ok(cc.outPath.includes('viralcut-ghep-buoi-hoc-2clip.mp4'), 'tên ghép sai: ' + cc.outPath);
  const lines = cc.listContent.split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0], "file 'D:\\out\\a.mp4'");
  assert.strictEqual(lines[1], "file 'D:\\out\\it'\\''s.mp4'");
  assert.ok(lines[1].includes("it'\\''s.mp4"), 'nháy đơn phải escape: ' + lines[1]);
  assert.strictEqual(cc.count, 2);
});
t('buildConcatPlan: rỗng / thiếu outDir → lỗi lộ liễu (không fallback ngầm)', () => {
  assert.throws(() => E.buildConcatPlan([], { outDir: 'D:\\x' }), /VC_CONCAT_EMPTY/);
  assert.throws(() => E.buildConcatPlan(['a.mp4'], { outDir: '' }), /VC_NO_OUTDIR/);
});

/* ── 8. parseSrtCues (re-export từ whiteboard-annotation) ── */
t('parseSrtCues: đọc SRT thật có BOM + CRLF', () => {
  const srt = '\uFEFF1\r\n00:00:01,000 --> 00:00:04,000\r\nBạn có biết bí mật này không?\r\n\r\n2\r\n00:00:04,000 --> 00:00:09,000\r\n90% người làm sai.\r\n';
  const cues = E.parseSrtCues(srt);
  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].startMs, 1000);
  assert.strictEqual(cues[1].endMs, 9000);
});

/* ── 9. Tầng heatmap YouTube ("Most Replayed") + titles từ chapters ── */
const HEAT = (() => {
  const arr = [];
  for (let i = 0; i < 40; i++) { // video 200s, mốc 5s
    let v = 0.1;
    if (i === 0) v = 1.0;          // bẫy intro: mốc đầu luôn "hot" giả
    if (i === 20 || i === 21) v = 0.95; // đỉnh thật ở 100–110s
    if (i === 32) v = 0.6;              // đỉnh phụ ở 160–165s
    arr.push({ start_time: i * 5, end_time: (i + 1) * 5, value: v });
  }
  return arr;
})();
t('pickHighlightsByHeatmap: bắt đúng đỉnh thật, bỏ bẫy intro, không chồng lấn', () => {
  const out = E.pickHighlightsByHeatmap(HEAT, { minLen: 15, maxLen: 45, maxClips: 3 });
  assert.ok(out.length >= 1, 'phải chọn được ít nhất 1 highlight');
  const best = out.reduce((m, h) => (h.score > m.score ? h : m), out[0]);
  assert.ok(best.startMs >= 95000 && best.startMs <= 100000 && best.endMs >= 110000,
    'highlight điểm cao nhất phải phủ đỉnh 0.95 (100–110s), got ' + best.startMs + '-' + best.endMs);
  for (const h of out) {
    assert.ok(h.endMs - h.startMs >= 15000 && h.endMs - h.startMs <= 45000, 'độ dài trong khoảng 15–45s');
    assert.ok(h.score > 0 && h.score <= 10, 'score thang 0-10: ' + h.score);
    assert.ok(h.score >= 2.5, 'vùng nền 0.1 phải bị ngưỡng lọc, got ' + h.score);
    assert.ok(h.startMs >= 10000, 'không chọn vào vùng intro bias');
    assert.ok(/heatmap YouTube/.test(h.reason), 'reason khai báo nguồn heatmap');
  }
  for (let i = 1; i < out.length; i++) assert.ok(out[i].startMs >= out[i - 1].endMs, 'non-overlap + sort theo thời gian');
});
t('pickHighlightsByHeatmap: deterministic (2 lần chạy cùng kết quả)', () => {
  const a = E.pickHighlightsByHeatmap(HEAT, { minLen: 15, maxLen: 45, maxClips: 3 });
  const b = E.pickHighlightsByHeatmap(HEAT, { minLen: 15, maxLen: 45, maxClips: 3 });
  assert.deepStrictEqual(a, b);
});
t('pickHighlightsByHeatmap: heatmap rỗng/garbage → [] (ipc quyết định fail lộ liễu)', () => {
  assert.deepStrictEqual(E.pickHighlightsByHeatmap([], {}), []);
  assert.deepStrictEqual(E.pickHighlightsByHeatmap(null, {}), []);
  assert.deepStrictEqual(E.pickHighlightsByHeatmap([{ start_time: 'x', end_time: 1, value: 2 }], {}), []);
});
t('cleanChapterTitle: bỏ mốc giờ + số thứ tự đầu tiêu đề chapter', () => {
  assert.strictEqual(E.cleanChapterTitle('01:40 Giai đoạn đắt giá nhất.'), 'Giai đoạn đắt giá nhất');
  assert.strictEqual(E.cleanChapterTitle('1. Mở đầu'), 'Mở đầu');
  assert.strictEqual(E.cleanChapterTitle('  '), '');
});
t('applyChapterTitles: chapter phủ ≥50% → nhận title; không phủ → giữ nguyên', () => {
  const hls = [
    { startMs: 100000, endMs: 130000, title: '' },
    { startMs: 160000, endMs: 170000, title: '' },
  ];
  E.applyChapterTitles(hls, [
    { start_time: 90, end_time: 135, title: '01:30 Phần hay nhất video' },
    { start_time: 168, end_time: 200, title: 'Kết' }, // chỉ phủ 2/10 = 20% → không nhận
  ]);
  assert.strictEqual(hls[0].title, 'Phần hay nhất video');
  assert.strictEqual(hls[0].chapter, true);
  assert.strictEqual(hls[1].title, '', 'chapter "Kết" chỉ phủ 20% → không nhận');
  assert.strictEqual(hls[1].chapter, undefined);
});

/* ── 10. Tầng bình luận YouTube (Cách 2 — bổ trợ heatmap) ── */
t('parseCommentTimestamps: đọc m:ss / mm:ss / h:mm:ss, lọc ngoài video + garbage', () => {
  assert.deepStrictEqual(E.parseCommentTimestamps('0:52 tình tiết hay nhất cả video', 200), [52]);
  assert.deepStrictEqual(E.parseCommentTimestamps('12:05 cũng đỉnh, nhưng 1:02:03 mới là đoạn quay lại xem', 4000), [725, 3723]);
  assert.deepStrictEqual(E.parseCommentTimestamps('mốc 189:00 không tồn tại trong video 200s', 200), []);
  assert.deepStrictEqual(E.parseCommentTimestamps('1080p 60fps không phải mốc giờ', 200), []);
  assert.deepStrictEqual(E.parseCommentTimestamps('', 200), []);
  assert.deepStrictEqual(E.parseCommentTimestamps(null, 200), []);
});
t('parseCommentTimestamps: "12:90" sai phút/giây → bỏ, không đoán mò', () => {
  assert.deepStrictEqual(E.parseCommentTimestamps('12:90 và 5:61 đều vô lý', 200), []);
});
t('pickHighlightsByComments: cluster đúng vùng khán giả đánh dấu, bỏ intro, deterministic', () => {
  // video 200s: bình luận đánh dấu ~100–110s (5 mốc, like khác nhau) + rác ở 30s (1 mốc)
  const cmts = [
    { text: '1:39 đỉnh nhất video', likeCount: 500 },
    { text: 'bấm 1:42 quay lại mấy lần', likeCount: 120 },
    { text: '1:45-1:50 đoạn này hay', likeCount: 40 },   // regex lấy 1:45
    { text: 'giây 1:50 quá ngầu', likeCount: 10 },
    { text: '0:30 mở đầu vậy thôi', likeCount: 1 },
  ];
  const a = E.pickHighlightsByComments(cmts, { durationMs: 200000, minLen: 15, maxLen: 45, maxClips: 3 });
  const b = E.pickHighlightsByComments(cmts, { durationMs: 200000, minLen: 15, maxLen: 45, maxClips: 3 });
  assert.deepStrictEqual(a, b, 'deterministic');
  assert.ok(a.length >= 1, 'phải có ít nhất 1 cửa sổ');
  const best = a.reduce((m, h) => (h.score > m.score ? h : m), a[0]);
  assert.ok(best.startMs >= 95000 && best.endMs >= 100000,
    'cửa sổ điểm cao nhất phải phủ vùng 100–110s, got ' + best.startMs + '-' + best.endMs);
  for (const h of a) {
    assert.ok(h.endMs - h.startMs >= 15000 && h.endMs - h.startMs <= 45000, 'độ dài 15–45s');
    assert.ok(/bình luận YouTube/.test(h.reason), 'reason khai báo nguồn bình luận');
    assert.ok(h.startMs >= 10000, 'không chọn vào vùng intro');
  }
});
t('pickHighlightsByComments: rỗng / toàn bình luận không mốc giờ → []', () => {
  assert.deepStrictEqual(E.pickHighlightsByComments([], { durationMs: 200000 }), []);
  assert.deepStrictEqual(E.pickHighlightsByComments([{ text: 'hay quá', likeCount: 99 }], { durationMs: 200000 }), []);
  assert.deepStrictEqual(E.pickHighlightsByComments([{ text: '2:00' }], {}), [], 'thiếu durationMs → []');
});
t('blendCommentBoost: boost theo tỉ lệ phủ × weight, không đụng cửa sổ không trùng', () => {
  const hls = [
    { startMs: 95000, endMs: 140000, score: 6.0, reason: 'khán giả tua lại 60% (heatmap YouTube)' },
    { startMs: 160000, endMs: 175000, score: 5.0, reason: 'khán giả tua lại 50% (heatmap YouTube)' },
  ];
  const wins = [{ startMs: 100000, endMs: 130000, score: 8.0 }]; // phủ 30/45 = 66.7%
  const out = E.blendCommentBoost(hls, wins, { weight: 0.25 });
  assert.strictEqual(out.length, 2, 'set cửa sổ không đổi');
  assert.strictEqual(out[0].commentBoost, 1.3); // 0.25 × 8 × (30000/45000) = 1.333 → 1.3
  assert.strictEqual(out[0].score, 7.3);
  assert.ok(/\+1\.3 từ bình luận/.test(out[0].reason), 'reason ghi rõ nguồn boost: ' + out[0].reason);
  assert.strictEqual(out[1].score, 5.0, 'không trùng → nguyên vẹn');
  assert.strictEqual(out[1].commentBoost, undefined);
  // boost không vượt trần 10
  const maxed = E.blendCommentBoost([{ startMs: 0, endMs: 30000, score: 9.8 }], [{ startMs: 0, endMs: 30000, score: 10 }], { weight: 0.5 });
  assert.strictEqual(maxed[0].score, 10, 'score chặn trần 10');
  // wins rỗng → bản sao nguyên vẹn
  const same = E.blendCommentBoost(hls, []);
  assert.deepStrictEqual(same, hls);
});

console.log('\nViral Cut engine test: ' + passed + ' test PASS, exitCode=' + (process.exitCode || 0));
