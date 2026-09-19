'use strict';
/* ============================================================
   ytdl-test.js — kiểm định HÀM THUẦN của IPC "Tải Video"
   ------------------------------------------------------------
   Nạp nova/main/ipc/ytdl-download.js với electron giả lập
   (Module._load stub — giống media-protocol-range-test) rồi test
   đúng hàng rào BẰNG CODE: URL chuẩn hoá, map chất lượng, parse
   dòng progress --newline, nhận diện dòng đường dẫn file thật
   (--print after_move:filepath), dọn tên file Windows, dựng argv
   info/download. Spawn/progress thật chạy trong app qua kênh
   ytdl:* — Luật 6 (dữ liệu thật, không bịa mạng).
   Chạy: npm run test:ytdl
   ============================================================ */
const assert = require('assert');
const path = require('path');
const Module = require('module');

/* electron giả lập: ipcMain.handle thu thập kênh để assert registration. */
const handled = [];
const electronStub = { ipcMain: { handle: (ch, fn) => { handled.push({ ch, fn }); } } };
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  return request === 'electron' ? electronStub : originalLoad.call(this, request, ...rest);
};
let Y;
try { Y = require('../main/ipc/ytdl-download.js'); }
finally { Module._load = originalLoad; }

let pass = 0, fail = 0;
function ok(name, fn) {
  try { fn(); pass++; console.log('  PASS ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' → ' + e.message); }
}
function codeOf(fn) {
  try { fn(); return ''; }
  catch (e) { return e.code || ''; }
}

/* ── 1. ytdlNormalizeUrl ── */
ok('Y1 URL https hợp lệ', () => {
  assert.strictEqual(Y.ytdlNormalizeUrl(' https://www.youtube.com/watch?v=abc '), 'https://www.youtube.com/watch?v=abc');
});
ok('Y2 từ chối chuỗi rỗng/file:///không scheme → YTD_URL_BAD', () => {
  assert.strictEqual(codeOf(() => Y.ytdlNormalizeUrl('')), 'YTD_URL_BAD');
  assert.strictEqual(codeOf(() => Y.ytdlNormalizeUrl('file://C:/x.mp4')), 'YTD_URL_BAD');
  assert.strictEqual(codeOf(() => Y.ytdlNormalizeUrl('youtube.com/watch?v=abc')), 'YTD_URL_BAD');
  assert.strictEqual(codeOf(() => Y.ytdlNormalizeUrl(null)), 'YTD_URL_BAD');
});

/* ── 2. ytdlFmtOf ── */
ok('Y3 audioOnly → bestaudio', () => {
  assert.strictEqual(Y.ytdlFmtOf('best', true), 'bestaudio/best');
});
ok('Y4 map chất lượng best/1080/720/480 + mặc định', () => {
  assert.strictEqual(Y.ytdlFmtOf('best'), 'bestvideo*+bestaudio/best');
  assert.strictEqual(Y.ytdlFmtOf('1080'), 'bestvideo*[height<=1080]+bestaudio/best[height<=1080]');
  assert.strictEqual(Y.ytdlFmtOf('720'), 'bestvideo*[height<=720]+bestaudio/best[height<=720]');
  assert.strictEqual(Y.ytdlFmtOf('480'), 'bestvideo*[height<=480]+bestaudio/best[height<=480]');
  assert.strictEqual(Y.ytdlFmtOf(undefined), 'bestvideo*+bestaudio/best');
});
ok('Y5 chất lượng lạ → YTD_QUALITY', () => {
  assert.strictEqual(codeOf(() => Y.ytdlFmtOf('4321')), 'YTD_QUALITY');
});

/* ── 3. ytdlParseProgressLine ── */
ok('Y6 dòng progress chuẩn → pct + speed + ETA', () => {
  const p = Y.ytdlParseProgressLine('[download]  42.3% of    5.50MiB at    1.20MiB/s ETA 00:03');
  assert.deepStrictEqual(p, { pct: 42, speed: '1.20MiB/s', eta: '00:03' });
});
ok('Y7 pct kẹp 0..100, thiếu speed/ETA vẫn ok', () => {
  assert.deepStrictEqual(Y.ytdlParseProgressLine('[download] 123.4% of 1MiB'), { pct: 100 });
  assert.deepStrictEqual(Y.ytdlParseProgressLine('[download]   0.0% of 1MiB'), { pct: 0 });
});
ok('Y8 dòng lạ/rỗng → null (không bịa progress)', () => {
  assert.strictEqual(Y.ytdlParseProgressLine('[Merger] Merging formats into "x.mp4"'), null);
  assert.strictEqual(Y.ytdlParseProgressLine(''), null);
  assert.strictEqual(Y.ytdlParseProgressLine(null), null);
});

/* ── 4. ytdlIsOutputPath ── */
ok('Y9 dòng đường dẫn file thật (Windows/Unix) → true', () => {
  assert.strictEqual(Y.ytdlIsOutputPath('C:\\Users\\a\\Video\\Ten.mp4'), true);
  assert.strictEqual(Y.ytdlIsOutputPath('/home/user/Video/Ten.webm'), true);
  // Bug thật 2026-09-19: tiêu đề có dấu cách từng bị chặn -> YTD_OUT_MISSING dù file tải xong.
  assert.strictEqual(Y.ytdlIsOutputPath('C:\\Users\\a\\Video\\Me at the zoo.webm'), true);
});
ok('Y10 dòng bracket/tiếng Việt thường → false', () => {
  assert.strictEqual(Y.ytdlIsOutputPath('[download] Destination: C:\\x.mp4'), false);
  assert.strictEqual(Y.ytdlIsOutputPath('[Merger] Merging into "x.mp4"'), false);
  assert.strictEqual(Y.ytdlIsOutputPath('Chưa chọn'), false);
  assert.strictEqual(Y.ytdlIsOutputPath(''), false);
});

/* ── 5. ytdlSanitizeTitle + ytdlOutTemplate ── */
ok('Y11 dọn ký tự cấm Windows + ký tự điều khiển + gọn khoảng cách', () => {
  assert.strictEqual(Y.ytdlSanitizeTitle('  Học: Lập *trình? "2026" | C++/C#  '), 'Học Lập trình 2026 C++C#');
  assert.strictEqual(Y.ytdlSanitizeTitle('a\x07b\x1Fc'), 'abc');
});
ok('Y12 bỏ dấu chấm/cách đuôi, cap 120, rỗng → video', () => {
  assert.strictEqual(Y.ytdlSanitizeTitle('...  '), 'video');
  assert.strictEqual(Y.ytdlSanitizeTitle(''), 'video');
  assert.ok(Y.ytdlSanitizeTitle('x'.repeat(300)).length <= 120);
});
ok('Y13 template = dir + tên đã dọn + .%(ext)s', () => {
  assert.strictEqual(
    Y.ytdlOutTemplate('C:\\out', 'Tiêu đề: phụ đề'),
    path.join('C:\\out', 'Tiêu đề phụ đề' + '.%(ext)s')
  );
});

/* ── 6. ytdlBuildInfoArgs ── */
ok('Y14 argv info: dump-json + no-playlist + URL cuối', () => {
  const a = Y.ytdlBuildInfoArgs('https://youtu.be/x');
  assert.strictEqual(a[0], '--dump-single-json');
  assert.ok(a.includes('--no-playlist') && a.includes('--no-warnings'));
  assert.strictEqual(a[a.length - 1], 'https://youtu.be/x');
  assert.strictEqual(codeOf(() => Y.ytdlBuildInfoArgs('khong-phai-url')), 'YTD_URL_BAD');
});

/* ── 7. ytdlBuildDownloadArgs ── */
ok('Y15 argv download: progress newline + fmt + template + URL cuối', () => {
  const a = Y.ytdlBuildDownloadArgs({
    url: 'https://youtu.be/x', dir: 'C:\\out', title: 'Clip hay', quality: '720', audioOnly: false,
  });
  assert.ok(a.includes('--newline') && a.includes('--progress'));
  assert.ok(a.includes('--ffmpeg-location'), 'phải trỏ ffmpeg cho merge/-x');
  const fi = a.indexOf('-f');
  assert.strictEqual(a[fi + 1], 'bestvideo*[height<=720]+bestaudio/best[height<=720]');
  const pi = a.indexOf('--print');
  assert.strictEqual(a[pi + 1], 'after_move:filepath');
  const oi = a.indexOf('-o');
  assert.strictEqual(a[oi + 1], path.join('C:\\out', 'Clip hay' + '.%(ext)s'));
  assert.strictEqual(a[a.length - 1], 'https://youtu.be/x');
});
ok('Y16 argv download audioOnly: -x mp3', () => {
  const a = Y.ytdlBuildDownloadArgs({
    url: 'https://youtu.be/x', dir: 'C:\\out', title: 'Nhạc', quality: 'best', audioOnly: true,
  });
  const fi = a.indexOf('-f');
  assert.strictEqual(a[fi + 1], 'bestaudio/best');
  assert.ok(a.includes('-x') && a.includes('--audio-format') && a[a.indexOf('--audio-format') + 1] === 'mp3');
});
ok('Y17 argv download thiếu thông tin → fail-loud', () => {
  assert.strictEqual(codeOf(() => Y.ytdlBuildDownloadArgs({ url: '', dir: 'C:\\out', title: 'x' })), 'YTD_URL_BAD');
  assert.strictEqual(codeOf(() => Y.ytdlBuildDownloadArgs({ url: 'https://a.b/c', dir: 'C:\\out', title: 'x', quality: 'zzz' })), 'YTD_QUALITY');
});

/* ── 8. Registration ── */
ok('Y18 đăng ký đủ 3 kênh ytdl:info/download/cancel', () => {
  Y.registerYtdlIpc();
  const chans = handled.map((h) => h.ch);
  assert.ok(chans.includes('ytdl:info'), 'thiếu ytdl:info');
  assert.ok(chans.includes('ytdl:download'), 'thiếu ytdl:download');
  assert.ok(chans.includes('ytdl:cancel'), 'thiếu ytdl:cancel');
});
ok('Y19 YTDLP_BUNDLED khai báo boolean', () => {
  assert.strictEqual(typeof Y.YTDLP_BUNDLED, 'boolean');
});

console.log('\nKết quả: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
