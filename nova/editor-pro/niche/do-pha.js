// ══════════════════════════════════════════════════════════════════
//  ⚡ ĐỘT PHÁ VIEW — "video/kênh nào nhảy view cao nhất?"
//  yt-dlp chỉ trả view Ở THỜI ĐIỂM quét (YouTube không cho lịch sử view miễn
//  phí) → muốn đo "nhảy bao nhiêu trong 24h" phải tự đo bằng 2 ẢNH CHỤP:
//  mỗi lần quét lưu snapshot view từng video vào ~/.nova/niche-snapshots.json,
//  lần quét sau so diff. Cửa sổ thời gian = khoảng cách 2 lần quét (hiển thị
//  trung thực). Cộng thêm truy vấn sắp theo NGÀY ĐĂNG (URL /results + sp=CAI%3D)
//  để bắt video vừa lên sóng — view của chúng là toàn bộ view tích luỹ từ lúc đăng.
//  KHÔNG dùng cache 6h như các ô khác: mỗi lần bấm là 1 phép đo mới.
// ══════════════════════════════════════════════════════════════════
const fs = require('fs'); const os = require('os'); const path = require('path');
const { claude, kfmt, median, searchVideos, pool } = require('./loi');

const SNAP_MAX_SEEDS = 20;             // theo dõi tối đa 20 ngách — mốc cũ nhất bị đẩy ra
const SNAP_MIN_GAP = 30 * 60 * 1000;   // mốc mới chỉ ghi khi cách mốc cũ ≥ 30 phút (bấm 2 lần liền không mất mốc 1h)

function snapPath() { const b = path.join(os.homedir(), '.nova'); try { fs.mkdirSync(b, { recursive: true }); } catch (_) {} return path.join(b, 'niche-snapshots.json'); }
function snapLoad() { try { return JSON.parse(fs.readFileSync(snapPath(), 'utf8')) || {}; } catch (_) { return {}; } }
function snapSave(o) { try { fs.writeFileSync(snapPath(), JSON.stringify(o)); } catch (_) {} }

