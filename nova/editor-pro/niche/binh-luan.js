const { run, claude, safeJson, cookies, searchVideos, pool } = require('./loi');

// Chuẩn hoá lỗi yt-dlp thành lý do ngắn có ý nghĩa (Luật 10: lỗi lộ liễu, có ý nghĩa).
// run() ném Error với message = 2 dòng stderr cuối.
function liDoYtDlp(e) {
  const src = String((e && e.message) || e);
  if (/Sign in to confirm/i.test(src)) return 'YouTube chặn truy cập không đăng nhập (bot-wall)';
  if (/confirm your age|age.?gate/i.test(src)) return 'video bị khoá tuổi';
  if (/Private video/i.test(src)) return 'video riêng tư';
  if (/unavailable|removed/i.test(src)) return 'video đã bị xoá';
  if (/timeout/i.test(src)) return 'hết thời gian chờ';
  return src.slice(0, 140);
}

// Gom bình luận của 1 video (yt-dlp --write-comments, KHÔNG CẦN KEY).
// `--extractor-args youtube:max_comments=200,all` chặn trần thời gian: video triệu
// bình luận nếu tải TOÀN BỘ sẽ vượt timeout 60s.
async function fetchComments(videoId) {
  const args = ['https://youtu.be/' + videoId, '-j', '--write-comments', '--no-warnings',
    '--extractor-args', 'youtube:max_comments=200,all',
    '--compat-options', 'filename-sanitization'];
  const ck = await cookies();
  if (ck) args.push('--cookies', ck);
  const out = await run(args, 60000);
  let data;
  try { data = JSON.parse(out); }
  catch (e) { throw new Error('Không đọc được JSON bình luận: ' + e.message); }
  return (data.comments || []).map(c => String((c && c.text) || '').trim()).filter(Boolean);
}

// Gom bình luận từ NHIỀU VIDEO có phục hồi CÓ KHAI BÁO (không nuốt lỗi — Luật 10):
//   1) thử `soDau` video đầu; lỗi từng video gom lại, không giết cả lượt;
//   2) chưa đủ mà còn video dự bị → mở rộng sang phần còn lại (báo rõ trên progress);
//   3) toàn bộ lỗi vì bot-wall/khoá tuổi (thường theo đợt ngắn) → đợi 20s, thử lại ĐÚNG 1 lần;
//   4) vẫn không có bình luận nào → ném lộ liễu kèm lý do từng nhóm lỗi + hướng xử lý.
async function gomBinhLuan(vids, opts = {}) {
  const soDau = Math.max(1, opts.soDau || 5);
  const onProgress = opts.onProgress || (() => {});
  const videoById = new Map(vids.map(v => [v.id, v]));
  const dau = vids.slice(0, soDau);
  const duBi = vids.slice(soDau);
  const got = []; const fail = new Map();   // id -> lý do lỗi
  const layMot = async (v) => {
    try { return { ok: true, id: v.id, comments: await fetchComments(v.id), video: v }; }
    catch (e) { return { ok: false, id: v.id, error: liDoYtDlp(e) }; }
  };
  const thu = async (ds, label) => {
    let done = 0;
    const rs = await pool(ds, 2, async (v) => {
      const r = await layMot(v);
      done++;
      onProgress(30 + Math.round(done * 20 / Math.max(1, ds.length)), `${label} ${done}/${ds.length}…`);
      return r;
    });
    for (const r of rs) { if (r.ok) got.push(r); else fail.set(r.id, r.error); }
  };
  await thu(dau, 'Lấy bình luận');
  if (got.length < 2 && duBi.length && fail.size) {
    onProgress(52, `${fail.size} video lỗi (${[...fail.values()][0]}) — thử ${duBi.length} video khác…`);
    await thu(duBi, 'Thử video khác');
  }
  if (!got.length && [...fail.values()].some(t => /bot-wall|khoá tuổi/.test(t))) {
    onProgress(55, 'YouTube đang chặn truy cập không đăng nhập — đợi 20s rồi thử lại một lần…');
    await new Promise(r => setTimeout(r, 20000));
    const retryIds = [...fail.keys()]; fail.clear();
    await thu(retryIds.map(id => videoById.get(id)).filter(Boolean), 'Thử lại');
  }
  const allComments = got.flatMap(r => r.comments.map(t => ({ video: r.video, text: t })));
  if (!allComments.length) {
    const duyNhat = [...new Set([...fail.values()])];
    throw new Error('Không lấy được bình luận nào (' + [...fail.keys()].length + ' video lỗi — ' + duyNhat.join('; ') + '). '
      + (duyNhat.some(t => /bot-wall/.test(t))
        ? 'Trong app, đăng nhập YouTube ở mục Flow sẽ bỏ qua chặn này; chạy ngoài app (keyless) thì chặn thường tạm thời — thử lại sau vài phút.'
        : ''));
  }
  return {
    allComments,
    soVideoDaThu: got.length + fail.size,
    failed: [...fail.keys()],
    failedDetail: [...fail.entries()].map(([id, error]) => ({ id, error })),
  };
}

async function commentMining(seed, onProgress = () => {}, opts = {}) {
  onProgress(5, `Tìm video cho "${seed}"…`);
  const { vids, enriched, enrichErr } = await searchVideos(seed, 8, onProgress);
  if (!vids.length) throw new Error('Không tìm được video cho từ khoá này.');
  onProgress(20, `Tìm thấy ${vids.length} video, lấy bình luận…`);
  const { allComments, soVideoDaThu, failed, failedDetail } = await gomBinhLuan(vids, { soDau: 5, onProgress });
  onProgress(60, `Thu được ${allComments.length} bình luận, phân tích AI…`);
  const commentTexts = allComments.map(c => c.text).filter(t => t.length > 10).slice(0, 200);
  const prompt = `Bạn là chuyên gia phân tích khán giả YouTube. Phân tích các bình luận sau từ ngách "${seed}". Rút ra:
- 3 nhu cầu/pain point hàng đầu của khán giả (họ đang tìm gì, thiếu gì)
- 3 khoảng trống nội dung (họ phàn nàn về điều gì chưa có)
- 3 ý tưởng video mới có thể đáp ứng nhu cầu đó, kèm tiêu đề và mô tả ngắn.
Trả JSON: { needs: ["..."], gaps: ["..."], ideas: [{title: "...", description: "..."}] }
Bình luận: ${commentTexts.join('\n')}`;
  const raw = await claude('Bạn là trợ lý hữu ích. Chỉ trả JSON hợp lệ.', prompt);
  const result = safeJson(raw, { needs: [], gaps: [], ideas: [] });
  onProgress(100, 'Xong');
  return { ok: true, seed, commentCount: allComments.length, videosScanned: soVideoDaThu, failed, failedDetail, result, enriched, enrichErr };
}

module.exports = { commentMining, fetchComments, gomBinhLuan };