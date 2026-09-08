'use strict';
/* ============================================================
   SRT TRANSLATE — engine dịch phụ đề (main process)
   ------------------------------------------------------------
   Hành vi tham chiếu từ CapAssistant "AI Translate Subtitles":
     SRT → tách dòng thoại → AI (Gemini/GPT/API đã cấu hình)
     → ghép bản dịch lại đúng thứ tự → ghi file SRT (giữ timestamp).
   Ở đây AI chạy qua nova/editor-pro/niche "claude" (đấu đúng API
   người dùng đã cấu hình ở Cài đặt; CLI bridge nội bộ chỉ là chỗ
   lùi). KHÔNG thêm dependency mới; media/SRT dùng file THẬT trên đĩa.
   ============================================================ */
const { parseSrtCues } = require('../web/whiteboard-annotation.js');
const { claude } = require('../editor-pro/niche');

const LANGS = {
  auto: 'Tự phát hiện (Auto)',
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文 (Trung)',
  ja: '日本語 (Nhật)',
  ko: '한국어 (Hàn)',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
};

// Các model AI cho dịch SRT — key là giá trị gửi từ UI, khớp nhà cung cấp trong
// niche/loi.js (_NHA_CC). Gemini (Google AI Studio) là mặc định vì nhanh & rẻ hơn.
const MODELS = {
  gemini: { provider: 'gemini', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (nhanh, rẻ)' },
  claude: { provider: 'anthropic', model: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
};

function msToSrt(ms) {
  const t = Math.max(0, Math.round(Number(ms) || 0));
  const h = String(Math.floor(t / 3600000)).padStart(2, '0');
  const m = String(Math.floor((t % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((t % 60000) / 1000)).padStart(2, '0');
  const ms3 = String(t % 1000).padStart(3, '0');
  return h + ':' + m + ':' + s + ',' + ms3;
}

function serializeSrt(cues) {
  const list = Array.isArray(cues) ? cues : [];
  return list
    .map((c, i) => (i + 1) + '\n' + msToSrt(c.startMs) + ' --> ' + msToSrt(c.endMs) + '\n' + (c.text || '') + '\n')
    .join('\n');
}

// Parse JSON từ phản hồi AI (chịu được ```json ... ``` và chữ thừa xung quanh).
function safeJson(txt) {
  if (txt == null) return null;
  try { return JSON.parse(String(txt)); } catch (_) {}
  let s = String(txt).replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('[');
  const b = s.indexOf('{');
  const start = (a >= 0 && (b < 0 || a < b)) ? a : b;
  if (start >= 0) {
    const end = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (end > start) { try { return JSON.parse(s.slice(start, end + 1)); } catch (_) {} }
  }
  return null;
}

const SYSTEM = [
  'Bạn là người dịch phụ đề chuyên nghiệp.',
  'Dịch mảng câu phụ đề sang ngôn ngữ đích, giữ nguyên ý nghĩa, cảm xúc và độ dài tương đương.',
  'QUY TẮC:',
  '1. TRẢ VỀ ĐÚNG MỘT mảng JSON; mỗi phần tử là {"i": số thứ tự (bắt đầu 0), "t": "bản dịch"}.',
  '2. Số phần tử PHẢI ĐÚNG bằng số câu nhận vào và ĐÚNG thứ tự.',
  '3. Không dịch số/tên riêng/nhãn hiệu; giữ nguyên ký tự đặc biệt và dấu câu hợp lý.',
  '4. CHỈ trả JSON, không giải thích, không markdown.',
].join('\n');

async function translateCues(cues, opts = {}) {
  const list = Array.isArray(cues) ? cues.filter((c) => c && String(c.text || '').trim()) : [];
  if (!list.length) {
    const e = new Error('File SRT không có dòng thoại nào để dịch.');
    e.code = 'SRTT_EMPTY';
    throw e;
  }
  const target = String(opts.targetLang || 'vi');
  const source = String(opts.sourceLang || 'auto');
  const batchSize = Math.max(1, Math.min(50, Number(opts.batchSize) || 15));
  const maxConcurrent = Math.max(1, Math.min(10, Number(opts.maxConcurrent) || 3));
  // Model AI mặc định là Google AI Studio (Gemini) — không cần Claude CLI.
  const preset = MODELS[String(opts.model || 'gemini').trim().toLowerCase()] || MODELS.gemini;
  const provider = preset.provider;
  const model = preset.model;
  const out = new Array(list.length);

  const chunks = [];
  for (let i = 0; i < list.length; i += batchSize) chunks.push({ start: i, items: list.slice(i, i + batchSize) });

  // Gửi nhiều lô SONG SONG (giới hạn maxConcurrent) thay cho vòng for tuần tự trước
  // đây — mỗi lô trước kia phải chờ API trả về mới gửi lô kế tiếp, gây chậm tuyến tính.
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= chunks.length) return;
      const { start, items } = chunks[i];
      const payload = items.map((c, k) => k + '\t' + c.text).join('\n');
      const prompt = [
        'Ngôn ngữ nguồn: ' + source,
        'Ngôn ngữ đích: ' + target,
        '',
        'Dịch các dòng phụ đề sau (mỗi dòng định dạng "số_tự<TAB>văn bản"):',
        payload,
      ].join('\n');

      const raw = await claude(SYSTEM, prompt, { provider, model });
      const parsed = safeJson(raw);
      if (!Array.isArray(parsed)) {
        const e = new Error('AI không trả về mảng JSON hợp lệ.');
        e.code = 'SRTT_INVALID_AI_RESPONSE';
        e.detail = String(raw || '').slice(0, 300);
        throw e;
      }
      for (const item of parsed) {
        const j = Number(item && item.i);
        if (!Number.isInteger(j) || j < 0 || j >= items.length) continue;
        out[start + j] = String(item && item.t != null ? item.t : '').trim();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrent, chunks.length) }, worker));

  const missing = [];
  list.forEach((_c, idx) => { if (!out[idx]) missing.push(idx + 1); });
  if (missing.length) {
    const e = new Error('AI trả thiếu bản dịch cho dòng: ' + missing.slice(0, 8).join(', '));
    e.code = 'SRTT_PARTIAL_RESPONSE';
    e.missing = missing;
    throw e;
  }

  return list.map((c, idx) => ({ startMs: c.startMs, endMs: c.endMs, text: out[idx] }));
}

module.exports = { LANGS, MODELS, msToSrt, serializeSrt, translateCues, parseSrtCues };