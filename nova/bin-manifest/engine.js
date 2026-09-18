'use strict';
/* ============================================================
   BIN-MANIFEST — engine (thuần Node, KHÔNG Electron — test được)
   ------------------------------------------------------------
   Bước 4 lộ trình ezmaxsub: manifest sha256 cho binary runtime
   tự tải/đóng gói kèm app (nova/ytdlp-bin, ffmpeg-static,
   ffprobe-static). ezmaxsub pin sha256 cho wheel/model tải về
   (gpu_wheel_pins.json) — Nova làm theo đúng triết lý đó nhưng
   thuần Node (crypto), không thêm dependency.

   Nguyên tắc:
   - Verify là ĐỌC — không bao giờ tự ghi đè baseline khi lệch
     (Luật 10: ghi baseline mới chỉ xảy ra khi user bấm rõ ràng
     qua kênh binman:refresh).
   - Target không có trên máy (vd venv chưa cài) → khai báo
     available:false — KHÔNG nuốt thành "ok".
   - Mã lỗi BIN_* lộ liễu.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHUNK = 1024 * 1024; // 1 MiB / vòng đọc — binary lớn cũng ổn

function errCode(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

/* ── sha256 1 file (stream, không đọc cả file vào RAM) ── */
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    let fd;
    try { fd = fs.openSync(file, 'r'); } catch (err) {
      return reject(errCode('BIN_HASH_FAILED', 'Không mở được file để hash: ' + file + ' — ' + err.message));
    }
    const buf = Buffer.allocUnsafe(CHUNK);
    try {
      for (;;) {
        const n = fs.readSync(fd, buf, 0, CHUNK, null);
        if (n === 0) break;
        h.update(n === CHUNK ? buf : buf.subarray(0, n));
      }
    } catch (err) {
      try { fs.closeSync(fd); } catch (_) {}
      return reject(errCode('BIN_HASH_FAILED', 'Hash lỗi tại ' + file + ' — ' + err.message));
    }
    try { fs.closeSync(fd); } catch (_) {}
    resolve(h.digest('hex'));
  });
}

/* ── liệt kê file đệ quy trong 1 thư mục, sắp theo đường dẫn posix
      (deterministic — chạy 2 lần ra cùng thứ tự) ── */
function listFilesRecursive(root, relPrefix = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (err) {
    throw errCode('BIN_ROOT_MISSING', 'Không đọc được thư mục binary: ' + root + ' — ' + err.message);
  }
  for (const ent of entries) {
    const rel = relPrefix ? relPrefix + '/' + ent.name : ent.name;
    const abs = path.join(root, ent.name);
    if (ent.isDirectory()) {
      out.push(...listFilesRecursive(abs, rel));
    } else if (ent.isFile()) {
      out.push({ path: rel, abs, bytes: fs.statSync(abs).size });
    }
  }
  return out;
}

/* ── manifest cho 1 thư mục: [{path (posix rel tới root), bytes, sha256}] ── */
async function buildDirManifest(root) {
  const listed = listFilesRecursive(root);
  if (listed.length === 0) {
    throw errCode('BIN_NO_FILES', 'Thư mục binary rỗng: ' + root);
  }
  const files = [];
  for (const it of listed) {
    files.push({ path: it.path, bytes: it.bytes, sha256: await sha256File(it.abs) });
  }
  return { files };
}

/* ── manifest cho 1 file đơn (ffmpeg/ffprobe) ── */
async function buildFileManifest(file) {
  let st;
  try { st = fs.statSync(file); } catch (err) {
    throw errCode('BIN_ROOT_MISSING', 'Không thấy binary: ' + file + ' — ' + err.message);
  }
  return { files: [{ path: path.basename(file), bytes: st.size, sha256: await sha256File(file) }] };
}

/* ── so 2 manifest: trả diff khai báo, KHÔNG tự sửa gì ──
     baseline/current có dạng {files:[{path,bytes,sha256}]} */
