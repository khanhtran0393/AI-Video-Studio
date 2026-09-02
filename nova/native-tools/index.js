/* ── native-tools/ — compose như flow-native/: ./render (renderVideo/cancelRender) + ./ffmpeg (ffmpegInfo/probeDur).
     Hợp đồng module.exports giữ nguyên { renderVideo, ffmpegInfo, cancelRender, probeDur } của .plain gốc. ── */
const { renderVideo, cancelRender } = require('./render');
const { ffmpegInfo, probeDur } = require('./ffmpeg');
module.exports = { renderVideo, ffmpegInfo, cancelRender, probeDur };
