// Render Remotion ĐẦY ĐỦ (text/motion/composition) bằng @remotion/renderer + bundle tĩnh + chrome vendored.
// Bundle tĩnh: editor-pro/remotion-bundle. Compositor đã ký ad-hoc (gỡ hardened) → set DYLD cho ffmpeg con.
const { dialog, BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
// §32.17 — thông báo lỗi render tiếng Việt (bảng mã + dịch lỗi hệ thống dùng chung với Video Agent).
const { viText } = require('../video-agent/errors');
// Hardlink-restore (học từ TDTStudio export_plate_cache.py) — xem nova/core/link-or-copy.js.
const { hardlinkOrCopy } = require('../core/link-or-copy');

const DIR = __dirname;
// Trong app đóng gói, __dirname nằm TRONG app.asar — chỉ đọc được, KHÔNG ghi được, và Remotion
// cần phục vụ file thật từ đĩa. Các thư mục nặng đã nằm trong asarUnpack nên trỏ sang bản đã bung.
const UNPACKED = DIR.includes('app.asar') && !DIR.includes('app.asar.unpacked')
  ? DIR.replace('app.asar', 'app.asar.unpacked') : DIR;
function onDisk(rel) {
  const a = path.join(UNPACKED, rel);
  if (fs.existsSync(a)) return a;
  return path.join(DIR, rel);            // chạy từ mã nguồn (dev)
}
const BUNDLE = onDisk('remotion-bundle');
const COMPOSITOR = path.join(DIR, 'node_modules', '@remotion', 'compositor-darwin-arm64');
const TMP = path.join(os.tmpdir(), 'nova-editor-pro');
try { fs.mkdirSync(TMP, { recursive: true }); } catch (_) {}

function findBrowser(rootOverride) {
  const root = rootOverride || onDisk('remotion-browser');
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === 'chrome-headless-shell' || e.name === 'chrome-headless-shell.exe') return p;
    }
  }
  return null;
}
const BROWSER = findBrowser();

/* Bản đóng gói: .remotion trong node_modules bị loại khỏi package (nhẹ bản cài)
   → render Remotion không còn browser. Lần render đầu: tự bảo đảm chrome-headless-shell
   bằng ensureBrowser() của Remotion. Đích tải do getDownloadsCacheDir() quyết định:
   nó đi ngược từ process.cwd() tìm package.json gần nhất rồi nối node_modules/.remotion
   (không thấy package.json nào thì rơi về cwd/.remotion). Để chắc chắn rơi vào nơi GHI
   được, tạo userData/.remotion/package.json rỗng và chdir vào đúng đó khi tải; tải xong
   HOÀN LẠI cwd (đừng để main process đổi cwd vĩnh viễn — các spawn khác kế thừa cwd). */
async function resolveBrowserExecutable() {
  if (BROWSER) return BROWSER;                                   // dev/browser vendored (nếu có)
  const packaged = String(DIR).includes('app.asar');
  if (!packaged) return undefined;                               // dev: Remotion tự tìm node_modules/.remotion như cũ
  let ud = null;
  try { ud = app.getPath('userData'); } catch (_) { return undefined; }
  if (!ud) return undefined;
  const remDir = path.join(ud, '.remotion');
  try {
    fs.mkdirSync(remDir, { recursive: true });
    if (!fs.existsSync(path.join(remDir, 'package.json'))) {
      fs.writeFileSync(path.join(remDir, 'package.json'), '{\n}\n');   // neo đích tải → remDir/node_modules/.remotion
    }
  } catch (_) {}
  const have = findBrowser(remDir);
  if (have) return have;
  const prevCwd = process.cwd();
  try { process.chdir(remDir); } catch (_) {}
  try {
    const { ensureBrowser } = require('@remotion/renderer');
    await ensureBrowser();
  } catch (e) {
    console.warn('[remotion] không tải được chrome-headless-shell (cần Internet lần đầu render):', e && e.message);
  } finally {
    try { process.chdir(prevCwd); } catch (_) {}
  }
  return findBrowser(remDir) || undefined;
}

