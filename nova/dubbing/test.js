'use strict';
/* ============================================================
   DUBBING — TEST ENGINE THUẦN (unit, không cần Electron/mạng)
   Chạy: npm run test:dub  →  node nova/dubbing/test.js
   Che phủ: fitCuePlan (khớp khe, tăng tốc giữ cao độ có trần,
   trim đuôi lố, cue cuối tổng video, SRT lỗi), buildOutCues,
   summarizePlan. IPC/TTS thật chạy trong app (dialog thật — Luật 6
   dữ liệu thật), không bịa fixture audio ở đây.
   ============================================================ */
const assert = require('assert');
const E = require('./engine');

let passed = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { passed++; console.log('  [OK] ' + name); },
        (e) => { console.error('  [FAIL] ' + name + ' → ' + (e && e.message)); process.exitCode = 1; });
    }
    passed++; console.log('  [OK] ' + name);
  }
  catch (e) { console.error('  [FAIL] ' + name + ' → ' + (e && e.message)); process.exitCode = 1; }
}

const CUES = [
  { startMs: 1000, endMs: 3000, text: 'a' },
  { startMs: 4000, endMs: 5000, text: 'b' },
  { startMs: 7000, endMs: 9000, text: 'c' },
];

/* ── fitCuePlan ── */
t('fitCuePlan: audio vừa khe → speed 1, không trim', () => {
  const plan = E.fitCuePlan(CUES, [1500, 800, 1000], {});
  assert.strictEqual(plan[0].speed, 1);
  assert.strictEqual(plan[0].trimmedMs, 0);
  assert.strictEqual(plan[0].slotMs, 3000); // 4000 - 1000
  assert.strictEqual(plan[0].endMs, 2500);
});
t('fitCuePlan: audio lố nhẹ → tăng tốc vừa đủ lấp khe (trần cho phép)', () => {
  const plan = E.fitCuePlan(CUES, [6000, 800, 1000], { maxSpeed: 2 });
  assert.strictEqual(plan[0].speed, 2); // 6000/3000
  assert.strictEqual(plan[0].trimmedMs, 0);
  assert.strictEqual(plan[0].endMs, 4000);
});
t('fitCuePlan: audio lố nhiều quá trần → speed = trần + trim đuôi, lấp đúng khe', () => {
  const plan = E.fitCuePlan(CUES, [9000, 800, 1000], { maxSpeed: 1.5 });
  assert.strictEqual(plan[0].speed, 1.5);
  assert.strictEqual(plan[0].trimmedMs, 9000 - 4500); // phần đuôi bị cắt (khai báo)
  assert.strictEqual(plan[0].endMs, 1000 + 3000); // (9000-4500)/1.5 = 3000 → đúng khe
});
t('fitCuePlan: mặc định trần 1.35 — cue cuối theo totalMs', () => {
  const plan = E.fitCuePlan(CUES, [1000, 1000, 8000], { totalMs: 10000 });
  assert.strictEqual(plan[2].slotMs, 3000); // 10000 - 7000
  assert.strictEqual(plan[2].speed, 1.35);
  assert.strictEqual(plan[2].endMs, 10000); // lấp đúng tới hết video
});
t('fitCuePlan: không totalMs → cue cuối khe vô hạn (slotMs null)', () => {
  const plan = E.fitCuePlan(CUES, [1000, 1000, 99000], {});
  assert.strictEqual(plan[2].slotMs, null);
  assert.strictEqual(plan[2].speed, 1);
  assert.strictEqual(plan[2].endMs, 7000 + 99000);
});
t('fitCuePlan: SRT lỗi cue đè cue sau → slotMs null + khai báo prevOverlap', () => {
  const cues = [{ startMs: 1000, endMs: 5000, text: 'a' }, { startMs: 800, endMs: 1200, text: 'b' }];
  const plan = E.fitCuePlan(cues, [2000, 2000], {});
  assert.strictEqual(plan[1].slotMs, null);
  assert.strictEqual(plan[1].prevOverlap, true);
});
/* ── fitCuePlan: trần tốc độ kẹp trong 1..2.5 ── */
t('fitCuePlan: trần tốc độ kẹp trong 1..2.5', () => {
  const plan = E.fitCuePlan(CUES, [9000, 800, 1000], { maxSpeed: 9 });
  assert.ok(plan[0].speed <= 2.5);
});

/* ── buildOutCues ── */
t('buildOutCues: endMs = startMs + hiệu quả sau co giãn/trim', () => {
  const cues = [{ startMs: 1000, endMs: 3000, text: 'a' }];
  const plan = E.fitCuePlan(cues, [6000], { maxSpeed: 2, totalMs: 4000 });
  const out = E.buildOutCues(cues, plan);
  assert.strictEqual(out[0].startMs, 1000);
  assert.strictEqual(out[0].endMs, 4000); // (6000)/2 = 3000 → 1000+3000
  assert.strictEqual(out[0].text, 'a');
});

