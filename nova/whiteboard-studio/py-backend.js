'use strict';
/* ============================================================
   WHITEBOARD STUDIO — Python backend bridge (main process)
   ------------------------------------------------------------
   Viết lại theo đúng workflow repo "srt-whiteboard-animation"
   (vendored tại whiteboard-studio/srt-whiteboard-animation/,
   KHÔNG sửa nguồn repo):
   - prepare():  dựng .venv + deps (scripts/prepare_env.py)
   - status():   repo / venv / deps / hand png / ffmpeg
   - parseSrt(): scripts/parse_srt.py → { cues, scenes }
   - previewAnnotation(): scripts/render_annotation_preview.py
     → ảnh sơ đồ vùng (kiểm tra vùng trước khi render)
   - exportVideo(): render từng cảnh bằng
     scripts/render_stream_whiteboard.py (annotation do UI tạo
     qua whiteboard-annotation.js — KHÔNG tự sinh dải ở đây),
     merge bằng scripts/merge_scenes.py, ghép voice bằng ffmpeg
     nội bộ. Mọi tiến trình con được theo dõi để cancel.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { FFMPEG, FFPROBE, ffmpegAvailable } = require('./ff-runtime');
const Annotation = require('../web/whiteboard-annotation.js');

const REPO_DIR = path.join(__dirname, 'srt-whiteboard-animation');
const SCRIPTS_DIR = path.join(REPO_DIR, 'scripts');
const RENDER_SCRIPT = path.join(SCRIPTS_DIR, 'render_stream_whiteboard.py');
const BRIDGE_SCRIPT = path.join(__dirname, 'render-progress-bridge.py');  // chạy vendored script + đếm khung WBPROG (file của Nova, KHÔNG thuộc repo vendored)
const PARSE_SCRIPT = path.join(SCRIPTS_DIR, 'parse_srt.py');
const MERGE_SCRIPT = path.join(SCRIPTS_DIR, 'merge_scenes.py');
const PREPARE_SCRIPT = path.join(SCRIPTS_DIR, 'prepare_env.py');
const PREVIEW_SCRIPT = path.join(SCRIPTS_DIR, 'render_annotation_preview.py');
const HAND_PNG = path.join(REPO_DIR, 'assets', 'drawing-hand.png');
const DEPS_CODE = 'import cv2, numpy, av, PIL';

const DEFAULTS = {
  inkPath: 'grid',          // grid | skeleton
  colorFill: 'contour-wipe', // contour-wipe | brush
  tipMode: 'hand',           // hand (bàn tay cầm bút) | pen (ngòi bút) | none (không hiệu ứng)
  brushRadius: null,         // null = mặc định renderer
  capLongEdge: 1080,
  fps: null,                 // null = mặc định renderer
  pause: null,               // null = mặc định renderer (heavy)
};

/* ── theo dõi tiến trình con để cancel ── */
const activeChildren = new Set();
function cancelAll() {
  let killed = 0;
  for (const ch of Array.from(activeChildren)) {
    try { ch.kill(); killed++; } catch (_) {}
  }
  return killed;
}

function childEnv() {
  const env = Object.assign({}, process.env);
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  env.PYTHONUNBUFFERED = '1';   // stdout engine chảy live (mặc định bị buffer kín khi pipe)
  if (FFMPEG && path.isAbsolute(FFMPEG)) {
    env.PATH = path.dirname(FFMPEG) + path.delimiter + (env.PATH || '');
  }
  return env;
}

function spawnTracked(cmd, args, opts) {
  const child = spawn(cmd, args, Object.assign({ windowsHide: true, env: childEnv() }, opts || {}));
  activeChildren.add(child);
  const drop = () => { try { activeChildren.delete(child); } catch (_) {} };
  child.on('close', drop);
  child.on('error', drop);
  return child;
}

