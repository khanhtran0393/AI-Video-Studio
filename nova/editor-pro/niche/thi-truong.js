/* ── Tách từ niche.js — phần BÁO CÁO: hotTopics (chủ đề bùng), bwScore (chấm ý tưởng
     đen–trắng), attentionMarkets (tệp khán giả động). Module CommonJS: hứng hàm dùng
     chung từ ./loi qua require. Đường require cũ vẫn ổn nhờ niche.js re-export. ── */
const { claude, safeJson, kfmt, cached, searchVideos, median, sweepQueries, pool } = require('./loi');


async function hotTopics(seed, onProgress = () => {}, opts = {}) {
  return cached('hot', seed, opts.fresh, onProgress, async () => {
    const queries = await sweepQueries(seed, onProgress);
    // Quét SONG SONG 2 luồng (pool) thay vì tuần tự — 4 góc yt-dlp độc lập nên nhanh ~2x.
    // Lỗi từng góc KHÔNG bị nuốt (Luật 10): gom vào failedQueries, báo rõ ra UI.
    const seen = new Set(); const all = []; const failedQueries = []; let enriched = false; let done = 0;
    const results = await pool(queries, 2, (q) => searchVideos(q, 20, () => {})
      .then(r => ({ ok: true, q, r }))
      .catch(err => ({ ok: false, q, error: String((err && err.message) || err).slice(0, 140) }))
      .then(res => {
        done++;
        onProgress(10 + Math.round(done * 40 / queries.length), res.ok
          ? `Quét góc ${done}/${queries.length}: "${res.q.slice(0, 40)}"…`
          : `Góc ${done}/${queries.length} lỗi: ${res.error.slice(0, 60)}`);
        return res;
      }));
    for (const res of results) {
      if (!res.ok) { failedQueries.push({ q: res.q, error: res.error }); continue; }
      enriched = enriched || res.r.enriched;
      res.r.vids.forEach(v => { if (v.id && !seen.has(v.id)) { seen.add(v.id); v.q = res.q; all.push(v); } });
    }
    if (!all.length) {
      const why = failedQueries.length ? ' — ' + failedQueries.map(f => f.error).join('; ').slice(0, 180) : '';
      throw new Error('Không tìm được video cho từ khoá này' + why);
    }

    // Trung vị ngách: chịu nhiễu tốt hơn trung bình khi có 1-2 video triệu view.
    const med = median(all.map(x => x.views).filter(v => v > 0)) || 1;
    all.forEach(x => {
      x.ratio = +(x.views / med).toFixed(2);
      x.vps = x.subs > 0 ? +(x.views / x.subs).toFixed(2) : 0;   // chỉ có khi enrich được sub
    });

    // Hai cửa sổ: ≤30 ngày = đang lên · 30-180 ngày = đã ăn. Chỉ giữ video vượt trung vị.
    const rising = all.filter(x => x.days != null && x.days <= 30 && x.ratio >= 1.2).sort((a, b) => b.ratio - a.ratio).slice(0, 14);
    const proven = all.filter(x => x.days != null && x.days > 30 && x.days <= 180 && x.ratio >= 1.5).sort((a, b) => b.ratio - a.ratio).slice(0, 14);
    if (!rising.length && !proven.length) throw new Error('Ngách này không có video nào vượt trung vị trong 180 ngày.');

    const fmt = (x) => `x${x.ratio} trung vị · ${kfmt(x.views)} view · ${x.days}d${x.vps ? ` · VPS ${x.vps}` : ''}${x.subs ? ` · kênh ${kfmt(x.subs)} sub` : ''} | ${x.channel} | ${x.title}`;
    onProgress(76, 'Claude gom nhóm chủ đề…');
    const raw = await claude(
      'Bạn là chuyên gia nghiên cứu ngách YouTube, trả lời tiếng Việt. CHỈ trả JSON hợp lệ, không giải thích ngoài JSON.',
      `Ngách: "${seed}". Trung vị ngách ${kfmt(med)} view. "Bội số" = view ÷ trung vị.\n` +
      (rising.length ? `\nĐANG LÊN (đăng ≤30 ngày):\n${rising.map(fmt).join('\n')}\n` : '') +
      (proven.length ? `\nĐÃ ĂN (30-180 ngày):\n${proven.map(fmt).join('\n')}\n` : '') +
      `\nGom thành tối đa 5 CHỦ ĐỀ (micro-topic). Mỗi chủ đề ghi rõ nó thuộc nhóm nào.\n` +
      `Khi giải thích "vì sao ăn", BÁM SỐ LIỆU ở trên (bội số, VPS, số sub của kênh đăng) — VPS cao ở kênh ít sub nghĩa là thuật toán đang đẩy CHỦ ĐỀ chứ không đẩy KÊNH.\n` +
      `Trả JSON mảng:\n{"topic":"tên ngắn","window":"rising|proven","heat":"Cao|Trung bình","ratio":số bội số trung bình,"count":số video,"why":"vì sao ăn, bám số liệu (1 câu)","angle":"góc làm khác biệt (1 câu)","title":"1 tiêu đề mẫu"}`);

    onProgress(100, 'Xong');
    const pick = (x) => ({ title: x.title, channel: x.channel, views: x.views, viewsFmt: kfmt(x.views), ratio: x.ratio, vps: x.vps, subs: x.subs, days: x.days, url: x.url, id: x.id });
    return {
      ok: true, seed, enriched, queries, median: Math.round(med), scanned: all.length,
      failedQueries,                                          // góc quét lỗi — UI báo "x/y góc lỗi"
      items: safeJson(raw, []),
      rising: rising.map(pick), proven: proven.map(pick),
    };
  });
}

