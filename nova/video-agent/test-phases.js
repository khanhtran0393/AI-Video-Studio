'use strict';
// §33 Acceptance Test cho Phase 3 (Asset Intelligence / Segment), Phase 4 (Vision QA),
// Phase 5 (S3/CDN uploader). Chạy bằng plain node — cần ffmpeg (ffmpeg-static đã có trong deps).
// Vector SigV4 lấy từ AWS Signature Version 4 Test Suite (get-vanilla, mirror botocore).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { dHash, hamming, buildCharacterRegistry } = require('./assets/identity');
const { subjectBoxFromMask, createSegmentationProvider, createPhase3Analyzer } = require('./assets/segment');
const { frameStats, extractSceneStats, createVisionProviders } = require('./qa/vision');
const { runQA } = require('./qa/qa');
const { buildTimeline } = require('./timeline/engine');
const { s3Upload, sigv4Sign, signingKey } = require('./uploader/s3');
const { createUploader, localUpload } = require('./uploader/local');
const { createVideoJob } = require('./orchestrator');
const { registerVideoAgentIpc } = require('./ipc');
const { makeFixture, mockRenderer, assert, counters } = require('./test-fixture');

let FFMPEG = 'ffmpeg';
try { FFMPEG = require('../editor-pro/ff-path').FFMPEG; } catch (_) {}

function sh(args, label) {
  const r = spawnSync(FFMPEG, args, { windowsHide: true, maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error('ffmpeg fail [' + label + ']: ' + args.join(' ') + '\n' + (r.stderr || '').toString().slice(-400));
}
function makeTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'va-phase-')); }
function makeImg(dir, name, src) { sh(['-f', 'lavfi', '-i', src + '=size=256x256:duration=1:rate=10', '-frames:v', '1', '-update', '1', '-y', path.join(dir, name)], 'img ' + name); }
function makeVideo(dir, name, lavfi) { sh(['-f', 'lavfi', '-i', lavfi, '-pix_fmt', 'yuv420p', '-y', path.join(dir, name)], 'video ' + name); }

