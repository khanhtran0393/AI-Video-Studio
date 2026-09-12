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

/* ── 11. TIER A — multimodal local (keyframe proxy / im lặng / cao độ / fusion / snap) ── */
function t11mkWav(samples, sr, ch) {
  const chans = ch || 1;
  const n = samples.length;
  const data = Buffer.alloc(n * chans * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    for (let c = 0; c < chans; c++) data.writeInt16LE(v, (i * chans + c) * 2);
  }
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(chans, 2); fmt.writeUInt32LE(sr, 4);
  fmt.writeUInt32LE(sr * chans * 2, 8); fmt.writeUInt16LE(chans * 2, 12); fmt.writeUInt16LE(16, 14);
  const riff = Buffer.alloc(4); riff.writeUInt32LE(36 + data.length, 0);
  const dsize = Buffer.alloc(4); dsize.writeUInt32LE(data.length, 0);
  return Buffer.concat([
    Buffer.from('RIFF'), riff, Buffer.from('WAVE'),
    Buffer.from('fmt '), Buffer.from([16, 0, 0, 0]), fmt,
    Buffer.from('data'), dsize, data,
  ]);
}
function t11sine(seconds, hz, sr, amp) {
  const out = new Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = (amp || 12000) * Math.sin(2 * Math.PI * hz * (i / sr));
  return out;
}
t('parseKeyframePackets: csv ffprobe "pts_time,flags" — chỉ packet cờ K, sort+dedupe', () => {
  const raw = '12.500000,KF,\r\n12.500000,KF,\r\n0.000000,KF,\r\n1.040000,_,\r\n45.9,KF,\r\nrác không phải csv\r\n';
  assert.deepStrictEqual(E.parseKeyframePackets(raw), [0, 12500, 45900]);
  assert.deepStrictEqual(E.parseKeyframePackets(raw, { durationMs: 20000 }), [0, 12500], 'cắt theo durationMs');
});
t('parseKeyframePackets: dạng array object (-of json) + rác → vẫn ra keyframe', () => {
  const arr = [{ pts_time: '3.5', flags: 'K_' }, { pts_time: '7', flags: '__' }, { pts_time: 'x', flags: 'K' }, null];
  assert.deepStrictEqual(E.parseKeyframePackets(arr), [3500]);
  assert.deepStrictEqual(E.parseKeyframePackets(null), []);
});
t('detectSilence: ngưỡng RMS tương đối theo đỉnh, bỏ gap ngắn hơn minSec', () => {
  const vals = [];
  for (let i = 0; i < 60; i++) vals.push(0.8);
  for (let i = 20; i < 21; i++) vals[i] = 0.001;      // gap 1s — quá ngắn (minSec 1.5)
  for (let i = 30; i < 34; i++) vals[i] = 0.0005;     // gap 4s — đạt
  const sil = E.detectSilence(fakeWins(vals), {});
  assert.strictEqual(sil.gaps.length, 1, 'chỉ 1 gap đạt: ' + JSON.stringify(sil.gaps));
  assert.strictEqual(sil.gaps[0].startMs, 30000);
  assert.strictEqual(sil.gaps[0].endMs, 34000);
  assert.strictEqual(sil.gaps[0].midMs, 32000);
  assert.strictEqual(sil.totalSec, 4);
  assert.ok(sil.threshold > 0 && sil.threshold < 0.8);
  assert.deepStrictEqual(E.detectSilence([], {}), { threshold: 0, gaps: [], totalSec: 0 }, 'wins rỗng → trung tính');
});
t('buildBoundaryAnchors: cut ưu tiên gap khi sát nhau, sort, loại rác', () => {
  const a = E.buildBoundaryAnchors([10000, 5000, 5010, NaN], [{ midMs: 5200 }, { midMs: 20000 }], { mergeTolMs: 250 });
  assert.deepStrictEqual(a, [{ ms: 5000, kind: 'cut' }, { ms: 10000, kind: 'cut' }, { ms: 20000, kind: 'gap' }],
    'gap 5200 gộp vào cut 5000 (cut thắng): ' + JSON.stringify(a));
  assert.deepStrictEqual(E.buildBoundaryAnchors([], []), []);
});

