'use strict';
// Chiến thuật Wolverine (biobootloader/wolverine): khi render (FFmpeg/Remotion) crash,
// stderr thường dài hàng ngàn dòng trong khi nguyên nhân nằm ở vài dòng lõi.
// Module này CẮT log về digest ngắn, deterministic (cùng input → cùng output) để:
//   - ghi vào error object của job (job.json) cho người dùng + retry đọc;
//   - gửi cho AI fixer (auto-fix/fixer.js) không đốt token vô ích.
// Không fallback ngầm (Luật 10): nếu KHÔNG lọc được dòng tín hiệu nào → giữ 5 dòng
// cuối và khai báo rõ `matched: false` — người đọc biết đây là "đuôi mù", không phải
// kết quả phân tích.

const ANSI_RE = /\x1B\[[0-9;]*[A-Za-z]/g;

// Dòng có tín hiệu lỗi — khớp bất kỳ pattern nào dưới đây coi là giữ lại.
const SIGNAL_PATTERNS = [
  /\[error\]/i, /\bfatal\b/i, /\berror\b/i, /\bexception\b/i, /\bfailed\b/i, /\bfailure\b/i,
  /\bcannot\b/i, /\bcan't\b/i, /\bcouldn't\b/i, /\bno such\b/i, /\bunknown\b/i, /\binvalid\b/i,
  /\bunrecognized\b/i, /\bunsupported\b/i, /\bnot found\b/i, /\bdoes not\b/i, /\bmissing\b/i,
  /\brefused\b/i, /\btimed?[\s-]?out\b/i, /\baborted\b/i, /\bterminated\b/i, /\bcrash(?:ed)?\b/i,
  /\bexit(?:ed)?(?:\s+with)?(?:\s+code)?\s*-?\d+/i,
  /\b(?:ENOENT|EACCES|EPERM|ENOSPC|EEXIST|ECONNREFUSED|EPIPE)\b/,
  /conversion failed/i, /output file .*does not contain/i, /invalid data/i, /\bsegfault\b/i,
  /\bout of memory\b/i, /\bassertion\b/i, /❌|✖|✗/,
];

// Dòng chắc chắn là noise dù trông giống lỗi (stack frame — message lỗi phía trên mới là nguyên nhân).
const NOISE_PATTERNS = [/^\s*at\s+.+\(/];

function cleanLines(text) {
  const out = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(ANSI_RE, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (NOISE_PATTERNS.some((re) => re.test(line))) continue;
    // Gộp dòng trùng liên tiếp (ffmpeg in progress lặp) — giữ 1 bản.
    if (out.length && out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out;
}

const isSignal = (line) => SIGNAL_PATTERNS.some((re) => re.test(line));

/**
 * parseRenderDigest({ code, error, original } | string, opts) →
 *   { code, summary, lines, matched, totalLines, keptLines, truncated, chars }
 * opts: { maxLines = 30, maxChars = 2000 }
 */
function parseRenderDigest(input, opts = {}) {
  const code = (input && typeof input === 'object' && input.code) || null;
  const src = typeof input === 'string' ? input
    : String((input && (input.original || input.error)) || '');
  const maxLines = Math.max(1, Number(opts.maxLines) || 30);
  const maxChars = Math.max(120, Number(opts.maxChars) || 2000);

  const lines = cleanLines(src);
  let kept = lines.filter(isSignal);
  const matched = kept.length > 0;
  if (!matched) kept = lines.slice(-5); // khai báo rõ qua matched:false — không phải kết quả phân tích
  kept = kept.slice(-maxLines); // giữ ĐUÔI: fatal hầu như luôn ở cuối log

  // Giới hạn tổng ký tự — cắt từ ĐẦU (dòng cũ ít đáng kể hơn dòng cuối).
  let truncated = matched && lines.length > kept.length;
  while (kept.length && kept.join('\n').length > maxChars) { kept.shift(); truncated = true; }

  const summary = (kept[0] || code || '').slice(0, 200);
  return { code, summary, lines: kept, matched, totalLines: lines.length, keptLines: kept.length, truncated, chars: kept.join('\n').length };
}

module.exports = { parseRenderDigest, SIGNAL_PATTERNS, NOISE_PATTERNS, cleanLines, isSignal };