// ══════════════════════════════════════════════════════════════════
//  1d) CHẤM Ý TƯỞNG B&W — thang "đen–trắng" của Fractal.
//      Ý hay có 2 loại: NHIỀU TẦNG (sâu, giữ chân tốt, kém hút click) và ĐEN–TRẮNG
//      (rút được thành cặp nhị phân <60 ký tự mà không mất chất). Ô này tối ưu vế thứ hai.
// ══════════════════════════════════════════════════════════════════
async function bwScore(payload = {}, onProgress = () => {}) {
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('Cần nhập tiêu đề để chấm.');
  const niche = String(payload.niche || '').trim();
  onProgress(30, 'Claude chấm theo thang đen–trắng…');
  const raw = await claude(
    'Bạn là chuyên gia đặt tiêu đề YouTube, trả lời tiếng Việt. CHỈ trả JSON hợp lệ.',
    `Chấm tiêu đề theo THANG ĐEN–TRẮNG.\n\nTriết lý:\n- Ý tồi thì bỏ. Ý hay có 2 loại:\n  · NHIỀU TẦNG: phức tạp, khó nói gọn. Giữ chân tốt, HÚT CLICK KÉM.\n  · ĐEN–TRẮNG: rút được thành một cặp nhị phân rõ ràng dưới ~60 ký tự mà KHÔNG mất chất. Hút click mạnh.\n- Cặp nhị phân tạo căng thẳng: X vs Y, thật vs giả, thắng vs thua, thiên tài vs lừa đảo, an toàn vs nguy hiểm, nên vs không nên.\n- Tránh tiêu đề mô tả chung chung, tránh thuật ngữ, tránh ý nhiều tầng không rút gọn được.\n\nThang điểm 0-100:\n- 0-20: tầm thường, không có căng, dễ lướt qua\n- 21-50: có mới nhưng còn rộng/mơ hồ, chưa tạo tò mò ngay\n- 51-70: hook rõ, có căng, làm được\n- 71-85: đóng gói đen-trắng rất mạnh, "vì sao phải click" hiển nhiên\n- 86-100: hiếm — nhị phân bắt ngay + hàm ý sâu + mới lạ mà vẫn làm được\n\nTIÊU ĐỀ: "${title}"${niche ? `\nNGÁCH: ${niche}` : ''}\n\nTrả JSON:\n{"score":0-100,"poleA":"cực đối lập thứ nhất tìm thấy (rỗng nếu không có)","poleB":"cực thứ hai (rỗng nếu không có)","layered":true nếu là ý nhiều tầng,"verdict":"1-2 câu nhận xét, nói thẳng vấn đề","alts":[{"title":"tiêu đề viết lại","score":0-100,"why":"cặp đối lập là gì (ngắn)"}]}\nViết 4 tiêu đề thay thế, mỗi cái một cặp đối lập khác nhau, ưu tiên dưới 60 ký tự.`);
  onProgress(100, 'Xong');
  const d = safeJson(raw, null);
  if (!d) throw new Error('Claude trả về không phải JSON.');
  return { ok: true, title, niche, result: d, chars: title.length };
}



