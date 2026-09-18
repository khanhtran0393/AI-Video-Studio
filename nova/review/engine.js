'use strict';
/* ============================================================
   REVIEW — ENGINE (thuần Node, deterministic — KHÔNG electron)
   ------------------------------------------------------------
   Bước 4 lộ trình ezmaxsub — "Tóm tắt/Review" (bỏ paywall, ai dùng
   cũng được): transcript (SRT hoặc OCR hardsub) → chia CHUNK → AI
   viết kịch bản review chia cảnh (mỗi chunk 1 lượt, nhớ tóm tắt
   chunk trước để liền mạch) → kế hoạch thuyết minh với TTS là
   MASTER CLOCK (Luật 6): độ dài mỗi cảnh = thời lượng lời bình
   của cảnh đó, KHÔNG ép lời vào độ dài cảnh gốc. Video gốc chỉ
   cung cấp HÌNH theo mốc AI chọn; hết hình → RV_SOURCE_SHORT lộ
   liễu, không loop/bịa ngầm (Luật 10).
   Hàm thuần — test tại nova/review/test.js.
   ============================================================ */
const DUB = require('../dubbing/engine');   // splitScriptText — tách câu giữ dấu, không sao chép logic

function errCode(code, msg) { const e = new Error(code + ': ' + msg); e.code = code; return e; }

