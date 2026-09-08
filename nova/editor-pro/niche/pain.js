const { searchVideos, claude, safeJson, cached, kfmt, pool } = require('./loi');
const { fetchComments } = require('./binh-luan');

async function painMining(seed, onProgress = () => {}, opts = {}) {
  return cached('pain', seed, opts.fresh, onProgress, async () => {
    onProgress(5, `Tìm video cho "${seed}"…`);
    const { vids, enriched } = await searchVideos(seed, 10, onProgress);
    if (!vids.length) throw new Error('Không tìm được video cho từ khoá này.');
    onProgress(20, `Tìm thấy ${vids.length} video, lấy bình luận từ 5 video nhiều view nhất…`);
    const top = vids.sort((a,b) => b.views - a.views).slice(0, 5);
    let allComments = [];
    let failed = [];
    const results = await pool(top, 2, async (v) => {
      try {
        const comments = await fetchComments(v.id);
        return { ok: true, id: v.id, comments, video: v };
      } catch (e) {
        return { ok: false, id: v.id, error: e.message };
      }
    });
    for (const r of results) {
      if (r.ok) {
        allComments = allComments.concat(r.comments.map(t => ({ video: r.video, text: t })));
      } else {
        failed.push(r.id);
      }
    }
    if (!allComments.length) throw new Error('Không lấy được bình luận nào.');
    onProgress(60, `Thu được ${allComments.length} bình luận, phân tích AI…`);
    const commentTexts = allComments.map(c => c.text).filter(t => t.length > 10).slice(0, 200);
    const prompt = `Bạn là chuyên gia phân tích khán giả YouTube. Phân tích các bình luận sau từ ngách "${seed}". Rút ra:
- 3 nhu cầu/pain point hàng đầu của khán giả (họ đang tìm gì, thiếu gì, bức xúc gì)
- 3 khoảng trống nội dung (họ phàn nàn về điều gì chưa có hoặc chưa đủ)
- 3 ý tưởng video mới có thể đáp ứng nhu cầu đó, kèm tiêu đề và mô tả ngắn (mỗi ý tưởng nhắm một đối tượng cụ thể)
Trả JSON: { needs: ["..."], gaps: ["..."], ideas: [{title: "...", description: "..."}] }
Bình luận: ${commentTexts.join('\n')}`;
    const raw = await claude('Bạn là trợ lý hữu ích. Chỉ trả JSON hợp lệ.', prompt);
    const result = safeJson(raw, { needs: [], gaps: [], ideas: [] });
    onProgress(100, 'Xong');
    return { ok: true, seed, commentCount: allComments.length, videosScanned: top.length, failed, result, enriched };
  });
}
module.exports = { painMining };