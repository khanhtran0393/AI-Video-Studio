/* ── Tách từ niche.js — phần KÊNH: thẻ điểm kênh (VPS/VPH/longform/ổn định/xu hướng)
     + tìm kênh giống. Module CommonJS: hứng hàm dùng chung từ ./loi qua require.
     Đường require cũ vẫn ổn nhờ niche.js (file gốc) re-export từ ./niche/index. ── */
const { run, claude, cookies, daysSince, kfmt, cached, searchVideos, median, pool } = require('./loi');

// ══════════════════════════════════════════════════════════════════
//  1c) THẺ ĐIỂM KÊNH — 5 chỉ số sức khoẻ + outlier + kênh giống.
//      Tất cả từ yt-dlp (có %(channel_follower_count)s nên tính được VPS), không cần API key.
// ══════════════════════════════════════════════════════════════════
function normChannel(u) {
  let s = String(u || '').trim();
  if (!s) return s;
  if (!/^https?:/i.test(s)) s = 'https://www.youtube.com/' + (s.startsWith('@') ? s : '@' + s);
  return /\/videos\/?$/.test(s) ? s : s.replace(/\/+$/, '') + '/videos';
}

// 5 chỉ số của Fractal: VPS · VPH · tỉ lệ longform · độ ổn định · xu hướng (độ dốc hồi quy).
function channelMetrics(vids, subs) {
  if (!vids.length) return null;
  const recent = vids.slice(0, 20);
  const avg = recent.reduce((s, x) => s + x.views, 0) / recent.length;
  const vps = subs > 0 ? avg / subs : 0;
  // VPH: view/giờ của 5 video mới nhất — "nhiệt" hiện tại, khác hẳn view tổng.
  const last5 = recent.slice().sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)).slice(0, 5);
  const vph = last5.length ? last5.reduce((s, x) => s + x.views / Math.max(1, (x.days ?? 1) * 24), 0) / last5.length : 0;
  const longform = recent.filter(x => x.dur >= 480).length / recent.length;
  // Độ ổn định = hệ số biến thiên (lệch chuẩn ÷ trung bình). Thấp = đều đặn.
  const variance = recent.reduce((s, x) => s + Math.pow(x.views - avg, 2), 0) / recent.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
  // Xu hướng: hồi quy view theo TUỔI video. Dốc âm (video mới view cao hơn) = đang lên → đảo dấu.
  let trend = 0;
  const xy = recent.filter(x => x.days != null).map(x => [x.days, x.views]);
  if (xy.length >= 3) {
    const n = xy.length;
    const sx = xy.reduce((s, [x]) => s + x, 0), sy = xy.reduce((s, [, y]) => s + y, 0);
    const sxy = xy.reduce((s, [x, y]) => s + x * y, 0), sxx = xy.reduce((s, [x]) => s + x * x, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx + 1e-6);
    trend = avg > 0 ? -slope * 30 / avg : 0;   // đổi ra "thay đổi ~%/tháng so với view trung bình"
  }
  return { avgViews: Math.round(avg), vps: +vps.toFixed(2), vph: Math.round(vph), longform: +longform.toFixed(2), cv: +cv.toFixed(2), trend: +trend.toFixed(2) };
}
// Đã bật kiếm tiền? (suy đoán — YouTube không công khai)
function monetizedGuess(subs, m) {
  if (!m) return false;
  if (subs >= 2000) return true;
  if (m.avgViews >= 20000 && m.longform >= 0.3) return true;
  return m.avgViews >= 50000;
}
// Điểm sức khoẻ 0-100 gộp 5 chỉ số — để xếp hạng nhanh, chi tiết vẫn xem từng dòng.
function healthScore(m) {
  if (!m) return 0;
  const s = Math.min(30, (m.vps / 2) * 30)            // VPS 2.0 → kịch 30đ
    + Math.min(25, m.longform * 25)                    // longform 100% → 25đ
    + Math.min(20, Math.max(0, (1 - m.cv)) * 20)       // cv 0 → 20đ
    + Math.min(15, Math.max(0, m.trend) * 30)          // trend +50%/tháng → kịch 15đ
    + Math.min(10, Math.log10(Math.max(1, m.vph)) * 3);
  return Math.round(Math.max(0, Math.min(100, s)));
}

