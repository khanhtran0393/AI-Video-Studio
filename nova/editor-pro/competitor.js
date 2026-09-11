// Phân tích đối thủ (lean, smart): kênh → yt-dlp video+view → outlier → enrich like/comment
// (API nếu có key Nova, không thì yt-dlp KHÔNG CẦN KEY) → AI (API đã cấu hình) phân tích + gợi ý.
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const os = require('os');
const { YTDLP } = require('./ytdlp-path');   // ưu tiên bản đóng gói theo app (ytdlp-bin/), không có mới dò máy/PATH
let _ck = null; try { _ck = require('./nova-cookies'); } catch (_) {}
let _yt = null; try { _yt = require('./nova-yt'); } catch (_) {}   // enrich like/comment/engRate

function run(args, timeoutMs = 120000) {
  return new Promise((res, rej) => { const ps = spawn(YTDLP, args, { windowsHide: true }); let o = '', e = ''; const t = setTimeout(() => { try { ps.kill('SIGKILL'); } catch (_) {} rej(new Error('yt-dlp timeout')); }, timeoutMs);
    ps.stdout.on('data', d => o += d); ps.stderr.on('data', d => e += d); ps.on('error', rej); ps.on('close', c => { clearTimeout(t); c === 0 ? res(o) : rej(new Error(e.split('\n').slice(-2).join(' '))); }); });
}
// ── AI: dùng ĐÚNG API người dùng đã cấu hình trong Cài đặt — MỘT NGUỒN máy gọi API là
// niche/loi.js. noBridge:true → KHÔNG lùi CLI bridge Claude; AI chưa cấu hình hoặc lỗi
// thì báo lỗi thật kèm tên provider (Luật 10). ──
const { claude, _KHO } = require('./niche/loi');
// (đã gộp vào niche/loi.js — hết nhân bản máy gọi API)
const normChannel = (u) => { u = String(u || '').trim(); if (!/^https?:/.test(u)) u = u.startsWith('@') ? 'https://www.youtube.com/' + u : 'https://www.youtube.com/@' + u; return u.replace(/\/(videos|featured|streams)?\/?$/, '') + '/videos'; };

// Quét tab Shorts của kênh (yt-dlp flat — KHÔNG CẦN KEY). Lỗi/trống → ghi chú qua shortsNote,
// KHÔNG làm chết phân tích (dữ liệu bổ sung, lỗi lộ liễu: Luật 10).
async function fetchShorts(channelUrl, count, ck) {
  let u = String(channelUrl || '').trim();
  if (!/^https?:/i.test(u)) u = 'https://www.youtube.com/' + (u.startsWith('@') ? u : '@' + u);
  const base = u.replace(/\/(videos|shorts|featured|streams)?\/?$/, '');
  const args = [base + '/shorts', '--flat-playlist', '--no-warnings',
    '--playlist-items', '1-' + Math.max(8, Math.min(30, count)),
    '--print', '%(id)s\t%(view_count)s\t%(duration)s\t%(title)s'];
  if (ck) args.push('--cookies', ck);
  try {
    const out = await run(args, 90000);
    const vids = out.trim().split('\n').filter(Boolean).map(l => {
      const [id, v, d, ...t] = l.split('\t');
      return { id: (id || '').trim(), views: parseInt(v) || 0, dur: parseInt(d) || 0, title: (t.join('\t') || '').trim(), url: id ? 'https://www.youtube.com/shorts/' + (id || '').trim() : '' };
    }).filter(x => x.title && x.views > 0);
    return { ok: true, vids };
  } catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 120) }; }
}

