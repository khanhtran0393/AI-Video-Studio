// Tìm Ngách (Niche Finder) — điểm vào sau khi tách niche.js thành thư mục niche/.
// Giữ NGUYÊN hợp đồng module.exports của file cũ để ipc-niche.js và test không đổi.
const loi = require('./loi');
const { channelScorecard, similarChannels } = require('./kenh');
const { hotTopics, bwScore, attentionMarkets } = require('./thi-truong');
const { viewSpikes } = require('./do-pha');
const { commentMining } = require('./binh-luan');
const { watchlistAdd, watchlistRemove, watchlistList, watchlistTick } = require('./watchlist');
const { compareChannels } = require('./compare');
const { painMining } = require('./pain');
const { trendForecast } = require('./forecast');
const { keywordClusters } = require('./keywords');
const { topVideoBreakdown } = require('./breakdown');
module.exports = {
  attentionMarkets,
  hotTopics, channelScorecard, similarChannels, bwScore, viewSpikes,
  claude: loi.claude, _goiApi: loi._goiApi, _KHO: loi._KHO,   // xuất ra để test trực tiếp đường API cấu hình
  commentMining,
  watchlistAdd, watchlistRemove, watchlistList, watchlistTick,
  compareChannels,
  painMining,
  trendForecast,
  keywordClusters,
  topVideoBreakdown,
};