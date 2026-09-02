/* ── voice-native/index — compose ./paths + ./server; hợp đồng 10 tên của .plain gốc không đổi
     (scripts/voice-contract-test.js assert 'LEGACY_PORT, resolveUrl' ở export list này). ── */
const { setRoot, probe } = require('./paths');
const { start, status, stop, onLog, PORT, URL, LEGACY_PORT, resolveUrl } = require('./server');
module.exports = { start, status, stop, onLog, setRoot, probe, PORT, URL, LEGACY_PORT, resolveUrl };
