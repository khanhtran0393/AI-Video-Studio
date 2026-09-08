'use strict';
/* ============================================================
   UTILITY PROCESS — hash worker test
   ------------------------------------------------------------
   Chạy standalone bằng node (KHÔNG cần Electron runtime):
   - Test handleHashBatch thuần (unit, không fork process).
   - Test toBuffer với mọi input type được hỗ trợ.
   - Test isAvailable() trả false (không crash, không Electron).
   - Test hashBuffers() trả kết quả đúng qua fallback in-process,
     đính unavailable:true (degrade có chủ ý).

   Khi muốn test fork THẬT, cần chạy qua electron runtime:
     electron nova/utility-process/__test__/hash-worker.test.js
   ============================================================ */

const assert = require('assert');
const { handleHashBatch, toBuffer } = require('../hash-worker/worker');
const hashWorker = require('../hash-worker');

let pass = 0;
let fail = 0;
function it(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => { pass++; console.log('  ✓ ' + name); })
    .catch((err) => { fail++; console.error('  ✗ ' + name + ': ' + (err && err.message || err)); });
}

async function main() {
  console.log('hash-worker test:');

  await it('toBuffer: Buffer passthrough', () => {
    const b = Buffer.from('hello');
    assert.strictEqual(toBuffer(b), b);
  });

  await it('toBuffer: Uint8Array → Buffer', () => {
    const u = new Uint8Array([104, 105]);
    const b = toBuffer(u);
    assert.ok(Buffer.isBuffer(b));
    assert.strictEqual(b.toString('utf8'), 'hi');
  });

  await it('toBuffer: ArrayBuffer → Buffer', () => {
    const ab = new ArrayBuffer(3);
    new Uint8Array(ab).set([1, 2, 3]);
    const b = toBuffer(ab);
    assert.ok(Buffer.isBuffer(b));
    assert.strictEqual(b[0], 1); assert.strictEqual(b[2], 3);
  });

  await it('toBuffer: string utf8', () => {
    const b = toBuffer('xin chào');
    assert.ok(Buffer.isBuffer(b));
    assert.strictEqual(b.toString('utf8'), 'xin chào');
  });

  await it('toBuffer: null → empty Buffer', () => {
    const b = toBuffer(null);
    assert.ok(Buffer.isBuffer(b));
    assert.strictEqual(b.length, 0);
  });

  await it('toBuffer: number → throws UP_INVALID_PAYLOAD', () => {
    let code = null;
    try { toBuffer(123); } catch (e) { code = e.code; }
    assert.strictEqual(code, 'UP_INVALID_PAYLOAD');
  });

  await it('handleHashBatch: 2 item, hash SHA-1 16 hex', () => {
    const r = handleHashBatch({
      type: 'hash-batch', jobId: 'j1',
      items: [
        { id: 'a', data: Buffer.from('alpha') },
        { id: 'b', data: Buffer.from('beta-beta') },
      ],
    });
    assert.strictEqual(r.type, 'hash-batch-result');
    assert.strictEqual(r.jobId, 'j1');
    assert.strictEqual(r.hashes.length, 2);
    assert.strictEqual(r.hashes[0].id, 'a');
    assert.strictEqual(r.hashes[0].hash.length, 16);
    // Hash tự tính bằng crypto cùng slice — đảm bảo handleHashBatch trả đúng.
    const crypto = require('crypto');
    const want0 = crypto.createHash('sha1').update('alpha').digest('hex').slice(0, 16);
    const want1 = crypto.createHash('sha1').update('beta-beta').digest('hex').slice(0, 16);
    assert.strictEqual(r.hashes[0].hash, want0);
    assert.strictEqual(r.hashes[1].hash, want1);
  });

  await it('handleHashBatch: empty items → empty hashes', () => {
    const r = handleHashBatch({ type: 'hash-batch', jobId: 'j2', items: [] });
    assert.deepStrictEqual(r.hashes, []);
  });

  await it('hashBuffers: in-process fallback (no Electron) trả hash + unavailable flag', async () => {
    const items = [
      { id: 'x', data: Buffer.from('test data') },
      { id: 'y', data: 'string input' },
    ];
    const r = await hashWorker.hashBuffers(items);
    assert.strictEqual(r.length, 2);
    // Không có electron → fallback in-process → unavailable:true
    if (hashWorker.isAvailable()) {
      // Trường hợp hiếm: chạy trong electron runtime
      assert.strictEqual(r[0].unavailable, undefined);
    } else {
      assert.strictEqual(r[0].unavailable, true);
      assert.ok(r[0].reason, 'reason phải có');
      assert.strictEqual(r[0].hash.length, 16);
    }
  });

  await it('hashBuffers: empty input → empty output', async () => {
    const r = await hashWorker.hashBuffers([]);
    assert.deepStrictEqual(r, []);
  });

  await it('status(): có manager hay không tùy runtime', () => {
    const s = hashWorker.status();
    assert.ok(typeof s.available === 'boolean');
    if (!s.available) assert.ok(typeof s.reason === 'string');
  });

  await it('hashBuffers: hash phải ổn định cho cùng input', async () => {
    const items = [{ id: 'k', data: Buffer.from('stable input') }];
    const r1 = await hashWorker.hashBuffers(items);
    const r2 = await hashWorker.hashBuffers(items);
    assert.strictEqual(r1[0].hash, r2[0].hash);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  // Shutdown dọn process con nếu có.
  try { hashWorker.shutdown(); } catch (_) { /* */ }
  if (fail > 0) process.exit(1);
}

main().catch((err) => { console.error('test crashed:', err); process.exit(1); });