/* ── dọn rác ──
   Luật 10 áp dụng nghịch: rác là lỗi phải LO, không nuốt thầm.
   removeDirWithRetry: xoá ngay; Windows còn giữ handle (AV/indexer) thì thử lại
   5s → 15s; hết lượt thì nói rõ để sweep lần sau dọn nốt. */
function removeDirNow(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch (_) { return false; }
}
function removeDirWithRetry(dir, say) {
  if (!dir) return;
  if (removeDirNow(dir)) return;
  const delays = [5000, 15000];
  let k = 0;
  const tick = () => {
    if (k >= delays.length) {
      if (say) say('⚠ chưa xoá được thư mục tạm ' + dir + ' — sẽ bị dọn bởi sweep lần sau.');
      return;
    }
    const t = setTimeout(() => { if (!removeDirNow(dir)) tick(); }, delays[k++]);
    if (t.unref) t.unref();
  };
  tick();
}

/* sweep rác mồ côi trong tmpdir: wb-stream-* cũ >1h (app crash/thoát sớm,
   smoke test node thoát trước timer 5s) + wb-studio-preview-* cũ >24h.
   Gọi từ status() khi panel mở tool; guard 1 lần/giờ để không quét liên tục. */
let _lastSweep = 0;
function sweepStale(now) {
  const ts = now || Date.now();
  if (ts - _lastSweep < 3600 * 1000) return { swept: 0, skipped: true };
  _lastSweep = ts;
  let swept = 0;
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      const isStream = /^wb-stream-/.test(name);
      const isPreview = /^wb-studio-preview-/.test(name);
      const isSmoke = /^hd-smoke-/.test(name);   // output mp4 của _smoke_handdraw.js
      if (!isStream && !isPreview && !isSmoke) continue;
      const dir = path.join(os.tmpdir(), name);
      let age = 0;
      try { age = ts - fs.statSync(dir).mtimeMs; } catch (_) { continue; }
      const limitMs = isStream ? 3600 * 1000 : 24 * 3600 * 1000;
      if (age > limitMs && removeDirNow(dir)) swept++;
    }
  } catch (_) { /* sweep fail không được chặn status() — lần sau thử lại */ }
  return { swept };
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', done = false, timer = null;
    const finish = (r) => { if (done) return; done = true; if (timer) clearTimeout(timer); resolve(r); };
    const child = spawnTracked(cmd, args);
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
      if (opts.onStdout) { try { opts.onStdout(d.toString('utf8')); } catch (_) {} }
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
      if (opts.onStderr) { try { opts.onStderr(d.toString('utf8')); } catch (_) {} }
    });
    child.on('close', (code) => finish({ ok: code === 0, code, stdout, stderr }));
    child.on('error', (err) => finish({ ok: false, code: -1, stdout, stderr: String(err && err.message || err) }));
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        try { child.kill(); } catch (_) {}
        finish({ ok: false, code: -1, stdout, stderr: 'timeout sau ' + Math.round(opts.timeoutMs / 1000) + 's' });
      }, opts.timeoutMs);
    }
  });
}