async function channelScorecard(channelUrl, onProgress = () => {}, opts = {}) {
  const count = Math.max(8, Math.min(30, Number(opts.count) || 20));
  // Key cache gộp cả count + cờ analyze: soi 20 video rồi đổi sang 30 (hoặc gọi
  // nội bộ không phân tích AI như similarChannels) không ăn nhầm cache của nhau.
  return cached('scorecard', channelUrl, opts.fresh, onProgress, async () => {
    onProgress(10, 'Lấy video kênh…');
    const ck = await cookies();
    const args = [normChannel(channelUrl), '--no-warnings', '--playlist-items', '1-' + count,
      '--print', '%(id)s\t%(view_count)s\t%(duration)s\t%(upload_date)s\t%(channel)s\t%(channel_follower_count)s\t%(title)s'];
    if (ck) args.push('--cookies', ck);
    const out = await run(args);
    const vids = out.trim().split('\n').filter(Boolean).map(l => {
      const [id, v, d, up, ch, sub, ...t] = l.split('\t');
      return { id: (id || '').trim(), views: parseInt(v) || 0, dur: parseInt(d) || 0, days: daysSince(up), channel: (ch || '').trim(), subs: parseInt(sub) || 0, title: (t.join('\t') || '').trim(), url: id ? 'https://youtu.be/' + id : '' };
    }).filter(x => x.title && x.views >= 0);
    if (!vids.length) throw new Error('Không đọc được video của kênh này (kênh riêng tư hoặc sai link).');

    const subs = vids.find(x => x.subs > 0)?.subs || 0;
    const name = vids.find(x => x.channel)?.channel || String(channelUrl);
    const m = channelMetrics(vids, subs);
    onProgress(48, 'Tính chỉ số…');

    // Outlier: bội số so với TRUNG VỊ kênh (không phải trung bình — 1 video triệu view sẽ kéo lệch).
    const med = median(vids.map(x => x.views)) || 1;
    vids.forEach(x => x.ratio = +(x.views / med).toFixed(2));
    const outliers = vids.filter(x => x.ratio >= 1.5).sort((a, b) => b.ratio - a.ratio).slice(0, 8);

    let analysis = ''; let analysisError = '';
    if (opts.analyze !== false && outliers.length) {
      onProgress(70, 'Claude đọc mô-típ…');
      try {
        analysis = await claude(
          'Bạn là chuyên gia nội dung YouTube, trả lời tiếng Việt, ngắn gọn.',
          `Kênh "${name}" (${kfmt(subs)} sub). Trung vị kênh ${kfmt(med)} view.\nChỉ số: VPS ${m.vps}× · longform ${Math.round(m.longform * 100)}% · độ ổn định (CV) ${m.cv} · xu hướng ${m.trend > 0 ? '+' : ''}${Math.round(m.trend * 100)}%/tháng.\n\nVIDEO VƯỢT TRỘI:\n${outliers.map(x => `x${x.ratio} · ${kfmt(x.views)} view · ${Math.round(x.dur / 60)}p · ${x.title}`).join('\n')}\n\nViết 3-5 câu: mô-típ nào đang ăn ở kênh này, và người mới chen vào bằng cách nào. Bám số liệu, không nói chung chung.`);
      } catch (err) { analysisError = String((err && err.message) || err).slice(0, 160); }   // lỗi lộ liễu ra UI, không nuốt (Luật 10)
    }
    onProgress(100, 'Xong');
    return {
      ok: true, channel: name, subs, subsFmt: kfmt(subs), videoCount: vids.length, median: Math.round(med),
      metrics: m, health: healthScore(m), monetized: monetizedGuess(subs, m), analysis, analysisError,
      outliers: outliers.map(x => ({ title: x.title, views: x.views, viewsFmt: kfmt(x.views), ratio: x.ratio, dur: x.dur, days: x.days, url: x.url, id: x.id })),
    };
  }, 'n' + count + (opts.analyze === false ? '-noan' : ''));
}

