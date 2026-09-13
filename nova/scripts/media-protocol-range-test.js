'use strict';
/* ============================================================
   media-protocol-range-test.js — kiểm định handler scheme `avs-media://`
   ------------------------------------------------------------
   Vì sao có test này: thẻ <video> chỉ tua/xem trước được khi server trả
   206 Partial Content. Electron gọi handler với `req.headers` LÀ object
   Headers (Fetch API) — KHÔNG có property `.range`. Code đọc
   `req.headers.range` sẽ luôn nhận undefined → mọi request bị trả 200
   nguyên file, <video> mất seek và treo khung đen với MP4 có moov ở cuối.
   Test dựng handler THẬT (electron giả lập qua Module._load) rồi assert
   hành vi 200/206/416/400/404 — bắt đúng hồi quy đó bằng code.
   Chạy: npm run test:media-protocol
   ============================================================ */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

/* Nạp module main-process với electron giả lập: bắt lại handler mà
   installMediaProtocolHandler() gắn vào protocol.handle(scheme, h). */
let captured = null;
const electronStub = {
  protocol: {
    registerSchemesAsPrivileged: () => {},
    handle: (scheme, h) => { captured = { scheme, h }; },
  },
};
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  return request === 'electron' ? electronStub : originalLoad.call(this, request, ...rest);
};
let MP;
try { MP = require('../main/media-protocol.js'); }
finally { Module._load = originalLoad; }
MP.installMediaProtocolHandler();
assert(captured, 'installMediaProtocolHandler phải gọi protocol.handle');
assert.strictEqual(captured.scheme, 'avs-media', 'đúng scheme được đăng ký');
const handler = captured.h;

const urlOf = (p) => MP.SCHEME + '://m/' + encodeURIComponent(p);
/* req.headers là Headers thật — giống hệt cách Electron gọi handler */
const req = (u, range) => handler({ url: u, headers: range == null ? new Headers() : new Headers({ range }) });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avs-proto-'));
/* tên file cố tình có khoảng trắng + # + %: đường dẫn thật của user hay gặp */
const file = path.join(tmp, 'x #1 100%.mp4');
const BYTES = Buffer.alloc(1024);
for (let i = 0; i < BYTES.length; i++) BYTES[i] = (i * 7) % 251;
fs.writeFileSync(file, BYTES);

async function main() {
  /* 1) Không Range → 200 + đủ file + Accept-Ranges (để <video> biết là seek được) */
  const full = await req(urlOf(file));
  assert.strictEqual(full.status, 200, 'đọc cả file phải 200');
  assert.strictEqual(Buffer.from(await full.arrayBuffer()).length, BYTES.length, '200 phải trả hết file');
  assert.strictEqual(full.headers.get('accept-ranges'), 'bytes', 'phải quảng bá Accept-Ranges');
  assert.strictEqual(full.headers.get('content-type'), 'video/mp4', 'MIME theo phần mở rộng');

  /* 2) Range [10..19] → 206 + đúng 10 byte (đây chính là chỗ req.headers.range giết preview) */
  const mid = await req(urlOf(file), 'bytes=10-19');
  assert.strictEqual(mid.status, 206, 'Range phải ra 206 — ra 200 nghĩa là header Range bị đọc mất');
  assert.deepStrictEqual(Buffer.from(await mid.arrayBuffer()), BYTES.subarray(10, 20), 'đúng thân 10 byte');
  assert.strictEqual(mid.headers.get('content-range'), 'bytes 10-19/' + BYTES.length);
  assert.strictEqual(mid.headers.get('content-length'), '10');

  /* 3) Mở đầu "bytes=1000-" — kiểu Chromium nhảy tới moov ở CUỐI file mp4 không faststart */
  const tail = await req(urlOf(file), 'bytes=1000-');
  assert.strictEqual(tail.status, 206, 'range mở đầu phải 206');
  assert.deepStrictEqual(Buffer.from(await tail.arrayBuffer()), BYTES.subarray(1000), 'đúng phần đuôi');

  /* 4) Suffix "bytes=-100" — 100 byte cuối */
  const suf = await req(urlOf(file), 'bytes=-100');
  assert.strictEqual(suf.status, 206);
  assert.deepStrictEqual(Buffer.from(await suf.arrayBuffer()), BYTES.subarray(BYTES.length - 100));

  /* 5) Range ngoài cỡ → 416 lộ liễu, không trả rỗng ngầm (Luật 10) */
  const bad = await req(urlOf(file), 'bytes=5000-6000');
  assert.strictEqual(bad.status, 416, 'range vượt cỡ phải 416');
  assert(/\*\/1024/.test(bad.headers.get('content-range') || ''), '416 phải khai báo cỡ thật');

  /* 6) Sai scheme → 400 + mã lỗi; thiếu file → 404 + đường dẫn */
  const wrongProto = await req('http://localhost/x.mp4');
  assert.strictEqual(wrongProto.status, 400);
  assert(/FFX_PROTO_URL/.test(await wrongProto.text()), '400 phải nêu FFX_PROTO_URL');
  const missing = await req(urlOf(path.join(tmp, 'missing.mp4')));
  assert.strictEqual(missing.status, 404);
  assert(/FFX_PROTO_NOT_FOUND/.test(await missing.text()), '404 phải nêu FFX_PROTO_NOT_FOUND');

  console.log('media-protocol Range tests: PASS (200 full / 206 mid+tail+suffix / 416 / 400 / 404)');
}

main()
  .catch((e) => { console.error('media-protocol Range test FAIL → ' + (e && e.message)); process.exitCode = 1; })
  .finally(() => fs.rmSync(tmp, { recursive: true, force: true }));
