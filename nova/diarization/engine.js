'use strict';
/* ============================================================
   DIARIZATION — TÁCH NGƯỜI NÓI + GÁN GIỌNG THEO GIỚI TÍNH
   (Bước 3 lộ trình ezmaxsub)
   ------------------------------------------------------------
   Recipe: video → ffmpeg trích WAV 8kHz mono → per-cue cao độ
   F0 (NCCF autocorrelation trên khung tiếng nói, lấy mẫu ≤
   framesPerCue khung/cue — deterministic) → phân cụm cue theo
   khoảng cách F0 (ngưỡng f0GapHz) → suy giới tính từng người
   nói theo median F0 (≤165Hz nam, ≥185Hz nữ, giữa = không rõ)
   → gán giọng OmniVoice từ voicebank theo attributes.gender /
   tags / nhãn "(Nam)/(Nữ)" trong tên → viết lại SRT với prefix
   "Tên:" ĐÚNG hợp đồng dubbing (SPEAKER_RE của nova/dubbing).
   Lỗi lộ liễu mã DIAZ_* (Luật 10). Phần thuần (không Electron,
   không spawn) nằm ở nửa đầu file để unit-test; orchestrator
   `analyze` ở cuối (ffmpeg qua native-tools/ffmpeg).
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG } = require('../native-tools/ffmpeg');

function errCode(code, msg) {
  const e = new Error(code + ': ' + msg);
  e.code = code;
  return e;
}

/* ═══ 1. SRT — parse + serialize (hợp đồng cue {startMs,endMs,text}) ═══ */

function srtTimeToMs(s) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(String(s || '').trim());
  if (!m) return null;
  return ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + (+m[4].padEnd(3, '0'));
}

function msToSrtTime(ms) {
  const t = Math.max(0, Math.round(Number(ms) || 0));
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const ms3 = t % 1000;
  const p = (n, w) => String(n).padStart(w, '0');
  return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(ms3, 3);
}

function parseSrt(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = raw.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    const tIdx = lines.findIndex((l) => l.includes('-->'));
    if (tIdx < 0) continue; // khối số thứ tự/mô tả cô lập — bỏ
    const times = lines[tIdx].split('-->');
    const startMs = srtTimeToMs(times[0]);
    const endMs = srtTimeToMs((times[1] || '').split(/\s+/).filter(Boolean)[0] || '');
    if (startMs == null || endMs == null || endMs <= startMs) {
      throw errCode('DIAZ_SRT_BAD', 'Cue SRT sai timestamp: ' + lines[tIdx]);
    }
    const cueText = lines.slice(tIdx + 1).join('\n').trim();
    if (!cueText) throw errCode('DIAZ_SRT_BAD', 'Cue rỗng tại ' + lines[tIdx]);
    cues.push({ startMs, endMs, text: cueText });
  }
  if (!cues.length) throw errCode('DIAZ_SRT_BAD', 'SRT không có cue nào.');
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].startMs < cues[i - 1].startMs) {
      throw errCode('DIAZ_SRT_ORDER', 'Cue ' + (i + 1) + ' bắt đầu trước cue ' + i + ' — SRT không tăng dần.');
    }
  }
  return cues;
}

function cuesToSrtText(cues) {
  const list = Array.isArray(cues) ? cues : [];
  return list.map((c, i) =>
    (i + 1) + '\n' + msToSrtTime(c.startMs) + ' --> ' + msToSrtTime(c.endMs) + '\n' + String(c.text || '')
  ).join('\n\n') + '\n';
}

/* ═══ 2. WAV — parse PCM16 (mono 8kHz từ ffmpeg, downmix phòng hờ) ═══ */

