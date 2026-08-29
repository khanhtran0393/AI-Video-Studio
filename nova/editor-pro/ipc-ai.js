// AI handlers cho Editor Pro. Text→cli-bridge (Claude), TTS→macOS say (offline, giọng Việt), clip→yt-dlp.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FFMPEG_BIN = require('./ff-path').FFMPEG;   // đường dẫn đã gỡ khỏi app.asar (spawn được)
const TTS_TMP = path.join(os.tmpdir(), 'nova-editor-pro');
try { fs.mkdirSync(TTS_TMP, { recursive: true }); } catch (_) {}
function _run(bin, args) { return new Promise((res, rej) => { const p = spawn(bin, args, { windowsHide: true }); let e = ''; p.stderr.on('data', d => e += d); p.on('error', rej); p.on('close', c => c === 0 ? res() : rej(new Error(e.slice(-200)))); }); }
// macOS say → mp3 (offline TTS, không cần key)
async function sayToMp3(text, voice) {
  const base = path.join(TTS_TMP, `voice_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const aiff = base + '.aiff', mp3 = base + '.mp3';
  const txtFile = base + '.txt'; fs.writeFileSync(txtFile, String(text || ''));
  await _run('say', ['-v', voice || 'Linh', '-o', aiff, '-f', txtFile]);
  await _run(FFMPEG_BIN, ['-i', aiff, '-codec:a', 'libmp3lame', '-qscale:a', '2', '-y', mp3]);
  try { fs.unlinkSync(aiff); fs.unlinkSync(txtFile); } catch (_) {}
  return mp3;
}

// ── AI: ưu tiên ĐÚNG API người dùng đã cấu hình trong Cài đặt → API (kho nova-settings),
// gọi thẳng relay/nhà cung cấp. CLI bridge nội bộ chỉ còn là CHỖ LÙI. ──
const _KHO = () => {
  try {
    const p = process.env.NOVA_SETTINGS || path.join(require('electron').app.getPath('userData'), 'nova-settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (_) { return {}; }
};
const _NHA_CC = {
  'openai-compatible': { kieu: 'oa', url: '', khoa: 'api_key', mac: '' },
  openai:     { kieu: 'oa', url: 'https://api.openai.com/v1/chat/completions',      khoa: 'api_key_openai',     mac: 'gpt-4o-mini' },
  openrouter: { kieu: 'oa', url: 'https://openrouter.ai/api/v1/chat/completions',   khoa: 'api_key_openrouter', mac: 'openai/gpt-4o-mini' },
  groq:       { kieu: 'oa', url: 'https://api.groq.com/openai/v1/chat/completions', khoa: 'api_key_groq',       mac: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  deepseek:   { kieu: 'oa', url: 'https://api.deepseek.com/chat/completions',       khoa: 'api_key_deepseek',   mac: 'deepseek-chat' },
  gemini:     { kieu: 'oa', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                khoa: 'api_key_gemini', mac: 'gemini-2.5-flash-lite' },
  anthropic:  { kieu: 'an', url: 'https://api.anthropic.com/v1/messages',           khoa: 'api_key_anthropic',  mac: 'claude-haiku-4.5' },
};
function _oaUrl(base) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  b = b.replace(/([^:])\/{2,}/g, '$1/');
  if (/\/chat\/completions$/i.test(b)) return b;
  if (/\/v1$/i.test(b)) return b + '/chat/completions';
  return b + '/v1/chat/completions';
}
// Gọi API đã cấu hình. Trả null khi chưa cấu hình (để caller lùi về CLI bridge).
async function _goiApi(messages, kho, systemHint = '') {
  // Relay có khi lỗi 5xx tạm thời hoặc chặn "duplicate request" — thử tối đa 4 lần (5xx 2/5/8s; duplicate 5s).
  let err;
  for (let i = 0; i < 4; i++) {
    try { return await _goiApiMot(messages, kho, systemHint); }
    catch (e) {
      err = e;
      const m = String((e && e.message) || '');
      if (!/HTTP 5\d\d|duplicate/i.test(m)) break;
      const dl = /duplicate/i.test(m) ? 5000 : [2000, 5000, 8000][i] || 8000;
      await new Promise(r => setTimeout(r, dl));
    }
  }
  throw err;
}
async function _goiApiMot(messages, kho, systemHint = '') {
  const nc = _NHA_CC[String(kho.api_provider || '').trim().toLowerCase()];
  if (!nc) return null;
  const goc = String(kho.api_base_url || '').trim();
  if (nc.kieu !== 'an' && !nc.url && !goc) return null;
  const key = String(kho[nc.khoa] || kho.api_key || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';
  if (!key) return null;
  const model = String(kho.api_model || '').trim() || nc.mac;
  if (!model) return null;
  if (nc.kieu === 'an') {
    const sys = systemHint || (messages.find(m => m.role === 'system') || {}).content || '';
    const user = messages.filter(m => m.role !== 'system');
    const url = goc ? goc.replace(/\/+$/, '') + '/v1/messages' : nc.url;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8192, ...(sys ? { system: sys } : {}), messages: user }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error && d.error.message) || ('HTTP ' + r.status));
    return ((d && d.content) || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  const url = goc ? _oaUrl(goc) : nc.url;
  // stream:true — model reasoning nghĩ rất lâu trước token đầu; non-stream bị gateway cắt ~30s → 500,
  // retry lại bị chặn "duplicate request". Stream giữ connection sống.
  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 300000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, stream: true, messages }),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      let msg = 'HTTP ' + r.status;
      try { const j = JSON.parse(t); if (j && j.error) msg = typeof j.error === 'string' ? j.error : (j.error.message || msg); } catch (_) {}
      throw new Error(msg);
    }
    let acc = '', buf = '';
    const dec = new TextDecoder();
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const d = s.slice(5).trim();
        if (d === '[DONE]') continue;
        try { const j = JSON.parse(d); const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (c) acc += c; } catch (_) {}
      }
    }
    return acc;
  } finally { clearTimeout(killer); }
}

function registerEditorProAI(ipcMain, opts = {}) {
  const emptyFind = async () => ({ ok: true, results: [], items: [] });
  const emptyList = async () => [];

  // Điểm gọi AI TRUNG TÂM của "Tạo với AI" (script/cảnh) → route sang cli-bridge Nova (Claude/Codex CLI).
  // Bridge mới của app chạy ở 8795/8796 (cli-bridge-native.plain.js); giữ 8790/8791 làm fallback cho bản cũ.
  const CLI_BRIDGE = {
    claude: ['http://127.0.0.1:8795/chat/completions', 'http://127.0.0.1:8790/chat/completions'],
    codex: ['http://127.0.0.1:8796/chat/completions', 'http://127.0.0.1:8791/chat/completions'],
  };
  async function runPromptViaCliBridge({ system = '', user = '', model = '', json = false }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: String(user || '') + (json ? '\n\nCHỈ trả về JSON hợp lệ, KHÔNG giải thích, KHÔNG ```.' : '') });
    // 1) API đã cấu hình trong Cài đặt → gọi thẳng (không phụ thuộc CLI bridge / Codex CLI).
    try {
      const r = await _goiApi(messages, _KHO(), system);
      if (r != null && String(r).trim()) return r;
    } catch (e) {
      console.warn('[ipc-ai] API cấu hình lỗi, lùi về CLI bridge:', (e && e.message) || e);
    }
    // 2) Chỗ lùi: cli-bridge nội bộ (Claude/Codex CLI).
    const engine = String(model || '').toLowerCase().includes('codex') || String(model || '').toLowerCase().includes('gpt') ? 'codex' : 'claude';
    const urls = CLI_BRIDGE[engine] || CLI_BRIDGE.claude;
    const m = (model === 'opus' || model === 'sonnet') ? model : 'sonnet';
    let lastErr;
    for (const url of urls) {
      let resp;
      try {
        resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, model: m }) });
      } catch (e) { lastErr = lastErr || new Error('cli-bridge không phản hồi (8795/8790).'); continue; }
      // Bridge đã trả lời → báo đúng lỗi thật, không lùi sang cổng khác (tránh nuốt lỗi thật dưới "fetch failed").
      if (!resp.ok) { let d = ''; try { d = (await resp.text()).slice(0, 300); } catch {} throw new Error('cli-bridge HTTP ' + resp.status + (d ? (': ' + d) : '')); }
      const data = await resp.json();
      const content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (!content) throw new Error((data && data.error && data.error.message) || 'cli-bridge không trả nội dung (Claude CLI đã đăng nhập chưa?)');
      return content;
    }
    throw lastErr || new Error('cli-bridge không phản hồi (8795/8790).');
  }

  const H = {
    // AI text trung tâm (script, chia cảnh, gợi ý...) → Claude/Codex CLI
    'mcp:videoCreator:runPrompt': async (_e, payload = {}) => {
      try { return { ok: true, content: await runPromptViaCliBridge(payload) }; }
      catch (e) { return { ok: false, error: 'AI (cli-bridge Nova): ' + String(e && e.message || e) }; }
    },
    // TTS / voiceover — dùng macOS say (offline, giọng Việt "Linh", không cần key)
    'ai:ttsGenerate': async (_e, payload = {}) => {
      try {
        const text = String(payload.text || payload.script || payload.content || '').trim();
        if (!text) return { ok: false, error: 'Thiếu văn bản' };
        const voice = payload.voiceId || payload.voice || 'Linh';
        const mp3 = await sayToMp3(text, voice);
        return { ok: true, path: mp3, file: mp3 };
      } catch (e) { return { ok: false, error: 'TTS (macOS say): ' + String(e.message || e) }; }
    },
    'ai:listVoices': async () => ([
      { id: 'Linh', name: 'Linh (Tiếng Việt)', language: 'vi' },
      { id: 'Samantha', name: 'Samantha (English)', language: 'en' },
      { id: 'Alex', name: 'Alex (English)', language: 'en' },
      { id: 'Daniel', name: 'Daniel (English UK)', language: 'en' },
    ]),
    'ai:cleanupVoiceover': async () => ({ ok: true }),
    // Transcribe — Phase 3 đấu Whisper local của Nova. Tạm rỗng.
    'ai:transcribe': async () => ({ ok: true, text: '', segments: [], language: '' }),
    // Tìm media — Phase 3 đấu yt-dlp/pexels. Tạm rỗng để UI không lỗi.
    'ai:findVideos': emptyFind, 'ai:findImages': emptyFind, 'ai:findYoutubeVideos': emptyFind,
    'ai:findPexelsImages': emptyFind, 'ai:findPexelsVideos': emptyFind, 'ai:findFacebookVideos': emptyFind,
    'ai:findDailymotionVideos': emptyFind, 'ai:findYarnClips': emptyFind, 'ai:downloadImages': emptyFind,
    'ai:downloadVideos': emptyFind, 'ai:suggestYoutubeLinks': emptyFind,
    // Gợi ý text — Phase 3 đấu cli-bridge. Tạm rỗng.
    'ai:suggestTitle': async () => ({ ok: true, title: '' }),
    'ai:suggestTitles': async () => ({ ok: true, titles: [] }),
    'ai:suggestAngle': async () => ({ ok: true, angle: '' }),
    'ai:randomTopic': async () => ({ ok: true, topic: '' }),
    'ai:research': async () => ({ ok: true, text: '', sources: [] }),
    'ai:granularBreakdown': async () => ({ ok: true, sections: [] }),
    'ai:generateMusic': async () => ({ ok: false, error: 'Nhạc AI: Phase 3' }),
    'ai:generateThumbnailFromScript': async () => ({ ok: false, error: 'Thumbnail AI: Phase 3' }),
    'ai:motionGraphicsFromImage': async () => ({ ok: false, error: 'Phase 3' }),
    'ai:promptFromImage': async () => ({ ok: true, prompt: '' }),
    'ai:ideaPlannerExploreTopic': async () => ({ ok: true, ideas: [] }),
    'ai:ideaPlannerSuggestIdeas': async () => ({ ok: true, ideas: [] }),
    'ai:ensureHandlers': async () => ({ ok: true }),
    // Render Remotion — Phase 3 (cần @remotion/renderer + bundle). Báo rõ.
    'renderRemotionVideo': async () => ({ ok: false, error: 'Render Remotion: Phase 3 (chưa nối @remotion/renderer)' }),
    'aiVideoGenerate': async () => ({ ok: false, error: 'Gen video AI: Phase 3' }),
  };
  for (const [ch, fn] of Object.entries(H)) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, fn);
  }
  return Object.keys(H);
}

module.exports = { registerEditorProAI };
