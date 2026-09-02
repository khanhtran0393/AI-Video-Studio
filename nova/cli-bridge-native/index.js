/* ── cli-bridge-native/index — startAll/stopAll (claude:8795 + codex:8796). Hợp đồng { startAll, stopAll } không đổi. ── */
const { createBridge } = require('./bridge');

let started = false;
let servers = [];
function startAll() {
  if (started) return servers;
  started = true;
  try { servers.push(...createBridge('claude', 8795)); } catch (e) { console.warn('[cli-bridge claude]', e.message); }
  try { servers.push(...createBridge('codex', 8796)); } catch (e) { console.warn('[cli-bridge codex]', e.message); }
  return servers;
}

function stopAll() {
  started = false;
  const owned = servers;
  servers = [];
  for (const server of owned) {
    try { server.close(); } catch (_) {}
    try { server.closeAllConnections && server.closeAllConnections(); } catch (_) {}
  }
}
module.exports = { startAll, stopAll };
