// Tìm Ngách (Niche Finder) — điểm vào sau khi tách niche.js thành thư mục niche/.
// Giữ NGUYÊN hợp đồng module.exports của file cũ để ipc-niche.js và test không đổi.
const loi = require('./loi');
const { channelScorecard, similarChannels } = require('./kenh');
const { hotTopics, bwScore, attentionMarkets } = require('./thi-truong');
module.exports = {
  attentionMarkets,
  hotTopics, channelScorecard, similarChannels, bwScore,
  claude: loi.claude, _goiApi: loi._goiApi, _KHO: loi._KHO,   // xuất ra để test trực tiếp đường API cấu hình
};
