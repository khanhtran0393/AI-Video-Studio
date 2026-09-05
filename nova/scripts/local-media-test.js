'use strict';
/* Test nhanh route /local-media của nova/main/server.js — chạy ngoài Electron. */
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return {};   // đề phòng module nào đó cần electron
  return origLoad.apply(this, arguments);
};

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const server = require('../main/server.js');

function get(port, p, range) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, headers: range ? { Range: range } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

(async () => {
  await server.startLocalServer();
  const port = require('../main/state.js').serverPort;

  // tạo file PNG nhỏ (1x1) + file .txt để test chặn
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-lm-'));
  const pngPath = path.join(dir, 'a.png');
  fs.writeFileSync(pngPath, Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d4944415478da63f8cfc0f01f00050102008c9a1fd1' +
    '0000000049454e44ae426082', 'hex'));
  const txtPath = path.join(dir, 'b.txt');
  fs.writeFileSync(txtPath, 'not media');

  const enc = encodeURIComponent(pngPath);
  let fails = 0;
  const check = (name, cond) => { console.log((cond ? 'PASS: ' : 'FAIL: ') + name); if (!cond) fails++; };

  const r1 = await get(port, '/local-media?p=' + enc);
  check('200 + dung mime PNG', r1.status === 200 && r1.headers['content-type'] === 'image/png' && r1.body.length === fs.statSync(pngPath).size);

  const r2 = await get(port, '/local-media?p=' + enc, 'bytes=0-10');
  check('206 range 0-10 (11 bytes)', r2.status === 206 && r2.body.length === 11 && r2.headers['content-range'] === 'bytes 0-10/' + r1.body.length);

  const r3 = await get(port, '/local-media?p=' + enc, 'bytes=5-');
  check('206 open-ended range', r3.status === 206 && r3.body.length === r1.body.length - 5);

  const r4 = await get(port, '/local-media?p=' + encodeURIComponent(txtPath));
  check('404 voi duoi khong phai media (.txt)', r4.status === 404);

  const r5 = await get(port, '/local-media?p=' + encodeURIComponent('relative/path.png'));
  check('400 voi duong dan tuong doi', r5.status === 400);

  const r6 = await get(port, '/local-media?p=' + encodeURIComponent(path.join(dir, 'khong-co.png')));
  check('404 voi file khong ton tai', r6.status === 404);

  console.log(fails ? 'LOCAL-MEDIA TEST: ' + fails + ' FAIL' : 'LOCAL-MEDIA TEST OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });