const { viewSpikes } = require('./do-pha');
const { cached } = require('./loi');

async function trendForecast(seed, onProgress = () => {}, opts = {}) {
  return cached('forecast', seed, opts.fresh, onProgress, async () => {
    const spikeData = await viewSpikes(seed, onProgress, { analyze: true, fresh: opts.fresh });
    if (!spikeData.ok) throw new Error(spikeData.error || 'Không thể lấy dữ liệu đột phá');
    const rockets = spikeData.rockets || [];
    const movers = spikeData.videos || [];
    const medVel = spikeData.medVel || 0;
    const avgRocketVel = rockets.length ? rockets.reduce((s, v) => s + (v.vel || 0), 0) / rockets.length : 0;
    const trendScore = medVel > 0 ? avgRocketVel / medVel : 0;
    const status = trendScore > 2 ? 'tăng trưởng mạnh' : trendScore > 1.2 ? 'đang tăng' : trendScore > 0.8 ? 'ổn định' : 'bão hoà';
    const recommendation = status === 'tăng trưởng mạnh' ? 'Nên vào ngay, tập trung vào các video bùng nổ.' : 
                           status === 'đang tăng' ? 'Còn cơ hội, nhưng cần nhanh.' : 
                           status === 'ổn định' ? 'Có thể duy trì, nhưng cần đổi mới.' : 'Không nên vào, ngách đã bão hoà.';
    const forecast = `Dựa trên ${rockets.length} video bứt tốc, ngách này đang ${status}. ${recommendation}`;
    return { ok: true, seed, status, recommendation, forecast, medVel, avgRocketVel, rocketsCount: rockets.length, moversCount: movers.length, spikeData };
  });
}
module.exports = { trendForecast };