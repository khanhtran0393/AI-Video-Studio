'use strict';
/* ============================================================
   VIRAL CUT — ENGINE (main process, thuần Node — KHÔNG electron)
   ------------------------------------------------------------
   Port pipeline ViralCut 2.5: chọn highlight theo transcript
   (3 tầng: LLM → heuristic → năng lượng âm thanh), chọn best-hook
   (cold-open), snap về biên câu, và lập kế hoạch cắt ffmpeg.
   - Luật 8 (Deterministic): AI chỉ chọn CHỈ SỐ câu; mọi toạ độ
     thời gian do engine diễn giải/clamp theo dữ liệu thật.
   - Luật 10 (Không fallback ngầm): lỗi tầng LLM khi user chọn
     tường minh "LLM" → FAIL LỘ LIỄU (VC_LLM_*); chỉ chế độ Auto
     mới hạ cấp có KHAI BÁO (warning VC_TIER_FALLBACK).
   ============================================================ */
const { parseSrtCues } = require('../web/whiteboard-annotation.js');

/* ── Từ khoá hook (VI + EN) — điểm từ-khoá mở màn giữ chân người xem ── */
const HOOK_KEYWORDS = [
  'bạn có biết', 'bí mật', 'tại sao', 'cách', 'khoảnh khắc', 'không bao giờ',
  'đây là', 'sự thật', 'cảnh báo', 'ngạc nhiên', 'đắt giá', 'miễn phí',
  'tuyệt đối', 'lần đầu', 'kỷ lục', 'điều này', 'cẩn thận', 'lý do',
  'wait', 'secret', 'never', 'best', 'worst', 'incredible', 'shocking',
  'actually', 'nobody', 'everyone', 'stop doing', 'mistake', 'trick', 'hack',
  'you won\'t', 'believe', 'important', 'warning', 'amazing',
];

/* ── Siêu từ (so sánh tối đa / xếp hạng) ── */
const SUPER_RE = /nhất|hàng đầu|top\s*\d|#\d|số\s*1|siêu|vô địch|kỷ lục|best|worst|#1/gi;
const NUM_RE = /\d/g;

/* ── 0. WAV → PCM: trả { sampleRate, channels, bitsPerSample, dataOffset, dataLen } ──
   Duyệt chunk RIFF thật — không đoán mò offset; thiếu 'data'/'fmt' → lỗi lộ liễu. */
function pcmFromWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) throw new Error('VC_WAV: buffer rỗng/không phải WAV.');
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('VC_WAV: header RIFF/WAVE không đúng.');
  }
  let off = 12;
  const out = { sampleRate: 0, channels: 0, bitsPerSample: 0, dataOffset: -1, dataLen: 0 };
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      out.channels = buf.readUInt16LE(off + 10);
      out.sampleRate = buf.readUInt32LE(off + 12);
      out.bitsPerSample = buf.readUInt16LE(off + 22);
    } else if (id === 'data') {
      out.dataOffset = off + 8;
      out.dataLen = Math.min(size, buf.length - off - 8);
    }
    if (size === 0) break; // phòng stream size=0 → hết chunk đọc được
    off += 8 + size + (size % 2); // chunk phải chẵn 2 byte
  }
  if (out.dataOffset < 0) throw new Error('VC_WAV: không tìm thấy chunk data trong WAV.');
  if (!out.sampleRate || !out.channels) throw new Error('VC_WAV: thiếu chunk fmt trong WAV.');
  return out;
}

/* ── 1. Energy: RMS theo cửa sổ từ PCM s16le (đơn kê). Đầu ra deterministic. ── */
function energyWindowsFromPcm(buf, info, opts = {}) {
  const windowSec = Math.max(0.25, Number(opts.windowSec) || 1.0);
  const bytesPerFrame = (info.bitsPerSample / 8) * (info.channels || 1);
  const framesPerWin = Math.max(1, Math.round((info.sampleRate * windowSec) * (info.channels || 1)));
  const end = info.dataOffset + info.dataLen;
  const wins = [];
  for (let p = info.dataOffset; p + bytesPerFrame <= end; p += framesPerWin * bytesPerFrame) {
    const stop = Math.min(p + framesPerWin * bytesPerFrame, end);
    let sum = 0, n = 0;
    for (let q = p; q + 1 < stop; q += 2) { const s = buf.readInt16LE(q); sum += s * s; n++; }
    if (n > 0) wins.push({ t: wins.length * windowSec, rms: Math.sqrt(sum / n) });
  }
  return wins;
}

/* Trung bình trượt k phần tử (làm mượt energy). */
function smoothSeries(xs, k) {
  const kk = Math.max(1, Math.round(Number(k) || 1));
  const out = new Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - kk + 1); j <= i; j++) { s += xs[j]; n++; }
    out[i] = s / n;
  }
  return out;
}

function meanStd(xs) {
  if (!xs.length) return { mean: 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
  return { mean, std: Math.sqrt(v) };
}

/* ── 2. Transcript: cues → câu (ngắt tại . ! ? … hoặc hết block) ── */
function buildSentences(cues) {
  const list = Array.isArray(cues) ? cues : [];
  const sentences = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.text.trim()) {
      cur.words = cur.text.trim().split(/\s+/).length;
      sentences.push(cur);
    }
    cur = null;
  };
  for (const c of list) {
    if (!c || !c.text) continue;
    if (!cur) cur = { startMs: c.startMs, endMs: c.endMs, text: '' };
    cur.endMs = Math.max(cur.endMs, c.endMs);
    cur.text = (cur.text ? cur.text + ' ' : '') + String(c.text).trim();
    if (/[.!?…]["')\]]?\s*$/.test(String(c.text).trim())) flush();
  }
  flush();
  return sentences;
}

/* ── 3. Heuristic điểm cửa sổ câu (ViralCut-style, chạy local không AI) ── */
function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function scoreText(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const reasons = [];
  let hookHits = 0;
  for (const kw of HOOK_KEYWORDS) if (lower.includes(kw)) hookHits++;
  if (hookHits) reasons.push('từ khoá hook x' + hookHits);
  const q = /\?/.test(t) ? 1 : 0;
  if (q) reasons.push('câu hỏi');
  const nums = Math.min(3, (t.match(NUM_RE) || []).length);
  if (nums) reasons.push('con số');
  const sup = Math.min(2, (t.match(SUPER_RE) || []).length);
  if (sup) reasons.push('siêu từ');
  const words = tokenize(t).length;
  return { hookHits, q, nums, sup, words, reasons };
}

/* Trượt cửa sổ các câu LIÊN TIẾP [i..j] có thời lượng trong [minLen, maxLen]; chấm điểm. */
function heuristicCandidates(sentences, opts = {}) {
  const minMs = (Number(opts.minLen) || 15) * 1000;
  const maxMs = (Number(opts.maxLen) || 45) * 1000;
  const cands = [];
  let maxWordsPerSec = 0;
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i; j < sentences.length; j++) {
      const startMs = sentences[i].startMs;
      const endMs = sentences[j].endMs;
      const dur = endMs - startMs;
      if (dur > maxMs) break;
      if (dur < minMs) continue;
      const text = sentences.slice(i, j + 1).map((s) => s.text).join(' ');
      const sc = scoreText(text);
      const density = sc.words / Math.max(1, dur / 1000);
      if (density > maxWordsPerSec) maxWordsPerSec = density;
      cands.push({ i, j, startMs, endMs, durMs: dur, score: 0, parts: sc, text });
    }
  }
  for (const c of cands) {
    const densityNorm = c.parts.words / Math.max(1, c.durMs / 1000) / Math.max(0.1, maxWordsPerSec);
    c.score = 1.0 * densityNorm + 2.0 * c.parts.hookHits + 1.5 * c.parts.q + 1.0 * c.parts.nums + 1.5 * c.parts.sup;
  }
  return cands;
}

