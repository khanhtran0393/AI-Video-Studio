/* LLM — cài đặt API, callLLM + các provider (Anthropic/OpenAI/Compat/Claude), parse JSON, usage
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function loadApiSettings(){
  // Mở lại form từ cấu hình đã lưu — hết trạng thái reset của "API đã thêm" (nhả guard
  // để key của provider được nạp lại bình thường vào các ô).
  if (typeof _addedApiGuard !== 'undefined') _addedApiGuard = null;
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const model = localStorage.getItem('api_model') || '';
  // Migrate key cũ (lưu chung ở 'api_key') → kho riêng của provider hiện tại (1 lần)
  const legacy = localStorage.getItem('api_key');
  if (legacy && localStorage.getItem(_provKeyName(provider)) == null) localStorage.setItem(_provKeyName(provider), legacy);
  _keyFieldsProvider = null;                       // để onProviderChange nạp đúng key provider này
  document.getElementById('apiProvider').value = provider;
  onProviderChange();                              // tự nạp key của provider vào các ô
  // Sau khi onProviderChange đã thiết lập dropdown và custom input, cần đặt giá trị model
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  // Kiểm tra xem model có nằm trong danh sách của provider hiện tại không
  const modelList = MODELS[provider] || [];
  const isInList = modelList.some(m => m.id === model);
  if (model && !isInList) {
    // Model không có trong danh sách -> là custom
    sel.value = 'custom';
    if (customInput) {
      customInput.style.display = '';
      customInput.value = model;
    }
  } else if (model && isInList) {
    sel.value = model;
    if (customInput) customInput.style.display = 'none';
  } else {
    // Không có model -> chọn mặc định
    sel.value = modelList[0]?.id || '';
    if (customInput) customInput.style.display = 'none';
  }
  updateGetKeyLink();
  const thinkEl = document.getElementById('apiThinking');
  if (thinkEl) thinkEl.checked = localStorage.getItem('api_thinking') === '1';
  const concEl = document.getElementById('apiConcurrency');
  if (concEl) concEl.value = localStorage.getItem('api_concurrency') || '';
  const baseUrlEl = document.getElementById('apiBaseUrl');
  if (baseUrlEl) baseUrlEl.value = localStorage.getItem('api_base_url') || '';
  const cliEp = document.getElementById('cliEndpoint'); if (cliEp) cliEp.value = localStorage.getItem('api_cli_endpoint') || '';
  const cliK = document.getElementById('cliKey');       if (cliK) cliK.value = localStorage.getItem('api_cli_key') || '';
  const fbP = document.getElementById('jsonFbProvider'); if (fbP) fbP.value = localStorage.getItem('json_fb_provider') || '';
  const fbM = document.getElementById('jsonFbModel');    if (fbM) fbM.value = localStorage.getItem('json_fb_model') || '';
  const fbK = document.getElementById('jsonFbKey');      if (fbK) fbK.value = localStorage.getItem('json_fb_key') || '';
  // Key stock trước đây chỉ nạp MỘT LẦN ở DOMContentLoaded+200ms, không nằm trong
  // luồng này — lệch nhịp một cái là ô trống trơn dù localStorage vẫn còn key, nên
  // "lưu rồi mà vào lại mất". Nạp chung ở đây, chạy lại mỗi lần mở tab Cài đặt.
  try { loadPexelsKey(); loadPixabayKey(); loadUnsplashKey(); t2RenderStockRows(); } catch (e) {}
  const wk = document.getElementById('setWhisperKey');  if (wk) wk.value = localStorage.getItem('t8_key_groq') || '';
  const wko = document.getElementById('setWhisperKeyOpenai'); if (wko) wko.value = localStorage.getItem('t8_key_openai') || '';
  if (typeof _whisperKeyState === 'function') _whisperKeyState();
  updateApiStatus();
}

function saveApiSettings(){
  const provider = document.getElementById('apiProvider').value;
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  let model = sel.value;
  // Nếu chọn custom, lấy giá trị từ ô input
  if (model === 'custom') {
    model = customInput ? customInput.value.trim() : '';
    if (!model) {
      setApiStatus('Vui lòng nhập tên model tuỳ chỉnh.', 'err');
      customInput?.focus();
      return;
    }
  }
  const keys = collectKeys();
  // Guard "API đã thêm": form vừa bị reset (ô key trống) — bấm Lưu lúc này không được
  // ghi rỗng đè lên kho key đã lưu của provider, vẫn dùng lại key đang có trong kho.
  const storedRaw = localStorage.getItem(_provKeyName(provider)) || '';
  const effKeys = (!keys.length && storedRaw && typeof _addedApiGuard !== 'undefined' && _addedApiGuard === provider)
    ? storedRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    : keys;
  const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/+$/, '');
  localStorage.setItem('api_provider', provider);
  localStorage.setItem('api_model', model);
  localStorage.setItem(_provKeyName(provider), effKeys.join('\n'));   // lưu key RIÊNG theo provider
  localStorage.setItem('api_key', effKeys.join('\n'));               // mirror provider hiện tại (cho code cũ: _apiKeyPool, Tool10 mượn key)
  _keyFieldsProvider = provider;
  localStorage.setItem('api_thinking', document.getElementById('apiThinking')?.checked ? '1' : '');
  const conc = parseInt(document.getElementById('apiConcurrency')?.value);
  localStorage.setItem('api_concurrency', (conc >= 1) ? String(conc) : '');
  localStorage.setItem('api_base_url', baseUrl);
  localStorage.setItem('api_cli_endpoint', (document.getElementById('cliEndpoint')?.value || '').trim().replace(/\/+$/, ''));
  localStorage.setItem('api_cli_key', (document.getElementById('cliKey')?.value || '').trim());
  localStorage.setItem('json_fb_provider', document.getElementById('jsonFbProvider')?.value || '');
  localStorage.setItem('json_fb_model', (document.getElementById('jsonFbModel')?.value || '').trim());
  localStorage.setItem('json_fb_key', (document.getElementById('jsonFbKey')?.value || '').trim());
  updateApiStatus();
  setApiStatus(baseUrl ? `✓ Đã lưu. Dùng Base URL: ${baseUrl}` : '✓ Đã lưu cấu hình API.', 'ok');
  // Ghi nhận API vừa lưu vào khung "📋 API đã thêm" (cột phải tab Cài đặt) rồi reset
  // form 🤖 AI Provider về trạng thái trống để người dùng nhập API mới tiếp.
  // CLI (gói Claude/ChatGPT) không dùng API key → không ghi nhận, không reset.
  if (typeof addedApiOnSave === 'function' && provider !== 'cli' && effKeys.length) addedApiOnSave(provider, model, effKeys, baseUrl);
}

function updateApiStatus(){
  const localProv = localStorage.getItem('api_provider');
  // Nguồn AI thực tế (giống callLLM): "📋 API đã thêm" → "API Key Flow" → cấu hình lưu sẵn; CLI hiển thị riêng
  const src = (localProv !== 'cli' && typeof addedApiResolveAiSource === 'function') ? addedApiResolveAiSource() : null;
  const provider = src ? src.provider : localProv;
  const model = (src && src.model) ? src.model : localStorage.getItem('api_model');
  const tag = src ? (src.source === 'added' ? ' · 📋 API đã thêm' : ' · 🔑 API Key Flow') : '';
  const el = document.getElementById('apiStatus');
  // CLI tự host: không cần key — báo theo endpoint.
  if (provider === 'cli') {
    const ep = localStorage.getItem('api_cli_endpoint') || '';
    const _mn = { default: 'Claude', sonnet: 'Claude Sonnet', opus: 'Claude Opus', chatgpt: 'ChatGPT' }[model] || 'Claude';
    el.innerHTML = ep
      ? `<span class="api-status ok"></span> Đang dùng gói của bạn · ${_mn}`
      : `<span class="api-status"></span> Chưa kết nối`;
    return;
  }
  const keys = _apiKeyPool();
  if (keys.length && provider && model) {
    const lanes = _concurrency();
    const multi = lanes > 1 ? ` · ⚡ ${lanes} luồng (${keys.length} key)` : '';
    el.innerHTML = `<span class="api-status ok"></span> ${PROVIDER_LABEL[provider] || provider} · ${model}${multi}${tag}`;
  } else {
    el.innerHTML = `<span class="api-status"></span> Chưa cấu hình`;
  }
}

function setApiStatus(msg, type){
  const el = document.getElementById('apiStatus');
  const colors = { ok: 'var(--green)', err: 'var(--red)', info: 'var(--text-dim)' };
  const cls = type === 'ok' ? 'ok' : (type === 'err' ? 'err' : '');
  el.innerHTML = `<span class="api-status ${cls}"></span> ${msg}`;
  el.style.color = colors[type] || colors.info;
  el.style.whiteSpace = 'normal';
  el.style.wordBreak = 'break-word';
  if (type !== 'err') setTimeout(updateApiStatus, 3000);   // lỗi GIỮ LẠI để đọc, không tự xoá sau 3s
}

async function testApi(){
  const provider = document.getElementById('apiProvider').value;
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  let model = sel.value;
  // Nếu chọn custom, lấy model thật từ ô tuỳ chỉnh (tránh gửi nhầm "custom")
  if (model === 'custom') model = customInput ? customInput.value.trim() : '';
  // CLI tự host: không cần API key, test qua endpoint bridge.
  if (provider === 'cli') {
    const ep = _cliEp();
    if (!ep) return setApiStatus('Chưa nhập Endpoint CLI.', 'err');
    setApiStatus('Đang test CLI...', 'info');
    try {
      const reply = await callLLM('Reply with exactly: "ok"', { maxTokens: 30, _override: { provider, model, cliEndpoint: ep } });
      if (reply && reply.toLowerCase().includes('ok')) setApiStatus('✓ CLI hoạt động: ' + reply.trim().slice(0, 30), 'ok');
      else setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    } catch (e) { setApiStatus('✗ Lỗi: ' + (e.message || '').slice(0, 90), 'err'); }
    return;
  }
  const key = collectKeys()[0];
  if (!key) return setApiStatus('Thiếu API key', 'err');

  setApiStatus('Đang test...', 'info');
  try {
    const reply = await callLLM('Reply with exactly: "ok"', { maxTokens: 30, _override: { provider, model, key } });
    if (reply && reply.toLowerCase().includes('ok')) {
      setApiStatus('✓ API hoạt động: ' + reply.trim().slice(0, 30), 'ok');
    } else {
      setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    }
  } catch (e) {
    console.error('[AI Test] lỗi ĐẦY ĐỦ:', e.message);   // xem nguyên văn ở DevTools Console
    setApiStatus('✗ Lỗi: ' + e.message.slice(0, 400), 'err');
  }
}

function _apiKeyPool(){
  // NGUỒN AI — ưu tiên: "📋 API đã thêm" → "API Key Flow" (key Gemini) → kho key provider hiện tại.
  // CLI (gói subscription, không cần API key) không bị kênh ưu tiên này chi phối.
  const localProv = localStorage.getItem('api_provider') || 'anthropic';
  if (localProv !== 'cli' && typeof addedApiResolveAiSource === 'function'){
    const src = addedApiResolveAiSource();
    if (src) return src.keys;
  }
  // Key của ĐÚNG provider đang dùng (api_key_<provider>); fallback kho cũ 'api_key' nếu chưa migrate
  const raw = localStorage.getItem(_provKeyName(localProv)) || localStorage.getItem('api_key') || '';
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

// Thời gian tạm nghỉ key theo loại lỗi: 401/403 (key sai/hết hiệu lực) 15 phút; 429/quota/rate-limit 3 phút
function _keyCooldownMs(msg){
  if (/\b(401|403)\b|unauthor|forbidden|invalid[ _-]?(api[ _-]?)?key|incorrect api key|api key not valid/i.test(msg)) return 15 * 60 * 1000;
  if (/\b429\b|quota|rate.?limit|insufficient|resource[ _-]?exhausted/i.test(msg)) return 3 * 60 * 1000;
  return 0;
}

function _nextApiKey(){
  const pool = _apiKeyPool();
  if (!pool.length) return '';
  const now = Date.now();
  // XOAY KEY: bỏ qua key đang tạm nghỉ (dính lỗi 401/403/429/quota); nếu TẤT CẢ đều đang
  // nghỉ → lấy key sớm hết cooldown nhất để lỗi lộ thẳng ra UI (không treo — Luật 10)
  let pick = '';
  for (let i = 0; i < pool.length; i++){
    const k = pool[(_apiKeyIdx + i) % pool.length];
    if (!(_apiKeyCooldown[k] > now)){ pick = k; _apiKeyIdx += i + 1; break; }
  }
  if (!pick){
    pick = pool.slice().sort((a, b) => (_apiKeyCooldown[a] || 0) - (_apiKeyCooldown[b] || 0))[0];
    _apiKeyIdx++;
  }
  return pick;
}

function _usingCli(){
  const prov = localStorage.getItem('api_provider') || 'anthropic';
  if (prov === 'cli') return true;
  return _apiKeyPool().length === 0;
}

function _concurrency(){
  const set = parseInt(localStorage.getItem('api_concurrency') || '');
  if (set >= 1) return Math.min(set, 30);
  return Math.max(1, _apiKeyPool().length);
}

async function _withRetry(fn){
  const MAX = LLM_MAX_RETRY;   // tổng số lần thử
  let delay = 800;            // ms, nhân dần (có trần)
  for (let attempt = 1; ; attempt++){
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e);
      const retryable = /failed to fetch|load failed|networkerror|network error|không kết nối được|quá thời gian/i.test(msg)
        || /\bAPI (409|429|5\d\d)\b/.test(msg);   // 409 trùng request (gateway dedupe), 429 quá tải + 5xx (502/503/504) đều thử lại
      if (!retryable || attempt >= MAX) throw e;
      try { if (typeof novaLog === 'function') novaLog(`  ↻ AI lỗi tạm (${msg.slice(0, 40)}) — thử lại lần ${attempt + 1}/${MAX}…`, 'warn'); } catch(_){}
      const isDup = /\bAPI 409\b/.test(msg);   // request trùng đang được server xử lý → đợi LÂU hơn cho request gốc xong
      // 409 duplicate: request gốc (model reasoning) có thể còn xử lý 2-3 phút → chờ tăng dần 15/30/60s.
      // Trước đây chỉ chờ ~12s mỗi lần → cả 4 lần thử đều dính 409 và lỗi lộ thẳng ra UI.
      // D8: full jitter exponential backoff (AWS pattern) - random(0, min(cap, base*2^attempt))
      // Truoc day: delay + random(0, 400ms) -> client fail cung nhip dong bo -> don tai.
      const _baseBackoff = isDup ? 15000 * Math.pow(2, attempt - 1) : 800 * Math.pow(2, attempt - 1);
      const _capBackoff = isDup ? 60000 : 10000;
      const wait = Math.min(_capBackoff, _baseBackoff) * (0.5 + Math.random() * 0.5);
      // jitter 50-100% pha dong bo retry
      await new Promise(r => setTimeout(r, wait));   // 409: cho cua so dedup khep; khac: exp + full jitter
      await new Promise(r => setTimeout(r, wait));   // 409: chờ cửa sổ dedup của server khép; còn lại trần 10s giữa các lần
      delay *= 2;
    }
  }
}

function _chatEndpoint(base){
  let b = String(base || '').trim().replace(/\/+$/, '');
  if (!b) return '';
  // Thêm giao thức nếu thiếu (hỗ trợ nhập "xkiro.com" thay vì "https://xkiro.com")
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
  b = b.replace(/([^:])\/{2,}/g, '$1/');                     // gộp slash kép (https://xkiro.com//v1 → .../v1)
  if (/\/chat\/completions$/i.test(b)) return b;            // đã đủ path
  if (/\/v1$/i.test(b)) return b + '/chat/completions';      // base kết thúc /v1 (vd https://xkiro.com/v1)
  return b + '/v1/chat/completions';                         // base dạng https://host hoặc https://host/api
}

async function callLLM(prompt, opts = {}){
  // Nguồn AI (theo khung "📋 API đã thêm"): ưu tiên API đã thêm → API Key Flow (key Gemini)
  // → cấu hình đang lưu. _override (nút Test API / gọi thủ công) luôn thắng mọi nguồn;
  // người dùng đang chọn CLI (gói subscription, không cần key) → giữ nguyên kênh CLI.
  const localProv = localStorage.getItem('api_provider') || 'anthropic';
  const aiSrc = (localProv === 'cli' || opts._override?.provider || opts._override?.key)
    ? null : ((typeof addedApiResolveAiSource === 'function') ? addedApiResolveAiSource() : null);
  const provider = opts._override?.provider || aiSrc?.provider || localProv;
  const model = opts._override?.model || aiSrc?.model || localStorage.getItem('api_model') || MODELS[provider][0].id;
  // Mỗi lần gọi lấy 1 key kế tiếp trong pool → nhiều key sẽ tự chia tải khi chạy song song.
  // XOAY KEY KHI LỖI/HẾT QUOTA: lượt thử lại (_withRetry) tự lấy key KẾ TIẾP; key dính
  // 401/403/429/quota bị đưa vào cooldown (_keyCooldownMs) → các lượt gọi sau tự nhảy qua nó.
  let key = opts._override?.key || _nextApiKey();
  let _llmAttempt = 0;
  const maxTokens = opts.maxTokens || 1500;
  const messages = opts.messages || [{ role: 'user', content: prompt }];

  // CLI tự host: dùng endpoint bridge của user (gói Claude/ChatGPT của họ), KHÔNG cần API key.
  if (provider === 'cli') {
    // App tự chạy bridge ở localhost:8795 → mặc định endpoint đó nếu chưa lưu (đọc cả ô input).
    const ep = (opts._override?.cliEndpoint
      || localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const cliKey = localStorage.getItem('api_cli_key') || '';
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    return _withRetry(() => callOpenAICompat(messages, model || 'default', cliKey, maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Không có API key → tự dùng gói Claude/ChatGPT qua bridge nội bộ app luôn chạy (localhost:8795/8796),
  // đúng tinh thần "không cần API key". Nhờ vậy các tính năng (phân tích kịch bản…) chạy ngay.
  if (!key) {
    const ep = (localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    // Model Claude-* → alias opus/sonnet như cũ (subscription CLI); model KHÁC (glm-5.3, deepseek…)
    // → truyền NGUYÊN id để gateway (agentrouter/HHTECH) chọn đúng kênh còn sống — bridge đưa thẳng vào --model.
    const cliModel = /opus/i.test(model) ? 'opus' : /sonnet/i.test(model) ? 'sonnet'
      : (/^(claude-|custom-model)/i.test(model) ? 'default' : (model || 'default'));
    return _withRetry(() => callOpenAICompat(messages, cliModel, '', maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Tác vụ có ảnh nhưng provider không hỗ trợ vision (DeepSeek) → báo lỗi rõ ràng
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
  if (hasImage && !VISION_PROVIDERS.includes(provider)) {
    throw new Error(`${provider} không đọc được ảnh. Đổi sang Anthropic/OpenAI cho tác vụ phân tích ảnh.`);
  }

  const thinking = opts._override?.thinking ?? (localStorage.getItem('api_thinking') === '1');
  const json = !!opts.json;   // ép JSON mode (OpenAI/DeepSeek)
  const _baseUrl = aiSrc
    ? (aiSrc.baseUrl || '')                                   // base URL theo API đã thêm / Flow (rỗng = gọi thẳng nhà cung cấp)
    : (localStorage.getItem('api_base_url') || '').trim().replace(/\/+$/, '');   // gateway ngoài (hhtech/gwai…)
  const doCall = () => {
    _llmAttempt++;
    if (_llmAttempt > 1 && !opts._override?.key) key = _nextApiKey();   // lượt thử lại → XOAY sang key kế tiếp
    if (provider === 'anthropic') return callAnthropic(messages, model, key, maxTokens, aiSrc ? aiSrc.baseUrl : undefined);   // callAnthropic tự đọc Base URL bên trong nếu không override
    // Có Base URL → OpenAI/DeepSeek đi QUA gateway (/v1/chat/completions), KHÔNG gọi thẳng api.openai.com/deepseek.
    // stream:true giữ connection qua giai đoạn model reasoning nghĩ (né 500 → retry → 409 duplicate của gateway).
    if (_baseUrl && (provider === 'openai' || provider === 'deepseek'))
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    if (provider === 'openai')    return callOpenAI(messages, model, key, maxTokens, { json });
    if (provider === 'gemini')    return callOpenAICompat(messages, model, key, maxTokens, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { json, stream: true });
    if (provider === 'deepseek')  return callOpenAICompat(messages, model, key, maxTokens, 'https://api.deepseek.com/v1/chat/completions', { thinking, json, stream: true });
    // Các provider OpenAI-compatible
    const BASE_URLS = {
      openrouter:  'https://openrouter.ai/api/v1',
      groq:        'https://api.groq.com/openai/v1',
      mistral:     'https://api.mistral.ai/v1',
      cohere:      'https://api.cohere.ai/v1',
      perplexity:  'https://api.perplexity.ai',
      together:    'https://api.together.xyz/v1',
      fireworks:   'https://api.fireworks.ai/inference/v1'
    };
    if (provider in BASE_URLS) {
      const base = _baseUrl || BASE_URLS[provider];
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(base), { thinking, json, stream: true });
    }
    // OpenAI Compatible Custom: bắt buộc phải có Base URL
    if (provider === 'openai-compatible') {
      if (!_baseUrl) throw new Error('Vui lòng nhập Base URL cho OpenAI Compatible.');
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    }
    throw new Error('Provider không hỗ trợ: ' + provider);
  };
  return _withRetry(async () => {
    try {
      const r = await doCall();
      if (key) delete _apiKeyCooldown[key];   // key hoạt động trở lại → gỡ cooldown
      return r;
    } catch (e) {
      const cd = _keyCooldownMs(String(e?.message || e));
      if (cd && key && !opts._override?.key){
        _apiKeyCooldown[key] = Date.now() + cd;
        try { if (typeof novaLog === 'function') novaLog(`🔄 Xoay key ${key.slice(0, 4)}…${key.slice(-4)} — lỗi/hết quota, tạm nghỉ ${Math.round(cd / 60000)} phút, gọi sau sẽ dùng key kế tiếp`, 'warn'); } catch (_){}
      }
      throw e;
    }
  });
}

async function _llmFetch(url, init = {}){
  if (window.native && window.native.llmFetch){
    const r = await window.native.llmFetch({ url, method: init.method || 'POST', headers: init.headers || {}, body: init.body, timeoutMs: init.timeoutMs });
    if (!r || (r.ok === false && r.status == null)) throw new Error('Không kết nối được máy chủ: ' + ((r && r.error) || 'lỗi mạng'));
    const _t = r.text || '';
    return { ok: r.ok, status: r.status, text: async () => _t, json: async () => JSON.parse(_t) };
  }
  return fetch(url, init);
}

function _llmTrack(model, u){
  if (!u) return;
  const inp = (u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens || 0));
  const out = (u.completion_tokens != null ? u.completion_tokens : (u.output_tokens || 0));
  const cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || u.cache_read_input_tokens || 0;
  const p = LLM_PRICE[String(model || '').toLowerCase()] || null;
  const usd = p ? ((inp - cached) / 1e6 * p[0] + cached / 1e6 * p[1] + out / 1e6 * p[2]) : 0;
  _llmUse.calls++; _llmUse.inTok += inp; _llmUse.outTok += out; _llmUse.cacheTok += cached; _llmUse.usd += usd;
  const st = _llmUse.steps[_llmStep] || (_llmUse.steps[_llmStep] = { calls: 0, inTok: 0, outTok: 0, cacheTok: 0, usd: 0 });
  st.calls++; st.inTok += inp; st.outTok += out; st.cacheTok += cached; st.usd += usd;
  if (_llmUse.calls % 25 === 0) llmUsageReport(true);     // cứ 25 lượt ghi 1 dòng vào Nhật ký
}

function llmUsageReport(short){
  const u = _llmUse;
  const head = `💰 ${u.calls} lượt gọi · vào ${_k(u.inTok)} (cache ${_k(u.cacheTok)}) · ra ${_k(u.outTok)} · ~$${u.usd.toFixed(3)}`;
  if (typeof novaLog === 'function') novaLog(head, 'acc');
  if (!short){
    for (const [k, s] of Object.entries(u.steps))
      if (typeof novaLog === 'function') novaLog(`   • ${k}: ${s.calls} lượt · vào ${_k(s.inTok)} · ra ${_k(s.outTok)} · ~$${s.usd.toFixed(3)}`);
  }
  return { ...u };
}

async function callAnthropic(messages, model, key, maxTokens, baseUrlOverride){
  const body = JSON.stringify({ model, max_tokens: maxTokens, messages });
  // baseUrlOverride: base URL theo nguồn AI đã resolve ("📋 API đã thêm" / Flow); undefined = dùng cấu hình lưu sẵn
  const baseUrl = (baseUrlOverride !== undefined ? (baseUrlOverride || '') : (localStorage.getItem('api_base_url') || ''));

  // Nếu có Base URL bên thứ 3 → gọi thẳng, bỏ qua proxy Vercel
  if (baseUrl) {
    // Chuẩn hóa Base URL cho Anthropic /messages — chịu được: không có https://, /v1, /v1/, /messages sẵn, URL đầy đủ.
    let endpoint = baseUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(endpoint)) endpoint = 'https://' + endpoint;   // "xkiro.com" → "https://xkiro.com"
    endpoint = endpoint.replace(/([^:])\/{2,}/g, '$1/');                     // gộp slash kép trong path
    if (!/\/messages$/i.test(endpoint))                                        // đã đủ path thì giữ nguyên
      endpoint += /\/v1$/i.test(endpoint) ? '/messages' : '/v1/messages';
    const r = await _llmFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'Authorization': 'Bearer ' + key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body, timeoutMs: LLM_TIMEOUT_MS
    });
    if (!r.ok) { const e = await r.text(); throw new Error(`API ${r.status}: ${e.slice(0, 600)}`); }
    const d = await r.json();
    return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  // Try Vercel proxy first
  try {
    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body
    });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const d = await r.json();
      if (!r.ok) throw new Error(`API ${r.status}: ${(d.error?.message || JSON.stringify(d)).slice(0, 200)}`);
      return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
  } catch (e) {
    if (e.message.startsWith('API ')) throw e;
  }
  // Fallback direct
  const r = await _llmFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body, timeoutMs: LLM_TIMEOUT_MS
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`API ${r.status}: ${e.slice(0, 600)}`); }
  const d = await r.json();
  _llmTrack(model, d.usage);
  return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function _oaContent(d, model){
  const ch = (d.choices && d.choices[0]) || {};
  const txt = (ch.message && ch.message.content) || '';
  if (!txt.trim()){
    const fr = ch.finish_reason || '?';
    const rt = (d.usage && d.usage.completion_tokens_details && d.usage.completion_tokens_details.reasoning_tokens) || 0;
    throw new Error(`Model ${model} trả RỖNG (finish_reason=${fr}${rt ? `, đã tiêu ${rt} token suy luận` : ''}) — tăng maxTokens hoặc hạ reasoning_effort.`);
  }
  return txt;
}

async function callOpenAI(messages, model, key, maxTokens, opts = {}){
  // Convert Anthropic-style image content to OpenAI format if needed
  const oaMessages = messages.map(m => {
    if (typeof m.content === 'string') return m;
    const parts = m.content.map(c => {
      if (c.type === 'text') return { type: 'text', text: c.text };
      if (c.type === 'image' && c.source?.type === 'base64')
        return { type: 'image_url', image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } };
      return c;
    });
    return { role: m.role, content: parts };
  });

  // GPT-5, o1, o3, o4 và các reasoning models dùng `max_completion_tokens` thay vì `max_tokens`
  const isNewModel = /^(gpt-5|o1|o3|o4)/i.test(model);
  const payload = { model, messages: oaMessages };
  if (isNewModel) {
    // Token SUY LUẬN tính chung vào max_completion_tokens → phải chừa chỗ, không thì nội dung trả về RỖNG.
    payload.max_completion_tokens = maxTokens + 6000;
    // Việc của app là điền theo khuôn, không cần nghĩ sâu → hạ mức suy luận: nhanh hơn nhiều, rẻ hơn nhiều.
    payload.reasoning_effort = opts.effort || 'low';
  } else {
    payload.max_tokens = maxTokens;
  }
  if (opts.jsonObj) payload.response_format = { type: 'json_object' };   // ⚠️ chế độ này KHÔNG trả được MẢNG top-level → mặc định TẮT
  const body = JSON.stringify(payload);

  // Try Vercel proxy first
  try {
    const r = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body
    });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const d = await r.json();
      if (!r.ok) throw new Error(`API ${r.status}: ${(d.error?.message || JSON.stringify(d)).slice(0, 200)}`);
      _llmTrack(model, d.usage);
      return _oaContent(d, model);
    }
  } catch (e) {
    if (e.message.startsWith('API ')) throw e;
  }
  // Fallback direct
  const r = await _llmFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body, timeoutMs: LLM_TIMEOUT_MS
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`API ${r.status}: ${e.slice(0, 600)}`); }
  const d = await r.json();
  _llmTrack(model, d.usage);
  return _oaContent(d, model);
}

async function callOpenAICompat(messages, model, key, maxTokens, endpoint, opts = {}){
  const oaMessages = messages.map(m => {
    if (typeof m.content === 'string') return m;
    // Chuyển ảnh Anthropic (type:image/source) → OpenAI image_url (bridge CLI + Gemini đều đọc được).
    const parts = m.content.map(c => {
      if (c.type === 'text') return { type: 'text', text: c.text };
      if (c.type === 'image_url') return c;
      if (c.type === 'image' && c.source) return { type: 'image_url', image_url: { url: 'data:' + (c.source.media_type || 'image/png') + ';base64,' + c.source.data } };
      return null;
    }).filter(Boolean);
    // Chỉ toàn text → gộp thành chuỗi (một số endpoint thích kiểu này).
    if (parts.every(p => p.type === 'text')) return { role: m.role, content: parts.map(p => p.text).join('\n') };
    return { role: m.role, content: parts };
  });
  const payload = { model, messages: oaMessages, max_tokens: maxTokens };
  // 🧠 Bật Thinking cho model hybrid (DeepSeek). Tắt = không gửi field → dùng mặc định của model (an toàn).
  // Nếu DeepSeek V4 dùng cú pháp khác (vd model id riêng, hay field "reasoning"), chỉ cần sửa đúng 1 dòng dưới.
  if (opts.thinking === true) payload.thinking = { type: 'enabled' };
  // Ép trả JSON hợp lệ (tránh model trả văn xuôi → parse lỗi)
  if (opts.jsonObj) payload.response_format = { type: 'json_object' };   // ⚠️ chế độ này KHÔNG trả được MẢNG top-level → mặc định TẮT
  // 🌊 stream:true — model reasoning (vd DeepSeek V4) nghĩ rất lâu trước token đầu; non-stream bị gateway
  // (vd xkiro) cắt ở ~30s → 500 → _withRetry gửi lại → bị chặn "duplicate request". Stream giữ connection
  // sống qua giai đoạn nghĩ. CLI bridge KHÔNG hỗ trợ SSE → chỉ bật khi caller truyền opts.stream=true
  // (các đường gateway/relay trực tiếp). llm-fetch ở main đệm trọn SSE rồi trả → parse cả JSON lẫn SSE đều OK.
  if (opts.stream === true) payload.stream = true;
  const body = JSON.stringify(payload);
  // ⏱ Timeout: CLI bridge có thể TREO (process Claude/ChatGPT kẹt) → nếu không có giới hạn, gọi sẽ đứng VÔ HẠN.
  // Cho ngưỡng rộng (mặc định 240s) để cuộc gọi lớn qua CLI vẫn kịp, nhưng treo thật thì bung lỗi rõ.
  const ctrl = new AbortController();
  const tmo = setTimeout(() => ctrl.abort(), opts.timeoutMs || LLM_TIMEOUT_MS);
  let r, d;
  try {
    r = await _llmFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body, signal: ctrl.signal, timeoutMs: opts.timeoutMs || LLM_TIMEOUT_MS
    });
    if (!r.ok) { const e = await r.text(); throw new Error(`API ${r.status}: ${e.slice(0, 600)}`); }
    // Nhận cả 2 dạng phản hồi: JSON thường (non-stream / relay bỏ stream) VÀ SSE (data: {...} từng dòng).
    // Phụ thuộc hình dạng thân, không xem content-type: nhiều relay trả SSE mà header sai.
    const raw = await r.text();
    d = _parseOaStreamBody(raw);
  } catch (e) {
    if (e && (e.name === 'AbortError' || /aborted/i.test(e.message || ''))) throw new Error('Quá thời gian chờ AI (CLI bridge có thể bị treo). Thử lại, hoặc chuyển sang API key ở Cài đặt.');
    throw e;
  } finally { clearTimeout(tmo); }
  _llmTrack(model, d.usage);
  const msg = d.choices?.[0]?.message || {};
  // Model thinking trả lời ở content; phần suy luận nằm ở reasoning_content (bỏ qua, chỉ lấy đáp án)
  return msg.content || msg.reasoning_content || '';
}

function _parseOaStreamBody(raw){
  const s = String(raw || '');
  try { const j = JSON.parse(s); if (j && (j.choices || j.usage || j.error)) return j; } catch (_) {}
  let acc = '', usage = null;
  for (const line of s.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const p = t.slice(5).trim();
    if (!p || p === '[DONE]') continue;
    try {
      const j = JSON.parse(p);
      if (j.usage) usage = j.usage;
      const ch = (j.choices && j.choices[0]) || {};
      if (ch.delta && ch.delta.content) acc += ch.delta.content;
      else if (ch.message && ch.message.content) acc += ch.message.content;
    } catch (_) {}
  }
  return { choices: [{ message: { content: acc } }], usage };
}

async function callClaude(prompt, maxTokens = 1500){
  return callLLM(prompt, { maxTokens });
}

async function callClaudeWithImage(prompt, base64, mediaType, maxTokens = 800){
  return callLLM(prompt, {
    maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt }
      ]
    }]
  });
}

function _repairJson(s){
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    if (esc){ out += ch; esc = false; continue; }
    if (ch === '\\'){ out += ch; esc = true; continue; }
    if (ch === '"'){ inStr = !inStr; out += ch; continue; }
    if (inStr){
      if (ch === '\n'){ out += '\\n'; continue; }
      if (ch === '\r'){ out += '\\r'; continue; }
      if (ch === '\t'){ out += '\\t'; continue; }
    }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');   // bỏ dấu phẩy thừa trước } ]
}

function _trimToSentence(s, max){
  s = String(s || '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.\n'));
  if (stop > max * 0.5) return cut.slice(0, stop + 1).trim();   // hết câu gần nhất
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trim();              // ít nhất hết từ
}

function parseJSON(text, validate){
  const c = String(text || '').replace(/```json|```/g, '').trim();
  // Quét MỌI khối JSON top-level (chống DeepSeek chèn suy luận có dấu [ ] { } rải rác trước/sau JSON thật)
  const blocks = [];
  let i = 0;
  while (i < c.length) {
    const o = c[i];
    if (o !== '[' && o !== '{') { i++; continue; }
    const cl = o === '[' ? ']' : '}';
    let d = 0, end = -1, inS = false, esc = false;
    for (let k = i; k < c.length; k++) {
      const ch = c[k];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inS = !inS; continue; }
      if (inS) continue;
      if (ch === o) d++;
      else if (ch === cl) { d--; if (d === 0) { end = k; break; } }
    }
    if (end === -1) { i++; continue; }
    const slice = c.slice(i, end + 1);
    try { blocks.push(JSON.parse(slice)); }
    catch (_) { try { blocks.push(JSON.parse(_repairJson(slice))); } catch (__) {} }   // thử bản đã sửa newline thật
    i = end + 1;   // bỏ qua khối đã xét → chỉ lấy top-level
  }
  if (!blocks.length) throw new Error('Không tìm thấy JSON hợp lệ');
  // To nhất trước (nhiều nội dung nhất) — thường là câu trả lời thật, không phải ví dụ trong suy luận
  // OpenAI ở chế độ response_format=json_object BẮT BUỘC trả OBJECT, trong khi nhiều prompt của app xin ARRAY
  // → model bọc lại thành {"scenes":[...]}. Mở bọc 1 lớp để mảng bên trong vẫn dùng được.
  const _unwrap = [];
  for (const b of blocks){
    if (b && typeof b === 'object' && !Array.isArray(b)){
      const vals = Object.values(b);
      for (const v of vals) if (Array.isArray(v)) _unwrap.push(v);              // {"scenes":[...]}
      if (vals.length > 1 && vals.every(v => v && typeof v === 'object' && !Array.isArray(v))) _unwrap.push(vals);   // {"001":{...},"002":{...}}
      if (b.text || b.prompt) _unwrap.push([b]);                                 // một cảnh đơn, không bọc mảng
    }
  }
  const cands = blocks.concat(_unwrap);
  cands.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length);
  if (typeof validate === 'function') {
    const ok = cands.find(b => { try { return !!validate(b); } catch (_) { return false; } });
    if (ok !== undefined) return ok;
    const shape = cands.length ? (Array.isArray(cands[0]) ? 'mảng ' + cands[0].length + ' phần tử' : 'object khoá: ' + Object.keys(cands[0]).slice(0, 6).join(',')) : 'không có khối JSON nào';
    throw new Error('JSON sai định dạng — nhận được: ' + shape + ' · đầu output: ' + c.slice(0, 120).replace(/\s+/g, ' '));
  }
  return cands[0];
}

function _appendStrict(messages, strict){
  const ms = messages.map(m => ({ ...m, content: Array.isArray(m.content) ? m.content.map(c => ({ ...c })) : m.content }));
  const last = ms[ms.length - 1];
  if (typeof last.content === 'string') last.content += strict;
  else {
    const t = [...last.content].reverse().find(c => c.type === 'text');
    if (t) t.text += strict; else last.content.push({ type: 'text', text: strict });
  }
  return ms;
}

function _jsonFallbackOverride(){
  const provider = localStorage.getItem('json_fb_provider') || '';
  if (!provider) return null;
  const cur = localStorage.getItem('api_provider') || 'anthropic';
  if (provider === cur) return null;   // fallback phải khác provider chính
  const key = (localStorage.getItem('json_fb_key') || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0] || '';
  if (!key) return null;
  const model = localStorage.getItem('json_fb_model') || (MODELS[provider] && MODELS[provider][0].id) || '';
  return { provider, model, key };
}

async function callLLMJson(prompt, opts = {}){
  const validate = opts.validate || null;
  const maxTokens = opts.maxTokens || 1500;
  const tries = opts.tries || 3;
  const baseMessages = opts.messages || null;
  const STRICT = '\n\n⚠️ BẮT BUỘC: CHỈ in JSON THUẦN (bắt đầu bằng [ hoặc {). KHÔNG suy luận, KHÔNG markdown, KHÔNG văn xuôi, KHÔNG ```. Không có ký tự nào ngoài JSON.';
  const baseOverride = { ...(opts._override || {}), thinking: false };
  let lastErr = null;
  const run = async (strict, override) => {
    const o = { maxTokens, json: true, _override: override };
    if (baseMessages) o.messages = strict ? _appendStrict(baseMessages, STRICT) : baseMessages;
    const reply = await callLLM((strict && !baseMessages) ? (prompt + STRICT) : prompt, o);
    return parseJSON(reply, validate);
  };
  for (let a = 0; a < tries; a++) {
    try { return await run(a > 0, baseOverride); }
    catch (e) { lastErr = e; }
  }
  const fb = _jsonFallbackOverride();
  if (fb) {
    try { return await run(true, { ...fb, thinking: false }); }
    catch (e) { lastErr = e; }
  }
  throw new Error('AI trả JSON không hợp lệ sau ' + tries + ' lần' + (fb ? ' (kể cả fallback)' : '') + (lastErr ? ' — ' + lastErr.message : ''));
}

function safeParseJSON(text, validate){
  try { return parseJSON(text, validate); } catch(e){ return []; }
}

function _novaLogFilter(msg){
  let s = String(msg || ''); if (!s) return s;
  s = s.replace(/\b(gsk_[A-Za-z0-9_-]{20,})\b/g, (_m, k) => k.slice(0, 6) + '...' + k.slice(-4));
  s = s.replace(/\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g, (_m, k) => k.slice(0, 6) + '...' + k.slice(-4));
  s = s.replace(/\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g, (_m, k) => k.slice(0, 8) + '...' + k.slice(-4));
  s = s.replace(/\b(AIza[A-Za-z0-9_-]{20,})\b/g, (_m, k) => k.slice(0, 6) + '...' + k.slice(-4));
  s = s.replace(/Bearer\s+[A-Za-z0-9._\-+/=]{16,}/gi, 'Bearer [redacted]');
  return s;
}

function novaLog(msg, type){
  let t = ''; try { t = new Date().toLocaleTimeString('vi-VN'); } catch(e){}
  _novaLog.push({ t, msg: _novaLogFilter(msg), type: type || '' });
  if (_novaLog.length > 800) _novaLog.shift();
  if (state.tool === 'toollog') novaLogRender();
}

function novaLogRender(){
  const box = document.getElementById('novaLogBox'); if (!box) return;
  box.innerHTML = _novaLog.map(l => {
    const c = l.type==='ok'?'#4ade80':l.type==='err'?'#f87171':l.type==='warn'?'#fbbf24':l.type==='acc'?'#60a5fa':'#8b95a5';
    return `<div><span style="color:#5b6472">[${l.t}]</span> <span style="color:${c}">${escapeHtml(l.msg)}</span></div>`;
  }).join('');
  if (document.getElementById('novaLogAuto')?.checked) box.scrollTop = box.scrollHeight;
}

function novaLogClear(){ _novaLog = []; novaLogRender(); }

function novaLogCopy(){ try { navigator.clipboard.writeText(_novaLog.map(l=>`[${l.t}] ${l.msg}`).join('\n')); } catch(e){} }

function _logClip(s, n){ s = String(s || '').replace(/\s+/g, ' ').trim(); n = n || 60; return s.length > n ? s.slice(0, n) + '…' : s; }

function _logMB(bytes){ const b = Number(bytes) || 0; if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'; return b + ' B'; }

