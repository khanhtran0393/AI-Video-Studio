'use strict';

/* UI smoke test cho tab Giọng nói (Voice Studio): mở app Electron thật, điều khiển qua CDP.
   - Vào tab toolvoice, đợi backend OmniVoice/VieNeu/XTTS sẵn sàng.
   - Thêm giọng clone từ SẢN PHẨM ĐẦU CUỐI của khâu upstream (video-agent: audio rút từ
     video-agent-final.mp4 hoặc tts/chapter-*.mp3), xác nhận xuất hiện trong thư viện (_giongDS).
   - Tạo sản phẩm TTS thật bằng chính giọng clone đó, xuất file, kiểm chứng bằng ffprobe.
   - Xóa giọng vừa thêm, xác nhận biến mất.
   - Chụp ảnh từng bước vào %TEMP%\voice-ui-smoke-<timestamp>\ (không ghi vào repo).
   Lưu ý: các biến renderer như _voiceReady/_giongDS là `let` ở global lexical scope,
   KHÔNG nằm trên window — phải tham chiếu trực tiếp bằng tên, không dùng window.*.
   Chạy: npm run test:voice:ui */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { CdpClient } = require('./smoke-cdp');

const ROOT = path.resolve(__dirname, '..', '..');
const CDP_PORT = Number(process.env.VOICE_UI_CDP_PORT || 49377);
const OUT = path.join(os.tmpdir(), `voice-ui-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const SAMPLE_WAV = path.join(ROOT, 'nova', 'voice-studio', 'backend', 'presets', 'en-male-narrator.wav');
const NAME = 'UI TEST CLONE';
const GEN_TEXT = 'Đây là bản kiểm thử tự động: giọng clone do AI Video Studio tạo, đang đọc một câu để lấy sản phẩm cuối cùng.';

const log = (...a) => console.log('[voice-ui]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (url, t = 3000) => new Promise((res, rej) => {
  const r = http.get(url, { timeout: t }, (rs) => { let b = ''; rs.on('data', (c) => b += c); rs.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
  r.on('error', rej); r.on('timeout', () => { r.destroy(); rej(new Error('http timeout')); });
});

async function shot(cdp, tag) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, 20000);
  const f = path.join(OUT, `step-${tag}.png`);
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  log('screenshot ->', f);
}

async function attachFile(cdp, selector, filePath) {
  const doc = await cdp.send('DOM.getDocument');
  const q = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
  if (!q.nodeId) throw new Error('Khong tim thay input ' + selector);
  await cdp.send('DOM.setFileInputFiles', { files: [filePath], nodeId: q.nodeId });
}

function killTree(pid) {
  try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch (_) {}
}

/* Kiểm chứng file audio thật bằng ffprobe — trả duration giây và codec của stream audio đầu tiên. */
function ffprobeAudio(file) {
  let bin;
  try { bin = require('ffprobe-static').path; } catch (_) { return Promise.resolve(null); } // ffprobe không có thì bỏ qua
  return new Promise((res) => {
    execFile(bin, ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', file], { timeout: 30000, windowsHide: true }, (e, out) => {
      if (e) { res({ error: e.message }); return; }
      try {
        const j = JSON.parse(out);
        const au = (j.streams || []).find((s) => s.codec_type === 'audio') || {};
        res({ duration: Number(au.duration || (j.format || {}).duration || 0), codec: au.codec_name || '', sampleRate: Number(au.sample_rate || 0) });
      } catch (err) { res({ error: err.message }); }
    });
  });
}

/* Tìm SẢN PHẨM ĐẦU CUỐI của khâu upstream (video-agent) làm giọng mẫu cho clone,
   thay vì file preset có sẵn — kiểm chứng chuỗi khâu nối nhau trong app thật:
   1) Env VOICE_UI_REF: ép file cụ thể.
   2) artifacts/<run>/04-video-agent/video-agent-final.mp4 (mới nhất) → rút track audio ra WAV 24k mono (ffmpeg).
   3) artifacts/<run>/04-video-agent/.../tts/chapter-*.mp3 (mới nhất) — sản phẩm TTS của khâu upstream.
   4) Fallback preset WAV khi máy chưa có sản phẩm upstream (vẫn chạy được regression). */
function walkTim(dir, pred, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTim(p, pred, out);
    else if (pred(p)) out.push(p);
  }
  return out;
}
const moiNhat = (files) => files.reduce((a, b) => (fs.statSync(b).mtimeMs > fs.statSync(a).mtimeMs ? b : a));

function chayFfmpeg(args) {
  let mod; try { mod = require('ffmpeg-static'); } catch (_) { return Promise.resolve(false); }
  const bin = typeof mod === 'string' ? mod : mod.path;
  if (!bin || !fs.existsSync(bin)) return Promise.resolve(false);
  return new Promise((res) => execFile(bin, args, { timeout: 120000, windowsHide: true }, (e) => res(!e)));
}

async function timRefUpstream() {
  if (process.env.VOICE_UI_REF) {
    if (!fs.existsSync(process.env.VOICE_UI_REF)) throw new Error('VOICE_UI_REF khong ton tai: ' + process.env.VOICE_UI_REF);
    return { file: process.env.VOICE_UI_REF, nguon: 'env VOICE_UI_REF' };
  }
  const artDir = path.join(ROOT, 'artifacts');
  if (fs.existsSync(artDir)) {
    const videos = [], mp3s = [];
    for (const d of fs.readdirSync(artDir)) {
      const va = path.join(artDir, d, '04-video-agent');
      if (!fs.existsSync(va)) continue;
      const fin = path.join(va, 'video-agent-final.mp4');
      if (fs.existsSync(fin) && fs.statSync(fin).size > 100000) videos.push(fin);
      walkTim(va, (p) => /^chapter-.*\.mp3$/i.test(path.basename(p)), mp3s);
    }
    // Ưu tiên sản phẩm cuối của khâu video: rút track audio (kể cả aac trong mp4) ra WAV.
    if (videos.length) {
      const fin = moiNhat(videos);
      const wav = path.join(OUT, 'upstream-video-audio.wav');
      const ok = await chayFfmpeg(['-y', '-v', 'error', '-i', fin, '-vn', '-acodec', 'pcm_s16le', '-ar', '24000', '-ac', '1', wav]);
      if (ok && fs.existsSync(wav) && fs.statSync(wav).size > 50000) {
        return { file: wav, nguon: 'video-agent-final.mp4 → track audio WAV', goc: fin };
      }
      log('khong rut duoc audio tu video-final, thu mp3 TTS upstream');
    }
    if (mp3s.length) return { file: moiNhat(mp3s), nguon: 'tts chapter-*.mp3 (khau TTS upstream)' };
  }
  if (!fs.existsSync(SAMPLE_WAV)) throw new Error('Thieu file mau: ' + SAMPLE_WAV);
  return { file: SAMPLE_WAV, nguon: 'fallback preset WAV (chua co san pham upstream)' };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  log('artifacts dir:', OUT);

  // Giọng mẫu: lấy SẢN PHẨM THẬT của khâu upstream (video-agent) thay vì preset.
  const ref = await timRefUpstream();
  const fpRef = await ffprobeAudio(ref.file);
  log('ref giong mau:', ref.file, '| nguon:', ref.nguon, ref.goc ? '| goc: ' + ref.goc : '');
  log('ffprobe ref:', JSON.stringify(fpRef), '| size:', fs.statSync(ref.file).size, 'bytes');
  if (ref.nguon.indexOf('fallback') < 0) {
    // Sản phẩm upstream phải là audio thật, đủ dài để làm mẫu clone.
    if (!fpRef || fpRef.error || !fpRef.codec) throw new Error('San pham upstream khong doc duoc audio: ' + JSON.stringify(fpRef));
    if (fpRef.duration < 3) throw new Error('San pham upstream qua ngan lam mau clone: ' + fpRef.duration + 's');
  }

  const exe = path.join(ROOT, 'node_modules', '.bin', 'electron.cmd');
  const app = spawn('cmd.exe', ['/c', exe, '.', `--remote-debugging-port=${CDP_PORT}`], { cwd: ROOT, windowsHide: true, stdio: 'ignore' });
  log('app pid', app.pid);

  try {
    let target = null;
    for (let i = 0; i < 90 && !target; i++) {
      await sleep(1000);
      try {
        const list = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        target = (list || []).find((t) => t.type === 'page' && /index\.html|nova[\\/]web/.test(t.url || '')) || (list || []).find((t) => t.type === 'page');
      } catch (_) {}
    }
    if (!target) throw new Error('Khong tim thay page cua app');
    log('page url:', target.url);

    const cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable').catch(() => {});
    await cdp.send('Runtime.enable').catch(() => {});

    await cdp.waitFor(`!!document.querySelector('#tool-toolvoice')`, 'main UI', 60000);
    await sleep(1500);
    await shot(cdp, '01-home');

    await cdp.click('.nav-item[data-tool="toolvoice"]');
    // switchTool gán class .active — đợi tab thật sự mở (state là lexical, không dùng window.state)
    await cdp.waitFor(`(() => { const el = document.getElementById('tool-toolvoice'); return !!el && el.classList.contains('active'); })()`, 'toolvoice tab active', 20000);
    if (await cdp.evaluate('typeof state !== "undefined" && state.tool') !== 'toolvoice') throw new Error('state.tool khong phai toolvoice sau click');
    if (!(await cdp.evaluate('!!window.native && !!window.native.voiceStart'))) throw new Error('Thieu native bridge voice');
    await sleep(2000);
    await shot(cdp, '02-voice-tab');

    // đợi backend (cold start: nạp venv + model OmniVoice — có thể mất vài phút).
    // _voiceReady chỉ dựa vào /api/health probe của main — thêm xác nhận HTTP thật từ renderer
    // tới VOICE_URL để tránh trường hợp backend cũ chết dần giữa chừng (đã gặp: "Failed to fetch").
    let backendOk = false, lastTxt = '';
    for (let i = 0; i < 300; i++) {
      lastTxt = (await cdp.evaluate(`(document.getElementById('voiceBackendStatus')||{}).textContent || ''`).catch(() => '')) || '';
      backendOk = await cdp.evaluate(`(async () => { if (typeof _voiceReady === 'undefined' || _voiceReady !== true) return false; try { const r = await fetch(VOICE_URL + '/api/voices'); return r.ok; } catch (e) { return false; } })()`).catch(() => false);
      if (backendOk) break;
      if (i % 15 === 0) log(`waiting backend (${i}s):`, lastTxt.trim().slice(0, 120));
      await sleep(1000);
    }
    log('backend ready:', backendOk, '| status text:', lastTxt.trim().slice(0, 160));
    if (!backendOk) throw new Error('Backend giong noi khong san sang sau 300s');

    await cdp.waitFor(`!!document.querySelector('#giongLuoi .gadd')`, 'grid rendered (.gadd)', 120000);
    await shot(cdp, '03-backend-status');

    // Dọn giọng test còn sót từ lần chạy trước (backend persist xuyên suốt các lần chạy).
    const don = await cdp.evaluate(`(async () => { let n = 0; try { const data = await (await fetch(VOICE_URL + '/api/voices')).json(); const list = Array.isArray(data) ? data : (data.voices || []); for (const v of list){ if ((v.name || '').indexOf(${JSON.stringify(NAME)}) >= 0){ await fetch(VOICE_URL + '/api/voices/' + v.id, { method: 'DELETE' }); n++; } } } catch (e) {} return n; })()`, 30000).catch(() => 0);
    if (don) { log('don', don, 'giong test sot lai tu lan chay truoc'); await cdp.evaluate('typeof giongTaiDS === "function" && giongTaiDS()').catch(() => {}); await sleep(1500); }

    await cdp.click('#giongLuoi .gadd');
    await sleep(800);
    if (!(await cdp.evaluate(`((document.getElementById('giongThemBox')||{}).style || {}).display !== 'none'`))) throw new Error('Hop them giong khong hien');
    const mode = await cdp.evaluate(`(document.getElementById('giongThemCach')||{}).value`);
    if (mode !== 'clone') throw new Error('Che do mac dinh khong phai clone: ' + mode);
    await shot(cdp, '04-add-voice-box');

    await attachFile(cdp, '#gtFile', ref.file);
    await sleep(500);
    if (!(await cdp.evaluate(`!!(document.getElementById('gtFile').files || [])[0]`))) throw new Error('Khong attach duoc file mau');

    await cdp.setValue('#gtTen', NAME);
    await cdp.click('button[onclick="giongThemLuu()"]');
    await shot(cdp, '05-saving');

    let inList = false;
    for (let i = 0; i < 60 && !inList; i++) {
      await sleep(500);
      inList = await cdp.evaluate(`(typeof _giongDS !== "undefined" && _giongDS || []).some(v => (v.name||'').indexOf(${JSON.stringify(NAME)}) >= 0 && v.kind === 'clone')`).catch(() => false);
    }
    const statusMsg = (await cdp.evaluate(`(document.getElementById('voiceGenStatus')||{}).textContent || ''`).catch(() => '')) || '';
    log('voice in library:', inList, '| status:', statusMsg.trim().slice(0, 200));
    if (!inList) throw new Error('Giong clone khong xuat hien trong thu vien');
    await shot(cdp, '06-after-save');

    // ── 07: TẠO SẢN PHẨM THẬT — đọc văn bản bằng chính giọng clone vừa thêm, lấy file audio ra ngoài ──
    // Chọn engine qua dropdown UI (đúng luồng người dùng). Mặc định VieNeu: torch-free, clone zero-shot,
    // chạy ngay với .venv-vieneu. OmniVoice cần .venv-omni đầy đủ (torch+transformers) — override:
    // set VOICE_UI_ENGINE=omni khi máy đã cài đủ.
    const ENGINE = process.env.VOICE_UI_ENGINE || 'vieneu';
    if (ENGINE !== 'omni'){
      await cdp.click('#voiceBackendBtn');
      await sleep(400);
      const engClick = await cdp.evaluate(`(() => { const it = document.querySelector('#voiceBackendMenu .be-item[data-eng=${JSON.stringify(ENGINE)}]'); if (!it) return 'item-not-found'; it.click(); return 'clicked'; })()`);
      if (engClick !== 'clicked') throw new Error('Khong chon duoc engine ' + ENGINE + ' trong dropdown: ' + engClick);
      await sleep(600);
      const engHienTai = (await cdp.evaluate(`(typeof _voiceBackend !== 'undefined' && _voiceBackend) || ''`).catch(() => '')) || '';
      const engTT = await cdp.evaluate(`(typeof _giongTT !== 'undefined' && _giongTT) || {}`).catch(() => ({}));
      log('engine selected:', engHienTai, '| statuses:', JSON.stringify(engTT));
      if (engHienTai !== ENGINE) throw new Error('Engine khong doi duoc: ' + engHienTai);
    }

    const chonCard = await cdp.evaluate(`(() => { const card = [...document.querySelectorAll('#giongLuoi .gcard')].find(c => c.textContent.indexOf(${JSON.stringify(NAME)}) >= 0); if (!card) return 'card-not-found'; card.click(); return 'clicked'; })()`);
    if (chonCard !== 'clicked') throw new Error('Khong click duoc the giong clone: ' + chonCard);
    await sleep(1200); // đợi giongBam() chọn + phát mẫu 4s
    const sel = await cdp.evaluate(`(() => { const key = (typeof _giongChon !== 'undefined' && _giongChon) || ''; const v = (typeof _giongDS !== 'undefined' && _giongDS || []).find(x => x.key === key); return v ? { key, name: v.name, engine: (typeof _voiceBackend !== 'undefined' && _voiceBackend) || '' } : { key: '', name: '', engine: '' }; })()`);
    log('selected voice:', JSON.stringify(sel));
    if (!sel.name || sel.name.indexOf(NAME) < 0) throw new Error('Giong clone chua duoc chon sau khi click the');

    await cdp.setValue('#voiceText', GEN_TEXT);
    await cdp.click('#voiceGenBtn');
    await shot(cdp, '07-generating');

    let genDone = false, genErr = '', lastGen = '';
    for (let i = 0; i < 600 && !genDone; i++) {
      lastGen = (await cdp.evaluate(`(document.getElementById('voiceGenStatus')||{}).textContent || ''`).catch(() => '')) || '';
      genDone = await cdp.evaluate(`(typeof _giongSu !== 'undefined' && _giongSu || []).length > 0`).catch(() => false);
      genErr = /Lỗi:/i.test(lastGen) ? lastGen : '';
      if (genErr) break;
      if (i % 30 === 0) log(`waiting TTS (${i}s):`, lastGen.trim().slice(0, 120));
      await sleep(1000);
    }
    log('TTS status:', lastGen.trim().slice(0, 200), '| done:', genDone);
    if (genErr) throw new Error('TTS loi UI: ' + genErr);
    if (!genDone) throw new Error('TTS khong xong sau 600s (cuoi cung: ' + lastGen.trim().slice(0, 150) + ')');

    // Trích blob sản phẩm từ _giongSu[0] về file ngoài (base64 qua CDP).
    const sanPham = await cdp.evaluate(`(async () => { const h = (typeof _giongSu !== 'undefined' && _giongSu || [])[0]; if (!h || !h.blob) return null; const bytes = new Uint8Array(await h.blob.arrayBuffer()); let bin = ''; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return { b64: btoa(bin), type: h.blob.type || '', giay: h.giay, ten: h.ten, engine: h.engine || '', text: (h.text || '').slice(0, 80) }; })()`, 120000);
    if (!sanPham || !sanPham.b64) throw new Error('Khong trich duoc blob san pham tu _giongSu');
    const ext = /mp3|mpeg/i.test(sanPham.type) ? 'mp3' : 'wav';
    const sanPhamFile = path.join(OUT, `san-pham-giong-clone.${ext}`);
    fs.writeFileSync(sanPhamFile, Buffer.from(sanPham.b64, 'base64'));
    const size = fs.statSync(sanPhamFile).size;
    const fp = await ffprobeAudio(sanPhamFile);
    log('san pham:', sanPhamFile, `(${size} bytes, type=${sanPham.type || '?'}, blob-duration=${sanPham.giay || 0}s)`);
    log('voice used:', sanPham.ten, '| engine:', sanPham.engine, '| text:', sanPham.text);
    log('ffprobe:', JSON.stringify(fp));
    if (size < 20000) throw new Error('File san pham qua nho: ' + size + ' bytes');
    if (fp && fp.error) throw new Error('ffprobe loi: ' + fp.error);
    if (fp) {
      if (!fp.codec) throw new Error('ffprobe: khong co stream audio');
      if (fp.duration < 1) throw new Error('ffprobe: duration qua ngan: ' + fp.duration + 's');
      if (fp.sampleRate && fp.sampleRate < 8000) throw new Error('ffprobe: sample rate la: ' + fp.sampleRate);
    } else {
      log('ffprobe khong kha dung — chi kiem tra kich thuoc + header');
      const head = fs.readFileSync(sanPhamFile).slice(0, 4).toString('latin1');
      const hopLe = head === 'RIFF' || head === 'ID3' || (ext === 'mp3' && head.charCodeAt(0) === 0xFF);
      if (!hopLe) throw new Error('Header file khong phai wav/mp3: ' + JSON.stringify(head));
    }
    await shot(cdp, '07b-product-done');

    await cdp.evaluate('window.confirm = () => true');
    const delResult = await cdp.evaluate(`(() => { const card = [...document.querySelectorAll('#giongLuoi .gcard')].find(c => c.textContent.indexOf(${JSON.stringify(NAME)}) >= 0); if (!card) return 'card-not-found'; const del = card.querySelector('.gdel'); if (!del) return 'no-delete-button'; del.click(); return 'clicked'; })()`);
    if (delResult !== 'clicked') throw new Error('Xoa that bai: ' + delResult);
    await sleep(1500);
    const stillThere = await cdp.evaluate(`(typeof _giongDS !== "undefined" && _giongDS || []).some(v => (v.name||'').indexOf(${JSON.stringify(NAME)}) >= 0)`).catch(() => true);
    if (stillThere) throw new Error('Giong van con sau khi xoa');
    await shot(cdp, '08-after-delete');

    log('FINAL library:', JSON.stringify(await cdp.evaluate(`(typeof _giongDS !== "undefined" && _giongDS || []).map(v => v.name + ' [' + v.kind + ']')`).catch(() => [])));
    cdp.close();
    log('PASS — them/xoa giong clone qua UI OK');
  } finally {
    killTree(app.pid);
    await sleep(2000);
  }
}

main().then(() => process.exit(0)).catch((e) => { log('FAILED:', e.message); process.exit(1); });