/* Chọn tối đa maxClips cửa sổ không chồng lấn, điểm cao trước. */
function pickTopNonOverlap(cands, maxClips) {
  const cap = Math.max(1, Number(maxClips) || 3);
  const sorted = cands.slice().sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  const picked = [];
  for (const c of sorted) {
    if (picked.length >= cap) break;
    const clash = picked.some((p) => !(c.endMs <= p.startMs || c.startMs >= p.endMs));
    if (!clash) picked.push(c);
  }
  return picked.sort((a, b) => a.startMs - b.startMs);
}

/* ── 4. Energy tier: chọn highlight theo năng lượng âm thanh (không cần transcript) ── */
function pickHighlightsByEnergy(wins, opts = {}) {
  const minLen = Number(opts.minLen) || 15;
  const maxLen = Number(opts.maxLen) || 45;
  const cap = Math.max(1, Number(opts.maxClips) || 3);
  const windowSec = (wins.length > 1 ? wins[1].t - wins[0].t : 1) || 1;
  const smoothed = smoothSeries(wins.map((w) => w.rms), 3);
  const { mean, std } = meanStd(smoothed);
  const cands = [];
  for (let a = 0; a < smoothed.length; a++) {
    for (let b = a; b < smoothed.length; b++) {
      const dur = (b - a + 1) * windowSec;
      if (dur > maxLen) break;
      if (dur < minLen) continue;
      let s = 0;
      for (let k = a; k <= b; k++) s += smoothed[k];
      const avg = s / (b - a + 1);
      const voiced = smoothed.slice(a, b + 1).filter((v) => v > mean + 0.5 * std).length / (b - a + 1);
      cands.push({ a, b, startMs: Math.round(a * windowSec * 1000), endMs: Math.round((b + 1) * windowSec * 1000), score: avg * (0.5 + voiced), avg, voiced });
    }
  }
  const top = pickTopNonOverlap(cands, cap);
  return top.map((c) => ({ ...c, reasons: ['năng lượng cao (voiced ' + Math.round(c.voiced * 100) + '%)'] }));
}

/* ── 5. Best-hook: cửa sổ ≤ maxWords từ, mật độ từ cao nhất, nằm trong highlight,
   KHÔNG ăn vào 20% cuối (tránh spoil cao trào → déjà vu khi vào cảnh chính). ── */
function bestHook(sentences, startMs, endMs, opts = {}) {
  const maxWords = Math.max(4, Number(opts.maxWords) || 12);
  const inRange = sentences.filter((s) => s.endMs > startMs && s.startMs < endMs);
  if (!inRange.length) return null;
  const spoilMs = startMs + (endMs - startMs) * 0.8;
  let best = null;
  for (let i = 0; i < inRange.length; i++) {
    let words = 0;
    for (let j = i; j < inRange.length; j++) {
      words += inRange[j].words;
      if (words > maxWords) break;
      const hs = inRange[i].startMs;
      const he = inRange[j].endMs;
      if (he > spoilMs) break;                       // không spoil
      const density = words / Math.max(1, (he - hs) / 1000);
      if (!best || density > best.density) best = { startMs: hs, endMs: he, text: inRange.slice(i, j + 1).map((s) => s.text).join(' '), density };
    }
  }
  return best;
}

/* ── 6. Parser JSON LỎNG LẼO (bài học ViralCut extract_json_list):
   LLM hay trả JSON vụn: fence ```json, đoạn văn bao quanh, object cuối cụt,
   dấu phẩy thừa. Quét bracket-balance chuỗi-escape-aware tách list khỏi loạn. ── */
function _stripFences(txt) {
  return String(txt || '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '\n')
    .replace(/,(\s*[\]}])/g, '$1');  // xoá phẩy thừa trước ] hoặc }
}

/* Quét chuỗi có cân bằng ngoặc (chuỗi escape-aware). Trả slice cân bằng từ `from`, hoặc null nếu cụt. */
function _balancedSlice(s, openCh, closeCh, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return s.slice(from, i + 1);
    }
  }
  return null; // cụt — không cân bằng
}

function parseJsonListLoose(txt) {
  const s = _stripFences(txt);
  // 1) JSON thuần
  try { const j = JSON.parse(s); if (Array.isArray(j)) return j; } catch (_) {}
  // 2) Tách mảng [...] cân bằng ngoài cùng
  const li = s.indexOf('[');
  if (li >= 0) {
    const arr = _balancedSlice(s, '[', ']', li);
    if (arr) { try { const j = JSON.parse(arr); if (Array.isArray(j)) return j; } catch (_) {} }
  }
  // 3) Mảng cụt → nhặt từng object {…} cân bằng (object cuối cụt bị bỏ tự nhiên)
  const out = [];
  let p = 0;
  for (;;) {
    const oi = s.indexOf('{', p);
    if (oi < 0) break;
    const obj = _balancedSlice(s, '{', '}', oi);
    if (!obj) break;                                  // từ đây cụt → dừng, giữ phần đã nhặt
    p = oi + obj.length;
    try { out.push(JSON.parse(obj)); } catch (_) {}   // object lỗi đơn lẻ → bỏ, không phá cả list
  }
  return out.length ? out : null;
}

/* ── 7. Prompt LLM: AI CHỈ TRẢ CHỈ SỐ CÂU (Luật 8) — engine quy đổi thời gian. ── */
function buildLlmPrompt(sentences, opts = {}) {
  const minLen = Number(opts.minLen) || 15;
  const maxLen = Number(opts.maxLen) || 45;
  const maxClips = Math.max(1, Number(opts.maxClips) || 3);
  const lines = sentences.map((s, i) => (i + '\t' + s.startMs + '\t' + s.endMs + '\t' + s.text)).join('\n');
  const system = 'Bạn là biên tập viên video viral. Chọn các đoạn hội thoại tiềm năng thành clip ngắn viral (kiểu trending TikTok/Shorts). Trả về DUY NHẤT một mảng JSON, KHÔNG thêm chữ nào khác.';
  const user = [
    'Danh sách câu của video (idx<TAB>startMs<TAB>endMs<TAB>nội dung):',
    lines,
    '',
    'Yêu cầu: chọn tối đa ' + maxClips + ' highlight. Mỗi highlight là dãy câu LIÊN TIẾP từ idx bắt đầu đến idx kết thúc, thời lượng ' + minLen + '–' + maxLen + ' giây (theo startMs/endMs đã cho). Ưu tiên: mở màn gây tò mò, câu hỏi, con số, tuyên ngôn mạnh, cao trào cảm xúc. Tránh spoil giữa chừng.',
    'Trả JSON dạng: [{"start":<idx>,"end":<idx>,"title":"tên clip ngắn gọn hấp dẫn","score":<0-10>,"reason":"lý do ngắn"}]',
  ].join('\n');
  return { system, user };
}