function parseWav(buf) {
  if (!buf || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw errCode('DIAZ_WAV_BAD', 'File WAV sai header RIFF/WAVE.');
  }
  let off = 12;
  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(off + 8),
        channels: buf.readUInt16LE(off + 10),
        sampleRate: buf.readUInt32LE(off + 12),
        bitsPerSample: buf.readUInt16LE(off + 22),
      };
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, buf.length - dataOff);
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataOff < 0) throw errCode('DIAZ_WAV_BAD', 'WAV thiếu chunk fmt/data.');
  if (!(fmt.audioFormat === 1 || fmt.audioFormat === 0xFFFE) || fmt.bitsPerSample !== 16 || !(fmt.channels >= 1)) {
    throw errCode('DIAZ_WAV_BAD', 'WAV phải PCM 16-bit (nhận format=' + fmt.audioFormat + ', bits=' + fmt.bitsPerSample + ').');
  }
  if (!(fmt.sampleRate > 0)) throw errCode('DIAZ_WAV_BAD', 'WAV sampleRate không hợp lệ.');
  const bytesPerFrame = 2 * fmt.channels;
  const nFrames = Math.floor(dataLen / bytesPerFrame);
  const pcm = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let acc = 0;
    const base = dataOff + i * bytesPerFrame;
    for (let ch = 0; ch < fmt.channels; ch++) acc += buf.readInt16LE(base + ch * 2);
    pcm[i] = acc / fmt.channels / 32768;
  }
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: 16, pcm };
}

/* ═══ 3. F0 — NCCF autocorrelation trên khung tiếng nói ═══
   Trả mảng frame { tMs, rms, f0 (Hz | null), clarity }; khung
   rms dưới sàn hoặc clarity thấp → f0 = null (không đoán). */
const PITCH_FRAME_8K = 256;   // 32ms @ 8kHz
const PITCH_HOP_8K = 160;     // 20ms @ 8kHz
const F0_MIN_HZ = 65;
const F0_MAX_HZ = 400;
const CLARITY_MIN = 0.5;

function nccfF0(frame, sampleRate) {
  const n = frame.length;
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += frame[i] * frame[i];
  if (e0 <= 1e-9) return { f0: null, clarity: 0 };
  const lagMin = Math.max(2, Math.floor(sampleRate / F0_MAX_HZ));
  const lagMax = Math.min(n - 2, Math.ceil(sampleRate / F0_MIN_HZ));
  let bestLag = -1;
  let bestVal = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0, eL = 0;
    for (let i = 0; i + lag < n; i++) {
      s += frame[i] * frame[i + lag];
      eL += frame[i + lag] * frame[i + lag];
    }
    if (eL <= 1e-9) continue;
    const val = s / Math.sqrt(e0 * eL);
    if (val > bestVal) { bestVal = val; bestLag = lag; }
  }
  if (bestLag < 0 || bestVal < CLARITY_MIN) return { f0: null, clarity: bestVal };
  return { f0: sampleRate / bestLag, clarity: bestVal };
}

function pitchTrack(pcm, sampleRate, opts = {}) {
  if (!(sampleRate > 0)) throw errCode('DIAZ_WAV_BAD', 'sampleRate phải > 0.');
  const total = pcm.length;
  const hop = Math.max(1, Math.round(PITCH_HOP_8K * (sampleRate / 8000)));
  const frameLen = Math.round(PITCH_FRAME_8K * (sampleRate / 8000));
  const rmsFloor = Number(opts.rmsFloor) || 0.008;   // sàn tuyệt đối chống muội
  const frames = [];
  for (let start = 0; start + frameLen <= total; start += hop) {
    let sq = 0;
    for (let i = 0; i < frameLen; i++) sq += pcm[start + i] * pcm[start + i];
    const rms = Math.sqrt(sq / frameLen);
    const tMs = Math.round((start / sampleRate) * 1000);
    if (rms < rmsFloor) {
      frames.push({ tMs, rms: Math.round(rms * 1e4) / 1e4, f0: null, clarity: 0 });
      continue;
    }
    const f = nccfF0(pcm.subarray(start, start + frameLen), sampleRate);
    frames.push({
      tMs,
      rms: Math.round(rms * 1e4) / 1e4,
      f0: f.f0 ? Math.round(f.f0 * 10) / 10 : null,
      clarity: Math.round(f.clarity * 100) / 100,
    });
  }
  return frames;
}

/* ═══ 4. Per-cue stats + phân cụm người nói (deterministic) ═══ */

