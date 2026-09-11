const { analyzeCompetitor, topicThumbOutliers, thumbFromUrl } = require('./competitor');
function registerEditorProCompetitor(ipcMain) {
  // Phân tích đối thủ thông minh — GIỮ HỢP ĐỒNG dù renderer chưa gọi
  // (quyết định owner tại MEMORY 2026-09-11s: nâng cấp giữ kênh cho lúc wire).
  const ch = 'nova:analyzeCompetitor';
  try { ipcMain.removeHandler(ch); } catch (_) {}
  ipcMain.handle(ch, async (e, payload = {}) => {
    try {
      const channel = String(payload.channel || '').trim();
      if (!channel) return { ok: false, error: 'Thiếu link/kênh đối thủ' };
      const onProgress = (p, m) => { try { e.sender.send('nova:analyzeCompetitorProgress', { percent: p, message: m }); } catch (_) {} };
      return await analyzeCompetitor(channel, onProgress, Math.max(8, Math.min(30, Number(payload.count) || 20)));
    } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });
  // Thumbnail tham chiếu: tìm outlier theo chủ đề / lấy từ link video.
  const ch2 = 'nova:thumbOutliers';
  try { ipcMain.removeHandler(ch2); } catch (_) {}
  ipcMain.handle(ch2, async (e, payload = {}) => {
    try {
      const onProgress = (p, m) => { try { e.sender.send('nova:thumbOutliersProgress', { percent: p, message: m }); } catch (_) {} };
      return await topicThumbOutliers(String(payload.topic || ''), onProgress, Number(payload.count) || 40);
    } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });
  // 🔗 Thumbnail từ 1 link video
  const ch3 = 'nova:thumbFromUrl';
  try { ipcMain.removeHandler(ch3); } catch (_) {}
  ipcMain.handle(ch3, async (_e, payload = {}) => { try { return thumbFromUrl(payload && payload.url); } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 160) }; } });
  return [ch, ch2, ch3];
}
module.exports = { registerEditorProCompetitor };
