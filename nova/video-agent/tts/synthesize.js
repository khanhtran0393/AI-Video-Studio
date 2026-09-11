'use strict';
// TTS local fallback (học từ NNLauncher — OmniVoice chạy offline): gọi backend Voice Studio
// đóng gói kèm app (voice-studio, uvicorn 127.0.0.1:8771) đúng hợp đồng /api/tts:
//   POST /api/tts { text, language, preset_id, speed } → { task_id, poll_url }
//   GET  /api/status/{tid} → { status: pending|running|completed|failed, results, error }
//   GET  /api/files/{tid}/output.mp3 (results.merged) + output.srt (results.srt)
// KHÔNG fallback ngầm (Luật 10): backend thiếu → VA_TTS_BACKEND_UNAVAILABLE, backend lỗi
// tổng hợp → VA_TTS_SYNTH_FAIL, không có văn bản → VA_TTS_AUTO_NO_TEXT.
const fs = require('fs');
const path = require('path');

// Cổng backend giọng nói: một nguồn duy nhất là voice-native/server.js (8771, legacy 8770).
// Ở đây chỉ ĐỌC lại hằng số qua lazy-require; env VA_TTS_BACKEND_URL để trỏ chỗ khác.
function defaultBaseUrl() {
  try { const vn = require('../../voice-native'); if (vn && vn.URL) return vn.URL; } catch (_) {}
  if (process.env.VA_TTS_BACKEND_URL) return String(process.env.VA_TTS_BACKEND_URL);
  return 'http://127.0.0.1:8771';
}

async function _fetchJson(url, opts = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, timeoutMs);
  try {
    if (opts.signal) opts.signal.addEventListener('abort', () => { try { ctrl.abort(); } catch (_) {} }, { once: true });
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (_) {}
    return { status: r.status, ok: r.ok, json, text };
  } finally { clearTimeout(timer); }
}

function _throw(code, message) { const e = new Error(message); e.code = code; throw e; }

// Probe /api/health — nhận đúng backend Voice Studio (body {status:'ok'}), không nhận nhầm service khác.
async function probeVoiceBackend({ baseUrl, timeoutMs = 4000 } = {}) {
  const base = String(baseUrl || defaultBaseUrl()).replace(/\/+$/, '');
  try {
    const r = await _fetchJson(base + '/api/health', {}, timeoutMs);
    if (r.ok && r.json && r.json.status === 'ok')
      return { ok: true, url: base, engine: r.json.tts_engine || null, profile: r.json.tts_profile || null };
    return { ok: false, code: 'VA_TTS_BACKEND_UNAVAILABLE', url: base };
  } catch (_) { return { ok: false, code: 'VA_TTS_BACKEND_UNAVAILABLE', url: base }; }
}

