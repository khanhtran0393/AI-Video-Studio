'use strict';
/**
 * imzic-core-test.js — kiểm định HÀM THUẦN của IPC I-MZic.
 * Nạp NGUYÊN VĂN nova/main/ipc/imzic-helpers.js (pure Node — không cần Electron)
 * rồi test đúng hàng rào bằng code:
 *   1. safeExt          — đuôi file an toàn, fallback khi đuôi thiếu/quá dài
 *   2. safeBaseName     — dọn path traversal + ký tự cấm Windows (tự-lưu hàng chờ)
 *   3. atomicCopyFile   — ghi đích NGUYÊN TỬ qua ".part" + rename (D2); lỗi ném lộ,
 *                         không để lại rác .part (Luật 10)
 *   4. diskFreeBytes / assertDiskSpace — preflight dung lượng, IMZIC_DISK_FULL (D1)
 *   5. payloadAudioBytes — bytes/ArrayBuffer/Buffer/audioPath/thiếu (D1)
 *   6. sweepStaleImzicTmp — fixture THẬT trong os.tmpdir(): dir cũ >24h bị xoá,
 *                         dir mới giữ, dir không khớp tiền tố không bị đụng (A3)
 *   7. killProcessTree  — spawn process THẬT rồi giết cả cây (D4, taskkill /T /F)
 * Thoát 0 = PASS hết; thoát 1 = FAIL (in đúng nhóm + lý do, không nuốt lỗi).
 * Chạy: npm run test:imzic
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const H = require('../main/ipc/imzic-helpers.js');

// Ký tự backslash lấy gián tiếp để chính file test này không chứa escape khó đọc.
const BS = String.fromCharCode(92);
// Bộ ký tự cấm mà safeBaseName phải dọn (đúng lớp ký tự trong helper).
const FORBIDDEN = BS + '/:*?' + String.fromCharCode(34) + '<>|';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, fn) {
  try { fn(); pass++; console.log('  PASS ' + name); }
  catch (err) {
    fail++;
    const msg = (err && err.message) ? err.message : String(err);
    failures.push(name + ' :: ' + msg);
    console.error('  FAIL ' + name + ' :: ' + msg);
  }
}

async function okAsync(name, fn) {
  try { await fn(); pass++; console.log('  PASS ' + name); }
  catch (err) {
    fail++;
    const msg = (err && err.message) ? err.message : String(err);
    failures.push(name + ' :: ' + msg);
    console.error('  FAIL ' + name + ' :: ' + msg);
  }
}

function assertCleanName(r) {
  assert.ok(typeof r === 'string' && r.length > 0, 'ten ket qua rong');
  for (const ch of FORBIDDEN) {
    assert.ok(!r.includes(ch), 'van con ky tu cam "' + ch + '" trong ket qua: "' + r + '"');
  }
}

// ---- nhóm 1: safeExt ----
function testSafeExt() {
  assert.strictEqual(H.safeExt('bai hat.MP3', '.bin'), '.MP3');
  assert.strictEqual(H.safeExt('bai hat.mp3', '.bin'), '.mp3');
  assert.strictEqual(H.safeExt('archive.tar.gz', '.bin'), '.gz'); // lấy đuôi CUỐI
  assert.strictEqual(H.safeExt('khong duoi', '.bin'), '.bin');    // thiếu đuôi → fallback
  assert.strictEqual(H.safeExt('file.toolongextension', '.bin'), '.bin'); // đuôi >8 ký tự → chối
  assert.strictEqual(H.safeExt('', '.bin'), '.bin');
  assert.strictEqual(H.safeExt(null, '.bin'), '.bin');
  assert.strictEqual(H.safeExt('a.mp3'), '.mp3');
  assert.strictEqual(H.safeExt('khong duoi'), undefined); // không fallback → undefined, không bịa đuôi
}

// ---- nhóm 2: safeBaseName ----
function testSafeBaseName() {
  // path traversal: thành phần ".." và dấu phân cách phải bị dọn hết
  const traversal = ['..', '..', 'evil.mp3'].join(path.sep);
  assertCleanName(H.safeBaseName(traversal, 'fb'));
  // ký tự cấm Windows
  const banned = 'a:b*c?' + String.fromCharCode(34) + '<>|d.mp3';
  assertCleanName(H.safeBaseName(banned, 'fb'));
  // đường dẫn lồng nhau
  const nested = ['a', 'b', 'c.mp3'].join(path.sep);
  assertCleanName(H.safeBaseName(nested, 'fb'));
  // rỗng / whitespace / null → fallback
  assert.strictEqual(H.safeBaseName('   ', 'fallback.mp3'), 'fallback.mp3');
  assert.strictEqual(H.safeBaseName('', 'fallback.mp3'), 'fallback.mp3');
  assert.strictEqual(H.safeBaseName(null, 'fallback.mp3'), 'fallback.mp3');
  // tên sạch giữ nguyên
  assert.strictEqual(H.safeBaseName('ten dep trai.mp3', 'fb'), 'ten dep trai.mp3');
}

// ---- nhóm 3: atomicCopyFile (D2) ----
function testAtomicCopyFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imzic-core-test-copy-'));
  try {
    const src = path.join(dir, 'src.bin');
    const dst = path.join(dir, 'dst.mp4');
    // nội dung 512KB theo mẫu xác định (không phụ thuộc random)
    const buf1 = Buffer.alloc(512 * 1024);
    for (let i = 0; i < buf1.length; i += 4) buf1.writeUInt32LE((i * 2654435761) >>> 0, i);
    fs.writeFileSync(src, buf1);
    H.atomicCopyFile(src, dst);
    assert.ok(fs.existsSync(dst), 'file dich ton tai sau copy');
    assert.ok(Buffer.compare(fs.readFileSync(src), fs.readFileSync(dst)) === 0, 'noi dung copy khop nguyen');
    assert.ok(fs.readdirSync(dir).every(function (f) { return !f.endsWith('.part'); }),
      'thanh cong khong de rac .part');
    // ghi đè file đích đã có (kịch bản xuất lại lần 2)
    const buf2 = Buffer.alloc(64, 7);
    fs.writeFileSync(src, buf2);
    H.atomicCopyFile(src, dst);
    assert.ok(Buffer.compare(fs.readFileSync(src), fs.readFileSync(dst)) === 0, 'ghi de dich cu dung');
    // nguồn thiếu → ném LỘ (không nuốt), không tạo đích, không rác .part
    const dst2 = path.join(dir, 'dst2.mp4');
    assert.throws(function () { H.atomicCopyFile(path.join(dir, 'missing.bin'), dst2); });
    assert.ok(!fs.existsSync(dst2), 'nguon thieu khong tao dich');
    assert.ok(fs.readdirSync(dir).every(function (f) { return !f.endsWith('.part'); }),
      'nguon thieu khong de rac .part');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- nhóm 4: diskFreeBytes / assertDiskSpace (D1) ----
function testDiskSpace() {
  const free = H.diskFreeBytes(os.tmpdir());
  assert.ok(free === Infinity || (typeof free === 'number' && free > 0),
    'diskFreeBytes tra ve gia tri hop le: ' + free);
  H.assertDiskSpace(1, os.tmpdir()); // cần 1 byte → không được chặn
  assert.throws(
    function () { H.assertDiskSpace(Number.MAX_SAFE_INTEGER - 1, os.tmpdir()); },
    function (e) { return e && e.code === 'IMZIC_DISK_FULL'; }
  );
  // thư mục không tồn tại → Infinity ("không biết", không chặn) — đúng khai báo
  assert.strictEqual(H.diskFreeBytes(path.join(os.tmpdir(), 'imzic-khong-ton-tai-xyz')), Infinity);
}

// ---- nhóm 5: payloadAudioBytes (D1) ----
function testPayloadAudioBytes() {
  assert.strictEqual(H.payloadAudioBytes({ audio: new ArrayBuffer(7) }), 7);
  assert.strictEqual(H.payloadAudioBytes({ audio: new Uint8Array(5) }), 5);
  assert.strictEqual(H.payloadAudioBytes({ audio: Buffer.alloc(9) }), 9);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imzic-core-test-pab-'));
  try {
    const f = path.join(dir, 'nhac.mp3');
    fs.writeFileSync(f, Buffer.alloc(1234));
    assert.strictEqual(H.payloadAudioBytes({ audioPath: f }), 1234);
    assert.strictEqual(H.payloadAudioBytes({ audioPath: path.join(dir, 'thieu.mp3') }), 0);
    assert.strictEqual(H.payloadAudioBytes({}), 0);
    assert.strictEqual(H.payloadAudioBytes(null), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- nhóm 6: sweepStaleImzicTmp (A3 — fixture thật trong tmpdir) ----
function testSweepStale() {
  const oldDir = path.join(os.tmpdir(), 'imzic-mux-imzic-core-test-old');
  const newDir = path.join(os.tmpdir(), 'imzic-offline-imzic-core-test-new');
  const other = path.join(os.tmpdir(), 'imzic-khac-tien-to-op');
  fs.mkdirSync(oldDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, 'x.tmp'), 'x');
  fs.mkdirSync(newDir, { recursive: true });
  fs.writeFileSync(path.join(newDir, 'y.tmp'), 'y');
  fs.mkdirSync(other, { recursive: true });
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  fs.utimesSync(oldDir, old, old);
  try {
    H.sweepStaleImzicTmp();
    assert.ok(!fs.existsSync(oldDir), 'dir cu (>24h) phai bi xoa');
    assert.ok(fs.existsSync(newDir), 'dir moi (dang dung) phai duoc giu');
    assert.ok(fs.existsSync(other), 'dir khac tien to imzic-(mux|offline)- khong duoc dong den');
  } finally {
    fs.rmSync(oldDir, { recursive: true, force: true });
    fs.rmSync(newDir, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
}

// ---- nhóm 7: killProcessTree (D4 — process thật) ----
async function testKillProcessTree() {
  const child = spawn(process.execPath, ['-e', 'setInterval(function(){},250);'], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 600); }); // chờ process sống
  let exited = false;
  const dead = new Promise(function (res) {
    child.on('exit', function (code, sig) { exited = true; res({ code: code, sig: sig }); });
  });
  H.killProcessTree(child);
  const res = await Promise.race([
    dead,
    new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error('process khong chet sau 8s du killProcessTree da goi')); }, 8000);
    }),
  ]);
  assert.ok(exited, 'process da thoat');
  assert.ok(typeof res.code === 'number' || res.sig, 'exit code/signal hop le: ' + JSON.stringify(res));
}

(async function main() {
  console.log('[imzic-core-test] kiem dinh ham thuan nova/main/ipc/imzic-helpers.js');
  console.log('-- nhom 1: safeExt');
  ok('safeExt', testSafeExt);
  console.log('-- nhom 2: safeBaseName (anti-traversal + ky tu cam)');
  ok('safeBaseName', testSafeBaseName);
  console.log('-- nhom 3: atomicCopyFile (nguyen tu .part + rename)');
  ok('atomicCopyFile', testAtomicCopyFile);
  console.log('-- nhom 4: diskFreeBytes / assertDiskSpace (IMZIC_DISK_FULL)');
  ok('assertDiskSpace', testDiskSpace);
  console.log('-- nhom 5: payloadAudioBytes');
  ok('payloadAudioBytes', testPayloadAudioBytes);
  console.log('-- nhom 6: sweepStaleImzicTmp (fixture that trong tmpdir)');
  ok('sweepStaleImzicTmp', testSweepStale);
  console.log('-- nhom 7: killProcessTree (process that, taskkill /T /F)');
  await okAsync('killProcessTree', testKillProcessTree);
  console.log('[imzic-core-test] PASS=' + pass + ' FAIL=' + fail);
  for (const f of failures) console.error('  CHI_TIET ' + f);
  if (fail > 0) process.exit(1);
  process.exit(0);
})();

