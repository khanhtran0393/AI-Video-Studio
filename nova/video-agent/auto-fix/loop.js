'use strict';
// §21 Auto-Fix Loop — sửa lỗi có kiểm soát: max attempts, mỗi attempt 1 version (§22),
// giữ lại bản tốt nhất, vượt giới hạn → NEEDS_REVIEW (không loop vô hạn §1.6).
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function applyFixes(spec, errors) {
  const next = JSON.parse(JSON.stringify(spec));
  for (const e of errors) {
    const sc = next.scenes.find(s => s.id === e.scene);
    const f = e.suggestedFix;
    if (!sc || !f) continue;
    if (f.type === 'clamp_element' && sc.elements[f.index]) {
      const el = sc.elements[f.index];
      el.x = clamp(el.x, 14, 86); el.y = clamp(el.y, 5, 70); el.scale = clamp(el.scale, 0.3, 2);
    } else if (f.type === 'nudge_element' && sc.elements[f.index]) {
      const el = sc.elements[f.index]; el.x = clamp(el.x < 50 ? el.x - 10 : el.x + 10, 14, 86);
    } else if (f.type === 'clamp_transition' && sc.id === f.scene) {
      const prev = next.scenes[next.scenes.indexOf(sc) - 1];
      const capSec = Math.min(prev ? prev.end - prev.start : 9, sc.end - sc.start) / 3;
      sc.transDur = clamp(sc.transDur, 0.01, Math.max(0.05, ROUND3(capSec)));
    } else if (f.type === 'clamp_caption' && sc.captions[f.index]) {
      const c = sc.captions[f.index]; const dur = sc.end - sc.start;
      c.start = clamp(c.start, 0, Math.max(0, dur - 0.4)); c.end = clamp(c.end, c.start + 0.4, dur);
    } else if (f.type === 'extend_caption' && sc.captions[f.index]) {
      const c = sc.captions[f.index]; c.end = clamp(c.start + 0.5, c.start + 0.4, sc.end - sc.start);
    } else if (f.type === 'move_caption' && sc.captions[f.index]) {
      sc.captions[f.index].y = f.y;
    }
  }
  return next;
}

const meanScore = (qa) => Object.values(qa.scores || {}).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(qa.scores || {}).length);

async function autoFix({ spec, validate, qa, maxAttempts = 5, onAttempt }) {
  let current = spec;
  let currentQA = await qa(current);
  const history = [{ version: 1, status: currentQA.status, scores: currentQA.scores, strategies: summarizeStrategies(currentQA.errors) }];
  let attempt = 0;
  while (currentQA.status === 'fail' && attempt < maxAttempts) {
    attempt++;
    const candidate = applyFixes(current, currentQA.errors);
    const v = validate(candidate);
    if (!v.ok) break; // spec hỏng → dừng, giữ bản hiện tại (rollback §1.6)
    const candQA = await qa(v.spec);
    const strategies = summarizeStrategies(candQA.errors);
    if (onAttempt) { try { await onAttempt({ attempt, status: candQA.status, scores: candQA.scores, strategies }); } catch (_) {} }
    history.push({ version: attempt + 1, status: candQA.status, scores: candQA.scores, strategies });
    if (meanScore(candQA) >= meanScore(currentQA)) { current = v.spec; currentQA = candQA; }
    else break; // bản mới tệ hơn → không nhận (§22: không overwrite bản tốt)
  }
  const status = currentQA.status === 'fail' ? 'needs_review' : currentQA.status;
  return { spec: current, qa: currentQA, attempts: attempt, status, history };
}

// §21.1 Retake protocol (học hỏi seedance-2.0 "retake-protocol"): phân loại chiến lược fix
// theo đúng tầng (keep/fix-in-post/edit/re-roll/rewrite) thay vì retry mù. Không đổi hành vi
// applyFixes — chỉ thêm metadata để UI/history hiểu vì sao bản này được giữ hay loại.
function classifyFixStrategy(error) {
  const type = String(error && error.type || '');
  if (/element_out_of_frame|character_overlap|caption_placement/.test(type)) return 'fix-in-post';
  if (/caption_timing|caption_too_short|tts_out_of_sync|trans_long/.test(type)) return 'edit';
  if (/black_frame|white_frame|flat_frame|frozen_frame/.test(type)) return 're-roll';
  return 'keep';
}

// Gộp chiến lược fix của một bộ lỗi thành đếm {strategy: count} để ghi vào history.
// Chỉ là metadata — không đổi quyết định giữ/loại bản (applyFixes + meanScore giữ nguyên).
function summarizeStrategies(errors) {
  const counts = {};
  for (const e of errors || []) {
    const s = classifyFixStrategy(e);
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

module.exports = { autoFix, applyFixes, meanScore, classifyFixStrategy, summarizeStrategies };