// ── Phase 3: Asset Intelligence ──────────────────────────────────────────
async function phase3(tmp) {
  makeImg(tmp, 'a.png', 'testsrc');       // pattern phong phú
  makeImg(tmp, 'a-dup.png', 'testsrc');   // giống hệt a
  makeImg(tmp, 'b.png', 'smptebars');     // khác hẳn a

  const hA = dHash(path.join(tmp, 'a.png'));
  const hDup = dHash(path.join(tmp, 'a-dup.png'));
  const hB = dHash(path.join(tmp, 'b.png'));
  assert('P3: dHash không null (16 hex)', !!hA && hA.length === 16, hA);
  assert('P3: ảnh giống hệt → distance 0', hamming(hA, hDup) === 0);
  assert('P3: ảnh khác pattern → distance lớn', hamming(hA, hB) > 6, hamming(hA, hB));
  assert('P3: distance đối xứng', hamming(hA, hB) === hamming(hB, hA));

  // Registry: mapping tên config thắng heuristic; 2 ảnh cùng tên + hash gom 1 nhóm.
  const manifest = { assets: [
    { assetId: 'img_001', type: 'character', relPath: 'img/char-linh-1.png', identityHash: hA },
    { assetId: 'img_002', type: 'character', relPath: 'img/char-linh-2.png', identityHash: hA },
    { assetId: 'img_003', type: 'character', relPath: 'img/char-mai.png', identityHash: hB },
    { assetId: 'img_004', type: 'background', relPath: 'img/bg.png' },
  ] };
  const reg = buildCharacterRegistry(manifest, { config: { characters: [{ id: 'linh', name: 'linh' }, { id: 'mai', name: 'mai' }] } });
  assert('P3: registry 2 nhóm nhân vật', reg.registry.length === 2, reg.registry.length);
  assert('P3: gom đúng theo tên', reg.idOf['img_001'] === 'linh' && reg.idOf['img_002'] === 'linh' && reg.idOf['img_003'] === 'mai', reg.idOf);
  // Không có config → gom theo hash.
  const reg2 = buildCharacterRegistry(manifest, { config: {} });
  assert('P3: registry không-config 2 nhóm (theo hash)', reg2.registry.length === 2, reg2.registry.length);
  assert('P3: hash bằng → cùng id', reg2.idOf['img_001'] === reg2.idOf['img_002'], reg2.idOf);

  // subjectBoxFromMask (hàm thuần): mask 4×4, foreground 2×2 giữa.
  const mask = new Uint8Array([0,0,0,0, 0,200,200,0, 0,200,200,0, 0,0,0,0]);
  const box = subjectBoxFromMask(mask, 4, 4);
  assert('P3: subjectBox coverage 0.25', box.coverage === 0.25, box);
  assert('P3: subjectBox bbox 25..75', box.bbox.x === 25 && box.bbox.y === 25 && box.bbox.w === 50 && box.bbox.h === 50, box);
  assert('P3: subjectBox mask rỗng → null', subjectBoxFromMask(new Uint8Array(16), 4, 4) === null);

  // Provider 'auto' khi không có model → degrade graceful (không crash).
  const seg = createSegmentationProvider({ provider: 'auto' });
  const r = await seg.analyze(path.join(tmp, 'a.png'));
  assert('P3: segmentation auto (không model) → unavailable', !!r && r.unavailable === true, r);

  // Phase-3 analyzer tổng hợp trên entry thật.
  const analyzer = createPhase3Analyzer({});
  const outChar = await analyzer({ assetId: 'img_001', type: 'character', source: path.join(tmp, 'a.png'), relPath: 'img/char-linh-1.png' }, { config: {} });
  assert('P3: analyzer đính identityHash cho character', !!outChar.identityHash, outChar);
  assert('P3: analyzer segmentation marker cho character', !!outChar.segmentation && outChar.segmentation.unavailable === true, outChar.segmentation);
  const outScene = await analyzer({ assetId: 'img_bg', type: 'scene', source: path.join(tmp, 'b.png'), relPath: 'img/b.png' }, { config: {} });
  assert('P3: analyzer identityHash cho scene', !!outScene.identityHash, outScene);
  assert('P3: scene không segment (chỉ character mới cutout)', !outScene.segmentation, outScene);
  assert('P3: analyzer không nổ khi file hỏng', !(await analyzer({ type: 'character', source: path.join(tmp, 'khong-ton-tai.png') })).identityHash);
}

