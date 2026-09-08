const { searchVideos, claude, safeJson, cached, median, sweepQueries, pool, kfmt } = require('./loi');

async function keywordClusters(seed, onProgress = () => {}, opts = {}) {
  return cached('keywords', seed, opts.fresh, onProgress, async () => {
    onProgress(5, 'Sinh các góc quét…');
    const queries = await sweepQueries(seed, onProgress);
    onProgress(10, `Quét ${queries.length} góc…`);
    const allVids = [];
    const failedQueries = [];
    let done = 0;
    const results = await pool(queries, 2, (q) => searchVideos(q, 15, () => {})
      .then(r => ({ ok: true, q, r }))
      .catch(err => ({ ok: false, q, error: String((err && err.message) || err).slice(0, 140) }))
      .then(res => {
        done++;
        onProgress(10 + done * 20, res.ok ? `Quét "${res.q.slice(0, 40)}"…` : `Lỗi: ${res.error.slice(0, 60)}`);
        return res;
      }));
    for (const res of results) {
      if (!res.ok) { failedQueries.push({ q: res.q, error: res.error }); continue; }
      res.r.vids.forEach(v => { if (!allVids.find(x => x.id === v.id)) allVids.push(v); });
    }
    if (!allVids.length) throw new Error('Không tìm được video.');
    onProgress(60, `Thu được ${allVids.length} video, phân cụm từ khoá…`);
    const titles = allVids.map(v => v.title).filter(Boolean).slice(0, 50);
    const prompt = `Bạn là chuyên gia SEO YouTube. Từ danh sách tiêu đề video sau trong ngách "${seed}", hãy:
- Nhóm các cụm từ khoá (cluster) thường xuất hiện (mỗi cluster từ 3-7 từ khoá)
- Đánh giá mức độ cạnh tranh cho mỗi cluster (Cao/Trung bình/Thấp) dựa trên số video/sub
- Đề xuất 1-2 từ khoá chính cho mỗi cluster để làm tag/title
Trả JSON mảng: [{ cluster_name: "...", keywords: ["..."], competition: "...", suggested_main: "..." }]
Tiêu đề: ${titles.join('\n')}`;
    const raw = await claude('Bạn là trợ lý hữu ích. Chỉ trả JSON hợp lệ.', prompt);
    const clusters = safeJson(raw, []);
    onProgress(100, 'Xong');
    return { ok: true, seed, clusters, totalVideos: allVids.length, failedQueries };
  });
}
module.exports = { keywordClusters };