/* ── đường dẫn / trạng thái ── */
function venvPythonPath() {
  return process.platform === 'win32'
    ? path.join(REPO_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(REPO_DIR, '.venv', 'bin', 'python');
}
function repoPresent() {
  return fs.existsSync(RENDER_SCRIPT) && fs.existsSync(MERGE_SCRIPT) && fs.existsSync(PARSE_SCRIPT);
}
function venvReady() { return fs.existsSync(venvPythonPath()); }
function handReady() { return fs.existsSync(HAND_PNG); }

async function depsReady(py) {
  if (!py) return false;
  const r = await runCapture(py, ['-c', DEPS_CODE], { timeoutMs: 90000 });
  return r.ok;
}

async function status() {
  const swept = sweepStale();   // dọn rác mồ côi (wb-stream-*/wb-studio-preview-*) khi panel mở tool
  const py = venvReady() ? venvPythonPath() : null;
  const deps = py ? await depsReady(py) : false;
  return {
    ok: !!(repoPresent() && py && deps && handReady() && ffmpegAvailable()),
    swept: swept.swept,
    repoPath: REPO_DIR,
    repoPresent: repoPresent(),
    venvReady: !!(py && venvReady()),
    venvPy: py,
    deps,
    hand: handReady(),
    ffmpeg: ffmpegAvailable(),
    scripts: {
      render: RENDER_SCRIPT, parseSrt: PARSE_SCRIPT, merge: MERGE_SCRIPT,
      prepare: PREPARE_SCRIPT, preview: PREVIEW_SCRIPT,
    },
  };
}

/* ── dựng môi trường (lần đầu) ── */
async function prepare(onLog) {
  if (!repoPresent()) {
    return { ok: false, error: 'Không tìm thấy repo srt-whiteboard-animation tại ' + REPO_DIR };
  }
  const sysPy = process.env.NOVA_WB_PYTHON || 'python';
  const r = await runCapture(sysPy, [PREPARE_SCRIPT], {
    timeoutMs: 15 * 60 * 1000,
    onStderr: onLog,
  });
  const m = /\bENV_PY=(.+)/.exec((r.stdout || '') + '\n' + (r.stderr || ''));
  const envPy = m ? m[1].trim() : null;
  if (!r.ok || !envPy) {
    return { ok: false, error: 'prepare_env.py thất bại: ' + ((r.stderr || r.stdout || '').trim().slice(0, 400)) };
  }
  if (onLog) { try { onLog('kiểm tra engine (repo/venv/deps)…'); } catch (_) {} }   // deps check có thể mất vài giây — label phải nhích sớm (report() không tồn tại ở scope này)
  const st = await status();
  return { ok: st.ok, envPy, status: st, error: st.ok ? undefined : 'Venv đã dựng nhưng thiếu dependencies' };
}

/* ── bước 1 repo: parse SRT → cues + scenes 25–35s ── */
async function parseSrt(srtPath, opts = {}) {
  if (!srtPath || !fs.existsSync(srtPath)) return { ok: false, error: 'Không tìm thấy file SRT: ' + srtPath };
  const cues = Annotation.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
  if (!cues.length) return { ok: false, error: 'Không parse được cue nào từ SRT (kiểm tra định dạng)' };
  // ưa tiên Python repo; venv chưa có → port JS (cùng thuật toán group_scenes)
  if (!repoPresent() || !venvReady()) {
    return { ok: true, engine: 'js-fallback', data: { cues, scenes: Annotation.groupScenes(cues, opts) } };
  }
  const py = venvPythonPath();
  const args = [
    PARSE_SCRIPT, srtPath,
    '--target-sec', String(opts.targetSec || 30),
    '--min-sec', String(opts.minSec || 25),
    '--max-sec', String(opts.maxSec || 35),
  ];
  const r = await runCapture(py, args, { timeoutMs: 60000 });
  if (!r.ok) {
    return { ok: true, engine: 'js-fallback', data: { cues, scenes: Annotation.groupScenes(cues, opts) }, warning: (r.stderr || '').trim().slice(0, 200) };
  }
  try { return { ok: true, engine: 'srt-whiteboard-animation', data: JSON.parse(r.stdout) }; }
  catch (err) { return { ok: false, error: 'SRT JSON lỗi: ' + String(err && err.message || err) }; }
}

/* ── đọc kích thước ảnh (PIL trong venv) ── */
async function probeImageSize(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  const py = venvReady() ? venvPythonPath() : null;
  if (!py) return null;
  const code = 'import sys; from PIL import Image; im=Image.open(sys.argv[1]); print(im.size[0], im.size[1])';
  const r = await runCapture(py, ['-c', code, imagePath], { timeoutMs: 60000 });
  if (!r.ok) return null;
  const m = /(\d+)\s+(\d+)/.exec(r.stdout || '');
  return m ? { width: parseInt(m[1], 10), height: parseInt(m[2], 10) } : null;
}

/* ── thư mục preview tồn tại suốt phiên (ảnh sơ đồ vùng) ── */
let _previewDir = null;
function previewDir() {
  if (_previewDir && fs.existsSync(_previewDir)) return _previewDir;
  _previewDir = path.join(os.tmpdir(), 'wb-studio-preview-' + process.pid);
  fs.mkdirSync(_previewDir, { recursive: true });
  return _previewDir;
}
let _previewSeq = 0;

/* ── bước 4 repo: ảnh sơ đồ vùng (render_annotation_preview.py) ── */
async function previewAnnotation(imagePath, annotation) {
  if (!imagePath || !fs.existsSync(imagePath)) return { ok: false, error: 'Không tìm thấy ảnh: ' + imagePath };
  const st = await status();
  if (!st.venvReady || !fs.existsSync(PREVIEW_SCRIPT)) {
    return { ok: false, error: 'Engine Python chưa sẵn sàng (cần .venv + repo)' };
  }
  const v = Annotation.validateAnnotation(annotation);
  if (!v.ok) return { ok: false, error: 'Annotation chưa hợp lệ: ' + v.errors.join('; ') };
  const dir = previewDir();
  const n = ++_previewSeq;
  const annPath = path.join(dir, 'ann-' + n + '.json');
  const outPath = path.join(dir, 'preview-' + n + '.jpg');
  fs.writeFileSync(annPath, JSON.stringify(annotation, null, 2), 'utf8');
  const r = await runCapture(st.venvPy, [PREVIEW_SCRIPT, imagePath, annPath, outPath], { timeoutMs: 60000 });
  if (!r.ok || !fs.existsSync(outPath)) {
    return { ok: false, error: 'render_annotation_preview.py lỗi: ' + ((r.stderr || r.stdout || '').trim().slice(0, 300) || 'không rõ') };
  }
  return { ok: true, previewPath: outPath, warnings: v.warnings || [] };
}

/* ── đo thời lượng video/audio bằng ffprobe nội bộ ── */
async function probeMediaDuration(mediaPath) {
  if (!FFPROBE || !mediaPath || !fs.existsSync(mediaPath)) return 0;
  const r = await runCapture(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mediaPath], { timeoutMs: 30000 });
  const v = parseFloat((r.stdout || '').trim());
  return isFinite(v) ? v : 0;
}

