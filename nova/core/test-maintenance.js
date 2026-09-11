#!/usr/bin/env node
'use strict';
/**
 * Test nova/core/orphan-pids.js (quét tiến trình mồ côi) + nova/core/link-or-copy.js
 * (hardlink-restore). Thuần Node, không cần Electron.
 * Chạy: node nova/core/test-maintenance.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { normExe, matchOrphans, listRunningProcessesWin32, sweepOrphanRendererProcesses } = require('./orphan-pids');
const { hardlinkOrCopy } = require('./link-or-copy');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-maint-test-'));
const noopLogger = { log: () => {}, warn: () => {} };

// ── 1) normExe: chuẩn hoá đường dẫn ──────────────────────────────────────────
assert.strictEqual(normExe('C:\\A\\B\\ffmpeg.exe'), 'c:/a/b/ffmpeg.exe');
assert.strictEqual(normExe('\\\\?\\C:\\A\\b\\FFMPEG.EXE'), 'c:/a/b/ffmpeg.exe');
assert.strictEqual(normExe(''), '');
console.log('PASS 1 — normExe');

// ── 2) matchOrphans: chỉ trùng khớp CHÍNH XÁC đường dẫn (đã chuẩn hoá) ───────
const VENDORED = 'C:\\app\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe';
const list = [
  { pid: 100, exe: VENDORED },                                            // khớp (đúng đường)
  { pid: 101, exe: 'c:/APP/resources/app.asar.unpacked/node_modules/ffmpeg-static/FFMPEG.EXE' }, // khớp (case + dấu /)
  { pid: 102, exe: 'C:\\app\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg2.exe' }, // khác
  { pid: 103, exe: 'C:\\Windows\\System32\\ffmpeg.exe' },                 // ffmpeg của người dùng — PHẢI tha
  { pid: 104, exe: 'C:\\app\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\' }, // prefix — không match
  { pid: 'abc', exe: VENDORED },                                          // pid rác
  { pid: 105 },                                                           // thiếu exe
];
const matched = matchOrphans(list, [VENDORED]);
assert.deepStrictEqual(matched.map((m) => m.pid).sort((a, b) => a - b), [100, 101], 'chỉ đúng 2 tiến trình trùng khớp');
assert.deepStrictEqual(matchOrphans(list, []), [], 'không có đích → không match gì');
console.log('PASS 2 — matchOrphans (so khớp chính xác, tha ffmpeg hệ thống)');

// ── 3) sweepOrphanRendererProcesses: DI lister/killer ────────────────────────
(async () => {
  // 3a. Không đích hợp lệ (bare 'ffmpeg' theo PATH + file không tồn tại) → skip khai báo.
  const st0 = await sweepOrphanRendererProcesses({ exePaths: ['ffmpeg', 'C:\\không\\tồn\\tại.exe'], logger: noopLogger });
  assert.strictEqual(st0.skipped, true);
  assert.strictEqual(st0.reason, 'NO_VENDORED_EXE');
  assert.strictEqual(st0.killed.length, 0);
  console.log('PASS 3a — sweep skip khi không có exe vendored hợp lệ');

  // 3b. Tự vệ: không bao giờ nhắm chính node đang chạy bộ sweep.
  const st1 = await sweepOrphanRendererProcesses({ exePaths: [process.execPath], logger: noopLogger });
  assert.strictEqual(st1.skipped, true, 'process.execPath phải bị loại khỏi đích');
  console.log('PASS 3b — sweep tự vệ process.execPath');

  // 3c. Kill đúng các pid khớp; lỗi kill từng pid không làm hỏng tổng thể.
  // Đích phải TỒN TẠI trên đĩa (sweep lọc fs.existsSync) → tạo file stub.
  const vendDir = path.join(tmp, 'vendored');
  fs.mkdirSync(vendDir, { recursive: true });
  const EXE_FFMPEG = path.join(vendDir, 'ffmpeg.exe');
  const EXE_CHROME = path.join(vendDir, 'chrome-headless-shell.exe');
  fs.writeFileSync(EXE_FFMPEG, 'stub');
  fs.writeFileSync(EXE_CHROME, 'stub');
  const procs = [
    { pid: 200, exe: EXE_FFMPEG },                               // mồ côi → kill
    { pid: 201, exe: EXE_CHROME },                               // mồ côi → kill
    { pid: 202, exe: path.join(vendDir, 'ffmpeg-user-copied.exe') }, // không phải đích → tha
    { pid: 203, exe: EXE_CHROME.toLowerCase().replace(/\\/g, '/') }, // case + dấu / → vẫn khớp
  ];
  const killedPids = [];
  const killer = async (pid) => { if (pid === 201) throw new Error('access denied'); killedPids.push(pid); };
  const st2 = await sweepOrphanRendererProcesses({ exePaths: [EXE_FFMPEG, EXE_CHROME], lister: async () => procs, killer, logger: noopLogger });
  assert.strictEqual(st2.skipped, false);
  assert.deepStrictEqual(st2.matched.sort((a, b) => a - b), [200, 201, 203], 'đúng 3 pid mồ côi (gồm biến thể case/slash)');
  assert.deepStrictEqual(killedPids, [200, 203], 'pid 201 lỗi kill → không nằm trong killed');
  assert.deepStrictEqual(st2.killed.map((k) => k.pid), [200, 203]);
  assert.strictEqual(st2.failed.length, 1);
  assert.strictEqual(st2.failed[0].pid, 201);
  assert.match(st2.failed[0].error, /access denied/);
  console.log('PASS 3c — sweep kill đúng pid, tha exe lạ, lỗi từng pid được ghi nhận');

  // 3d. Lỗi lister (powershell hỏng…) → reject có ý nghĩa, caller (janitor) degrade khai báo.
  await assert.rejects(
    () => sweepOrphanRendererProcesses({ exePaths: [EXE_FFMPEG], lister: async () => { throw new Error('WMI_DOWN'); }, logger: noopLogger }),
    /WMI_DOWN/,
    'lỗi lister (WMI hỏng…) → reject lộ liễu'
  );
  console.log('PASS 3d — lỗi lister ném lộ liễu');
  // 3e. Lister THẬT (WMI): spawn tiến trình con sống dai → pid của nó phải xuất hiện
  // trong kết quả liệt kê theo exe của chính node test này. CHỈ liệt kê — tuyệt đối
  // KHÔNG chạy sweep kill với process.execPath (sẽ giết mọi node.exe trên máy).
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},500)'], { stdio: 'ignore', windowsHide: true });
  await new Promise((r) => setTimeout(r, 800));   // cho WMI kịp thấy tiến trình mới
  const real = await listRunningProcessesWin32([{ exe: process.execPath }]);
  assert.ok(Array.isArray(real) && real.length > 0, 'WMI phải trả về ít nhất 1 tiến trình node');
  assert.ok(real.some((p) => p.pid === child.pid), `pid con ${child.pid} phải có trong danh sách liệt kê thật`);
  child.kill();
  console.log('PASS 3e — lister thật (WMI) nhìn thấy tiến trình con vừa spawn:', child.pid);

  // ── 4) hardlinkOrCopy ────────────────────────────────────────────────────────
  const src = path.join(tmp, 'asset-big.mp4');
  fs.writeFileSync(src, Buffer.alloc(64 * 1024, 7));
  // 4a. Cùng ổ đĩa → hardlink thành công, nội dung đọc được, link count > 1.
  const destA = path.join(tmp, 'staged-a.mp4');
  const modeA = hardlinkOrCopy(src, destA);
  assert.strictEqual(modeA, 'link', 'cùng ổ đĩa phải đi đường link');
  assert.strictEqual(fs.readFileSync(destA).length, 64 * 1024);
  assert.ok(fs.statSync(destA).nlink >= 2, 'hardlink phải tăng link count');
  // Bỏ link đích (như cleanupStaged) — file nguồn nguyên vẹn.
  fs.unlinkSync(destA);
  assert.ok(fs.existsSync(src) && fs.statSync(src).nlink === 1, 'bỏ link không ảnh hưởng file gốc');
  console.log('PASS 4a — hardlink cùng ổ đĩa + unlink an toàn với file gốc');

  // 4b. link thất bại (EXDEV — khác ổ / FS không hỗ trợ) → fallback copy CÓ KHAI BÁO mã.
  const destB = path.join(tmp, 'staged-b.mp4');
  const modeB = hardlinkOrCopy(src, destB, { linkFn: () => { const e = new Error('cross-device'); e.code = 'EXDEV'; throw e; } });
  assert.strictEqual(modeB, 'copy:EXDEV');
  assert.strictEqual(fs.readFileSync(destB).length, 64 * 1024, 'fallback copy phải chép đủ nội dung');
  console.log('PASS 4b — fallback copy khi link EXDEV (degrade khai báo)');

  // 4c. Copy cũng lỗi → NÉM (không nuốt — Luật 10).
  const copyFail = () => hardlinkOrCopy(src, path.join(tmp, 'no-such-dir', 'x.mp4'), {
    linkFn: () => { const e = new Error('exdev'); e.code = 'EXDEV'; throw e; },
  });
  assert.throws(copyFail);
  console.log('PASS 4c — copy lỗi ném lộ liễu');

  console.log('\nTất cả test nova/core/test-maintenance.js ĐÃ PASS.');
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });

