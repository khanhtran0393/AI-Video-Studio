'use strict';
/* ── Credit gate cho Video Agent — học từ VEO3 (`_check_credit`).
 * Nguyên tắc (Luật 10):
 *   - KHÔNG probe Flow ngầm: orchestrator chỉ chạy hàm này khi được cấp
 *     `options.flowCreditsProbe` (hàm async trả số credit còn lại). Không cấp → bỏ qua,
 *     không mạng lưới nào được gọi từ preflight.
 *   - credits == null → issue NON-blocking `VA_CREDITS_UNKNOWN` (không nuốt — ghi vào job.json).
 *   - credits <= 0 → blocking `VA_NO_CREDITS`.
 *   - credits < ước tính → blocking `VA_CREDITS_LOW` kèm detail { credits, estimate }.
 * Đơn giá đọc từ ../video-spec/cost.js (một nguồn — Luật 3). ── */

const { estimateJobCredits } = require('../video-spec/cost');

function issue(code, message, fixHint, blocking, extra) {
  return { code, message, fixHint: fixHint || '', blocking: blocking !== false, ...(extra || {}) };
}

async function collectCreditIssues({ spec, getCredits, minCredits = 0, costTable } = {}) {
  if (typeof getCredits !== 'function') return [];
  const estimate = estimateJobCredits(spec, costTable);
  const need = Math.max(Number(minCredits) || 0, estimate.credits);
  let credits = null;
  try { credits = await getCredits(); }
  catch (e) {
    return [issue('VA_CREDITS_UNKNOWN',
      `Không đọc được số credit Flow còn lại: ${String((e && e.message) || e)}`,
      'Mở tab Flow để làm mới token/tài khoản, hoặc chạy lại.', false)];
  }
  if (credits == null || !Number.isFinite(Number(credits))) {
    return [issue('VA_CREDITS_UNKNOWN',
      'Flow không trả về số credit còn lại (token chưa có hoặc tài khoản chưa đồng bộ).',
      'Bấm làm mới tài khoản Flow rồi chạy lại.', false, { estimate: estimate.credits })];
  }
  const left = Number(credits);
  if (left <= 0) {
    return [issue('VA_NO_CREDITS',
      `Tài khoản Flow đã hết credit (còn ${left}). Job cần ước tính ${need} credit.`,
      'Nạp credit / đổi sang tài khoản còn credit rồi chạy lại.', true, { credits: left, estimate: estimate.credits })];
  }
  if (left < need) {
    return [issue('VA_CREDITS_LOW',
      `Credit Flow không đủ: còn ${left}, job cần ước tính ${need} (chi tiết: ${JSON.stringify(estimate.detail.imageCount)} ảnh, ${estimate.detail.videoCount} video, ${estimate.detail.upscaleCount} nâng cấp).`,
      'Giảm số cảnh, tắt nâng cấp 1080p, hoặc nạp thêm credit rồi chạy lại.', true, { credits: left, estimate: estimate.credits })];
  }
  return [];
}

module.exports = { collectCreditIssues };
