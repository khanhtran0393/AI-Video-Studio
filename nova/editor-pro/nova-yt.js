// YouTube Data API v3 enrichment — dùng KEY CỦA NOVA (localStorage 'yt_api_key'),
// KHÔNG dùng key hardcode của Fractal. Chỉ enrich ID đã tìm (videos.list = 1 unit/50 vid),
// không search.list (100 unit) → tiết kiệm quota.
// MÁY CHƯA CÓ KEY → chế độ KHÔNG CẦN KEY qua yt-dlp (like/comment/view/dur/ngày đăng),
// khai báo tường minh qua mode='yt-dlp' trong kết quả — không phải fallback ngầm.
let _nk = null; try { _nk = require('./nova-keys'); } catch (_) {}
let _ck = null; try { _ck = require('./nova-cookies'); } catch (_) {}
const fs = require('fs');
const path = require('path');
const YT = 'https://www.googleapis.com/youtube/v3/';
const { spawn } = require('child_process');
const { YTDLP } = require('./ytdlp-path');   // ưu tiên bản đóng gói theo app (ytdlp-bin/)

function run(args, timeoutMs = 60000) {
  return new Promise((res, rej) => {
    const ps = spawn(YTDLP, args, { windowsHide: true }); let o = '', e = '';
    const t = setTimeout(() => { try { ps.kill('SIGKILL'); } catch (_) {} rej(new Error('yt-dlp timeout')); }, timeoutMs);
    ps.stdout.on('data', d => o += d); ps.stderr.on('data', d => e += d);
    ps.on('error', rej); ps.on('close', c => { clearTimeout(t); c === 0 ? res(o) : rej(new Error(e.split('\n').slice(-2).join(' '))); });
  });
}

async function ytKey() {
  if (process.env.YT_API_KEY) return process.env.YT_API_KEY.trim();   // cho test CLI
  if (_nk) { try { const k = await _nk.novaLocalStorage('yt_api_key'); if (k) return k; } catch (_) {} }
  return null;
}
async function api(path, params, key) {
  const qs = new URLSearchParams({ ...params, key }).toString();
  const r = await fetch(YT + path + '?' + qs);
  if (!r.ok) throw new Error('YT API ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}
function isoToSec(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}
function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d >= 0 ? d : null; }

// ids: mảng videoId → map id → {views,likes,comments,dur,date,days,channel, subs?, engRate, viewPerSub?, demand, vel}
// Trả về { key, mode, map }: mode='api' (có key YouTube Data API) hoặc mode='yt-dlp' (không cần key).
// onProgress(p, m) chỉ dùng ở chế độ yt-dlp (p: 0–100).
async function enrich(ids, onProgress = () => {}) {
  const key = await ytKey();
  if (!ids || !ids.length) return { key: !!key, mode: key ? 'api' : 'yt-dlp', map: {} };
  // Không có key → enrich bằng yt-dlp (yt-dlp-bin đã đóng gói theo app, zero cấu hình).
  if (!key) { const m = await enrichKeyless(ids, onProgress); return { key: false, mode: 'yt-dlp', map: m }; }
  const map = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).filter(Boolean);
    if (!chunk.length) continue;
    const d = await api('videos', { part: 'statistics,contentDetails,snippet', id: chunk.join(',') }, key);
    for (const it of (d.items || [])) {
      const st = it.statistics || {}, sn = it.snippet || {}, cd = it.contentDetails || {};
      const views = +st.viewCount || 0, likes = +st.likeCount || 0, comments = +st.commentCount || 0;
      const days = daysSince(sn.publishedAt);
      map[it.id] = {
        views, likes, comments, dur: isoToSec(cd.duration), date: sn.publishedAt || '', days,
        channelId: sn.channelId || '', channel: sn.channelTitle || '',
        vel: days != null ? Math.round(views / Math.max(days, 1)) : 0,
        engRate: views ? +(((likes + comments) / views) * 100).toFixed(2) : 0,
        demand: views + comments * 250 + likes * 10,   // công thức nhu cầu của Fractal
      };
    }
  }
  // subs cho từng kênh (channels.list, 1 unit/50) → viewPerSub (tín hiệu outlier)
  const chIds = [...new Set(Object.values(map).map(v => v.channelId).filter(Boolean))];
  const subs = {};
  for (let i = 0; i < chIds.length; i += 50) {
    try {
      const d = await api('channels', { part: 'statistics', id: chIds.slice(i, i + 50).join(',') }, key);
      for (const it of (d.items || [])) subs[it.id] = +(it.statistics && it.statistics.subscriberCount) || 0;
    } catch (_) {}
  }
  for (const v of Object.values(map)) { v.subs = subs[v.channelId] || 0; v.viewPerSub = v.subs ? +(v.views / v.subs).toFixed(2) : 0; }
  return { key: true, mode: 'api', map };
}