// KÊNH GIỐNG — không có API key nên bỏ tín hiệu featuredChannels (YouTube đã gỡ tab này ở nhiều kênh),
// dùng ĐỒNG XUẤT HIỆN: lấy từ khoá từ video top của kênh gốc → ytsearch → kênh nào lặp lại nhiều lần thì điểm cao.
async function similarChannels(channelUrl, onProgress = () => {}, opts = {}) {
  return cached('similar', channelUrl, opts.fresh, onProgress, async () => {
    onProgress(8, 'Đọc kênh gốc…');
    const seedCard = await channelScorecard(channelUrl, () => {}, { count: 12, analyze: false, fresh: opts.fresh });
    const seedName = seedCard.channel;
    // Từ khoá quét = tiêu đề của 5 video vượt trội nhất (đã bỏ số/ký tự thừa).
    const seeds = (seedCard.outliers.length ? seedCard.outliers : []).slice(0, 5).map(x => x.title)
      .concat(seedCard.outliers.length < 3 ? [seedName] : []);
    const queries = seeds.map(t => String(t).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(w => w.length >= 4).slice(0, 5).join(' ')).filter(Boolean);
    if (!queries.length) throw new Error('Kênh này không đủ dữ liệu để tìm kênh giống.');

    // Gom theo channel_url (khoá ổn định) chứ không theo TÊN — tên có dấu cách thì ghép @handle sẽ hỏng.
    const score = new Map(), meta = new Map(); const failedQueries = []; let done = 0;
    // Quét song song 2 luồng — các truy vấn độc lập, Map cập nhật đồng bộ sau mỗi kết quả.
    const results = await pool(queries, 2, (q) => searchVideos(q, 15, () => {})
      .then(r => ({ ok: true, q, vids: r.vids }))
      .catch(err => ({ ok: false, q, error: String((err && err.message) || err).slice(0, 140) }))
      .then(res => {
        done++;
        onProgress(15 + Math.round(done * 55 / queries.length), res.ok ? `Quét "${res.q.slice(0, 34)}"…` : `Truy vấn ${done} lỗi: ${res.error.slice(0, 60)}`);
        return res;
      }));
    for (const res of results) {
      if (!res.ok) { failedQueries.push({ q: res.q, error: res.error }); continue; }
      const perQuery = new Set();
      res.vids.forEach(v => {
        const key = v.channelUrl || (v.channel || '').trim();
        if (!key || (v.channel || '').toLowerCase() === seedName.toLowerCase()) return;
        if (!perQuery.has(key)) { perQuery.add(key); score.set(key, (score.get(key) || 0) + 7); }   // +7 mỗi truy vấn xuất hiện
        const mm = meta.get(key) || { name: v.channel, views: 0, n: 0, subs: 0 };
        mm.views += v.views; mm.n++; if (v.subs > mm.subs) mm.subs = v.subs; if (v.channel) mm.name = v.channel;
        meta.set(key, mm);
      });
    }
    const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(3, Math.min(8, Number(opts.limit) || 6)));
    if (!ranked.length) {
      const why = failedQueries.length ? ' — ' + failedQueries.map(f => f.error).join('; ').slice(0, 180) : '';
      throw new Error('Không tìm được kênh nào cùng tệp' + why);
    }

    // Chấm chỉ số thật cho từng ứng viên (mỗi kênh 1 lần yt-dlp, 12 video) — song song 2 luồng.
    let done2 = 0;
    const cards = await pool(ranked, 2, async ([key, pts]) => {
      const mm = meta.get(key) || {};
      const label = mm.name || key;
      try {
        const c = await channelScorecard(key, () => {}, { count: 12, analyze: false });
        return { channel: c.channel, url: key, subs: c.subs, subsFmt: c.subsFmt, metrics: c.metrics, health: c.health, points: pts, hits: Math.round(pts / 7) };
      } catch (_) {
        // Đọc kênh hỏng thì vẫn giữ lại với sub lấy được từ kết quả tìm kiếm, đánh dấu partial + lý do.
        return { channel: label, url: key, subs: mm.subs || 0, subsFmt: kfmt(mm.subs || 0), metrics: null, health: 0, points: pts, hits: Math.round(pts / 7), partial: true, partialError: 'không đọc được chỉ số' };
      } finally {
        done2++;
        onProgress(72 + Math.round(done2 * 26 / ranked.length), `Chấm "${String(label).slice(0, 26)}"…`);
      }
    });
    onProgress(100, 'Xong');
    return { ok: true, seed: seedName, queries, failedQueries, cards: cards.sort((a, b) => (b.metrics?.vps || 0) - (a.metrics?.vps || 0)) };
  });
}
module.exports = { channelScorecard, similarChannels };
