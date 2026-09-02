'use strict';
/**
 * produce-real-outputs.js — Cho ra SẢN PHẨM THẬT của từng chức năng từ app ĐÓNG GÓI.
 *
 * Mỗi chức năng được lái qua đúng đường người dùng thật (CDP → renderer → window.native → IPC → main):
 *   1. Tạo giọng nói : backend OmniVoice (engine VieNeu, offline CPU) → file audio thật + .srt
 *   2. Dựng video     : window.native.renderVideo → FFmpeg + NVENC → MP4 thật (Ken Burns + audio)
 *   3. Tạo kịch bản   : UI Tạo Kịch Bản → LLM loopback (máy chưa có API thật) → kich-ban.md
 *   4. Video Agent    : videoAgent:run → pipeline story→spec→timeline→render → MP4 hoàn chỉnh
 *   5/6/7/8           : probe Nâng cấp ảnh / Xoá watermark / MI-GAN / Parallax → báo trạng thái engine
 *   +) Ảnh màn hình từng tab (Dashboard → YouTube SEO → Công cụ AI) làm bằng chứng UI.
 *
 * Chạy: node nova/scripts/produce-real-outputs.js [đường-dẫn-exe]
 * Kết quả: artifacts/san-pham-that-<timestamp>/ (report.json + README.md + từng thư mục sản phẩm)
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { CdpClient } = require('./smoke-cdp');
const { closeServer, findPackagedExe, forceKill, httpJson, listen, redact, sleep, waitForJson, waitForPort } = require('./smoke-runtime');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXED_PORTS = [8793, 8794, 8795, 8796];
const MOCK_KEY = 'real-output-loopback-key';
const RUN_PREFIX = 'san-pham-that';

// Nội dung kịch bản mẫu cho mock LLM (máy này chưa cấu hình API thật — nội dung văn bản do loopback trả).
const MOCK_SCRIPT = [
  'BÌNH MINH TRÊN VỊNH HẠ LONG',
  '',
  'Sương sớm còn giăng trên mặt vịnh khi chiếc thuyền gỗ lượn qua những đảo đá vôi đen tuyền.',
  'Tiếng mái chèo khua nhẹ, đập vỡ bóng núi đang ngủ trên mặt nước màu ngọc.',
  'Cô bé Maya đứng ở mũi thuyền, tay giữ chặt tấm bản đồ sao mà ông ngoại để lại.',
  'Mỗi ngọn đèn đánh cá tắt dần, nhường chỗ cho vệt sáng vàng cam của mặt trời leo lên đằng đông.',
  'Khi cánh chim đại bàng vụt qua đỉnh đảo, Maya mỉm cười: hành trình tìm về ngôi đài thiên văn đã bắt đầu.',
].join('\n');

const TTS_TEXT = 'Xin chào, đây là giọng đọc tiếng Việt được tổng hợp hoàn toàn trên máy, bằng engine VieNeu của AI Video Studio.';

function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function ffprobeBin() {
  const p = path.join(ROOT, 'node_modules', 'ffprobe-static', 'bin', process.platform === 'win32' ? path.join('win32', 'x64', 'ffprobe.exe') : '');
  return fs.existsSync(p) ? p : null;
}
function ffmpegBin() {
  const p = path.join(ROOT, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  return fs.existsSync(p) ? p : null;
}
function probeMedia(file) {
  const bin = ffprobeBin();
  if (!bin || !fs.existsSync(file)) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(bin, ['-v', 'error', '-show_entries', 'format=duration,size', '-show_entries', 'stream=codec_type,codec_name,width,height,sample_rate,channels', '-of', 'json', file], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch (_) { resolve(null); }
    });
  });
}
function downloadBinary(url, outFile) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' cho ' + url));
      const bufs = [];
      res.on('data', (c) => bufs.push(c));
      res.on('end', () => { fs.writeFileSync(outFile, Buffer.concat(bufs)); resolve(fs.statSync(outFile).size); });
    }).on('error', reject);
  });
}
function b64(file) { return fs.readFileSync(file).toString('base64'); }
function dataUrl(file, mime) { return 'data:' + mime + ';base64,' + b64(file); }

// httpJson của smoke-runtime chỉ GET — bản này hỗ trợ POST (dùng cho /api/tts của backend giọng nói).
function reqJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      const bufs = [];
      res.on('data', (c) => bufs.push(c));
      res.on('end', () => {
        const body = Buffer.concat(bufs);
        try { resolve({ status: res.statusCode, json: JSON.parse(body.toString('utf8')) }); }
        catch (e) { resolve({ status: res.statusCode, body: body.toString('utf8').slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('HTTP timeout: ' + url)));
    if (opts.payload) req.write(opts.payload);
    req.end();
  });
}

// ── Môi trường: profile MỚI (không đụng profile thật) nhưng giữ PATH đầy đủ của máy ──
// (Python + venv voice là công cụ hệ thống thật như trên máy khách có cài; mô hình AI dùng
//  lại cache HF của người dùng qua HF_HOME nên không tải lại từ mạng.)
function buildEnv(profileRoot) {
  const userprofile = path.join(profileRoot, 'userprofile');
  const roaming = path.join(userprofile, 'AppData', 'Roaming');
  const local = path.join(userprofile, 'AppData', 'Local');
  const temp = path.join(local, 'Temp');
  for (const dir of [roaming, local, temp, path.join(userprofile, 'Downloads'), path.join(userprofile, 'Videos')]) fs.mkdirSync(dir, { recursive: true });
  const env = {
    ...process.env,
    USERPROFILE: userprofile,
    APPDATA: roaming,
    LOCALAPPDATA: local,
    TEMP: temp,
    TMP: temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    ELECTRON_ENABLE_LOGGING: '1',
  };
  const hf = path.join(process.env.USERPROFILE || '', '.cache', 'huggingface');
  if (fs.existsSync(hf)) { env.HF_HOME = hf; env.HF_HUB_CACHE = path.join(hf, 'hub'); }
  return env;
}

// ── Mock LLM loopback (chức năng AI-văn-bản khi máy chưa có API thật) ──
function startMockLlm() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let parsed = null; try { parsed = JSON.parse(body || '{}'); } catch (_) {}
      requests.push({ path: req.url, model: parsed?.model || null, auth: req.headers.authorization === 'Bearer ' + MOCK_KEY });
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":{"message":"not found"}}');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'loopback', object: 'chat.completion', created: 0, model: parsed?.model,
        choices: [{ index: 0, message: { role: 'assistant', content: MOCK_SCRIPT }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 120, total_tokens: 140 },
      }));
    });
  });
  return { server, requests };
}

// ── Ảnh nguồn cho Dựng Video / Video Agent: gradient PNG 1280x720 bằng FFmpeg thật ──
async function makeSourceImages(dir, ffmpeg) {
  const specs = [
    ['canh-1.png', '0x0f2d5c', '0x89c2ff'],   // xanh biển sáng dần (bình minh)
    ['canh-2.png', '0x5b3a1e', '0xffd166'],   // cam vàng (mặt trời mọc)
    ['canh-3.png', '0x07111f', '0x8ecae6'],   // xanh đêm (bản đồ sao)
  ];
  const out = [];
  for (const [name, c0, c1] of specs) {
    const file = path.join(dir, name);
    await new Promise((resolve, reject) => {
      execFile(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
        `gradients=s=1280x720:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=1280:y1=720:d=1`,
        '-frames:v', '1', file], { windowsHide: true }, (err) => err ? reject(err) : resolve());
    });
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) throw new Error('Không tạo được ảnh nguồn: ' + file);
    out.push(file);
  }
  return out;
}

// Backend giọng nói: app packaged có sẵn backend + venv tại app.asar.unpacked\nova\voice-backend.
// GHI CHÚ BUG: ipc voice-install-backend đang dò `unpackedNovaRoot()\voice-backend` trong khi
// fs-utils.unpackedNovaRoot() trả về app.asar.unpacked (KHÔNG có \nova) → nút "Cài backend"
// trong app đóng gói luôn báo "Không tìm thấy backend đóng gói trong app." (bug thật, cần fix ở voice.js).
// Workaround trung thực: dùng đúng cơ chế voice-root.txt mà nút "Chọn thư mục voice-studio"
// (voice-pick-root) của app ghi — trỏ tới backend packaged kèm venv .venv-vieneu.
function prepareVoiceRoot(profileRoot, exePath, report) {
  const backend = path.join(path.dirname(exePath), 'resources', 'app.asar.unpacked', 'nova', 'voice-backend');
  const userData = path.join(profileRoot, 'userprofile', 'AppData', 'Roaming', 'AI Video Studio Independent');
  fs.mkdirSync(userData, { recursive: true });
  const ok = fs.existsSync(path.join(backend, 'backend', 'app.py'));
  if (ok) fs.writeFileSync(path.join(userData, 'voice-root.txt'), backend, 'utf8');
  report.voiceRoot = { backend, ok, note: ok ? 'voice-root.txt → backend packaged (venv .venv-vieneu kèm sẵn)' : 'backend packaged không tìm thấy' };
  return ok ? backend : null;
}


async function productVoice(cdp, runDir, report) {
  const dir = path.join(runDir, '01-tao-giong-noi');
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  if (!report.voiceRoot || !report.voiceRoot.ok) throw new Error('Không chuẩn bị được voice-root (backend packaged thiếu).');
  const probeInfo = await cdp.evaluate('window.native.voiceProbe()', 15000);
  const started = await cdp.evaluate('window.native.voiceStart()', 3 * 60 * 1000);
  if (!started || !started.ok) throw new Error('voice-start lỗi: ' + JSON.stringify(started));
  const base = started.url;

  const synthesize = async (engine) => {
    const created = await reqJson(base + '/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ text: TTS_TEXT, language: 'vi', speed: 1.0, engine }) });
    if (created.status !== 200) throw new Error('POST /api/tts HTTP ' + created.status);
    const taskId = created.json.task_id;
    const deadline = Date.now() + 8 * 60 * 1000;
    let task = null;
    while (Date.now() < deadline) {
      task = (await reqJson(base + '/api/status/' + taskId)).json;
      if (task.status === 'completed' || task.status === 'failed') break;
      await sleep(1500);
    }
    if (!task || task.status !== 'completed') throw new Error('TTS task không hoàn tất: ' + JSON.stringify(task).slice(0, 400));
    return task;
  };

  let engineUsed = 'vieneu';
  let fallback = null;
  let task;
  try { task = await synthesize('vieneu'); }
  catch (e) {
    fallback = { from: 'vieneu', error: String(e.message || e) };
    engineUsed = 'mock'; task = await synthesize('mock');
  }

  const mergedUrl = base + task.results.merged;
  const srtUrl = base + task.results.srt;
  const mergedExt = path.extname(task.results.merged) || '.wav';
  const audioFile = path.join(dir, 'giong-noi-vi' + mergedExt);
  const bytes = await downloadBinary(mergedUrl, audioFile);
  let srtBytes = 0;
  try { srtBytes = await downloadBinary(srtUrl, path.join(dir, 'giong-noi-vi.srt')); } catch (_) {}
  const meta = await probeMedia(audioFile);
  return { ok: true, engine: engineUsed, fallback, probeInfo, audioFile, bytes, srtBytes, meta, elapsedMs: Date.now() - t0, health: await httpJson(base + '/api/health') };
}

// ── 2. Dựng Video: 3 ảnh + giọng đọc → FFmpeg (NVENC nếu có) → MP4 Ken Burns ──
async function productRender(cdp, runDir, images, audioFile) {
  const dir = path.join(runDir, '02-dung-video');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'video-dung-kenburns.mp4');
  const fxs = ['zoom-in', 'pan-right', 'zoom-out'];
  const imagesPayload = images.map((f, i) => ({ dataUrl: dataUrl(f, 'image/png'), dur: 4.5, fx: fxs[i % fxs.length], trans: 'fade', transDur: 0.6 }));
  const payload = {
    images: imagesPayload,
    width: 1280, height: 720, fps: 30, crf: 20,
    outPath,
  };
  if (audioFile && fs.existsSync(audioFile)) payload.audioDataUrl = dataUrl(audioFile, path.extname(audioFile) === '.mp3' ? 'audio/mpeg' : 'audio/wav');
  const t0 = Date.now();
  const result = await cdp.evaluate(`window.native.renderVideo(${JSON.stringify(payload)})`, 8 * 60 * 1000);
  if (!result || result.error || result.canceled) throw new Error('render-video lỗi: ' + JSON.stringify(result));
  const meta = await probeMedia(outPath);
  return { ok: true, result, meta, outPath, elapsedMs: Date.now() - t0 };
}

// ── 3. Tạo Kịch Bản: UI thật → LLM loopback (máy chưa có key API thật) → kich-ban.md ──
async function productScript(cdp, runDir, mockLlmUrl, mockRequests) {
  const dir = path.join(runDir, '03-tao-kich-ban');
  fs.mkdirSync(dir, { recursive: true });
  await cdp.click('[data-tool="toolsettings"]');
  await cdp.waitFor(`getComputedStyle(document.querySelector('#apiSection')).display !== 'none'`, 'hiện phần API settings', 10000);
  await cdp.setValue('#apiProvider', 'openai-compatible');
  await cdp.setValue('#apiModel', 'custom');
  await cdp.setValue('#apiModelCustom', 'real-output-model');
  await cdp.setValue('#apiKeyList .api-key-field', MOCK_KEY);
  await cdp.setValue('#apiBaseUrl', mockLlmUrl);
  await cdp.click('#apiSection button[onclick="saveApiSettings()"]');
  await cdp.waitFor(`(document.querySelector('#apiStatus')?.textContent || '').includes('Đã lưu')`, 'lưu API settings', 10000);

  await cdp.click('[data-tool="toolscript"]');
  await cdp.waitFor(`document.querySelector('#tool-toolscript')?.classList.contains('active')`, 'kích hoạt tab Tạo Kịch Bản', 10000);
  await cdp.setValue('#tsTopic', 'Bình minh trên vịnh Hạ Long — phim tài liệu ngắn');
  await cdp.setValue('#tsWords', '180');
  await cdp.click('#tsGenBtn');
  const ui = await cdp.waitFor(`(() => {
    const output = document.querySelector('#tsOutput')?.value || '';
    const status = document.querySelector('#statusScript')?.textContent || '';
    return output.length > 100 && (status.includes('Đã viết xong') || status.includes('xong')) ? { output, status } : null;
  })()`, 'kịch bản hiện trong UI', 60000);
  const mdFile = path.join(dir, 'kich-ban.md');
  fs.writeFileSync(mdFile, '# Bình minh trên vịnh Hạ Long\n\n' + ui.output + '\n', 'utf8');
  const request = mockRequests.find((r) => r.path === '/v1/chat/completions');
  return { ok: true, mdFile, bytes: fs.statSync(mdFile).size, status: ui.status, llmRequest: request || null };
}

// ── 4. Video Agent: project thật (script + images + tts) → pipeline đầy đủ → MP4 hoàn chỉnh ──
async function productVideoAgent(cdp, runDir, images, audioFile) {
  const dir = path.join(runDir, '04-video-agent');
  const project = path.join(dir, 'du-an-ha-long');
  for (const sub of ['script', 'images', 'tts']) fs.mkdirSync(path.join(project, sub), { recursive: true });
  const scriptMd = [
    '# CHƯƠNG 1 — BÌNH MINH TRÊN VỊNH HẠ LONG',
    '',
    'Sương sớm giăng trên mặt vịnh, những đảo đá vôi đen tuyền hiện ra trong màn trắng.',
    'Chiếc thuyền gỗ lượn qua các vách đảo, tiếng mái chèo khua nhẹ mặt nước màu ngọc.',
    'Maya đứng ở mũi thuyền, giữ tấm bản đồ sao mà ông ngoại để lại.',
    'Mặt trời leo lên đằng đông, mỗi ngọn đèn đánh cá tắt dần nhường chỗ cho vệt sáng vàng cam.',
  ].join('\n');
  fs.writeFileSync(path.join(project, 'script', 'chapter-001.md'), scriptMd, 'utf8');
  for (const f of images) fs.copyFileSync(f, path.join(project, 'images', path.basename(f)));
  let audioDur = 0;
  if (audioFile && fs.existsSync(audioFile)) {
    const meta = await probeMedia(audioFile);
    audioDur = Number(meta?.format?.duration) || 0;
    fs.copyFileSync(audioFile, path.join(project, 'tts', 'chapter-001' + path.extname(audioFile)));
    const c1 = Math.round(audioDur / 3 * 1000) / 1000, c2 = Math.round(audioDur * 2 / 3 * 1000) / 1000, c3 = Math.round(audioDur * 1000) / 1000;
    fs.writeFileSync(path.join(project, 'tts', 'chapter-001.json'), JSON.stringify({
      provider: 'vieneu', duration: c3, confidence: 0.95,
      segments: [
        { start: 0, end: c1, text: 'Sương sớm giăng trên mặt vịnh, những đảo đá vôi đen tuyền hiện ra trong màn trắng.' },
        { start: c1, end: c2, text: 'Chiếc thuyền gỗ lượn qua các vách đảo, tiếng mái chèo khua nhẹ mặt nước màu ngọc.' },
        { start: c2, end: c3, text: 'Maya giữ tấm bản đồ sao, mặt trời mọc, đèn đánh cá tắt dần nhường chỗ cho vệt vàng cam.' },
      ],
    }, null, 2));
  }
  fs.writeFileSync(path.join(project, 'config.json'), JSON.stringify({
    chapterId: 'ha-long-binh-minh',
    characters: [{ id: 'MAYA', name: 'Maya' }],
    transitions: ['fade'],
    style: { bg: '#07111f', accent: '#ffd166', text: '#f8fafc', font: 'Arial', fps: 30, width: 1280, height: 720 },
  }, null, 2));

  const t0 = Date.now();
  const payload = { projectDir: project, options: { preview: { maxScenes: 3, width: 854, height: 480 }, stageTimeoutMs: 6 * 60 * 1000, skipDiskPreflight: true } };
  const result = await cdp.evaluate(`window.native.videoAgent.run(${JSON.stringify(payload)})`, 30 * 60 * 1000);
  const outDir = path.join(project, 'output');
  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).map((n) => ({ name: n, bytes: fs.statSync(path.join(outDir, n)).size })) : [];
  let finalFile = null;
  if (result && result.output) {
    const src = path.resolve(result.output);
    if (fs.existsSync(src)) { finalFile = path.join(dir, 'video-agent-final.mp4'); fs.copyFileSync(src, finalFile); }
  }
  const meta = finalFile ? await probeMedia(finalFile) : null;
  return { ok: !!(result && result.ok), result, outputFiles: files, finalFile, meta, projectDir: project, elapsedMs: Date.now() - t0 };
}

// ── 5-8. Probe các chức năng AI-ảnh (engine cài trên máy hay chưa) ──
async function productProbes(cdp, runDir, firstImage) {
  const dir = path.join(runDir, '05-nang-cap-anh-va-cac-engine-ai');
  fs.mkdirSync(dir, { recursive: true });
  const upscale = await cdp.evaluate('window.native.upscaleProbe()', 20000);
  const wm = await cdp.evaluate('window.native.wmProbe()', 20000);
  const ffmpeg = await cdp.evaluate('window.native.ffmpegInfo()', 20000);
  let parallax = null;
  try { parallax = await cdp.evaluate(`window.native.parallaxClip(${JSON.stringify({ imagePath: firstImage, dur: 2, fps: 24, w: 640, h: 360 })})`, 20000); }
  catch (e) { parallax = { ok: false, error: String(e.message || e).slice(0, 300) }; }
  let migan = null;
  try { migan = await cdp.evaluate(`window.native.wmInpaint(${JSON.stringify(b64(firstImage))}, 'image/png')`, 60000); }
  catch (e) { migan = { ok: false, error: String(e.message || e).slice(0, 300) }; }
  const data = { upscale, wm, ffmpeg, parallax, migan };
  fs.writeFileSync(path.join(dir, 'probe-report.json'), JSON.stringify(data, null, 2));
  return data;
}

// ── Ảnh màn hình từng tab (bằng chứng UI + sản phẩm hiển thị của các tool không xuất file) ──
async function sweepScreenshots(cdp, runDir, diagnostics) {
  const dir = path.join(runDir, 'man-hinh');
  fs.mkdirSync(dir, { recursive: true });
  const tools = await cdp.evaluate(`[...document.querySelectorAll('.nav-item[data-tool]')].map(el => el.getAttribute('data-tool'))`);
  const shots = [];
  for (const tool of tools) {
    const excBefore = diagnostics.rendererExceptions.length;
    try {
      await cdp.click(`[data-tool="${tool}"]`);
      await sleep(500);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 15000);
      const file = path.join(dir, tool + '.png');
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      shots.push({ tool, file, bytes: fs.statSync(file).size, exceptions: diagnostics.rendererExceptions.length - excBefore });
    } catch (e) {
      shots.push({ tool, error: String(e.message || e).slice(0, 300) });
    }
  }
  return shots;
}

function writeReadme(runDir, report) {
  const voice = report.products.voice, render = report.products.render, script = report.products.script;
  const va = report.products.videoAgent, probes = report.products.probes;
  const lines = [];
  lines.push('# Sản phẩm thật của từng chức năng — AI Video Studio (bản đóng gói)');
  lines.push('');
  lines.push('Chạy lúc: ' + report.startedAt + ' — từ exe: `' + report.executable + '`');
  lines.push('');
  lines.push('| Chức năng | Sản phẩm | Kiểm chứng |');
  lines.push('|---|---|---|');
  const row = (fn, file, verify) => lines.push('| ' + fn + ' | ' + (file || '—') + ' | ' + (verify || '—') + ' |');
  if (voice && voice.ok) {
    const dur = voice.meta?.format?.duration ? Number(voice.meta.format.duration).toFixed(2) + 's' : '?';
    const sr = (voice.meta?.streams || []).find((s) => s.codec_type === 'audio')?.sample_rate || '?';
    row('Tạo giọng nói (OmniVoice/VieNeu)', '`01-tao-giong-noi/`', `engine=${voice.engine}, ${dur} @ ${sr}Hz, ${(voice.bytes / 1024).toFixed(0)}KB + .srt`);
  } else row('Tạo giọng nói', '—', 'LỖI: ' + (voice && voice.error));
  if (render && render.ok) {
    const st = render.meta?.streams || [];
    const v = st.find((s) => s.codec_type === 'video'), a = st.find((s) => s.codec_type === 'audio');
    row('Dựng Video (FFmpeg)', '`02-dung-video/video-dung-kenburns.mp4`', `${Number(render.meta?.format?.duration || 0).toFixed(1)}s, ${v?.codec_name}${render.result.gpu ? ' (GPU/' + render.result.encoder + ')' : ' (CPU)'}, audio=${a ? a.codec_name : 'không'}`);
  } else row('Dựng Video', '—', 'LỖI: ' + (render && render.error));
  if (script && script.ok) row('Tạo Kịch Bản', '`03-tao-kich-ban/kich-ban.md`', `${script.bytes}B — văn bản từ LLM loopback (máy chưa có API thật)`);
  else row('Tạo Kịch Bản', '—', 'LỖI: ' + (script && script.error));
  if (va) {
    const v = (va.meta?.streams || []).find((s) => s.codec_type === 'video');
    row('Video Agent (pipeline tự động)', va.finalFile ? '`04-video-agent/video-agent-final.mp4`' : '—',
      va.ok ? `${Number(va.meta?.format?.duration || 0).toFixed(1)}s ${v?.width}x${v?.height} ${v?.codec_name}` : 'status=' + (va.result?.status || '?') + ' ' + String(va.result?.error?.message || va.result?.error || '').slice(0, 200));
  }
  const upOk = probes?.upscale?.ok;
  row('Nâng cấp ảnh (Real-ESRGAN)', upOk ? 'engine sẵn sàng' : 'engine chưa có trên máy', upOk ? probes.upscale.bin : 'probe ok=false (thiếu upscaler-bin)');
  row('Xoá watermark (WatermarkRemover-AI)', probes?.wm?.hasRoot ? 'engine sẵn sàng' : 'engine chưa cài', JSON.stringify(probes?.wm || {}));
  row('Xoá dấu ✦ (MI-GAN)', typeof probes?.migan === 'string' && probes.migan.length > 100 ? 'trả về ảnh đã xoá dấu' : 'engine chưa có trên máy', '');
  row('Parallax 3D (Depth AI)', probes?.parallax?.ok ? 'clip 3D: ' + probes.parallax.path : 'engine chưa cài', String(probes?.parallax?.error || '').slice(0, 160));
  row('Toàn bộ tab UI', '`man-hinh/*.png`', (report.screenshots || []).length + ' ảnh màn hình từng chức năng');
  lines.push('');
  lines.push('Chi tiết: `report.json`. Các thư mục con mở trực tiếp được (MP4 / audio / MD / PNG).');
  lines.push('');
  lines.push('Ghi chú: giọng đọc tổng hợp OFFLINE bằng engine VieNeu (CPU, model đã cache trên máy).');
  lines.push('Kịch bản dạng văn bản đi qua LLM loopback vì máy chưa cấu hình API thật — cấu hình API rồi chạy lại để có nội dung LLM thật.');
  lines.push('');
  lines.push('## Bug phát hiện được trong app đóng gói (cần fix ở source)');
  lines.push('- `voice-install-backend` (nova/main/ipc/voice.js) dò backend ở `unpackedNovaRoot()\\voice-backend`, nhưng');
  lines.push('  `fs-utils.unpackedNovaRoot()` trả về `app.asar.unpacked` (không có `\\nova`) → nút "Cài backend vào máy" luôn báo');
  lines.push('  "Không tìm thấy backend đóng gói trong app." Bản chạy này dùng cơ chế `voice-root.txt` (giống nút chọn thư mục)');
  lines.push('  trỏ tới `app.asar.unpacked\\nova\\voice-backend` (kèm venv `.venv-vieneu`) để chạy đúng backend packaged.');
  lines.push('- Parallax 3D (parallax-native.js) hardcoded các đường dẫn python kiểu Unix (`python3`, `~/.omnivoice-venv`) → không chạy được trên Windows.');
  fs.writeFileSync(path.join(runDir, 'README.md'), lines.join('\n') + '\n', 'utf8');
}

async function main() {
  const startedAt = new Date();
  const runDir = path.join(ROOT, 'artifacts', RUN_PREFIX + '-' + stamp());
  fs.mkdirSync(runDir, { recursive: true });
  const report = {
    startedAt: startedAt.toISOString(), runDir, status: 'running',
    executable: null, products: {}, screenshots: [],
    diagnostics: { rendererConsole: [], rendererExceptions: [], appStdout: '', appStderr: '' },
  };
  let child = null, cdp = null, mock = null;
  try {
    report.executable = findPackagedExe(ROOT, process.env.NOVA_REAL_EXE || process.argv[2]);
    await waitForStableDist(report.executable, report);
    const profileRoot = path.join(runDir, 'profile');
    fs.mkdirSync(profileRoot, { recursive: true });
    prepareVoiceRoot(profileRoot, report.executable, report);
    const env = buildEnv(profileRoot);
    const ffmpeg = ffmpegBin();
    if (!ffmpeg || !ffprobeBin()) throw new Error('Thiếu ffmpeg-static/ffprobe-static trong node_modules — không thể tạo ảnh nguồn/kiểm chứng.');
    report.sourceImages = await makeSourceImages(runDir, ffmpeg);

    mock = startMockLlm();
    const mockPort = await listen(mock.server, 0);
    report.mockLlm = { baseUrl: 'http://127.0.0.1:' + mockPort, port: mockPort };

    const discoveryServer = http.createServer();
    const cdpPort = await listen(discoveryServer, 0);
    await closeServer(discoveryServer);

    child = spawn(report.executable, [`--remote-debugging-port=${cdpPort}`, '--no-first-run'], {
      cwd: path.dirname(report.executable), env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (c) => { report.diagnostics.appStdout = (report.diagnostics.appStdout + redact(c)).slice(-16000); });
    child.stderr?.on('data', (c) => { report.diagnostics.appStderr = (report.diagnostics.appStderr + redact(c)).slice(-16000); });
    report.appPid = child.pid;
    for (const port of FIXED_PORTS) await waitForPort(port, true, 30000);
    await waitForJson('http://127.0.0.1:8794/health', (v) => v?.ok === true, 10000);

    const target = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`, (targets) =>
      Array.isArray(targets) && targets.find((item) => item.type === 'page' && /\/index\.html(?:$|[?#])/.test(item.url || '')), 45000);
    const page = target.find((item) => item.type === 'page' && /\/index\.html(?:$|[?#])/.test(item.url || ''));
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    cdp.on('Runtime.consoleAPICalled', (event) => {
      const line = (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' ');
      report.diagnostics.rendererConsole.push(redact(`${event.type}: ${line}`).slice(0, 500));
      report.diagnostics.rendererConsole = report.diagnostics.rendererConsole.slice(-80);
    });
    cdp.on('Runtime.exceptionThrown', (event) => {
      report.diagnostics.rendererExceptions.push(redact(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'renderer exception').slice(0, 1500));
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-tool="toolsettings"]')`, 'UI sẵn sàng', 30000);

    // Sản phẩm từng chức năng — mỗi bước độc lập, bước nào lỗi thì ghi vào report rồi chạy tiếp.
    const steps = [
      ['voice', () => productVoice(cdp, runDir, report)],
      ['render', () => productRender(cdp, runDir, report.sourceImages, report.products.voice && report.products.voice.audioFile)],
      ['script', () => productScript(cdp, runDir, report.mockLlm.baseUrl, mock.requests)],
      ['videoAgent', () => productVideoAgent(cdp, runDir, report.sourceImages, report.products.voice && report.products.voice.audioFile)],
      ['probes', () => productProbes(cdp, runDir, report.sourceImages[0])],
    ];
    for (const [name, fn] of steps) {
      const t0 = Date.now();
      try {
        report.products[name] = await fn();
        console.log('[ok] ' + name + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
      } catch (e) {
        report.products[name] = { ok: false, error: redact(String(e.message || e)) };
        console.log('[FAIL] ' + name + ': ' + (e.message || e));
      }
    }
    report.screenshots = await sweepScreenshots(cdp, runDir, report.diagnostics);
    report.rendererExceptionCount = report.diagnostics.rendererExceptions.length;
    report.status = 'done';
  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: redact(error.message), stack: redact(error.stack || '') };
    process.exitCode = 1;
  } finally {
    try { if (cdp) await cdp.send('Browser.close', {}, 5000); } catch (_) {}
    try { cdp?.close(); } catch (_) {}
    if (child && child.exitCode === null) await forceKill(child.pid);
    if (mock) await closeServer(mock.server);
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAt.getTime();
    try { writeReadme(runDir, report); } catch (_) {}
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: report.status, runDir, report: path.join(runDir, 'report.json') }, null, 2));
  }
}

main().catch((e) => { console.error(redact(e.stack || e)); process.exit(1); });

// Chờ build song song (nếu có) kết thúc: asar tồn tại + mtime ổn định + không có builder
// đang chạy + các file unpacked lớn (voice-backend 583MB) đã copy đủ — tránh chạy giữa
// lúc electron-builder đang hoán đổi dist (nguyên nhân run trước fail voice-install).
async function builderPids() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'node.exe','app-builder.exe' -and $_.CommandLine -match 'electron-builder|app-builder' } | Select-Object -ExpandProperty ProcessId"],
      { windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) => resolve(err ? [] : String(stdout).split(/\s+/).filter(Boolean)));
  });
}
async function waitForStableDist(exePath, report) {
  const resDir = path.join(path.dirname(exePath), 'resources');
  const asar = path.join(resDir, 'app.asar');
  const unpackedBackend = path.join(resDir, 'app.asar.unpacked', 'nova', 'voice-backend', 'backend', 'app.py');
  const deadline = Date.now() + 15 * 60 * 1000;
  for (;;) {
    const builders = await builderPids();
    const asarOk = fs.existsSync(asar);
    const backendOk = fs.existsSync(unpackedBackend);
    let mtimeOk = false;
    if (asarOk) {
      const m1 = fs.statSync(asar).mtimeMs;
      await sleep(5000);
      mtimeOk = fs.existsSync(asar) && Math.abs(fs.statSync(asar).mtimeMs - m1) < 5;
    }
    if (!builders.length && asarOk && backendOk && mtimeOk) {
      return report.distStable = { ok: true, asar, mtime: new Date().toISOString(), backendUnpacked: backendOk };
    }
    if (Date.now() > deadline) throw new Error('dist không ổn định sau 15 phút (build song song?): builders=' + builders.join(',') + ' asar=' + asarOk + ' backend=' + backendOk);
    console.log('[wait] dist đang bận (builders=' + builders.join(',') + ', asar=' + asarOk + ', backend=' + backendOk + ') — chờ...');
    await sleep(20000);
  }
}
