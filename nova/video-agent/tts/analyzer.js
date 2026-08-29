'use strict';
// §6 TTS Analyzer — TTS là Master Clock (§1.1). Ưu tiên timestamp do provider cung cấp.
// Không có → dùng ffprobe lấy duration audio + phân bổ từ ngữ deterministic (tái dùng documentary alignment).
const { buildDeterministicAlignment } = require('../../documentary/core/alignment');

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function wordItem(w, i) {
  const word = String(w.word || w.w || w.token || w.text || '').trim();
  const start = num(w.start != null ? w.start : w.s, num(w.begin, 0));
  const end = num(w.end != null ? w.end : w.e, num(w.to, start + 0.3));
  return { id: String(w.id || `w${i + 1}`), word, start: Math.max(0, start), end: Math.max(start, end),
    confidence: num(w.confidence != null ? w.confidence : w.c, 0.9), source: 'provider' };
}

function parseProviderJson(json) {
  const words = Array.isArray(json.words) ? json.words
    : Array.isArray(json.tokens) ? json.tokens
    : (Array.isArray(json) ? json : []);
  if (json.segments && !words.length && Array.isArray(json.segments)) {
    // chỉ có segments → dựng words giả theo từng segment để giữ thời lượng chính xác.
    const w = [];
    json.segments.forEach((seg, si) => {
      const s = num(seg.start, 0), e = num(seg.end, s + 0.3), text = String(seg.text || '').trim();
      const tokens = text ? text.split(/\s+/) : [];
      const step = tokens.length ? (e - s) / tokens.length : 0;
      tokens.forEach((tok, ti) => w.push({ id: `w${si + 1}_${ti + 1}`, word: tok,
        start: +(s + step * ti).toFixed(3), end: +(s + step * (ti + 1)).toFixed(3), confidence: 0.85, source: 'provider-segment' }));
    });
    return { words: w, duration: num(json.duration, w.length ? w[w.length - 1].end : 0), confidence: 0.85, provider: 'provider-segment' };
  }
  const out = words.map(wordItem).filter(w => w.word && w.end >= w.start);
  if (!out.length) return null;
  const duration = num(json.duration, out[out.length - 1].end);
  return { words: out, duration, confidence: num(json.confidence, 0.95), provider: String(json.provider || 'provider') };
}

// Nhóm từ thành câu: dừng tại dấu câu hoặc khoảng lặng > 0.8s hoặc đủ 14 từ.
function sentencesFromWords(words) {
  const sentences = []; let acc = [], start = null, last = 0;
  const flush = () => { if (acc.length) { sentences.push({ id: `s${sentences.length + 1}`, start, end: last,
    text: acc.join(' ').trim() }); acc = []; start = null; } };
  for (const w of words) {
    if (start === null) start = w.start;
    acc.push(w.word); last = w.end;
    if (/[.!?…:;？！]$/.test(w.word) || (w.start - last) > 0.8 || acc.length >= 14) flush();
  }
  flush();
  return sentences;
}

function audioDurationViaProbe(audioPath) {
  if (!audioPath) return null;
  let probe;
  try { probe = require('ffprobe-static'); } catch (_) { return null; }
  const { spawnSync } = require('child_process');
  try {
    const r = spawnSync(probe.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath], { encoding: 'utf8', timeout: 15000 });
    if (r.status === 0) { const d = num(r.stdout && r.stdout.trim(), 0); if (d > 0) return d; }
  } catch (_) {}
  return null;
}

async function analyzeTts({ ttsTimestampsPath, audioPath, narration, options = {} }) {
  if (ttsTimestampsPath) {
    const fs = require('fs');
    let json;
    try { json = JSON.parse(fs.readFileSync(ttsTimestampsPath, 'utf8')); }
    catch (e) { throw Object.assign(new Error('TTS JSON hỏng: ' + e.message), { code: 'VA_TTS_JSON' }); }
    const parsed = parseProviderJson(json);
    if (parsed) return { duration: parsed.duration, words: parsed.words, sentences: sentencesFromWords(parsed.words),
      provider: parsed.provider, confidence: parsed.confidence, source: 'provider-timestamps' };
  }
  // Fallback: phân bổ deterministic theo độ dài từ, rồi co giãn về duration audio thật (nếu có probe).
  const text = String(narration || (await fallbackNarration(audioPath)));
  const dur = options.duration || audioDurationViaProbe(audioPath) || Math.max(1, (text.split(/\s+/).length) * 0.42);
  const base = buildDeterministicAlignment(text, { secondsPerWord: 0.42 });
  if (dur && base.words.length) {
    const last = base.words[base.words.length - 1].end || 1;
    const k = dur / last;
    base.words.forEach(w => { w.start = +(w.start * k).toFixed(3); w.end = +(w.end * k).toFixed(3); });
    base.segments = base.segments.map(s => ({ ...s, start: +(s.start * k).toFixed(3), end: +(s.end * k).toFixed(3) }));
  }
  const sentences = sentencesFromWords(base.words);
  return { duration: dur, words: base.words, sentences, provider: 'deterministic', confidence: 0.5, source: 'deterministic' };
}

function fallbackNarration(audioPath) { return audioPath ? 'Đoạn giọng đọc không có kịch bản kèm theo.' : ''; }

module.exports = { analyzeTts, parseProviderJson, sentencesFromWords, audioDurationViaProbe };
