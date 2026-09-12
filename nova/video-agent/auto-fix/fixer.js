'use strict';
// Vai Fixer_Agent (mô hình đối kháng AutoGen — tách biệt với QA_Agent):
//   - QA (qa/qa.js): chỉ CHẨN ĐOÁN — tính số đo lỗi (vd "cảnh tràn 3.2s so với giọng
//     đọc TTS"), KHÔNG quyết định giải pháp cho loại lỗi không có rule cứng.
//   - Fixer (module này): đọc chẩn đoán + số đo, quyết định và ĐỀ XUẤT patch
//     dạng Aider find/replace (auto-fix/patch.js) qua AI gateway.
// Loop (auto-fix/loop.js) vẫn là trọng tài: candidate của Fixer phải qua validate
// (Video Spec schema) + QA chấm lại + keep-best (§22) — AI không bao giờ ghi thẳng spec.
// Luật 10: khi AI lỗi/không khả dụng → trả { ok:false, reason } KHAI BÁO RÕ để loop
// ghi history; không bao giờ trả patch bừa để "cho nó chạy".

const { PATCH_SCHEMA, applyPatches } = require('./patch');

const ROUND3 = (v) => Math.round(v * 1000) / 1000;

function errorsText(errors) {
  return (errors || []).map((e) => JSON.stringify({
    scene: e.scene || null, type: e.type, severity: e.severity,
    overrunSec: e.overrunSec != null ? e.overrunSec : undefined,
    which: e.which != null ? e.which : undefined, start: e.start, end: e.end,
  })).join('\n');
}

// Prompt kiểu Aider: format nghiêm ngặt + feedback "did you mean" cho patch hỏng lần trước.
function buildFixerPrompt({ spec, errors, scene, feedback, digest } = {}) {
  const worst = scene ? (spec.scenes || []).find((s) => s && s.id === scene) : null;
  const context = worst || spec;
  const compact = JSON.stringify(context, null, 1);
  const lines = [
    'Hãy sửa lỗi video spec bằng các PATCH JSON. Quy tắc:',
    '1. Mỗi patch: { "scene": "<id cảnh hoặc bỏ để áp cả spec>", "find": <fragment JSON định vị DUY NHẤT>, "replace": <map key→giá trị mới>, "reason": "<lý do ngắn>" }.',
    '2. `find` PHẢI copy giá trị nguyên vẹn từ JSON dưới đây và đủ key để khớp ĐÚNG 1 node.',
    '3. `replace` chỉ chứa key cần đổi; value null để xoá key; key không nhắc giữ nguyên.',
    '4. Giọng đọc (TTS) là master clock: KHÔNG đổi audio, KHÔNG kéo dài vượt thời lượng giọng đọc.',
    '5. Chỉ trả mảng JSON thuần (1–8 patch), không chữ nào khác.',
    '',
    'LỖI CHẨN ĐOÁN (từ QA):',
    errorsText(errors) || '(không có chi tiết)',
    '',
    'JSON HIỆN TẠI (phạm vi: ' + (scene || 'toàn spec') + '):',
    compact,
  ];
  if (digest && Array.isArray(digest.lines) && digest.lines.length) {
    lines.push('', 'LOG LỖI RENDER (đã cắt gọn):', digest.lines.join('\n'));
  }
  if (feedback && Array.isArray(feedback)) {
    const bad = feedback.filter((r) => r && r.ok === false);
    if (bad.length) {
      lines.push('', 'CÁC PATCH LẦN TRƯỚC BỊ TỪ CHỐI — sửa lại đúng chúng, KHÔNG gửi lại patch đã áp dụng thành công:');
      for (const b of bad) {
        lines.push('- patch #' + ((b.i != null ? b.i : '?') + 1) + ' → ' + (b.reason || 'VA_PATCH_UNAPPLIED')
          + (b.didYouMean ? '\n  Did you mean (JSON thật gần nhất)? ' + b.didYouMean.snippet : ''));
      }
    }
  }
  return lines.join('\n');
}

// Tạo fixer từ AI gateway. `gateway` là instance từ createDefaultGateway (ai-gateway).
function createAiFixer(gateway, options = {}) {
  if (!gateway || typeof gateway.execute !== 'function') throw new TypeError('AI gateway is required');
  return async function aiFixer(ctx = {}) {
    try {
      const result = await gateway.execute('autoFix.patch', {
        schema: PATCH_SCHEMA,
        system: 'You are Nova Fixer Agent. Return JSON patches only. Preserve facts, ids and TTS timing. Never invent asset ids.',
        prompt: buildFixerPrompt(ctx),
        fallback: () => { throw Object.assign(new Error('VA_AUTOFIX_NO_LOCAL_FALLBACK — sửa spec bằng patch cần AI provider, không có fallback local'), { code: 'VA_AUTOFIX_NO_LOCAL_FALLBACK' }); },
        signal: options.signal,
      });
      const applied = applyPatches(ctx.spec, result.data || []);
      return { ok: applied.ok, spec: applied.spec, results: applied.results,
        provider: result.provider || null, usedFallback: result.usedFallback === true };
    } catch (e) {
      // Degrade có chủ đích, khai báo rõ — loop ghi vào history để UI/retry hiểu.
      return { ok: false, reason: 'VA_AUTOFIX_AI_UNAVAILABLE', error: String((e && e.message) || e) };
    }
  };
}

module.exports = { createAiFixer, buildFixerPrompt, ROUND3 };