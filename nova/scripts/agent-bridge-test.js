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

  console.log(fail === 0 ? 'ALL PASS' : fail + ' CASE(S) FAIL');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