// 5) ATTENTION MARKETS — "Người xem…" (tệp khán giả ĐỘNG, khác "ngách" là chủ đề TĨNH).
//    Nâng cấp: mỗi tệp được XẾP HẠNG BẰNG SỐ OUTLIER gom được (fire count) chứ không để Claude tự sắp,
//    và mọi ý tưởng đều bị chấm theo thang đen–trắng.
async function attentionMarkets(seed, onProgress = () => {}, opts = {}) {
  return cached('attention', seed, opts.fresh, onProgress, async () => {
    const { vids, enriched } = await searchVideos(seed, 24, onProgress);
    if (!vids.length) throw new Error('Không tìm được video cho từ khoá này.');
    onProgress(58, 'Lọc video vượt trội…');
    // Chỉ xét OUTLIER: video vượt trung vị ngách — đó mới là chỗ có tệp khán giả đang đói.
    const med = median(vids.map(x => x.views).filter(v => v > 0)) || 1;
    vids.forEach(x => x.ratio = +(x.views / med).toFixed(2));
    const out = vids.filter(x => x.ratio >= 1.3).sort((a, b) => b.ratio - a.ratio).slice(0, 20);
    const pool = out.length >= 4 ? out : vids.slice(0, 16);
    const list = pool.map((x, i) => `${i}. x${x.ratio} · ${kfmt(x.views)} view · ${x.days ?? '?'}d · ${x.channel} | ${x.title}`).join('\n');

    onProgress(80, 'Claude dựng thị trường chú ý…');
    const raw = await claude(
      'Bạn là chuyên gia nghiên cứu khán giả YouTube, trả lời tiếng Việt. CHỈ trả JSON hợp lệ.',
      `Ngách "${seed}" là một CHỦ ĐỀ (tĩnh). Việc của bạn là tìm các THỊ TRƯỜNG CHÚ Ý (tệp khán giả, động).\n` +
      `Ví dụ: ngách "Bóng rổ" → thị trường chú ý "Người xem hiểu luật bóng rổ và chán bình luận sáo rỗng".\n\n` +
      `${pool.length} video vượt trội (bội số so với trung vị ngách ${kfmt(med)} view):\n${list}\n\n` +
      `Xếp MỖI video vào đúng một tệp khán giả, rồi gom thành tối đa 5 tệp. Bỏ tệp chỉ có 1 video.\n` +
      `Với mỗi tệp, nghĩ 1 ý tưởng video mới và chấm theo THANG ĐEN–TRẮNG:\n` +
      `- Ý ĐEN–TRẮNG rút được thành cặp nhị phân rõ ràng dưới ~60 ký tự mà không mất chất → hút click mạnh (71-100đ).\n` +
      `- Ý NHIỀU TẦNG sâu nhưng khó nói gọn → giữ chân tốt, hút click kém (21-50đ).\n\n` +
      `Trả JSON mảng:\n{"segment":"Người xem … (mô tả tệp, dưới 90 ký tự)","videos":[các số thứ tự video thuộc tệp này],"demand":"Cao|Trung bình","need":"họ muốn gì (1 câu)","idea":"tiêu đề ý tưởng mới","bw":0-100,"poles":"cặp đối lập trong ý tưởng đó (hoặc rỗng)"}`);

    const items = (safeJson(raw, []) || []).map(m => {
      const idx = (Array.isArray(m.videos) ? m.videos : []).map(Number).filter(i => pool[i]);
      return {
        ...m, fire: idx.length,
        avgViews: idx.length ? Math.round(idx.reduce((s, i) => s + pool[i].views, 0) / idx.length) : 0,
        samples: idx.slice(0, 3).map(i => ({ title: pool[i].title, viewsFmt: kfmt(pool[i].views), ratio: pool[i].ratio, url: pool[i].url })),
      };
    }).filter(m => m.segment).sort((a, b) => b.fire - a.fire);

    onProgress(100, 'Xong');
    return { ok: true, seed, enriched, median: Math.round(med), scanned: vids.length, outliers: pool.length, items };
  });
}
module.exports = { hotTopics, bwScore, attentionMarkets };
