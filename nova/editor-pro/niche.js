// Tìm Ngách (Niche Finder) — nội dung đã tách sang ./niche/ (loi → kenh → thi-truong,
// gộp lại ở ./niche/index.js). File này giữ nguyên đường require cũ cho ipc-niche.js
// và các test: require("./niche") lẫn require("./niche.js") đều ra module như xưa.
module.exports = require('./niche/index.js');

if (require.main === module) {
  const { attentionMarkets, hotTopics, channelScorecard, similarChannels } = module.exports;
  const [, , cmd = 'topics', ...rest] = process.argv; const seed = rest.join(' ') || 'AI tools';
  const fns = { attentionMarkets, hotTopics, channelScorecard, similarChannels };
  (fns[cmd] || hotTopics)(seed, (p, m) => console.log(`${p}% ${m}`), { fresh: true }).then(r => console.log('\n' + JSON.stringify(r, null, 2).slice(0, 2500))).catch(e => console.log('ERR', String(e.message || e).slice(0, 200)));
}
