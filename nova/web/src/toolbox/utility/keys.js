/* KEYS — API key, provider switch, CLI login (onProviderChange, renderKeyFields, collectKeys…)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _saveCurrentKeyFields(){
  if (!_keyFieldsProvider) return;
  localStorage.setItem(_provKeyName(_keyFieldsProvider), collectKeys().join('\n'));
}

function _loadKeyFieldsFor(provider){
  const raw = localStorage.getItem(_provKeyName(provider)) || '';
  renderKeyFields(raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean));
  _keyFieldsProvider = provider;
}

function onProviderChange(){
  const provider = document.getElementById('apiProvider').value;
  // Lưu key của provider CŨ rồi nạp key đã lưu của provider MỚI
  if (_keyFieldsProvider && _keyFieldsProvider !== provider) _saveCurrentKeyFields();
  if (_keyFieldsProvider !== provider) _loadKeyFieldsFor(provider);
  const sel = document.getElementById('apiModel');
  // Thêm option "Tuỳ chỉnh..." ở cuối danh sách
  sel.innerHTML = (MODELS[provider] || []).map(m =>
    `<option value="${m.id}">${m.name}</option>`
  ).join('') + `<option value="custom">✏️ Tuỳ chỉnh...</option>`;
  // Nếu model hiện tại là custom, chọn option "custom" và hiển thị ô input
  const customInput = document.getElementById('apiModelCustom');
  const currentModel = localStorage.getItem('api_model') || '';
  if (currentModel && !MODELS[provider]?.some(m => m.id === currentModel) && currentModel !== 'custom') {
    // Model hiện tại không có trong danh sách -> là custom
    sel.value = 'custom';
    if (customInput) {
      customInput.style.display = '';
      customInput.value = currentModel;
    }
  } else {
    // Model có trong danh sách hoặc chưa có
    if (customInput) customInput.style.display = 'none';
    if (sel.value !== 'custom') {
      sel.value = currentModel || (MODELS[provider]?.[0]?.id || '');
    }
  }
  updateGetKeyLink();
  // Toggle Thinking chỉ hiện cho DeepSeek
  const tr = document.getElementById('thinkingRow');
  if (tr) tr.style.display = (provider === 'deepseek') ? '' : 'none';
  // Ô endpoint CLI chỉ hiện khi chọn provider "cli"; ẩn các ô không liên quan.
  const isCli = provider === 'cli';
  const cliRow = document.getElementById('cliRow');
  if (cliRow) cliRow.style.display = isCli ? '' : 'none';
  ['rowKey', 'rowJsonFb', 'rowBaseUrl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isCli ? 'none' : '';
  });
  if (isCli && typeof _cliUpdateLoginLabel === 'function') _cliUpdateLoginLabel();
}

function updateGetKeyLink(){
  const provider = document.getElementById('apiProvider').value;
  const a = document.getElementById('getKeyLink');
  if (a) a.href = KEY_URLS[provider] || '#';
}

function _cliUpdateLoginLabel(){
  const btn = document.getElementById('cliLoginBtn');
  if (!btn) return;
  const m = document.getElementById('apiModel')?.value;
  const ep = document.getElementById('cliEndpoint')?.value || '';
  const isGpt = m === 'chatgpt' || /:8796\b/.test(ep);
  btn.textContent = isGpt ? '🔐 Đăng nhập gói ChatGPT' : '🔐 Đăng nhập gói Claude';
}

function onCliModelChange(){
  if (document.getElementById('apiProvider')?.value !== 'cli') return;
  const m = document.getElementById('apiModel')?.value;
  const ep = document.getElementById('cliEndpoint');
  if (ep) {
    const cur = ep.value.trim();
    // Chỉ tự đổi khi endpoint đang là localhost mặc định (không đè endpoint tùy chỉnh/VPS).
    if (cur === '' || /^https?:\/\/localhost:879[56]$/i.test(cur)) {
      ep.value = (m === 'chatgpt') ? 'http://localhost:8796' : 'http://localhost:8795';
    }
  }
  _cliUpdateLoginLabel();
}

function onModelChange(){
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  const provider = document.getElementById('apiProvider').value;
  if (sel.value === 'custom') {
    // Hiển thị ô input custom
    if (customInput) {
      customInput.style.display = '';
      customInput.focus();
    }
    // Không lưu ngay, chờ người dùng nhập và lưu
  } else {
    // Ẩn ô input custom
    if (customInput) {
      customInput.style.display = 'none';
      customInput.value = '';
    }
    // Nếu là CLI, gọi onCliModelChange để cập nhật endpoint
    if (provider === 'cli') {
      onCliModelChange();
    }
  }
}

function _cliEp(){ return (document.getElementById('cliEndpoint')?.value || '').trim().replace(/\/+$/, ''); }

async function _cliTestWorks(ep){
  try {
    const r = await fetch(ep + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sonnet', messages: [{ role: 'user', content: 'Trả lời đúng: ok' }] }) });
    if (!r.ok) return false;
    const d = await r.json();
    return !!(d && d.choices && d.choices[0] && d.choices[0].message && !d.error);
  } catch { return false; }
}

function _cliIsGpt(){
  const m = document.getElementById('apiModel')?.value;
  const ep = document.getElementById('cliEndpoint')?.value || '';
  return m === 'chatgpt' || /:8796\b/.test(ep);
}

function _cliGuideBtn(){ const nm = _cliIsGpt() ? 'ChatGPT (Codex)' : 'Claude'; return '<div style="margin-top:10px"><button class="btn ghost sm" onclick="showCliGuide()">📖 Hướng dẫn cài ' + nm + ' CLI</button> <button class="btn ghost sm" onclick="cliLogin()">🔄 Thử lại</button></div>'; }

function showCliGuide(){
  const box = document.getElementById('cliLoginBox'); if (!box) return;
  const gpt = _cliIsGpt();
  const c = 'background:var(--surface-3);padding:1px 5px;border-radius:4px';
  const steps = gpt ? `
      <li>Cài <b>Codex CLI</b>: mở <b>Terminal/CMD</b> gõ <code style="${c}">npm install -g @openai/codex</code> (cần Node.js). Xem <a href="https://github.com/openai/codex" target="_blank" style="color:var(--accent)">github.com/openai/codex</a>. Cần tài khoản <b>ChatGPT Plus</b>.</li>
      <li>Gõ <code style="${c}">codex login</code> → đăng nhập tài khoản ChatGPT 1 lần.</li>
      <li>Quay lại đây bấm <b>🔄 Thử lại</b> → app tự nhận, dùng được.</li>`
    : `
      <li>Cài <b>Claude Code</b>: mở <a href="https://claude.ai/code" target="_blank" style="color:var(--accent)">claude.ai/code</a> → tải & cài (cần tài khoản <b>Claude Pro</b>).</li>
      <li>Mở <b>Terminal</b> (Mac) / <b>CMD</b> (Windows) → gõ <code style="${c}">claude</code> → đăng nhập tài khoản Claude 1 lần.</li>
      <li>Quay lại đây bấm <b>🔄 Thử lại</b> → app tự nhận, dùng được.</li>`;
  box.innerHTML = `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;text-align:left;font-size:12.5px;line-height:1.75">
    <b>Dùng "gói ${gpt ? 'ChatGPT' : 'Claude'}" — không cần API key</b><br>
    <span style="color:var(--text-muted)">Cách này chạy AI bằng gói ${gpt ? 'ChatGPT' : 'Claude'} của bạn qua công cụ dòng lệnh cài trên máy. Làm 1 lần:</span>
    <ol style="margin:8px 0 0 18px;padding:0">${steps}</ol>
    <div style="margin-top:10px;color:var(--text-dim)">Không có gói ${gpt ? 'ChatGPT Plus' : 'Claude'}? Đổi <b>Nhà cung cấp</b> sang Claude/GPT/Gemini rồi <b>dán API key</b> riêng.</div>
    <button class="btn ghost sm" style="margin-top:10px" onclick="cliLogin()">🔄 Thử lại</button>
  </div>`;
}

function _keyRowHTML(val){
  const v = String(val || '').replace(/"/g, '&quot;');
  return `<div class="key-row" style="display:flex;align-items:center;gap:6px">
    <input type="${_keyVisible ? 'text' : 'password'}" class="api-key-field" value="${v}" placeholder="sk-..." autocomplete="off" spellcheck="false" style="flex:1;font-family:monospace;font-size:11px">
    <button class="btn ghost sm" onclick="removeKeyRow(this)" title="Xoá key này" style="color:var(--red);padding:4px 9px">×</button>
  </div>`;
}

function renderKeyFields(keys){
  const box = document.getElementById('apiKeyList');
  if (!box) return;
  if (!keys || !keys.length) keys = [''];
  box.innerHTML = keys.map(_keyRowHTML).join('');
}

function addKeyField(val){
  const box = document.getElementById('apiKeyList');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', _keyRowHTML(val || ''));
  const inputs = box.querySelectorAll('.api-key-field');
  inputs[inputs.length - 1]?.focus();
}

function removeKeyRow(btn){
  const box = document.getElementById('apiKeyList');
  btn.closest('.key-row')?.remove();
  if (box && !box.querySelector('.key-row')) addKeyField('');  // luôn còn ít nhất 1 ô
}

function collectKeys(){
  return Array.from(document.querySelectorAll('#apiKeyList .api-key-field'))
    .map(i => i.value.trim()).filter(Boolean);
}

function toggleKeyVisibility(){
  _keyVisible = !_keyVisible;
  document.querySelectorAll('#apiKeyList .api-key-field').forEach(i => i.type = _keyVisible ? 'text' : 'password');
  const eye = document.getElementById('keyEye');
  if (eye) eye.textContent = _keyVisible ? '🙈' : '👁';
}