function diffManifests(baseline, current) {
  const base = new Map((baseline && baseline.files || []).map((f) => [f.path, f]));
  const cur = new Map((current && current.files || []).map((f) => [f.path, f]));
  const changed = [];
  const missing = [];
  const extra = [];
  for (const [p, f] of cur) {
    const b = base.get(p);
    if (!b) { extra.push({ path: p, bytes: f.bytes }); continue; }
    if (b.sha256 !== f.sha256) changed.push({ path: p, expected: b.sha256, actual: f.sha256, bytes: f.bytes });
  }
  for (const p of base.keys()) {
    if (!cur.has(p)) missing.push({ path: p });
  }
  const byPath = (a, b) => a.path.localeCompare(b.path);
  changed.sort(byPath); missing.sort(byPath); extra.sort(byPath);
  return { ok: changed.length === 0 && missing.length === 0 && extra.length === 0, changed, missing, extra };
}

/* ── đọc file SHA2-256SUMS (định dạng upstream yt-dlp: "<hash>  <tên>",
      dấu * giữa hash và tên = chế độ binary — bỏ qua) ── */
function parseSums(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([0-9a-fA-F]{64})\s+[ *]?(.+)$/.exec(line);
    if (!m) throw errCode('BIN_SUMS_BAD', 'Dòng SHA2-256SUMS không hợp lệ: "' + line.slice(0, 80) + '"');
    out.push({ hash: m[1].toLowerCase(), name: m[2] });
  }
  if (out.length === 0) throw errCode('BIN_SUMS_BAD', 'SHA2-256SUMS rỗng hoặc không có dòng hợp lệ.');
  return out;
}

/* ── đối chiếu các file CÓ THẬT trong dir với SHA2-256SUMS của dir đó.
      Entry upstream mà máy không ship (vd yt-dlp_linux) → đếm skipped,
      KHÔNG tính lệch. Không có file sums → present:false (khai báo). ── */
async function verifySumsInDir(dir) {
  const sumsPath = path.join(dir, 'SHA2-256SUMS');
  let text;
  try { text = fs.readFileSync(sumsPath, 'utf8'); } catch (_) {
    return { present: false, checked: [], skipped: 0, mismatches: [] };
  }
  const entries = parseSums(text);
  const checked = [];
  const mismatches = [];
  let skipped = 0;
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (!fs.existsSync(abs)) { skipped += 1; continue; }
    const actual = await sha256File(abs);
    const row = { name: ent.name, ok: actual === ent.hash, expected: ent.hash, actual };
    checked.push(row);
    if (!row.ok) mismatches.push(row);
  }
  return { present: true, checked, skipped, mismatches };
}

/* ── resolve path binary ffmpeg-static/ffprobe-static (logic giống
      native-tools/ffmpeg.js binPath — engine thuần, không require chuỗi
      gpu-encoder để test được độc lập) ── */
function staticBinPath(mod) {
  let p;
  try { p = require(mod); } catch (_) { return null; }
  if (p && typeof p === 'object') p = p.path; // ffprobe-static trả {path}
  if (!p) return null;
  return String(p).replace('app.asar', 'app.asar.unpacked');
}

/* ── target khai báo — nguồn single-truth của "binary nào được kiểm".
      available:false là KHAI BÁO rõ (target chưa có trên máy này). ── */