// ── Phase 4: Vision QA ───────────────────────────────────────────────────
async function phase4(tmp) {
  makeVideo(tmp, 'black.mp4', 'color=c=black:s=320x240:r=10:d=2');
  makeVideo(tmp, 'src.mp4', 'testsrc=s=320x240:r=10:d=2');
  const black = path.join(tmp, 'black.mp4'), src = path.join(tmp, 'src.mp4');

  const sb = frameStats(black, 0.5);
  const ss = frameStats(src, 1.0);
  assert('P4: frameStats trả đủ trường', sb && sb.mean != null && sb.std != null && sb.hash && sb.t === 0.5, sb);
  assert('P4: frame đen mean thấp', sb.mean < 12, sb);
  assert('P4: frame đen std thấp (flat)', sb.std < 4, sb);
  assert('P4: frame testsrc mean thường', ss.mean > 12, ss);
  assert('P4: frame testsrc có chi tiết (std cao)', ss.std > 4, ss);
  assert('P4: hamming hex ảnh giống = 0', hamming(sb.hash, sb.hash) === 0);

  const spec = { fps: 10, scenes: [
    { id: 's1', start: 0, end: 1, camera: { type: 'static', from: null, to: null }, transition: 'cut', elements: [], captions: [] },
    { id: 's2', start: 1, end: 2, camera: { type: 'static', from: null, to: null }, transition: 'cut', elements: [], captions: [] },
  ] };

  const stats = extractSceneStats({ videoPath: black, spec });
  assert('P4: extractSceneStats 2 cảnh', stats.length === 2, stats.length);
  assert('P4: mỗi cảnh có frame', stats.every(s => s.frames.length >= 1));

  const vp = createVisionProviders({ stats });
  const semErrs = await vp.semantic();
  const conErrs = await vp.continuity();
  assert('P4: semantic phát black_frame', semErrs.some(e => e.type === 'black_frame'), semErrs);
  assert('P4: semantic phát flat_frame', semErrs.some(e => e.type === 'flat_frame'), semErrs);
  assert('P4: continuity phát frozen_frame (2 cảnh giống nhau)', conErrs.some(e => e.type === 'frozen_frame'), conErrs);
  assert('P4: lỗi có suggestedFix', semErrs.every(e => e.suggestedFix));

  const qaBad = await runQA({ spec, timeline: buildTimeline(spec), providers: vp });
  assert('P4: QA video đen = fail', qaBad.status === 'fail', qaBad.status);
  assert('P4: score semantic thấp', qaBad.scores.semantic < 1, qaBad.scores);

  const stats2 = extractSceneStats({ videoPath: src, spec });
  const vp2 = createVisionProviders({ stats: stats2 });
  const sem2 = await vp2.semantic();
  const con2 = await vp2.continuity();
  assert('P4: testsrc không có black/white/flat', !sem2.some(e => ['black_frame', 'white_frame', 'flat_frame'].includes(e.type)), sem2);
  assert('P4: testsrc không frozen', !con2.some(e => e.type === 'frozen_frame'), con2);
  const qaGood = await runQA({ spec, timeline: buildTimeline(spec), providers: vp2 });
  assert('P4: QA testsrc = pass', qaGood.status === 'pass', qaGood.status);

  // End-to-end: orchestrator dùng render giả chép video đen → PREVIEW_QA fail.
  const jobDir = makeFixture();
  process.env.VA_TMP_OUT = jobDir;
  const renderMock = { render: async ({ outputPath }) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(black, outputPath);
    return { ok: true, outputPath, engine: 'mock-real', durationInFrames: 20, fps: 10, hasAudio: false };
  } };
  const job = createVideoJob({ projectDir: jobDir, adapters: { render: renderMock }, options: { maxAutoFixAttempts: 3 } });
  const res = await job.run();
  assert('P4: orchestrator ăn vision QA → FAILED/NEEDS_REVIEW', res.status === 'FAILED' || res.status === 'NEEDS_REVIEW', res.status);
  const qaList = (res.qa && res.qa.errors) || (res.error && res.error.details) || [];
  assert('P4: QA report chứa black_frame', qaList.some(e => e && e.type === 'black_frame'), res.status);
  try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch (_) {}
}

