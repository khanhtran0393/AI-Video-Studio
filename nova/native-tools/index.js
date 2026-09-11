/* ── native-tools/ — compose như flow-native/: ./render (renderVideo/cancelRender) + ./ffmpeg (ffmpegInfo/probeDur/trimVideo).
     Hợp đồng module.exports giữ nguyên { renderVideo, ffmpegInfo, cancelRender, probeDur } của .plain gốc
     (thêm trimVideo ở CUỐI — chỉ mở rộng, không đổi tên/thứ tự key cũ — Luật 1). ── */
const { renderVideo, cancelRender } = require('./render');
const { ffmpegInfo, probeDur, trimVideo } = require('./ffmpeg');
module.exports = { renderVideo, ffmpegInfo, cancelRender, probeDur, trimVideo };
