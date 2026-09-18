'use strict';
/* ============================================================
   TEST DIARIZATION — hàm thuần (không Electron, không spawn)
   ------------------------------------------------------------
   Tín hiệu tổng hợp trong bộ nhớ: 2 "giọng" harmonic 110Hz
   (nam) và 210Hz (nữ) xen kẽ theo cue → kỳ vọng tách đúng 2
   người nói + đúng giới tính + SRT nhận prefix "Tên:". Không
   fixture audio trên đĩa — PCM sinh trong RAM (chỉ test hàm
   thuần; pipeline thật qua IPC chạy trong app — Luật 6).
   Chạy: npm run test:diarize
   ============================================================ */
const path = require('path');
const E = require(path.join(__dirname, 'engine.js'));

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, name) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; failures.push(name); console.log('  [FAIL] ' + name); }
}

function throws(fn, code, name) {
  try {
    fn();
    fail++; failures.push(name + ' (không ném)');
    console.log('  [FAIL] ' + name + ' (không ném)');
  } catch (e) {
    if ((e && e.code) === code) { pass++; console.log('  [OK] ' + name + ' → ' + code); }
    else {
      fail++; failures.push(name + ' (code sai: ' + (e && e.code) + ')');
      console.log('  [FAIL] ' + name + ' (code sai: ' + (e && e.code) + ' — ' + (e && e.message) + ')');
    }
  }
}

/* ── sinh PCM 8kHz: mỗi mục {startMs,endMs,f0} = đoạn có tiếng; còn lại lặng ── */
const SR = 8000;
function synthPcm(segments, totalMs) {
  const n = Math.floor((totalMs / 1000) * SR);
  const pcm = new Float32Array(n);
  for (const seg of segments) {
    const a = Math.floor((seg.startMs / 1000) * SR);
    const b = Math.min(n, Math.floor((seg.endMs / 1000) * SR));
    for (let i = a; i < b; i++) {
      const t = i / SR;
      const env = 0.8 + 0.2 * Math.sin(2 * Math.PI * 3 * t); // modulation giả giọng
      pcm[i] = env * (0.35 * Math.sin(2 * Math.PI * seg.f0 * t)
        + 0.18 * Math.sin(2 * Math.PI * seg.f0 * 2 * t)
        + 0.08 * Math.sin(2 * Math.PI * seg.f0 * 3 * t));
    }
  }
  return pcm;
}