function median(arr) {
  const a = (arr || []).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function cuePitchStats(frames, cues, opts = {}) {
  const framesPerCue = Math.max(5, Number(opts.framesPerCue) || 30);
  const minVoiced = Math.max(2, Number(opts.minVoiced) || 5);
  const list = Array.isArray(cues) ? cues : [];
  return list.map((c) => {
    const startMs = Math.round(Number(c.startMs) || 0);
    const endMs = Math.round(Number(c.endMs) || 0);
    const inCueAll = frames.filter((f) => f.tMs >= startMs && f.tMs < endMs);
    const inCue = inCueAll.filter((f) => f.f0 != null);
    let f0Median = null;
    let voicedRatio = 0;
    if (inCue.length >= minVoiced) {
      // lấy mẫu đều — đủ để trả "median F0 của cue" mà không đo mọi khung
      const step = Math.max(1, Math.floor(inCue.length / framesPerCue));
      const sampled = [];
      for (let i = 0; i < inCue.length; i += step) sampled.push(inCue[i].f0);
      f0Median = Math.round(median(sampled) * 10) / 10;
      voicedRatio = inCueAll.length ? Math.round((inCue.length / inCueAll.length) * 100) / 100 : 0;
    }
    return { startMs, endMs, f0Median, voicedRatio, nVoiced: inCue.length };
  });
}

/* Phân cụm tuần tự theo thời gian: cue gán vào speaker có mean-F0 gần nhất
   trong ngưỡng f0GapHz, else tạo speaker mới ("Người N" theo thứ tự xuất
   hiện). Cue không đọc được F0 (nhạc/lời quá ngắn) → KẾ THỪA speaker của
   cue ngay trước (heuristic khai báo rõ qua `inherited`, không bịa người
   nói mới). Giới tính theo mean F0 của người nói. */
function diarizeCues(stats, opts = {}) {
  const gapHz = Math.max(5, Number(opts.f0GapHz) || 30);
  const genderLowMax = Number(opts.genderLowMax) || 165;
  const genderHighMin = Number(opts.genderHighMin) || 185;
  const speakers = [];
  const cueSpeakers = [];
  let lastSpeaker = 0;
  let inherited = 0;
  for (let i = 0; i < stats.length; i++) {
    const st = stats[i];
    if (st.f0Median == null) {
      if (!speakers.length) throw errCode('DIAZ_NO_SPEECH', 'Cue đầu tiên không đọc được cao độ — không thể tách người nói.');
      cueSpeakers.push(lastSpeaker);
      inherited++;
      continue;
    }
    let best = -1;
    let bestD = Infinity;
    for (let s = 0; s < speakers.length; s++) {
      const d = Math.abs(speakers[s].f0Mean - st.f0Median);
      if (d < bestD) { bestD = d; best = s; }
    }
    let si;
    if (best >= 0 && bestD <= gapHz) {
      si = best;
      speakers[si].f0s.push(st.f0Median);
      speakers[si].f0Mean = Math.round((speakers[si].f0s.reduce((a, b) => a + b, 0) / speakers[si].f0s.length) * 10) / 10;
    } else {
      si = speakers.length;
      speakers.push({ id: si, name: 'Người ' + (si + 1), f0s: [st.f0Median], f0Mean: st.f0Median, firstCue: i });
    }
    speakers[si].cueCount = (speakers[si].cueCount || 0) + 1;
    cueSpeakers.push(si);
    lastSpeaker = si;
  }
  if (!speakers.length) throw errCode('DIAZ_NO_SPEECH', 'Không đọc được cao độ ở bất kỳ cue nào — audio không có tiếng nói rõ.');
  for (const sp of speakers) {
    const f0 = sp.f0Mean;
    if (f0 <= genderLowMax) {
      sp.gender = 'nam';
      sp.confidence = Math.min(0.95, Math.max(0.3, (genderLowMax - f0) / 50 + 0.4));
    } else if (f0 >= genderHighMin) {
      sp.gender = 'nữ';
      sp.confidence = Math.min(0.95, Math.max(0.3, (f0 - genderHighMin) / 50 + 0.4));
    } else {
      sp.gender = 'không rõ';
      sp.confidence = 0.3;
    }
    sp.confidence = Math.round(sp.confidence * 100) / 100;
    delete sp.f0s;
  }
  return { speakers, cueSpeakers, inherited };
}

/* Giới tính của giọng voicebank: attributes.gender → tags → nhãn trong tên
   (dịch vụ OmniVoice/giọng clone thường ghi "(Nam)"/"(Nữ)" trong label). */
function genderOfVoice(voice) {
  const v = voice || {};
  const attrs = (v.attributes && typeof v.attributes === 'object') ? v.attributes : {};
  const norm = (s) => String(s || '').toLowerCase().trim();
  const a = norm(attrs.gender);
  if (['male', 'nam', 'm', '♂'].includes(a)) return 'male';
  if (['female', 'nữ', 'nu', 'f', '♀'].includes(a)) return 'female';
  const tags = Array.isArray(v.tags) ? v.tags.map(norm) : [];
  if (tags.some((t) => ['male', 'nam', 'giọng nam'].includes(t))) return 'male';
  if (tags.some((t) => ['female', 'nữ', 'nu', 'giọng nữ'].includes(t))) return 'female';
  const name = norm(v.name);
  if (/(^|[^a-zà-ỹ])(nam|male)([^a-zà-ỹ]|$)/.test(name)) return 'male';
  if (/(^|[^a-zà-ỹ])(nữ|nu|female)([^a-zà-ỹ]|$)/.test(name)) return 'female';
  return null;
}

/* Gán giọng: speaker nam lấy từ pool nam, nữ từ pool nữ, "không rõ" từ pool
   gộp. Round-robin theo thứ tự speaker — deterministic. Thiếu giọng cho một
   giới tính cần gán → FAIL LỘ LIỄU DIAZ_NO_VOICE_* (Luật 10). */
function assignVoicesByGender(speakers, voices, opts = {}) {
  const vs = (Array.isArray(voices) ? voices : []).filter((v) => v && (v.pid || v.id));
  if (!vs.length) throw errCode('DIAZ_NO_VOICES', 'Danh sách giọng trống — nạp giọng OmniVoice trước khi gán.');
  const poolM = [], poolF = [];
  for (const v of vs) {
    const g = genderOfVoice(v);
    if (g === 'male') poolM.push(v);
    else if (g === 'female') poolF.push(v);
  }
  const poolAny = poolM.concat(poolF);
  const take = (pool, i, code) => {
    if (!pool.length) throw errCode(code, 'Không có giọng nào khớp giới tính cần gán — nạp/chọn thêm giọng trong Voice Studio.');
    return pool[i % pool.length];
  };
  let mi = 0, fi = 0, ai = 0;
  const assignment = (Array.isArray(speakers) ? speakers : []).map((sp) => {
    const g = (sp && sp.gender) || 'không rõ';
    let v;
    if (g === 'nam') v = take(poolM, mi++, 'DIAZ_NO_VOICE_MALE');
    else if (g === 'nữ') v = take(poolF, fi++, 'DIAZ_NO_VOICE_FEMALE');
    else v = take(poolAny, ai++, 'DIAZ_NO_VOICE_ANY');
    return { speakerId: sp.id, speaker: sp.name, gender: g, pid: v.pid || v.id, voiceName: v.name || '', via: opts.via || 'pitch-gender' };
  });
  return { assignment, pools: { male: poolM.length, female: poolF.length, any: poolAny.length } };
}

/* ═══ 6. Viết lại SRT với prefix "Tên:" (hợp đồng dubbing) ═══ */

/* Cùng ngữ pháp prefix với nova/dubbing/engine.js SPEAKER_RE — cue đã có
   prefix người nói thì GIỮ NGUYÊN (không đè prefix của người dùng). */
const SPEAKER_RE = /^([^:：\n]{1,24})\s*[:：]\s+/;

function rewriteSrtWithSpeakers(cues, cueSpeakers, speakers) {
  const list = Array.isArray(cues) ? cues : [];
  const idx = Array.isArray(cueSpeakers) ? cueSpeakers : [];
  const sps = Array.isArray(speakers) ? speakers : [];
  if (idx.length !== list.length) throw errCode('DIAZ_MAP_BAD', 'Số lượng cue và bản đồ speaker không khớp (' + idx.length + ' vs ' + list.length + ').');
  let changed = 0;
  const out = list.map((c, i) => {
    const sp = sps[idx[i]] || sps[0];
    if (!sp || SPEAKER_RE.test(String(c.text || ''))) return c;
    changed++;
    return Object.assign({}, c, { text: sp.name + ': ' + String(c.text || '') });
  });
  return { cues: out, srt: cuesToSrtText(out), changed };
}

/* ═══ 7. Orchestrator — ffmpeg trích WAV rồi chạy chuỗi trên ═══ */

function extractWav({ videoPath, outWav, onChild, isCancelled }) {
  if (!FFMPEG || !fs.existsSync(FFMPEG)) throw errCode('DIAZ_NO_FFMPEG', 'Không tìm thấy FFmpeg binary.');
  if (!fs.existsSync(videoPath)) throw errCode('DIAZ_NO_VIDEO', 'Không thấy video/audio nguồn: ' + videoPath);
  fs.mkdirSync(path.dirname(outWav), { recursive: true });
  const args = ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '8000', '-f', 'wav', outWav];
  return new Promise((resolve, reject) => {
    const cp = spawn(FFMPEG, args, { windowsHide: true });
    if (onChild) onChild(cp);
    let stderrTail = '';
    cp.stderr.on('data', (d) => { stderrTail = (stderrTail + String(d)).slice(-800); });
    cp.on('error', (e) => reject(errCode('DIAZ_FFMPEG_SPAWN', 'Không spawn được ffmpeg: ' + e.message)));
    cp.on('close', (code) => {
      if (isCancelled && isCancelled()) return reject(errCode('DIAZ_CANCELLED', 'Đã huỷ.'));
      if (code !== 0 || !fs.existsSync(outWav)) {
        return reject(errCode('DIAZ_FFMPEG_FAIL', 'ffmpeg thoát ' + code + ' khi trích audio. stderr: ' + stderrTail));
      }
      resolve(outWav);
    });
  });
}

