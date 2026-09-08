// Tìm Ngách (Niche Finder) — 6 module, đấu vào đồ thật của Nova:
//   yt-dlp (cookie Nova) khám phá FREE → YouTube Data API (key Nova) enrich like/comment/sub
//   → AI phân tích (ưu tiên API đã cấu hình trong Cài đặt; CLI bridge chỉ là chỗ lùi). + cache kết quả. Không dùng key/DB proprietary của Fractal.
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const os = require('os');
const { YTDLP } = require('../ytdlp-path');   // ưu tiên bản đóng gói theo app (ytdlp-bin/), không có mới dò máy/PATH
let _ck = null; try { _ck = require('../nova-cookies'); } catch (_) {}
let _yt = null; try { _yt = require('../nova-yt'); } catch (_) {}

function run(args, timeoutMs = 150000) {
  return new Promise((res, rej) => {
    const ps = spawn(YTDLP, args, { windowsHide: true }); let o = '', e = '';
    const t = setTimeout(() => { try { ps.kill('SIGKILL'); } catch (_) {} rej(new Error('yt-dlp timeout')); }, timeoutMs);
    ps.stdout.on('data', d => o += d); ps.stderr.on('data', d => e += d);
    ps.on('error', rej); ps.on('close', c => { clearTimeout(t); c === 0 ? res(o) : rej(new Error(e.split('\n').slice(-2).join(' '))); });
  });
}
// ── AI: ưu tiên ĐÚNG API người dùng đã cấu hình trong Cài đặt → API (kho nova-settings),
// gọi thẳng relay/nhà cung cấp. CLI bridge nội bộ chỉ còn là CHỖ LÙI (chưa cấu hình API
// hoặc API tạm lỗi) — không còn phụ thuộc đăng nhập Claude CLI như trước. ──
const _KHO = () => {
  try {
    const p = process.env.NOVA_SETTINGS || path.join(require('electron').app.getPath('userData'), 'nova-settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (_) { return {}; }
};
const _NHA_CC = {
  // relay tự nhập URL — bắt buộc có api_base_url + api_model (đúng kiểu đang cấu hình ở tab API)
  'openai-compatible': { kieu: 'oa', url: '', khoa: 'api_key', mac: '' },
  openai:     { kieu: 'oa', url: 'https://api.openai.com/v1/chat/completions',      khoa: 'api_key_openai',     mac: 'gpt-4o-mini' },
  openrouter: { kieu: 'oa', url: 'https://openrouter.ai/api/v1/chat/completions',   khoa: 'api_key_openrouter', mac: 'openai/gpt-4o-mini' },
  groq:       { kieu: 'oa', url: 'https://api.groq.com/openai/v1/chat/completions', khoa: 'api_key_groq',       mac: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  deepseek:   { kieu: 'oa', url: 'https://api.deepseek.com/chat/completions',       khoa: 'api_key_deepseek',   mac: 'deepseek-chat' },
  gemini:     { kieu: 'oa', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                khoa: 'api_key_gemini', mac: 'gemini-2.5-flash-lite' },
  anthropic:  { kieu: 'an', url: 'https://api.anthropic.com/v1/messages',           khoa: 'api_key_anthropic',  mac: 'claude-haiku-4.5' },
};
// Chuẩn hoá URL như tab Cài đặt của app: https://host → …/v1/chat/completions (đủ /v1 thì không thêm nữa).
function _oaUrl(base) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  b = b.replace(/([^:])\/{2,}/g, '$1/');
  if (/\/chat\/completions$/i.test(b)) return b;
  if (/\/v1$/i.test(b)) return b + '/chat/completions';
  return b + '/v1/chat/completions';
}
async function _goiApi(sys, content, kho) {
  // Relay có khi lỗi 5xx tạm thời hoặc chặn "duplicate request" (request cũ vẫn xử lý) —
  // thử tối đa 4 lần: 5xx backoff 2/5/8s; "duplicate" chờ 5s để xoá cửa sổ dedup, rồi gửi lại.
  let err;
  for (let i = 0; i < 4; i++) {
    try { return await _goiApiMot(sys, content, kho); }
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
async function _goiApiMot(sys, content, kho) {
  const nc = _NHA_CC[String(kho.api_provider || '').trim().toLowerCase()];
  if (!nc) return null;                                        // chưa cấu hình provider nào → lùi về bridge
  const goc = String(kho.api_base_url || '').trim();
  if (nc.kieu !== 'an' && !nc.url && !goc) return null;        // openai-compatible mà thiếu base URL
  // Ô key cho phép nhiều khoá (mỗi dòng một khoá) — chỉ lấy khoá dòng đầu, gửi nguyên xâu sẽ 401.
  let key = '';
  if (nc.khoa === 'api_key_gemini') {
    const flowKeys = kho.api_key_flow || [];
    key = (Array.isArray(flowKeys) ? flowKeys : [String(flowKeys)]).map(s => String(s).trim()).filter(Boolean)[0] || '';
  } else {
    key = String(kho[nc.khoa] || kho.api_key || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';
  }
  if (!key) return null;
  const model = String(kho.api_model || '').trim() || nc.mac;
  if (!model) return null;
  if (nc.kieu === 'an') {                                      // Anthropic native: system là tham số riêng
    const url = goc ? goc.replace(/\/+$/, '') + '/v1/messages' : nc.url;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, ...(sys ? { system: sys } : {}), messages: [{ role: 'user', content }] }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error && d.error.message) || ('HTTP ' + r.status));
    return ((d && d.content) || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  const url = goc ? _oaUrl(goc) : nc.url;                      // OpenAI-compatible: Bearer + /v1/chat/completions
  // stream:true — model reasoning (vd deepseek) nghĩ rất lâu (~80s) trước token đầu; non-stream bị
  // gateway cắt ở ~30s → 500, retry lại bị chặn "duplicate request". Stream giữ connection sống qua giai đoạn nghĩ.
  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 300000);        // trần 5 phút cho cả lượt gọi
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, stream: true, messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content }] }),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      let msg = 'HTTP ' + r.status;
      try { const j = JSON.parse(t); if (j && j.error) msg = typeof j.error === 'string' ? j.error : (j.error.message || msg); } catch (_) {}
      throw new Error(msg);
    }
    let acc = '', buf = '';                                     // buf: giữ dòng SSE dở giữa 2 chunk
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
// Claude/AI: 1) API đã cấu hình trong Cài đặt → gọi thẳng; 2) CLI bridge nội bộ làm chỗ lùi.
async function claude(sys, content, opts) {
  const khoGoc = _KHO() || {};
  const kho = Object.assign({}, khoGoc);
  // Ghi đè provider/model/baseUrl khi caller cần (vd SRT translate buộc Gemini làm mặc định).
  if (opts && typeof opts === 'object') {
    if (typeof opts.provider === 'string' && opts.provider.trim()) kho.api_provider = opts.provider.trim();
    if (typeof opts.model === 'string' && opts.model.trim()) kho.api_model = opts.model.trim();
    if (opts.baseUrl != null) kho.api_base_url = opts.baseUrl;
  }
  try {
    const r = await _goiApi(sys, content, kho);
    if (r != null && String(r).trim()) return r;
  } catch (e) {
    console.warn('[niche] API cấu hình lỗi, lùi về CLI bridge:', (e && e.message) || e);
  }
  // CLI bridge nội bộ app. App mới chạy bridge ở 8795 (xem cli-bridge-native.plain.js),
  // bản build cũ/nhánh khác có thể còn 8790 → thử cả hai.
  const candidates = ['http://127.0.0.1:8795/chat/completions', 'http://127.0.0.1:8790/chat/completions'];
  let lastErr;
  for (const url of candidates) {
    let r;
    try {
      r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'sonnet', messages: [{ role: 'system', content: sys }, { role: 'user', content }] })
      });
    } catch (e) {
      // Không kết nối được bridge trên port này → thử port còn lại (bản build cũ).
      lastErr = lastErr || new Error('cli-bridge không phản hồi (8795/8790). Mở Cài đặt → AI để đăng nhập Claude CLI.');
      continue;
    }
    // Bridge đã trả lời → KHÔNG fallback nữa, báo đúng lỗi thật để dễ chẩn đoán.
    if (!r.ok) {
      let detail = ''; try { detail = (await r.text()).slice(0, 300); } catch {}
      throw new Error('cli-bridge HTTP ' + r.status + (detail ? (': ' + detail) : ''));
    }
    const d = await r.json();
    if (d && d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || 'cli-bridge lỗi'));
    if (d && d.choices && d.choices[0]) return d.choices[0].message.content || '';
    return '';
  }
  throw lastErr || new Error('cli-bridge không phản hồi (8795/8790). Mở Cài đặt → AI để đăng nhập Claude CLI.');
}
function safeJson(txt, fallback) {
  try { return JSON.parse(txt); } catch (_) {}
  let s = String(txt || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('['), b = s.indexOf('{');
  const start = (a >= 0 && (b < 0 || a < b)) ? a : b;
  if (start >= 0) { const end = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}')); if (end > start) { try { return JSON.parse(s.slice(start, end + 1)); } catch (_) {} } }
  return fallback;
}
async function cookies() { return _ck ? await _ck.youtubeCookiesFile().catch(() => null) : null; }
function daysSince(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd || '')) return null;
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6) - 1, dd = +yyyymmdd.slice(6, 8);
  const d = Math.floor((Date.now() - new Date(y, m, dd).getTime()) / 86400000);
  return d >= 0 ? d : null;
}
const kfmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n | 0);