function resolveTargets() {
  const novaRoot = path.join(__dirname, '..');
  const ytdlpDir = path.join(novaRoot, 'ytdlp-bin');
  const ffmpeg = staticBinPath('ffmpeg-static');
  const ffprobe = staticBinPath('ffprobe-static');
  return [
    {
      id: 'ytdlp', label: 'yt-dlp (nova/ytdlp-bin)', type: 'dir', path: ytdlpDir,
      checkSums: true, available: fs.existsSync(path.join(ytdlpDir, 'yt-dlp.exe')) || fs.existsSync(path.join(ytdlpDir, 'yt-dlp_macos')),
      note: 'Tải từ GitHub release — manifest upstream SHA2-256SUMS đi kèm.',
    },
    {
      id: 'ffmpeg', label: 'FFmpeg (ffmpeg-static)', type: 'file', path: ffmpeg,
      checkSums: false, available: !!ffmpeg, note: 'npm package, chạy qua asar.unpacked khi đóng gói.',
    },
    {
      id: 'ffprobe', label: 'FFprobe (ffprobe-static)', type: 'file', path: ffprobe,
      checkSums: false, available: !!ffprobe, note: 'npm package, chạy qua asar.unpacked khi đóng gói.',
    },
  ];
}

/* ── manifest cho 1 target (dir hoặc file đơn) ── */
async function targetManifest(t) {
  return t.type === 'dir' ? buildDirManifest(t.path) : buildFileManifest(t.path);
}

/* ── verify toàn bộ target: build manifest hiện tại + so baseline (nếu có)
      + cross-check SHA2-256SUMS cho target checkSums. Không ghi file nào. ── */
async function verifyTargets({ targets, baseline }) {
  const baseTargets = (baseline && baseline.targets) || {};
  const out = [];
  for (const t of targets) {
    const row = { id: t.id, label: t.label, type: t.type, path: t.path, available: !!t.available, note: t.note || '' };
    if (!t.available) {
      row.status = 'unavailable';
      out.push(row);
      continue;
    }
    try {
      const current = await targetManifest(t);
      row.files = current.files.length;
      row.bytes = current.files.reduce((s, f) => s + f.bytes, 0);
      const b = baseTargets[t.id];
      if (!b || !Array.isArray(b.files)) {
        row.status = 'no-baseline';
      } else {
        const d = diffManifests(b, current);
        row.status = d.ok ? 'ok' : 'changed';
        row.changed = d.changed;
        row.missing = d.missing;
        row.extra = d.extra;
      }
      if (t.checkSums) {
        row.sums = await verifySumsInDir(t.path);
        if (row.sums.present && row.sums.mismatches.length > 0) row.status = 'changed';
      }
    } catch (err) {
      row.status = 'error';
      row.error = String((err && err.message) || err);
      row.errorCode = (err && err.code) || 'BIN_ERROR';
    }
    out.push(row);
  }
  return out;
}

/* ── baseline document: {version, generatedAt, targets:{<id>:{files:[...]}}} ── */
async function buildBaseline(targets) {
  const doc = { version: 1, generatedAt: new Date().toISOString(), targets: {} };
  for (const t of targets) {
    if (!t.available) continue; // target không có → không ghi vào baseline (khai báo bằng available:false khi verify)
    doc.targets[t.id] = await targetManifest(t);
  }
  return doc;
}

/* ── ghi baseline NGUYÊN TỬ (tmp + rename) — chỉ gọi khi user yêu cầu rõ ── */
function writeBaselineAtomic(file, doc) {
  const tmp = file + '.part-' + process.pid + '-' + Date.now();
  try {
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw errCode('BIN_WRITE_FAILED', 'Không ghi được baseline: ' + file + ' — ' + err.message);
  }
  return { ok: true, path: file };
}

/* ── đọc baseline; JSON hỏng → BIN_BASELINE_BAD (không fallback rỗng) ── */
function loadBaseline(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
  try {
    const doc = JSON.parse(text);
    if (!doc || typeof doc !== 'object' || typeof doc.targets !== 'object') throw new Error('thiếu targets');
    return doc;
  } catch (err) {
    throw errCode('BIN_BASELINE_BAD', 'Baseline binary hỏng (JSON không đọc được): ' + file + ' — ' + err.message);
  }
}

module.exports = { sha256File, listFilesRecursive, buildDirManifest, buildFileManifest, diffManifests, parseSums, verifySumsInDir, resolveTargets, targetManifest, verifyTargets, buildBaseline, writeBaselineAtomic, loadBaseline };