/* Quy đổi output LLM (chỉ số câu) → highlight thời gian thật, clamp/dedup/non-overlap. */
function mapLlmHighlights(list, sentences, opts = {}) {
  const arr = Array.isArray(list) ? list : [];
  const minMs = (Number(opts.minLen) || 15) * 1000;
  const maxMs = (Number(opts.maxLen) || 45) * 1000;
  const cap = Math.max(1, Number(opts.maxClips) || 3);
  const norm = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    let i = Math.round(Number(it.start));
    let j = Math.round(Number(it.end));
    if (!Number.isFinite(i) || !Number.isFinite(j)) continue;
    if (i > j) { const t = i; i = j; j = t; }
    i = Math.max(0, Math.min(i, sentences.length - 1));
    j = Math.max(0, Math.min(j, sentences.length - 1));
    const startMs = sentences[i].startMs;
    let endIdx = j;
    // Vượt maxLen → cắt lùi về câu cuối còn khít (engine diễn giải, không tin toạ độ AI mù quáng)
    while (endIdx > i && sentences[endIdx].endMs - startMs > maxMs) endIdx--;
    if (endIdx === i) continue;
    const endMs = sentences[endIdx].endMs;
    if (endMs - startMs < Math.min(minMs, 3000)) continue;
    norm.push({
      i, j: endIdx, startMs, endMs, durMs: endMs - startMs,
      score: Math.max(0, Math.min(10, Number(it.score) || 0)),
      title: String(it.title || '').slice(0, 120).trim(),
      reason: String(it.reason || '').slice(0, 200).trim(),
      text: sentences.slice(i, endIdx + 1).map((s) => s.text).join(' '),
    });
  }
  const sorted = norm.sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  const picked = [];
  for (const c of sorted) {
    if (picked.length >= cap) break;
    if (!picked.some((p) => !(c.endMs <= p.startMs || c.startMs >= p.endMs))) picked.push(c);
  }
  return picked.sort((a, b) => a.startMs - b.startMs);
}

/* ── 8. Tiêu đề local (heuristic/energy tier) — deterministic từ text ── */
function genTitleLocal(text, opts = {}) {
  const maxChars = Math.max(20, Number(opts.maxChars) || 60);
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const sc = scoreText(text);
  let out = '';
  for (const w of words) {
    if ((out + ' ' + w).trim().length > maxChars) break;
    out = (out ? out + ' ' : '') + w;
  }
  if (!sc.hookHits && out.length > maxChars * 0.8) out = out.slice(0, maxChars * 0.8).trim();
  return (out.trim() || 'Clip').replace(/[,.;:!?…]+$/, '');
}

/* Slug tên file: bỏ dấu tiếng Việt, ký tự lạ → '-' */
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'clip';
}

/* ── 9a. Hợp đồng tỉ lệ xuất: 'keep' | '916' | '169' → bộ lọc ffmpeg ────────
   `keep` = không đụng khung hình. `916` = cắt dải giữa theo chiều cao rồi
   đóng khung 1080x1920 (Shorts/Reels). `169` = cắt dải giữa theo chiều ngang
   rồi đóng khung 1920x1080 (ngang/truyền thống). Công thức crop giữ nguyên
   như bản cũ để hành vi đã kiểm chứng của 916 không đổi. */
const ASPECT_KEEP = 'keep';
const ASPECT_FILTERS = {
  '916': 'crop=min(iw,ih*9/16):ih,scale=1080:1920',
  '169': 'crop=iw:min(ih,iw*9/16),scale=1920:1080',
};

/* Chấp nhận cả cách gọi cũ (crop916:true) lẫn giá trị mới; sai → lộ liễu. */
function normalizeAspect(value, legacyCrop916) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (v === '' || v === ASPECT_KEEP || v === 'original' || v === 'none') {
    return legacyCrop916 ? '916' : ASPECT_KEEP;
  }
  const norm = v.replace(/[^0-9]/g, '');
  if (norm === '916' || v === '9:16') return '916';
  if (norm === '169' || v === '16:9') return '169';
  throw new Error('VC_ASPECT_UNSUPPORTED: tỉ lệ xuất không hợp lệ — "' + value
    + '" (chấp nhận: keep, 916, 169).');
}

function aspectFilterOf(aspect) {
  const key = normalizeAspect(aspect);
  return key === ASPECT_KEEP ? null : ASPECT_FILTERS[key];
}

/* ── 9b. Kế hoạch cắt ffmpeg: mỗi highlight 1 output; dựng khung theo tỉ lệ chọn ── */
function buildExportPlan(highlights, opts = {}) {
  const path = require('path');
  const outDir = String(opts.outDir || '');
  if (!outDir) throw new Error('VC_NO_OUTDIR: thiếu thư mục xuất.');
  const aspect = normalizeAspect(opts.aspect, opts.crop916);
  const vf = aspectFilterOf(aspect);
  const list = Array.isArray(highlights) ? highlights : [];
  return list.map((h, idx) => {
    const n = String(idx + 1).padStart(2, '0');
    const name = 'viralcut-' + n + '-' + slugify(h.title || 'clip') + '.mp4';
    return {
      index: idx + 1,
      outPath: path.join(outDir, name),
      startSec: Math.max(0, h.startMs / 1000),
      endSec: h.endMs / 1000,
      hookStartSec: h.hookStartMs != null ? h.hookStartMs / 1000 : null,
      hookEndSec: h.hookEndMs != null ? h.hookEndMs / 1000 : null,
      title: h.title || '',
      crop916: aspect === '916',
      aspect: aspect,
      vf: vf,
    };
  });
}