async function viewSpikes(seed, onProgress = () => {}, opts = {}) {
  const seedKey = String(seed).toLowerCase().trim();
  const snaps = snapLoad();
  const prev = snaps[seedKey] || null;                    // mốc so chênh: { ts, vids: {id:{v,ch,t,d}} }
  onProgress(5, prev
    ? `Có mốc cũ cách ${Math.round((Date.now() - prev.ts) / 36e5 * 10) / 10}h — sẽ so diff…`
    : 'Lần đầu theo dõi ngách này — sẽ lưu mốc để lần sau so…');

  // 2 truy vấn độc lập: MỚI NHẤT (bắt video non) + PHỔ BIẾN (tập ổn định để đo delta).
  const jobs = [
    { q: String(seed), n: 25, sort: 'date', label: 'mới nhất' },
    { q: String(seed), n: 15, label: 'phổ biến' },
  ];
  const failedQueries = []; const byId = new Map(); let enriched = false; let done = 0;
  const results = await pool(jobs, 2, (j) => searchVideos(j.q, j.n, () => {}, { sort: j.sort })
    .then(r => ({ ok: true, r }))
    .catch(err => ({ ok: false, q: j.q, error: String((err && err.message) || err).slice(0, 140) }))
    .then(res => {
      done++;
      onProgress(10 + done * 30, res.ok ? `Quét góc "${j.label}"…` : `Góc "${j.label}" lỗi: ${res.error.slice(0, 60)}`);
      return res;
    }));
  for (const res of results) {
    if (!res.ok) { failedQueries.push({ q: res.q, error: res.error }); continue; }
    enriched = enriched || res.r.enriched;
    res.r.vids.forEach(v => { if (v.id && !byId.has(v.id)) byId.set(v.id, v); });
  }
  if (!byId.size) {
    const why = failedQueries.length ? ' — ' + failedQueries.map(f => f.error).join('; ').slice(0, 180) : '';
    throw new Error('Không tìm được video cho từ khoá này' + why);
  }

  // Diff từng video với mốc cũ; gom gain theo kênh (khoá = channel_url, ổn định hơn tên).
  const now = Date.now();
  const windowHours = prev ? Math.round((now - prev.ts) / 36e5 * 10) / 10 : null;
  let overlap = 0;
  const chGain = new Map();
  for (const v of byId.values()) {
    const old = prev && prev.vids && prev.vids[v.id];
    if (old) {
      overlap++;
      v.delta = v.views - (old.v || 0);
      v.deltaPct = old.v > 0 ? Math.round(v.delta / old.v * 100) : null;
      const key = v.channelUrl || v.channel || '?';
      const g = chGain.get(key) || { channel: v.channel, channelUrl: v.channelUrl, gained: 0, n: 0, best: null };
      g.gained += v.delta; g.n++;
      if (!g.best || v.delta > g.best.delta) g.best = v;
      chGain.set(key, g);
    } else { v.delta = null; v.deltaPct = null; }
  }

  // Lưu mốc MỚI — chỉ khi cách mốc cũ ≥ 30 phút, để mốc thật không bị bấm nhanh ghi đè.
  const baselineKept = !!(prev && (now - prev.ts) < SNAP_MIN_GAP);
  if (!baselineKept) {
    const vids = {};
    for (const v of byId.values()) vids[v.id] = { v: v.views, ch: v.channel, t: v.title, d: v.days };
    snaps[seedKey] = { ts: now, vids };
    const keys = Object.keys(snaps);
    if (keys.length > SNAP_MAX_SEEDS) keys.sort((a, b) => (snaps[a].ts || 0) - (snaps[b].ts || 0)).slice(0, keys.length - SNAP_MAX_SEEDS).forEach(x => delete snaps[x]);
    snapSave(snaps);
  }
  onProgress(75, 'Xếp hạng…');

  const movers = [...byId.values()].filter(v => v.delta != null).sort((a, b) => b.delta - a.delta).slice(0, 10)
    .map(v => ({ id: v.id, title: v.title, url: v.url, channel: v.channel, channelUrl: v.channelUrl, views: v.views, viewsFmt: kfmt(v.views), delta: v.delta, deltaFmt: (v.delta >= 0 ? '+' : '') + kfmt(v.delta), deltaPct: v.deltaPct, days: v.days }));
  // Mới lên sóng: đăng ≤ 2 ngày (upload_date chỉ chính xác tới NGÀY) và chưa có mốc để so.
  const newVideos = [...byId.values()].filter(v => v.days != null && v.days <= 1 && v.delta == null).sort((a, b) => b.views - a.views).slice(0, 8)
    .map(v => ({ id: v.id, title: v.title, url: v.url, channel: v.channel, channelUrl: v.channelUrl, views: v.views, viewsFmt: kfmt(v.views), days: v.days, vel: v.vel }));
  const channels = [...chGain.values()].filter(g => g.gained > 0).sort((a, b) => b.gained - a.gained).slice(0, 6)
    .map(g => ({ channel: g.channel, channelUrl: g.channelUrl, gained: g.gained, gainedFmt: '+' + kfmt(g.gained), videos: g.n, sample: g.best ? { title: g.best.title, url: g.best.url, deltaFmt: (g.best.delta >= 0 ? '+' : '') + kfmt(g.best.delta) } : null }));

  // ── MỐC CỦA CHÍNH YOUTUBE: NGÀY ĐĂNG (mọi "x256…" chỉ là bội số view tích luỹ,
  // KHÔNG có chiều thời gian). Bức tốc = view / số ngày tuổi → video ≤ 7 ngày có
  // bức tốc xN so với trung vị bức tốc video cũ (≥ 14 ngày) = đang bùng NGAY BÂY GIỜ,
  // có ngay từ LẦN QUÉT ĐẦU, không cần 2 ảnh chụp. Giới hạn: upload_date chỉ chính
  // xác tới NGÀY, video < 1 ngày tuổi bị ước lượng thấp.
  const oldVids = [...byId.values()].filter(v => v.days != null && v.days >= 14 && v.views > 0);
  const medVel = oldVids.length >= 3 ? Math.round(median(oldVids.map(v => v.vel))) : 0;
  const rockets = [...byId.values()].filter(v => v.days != null && v.days <= 7 && v.views >= 500)
    .sort((a, b) => b.vel - a.vel).slice(0, 10)
    .map(v => ({ id: v.id, title: v.title, url: v.url, channel: v.channel, channelUrl: v.channelUrl, views: v.views, viewsFmt: kfmt(v.views), days: v.days, vel: v.vel, velFmt: kfmt(v.vel) + '/ngày', xVel: medVel > 0 ? +(v.vel / medVel).toFixed(1) : null }));

  let analysis = ''; let analysisError = '';
  if (opts.analyze !== false && (movers.length || newVideos.length)) {
    onProgress(85, 'Claude đọc xu hướng…');
    try {
      const lines = [
        movers.length ? `NHẢY VIEW (so ${windowHours}h trước):\n${movers.slice(0, 6).map(v => `+${kfmt(v.delta)} (${v.deltaPct != null ? v.deltaPct + '%' : '?'}) · ${v.viewsFmt} view · ${v.title}`).join('\n')}` : '',
        rockets.length ? `BỨC TỐC THEO NGÀY ĐĂNG (view/ngày${medVel ? `, trung vị video cũ ${kfmt(medVel)}/ngày` : ''}):\n${rockets.slice(0, 6).map(v => `${v.velFmt}${v.xVel ? ` (x${v.xVel})` : ''} · ${v.viewsFmt} view · ${v.days} ngày tuổi · ${v.title}`).join('\n')}` : '',
        newVideos.length ? `VỪA LÊN SÓNG (≤ 2 ngày):\n${newVideos.slice(0, 6).map(v => `${v.viewsFmt} view · ${v.title} — ${v.channel}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
      analysis = await claude(
        'Bạn là chuyên gia nội dung YouTube, trả lời tiếng Việt, ngắn gọn.',
        `Ngách "${seed}". Dữ liệu đột phá view:\n\n${lines}\n\nViết 3-5 câu: nội dung/mô-típ gì đang bùng trong ngách này, và người làm faceless nên chen vào ngay bằng góc nào. Bám số liệu, không nói chung chung.`);
    } catch (err) { analysisError = String((err && err.message) || err).slice(0, 160); }
  }
  onProgress(100, 'Xong');
  return {
    ok: true, seed, enriched, scanned: byId.size, firstRun: !prev,
    prevScan: prev ? { ageHours: windowHours } : null, windowHours, overlap, baselineKept,
    videos: movers, newVideos, rockets, medVel, channels, failedQueries, analysis, analysisError,
  };
}

module.exports = { viewSpikes, snapLoad, snapSave, snapPath };