/* ── summarizePlan ── */
t('summarizePlan: đếm spedUp/trimmed/maxSpeed đúng', () => {
  const plan = E.fitCuePlan(CUES, [6000, 800, 10000], { totalMs: 9000, maxSpeed: 1.5 });
  const s = E.summarizePlan(plan);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.spedUp, 2);
  assert.ok(s.trimmed >= 1);
  assert.ok(s.maxSpeed <= 1.5);
  assert.ok(s.trimmedTotalMs > 0);
});

/* ── splitSpeakerCues (2026-09-17) ── */
t('splitSpeakerCues: tách prefix "Tên:" khỏi lời đọc', () => {
  const r = E.splitSpeakerCues([
    { startMs: 0, endMs: 1000, text: 'Nam: chào cả nhà' },
    { startMs: 1000, endMs: 2000, text: 'Nữ: chào Nam' },
    { startMs: 2000, endMs: 3000, text: 'không có prefix' },
    { startMs: 3000, endMs: 4000, text: 'Lan： prefix hai chấm đầy' },
  ]);
  assert.strictEqual(r[0].speaker, 'Nam');
  assert.strictEqual(r[0].spokenText, 'chào cả nhà');
  assert.strictEqual(r[1].speaker, 'Nữ');
  assert.strictEqual(r[2].speaker, '');
  assert.strictEqual(r[2].spokenText, 'không có prefix');
  assert.strictEqual(r[3].speaker, 'Lan');
  assert.strictEqual(r[3].spokenText, 'prefix hai chấm đầy');
});
t('splitSpeakerCues: tên quá dài (26 ký tự) → không tính là prefix', () => {
  const long = 'x'.repeat(26) + ': nội dung';
  const r = E.splitSpeakerCues([{ text: long }]);
  assert.strictEqual(r[0].speaker, '');
  assert.strictEqual(r[0].spokenText, long);
});
t('splitSpeakerCues: URL "https://" không bị nhận là prefix (tên có dấu chấm vẫn ≤24 — nhưng http không hai chấm sau tên hợp lệ)', () => {
  /* "https://abc" — tên "https" 5 ký tự + "//" không khớp \s*[:：]\s+ sau tên
     vì sau dấu hai chấm là "//" không có dấu cách → KHÔNG phải prefix... thực tế
     RE khớp "https:" rồi yêu cầu \s+ sau ':' — "//" không phải \s → không khớp. */
  const r = E.splitSpeakerCues([{ text: 'https://example.com/video: 30s' }]);
  assert.strictEqual(r[0].speaker, '');
});

/* ── assignSpeakerVoices (2026-09-17) ── */
t('assignSpeakerVoices: round-robin theo thứ tự xuất hiện đầu tiên, deterministic', () => {
  const sp = E.splitSpeakerCues([
    { text: 'Nam: một' }, { text: 'Nữ: hai' }, { text: 'Nam: ba' }, { text: 'bốn' }, { text: 'Nữ: năm' },
  ]);
  const av = E.assignSpeakerVoices(sp, ['P1', 'P2']);
  assert.deepStrictEqual(av.map, { Nam: 'P1', Nữ: 'P2', '': 'P1' });
  assert.deepStrictEqual(av.voices, ['P1', 'P2', 'P1', 'P1', 'P2']);
});
t('assignSpeakerVoices: 1 giọng → mọi nhân vật cùng giọng đó', () => {
  const sp = E.splitSpeakerCues([{ text: 'Nam: a' }, { text: 'Nữ: b' }]);
  const av = E.assignSpeakerVoices(sp, ['ONLY']);
  assert.deepStrictEqual(av.voices, ['ONLY', 'ONLY']);
});
t('assignSpeakerVoices: rỗng pids → mọi giọng \'\' (mặc định backend)', () => {
  const sp = E.splitSpeakerCues([{ text: 'Nam: a' }]);
  const av = E.assignSpeakerVoices(sp, []);
  assert.deepStrictEqual(av.voices, ['']);
});

