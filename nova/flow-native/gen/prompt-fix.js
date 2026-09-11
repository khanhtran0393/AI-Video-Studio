'use strict';
/* ── Prompt auto-fix khi bị Flow chặn content-filter — học từ VEO3 (`_fix_prompt_with_llm`).
 * Luật 10: đây là cải thiện CÓ CHỦ ĐỊCH, không nuốt lỗi:
 *   - fixer TRẢ VỀ null/lỗi → caller nhận lại LỖI GỐC nguyên vẹn + metadata
 *     `promptAutoFix: { tried, fixed, reason }` để UI/người dùng quyết định tiếp.
 *   - KHÔNG BAO GIỜ gen lại im lặng với prompt khác nếu chưa hỏi được fixer.
 *
 * flow-native là engine, KHÔNG require ngược sang video-agent (giữ đồ thị require
 * tuyến tính — Luật 5). Caller CÓ cấu hình AI (video-agent orchestrator có
 * options.ai / prj.config.ai) inject fixer qua `params.autoFixPrompt`:
 *   - `true`                     → dùng default fixer (chỉ đọc settings project nếu caller tự bọc)
 *   - `async (prompt, err) => …` → fixer tùy chỉnh (khuyến nghị: bọc gateway() bên dưới)
 *   — thiếu/không hợp lệ         → bỏ qua auto-fix, trả lỗi gốc. ── */

const { isContentFilterErr } = require('./shared');

// Bọc ai-gateway thành fixer — dùng ở NƠI CÓ cấu hình AI (video-agent, IPC caller).
// `aiConfig` cùng shape `options.ai` của video-agent ({ providers: [...] } hoặc { provider }).
async function rewritePromptWithGateway(prompt, lastError, aiConfig, { timeoutMs = 45000 } = {}) {
  const { createDefaultGateway } = require('../../video-agent/ai-gateway');   // lazy — không nạp khi load engine
  const gateway = createDefaultGateway(aiConfig || {});
  const instruction =
    'Viết lại prompt sinh video/ảnh sau để vượt qua bộ lọc an toàn của nền tảng, GIỮ NGUYÊN ý đồ ' +
    'nghệ thuật, bối cảnh, hành động và phong cách. Chỉ mô tả người thường gốc Á, không nhắc tên ' +
    'người thật/thương hiệu/nhân vật có bản quyền, không từ nhạy cảm. Trả về CHỈ prompt mới, một dòng, ' +
    `cùng ngôn ngữ với prompt gốc.\n\nPROMPT GỐC:\n${prompt}\n\nLỖI BỊ CHẶN:\n${String(lastError || '').slice(0, 300)}`;
  const r = await gateway.execute('flow.promptFix', {
    prompt: instruction,
    fallback: () => null,                       // không provider thật → null → caller giữ lỗi gốc (Luật 10)
    signal: (() => { const c = new AbortController(); const t = setTimeout(() => c.abort(), timeoutMs); if (t.unref) t.unref(); return c.signal; })(),
  });
  const out = r && typeof r.data === 'string' ? r.data.trim() : '';
  // Chỉ nhận output thật (provider không phải local fallback), đủ dài và KHÁ prompt gốc.
  if (!out || out.length < 10 || out === String(prompt).trim() || r.usedFallback === true) return null;
  return out.replace(/^["'`]+|["'`]+$/g, '').slice(0, 2000);
}

// Nhận (params.prompt, params.autoFixPrompt, error) → { prompt, meta } — meta luôn có, kể cả khi bỏ qua.
// Ném lỗi chỉ khi fixer của caller tự ném → caller tự quyết (đừng nuốt ở đây).
async function maybeFixPrompt(prompt, autoFixOpt, error) {
  const meta = { tried: false, fixed: false, reason: null };
  if (!isContentFilterErr(error)) { meta.reason = 'not_content_filter'; return { prompt, meta }; }
  if (!autoFixOpt) { meta.reason = 'disabled'; return { prompt, meta }; }
  if (typeof autoFixOpt !== 'function') { meta.reason = 'no_fixer'; return { prompt, meta }; }
  meta.tried = true;
  let fixed = null;
  try { fixed = await autoFixOpt(prompt, error); }
  catch (e) { meta.reason = 'fixer_error: ' + String((e && e.message) || e).slice(0, 120); return { prompt, meta }; }
  if (!fixed || typeof fixed !== 'string' || fixed.trim().length < 10 || fixed.trim() === String(prompt).trim()) {
    meta.reason = 'fixer_returned_nothing_usable';
    return { prompt, meta };
  }
  meta.fixed = true;
  return { prompt: fixed.trim(), meta };
}

module.exports = { maybeFixPrompt, rewritePromptWithGateway };