// Trong app đóng gói, binary @remotion/compositor-* nằm trong app.asar → Remotion gọi
// execa (child_process.spawn) không chạy được (Electron KHÔNG patch spawn cho asar).
// Trỏ `binariesDirectory` sang bản đã asarUnpack (xem electron-builder.json asarUnpack)
// để ffmpeg/remotion/ffprobe thật được spawn từ đĩa. Dev: require.resolve trả đường dẫn
// thật (không chứa 'app.asar') → trả undefined → dùng mặc định của Remotion.
function remotionBinariesDirectory() {
  try {
    const pkg = require.resolve('@remotion/compositor-win32-x64-msvc/package.json');
    if (pkg.includes('app.asar') && !pkg.includes('app.asar.unpacked')) {
      const unpacked = pkg.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) return path.dirname(unpacked);
    }
  } catch (_) {}
  return undefined;
}
const REMOTION_BIN_DIR = remotionBinariesDirectory();

async function renderRemotionFull({ composition, outputPath, onProgress }) {
  // remotion-bundle đã gỡ khỏi bản này (chỉ bàn dựng Editor Pro dùng, mà bàn
  // dựng đó không còn lối vào). App chính xuất video bằng renderNovaScenes.
  if (!fs.existsSync(BUNDLE)) return { ok: false, error: 'Đường render Remotion cũ đã gỡ — dùng Dựng Video (Nova Scene) để xuất.' };
  // ffmpeg con (đã gỡ hardened) cần DYLD trỏ dylib compositor — set trước khi renderMedia spawn nó
  if (fs.existsSync(COMPOSITOR)) {
    process.env.DYLD_LIBRARY_PATH = COMPOSITOR + (process.env.DYLD_LIBRARY_PATH ? ':' + process.env.DYLD_LIBRARY_PATH : '');
  }
  const { selectComposition, renderMedia } = require('@remotion/renderer');
  const inputProps = { composition };
  const browserExecutable = await resolveBrowserExecutable();
  const comp = await selectComposition({ serveUrl: BUNDLE, id: 'VideoShuffleComposition', inputProps, browserExecutable, binariesDirectory: REMOTION_BIN_DIR });
  const out = outputPath || path.join(TMP, `nova-export-${Date.now()}.mp4`);
  try {
    await renderMedia({
      composition: comp, serveUrl: BUNDLE, codec: 'h264', outputLocation: out, inputProps, browserExecutable, binariesDirectory: REMOTION_BIN_DIR,
      concurrency: Math.max(2, Math.min(6, (os.cpus() || []).length - 2)),
      onProgress: ({ progress }) => { try { onProgress && onProgress(Math.round(progress * 100), 'Đang render (Remotion)…'); } catch (_) {} },
    });
  } catch (error) {
    // Render lỗi giữa chừng → xoá file dở, không để lại MP4 hỏng/nửa vời.
    try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
    throw error;
  }
  return { ok: true, outputPath: out, engine: 'remotion' };
}

// ── NOVA SCENE ENGINE ───────────────────────────────────────────────────────
// Bundle riêng (nova-remotion) thông dịch SPEC JSON do AI sinh cho từng cảnh.
// Thời lượng do calculateMetadata tính từ spec → luôn khớp giây của cảnh.
const NOVA_BUNDLE = onDisk(path.join('nova-remotion', 'bundle'));

