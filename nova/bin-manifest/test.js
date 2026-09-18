'use strict';
/* ============================================================
   BIN-MANIFEST — test hàm thuần (fixture %TEMP%, không Electron)
   ------------------------------------------------------------
   Chạy: npm run test:binman  (node nova/bin-manifest/test.js)
   Gồm cả verify THẬT yt-dlp.exe / yt-dlp_macos đã ship trong
   nova/ytdlp-bin với SHA2-256SUMS upstream đi kèm — dữ liệu thật,
   không bịa (Luật 6 — binary đã commit trong repo là nguồn thật).
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const E = require('./engine');

const results = [];
function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { results.push({ name, ok: true }); })
    .catch((e) => { results.push({ name, ok: false, err: (e && e.message) || String(e) }); });
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert fail'); }
function assertCode(fn, code) {
  try { fn(); } catch (e) {
    if ((e && e.code) !== code) throw new Error('expect code ' + code + ' — got ' + ((e && e.code) || '(none)') + ': ' + (e && e.message));
    return;
  }
  throw new Error('expect throw ' + code + ' — but passed');
}
async function assertCodeAsync(fn, code) {
  try { await fn(); } catch (e) {
    if ((e && e.code) !== code) throw new Error('expect code ' + code + ' — got ' + ((e && e.code) || '(none)') + ': ' + (e && e.message));
    return;
  }
  throw new Error('expect throw ' + code + ' — but passed');
}

/* ── fixture dir trong %TEMP% (dọn trong finally) ── */
const FIX = path.join(os.tmpdir(), 'binman-fixture-' + process.pid + '-' + Date.now());

