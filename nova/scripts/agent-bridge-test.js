// agent-bridge-test.js — kiểm định chính thức Agent Bridge (POST /agent/command).
// Chạy: npm run test:agent-bridge  (không cần Electron; chạy local server thật).
// Case "focus" test ở nhánh "chưa có cửa sổ" → phải trả lỗi lộ liễu AVS_AGENT_NO_WINDOW.
'use strict';
const http = require('http');
const path = require('path');
const state = require(path.join(__dirname, '..', 'main', 'state'));
const { startLocalServer } = require(path.join(__dirname, '..', 'main', 'server'));

function request(port, method, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : body;
    const req = http.request(
      { host: '127.0.0.1', port, path: '/agent/command', method,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
          catch (e) { resolve({ status: res.statusCode, text: buf }); }
        });
      }
    );
    req.on('error', reject);
    req.end(data);
  });
}

async function main() {
  await startLocalServer();
  const port = state.serverPort;
  console.log('local server port =', port);
  let fail = 0;
  const check = (name, cond, extra) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''));
    if (!cond) fail++;
  };

  const ping = await request(port, 'POST', JSON.stringify({ action: 'ping' }));
  check('ping → ok + danh sách action',
    ping.status === 200 && ping.json.ok === true && Array.isArray(ping.json.data.actions), ping.json);

  const status = await request(port, 'POST', JSON.stringify({ action: 'status' }));
  check('status → ok + serverPort trùng',
    status.status === 200 && status.json.ok === true && status.json.data.serverPort === port, status.json);

  const focus = await request(port, 'POST', JSON.stringify({ action: 'focus' }));
  check('focus khi chưa có cửa sổ → AVS_AGENT_NO_WINDOW (409)',
    focus.status === 409 && focus.json.error.code === 'AVS_AGENT_NO_WINDOW', focus.json);

  const unknown = await request(port, 'POST', JSON.stringify({ action: 'nuke' }));
  check('action lạ → AVS_AGENT_UNKNOWN_ACTION (400)',
    unknown.status === 400 && unknown.json.error.code === 'AVS_AGENT_UNKNOWN_ACTION', unknown.json);

  const bad = await request(port, 'POST', '{not json');
  check('JSON hỏng → AVS_AGENT_BAD_JSON (400)',
    bad.status === 400 && bad.json.error.code === 'AVS_AGENT_BAD_JSON', bad.json);

  const noAction = await request(port, 'POST', JSON.stringify({ params: {} }));
  check('thiếu action → AVS_AGENT_NO_ACTION (400)',
    noAction.status === 400 && noAction.json.error.code === 'AVS_AGENT_NO_ACTION', noAction.json);

  const getRes = await request(port, 'GET', '');
  check('GET → 405 AVS_AGENT_METHOD_NOT_ALLOWED',
    getRes.status === 405 && getRes.json.error.code === 'AVS_AGENT_METHOD_NOT_ALLOWED', getRes.json);

  // ── Browser agent (2026-09-15) — policy + lỗi lộ liễu KHÔNG cần Chrome/Electron ──
  const ba = require(path.join(__dirname, '..', 'flow-chrome', 'browser-agent'));
  check('browser-agent: allowlist host đúng (labs.google ✓ / youtube.com ✓ / evil.example ✗ / file: ✗)',
    ba.isHostAllowed('https://labs.google/fx/tools/flow') === true
    && ba.isHostAllowed('https://www.youtube.com/watch?v=x') === true
    && ba.isHostAllowed('https://evil.example.com') === false
    && ba.isHostAllowed('file:///C:/x') === false
    && ba.isHostAllowed('khong-phai-url') === false);

  const pingActions = ping.json.data.actions || [];
  check('ping liệt kê cả browser.*',
    ['browser.navigate', 'browser.eval', 'browser.screenshot', 'browser.record.start', 'browser.cancel']
      .every((a) => pingActions.includes(a)), pingActions);

  const denied = await request(port, 'POST', JSON.stringify({ action: 'browser.navigate', params: { url: 'https://evil.example.com' } }));
  check('browser.navigate host lạ → AVS_BROWSER_HOST_DENIED (409, chặn TRƯỚC khi đụng Chrome)',
    denied.status === 409 && denied.json.error.code === 'AVS_BROWSER_HOST_DENIED', denied.json);

  const nosess = await request(port, 'POST', JSON.stringify({ action: 'browser.navigate', params: { url: 'https://labs.google/fx/tools/flow' } }));
  check('browser.navigate host hợp lệ nhưng không có phiên Chrome → AVS_BROWSER_NO_SESSION (409)',
    nosess.status === 409 && nosess.json.error.code === 'AVS_BROWSER_NO_SESSION', nosess.json);

  const noEval = await request(port, 'POST', JSON.stringify({ action: 'browser.eval', params: { expression: '1+1' } }));
  check('browser.eval không có phiên Chrome → AVS_BROWSER_NO_SESSION (409)',
    noEval.status === 409 && noEval.json.error.code === 'AVS_BROWSER_NO_SESSION', noEval.json);

  const unknownBrowser = await request(port, 'POST', JSON.stringify({ action: 'browser.nhay-cua-so', params: {} }));
  check('browser.* lạ → AVS_AGENT_UNKNOWN_ACTION (400, không rơi vào browser-agent)',
    unknownBrowser.status === 400 && unknownBrowser.json.error.code === 'AVS_AGENT_UNKNOWN_ACTION', unknownBrowser.json);

  console.log(fail === 0 ? 'ALL PASS' : fail + ' CASE(S) FAIL');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