/* ── ghép voice vào video bằng ffmpeg nội bộ ── */
async function muxAudio(videoPath, audioTrack, outPath, onLog) {
  if (!ffmpegAvailable()) {
    if (onLog) onLog('ffmpeg nội bộ không có — giữ video không tiếng.');
    return { ok: false, error: 'ffmpeg unavailable', path: videoPath };
  }
  const args = ['-y', '-loglevel', 'error', '-i', videoPath, '-i', audioTrack.path];
  const startMs = Math.max(0, Math.round((Number(audioTrack.start_time) || 0) * 1000));
  if (startMs > 0) args.push('-af', 'adelay=' + startMs + '|' + startMs);
  args.push('-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', outPath);
  const r = await runCapture(FFMPEG, args, { timeoutMs: 10 * 60 * 1000 });
  return { ok: r.ok, error: r.ok ? undefined : (r.stderr || '').trim().slice(0, 400), path: r.ok ? outPath : videoPath };
}

/* ── bước cuối repo: render từng cảnh → merge → (voice) ──
   scenes: [{ sceneId, image, durationMs, elements[] | annotation, canvas }]
   annotation: scene.annotation (đã hoàn chỉnh) hoặc do
   whiteboard-annotation.js toAnnotation(elements) dựng. */
async function exportVideo({ scenes, outputPath, audioTracks, options, onProgress, onLog } = {}) {
  const opt = Object.assign({}, DEFAULTS, options || {});
  if (!Array.isArray(scenes) || !scenes.length) return { ok: false, error: 'Danh sách cảnh rỗng' };
  for (const s of scenes) {
    if (!s || !s.image || !fs.existsSync(s.image)) {
      return { ok: false, error: 'Cảnh thiếu ảnh hợp lệ: ' + ((s && s.sceneId) || '?') + ' — ' + ((s && s.image) || 'không có ảnh') };
    }
  }
  if (!outputPath) return { ok: false, error: 'Thiếu outputPath' };

  const say = (msg) => { if (onLog) { try { onLog(msg); } catch (_) {} } };
  /* File bán phần tại outputPath người dùng chọn: khi export lỗi/huỷ, xoá file
     hỏng ta vừa ghi (chỉ khi do export này tạo) — không để rác trên Desktop.
     Luật 10: mọi đường fail phải qua đây để vừa trả lỗi vừa dọn. */
  let wroteOutput = false;
  const fail = (error) => {
    if (wroteOutput && outputPath && fs.existsSync(outputPath)) {
      try { fs.rmSync(outputPath, { force: true }); say('⚠ đã xoá file bán phần hỏng tại ' + outputPath); }
      catch (e) { say('⚠ không xoá được file bán phần tại ' + outputPath + ' (' + ((e && e.message) || e) + ') — hãy xoá tay.'); }
    }
    return { ok: false, error };
  };

  const st = await status();
  if (!st.ok) {
    return fail('Engine Python chưa sẵn sàng (repo/venv/deps/hand): ' + JSON.stringify({ repo: st.repoPresent, venv: st.venvReady, deps: st.deps, hand: st.hand }));
  }
  const py = st.venvPy;
  if (!fs.existsSync(BRIDGE_SCRIPT)) {
    return fail('Thiếu render-progress-bridge.py: ' + BRIDGE_SCRIPT);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-stream-'));
  const report = (percent, statusMsg) => {
    if (onProgress) { try { onProgress({ percent, status: statusMsg }); } catch (_) {} }
  };

  report(2, 'khởi tạo engine stream-ink');
  const sceneFiles = [];
  const sceneSecs = [];   // giây render mỗi cảnh đã xong — dự tính ETA các cảnh còn lại
  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const size = await probeImageSize(scene.image);
      if (!size || !size.width || !size.height) {
        return fail('Không đọc được kích thước ảnh: ' + scene.image);
      }
      // annotation: ưu tiên scene.annotation; ngược lại dựng từ elements (UI)
      let ann;
      if (scene.annotation && Array.isArray(scene.annotation.elements)) {
        ann = JSON.parse(JSON.stringify(scene.annotation));
        ann.canvas = ann.canvas || size;
      } else {
        ann = Annotation.toAnnotation(scene, scene.canvas || size);
      }
      const durationMs = Math.max(1500, Math.round(Number(scene.durationMs) || ann.sceneDurationMs || 4000));
      ann.sceneDurationMs = durationMs;
      const v = Annotation.validateAnnotation(ann);
      if (!v.ok) {
        return fail('Cảnh ' + (i + 1) + ' annotation lỗi: ' + v.errors.join('; '));
      }
      for (const w of (v.warnings || [])) say('⚠ ' + w);

      const base = 'scene-' + String(i + 1).padStart(3, '0');
      const annPath = path.join(workDir, base + '.annotation.json');
      const sceneOut = path.join(workDir, base + '.mp4');
      fs.writeFileSync(annPath, JSON.stringify(ann, null, 2), 'utf8');

      // tipMode: 'hand' → sprite bàn tay | 'pen' → hand='' (engine tự vẽ ngòi bút procedural) | 'none' → --bare-tip
      const handArg = opt.tipMode === 'pen' ? '' : HAND_PNG;
      const args = [
        scene.image, annPath, sceneOut, handArg,   // chạy qua BRIDGE_SCRIPT (đếm khung thật) — bridge tự thêm RENDER_SCRIPT
        '--total-ms', String(durationMs),
        '--ink-path', String(opt.inkPath),
        '--color-fill', String(opt.colorFill),
        '--cap-long-edge', String(opt.capLongEdge || 1080),
      ];
      if (opt.tipMode === 'none') args.push('--bare-tip');
      if (opt.brushRadius) args.push('--brush-radius', String(Math.max(1, Math.round(opt.brushRadius))));
      if (opt.fps) args.push('--fps', String(Math.round(opt.fps)));
      if (opt.pause) args.push('--pause', String(opt.pause));

      report(5 + Math.round((i / scenes.length) * 80),
        'cảnh ' + (i + 1) + '/' + scenes.length + ' · khởi động engine…');
      say('render_stream_whiteboard: ' + path.basename(scene.image) + ' (' + durationMs + 'ms)');

      /* ── tiến trình THẬT theo khung hình ──
         render-progress-bridge.py (file của Nova, repo vendored giữ nguyên)
         bọc cv2.VideoWriter đếm TỪNG KHUNG engine ghi, phát WBPROG ra stderr.
         % = khung đã ghi / tổng khung dự kiến (durationMs × fps + ~0.6s gaze
         cuối cảnh); tốc độ + ETA tính từ nhịp khung thật. Engine im lặng giữa
         các giai đoạn → ticker 2s KHÔNG bò % giả nữa, chỉ gán nhãn giai đoạn
         (tính vùng/nét CPU trước khung đầu) và cảnh báo ngừng ghi khung (kẹt). */
      const sceneStartPct = 5 + (i / scenes.length) * 80;
      const sceneEndPct = 5 + ((i + 1) / scenes.length) * 80;
      const estCeil = Math.max(sceneStartPct, sceneEndPct - 1);  // >80 cảnh: dải <1% — không cho tụt dưới mốc bắt đầu
      const clampPct = (p) => Math.max(sceneStartPct, Math.min(estCeil, p));
      const t0 = Date.now();
      let pyFps = 0;            // fps writer (WBPROG open)
      let estTotal = 0;         // tổng khung dự kiến của cảnh
      let frames = 0;           // khung đã ghi (WBPROG frame)
      let lastFrameAt = 0;      // mốc khung cuối — phát hiện ngừng ghi
      let transcode = false;    // đã vào giai đoạn chuyển mã H.264
      let lastReportAt = 0;     // throttle sự kiện IPC (~2-3/s, không làm ngập relay)
      let errBuf = '';          // stderr line-buffer (pipe gộp/ngắt dòng)
      let outBuf = '';          // stdout line-buffer
      const etaOf = (sec) => {
        sec = Math.max(0, Math.round(sec));
        return sec >= 90 ? '~' + Math.round(sec / 60) + ' phút' : '~' + sec + 's';
      };
      const restTxt = () => {   // ETA các cảnh CHƯA render (theo trung bình cảnh đã xong)
        if (!sceneSecs.length || i + 1 >= scenes.length) return '';
        const avg = sceneSecs.reduce((a, b) => a + b, 0) / sceneSecs.length;
        return ' · sau đó ' + (scenes.length - i - 1) + ' cảnh ≈ ' + etaOf(avg * (scenes.length - i - 1));
      };
      const pushStatus = (pct, msg) => {
        const now = Date.now();
        if (now - lastReportAt < 400) return;
        lastReportAt = now;
        report(pct, msg);
      };
      const onFrame = (n) => {
        frames = n;
        lastFrameAt = Date.now();
        if (!pyFps) return;     // chưa biết fps → chỉ theo dõi stall
        const span = Math.max(0, sceneEndPct - sceneStartPct);
        const done = Math.min(1, frames / Math.max(1, estTotal));
        const rate = frames / Math.max(0.5, (lastFrameAt - t0) / 1000);   // khung/s trung bình
        const eta = rate > 0.05 ? (Math.max(1, estTotal) - frames) / rate : 0;
        pushStatus(clampPct(sceneStartPct + done * span),
          'cảnh ' + (i + 1) + '/' + scenes.length +
          ' · khung ' + frames + '/' + estTotal +
          ' · ' + rate.toFixed(1) + ' khung/s' +
          ' · còn ' + etaOf(eta) + restTxt());
      };
      const handleStderr = (chunk) => {
        errBuf += chunk;
        let nl;
        while ((nl = errBuf.indexOf('\n')) >= 0) {
          const line = errBuf.slice(0, nl).replace(/\r$/, '');
          errBuf = errBuf.slice(nl + 1);
          if (line.indexOf('WBPROG ') === 0) {
            let m = /^WBPROG open fps=(\S+) w=(\d+) h=(\d+)/.exec(line);
            if (m) {
              pyFps = parseFloat(m[1]) || 0;
              estTotal = pyFps > 0 ? Math.max(1, Math.round((durationMs / 1000) * pyFps)) : 0;
              lastReportAt = 0;   // báo "bắt đầu ghi khung" đi qua throttle ngay
              pushStatus(sceneStartPct,
                'cảnh ' + (i + 1) + '/' + scenes.length + ' · bắt đầu ghi khung (' +
                (pyFps ? Math.round(pyFps) + ' fps, ~' + estTotal + ' khung' : 'fps chưa rõ') + ')');
            }
            m = /^WBPROG frame=(\d+)/.exec(line);
            if (m) onFrame(parseInt(m[1], 10));
            if (/^WBPROG transcode\b/.test(line)) {
              transcode = true;
              lastReportAt = 0;
              pushStatus(clampPct(estCeil),
                'cảnh ' + (i + 1) + '/' + scenes.length + ' · chuyển mã H.264…' + restTxt());
            }
            if (/^WBPROG error/.test(line)) say('⚠ bridge: ' + line.slice('WBPROG error'.length).trim());
            continue;   // WBPROG là tín hiệu nội bộ — không đưa vào Log renderer
          }
          if (line.trim()) say(line);
        }
      };
      const handleStdout = (chunk) => {
        outBuf += chunk;
        let nl;
        while ((nl = outBuf.indexOf('\n')) >= 0) {
          const line = outBuf.slice(0, nl).replace(/\r$/, '');
          outBuf = outBuf.slice(nl + 1);
          if (line.indexOf('H.264') >= 0) {   // engine in dòng này khi chuyển mã xong → hoàn tất cảnh
            lastReportAt = 0;
            pushStatus(clampPct(estCeil), 'cảnh ' + (i + 1) + '/' + scenes.length + ' · hoàn tất…');
          }
        }
      };
      /* ticker 2s: gán nhãn giai đoạn im lặng của engine — KHÔNG bò % giả.
         - chưa có khung nào → đang tính vùng/nét CPU trước khi vẽ;
         - giữa chừng ngừng ghi >4s → đang nét vùng kế (nhãn sống, không đợi 25s);
         - ngừng ghi >25s → cảnh báo kẹt lộ liễu. */
      const ticker = setInterval(() => {
        if (frames === 0 && !transcode) {
          lastReportAt = 0;
          pushStatus(sceneStartPct,
            'cảnh ' + (i + 1) + '/' + scenes.length +
            ' · đang tính vùng/nét trước khi vẽ (CPU, đã ' + Math.round((Date.now() - t0) / 1000) + 's)…' + restTxt());
        } else if (frames > 0 && !transcode && Date.now() - lastFrameAt > 25000) {
          lastReportAt = 0;
          const span = Math.max(0, sceneEndPct - sceneStartPct);
          const done = pyFps ? Math.min(1, frames / Math.max(1, estTotal)) : 0;
          pushStatus(clampPct(sceneStartPct + done * span),
            '⚠ cảnh ' + (i + 1) + '/' + scenes.length + ' · ngừng ghi khung ' +
            Math.round((Date.now() - lastFrameAt) / 1000) + 's — engine đang tính nặng hoặc kẹt');
        } else if (frames > 0 && !transcode && Date.now() - lastFrameAt > 4000) {
          lastReportAt = 0;
          pushStatus(clampPct(sceneStartPct + (Math.min(1, frames / Math.max(1, estTotal)) * Math.max(0, sceneEndPct - sceneStartPct))),
            'cảnh ' + (i + 1) + '/' + scenes.length + ' · đang nét vùng tiếp theo (đã ' + frames + '/' + estTotal + ' khung)…');
        }
      }, 2000);
      if (ticker.unref) ticker.unref();
      let r;
      try {
        r = await runCapture(py, [BRIDGE_SCRIPT].concat(args),
          { timeoutMs: 30 * 60 * 1000, onStderr: handleStderr, onStdout: handleStdout });
      } finally {
        clearInterval(ticker);
      }
      const om = /OUTPUT=(.+)/.exec((r.stdout || '') + '\n' + (r.stderr || ''));
      const finalScene = om ? om[1].trim() : sceneOut;
      if (!r.ok || !fs.existsSync(finalScene)) {
        return fail('Render cảnh ' + (i + 1) + ' lỗi: ' + ((r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' | ') || 'không rõ'));
      }
      sceneFiles.push(fs.realpathSync(finalScene));
      sceneSecs.push((Date.now() - t0) / 1000);
      report(5 + Math.round(((i + 1) / scenes.length) * 80),
        'xong cảnh ' + (i + 1) + '/' + scenes.length +
        ' (' + sceneSecs[sceneSecs.length - 1].toFixed(1) + 's' +
        (frames ? ' · ' + frames + ' khung' : '') + ')' + restTxt());
    }

    /* merge tất cả cảnh (merge_scenes.py) */
    const hasAudio = !!(audioTracks && audioTracks.length && audioTracks[0] && audioTracks[0].path && fs.existsSync(audioTracks[0].path));
    const mergedPath = hasAudio ? path.join(workDir, 'merged.mp4') : outputPath;
    if (sceneFiles.length === 1 && !hasAudio) {
      wroteOutput = true;                       // copy ghi thẳng vào đích người dùng
      fs.copyFileSync(sceneFiles[0], outputPath);
      report(92, 'sao chép video');
    } else {
      report(88, 'ghép ' + sceneFiles.length + ' cảnh');
      if (!hasAudio) wroteOutput = true;        // mergedPath === outputPath — merge ghi thẳng đích
      const mArgs = [MERGE_SCRIPT, '--inputs'].concat(sceneFiles).concat(['--output', mergedPath]);
      const mr = await runCapture(py, mArgs, { timeoutMs: 10 * 60 * 1000, onStderr: say });
      if (!mr.ok || !fs.existsSync(mergedPath)) {
        return fail('Merge lỗi: ' + ((mr.stderr || mr.stdout || '').trim().slice(0, 300) || 'không rõ'));
      }
    }

    /* ghép voice-over nếu có */
    if (hasAudio) {
      report(94, 'ghép voice-over');
      wroteOutput = true;                       // mux ghi thẳng vào outputPath
      const ar = await muxAudio(mergedPath, audioTracks[0], outputPath, say);
      if (!ar.ok) {
        say('⚠ Không ghép được voice (' + (ar.error || '?') + ') — xuất video không tiếng.');
        fs.copyFileSync(mergedPath, outputPath);
      }
    }

    const durationSec = await probeMediaDuration(outputPath);
    report(100, 'done');
    return { ok: true, path: outputPath, durationSec, scenes: sceneFiles.length, engine: 'srt-whiteboard-animation' };
  } finally {
    // dọn workdir nền trên MỌI đường thoát (ok/lỗi/huỷ/timed-out);
    // xoá ngay, Windows còn giữ handle thì retry 5s→15s (removeDirWithRetry)
    removeDirWithRetry(workDir, say);
  }
}

module.exports = {
  status, prepare, parseSrt, cancelAll, exportVideo, previewAnnotation,
  probeImageSize, probeMediaDuration, repoDir: REPO_DIR, sweepStale,
};

