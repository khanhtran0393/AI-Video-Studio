/* ── cli-bridge-native/bridge — createBridge(engine, port): semaphore + runCLI (spawn claude/codex)
     + login qua URL/code + HTTP handler kiểu OpenAI + nghe IPv4/IPv6. Tách từ cli-bridge-native.plain.js (verbatim). ── */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { MAX_CONCURRENT, TIMEOUT_MS, goodEnv } = require('./env');
const { buildPrompt } = require('./prompt');
const { createDebugLog } = require('./debug-log');

// Một "bridge" cho 1 engine (claude/codex) trên 1 cổng.
function createBridge(engine, port) {
  let active = 0;
  const queue = [];
  const acquire = () => new Promise((res) => { const t = () => { if (active < MAX_CONCURRENT) { active++; res(); } else queue.push(t); }; t(); });
  const release = () => { active--; const n = queue.shift(); if (n) n(); };

  function runCLI(promptData, model) {
    const images = (promptData && promptData.images) || [];
    let prompt = (promptData && promptData.text) || String(promptData || '');
    const cleanup = () => { for (const f of images) { try { fs.unlinkSync(f); } catch {} } };
    return acquire().then(() => new Promise((resolve, reject) => {
      let cmd, args, useStdin = true;
      if (engine === 'codex') {
        cmd = 'codex'; args = ['exec', '--skip-git-repo-check'];
        images.forEach((f) => args.push('-i', f));   // Codex: đính ảnh qua -i (nếu bản codex hỗ trợ)
        args.push(prompt); useStdin = false;
      } else {
        cmd = 'claude'; args = ['-p', '--output-format', 'text'];
        // Forward model sang CLI: alias opus/sonnet NHƯNG cả tên model đầy đủ (glm-5.3, deepseek-v4-flash…)
        // — gateway (agentrouter/HHTECH…) chỉ có kênh cho đúng id, alias sẽ 503 "no channel".
        if (model && model !== 'default' && model !== 'chatgpt') args.push('--model', model);
        if (images.length) {
          args.push('--allowedTools', 'Read');   // chỉ cho phép Read (xem ảnh), không tool khác
          prompt += '\n\nẢNH ĐÍNH KÈM: ' + images.join(' , ')
            + '\nHãy dùng công cụ Read để MỞ XEM từng ảnh trên (Read hiển thị ảnh trực tiếp cho bạn). '
            + 'TUYỆT ĐỐI không chạy lệnh shell (sips/bash/identify…), không hỏi quyền — chỉ Read rồi trả lời yêu cầu.';
        }
      }
      const cp = spawn(cmd, args, { env: goodEnv(), cwd: os.homedir(), shell: process.platform === 'win32' });
      let out = '', err = '', done = false;
      const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); release(); cleanup(); fn(v); };
      const timer = setTimeout(() => { try { cp.kill('SIGKILL'); } catch {} finish(reject, new Error('CLI timeout')); }, TIMEOUT_MS);
      cp.stdout.on('data', (d) => (out += d));
      cp.stderr.on('data', (d) => (err += d));
      cp.on('error', (e) => finish(reject, new Error(e.code === 'ENOENT' ? ('Chưa cài ' + cmd + ' CLI trên máy.') : e.message)));
      // CLI in "API Error: ..." ra STDOUT khi lỗi (exit != 0) → phải đưa stdout vào error để chẩn đoán.
      cp.on('close', (code) => code === 0 ? finish(resolve, out.trim()) : finish(reject, new Error((err.trim() || out.trim() || ('exit ' + code)).slice(0, 600))));
      if (useStdin) { try { cp.stdin.write(prompt); } catch {} }
      try { cp.stdin.end(); } catch {}
    }));
  }

  // Gateway (agentrouter…) route request qua NHIỀU kênh upstream, một số kênh lọc content
  // (400 content-blocked) hoặc hết kênh (503 无可用渠道) — CÙNG prompt chạy lại thường PASS.
  // Retry ngay tại bridge (không tốn vòng HTTP của app) cho đúng nhóm lỗi tạm thời này.
  const TRANSIENT_RE = /content-blocked|无可用渠道|no available channel|overloaded|rate.?limit|API (429|5\d\d)\b/i;
  function runCLIWithRetry(promptData, model, attempts = 3) {
    let lastErr = null;
    const attempt = (i) => runCLI(promptData, model).catch((e) => {
      lastErr = e;
      if (i >= attempts || !TRANSIENT_RE.test(String(e.message || e))) throw e;
      return new Promise((r) => setTimeout(r, 3000)).then(() => attempt(i + 1));
    });
    return attempt(1).catch(() => { throw lastErr; });
  }

  // ── Đăng nhập (không cần terminal): bắt URL CLI in ra → web → nhận code → stdin ──
  const loginArgs = engine === 'codex' ? ['login'] : ['setup-token'];
  let login = null;
  function cliExists() {
    try {
      const { spawnSync } = require('child_process');
      const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [engine], { env: goodEnv(), shell: process.platform === 'win32' });
      return r.status === 0;
    } catch { return false; }
  }
  function startLoginProc() {
    if (login && login.proc) { try { login.proc.kill('SIGKILL'); } catch {} }
    login = { proc: null, url: null, done: false, error: null, buf: '' };
    // Kiểm CLI có cài chưa (mọi OS) — tránh treo/báo nhầm trên Windows khi thiếu CLI
    if (!cliExists()) {
      login.error = 'Chưa cài ' + (engine === 'codex' ? 'Codex' : 'Claude Code') + ' CLI trên máy này. Xem hướng dẫn cài (nút bên dưới).';
      return;
    }
    const cp = spawn(engine, loginArgs, { env: goodEnv(), shell: process.platform === 'win32' });
    login.proc = cp;
    const onData = (d) => { login.buf += d.toString(); if (!login.url) { const m = login.buf.match(/https?:\/\/[^\s'"]+/); if (m) login.url = m[0]; } };
    cp.stdout.on('data', onData);
    cp.stderr.on('data', onData);
    cp.on('error', (e) => { login.error = e.code === 'ENOENT' ? ('Chưa cài ' + engine + ' CLI trên máy. Cài Claude Code / Codex trước.') : e.message; });
    cp.on('close', (code) => {
      login.done = code === 0;
      if (code !== 0 && !login.error) {
        // Lệnh đăng nhập cần terminal (TTY) → chạy trong app hay lỗi. Đa số máy đã đăng nhập sẵn.
        login.error = 'Đăng nhập trong app không chạy được (lệnh này cần Terminal). '
          + 'NẾU máy bạn ĐÃ đăng nhập ' + (engine === 'codex' ? 'Codex' : 'Claude Code') + ' rồi → bỏ qua, bấm Test là dùng được. '
          + 'CHƯA thì mở Terminal gõ: ' + (engine === 'codex' ? 'codex login' : 'claude') + ' (đăng nhập 1 lần).';
      }
    });
  }

  const cors = (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); };
  const sendJSON = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });

  // Log debug RAM-first (buffer trong RAM, flush theo lô 30s, file cap 512KB) —
  // trước đây appendFileSync mỗi request xuống đĩa không giới hạn. Xem ./debug-log.
  const dlog = createDebugLog(engine);
  const handler = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const p = (req.url || '').split('?')[0];
    dlog('>> ' + req.method + ' ' + p);
    if (req.method === 'POST' && p === '/login/start') { startLoginProc(); return sendJSON(res, { ok: true }); }
    if (req.method === 'GET' && p === '/login/status') { return sendJSON(res, login ? { url: login.url, done: login.done, error: login.error } : { error: 'chưa bắt đầu' }); }
    if (req.method === 'POST' && p === '/login/code') {
      const b = await readBody(req); let code = ''; try { code = JSON.parse(b || '{}').code || ''; } catch {}
      if (!login || !login.proc) return sendJSON(res, { error: 'Chưa bắt đầu đăng nhập.' }, 400);
      try { login.proc.stdin.write(String(code).trim() + '\n'); } catch (e) { return sendJSON(res, { error: e.message }, 500); }
      return sendJSON(res, { ok: true });
    }
    if (req.method === 'POST' && p.includes('/chat/completions')) {
      const body = await readBody(req);
      try {
        const { messages, model } = JSON.parse(body || '{}');
        const pd = buildPrompt(messages);
        dlog('CHAT: ' + pd.images.length + ' ảnh · prompt ' + pd.text.length + ' ký tự');
        const text = await runCLIWithRetry(pd, model);
        dlog('CLAUDE TRẢ (' + text.length + ' ký tự): ' + text.slice(0, 400).replace(/\n/g, ' '));
        return sendJSON(res, { choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });
      } catch (e) {
        dlog('LỖI: ' + String(e.message || e));
        return sendJSON(res, { error: { message: String(e.message || e) } }, 500);
      }
    }
    if (req.method === 'GET' && (p === '/health' || p === '/')) return sendJSON(res, { ok: true, engine, port });
    res.writeHead(404); res.end('not found');
  };

  // Nghe cả IPv4 (127.0.0.1) lẫn IPv6 (::1) → "localhost" luôn trúng bridge này, dù OS phân giải kiểu nào.
  const servers = [];
  for (const host of ['127.0.0.1', '::1']) {
    const s = http.createServer(handler);
    s.on('error', (e) => console.warn(`[cli-bridge ${engine}] ${host}:${port}:`, e.message));
    s.listen(port, host, () => console.log(`[cli-bridge] ${engine} → ${host}:${port}`));
    servers.push(s);
  }
  return servers;
}
module.exports = { createBridge };