t('snapWindowEdges: kéo biên về neo trong tolerance; ngoài tolerance giữ nguyên', () => {
  const anchors = [{ ms: 11800, kind: 'cut' }, { ms: 42600, kind: 'gap' }, { ms: 300000, kind: 'cut' }];
  const hls = [{ startMs: 12000, endMs: 42000, score: 5, reason: 'gốc' }];
  const r = E.snapWindowEdges(hls, anchors, { minLen: 15, maxLen: 45, durationMs: 480000 });
  assert.strictEqual(r.highlights[0].startMs, 11800);
  assert.strictEqual(r.highlights[0].endMs, 42600);
  assert.strictEqual(r.highlights[0].snappedEdges, 2);
  assert.ok(/neo 2 biên \(Tier A: đầu→cảnh cắt, cuối→im lặng\)/.test(r.highlights[0].reason), 'reason khai báo: ' + r.highlights[0].reason);
  assert.strictEqual(r.adjustments.length, 1);
  assert.strictEqual(hls[0].startMs, 12000, 'KHÔNG mutate input');
  const far = E.snapWindowEdges([{ startMs: 20000, endMs: 40000 }], [{ ms: 200000, kind: 'cut' }, { ms: 11800, kind: 'gap' }], { toleranceMs: 4000, minLen: 15, maxLen: 45 });
  assert.strictEqual(far.highlights[0].startMs, 20000, 'ngoài tolerance → giữ nguyên start');
  assert.strictEqual(far.highlights[0].endMs, 40000, 'ngoài tolerance → giữ nguyên end');
  assert.strictEqual(far.adjustments.length, 0);
});
t('snapWindowEdges: snap làm vỡ [minLen,maxLen] → revert, vẫn vi phạm thì trả nguyên bản', () => {
  const a1 = E.snapWindowEdges([{ startMs: 10000, endMs: 25000, score: 4 }], [{ ms: 10200, kind: 'cut' }, { ms: 20000, kind: 'cut' }], { toleranceMs: 4000, minLen: 15, maxLen: 45 });
  assert.ok(a1.highlights[0].endMs - a1.highlights[0].startMs >= 15000, 'độ dài ≥ minLen sau revert: ' + JSON.stringify(a1.highlights[0]));
  const both = E.snapWindowEdges([{ startMs: 10000, endMs: 24000, score: 4 }], [{ ms: 10400, kind: 'cut' }, { ms: 20000, kind: 'cut' }], { toleranceMs: 4000, minLen: 15, maxLen: 45 });
  assert.strictEqual(both.highlights[0].startMs, 10000);
  assert.strictEqual(both.highlights[0].endMs, 24000);
  assert.strictEqual(both.adjustments.length, 0, 'revert hết → không adjustment');
  const over = E.snapWindowEdges([{ startMs: 40000, endMs: 70000, score: 4 }], [{ ms: 72000, kind: 'cut' }], { toleranceMs: 4000, minLen: 15, maxLen: 45, durationMs: 71000 });
  assert.strictEqual(over.highlights[0].endMs, 70000, 'snap vượt cuối video → revert');
});
t('estimatePitchFrames: sine → f0 đúng Hz; âm câm → null; stereo downmix OK', () => {
  const sr = 48000;
  const buf = t11mkWav(t11sine(4, 130, sr), sr, 1);
  const info = E.pcmFromWav(buf);
  const r = E.estimatePitchFrames(buf, info, {});
  assert.ok(r.frames.length > 20, 'nhiều frame: ' + r.frames.length);
  const voiced = r.frames.filter((f) => f.f0 != null);
  assert.ok(voiced.length / r.frames.length > 0.8, 'voiced ratio cao với sine: ' + voiced.length + '/' + r.frames.length);
  const med = voiced.map((f) => f.f0).sort((a, b) => a - b)[Math.floor(voiced.length / 2)];
  assert.ok(Math.abs(med - 130) <= 3, 'median f0 ≈ 130Hz, got ' + med);
  assert.ok(r.rate >= 6000 && r.rate <= 8100, 'rate rút gọn ~8k: ' + r.rate);
  assert.strictEqual(r.truncated, false);
  assert.ok(r.analyzedSec >= 3.5, 'analyzedSec: ' + r.analyzedSec);
  const zbuf = t11mkWav(new Array(sr * 2).fill(0), sr, 1);
  const sil = E.estimatePitchFrames(zbuf, E.pcmFromWav(zbuf), {});
  assert.ok(sil.frames.length > 0 && sil.frames.every((f) => f.f0 === null), 'âm câm → mọi f0 null');
  const st = t11mkWav(t11sine(2, 200, sr), sr, 2);
  const stf = E.estimatePitchFrames(st, E.pcmFromWav(st), {});
  const sv = stf.frames.filter((f) => f.f0 != null).map((f) => f.f0).sort((a, b) => a - b);
  assert.ok(Math.abs(sv[Math.floor(sv.length / 2)] - 200) <= 4, 'stereo downmix đúng: ' + sv[Math.floor(sv.length / 2)]);
});
t('estimatePitchFrames: PCM hỏng / bits ≠ 16 → lỗi lộ liễu (không fallback)', () => {
  assert.throws(() => E.estimatePitchFrames(Buffer.alloc(10), null), /VC_PITCH/);
  assert.throws(() => E.estimatePitchFrames(Buffer.alloc(100), { sampleRate: 0 }), /VC_PITCH/);
  assert.throws(() => E.estimatePitchFrames(Buffer.alloc(100), { sampleRate: 48000, bitsPerSample: 32, dataOffset: 0, dataLen: 100 }), /VC_PITCH_P16/);
});
t('estimatePitchFrames: maxSeconds chặn phân tích → truncated KHAI BÁO rõ', () => {
  const sr = 16000;
  const buf = t11mkWav(t11sine(10, 150, sr), sr, 1);
  const r = E.estimatePitchFrames(buf, E.pcmFromWav(buf), { maxSeconds: 3 });
  assert.strictEqual(r.truncated, true, 'phải khai báo truncated');
  assert.ok(r.analyzedSec <= 4, 'chỉ ~3s: ' + r.analyzedSec);
});