async function analyzeCompetitor(channelUrl, onProgress = () => {}, count = 20) {
  onProgress(10, 'Lấy video của kênh…');
  const ck = _ck ? await _ck.youtubeCookiesFile().catch(() => null) : null;
  const args = [normChannel(channelUrl), '--no-warnings', '--playlist-items', '1-' + count, '--print', '%(id)s\t%(view_count)s\t%(duration)s\t%(upload_date)s\t%(title)s'];
  if (ck) args.push('--cookies', ck);
  const out = await run(args);
  let vids = out.trim().split('\n').filter(Boolean).map(l => { const [id, v, d, up, ...t] = l.split('\t'); return { id: (id || '').trim(), views: parseInt(v) || 0, dur: parseInt(d) || 0, date: up || '', title: (t.join('\t') || '').trim(), thumb: (id || '').trim() ? `https://i.ytimg.com/vi/${(id || '').trim()}/maxresdefault.jpg` : '' }; }).filter(x => x.title);
  if (!vids.length) throw new Error('Không lấy được video (kênh sai hoặc riêng tư?)');
  onProgress(55, `Có ${vids.length} video, tìm outlier…`);
  const avg = vids.reduce((s, x) => s + x.views, 0) / vids.length;
  vids.forEach(x => x.ratio = avg ? +(x.views / avg).toFixed(2) : 0);
  const outliers = vids.filter(x => x.ratio >= 1.5).sort((a, b) => b.views - a.views);
  // Enrich like/comment (≤count video): có key Nova → YouTube API nhanh;
  // không key → yt-dlp chế độ KHÔNG CẦN KEY (song song 8, cache phiên 24h).
  let enrichedVia = '';
  if (_yt) {
    try {
      onProgress(60, 'Bổ sung like/comment…');
      const { key, mode, map } = await _yt.enrich(vids.slice(0, count).map(x => x.id), (p, m) => onProgress(60, m));
      if (Object.keys(map).length) {
        enrichedVia = mode || (key ? 'api' : 'yt-dlp');
        vids.forEach(x => { const e = map[x.id]; if (e) { x.likes = e.likes; x.comments = e.comments; x.engRate = e.engRate; x.vel = e.vel || x.vel; x.days = e.days != null ? e.days : x.days; x.date = e.date || x.date; } });
      }
    } catch (_) {}
  }
  onProgress(66, 'Quét tab Shorts…');
  const shortsRes = await fetchShorts(channelUrl, count, ck);
  const shorts = shortsRes.ok ? shortsRes.vids : [];
  const shortsNote = shortsRes.ok ? (shorts.length ? '' : 'tab Shorts trống hoặc ẩn view') : 'không đọc được tab Shorts: ' + shortsRes.error;
  const shortsMed = shorts.length >= 5 ? (() => { const s = shorts.map(x => x.views).sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 1; })() : 0;
  const shortsOutliers = shortsMed ? shorts
    .map(x => ({ ...x, ratio: +(x.views / shortsMed).toFixed(2) }))
    .filter(x => x.ratio >= 1.5).sort((a, b) => b.ratio - a.ratio).slice(0, 5) : [];
  const shortsBlock = shortsOutliers.length
    ? `\n\nSHORTS gần đây (x = so với trung vị Shorts ${Math.round(shortsMed)} view; tổng ${shorts.length} shorts):\n${shortsOutliers.map(x => `x${x.ratio} · ${(x.views / 1000).toFixed(0)}k views · ${x.title}`).join('\n')}`
    : '';
  onProgress(70, 'AI phân tích…');
  const list = vids.slice(0, count).map(x => `${(x.views / 1000).toFixed(0)}k views (x${x.ratio}${x.engRate != null ? ', eng ' + x.engRate + '%' : ''}) | ${x.dur ? Math.round(x.dur / 60) + 'p' : '?'} | ${x.title}`).join('\n');
  let analysis = '', analysisError = '';
  const _kAI = _KHO() || {};
  try {
    analysis = await claude(
      'Bạn là chuyên gia phân tích kênh YouTube, trả lời tiếng Việt, thẳng và thực chiến.',
      `Đây là ${vids.length} video gần đây của 1 kênh đối thủ (x = số lần view so với trung bình kênh; eng% = (like+comment)/view — cao bất thường = nội dung chạm đúng tệp):\n${list}${shortsBlock}\n\nPhân tích giúp tôi:\n1. VIDEO ĐỘT PHÁ (outlier, x cao) — chủ đề/kiểu tiêu đề nào đang ăn nhất, VÌ SAO. Chú ý video vừa view cao VỪA eng cao — đó là tín hiệu nội dung thật sự chạm.\n2. CÔNG THỨC TIÊU ĐỀ họ dùng (cấu trúc, từ khóa hook).\n3. Độ dài video ưu tiên.\n4. TÍN HIỆU TƯƠNG TÁC (nếu có eng%): video nào eng cao lệch hẳn — học cái gì.\n5. SHORTS (nếu có): Shorts có đang ăn khác longform không.\n6. 6 Ý TƯỞNG VIDEO + tiêu đề gợi ý cho tôi làm theo hướng đang ăn.\nNgắn gọn, gạch đầu dòng.`, { noBridge: true, noRetry: true });
  } catch (err) { analysisError = String((err && err.message) || err).slice(0, 160); }   // lỗi lộ liễu, giữ outlier cho UI (Luật 10)
  onProgress(100, 'Xong');
  return { ok: true, channel: channelUrl, count: vids.length, avgViews: Math.round(avg), enrichedVia, outliers: outliers.slice(0, 8), topVideos: vids.slice(0, 10), analysis, analysisError, aiProvider: _kAI.api_provider || '', aiModel: _kAI.api_model || '', shortsCount: shorts.length, shortsMedian: Math.round(shortsMed), shortsNote, shortsOutliers: shortsOutliers.map(x => ({ title: x.title, views: x.views, ratio: x.ratio, url: x.url, thumb: x.id ? `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg` : '' })) };
}
// 📈 Tìm thumbnail ĐANG ĂN theo CHỦ ĐỀ (không cần kênh cụ thể).
// ytsearch → lấy id/view/kênh → tính bội số so với TRUNG VỊ (median chịu nhiễu tốt hơn trung bình khi có video triệu view).
// Thumbnail dựng thẳng từ id: https://i.ytimg.com/vi/<id>/maxresdefault.jpg — không cần API key.
async function topicThumbOutliers(topic, onProgress = () => {}, count = 40) {
  const q = String(topic || '').trim();
  if (!q) return { ok: false, error: 'Thiếu chủ đề' };
  onProgress(15, 'Tìm video theo chủ đề…');
  const ck = _ck ? await _ck.youtubeCookiesFile().catch(() => null) : null;
  const args = ['ytsearch' + Math.max(10, Math.min(60, count)) + ':' + q, '--flat-playlist', '--no-warnings',
    '--print', '%(id)s\t%(view_count)s\t%(channel)s\t%(duration)s\t%(title)s'];
  if (ck) args.push('--cookies', ck);
  let out = '';
  try { out = await run(args, 90000); } catch (e) { return { ok: false, error: 'yt-dlp: ' + String(e.message || e).slice(0, 120) }; }
  const rows = out.trim().split('\n').filter(Boolean).map(l => {
    const [id, v, ch, d, ...t] = l.split('\t');
    return { id: (id || '').trim(), views: parseInt(v) || 0, channel: (ch || '').trim(), dur: parseInt(d) || 0, title: (t.join('\t') || '').trim() };
  }).filter(x => x.id && x.views > 0);
  if (!rows.length) return { ok: false, error: 'Không tìm được video nào cho chủ đề này.' };
  onProgress(70, 'Tính bội số view…');
  const sorted = rows.map(x => x.views).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 1;
  rows.forEach(x => {
    x.ratio = +(x.views / med).toFixed(2);
    x.thumb = `https://i.ytimg.com/vi/${x.id}/maxresdefault.jpg`;
    x.thumbSmall = `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`;
    x.url = 'https://www.youtube.com/watch?v=' + x.id;
  });
  rows.sort((a, b) => b.ratio - a.ratio);
  const items = rows.slice(0, 24);
  // Enrich like/comment cho TOP 12 (yt-dlp KHÔNG CẦN KEY, cache phiên 24h) → Eng% giúp
  // phân biệt mẫu VÀNG (view cao + eng cao) với "thumbnail kéo được nhưng nội dung không giữ chân".
  if (_yt) {
    try {
      onProgress(90, 'Bổ sung mức tương tác…');
      const top = items.slice(0, 12);
      const { map } = await _yt.enrich(top.map(x => x.id), () => {});
      top.forEach(x => {
        const e = map[x.id]; if (!e) return;
        x.likes = e.likes; x.comments = e.comments; x.engRate = e.engRate;
        x.verdict = e.engRate >= 2 ? 'mẫu vàng — kéo view VÀ giữ chân' : (e.engRate < 1 ? 'thumbnail kéo nhưng nội dung không giữ chân' : '');
      });
    } catch (_) {}
  }
  onProgress(100, 'Xong');
  return { ok: true, topic: q, median: med, items };
}

// 🔗 Lấy thumbnail từ 1 link video bất kỳ.
function thumbFromUrl(url) {
  const u = String(url || '').trim();
  const m = u.match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})|shorts\/([\w-]{11})|^([\w-]{11})$/);
  const id = m ? (m[1] || m[2] || m[3] || m[4]) : '';
  if (!id) return { ok: false, error: 'Link không hợp lệ — cần link video YouTube.' };
  return { ok: true, id, url: 'https://www.youtube.com/watch?v=' + id,
    thumb: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, thumbSmall: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
}

module.exports = { analyzeCompetitor, topicThumbOutliers, thumbFromUrl };
if (require.main === module) analyzeCompetitor(process.argv[2] || '@mkbhd', (p, m) => console.log(`${p}% ${m}`), 15).then(r => { console.log('\n=== OUTLIER ==='); r.outliers.slice(0,4).forEach(o=>console.log(`  x${o.ratio} | ${(o.views/1000).toFixed(0)}k | ${o.title}`)); console.log('\n=== PHÂN TÍCH ===\n' + r.analysis.slice(0, 900)); }).catch(e => console.log('ERR', String(e.message || e).slice(0, 200)));