// ── Enrich KHÔNG CẦN KEY (yt-dlp): like/comment/view/dur/ngày đăng cho từng video. ──
// Dùng khi máy chưa có YouTube Data API key — không quota, không cần cấu hình Google Cloud.
// Video lỗi (age-gate/xoá/region) bị bỏ qua — KHÔNG bịa giá trị mặc định (Luật 10).
function _ymd(s) { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s || '').trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; }

const _ckCache = new Map();   // id → { t, entry } — cache phiên 24h: ID đã enrich gần đây dùng lại ngay, khỏi re-fetch
const _CK_TTL = 24 * 3600 * 1000;
/* Cache 24h TRÊN ĐĨA (userData/nova-cache/yt-enrich.json): qua các phiên không phải
   re-fetch like/comment cho cùng video (tiết kiệm vài chục giây yt-dlp/lần phân tích).
   Chỉ ghi khi chạy trong Electron (require('electron') ở plain Node/test trả chuỗi → bỏ qua). */
const _CK_FILE = (() => {
  try {
    const app = require('electron').app;
    return path.join(app.getPath('userData'), 'nova-cache', 'yt-enrich.json');
  } catch (_) { return null; }
})();
try {
  if (_CK_FILE) {
    const saved = JSON.parse(fs.readFileSync(_CK_FILE, 'utf8'));
    const now = Date.now();
    for (const [id, c] of Object.entries(saved || {})) if (c && c.entry && now - c.t < _CK_TTL) _ckCache.set(id, c);
  }
} catch (_) {}
let _ckSaveTimer = null;
function _persistCkCache() {
  if (!_CK_FILE || _ckSaveTimer) return;
  _ckSaveTimer = setTimeout(() => {
    _ckSaveTimer = null;
    try {
      fs.mkdirSync(path.dirname(_CK_FILE), { recursive: true });
      const now = Date.now(), out = {};
      for (const [id, c] of _ckCache) if (c && c.entry && now - c.t < _CK_TTL) out[id] = c;
      fs.writeFileSync(_CK_FILE, JSON.stringify(out));
    } catch (_) {}
  }, 5000);
  if (_ckSaveTimer.unref) _ckSaveTimer.unref();   // không giữ process sống chỉ để ghi cache
}

async function enrichKeyless(ids, onProgress = () => {}, concurrency = 8) {
  const list = (ids || []).filter(Boolean);
  const map = {};
  if (!list.length) return map;
  // Lọc ID còn trong cache phiên (24h) — phần còn lại mới cần fetch.
  const need = [];
  for (const id of list) {
    const c = _ckCache.get(id);
    if (c && Date.now() - c.t < _CK_TTL) map[id] = c.entry; else need.push(id);
  }
  if (!need.length) { try { onProgress(100, `Like/comment ${list.length}/${list.length} (cache phiên)…`); } catch (_) {} return map; }
  let ck = null;
  try { if (_ck) ck = await _ck.youtubeCookiesFile().catch(() => null); } catch (_) {}
  const queue = need.slice();
  const doneBefore = list.length - need.length;
  let done = 0;
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      const args = ['--skip-download', '--no-warnings',
        '--print', '%(id)s\t%(view_count)s\t%(like_count)s\t%(comment_count)s\t%(duration)s\t%(upload_date)s\t%(channel)s\t%(channel_follower_count)s',
        'https://www.youtube.com/watch?v=' + id];
      if (ck) args.push('--cookies', ck);
      try {
        const out = await run(args, 60000);
        const line = out.trim().split('\n').filter(Boolean).pop() || '';
        const [vid, v, lk, cm, du, up, ch, sub] = line.split('\t');
        if (!vid || vid !== id) throw new Error('yt-dlp trả ID không khớp: ' + String(vid).slice(0, 40));
        const views = parseInt(v) || 0, likes = parseInt(lk) || 0, comments = parseInt(cm) || 0;
        const dur = parseInt(du) || 0, subs = parseInt(sub) || 0;
        const date = _ymd(up), days = daysSince(date);
        const entry = {
          views, likes, comments, dur, date, days,
          channel: (ch || '').trim(),
          subs: subs || undefined,                 // yt-dlp có khi mới cho — undefined thì caller giữ giá trị cũ
          vel: days != null ? Math.round(views / Math.max(days, 1)) : 0,
          engRate: views ? +(((likes + comments) / views) * 100).toFixed(2) : 0,
          demand: views + comments * 250 + likes * 10,   // cùng công thức nhu cầu như nhánh API
        };
        map[id] = entry;
        _ckCache.set(id, { t: Date.now(), entry });
        _persistCkCache();
      } catch (_) { /* lỗi 1 video → bỏ video đó, các video khác vẫn enrich */ }
      done++;
      try { onProgress(Math.round((doneBefore + done) * 100 / list.length), `Like/comment ${doneBefore + done}/${list.length} (yt-dlp, không cần key)…`); } catch (_) {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, need.length) }, worker));
  return map;
}

module.exports = { enrich, enrichKeyless, ytKey };