/* ── splitScriptText + cuesFromDurationsMs (2026-09-17ze: tạo SRT từ kịch bản) ── */
t('splitScriptText: tách câu theo dấu câu, giữ nguyên dấu', () => {
  const r = E.splitScriptText('Xin chào! Hôm nay thế nào? Tôi ổn. Vậy nhé…');
  assert.deepStrictEqual(r, ['Xin chào!', 'Hôm nay thế nào?', 'Tôi ổn.', 'Vậy nhé…']);
});
t('splitScriptText: dòng trống bỏ qua, xuống dòng = ranh giới ý', () => {
  const r = E.splitScriptText('Câu một.\n\nCâu hai.\n   \nCâu ba.');
  assert.deepStrictEqual(r, ['Câu một.', 'Câu hai.', 'Câu ba.']);
});
t('splitScriptText: gộp câu lẻ quá ngắn vào câu liền trước', () => {
  const r = E.splitScriptText('Ừ. Đây là câu đầy đủ có nội dung rõ ràng.');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0], 'Ừ. Đây là câu đầy đủ có nội dung rõ ràng.');
});
t('splitScriptText: câu dài tách tại dấu phẩy gần maxChars nhất', () => {
  const a = 'aaaaaaaaaa, bbbbbbbbbb, cccccccccc, dddddddddd';
  const r = E.splitScriptText(a, { maxChars: 26 });
  assert.ok(r.length >= 2);
  for (const s of r) assert.ok(s.length <= 26, 'đoạn vượt maxChars: ' + s.length);
  assert.strictEqual(r.join(' '), a); // không mất ký tự
});
t('splitScriptText: rỗng → mảng rỗng; deterministic', () => {
  assert.deepStrictEqual(E.splitScriptText('   '), []);
  assert.deepStrictEqual(E.splitScriptText(''), []);
  assert.deepStrictEqual(E.splitScriptText('Một hai ba.', {}), E.splitScriptText('Một hai ba.', {}));
});
t('cuesFromDurationsMs: xếp tuần tự + gapMs', () => {
  const cues = E.cuesFromDurationsMs(['a', 'b', 'c'], [1000, 500, 800], { gapMs: 120 });
  assert.deepStrictEqual(cues, [
    { startMs: 0, endMs: 1000, text: 'a' },
    { startMs: 1120, endMs: 1620, text: 'b' },
    { startMs: 1740, endMs: 2540, text: 'c' },
  ]);
});
t('cuesFromDurationsMs: thiếu thời lượng → DUB_PROBE lộ liễu', () => {
  try { E.cuesFromDurationsMs(['a', 'b'], [1000, 0]); assert.fail('phải ném'); }
  catch (e) { assert.strictEqual(e.code, 'DUB_PROBE'); }
  assert.throws(() => E.cuesFromDurationsMs(['a'], [undefined]), /DUB_PROBE/);
});

/* ── presets (2026-09-17ze: lưu/nạp cấu hình Lồng Tiếng) — fixture trong os.tmpdir ── */
const os = require('os');
const fs = require('fs');
const path = require('path');
const PRESETS = require('./presets');
t('presets: save → list → upsert đè đúng tên → delete; thiếu → DUB_PRESET_MISSING', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dub-preset-test-'));
  try {
    assert.deepStrictEqual(PRESETS.listPresets(dir), []); // chưa có file = rỗng hợp lệ
    PRESETS.savePreset(dir, 'Kênh A', { voicePid: 'P1', language: 'vi', maxSpeed: '1.5', duck: 1, speakerVoices: ['x', '', 'y'] });
    PRESETS.savePreset(dir, 'Kênh B', { voicePid: 'P2' });
    let list = PRESETS.listPresets(dir);
    assert.strictEqual(list.length, 2);
    assert.deepStrictEqual(list[0].config, { voicePid: 'P1', language: 'vi', maxSpeed: 1.5, duck: true, speakerVoices: ['x', 'y'] }); // whitelist + ép kiểu
    PRESETS.savePreset(dir, 'Kênh A', { voicePid: 'P9' }); // đè cùng tên
    list = PRESETS.listPresets(dir);
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].config.voicePid, 'P9');
    PRESETS.deletePreset(dir, 'Kênh A');
    assert.strictEqual(PRESETS.listPresets(dir).length, 1);
    try { PRESETS.deletePreset(dir, 'Kênh A'); assert.fail('phải ném'); }
    catch (e) { assert.strictEqual(e.code, 'DUB_PRESET_MISSING'); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
t('presets: tên rỗng → DUB_PRESET_NAME; JSON lạ bị bỏ qua whitelist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dub-preset-test-'));
  try {
    try { PRESETS.savePreset(dir, '   ', {}); assert.fail('phải ném'); }
    catch (e) { assert.strictEqual(e.code, 'DUB_PRESET_NAME'); }
    PRESETS.savePreset(dir, 'W', { hacker: true, voicePid: 'P1', speakerVoices: 'không phải mảng' });
    const cfg = PRESETS.listPresets(dir)[0].config;
    assert.strictEqual(cfg.hacker, undefined);
    assert.strictEqual(cfg.speakerVoices, undefined);
    assert.strictEqual(cfg.voicePid, 'P1');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log('\nĐã chạy ' + (passed + (process.exitCode ? 1 : 0)) + ' nhóm test — ' + passed + ' PASS');
