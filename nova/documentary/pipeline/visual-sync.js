'use strict';

/**
 * §16.5 — NARRATION→VISUAL WORD SYNC (đồng bộ hình theo TỪ đang được phát âm).
 * Beat-level matching (§11-13) đã chọn đúng asset cho từng beat; module này đi
 * xa hơn: soi alignment words trong cửa sổ beat, khi giọng đọc nhắc đúng
 * chủ thể/địa danh của asset đó → sinh event kèm timestamp để renderer "đánh
 * thức" chủ thể đúng giây (pop-in / nhấn mạnh), thay vì chờ beat tiếp theo.
 * So khớp không phụ thuộc dấu tiếng Việt: "núi"≈"nui", "Nhật Bản"≈"nhatban".
 *
 * ỔN ĐỊNH — ZERO-CONFIG (không ai phải chỉnh gì):
 *  - Alignment DỮ ĐỊNH (deterministic, ~0.42s/từ) có sai số TÍCH LŨY trên
 *    narration dài: pop-in sai giây trông như lỗi video. Vì vậy khi nhận OBJECT
 *    alignment (như orchestrator truyền) chỉ trusted khi provider ngoài +
 *    confidence đủ cao; không tin cậy → hasSync:false, pipeline tự hạ cấp về
 *    hành vi beat-level ổn định cũ (im lặng, không crash).
 *  - Muốn ép timing thủ công (test/công cụ nâng cao) → truyền thẳng MẢNG words:
 *    mảng thô được coi là tin cậy mặc định.
 *  - Mọi từ hỏng (NaN, end<start, confidence từ quá thấp) bị bỏ qua — không
 *    break pipeline. Events luôn được sort theo thời gian: events[0] là từ
 *    SỚM NHẤT, bất kể provider trả về theo thứ tự nào.
 */

/** Ngưỡng confidence của alignment object để word-sync được kích hoạt. */
const MIN_ALIGNMENT_TRUST = 0.6;
/** Confidence tối thiểu của TỪ đơn lẻ để nhận là match (bỏ từ mơ hồ). */
const MIN_WORD_CONFIDENCE = 0.3;

/** Chuẩn hoá 1 từ/cụm: bỏ dấu, lowercase, chỉ giữ a-z0-9. */
function normalizeWord(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Các "term" mô tả asset: title/name/tags + vision subjects/location (§9). */
function assetTerms(asset) {
  const raw = [
    asset && asset.title,
    asset && asset.name,
    asset && asset.tags,
    asset && asset.vision && asset.vision.subjects,
    asset && asset.vision && asset.vision.location,
  ].flat();
  const seen = new Set();
  const terms = [];
  for (const item of raw) {
    const key = normalizeWord(item);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    terms.push({ term: String(item), key });
  }
  return terms;
}

/**
 * Nhận MẢNG words (tin cậy mặc định — dữ liệu tường minh) hoặc OBJECT alignment
 * ({ provider, confidence, words }) như orchestrator truyền: khi đó phải qua
 * cổng tin cậy — deterministic hoặc confidence thấp → không dùng cho word-sync.
 */
function resolveAlignmentInput(input, minTrust) {
  if (Array.isArray(input)) return { words: input, trusted: true };
  if (input && typeof input === 'object' && Array.isArray(input.words)) {
    const provider = String(input.provider || '').toLowerCase();
    const confidence = Number(input.confidence) || 0;
    const trusted = provider !== 'deterministic' && confidence >= minTrust;
    return { words: input.words, trusted };
  }
  return { words: null, trusted: false };
}

/**
 * Tìm các từ (trong alignment) rơi vào cửa sổ [beat.startSec, beat.endSec]
 * mà khớp metadata của asset được match cho beat.
 * @param alignment mảng words HOẶC object alignment { provider, confidence, words }
 * @returns { beatId, hasSync, events, reason? }
 *   events: [{ word, start, end, offsetSec, term }] — sort theo start,
 *   events[0] là từ sớm nhất. offsetSec = giây-đối-với-đầu-beat (đã clamp
 *   vào [0, độ dài beat]) — renderer đặt layer `at: offsetSec`.
 *   Khi không tin cậy/ không khớp → hasSync:false kèm reason để debug —
 *   KHÔNG bao giờ giả vờ có sync.
 */
function buildWordSync(beat, alignment, asset, options = {}) {
  const beatId = beat && beat.beatId || null;
  const startSec = Number(beat && beat.startSec) || 0;
  const endSec = Math.max(startSec, Number(beat && beat.endSec) || startSec + 1);
  const minTrust = options.minTrust != null ? Number(options.minTrust) : MIN_ALIGNMENT_TRUST;
  const minWordConfidence = options.minWordConfidence != null ? Number(options.minWordConfidence) : MIN_WORD_CONFIDENCE;
  const { words, trusted } = resolveAlignmentInput(alignment, minTrust);
  if (!words) return { beatId, hasSync: false, events: [], reason: 'no-alignment' };
  if (!trusted) return { beatId, hasSync: false, events: [], reason: 'low-trust-alignment' };
  const terms = assetTerms(asset);
  if (!terms.length) return { beatId, hasSync: false, events: [], reason: 'asset-without-terms' };
  const maxEvents = Math.max(1, Number(options.maxEvents) || 3);
  const events = [];
  for (const entry of words) {
    if (!entry) continue;
    const start = Number(entry.start);
    const end = Number(entry.end);
    // Từ hỏng (NaN / âm / end<start) bỏ qua — không crash pipeline.
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) continue;
    if (end < startSec - 0.01 || start > endSec + 0.01) continue;
    const conf = Number(entry.confidence) || 0;
    if (conf > 0 && conf < minWordConfidence) continue;
    const key = normalizeWord(entry.word);
    if (key.length < 3) continue;
    const hit = terms.find(term =>
      term.key === key
      || (term.key.length >= 4 && key.length >= 4 && (term.key.includes(key) || key.includes(term.key))));
    if (hit) {
      events.push({
        word: String(entry.word || ''),
        start,
        end,
        offsetSec: Number(Math.max(0, Math.min(start - startSec, endSec - startSec)).toFixed(3)),
        term: hit.term,
      });
    }
  }
  events.sort((a, b) => a.start - b.start);
  return { beatId, hasSync: events.length > 0, events: events.slice(0, maxEvents) };
}

module.exports = { buildWordSync, normalizeWord, assetTerms, MIN_ALIGNMENT_TRUST, MIN_WORD_CONFIDENCE };