t('pitchWindowsFromFrames: voiced ratio + median + biến động cao độ theo window', () => {
  const sr = 8000;
  // 3s @120Hz rồi 1s @240Hz: với wLen=2, bucket1 (t 2→4s) chứa CẢ hai cao độ → var lớn
  const samples = t11sine(3, 120, sr).concat(t11sine(1, 240, sr));
  const buf = t11mkWav(samples, sr, 1);
  const info = E.pcmFromWav(buf);
  const pr = E.estimatePitchFrames(buf, info, {});
  const wins = [{ t: 0, rms: 1 }, { t: 2, rms: 1 }];
  const pw = E.pitchWindowsFromFrames(pr.frames, wins);
  assert.strictEqual(pw.length, 2);
  assert.ok(pw.every((w) => w.voiced > 0.9), 'toàn bộ voiced: ' + JSON.stringify(pw));
  assert.ok(Math.abs(pw[0].med - 120) <= 4, 'bucket0 thuần 120Hz: ' + pw[0].med);
  assert.ok(pw[0].var <= 1, 'bucket0 không biến động: ' + pw[0].var);
  assert.ok(pw[1].var > 20, 'bucket1 chuyển tiếp 120→240 phải có var lớn: ' + pw[1].var);
  const empty = E.pitchWindowsFromFrames([], wins);
  assert.strictEqual(empty.length, 2);
  assert.ok(empty.every((w) => w.voiced === 0 && w.var === 0), 'không frames → voiced=0, var=0');
});
t('fuseLocalScores: trọng số 0.6/0.25/0.15; thiếu pitch → renormalize CÔNG KHAI', () => {
  const wins = [{ t: 0, rms: 1.0 }, { t: 1, rms: 0.5 }];
  const full = E.fuseLocalScores(wins, { pitchWins: [{ t: 0, voiced: 1, var: 40 }, { t: 1, voiced: 0.5, var: 10 }] });
  assert.deepStrictEqual(full.weights, { energy: 0.6, pitch: 0.25, voiced: 0.15 });
  assert.strictEqual(full.hasPitch, true);
  assert.strictEqual(full.feats[0].v, 1, 'đỉnh cả 3 tín hiệu → v=1: ' + full.feats[0].v);
  assert.strictEqual(full.feats[1].v, Math.round((0.5 * 0.6 + 0.25 * 0.25 + 0.5 * 0.15) * 1000) / 1000);
  const noPitch = E.fuseLocalScores(wins, {});
  assert.strictEqual(noPitch.hasPitch, false);
  assert.deepStrictEqual(noPitch.weights, { energy: 1, pitch: 0, voiced: 0 }, 'không có pitchWins → không có voiced thật → thuần energy, KHÔNG loãng điểm');
  assert.ok(noPitch.feats.every((f) => f.pitch === null && f.voiced === null), 'pitch + voiced null — không bịa số');
  assert.strictEqual(noPitch.feats[0].v, 1);
  const onlyVoice = E.fuseLocalScores(wins, { pitchWins: [{ t: 0, voiced: 1, var: 0 }, { t: 1, voiced: 0.4, var: 0 }] });
  assert.strictEqual(onlyVoice.hasPitch, false, 'var=0 mọi window → pitch không mang thông tin');
  assert.deepStrictEqual(onlyVoice.weights, { energy: 0.8, pitch: 0, voiced: 0.2 }, '0.6/0.75 + 0.15/0.75');
  assert.ok(onlyVoice.feats.every((f) => f.pitch === null && f.voiced != null), 'giữ voiced, bỏ pitch');
  assert.deepStrictEqual(E.fuseLocalScores([], {}), { feats: [], weights: null, hasPitch: false });
});
t('pickHighlightsByFusion: bắt đỉnh, floor 35% loại vùng yếu, non-overlap, deterministic', () => {
  const feats = [];
  for (let i = 0; i < 90; i++) {
    const core = i >= 55 && i < 65;           // vùng mạnh nhất
    const hot = i >= 50 && i < 70;            // vùng nóng bao quanh core
    const e = core ? 1 : hot ? 0.7 : 0.15, p = core ? 1 : hot ? 0.7 : 0.1, v = core ? 1 : hot ? 0.7 : 0.5;
    feats.push({ t: i, energy: e, pitch: p, voiced: v, v: e * 0.6 + p * 0.25 + v * 0.15 });
  }
  const opts = { minLen: 15, maxLen: 30, maxClips: 2 };
  const a = E.pickHighlightsByFusion(feats, opts);
  const b = E.pickHighlightsByFusion(feats, opts);
  assert.deepStrictEqual(a, b, 'deterministic');
  assert.ok(a.length >= 1, 'phải có ít nhất 1 highlight');
  const best = a.reduce((m, h) => (h.score > m.score ? h : m), a[0]);
  assert.ok(best.startMs <= 55000 && best.endMs >= 65000, 'best phủ trọn core 55–65s: ' + best.startMs + '-' + best.endMs);
  assert.strictEqual(best.endMs - best.startMs, 15000, 'cửa sổ ngắn nhất cho phép khi đỉnh hẹp (= minLen): ' + (best.endMs - best.startMs));
  for (const h of a) {
    assert.ok(h.endMs - h.startMs >= 15000 && h.endMs - h.startMs <= 30000, 'độ dài trong khoảng');
    assert.ok(h.score > 0 && h.score <= 10, 'thang 0-10: ' + h.score);
    assert.ok(/đa tín hiệu local/.test(h.reasons[0]), 'reason khai báo nguồn: ' + h.reasons[0]);
    assert.ok(h.startMs < 70000 && h.endMs > 50000, 'clip phải overlap vùng nóng: ' + h.startMs + '-' + h.endMs);
    if (h !== best) assert.ok(h.score >= best.score * 0.35 - 0.01, 'FLOOR 35% đỉnh: ' + h.score + ' vs ' + best.score);
  }
  for (let i = 1; i < a.length; i++) assert.ok(a[i].startMs >= a[i - 1].endMs, 'non-overlap');
  const cold = E.pickHighlightsByFusion(feats.map((f) => ({ t: f.t, energy: f.energy, pitch: f.pitch, voiced: f.voiced, v: f.v * 0.2 })), opts);
  assert.ok(cold.length === 0 || cold[0].score > 0, 'tín hiệu đều nhau vẫn deterministic');
  const noP = E.pickHighlightsByFusion(feats.map((f) => ({ t: f.t, energy: f.energy, pitch: null, voiced: f.voiced, v: f.v })), { minLen: 15, maxLen: 30, maxClips: 1 });
  assert.ok(/không có cao độ/.test(noP[0].reasons[0]), 'khai báo thiếu pitch: ' + noP[0].reasons[0]);
  assert.deepStrictEqual(E.pickHighlightsByFusion([], opts), []);
  assert.deepStrictEqual(E.pickHighlightsByFusion([{ t: 0, energy: 1, pitch: 1, voiced: 1, v: 1 }], opts), [], '1 window → []');
  assert.deepStrictEqual(E.pickHighlightsByFusion(feats.map((f) => ({ t: f.t, energy: 0, pitch: 0, voiced: 0, v: 0 })), opts), [], 'toàn bộ bằng 0 → [] (không bịa điểm)');
});
t('Tier A integration: fusion → snap giữ cửa sổ hợp lệ trong dung lượng video', () => {
  const sr = 8000;
  const samples = t11sine(30, 120, sr).concat(t11sine(10, 220, sr, 26000)).concat(t11sine(20, 120, sr));
  const buf = t11mkWav(samples, sr, 1);
  const info = E.pcmFromWav(buf);
  const wins = E.energyWindowsFromPcm(buf, info, { windowSec: 1 });
  const pr = E.estimatePitchFrames(buf, info, {});
  const fus = E.fuseLocalScores(wins, { pitchWins: E.pitchWindowsFromFrames(pr.frames, wins) });
  assert.strictEqual(fus.hasPitch, true);
  const top = E.pickHighlightsByFusion(fus.feats, { minLen: 15, maxLen: 45, maxClips: 2 });
  assert.ok(top.length >= 1, 'phải chọn được highlight vùng to 30–40s');
  const best = top.reduce((m, h) => (h.score > m.score ? h : m), top[0]);
  assert.ok(best.startMs < 40000 && best.endMs > 30000, 'best phủ vùng to: ' + best.startMs + '-' + best.endMs);
  const anchors = E.buildBoundaryAnchors([29800, 40100], E.detectSilence(wins, {}).gaps, {});
  const sn = E.snapWindowEdges(
    top.map((c) => ({ startMs: c.startMs, endMs: c.endMs, score: c.score, reason: c.reasons[0] })),
    anchors, { minLen: 15, maxLen: 45, durationMs: 60000 });
  for (const h of sn.highlights) {
    assert.ok(h.startMs >= 0 && h.endMs <= 60000, 'trong dung lượng: ' + h.startMs + '-' + h.endMs);
    assert.ok(h.endMs - h.startMs >= 15000 && h.endMs - h.startMs <= 45000, 'độ dài hợp lệ sau snap');
  }
});

console.log('\nViral Cut engine test: ' + passed + ' test PASS, exitCode=' + (process.exitCode || 0));