// Remotion CHỈ tải được asset qua http/https hoặc đường dẫn tương đối trong thư mục phục vụ —
// ném file:// hay đường dẫn tuyệt đối vào <OffthreadVideo> sẽ lỗi "Can only download URLs starting with http".
// Nên: chép file cục bộ vào bundle/assets/ rồi đổi src thành đường dẫn tương đối.
// (Ảnh thì Tool 7 đã nhúng sẵn dạng data URL nên không qua đây.)
function stageLocalAssets(scenes) {
  const dir = path.join(NOVA_BUNDLE, 'assets');
  let staged = 0;
  const runId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const map = new Map();
  const fix = (src) => {
    const s = String(src || '');
    if (!s || /^(https?:|data:|assets\/)/i.test(s)) return s;     // đã dùng được, để nguyên
    const abs = s.replace(/^file:\/\//, '');
    if (!path.isAbsolute(abs) || !fs.existsSync(abs)) return s;
    if (map.has(abs)) return map.get(abs);
    try {
      fs.mkdirSync(dir, { recursive: true });
      const name = runId + '-a' + staged + '_' + path.basename(abs).replace(/[^\w.-]/g, '_');
      // Hardlink khi cùng ổ đĩa (TDTStudio export_plate_cache.py): asset video/ảnh lớn
      // không bị chép lại mỗi render — gần như 0 I/O ghi, 0 dung lượng thêm. Khác ổ /
      // FS không hỗ trợ → fallback copy (hành vi cũ, mã khai báo 'copy:<code>').
      // Hardlink chia sẻ inode: cleanupStaged() chỉ bỏ link, file gốc nguyên vẹn.
      hardlinkOrCopy(abs, path.join(dir, name));
      const rel = 'assets/' + name;
      map.set(abs, rel); staged++;
      return rel;
    } catch (_) { return s; }
  };
  /* Quét MỌI trường chuỗi của lớp, không chỉ `src`.
     Lớp thường mang đường dẫn ở `src`, nhưng lớp MẪU mang ở tên tham số riêng
     của mẫu — `nen`, `anh`, và cả mảng `the[]`. Bản cũ chỉ sửa `src` nên mọi
     mẫu dùng media ở trường khác đều 404 lúc render (đã đo: mẫu moc-thoi-gian,
     chong-the, dan-chung đều chết). Quét chung thì thêm mẫu mới cũng không phải
     nhớ khai báo lại ở đây.                                                  */
  const walk = (L) => {
    if (!L || typeof L !== 'object') return;
    for (const k of Object.keys(L)) {
      const v = L[k];
      if (typeof v === 'string') { const r = fix(v); if (r !== v) L[k] = r; }
      else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) if (typeof v[i] === 'string') { const r = fix(v[i]); if (r !== v[i]) v[i] = r; }
      }
    }
  };
  (Array.isArray(scenes) ? scenes : []).forEach(sp => (sp && Array.isArray(sp.layers) ? sp.layers : []).forEach(walk));
  return { count: staged, files: [...map.values()].map((rel) => path.join(NOVA_BUNDLE, rel)) };
}