// ── Phase 5: S3/CDN uploader ─────────────────────────────────────────────
async function phase5(tmp) {
  // Dọn env để test branch "thiếu creds" deterministically.
  const saved = {};
  ['VA_S3_ACCESS_KEY_ID', 'VA_S3_SECRET_ACCESS_KEY', 'VA_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });

  // 1. SigV4 chính xác theo AWS Test Suite (get-vanilla) — không cần mạng.
  const sig = sigv4Sign({ method: 'GET', url: 'https://example.amazonaws.com/',
    region: 'us-east-1', service: 'service', accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', amzDate: '20150830T123600Z' });
  const EXPECT_CANONICAL = 'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert('P5: canonical request khớp AWS vector', sig.canonical === EXPECT_CANONICAL, sig.canonical);
  assert('P5: string-to-sign hash đúng', sig.stringToSign.endsWith('bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63'), sig.stringToSign);
  assert('P5: signature khớp AWS vector', sig.signature === '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31', sig.signature);
  assert('P5: Authorization header đúng format', sig.authorization ===
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31', sig.authorization);
  assert('P5: signingKey là HMAC chain thuần', signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830T123600Z', 'us-east-1', 'service').length === 32);

  // 2. Branch lỗi (offline).
  const miss = await s3Upload({ filePath: path.join(tmp, 'khong-co.mp4') });
  assert('P5: thiếu file nguồn → SOURCE_MISSING', !miss.ok && miss.code === 'VA_UPLOAD_SOURCE_MISSING', miss);
  makeVideo(tmp, 'src.mp4', 'testsrc=s=320x240:r=10:d=1');
  const mp4 = path.join(tmp, 'src.mp4');
  const noBucket = await s3Upload({ filePath: mp4, fileName: 'a.mp4' });
  assert('P5: thiếu bucket → NO_CONFIG', !noBucket.ok && noBucket.code === 'VA_S3_NO_CONFIG', noBucket);
  const noCreds = await s3Upload({ filePath: mp4, fileName: 'a.mp4', bucket: 'b' });
  assert('P5: thiếu creds → NO_CREDS', !noCreds.ok && noCreds.code === 'VA_S3_NO_CREDS', noCreds);

  // 3. createUploader routing.
  assert('P5: createUploader(local).name', createUploader('local').name === 'local');
  assert('P5: createUploader(s3).name', createUploader('s3', {}).name === 's3');
  assert('P5: createUploader(function) → custom', createUploader(() => ({ ok: true })).name === 'custom');
  assert('P5: createUploader(unknown) → fallback local', createUploader('cloudflare-r2').name === 'local');
  const objAdapter = createUploader({ name: 'r2', upload: async () => ({ ok: true, url: 'x' }) });
  assert('P5: adapter object đi thẳng', objAdapter.name === 'r2' && typeof objAdapter.upload === 'function');

  // 4. localUpload vẫn dùng được (regression Phase 1).
  const lu = localUpload({ filePath: mp4, fileName: 'src.mp4' });
  assert('P5: localUpload vẫn ok', lu.ok && lu.provider === 'local' && lu.url.startsWith('file://'), lu);

  // 5. Wire IPC: payload.upload={provider:'s3',bucket} nhưng không creds → FAILED ở UPLOADING.
  const handlers = {}, sent = [];
  const ipcMain = { removeHandler() {}, handle(ch, fn) { handlers[ch] = fn; } };
  const sender = { send: (ch, payload) => sent.push({ ch, payload }) };
  const ipcRoot = makeFixture();
  process.env.VA_TMP_OUT = ipcRoot;
  registerVideoAgentIpc(ipcMain, { adapters: { render: mockRenderer() } });
  const run = await handlers['videoAgent:run']({ sender }, { projectDir: ipcRoot, options: { skipPreview: true },
    upload: { provider: 's3', bucket: 'b', region: 'us-east-1', keyPrefix: 'v', cdnBase: 'https://cdn.example' } });
  assert('P5: IPC wire S3 (no creds) → FAILED', run.status === 'FAILED', run.status);
  assert('P5: IPC error code = VA_S3_NO_CREDS', run.error && /VA_S3_NO_CREDS/.test(JSON.stringify(run.error)), run.error);
  // §32.17 — Lỗi hiển thị tiếng Việt + không để lại file output, job.json vẫn giữ dữ liệu auto-fix.
  assert('P5: FAILED → error.message tiếng Việt', typeof run.error.message === 'string' && /S3|tải lên|khoá/i.test(run.error.message), run.error);
  assert('P5: FAILED → error.original + code cho auto-fix', run.error.code === 'VA_S3_NO_CREDS' && !!run.error.original, run.error);
  const ipcOut = path.join(ipcRoot, 'output');
  const mp4s = fs.existsSync(ipcOut) ? fs.readdirSync(ipcOut).filter(f => /\.mp4$/.test(f)) : [];
  assert('P5: FAILED không để lại file mp4 output', mp4s.length === 0, mp4s);
  const meta = fs.existsSync(path.join(ipcOut, 'job.json')) ? JSON.parse(fs.readFileSync(path.join(ipcOut, 'job.json'), 'utf8')) : null;
  assert('P5: job.json vẫn còn để auto-fix/retry', !!meta && meta.jobId === run.jobId && !!meta.error && !!meta.options,
    meta && { jobId: meta.jobId, hasError: !!meta.error, hasOptions: !!meta.options });
  try { fs.rmSync(ipcRoot, { recursive: true, force: true }); } catch (_) {}

  Object.keys(saved).forEach(k => { if (saved[k] != null) process.env[k] = saved[k]; });
}

// ── Phase 6: Watermark/logo QA + TTS local fallback (học từ NNLauncher) ──
async function phase6(tmp) {
  const http = require('http');
  const { sceneFrameTimes, normalizeBoxes, extractFrame, createWatermarkProvider } = require('./qa/watermark');
  const { classifyFixStrategy } = require('./auto-fix/loop');
  const { probeVoiceBackend, synthesizeVoice, autoSynthesizeTts } = require('./tts/synthesize');

  const spec6 = { fps: 10, scenes: [] };
  for (let i = 0; i < 5; i++) spec6.scenes.push({ id: 's' + (i + 1), start: i, end: i + 1,
    camera: { type: 'static', from: null, to: null }, transition: 'cut', elements: [], captions: [] });

  // 1. sceneFrameTimes — giữa cảnh, sampling đều, deterministic.
  const times5 = sceneFrameTimes(spec6, 12);
  assert('P6: 5 cảnh → 5 mốc giữa cảnh', times5.length === 5 && times5[0].t === 0.5 && times5[4].t === 4.5, times5);
  const times2 = sceneFrameTimes(spec6, 2);
  assert('P6: sample đều 2/5 cảnh (s1, s5)', times2.length === 2 && times2[0].sceneId === 's1' && times2[1].sceneId === 's5', times2);
  assert('P6: deterministic (2 lần gọi giống nhau)', JSON.stringify(times2) === JSON.stringify(sceneFrameTimes(spec6, 2)));

  // 2. normalizeBoxes — lọc hộp rác, làm tròn score.
  const nb = normalizeBoxes({ boxes: [{ x1: 10.4, y1: 20.2, x2: 110.6, y2: 60.8, score: 0.91234 },
    { x1: 'x', y1: 1, x2: 2, y2: 2 }, { x1: 5, y1: 5, x2: 5, y2: 5 }, null] });
  assert('P6: normalizeBoxes chỉ giữ hộp hợp lệ + làm tròn', nb.length === 1 && nb[0].x1 === 10.4 && nb[0].score === 0.912, nb);
  assert('P6: normalizeBoxes đầu vào xấu → []', normalizeBoxes(null).length === 0 && normalizeBoxes({ boxes: 'x' }).length === 0);

  // 3. extractFrame + provider với detect inject trên video thật.
  makeVideo(tmp, 'wm-src.mp4', 'testsrc=s=320x240:r=10:d=5');
  const vid = path.join(tmp, 'wm-src.mp4');
  const framePng = path.join(tmp, 'wm-frame.png');
  assert('P6: extractFrame trích được PNG', extractFrame(vid, 1.5, framePng, FFMPEG) && fs.existsSync(framePng));

  const meta = {}; const calls = [];
  const wp = createWatermarkProvider({ videoPath: vid, ffmpeg: FFMPEG, meta, maxFrames: 3,
    detect: async () => { calls.push(1); return { boxes: [{ x1: 1, y1: 1, x2: 50, y2: 40, score: 0.98 }] }; } });
  const wmErrors = await wp({ spec: spec6 });
  assert('P6: provider phát watermark ở 3 frame sample', wmErrors.length === 3 && wmErrors.every((e) => e.type === 'watermark_detected'), wmErrors.length);
  assert('P6: lỗi mang scene + suggestedFix remove_watermark', wmErrors[0].scene === 's1' && wmErrors[0].suggestedFix.type === 'remove_watermark' && wmErrors[0].severity === 'high', wmErrors[0]);
  assert('P6: meta đếm checked/detected', meta.checked === 3 && meta.detected === 3 && meta.engine === 'injected', meta);
  const again = await wp({ spec: spec6 });
  assert('P6: cache theo (video,t) — detect không gọi lại', calls.length === 3 && again.length === 3, calls.length);

  // 4. Phân loại chiến lược auto-fix + runQA ăn lỗi watermark.
  assert('P6: classifyFixStrategy watermark → fix-in-post', classifyFixStrategy({ type: 'watermark_detected' }) === 'fix-in-post');
  const qaWm = await runQA({ spec: spec6, timeline: buildTimeline(spec6), providers: { semantic: async () => wmErrors } });
  assert('P6: runQA fail khi có watermark', qaWm.status === 'fail', qaWm.status);

  // 5. Thiếu video → mảng rỗng (không ném).
  const wpNone = createWatermarkProvider({ videoPath: path.join(tmp, 'khong-ton-tai.mp4') });
  assert('P6: thiếu video → mảng rỗng', (await wpNone({ spec: spec6 })).length === 0);

  // 6. Backend TTS mock đúng hợp đồng voice-studio /api/tts.
  let lastTtsBody = null; let polls = 0;
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    res.setHeader('Content-Type', 'application/json');
    if (url === '/api/health') { res.end(JSON.stringify({ status: 'ok', tts_engine: 'omnivoice', asr_engine: 'faster-whisper' })); return; }
    if (url === '/api/tts') { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { lastTtsBody = JSON.parse(b); res.end(JSON.stringify({ task_id: 'tid_1', status: 'pending', poll_url: '/api/status/tid_1' })); }); return; }
    if (url === '/api/status/tid_1') { polls++;
      if (polls < 2) res.end(JSON.stringify({ id: 'tid_1', status: 'running', progress: 1, total: 3 }));
      else res.end(JSON.stringify({ id: 'tid_1', status: 'completed',
        results: { merged: '/api/files/tid_1/output.mp3', srt: '/api/files/tid_1/output.srt', lines: [] } }));
      return; }
    if (url === '/api/files/tid_1/output.mp3') { res.setHeader('Content-Type', 'audio/mpeg'); res.end(Buffer.from('ID3MOCK')); return; }
    if (url === '/api/files/tid_1/output.srt') { res.end('1\n00:00:00,000 --> 00:00:02,000\nXin chào\n'); return; }
    res.statusCode = 404; res.end(JSON.stringify({ error: 'not_found' }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const probe = await probeVoiceBackend({ baseUrl: base });
  assert('P6: probe backend mock → ok + engine omnivoice', probe.ok && probe.engine === 'omnivoice', probe);

  const outDir = fs.mkdtempSync(path.join(tmp, 'tts-'));
  const synth = await synthesizeVoice({ text: 'Xin chào thế giới', baseUrl: base,
    outPath: path.join(outDir, 'a.mp3'), srtPath: path.join(outDir, 'a.srt'), pollMs: 10 });
  assert('P6: synthesizeVoice ghi mp3 + srt', synth.ok && fs.readFileSync(path.join(outDir, 'a.mp3'), 'utf8') === 'ID3MOCK'
    && /Xin chào/.test(fs.readFileSync(path.join(outDir, 'a.srt'), 'utf8')), synth);
  assert('P6: body /api/tts đúng hợp đồng (text, language, preset_id, speed)',
    lastTtsBody && lastTtsBody.text === 'Xin chào thế giới' && lastTtsBody.language === 'vi'
    && lastTtsBody.preset_id === null && lastTtsBody.speed === 1, lastTtsBody);

  // 7. Backend không có → fail lộ liễu VA_TTS_BACKEND_UNAVAILABLE (không fallback ngầm).
  const deadProbe = await probeVoiceBackend({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 800 });
  assert('P6: probe backend chết → ok:false + code', !deadProbe.ok && deadProbe.code === 'VA_TTS_BACKEND_UNAVAILABLE', deadProbe);
  const failed = await synthesizeVoice({ text: 'abc', baseUrl: 'http://127.0.0.1:1',
    outPath: path.join(outDir, 'b.mp3') }).then(() => null, (e) => e);
  assert('P6: synthesizeVoice backend chết → VA_TTS_BACKEND_UNAVAILABLE', !!failed && failed.code === 'VA_TTS_BACKEND_UNAVAILABLE', failed && failed.code);

  // 8. autoSynthesizeTts: thiếu text → VA_TTS_AUTO_NO_TEXT; đã có giọng → skip.
  const noText = await autoSynthesizeTts({ project: { files: { script: path.join(tmp, 'khong-co.md') } },
    options: { autoTts: {} }, projectDir: outDir }).then(() => null, (e) => e);
  assert('P6: autoTts không có text → VA_TTS_AUTO_NO_TEXT', !!noText && noText.code === 'VA_TTS_AUTO_NO_TEXT', noText && noText.code);
  const skip = await autoSynthesizeTts({ project: { files: { ttsAudio: 'voice/x.wav' } }, options: { autoTts: {} }, projectDir: outDir });
  assert('P6: autoTts skip khi đã có giọng sẵn', !!skip && !!skip.skipped, skip);

  // 9. autoSynthesizeTts end-to-end qua mock backend (text từ textPath).
  const txtPath = path.join(outDir, 'script.txt');
  fs.writeFileSync(txtPath, 'Kịch bản thử');
  const auto = await autoSynthesizeTts({ project: { files: {} },
    options: { autoTts: { textPath: txtPath, baseUrl: base } }, projectDir: outDir });
  assert('P6: autoTts end-to-end ghi auto-tts.mp3 + .srt', !!auto && auto.ok
    && fs.existsSync(path.join(outDir, 'voice', 'auto-tts.mp3')) && fs.existsSync(path.join(outDir, 'voice', 'auto-tts.srt')), auto);

  // 10. Orchestrator integration: autoTts bật + backend chết → FAILED với mã lộ liễu.
  // (baseUrl trỏ port chết để test deterministc — không phụ thuộc backend thật 8771 có đang chạy hay không.)
  const jobDir2 = makeFixture();
  fs.unlinkSync(path.join(jobDir2, 'tts', 'chapter-001.wav')); // xoá giọng sẵn có → autoTts phải chạy
  process.env.VA_TMP_OUT = jobDir2;
  const job2 = createVideoJob({ projectDir: jobDir2, adapters: { render: mockRenderer() },
    options: { autoTts: { baseUrl: 'http://127.0.0.1:1' } } });
  const res2 = await job2.run();
  assert('P6: orchestrator autoTts thiếu backend → FAILED', res2.status === 'FAILED', res2.status);
  assert('P6: error code = VA_TTS_BACKEND_UNAVAILABLE', res2.error && res2.error.code === 'VA_TTS_BACKEND_UNAVAILABLE', res2.error && res2.error.code);
  try { fs.rmSync(jobDir2, { recursive: true, force: true }); } catch (_) {}

  await new Promise((r) => srv.close(r));
}

async function main() {
  const tmp = makeTmp();
  try {
    await phase3(tmp);
    await phase4(tmp);
    await phase5(tmp);
    await phase6(tmp);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
  const { pass, fail } = counters();
  console.log('\n=== NOVA VIDEO AGENT — Phase 3/4/5/6 acceptance (§33) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });
