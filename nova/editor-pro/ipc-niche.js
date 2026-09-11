// IPC cho Tìm Ngách (Niche Finder) — 7 module. Progress qua 'nova:nicheProgress'.
const N = require('./niche');
function registerEditorProNiche(ipcMain, opts = {}) {
  const chans = [];
  const on = (e) => (p, m) => { try { e.sender.send('nova:nicheProgress', { percent: p, message: m }); } catch (_) {} };
  const H = (ch, fn) => { try { ipcMain.removeHandler(ch); } catch (_) {} ipcMain.handle(ch, fn); chans.push(ch); };
  const wrap = (fn) => async (e, payload = {}) => {
    try { return await fn(e, payload); }
    catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 220) }; }
  };
  const seedOf = (p) => String((p && (p.seed || p.query || p.channel)) || '').trim();

  const opt = (p) => ({ fresh: !!p.fresh, gl: p.gl || '' });
  H('nova:niche:attention', wrap((e, p) => { const seed = seedOf(p) || ''; return N.attentionMarkets(seed, on(e), opt(p)); }));
  // ── 4 ô mới của tab Nghiên cứu Ngách ──
  H('nova:niche:hot', wrap((e, p) => { const seed = seedOf(p) || ''; return N.hotTopics(seed, on(e), opt(p)); }));
  H('nova:niche:scorecard', wrap((e, p) => { const u = String(p.channel || p.url || '').trim(); if (!u) return { ok: false, error: 'Nhập kênh đối thủ' }; return N.channelScorecard(u, on(e), { ...opt(p), count: p.count, analyze: false }); }));
  H('nova:niche:scorecard_ai', wrap((e, p) => N.channelScorecardAi(p)));
  H('nova:niche:similar', wrap((e, p) => { const u = String(p.channel || p.url || '').trim(); if (!u) return { ok: false, error: 'Nhập kênh gốc' }; return N.similarChannels(u, on(e), { ...opt(p), limit: p.limit }); }));
  H('nova:niche:bw', wrap((e, p) => N.bwScore(p, on(e))));
  // ⚡ Đột phá view — đo bằng 2 ảnh chụp (không cache, mỗi lần bấm là phép đo mới).
  H('nova:niche:spike', wrap((e, p) => { const seed = seedOf(p) || ''; return N.viewSpikes(seed, on(e), { analyze: false }); }));
  H('nova:niche:spike_ai', wrap((e, p) => N.viewSpikesAi(p)));
  // ── Bình luận, theo dõi, so sánh ──
  H('nova:niche:comments', wrap((e, p) => { if (!seedOf(p)) return { ok: false, error: 'Nhập từ khoá ngách' }; return N.commentMining(seedOf(p), on(e), opt(p)); }));
  // ('nova:niche:watchlist' đã gỡ — renderer không bao giờ gọi; MEMORY 2026-09-11q)
  H('nova:niche:compare', wrap((e, p) => {
    const channels = p.channels || [];
    if (!Array.isArray(channels) || !channels.length) return { ok: false, error: 'Cần danh sách kênh (mảng)' };
    return N.compareChannels(channels, on(e), { ...opt(p), count: p.count });
  }));
  // Pain mining
  H('nova:niche:pain', wrap((e, p) => {
    const seed = seedOf(p) || '';
    return N.painMining(seed, on(e), opt(p));
  }));
  // Trend forecast
  H('nova:niche:forecast', wrap((e, p) => {
    const seed = seedOf(p) || '';
    return N.trendForecast(seed, on(e), opt(p));
  }));
  // Keyword clusters
  H('nova:niche:keywords', wrap((e, p) => {
    const seed = seedOf(p) || '';
    return N.keywordClusters(seed, on(e), opt(p));
  }));
  // Top video breakdown
  H('nova:niche:breakdown', wrap((e, p) => {
    const seed = seedOf(p) || '';
    return N.topVideoBreakdown(seed, on(e), opt(p));
  }));
  return chans;
}
module.exports = { registerEditorProNiche };