// Nova Scene render ra video CÂM (Remotion chỉ dựng hình từ spec). Ghép giọng đọc + nhạc nền
// bằng ffmpeg ngay sau đó, để bản xuất dùng được luôn chứ không phải tự ghép tay.
// CPU budget (học từ TDTStudio): ffmpeg con chạy ưu tiên BELOW_NORMAL + số thread theo ngân sách,
// để máy yếu không bị khớp UI trong lúc mux.
const cpuBudget = require('./cpu-budget');
async function muxAudio({ videoPath, voiceB64, musicB64, musicVolume = 0.22, registerCancel, signal }) {
  if (!voiceB64 && !musicB64) return videoPath;
  const FFMPEG = require('./ff-path').FFMPEG;   // đường dẫn đã gỡ khỏi app.asar (spawn được)
  const { spawn } = require('child_process');
  const write = (b64, ext, label) => {
    if (!b64) return null;
    const raw = String(b64).replace(/^data:[^,]+,/, '');
    const f = path.join(TMP, `au-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`);
    try { fs.writeFileSync(f, Buffer.from(raw, 'base64')); return f; }
    catch (e) {
      // Luật 10 — không fallback ngầm: b64 giọng đọc CÓ SẴN mà ghi file tạm thất bại
      // (ổ đầy / antivirus khoá file) mà âm thầm bỏ qua → MP4 render xong nhưng MẤT GIỌNG
      // ĐỌC, người dùng phát hiện muộn. Fail lộ liễu với mã VA_MUX_WRITE_FAIL.
      const err = new Error(`Không ghi được file ${label} tạm vào ${TMP}: ${String((e && e.message) || e)}`);
      err.code = 'VA_MUX_WRITE_FAIL';
      throw err;
    }
  };
  const voice = write(voiceB64, 'mp3', 'giọng đọc'), music = write(musicB64, 'mp3', 'nhạc nền');
  if (!voice && !music) return videoPath;
  const out = videoPath.replace(/\.mp4$/i, '') + '-audio.mp4';
  const args = ['-y', '-i', videoPath];
  if (voice) args.push('-i', voice);
  if (music) args.push('-i', music);
  if (voice && music) {
    args.push('-filter_complex', `[2:a]volume=${musicVolume}[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]`, '-map', '0:v', '-map', '[a]');
  } else {
    args.push('-map', '0:v', '-map', '1:a');
    if (music && !voice) args.push('-filter:a', `volume=${musicVolume}`);
  }
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-threads', String(cpuBudget.videoThreads()), '-shortest', out);
  let cancelled = !!(signal && signal.aborted), child = null;
  const cancel = () => { cancelled = true; try { if (child) child.kill('SIGKILL'); } catch (_) {} };
  if (typeof registerCancel === 'function') registerCancel(cancel);
  if (signal && !signal.aborted) signal.addEventListener('abort', cancel, { once: true });
  try {
    if (cancelled) { const e = new Error('ffmpeg mux đã huỷ'); e.code = 'VA_CANCELLED'; throw e; }
    const status = await new Promise((resolve, reject) => {
      child = spawn(FFMPEG, args, { stdio: 'ignore', windowsHide: true });
      // CPU budget — hạ ưu tiên (best-effort, degrade có chủ đích phải được ghi nhận).
      const prio = cpuBudget.applyLowPriority(child);
      if (!prio.ok) { try { process.emitWarning('cpu-budget: không hạ được ưu tiên ffmpeg con — ' + prio.error, 'NovaCpuBudget'); } catch (_) {} }
      child.once('error', reject);
      child.once('close', (code) => resolve(code));
      if (cancelled) cancel();
    });
    if (cancelled) { const e = new Error('ffmpeg mux đã huỷ'); e.code = 'VA_CANCELLED'; throw e; }
    if (status !== 0 || !fs.existsSync(out)) {
      // Luật 10 — ffmpeg mux thất bại KHÔNG được trả video câm im lặng (người dùng mất
      // giọng đọc mà không hề hay biết). Xoá output dở và fail lộ liễu.
      try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
      const e = new Error(`ffmpeg ghép giọng đọc/nhạc nền thất bại (exit ${status}) — video không được trả về để tránh mất giọng âm thầm.`);
      e.code = 'VA_RENDER_FAIL';
      throw e;
    }
    try { fs.unlinkSync(videoPath); } catch (_) {}
    try { fs.renameSync(out, videoPath); return videoPath; } catch (_) { return out; }
  } catch (error) {
    try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
    throw error;
  } finally {
    if (signal) signal.removeEventListener('abort', cancel);
    [voice, music].forEach(f => { if (f) try { fs.unlinkSync(f); } catch (_) {} });
    if (cancelled) try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
  }
}

