/* TRANSCRIBE & CHAPTERS — _t8TranscribeBlob, wav 16k, groupWordsIntoLines, _t9SnapChapters, _t11* keys
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function _t8TranscribeBlob(prov, blob, filename){
  const cfg = T8_PROVIDERS[prov];
  const key = t8GetKey(prov) || document.getElementById('t8ApiKey').value.trim();
  if (!key) throw new Error(`Chưa có ${cfg.name} key. Nhập + Lưu key trước.`);
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const model = t8PickModel(prov, lang);
  const form = new FormData();
  form.append('file', blob, filename || 'audio.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  if (lang) form.append('language', lang);
  const r = await fetch(cfg.url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: form });
  if (!r.ok) { const txt = await r.text(); throw new Error(`${cfg.name} HTTP ${r.status}: ${txt.slice(0, 200)}`); }
  const data = await r.json();
  if (data.words && data.words.length) return data.words.map(w => ({ word: w.word, start: w.start, end: w.end }));
  if (data.segments && data.segments.length) {
    const words = [];
    for (const seg of data.segments) {
      const sw = (seg.text || '').trim().split(/\s+/).filter(Boolean);
      const per = (seg.end - seg.start) / (sw.length || 1);
      sw.forEach((w, i) => words.push({ word: w, start: seg.start + i * per, end: seg.start + (i + 1) * per }));
    }
    return words;
  }
  throw new Error('Không có word/segment timestamps trong response.');
}

async function _decodeToMono16k(file){
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let decoded;
  try { decoded = await ac.decodeAudioData(buf.slice(0)); } finally { try { ac.close(); } catch (_) {} }
  const RATE = 16000;
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new Off(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);   // Float32Array @16kHz mono
}

function _pcmToWav(float32, rate){
  const len = float32.length;
  const ab = new ArrayBuffer(44 + len * 2);
  const v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, len * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) { let s = Math.max(-1, Math.min(1, float32[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

function groupWordsIntoLines(words, maxSec){
  const lines = [];
  let buf = [], start = null;
  for (const w of words) {
    if (start == null) start = w.start;
    buf.push(w.word);
    const dur = w.end - start;
    const endsSentence = /[.!?]$/.test(w.word.trim());
    // Cắt dòng khi: đủ thời gian, hoặc kết câu mà đã đủ ~2s
    if (dur >= maxSec || (endsSentence && dur >= maxSec * 0.5)) {
      lines.push({ start, end: w.end, text: buf.join(' ').replace(/\s+/g, ' ').trim() });
      buf = []; start = null;
    }
  }
  if (buf.length) {
    const last = words[words.length - 1];
    lines.push({ start, end: last.end, text: buf.join(' ').replace(/\s+/g, ' ').trim() });
  }
  return lines;
}

function _t9SnapChapters(chapters){
  const sc = state.scenes || [];
  if (!sc.length || !Array.isArray(chapters) || !chapters.length) return { list: chapters || [], moved: 0, total: 0 };
  const starts = []; let acc = 0;
  for (const x of sc) { starts.push(acc); acc += (parseFloat(x.duration) || 0); }
  const total = acc;
  const toSec = (t) => { const p = String(t || '').split(':').map(n => parseInt(n) || 0); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0); };
  const fmt = (x) => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
  let moved = 0;
  const out = [];
  for (const c of chapters){
    const want = toSec(c && c.time);
    if (want > total - 5) continue;                                   // vượt quá video → bỏ
    let best = starts[0], d = Infinity;
    for (const st of starts){ const dd = Math.abs(st - want); if (dd < d){ d = dd; best = st; } }
    if (Math.round(best) !== Math.round(want)) moved++;
    out.push({ time: fmt(best), label: String((c && c.label) || '').trim(), _s: best });
  }
  out.sort((a, b) => a._s - b._s);
  const uniq = []; for (const c of out) if (!uniq.some(u => Math.abs(u._s - c._s) < 1)) uniq.push(c);
  if (uniq.length) { uniq[0].time = '0:00'; uniq[0]._s = 0; }         // YouTube bắt buộc chương đầu = 0:00
  return { list: uniq.map(({ time, label }) => ({ time, label })), moved, total };
}

function _t11KeyState(){
  const st = document.getElementById('t11KeyState'); if (!st) return;
  const k = (localStorage.getItem('yt_api_key') || '').trim();
  st.innerHTML = k ? '<span style="color:var(--green)">✓ Đã có key — bổ sung được like/comment/sub.</span>'
                   : '<span style="color:var(--text-muted)">Chưa có key — vẫn chạy được, chỉ thiếu like/comment/sub.</span>';
}

function _t11oNum(n){ n = Number(n)||0; return n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }

