'use strict';
// Directing Read (học hỏi từ seedance-2.0 "Director's Read").
// Heuristic deterministic, metadata bổ sung — KHÔNG sinh camera/light tự do, KHÔNG vi phạm §16.
// Nguyên tắc "carriers, not labels": dịch nhãn cảm xúc thành vật mang nhìn thấy được để nâng
// chất lượng lựa chọn deterministic của visual plan, không đưa nhãn nội bộ vào render.

const MOOD_CARRIERS = {
  mysterious: { cameraBias: 'push-in', lightBias: 'low-key', behavior: 'linger; slow reveal' },
  sad: { cameraBias: 'pull-out', lightBias: 'soft-window', behavior: 'still hands; averted gaze' },
  happy: { cameraBias: 'pan-right', lightBias: 'warm-sun', behavior: 'open posture; small smile' },
  tense: { cameraBias: 'handheld', lightBias: 'hard-edge', behavior: 'watchful stillness; quick glance' },
  calm: { cameraBias: 'static', lightBias: 'even-ambient', behavior: 'measured breath; slow settle' },
  neutral: { cameraBias: null, lightBias: null, behavior: null },
};

const UTILITY_RE = /đăng ký|subscribe|like|follow|theo dõi|bấm|nhấn|truy cập|download|tải về|mua|giá|sản phẩm|đơn hàng|link|website|kênh/i;
const NARRATIVE_RE = /(cô|anh|chị|nó|họ|người|nhân vật|em|chàng|nàng)\b.*(đi|chạy|nhìn|khóc|cười|quyết|muốn|sợ|yêu|ghét|chờ|tìm|trốn|chọn)/i;

// Phân loại lane: narrative vs non-narrative — không bịa drama cho utility shot (CTA/demo).
function classifyLane(scene) {
  const text = String(scene.text || scene.summary || '');
  if (UTILITY_RE.test(text) && !NARRATIVE_RE.test(text)) {
    return { lane: 'non-narrative', utilityIntent: 'cta_or_demo', refusal: 'no invented drama or character psychology' };
  }
  return { lane: 'narrative' };
}

function inferFunction(importance) {
  return importance === 'high' ? 'turn' : (importance === 'low' ? 'introduce' : 'deepen');
}

function directingRead(scene) {
  const base = classifyLane(scene);
  if (base.lane === 'non-narrative') return base;
  const mood = String(scene.mood || 'neutral');
  const carrier = MOOD_CARRIERS[mood] || MOOD_CARRIERS.neutral;
  return {
    lane: 'narrative',
    dramaticFunction: inferFunction(scene.importance),
    turn: null,
    carriers: carrier,
    nonTransferableDetail: null, // heuristic không bịa chi tiết — an toàn hơn đoán sai.
    stockRefused: 'no tearful close-up; no swelling score',
  };
}

module.exports = { directingRead, classifyLane, MOOD_CARRIERS };