async function renderNovaScenes({ scenes, globals, outputPath, onProgress, voiceB64, musicB64, musicVolume, registerCancel, signal }) {
  if (!fs.existsSync(NOVA_BUNDLE)) return { ok: false, error: 'Thiếu nova-remotion/bundle — chạy: node editor-pro/nova-remotion/build.js' };
  let staged = { count: 0, files: [] };
  try { staged = stageLocalAssets(scenes); if (staged.count) onProgress && onProgress(1, `Đã đưa ${staged.count} file media vào bundle…`); } catch (_) {}
  const cleanupStaged = () => (staged.files || []).forEach((file) => { try { fs.unlinkSync(file); } catch (_) {} });
  if (fs.existsSync(COMPOSITOR)) {
    process.env.DYLD_LIBRARY_PATH = COMPOSITOR + (process.env.DYLD_LIBRARY_PATH ? ':' + process.env.DYLD_LIBRARY_PATH : '');
  }
  const { selectComposition, renderMedia, makeCancelSignal } = require('@remotion/renderer');
  const cancellation = makeCancelSignal();
  if (typeof registerCancel === 'function') registerCancel(cancellation.cancel);
  const abort = () => cancellation.cancel();
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  const inputProps = { scenes: Array.isArray(scenes) ? scenes : [], globals: Array.isArray(globals) ? globals : [] };
  const browserExecutable = await resolveBrowserExecutable();
  const out = outputPath || path.join(TMP, `nova-scene-${Date.now()}.mp4`);
  let comp;
  try {
    comp = await selectComposition({ serveUrl: NOVA_BUNDLE, id: 'NovaSequence', inputProps, browserExecutable, binariesDirectory: REMOTION_BIN_DIR });
    await renderMedia({
      composition: comp, serveUrl: NOVA_BUNDLE, codec: 'h264', outputLocation: out, inputProps, browserExecutable, binariesDirectory: REMOTION_BIN_DIR,
      concurrency: Math.max(1, Math.min(4, Math.max(1, (os.cpus() || []).length - 2))), cancelSignal: cancellation.cancelSignal,
      onProgress: ({ progress }) => { try { onProgress && onProgress(Math.round(progress * 100), 'Đang render (Nova Scene)…'); } catch (_) {} },
    });
    let finalPath = out;
    if (voiceB64 || musicB64) {
      onProgress && onProgress(98, 'Ghép giọng đọc + nhạc nền…');
      finalPath = await muxAudio({ videoPath: out, voiceB64, musicB64, musicVolume, registerCancel, signal });
    }
    return { ok: true, outputPath: finalPath, engine: 'nova-scene', durationInFrames: comp.durationInFrames, fps: comp.fps, hasAudio: !!(voiceB64 || musicB64) };
  } catch (error) {
    try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
    throw error;
  } finally {
    if (signal) signal.removeEventListener('abort', abort);
    cleanupStaged();
  }
}