// ── POOL: chạy song song có giới hạn luồng ──
// Quét nhiều góc/candidates yt-dlp là các tiến trình ĐỘC LẬP → concurrency 2 giảm
// ~2x tổng thời gian mà không tạo burst request. Lỗi từng item để bên gọi tự gom
// (Luật 10: không nuốt ngầm trong helper chung).
async function pool(items, concurrency, fn) {
  const out = new Array(items.length); let next = 0;
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ── CACHE (memory + đĩa), TTL 6h, key = mod:seed(:extra) ──
// Sửa 3 điểm yếu cũ: (1) đĩa nạp 1 lần rồi giữ đồng bộ qua cacheSave, không đọc cả
// file mỗi miss; (2) prune entry hết hạn + trần CACHE_MAX entry khi save — file
// không phình vô hạn; (3) key nhận `extra` để kết quả khác tham số (vd count video
// scorecard) không đè nhầm cache của nhau.
const CACHE_TTL = 6 * 3600 * 1000;
const CACHE_MAX = 200;
const _mem = new Map();
let _disk = null;                       // cache đĩa — nạp 1 lần, cacheSave giữ đồng bộ
function cachePath() { const b = path.join(os.homedir(), '.nova'); try { fs.mkdirSync(b, { recursive: true }); } catch (_) {} return path.join(b, 'niche-cache.json'); }
function cacheLoad() { if (_disk) return _disk; try { _disk = JSON.parse(fs.readFileSync(cachePath(), 'utf8')) || {}; } catch (_) { _disk = {}; } return _disk; }
function cacheSave(obj) { _disk = obj; try { fs.writeFileSync(cachePath(), JSON.stringify(obj)); } catch (_) {} }
function cacheGet(k) {
  let e = _mem.get(k); if (!e) e = cacheLoad()[k];
  if (e && (Date.now() - e.t) < CACHE_TTL) return e.v; return null;
}
function cachePut(k, v) {
  const e = { t: Date.now(), v }; _mem.set(k, e);
  const disk = cacheLoad();
  const now = Date.now();
  for (const key of Object.keys(disk)) if (!disk[key] || now - (disk[key].t || 0) >= CACHE_TTL) delete disk[key];
  disk[k] = e;
  const keys = Object.keys(disk);
  if (keys.length > CACHE_MAX) keys.sort((a, b) => (disk[a].t || 0) - (disk[b].t || 0)).slice(0, keys.length - CACHE_MAX).forEach(x => delete disk[x]);
  cacheSave(disk);
}
async function cached(mod, seed, fresh, onProgress, producer, extra) {
  const k = mod + ':' + String(seed).toLowerCase().trim() + (extra != null ? ':' + String(extra) : '');
  if (!fresh) { const hit = cacheGet(k); if (hit) { onProgress(100, '(cache) Xong'); return { ...hit, fromCache: true }; } }
  const v = await producer();
  if (v && v.ok) cachePut(k, v);
  return v;
}

// Khám phá video theo từ khoá (yt-dlp FREE) → enrich (YT Data API nếu có key Nova).
// opts.sort === 'date' → sắp theo NGÀY ĐĂNG qua URL /results + sp=CAI%3D (yt-dlp đã
// XOÁ prefix ytsearchdate từ 2024 — dùng filter sp của chính trang tìm kiếm YouTube);
// mặc định giữ ytsearchN: (relevance) như cũ.
async function searchVideos(query, n = 20, onProgress = () => {}, opts = {}) {
  // nếu query rỗng → lấy trending thực sự từ YouTube
  let target;
  if (!query || !query.trim()) {
    target = 'https://www.youtube.com/feed/trending';
    // thêm tham số gl nếu có
    if (opts.gl && typeof opts.gl === 'string' && opts.gl.trim()) {
      target += (target.includes('?') ? '&' : '?') + 'gl=' + encodeURIComponent(opts.gl.trim());
    }
  } else {
    target = opts.sort === 'date'
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%3D`
      : `ytsearch${n}:${query}`;
    // thêm gl cho tìm kiếm nếu có
    if (opts.gl && typeof opts.gl === 'string' && opts.gl.trim()) {
      target += (target.includes('?') ? '&' : '?') + 'gl=' + encodeURIComponent(opts.gl.trim());
    }
  }
  onProgress(12, `Tìm "${query || 'trending'}" trên YouTube…`);
  const ck = await cookies();
  // Lấy luôn channel_url + channel_follower_count: tên kênh có dấu cách KHÔNG ghép được thành @handle,
  // và có sub từ yt-dlp thì tính được VPS ngay cả khi máy chưa có key YouTube API.
  const args = opts.sort === 'date' && query && query.trim()
    ? [target, '--playlist-end', String(n), '--no-warnings', '--print', '%(view_count)s\\t%(upload_date)s\\t%(duration)s\\t%(channel)s\\t%(channel_url)s\\t%(channel_follower_count)s\\t%(id)s\\t%(title)s']
    : [target, '--no-warnings', '--print', '%(view_count)s\\t%(upload_date)s\\t%(duration)s\\t%(channel)s\\t%(channel_url)s\\t%(channel_follower_count)s\\t%(id)s\\t%(title)s'];
  if (ck) args.push('--cookies', ck);
  const out = await run(args);
  let vids = out.trim().split('\n').filter(Boolean).map(l => {
    const [v, up, d, ch, chUrl, sub, id, ...t] = l.split('\t');
    const views = parseInt(v) || 0, days = daysSince(up);
    const subs = parseInt(sub) || 0;
    return { views, date: up || '', days, dur: parseInt(d) || 0, channel: (ch || '').trim(), channelUrl: /^https?:/i.test(chUrl || '') ? chUrl.trim() : '', id: (id || '').trim(), url: id ? 'https://youtu.be/' + id : '', title: (t.join('\t') || '').trim(), vel: days != null ? Math.round(views / Math.max(days, 1)) : 0, likes: 0, comments: 0, subs, engRate: 0, viewPerSub: subs ? +(views / subs).toFixed(2) : 0, demand: views };
  }).filter(x => x.title);
  // Enrich chính xác (like/comment/sub) qua YT Data API — key của Nova
  let enriched = false;
  if (_yt) {
    try {
      onProgress(42, 'Bổ sung like/comment/sub (YouTube API)…');
      const { key, map } = await _yt.enrich(vids.map(x => x.id));
      if (key) {
        enriched = true;
        vids.forEach(x => { const e = map[x.id]; if (e) { x.views = e.views || x.views; x.likes = e.likes; x.comments = e.comments; x.dur = e.dur || x.dur; x.days = e.days != null ? e.days : x.days; x.channel = e.channel || x.channel; x.subs = e.subs; x.vel = e.vel || x.vel; x.engRate = e.engRate; x.viewPerSub = e.viewPerSub; x.demand = e.demand; } });
      }
    } catch (_) {}
  }
  return { vids, enriched };
}

// ══════════════════════════════════════════════════════════════════
//  1b) HOT TOPICS v2 — sửa 3 điểm yếu của topics():
//      · quét NHIỀU GÓC (4 truy vấn) thay vì 1 → không chỉ thấy một mặt của ngách
//      · chấm bằng BỘI SỐ so với trung vị ngách thay vì view/ngày tuyệt đối → kênh to hết át kênh nhỏ
//      · tách HAI CỬA SỔ thời gian → "đang lên" không bị video bùng nổ 5 tháng trước đè
// ══════════════════════════════════════════════════════════════════
const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Sinh 3 biến thể truy vấn quanh seed (Claude, 1 lần gọi rẻ). Hỏng thì dùng biến thể mặc định.
async function sweepQueries(seed, onProgress = () => {}) {
  if (!seed || !seed.trim()) return [''];
  onProgress(6, 'Nghĩ các góc quét…');
  try {
    const raw = await claude(
      'Bạn là chuyên gia nghiên cứu ngách YouTube. CHỈ trả JSON mảng chuỗi, không giải thích.',
      `Ngách gốc: "${seed}".\nSinh 3 TRUY VẤN YouTube khác góc nhìn để quét cùng ngách này (đừng lặp lại từ gốc y hệt, mỗi cái nhắm 1 kiểu nội dung khác nhau).\nTrả JSON: ["…","…","…"]`);
    const arr = safeJson(raw, []);
    if (Array.isArray(arr) && arr.length) return [seed, ...arr.map(x => String(x || '').trim()).filter(Boolean)].slice(0, 4);
  } catch (_) {}
  return [seed, `bí ẩn ${seed}`, `${seed} ít ai biết`, `top ${seed}`];
}
module.exports = {
  run, _KHO, _goiApi, claude, safeJson, cookies, daysSince, kfmt,
  cached, searchVideos, median, sweepQueries, pool,
};