async function analyze(p = {}) {
  const videoPath = String(p.videoPath || '').trim();
  if (!videoPath) throw errCode('DIAZ_NO_VIDEO', 'Thiếu video/audio nguồn.');
  const cues = parseSrt(p.srtText);
  const wavPath = String(p.wavPath || '').trim();
  if (!wavPath) throw errCode('DIAZ_NO_WAVPATH', 'Thiếu đường dẫn WAV tạm (do IPC cấp trong userData).');
  const onProgress = typeof p.onProgress === 'function' ? p.onProgress : () => {};
  onProgress({ pct: 3, detail: 'Trích audio 8kHz mono bằng ffmpeg…' });
  await extractWav({ videoPath, outWav: wavPath, onChild: p.onChild, isCancelled: p.isCancelled });
  onProgress({ pct: 35, detail: 'Đọc cao độ (F0) từng cue…' });
  const info = parseWav(fs.readFileSync(wavPath));
  const frames = pitchTrack(info.pcm, info.sampleRate, {});
  onProgress({ pct: 60, detail: 'Phân cụm người nói theo cao độ…' });
  const stats = cuePitchStats(frames, cues, {});
  const dia = diarizeCues(stats, {});
  onProgress({ pct: 85, detail: 'Gán giọng theo giới tính + viết lại SRT…' });
  const rewritten = rewriteSrtWithSpeakers(cues, dia.cueSpeakers, dia.speakers);
  let voiceAssignment = null;
  if (Array.isArray(p.voices) && p.voices.length) {
    voiceAssignment = assignVoicesByGender(dia.speakers, p.voices, {});
  }
  onProgress({ pct: 100, detail: 'Xong.' });
  return {
    ok: true,
    durationMs: Math.round((info.pcm.length / info.sampleRate) * 1000),
    cueCount: cues.length,
    speakers: dia.speakers,
    cueSpeakers: dia.cueSpeakers,
    inheritedCues: dia.inherited,
    srt: rewritten.srt,
    changedCues: rewritten.changed,
    voiceAssignment,
    stats,
  };
}

module.exports = {
  // SRT
  srtTimeToMs, msToSrtTime, parseSrt, cuesToSrtText,
  // WAV + pitch
  parseWav, nccfF0, pitchTrack,
  // diarization + gender + voice
  median, cuePitchStats, diarizeCues, genderOfVoice, assignVoicesByGender,
  rewriteSrtWithSpeakers,
  // orchestrator
  extractWav, analyze,
};