/* ── 10. Kế hoạch ghép: list file cho ffmpeg concat demuxer (thứ tự highlight đã sort theo thời gian) ── */
function buildConcatPlan(clipPaths, opts = {}) {
  const path = require('path');
  const list = (Array.isArray(clipPaths) ? clipPaths : []).filter((p) => String(p || '').trim());
  if (!list.length) throw new Error('VC_CONCAT_EMPTY: không có clip nào để ghép.');
  const outDir = String(opts.outDir || '');
  if (!outDir) throw new Error('VC_NO_OUTDIR: thiếu thư mục xuất.');
  const videoName = String(opts.videoName || '');
  const base = slugify(path.basename(videoName, path.extname(videoName))) || 'video';
  const outPath = path.join(outDir, 'viralcut-ghep-' + base + '-' + list.length + 'clip.mp4');
  /* Cú pháp concat demuxer: mỗi dòng file '<path>'; nháy đơn trong path phải escape '\'' */
  const listContent = list
    .map((p) => "file '" + String(p).replace(/'/g, "'\\''") + "'")
    .join('\n') + '\n';
  return { outPath, listContent, count: list.length };
}

/* ── 11. Tầng HEATMAP YouTube ("Most Replayed") — dữ liệu hành vi thật của khán giả ──
   heatmap = mảng ~100 mốc {start_time, end_time, value(0-1)} yt-dlp lấy qua -J.
   Bẫy (giống ipc-clips): mốc ĐẦU gần như luôn 1.0 vì ai cũng xem từ giây 0 —
   hiện tượng thống kê, không phải đoạn hay → bỏ vùng intro trước khi so.
   Thuần deterministic: cửa sổ [minLen..maxLen] ghép từ biên mốc, chấm điểm bằng
   trung bình value theo độ dài phủ, chọn top không chồng lấn (Luật 8). */
function pickHighlightsByHeatmap(heatmap, opts = {}) {
  const buckets = (Array.isArray(heatmap) ? heatmap : [])
    .map((b) => ({ s: Number(b && b.start_time) * 1000, e: Number(b && b.end_time) * 1000, v: Number(b && b.value) }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && Number.isFinite(b.v) && b.e > b.s)
    .sort((a, b) => a.s - b.s);
  if (buckets.length < 3) return [];
  const durationMs = Number(opts.durationMs) || buckets[buckets.length - 1].e;
  const minMs = (Number(opts.minLen) || 15) * 1000;
  const maxMs = (Number(opts.maxLen) || 45) * 1000;
  const cap = Math.max(1, Number(opts.maxClips) || 3);
  // Vùng intro: bỏ mốc kết thúc trước max(10s, 5% video), tối đa 30s
  const introMs = Math.min(30 * 1000, Math.max(10 * 1000, durationMs * 0.05));
  const avg = (from, to) => {
    let sum = 0, len = 0;
    for (const b of buckets) {
      const o = Math.max(b.s, from), c = Math.min(b.e, to);
      if (c > o) { sum += b.v * (c - o); len += c - o; }
    }
    return len > 0 ? sum / len : 0;
  };
  const cands = [];
  for (let i = 0; i < buckets.length; i++) {
    const start = buckets[i].s;
    if (buckets[i].e <= introMs) continue; // intro bias — khai báo rõ trong reason
    let j = i, wMin = null;
    let wMax = { s: start, e: start, v: 0 };
    while (j < buckets.length && buckets[j].e - start <= maxMs + buckets[j].e - buckets[j].s) {
      const dur = buckets[j].e - start;
      if (dur >= minMs && !wMin) wMin = { s: start, e: buckets[j].e };
      if (dur <= maxMs) wMax = { s: start, e: buckets[j].e };
      j++;
      if (buckets[j - 1].e >= durationMs) break;
    }
    for (const w of [wMin, wMax]) {
      if (!w || w.e - w.s < Math.min(minMs, 3000)) continue;
      cands.push({ startMs: Math.max(0, Math.round(w.s)), endMs: Math.min(Math.round(durationMs), Math.round(w.e)) });
    }
  }
  if (!cands.length) return [];
  // dedup theo (start,end) rồi chấm điểm deterministic
  const seen = new Set();
  const uniq = [];
  for (const c of cands) {
    const k = c.startMs + '|' + c.endMs;
    if (seen.has(k)) continue;
    seen.add(k);
    const v = avg(c.startMs, c.endMs);
    uniq.push({
      startMs: c.startMs, endMs: c.endMs,
      score: Math.round(v * 100) / 10, // 0-10 khớp thang LLM
      reason: 'khán giả tua lại ' + Math.round(v * 100) + '% (heatmap YouTube)',
      _v: v,
    });
  }
  /* Ngưỡng chất lượng: chỉ giữ cửa sổ ≥ 35% đỉnh (tối thiểu 0.15) — vùng nền
     0.1 không phải highlight; lọc trước khi chọn non-overlap (deterministic) */
  const maxV = uniq.reduce((m, c) => Math.max(m, c._v), 0);
  const floor = Math.max(0.15, maxV * 0.35);
  const cands2 = uniq.filter((c) => c._v >= floor);
  if (!cands2.length) return [];
  const top = pickTopNonOverlap(cands2, cap);
  return top.map((c) => ({ startMs: c.startMs, endMs: c.endMs, score: c.score, title: '', reason: c.reason }));
}

/* ── 11b. Tầng BÌNH LUẬN YouTube (Cách 2 — BỔ TRỢ cho heatmap) ──
   Khán giả tự đánh dấu "12:05 đoạn này đỉnh nhất" — gom mốc giờ trong text,
   trọng số theo like (1 + log2(1+like)), dồn vào bucket 5s, dựng cửa sổ
   [minLen..maxLen] CHÍNH XÁC như heatmap. Thuần deterministic (Luật 8).
   Là tầng bổ trợ: chỉ boost/xếp lại highlight heatmap, không thay thế. */
const COMMENT_TS_RE = /(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?!\d)/g;
function parseCommentTimestamps(text, durationSec) {
  const dur = Number(durationSec);
  const src = String(text || '');
  const out = [];
  let m;
  COMMENT_TS_RE.lastIndex = 0;
  while ((m = COMMENT_TS_RE.exec(src)) !== null) {
    const h = m[1] ? Number(m[1]) : 0;
    const min = Number(m[2]);
    const sec = Number(m[3]);
    if (!(min < 60 && sec < 60)) continue;      // "12:90" không phải mốc giờ
    const total = h * 3600 + min * 60 + sec;
    if (Number.isFinite(dur) && dur > 0 && total > dur) continue; // ngoài video
    out.push(total);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function pickHighlightsByComments(comments, opts = {}) {
  const list = (Array.isArray(comments) ? comments : [])
    .map((c) => ({ text: String((c && c.text) || ''), likeCount: Number(c && c.likeCount) || 0 }))
    .filter((c) => c.text);
  if (!list.length) return [];
  const durationMs = Number(opts.durationMs) || 0;
  if (!(durationMs > 0)) return [];
  const minMs = (Number(opts.minLen) || 15) * 1000;
  const maxMs = (Number(opts.maxLen) || 45) * 1000;
  const cap = Math.max(1, Number(opts.maxClips) || 3);
  const STEP = 5000; // bucket 5s
  const nBuckets = Math.ceil(durationMs / STEP);
  const w = new Array(nBuckets).fill(0);
  let tsTotal = 0;
  for (const c of list) {
    const weight = 1 + Math.log2(1 + c.likeCount); // like nhiều → tin hơn, chặn trần tự nhiên
    for (const sec of parseCommentTimestamps(c.text, durationMs / 1000)) {
      const bi = Math.min(nBuckets - 1, Math.floor((sec * 1000) / STEP));
      w[bi] += weight;
      tsTotal++;
    }
  }
  if (!tsTotal) return [];
  // làm mượt 1 lượt (trung bình có trọng số với 2 láng giềng) — deterministic
  const sm = w.map((v, i) => {
    const a = i > 0 ? w[i - 1] : v, b = i < nBuckets - 1 ? w[i + 1] : v;
    return (a + v * 2 + b) / 4;
  });
  const maxW = sm.reduce((m, v) => Math.max(m, v), 0);
  if (!(maxW > 0)) return [];
  const val = (i) => sm[i] / maxW; // chuẩn hoá 0-1
  const introMs = Math.min(30 * 1000, Math.max(10 * 1000, durationMs * 0.05));
  const cnt = (from, to) => { // số mốc giờ nằm trong cửa sổ (để khai báo trong reason)
    let n = 0;
    for (const c of list) for (const sec of parseCommentTimestamps(c.text, durationMs / 1000)) {
      const ms = sec * 1000;
      if (ms >= from && ms <= to) n++;
    }
    return n;
  };
  const cands = [];
  for (let i = 0; i < nBuckets; i++) {
    const start = i * STEP;
    if (start + STEP <= introMs) continue; // bỏ bẫy intro như heatmap
    let j = i, wMin = null;
    let wMax = { s: start, e: start };
    const fits = (k) => (k + 1) * STEP - start <= maxMs + STEP;
    while (j < nBuckets && fits(j)) {
      const e = Math.min((j + 1) * STEP, durationMs);
      const dur = e - start;
      if (dur >= minMs && !wMin) wMin = { s: start, e };
      if (dur <= maxMs) wMax = { s: start, e };
      j++;
    }
    for (const wnd of [wMin, wMax]) {
      if (!wnd || wnd.e - wnd.s < Math.min(minMs, 3000)) continue;
      let sum = 0, len = 0;
      for (let k = Math.floor(wnd.s / STEP); k < nBuckets; k++) {
        const o = Math.max(k * STEP, wnd.s), cl = Math.min((k + 1) * STEP, wnd.e);
        if (cl > o) { sum += val(k) * (cl - o); len += cl - o; }
        if ((k + 1) * STEP >= wnd.e) break;
      }
      const v = len > 0 ? sum / len : 0;
      cands.push({ startMs: Math.round(wnd.s), endMs: Math.min(Math.round(durationMs), Math.round(wnd.e)), v });
    }
  }
  const seen = new Set();
  const uniq = [];
  for (const c of cands) {
    const k = c.startMs + '|' + c.endMs;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push({
      startMs: c.startMs, endMs: c.endMs,
      score: Math.round(c.v * 100) / 10,
      reason: cnt(c.startMs, c.endMs) + ' bình luận đánh dấu thời điểm này (bình luận YouTube)',
      _v: c.v,
    });
  }
  const maxV = uniq.reduce((m, c) => Math.max(m, c._v), 0);
  const floor = Math.max(0.15, maxV * 0.35);
  return pickTopNonOverlap(uniq.filter((c) => c._v >= floor), cap)
    .map((c) => ({ startMs: c.startMs, endMs: c.endMs, score: c.score, title: '', reason: c.reason }));
}

/* Ghép tầng bình luận VÀO kết quả heatmap: cửa sổ bình luận trùng highlight
   → boost điểm (weight × score × tỉ lệ phủ), không thêm bớt cửa sổ (set cố
   định từ heatmap — non-overlap đã chốt). Thuần deterministic. */
function blendCommentBoost(highlights, commentWins, opts = {}) {
  const weight = Math.max(0, Math.min(0.5, Number(opts.weight != null ? opts.weight : 0.25)));
  const wins = (Array.isArray(commentWins) ? commentWins : [])
    .map((c) => ({ s: c.startMs, e: c.endMs, sc: Number(c.score) || 0 }))
    .filter((c) => c.e > c.s && c.sc > 0);
  if (!wins.length || weight === 0) return (Array.isArray(highlights) ? highlights : []).slice();
  return (Array.isArray(highlights) ? highlights : []).map((h) => {
    const dur = h.endMs - h.startMs;
    if (!(dur > 0)) return h;
    let bestOv = 0, bestSc = 0;
    for (const c of wins) {
      const ov = Math.max(0, Math.min(h.endMs, c.e) - Math.max(h.startMs, c.s));
      if (ov > bestOv) { bestOv = ov; bestSc = c.sc; }
    }
    if (!bestOv) return h;
    const frac = bestOv / dur;
    const boost = Math.round(weight * bestSc * frac * 10) / 10;
    if (boost <= 0) return h;
    return Object.assign({}, h, {
      score: Math.min(10, Math.round(((Number(h.score) || 0) + boost) * 10) / 10),
      reason: (h.reason || '') + (boost ? ' + +' + boost + ' từ bình luận' : ''),
      commentBoost: boost,
    });
  });
}


/* ── 12. Tiêu đề từ Chapters YouTube (AI YouTube tự chia) — không tốn tiền gọi AI ──
   Chapter phải phủ ≥50% độ dài highlight mới nhận; dọn số thứ tự/mốc giờ đầu title. */
function cleanChapterTitle(raw, maxChars = 80) {
  let s = String(raw || '').trim();
  s = s.replace(/^\s*\d{1,2}:\d{2}(:\d{2})?\s*[-–—.:|]*\s*/, ''); // "12:05 " đầu
  s = s.replace(/^\s*\d{1,2}[.)]\s+/, '');                        // "1. " đầu
  s = s.replace(/\s+/g, ' ');
  s = s.slice(0, maxChars).trim();
  return s.replace(/[,.;:!?…]+$/, '');
}
function applyChapterTitles(highlights, chapters) {
  const chs = (Array.isArray(chapters) ? chapters : [])
    .map((c) => ({ s: Number(c && c.start_time) * 1000, e: Number(c && c.end_time) * 1000, title: cleanChapterTitle(c && c.title) }))
    .filter((c) => Number.isFinite(c.s) && Number.isFinite(c.e) && c.e > c.s && c.title);
  const list = Array.isArray(highlights) ? highlights : [];
  for (const h of list) {
    const dur = h.endMs - h.startMs;
    if (!(dur > 0)) continue;
    let best = null;
    for (const c of chs) {
      const ov = Math.max(0, Math.min(h.endMs, c.e) - Math.max(h.startMs, c.s));
      if (ov >= dur * 0.5 && (!best || ov > best.ov)) best = { ov, title: c.title };
    }
    if (best) { h.title = best.title; h.chapter = true; }
  }
  return list;
}

/* ── 13. TIER A — tín hiệu multimodal CỤC BỘ cho video raw (deterministic, không AI/mạng) ──
   Bốn tín hiệu rẻ đo trực tiếp từ file, theo đúng tinh thần Luật 8/10:
   a) Keyframe (packet cờ K từ ffprobe, KHÔNG decode) = proxy cảnh cắt → neo biên.
   b) Im lặng tương đối theo RMS-window → "break" giữa câu nói, tránh cắt ngang lời.
   c) Cao độ f0 (autocorrelation chuẩn hoá trên PCM rút gọn 8kHz) → độ biến động giọng.
   d) Fusion energy + pitch-variance + voiced-ratio CÓ FLOOR, trọng số renormalize
      công khai khi một feature thiếu (trả về trong `weights`) — không fallback ngầm. */

/* 13a. Parse output ffprobe csv packet "pts_time,flags" (text hoặc array object)
   → danh sách KEYFRAME (cờ K) dạng ms, sort + dedupe. Dòng rác bỏ qua — probe
   thất bại cả loạt do ipc khai báo, hàm này chỉ diễn giải dữ liệu có thật. */
function parseKeyframePackets(raw, opts = {}) {
  const maxMs = Number(opts.durationMs) > 0 ? Number(opts.durationMs) : Infinity;
  const lines = Array.isArray(raw) ? raw : String(raw || '').split(/\r?\n/);
  const seen = new Set();
  for (const ln of lines) {
    let tSec = NaN, flags = '';
    if (typeof ln === 'string') {
      const parts = ln.split(',');
      if (parts.length < 2) continue;
      tSec = Number(parts[0]);
      flags = parts.slice(1).join(',');
    } else if (ln && typeof ln === 'object') {
      tSec = Number(ln.pts_time != null ? ln.pts_time : ln.time);
      flags = String(ln.flags || ln.flags_string || '');
    }
    if (!Number.isFinite(tSec) || tSec < 0) continue;
    if (!flags.includes('K')) continue; // chỉ keyframe — packet thường bỏ
    const ms = Math.round(tSec * 1000);
    if (ms <= maxMs) seen.add(ms);
  }
  return [...seen].sort((a, b) => a - b);
}

/* 13b. Phát hiện khoảng im lặng từ energy windows (ngưỡng RMS TƯƠNG ĐỐI theo
   đỉnh — không hardcode dB tuyệt đối vì biên độ extract khác nhau).
   → { threshold, gaps:[{startMs,endMs,midMs}], totalSec }. */
function detectSilence(wins, opts = {}) {
  const list = Array.isArray(wins) ? wins : [];
  if (list.length < 2) return { threshold: 0, gaps: [], totalSec: 0 };
  const wLen = (Number(list[1].t) - Number(list[0].t)) || 1;
  const maxRms = list.reduce((m, w) => Math.max(m, Number(w && w.rms) || 0), 0);
  if (!(maxRms > 0)) return { threshold: 0, gaps: [], totalSec: 0 };
  const rel = Number(opts.rel) > 0 ? Math.min(0.9, Number(opts.rel)) : 0.10;
  const threshold = maxRms * rel;
  const minWindows = Math.max(1, Math.round((Number(opts.minSec) > 0 ? Number(opts.minSec) : 1.5) / wLen));
  const gaps = [];
  let run = -1;
  for (let i = 0; i <= list.length; i++) {
    const quiet = i < list.length && (Number(list[i].rms) || 0) <= threshold;
    if (quiet && run < 0) run = i;
    if (!quiet && run >= 0) {
      if (i - run >= minWindows) {
        const s = Math.round(Number(list[run].t) * 1000);
        const e = Math.round((Number(list[i - 1].t) + wLen) * 1000);
        gaps.push({ startMs: s, endMs: e, midMs: Math.round((s + e) / 2) });
      }
      run = -1;
    }
  }
  const totalSec = gaps.reduce((a, g) => a + (g.endMs - g.startMs) / 1000, 0);
  return { threshold: Math.round(threshold * 100) / 100, gaps, totalSec: Math.round(totalSec * 10) / 10 };
}

/* 13c. Neo biên = keyframe cuts ƯU TIÊN hơn midpoint khoảng im lặng; gộp điểm
   sát nhau trong mergeTolMs (cut thắng gap). → [{ms, kind:'cut'|'gap'}] sorted. */
function buildBoundaryAnchors(cutsMs, silences, opts = {}) {
  const mergeTol = Math.max(0, Number(opts.mergeTolMs) || 250);
  const pts = [];
  for (const c of (Array.isArray(cutsMs) ? cutsMs : [])) if (Number.isFinite(c)) pts.push({ ms: Math.round(c), kind: 'cut' });
  for (const g of (Array.isArray(silences) ? silences : [])) if (g && Number.isFinite(g.midMs)) pts.push({ ms: Math.round(g.midMs), kind: 'gap' });
  pts.sort((a, b) => a.ms - b.ms || (a.kind === 'cut' ? 0 : 1) - (b.kind === 'cut' ? 0 : 1));
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && p.ms - last.ms <= mergeTol) {
      if (p.kind === 'cut' && last.kind !== 'cut') out[out.length - 1] = { ms: last.ms, kind: 'cut' };
      continue;
    }
    out.push(p);
  }
  return out;
}

/* 13d. Kéo (snap) 2 biên highlight về NEO gần nhất trong tolerance; nếu sau snap
   cửa sổ vi phạm [minLen·1000, maxLen·1000] hoặc vượt durationMs → REVERT edge
   lệch xa hơn, lặp; vẫn vi phạm → giữ nguyên bản gốc (không cắt bừa). Trả về
   MẢNG MỚI + adjustments cho diagnostics (không mutate input). */
function snapWindowEdges(highlights, anchors, opts = {}) {
  const tol = Math.max(0, Number(opts.toleranceMs) || 4000);
  const minMs = (Number(opts.minLen) || 15) * 1000;
  const maxMs = Math.max(minMs, (Number(opts.maxLen) || 45) * 1000);
  const durMs = Number(opts.durationMs) > 0 ? Math.round(Number(opts.durationMs)) : Infinity;
  const pts = (Array.isArray(anchors) ? anchors : [])
    .filter((a) => a && Number.isFinite(a.ms))
    .map((a) => ({ ms: Math.round(a.ms), kind: a.kind === 'gap' ? 'gap' : 'cut' }));
  const nearest = (t) => {
    let best = null;
    for (const a of pts) {
      const d = Math.abs(a.ms - t);
      if (d > 0 && d <= tol && (!best || d < best.d || (d === best.d && a.ms < best.ms))) best = { ms: a.ms, kind: a.kind, d };
    }
    return best;
  };
  const adjustments = [];
  const out = (Array.isArray(highlights) ? highlights : []).map((h) => {
    let sAdj = nearest(h.startMs), eAdj = nearest(h.endMs);
    let startMs = sAdj ? sAdj.ms : h.startMs;
    let endMs = eAdj ? eAdj.ms : h.endMs;
    if (startMs < 0) { startMs = h.startMs; sAdj = null; }
    if (Number.isFinite(durMs) && endMs > durMs) { endMs = h.endMs; eAdj = null; } // snap tràn cuối video → revert ngay
    const bad = () => (endMs - startMs) < minMs || (endMs - startMs) > maxMs;
    while (bad() && (sAdj || eAdj)) {
      const ds = sAdj ? sAdj.d : -1;
      const de = eAdj ? eAdj.d : -1;
      if (sAdj && ds >= de) { startMs = h.startMs; sAdj = null; }
      else if (eAdj) { endMs = h.endMs; eAdj = null; }
    }
    if (bad()) { startMs = h.startMs; endMs = h.endMs; sAdj = null; eAdj = null; }
    if (!sAdj && !eAdj) return Object.assign({}, h);
    const via = [];
    const lbl = (a) => (a.kind === 'gap' ? 'im lặng' : 'cảnh cắt');
    if (sAdj) via.push('đầu→' + lbl(sAdj));
    if (eAdj) via.push('cuối→' + lbl(eAdj));
    adjustments.push({ fromStartMs: h.startMs, fromEndMs: h.endMs, toStartMs: startMs, toEndMs: endMs, via: via.join(', ') });
    return Object.assign({}, h, {
      startMs, endMs, snappedEdges: via.length,
      reason: (h.reason ? h.reason + ' · ' : '') + 'neo ' + via.length + ' biên (Tier A: ' + via.join(', ') + ')',
    });
  });
  return { highlights: out, adjustments };
}

/* 13e. f0 bằng autocorrelation chuẩn hoá (NSDF) — thuần JS, deterministic:
   downmix mono → rút gọn nguyên số về ~8kHz → frame 96ms / hop 48ms, coarse-to-fine
   (mỗi 4 lag, rồi dò ±3 quanh đỉnh) + năng lượng đuôi tích luỹ ce[lag] để chỉ
   phải 1 vòng nhân/lag. Đọc PCM theo CHUNK frame (không cấp phát toàn bộ — video
   45 phút vẫn <2MB/chunk). maxSeconds chặn thời lượng phân tích → `truncated`
   ĐƯỢC KHAI BÁO trong kết quả (Luật 10), người dùng/ipc tự quyết định dùng hay bỏ.
   Trả về { frames:[{t, f0|null, clarity}], rate, analyzedSec, truncated }. */
function estimatePitchFrames(buf, info, opts = {}) {
  if (!Buffer.isBuffer(buf) || !info || !info.sampleRate) throw new Error('VC_PITCH: PCM không hợp lệ.');
  if ((Number(info.bitsPerSample) || 16) !== 16) throw new Error('VC_PITCH_P16: chỉ hỗ trợ PCM 16-bit.');
  const targetRate = Math.max(4000, Number(opts.targetRate) || 8000);
  const fMin = Math.max(40, Number(opts.fMin) || 65);
  const frame = Math.max(256, Number(opts.frame) || 768);
  const hop = Math.max(64, Number(opts.hop) || 384);
  const clarityMin = Number(opts.clarityMin) > 0 ? Number(opts.clarityMin) : 0.35;
  const gate = Number(opts.gate) > 0 ? Number(opts.gate) : 120; // RMS int16 — dưới ngưỡng coi là câm
  const maxSeconds = Number(opts.maxSeconds) > 0 ? Number(opts.maxSeconds) : 2700;
  const ch = Math.max(1, info.channels || 1);
  const step = Math.max(1, Math.round(info.sampleRate / targetRate));
  const rate = info.sampleRate / step;
  const fMax = Math.min(Number(opts.fMax) > 0 ? Number(opts.fMax) : 400, rate / 2.5);
  const nSamples = Math.floor(info.dataLen / (2 * ch));
  const xn = Math.floor(nSamples / step);
  if (xn < frame) return { frames: [], rate, analyzedSec: 0, truncated: false };
  const xLimit = Math.min(xn, Math.ceil(maxSeconds * rate));
  const minLag = Math.max(2, Math.floor(rate / fMax));
  const maxLag = Math.min(frame - 64, Math.ceil(rate / fMin));
  if (maxLag - minLag < 4) return { frames: [], rate, analyzedSec: 0, truncated: xLimit < xn };
  const i16 = ((buf.byteOffset + info.dataOffset) % 2 === 0)
    ? new Int16Array(buf.buffer, buf.byteOffset + info.dataOffset, Math.floor(info.dataLen / 2)) : null;
  const at = (si) => (i16 ? i16[si] : buf.readInt16LE(info.dataOffset + si * 2));
  /* Downmix mono + rút gọn nguyên số theo chunk — không bao giờ cấp phát toàn bộ PCM */
  const decimate = (arr, pos, count) => {
    for (let i = 0; i < count; i++) {
      let acc = 0;
      const s0 = (pos + i) * step;
      for (let k = 0; k < step; k++) {
        let c2 = 0;
        for (let c = 0; c < ch; c++) c2 += at((s0 + k) * ch + c);
        acc += c2 / ch;
      }
      arr[i] = acc / step;
    }
  };
  const totalFrames = Math.floor((xLimit - frame) / hop) + 1;
  const CHUNK = 512;                                    // frame/chunk (~33–65s âm thanh)
  const x = new Float32Array(CHUNK * hop + frame);
  const seg = new Float32Array(frame);
  const nCoarse = Math.floor((maxLag - minLag) / 3) + 2;
  const cLag = new Int16Array(nCoarse);                 // peak coarse đã thu (octave guard)
  const cVal = new Float32Array(nCoarse);
  const out = [];
  let chunkBase = -1, chunkLen = 0;
  for (let fi = 0; fi < totalFrames; fi++) {
    const pos = fi * hop;
    if (pos < chunkBase || pos + frame > chunkBase + chunkLen) {
      chunkBase = pos;
      chunkLen = Math.min(xLimit - chunkBase, CHUNK * hop + frame);
      decimate(x, chunkBase, chunkLen);
    }
    const q = pos - chunkBase;
    let mean = 0;
    for (let i = 0; i < frame; i++) mean += x[q + i];
    mean /= frame;
    let e0 = 0;
    for (let i = 0; i < frame; i++) { const v = x[q + i] - mean; seg[i] = v; e0 += v * v; }
    const t = Math.round((pos / rate) * 1000) / 1000;
    let f0 = null, clarity = 0;
    if (e0 > 0 && Math.sqrt(e0 / frame) >= gate) {
      const nsdf = (lag) => {
        let r = 0, e2 = 0;
        const end = frame - lag;
        for (let i = 0; i < end; i++) { const b = x[q + i + lag] - mean; r += seg[i] * b; e2 += b * b; }
        const den = e0 + e2;
        return den > 0 ? (2 * r) / den : 0;
      };
      /* Octave guard: NSDF của tín hiệu tuần hoàn có NHIỀU đỉnh CAO BẰNG NHAU ở lag
         bội 2 (200Hz ↔ lag 40 ↔ 100Hz ↔ lag 80) → global max LUÔN đáp nhầm octave
         dưới. Cách chuẩn: lấy LOCAL MAX ĐẦU TIÊN ≥ clarityMin khi quét từ lag nhỏ
         (= cao độ cao nhất hợp lệ), chỉ fallback global max khi không có local max. */
      let bestV = -1, bestG = -1, cnt = 0;
      for (let lag = minLag; lag <= maxLag; lag += 3) {           // coarse
        const v = nsdf(lag);
        cLag[cnt] = lag; cVal[cnt] = v; cnt++;
        if (v > bestV) { bestV = v; bestG = lag; }
      }
      let chosen = -1, chosenV = 0;
      for (let k = 1; k < cnt - 1; k++) {                         // first valid local peak
        if (cVal[k] >= clarityMin && cVal[k] >= cVal[k - 1] && cVal[k] > cVal[k + 1]) {
          const cand = rate / cLag[k];
          if (cand >= fMin && cand <= fMax) { chosen = cLag[k]; chosenV = cVal[k]; break; }
        }
      }
      if (chosen < 0 && bestV >= clarityMin) { chosen = bestG; chosenV = bestV; }
      if (chosen > 0) {
        const lo = Math.max(minLag, chosen - 3), hi = Math.min(maxLag, chosen + 3);
        for (let lag = lo; lag <= hi; lag++) {                    // fine ±3, tie → lag nhỏ hơn
          const v = nsdf(lag);
          if (v > chosenV + 1e-9 || (Math.abs(v - chosenV) <= 1e-9 && lag < chosen)) { chosenV = v; chosen = lag; }
        }
        const cand = rate / chosen;
        if (cand >= fMin && cand <= fMax) { f0 = Math.round(cand * 10) / 10; clarity = Math.round(chosenV * 100) / 100; }
      }
    }
    out.push({ t, f0, clarity });
  }
  return {
    frames: out, rate,
    analyzedSec: Math.round((((totalFrames - 1) * hop + frame) / rate) * 10) / 10,
    truncated: xLimit < xn,
  };
}

/* 13f. Gom frame f0 theo energy-window → [{t, voiced (0-1), med, var}].
   var = độ lệch chuẩn f0 trong window (biến động cao độ của giọng nói). */
function pitchWindowsFromFrames(frames, wins) {
  const list = Array.isArray(wins) ? wins : [];
  if (!list.length) return [];
  const wLen = (list.length > 1 ? Number(list[1].t) - Number(list[0].t) : 1) || 1;
  const buckets = list.map((w) => ({ t: Number(w.t), total: 0, voiced: 0, fs: [] }));
  for (const f of (Array.isArray(frames) ? frames : [])) {
    const i = Math.floor(Number(f && f.t) / wLen);
    if (i < 0 || i >= buckets.length) continue;
    buckets[i].total++;
    if (f.f0 != null) { buckets[i].voiced++; buckets[i].fs.push(Number(f.f0)); }
  }
  return buckets.map((b) => {
    const fs = b.fs.slice().sort((a, z) => a - z);
    let med = 0;
    if (fs.length) med = fs.length % 2 ? fs[(fs.length - 1) / 2] : (fs[fs.length / 2 - 1] + fs[fs.length / 2]) / 2;
    let vr = 0;
    if (fs.length >= 2) {
      const mu = fs.reduce((a, z) => a + z, 0) / fs.length;
      vr = Math.sqrt(fs.reduce((a, z) => a + (z - mu) * (z - mu), 0) / fs.length);
    }
    return {
      t: b.t,
      voiced: b.total > 0 ? Math.round((b.voiced / b.total) * 1000) / 1000 : 0,
      med: Math.round(med * 10) / 10,
      var: Math.round(vr * 10) / 10,
    };
  });
}

/* 13g. Fusion per-window: v = wE·energy + wP·pitchVar + wV·voiced ∈ [0,1].
   Feature thiếu → trọng số RENORMALIZE công khai (trả về trong `weights`, tổng = 1)
   và giá trị tương ứng trả `null` — người dùng thấy rõ: không có pitch thì điểm chỉ
   là energy + voiced; không có cả hai thì thuần energy. Không bịa 0 để loãng điểm. */
function fuseLocalScores(wins, opts = {}) {
  const list = Array.isArray(wins) ? wins : [];
  if (!list.length) return { feats: [], weights: null, hasPitch: false };
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const pw = Array.isArray(opts.pitchWins) ? opts.pitchWins : null;
  const maxRms = list.reduce((m, w) => Math.max(m, Number(w && w.rms) || 0), 0) || 1;
  const pVar = list.map((w, i) => (pw && pw[i] && Number.isFinite(pw[i].var) ? pw[i].var : null));
  const pVoice = list.map((w, i) => (pw && pw[i] && Number.isFinite(pw[i].voiced) ? pw[i].voiced : null));
  const hasPitch = pVar.some((v) => v != null && v > 0);   // var=0 mọi window → pitch không mang thông tin
  const hasVoiced = pVoice.some((v) => v != null);
  const nE = list.map((w) => (Number(w.rms) || 0) / maxRms);
  const maxVar = pVar.reduce((m, v) => (v != null && v > m ? v : m), 0);
  const nP = hasPitch ? pVar.map((v) => (v != null && maxVar > 0 ? v / maxVar : 0)) : null;
  const raw = { energy: 0.6, pitch: hasPitch ? 0.25 : 0, voiced: hasVoiced ? 0.15 : 0 };
  const sumRaw = raw.energy + raw.pitch + raw.voiced || 1;
  const weights = { energy: r4(raw.energy / sumRaw), pitch: r4(raw.pitch / sumRaw), voiced: r4(raw.voiced / sumRaw) };
  const feats = list.map((w, i) => ({
    t: Number(w.t),
    energy: Math.round(nE[i] * 1000) / 1000,
    pitch: nP ? Math.round(nP[i] * 1000) / 1000 : null,
    voiced: pVoice[i] != null ? Math.round(pVoice[i] * 1000) / 1000 : null,
    v: Math.round((nE[i] * weights.energy + (nP ? nP[i] * weights.pitch : 0) + ((pVoice[i] || 0)) * weights.voiced) * 1000) / 1000,
  }));
  return { feats, weights, hasPitch };
}

/* 13h. Chọn highlight theo điểm fusion (thay tầng năng lượng thuần khi Tier A bật):
   làm mượt 3, cửa sổ [minLen..maxLen], FLOOR = 35% đỉnh (tín hiệu cục bộ yếu
   không chiếm slot — như ngưỡng heatmap), non-overlap deterministic. Thang 0-10. */
function pickHighlightsByFusion(feats, opts = {}) {
  const list = Array.isArray(feats) ? feats : [];
  if (list.length < 2) return [];
  const minLen = Number(opts.minLen) || 15;
  const maxLen = Math.max(minLen + 1, Number(opts.maxLen) || 45);
  const cap = Math.max(1, Number(opts.maxClips) || 3);
  const windowSec = (Number(list[1].t) - Number(list[0].t)) || 1;
  const vs = smoothSeries(list.map((f) => Math.max(0, Math.min(1, Number(f && f.v) || 0))), 3);
  const cands = [];
  for (let a = 0; a < vs.length; a++) {
    let sE = 0, sP = 0, nP = 0, sV = 0;
    for (let b = a; b < vs.length; b++) {
      const dur = (b - a + 1) * windowSec;
      if (dur > maxLen) break;
      sE += Number(list[b].energy) || 0;
      if (list[b].pitch != null) { sP += list[b].pitch; nP++; }
      sV += Number(list[b].voiced) || 0;
      if (dur < minLen) continue;
      let s = 0;
      for (let k = a; k <= b; k++) s += vs[k];
      const n = b - a + 1;
      cands.push({
        a, b, startMs: Math.round(a * windowSec * 1000), endMs: Math.round((b + 1) * windowSec * 1000),
        score: s / n, avg: s / n, eAvg: sE / n, pAvg: nP ? sP / nP : null, vAvg: sV / n,
      });
    }
  }
  if (!cands.length) return [];
  const peak = cands.reduce((m, c) => Math.max(m, c.avg), 0);
  if (!(peak > 0)) return [];
  const kept = cands.filter((c) => c.avg >= peak * 0.35); // FUSION FLOOR
  if (!kept.length) return [];
  return pickTopNonOverlap(kept, cap).map((c) => ({
    startMs: c.startMs, endMs: c.endMs,
    score: Math.round(c.avg * 10 * 100) / 100,
    reasons: ['đa tín hiệu local (năng lượng ' + Math.round(c.eAvg * 100) + '%' +
      (c.pAvg != null ? ' · cao độ ' + Math.round(c.pAvg * 100) + '%' : ' · không có cao độ') +
      ' · giọng ' + Math.round(c.vAvg * 100) + '%)'],
  }));
}

module.exports = {
  HOOK_KEYWORDS,
  parseSrtCues,
  pcmFromWav,
  energyWindowsFromPcm,
  smoothSeries,
  meanStd,
  buildSentences,
  tokenize,
  scoreText,
  heuristicCandidates,
  pickTopNonOverlap,
  pickHighlightsByEnergy,
  bestHook,
  parseJsonListLoose,
  buildLlmPrompt,
  mapLlmHighlights,
  genTitleLocal,
  slugify,
  normalizeAspect,
  aspectFilterOf,
  buildExportPlan,
  buildConcatPlan,
  pickHighlightsByHeatmap,
  pickHighlightsByComments,
  parseCommentTimestamps,
  blendCommentBoost,
  applyChapterTitles,
  cleanChapterTitle,
  /* Tier A — multimodal local */
  parseKeyframePackets,
  detectSilence,
  buildBoundaryAnchors,
  snapWindowEdges,
  estimatePitchFrames,
  pitchWindowsFromFrames,
  fuseLocalScores,
  pickHighlightsByFusion,
};
