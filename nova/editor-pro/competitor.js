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
async function _goiApi(sys, u, kho) {
  // Relay có khi lỗi 5xx tạm thời hoặc chặn "duplicate request" — thử tối đa 4 lần (5xx 2/5/8s; duplicate 5s).
  let err;
  for (let i = 0; i < 4; i++) {
    try { return await _goiApiMot(sys, u, kho); }
    catch (e) {
      err = e;
      const m = String((e && e.message) || '');
      if (!/HTTP 5\d\d|duplicate/i.test(m)) break;
      const dl = /duplicate/i.test(m) ? 5000 : [2000, 5000, 8000][i] || 8000;
      await new Promise(r => setTimeout(r, dl));
    }
  }
  throw err;
}
async function _goiApiMot(sys, u, kho) {
  const nc = _NHA_CC[String(kho.api_provider || '').trim().toLowerCase()];
  if (!nc) return null;                                        // chưa cấu hình provider → lùi về bridge
  const goc = String(kho.api_base_url || '').trim();
  if (nc.kieu !== 'an' && !nc.url && !goc) return null;
  // Ô key cho phép nhiều khoá (mỗi dòng một khoá) — chỉ lấy khoá dòng đầu.
  const key = String(kho[nc.khoa] || kho.api_key || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';
  if (!key) return null;
  const model = String(kho.api_model || '').trim() || nc.mac;
  if (!model) return null;
  if (nc.kieu === 'an') {                                      // Anthropic native: system là tham số riêng
    const url = goc ? goc.replace(/\/+$/, '') + '/v1/messages' : nc.url;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, ...(sys ? { system: sys } : {}), messages: [{ role: 'user', content: u }] }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error && d.error.message) || ('HTTP ' + r.status));
    return ((d && d.content) || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  const url = goc ? _oaUrl(goc) : nc.url;                      // OpenAI-compatible: Bearer + /v1/chat/completions
  // stream:true — model reasoning nghĩ rất lâu trước token đầu; non-stream bị gateway cắt ~30s → 500,
  // retry lại bị chặn "duplicate request". Stream giữ connection sống.
  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 300000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, stream: true, messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content: u }] }),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      let msg = 'HTTP ' + r.status;
      try { const j = JSON.parse(t); if (j && j.error) msg = typeof j.error === 'string' ? j.error : (j.error.message || msg); } catch (_) {}
      throw new Error(msg);
    }
    let acc = '', buf = '';
    const dec = new TextDecoder();
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const d = s.slice(5).trim();
        if (d === '[DONE]') continue;
        try { const j = JSON.parse(d); const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (c) acc += c; } catch (_) {}
      }
    }
    return acc;
  } finally { clearTimeout(killer); }
}
// Claude/AI: 1) API đã cấu hình → gọi thẳng; 2) CLI bridge nội bộ làm chỗ lùi.
// Nếu bridge ĐÃ trả lời (kể cả HTTP 500) → báo đúng lỗi thật, KHÔNG lùi sang cổng khác (tránh nuốt lỗi thật).
async function claude(sys, u) {
  // 1) API đã cấu hình trong Cài đặt → gọi thẳng (không phụ thuộc bridge).
  try { const r = await _goiApi(sys, u, _KHO()); if (r != null && String(r).trim()) return r; }
  catch (e) { console.warn('[competitor] API cấu hình lỗi, lùi về CLI bridge:', (e && e.message) || e); }
  // 2) Chỗ lùi: CLI bridge — cổng mới 8795 trước, cổng cũ 8790 sau.
  const candidates = ['http://127.0.0.1:8795/chat/completions', 'http://127.0.0.1:8790/chat/completions'];
  let lastErr;
  for (const url of candidates) {
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sonnet', messages: [{ role: 'system', content: sys }, { role: 'user', content: u }] }) });
    } catch (e) { lastErr = lastErr || new Error('cli-bridge không phản hồi (8795/8790).'); continue; }
    if (!r.ok) { let d = ''; try { d = (await r.text()).slice(0, 300); } catch {} throw new Error('cli-bridge HTTP ' + r.status + (d ? (': ' + d) : '')); }
    const d = await r.json();
    if (d && d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || 'cli-bridge lỗi'));
    if (d && d.choices && d.choices[0]) return d.choices[0].message.content || '';
    return '';
  }
  throw lastErr || new Error('cli-bridge không phản hồi (8795/8790).');
}
const normChannel = (u) => { u = String(u || '').trim(); if (!/^https?:/.test(u)) u = u.startsWith('@') ? 'https://www.youtube.com/' + u : 'https://www.youtube.com/@' + u; return u.replace(/\/(videos|featured|streams)?\/?$/, '') + '/videos'; };

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
  onProgress(70, 'Claude phân tích…');
  const list = vids.slice(0, count).map(x => `${(x.views / 1000).toFixed(0)}k views (x${x.ratio}${x.engRate != null ? ', eng ' + x.engRate + '%' : ''}) | ${x.dur ? Math.round(x.dur / 60) + 'p' : '?'} | ${x.title}`).join('\n');
  let analysis = '', analysisError = '';
  try {
    analysis = await claude(
      'Bạn là chuyên gia phân tích kênh YouTube, trả lời tiếng Việt, thẳng và thực chiến.',
      `Đây là ${vids.length} video gần đây của 1 kênh đối thủ (x = số lần view so với trung bình kênh; eng% = (like+comment)/view — cao bất thường = nội dung chạm đúng tệp):\n${list}\n\nPhân tích giúp tôi:\n1. VIDEO ĐỘT PHÁ (outlier, x cao) — chủ đề/kiểu tiêu đề nào đang ăn nhất, VÌ SAO. Chú ý video vừa view cao VỪA eng cao — đó là tín hiệu nội dung thật sự chạm.\n2. CÔNG THỨC TIÊU ĐỀ họ dùng (cấu trúc, từ khóa hook).\n3. Độ dài video ưu tiên.\n4. TÍN HIỆU TƯƠNG TÁC (nếu có eng%): video nào eng cao lệch hẳn — học cái gì.\n5. 6 Ý TƯỞNG VIDEO + tiêu đề gợi ý cho tôi làm theo hướng đang ăn.\nNgắn gọn, gạch đầu dòng.`);
  } catch (err) { analysisError = String((err && err.message) || err).slice(0, 160); }   // lỗi lộ liễu, giữ outlier cho UI (Luật 10)
  onProgress(100, 'Xong');
  return { ok: true, channel: channelUrl, count: vids.length, avgViews: Math.round(avg), enrichedVia, outliers: outliers.slice(0, 8), topVideos: vids.slice(0, 10), analysis, analysisError };
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