// Tổng hợp 1 đoạn văn bản thành file audio (mp3) qua backend local. Ném lỗi VA_TTS_* lộ liễu.
async function synthesizeVoice({ text, voice = null, language = 'vi', speed = 1.0, baseUrl,
  outPath, srtPath = null, timeoutMs = 15 * 60 * 1000, pollMs = 1000, signal = null, onLog = null } = {}) {
  const base = String(baseUrl || defaultBaseUrl()).replace(/\/+$/, '');
  const body = String(text == null ? '' : text).trim();
  if (!body) _throw('VA_TTS_AUTO_NO_TEXT', 'Không có văn bản để tổng hợp giọng (text rỗng).');
  if (!outPath) _throw('VA_TTS_NO_OUTPUT', 'Thiếu outPath cho file giọng tổng hợp.');

  const probe = await probeVoiceBackend({ baseUrl: base });
  if (!probe.ok) _throw('VA_TTS_BACKEND_UNAVAILABLE',
    'Backend giọng nói local chưa chạy (' + base + '). Mở tab Tạo giọng nói để khởi động backend, hoặc tắt options.autoTts.');

  const log = (line) => { if (onLog) { try { onLog(line); } catch (_) {} } };
  let resp;
  try {
    resp = await _fetchJson(base + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body, language, preset_id: voice || null, speed }) }, 10000);
  } catch (e) { _throw('VA_TTS_SYNTH_FAIL', 'Không gọi được /api/tts: ' + ((e && e.message) || e)); }
  if (!resp.ok || !resp.json || !resp.json.task_id)
    _throw('VA_TTS_SYNTH_FAIL', '/api/tts trả không hợp lệ: ' + String(resp.text || '').slice(0, 200));
  const taskId = resp.json.task_id;
  log('[auto-tts] backend nhận task ' + taskId + ' (engine ' + (probe.engine || '?') + ')');

  const deadline = Date.now() + timeoutMs;
  let results = null;
  for (;;) {
    if (signal && signal.aborted) _throw('VA_CANCELLED', 'Job bị huỷ trong khi tổng hợp giọng.');
    if (Date.now() > deadline) _throw('VA_TTS_SYNTH_TIMEOUT', 'Tổng hợp giọng quá thời gian ' + timeoutMs + 'ms.');
    await new Promise((r) => setTimeout(r, pollMs));
    let st;
    try { st = await _fetchJson(base + '/api/status/' + taskId, {}, 5000); }
    catch (_) { continue; } // poll lỗi tạm thời → thử lại tới deadline (timeout chặn, không phải fallback)
    if (st.ok && st.json) {
      if (st.json.status === 'completed') { results = st.json.results || null; break; }
      if (st.json.status === 'failed')
        _throw('VA_TTS_SYNTH_FAIL', 'Backend tổng hợp giọng lỗi: ' + String(st.json.error || 'không rõ'));
    }
  }
  const merged = results && (results.merged || null);
  if (!merged) _throw('VA_TTS_SYNTH_FAIL', 'Backend không trả file audio merged cho task ' + taskId + '.');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let audioResp;
  try { audioResp = await fetch(base + merged, { signal: signal || undefined }); }
  catch (e) { _throw('VA_TTS_SYNTH_FAIL', 'Không tải được audio tổng hợp: ' + ((e && e.message) || e)); }
  if (!audioResp.ok) _throw('VA_TTS_SYNTH_FAIL', 'Tải audio tổng hợp trả HTTP ' + audioResp.status + '.');
  fs.writeFileSync(outPath, Buffer.from(await audioResp.arrayBuffer()));

  // SRT là sản phẩm phụ (subtitle theo câu của backend) — thiếu/không tải được thì
  // ghi nhận srtPath=null trong kết quả, KHÔNG cản audio chính.
  let srtOut = null;
  if (srtPath && results.srt) {
    try {
      const sr = await fetch(base + results.srt, { signal: signal || undefined });
      if (sr.ok) { fs.writeFileSync(srtPath, await sr.text(), 'utf8'); srtOut = srtPath; }
    } catch (_) {}
  }
  log('[auto-tts] đã ghi ' + outPath + (srtOut ? ' + ' + srtOut : ''));
  return { ok: true, path: outPath, srtPath: srtOut, taskId, engine: probe.engine, baseUrl: base };
}

// Hook cho orchestrator/analyze.js: nếu options.autoTts bật mà dự án chưa có ttsAudio
// → tổng hợp giọng từ options.autoTts.text / textPath / nội dung script (.txt/.md) rồi
// ghi ra <projectDir>/voice/auto-tts.mp3 (+ .srt). Trả null nếu autoTts không bật,
// { skipped: true } nếu đã có giọng sẵn — caller tự gán project.files.ttsAudio.
async function autoSynthesizeTts({ project, options, projectDir, signal = null, onLog = null } = {}) {
  const cfg = options && options.autoTts;
  if (!cfg) return null;
  const prj = project || {};
  const files = prj.files || {};
  if (files.ttsAudio) return { ok: true, path: files.ttsAudio, skipped: 'đã có ttsAudio' };
  let text = typeof cfg.text === 'string' && cfg.text.trim() ? cfg.text : null;
  if (!text && cfg.textPath && fs.existsSync(cfg.textPath)) text = fs.readFileSync(cfg.textPath, 'utf8');
  if (!text && files.script && /\.(txt|md|srt)$/i.test(files.script) && fs.existsSync(files.script))
    text = fs.readFileSync(files.script, 'utf8');
  if (!text) _throw('VA_TTS_AUTO_NO_TEXT',
    'options.autoTts bật nhưng không xác định được văn bản — đặt options.autoTts.text/textPath, hoặc script dạng .txt/.md.');
  const dir = projectDir || prj.root || process.cwd();
  return synthesizeVoice({ text, voice: cfg.voice || null, speed: cfg.speed || 1.0, language: cfg.language || 'vi',
    baseUrl: cfg.baseUrl, outPath: path.join(dir, 'voice', 'auto-tts.mp3'), srtPath: path.join(dir, 'voice', 'auto-tts.srt'),
    timeoutMs: cfg.timeoutMs, signal, onLog });
}

module.exports = { defaultBaseUrl, probeVoiceBackend, synthesizeVoice, autoSynthesizeTts };