function writeFix(rel, buf) {
  const abs = path.join(FIX, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  return abs;
}
const sha256Buf = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  /* 1. sha256File — vector chuẩn "abc" */
  await t('sha256File: vector "abc" đúng chuẩn', async () => {
    const f = writeFix('abc.bin', Buffer.from('abc'));
    const h = await E.sha256File(f);
    assert(h === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hash sai: ' + h);
  });

  /* 2. buildDirManifest — đệ quy + deterministic + bytes */
  await t('buildDirManifest: đệ quy, deterministic, bytes đúng', async () => {
    const a = Buffer.from('AAA');
    const b = Buffer.from('B'.repeat(5000));
    const c = Buffer.from('CCC');
    writeFix('dir1/yt-dlp.exe', a);
    writeFix('dir1/sub/yt-dlp_macos', b);
    writeFix('dir1/README.md', c);
    const m1 = await E.buildDirManifest(path.join(FIX, 'dir1'));
    const m2 = await E.buildDirManifest(path.join(FIX, 'dir1'));
    assert(m1.files.length === 3, 'expect 3 files — got ' + m1.files.length);
    assert(JSON.stringify(m1) === JSON.stringify(m2), '2 lần build phải giống hệt');
    const by = Object.fromEntries(m1.files.map((f) => [f.path, f]));
    assert(by['README.md'].bytes === 3 && by['sub/yt-dlp_macos'].bytes === 5000, 'bytes sai');
    assert(by['yt-dlp.exe'].sha256 === sha256Buf(a), 'sha sai yt-dlp.exe');
  });

  /* 3. buildDirManifest fail-loud */
  await t('buildDirManifest: dir thiếu → BIN_ROOT_MISSING', async () => {
    await assertCodeAsync(async () => { await E.buildDirManifest(path.join(FIX, 'khong-ton-tai')); }, 'BIN_ROOT_MISSING');
  });

  await t('buildDirManifest: dir rỗng → BIN_NO_FILES (khai báo, không nuốt)', async () => {
    fs.mkdirSync(path.join(FIX, 'empty-dir'), { recursive: true });
    await assertCodeAsync(async () => { await E.buildDirManifest(path.join(FIX, 'empty-dir')); }, 'BIN_NO_FILES');
  });

  /* 4. diffManifests — ok / changed / missing / extra */
  await t('diffManifests: changed/missing/extra khai báo đúng', () => {
    const base = { files: [
      { path: 'a', bytes: 3, sha256: 'h-a' },
      { path: 'b', bytes: 4, sha256: 'h-b' },
      { path: 'gone', bytes: 5, sha256: 'h-g' },
    ] };
    const cur = { files: [
      { path: 'a', bytes: 3, sha256: 'h-a' },          // giữ nguyên
      { path: 'b', bytes: 4, sha256: 'h-b2' },          // changed
      { path: 'new', bytes: 9, sha256: 'h-n' },         // extra
    ] };
    const d = E.diffManifests(base, cur);
    assert(!d.ok, 'phải not ok');
    assert(d.changed.length === 1 && d.changed[0].path === 'b' && d.changed[0].expected === 'h-b' && d.changed[0].actual === 'h-b2', 'changed sai');
    assert(d.missing.length === 1 && d.missing[0].path === 'gone', 'missing sai');
    assert(d.extra.length === 1 && d.extra[0].path === 'new', 'extra sai');
    const d2 = E.diffManifests(cur, cur);
    assert(d2.ok && d2.changed.length === 0 && d2.missing.length === 0 && d2.extra.length === 0, 'giống nhau phải ok');
  });

  /* 5. parseSums — hợp lệ / marker `*` / CRLF / lỗi lộ liễu */
  await t('parseSums: hợp lệ + marker * + CRLF', () => {
    const rows = E.parseSums('b'.repeat(64) + '  *yt-dlp.exe\r\n\n' + 'c'.repeat(64) + '  yt-dlp_macos');
    assert(rows.length === 2, 'expect 2 rows — got ' + rows.length);
    assert(rows[0].name === 'yt-dlp.exe' && rows[0].hash === 'b'.repeat(64), 'row 1 sai');
    assert(rows[1].name === 'yt-dlp_macos', 'row 2 sai');
  });

  await t('parseSums: dòng xấu → BIN_SUMS_BAD', () => {
    assertCode(() => { E.parseSums('deadbeef  file.exe'); }, 'BIN_SUMS_BAD');
    assertCode(() => { E.parseSums(''); }, 'BIN_SUMS_BAD');
  });

  /* 6. verifySumsInDir — match ok + tamper mismatch + skipped */
  await t('verifySumsInDir: ok/mismatch/skipped khai báo đúng', async () => {
    const good = Buffer.from('binary-nguyen-ven');
    const bad = Buffer.from('binary-bi-thay');
    const fakeHash = 'e'.repeat(64); // manifest upstream ghi hash KHÁC nội dung đang có → lệch
    writeFix('sums/good.exe', good);
    writeFix('sums/tampered.exe', bad);
    writeFix('sums/SHA2-256SUMS',
      sha256Buf(good) + '  good.exe\n' + fakeHash + '  tampered.exe\n' + 'd'.repeat(64) + '  yt-dlp_linux\n');
    const r = await E.verifySumsInDir(path.join(FIX, 'sums'));
    assert(r.present === true, 'phải present');
    assert(r.checked.length === 2, 'expect 2 checked — got ' + r.checked.length);
    assert(r.checked[0].ok === true, 'good.exe phải ok');
    assert(r.checked[1].ok === false, 'tampered.exe phải lệch');
    assert(r.mismatches.length === 1 && r.mismatches[0].name === 'tampered.exe', 'mismatches sai');
    assert(r.skipped === 1, 'yt-dlp_linux không ship → skipped 1');
  });

  await t('verifySumsInDir: không có file sums → present:false (khai báo)', async () => {
    fs.mkdirSync(path.join(FIX, 'no-sums'), { recursive: true });
    writeFix('no-sums/whatever', Buffer.from('x'));
    const r = await E.verifySumsInDir(path.join(FIX, 'no-sums'));
    assert(r.present === false && r.checked.length === 0, 'phải present:false');
  });

  /* 7. resolveTargets (repo thật) — ytdlp + ffmpeg/ffprobe có mặt */
  await t('resolveTargets: ytdlp + ffmpeg/ffprobe available trên repo thật', () => {
    const targets = E.resolveTargets();
    const byId = Object.fromEntries(targets.map((x) => [x.id, x]));
    assert(!!byId.ytdlp && byId.ytdlp.available === true, 'ytdlp phải available (repo ship binary)');
    assert(byId.ytdlp.checkSums === true, 'ytdlp phải bật checkSums');
    assert(byId.ffmpeg && byId.ffmpeg.available, 'ffmpeg-static phải resolve được');
    assert(byId.ffprobe && byId.ffprobe.available, 'ffprobe-static phải resolve được');
  });

  /* 8. VERIFY THẬT — yt-dlp đã ship khớp SHA2-256SUMS upstream đi kèm */
  await t('yt-dlp THẬT trong repo khớp SHA2-256SUMS upstream', async () => {
    const ytdlpDir = path.join(__dirname, '..', 'ytdlp-bin');
    const r = await E.verifySumsInDir(ytdlpDir);
    assert(r.present === true, 'ytdlp-bin phải có SHA2-256SUMS');
    assert(r.checked.length >= 2, 'expect >= 2 binary kiểm (exe + macos) — got ' + r.checked.length);
    assert(r.mismatches.length === 0, 'binary yt-dlp lệch manifest: ' + r.mismatches.map((m) => m.name).join(', '));
  });

  /* 9. verifyTargets + baseline roundtrip trên fixture */
  await t('verifyTargets: no-baseline → ok → tamper → changed', async () => {
    const root = path.join(FIX, 'vt');
    writeFix('vt/tool.exe', Buffer.from('TOOL-V1'));
    writeFix('vt/keep.exe', Buffer.from('KEEP'));
    const target = { id: 'tool', label: 'tool', type: 'dir', path: root, checkSums: false, available: true };
    const base = { version: 1, targets: {} };

    let rows = await E.verifyTargets({ targets: [target], baseline: base });
    assert(rows[0].status === 'no-baseline', 'chưa baseline phải no-baseline');

    const doc = await E.buildBaseline([target]);
    rows = await E.verifyTargets({ targets: [target], baseline: doc });
    assert(rows[0].status === 'ok' && rows[0].files === 2, 'baseline mới phải ok (2 file)');

    writeFix('vt/tool.exe', Buffer.from('TOOL-BI-THAY'));
    rows = await E.verifyTargets({ targets: [target], baseline: doc });
    assert(rows[0].status === 'changed', 'tamper phải changed');
    assert(rows[0].changed.length === 1 && rows[0].changed[0].path === 'tool.exe', 'changed phải nêu đúng file');

    fs.unlinkSync(path.join(root, 'tool.exe'));
    rows = await E.verifyTargets({ targets: [target], baseline: doc });
    assert(rows[0].status === 'changed' && rows[0].missing.length === 1 && rows[0].missing[0].path === 'tool.exe', 'xoá file → missing (file còn lại giữ dir không rỗng)');
  });

  await t('verifyTargets: target không available → unavailable (khai báo)', async () => {
    const target = { id: 'ghost', label: 'ghost', type: 'file', path: path.join(FIX, 'khong-co.exe'), checkSums: false, available: false };
    const rows = await E.verifyTargets({ targets: [target], baseline: null });
    assert(rows[0].status === 'unavailable' && rows[0].available === false, 'phải unavailable');
  });

  /* 10. baseline nguyên tử + load + JSON hỏng lộ liễu */
  await t('writeBaselineAtomic + loadBaseline: roundtrip; JSON hỏng → BIN_BASELINE_BAD', async () => {
    const bp = path.join(FIX, 'baseline.json');
    const doc = { version: 1, generatedAt: '2026-09-18T00:00:00.000Z', targets: { x: { files: [] } } };
    E.writeBaselineAtomic(bp, doc);
    const loaded = E.loadBaseline(bp);
    assert(loaded.version === 1 && loaded.targets.x, 'roundtrip sai');
    assert(fs.readdirSync(FIX).every((n) => !n.includes('.part-')), 'không để rác .part');
    fs.writeFileSync(bp, '{khong-phai-json', 'utf8');
    assertCode(() => { E.loadBaseline(bp); }, 'BIN_BASELINE_BAD');
    assert(E.loadBaseline(path.join(FIX, 'khong-ton-tai.json')) === null, 'file thiếu → null (chưa có baseline)');
  });

  await finish();
})();

async function finish() {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log('');
  console.log('=== BIN-MANIFEST TEST — ' + pass + '/' + results.length + ' PASS ===');
  for (const r of results) {
    console.log((r.ok ? '  [OK]   ' : '  [FAIL] ') + r.name + (r.ok ? '' : '\n         → ' + r.err));
  }
  /* ── dọn fixture %TEMP% (§6.7 — rác test phải dọn) ── */
  try { fs.rmSync(FIX, { recursive: true, force: true }); } catch (_) {}
  if (fail.length > 0) process.exit(1);
}


