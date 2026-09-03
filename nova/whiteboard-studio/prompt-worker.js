'use strict';
/* ============================================================
   WHITEBOARD STUDIO — PROMPT WORKER (main process)
   ------------------------------------------------------------
   Port core.srt_prompt_worker của TPL Studio Stories:
   - generate_frame_prompts: tạo image prompt TỪNG KHUNG HÌNH
     của video, lấy SRT từ N giây CUỐI mỗi khung (tail_secs).
   - generate_topic_keywords: "Bắt buộc ĐÚNG 2 từ tiếng Việt có
     nghĩa" — gọi Gemini, validate + retry, trả keywords.
   LLM call đi qua llmBridge (nova/main/ipc/llm.js) để không
   lộ key trong renderer và không phụ thuộc module nào của app cũ.
   ============================================================ */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Core = require('../web/whiteboard-studio-core.js');
const { FFPROBE } = require('./ff-runtime');

// ── Kho cài đặt (giống editor-pro/ipc-ai.js): nova-settings.json ──
// NOVA_SETTINGS cho phép test chỏi route file khác; mặc định userData.
function _KHO() {
  try {
    const p = process.env.NOVA_SETTINGS
      || path.join(require('electron').app.getPath('userData'), 'nova-settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (_) { return {}; }
}
const _NHA_CC = {
  'openai-compatible': { kieu: 'oa', url: '', khoa: 'api_key', mac: '' },
  openai:     { kieu: 'oa', url: 'https://api.openai.com/v1/chat/completions',      khoa: 'api_key_openai',     mac: 'gpt-4o-mini' },
  openrouter: { kieu: 'oa', url: 'https://openrouter.ai/api/v1/chat/completions',   khoa: 'api_key_openrouter', mac: 'openai/gpt-4o-mini' },
  groq:       { kieu: 'oa', url: 'https://api.groq.com/openai/v1/chat/completions', khoa: 'api_key_groq',       mac: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  deepseek:   { kieu: 'oa', url: 'https://api.deepseek.com/chat/completions',       khoa: 'api_key_deepseek',   mac: 'deepseek-chat' },
  gemini:     { kieu: 'oa', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                khoa: 'api_key_gemini', mac: 'gemini-2.5-flash-lite' },
  anthropic:  { kieu: 'an', url: 'https://api.anthropic.com/v1/messages',           khoa: 'api_key_anthropic',  mac: 'claude-haiku-4.5' },
};
function _oaUrl(base) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  b = b.replace(/([^:])\/{2,}/g, '$1/');
  if (/\/chat\/completions$/i.test(b)) return b;
  if (/\/v1$/i.test(b)) return b + '/chat/completions';
  return b + '/v1/chat/completions';
}

/** Đo thời lượng media bằng ffprobe nội bộ. Trả giây hoặc null. */
function probeDuration(file) {
  return new Promise((resolve) => {
    try {
      const p = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', String(file)],
        { windowsHide: true });
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.on('error', () => resolve(null));
      p.on('close', (code) => { resolve(code === 0 ? parseFloat(out.trim()) : null); });
    } catch (_) { resolve(null); }
  });
}

/** Gọi LLM theo ĐÚNG API người dùng cấu hình trong Cài đặt → API
 *  (kho nova-settings.json — pattern editor-pro/ipc-ai.js). Tham số
 *  llmBridge giữ tương thích chuỗi gọi cũ nhưng không dùng nữa. */
async function callLlm(_llmBridge, prompt) {
  const kho = _KHO();
  const nc = _NHA_CC[String(kho.api_provider || '').trim().toLowerCase()];
  const key = nc
    ? (String(kho[nc.khoa] || kho.api_key || '').split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean)[0] || '')
    : '';
  if (!nc || !key) {
    throw new Error('Chưa cấu hình API key — mở Cài đặt → API, chọn nhà cung cấp (Gemini/OpenAI/Claude…) và dán key.');
  }
  const model = String(kho.api_model || '').trim() || nc.mac;
  const messages = [{ role: 'user', content: String(prompt || '') }];
  const goc = String(kho.api_base_url || '').trim();
  if (nc.kieu === 'an') {   // Anthropic messages API
    const url = goc ? goc.replace(/\/+$/, '') + '/v1/messages' : nc.url;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2048, messages }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
    const d = await r.json().catch(() => null);
    return ((d && d.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }
  const url = goc ? _oaUrl(goc) : nc.url;   // OpenAI-compatible (Gemini/OpenAI/DeepSeek/relay…)
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
  const d = await r.json().catch(() => null);
  const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!txt) throw new Error('Nhà cung cấp trả phản hồi rỗng.');
  return String(txt);
}

/** Tách JSON đầu tiên trong câu trả lời của LLM. */
function extractJson(text) {
  const s = String(text || '');
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

/**
 * generateTopicKeywords(topic, n, llmBridge) — port hành vi
 * "Gemini API trả n keyword tiếng Việt, mỗi keyword 2 từ có
 * nghĩa, có retry". Trả mảng keyword đã validate.
 */
async function generateTopicKeywords(topic, n, llmBridge) {
  const want = Math.max(1, Math.floor(n || 8));
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = await callLlm(llmBridge, Core.topicKeywordsPrompt(topic, want));
    const js = extractJson(text);
    const list = (js && Array.isArray(js.keywords)) ? js.keywords.map(String) : [];
    const good = list.filter(Core.isTwoVietnameseWords);
    if (good.length >= Math.min(want, 1)) return good.slice(0, want);
  }
  throw new Error('Gemini trả keyword không đúng định dạng "2 từ tiếng Việt" sau 3 lần thử.');
}

/**
 * generateFramePrompts({srtPath|srtRaw, audioPath|audioDuration,
 * frameSeconds, tailSecs, templatePrompt}) → danh sách request
 * prompt ảnh cho từng khung (text = SRT tail của khung đó).
 */
async function generateFramePrompts(input) {
  const inp = input || {};
  let entries = [];
  let srtRaw = inp.srtRaw;
  if (!srtRaw && inp.srtPath && fs.existsSync(inp.srtPath)) {
    srtRaw = fs.readFileSync(inp.srtPath, 'utf8');
  }
  if (srtRaw) entries = Core.parseSrt(srtRaw);
  let audioDuration = Number(inp.audioDuration) || 0;
  if (!audioDuration && inp.audioPath && fs.existsSync(inp.audioPath)) {
    audioDuration = (await probeDuration(inp.audioPath)) || 0;
  }
  const reqs = Core.buildFramePromptRequests({
    srtEntries: entries,
    audioDuration,
    frameSeconds: inp.frameSeconds,
    tailSecs: inp.tailSecs,
  });
  for (const r of reqs) r.prompt = Core.fillPromptTemplate(inp.templatePrompt, r.text);
  return { ok: true, entries, audioDuration, requests: reqs };
}

module.exports = { probeDuration, generateFramePrompts, generateTopicKeywords, extractJson };