function registerEditorProRemotion(ipcMain) {
  // Danh mục mẫu đồ hoạ — renderer hỏi để nhồi vào prompt cho AI. Lấy thẳng từ templates.js
  // thay vì chép sang index.html, để hai nơi không lệch nhau khi thêm mẫu mới.
  const chCat = 'nova:sceneTemplates';
  try { ipcMain.removeHandler(chCat); } catch (_) {}
  ipcMain.handle(chCat, async () => {
    try { return { ok: true, items: require('./nova-remotion/src/templates').catalog() }; }
    catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });

  // Lớp đồ hoạ tại 1 thời điểm, đã tính sẵn CSS — để bản xem trước ở Tool 7 vẽ bằng DOM.
  const chPv = 'nova:previewLayers';
  try { ipcMain.removeHandler(chPv); } catch (_) {}
  ipcMain.handle(chPv, async (e, payload = {}) => {
    try {
      delete require.cache[require.resolve('./nova-remotion/src/preview')];
      const { previewAt } = require('./nova-remotion/src/preview');
      return { ok: true, items: previewAt(payload.spec, Number(payload.t) || 0, payload.sceneSrc) };
    } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });

  // Ảnh xem trước của kho hiệu ứng — trả DATA URL để renderer khỏi lo đường dẫn asar.
  // 60 ảnh × ~5KB = 292KB, nạp 1 lần rồi cache trong renderer.
  const chPrev = 'nova:fxPreviews';
  try { ipcMain.removeHandler(chPrev); } catch (_) {}
  ipcMain.handle(chPrev, async () => {
    try {
      const dir = onDisk(path.join('nova-remotion', 'previews'));
      if (!fs.existsSync(dir)) return { ok: true, items: {} };
      const out = {};
      for (const f of fs.readdirSync(dir)) {
        if (!/\.jpg$/i.test(f)) continue;
        const key = f.replace(/\.jpg$/i, '');
        try { out[key] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'); } catch (_) {}
      }
      return { ok: true, items: out };
    } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });

  // Danh sách bit Remotion dùng được — đọc thẳng từ BitRegistry.tsx bằng regex
  // (file .tsx nên main process không require được, nhưng chỉ cần LẤY TÊN nên đọc văn bản là đủ).
  const chBit = 'nova:sceneBits';
  try { ipcMain.removeHandler(chBit); } catch (_) {}
  ipcMain.handle(chBit, async () => {
    try {
      const f = path.join(__dirname, 'nova-remotion', 'src', 'bits', 'BitRegistry.tsx');
      const src = fs.readFileSync(f, 'utf8');
      const i = src.indexOf('export const BIT_REGISTRY');
      const ids = [...src.slice(i).matchAll(/'([a-z0-9][a-z0-9-]{2,30})'\s*:\s*\{\s*\n?\s*id:/g)].map(m => m[1]);
      // connecting-lines thiếu tham số bắt buộc → render lỗi, loại khỏi danh sách cho người dùng.
      return { ok: true, items: [...new Set(ids)].filter(x => x !== 'connecting-lines').sort() };
    } catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });

  // Danh mục chuyển cảnh (bê từ video-creator Fractal, phần dựng viết lại ở transitions.js).
  const chTr = 'nova:sceneTransitions';
  try { ipcMain.removeHandler(chTr); } catch (_) {}
  ipcMain.handle(chTr, async () => {
    try { return { ok: true, items: require('./nova-remotion/src/transitions').catalog() }; }
    catch (err) { return { ok: false, error: String(err && err.message || err).slice(0, 200) }; }
  });

  // Kênh riêng cho engine Nova Scene — ('remotion:renderVideo' bundle cũ ĐÃ GỠ:
  // renderer không bao giờ gọi; MEMORY 2026-09-11q).
  const chNova = 'remotion:renderNovaScenes';
  try { ipcMain.removeHandler(chNova); } catch (_) {}
  ipcMain.handle(chNova, async (e, payload = {}) => {
    try {
      try { fs.writeFileSync(path.join(TMP, 'last-nova-scenes.json'), JSON.stringify(payload.scenes || [], null, 2)); } catch (_) {}
      let outputPath = payload.outputPath;
      if (!outputPath) {
        const w = BrowserWindow.fromWebContents(e.sender) || BrowserWindow.getFocusedWindow();
        const r = await dialog.showSaveDialog(w, { defaultPath: `nova-scene-${Date.now()}.mp4`, filters: [{ name: 'MP4', extensions: ['mp4'] }] });
        if (r.canceled) return { ok: false, error: 'Đã huỷ' };
        outputPath = r.filePath;
      }
      const onProgress = (p, msg) => { try { e.sender.send('remotion:progress', { percent: p, message: msg }); } catch (_) {} };
      return await renderNovaScenes({ scenes: payload.scenes, globals: payload.globals, outputPath, onProgress, voiceB64: payload.voiceB64, musicB64: payload.musicB64, musicVolume: payload.musicVolume });
    } catch (err) { return { ok: false, code: (err && err.code) || undefined, error: viText(err && err.code, String(err && err.message || err)).slice(0, 300) }; }
  });

  return [chNova];
}

// Đường dẫn binary vendored mà render pipeline có thể spawn: ffmpeg (ff-path →
// ffmpeg-static, đã unasar) + chrome-headless-shell vendored (nếu tìm thấy).
// Dùng bởi nova/main/janitor.js lúc STARTUP để quét tiến trình mồ côi — CHỈ kill
// theo đường dẫn exe trùng khớp, không kill theo tên (xem nova/core/orphan-pids.js).
function vendoredRendererExes() {
  const out = [];
  try {
    const { FFMPEG } = require('./ff-path');
    if (FFMPEG) out.push({ exe: FFMPEG, tag: 'ffmpeg (mux/nova-scene)' });
  } catch (_) {}
  if (BROWSER) out.push({ exe: BROWSER, tag: 'chrome-headless-shell (remotion)' });
  else {
    // Bản đóng gói: browser nằm ở userData/.remotion (tải bằng ensureBrowser — xem
    // resolveBrowserExecutable). Cần đưa vào danh sách để janitor kill đúng tiến trình
    // mồ côi theo đường dẫn exe. Chỉ QUÉT, không tạo gì (chưa tải → rỗng là bình thường).
    if (String(DIR).includes('app.asar')) {
      try {
        const ud = app.getPath('userData');
        const ub = ud && findBrowser(path.join(ud, '.remotion'));
        if (ub) out.push({ exe: ub, tag: 'chrome-headless-shell (remotion, userData)' });
      } catch (_) {}
    }
  }
  return out;
}

module.exports = { registerEditorProRemotion, renderRemotionFull, renderNovaScenes, vendoredRendererExes };
