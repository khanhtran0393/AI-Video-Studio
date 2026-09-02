'use strict';
// LIVE WORKFLOW TEST — chạy pipeline Video Agent với AI provider THẬT lấy từ cấu hình app
// (%APPDATA%\AI Video Studio Independent\nova-settings.json — đúng file mà GUI đang lưu).
//   [0] đọc settings → [1] ping API (chat/completions) → [2] chạy FULL workflow qua đúng
//       đường production (options.ai → createDefaultGateway → planners) với fixture chuẩn,
//       render dùng mock (test cô lập tầng AI + orchestrator, không cần Remotion).
//   Đếm request API thật bằng cách bọc global.fetch (fetchJson mặc định dùng global.fetch).
// Chạy: node nova/video-agent/test-ai-live.js
// Bỏ qua an toàn (exit 0) nếu chưa cấu hình API key/baseUrl.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { createVideoJob } = require('./orchestrator');
const { makeFixture, mockRenderer, assert, counters } = require('./test-fixture');

const OVERALL_TIMEOUT_MS = 8 * 60 * 1000; // 8 phút cho toàn workflow

// ── [0] Đọc cấu hình API từ settings thật của app ──
function loadApiConfig() {
  const fromEnv = { apiKey: process.env.NOVA_API_KEY, baseUrl: process.env.NOVA_API_BASE_URL, model: process.env.NOVA_API_MODEL, provider: process.env.NOVA_API_PROVIDER };
  if (fromEnv.apiKey && fromEnv.baseUrl) return { ...fromEnv, source: 'env' };
  try {
    const settingsPath = path.join(process.env.APPDATA || os.homedir(), 'AI Video Studio Independent', 'nova-settings.json');
    const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return {
      apiKey: s.api_key || s['api_key_' + (s.api_provider || 'openai-compatible')],
      baseUrl: s.api_base_url, model: s.api_model, provider: s.api_provider || 'openai-compatible',
      source: settingsPath,
    };
  } catch (_) { return { source: null }; }
}

function chatUrl(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

// ── [1] Ping API thật: 1 request chat/completions tối thiểu ──
async function pingApi(cfg) {
  const t0 = Date.now();
  const res = await fetch(chatUrl(cfg.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, max_tokens: 32, messages: [{ role: 'user', content: 'Trả lời đúng một từ: OK' }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return { latencyMs: Date.now() - t0, model: data.model || cfg.model, usage: data.usage || null, content: String(content || '').slice(0, 60) };
}

(async () => {
  const cfg = loadApiConfig();
  if (!cfg.apiKey || !cfg.baseUrl) {
    console.log('ai live workflow: skipped (chưa cấu hình api_key/api_base_url — mở Settings trong app hoặc đặt NOVA_API_KEY/NOVA_API_BASE_URL)');
    process.exit(0);
  }
  console.log('[0] API config:', JSON.stringify({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, source: cfg.source, key: cfg.apiKey.slice(0, 8) + '…' }));

  // [1] Ping
  try {
    const p = await pingApi(cfg);
    console.log('[1] PING OK —', JSON.stringify(p));
    assert('L: ping API thật thành công (chat/completions 200 + có choices)', !!p.content || !!p.usage);
  } catch (e) {
    console.log('[1] PING FAIL —', e.message);
    console.log('ai live workflow: FAILED (API không trả lời — kiểm tra key/baseUrl/model)');
    process.exit(1);
  }

  // Bọc global.fetch để đếm request thật tới API (không đổi hành vi production)
  const realFetch = global.fetch.bind(global);
  const apiCalls = [];
  global.fetch = (url, init) => {
    if (String(url).startsWith(String(cfg.baseUrl).replace(/\/+$/, ''))) {
      const body = init && init.body ? JSON.parse(init.body) : {};
      apiCalls.push({ model: body.model, jsonMode: !!(body.response_format), messages: (body.messages || []).length });
    }
    return realFetch(url, init);
  };

  // [2] Full workflow: fixture chuẩn + render mock + options.ai (đúng đường IPC payload)
  let fixtureRoot = null;
  try {
    fixtureRoot = makeFixture();
    console.log('[2] fixture project:', fixtureRoot);

    const stageTimes = [];
    let lastStage = null;
    const job = createVideoJob({
      projectDir: fixtureRoot,
      adapters: { render: mockRenderer() },
      options: { ai: { provider: cfg.provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model } },
    });
    job.on((ev) => {
      if (ev.stage && ev.stage !== lastStage) { lastStage = ev.stage; stageTimes.push({ stage: ev.stage, t: Date.now() }); console.log('  →', ev.stage, (ev.progress != null ? ev.progress + '%' : '')); }
    });

    const runPromise = job.run();
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout toàn workflow ' + OVERALL_TIMEOUT_MS + 'ms')), OVERALL_TIMEOUT_MS));
    const res = await Promise.race([runPromise, timeout]);

    console.log('[3] job result:', JSON.stringify({ status: res.status, url: res.url, output: res.output }));
    assert('L: workflow hoàn tất (COMPLETED)', res.status === 'COMPLETED', res.status);
    assert('L: AI thật được gọi ≥ 3 planner (script/scene/behavior)', apiCalls.length >= 3, { apiCalls: apiCalls.length });
    assert('L: mọi request đều dùng đúng model đã cấu hình', apiCalls.length > 0 && apiCalls.every(c => c.model === cfg.model), apiCalls.map(c => c.model));
    assert('L: request AI dùng JSON mode (response_format)', apiCalls.some(c => c.jsonMode), apiCalls);
    assert('L: có file video output', !!res.output && fs.existsSync(res.output), res.output);
    assert('L: có timeline + spec + qa trong kết quả', !!(res.timeline && res.spec && res.qa), Object.keys(res));
    if (res.error) console.log('[!] job error:', JSON.stringify(res.error).slice(0, 300));

    console.log('[4] số request API thật:', apiCalls.length, '—', JSON.stringify(apiCalls));
    const durations = [];
    for (let i = 1; i < stageTimes.length; i++) durations.push(stageTimes[i].stage + ' +' + ((stageTimes[i].t - stageTimes[i - 1].t) / 1000).toFixed(1) + 's');
    console.log('[5] stages:', durations.join(' | '));
  } catch (e) {
    assert('L: workflow không văng lỗi ngoài', false, e.message);
    console.log('[2] WORKFLOW FAIL —', e.message);
  } finally {
    global.fetch = realFetch;
    if (fixtureRoot) { try { fs.rmSync(fixtureRoot, { recursive: true, force: true }); } catch (_) {} }
  }

  const { pass, fail } = counters();
  console.log(`\nai live workflow: ${fail === 0 ? 'PASSED' : 'FAILED'} — pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
