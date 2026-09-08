const { searchVideos, claude, safeJson, cached, median, kfmt } = require('./loi');

async function topVideoBreakdown(seed, onProgress = () => {}, opts = {}) {
  return cached('breakdown', seed, opts.fresh, onProgress, async () => {
    onProgress(5, `Quét ngách "${seed}"…`);
    const { vids, enriched } = await searchVideos(seed, 25, onProgress);
    if (!vids.length) throw new Error('Không tìm được video.');
    onProgress(30, `Tìm thấy ${vids.length} video, lọc outlier…`);
    const med = median(vids.map(x => x.views).filter(v => v > 0)) || 1;
    const outliers = vids.filter(x => x.views >= med * 1.5).sort((a, b) => b.views - a.views).slice(0, 6);
    if (!outliers.length) throw new Error('Không có video nào vượt trội đáng kể.');
    onProgress(50, `Phân tích ${outliers.length} video vượt trội…`);
    const outList = outliers.map((v, i) => `${i+1}. ${v.title} | ${kfmt(v.views)} view | ${v.days ? v.days+' ngày' : '?'} | kênh: ${v.channel}`).join('\n');
    const prompt = `Bạn là chuyên gia phân tích nội dung YouTube. Phân tích các video vượt trội sau trong ngách "${seed}":
${outList}
Hãy rút ra:
- Cấu trúc tiêu đề chung (công thức)
- Độ dài video phổ biến
- Góc mở đầu hay gặp
- Điểm chung về nội dung/ch�� đề
- 3 bài học cho người làm video faceless
Trả JSON: { common_title_pattern: "...", common_duration: "...", common_opening: "...", common_content: "...", lessons: ["..."] }`;
    const raw = await claude('Bạn là trợ lý hữu ích. Chỉ trả JSON hợp lệ.', prompt);
    const result = safeJson(raw, { common_title_pattern: '', common_duration: '', common_opening: '', common_content: '', lessons: [] });
    onProgress(100, 'Xong');
    return { ok: true, seed, outliers: outliers.map(v => ({ title: v.title, views: v.views, viewsFmt: kfmt(v.views), days: v.days, channel: v.channel, url: v.url })), result, enriched };
  });
}
module.exports = { topVideoBreakdown };