const WORD_RE = /[\p{L}\p{N}']+/gu;
function wordsOf(text) {
  const m = String(text == null ? '' : text).match(WORD_RE);
  return m ? m.length : 0;
}

/* ── Chia transcript thành CHUNK theo thời lượng (mặc định 8 phút/đoạn).
   Ranh giới = cue đầu tiên có start >= mốc chunk. Text rỗng toàn bộ →
   RV_NO_SOURCE_TEXT (không bịa transcript — Luật 10). ── */
function chunksFromCues(cues, opts = {}) {
  const chunkDurMs = Math.max(60000, Math.round(Number(opts.chunkDurMs) || 480000));
  const maxChars = Math.max(2000, Math.round(Number(opts.maxChars) || 14000));
  const list = (Array.isArray(cues) ? cues : [])
    .map((c) => ({ startMs: Math.max(0, Math.round(Number(c && c.startMs) || 0)), text: String((c && c.text) || '').trim() }))
    .filter((c) => c.text);
  if (!list.length) throw errCode('RV_NO_SOURCE_TEXT', 'Transcript rỗng — không có nguồn nội dung để review.');
  const chunks = [];
  let startBound = 0, idx = 0;
  for (;;) {
    const endBound = startBound + chunkDurMs;
    const inChunk = list.filter((c) => c.startMs >= startBound && c.startMs < endBound);
    if (!inChunk.length) {
      // không có cue trong khung này — nếu còn cue phía sau thì mở chunk mới từ đó
      const next = list.find((c) => c.startMs >= startBound);
      if (!next) break;
      startBound = next.startMs;
      continue;
    }
    let text = '';
    for (const c of inChunk) {
      if (text && text.length + c.text.length > maxChars) break;
      text += (text ? ' ' : '') + c.text;
    }
    chunks.push({
      idx, startMs: inChunk[0].startMs,
      endMs: (inChunk[inChunk.length - 1].startMs) + 1,
      text, words: wordsOf(text),
    });
    idx++;
    const lastUsed = inChunk[inChunk.length - 1].startMs;
    if (lastUsed < endBound && !list.some((c) => c.startMs >= endBound)) break; // hết transcript
    startBound = endBound;
    if (chunks.length > 60) throw errCode('RV_TOO_LONG', 'Video chia được hơn 60 chunk — vượt giới hạn xử lý.');
  }
  if (!chunks.length) throw errCode('RV_NO_SOURCE_TEXT', 'Transcript không chia được chunk nào.');
  return chunks;
}

/* ── Prompt cho 1 chunk. AI trả JSON mảng cảnh:
      [{"start": <giây tính từ ĐẦU ĐOẠN>, "dur": <giây tối thiểu>, "text": "<lời bình>"}] ── */
function buildChunkPrompt(chunk, ctx = {}) {
  const lang = String(ctx.language || 'vi');
  const ratio = Math.max(0.05, Math.min(0.5, Number(ctx.ratioLen) || 0.2));
  const targetWords = Math.max(30, Math.round((chunk.words || 0) * ratio));
  const system = [
    'Bạn là biên kịch viết kịch bản REVIEW/TÓM TẮT phim cho kênh YouTube faceless.',
    'Viết bằng ' + (lang === 'vi' ? 'TIẾNG VIỆT' : lang) + ', văn nói mượt, dẫn dắt cảm xúc, không liệt kê máy móc.',
    'Chỉ DỰA vào nội dung đoạn transcript được cấp — KHÔNG bịa sự kiện không có trong transcript.',
    'Tách kịch bản thành các CẢNH theo trình tự thời gian của transcript. Mỗi cảnh là 1 JSON object:',
    '{"start": <số giây tính từ ĐẦU ĐOẠN transcript này — nơi cảnh bắt đầu>, "dur": <số giây tối thiểu cảnh nên chiếm>, "text": "<lời bình của cảnh>"}',
    'Quy tắc: mỗi cảnh 1–3 câu lời bình; start tăng dần, phủ khắp đoạn; dur 3–20 giây tuỳ nội dung.',
    'Chỉ xuất MỘT khối JSON mảng, KHÔNG giải thích, KHÔNG bọc ```.',
  ].join('\n');
  const user = [
    ctx.totalWords ? ('Tổng transcript ~' + ctx.totalWords + ' từ; đoạn này (đoạn ' + ((chunk.idx || 0) + 1) + '/' + (ctx.chunkTotal || '?') + ') ~' + chunk.words + ' từ.') : '',
    'Độ dài mục tiêu kịch bản cho ĐOẠN NÀY: ~' + targetWords + ' từ (≈' + Math.round(ratio * 100) + '% của đoạn).',
    ctx.keepOriginal ? 'Giữ NGUYÊN VĂN những câu thoại quan trọng/tượng trưng của transcript (dẫn trực tiếp).' : 'Diễn đạt lại bằng lời của bạn, không trích nguyên câu dài.',
    ctx.customPrompt ? 'Yêu cầu riêng của người dùng: ' + ctx.customPrompt : '',
    ctx.prevSummary ? 'Nội dung các đoạn TRƯỚC đã viết (để nối mạch, đừng lặp lại): ' + ctx.prevSummary : (ctx.chunkTotal && chunk.idx === 0 ? 'Đây là đoạn đầu — mở đầu bằng hook thu hút.' : ''),
    'TRANSCRIPT ĐOẠN NÀY (mốc thời gian = giây tính từ đầu video):',
    chunk.text,
  ].filter(Boolean).join('\n\n');
  return { system, user, targetWords };
}

/* ── Parse JSON cảnh "lỏng lẻo": bỏ ```fence, cắt từ dấu [ hoặc { đầu tiên;
   chấp nhận object bọc mảng ({scenes:[...]}); từng dòng JSON lẻ cũng ăn. ── */
function parseScenesJson(raw) {
  let s = String(raw == null ? '' : raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!s) throw errCode('RV_AI_BADJSON', 'AI trả về rỗng.');
  let arr = null;
  const a = s.indexOf('['), b = s.indexOf('{');
  const start = (a >= 0 && (b < 0 || a < b)) ? a : b;
  if (start >= 0) {
    const end = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (end > start) {
      try {
        const j = JSON.parse(s.slice(start, end + 1));
        if (Array.isArray(j)) arr = j;
        else if (j && Array.isArray(j.scenes)) arr = j.scenes;
        else if (j && Array.isArray(j.canh)) arr = j.canh;
      } catch (_) {}
    }
  }
  if (!arr) {
    // fallback khai báo: từng dòng là 1 JSON object
    const lines = s.split('\n').map((l) => l.trim()).filter((l) => /^\{.*\}$/.test(l));
    const ok = [];
    for (const l of lines) { try { const j = JSON.parse(l); if (j && (j.text || j.noi_dung)) ok.push(j); } catch (_) {} }
    if (ok.length) arr = ok;
  }
  if (!arr || !arr.length) throw errCode('RV_AI_BADJSON', 'AI không trả JSON danh sách cảnh nào đọc được.');
  const items = [];
  for (const it of arr) {
    const o = it || {};
    const startSec = secOf(o.start != null ? o.start : (o.startSec != null ? o.startSec : o.giay));
    const durSec = secOf(o.dur != null ? o.dur : (o.duration != null ? o.duration : o.thoi_luong));
    const text = String(o.text || o.noi_dung || o.content || '').trim();
    if (!text) continue;
    items.push({
      startSec: Number.isFinite(startSec) ? startSec : null,
      durSec: Number.isFinite(durSec) && durSec > 0 ? durSec : null,
      text,
    });
  }
  if (!items.length) throw errCode('RV_AI_BADJSON', 'JSON cảnh đọc được nhưng không có cảnh nào hợp lệ (thiếu text).');
  return items;
}

function secOf(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map((x) => Number(x));
  if (parts.length >= 2 && parts.every((x) => Number.isFinite(x))) {
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  return NaN;
}

/* ── Chuẩn hoá cảnh AI → toạ độ video gốc TUYỆT ĐỐI (ms), clamp vào khung
   chunk + thời lượng video, khử chồng lấn (khai báo số cảnh bị điều chỉnh). ── */
function scenesFromParsed(items, opts = {}) {
  const chunkStartMs = Math.max(0, Math.round(Number(opts.chunkStartMs) || 0));
  const chunkEndMs = Math.max(chunkStartMs, Math.round(Number(opts.chunkEndMs) || chunkStartMs + 480000));
  const videoDurMs = Math.max(0, Math.round(Number(opts.videoDurMs) || 0));
  const minSceneMs = 2000, maxSceneMs = 120000;
  const out = [];
  let clamped = 0, dropped = 0, prevEnd = 0;
  for (const it of (Array.isArray(items) ? items : [])) {
    let startMs = chunkStartMs + (Number.isFinite(it.startSec) ? Math.round(it.startSec * 1000) : 0);
    if (startMs < chunkStartMs || startMs >= chunkEndMs) { startMs = Math.min(Math.max(startMs, chunkStartMs), chunkEndMs - 1); clamped++; }
    let durMs = Math.round((Number.isFinite(it.durSec) ? it.durSec : 6) * 1000);
    if (durMs < minSceneMs || durMs > maxSceneMs) { durMs = Math.max(minSceneMs, Math.min(maxSceneMs, durMs)); clamped++; }
    let endMs = Math.min(startMs + durMs, chunkEndMs);
    if (startMs < prevEnd) { startMs = prevEnd; clamped++; endMs = Math.min(startMs + durMs, chunkEndMs); }
    if (videoDurMs > 0 && startMs >= videoDurMs) { dropped++; continue; }
    if (videoDurMs > 0 && endMs > videoDurMs) { endMs = videoDurMs; clamped++; }
    if (endMs - startMs < minSceneMs) { dropped++; continue; }
    out.push({ startMs, endMs, text: it.text });
    prevEnd = endMs;
  }
  return { scenes: out, clamped, dropped };
}

/* ── Kế hoạch thuyết minh: TTS là MASTER CLOCK (Luật 6).
   Mỗi cảnh: độ dài = max(minSceneMs, tổng thời lượng câu của cảnh + gap).
   sourceStart giữ mốc AI chọn trong video gốc; không đủ hình → ghi shortfall
   (caller FAIL lộ liễu RV_SOURCE_SHORT, không loop ngầm). ── */
function narrationPlan(scenes, sentenceDursMs, opts = {}) {
  const gapMs = Math.max(0, Math.round(Number(opts.gapMs) || 120));
  const minSceneMs = Math.max(1000, Math.round(Number(opts.minSceneMs) || 2500));
  const videoDurMs = Math.max(0, Math.round(Number(opts.videoDurMs) || 0));
  const durs = Array.isArray(sentenceDursMs) ? sentenceDursMs : [];
  const list = Array.isArray(scenes) ? scenes : [];
  if (!list.length) throw errCode('RV_NO_SCENES', 'Không có cảnh nào để dựng.');
  const plan = [];
  const shortfalls = [];
  let cursor = 0, si = 0;
  for (let i = 0; i < list.length; i++) {
    const sc = list[i] || {};
    const sentIdx = [];
    let narrMs = 0;
    const sents = String(sc.text || '').trim() ? DUB.splitScriptText(sc.text) : [];
    for (const t of sents) {
      const dur = Math.round(Number(durs[si]) || 0);
      if (!(dur > 0)) throw errCode('RV_PROBE', 'Thiếu thời lượng audio câu ' + (si + 1) + ' — không bịa số.');
      sentIdx.push(si);
      narrMs += dur + (sentIdx.length > 1 ? gapMs : 0);
      si++;
    }
    const sceneDur = sentIdx.length ? Math.max(minSceneMs, narrMs) : minSceneMs;
    const sourceStartMs = Math.max(0, Math.round(Number(sc.startMs) || 0));
    let sourceDurMs = sceneDur;
    if (videoDurMs > 0) {
      const haveMs = videoDurMs - sourceStartMs;
      if (haveMs < sceneDur) shortfalls.push({ sceneIdx: i, needMs: sceneDur, haveMs: Math.max(0, haveMs) });
      sourceDurMs = Math.min(sceneDur, Math.max(0, haveMs));
    }
    plan.push({
      sceneIdx: i, startMs: cursor, endMs: cursor + sceneDur,
      sourceStartMs, sourceDurMs, sentIdx, narrMs, sceneDur,
      text: String(sc.text || ''),
    });
    cursor += sceneDur;
  }
  return { plan, totalMs: cursor, sentenceCount: si, shortfalls };
}

/* ── Cue phụ đề câu trên timeline MỚI (theo kế hoạch narration). ── */
function sentenceCues(plan, sentences, sentenceDursMs, opts = {}) {
  const gapMs = Math.max(0, Math.round(Number(opts.gapMs) || 120));
  const durs = Array.isArray(sentenceDursMs) ? sentenceDursMs : [];
  const cues = [];
  for (const p of (Array.isArray(plan) ? plan : [])) {
    let t = p.startMs;
    for (const si of (p.sentIdx || [])) {
      const dur = Math.round(Number(durs[si]) || 0);
      cues.push({ startMs: t, endMs: t + dur, text: String(sentences[si] || '') });
      t += dur + gapMs;
    }
  }
  return cues;
}

/* ── Gộp câu liền kề thành cụm phụ đề ≤ maxWords từ (như slider "từ/cụm"). ── */
function clusterCues(cues, opts = {}) {
  const maxWords = Math.max(1, Math.min(30, Math.round(Number(opts.maxWords) || 8)));
  const out = [];
  let cur = null;
  for (const c of (Array.isArray(cues) ? cues : [])) {
    const text = String((c && c.text) || '').trim();
    if (!text) continue;
    if (!cur) { cur = { startMs: c.startMs, endMs: c.endMs, text }; continue; }
    if (wordsOf(cur.text + ' ' + text) <= maxWords) {
      cur.text += ' ' + text;
      cur.endMs = Math.max(cur.endMs, c.endMs);
    } else {
      out.push(cur);
      cur = { startMs: c.startMs, endMs: c.endMs, text };
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ── Ước tính cho cost-line UI (trước khi chạy thật). ── */
function estimateFromCues(cues, opts = {}) {
  const ratio = Math.max(0.05, Math.min(0.5, Number(opts.ratioLen) || 0.2));
  const list = Array.isArray(cues) ? cues : [];
  const words = list.reduce((n, c) => n + wordsOf(c && c.text), 0);
  const targetWords = Math.round(words * ratio);
  return { words, targetWords, estScenes: Math.max(1, Math.round(targetWords / 55)) };
}

/* ── Markdown kịch bản (ghi file .review-kich-ban.md). ── */
function msToClock(ms) {
  const s = Math.max(0, Math.round(Number(ms) || 0) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(ss).padStart(2, '0');
}
function buildScriptMd(scenes, meta = {}) {
  const lines = [
    '# Kịch bản Review — ' + String(meta.title || 'video'),
    '',
    '- Ngôn ngữ: ' + String(meta.language || 'vi'),
    '- Độ dài: ' + Math.round((Number(meta.ratioLen) || 0.2) * 100) + '% transcript',
    '- Cảnh: ' + (Array.isArray(scenes) ? scenes.length : 0),
    meta.customPrompt ? '- Yêu cầu riêng: ' + meta.customPrompt : '',
    '',
  ].filter(Boolean);
  for (const sc of (Array.isArray(scenes) ? scenes : [])) {
    lines.push('## [' + msToClock(sc.startMs) + ' → ' + msToClock(sc.endMs) + ']');
    lines.push(String(sc.text || '').trim());
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  chunksFromCues, wordsOf, buildChunkPrompt, parseScenesJson, scenesFromParsed,
  narrationPlan, sentenceCues, clusterCues, estimateFromCues, buildScriptMd, msToClock,
};