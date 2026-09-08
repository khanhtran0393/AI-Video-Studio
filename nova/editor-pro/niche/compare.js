const { channelScorecard } = require('./kenh');

async function compareChannels(channels, onProgress = () => {}, opts = {}) {
  if (!Array.isArray(channels) || !channels.length) throw new Error('Cần danh sách kênh.');
  const results = await Promise.all(channels.map(async (ch, idx) => {
    try {
      const card = await channelScorecard(ch, (p, m) => onProgress(p, `[${idx+1}/${channels.length}] ${m}`), { fresh: opts.fresh, count: opts.count || 20 });
      return { channel: ch, ok: true, card };
    } catch (e) {
      return { channel: ch, ok: false, error: e.message };
    }
  }));
  results.sort((a, b) => {
    if (!a.ok) return 1;
    if (!b.ok) return -1;
    return (b.card.health || 0) - (a.card.health || 0);
  });
  return results;
}

module.exports = { compareChannels };