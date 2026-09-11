'use strict';
/* ── Bảng đơn giá Flow credit cho Video Agent — học từ VEO3 (`COST_PER_*`).
 * MỘT NGUỒN CHÂN LÝ (Luật 3): mọi tầng muốn ước tính chi phí credit ĐỌC từ đây,
 * không hardcode con số riêng lẻ. Đơn giá là HẰNG SỐ THẬT theo giá Flow hiện hành
 * (t2v/r2v 8s trừ credit khi video DONE; ảnh ~1 credit/biên thể).
 * Override cho job cụ thể qua `options.costTable` (merge đè lên default) — không
 * ai được sửa object này tại chỗ khác. ── */

const FLOW_UNIT_CREDIT = {
  image: 1,            // 1 ảnh Flow (mỗi biến thể)
  video_8s: 5,         // 1 video Flow 8s (t2v/r2v standard)
  video_6s: 5,
  upscale_1080p: 2,    // nâng 1080p (upsample)
  upscale_2k: 4,
  upscale_4k: 8,
};

// Ước tính tổng credit cần cho 1 video-spec: đếm theo thứ tự ưu tiên
// (1) markers tường minh trong spec (sc.background.kind / elements kind 'video'),
// (2) fallback: mỗi scene coi như 1 ảnh nền (bảo thủ — không ước tính thấp hơn thực tế).
function estimateJobCredits(spec, overrides) {
  const table = { ...FLOW_UNIT_CREDIT, ...(overrides || {}) };
  const scenes = Array.isArray(spec && spec.scenes) ? spec.scenes : [];
  let credits = 0;
  let imageCount = 0, videoCount = 0, upscaleCount = 0;
  for (const sc of scenes) {
    if (!sc || typeof sc !== 'object') continue;
    const bgKind = sc.background && sc.background.kind;
    if (bgKind === 'video' || sc.background && sc.background.genKind === 'video') { credits += table.video_8s; videoCount++; }
    else { credits += table.image; imageCount++; }
    if (String(sc.resolution || '').includes('1080')) { credits += table.upscale_1080p; upscaleCount++; }
  }
  return { credits, detail: { imageCount, videoCount, upscaleCount, table } };
}

module.exports = { FLOW_UNIT_CREDIT, estimateJobCredits };
