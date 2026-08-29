// Test nhanh đường "API cấu hình trước, bridge lùi sau" của niche.js
const niche = require('./nova/editor-pro/niche.js');
(async () => {
  console.log('[0] kho =', JSON.stringify(niche._KHO()).slice(0, 200));
  const t0 = Date.now();
  try {
    const out = await niche.claude(
      'Bạn là trợ lý phân tích ngách YouTube. Trả lời ngắn gọn bằng tiếng Việt.',
      'Đánh giá nhanh ngách "công cụ AI cho doanh nghiệp nhỏ" (2 câu).'
    );
    console.log('[OK] ' + (Date.now() - t0) + 'ms:', String(out).slice(0, 300));
  } catch (e) {
    console.log('[FAIL]', e.message);
    process.exitCode = 1;
  }
})();