function int16WavBytes(pcm, sampleRate) {
  // WAV hợp lệ tối thiểu: RIFF + fmt(PCM16 mono) + data
  const dataBytes = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(1, 22);            // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/* ══ 1. SRT: time convert + parse ══ */
console.log('[1] SRT parse/serialize');
ok(E.srtTimeToMs('00:00:01,500') === 1500, 'srtTimeToMs đọc 00:00:01,500 = 1500ms');
ok(E.srtTimeToMs('01:02:03.004') === 3723004, 'srtTimeToMs nhận dấu chấm (webvtt-style)');
ok(E.msToSrtTime(3723004) === '01:02:03,004', 'msToSrtTime ngược lại đúng');
const SRT = [
  '1', '00:00:00,000 --> 00:00:01,200', 'xin chào',
  '', '2', '00:00:02,000 --> 00:00:03,200', 'chào bạn nhé',
  '', '3', '00:00:04,000 --> 00:00:05,200', 'hôm nay thế nào',
  '', '4', '00:00:06,000 --> 00:00:07,200', 'rất là vui vẻ',
].join('\n') + '\n';
const cues = E.parseSrt(SRT);
ok(cues.length === 4 && cues[0].text === 'xin chào', 'parseSrt đọc 4 cue');
throws(() => E.parseSrt('1\n00:00:05,000 --> 00:00:01,000\nlệch'), 'DIAZ_SRT_BAD', 'parseSrt chặn end<=start');
throws(() => E.parseSrt('chào'), 'DIAZ_SRT_BAD', 'parseSrt chặn SRT không cue');

/* ══ 2. WAV parse ══ */
console.log('[2] WAV parse');
const pcm = synthPcm([
  { startMs: 0, endMs: 1200, f0: 110 },
  { startMs: 2000, endMs: 3200, f0: 210 },
  { startMs: 4000, endMs: 5200, f0: 115 },
  { startMs: 6000, endMs: 7200, f0: 215 },
], 8000);
const info = E.parseWav(int16WavBytes(pcm, SR));
ok(info.sampleRate === SR && info.pcm.length === Math.floor(8 * SR), 'parseWav đọc PCM16 mono 8kHz');
throws(() => E.parseWav(Buffer.from('khong phai wavxxxxxxxxxxxxx')), 'DIAZ_WAV_BAD', 'parseWav chặn file sai header');

/* ══ 3. Pitch track: F0 đọc đúng 2 dải ══ */
console.log('[3] Pitch track (NCCF)');
const frames = E.pitchTrack(info.pcm, SR, {});
const fA = frames.filter((f) => f.tMs >= 100 && f.tMs < 1100 && f.f0 != null).map((f) => f.f0);
const fB = frames.filter((f) => f.tMs >= 2100 && f.tMs < 3100 && f.f0 != null).map((f) => f.f0);
ok(fA.length >= 10 && E.median(fA) > 90 && E.median(fA) < 130, 'F0 dải nam ~110Hz (median=' + E.median(fA) + ')');
ok(fB.length >= 10 && E.median(fB) > 190 && E.median(fB) < 230, 'F0 dải nữ ~210Hz (median=' + E.median(fB) + ')');
ok(frames.filter((f) => f.tMs >= 1300 && f.tMs < 1900 && f.f0 != null).length === 0, 'khoảng lặng không bịa F0');

/* ══ 4. Per-cue stats + diarization ══ */
console.log('[4] Cue stats + phân cụm người nói');
const stats = E.cuePitchStats(frames, cues, {});
ok(stats.length === 4, 'cuePitchStats trả stats theo từng cue');
ok(stats.every((s) => s.f0Median != null), 'mọi cue đọc được F0 median');
const dia = E.diarizeCues(stats, {});
ok(dia.speakers.length === 2, 'tách đúng 2 người nói (nhận ' + dia.speakers.length + ')');
ok(dia.cueSpeakers.join(',') === '0,1,0,1', 'cue 1/3 = người 1, cue 2/4 = người 2 (nhận ' + dia.cueSpeakers.join(',') + ')');
ok(dia.speakers[0].name === 'Người 1' && dia.speakers[0].gender === 'nam', 'người 1 = nam (F0 ' + dia.speakers[0].f0Mean + 'Hz)');
ok(dia.speakers[1].name === 'Người 2' && dia.speakers[1].gender === 'nữ', 'người 2 = nữ (F0 ' + dia.speakers[1].f0Mean + 'Hz)');
ok(dia.inherited === 0, 'không có cue kế thừa (tín hiệu đủ rõ)');
const diaMid = E.diarizeCues(stats.map((s, i) => (i === 1 ? Object.assign({}, s, { f0Median: 175 }) : s)), {});
ok(diaMid.speakers.length === 3 && diaMid.speakers.some((s) => s.gender === 'không rõ'), 'F0 vùng mù 165–185Hz → "không rõ" (không bịa nam/nữ)');

/* ══ 5. Giới tính giọng + gán theo giới tính ══ */
console.log('[5] genderOfVoice + assignVoicesByGender');
ok(E.genderOfVoice({ attributes: { gender: 'nam' } }) === 'male', 'attributes.gender=nam → male');
ok(E.genderOfVoice({ tags: ['female'] }) === 'female', 'tags female → female');
ok(E.genderOfVoice({ name: 'Minh (Nam) — trầm ấm' }) === 'male', 'tên "(Nam)" → male');
ok(E.genderOfVoice({ name: 'Lan (Nữ) — trong trẻo' }) === 'female', 'tên "(Nữ)" → female');
ok(E.genderOfVoice({ name: 'Mystery' }) === null, 'không có dấu hiệu → null (không đoán)');
const VOICES = [
  { pid: 'v_nam_1', name: 'Minh (Nam) — trầm ấm' },
  { pid: 'v_nam_2', name: 'Hùng (Nam) — sân khấu' },
  { pid: 'v_nu_1', name: 'Lan (Nữ) — trong trẻo' },
  { pid: 'v_ngoai', name: 'Mystery' },
];
const av = E.assignVoicesByGender(dia.speakers, VOICES, {});
ok(av.assignment.length === 2
  && av.assignment[0].gender === 'nam' && av.assignment[0].pid === 'v_nam_1'
  && av.assignment[1].gender === 'nữ' && av.assignment[1].pid === 'v_nu_1',
  'gán nam→giọng nam, nữ→giọng nữ (deterministic)');
ok(av.pools.male === 2 && av.pools.female === 1, 'pool đếm đúng (male=2, female=1)');
throws(() => E.assignVoicesByGender(dia.speakers, [{ pid: 'v_nu_1', name: 'Lan (Nữ)' }]), 'DIAZ_NO_VOICE_MALE', 'thiếu giọng nam → FAIL LỘ LIỄU');
throws(() => E.assignVoicesByGender(dia.speakers, [{ name: 'Không pid' }]), 'DIAZ_NO_VOICES', 'danh sách giọng rỗng → FAIL LỘ LIỄU');

/* ══ 6. Viết lại SRT prefix "Tên:" ══ */
console.log('[6] rewriteSrtWithSpeakers');
const rw = E.rewriteSrtWithSpeakers(cues, dia.cueSpeakers, dia.speakers);
ok(rw.changed === 4, '4 cue được thêm prefix');
const rwCues = E.parseSrt(rw.srt);
ok(rwCues[0].text === 'Người 1: xin chào' && rwCues[1].text === 'Người 2: chào bạn nhé', 'prefix đúng speaker theo cue');
const rw2 = E.rewriteSrtWithSpeakers(rwCues, dia.cueSpeakers, dia.speakers);
ok(rw2.changed === 0 && rw2.cues[0].text === 'Người 1: xin chào', 'cue đã có prefix giữ nguyên (không đè)');
throws(() => E.rewriteSrtWithSpeakers(cues, [0, 1], dia.speakers), 'DIAZ_MAP_BAD', 'bản đồ speaker lệch số cue → FAIL');

/* ══ 7. Orchestrator fail-nhanh (trước mọi IO) ══ */
console.log('[7] Orchestrator fail-nhanh');
(async () => {
  try {
    await E.analyze({ videoPath: '', srtText: SRT, wavPath: 'x.wav' });
    fail++; failures.push('analyze thiếu video phải ném'); console.log('  [FAIL] analyze thiếu video phải ném');
  } catch (e) {
    if (e.code === 'DIAZ_NO_VIDEO') { pass++; console.log('  [OK] analyze thiếu video → DIAZ_NO_VIDEO'); }
    else { fail++; failures.push('analyze code sai: ' + e.code); console.log('  [FAIL] analyze code sai: ' + e.code + ' — ' + e.message); }
  }
  try {
    await E.analyze({ videoPath: 'khong-ton-tai.mp4', srtText: '', wavPath: 'x.wav' });
    fail++; failures.push('analyze SRT rỗng phải ném'); console.log('  [FAIL] analyze SRT rỗng phải ném');
  } catch (e) {
    if (e.code === 'DIAZ_SRT_BAD') { pass++; console.log('  [OK] analyze SRT rỗng → DIAZ_SRT_BAD'); }
    else { fail++; failures.push('analyze SRT code sai: ' + e.code); console.log('  [FAIL] analyze SRT code sai: ' + e.code); }
  }
  try {
    await E.analyze({ videoPath: 'khong-ton-tai.mp4', srtText: SRT, wavPath: '' });
    fail++; failures.push('analyze thiếu wavPath phải ném'); console.log('  [FAIL] analyze thiếu wavPath phải ném');
  } catch (e) {
    if (e.code === 'DIAZ_NO_WAVPATH') { pass++; console.log('  [OK] analyze thiếu wavPath → DIAZ_NO_WAVPATH'); }
    else { fail++; failures.push('analyze wavPath code sai: ' + e.code); console.log('  [FAIL] analyze wavPath code sai: ' + e.code); }
  }
  console.log('\n──────────────────────────');
  console.log('KẾT QUẢ: ' + pass + ' PASS, ' + fail + ' FAIL');
  if (fail) { console.log('Thất bại: ' + failures.join(' | ')); process.exit(1); }
  process.exit(0);
})();



