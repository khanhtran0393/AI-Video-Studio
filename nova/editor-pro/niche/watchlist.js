const { snapLoad, snapSave, viewSpikes } = require('./do-pha');

function watchlistAdd(seed) {
  const data = snapLoad();
  if (!data.watchlist) data.watchlist = [];
  const key = seed.toLowerCase().trim();
  if (!data.watchlist.includes(key)) data.watchlist.push(key);
  snapSave(data);
  return data.watchlist;
}

function watchlistRemove(seed) {
  const data = snapLoad();
  if (!data.watchlist) data.watchlist = [];
  const key = seed.toLowerCase().trim();
  data.watchlist = data.watchlist.filter(s => s !== key);
  snapSave(data);
  return data.watchlist;
}

function watchlistList() {
  const data = snapLoad();
  return data.watchlist || [];
}

async function watchlistTick(onProgress = () => {}) {
  const list = watchlistList();
  if (!list.length) throw new Error('Danh sách theo dõi trống.');
  const results = [];
  for (let i = 0; i < list.length; i++) {
    const seed = list[i];
    try {
      const r = await viewSpikes(seed, (p, m) => onProgress(p, `[${i+1}/${list.length}] ${seed}: ${m}`), { analyze: true });
      results.push({ seed, ok: true, data: r });
    } catch (e) {
      results.push({ seed, ok: false, error: e.message });
    }
  }
  return results;
}

module.exports = { watchlistAdd, watchlistRemove, watchlistList, watchlistTick };