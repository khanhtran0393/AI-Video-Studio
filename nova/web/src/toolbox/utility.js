/* promote-shared-to-peer: 4 hàm thay bằng bản đầy đủ từ shared-consts.js */
/* AUTO-EXTRACTED utility functions */

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

function isPro(){ return true; }   // ✅ ĐÃ MỞ TOÀN BỘ — mọi user đều Pro/Max, không giới hạn

function tierConfig(){ return TIER_CONFIG.max || TIER_CONFIG.pro || TIER_CONFIG.free; }

function getMaxScenes(){ return Infinity; }

function getMaxProfiles(){ return Infinity; }

function getMaxQueue(){ return Infinity; }

function canAutoRun(){ return true; }

function isToolAllowed(){ return true; }

function gateTool(toolId){
  return false;
}

function showUpgradeModal(reason){
  const modal = document.getElementById('upgradeModal');
  const reasonEl = document.getElementById('upgradeReason');
  if (reasonEl){
    if (reason){ reasonEl.textContent = reason; reasonEl.style.display = 'block'; }
    else { reasonEl.textContent = ''; reasonEl.style.display = 'none'; }
  }
  // Fill payment info từ constants
  const g = id => document.getElementById(id);
  if (g('payBankName')) g('payBankName').textContent = PAYMENT_INFO.bank.name;
  if (g('payBankNum'))  g('payBankNum').textContent  = PAYMENT_INFO.bank.accountNumber;
  if (g('payBankOwner'))g('payBankOwner').textContent= PAYMENT_INFO.bank.owner;
  if (g('payZalo'))     g('payZalo').textContent     = PAYMENT_INFO.contact.zalo;
  if (g('payEmail'))    g('payEmail').textContent    = PAYMENT_INFO.contact.email;
  // Ẩn khung thanh toán tới khi chọn gói + dừng theo dõi cũ
  _upgStopWatch(); _upgOrderId = null;
  if (g('upgPay')) g('upgPay').style.display = 'none';
  if (g('upgPayMain')) g('upgPayMain').style.display = 'block';
  if (g('upgPayOk')) g('upgPayOk').style.display = 'none';
  modal.style.display = 'flex';
}

function _upgStopWatch(){
  if (_upgPollTimer){ clearInterval(_upgPollTimer); _upgPollTimer = null; }
  if (_upgCountTimer){ clearInterval(_upgCountTimer); _upgCountTimer = null; }
}

async function _upgOnPaid(p){
  await refreshTierFromCloud();
  const g = id => document.getElementById(id);
  if (g('upgPayMain')) g('upgPayMain').style.display = 'none';
  if (g('upgPayOk')) g('upgPayOk').style.display = 'block';
  const sub = g('upgPayOkSub'); if (sub) sub.textContent = 'Tài khoản đã lên gói ' + (p?.label || '') + '.';
}

function closeUpgradeModal(){
  _upgStopWatch(); _upgOrderId = null;
  document.getElementById('upgradeModal').style.display = 'none';
}

function showGate(msg, opts){
  opts = opts || {};
  const m = document.getElementById('gateModal'); if (!m) { alert(msg); return; }
  const msgEl = document.getElementById('gateMsg'); if (msgEl) msgEl.textContent = msg;
  const btns = document.getElementById('gateBtns');
  if (btns){
    let html = '';
    if (opts.upgrade !== false) html += '<button class="gm-btn gm-up" onclick="closeGate();showUpgradeModal()">Nâng cấp gói</button>';
    html += '<button class="gm-btn gm-ok" onclick="closeGate()">Đã hiểu</button>';
    btns.innerHTML = html;
  }
  m.style.display = 'flex';
}

function closeGate(){ const m = document.getElementById('gateModal'); if (m) m.style.display = 'none'; }

function tierPlanName(t){ return t === 'max' ? 'Studio' : (t === 'pro' ? 'Sáng tạo' : 'Free'); }

function renderTierBadge(){
  const el = document.getElementById('tierBadge');
  if (!el) return;
  const cfg = tierConfig().badge;
  el.textContent = cfg.text;
  el.style.background = cfg.bg;
  el.style.color = cfg.color;
  // Show/hide upgrade button
  const btn = document.getElementById('upgradeBtn');
  if (btn) btn.style.display = isPro() ? 'none' : 'block';
  const btnTop = document.getElementById('upgradeBtnTop');
  if (btnTop) btnTop.style.display = isPro() ? 'none' : 'inline-flex';
  // Chip "gói đang dùng + hạn" ở góc phải topbar
  const chip = document.getElementById('tierChipTop');
  if (chip) {
    chip.className = 'tb-tier';
    chip.title = 'Gói đang dùng — bấm để xem bảng giá';
    if (isAdmin()) {
      chip.classList.add('pro');
      chip.innerHTML = '<span class="dot"></span><b>Admin</b>';
    } else if (state.userTier === 'pro' || state.userTier === 'max') {
      const label = state.userTier === 'max' ? 'Max' : 'Pro';
      const until = state.proUntil;
      if (until && Date.now() > until) {
        chip.classList.add('exp');
        chip.innerHTML = '<span class="dot"></span><b>' + label + '</b> <span class="sub">· hết hạn ' + admFmtDate(until) + '</span>';
      } else {
        chip.classList.add(state.userTier === 'max' ? 'max' : 'pro');
        chip.innerHTML = '<span class="dot"></span><b>' + label + '</b> <span class="sub">· ' + (until ? 'đến ' + admFmtDate(until) : 'vĩnh viễn') + '</span>';
      }
    } else {
      chip.innerHTML = '<span class="dot"></span><b>Free</b>';
    }
    chip.style.display = window.currentUser ? 'inline-flex' : 'none';
  }
  // Menu HIỆN HẾT, KHÔNG icon khoá, KHÔNG làm mờ — Free vào xem thoải mái, chặn ở nút hành động
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('locked');
    const lock = item.querySelector('.nav-lock');
    if (lock) lock.remove();
  });
}

function isAdmin(){ return !!window.currentUser && (ADMIN_EMAILS.includes(window.currentUser.email) || ADMIN_UIDS.includes(window.currentUser.uid)); }

function initAdminUI(){
  const show = isAdmin() ? 'flex' : 'none';
  const nav = document.getElementById('navAdmin');
  const grp = document.getElementById('navAdminGroup');
  if (nav) nav.style.display = show;
  if (grp) grp.style.display = isAdmin() ? 'block' : 'none';
}

function admFmtDate(ts){ if (!ts) return 'Vĩnh viễn'; try { return new Date(ts).toLocaleDateString('vi-VN'); } catch { return String(ts); } }

async function admGrant(uidArg){
  if (!isAdmin()) return setStatusAdm('Chỉ admin.', 'error');
  const uid = String(uidArg || document.getElementById('admUid').value || '').trim();
  if (!uid) return setStatusAdm('Nhập UID đã.', 'error');
  const tier = (document.getElementById('admTier')?.value === 'max') ? 'max' : 'pro';
  const nm = tier === 'max' ? 'Max' : 'Pro';
  const months = parseInt(document.getElementById('admMonths').value);
  const proUntil = months > 0 ? Date.now() + months * 30 * 24 * 3600 * 1000 : null;
  setStatusAdm('Đang cấp ' + nm + ' cho ' + uid + '…', 'working');
  try {
    await window.firebaseSaveDoc(uid, { tier, proUntil });
    setStatusAdm(`✓ Đã cấp ${nm} cho ${uid}${proUntil ? ' đến ' + admFmtDate(proUntil) : ' (vĩnh viễn)'}.`, 'ok');
    admListUsers(); if (typeof admRenderDash==='function') admRenderDash();
  } catch (e){ setStatusAdm('Lỗi: ' + (e.message || e) + ' — kiểm tra Firestore Rules cho admin.', 'error'); }
}

function admGrantFor(uid){ document.getElementById('admUid').value = uid; admGrant(uid); }

async function admRevoke(uidArg){
  if (!isAdmin()) return setStatusAdm('Chỉ admin.', 'error');
  const uid = String(uidArg || document.getElementById('admUid').value || '').trim();
  if (!uid) return setStatusAdm('Nhập UID đã.', 'error');
  if (!confirm('Thu hồi Pro (về Free) của ' + uid + '?')) return;
  try {
    await window.firebaseSaveDoc(uid, { tier: 'free', proUntil: null });
    setStatusAdm('✓ Đã thu hồi Pro của ' + uid + '.', 'ok');
    admListUsers(); if (typeof admRenderDash==='function') admRenderDash();
  } catch (e){ setStatusAdm('Lỗi: ' + (e.message || e), 'error'); }
}

function _admFmtVND(n){ return (Math.round(n) || 0).toLocaleString('vi-VN') + 'đ'; }

function _admDonut(data, cv, ck){
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  let off = 25, segs = '';
  data.forEach(d => { const pct = d.v / total * 100;
    segs += `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${d.c}" stroke-width="4.2" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 21 21)"/>`;
    off -= pct; });
  const leg = data.map(d => `<div class="r"><span class="d" style="background:${d.c}"></span><span>${d.n}</span><span class="n">${d.fmt || d.v}</span></div>`).join('');
  return `<div class="adm-donut-wrap"><div class="adm-donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-3)" stroke-width="4.2"/>${segs}</svg><div class="adm-donut-c"><div class="v">${cv}</div><div class="k">${ck}</div></div></div><div class="adm-leg">${leg}</div></div>`;
}

function _admBars(days, vals, fmtY){
  const W = 520, H = 200, pad = 34, n = vals.length, bw = (W - pad - 8) / n, max = Math.max(...vals, 1) * 1.15;
  let g = '';
  [0, 0.5, 1].forEach(f => { const y = H - 20 - f * (H - 40);
    g += `<line x1="${pad}" x2="${W - 4}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    g += `<text x="2" y="${y + 3}" fill="var(--text-dim)" font-size="9">${fmtY(f * max)}</text>`; });
  vals.forEach((v, i) => { const x = pad + i * bw + bw * 0.22, wv = bw * 0.56, h = (v / max) * (H - 40);
    g += `<rect x="${x}" y="${H - 20 - h}" width="${wv}" height="${h}" rx="3" fill="#a855f7"/>`;
    g += `<text x="${x + wv / 2}" y="${H - 6}" fill="var(--text-dim)" font-size="9" text-anchor="middle">${days[i]}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}</svg>`;
}

async function admRenderDash(){
  const box = document.getElementById('admDash');
  if (!box || !isAdmin()) return;
  let users = [], orders = [];
  try { if (window.firebaseListUsers) users = await window.firebaseListUsers() || []; } catch (e) {}
  try { if (window.firebaseListOrders) orders = await window.firebaseListOrders() || []; } catch (e) { console.warn('list orders (cần rule admin cho orders):', e); }
  const now = Date.now(), in7 = now + 7 * 864e5, ym = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  // ---- Users ----
  let free = 0, pro = 0, max = 0, active = 0, soon = 0, expired = 0;
  users.forEach(u => {
    const paid = (u.tier === 'pro' || u.tier === 'max');
    if (u.tier === 'max') max++; else if (u.tier === 'pro') pro++; else free++;
    if (paid && u.proUntil) {
      if (u.proUntil < now) expired++; else if (u.proUntil < in7) soon++; else active++;
    } else if (paid && !u.proUntil) active++;
  });
  // ---- Orders (paid) ----
  const paidOrders = orders.filter(o => o.status === 'paid');
  let rev = 0, revMonth = 0, cntMonth = 0, revPlus = 0, revMax = 0, revDemo = 0;
  const rev7 = {}, dayKeys = [];
  for (let i = 6; i >= 0; i--){ const d = new Date(now - i * 864e5); const k = d.getDate() + '/' + (d.getMonth() + 1); dayKeys.push(k); rev7[k] = 0; }
  paidOrders.forEach(o => {
    const amt = Number(o.amount) || 0; rev += amt;
    const t = o.paidAt || o.createdAt || 0;
    const d = new Date(t); const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (mk === ym){ revMonth += amt; cntMonth++; }
    if (o.plan === 'max') revMax += amt; else if (o.plan === 'demo') revDemo += amt; else revPlus += amt;
    const k = d.getDate() + '/' + (d.getMonth() + 1); if (k in rev7) rev7[k] += amt;
  });
  const totalUsers = users.length;
  const card = (ic, cls, tag, tagcls, num, lbl) => `<div class="adm-card"><div class="t"><span class="ic" style="background:${cls}22;color:${cls}">${ic}</span><span class="adm-pill" style="background:${tagcls}22;color:${tagcls}">${tag}</span></div><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
  const G = '#16a34a', A = '#d97706', R = '#dc2626', P = '#a855f7', O = 'var(--accent)', B = '#2563eb';
  box.innerHTML = `
    <div class="adm-eye">Người dùng · ${totalUsers} tài khoản</div>
    <div class="adm-stats">
      ${card('👥', B, 'tổng', G, totalUsers, 'Tổng người dùng')}
      ${card('🔑', G, 'đang chạy', G, active, 'License hiệu lực')}
      ${card('⏳', A, '7 ngày', A, soon, 'Sắp hết hạn')}
      ${card('⚠️', R, 'gia hạn', R, expired, 'Đã hết hạn')}
      ${card('🚀', O, 'Sáng tạo', O, pro, 'Gói Pro')}
      ${card('👑', P, 'Studio', P, max, 'Gói Max')}
    </div>
    <div class="adm-grid" style="grid-template-columns:1fr 1fr;margin-top:14px">
      <div class="adm-panel"><h4>Phân bố License</h4><div class="pd">Theo trạng thái</div>
        ${_admDonut([{n:'Hiệu lực',v:active,c:G},{n:'Sắp hết',v:soon,c:A},{n:'Hết hạn',v:expired,c:R},{n:'Free',v:free,c:'#94918a'}], (active+soon+expired), 'license')}</div>
      <div class="adm-panel"><h4>Phân bố gói</h4><div class="pd">Toàn bộ user</div>
        ${_admDonut([{n:'Free',v:free,c:'#94918a'},{n:'Sáng tạo',v:pro,c:O},{n:'Studio',v:max,c:P}], totalUsers, 'user')}</div>
    </div>

    <div class="adm-eye">Doanh thu · ${paidOrders.length} đơn đã trả</div>
    <div class="adm-stats rev">
      ${card('💰', P, 'tổng', G, _admFmtVND(rev), 'Tổng doanh thu')}
      ${card('📅', O, ym, O, _admFmtVND(revMonth), 'Doanh thu tháng này')}
      ${card('🧾', B, 'đã trả', B, paidOrders.length, 'Tổng đơn thành công')}
      ${card('🛒', G, 'tháng này', G, cntMonth, 'Đơn tháng này')}
    </div>
    <div class="adm-grid" style="grid-template-columns:1.6fr 1fr;margin-top:14px">
      <div class="adm-panel"><h4>Doanh thu 7 ngày qua</h4><div class="pd">Đơn vị: đồng</div>
        ${_admBars(dayKeys, dayKeys.map(k => rev7[k]), v => Math.round(v/1000) + 'k')}</div>
      <div class="adm-panel"><h4>Phân bố doanh thu</h4><div class="pd">Theo gói</div>
        ${_admDonut([{n:'Sáng tạo',v:revPlus,c:O,fmt:_admFmtVND(revPlus)},{n:'Studio',v:revMax,c:P,fmt:_admFmtVND(revMax)},{n:'Demo',v:revDemo,c:'#0d9488',fmt:_admFmtVND(revDemo)}], _admFmtVND(rev).replace('đ',''), 'đồng')}</div>
    </div>

    <div class="adm-panel" style="margin-top:14px">
      <h4>Đơn hàng gần đây</h4><div class="pd">${paidOrders.length ? '' : 'Chưa có đơn — hoặc chưa cấp quyền admin đọc collection orders trong Firestore Rules.'}</div>
      <div style="overflow-x:auto"><table class="adm-otbl"><thead><tr><th>Mã đơn</th><th>UID</th><th>Gói</th><th style="text-align:right">Số tiền</th><th>Thời gian</th><th>Trạng thái</th></tr></thead><tbody>
      ${orders.slice().sort((a,b)=>(b.paidAt||b.createdAt||0)-(a.paidAt||a.createdAt||0)).slice(0,8).map(o=>{
        const tn={max:['👑 Studio',P],pro:['🚀 Sáng tạo',O],plus:['🚀 Sáng tạo',O],demo:['🎟 Demo','#0d9488']}[o.plan]||['?','#94918a'];
        const st=o.status==='paid'?['✓ Đã trả',G]:['⏳ Chờ',A];
        const t=o.paidAt||o.createdAt; const ts=t?admFmtDate(t):'—';
        return `<tr><td><code style="font-family:ui-monospace,monospace;background:var(--surface-3);padding:2px 7px;border-radius:5px;color:var(--accent)">${escapeHtml(o.orderId||'')}</code></td><td style="font-size:11px;color:var(--text-muted)">${escapeHtml((o.uid||'').slice(0,12))}…</td><td><span class="adm-pill" style="background:${tn[1]}22;color:${tn[1]}">${tn[0]}</span></td><td style="text-align:right;font-weight:800">${_admFmtVND(Number(o.amount)||0)}</td><td style="color:var(--text-muted)">${ts}</td><td><span class="adm-pill" style="background:${st[1]}22;color:${st[1]}">${st[0]}</span></td></tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:16px">Chưa có đơn hàng.</td></tr>'}
      </tbody></table></div>
    </div>`;
}

async function admListUsers(){
  if (!isAdmin()) return;
  if (!window.firebaseListUsers) return setStatusAdm('Thiếu firebaseListUsers.', 'error');
  setStatusAdm('Đang tải danh sách…', 'working');
  try {
    const users = await window.firebaseListUsers();
    users.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    const now = Date.now(), in7 = now + 7 * 864e5;
    const P = '#a855f7', O = 'var(--accent)', G = '#16a34a', A = '#d97706', R = '#dc2626';
    const pill = (txt, c) => `<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:${c}22;color:${c}">${txt}</span>`;
    const rows = users.map(u => {
      const name = u.displayName || u.username || (u.email || '').replace(/@novastudio\.app$/i, '') || 'User';
      const sub = [u.username, (u.email || '').replace(/@novastudio\.app$/i, '')].filter(Boolean).join(' · ') || (u.uid || '').slice(0, 18);
      const ini = ((name.trim().split(/\s+/).pop() || '?')[0] || '?').toUpperCase();
      const paid = u.tier === 'pro' || u.tier === 'max';
      const tpill = u.tier === 'max' ? pill('👑 Studio', P) : u.tier === 'pro' ? pill('🚀 Sáng tạo', O) : pill('Free', '#94918a');
      let exp = '<span style="color:var(--text-dim)">—</span>', st = pill('—', '#94918a');
      if (paid) {
        if (u.proUntil) {
          const ds = admFmtDate(u.proUntil);
          if (u.proUntil < now) { exp = `<span style="color:${R}">${ds}</span>`; st = pill('● Hết hạn', R); }
          else if (u.proUntil < in7) { exp = `<span style="color:${A}">${ds}</span>`; st = pill('● Sắp hết', A); }
          else { exp = ds; st = pill('● Hiệu lực', G); }
        } else { exp = 'Vĩnh viễn'; st = pill('● Hiệu lực', G); }
      }
      return `<tr style="border-top:1px solid var(--border)">
        <td style="padding:11px 12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:30px;height:30px;border-radius:8px;background:linear-gradient(150deg,var(--accent-2),var(--accent));display:grid;place-items:center;font-weight:800;color:#1c0f05;font-size:13px;flex:none">${escapeHtml(ini)}</span>
            <div style="min-width:0"><div style="font-weight:700">${escapeHtml(name)}</div><div style="font-size:11px;color:var(--text-dim)">${escapeHtml(sub)}</div></div>
          </div></td>
        <td style="padding:11px 12px">${tpill}</td>
        <td style="padding:11px 12px;white-space:nowrap;font-variant-numeric:tabular-nums">${exp}</td>
        <td style="padding:11px 12px">${st}</td>
        <td style="padding:11px 12px;white-space:nowrap;text-align:right">
          <button class="btn ghost sm" onclick="admGrantFor('${u.uid}')" title="Cấp/gia hạn theo GÓI + THỜI HẠN đang chọn ở trên">Cấp / gia hạn</button>
          <button class="btn ghost sm" style="color:var(--red)" onclick="admRevoke('${u.uid}')">Thu hồi</button>
        </td></tr>`;
    }).join('');
    document.getElementById('admUserTable').innerHTML =
      `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:var(--text-dim);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase">
          <th style="padding:8px 12px">Người dùng</th><th style="padding:8px 12px">Gói</th><th style="padding:8px 12px">Hết hạn</th><th style="padding:8px 12px">Trạng thái</th><th style="padding:8px 12px;text-align:right">Thao tác</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted)">Không có user.</td></tr>'}</tbody>
      </table>`;
    setStatusAdm(`✓ ${users.length} user.`, 'ok');
  } catch (e){ setStatusAdm('Lỗi tải: ' + (e.message || e) + ' — Firestore Rules cần cho admin đọc collection users.', 'error'); }
}

function applyTheme(isDark){
  document.documentElement.classList.toggle('dark', isDark);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme(){
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
  localStorage.setItem('darkMode', isDark ? '1' : '0');
}

function _sbHasApi(){
  try {
    const prov = document.getElementById('apiProvider')?.value;
    if (prov === 'cli') return !!document.getElementById('cliEndpoint')?.value.trim();
    const keys = document.querySelectorAll('#apiKeyList input');
    for (const k of keys) if (k.value && k.value.trim()) return true;
  } catch {}
  return false;
}

function _sbSync(){
  const m = document.getElementById('sbModel');
  if (m){
    const sel = document.getElementById('apiModel');
    let t = sel?.selectedOptions?.[0]?.textContent?.trim() || sel?.value || '—';
    t = t.replace(/\s*\(.*$/, '').trim() || '—';   // bỏ phần "(khuyên dùng…)"
    m.textContent = t.length > 26 ? t.slice(0, 26) + '…' : t;
  }
  const ok = _sbHasApi();
  const st = document.getElementById('sbApiState'); if (st) st.textContent = ok ? 'Hoạt động' : 'Chưa cấu hình';
  const dot = document.getElementById('sbApiDot'); if (dot) dot.className = 'gdot ' + (ok ? 'ok' : 'off');
  // Chip người dùng trên topbar — gương từ #userName / #userEmail.
  const chip = document.getElementById('tbUserChip');
  if (chip){
    const un = document.getElementById('userName')?.textContent?.trim() || '';
    if (un && un !== '—' && un !== '?'){
      chip.style.display = 'flex';
      document.getElementById('tbName').textContent = un;
      document.getElementById('tbAvatar').textContent = (un[0] || '?').toUpperCase();
      const role = document.getElementById('tbRole');
      if (role) role.textContent = (typeof isAdmin === 'function' && isAdmin()) ? 'Admin' : (state && state.userTier === 'max' ? 'Max' : (state && state.userTier === 'pro' ? 'Pro' : 'Thành viên'));
    } else chip.style.display = 'none';
  }
}

function navFilter(q){
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('.nav .nav-item').forEach(it => {
    if (it.id === 'navAdmin') return;
    it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.nav .nav-group').forEach(g => {
    if (g.id === 'navAdminGroup') return;
    let n = g.nextElementSibling, any = false;
    while (n && n.classList.contains('nav-item')){ if (n.id !== 'navAdmin' && n.style.display !== 'none') any = true; n = n.nextElementSibling; }
    g.style.display = (!q || any) ? '' : 'none';
  });
}

function _relocateSettings(){
  try {
    const apiSlot = document.getElementById('settingsApiSlot');
    const api = document.getElementById('apiSection');
    if (api && apiSlot && api.parentElement !== apiSlot){
      api.classList.remove('collapsed', 'sidebar-section');
      api.style.display = '';
      apiSlot.appendChild(api);
    }
    const cfgSlot = document.getElementById('settingsGenCfgSlot');
    const cfg = document.getElementById('genCfgBlock');
    if (cfg && cfgSlot && cfg.parentElement !== cfgSlot){ cfgSlot.appendChild(cfg); }   // đưa Model/Luồng… sang Cài đặt
    const flowSlot = document.getElementById('settingsFlowSlot');
    const flow = document.getElementById('flowAuthBlock');
    if (flow && flowSlot && flow.parentElement !== flowSlot){
      flowSlot.appendChild(flow);
    }
    if (typeof _tfCfgInit === 'function') _tfCfgInit();   // nạp cấu hình đã lưu + gắn tự-lưu khi đổi
  } catch (e){ console.warn('relocate settings:', e); }
}

function _tfCfgSave(){ try { const c = {}; _TF_CFG_IDS.forEach(id => { const e = document.getElementById(id); if (e) c[id] = e.value; }); localStorage.setItem('tfCfg', JSON.stringify(c)); } catch (e) {} }

function _tfCfgInit(){
  try {
    const c = JSON.parse(localStorage.getItem('tfCfg') || '{}');
    // Migration 1 LẦN: đưa Độ trễ về mặc định 🎲 5–10s ngẫu nhiên (né chặn). Sau đó tôn trọng lựa chọn của user.
    let _mig = false;
    if (!localStorage.getItem('tfDelayDefaultV2')){ c.tfDelay = 'rand510'; localStorage.setItem('tfDelayDefaultV2', '1'); _mig = true; }
    _TF_CFG_IDS.forEach(id => { const e = document.getElementById(id); if (!e) return; if (c[id] != null && [...e.options].some(o => o.value === c[id])) e.value = c[id]; if (!e._cfgHooked){ e._cfgHooked = true; e.addEventListener('change', _tfCfgSave); } });
    if (_mig) _tfCfgSave();
  } catch (e) {}
}

function _relocateUserBox(){
  const box = document.getElementById('userBoxAuth');
  const slot = document.getElementById('tbUserSlot');
  if (box && slot && box.parentElement !== slot) slot.appendChild(box);
  // ✅ ĐÃ XOÁ CHẾ ĐỘ ĐĂNG NHẬP — luôn ẩn khối tài khoản dưới sidebar.
  const sec = document.querySelector('.user-section');
  if (sec) sec.style.display = 'none';
}

function toggleUserMenu(e){
  if (e) e.stopPropagation();
  const w = document.querySelector('.tb-user-wrap');
  if (w) w.classList.toggle('open');
}

function novaToast(msg){
  try {
    let t = document.getElementById('novaToast');
    if (!t){
      t = document.createElement('div');
      t.id = 'novaToast';
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:99999;max-width:min(560px,86vw);background:var(--surface,#1b1f27);color:var(--text,#e8eaf0);border:1px solid var(--border,#2c3240);border-radius:10px;padding:10px 16px;font-size:12.5px;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.45);word-break:break-all';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._novaT);
    t._novaT = setTimeout(() => { t.style.display = 'none'; }, 4200);
  } catch(_){}
}

function novaCopyLink(url, label){
  url = String(url || '');
  if (!url) return;
  try { navigator.clipboard.writeText(url); } catch(_){}
  novaToast((label || 'App không mở cửa sổ ngoài — đã sao chép liên kết:') + ' ' + url);
}

async function novaDownloadUrl(url, name){
  url = String(url || '');
  if (!url) return;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = name || ('nova-tai-' + Date.now());
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
    novaToast('Đang tải về (ngay trong app): ' + (name || url));
  } catch (e) {
    novaCopyLink(url, 'Không tải trực tiếp được — đã sao chép liên kết:');
  }
}

function openSupportZalo(){ try { window.open(SUPPORT_ZALO); } catch(_){ location.href = SUPPORT_ZALO; } }

function _isMac(){ return !!(window.native && window.native.platform === 'darwin'); }

function macDownloadUpdate(){ try { window.open(MAC_DL_URL); } catch(_){ location.href = MAC_DL_URL; } }

function _showUpdate(info){
  _updState = info || {};
  // Mac: KHÔNG auto-update được (app chưa ký) → chỉ hiện dòng nhắc góc phải, mời tải từ web.
  if (_isMac()){
    const pill = document.getElementById('tbMacUpdate');
    const txt = document.getElementById('tbMacUpdTxt');
    if (pill && _updState.state === 'available'){
      if (txt) txt.textContent = 'Có bản mới v' + (_updState.version || '') + ' — Tải cho Mac';
      pill.style.display = 'inline-flex';
    }
    return;   // không hiện modal/tải-tự-động trên Mac
  }
  const dot = document.getElementById('tbUpdateDot');
  const ban = document.getElementById('tbUpdateBanner');
  const title = document.getElementById('tbUpdateTitle');
  const sub = document.getElementById('tbUpdateSub');
  const s = _updState.state;
  // Banner nhỏ trong menu (giữ nguyên)
  if (ban && dot){
    if (s === 'available'){ dot.classList.add('on'); ban.classList.add('on'); title.textContent = 'Có bản mới v' + (_updState.version||''); sub.textContent = 'Nhấn để tải cập nhật'; }
    else if (s === 'downloading'){ dot.classList.add('on'); ban.classList.add('on'); title.textContent = 'Đang tải bản mới…'; sub.textContent = (_updState.percent||0) + '%'; }
    else if (s === 'downloaded'){ dot.classList.add('on'); ban.classList.add('on'); title.textContent = 'Sẵn sàng cài đặt'; sub.textContent = 'Nhấn để khởi động lại & cài'; }
  }
  // Modal to hiện lúc mở app khi có bản mới
  const modal = document.getElementById('updateModal');
  if (!modal) return;
  const g = id => document.getElementById(id);
  if (s === 'available'){
    if (g('umNewVer')) g('umNewVer').textContent = 'v' + (_updState.version || '');
    if (g('umCurVer')) g('umCurVer').textContent = _appVer ? ('v' + _appVer) : '—';
    if (g('umProg')) g('umProg').style.display = 'none';
    if (g('umNowBtn')){ g('umNowBtn').textContent = 'Cập nhật ngay'; g('umNowBtn').disabled = false; }
    if (g('umLaterBtn')) g('umLaterBtn').style.display = '';
    if (g('umQuestion')) g('umQuestion').style.display = '';
    if (!_updDismissed) modal.style.display = 'flex';   // chỉ tự bung nếu khách chưa bấm "Để sau"
  } else if (s === 'downloading'){
    if (g('umQuestion')) g('umQuestion').style.display = 'none';
    if (g('umProg')) g('umProg').style.display = 'block';
    if (g('umFill')) g('umFill').style.width = (_updState.percent||0) + '%';
    if (g('umProgTxt')) g('umProgTxt').textContent = 'Đang tải… ' + (_updState.percent||0) + '%';
    if (g('umNowBtn')) g('umNowBtn').disabled = true;
    if (g('umLaterBtn')) g('umLaterBtn').style.display = 'none';
  } else if (s === 'downloaded'){
    if (g('umQuestion')){ g('umQuestion').style.display = ''; g('umQuestion').textContent = 'Đã tải xong. Khởi động lại để cài bản mới?'; }
    if (g('umProg')) g('umProg').style.display = 'none';
    if (g('umNowBtn')){ g('umNowBtn').textContent = 'Khởi động lại & cài'; g('umNowBtn').disabled = false; }
    if (g('umLaterBtn')) g('umLaterBtn').style.display = '';
    modal.style.display = 'flex';   // tải xong luôn hiện để mời cài
  }
}

function updateNow(){
  if (!window.native || !_updState) return;
  if (_updState.state === 'downloaded' && window.native.updateInstall) { window.native.updateInstall(); return; }
  if (window.native.updateDownload) window.native.updateDownload();   // bắt đầu tải → _showUpdate('downloading') tự cập nhật thanh
}

function updateLater(){
  _updDismissed = true;
  const modal = document.getElementById('updateModal');
  if (modal) modal.style.display = 'none';
}

function doAppUpdate(){
  _updDismissed = false;
  if (_updState) _showUpdate(_updState);
}

function _ymKey(){ try { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); } catch { return 'na'; } }

function _dashStats(){
  const profiles = (state.profiles || []).length;
  let videos = 0; (state.profiles || []).forEach(p => { videos += Array.isArray(p.videos) ? p.videos.length : 1; });
  const doneTotal = parseInt(localStorage.getItem('av_done_total') || '0') || 0;
  const doneMonth = parseInt(localStorage.getItem('av_done_' + _ymKey()) || '0') || 0;
  const producing = (typeof _autoBusy !== 'undefined' && _autoBusy) ? 1 : 0;
  const queue = (typeof _prodQueue !== 'undefined' && Array.isArray(_prodQueue)) ? _prodQueue.length : 0;
  return { profiles, videos, doneTotal, doneMonth, producing, queue };
}

function _dashWorkflow(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const hasStyle = !!(p && (p.characterStyle || p.backgroundStyle || p.sceneStyle));
  const hasScript = (state.script || '').trim().length > 0;
  // Giọng đọc: file đã nạp vào Dựng Video (t7State.audioFile) — pipeline hiện tại dùng file giọng làm master clock.
  const hasVoice = !!(typeof t7State === 'object' && t7State && t7State.audioFile);
  const nScenes = (state.scenes || []).length;
  const nPrompts = Object.keys(state.scenePrompts || {}).filter(k => state.scenePrompts[k]).length;
  const nImg = Object.keys(state.sceneImages || {}).filter(k => state.sceneImages[k]?.base64).length;
  const sv = state.sceneVideos || {}; const nVid = Object.keys(sv).filter(k => sv[k] && !sv[k].error).length;
  const nClips = (typeof t7State === 'object' && t7State && Array.isArray(t7State.clips)) ? t7State.clips.length : 0;
  // 7 bước theo tool THẬT của app hiện tại (Prompt nhân vật & stock đã gộp vào Phân Cảnh).
  const steps = [
    { nm: 'Profile', done: hasStyle, sb: hasStyle ? 'đã có style' : '—', tool: 'tool1' },
    { nm: 'Kịch bản', done: hasScript, sb: hasScript ? (state.script.length + ' ký tự') : '—', tool: 'toolscript' },
    { nm: 'Giọng đọc', done: hasVoice, sb: hasVoice ? 'đã nạp' : '—', tool: 'toolvoice' },
    { nm: 'Phân cảnh', done: nScenes > 0, sb: nScenes ? (nScenes + ' cảnh · ' + nPrompts + ' prompt') : '—', tool: 'tool2' },
    { nm: 'Ảnh cảnh', done: nImg > 0, sb: nImg ? (nImg + ' ảnh') : '—', tool: 'toolflow' },
    { nm: 'Video cảnh', done: nVid > 0, sb: nVid ? (nVid + ' clip') : '—', tool: 'tool6' },
    { nm: 'Dựng video', done: nClips > 0, sb: nClips ? (nClips + ' clip timeline') : '—', tool: 'tool7' },
  ];
  let cur = steps.findIndex(s => !s.done); if (cur < 0) cur = steps.length - 1;
  return { steps, cur };
}

function renderDashboard(){
  const box = document.getElementById('dashBody'); if (!box) return;
  // Đăng nhập đã gỡ bỏ — không còn #userName; header không chào theo user nữa.
  let dateStr = ''; try { dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch {}
  const s = _dashStats();
  const wf = _dashWorkflow();
  const ic = {
    prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    vid: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    scene: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    veo: '<path d="M13 2L4.5 13H11l-1 9 8.5-12H12l1-8z"/>',
  };
  const card = (cls, ico, lab, val) => `<div class="dcard"><span class="ico ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="lab">${lab}</div><div class="val">${val}</div></div></div>`;
  const qa = (act, ico, t, d) => `<a onclick="${act}"><span class="qi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="qt">${t}</div><div class="qd">${d}</div></div></a>`;
  const stepHtml = wf.steps.map((st, i) => `${i ? '<span class="arr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>' : ''}<div class="st ${st.done ? 'done' : (i === wf.cur ? 'cur' : '')}"><div class="dot">${st.done ? '✓' : (i + 1)}</div><div class="nm">${st.nm}</div><div class="sb">${st.sb}</div></div>`).join('');
  const projs = (state.profiles || []).slice(0, 6).map((p, i) => `<div class="dproj"><span class="th">🎬</span><div style="flex:1;min-width:0"><div class="pn">${escapeHtml(p.tenKenh || 'Profile ' + (i + 1))}</div><div class="pd">${(Array.isArray(p.videos) ? p.videos.length : 1)} video · ${escapeHtml(p.ngach || p.visualStyle || '')}</div></div><button class="btn ghost sm" onclick="switchProfile(${i});switchTool('tool1')">Mở</button></div>`).join('') || '<div class="empty-state">Chưa có profile. Bấm "Tạo Profile mới".</div>';

  box.innerHTML = `
    <div><h1 class="dash-hi">Trung tâm sản xuất video 🎬</h1><p class="dash-sub">${dateStr ? dateStr[0].toUpperCase() + dateStr.slice(1) + ' · ' : ''}Kịch bản → ảnh → giọng đọc → dựng video → YouTube, tất cả trong một app · mọi tính năng Pro/Max đã mở khoá sẵn.</p></div>
    <div class="dash-stats">
      ${card('di-green', '<path d="M20 6L9 17l-5-5"/>', 'Video hoàn thành', s.doneTotal)}
      ${card('di-accent', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Đang sản xuất', s.producing)}
      ${card('di-violet', '<path d="M4 6h3M4 12h3M4 18h3"/><rect x="8" y="4" width="12" height="16" rx="2"/>', 'Trong hàng đợi', s.queue)}
      ${card('di-blue', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>', 'Sản xuất tháng này', s.doneMonth)}
      ${card('di-violet', ic.prof, 'Kênh (profile)', s.profiles)}
      ${card('di-teal', ic.vid, 'Tổng video', s.videos)}
    </div>
    <div class="dsec">
      <div class="dsec-h">⚡ Truy cập nhanh</div>
      <div class="dqa">
        ${qa("switchTool('toolscript')", '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>', 'Tạo Kịch Bản', 'AI viết kịch bản (chế độ Novel)')}
        ${qa("switchTool('tool2')", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>', 'Phân Cảnh', 'Chia cảnh, prompt ảnh &amp; nhân vật')}
        ${qa("switchTool('toolflow')", '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>', 'Tạo Ảnh', 'Google Flow sinh ảnh')}
        ${qa("switchTool('toolvoice')", '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 'Tạo giọng nói', 'OmniVoice TTS')}
        ${qa("switchTool('tool6')", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z"/>', 'Tạo Video', 'Xen video từng cảnh')}
        ${qa("switchTool('tool7')", '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>', 'Dựng Video', 'Timeline, hiệu ứng, xuất file')}
        ${qa("switchTool('toolvideoagent')", '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 12l5 3.5V8.5L8 12z"/>', 'Video Agent', 'Pipeline tự động 17 bước')}
        ${qa("switchTool('toolniche')", '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/>', 'Nghiên cứu Ngách', 'Chủ đề hot &amp; soi đối thủ')}
        ${qa("switchTool('tool9')", '<path d="M12 3l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4"/>', 'YouTube SEO', 'Tiêu đề, mô tả, thumbnail')}
        ${qa("switchTool('toolupscale')", '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-4"/><path d="M14 6h4v4"/><path d="M18 6l-5 5"/>', 'Nâng cấp ảnh', 'Làm nét ảnh cảnh')}
        ${qa("switchTool('tool4')", '<path d="M4 7l3-3 3 3M7 4v9M20 17l-3 3-3-3M17 20v-9"/>', 'Đổi Tên Ảnh', 'Đổi tên hàng loạt')}
        ${qa("switchTool('toolwhiteboard')", '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>', 'Whiteboard Studio', 'SRT → video bảng vẽ tay')}
        ${qa("switchTool('toolhanddraw')", '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', 'Vẽ Tay Ảnh', 'Ảnh tĩnh → video vẽ tay')}
        ${qa("switchTool('toolimzic')", '<path d="M3 12h18M3 4h18M3 20h18"/><path d="M6 4v16"/>', 'I-MZic', 'Ảnh + nhạc, hiệu ứng theo nhịp')}
        ${qa("switchTool('toolstudio')", '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 8h20"/><path d="M6 21h12"/><path d="M12 17v4"/>', 'Studio', 'Kho media, ghép video, stem…')}
        ${qa("switchTool('toolsrttranslate')", '<path d="M4 7l3-3 3 3M7 4v9M20 17l-3 3-3-3M17 20v-9"/>', 'Dịch SRT', 'AI dịch phụ đề SRT')}
      </div>
    </div>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>📈 Tiến độ video hiện tại</span>
        <button class="btn ghost sm" onclick="switchTool('${(wf.steps[wf.cur] && wf.steps[wf.cur].tool) || 'toolscript'}')" style="text-transform:none;letter-spacing:0">Tiếp tục bước này ➜</button>
      </div>
      <div class="dstep">${stepHtml}</div>
    </div>
    <div class="dsec dauto">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>🚀 Sản xuất video tự động — 1 nút chạy cả quy trình</span>
        <button class="btn ghost sm" onclick="queueAdd()" style="text-transform:none;font-weight:600;letter-spacing:0">＋ Thêm vào hàng đợi</button>
      </div>
      <style>@keyframes autopulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dsh-lbl{font-size:12px;color:var(--text-muted);margin:0 0 6px;display:block}
        .dsh-field{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;font-size:13px;color:var(--text);font-family:inherit}
        .dsh-field:focus{outline:none;border-color:var(--accent)}
      </style>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;font-size:13px;padding:9px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px">
        <span style="color:var(--text-muted);white-space:nowrap">💾 Lưu về máy:</span>
        <select id="dashSaveMode" onchange="dashSaveMode(this.value)" style="max-width:220px;width:auto">
          <option value="perTask" selected>Tạo thư mục theo video</option>
          <option value="flat">Lưu thẳng vào thư mục</option>
        </select>
        <input type="text" id="dashSaveName" placeholder="Tên thư mục (tuỳ chọn)" style="max-width:190px" oninput="_autoSaveName=this.value;try{localStorage.setItem('av_save_name',this.value)}catch(e){}">
        <input type="text" id="dashSaveFolder" readonly placeholder="Chưa chọn thư mục lưu" style="flex:1;min-width:180px">
        <button class="btn ghost sm" onclick="autoPickFolder()">📁 Chọn thư mục</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span>⚡ Tài khoản Flow (tạo ảnh):</span>
        <span id="dashFlowAcc">đang kiểm tra…</span>
        <button class="btn ghost sm" style="margin-left:auto" onclick="switchTool('toolflow')">Thêm / quản lý tài khoản</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:14px;font-size:13px">
        <label style="display:flex;gap:8px;align-items:center">Bắt đầu từ:
          <select id="dashStart" style="width:auto" onchange="dashToggleStart()">
            <option value="script" selected>Kịch bản (làm từ đầu)</option>
            <option value="scenes">Prompt cảnh (đã có kịch bản + giọng)</option>
          </select>
        </label>
      </div>
      <div id="dashTopicRow" style="margin-bottom:14px">
        <label class="dsh-lbl">Chủ đề / Tiêu đề video</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
            <select class="dsh-field" style="flex:1;font-size:12px;padding:7px 10px;" onchange="let m=this.value, s=this.nextElementSibling.value, v = m ? (m + (s ? ' - ' : '') + s) : ''; const tt=document.getElementById('dashTopic'); tt.value=v; window._autoTopic=v;">
            <option value="" selected>-- Chọn Chủ Đề --</option>
            <optgroup label="1. CHỦ ĐỀ">
                <option value="Xuyên Không">Xuyên Không</option>
                <option value="Trùng Sinh">Trùng Sinh</option>
                <option value="Hệ Thống">Hệ Thống</option>
                <option value="Sinh Tồn">Sinh Tồn</option>
                <option value="Võ Hiệp">Võ Hiệp</option>
                <option value="Trinh Thám">Trinh Thám</option>
                <option value="Dị Năng">Dị Năng</option>
                <option value="Linh Khí Khôi Phục">Linh Khí Khôi Phục</option>
                <option value="Kinh Dị">Kinh Dị</option>
                <option value="Hài Hước">Hài Hước</option>
                <option value="Cơ Giáp / Mecha">Cơ Giáp / Mecha</option>
                <option value="Ngôn Tình">Ngôn Tình</option>
                <option value="Báo Thù">Báo Thù</option>
                <option value="Phản Công">Phản Công</option>
                <option value="Nông Trường">Nông Trường</option>
                <option value="Thương Chiến">Thương Chiến</option>
                <option value="Quân Sự">Quân Sự</option>
                <option value="Cung Đấu">Cung Đấu</option>
                <option value="Học Đường">Học Đường</option>
                <option value="Thể Thao">Thể Thao</option>
                <option value="Ẩm Thực">Ẩm Thực</option>
                <option value="Y Học">Y Học</option>
                <option value="Game / Võng Du">Game / Võng Du</option>
                <option value="Kỳ Ảo Mạo Hiểm">Kỳ Ảo Mạo Hiểm</option>
                <option value="Thần Thoại">Thần Thoại</option>
                <option value="Đồng Nhân">Đồng Nhân</option>
                <option value="Đạo Tặc / Heist">Đạo Tặc / Heist</option>
                <option value="Chính Trị">Chính Trị</option>
                <option value="Tình Báo">Tình Báo</option>
                <option value="Du Hành / Di Cư">Du Hành / Di Cư</option>
                <option value="Trộm Mộ / Thám Hiểm Cổ Mộ">Trộm Mộ / Thám Hiểm Cổ Mộ</option>
                <option value="Xuyên Sách / Phản Diện">Xuyên Sách / Phản Diện</option>
                <option value="Giải Trí / Showbiz">Giải Trí / Showbiz</option>
                <option value="Điền Viên / Chữa Lành">Điền Viên / Chữa Lành</option>
                <option value="Mạt Thế / Xác Sống">Mạt Thế / Xác Sống</option>
                <option value="Binh Vương / Đặc Chủng">Binh Vương / Đặc Chủng</option>
                <option value="Sống Trùng Lặp (Time Loop)">Sống Trùng Lặp (Time Loop)</option>
                <option value="Triệu Hoán / Ngự Thú">Triệu Hoán / Ngự Thú</option>
                <option value="Xây Dựng Tông Môn">Xây Dựng Tông Môn</option>
                <option value="Nữ Cường / Quyền Lực">Nữ Cường / Quyền Lực</option>
                <option value="Hào Môn Thế Gia">Hào Môn Thế Gia</option>
                <option value="Thần Bí / Cthulhu">Thần Bí / Cthulhu</option>
                <option value="Tâm Cơ / Trí Đấu">Tâm Cơ / Trí Đấu</option>
                <option value="Đa Vũ Trụ">Đa Vũ Trụ</option>
                <option value="Khoa Kỹ / Xây Dựng Căn Cứ">Khoa Kỹ / Xây Dựng Căn Cứ</option>
                <option value="Nghệ Thuật / Âm Nhạc">Nghệ Thuật / Âm Nhạc</option>
                <option value="Tâm Trí / Hack Não">Tâm Trí / Hack Não</option>
                <option value="Quái Vật Khổng Lồ (Kaiju)">Quái Vật Khổng Lồ (Kaiju)</option>
                <option value="Sứ Giả Thần Linh">Sứ Giả Thần Linh</option>
                <option value="Người Ngoài Hành Tinh">Người Ngoài Hành Tinh</option>
                <option value="Truy Tìm Kho Báu">Truy Tìm Kho Báu</option>
                <option value="Thần Đồng / Thiên Tài">Thần Đồng / Thiên Tài</option>
                <option value="Khảo Cổ Viễn Tưởng">Khảo Cổ Viễn Tưởng</option>
                <option value="Đấu Sủng (Trận Chiến Thú Cưng)">Đấu Sủng (Trận Chiến Thú Cưng)</option>
                <option value="Dưỡng Thành (Nuôi Dưỡng Trưởng Thành)">Dưỡng Thành (Nuôi Dưỡng Trưởng Thành)</option>
                <option value="Nghề Nghiệp Đặc Thù">Nghề Nghiệp Đặc Thù (Pháp Y, Tâm Lý...)</option>
                <option value="Trộm Mệnh / Đổi Đời">Trộm Mệnh / Đổi Đời</option>
                <option value="Giấu Giếm Thân Phận (Ẩn Nhẫn)">Giấu Giếm Thân Phận (Ẩn Nhẫn)</option>
                <option value="Nhặt Nhạnh Đồng Nát">Nhặt Nhạnh Đồng Nát (Nhặt ve chai)</option>
                <option value="Phục Sinh / Hồi Sinh">Phục Sinh / Hồi Sinh</option>
                <option value="Siêu Trí Tuệ Ái Nhân (AI Romance)">Siêu Trí Tuệ Ái Nhân (AI Romance)</option>
                <option value="Đấu Trí Phòng Kín (Escape Room)">Đấu Trí Phòng Kín (Escape Room)</option>
                <option value="Phá Mộng / Xuyên Mộng">Phá Mộng / Xuyên Mộng</option>
                <option value="Thế Giới Ngầm (Underworld)">Thế Giới Ngầm (Underworld)</option>
                <option value="Cuộc Chiến Băng Đảng">Cuộc Chiến Băng Đảng</option>
                <option value="Bảo Tiêu / Lính Đánh Thuê">Bảo Tiêu / Lính Đánh Thuê</option>
                <option value="Ma Pháp Sư / Phù Thủy Học Việc">Ma Pháp Sư / Phù Thủy Học Việc</option>
                <option value="Đọa Lạc / Sa Ngã (Corruption Arc)">Đọa Lạc / Sa Ngã (Corruption Arc)</option>
                <option value="Thay Trời Hành Đạo">Thay Trời Hành Đạo</option>
                <option value="Diệt Thần (Godslayer)">Diệt Thần (Godslayer)</option>
                <option value="Săn Lùng Quái Vật (Monster Hunter)">Săn Lùng Quái Vật (Monster Hunter)</option>
                <option value="Thức Tỉnh Cột Mốc">Thức Tỉnh Cột Mốc (Awakening Event)</option>
                <option value="Sinh Sinh Diệt Diệt">Sinh Sinh Diệt Diệt (Reincarnation Cycle)</option>
                <option value="Trốn Tìm Sinh Tử">Trốn Tìm Sinh Tử (Deadly Hide & Seek)</option>
                <option value="Cấm Thuật / Huyết Tế">Cấm Thuật / Huyết Tế</option>
                <option value="Nghịch Thiên Cải Mệnh">Nghịch Thiên Cải Mệnh</option>
                <option value="Cờ Bạc / Xúc Xắc Sinh Tử">Cờ Bạc / Xúc Xắc Sinh Tử</option>
                <option value="Sinh Tồn Nơi Hoang Dã">Sinh Tồn Nơi Hoang Dã</option>
                <option value="Chinh Phục Ngọn Núi">Chinh Phục Ngọn Núi</option>
                <option value="Thám Hiểm Đáy Biển">Thám Hiểm Đáy Biển Mảnh Vỡ</option>
                <option value="Phiêu Lưu Trên Bầu Trời">Phiêu Lưu Trên Bầu Trời (Sky Islands)</option>
                <option value="Sát Thủ Bàn Phím (Cyber Hacker)">Sát Thủ Bàn Phím (Cyber Hacker)</option>
                <option value="Truy Ký Hiệp Khách">Truy Ký Hiệp Khách</option>
                <option value="Giới Thượng Lưu / Gia Tộc">Giới Thượng Lưu / Gia Tộc Bí Ẩn</option>
                <option value="Đảo Ngược Thời Gian (Rewind)">Đảo Ngược Thời Gian (Rewind)</option>
                <option value="Cây Sinh Mệnh / Thần Mộc">Cây Sinh Mệnh / Thần Mộc</option>
                <option value="Hồi Ức Chắp Vá (Amnesia)">Hồi Ức Chắp Vá (Amnesia)</option>
                <option value="Sinh Vật Biến Đổi Gen">Sinh Vật Biến Đổi Gen</option>
                <option value="Kho Tàng Thư Viện">Kho Tàng Thư Viện Chứa Bí Mật</option>
                <option value="Tội Phạm Hoàn Hảo">Tội Phạm Hoàn Hảo</option>
                <option value="Lãnh Chúa / Lãnh Địa">Lãnh Chúa / Lãnh Địa Khai Hoang</option>
                <option value="Nhà Thám Hiểm / Phiêu Lưu Giả">Nhà Thám Hiểm / Phiêu Lưu Giả</option>
                <option value="Truy Tìm Dấu Tích">Truy Tìm Dấu Tích Chủng Tộc Cũ</option>
                <option value="Giả Tưởng Học Đường">Giả Tưởng Học Đường (Magic School)</option>
                <option value="Giới Trẻ Lạc Lối">Giới Trẻ Lạc Lối (Youth Rebellion)</option>
                <option value="Nuôi Con / Papa/Mama">Nuôi Con / Papa/Mama (Parenting)</option>
                <option value="Nhập Vai Kháng Địch">Nhập Vai Kháng Địch (Tower Defense)</option>
                <option value="Cảnh Sát Hình Sự">Cảnh Sát Hình Sự / Thám Tử Tư</option>
                <option value="Bậc Thầy Sân Khấu / Ảo Thuật">Bậc Thầy Sân Khấu / Ảo Thuật</option>
                <option value="Giao Dịch Ác Quỷ">Giao Dịch Ác Quỷ (Devil's Bargain)</option>
            </optgroup>
          </select>
            <select class="dsh-field" style="flex:1;font-size:12px;padding:7px 10px;" onchange="let m=this.previousElementSibling.value, s=this.value, v = (m && s) ? (m + ' - ' + s) : (m || ''); const tt=document.getElementById('dashTopic'); tt.value=v; window._autoTopic=v;">
            <option value="" selected>-- Phong Cách --</option>
            <optgroup label="2. PHONG CÁCH">
                <option value="Tu Tiên / Tiên Hiệp">Tu Tiên / Tiên Hiệp</option>
                <option value="Huyền Huyễn">Huyền Huyễn</option>
                <option value="Đô Thị">Đô Thị</option>
                <option value="Viễn Tưởng">Viễn Tưởng</option>
                <option value="Dystopia">Dystopia</option>
                <option value="Cổ Đại">Cổ Đại</option>
                <option value="Cyberpunk">Cyberpunk</option>
                <option value="Steampunk">Steampunk</option>
                <option value="Hắc Ám">Hắc Ám</option>
                <option value="Đồng Nhân">Đồng Nhân</option>
                <option value="Kiếm Hiệp">Kiếm Hiệp</option>
                <option value="Huyền Nghi">Huyền Nghi</option>
                <option value="Tâm Lý Tội Phạm">Tâm Lý Tội Phạm</option>
                <option value="Siêu Anh Hùng">Siêu Anh Hùng</option>
                <option value="Western">Western</option>
                <option value="Hải Tặc">Hải Tặc</option>
                <option value="Không Gian">Không Gian</option>
                <option value="Xây Dựng Thế Giới">Xây Dựng Thế Giới</option>
                <option value="Đông Phương Kỳ Ảo">Đông Phương Kỳ Ảo</option>
                <option value="Phương Tây Kỳ Ảo">Phương Tây Kỳ Ảo</option>
                <option value="LitRPG">LitRPG</option>
                <option value="Military Sci-Fi">Military Sci-Fi</option>
                <option value="Romantasy">Romantasy</option>
                <option value="Slice of Life">Slice of Life</option>
                <option value="Epic / Sử Thi">Epic / Sử Thi</option>
                <option value="Gothic">Gothic</option>
                <option value="Thriller">Thriller</option>
                <option value="Hard Sci-Fi">Hard Sci-Fi</option>
                <option value="Noir">Noir</option>
                <option value="Biopunk">Biopunk</option>
                <option value="Post-Apocalyptic">Post-Apocalyptic (Hậu Tận Thế)</option>
                <option value="Lovecraftian">Lovecraftian / Cosmic Horror</option>
                <option value="Dark Comedy">Dark Comedy (Hài Đen)</option>
                <option value="Magical Realism">Magical Realism (Hiện Thực Huyền Ảo)</option>
                <option value="Grimdark">Grimdark</option>
                <option value="Urban Legend">Urban Legend (Truyền Thuyết Đô Thị)</option>
                <option value="Dark Fairy Tale">Dark Fairy Tale (Cổ Tích Đen)</option>
                <option value="Alternate History">Alternate History (Lịch Sử Giả Định)</option>
                <option value="Whodunit">Whodunit (Phá Án Suy Luận)</option>
                <option value="Space Opera">Space Opera</option>
                <option value="Solar Punk">Solar Punk</option>
                <option value="Atompunk">Atompunk</option>
                <option value="Giallo">Giallo / Án mạng kinh dị</option>
                <option value="Isekai">Isekai</option>
                <option value="Wuxia Truyền Thống">Wuxia Truyền Thống</option>
                <option value="Xianxia Cổ Điển">Xianxia Cổ Điển</option>
                <option value="Low Fantasy">Low Fantasy</option>
                <option value="High Fantasy">High Fantasy</option>
                <option value="Surrealism">Surrealism (Siêu Thực)</option>
                <option value="Psychological Horror">Psychological Horror (Kinh Dị Tâm Lý)</option>
                <option value="Mythopoeia">Mythopoeia (Kiến tạo Thần Thoại)</option>
                <option value="Urban Fantasy">Urban Fantasy (Kỳ Ảo Đô Thị)</option>
                <option value="Dark Academia">Dark Academia</option>
                <option value="Light Academia">Light Academia</option>
                <option value="Sword and Sorcery">Sword and Sorcery (Kiếm & Ma Thuật)</option>
                <option value="Flintlock Fantasy">Flintlock Fantasy (Kỳ Ảo Súng Hỏa Mai)</option>
                <option value="Gaslamp Fantasy">Gaslamp Fantasy (Kỳ Ảo Đèn Khí Đá)</option>
                <option value="Weird West">Weird West (K Kỳ Ảo Viễn Tây)</option>
                <option value="Space Western">Space Western (Viễn Tây Vũ Trụ)</option>
                <option value="Cassette Futurism">Cassette Futurism</option>
                <option value="Raypunk">Raypunk (Sci-Fi Thập niên 50)</option>
                <option value="Nanopunk">Nanopunk (Công nghệ Nano)</option>
                <option value="Splatterpunk">Splatterpunk (Bạo lực máu me)</option>
                <option value="Bizarro Fiction">Bizarro Fiction (Viễn Tưởng Kỳ Dị)</option>
                <option value="Slipstream">Slipstream (Giả Tưởng Đa Tầng)</option>
                <option value="Paranormal Romance">Paranormal Romance (Lãng Mạn Siêu Nhiên)</option>
                <option value="Apocalyptic">Apocalyptic (Hủy Diệt Đồng Loạt)</option>
                <option value="Cli-Fi">Cli-Fi (Viễn Tưởng Khí Hậu)</option>
                <option value="Solarpunk Cổ Điển">Solarpunk Cổ Điển</option>
                <option value="Decopunk">Decopunk (Nghệ thuật & Công nghệ)</option>
                <option value="Mythic Fiction">Mythic Fiction (Tiểu Thuyết Huyền Đam)</option>
                <option value="Fairy Tale Retelling">Fairy Tale Retelling (Kể Lại Cổ Tích)</option>
                <option value="Grimms' Fairy Tales">Grimms' Fairy Tales (Phong cách Grimm)</option>
                <option value="Arthurian Legend">Arthurian Legend (Huyền thoại vua Arthur)</option>
                <option value="Ninja / Samurai Fiction">Ninja / Samurai Fiction</option>
                <option value="Mecha-Musume">Mecha-Musume (Cơ Giáp Nữ Sinh)</option>
                <option value="Sentai / Tokusatsu">Sentai / Tokusatsu</option>
                <option value="Magical Girl">Magical Girl (Mahou Shoujo)</option>
                <option value="B-Movie Horror">B-Movie Horror (Kinh Dị Bình Dân)</option>
                <option value="Slasher">Slasher (Sát Nhân Hàng Loạt)</option>
                <option value="Found Footage">Found Footage (Phim Tài Liệu Giả)</option>
                <option value="Gothic Romance">Gothic Romance</option>
                <option value="Southern Gothic">Southern Gothic</option>
                <option value="Suburban Gothic">Suburban Gothic</option>
                <option value="Hard-boiled Detective">Hard-boiled Detective (Thám Tử Gai Góc)</option>
                <option value="Cozy Mystery">Cozy Mystery (Trinh Thám Ấm Áp)</option>
                <option value="Legal Thriller">Legal Thriller (Giật Gân Tòa Án)</option>
                <option value="Medical Thriller">Medical Thriller (Giật Gân Y Khoa)</option>
                <option value="Techno-Thriller">Techno-Thriller (Giật Gân Công Nghệ)</option>
                <option value="Spy Fiction">Spy Fiction (Tiểu Thuyết Gián Điệp)</option>
                <option value="Heist / Caper">Heist / Caper (Siêu Trộm)</option>
                <option value="Picaresque">Picaresque (Lãng Tử / Giang Hồ)</option>
                <option value="Bildungsroman">Bildungsroman (Trưởng Thành qua Thử Thách)</option>
                <option value="Epistolary">Epistolary (Viết Dưới Dạng Thư Từ)</option>
                <option value="Metafiction">Metafiction (Tiểu Thuyết Siêu Cấu Trúc)</option>
                <option value="Satire / Trào Phúng">Satire / Trào Phúng</option>
                <option value="Absurdist Fiction">Absurdist Fiction (Phi Lý)</option>
                <option value="Utopian">Utopian (Xã Hội Không Tưởng)</option>
                <option value="Speculative Evolution">Speculative Evolution (Tiến Hóa Giả Định)</option>
                <option value="New Weird">New Weird (Tân Kỳ Dị)</option>
            </optgroup>
          </select>
        </div>
        <input id="dashTopic" class="dsh-field" placeholder="Hoặc tự nhập: Bí ẩn sự sụp đổ của Đế chế La Mã" oninput="_autoTopic=this.value">
        <div id="dashWordsWrap" style="display:flex;align-items:flex-end;gap:12px;margin-top:12px;flex-wrap:wrap">
          <div>
            <label class="dsh-lbl">Chương</label>
            <input id="dashChapters" class="dsh-field" type="number" min="1" step="1" value="1" oninput="dashWordEst()" style="width:90px">
          </div>
          <div>
            <label class="dsh-lbl">Từ / chương</label>
            <input id="dashWordsPerChapter" class="dsh-field" type="number" min="100" step="100" value="1200" oninput="dashWordEst()" style="width:110px">
          </div>
          <div style="flex:1;min-width:150px">
            <label class="dsh-lbl">Ngôn ngữ</label>
            <select id="dashLang" class="dsh-field" style="padding:7px 10px"></select>
          </div>
          <span id="dashWordEst" style="font-size:12px;color:var(--text-dim);white-space:nowrap;padding-bottom:11px">Tổng dự tính: ~9 phút · ≈ 9 phút/chương</span>
        </div>
      </div>
      <div id="dashPrepared" style="display:none;margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">📄 Kịch bản (file .txt)</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <input type="file" id="dashScriptFile" accept=".txt,text/plain" onchange="dashLoadScriptFile(this.files)">
          <span id="dashScriptName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px">Để trống = tự lấy kịch bản từ tab Tạo Kịch Bản / Phân Cảnh.</div>
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">🎙 File giọng đọc <span style="text-transform:none">(tuỳ chọn)</span></label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input type="file" id="dashVoiceFile" accept="audio/*" onchange="dashPickVoice(this.files)">
          <span id="dashVoiceName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px">Để trống file giọng = video xuất không kèm tiếng (ghép sau ở Dựng Video).</div>
      </div>
      <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:2px">Điền form rồi bấm <b>Chạy hàng đợi</b> (dưới). Luồng tự động chạy tới <b>Dựng video</b> rồi <b>dừng</b> (chưa xuất file) — bạn sang tab <b>Dựng Video</b> kiểm/tạo lại cảnh lỗi rồi tự bấm <b>Xuất</b>. Muốn làm nhiều: bấm <b>Thêm vào hàng đợi</b> từng cái rồi mới Chạy.</div>
      <div id="autoLog" style="font-size:12.5px;color:var(--text-muted);margin-top:6px;min-height:18px"></div>
    </div>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>Hàng đợi <span id="queueCount" style="color:var(--text-muted);font-weight:400;font-size:12px;text-transform:none;letter-spacing:0">0 mục</span></span>
        <span style="display:flex;gap:8px">
          <button class="btn primary sm" id="queueRunBtn" onclick="runQueue()" style="text-transform:none;letter-spacing:0">▶ Chạy hàng đợi</button>
          <button class="btn sm" id="queueStopBtn" onclick="queueStop()" style="display:none;background:var(--red);color:#fff;text-transform:none;letter-spacing:0">■ Dừng</button>
        </span>
      </div>
      <div id="queueList"></div>
    </div>
    <details class="dsec" style="margin-top:0">
      <summary style="cursor:pointer;list-style:none;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between">
        <span>🕘 Lịch sử chạy</span>
        <span onclick="event.preventDefault();_histClear()" style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-dim);cursor:pointer">Xoá lịch sử</span>
      </summary>
      <div id="histList" style="margin-top:10px"></div>
    </details>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>🎬 Kênh của bạn</span>
        <button class="btn ghost sm" onclick="switchTool('tool1')" style="text-transform:none;letter-spacing:0">Quản lý Profile ➜</button>
      </div>
      ${projs}
    </div>`;
  try {
    _histRender();
    _dashFlowStatus();
    _autoRender();
    const tt = document.getElementById('dashTopic'); if (tt && _autoTopic) tt.value = _autoTopic;
    const sm = document.getElementById('dashSaveMode'); if (sm) sm.value = _autoSaveMode;
    const snm = document.getElementById('dashSaveName'); if (snm) snm.value = _autoSaveName || '';
    dashSaveMode(_autoSaveMode);
    const sf = document.getElementById('dashSaveFolder'); if (sf) { const base = _autoOutDir || _autoDefaultDir; if (base) sf.value = base; }
    const ss = document.getElementById('dashStart'); if (ss) ss.value = _autoStartFrom;
    // QUY MÔ: mirror giá trị tab Tạo Kịch Bản (chương × từ/chương × ngôn ngữ); danh sách ngôn ngữ
    // clone từ tsLang — không nhân đôi 27 option giữa 2 nơi (một nguồn, một hợp đồng).
    const dl = document.getElementById('dashLang');
    if (dl) { const sl = document.getElementById('tsLang'); if (sl) { dl.innerHTML = sl.innerHTML; dl.value = sl.value || 'Tiếng Việt'; } }
    const dch = document.getElementById('dashChapters'), dwpc = document.getElementById('dashWordsPerChapter');
    const tch = document.getElementById('tsChapters'), twpc = document.getElementById('tsWordsPerChapter');
    if (dch && tch) dch.value = tch.value;
    if (dwpc && twpc) dwpc.value = twpc.value;
    if (typeof dashWordEst === 'function') dashWordEst();
    dashToggleStart();
    const vn = document.getElementById('dashVoiceName'); if (vn && _autoVoiceFile) vn.textContent = '✓ ' + _autoVoiceFile.name;
    if (_autoLastLog) _autoLog(_autoLastLog.msg, _autoLastLog.type);
    queueRender();
    if (_queueRunning) { const r = document.getElementById('queueRunBtn'), st = document.getElementById('queueStopBtn'); if (r) r.style.display = 'none'; if (st) st.style.display = ''; }
  } catch (e) {}
}

function _isQuotaErr(m){ return /quota|giới hạn|hết lượt|hết token|hết ngày|hết lần|daily|rate.?limit|429|too many|exhaust|limit reach|out of credit|no credit|insufficient credit|hết credit/i.test(String(m || '')); }

function _clipEntities(){
  const out = [];
  try { (state.charactersV || []).forEach(n => out.push(n)); } catch (e) {}
  try { (state.backgroundsV || []).forEach(n => out.push(n)); } catch (e) {}
  return out.map(x => String(x || '').trim()).filter(Boolean).slice(0, 12);
}

async function _autoFetchWebClips(scenes, budgetMs){
  if (!Array.isArray(scenes) || !scenes.length) return { ok: 0, fail: 0, stop: '' };
  if (typeof searchWebSources !== 'function' || typeof webLayClip !== 'function')
    return { ok: 0, fail: 0, stop: 'chưa nạp được nguồn web' };
  if (!window.native || !window.native.nguonWeb) return { ok: 0, fail: 0, stop: 'chỉ chạy trong app Nova' };
  const _han = Date.now() + (budgetMs || 20 * 60000);
  if (!state.mediaPicks) state.mediaPicks = {};
  if (!state.webCandidates) state.webCandidates = {};
  let ok = 0, fail = 0, lienTiep = 0, stop = '', xong = 0;
  const _N = _t2SoLuong();
  await _t2SongSong(scenes, _N, async (s) => {
    if (Date.now() > _han){ if (!stop) stop = 'hết giờ cho phép, còn ' + (scenes.length - xong) + ' cảnh'; return; }
    _autoLog(`🌐 Tìm tư liệu web cảnh ${s.id} (${++xong}/${scenes.length}, ${_N} luồng)…`);
    try {
      const r = await t2FetchWebOne(s.id);
      if (r.err) throw new Error(r.err);
      if (!r.added) throw new Error('không có ứng viên nào hợp');
      // Lượt tự động chỉ lấy ứng viên dùng được cho kênh kiếm tiền.
      const hopA = (state.webCandidates[s.id] || []).filter(x => !x.camTM);
      const pick = _t2XepUngVien(hopA, s, _t2DaDung(s.id)).ds[0] || hopA[0];
      if (!pick) throw new Error('không có ứng viên nào dùng được (còn lại đều cấm thương mại)');
      const clip = await webLayClip(pick, parseFloat(s.duration) || 4);
      if (!clip.ok) throw new Error(clip.error);
      state.mediaPicks[s.id] = { kind: 'video', downloadUrl: clip.dataUrl, source: pick.source,
        duration: clip.duration, web: true, trangUrl: pick.trangUrl, license: pick.license, author: pick.author };
      ok++; lienTiep = 0;
      if (typeof novaLog === 'function') novaLog(`🌐 Cảnh ${s.id} gắn tư liệu ${webNhan(pick.platId)}: "${String(pick.ten || '').slice(0, 50)}".`, 'ok');
    } catch (e){
      fail++; lienTiep++;
      const msg = String((e && e.message) || e).slice(0, 90);
      if (typeof novaLog === 'function') novaLog(`🌐 Cảnh ${s.id} không lấy được tư liệu web: ${msg}`, 'warn');
      // Ba cảnh liên tiếp hỏng thường là bị chặn nhịp hoặc mất mạng — dừng cả bước
      // còn hơn ngồi đốt thời gian cho 300 cảnh nữa cũng hỏng y hệt.
      if (lienTiep >= 3 && !stop) stop = msg;
    }
  }, () => _autoAbort || state.cancelRequested || !!stop);
  if (!stop && (_autoAbort || state.cancelRequested)) stop = 'đã dừng';
  try { if (ok && typeof saveState === 'function') saveState(true); } catch (e) {}
  return { ok, fail, stop };
}

async function _autoFetchYtClips(scenes, budgetMs){
  if (!Array.isArray(scenes) || !scenes.length) return { ok: 0, fail: 0, stop: '' };
  const _deadline = Date.now() + (budgetMs || 15 * 60000);   // mỗi cảnh ~40-60s → giới hạn để bước Xen video không bị 'Quá giờ'
  if (!window.native || typeof window.native.smartClip !== 'function' || typeof window.native.readFileB64 !== 'function')
    return { ok: 0, fail: 0, stop: 'chỉ chạy trong app Nova' };
  if (!state.mediaPicks) state.mediaPicks = {};
  if (!state.ytCandidates) state.ytCandidates = {};
  let ok = 0, fail = 0, streak = 0, stop = '', xong = 0;
  const _ents = _clipEntities();
  /* yt-dlp + ffmpeg mỗi cảnh ~40-60s. Chạy song song rút thẳng theo số luồng,
     nhưng YouTube chặn IP nhanh hơn các trang khác nên giữ tối đa 2 luồng.  */
  const _N = Math.min(2, _t2SoLuong());
  await _t2SongSong(scenes, _N, async (s) => {
    if (Date.now() > _deadline){ if (!stop) stop = 'hết giờ cho phép, còn ' + (scenes.length - xong) + ' cảnh'; return; }
    _autoLog(`▶️ Tìm clip YouTube cảnh ${s.id} (${++xong}/${scenes.length}, ${_N} luồng)…`);
    try {
      const hint = (state.scenePrompts && state.scenePrompts[s.id]) || (state.scenePrompts2 && state.scenePrompts2[s.id]) || '';
      const dur = parseFloat(s.duration) || 4;
      const r = await window.native.smartClip({ narration: s.text || '', hint, duration: dur, vision: false, score: true, entities: _ents });
      if (!r || !r.ok) throw new Error((r && r.error) || 'không tìm được clip');
      const b = await window.native.readFileB64(r.path);
      if (!b || !b.dataUrl) throw new Error('không đọc được clip');
      if (r.candidates && r.candidates.length) state.ytCandidates[s.id] = r.candidates;
      state.mediaPicks[s.id] = { kind: 'video', downloadUrl: b.dataUrl, source: r.source || 'yt-smart', duration: r.duration || dur };
      ok++; streak = 0;
      if (typeof novaLog === 'function') novaLog(`▶️ Cảnh ${s.id} gắn clip YouTube: "${_logClip(r.query || '')}".${(r.notes && r.notes.length) ? ' (' + r.notes.join(' · ') + ')' : ''}`, 'ok');
    } catch (e){
      fail++; streak++;
      const msg = String((e && e.message) || e).slice(0, 90);
      if (typeof novaLog === 'function') novaLog(`▶️ Cảnh ${s.id} không lấy được clip: ${msg}`, 'warn');
      if (streak >= 3 && !stop) stop = msg;
    }
  }, () => _autoAbort || state.cancelRequested || !!stop);
  if (!stop && (_autoAbort || state.cancelRequested)) stop = 'đã dừng';
  try { if (ok && typeof saveState === 'function') saveState(true); } catch (e) {}
  return { ok, fail, stop };
}

function dashSaveMode(v){
  _autoSaveMode = v || 'perTask'; try { localStorage.setItem('av_save_mode', _autoSaveMode); } catch (e) {}
  const nm = document.getElementById('dashSaveName'); if (nm) nm.style.display = _autoSaveMode === 'flat' ? 'none' : '';
}

function dashToggleStart(){
  const sel = document.getElementById('dashStart'); const v = sel ? sel.value : 'script';
  _autoStartFrom = v;
  const box = document.getElementById('dashPrepared'); if (box) box.style.display = v === 'scenes' ? 'block' : 'none';
  // Khối Chủ đề + QUY MÔ chỉ hiện khi làm từ đầu (viết kịch bản); từ Prompt cảnh → ẩn cả khối.
  const trow = document.getElementById('dashTopicRow'); if (trow) trow.style.display = v === 'scenes' ? 'none' : '';
  const wrow = document.getElementById('dashWordsWrap'); if (wrow) wrow.style.display = v === 'scenes' ? 'none' : 'flex';
}

function dashPickVoice(files){
  const f = files && files[0]; _autoVoiceFile = f || null;
  const nm = document.getElementById('dashVoiceName'); if (nm) nm.textContent = f ? ('✓ ' + f.name) : '';
}

function dashWordEst(){
  // Cùng công thức ước lượng như khối QUY MÔ tab Tạo Kịch Bản (140 từ/phút).
  const ch = parseInt(document.getElementById('dashChapters')?.value) || 1;
  const wpc = parseInt(document.getElementById('dashWordsPerChapter')?.value) || 0;
  const el = document.getElementById('dashWordEst');
  if (!el) return;
  if (!wpc) { el.textContent = ''; return; }
  const total = ch * wpc, speed = 140;
  el.textContent = 'Tổng dự tính: ~' + Math.max(1, Math.round(total / speed)) + ' phút · ≈ ' + Math.max(1, Math.round(wpc / speed)) + ' phút/chương';
}

async function dashLoadScriptFile(files){
  const f = files && files[0]; if (!f) return;
  try {
    const txt = await f.text();
    _autoScriptText = (txt || '').trim();
    const nm = document.getElementById('dashScriptName'); if (nm) nm.textContent = '✓ ' + f.name;
    _autoLog('✓ Đã tải kịch bản từ ' + f.name, 'ok');
  } catch (e) { _autoLog('Không đọc được file: ' + (e.message || e), 'error'); }
}

function _autoRender(){ /* thanh 9 bước lớn đã bỏ — tiến trình hiện ở dòng hàng đợi (mini bar). Giữ hàm rỗng cho các nơi còn gọi. */ }

function _autoSet(key, status, sub){
  _autoState[key] = { status, sub }; _autoRender();
  if (_queueCurId) {
    const j = _prodQueue.find(x => x.id === _queueCurId);
    if (j) {
      if (status === 'run') { const st = PROD_STEPS.find(s => s.key === key); j.detail = (st ? st.label : key) + (sub && sub !== 'đang chạy…' ? ': ' + sub : '…'); }
      queueRender();   // cập nhật thanh mini theo mọi thay đổi bước
    }
  }
}

function _autoLog(msg, type){
  _autoLastLog = { msg, type };
  const el = document.getElementById('autoLog'); if (!el) return;
  const c = type === 'error' ? 'var(--red)' : type === 'ok' ? 'var(--green)' : 'var(--text-muted)';
  el.innerHTML = `<span style="color:${c}">${escapeHtml(msg)}</span>`;
}

function _autoBumpDone(){
  try {
    localStorage.setItem('av_done_total', String((parseInt(localStorage.getItem('av_done_total') || '0') || 0) + 1));
    const k = 'av_done_' + _ymKey();
    localStorage.setItem(k, String((parseInt(localStorage.getItem(k) || '0') || 0) + 1));
  } catch (e) {}
}

async function _persistJob(heavy){ try { if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile(); await saveState(true, !heavy); } catch (e) {} queueSave(); }

function _stepTO(res){ return _STEP_TO[res] || 45 * 60000; }

function _clearAutoRetry(){ if (_autoRetryTimer) { clearTimeout(_autoRetryTimer); _autoRetryTimer = null; } }

function _histAdd(job, status, detail){
  try {
    const h = JSON.parse(localStorage.getItem('av_history') || '[]') || [];
    h.unshift({ t: Date.now(), title: job.title || '', profile: job.profileName || '', status, detail: (detail || job.detail || '').slice(0, 80) });
    localStorage.setItem('av_history', JSON.stringify(h.slice(0, 60)));
  } catch (e) {}
}

function _histClear(){ try { localStorage.removeItem('av_history'); } catch (e) {} _histRender(); }

async function _dashFlowStatus(){
  const el = document.getElementById('dashFlowAcc'); if (!el) return;
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) { el.innerHTML = '<span style="color:var(--amber)">chưa kết nối extension Flow</span>'; return; }
    const st = await flowBridge.call('GET_STATUS');
    const n = st?.accountCount || 0;
    if (!n) el.innerHTML = '<span style="color:var(--amber)">chưa đăng nhập tài khoản nào</span>';
    else if (n === 1) el.innerHTML = '<b>1</b> tài khoản · <span style="color:var(--text-dim)">thêm ≥2 để tự bật pool (chia + song song)</span>';
    else el.innerHTML = '<b style="color:var(--green)">⚡ ' + n + ' tài khoản · pool TỰ BẬT</b> <span style="color:var(--text-dim)">(chia đều + chạy song song + né quota)</span>';
  } catch (e) { el.innerHTML = '<span style="color:var(--text-dim)">—</span>'; }
}

function _histRender(){
  const box = document.getElementById('histList'); if (!box) return;
  let h = []; try { h = JSON.parse(localStorage.getItem('av_history') || '[]') || []; } catch (e) {}
  if (!h.length) { box.innerHTML = '<div class="empty-state" style="padding:10px 4px;font-size:12px">Chưa có lịch sử.</div>'; return; }
  const ic = { done: ['✓', 'var(--green)'], error: ['✕', 'var(--red)'], paused: ['⏸', 'var(--amber)'] };
  box.innerHTML = h.slice(0, 20).map(r => {
    const m = ic[r.status] || ['•', 'var(--text-muted)'];
    let tm = ''; try { tm = new Date(r.t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border);font-size:12.5px">
      <span style="color:${m[1]};font-weight:700;width:14px;text-align:center">${m[0]}</span>
      <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.title || '(không tên)')}</span>
      <span style="font-size:11px;color:var(--text-dim);font-family:ui-monospace,monospace;white-space:nowrap">${escapeHtml(r.profile || '')} · ${escapeHtml(r.detail || '')}</span>
      <span style="font-size:11px;color:var(--text-dim);white-space:nowrap">${tm}</span>
    </div>`;
  }).join('');
}

function _shrinkDataUrl(dataUrl, maxEdge, q){
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const s = Math.min(1, maxEdge / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', q || 0.7));
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    } catch (e) { resolve(''); }
  });
}

function _capCfg(fields){ const o = {}; for (const id in fields){ const el = document.getElementById(id); if (!el) continue; o[id] = fields[id] === 'c' ? !!el.checked : el.value; } return o; }

function _appCfg(fields, cfg){ if (!cfg) return; for (const id in fields){ if (!(id in cfg)) continue; const el = document.getElementById(id); if (!el) continue; if (fields[id] === 'c') el.checked = !!cfg[id]; else el.value = cfg[id]; } }

function applyChannelCfg(p){
  p = p || ((typeof getProfile === 'function') ? getProfile() : null); if (!p) return;
  _appCfg(_T2_FIELDS, p.t2Cfg);
  if (p.voiceCfg) _appCfg(_VOICE_FIELDS, p.voiceCfg);
  // _appCfg set .value trực tiếp → sự kiện oninput không chạy, label thanh trượt
  // (Tốc độ / Cao độ) vẫn hiển thị số cũ. Đồng bộ lại label cho khớp giá trị thật.
  const _vSync = (id, val, fmt) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };
  const sp = (document.getElementById('voiceSpeed') || {}).value;
  if (sp !== undefined) _vSync('vSpeedVal', sp, v => (+v).toFixed(2) + '×');
  const pt = (document.getElementById('voicePitch') || {}).value;
  if (pt !== undefined) _vSync('vPitchVal', pt, v => (+v > 0 ? '+' : '') + v + ' st');
}

function _qid(){ return 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1e6); }

function _slug(s){ return String(s || '').slice(0, 60).replace(/[^\w\sÀ-ỹ-]/g, '').trim().replace(/\s+/g, '-') || 'video'; }

async function _purgeJobVideo(job){
  if (!job || !job.videoId) return;
  const p = (state.profiles || [])[job.profileIdx]; if (!p || !Array.isArray(p.videos)) return;
  const idx = p.videos.findIndex(v => v.id === job.videoId); if (idx < 0) return;
  try { const uid = window.currentUser?.uid; if (uid && p.profileId){ const b = uid + '/' + p.profileId + '/' + job.videoId + '/'; for (const k of ['styleRefImages','characterImages','backgroundImages','sceneImages','sceneImagesB','sceneVideoBlobs','sceneVideosMeta','motionPrompts','voiceMp3']){ try { await IDB.set(b + k, null); } catch (e) {} } } } catch (e) {}
  if (p.videos.length > 1) {
    const wasCur = p.currentVideoId === job.videoId;
    p.videos.splice(idx, 1);
    if (wasCur) p.currentVideoId = p.videos[Math.max(0, idx - 1)].id;
  } else { p.videos[idx].workData = createEmptyWorkData(); }   // video duy nhất → giữ vỏ, dọn ruột
  try { await saveState(true); } catch (e) {}
  if (state.currentProfileIdx === job.profileIdx) { loadStateFromProfile(p); try { await loadProfileImages(p.profileId, p.currentVideoId); } catch (e) {} if (typeof rerenderAllAfterProfileLoad === 'function') rerenderAllAfterProfileLoad(); if (typeof renderVideoSelect === 'function') renderVideoSelect(); }
}

async function _runPipeline(job){
  const topic = job.topic || ''; const startFrom = job.startFrom || 'script';
  const resuming = !!job.videoId;   // đã có video → đang làm tiếp (chỉ bù bước/ảnh còn thiếu)

  // Đúng profile của job
  if (typeof job.profileIdx === 'number' && job.profileIdx >= 0 && job.profileIdx !== state.currentProfileIdx && typeof switchProfile === 'function') {
    try { await switchProfile(job.profileIdx); } catch (e) {}
  }
  try { applyChannelCfg(getProfile()); } catch (e) {}   // dùng cấu hình Tool 2 + giọng RIÊNG của kênh này
  if (!resuming) {
    try { await newVideo(); } catch (e) {}   // lần đầu: video trắng riêng
    const nv = (typeof getCurrentVideo === 'function') ? getCurrentVideo(getProfile()) : null;
    if (nv) { job.videoId = nv.id; if (job.title) nv.name = job.title; }
    job.step = 0;
    PROD_STEPS.forEach(s => _autoState[s.key] = { status: 'idle' });
  } else {
    try { if (typeof switchVideo === 'function') await switchVideo(job.videoId); } catch (e) {}   // nạp lại video đã làm dở
    PROD_STEPS.forEach((s, idx) => _autoState[s.key] = { status: idx < (job.step || 0) ? 'done' : 'idle' });
  }
  _autoRender();
  const getVid = () => { const p = getProfile(); return (typeof getCurrentVideo === 'function') ? getCurrentVideo(p) : null; };

  const RUN = {
    script: async () => {
      if (startFrom === 'scenes') {
        let scr = (job.script || '').trim();
        if (!scr) { try { scr = ((await IDB.get('qs_' + job.id)) || '').trim(); } catch (e) {} if (scr) job.script = scr; }   // nạp lại từ IndexedDB sau khi khởi động lại
        scr = scr || state.script || '';
        if (!scr) throw new Error('Chưa có kịch bản.');
        state.script = scr; const si = document.getElementById('scriptInput'); if (si) si.value = scr; return { sub: scr.length + ' ký tự (có sẵn)' };
      }
      const tt = document.getElementById('tsTopic'); if (tt) tt.value = topic;
      // Đồng bộ QUY MÔ đúng như tab: chương × từ/chương × ngôn ngữ → tsUpdateScale() tự ghi
      // tsWords = chương × từ/chương VÀ tự bật Chế độ Novel khi ≥ 2 chương (đúng hành vi
      // người dùng chỉnh tay trên tab — pipeline không lệch quy mô với tab nữa).
      // Job cũ (chỉ có words, hàng đợi lưu trước bản này) → giữ đường cũ: ghi thẳng tổng từ.
      if (job.chapters != null) {
        const ch = document.getElementById('tsChapters'); if (ch) ch.value = job.chapters;
        const wp = document.getElementById('tsWordsPerChapter'); if (wp) wp.value = job.wpc || 1200;
        const lg = document.getElementById('tsLang'); if (lg && job.lang) lg.value = job.lang;
        if (typeof tsUpdateScale === 'function') tsUpdateScale();
      } else {
        const tw = document.getElementById('tsWords'); if (tw && job.words) tw.value = job.words;
      }
      await tsGenerate(false);
      const scr = (document.getElementById('tsOutput')?.value || '').trim();
      if (!scr) throw new Error('AI chưa tạo được kịch bản (kiểm tra AI provider / CLI bridge).');
      const si = document.getElementById('scriptInput'); if (si) si.value = scr; state.script = scr;
      return { sub: scr.length + ' ký tự' };
    },
    voice: async () => {
      if (startFrom === 'scenes') { const vf = _queueVoice[job.id]; if (vf) { t7State.audioFile = vf; return { sub: 'file có sẵn' }; } return { skip: true, sub: 'bỏ qua' }; }
      // Gọi thẳng engine. Trước đây bước này bấm nút rồi CÀO thẻ <audio> trong
      // DOM — backend chết là cả job chết. Giờ ttsDoc() tự lui về engine còn sống.
      if (!_giongDS.length) await giongTaiDS();
      const vt = document.getElementById('voiceText'); if (vt){ vt.value = state.script; giongDemChu(); }
      const { blob, giong, engine, luiVe } = await ttsDoc(state.script, null);
      const mp3 = /(mpeg|mp3)/.test(blob.type);
      await t7HandleAudio(new File([blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: blob.type || 'audio/wav' }));
      return { sub: giong.name + (luiVe ? ' (lui về ' + _TTS_TEN[engine] + ')' : '') };
    },
    scenes: async () => {
      const si = document.getElementById('scriptInput'); if (si) si.value = state.script;
      // Áp mức xen video 🎞/🎬 mà kênh đã chọn (ghi lúc Thêm) — vì newVideo() vừa đưa DOM về mặc định.
      if (job.videoMix != null){ state.videoMix = job.videoMix; const e = document.getElementById('t2VideoMix'); if (e) e.value = String(job.videoMix); }
      if (job.stockMix != null){ state.stockMix = job.stockMix; const e = document.getElementById('t2StockMix'); if (e) e.value = String(job.stockMix); }
      if (job.ytMix != null){ state.ytMix = job.ytMix; const e = document.getElementById('t2YtMix'); if (e) e.value = String(job.ytMix); }
      if (job.nguonBat){ state.nguonBat = Object.assign({ veo:false, stock:false, yt:false, kho:false, web:false }, job.nguonBat); try { t2RenderNguon(); } catch (e) {} }
      if (job.webBat && Object.keys(job.webBat).length) state.webBat = Object.assign({}, job.webBat);
      // Đưa file giọng vào Tool 2 để TỰ CĂN TIMING (Whisper) — thời lượng cảnh khớp giọng đọc. Không có giọng → dùng độ dài ước lượng.
      try { _autoAudioFile = (t7State && t7State.audioFile) || null; _autoAudioWords = null; } catch (e) {}
      const chk = document.getElementById('autoFlowImages'); const prev = chk ? chk.checked : false; if (chk) chk.checked = false;
      try { await runAutoTool2(); } finally { if (chk) chk.checked = prev; }
      const n = (state.scenes || []).length; if (!n) throw new Error('Chưa chia được cảnh.'); return { sub: n + ' cảnh' + (t7State.audioFile ? ' (căn theo giọng)' : '') };
    },
    assets: async () => { await runAutoTool3(); return { sub: ((state.charactersV || []).length + (state.backgroundsV || []).length) + ' asset' }; },
    seo: async () => {
      if (typeof t9Init === 'function') t9Init();
      const ti = document.getElementById('t9Title'); if (ti) ti.value = topic || '';
      await t9Generate(); if (!t9State.result) throw new Error('SEO chưa tạo được.');
      const seoTitle = (t9State.result.titles && t9State.result.titles[0]) || ''; const finalTitle = topic || seoTitle;
      if (finalTitle && finalTitle !== job.title) { job.title = finalTitle; const v = getVid(); if (v) v.name = finalTitle; queueRender(); }
      return { sub: 'xong' };
    },
    images: async () => {
      // Tự lưu ảnh về máy vào thư mục của video này (đặt tên theo cảnh/nhân vật). Giữ lại cấu hình cũ của tab Flow.
      const prevAsv = state.autoSave;
      const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      state.autoSave = { enabled: !!idir, mode: 'perTask', folder: idir, taskName: _slug(job.title) };
      let n = 0, quota = '';
      try {
        for (const r of [await tfGenAssets('char', resuming), await tfGenAssets('bg', resuming), await tfGenScenes(resuming)]) {
          if (r && r.skipped) { if (_isQuotaErr(r.reason)) return { quota: true, reason: r.reason }; throw new Error(r.reason || 'Flow chưa sẵn sàng'); }
          n += (r && r.done) || 0;
          if (r && r.err > 0 && _isQuotaErr(r.lastErr || r.error || '')) quota = r.lastErr || r.error;
        }
      } finally { state.autoSave = prevAsv; }
      if (quota) return { quota: true, reason: quota, sub: n + ' ảnh (còn thiếu)' };
      return { sub: n + ' ảnh' };
    },
    videos: async () => {
      // Xen video cho cảnh đánh dấu: 🎞 stock (free) + 🎬 Veo (best-effort) + ▶️ clip YouTube. Không cảnh nào đánh dấu → bỏ qua.
      const scenes = state.scenes || [];
      const wantStock = scenes.filter(s => s.wantStock || s.wantKho);   // kho mở đi chung đường lấy stock
      const wantVideo = scenes.filter(s => s.wantVideo);
      const wantYtAll = scenes.filter(s => s.wantYt);
      const wantWebAll = scenes.filter(s => s.wantWeb);
      if (!wantStock.length && !wantVideo.length && !wantYtAll.length && !wantWebAll.length) return { skip: true, sub: 'không có cảnh xen video' };
      const parts = [];
      // 1) STOCK 🎞 — free, ổn định (Pexels/Pixabay)
      if (wantStock.length){
        if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
          try { await t2FetchStockVideos(); const got = wantStock.filter(s => state.mediaPicks?.[s.id]).length; parts.push(`${got}/${wantStock.length} stock`); }
          catch (e){ parts.push('stock lỗi'); }
        } else parts.push('stock: thiếu API key (Cài đặt)');
      }
      // 2) VEO 🎬 — best-effort, tốn quota Flow; bỏ qua nếu hết quota / gói không mở tool6 / lỗi (KHÔNG làm dừng pipeline)
      if (wantVideo.length && typeof isToolAllowed === 'function' && isToolAllowed('tool6') && !_flowExhausted){
        try {
          mvLoadScenes();
          const ids = new Set(wantVideo.map(s => s.id));
          mvScenes = mvScenes.filter(s => ids.has(s.origId || s.id) && s.img && s.img.base64 && s.variant !== 'b');
          if (mvScenes.length){
            await mvGenerate();                              // sinh motion prompt cho cảnh 🎬
            if (!_autoAbort) await mvVideoGenerate();        // tạo video Veo (lỗi/quota tự ghi per-cảnh, không throw)
            const got = wantVideo.filter(s => mvVideoBlobs[s.id]).length;
            parts.push(`${got}/${wantVideo.length} Veo`);
          }
        } catch (e){ parts.push('Veo bỏ qua (' + (e.message || 'lỗi') + ')'); }
        finally { try { mvLoadScenes(); } catch (e){} }      // khôi phục danh sách cảnh đầy đủ
      } else if (wantVideo.length){
        parts.push('Veo bỏ qua (hết quota / gói chưa mở)');
      }
      // 3) YOUTUBE ▶️ — cắt clip thật đúng thời lượng cảnh (yt-dlp + FFmpeg trên máy). Bỏ cảnh đã có stock; lỗi KHÔNG làm dừng pipeline.
      const wantYt = wantYtAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantYt.length && !_autoAbort){
        const ry = await _autoFetchYtClips(wantYt);
        parts.push(`${ry.ok}/${wantYt.length} YouTube${ry.stop ? ' (dừng: ' + ry.stop + ')' : ''}`);
      }
      // 4) NGUỒN WEB 🌐 — 55 nền tảng; tìm rồi cắt đúng giây cảnh bằng yt-dlp.
      const wantWeb = wantWebAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantWeb.length && !_autoAbort){
        const rw = await _autoFetchWebClips(wantWeb);
        parts.push(`${rw.ok}/${wantWeb.length} web${rw.stop ? ' (dừng: ' + rw.stop + ')' : ''}`);
      }
      // 5) CỨU cảnh vẫn trống — trả về ảnh AI + sinh prompt bù, không để cảnh đen.
      if (!_autoAbort){
        try { const rc = await _t2CuuCanhTrong(true); if (rc.cuu) parts.push(`${rc.cuu} cảnh về ảnh AI`); }
        catch (e){ /* cứu hỏng thì thôi, đừng chặn pipeline */ }
      }
      return { sub: parts.join(', ') || 'xong' };
    },
    thumb: async () => {
      const ti = document.getElementById('t10TitleInput'); const title = topic || job.title || (t9State.result?.titles?.[0] || '');
      if (ti) ti.value = title; await t10Generate();
      if (!(t10State.results || []).length) throw new Error('Thumbnail chưa tạo được (Flow?).');
      // Lưu thumbnail: bản nhỏ vào workData (xem lại trong app) + file đầy đủ ra thư mục video.
      try {
        const first = t10State.results[0];
        if (first && first.dataUrl) {
          const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.thumbUrl = await _shrinkDataUrl(first.dataUrl, 360, 0.72); }
          const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
          if (idir && window.native?.saveFile) { try { await window.native.saveFile({ dir: idir, subdir: _slug(job.title), name: 'thumbnail.png', base64: first.dataUrl }); } catch (e) {} }
        }
      } catch (e) {}
      return { sub: t10State.results.length + ' ảnh' };
    },
    build: async () => { t7Build(); const n = (t7State.clips || []).length; if (!n) throw new Error('Không có cảnh để dựng.'); return { sub: n + ' clip' }; },
    export: async () => {
      if (!(window.native && typeof window.native.renderVideo === 'function')) return { skip: true, sub: 'chỉ desktop' };
      // Nơi lưu RIÊNG của video này (đã ghi lúc thêm); fallback về cài đặt chung nếu job cũ.
      let base = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      const wrap = ((job.saveName != null ? job.saveName : _autoSaveName) || '').trim();
      const mode = job.saveMode || _autoSaveMode || 'perTask';
      if (wrap) base = base ? (base + '/' + _slug(wrap)) : _slug(wrap);
      const nf = _slug(job.title);
      const finalDir = (mode === 'flat') ? base : (base ? (base + '/' + nf) : nf);
      const d = document.getElementById('t7ExpDir'); if (d) d.value = finalDir;
      const nm = document.getElementById('t7ExpName'); if (nm) nm.value = nf;
      await t7DoExport();
      try { const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.exportPath = (finalDir ? finalDir + '/' : '') + nf + '.mp4'; } } catch (e) {}   // nhớ nơi file xuất
      return { sub: (mode === 'flat') ? 'đã xuất' : ('→ ' + nf) };
    },
  };

  for (let i = job.step || 0; i < PROD_STEPS.length; i++) {
    const s = PROD_STEPS[i];
    if (_autoAbort) throw new Error('Đã dừng theo yêu cầu.');
    // Flow đã hết quota trong phiên này → tạm dừng ngay tại bước Flow, không gọi phí thêm.
    if (s.res === 'flow' && _flowExhausted) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(false); const e = new Error('Hết giới hạn Flow'); e.flowQuota = true; throw e; }
    _autoSet(s.key, 'run', 'đang chạy…');
    let res;
    try {
      res = await Promise.race([
        RUN[s.key](),
        new Promise((_, rej) => setTimeout(() => { const e = new Error('Quá giờ (' + Math.round(_stepTO(s.res) / 60000) + ' phút) ở bước ' + s.label); e.timeout = true; rej(e); }, _stepTO(s.res))),
      ]);
    } catch (e) {
      if (e.timeout) { try { if (typeof stopAutoTool2 === 'function') stopAutoTool2(); if (typeof tfStop === 'function') tfStop(); if (typeof requestCancel === 'function') requestCancel(); } catch (_) {} }
      if (s.res === 'flow' && _isQuotaErr(e.message)) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(e.message); q.flowQuota = true; throw q; }
      _autoSet(s.key, 'error', (e.message || 'lỗi').slice(0, 32)); await _persistJob(s.res === 'flow'); throw e;
    }
    if (res && res.quota) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(res.reason || 'Hết giới hạn Flow'); q.flowQuota = true; throw q; }
    if (res && res.skip) { _autoSet(s.key, 'skip', res.sub || 'bỏ qua'); }
    else { _autoSet(s.key, 'done', (res && res.sub) || 'xong'); }
    job.step = i + 1; await _persistJob(s.res === 'flow'); queueRender();
  }
}

function _toggleQueueBtns(running){
  const r = document.getElementById('queueRunBtn'), st = document.getElementById('queueStopBtn');
  if (r) r.style.display = running ? 'none' : ''; if (st) st.style.display = running ? '' : 'none';
}

function _composeHasContent(){
  const sf = document.getElementById('dashStart')?.value || 'script';
  if (sf === 'script') return !!(document.getElementById('dashTopic')?.value || '').trim();
  return !!((_autoScriptText || '').trim() || (state.script || '').trim());
}

function loadApiSettings(){
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
  const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/+$/, '');
  localStorage.setItem('api_provider', provider);
  localStorage.setItem('api_model', model);
  localStorage.setItem(_provKeyName(provider), keys.join('\n'));   // lưu key RIÊNG theo provider
  localStorage.setItem('api_key', keys.join('\n'));               // mirror provider hiện tại (cho code cũ: _apiKeyPool, Tool10 mượn key)
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
}

function updateApiStatus(){
  const provider = localStorage.getItem('api_provider');
  const model = localStorage.getItem('api_model');
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
    el.innerHTML = `<span class="api-status ok"></span> ${PROVIDER_LABEL[provider] || provider} · ${model}${multi}`;
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
  // Key của ĐÚNG provider đang dùng (api_key_<provider>); fallback kho cũ 'api_key' nếu chưa migrate
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const raw = localStorage.getItem(_provKeyName(provider)) || localStorage.getItem('api_key') || '';
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

function _nextApiKey(){
  const pool = _apiKeyPool();
  if (!pool.length) return '';
  const k = pool[_apiKeyIdx % pool.length];
  _apiKeyIdx++;
  return k;
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
  const provider = opts._override?.provider || localStorage.getItem('api_provider') || 'anthropic';
  const model = opts._override?.model || localStorage.getItem('api_model') || MODELS[provider][0].id;
  // Mỗi lần gọi lấy 1 key kế tiếp trong pool → nhiều key sẽ tự chia tải khi chạy song song
  const key = opts._override?.key || _nextApiKey();
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
  const _baseUrl = (localStorage.getItem('api_base_url') || '').trim().replace(/\/+$/, '');   // gateway ngoài (hhtech/gwai…)
  const doCall = () => {
    if (provider === 'anthropic') return callAnthropic(messages, model, key, maxTokens);   // callAnthropic tự đọc Base URL bên trong
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
  return _withRetry(doCall);
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

async function callAnthropic(messages, model, key, maxTokens){
  const body = JSON.stringify({ model, max_tokens: maxTokens, messages });
  const baseUrl = localStorage.getItem('api_base_url') || '';

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

function switchTool(name){
  if (name === 'toollog') { setTimeout(novaLogRender, 0); }
  if (name === 'tooladmin') {
    if (!isAdmin()) return;   // tab admin: chỉ admin
  } else if (name === 'toolsettings') {
    /* trang Cài đặt: luôn cho vào */
  }
  // Free XEM được mọi tool (không chặn ở đây); chặn ở NÚT hành động trong từng tool → hiện thông báo.
  // Studio (TDTStudio nhúng): rời tool → ẩn cửa sổ Qt (tiến trình vẫn sống để mở lại nhanh)
  if (state.tool === 'toolstudio' && name !== 'toolstudio') {
    if (window.TdtStudioPanel && typeof window.TdtStudioPanel.leave === 'function') {
      try { window.TdtStudioPanel.leave(); } catch (e) {}
    }
  }
  // I-MZic: nếu iframe đang ghi video (MediaRecorder) thì CHẶN chuyển tool —
  // Chromium throttle canvas của iframe ẩn → video xuất ra đứng hình giữa chừng.
  if (state.tool === 'toolimzic' && name !== 'toolimzic') {
    const _izFrame = document.getElementById('imzicFrame');
    let _izExporting = false;
    try { _izExporting = !!(_izFrame && _izFrame.contentWindow && _izFrame.contentWindow.__imzicExporting === true); }
    catch (e) { /* iframe chưa nạp / lỗi same-origin — không chặn */ }
    if (_izExporting) {
      if (typeof novaToast === 'function') novaToast('Đang xuất video I-MZic — chờ ghi xong rồi mới chuyển tab (chuyển sớm sẽ làm video đứng hình).');
      return;
    }
  }
  state.tool = name;
  document.querySelectorAll('.nav-item').forEach(t =>
    t.classList.toggle('active', t.dataset.tool === name)
  );
  document.querySelectorAll('.tool').forEach(t =>
    t.classList.toggle('active', t.id === 'tool-' + name)
  );
  // Tool-specific init
  if (name === 'tool2' && typeof renderSceneTypeToggles === 'function') { renderSceneTypeToggles(); if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn(); }
  if (name === 'tooldash' && typeof renderDashboard === 'function') renderDashboard();
  if (name === 'tool6'){ if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); if (typeof tvFlowStatus === 'function') tvFlowStatus(); if (typeof tvLoadModelKeys === 'function') tvLoadModelKeys(); if (typeof tvOnModelChange === 'function') tvOnModelChange(); if (typeof tvSetMode === 'function') tvSetMode(document.getElementById('tvMode')?.value || 'scene'); if (typeof tvRenderVideos === 'function') tvRenderVideos(); }
  if (name === 'tool8' && typeof t8Init === 'function') t8Init();
  if (name === 'tool7' && typeof t7Build === 'function') t7Build();
  if (name === 'toolanim' && typeof animInit === 'function') animInit();   // tab Hoạt Ảnh — nạp kho hiệu ứng chuyển động
  if (name === 'tool9' && typeof t9Init === 'function') t9Init();
  if (name === 'tool9' && typeof t10Init === 'function') t10Init();   // phần Thumbnail giờ nằm trong tab SEO
  if (name === 'tool9' && typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 200);   // bước 2 (thumbnail) chỉ mở khi đã có tiêu đề
  if (name === 'toolniche' && typeof nicheInit === 'function') nicheInit();
  if (name === 'toolflow'){ if (typeof tfInit === 'function') tfInit(); if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); }
  if (name === 'tool2'){ try { t2RenderNguon(); } catch (e) {} }
  if (name === 'toolsettings'){ if (typeof _relocateSettings === 'function') _relocateSettings(); if (typeof tfInit === 'function') tfInit(); if (typeof loadApiSettings === 'function') try { loadApiSettings(); } catch(e){} if (typeof t11Init === 'function') try { t11Init(); } catch(e){} }
  if (name === 'toolvoice'){
    // Ba việc độc lập: OmniVoice có thể chưa cài mà giọng đám mây vẫn phải hiện.
    if (typeof voiceInit === 'function') voiceInit();
    if (typeof giongTaiDS === 'function') giongTaiDS();
    if (typeof giongKiemEngine === 'function') giongKiemEngine();
  }
  if (name === 'toolupscale' && typeof upInit === 'function') upInit();
  if (name === 'toolscript' && typeof tsInit === 'function') tsInit();
  if (name === 'toolvideoagent') {
    if (window.videoAgentPanel && typeof window.videoAgentPanel.init === 'function') {
      window.videoAgentPanel.init();
    }
  }
  if (name === 'toolwhiteboard') {
    const _wbC = document.getElementById('whiteboardRoot');
    if (_wbC && window.WhiteboardPanel && typeof window.WhiteboardPanel.init === 'function') {
      try { window.WhiteboardPanel.init(_wbC); }
      catch (e) { console.error('[whiteboard] init lỗi:', e); }
    }
  }
  if (name === 'toolhanddraw') {
    const _hdC = document.getElementById('handdrawRoot');
    if (_hdC && window.HanddrawPanel && typeof window.HanddrawPanel.init === 'function') {
      try { window.HanddrawPanel.init(_hdC); }
      catch (e) { console.error('[handdraw] init lỗi:', e); }
    }
  }
  if (name === 'toolsrttranslate') {
    const _stC = document.getElementById('srtTranslateRoot');
    if (_stC && window.SrtTranslatePanel && typeof window.SrtTranslatePanel.init === 'function') {
      try { window.SrtTranslatePanel.init(_stC); }
      catch (e) { console.error('[srt-translate] init lỗi:', e); }
    }
  }
  if (name === 'toolimzic') {
    const frame = document.getElementById('imzicFrame');
    const isLoaded = frame && (frame.getAttribute('data-loaded') === '1');
    if (frame && !isLoaded) {
      const target = frame.getAttribute('data-src') || 'img-to-vid.html';
      frame.src = target;
      frame.setAttribute('data-loaded', '1');
    }
    if (frame && frame.style) {
      frame.style.display = 'block';
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.minHeight = '75vh';
    }
  }
  if (name === 'toolstudio') {
    const _tsC = document.getElementById('tdtStudioRoot');
    if (_tsC && window.TdtStudioPanel && typeof window.TdtStudioPanel.init === 'function') {
      try { window.TdtStudioPanel.init(_tsC); }
      catch (e) { console.error('[tdt-studio] init lỗi:', e); }
    }
  }
  if (name === 'tooladmin' && typeof admListUsers === 'function') admListUsers();
  if (name === 'tooladmin' && typeof admRenderDash === 'function') admRenderDash();
  if (typeof _syncChLang === 'function') _syncChLang();   // áp ngôn ngữ kênh vào tool vừa mở
}

function upSetStatus(msg, color){ const el = document.getElementById('upStatus'); if (!el) return; const t = el.querySelector('.up-st-text'); if (t) t.textContent = msg; else el.textContent = msg; el.style.color = color || 'var(--text-muted)'; }

async function upInit(){
  if (!window.native || !window.native.upscaleProbe){ upSetStatus('Chỉ chạy được trong app Nova (Electron).', 'var(--red)'); return; }
  // Khôi phục thiết lập đã lưu
  try {
    const c = JSON.parse(localStorage.getItem('upCfg') || '{}');
    if (c.model) { const _mSel = document.getElementById('upModel'); if ([..._mSel.options].some(o => o.value === c.model)) _mSel.value = c.model; }   // bỏ qua model CŨ đã gỡ (tránh dropdown rỗng → gửi -n '')
    if (c.scale) document.getElementById('upScale').value = c.scale;
    if (c.format) document.getElementById('upFormat').value = c.format;
    if (c.suffix != null) document.getElementById('upSuffix').value = c.suffix;
    if (c.tile) document.getElementById('upTile').value = c.tile;
    if (c.outDir) document.getElementById('upOutDir').value = c.outDir;
  } catch(e){}
  upOnModelChange();
  ['upModel','upScale','upFormat','upSuffix','upTile'].forEach(id => {
    const el = document.getElementById(id); if (el && !el._upBound){ el._upBound = 1; el.addEventListener('change', () => { upSaveCfg(); upRender(); }); }
  });
  if (!upState.wired && window.native.onUpscaleProgress){ upState.wired = true; window.native.onUpscaleProgress(upOnProgress); }
  try {
    const p = await window.native.upscaleProbe();
    if (p && p.ok) upSetStatus('✅ Sẵn sàng — Real-ESRGAN chạy trong máy (GPU), miễn phí & offline.', 'var(--green)');
    else upSetStatus('', '');   // upscaler đã đóng gói sẵn trong app → bỏ cảnh báo "thiếu upscaler-bin"
  } catch(e){ upSetStatus('', ''); }
  upRender();
}

function upSaveCfg(){
  const c = {
    model: document.getElementById('upModel').value || 'remacri-4x',
    scale: document.getElementById('upScale').value,
    format: document.getElementById('upFormat').value,
    suffix: document.getElementById('upSuffix').value,
    tile: document.getElementById('upTile').value,
    outDir: document.getElementById('upOutDir').value
  };
  try { localStorage.setItem('upCfg', JSON.stringify(c)); } catch(e){}
}

function upOnModelChange(){ upSaveCfg(); upRender(); }

async function upPickOutdir(){
  try { const d = await window.native.upscalePickOutdir(); if (d){ document.getElementById('upOutDir').value = d; upSaveCfg(); } } catch(e){}
}

function _upAddItems(list){
  if (!list || !list.length) return;
  const have = new Set(upState.items.map(it => it.path));
  let added = 0;
  list.forEach(f => { if (f && f.path && !have.has(f.path)){ upState.items.push({ id: 'u' + (++upState.seq), path: f.path, name: f.name || f.path, w: f.w || 0, h: f.h || 0, status: 'chờ', pct: 0 }); have.add(f.path); added++; } });
  upRender();
  if (added) upSetStatus('Đã thêm ' + added + ' ảnh.', 'var(--text-muted)');
}

async function upAddImages(){ try { _upAddItems(await window.native.upscalePickImages()); } catch(e){} }

async function upAddFolder(){ try { _upAddItems(await window.native.upscalePickFolder()); } catch(e){} }

function upClear(){ if (upState.running) return; upState.items = []; upRender(); }

function upTargetVal(){ return parseInt(document.getElementById('upScale').value) || 2560; }

function _upFitLong(w, h, T){ if (!w || !h) return null; const ev=n=>Math.max(2,Math.round(n/2)*2); return (w>=h) ? {w:ev(T),h:ev(T*h/w)} : {w:ev(T*w/h),h:ev(T)}; }

function _upDirLabel(p){ if (!p) return ''; const parts = String(p).replace(/\\/g,'/').split('/'); parts.pop(); const tail = parts.slice(-2).join('/'); return tail ? '…/' + tail : ''; }

function upRender(){
  const empty = document.getElementById('upEmpty'), rows = document.getElementById('upRows'), note = document.getElementById('upNote');
  const n = upState.items.length;
  if (!n){ if(rows) rows.innerHTML = ''; if(empty) empty.style.display = 'block'; if(note) note.style.display = 'none'; const sm = document.getElementById('upSummary'); if(sm) sm.textContent = ''; return; }
  if (empty) empty.style.display = 'none';
  const T = upTargetVal();
  rows.innerHTML = upState.items.map((it) => {
    const src = (it.w && it.h) ? (it.w + '×' + it.h) : '—';
    const pred = _upFitLong(it.w, it.h, T);
    const dst = (it.outW && it.outH) ? (it.outW + '×' + it.outH) : (pred ? (pred.w + '×' + pred.h) : '');
    const sizeCol = '<span class="up-size">' + src + (dst ? ' <span class="arw">→</span> <b>' + dst + '</b>' : '') + '</span>';
    let prog;
    if (it.status === 'xong') prog = '<span class="up-st done">✅ Xong</span>';
    else if (it.status === 'lỗi') prog = '<span class="up-st err" title="'+escapeHtml(it.err||'')+'">✖ Lỗi</span>';
    else if (it.status === 'đang chạy') prog = '<span class="up-st run">⏳ Đang xử lý · '+Math.round(it.pct||0)+'%</span><div class="up-bar"><i style="width:'+Math.round(it.pct||0)+'%"></i></div>';
    else prog = '<span class="up-st wait">⋯ Chờ</span>';
    const cmpBtn = (it.status === 'xong' && it.outPath) ? '<button class="btn ghost" onclick="upCompare(\''+it.id+'\')">🔍 So sánh</button>' : '';
    const openBtn = it.outPath ? '<button class="btn ghost" onclick="upOpen(\''+it.id+'\')">Mở</button>' : '';
    const rmBtn = upState.running ? '' : '<button class="btn ghost" style="color:var(--red)" onclick="upRemove(\''+it.id+'\')">✕</button>';
    const thumb = it.thumb ? '<img src="'+it.thumb+'" alt="">' : '<span class="ph">🖼</span>';
    return '<div class="up-row">'
      + '<div class="up-thumb" data-id="'+it.id+'">'+thumb+'</div>'
      + '<div class="up-fname" title="'+escapeHtml(it.path)+'">'+escapeHtml(it.name)+'<span class="path">'+escapeHtml(_upDirLabel(it.path))+'</span></div>'
      + '<div>'+sizeCol+'</div>'
      + '<div class="up-prog">'+prog+'</div>'
      + '<div class="up-rowbtns">'+cmpBtn+openBtn+rmBtn+'</div>'
      + '</div>';
  }).join('');
  const done = upState.items.filter(x => x.status === 'xong').length;
  const err = upState.items.filter(x => x.status === 'lỗi').length;
  const running = upState.items.filter(x => x.status === 'đang chạy').length;
  let sum = 'Xong ' + done + '/' + n;
  if (running) sum += ' · ' + running + ' đang chạy';
  if (err) sum += ' · Lỗi ' + err;
  const smEl = document.getElementById('upSummary'); if (smEl) smEl.textContent = sum;
  if (note) note.style.display = done ? 'block' : 'none';
  // Thanh thao tác hàng loạt — chỉ hiện khi có việc để làm & không đang chạy.
  const retryBtn = document.getElementById('upRetryBtn'), clearDoneBtn = document.getElementById('upClearDoneBtn'), bar = document.getElementById('upBatchBar');
  const showRetry = err > 0 && !upState.running, showClear = done > 0 && !upState.running;
  if (retryBtn){ retryBtn.style.display = showRetry ? 'inline-flex' : 'none'; retryBtn.textContent = '↻ Thử lại ảnh lỗi (' + err + ')'; }
  if (clearDoneBtn){ clearDoneBtn.style.display = showClear ? 'inline-flex' : 'none'; clearDoneBtn.textContent = '🧹 Xoá ảnh đã xong (' + done + ')'; }
  if (bar) bar.style.display = (showRetry || showClear) ? 'flex' : 'none';
  _upLoadThumbs();
}

function upClearDone(){ if (upState.running) return; upState.items = upState.items.filter(x => x.status !== 'xong'); upRender(); }

function upRetryErrors(){ if (upState.running) return; const errs = upState.items.filter(x => x.status === 'lỗi'); if (!errs.length) return; errs.forEach(x => { x.status = 'chờ'; x.pct = 0; x.err = ''; }); upRun(); }

function _upShrink(dataUrl, max){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ url: cv.toDataURL('image/jpeg', 0.72), w: img.width, h: img.height });
      } catch(e){ resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function _upLoadThumbs(){
  if (_upThumbBusy || !window.native?.readFileB64) return;
  const next = upState.items.find(x => !x.thumb && !x._thumbFail);
  if (!next) return;
  _upThumbBusy = true;
  try {
    const r = await window.native.readFileB64(next.path);
    const small = (r && r.dataUrl) ? await _upShrink(r.dataUrl, 128) : null;   // ảnh gốc bị bỏ ngay sau khi thu nhỏ (không gán vào state)
    if (small){
      next.thumb = small.url;
      if (!next.w && small.w){ next.w = small.w; next.h = small.h; }            // lấy luôn kích thước gốc nếu chưa biết
      const el = document.querySelector('.up-thumb[data-id="'+next.id+'"]'); if (el) el.innerHTML = '<img src="'+small.url+'" alt="">';
    } else next._thumbFail = true;
  } catch(e){ next._thumbFail = true; }
  _upThumbBusy = false;
  _upLoadThumbs();
}

function upRemove(id){ if (upState.running) return; upState.items = upState.items.filter(x => x.id !== id); upRender(); }

function upOpen(id){ const it = upState.items.find(x => x.id === id); if (it && it.outPath && window.native.openPath) window.native.openPath(it.outPath); }

async function upCompare(id){
  const it = upState.items.find(x => x.id === id);
  if (!it || !it.outPath || !window.native?.readFileB64) return;
  let beforeU, afterU;
  try { const [a, b] = await Promise.all([window.native.readFileB64(it.path), window.native.readFileB64(it.outPath)]); beforeU = a && a.dataUrl; afterU = b && b.dataUrl; } catch (e) {}
  if (!beforeU || !afterU) { alert('Không đọc được ảnh để so sánh.'); return; }
  document.getElementById('upCmpModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'upCmpModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px';
  wrap.innerHTML =
    '<div style="color:#fff;font-size:13px;font-weight:600">' + escapeHtml(it.name) + ' · ' + (it.w || '?') + '×' + (it.h || '?') + ' → ' + (it.outW || '?') + '×' + (it.outH || '?') + '</div>' +
    '<div id="upCmpStage" style="position:relative;line-height:0;max-width:92vw;max-height:78vh;overflow:hidden;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5);cursor:ew-resize;user-select:none">' +
      '<img id="upCmpAfter" src="' + afterU + '" style="display:block;max-width:92vw;max-height:78vh;width:auto;height:auto">' +
      '<div id="upCmpBox" style="position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden">' +
        '<img id="upCmpBefore" src="' + beforeU + '" style="position:absolute;top:0;left:0;height:100%;width:auto;max-width:none">' +
      '</div>' +
      '<div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:6px">TRƯỚC</div>' +
      '<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:6px">SAU</div>' +
      '<div id="upCmpDiv" style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:#fff;transform:translateX(-1px);pointer-events:none"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.4)">⇔</div></div>' +
    '</div>' +
    '<div style="color:#aaa;font-size:11.5px">Kéo thanh chia để so sánh · bấm nền tối hoặc ESC để đóng</div>';
  document.body.appendChild(wrap);
  const stage = wrap.querySelector('#upCmpStage'), box = wrap.querySelector('#upCmpBox'), div = wrap.querySelector('#upCmpDiv');
  const setPct = (pct) => { pct = Math.max(0, Math.min(100, pct)); box.style.width = pct + '%'; div.style.left = pct + '%'; };
  let dragging = false;
  const onMove = (e) => { if (!dragging) return; const r = stage.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; setPct(cx / r.width * 100); };
  stage.addEventListener('mousedown', (e) => { dragging = true; onMove(e); e.preventDefault(); });
  window.addEventListener('mousemove', onMove);
  const stopDrag = () => { dragging = false; };
  window.addEventListener('mouseup', stopDrag);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { wrap.remove(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', stopDrag); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
}

function upOnProgress(s){
  if (!s || !s.id) return;
  const it = upState.items.find(x => x.id === s.id);
  if (!it) return;
  if (s.type === 'start'){ it.status = 'đang chạy'; it.pct = 0; }
  else if (s.type === 'tick'){ it.status = 'đang chạy'; it.pct = s.percent || 0; }
  else if (s.type === 'done'){ it.status = 'xong'; it.pct = 100; it.outPath = s.outPath; it.outW = s.w; it.outH = s.h; }
  else if (s.type === 'error'){ it.status = 'lỗi'; it.err = s.message || ''; }
  upRender();
}

async function upRun(){
  if (upState.running) return;
  if (!upState.items.length){ upSetStatus('Chưa có ảnh để nâng cấp.', 'var(--red)'); return; }
  const todo = upState.items.filter(it => it.status !== 'xong');   // bỏ qua ảnh đã nâng xong (khỏi làm lại)
  if (!todo.length){ upSetStatus('Tất cả ảnh đã nâng xong rồi.', 'var(--text-muted)'); return; }
  upSaveCfg();
  const payload = {
    items: todo.map(it => ({ id: it.id, path: it.path })),
    outputDir: document.getElementById('upOutDir').value || '',
    suffix: document.getElementById('upSuffix').value || '_upscaled',
    model: document.getElementById('upModel').value || 'remacri-4x',
    target: upTargetVal(),
    tile: parseInt(document.getElementById('upTile').value) || 0,
    format: document.getElementById('upFormat').value,
    // Xoá dấu ✦ Nano-Banana trước khi nâng cấp (cùng thuật toán Canvas ở tab Tạo Ảnh — không cần Python).
    removeWatermark: !!document.getElementById('upWm')?.checked,
    wmOnly: !!document.getElementById('upWmOnly')?.checked
  };
  upState.items.forEach(it => { if (it.status !== 'xong'){ it.status = 'chờ'; it.pct = 0; } });
  upState.running = true;
  document.getElementById('upRunBtn').style.display = 'none';
  document.getElementById('upStopBtn').style.display = 'inline-flex';
  upSetStatus(payload.wmOnly ? '⏳ Đang xoá watermark ✦ (giữ nguyên cỡ, không nâng cấp)…' : (payload.removeWatermark ? '⏳ Đang xoá dấu ✦ rồi nâng cấp… (chạy trong máy, không gửi ảnh lên mạng)' : '⏳ Đang nâng cấp… (chạy bằng GPU trong máy, không gửi ảnh lên mạng)'), 'var(--violet,#7c5cff)');
  upRender();
  try {
    const r = await window.native.upscaleRun(payload);
    if (r && r.error) upSetStatus('Lỗi: ' + r.error, 'var(--red)');
    else {
      const done = upState.items.filter(x => x.status === 'xong').length;
      upSetStatus('✅ Hoàn tất — ' + done + '/' + upState.items.length + ' ảnh đã nâng cấp.', 'var(--green)');
      // Đẩy ảnh HD về Phân Cảnh nếu có ảnh lấy từ Tool 2 và bật tuỳ chọn.
      const hasScene = upState.items.some(x => x.sceneId && x.status === 'xong');
      if (hasScene && document.getElementById('upPushBack')?.checked){ try { await upPushBackToScenes(); } catch(e){} }
    }
  } catch(e){ upSetStatus('Lỗi: ' + (e.message || e), 'var(--red)'); }
  upState.running = false;
  document.getElementById('upRunBtn').style.display = 'inline-flex';
  document.getElementById('upStopBtn').style.display = 'none';
  upRender();
}

async function upStop(){ try { await window.native.upscaleCancel(); } catch(e){} upSetStatus('Đã dừng.', 'var(--text-muted)'); }

async function upFromTool2(){
  const scenes = (typeof state === 'object' && state.scenes) || [];
  if (!scenes.length){ upSetStatus('Chưa có cảnh nào ở tab Phân Cảnh (Tool 2).', 'var(--red)'); return; }
  if (!window.native || !window.native.saveFile){ upSetStatus('Chỉ chạy được trong app Nova.', 'var(--red)'); return; }
  let baseDir = document.getElementById('upOutDir').value;
  if (!baseDir){ try { baseDir = await window.native.exportDir(); } catch(e){} }
  if (!baseDir){ upSetStatus('Chọn "Thư mục lưu" trước khi lấy ảnh từ Phân Cảnh.', 'var(--red)'); return; }
  const dimOf = (durl) => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 0, h: 0 }); im.src = durl; });
  const have = new Set(upState.items.map(x => x.sceneKey).filter(Boolean));
  let added = 0, skip = 0;
  upSetStatus('Đang lấy ảnh từ Phân Cảnh…', 'var(--text-muted)');
  for (const s of scenes){
    for (const v of ['A', 'B']){
      const rec = (v === 'B' ? state.sceneImagesB : state.sceneImages)?.[s.id];
      if (!rec || !rec.base64) continue;
      const key = s.id + '|' + v;
      if (have.has(key)){ skip++; continue; }
      const dim = await dimOf(rec.base64);
      const ext = ((rec.mediaType || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
      const name = s.id + (v === 'B' ? 'b' : '') + '.' + ext;
      try {
        const r = await window.native.saveFile({ dir: baseDir, subdir: '_nova_upscale_src', name, base64: rec.base64 });
        if (r && r.path){
          upState.items.push({ id: 'u' + (++upState.seq), path: r.path, name: 'Cảnh ' + s.id + (v === 'B' ? ' · B' : ''), w: dim.w, h: dim.h, status: 'chờ', pct: 0, sceneId: s.id, variant: v, sceneKey: key });
          have.add(key); added++;
        }
      } catch(e){}
    }
  }
  upRender();
  if (added) upSetStatus('✅ Đã lấy ' + added + ' ảnh cảnh từ Phân Cảnh.' + (skip ? (' Bỏ qua ' + skip + ' ảnh đã có trong danh sách.') : '') + ' Bấm NÂNG CẤP để phóng to.', 'var(--green)');
  else upSetStatus(skip ? 'Mọi ảnh cảnh đã có trong danh sách rồi.' : 'Các cảnh hiện chưa có ảnh để lấy (tạo ảnh ở Phân Cảnh trước).', 'var(--text-muted)');
}

async function upPushBackToScenes(){
  const items = upState.items.filter(it => it.sceneId && it.variant && it.status === 'xong' && it.outPath);
  if (!items.length) return;
  let n = 0;
  for (const it of items){
    try {
      const r = await window.native.readFileB64(it.outPath);
      if (!r || !r.dataUrl) continue;
      const store = it.variant === 'B' ? 'sceneImagesB' : 'sceneImages';
      if (!state[store]) state[store] = {};
      const ext = (it.outPath.split('.').pop() || 'png').toLowerCase().replace('jpg', 'jpeg');
      state[store][it.sceneId] = { base64: r.dataUrl, mediaType: 'image/' + ext, fileName: (it.name || it.sceneId) + '_up' };
      if (typeof _t7NotifyImage === 'function') _t7NotifyImage(it.sceneId);
      n++;
    } catch(e){}
  }
  if (n){
    try { if (typeof renderTable === 'function') renderTable(); } catch(e){}
    try { if (typeof saveState === 'function') saveState(true); } catch(e){}
    upSetStatus('✅ Đã đẩy ' + n + ' ảnh HD về Phân Cảnh → Dựng Video sẽ dùng ảnh nâng cấp khi xuất video.', 'var(--green)');
  }
}

function setStatusScript(msg, type){
  const el = document.getElementById('statusScript'); if (!el) return;
  const c = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' };
  el.textContent = msg; el.style.color = c[type] || c.info;
}

function _tsClean(t){
  let s = String(t || '').trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();          // bỏ code fence
  // Bỏ câu dẫn/preamble AI hay chèn ở ĐẦU (vd "The script is complete at 4,420 words. Here it is:")
  for (let k = 0; k < 3; k++) {
    const before = s;
    s = s.replace(/^\s*(?:[^\n]*\b(?:the script is|here(?:'s| is)\b[^\n]*\bscript|here it is|below is\b[^\n]*\bscript|word count|final script)\b[^\n]*|đây là[^\n]*kịch bản[^\n]*|kịch bản[^\n]*(?:hoàn chỉnh|của bạn|đây)[^\n]*|dưới đây là[^\n]*)\r?\n+/i, '').trim();
    if (s === before) break;
  }
  s = s.replace(/^\s*(kịch bản|voiceover|lời đọc|tiêu đề|title|script)\s*[:：].*$/gim, '').trim();  // bỏ dòng nhãn
  s = s.replace(/^\s*#{1,6}\s+/gm, '');                                    // bỏ heading markdown
  s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');       // bỏ đậm/nghiêng
  s = s.replace(/^\s*\[[^\]]+\]\s*/gm, '');                                // bỏ [Intro]/[Hook]
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function _tsNovelArchitect(o){
  const prompt =
`You are the story ARCHITECT for a long multi-chapter faceless YouTube voiceover script.
TOPIC: "${o.topic}". LANGUAGE: ${o.lang}. TONE: ${o.tone}. TOTAL: about ${o.words} words, split into ${o.n} chapters of ~${o.chWords} words each.
${o.style ? 'CHANNEL STYLE (voice & tone only; ignore any word counts inside it):\n' + o.style.replace(/\{\{\s*WORDS\s*\}\}/gi, String(o.words)) + '\n' : ''}${o.rewrite ? 'Design a DIFFERENT angle and a different opening twist than the obvious approach.\n' : ''}
Design the skeleton so later chapters CAN stay consistent with earlier ones.
Return ONLY raw JSON, EXACTLY these keys:
{"premise":"1-2 câu tiền đề","ending":"hướng kết cục (mở/đóng) + cảm xúc cuối","characters":[{"name":"","role":"","description":"1 câu"}],"threads":[{"id":"T1","name":"","description":"1 câu"}],"chapters":[{"title":"","goal":"1 câu — chương này đạt được gì để mạch truyện tiến","words":${o.chWords}}]}
Rules: 3-7 characters (tên theo ${o.lang}), 3-6 threads (id T1,T2,…), EXACTLY ${o.n} chapters. Threads mở/đẩy/khép dần qua các chương — chương cuối khép các tuyến chính.`;
  return await callLLMJson(prompt, { maxTokens: 2200, tries: 3,
    validate: (d) => d && typeof d === 'object' && !Array.isArray(d)
      && Array.isArray(d.chapters) && d.chapters.length >= 2
      && Array.isArray(d.characters) && Array.isArray(d.threads) });
}

function _tsNovelMemBlock(mem){
  const parts = [];
  const n = mem.chapters.length;
  if (!n) parts.push('(Chưa có chương nào đã viết — đây là chương đầu tiên.)');
  mem.chapters.forEach((c, i) => {
    const s = String(c.summary || '').trim() || '(trống)';
    parts.push(`- (Ch.${i + 1}${c.title ? ' · ' + c.title : ''}) `
      + (i >= n - 3 ? s : (s.split(/(?<=[.!?…])\s+/)[0] || s)));
  });
  const states = Object.keys(mem.states).map((k) => {
    const byField = {};
    mem.states[k].forEach((c) => { if (c.field) byField[c.field] = c; });
    const s = Object.values(byField).map((c) => `${c.field}=${c.to}`).join('; ');
    return `- ${k}: ${s || '(chưa đổi trạng thái)'}`;
  });
  const threads = mem.threads.map((t) =>
    `- ${t.id}${t.name && t.name !== t.id ? ' · ' + t.name : ''}: [${t.status}] ${t.note || ''}`);
  return ['--- STORY MEMORY (bắt buộc nhất quán, không mâu thuẫn) ---',
    'DIỄN BIẾN ĐẾN NAY (3 chương gần nhất đầy đủ, chương cũ nén 1 câu):', ...parts,
    ...(states.length ? ['NHÂN VẬT & TRẠNG THÁI HIỆN TẠI (giá trị mới nhất từng trường):', ...states] : []),
    ...(threads.length ? ['TUYẆN NỘI DUNG (open=chưa khép, advanced=đã đẩy, resolved=đã khép):', ...threads] : []),
  ].join('\n');
}

function _tsNovelChapterPrompt(o, bible, mem, ch, i){
  const chars = (bible.characters || []).map((c) => `${c.name} (${c.role || '?'}) — ${c.description || ''}`).join('; ');
  return `You are a professional voiceover scriptwriter for faceless YouTube videos, writing ONE chapter of a multi-chapter story.
TASK: Write ONLY chapter ${i + 1} of ${o.n} — "${ch.title}". CHAPTER GOAL: ${ch.goal || '(theo mạch truyện)'}.
LANGUAGE: ${o.lang}. TONE: ${o.tone}. LENGTH: about ${ch.words} words (max 10% deviation).
${o.style ? 'CHANNEL STYLE (giọng văn; quy tắc LENGTH dưới đây đè lên mọi số từ trong style):\n' + o.style.replace(/\{\{\s*WORDS\s*\}\}/gi, String(ch.words)) + '\n' : ''}
STORY BIBLE (khung cố định):
- Tiền đề: ${bible.premise || ''}
- Hướng kết cục: ${bible.ending || ''}
- Nhân vật: ${chars || '(tự định hình ít nhân vật)'}
${_tsNovelMemBlock(mem)}
ABSOLUTE CONSISTENCY (quan trọng nhất):
- Tên, quan hệ, địa điểm, sự kiện PHẢI khớp STORY MEMORY ở trên. Không đặt lại tên nhân vật, không hồi sinh/hồi vị trí vô lý, không kể lại sự kiện đã xảy ra như thể mới.
- Chương ${i === 0 ? '1: mở bằng hook ≤ 15 từ, trồng 1 câu hỏi/mâu thuẫn mở (open loop)' : (i + 1) + ': mở đầu nối mạch chương trước, KHÔNG tóm lại chương cũ'}.
- Tuyến còn [open] thì chỉ ĐẨY TIẾN (thêm chi tiết mới, không lặp nguyên văn), chưa khép; khép các tuyến chính ở chương cuối.
- Mỗi đoạn chỉ tiến THÊM 1 điều mới (biến cố/con số/hậu quả); cấm diễn giải lại ý cũ bằng lời khác.
RETENTION:
- Cấm: "ít ai biết rằng", xưng hô khán giả ("các bạn ơi"), kết kiểu đạo lý.
OUTPUT RULES (very important):
- Return ONLY the narration text of THIS chapter. First character = first letter of the opening sentence.
- No chapter titles, no numbering, no [labels], no markdown, no emoji, no lead-in, no word counts.
- Chia đoạn ngắn 2-4 câu, dễ đọc cho TTS.`;
}

async function _tsNovelRemember(chText, bible, mem, i){
  const prompt =
`You are the STORY CONTINUITY EDITOR. Chapter ${i + 1} was just written. Extract memory updates for future chapters.
Return ONLY raw JSON, EXACTLY these keys:
{"summary":"3-5 câu tóm tắt chương này (tiếng Việt, kể đủ biến cố chính)","stateChanges":[{"entity":"","field":"location|status|relation|knowledge|possession|alive|khác","from":"","to":"","reason":""}],"threads":[{"id":"T1","status":"open|advanced|resolved","note":"1 câu"}]}
Rules: stateChanges CHỈ ghi thay đổi THẬT so với MEMORY cũ (không lặp lại trạng thái chưa đổi). threads: chỉ tuyến được mở/đẩy/khép trong chương này, giữ nguyên id.

STORY BIBLE (tham chiếu):
- Tiền đề: ${String(bible.premise || '').slice(0, 400)}
- Tuyến đã biết: ${(mem.threads || []).map((t) => t.id).join(', ') || '(chưa có)'}

MEMORY HIỆN TẠI:
${_tsNovelMemBlock(mem)}

CHƯƠNG VỪA VIẾT:
${chText.slice(0, 9000)}`;
  return await callLLMJson(prompt, { maxTokens: 900, tries: 2,
    validate: (d) => d && typeof d === 'object' && typeof d.summary === 'string' && d.summary.trim().length > 20 });
}

function _tsNovelMerge(mem, up, chTitle){
  mem.chapters.push({ title: String(chTitle || ''), summary: String(up.summary || '').trim() });
  (Array.isArray(up.stateChanges) ? up.stateChanges : []).forEach((c) => {
    const k = String((c && c.entity) || '').trim(); if (!k) return;
    (mem.states[k] = mem.states[k] || []).push({
      field: String((c && c.field) || '').trim() || 'status',
      to: String((c && (c.to ?? c.new_value)) || '').trim(),
      reason: String((c && c.reason) || '').trim(),
    });
  });
  (Array.isArray(up.threads) ? up.threads : []).forEach((t) => {
    const id = String((t && t.id) || '').trim().toUpperCase(); if (!id) return;
    const cur = mem.threads.find((x) => x.id === id);
    if (cur){ if (t.status) cur.status = String(t.status); if (t.note) cur.note = String(t.note); }
    else mem.threads.push({ id, name: id, status: String((t && t.status) || 'open'), note: String((t && t.note) || '') });
  });
}

function _fmtDur(s){ return s < 60 ? s + ' giây' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' phút'; }

function _startElapsed(label, setter, hint){
  let sec = 0;
  const tick = () => { sec += 1; try { setter(label + '… ' + _fmtDur(sec) + (sec >= 15 && hint ? ' · ' + hint : ''), 'working'); } catch (e){} };
  tick();
  return setInterval(tick, 1000);
}

function _stopElapsed(h){ try { clearInterval(h); } catch (e){} }

function _tsWordCount(t){ return (String(t || '').trim().match(/\S+/g) || []).length; }

async function voiceInit(){
  const st = document.getElementById('voiceBackendStatus');
  if (!window.native?.voiceStart){
    if (st) st.innerHTML = '<span style="color:var(--red)">Chỉ dùng được trong app desktop.</span>';
    return;
  }
  // Xác minh backend còn sống (không chỉ dựa cờ cũ — phòng khi backend đã tắt/khởi động lại).
  const cur = await window.native.voiceStatus().catch(() => null);
  if (cur?.running){ _voiceReady = true; if (cur?.url) VOICE_URL = cur.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice · VieNeu · XTTS)</span>'; voiceLoadVoices(); voiceHWNap(); return; }
  _voiceReady = false;
  // Đã cài backend trên máy chưa? (thay vì báo lỗi đỏ → hiện panel hướng dẫn cài)
  const pb = window.native.voiceProbe ? await window.native.voiceProbe().catch(() => null) : null;
  if (pb && !pb.hasRoot){ voiceShowSetup('need-install'); return; }
  if (pb && pb.hasRoot && !pb.hasPython){ voiceShowSetup('need-python'); return; }
  // Có backend → tự khởi động (im lặng) khi mở tab.
  if (st) st.innerHTML = '⏳ Đang khởi động backend giọng nói (OmniVoice · VieNeu · XTTS)… lần đầu ~30-60s, giữ app mở.';
  if (!_voiceStarting) _voiceStarting = window.native.voiceStart();
  const r = await _voiceStarting; _voiceStarting = null;
  if (r?.ok){ _voiceReady = true; if (r?.url) VOICE_URL = r.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice · VieNeu · XTTS)</span>'; voiceLoadVoices(); voiceHWNap(); }
  else if (st) st.innerHTML = '<span style="color:var(--red)">Lỗi khởi động: ' + escapeHtml(r?.error || '') + '</span>';
}

async function voiceHWNap(){
  if (!_voiceReady) return;
  try {
    const h = await _giongFetchJson(VOICE_URL + '/api/hardware');
    if (!h || !h.profile) return;
    _voiceHW = h;
    const st = document.getElementById('voiceBackendStatus');
    if (st && /sẵn sàng/.test(st.textContent || '')){
      const chip = h.device === 'cuda'
        ? ' · ' + (h.gpu || 'GPU') + (h.vram_gb ? ' ' + h.vram_gb + 'GB' : '') + ' 🚀'
        : (h.device === 'xpu' ? ' · ' + (h.gpu || 'Intel GPU') + ' 🚀'
        : (h.device === 'mps' ? ' · Apple GPU' : ' · CPU ' + (h.cpu_cores || '?') + ' nhân'));
      st.innerHTML += '<span style="color:var(--text-dim)">' + escapeHtml(chip) + '</span>';
    }
    if (h.profile !== 'gpu' && _voiceBackendMacDinh && _voiceBackend === 'omni'){
      _voiceBackend = 'vieneu';
      _voiceBackendMacDinh = false;   // đã chủ đích chọn theo phần cứng — health không đè lại
      try { novaLog('🎙 máy không có GPU → mặc định VieNeu (ONNX CPU, nhanh hơn OmniVoice trên CPU)'); } catch (_){}
      voiceBackendVe(); try { giongVe(); giongVeThanh(); } catch (_){}
    }
  } catch (_){}   // backend cũ chưa có /api/hardware → dùng mặc định 400/400
  voicePrewarm();   // nạp sẵn model engine đang chọn → lần đọc đầu không phải chờ tải model
}

async function voicePrewarm(){
  try {
    const eng = _TTS_BACKEND_ID[_voiceBackend] || 'omnivoice';
    await _giongFetchJson(VOICE_URL + '/api/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: eng }),
    });
  } catch (_){}
}

function voiceShowSetup(kind){
  const st = document.getElementById('voiceBackendStatus');
  if (!st) return;
  const needPy = kind === 'need-python';
  const msg = needPy
    ? 'Đã tìm thấy thư mục voice-studio nhưng <b>chưa cài môi trường Python</b>. Mở voice-studio và chạy file cài đặt <b>setup-omni</b> (cài đủ cả 3 engine: OmniVoice · VieNeu · XTTS) một lần, rồi bấm “Kiểm tra lại”.'
    : 'Giọng nói AI chạy <b>ngay trên máy bạn</b> (đọc bao nhiêu cũng miễn phí), gồm đủ 3 engine <b>OmniVoice · VieNeu · XTTS</b>. Bấm <b>“Cài backend vào máy”</b> — app tự cài vào thư mục của app, <b>không cần chọn nơi lưu</b>. Chỉ cài một lần là xong.';
  st.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:720px">
      <div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px">🎙 Cài backend giọng nói (OmniVoice · VieNeu · XTTS) trên máy</div>
      <div style="font-size:12.8px;color:var(--text-muted);line-height:1.65;margin-bottom:12px">${msg}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary sm" onclick="voiceInstallBackend()">📥 Cài backend vào máy</button>
        <button class="btn ghost sm" onclick="voicePickRoot()">📁 Đã cài nơi khác — chọn thư mục</button>
        <button class="btn ghost sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
      </div>
    </div>`;
}

async function voiceInstallBackend(){
  if (!window.native?.voiceInstallBackend){ voicePickRoot(); return; }
  const st = document.getElementById('voiceBackendStatus');
  if (st) st.innerHTML = '⏳ Đang chép backend ra máy…';
  const r = await window.native.voiceInstallBackend().catch(() => null);
  if (r?.ok){
    if (st) st.innerHTML = `
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:760px">
        <div style="font-weight:800;color:var(--green);margin-bottom:6px">✓ Đã chép backend vào máy</div>
        <div style="font-size:12.8px;color:var(--text-muted);line-height:1.7">
          Thư mục: <code style="background:var(--surface-3);padding:2px 6px;border-radius:5px">${escapeHtml(r.path)}</code> (đã mở sẵn).<br>
          <b>Bước tiếp — cài Python + model (1 lần):</b> vào thư mục đó, chạy
          <b>setup-omni.bat</b> (Windows) hoặc <b>setup-omni.command</b> (Mac) — cài đủ cả 3 engine
          <b>OmniVoice · VieNeu · XTTS</b> (nặng ~2GB, chờ vài phút). Xong bấm <b>🔄 Kiểm tra lại</b>.<br>
          <span style="color:var(--text-dim)">Chi tiết xem file HUONG-DAN-KHACH.md trong thư mục đó.</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primary sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
        </div>
      </div>`;
  } else if (r && !r.canceled){
    if (st) st.insertAdjacentHTML('beforeend', '<div style="color:var(--red);font-size:12px;margin-top:8px">' + escapeHtml(r.error || 'Lỗi cài đặt') + '</div>');
  }
}

async function voicePickRoot(){
  if (!window.native?.voicePickRoot) return;
  const r = await window.native.voicePickRoot().catch(() => null);
  if (r?.ok){ voiceInit(); return; }
  if (r && r.error){ const st = document.getElementById('voiceBackendStatus'); if (st) st.insertAdjacentHTML('beforeend', '<div style="color:var(--red);font-size:12px;margin-top:8px">' + escapeHtml(r.error) + '</div>'); }
}

async function _giongFetchJson(url, opt){
  const r = await fetch(url, opt);
  const data = await r.json().catch(() => null);
  if (!r.ok){
    let d = data && (data.detail || data.error || data.message);
    if (Array.isArray(d)) d = (d[0] && (d[0].msg || d[0].detail)) || '';
    const msg = (typeof d === 'string' && d) ? d : ('HTTP ' + r.status);
    throw new Error(msg);
  }
  return data || {};
}

async function giongTaiDS(){
  const ds = [];
  let taiThanhCong = false;
  try {
    const data = await _giongFetchJson(VOICE_URL + '/api/voices');
    const list = Array.isArray(data) ? data : (data.voices || []);
    for (const v of list){
      // Voice factory cũng phải hiện tên trong UI. Trước đây continue ở đây làm
      // danh sách trống dù backend đã seed thành công các voice có sẵn.
      const factory = !!v.is_factory;
      const thietKe = !!(v.attributes && v.attributes.instruct);
      const builtin = !!(v.attributes && v.attributes.voice);
      ds.push({
        key: 'omni:' + v.id, id: v.id, name: v.name || v.id,
        src: factory ? 'Giọng có sẵn' : (thietKe ? 'Thiết kế từ mô tả' : 'Clone từ mẫu'),
        kind: factory ? 'san' : (thietKe ? 'design' : 'clone'),
        tags: (v.tags || []).slice(0, 3),
        lang: (v.attributes && v.attributes.lang) || 'vi',
        // Engine "gốc" của giọng, suy từ nguồn: built-in (attributes.voice) →
        // VieNeu; thiết kế (attributes.instruct) → OmniVoice; clone WAV →
        // OmniVoice (XTTS cũng đọc được clone nhưng OmniVoice là gốc).
        engine: builtin ? 'vieneu' : 'omni',
        factory,
      });
    }
    taiThanhCong = true;
  } catch (e){ /* backend tạm thời chưa lên — giữ danh sách đang dùng */ }
  // Không xoá thư viện/selection đang hiện chỉ vì một lần reload gặp backend lỗi.
  // Lần khởi tạo đầu vẫn giữ [] để UI hiển thị đúng trạng thái rỗng.
  if (taiThanhCong) _giongDS = ds;
  if (!_giongDS.some(v => v.key === _giongChon)) _giongChon = (_giongDS[0] || {}).key || '';
  giongVe();
}

function _giongHop(v){
  if (_giongLoc === '*') return true;
  if (_giongLoc.startsWith('e:')) return v.engine === _giongLoc.slice(2);
  if (_giongLoc.startsWith('k:')) return v.kind === _giongLoc.slice(2);
  return (v.tags || []).includes(_giongLoc);
}

function giongVe(){
  const box = document.getElementById('giongLuoi');
  const chips = document.getElementById('giongChips');
  if (!box) return;

  if (chips){
    const dem = f => _giongDS.filter(v => { const c = _giongLoc; _giongLoc = f; const k = _giongHop(v); _giongLoc = c; return k; }).length;
    const muc = [['*', 'Tất cả']];
    for (const [k, t] of [['k:clone','Clone'],['k:design','Thiết kế']]) if (_giongDS.some(v => v.kind === k.slice(2))) muc.push([k, t]);
    const nhan = {};
    for (const v of _giongDS) for (const t of (v.tags || [])) nhan[t] = (nhan[t] || 0) + 1;
    for (const t of Object.keys(nhan).sort((a,b) => nhan[b] - nhan[a]).slice(0, 4)) muc.push([t, t]);
    chips.innerHTML = muc.map(([f, t]) =>
      `<div class="gchip${f === _giongLoc ? ' on' : ''}" onclick="giongDatLoc('${escapeHtml(f)}')">${escapeHtml(t)}<span class="c">${dem(f)}</span></div>`).join('');
  }

  const hien = _giongDS.filter(_giongHop);
  box.innerHTML = hien.map(v => {
    const chon = v.key === _giongChon, dangPhat = v.key === _giongPhat;
    return `<div class="gcard${chon ? ' sel' : ''}${dangPhat ? ' play' : ''}${v.factory ? '' : ' has-del'}" onclick="giongBam('${escapeHtml(v.key)}')">
      ${v.factory ? '' : `<button type="button" class="btn sm ghost gdel" onclick="event.stopPropagation();giongXoa('${escapeHtml(v.key)}')" title="Xoá giọng clone" aria-label="Xoá giọng">Xóa</button>`}
      <div class="gtop">
        <span class="gpico">${_giongTao === v.key ? '⏳' : (dangPhat ? '❙❙' : '▶')}</span>
        <div style="min-width:0"><div class="gname">${escapeHtml(v.name)}</div><div class="gsrc">${escapeHtml(v.src)}</div></div>
      </div>
      <div class="gtags">${(v.tags || []).map(t => `<span class="gtg">${escapeHtml(t)}</span>`).join('')}</div>
    </div>`;
  }).join('') + `<div class="gadd" onclick="giongThemBat()">＋ Thêm giọng</div>`;

  const n = document.getElementById('giongDem'); if (n) n.textContent = _giongDS.length + ' giọng';
  const cur = _giongDS.find(v => v.key === _giongChon);
  const lb = document.getElementById('giongDangChon');
  if (lb) lb.textContent = cur ? (cur.name + ' · ' + _TTS_TEN[_voiceBackend]) : 'chưa chọn giọng';
  try { giongDDVe(); } catch (e){}   // dropdown "Giọng đọc" dưới cũng chạy theo thư viện
  try { giongLibVe(); } catch (e){}  // dropdown "Thư viện giọng" phía trên cũng vậy
  giongVeThanh();
}

function giongDatLoc(f){ _giongLoc = f; giongVe(); }

function giongVeThanh(){
  // VieNeu Turbo chưa nhận tham số tốc độ, và chỉ đọc tiếng Việt —
  // mờ phần tương ứng khi chọn VieNeu, KHÔNG giấu (đúng triết lý tab này).
  const vi = _voiceBackend === 'vieneu';
  const el = document.getElementById('slTocDo');
  if (el) el.classList.toggle('off', vi);
  const wy = document.getElementById('whyTocDo');
  if (wy) wy.textContent = vi ? 'VieNeu Turbo chưa hỗ trợ tốc độ' : '';
  const nn = document.getElementById('slNgonNgu');
  if (nn) nn.classList.toggle('off', vi);
  const wn = document.getElementById('whyNgonNgu');
  // Ghi chú đúng năng lực từng engine: VieNeu thuần Việt (En/Vi code-switch),
  // XTTS-v2 gốc 17 ngôn ngữ (chưa có tiếng Việt — cần viXTTS), OmniVoice 600+.
  if (vi) wn.textContent = 'VieNeu chỉ đọc tiếng Việt (tự nhận En/Vi lẫn nhau)';
  else if (_voiceBackend === 'xtts') wn.textContent = 'XTTS đọc 17 ngôn ngữ này; tiếng Việt cần thêm bản viXTTS';
  else wn.textContent = 'OmniVoice hỗ trợ 600+ ngôn ngữ';
}

function giongTheoBackend(v){
  if (!v) return;
  if (_TTS_TEN[v.engine] && v.engine !== _voiceBackend){
    _voiceBackend = v.engine;
    _voiceBackendMacDinh = false;   // chọn theo giọng = chọn có chủ đích
    try { localStorage.setItem('voice_backend', v.engine); } catch (e){}
    _giongMauXoa();      // mẫu nghe thử đang cache tạo bằng engine cũ — xoá cho đúng (cả trên đĩa)
    try { voiceBackendVe(); giongVeThanh(); } catch (e){}
    try { giongBao('Đã chuyển engine sang ' + _TTS_TEN[v.engine] + ' (theo giọng đang chọn)', 'green'); } catch (e){}
    try { novaLog('🎙 engine theo giọng ' + v.name + ': ' + _TTS_TEN[v.engine]); } catch (e){}
  }
  // Ngôn ngữ cũng theo giọng: chọn giọng Nhật → dropdown sang tiếng Nhật.
  const sl = document.getElementById('voiceLang');
  if (sl && v.lang && sl.value !== v.lang && Array.from(sl.options).some(o => o.value === v.lang)){
    sl.value = v.lang;
  }
}

async function giongBam(key){
  const v = _giongDS.find(x => x.key === key);
  if (!v) return;
  const doiGiong = _giongChon !== key;
  _giongChon = key;
  if (_giongPhat === key && _giongAudio && !_giongAudio.paused){ _giongAudio.pause(); _giongPhat = ''; giongVe(); return; }
  giongVe();
  try {
    let url = _giongMau.get(key);
    if (!url){
      _giongPhat = key; giongVe();
      const blob = await _ttsChay(v, _GIONG_THU, giongDocTuyChon(), null);
      url = URL.createObjectURL(blob); _giongMau.set(key, url);
    }
    if (!_giongAudio) _giongAudio = new Audio();
    _giongAudio.onended = () => { _giongPhat = ''; giongVe(); };
    _giongAudio.src = url; _giongPhat = key; giongVe();
    await _giongAudio.play();
  } catch (err){
    _giongPhat = ''; giongVe();
    giongBao('Nghe thử lỗi: ' + (err.message || err), 'red');
  }
}

async function giongThu(key){
  return _giongPhatThu(key);
}

async function _giongTTS(v, text){
  // Engine đầu tiên thử là engine GỐC CỦA GIỌNG (chọn theo backend) — nghe
  // thử giọng built-in VieNeu mà đang chọn OmniVoice thì thử VieNeu trước,
  // đỡ chạy nhầm engine không sở hữu giọng rồi mới fallback.
  const thu = _giongThuTu(v);
  let loiDau = null;
  for (const eng of thu){
    try { return { blob: await _ttsChay(eng, v, text, giongDocTuyChon(), null), engine: eng }; }
    catch (e){
      if (!loiDau) loiDau = e;
      // engine thật sự hỏng → chấm đỏ, đừng để xanh dối lòng (giống ttsDoc).
      if (_giongTT[eng] === 'ok'){ _giongTT[eng] = 'err'; try { giongKiemEngineVe(); } catch (_){} }
      try { novaLog('🎙 nghe thử: ' + _TTS_TEN[eng] + ' lỗi — ' + (e.message || e), 'warn'); } catch (_){}
    }
  }
  throw loiDau || new Error('Không engine nào đọc được.');
}

function _giongThuTu(v){
  const goc = (v && _TTS_TEN[v.engine]) ? v.engine : _voiceBackend;
  return [goc].concat([_voiceBackend].concat(Object.keys(_TTS_TEN)).filter(e => e !== goc && _TTS_TEN[e]).filter((e, i, a) => a.indexOf(e) === i));
}

function _giongMauFileKey(eng, key){ return _GIONG_MAU_V + '|' + eng + '|' + key; }

async function _giongMauDocDia(eng, key){
  try {
    if (!(window.native && window.native.voiceSampleLoad)) return null;   // bản web không có IPC
    const r = await window.native.voiceSampleLoad(_giongMauFileKey(eng, key));
    if (r && r.ok && typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:')) return r.dataUrl;
  } catch (_){}
  return null;
}

async function _giongMauGhiDia(eng, key, blob){
  try {
    if (!(window.native && window.native.voiceSampleSave) || !blob) return;
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(new Error('đọc blob lỗi')); fr.readAsDataURL(blob); });
    if (dataUrl && dataUrl.startsWith('data:')) window.native.voiceSampleSave({ key: _giongMauFileKey(eng, key), dataUrl });   // fire-and-forget: lỗi ghi không chặn việc nghe
  } catch (_){}
}

function _giongMauXoa(key){
  if (key != null){
    const u = _giongMau.get(key);
    if (u){ try { URL.revokeObjectURL(u); } catch (_){} _giongMau.delete(key); }
    try { if (window.native && window.native.voiceSampleClear){ for (const e of Object.keys(_TTS_TEN)) window.native.voiceSampleClear(_giongMauFileKey(e, key)); } } catch (_){}
  } else {
    _giongMau.forEach(u => { try { URL.revokeObjectURL(u); } catch (_){} });
    _giongMau.clear();
    try { if (window.native && window.native.voiceSampleClear) window.native.voiceSampleClear(null); } catch (_){}
  }
}

async function _giongPhatThu(key){
  const v = _giongDS.find(x => x.key === key);
  if (!v) return;
  if (_giongPhat === key && _giongAudio && !_giongAudio.paused){ _giongAudio.pause(); _giongPhat = ''; giongVe(); return; }
  if (_giongTao === key) return;   // đang tạo mẫu cho chính giọng này — chờ, bấm thêm không spawn thêm task
  giongVe();
  try {
    let url = _giongMau.get(key);
    if (!url){
      // RAM không có → đọc cache trên đĩa (đã sinh từ phiên trước, phát ngay).
      // Dò theo đúng thứ tự engine ưu tiên như lúc tạo để không bỏ sót mẫu
      // tạo bằng engine fallback, và dò được là dừng.
      for (const e of _giongThuTu(v)){
        const duLieu = await _giongMauDocDia(e, key);
        if (duLieu){
          try {
            const r = await fetch(duLieu); const blob = await r.blob();
            if (blob && blob.size){ url = URL.createObjectURL(blob); _giongMau.set(key, url); }
          } catch (_){}
          break;
        }
      }
    }
    if (!url){
      _giongTao = key; _giongPhat = ''; giongVe();
      // Lần đầu model nạp lười mất ~30-60s — báo rõ đang chạy, đừng để tưởng treo.
      giongBao('⏳ Đang tạo mẫu nghe thử của "' + v.name + '"… lần đầu model nạp ~30-60 giây, giữ app mở.', 'text-muted');
      const kq = await _giongTTS(v, _GIONG_THU);   // { blob, engine }
      url = URL.createObjectURL(kq.blob); _giongMau.set(key, url);
      _giongMauGhiDia(kq.engine, key, kq.blob);    // ghi đĩa — phiên sau nghe ngay không tạo lại
    }
    _giongTao = '';
    if (!_giongAudio) _giongAudio = new Audio();
    _giongAudio.onended = () => { _giongPhat = ''; giongVe(); };
    _giongAudio.src = url; _giongPhat = key; giongVe();
    await _giongAudio.play();
  } catch (err){
    _giongPhat = ''; _giongTao = '';
    giongVe();
    giongBao('Nghe thử lỗi: ' + (err.message || err), 'red');
  }
}

function giongDocTuyChon(){
  const s = id => parseFloat((document.getElementById(id) || {}).value);
  const int = id => parseInt((document.getElementById(id) || {}).value, 10);
  return {
    tocDo: isFinite(s('voiceSpeed')) ? s('voiceSpeed') : 1,
    caoDo: isFinite(s('voicePitch')) ? s('voicePitch') : 0,
    gap: isFinite(s('voiceGap')) ? s('voiceGap') : 300,
    lang: (document.getElementById('voiceLang') || {}).value || 'vi',
    // Tham số nâng cao
    top_p: isFinite(s('voiceTopP')) ? s('voiceTopP') : 0.85,
    top_k: isFinite(int('voiceTopK')) ? int('voiceTopK') : 50,
    repetition_penalty: isFinite(s('voiceRepPen')) ? s('voiceRepPen') : 2.0,
    generation_speed: isFinite(s('voiceGenSpeed')) ? s('voiceGenSpeed') : 0.9,
    diffusion_steps: isFinite(int('voiceDiffSteps')) ? int('voiceDiffSteps') : 16,
  };
}

async function _ttsLocal(eng, v, text, o, onTien){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend giọng nói chưa sẵn sàng.'); }
  if (!v || !v.id) throw new Error('Chưa chọn giọng.');
  // chunk_chars theo phần cứng backend dò được (/api/hardware): GPU VRAM rộng → khối
  // to (600, giảm số lần gọi model); máy yếu CPU → khối nhỏ (200, ra audio sớm). Mặc định 400.
  const body = {
    text,
    language: o.lang,
    speed: o.tocDo,
    pitch: o.caoDo || 0,
    gap_ms: Math.round(o.gap),
    chunk_chars: (_voiceHW && _voiceHW.recommended && _voiceHW.recommended.chunk_chars) || 400,
    attributes: {},
    preset_id: v.id,
    engine: _TTS_BACKEND_ID[eng] || 'omnivoice',
    // Tham số nâng cao (chỉ gửi nếu engine là omnivoice hoặc engine hỗ trợ)
    top_p: o.top_p,
    top_k: o.top_k,
    repetition_penalty: o.repetition_penalty,
    generation_speed: o.generation_speed,
    diffusion_steps: o.diffusion_steps,
  };
  const sub = await _giongFetchJson(VOICE_URL + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const tid = sub.task_id;
  if (!tid) throw new Error('Backend không nhận việc.');
  for (let i = 0; i < 3600; i++){   // chờ tới 60 phút — kịch bản dài trên máy chậm vẫn kịp
    await new Promise(r => setTimeout(r, 1000));
    const s = await _giongFetchJson(VOICE_URL + '/api/status/' + tid);
    if (s.total && onTien) onTien(s.progress + '/' + s.total + ' khối');
    if (s.status === 'completed' || s.status === 'done'){
      if (!s.results || !s.results.merged) throw new Error('Backend không trả file.');
      const fileRes = await fetch(VOICE_URL + s.results.merged);
      if (!fileRes.ok) throw new Error('Không tải được file giọng (HTTP ' + fileRes.status + ').');
      const blob = await fileRes.blob();
      if (!blob || !blob.size) throw new Error('File giọng rỗng.');
      return blob;
    }
    if (s.status === 'failed' || s.status === 'error') throw new Error(s.error || 'Backend báo lỗi.');
  }
  throw new Error('Quá lâu không xong.');
}

async function _ttsChay(v, text, o, onTien){
  let blob;
  if (v.engine === 'omni') blob = await _ttsOmni(v, text, o, onTien);
  else if (v.engine === 'elevenlabs') blob = await _ttsEleven(v, text, o);
  else if (v.engine === 'openai') blob = await _ttsOpenAI(v, text, o);
  else throw new Error('Engine lạ: ' + v.engine);
  // Đọc ra file là bằng chứng mạnh hơn mọi phép thăm dò — nâng chấm lên xanh.
  // Có key chỉ được quyền text_to_speech mà không được user_read, thăm dò sẽ
  // báo vàng oan; lần đọc thật đầu tiên sửa lại cho đúng.
  if (_giongTT[v.engine] !== 'ok'){ _giongTT[v.engine] = 'ok'; delete _giongTTLoi[v.engine]; try { giongKiemEngineVe(); } catch (_){} }
  return blob;
}

function giongBao(msg, mau){
  const gs = document.getElementById('voiceGenStatus');
  if (gs) gs.innerHTML = mau ? `<span style="color:var(--${mau})">${escapeHtml(msg)}</span>` : escapeHtml(msg);
}

function voiceLoadScript(){
  let txt = (state.script || '').trim();
  if (!txt && state.scenes && state.scenes.length) txt = state.scenes.map(s => (s.text || '').trim()).filter(Boolean).join(' ');
  if (!txt){ giongBao('Chưa có kịch bản ở Tool 2.', 'text-muted'); return; }
  const ta = document.getElementById('voiceText'); if (ta){ ta.value = txt; giongDemChu(); }
}

function giongDemChu(){
  const t = (document.getElementById('voiceText') || {}).value || '';
  const tu = t.trim() ? t.trim().split(/\s+/).length : 0;
  const giay = Math.round(tu / 2.5);
  const el = document.getElementById('giongDemChu');
  if (!el) return;
  const cur = _giongDS.find(v => v.key === _giongChon);
  // Gói miễn phí ElevenLabs 10.000 ký tự/THÁNG — kịch bản video dài vượt là chuyện
  // thường, nên nhắc ngay lúc gõ chứ đừng để bấm Tạo giọng mới báo lỗi.
  const canh = cur && cur.engine === 'elevenlabs' && t.length > 10000
    ? ' <span style="color:var(--amber)">· vượt 10.000 ký tự — gói ElevenLabs miễn phí sẽ chặn, cân nhắc giọng OmniVoice</span>' : '';
  el.innerHTML = escapeHtml(tu + ' từ · ' + t.length + ' ký tự · ước ' + Math.floor(giay / 60) + ' phút ' + (giay % 60) + ' giây') + canh;
}

function _giongDemTu(s){ const t = String(s || '').trim(); return t ? t.split(/\s+/).length : 0; }

function _giongTachCau(p){
  return String(p || '').split(/(?<=[\.\!\?\…。！？])\s+/).map(s => s.trim()).filter(Boolean);
}

function _giongTachDoan(text, maxTu){
  maxTu = maxTu || 400;
  const don = [];
  for (const p of String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean)){
    if (_giongDemTu(p) <= maxTu){ don.push(p); continue; }   // dòng/đoạn ngắn giữ nguyên
    for (const c of _giongTachCau(p)) don.push(c);           // quá dài → tách tiếp theo câu
  }
  const ds = []; let cur = '', curTu = 0;
  for (const d of don){
    const w = _giongDemTu(d);
    if (cur && curTu + w > maxTu){ ds.push(cur); cur = d; curTu = w; }
    else { cur = cur ? cur + '\n\n' + d : d; curTu += w; }
  }
  if (cur) ds.push(cur);
  return ds;
}

async function _giongLuuBan(blob, giong, engine, text, nhan){
  const url = URL.createObjectURL(blob);
  const au = new Audio(url);
  const giay = await new Promise(r => { au.onloadedmetadata = () => r(au.duration || 0); au.onerror = () => r(0); });
  _giongSu.unshift({ url, blob, ten: (nhan ? nhan + ' · ' : '') + giong.name, engine, giay, text, khi: Date.now() });
  _giongSu = _giongSu.slice(0, 40);   // kịch bản tách nhiều đoạn cần nhiều slot hơn 12
  giongSuVe();
}

async function voiceGenerate(){
  if (typeof gateTool === 'function' && gateTool('toolvoice')) return;
  const text = ((document.getElementById('voiceText') || {}).value || '').trim();
  if (!text){ giongBao('Nhập nội dung trước.', 'red'); return; }
  const btn = document.getElementById('voiceGenBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo…'; }
  try {
    const t0 = Date.now();
    // Độ dài đoạn theo phần cứng (/api/hardware): GPU nhanh → đoạn dài 500 từ (khỏi tách
    // vụn); máy yếu CPU → 250 từ (nghe được sớm, không dính trần chờ). Mặc định 400.
    const doan = _giongTachDoan(text, (_voiceHW && _voiceHW.recommended && _voiceHW.recommended.seg_words) || 400);

    if (doan.length <= 1){
      // Ngắn — giữ nguyên luồng cũ: 1 task trọn vẹn.
      giongBao('Đang tạo giọng…');
      const { blob, giong, engine, luiVe } = await ttsDoc(text, s => giongBao('Đang tạo… ' + s));
      await _giongLuuBan(blob, giong, engine, text);
      giongBao('✓ Xong sau ' + Math.round((Date.now() - t0) / 1000) + ' giây' + (luiVe ? ' (đã lui về ' + _TTS_TEN[engine] + ')' : ''), 'green');
      return;
    }

    // Dài — render từng đoạn tuần tự, xong đoạn nào lưu ngay đoạn đó.
    let xong = 0;
    for (let i = 0; i < doan.length; i++){
      const nhan = 'Đoạn ' + (i + 1) + '/' + doan.length;
      let loi = null;
      for (let thu = 1; thu <= 2; thu++){   // thử tối đa 2 lần mỗi đoạn
        try {
          giongBao('Đang tạo ' + nhan + ' (~' + _giongDemTu(doan[i]) + ' từ)' + (thu > 1 ? ' · thử lần ' + thu : '') + '…');
          const { blob, giong, engine } = await ttsDoc(doan[i], s => giongBao(nhan + ' · ' + s));
          await _giongLuuBan(blob, giong, engine, doan[i], nhan);
          xong++;
          giongBao('✓ ' + nhan + ' xong (' + xong + '/' + doan.length + ')' + (i + 1 < doan.length ? ' — đang sang đoạn tiếp…' : ''), 'green');
          loi = null;
          break;
        } catch (e){ loi = e; }
      }
      if (loi){
        // Dừng ngay: lỗi thường mang tính hệ thống (backend/engine hỏng), chạy tiếp chỉ tốn giờ.
        const conLai = doan.slice(i).reduce((a, d) => a + _giongDemTu(d), 0);
        giongBao('⚠ ' + nhan + ' lỗi sau 2 lần thử (' + (loi.message || loi) + '). Đã xong ' + xong + '/' + doan.length + ' đoạn (đã lưu trong lịch sử bên dưới). Muốn làm tiếp: dán phần văn bản còn lại (~' + conLai + ' từ) vào ô rồi bấm “Tạo giọng”.', 'red');
        return;
      }
    }
    giongBao('✓ Xong ' + doan.length + ' đoạn sau ' + Math.round((Date.now() - t0) / 1000) + ' giây — bấm “🔗 Ghép các đoạn đã xong” ở khung Đã tạo để có 1 file trọn vẹn.', 'green');
  } catch (e){
    giongBao('Lỗi: ' + (e.message || e), 'red');
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '🎙 Tạo giọng'; }
  }
}

function giongSuVe(){
  const box = document.getElementById('giongSu');
  if (!box) return;
  // Nút gộp: chỉ hiện khi có nhóm ≥2 đoạn auto-split đã xong (kể cả thiếu đoạn).
  const g = _giongNhomDoan();
  const gb = document.getElementById('giongGhepBtn');
  if (gb){
    const ok = !!(g && g.items.length >= 2);
    gb.style.display = ok ? '' : 'none';
    if (ok) gb.textContent = '🔗 Ghép các đoạn đã xong (' + g.items.length + '/' + g.N + ')';
  }
  if (!_giongSu.length){ box.innerHTML = '<div class="empty-state">Chưa tạo bản nào trong phiên này.</div>'; return; }
  box.innerHTML = _giongSu.map((h, i) => {
    const ph = Math.floor(h.giay / 60), gi = Math.round(h.giay % 60);
    return `<div class="grow-row" onclick="giongSuPhat(${i})">
      <span class="gpico">▶</span>
      <div style="flex:1;min-width:0">
        <div class="gh-txt">${escapeHtml(h.text.slice(0, 70))}${h.text.length > 70 ? '…' : ''}</div>
        <div class="gh-meta">${escapeHtml(h.ten)}${h.engine ? ' · ' + (_TTS_TEN[h.engine] || '') : ''} · ${ph}:${String(gi).padStart(2,'0')} · ${_giongKhiNao(h.khi)}</div>
      </div>
      <div class="gh-act">
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuTai(${i})">Tải</button>
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuDungChoVideo(${i})">Dùng cho video</button>
      </div>
    </div>`;
  }).join('');
}

function _giongKhiNao(t){
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  return Math.floor(s / 3600) + ' giờ trước';
}

function giongSuPhat(i){
  const h = _giongSu[i]; if (!h) return;
  if (!_giongAudio) _giongAudio = new Audio();
  _giongAudio.src = h.url; _giongAudio.play().catch(() => {});
}

function giongSuTai(i){
  const h = _giongSu[i]; if (!h) return;
  const a = document.createElement('a');
  a.href = h.url; a.download = 'giong-noi-' + h.khi + (/(mpeg|mp3)/.test(h.blob.type) ? '.mp3' : '.wav');
  a.click();
}

function giongSuDungChoVideo(i){
  const h = _giongSu[i]; if (!h) return;
  const mp3 = /(mpeg|mp3)/.test(h.blob.type);
  const f = new File([h.blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: h.blob.type || 'audio/wav' });
  // t7HandleAudio lo hết: sóng âm, lưu theo video, đồng bộ Tool 2, kéo dài cảnh cuối.
  try { t7HandleAudio(f); } catch (e){ t7State.audioFile = f; }
  giongBao('✓ Đã gán vào dựng video — sang tab Dựng video là thấy.', 'green');
}

function _giongNhomDoan(){
  let best = null;   // nhóm "Đoạn i/N" có entry mới nhất
  for (const h of _giongSu){
    if (!h.ten) continue;
    const m = _GIONG_DOAN_RE.exec(h.ten);
    if (!m) continue;
    if (!best || h.khi > best.khi) best = { N: +m[2], giong: m[3], khi: h.khi };
  }
  if (!best) return null;
  const map = new Map();   // số đoạn → entry mới nhất
  for (const h of _giongSu){
    if (!h.ten) continue;
    const m = _GIONG_DOAN_RE.exec(h.ten);
    if (!m || +m[2] !== best.N || m[3] !== best.giong) continue;
    const idx = +m[1];
    if (!map.has(idx) || map.get(idx).h.khi < h.khi) map.set(idx, { idx, h });
  }
  return { N: best.N, giong: best.giong, items: Array.from(map.values()).sort((a, b) => a.idx - b.idx) };
}

function _giongWav16(ab){   // AudioBuffer → Blob WAV PCM 16-bit
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, len = ab.length;
  const bytes = 44 + len * nCh * 2;
  const dv = new DataView(new ArrayBuffer(bytes));
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * nCh * 2, true); dv.setUint16(32, nCh * 2, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, len * nCh * 2, true);
  const chans = []; for (let c = 0; c < nCh; c++) chans.push(ab.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++){
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2;
  }
  return new Blob([dv], { type: 'audio/wav' });
}

async function giongSuGhep(){
  const g = _giongNhomDoan();
  if (!g || g.items.length < 2){ giongBao('Cần ít nhất 2 đoạn đã xong trong lịch sử để ghép.', 'red'); return; }
  const btn = document.getElementById('giongGhepBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang ghép ' + g.items.length + ' đoạn…'; }
  try {
    // 1) Decode từng blob (mp3/wav đều được).
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const bufs = [];
    for (const it of g.items) bufs.push(await ctx.decodeAudioData(await it.h.blob.arrayBuffer()));
    try { ctx.close(); } catch (_){ }
    // 2) Nối qua OfflineAudioContext — tự resample nếu các đoạn khác sample-rate.
    const sr = Math.max(...bufs.map(b => b.sampleRate));
    const nCh = Math.max(...bufs.map(b => b.numberOfChannels));
    const total = bufs.reduce((a, b) => a + b.length, 0);
    const off = new OfflineAudioContext(nCh, total, sr);
    let t = 0;
    for (const b of bufs){
      const s = off.createBufferSource(); s.buffer = b;
      s.connect(off.destination); s.start(t);
      t += b.length / b.sampleRate;
    }
    const out = await off.startRendering();
    // 3) Encode WAV → lưu vào lịch sử như 1 bản (Tải / Dùng cho video như bản khác).
    const blob = _giongWav16(out);
    _giongSu.unshift({
      url: URL.createObjectURL(blob), blob,
      ten: 'Gộp ' + g.items.length + ' đoạn · ' + g.giong,
      engine: g.items[0].h.engine, giay: out.duration,
      text: g.items.map(x => x.h.text).join(' '), khi: Date.now(),
    });
    _giongSu = _giongSu.slice(0, 40);
    giongSuVe();
    const thieu = g.N - g.items.length;
    giongBao('✓ Đã ghép ' + g.items.length + '/' + g.N + ' đoạn thành 1 file (' + Math.round(out.duration) + ' giây)'
      + (thieu > 0 ? ' — thiếu ' + thieu + ' đoạn chưa xong, render nốt rồi ghép lại sẽ đủ.' : '')
      + ' Bản "Gộp…" nằm đầu lịch sử: bấm Tải hoặc Dùng cho video.', 'green');
  } catch (e){
    giongBao('Lỗi ghép: ' + (e.message || e), 'red');
  } finally {
    if (btn) btn.disabled = false;
    giongSuVe();
  }
}

function giongThemBat(){ _giongThemMo = !_giongThemMo; _giongTenTay = false; _giongTra = {}; _giongTraId = ''; const b = document.getElementById('giongThemBox'); if (b) b.style.display = _giongThemMo ? '' : 'none'; if (_giongThemMo) giongThemDoi(); }

function giongThemDoi(){
  const c = (document.getElementById('giongThemCach') || {}).value || 'clone';
  for (const [id, hop] of [['gtClone', c === 'clone'], ['gtDesign', c === 'design'],
                           ['gtNhap', c === 'nhap' || c === 'nhanban'],
                           ['gtKeyRow', c === 'nhap' || c === 'nhanban'],
                           ['gtNhanBanNote', c === 'nhanban']]){
    const el = document.getElementById(id); if (el) el.style.display = hop ? '' : 'none';
  }
  const es = document.getElementById('gtEngine');
  const vs = document.getElementById('gtVoiceId'), vl = document.getElementById('gtVoiceSel');
  if (es && vs && vl){
    const eng = es.value;
    vl.style.display = eng === 'openai' ? '' : 'none';
    vs.style.display = eng === 'openai' ? 'none' : '';
  }
  giongVeKey();
  const tt = document.getElementById('gtVoiceTT'); if (tt) tt.textContent = '';
  _giongTra = {};
}

async function giongThemLuu(){
  const cach = (document.getElementById('giongThemCach') || {}).value || 'clone';
  const ten = ((document.getElementById('gtTen') || {}).value || '').trim() || (_giongTra.name || '');
  const nhan = (_giongTra.tags || []).slice(0, 3);   // nhãn lấy từ kết quả tra voice id, không nhập tay nữa
  if (!ten){ giongBao('Đặt tên cho giọng trước.', 'red'); return; }
  try {
    if (cach === 'nhap' || cach === 'nhanban'){
      const eng = (document.getElementById('gtEngine') || {}).value || 'elevenlabs';
      const id = eng === 'openai'
        ? ((document.getElementById('gtVoiceSel') || {}).value || '')
        : ((document.getElementById('gtVoiceId') || {}).value || '').trim();
      if (!id){ giongBao('Nhập voice id.', 'red'); return; }
      const model = ((document.getElementById('gtModel') || {}).value || '').trim();
      if (cach === 'nhanban'){ await _giongNhanBan(eng, id, model, ten, nhan); }
      else {
      const ds = _giongCloud();
      if (ds.some(v => v.engine === eng && v.id === id)){ giongBao('Giọng này đã có trong thư viện.', 'red'); return; }
      ds.push({ engine: eng, id, name: ten, tags: nhan, model });
      _giongCloudLuu(ds);
      }
    } else {
      if (!_voiceReady){ await voiceInit(); if (!_voiceReady){ giongBao('Backend OmniVoice chưa sẵn sàng.', 'red'); return; } }
      const body = { name: ten, ref_text: '', attributes: {}, tags: nhan };
      if (cach === 'clone'){
        const f = (document.getElementById('gtFile') || {}).files && document.getElementById('gtFile').files[0];
        if (!f){ giongBao('Chọn file giọng mẫu.', 'red'); return; }
        giongBao('Đang tải file mẫu…');
        const fd = new FormData(); fd.append('file', f);
        const up = await fetch(VOICE_URL + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
        body.ref_audio = up.path;
      } else {
        const ins = ((document.getElementById('gtMoTa') || {}).value || '').trim();
        if (!ins){ giongBao('Nhập mô tả giọng.', 'red'); return; }
        body.attributes.instruct = ins;
      }
      await fetch(VOICE_URL + '/api/voices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    }
    giongThemBat();
    await giongTaiDS();
    giongBao('✓ Đã thêm giọng "' + ten + '".', 'green');
  } catch (e){ giongBao('Thêm giọng lỗi: ' + (e.message || e), 'red'); }
}

async function giongXoa(key){
  if (_giongBusy) return;
  const v = _giongDS.find(x => x.key === key);
  if (!v){ giongBao('Không tìm thấy giọng.', 'red'); return; }
  if (v.factory){ giongBao('Không xoá được giọng có sẵn.', 'red'); return; }
  if (!confirm('Xoá giọng "' + v.name + '"? File mẫu clone sẽ bị gỡ khỏi thư viện.')) return;
  _giongBusy = true;
  try {
    await _giongFetchJson(VOICE_URL + '/api/voices/' + encodeURIComponent(v.id), { method: 'DELETE' });
    _giongMauXoa(key);   // bỏ cả cache đĩa của giọng đã xoá (thử mọi engine)
    if (_giongPhat === key){
      try { if (_giongAudio) _giongAudio.pause(); } catch (e){}
      _giongPhat = '';
    }
    if (_giongChon === key) _giongChon = '';
    await giongTaiDS();
    giongBao('✓ Đã xoá giọng "' + v.name + '".', 'green');
  } catch (e){ giongBao('Xoá lỗi: ' + (e.message || e), 'red'); }
  finally { _giongBusy = false; }
}

function giongKiemEngineVe(){
    const el = document.getElementById('giongEngine');
    if (!el) return;
    const cham = e => `<span class="gdot ${_giongTT[e]}"></span>`;
    const chua = ['elevenlabs','openai'].filter(e => _giongTT[e] === 'no');
    const hong = ['elevenlabs','openai'].filter(e => _giongTT[e] === 'err' || _giongTT[e] === 'thieu');
    el.innerHTML =
      cham('omni') + '<b>OmniVoice</b> <span style="color:var(--text-dim)">máy</span>' +
      '<span class="sep">·</span>' + cham('elevenlabs') + 'ElevenLabs' +
      '<span class="sep">·</span>' + cham('openai') + 'OpenAI' +
      (chua.length ? '<span class="sep">·</span><span style="color:var(--text-dim)">' + chua.map(e => _TTS_TEN[e]).join(', ') + ' chưa có key</span>' : '') +
      '<button class="btn sm ghost" style="margin-left:auto" onclick="giongMoKey(\'elevenlabs\')">Sửa key</button>' +
      hong.map(e => '<div style="flex-basis:100%;font-size:12px;color:var(--' + (_giongTT[e] === 'thieu' ? 'amber' : 'red') + ');margin-top:6px">'
        + escapeHtml(_TTS_TEN[e]) + ': ' + escapeHtml(_giongTTLoi[e] || 'gọi thử không được')
        + (_giongTT[e] === 'thieu' ? ' <span style="color:var(--text-dim)">— key HỢP LỆ, chỉ thiếu quyền cho phép Nova tự kiểm tra. Đọc vẫn có thể chạy bình thường: cứ bấm Tạo giọng, ra tiếng là chấm tự chuyển xanh. Muốn xanh ngay thì bật quyền đó ở elevenlabs.io → API Keys.</span>' : '')
        + '</div>').join('');
    const n = document.getElementById('giongEngineDem');
    if (n) n.textContent = Object.values(_giongTT).filter(x => x === 'ok').length + '/3 sẵn sàng';
}

async function giongKiemEngine(){
  const ve = giongKiemEngineVe;
  ve();
  const dat = (e, v) => { _giongTT[e] = v; ve(); };
  try { const s = await window.native.voiceStatus(); dat('omni', s && s.running ? 'ok' : 'no'); } catch (e){ dat('omni', 'no'); }
  for (const e of ['elevenlabs','openai']){
    const k = _ttsKey(e);
    if (!k){ dat(e, 'no'); continue; }
    try {
      const r = await window.native.llmFetch({
        url: e === 'elevenlabs' ? 'https://api.elevenlabs.io/v1/user/subscription' : 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: e === 'elevenlabs' ? { 'xi-api-key': k } : { 'Authorization': 'Bearer ' + k },
        timeoutMs: 15000,
      });
      let tt = r && r.ok ? 'ok' : 'err', vi = '';
      if (r && !r.ok){
        try {
          const j = JSON.parse(r.text || '{}');
          const d = j.detail || j.error || {};
          vi = d.message || j.message || '';
          // ElevenLabs 401 kèm missing_permissions = key THẬT, chỉ thiếu quyền.
          // Báo đỏ ở đây là oan, phải phân biệt.
          if (d.status === 'missing_permissions' || /missing the permission/i.test(vi)) tt = 'thieu';
        } catch (_){ vi = String(r.text || r.error || '').slice(0, 160); }
      } else if (r && r.error) vi = r.error;
      _giongTTLoi[e] = vi;
      dat(e, tt);
    } catch (err){ _giongTTLoi[e] = String(err.message || err); dat(e, 'err'); }
  }
}

function voiceBackendMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('voiceBackendDD');
  if (dd) dd.classList.toggle('mo');
  const btn = document.getElementById('voiceBackendBtn');
  if (btn) btn.setAttribute('aria-expanded', dd && dd.classList.contains('mo') ? 'true' : 'false');
}

function voiceBackendChon(eng){
  if (!_TTS_TEN[eng]) return;
  _voiceBackend = eng;
  _voiceBackendMacDinh = false;   // đã chọn tay — health không tự đổi nữa
  try { localStorage.setItem('voice_backend', eng); } catch (e){}
  const dd = document.getElementById('voiceBackendDD');
  if (dd) dd.classList.remove('mo');
  _giongMauXoa();      // mẫu nghe thử đang cache tạo bằng engine cũ — xoá cho đúng (cả trên đĩa)
  voiceBackendVe();
  giongVe();
  giongVeThanh();
}

function voiceBackendVe(){
  const eng = _TTS_TEN[_voiceBackend] ? _voiceBackend : 'omni';
  const ten = document.getElementById('voiceBackendTen');
  const mo  = document.getElementById('voiceBackendNote');
  const dot = document.getElementById('voiceBackendDot');
  if (ten) ten.textContent = _TTS_TEN[eng];
  if (mo)  mo.textContent  = _BE_MO_TA[eng].mo;
  if (dot) dot.className = 'gdot ' + (_giongTT[eng] || 'no');
  for (const [e, id] of [['omni', 'beDotOmni'], ['vieneu', 'beDotVieneu'], ['xtts', 'beDotXtts']]){
    const d = document.getElementById(id); if (d) d.className = 'gdot ' + (_giongTT[e] || 'no');
    const it = document.querySelector('#voiceBackendMenu .be-item[data-eng="' + e + '"]');
    if (it) it.classList.toggle('sel', e === eng);
  }
}

function giongDDMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('voiceGiongDD'); if (!dd) return;
  dd.classList.toggle('mo');
  const btn = document.getElementById('voiceGiongBtn');
  if (btn) btn.setAttribute('aria-expanded', dd.classList.contains('mo') ? 'true' : 'false');
}

function giongDDChon(key){
  const v = _giongDS.find(x => x.key === key); if (!v) return;
  _giongChon = key;
  giongTheoBackend(v);   // chọn giọng → engine/ngôn ngữ đổi theo backend của giọng
  const dd = document.getElementById('voiceGiongDD'); if (dd) dd.classList.remove('mo');
  giongVe();   // vẽ lại thẻ thư viện + nhãn + chính dropdown này
}

function _giongMenuItem(v, chonFn){
  const phat = v.key === _giongPhat, tao = v.key === _giongTao;
  return `<div class="be-item${v.key === _giongChon ? ' sel' : ''}" role="option" onclick="${chonFn}('${escapeHtml(v.key)}')">` +
    `<span class="be-ten">${escapeHtml(v.name)}</span><span class="be-mo">${escapeHtml(v.src || '')}</span>` +
    `<button type="button" class="gplay${phat ? ' on' : ''}" title="${tao ? 'Đang tạo mẫu nghe thử…' : (phat ? 'Dừng nghe thử' : 'Nghe thử 4 giây')}" aria-label="Nghe thử" onclick="event.stopPropagation();giongThu('${escapeHtml(v.key)}')">${tao ? '⏳' : (phat ? '❙❙' : '▶')}</button></div>`;
}

function giongDDVe(){
  const ten = document.getElementById('voiceGiongTen');
  const note = document.getElementById('voiceGiongNote');
  const menu = document.getElementById('voiceGiongMenu');
  const why = document.getElementById('whyGiong');
  if (!ten || !note || !menu) return;
  if (!_giongDS.length){
    ten.textContent = 'chưa có giọng nào';
    note.textContent = '';
    menu.innerHTML = '<div class="be-item" style="cursor:default;color:var(--text-dim)">Chưa có giọng trong thư viện</div>';
    if (why) why.textContent = 'Bấm “＋ Thêm giọng” trong Thư viện giọng phía trên (clone từ file mẫu 5–15 giây, hoặc thiết kế từ mô tả chữ) — lưu xong sẽ chọn được ở đây.';
    return;
  }
  const cur = _giongDS.find(v => v.key === _giongChon);
  ten.textContent = cur ? cur.name : 'chưa chọn giọng';
  note.textContent = cur ? (cur.src || '') : '';
  menu.innerHTML = _giongDS.map(v => _giongMenuItem(v, 'giongDDChon')).join('');
  if (why) why.textContent = '';
}

function giongLibMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('giongLibDD'); if (!dd) return;
  dd.classList.toggle('mo');
  const btn = document.getElementById('giongLibBtn');
  if (btn) btn.setAttribute('aria-expanded', dd.classList.contains('mo') ? 'true' : 'false');
}

function giongLibChon(key){
  const v = _giongDS.find(x => x.key === key); if (!v) return;
  _giongChon = key;
  giongTheoBackend(v);   // chọn giọng → engine/ngôn ngữ đổi theo backend của giọng
  const dd = document.getElementById('giongLibDD'); if (dd) dd.classList.remove('mo');
  giongVe();   // vẽ lại nút, nhãn, lưới (nếu mở) + dropdown "Giọng đọc"
}

function giongLibVe(){
  const ten = document.getElementById('giongLibTen');
  const note = document.getElementById('giongLibNote');
  const menu = document.getElementById('giongLibMenu');
  if (!ten || !note || !menu) return;
  if (!_giongDS.length){
    ten.textContent = 'chưa có giọng nào';
    note.textContent = '';
    menu.innerHTML = '<div class="be-item" style="cursor:default;color:var(--text-dim)">Chưa có giọng trong thư viện</div>';
    return;
  }
  const cur = _giongDS.find(v => v.key === _giongChon);
  ten.textContent = cur ? cur.name : 'chưa chọn giọng';
  note.textContent = cur ? (cur.src || '') : '';
  menu.innerHTML = _giongDS.map(v => _giongMenuItem(v, 'giongLibChon')).join('');
}

function giongLuoiBat(){
  _giongLuoiMo = !_giongLuoiMo;
  const w = document.getElementById('giongLuoiWrap');
  if (w) w.style.display = _giongLuoiMo ? '' : 'none';
  const b = document.getElementById('giongLuoiBtn');
  if (b) b.textContent = _giongLuoiMo ? '▦ Ẩn lưới thẻ' : '▦ Xem dạng lưới thẻ';
}

function _mvImgSrc(img){ return img.base64.startsWith('data:') ? img.base64 : ('data:' + (img.mediaType || 'image/png') + ';base64,' + img.base64); }

function _mvRenderSceneList(){
  const info = document.getElementById('mvInfo');
  if (info) info.textContent = mvScenes.length ? (mvScenes.length + ' ảnh sẵn sàng. Bấm Sinh prompt chuyển động.') : 'Chưa có ảnh — tải ảnh lên (test) hoặc lấy ảnh cảnh đã tạo.';
  const box = document.getElementById('mvSceneList');
  if (!box) return;
  box.innerHTML = mvScenes.length
    ? mvScenes.map(s => `<div style="display:flex;gap:8px;align-items:center;font-size:12px"><img src="${_mvImgSrc(s.img)}" style="width:44px;height:26px;object-fit:cover;border-radius:4px;border:1px solid var(--border)"><b>[${escapeHtml(s.id)}]</b> <span style="color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${s.uploaded ? '<i>ảnh tải lên</i>' : escapeHtml((s.vo || '').slice(0, 90))}</span>${s.uploaded ? `<button class="btn ghost sm" style="padding:1px 7px" onclick="mvRemoveUpload('${s.id}')">×</button>` : ''}</div>`).join('')
    : '<div class="empty-state">Tải ảnh lên (test) hoặc "Lấy ảnh cảnh đã tạo" từ Tool 2 / Tạo Ảnh Hàng Loạt.</div>';
}

function _mvFileToB64(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(',') + 1)); }; r.onerror = rej; r.readAsDataURL(file); }); }

function _mvRules(cfg){
  // Câu khoá style phải theo PROFILE — trước đây ép cứng "flat 2D" nên kênh ảnh thật/lịch sử cũng bị kéo về hoạt hình.
  const _pm = (typeof _profileMedium === 'function') ? _profileMedium(typeof getProfile === 'function' ? getProfile() : null) : { is2D: true, isPhoto: false };
  const _lookLock = _pm.isPhoto ? 'Keep the photorealistic look and stable facial features throughout.'
    : _pm.is2D ? 'Keep the flat 2D look and stable facial features throughout.'
    : 'Keep the exact art style of the still image and stable facial features throughout.';
  const _exStyle = _pm.isPhoto ? 'Photorealistic documentary cinematography, muted desaturated palette, tense somber mood.'
    : _pm.is2D ? 'Dark 2D hand-drawn storybook style, muted desaturated palette, tense somber mood.'
    : 'Same art style as the still image, muted desaturated palette, tense somber mood.';
  return `OFFICIAL VEO FORMULA — write the 5 parts IN THIS EXACT ORDER, camera FIRST:
[Cinematography] → [Subject] → [Action] → [Context] → [Style & Ambiance]
Sample (match this voice):
"Very slow push-in, close-up. A young farmer's solemn face. He slowly glances toward the tree line, faint breath visible in the cold air. Village clearing before dawn, drifting mist and a distant flicker of torchlight behind him. ${_exStyle} ${_lookLock}"

MANDATORY RULES:
1. Opening Cinematography = "${cfg.camText}" + shot size (close-up / medium / wide establishing shot) inferred from the image content.
2. Describe ONLY the MOTION applied to the existing still image — KEEP the characters, composition and art style unchanged. Do NOT add new objects/characters, do NOT change the scene, do NOT re-describe appearance details (the image already locks them).
3. Action = SMALL, SLOW motion (breathing, blinking, gaze shift, hair/cloth sway, thin wisp of smoke, flickering firelight, drifting mist, ripples, falling leaves). Intensity: ${cfg.intText}. Minimal motion so faces/masks are NOT distorted.
4. NEVER include spoken lines and NEVER use quotation marks for speech (this channel records voiceover separately — no character voices, no sound/music/SFX descriptions).
5. Style & Ambiance goes LAST, ending with: "${_lookLock}"${cfg.extra ? '\n6. Extra notes: ' + cfg.extra : ''}`;
}

function _mvCfg(){
  // Mặc định: chuyển động tinh tế + push-in chậm điện ảnh (an toàn nhất cho khuôn mặt).
  // Độ dài lấy theo panel "Tạo video Flow" (mvVidDur) để prompt khớp clip sẽ render.
  return {
    clip: document.getElementById('mvVidDur')?.value || '8',
    extra: '',
    intText: 'rất tinh tế, tối thiểu (an toàn nhất cho khuôn mặt)',
    camText: 'Very slow push-in',
  };
}

async function _mvGenVision(s, cfg){
  const messages = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: s.img.mediaType || 'image/png', data: s.img.base64 } },
    { type: 'text', text: `The image above is the FIRST FRAME of a ${cfg.clip}s Veo (image→video) clip. Look at the image and write 1 MOTION prompt IN ENGLISH for Veo.

${_mvRules(cfg)}

Return ONLY 1 JSON: {"motion":"..."}` },
  ] }];
  const data = await callLLMJson('', { maxTokens: 900, messages, validate: d => d && typeof d.motion === 'string' && d.motion.length > 20 });
  return data.motion.trim();
}

function tvSetMode(m){
  tvState.mode = m;
  document.querySelectorAll('#tool-tool6 .tv-mbody').forEach(d => { d.style.display = (d.dataset.m === m) ? '' : 'none'; });
  const pair = document.getElementById('tvPairWrap'); if (pair) pair.style.display = (m === 'prompt') ? 'none' : '';
  tvRenderRows();
}

function _tvModeRows(){
  if (tvState.mode === 'image') return mvScenes.filter(s => s.uploaded);
  return mvScenes.filter(s => !s.uploaded);   // scene
}

function tvRenderRows(){
  const box = document.getElementById('tvRows'); if (!box) return;
  const mp = state.motionPrompts || {};
  const rows = _tvModeRows();
  // Mặc định: nếu có cảnh đánh dấu 🎬 (chế độ Xen video) → CHỈ chọn các cảnh đó; không thì chọn hết. Giữ lựa chọn cũ.
  const _wantSet = new Set((state.scenes || []).filter(x => x.wantVideo).map(x => x.id));
  const _useMark = _wantSet.size > 0;
  rows.forEach(s => { if (!tvState.initSel || !tvState.selected.has('_seen_' + s.id)) { if (!_useMark || _wantSet.has(s.id)) tvState.selected.add(s.id); tvState.selected.add('_seen_' + s.id); } });
  tvState.initSel = true;
  if (!rows.length){ box.innerHTML = '<div class="empty-state">' + (tvState.mode === 'image' ? 'Chưa có ảnh. Bấm ⬆ Tải ảnh lên.' : 'Chưa có ảnh cảnh. Bấm 📥 Lấy ảnh + prompt từ Phân Cảnh.') + '</div>'; return; }
  box.innerHTML = rows.map(s => {
    const on = tvState.selected.has(s.id);
    const pr = escapeHtml(mp[s.id] || '');
    return `<div class="tv-row${on ? '' : ' off'}">
      <span><input type="checkbox" class="tv-ck" ${on ? 'checked' : ''} onchange="tvToggleRow('${s.id}',this.checked)"></span>
      <span class="tv-idx">${escapeHtml(s.id)}</span>
      <img class="tv-thumb" src="${_mvImgSrc(s.img)}" onclick="tvEnlarge('${s.id}')">
      <textarea class="tv-pr" rows="2" oninput="tvEditPrompt('${s.id}',this.value)" placeholder="— trống → AI tự sinh khi tạo —">${pr}</textarea>
      <span class="tv-x" title="Bỏ dòng" onclick="tvRemoveRow('${s.id}')">✕</span>
    </div>`;
  }).join('');
}

function tvToggleRow(id, on){ if (on) tvState.selected.add(id); else tvState.selected.delete(id); tvRenderRows(); }

function tvToggleAll(on){ _tvModeRows().forEach(s => { if (on) tvState.selected.add(s.id); else tvState.selected.delete(s.id); }); tvRenderRows(); }

function tvEditPrompt(id, v){ if (!state.motionPrompts) state.motionPrompts = {}; state.motionPrompts[id] = v; }

function tvRemoveRow(id){
  const s = mvScenes.find(x => x.id === id);
  if (s && s.uploaded) { mvUploaded = mvUploaded.filter(u => u.id !== id); mvRebuild(); }
  else { tvState.selected.delete(id); tvRenderRows(); }   // cảnh từ Tool 2: chỉ bỏ chọn
}

function tvEnlarge(id){ const s = mvScenes.find(x => x.id === id); if (!s) return; const m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:30px'; m.onclick = () => m.remove(); m.innerHTML = `<img src="${_mvImgSrc(s.img)}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px">`; document.body.appendChild(m); }

function tvSelectedIds(){ return new Set(_tvModeRows().filter(s => tvState.selected.has(s.id)).map(s => s.id)); }

function _tvParsePrompts(){
  return (document.getElementById('tvPrompts')?.value || '').split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(/^([^|]{1,60})\|(.+)$/);
    return m ? { name: m[1].trim(), prompt: m[2].trim() } : { name: 'video-' + String(i + 1).padStart(3, '0'), prompt: line };
  });
}

function tvUpdatePromptCount(){ const el = document.getElementById('tvPromptCount'); if (el) el.textContent = String(_tvParsePrompts().length); }

function tvImportPromptFile(file){ if (!file) return; const r = new FileReader(); r.onload = () => { const t = document.getElementById('tvPrompts'); if (t){ t.value = (t.value ? t.value + '\n' : '') + String(r.result || ''); tvUpdatePromptCount(); } }; r.readAsText(file); }

async function tvFlowStatus(){
  const el = document.getElementById('tvAcctBar'); if (!el) return;
  const setg = ' <a href="#" onclick="switchTool(\'toolsettings\');return false" style="color:var(--accent);font-weight:600">Cài đặt</a>';
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa kết nối</b> <span style="color:var(--text-muted)">— thêm/đăng nhập tài khoản ở' + setg + '</span>'; return; }
    const st = await flowBridge.call('GET_STATUS');
    const accs = (st && st.accounts) || []; const n = (st && st.accountCount) || accs.filter(a => a.hasToken).length || 0;
    if (!n && !(st && st.hasToken)) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa đăng nhập</b> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; return; }
    let html = '<span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span> <b>Đã kết nối · ' + n + ' tài khoản</b>';
    accs.slice(0, 6).forEach(a => { const cr = (a.credits != null) ? (' · ' + a.credits + ' credit') : ''; html += '<span style="font-size:11px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:99px;padding:3px 10px;color:var(--text-muted)">' + escapeHtml(String(a.email || 'tài khoản').split('@')[0]) + cr + '</span>'; });
    html += '<a href="#" onclick="switchTool(\'toolsettings\');return false" style="margin-left:auto;color:var(--accent);font-weight:600;font-size:11.5px">⚙️ Quản lý ở Cài đặt</a>';
    el.innerHTML = html;
    // Đã kết nối → dọn thông báo lỗi "Chưa kết nối" CŨ còn kẹt ở thanh trạng thái Flow (statusflow) để 2 chỗ không mâu thuẫn.
    try { const sf = document.getElementById('statusflow'); if (sf && /Chưa kết nối|Chưa đăng nhập/i.test(sf.textContent || '')) setStatusF('✓ Đã kết nối · ' + n + ' tài khoản.', 'info'); } catch (e) {}
  } catch (e) { el.innerHTML = '<span style="color:var(--amber)">⚠️ Chưa kết nối</span> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; }
}

function _mvDownload(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

function _b64ToBlob(b64, mime){ const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'video/mp4' }); }

function _autoSaveCfg(){ if (!state.autoSave) state.autoSave = { enabled: false, mode: 'perTask', folder: '' }; return state.autoSave; }

function _autoSaveChannel(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  return String((p && p.name) || document.getElementById('pTenKenh')?.value || 'novastudio');
}

function _autoSaveTask(){
  const custom = (_autoSaveCfg().taskName || '').trim();
  // Không đặt riêng → theo TÊN VIDEO hiện tại (khớp thư mục luồng tự động), else theo tên kênh.
  let vname = ''; try { const v = (typeof getCurrentVideo === 'function') ? getCurrentVideo() : null; vname = (v && v.name) || ''; } catch (e) {}
  return (_slug(custom || vname || _autoSaveChannel()) || 'task').slice(0, 60);
}

function _autoSaveSyncUI(){
  const c = _autoSaveCfg();
  const ch = _slug(_autoSaveChannel()).slice(0, 60) || 'task';
  document.querySelectorAll('.asv-enabled').forEach(e => { e.checked = !!c.enabled; });
  document.querySelectorAll('.asv-mode').forEach(e => { e.value = c.mode || 'perTask'; });
  document.querySelectorAll('.asv-folder').forEach(e => { e.value = c.folder || ''; });
  const wmEl = document.getElementById('wmToggle'); if (wmEl) wmEl.checked = !!c.wmRemove;
  const wmO = document.getElementById('wmOff'); if (wmO && c.off) wmO.value = c.off;
  const wmS = document.getElementById('wmSide'); if (wmS && c.side) wmS.value = c.side;
  document.querySelectorAll('.asv-name').forEach(e => { e.value = c.taskName || ''; e.placeholder = 'Tên thư mục (mặc định: ' + ch + ')'; e.style.display = (c.mode === 'flat') ? 'none' : ''; });
}

function _wmCfg(){ const c = _autoSaveCfg(); if (typeof c.wmRemove === 'undefined') c.wmRemove = false; return { enabled: !!c.wmRemove }; }

function _wmSetStatus(msg, tone){ const el = document.getElementById('wmStatus'); if (el){ el.textContent = msg; el.style.color = tone === 'ok' ? 'var(--ok,#22c55e)' : tone === 'err' ? 'var(--danger,#ef4444)' : tone === 'work' ? 'var(--brand,#f97316)' : 'var(--text-dim)'; } }

function wmToggle(el){ const on = !!(el && el.checked); _autoSaveCfg().wmRemove = on; try { saveState(true); } catch {} _wmSetStatus(on ? '✓ Bật — ảnh tạo ra sẽ tự xoá dấu ✦ rồi hiển thị & lưu.' : 'Tắt.', on ? 'ok' : ''); }

async function wmGeminiClean(src){
  try {
    if (!window.native?.wmInpaint) return src;   // chỉ chạy ở bản App (cần main-process + model AI)
    const s = String(src).startsWith('data:') ? String(src) : ('data:image/png;base64,' + src);
    const mime = (s.match(/^data:([^;,]+)/) || [])[1] || 'image/png';
    const r = await window.native.wmInpaint(s, mime);   // AI inpaint (MI-GAN) ở tiến trình chính
    return (r && String(r).startsWith('data:')) ? r : src;
  } catch (e){ return src; }
}

async function _mvPersistVideos(){
  try {
    const p = (typeof getProfile === 'function') ? getProfile() : null;
    const uid = window.currentUser?.uid; const pid = p?.profileId;
    if (!uid || !pid || typeof IDB === 'undefined') return;
    const b = uid + '/' + pid + '/' + _curVideoId(p) + '/';
    await IDB.set(b + 'sceneVideoBlobs', mvVideoBlobs || {});
    await IDB.set(b + 'sceneVideosMeta', state.sceneVideos || {});
  } catch (e){ /* */ }
}

async function _mvRunLimited(items, limit, worker){
  let idx = 0;
  const runNext = async () => { while (idx < items.length && !window.__mvVidStop){ const i = idx++; await worker(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => runNext()));
}

function tvRenderVideos(){
  const box = document.getElementById('mvVidResultList'); if (!box) return;
  if (!tvResults.length){ box.innerHTML = '<div class="empty-state">Chưa có video.</div>'; return; }
  const dur = document.getElementById('mvVidDur')?.value || '8';
  box.innerHTML = tvResults.map((r, i) => {
    let inner;
    if (r.status === 'done'){ const src = r.b64 ? ('data:' + (r.mime || 'video/mp4') + ';base64,' + r.b64) : (r.videoUrl || ''); inner = `<div style="aspect-ratio:16/9;position:relative;background:#000">${src ? `<video src="${src}" controls style="width:100%;height:100%;object-fit:cover"></video>` : '<div style="display:grid;place-items:center;height:100%;color:#fff;font-size:11px">video</div>'}<span style="position:absolute;top:5px;left:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(22,163,74,.92);color:#fff">${dur}s ✓</span></div>`; }
    else if (r.status === 'gen'){ inner = `<div style="aspect-ratio:16/9;background:linear-gradient(135deg,#3b3f45,#25282d);position:relative"><span style="position:absolute;top:7px;right:9px;color:#e8e8ea;font-size:13px;font-weight:700">${Math.round(r.pct || 0)}%</span><span style="position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--accent-2),var(--accent));width:${r.pct || 4}%"></span></div>`; }
    else if (r.status === 'err'){ inner = `<div title="${escapeHtml(r.err || '')}" style="min-height:120px;background:color-mix(in srgb,var(--red) 10%,var(--surface-3));color:var(--red);font-size:10px;line-height:1.4;font-weight:500;padding:8px;overflow:auto;word-break:break-word;font-family:ui-monospace,monospace">✗ ${escapeHtml(r.err || '')}</div>`; }
    else inner = `<div style="aspect-ratio:16/9;background:var(--surface-3);display:grid;place-items:center;color:var(--text-dim);font-size:12px;opacity:.6">chờ…</div>`;
    return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;overflow:hidden">${inner}<div style="padding:6px 9px;font-size:11px;color:var(--text-muted);display:flex;gap:6px;align-items:center"><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.name)}.mp4</span>${r.status === 'done' && (r.b64 || r.videoUrl) ? `<span style="cursor:pointer;color:var(--accent)" onclick="tvDownloadOne(${i})">↓</span>` : ''}</div></div>`;
  }).join('');
}

function _tvBuildItems(){
  if (tvState.mode === 'prompt'){ return _tvParsePrompts().map(p => ({ id: p.name, name: p.name, prompt: p.prompt, image: null })); }
  const mp = state.motionPrompts || {}; const sel = tvSelectedIds();
  return _tvModeRows().filter(s => sel.has(s.id)).map(s => ({ id: s.id, name: _mvVidName(s.id).replace(/\.[^.]+$/, ''), prompt: mp[s.id] || '', image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, sceneId: s.id }));
}

async function tvGenerate(retryOnly){
  if (typeof gateTool === 'function' && gateTool('tool6')) return;
  if (window.__tvRunning) return;
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))){ setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập.', 'error'); return; }
  let items = retryOnly ? tvResults.filter(r => r.status === 'err').map(r => r._item).filter(Boolean) : _tvBuildItems();
  if (!items.length){ setStatusBar('statusMvVid', retryOnly ? 'Không có video lỗi để thử lại.' : (tvState.mode === 'prompt' ? 'Chưa nhập prompt.' : 'Chưa chọn cảnh (hoặc chưa có ảnh).'), 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))){ setStatusBar('statusMvVid', 'Chưa đăng nhập. Vào Cài đặt.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelSlug = document.getElementById('mvVidModel').value.trim();
  let modelKey = '';
  if (modelSlug){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || tvModelKeys; } catch (e){} const mk = tvModelKeys[modelSlug] || TV_BUILTIN_MODEL_KEYS[modelSlug]; if (!mk){ setStatusBar('statusMvVid', '⚠️ Model "' + (TV_MODEL_LABEL[modelSlug] || modelSlug) + '" không hỗ trợ.', 'error'); return; } modelKey = mk; }
  const cMode = document.getElementById('mvVidConc')?.value || '0';
  const conc = cMode === '0' ? Math.min(Math.max(st.accountCount || 1, 1), 8) : (parseInt(cMode) || 1);
  const tvRes = document.getElementById('mvVidRes')?.value || '720p';
  if (tvRes === '1080p'){ try { const us = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if (!us || !us.learned){ setStatusBar('statusMvVid', '⚠️ Chọn 1080p nhưng chưa "học nâng 1080p". Bấm 🎓 Học nâng 1080p (ô vàng) trước, hoặc đổi về 720p.', 'error'); return; } } catch(e){} }
  if (!retryOnly) tvResults = items.map(it => ({ id: it.id, name: it.name, status: 'wait', pct: 0, _item: it }));
  else items.forEach(it => { const r = tvResults.find(x => x.id === it.id); if (r){ r.status = 'wait'; r.pct = 0; r.err = ''; } });
  window.__tvRunning = true; window.__mvVidStop = false; _mvVidSyncBtn(true);
  try { await flowBridge.call('POOL_RESET'); } catch (e) { /* */ }
  tvRenderVideos();
  let done = 0, err = 0; const total = items.length;
  setStatusBar('statusMvVid', `🎬 Render ${total} video · ${conc} luồng… mỗi clip ~1-3 phút.`, 'working');
  // ── Nhật ký chi tiết (kiểu chuyên nghiệp) ──
  const _modelLbl = (typeof TV_MODEL_LABEL !== 'undefined' && TV_MODEL_LABEL[modelSlug]) || modelSlug || 'mặc định';
  const _asCfg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + total + ' video (Text→Video)', 'acc');
  novaLog('  • Model: ' + _modelLbl + ' · Độ dài: ' + durationSecs + 's · Tỉ lệ: ' + aspect + ' · Độ nét: ' + tvRes + (tvRes === '1080p' ? ' (nâng)' : ''), 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc, 'acc');
  novaLog('  • Lưu về máy: ' + (_asCfg.enabled && _asCfg.folder ? _asCfg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  await _mvRunLimited(items, conc, async (it) => {
    if (window.__mvVidStop) return;
    const row = tvResults.find(x => x.id === it.id); if (!row) return;
    row.status = 'gen'; row.pct = 6; tvRenderVideos();
    novaLog('🎬 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → Veo đang dựng…', 'acc');
    const tick = setInterval(() => { if (row.status === 'gen'){ row.pct = Math.min(90, row.pct + Math.random() * 6); tvRenderVideos(); } }, 2500);
    try {
      // C5: cache Veo theo (prompt+model+dur). Cung prompt tao 2 lan -> tra cache, khong ton credit.
      const _cacheHit = _t6VeoCacheGet(it.prompt, modelKey, durationSecs, '');
      if (_cacheHit && _cacheHit.b64){
        try { if (typeof novaLog === 'function') novaLog('Veo cache HIT (' + it.name + ') - tiet kiem credit', 'ok'); } catch(_){}
        clearInterval(tick);
        row.status = 'done'; row.pct = 100; row.b64 = _cacheHit.b64; row.mime = _cacheHit.mime || 'video/mp4';
        done++;
        tvRenderVideos();
        return;
      }
      let r = await flowBridge.call('POOL_GEN_VIDEO', { prompt: it.prompt, aspect, durationSecs, modelKey, resolution: tvRes, sceneId: it.sceneId || it.id, image: it.image || undefined, withData: true });
      r = await _videoAppResolve(r, { resolution: tvRes, aspect });   // extension farm mode → app resolve (+ nâng 1080p nếu chọn)
      clearInterval(tick);
      let savedPath = null;
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        row.status = 'done'; row.pct = 100; row.videoUrl = r.videoUrl || null;
        if (r.video?.b64){ row.b64 = r.video.b64; row.mime = r.video.mime || 'video/mp4'; try { const sv = await autoSaveMedia(it.name + '.mp4', r.video.b64, 'video'); if (sv && sv.path) savedPath = sv.path; } catch (e2) { /* */ } }
        // C5: put cache for next time
        try { if (r.video && r.video.b64) _t6VeoCachePut(it.prompt, modelKey, durationSecs, '', { b64: r.video.b64, mime: r.video.mime || 'video/mp4' }); } catch(_){}
        done++;
      } else { row.status = 'err'; row.err = _bulkFriendlyErr(String((r && (r.error || r.raw)) || 'Không rõ lỗi')); err++; }
      // Nhật ký per-video + xoay tài khoản
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển ' + it.name + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (row.status === 'done'){
          const sz = (r && r.video && r.video.size) ? ' · ' + _logMB(r.video.size) : '';
          const cr = (r && r.credits != null) ? ' · còn ' + r.credits + ' credit' : '';
          const res = (r && r.resolution) ? ' · ' + r.resolution : '';
          novaLog('✅ ' + it.name + '.mp4 · tài khoản ' + ((r && r.account) || '?') + ' · thành công' + res + sz + cr, 'ok');
          if (savedPath) novaLog('   💾 đã lưu: ' + savedPath, 'ok');
        }
        else { const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(String(row.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit' : (row.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e5) {}
    } catch (e){ clearInterval(tick); row.status = 'err'; row.err = e.message || String(e); err++; novaLog('❌ ' + it.name + ' · ' + (e.message || String(e)), 'err'); }
    tvRenderVideos();
    setStatusBar('statusMvVid', `🎬 ${done} xong · ${err} lỗi · còn ${total - done - err}…`, 'working');
  });
  novaLog('━━━ ' + (window.__mvVidStop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + total + ' video' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  window.__tvRunning = false; _mvVidSyncBtn(false);
  tvRenderVideos();
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${done} video.` : `✓ Xong ${done} video${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
}

function tvToggleGen(){ if (window.__tvRunning) window.__mvVidStop = true; else tvGenerate(); }

function _mvVidSyncBtn(running){
  const b = document.getElementById('mvVidGenBtn'); if (!b) return;
  b.disabled = false;
  b.className = running ? 'btn ghost sm' : 'btn primary sm';
  b.style.color = running ? 'var(--red)' : '';
  b.style.borderColor = running ? 'var(--red)' : '';
  b.textContent = running ? '■ Dừng' : '▶ Tạo tất cả';
}

function tvDownloadOne(i){ const r = tvResults[i]; if (!r) return; if (r.b64) _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); else if (r.videoUrl) novaDownloadUrl(r.videoUrl, r.name + '.mp4'); }

async function _videoAppResolve(r, opts){
  if (!r || !r.needsAppResolve || !r.projectId || !r.mediaId || !window.native?.flowChrome) return r;
  const o = opts || {};
  try {
    const rv = await window.native.flowChrome('RESOLVE_VIDEO', { email: r.account, projectId: r.projectId, mediaId: r.mediaId, resolution: o.resolution || '720p', aspect: o.aspect || null, withData: true });
    if (rv && !rv.error && (rv.video?.b64 || rv.videoUrl)) return { ...r, video: rv.video || r.video, videoUrl: rv.videoUrl || r.videoUrl, resolution: rv.resolution || r.resolution };
    return { ...r, ok: false, error: (rv && rv.error) || 'Không lấy được file video (app resolve)' };
  } catch(e){ return { ...r, ok: false, error: 'App resolve lỗi: ' + (e.message || e) }; }
}

async function tvLoadModelKeys(){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || {}; } catch (e){} tvRenderModelOptions(); }

async function tvRefreshModels(){ const sb = (typeof setStatusBar === 'function'); if (sb) setStatusBar('statusMvVid', 'Đang quét model từ Flow…', 'working'); await tvLoadModelKeys(); if (sb) setStatusBar('statusMvVid', 'Đã cập nhật danh sách model.', 'ok'); }

function tvRenderModelOptions(){
  const sel = document.getElementById('mvVidModel'); if (!sel) return;
  const cur = sel.value;
  const merged = Object.assign({}, TV_BUILTIN_MODEL_KEYS, tvModelKeys || {});
  const labels = Object.assign({}, TV_MODEL_LABEL, { 'omni-flash': 'Omni Flash (FREE)' });
  let html = '';
  for (const slug of Object.keys(merged)) { const v = merged[slug]; const key = (v && typeof v === 'object') ? (v.image || v.text) : v; if (typeof key !== 'string' || !key) continue; html += '<option value="' + slug + '"' + (slug === cur ? ' selected' : '') + '>' + (labels[slug] || slug) + '</option>'; }
  if (html) { sel.innerHTML = html; if (typeof tvOnModelChange === 'function') tvOnModelChange(); }
}

function tvOnModelChange(){ const m = document.getElementById('mvVidModel')?.value || ''; const w = document.getElementById('tvDurWrap'); if (w) w.style.display = (/^veo/.test(m) || m === 'omni-flash') ? 'none' : ''; }

function tvOnResChange(){ const r = document.getElementById('mvVidRes')?.value || '720p'; if (r === '1080p') tvRefreshUpsStatus(); else { const row = document.getElementById('tvUpsRow'); if (row) row.style.display = 'none'; } }

async function tvRefreshUpsStatus(){
  const row = document.getElementById('tvUpsRow'); const el = document.getElementById('tvUpsStatus');
  const is1080 = (document.getElementById('mvVidRes')?.value === '1080p');
  try {
    const s = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null);
    if (s && s.learned){ if (row) row.style.display = 'none'; return; }   // đã học → ẩn hộp cho gọn
    if (row) row.style.display = is1080 ? 'flex' : 'none';
    if (el) el.innerHTML = '1080p cần "học" 1 lần: bấm <b>🎓 Học nâng 1080p</b> → trong Flow bấm Tải xuống → 1080p trên 1 video bất kỳ.';
  } catch(e){ if (row) row.style.display = is1080 ? 'flex' : 'none'; }
}

async function tvArmUpscale(){
  const el = document.getElementById('tvUpsStatus');
  if (el) el.innerHTML = '⏳ Đang mở Chrome… hãy bấm <b>Tải xuống → 1080p</b> trên 1 video bất kỳ trong Flow.';
  try {
    const r = await window.native.flowChrome('VIDEO_UPSCALE_ARM').catch(e=>({error:String(e)}));
    if (r && r.error){ if (el) el.innerHTML = '❌ ' + r.error; return; }
    if (el) el.innerHTML = '✅ Đã mở Chrome. Bấm <b>⋮ / Tải xuống → 1080p</b> trên 1 video. Học xong bấm ↻ để kiểm tra.';
    // tự kiểm tra lại sau vài giây
    let n = 0; const iv = setInterval(async () => { n++; const s = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if ((s && s.learned) || n > 40){ clearInterval(iv); tvRefreshUpsStatus(); } }, 3000);
  } catch(e){ if (el) el.innerHTML = '❌ ' + (e.message || e); }
}

function _mvVidName(id){
  const s = mvScenes.find(x => x.id === id);
  if (s && !s.uploaded && s.origId != null){
    const num = /^\d+$/.test(String(s.origId)) ? String(s.origId).padStart(3, '0') : _slug(String(s.origId));
    return num + (s.variant === 'b' ? 'b' : (s.variant === 'a' ? 'a' : '')) + '.mp4';
  }
  if (s && s.uploaded && s.uploadedName){
    return s.uploadedName.replace(/\.[a-z0-9]+$/i, '') + '.mp4';
  }
  // dự phòng: theo thứ tự
  const sv = state.sceneVideos || {};
  const idx = mvScenes.filter(x => sv[x.id] && !sv[x.id].error).findIndex(x => x.id === id);
  return 'canh-' + String((idx < 0 ? 0 : idx) + 1).padStart(3, '0') + '.mp4';
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function _sceneStyleTail(p){
  const base = (_cleanSceneStyle(p && p.sceneStyle) || '').trim().replace(/\s*[.;]\s*$/, '');
  const med = _profileMedium(p).medium;
  const head = base || med || 'consistent cinematic style, cohesive lighting';
  // Chỉ thêm medium khi Scene Style CHƯA nói rõ chất liệu — tránh lặp kiểu "flat-2D … — hand-drawn 2D illustration".
  const said = /\b(2d|flat|hand.?drawn|photo|3d|anime|watercolou?r|line.?art|render)\b/i.test(base);
  return head + (med && (!base || !said) ? ' — ' + med : '') + '. 16:9 cinematic framing. no text, no watermark, no logos.';
}

function _forceStyleTail(prompt, p){
  let s = String(prompt || '').trim();
  s = s.replace(/\s*(?:→\s*)?(?:Modern\s+flat-?2D|Scene aesthetic|Style\s*:|Aesthetic\s*:)[\s\S]*$/i, '');   // cắt từ chỗ AI bắt đầu tả style
  s = s.replace(/\s*(?:\.|,)?\s*(?:no text|no watermark|no logos|all text in English[^.]*|no Korean[^.]*)\.?\s*$/gi, '');
  s = s.replace(/\s*Consistent reference\s*:\s*\[[^\]]+\]\.?\s*$/i, (m) => m);   // giữ nguyên phần tham chiếu nếu có
  s = s.trim().replace(/[.,;\s]+$/, '');
  const ref = /Consistent reference\s*:\s*\[[^\]]+\]/i.exec(prompt || '');
  const refTxt = ref ? ' ' + ref[0].trim().replace(/\.$/, '') + '.' : '';
  s = s.replace(/\s*Consistent reference\s*:\s*\[[^\]]+\]\.?/i, '').trim().replace(/[.,;\s]+$/, '');
  return s + '. ' + _sceneStyleTail(p) + refTxt;
}

function cleanPrompt(p){
  if (!p) return '';
  let s = String(p).trim();
  // Loop strip multiple prefixes if AI stacks them
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s.replace(/^LO[ẠA]I\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.replace(/^TYPE\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.replace(/^\[\s*\d+\s*\]\s*/, '');
    s = s.replace(/^SCENE\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.trim();
    if (s === before) break;
  }
  return s;
}

function _ensureSceneTags(promptText, scene){
  if ((state.descMode || 'tag') !== 'tag' || !scene) return promptText;   // chỉ chế độ Tag mới cần [tag]
  let t = String(promptText || '').trim();
  if (!t) return t;
  // Cảnh GIẢI THÍCH kiểu icon nền trắng (style lai) → KHÔNG chèn tag bối cảnh/nhân vật (icon trên nền trắng, không reference)
  if (/plain\s+(solid\s+)?white background|line-art (pictogram|icon)|pictogram icons?|no scenery/i.test(t)) return t;
  const need = [];
  // Bối cảnh: luôn nên có (kể cả cảnh b-roll vẫn có địa điểm)
  if (scene.background && !t.includes('[' + scene.background + ']')) need.push('[' + scene.background + ']');
  // Nhân vật: cảnh CÓ slug nhân vật (storyboard chỉ gán khi thật sự có người; b-roll/biểu đồ để rỗng) → LUÔN chèn [tag]
  // để đính ĐÚNG ref, không phụ thuộc regex tên vai (dễ sót "monarch", "oncologist"…).
  if (scene.character && !t.includes('[' + scene.character + ']')) need.unshift('[' + scene.character + ']');
  if (need.length) t += (t.endsWith('.') ? ' ' : '. ') + 'Consistent reference: ' + need.join(', ') + '.';
  return t;
}

function _mirrorTagsFromA(promptB, promptA){
  let t = String(promptB || '').trim();
  if (!t) return t;
  const aTags = String(promptA || '').match(/\[[^\[\]]+\]/g) || [];
  const missing = [];
  for (const tag of aTags) if (!t.includes(tag) && !missing.includes(tag)) missing.push(tag);
  if (missing.length) t += (t.endsWith('.') ? ' ' : '. ') + 'Consistent reference: ' + missing.join(', ') + '.';
  return t;
}

function _isLazyPrompt(text){
  let s = String(text || '').trim();
  // bỏ phần đuôi do app tự chèn để xét đúng phần AI viết
  s = s.replace(/\bConsistent reference:.*$/i, '').replace(/--ar\s*\d+:\d+\s*$/i, '').trim();
  if (s.length < 40) return true;                                  // quá ngắn = không phải prompt thật
  if (/^[.\s…]+$/.test(s)) return true;                            // toàn dấu chấm
  if (/\.{2,}\s*full prompt|full prompt\s*\.{2,}|\[full prompt\]|<full prompt>|^\s*\.{3}/i.test(s)) return true;
  if (/\b(same as (above|previous|before)|như (trên|cảnh trước|trước)|tương tự (cảnh )?trên|see above)\b/i.test(s)) return true;
  return false;
}

function startEditPrompt(type, key){
  state.editingPrompt = { type, key };
  rerenderAfterPromptEdit();
  // Focus textarea after render
  setTimeout(() => {
    const ta = document.getElementById('editPromptTA');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function cancelEditPrompt(){
  state.editingPrompt = null;
  rerenderAfterPromptEdit();
}

function saveEditPrompt(){
  const ta = document.getElementById('editPromptTA');
  if (!ta || !state.editingPrompt) return;
  const val = ta.value.trim();
  const { type, key } = state.editingPrompt;
  if (type === 'scene') state.scenePrompts[key] = val;
  else if (type === 'scene2') { if (!state.scenePrompts2) state.scenePrompts2 = {}; state.scenePrompts2[key] = val; }
  else if (type === 'char') state.assetCharPrompts[key] = val;
  else if (type === 'bg') state.assetBgPrompts[key] = val;
  else if (type === 'styleRef') state.styleRefPrompt = val;
  else if (type === 'veo') {
    if (!state.veoPrompts[key]) state.veoPrompts[key] = {};
    state.veoPrompts[key].prompt = val;
  }
  state.editingPrompt = null;
  rerenderAfterPromptEdit();
  saveState(true);
}

function rerenderAfterPromptEdit(){
  if (typeof renderPromptsV === 'function') renderPromptsV();
  if (state.charactersV?.length && typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  if (state.backgroundsV?.length && typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  // Style ref render (handle both view + edit mode)
  renderStyleRef();
}

function renderStyleRef(){
  const body = document.getElementById('t3StyleRefBody');
  if (!body) return;
  const editing = isEditingPrompt('styleRef', null);
  if (editing) {
    body.innerHTML = renderEditPromptUI(state.styleRefPrompt || '');
    setTimeout(() => {
      const ta = document.getElementById('editPromptTA');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 50);
  } else {
    body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:13px">${escapeHtml(state.styleRefPrompt || '')}</div>`;
  }
}

function isEditingPrompt(type, key){
  return state.editingPrompt && state.editingPrompt.type === type && state.editingPrompt.key === key;
}

function renderEditPromptUI(currentValue){
  const safe = String(currentValue || '').replace(/</g, '&lt;');
  return `<textarea id="editPromptTA" style="width:100%;min-height:120px;font-size:12.5px;line-height:1.6;background:var(--surface);border:2px solid var(--accent);padding:10px;border-radius:6px">${safe}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button class="btn primary sm" onclick="saveEditPrompt()">✓ Lưu</button>
      <button class="btn ghost sm" onclick="cancelEditPrompt()">✗ Huỷ</button>
      <span style="font-size:11px;color:var(--text-muted);align-self:center;margin-left:8px">Ctrl+Enter để lưu nhanh</span>
    </div>`;
}

async function notifyDone(title, body){
  if (!('Notification' in window)) return;
  if (document.visibilityState === 'visible') return; // tab đang xem, không cần
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch(e) { return; }
  }
  if (perm !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/brand-logo.ico', tag: 'aivideostudio' });
  } catch(e) {}
}

function _getLib(){
  if (!state.assetLibrary) state.assetLibrary = { chars: {}, bgs: {} };
  if (!state.assetLibrary.chars) state.assetLibrary.chars = {};
  if (!state.assetLibrary.bgs) state.assetLibrary.bgs = {};
  return state.assetLibrary;
}

async function saveToLibraryUI(type, name){
  const isChar = type === 'char';
  const prompt = isChar ? state.assetCharPrompts?.[name] : state.assetBgPrompts?.[name];
  if (!prompt) return alert(`Asset "${name}" chưa có prompt. Generate trước khi lưu Library.`);
  const lib = _getLib();
  const target = isChar ? lib.chars : lib.bgs;
  const isUpdate = !!target[name];
  if (isUpdate && !confirm(`"${name}" đã có trong Library. Ghi đè?`)) return;
  // Save image to IDB if char has image
  let hasImage = false;
  if (isChar && state.characterImages?.[name]) {
    const uid = window.currentUser?.uid;
    if (uid) {
      try {
        await IDB.set(uid + '/libraryImages/' + name, state.characterImages[name]);
        hasImage = true;
      } catch(e) { console.warn('IDB save lib image failed:', e); }
    }
  }
  target[name] = { name, prompt, hasImage, savedAt: Date.now() };
  saveState(true);
  setStatus3(`📚 ✓ Đã lưu "${name}" vào Library${hasImage ? ' (có ảnh)' : ''}.`, 'ok');
  if (document.getElementById('libraryModal')?.style.display === 'flex') renderAssetLibrary();
}

async function deleteFromLibrary(type, name){
  if (!confirm(`Xoá "${name}" khỏi Library?\nVideo đã dùng asset này vẫn không bị ảnh hưởng.`)) return;
  const lib = _getLib();
  const target = type === 'char' ? lib.chars : lib.bgs;
  if (!target[name]) return;
  const hasImg = target[name].hasImage;
  delete target[name];
  if (hasImg) {
    const uid = window.currentUser?.uid;
    if (uid) {
      try { await IDB.set(uid + '/libraryImages/' + name, null); } catch(e) {}
    }
  }
  renderAssetLibrary();
  saveState(true);
}

async function useFromLibrary(type, name){
  const isChar = type === 'char';
  const lib = _getLib();
  const entry = isChar ? lib.chars[name] : lib.bgs[name];
  if (!entry) return false;
  if (isChar) {
    if (!state.assetCharPrompts) state.assetCharPrompts = {};
    state.assetCharPrompts[name] = entry.prompt;
    state.charactersV = state.charactersV || [];
    if (!state.charactersV.includes(name)) state.charactersV.push(name);
    if (entry.hasImage) {
      const uid = window.currentUser?.uid;
      if (uid) {
        try {
          const img = await IDB.get(uid + '/libraryImages/' + name);
          if (img) {
            if (!state.characterImages) state.characterImages = {};
            state.characterImages[name] = img;
          }
        } catch(e) {}
      }
    }
    if (typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  } else {
    if (!state.assetBgPrompts) state.assetBgPrompts = {};
    state.assetBgPrompts[name] = entry.prompt;
    state.backgroundsV = state.backgroundsV || [];
    if (!state.backgroundsV.includes(name)) state.backgroundsV.push(name);
    if (typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  }
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  saveState(true);
  setStatus3(`📚 ✓ Đã pull "${name}" từ Library vào video hiện tại.`, 'ok');
  closeAssetLibrary();
  return true;
}

function checkLibraryFor(type, name){
  const lib = _getLib();
  return type === 'char' ? lib.chars[name] : lib.bgs[name];
}

function closeAssetLibrary(){
  const m = document.getElementById('libraryModal');
  if (m) m.style.display = 'none';
}

function switchLibTab(tab){
  _libTab = tab;
  document.querySelectorAll('.lib-tab').forEach(b => {
    const active = b.dataset.tab === tab;
    b.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    b.style.color = active ? 'var(--text)' : 'var(--text-muted)';
    b.style.fontWeight = active ? '600' : '400';
  });
  renderAssetLibrary();
}

function renderAssetLibrary(){
  const content = document.getElementById('libContent');
  if (!content) return;
  const lib = _getLib();
  const charCount = Object.keys(lib.chars).length;
  const bgCount = Object.keys(lib.bgs).length;
  const cc = document.getElementById('libCharCount'); if (cc) cc.textContent = charCount;
  const bc = document.getElementById('libBgCount'); if (bc) bc.textContent = bgCount;
  const target = _libTab === 'chars' ? lib.chars : lib.bgs;
  const items = Object.values(target).sort((a,b) => (b.savedAt||0) - (a.savedAt||0));
  const search = (document.getElementById('libSearch')?.value || '').toLowerCase().trim();
  const filtered = items.filter(a => !search || a.name.toLowerCase().includes(search));
  if (filtered.length === 0) {
    content.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--text-muted);font-size:13px">
      ${search ? `Không tìm thấy "${escapeHtml(search)}".` : 'Library rỗng. Vào Tool 3, bấm <strong>💾 Lưu Library</strong> trên prompt asset để bắt đầu.'}
    </div>`;
    return;
  }
  const typeKey = _libTab === 'chars' ? 'char' : 'bg';
  content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px">` +
    filtered.map(a => {
      const nameEsc = a.name.replace(/'/g, "\\'");
      const promptPreview = (a.prompt || '').slice(0, 200);
      const dateStr = a.savedAt ? new Date(a.savedAt).toLocaleDateString('vi-VN') : '';
      return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:8px">
          <strong style="font-size:13px;line-height:1.3;word-break:break-word">${escapeHtml(a.name)}</strong>
          ${a.hasImage ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:2px 6px;border-radius:8px;white-space:nowrap">🖼 Có ảnh</span>' : ''}
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);line-height:1.55;flex:1;max-height:80px;overflow:hidden;margin-bottom:10px">${escapeHtml(promptPreview)}${a.prompt.length>200?'...':''}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn primary sm" style="flex:1;font-size:11.5px" onclick="useFromLibrary('${typeKey}','${nameEsc}')">↓ Dùng vào video này</button>
          <button class="btn ghost sm" onclick="deleteFromLibrary('${typeKey}','${nameEsc}')" title="Xoá khỏi Library">🗑</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;text-align:right">Lưu: ${dateStr}</div>
      </div>`;
    }).join('') + '</div>';
}

function copyText(t){
  navigator.clipboard.writeText(t);
}

function downloadJSON(obj, name){
  const b = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  URL.revokeObjectURL(u);
}

function setSyncStatus(msg, type){
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const colors = { ok: 'var(--green)', err: 'var(--red)', working: 'var(--violet)', info: 'var(--text-dim)' };
  el.textContent = msg;
  el.style.color = colors[type] || colors.info;
}

async function loadCloudState(){
  if (!window.currentUser || !window.firebaseLoadDoc) return;
  const uid = window.currentUser.uid;
  try {
    // 1. Load state nhẹ từ Firestore
    const data = await window.firebaseLoadDoc(uid);
    if (data && data.state) {
      Object.assign(state, data.state);
      console.log('✓ Loaded state from Firestore');
    }
    // 1b. Load tier + hạn dùng (proUntil). Hết hạn → tự về free.
    state.userTier = (data && data.tier) || 'free';
    state.proUntil = (data && data.proUntil) || null;
    if ((state.userTier === 'pro' || state.userTier === 'max') && state.proUntil && Date.now() > state.proUntil) {
      state.userTier = 'free';
      console.log('⏰ Pro đã hết hạn → về Free.');
    }
    console.log('✓ User tier:', state.userTier);
    // Backfill email vào doc để trang admin thấy được (chỉ ghi khi thiếu/khác).
    if (window.currentUser?.email && data?.email !== window.currentUser.email && window.firebaseSaveDoc) {
      window.firebaseSaveDoc(window.currentUser.uid, { email: window.currentUser.email }).catch(() => {});
    }
    // 1c. Migration: ensure all profiles have profileId + workData; migrate global state nếu cần
    if (typeof migrateProfiles === 'function' && state.profiles?.length) {
      const migrated = migrateProfiles();
      if (migrated) saveCloudState(true);
    }
    // 1d. Load current profile's workData → state (pull data từ profile vào state)
    const curP = getProfile();
    if (curP) {
      await mergeLocalWorkData(curP);   // nạp kịch bản/cảnh local (IDB) đè bản cloud có thể lưu hụt (doc >1MB)
      loadStateFromProfile(curP);
      // One-time: bản cũ mặc định "Xen video Veo" = Vừa(6); nay mặc định TẮT → đưa các video còn kẹt giá trị cũ (6) về 0. Chạy SAU khi đã merge/nạp để bắt giá trị cuối; 1 lần; KHÔNG đụng lựa chọn khác (8/10/…).
      try {
        if (!localStorage.getItem('vmDefaultOff2')) {
          (state.profiles || []).forEach(p => (p.videos || []).forEach(v => { if (v.workData && v.workData.videoMix === 6) v.workData.videoMix = 0; }));
          if (state.videoMix === 6) { state.videoMix = 0; const vmEl = document.getElementById('t2VideoMix'); if (vmEl) vmEl.value = '0'; }
          localStorage.setItem('vmDefaultOff2', '1');
          saveCloudState(true);   // ghi 0 xuống IDB/cloud để giữ luôn
        }
      } catch (e) {}
      // 2. Load ảnh (asset chung profile + cảnh riêng video) từ IndexedDB
      try {
        await loadProfileImages(curP.profileId, _curVideoId(curP));
        console.log('✓ Loaded images from IndexedDB for profile:', curP.profileId);
      } catch (e) {
        console.warn('IDB load failed:', e);
      }
    } else {
      // Không có profile → state rỗng
      loadStateFromProfile(null);
    }
    // 3. Render tier-dependent UI
    renderTierBadge();
    if (typeof initAdminUI === 'function') initAdminUI();
  } catch (e) {
    console.warn('Cloud load failed:', e);
  }
}

function _lightWorkData(wd){ if (!wd || typeof wd !== 'object') return {}; const o = {}; for (const k of _WD_LIGHT_KEYS) if (wd[k] !== undefined) o[k] = wd[k]; return o; }

async function saveCloudState(immediate = false, skipImages = false){
  if (!window.currentUser || !window.firebaseSaveDoc) return;
  clearTimeout(_saveTimer);
  const doSave = async () => {
    const uid = window.currentUser.uid;
    setSyncStatus('💾 Đang lưu...', 'working');
    // Sync state.{...} → current profile's workData trước khi save
    if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile();
    // Tách ảnh + working data ra khỏi state root (Firestore giới hạn 1MB/doc; userTier là admin-controlled).
    const { styleRefImages, characterImages, sceneImages, sceneImagesB, backgroundImages, userTier,
            script, scenes, scenePrompts, charactersV, backgroundsV,
            assetCharPrompts, assetBgPrompts, styleRefPrompt, veoPrompts, pexelsResults, mediaPicks, ytCandidates,
            sceneVideos, motionPrompts,
            ...lightState } = state;
    const curP = getProfile();
    const pid = curP?.profileId;
    const vid = curP ? _curVideoId(curP) : 'v_main';
    // ① LƯU LOCAL (IndexedDB) TRƯỚC — quan trọng nhất. Cloud lỗi (doc >1MB khi nhiều cảnh) KHÔNG được làm mất dữ liệu máy.
    try {
      if (pid) {
        const b = uid + '/' + pid + '/' + vid + '/';
        // workData (kịch bản/cảnh/prompt) LUÔN lưu, kể cả light save → sống qua restart, không dính giới hạn 1MB Firestore.
        try { const _cv = getCurrentVideo(curP); if (_cv && _cv.workData) await IDB.set(b + 'workData', _cv.workData); } catch (e) { console.warn('IDB workData save failed:', e); }
        if (!skipImages) {
          // Mỗi VIDEO có bộ ảnh riêng (chỉ Style TEXT dùng chung — nằm trong profile object).
          await IDB.set(b + 'styleRefImages', styleRefImages || []);
          await IDB.set(b + 'characterImages', characterImages || {});
          await IDB.set(b + 'backgroundImages', backgroundImages || {});
          await IDB.set(b + 'sceneImages', sceneImages || {});
          await IDB.set(b + 'sceneImagesB', sceneImagesB || {});
          await IDB.set(b + 'sceneVideoBlobs', mvVideoBlobs || {});
          await IDB.set(b + 'sceneVideosMeta', sceneVideos || {});
          await IDB.set(b + 'motionPrompts', motionPrompts || {});
        }
      }
    } catch (e) { console.warn('IDB save failed:', e); try { setSyncStatus('⚠️ Lưu máy LỖI (ảnh/clip) — ' + String(e && e.message || e).slice(0, 60), 'error'); } catch (_) {} }
    // Lưu workData các video xuống IDB — CHỈ khi workData ĐẦY ĐỦ (có cảnh) HOẶC là video ĐANG MỞ.
    // ⛔ TUYỆT ĐỐI KHÔNG ghi bản NHẸ (từ cloud, video chưa mở) đè lên bản đầy đủ trong IDB → tránh mất dữ liệu video đã làm xong.
    try {
      for (const P of (state.profiles || [])){
        if (!P.profileId || !Array.isArray(P.videos)) continue;
        for (const v of P.videos){
          if (!v || !v.id || !v.workData) continue;
          const isCur = (P.profileId === pid && v.id === vid);
          const isFull = Array.isArray(v.workData.scenes) && v.workData.scenes.length > 0;   // CÓ cảnh = bản đầy đủ (bản nhẹ từ cloud KHÔNG có scenes)
          if (isCur || isFull) await IDB.set(uid + '/' + P.profileId + '/' + v.id + '/workData', v.workData);
          // else: bản NHẸ (video chưa mở phiên này, chỉ có script/metadata) → GIỮ NGUYÊN bản đầy đủ trong IDB, KHÔNG đè.
        }
      }
    } catch (e) { console.warn('IDB all-workData save failed:', e); try { setSyncStatus('⚠️ Lưu máy LỖI — dữ liệu có thể mất khi tải lại: ' + String(e && e.message || e).slice(0, 60), 'error'); } catch (_) {} }
    // ② Rồi lưu cloud (state nhẹ) — profiles đã CẮT workData nặng → doc nhỏ, không vượt 1MB → profile/metadata luôn lưu được.
    try {
      const cloudProfiles = (lightState.profiles || []).map(P => (P && Array.isArray(P.videos)) ? { ...P, videos: P.videos.map(v => ({ ...v, workData: _lightWorkData(v.workData) })) } : P);
      await window.firebaseSaveDoc(uid, {
        state: { ...lightState, profiles: cloudProfiles },
        email: window.currentUser?.email || null,   // để trang admin hiện email
        updatedAt: Date.now()
      });
      setSyncStatus('✓ Đã đồng bộ', 'ok');
    } catch (e) {
      console.warn('Cloud save failed:', e);
      // Local đã lưu → không mất gì; chỉ đồng bộ đám mây trượt (thường do storyboard nhiều cảnh > 1MB).
      if (e.code === 'invalid-argument' || /too large|maximum|exceeds|larger than/i.test(e.message || '')) setSyncStatus('✓ Đã lưu (máy) · cloud bỏ qua (quá lớn)', 'ok');
      else setSyncStatus('✓ Đã lưu (máy) · cloud lỗi', 'ok');
    }
  };
  if (immediate) {
    await doSave();
  } else {
    _saveTimer = setTimeout(doSave, 600);
  }
}

async function saveState(immediate, skipImages){ return saveCloudState(immediate, skipImages); }

function initAppDirect(){
  // Ẩn mọi mảng tài khoản/đăng nhập còn sót (phòng khi HTML cũ bị cache)
  ['userBoxAuth','userBoxGuest','authGate'].forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  var sec = document.querySelector('.user-section'); if (sec) sec.style.display = 'none';
  // Load API settings cục bộ để dùng tool ngay + dựng UI
  if (typeof loadApiSettings === 'function') { try { loadApiSettings(); } catch (e) {} }
  if (typeof _relocateUserBox === 'function') _relocateUserBox();
  if (typeof restoreUI === 'function') restoreUI();
  if (typeof renderTierBadge === 'function') renderTierBadge();
}

function getProfile(){ return state.currentProfileIdx >= 0 ? state.profiles[state.currentProfileIdx] : null; }

function makeEmptyProfile(){
  return {
    profileId: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    tenKenh: '', ngach: '',
    visualStyle: 'Crayon Capital — Dark',
    ngonNgu: 'Tiếng Việt',
    povStyle: 'Ngôi thứ 2 (Bạn)',
    cauTruc: 'Levels / Escalation / POV',
    soPhan: 8, targetPhut: 12,
    characterStyle: '', backgroundStyle: '', sceneStyle: '',
    charIdentity: '',
    promptRules: 'No text, no watermark, consistent character design, avoid gore',
    styleGuide: '', dnaKenh: '', chuDe: '',
    characters: [], backgrounds: [],
    workData: createEmptyWorkData()  // Per-profile working data
  };
}

function createEmptyWorkData(){
  return {
    script: '',
    scenes: [],
    scenePrompts: {},
    scenePrompts2: {},
    charactersV: [],
    backgroundsV: [],
    assetCharPrompts: {},
    assetBgPrompts: {},
    styleRefPrompt: '',
    veoPrompts: {},
    pexelsResults: {},
    mediaPicks: {},
    stockCandidates: {},
    ytCandidates: {},
    seo: null,            // gói SEO đã tạo (tiêu đề/mô tả/tags/chapters) — lưu THEO VIDEO
    seoTitle: '',         // tiêu đề đã chốt (dùng cho thumbnail)
    sceneTrans: {},
    wardrobe: {},
    descMode: 'tag',
    charBible: {},
    bgBible: {},
    t3Era: '',
    t3BgLayout: 'single',
    nguonBat: { veo: false, stock: false, yt: false, kho: false, web: false },
    webBat: null,          // null → dựng mặc định lần đầu chạm tới (chỉ nhóm tư liệu công)
    webCandidates: {},
    videoMix: 0,
    stockMix: 0,
    ytMix: 0,
    stockType: 'videos',
    videoLogline: '',
    brandProfile: null
  };
}

function makeEmptyVideo(name){
  return { id: 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || 'Video 1', createdAt: Date.now(), workData: createEmptyWorkData() };
}

function _ensureVideos(p){
  if (!p) return;
  if (!Array.isArray(p.videos) || !p.videos.length){
    p.videos = [{ id: 'v_main', name: 'Video 1', createdAt: p.createdAt || Date.now(), workData: p.workData || createEmptyWorkData() }];
    p.currentVideoId = 'v_main';
    try { delete p.workData; } catch (e) { p.workData = undefined; }   // tránh nhân đôi khi lưu
  }
  if (!p.currentVideoId || !p.videos.some(v => v.id === p.currentVideoId)) p.currentVideoId = p.videos[0].id;
}

function getCurrentVideo(p){ p = p || getProfile(); if (!p) return null; _ensureVideos(p); return p.videos.find(v => v.id === p.currentVideoId) || p.videos[0]; }

function _curVideoId(p){ const v = getCurrentVideo(p); return v ? v.id : 'v_main'; }

function syncStateToCurrentProfile(){
  const v = getCurrentVideo();
  if (!v) return;
  if (!v.workData) v.workData = createEmptyWorkData();
  const p = { workData: v.workData };   // ghi vào workData của video hiện tại
  p.workData.script = state.script || '';
  p.workData.scenes = state.scenes || [];
  p.workData.scenePrompts = state.scenePrompts || {};
  p.workData.scenePrompts2 = state.scenePrompts2 || {};
  p.workData.charactersV = state.charactersV || [];
  p.workData.backgroundsV = state.backgroundsV || [];
  p.workData.assetCharPrompts = state.assetCharPrompts || {};
  p.workData.assetBgPrompts = state.assetBgPrompts || {};
  p.workData.styleRefPrompt = state.styleRefPrompt || '';
  p.workData.veoPrompts = state.veoPrompts || {};
  p.workData.pexelsResults = state.pexelsResults || {};
  p.workData.mediaPicks = state.mediaPicks || {};
  p.workData.stockCandidates = state.stockCandidates || {};
  // Vứt mục giả "(chọn tay)" khỏi dự án luôn — không phải ứng viên, giữ chỉ tổ rác.
  try { const yc = state.ytCandidates || {};
    for (const k in yc) if (Array.isArray(yc[k])) yc[k] = yc[k].filter(x => x && x.url && x.title !== '(chọn tay)');
  } catch (e) {}
  p.workData.ytCandidates = state.ytCandidates || {};
  // SEO: lưu theo VIDEO để thoát app không mất (trước đây chỉ nằm trong biến tạm t9State)
  try { p.workData.seo = (typeof t9State === 'object' && t9State && t9State.result) ? t9State.result : (p.workData.seo || null); } catch (e) {}
  try { p.workData.seoTitle = (document.getElementById('t9Title')?.value || document.getElementById('t10TitleInput')?.value || p.workData.seoTitle || '').trim(); } catch (e) {}
  // ⚠️ sceneSpecs trước đây chỉ ĐỌC từ dự án mà không ghi lại — thoát app là mất sạch đồ hoạ.
  p.workData.sceneSpecs = state.sceneSpecs || {};
  // Trợ lý dựng: bản đồ vai trò + hàng đề xuất đã duyệt. Không lưu thì mở lại phải
  // chạy lại cả 60+ lượt gọi cho một việc vừa làm xong 5 phút trước.
  p.workData.nguonBat = state.nguonBat || {};
  // 55 nền tảng web bật/tắt + ứng viên đã tìm cho từng cảnh — không lưu thì mở
  // lại phải tìm lại từ đầu, mà tìm web có trần nhịp nên rất tốn.
  p.workData.webBat = state.webBat || {};
  p.workData.webCandidates = state.webCandidates || {};
  p.workData.aiMap = state.aiMap || {};
  p.workData.aiQueue = state.aiQueue || [];
  p.workData.globalGfx = state.globalGfx || [];
  // Nguồn clip YouTube của từng cảnh — cần để biết thẻ nào đang được dùng khi mở lại.
  // CHỈ lưu url/dur/start: heatmap là mảng 100 phần tử, nhân với gần 200 cảnh là phình
  // workData vô ích, mà từ khi bỏ thanh chọn đoạn thì không ai đọc tới nữa.
  try {
    const cs = {};
    for (const [k, v] of Object.entries(state.clipSrc || {})) {
      if (v && v.url) cs[k] = { url: v.url, dur: v.dur || 0, start: v.start || 0 };
    }
    p.workData.clipSrc = cs;
  } catch (e) {}
  p.workData.sceneTrans = state.sceneTrans || {};
  p.workData.wardrobe = state.wardrobe || {};
  p.workData.descMode = state.descMode || 'tag';
  p.workData.charBible = state.charBible || {};
  p.workData.bgBible = state.bgBible || {};
  p.workData.t3Era = state.t3Era || '';
  p.workData.t3BgLayout = state.t3BgLayout || 'single';
  p.workData.videoMix = (state.videoMix != null ? state.videoMix : 0);
  p.workData.shortRefPrompt = !!state.shortRefPrompt;
  p.workData.stockMix = (state.stockMix != null ? state.stockMix : 0);
  p.workData.ytMix = (state.ytMix != null ? state.ytMix : 0);
  p.workData.stockType = state.stockType || 'videos';
  p.workData.videoLogline = state.videoLogline || '';
  p.workData.sceneTypesOn = (Array.isArray(state.sceneTypesOn) && state.sceneTypesOn.length) ? state.sceneTypesOn : SCENE_TYPES_CORE.slice();
  p.workData.brandProfile = state.brandProfile || null;
}

function loadStateFromProfile(p){
  const v = p ? getCurrentVideo(p) : null;
  const wd = (v && v.workData) || createEmptyWorkData();
  state.script = wd.script || '';
  state.scenes = wd.scenes || [];
  state.scenePrompts = wd.scenePrompts || {};
  state.scenePrompts2 = wd.scenePrompts2 || {};
  state.charactersV = wd.charactersV || [];
  state.backgroundsV = wd.backgroundsV || [];
  state.assetCharPrompts = wd.assetCharPrompts || {};
  state.assetBgPrompts = wd.assetBgPrompts || {};
  state.styleRefPrompt = wd.styleRefPrompt || '';
  state.veoPrompts = wd.veoPrompts || {};
  state.pexelsResults = wd.pexelsResults || {};
  state.mediaPicks = wd.mediaPicks || {};
  state.stockCandidates = wd.stockCandidates || {};
  state.ytCandidates = wd.ytCandidates || {};
  // Nạp lại gói SEO của video này + vẽ lại kết quả
  try {
    if (typeof t9State === 'object' && t9State) t9State.result = wd.seo || null;
    const _st = document.getElementById('t9Title'), _tt = document.getElementById('t10TitleInput');
    if (_st) _st.value = wd.seoTitle || '';
    if (_tt) _tt.value = wd.seoTitle || '';
    if (wd.seo && typeof t9RenderResults === 'function') setTimeout(() => { try { t9RenderResults(wd.seo); } catch (e) {} }, 60);
    else { const box = document.getElementById('t9Results'); if (box) box.style.display = 'none'; }
    if (typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 120);
  } catch (e) {}
  state.sceneTrans = wd.sceneTrans || {};
  state.wardrobe = wd.wardrobe || {};
  state.descMode = wd.descMode || 'tag';
  state.charBible = wd.charBible || {};
  state.bgBible = wd.bgBible || {};
  state.t3Era = wd.t3Era || '';
  state.t3BgLayout = wd.t3BgLayout || 'single';
  state.videoMix = (wd.videoMix != null ? wd.videoMix : 0);
  state.shortRefPrompt = !!wd.shortRefPrompt;
  state.stockMix = (wd.stockMix != null ? wd.stockMix : 0);
  state.ytMix = (wd.ytMix != null ? wd.ytMix : 0);
  state.stockType = wd.stockType || 'videos';
  state.sceneTypesOn = (Array.isArray(wd.sceneTypesOn) && wd.sceneTypesOn.length) ? wd.sceneTypesOn.filter(k => SCENE_TYPES[k]) : SCENE_TYPES_CORE.slice();
  state.videoLogline = wd.videoLogline || '';
  state.nguonBat = wd.nguonBat || { veo: false, stock: false, yt: false, kho: false, web: false };
  state.webBat = (wd.webBat && typeof wd.webBat === 'object') ? wd.webBat : null;   // null → _webBat() dựng mặc định (chỉ nhóm tư liệu công)
  state.webCandidates = wd.webCandidates || {};
  state.aiMap = wd.aiMap || {};
  state.aiQueue = Array.isArray(wd.aiQueue) ? wd.aiQueue : [];
  state.brandProfile = wd.brandProfile || null;
  // logline đã lưu coi như khớp kịch bản đã lưu → set chữ ký để khỏi sinh lại thừa sau reload
  const _lgScript = (wd.script || '').trim();
  state.videoLoglineSig = (state.videoLogline && _lgScript) ? (_lgScript.length + '|' + _lgScript.slice(0, 60)) : '';
  const loglineEl = document.getElementById('videoLogline');
  if (loglineEl) loglineEl.value = state.videoLogline;
  const eraEl2 = document.getElementById('t3Era');
  if (eraEl2) eraEl2.value = state.t3Era;
  const bgLayoutEl2 = document.getElementById('t3BgLayout');
  if (bgLayoutEl2) bgLayoutEl2.value = state.t3BgLayout;
  const bgLayoutEl2b = document.getElementById('t2BgLayout');
  if (bgLayoutEl2b) bgLayoutEl2b.value = state.t3BgLayout || 'single';
  const vmEl = document.getElementById('t2VideoMix');
  if (vmEl) vmEl.value = String(state.videoMix != null ? state.videoMix : 0);
  const srEl = document.getElementById('t2ShortRef');
  if (srEl) srEl.checked = !!state.shortRefPrompt;
  const smEl = document.getElementById('t2StockMix');
  if (smEl) smEl.value = String(state.stockMix != null ? state.stockMix : 0);
  const ymEl = document.getElementById('t2YtMix');
  if (ymEl) ymEl.value = String(state.ytMix != null ? state.ytMix : 0);
  try { _t2ChuyenNguonCu(); } catch (e) {}   // thiết lập cũ → bảng ⚙ (một lần)
  try { t2RenderNguon(); } catch (e) {}
  const dm = document.getElementById('t2DescMode');
  if (dm) dm.value = state.descMode;
  // Images sẽ load từ IDB theo profileId — clear trước
  state.characterImages = {};
  state.sceneImages = {};
  state.sceneImagesB = {};
  state.backgroundImages = {};
  state.styleRefImages = [];
}

async function mergeLocalWorkData(p, videoId){
  try {
    const uid = window.currentUser?.uid;
    if (!uid || !p || !p.profileId) return;
    _ensureVideos(p);
    const vid = videoId || _curVideoId(p);
    let wd = await IDB.get(uid + '/' + p.profileId + '/' + vid + '/workData');
    if (wd == null && vid === 'v_main') wd = await IDB.get(uid + '/' + p.profileId + '/workData');   // key cũ (trước khi tách video)
    if (wd && typeof wd === 'object' && ((Array.isArray(wd.scenes) && wd.scenes.length) || (typeof wd.script === 'string' && wd.script.trim()))) {
      const v = p.videos.find(x => x.id === vid) || getCurrentVideo(p);
      if (v) v.workData = { ...(v.workData || {}), ...wd };   // máy là nguồn chính → local đè cloud
    }
  } catch (e) { console.warn('mergeLocalWorkData:', e); }
}

async function loadProfileImages(profileId, videoId){
  const uid = window.currentUser?.uid;
  if (!uid || !profileId) return;
  const p = getProfile();
  const vid = videoId || (p && p.profileId === profileId ? _curVideoId(p) : 'v_main');
  const prof = uid + '/' + profileId + '/';             // key cũ (trước khi tách video)
  const vbase = uid + '/' + profileId + '/' + vid + '/'; // dữ liệu RIÊNG từng video
  const useLegacy = (vid === 'v_main');                  // chỉ Video 1 (migrate) kế thừa ảnh cũ
  const g = async (name, empty) => {
    let v = await IDB.get(vbase + name);
    const isEmpty = v == null || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) || (Array.isArray(v) && !v.length);
    if (isEmpty && useLegacy){ const lg = await IDB.get(prof + name); if (lg != null) v = lg; }
    return v == null ? empty : v;
  };
  try {
    // Tất cả ảnh đều RIÊNG từng video (chỉ Style TEXT dùng chung).
    state.characterImages = await g('characterImages', {});
    state.backgroundImages = await g('backgroundImages', {});
    state.styleRefImages = await g('styleRefImages', []);
    state.sceneImages = await g('sceneImages', {});
    state.sceneImagesB = await g('sceneImagesB', {});
    try {
      mvVideoBlobs = await g('sceneVideoBlobs', {});
      state.sceneVideos = await g('sceneVideosMeta', {});
      state.motionPrompts = await g('motionPrompts', {});
      if (typeof mvVideoRender === 'function') mvVideoRender();
    } catch (e){ /* */ }
    // 🎙 Giọng đọc (MP3) RIÊNG từng video → nạp lại; không có thì xoá cho sạch (mỗi video 1 MP3).
    try {
      let mp3 = await IDB.get(vbase + 'voiceMp3');
      if (mp3 == null && useLegacy) mp3 = await IDB.get(prof + 'voiceMp3');
      if (mp3){
        const f = (mp3 instanceof File) ? mp3 : new File([mp3], (mp3.name || 'voice.mp3'), { type: mp3.type || 'audio/mpeg' });
        _autoAudioFile = f; _autoAudioWords = null;
        if (typeof t7State === 'object' && t7State){ t7State.audioFile = f; t7State.audioPeaks = null; }
        const vi = document.getElementById('t7VoInfo'); if (vi) vi.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
        if (typeof t2AudioInfo === 'function') t2AudioInfo(f);
        if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
        if (typeof _t7DecodePeaks === 'function') _t7DecodePeaks(f).then(r => { if (t7State){ t7State.audioPeaks = r?.peaks || null; t7State.audioDur = r?.duration || 0; if (typeof _t7CoverAudio === 'function') _t7CoverAudio(); } if (state.tool === 'tool7'){ if (typeof t7RenderRows === 'function') t7RenderRows(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); } }).catch(() => {});
      } else {
        if (typeof _t2ResetTimingAudio === 'function') _t2ResetTimingAudio();
        if (typeof t7State === 'object' && t7State){ t7State.audioFile = null; t7State.audioPeaks = null; }
        const vi = document.getElementById('t7VoInfo'); if (vi) vi.textContent = 'Chưa có giọng đọc';
      }
    } catch (e){ /* */ }
  } catch(e) { console.warn('Load workspace images failed:', e); }
}

function migrateProfiles(){
  let needSave = false;
  state.profiles.forEach(p => {
    if (!p.profileId) {
      p.profileId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      needSave = true;
    }
  });
  // One-time (rất cũ): global state → workData của profile hiện tại — TRƯỚC khi bọc videos.
  const curP = getProfile();
  if (curP && !Array.isArray(curP.videos)) {
    const wd = curP.workData;
    const wdEmpty = !wd || (!wd.script && !(wd.scenes && wd.scenes.length));
    const hasGlobal = state.script || (state.scenes && state.scenes.length) || (state.scenePrompts && Object.keys(state.scenePrompts).length);
    if (wdEmpty && hasGlobal) {
      curP.workData = {
        script: state.script || '', scenes: state.scenes || [], scenePrompts: state.scenePrompts || {},
        charactersV: state.charactersV || [], backgroundsV: state.backgroundsV || [],
        assetCharPrompts: state.assetCharPrompts || {}, assetBgPrompts: state.assetBgPrompts || {},
        styleRefPrompt: state.styleRefPrompt || '', veoPrompts: state.veoPrompts || {},
        pexelsResults: state.pexelsResults || {}, mediaPicks: state.mediaPicks || {},
        stockCandidates: state.stockCandidates || {}
        , sceneTrans: state.sceneTrans || {}, wardrobe: state.wardrobe || {}
      };
      needSave = true;
      console.log('✓ Migrated global state → workData');
    }
  }
  // Bọc workData → videos[] (Video 1 = 'v_main'), xoá workData thừa (khỏi nhân đôi khi lưu Firestore).
  state.profiles.forEach(p => {
    if (!Array.isArray(p.videos) || !p.videos.length){ _ensureVideos(p); needSave = true; }
  });
  return needSave;
}

function rerenderAllAfterProfileLoad(){
  if (typeof renderVideoSelect === 'function') renderVideoSelect();
  if (typeof _syncChLang === 'function') _syncChLang();   // NGÔN NGỮ theo profile: nạp lại dropdown + áp vào tool ở MỌI lần đổi/tạo/mở profile
  // Script textarea (Tool 2) — ID đúng là scriptInput
  const sc = document.getElementById('scriptInput'); if (sc) sc.value = state.script || '';
  // Prescan output textareas (Tool 2)
  const csIn = document.getElementById('charsInputV'); if (csIn) csIn.value = (state.charactersV || []).join('\n');
  const bgIn = document.getElementById('bgInputV'); if (bgIn) bgIn.value = (state.backgroundsV || []).join('\n');
  // Tool 3 char/bg textareas
  const charTA = document.getElementById('t3Characters'); if (charTA) charTA.value = (state.charactersV || []).join('\n');
  const bgTA = document.getElementById('t3Backgrounds'); if (bgTA) bgTA.value = (state.backgroundsV || []).join('\n');
  // Tool 3 Style Prompts (display, từ profile object)
  const p = getProfile();
  const t3CS = document.getElementById('t3CharStyle'); if (t3CS) t3CS.value = p?.characterStyle || '';
  const t3CSB = document.getElementById('t3CharStyleB'); if (t3CSB) t3CSB.value = p?.characterStyleB || '';
  const t3BS = document.getElementById('t3BgStyle'); if (t3BS) t3BS.value = p?.backgroundStyle || '';
  const t3SS = document.getElementById('t3SceneStyle'); if (t3SS) t3SS.value = p?.sceneStyle || '';
  const t3PR = document.getElementById('t3PromptRules'); if (t3PR) t3PR.value = p?.promptRules || '';
  // Tool 3 Visual Style/Ngạch/POV
  const t3Vs = document.getElementById('t3VisualStyle'); if (t3Vs) t3Vs.value = p?.visualStyle || '';
  const t3Ng = document.getElementById('t3Ngach'); if (t3Ng) t3Ng.value = p?.ngach || '';
  const t3Pv = document.getElementById('t3PovStyle'); if (t3Pv) t3Pv.value = p?.povStyle || '';
  // Tool 2 visual style readonly
  const v2 = document.getElementById('visualStyle2'); if (v2) v2.value = p?.visualStyle || '';
  // Tool 6 Veo settings
  const v6Vs = document.getElementById('v6VisualStyle'); if (v6Vs) v6Vs.value = p?.visualStyle || '';
  // Unified textareas + lists
  if (typeof renderAllT2 === 'function') renderAllT2();
  if (typeof renderTable === 'function') renderTable();
  if (typeof renderPreview === 'function') renderPreview();
  if (typeof renderPromptsV === 'function') renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (state.tool === 'tool7' && typeof t7Build === 'function') { try { t7Build(); } catch (e) {} }
  if (typeof updateStats === 'function') updateStats();
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  if (state.charactersV?.length && typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  else { const cl = document.getElementById('t3CharPromptsList'); if (cl) cl.innerHTML = '<div class="empty-state">Chưa có nhân vật.</div>'; }
  if (state.backgroundsV?.length && typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  else { const bl = document.getElementById('t3BgPromptsList'); if (bl) bl.innerHTML = '<div class="empty-state">Chưa có bối cảnh.</div>'; }
  // Style Reference panel
  const stPanel = document.getElementById('styleRefPanel');
  if (stPanel) stPanel.style.display = state.styleRefPrompt ? 'block' : 'none';
  if (typeof renderStyleRef === 'function') renderStyleRef();
  // Tool 5 search results
  document.querySelectorAll('[id^="media-results-"]').forEach(el => el.innerHTML = '');
  // Tool 3 character image gallery
  if (typeof renderCharImageGallery === 'function') renderCharImageGallery();
  if (typeof renderStyleImageGallery === 'function') renderStyleImageGallery();
  // Char count display
  if (typeof updateScriptCount === 'function') updateScriptCount();
  syncTool2FromProfile();
  renderProfileStyles();
}

function renderProfileSelect(){
  const sel = document.getElementById('profileSelect');
  if (!sel) return;
  sel.innerHTML = state.profiles.map((p, i) =>
      `<option value="${i}" ${i === state.currentProfileIdx ? 'selected' : ''}>${escapeHtml(p.tenKenh || 'Profile ' + (i + 1))}</option>`
    ).join('') + '<option value="__new">＋ Tạo Profile mới</option>';
}

function _profileLang(){ const p = getProfile(); return (p && p.ngonNgu) || 'Tiếng Việt'; }

function _langVoiceCode(lang){ return _LANG_VOICE[lang || _profileLang()] || null; }

function _applyLangToTools(lang){
  const ts = document.getElementById('tsLang');
  if (ts){ if (![...ts.options].some(o => o.value === lang || o.textContent === lang)){ const o=document.createElement('option'); o.value=lang; o.textContent=lang; ts.appendChild(o); } ts.value = lang; }
  const vc = _langVoiceCode(lang), vl = document.getElementById('voiceLang');
  if (vc && vl) vl.value = vc;   // OmniVoice có mã tương ứng thì set; ngôn ngữ khác giữ nguyên (dùng TTS ngoài)
}

function _syncChLang(){
  const sel = document.getElementById('chLang'); if (!sel) return;
  const lang = _profileLang();
  if (![...sel.options].some(o => o.value === lang)){ const o=document.createElement('option'); o.value=lang; o.textContent='🌐 '+lang; sel.appendChild(o); }
  sel.value = lang;
  _applyLangToTools(lang);
}

function setChannelLang(v){
  const p = getProfile();
  if (!p){ if (typeof setStatusScript==='function') setStatusScript('Tạo/chọn Profile kênh trước khi đặt ngôn ngữ.', 'error'); _syncChLang(); return; }
  p.ngonNgu = v;
  const pn = document.getElementById('pNgonNgu'); if (pn) pn.value = v;
  _applyLangToTools(v);
  if (typeof saveState === 'function') saveState(true);
}

async function switchProfile(val){
  if (val === '__new'){ if (typeof newProfile === 'function') newProfile(); else renderProfileSelect(); return; }   // option "＋ Tạo Profile mới"
  const newIdx = val === '' ? -1 : parseInt(val);
  // Save current profile's workData trước khi switch
  if (state.currentProfileIdx >= 0 && state.currentProfileIdx !== newIdx) {
    syncStateToCurrentProfile();
  }
  state.currentProfileIdx = newIdx;
  if (newIdx >= 0) {
    const newP = state.profiles[newIdx];
    _ensureVideos(newP);
    await mergeLocalWorkData(newP);   // nạp kịch bản/cảnh local (IDB) — cloud chỉ giữ bản nhẹ
    loadStateFromProfile(newP);
    await loadProfileImages(newP.profileId, _curVideoId(newP));
  } else {
    loadStateFromProfile(null); // clear all
  }
  rerenderAllAfterProfileLoad();
  if (typeof t10OnProfileSwitch === 'function') t10OnProfileSwitch();
  if (typeof applyChannelCfg === 'function') applyChannelCfg();   // nạp cấu hình Tool 2 + giọng của kênh vừa chọn
  if (typeof _syncChLang === 'function') _syncChLang();            // đồng bộ ngôn ngữ kênh vào topbar + các tool
  saveState(true);
}

async function newProfile(){
  if (state.profiles.length >= getMaxProfiles()) {
    return showGate(`Gói ${tierPlanName(state.userTier)} chỉ tạo được ${getMaxProfiles()} kênh. Nâng cấp gói để tạo thêm.`);
  }
  // Save current profile workData
  if (state.currentProfileIdx >= 0) syncStateToCurrentProfile();
  state.profiles.push(makeEmptyProfile());
  state.currentProfileIdx = state.profiles.length - 1;
  // Reset state về workData rỗng của profile mới (đã rỗng sẵn)
  loadStateFromProfile(state.profiles[state.currentProfileIdx]);
  renderProfileSelect();
  rerenderAllAfterProfileLoad();
  openProfile();
  saveState(true);
}

async function deleteProfile(){
  if (state.currentProfileIdx < 0) return;
  const p = getProfile();
  if (!confirm('Xoá profile "' + (p.tenKenh || 'unnamed') + '"?\nTOÀN BỘ kịch bản, cảnh, prompt, ảnh storyboard của profile này sẽ mất. Không hoàn tác được.')) return;
  // Cleanup IDB images cho profile này
  const uid = window.currentUser?.uid;
  if (uid && p.profileId) {
    try {
      await IDB.set(uid + '/' + p.profileId + '/characterImages', null);
      await IDB.set(uid + '/' + p.profileId + '/sceneImages', null);
      await IDB.set(uid + '/' + p.profileId + '/styleRefImages', null);
    } catch(e) {}
  }
  state.profiles.splice(state.currentProfileIdx, 1);
  state.currentProfileIdx = state.profiles.length > 0 ? 0 : -1;
  if (state.currentProfileIdx >= 0) {
    const newP = state.profiles[state.currentProfileIdx];
    _ensureVideos(newP);
    loadStateFromProfile(newP);
    await loadProfileImages(newP.profileId, _curVideoId(newP));
  } else {
    loadStateFromProfile(null);
  }
  renderProfileSelect();
  closeProfile();
  rerenderAllAfterProfileLoad();
  saveState(true);
}

function openProfile(){
  if (state.currentProfileIdx < 0) {
    if (state.profiles.length === 0) { newProfile(); return; }
    state.currentProfileIdx = 0;
  }
  const p = getProfile(); if (!p) return;
  document.getElementById('pTenKenh').value = p.tenKenh || '';
  document.getElementById('pNgach').value = p.ngach || '';
  document.getElementById('pVisualStyle').value = p.visualStyle || 'Crayon Capital — Dark';
  document.getElementById('pNgonNgu').value = p.ngonNgu || 'Tiếng Việt';
  document.getElementById('pPovStyle').value = p.povStyle || 'Ngôi thứ 2 (Bạn)';
  document.getElementById('pCauTruc').value = p.cauTruc || 'Levels / Escalation / POV';
  document.getElementById('pSoPhan').value = p.soPhan || 8;
  document.getElementById('pTargetPhut').value = p.targetPhut || 12;
  document.getElementById('pCharStyle').value = p.characterStyle || '';
  if (document.getElementById('pCharIdentity')) document.getElementById('pCharIdentity').value = p.charIdentity || '';
  document.getElementById('pBgStyle').value = p.backgroundStyle || '';
  document.getElementById('pSceneStyle').value = p.sceneStyle || '';
  document.getElementById('pPromptRules').value = p.promptRules || '';
  if (document.getElementById('pScriptPrompt')) document.getElementById('pScriptPrompt').value = p.scriptPrompt || '';
  document.getElementById('pStyleGuide').value = p.styleGuide || '';
  document.getElementById('pDnaKenh').value = p.dnaKenh || '';
  document.getElementById('pChuDe').value = p.chuDe || '';
  document.getElementById('modalProfileTitle').textContent = p.tenKenh ? 'Sửa: ' + p.tenKenh : 'Profile mới';
  renderStyleImageGallery();
  document.getElementById('profileModal').classList.add('show');
}

function closeProfile(){ document.getElementById('profileModal').classList.remove('show'); }

function saveProfile(){
  if (state.currentProfileIdx < 0) return;
  const p = getProfile();
  p.tenKenh = document.getElementById('pTenKenh').value;
  p.ngach = document.getElementById('pNgach').value;
  p.visualStyle = document.getElementById('pVisualStyle').value;
  p.ngonNgu = document.getElementById('pNgonNgu').value;
  p.povStyle = document.getElementById('pPovStyle').value;
  p.cauTruc = document.getElementById('pCauTruc').value;
  p.soPhan = parseInt(document.getElementById('pSoPhan').value) || 8;
  p.targetPhut = parseInt(document.getElementById('pTargetPhut').value) || 12;
  p.characterStyle  = document.getElementById('pCharStyle').value;
  if (document.getElementById('pCharIdentity')) p.charIdentity = document.getElementById('pCharIdentity').value;
  p.backgroundStyle = document.getElementById('pBgStyle').value;
  p.sceneStyle = document.getElementById('pSceneStyle').value;
  p.promptRules = document.getElementById('pPromptRules').value;
  if (document.getElementById('pScriptPrompt')) p.scriptPrompt = document.getElementById('pScriptPrompt').value;
  p.styleGuide = document.getElementById('pStyleGuide').value;
  p.dnaKenh = document.getElementById('pDnaKenh').value;
  p.chuDe = document.getElementById('pChuDe').value;
  renderProfileSelect();
  syncTool2FromProfile();
  renderProfileStyles();
  // Refresh Tool 3 style fields ngay sau khi lưu
  const rp = getProfile();
  const _csb = document.getElementById('t3CharStyleB'); if (_csb) _csb.value = rp?.characterStyleB || '';
  const _cs  = document.getElementById('t3CharStyle');  if (_cs)  _cs.value  = rp?.characterStyle  || '';
  const _bs  = document.getElementById('t3BgStyle');    if (_bs)  _bs.value  = rp?.backgroundStyle || '';
  const _ss  = document.getElementById('t3SceneStyle'); if (_ss)  _ss.value  = rp?.sceneStyle      || '';
  const _pr  = document.getElementById('t3PromptRules');if (_pr)  _pr.value  = rp?.promptRules     || '';
  closeProfile();
  saveState(true);
  setStatus1('✓ Đã lưu Profile: ' + p.tenKenh, 'ok');
}

async function renameProfile(){
  const p = getProfile(); if (!p) return;
  const name = (typeof _askText === 'function') ? await _askText('Đổi tên Profile:', p.tenKenh || '') : prompt('Đổi tên Profile:', p.tenKenh);
  if (name === null || name === undefined) return;
  p.tenKenh = String(name).trim() || p.tenKenh;
  const el = document.getElementById('pTenKenh'); if (el) el.value = p.tenKenh;
  const ttl = document.getElementById('modalProfileTitle'); if (ttl) ttl.textContent = 'Sửa: ' + p.tenKenh;
  renderProfileSelect();
  saveState(true);
}

function exportProfile(){
  const p = getProfile(); if (!p) return;
  downloadJSON(p, 'profile-' + (p.tenKenh || 'unnamed').replace(/\W+/g, '-') + '-' + Date.now() + '.json');
}

function importProfile(event){
  const f = event.target.files[0]; if (!f) return;
  if (state.profiles.length >= getMaxProfiles()) {
    event.target.value = '';
    return showGate(`Gói ${tierPlanName(state.userTier)} chỉ chứa được ${getMaxProfiles()} kênh. Xoá kênh cũ hoặc nâng cấp gói.`);
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const loaded = JSON.parse(e.target.result);
      state.profiles.push(loaded);
      state.currentProfileIdx = state.profiles.length - 1;
      renderProfileSelect();
      renderProfileStyles();
      openProfile();
      saveState(true);
    } catch (err) {
      alert('Lỗi import: ' + err.message);
    }
  };
  reader.readAsText(f);
  event.target.value = '';
}

function applyStylePreset(key){
  if (!key) return;
  const p = STYLE_PRESETS[key];
  if (!p || !p.characterStyle) return;
  const cs = document.getElementById('pCharStyle');
  const bs = document.getElementById('pBgStyle');
  const ss = document.getElementById('pSceneStyle');
  const pr = document.getElementById('pPromptRules');
  const hasContent = (cs && cs.value.trim()) || (bs && bs.value.trim()) || (ss && ss.value.trim());
  if (hasContent && !confirm('Đè 4 ô style hiện tại bằng preset "' + (p.label || key) + '"?')) {
    document.getElementById('pStylePreset').value = '';
    return;
  }
  if (cs) cs.value = p.characterStyle || '';
  if (bs) bs.value = p.backgroundStyle || '';
  if (ss) ss.value = p.sceneStyle || '';
  if (pr) pr.value = p.promptRules || '';
  const ci = document.getElementById('pCharIdentity');
  if (ci) ci.value = p.charIdentity || '';   // dòng đặc điểm lặp mỗi cảnh → giữ nhất quán
  // 🚫👤 Ngách không cần nhân vật (infographic/whiteboard) → tự tick "Kênh không người" ở Phân Cảnh.
  const nc = document.getElementById('noCharMode');
  if (nc && p.noChar){ nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
  const st = document.getElementById('extractStatus');
  if (st) st.innerHTML = '<span style="color:var(--green)">✓ Đã điền preset ' + (p.label || key) + (p.noChar ? ' + tự bật "Kênh không người"' : '') + '. Sửa lại cho khớp kênh rồi Lưu.</span>';
}

function quickFill(){
  document.getElementById('pTenKenh').value = 'Ancient Curiosities';
  document.getElementById('pNgach').value = 'Dark educational, mysteries, lịch sử bí ẩn';
  document.getElementById('pVisualStyle').value = 'Crayon Capital — Dark';
  document.getElementById('pCharStyle').value = PRESET.characterStyle;
  if (document.getElementById('pCharStyleB') && PRESET.characterStyleB) {
    document.getElementById('pCharStyleB').value = PRESET.characterStyleB;
  }
  document.getElementById('pBgStyle').value = PRESET.backgroundStyle;
  document.getElementById('pSceneStyle').value = PRESET.sceneStyle;
  document.getElementById('pPromptRules').value = 'No text, no watermark, consistent character design across all scenes, avoid gore, no realistic human faces, maintain flat 2D cartoon aesthetic';
  document.getElementById('extractStatus').innerHTML = '<span style="color:var(--green)">✓ Đã điền mẫu. Sửa lại rồi Lưu.</span>';
}

function syncTool2FromProfile(){
  const p = getProfile();
  const el = document.getElementById('visualStyle2');
  if (!el) return;
  el.value = p ? p.visualStyle : '';
}

function _profileStyleCard(field, label, kind){
  const p = getProfile();
  const val = p?.[field] || '';
  const editing = state.editingProfileStyle === field;
  const icoHtml = `<span class="pc-ico i-${kind}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${_PF_ICONS[kind]}</svg></span>`;
  if (editing){
    return `<div class="pcard editing">
      <div class="pc-head">${icoHtml}<h3>${label}</h3></div>
      <textarea id="editProfileStyleTA" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveProfileStyle('${field}')}else if(event.key==='Escape'){cancelProfileStyle()}" style="width:100%;min-height:180px;font-size:12.5px;line-height:1.6;border:2px solid var(--accent)">${escapeHtml(val)}</textarea>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn primary sm" onclick="saveProfileStyle('${field}')">✓ Lưu</button>
        <button class="btn ghost sm" onclick="cancelProfileStyle()">✗ Huỷ</button>
        <span style="font-size:11px;color:var(--text-muted)">Ctrl+Enter lưu nhanh</span>
      </div></div>`;
  }
  const long = (val || '').length > 210;
  return `<div class="pcard">
    <div class="pc-head">${icoHtml}<h3>${label}</h3>
      <span class="pc-acts">
        <button class="btn ghost sm" onclick="editProfileStyle('${field}')" title="Sửa trực tiếp">✏️ Sửa</button>
        <button class="btn ghost sm" onclick="copyText((getProfile()||{}).${field}||'')">📋 Sao chép</button>
      </span>
    </div>
    <div class="pc-body ${long ? 'clamp' : ''}">${escapeHtml(val || '(trống)')}</div>
    ${long ? `<div class="pc-more" onclick="pfToggleFull(this)">Xem đầy đủ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M6 9l6 6 6-6"/></svg></div>` : ''}
  </div>`;
}

function _profileScriptCard(){
  const base = _profileStyleCard('scriptPrompt', 'Prompt kịch bản', 'script');
  if (state.editingProfileStyle === 'scriptPrompt') return base;
  const tools = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <input type="file" id="pScriptFiles" accept=".txt,text/plain" multiple style="display:none" onchange="tsAnalyzeCompetitor(this.files)">
      <span style="font-size:11.5px;color:var(--text-muted)">Gửi <b>nhiều kịch bản đối thủ</b> (.txt, nên ≥3) → AI phân tích 9 lớp → tạo <b>prompt viral</b> 8 khối tự điền:</span>
      <button class="btn ghost sm" onclick="document.getElementById('pScriptFiles').click()">📄 Chọn file kịch bản</button>
      <span id="pScriptAnalyzeStatus" style="font-size:11.5px;color:var(--text-muted)"></span>
    </div>`;
  return base.replace(/<\/div>\s*$/, tools + '</div>');
}

function _tsCleanPrompt(t){
  let s = String(t || '').trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();          // bỏ code fence
  s = s.replace(/^\s*(prompt kịch bản|đây là prompt|kết quả)\s*[:：].*$/i, '').trim();  // bỏ dòng dẫn đầu
  return s;
}

function renderProfileStyles(){
  const box = document.getElementById('profileStylesDisplay');
  if (!box) return;
  const p = getProfile();
  if (!p) {
    box.innerHTML = '<div class="empty-state">Chưa có Profile. Bấm <strong>+ Tạo mới</strong> ở trên.</div>';
    return;
  }
  const s = _pfStats();
  const icoScene = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>';
  const icoImg = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>';
  const icoVid = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>';
  box.innerHTML = `
    <div class="pf-grid">
      <div class="pf-cards">
        ${_profileStyleCard('characterStyle', 'Character Style', 'char')}
        ${_profileStyleCard('backgroundStyle', 'Background Style', 'bg')}
        ${_profileStyleCard('sceneStyle', 'Scene Style / Aesthetic', 'scene')}
        ${_profileStyleCard('promptRules', 'Prompt Rules / Negative', 'rule')}
        <div style="grid-column:1 / -1">${_profileScriptCard()}</div>
      </div>
      <div class="pf-side">
        <div class="pf-panel"><div class="ph">Thông tin profile</div><div class="pb">
          <div class="pf-hero"><span class="pf-th">🎬</span><div style="min-width:0">
            <div class="pf-nm">${escapeHtml(p.tenKenh || 'Profile')}</div>
            <span class="pf-chip"><span class="d"></span>Đang hoạt động</span></div></div>
          <div class="pf-kv"><span class="k">Ngạch</span><span class="v">${escapeHtml(p.ngach || '—')}</span></div>
          <div class="pf-kv"><span class="k">Visual style</span><span class="v">${escapeHtml(p.visualStyle || '—')}</span></div>
          <div class="pf-kv"><span class="k">Số phần · Target</span><span class="v">${escapeHtml(String(p.soPhan || '—'))} · ${escapeHtml(String(p.targetPhut || '—'))}p</span></div>
        </div></div>
        <div class="pf-panel"><div class="ph">Thống kê (dữ liệu thật)</div><div class="pb">
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoScene}</svg>Số cảnh</span><span class="n">${s.scenes}</span></div>
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoImg}</svg>Ảnh đã tạo</span><span class="n">${s.imgs}</span></div>
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoVid}</svg>Video đã dựng</span><span class="n">${s.vids}</span></div>
        </div></div>
        <div class="pf-panel"><div class="ph">Hành động nhanh</div><div class="pb" style="gap:2px">
          <div class="pf-qa" onclick="newProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Tạo Profile mới</div>
          <div class="pf-qa" onclick="openProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg>Sửa thông tin kênh</div>
          <div class="pf-qa" onclick="newVideo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>Video mới (trong kênh này)</div>
          <div class="pf-qa" onclick="renameVideo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg>Đổi tên video</div>
          <div class="pf-qa" onclick="openVideoManager()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M9 9l2 2 4-4"/></svg>Quản lý / Xóa video</div>
          <div class="pf-qa danger" onclick="deleteProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>Xóa Profile</div>
        </div></div>
      </div>
    </div>`;
}

function _pfStats(){
  const scenes = (state.scenes || []).length;
  const si = state.sceneImages || {}, sib = state.sceneImagesB || {};
  const imgs = Object.keys(si).filter(k => si[k]?.base64).length + Object.keys(sib).filter(k => sib[k]?.base64).length;
  const sv = state.sceneVideos || {};
  const vids = Object.keys(sv).filter(k => sv[k] && !sv[k].error).length;
  return { scenes, imgs, vids };
}

function pfToggleFull(btn){
  const card = btn.closest('.pcard'); const body = card && card.querySelector('.pc-body'); if (!body) return;
  const nowClamped = body.classList.toggle('clamp');
  btn.firstChild.textContent = nowClamped ? 'Xem đầy đủ ' : 'Thu gọn ';
}

function editProfileStyle(field){
  if (!getProfile()) return;
  state.editingProfileStyle = field;
  renderProfileStyles();
  setTimeout(() => {
    const ta = document.getElementById('editProfileStyleTA');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function cancelProfileStyle(){
  state.editingProfileStyle = null;
  renderProfileStyles();
}

function saveProfileStyle(field){
  const ta = document.getElementById('editProfileStyleTA');
  const p = getProfile();
  if (!ta || !p) return;
  p[field] = ta.value;
  state.editingProfileStyle = null;
  renderProfileStyles();
  if (typeof syncTool2FromProfile === 'function') syncTool2FromProfile();
  // Đồng bộ sang ô style của Tool 3
  const mirror = { characterStyle: 't3CharStyle', backgroundStyle: 't3BgStyle', sceneStyle: 't3SceneStyle', promptRules: 't3PromptRules' };
  const el = document.getElementById(mirror[field]);
  if (el) el.value = p[field] || '';
  saveState(true);
  setStatus1('✓ Đã lưu style: ' + field, 'ok');
}

function _downscaleImage(file, maxEdge = 1600, quality = 0.9){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);   // nền trắng cho ảnh PNG trong suốt
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderStyleImageGallery(){
  const gallery = document.getElementById('pStyleImgGallery');
  if (!gallery) return;
  document.getElementById('pStyleImgCount').textContent = state.styleRefImages.length + ' ảnh';
  gallery.innerHTML = state.styleRefImages.map((img, i) =>
    `<div class="img-tile">
      <img src="data:${img.mediaType};base64,${img.base64}" alt="">
      <button class="rm" onclick="state.styleRefImages.splice(${i},1);renderStyleImageGallery()">×</button>
    </div>`
  ).join('');
}

function clearStyleImages(){
  state.styleRefImages = [];
  renderStyleImageGallery();
  document.getElementById('styleAnalysisStatus').innerHTML = '';
}

async function analyzeStyleImages(){
  if (!state.styleRefImages.length) return alert('Cần upload ít nhất 1 ảnh mẫu.');
  const status = document.getElementById('styleAnalysisStatus');
  status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang phân tích style từ ' + state.styleRefImages.length + ' ảnh...</span>';
  document.getElementById('btnAnalyzeStyle').disabled = true;

  try {
    const content = [];
    for (const img of state.styleRefImages.slice(0, 4)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    }
    content.push({
      type: 'text',
      text: `Analyze the visual style of the ${state.styleRefImages.length} sample images above IN DEPTH (images from one faceless video/animation channel). Goal: write an EXTREMELY DETAILED "STYLE GUIDE" so every future generated image keeps the exact style and stays consistent. ABSOLUTELY no sketchy work, no short generic paragraph.

Return EXACTLY 1 JSON object (no markdown, no characters outside the JSON). ALL values written IN ENGLISH for G-Labs, use \\n for line breaks between sections:
{
  "characterStyle": "VERY DETAILED 200-350 words, MULTIPLE clearly sectioned paragraphs. The opening sentence locks the overall style (e.g. 'A minimalist stick-limb storybook character, hand-drawn with...'). Then describe by section:\\n#1 BODY & PROPORTIONS: head shape & proportions, head/body ratio, neck-arms-legs (thin stick limbs or real limbs, muscles/joints or not), hands (mitten/fingers), feet.\\n#2 FACE: face/skin color, eye style (dots/oval/with iris/eyelashes), nose, mouth, eyebrows, default expression.\\n#3 HAIR & CLOTHING: hairstyle & how it is drawn, how clothing adapts to setting/era.\\nSTATE CLEARLY the linework: outline thickness, cel-shading style, grain present or not. Lock the style with a clear ASSERTIVE, POSITIVE sentence (e.g. 'flat 2D hand-drawn cartoon, cel-shaded, grounded human proportions with slim rounded limbs') — MINIMIZE 'NOT/no' (Nano Banana is an instruction-following model, no SDXL-style negatives); if needed add at most 1-2 short things to avoid. Only describe what is ACTUALLY visible in the images.",
  "backgroundStyle": "VERY DETAILED 150-300 words, multiple paragraphs: outline thickness & sharpness, environment detail level COMPARED to characters, specific palette, cel-shading style + light sources (direction/color/warm-cold contrast), perspective & depth layers (foreground/midground/background), materials & textures (wood, stone, fabric, metal, paper...), prop types. End with: NO characters, NO people, NO figures, NO text, NO words, 16:9 ratio.",
  "sceneStyle": "60-120 words: overall aesthetic for EVERY scene — drawing style, linework, palette, cel-shading, light contrast, mood/tone, 16:9 frame, consistent across all scenes.",
  "promptRules": "SHORT list (max ~8-12 phrases) — MOSTLY positive assertions of things to KEEP (correct linework & outline weight, correct body proportions, the images' palette, character consistent across scenes), plus only the truly needed avoidances: no text, no watermark, no logo, no distorted anatomy, no extra fingers. Do NOT write a long SDXL-style negative list — Nano Banana is an instruction-following model.",
  "visualStyle": "short 2-5 word name for this style"
}

IMPORTANT: characterStyle & backgroundStyle MUST be long and sectioned like a REAL STYLE GUIDE (not one short paragraph). Analyze from the ACTUAL images, do NOT invent, do NOT guess what is not visible.`
    });

    const data = await callLLMJson('', {
      maxTokens: 4000,
      messages: [{ role: 'user', content }],
      validate: d => d && typeof d === 'object' && !Array.isArray(d)
        && typeof d.characterStyle === 'string' && d.characterStyle.length > 250
        && typeof d.backgroundStyle === 'string' && d.backgroundStyle.length > 150
    });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã phân tích xong. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAnalyzeStyle').disabled = false;
}

async function genStyleFromText(){
  const desc = (document.getElementById('pStyleDesc')?.value || '').trim();
  if (!desc) return alert('Gõ mô tả kênh trước (ngách + phong cách).');
  const status = document.getElementById('styleDescStatus');
  if (status) status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang viết style guide…</span>';
  const btn = document.getElementById('btnGenStyleText'); if (btn) btn.disabled = true;
  try {
    const prompt = `You are an art director for a faceless video channel. From the CHANNEL DESCRIPTION below, write a DETAILED STYLE GUIDE so that EVERY generated image (via Nano Banana / Imagen) keeps the EXACT style and stays consistent.

CHANNEL DESCRIPTION: "${desc}"

Return EXACTLY 1 JSON object (no markdown, no characters outside the JSON). ALL values IN ENGLISH, use \\n for line breaks between sections:
{
  "characterStyle": "150-300 words, sectioned: BODY & PROPORTIONS, FACE, HAIR & CLOTHING, line quality/render material. Use POSITIVE phrasing (instruction-following model — MINIMIZE 'no/not'). If it is a real-photo channel, describe as real-person photography; if animated, describe the linework. If the niche has NO human characters (scenery/objects/processes), describe the niche's typical main subject.",
  "backgroundStyle": "120-250 words: the niche's typical settings/environments, level of detail, color palette, lighting (direction/color/contrast), perspective & depth, materials/textures. End with: no characters, no people, no text, 16:9 ratio.",
  "sceneStyle": "40-90 SHORT words: overall aesthetic for EVERY scene — image/drawing style, color palette, lighting, mood, 16:9 frame, consistent. (This tag block gets appended to the END of every prompt, so it must be concise.)",
  "promptRules": "8-12 phrases, MOSTLY positive (things to KEEP), with only a few truly needed negatives: no text, no watermark. Do NOT write a long SDXL-style negative list.",
  "visualStyle": "short style name, 2-5 words",
  "ngach": "short niche",
  "noPeople": true if this niche almost NEVER has human characters (tips, objects, processes, infographics, scenery, products...), false if it usually does (storytelling, real-person vlogs, characters...)
}
Infer the correct industry from the description. Do NOT invent details contradicting the description.`;
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && typeof d === 'object' && !Array.isArray(d) && typeof d.sceneStyle === 'string' && d.sceneStyle.length > 20 });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngach){ const e = document.getElementById('pNgach'); if (e && !e.value.trim()) e.value = data.ngach; }
    const _sp = document.getElementById('pStylePreset'); if (_sp) _sp.value = '';   // đã tùy biến → bỏ chọn preset
    // 🚫👤 Ngách không người → tự tick "Kênh không người".
    const _nc = document.getElementById('noCharMode');
    if (_nc && data.noPeople === true){ _nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
    if (status) status.innerHTML = '<span style="color:var(--green)">✓ Đã điền 4 ô style' + (data.noPeople === true ? ' + tự bật "Kênh không người"' : '') + '. Kiểm tra rồi Lưu.</span>';
  } catch (e){ console.error(e); if (status) status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message || String(e)) + '</span>'; }
  if (btn) btn.disabled = false;
}

function setStatusBar(id, msg, type = 'info'){
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.className = 'status-bar' + (type !== 'info' ? ' ' + type : '');
  const spinner = type === 'working' ? '<span class="spinner"></span>' : '';
  const cancelBtn = type === 'working'
    ? '<button class="btn ghost sm" style="margin-left:auto;padding:3px 10px;font-size:11px" onclick="requestCancel()">⏸ Dừng</button>'
    : '';
  bar.innerHTML = spinner + '<span style="flex:1">' + escapeHtml(msg) + '</span>' + cancelBtn;
  if (id === 'status2') _t2AnalyzeSyncBtn(type === 'working');   // nút lớn Phân Cảnh: đang chạy → Dừng
}

function _t2AnalyzeSyncBtn(running){
  const b = document.getElementById('t2AnalyzeBtn'); if (!b) return;
  b.dataset.run = running ? '1' : '';
  b.textContent = running ? '■ Dừng' : '✨ Phân tích kịch bản';
  b.style.background = running ? 'var(--red)' : 'linear-gradient(180deg,var(--accent-2),var(--accent))';
}

function requestCancel(){
  state.cancelRequested = true;
  try { if (typeof tfState === 'object' && tfState) tfState.stop = true; } catch (e) {}   // dừng LUÔN tạo ảnh cảnh / asset / hàng đợi tạo lại qua Flow (tfPool + regen pool đều kiểm tfState.stop)
  try { if (typeof _flowAbort === 'function') _flowAbort(true); } catch (e) {}   // báo backend bỏ NGAY lượt gen đang chạy dở
  try { if (typeof _t2RegenPending !== 'undefined') _t2RegenPending.clear(); } catch (e) {}   // xoá hàng đợi tạo lại đang chờ
  if (typeof setStatus2 === 'function') setStatus2('⏸ Đang dừng sau khi xong ảnh đang chạy dở…', 'info');
}

function clearCancel(){
  state.cancelRequested = false;
}

function tfInit(){
  flowBridge.init();
  tfSyncModeUI();
  tfRenderExtStatus();
  tfRefreshConn();
  tfRenderScenes();
  tfRenderAssets();
  if (typeof bulkUpdateCount === 'function') bulkUpdateCount();
  if (typeof bulkRenderRefs === 'function') bulkRenderRefs();
  if (typeof bulkRenderGrid === 'function') bulkRenderGrid();
  if (typeof bulkFlowStatus === 'function') bulkFlowStatus();
  if (typeof bulkUpsCheck === 'function') bulkUpsCheck();
}

function tfAssetImageMap(){
  const map = {};
  const ci = state.characterImages || {};
  const bi = state.backgroundImages || {};
  for (const n in ci) if (ci[n]?.base64) map[n] = ci[n];
  for (const n in bi) if (bi[n]?.base64) map[n] = bi[n];
  return map;
}

function tfExtractRefNames(promptText, imgMap){
  const keys = Object.keys(imgMap);
  const tags = String(promptText || '').match(/\[([^\[\]]+)\]/g) || [];
  const out = [];
  for (const raw of tags){
    // Tag có thể GHÉP nhiều người "[patient, oncologist]" → tách ra khớp TỪNG người (asset giờ là cá nhân).
    const names = (typeof _splitCharNames === 'function') ? _splitCharNames(raw.slice(1, -1)) : [raw.slice(1, -1).trim()];
    for (const name of names){
      if (!name) continue;
      // Khớp chính xác trước; nếu không có ảnh → khớp LINH HOẠT biến thể tên ngắn/dài (vd [protagonist-male] ↔ ảnh "protagonist-male-trader") để face-lock vẫn ăn.
      let hit = imgMap[name] ? name : (keys.find(k => k === name || k.startsWith(name + '-') || name.startsWith(k + '-')) || null);
      if (hit && !out.includes(hit)) out.push(hit);
    }
  }
  return out;
}

async function tfEnsureRefUploaded(name, projectId, imgMap){
  if (tfState.uploaded[name]) return tfState.uploaded[name];
  const img = imgMap[name];
  if (!img) return null;
  const raw = img.base64.startsWith('data:') ? img.base64.split(',')[1] : img.base64;
  const r = await flowBridge.call('UPLOAD_IMAGE', { projectId, base64: raw, mime: img.mediaType || 'image/png', fileName: _slug(name) + '.png' });
  if (r?.error || !r?.media_id) { console.warn('[Flow] upload ảnh tham chiếu LỖI:', name, '→', r?.error); return null; }
  console.log('[Flow] upload tham chiếu OK:', name, '→', r.media_id);
  tfState.uploaded[name] = r.media_id;
  return r.media_id;
}

function _bulkParse(){
  const raw = (document.getElementById('bulkPrompts')?.value || '');
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const seen = {};
  return lines.map((ln, i) => {
    let name = '', prompt = ln;
    const m = ln.match(/^([^|]{1,60})\|(.+)$/);
    if (m) { name = _slug(m[1].trim()); prompt = m[2].trim(); }
    if (!name) name = 'anh-' + String(i + 1).padStart(3, '0');
    if (seen[name]) { seen[name]++; name = name + '-' + seen[name]; } else seen[name] = 1;
    return { name, prompt };
  });
}

function bulkUpdateCount(){ const el = document.getElementById('bulkCount'); if (el) el.textContent = _bulkParse().length + ' ảnh'; }

function bulkImportFile(input){
  const f = input.files && input.files[0]; if (!f) return; input.value = '';
  const r = new FileReader();
  r.onload = () => { const ta = document.getElementById('bulkPrompts'); if (ta) { const cur = ta.value.trim(); ta.value = (cur ? cur + '\n' : '') + String(r.result || ''); bulkUpdateCount(); } };
  r.readAsText(f, 'utf-8');
}

function bulkAddRefs(files){
  [...(files || [])].forEach(f => { const r = new FileReader(); r.onload = () => { bulkState.refs.push({ name: 'ref-' + (bulkState.refs.length + 1), base64: String(r.result || ''), mediaType: f.type || 'image/png' }); bulkRenderRefs(); }; r.readAsDataURL(f); });
}

function bulkRenderRefs(){
  const el = document.getElementById('bulkRefThumbs'); if (!el) return;
  el.innerHTML = bulkState.refs.map((rf, i) => `<span style="position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:3px;width:58px"><span style="position:relative;width:52px;height:52px;border-radius:7px;overflow:hidden;background:#0002"><img src="${rf.base64}" style="width:100%;height:100%;object-fit:cover"><button title="Xoá" onclick="bulkState.refs.splice(${i},1);bulkRenderRefs()" style="position:absolute;top:-3px;right:-3px;background:var(--red);color:#fff;border:none;width:16px;height:16px;border-radius:50%;font-size:10px;cursor:pointer;line-height:1;padding:0">×</button></span><input value="${escapeHtml(rf.name)}" title="Tên ref — gõ [${escapeHtml(rf.name)}] trong prompt để chỉ đính ref này" onchange="_bulkRenameRef(${i}, this.value)" style="width:56px;font-size:9.5px;text-align:center;border:1px solid var(--border);border-radius:5px;padding:2px 3px;background:var(--surface);color:var(--text)"></span>`).join('');
}

function _bulkRenameRef(i, v){
  const rf = bulkState.refs[i]; if (!rf) return;
  let name = String(v || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  if (!name) name = 'ref-' + (i + 1);
  // tránh trùng tên (tag sẽ nhập nhằng)
  if (bulkState.refs.some((r, j) => j !== i && r.name === name)) name = name + '-' + (i + 1);
  rf.name = name; bulkRenderRefs();
}

function _bulkAspect(){ const a = (document.getElementById('tfAspect')?.value || '16:9'); return a.indexOf('9:16') >= 0 ? '9/16' : a.indexOf('1:1') >= 0 ? '1/1' : '16/9'; }

function _bulkTile(it, i){
  const ar = _bulkAspect(), s = it.status;
  let im;
  if (s === 'done') { const q = (document.getElementById('tfQuality')?.value || 'orig'); const qLbl = q === '2048' ? '2K' : q === '3840' ? '4K' : ''; const badge = qLbl ? (it.upscaled ? `<span style="position:absolute;top:5px;right:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(22,163,74,.92);color:#fff" title="Upscale thật của Flow">${qLbl}</span>` : `<span style="position:absolute;top:5px;right:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.6);color:#fbbf24" title="Flow chưa nâng kịp — dùng ảnh gốc, không lỗi">gốc</span>`) : ''; im = `<div style="position:relative;aspect-ratio:${ar};cursor:zoom-in" onclick="bulkEnlarge(${i})"><img src="${it.dataUrl}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;top:5px;left:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.6);color:#fff">✓</span>${badge}</div>`; }
  else if (s === 'gen') im = `<div style="aspect-ratio:${ar};background:linear-gradient(135deg,#3b3f45,#25282d);position:relative"><span id="bpct-${i}" style="position:absolute;top:7px;right:9px;color:#e8e8ea;font-size:13px;font-weight:700">${Math.round(it.pct || 0)}%</span><span id="bfill-${i}" style="position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--accent-2),var(--accent));width:${it.pct || 4}%"></span></div>`;
  else if (s === 'err') im = `<div title="${escapeHtml(it.err || '')}" style="aspect-ratio:${ar};background:color-mix(in srgb,var(--red) 12%,var(--surface-3));display:grid;place-items:center;color:var(--red);font-size:12px;font-weight:600;text-align:center;padding:6px">✗ lỗi<br><span style="font-size:9px;font-weight:400">${escapeHtml((it.err || '').slice(0, 60))}</span></div>`;
  else im = `<div style="aspect-ratio:${ar};background:var(--surface-3);display:grid;place-items:center;color:var(--text-dim);font-size:12px;opacity:.6">chờ…</div>`;
  return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;overflow:hidden">${im}<div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(it.prompt || '')}">${escapeHtml(it.name)}</div></div>`;
}

function bulkRenderGrid(){
  const grid = document.getElementById('bulkGrid'); if (!grid) return;
  if (!bulkState.items.length) { grid.innerHTML = '<div class="empty-state">Nhập prompt ở trên → bấm ▶ Tạo tất cả.</div>'; const i0 = document.getElementById('bulkInfo'); if (i0) i0.textContent = ''; return; }
  grid.innerHTML = bulkState.items.map((it, i) => _bulkTile(it, i)).join('');
  const done = bulkState.items.filter(x => x.status === 'done').length, gen = bulkState.items.filter(x => x.status === 'gen').length, err = bulkState.items.filter(x => x.status === 'err').length;
  const info = document.getElementById('bulkInfo'); if (info) info.textContent = `${done}/${bulkState.items.length} xong · ${gen} đang chạy · ${err} lỗi`;
}

function bulkEnlarge(i){ const it = bulkState.items[i]; if (!it || !it.dataUrl) return; const m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:30px'; m.onclick = () => m.remove(); m.innerHTML = `<img src="${it.dataUrl}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px">`; document.body.appendChild(m); }

function bulkStop(){ bulkState.stop = true; setStatusF('Đang dừng…', 'info'); }

function bulkToggle(){ if (bulkState.running) bulkStop(); else bulkGenerate(); }

function _bulkSyncBtn(){
  const b = document.getElementById('bulkGenBtn'); if (!b) return;
  b.className = bulkState.running ? 'btn ghost sm' : 'btn primary sm';
  b.style.color = bulkState.running ? 'var(--red)' : '';
  b.style.borderColor = bulkState.running ? 'var(--red)' : '';
  b.textContent = bulkState.running ? '■ Dừng' : '▶ Tạo tất cả';
}

function bulkRetryFailed(){ bulkGenerate(true); }

function _bulkRefsFor(promptText, imgMap, allNames){
  const s = String(promptText || '');
  const tags = s.match(/\[([^\[\]]+)\]/g) || [];
  if (!tags.length) return { refNames: allNames, text: s };
  const keys = Object.keys(imgMap);
  const matched = []; let text = s;
  for (const raw of tags){
    const name = raw.slice(1, -1).trim().toLowerCase();
    const hit = imgMap[name] ? name : (keys.find(k => k === name || k.startsWith(name + '-') || name.startsWith(k + '-')) || null);
    if (hit){ if (!matched.includes(hit)) matched.push(hit); text = text.split(raw).join(' '); }   // xoá tag khớp khỏi prompt
  }
  text = text.replace(/\s+/g, ' ').trim();
  // Có [..] nhưng KHÔNG khớp ref nào (vd viết [close up] như ghi chú) → không coi là tag ref,
  // giữ nguyên prompt + đính TẤT CẢ ref (tránh vô tình bỏ hết ref).
  if (!matched.length) return { refNames: allNames, text: s };
  return { refNames: matched, text };
}

function _bulkFriendlyErr(e){
  const s = String(e || '');
  if (/PER_MODEL_DAILY_QUOTA|RESOURCE_EXHAUSTED|EXHAUSTED|QUOTA/i.test(s)) return 'Hết lượt tạo ảnh hôm nay — đổi model, thêm tài khoản, hoặc chờ sang ngày mới';
  if (/MODEL_ACCESS_DENIED|does not have permission/i.test(s)) return 'Tài khoản không có quyền model/chất lượng này (cần gói trả phí)';
  if (/API_401|UNAUTHENT|NO_FLOW_KEY/i.test(s)) return 'Tài khoản hết phiên — quét lại/đăng nhập ở Cài đặt';
  if (/\bAPI_0\b|API_5\d\d|ECONN|ETIMEDOUT|network|timeout|no response|failed to fetch/i.test(s)) return 'Flow chưa sẵn sàng (mới mở Chrome) hoặc mạng chập — đợi vài giây rồi thử lại';
  if (/FILTER|SAFETY|PROMINENT_PEOPLE/i.test(s)) return 'Prompt bị lọc (nội dung nhạy cảm) — sửa prompt';
  if (/ALL_ACCOUNTS_EXHAUSTED/i.test(s)) return 'Tất cả tài khoản đã hết lượt hôm nay';
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
}

async function bulkGenerate(retryOnly){
  if (bulkState.running) return;
  if (!retryOnly) bulkState.items = _bulkParse().map(x => ({ ...x, status: 'wait', pct: 0, err: '', dataUrl: null }));
  if (!bulkState.items.length) { setStatusF('Chưa có prompt. Nhập danh sách prompt trước.', 'error'); return; }
  const targets = retryOnly ? bulkState.items.filter(x => x.status === 'err') : bulkState.items;
  if (!targets.length) { setStatusF('Không có ảnh nào cần tạo.', 'info'); return; }
  targets.forEach(x => { x.status = 'wait'; x.pct = 0; x.err = ''; });
  bulkRenderGrid();
  if (!(await flowBridge.waitReady(1500))) { setStatusF('Chưa kết nối. Thêm/đăng nhập tài khoản ở Cài đặt.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))) { setStatusF('Chưa đăng nhập. Thêm/đăng nhập tài khoản ở Cài đặt.', 'error'); return; }
  const cfg = tfCfg();
  // Luôn dùng POOL (project per-account) — kể cả 1 account — để project + credit chui đúng account,
  // không dồn vào tài khoản đang đăng nhập ở tab extension (chế độ Extension "1 tab + N token").
  const multi = flowBridge.mode === 'extension' ? (st.accountCount || 0) >= 1 : (st.accountCount || 0) > 1;
  bulkState.running = true; bulkState.stop = false; _bulkSyncBtn();
  let projectId = null;
  try { if (multi) await flowBridge.call('POOL_RESET'); else projectId = await tfEnsureProject(); }
  catch (e) { bulkState.running = false; _bulkSyncBtn(); setStatusF('Lỗi mở project: ' + (e.message || e), 'error'); return; }
  const conc = multi ? Math.max(1, st.accountCount) : cfg.conc;   // = số tài khoản (1 request/tài khoản): SONG SONG đủ, không quá tải (tránh reCAPTCHA)
  const _asImg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + targets.length + ' ảnh', 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc + (cfg.upscale && cfg.upscale !== '1' ? ' · Nâng nét: ' + cfg.upscale : ''), 'acc');
  novaLog('  • Lưu về máy: ' + (_asImg.enabled && _asImg.folder ? _asImg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  const imgMap = {}; bulkState.refs.forEach(rf => imgMap[rf.name] = rf);
  const allRefNames = bulkState.refs.map(rf => rf.name);
  const tier = st.paygateTier;
  let done = 0, err = 0;
  const _t0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();   // ⏱ cho ETA
  const _fmtEta = (s) => s > 0 ? (Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0')) : '';
  try {
    await tfPool(targets, async (it) => {
      if (bulkState.stop) return;
      const idx = bulkState.items.indexOf(it);
      it.status = 'gen'; it.pct = 6; bulkRenderGrid();
      novaLog('🖼 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → đang tạo…', 'acc');
      const tick = setInterval(() => { if (it.status === 'gen') { it.pct = Math.min(92, it.pct + Math.random() * 9); const pe = document.getElementById('bpct-' + idx); if (pe) pe.textContent = Math.round(it.pct) + '%'; const fe = document.getElementById('bfill-' + idx); if (fe) fe.style.width = it.pct + '%'; } }, 500);
      try {
        // Tag [tên-ref] trong prompt → chỉ đính ref khớp; không tag → đính tất cả (như cũ). Tag khớp bị xoá khỏi prompt.
        const sel = _bulkRefsFor(it.prompt || '', imgMap, allRefNames);
        const r = await tfDispatchGen(cleanPrompt(sel.text), sel.refNames, { multi, cfg, imgMap, projectId, tier });
        it._acc = (r && r.account) || null;
        it._rotated = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        clearInterval(tick);
        const entries = (r && r.media_entries) || [];
        const e0 = entries.find(e => e.dataUrl);
        if (r && r.error) { it.status = 'err'; it.err = _bulkFriendlyErr(String(r.error)); err++; }
        else if (e0) {
          it.status = 'done'; it.pct = 100; it.mime = e0.mime || 'image/png';
          // Extension đã lo chất lượng: 2K/4K = upscale THẬT của Flow (e0.upscaled), lỗi thì lùi ảnh gốc.
          // KHÔNG canvas-resize ở app nữa (phóng canvas chỉ to pixel chứ không nét hơn).
          // Bật "Tự xoá dấu ✦" → xoá watermark NGAY (Canvas) để ảnh HIỂN THỊ trong tool + file lưu đều sạch.
          it.dataUrl = _wmCfg().enabled ? await wmGeminiClean(e0.dataUrl) : e0.dataUrl;
          it.upscaled = !!e0.upscaled; it.upscaleFailed = !!e0.upscaleFailed;
          done++;
          try { if (typeof autoSaveMedia === 'function') { const sv = await autoSaveMedia(it.name + '.' + ((it.mime.split('/')[1] || 'png').replace('jpeg', 'jpg')), it.dataUrl, 'anh', true); if (sv && sv.path) it._savedPath = sv.path; } } catch (e2) {}
        }
        else {
          const fe = entries.find(e => e.fetchError);
          it.status = 'err';
          it.err = fe ? ('tải ảnh lỗi: ' + fe.fetchError) : (r && r.account ? ('không có ảnh (tài khoản ' + r.account + ' — token hết hạn? Quét lại ở Cài đặt)') : (entries.length ? 'ảnh trống (fetch lỗi)' : 'không có ảnh trả về — token hết hạn / model / bị lọc?'));
          console.warn('[bulk] "' + it.name + '" không ra ảnh — response:', r);
          err++;
        }
      } catch (e) { clearInterval(tick); it.status = 'err'; it.err = e.message || String(e); err++; }
      // Nhật ký per-account (như đối thủ)
      try {
        // Xoay tài khoản do hết lượt/credit → ghi rõ
        if (Array.isArray(it._rotated)) for (const ex of it._rotated) novaLog('⚠️ ' + ex + ' hết lượt hôm nay → chuyển ' + it.name + ' sang ' + (it._acc || 'tài khoản khác'), 'warn');
        if (it.status === 'done') { novaLog('✅ ' + it.name + ' · tài khoản ' + (it._acc || '?') + ' · thành công' + (it.upscaled ? ' (2K/4K)' : ''), 'ok'); if (it._savedPath) novaLog('   💾 đã lưu: ' + it._savedPath, 'ok'); }
        else if (it.status === 'err') { const q = /429|QUOTA|EXHAUSTED|hết giới hạn/i.test(String(it.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + (it._acc ? ('tài khoản ' + it._acc + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (it.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e3) {}
      bulkRenderGrid();
      const _rem = targets.length - done - err;
      const _eta = (done > 0 && _t0) ? _fmtEta(((performance.now() - _t0) / 1000 / done) * _rem) : '';
      setStatusF(`Tạo ảnh: ${done} xong · ${err} lỗi · còn ${_rem}${_eta ? ' · ~' + _eta + ' nữa' : ''}`, 'working');
    }, conc, cfg.delay || 0);
  } catch (e) { setStatusF('Lỗi: ' + (e.message || e), 'error'); }
  // 📊 Tóm tắt: tách lỗi do QUOTA (tài khoản hết lượt) vs lỗi tạm thời (có thể tự thử lại).
  const _reQuota = /429|QUOTA|EXHAUSTED|hết lượt|hết quota|hết giới hạn|ALL_ACCOUNTS/i;
  const errItems = bulkState.items.filter(it => it.status === 'err');
  const quotaErr = errItems.filter(it => _reQuota.test(String(it.err))).length;
  const softErr = errItems.length - quotaErr;
  novaLog('━━━ ' + (bulkState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + targets.length + ' ảnh' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  if (quotaErr) novaLog('  • ' + quotaErr + ' ảnh lỗi do TÀI KHOẢN HẾT LƯỢT — thêm tài khoản Flow ở Cài đặt, hoặc thử lại sau khi quota hồi.', 'warn');
  bulkState.running = false; _bulkSyncBtn();
  bulkRenderGrid();
  // ↻ AUTO-RETRY: chỉ lỗi TẠM THỜI (không phải quota), tối đa 2 lần, sau 2.5s.
  if (!retryOnly) bulkState._autoRetries = 0;
  if (!bulkState.stop && softErr > 0 && (bulkState._autoRetries || 0) < 2){
    bulkState._autoRetries = (bulkState._autoRetries || 0) + 1;
    setStatusF(`↻ Tự thử lại ${softErr} ảnh lỗi tạm thời (lần ${bulkState._autoRetries})…`, 'working');
    novaLog('↻ Tự thử lại ' + softErr + ' ảnh lỗi tạm thời (lần ' + bulkState._autoRetries + ')…', 'acc');
    setTimeout(() => { if (!bulkState.running && !bulkState.stop) bulkGenerate(true); }, 2500);
    return;
  }
  setStatusF(bulkState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh${err ? `, ${err} lỗi${quotaErr ? ' (' + quotaErr + ' do hết quota)' : ''}` : ''}.`, err ? 'error' : 'ok');
  try { if (typeof notifyDone === 'function') notifyDone('✓ Tạo ảnh hàng loạt xong', `${done} ảnh, ${err} lỗi.`); } catch (e) {}
}

function bulkUpsRender(st){
  const el = document.getElementById('bulkUpsStatus'); if (!el) return;
  // Upscale luôn SẴN CÓ nhờ template mặc định (không cần học). Học chỉ là dự phòng khi Flow đổi API.
  el.textContent = (st && st.learned) ? '✓ 2K/4K: upscale thật (đã cập nhật)' : '✓ 2K/4K: upscale thật (Flow super-res, sẵn có)';
  el.style.color = 'var(--green)';
}

async function bulkUpsCheck(){ try { bulkUpsRender(await flowBridge.call('UPSCALE_LEARN_STATUS')); } catch (e) {} }

async function bulkLearnUpscale(){
  try {
    const r = await flowBridge.call('UPSCALE_LEARN_ARM');
    if (r && r.error){ setStatusF('Cần đăng nhập tài khoản Flow trước (ở Cài đặt).', 'error'); return; }
    setStatusF('Đã mở cửa sổ Flow. Bấm Tải xuống → 2K trên 1 ảnh bất kỳ để app học… (đang chờ)', 'working');
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      let st = null; try { st = await flowBridge.call('UPSCALE_LEARN_STATUS'); } catch (e) {}
      bulkUpsRender(st);
      if (st && st.learned){ clearInterval(iv); setStatusF('✓ Đã học 2K! Từ giờ chọn 2K/4K sẽ upscale thật.', 'ok'); }
      else if (tries > 120){ clearInterval(iv); setStatusF('Chưa bắt được request 2K. Thử lại: bấm Tải xuống → 2K trên 1 ảnh trong cửa sổ Flow.', 'info'); }
    }, 1500);
  } catch (e){ setStatusF('Lỗi: ' + (e.message || e), 'error'); }
}

async function bulkFlowStatus(){
  const el = document.getElementById('bulkAcctBar'); if (!el) return;
  const setg = ' <a href="#" onclick="switchTool(\'toolsettings\');return false" style="color:var(--accent);font-weight:600">Cài đặt</a>';
  el.innerHTML = '<span style="color:var(--text-dim)">⏳ Kiểm tra kết nối…</span>';
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) {
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa kết nối</b> <span style="color:var(--text-muted)">— thêm/đăng nhập tài khoản ở' + setg + '</span>'; return;
    }
    const st = await flowBridge.call('GET_STATUS');
    const accs = (st && st.accounts) || [];
    const active = accs.filter(a => a.enabled !== false && !a.needLogin && (a.hasToken || a.engine === 'chrome'));
    const needLoginN = accs.filter(a => a.needLogin).length;
    const n = active.length || ((needLoginN || !accs.length) ? 0 : ((st && st.accountCount) || 0));
    if (!n && !(st && st.hasToken)) {
      // Có tài khoản nhưng ĐỀU cần đăng nhập lại → báo rõ, đừng để "đã kết nối" ảo.
      if (needLoginN) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Cần đăng nhập lại · ' + needLoginN + ' tài khoản</b> <span style="color:var(--text-muted)">— mở tab Flow đăng nhập, hoặc' + setg + '</span>'; return; }
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa đăng nhập</b> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; return;
    }
    let html = '<span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span> <b>Đã kết nối · ' + n + ' tài khoản</b>' + (needLoginN ? ' <span style="color:var(--amber);font-size:11px">· ' + needLoginN + ' cần đăng nhập lại</span>' : '');
    active.slice(0, 6).forEach(a => { const cr = (a.credits != null) ? (' · ' + a.credits + ' credit') : ''; html += '<span style="font-size:11px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:99px;padding:3px 10px;color:var(--text-muted)">' + escapeHtml(String(a.email || 'tài khoản').split('@')[0]) + cr + '</span>'; });
    html += '<a href="#" onclick="switchTool(\'toolsettings\');return false" style="margin-left:auto;color:var(--accent);font-weight:600;font-size:11.5px">⚙️ Quản lý ở Cài đặt</a>';
    el.innerHTML = html;
    // Đã kết nối → dọn thông báo lỗi "Chưa kết nối" CŨ còn kẹt ở thanh trạng thái Flow (statusflow) để 2 chỗ không mâu thuẫn.
    try { const sf = document.getElementById('statusflow'); if (sf && /Chưa kết nối|Chưa đăng nhập/i.test(sf.textContent || '')) setStatusF('✓ Đã kết nối · ' + n + ' tài khoản.', 'info'); } catch (e) {}
  } catch (e) { el.innerHTML = '<span style="color:var(--amber)">⚠️ Chưa kết nối</span> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; }
}

async function bulkDownloadAll(){
  const done = bulkState.items.filter(x => x.status === 'done' && x.dataUrl);
  if (!done.length) { setStatusF('Chưa có ảnh nào để tải.', 'error'); return; }
  for (const it of done) { const a = document.createElement('a'); a.href = it.dataUrl; a.download = it.name + '.' + (((it.mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg')); document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 120)); }
  setStatusF(`Đã tải ${done.length} ảnh.`, 'ok');
}

function tfCfg(){
  return {
    model: document.getElementById('tfModel').value,
    aspect: document.getElementById('tfAspect').value,
    quality: document.getElementById('tfQuality').value,
    conc: parseInt(document.getElementById('tfConc').value) || 2,
    delay: (document.getElementById('tfDelay')?.value === 'rand510' ? -1 : (parseInt(document.getElementById('tfDelay')?.value) || 0)),   // độ trễ giữa các lần gọi ảnh (ms); -1 = ngẫu nhiên 5–10s
  };
}

async function tfRefreshConn(){
  const el = document.getElementById('tfConn');
  if (!el) return;
  el.innerHTML = '';   // trạng thái kết nối đã hiện ở mục "Chế độ xác thực" phía trên → panel chỉ hiện danh sách tài khoản (khỏi trùng)
  // Chế độ Tích hợp sẵn: bảng tự làm mới sống để thấy account lên 🟢 khi auto-refresh chạy.
  if (flowBridge.mode === 'builtin') tfStartBuiltinPoll();
  else if (_tfBuiltinPoll){ clearInterval(_tfBuiltinPoll); _tfBuiltinPoll = null; }
  try { fcRenderList(); } catch (e) {}   // danh sách account Chrome (GĐ2)
}

function tfStartBuiltinPoll(){
  if (_tfBuiltinPoll) return;   // đã chạy
  _tfBuiltinPoll = setInterval(async () => {
    if (flowBridge.mode !== 'builtin'){ clearInterval(_tfBuiltinPoll); _tfBuiltinPoll = null; return; }
    const el = document.getElementById('tfConn');
    if (!el || el.contains(document.activeElement)) return;   // đang gõ trong bảng → khỏi vẽ lại
    const s = await flowBridge.call('GET_STATUS').catch(() => null);
    if (s && !s.error) tfRenderConn(s);
  }, 6000);
}

function tfTierName(t){ return t === 'PAYGATE_TIER_TWO' ? 'Ultra' : t === 'PAYGATE_TIER_ONE' ? 'Pro' : 'Free'; }

function _tfFmtExpiry(ms){ const d = new Date(ms); const p = n => String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`; }

function _tfExpCell(ms){
  if (!ms) return '<span style="color:var(--text-dim)">—</span>';
  const left = ms - Date.now();
  const col = left <= 0 ? 'var(--red)' : (left < 24*3600*1000 ? 'var(--amber)' : 'var(--text)');
  return `<span style="color:${col};${left<=0?'font-weight:600':''};white-space:nowrap">${_tfFmtExpiry(ms)}</span>`;
}

function tfRenderConn(s){
  const el = document.getElementById('tfConn');
  if (!el) return;
  if (!s || s.error){ el.innerHTML = '<span style="color:var(--red)">Lỗi trạng thái: ' + escapeHtml(s?.error || '') + '</span>'; return; }
  const ext = flowBridge.mode === 'extension';
  const accs = Array.isArray(s.accounts) ? s.accounts : [];
  if (ext && accs.length) _tfAutoPersist(accs);   // vẫn lưu tài khoản extension vào kho app
  el.innerHTML = ext ? '<div style="font-size:12px;color:var(--green)">● Extension đã kết nối</div>' : '';   // 1 danh sách DUY NHẤT = bảng bên dưới; ẩn danh sách pool cũ
  return;
  const readyCount = ext ? (s.hasToken ? accs.length : 0) : accs.filter(a => a.enabled !== false && a.hasToken).length;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div><b>${accs.length}</b> tài khoản · <span style="color:var(--green)">${readyCount} sẵn sàng</span>${ext ? ' <span style="color:var(--text-muted);font-size:11px">(quản lý trong Chrome)</span>' : ''}</div>
    </div>`;

  if (!accs.length){
    html += ext
      ? '<div style="color:var(--text-muted);font-size:13px">Chưa thấy tài khoản. Bấm <b>🌐 Mở Flow trong Chrome</b>, đăng nhập Google, rồi bấm <b>Quét lại</b>.</div>'
      : '<div style="color:var(--text-muted);font-size:13px">Chưa có tài khoản. Bấm <b>＋ Thêm tài khoản Flow</b> (đăng nhập Google) hoặc dán Cookie bên dưới.</div>';
  } else {
    html += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="text-align:left;color:var(--text-muted)">
        ${ext ? '' : '<th style="padding:5px 4px">Bật</th>'}<th style="padding:5px 4px">Tài khoản</th><th style="padding:5px 4px">Gói</th>
        <th style="padding:5px 4px">Credit</th>${ext ? '' : '<th style="padding:5px 4px">Hạn Cookie</th><th style="padding:5px 4px">Hạn Token</th>'}<th style="padding:5px 4px">Trạng thái</th>
        ${ext ? '' : '<th style="padding:5px 4px">Proxy</th><th style="padding:5px 4px"></th>'}
      </tr></thead><tbody>`;
    for (const a of accs){
      if (a.engine === 'chrome') continue;   // tài khoản CfT chỉ hiện ở danh sách CfT bên dưới (khỏi trùng)
      const active = ext ? !!s.hasToken : !!a.hasToken;
      const st = active ? '<span style="color:var(--green)">● Hoạt động</span>' : '<span style="color:var(--red)">○ Hết hạn</span>';
      const tokExp = a.capturedAt ? (a.capturedAt + 55 * 60 * 1000) : null;
      html += `<tr style="border-top:1px solid var(--border)">
        ${ext ? '' : `<td style="padding:5px 4px"><input type="checkbox" ${a.enabled !== false ? 'checked' : ''} onchange="tfSetEnabled(${a.id}, this.checked)"></td>`}
        <td style="padding:5px 4px">${a.engine === 'chrome' ? '🖥️ ' : ''}${escapeHtml(a.email || ('TK ' + (a.id ?? '')))}</td>
        <td style="padding:5px 4px"><b>${tfTierName(a.tier)}</b></td>
        <td style="padding:5px 4px">${a.credits ?? '—'}</td>
        ${ext ? '' : `<td style="padding:5px 4px">${_tfExpCell(a.cookieExpiry)}</td><td style="padding:5px 4px">${_tfExpCell(tokExp)}</td>`}
        <td style="padding:5px 4px">${st}</td>
        ${ext ? '' : `<td style="padding:5px 4px"><input value="${escapeHtml(a.proxy || '')}" placeholder="host:port" onchange="tfSetProxy(${a.id}, this.value)" style="width:118px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px"></td>
        <td style="padding:5px 4px;white-space:nowrap">
          <button class="btn ghost sm" onclick="tfRefreshAcc(${a.id})" title="Làm mới token + credit">↻</button>
          <button class="btn ghost sm" onclick="tfDelAcc(${a.id})" title="Xoá tài khoản" style="color:var(--red)">🗑</button>
        </td>`}
      </tr>`;
    }
    html += '</tbody></table></div>';
  }

  if (!ext){
    html += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">🍪 <b>Thêm bằng Cookie</b> (xuất từ extension <em>Cookie Exporter</em> trên labs.google/fx — dán JSON hoặc chuỗi cookie, khỏi đăng nhập):</div>
        <textarea id="tfCookieInput" placeholder="Dán cookie vào đây…" style="width:100%;height:52px;padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:11px;box-sizing:border-box;resize:vertical"></textarea>
        <button class="btn ghost sm" style="margin-top:6px" onclick="tfAddCookie()">＋ Thêm bằng Cookie</button>
      </div>`;
  } else {
    html += '<div id="tfSaveNote" style="margin-top:10px;font-size:11.5px;color:var(--text-muted)">💾 Tự động lưu tài khoản vào app để dùng lại khi đổi trình duyệt…</div>';
  }

  el.innerHTML = html;
  if (ext && accs.length) _tfAutoPersist(accs);
}

async function tfSetEnabled(id, en){ await flowBridge.call('SET_ENABLED', { id, enabled: en }); }

async function tfSetProxy(id, proxy){
  const r = await flowBridge.call('SET_PROXY', { id, proxy: (proxy || '').trim() });
  setStatusF(r?.error ? ('Proxy lỗi: ' + r.error) : 'Đã lưu proxy cho tài khoản.', r?.error ? 'error' : 'ok');
}

async function tfRefreshAcc(id){
  setStatusF('Đang làm mới tài khoản…', 'info');
  const r = await flowBridge.call('REFRESH_ACCOUNT', { id });
  tfRefreshConn();
  setStatusF(r?.hasToken ? 'Đã làm mới.' : 'Chưa lấy được token — bấm ＋ Thêm tài khoản Flow để đăng nhập lại account này.', r?.hasToken ? 'ok' : 'info');
}

async function tfDelAcc(id){
  if (!confirm('Xoá tài khoản Flow này khỏi app?')) return;
  await flowBridge.call('REMOVE_ACCOUNT', { id });
  tfRefreshConn();
}

async function tfAddCookie(){
  const ta = document.getElementById('tfCookieInput');
  const v = ta ? ta.value.trim() : '';
  if (!v){ setStatusF('Dán chuỗi cookie vào ô trước đã.', 'info'); return; }
  setStatusF('Đang thêm tài khoản bằng cookie…', 'info');
  const r = await flowBridge.call('ADD_ACCOUNT_COOKIE', { cookies: v });
  if (r?.error){ setStatusF('Thêm cookie lỗi: ' + r.error, 'error'); }
  else { setStatusF('Đã thêm tài khoản' + (r.email ? ': ' + r.email : '') + '.', 'ok'); if (ta) ta.value = ''; }
  tfRefreshConn();
}

async function tfScan(){
  const el = document.getElementById('tfConn');
  const ok = await flowBridge.waitReady(1500);
  if (!ok){ tfRefreshConn(); return; }
  if (el) el.textContent = 'Đang quét…';
  tfRenderConn(await flowBridge.call('SCAN'));
}

async function tfCftAdd(){
  if (_tfCftBusy) return;
  if (!window.native?.flowCftAdd){ setStatusF('Chỉ dùng được trong app desktop.', 'error'); return; }
  if (!window._cftHooked && window.native.onFlowCftProgress){
    window._cftHooked = true;
    window.native.onFlowCftProgress((o) => {
      if (o.type === 'download') setStatusF('⬇ Đang tải Chrome for Testing… ' + o.pct + '%', 'working');
      else if (o.msg) setStatusF(o.msg, 'working');
    });
  }
  _tfCftBusy = true;
  const btn = document.getElementById('tfCftBtn'); if (btn){ btn.disabled = true; btn.textContent = '🌐 Đang mở Chrome… (Huỷ)'; btn.onclick = tfCftCancel; }
  setStatusF('🌐 Đang mở Chrome — hãy đăng nhập tài khoản Google trong cửa sổ vừa mở.', 'working');
  let added = false;
  try {
    const r = await window.native.flowCftAdd();
    if (r?.error) setStatusF('Lỗi: ' + r.error, 'error');
    else if (r?.hasToken || r?.ok){ added = true; setStatusF('✓ Đã lưu tài khoản' + (r.email ? ' ' + r.email : '') + ' vào kho app. Đang hiện kho "Tích hợp sẵn" (nơi chạy song song nhiều tài khoản).', 'ok'); }
    else setStatusF('Chưa lưu được — thử lại.', 'error');
  } catch (e){ setStatusF('Lỗi: ' + (e.message || e), 'error'); }
  _tfCftBusy = false;
  if (btn){ btn.disabled = false; btn.textContent = '🌐 Thêm bằng Chrome (lưu vào app)'; btn.onclick = tfCftAdd; }
  // Tài khoản "Thêm bằng Chrome" lưu vào kho BUILT-IN → chuyển panel sang đó để thấy ngay.
  if (added) tfSetMode('builtin'); else tfRefreshConn();
}

function tfCftCancel(){ try { window.native?.flowCftCancel?.(); } catch (e) {} setStatusF('Đã huỷ.', 'info'); }

function _fcStatus(html, col){ const el = document.getElementById('fcStatus'); if (el){ el.innerHTML = html; el.style.color = col || 'var(--text-muted)'; } }

function wmRefreshStatus(){
  const el = document.getElementById('fcWmStatus');
  if (el){ el.textContent = 'sẵn sàng — bấm để tắt'; el.style.color = 'var(--text-muted)'; }
}

function _fcDate(ms){
  if (!ms) return '<span style="color:var(--text-dim)">—</span>';
  const d = new Date(ms), p = n => String(n).padStart(2,'0'), exp = ms <= Date.now();
  return `<span style="color:${exp?'var(--red)':'var(--text)'};white-space:nowrap;font-size:11px">${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}</span>`;
}

async function fcRenderList(){
  const el = document.getElementById('fcList'); if (!el || !window.native?.flowChrome) return;
  if (typeof wmRefreshStatus === 'function') wmRefreshStatus();   // cập nhật trạng thái ô Watermark
  const s = await window.native.flowChrome('GET_ACCOUNTS').catch(() => null);
  const accs = s?.accounts || [];
  const activeN = accs.filter(a => a.enabled !== false && a.hasToken && !a.needLogin).length;
  let h = `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:9px">
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer"><input type="checkbox" ${accs.length && accs.every(a=>a.enabled!==false)?'checked':''} onchange="fcSetAllEnabled(this.checked)"> Bật tất cả</label>
      <span style="font-size:12px;color:var(--text-muted)">Tài khoản hoạt động: <b style="color:var(--green)">${activeN}</b>/${accs.length}</span>
      <select id="capModeSel" onchange="fcSetCapMode(this.value)" title="Máy giải reCAPTCHA. Guest (như đối thủ): Chrome trống dùng-1-lần, xoay profile+proxy mới liên tục → né 'unusual activity', KHÔNG đụng tài khoản thật. Account: xoay giữa các tài khoản." style="margin-left:auto;font-size:11.5px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">
        <option value="guest" ${(typeof _capModeCache==='undefined'||_capModeCache!=='account')?'selected':''}>🕵️ Captcha: Guest (khuyến nghị)</option>
        <option value="account" ${(typeof _capModeCache!=='undefined'&&_capModeCache==='account')?'selected':''}>👤 Captcha: Tài khoản</option>
      </select>
      <button class="btn ghost sm" onclick="fcRefreshAll()">↻ Làm mới tất cả</button>
    </div>`;
  if (!accs.length){ el.innerHTML = h + '<div style="color:var(--text-dim);font-size:12.5px;padding:8px 0">Chưa có tài khoản. Bấm <b>＋ Thêm tài khoản</b> ở trên để đăng nhập Google.</div>'; return; }
  h += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">
      <th style="padding:6px 5px">#</th><th style="padding:6px 5px">Bật</th><th style="padding:6px 5px">Ảnh</th><th style="padding:6px 5px">Video</th>
      <th style="padding:6px 5px">Tài khoản</th><th style="padding:6px 5px">Loại</th><th style="padding:6px 5px">Tín dụng</th>
      <th style="padding:6px 5px">Proxy</th><th style="padding:6px 5px">Hạn Cookie</th><th style="padding:6px 5px">Hạn Token</th>
      <th style="padding:6px 5px">Trạng thái</th><th style="padding:6px 5px">Hành động</th>
    </tr></thead><tbody>`;
  accs.forEach((a, i) => {
    const st = a.needLogin ? '<span style="color:var(--amber);font-weight:600">CẦN ĐN LẠI</span>'
      : (a.hasToken ? '<span style="color:var(--green);font-weight:600">HOẠT ĐỘNG</span>' : '<span style="color:var(--red);font-weight:600">HẾT HẠN</span>');
    const relogin = a.needLogin ? `<button class="btn sm" style="background:var(--amber);color:#111" title="Đăng nhập lại" onclick="fcRelogin(${a.id})">🔑 Đăng nhập lại</button> ` : '';
    h += `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 5px;color:var(--text-dim)">${i+1}</td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.enabled!==false?'checked':''} onchange="fcSetEnabled(${a.id},this.checked)"></td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.useImage!==false?'checked':''} onchange="fcSetUse(${a.id},'image',this.checked)"></td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.useVideo!==false?'checked':''} onchange="fcSetUse(${a.id},'video',this.checked)"></td>
      <td style="padding:6px 5px;white-space:nowrap">${escapeHtml(a.email||('Chrome '+a.id))}</td>
      <td style="padding:6px 5px"><b>${tfTierName(a.tier)}</b></td>
      <td style="padding:6px 5px;color:var(--amber)">${a.credits ?? '—'}</td>
      <td style="padding:6px 5px"><input value="${escapeHtml(a.proxy||'')}" placeholder="host:port" onchange="fcSetProxy(${a.id},this.value)" style="width:96px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px"></td>
      <td style="padding:6px 5px">${_fcDate(a.cookieExpiry)}</td>
      <td style="padding:6px 5px">${_fcDate(a.tokenExpiry)}</td>
      <td style="padding:6px 5px">${st}</td>
      <td style="padding:6px 5px;white-space:nowrap">${relogin}<button class="btn ghost sm" title="Làm mới" onclick="fcRefresh(${a.id})">↻</button> <button class="btn ghost sm" style="color:var(--red)" title="Xoá" onclick="fcRemove(${a.id})">🗑</button></td>
    </tr>`;
  });
  el.innerHTML = h + '</tbody></table></div>';
}

async function fcAddAccount(){
  _fcStatus('⏳ Đang mở Chrome for Testing… Hãy <b>đăng nhập Google</b> trong cửa sổ vừa mở. App sẽ <b>tự nhận biết & lưu</b> — không cần bấm gì thêm.', 'var(--violet)');
  const r = await window.native.flowChrome('LOGIN_AUTO').catch(e=>({error:String(e)}));
  if (r?.error){ _fcStatus('❌ ' + r.error, 'var(--red)'); fcRenderList(); return; }
  _fcStatus('✅ <b>Đã thêm tài khoản</b>' + (r.email ? ' — ' + escapeHtml(r.email) : '') + '.', 'var(--green)');
  fcRenderList();
  try { if (typeof tfRefreshConn === 'function') tfRefreshConn(); } catch (e) {}   // cập nhật chỉ báo kết nối/đếm tài khoản ở các tab
  try { if (typeof bulkFlowStatus === 'function') bulkFlowStatus(); } catch (e) {}
}

async function fcSetUse(id, kind, val){ await window.native.flowChrome('SET_USE', { id, kind, val }).catch(()=>{}); }

async function fcSetProxy(id, proxy){ await window.native.flowChrome('SET_PROXY', { id, proxy:(proxy||'').trim() }).catch(()=>{}); _fcStatus('Đã lưu proxy.', 'var(--green)'); }

async function fcSetAllEnabled(on){ const s = await window.native.flowChrome('GET_ACCOUNTS').catch(()=>null); for (const a of (s?.accounts||[])) await window.native.flowChrome('SET_ENABLED',{id:a.id,enabled:on}).catch(()=>{}); fcRenderList(); }

async function fcSetCapMode(m){
  _capModeCache = (m === 'account') ? 'account' : 'guest';
  try { await window.native.flowChrome('SET_CAPTCHA_MODE', { mode: _capModeCache }); } catch (e) {}
  _fcStatus(_capModeCache === 'guest' ? '✓ Máy captcha: Guest — Chrome trống xoay liên tục (né unusual-activity, không đụng tài khoản).' : '✓ Máy captcha: Tài khoản — xoay giữa các account.', 'var(--green)');
}

async function fcRefreshAll(){ _fcStatus('⏳ Đang làm mới tất cả (mở Chrome từng cái)…','var(--violet)'); const s = await window.native.flowChrome('GET_ACCOUNTS').catch(()=>null); for (const a of (s?.accounts||[])){ if (a.enabled!==false && !a.needLogin) await window.native.flowChrome('REFRESH',{id:a.id}).catch(()=>{}); } _fcStatus('✅ Đã làm mới tất cả.','var(--green)'); fcRenderList(); }

async function tfAddCookie2(){
  const ta = document.getElementById('tfCookieInput2'); const v = ta ? ta.value.trim() : '';
  if (!v){ _fcStatus('Dán chuỗi cookie vào ô trước đã.', 'var(--amber)'); return; }
  _fcStatus('⏳ Đang thêm bằng cookie…', 'var(--violet)');
  const r = await flowBridge.call('ADD_ACCOUNT_COOKIE', { cookies: v }).catch(e=>({error:String(e)}));
  if (r?.error){ _fcStatus('❌ Thêm cookie lỗi: ' + r.error, 'var(--red)'); }
  else { _fcStatus('✅ Đã thêm tài khoản' + (r.email ? ': ' + escapeHtml(r.email) : '') + '.', 'var(--green)'); if (ta) ta.value=''; }
  fcRenderList();
}

async function fcSetEnabled(id, en){ await window.native.flowChrome('SET_ENABLED', { id, enabled: en }).catch(()=>{}); }

async function fcRefresh(id){ _fcStatus('⏳ Làm mới account #' + id + '…', 'var(--violet)'); const r = await window.native.flowChrome('REFRESH', { id }).catch(e=>({error:String(e)})); _fcStatus(r?.error ? ('❌ ' + r.error) : ('✅ Đã làm mới' + (r.email ? ' ' + escapeHtml(r.email) : '')), r?.error ? 'var(--red)' : 'var(--green)'); fcRenderList(); }

async function fcRemove(id){ if (!confirm('Xoá account Chrome #' + id + '? (xoá cả profile đăng nhập)')) return; await window.native.flowChrome('REMOVE', { id }).catch(()=>{}); fcRenderList(); }

async function fcRelogin(id){
  _fcStatus('⏳ Đang mở Chrome for Testing… Hãy <b>đăng nhập Google</b> trong cửa sổ vừa mở. App sẽ <b>tự nhận biết & hoàn tất</b> — không cần bấm gì thêm.', 'var(--violet)');
  const r = await window.native.flowChrome('RELOGIN', { id }).catch(e=>({error:String(e)}));
  if (r?.error){ _fcStatus('❌ ' + r.error, 'var(--red)'); fcRenderList(); return; }
  _fcStatus('✅ <b>Đã đăng nhập lại tự động</b>' + (r.email ? ' — ' + escapeHtml(r.email) : ' #' + id) + ' (Chrome for Testing).', 'var(--green)');
  fcRenderList();
}

function _tfBridgeTimed(action, payload, ms){
  return Promise.race([ flowBridge.call(action, payload || {}), new Promise(r => setTimeout(() => r({ error: 'TIMEOUT' }), ms || 8000)) ]);
}

async function _tfAutoPersist(accs){
  const key = (accs || []).map(a => a.email || a.id).sort().join('|');
  if (!key || key === _tfPersistKey) return;   // đã thử cho bộ này rồi
  _tfPersistKey = key;
  const setNote = (m, c) => { const el = document.getElementById('tfSaveNote'); if (el){ el.innerHTML = m; el.style.color = c || 'var(--text-muted)'; } };
  if (!window.native?.flow){ setNote('💾 Lưu vào app chỉ hoạt động ở bản desktop.'); return; }
  setNote('⏳ Đang lưu tài khoản vào app…', 'var(--violet)');
  // Danh sách đã lưu trong app (nhanh, không mở cửa sổ).
  const have = new Set();
  try { const cur = await window.native.flow('GET_ACCOUNTS'); (cur?.accounts || []).forEach(a => { if (a.email) have.add(a.email.toLowerCase()); }); } catch (e) {}
  let saved = 0; accs.forEach(a => { if (a.email && have.has(a.email.toLowerCase())) saved++; });
  // Xin cookie từ extension → lưu vào kho app.
  let got = 0, exported = false;
  for (const act of ['EXPORT_COOKIES', 'GET_COOKIES', 'EXPORT_COOKIE']){
    const r = await _tfBridgeTimed(act, {}, 8000);
    if (!r || r.error) continue;
    exported = true;
    const list = Array.isArray(r) ? r : (r.accounts || (r.cookies ? [r] : []));
    for (const it of list){
      const ck = it.cookies || it.cookie || (typeof it === 'string' ? it : null); if (!ck) continue;
      const em = (it.email || '').toLowerCase(); if (em && have.has(em)) continue;   // đã lưu rồi
      setNote('⏳ Đang lưu tài khoản… (mở phiên bắt token, chờ ~20s)', 'var(--violet)');
      try { const rr = await window.native.flow('ADD_ACCOUNT_COOKIE', { cookies: ck }); if (rr && !rr.error){ got++; if (rr.email) have.add(rr.email.toLowerCase()); } } catch (e) {}
    }
    break;
  }
  const total = saved + got;
  if (total > 0){
    setNote('✓ Đã lưu <b>' + total + '</b> tài khoản vào app — dùng lại được khi đổi trình duyệt (chọn chế độ <b>Tích hợp sẵn</b>).', 'var(--green)');
  } else if (!exported){
    setNote('⚠️ Extension chưa cho lấy cookie — hãy <b>Reload extension</b> (chrome://extensions → ⟳) rồi bấm <b>Quét lại</b>. Hoặc dùng <b>Tích hợp sẵn</b> để app tự giữ tài khoản.', 'var(--amber)');
  } else {
    setNote('⚠️ Chưa lưu được (cookie chưa hợp lệ / đã hết hạn). Đăng nhập lại tài khoản rồi Quét lại.', 'var(--amber)');
  }
}

function tfSetMode(m){
  flowBridge.setMode(m);
  tfSyncModeUI();
  const el = document.getElementById('tfConn');   // xóa bảng cũ ngay, tránh lẫn tài khoản 2 chế độ
  if (el) el.innerHTML = '';
  tfRenderExtStatus();
  tfRefreshConn();
  // Chuyển sang chế độ Extension → tự đẩy token sang extension (thay cho nút "Đẩy sang Extension" đã bỏ).
  if (m === 'extension' && window.native?.flowPushExt){ window.native.flowPushExt().catch(()=>{}); }
}

function tfSyncModeUI(){
  const m = flowBridge.mode;
  ['builtin','extension'].forEach(k => {
    const r = document.querySelector(`input[name="tfAuthMode"][value="${k}"]`);
    if (r) r.checked = (k === m);
    const card = document.getElementById('tfModeCard_' + k);
    if (card){ card.style.borderColor = (k === m) ? 'var(--accent)' : 'var(--border)'; card.style.background = (k === m) ? 'rgba(124,58,237,.05)' : 'transparent'; }
  });
  const addBtn = document.getElementById('tfAddBtn');
  if (addBtn) addBtn.textContent = (m === 'extension') ? '🌐 Mở Flow trong Chrome' : '＋ Thêm tài khoản Flow';
}

function tfRenderExtStatus(){
  const el = document.getElementById('tfExtStatus');
  if (!el) return;
  if (flowBridge.mode !== 'extension' || !window.native?.flowBridgeStatus){
    el.innerHTML = '';
    if (_tfExtPoll){ clearInterval(_tfExtPoll); _tfExtPoll = null; }
    return;
  }
  const tick = async () => {
    const s = await window.native.flowBridgeStatus().catch(() => null);
    const connected = !!s?.extensionConnected;
    if (connected) {
      // Extension cũ hơn bản đóng gói trong app → nhắc khách tải lại + reload.
      const outdated = s.extVersion && s.latestExtVersion && s.extVersion !== s.latestExtVersion;
      if (outdated) {
        el.innerHTML = `<div style="background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.5);border-radius:10px;padding:11px 13px">
            <div style="color:var(--amber);font-weight:700;font-size:13px;margin-bottom:8px">⚠️ Extension cũ (v${escapeHtml(s.extVersion)}) — đã có bản mới <b>v${escapeHtml(s.latestExtVersion)}</b>. Cập nhật 2 bước:</div>
            <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px">
              <button class="btn primary sm" onclick="tfDownloadExt()">⬇ 1 · Tải lại extension (ghi đè)</button>
              <button class="btn ghost sm" onclick="tfCopyExtUrl()">📋 Copy chrome://extensions</button>
            </div>
            <div style="font-size:12px;color:var(--text)"><b>2.</b> Vào <b>chrome://extensions</b> → bấm nút <b>⟳ (Reload)</b> trên AI Video Studio.</div>
          </div>`;
        return;
      }
      el.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.4);color:var(--green);padding:6px 12px;border-radius:8px;font-weight:600;font-size:13px">✅ Extension đã kết nối${s.extVersion ? ' (v' + escapeHtml(s.extVersion) + ')' : ''} — sẵn sàng chạy</div>`;
      return;
    }
    // Chưa kết nối → hiện hướng dẫn 4 bước rõ ràng cho khách.
    el.innerHTML = `
      <div style="background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:12px 14px">
        <div style="color:var(--amber);font-weight:700;font-size:13.5px;margin-bottom:10px">⚠️ Chưa kết nối extension — làm 4 bước dưới (chỉ lần đầu, ~2 phút)</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn primary sm" onclick="tfDownloadExt()">⬇ Bước 1 · Tải Extension</button>
          <button class="btn ghost sm" onclick="tfCopyExtUrl()">📋 Copy <b>chrome://extensions</b></button>
          <button class="btn ghost sm" onclick="tfScan()">↻ Quét lại</button>
        </div>
        <div style="color:var(--text);line-height:1.85;font-size:12.5px">
          <b>1.</b> Bấm <b>⬇ Bước 1 · Tải Extension</b> → chọn nơi lưu (app tự mở thư mục lên cho bạn).<br>
          <b>2.</b> Mở <b>Chrome</b> → bấm <b>📋 Copy chrome://extensions</b> ở trên → dán vào thanh địa chỉ Chrome → Enter.<br>
          <b>3.</b> Bật <b>Chế độ dành cho nhà phát triển</b> (nút gạt góc trên phải) → bấm <b>Tải tiện ích chưa đóng gói</b> → chọn thư mục vừa tải ở bước 1.<br>
          <b>4.</b> Mở 1 tab vào <b>labs.google/fx/tools/flow</b>, đăng nhập Google → quay lại đây, app <b>tự kết nối</b> (hoặc bấm ↻ Quét lại).
        </div>
        <div style="margin-top:9px;font-size:11.5px;color:var(--text-muted)">💡 Sau khi cập nhật app: vào <b>chrome://extensions</b> bấm nút <b>⟳ (Reload)</b> trên AI Video Studio để dùng bản mới.</div>
      </div>`;
  };
  tick();
  if (_tfExtPoll) clearInterval(_tfExtPoll);
  _tfExtPoll = setInterval(tick, 3000);
}

async function tfCopyExtUrl(){
  try { await navigator.clipboard.writeText('chrome://extensions'); setStatusF('✓ Đã copy "chrome://extensions" — dán vào thanh địa chỉ Chrome rồi Enter.', 'success'); }
  catch(e){ setStatusF('Copy lỗi — gõ tay: chrome://extensions', 'info'); }
}

async function tfDownloadExt(){
  if (!window.native?.flowExtExport){ setStatusF('Chức năng tải extension chỉ có trên bản app.', 'error'); return; }
  setStatusF('Đang xuất extension…', 'info');
  const r = await window.native.flowExtExport().catch((e) => ({ error: String(e) }));
  if (r?.canceled){ setStatusF('Đã huỷ.', 'info'); return; }
  if (r?.error){ setStatusF('Lỗi tải extension: ' + r.error, 'error'); return; }
  setStatusF('✓ Đã lưu extension vào: ' + (r.path || '') + ' — giờ mở chrome://extensions và "Tải tiện ích chưa đóng gói" trỏ vào thư mục này.', 'success');
}

function _flowAbort(on){ try { flowBridge.call('POOL_ABORT', { on: !!on }); } catch (e) {} }

function tfStop(){ tfState.stop = true; _flowAbort(true); setStatusF('⏸ Đang dừng ngay…', 'info'); }

function _tfRaceStop(promise){
  let settled = false;
  const p = Promise.resolve(promise).then(v => { settled = true; return v; }, e => { settled = true; return { error: (e && e.message) || String(e) }; });
  const stopP = new Promise(res => {
    const t = setInterval(() => {
      if (settled){ clearInterval(t); return; }
      if (tfState.stop){ clearInterval(t); res({ _stopped: true }); }
    }, 200);
  });
  return Promise.race([p, stopP]);
}

function _tfSleepStop(ms){
  return new Promise(res => {
    const end = Date.now() + ms;
    const t = setInterval(() => {
      if (tfState.stop){ clearInterval(t); res(true); }
      else if (Date.now() >= end){ clearInterval(t); res(false); }
    }, 200);
  });
}

async function tfPool(items, worker, limit, delayMs = 0){
  if (!tfState.stop) _flowAbort(false);   // bắt đầu mẻ mới (không phải sau khi bấm Dừng) → gỡ cờ abort backend còn sót từ lần Dừng trước
  let i = 0;
  const n = Math.min(limit, items.length);
  const _rand = (delayMs === -1);                                       // -1 = NGẪU NHIÊN 5–10s mỗi ảnh (né bot tốt nhất)
  const _base = _rand ? 7500 : delayMs;                                 // giá trị nền để rải nhịp khởi động
  const jitter = (ms) => ms > 0 ? Math.round(ms * (0.7 + Math.random() * 0.6)) : 0;   // ±30% cho tự nhiên
  const perImg = () => _rand ? (5000 + Math.floor(Math.random() * 5001)) : jitter(delayMs);   // 5000–10000ms nếu random
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const runners = Array.from({ length: n }, async (_v, k) => {
    if (_base > 0 && k > 0) await sleep(jitter(_base / n) * k);   // rải nhịp khởi động, đừng bắn cùng lúc
    while (!tfState.stop && i < items.length){
      const my = i++;
      await worker(items[my], my);
      if ((_rand || delayMs > 0) && !tfState.stop && i < items.length) await sleep(perImg());   // nghỉ giữa các ảnh
    }
  });
  await Promise.all(runners);
}

async function tfEnsureProject(){
  if (tfState.projectId) return tfState.projectId;
  const r = await flowBridge.call('CREATE_PROJECT', { title: 'AI Video Studio ' + new Date().toLocaleString('vi-VN') });
  if (r?.error || !r?.project_id) throw new Error('Không tạo được project: ' + (r?.error || '?'));
  tfState.projectId = r.project_id;
  return tfState.projectId;
}

function _tfImgSrc(img){
  if (!img) return '';
  return img.base64.startsWith('data:') ? img.base64 : ('data:' + (img.mediaType || 'image/png') + ';base64,' + img.base64);
}

function _slugId(s){ return String(s).replace(/[^a-zA-Z0-9]/g, '_'); }

function tfScenesWithPrompt(){
  if (!state.scenes) return [];
  // Cảnh ĐÃ có clip video (YouTube/stock) thì khỏi tạo ảnh AI — clip sẽ đè lên, tạo ảnh chỉ tốn quota Flow.
  const hasClip = (id) => { const pk = (state.mediaPicks || {})[id]; return !!(pk && pk.kind === 'video' && pk.downloadUrl); };
  return state.scenes.filter(s => state.scenePrompts && state.scenePrompts[s.id] && String(state.scenePrompts[s.id]).trim() && !hasClip(s.id));
}

function _tfSceneCard(id, variant){
  const store = variant === 'b' ? state.sceneImagesB : state.sceneImages;
  const src = _tfImgSrc(store?.[id]);
  const sid = escapeHtml(String(id));
  const isB = variant === 'b';
  const cardId = 'tf-scene-' + id + (isB ? 'b' : '');
  const vArg = isB ? "'b'" : "'a'";
  return `<div class="tf-card" id="${cardId}" style="border:1px solid ${isB ? 'var(--accent)' : 'var(--border)'};border-radius:10px;overflow:hidden;background:var(--surface)">
      <div class="tf-thumb" ${src ? `onclick="tfEnlargeScene('${sid}',${vArg})" ` : ''}style="aspect-ratio:16/9;background:#0002 center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);cursor:${src ? 'zoom-in' : 'default'}">${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">` : 'cảnh ' + sid + (isB ? ' B' : '')}</div>
      <div style="padding:6px;display:flex;gap:6px;align-items:center">
        <span style="flex:1;font-size:11px;color:var(--text-muted)">Cảnh ${sid}${isB ? ' <b style="color:var(--accent)">B</b>' : ''}</span>
        <button class="btn ghost sm" style="padding:2px 7px;font-size:13px" onclick="tfEnlargeScene('${sid}',${vArg})" title="Xem lớn">🔍</button>
        <button class="btn ghost sm" style="padding:2px 7px;font-size:13px" onclick="tfRegenScene('${sid}',${vArg})" title="Tạo lại">🔄</button>
      </div>
    </div>`;
}

function tfRenderScenes(){
  const info = document.getElementById('tfSceneInfo');
  const grid = document.getElementById('tfSceneGrid');
  if (!info || !grid) return;
  const withP = tfScenesWithPrompt();
  let bCount = 0, aImg = 0, bImg = 0, html = '';
  for (const s of withP){
    if (state.sceneImages && state.sceneImages[s.id]) aImg++;
    html += _tfSceneCard(s.id, 'a');
    const hasB = state.scenePrompts2 && state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim();
    if (hasB){ bCount++; if (state.sceneImagesB && state.sceneImagesB[s.id]) bImg++; html += _tfSceneCard(s.id, 'b'); }
  }
  const totalUnits = withP.length + bCount;
  info.innerHTML = `Có prompt: <b>${withP.length}</b> cảnh${bCount ? ` + <b>${bCount}</b> ảnh B` : ''} = <b>${totalUnits}</b> ảnh · Đã tạo: <b>${aImg + bImg}</b>`;
  grid.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px">Chưa có prompt cảnh nào. Chạy Tool 2 tạo prompt trước.</div>';
}

function tfEnlarge(src){
  if (!src) return;
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:24px';
  m.innerHTML = `<img src="${src}" style="max-width:96vw;max-height:92vh;border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,.6)">`;
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  m.onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
}

function tfEnlargeScene(id, variant){
  const store = variant === 'b' ? state.sceneImagesB : state.sceneImages;
  const src = _tfImgSrc(store?.[id]);
  if (!src) return setStatusF('Cảnh ' + id + (variant === 'b' ? ' B' : '') + ' chưa có ảnh.', 'info');
  tfEnlarge(src);
}

async function tfRegenScene(id, variant){
  // Báo trạng thái ra CẢ tab Flow lẫn Tool 2 (nút tạo lại nằm ở bảng cảnh Tool 2 → nếu chỉ setStatusF thì bấm không thấy gì).
  const _rs = (m, t) => { try { setStatusF(m, t); } catch (e) {} if (typeof setStatus2 === 'function') { try { setStatus2(m, t); } catch (e) {} } };
  if (tfState.running) { _rs('Đang chạy mẻ khác — đợi xong rồi tạo lại.', 'error'); return; }
  const isB = variant === 'b';
  const lbl = 'cảnh ' + id + (isB ? ' B' : '');
  const prompt = (isB ? state.scenePrompts2 : state.scenePrompts)?.[id];
  if (!prompt || !String(prompt).trim()) { _rs(lbl + ' chưa có prompt — bấm "Tạo prompt" ở tab Prompt ảnh trước.', 'error'); return; }
  _rs('🎨 Đang tạo lại ' + lbl + '… (~20–40s)', 'working');
  if (!(await flowBridge.waitReady(1500))) { _rs('Chưa thấy Flow. Vào Cài đặt bật/đăng nhập tài khoản Flow trước.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)) { _rs('Chưa kết nối Flow (chưa có tài khoản/token). Vào Cài đặt → Tài khoản Flow.', 'error'); return; }

  const cfg = tfCfg();
  const useRefs = !!document.getElementById('tfUseRefs')?.checked;
  const imgMap = tfAssetImageMap();
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  const thumb = document.getElementById('tf-scene-' + id + (isB ? 'b' : ''))?.querySelector('.tf-thumb');

  tfState.running = true; tfState.stop = false; tfState.projectId = null; tfState.uploaded = {};
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    if (thumb) { thumb.classList.remove('tf-fail'); thumb.textContent = '⏳'; }
    _rs('🔄 Đang tạo lại ' + lbl + '…', 'working');
    const refNames = useRefs ? tfExtractRefNames(prompt, imgMap) : [];
    const r = await tfDispatchGen(cleanPrompt(_t2WithPalette(prompt)), refNames, { multi, cfg, imgMap, projectId, tier: st.paygateTier });
    const e0 = (r?.media_entries || []).find(e => e.dataUrl);
    if (r?.error || !e0) { if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống'); _rs('Tạo lại ' + lbl + ' lỗi: ' + (r?.error || 'trống'), 'error'); }
    else {
      if (!state.sceneImages) state.sceneImages = {};
      if (!state.sceneImagesB) state.sceneImagesB = {};
      const store = isB ? state.sceneImagesB : state.sceneImages;
      store[id] = { base64: e0.dataUrl, mediaType: e0.mime || 'image/png', fileName: `scene-${id}${isB ? 'b' : ''}.png` };
      autoSaveSceneImage(id, isB, e0.dataUrl, e0.mime);
      saveState(true);
      if (typeof renderTable === 'function') renderTable();
      tfRenderScenes();
      _rs('✓ Đã tạo lại ' + lbl, 'ok');
    }
  } catch (e){ _rs('Lỗi tạo lại: ' + (e.message || e), 'error'); }
  finally { tfState.running = false; }
}

function tfEnlargeAsset(kind, name){
  const store = kind === 'char' ? state.characterImages : state.backgroundImages;
  const src = _tfImgSrc(store?.[name]);
  if (!src) return setStatusF(name + ' chưa có ảnh.', 'info');
  tfEnlarge(src);
}

async function tfRegenAsset(kind, name){
  if (tfState.running) { setStatusF('Đang chạy mẻ khác — đợi xong rồi tạo lại.', 'error'); return; }
  const prompt = (kind === 'char' ? state.assetCharPrompts : state.assetBgPrompts)?.[name];
  if (!prompt || !String(prompt).trim()) { setStatusF(name + ' chưa có prompt.', 'error'); return; }
  if (!(await flowBridge.waitReady(1500))) { setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)) { setStatusF('Chưa kết nối Flow.', 'error'); return; }

  const cfg = tfCfg();
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  const card = document.getElementById('tf-asset-' + kind + '-' + _slugId(name));
  const thumb = card?.querySelector('.tf-thumb');

  tfState.running = true; tfState.stop = false; tfState.projectId = null;
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    if (thumb) { thumb.classList.remove('tf-fail'); thumb.textContent = '⏳'; }
    setStatusF('🔄 Đang tạo lại ' + name + '…', 'working');
    // Lỗi MỀM (NO_ACCOUNTS do race, kẹt traffic/reCAPTCHA, token vừa hết) → tự thử lại vài lần, đừng fail ngay.
    let r, _tries = 0;
    while (true){
      r = await tfDispatchGen(cleanPrompt(prompt), [], { multi, cfg, projectId, tier: st.paygateTier });
      const soft = /NO_ACCOUNTS|TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki|UNAUTHENT|API_401|BRIDGE_TIMEOUT|\bTIMEOUT\b/i.test(String(r?.error || ''));
      if (!r?.error || !soft || _tries >= 3 || tfState.stop) break;
      _tries++;
      setStatusF('↻ ' + name + ' · ' + r.error + ' → thử lại (' + _tries + ')…', 'working');
      await new Promise(res => setTimeout(res, 1500 + _tries * 1500));
    }
    const e0 = (r?.media_entries || []).find(e => e.b64);
    if (r?.error || !e0) { if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống'); setStatusF('Tạo lại ' + name + ' lỗi: ' + (r?.error || 'trống'), 'error'); }
    else {
      if (kind === 'char') { if (!state.characterImages) state.characterImages = {}; }
      else { if (!state.backgroundImages) state.backgroundImages = {}; }
      const store = kind === 'char' ? state.characterImages : state.backgroundImages;
      store[name] = { base64: e0.b64, mediaType: e0.mime || 'image/png', fileName: name + '.png' };
      saveState(true);
      if (kind === 'char' && typeof renderCharImageGallery === 'function') renderCharImageGallery();
      tfRenderAssets();
      setStatusF('✓ Đã tạo lại ' + name, 'ok');
    }
  } catch (e){ setStatusF('Lỗi tạo lại: ' + (e.message || e), 'error'); }
  finally { tfState.running = false; }
}

function _refRoleNote(names){
  if (!names || !names.length) return '';
  return '\n\nREFERENCE IMAGES: The attached image(s) are REFERENCE SHEETS. A character model sheet shows the SAME character in several poses / a turnaround (and possibly a row of expression thumbnails); a location reference board shows the SAME place from several angles (e.g. a 2x2 grid of views). Use them ONLY to learn the IDENTITY, ARCHITECTURE, COLOUR PALETTE and ART STYLE of: '
    + names.join(', ')
    + '.\nHARD RULES for the image you generate:\n'
    + '- Produce ONE single scene exactly as described below, from ONE single camera angle. Do NOT reproduce any reference-sheet layout.\n'
    + '- Do NOT split the image into panels, tiles or a grid; do NOT draw multiple views / a 2x2 grid / a turnaround / a lineup; do NOT draw a row of expression thumbnails or a strip of faces; do NOT add borders, frames, captions or labels.\n'
    + '- Show each character only as many times as this scene needs (usually exactly once), and show each location as ONE continuous space seen from ONE viewpoint — fully integrated into the scene.\n'
    + '- For a person: keep the SAME face, hairstyle, age, body type, art style AND the SAME outfit/clothing (same garments, colours and accessories) as the reference across EVERY scene — only the POSE, ACTION and single facial expression change to fit this scene. Keep the character wearing the reference outfit for consistency UNLESS this scene\'s own text explicitly describes different clothing (e.g. it literally says pajamas / a raincoat), in which case follow the scene. Do NOT reproduce the sheet\'s layout or turnaround pose; render one single natural scene. Pick the ONE expression that fits the moment; never show several expressions.\n'
    + '- For a location: keep the same place, architecture, props and colour palette, but render it as ONE single natural establishing view for THIS scene — NOT a multi-angle sheet or grid.\n'
    + '- Keep line work, shading, colour palette and overall art style consistent with the reference.';
}

async function tfDispatchGen(prompt, refNames, o){
  if (o.multi){
    const refs = (refNames || []).map(n => {
      const img = o.imgMap[n]; if (!img) return null;
      const raw = img.base64.startsWith('data:') ? img.base64.split(',')[1] : img.base64;
      return { name: n, base64: raw, mime: img.mediaType || 'image/png' };
    }).filter(Boolean);
    // Có ref thật đính kèm → gán role trong prompt.
    const p = refs.length ? (prompt + _refRoleNote(refs.map(r => r.name))) : prompt;
    return flowBridge.call('POOL_GEN', { prompt: p, aspect: o.cfg.aspect, modelName: o.cfg.model, quality: o.cfg.quality, variantCount: 1, withData: true, refs });
  }
  let refMediaIds = [], okNames = [];
  for (const n of (refNames || [])){ const mid = await tfEnsureRefUploaded(n, o.projectId, o.imgMap); if (mid){ refMediaIds.push(mid); okNames.push(n); } }
  const p = refMediaIds.length ? (prompt + _refRoleNote(okNames)) : prompt;
  return flowBridge.call('GEN_IMAGE', { prompt: p, projectId: o.projectId, aspect: o.cfg.aspect, modelName: o.cfg.model, tier: o.tier, variantCount: 1, quality: o.cfg.quality, withData: true, refMediaIds });
}

function _t2PaletteSuffix(){
  const p = (typeof getProfile === 'function') ? getProfile() : null; if (!p) return '';
  const src = ((p.sceneStyle || '') + '. ' + (p.backgroundStyle || ''));
  const cl = src.split(/[\n.]/).map(s => s.trim()).filter(Boolean)
    .find(c => /(palette|colou?r|muted|desaturat|earthy|neon|saturat|somber|sepia|monochrom|nostalg)/i.test(c) && c.length > 12);
  if (!cl) return '';
  return cl.length > 160 ? cl.slice(0, 160).replace(/[\s,;:-]+\S*$/, '').trim() : cl;
}

function _t2WithPalette(prompt){
  let s = String(prompt || '');
  if (/consistent muted palette|consistent .*palette in every scene/i.test(s)) return s;   // đã có đuôi → khỏi lặp
  const pal = _t2PaletteSuffix();
  const palPart = pal ? `keep the same consistent muted ${pal} in every scene (never brighten/saturate to the setting); ` : 'keep a consistent muted palette across scenes; ';
  return s.replace(/\s*$/, '') + ` [${palPart}keep in-image text minimal.]`;
}

async function tfGenScenes(onlyMissing, opts){
  if (typeof gateTool==='function' && gateTool('toolflow')) return;
  if (tfState.running) return { skipped: true, reason: 'đang chạy' };
  const cfg = tfCfg();
  const shardN = Math.max(1, parseInt(document.getElementById('tfShardN')?.value) || 1);
  const shardK = Math.min(shardN, Math.max(1, parseInt(document.getElementById('tfShardK')?.value) || 1));
  const onlyIds = (opts && opts.onlyIds && opts.onlyIds.length) ? new Set(opts.onlyIds.map(String)) : null;   // giới hạn đúng các cảnh đã tick (Tạo lại đã chọn)
  const scenes = tfScenesWithPrompt().filter((s, i) => (shardN <= 1 || (i % shardN) === (shardK - 1)) && (!onlyIds || onlyIds.has(String(s.id))));
  // Đơn vị tạo: mỗi cảnh = ảnh A (+ ảnh B nếu cảnh có prompt B).
  const units = [];
  for (const s of scenes){
    const aP = state.scenePrompts?.[s.id];
    if (aP && String(aP).trim() && !(onlyMissing && state.sceneImages?.[s.id])) units.push({ id: s.id, variant: 'a', prompt: aP });
    const bP = state.scenePrompts2?.[s.id];
    if (bP && String(bP).trim() && !(onlyMissing && state.sceneImagesB?.[s.id])) units.push({ id: s.id, variant: 'b', prompt: bP });
  }
  if (!units.length){ setStatusF('Không có ảnh nào để tạo' + (shardN > 1 ? ` (máy ${shardK}/${shardN})` : '') + '.', 'error'); return { skipped: true, reason: 'không có cảnh' }; }
  if (!(await flowBridge.waitReady(1500))){ setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return { skipped: true, reason: 'chưa cài extension' }; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)){ setStatusF('Chưa kết nối Flow. Mở tab Flow + đăng nhập rồi Quét lại.', 'error'); return { skipped: true, reason: 'chưa đăng nhập Flow' }; }
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)

  tfState.running = true; tfState.stop = false; tfState.projectId = null; tfState.uploaded = {};
  const useRefs = !!document.getElementById('tfUseRefs')?.checked;
  const imgMap = tfAssetImageMap();
  console.log('[Flow] Ảnh asset dùng làm tham chiếu:', Object.keys(imgMap));
  // ⚠️ Tag trong prompt mà KHÔNG có ảnh tham chiếu → trước đây bỏ qua im lặng, ảnh
  // ra không có nhân vật hoặc mỗi cảnh một người. Đếm và báo trước khi chạy.
  if (useRefs){
    const miss = {};
    units.forEach(u => (typeof _t2TagsIn === 'function' ? _t2TagsIn(u.prompt) : []).forEach(t => {
      const has = imgMap[t] || Object.keys(imgMap).some(k => k === t || k.startsWith(t + '-') || t.startsWith(k + '-'));
      if (!has) miss[t] = (miss[t] || 0) + 1;
    }));
    const names = Object.keys(miss).sort((a, b) => miss[b] - miss[a]);
    if (names.length){
      const top = names.slice(0, 4).map(n => `[${n}]×${miss[n]}`).join(', ');
      const msg = `⚠️ ${names.length} tag không có ảnh tham chiếu: ${top}${names.length > 4 ? '…' : ''} — các cảnh này sẽ vẽ người KHÁC nhau. Bấm 🔧 Sửa tag lạ ở Phân Cảnh.`;
      setStatusF(msg, 'error');
      if (typeof novaLog === 'function') novaLog(msg, 'warn');
      console.warn('[Flow] tag thiếu ảnh tham chiếu:', miss);
    }
  }
  let done = 0, err = 0, refUsed = 0, lastErr = '';
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    // Số luồng = số tài khoản (1 request/account), NHƯNG lấy ô "Luồng song song" làm MỨC TRẦN:
    // bạn để 3 → tối đa 3 account chạy cùng lúc dù có 6 → xin token reCAPTCHA thưa hơn, ít lỗi UNUSUAL_ACTIVITY.
    const conc = multi ? Math.min(Math.max(1, st.accountCount), Math.max(1, cfg.conc || st.accountCount)) : cfg.conc;
    if (!state.sceneImages) state.sceneImages = {};
    if (!state.sceneImagesB) state.sceneImagesB = {};
    const nRef = Object.keys(imgMap).length;
    setStatusF(`Đang tạo ${units.length} ảnh (A+B)…${shardN > 1 ? ` [máy ${shardK}/${shardN}]` : ''}${multi ? ` (⚡ ${st.accountCount} tài khoản)` : ''}${useRefs && nRef ? ` +tham chiếu` : ''}`, 'working');
    if (typeof novaLog === 'function'){ novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc'); novaLog('▶ Tạo ' + units.length + ' ẢNH CẢNH' + (multi ? ' · ' + st.accountCount + ' tài khoản' : '') + (useRefs && nRef ? ' · tham chiếu ' + nRef + ' asset' : ''), 'acc'); }
    const _hasImg = (u) => !!((u.variant === 'b' ? state.sceneImagesB : state.sceneImages)?.[u.id]);
    let hadRetryable = false;
    const _genUnit = async (u) => {
      const thumb = document.getElementById('tf-scene-' + u.id + (u.variant === 'b' ? 'b' : ''))?.querySelector('.tf-thumb');
      if (thumb) thumb.textContent = '⏳';
      const refNames = useRefs ? tfExtractRefNames(u.prompt, imgMap) : [];
      if (refNames.length) { refUsed++; console.log('[Flow] cảnh ' + u.id + (u.variant === 'b' ? 'B' : '') + ' → đính tham chiếu:', refNames); }
      const _lbl = 'Cảnh ' + u.id + (u.variant === 'b' ? 'B' : '');
      if (typeof novaLog === 'function') novaLog('🖼 ' + _lbl + ' · gửi prompt' + (refNames.length ? ' + ref [' + refNames.join(', ') + ']' : '') + ' → đang tạo…', 'acc');
      if (tfState.stop){ if (thumb) thumb.textContent = '⏸'; return; }   // bấm Dừng trước khi tới lượt → bỏ qua, khỏi gọi gen
      let r, e0, _att = 0;
      while (true){
        // Đua lượt gen (xoay account + captcha, có thể lâu) với cờ Dừng → bấm Dừng là thoát NGAY.
        r = await _tfRaceStop(tfDispatchGen(cleanPrompt(_t2WithPalette(u.prompt || '')), refNames, { multi, cfg, imgMap, projectId, tier: st.paygateTier }));
        if (r && r._stopped){ if (thumb) thumb.textContent = '⏸'; return; }   // đã dừng → KHÔNG tính lỗi/xong cho cảnh này
        e0 = (r?.media_entries || []).find(e => e.dataUrl);
        // Lỗi MỀM (Internal error / mạng / server / bị Google chặn traffic) — không phải quota/lọc/hết phiên → tự thử lại tối đa 3 lần.
        const soft = !e0 && r?.error && !_isQuotaErr(r.error) && !/FILTER|SAFETY|PROMINENT|UNAUTHENT|API_401|MODEL_ACCESS/i.test(String(r.error));
        const traffic = /TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki/i.test(String(r?.error || ''));
        if (e0 || !soft || _att >= (traffic ? 3 : 2) || tfState.stop) break;
        _att++;
        const wait = traffic ? (6000 + _att * 4000) : 1500;   // bị Google chặn/token chập → NGHỈ LÂU (6-14s) cho "nguội" rồi mới thử; lỗi thường 1.5s.
        if (typeof novaLog === 'function') novaLog('↻ ' + _lbl + ' lỗi mềm (' + _bulkFriendlyErr(String(r.error)) + ') → nghỉ ' + Math.round(wait / 1000) + 's rồi thử lại lần ' + _att + '…', 'warn');
        if (await _tfSleepStop(wait)) break;   // nghỉ nhưng bấm Dừng là thoát ngay
      }
      if (Array.isArray(r?.rotated) && typeof novaLog === 'function') for (const ex of r.rotated) novaLog('⚠️ ' + ex + ' hết lượt → chuyển ' + _lbl + ' sang ' + (r.account || 'tài khoản khác'), 'warn');
      if (r?.error || !e0){
        err++; if (r?.error) lastErr = r.error; if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống');
        if (r?.error && !_isQuotaErr(r.error) && !/FILTER|SAFETY|PROMINENT|MODEL_ACCESS/i.test(String(r.error))) hadRetryable = true;   // lỗi TẠM (traffic/reCAPTCHA/mạng…) → cho phép quét lại
        if (typeof novaLog === 'function'){ const q = _isQuotaErr(r?.error || ''); novaLog((q ? '⚠️ ' : '❌ ') + _lbl + ' · ' + (r?.account ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (r?.error ? _bulkFriendlyErr(String(r.error)) : 'không có ảnh trả về (token hết hạn? bị lọc? — quét lại token ở Cài đặt)')), q ? 'warn' : 'err'); }
      }
      else {
        const store = u.variant === 'b' ? state.sceneImagesB : state.sceneImages;
        store[u.id] = { base64: e0.dataUrl, mediaType: e0.mime || 'image/png', fileName: `scene-${u.id}${u.variant === 'b' ? 'b' : ''}.png` };
        autoSaveSceneImage(u.id, u.variant === 'b', e0.dataUrl, e0.mime);
        done++;
        if (thumb) thumb.innerHTML = `<img src="${e0.dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
        if (typeof novaLog === 'function') novaLog('✅ ' + _lbl + ' · tài khoản ' + (r?.account || '?') + ' · thành công' + (refNames.length ? ' (có ref)' : ''), 'ok');
      }
      setStatusF(`Cảnh: ${done} xong · ${err} lỗi · còn ${units.length - done - err}`, 'working');
      if (tfState.onProgress) tfState.onProgress({ done, err, total: units.length });
    };
    // 🔁 TỰ ĐỘNG quét lại ảnh CÒN THIẾU do lỗi TẠM (traffic/reCAPTCHA/mạng) → nghỉ dài cho "nguội" rồi tạo lại,
    //    tối đa vài vòng. KHÔNG lặp nếu chỉ còn lỗi cứng (bị lọc/hết quota) → tránh chạy vô ích.
    let pending = units, sweep = 0;
    const MAX_SWEEP = (opts && opts.maxSweep != null) ? opts.maxSweep : 4;
    while (true){
      hadRetryable = false;
      await tfPool(pending, _genUnit, conc, cfg.delay || 0);
      const missing = units.filter(u => !_hasImg(u));
      if (!missing.length || tfState.stop || sweep >= MAX_SWEEP || !hadRetryable) break;
      sweep++;
      const wait = 12000 + sweep * 6000;   // 18s → 24s → 30s → 36s: nghỉ tăng dần cho Google hạ cờ "unusual traffic"
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missing.length} ảnh thiếu (lỗi tạm) → tự nghỉ ${Math.round(wait/1000)}s rồi tạo lại · vòng ${sweep}/${MAX_SWEEP}`, 'warn');
      setStatusF(`Còn ${missing.length} ảnh thiếu → nghỉ ${Math.round(wait/1000)}s rồi TỰ tạo lại (vòng ${sweep}/${MAX_SWEEP})…`, 'working');
      if (await _tfSleepStop(wait)) break;   // đang nghỉ giữa 2 vòng mà bấm Dừng → thoát ngay
      if (multi){ try { await flowBridge.call('POOL_RESET'); } catch (e) {} }
      pending = missing;
    }
    done = units.filter(_hasImg).length; err = units.length - done;   // chốt theo state (tránh đếm trùng qua nhiều vòng)
    if (typeof novaLog === 'function') novaLog('━━━ ' + (tfState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' ảnh cảnh · ' + done + '/' + units.length + (err ? ' · ' + err + ' lỗi' : '') + (refUsed ? ' · ' + refUsed + ' có ref' : '') + (sweep ? ' · ' + sweep + ' vòng quét lại' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
    saveState(true);
    if (typeof renderTable === 'function') renderTable();
    tfRenderScenes();
    const refNote = useRefs ? (refUsed ? ` · 🔗 ${refUsed} ảnh có tham chiếu` : (Object.keys(imgMap).length ? ' · ⚠️ 0 ảnh khớp tham chiếu (tag không trùng tên asset?)' : ' · (chưa có ảnh asset để tham chiếu)')) : '';
    setStatusF(tfState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh cảnh${err ? `, ${err} lỗi` : ''}${refNote}`, err ? 'error' : 'ok');
    notifyDone('✓ Tạo ảnh cảnh xong', `${done} ảnh, ${err} lỗi.`);
    return { done, err, refUsed, lastErr };
  } catch (e){ setStatusF('Lỗi: ' + e.message, 'error'); return { done, err, error: e.message, lastErr: lastErr || e.message }; }
  finally { tfState.running = false; }
}

function tfAssetList(kind){
  const arr = kind === 'char' ? (state.charactersV || []) : (state.backgroundsV || []);
  const promptMap = kind === 'char' ? state.assetCharPrompts : state.assetBgPrompts;
  return arr.map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
    .map(n => ({ name: n, prompt: promptMap?.[n] }));
}

function tfRenderAssets(){
  const info = document.getElementById('tfAssetInfo');
  const grid = document.getElementById('tfAssetGrid');
  if (!info || !grid) return;
  const chars = tfAssetList('char'), bgs = tfAssetList('bg');
  info.innerHTML = `Nhân vật: <b>${chars.filter(c => c.prompt).length}</b> có prompt · Bối cảnh: <b>${bgs.filter(c => c.prompt).length}</b> có prompt`;
  const all = chars.map(c => ({ ...c, kind: 'char' })).concat(bgs.map(c => ({ ...c, kind: 'bg' })));
  grid.innerHTML = all.map(a => {
    const store = a.kind === 'char' ? state.characterImages : state.backgroundImages;
    const src = _tfImgSrc(store?.[a.name]);
    const njs = String(a.name).replace(/['\\]/g, '\\$&');
    return `<div class="tf-card" id="tf-asset-${a.kind}-${_slugId(a.name)}" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
      <div class="tf-thumb" ${src ? `onclick="tfEnlargeAsset('${a.kind}','${njs}')" ` : ''}style="aspect-ratio:1;background:#0002 center/cover;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);cursor:${src ? 'zoom-in' : 'default'}">${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">` : (a.prompt ? '' : 'thiếu prompt')}</div>
      <div style="padding:6px;display:flex;gap:4px;align-items:center">
        <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.kind === 'char' ? '👤' : '🏞'} ${escapeHtml(a.name)}</span>
        <button class="btn ghost sm" style="padding:2px 6px;font-size:12px" onclick="tfEnlargeAsset('${a.kind}','${njs}')" title="Xem lớn">🔍</button>
        <button class="btn ghost sm" style="padding:2px 6px;font-size:12px" onclick="tfRegenAsset('${a.kind}','${njs}')" title="Tạo lại">🔄</button>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:12px">Chưa có nhân vật/bối cảnh. Chạy Tool 3 trước.</div>';
}

async function tfGenAssets(kind, onlyMissing){
  if (typeof gateTool==='function' && gateTool('toolflow')) return;
  if (tfState.running) return { skipped: true, reason: 'đang chạy' };
  const cfg = tfCfg();
  const store0 = kind === 'char' ? (state.characterImages || {}) : (state.backgroundImages || {});
  // onlyMissing: chỉ tạo asset CHƯA có ảnh (dùng để retry ảnh tham chiếu lỗi, khỏi đốt lại credit).
  const list = tfAssetList(kind).filter(a => a.prompt && String(a.prompt).trim() && (!onlyMissing || !store0?.[a.name]?.base64));
  if (!list.length){ setStatusF('Không có ' + (kind === 'char' ? 'nhân vật' : 'bối cảnh') + ' có prompt.', 'error'); return { skipped: true, reason: 'không có prompt' }; }
  if (!(await flowBridge.waitReady(1500))){ setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return { skipped: true, reason: 'chưa cài extension' }; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)){ setStatusF('Chưa kết nối Flow. Mở tab Flow + đăng nhập rồi Quét lại.', 'error'); return { skipped: true, reason: 'chưa đăng nhập Flow' }; }

  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  tfState.running = true; tfState.stop = false; tfState.projectId = null;
  let done = 0, err = 0, lastErr = '';
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    // Số luồng = số tài khoản (1 request/account), NHƯNG lấy ô "Luồng song song" làm MỨC TRẦN:
    // bạn để 3 → tối đa 3 account chạy cùng lúc dù có 6 → xin token reCAPTCHA thưa hơn, ít lỗi UNUSUAL_ACTIVITY.
    const conc = multi ? Math.min(Math.max(1, st.accountCount), Math.max(1, cfg.conc || st.accountCount)) : cfg.conc;
    if (kind === 'char'){ if (!state.characterImages) state.characterImages = {}; }
    else { if (!state.backgroundImages) state.backgroundImages = {}; }
    setStatusF(`Đang tạo ${list.length} ảnh…${multi ? ` (⚡ ${st.accountCount} tài khoản)` : ''}`, 'working');
    if (typeof novaLog === 'function'){ novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc'); novaLog('▶ Tạo ' + list.length + ' ảnh ' + (kind === 'char' ? 'NHÂN VẬT' : 'BỐI CẢNH') + (multi ? ' · ' + st.accountCount + ' tài khoản' : ''), 'acc'); }
    await tfPool(list, async (a) => {
      const card = document.getElementById('tf-asset-' + kind + '-' + _slugId(a.name));
      const thumb = card?.querySelector('.tf-thumb');
      if (thumb) thumb.textContent = '⏳';
      if (typeof novaLog === 'function') novaLog('🖼 ' + a.name + ' · gửi prompt → đang tạo…', 'acc');
      // Lỗi MỀM (NO_ACCOUNTS do race song song, kẹt traffic/reCAPTCHA, token vừa hết) → tự thử lại vài lần, đừng bỏ ảnh.
      let r, _tries = 0;
      while (true){
        r = await tfDispatchGen(cleanPrompt(a.prompt), [], { multi, cfg, projectId, tier: st.paygateTier });
        const soft = /NO_ACCOUNTS|TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki|UNAUTHENT|API_401|BRIDGE_TIMEOUT|\bTIMEOUT\b/i.test(String(r?.error || ''));
        if (!r?.error || !soft || _tries >= 3 || tfState.stop) break;
        _tries++;
        if (typeof novaLog === 'function') novaLog('↻ ' + a.name + ' · ' + r.error + ' → thử lại (' + _tries + ')…', 'warn');
        await new Promise(res => setTimeout(res, 1500 + _tries * 1500));
      }
      const e0 = (r?.media_entries || []).find(e => e.b64);
      if (Array.isArray(r?.rotated) && typeof novaLog === 'function') for (const ex of r.rotated) novaLog('⚠️ ' + ex + ' hết lượt → chuyển ' + a.name + ' sang ' + (r.account || 'tài khoản khác'), 'warn');
      if (r?.error || !e0){
        err++; if (r?.error) lastErr = r.error; if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống');
        if (typeof novaLog === 'function'){ const q = _isQuotaErr(r?.error || ''); novaLog((q ? '⚠️ ' : '❌ ') + a.name + ' · ' + (r?.account ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (r?.error ? _bulkFriendlyErr(String(r.error)) : 'không có ảnh trả về (token hết hạn? bị lọc? — quét lại token ở Cài đặt)')), q ? 'warn' : 'err'); }
      }
      else {
        const store = kind === 'char' ? state.characterImages : state.backgroundImages;
        store[a.name] = { base64: e0.b64, mediaType: e0.mime || 'image/png', fileName: a.name + '.png' };
        // Lưu ảnh nhân vật/bối cảnh về máy theo TÊN đã đặt (nếu bật auto-save).
        try { const ext = ((e0.mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg'); autoSaveMedia(_slug(a.name) + '.' + ext, 'data:' + (e0.mime || 'image/png') + ';base64,' + e0.b64, 'anh'); } catch (e) {}
        done++;
        if (thumb) thumb.innerHTML = `<img src="${e0.dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
        if (typeof novaLog === 'function') novaLog('✅ ' + a.name + ' · tài khoản ' + (r?.account || '?') + ' · thành công', 'ok');
      }
      setStatusF(`${done} xong · ${err} lỗi · còn ${list.length - done - err}`, 'working');
      if (tfState.onProgress) tfState.onProgress({ done, err, total: list.length });
    }, conc, cfg.delay || 0);
    if (typeof novaLog === 'function') novaLog('━━━ ' + (tfState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' asset ' + (kind === 'char' ? 'nhân vật' : 'bối cảnh') + ' · ' + done + '/' + list.length + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
    saveState(true);
    if (kind === 'char' && typeof renderCharImageGallery === 'function') renderCharImageGallery();
    if (kind === 'char' && typeof renderAssetCharPrompts === 'function' && state.charactersV) renderAssetCharPrompts(state.charactersV);
    tfRenderAssets();
    setStatusF(tfState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
    notifyDone('✓ Tạo ảnh asset xong', `${done} ảnh, ${err} lỗi.`);
    return { done, err, lastErr };
  } catch (e){ setStatusF('Lỗi: ' + e.message, 'error'); return { done, err, error: e.message, lastErr: lastErr || e.message }; }
  finally { tfState.running = false; }
}

function loadScriptFile(input){
  const file = input.files && input.files[0];
  if (!file) return;
  // Chặn file quá lớn (>5MB) — kịch bản text không bao giờ to vậy, tránh treo trình duyệt
  if (file.size > 5 * 1024 * 1024) {
    setStatus2('File quá lớn (>5MB) — đây có phải file văn bản kịch bản không?', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    let txt = String(reader.result || '');
    // File .srt/.vtt: bỏ số thứ tự + dòng thời gian, chỉ giữ lời thoại
    if (/\.(srt|vtt)$/i.test(file.name)) {
      txt = txt.replace(/^WEBVTT.*$/im, '')
        .replace(/^\d+\s*$/gm, '')
        .replace(/^\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n').trim();
    }
    const ta = document.getElementById('scriptInput');
    if (ta) ta.value = txt;
    state.script = txt;
    state.videoLogline = ''; state.videoLoglineSig = '';   // kịch bản mới → bỏ logline cũ
    const lgEl = document.getElementById('videoLogline'); if (lgEl) lgEl.value = '';
    updateScriptCount();
    saveState();
    setStatus2(`✓ Đã nạp file "${file.name}" (${txt.length.toLocaleString()} ký tự). Bấm Chia Cảnh hoặc 🚀 Auto.`, 'ok');
    input.value = '';   // reset để chọn lại cùng file vẫn kích hoạt
  };
  reader.onerror = () => { setStatus2('Không đọc được file: ' + (reader.error?.message || 'lỗi không rõ'), 'error'); input.value = ''; };
  reader.readAsText(file, 'utf-8');
}

function cleanScript(){
  const ta = document.getElementById('scriptInput');
  let s = ta.value;
  // Loại bỏ markdown headers + đường gạch ngang (markup nguyên dòng — an toàn)
  s = s.replace(/^#+\s.*$/gm, '').replace(/^[-=*]{3,}$/gm, '');
  // Marker đạo diễn/chú thích trong ngoặc (cười, nhạc, pause, cảnh 1, 0:05...) → bỏ.
  // CHỈ bỏ khi nội dung trong ngoặc TRÔNG NHƯ chỉ dẫn — GIỮ nguyên ngoặc chứa nội dung thật.
  const cueWords = /^(cười|khóc|thở dài|ngừng|im lặng|lặng|nhạc|nhạc nền|âm thanh|hiệu ứng|sfx|sound|music|pause|beat|laughs?|sighs?|silence|cut|fade|transition|b-?roll|cảnh\s*\d+|scene\s*\d+|\d{1,2}:\d{2}(?::\d{2})?)\b/i;
  s = s.replace(/\(([^()]{0,40})\)/g, (m, inner) => cueWords.test(inner.trim()) ? '' : m);
  s = s.replace(/\[([^\[\]]{0,40})\]/g, (m, inner) => cueWords.test(inner.trim()) ? '' : m);
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  ta.value = s;
  state.script = s;
  updateScriptCount();
  setStatus2('✓ Đã lọc kịch bản.', 'ok');
}

function updateScriptCount(){
  const el = document.getElementById('scriptCount');
  if (el) el.textContent = (state.script || '').length.toLocaleString() + ' ký tự';
}

function splitIntoSentences(text){
  text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\r/g, '');
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const sents = [];
  for (const para of paras) {
    const re = /[^.!?…。．！？]+[.!?…。．！？]+(?:["')\]]*)/g;   // + dấu câu CJK (Hàn/Trung/Nhật)
    let last = 0, m;
    const local = [];
    while ((m = re.exec(para)) !== null) { local.push(m[0].trim()); last = re.lastIndex; }
    const rem = para.slice(last).trim();
    if (rem) local.push(rem);
    if (local.length === 0) local.push(para);
    sents.push(...local);
    sents.push('__PARA__');
  }
  return sents.filter(Boolean);
}

function splitLong(s, max){
  let parts = [], buf = '';
  for (let i = 0; i < s.length; i++) {
    buf += s[i];
    const asciiBreak = /[,;:—–]/.test(s[i]) && s[i + 1] === ' ';
    const cjkBreak = /[，、；：]/.test(s[i]);                       // dấu phẩy CJK (không cần khoảng trắng sau)
    if (asciiBreak || cjkBreak) { parts.push(buf.trim()); buf = ''; if (asciiBreak) i++; }
  }
  if (buf.trim()) parts.push(buf.trim());
  const f = [];
  for (const p of parts) {
    if (p.length <= max) f.push(p);
    else {
      const w = p.split(' ');
      let ch = '';
      for (let x of w) {
        // từ/cụm quá dài (CJK không khoảng trắng) → cắt cứng theo ký tự
        while (x.length > max) { if (ch) { f.push(ch); ch = ''; } f.push(x.slice(0, max)); x = x.slice(max); }
        const t = ch ? ch + ' ' + x : x;
        if (t.length > max && ch) { f.push(ch); ch = x; }
        else ch = t;
      }
      if (ch) f.push(ch);
    }
  }
  return f;
}

function _t2StampSeed(s){
  s.promptSeed = (s.text || '').slice(0, 80);
  s.seedAt = Date.now();
}

function splitScenesFast(text, min, max){
  const sents = splitIntoSentences(text);
  const scenes = [];
  let buf = '';
  function flush(){ if (buf.trim()) { scenes.push(buf.trim()); buf = ''; } }
  for (const s of sents) {
    if (s === '__PARA__') { flush(); continue; }
    // Giữ NGUYÊN cả câu — chỉ chặt nếu câu dài bất thường (>2.5x max), tránh vỡ câu có nghĩa
    const units = s.length > max * 2.5 ? splitLong(s, max) : [s];
    for (const u of units) {
      const c = buf ? buf + ' ' + u : u;
      if (c.length <= max) buf = c;
      else { flush(); buf = u; }
    }
  }
  flush();
  return scenes;
}

async function splitScenesSmart(text, min, max){
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const all = [];
  const batches = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > 2000 && cur) { batches.push(cur); cur = p; }
    else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) batches.push(cur);
  clearCancel();
  const lanes = _concurrency();

  const buildPrompt = (batchText) => `You are a video editor. Split the following script segment into scenes for image-based video production.

MOST IMPORTANT RULES — NEVER VIOLATE:
- THE SMALLEST UNIT IS 1 COMPLETE SENTENCE (ending with . ! ? …).
- NEVER cut one sentence into two scenes — not even a long sentence, not even one containing a comma "," or a dash "—" / ":" mid-sentence.
- Your job is to MERGE sentences into scenes, NOT to CUT sentences.

Merging rules:
- 1 long sentence → keep the WHOLE sentence in 1 scene (even if it exceeds ${max} characters — keep it intact).
- Several short sentences sharing the same visual idea → may merge into 1 scene (target ${min}-${max} characters, but sentence boundaries matter more than character counts).
- A striking short sentence (like "Wow.", "Wait.") may stand alone as its own scene.
- Keep the original wording 100% — you only decide where to merge, never edit the text.

OUTPUT FORMAT — MUST follow this template, one scene per line, separated by a "===SCENE===" line:

===SCENE===
scene 1 content here
===SCENE===
scene 2 content here
===SCENE===
scene 3 content here

No JSON, no quotation marks around scenes, no numbering. ONLY scenes separated by "===SCENE===".

Script segment:
"""
${batchText}
"""`;
  const parse = (r) => {
    let ps = r.split(/===SCENE===/i).map(s => s.trim()).filter(Boolean);
    if (ps.length && ps[0].length < 80 && !/[.!?…]$/.test(ps[0])) ps = ps.slice(1); // bỏ preamble
    return ps;
  };
  // Hợp lệ khi: model CÓ dùng delimiter + tổng độ dài xấp xỉ kịch bản gốc (chống model trả suy luận/echo prompt)
  const valid = (r, ps, batchText) => {
    if (!ps.length || !/===SCENE===/i.test(r)) return false;
    const ratio = ps.join(' ').length / Math.max(1, batchText.length);
    return ratio >= 0.6 && ratio <= 1.6;
  };

  let doneCount = 0;
  // SONG SONG theo số luồng — các đoạn độc lập, runConcurrent trả kết quả theo ĐÚNG thứ tự
  const results = await runConcurrent(batches, async (batchText, bi) => {
    if (state.cancelRequested) return [];
    let parts;
    try {
      const prompt = buildPrompt(batchText);
      // Thinking OFF: tránh DeepSeek viết suy luận tràn vào output (định dạng ===SCENE===)
      let reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
      parts = parse(reply);
      if (!valid(reply, parts, batchText)) { reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } }); parts = parse(reply); }
      if (!valid(reply, parts, batchText)) {
        console.warn('Smart split đoạn ' + (bi + 1) + ' không hợp lệ → fallback regex');
        parts = splitScenesFast(batchText, min, max);
      }
    } catch (e) {
      console.warn('Smart split đoạn ' + (bi + 1) + ' lỗi → fallback regex:', e.message);
      parts = splitScenesFast(batchText, min, max);
    }
    // Chống "1 cảnh khổng lồ": model hay gộp cả đoạn thành 1 cảnh (thường gặp với tiếng Hàn/Nhật/Trung).
    // Cảnh nào dài bất thường → tách lại theo CÂU bằng bộ tách nhanh (xử lý được dấu . CJK).
    parts = parts.flatMap(pp => (pp && pp.length > max * 1.6) ? splitScenesFast(pp, min, max) : [pp]);
    doneCount++;
    setStatus2(`AI đang chia cảnh... ${doneCount}/${batches.length} phần${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    return parts;
  }, lanes, () => state.cancelRequested);

  // Ghép theo thứ tự đoạn
  results.forEach(parts => { if (Array.isArray(parts)) all.push(...parts); });
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Đã chia được ${all.length} cảnh.`, 'info'); }
  return all;
}

function calcDur(text){
  // ~15 chars per second VO
  return Math.max(2, Math.round(text.length / 15));
}

function _splitTextByDuration(text, maxSec, realDur){
  const estDur = calcDur(text);
  // Dùng độ dài THẬT (đã căn SRT/MP3) nếu lớn hơn ước lượng.
  const totalDur = Math.max((realDur && realDur > 0) ? realDur : 0, estDur);
  if (totalDur <= maxSec) return [text];
  // Số ký tự TƯƠNG ĐƯƠNG maxSec (theo tốc độ đọc của chính cảnh này) → mỗi phần ≤ maxSec dù phân bố giây không đều.
  const charsPerSec = text.length / totalDur;
  const maxChars = Math.max(24, Math.round(maxSec * charsPerSec));
  // Câu cực ngắn (vài từ) → không tách dù giây lớn (chống từ-lẻ)
  if (text.split(/\s+/).filter(Boolean).length < 8) return [text];
  // 1) Tách thành units tại ranh giới CÂU (. ! ? …) rồi MỆNH ĐỀ (, ; : — –)
  let units = [], buf = '';
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (/[.!?…,;:—–]/.test(text[i]) && (text[i + 1] === ' ' || i === text.length - 1)) { units.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) units.push(buf.trim());
  units = units.filter(Boolean);
  // 2) Unit dài hơn maxChars → cắt nhỏ theo TỪ (mỗi mảnh ≥5 từ) để không có phần nào vượt ngưỡng
  const fine = [];
  for (const u of units) {
    if (u.length <= maxChars) { fine.push(u); continue; }
    const w = u.split(/\s+/); let cw = '';
    for (const x of w) {
      const t = cw ? cw + ' ' + x : x;
      if (t.length > maxChars && cw.split(/\s+/).length >= 5) { fine.push(cw); cw = x; }
      else cw = t;
    }
    if (cw) fine.push(cw);
  }
  // 3) GÓI THAM LAM: dồn units vào 1 phần tới khi sắp vượt maxChars → mỗi phần ~ ≤ maxSec
  const parts = [];
  let cur = '';
  for (const u of fine) {
    if (cur && (cur.length + 1 + u.length) > maxChars) { parts.push(cur); cur = u; }
    else cur = cur ? cur + ' ' + u : u;
  }
  if (cur) parts.push(cur);
  return parts.length > 1 ? parts : [text];
}

function mergeFragmentScenes(){
  syncTool2();
  if (!state.scenes || !state.scenes.length) return setStatus2('Chưa có cảnh để gộp. Bấm "Chia Cảnh" trước.', 'error');
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (hasWork && !confirm('Gộp câu sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const endsComplete = t => /[.!?…]["')\]]*\s*$/.test((t || '').trim());
  const out = [];
  let cur = null;
  for (const s of state.scenes) {
    if (!cur) {
      cur = { ...s };
    } else {
      cur.text = (cur.text.trim() + ' ' + (s.text || '').trim()).trim();
      cur.duration = (parseFloat(cur.duration) || 0) + (parseFloat(s.duration) || 0);
      if (!cur.character && s.character) cur.character = s.character;     // giữ nhân vật/bối cảnh đầu tiên có
      if (!cur.background && s.background) cur.background = s.background;
    }
    if (endsComplete(cur.text)) { out.push(cur); cur = null; }
  }
  if (cur) {  // mảnh cuối chưa hoàn chỉnh → nối vào cảnh trước
    if (out.length) {
      const last = out[out.length - 1];
      last.text = (last.text.trim() + ' ' + cur.text.trim()).trim();
      last.duration = (parseFloat(last.duration) || 0) + (parseFloat(cur.duration) || 0);
    } else out.push(cur);
  }

  const before = state.scenes.length;
  state.scenes = out;
  state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
  state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState();
  setStatus2(`✓ Đã gộp câu vụn: ${before} → ${state.scenes.length} cảnh (mỗi cảnh là 1 câu hoàn chỉnh).`, 'ok');
}

async function mergeScenesByMeaningAI(silent){
  if (!silent) syncTool2();
  if (!state.scenes || !state.scenes.length) { if (!silent) setStatus2('Chưa có cảnh để gộp.', 'error'); return; }
  if (state.scenes.length < 2) return;
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (!silent && hasWork && !confirm('Gộp theo ý sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const N = state.scenes.length;
  const maxChars = state.maxChars || 150;
  const list = state.scenes.map((s, i) => `${i + 1}. ${(s.text || '').replace(/\s+/g, ' ').trim()}`).join('\n');
  const prompt = `Below is a numbered list of SCENES (one per line, each is one sentence).
Task: MERGE CONSECUTIVE scenes that share THE SAME VISUAL IDEA (drawable in one single frame) into one group, to reduce fragmentation.

MANDATORY RULES:
- ONLY merge CONSECUTIVE scenes. NEVER cut, NEVER reorder, NEVER skip any scene.
- 1 idea/object/moment = 1 group. Consecutive sentences describing the same visual scene → same group. New idea → new group.
- Do NOT over-merge: each group has at most ~3 sentences or ~${maxChars} characters.
- A sentence that is already one clear idea → keep it as its own group.

Return a JSON array of groups, each group being an array of scene NUMBERS. Each number from 1 to ${N} appears EXACTLY ONCE, in ascending order.
Example: [[1],[2,3],[4],[5,6,7]]
Print ONLY the JSON, no explanation.

LIST (${N} scenes):
${list}`;

  try {
    if (!silent) setStatus2('AI đang gộp cảnh theo ý...', 'working');
    // callLLMJson: lặp + ép JSON + chỉ nhận nhóm phủ ĐÚNG 1..N, mỗi số 1 lần, đúng thứ tự
    let groups;
    try {
      groups = await callLLMJson(prompt, {
        maxTokens: Math.min(8000, 1500 + N * 12),
        validate: g => { const f = Array.isArray(g) ? g.flat() : []; return Array.isArray(g) && f.length === N && f.every((n, i) => n === i + 1); }
      });
    } catch (e) {
      console.warn('Gộp theo ý: nhóm không hợp lệ → giữ nguyên.', e.message);
      if (!silent) setStatus2('⚠️ AI gộp ý không hợp lệ → giữ nguyên cảnh.', 'info');
      return;
    }
    const out = groups.map(g => {
      const items = g.map(n => state.scenes[n - 1]);
      const base = { ...items[0] };
      base.text = items.map(s => (s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
      base.duration = items.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
      base.character = (items.find(s => s.character) || {}).character || '';
      base.background = (items.find(s => s.background) || {}).background || '';
      return base;
    });
    const before = N;
    state.scenes = out;
    state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
    state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
    renderAllT2();
    if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
    saveState();
    if (!silent) setStatus2(`✓ Gộp theo ý (AI): ${before} → ${state.scenes.length} cảnh.`, 'ok');
  } catch (e) {
    console.error(e);
    if (!silent) setStatus2('Lỗi gộp theo ý: ' + e.message, 'error');
  }
}

function _balanceScenesCore(minSec, maxSec){
  // 1) TÁCH cảnh DÀI > maxSec thành các phần ≤ maxSec (gói theo ký tự tương đương giây) — gán giây theo tỉ lệ ký tự
  const split = [];
  for (const s of state.scenes) {
    const sdur = parseFloat(s.duration) || calcDur(s.text);
    const parts = _splitTextByDuration(s.text, maxSec, sdur);
    if (parts.length <= 1) { split.push({ ...s, duration: sdur }); continue; }
    const totalChars = parts.reduce((a, t) => a + t.length, 0) || 1;
    parts.forEach(t => split.push({ ...s, text: t, duration: +(sdur * t.length / totalChars).toFixed(1) }));
  }
  // 2) GỘP các cảnh NGẮN liền kề (kể cả đuôi vụn vừa tách ra) lên tới band, không vượt max → hết cảnh quá ngắn
  const out = [];
  let cur = null;
  for (const s of split) {
    const sd = parseFloat(s.duration) || calcDur(s.text);
    if (!cur) { cur = { ...s }; cur.duration = sd; }
    else if ((cur.duration < minSec || sd < minSec) && (cur.duration + sd) <= maxSec) {
      cur.text = (cur.text.trim() + ' ' + (s.text || '').trim()).trim();
      cur.duration += sd;
      if (!cur.character && s.character) cur.character = s.character;
      if (!cur.background && s.background) cur.background = s.background;
    } else { out.push(cur); cur = { ...s }; cur.duration = sd; }
  }
  if (cur) out.push(cur);

  // 3) HÚT cảnh quá NGẮN còn lẻ (kẹp giữa 2 cảnh to) vào hàng xóm NGẮN HƠN — cho nới max ~20% để khử hẳn cảnh lẻ
  const SLACK = maxSec * 1.2;
  let changed = true, guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      if (out.length <= 1) break;
      const sd = parseFloat(out[i].duration) || 0;
      if (sd >= minSec) continue;                       // không ngắn → bỏ qua
      const cands = [];
      if (i > 0) cands.push({ idx: i - 1, dur: parseFloat(out[i - 1].duration) || 0, side: 'prev' });
      if (i < out.length - 1) cands.push({ idx: i + 1, dur: parseFloat(out[i + 1].duration) || 0, side: 'next' });
      cands.sort((a, b) => a.dur - b.dur);              // ưu tiên hàng xóm NGẮN HƠN
      const pick = cands.find(c => (c.dur + sd) <= SLACK);
      if (!pick) continue;                              // cả 2 bên đều vượt slack → đành để lẻ
      const tgt = out[pick.idx], cu = out[i];
      tgt.text = pick.side === 'prev'
        ? (tgt.text.trim() + ' ' + cu.text.trim()).trim()
        : (cu.text.trim() + ' ' + tgt.text.trim()).trim();
      tgt.duration = (parseFloat(tgt.duration) || 0) + sd;
      if (!tgt.character && cu.character) tgt.character = cu.character;
      if (!tgt.background && cu.background) tgt.background = cu.background;
      out.splice(i, 1);
      changed = true;
      break;                                            // mảng đổi → quét lại
    }
  }

  // Cap theo tier
  const maxScenes = getMaxScenes();
  if (out.length > maxScenes) out.length = maxScenes;
  state.scenes = out;
  state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
  state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState();
}

function _t2FitToAudio(){
  const sc = state.scenes || [];
  const audio = (typeof _t2AudioDurCache === 'number') ? _t2AudioDurCache : 0;
  if (!sc.length || !(audio > 0)) return null;
  const tot = sc.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
  if (!(tot > 0)) return null;
  const diff = tot - audio;
  if (Math.abs(diff) < 0.5) return { diff: 0, before: tot, after: tot };
  const k = audio / tot;
  // Làm tròn 0,1s mỗi cảnh × 183 cảnh vẫn trôi gần 1s nếu chỉ bù ở cảnh cuối.
  // Giữ phần dư và bù ngay cảnh kế → tổng khớp tuyệt đối, không cảnh nào lệch quá 0,1s.
  let run = 0, carry = 0;
  sc.forEach((s, i) => {
    if (i === sc.length - 1) return;
    const want = (parseFloat(s.duration) || 0) * k + carry;
    const got = Math.max(0.5, +want.toFixed(1));
    carry = want - got;
    s.duration = got; run += got;
  });
  sc[sc.length - 1].duration = Math.max(0.5, +(audio - run).toFixed(1));
  return { diff: +diff.toFixed(1), before: +tot.toFixed(1), after: audio };
}

function balanceScenes(){
  syncTool2();
  if (!state.scenes || !state.scenes.length) return setStatus2('Chưa có cảnh. Bấm "Chia Cảnh" trước.', 'error');
  const maxSec = parseInt(document.getElementById('maxSecPerImg')?.value) || 8;
  let minSec = parseInt(document.getElementById('minSecPerImg')?.value);
  if (!(minSec >= 1)) minSec = Math.max(2, Math.round(maxSec / 2.5));
  if (minSec >= maxSec) minSec = Math.max(2, maxSec - 2);
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (hasWork && !confirm('Cân đều cảnh sẽ đổi ranh giới → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;
  const before = state.scenes.length;
  _balanceScenesCore(minSec, maxSec);
  const fit = _t2FitToAudio();                     // chia lại xong PHẢI khớp lại audio
  setStatus2(`✓ Đã cân đều: ${before} → ${state.scenes.length} cảnh, mỗi ảnh ~${minSec}–${maxSec}s.`
    + (fit && fit.diff ? ` Đã bù ${Math.abs(fit.diff).toFixed(1)}s cho khớp audio.` : ''), 'ok');
}

function _diffScenesScript(){
  const normalize = t => (t || '')
    .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const tokenize = s => s.match(/[\w'-]+/g) || [];
  const oW = tokenize(normalize(state.script || ''));
  const sW = tokenize(normalize((state.scenes || []).map(s => s.text).join(' ')));
  const count = arr => { const c = {}; arr.forEach(w => c[w] = (c[w] || 0) + 1); return c; };
  const oC = count(oW), sC = count(sW);
  let missN = 0, extraN = 0;
  for (const w in oC) { const d = oC[w] - (sC[w] || 0); if (d > 0) missN += d; }
  for (const w in sC) { const d = sC[w] - (oC[w] || 0); if (d > 0) extraN += d; }
  return { exact: missN === 0 && extraN === 0, missN, extraN, oLen: oW.length, sLen: sW.length };
}

function _validateScenePrompt(s, prompt){
  const issues = [];
  const pr = String(prompt || '').trim();
  const words = pr.split(/\s+/).filter(Boolean);
  if (!pr || words.length < 12) { issues.push('trống/quá ngắn'); return issues; }
  if (words.length > 200) issues.push('quá dài bất thường');
  // Lẫn nhãn phân loại / ID cảnh / suy luận
  if (/\bLO[ẠA]I\s*\d|\bType\s*\d|\[\s*\d{3}\s*\]/.test(pr)) issues.push('lẫn nhãn loại/ID');
  if (/(dấu chấm|Tuy nhiên|kịch bản|viết thường|câu hoàn chỉnh|===SCENE===)/i.test(pr)) issues.push('lẫn suy luận');
  const lower = pr.toLowerCase();
  const dm = state.descMode || 'tag';
  const noChar = document.getElementById('noCharMode')?.checked;
  if (noChar) {
    if (/\b(person|people|man|woman|men|women|boy|girl|child|children|human|humans|character|narrator|gardener|farmer|figure|someone|she|he)\b/.test(lower))
      issues.push('CÓ NGƯỜI dù chế độ Không-nhân-vật');
  } else if (dm === 'tag') {
    // Chỉ ở chế độ Tag: nhân vật/bối cảnh đã gán PHẢI xuất hiện trong prompt (dạng [tag])
    const nm = (s.character || '').trim();
    if (nm) {
      const tok = nm.toLowerCase().split(/[\s,\[\]\-]+/).filter(w => w.length >= 3);
      if (tok.length && !tok.some(t => lower.includes(t))) issues.push('THIẾU nhân vật đã gán: ' + nm);
    }
    const bg = (s.background || '').trim();
    if (bg) {
      const btok = bg.toLowerCase().split(/[\s,\[\]\-]+/).filter(w => w.length >= 3);
      if (btok.length && !btok.some(t => lower.includes(t))) issues.push('THIẾU bối cảnh đã gán: ' + bg);
    }
  }
  // Còn dính style người-que khi kênh KHÔNG phải 2D
  const sc = (getProfile()?.sceneStyle || '').toLowerCase();
  const isCartoon = /cartoon|flat|2d|anime|stick|hand.drawn/.test(sc);
  if (!isCartoon && /(stick limbs|off-white face|mitten)/i.test(pr)) issues.push('còn style người-que');
  return issues;
}

function _scanBadPrompts(){
  return state.scenes
    .map(s => ({ s, pr: state.scenePrompts[s.id] }))
    .filter(x => x.pr && x.pr.trim())
    .map(x => ({ id: x.s.id, issues: _validateScenePrompt(x.s, x.pr) }))
    .filter(x => x.issues.length);
}

function _wcSb(t){ return (String(t || '').trim().match(/\S+/g) || []).length; }

async function _t2AudioDur(file){
  try {
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const dec = await ctx.decodeAudioData(buf.slice(0));
    const s = dec.duration; try { ctx.close(); } catch (e) {}
    return s || 0;
  } catch (e) { return 0; }
}

function _sceneTypesOn(){ const on = (state && Array.isArray(state.sceneTypesOn) && state.sceneTypesOn.length) ? state.sceneTypesOn : SCENE_TYPES_CORE; return on.filter(k => SCENE_TYPES[k]); }

function _shotAllowed(){ const on = new Set(SCENE_TYPES_CORE); _sceneTypesOn().forEach(k => on.add(k)); return on; }

function _validShot(t){
  t = String(t || '').trim().toLowerCase();
  if (t === 'diagram') t = 'compare';
  if (!SCENE_TYPES[t]) return 'scene';
  return _shotAllowed().has(t) ? t : 'scene';
}

function _isInfographicShot(shot){ return ['compare', 'map', 'transition'].includes(String(shot || '').trim().toLowerCase()); }

function _t2Coverage(script, scenes){
  const norm = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const sents = String(script || '').split(/(?<=[.!?…])\s+|\n+/).map(norm).filter(x => x.split(' ').length >= 4);
  const all = norm(scenes.map(s => s.text).join(' '));
  const missing = sents.filter(x => !all.includes(x));
  const seen = {}, dup = [];
  scenes.forEach(s => { const k = norm(s.text); if (!k) return; if (seen[k]) dup.push(s.id); else seen[k] = 1; });
  return { total: sents.length, missing, dup };
}

function _t2SceneWarns(s, idx, scenes){
  const w = [];  // A5: canh trong (khong co gi het) -> chip warning nhung
  if (!txt && !pr.trim() && !String(s.character || '').trim() && !String(s.background || '').trim()){
    w.push('canh trong - can nhap text hoac generate prompt');
  }

  const txt = String(s.text || '').trim();
  const pr  = (state.scenePrompts || {})[s.id] || '';
  if (!pr.trim()) w.push('chưa có prompt ảnh');
  // Lời đọc có người hành động mà cảnh không gán nhân vật → thường là AI nhận diện hụt
  if (!String(s.character || '').trim() && /\b(he|she|they|his|her|người|anh|cô|ông|bà|họ)\b/i.test(txt) && s.shot !== 'b-roll')
    w.push('lời đọc có người nhưng cảnh không gán nhân vật');
  if (!String(s.background || '').trim() && !_isInfographicShot(s.shot)) w.push('chưa có bối cảnh');
  const d = +s.duration || 0;
  if (d && d < 1.2) w.push('cảnh quá ngắn (' + d.toFixed(1) + 's)');
  // Cảnh dài bất thường so với lượng chữ = căn timing hỏng. Trước đây lọt hết:
  // chỉ có cảnh báo quá NGẮN, nên cảnh 215 giây đi qua không ai biết.
  const uocD = Math.max(2, txt.length / 15);
  if (d > Math.max(20, uocD * 4)) w.push('cảnh quá dài (' + d.toFixed(0) + 's, chữ chỉ đủ ~' + Math.round(uocD) + 's) — căn timing có thể sai');
  // 4+ cảnh liên tiếp cùng một nhân vật → đơn điệu
  if (String(s.character || '').trim() && idx >= 3){
    const same = [1, 2, 3].every(k => (scenes[idx - k] || {}).character === s.character);
    if (same) w.push('4+ cảnh liên tiếp cùng nhân vật — nên xen cảnh b-roll');
  }
  // Prompt gần giống cảnh liền trước → hai ảnh sẽ na ná nhau
  if (pr && idx > 0){
    const prev = (state.scenePrompts || {})[scenes[idx - 1].id] || '';
    if (prev && prev.length > 40 && pr.slice(0, 90) === prev.slice(0, 90)) w.push('prompt gần trùng cảnh trước');
  }
  return w;
}

function _t2ValidateScript(text){
  const raw = String(text || ''); const s = raw.trim();
  if (!s) return { ok: false, msg: 'Chua co kich ban.' };
  if (s.length < 10) return { ok: false, msg: 'Kich ban qua ngan (< 10 ky tu). Hay nhap it nhat 1 cau.' };
  if (s.length > 50000) return { ok: false, msg: 'Kich ban qua dai (' + s.length + ' ky tu, tran 50.000). Hay chia thanh nhieu phan.' };
  const ph = s.match(/\u007B\u007B[^\u007D]+\u007D\u007D|\[INSERT[^\]]*\]|\bTODO\b|\bXXX\b|\bplaceholder\b/gi);
  if (ph) return { ok: true, msg: 'Phat hien placeholder chua thay (' + ph.slice(0, 3).join(', ') + '...). AI co the tu dien sai - nen thay truoc.' };
  const letters = (s.match(/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  if (letters < s.length * 0.3) return { ok: false, msg: 'Kich ban chua qua it chu cai / chu so. Co phai dinh dang sai?' };
  return { ok: true };
}

function _t2WarnCount(){
  const sc = state.scenes || [];
  return sc.reduce((n, s, i) => n + (_t2SceneWarns(s, i, sc).length ? 1 : 0), 0);
}

function _t2WarnBreakdown(){
  const sc = state.scenes || [];
  const by = {};
  sc.forEach((s, i) => _t2SceneWarns(s, i, sc).forEach(w => {
    const k = w.replace(/\s*\([^)]*\)\s*$/, '');       // bỏ phần số trong ngoặc để gộp
    by[k] = (by[k] || 0) + 1;
  }));
  return Object.entries(by).sort((a, b) => b[1] - a[1]);
}

function _t2PreviewScene(idx){
  const s = state.scenes && state.scenes[idx];
  if (!s) return;
  const img = state.sceneImages && state.sceneImages[s.id];
  const pr = (state.scenePrompts || {})[s.id] || '';
  const imgSrc = img ? (img.url || ('data:image/png;base64,' + img.b64)) : '';
  const imgHtml = imgSrc ? ('<img src=' + " + imgSrc + " + ' style=' + " + 'max-width:100%;max-height:45vh;border-radius:8px' + " + '/>') : '<div style=' + " + 'padding:40px;color:var(--text-muted)' + " + '>Chua co anh</div>';
  const html = '<div id=' + " + 't2PreviewModal' + " + ' style=' + " + 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px' + " + '>' +
    '<div style=' + " + 'background:var(--surface);border-radius:12px;padding:20px;max-width:760px;width:100%;max-height:90vh;overflow:auto' + " + '>' +
    '<div style=' + " + 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' + " + '><h3 style=' + " + 'margin:0' + " + '>Canh ' + s.id + '</h3>' +
    '<button class=' + " + 'btn ghost sm' + " + ' onclick=' + " + 'document.getElementById(' + " + 't2PreviewModal' + " + ').remove()' + " + '>Dong (Esc)</button></div>' +
    '<div style=' + " + 'margin-bottom:12px' + " + '>' + imgHtml + '</div>' +
    '<div style=' + " + 'background:var(--surface-2);padding:8px 12px;border-radius:6px;margin-bottom:8px' + " + '><b>Loi doc:</b> ' + escapeHtml(s.text || '') + '</div>' +
    '<div style=' + " + 'background:var(--surface-2);padding:8px 12px;border-radius:6px;margin-bottom:8px' + " + '><b>Nhan vat:</b> ' + escapeHtml(s.character || '(chua)') + ' &middot; <b>Boi canh:</b> ' + escapeHtml(s.background || '(chua)') + ' &middot; <b>Camera:</b> ' + escapeHtml(s.camera || 'medium') + ' &middot; <b>' + (s.duration || 0) + 's</b></div>' +
    '<details style=' + " + 'background:var(--surface-2);padding:8px 12px;border-radius:6px' + " + '><summary><b>Prompt AI</b></summary><pre style=' + " + 'white-space:pre-wrap;margin:6px 0 0;font-size:11.5px' + " + '>' + escapeHtml(pr) + '</pre></details>' +
    (s.notes ? ('<div style=' + " + 'margin-top:8px;background:var(--surface-2);padding:6px 10px;border-radius:5px;font-size:11.5px' + " + '><b>Ghi chu:</b> ' + escapeHtml(s.notes) + '</div>') : '') +
    '</div></div>';
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const modal = wrap.firstChild;
  document.body.appendChild(modal);
  const onKey = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
  setTimeout(() => document.addEventListener('keydown', onKey), 50);
}

function _t2ExportJson(){
  try {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      script: state.script || '',
      scenes: (state.scenes || []).map(s => ({
        id: s.id,
        text: s.text,
        character: s.character,
        background: s.background,
        camera: s.camera,
        duration: s.duration,
        notes: s.notes,
        promptSeed: s.promptSeed,
      })),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'scenes-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    try { if (typeof novaLog === 'function') novaLog('Export ' + data.scenes.length + ' canh thanh cong', 'ok'); } catch(_){}
  } catch (e) { try { if (typeof novaLog === 'function') novaLog('Export err: ' + e.message, 'err'); } catch(_){} }
}

function _t2ImportJson(file){
  if (!file) return;
  if (file.size > 5 * 1024 * 1024){ try { if (typeof novaLog === 'function') novaLog('File > 5MB qua lon', 'err'); } catch(_){} return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      if (!data || !Array.isArray(data.scenes)) throw new Error('JSON khong co truong scenes[]');
      if (!confirm('Import ' + data.scenes.length + ' canh? Hien tai se bi thay the.')) return;
      state.scenes = data.scenes.map((s, i) => Object.assign({ id: String(i+1).padStart(3,'0'), userEdited: true, seedAt: Date.now() }, s));
      if (data.script && typeof state.script === 'string') state.script = data.script;
      try { renderAllT2(); } catch(_){}
      try { saveState(); } catch(_){}
      try { if (typeof novaLog === 'function') novaLog('Import ' + data.scenes.length + ' canh OK', 'ok'); } catch(_){}
    } catch (e) { try { if (typeof novaLog === 'function') novaLog('Import JSON err: ' + e.message, 'err'); } catch(_){} }
  };
  reader.readAsText(file);
}

function _t2SelToggle(id, on){
  if (on) _t2Sel.add(id); else _t2Sel.delete(id);
  const bar = document.getElementById('t2BulkBar');
  if (bar) bar.style.display = _t2Sel.size ? 'flex' : 'none';
  const cnt = document.getElementById('t2BulkCount');
  if (cnt) cnt.textContent = String(_t2Sel.size);
}

function _t2SelClear(){
  _t2Sel.clear();
  document.querySelectorAll('#sceneBody input.t2-sel-cb').forEach(cb => cb.checked = false);
  const bar = document.getElementById('t2BulkBar');
  if (bar) bar.style.display = 'none';
}

function _t2SelApply(field, value){
  if (!_t2Sel.size) return;
  let n = 0;
  state.scenes.forEach(s => {
    if (_t2Sel.has(s.id)){
      s[field] = value;
      s.userEdited = true;
      n++;
    }
  });
  try { if (typeof novaLog === 'function') novaLog('Bulk gan ' + field + ' cho ' + n + ' canh', 'ok'); } catch(_){}
  try { renderAllT2(); } catch(_){}
  try { saveState(); } catch(_){}
  _t2SelClear();
}

function _t2ImportScriptFile(file){
  if (!file) return;
  const allowed = ['text/plain', 'text/markdown', ''];
  const name = (file.name || '').toLowerCase();
  if (!/\.(txt|md|markdown|story|srt)$/.test(name) && !allowed.includes(file.type)){
    try { if (typeof novaLog === 'function') novaLog('Chi ho tro .txt/.md/.srt', 'warn'); } catch(_){}
    return;
  }
  if (file.size > 2 * 1024 * 1024){
    try { if (typeof novaLog === 'function') novaLog('File > 2MB qua lon, hay chia nho', 'err'); } catch(_){}
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      const ta = document.getElementById('scriptBox') || document.getElementById('script') || document.getElementById('t2script');
      if (ta) { ta.value = text; if (typeof syncTool2 === 'function') syncTool2(); }
      else if (typeof state !== 'undefined') { state.script = text; }
      try { if (typeof novaLog === 'function') novaLog('Import file thanh cong: ' + file.name + ' (' + file.size + ' bytes)', 'ok'); } catch(_){}
    } catch (e) { try { if (typeof novaLog === 'function') novaLog('Import err: ' + e.message, 'err'); } catch(_){} }
  };
  reader.readAsText(file, 'utf-8');
}

function _t2JumpScene(dir){
  if (!state.scenes || !state.scenes.length) return;
  const cur = state.activeSceneIdx || 0;
  let nxt = cur + dir;
  if (nxt < 0) nxt = 0;
  if (nxt >= state.scenes.length) nxt = state.scenes.length - 1;
  if (nxt === cur) return;
  state.activeSceneIdx = nxt;
  const row = document.querySelector('#sceneBody tr[data-sid=\u0022' + state.scenes[nxt].id + '\u0022]');
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try { if (typeof novaLog === 'function') novaLog('J/K -> canh ' + state.scenes[nxt].id, 'ok'); } catch(_){}
}

function _t6SmartCrop(b64, mime, targetAspect){
  return new Promise(async (resolve) => {
    try {
      if (!b64 || !targetAspect) return resolve(null);
      const img = new Image();
      const dataUrl = 'data:' + (mime || 'image/png') + ';base64,' + b64;
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          const curAspect = w / h;
          const tgt = targetAspect === '9:16' ? 9/16 : targetAspect === '1:1' ? 1 : 16/9;
          if (Math.abs(curAspect - tgt) < 0.01) return resolve(null);   // da khop, bo qua
          let cropW = w, cropH = h, cropX = 0, cropY = 0;
          if (curAspect > tgt) { cropW = Math.round(h * tgt); cropX = Math.round((w - cropW) / 2); }
          else { cropH = Math.round(w / tgt); cropY = Math.round((h - cropH) / 2); }
          const canvas = document.createElement('canvas');
          canvas.width = cropW; canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onloadend = () => {
              const data = String(reader.result || '');
              const m = data.match(/^data:([^;]+);base64,(.*)$/);
              if (m) resolve({ b64: m[2], mime: m[1], w: cropW, h: cropH });
              else resolve(null);
            };
            reader.readAsDataURL(blob);
          }, 'image/png', 0.92);
        } catch (e) { try { if (typeof novaLog === 'function') novaLog('Smart crop err: ' + e.message, 'warn'); } catch(_){} resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch (e) { resolve(null); }
  });
}

function _t2GetNote(idx){
  const s = state.scenes && state.scenes[idx];
  return s ? String(s.notes || ''
) : '';
}

function _t2SetNote(idx, txt){
  const s = state.scenes && state.scenes[idx];
  if (!s) return false;
  s.notes = String(txt || '').slice(0, 500);
  try { saveState(true); } catch(_){}
  try { renderAllT2(); } catch(_){}
  return true;
}

function _t2OpenNoteEditor(idx){
  const cur = _t2GetNote(idx);
  const s = state.scenes && state.scenes[idx];
  if (!s) return;
  const v = prompt('Ghi chu cho canh ' + s.id + ' (toi da 500 ky tu):', cur);
  if (v === null) return;
  _t2SetNote(idx, v);
  try { if (typeof novaLog === 'function') novaLog(v.trim() ? ('Da ghi chu cho canh ' + s.id) : ('Da xoa ghi chu canh ' + s.id), 'ok'); } catch(_){}
}function _t2Snapshot(tag){

}function _t2Snapshot(tag){
  try {
    const data = JSON.parse(JSON.stringify({ scenes: state.scenes, scenePrompts: state.scenePrompts, veoPrompts: state.veoPrompts, t: Date.now(), tag: String(tag || 'auto') }));
    _t2Snapshots.push(data);
    if (_t2Snapshots.length > _T2_SNAP_MAX) _t2Snapshots.shift();
    try { if (typeof novaLog === 'function') novaLog('Snapshot luu (' + _t2Snapshots.length + '/' + _T2_SNAP_MAX + '): ' + (tag || 'auto'), 'ok'); } catch(_){}
    return data;
  } catch (e) { try { if (typeof novaLog === 'function') novaLog('Snapshot err: ' + e.message, 'err'); } catch(_){} return null; }
}

function _t2RestoreSnap(idx){
  const snap = _t2Snapshots[idx];
  if (!snap) return false;
  try {
    state.scenes = JSON.parse(JSON.stringify(snap.scenes || []));
    state.scenePrompts = JSON.parse(JSON.stringify(snap.scenePrompts || {}));
    state.veoPrompts = JSON.parse(JSON.stringify(snap.veoPrompts || {}));
    state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); });
    try { renderAllT2(); } catch(_){}
    try { saveState(); } catch(_){}
    try { if (typeof novaLog === 'function') novaLog('Restore snapshot [' + (snap.tag || '?') + ']', 'ok'); } catch(_){}
    return true;
  } catch (e) { try { if (typeof novaLog === 'function') novaLog('Restore err: ' + e.message, 'err'); } catch(_){} return false; }
}

function _t2SnapList(){
  return _t2Snapshots.map((s, i) => ({ idx: i, t: s.t, tag: s.tag, count: (s.scenes || []).length }));
}

function _t2DragStart(e, i){
  _t2DragSrc = parseInt(i, 10);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(i)); } catch(_) {}
  }
  const tr = e.target.closest('tr'); if (tr) tr.style.opacity = '0.4';
}

function _t2DragOver(e){
  e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const tr = e.target.closest('tr');
  if (tr) tr.style.borderTop = '2px solid var(--accent)';
}

function _t2DragLeave(e){
  const tr = e.target.closest('tr');
  if (tr) tr.style.borderTop = '';
}

function _t2Drop(e, i){
  e.preventDefault(); e.stopPropagation();
  const target = parseInt(i, 10);
  const tr = e.target.closest('tr'); if (tr) tr.style.borderTop = '';
  if (_t2DragSrc < 0 || _t2DragSrc === target || isNaN(target)) return;
  if (!state.scenes || _t2DragSrc >= state.scenes.length) return;
  const arr = state.scenes.slice();
  const [moved] = arr.splice(_t2DragSrc, 1);
  arr.splice(target, 0, moved);
  state.scenes = arr;
  state.scenes.forEach((s, idx) => { s.id = String(idx + 1).padStart(3, '0'); });
  if (state.editingSceneIdx != null) state.editingSceneIdx = null;
  try { if (typeof novaLog === 'function') novaLog('Keo tha: chuyen canh ' + (_t2DragSrc + 1) + ' -> ' + (target + 1), 'ok'); } catch(_) {}
  try { renderAllT2(); } catch(_) {}
  try { saveState(); } catch(_) {}
  _t2DragSrc = -1;
  return false;
}

function _t2DragEnd(e){
  const tr = e.target.closest && e.target.closest('tr');
  if (tr) tr.style.opacity = '';
  document.querySelectorAll('#sceneBody tr').forEach(r => r.style.borderTop = '');
  _t2DragSrc = -1;
}

function _t2SoLuong(){
  const v = Number(state.t2SoLuong);
  return (Number.isFinite(v) && v >= 1 && v <= 6) ? Math.round(v) : _T2_LUONG_MAC_DINH;
}

async function _t2SongSong(ds, n, fn, dungLai){
  const ra = new Array(ds.length);
  let ke = 0;
  const chay = async () => {
    while (true){
      if (typeof dungLai === 'function' && dungLai()) return;
      const i = ke++;
      if (i >= ds.length) return;
      try { ra[i] = { ok: true, gt: await fn(ds[i], i) }; }
      catch (e){ ra[i] = { ok: false, loi: e }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, ds.length)) }, chay));
  return ra;
}

function _t2NguonBat(){
  if (!state.nguonBat) state.nguonBat = { veo: false, stock: false, yt: false, kho: false, web: false };
  const b = state.nguonBat;
  // stock/kho/yt KHÔNG còn nút riêng — suy từ nền tảng đang bật trong bảng ⚙.
  if (b.web && typeof _webDangBat === 'function'){
    const may = new Set(_webDangBat().map(x => x.may).filter(Boolean));
    b.stock = may.has('stock');
    b.kho   = may.has('kho');
    b.yt    = may.has('yt');
  } else {
    b.stock = false; b.kho = false; b.yt = false;
  }
  return b;
}

function _t2ChuyenNguonCu(){
  if (!state.nguonBat || state.nguonDaChuyen) return;
  const cu = state.nguonBat;
  const co = { stock: ['pexels', 'pixabay', 'unsplash'], kho: ['wikimedia', 'nasa', 'openverse', 'archive_org'], yt: ['youtube'] };
  let doi = 0;
  if (typeof _webBat === 'function'){
    const wb = _webBat();
    for (const k in co){
      if (!cu[k]) continue;
      co[k].forEach(id => { if (!wb[id]){ wb[id] = true; doi++; } });
      cu.web = true;                       // bật nguồn web để những nền tảng đó có tác dụng
    }
  }
  state.nguonDaChuyen = true;
  if (doi && typeof novaLog === 'function')
    novaLog(`🔀 Đã chuyển ${doi} nền tảng từ Video stock/Kho mở/Clip YouTube vào bảng ⚙ của Nguồn web.`, 'info');
  try { if (typeof saveState === 'function') saveState(); } catch (e) {}
}

function _t2TiLeNgoai(){
  const v = state.t2TiLeNgoai;
  return (typeof v === 'number' && v >= 0 && v <= 100) ? v : null;
}

async function _t2ChonNguonChoCanh(scenes){
  const b = _t2NguonBat();
  const bat = _T2_NGUON_DS.filter(n => b[n.id]);
  scenes.forEach(s => { s.wantVideo = false; s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; s.nguonVi = ''; });
  if (!bat.length || scenes.length < 2) return { doi: 0 };

  const topic = String(state.videoLogline || '').trim();
  // Dùng moAi khi có: chữ trên nút là hướng dẫn bấm nút, đưa vào prompt chỉ tổ nhiễu.
  const bang = bat.map(n => {
    let d = n.moAi || n.mo;
    if (n.id === 'web' && typeof _webDangBat === 'function'){
      const ds = _webDangBat();
      if (ds.length) d += ' Nền tảng đang bật: ' + ds.slice(0, 8).map(p => p.ten).join(', ') + (ds.length > 8 ? '…' : '') + '.';
    }
    return `- ${n.id} (${n.ten}): ${d}`;
  }).join('\n');
  // Trần: ảnh AI phải giữ vai trò xương sống, không để nguồn ngoài chiếm hết.
  /* Trần cũ cứng 35% vì ảnh AI là mặc định. Nhưng khi bước chia cảnh đã đánh
     dấu phần lớn cảnh là TƯ LIỆU CÓ THẬT thì giữ 35% là ép hai phần ba số cảnh
     quay lại ảnh AI — ngược hẳn ý đồ. Nên trần bám theo chính số cảnh được
     đánh dấu, chặn trên 80% để ảnh AI vẫn còn chỗ cho cảnh trừu tượng.       */
  const _soThuc = scenes.filter(s => s.thuc).length;
  /* Người dùng kéo thanh tỉ lệ thì lấy đúng số đó và trần thành CỨNG —
     kể cả cảnh đánh dấu tư liệu thật cũng không vượt, nếu không thì kéo
     thanh xuống 20% vẫn ra 70% cảnh dùng nguồn ngoài.                      */
  const _tay = (typeof _t2TiLeNgoai === 'function') ? _t2TiLeNgoai() : null;
  /* SÀN 0,35 là di tích: con số 35% ban đầu là TRẦN ("nhiều nhất 35% dùng
     nguồn ngoài"), lúc đổi công thức sang bám `thuc` thì nó bị giữ lại thành
     SÀN — nghĩa ngược hẳn. Hậu quả đo được: bước chia cảnh đánh dấu 15% cảnh
     là tư liệu thật, công thức vẫn ép lên 35%. Hơn hai mươi phần trăm số cảnh
     bị giao nguồn ngoài dù AI đã nói chúng không có gì quay được — tìm thì
     trắng tay, mà tìm được thì cũng lệch nội dung.

     Nay TIN vào bước chia cảnh. Vẫn giữ tối thiểu 2 cảnh ở dưới để bật nguồn
     mà không ra clip nào thì trông như hỏng, và giữ trần 0,8 để ảnh AI còn
     chỗ. Muốn nhiều hơn thì kéo thanh tỉ lệ — đó mới là chỗ người dùng quyết. */
  const _tiLe = (_tay !== null)
    ? _tay / 100
    : Math.min(0.8, _soThuc / Math.max(1, scenes.length));
  const _cung = _tay !== null;
  const tran = _cung
    ? Math.round(scenes.length * _tiLe)          // tay: theo đúng thanh, cho phép cả 0
    : Math.max(2, Math.round(scenes.length * _tiLe));
  if (!_cung && typeof novaLog === 'function'){
    const _pc = Math.round(_soThuc / Math.max(1, scenes.length) * 100);
    novaLog(`🎯 Bước chia cảnh đánh dấu ${_soThuc}/${scenes.length} cảnh (${_pc}%) là tư liệu thật → trần ${tran} cảnh.`
      + (_pc < 12 ? ' Kịch bản thiên về trừu tượng — muốn nhiều tư liệu hơn thì kéo thanh Tỉ lệ nguồn.' : ''), 'info');
  }
  if (_cung && tran <= 0) return { doi: 0, tran: 0 };   // kéo về 0% = toàn ảnh AI, khỏi gọi AI
  const CH = 40;
  let doi = 0;
  const co = { veo: 'wantVideo', stock: 'wantStock', yt: 'wantYt', kho: 'wantKho', web: 'wantWeb' };

  /* Trước đây các lô chạy TUẦN TỰ: 267 cảnh = 7 lô = 7 lượt gọi AI nối đuôi.
     Lượt gọi từng lô vốn ĐỘC LẬP — chỉ bước ÁP KẾT QUẢ mới dùng chung biến
     đếm `doi` để chặn trần. Nên tách đôi: gọi AI song song, rồi áp kết quả
     TUẦN TỰ theo đúng thứ tự lô. Kết quả giống hệt bản cũ, chỉ nhanh hơn.  */
  const _lots = [];
  for (let i = 0; i < scenes.length; i += CH) _lots.push(scenes.slice(i, i + CH));

  const _kq = await _t2SongSong(_lots, _concurrency(), async (lot) => {
    const list = lot.map((s, k) => `${k}. [${s.shot || '?'}${s.character ? ' · có nhân vật' : ''}${s.thuc ? ' · TƯ LIỆU THẬT' : ''}] ${_t2Gist(s.text, 90)}`).join('\n');
    const prompt = `Choose the IMAGE SOURCE for each scene of the video.
${topic ? 'TOPIC: ' + topic + '\n' : ''}
Scenes tagged "TƯ LIỆU THẬT" were flagged at split time as depicting REAL, ALREADY-FILMED material —
prioritize assigning those scenes to footage sources. Untagged scenes stay AI images unless clearly better otherwise.
About ${Math.max(1, Math.round(lot.length * _tiLe))} scenes in this batch should be switched.

ENABLED SOURCES:
${bang}

RULES:
- Scenes featuring the video's CHARACTERS (narrator, drawn characters) → keep AI images, avoid stock/kho: real faces won't match.
- Real-life b-roll (sky, sea, city, machinery) → stock.
- Scenes needing REAL ARTIFACTS (objects, old maps, archival photos, astronomy) → kho.
- Scenes needing strong motion that must match the characters → veo.
- Scenes needing REAL FILMED FOOTAGE (hearings, historical events, reports,
  on-site shots, archival footage with motion) → web.
- Abstract, metaphorical, inner-life scenes → keep AI images.

SCENES:
${list}

Return JSON, ONLY the scenes whose source changes:
[{"i":0,"nguon":"stock","why":"short Vietnamese reason under 14 words"}]`;

    for (let t = 0; t < 2; t++){
      try { const a = await callLLMJson(prompt, { maxTokens: 1100, validate: (d) => Array.isArray(d) }); if (a) return a; }
      catch (e){ /* thử lại một lần rồi bỏ lô */ }
    }
    return null;
  }, () => state.cancelRequested);

  // Áp kết quả THEO THỨ TỰ LÔ — biến đếm `doi` phải tăng tuần tự, chạy song
  // song ở đây là vượt trần.
  _lots.forEach((lot, li) => {
    const r = _kq[li];
    const arr = (r && r.ok) ? r.gt : null;
    if (!Array.isArray(arr)) return;
    arr.forEach(row => {
      const k = Number(row && row.i); const s = lot[Number.isFinite(k) ? k : -1]; if (!s) return;
      const ng = String(row.nguon || '').trim();
      if (!co[ng] || !b[ng]) return;                 // nguồn không bật thì bỏ
      // Hết trần thì chỉ còn nhận cảnh đã được đánh dấu tư liệu thật — cảnh
      // thường bị đẩy về ảnh AI, đúng thứ tự ưu tiên.
      if (doi >= tran && (_cung || !s.thuc)) return;
      s[co[ng]] = true; s.nguonVi = ng;
      s.nguonWhy = String(row.why || '').trim().slice(0, 70);
      doi++;
    });
  });

  return { doi, tran };
}

function _t2MarkVideoScenes(){
  const scenes = state.scenes || [];
  const b = _t2NguonBat();
  scenes.forEach(s => { s.wantVideo = false; s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; });
  if (scenes.length < 2) return;
  /* Cửa sổ suy ngược từ tỉ lệ đích: S nguồn bật, cửa sổ N ⇒ tổng ≈ scenes·S/N.
     Muốn tổng = scenes·r ⇒ N = S/r.

     Bản cũ để N=6 cứng ở chế độ tự động. Khi chỉ có 3 nguồn thì ra 3/6 = 50%,
     tạm ổn — nhưng từ khi có đủ 5 nguồn thì thành 5/6 = 83%, vọt khỏi trần.
     Nay chế độ tự động bám ĐÚNG công thức của đường chính (số cảnh được đánh
     dấu tư liệu thật, kẹp 35–80%) để hai đường cho ra kết quả giống nhau.   */
  const _tayN = (typeof _t2TiLeNgoai === 'function') ? _t2TiLeNgoai() : null;
  const _soNguon = _T2_NGUON_DS.filter(n => b[n.id]).length || 1;
  const _soThuc = scenes.filter(s => s.thuc).length;
  const _r = (_tayN !== null) ? _tayN / 100
           : Math.min(0.8, Math.max(0.35, _soThuc / Math.max(1, scenes.length)));
  const _CS = (_r <= 0) ? 0 : Math.max(1, Math.round(_soNguon / _r));
  const _pass = (batKey, _unused, scoreFn, setFlag, avoidFlag) => {
    const N = b[batKey] ? _CS : 0;
    if (!N) return;
    const _av = Array.isArray(avoidFlag) ? avoidFlag : (avoidFlag ? [avoidFlag] : []);
    for (let i = 0; i < scenes.length; i += N){
      const win = scenes.slice(i, i + N);
      let best = null, bestScore = -Infinity;
      win.forEach(s => { if (_av.some(f => s[f])) return; const sc = scoreFn(s); if (sc > bestScore){ bestScore = sc; best = s; } });
      if (best && bestScore > -2) best[setFlag] = true;
    }
  };
  // Veo: cảnh động, có nhân vật (giữ nhất quán), né biểu đồ
  _pass('veo', null, (s) => {
    let sc = 0; const m = (s.motion || '').toLowerCase();
    if (m && m !== 'static') sc += 2;
    if (['hook', 'establishing', 'reveal', 'close-up'].includes(s.shot)) sc += 1;
    if (s.shot === 'compare' || s.shot === 'map') sc -= 4;
    return sc;
  }, 'wantVideo', null);
  // Stock: ưu tiên b-roll / cảnh rộng / KHÔNG nhân vật (stock thật không khớp nhân vật vẽ); né biểu đồ; không trùng Veo
  _pass('stock', null, (s) => {
    let sc = 0;
    if (s.shot === 'b-roll') sc += 3;
    if (s.shot === 'establishing') sc += 2;
    if (!s.character) sc += 2; else sc -= 3;                            // có nhân vật → stock khó khớp
    if (s.shot === 'compare' || s.shot === 'map' || s.shot === 'hook') sc -= 3;
    return sc;
  }, 'wantStock', 'wantVideo');
  // YouTube: b-roll / cảnh đời thực / không nhân vật; né trùng cả Veo lẫn Stock
  _pass('yt', null, (s) => {
    let sc = 0;
    if (s.shot === 'b-roll') sc += 3;
    if (s.shot === 'establishing') sc += 2;
    if (!s.character) sc += 2; else sc -= 3;
    if (s.shot === 'compare' || s.shot === 'map' || s.shot === 'hook') sc -= 3;
    return sc;
  }, 'wantYt', ['wantVideo', 'wantStock']);
  /* Nguồn web: tư liệu QUAY THẬT đã công bố — phóng sự, phiên điều trần, sự
     kiện lịch sử, phim lưu trữ có chuyển động. Cờ `thuc` do bước chia cảnh
     đánh dấu là tín hiệu mạnh nhất, nên cho điểm cao nhất.                  */
  _pass('web', null, (s) => {
    let sc = 0;
    if (s.thuc) sc += 4;                                     // cảnh tả thứ CÓ THẬT đã được quay
    if (s.shot === 'flashback') sc += 3;                     // quá khứ → phim lưu trữ
    if (s.shot === 'b-roll') sc += 2;
    if (s.shot === 'establishing' || s.shot === 'reveal') sc += 1;
    if (!s.character) sc += 2; else sc -= 3;                 // mặt người thật không khớp nhân vật vẽ
    if (s.shot === 'dream') sc -= 4;                         // tưởng tượng thì làm gì có tư liệu thật
    if (s.shot === 'compare' || s.shot === 'map') sc -= 2;   // số liệu/bản đồ hợp ẢNH tĩnh của Kho hơn
    return sc;
  }, 'wantWeb', ['wantVideo', 'wantStock', 'wantYt']);
  /* Kho mở: ẢNH tư liệu giấy phép rõ (Wikimedia · NASA · Openverse ·
     Archive.org) — hiện vật, bản đồ cổ, ảnh lưu trữ, thiên văn.             */
  _pass('kho', null, (s) => {
    let sc = 0;
    if (s.thuc) sc += 3;
    if (s.shot === 'map' || s.shot === 'compare') sc += 3;   // bản đồ, sơ đồ, số liệu
    if (s.shot === 'flashback') sc += 2;                     // ảnh lưu trữ
    if (s.shot === 'establishing' || s.shot === 'b-roll') sc += 1;
    if (!s.character) sc += 2; else sc -= 3;
    if (s.shot === 'dream') sc -= 4;
    return sc;
  }, 'wantKho', ['wantVideo', 'wantStock', 'wantYt', 'wantWeb']);

  /* Cửa sổ không xuống dưới 1 được, nên từ ~70% trở lên phép chia bão hoà
     thành 100%. Cắt bớt cho khớp con số người dùng đặt: bỏ đánh dấu ở cảnh
     HỢP ẢNH AI NHẤT trước — cảnh có nhân vật, rồi cảnh không phải tư liệu thật. */
  {
    const dich = Math.round(scenes.length * _r);
    const co = ['wantVideo', 'wantStock', 'wantYt', 'wantKho', 'wantWeb'];
    const danh = scenes.filter(s => co.some(f => s[f]));
    if (danh.length > dich){
      danh.sort((a, c) => (((a.character ? 2 : 0) + (a.thuc ? 0 : 1)) - ((c.character ? 2 : 0) + (c.thuc ? 0 : 1))));
      danh.slice(0, danh.length - dich).forEach(s => co.forEach(f => { s[f] = false; }));
    }
  }
}

function _t2TagsIn(text){
  const out = [];
  String(text || '').replace(_T2_TAG_RE, (m, n) => {
    const t = String(n).trim(); if (t && !out.includes(t)) out.push(t); return m;
  });
  return out;
}

function _t2RepairTags(b){
  const known = [];
  if (b.character) known.push(b.character);
  if (b.background) known.push(b.background);
  const ok = (t) => known.some(k => t === k || t.startsWith(k + '-') || k.startsWith(t + '-'));
  let n = 0;
  b.prompt = String(b.prompt || '').replace(_T2_TAG_RE, (m, raw) => {
    const t = String(raw).trim();
    if (!t || ok(t)) return m;
    n++;
    // Có nhân vật khai rồi → tag lạ gần như luôn là chính nhân vật đó.
    if (b.character) return '[' + b.character + ']';
    return t;                                    // không quy được về đâu → bỏ ngoặc
  });
  return n;
}

function _canonMap(names){
  const uniq = [...new Set((names || []).map(n => String(n || '').trim()).filter(Boolean))];
  const sorted = uniq.slice().sort((a, b) => b.length - a.length);   // dài trước → làm chuẩn
  const groups = []; const canon = {};
  for (const n of sorted){
    const g = groups.find(g => g.canon === n || g.canon.startsWith(n + '-') || n.startsWith(g.canon + '-'));
    if (g){ canon[n] = g.canon; } else { groups.push({ canon: n }); canon[n] = n; }
  }
  return canon;
}

function _canonTags(prompt, charMap, bgMap){
  return String(prompt || '').replace(/\[([^\[\]]+)\]/g, (m, name) => {
    const t = name.trim();
    if (charMap[t]) return '[' + charMap[t] + ']';
    if (bgMap[t]) return '[' + bgMap[t] + ']';
    return m;
  });
}

async function _t2PlanWardrobe(script, noChar, presetEra){
  const eraLine = presetEra
    ? `The era/setting is GIVEN — clothing, props and architecture MUST match this period: "${presetEra}". Return it unchanged in "era".`
    : `INFER "era" = the era + HISTORICAL SETTING of the script yourself (e.g. "Ancient Egypt, New Kingdom", "medieval Europe", "modern day USA", "1920s").`;
  const eraRule = 'Clothing + hairstyles + props MUST be CORRECT for that era — e.g. ancient Egypt: linen kilts/cloaks, wesekh collars, shaved head/black wig; ABSOLUTELY no jeans/t-shirts/modern items if it is a historical period.';
  const prompt =
`Read the script. ${eraLine}
List the CHARACTERS appearing MANY TIMES (skip walk-on roles). For EACH character, build a WARDROBE. ${eraRule}
⚠️ IMPORTANT: if the script uses 2ND PERSON ("you") and that person is DEPICTED ON SCREEN throughout (the viewer's stand-in — e.g. the buyer, customer, user, viewer) → you MUST create a slug for them (e.g. "shopper","viewer","protagonist") with 1 FIXED outfit, so every scene draws them the SAME. Do NOT skip them just because they have no proper name — they are often the MAIN character of the video.
- "slug": a short fixed 1-3 word name, lowercase hyphenated (e.g. "protagonist-male").
- "outfits": the number of outfits = the number of times the character ACTUALLY CHANGES CLOTHES in the story, NOT the number of locations.
  ⚠️ DEFAULT IS JUST 1 OUTFIT. Visiting many places while STILL WEARING the same outfit → exactly 1 outfit.
  ONLY add a 2nd/3rd outfit when the script CLEARLY shows the character changing (waking→going to work; a time jump; a special occasion). Max 3 outfits.
  Each outfit: · "when": the period/moment it is worn (e.g. "throughout", "morning at home", "years later"). · "desc": a CONCRETE, FIXED, English description, era-correct, EVERY ITEM stating EXACTLY 1 specific COLOR + TYPE (e.g. "a faded navy-blue polo shirt, khaki shorts, white sneakers"). ⚠️ ABSOLUTELY no "or"/multiple color choices — LOCK 1 single color per item so every scene draws it identically.
Do NOT invent characters, do NOT invent outfit changes that are not in the script.
Return ONLY JSON, no markdown:
{"era":"...","characters":[{"slug":"protagonist-male","outfits":[{"when":"throughout","desc":"..."}]}]}

SCRIPT:
"""${String(script || '').slice(0, 14000)}"""`;
  try {
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && (Array.isArray(d.characters) || typeof d.era === 'string') });
    const era = (presetEra || String(data.era || '').trim());
    const wb = {};
    if (!noChar) (data.characters || []).forEach(c => {
      const s = String(c.slug || '').trim(); if (!s || !Array.isArray(c.outfits)) return;
      const outs = c.outfits.map(o => ({ when: String(o.when || '').trim(), desc: String(o.desc || '').trim() })).filter(o => o.desc).slice(0, 4);
      if (outs.length) wb[s] = outs;
    });
    return { era, wb };
  } catch (e) { console.warn('wardrobe/era:', e); return { era: presetEra || '', wb: {} }; }
}

async function doSplit(){
  syncTool2();
  const txt = state.script.trim();
  if (!txt) return setStatus2('Cần kịch bản.', 'error');
  setStatus2('Đang chia cảnh...', 'working');
  try {
    let scenes;
    if (state.splitMode === 'smart') {
      scenes = await splitScenesSmart(txt, state.minChars, state.maxChars);
    } else {
      scenes = splitScenesFast(txt, state.minChars, state.maxChars);
    }
    state.scenes = scenes.map((s, i) => ({
      id: String(i + 1).padStart(3, '0'),
      text: s,
      level: 'L1',
      character: '',
      background: '',
      camera: 'medium',
      duration: calcDur(s),
      userEdited: false,
      promptSeed: s.slice(0, 80),
      seedAt: Date.now()
    }));
    // Cap số cảnh theo tier
    const maxScenes = getMaxScenes();
    let trimmedNotice = '';
    if (state.scenes.length > maxScenes) {
      const cut = state.scenes.length - maxScenes;
      state.scenes = state.scenes.slice(0, maxScenes);
      trimmedNotice = ` (Đã cắt ${cut} cảnh vượt giới hạn gói Free — nâng cấp Pro để mở khoá)`;
      // Show upgrade modal sau 500ms để user kịp đọc status
      setTimeout(() => showGate(`Kịch bản chia ra ${maxScenes + cut} cảnh, nhưng gói Free chỉ giữ ${maxScenes}. Nâng cấp Pro để dùng không giới hạn.`), 500);
    }
    state.scenePrompts = {};
    state.scenePrompts2 = {};
    renderAllT2();
    setStatus2(`✓ Đã chia thành ${state.scenes.length} cảnh.${trimmedNotice}`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doPrescan(){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const p = getProfile();
  if (!p) return setStatus2('Cần tạo Profile trước.', 'error');

  setStatus2('AI đang quét nhân vật & bối cảnh...', 'working');
  const bibleMode = (state.descMode === 'inline_bible');
  try {
    const allText = state.scenes.map(s => s.text).join(' ');
    const prompt = bibleMode
      ? `Read the entire script and list the (human) CHARACTERS + (location) SETTINGS that will appear, WITH fixed appearance descriptions to keep them consistent.

Rules:
- Names: English kebab-case (e.g.: protagonist-young, hospital-room).
- "desc": a FIXED appearance description IN ENGLISH (characters: age, gender, outfit+colors, hair, traits; settings: type of place, objects, lighting, palette). 15-30 words. This gets inserted into EVERY scene using that character/setting, so it must be detailed enough + consistent.
- List EVERY HUMAN character DRAWN in ≥2 scenes → give each a slug (for a reference image, keeping the FACE consistent): main characters, RECURRING side characters, and even the "viewer" in a like-subscribe call-to-action IF the script shows a viewer scene. People appearing only ONCE are NOT listed (described inline in the prompt instead). Max 10 characters, 8 settings.

Script:
"""
${allText.slice(0, 8000)}
"""

Return ONLY JSON:
{"characters":[{"name":"...","desc":"..."}],"backgrounds":[{"name":"...","desc":"..."}]}`
      : `Read the entire script and list the (human) CHARACTERS + (location) SETTINGS that will appear.

Naming rules:
- Characters: English kebab-case, a short role + trait description (e.g.: protagonist-young, narrator, agent-male, victim-female)
- Settings: English kebab-case, a place description (e.g.: dark-office-night, kitchen-interior, hospital-room)
- List EVERY HUMAN character DRAWN in ≥2 scenes (needs a consistent FACE → give a slug): main characters, RECURRING side characters, and even the "viewer" in a like-subscribe call-to-action IF there is a viewer scene. People appearing only ONCE → NOT listed (described inline). Animals are not listed (described directly in the scene prompt).
- Max 10 characters, 8 settings.

Script:
"""
${allText.slice(0, 8000)}
"""

Return ONLY JSON:
{"characters": ["name1", "name2"], "backgrounds": ["bg1", "bg2"]}`;
    const maxTok = bibleMode ? 1500 : 800;
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có ít nhất 1 mảng characters/backgrounds
    const data = await callLLMJson(prompt, {
      maxTokens: maxTok,
      validate: d => d && typeof d === 'object' && (Array.isArray(d.characters) || Array.isArray(d.backgrounds))
    });
    if (bibleMode) {
      state.charBible = {}; state.bgBible = {};
      state.charactersV = (data.characters || []).map(c => {
        const name = typeof c === 'string' ? c : c.name;
        if (c.desc) state.charBible[name] = c.desc;
        return name;
      });
      state.backgroundsV = (data.backgrounds || []).map(b => {
        const name = typeof b === 'string' ? b : b.name;
        if (b.desc) state.bgBible[name] = b.desc;
        return name;
      });
    } else {
      state.charactersV = (data.characters || []).map(c => typeof c === 'string' ? c : c.name);
      state.backgroundsV = (data.backgrounds || []).map(b => typeof b === 'string' ? b : b.name);
    }
    // Bỏ nhân vật GHÉP + QUẦN CHÚNG khỏi danh sách (mỗi người 1 sheet, không tạo sheet cho quần chúng).
    if (typeof _isComboName === 'function') state.charactersV = (state.charactersV || []).filter(n => n && !_isComboName(n) && !_isCrowdName(n));
    if (typeof _isCrowdName === 'function') state.backgroundsV = (state.backgroundsV || []).filter(n => n && !_isCrowdName(n));
    { const ci = document.getElementById('charsInputV'); if (ci) ci.value = state.charactersV.join('\n'); }
    { const bi = document.getElementById('bgInputV'); if (bi) bi.value = state.backgroundsV.join('\n'); }
    renderStats2();
    setStatus2(`✓ Tìm thấy ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.` + (bibleMode ? ' Đã tạo hồ sơ mô tả.' : ''), 'ok');
    saveState();
    return state.charactersV.length + state.backgroundsV.length;   // >0 = quét được, để Auto biết
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi quét nhân vật/bối cảnh: ' + e.message, 'error');
    return 0;   // lỗi → trả 0 để Auto retry / không âm thầm bỏ Gán
  }
}

async function doAssign(only){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus2('Cần Quét Trước nhân vật/bối cảnh trước.', 'error');

  // only = danh sách cảnh CẦN gán lại (vd cảnh trống sau lần Gán đầu).
  // DeepSeek trả KHÁC NHAU mỗi lần → TÍCH LUỸ: chỉ gán cảnh CHƯA có gì, GIỮ NGUYÊN cảnh đã gán
  // (tránh bấm lại bị nhảy kết quả / xoá mất cảnh đã đúng). Provider khác (Claude/OpenAI) ổn định → gán tất như cũ.
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const isDeepSeek = provider === 'deepseek';
  const needsAssign = s => !s.character && !s.background;
  const isFullCall = !(Array.isArray(only) && only.length);
  const pool = !isFullCall ? only : (isDeepSeek ? state.scenes.filter(needsAssign) : state.scenes);
  if (!pool.length) { setStatus2('✓ Mọi cảnh đã có nhân vật/bối cảnh — không cần gán lại.', 'ok'); return; }
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  setStatus2('AI đang gán nhân vật + bối cảnh...', 'working');
  clearCancel();
  const charList = state.charactersV.map(c => '- ' + c).join('\n') || '(không có)';
  const bgList   = state.backgroundsV.map(b => '- ' + b).join('\n') || '(không có)';
  const CAM = ['wide', 'medium', 'close', 'over-shoulder', 'pov'];
  // Chỉ nhận tên KHỚP danh sách (khớp đúng, hoặc gần đúng kiểu chứa nhau) — chống AI bịa tên
  const matchInList = (name, list) => {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return '';
    const exact = list.find(x => x.toLowerCase() === n);
    if (exact) return exact;
    return list.find(x => { const lx = x.toLowerCase(); return lx.includes(n) || n.includes(lx); }) || '';
  };
  const buildAssignPrompt = (batch) => `Assign a character + setting + camera angle to each scene.

CHARACTER LIST (you may only pick EXACTLY 1 name from here, or "" if the scene has no people):
${charList}

SETTING LIST (you may only pick EXACTLY 1 name from here, or "" if unclear):
${bgList}

Rules:
- character / background: MUST be a name exactly as in the lists above, or "" — do NOT invent new names.
- camera: wide | medium | close | over-shoulder | pov
- level: L1 | L2 | L3 | L4

Return ONLY 1 JSON object, keyed by scene id:
{"001":{"character":"...","background":"...","camera":"medium","level":"L1"}, "002":{...}}

THE SCENES:
${batch.map(s => `[${s.id}] "${s.text}"`).join('\n')}`;

  // Chuẩn hoá kết quả về dạng { id: {character,background,camera,level} } dù AI trả object hay array
  const normalize = (parsed) => {
    const o = {};
    if (Array.isArray(parsed)) { for (const x of parsed) if (x && x.id) o[String(x.id).padStart(3, '0')] = x; }
    else if (parsed && typeof parsed === 'object') { for (const [k, v] of Object.entries(parsed)) o[String(k).padStart(3, '0')] = v || {}; }
    return o;
  };

  // 1 lượt gán cho 1 danh sách cảnh (tách ra để gọi lại ở pass 2)
  const runAssign = async (poolScenes) => {
    const lanes = _concurrency();
    const batches = [];
    for (let i = 0; i < poolScenes.length; i += bs) batches.push(poolScenes.slice(i, i + bs));
    let done = 0;
    await runConcurrent(batches, async (batch) => {
      if (state.cancelRequested) return;
      const batchIds = new Set(batch.map(s => s.id));
      // callLLMJson: lặp + ép JSON + chỉ nhận khối normalize ra ≥1 cảnh hợp lệ
      let obj = null;
      try {
        const got = await callLLMJson(buildAssignPrompt(batch), {
          maxTokens: 1500,
          validate: p => Object.keys(normalize(p)).length > 0
        });
        obj = normalize(got);
      } catch (e) { console.warn('Gán batch lỗi:', e.message); }
      if (obj) {
        for (const [id, x] of Object.entries(obj)) {
          if (!batchIds.has(id)) continue;            // chỉ ghi cho cảnh thuộc batch này
          const sc = state.scenes.find(s => s.id === id);
          if (!sc) continue;
          const mc = matchInList(x.character, state.charactersV);   // chỉ nhận tên có thật
          const mb = matchInList(x.background, state.backgroundsV);
          // DeepSeek: KHÔNG ghi đè '' lên giá trị đã có (tránh xoá nhầm cảnh đúng); provider khác gán bình thường
          if (mc || !isDeepSeek) sc.character = mc;
          if (mb || !isDeepSeek) sc.background = mb;
          sc.camera = CAM.includes(x.camera) ? x.camera : (sc.camera || 'medium');
          sc.level = /^L[1-4]$/.test(x.level) ? x.level : (sc.level || 'L1');
        }
      }
      done += batch.length;
      renderAllT2();
      setStatus2(`Gán... ${Math.min(done, poolScenes.length)}/${poolScenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    }, lanes, () => state.cancelRequested);
  };

  try {
    await runAssign(pool);
    if (state.cancelRequested) {
      clearCancel();
      setStatus2('⏸ Đã dừng. Kết quả gán được giữ lại.', 'info');
      saveState();
      return;
    }
    // 🔁 PASS 2 (chỉ DeepSeek, lần gán đầy đủ): cảnh VẪN trống → kiểm lại 1 lần nữa
    // (DeepSeek flaky: cảnh trống có thể do batch lỗi, không phải vì thật sự không có nhân vật/bối cảnh)
    if (isDeepSeek && isFullCall) {
      const still = state.scenes.filter(needsAssign);
      if (still.length && still.length < state.scenes.length) {
        setStatus2(`🔁 Kiểm lần 2: ${still.length} cảnh còn trống...`, 'working');
        clearCancel();
        await runAssign(still);
        if (state.cancelRequested) { clearCancel(); setStatus2('⏸ Đã dừng (sau kiểm lần 2). Kết quả được giữ lại.', 'info'); saveState(); return; }
      }
    }
    // Cảnh báo nếu gán được quá ít (dấu hiệu model trả rác) → khuyên đổi provider
    const withRes = state.scenes.filter(s => s.character || s.background).length;
    if (withRes < state.scenes.length * 0.15) {
      setStatus2(`⚠️ Chỉ gán được ${withRes}/${state.scenes.length} cảnh — model có thể trả JSON lỗi. Thử đổi provider sang Claude/OpenAI cho bước Gán, hoặc Quét Trước lại.`, 'info');
    } else {
      setStatus2(`✓ Đã gán xong (${withRes}/${state.scenes.length} cảnh có nhân vật/bối cảnh).`, 'ok');
    }
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function genVideoLogline(force){
  const script = (state.script || '').trim();
  if (!script) return state.videoLogline || '';
  // Chữ ký kịch bản → đổi kịch bản thì logline cũ coi như hết hạn, tự sinh lại.
  // Logline cũ còn dấu < > = rác (AI chép lại đề bài) → cũng coi là hết hạn để sinh lại.
  const sig = script.length + '|' + script.slice(0, 60);
  const looksReal = state.videoLogline && state.videoLogline.trim() && !/[<>]/.test(state.videoLogline);
  const fresh = looksReal && state.videoLoglineSig === sig;
  if (!force && fresh) return state.videoLogline;
  const p = getProfile();
  const ngach = p && p.ngach ? p.ngach : '';
  const prompt = `Read the video script below and WRITE A LOGLINE summarizing the WHOLE VIDEO (so every scene stays on topic when images are generated).
${ngach ? 'Channel niche: ' + ngach + '\n' : ''}Requirements: 2-4 sentences IN VIETNAMESE — main story/content + the recurring character + setting & era + emotional tone. Specific and concise. Do NOT list individual scenes, do NOT narrate chronologically.
⚠️ Write a REAL logline derived from the script — NEVER copy the request lines above, no < or > characters.
Correct example: {"logline":"Hành trình một cậu bé Hy Lạp cổ đại bị bán làm nô lệ sau chiến tranh, từ làng quê tới khu chợ buôn người ở thế giới cổ đại. Tông bi tráng, hoài niệm."}

Return ONLY 1 JSON object: {"logline":"..."}

SCRIPT:
"""
${script.slice(0, 6000)}
"""`;
  try {
    const o = await callLLMJson(prompt, {
      maxTokens: 400,
      // Chặn AI chép lại đề bài: phải đủ dài, không có dấu < >, không chứa cụm meta của yêu cầu
      validate: o => {
        if (!o || typeof o.logline !== 'string') return false;
        const s = o.logline.trim();
        return s.length >= 25 && !/[<>]/.test(s)
          && !/KHÔNG\s+liệt kê|nội dung\/câu chuyện|2-4 câu tiếng Việt|câu tiếng Việt:|2-4 sentences|main story\/content|recurring character/i.test(s);
      }
    });
    state.videoLogline = o.logline.trim();
    state.videoLoglineSig = sig;
    const el = document.getElementById('videoLogline');
    if (el) el.value = state.videoLogline;
    saveState();
    return state.videoLogline;
  } catch (e) {
    console.warn('genVideoLogline:', e.message);
    return state.videoLogline || '';
  }
}

function _profileStyleStr(p){
  return (((p?.sceneStyle || '') + ' ' + (p?.characterStyle || '') + ' ' + (p?.visualStyle || '') + ' ' + (p?.styleDesc || '') + ' ' + (p?.ngach || '')).toLowerCase())
    .replace(/\b(no|not|non|without|avoid|never|kh[ôo]ng)[\s-]+(3d|anime|manga|photo-?real\w*|photograph\w*|cgi|octane|water-?colou?r|line-?art|cartoon|flat-?2d|realistic|realism)\b/g, ' ');
}

function _profileMedium(p){
  const s = _profileStyleStr(p);
  const is2D = /flat.?2d|2d cartoon|2d animation|hand.?drawn|hand drawn|storybook|flat drawn|explainer.?cartoon|line.?art|stick figure|vector|doodle|whiteboard|cartoon|tranh v[ẽe]|v[ẽe] tay|ho[ạa]t h[ìi]nh/.test(s);
  const explicitPhoto = /photoreal|photo-?real|photograph|photography|film still|live.?action|real (human|people|person)|realistic skin|hyper.?real|documentary photo|[ảa]nh th[ậa]t|ng[ưu][ờo]i th[ậa]t/.test(s);
  // "realistic/tả thực" mà KHÔNG kèm chữ vẽ/tranh → coi là ảnh thật; kèm "illustration/painting" thì để Profile tự nói.
  const realish = /\brealistic|realism|lifelike|true.to.life|t[ảa] th[ựu]c/.test(s);
  const drawish = /illustration|painting|painted|drawn|drawing|sketch|comic|cartoon|tranh|v[ẽe]/.test(s);
  const isPhoto = !is2D && (explicitPhoto || (realish && !drawish));
  let medium = '';
  if (isPhoto) medium = 'a real photograph, natural realistic lighting';
  else if (!is2D && /\b3d\b|pixar|\bcgi\b|octane|stylized 3d/.test(s)) medium = 'a stylized 3D render';
  else if (/\b(anime|manga)\b/.test(s)) medium = 'anime-style illustration';
  else if (/water ?colou?r/.test(s)) medium = 'a hand-painted watercolor illustration';
  else if (/line ?[- ]?art/.test(s)) medium = 'clean line-art illustration';
  else if (is2D) medium = 'hand-drawn 2D illustration, flat drawn art';
  return { is2D, isPhoto, medium };
}

function _cleanSceneStyle(raw){
  let s = String(raw || '');
  const is2D = /flat.?2d|2d cartoon|2d animation|hand.?drawn|storybook|explainer.?cartoon|line.?art|vector|stick/i.test(s);
  if (is2D){
    s = s.replace(/[,;·—-]?\s*(a\s+)?(stylized\s+)?3d[\s-]*render[^.,;·]*/gi, '')
         .replace(/[,;·—-]?\s*pixar[- ]?(like|inspired|style|esque)?/gi, '')
         .replace(/[,;·—-]?\s*(photo-?real\w*|photograph\w*)[^.,;·]*/gi, '')
         .replace(/\s{2,}/g, ' ').replace(/\s*[—,;·-]\s*$/,'').trim();
  }
  return s;
}

function buildSceneGenPrompt(batch, prevSceneCtx, p, profileContext, neighborVO){
  const _ssClean = _cleanSceneStyle(p.sceneStyle);   // dùng thay p.sceneStyle ở các cụm aesthetic
  /* ── Cảnh dùng TƯ LIỆU CÓ SẴN phải viết kiểu khác hẳn ──────────────────
     Style profile (tông màu, chất liệu vẽ, ánh sáng dàn dựng, nhân vật khoá
     theo ảnh tham chiếu) chỉ có nghĩa khi ẢNH DO AI VẼ. Đem nguyên bộ đó đi
     tìm clip có sẵn thì hỏng cả hai đầu: không kho nào có "flat-2D teal
     palette", mà từ khoá lại bị nhấn chìm dưới đống chữ tả tông màu.
     Với cảnh có ⚑ thì "prompt" đổi vai: nó là MÔ TẢ ĐỂ ĐI TÌM, không phải
     lệnh vẽ.                                                               */
  const _coThucBatch = (Array.isArray(batch) ? batch : []).some(_laThuc);
  const luatThuc = _coThucBatch ? `

⚑ SCENES LABELED "TƯ LIỆU THẬT" (REAL FOOTAGE) — WRITE COMPLETELY DIFFERENTLY:
- These scenes do NOT get AI images. They will be filled with REAL filmed clips/photos from stock libraries.
- For those scenes, "prompt" is NOT a drawing instruction but a SEARCH DESCRIPTION: 6–14 English words, only
  CONCRETE NOUNS + REAL ACTIONS (e.g. "capuchin monkey cracking nut with stone",
  "archaeologist brushing soil at excavation trench").
- ⛔ ABSOLUTELY do NOT include: color grading, drawing style, medium (2D/3D/watercolor/render),
  staged lighting, character [slug] names, or any Style Profile wording. No stock library can
  search by color mood, and those words only dilute the keywords.
- Scenes WITHOUT the label follow all the AI-image rules below as normal.` : '';
  const _pmScene = _profileMedium(p);                 // Profile trống thì bám medium suy ra được, KHÔNG mặc định 2D
  // Công thức hình theo KIỂU CẢNH — lượt 1 chỉ chọn kiểu, lượt này mới cần công thức để viết prompt.
  const _shotRecipes = _sceneTypesOn().map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  const highDetail = T2_TUY_CHON.highDetail;
  // Hai chế độ ĐỘC LẬP: shortMode = nhân vật do ảnh reference lo (đồng nhất); highDetail = môi trường tả dày.
  // Bật CẢ HAI = nhân vật khoá theo reference + bối cảnh chi tiết.
  // Ô shortPromptMode cũng đã gỡ. Không sao: refShape bên dưới vẫn TRUE nhờ
  // descMode mặc định 'tag' → hành vi không đổi.
  const shortMode = false;
  // refShape = nhân vật do ẢNH REFERENCE gánh → prompt NGẮN, KHÔNG nhồi body-lock/NOT-list (đúng Bản 1 Nano Banana).
  // Chế độ tag ([tên-nhân-vật] + reference sheet) mặc định coi là có ref → luôn dùng shape ngắn.
  const refShape = shortMode || (state.descMode || 'tag') === 'tag';
  const noCharMode = document.getElementById('noCharMode')?.checked;
  const _brollEl = document.getElementById('brollMode');   // ô tick đã gỡ khỏi UI redesign → không có ô = BẬT (mặc định cũ)
  const brollMode = (_brollEl ? _brollEl.checked : true) || noCharMode;
  // 🧩 Style lai: cảnh kể = người que + bối cảnh, cảnh giải thích = icon nền trắng
  const hybridIconMode = T2_TUY_CHON.hybridIcon && !noCharMode;
  const hybridRule = hybridIconMode ? `
🧩 HYBRID STYLE — SPLIT INTO 2 SCENE KINDS (MANDATORY, decide by VO content):
1) STORYTELLING scenes (VO is an action/emotion/narration by a PERSON) → draw the CHARACTER (the channel's stick figures) in full SETTINGS per the Scene Style.
2) EXPLANATORY scenes (VO explains a concept / process / comparison / data / cause-effect, NOT a character's action) → draw SIMPLE line-art ICONS / PICTOGRAMS, bold black strokes, sign-like, on a PLAIN SOLID WHITE background. NO stick-figure characters, NO rooms/scenery. 1–4 icons per scene, minimal, lots of white space.
   - Prompts of this kind MUST state: "minimalist black line-art pictogram icons on a plain solid white background, no scenery, no characters, lots of negative space".
- Decide per scene from the VO. Most narrative lines → kind 1; explanatory/concept lines → kind 2.
` : '';
  // 🏺 Khoá thời đại cho prompt cảnh: ưu tiên giá trị đã đặt ở Tool 3 (state.t3Era), nếu trống → trích kịch bản
  const eraHintT2 = (state.t3Era && state.t3Era.trim())
    ? state.t3Era.trim()
    : (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const eraBlockT2 = eraHintT2
    ? `\n🏺 SETTING & ERA (applies to EVERY scene): ${eraHintT2}\n- The clothing, hair/headwear and props of EVERY character — including freely-described secondary characters, crowds, passers-by — MUST match this era/setting; no anachronistic modern items/hair. KEEP the channel's art-style/render medium (per Character/Scene Style) on every character — only adapt outfit/hair/props to the era.\n`
    : '';
  // 🎬 Cảnh b-roll / 🚫 không nhân vật
  const brollRule = noCharMode ? `
🚫 THIS VIDEO HAS NO CHARACTERS (PURE TUTORIAL / B-ROLL) — TOP-PRIORITY RULE, APPLIES TO EVERY SCENE:
- ABSOLUTELY no people, no characters, no presenter, no human silhouettes, no faces in ANY scene.
- EVERY scene is only: scenery / objects / processes / close-ups (close-up, macro) / tools / simple diagrams.
- When the VO describes a person's action → convert it into a scene showing the OBJECT / RESULT / PROCESS, no person. Example: "you water the plants" → "close-up of a watering can pouring water onto green seedlings, no person"; emotional/pronoun lines ("she smiles") → replace with related scenery fitting the context.
- SKIP the character classification section below entirely.
- EVERY prompt MUST end with: "no people, no person, no humans, no figures, no hands".
` : (brollMode ? `
🎬 Not every scene needs people — DECIDE YOURSELF from the VO content:
- VO about PEOPLE (actions, presenter lines, emotions, dialogue) → scene WITH characters.
- VO describing OBJECTS / PLACES / PROCESSES / detail CLOSE-UPS / concrete phenomena (e.g. "ants on a leaf", "the vegetable bed", "a jar of baking soda", "roots in the soil", "rain falling") → make it a B-ROLL / INSERT / CLOSE-UP scene with only objects + setting, NO people, NO presenter looking at camera.
- Goal: INTERLEAVE people-scenes and b-roll scenes so the video feels natural — do NOT force a presenter into every frame.
- ⚠️ IMPORTANT: a scene may ALREADY have an assigned character ("nhân vật:" in the scene line), BUT if that scene's VO describes OBJECTS / CONCEPTS / METAPHORS / abstract lines (not a concrete action of that character) → you MAY drop the person and make a b-roll/object INSERT, you are NOT forced to include the assigned [character] tag. The character tag is a hint, not a hard order, for b-roll.
- B-roll scenes still keep the channel's exact style/palette/lighting; describe the subject clearly, the shot size (close-up/macro/wide), the composition.
` : '');
  // ---- Mode-aware: Tag / Inline / Inline+bible ----
      const dm = state.descMode || 'tag';
      let charCtx, bgCtx, charHeader, bgHeader, mode1Rule;
      if (dm === 'inline_bible') {
        charCtx = state.charactersV.map(c => `- ${c}: ${(state.charBible && state.charBible[c]) || '(no profile yet — run Pre-scan)'}`).join('\n');
        bgCtx = state.backgroundsV.map(b => `- ${b}: ${(state.bgBible && state.bgBible[b]) || '(no profile yet)'}`).join('\n');
        charHeader = 'CHARACTERS — PASTE the fixed description below VERBATIM into the prompt (do not change a word, no square brackets):';
        bgHeader = 'SETTINGS — PASTE the fixed description below VERBATIM:';
        mode1Rule = `- Pose/expression/action: describe per the VO
- When the character is a PERSON: PASTE that character's fixed description (from the list above) VERBATIM into the prompt, not one word changed, no square brackets → the character stays identical across every scene. Example: "a tired female nurse, mid-30s, mint-green scrubs, brown hair in low bun, stands at the desk..."
- Animals/objects: describe normally
- Settings: PASTE that setting's fixed description VERBATIM`;
      } else if (dm === 'inline') {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'CHARACTERS (role hints — describe the FULL appearance in the prompt):';
        bgHeader = 'SETTINGS (hints):';
        mode1Rule = `- Pose/expression/action: describe per the VO
- When the character is a PERSON: describe the FULL appearance IN the prompt itself (age, gender, outfit+colors, hair, traits), no square brackets. Example: "a young male agent in a grey suit, short black hair, stands at the desk..."
- If the same character appears in multiple scenes: describe them IDENTICALLY each time for consistency
- Animals/objects: describe normally
- Settings: describe the setting FULLY in the prompt (no square brackets)`;
      } else {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'CHARACTERS WITH REFERENCE SHEETS (write the [name] tag):';
        bgHeader = 'SETTINGS (referenced from the sheet):';
        mode1Rule = `- Character IN the list above: write [character-name] (e.g. "[narrator] stands at desk...")
- SECONDARY characters NOT in the list (appear in VO but have no reference): describe them FREELY in a few words matching the channel's main style — e.g. if the scene has a stranger, passer-by, crowd → describe "a [short description] character in same art style" WITHOUT square brackets
- If the scene has MULTIPLE characters: include both the main characters (tags) and secondary ones (free description). Example: "[narrator] talking to a worried elderly woman in plain dress, both in same cartoon style, inside [office-night]"
- Animals/objects: describe normally, NO square brackets
- Setting: write [setting-name] (e.g. "inside [dark-office-night]...")
- Secondary characters must MATCH the main characters' style (same linework, same proportions)`;
      }
      // Detect animation/cartoon style → inject formula block
      const styleStr = (p.sceneStyle || '').toLowerCase();
      const isCartoon2D = /cartoon|flat|2d|animation|hand.drawn|stick|explainer|educational/.test(styleStr);
      // Lấy mô tả nhân vật NGẮN GỌN từ characterStyle của Profile (không hardcode)
      // Ưu tiên "Đặc điểm nhận dạng" (1 dòng do user đặt) → lặp gọn mỗi cảnh, không bloat prompt.
      // Nếu trống → lấy 600 ký tự đầu Character Style (đủ chứa đặc điểm cốt lõi như stick-limb; trước đây cắt 280 nên mất).
      const charStyleShort = ((p.charIdentity && p.charIdentity.trim())
        ? p.charIdentity.trim()
        : _trimToSentence((p.characterStyle || '').replace(/\s+/g, ' ').trim(), 600));
      const animFormulaBlock = (isCartoon2D && refShape) ? `
🎬 STYLE IS CARRIED BY THE REFERENCE IMAGE (VARIANT 1 — scenes with [character-name] get a reference image attached at generation time):
- ABSOLUTELY do NOT re-describe the character's full appearance / body proportions / linework in the prompt (the reference image already LOCKS those — re-describing them will FIGHT the reference). Write only [character-name] + the action/expression from the VO.
- Write the prompt TERSELY in the Nano Banana shape: [subject + action] at [setting] → [camera angle] → [lighting/atmosphere] → END with 1 SHORT positive scene-aesthetic phrase (e.g. "${_ssClean || _pmScene.medium || 'consistent cinematic style, cohesive lighting'}").
- NO NOT/no lists (except "no text, no watermark" at the end). Phrase POSITIVELY.
- Secondary characters WITHOUT a reference image: describe their appearance BRIEFLY per the channel style.
` : (isCartoon2D ? `
🎬 STYLE MASTER AT THE END (VARIANT 2 — NO reference image, describe the style yourself at the end of the prompt):
APPLY THE IMAGE FORMULA per the "type" of each scene (do NOT write the type name into the prompt):
${_shotRecipes}
⛔ Do NOT write a style/aesthetic phrase at the end of the prompt — the system APPENDS the exact same standard phrase to every scene itself. Describe only the visual content.
⛔ Do NOT describe READABLE TEXT, NUMBERS, labels, signs or titles in the image (no "labeled '35'", no "screen reads DEVALUATION"). To convey data, express it through QUANTITY/size/height/thickness of objects — e.g. 'a towering stack of suitcases next to one lone case' instead of writing the number.
- Write the prompt in this shape: [subject + action] at [setting] → [camera angle] → [lighting] → then FINALLY append 1 positive STYLE sentence summarizing the character design + linework (based on: "${charStyleShort || 'the channel character style'}").
- Phrase POSITIVELY, NO NOT lists (keep only no text, no watermark at the end).
` : '');

      // 🎯 Logline toàn video — áp cho MỌI cảnh để không lạc chủ đề / không đứt mạch giữa batch
      const loglineBlock = (state.videoLogline && state.videoLogline.trim())
        ? `\n🎯 WHOLE-VIDEO PREMISE (every scene MUST stick to this):\n"${state.videoLogline.trim()}"\n- Every scene — including abstract lines / rhetorical questions / transitions — must stay inside this video's VISUAL WORLD (correct characters, settings, era, palette above). Do NOT draw generic imagery that drifts off the story.\n`
        : '';
      const prompt = `You are a G-Labs prompt engineer (Imagen / Nano Banana). Write a scene prompt for each scene below.

CHANNEL PROFILE:
${profileContext}
${loglineBlock}
SCENE AESTHETIC (used for EVERY scene): "${_ssClean || 'consistent visual style across all scenes'}"

LOOK DIRECTION (phrase POSITIVELY in the prompt — do NOT copy verbatim as a "no/not" list; keep only the few truly needed negatives like no text, no watermark): "${p.promptRules || ''}"
${eraBlockT2}${animFormulaBlock}

${charHeader}
${charCtx || '(none)'}
${(state.wardrobe && Object.keys(state.wardrobe).length) ? ('\n👕 FIXED WARDROBE (MUST paste the EXACT "desc" — do NOT invent different outfits; same period = dressed the SAME):\n' + Object.entries(state.wardrobe).map(([n, os]) => `  • [${n}]: ${(os || []).map(o => `when ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')) : ''}

${bgHeader}
${bgCtx || '(none)'}

For each scene, FIRST determine the SCENE KIND from the VO content, then write a matching prompt:
${hybridRule}${brollRule}${VISUAL_METAPHOR_RULE}
🔹 KIND 1 — CHARACTERS IN A SETTING (VO is about a person's action):
${mode1Rule}

🔹 KIND 2 — SIMPLE INFOGRAPHIC / CHART (VO is about data, comparisons, statistics):
- Keep it SIMPLE: 1-2 simple icons/charts + a character ${dm === 'tag' ? '[character-name]' : 'in the channel style (do NOT default to stick figures)'} pointing or standing beside it
- Keep it SIMPLE, no multi-panel layout. Write REAL TEXT/NUMBERS into the chart (a title + a few SHORT 1-4 word labels / exact numbers, matching the VO, spelled correctly) — ABSOLUTELY no EMPTY label cells / "[TEXT]" / "reserved caption". Keep the text SHORT so the model renders it clearly.
- Do NOT draw internal organs or medical symbols unless the VO explicitly calls for them
- Example: "${dm === 'tag' ? '[narrator-male]' : 'A simple character in the channel art style'} pointing at a simple bar chart with 3 labelled bars — \\"Storage 20\\", \\"Mall 12\\", \\"Office 8\\" written under them, title \\"Cost per month\\" on top; clean flat background, minimal style, short real text spelled correctly"

🔹 KIND 3 — PROCESS / STEPS (VO explains how to do something, step by step):
- Describe 2-3 steps left to right with simple arrows
- ${dm === 'tag' ? 'If a character is involved: write [character-name] performing the action' : 'A simple character (in the CHANNEL STYLE) performs each step'}
- Example: "Three steps left to right with arrows: step 1 seed icon, step 2 watering can icon, step 3 plant sprouting, warm muted palette, flat 2D style"

🔹 KIND 4 — ICON / CONCEPT (VO explains an abstract concept):
- 1 large central icon + at most 4 smaller icons around it, simple flat illustration style
- Use visual metaphors (brain = thinking, heart = emotion, wallet = finance)
- Do NOT draw realistic characters, do NOT draw human internal organs unless the VO is specifically medical
- ${dm === 'tag' ? 'If a secondary character is involved: write [character-name] standing beside the icon' : 'If people are needed: draw a simple character in the CHANNEL STYLE (do NOT default to stick figures)'}
- Example: "Central large coin icon surrounded by 4 small flat icons: house, car, graduation cap, piggy bank, connected by dotted lines, warm yellow background, flat 2D style"

🔹 KIND 5 — STRIKING NUMBER/KEYWORD + ILLUSTRATION (ONLY when the VO has a shocking number, a specific year, or a single key word):
- ONLY for 1-4 WORD text, NOT for narrative lines/dialogue
- Short bold text at top/center + a simple illustration below
- Example: "Bold black text '13,000 YEARS' at top center, below a simple flat illustration of ancient cave with campfire, warm earthy palette, flat 2D style"
- Do NOT use KIND 5 if the VO is a story line — choose KIND 1 (characters) or KIND 4 (concept icon)

GENERAL RULES:
- Always describe the SPATIAL COMPOSITION (left/right/top/bottom/center)
- 🎬 PURPOSEFUL LIGHTING per the VO's EMOTION (don't leave it flat/even in every scene): tense/fear → harsh backlight, strong shadows, high contrast; warm/nostalgic → golden hour, soft slanted sun; sad/still → cold blue, diffused; joyful/hopeful → bright, clear, radiant; mysterious → mostly dark + 1 highlight streak. State the light source + direction + atmosphere clearly.
- 🧭 DEPTH & COMPOSITION: build foreground–midground–background layers for space; place the subject by the rule of thirds; use leading lines/perspective to draw the eye to the subject; "close-up" favors a slightly blurred background (shallow depth of field) to isolate the subject.
- End with the scene aesthetic tag

⚠️ TEXT IN IMAGE — VERY IMPORTANT (MOST SCENES SHOULD HAVE NO TEXT):
- DEFAULT: NO text in the image. Let the visuals tell the story through characters, icons, composition.
- Add text ONLY when it truly punctuates: a number ('8 HOURS'), a year ('1965'), 1 key word ('WARNING', 'DANGER')
- HARD LIMIT: in-image text is at most 4 WORDS. Written in CAPS, in single quotes.
- ABSOLUTELY no full VO lines, dialogue, or long titles in the image (e.g. do NOT write 'SKIP SEVERAL NIGHTS? THE STREETS STOP WORKING' or 'SLEEP IS WHEN THE CLEANUP HAPPENS')
- ABSOLUTELY do NOT translate the VO into English as the text — text is only an ultra-short punch, not a sentence title
- 🌐 TEXT LANGUAGE: ENGLISH ONLY. ABSOLUTELY no Korean, Chinese, Japanese, Thai, Arabic, or any other script. You MUST state in the prompt: "all text in English only, no Korean / Chinese / Japanese characters"
- KIND 4 CONCEPT ICONS: icons use pure VISUAL METAPHORS (brain, clock, symbols) — do NOT paste a text label under each icon (a common failure: the AI defaults to adding Korean labels under health/medical icons)

🔗 IMAGE CONTINUITY (so the video does NOT feel disjointed — very important):
- These are CONSECUTIVE scenes in the SAME video → keep the visual flow continuous.
- Consecutive scenes in the SAME setting → keep the SPACE consistent (same room, same layout, same light direction), only change camera angle/action.
- Change camera angles PURPOSEFULLY (e.g. wide → medium → close to guide the viewer), do NOT jump to random angles between scenes.
- Same content segment → palette + lighting + composition must flow smoothly from the previous scene, no abrupt changes.
${prevSceneCtx ? '\n📍 THE IMMEDIATELY PREVIOUS SCENE (the first scene below must flow smoothly from this one):\n"' + prevSceneCtx + '"\n' : ''}
${neighborVO ? `\n🔗 NEIGHBOR CONTEXT (the previous & next scenes' VO — USE it to understand the setting when the current scene lacks imagery):\n${neighborVO}\n
⚠️ If the current scene's VO has no concrete imagery (rhetorical questions, transitions, abstract lines like "what does it feel like?", "hold that feeling", "here's the thing") → BORROW the setting/characters/atmosphere from the previous or next scene to draw a fitting, seamless image. Do NOT leave the prompt empty or overly generic. The image must continue the story naturally.` : ''}
⚠️ ABSOLUTELY DO NOT:
- Do NOT write "KIND 1", "KIND 2", "KIND 3", "KIND 4", "KIND 5" into the output prompt
- Do NOT write "Type 1", "Type 2", ... or any classification label
- Do NOT write "[001]", "[002]" or scene indices into the prompt
${dm === 'tag' ? '- ALWAYS use [character-name] and [setting-name] for every scene with characters — do NOT describe inline\n- Correct: "[narrator-male] walks in [outdoor-nature-daytime]" | WRONG: "a generic character walks in a green field"\n' : '- Do NOT use square brackets [] for character/setting names — describe them DIRECTLY in English words\n'}- The scene kind is ONLY for the AI to pick the style INTERNALLY, it must NOT APPEAR in the final text prompt
- The returned prompt must START IMMEDIATELY with the visual description (e.g. "Medium shot of...", "Split layout showing...", "Wide angle of..."), with no other prefix

📐 NANO BANANA FORMULA (Google DeepMind — an instruction-following model built on Gemini; write prompts in EXACTLY this shape):
- ORDER: [Subject + specific adjectives] doing [action] at [setting] → [composition/camera angle] → [lighting/atmosphere] → [style/linework near the END]. Put SUBJECT–ACTION–SETTING FIRST, style/aesthetic at the END (do NOT front-load style).
- POSITIVE PHRASING: describe what you WANT to see, MINIMIZE "no X / not Y" (this model does not use SDXL-style negative prompts). E.g. "clean plain white background" instead of "no clutter/no background"; "empty street" instead of "no cars". Keep only the few truly needed negatives: no text, no watermark (+ no people for b-roll). ⚠️ EXCEPTION: INFOGRAPHIC / CHART / COMPARISON / MAP scenes SHOULD include real short TEXT/NUMBERS (a title + 1-4 word labels / correct numbers) — for those scenes do NOT add "no text".
- NATURAL, coherent language, full sentences — do NOT stuff loose keywords separated by commas.
- Do NOT write "--ar" or aspect ratios into the prompt (the tool sets the ratio separately via the API).

🛡 CONTENT SAFETY (MANDATORY — to pass the image tool's filters):
The image tool (G-Labs) REJECTS prompts with directly deadly/violent/casualty content. When the VO mentions death, drowning, freezing, bodies, victims, blood, suffering... you MUST write the prompt INDIRECTLY, metaphorically, focused on the ATMOSPHERE instead of the action:
- "drowning" → "floating in dark water looking up, peaceful, eyes closed"
- "dead body" → "figure drifting gently in deep water, calm, distant"
- "freezing to death" → "shivering, breath visible, wrapped in cold blue tones"
- "1,500 victims died / thousands dead" → "vast empty dark ocean, scattered distant lights, somber mood" (no dead bodies, no casualty numbers)
- "blood / gore" → drop entirely, replace with a dark somber atmosphere
- ABSOLUTELY do NOT use the words: dead, death, dying, corpse, drowning, blood, gore, victim, suffering in the English prompt
- Replace with: peaceful, drifting, floating, cold, somber, quiet, still, distant, fading
- Keep the scene's EXACT emotion and atmosphere, only change the phrasing so it does not violate policy

Prompt language: ENGLISH (for image gen). ${refShape && highDetail ? '70-130 words/prompt (characters are handled by the reference image; describe the ENVIRONMENT densely in detail).' : refShape ? '55-110 words/prompt (characters are ONLY a tag — the reference image handles the appearance, do NOT re-describe body-lock; SPEND the words on the detailed ENVIRONMENT/setting + lighting (direction/color/contrast) + composition & DEPTH → the prompt stays RICH and CINEMATIC, terse only on the character part).' : highDetail ? '90-160 words/prompt (HIGH DETAIL).' : '60-120 words/prompt.'}
${highDetail ? `
🔍 HIGH-DETAIL MODE — make the image DENSELY detailed like narrative illustration:
- FOREGROUND PROPS: name 3-6 concrete objects in the scene (e.g. wooden crates, coiled rope, clay jars, torches, a workbench, weapons on the wall, a market stall) — do NOT leave the background empty.
- MATERIALS & TEXTURE: state surface materials (worn wood, nailed brass, mossy stone, linen fabric, rusted metal, cracked plaster) so the image gains depth.
- DEPTH LAYERS: describe foreground / midground / background separately (e.g. distant mountains, temple columns, ships, rooftops, a blurred crowd) to create depth.
- SPECIFIC LIGHTING: source + direction + color (e.g. "warm torchlight from the left casting long shadows", "overcast grey daylight from above").
- Still keep the channel's EXACT art-style (linework, character proportions, palette) — only add ENVIRONMENTAL detail, do NOT change the character style.
- Add detail but STILL respect the NO-TEXT rules above — do NOT add text/labels into the image.
` : ''}${shortMode ? `
⚡ SHORT PROMPT MODE (the user will attach the character's REFERENCE IMAGE when generating):
- Do NOT describe the character's appearance in detail (no round head, eyes, limbs, hair, clothes, body proportions) — the reference image handles that
- Write ONLY: [character-name] + ACTION + POSE + emotion (e.g.: "[passenger-bunk] lying on bunk staring at ceiling, worried")
- FOCUS on describing: setting, lighting, camera angle, palette, atmosphere
- Do NOT repeat character style traits — let the reference image decide
- Still keep the general style description for the ENVIRONMENT (flat 2D, colors, outline) but do NOT apply it to characters
` : ''}

${luatThuc}

⚠️ Write the FULL SEPARATE prompt for EVERY scene in the list — do NOT get lazy:
- No "...", "...full prompt...", "[full prompt]", "same as above", "like the previous scene", "similar".
- No blanks, no abbreviations. Every scene MUST have 1 complete standalone prompt, fully written.

Return ONLY a JSON array (each scene 1 COMPLETE element):
[{"id":"001","prompt":"<complete prompt>"}, ...]

THE SCENES:
${batch.map(s => `[${s.id}] VO: "${s.text}" | character: ${s.character || '-'} | setting: ${s.background || '-'} | camera: ${s.camera} | ${s.duration}s${_laThuc(s) ? ' | ⚑ REAL FOOTAGE' : ''}`).join('\n')}`;
  return prompt;
}

async function _t2CuuCanhTrong(imLang){
  const ds = (state.scenes || []).filter(s =>
    _laThuc(s)
    && !((state.mediaPicks || {})[s.id])
    && !((state.scenePrompts || {})[s.id] || '').trim());
  if (!ds.length) return { cuu: 0 };
  if (!imLang) setStatus2(`🩹 ${ds.length} cảnh không tìm được tư liệu — chuyển về ảnh AI…`, 'working');
  if (typeof novaLog === 'function')
    novaLog(`🩹 ${ds.length} cảnh tìm tư liệu không ra → trả về ảnh AI, sinh prompt bù.`, 'warn');

  // Gỡ cờ nguồn TRƯỚC khi sinh prompt: buildSceneGenPrompt đọc cờ này để quyết
  // viết lệnh vẽ hay viết mô tả đi tìm. Còn cờ thì nó lại viết mô tả tìm kiếm.
  ds.forEach(s => { s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; s.nguonVi = ''; });

  let ok = 0;
  for (const s of ds){
    if (state.cancelRequested) break;
    try { await genSingleScenePrompt(s.id); if (((state.scenePrompts || {})[s.id] || '').trim()) ok++; }
    catch (e){ /* cảnh lỗi thì bỏ, đừng chặn cả lượt */ }
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (_) {}
  try { if (typeof renderAllT2 === 'function') renderAllT2(); } catch (_) {}
  if (!imLang) setStatus2(`🩹 Đã sinh prompt bù cho ${ok}/${ds.length} cảnh không có tư liệu.`, ok ? 'ok' : 'info');
  return { cuu: ok, tong: ds.length };
}

async function genSingleScenePrompt(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  await genVideoLogline(false);
  const scene = state.scenes[idx];
  const profileContext = `Channel: ${p.tenKenh}\nNiche: ${p.ngach}\nPOV: ${p.povStyle}\nStructure: ${p.cauTruc}`;
  // Lấy cảnh ngay trước làm ngữ cảnh liên tục
  let prevSceneCtx = '';
  if (idx > 0) {
    const prev = state.scenes[idx - 1];
    const pp = state.scenePrompts[prev.id];
    if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
  }
  // Lời thoại cảnh trước + sau (để mượn bối cảnh nếu cảnh này thiếu hình)
  let neighborVO = '';
  const prevS = state.scenes[idx - 1];
  const nextS = state.scenes[idx + 1];
  if (prevS) neighborVO += `Previous scene [${prevS.id}]: "${(prevS.text || '').slice(0, 200)}"\n`;
  if (nextS) neighborVO += `Next scene [${nextS.id}]: "${(nextS.text || '').slice(0, 200)}"`;
  setStatus2(`Đang tạo lại prompt cảnh [${id}]...`, 'working');
  try {
    const prompt = buildSceneGenPrompt([scene], prevSceneCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt})
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      const reply = await callLLM(prompt, { maxTokens: 1000, _override: { thinking: false } });
      parsed = safeParseJSON(reply, vArr);
    }
    // Lấy prompt đầu tiên trả về (chỉ có 1 cảnh) — không phụ thuộc ID AI trả
    const got = parsed.find(x => x && x.prompt);
    const raw = got ? cleanPrompt(got.prompt) : '';
    if (raw && !_isLazyPrompt(raw)) {
      state.scenePrompts[id] = _ensureSceneTags(raw, scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo lại prompt cảnh [${id}].`, 'ok');
      saveState();
    } else {
      setStatus2(`⚠️ Cảnh [${id}] AI trả prompt lười/lỗi — bấm 🔧 Tạo lại lần nữa (hoặc đổi Claude).`, 'error');
    }
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function makeSafePrompt(id, which){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile.', 'error');
  const store = which === 'B' ? state.scenePrompts2 : state.scenePrompts;
  const original = store && store[id];
  if (!original) return setStatus2('Chưa có prompt để sửa.', 'error');

  setStatus2(`Đang làm mềm prompt [${id}${which === 'B' ? 'b' : ''}]...`, 'working');
  try {
    const prompt = `The image prompt below was REJECTED by a content filter (it contains death/violence/casualty content). REWRITE it so it passes the filter while KEEPING the same meaning, setting, style and camera angle.

REWRITE RULES:
- Remove every word: dead, death, dying, corpse, drowning, blood, gore, victim, suffering, kill, die
- Replace with indirect wording: peaceful, drifting, floating, eyes closed, cold, somber, quiet, still, distant, fading, motionless
- A dead/drowning person → "figure drifting peacefully in dark water, eyes closed, calm"
- Mass casualties → "vast empty dark scene, somber mood, distant scattered lights" (do NOT draw people)
- Keep unchanged: character names [in brackets], background names [in brackets], style, lighting, camera angle, color tone
- Keep roughly the same length

ORIGINAL PROMPT (blocked):
${original}

Return ONLY the rewritten prompt (in English), no explanation.`;
    const safe = await callClaude(prompt, 600);
    store[id] = safe.trim();
    renderPromptsV();
    saveState(true);
    setStatus2(`✓ Đã làm mềm prompt [${id}${which === 'B' ? 'b' : ''}] — thử gen lại trong G-Labs.`, 'ok');
  } catch (e) {
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

function addPromptB(id){
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  state.scenePrompts2[id] = '';
  renderPromptsV();
  saveState(true);
  // Tự động tạo prompt B ngay sau khi thêm
  genSingleScenePromptB(id);
}

async function genBatchPromptB(batch, p){
  const sceneBlocks = batch.map(s => {
    const promptA = cleanPrompt(state.scenePrompts[s.id] || '');
    const tag = _isInfographicShot(s.shot) ? ' [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]' : '';
    return `[${s.id}]${tag} (${s.duration}s)\nVO: "${s.text}"\nPrompt A: "${promptA}"`;
  }).join('\n\n');

  const sysPrompt = `You are a G-Labs prompt engineer. For EACH scene below, create Prompt B — the SECOND image of the SAME scene (shown right after Prompt A, splitting the duration in half).

Each Prompt B must:
- Use the same characters, setting and style as that scene's Prompt A
- KEEP the reference tags [character-name] and [background-name] EXACTLY as in Prompt A: if Prompt A has [dealer-male] [perfumed-room] then Prompt B MUST reuse exactly [dealer-male] [perfumed-room] (with brackets) — NEVER change them to "dealer-male", "the man", "the child"... (so G-Labs keeps characters/settings consistent with the reference sheet)
- Normal scenes: show the NEXT moment/action (second half) within the same scene.
- Scenes tagged [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]: do NOT draw a "next action". Instead draw a DIFFERENT ANGLE/COMPLEMENTARY PART of the same data (e.g. Prompt A shows the number/first half → Prompt B shows the remaining half or the conclusion), white background, mostly icons/shapes, VERY LITTLE text (at most a short title + a few numbers) — do NOT repeat Prompt A verbatim, do not stuff text.
- Same length & format as Prompt A (~60-100 words)
- In English, starting directly with the visual description

SCENES:
${sceneBlocks}

Return a JSON object keyed by scene id, value being Prompt B (in English). Example: {"007":"...","012":"..."}
Return ONLY JSON, no explanation, no reasoning.`;

  // callLLMJson: ép JSON + thinking off + validate (object có ≥1 value chuỗi cho id trong batch)
  // → chống DeepSeek xả nguyên đoạn suy luận vào prompt B
  const ids = new Set(batch.map(s => String(s.id).padStart(3, '0')));
  let obj;
  try {
    obj = await callLLMJson(sysPrompt, {
      maxTokens: 2500,
      validate: o => o && typeof o === 'object' && !Array.isArray(o)
        && Object.entries(o).some(([k, v]) => ids.has(String(k).padStart(3, '0')) && typeof v === 'string' && v.trim())
    });
  } catch (e) {
    // Hết cách ở dạng batch → thử từng cảnh (cũng đã JSON-hardened)
    for (const s of batch) {
      if (state.cancelRequested) break;
      await genSingleScenePromptB(s.id);
    }
    return;
  }

  // Chuẩn hoá key về 3 chữ số rồi gán đúng cảnh
  const norm = {};
  for (const [k, v] of Object.entries(obj)) norm[String(k).padStart(3, '0')] = v;
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  for (const s of batch) {
    const b = norm[s.id];
    if (b && typeof b === 'string' && b.trim()) {
      // B phải có ĐÚNG tag của A; nếu A thiếu thì backstop theo scene
      const aPrompt = state.scenePrompts[s.id] || '';
      state.scenePrompts2[s.id] = _ensureSceneTags(_mirrorTagsFromA(cleanPrompt(b.trim()), aPrompt), s);
    }
  }
}

function removePromptB(id){
  if (state.scenePrompts2) delete state.scenePrompts2[id];
  renderPromptsV();
  saveState(true);
}

async function genSingleScenePromptB(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const promptA = cleanPrompt(state.scenePrompts[id]);
  if (!promptA) return setStatus2(`Cần tạo Prompt A cho cảnh [${id}] trước.`, 'error');
  setStatus2(`Đang tạo Prompt B cảnh [${id}]...`, 'working');
  try {
    const sysPrompt = `You are a G-Labs prompt engineer. Based on the scene's Prompt A, create Prompt B for the SECOND HALF of that scene.
Prompt B must:
- Use the same characters, setting and style as Prompt A
- KEEP the reference tags [character-name] and [background-name] EXACTLY as in Prompt A: if Prompt A has [dealer-male] [perfumed-room] then Prompt B MUST reuse exactly [dealer-male] [perfumed-room] (with brackets) — NEVER change them to "dealer-male", "the man", "the child"... (so G-Labs keeps characters/settings consistent with the reference sheet)
- Show the NEXT action / state (after Prompt A ends)
- Same length and format as Prompt A (~60-100 words)
- In English, starting directly with the visual description

Scene VO: "${scene.text}"
Duration: ${scene.duration}s
Prompt A: "${promptA}"

Return ONLY 1 JSON object: {"prompt":"<Prompt B in English, starting directly with the visual description, no prefix>"}. No explanation, no reasoning, no prose outside the JSON.`;
    // callLLMJson: ép JSON + thinking off → chống DeepSeek xả suy luận thành prompt
    const got = await callLLMJson(sysPrompt, {
      maxTokens: 500,
      validate: o => o && typeof o.prompt === 'string' && o.prompt.trim().length > 20
    });
    const clean = cleanPrompt(String(got.prompt).trim());
    if (clean) {
      if (!state.scenePrompts2) state.scenePrompts2 = {};
      // B phải có ĐÚNG tag của A (cùng nhân vật + bối cảnh); backstop theo scene nếu A thiếu
      state.scenePrompts2[id] = _ensureSceneTags(_mirrorTagsFromA(clean, promptA), scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo Prompt B cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus2(`⚠️ Tạo Prompt B thất bại, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doGenerateScenePrompts(){
  _llmStep = 'prompt cảnh';
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');

  /* Chỉ tạo cảnh CHƯA có prompt → bấm lại sau khi Dừng sẽ chạy tiếp, không làm lại từ đầu.
     BỎ HẲN cảnh đã giao cho nguồn tư liệu: prompt của chúng KHÔNG được dùng ở đâu cả —
     đường stock và đường web đều tìm bằng LỜI THOẠI (generateSearchAngles(sc.text)),
     không đọc scenePrompts. Video 155 cảnh mà 90 cảnh dùng tư liệu thì đó là 90 lượt
     gọi AI viết ra thứ vứt đi. Cảnh nào tìm không ra hình sẽ được cứu ở bước sau
     (_t2CuuCanhTrong) — lúc đó mới sinh prompt, và chỉ cho đúng số cảnh cần.        */
  const _boQua = state.scenes.filter(_laThuc).length;
  const todo = state.scenes.filter(s => !_laThuc(s) && (!state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()));
  const already = state.scenes.length - todo.length - _boQua;
  if (todo.length === 0) {
    return setStatus2(_boQua
      ? `Không còn cảnh nào cần prompt — ${_boQua} cảnh dùng tư liệu có sẵn (không cần prompt), còn lại đã có.`
      : `Tất cả ${state.scenes.length} cảnh đã có prompt. Muốn tạo lại từ đầu? Bấm "🗑 Xoá hết" rồi tạo lại.`, 'info');
  }
  if (_boQua && typeof novaLog === 'function')
    novaLog(`✍️ Bỏ qua ${_boQua} cảnh dùng tư liệu có sẵn — không cần prompt ảnh.`, 'ok');

  // 🎯 Đảm bảo có logline (tự sinh lại nếu kịch bản đã đổi) → mọi cảnh bám chủ đề toàn video
  setStatus2('🎯 Kiểm tra logline toàn video...', 'working');
  await genVideoLogline(false);

  setStatus2(already > 0
    ? `Chạy tiếp: đã có ${already} prompt, còn ${todo.length} cảnh...`
    : 'AI đang sinh prompt ảnh...', 'working');
  clearCancel();
  const profileContext = `Channel: ${p.tenKenh}\nNiche: ${p.ngach}\nPOV: ${p.povStyle}\nStructure: ${p.cauTruc}`;

  // Ngữ cảnh cảnh ngay trước (giữ mạch hình ảnh liền lạc, tránh rời rạc)
  let prevSceneCtx = '';
  // Nếu chạy tiếp, lấy prompt cảnh ngay trước cảnh đầu tiên trong todo làm mồi
  if (todo.length && state.scenes.length) {
    const firstIdx = state.scenes.findIndex(s => s.id === todo[0].id);
    if (firstIdx > 0) {
      const prev = state.scenes[firstIdx - 1];
      const pp = state.scenePrompts[prev.id];
      if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
    }
  }

  // Xử lý 1 batch (độc lập). seedCtx = ngữ cảnh mồi (chỉ dùng khi chạy tuần tự).
  const processSceneBatch = async (batch, seedCtx) => {
    let neighborVO = '';
    const fi = state.scenes.findIndex(s => s.id === batch[0].id);
    const li = state.scenes.findIndex(s => s.id === batch[batch.length - 1].id);
    const bPrev = fi > 0 ? state.scenes[fi - 1] : null;
    const bNext = li >= 0 && li < state.scenes.length - 1 ? state.scenes[li + 1] : null;
    if (bPrev) neighborVO += `Cảnh trước batch [${bPrev.id}]: "${(bPrev.text || '').slice(0, 180)}"\n`;
    if (bNext) neighborVO += `Cảnh sau batch [${bNext.id}]: "${(bNext.text || '').slice(0, 180)}"`;
    const prompt = buildSceneGenPrompt(batch, seedCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt}) — chống DeepSeek nhét suy luận vào output
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      try {
        const reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
        parsed = safeParseJSON(reply, vArr);
      } catch (e) { if (attempt) throw e; }
    }
    // Vẫn hỏng mà lô còn nhiều cảnh → CHIA ĐÔI gọi lại (đệ quy tới từng cảnh) — mất 1 cảnh còn hơn mất cả lô.
    if (!parsed.length && batch.length > 1 && !state.cancelRequested) {
      const mid = Math.ceil(batch.length / 2);
      if (typeof novaLog === 'function') novaLog(`  ↻ Lô prompt ${batch[0].id}-${batch[batch.length - 1].id} hỏng — chia đôi thử lại…`, 'warn');
      await processSceneBatch(batch.slice(0, mid), seedCtx);
      if (!state.cancelRequested) await processSceneBatch(batch.slice(mid), seedCtx);
      return;
    }
    // CHỈ gán cho cảnh thuộc batch này → không đè nhầm cảnh khác
    const batchIds = batch.map(s => s.id);
    const batchIdSet = new Set(batchIds);
    parsed.forEach((x, idx) => {
      let id = String(x.id || '').padStart(3, '0');
      if (!batchIdSet.has(id)) id = batchIds[idx];   // AI trả ID sai → khớp theo vị trí
      if (id && batchIdSet.has(id) && x.prompt) {
        const sc = state.scenes.find(s => s.id === id);
        const raw = _forceStyleTail(cleanPrompt(x.prompt), p);   // đuôi style do APP gắn → 155 cảnh giống hệt
        if (_isLazyPrompt(raw)) return;   // prompt lười/placeholder → BỎ, để trống cho "Tạo nốt cảnh thiếu"
        state.scenePrompts[id] = _ensureSceneTags(raw, sc);
      }
    });
    renderPromptsV();
    const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
    setStatus2(`Tạo prompt... ${done}/${state.scenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
  };

  const lanes = Math.min(3, _concurrency());   // trần 3 luồng — nhiều hơn chỉ ăn 429 chứ không nhanh hơn
  const batches = [];
  for (let i = 0; i < todo.length; i += bs) batches.push(todo.slice(i, i + bs));

  try {
    if (lanes > 1) {
      // SONG SONG (nhiều key): chạy batch ĐẦU trước làm "mỏ neo" phong cách mở đầu,
      // rồi chạy các batch còn lại song song — mỗi batch tự lấy prompt cảnh NGAY TRƯỚC làm mồi NẾU đã có
      // → đỡ đứt tông ở mối nối batch. Mối nối sâu vẫn dựa vào 🎯 logline + VO lân cận.
      const seedFor = (b) => {
        const fi = state.scenes.findIndex(s => s.id === b[0].id);
        if (fi > 0) { const pv = state.scenes[fi - 1]; const pp = state.scenePrompts[pv.id]; if (pp && pp.trim()) return `[${pv.id}] ${pp.slice(0, 220)}`; }
        return '';
      };
      if (batches.length) await processSceneBatch(batches[0], prevSceneCtx);
      const rest = batches.slice(1);
      if (!state.cancelRequested && rest.length)
        await runConcurrent(rest, b => processSceneBatch(b, seedFor(b)), lanes, () => state.cancelRequested);
    } else {
      // TUẦN TỰ (1 key): giữ liên kết mạch hình ảnh giữa các batch
      for (const batch of batches) {
        if (state.cancelRequested) break;
        await processSceneBatch(batch, prevSceneCtx);
        for (let k = batch.length - 1; k >= 0; k--) {
          const pp = state.scenePrompts[batch[k].id];
          if (pp && pp.trim()) { prevSceneCtx = `[${batch[k].id}] ${pp.slice(0, 220)}`; break; }
        }
      }
    }
    if (state.cancelRequested) {
      clearCancel();
      const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
      setStatus2(`⏸ Đã dừng. Đã tạo ${done}/${state.scenes.length}. Bấm "Tạo Prompt ảnh" để chạy TIẾP từ chỗ dừng.`, 'info');
      saveState();
      return;
    }
    const finalMissing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
    setStatus2(finalMissing > 0
      ? `⚠️ Xong nhưng còn ${finalMissing} cảnh AI tạo lỗi. Bấm "🔧 Tạo nốt cảnh thiếu" lại, hoặc giảm Batch xuống 2-3 cho chắc.`
      : `✓ Đã sinh đủ ${state.scenes.length} prompt ảnh.`, finalMissing > 0 ? 'info' : 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

function loadAutoAudio(input){
  const f = input.files[0];
  if (!f) return;
  _autoAudioFile = f;
  _autoAudioWords = null;     // file mới → xoá cache
  const info = document.getElementById('autoSrtInfo');
  if (info) info.textContent = `✓ Đã đính audio: ${f.name} — Auto sẽ transcribe (Whisper) & căn timing.`;
  const clr = document.getElementById('autoSrtClear');
  if (clr) clr.style.display = 'inline-flex';
  input.value = '';
  // Refresh nút "Phân tích kịch bản": onchange gọi t2AudioInfo TRƯỚC khi _autoAudioFile được set ở đây → phải cập nhật lại nút.
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  // 💾 Lưu MP3 theo TỪNG video (IDB) + 🎙 tự đưa sang Dựng Video làm giọng đọc (như ảnh cảnh).
  _t2SaveVoicePerVideo(f);
  try { if (typeof t7HandleAudio === 'function') t7HandleAudio(f); } catch (e) {}
}

function _t2SaveVoicePerVideo(f){
  try {
    const uid = window.currentUser?.uid, p = (typeof getProfile === 'function') ? getProfile() : null;
    if (uid && p && p.profileId && f && typeof IDB !== 'undefined' && typeof _curVideoId === 'function'){
      IDB.set(uid + '/' + p.profileId + '/' + _curVideoId(p) + '/voiceMp3', f).catch(() => {});
    }
  } catch (e) {}
}

function _t2ResetTimingAudio(){
  _autoAudioFile = null; _autoAudioWords = null;
  try { _t2AudioDurCache = 0; } catch (e) {}
  try { if (typeof t8State === 'object' && t8State) t8State.audioFile = null; } catch (e) {}
  const nm = document.getElementById('t2AudioName'); if (nm) nm.textContent = 'Đính MP3 căn timing';
  const pill = document.getElementById('t2AudioPill'); if (pill){ pill.style.color = ''; pill.style.borderColor = ''; pill.style.background = ''; }
  const info = document.getElementById('autoSrtInfo'); if (info) info.textContent = '';
  const clr = document.getElementById('autoSrtClear'); if (clr) clr.style.display = 'none';
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  if (typeof t2UpdateCost === 'function') t2UpdateCost();
  if (typeof t2RenderTimingWarn === 'function') t2RenderTimingWarn();
}

function _t6VeoKey(prompt, model, dur, seed){
  const norm = String(prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return [norm.slice(0, 200), String(model || 'veo31-fast'), String(dur || 8), String(seed || '')].join('|');
}

function _t6VeoCacheGet(prompt, model, dur, seed){
  const k = _t6VeoKey(prompt, model, dur, seed);
  if (!k) return null;
  const hit = _t6VeoCache.get(k);
  if (hit) {
    hit.hits = (hit.hits || 0) + 1;
    try { if (typeof novaLog === 'function') novaLog('Veo cache HIT (lan ' + hit.hits + ')', 'ok'); } catch (_) {}
    return hit.blob;
  }
  return null;
}

function _t6VeoCachePut(prompt, model, dur, seed, blob){
  const k = _t6VeoKey(prompt, model, dur, seed);
  if (!k || !blob) return;
  _t6VeoCache.set(k, { blob, hits: 0, t: Date.now() });
  if (_t6VeoCache.size > _T6_VEO_MAX){
    const first = _t6VeoCache.keys().next().value;
    _t6VeoCache.delete(first);
  }
}

function _t6VeoCacheStats(){ return { size: _t6VeoCache.size, max: _T6_VEO_MAX }; }

function _whisperProviderAuto(){
  const groq = (localStorage.getItem('t8_key_groq') || '').trim();
  const oai = (localStorage.getItem('t8_key_openai') || '').trim();
  if (groq) return 'groq';
  if (oai) return 'openai';
  return 'local';
}

function _whisperKeyState(){
  const el = document.getElementById('setWhisperState'); if (!el) return;
  const prov = _whisperProviderAuto();
  el.innerHTML = prov === 'groq' ? '<span style="color:var(--green)">✓ Đang dùng Groq (nhanh, free)</span>'
    : prov === 'openai' ? '<span style="color:var(--green)">✓ Đang dùng OpenAI Whisper</span>'
    : '<span style="color:var(--amber)">● Chưa có key → chạy Local (không cần key, chậm hơn)</span>';
}

function saveWhisperKey(){
  const v = (document.getElementById('setWhisperKey')?.value || '').trim();
  try { if (v) localStorage.setItem('t8_key_groq', v); else localStorage.removeItem('t8_key_groq'); } catch (e) {}
  _whisperKeyState();
}

function saveWhisperKeyOpenai(){
  const v = (document.getElementById('setWhisperKeyOpenai')?.value || '').trim();
  try { if (v) localStorage.setItem('t8_key_openai', v); else localStorage.removeItem('t8_key_openai'); } catch (e) {}
  _whisperKeyState();
}

async function _autoAlignAudioOnce(){
  if (!_autoAudioFile) return null;
  if (!_autoAudioWords) {
    const prov = _whisperProviderAuto();   // có key → API (groq/openai); không → local
    setStatus2(`🎤 Đang transcribe audio (Whisper ${prov})...`, 'working');
    _autoAudioWords = (prov === 'local' && typeof t8TranscribeLocal === 'function')
      ? await t8TranscribeLocal(_autoAudioFile)
      : await t8TranscribeAPI(prov, _autoAudioFile);
  }
  if (!_autoAudioWords || !_autoAudioWords.length) return null;
  const results = t8AlignScenesToWords(state.scenes, _autoAudioWords);
  let upd = 0;
  results.forEach((r, i) => { if (r.newDur != null && state.scenes[i]){ state.scenes[i].duration = r.newDur; upd++; } });
  _t2KhopCuoi = { ti: results._khop, khop: results._khopTu, tong: results._tongTu, khi: Date.now() };
  if (results._khop < 0.6){
    try { novaLog('❌ Căn timing: chỉ ' + Math.round(results._khop * 100) + '% số từ trong kịch bản tìm thấy trong audio ('
      + results._khopTu + '/' + results._tongTu + '). Audio này rất có thể KHÔNG phải bản đọc của kịch bản đang mở — '
      + 'timing sẽ sai. Tạo lại giọng cho đúng kịch bản, hoặc nạp đúng file audio.', 'error'); } catch (_){}
  }
  try { t2RenderTimingWarn(); } catch (_){}
  const bo = results.filter(r => r.hong);
  if (bo.length){
    try {
      novaLog('⚠️ Căn timing: bỏ ' + bo.length + '/' + results.length + ' cảnh có mốc thời gian vô lý (Whisper trả timestamp nhảy cóc). '
        + bo.slice(0, 3).map(r => 'cảnh ' + r.id + ' ' + r.hong + 's thay vì ~' + r.uoc + 's').join(', ')
        + (bo.length > 3 ? '…' : '') + ' — mấy cảnh này giữ thời lượng ước theo văn bản.', 'warn');
    } catch (_){}
  }
  renderAllT2();
  return upd;
}

function _autoStepsAll(){
  return document.getElementById('autoFlowImages')?.checked
    ? AUTO_STEPS.concat(FLOW_STEPS)
    : AUTO_STEPS;
}

function _autoRenderSteps(){
  const bar = document.getElementById('autoBar');
  if (!bar) return;
  bar.innerHTML = _autoStepsAll().map((s, i) =>
    `<span class="auto-step" id="autoStep-${i}"><b>${i + 1}</b>&nbsp;${s.label}</span>`
  ).join('<span class="auto-arrow">→</span>');
}

function _autoSetStep(idx, status){
  const el = document.getElementById('autoStep-' + idx);
  if (!el) return;
  el.classList.remove('active', 'done', 'skip', 'fail');
  if (status) el.classList.add(status);
}

function _autoSetStepLabel(idx, text){
  const el = document.getElementById('autoStep-' + idx);
  if (el) el.innerHTML = `<b>${idx + 1}</b>&nbsp;${text}`;
}

function _toggleAutoUI(running){
  const auto = document.getElementById('autoRunBtn');
  const stop = document.getElementById('autoStopBtn');
  const bar  = document.getElementById('autoBar');
  if (auto) auto.style.display = running ? 'none' : 'inline-flex';
  if (stop) stop.style.display = running ? 'inline-flex' : 'none';
  if (bar && running) bar.style.display = 'flex';  // hiện khi chạy, GIỮ lại sau khi xong để thấy ✓
}

function stopAutoTool2(){
  if (!_autoRunning) return;
  _autoStopFlag = true;
  requestCancel();  // báo cho các vòng lặp AI (Prompt ảnh / Ảnh B) dừng
  setStatus2('⏸ Đang dừng sau bước hiện tại...', 'info');
}

function syncTool2(){
  const g = id => document.getElementById(id);
  state.script = g('scriptInput')?.value || '';
  state.minChars = parseInt(g('minChars')?.value) || 30;
  state.maxChars = parseInt(g('maxChars')?.value) || 150;
  state.splitMode = g('splitMode')?.value || 'smart';
  // ⛔ KHÔNG đọc ngược charsInputV / bgInputV nữa.
  // Hai ô đó là DI TÍCH của bản Tool 2 cũ, giờ nằm trong .prescan{display:none} —
  // không ai gõ được vào, chỉ có code ghi state → ô. Đọc ngược thành vòng luẩn quẩn:
  //   _collectCastToAssets() lập dàn nhân vật/bối cảnh từ storyboard (dòng ~12349)
  //   → KHÔNG cập nhật hai ô ẩn
  //   → syncTool2() chạy ngay sau đó (12415 / 12457 / 12536) đọc ô ẩn RỖNG
  //   → state.charactersV = []  ← "tạo xong rồi tự nhiên mất"
  // Không chỗ nào khác đọc hai ô này, nên bỏ đọc là hết vòng lặp; state là nguồn duy nhất.
  const dmEl = g('t2DescMode');
  state.descMode = dmEl ? dmEl.value : (state.descMode || 'tag');   // mặc định tag (khoá mặt) khi UI đã bỏ
}

function _normalizeScenesShots(){
  const ok = (typeof _shotAllowed === 'function') ? _shotAllowed() : null; if (!ok) return 0;
  let n = 0;
  (state.scenes || []).forEach(s => { const sh = String(s.shot || '').trim().toLowerCase(); if (sh && sh !== 'scene' && !ok.has(sh)){ s.shot = 'scene'; n++; } });
  return n;
}

function renderAllT2(){
  try { const _n = _normalizeScenesShots(); if (_n && typeof novaLog === 'function') novaLog(`🎬 ${_n} cảnh dùng kiểu đã tắt → đưa về "Kể chuyện".`, 'warn'); } catch (e) {}
  renderPreview(); renderTable(); renderSceneTimeline(); renderPromptsV(); renderStats2(); updateScriptCount(); renderSceneTypeToggles();
  if (typeof renderT2Assets === 'function') renderT2Assets();
  if (typeof t2UpdateCost === 'function') t2UpdateCost();
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  if (typeof t2RenderTimingWarn === 'function') t2RenderTimingWarn();
  const si = document.getElementById('statSceneImg'); if (si) si.textContent = Object.keys(state.sceneImages || {}).length + ' / ' + ((state.scenes || []).length || 0);
  // Tổng hợp cảnh cần xem lại (như "62 scene · 62 cần xem lại" của web đối thủ)
  try {
    const el = document.getElementById('statScenes');
    if (el && (state.scenes || []).length){
      const n = _t2WarnCount();
      const bd = _t2WarnBreakdown();
      const tip = bd.map(([k, v]) => `${v} cảnh: ${k}`).join('\n') || 'Không có cảnh báo';
      const top = bd.length ? bd[0][0] : '';
      el.innerHTML = (state.scenes.length) + (n
        ? ` <span title="${escapeHtml(tip)}" style="font-size:11px;color:var(--amber);font-weight:600">· ${n} cần xem lại</span>`
          + (top ? `<div style="font-size:10.5px;color:var(--text-dim);font-weight:400;margin-top:3px;line-height:1.4">chủ yếu: ${escapeHtml(top)}${bd.length > 1 ? ` · +${bd.length - 1} loại khác` : ''}</div>` : '')
        : '');
    }
  } catch (e) {}
}

function _shotBadge(shot){
  const k = SCENE_TYPES[shot] ? shot : 'scene'; const t = SCENE_TYPES[k];
  const vi = (typeof SCENE_TYPE_VI !== 'undefined' && SCENE_TYPE_VI[k]) || k;
  return `<span title="${t.vi}" style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;color:${t.color};background:${t.color}22;white-space:nowrap">${vi}</span>`;
}

function renderSceneTimeline(){
  const el = document.getElementById('sceneTimeline'); if (!el) return;
  el.style.display = 'none'; el.innerHTML = ''; return;   // Đã bỏ dòng thời gian theo yêu cầu
  const sc = state.scenes || [];
  if (!sc.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  const bars = sc.map(s => {
    const t = SCENE_TYPES[s.shot] || SCENE_TYPES.scene; const w = Math.max(0.5, parseFloat(s.duration) || 1);
    return `<i title="#${s.id} · ${SCENE_TYPES[s.shot] ? s.shot : 'scene'} · ${w}s" onclick="_tlJump('${s.id}')" style="flex:${w};background:${t.color};min-width:3px;cursor:pointer;transition:filter .12s" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter=''"></i>`;
  }).join('');
  const present = [...new Set(sc.map(s => SCENE_TYPES[s.shot] ? s.shot : 'scene'))];
  const legend = present.map(k => { const t = SCENE_TYPES[k]; return `<span style="display:inline-flex;align-items:center;gap:4px"><b style="width:9px;height:9px;border-radius:2px;background:${t.color};display:inline-block"></b>${k}</span>`; }).join('');
  const tot = sc.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
  const mm = Math.floor(tot / 60), ss = Math.round(tot % 60);
  el.innerHTML = `<div style="font-family:ui-monospace,monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Dòng thời gian · ${sc.length} cảnh · ${mm}:${String(ss).padStart(2, '0')}</div>
    <div style="display:flex;gap:1px;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--border)">${bars}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-family:ui-monospace,monospace;font-size:10px;color:var(--text-muted)">${legend}</div>`;
}

function _tlJump(id){
  const row = document.querySelector('#sceneBody tr[data-sid="' + id + '"]');
  if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); const o = row.style.background; row.style.transition = 'background .3s'; row.style.background = 'var(--accent-soft)'; setTimeout(() => { row.style.background = o; }, 1000); }
}

function renderSceneTypeToggles(){
  const box = document.getElementById('sceneTypeToggles'); if (!box) return;
  if (!Array.isArray(state.sceneTypesOn) || !state.sceneTypesOn.length) state.sceneTypesOn = SCENE_TYPES_CORE.slice();
  const optional = Object.keys(SCENE_TYPES).filter(k => !SCENE_TYPES[k].core);
  box.innerHTML = optional.map(k => {
    const t = SCENE_TYPES[k]; const on = state.sceneTypesOn.includes(k);
    const vi = SCENE_TYPE_VI[k] || k;
    return `<button type="button" onclick="toggleSceneType('${k}')" title="${t.vi} — bật để AI dùng kiểu cảnh này khi hợp" style="font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:99px;cursor:pointer;border:1px solid ${on ? t.color : 'var(--border-2)'};color:${on ? '#fff' : 'var(--text-muted)'};background:${on ? t.color : 'transparent'}">${on ? '✓ ' : '+ '}${vi}</button>`;
  }).join('');
}

function toggleSceneType(k){
  if (!SCENE_TYPES[k] || SCENE_TYPES[k].core) return;
  if (!Array.isArray(state.sceneTypesOn) || !state.sceneTypesOn.length) state.sceneTypesOn = SCENE_TYPES_CORE.slice();
  const i = state.sceneTypesOn.indexOf(k);
  const turningOff = i >= 0;
  if (turningOff) state.sceneTypesOn.splice(i, 1); else state.sceneTypesOn.push(k);
  const vi = SCENE_TYPE_VI[k] || k;
  // Tắt kiểu nào thì các cảnh ĐANG dùng kiểu đó về "Kể chuyện" luôn — không để bảng còn nhãn của kiểu đã tắt.
  let moved = 0;
  if (turningOff) { try { moved = _normalizeScenesShots(); } catch (e) {} }
  renderSceneTypeToggles(); if (typeof saveState === 'function') saveState();
  if (moved){
    if (typeof renderAllT2 === 'function') renderAllT2();
    setStatus2(`✓ Tắt kiểu "${vi}" — đã đưa ${moved} cảnh về "Kể chuyện". Prompt cũ vẫn tả theo kiểu cũ → bấm 🔧 Tạo lại tất cả prompt nếu muốn vẽ lại.`, 'ok');
  } else {
    setStatus2(`✓ ${turningOff ? 'Tắt' : 'Bật'} kiểu cảnh "${vi}" cho lần Phân tích kịch bản tới.`, 'info');
  }
}

function _splitCharNames(str){
  return String(str || '').split(/\s*(?:,|;|\/|&|\+|\band\b|\bvà\b|\bcùng\b)\s*/i).map(s => s.replace(/\[.*?\]/g, '').trim()).filter(Boolean);
}

function _isCrowdName(n){ n = String(n || '').trim(); if (!n) return true; if (_CROWD_RE.test(n)) return true; if (n.split(/\s+/).length > 4) return true; return false; }

function _isComboName(n){ return /[,;/&+]| and | và /i.test(String(n || '')); }

function _collectCastToAssets(){
  // Đếm số cảnh mỗi NHÂN VẬT RIÊNG xuất hiện (đã tách chuỗi ghép) → giữ MỌI nhân vật có tên (kể cả 1 lần), chỉ bỏ quần chúng + combo.
  const freq = {}; const bgFreq = {};
  for (const s of (state.scenes || [])) {
    const seen = new Set();
    for (const nm of _splitCharNames(s.character)) {
      if (_isCrowdName(nm)) continue;
      const k = nm.toLowerCase();
      if (!seen.has(k)) { seen.add(k); (freq[k] = freq[k] || { n: nm, c: 0 }).c++; }
    }
    const b = String(s.background || '').trim();
    if (b && !_isCrowdName(b)) (bgFreq[b.toLowerCase()] = bgFreq[b.toLowerCase()] || { n: b, c: 0 }).c++;
  }
  // GIỮ nơi chốn xương sống (≥2 cảnh); nơi dùng 1 lần → gỡ khỏi cảnh + bỏ ngoặc
  // trong prompt, nếu không tag sẽ trỏ vào asset không tồn tại (không có ảnh ref).
  const locSeen = Object.values(bgFreq).filter(x => x.c >= _T2_BG_MIN).map(x => x.n);
  const oneOff = new Set(Object.values(bgFreq).filter(x => x.c < _T2_BG_MIN).map(x => x.n.toLowerCase()));
  let dropped = 0;
  if (oneOff.size){
    for (const s of (state.scenes || [])){
      const b = String(s.background || '').trim();
      if (!b || !oneOff.has(b.toLowerCase())) continue;
      s.background = '';
      dropped++;
      ['scenePrompts', 'scenePrompts2'].forEach(key => {
        const cur = (state[key] || {})[s.id];
        if (!cur) return;
        // bỏ ngoặc, giữ nguyên chữ → prompt vẫn tả đúng nơi đó
        const re = new RegExp('\\[\\s*' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\]', 'gi');
        state[key][s.id] = cur.replace(re, b);
      });
    }
    if (typeof novaLog === 'function') novaLog(`🏠 Bối cảnh: giữ ${locSeen.length} nơi lặp lại (≥${_T2_BG_MIN} cảnh), bỏ ${oneOff.size} nơi dùng 1 lần ở ${dropped} cảnh — tả thẳng trong prompt, khỏi tạo ảnh tham chiếu.`, 'ok');
  }
  const cast = Object.values(freq).filter(x => x.c >= 1).map(x => x.n);   // giữ MỌI nhân vật có tên (kể cả 1 lần) — theo web tool; chỉ quần chúng/combo bị loại (đã lọc ở trên)
  const strip = x => String(x).replace(/\s*\[.*?\]\s*$/, '').trim();
  const mergeUniq = (arr, add) => { const a = Array.isArray(arr) ? arr.slice() : []; const seen = new Set(a.map(strip)); add.forEach(x => { if (x && !seen.has(strip(x))) { a.push(x); seen.add(strip(x)); } }); return a; };
  const keepExisting = (state.charactersV || []).filter(n => !_isComboName(n) && !_isCrowdName(n));   // giữ nhân vật CÁ NHÂN đã có, bỏ combo cũ
  state.charactersV = mergeUniq(keepExisting, cast);
  state.backgroundsV = mergeUniq((state.backgroundsV || []).filter(n => !_isCrowdName(n)), locSeen);
}

function _t2AssetCard(a, kind){
  const store = kind === 'char' ? (state.characterImages || {}) : (state.backgroundImages || {});
  const src = (typeof _tfImgSrc === 'function') ? _tfImgSrc(store[a.name]) : (store[a.name]?.base64 || '');
  const njs = String(a.name).replace(/['\\]/g, '\\$&');
  const nmColor = kind === 'char' ? 'var(--violet)' : 'var(--teal)';
  const pic = src
    ? `<div style="aspect-ratio:4/3;background:#0002 center/cover;cursor:zoom-in;position:relative" onclick="tfEnlargeAsset('${kind}','${njs}')">
         <img src="${src}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div style="aspect-ratio:4/3;background:var(--surface-2);border-bottom:1px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--text-muted)">
         <span style="font-size:24px;opacity:.6">${kind === 'char' ? '👤' : '🏞'}</span>
         ${a.prompt ? `<button class="btn primary sm" style="font-size:10.5px;padding:3px 9px" onclick="t2RegenAsset('${kind}','${njs}')">✨ Tạo ảnh</button>` : '<span style="font-size:10px">cần prompt</span>'}</div>`;
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">
    ${pic}
    <div style="padding:6px 8px">
      <div style="font-size:11px;font-weight:700;color:${nmColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div>
      <div style="font-size:9.5px;color:var(--text-muted);line-height:1.35;margin-top:3px;max-height:26px;overflow:hidden">${escapeHtml((a.prompt || '').slice(0, 90) || '—')}</div>
      <div style="display:flex;gap:4px;margin-top:6px">
        ${src ? `<button class="btn ghost sm" style="padding:2px 7px;font-size:11px" onclick="t2RegenAsset('${kind}','${njs}')" title="Làm lại">🔄</button>` : ''}
        <label class="btn ghost sm" style="padding:2px 7px;font-size:11px;cursor:pointer" title="Tải ảnh">📎<input type="file" accept="image/*" style="display:none" onchange="t2UploadAsset('${kind}','${njs}',this.files[0]);this.value=''"></label>
      </div>
    </div></div>`;
}

function renderT2Assets(){
  const grid = document.getElementById('t2AssetGrid'); if (!grid) return;
  const chars = (typeof tfAssetList === 'function') ? tfAssetList('char') : [];
  const bgs = (typeof tfAssetList === 'function') ? tfAssetList('bg') : [];
  const badge = document.getElementById('badge-assets'); if (badge) badge.textContent = chars.length + bgs.length;
  const info = document.getElementById('t2AssetInfo');
  const ci = state.characterImages || {}, bi = state.backgroundImages || {};
  const nHave = chars.filter(a => ci[a.name]).length + bgs.filter(a => bi[a.name]).length;
  if (info) info.textContent = `${nHave}/${chars.length + bgs.length} đã có ảnh`;
  let html = '';
  html += `<div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--text-muted);margin:2px 0">👤 Nhân vật · ${chars.filter(a => ci[a.name]).length}/${chars.length} có ảnh</div>` + chars.map(a => _t2AssetCard(a, 'char')).join('');
  html += `<div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--text-muted);margin:8px 0 2px">🏞 Bối cảnh · ${bgs.filter(a => bi[a.name]).length}/${bgs.length} có ảnh</div>` + bgs.map(a => _t2AssetCard(a, 'bg')).join('');
  grid.innerHTML = html;
}

function _flowStOk(st){
  if (!st || st.error) return false;
  const accs = Array.isArray(st.accounts) ? st.accounts : [];
  // Tài khoản DÙNG ĐƯỢC = bật + KHÔNG cần đăng nhập lại + (có token hoặc là account Chrome).
  const usable = accs.filter(a => a.enabled !== false && !a.needLogin && (a.hasToken || a.engine === 'chrome'));
  if (usable.length > 0) return true;
  if (accs.length && accs.every(a => a.needLogin)) return false;   // MỌI tài khoản cần ĐN lại → chưa sẵn sàng (báo đúng)
  return !!st.hasToken || (st.accountCount || 0) > 0;   // extension không kèm chi tiết per-account → dựa mức tổng thể
}

async function _t2FlowReady(){
  try {
    if (typeof flowBridge === 'undefined') return false;
    await flowBridge.waitReady(1500);
    if (_flowStOk(await flowBridge.call('GET_STATUS'))) return true;
    // Dự phòng: tài khoản Chrome for Testing do engine NATIVE quản (hiện cả khi đang chọn chế độ extension) → hỏi thẳng native.
    try { if (window.native && typeof window.native.flow === 'function' && _flowStOk(await window.native.flow('GET_STATUS'))) return true; } catch (e) { /* bỏ qua */ }
    return false;
  } catch (e) { return false; }
}

function renderPreview(){
  const box = document.getElementById('previewBox');
  const cnt = document.getElementById('previewCount');
  if (!box) return;
  cnt.textContent = state.scenes.length + ' cảnh';
  if (state.scenes.length === 0) {
    box.innerHTML = '<div class="empty-state">Bấm Chia Cảnh để tách kịch bản.</div>';
    return;
  }
  box.innerHTML = state.scenes.slice(0, 8).map(s =>
    `<div class="preview-scene"><span class="pid">[${s.id}]</span><span class="ptag">${s.level}</span><div class="ptext">${escapeHtml(s.text)}</div></div>`
  ).join('') + (state.scenes.length > 8 ? `<div class="empty-state" style="padding:10px">+${state.scenes.length - 8} cảnh nữa</div>` : '');
}

function _t2RegenBar(){
  const el = document.getElementById('t2RegenQInfo');
  if (el){
    const nq = _t2RegenPending.size;
    if (_t2RegenRunning || nq){ el.style.display = ''; el.style.cursor = 'pointer'; el.title = 'Bấm để ẩn/hiện khung ảnh đang tạo lại'; el.onclick = () => { _t2RegenPanelOpen = !_t2RegenPanelOpen; _t2RenderRegenPanel(); }; el.textContent = '⚡ tạo lại ' + _t2RegenDone + '/' + Math.max(_t2RegenTotal, _t2RegenDone + _t2RegenErr + nq) + (nq ? ' · +' + nq + ' chờ' : '') + (_t2RegenErr ? ' · ' + _t2RegenErr + ' lỗi' : ''); }
    else el.style.display = 'none';
  }
  _t2RenderRegenPanel();
}

function _t2RegenKeyParts(key){ const isB = String(key).endsWith('::b'); return { id: isB ? String(key).slice(0, -3) : String(key), isB }; }

function _t2RenderRegenPanel(){
  let box = document.getElementById('t2RegenPanel');
  if (!_t2RegenSeen.size){ if (box) box.remove(); return; }
  if (!box){
    box = document.createElement('div'); box.id = 't2RegenPanel';
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;width:340px;max-height:64vh;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 40px -10px rgba(0,0,0,.5);z-index:9500;overflow:hidden;font-size:12px';
    document.body.appendChild(box);
  }
  const items = Array.from(_t2RegenSeen.entries());
  const done = items.filter(([, v]) => v === 'done').length;
  const err = items.filter(([, v]) => v === 'err').length;
  const running = _t2RegenRunning || _t2RegenPending.size;
  const head = `<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);font-weight:700">
    <span>🔄 Ảnh tạo lại · ${done}/${items.length}${err ? ` · <span style="color:var(--red)">${err} lỗi</span>` : ''}${running ? ' · đang chạy…' : ''}</span>
    <button onclick="_t2RegenPanelOpen=!_t2RegenPanelOpen;_t2RenderRegenPanel()" style="margin-left:auto;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:14px" title="Thu/mở">${_t2RegenPanelOpen ? '▽' : '△'}</button>
    ${running ? '' : `<button onclick="_t2RegenSeen.clear();_t2RenderRegenPanel()" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:14px" title="Đóng khung">✕</button>`}
  </div>`;
  if (!_t2RegenPanelOpen){ box.innerHTML = head; return; }
  const grid = items.map(([key, st]) => {
    const { id, isB } = _t2RegenKeyParts(key);
    const img = (isB ? state.sceneImagesB : state.sceneImages)?.[id]?.base64;
    const badge = st === 'done' ? '<span style="color:var(--green)">✓</span>' : st === 'err' ? '<span style="color:var(--red)">✗</span>' : '<span style="color:var(--amber)">⏳</span>';
    const thumb = img
      ? `<img src="${img}" style="width:100%;height:66px;object-fit:cover;display:block" onclick="t2EnlargeSceneImage('${id}'${isB ? ",'b'" : ''})" title="Bấm xem ảnh to">`
      : `<div style="width:100%;height:66px;display:grid;place-items:center;background:var(--surface-2);color:var(--text-dim)">${st === 'err' ? '✗' : '⏳'}</div>`;
    return `<div style="border:1px solid var(--border-2);border-radius:8px;overflow:hidden">${thumb}<div style="display:flex;align-items:center;gap:5px;padding:3px 6px"><b>${escapeHtml(id)}${isB ? '·B' : ''}</b> ${badge}<button onclick="event.stopPropagation();t2QueueRegen('${id}'${isB ? ",'b'" : ''})" style="margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:12px" title="Tạo lại nữa">🔄</button></div></div>`;
  }).join('');
  box.innerHTML = head + `<div style="padding:8px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:7px">${grid}</div>`;
}

async function _t2StartRegenPool(){
  if (_t2RegenSetup){ _t2RegenFill(); return; }   // pool đã sẵn sàng → chỉ bơm thêm worker cho item mới
  _t2RegenSetup = true; _t2RegenRunning = true;
  const _fail = (msg, clear) => { _t2RegenSetup = false; _t2RegenRunning = false; if (_t2RegenOwn){ tfState.running = false; _t2RegenOwn = false; } if (clear) _t2RegenPending.clear(); if (msg) setStatus2(msg, 'error'); _t2RegenBar(); };
  try {
    if (typeof tfGenScenes !== 'function'){ _fail(); return; }
    if (tfState.running){ _t2RegenSetup = false; _t2RegenRunning = false; setStatus2('Đang chạy mẻ tạo ảnh khác — hàng đợi sẽ tự chạy khi xong.', 'working'); setTimeout(_t2StartRegenPool, 1500); return; }
    if (!(await flowBridge.waitReady(1500))){ _fail('Chưa kết nối Flow — vào Cài đặt bật/đăng nhập tài khoản Flow.', true); return; }
    const st = await flowBridge.call('GET_STATUS');
    if (!_flowStOk(st)){ _fail('Chưa kết nối Flow (chưa có token). Vào Cài đặt → Tài khoản Flow.', true); return; }
    tfState.running = true; _t2RegenOwn = true; tfState.stop = false;
    _t2RegenDone = 0; _t2RegenErr = 0; _t2RegenTotal = _t2RegenPending.size;
    const cfg = tfCfg();
    const useRefs = !!document.getElementById('tfUseRefs')?.checked;
    const imgMap = tfAssetImageMap();
    const multi = (st.accountCount || 0) > 1;
    _t2RegenConc = multi ? Math.max(1, st.accountCount) : (cfg.conc || 1);
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET'); else projectId = await tfEnsureProject();
    if (typeof novaLog === 'function'){ novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc'); novaLog('▶ TẠO LẠI ảnh cảnh (hàng đợi)' + (multi ? ' · xoay ' + st.accountCount + ' tài khoản' : ''), 'acc'); }
    _t2RegenCtx = { multi, cfg, imgMap, projectId, tier: st.paygateTier, useRefs };
    _t2RegenFill();
    if (_t2RegenWorkers === 0) _t2RegenPoolDone();   // bấm Dừng/hàng rỗng ngay lúc setup → dọn pool, không kẹt cờ
  } catch (e){ _fail('Lỗi hàng đợi tạo lại: ' + (e.message || e), false); }
}

function _t2RegenFill(){
  if (!_t2RegenSetup || !_t2RegenCtx || tfState.stop) return;
  const want = Math.min(_t2RegenConc, _t2RegenPending.size + _t2RegenWorkers);
  while (_t2RegenWorkers < want){ _t2RegenWorkers++; _t2RegenWorker(); }
  _t2RegenBar();
}

async function _t2RegenWorker(){
  try {
    while (_t2RegenPending.size && !tfState.stop){
      const key = _t2RegenPending.values().next().value; _t2RegenPending.delete(key);
      const isB = String(key).endsWith('::b'); const id = isB ? String(key).slice(0, -3) : String(key);
      _t2RegenBar();
      const ok = await _t2RegenOne(id, _t2RegenCtx, isB ? 'b' : 'a');
      if (ok) _t2RegenDone++; else _t2RegenErr++;
      _t2RegenSeen.set(key, ok ? 'done' : 'err');
      setStatus2('🎨 Tạo lại: ' + _t2RegenDone + ' xong' + (_t2RegenErr ? ' · ' + _t2RegenErr + ' lỗi' : '') + (_t2RegenPending.size ? ' · còn ' + _t2RegenPending.size : ''), 'working');
      _t2RegenBar();
    }
  } catch (e){ _t2RegenErr++; if (typeof novaLog === 'function') novaLog('❌ worker tạo lại lỗi: ' + (e.message || e), 'err'); }
  finally {
    _t2RegenWorkers--;
    if (_t2RegenWorkers <= 0) _t2RegenPoolDone();
  }
}

function _t2RegenPoolDone(){
  if (!tfState.stop && _t2RegenPending.size){ _t2RegenFill(); return; }   // có item mới lọt vào → bơm lại, CHƯA đóng pool
  _t2RegenSetup = false; _t2RegenRunning = false;
  if (_t2RegenOwn){ tfState.running = false; _t2RegenOwn = false; }
  if (typeof novaLog === 'function') novaLog('━━━ ✔ Tạo lại xong · ' + _t2RegenDone + (_t2RegenErr ? ' · ' + _t2RegenErr + ' lỗi' : '') + ' ━━━', _t2RegenErr ? 'warn' : 'ok');
  try { saveState(true); } catch (e) {}
  if (typeof tfRenderScenes === 'function') tfRenderScenes();
  setStatus2('✓ Đã tạo lại ' + _t2RegenDone + ' cảnh' + (_t2RegenErr ? ' · ' + _t2RegenErr + ' lỗi' : ''), _t2RegenErr ? 'error' : 'ok');
  _t2RegenBar();
}

async function _t2RegenOne(id, ctx, variant){
  const isB = variant === 'b';
  const prompt = isB ? state.scenePrompts2?.[id] : state.scenePrompts?.[id];
  if (!prompt || !String(prompt).trim()) return false;
  const _lbl = 'Cảnh ' + id + (isB ? ' B' : '');
  if (typeof novaLog === 'function') novaLog('🖼 ' + _lbl + ' · tạo lại → đang tạo…', 'acc');
  try {
    const refNames = ctx.useRefs ? tfExtractRefNames(prompt, ctx.imgMap) : [];
    let r, e0, _att = 0;
    while (true){
      r = await tfDispatchGen(cleanPrompt(_t2WithPalette(prompt)), refNames, { multi: ctx.multi, cfg: ctx.cfg, imgMap: ctx.imgMap, projectId: ctx.projectId, tier: ctx.tier });
      e0 = (r?.media_entries || []).find(e => e.dataUrl);
      // Lỗi MỀM (Internal error / mạng / Google chặn traffic / token chập) → tự thử lại (dispatch tự xoay tài khoản). Không retry: quota / bị lọc.
      const soft = !e0 && r?.error && !_isQuotaErr(r.error) && !/FILTER|SAFETY|PROMINENT|MODEL_ACCESS/i.test(String(r.error));
      const traffic = /TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki|UNAUTHENT|API_401/i.test(String(r?.error || ''));
      if (e0 || !soft || _att >= (traffic ? 3 : 2) || tfState.stop) break;
      _att++;
      const wait = traffic ? (6000 + _att * 4000) : 1500;
      if (typeof novaLog === 'function') novaLog('↻ ' + _lbl + ' lỗi mềm (' + _bulkFriendlyErr(String(r.error)) + ') → nghỉ ' + Math.round(wait / 1000) + 's thử lại lần ' + _att + '…', 'warn');
      await new Promise(res => setTimeout(res, wait));
    }
    if (r?.error || !e0){ if (typeof novaLog === 'function'){ const q = _isQuotaErr(r?.error || ''); novaLog((q ? '⚠️ ' : '❌ ') + _lbl + ' · ' + (r?.error ? _bulkFriendlyErr(String(r.error)) : 'không có ảnh trả về (token hết hạn? bị lọc?)'), q ? 'warn' : 'err'); } return false; }
    const store = isB ? (state.sceneImagesB || (state.sceneImagesB = {})) : (state.sceneImages || (state.sceneImages = {}));
    store[id] = { base64: e0.dataUrl, mediaType: e0.mime || 'image/png', fileName: 'scene-' + id + (isB ? 'b' : '') + '.png' };
    autoSaveSceneImage(id, isB, e0.dataUrl, e0.mime);
    _t2UpdateRowThumb(id);
    if (typeof novaLog === 'function') novaLog('✅ ' + _lbl + ' · tài khoản ' + (r?.account || '?') + ' · xong', 'ok');
    return true;
  } catch (e){ if (typeof novaLog === 'function') novaLog('❌ ' + _lbl + ' · ' + (e.message || e), 'err'); return false; }
}

function _t2MarkQueued(id){
  try {
    const wrap = document.querySelector('#sceneBody tr[data-sid="' + id + '"] td[style*="text-align:center"] > div');
    if (wrap && !wrap.querySelector('.t2qbadge')){
      wrap.style.position = 'relative';
      const b = document.createElement('div'); b.className = 't2qbadge';
      b.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);color:#fff;font-size:15px;border-radius:6px;pointer-events:none';
      b.textContent = '⏳'; wrap.appendChild(b);
    }
  } catch (e) {}
}

function _t2Thumb(sceneId, variant, base64, w, h, showBadge){
  const isB = variant === 'b';
  const badge = showBadge ? `<span style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;line-height:1.3">${isB ? 'B' : 'A'}</span>` : '';
  const regenBtn = `<button onclick="event.stopPropagation();t2QueueRegen('${sceneId}'${isB ? ",'b'" : ''})" style="position:absolute;top:2px;left:2px;background:rgba(0,0,0,.7);color:#fff;border:none;width:18px;height:18px;border-radius:50%;font-size:10px;cursor:pointer;line-height:1;padding:0" title="Tạo lại RIÊNG ảnh ${isB ? 'B' : 'A'} này — tự xếp vào hàng đợi">🔄</button>`;
  const delBtn = `<button onclick="event.stopPropagation();t2RemoveSceneImage('${sceneId}'${isB ? ",'b'" : ''})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;border:none;width:18px;height:18px;border-radius:50%;font-size:12px;cursor:pointer;line-height:1;padding:0" title="Xoá ảnh">×</button>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;border-radius:7px;overflow:hidden;cursor:zoom-in;background:var(--surface-2);flex:0 0 auto" onclick="t2EnlargeSceneImage('${sceneId}'${isB ? ",'b'" : ''})" title="Bấm xem ảnh to"><img src="${base64}" style="width:100%;height:100%;object-fit:cover">${regenBtn}${delBtn}${badge}</div>`;
}

function _t2SceneImgCell(s){
  const a = state.sceneImages?.[s.id];
  const b = state.sceneImagesB?.[s.id];
  if (!a && !b){
    return `<label class="sb-drop" style="display:flex;align-items:center;justify-content:center;width:300px;height:170px;border:1.5px dashed var(--border);border-radius:9px;cursor:pointer;color:var(--text-dim);font-size:22px;background:var(--surface-2);margin:0 auto" title="Chưa có ảnh · click hoặc kéo ảnh vào"><span>—</span><input type="file" accept="image/*" style="display:none" onchange="t2HandleSceneImage('${s.id}', this.files[0])"></label>`;
  }
  const two = a && b;
  const w = two ? 300 : 300, h = two ? 170 : 170;   // to gấp ~4 lần (diện tích) để dễ soi; A+B xếp DỌC
  let inner = '';
  if (a) inner += _t2Thumb(s.id, 'a', a.base64, w, h, two);
  if (b) inner += _t2Thumb(s.id, 'b', b.base64, w, h, two);
  return `<div style="display:flex;flex-direction:column;gap:8px;justify-content:center;align-items:center">${inner}</div>`;
}

function _t2UpdateRowThumb(id){
  try {
    const cell = document.querySelector('#sceneBody tr[data-sid="' + id + '"] td[style*="text-align:center"]');
    const s = state.scenes.find(x => x.id === id);
    if (!cell || !s) return;
    cell.innerHTML = _t2SceneImgCell(s);
  } catch (e) {}
}

function renderTable(){
  const tbl = document.getElementById('sceneTable');
  const body = document.getElementById('sceneBody');
  const empty = document.getElementById('emptyList');
  const addRow = document.getElementById('addSceneRow');
  if (!tbl) return;
  document.getElementById('badge-list').textContent = state.scenes.length;
  const listBar = document.getElementById('sceneListBar');
  if (state.scenes.length === 0) {
    tbl.style.display = 'none';
    empty.style.display = 'block';
    if (addRow) addRow.style.display = 'block';
    if (listBar) listBar.style.display = 'none';
    return;
  }
  tbl.style.display = 'table'; empty.style.display = 'none';
  if (listBar) listBar.style.display = 'flex';
  if (addRow) addRow.style.display = 'block';

  let _acc = 0;
  const _starts = state.scenes.map(s => { const st = _acc; _acc += (parseFloat(s.duration) || 0); return st; });
  const _fmt = t => Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0');

  body.innerHTML = state.scenes.map((s, i) => {
    const isEditing = state.editingSceneIdx === i;
    if (isEditing) {
      return `<tr class="editing-row">
        <td class="id">${s.id}</td>
        <td colspan="5" style="padding:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 80px;gap:6px;margin-bottom:6px">
            <input type="text" id="edt_char_${i}" placeholder="Nhân vật" value="${escapeHtml(s.character || '')}" style="padding:5px 8px;font-size:12px">
            <input type="text" id="edt_bg_${i}" placeholder="Bối cảnh" value="${escapeHtml(s.background || '')}" style="padding:5px 8px;font-size:12px">
            <input type="text" id="edt_cam_${i}" placeholder="Camera" value="${escapeHtml(s.camera || 'medium')}" style="padding:5px 8px;font-size:12px">
            <input type="number" id="edt_dur_${i}" placeholder="Sec" value="${s.duration || 3}" min="1" max="60" style="padding:5px 8px;font-size:12px">
          </div>
          <textarea id="edt_text_${i}" placeholder="Lời đọc VO" style="min-height:50px;font-size:12px;padding:6px 8px">${escapeHtml(s.text || '')}</textarea>
          <div style="margin-top:6px;display:flex;gap:8px">
            <button class="btn primary sm" onclick="saveEditScene(${i})">✓ Lưu</button>
            <button class="btn ghost sm" onclick="cancelEditScene()">Huỷ</button>
          </div>
        </td>
      </tr>`;
    }
    const isLast = i === state.scenes.length - 1;
    const imgCell = _t2SceneImgCell(s);
    const start = _starts[i], end = start + (parseFloat(s.duration) || 0);
    const pr = state.scenePrompts?.[s.id] || '';
    const prHtml = pr ? escapeHtml(pr).replace(/\[([^\]]+)\]/g, '<b style="color:var(--accent)">[$1]</b>') : '';
    return `<tr data-sid="${s.id}" draggable="true" ondragstart="_t2DragStart(event,'${i}')" ondragover="_t2DragOver(event)" ondragleave="_t2DragLeave(event)" ondrop="_t2Drop(event,'${i}')" ondragend="_t2DragEnd(event)" style="cursor:grab">
      <td class="id">${s.id}</td>
      <td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--text-muted);white-space:nowrap;line-height:1.35">${_fmt(start)}<br>${_fmt(end)}</td>
      <td class="dur" style="white-space:nowrap">${s.duration || 0}s${(state.scenePrompts2 && state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim()) ? `<br><span style="font-size:9px;color:var(--accent);font-weight:700">2 ảnh · ${(((parseFloat(s.duration) || 0) / 2)).toFixed(1)}s/ảnh</span>` : ''}</td>
      <td>${_shotBadge(s.shot)}${(function(){ const w = _t2SceneWarns(s, i, state.scenes || []); return w.length ? ` <span title="${escapeHtml(w.join(' · '))}" style="font-size:11px;cursor:help;color:var(--amber)">⚠</span>` : ''; })()}${s.wantVideo ? ' <span title="Cảnh này sẽ làm VIDEO Veo (motion) khi Tạo Video" style="font-size:11px">🎬</span>' : ''}${s.wantStock ? ` <span onclick="t2OpenStockPicker('${s.id}')" title="Cảnh dùng VIDEO STOCK free — bấm để chọn trong ${((state.stockCandidates||{})[s.id]||[]).length || 'các'} ứng viên" style="font-size:11px;cursor:pointer;padding:1px 3px;border-radius:4px;${((state.stockCandidates||{})[s.id]||[]).length ? 'background:var(--accent-soft)' : ''}">🎞${((state.stockCandidates||{})[s.id]||[]).length ? '▾' : ''}</span>` : ''}${s.wantYt ? ' <span title="Cảnh này lấy CLIP YOUTUBE — luồng tự động tự lấy ở bước Xen video, hoặc vào Dựng Video chọn cảnh rồi bấm 🎬 YouTube" style="font-size:11px">▶️</span>' : ''}${s.wantWeb ? ` <span onclick="t2OpenWebPicker('${s.id}')" title="Cảnh dùng TƯ LIỆU NGUỒN WEB — bấm để xem/đổi trong ${((state.webCandidates||{})[s.id]||[]).length || 'các'} ứng viên" style="font-size:11px;cursor:pointer;padding:1px 3px;border-radius:4px;${((state.webCandidates||{})[s.id]||[]).length ? 'background:var(--accent-soft)' : ''}">🌐${((state.webCandidates||{})[s.id]||[]).length ? '▾' : ''}</span>` : ''}</td>
      <td style="text-align:center;padding:8px 4px">${imgCell}</td>
      <td style="position:relative">
        <div class="sb-rowacts">
          <button onclick="editScene(${i})" title="Sửa lời đọc/nhân vật/thời lượng">✏️</button>
          <button onclick="t2QueueRegen('${s.id}')" title="Tạo lại ẢNH cảnh này — tự xếp vào hàng đợi (bấm nhiều cảnh sẽ nối hàng, chạy theo luồng đa tài khoản)" ${pr ? '' : 'disabled'}>🎨</button>
          <button onclick="addSceneAfter(${i})" title="Thêm cảnh sau">⊕</button>
          <button onclick="mergeSceneWithNext(${i})" title="Gộp với cảnh sau" ${isLast ? 'disabled' : ''}>⊗</button>
          <button onclick="delScene(${i})" title="Xoá cảnh">✕</button>
        </div>
        <div style="font-size:13px;line-height:1.5;color:var(--text);padding-right:30px">"${escapeHtml(s.text)}"</div>
        ${prHtml ? `<div style="font-family:ui-monospace,monospace;font-size:9.5px;line-height:1.4;color:var(--text-dim);background:var(--surface-2);border:1px dashed var(--border-2);border-radius:6px;padding:5px 8px;margin-top:6px">${prHtml}</div>` : ''}
      </td>
    </tr>`;
  }).join('');
  // Setup drag-drop on each empty image cell
  document.querySelectorAll('#sceneBody .sb-drop').forEach(el => {
    el.addEventListener('dragover', e => { e.preventDefault(); el.style.background = 'var(--accent-soft)'; });
    el.addEventListener('dragleave', () => { el.style.background = ''; });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.background = '';
      const tr = el.closest('tr');
      const sid = tr?.dataset.sid;
      if (sid && e.dataTransfer.files[0]) t2HandleSceneImage(sid, e.dataTransfer.files[0]);
    });
  });
  if (typeof _t2RegenBar === 'function') _t2RegenBar();   // đồng bộ chỉ báo hàng đợi tạo lại sau khi render
  if (typeof _t2RegenPending !== 'undefined') _t2RegenPending.forEach(k => _t2MarkQueued(String(k).replace(/::b$/, '')));   // giữ badge ⏳ cho cảnh đang chờ (bỏ hậu tố ::b của ảnh B)
  _t2UpdateGenSceneMiss();
}

function _t2GenSceneMissCount(){
  let n = 0;
  for (const s of (state.scenes || [])){
    const aP = state.scenePrompts?.[s.id], bP = state.scenePrompts2?.[s.id];
    if (aP && String(aP).trim() && !state.sceneImages?.[s.id]?.base64) n++;
    if (bP && String(bP).trim() && !state.sceneImagesB?.[s.id]?.base64) n++;
  }
  return n;
}

function _t2UpdateGenSceneMiss(){
  const el = document.getElementById('t2GenSceneMiss'); if (!el) return;
  const n = _t2GenSceneMissCount();
  el.textContent = n ? ' (' + n + ')' : '';
  const btn = document.getElementById('t2GenSceneBtn');
  if (btn){ btn.style.opacity = n ? '1' : '.55'; btn.title = n ? ('Tạo ' + n + ' ảnh cảnh CÒN THIẾU qua Flow (cảnh đã có ảnh A/B được bỏ qua, tự thử lại lỗi)') : 'Mọi cảnh đã có ảnh — không còn thiếu'; }
}

function _t2ApplyVideoAgentEvent(evt){
  if (!evt || !state.scenes || !state.scenes.length) return;
  // Map: id scene tu Tool 7 -> id scene Tool 2. Hien tai gia dinh cung id format '001'..
  // Neu tool 7 gui sceneId rieng, uu tien dung no.
  const sid = String(evt.sceneId || evt.sid || '').padStart(3, '0');
  const sc = state.scenes.find(s => s.id === sid);
  if (!sc) return;
  if (!sc.agentStatus) sc.agentStatus = {};
  // phase: discover/analyze/build/render/final/upload; status: ok/error/progress
  if (evt.phase) sc.agentStatus.phase = evt.phase;
  if (evt.status) sc.agentStatus.status = evt.status;
  if (evt.pct != null) sc.agentStatus.pct = Math.max(0, Math.min(100, +evt.pct || 0));
  if (evt.message) sc.agentStatus.message = String(evt.message).slice(0, 200);
  if (evt.error) sc.agentStatus.error = String(evt.error).slice(0, 500);
  try { renderAllT2(); } catch(_){}
}

function renumberScenes(){
  // Re-id scenes thành 001, 002, ... theo array order, remap prompts
  const oldToNew = {};
  state.scenes.forEach((s, i) => {
    const newId = String(i + 1).padStart(3, '0');
    if (s.id !== newId) oldToNew[s.id] = newId;
    s.id = newId;
  });
  if (Object.keys(oldToNew).length === 0) return;
  // Remap scenePrompts
  if (state.scenePrompts) {
    const newSP = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.scenePrompts[sourceId]) newSP[s.id] = state.scenePrompts[sourceId];
    }
    // Fallback: also keep unchanged IDs
    for (const [k, v] of Object.entries(state.scenePrompts)) {
      if (state.scenes.find(s => s.id === k) && !newSP[k]) newSP[k] = v;
    }
    state.scenePrompts = newSP;
  }
  // Remap veoPrompts
  if (state.veoPrompts) {
    const newVP = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.veoPrompts[sourceId]) newVP[s.id] = state.veoPrompts[sourceId];
    }
    for (const [k, v] of Object.entries(state.veoPrompts)) {
      if (state.scenes.find(s => s.id === k) && !newVP[k]) newVP[k] = v;
    }
    state.veoPrompts = newVP;
  }
  // Remap sceneImages (storyboard)
  if (state.sceneImages) {
    const newSI = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.sceneImages[sourceId]) newSI[s.id] = state.sceneImages[sourceId];
    }
    for (const [k, v] of Object.entries(state.sceneImages)) {
      if (state.scenes.find(s => s.id === k) && !newSI[k]) newSI[k] = v;
    }
    state.sceneImages = newSI;
  }
}

function editScene(idx){
  state.editingSceneIdx = idx;
  renderTable();
  // Focus text input
  setTimeout(() => { const t = document.getElementById('edt_text_' + idx); if (t) t.focus(); }, 50);
}

function cancelEditScene(){
  state.editingSceneIdx = -1;
  renderTable();
}

function saveEditScene(idx){
  const s = state.scenes[idx];
  if (!s) return;
  s.text = document.getElementById('edt_text_' + idx).value.trim();
  s.character = document.getElementById('edt_char_' + idx).value.trim();
  s.background = document.getElementById('edt_bg_' + idx).value.trim();
  s.camera = document.getElementById('edt_cam_' + idx).value.trim() || 'medium';
  s.duration = parseInt(document.getElementById('edt_dur_' + idx).value) || 3;
  // D2: danh dau user da chinh sua thu cong -> AI khong tu ghi de
  s.userEdited = true;
  if (s.userEditedAt == null) s.userEditedAt = Date.now();
  // Neu text thay doi so voi prompt cu, xoa scenePrompts[id] de regen
  const _oldPrompt = state.scenePrompts && state.scenePrompts[s.id];
  if (_oldPrompt && s.promptSeed && _oldPrompt.indexOf(s.promptSeed.slice(0, 30)) < 0){
    // prompt cu khong con lien quan den text moi -> xoa
    try { if (typeof novaLog === 'function') novaLog('Phat hien prompt cu khong khop text moi -> can regen', 'warn'); } catch(_){}
    if (state.scenePrompts) delete state.scenePrompts[s.id];
    if (state.veoPrompts) delete state.veoPrompts[s.id];
  }
  state.editingSceneIdx = -1;
  renderTable(); renderPreview(); renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateStats === 'function') updateStats(); saveState(true);
  setStatus2(`✓ Đã sửa cảnh ${s.id}.`, 'ok');
}

function mergeSceneWithNext(idx){
  if (idx < 0 || idx >= state.scenes.length - 1) return;
  const cur = state.scenes[idx];
  const next = state.scenes[idx+1];
  if (!confirm(`Gộp cảnh ${cur.id} với ${next.id}?\nLời thoại sẽ ghép nối, thời lượng cộng dồn.`)) return;
  // Xoá prompts của cảnh sau (cảnh trước có thể vẫn dùng được nhưng có khả năng phải re-gen)
  if (state.scenePrompts) delete state.scenePrompts[next.id];
  if (state.veoPrompts) delete state.veoPrompts[next.id];
  cur.text = (cur.text || '') + ' ' + (next.text || '');
  cur.duration = (cur.duration || 0) + (next.duration || 0);
  // Char/bg/camera: giữ của cảnh trước (không ghi đè bằng cảnh sau)
  state.scenes.splice(idx + 1, 1);
  renumberScenes();
  renderTable(); renderPreview(); renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateStats === 'function') updateStats(); saveState(true);
  setStatus2(`✓ Đã gộp cảnh.`, 'ok');
}

function addSceneAfter(idx){
  if (state.scenes.length >= getMaxScenes()) {
    return showGate(`Gói Free chỉ chứa ${getMaxScenes()} cảnh. Nâng cấp Pro để thêm.`);
  }
  const newScene = {
    id: 'tmp',
    text: '',
    duration: 3,
    character: '',
    background: '',
    camera: 'medium',
    level: 'normal'
  };
  state.scenes.splice(idx + 1, 0, newScene);
  renumberScenes();
  renderTable();
  // Mở edit mode cho cảnh vừa thêm
  state.editingSceneIdx = idx + 1;
  renderTable();
  setTimeout(() => { const t = document.getElementById('edt_text_' + (idx+1)); if (t) t.focus(); }, 50);
}

function addSceneAtEnd(){
  addSceneAfter(state.scenes.length - 1);
}

function renderPromptsV(){
  const box = document.getElementById('promptsListV');
  if (!box) return;
  const cnt = Object.keys(state.scenePrompts).length;
  document.getElementById('badge-prompts').textContent = cnt;
  if (state.scenes.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có cảnh.</div>'; return; }
  box.innerHTML = state.scenes.map(s => {
    const p = cleanPrompt(state.scenePrompts[s.id]);
    const p2 = cleanPrompt((state.scenePrompts2 || {})[s.id]);
    const promptEsc = p ? p.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const prompt2Esc = p2 ? p2.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const editing = isEditingPrompt('scene', s.id);
    const editing2 = isEditingPrompt('scene2', s.id);
    const hasB = !!(p2 || editing2);
    return `<div class="prompt-card ${p ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="prompt-card-head">
        <span class="prompt-card-id">[${s.id}]</span>
        <span class="prompt-card-meta">${escapeHtml(s.character) || '—'} · ${escapeHtml(s.background) || '—'} · ${s.camera} · ${s.duration}s</span>
      </div>
      <div class="prompt-card-vo">"${escapeHtml(s.text)}"</div>
      ${editing
        ? renderEditPromptUI(p)
        : `<div class="prompt-card-text" style="margin-bottom:4px">${p ? escapeHtml(p) : 'Chưa có prompt.'}</div>
           <div class="prompt-card-actions">
             ${p ? `<button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)">📋 Sao chép</button>
             <button class="btn ghost sm" onclick="startEditPrompt('scene','${s.id}')">✏️ Sửa</button>` : ''}
             <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleScenePrompt('${s.id}')" title="Tạo lại prompt A">🔧 ${p ? 'Tạo lại' : 'Tạo prompt'}</button>
             ${p ? `<button class="btn ghost sm" style="border-color:#dc2626;color:#dc2626" onclick="makeSafePrompt('${s.id}','A')" title="Làm mềm prompt bị G-Labs chặn — đổi từ nhạy cảm thành an toàn">🛡 Sửa vi phạm</button>` : ''}
             ${p && !hasB ? `<button class="btn ghost sm" style="border-color:var(--teal);color:var(--teal)" onclick="addPromptB('${s.id}')">✂️ Thêm ảnh B</button>` : ''}
           </div>`
      }
      ${hasB ? `<div style="margin-top:10px;padding-top:10px;border-top:1.5px dashed var(--teal)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:var(--teal);background:rgba(13,148,136,.1);padding:2px 8px;border-radius:20px">🖼 ẢNH B</span>
          <span style="font-size:11px;color:var(--text-dim)">nửa sau cảnh · ${s.duration}s</span>
          <button class="btn ghost sm" style="margin-left:auto;color:var(--red);border-color:var(--red);font-size:11px;padding:3px 8px" onclick="removePromptB('${s.id}')">🗑</button>
        </div>
        ${editing2
          ? renderEditPromptUI(p2)
          : `<div class="prompt-card-text" style="margin-bottom:4px">${p2 ? escapeHtml(p2) : '<em style="color:var(--text-dim)">Chưa có prompt B.</em>'}</div>
             <div class="prompt-card-actions">
               ${p2 ? `<button class="btn ghost sm" onclick="copyText(\`${prompt2Esc}\`)">📋 Sao chép</button>
               <button class="btn ghost sm" onclick="startEditPrompt('scene2','${s.id}')">✏️ Sửa</button>` : ''}
               <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleScenePromptB('${s.id}')">🔧 ${p2 ? 'Tạo lại B' : 'Tạo prompt B'}</button>
               ${p2 ? `<button class="btn ghost sm" style="border-color:#dc2626;color:#dc2626" onclick="makeSafePrompt('${s.id}','B')" title="Làm mềm prompt B bị chặn">🛡 Sửa vi phạm</button>` : ''}
             </div>`
        }
      </div>` : ''}
    </div>`;
  }).join('');
  // Fill unified textarea — A rồi B liền nhau, 1 dòng trống giữa
  const ta = document.getElementById('allPromptsV');
  if (ta) {
    const lines = [];
    state.scenes.forEach(s => {
      const a = cleanPrompt(state.scenePrompts[s.id]);
      const b = cleanPrompt((state.scenePrompts2 || {})[s.id]);
      if (a) lines.push(a);
      if (b) lines.push(b);
    });
    ta.value = lines.join('\n\n');
  }
  // Nút "Tạo nốt cảnh thiếu" — hiện khi có cảnh chưa có prompt
  const missing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
  const fillBtn = document.getElementById('t2FillBtn');
  const missEl = document.getElementById('t2MissingCount');
  if (fillBtn && missEl) {
    if (missing > 0 && cnt > 0) {
      fillBtn.style.display = '';
      missEl.textContent = '(' + missing + ')';
    } else {
      fillBtn.style.display = 'none';
    }
  }
}

function renderStats2(){
  const el = document.getElementById('statScenes');
  if (!el) return;
  el.textContent = state.scenes.length;
  const assigned = state.scenes.filter(s => s.character || s.background).length;
  const sa = document.getElementById('statAssigned');
  sa.textContent = assigned;
  sa.className = 'v ' + (assigned === state.scenes.length && assigned > 0 ? 'green' : (assigned > 0 ? '' : 'dim'));
  document.getElementById('statChars').textContent = state.charactersV.length || '—';
  document.getElementById('statBgs').textContent = state.backgroundsV.length || '—';
  const _td = totalDur();
  document.getElementById('statDur').textContent = Math.floor(_td / 60) + ':' + String(Math.round(_td % 60)).padStart(2, '0');
}

function totalDur(){ return state.scenes.reduce((a, s) => a + s.duration, 0); }

function delScene(i){
  if (!confirm('Xoá cảnh này?')) return;
  const r = state.scenes.splice(i, 1)[0];
  if (state.scenePrompts) delete state.scenePrompts[r.id];
  if (state.veoPrompts) delete state.veoPrompts[r.id];
  renumberScenes();
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState(true);
}

function copyAllScenePrompts(){
  const lines = [];
  state.scenes.forEach(s => {
    const a = cleanPrompt(state.scenePrompts[s.id]);
    const b = cleanPrompt((state.scenePrompts2 || {})[s.id]);
    if (a) lines.push(a);
    if (b) lines.push(b);
  });
  if (!lines.length) return setStatus2('Chưa có prompt nào.', 'error');
  navigator.clipboard.writeText(lines.join('\n\n'));
  const scenesWithPrompt = state.scenes.filter(s => cleanPrompt(state.scenePrompts[s.id])).length;
  const scenesWithB = state.scenes.filter(s => cleanPrompt((state.scenePrompts2||{})[s.id])).length;
  const missing = state.scenes.length - scenesWithPrompt;
  document.getElementById('copyAllInfo').textContent =
    `✓ Đã sao chép ${lines.length} prompts (${scenesWithPrompt} cảnh${scenesWithB > 0 ? ` + ${scenesWithB} ảnh B` : ''})` + (missing > 0 ? ` ⚠️ thiếu ${missing} cảnh` : '');
  setStatus2(missing > 0
    ? `✓ Copy ${lines.length} prompt. ⚠️ ${missing} cảnh CHƯA có prompt.`
    : `✓ Đã sao chép đủ ${lines.length} prompt (bao gồm ảnh B).`, missing > 0 ? 'info' : 'ok');
}

function generateSRT(){
  if (state.scenes.length === 0) return;
  let t = 0;
  document.getElementById('srtOutput').value = state.scenes.map((s, i) => {
    const st = t;
    t += s.duration;
    return `${i + 1}\n${srtT(st)} --> ${srtT(t)}\n${s.text}\n`;
  }).join('\n');
  setStatus2('✓ Đã tạo SRT.', 'ok');
}

function srtT(s){
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},000`;
}

function downloadSRT(){
  const s = document.getElementById('srtOutput').value;
  if (!s) return;
  const b = new Blob([s], { type: 'text/plain' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = 'video.srt'; a.click();
  URL.revokeObjectURL(u);
}

function copySRT(){
  const s = document.getElementById('srtOutput').value;
  if (s) navigator.clipboard.writeText(s);
  setStatus2('✓ Đã sao chép SRT.', 'ok');
}

function restoreUI(){
  const $ = id => document.getElementById(id);
  if ($('minChars')) $('minChars').value = state.minChars || 30;
  if ($('maxChars')) $('maxChars').value = state.maxChars || 150;
  if ($('splitMode')) $('splitMode').value = state.splitMode || 'smart';
  if ($('scriptInput')) $('scriptInput').value = state.script || '';
  if ($('charsInputV')) $('charsInputV').value = (state.charactersV || []).join('\n');
  if ($('bgInputV')) $('bgInputV').value = (state.backgroundsV || []).join('\n');
  renderProfileSelect();
  if (typeof renderVideoSelect === 'function') renderVideoSelect();
  renderProfileStyles();
  if (typeof renderDashboard === 'function') renderDashboard();
  syncTool2FromProfile();
  renderAllT2();
}

function loadAssetsFromTool2(skipEra){
  // Khôi phục bối cảnh/thời đại đã nhập (giữ trong phiên)
  const eraEl = document.getElementById('t3Era');
  if (eraEl && state.t3Era) eraEl.value = state.t3Era;
  const bgLayoutEl = document.getElementById('t3BgLayout');
  if (bgLayoutEl && state.t3BgLayout) bgLayoutEl.value = state.t3BgLayout;
  if (!skipEra) autoFillEra(false);   // tự suy từ kịch bản nếu ô đang trống (fire-and-forget)
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus3('Tool 02 chưa có nhân vật/bối cảnh. Chạy Quét Trước ở Tool 02.', 'error');

  const p = getProfile();

  // Merge nhân vật mặc định kênh vào đầu danh sách (không trùng lặp)
  const defaultChars = (p?.defaultChars || []);
  const defaultBgs   = (p?.defaultBgs   || []);
  const videoChars   = state.charactersV || [];
  const videoBgs     = state.backgroundsV || [];

  // Strip tag để so sánh tên
  const stripTag = s => s.replace(/\s*\[.*?\]\s*$/, '').trim();
  const videoCharNames = new Set(videoChars.map(stripTag));
  const videoBgNames   = new Set(videoBgs.map(stripTag));

  // Nhân vật mặc định không có trong video → thêm vào đầu
  const extraChars = defaultChars.filter(c => !videoCharNames.has(stripTag(c)));
  const extraBgs   = defaultBgs.filter(b => !videoBgNames.has(stripTag(b)));

  const mergedChars = [...extraChars, ...videoChars];
  const mergedBgs   = [...extraBgs,   ...videoBgs];

  document.getElementById('t3Characters').value = mergedChars.join('\n');
  document.getElementById('t3Backgrounds').value = mergedBgs.join('\n');
  document.getElementById('t3CharCount').textContent = mergedChars.length;
  document.getElementById('t3BgCount').textContent = mergedBgs.length;

  if (extraChars.length || extraBgs.length) {
    setStatus3(`✓ Load từ Tool 02 + thêm ${extraChars.length} nhân vật / ${extraBgs.length} bối cảnh mặc định kênh.`, 'ok');
  } else {
    setStatus3('✓ Load từ Tool 02.', 'ok');
  }

  if (p) {
    document.getElementById('t3VisualStyle').value = p.visualStyle || '';
    document.getElementById('t3Ngach').value = p.ngach || '';
    document.getElementById('t3PovStyle').value = p.povStyle || '';
    document.getElementById('t3CharStyle').value = p.characterStyle || '';
    document.getElementById('t3BgStyle').value = p.backgroundStyle || '';
    document.getElementById('t3SceneStyle').value = p.sceneStyle || '';
    document.getElementById('t3PromptRules').value = p.promptRules || '';
  }

  // Populate character select for image upload
  const sel = document.getElementById('t3CharSelect');
  sel.innerHTML = '<option value="">— Chọn từ danh sách nhân vật —</option>' +
    mergedChars.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  setStatus3(`✓ Đã load ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.`, 'ok');
}

function uploadCharImage(){
  const charName = document.getElementById('t3CharSelect').value;
  if (!charName) return alert('Chọn nhân vật trước khi upload ảnh.');
  const input = document.getElementById('t3ImgInput');
  input.onchange = function(){
    const file = this.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('File quá lớn (max 5MB).');
    const reader = new FileReader();
    reader.onload = function(e){
      const base64 = e.target.result.split(',')[1];
      const mediaType = file.type;
      state.characterImages[charName] = { base64, mediaType, fileName: file.name };
      renderCharImageGallery();
      setStatus3(`✓ Đã upload ảnh cho [${charName}].`, 'ok');
      saveState();
    };
    reader.readAsDataURL(file);
    this.value = '';
  };
  input.click();
}

function renderCharImageGallery(){
  const gallery = document.getElementById('t3ImgGallery');
  if (!gallery) return;
  const entries = Object.entries(state.characterImages || {});
  document.getElementById('t3ImgCount').textContent = entries.length + ' ảnh';
  if (entries.length === 0) { gallery.innerHTML = ''; return; }
  gallery.innerHTML = entries.map(([name, img]) => `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;width:130px">
      <img src="data:${img.mediaType};base64,${img.base64}" style="width:110px;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px">
      <div style="color:var(--teal);font-size:11px;font-weight:600;word-break:break-all">${escapeHtml(name)}</div>
      <button class="btn ghost sm" style="margin-top:6px;font-size:10px" onclick="delete state.characterImages['${name.replace(/'/g, "\\'")}'];renderCharImageGallery();saveState()">Xoá</button>
    </div>
  `).join('');
}

function clearAllCharImages(){
  if (!confirm('Xoá tất cả ảnh tham chiếu nhân vật?')) return;
  state.characterImages = {};
  renderCharImageGallery();
  saveState();
}

function _t3StyleCtx(){
  const p = getProfile();
  const charStyle  = document.getElementById('t3CharStyle').value  || p?.characterStyle  || '';
  const charStyleB = document.getElementById('t3CharStyleB')?.value || p?.characterStyleB || '';
  const bgStyle    = document.getElementById('t3BgStyle').value    || p?.backgroundStyle  || '';
  const rules = document.getElementById('t3PromptRules').value || p?.promptRules || '';
  // 🏺 Ngữ cảnh THỜI ĐẠI cho trang phục: ưu tiên ô "Bối cảnh & thời đại", nếu trống → trích kịch bản Tool 02
  const eraInput = (document.getElementById('t3Era')?.value || state.t3Era || '').trim();
  const scriptHint = (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 700);
  const eraCtx = eraInput
    ? `\nSETTING & ERA (infer period-correct CLOTHING from this): ${eraInput}`
    : (scriptHint ? `\nSCRIPT EXCERPT (infer era + clothing from this): "${scriptHint}"` : '');
  const eraRule = (eraInput || scriptHint)
    ? `\n- Clothing + HAIR/HEADWEAR + accessories must be CORRECT for the era/setting above (e.g. ancient Egypt → linen kilts/skirts, linen cloaks, wesekh collars, papyrus sandals; NO modern suits/shirts/ties/aprons when anachronistic). KEEP the channel's art-style/render medium EXACTLY as defined in the Character Style above (e.g. real-photo channel stays photoreal, 2D channel stays 2D) — ONLY change clothes, hair, headwear, jewelry to match the era, NEVER change the drawing style/material.`
    : '';
  // 🏺 Luật thời đại cho BỐI CẢNH (kiến trúc/vật liệu/đồ vật/ánh sáng theo đúng thời)
  const eraRuleBg = (eraInput || scriptHint)
    ? `\n- The setting's architecture, materials, objects and light sources must be CORRECT for the era/place above — NO anachronistic modern elements (e.g. ancient Egypt → mud-brick/stone walls, hieroglyph-carved columns, oil lamps/torches; NO electric bulbs, glass, modern metal/plastic).`
    : '';
  // 🖼 Kiểu ảnh bối cảnh: 'single' = 1 ảnh/mỗi bối cảnh (nét, ít lỗi) | 'grid' = 4 góc trong 1 ảnh
  const bgLayoutMode = (document.getElementById('t3BgLayout')?.value || state.t3BgLayout || 'single');
  const bgLayout = (bgLayoutMode === 'grid') ? ASSET_BG_LAYOUT : ASSET_BG_LAYOUT_SINGLE;
  return { p, charStyle, charStyleB, bgStyle, rules, eraInput, scriptHint, eraCtx, eraRule, eraRuleBg, bgLayout };
}

function _sanitizeCharPrompt(text){
  return String(text || '')
    .split(/(?<=[.!?])\s+/)               // tách theo câu
    .filter(seg => !_CHAR_RISKY.test(seg)) // bỏ câu chứa cụm cởi trần
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _charDescFromScenes(name){
  try {
    const tag = '[' + name + ']';
    const prompts = Object.values(state.scenePrompts || {}).concat(Object.values(state.scenePrompts2 || {}));
    const cand = {};
    for (const p of prompts){
      const s = String(p || ''); let idx = s.indexOf(tag);
      while (idx >= 0){
        const after = s.slice(idx + tag.length, idx + tag.length + 340);
        const m = after.match(/[^.]*\b(wear|wears|wearing|dressed|hoodie|shirt|jacket|suit|dress|coat|vest|jeans|trousers|robe|uniform|gown|blazer|cardigan|sneakers|boots)\b[^.]*\./i);
        if (m){ let d = m[0].replace(/^[\s,;:]+/, '').trim(); if (d.length > 25 && d.length < 340) cand[d] = (cand[d] || 0) + 1; }
        idx = s.indexOf(tag, idx + 1);
      }
    }
    let best = '', bc = 0; for (const [d, c] of Object.entries(cand)) if (c > bc){ bc = c; best = d; }
    return best;
  } catch (e){ return ''; }
}

function _isGenericCharName(n){
  const base = String(n || '').toLowerCase().replace(/[\s_\-]+/g, ' ').trim().split(' ')[0];
  return /^(protagonist|narrator|hero|heroine|antagonist|villain|character|main|mc|speaker|host|presenter|guy|man|woman|person|boy|girl|kid|child|lady|gentleman|worker|customer|shopper|user|viewer|nhanvat)$/.test(base);
}

async function genOneCharPrompt(rawName, ctx, opts = {}){
  const tagMatch = rawName.match(/^(.*?)\s*\[\s*(\w+)\s*\]\s*$/);
  const name    = tagMatch ? tagMatch[1].trim() : rawName.trim();
  const charTag = tagMatch ? tagMatch[2].toLowerCase() : '';
  // Bất kỳ tag nào → dùng Style B (nếu có); không tag → Style chính
  const useStyle = (charTag && ctx.charStyleB) ? ctx.charStyleB : ctx.charStyle;
  // Kênh ẢNH THẬT → dùng layout dạng ảnh chụp (tránh AI vẽ thành anime model-sheet)
  // Dùng CHUNG bộ dò medium với prompt cảnh — không thì ref nhân vật và ảnh cảnh lệch nhau (một bên vẽ, một bên ảnh).
  const _isPhotoreal = _profileMedium({ sceneStyle: (ctx.p?.sceneStyle || ''), characterStyle: useStyle, visualStyle: (ctx.p?.visualStyle || '') }).isPhoto;
  const charLayout = _isPhotoreal ? ASSET_CHAR_LAYOUT_PHOTO : ASSET_CHAR_LAYOUT;
  if (!state.assetCharPrompts) state.assetCharPrompts = {};

  // 📚 LIBRARY CHECK — nếu nhân vật đã có trong Library thì pull, skip AI gen (trừ khi forceAI HOẶC tên vai chung chung).
  if (!opts.forceAI && !_isGenericCharName(name)){
    const libEntry = checkLibraryFor('char', name);
    if (libEntry) {
      state.assetCharPrompts[name] = libEntry.prompt;
      if (libEntry.hasImage) {
        const uid = window.currentUser?.uid;
        if (uid) {
          try {
            const img = await IDB.get(uid + '/libraryImages/' + name);
            if (img) {
              if (!state.characterImages) state.characterImages = {};
              state.characterImages[name] = img;
            }
          } catch(e) {}
        }
      }
      return { name, pulled: true };
    }
  }

  const img = state.characterImages?.[name];
  const anchor = (state.styleRefImages && state.styleRefImages[0]) || null;

  // AI CHỈ tả NGOẠI HÌNH riêng của nhân vật (trang phục/tóc/đặc điểm theo thời đại).
  // Còn STYLE đầy đủ + LAYOUT (turnaround 5 góc, không hàng biểu cảm) + luật NO-TEXT → app tự RÁP CỐ ĐỊNH → mọi nhân vật đồng nhất, không bị AI bỏ sót.
  /* Trích đúng những câu KỊCH BẢN có nhắc tới nhân vật này.
     Trước đây mô tả ngoại hình chỉ suy từ TÊN + THỜI ĐẠI + NGÁCH. Với sáu
     video cùng "Mỹ hiện đại" thì AI nhận gần như cùng một đầu vào và cho ra
     gần như cùng một người — chỉ khác cái tên, mà tên thì không quyết định
     được ngoại hình. Đưa thêm câu kịch bản vào để AI biết người này LÀM GÌ:
     CEO hãng bay, nhà phân tích, thợ rửa xe — nghề nghiệp mới là thứ quyết
     định trang phục.                                                         */
  const _nhanVatTrongKichBan = (slug) => {
    const kb = String(state.script || '').replace(/\s+/g, ' ').trim();
    if (!kb) return '';
    // slug "ed-bastian" → tìm "ed bastian", và cả họ đứng riêng ("bastian").
    const tu = String(slug).split(/[-_]+/).filter(x => x.length > 2);
    if (!tu.length) return '';
    const mau = [tu.join('[\\s-]+')].concat(tu.length > 1 ? [tu[tu.length - 1]] : []);
    const cau = kb.split(/(?<=[.!?])\s+/);
    const ra = [];
    for (const m of mau) {
      let re; try { re = new RegExp('\\b' + m + '\\b', 'i'); } catch (_) { continue; }
      for (const c of cau) {
        if (re.test(c) && !ra.includes(c) && c.length > 25) ra.push(c);
        if (ra.length >= 3) break;
      }
      if (ra.length) break;                       // khớp cả tên rồi thì khỏi tìm theo họ
    }
    return ra.join(' ').slice(0, 600);
  };
  /* Hai nhân vật khác nghề vẫn hay ra cùng "blazer navy" vì mỗi người được
     sinh ĐỘC LẬP. Bản đầu tôi cho đọc trang phục của người đã sinh rồi bắt
     chọn khác — nhưng hàm này chạy SONG SONG (runConcurrent theo số key), nên
     mọi nhân vật khởi động cùng lúc và danh sách đó rỗng. Luật thành vô dụng
     ngay khi người dùng nâng số luồng.

     Nay gán MÀU theo CHỈ SỐ nhân vật trong danh sách — xác định trước, không
     phụ thuộc ai chạy xong trước. Song song bao nhiêu luồng cũng đúng.      */
  const _MAU_AO = [
    'navy blue', 'warm rust / terracotta', 'charcoal grey', 'olive green',
    'burgundy', 'cream / off-white', 'slate teal', 'mustard ochre',
    'deep plum', 'sand beige',
  ];
  const _mauCua = (() => {
    const ds = (state.charactersV || []).map(c => (typeof c === 'string' ? c : (c && (c.name || c.slug)) || ''));
    let k = ds.indexOf(name);
    if (k < 0) k = Math.abs([...String(name)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % _MAU_AO.length;
    return _MAU_AO[k % _MAU_AO.length];
  })();
  const _khacCtx = `\nMANDATORY OUTER GARMENT COLOR for this character: ${_mauCua}. Each character in the video is assigned a DIFFERENT color — this channel draws minimal faces, so GARMENT COLOR is the ONLY way to tell people apart. Pick a garment style fitting the profession, but the color must be exactly the color above.`;

  const _ctxKB = _nhanVatTrongKichBan(name);
  const _kbCtx = _ctxKB
    ? `\nTHIS CHARACTER IN THE SCRIPT (infer PROFESSION + role from this, then choose fitting clothing): "${_ctxKB}"`
    : '';

  const descReq = (extra) => `Describe the INDIVIDUAL appearance of character [${name}] for the channel "${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}".${ctx.eraCtx}${_kbCtx}${_khacCtx}
${extra}
Return 1-3 SHORT English sentences (40-80 words), STARTING with "The character [${name}] wears", describing: period-correct CLOTHING, HAIR/HEADWEAR, age/gender, distinctive identifying traits.
Do NOT re-describe the channel's overall art-style, do NOT describe layout/composition, no no-text rules. Return ONLY the description sentence(s).`;

  let desc;
  const _sceneDesc = (!opts.forceRewrite) ? _charDescFromScenes(name) : '';   // opts.forceRewrite → bỏ qua, cho AI viết mới
  if (_sceneDesc) {
    // ✅ Dùng ĐÚNG mô tả trang phục trong prompt cảnh → ảnh tham chiếu khớp ảnh cảnh (hết lệch quần áo).
    desc = `The character [${name}] is ${_sceneDesc}`;
  } else if (img) {
    desc = await callClaudeWithImage(descReq('Base your answer EXACTLY on the attached reference image (clothing, colors, hairstyle, facial features).'), img.base64, img.mediaType, 400);
  } else if (anchor) {
    desc = await callClaudeWithImage(descReq('Infer clothing/hair/traits from the character NAME + era + channel niche (the attached image is only a style-spirit reference).'), anchor.base64, anchor.mediaType, 400);
  } else {
    desc = await callClaude(descReq('Infer clothing/hair/traits from the character NAME + era + channel niche.'), 400);
  }
  desc = cleanPrompt(String(desc || '').trim());
  if (desc && !desc.includes('[' + name + ']')) desc = `The character [${name}]. ` + desc;   // đảm bảo có tag
  // 🧩 RÁP CỐ ĐỊNH: [style đầy đủ] + [mô tả nhân vật] + [LAYOUT kèm no-text] → luôn đủ định dạng
  // 🛡 Lọc cụm cởi trần (chống nhân vật trẻ em bị bộ lọc child-safety chặn "vi phạm chính sách")
  state.assetCharPrompts[name] = _sanitizeCharPrompt(`${useStyle} ${desc} ${charLayout}`);
  return { name, pulled: false };
}

async function genOneBgPrompt(name, ctx, opts = {}){
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  if (!opts.forceAI){
    const libEntry = checkLibraryFor('bg', name);
    if (libEntry) { state.assetBgPrompts[name] = libEntry.prompt; return { name, pulled: true }; }
  }
  const promptText = `Create 1 detailed image prompt for a background reference location [${name}].

Style template:
"""
${ctx.bgStyle}
"""

LOOK DIRECTION (phrase POSITIVELY in the prompt — do NOT copy it verbatim as a "no/not" list): ${ctx.rules}
Channel: ${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}${ctx.eraCtx}

Requirements:
- Describe the environment, props and lighting in detail, plus COMPOSITION & DEPTH (foreground–midground–background) so the setting has real space
- Include the background name [${name}] in the prompt
- POSITIVE PHRASING: describe what you WANT to see, MINIMIZE "no X / not Y" (Nano Banana is an instruction-following model, no SDXL-style negatives). Keep only the few truly needed negatives: no text, no watermark, and no people / no characters (this is an empty background plate)${ctx.eraRuleBg}
- ${ctx.bgLayout}
- 100-150 English words
- Return ONLY the prompt text.`;
  state.assetBgPrompts[name] = await callClaude(promptText, 500);
  return { name, pulled: false };
}

async function regenOneCharPrompt(rawName){
  const ctx = _t3StyleCtx();
  if (!ctx.charStyle && !ctx.charStyleB) return setStatus3('Cần có Character Style trong Profile.', 'error');
  const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  delete state.assetCharPrompts[name];
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  renderAssetCharPrompts(chars);
  setStatus3(`🎲 Đang tạo lại nhân vật [${name}]...`, 'working');
  try {
    await genOneCharPrompt(rawName, ctx, { forceAI: true });
    renderAssetCharPrompts(chars);
    setStatus3(`✓ Đã tạo lại nhân vật [${name}].`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi tạo lại: ' + e.message, 'error');
  }
}

async function regenOneBgPrompt(name){
  const ctx = _t3StyleCtx();
  if (!ctx.bgStyle) return setStatus3('Cần có Background Style trong Profile.', 'error');
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  delete state.assetBgPrompts[name];
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  renderAssetBgPrompts(bgs);
  setStatus3(`🎲 Đang tạo lại bối cảnh [${name}]...`, 'working');
  try {
    await genOneBgPrompt(name, ctx, { forceAI: true });
    renderAssetBgPrompts(bgs);
    setStatus3(`✓ Đã tạo lại bối cảnh [${name}].`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi tạo lại: ' + e.message, 'error');
  }
}

async function genAllAssetPrompts(){
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (chars.length === 0 && bgs.length === 0) return setStatus3('Cần load nhân vật/bối cảnh trước.', 'error');

  const ctx = _t3StyleCtx();
  const { p, charStyle, charStyleB, bgStyle, rules, eraCtx, eraRule, eraRuleBg, bgLayout } = ctx;
  if (!charStyle && !bgStyle) return setStatus3('Cần có Style Prompts trong Profile.', 'error');

  setStatus3('AI đang tạo prompt reference sheets...', 'working');
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  clearCancel();

  try {
    // Character prompts — chạy SONG SONG theo số key (mỗi nhân vật độc lập). Check Library → skip AI nếu có.
    let libPulledChars = 0;
    const charsToDo = chars.filter(rawName => {
      const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      return !(state.assetCharPrompts[name] && state.assetCharPrompts[name].trim());
    });
    const charLanes = _concurrency();
    await runConcurrent(charsToDo, async (rawName) => {
      if (state.cancelRequested) return;
      const res = await genOneCharPrompt(rawName, ctx);
      if (res && res.pulled) libPulledChars++;
      renderAssetCharPrompts(chars);
      const done = Object.keys(state.assetCharPrompts).length;
      setStatus3(`Nhân vật ${done}/${chars.length}...${charLanes > 1 ? ` (⚡ ${charLanes} luồng)` : ''}${libPulledChars ? ` · 📚 ${libPulledChars} từ Library` : ''}`, 'working');
    }, charLanes, () => state.cancelRequested);
    if (state.cancelRequested) {
      clearCancel();
      setStatus3(`⏸ Đã dừng. Đã tạo ${Object.keys(state.assetCharPrompts).length}/${chars.length} prompt nhân vật. Bấm lại để chạy tiếp.`, 'info');
      saveState();
      return;
    }

    // Background prompts — GỘP tất cả vào 1 lần gọi API (tiết kiệm chi phí)
    let libPulledBgs = 0;
    const bgsToGen = []; // bối cảnh cần AI tạo (chưa có prompt, không trong Library)
    for (const name of bgs) {
      if (state.assetBgPrompts[name] && state.assetBgPrompts[name].trim()) continue;
      const libEntry = checkLibraryFor('bg', name);
      if (libEntry) {
        state.assetBgPrompts[name] = libEntry.prompt;
        libPulledBgs++;
        renderAssetBgPrompts(bgs);
        setStatus3(`📚 ${name}: pull từ Library (${libPulledBgs} bg đã pull)`, 'info');
        continue;
      }
      bgsToGen.push(name);
    }

    if (bgsToGen.length && !state.cancelRequested) {
      setStatus3(`Đang tạo ${bgsToGen.length} prompt bối cảnh (1 lần gọi)...`, 'working');
      const bgListStr = bgsToGen.map(n => `[${n}]`).join('\n');
      const batchBgPrompt = `Create detailed image prompts for the MULTIPLE background reference locations below.

Style template:
"""
${bgStyle}
"""

NEGATIVE/RULES: ${rules}
Channel: ${p?.tenKenh || ''} — ${p?.ngach || ''}${eraCtx}

Background list:
${bgListStr}

For EACH background, create 1 prompt:
- Describe the environment, props and lighting in detail
- Include the background name [name] in the prompt
- NO characters NO people${eraRuleBg}
- ${bgLayout}
- 100-150 English words per prompt

Return a JSON object keyed by background name (no brackets), value being the prompt text. Example: {"ship-cabin-night":"...","ship-deck-night":"..."}
Return ONLY JSON, no explanation.`;
      try {
        const reply = await callClaude(batchBgPrompt, 3000);
        const clean = reply.replace(/```json|```/g, '').trim();
        const obj = JSON.parse(clean);
        for (const name of bgsToGen) {
          if (obj[name] && typeof obj[name] === 'string') {
            state.assetBgPrompts[name] = obj[name].trim();
          }
        }
        renderAssetBgPrompts(bgs);
      } catch (e) {
        // Fallback: JSON lỗi → gọi từng cái
        console.warn('Batch BG lỗi, fallback từng cái:', e.message);
        for (const name of bgsToGen) {
          if (state.cancelRequested) break;
          await genOneBgPrompt(name, ctx, { forceAI: true });
          renderAssetBgPrompts(bgs);
        }
      }
    }

    // QUÉT LẠI: asset NÀO còn thiếu prompt (do lô rớt mạng) → thử lại tối đa 2 vòng (tránh "cần prompt" như traveler/bucees-interior).
    const _cn = rn => rn.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    for (let sweep = 0; sweep < 2 && !state.cancelRequested; sweep++){
      const missC = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim()));
      const missB = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim()));
      if (!missC.length && !missB.length) break;
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missC.length} nhân vật + ${missB.length} bối cảnh thiếu mô tả — thử lại (vòng ${sweep + 1})…`, 'warn');
      const lanes2 = _concurrency();
      await runConcurrent(missC, async (rn) => { if (state.cancelRequested) return; try { await genOneCharPrompt(rn, ctx, { forceAI: true }); renderAssetCharPrompts(chars); } catch (e) { console.warn('char sweep:', e.message); } }, lanes2, () => state.cancelRequested);
      await runConcurrent(missB, async (nm) => { if (state.cancelRequested) return; try { await genOneBgPrompt(nm, ctx, { forceAI: true }); renderAssetBgPrompts(bgs); } catch (e) { console.warn('bg sweep:', e.message); } }, lanes2, () => state.cancelRequested);
    }
    const _mc = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim())).length;
    const _mb = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim())).length;
    if ((_mc || _mb) && typeof novaLog === 'function') novaLog(`⚠️ Còn ${_mc} nhân vật + ${_mb} bối cảnh chưa có mô tả (mạng chập) — bấm "🔄 Viết lại mô tả" để bù.`, 'err');

    setStatus3(`✓ Đã tạo ${chars.length} prompt nhân vật + ${bgs.length} prompt bối cảnh.`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

async function genStyleReference(){
  const p = getProfile();
  if (!p) return setStatus3('Cần Profile.', 'error');
  setStatus3('AI đang tạo Style Reference prompt...', 'working');
  try {
    const prompt = `Create 1 image prompt for a "Channel Visual Style Reference Sheet" — one master image summarizing the channel's entire visual style, used as the standard for all future videos.

Channel: ${p.tenKenh} — ${p.ngach}
Visual Style: ${p.visualStyle}
Character Style (apply IN FULL — especially how bodies, arms/legs, hands and faces are built): ${p.characterStyle || ''}
Background Style: ${(p.backgroundStyle || '').slice(0, 700)}
Scene Style: ${(p.sceneStyle || '').slice(0, 400)}

MANDATORY LAYOUT — the image is divided into 3 clear horizontal rows, separated by thin divider lines:
- ROW 1 (top): color palette — 8 color squares representing the channel's dominant palette (taken from the style), evenly spaced in a row
- ROW 2 (middle): a line-up of 8 diverse sample characters (male/female, old/young, different professions fitting the channel niche) — ALL in the same consistent art style, standing full-body front view, white background, soft drop shadow under their feet. The BODY CONSTRUCTION of all 8 characters MUST exactly follow the Character Style above (e.g. if the Character Style calls for thin black stick arms/legs + white mitten hands + off-white faces, all 8 must be drawn that way) — NEVER draw them as regular-proportioned cartoon people
- ROW 3 (bottom): 3 sample background cells (3 typical environments of the channel) with different lighting and moods, slightly rounded corners

The prompt must:
- Describe the EXACT art style AND character body construction (arms, legs, hands, faces) exactly per the Character Style above — copy the identifying features verbatim, do NOT replace them with regular cartoon human proportions
- Apply the correct color palette and mood per the Visual Style
- 130-180 English words
- End with: "channel style reference sheet, consistent art style throughout, clean layout, no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only"
- Return ONLY the prompt text.`;
    state.styleRefPrompt = await callClaude(prompt, 600);
    document.getElementById('styleRefPanel').style.display = 'block';
    renderStyleRef();
    updateAllAssetPromptsBox();
    setStatus3('✓ Đã tạo Style Reference prompt (3 hàng: palette + nhân vật + bối cảnh).', 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

function renderAssetCharPrompts(chars){
  const box = document.getElementById('t3CharPromptsList');
  if (!box) return;
  document.getElementById('t3CharPromptCount').textContent = Object.keys(state.assetCharPrompts || {}).length;
  if (!chars || chars.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có nhân vật.</div>'; return; }
  box.innerHTML = chars.map(rawName => {
    // Strip tag: "passenger-narrator [b]" → "passenger-narrator"
    const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    const tag  = (rawName.match(/\[\s*(\w+)\s*\]/) || [])[1] || '';
    const pr = state.assetCharPrompts?.[name];
    const promptEsc = pr ? pr.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const editing = isEditingPrompt('char', name);
    const nameEsc = name.replace(/'/g, "\\'");
    const rawNameEsc = rawName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const inLib = !!_getLib().chars[name];
    const tagBadge = tag ? `<span style="font-size:10px;background:rgba(13,148,136,.15);color:var(--teal);padding:1px 6px;border-radius:6px;margin-left:4px">[${tag}] Style B</span>` : '';
    return `<div class="ref-sheet-card ${pr ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="ref-sheet-card-head">
        <span class="ref-sheet-card-name">${escapeHtml(name)}${tagBadge} ${inLib ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 5px;border-radius:6px;margin-left:4px">📚 Library</span>' : ''}</span>
        ${editing ? '' : (pr ? `<div style="display:flex;gap:6px">
          <button class="btn ghost sm" onclick="regenOneCharPrompt('${rawNameEsc}')" title="🎲 Tạo lại prompt nhân vật này" style="color:var(--teal)">🎲</button>
          <button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)" title="Sao chép">📋</button>
          <button class="btn ghost sm" onclick="startEditPrompt('char','${nameEsc}')" title="Sửa prompt">✏️</button>
          <button class="btn ghost sm" onclick="saveToLibraryUI('char','${nameEsc}')" title="Lưu vào Library để dùng cho video sau" style="color:var(--accent)">💾</button>
        </div>` : '')}
      </div>
      ${editing ? renderEditPromptUI(pr) : `<div class="ref-sheet-card-text">${pr ? escapeHtml(pr) : 'Đang tạo...'}</div>`}
    </div>`;
  }).join('');
  updateAllAssetPromptsBox();
}

function renderAssetBgPrompts(bgs){
  const box = document.getElementById('t3BgPromptsList');
  if (!box) return;
  document.getElementById('t3BgPromptCount').textContent = Object.keys(state.assetBgPrompts || {}).length;
  if (!bgs || bgs.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có bối cảnh.</div>'; return; }
  box.innerHTML = bgs.map(name => {
    const pr = state.assetBgPrompts?.[name];
    const promptEsc = pr ? pr.replace(/`/g, "'").replace(/\\/g, "\\\\") : '';
    const editing = isEditingPrompt('bg', name);
    const nameEsc = name.replace(/'/g, "\\'");
    const inLib = !!_getLib().bgs[name];
    return `<div class="ref-sheet-card bg-card ${pr ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="ref-sheet-card-head">
        <span class="ref-sheet-card-name">${escapeHtml(name)} ${inLib ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 5px;border-radius:6px;margin-left:4px">📚 Library</span>' : ''}</span>
        ${editing ? '' : (pr ? `<div style="display:flex;gap:6px">
          <button class="btn ghost sm" onclick="regenOneBgPrompt('${nameEsc}')" title="🎲 Tạo lại prompt bối cảnh này" style="color:var(--rose)">🎲</button>
          <button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)" title="Sao chép">📋</button>
          <button class="btn ghost sm" onclick="startEditPrompt('bg','${nameEsc}')" title="Sửa prompt">✏️</button>
          <button class="btn ghost sm" onclick="saveToLibraryUI('bg','${nameEsc}')" title="Lưu vào Library để dùng cho video sau" style="color:var(--accent)">💾</button>
        </div>` : '')}
      </div>
      ${editing ? renderEditPromptUI(pr) : `<div class="ref-sheet-card-text">${pr ? escapeHtml(pr) : 'Đang tạo...'}</div>`}
    </div>`;
  }).join('');
  updateAllAssetPromptsBox();
}

function updateAllAssetPromptsBox(){
  const ta = document.getElementById('allAssetPromptsBox');
  if (!ta) return;
  const parts = [];
  const cp = state.assetCharPrompts || {};
  const bp = state.assetBgPrompts || {};
  const oneLine = p => p.replace(/\s*\n\s*/g, ' ').trim();
  // Chỉ lấy nhân vật/bối cảnh đang dùng trong video hiện tại
  const chars = (document.getElementById('t3Characters')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const bgs   = (document.getElementById('t3Backgrounds')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const charKeys = chars.length ? chars : Object.keys(cp);
  const bgKeys   = bgs.length   ? bgs   : Object.keys(bp);
  for (const name of charKeys) if (cp[name]) parts.push(`[CHARACTER: ${name}] ${oneLine(cp[name])}`);
  for (const name of bgKeys)   if (bp[name]) parts.push(`[BACKGROUND: ${name}] ${oneLine(bp[name])}`);
  if (state.styleRefPrompt) parts.push(`[STYLE REFERENCE] ${oneLine(state.styleRefPrompt)}`);
  ta.value = parts.join('\n');
}

function copyAllAssetPrompts(){
  const parts = [];
  const cp = state.assetCharPrompts || {};
  const bp = state.assetBgPrompts || {};
  const oneLine = p => p.replace(/\s*\n\s*/g, ' ').trim();
  const chars = (document.getElementById('t3Characters')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const bgs   = (document.getElementById('t3Backgrounds')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const charKeys = chars.length ? chars : Object.keys(cp);
  const bgKeys   = bgs.length   ? bgs   : Object.keys(bp);
  for (const name of charKeys) if (cp[name]) parts.push(`[CHARACTER: ${name}] ${oneLine(cp[name])}`);
  for (const name of bgKeys)   if (bp[name]) parts.push(`[BACKGROUND: ${name}] ${oneLine(bp[name])}`);
  if (state.styleRefPrompt) parts.push(`[STYLE REFERENCE] ${oneLine(state.styleRefPrompt)}`);
  if (!parts.length) return setStatus3('Chưa có prompt nào.', 'error');
  navigator.clipboard.writeText(parts.join('\n'));
  setStatus3(`✓ Đã sao chép ${parts.length} prompts.`, 'ok');
}

function exportAssetPrompts(){
  downloadJSON({
    charPrompts: state.assetCharPrompts,
    bgPrompts: state.assetBgPrompts,
    styleRef: state.styleRefPrompt,
    exportedAt: new Date().toISOString()
  }, 'asset-prompts-' + Date.now() + '.json');
  setStatus3('✓ Đã xuất.', 'ok');
}

function setupAssetDropzone(){
  const dz = document.getElementById('assetDropzone');
  if (!dz) return;
  const inp = document.getElementById('assetFileInput');
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    addAssetFiles(Array.from(e.dataTransfer.files));
  });
  inp.addEventListener('change', e => addAssetFiles(Array.from(e.target.files)));
  document.getElementById('t3AssetNames').addEventListener('input', renderAssetPreview);
}

function addAssetFiles(files){
  const imgs = files.filter(f => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  assetRenamer.files = assetRenamer.files.concat(imgs)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  document.getElementById('t3AssetImgCount').textContent = assetRenamer.files.length + ' ảnh đã chọn';
  renderAssetPreview();
}

function clearAssetFiles(){
  assetRenamer.files = [];
  document.getElementById('t3AssetImgCount').textContent = '0 ảnh đã chọn';
  renderAssetPreview();
}

function renderAssetPreview(){
  const panel = document.getElementById('assetPreviewPanel');
  const list = document.getElementById('assetPreviewList');
  if (!panel || !list) return;
  const names = document.getElementById('t3AssetNames').value.split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('t3AssetCount').textContent = names.length + ' assets';
  if (!assetRenamer.files.length || !names.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const count = Math.min(assetRenamer.files.length, names.length);
  list.innerHTML = `<table class="scene-table">
    <thead><tr><th>#</th><th>File gốc</th><th></th><th>Tên mới</th></tr></thead>
    <tbody>` +
    assetRenamer.files.slice(0, names.length).map((f, i) => {
      const name = names[i] || '?';
      const ext = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
      return `<tr>
        <td class="id">${i + 1}</td>
        <td style="color:var(--text-muted)">${escapeHtml(f.name)}</td>
        <td style="text-align:center;color:var(--text-dim)">→</td>
        <td style="color:var(--accent);font-weight:600">${escapeHtml(name)}${ext}</td>
      </tr>`;
    }).join('') + `</tbody></table>` +
    (assetRenamer.files.length > names.length ? `<div style="padding:8px 14px;color:var(--text-dim);font-size:11px">${assetRenamer.files.length - names.length} ảnh thừa (không đủ tên asset)</div>` : '') +
    (names.length > assetRenamer.files.length ? `<div style="padding:8px 14px;color:var(--text-dim);font-size:11px">${names.length - assetRenamer.files.length} asset thiếu ảnh</div>` : '') +
    `<div style="padding:8px 14px;color:var(--green);font-size:11px">✓ ${count} files sẵn sàng</div>`;
}

async function downloadAssetZip(){
  const names = document.getElementById('t3AssetNames').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!assetRenamer.files.length) return setStatus3('Cần thêm ảnh.', 'error');
  if (!names.length) return setStatus3('Cần danh sách tên assets.', 'error');
  if (typeof JSZip === 'undefined') return setStatus3('JSZip chưa tải.', 'error');

  const zip = new JSZip();
  const count = Math.min(assetRenamer.files.length, names.length);
  for (let i = 0; i < count; i++) {
    const f = assetRenamer.files[i];
    const ext = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    zip.file(names[i] + ext, await f.arrayBuffer());
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'assets-' + Date.now() + '.zip'; a.click();
  URL.revokeObjectURL(url);
  document.getElementById('assetZipStatus').innerHTML = '<span style="color:var(--green)">✓ Đã tạo ZIP với ' + count + ' ảnh.</span>';
}

function naturalSort(a, b){
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function setupDropzone(){
  const dz = document.getElementById('dropzone');
  if (!dz) return;
  const inp = document.getElementById('fileInput');
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files));
  });
  inp.addEventListener('change', e => addFiles(Array.from(e.target.files)));
}

function addFiles(files){
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return setStatus4('Chỉ chấp nhận file ảnh.', 'error');
  renamer.files = renamer.files.concat(imgs).sort(naturalSort);
  if (renamer.buildOrder) applyBuildOrderToFiles();
  else renderFileList();
  setStatus4(`Đã thêm ${imgs.length} ảnh. Tổng ${renamer.files.length}.`, 'ok');
}

function sortFiles(){
  renamer.files.sort(naturalSort);
  renderFileList();
  setStatus4('Đã sắp xếp lại theo tên.', 'ok');
}

function clearFiles(){
  if (!renamer.files.length) return;
  if (!confirm('Xoá tất cả?')) return;
  renamer.files = [];
  renamer.isB = [];
  renderFileList();
  setStatus4('Đã xoá.', 'ok');
}

function renderFileList(){
  const list = document.getElementById('fileList');
  if (!list) return;
  document.getElementById('fileCount').textContent = renamer.files.length + ' ảnh';
  if (!renamer.files.length) { list.innerHTML = '<div class="empty-state">Chưa có file.</div>'; return; }

  const start = parseInt(document.getElementById('startNum').value) || 1;
  const pad   = parseInt(document.getElementById('padding').value) || 3;
  const ext   = document.getElementById('keepExt').value;

  // Build new names — track scene counter, handle A/B
  // renamer.isB[i] = true nếu ảnh đó là ảnh B (nửa sau cảnh)
  if (!renamer.isB) renamer.isB = [];
  while (renamer.isB.length < renamer.files.length) renamer.isB.push(false);

  // Tính số thứ tự từng ảnh
  const names = [];
  let sceneNum = start;
  for (let i = 0; i < renamer.files.length; i++) {
    const f   = renamer.files[i];
    const oe  = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const ne  = ext === 'keep' ? oe : '.' + ext;
    const isB = renamer.isB[i];
    // Nếu là B → dùng cùng số với ảnh trước (A), thêm suffix 'b'
    // Nếu là A (nhưng có B theo sau) → suffix 'a'
    const nextIsB = renamer.isB[i + 1];
    const prevIsB = i > 0 && renamer.isB[i - 1];
    if (isB) {
      // B: dùng sceneNum hiện tại (chưa tăng)
      const num = String(sceneNum - 1).padStart(pad, '0');
      names.push({ num, suffix: 'b', ne, sceneNum: sceneNum - 1 });
    } else {
      const num = String(sceneNum).padStart(pad, '0');
      // A: có suffix 'a' nếu ảnh kế là B
      const suffix = nextIsB ? 'a' : '';
      names.push({ num, suffix, ne, sceneNum });
      sceneNum++;
    }
  }

  list.innerHTML = `<table class="scene-table">
    <thead><tr><th>#</th><th>File gốc</th><th></th><th>Tên mới</th><th>A/B</th><th></th></tr></thead>
    <tbody>` +
    renamer.files.map((f, i) => {
      const { num, suffix, ne } = names[i];
      const isB = renamer.isB[i];
      const newName = num + suffix + ne;
      const abBtn = `<button class="btn ghost sm" style="font-size:11px;padding:2px 7px;${isB ? 'background:var(--teal);color:#fff;border-color:var(--teal)' : 'color:var(--text-dim)'}"
        onclick="toggleB(${i})" title="${isB ? 'Đang là ảnh B — click để bỏ' : 'Đánh dấu là ảnh B (nửa sau cảnh)'}">${isB ? '🖼B' : '+B'}</button>`;
      return `<tr>
        <td class="id" style="color:${isB ? 'var(--teal)' : ''}">${num}${suffix}</td>
        <td style="color:var(--text-muted)">${escapeHtml(f.name)}</td>
        <td style="text-align:center;color:var(--text-dim)">→</td>
        <td style="color:var(--accent);font-weight:600">${escapeHtml(newName)}</td>
        <td>${abBtn}</td>
        <td class="actions"><button class="del" onclick="renamer.files.splice(${i},1);renamer.isB.splice(${i},1);renderFileList()" title="Xoá">×</button></td>
      </tr>`;
    }).join('') + `</tbody></table>
    <div style="padding:6px 14px;font-size:11px;color:var(--text-dim)">
      💡 Bấm <strong>+B</strong> để đánh dấu ảnh là "nửa sau" của cảnh trước → tên sẽ thêm hậu tố <strong>a/b</strong> (VD: 002a, 002b)
    </div>`;
}

function toggleB(i){
  if (!renamer.isB) renamer.isB = [];
  renamer.isB[i] = !renamer.isB[i];
  renderFileList();
}

function loadFromTool2ForRenamer(){
  if (!state.scenes || !state.scenes.length)
    return setStatus4('❌ Chưa có dữ liệu Tool 2 — hãy chia cảnh trước.', 'error');

  // Build order + bSet từ state trực tiếp
  const buildOrder = [];
  const bSet = new Set();
  state.scenes.forEach(s => {
    const hasB = !!(state.scenePrompts2 && state.scenePrompts2[s.id] && state.scenePrompts2[s.id].trim());
    if (hasB) {
      buildOrder.push(s.id + 'a');
      buildOrder.push(s.id + 'b');
      bSet.add(s.id + 'b');
    } else {
      buildOrder.push(s.id);
    }
  });

  renamer.buildOrder = buildOrder;
  renamer.bSet = bSet;

  if (renamer.files.length) applyBuildOrderToFiles();

  const bCount = bSet.size;
  setStatus4(`✓ Load từ Tool 2: ${buildOrder.length} slots (${bCount} ảnh B). ${renamer.files.length ? 'Đã tự điền A/B.' : 'Kéo ảnh vào để tự điền.'}`, 'ok');
}

async function loadXlsxForRenamer(input){
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  if (typeof XLSX === 'undefined') return setStatus4('Thư viện XLSX chưa tải.', 'error');
  setStatus4('Đang đọc scene-list.xlsx...', 'working');
  try {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    if (!wb.SheetNames.includes('build')) {
      return setStatus4('❌ Không tìm thấy sheet "build" trong file XLSX — hãy xuất lại từ Tool 2.', 'error');
    }
    const ws   = wb.Sheets['build'];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    // Lấy danh sách scene_id từ sheet build theo thứ tự
    const buildOrder = rows.map(r => String(r['scene_id'] || '').trim()).filter(Boolean);
    if (!buildOrder.length) return setStatus4('❌ Sheet "build" trống.', 'error');

    // Map: scene_id → index trong buildOrder
    const sceneIndex = {};
    buildOrder.forEach((sid, i) => { sceneIndex[sid] = i; });

    // Tìm các scene_id kết thúc bằng 'b' → là ảnh B
    // VD: "001b", "014b" — phân biệt với tên không có suffix
    const bSet = new Set(buildOrder.filter(sid => /^[0-9]+b$/.test(sid)));

    // Nếu chưa có ảnh thì chỉ lưu thứ tự để dùng khi kéo ảnh vào
    renamer.buildOrder = buildOrder;
    renamer.bSet = bSet;

    // Nếu đã có ảnh → tự map và set isB
    if (renamer.files.length) {
      applyBuildOrderToFiles();
    }

    const bCount = bSet.size;
    setStatus4(`✓ Đọc được ${buildOrder.length} cảnh từ sheet "build" (${bCount} ảnh B). ${renamer.files.length ? 'Đã tự điền A/B.' : 'Kéo ảnh vào để tự điền.'}`, 'ok');
  } catch(e) {
    setStatus4('❌ Lỗi đọc XLSX: ' + e.message, 'error');
  }
}

function applyBuildOrderToFiles(){
  if (!renamer.buildOrder || !renamer.buildOrder.length) return;
  const bSet = renamer.bSet || new Set();
  if (!renamer.isB) renamer.isB = [];
  // Sort files theo buildOrder: files được sắp xếp theo natural sort trước
  // Gán isB[i] = true nếu file thứ i trong danh sách sau khi sort tương ứng với scene là B
  // Logic: đếm sequential — file thứ i map với buildOrder[i]
  for (let i = 0; i < renamer.files.length; i++) {
    const sid = renamer.buildOrder[i];
    renamer.isB[i] = sid ? bSet.has(sid) : false;
  }
  renderFileList();
}

async function downloadZip(){
  if (typeof gateTool==='function' && gateTool('tool4')) return;
  if (!renamer.files.length) return setStatus4('Không có file.', 'error');
  if (typeof JSZip === 'undefined') return setStatus4('JSZip chưa tải.', 'error');

  setStatus4('Đang tạo ZIP...', 'working');
  const zip  = new JSZip();
  const start = parseInt(document.getElementById('startNum').value) || 1;
  const pad   = parseInt(document.getElementById('padding').value) || 3;
  const ext   = document.getElementById('keepExt').value;
  if (!renamer.isB) renamer.isB = [];

  let sceneNum = start;
  let abCount = 0;
  for (let i = 0; i < renamer.files.length; i++) {
    const f   = renamer.files[i];
    const oe  = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const ne  = ext === 'keep' ? oe : '.' + ext;
    const isB = renamer.isB[i] || false;
    const nextIsB = renamer.isB[i + 1] || false;

    let filename;
    if (isB) {
      filename = String(sceneNum - 1).padStart(pad, '0') + 'b' + ne;
      abCount++;
    } else {
      const suffix = nextIsB ? 'a' : '';
      filename = String(sceneNum).padStart(pad, '0') + suffix + ne;
      sceneNum++;
    }
    zip.file(filename, await f.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = 'images-' + Date.now() + '.zip'; a.click();
  URL.revokeObjectURL(u);
  const msg = abCount > 0
    ? `✓ ZIP ${renamer.files.length} ảnh (${abCount} ảnh B có hậu tố a/b).`
    : `✓ ZIP ${renamer.files.length} ảnh.`;
  setStatus4(msg, 'ok');
}

function savePexelsKey(){
  const el = document.getElementById('pexelsKey'); if (!el) return;
  const key = el.value.trim();
  // bỏ 'if (!key) return' — xoá ô rồi bấm Lưu là phải xoá được key sai, chứ không
  // phải im lặng giữ nguyên cái cũ (hai hàm Pixabay/Unsplash bên dưới vốn đã vậy).
  try { localStorage.setItem('pexels-key', key); } catch (e) {}
  try { delete _t2StockTT['pexels']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Pexels API key.', 'ok');
}

function loadPexelsKey(){
  try {
    const el = document.getElementById('pexelsKey'); if (!el) return;
    const k = localStorage.getItem('pexels-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('pexels-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getPexelsKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('pexelsKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('pexels-key') || '').trim(); } catch (e) { return ''; }
}

function loadScenesForSearch(){
  if (state.scenes.length === 0) return setStatus5('Tool 02 chưa có cảnh. Chia cảnh trước.', 'error');
  renderSceneSearchList();
  updatePickCount();
  setStatus5(`✓ Đã load ${state.scenes.length} cảnh từ Tool 02.`, 'ok');
}

function renderSceneSearchList(){
  const box = document.getElementById('mediaSearchResults');
  if (!box) return;
  box.innerHTML = state.scenes.map(s => `
    <div class="panel mb-16" id="media-${s.id}">
      <div class="panel-head">
        <span style="color:var(--accent);font-weight:600">[${s.id}]</span>
        <span style="flex:1;margin-left:10px;font-size:12.5px;color:var(--text);font-weight:400;text-transform:none;letter-spacing:0">${escapeHtml(s.text)}</span>
        <button class="btn ghost sm" onclick="searchForScene('${s.id}')">🔍 Tìm</button>
      </div>
      <div class="panel-body" id="media-results-${s.id}" style="min-height:40px">
        <span style="color:var(--text-dim);font-size:11.5px">Bấm Tìm hoặc Tìm tất cả</span>
      </div>
    </div>
  `).join('');
  // Khôi phục kết quả đã tìm trong phiên + lựa chọn đã lưu
  for (const s of state.scenes) {
    const cached = _t5Results[s.id];
    if (cached) renderSceneResults(s.id, cached.keywords, cached);
    else if (state.mediaPicks?.[s.id]) renderSceneResults(s.id, '', { photos: [], videos: [] });
  }
}

async function generateSearchAngles(voText, opts){
  const o = opts || {};
  const topic = String(state.videoLogline || '').trim();
  const vaiTro = o.role || ((state.aiMap || {})[o.sceneId] || {}).role || '';
  const truoc = String(o.truoc || '').trim(), sau = String(o.sau || '').trim();

  const prompt = `You are a footage researcher for documentary-style videos. Generate stock-library SEARCH KEYWORDS.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}${vaiTro ? 'SCENE ROLE: ' + vaiTro + '\n' : ''}
THIS SCENE'S VOICEOVER LINE: "${voText}"
${truoc ? 'Previous line: "' + truoc + '"\n' : ''}${sau ? 'Next line: "' + sau + '"\n' : ''}
⚠️ COMMON TRAP: voiceover lines often borrow an object for COMPARISON ("cheaper than a cup of coffee",
"big as a bus", "thin as paper"). That object is NOT the subject of the scene —
the subject is what the whole video is about. Pulling eight coffee clips for a video about
aviation is wrong. If there is a comparison object, put it in the "doi-chieu" angle, NEVER
as the first angle.

Return 2–3 DIFFERENT search angles, each 2–4 short English keywords (concrete nouns,
no vague adjectives). You may add EXACTLY 1 camera keyword if it truly fits:
aerial, close-up, macro, top-down, timelapse, slow motion, handheld.

Usable angles:
- "chu-the"   — the literal thing this scene talks about. ALWAYS present, always first.
- "boi-canh"  — surrounding place / atmosphere, for b-roll.
- "doi-chieu" — an object used for comparison or metaphor, ONLY if the line truly has one.

Return JSON: [{"goc":"chu-the","q":"airline profit margin"},{"goc":"boi-canh","q":"airport terminal wide"}]`;

  try {
    const arr = await callLLMJson(prompt, { maxTokens: 300,
      validate: a => Array.isArray(a) && a.length > 0 && a.every(x => x && x.q) });
    const ok = ['chu-the', 'boi-canh', 'doi-chieu'];
    const ra = arr.map(x => ({ goc: ok.includes(x.goc) ? x.goc : 'chu-the', q: String(x.q || '').trim() }))
      .filter(x => x.q).slice(0, 3);
    // Ép chủ thể lên đầu: model đôi khi vẫn xếp đối chiếu trước dù đã dặn.
    ra.sort((a, b) => ok.indexOf(a.goc) - ok.indexOf(b.goc));
    return ra.length ? ra : null;
  } catch (_) { return null; }
}

function _t2TronNguon(cands){
  const theo = {};
  cands.forEach(c => { (theo[c.source || 'stock'] = theo[c.source || 'stock'] || []).push(c); });
  const ds = Object.values(theo), ra = [];
  const n = Math.max(0, ...ds.map(a => a.length));
  for (let i = 0; i < n; i++) for (const a of ds) if (a[i]) ra.push(a[i]);
  return ra;
}

function _t2TronGoc(theoGoc){
  const ra = [], n = Math.max(...theoGoc.map(g => g.cands.length), 0);
  for (let i = 0; i < n; i++)
    for (const g of theoGoc)
      if (g.cands[i]) ra.push(Object.assign({ goc: g.goc, q: g.q }, g.cands[i]));
  return ra;
}

async function generateSearchKeywords(voText, opts){
  // fallback: rút vài từ khoá từ chính VO nếu AI lỗi
  const fallback = () => (voText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(', ')) || voText.slice(0, 40);
  const o = opts || {};
  // Giữ tương thích: bậc cũ {broader:true} tương đương bậc 3.
  const bac = Number(o.bac) || (o.broader ? 3 : 1);
  const chuDe = String(state.videoLogline || '').trim();

  const LUAT = 'Rules: the subject goes FIRST. Return a JSON array where EACH ELEMENT IS ONE short English keyword '
    + '(2-4 elements), do not cram multiple keywords into one element, do not repeat the subject across elements. '
    + 'Stock libraries search by keyword, they do not understand sentences — no full sentences, no vague adjectives '
    + '(beautiful, amazing, stunning). You may add 1 camera keyword if it fits: aerial, close-up, timelapse, slow motion.';

  const P = {
    1: `Generate 2-4 stock photo/video search keywords for the content below — TIER "EXACT": the actual event, subject or action mentioned.
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.
CONTENT: "${voText}"`,

    2: `Exact-tier keywords for "${voText}" are returning 0 results.
Generate 2-4 English keywords for TIER "SURROUNDINGS": stop searching for the event itself, search what is AROUND it —
the place it happens, related objects, crowds, building facades, equipment, vehicles.
Example: "an airline-margin hearing" → tier 2 is "airport terminal exterior, airline counter, boarding gate".
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.`,

    3: `Both previous tiers for "${voText}" returned 0 results.
Generate 2-3 BROAD, SIMPLE English keywords for TIER "GENERIC B-ROLL": pretty b-roll on the same topic,
accepting no detail match, as long as it surely exists in stock libraries.
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.`,
  };

  try {
    const arr = await callLLMJson(P[bac] || P[1], { maxTokens: 200, validate: a => Array.isArray(a) && a.length > 0 });
    /* Luật "chủ thể đứng ĐẦU" khiến model hay lặp lại chủ thể trước mỗi từ khoá:
       "Warren Buffett, portrait, Warren Buffett, speaking, Warren Buffett".
       Trùng lặp chỉ làm loãng truy vấn — bỏ trùng, không phân biệt hoa thường. */
    const thay = new Set();
    return arr
      .flatMap(s => String(s).split(','))        // mỗi phần tử có thể là "a, b, c" → tách ra đã
      .map(s => s.trim()).filter(Boolean)
      .filter(s => { const k = s.toLowerCase(); if (thay.has(k)) return false; thay.add(k); return true; })
      .slice(0, 5).join(', ');
  } catch (_) {
    return fallback();
  }
}

function savePixabayKey(){
  const key = document.getElementById('pixabayKey').value.trim();
  try { localStorage.setItem('pixabay-key', key); } catch (e) {}
  try { delete _t2StockTT['pixabay']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Pixabay API key.', 'ok');
}

function loadPixabayKey(){
  try {
    const el = document.getElementById('pixabayKey'); if (!el) return;
    const k = localStorage.getItem('pixabay-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('pixabay-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getPixabayKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('pixabayKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('pixabay-key') || '').trim(); } catch (e) { return ''; }
}

function saveUnsplashKey(){
  const key = document.getElementById('unsplashKey').value.trim();
  try { localStorage.setItem('unsplash-key', key); } catch (e) {}
  try { delete _t2StockTT['unsplash']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Unsplash Access Key.', 'ok');
}

function loadUnsplashKey(){
  try {
    const el = document.getElementById('unsplashKey'); if (!el) return;
    const k = localStorage.getItem('unsplash-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('unsplash-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getUnsplashKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('unsplashKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('unsplash-key') || '').trim(); } catch (e) { return ''; }
}

async function searchUnsplash(query, type = 'both'){
  const key = getUnsplashKey();
  const results = { photos: [], videos: [] };
  if (!key || type === 'videos') return results;
  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=4&orientation=landscape`,
      { headers: { 'Authorization': 'Client-ID ' + key } }
    );
    if (r.ok) {
      const d = await r.json();
      results.photos = (d.results || []).map(h => ({
        url: h.links?.html || h.urls?.regular,
        width: h.width, height: h.height,
        src: { small: h.urls?.small, large: h.urls?.regular, original: h.urls?.full },
        _source: 'unsplash',
        _downloadUrl: h.urls?.full || h.urls?.regular
      }));
    } else results._err = 'Unsplash ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 403 ? ' — hết lượt' : ''));
  } catch (e) { results._err = 'Unsplash: ' + String(e.message || e).slice(0, 40); }
  return results;
}

function _pixabayThumbFromUrl(u){
  const s = String(u || '');
  return /^https?:\/\/cdn\.pixabay\.com\/video\/.+\.mp4/i.test(s) ? s.split('?')[0].replace(/\.mp4$/i, '.jpg') : '';
}

function _stockThumb(c){
  if (!c) return '';
  const t = c.thumb || c.thumbnail || '';
  if (t && !/i\.vimeocdn\.com/i.test(t) && !/undefined/.test(t)) return t;
  return _pixabayThumbFromUrl(c.downloadUrl || c.url) || (/i\.vimeocdn\.com|undefined/i.test(t) ? '' : t);
}

async function searchPixabay(query, type = 'both'){
  const key = getPixabayKey();
  if (!key) return { photos: [], videos: [] };
  const results = { photos: [], videos: [] };

  if (type === 'both' || type === 'photos') {
    try {
      const r = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&per_page=8&orientation=horizontal&image_type=photo`);
      if (r.ok) {
        const d = await r.json();
        // Chuẩn hoá về format giống Pexels
        results.photos = (d.hits || []).map(h => ({
          url: h.pageURL,
          width: h.imageWidth, height: h.imageHeight,
          src: { small: h.previewURL, large: h.largeImageURL, original: h.largeImageURL },
          _source: 'pixabay',
          _downloadUrl: h.largeImageURL
        }));
      }
      else results._err = 'Pixabay ' + r.status + (r.status === 429 ? ' — hết lượt' : '');
    } catch (e) { results._err = 'Pixabay: ' + String(e.message || e).slice(0, 40); }
  }

  if (type === 'both' || type === 'videos') {
    try {
      const r = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=8`);
      if (r.ok) {
        const d = await r.json();
        results.videos = (d.hits || []).map(h => ({
          url: h.pageURL,
          duration: h.duration,
          // Pixabay đã BỎ trường picture_id → link i.vimeocdn.com/video/undefined_… luôn 404
          // (ô xem trước đen thui). Ảnh đại diện giờ nằm ngay trong từng cỡ video.
          image: (h.videos?.large?.thumbnail || h.videos?.medium?.thumbnail || h.videos?.small?.thumbnail
                  || h.videos?.tiny?.thumbnail || _pixabayThumbFromUrl(h.videos?.large?.url) || ''),
          _source: 'pixabay',
          _downloadUrl: (h.videos?.large?.url || h.videos?.medium?.url || h.videos?.small?.url)
        }));
      }
      else results._err = 'Pixabay ' + r.status + (r.status === 429 ? ' — hết lượt' : '');
    } catch (e) { results._err = 'Pixabay: ' + String(e.message || e).slice(0, 40); }
  }
  return results;
}

async function _khoJson(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(r.status + '');
  return r.json();
}

async function _khoWikimedia(q, n){
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + '&generator=search&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap')
    + '&gsrnamespace=6&gsrlimit=' + n + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280';
  const d = await _khoJson(u);
  return Object.values((d.query && d.query.pages) || {}).map(p => {
    const ii = (p.imageinfo || [])[0] || {}, m = ii.extmetadata || {};
    const lic = _khoText((m.LicenseShortName || {}).value);
    if (!_khoOk(lic)) return null;
    const url = ii.thumburl || ii.url;
    // ii.url giờ kèm tham số UTM (…?utm_source=…&utm_content=original) nên phải cắt
    // query trước khi kiểm đuôi file, không thì mọi ảnh đều bị loại.
    const sach = String(ii.url || '').split('?')[0];
    // Wikimedia dựng sẵn bản thu nhỏ JPEG cho cả .TIF/.SVG, nên soi ĐUÔI FILE GỐC
    // là loại oan ảnh dùng được (đã đo: mất "Nut cracking Sapajus libidinosus.TIF").
    // Có thumburl nghĩa là Wikimedia render được — chỉ cần chặn thẳng tài liệu/âm thanh.
    if (!url || !ii.thumburl) return null;
    if (/\.(pdf|djvu|ogg|oga|mid|flac|wav|webm|ogv|mp3)$/i.test(sach)) return null;
    return { url: p.title, src: { small: ii.thumburl || url, large: url, original: ii.url || url },
      _source: 'wikimedia', _downloadUrl: ii.url || url,
      _license: lic, _author: _khoText((m.Artist || {}).value).slice(0, 60) };
  }).filter(Boolean);
}

async function _khoNasa(q, n){
  const d = await _khoJson('https://images-api.nasa.gov/search?media_type=image&q=' + encodeURIComponent(q));
  return ((d.collection && d.collection.items) || []).slice(0, n).map(it => {
    const dat = (it.data || [])[0] || {}, link = (it.links || [])[0] || {};
    if (!link.href) return null;
    return { url: dat.nasa_id, src: { small: link.href, large: link.href, original: link.href },
      _source: 'nasa', _downloadUrl: link.href, _license: 'Public domain (NASA)',
      _author: _khoText(dat.center || 'NASA') };
  }).filter(Boolean);
}

async function _khoOpenverse(q, n){
  const d = await _khoJson('https://api.openverse.org/v1/images/?page_size=' + n
    + '&q=' + encodeURIComponent(q));
  return (d.results || []).map(r => {
    const lic = String(r.license || '') + (r.license_version ? ' ' + r.license_version : '');
    if (!_khoOk(lic)) return null;                      // chặn by-nc / by-nd ngay ở đây
    const url = r.url || r.thumbnail;
    if (!url) return null;
    return { url: r.foreign_landing_url || url, src: { small: r.thumbnail || url, large: url, original: url },
      _source: 'openverse', _downloadUrl: url,
      _license: 'CC ' + lic.toUpperCase(), _author: _khoText(r.creator).slice(0, 60) };
  }).filter(Boolean);
}

async function _khoArchive(q, n){
  const truyVan = q + ' AND mediatype:(movies) AND (licenseurl:(*creativecommons*) OR rights:(*public domain*))';
  const d = await _khoJson('https://archive.org/advancedsearch.php?output=json&rows=' + n
    + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=licenseurl&fl%5B%5D=creator'
    + '&q=' + encodeURIComponent(truyVan));
  return ((d.response && d.response.docs) || []).map(x => {
    const lic = String(x.licenseurl || 'public domain');
    if (x.licenseurl && _KHO_CAM.test(lic)) return null;
    return { url: 'https://archive.org/details/' + x.identifier, duration: 0,
      image: 'https://archive.org/services/img/' + x.identifier,
      _source: 'archive', _downloadUrl: 'https://archive.org/download/' + x.identifier + '/' + x.identifier + '.mp4',
      _license: lic.replace('https://creativecommons.org/', 'CC ').replace(/\/$/, ''),
      _author: _khoText(x.creator).slice(0, 60), _canKiem: true };
  }).filter(Boolean);
}

async function searchOpenArchives(query, type = 'both'){
  const kq = { photos: [], videos: [] };
  const loi = [];
  const chay = [];
  if (type !== 'videos'){
    chay.push(['Wikimedia', _khoWikimedia(query, 6)], ['NASA', _khoNasa(query, 5)], ['Openverse', _khoOpenverse(query, 6)]);
  }
  if (type !== 'photos') chay.push(['Archive.org', _khoArchive(query, 6)]);
  const ra = await Promise.all(chay.map(([ten, p]) => p.then(v => ({ ten, v })).catch(e => ({ ten, e }))));
  ra.forEach(({ ten, v, e }) => {
    if (e){ loi.push(ten + ': ' + String(e.message || e).slice(0, 24)); return; }
    if (ten === 'Archive.org') kq.videos.push(...v); else kq.photos.push(...v);
  });
  if (loi.length) kq._err = loi;
  return kq;
}

async function searchPexels(query, type = 'both'){
  const key = getPexelsKey();
  const results = { photos: [], videos: [] };
  if (!key) return results;
  const headers = { 'Authorization': key };

  if (type === 'both' || type === 'photos') {
    try {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        results.photos = (d.photos || []).map(p => ({ ...p, _source: 'pexels', _downloadUrl: p.src?.original || p.src?.large2x || p.src?.large }));
      } else results._err = 'Pexels ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 429 ? ' — hết lượt hôm nay' : ''));
    } catch (e) { results._err = 'Pexels: ' + String(e.message || e).slice(0, 40); }
  }

  if (type === 'both' || type === 'videos') {
    try {
      const r = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        results.videos = (d.videos || []).map(v => {
          // Lấy file video chất lượng cao nhất
          const best = (v.video_files || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
          return { ...v, _source: 'pexels', _downloadUrl: best?.link || '' };
        });
      } else results._err = 'Pexels ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 429 ? ' — hết lượt hôm nay' : ''));
    } catch (e) { results._err = 'Pexels: ' + String(e.message || e).slice(0, 40); }
  }
  return results;
}

async function searchAllSources(query, type = 'both'){
  const [pexels, pixabay, unsplash] = await Promise.all([
    searchPexels(query, type),
    searchPixabay(query, type),
    searchUnsplash(query, type)
  ]);
  // Nguồn nào hỏng thì NÓI RA. Trước đây trả mảng rỗng nên key sai vẫn im như thóc,
  // người dùng chỉ thấy "ít ứng viên" mà không biết một nguồn đang chết.
  // Kho mở chỉ chạy khi người dùng BẬT — nó thêm 4 lượt gọi mạng mỗi lần tìm.
  let kho = { photos: [], videos: [] };
  if ((state.nguonBat || {}).kho){
    try { kho = await searchOpenArchives(query, type); } catch (e) { kho = { photos: [], videos: [], _err: ['Kho mở: ' + String(e.message || e).slice(0, 30)] }; }
  }
  const _err = [pexels._err, pixabay._err, unsplash._err].filter(Boolean).concat(kho._err || []);
  return {
    _err,
    photos: [...(pexels.photos || []), ...(pixabay.photos || []), ...(unsplash.photos || []), ...(kho.photos || [])],
    videos: [...(pexels.videos || []), ...(pixabay.videos || []), ...(kho.videos || [])]
  };
}

async function searchForScene(sceneId){
  const scene = state.scenes.find(s => s.id === sceneId);
  if (!scene) return;
  if (!getPexelsKey() && !getPixabayKey() && !getUnsplashKey()) return setStatus5('Cần ít nhất 1 API key (Pexels / Pixabay / Unsplash).', 'error');

  const box = document.getElementById('media-results-' + sceneId);
  box.innerHTML = '<div style="font-size:11.5px;color:var(--violet);margin-bottom:8px"><span class="spinner" style="vertical-align:-2px"></span> Đang tìm media...</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + '<div class="skeleton sk-tile"></div>'.repeat(6) + '</div>';

  try {
    let keywords = await generateSearchKeywords(scene.text);
    const type = document.getElementById('mediaType').value;
    let results = await searchAllSources(keywords, type);
    // Query rỗng kết quả → tự thử lại 1 lần với từ khoá rộng/đơn giản hơn (thay vì để trắng cảnh)
    if (!(results.photos || []).length && !(results.videos || []).length) {
      try {
        const broaderKw = await generateSearchKeywords(scene.text, { broader: true });
        if (broaderKw && broaderKw !== keywords) {
          const retryResults = await searchAllSources(broaderKw, type);
          if ((retryResults.photos || []).length || (retryResults.videos || []).length) {
            keywords = broaderKw + ' (đã nới rộng)';
            results = retryResults;
          }
        }
      } catch (_) { /* giữ kết quả rỗng ban đầu nếu retry cũng lỗi */ }
    }
    _t5Results[sceneId] = { keywords, photos: results.photos || [], videos: results.videos || [] };
    renderSceneResults(sceneId, keywords, results);
  } catch (e) {
    box.innerHTML = '<span style="color:var(--red);font-size:11.5px">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
}

function _t2LoaiMedia(scene){
  const sh = String((scene && scene.shot) || '').toLowerCase();
  if (_T2_CANH_ANH.has(sh)) return 'photos';
  // Kho mở gần như chỉ có ảnh → cảnh giao cho kho thì nhận cả hai, khỏi trắng tay.
  if (scene && scene.wantKho) return 'both';
  return 'videos';
}

function _t2LoaiNguon(ten){
  const t = String(ten || '');
  if (!t) return null;
  for (const x of _T2_LOAI_NGUON) if (x.re.test(t)) return x;
  return null;
}

function _t2LyDoChu(bo){
  const e = Object.entries(bo || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return e.slice(0, 3).map(([k, v]) => `${v} ${_T2_LY_DO[k] || k}`).join(', ');
}

function _t2ChamUngVien(c, scene, daDung){
  if (!c) return { diem: -99, loai: 'rong' };
  let d = 0;
  const ten = String(c.ten || c.title || '').trim();
  const giay = Number(c.duration) || 0;
  const canh = Math.max(1, parseFloat(scene && scene.duration) || 4);

  // ① Vừa thời lượng — clip NGẮN HƠN cảnh là không lấp đủ, phải loại thẳng.
  if (giay > 0){
    if (giay < canh * 0.9) return { diem: -99, loai: 'qua-ngan' };
    if (giay >= canh * 1.5 && giay <= 600) d += 3;        // dư dải để cắt, lại không phải phim dài
    else if (giay > 3600) d -= 2;                          // hơn 1 tiếng: tải lâu, hay là bản full
  }

  // ② Phạt trùng lặp — cùng một clip dùng ở hai cảnh là lộ ngay khi xem.
  const khoa = String(c.trangUrl || c.downloadUrl || '');
  if (khoa && daDung && daDung.has(khoa)) return { diem: -99, loai: 'trung-lap' };

  // ③ Phân loại theo tiêu đề. Chỉ chấm khi CÓ tiêu đề (ứng viên stock không có).
  if (ten){
    const lop = _t2LoaiNguon(ten);
    if (lop){
      if (lop.chan) return { diem: -99, loai: lop.lop };    // loại thẳng, không cứu được
      d += lop.d;
    }
    // ④ Phạt tiêu đề chung chung / nhiều thẻ băm; cộng cho dấu hiệu b-roll tốt.
    if (_T2_TIEU_DE_CHUNG.test(ten)) d -= 2;
    if (_T2_TIEU_DE_TOT.test(ten)) d += 1.5;
    if ((ten.match(/#/g) || []).length >= 2) d -= 2;
    if (ten.length >= 18) d += 1;                          // tiêu đề có mô tả thật
  }

  // Ảnh tĩnh không có thời lượng — không phạt, nhưng nhường video khi cùng điểm.
  if (c.kind === 'image') d -= 0.5;
  if (c.thumb) d += 0.5;                                   // có ảnh xem trước = ứng viên thật

  return { diem: d, loai: '' };
}

function _t2XepUngVien(cands, scene, daDung){
  const nhan = [], bo = {};
  (cands || []).forEach(c => {
    const r = _t2ChamUngVien(c, scene, daDung);
    if (r.loai){ bo[r.loai] = (bo[r.loai] || 0) + 1; return; }
    nhan.push({ c, d: r.diem });
  });
  nhan.sort((a, b) => b.d - a.d);
  return { ds: nhan.map(x => x.c), bo };
}

function _t2DaDung(trSceneId){
  const s = new Set();
  const mp = state.mediaPicks || {};
  for (const id in mp){
    if (id === trSceneId) continue;
    const v = mp[id]; if (!v) continue;
    const k = String(v.trangUrl || v.downloadUrl || '');
    if (k) s.add(k);
  }
  return s;
}

function _t2StockCands(res, type){
  const out = [];
  if (type !== 'photos') (res.videos || []).forEach(v => { if (v && v._downloadUrl) out.push({ kind: 'video', downloadUrl: v._downloadUrl, source: v._source || 'stock', duration: v.duration || 0, thumb: v.image || _pixabayThumbFromUrl(v._downloadUrl) || '', license: v._license || '', author: v._author || '' }); });
  if (type !== 'videos') (res.photos || []).forEach(p => { if (p && p._downloadUrl) out.push({ kind: 'image', downloadUrl: p._downloadUrl, source: p._source || 'stock', duration: 0, thumb: (p.src && p.src.small) || p._downloadUrl || '', license: p._license || '', author: p._author || '' }); });
  return out;
}

function _t2WebPickerRender(sceneId, note){
  const m = document.getElementById('t2WebPickerModal'); if (!m) return;
  const cands = (state.webCandidates || {})[sceneId] || [];
  const so = (state.scenes || []).findIndex(s => s.id === sceneId) + 1;
  const dung = (state.mediaPicks || {})[sceneId] || {};
  const dangDung = dung.trangUrl || '';

  const the = cands.map((c, i) => {
    const chon = dangDung && (c.trangUrl === dangDung);
    const gp = c.license ? escapeHtml(String(c.license).slice(0, 30)) : '';
    const tg = c.author ? escapeHtml(String(c.author).slice(0, 26)) : '';
    const rui = c.nhom && c.nhom !== 'cong';
    return `<div style="width:212px;border-radius:9px;overflow:hidden;border:2px solid ${chon ? 'var(--accent)' : 'var(--border)'};background:var(--surface-2);display:flex;flex-direction:column">
      <div onclick="t2PickWeb('${sceneId}',${i})" style="cursor:pointer;position:relative;height:120px;background:#000">
        ${c.thumb ? `<img src="${escapeHtml(c.thumb)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.opacity=.15">`
                  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:22px">🌐</div>'}
        <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.68);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px">${c.duration ? c.duration + 's' : 'video'}</span>
        ${chon ? '<span style="position:absolute;top:6px;right:6px;background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">✓ Đang dùng</span>' : ''}
        ${c.camTM ? '<span title="Giấy phép CẤM dùng thương mại hoặc cấm sửa đổi — kênh bật kiếm tiền dùng là vi phạm. Lượt tự động đã bỏ qua thẻ này." style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.8);color:#ff6b6b;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px">⛔ cấm thương mại</span>'
          : (rui ? '<span title="Nội dung có bản quyền — cân nhắc khi bật kiếm tiền" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.68);color:var(--amber);font-size:10px;padding:2px 5px;border-radius:4px">⚠️ bản quyền</span>' : '')}
      </div>
      <div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);line-height:1.45;flex:1 1 auto">
        <div style="font-weight:650;color:var(--text);max-height:28px;overflow:hidden">${escapeHtml(String(c.ten || '').slice(0, 62))}</div>
        <div style="margin-top:3px">${_srcBadge(c.source)}</div>
        ${gp ? `<div style="color:var(--teal)">📄 ${gp}</div>` : ''}
        ${tg ? `<div style="color:var(--text-dim)">© ${tg}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;padding:0 8px 8px">
        <button class="btn ghost sm" style="flex:1;font-size:10.5px;padding:4px" onclick="t2PickWeb('${sceneId}',${i})">Dùng cảnh này</button>
        <button class="btn ghost sm" style="font-size:10.5px;padding:4px 7px" title="Sao chép link trang gốc (app không mở cửa sổ ngoài)" onclick="event.stopPropagation();novaCopyLink('${escapeHtml(c.trangUrl || '')}')">↗</button>
      </div>
    </div>`;
  }).join('');

  const nhip = (typeof webTrangThaiNhip === 'function') ? webTrangThaiNhip() : null;
  const nhipTxt = nhip ? `Tìm web đã dùng ${nhip.daDung}/${nhip.tran} lượt phiên này${nhip.chan ? ' · <span style="color:var(--amber)">đang bị chặn nhịp</span>' : ''}.` : '';
  m.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(940px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:15px 18px 10px;border-bottom:1px solid var(--border);flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:14.5px;font-weight:750">🌐 Tư liệu web — cảnh ${so}</span>
      <span style="font-size:11px;color:var(--text-dim)">${cands.length} ứng viên</span>
      <span style="flex:1"></span>
      <input id="t2WebKw" placeholder="Gõ từ khoá tiếng Anh rồi bấm Tìm thêm" style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:6px 10px;font-size:12px;width:250px">
      <button class="btn ghost sm" id="t2WebMoreBtn" onclick="t2WebTimThem('${sceneId}')">🔎 Tìm thêm</button>
      <button class="btn ghost sm" onclick="webMoBang()">⚙ Nền tảng</button>
      <button class="btn ghost sm" onclick="t2CloseWebPicker()">Đóng</button>
    </div>
    <div id="t2WebNote" style="padding:8px 18px 0;font-size:11px;color:var(--text-dim);line-height:1.55;flex:0 0 auto">${note ? escapeHtml(note) + '<br>' : ''}${nhipTxt}</div>
    <div style="padding:12px 18px 16px;overflow:auto;flex:1 1 auto;display:flex;flex-wrap:wrap;gap:10px">${the || '<div style="color:var(--text-dim);font-size:12px">Chưa có ứng viên nào.</div>'}</div>
  </div>`;
}

async function searchAllScenes(){
  if (typeof gateTool==='function' && gateTool('tool5')) return;
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  if (!getPexelsKey() && !getPixabayKey() && !getUnsplashKey()) return setStatus5('Cần ít nhất 1 API key (Pexels / Pixabay / Unsplash).', 'error');
  setStatus5('Đang tìm media cho tất cả cảnh...', 'working');
  clearCancel();

  for (let i = 0; i < state.scenes.length; i++) {
    if (state.cancelRequested) {
      clearCancel();
      document.getElementById('searchProgress').textContent = '';
      setStatus5(`⏸ Đã dừng tại cảnh ${i + 1}/${state.scenes.length}. Kết quả đã tìm được giữ lại.`, 'info');
      return;
    }
    document.getElementById('searchProgress').textContent = `${i + 1}/${state.scenes.length}`;
    await searchForScene(state.scenes[i].id);
    await new Promise(r => setTimeout(r, 200));
  }
  document.getElementById('searchProgress').textContent = '';
  setStatus5(`✓ Đã tìm xong ${state.scenes.length} cảnh.`, 'ok');
}

function _srcBadge(s){
  // Nguồn web mang dạng 'web:<id>' — nhãn tra từ danh sách 55 nền tảng, kèm ⚠️
  // cho nhóm báo đài / mạng xã hội để rủi ro bản quyền hiện ngay trên thẻ.
  if (typeof s === 'string' && s.startsWith('web:') && typeof webNhan === 'function') return webNhan(s.slice(4));
  return { pixabay: '🟢 Pixabay', unsplash: '🟣 Unsplash', pexels: '🔵 Pexels',
    wikimedia: '🏛 Wikimedia', nasa: '🚀 NASA', openverse: '🧩 Openverse', archive: '📼 Archive' }[s] || '🔵 Pexels';
}

function renderSceneResults(sceneId, keywords, results){
  // Số thứ tự cảnh để đặt tên file (001, 002...)
  const sceneIdx = state.scenes.findIndex(s => s.id === sceneId);
  const sceneNum = sceneIdx >= 0 ? sceneIdx + 1 : '';
  const box = document.getElementById('media-results-' + sceneId);
  if (!box) return;
  const photos = results.photos || [];
  const videos = results.videos || [];
  const pick = state.mediaPicks?.[sceneId];
  const pickedUrl = pick?.downloadUrl || '';

  let html = '';
  // Tóm tắt lựa chọn hiện tại
  if (pick) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 10px;background:var(--accent-soft);border-radius:6px;font-size:11.5px">
      <span style="color:var(--accent);font-weight:600">✓ Đã chọn:</span>
      <span>${pick.kind === 'video' ? '🎬' : '📷'} ${_srcBadge(pick.source)}${pick.duration ? ' · ' + pick.duration + 's' : ''}</span>
      <button class="btn ghost sm" style="margin-left:auto;padding:2px 8px;font-size:10px;color:var(--red);border-color:var(--red)" onclick="unpickMedia('${sceneId}')">✗ Bỏ chọn</button>
    </div>`;
  }

  if (!photos.length && !videos.length) {
    box.innerHTML = html + `<span style="color:var(--text-dim);font-size:11.5px">${keywords ? 'Không tìm thấy kết quả cho "' + escapeHtml(keywords) + '"' : 'Bấm Tìm để lấy ứng viên.'}</span>`;
    return;
  }
  html += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Từ khoá: <strong>${escapeHtml(keywords)}</strong> · ${photos.length} ảnh, ${videos.length} video</div>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  photos.forEach((p, i) => {
    const dl = (p._downloadUrl || '').replace(/'/g, "\\'");
    const sel = pickedUrl && p._downloadUrl === pickedUrl;
    html += `<div style="width:150px;border-radius:6px;overflow:hidden;border:2px solid ${sel ? 'var(--accent)' : 'var(--border)'}">
      <a href="${p.url}" target="_blank" style="display:block;text-decoration:none"><img src="${p.src.small}" style="width:100%;height:90px;object-fit:cover" loading="lazy"></a>
      <div style="padding:5px 8px;font-size:10px;color:var(--text-muted);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>📷 ${_srcBadge(p._source)}</span>
        <span style="display:flex;gap:4px">
          <button class="btn ghost" style="padding:2px 6px;font-size:10px;border-color:${sel ? 'var(--accent)' : 'var(--teal)'};color:${sel ? 'var(--accent)' : 'var(--teal)'}" onclick="pickMedia('${sceneId}','photos',${i})" title="Dùng ảnh này cho cảnh">${sel ? '✓' : 'Dùng'}</button>
          <button class="btn ghost" style="padding:2px 6px;font-size:10px" onclick="downloadMedia('${dl}','jpg','${sceneNum}')" title="Tải ảnh về (tên = số cảnh)">⬇</button>
        </span>
      </div>
    </div>`;
  });
  videos.forEach((v, j) => {
    const thumb = v.image || v.video_pictures?.[0]?.picture || _pixabayThumbFromUrl(v._downloadUrl) || '';
    const dl = (v._downloadUrl || '').replace(/'/g, "\\'");
    const sel = pickedUrl && v._downloadUrl === pickedUrl;
    html += `<div style="width:150px;border-radius:6px;overflow:hidden;border:2px solid ${sel ? 'var(--accent)' : 'var(--border)'}">
      <a href="${v.url}" target="_blank" style="display:block;text-decoration:none;position:relative"><img src="${thumb}" style="width:100%;height:90px;object-fit:cover" loading="lazy">
      <div style="position:absolute;top:45px;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px">▶</div></a>
      <div style="padding:5px 8px;font-size:10px;color:var(--text-muted);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>🎬 ${v.duration}s ${_srcBadge(v._source)}</span>
        <span style="display:flex;gap:4px">
          <button class="btn ghost" style="padding:2px 6px;font-size:10px;border-color:${sel ? 'var(--accent)' : 'var(--teal)'};color:${sel ? 'var(--accent)' : 'var(--teal)'}" onclick="pickMedia('${sceneId}','videos',${j})" title="Dùng video này cho cảnh">${sel ? '✓' : 'Dùng'}</button>
          <button class="btn ghost" style="padding:2px 6px;font-size:10px" onclick="downloadMedia('${dl}','mp4','${sceneNum}')" title="Tải video về (tên = số cảnh)">⬇</button>
        </span>
      </div>
    </div>`;
  });
  html += '</div>';
  box.innerHTML = html;
}

async function downloadMedia(url, kind, sceneNum){
  if (!url) return setStatus5('Không có link tải.', 'error');
  setStatus5('Đang tải...', 'working');
  let ext = (url.split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'mp4') ? 'mp4' : 'jpg';
  ext = ext.toLowerCase();
  // Tên file = số cảnh (001, 002...) nếu có, fallback timestamp
  const baseName = sceneNum ? String(sceneNum).padStart(3, '0') : `stock-${Date.now()}`;
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    setStatus5(`✓ Đã tải về: ${baseName}.${ext}`, 'ok');
  } catch (e) {
    novaCopyLink(url, 'CORS chặn tải trực tiếp — đã sao chép liên kết:');
    setStatus5('Không tải trực tiếp được (CORS) — link đã sao chép, app không mở cửa sổ ngoài.', 'info');
  }
}

function _mediaExt(url, kind){
  let ext = (String(url || '').split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'video') ? 'mp4' : 'jpg';
  return ext.toLowerCase();
}

function pickMedia(sceneId, listType, index){
  const cached = _t5Results[sceneId];
  if (!cached) return;
  const arr = listType === 'videos' ? cached.videos : cached.photos;
  const item = arr && arr[index];
  if (!item) return;
  const kind = listType === 'videos' ? 'video' : 'photo';
  if (!state.mediaPicks) state.mediaPicks = {};
  state.mediaPicks[sceneId] = {
    kind,
    source: item._source || 'pexels',
    thumb: kind === 'video' ? (item.image || item.video_pictures?.[0]?.picture || _pixabayThumbFromUrl(item._downloadUrl) || '') : (item.src?.small || ''),
    downloadUrl: item._downloadUrl || '',
    pageUrl: item.url || '',
    duration: kind === 'video' ? (item.duration || null) : null,
    keywords: cached.keywords || ''
  };
  renderSceneResults(sceneId, cached.keywords, cached);
  updatePickCount();
  saveState(true);
}

function unpickMedia(sceneId){
  if (state.mediaPicks) delete state.mediaPicks[sceneId];
  const cached = _t5Results[sceneId];
  if (cached) renderSceneResults(sceneId, cached.keywords, cached);
  else { const b = document.getElementById('media-results-' + sceneId); if (b) b.innerHTML = '<span style="color:var(--text-dim);font-size:11.5px">Bấm Tìm hoặc Tìm tất cả</span>'; }
  updatePickCount();
  saveState(true);
}

function updatePickCount(){
  const el = document.getElementById('pickCount');
  if (!el) return;
  const total = state.scenes.length;
  const picked = state.scenes.filter(s => state.mediaPicks?.[s.id]?.downloadUrl).length;
  el.textContent = `Đã chọn ${picked}/${total}`;
}

async function downloadAllPicks(){
  const picks = state.scenes
    .map((s, i) => ({ s, num: i + 1, pick: state.mediaPicks?.[s.id] }))
    .filter(x => x.pick?.downloadUrl);
  if (!picks.length) return setStatus5('Chưa chọn media cho cảnh nào. Bấm "Tự chọn tất cả" hoặc nút "Dùng" ở từng cảnh.', 'error');
  setStatus5(`Đang tải ${picks.length} file đã chọn...`, 'working');
  let ok = 0, fail = 0;
  for (const { num, pick } of picks) {
    try {
      await downloadMedia(pick.downloadUrl, pick.kind, num);
      ok++;
    } catch (e) { fail++; }
    await new Promise(r => setTimeout(r, 400));   // tránh trình duyệt chặn tải hàng loạt
  }
  setStatus5(`✓ Đã tải ${ok}/${picks.length} file đã chọn (đặt tên theo số cảnh).${fail ? ' ' + fail + ' file lỗi — thử tải tay từ nút ⬇.' : ''}`, 'ok');
}

function _downloadTextFile(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const u = URL.createObjectURL(blob);
  a.href = u; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

function _srtTime(sec){
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec - Math.floor(sec)) * 1000);
  const p = (n, l) => String(n).padStart(l, '0');
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(ms, 3)}`;
}

function _csvCell(v){
  const str = String(v == null ? '' : v);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function exportMediaCSV(){
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  const rows = [['scene_num','scene_id','start_s','end_s','duration_s','type','source','file_name','download_url','page_url','keywords','vo_text']];
  let t = 0, picked = 0;
  state.scenes.forEach((s, i) => {
    const dur = parseFloat(s.duration) || 0;
    const start = t; const end = +(t + dur).toFixed(1); t = end;
    const pk = state.mediaPicks?.[s.id];
    if (pk?.downloadUrl) picked++;
    const fileName = pk?.downloadUrl ? String(i + 1).padStart(3, '0') + '.' + _mediaExt(pk.downloadUrl, pk.kind) : '';
    rows.push([
      i + 1, s.id, start, end, dur,
      pk?.kind || '', pk?.source || '', fileName,
      pk?.downloadUrl || '', pk?.pageUrl || '', pk?.keywords || '',
      (s.text || '').replace(/\s+/g, ' ').trim()
    ]);
  });
  const csv = rows.map(r => r.map(_csvCell).join(',')).join('\r\n');
  const p = getProfile();
  const base = 'media-timing-' + ((p?.tenKenh || 'video').replace(/\W+/g, '-'));
  _downloadTextFile(base + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  setStatus5(`✓ Đã xuất CSV timing (${state.scenes.length} cảnh, ${picked} đã chọn media).`, 'ok');
}

function exportMediaSRT(){
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  let t = 0; const cues = [];
  state.scenes.forEach((s, i) => {
    const dur = parseFloat(s.duration) || 0;
    const start = t; const end = +(t + dur).toFixed(3); t = end;
    const pk = state.mediaPicks?.[s.id];
    const fileName = pk?.downloadUrl ? String(i + 1).padStart(3, '0') + '.' + _mediaExt(pk.downloadUrl, pk.kind) : '(chưa chọn media)';
    const text = `[${String(i + 1).padStart(3, '0')}] ${fileName}\n${(s.text || '').replace(/\s+/g, ' ').trim()}`;
    cues.push(`${i + 1}\n${_srtTime(start)} --> ${_srtTime(end)}\n${text}`);
  });
  const p = getProfile();
  const base = 'media-timing-' + ((p?.tenKenh || 'video').replace(/\W+/g, '-'));
  _downloadTextFile(base + '.srt', cues.join('\n\n') + '\n', 'application/x-subrip;charset=utf-8');
  setStatus5(`✓ Đã xuất SRT timeline (${state.scenes.length} cảnh).`, 'ok');
}

async function genSingleVeoPrompt(id){
  const p = getProfile();
  if (!p) return setStatus6('Cần Profile (Tool 1) trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const dur = getSceneDuration(scene);
  const aspectRatio = document.getElementById('v6AspectRatio')?.value || '16:9';
  const audioMode = document.getElementById('v6AudioMode')?.value || 'none';
  const audioLine = audioMode === 'none' ? 'Do NOT add an audio line.' : 'Add a line "Audio: [ambient music + sfx description fitting the scene]" at the end of the prompt.';
  const gLabsPrompt = state.scenePrompts[id] ? `\nG-Labs prompt (style reference): ${state.scenePrompts[id].slice(0, 200)}` : '';
  setStatus6(`Đang tạo prompt Veo 3 cảnh [${id}]...`, 'working');
  try {
    const prompt = `You are a Veo 3 prompt engineer. Create 1 video prompt for the following scene.
Profile: ${p.tenKenh} | Style: ${p.sceneStyle || '2D animated'} | Rules: ${p.promptRules || ''}
Characters: ${state.charactersV.join(', ') || '-'} | Backgrounds: ${state.backgroundsV.join(', ') || '-'}
Aspect ratio: ${aspectRatio} | Audio: ${audioMode === 'none' ? 'none' : 'yes'}

Scene [${id}]: VO: "${scene.text}" | character: ${scene.character || '-'} | background: ${scene.background || '-'} | camera: ${scene.camera} | duration: ${dur}s${gLabsPrompt}

Requirements: Subject+Action+CameraMovement+Lighting+Style. ${audioLine}
70-130 English words. Start directly with the visual description. Return ONLY the text prompt, no JSON.`;
    const reply = await callClaude(prompt, 600);
    const clean = cleanPrompt(reply.trim());
    if (clean) {
      if (!state.veoPrompts) state.veoPrompts = {};
      state.veoPrompts[id] = { prompt: clean };
      renderVeoPrompts();
      renderVeoStats();
      setStatus6(`✓ Đã tạo prompt Veo 3 cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus6(`⚠️ Cảnh [${id}] tạo lỗi, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus6('Lỗi: ' + e.message, 'error');
  }
}

function _veoDurMode(){
  const el = document.getElementById('v6Duration');
  const v = el && el.value ? String(el.value) : 'auto';
  return (v === 'auto' || Number.isFinite(parseInt(v))) ? v : 'auto';
}

function renderVeoStats(){
  const elScenes = document.getElementById('v6StatScenes');
  const sp = document.getElementById('v6StatPrompts');
  const elDur = document.getElementById('v6StatDur');
  const elCount = document.getElementById('v6PromptCount');
  if (!elScenes && !sp && !elDur && !elCount) return;   // khung Veo không còn trên trang

  const promptCount = Object.keys(state.veoPrompts || {}).length;
  if (elScenes) elScenes.textContent = state.scenes.length;
  if (sp){
    sp.textContent = promptCount;
    sp.className = 'v ' + (promptCount === state.scenes.length && promptCount > 0 ? 'green' : (promptCount > 0 ? '' : 'dim'));
  }
  const durMode = _veoDurMode();
  let totalDur = 0;
  for (const s of state.scenes) {
    totalDur += (durMode === 'auto') ? Math.min(s.duration, 8) : parseInt(durMode);
  }
  if (elDur) elDur.textContent = totalDur + 's (~' + Math.round(totalDur / 60) + 'p)';
  if (elCount) elCount.textContent = `${promptCount} / ${state.scenes.length}`;
}

function getSceneDuration(scene){
  const mode = _veoDurMode();
  if (mode === 'auto') return Math.min((scene && scene.duration) || 8, 8);   // trần 8s của Veo 3
  return parseInt(mode);
}

function renderVeoPrompts(){
  const box = document.getElementById('v6PromptsList');
  if (!box) return;
  if (state.scenes.length === 0) {
    box.innerHTML = '<div class="empty-state">Chưa có cảnh. Load từ Tool 02 trước.</div>';
    const ta1 = document.getElementById('allVeoPromptsBox');
    if (ta1) ta1.value = '';
    return;
  }
  box.innerHTML = state.scenes.map(s => {
    const entry = state.veoPrompts?.[s.id];
    const p = cleanPrompt(entry?.prompt);
    const dur = getSceneDuration(s);
    const promptEsc = p ? p.replace(/`/g, "'").replace(/\\/g, "\\\\") : '';
    const editing = isEditingPrompt('veo', s.id);
    return `<div class="prompt-card ${p ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="prompt-card-head">
        <span class="prompt-card-id">[${s.id}]</span>
        <span class="prompt-card-meta">${escapeHtml(s.character) || '—'} · ${escapeHtml(s.background) || '—'} · ${s.camera} · ${dur}s</span>
      </div>
      <div class="prompt-card-vo">VO: "${escapeHtml(s.text)}"</div>
      ${editing
        ? renderEditPromptUI(p)
        : `<div class="prompt-card-text">${p ? escapeHtml(p) : 'Chưa có prompt. Bấm Sinh Prompt Veo 3.'}</div>
           <div class="prompt-card-actions">
             ${p ? `<button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)">📋 Sao chép</button>
             <button class="btn ghost sm" onclick="startEditPrompt('veo','${s.id}')">✏️ Sửa</button>` : ''}
             <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleVeoPrompt('${s.id}')">🔧 ${p ? 'Tạo lại' : 'Tạo'}</button>
           </div>`
      }
    </div>`;
  }).join('');
  const ta = document.getElementById('allVeoPromptsBox');
  if (ta) {
    ta.value = state.scenes.map(s => cleanPrompt(state.veoPrompts?.[s.id]?.prompt)).filter(Boolean).join('\n\n');
  }
  // Nút "Tạo nốt cảnh thiếu" cho Veo
  const vMissing = state.scenes.filter(s => !state.veoPrompts?.[s.id]?.prompt).length;
  const vHas = state.scenes.length - vMissing;
  const vFillBtn = document.getElementById('v6FillBtn');
  const vMissEl = document.getElementById('v6MissingCount');
  if (vFillBtn && vMissEl) {
    if (vMissing > 0 && vHas > 0) {
      vFillBtn.style.display = '';
      vMissEl.textContent = '(' + vMissing + ')';
    } else {
      vFillBtn.style.display = 'none';
    }
  }
}

function setStatus7(msg, type){
  const c = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' };
  const col = c[type] || c.info;
  // #status7 nằm TRONG cột chi tiết — ở bố cục gọn cột đó là ngăn trượt đóng, nên
  // ghi vào đó là ghi vào chỗ không ai thấy. Ghi thêm ra dòng dưới khung xem.
  [document.getElementById('status7'), document.getElementById('t7StatusLean')].forEach(el => {
    if (!el) return; el.textContent = msg; el.style.color = col;
  });
}

function _t7FileToDataUrl(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

async function _t7UrlToDataUrl(url){ const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const b = await r.blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); }

function _t7Scenes(){ return Array.isArray(state.scenes) ? state.scenes : []; }

function _t7SceneById(id){ return _t7Scenes().find(s => s.id === id) || null; }

function _t7ImgVar(sceneId, variant){ const m = state[variant === 'B' ? 'sceneImagesB' : 'sceneImages']; return (m && m[sceneId] && m[sceneId].base64) || null; }

function _t7SceneHasA(id){ return !!_t7ImgVar(id, 'A'); }

function _t7SceneHasB(id){ return !!_t7ImgVar(id, 'B'); }

function _t7SceneHasBPrompt(id){ try { const p = state.scenePrompts2 && state.scenePrompts2[id]; return !!(p && String(p).trim()); } catch (e){ return false; } }

function _t7SceneWantsAB(id){ return _t7SceneHasBPrompt(id) || (_t7SceneHasA(id) && _t7SceneHasB(id)); }

function _t7SceneDur(s){ const d = parseFloat(s && s.duration); return (!isNaN(d) && d > 0) ? d : 3; }

function _t7Fmt(t){ t = Math.max(0, Math.round(t)); const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'); }

function _t7NewId(){ return 'c' + (++t7State._seq); }

function _t7EnsureUniqueIds(clips){
  for (const c of clips){ const m = c && /^c(\d+)$/.exec(c.id); if (m) t7State._seq = Math.max(t7State._seq, +m[1]); }  // đẩy _seq qua id lớn nhất
  const seen = new Set();
  for (const c of clips){ if (!c) continue; if (!c.id || seen.has(c.id)) c.id = _t7NewId(); seen.add(c.id); }           // id trùng/thiếu → cấp id mới (không đụng id cũ)
  return clips;
}

function _t7Clips(){ return t7State.clips; }

function _t7ClipDur(c){ const d = parseFloat(c && c.dur); return (!isNaN(d) && d > 0) ? d : 0.3; }

function _t7ClipScene(c){ return _t7SceneById(c && c.sceneId); }

function _t7MediaById(id){ return (t7State.media || []).find(m => m.id === id) || null; }   // Thư viện nhập

function _t7ClipImg(c){ if (c && c.imported){ const m = _t7MediaById(c.mediaId); return (m && m.kind === 'image') ? m.dataUrl : null; } if (c && !c.imported){ const pk = state.mediaPicks && state.mediaPicks[c.sceneId]; if (pk && pk.kind === 'image' && pk.downloadUrl) return pk.downloadUrl; } return _t7ImgVar(c && c.sceneId, (c && c.variant) || 'A'); }

function _t7ThumbImg(c){
  try {
    if (c && !c.imported && _t7UsesVideo(c)){
      const pk = state.mediaPicks && state.mediaPicks[c.sceneId];
      if (pk && pk.kind === 'video'){
        const t = _stockThumb(pk);
        if (t) return t;
        // Clip YouTube: pick chỉ giữ file đã cắt (base64), ảnh nằm ở ứng viên → dò theo link gốc.
        const src = ((state.clipSrc || {})[c.sceneId] || {}).url || '';
        const id = (typeof _t7YtId === 'function') ? _t7YtId(src) : '';
        const cand = ((state.ytCandidates || {})[c.sceneId] || []).find(x => x && x.url && (x.url === src
          || (id && typeof _t7YtId === 'function' && _t7YtId(x.url) === id)));
        if (cand && (cand.thumbnail || cand.thumb)) return cand.thumbnail || cand.thumb;
      }
    }
  } catch (e) { /* */ }
  return _t7ClipImg(c);
}

function _t7ClipText(c){ if (c && c.imported) return c.name || ''; const s = _t7ClipScene(c); return (s && s.text) || ''; }

function _t7ClipLabel(c){ return (c && c.imported) ? (c.name || 'Media nhập') : ('Cảnh ' + (c && c.sceneId)); }

function _t7StockVid(c){ try { const pk = c && !c.imported && state.mediaPicks && state.mediaPicks[c.sceneId]; return (pk && pk.kind === 'video' && pk.downloadUrl) ? pk.downloadUrl : null; } catch (e){ return null; } }

function _t7HasVideo(c){ try { if (c && c.imported){ const m = _t7MediaById(c.mediaId); return !!(m && m.kind === 'video'); } if (_t7StockVid(c)) return true; return !!(c && typeof mvVideoBlobs === 'object' && mvVideoBlobs[c.sceneId] && mvVideoBlobs[c.sceneId].b64); } catch (e){ return false; } }

function _t7ClipVideoUrl(c){ if (c && c.imported){ const m = _t7MediaById(c.mediaId); return (m && m.kind === 'video') ? m.dataUrl : null; } const sv = _t7StockVid(c); if (sv) return sv; if (!_t7HasVideo(c)) return null; const v = mvVideoBlobs[c.sceneId]; return `data:${v.mime || 'video/mp4'};base64,${v.b64}`; }

function _t7UsesVideo(c){ if (c && c.imported) return _t7HasVideo(c); if (_t7StockVid(c)) return true; return !!(c && c.useVideo && _t7HasVideo(c)); }

function _t7VidKind(c){
  try {
    if (c && !c.imported){
      const pk = state.mediaPicks && state.mediaPicks[c.sceneId];
      if (pk && pk.kind === 'video'){
        const s = String(pk.source || '');
        if (/pexels|stock|coverr|pixabay/i.test(s)) return 'Clip stock';
        if (/yt|youtube/i.test(s)) return 'Clip YouTube';
        return 'Clip';
      }
    }
    if (c && c.imported){ const m = _t7MediaById(c.mediaId); if (m && m.kind === 'video') return 'Video nhập'; }
  } catch (_) {}
  return 'Video Veo';   // mvVideoBlobs = video Veo (AI motion)
}

function _t7VideoDuration(url){ return new Promise((res) => { try { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = url; } catch (e){ res(0); } }); }

function _t7Total(){ return _t7Clips().reduce((a, c) => a + _t7ClipDur(c), 0); }

function _t7CoverAudio(){
  try {
    const aud = +t7State.audioDur || 0; const clips = t7State.clips || [];
    if (!(aud > 0.3) || !clips.length) return;
    const gap = aud - _t7Total();
    if (gap > 0.3){ const last = clips[clips.length - 1]; if (last && !last.imported) last.dur = +(_t7ClipDur(last) + gap).toFixed(2); }
  } catch (e) {}
}

function _t7ClipStart(i){ let t = 0; for (let k = 0; k < i; k++) t += _t7ClipDur(t7State.clips[k]); return t; }

function _t7ClipAt(time){ let acc = 0; const cl = t7State.clips; for (let i = 0; i < cl.length; i++){ acc += _t7ClipDur(cl[i]); if (time < acc) return { clip: cl[i], index: i }; } const i = cl.length - 1; return i >= 0 ? { clip: cl[i], index: i } : null; }

function _t7Doc(){ try { const p = getProfile(); const v = p && getCurrentVideo(p); return v ? v.workData : null; } catch (e){ return null; } }

function _t7PersistClips(){ const wd = _t7Doc(); if (wd){ wd.editClips = t7State.clips.map(c => ({ id: c.id, sceneId: c.sceneId, variant: c.variant || 'A', dur: c.dur, fx: c.fx || 'none', trans: c.trans || 'none', transDur: c.transDur || 0.5, useVideo: !!c.useVideo, vidDur: c.vidDur || 0, scale: c.scale || 1, imported: !!c.imported, mediaId: c.mediaId || null, kind: c.kind || null, name: c.name || null })); wd.overlays = (t7State.overlays || []).map(o => ({ id: o.id, dataUrl: o.dataUrl, name: o.name || '', start: o.start || 0, dur: o.dur || 3 })); wd.media = (t7State.media || []).map(m => ({ id: m.id, kind: m.kind, name: m.name || '', dataUrl: m.dataUrl, dur: m.dur || 0 })); try { if (typeof saveState === 'function') saveState(true); } catch (e) {} }
  try { if (typeof t7RemotionRefresh === 'function') t7RemotionRefresh(); } catch (e) {}   // đổi fx/thời lượng/thứ tự → nạp lại composition cho bản xem trước Remotion
}

function _t7FxFromScene(s){
  const VALID = ['zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','none'];
  const REMAP = { punch: 'zoom-in', static: 'none' };
  let fx = (s && s.motion) ? String(s.motion).trim() : '';
  fx = REMAP[fx] || fx;
  if (VALID.includes(fx)) return fx;
  const shot = s && s.shot;
  return shot === 'establishing' ? 'pan-right' : shot === 'b-roll' ? 'pan-left' : 'zoom-in';
}

function _t7AutoBuild(){
  const wd0 = _t7Doc();
  // nạp lại Lớp trên (overlay) từ workData nếu phiên chưa có
  if (wd0 && Array.isArray(wd0.overlays) && !(t7State.overlays || []).length) t7State.overlays = wd0.overlays.map(o => ({ id: o.id || _t7NewId(), dataUrl: o.dataUrl, name: o.name || 'Ảnh đè', start: +o.start || 0, dur: +o.dur || 3 }));
  // nạp lại Thư viện media
  if (wd0 && Array.isArray(wd0.media) && !(t7State.media || []).length) t7State.media = wd0.media.map(m => ({ id: m.id || _t7NewId(), kind: m.kind, name: m.name || '', dataUrl: m.dataUrl, dur: +m.dur || 0 }));
  const _sceneHasVid = (id) => { try { return !!(typeof mvVideoBlobs === 'object' && mvVideoBlobs[id] && mvVideoBlobs[id].b64); } catch (e){ return false; } };
  // Tạo clip MỚI từ 1 cảnh (chỉ dùng cho cảnh CHƯA có clip nào).
  const mk = (s, variant, dur) => {
    const hasImg = _t7SceneHasA(s.id) || _t7SceneHasB(s.id), hasVid = _sceneHasVid(s.id);
    const useVid = (hasVid && !hasImg);
    return { id: _t7NewId(), sceneId: s.id, variant, dur: Math.max(0.3, +(+dur).toFixed(2)),
      fx: useVid ? 'none' : _t7FxFromScene(s), trans: "none", transDur: 0.5, useVideo: useVid, vidDur: 0, scale: 1 };
  };
  const _addSceneClips = (arr, s) => {
    // LUÔN thêm mọi cảnh Tool 2 (kể cả CHƯA có ảnh → clip placeholder khung trống + số cảnh + thời lượng).
    // Cấu trúc A/B bám Tool 2 (Prompt B) chứ không bám ảnh → không lệch khi ảnh chưa tạo xong.
    const dur = _t7SceneDur(s);
    if (_t7SceneWantsAB(s.id)){ const h = dur / 2; arr.push(mk(s, 'A', h)); arr.push(mk(s, 'B', dur - h)); }
    else arr.push(mk(s, (_t7SceneHasB(s.id) && !_t7SceneHasA(s.id)) ? 'B' : 'A', dur));
  };
  const scenes = _t7Scenes();
  const sceneIds = new Set(scenes.map(s => s.id));
  const mediaIds = new Set((t7State.media || []).map(m => m.id));
  // Nguồn clip ĐÃ CHỈNH: ưu tiên phiên hiện tại, else editClips đã lưu trong workData.
  const savedClips = (t7State.clips && t7State.clips.length) ? t7State.clips
    : ((wd0 && Array.isArray(wd0.editClips)) ? wd0.editClips : []);
  // Mẫu do AI thiết kế cho từng cảnh (engine Nova Scene) — nạp lại theo video đang mở.
  if (!state.sceneSpecs || !Object.keys(state.sceneSpecs).length) state.sceneSpecs = (wd0 && wd0.sceneSpecs) || {};
  if (!Array.isArray(state.globalGfx) || !state.globalGfx.length) state.globalGfx = (wd0 && wd0.globalGfx) || [];
  if (!state.clipSrc || !Object.keys(state.clipSrc).length) state.clipSrc = (wd0 && wd0.clipSrc) || {};
  // Đẩy _seq qua id lớn nhất đã lưu TRƯỚC khi tách A/B → id clip mới không trùng id cũ (phiên trước).
  for (const c of savedClips){ const m = c && /^c(\d+)$/.exec(c.id); if (m) t7State._seq = Math.max(t7State._seq, +m[1]); }

  if (savedClips.length){
    // 🔒 GIỮ NGUYÊN chỉnh sửa (tách/nhân đôi/trim/sắp xếp/hiệu ứng): chỉ BỎ clip mà cảnh/media không còn,
    //    và THÊM cảnh MỚI (chưa có clip nào phủ) vào cuối. KHÔNG dựng lại từ đầu (mất edit).
    const kept = []; const covered = new Set();
    for (const c of savedClips){
      if (c.imported){ if (c.mediaId && mediaIds.has(c.mediaId)) kept.push({ ...c, id: c.id || _t7NewId() }); continue; }
      if (sceneIds.has(c.sceneId)){ kept.push({ ...c, id: c.id || _t7NewId() }); covered.add(c.sceneId); }
    }
    // Cảnh mới có ảnh (vd cảnh vừa tạo lại) → CHÈN ĐÚNG VỊ TRÍ theo thứ tự cảnh, KHÔNG dồn xuống cuối.
    const sceneOrder = new Map(scenes.map((s, i) => [s.id, i]));
    for (const s of scenes){
      if (covered.has(s.id)) continue;
      const news = []; _addSceneClips(news, s);
      if (!news.length) continue;
      const myOrder = sceneOrder.get(s.id);
      let at = kept.length;
      for (let i = 0; i < kept.length; i++){ const kc = kept[i]; if (kc.imported) continue; const ko = sceneOrder.get(kc.sceneId); if (ko != null && ko > myOrder){ at = i; break; } }
      kept.splice(at, 0, ...news); covered.add(s.id);
    }
    // 🔧 ĐỒNG BỘ CẤU TRÚC A/B theo Phân Cảnh (Tool 2): cảnh vừa được THÊM ảnh B sau khi timeline đã dựng
    //    (thêm Prompt B cho cảnh dài rồi tạo lại) → timeline còn 1 clip A cũ, phải tách thành A+B; ngược lại cảnh
    //    MẤT B → gộp về 1 clip. CHỈ áp cho cảnh ở dạng "tự động" (1 clip, hoặc đúng 1 A + 1 B); cảnh bạn TÁCH TAY
    //    (nhiều clip / trùng biến thể) thì GIỮ NGUYÊN. → ảnh ở Dựng Video luôn khớp Phân Cảnh, hết cảnh bị kéo dài.
    {
      const _g = {};
      for (const c of kept){ if (!c.imported && c.sceneId){ (_g[c.sceneId] = _g[c.sceneId] || []).push(c); } }
      for (const s of scenes){
        const arr = _g[s.id]; if (!arr || !arr.length) continue;
        const wantAB = _t7SceneWantsAB(s.id);   // cần A+B theo Tool 2 (Prompt B) — không phụ thuộc đã có ảnh chưa
        const vars = arr.map(c => c.variant || 'A');
        const isSingle = arr.length === 1;
        const isAB = arr.length === 2 && vars.includes('A') && vars.includes('B');
        if (!isSingle && !isAB) continue;                 // tách tay → giữ nguyên
        const sd = _t7SceneDur(s);
        if (wantAB && isSingle){                           // cảnh vừa có thêm ảnh B → tách A+B (giữ fx/chuyển cảnh)
          const base = arr[0]; const idx = kept.indexOf(base); if (idx < 0) continue;
          const h = +(sd / 2).toFixed(2);
          const mkc = (variant, d) => ({ ...base, id: _t7NewId(), variant, dur: d, useVideo: false });
          kept.splice(idx, 1, mkc('A', h), mkc('B', +(sd - h).toFixed(2)));
        } else if (!wantAB && isAB){                       // cảnh mất ảnh B → gộp về 1 clip
          const keepVar = (_t7SceneHasA(s.id) || !_t7SceneHasB(s.id)) ? 'A' : 'B';
          const keepC = arr.find(c => (c.variant || 'A') === keepVar) || arr[0];
          const dropC = arr.find(c => c !== keepC);
          keepC.variant = keepVar; keepC.dur = +(+sd).toFixed(2);
          const di = kept.indexOf(dropC); if (di >= 0) kept.splice(di, 1);
        }
      }
    }
    // 🔄 KHỚP THỜI LƯỢNG theo Phân Cảnh ("thời lượng luôn lấy từ Tool 2"): cảnh 1 clip → = độ dài cảnh; cảnh A+B → chia đôi.
    //    Cảnh bị TÁCH TAY (nhiều clip cùng biến thể) thì GIỮ NGUYÊN edit. → tổng Dựng Video = tổng Phân Cảnh, hết lệch/dư đuôi audio.
    const _byScene = {};
    for (const c of kept){ if (!c.imported && c.sceneId){ (_byScene[c.sceneId] = _byScene[c.sceneId] || []).push(c); } }
    for (const sid in _byScene){
      const arr = _byScene[sid]; const s = _t7SceneById(sid); if (!s) continue; const sd = _t7SceneDur(s);
      if (arr.length === 1){ arr[0].dur = +(+sd).toFixed(2); }
      else if (arr.length === 2 && arr.some(c => (c.variant || 'A') === 'A') && arr.some(c => (c.variant || 'A') === 'B')){ const h = +(sd / 2).toFixed(2); arr.forEach(c => { c.dur = (c.variant === 'B') ? +(sd - h).toFixed(2) : h; }); }
      // else: cảnh bị tách tay (nhiều clip cùng biến thể) → giữ nguyên
    }
    t7State.clips = _t7EnsureUniqueIds(kept);
    return;
  }
  // Chưa có clip nào → dựng mới toàn bộ từ Phân Cảnh.
  const clips = [];
  for (const s of scenes) _addSceneClips(clips, s);
  const importedClips = (wd0 && Array.isArray(wd0.editClips)) ? wd0.editClips.filter(c => c && c.imported) : [];
  for (const c of importedClips){ if (c.mediaId && mediaIds.has(c.mediaId)) clips.push({ ...c, id: c.id || _t7NewId() }); }
  t7State.clips = _t7EnsureUniqueIds(clips);
}

function _t7Clone(){ return t7State.clips.map(c => ({ ...c })); }

function _t7SyncColHeight(){
  if (_t7SyncColHeight._busy) return;               // ResizeObserver bắt lại chính cú sửa của mình
  try {
    const grid = document.querySelector('#tool-tool7 .t7-grid'); if (!grid) return;
    const secs = grid.querySelectorAll(':scope > section');
    const bin = secs[0], stage = secs[1]; if (!bin || !stage) return;
    if (!document.body.classList.contains('t7-lean')){ bin.style.height = ''; return; }
    _t7SyncColHeight._busy = 1;
    // ĐO HAI BƯỚC. Hai cột nằm chung một hàng và đều bị giãn cho bằng hàng, nên đo
    // thẳng cột xem trước chỉ ra lại đúng cái chiều cao đã bị 192 cảnh thổi lên.
    // Rút cột cảnh về 0 trước → hàng co lại đúng bằng NỘI DUNG cột xem trước → đo → ghim.
    bin.style.height = '0px';
    void bin.offsetHeight;                          // ép tính lại ngay, không đợi frame sau
    // Chặn chiều cao KHUNG XEM cho cả cột vừa đúng vùng nhìn thấy. Khung 9:16 cao gấp
    // đôi 16:9, không chặn thì cả trang dài ra và lại thừa một mảng trắng dưới đáy.
    const player = document.getElementById('t7Player');
    if (player){
      const conLai = window.innerHeight - (grid.getBoundingClientRect().top + window.scrollY) - 14;
      const ngoaiKhung = Math.round(stage.getBoundingClientRect().height) - Math.round(player.getBoundingClientRect().height);
      _t7SyncColHeight._moc = Math.max(220, Math.round(conLai - ngoaiKhung));   // mốc tuyệt đối, không cộng dồn
      player.style.maxHeight = _t7SyncColHeight._moc + 'px';
      void player.offsetHeight;
    }
    let h = Math.round(stage.getBoundingClientRect().height);
    // Lưới an toàn CSS phải nới theo, không thì nó cắt cột cảnh thấp hơn cột xem trước.
    document.body.style.setProperty('--t7-col-h', h + 'px');
    bin.style.height = (h > 260) ? (h + 'px') : '';  // khung xem chưa dựng xong thì để nguyên
    // Còn tràn (lề/đệm dưới lưới mà phép tính ở trên không thấy) → bớt đúng phần dư, một lần.
    const du = document.documentElement.scrollHeight - window.innerHeight;
    if (du > 2 && player && _t7SyncColHeight._moc){
      player.style.maxHeight = Math.max(220, _t7SyncColHeight._moc - du) + 'px';
      void player.offsetHeight;
      bin.style.height = '0px'; void bin.offsetHeight;
      h = Math.round(stage.getBoundingClientRect().height);
      document.body.style.setProperty('--t7-col-h', h + 'px');
      bin.style.height = (h > 260) ? (h + 'px') : '';
    }
  } catch (e) { /* */ }
  finally { _t7SyncColHeight._busy = 0; }
}

function _t7HookColSync(){
  if (_t7HookColSync._on) { _t7SyncColHeight(); return; }
  const grid = document.querySelector('#tool-tool7 .t7-grid'); if (!grid) return;
  const stage = grid.querySelectorAll(':scope > section')[1]; if (!stage) return;
  _t7HookColSync._on = 1;
  try { new ResizeObserver(() => _t7SyncColHeight()).observe(stage); } catch (e) {}
  window.addEventListener('resize', _t7SyncColHeight);
  _t7SyncColHeight();
}

function _t7NotifyImage(sceneId){
  try {
    if (typeof t7State !== 'object' || !t7State || !(t7State.clips || []).length) return;
    if (state.tool !== 'tool7') return;   // không mở Dựng Video → sẽ tự đấu khi vào tab (t7Build)
    const box = document.getElementById('t7Rows'); const rows = box ? box.querySelectorAll('.t7-srow') : [];
    t7State.clips.forEach((c, i) => {
      if (c.imported || c.sceneId !== sceneId) return;
      const img = _t7ThumbImg(c); if (!img) return;
      const el = rows[i] && rows[i].querySelector('img.t7-thumb'); if (el) el.src = img;   // thay thumbnail tại chỗ
    });
    if (!t7State.playing) t7RenderPreview();
    if (typeof _t7TimelineRaf === 'function') _t7TimelineRaf();
  } catch (e) {}
}

function _t7Mmss(s){ s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }

function _t7RailCount(k){
  try {
    if (k === 'scenes') return (t7State.clips || []).length;
    if (k === 'media')  return (t7State.media || []).length;
    if (k === 'trans')  return (_t7Trans || []).length;
    if (k === 'motion') return (_t7Cat || []).length + (_t7Bits || []).length;
    if (k === 'text')   return (_t7Cat || []).filter(_t7IsTextTpl).length;
    if (k === 'audio')  return (_t7Sfx || []).length;
    if (k === 'subs')   return Object.keys(typeof T7_SUBSTYLES === 'object' ? T7_SUBSTYLES : {}).length;
  } catch (_) {}
  return 0;
}

async function _t7RailAudio(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  if (!_t7Sfx){
    if (_t7SfxCache) _t7Sfx = _t7SfxCache;                       // hộp SFX đã tải rồi thì dùng lại
    else if (window.native && typeof window.native.sfxLibrary === 'function'){
      try { const r = await window.native.sfxLibrary(); _t7Sfx = _t7SfxCache = (r && r.items) || []; } catch (_) { _t7Sfx = []; }
    }
  }
  if (!_t7Sfx) _t7Sfx = [];
  t7RenderRail();
  const list = _t7Sfx.filter(x => !_t7RailQ || String(x.name || x.id || x).toLowerCase().includes(_t7RailQ));
  box.innerHTML = `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để chèn tại vạch phát (${(t7State.playT||0).toFixed(1)}s).</div>` +
    (list.length ? list.map(x => {
      const id = String(x.id || x.file || x.name || x), nm = String(x.nameVi || x.name || id);
      return `<div class="t7-fxi" onclick="t7SfxLibAdd('${escapeHtml(id)}')" title="${escapeHtml(nm)}"><b>🔊 ${escapeHtml(nm)}</b><s>${x.durationSec ? x.durationSec.toFixed(1) + 's' : ''}</s></div>`;
    }).join('') : '<div class="t7-dim" style="font-size:11.5px">Chưa có hiệu ứng âm thanh nào.</div>') +
    `<button class="btn ghost sm" style="width:100%;margin-top:8px;justify-content:center" onclick="t7SfxLibOpen()">📂 Mở kho đầy đủ</button>`;
}

function _t7RailSubs(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  box.innerHTML = `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Kiểu chữ khi burn phụ đề vào video.</div>
    <div id="t7SubStyleChipsRail" style="display:flex;gap:7px;flex-wrap:wrap"></div>
    <label class="t7-mlab" style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
      <input type="checkbox" id="t7SubsRailOn" style="accent-color:var(--accent);width:15px;height:15px"
             onchange="(function(v){const e=document.getElementById('t7ExpSubs');if(e){e.checked=v;} if(typeof t7RenderPreview==='function'&&!t7State.playing)t7RenderPreview();})(this.checked)">
      Ghi phụ đề vào video khi xuất
    </label>`;
  const on = document.getElementById('t7ExpSubs'); const cb = document.getElementById('t7SubsRailOn');
  if (on && cb) cb.checked = !!on.checked;
  // Dùng lại đúng bộ chip của hộp Xuất — một nguồn sự thật, không dựng bản thứ hai.
  try { const src = document.getElementById('t7SubStyleChips'); const dst = document.getElementById('t7SubStyleChipsRail');
    if (typeof t7RenderSubStyleChips === 'function') t7RenderSubStyleChips();
    if (src && dst) dst.innerHTML = src.innerHTML; } catch (_) {}
}

function _t7RailAi(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  const B = (fn, ic, t, d) => `<div class="t7-fxi" style="align-items:flex-start;padding:9px 10px" onclick="${fn}">
    <b style="display:block">${ic} ${t}</b><s style="display:block;white-space:normal;line-height:1.35;margin-top:2px">${d}</s></div>`;
  box.innerHTML =
    B('t7AiDesign()', '🎬', 'AI dựng đồ hoạ', 'Đọc lời từng cảnh rồi tự gắn mẫu chuyển động — chỉ chọn trong kho có sẵn.') +
    B('t7AiDesignClearAsk()', '🧹', 'Gỡ hết đồ hoạ AI', 'Trả mọi cảnh về video trơn — bỏ chữ nhấn, lower-third, hạt phim…') +
    B('t7TranslateAll()', '🌐', 'Dịch tiếng Việt', 'Dịch lời thoại mọi cảnh để soát — không ghi vào video.') +
    B('t7Build()', '↻', 'Đồng bộ từ Phân Cảnh', 'Nạp lại toàn bộ cảnh, ảnh và lời thoại từ tab Phân Cảnh.') +
    B('t7OpenExport()', '⬆', 'Xuất Video', 'Mở hộp thoại xuất — chọn độ phân giải, phụ đề, GPU.');
}

function _t7MediaKind(type){ if (/^image\//.test(type)) return 'image'; if (/^video\//.test(type)) return 'video'; if (/^audio\//.test(type)) return 'audio'; return null; }

function _t7MediaDuration(dataUrl, kind){
  return new Promise((res) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata'; el.onloadedmetadata = () => res(el.duration || 0); el.onerror = () => res(0);
    try { el.src = dataUrl; } catch (e){ res(0); } setTimeout(() => res(el.duration || 0), 4000);
  });
}

function _t7SelectAdjacent(dir){
  const clips = _t7Clips(); if (!clips.length) return;
  let idx = clips.findIndex(c => c.id === t7State.selClip);
  idx = (idx < 0) ? 0 : Math.max(0, Math.min(clips.length - 1, idx + dir));
  t7SelectClip(clips[idx].id);
}

function _t7CandList(c){
  const yt = ((state.ytCandidates || {})[c.sceneId] || []).map(x => Object.assign({ _k: 'yt' }, x));
  const st = ((state.stockCandidates || {})[c.sceneId] || []).map(x => Object.assign({ _k: 'st' }, x));
  const all = yt.concat(st);
  const esc = escapeHtml;
  if (!all.length){
    return `<div class="t7-dim" style="font-size:11.5px;line-height:1.55;padding:14px 2px">
      Chưa có clip nào để chọn. Bấm <b style="color:var(--text)">🎬 YouTube</b> hoặc
      <b style="color:var(--text)">🔍 Stock</b> ở trên để tìm — tìm xong danh sách hiện ngay đây.</div>`;
  }
  const cur = (state.mediaPicks || {})[c.sceneId] || {};
  const rows = all.map((x, i) => {
    const on = cur.downloadUrl && (x.url === cur.downloadUrl || x.downloadUrl === cur.downloadUrl);
    const idx = x._k === 'yt' ? i : (i - yt.length);
    const fn = x._k === 'yt' ? `t7PickYt('${c.sceneId}',${idx})` : `t2PickStock('${c.sceneId}',${idx})`;
    return `<button class="t7-cand${on ? ' on' : ''}" onclick="${fn}" title="${esc(x.title || '')}">
      <span class="th" style="background-image:url('${esc(x.thumbnail || '')}')"></span>
      <span class="tx"><b>${esc((x.title || '(không tên)').slice(0, 52))}</b>
        <s>${x.durationSec ? Math.round(x.durationSec) + 's · ' : ''}${esc(x._k === 'yt' ? 'YouTube' : (x.source || 'stock'))}</s></span>
      ${on ? '<span class="ok">✓</span>' : ''}</button>`;
  }).join('');
  return `<div class="t7-dim" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin:12px 0 7px">
      Chọn clip khác · ${all.length}</div><div class="t7-candlist">${rows}</div>`;
}

function _t7GfxLayers(sceneId){
  const sp = (state.sceneSpecs || {})[sceneId];
  const arr = (sp && Array.isArray(sp.layers)) ? sp.layers : [];
  return arr.map((L, i) => ({ L, i })).filter(x => x.L && x.L.type !== 'backdrop');
}

function _t7GfxKind(L){
  if (L.type === 'bit') return 'bit';
  if (!L.template) return 'man';                              // tự thêm bằng tay
  if (/^md-/.test(L.template)) return 'md';                   // mẫu dựng lại từ motion template
  if (/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in/.test(L.template)) return 'ov';  // lớp phủ không khí
  if (/progress|highlight|circle|sliding/.test(L.template)) return 'sh';                                      // hình khối
  return 'tx';                                                // còn lại là chữ
}

function _t7GfxName(L){
  if (L.template){
    const c = (_t7Cat || []).find(x => x.template === L.template);
    return (c && c.label) || L.template;
  }
  if (L.type === 'text') return 'Chữ: ' + String(L.text || '').slice(0, 18);
  if (L.type === 'bit') return 'Bit: ' + String(L.bit || '');
  return L.type || 'lớp';
}

function _t7LayerPanel(L, ctx){
  const cat = (_t7Cat || []).find(x => x.template === L.template);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));
  const lb = (t, extra) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700;display:flex;justify-content:space-between"><span>${t}</span><span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-dim)">${extra || ''}</span></div>`;
  // Ô ảnh: nút chọn file thay vì bắt gõ data URL. Ô còn lại là ô chữ thường.
  const IMGK = /^(src|image|img|photo|logo|thumb)$/i;
  const fld = (k, v) => IMGK.test(k)
    ? `<div style="display:flex;gap:6px;align-items:center">
         <div class="t7-mfield" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:7px 9px">${v === '@scene' ? '🖼 ảnh của cảnh' : (v ? (String(v).startsWith('data:') ? '🖼 ảnh đã chọn' : (_t7IsVid(v) ? '🎬 ' + esc(String(v).split(/[\\/]/).pop()) : esc(String(v).slice(0, 40)))) : '— chưa có ảnh/video —')}</div>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickImg('${k}')" title="Ảnh — nhúng thẳng vào dự án">🖼 Ảnh</button>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickVid('${k}')" title="Video — lưu đường dẫn, lúc xuất tự chép vào bản dựng">🎬 Video</button>
         ${ctx.scene ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px" title="Dùng chính ảnh của cảnh này" onclick="t7LUseSceneImg('${k}')">🖼</button>` : ''}
         ${v ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px;color:var(--red)" onclick="t7LSet('${k}','')">✕</button>` : ''}
       </div>`
    : `<input class="t7-mfield" style="width:100%" value="${esc(v)}" onchange="t7LSet('${k}',this.value)">`;

  // Ô nội dung: đúng những trường mẫu khai, bỏ các trường màu (đưa xuống nhóm Màu).
  const COLORK = /^(bg|ink|color|color2|track|mark|fill)$/;
  const params = (cat && cat.params) || Object.keys(L).filter(k => !/^(template|type|at|until|z|id|in|out|hold|box|style|dx|dy|scale|rotate|opacity)$/.test(k));
  const content = params.filter(k => !COLORK.test(k)).map(k => lb(k) + fld(k, L[k])).join('');
  const colors = params.filter(k => COLORK.test(k));

  const chip = (grp, val, label, cur) =>
    `<span class="t7-cchip${cur === val ? ' on' : ''}" onclick="t7LAnim('${grp}','${val}')">${label}</span>`;
  const IN = [['fade','mờ dần'],['rise','dâng lên'],['drop','rơi xuống'],['slideL','trượt trái'],['slideR','trượt phải'],['pop','bật'],['defocus','nhoè'],['wipeL','quét ngang'],['zoom','phóng vào'],['deal','chia bài'],['none','không']];
  const OUT = [['fade','mờ dần'],['sinkL','chìm trái'],['sinkR','chìm phải'],['fall','rơi xuống'],['shrink','co lại'],['wipeR','quét'],['none','không']];
  const HOLD = [['none','không'],['kenIn','Ken Burns – phóng vào'],['kenOut','Ken Burns – phóng ra'],['panL','lia trái'],['panR','lia phải'],['panU','lia lên'],['panD','lia xuống'],['drift','trôi'],['breathe','thở'],['growX','chạy đầy ngang'],['growY','chạy đầy dọc']];
  const curIn = (L.in && L.in.preset) || 'fade', curOut = (L.out && L.out.preset) || 'none', curHold = (L.hold && L.hold.preset) || 'none';
  // ── Chuyển động đơn giản: 1 thẻ = phối sẵn Vào+Giữ+Ra, cộng thanh Mức độ. ──
  // Người dùng thường bấm 1 thẻ là xong; 3 hàng chip kỹ thuật gốc vẫn giữ nguyên
  // trong "Nâng cao" cho ai cần chỉnh riêng từng pha. Engine/render không đổi.
  const curAmp = (L.hold && L.hold.amp != null) ? Number(L.hold.amp) : 1;
  const curStyle = (_T7_STYLES || []).find(s => s.hold === curHold);
  const comboMatch = !!(curStyle && curStyle.in === curIn && curStyle.out === curOut);
  const styleCard = (s) =>
    `<div class="t7-stylecard${curStyle && curStyle.id === s.id ? ' on' : ''}" onclick="t7LStyle('${s.id}')" title="${esc(s.desc)}">
       <i>${s.icon}</i><span><b>${s.name}</b><s>${s.desc}</s></span>
     </div>`;

  // ── Vị trí / cỡ / độ mờ: mẫu tự dựng bố cục, các ô này ĐÈ LÊN bố cục đó ──
  const b = L.box || {};
  const B = (k, ph) => { const cur = _t7BoxRead(L, k);
    return `<input class="t7-mfield" style="width:100%" type="number" step="1" placeholder="${ph}" value="${cur != null ? esc(cur) : ''}" onchange="t7LBox('${k}',this.value)">`; };
  const N = (k, ph, step, dflt) => `<input class="t7-mfield" style="width:100%" type="number" step="${step}" placeholder="${ph}" value="${L[k] != null ? esc(L[k]) : ''}" onchange="t7LNum('${k}',this.value,${dflt})">`;
  const aBtn = (k, v, lbl) => `<span class="t7-cchip${(b[k] || (k === 'align' ? 'left' : 'top')) === v ? ' on' : ''}" onclick="t7LBoxSet('${k}','${v}')">${lbl}</span>`;
  const opa = Math.round((L.opacity != null ? Number(L.opacity) : 1) * 100);
  const layout = `<details class="t7-sect">
    <summary><span><b>📐 Vị trí &amp; cỡ</b><em>Đè lên bố cục mẫu — tính theo % khung hình nên đổi 16:9 ↔ 9:16 vẫn đúng chỗ.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2">
      <div class="t7-g2"><div>${lb('X (%)')}${B('x','8')}</div><div>${lb('Y (%)')}${B('y','8')}</div></div>
      <div class="t7-g2"><div>${lb('Rộng (%)')}${B('w','tự')}</div><div>${lb('Cao (%)')}${B('h','tự')}</div></div>
      ${lb('Canh chữ trong hộp')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('align','left','trái')}${aBtn('align','center','giữa')}${aBtn('align','right','phải')}</div>
      ${lb('Canh dọc')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('vAlign','top','trên')}${aBtn('vAlign','center','giữa')}${aBtn('vAlign','bottom','dưới')}</div>
      <div class="t7-g3" style="margin-top:4px">
        <div>${lb('Cỡ ×')}${N('scale','1','0.05',1)}</div>
        <div>${lb('Xoay °')}${N('rotate','0','1',0)}</div>
        <div>${lb('Mờ %')}<input class="t7-mfield" style="width:100%" type="number" min="0" max="100" step="5" value="${opa}" onchange="t7LNum('opacity',this.value===''?'':(parseFloat(this.value)/100),1)"></div>
      </div>
      <div class="t7-g2"><div>${lb('Dịch ngang %')}${N('dx','0','1',0)}</div><div>${lb('Dịch dọc %')}${N('dy','0','1',0)}</div></div>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7LPin()" title="Hiện khung 8 nút trên bản xem trước để kéo bằng chuột">📌 Kéo trên khung</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7LReset()">↺ Về bố cục gốc</button>
      </div>
    </div>
  </details>`;

  return `<details class="t7-sect" open>
    <summary><span><b>✏️ Nội dung lớp</b><em>${esc((cat && cat.label) || L.template || L.type)} — ô do chính mẫu khai.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">${content || '<div class="t7-dim" style="font-size:11.5px">Mẫu này không có ô điền.</div>'}</div>
  </details>
  ${layout}
  ${colors.length ? `<details class="t7-sect">
    <summary><span><b>🎨 Màu</b><em>Đè lên màu mặc định của mẫu.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">${colors.map(k => `<div>${lb(k)}<div style="display:flex;gap:5px;align-items:center"><input type="color" style="width:30px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer" value="${esc(/^#[0-9a-f]{6}$/i.test(L[k] || '') ? L[k] : ((cat && cat.defaults && cat.defaults[k]) || '#888888'))}" onchange="t7LSet('${k}',this.value)"><input class="t7-mfield" style="flex:1;min-width:0;font-family:monospace;font-size:11px" value="${esc(L[k] || '')}" placeholder="mặc định" onchange="t7LSet('${k}',this.value)"></div></div>`).join('')}</div></div>
  </details>` : ''}
  <details class="t7-sect" open>
    <summary><span><b>🎞 Chuyển động</b><em>Bấm 1 kiểu là đủ — phần vào/ra đã phối sẵn.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${(_T7_STYLES || []).map(styleCard).join('')}</div>
      ${lb('Mức độ chuyển động')}
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <span style="font-size:10.5px;color:var(--text-muted)">nhẹ</span>
        <input type="range" min="0.25" max="2" step="0.05" value="${curAmp}" style="flex:1;accent-color:var(--accent)" onchange="t7LAmp(this.value)" title="Kéo sang phải để chuyển động mạnh/đậm hơn">
        <span style="font-size:10.5px;color:var(--text-muted)">mạnh</span>
      </div>
      ${comboMatch ? '' : `<div style="font-size:10.5px;color:var(--text-dim);margin-top:7px">⚙️ Đang chỉnh tay (${esc(curIn)} · ${esc(curHold)} · ${esc(curOut)}) — bấm 1 kiểu bên trên để áp bộ chuẩn.</div>`}
      <details style="margin-top:9px">
        <summary style="font-size:10.5px;color:var(--text-dim);cursor:pointer;user-select:none;list-style:none">⚙️ Nâng cao — chỉnh riêng từng pha (Vào / Giữ / Ra)</summary>
        <div style="margin-top:6px">
          ${lb('Vào', IN.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${IN.map(([v,l]) => chip('in', v, l, curIn)).join('')}</div>
          ${lb('Ra', OUT.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${OUT.map(([v,l]) => chip('out', v, l, curOut)).join('')}</div>
          ${lb('Giữ', HOLD.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${HOLD.map(([v,l]) => chip('hold', v, l, curHold)).join('')}</div>
        </div>
      </details>
    </div>
  </details>
  ${ctx.timing || ''}${ctx.tail || ''}`;
}

function _t7GfxEditor(c){
  const idx = Number(_t7GfxSel.split(':')[1]);
  const sp = (state.sceneSpecs || {})[c.sceneId];
  const L = sp && sp.layers && sp.layers[idx];
  if (!L) return '';
  const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const timing = `<details class="t7-sect">
    <summary><span><b>⏱ Thời điểm</b><em>Hiện lúc nào, tắt lúc nào trong cảnh.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Hiện ở (giây)')}<input class="t7-mfield" style="width:100%" value="${esc(L.at != null ? L.at : 0)}" onchange="t7LSet('at',parseFloat(this.value)||0)"></div>
      <div>${lb('Tắt ở (giây)')}<input class="t7-mfield" style="width:100%" placeholder="hết cảnh" value="${esc(L.until != null ? L.until : '')}" onchange="t7LSet('until',this.value===''?null:(parseFloat(this.value)||null))"></div>
    </div></div>
  </details>`;
  const tail = `<details class="t7-sect" open>
    <summary><span><b>📋 Dùng lại lớp này</b><em>Chép sang cảnh khác — khỏi gắn tay 192 lần.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:flex;gap:5px;margin-bottom:5px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxCopy()" title="⌘C">📋 Chép</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxDup()" title="⌘D">⧉ Nhân đôi</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxPaste()" title="⌘V">📥 Dán</button>
      </div>
      <button class="btn ghost sm" style="width:100%;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7GfxToGlobal()" title="Phủ cả video, chỉ 1 lớp — nhẹ hơn dán 192 lần">🌐 Chuyển thành lớp TOÀN CỤC</button>
      <button class="btn ghost sm" style="width:100%;margin-top:4px;padding:5px;font-size:11px" onclick="t7GfxPasteAll()" title="⇧⌘V">📥 Dán vào tất cả cảnh (192 bản sao)</button>
    </div>
  </details>
  <details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp này khỏi cảnh · phím Delete.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GfxDel(${idx})">Gỡ lớp đồ hoạ</button></div>
  </details>`;
  return _t7LayerPanel(L, { scene: true, timing, tail });
}

function _t7GlobEditor(){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return '';
  const L = g.layer || {}; const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const tot = (typeof _t7Total === 'function') ? _t7Total() : 0;
  const timing = `<details class="t7-sect" open>
    <summary><span><b>⏱ Thời gian trên CẢ VIDEO</b><em>Không thuộc cảnh nào — mốc tính từ đầu video (tổng ${tot.toFixed(1)}s).</em></span><span class="cv">⌃</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Bắt đầu (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0" step="0.5" value="${(Number(g.start) || 0).toFixed(1)}" onchange="t7GlobTime('start',this.value)"></div>
      <div>${lb('Kéo dài (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0.3" step="0.5" value="${(Number(g.dur) || 3).toFixed(1)}" onchange="t7GlobTime('dur',this.value)"></div>
    </div>
    <button class="btn ghost sm" style="width:100%;margin-top:7px;padding:5px;font-size:11px" onclick="t7GlobFull()">⇤⇥ Phủ trọn cả video (0 → ${tot.toFixed(1)}s)</button>
    </div>
  </details>`;
  const tail = `<details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp toàn cục này.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GlobDel(${_t7GlobSel})">Gỡ lớp toàn cục</button></div>
  </details>`;
  return `<div class="t7-drow" style="margin-bottom:8px"><span class="t7-dlab">🌐 Lớp toàn cục</span><div class="t7-dfield" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(_t7GfxName(L))}</div></div>
  ${_t7LayerPanel(L, { scene: false, timing, tail })}`;
}

async function _t7LoadFx(){
  if (!_t7Cat) await _t7Catalog();
  if (!_t7Trans) await _t7LoadTrans();
  if (!_t7Bits && window.native && typeof window.native.sceneBits === 'function'){
    try { const r = await window.native.sceneBits(); if (r && r.ok) _t7Bits = r.items || []; } catch (e) { _t7Bits = []; }
  }
  if (!_t7Bits) _t7Bits = [];
  if (!_t7Prev && window.native && typeof window.native.fxPreviews === 'function'){
    try { const r = await window.native.fxPreviews(); _t7Prev = (r && r.ok) ? (r.items || {}) : {}; } catch (e) { _t7Prev = {}; }
  }
  if (!_t7Prev) _t7Prev = {};
  const n = (_t7Cat || []).length + (_t7Trans || []).length + _t7Bits.length;
  const c = document.getElementById('t7FxCount'); if (c) c.textContent = n || '—';
  return n;
}

async function _t7FxSwatchLoad(){
  if (_t7FxSw) return _t7FxSw;
  _t7FxSw = {};
  const fxs = (_t7Cat || []).filter(t => /^fx-/.test(t.template));
  for (const t of fxs){
    try {
      const r = await window.native.previewLayers({ spec: { durationSec: 2, layers: [{ template: t.template }] }, t: 1.2 });
      const it = (r && r.ok && r.items || []).find(x => x && x.kind === 'fx');
      if (it && (it.pieces || []).length){
        _t7FxSw[t.template] = '<div style="position:relative;width:100%;height:100%;overflow:hidden">' + _t7LayerHtml(it) + '</div>';
      }
    } catch (e) {}
  }
  return _t7FxSw;
}

function _t7ABImgs(){
  if (_t7AB) return _t7AB;
  const imgs = [];
  for (const c of (t7State.clips || [])){
    const im = _t7ClipImg(c);
    if (im && imgs.indexOf(im) < 0) imgs.push(im);
    if (imgs.length >= 2) break;
  }
  _t7AB = { a: imgs[0] || '', b: imgs[1] || imgs[0] || '' };
  return _t7AB;
}

function _t7FxTargetSpec(){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c){ setStatus7('Chọn một cảnh trước đã.', 'error'); return null; }
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[c.sceneId];
  if (!sp){
    // Chưa có spec → dựng khung có lớp nền '@scene' để ảnh cảnh vẫn hiện dưới đồ hoạ.
    sp = state.sceneSpecs[c.sceneId] = { rev: Date.now(), layers: [
      { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } },
    ] };
  }
  return { c, sp };
}

function animOpen(){
  try { if (typeof t7Focus === 'function') t7Focus(false); } catch (e) {}
  switchTool('toolanim');                                  // switchTool tự gọi animInit()
}

async function animInit(){
  const body = document.getElementById('animBody'); if (!body) return;
  if (!_animLoaded){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">Đang nạp kho hiệu ứng…</div>';
    try { await _t7LoadFx(); } catch (e) {}
    _animLoaded = true;
  }
  animRender();
}

function animSetStatus(msg, tone){
  const el = document.getElementById('animStatus'); if (!el) return;
  el.textContent = msg || '';
  el.style.color = tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--accent)'
    : tone === 'error' ? 'var(--red)' : 'var(--text-muted)';
}

function _animSelClip(){
  try { return (t7State.clips || []).find(x => x.id === t7State.selClip) || null; }
  catch (e) { return null; }
}

function animGoT7(){
  switchTool('tool7');                                     // switchTool tự gọi t7Build()
  try { if (typeof t7SetMediaTab === 'function') t7SetMediaTab('fx'); } catch (e) {}
  try { if (typeof t7FxTab === 'function') t7FxTab('motion'); } catch (e) {}
}

function animApply(kind, name){
  if (!window.native || !window.native.sceneTemplates){
    animSetStatus('Chỉ áp được trong app Nova (Electron) — mở app desktop.', 'error'); return;
  }
  const c = _animSelClip();
  if (!c){
    animGoT7();
    animSetStatus('Chưa chọn cảnh — đã mở Dựng Video. Bấm chọn một cảnh trên timeline rồi quay lại đây bấm hiệu ứng.', 'warn');
    return;
  }
  if (kind === 'tpl' && typeof t7FxAddTpl === 'function') t7FxAddTpl(name);
  else if (kind === 'bit' && typeof t7FxAddBit === 'function') t7FxAddBit(name);
  else if (kind === 'tr' && typeof t7FxSetTrans === 'function') t7FxSetTrans(name);
  else { animSetStatus('Không áp được (thiếu hàm của Tool 7).', 'error'); return; }
  const nhan = kind === 'tr' ? 'chuyển cảnh' : (kind === 'bit' ? 'bit' : 'mẫu');
  animSetStatus('✓ Đã áp ' + nhan + ' vào cảnh ' + c.sceneId + ' — bấm 🎬 Mở Dựng Video để xem kết quả.', 'ok');
}

function animRender(){
  const body = document.getElementById('animBody'); if (!body) return;
  const qEl = document.getElementById('animQ');
  const q = (qEl ? qEl.value : '').toLowerCase();
  const esc = escapeHtml;
  const cat = _t7Cat || [], bits = _t7Bits || [], trans = _t7Trans || [];
  const stat = document.getElementById('animStat');
  if (stat) stat.textContent = cat.length + ' mẫu · ' + bits.length + ' bit · ' + trans.length + ' chuyển cảnh';
  if (!window.native || !window.native.sceneTemplates){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">⚠️ Kho hiệu ứng chỉ nạp được trong app Nova (Electron) — mở bằng app desktop. Trong trình duyệt thường sẽ thấy trống.</div>';
    return;
  }
  const _hit = (s) => !q || String(s || '').toLowerCase().includes(q);
  let html = '';
  // 1) Mẫu đồ hoạ động — ảnh xem trước thật từ nova:fxPreviews
  const t = cat.filter(x => _hit(x.label + ' ' + x.template));
  html += '<div class="anim-sec">Mẫu đồ hoạ động · ' + t.length + '</div>';
  html += t.length
    ? '<div class="anim-grid">' + t.map(x => {
        const im = (_t7Prev || {})['tpl_' + x.template];
        return '<div class="anim-card" onclick="animApply(\'tpl\',\'' + esc(x.template) + '\')" title="' + esc((x.params || []).join(' · ')) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x.label) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có mẫu nào khớp.</div>';
  // 2) Bit Remotion
  const b = bits.filter(_hit);
  html += '<div class="anim-sec">Bit Remotion · ' + b.length + '</div>';
  html += b.length
    ? '<div class="anim-grid">' + b.map(x => {
        const im = (_t7Prev || {})['bit_' + x];
        return '<div class="anim-card" onclick="animApply(\'bit\',\'' + esc(x) + '\')" title="' + esc(x) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có bit nào khớp.</div>';
  // 3) Chuyển cảnh — gom theo nhóm y như Tool 7 để dễ tìm
  const fam = {};
  trans.filter(x => _hit(x.label + ' ' + x.id)).forEach(x => { (fam[x.family] = fam[x.family] || []).push(x); });
  const famKeys = Object.keys(fam);
  const nTr = famKeys.reduce((n, f) => n + fam[f].length, 0);
  html += '<div class="anim-sec">Chuyển cảnh · ' + nTr + '</div>';
  html += famKeys.length
    ? famKeys.map(f =>
        '<div class="anim-fam">' + esc(_T7_FAM[f] || f) + '</div>' +
        '<div class="anim-trgrid">' + fam[f].map(x =>
          '<div class="anim-tr" onclick="animApply(\'tr\',\'' + esc(x.id) + '\')" title="' + esc(x.description || '') + ' — bấm để gán cho cảnh đang chọn"><b>' + esc(x.label) + '</b><s>' + (x.durationSec || '') + 's</s></div>').join('') + '</div>'
      ).join('')
    : '<div class="anim-dim">Không có chuyển cảnh nào khớp.</div>';
  body.innerHTML = html;
}

function _t7DragOk(want){ return !!_t7Drag && (want === 'any' || _t7Drag.kind === want || (want === 'layer' && _t7Drag.kind !== 'tr')); }

function _t7Snap(sec){
  if (t7State.snap === false) return sec;
  const tol = 6 / (t7State.pps || 8);                       // 6px quy ra giây
  const marks = [0, t7State.playT || 0];
  let acc = 0;
  _t7Clips().forEach(c => { marks.push(acc); acc += _t7ClipDur(c); });
  marks.push(acc);
  let best = sec, dmin = tol;
  marks.forEach(m => { const d = Math.abs(m - sec); if (d < dmin){ dmin = d; best = m; } });
  return best;
}

function _t7GfxCur(){
  if (!_t7GfxSel) return null;
  const [sid, k] = _t7GfxSel.split(':');
  const sp = (state.sceneSpecs || {})[sid];
  const L = sp && sp.layers && sp.layers[Number(k)];
  return L ? { sid, idx: Number(k), sp, L } : null;
}

function _t7Globs(){ if (!Array.isArray(state.globalGfx)) state.globalGfx = []; return state.globalGfx; }

function _t7GlobTouch(){
  if (typeof saveState === 'function') saveState(true);
  _t7OvKey = ''; t7RenderDetail(); t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
}

function _t7GfxSpec(){
  if (!_t7GfxSel) return null;
  const sid = _t7GfxSel.split(':')[0];
  return (state.sceneSpecs || {})[sid] || null;
}

function _t7GfxTouch(sp){
  sp.rev = Date.now();                                   // đổi rev → bản xem trước nạp lại spec
  _t7OvKey = '';                                          // ép vẽ lại lớp đồ hoạ ngay
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail();
  if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
}

function _t7LRef(){
  if (_t7GlobSel != null){
    const g = _t7Globs()[_t7GlobSel];
    return g ? { kind: 'glob', L: (g.layer = g.layer || {}), g, touch: _t7GlobTouch } : null;
  }
  const c = _t7GfxCur();
  return c ? { kind: 'scene', L: c.L, sp: c.sp, idx: c.idx, touch: () => _t7GfxTouch(c.sp) } : null;
}

function _t7BoxRead(L, key){
  if (L.template) return L[key];
  return (L.box || {})[key];
}

function _t7SelBox(){
  const r = _t7LRef(); if (!r) return null;
  const L = r.L;
  // Lớp mẫu: bố cục do mẫu dựng, chỉ biết vị trí khi người dùng đã đè x/y.
  const x = _t7BoxRead(L, 'x'), y = _t7BoxRead(L, 'y'), w = _t7BoxRead(L, 'w'), h = _t7BoxRead(L, 'h');
  if (x == null || y == null) return null;                 // chưa đè → không vẽ khung, tránh vẽ sai chỗ
  const centred = !!L.template || (L.box && L.box.anchor === 'center');
  const W = Number(w) || 30, H = Number(h) || 18;
  return { x: Number(x), y: Number(y), w: W, h: H, centred, hasW: w != null, hasH: h != null };
}

function _t7DrawSel(){
  const box = document.getElementById('t7GfxSel'); if (!box) return;
  const b = _t7SelBox();
  if (!b){ box.innerHTML = ''; return; }
  const left = b.centred ? b.x - b.w / 2 : b.x;
  const top  = b.centred ? b.y - b.h / 2 : b.y;
  const H = (n, cx, cy) => `<i data-h="${n}" style="position:absolute;${cy}:-4px;${cx}:-4px;width:9px;height:9px;border-radius:2px;background:var(--accent);border:1px solid #fff;pointer-events:auto;cursor:${n}-resize"></i>`;
  box.innerHTML = `<div id="t7SelBox" style="position:absolute;left:${left}%;top:${top}%;width:${b.w}%;height:${b.h}%;
      outline:1.5px solid var(--accent);outline-offset:2px;border-radius:3px;pointer-events:auto;cursor:move">
    ${H('nw','left','top')}${H('ne','right','top')}${H('sw','left','bottom')}${H('se','right','bottom')}
    <span style="position:absolute;left:0;top:-19px;background:var(--accent);color:var(--on-accent);font-size:9px;padding:1px 6px;border-radius:4px;white-space:nowrap">${escapeHtml(_t7GfxName(_t7LRef().L))}</span>
  </div>`;
  document.getElementById('t7SelBox').onpointerdown = _t7SelDrag;
}

function _t7SelDrag(ev){
  const stage = document.getElementById('t7GfxSel'); if (!stage) return;
  const b0 = _t7SelBox(); if (!b0) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const handle = ev.target && ev.target.dataset ? ev.target.dataset.h : null;
  ev.preventDefault(); ev.stopPropagation();
  const x0 = ev.clientX, y0 = ev.clientY;
  const el = document.getElementById('t7SelBox');
  const move = (e) => {
    const dx = (e.clientX - x0) / rect.width * 100;
    const dy = (e.clientY - y0) / rect.height * 100;
    let { x, y, w, h } = b0;
    if (!handle){ x += dx; y += dy; }
    else {
      // Kéo góc: đổi bề rộng, giữ tâm đúng phía đối diện cho tay cảm thấy tự nhiên.
      const sx = /w$/.test(handle) ? -1 : 1, sy = /^n/.test(handle) ? -1 : 1;
      w = Math.max(3, w + dx * sx * (b0.centred ? 2 : 1));
      h = Math.max(3, h + dy * sy * (b0.centred ? 2 : 1));
      if (!b0.centred){ if (sx < 0) x += dx; if (sy < 0) y += dy; }
    }
    x = Math.max(-20, Math.min(120, x)); y = Math.max(-20, Math.min(120, y));
    if (el){                                              // nhích khung ngay, chưa ghi vào dự án
      const L = b0.centred ? x - w / 2 : x, T = b0.centred ? y - h / 2 : y;
      el.style.left = L + '%'; el.style.top = T + '%'; el.style.width = w + '%'; el.style.height = h + '%';
    }
    move._v = { x, y, w, h };
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const v = move._v; if (!v) return;
    const r1 = Math.round(v.x * 10) / 10, r2 = Math.round(v.y * 10) / 10;
    if (!handle){ t7LBox('x', r1); t7LBox('y', r2); }
    else {
      t7LBox('w', Math.round(v.w * 10) / 10);
      if (b0.hasH || !b0.centred) t7LBox('h', Math.round(v.h * 10) / 10);
      if (!b0.centred){ t7LBox('x', r1); t7LBox('y', r2); }
    }
    setStatus7('📐 Đã đổi bố cục lớp trên khung.', 'ok');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

async function _t7DoSmartClip(c, opts){
  opts = opts || {};
  try {
    const s = _t7ClipScene(c); const narration = (s && s.text || '').trim();
    const hint = (state.scenePrompts && state.scenePrompts[c.sceneId]) || (state.scenePrompts2 && state.scenePrompts2[c.sceneId]) || '';
    const dur = parseFloat(_t7ClipDur(c)) || 4;
    const topic = (state.videoLogline || '').trim();   // chủ đề CẢ VIDEO — để phân biệt "gate" sân bay với "gate" nhà hàng
    const r = await window.native.smartClip({ keyword: opts.keyword || '', pickUrl: opts.pickUrl || '', startSec: opts.startSec, narration, hint, topic, duration: dur, vision: opts.vision !== false, score: true, entities: _clipEntities() });
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Lỗi' };
    // Chỉ ghi đè khi THẬT SỰ có tìm kiếm. Đường pickUrl (chọn tay / cắt lại đoạn)
    // trả về đúng 1 mục giả "(chọn tay)" không ảnh — ghi đè là mất sạch 8 clip đã
    // tìm được, dải clip còn mỗi ô đen.
    if (!opts.pickUrl && r.candidates && r.candidates.length){
      if (!state.ytCandidates) state.ytCandidates = {}; state.ytCandidates[c.sceneId] = r.candidates;
    }
    const b = await window.native.readFileB64(r.path);
    if (!b || !b.dataUrl) return { ok: false, error: 'Không đọc được clip' };
    if (!state.mediaPicks) state.mediaPicks = {};
    state.mediaPicks[c.sceneId] = { kind: 'video', downloadUrl: b.dataUrl, source: r.source || 'yt-smart', duration: r.duration || dur };
    // Giữ thông tin video GỐC để vẽ thanh chọn đoạn (heatmap) và cắt lại chỗ khác.
    if (!state.clipSrc) state.clipSrc = {};
    state.clipSrc[c.sceneId] = { url: r.srcUrl || opts.pickUrl || '', dur: r.srcDur || 0,
      heatmap: r.heatmap || null, sb: r.sb || null, start: r.winStart || 0, title: '' };
    try { c.useVideo = true; } catch (_) {}
    // LƯU NGAY (clip + danh sách ứng viên) — không thì tải lại app là mất, phải tìm lại từ đầu.
    try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); else if (typeof saveState === 'function') saveState(true); } catch (_) {}
    return { ok: true, query: r.query, source: r.source };
  } catch (e){ return { ok: false, error: String(e).slice(0, 120) }; }
}

function _t7RefreshAfterPick(sceneId){
  try {
    if (typeof t7State !== 'object' || !t7State || !Array.isArray(t7State.clips)) return;
    const c = t7State.clips.find(x => x.sceneId === sceneId); if (c) c.useVideo = true;
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
    if (typeof t7RenderRows === 'function') t7RenderRows();
    if (typeof t7RenderDetail === 'function') t7RenderDetail();
    if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
  } catch (e) {}
}

async function _t7ImgToDataUrl(img){
  if (!img) return null; if (/^data:/.test(img)) return img;
  try { const resp = await fetch(img); const blob = await resp.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); }); }
  catch (_) { return null; }
}

async function _t7LoadTrans(){
  if (_t7Trans) return _t7Trans;
  try {
    const r = await window.native.sceneTransitions();
    if (r && r.ok && Array.isArray(r.items) && r.items.length){ _t7Trans = r.items; return _t7Trans; }
  } catch (e) {}
  _t7Trans = _T7_TRANS_FALLBACK; return _t7Trans;
}

async function _t7AssetUrl(img){
  const src = await _t7ImgToDataUrl(img);
  if (!src) return '';
  if (!src.startsWith('data:')) return src;
  if (_t7BlobUrls.has(src)) return _t7BlobUrls.get(src);
  try { const blob = await (await fetch(src)).blob(); const url = URL.createObjectURL(blob); _t7BlobUrls.set(src, url); return url; }
  catch (e) { return src; }
}

function _t7DefaultSpec(c, src){
  const prev = null;
  return { id: c.sceneId, durationSec: parseFloat(_t7ClipDur(c)) || 3,
    // Chuyển cảnh GIỮA hai cảnh — NovaSequence đọc trường này, khác với in.preset là hiệu ứng của RIÊNG lớp.
    trans: c.trans || 'none', transDur: c.transDur || 0,
    theme: { bg: '#000000' },
    layers: src ? [{ type:'backdrop', src, at:0,
      in:  { preset: _T7_IN[c.trans] || 'fade', dur: Math.min(0.5, (c.transDur || 0.5)) },
      // Giãn nhịp: ngoài 30 giây đầu thì phần lớn cảnh để TĨNH.
      hold:{ preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 },
      out: { preset: 'fade', dur: 0.35 } }] : [] };
}

async function _t7NovaScenes(opts){
  const inline = !!(opts && opts.inline);
  const out = [];
  for (const c of _t7Clips()){
    const img = _t7ClipImg(c);
    const src = img ? (inline ? await _t7ImgToDataUrl(img) : await _t7AssetUrl(img)) : '';
    const designed = (state.sceneSpecs || {})[c.sceneId];
    if (designed && Array.isArray(designed.layers) && designed.layers.length){
      // Spec AI thiết kế: ÉP thời lượng theo cảnh + thay chỗ giữ "@scene" bằng ảnh thật.
      const spec = JSON.parse(JSON.stringify(designed));
      spec.id = c.sceneId;
      spec.durationSec = parseFloat(_t7ClipDur(c)) || 3;
      spec.trans = c.trans || 'none'; spec.transDur = c.transDur || 0;   // chuyển cảnh do clip quyết, không phải spec AI
      spec.layers.forEach(L => { if (L && L.src === '@scene') L.src = src; });
      spec.layers = spec.layers.filter(L => !(L && (L.type === 'backdrop' || L.type === 'image') && !L.src));
      out.push(spec);
    } else {
      out.push(_t7DefaultSpec(c, src));
    }
  }
  return out;
}

async function _t7Catalog(){
  if (_t7Cat) return _t7Cat;
  try {
    const r = await window.native.sceneTemplates();
    // Kho rỗng là trạng thái HỢP LỆ (vừa xoá sạch để thay mới) — trước đây coi là lỗi đọc.
    if (r && r.ok && Array.isArray(r.items)) { _t7Cat = r.items; return _t7Cat; }
  } catch (e) {}
  return null;
}

function _t7Gist(s, n){ const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }

function _t7AiSig(t){
  const s = String(t || '');
  let h = 0; for (let i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

function _t7AiSave(){
  try { state.aiQueue = _t7AiQ; if (typeof saveState === 'function') saveState(true); } catch (e) {}
}

function _t7AiSteps(cur, note){
  const box = document.getElementById('t7AiSteps'); if (!box) return;
  if (cur === 0) _t7AiNote = {};
  Object.assign(_t7AiNote, note || {});
  box.innerHTML = _T7_AI_STEP.map((ten, i) => {
    const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
    const phu = _t7AiNote[i] || (i === cur ? 'đang chạy…' : '');
    return `<div class="st ${cls}"><u>${i < cur ? '✓' : (i + 1)}</u>${escapeHtml(ten)}${phu ? ' · <span style="color:var(--text-dim)">' + escapeHtml(phu) + '</span>' : ''}</div>`;
  }).join('');
}

function _t7AiTally(){
  const ap = _t7AiQ.filter(x => x.state === 'ap').length;
  const nTr = _t7AiQ.filter(x => x.kind === 'tr').length;
  const el = document.getElementById('t7AiCnt');
  if (el) el.textContent = ap + ' / ' + _t7AiQ.length + ' đã gắn' + (nTr ? ' · ' + nTr + ' mối nối' : '');
  const n = document.getElementById('t7GfxCount');
  if (n){ let t = 0; try { Object.values(state.sceneSpecs || {}).forEach(sp =>
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') t++; })); } catch (e) {}
    n.textContent = t ? t + ' lớp' : ''; }
}

function _t7AiApply(q){
  // Mối nối: không đụng sceneSpecs, chỉ đặt kiểu chuyển lên chính clip đó.
  if (q.kind === 'tr'){
    const c = (t7State.clips || []).find(x => x.id === q.clipId || x.sceneId === q.sceneId);
    if (c){ c.trans = q.tr; c.transDur = q.trDur || 0.5;
      try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); } catch (e) {} }
    return;
  }
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[q.sceneId];
  if (!sp) sp = state.sceneSpecs[q.sceneId] = { rev: Date.now(), layers: [
    { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 },
      hold: { preset: _T7_HOLD[q.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } } ] };
  if (!Array.isArray(sp.layers)) sp.layers = [];
  const dua = (q.custom && q.custom.length) ? q.custom : q.picks;   // lớp thô hay mẫu — engine đọc chung một kiểu
  dua.forEach(pk => sp.layers.push(JSON.parse(JSON.stringify(pk))));
  sp.rev = Date.now();
}

function _t7AiLang(){
  try { return (typeof _profileLang === 'function' && _profileLang()) || 'Tiếng Việt'; }
  catch (e) { return 'Tiếng Việt'; }
}

function _t7AiClip(q){ return (t7State.clips || []).find(c => c.sceneId === q.sceneId) || null; }

function _t7AiDur(q){ const c = _t7AiClip(q); return c ? (parseFloat(_t7ClipDur(c)) || 3) : 3; }

function _t7AiSpecOf(q, dur){
  const L = (q.custom && q.custom.length) ? q.custom : (q.picks || []);
  return { rev: 1, durationSec: dur, layers: JSON.parse(JSON.stringify(L)) };
}

async function _t7AiPvHtml(q, t){
  if (!window.native || typeof window.native.previewLayers !== 'function') return '';
  const key = q.sceneId + '|d' + t.toFixed(2);
  if (_t7AiPv.has(key)) return _t7AiPv.get(key);
  const dur = _t7AiDur(q);
  let html = '';
  try {
    const r = await window.native.previewLayers({ spec: _t7AiSpecOf(q, dur), t: Math.min(t, dur) });
    if (r && r.ok) html = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e) { /* để trống, ô vẫn có nhãn báo */ }
  _t7AiPv.set(key, html);
  return html;
}

async function _t7AiPvDraw(i, chiNen){
  const q = _t7AiQ[i]; if (!q) return;
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  const pv = box.querySelector('.pv'); if (!pv) return;
  if (chiNen){ pv.innerHTML = ''; return; }        // "Trước" = cảnh trần, không cần hỏi engine
  const html = await _t7AiPvHtml(q, _t7AiTStill(_t7AiDur(q)));
  if (box.isConnected) pv.innerHTML = html;
}

function _t7AiTryClear(){
  if (!_t7AiTry) return;
  _t7AiTry = null; _t7OvKey = '';
  try { if (!t7State.playing) t7RenderPreview(); } catch (e) {}
}

function _t7AiPvHook(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  try { if (_t7AiObs) _t7AiObs.disconnect(); } catch (e) {}
  const nodes = box.querySelectorAll('.prev[data-i]');
  if (typeof IntersectionObserver !== 'function'){ nodes.forEach(e => _t7AiPvDraw(+e.dataset.i, false)); return; }
  _t7AiObs = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting){ _t7AiPvDraw(+e.target.dataset.i, e.target.dataset.mode === 'truoc'); _t7AiObs.unobserve(e.target); }
  }, { root: box, rootMargin: '300px' });
  nodes.forEach(e => _t7AiObs.observe(e));
}

function _t7AiFields(cat, tpl){
  const e = (cat || []).find(c => c.template === tpl); if (!e) return [];
  const d = e.defaults || {};
  const uu = ['text', 'headline', 'title', 'value', 'unit', 'kicker', 'subtitle', 'note', 'body', 'dek',
              'caption', 'label', 'name', 'chip', 'stamp', 'range', 'role', 'date',
              'position', 'pos', 'from', 'side', 'animation', 'dir', 'mode', 'size'];
  return (e.params || [])
    .filter(k => k !== 'src')                        // ảnh riêng của mẫu — chọn file, không sửa ở đây
    .map(k => {
      const v = d[k];
      let kind = 'text';
      if (_T7_ENUM[k]) kind = 'chon';
      else if (typeof v === 'number') kind = 'so';
      else if (typeof v === 'string' && /^(#|rgba?\()/.test(v)) kind = 'mau';
      return { key: k, kind, mac: v, chon: _T7_ENUM[k] || null };
    })
    .sort((a, b) => {
      const ia = uu.indexOf(a.key), ib = uu.indexOf(b.key);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

function _t7Hex(v){
  const s = String(v || '');
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
  return '#ffffff';
}

function _t7AiEditCustom(q, i){
  return (q.custom || []).map((L, j) => {
    const o = (key, nhan, kind, val, chon) => {
      const id = `cu${i}_${j}_${key}`;
      const set = `t7AiCustomSet(${i},${j},'${key}',this.value)`;
      if (kind === 'chon')
        return `<label for="${id}">${nhan}</label><select id="${id}" onchange="${set}">${
          chon.map(x => `<option value="${x}"${String(val) === x ? ' selected' : ''}>${(typeof NOVA_ANIM_LABELS !== 'undefined' && NOVA_ANIM_LABELS[x]) ? NOVA_ANIM_LABELS[x] : x}</option>`).join('')}</select>`;
      if (kind === 'mau')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="color" value="${_t7Hex(val)}" oninput="${set}">`;
      if (kind === 'so')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="number" value="${escapeHtml(String(val))}" oninput="${set}">`;
      return `<label for="${id}">${nhan}</label><input id="${id}" type="text" value="${escapeHtml(String(val == null ? '' : val))}" oninput="${set}">`;
    };
    const b = L.box || {}, st = L.style || {};
    const os = [
      L.type === 'text' ? o('text', 'Chữ', 'text', L.text) : '',
      o('x', 'Trái %', 'so', b.x), o('y', 'Trên %', 'so', b.y),
      o('w', 'Rộng %', 'so', b.w), o('h', 'Cao %', 'so', b.h),
      L.type === 'text' ? o('align', 'Canh', 'chon', b.align, ['left', 'center', 'right']) : '',
      L.type === 'text' ? o('size', 'Cỡ', 'so', st.size) : '',
      L.type === 'text' ? o('color', 'Màu chữ', 'mau', st.color) : o('fill', 'Màu khối', 'mau', st.fill),
      o('in', 'Vào cảnh', 'chon', L.in && L.in.preset, NOVA_IN_PRESETS),
      o('hold', 'Chuyển động chính', 'chon', L.hold && L.hold.preset, NOVA_HOLD_PRESETS),
    ].filter(Boolean).join('');
    return `<div class="edg"><b>Lớp ${j + 1} · ${L.type === 'text' ? 'chữ' : 'khối'}</b><div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7AiEditVeLai(i, q){
  clearTimeout(_t7AiEditT2);
  _t7AiEditT2 = setTimeout(() => {
    for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
    t7AiPvStop(); _t7AiPvDraw(i, false);
    if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){
      _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q)); _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {}
    }
    _t7AiSave();
  }, 220);
}

function _t7AiEditHtml(q, i, cat){
  if (q.custom && q.custom.length) return _t7AiEditCustom(q, i);
  return (q.picks || []).map((pk, j) => {
    const nhan = ((cat || []).find(c => c.template === pk.template) || {}).label || pk.template;
    const os = _t7AiFields(cat, pk.template).map(f => {
      const v = (pk[f.key] != null) ? pk[f.key] : f.mac;
      const id = `ed${i}_${j}_${f.key}`;
      const set = `t7AiEditSet(${i},${j},'${f.key}',this.${f.kind === 'mau' ? 'value' : 'value'})`;
      if (f.kind === 'chon')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <select id="${id}" onchange="${set}">${f.chon.map(o => `<option${String(v) === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      if (f.kind === 'so')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="number" step="${Number(f.mac) < 5 ? '0.05' : '1'}" value="${escapeHtml(String(v))}" oninput="${set}">`;
      if (f.kind === 'mau')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="color" value="${_t7Hex(v)}" oninput="${set}">`;
      return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="text" value="${escapeHtml(String(v == null ? '' : v))}" oninput="${set}">`;
    }).join('');
    return `<div class="edg">${(q.picks.length > 1) ? `<b>${escapeHtml(nhan)}</b>` : ''}<div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7DeNhau(a, b){
  return !(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1);
}

function _t7AiFixLayers(arr, dur){
  if (!Array.isArray(arr)) return [];
  const ra = [], hop = [];
  for (const L0 of arr.slice(0, _T7_MAX_LAYER + 2)){
    if (!L0 || typeof L0 !== 'object') continue;
    const type = (L0.type === 'shape') ? 'shape' : 'text';
    if (type === 'text' && !String(L0.text || '').trim()) continue;

    const b0 = L0.box || {};
    let x = _t7Kep(_t7Num(b0.x, 8), _T7_SAFE.x0, _T7_SAFE.x1);
    let y = _t7Kep(_t7Num(b0.y, 70), _T7_SAFE.y0, _T7_SAFE.y1);
    let w = _t7Kep(_t7Num(b0.w, 55), 8, 92);
    let h = _t7Kep(_t7Num(b0.h, type === 'shape' ? 12 : 18), 3, 90);
    if (x + w > _T7_SAFE.x1) w = _T7_SAFE.x1 - x;      // tràn mép phải → co lại, không đẩy
    if (y + h > _T7_SAFE.y1) h = _T7_SAFE.y1 - y;
    if (w < 8 || h < 3) continue;
    const hopNay = { x, y, w, h };
    if (hop.some(o => _t7DeNhau(o, hopNay))) continue;  // đè lớp đã nhận → bỏ

    const st0 = L0.style || {}, st = {};
    if (type === 'text'){
      st.size = _t7Kep(_t7Num(st0.size, 54), _T7_SIZE.min, _T7_SIZE.max);
      st.weight = _t7Kep(_t7Num(st0.weight, 800), 300, 900);
      st.color = _t7MauOk(st0.color) || '#ffffff';
      if (_t7MauOk(st0.bg)) st.bg = _t7MauOk(st0.bg);
      if (st0.upper) st.upper = true;
      st.shadow = st0.shadow !== false;                 // chữ trên video: mặc định có bóng cho đọc được
    } else {
      st.fill = _t7MauOk(st0.fill) || 'rgba(0,0,0,.55)';
      if (_t7MauOk(st0.fill2)) st.fill2 = _t7MauOk(st0.fill2);
      if (['gradient', 'radial'].includes(st0.fillType)) st.fillType = st0.fillType;
      st.radius = _t7Kep(_t7Num(st0.radius, 10), 0, 40);
    }

    const L = { type, box: { x, y, w, h, align: ['left', 'center', 'right'].includes(b0.align) ? b0.align : 'left' },
      style: st,
      at: _t7Kep(_t7Num(L0.at, 0), 0, Math.max(0, dur - 0.3)),
      in:   { preset: _t7Preset(L0.in && L0.in.preset, NOVA_IN_PRESETS, 'fade'),   dur: _t7Kep(_t7Num(L0.in && L0.in.dur, 0.45), 0.15, 1.2) },
      hold: { preset: _t7Preset(L0.hold && L0.hold.preset, NOVA_HOLD_PRESETS, 'none') },
      out:  { preset: _t7Preset(L0.out && L0.out.preset, NOVA_OUT_PRESETS, 'fade'), dur: _t7Kep(_t7Num(L0.out && L0.out.dur, 0.35), 0.15, 1.2) },
      z: ra.length + 1 };
    if (type === 'text') L.text = String(L0.text).trim().slice(0, 60);
    if (L0.shape === 'ellipse') L.shape = 'ellipse';
    ra.push(L); hop.push(hopNay);
    if (ra.length >= _T7_MAX_LAYER) break;
  }
  // Lớp nền (shape) phải nằm DƯỚI chữ, không thì che mất.
  ra.sort((a, b) => (a.type === 'shape' ? 0 : 1) - (b.type === 'shape' ? 0 : 1));
  ra.forEach((L, i) => { L.z = i + 1; });
  return ra;
}

function _t7CustomNhan(layers){
  const nT = (layers || []).filter(L => L.type === 'text').length;
  const nS = (layers || []).length - nT;
  return '✎ Tự thiết kế · ' + [nT ? nT + ' chữ' : '', nS ? nS + ' khối' : ''].filter(Boolean).join(' + ');
}

function _t7CustomSpec(){ return `
✎ CUSTOM DESIGN (use VERY SPARINGLY):
If none of the templates above fits this scene but graphics are still warranted, replace "picks" with "custom":
"custom":[
 {"type":"shape","box":{"x":6,"y":62,"w":52,"h":22},"style":{"fill":"rgba(0,0,0,.6)","radius":12},
  "at":0,"in":{"preset":"wipeL","dur":0.4},"out":{"preset":"fade","dur":0.3}},
 {"type":"text","text":"short text","box":{"x":9,"y":66,"w":46,"align":"left"},
  "style":{"size":64,"weight":800,"color":"#ffffff"},
  "at":0.15,"in":{"preset":"rise","dur":0.45},"hold":{"preset":"drift"},"out":{"preset":"fade","dur":0.3}}]
- Coordinates are % of the frame, origin at the top-left corner. Max 3 layers, NEVER let two boxes overlap.
- type may only be "text" or "shape". in/hold/out must use exact names from these lists:
  in: ${NOVA_IN_PRESETS.join(' ')}
  hold: ${NOVA_HOLD_PRESETS.join(' ')}
  out:  ${NOVA_OUT_PRESETS.join(' ')}
- Only use this when a truly custom layout is needed. If a template fits, ALWAYS use the template instead of drawing your own.`; }

function _t7AiTrQuota(n){
  return {
    _tong: Math.max(2, Math.round(n * 0.2)),   // tối đa 20% mối nối được khác cut
    'dip-white': 2, 'flash-cut': 2, 'glow-bloom': 1,
    'zoom-through': 2, 'match-zoom': 2, 'film-burn': 2, 'light-leak': 2,
    'barn-door': 1, 'shutter': 1, 'iris': 1, 'film-roll': 1,
    'paper-drop': 3, 'grain-dissolve': 3, 'defocus': 3,
    'wipe-left': 3, 'wipe-up': 3, 'push-left': 3, 'push-up': 3,
  };
}

function _t7AiTrGate(id, idx, S, cat){
  if (id === 'cut') return '';
  if (!S.cho.has(id)) return 'không có trong danh mục';
  if (S.dung >= S.quota._tong) return 'đã đủ ' + S.quota._tong + ' mối nối khác cut';
  const q = S.quota[id];
  if (q != null && (S.used[id] || 0) >= q) return 'hết trần của cú này';
  const last = S.last[id];
  if (last != null && idx - last < 4) return 'vừa dùng cách ' + (idx - last) + ' mối nối';
  if (S.lienTiep && idx - S.lienTiep < 2) return 'hai mối nối liền nhau đều có hiệu ứng';
  return '';
}

function _t7AiTrTake(id, idx, S){
  S.used[id] = (S.used[id] || 0) + 1; S.last[id] = idx; S.dung++; S.lienTiep = idx;
}

async function _t7AiTrans(clips, map, cat, onTick){
  const noi = clips.slice(0, -1);                    // clip cuối không có mối nối
  if (noi.length < 2) return [];
  const S = { quota: _t7AiTrQuota(noi.length), used: {}, last: {}, dung: 0, lienTiep: null,
              cho: new Set((cat || []).filter(x => x.id !== 'cut' && !(x.tags || []).includes('tranh')).map(x => x.id)) };
  const bang = (cat || []).filter(x => S.cho.has(x.id))
    .map(x => `${x.id} (${x.label}) — ${x.description}`).join('\n');
  const topic = String(state.videoLogline || '').trim();
  const ra = [];
  const CH = 40;

  for (let i = 0; i < noi.length; i += CH){
    if (state.cancelRequested) break;
    const lot = noi.slice(i, i + CH);
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), nx = _t7ClipScene(clips[i + k + 1]);
      const mp = map[c.sceneId] || {}, mn = map[clips[i + k + 1].sceneId] || {};
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s ${mp.role || '?'} → ${mn.role || '?'}] `
        + `"${_t7Gist(sc && sc.text, 70) || '—'}" ⇒ "${_t7Gist(nx && nx.text, 70) || '—'}"`;
    }).join('\n');

    const prompt = `You are a documentary film editor. Choose the TRANSITION for each junction below.
${topic ? 'TOPIC: ' + topic + '\n' : ''}
⚠️ MOST IMPORTANT RULE: the default is a HARD CUT. A good documentary keeps about 80% of junctions
as hard cuts; every other transition is an EXCEPTION that needs a reason. For this whole batch you should
nominate at most ${Math.max(1, Math.round(lot.length * 0.2))} junctions. Omit any junction that should be a hard cut ENTIRELY from the result.

USABLE TRANSITIONS:
${bang}

WHEN TO USE:
- Chapter change, time jump, full location change → dip-black
- Shift of idea within the same thread, short time drift → dissolve
- Decisive topic change, needs a punch → whip-pan
- Cutting to archive footage / flashback → grain-dissolve, defocus, light-leak, film-burn
- Paper-cut scenes chained together → paper-slide, paper-drop
- Maps, charts, lists chained together → wipe-left, wipe-up, push-left, push-up
- Two scenes with the SAME composition → match-zoom
Do NOT use a strong transition in the middle of a continuous narrative passage.

JUNCTIONS (the number is the index within the batch):
${list}

Return a JSON array containing ONLY the junctions that need something other than a hard cut:
[{"i":0,"tr":"dip-black","why":"short Vietnamese reason, under 16 words"}]`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1200, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('⚡ Lô chuyển cảnh lỗi: ' + String(e.message || e).slice(0, 80), 'warn'); }
    }
    if (arr == null) continue;

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + k;
      const id = String(row.tr || '').trim();
      if (_t7AiTrGate(id, idx, S, cat)) return;
      _t7AiTrTake(id, idx, S);
      const e = (cat || []).find(x => x.id === id) || {};
      ra.push({ kind: 'tr', sceneId: c.sceneId, clipId: c.id, name: _t7ClipLabel(c),
        tr: id, trLabel: e.label || id, trDur: Number(e.durationSec) || 0.5,
        line: _t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 90) || '(không lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do.', state: '', picks: [], custom: [] });
    });
    if (onTick) onTick(Math.min(i + CH, noi.length), noi.length, ra.length);
  }
  return ra;
}

function _t7AiRender(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  if (!_t7AiQ.length){ box.innerHTML = '<div class="t7-empty">Trợ lý không đề xuất gì thêm — các cảnh đang ổn.</div>'; return; }
  box.innerHTML = _t7AiQ.map((q, i) => {
    // Đã quyết định thì gập lại một dòng — khỏi chiếm chỗ của những cảnh còn phải xem.
    if (q.state) return `<div class="drow ${q.state === 'ap' ? 'ap' : 'sk'}">
      <span class="sc">${escapeHtml(q.name)}${q.kind === 'tr' ? ' →' : ''}</span>
      <span class="msg">${q.state === 'ap' ? '✓ Đã gắn · ' + escapeHtml(q.kind === 'tr' ? q.trLabel : q.tplLabel) : 'Đã bỏ qua'}</span></div>`;
    // Mối nối là chỗ GIỮA hai cảnh, không có khung hình riêng để xem trước → thẻ gọn.
    if (q.kind === 'tr') return `<div class="pr trrow" data-i="${i}">
      <div class="prb">
        <div class="prh"><span class="sc">${escapeHtml(q.name)} → cảnh sau</span>
          <span class="tpl">⚡ ${escapeHtml(q.trLabel)}</span></div>
        <p class="prq">“${escapeHtml(q.line)}”</p>
        <p class="why">${escapeHtml(q.why)}</p>
        <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn chuyển cảnh</button>
          <button onclick="t7AiDecide(${i},false)">Cắt thẳng</button></div>
      </div></div>`;
    const cl = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const nen = cl ? (_t7ThumbImg(cl) || '') : '';
    return `<div class="pr" data-i="${i}">
    <div class="prev" data-i="${i}" data-mode="sau" onclick="t7AiTry(${i})" title="Bấm để xem cảnh này trên khung lớn"${nen ? ` style="background-image:url('${escapeHtml(nen)}')"` : ''}>
      <div class="pv"></div>
      ${nen ? '' : '<div class="nohint">cảnh chưa có hình — chỉ xem được lớp đồ hoạ</div>'}
      <div class="ab"><button data-m="sau" class="on" onclick="t7AiPvMode(${i},'sau',event)">Sau</button><button data-m="truoc" onclick="t7AiPvMode(${i},'truoc',event)">Trước</button></div>
      <button class="play" onclick="t7AiPvPlay(${i},event)">▶ Xem chuyển động</button>
    </div>
    <div class="prb">
      <div class="prh"><span class="sc">${escapeHtml(q.name)}${q.role ? ' · ' + escapeHtml(q.role) : ''}</span><span class="tpl">${escapeHtml(q.tplLabel)}</span></div>
      <p class="prq">“${escapeHtml(q.line)}”</p>
      <p class="why">${escapeHtml(q.why)}</p>
      <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn vào cảnh</button>
        <button onclick="t7AiDecide(${i},false)">Bỏ qua</button>
        <button class="edbtn" onclick="t7AiEditToggle(${i},event)" title="Sửa chữ, vị trí, cỡ, màu của hiệu ứng này">⚙ Chỉnh</button></div>
    </div>
  </div>`; }).join('');
  _t7AiTally();
  _t7AiPvHook();
}

function _t7QuickFrames(id){
  return Promise.all([1, 2, 3].map(n => new Promise(res => {
    const u = `https://i.ytimg.com/vi/${id}/hq${n}.jpg`, im = new Image();
    im.onload = () => res(im.naturalWidth > 100 ? u : '');   // 120×90 = ảnh thay thế, bỏ
    im.onerror = () => res('');
    im.src = u;
  }))).then(a => a.filter(Boolean));
}

function _t7SbCell(sb, t){
  if (!sb || !Array.isArray(sb.frags) || !sb.frags.length) return null;
  let i = 0, acc = 0;
  for (; i < sb.frags.length; i++){
    const d = sb.frags[i].dur || 0;
    if (t < acc + d || i === sb.frags.length - 1) break;
    acc += d;
  }
  const f = sb.frags[i]; if (!f) return null;
  const per = (f.dur || 1) / (sb.rows * sb.cols);          // mỗi ô phủ bao nhiêu giây
  const k = Math.max(0, Math.min(sb.rows * sb.cols - 1, Math.floor((t - acc) / per)));
  return { url: f.url, x: (k % sb.cols) * sb.w, y: Math.floor(k / sb.cols) * sb.h, w: sb.w, h: sb.h,
    sw: sb.w * sb.cols, sh: sb.h * sb.rows };
}

function _t7SetNote(sceneId, msg, type){
  if (msg) _t7Notes[sceneId] = { msg, type: type || 'info' }; else delete _t7Notes[sceneId];
  setStatus7(msg || '', type);
  t7RenderSceneList();
}

function _t7NoteHtml(sceneId){
  const n = _t7Notes[sceneId]; if (!n) return '';
  const col = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' }[n.type] || 'var(--text-muted)';
  return `<div style="font-size:11.5px;line-height:1.5;margin:7px 0 0;color:${col}">${escapeHtml(n.msg)}</div>`;
}

function _t7SceneBody(c){
  const esc = escapeHtml;
  const useVid = _t7UsesVideo(c);
  const pk = (state.mediaPicks || {})[c.sceneId] || {};
  const isStock = /pexels|stock|pixabay|coverr/i.test(pk.source || '');
  // Dọn rác cũ: bản trước lưu mục giả "(chọn tay)" (không link xem được, không ảnh)
  // mỗi lần chọn clip bằng tay, ghi đè cả danh sách thật. Đã chặn ghi mới, nhưng
  // dự án cũ vẫn còn — lọc ở đây để không hiện ra như một ứng viên.
  // ⚠️ Ứng viên hai nguồn có SƠ ĐỒ TRƯỜNG KHÁC NHAU:
  //   YouTube → url / title / thumbnail / durationSec
  //   Stock   → downloadUrl / thumb / duration  (không có url, không có title)
  // Lọc theo mỗi x.url là quét sạch clip stock — tìm được 8 clip mà vẫn báo "chưa có".
  const _clean = (a) => (a || []).filter(x => x && (x.url || x.downloadUrl) && x.title !== '(chọn tay)');
  const yt = _clean((state.ytCandidates || {})[c.sceneId]);
  const st = _clean((state.stockCandidates || {})[c.sceneId]);
  // Tab mặc định = nguồn cảnh đang dùng; sau đó theo lựa chọn của người dùng.
  const now = !useVid ? 'ai' : (isStock ? 'st' : 'yt');
  const tab = _t7SrcTab[c.sceneId] || now;

  const seg = `<div class="t7-seg">
    <button class="${tab === 'ai' ? 'on' : ''}" onclick="event.stopPropagation();t7UseImage('${c.id}');t7SrcTab('${c.sceneId}','ai')">🖼 Ảnh AI</button>
    <button class="${tab === 'yt' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','yt')">🎬 YouTube${yt.length ? ` <span class="cnt">${yt.length}</span>` : ''}</button>
    <button class="${tab === 'st' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','st')">🔍 Stock${st.length ? ` <span class="cnt">${st.length}</span>` : ''}</button>
  </div>`;

  // ── nội dung theo TỪNG tập, không trộn ──
  let body = '';
  if (tab === 'ai'){
    const img = _t7ClipImg(c);
    body = `<div class="t7-slb">Ảnh AI của cảnh</div>` + (img
      ? `<div style="display:flex;gap:9px;align-items:center">
           <span style="display:block;width:112px;height:63px;border-radius:7px;background:#0b1020 center/cover no-repeat url('${esc(img)}');border:1.5px solid ${now === 'ai' ? 'var(--accent)' : 'transparent'}"></span>
           <span style="font-size:11px;color:var(--text-dim);line-height:1.5">Ảnh do AI dựng ở tab Phân Cảnh.<br>Muốn đổi hình thì sang tập YouTube hoặc Stock.</span>
         </div>`
      : `<div style="font-size:11.5px;color:var(--text-dim);line-height:1.55">Cảnh chưa có ảnh AI. Sang tab <b style="color:var(--text)">Phân Cảnh</b> bấm ✨ Tạo ảnh, hoặc chọn clip ở tập YouTube / Stock.</div>`);
  } else {
    const list = tab === 'yt' ? yt : st;
    const label = tab === 'yt' ? 'YouTube' : 'Stock';
    const find = tab === 'yt' ? `t7SrcYt('${c.id}','${c.sceneId}')` : `t7SrcStock('${c.sceneId}')`;
    const more = tab === 'yt' ? `t7OpenYtPicker('${c.sceneId}')` : `t2OpenStockPicker('${c.sceneId}')`;
    // Clip đang chạy chỉ được đánh ✓ khi cảnh THẬT SỰ dùng video của ĐÚNG nguồn này.
    // ⚠️ pk.downloadUrl là ĐƯỜNG DẪN FILE ĐÃ CẮT trên máy — không bao giờ trùng url
    // YouTube của thẻ, nên trước đây không thẻ nào được đánh dấu "đang dùng".
    // Nguồn thật nằm ở state.clipSrc[sceneId].url; so thêm cả theo id video để
    // youtu.be/XXX và watch?v=XXX vẫn khớp nhau.
    const cur = (useVid && now === tab) ? (pk.downloadUrl || pk.url || '') : '';
    const curSrc = (useVid && now === tab) ? (((state.clipSrc || {})[c.sceneId] || {}).url || '') : '';
    const curId = _t7YtId(curSrc);
    if (!list.length){
      body = `<div class="t7-slb">Clip ${label}</div>
        <div style="font-size:11.5px;color:var(--text-dim);line-height:1.55;margin-bottom:7px">Chưa tìm clip ${label} cho cảnh này.</div>
        <button class="btn ghost sm" style="padding:5px 13px;font-size:11.5px;border-color:var(--accent);color:var(--accent);font-weight:600" onclick="event.stopPropagation();${find}">🔎 Tìm clip ${label}</button>` + _t7NoteHtml(c.sceneId);
    } else {
      /* 🎯 Khớp lời chỉ hiện khi cảnh ĐANG dùng video của tập này — nó cắt lại
         chính clip đang gắn, không có clip thì không có gì để cắt.           */
      const _coNguon = !!(useVid && now === tab && (((state.clipSrc || {})[c.sceneId] || {}).url || c.srcUrl));
      body = `<div class="t7-slb" style="justify-content:flex-end;gap:10px">
          ${_coNguon ? `<button style="border:0;background:none;color:var(--teal);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            title="Bóc băng video nguồn rồi cắt lại đúng giây đang nói nội dung cảnh này. Chỉ hợp với tư liệu CÓ LỜI (phát biểu, phỏng vấn, điều trần) — b-roll không có gì để khớp. Tải tiếng có thể mất từ 10 giây tới vài phút tuỳ nền tảng."
            onclick="event.stopPropagation();t7KhopLoi('${c.id}')">🎯 Khớp lời</button>` : ''}
          <button style="border:0;background:none;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            onclick="event.stopPropagation();${more}">🔎 Tìm thêm</button></div>
        <div class="t7-strip">${list.map((x, i) => {
          const xu = x.url || x.downloadUrl || '';
          const xth = tab === 'yt' ? (x.thumbnail || x.thumb || '') : _stockThumb(x);
          const xdur = x.durationSec || x.duration || 0;
          const xti = x.title || (x.kind === 'image' ? '🖼 Ảnh' : '🎞 Clip') + ' ' + (x.source || 'stock');
          const on = (cur && (xu === cur || x.downloadUrl === cur))
                  || (curSrc && xu === curSrc)
                  || (curId && _t7YtId(xu) === curId);
          const fn = tab === 'yt' ? `t7PickYt('${c.sceneId}',${i})` : `t2PickStock('${c.sceneId}',${i})`;
          // Xem thử động chỉ có nghĩa với YouTube (dựa vào id video để đoán link ảnh).
          const hov = tab === 'yt' ? ` onmouseenter="t7CandHover('${esc(xu)}',this)" onmouseleave="t7CandLeave()"` : '';
          return `<button class="t7-cd${on ? ' on' : ''}"${on ? ' data-on="1"' : ''} onclick="event.stopPropagation();${fn}" title="${esc(xti)}"${hov}>
            <span class="im${xth ? '' : ' noimg'}"${xth ? ` style="background-image:url('${esc(xth)}')"` : ''}>${on ? '<u>✓</u><em>đang dùng</em>' : ''}${xdur ? `<s>${Math.round(xdur)}s</s>` : ''}</span>
            <i>${esc(String(xti).slice(0, 48))}</i></button>`;
        }).join('')}</div>` + _t7NoteHtml(c.sceneId);
    }
  }

  let nGfx = 0;
  try { const sp = (state.sceneSpecs || {})[c.sceneId];
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; }); } catch (e) {}
  const ft = `<div class="t7-sft">
    <span>Dài <b class="k">${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s</b></span>
    ${nGfx ? `<button class="gf" onclick="event.stopPropagation();t7GfxClearScene('${c.sceneId}')"
        title="Đồ hoạ do 🎬 AI dựng đồ hoạ gắn vào — bấm để gỡ khỏi cảnh này">✦ ${nGfx} lớp ✕</button>`
      : '<span style="color:var(--text-dim)">—</span>'}
    <span style="flex:1"></span>
    <button onclick="event.stopPropagation();t7DupSel()">⧉ Nhân đôi</button>
    <button class="dg" onclick="event.stopPropagation();t7DeleteSel()">🗑 Xoá</button>
  </div>`;
  return `<div class="t7-sbd">${seg}${body}${ft}</div>`;
}

function _t7TplTextKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.find(p => _T7_TXT_KEYS.includes(p)) || '') : '';
}

function _t7TplPosKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.includes('position') ? 'position' : (e.params.includes('pos') ? 'pos' : '')) : '';
}

function _t7AiQuota(n){
  // Kho mẫu đang RỖNG nên không còn trần theo tên. Thêm mẫu mới thì đặt trần ở đây:
  //   'ten-mau': 2,   → cả video tối đa 2 lần
  return {
    _ambient: Math.max(3, Math.ceil(n * 0.18)),
    _text: Math.max(3, Math.round(n * 0.12)),   // trần số cảnh ĐƯỢC đặt chữ
  };
}

function _t7AiGate(tpl, idx, S, cat){
  const q = S.quota;
  // Cần toạ độ vật thể mà model không nhìn thấy khung hình → khoanh bừa. Chặn hẳn.
  if (_T7_CAM.includes(tpl)) return 'mẫu cần toạ độ, model không thấy khung hình';
  if (q[tpl] != null && (S.used[tpl] || 0) >= q[tpl]) return 'hết hạn ngạch mẫu này';
  if (_T7_AMBIENT.includes(tpl) && S.amb >= q._ambient) return 'đủ lớp không khí cho cả video';
  if (_t7TplTextKey(cat, tpl) && S.txt >= q._text) return 'đã quá nhiều cảnh có chữ';
  const last = S.last[tpl];
  if (last != null && idx - last < 3) return 'vừa dùng cách đây ' + (idx - last) + ' cảnh';
  return '';
}

function _t7AiTake(tpl, idx, S, cat){
  S.used[tpl] = (S.used[tpl] || 0) + 1; S.last[tpl] = idx;
  if (_T7_AMBIENT.includes(tpl)) S.amb++;
  if (_t7TplTextKey(cat, tpl)) S.txt++;
}

function _t7AiQuotaLine(S){
  const q = S.quota, out = [];
  Object.keys(q).forEach(k => {
    if (k[0] === '_') return;
    const con = q[k] - (S.used[k] || 0);
    if (con <= 0) out.push(`${k}: EXHAUSTED, do not use`);
  });
  const ambCon = q._ambient - S.amb, txtCon = q._text - S.txt;
  out.push(`ambient layers: ${Math.max(0, ambCon)} remaining`);
  out.push(`${Math.max(0, txtCon)} scenes still allowed to carry text`);
  const kchu = _T7_NOTEXT.reduce((a2, k) => a2 + (S.used[k] || 0), 0);
  out.push(`used ${S.txt} text templates and ${kchu} no-text templates` +
    (S.txt >= 3 && kchu === 0 ? ' → HEAVILY SKEWED TOWARD TEXT, prioritize no-text templates in this batch' : ''));
  return out.join(' · ');
}

async function _t7AiMap(clips, onTick){
  if (!state.aiMap) state.aiMap = {};
  const map = state.aiMap;                       // kho của DỰ ÁN, không phải biến tạm
  const CH = 70;                                 // 70 cảnh/lượt: gọn trong cửa sổ, vẫn thấy toàn cảnh
  const topic = String(state.videoLogline || '').trim();
  // Chỉ đọc cảnh CHƯA có trong bản đồ hoặc đã bị sửa lời. Mở lại video cũ → 0 lượt gọi.
  const can = clips.filter(c => {
    const sc = _t7ClipScene(c), h = _t7AiSig(sc && sc.text);
    const cu = map[c.sceneId];
    return !(cu && cu.h === h);
  });
  if (!can.length){ if (onTick) onTick(clips.length, clips.length, 0); return map; }
  clips = can;
  for (let i = 0; i < clips.length; i += CH){
    if (state.cancelRequested) break;
    const lot = clips.slice(i, i + CH);
    const list = lot.map((c, k) => `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 120) || '(không lời)'}`).join('\n');
    const prompt = `You are a video editor. Read the ENTIRE script segment below, then score each scene.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}
For EACH scene return:
- role: exactly one of mo-dau | dan-dat | so-lieu | trich-dan | chuyen-y | chot
- key: the specific person / organization / place name appearing in the line ("")
- num: a number worth showing on screen in the line, kept as written ("")
- emp: 0-3 — how much it deserves a graphics emphasis. 0 = connective sentence, 3 = closing/shocking line.
The whole video should have only a few emp=3 scenes. Do not grade generously.

SCENES:
${list}

Return a JSON array with all ${lot.length} elements: [{"i":0,"role":"mo-dau","key":"","num":"","emp":2}]`;
    let arr = [];
    try { arr = await callLLMJson(prompt, { maxTokens: 2600, validate: (d) => Array.isArray(d) }); }
    catch (e){ novaLog && novaLog(`✨ Bản đồ cảnh ${i + 1}–${i + lot.length} lỗi: ${String(e.message || e).slice(0, 80)}`, 'warn'); }
    arr.forEach(r => {
      const k = Number(r && r.i); const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const sc = _t7ClipScene(c);
      map[c.sceneId] = { role: String(r.role || '').slice(0, 12), key: String(r.key || '').slice(0, 40),
        num: String(r.num || '').slice(0, 24), emp: Math.max(0, Math.min(3, Number(r.emp) || 0)),
        h: _t7AiSig(sc && sc.text) };
    });
    if (onTick) onTick(Math.min(i + CH, clips.length), clips.length, clips.length);
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // bản đồ là thứ đắt nhất, lưu ngay
  return map;
}

async function _t7AiVision(cat, onTick){
  const jobs = [];
  _t7AiQ.forEach((q, i) => {
    if (q.kind === 'tr') return;
    const coChu = (q.custom && q.custom.length) ? q.custom.some(L => L.type === 'text')
                                                : q.picks.some(p => _t7TplTextKey(cat, p.template));
    if (coChu) jobs.push(i);
  });
  let done = 0, doi = 0;
  const one = async (qi) => {
    const q = _t7AiQ[qi]; if (!q || q.state) return;
    const clip = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const img = clip ? _t7ThumbImg(clip) : null;
    if (!img){ doi++; return; }
    let b64 = '', mime = 'image/jpeg';
    try {
      const durl = await _t7ImgToDataUrl(img);
      const m = /^data:([^;,]+);base64,(.+)$/.exec(String(durl || ''));
      if (!m){ doi++; return; }
      mime = m[1]; b64 = m[2];
    } catch (e){ doi++; return; }
    // Mẫu tự sinh: chữ nằm ngay ở L.text, vị trí là hộp x/y nên không đổi theo "góc".
    const tuVe = !!(q.custom && q.custom.length);
    const pk = tuVe ? q.custom.find(L => L.type === 'text') : q.picks.find(p => _t7TplTextKey(cat, p.template));
    if (!pk){ doi++; return; }
    const tk = tuVe ? 'text' : _t7TplTextKey(cat, pk.template);
    const posKey = tuVe ? '' : _t7TplPosKey(cat, pk.template);
    const prompt = `This is the REAL frame of a video scene. We plan to overlay this text on it: "${String(pk[tk] || '').slice(0, 60)}" (template: ${tuVe ? 'custom design' : pk.template}).

Return JSON: {"ok":true/false,"pos":"corner","text":"edited text if needed","why":"one short Vietnamese sentence"}
- ok=false IF: the frame already has text/logo, or is too busy, or the subject fills nearly the whole frame so any text would cover faces.
- pos: pick from ${_T7_POS.join(' | ')} — the EMPTIEST area, avoiding faces and key objects.
- text: keep unchanged if fine; shorten to under 6 words if long; "" if ok=false.
  Write it in EXACTLY ${_t7AiLang()} — the same language as the script, do not translate to Vietnamese.
Print ONLY the JSON.`;
    let r = null;
    try {
      r = await callLLMJson(prompt, { maxTokens: 300, tries: 2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: prompt } ] }],
        validate: (d) => d && typeof d === 'object' && !Array.isArray(d) });
    } catch (e){ doi++; return; }
    if (!r) { doi++; return; }
    if (r.ok === false){
      q.drop = 'Khung hình không còn chỗ đặt chữ' + (r.why ? ' — ' + String(r.why).slice(0, 70) : '');
      return;
    }
    if (posKey && _T7_POS.includes(String(r.pos))) pk[posKey] = String(r.pos);
    const t2 = String(r.text || '').trim();
    if (t2 && t2 !== pk[tk]){ pk[tk] = t2.slice(0, 70); }
    q.why += ' · Đã soi khung: đặt ' + (posKey ? (pk[posKey] || 'mặc định') : 'vị trí mẫu') + '.';
  };
  // 4 luồng song song — nhanh gấp mấy lần chạy tuần tự mà không dội request.
  const pool = 4; let cur = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (cur < jobs.length && !state.cancelRequested){
      const qi = jobs[cur++];
      await one(qi);
      done++; if (onTick) onTick(done, jobs.length);
    }
  }));
  return { xong: done, doi };
}

async function _t7AiCritic(cat){
  const live = _t7AiQ.map((q, i) => ({ q, i })).filter(x => !x.q.drop && x.q.kind !== 'tr');
  if (live.length < 4) return 0;
  const list = live.map((x, k) => {
    if (x.q.custom && x.q.custom.length){
      const t = (x.q.custom.find(L => L.type === 'text') || {}).text || '';
      return `${k}. ${x.q.name} · tự thiết kế (${x.q.custom.length} lớp) · "${String(t).slice(0, 40)}"`;
    }
    const tk = _t7TplTextKey(cat, x.q.picks[0].template);
    return `${k}. ${x.q.name} · ${x.q.picks.map(p => p.template).join('+')} · "${String((tk && x.q.picks[0][tk]) || '').slice(0, 40)}"`;
  }).join('\n');
  const prompt = `This is the ENTIRE graphics plan of a video. Review it like a demanding editor.

Point out ONLY the items that should be DROPPED because: they duplicate the adjacent item, repeat the same text, put text on a scene that doesn't deserve it, or a whole cluster is too dense and clutters the video.
Do not drop more than 20% of the items. If the plan is already fine, return an empty array.

PLAN:
${list}

Return JSON: [{"k":3,"why":"short Vietnamese reason, under 15 words"}]`;
  let arr = [];
  try { arr = await callLLMJson(prompt, { maxTokens: 900, validate: (d) => Array.isArray(d) }); }
  catch (e){ return 0; }
  let n = 0;
  const tran = Math.ceil(live.length * 0.2);
  arr.slice(0, tran).forEach(r => {
    const k = Number(r && r.k); const x = live[Number.isFinite(k) ? k : -1]; if (!x) return;
    x.q.drop = 'Tự kiểm loại: ' + (String(r.why || '').slice(0, 70) || 'trùng ý với cảnh bên cạnh'); n++;
  });
  return n;
}

function _t7RemotionFrame(){ return document.getElementById('t7RemotionFrame'); }

function _t7NovaSig(){
  const specs = state.sceneSpecs || {};
  return _t7Clips().map(c => c.sceneId + ':' + _t7ClipDur(c).toFixed(2) + ':' + (c.fx || 'none') + ':' + (c.trans || 'none') + ':' + ((specs[c.sceneId] && specs[c.sceneId].rev) || 0)).join('|');
}

async function _t7NovaLoad(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  if (!win || typeof win.remotion_setBundleMode !== 'function') return false;
  const scenes = await _t7NovaScenes({ inline:false });
  if (!scenes.length){ setStatus7('Chưa có cảnh nào để dựng.', 'error'); return false; }
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  const durationInFrames = Math.max(1, Math.round(totalSec * T7_NOVA.fps));
  const props = JSON.stringify({ scenes });
  win.remotion_setBundleMode({
    type: 'composition',
    compositionName: T7_NOVA.comp,
    serializedResolvedPropsWithSchema: props,
    serializedDefaultPropsWithCustomSchema: props,
    compositionDurationInFrames: durationInFrames,
    compositionFps: T7_NOVA.fps,
    compositionWidth: T7_NOVA.width,
    compositionHeight: T7_NOVA.height,
    compositionDefaultCodec: 'h264',
    compositionDefaultOutName: null,
    compositionDefaultVideoImageFormat: null,
    compositionDefaultPixelFormat: null,
    compositionDefaultProResProfile: null,
  });
  _t7RmState.sig = _t7NovaSig();
  _t7RmState.frame = -1;
  return true;
}

function _t7RemotionFit(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  const host = document.getElementById('t7PreviewWrap');
  if (!fr || !win || !host) return;
  const canvas = win.document.getElementById('remotion-canvas');
  if (!canvas) return;
  const r = host.getBoundingClientRect();
  const s = Math.min(r.width / T7_NOVA.width, r.height / T7_NOVA.height) || 1;
  canvas.style.transform = 'scale(' + s + ')';
  canvas.style.transformOrigin = 'top left';
  const body = win.document.body;
  if (body){ body.style.margin = '0'; body.style.background = '#000'; body.style.overflow = 'hidden'; }
  const vc = win.document.getElementById('video-container');
  if (vc){
    vc.style.position = 'absolute';
    vc.style.left = Math.max(0, (r.width - T7_NOVA.width * s) / 2) + 'px';
    vc.style.top = Math.max(0, (r.height - T7_NOVA.height * s) / 2) + 'px';
  }
}

function _t7UpdateOverlay(){
  const el = document.getElementById('t7OverlayImg'); if (!el) return;
  const o = _t7OverlayAt(t7State.playT);
  if (o){ if (el.getAttribute('data-oid') !== o.id){ el.src = o.dataUrl; el.setAttribute('data-oid', o.id); } el.style.display = ''; }
  else { el.style.display = 'none'; el.removeAttribute('data-oid'); }
}

async function _t7DrawGfx(){
  const box = document.getElementById('t7GfxOv'); if (!box) return;
  if (!window.native || typeof window.native.previewLayers !== 'function'){ box.innerHTML = ''; return; }
  const at = _t7ClipAt(t7State.playT);
  const c = (at && at.clip) || t7State.clips.find(x => x.id === t7State.selClip);
  // Đang bấm thử một đề xuất → vẽ lớp TẠM của nó, không đụng state.sceneSpecs.
  const sp = (c && _t7AiTry && _t7AiTry.sceneId === c.sceneId) ? _t7AiTry.spec
           : (c && (state.sceneSpecs || {})[c.sceneId]);
  if (!c || !sp){ box.innerHTML = ''; _t7OvKey = ''; return; }
  // _t7ClipAt chỉ trả {clip,index} — tự tính giây TRONG cảnh, không thì lớp luôn đứng ở giây 0.
  let _t0 = 0; for (const x of t7State.clips){ if (x.id === c.id) break; _t0 += _t7ClipDur(x); }
  const tIn = Math.max(0, Math.min(_t7ClipDur(c), (t7State.playT || 0) - _t0));
  // Chỉ gọi lại khi đổi cảnh / đổi spec / nhích quá 0.1s — tránh gọi IPC mỗi khung.
  const key = c.sceneId + ':' + (sp.rev || 0) + ':' + (_t7AiTry ? 'thu' : '') + ':' + tIn.toFixed(1);
  if (key === _t7OvKey || _t7OvBusy) return;
  _t7OvBusy = true;
  try {
    // Gửi kèm ảnh cảnh để main thay chỗ giữ '@scene' — không thì xem trước cố tải ảnh tên "@scene".
    let sceneSrc = '';
    try { const im = _t7ClipImg(c); if (im) sceneSrc = await _t7AssetUrl(im); } catch (e) {}
    const r = await window.native.previewLayers({ spec: Object.assign({}, sp, { durationSec: _t7ClipDur(c) }), t: tIn, sceneSrc });
    _t7OvKey = key;
    if (!r || !r.ok){ box.innerHTML = ''; return; }
    box.innerHTML = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e){ box.innerHTML = ''; }
  finally { _t7OvBusy = false; }
  _t7DrawGlob();
}

async function _t7DrawGlob(){
  const box = document.getElementById('t7GlobOv'); if (!box) return;
  const gs = _t7Globs().filter(g => {
    const st = Number(g.start) || 0;
    return t7State.playT >= st && t7State.playT <= st + (Number(g.dur) || 3);
  });
  if (!gs.length){ box.innerHTML = ''; _t7GlobKey = ''; return; }
  const key = gs.map(g => g.id).join(',') + ':' + t7State.playT.toFixed(1);
  if (key === _t7GlobKey) return;
  _t7GlobKey = key;
  const out = [];
  for (const g of gs){
    try {
      const r = await window.native.previewLayers({
        spec: { durationSec: Number(g.dur) || 3, theme: g.theme || {}, layers: [g.layer] },
        t: t7State.playT - (Number(g.start) || 0),
      });
      if (r && r.ok) out.push(...(r.items || []));
    } catch (e) {}
  }
  box.innerHTML = out.map(_t7LayerHtml).join('');
}

function _t7FileUrl(src){
  const s = String(src || '');
  if (!s || /^(https?:|data:|blob:|file:|assets\/)/i.test(s)) return s;
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('/')){
    const i = s.indexOf('#'); const frag = i >= 0 ? s.slice(i) : '';
    const pth = (i >= 0 ? s.slice(0, i) : s).replace(/\\/g, '/');
    return '/local-media?p=' + encodeURIComponent(pth) + frag;
  }
  return s;
}

function _t7LayerHtml(L){
  const w = Object.entries(L.wrap).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';');
  const cs = L.css ? Object.entries(L.css).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') : '';
  if (L.kind === 'text'){
    const inner = L.chars
      ? L.chars.map(ch => `<span style="display:inline-block;white-space:pre;opacity:${ch.opacity};transform:${ch.transform}">${escapeHtml(ch.ch === ' ' ? '\u00a0' : ch.ch)}</span>`).join('')
      : escapeHtml(L.text);
    return `<div style="${w}"><div style="${cs};text-align:${L.align}">${inner}</div></div>`;
  }
  if (L.kind === 'shape') return `<div style="${w}"><div style="${cs}"></div></div>`;
  if (L.kind === 'media' && L.src){
    // Video: tua tới đúng giây bằng mảnh #t= để khung xem trước khớp playhead.
    if (L.isVideo) return `<div style="${w}"><video src="${_t7FileUrl(L.src)}${/#/.test(L.src)?'':'#t='+(L.vt||0).toFixed(2)}" style="${cs}" muted playsinline preload="metadata"></video></div>`;
    return `<div style="${w}"><img src="${_t7FileUrl(L.src)}" style="${cs}"></div>`;
  }
  if (L.kind === 'bit') return `<div style="${w}"><div style="width:100%;height:100%;border:0.3cqh dashed rgba(255,255,255,.5);border-radius:1cqh;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:2cqh">✨ ${escapeHtml(L.name)}</div></div>`;
  // FX phủ toàn khung: main đã tính sẵn từng mảnh (effects.js) — chỉ dựng <div>.
  if (L.kind === 'fx'){
    const ps = (L.pieces || []).map(p => '<div style="' + Object.entries(p).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') + '"></div>').join('');
    return `<div style="${w}">${ps}</div>`;
  }
  return '';
}

function _t7PreviewFx(effect, i, p){
  let e = effect; if (e === 'random') e = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'][i % 4];
  if (e === 'zoom-in') return `scale(${(1 + 0.15 * p).toFixed(4)})`;
  if (e === 'zoom-out') return `scale(${(1.15 - 0.15 * p).toFixed(4)})`;
  if (e === 'pan-left') return `scale(1.08) translateX(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-right') return `scale(1.08) translateX(${(-4 + 8 * p).toFixed(3)}%)`;
  if (e === 'pan-up') return `scale(1.08) translateY(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-down') return `scale(1.08) translateY(${(-4 + 8 * p).toFixed(3)}%)`;
  return 'none';
}

function _t7UpdatePreviewFx(){
  // Bật xem trước Remotion → engine thật vẽ khung, bỏ qua hẳn nhánh mô phỏng CSS bên dưới.
  if (typeof _t7RmState === 'object' && _t7RmState.on){ t7RemotionSeek(t7State.playT); return; }
  const el = document.getElementById('t7PreviewImg'); if (!el) return;
  const at = _t7ClipAt(t7State.playT); if (!at){ el.style.transform = 'none'; return; }
  const sc = (at.clip.scale && at.clip.scale !== 1) ? at.clip.scale : 1;   // 🔍 tỉ lệ ảnh người dùng đặt
  const effect = at.clip.fx || 'none';
  if (effect === 'none'){ el.style.transform = (sc !== 1) ? ('scale(' + sc + ')') : 'none'; return; }
  const start = _t7ClipStart(at.index); const p = Math.max(0, Math.min(1, (t7State.playT - start) / _t7ClipDur(at.clip)));
  const fx = _t7PreviewFx(effect, at.index, p);
  el.style.transform = (sc !== 1) ? ('scale(' + sc + ')' + (fx && fx !== 'none' ? ' ' + fx : '')) : fx;   // kết hợp scale + Ken Burns
}

function _t7WaveSvg(peaks, colorVar){
  if (!peaks || !peaks.length) return '';
  const n = peaks.length, H = 38, mid = H / 2;
  let rects = '';
  for (let i = 0; i < n; i++){ const a = Math.max(0.6, peaks[i] * mid * 0.9); rects += `<rect x="${i}" y="${(mid - a).toFixed(1)}" width="0.7" height="${(a * 2).toFixed(1)}"/>`; }
  return `<svg viewBox="0 0 ${n} ${H}" preserveAspectRatio="none" width="100%" height="${H}" style="display:block;opacity:.6" fill="${colorVar}">${rects}</svg>`;
}

function _t7ApplyThumb(el){
  const c = t7State.clips.find(x => x.id === el.getAttribute('data-cid'));
  const img = c ? _t7ThumbImg(c) : null; if (!img) return;
  if (el.tagName === 'IMG') el.src = img; else el.style.backgroundImage = `url('${img}')`;
}

function _t7LazyThumbs(container, sel, root){
  try {
    const nodes = container.querySelectorAll(sel);
    if (typeof IntersectionObserver !== 'function'){ nodes.forEach(_t7ApplyThumb); return; }   // fallback
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries){ if (e.isIntersecting){ _t7ApplyThumb(e.target); obs.unobserve(e.target); } }
    }, { root: root || null, rootMargin: '600px' });   // nạp trước 600px để cuộn không thấy trống
    nodes.forEach(el => obs.observe(el));
    _t7ThumbObs.push(obs); while (_t7ThumbObs.length > 6){ try { _t7ThumbObs.shift().disconnect(); } catch (e) {} }
  } catch (e) { /* bỏ qua: giữ nền xám */ }
}

function _t7OverlayAt(t){ for (const o of (t7State.overlays || [])){ const s = o.start || 0; if (t >= s && t < s + (o.dur || 3)) return o; } return null; }

async function _t7SfxDoc(id){
  const x = (_t7SfxCache || []).find(i => i.id === id);
  if (!x) return null;
  let d = _t7SfxAudioCache.get(id);
  if (d === undefined){
    try { const b = await window.native.readFileB64(x.path); d = (b && b.dataUrl) || null; }
    catch (_){ d = null; }
    if (d){
      _t7SfxAudioCache.set(id, d);
      while (_t7SfxAudioCache.size > 24) _t7SfxAudioCache.delete(_t7SfxAudioCache.keys().next().value);
    } else {
      _t7SfxAudioCache.set(id, null);   // nhớ cả lỗi để bấm lại không đọc đĩa thêm lần nữa
    }
  }
  return d;
}

function _t7LiveResizeClip(id){
  const clips = _t7Clips(); const c = clips.find(x => x.id === id); if (!c) return;
  const pps = t7State.pps || 8; const w = Math.max(2, _t7ClipDur(c) * pps) + 'px';
  const idx = clips.findIndex(x => x.id === id);
  const el = document.querySelector('#t7TrkScenes .t7-clip[data-cid="' + id + '"]');
  if (el){ el.style.width = w; const lab = el.querySelector('.t7-cliplab'); if (lab) lab.textContent = _t7ClipDur(c).toFixed(1) + 's'; }
  const subs = document.querySelectorAll('#t7TrkSubs .t7-sub'); if (subs && subs[idx]) subs[idx].style.width = w;
  t7UpdatePlayhead();
}

function _t7TimelineRaf(){ if (_t7TlRaf) return; _t7TlRaf = requestAnimationFrame(() => { _t7TlRaf = 0; t7RenderTimeline(); }); }

async function _t7DecodePeaks(file, buckets){
  buckets = buckets || 600;
  try {
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ab = await ctx.decodeAudioData(buf);
    const ch = ab.getChannelData(0);
    const block = Math.max(1, Math.floor(ch.length / buckets));
    const peaks = new Float32Array(buckets); let max = 1e-6;
    for (let i = 0; i < buckets; i++){ let p = 0; const s = i * block, e = Math.min(ch.length, s + block); for (let j = s; j < e; j++){ const v = Math.abs(ch[j]); if (v > p) p = v; } peaks[i] = p; if (p > max) max = p; }
    for (let i = 0; i < buckets; i++) peaks[i] /= max;
    try { ctx.close(); } catch (e) {}
    return { peaks, duration: ab.duration };
  } catch (e){ return null; }
}

function _t7DurVi(s){ s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? h + ' giờ ' : '') + (m || h ? m + ' phút ' : '') + sec + ' giây'; }

function _t7ExpModalHide(){ const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'none'; }

function _t7ExpModalShow(info){
  info = info || {};
  const m = document.getElementById('t7ExpModal'); if (!m) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpModalTitle', 'Xuất video · ' + (info.name || ''));
  set('t7ExpState', 'Đang xuất');
  const th = document.getElementById('t7ExpThumb'); if (th) th.src = info.thumb || '';
  const rows = [['Tên video', info.name || '—'], ['Thời lượng', info.dur || '—'], ['Kích cỡ', info.size || '—'], ['Độ phân giải', info.res || '—'], ['Codec', info.codec || 'H.264'], ['Định dạng', 'mp4'], ['Không gian màu', 'Rec. 709 SDR'], ['Tỷ lệ khung hình', (info.fps || 30) + 'fps']];
  const box = document.getElementById('t7ExpInfo'); if (box) box.innerHTML = rows.map(([k, v]) => `<div style="color:var(--text-muted)">${k}</div><div style="font-weight:600">${escapeHtml(String(v))}</div>`).join('');
  set('t7ExpPct', '0%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '0%'; set('t7ExpElapsed', '⏱ 00:00');
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = ''; if (cl) cl.style.display = 'none';
  t7State._expT0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  m.style.display = 'flex';
}

function _t7ExpModalDone(ok, msg){
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpState', ok ? '✓ Đã xuất xong' : '❌ ' + (msg || 'Lỗi xuất'));
  if (ok){ set('t7ExpPct', '100%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '100%'; }
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = 'none'; if (cl) cl.style.display = '';
}

function _t7ExpDims(){
  const asp = document.getElementById('t7Aspect')?.value || '16:9';
  const r = parseInt(document.getElementById('t7ExpRes')?.value) || 1080;   // cạnh ngắn
  if (asp === '9:16') return [r, Math.round(r * 16 / 9)];
  if (asp === '1:1') return [r, r];
  return [Math.round(r * 16 / 9), r];
}

function _t7RecBitrateK(W, H, fps){
  const px = W * H;
  let b;
  if (H <= 720) b = 5000; else if (H <= 1080) b = 8000; else if (H <= 1440) b = 16000; else b = 40000;
  const ref = (H <= 720) ? 1280 * 720 : (H <= 1080) ? 1920 * 1080 : (H <= 1440) ? 2560 * 1440 : 3840 * 2160;
  b = b * (px / ref);
  if (fps >= 48) b *= 1.5;
  return Math.round(b);
}

function _t7ExpBitrateK(){
  const [W, H] = _t7ExpDims();
  const fps = parseInt(document.getElementById('t7ExpFps')?.value) || 30;
  const rec = _t7RecBitrateK(W, H, fps);
  const mode = document.getElementById('t7ExpBitrate')?.value || 'auto';
  const mult = mode === 'high' ? 1.6 : mode === 'low' ? 0.55 : 1.0;
  let b = Math.round(rec * mult);
  if (document.getElementById('t7ExpCodec')?.value === 'h265') b = Math.round(b * 0.65);   // HEVC nhẹ hơn ~35%
  return b;
}

async function _t7ShowGpuRow(){
  const row = document.getElementById('t7ExpGpuRow'); if (!row) return;
  if (_t7Gpu === null && window.native && typeof window.native.ffmpegInfo === 'function'){
    try { _t7Gpu = await window.native.ffmpegInfo(); } catch (_) { _t7Gpu = {}; }
  }
  const g = _t7Gpu || {};
  row.style.display = g.gpu ? 'flex' : 'none';
  const lab = document.getElementById('t7ExpGpuLab');
  if (lab && g.gpu) lab.textContent = `⚡ Tăng tốc GPU (${g.gpuLabel} — xuất nhanh hơn nhiều, nhất là 4K)`;
}

function _t7SrtTime(sec){ sec = Math.max(0, sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = Math.floor(sec%60), ms = Math.round((sec - Math.floor(sec))*1000); return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms).padStart(3,'0'); }

function _t7BuildSrt(clips){
  const out = []; let n = 1, t = 0;
  for (const c of clips){ const dur = _t7ClipDur(c); const txt = c.imported ? '' : (_t7ClipText(c) || '').replace(/\s+/g,' ').trim(); if (txt){ out.push(n + '\n' + _t7SrtTime(t) + ' --> ' + _t7SrtTime(t + dur) + '\n' + txt); n++; } t += dur; }   // clip nhập (media) không lấy tên file làm phụ đề
  return out.join('\n\n');
}

function _t7SubStyle(H){
  const fs = Math.max(16, Math.round((H || 1080) / 45)); const mv = Math.round((H || 1080) * 0.045);
  const base = `Fontname=Arial,Fontsize=${fs},Bold=1,Alignment=2,MarginV=${mv}`;
  const S = {
    vien:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1`,
    nova:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H66000000,BorderStyle=3,Outline=6,Shadow=0`,
    cam:     `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H000C41C2,BackColour=&H400C41C2,BorderStyle=3,Outline=6,Shadow=0`,
    vang:    `${base},PrimaryColour=&H0000E0FF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1`,
    toigian: `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=0,Shadow=2`,
  };
  return S[state.t7SubStyle || 'vien'] || S.vien;
}

async function _t7StockFillUrls(c, sceneDur, vd){
  if (!c || c.imported) return [];
  const pk = state.mediaPicks?.[c.sceneId];
  if (!pk || pk.kind !== 'video') return [];
  if (!(vd > 0.1) || vd >= sceneDur - 0.05) return [];
  const cands = (state.stockCandidates || {})[c.sceneId] || [];
  const others = cands.filter(x => x && x.kind === 'video' && x.downloadUrl && x.downloadUrl !== pk.downloadUrl);
  const out = []; let need = sceneDur - vd;
  for (const o of others){
    if (need <= 0.05) break;
    try { let u = o.downloadUrl; if (/^https?:/.test(u)) u = await _t7UrlToDataUrl(u); out.push(u); need -= Math.max(1, Number(o.duration) || 2); }
    catch (e){ /* bỏ ứng viên tải lỗi */ }
  }
  return out;
}

function _renumberVideos(p){
  if (!p || !Array.isArray(p.videos)) return;
  let n = 0;
  for (const v of p.videos){ n++; if (/^Video \d+$/.test(String(v.name || ''))) v.name = 'Video ' + n; }
}

async function newVideo(){
  const p = getProfile();
  if (!p){ newProfile(); return; }
  _ensureVideos(p);
  // Lưu video hiện tại trước (workData + ảnh IDB).
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}
  // Thêm video mới + chuyển sang. Đặt tên theo vị trí rồi renumber → số thứ tự luôn 1,2,3… (xoá xong về đúng số).
  const v = makeEmptyVideo('Video ' + ((p.videos || []).length + 1));
  p.videos.push(v);
  _renumberVideos(p);
  p.currentVideoId = v.id;
  loadStateFromProfile(p);                 // workData rỗng của video mới
  // Nhân vật/bối cảnh + ảnh của chúng dùng CHUNG profile → giữ; cảnh/ảnh cảnh/video rỗng.
  try { await loadProfileImages(p.profileId, v.id); } catch (e) {}
  // Reset dữ liệu tạm Tool 7/8.
  try { if (typeof t7State === 'object' && t7State) { t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.audioFile = null; t7State.audioPeaks = null; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  try { if (typeof t8State === 'object' && t8State) { t8State.audioFile = null; t8State.alignResults = null; } } catch (e) {}
  try { _t2ResetTimingAudio(); } catch (e) {}   // xoá MP3 căn timing của video cũ
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
  if (typeof setStatus1 === 'function') setStatus1('✓ Đã tạo "' + v.name + '" — trắng tinh, dùng chung style + nhân vật/bối cảnh của kênh. Bắt đầu ở Phân Cảnh.', 'ok');
}

async function switchVideo(id){
  const p = getProfile();
  if (!p || !id) return;
  _ensureVideos(p);
  if (id === p.currentVideoId) return;
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}   // lưu ảnh video hiện tại theo id cũ
  p.currentVideoId = id;
  // 🧹 Reset dữ liệu TẠM Dựng Video (overlay/media/clip/undo/nhạc nền) → KHÔNG rò rỉ sang video khác; workData video mới sẽ nạp lại.
  try { if (typeof t7State === 'object' && t7State){ t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  await mergeLocalWorkData(p, id);   // nạp kịch bản/cảnh local (IDB) của video mới trước khi đổ ra state
  loadStateFromProfile(p);
  try { await loadProfileImages(p.profileId, id); } catch (e) {}   // loadProfileImages tự nạp/xoá MP3 giọng đọc riêng của video này
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
}

function _askText(title, defVal){
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
    ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;width:min(400px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="font-size:15px;font-weight:700;margin-bottom:12px">${escapeHtml(title || 'Nhập')}</div>
      <input type="text" id="_askInput" style="width:100%">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn ghost sm" id="_askCancel">Huỷ</button>
        <button class="btn primary sm" id="_askOk">OK</button>
      </div></div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('#_askInput'); inp.value = defVal || '';
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector('#_askOk').onclick = () => done(inp.value);
    ov.querySelector('#_askCancel').onclick = () => done(null);
    ov.onclick = (e) => { if (e.target === ov) done(null); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value); else if (e.key === 'Escape') done(null); };
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

async function renameVideo(){
  const p = getProfile(); if (!p) return;
  const v = getCurrentVideo(p); if (!v) return;
  const name = await _askText('Đổi tên video', v.name || 'Video');
  if (name == null) return;
  v.name = (name.trim() || v.name);
  renderVideoSelect();
  saveState(true);
}

function renderVideoSelect(){
  const sel = document.getElementById('videoSelect');
  if (!sel) return;
  const p = getProfile();
  if (!p){ sel.innerHTML = '<option>—</option>'; sel.disabled = true; return; }
  _ensureVideos(p);
  sel.disabled = false;
  sel.innerHTML = p.videos.map(v => `<option value="${v.id}" ${v.id === p.currentVideoId ? 'selected' : ''}>🎬 ${escapeHtml(v.name || 'Video')}</option>`).join('');
}

function openVideoManager(){
  const p = getProfile(); if (!p){ alert('Chưa có profile.'); return; }
  _ensureVideos(p);
  closeVideoManager();
  const ov = document.createElement('div');
  ov.id = 'videoMgrModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
  const rows = p.videos.map(v => {
    const wd = v.workData || {};
    const thumb = wd.thumbUrl
      ? `<img src="${wd.thumbUrl}" style="width:54px;height:31px;object-fit:cover;border-radius:5px;border:1px solid var(--border);flex:none">`
      : `<span style="width:54px;height:31px;border-radius:5px;background:var(--surface-3);display:grid;place-items:center;flex:none;font-size:14px">🎬</span>`;
    const path = wd.exportPath ? `<div style="font-size:10.5px;color:var(--text-dim);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(wd.exportPath)}">📄 ${escapeHtml(wd.exportPath)}</div>` : '';
    return `<div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:${v.id === p.currentVideoId ? 'var(--surface-2)' : 'transparent'}">
      <input type="checkbox" class="_vmChk" value="${v.id}" style="width:16px;height:16px;flex:none">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(v.name || 'Video')}${v.id === p.currentVideoId ? ' <span style="color:var(--accent);font-size:11px;font-weight:700">• đang mở</span>' : ''}</div>
        ${path}
      </div>
      <button class="btn ghost sm" onclick="switchVideo('${v.id}');closeVideoManager()">Mở</button>
    </div>`;
  }).join('');
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;width:min(520px,94vw);max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:17px;font-weight:800">Quản lý Video — ${escapeHtml(p.tenKenh || 'Kênh')}</div>
      <button class="btn ghost sm" onclick="closeVideoManager()">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px">
      <label style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px"><input type="checkbox" id="_vmAll" onclick="document.querySelectorAll('._vmChk').forEach(c=>c.checked=this.checked)" style="width:15px;height:15px"> Chọn tất cả</label>
      <button class="btn" style="border-color:var(--red);color:var(--red)" onclick="deleteSelectedVideos()">🗑 Xóa video đã chọn</button>
    </div>
  </div>`;
  ov.onclick = (e) => { if (e.target === ov) closeVideoManager(); };
  document.body.appendChild(ov);
}

function closeVideoManager(){ const m = document.getElementById('videoMgrModal'); if (m) m.remove(); }

async function deleteSelectedVideos(){
  const p = getProfile(); if (!p) return; _ensureVideos(p);
  const ids = [...document.querySelectorAll('._vmChk:checked')].map(c => c.value);
  if (!ids.length){ alert('Chưa tích video nào để xóa.'); return; }
  if (ids.length >= p.videos.length){ alert('Không thể xóa hết — profile phải còn ít nhất 1 video.'); return; }
  if (!confirm('Xóa ' + ids.length + ' video đã chọn?\nKịch bản/cảnh/ảnh/video của chúng sẽ mất. Style + thông tin kênh vẫn giữ.')) return;
  const uid = window.currentUser?.uid;
  for (const id of ids){
    if (uid && p.profileId){ const b = uid + '/' + p.profileId + '/' + id + '/'; for (const k of ['styleRefImages','characterImages','backgroundImages','sceneImages','sceneImagesB','sceneVideoBlobs','sceneVideosMeta','motionPrompts','voiceMp3']){ try { await IDB.set(b + k, null); } catch (e) {} } }
  }
  const del = new Set(ids);
  const curDeleted = del.has(p.currentVideoId);
  p.videos = p.videos.filter(v => !del.has(v.id));
  // Đồng bộ hàng đợi: bỏ các job trỏ tới video vừa xoá.
  try {
    if (typeof _prodQueue !== 'undefined' && _prodQueue.length) {
      const before = _prodQueue.length;
      _prodQueue.forEach(j => { if (del.has(j.videoId)) { try { IDB.del('qs_' + j.id); } catch (e) {} if (typeof _queueVoice === 'object') delete _queueVoice[j.id]; } });
      _prodQueue = _prodQueue.filter(j => !del.has(j.videoId));
      if (_prodQueue.length !== before) { if (typeof queueSave === 'function') queueSave(); if (typeof queueRender === 'function') queueRender(); }
    }
  } catch (e) {}
  if (curDeleted){
    p.currentVideoId = p.videos[0].id;
    loadStateFromProfile(p);
    try { await loadProfileImages(p.profileId, p.currentVideoId); } catch (e) {}
    rerenderAllAfterProfileLoad();
  }
  renderVideoSelect(); renderProfileStyles(); closeVideoManager();
  saveState(true);
}

function clearAllT3(){
  if (!confirm('Xoá HẾT prompt asset của profile hiện tại (nhân vật + bối cảnh + style reference + ảnh nhân vật)?\n\nStyle Prompts (Character Style, Background Style...) KHÔNG bị xoá — chúng là của Profile.')) return;
  state.assetCharPrompts = {};
  state.assetBgPrompts = {};
  state.styleRefPrompt = '';
  state.characterImages = {};
  syncStateToCurrentProfile();
  rerenderAllAfterProfileLoad();
  saveState(true);
  setStatus3('✓ Đã xoá hết prompt asset + ảnh ref của profile hiện tại.', 'ok');
}

function clearAllT5(){
  if (!confirm('Xoá HẾT kết quả tìm media + lựa chọn của profile hiện tại?')) return;
  state.pexelsResults = {};
  state.mediaPicks = {};
  _t5Results = {};
  document.querySelectorAll('[id^="media-results-"]').forEach(el => el.innerHTML = '');
  const sp = document.getElementById('searchProgress'); if (sp) sp.textContent = '';
  updatePickCount();
  syncStateToCurrentProfile();
  saveState(true);
  setStatus5('✓ Đã xoá hết kết quả tìm media + lựa chọn của profile hiện tại.', 'ok');
}

function parseSRT(text){
  const cues = [];
  const t2s = t => {
    // 00:01:23,456 hoặc 00:01:23.456 hoặc 01:23.456
    const m = t.trim().match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    const h = +(m[1] || 0), mi = +m[2], s = +m[3], ms = +m[4];
    return h * 3600 + mi * 60 + s + ms / 1000;
  };
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const line = b.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/);
    if (!line) continue;
    const start = t2s(line[1]), end = t2s(line[2]);
    if (start == null || end == null) continue;
    // text = các dòng sau dòng timestamp (bỏ số thứ tự + dòng time)
    const lines = b.split('\n');
    const tIdx = lines.findIndex(l => l.includes('-->'));
    const txt = lines.slice(tIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    cues.push({ start, end, text: txt });
  }
  return cues;
}

async function _t8TranscribeBlob(prov, blob, filename){
  const cfg = T8_PROVIDERS[prov];
  const key = t8GetKey(prov) || document.getElementById('t8ApiKey').value.trim();
  if (!key) throw new Error(`Chưa có ${cfg.name} key. Nhập + Lưu key trước.`);
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const model = t8PickModel(prov, lang);
  const form = new FormData();
  form.append('file', blob, filename || 'audio.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  if (lang) form.append('language', lang);
  const r = await fetch(cfg.url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: form });
  if (!r.ok) { const txt = await r.text(); throw new Error(`${cfg.name} HTTP ${r.status}: ${txt.slice(0, 200)}`); }
  const data = await r.json();
  if (data.words && data.words.length) return data.words.map(w => ({ word: w.word, start: w.start, end: w.end }));
  if (data.segments && data.segments.length) {
    const words = [];
    for (const seg of data.segments) {
      const sw = (seg.text || '').trim().split(/\s+/).filter(Boolean);
      const per = (seg.end - seg.start) / (sw.length || 1);
      sw.forEach((w, i) => words.push({ word: w, start: seg.start + i * per, end: seg.start + (i + 1) * per }));
    }
    return words;
  }
  throw new Error('Không có word/segment timestamps trong response.');
}

async function _decodeToMono16k(file){
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let decoded;
  try { decoded = await ac.decodeAudioData(buf.slice(0)); } finally { try { ac.close(); } catch (_) {} }
  const RATE = 16000;
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new Off(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);   // Float32Array @16kHz mono
}

function _pcmToWav(float32, rate){
  const len = float32.length;
  const ab = new ArrayBuffer(44 + len * 2);
  const v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, len * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) { let s = Math.max(-1, Math.min(1, float32[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

function groupWordsIntoLines(words, maxSec){
  const lines = [];
  let buf = [], start = null;
  for (const w of words) {
    if (start == null) start = w.start;
    buf.push(w.word);
    const dur = w.end - start;
    const endsSentence = /[.!?]$/.test(w.word.trim());
    // Cắt dòng khi: đủ thời gian, hoặc kết câu mà đã đủ ~2s
    if (dur >= maxSec || (endsSentence && dur >= maxSec * 0.5)) {
      lines.push({ start, end: w.end, text: buf.join(' ').replace(/\s+/g, ' ').trim() });
      buf = []; start = null;
    }
  }
  if (buf.length) {
    const last = words[words.length - 1];
    lines.push({ start, end: last.end, text: buf.join(' ').replace(/\s+/g, ' ').trim() });
  }
  return lines;
}

function _t9SnapChapters(chapters){
  const sc = state.scenes || [];
  if (!sc.length || !Array.isArray(chapters) || !chapters.length) return { list: chapters || [], moved: 0, total: 0 };
  const starts = []; let acc = 0;
  for (const x of sc) { starts.push(acc); acc += (parseFloat(x.duration) || 0); }
  const total = acc;
  const toSec = (t) => { const p = String(t || '').split(':').map(n => parseInt(n) || 0); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0); };
  const fmt = (x) => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
  let moved = 0;
  const out = [];
  for (const c of chapters){
    const want = toSec(c && c.time);
    if (want > total - 5) continue;                                   // vượt quá video → bỏ
    let best = starts[0], d = Infinity;
    for (const st of starts){ const dd = Math.abs(st - want); if (dd < d){ d = dd; best = st; } }
    if (Math.round(best) !== Math.round(want)) moved++;
    out.push({ time: fmt(best), label: String((c && c.label) || '').trim(), _s: best });
  }
  out.sort((a, b) => a._s - b._s);
  const uniq = []; for (const c of out) if (!uniq.some(u => Math.abs(u._s - c._s) < 1)) uniq.push(c);
  if (uniq.length) { uniq[0].time = '0:00'; uniq[0]._s = 0; }         // YouTube bắt buộc chương đầu = 0:00
  return { list: uniq.map(({ time, label }) => ({ time, label })), moved, total };
}

function _t11KeyState(){
  const st = document.getElementById('t11KeyState'); if (!st) return;
  const k = (localStorage.getItem('yt_api_key') || '').trim();
  st.innerHTML = k ? '<span style="color:var(--green)">✓ Đã có key — bổ sung được like/comment/sub.</span>'
                   : '<span style="color:var(--text-muted)">Chưa có key — vẫn chạy được, chỉ thiếu like/comment/sub.</span>';
}

function _t11oNum(n){ n = Number(n)||0; return n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }

function _nfEsc(s){ return String(s==null?'':s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function _nfSet(id, html){ const el = document.getElementById(id); if (el) el.innerHTML = html; }

function _nfBadge(level){ const v = String(level||'').toLowerCase(); if (/cao|high/.test(v)) return '<span class="nf-badge nf-hi">'+_nfEsc(level)+'</span>'; if (/thấp|low/.test(v)) return '<span class="nf-badge nf-lo">'+_nfEsc(level)+'</span>'; return '<span class="nf-badge nf-mid">'+_nfEsc(level||'')+'</span>'; }

function _nfMeta(r){ return (r && r.enriched ? ' · 📊 có like/comment/sub' : ' · chỉ view (chưa có key YouTube API)') + (r && r.fromCache ? ' · ⚡cache' : ''); }

function nicheInit(){
  if (!window.native || !window.native.niche){ _nfSet('nfHotState', '⚠️ Chỉ chạy trong app Nova (desktop).'); }
  if (!_nfWired && window.native && typeof window.native.onNicheProgress === 'function'){
    _nfWired = true;
    window.native.onNicheProgress(s => { const m = NF_MAP[_nfActive]; if (m){ const el = document.getElementById(m.state); if (el) el.textContent = (s.percent||0)+'% — '+(s.message||''); } });
  }
  if (!document.querySelector('#tool-toolniche .nf-panel.active')) nfOpen('hot');
}

function nfOpen(mod){
  _nfActive = mod;
  document.querySelectorAll('#tool-toolniche .nf-tile').forEach(t => t.classList.toggle('active', t.id === 'nf-tile-' + mod));
  document.querySelectorAll('#tool-toolniche .nf-panel').forEach(p => p.classList.toggle('active', p.id === 'nf-panel-' + mod));
}

async function nfRun(mod, fresh){
  const m = NF_MAP[mod]; if (!m) return;
  if (!window.native || !window.native.niche){ document.getElementById(m.state).textContent = '⚠️ Chỉ chạy trong app Nova (desktop).'; return; }
  let payload = { fresh: !!fresh };
  const _gl = (document.getElementById('nfGl')?.value || '').trim();
  if (_gl) payload.gl = _gl;
  if (mod === 'bw'){
    payload.title = (document.getElementById('nfBwTitle')?.value || '').trim();
    payload.niche = (document.getElementById('nfBwNiche')?.value || '').trim();
    if (!payload.title){ document.getElementById(m.state).textContent = '⚠️ Nhập tiêu đề cần chấm.'; return; }
  } else if (m.key){                                   // ô nhận KÊNH thay vì từ khoá ngách
    const v = (document.getElementById(m.seed)?.value || '').trim();
    if (!v){ document.getElementById(m.state).textContent = '⚠️ Nhập kênh đối thủ (@handle hoặc link).'; return; }
    payload[m.key] = v;
  } else {
    const seed = (document.getElementById(m.seed)?.value || '').trim();
    payload.seed = seed;  // cho phép rỗng, backend sẽ dùng seed mặc định
  }
  const btn = document.getElementById(m.btn); if (btn) btn.disabled = true;
  document.getElementById(m.state).textContent = '⏳ Đang chạy…'; _nfSet(m.out, '');
  try {
    const r = await window.native.niche[m.fn](payload);
    if (!r || !r.ok){ document.getElementById(m.state).textContent = '❌ ' + ((r&&r.error)||'Lỗi'); return; }
    m.render(r);
    _nfLast[mod] = r;                    // giữ lại kết quả gần nhất cho nút 📋 copy
  } catch(e){ document.getElementById(m.state).textContent = '❌ ' + String(e).slice(0,150); }
  finally { if (btn) btn.disabled = false; }
}

function _nfHotCard(t){
  const ratio = Number(t.ratio) || 0, n = Number(t.count) || 0;
  const _i = _nfRegIdea({ topic: t.title || t.topic, angle: t.angle || '', src: 'Chủ đề Hot' });
  return `<div class="nf-card">
    <h5><span>🔥 ${_nfEsc(t.topic)}</span>${_nfBadge(t.heat)}</h5>
    <div class="tmet">
      ${ratio ? `<div>Bội số trung vị<b class="up">${ratio.toFixed(1)}×</b></div>` : ''}
      ${n ? `<div>Số video<b>${n}</b></div>` : ''}
    </div>
    <div class="nf-line"><b>Vì sao ăn:</b> ${_nfEsc(t.why)}</div>
    <div class="nf-line"><b>Góc làm:</b> ${_nfEsc(t.angle)}</div>
    ${t.title ? `<div class="nf-title-ex">🎬 ${_nfEsc(t.title)}</div>` : ''}
    <div style="margin-top:9px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div>
  </div>`;
}

function nfRenderHot(r){
  const fq = r.failedQueries || [];      // góc quét lỗi (trước đây bị nuốt ngầm)
  document.getElementById('nfHotState').textContent =
    `✅ Quét ${(r.queries||[]).length} góc · ${r.scanned||0} video · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r)
    + (fq.length ? ` · ⚠️ ${fq.length}/${(r.queries||[]).length} góc lỗi` : '');
  const items = r.items || [];
  const rising = items.filter(x => String(x.window||'').toLowerCase() === 'rising');
  const proven = items.filter(x => String(x.window||'').toLowerCase() !== 'rising');
  let h = '<div style="margin-bottom:10px">' + (r.queries||[]).map(q => `<span class="qchip">${_nfEsc(q)}</span>`).join('') + '</div>';
  if (rising.length) h += `<div class="win"><i class="r">ĐANG LÊN</i><em>đăng ≤ 30 ngày — còn chỗ chen vào</em><s></s></div>` + rising.map(_nfHotCard).join('');
  if (proven.length) h += `<div class="win"><i class="p">ĐÃ ĂN</i><em>30–180 ngày — chắc ăn nhưng đông người làm</em><s></s></div>` + proven.map(_nfHotCard).join('');
  _nfSet('nfHotOut', items.length ? h : '<div class="nf-state">Không có chủ đề nào vượt trung vị.</div>');
}

function _nfBar(pct, mark, cls){
  return `<div class="sc-bar"><i class="${cls||''}" style="width:${Math.max(2,Math.min(100,pct))}%"></i><u style="left:${Math.max(0,Math.min(99,mark))}%"></u></div>`;
}

function _nfMetricRows(m){
  if (!m) return '';
  const rows = [
    { n:'VPS · View/Sub', s:'View TB ÷ số sub', pct: Math.min(100, m.vps/3*100), mark: 33, cls: m.vps>=1?'g':(m.vps>=.5?'w':'r'),
      v: m.vps.toFixed(2)+'×', t: m.vps>=1?'tốt · ngưỡng 1,0':(m.vps>=.5?'tạm · ngưỡng 1,0':'thấp · tệp đã bão hoà') },
    { n:'VPH · Nhiệt hiện tại', s:'View/giờ, 5 video mới nhất', pct: Math.min(100, Math.log10(Math.max(1,m.vph))*25), mark: 40, cls:'',
      v: _t11oNum(m.vph), t: m.vph>=1000?'đang nóng':'nguội' },
    { n:'Tỉ lệ Longform', s:'Video ≥ 8 phút', pct: m.longform*100, mark: 30, cls: m.longform>=.5?'g':'w',
      v: Math.round(m.longform*100)+'%', t: m.longform>=.5?'hợp faceless':'nhiều video ngắn' },
    { n:'Độ ổn định', s:'Hệ số biến thiên (thấp = đều)', pct: Math.max(2,(1-Math.min(1.5,m.cv))/1.5*100), mark: 60, cls: m.cv<=.5?'g':(m.cv<=1?'w':'r'),
      v: m.cv.toFixed(2), t: m.cv<=.5?'đều đặn':(m.cv<=1?'hơi phập phù':'rất phập phù') },
    { n:'Xu hướng', s:'Độ dốc view theo thời gian', pct: Math.max(2,Math.min(100,50+m.trend*100)), mark: 50, cls: m.trend>0?'g':'r',
      v: (m.trend>0?'▲ +':'▼ ')+Math.round(m.trend*100)+'%', t: m.trend>0?'đang lên':'đang xuống' },
  ];
  return rows.map(r => `<div class="sc-metric">
      <div class="sc-n">${r.n}<small>${r.s}</small></div>
      ${_nfBar(r.pct, r.mark, r.cls)}
      <div class="sc-v">${r.v}<small>${r.t}</small></div>
    </div>`).join('');
}

function nfRenderScorecard(r){
  _nfScChannel = r.channel || '';
  document.getElementById('nfScState').textContent = `✅ Xong — ${r.videoCount} video · trung vị kênh ${_t11oNum(r.median||0)} view` + (r.fromCache?' · ⚡cache':'');
  const m = r.metrics || {};
  const ini = (r.channel||'?').replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || 'YT';
  let h = `<div class="nf-card">
    <div class="sc-head">
      <div class="sc-av">${_nfEsc(ini)}</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700">${_nfEsc(r.channel)} ${r.monetized?'<span class="nf-badge nf-hi">Đã bật kiếm tiền</span>':''}</div>
        <div class="nf-state" style="margin:2px 0 0">${_t11oNum(r.subs||0)} sub · quét ${r.videoCount} video gần nhất</div>
      </div>
      <div style="text-align:right"><div style="font-size:26px;font-weight:800;color:var(--accent);line-height:1">${r.health}</div><div style="font-size:11px;color:var(--text-muted)">điểm sức khoẻ</div></div>
    </div>
    ${_nfMetricRows(m)}
    ${r.analysis ? `<div class="nf-title-ex" style="margin-top:12px;white-space:pre-wrap">${_nfEsc(r.analysis)}</div>` : (r.analysisError ? `<div class="nf-state" style="margin-top:12px">⚠️ Phân tích AI lỗi: ${_nfEsc(r.analysisError)}</div>` : '')}
  </div>`;
  if ((r.outliers||[]).length){
    h += `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl">
      <tr><th>Video vượt trội</th><th class="n">View</th><th class="n">Bội số</th><th class="n">Dài</th><th class="n">Tuổi</th></tr>
      ${r.outliers.map(o => `<tr>
        <td><a href="${_nfEsc(o.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(o.title)}</a></td>
        <td class="n">${_nfEsc(o.viewsFmt)}</td>
        <td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td>
        <td class="n" style="color:var(--text-muted)">${Math.round((o.dur||0)/60)}p</td>
        <td class="n" style="color:var(--text-muted)">${o.days!=null?o.days+'n':'?'}</td></tr>`).join('')}
    </table></div>`;
  }
  _nfSet('nfScOut', h);
  _nfSet('nfSimOut', '');
  // Soi xong → tự điền kênh vừa so vào ô "Kênh giống" để chạy tiếp (không đè nếu người dùng đang nhập kênh khác).
  const simIn = document.getElementById('nfSimSeed');
  if (simIn && _nfScChannel && !(simIn.value || '').trim()) simIn.value = _nfScChannel;
}

function nfRenderSimilar(r){
  const fqS = r.failedQueries || [];
  document.getElementById('nfSimState').textContent = `✅ ${r.cards.length} kênh cùng tệp` + (fqS.length ? ` · ⚠️ ${fqS.length}/${(r.queries||[]).length} truy vấn lỗi` : '') + (r.fromCache ? ' · ⚡cache' : '');
  _nfSet('nfSimOut', `<div class="sim-grid" style="margin-top:10px">` + r.cards.map(c => {
    const m = c.metrics;
    const verdict = !m ? '' : (m.vps >= 2 ? '<b style="color:#5fbf7f">ngách vàng</b> — nhỏ mà kéo view ngoài tệp sub'
      : m.vps >= 1 ? 'còn chỗ, VPS trên ngưỡng'
      : '<b style="color:#e08a8a">tệp đã bão hoà</b> — né hướng này');
    const nm = c.url ? `<a href="${_nfEsc(c.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(c.channel)}</a>` : _nfEsc(c.channel);
    return `<div class="nf-card" style="margin:0">
      <div style="font-size:13px;font-weight:700">${nm}</div>
      <div class="nf-state" style="margin:2px 0 7px">${_nfEsc(c.subsFmt)} sub · trùng ${c.hits} truy vấn</div>
      ${m ? `<div><span class="chip">VPS ${m.vps}×</span><span class="chip">${Math.round(m.longform*100)}% dài</span><span class="chip">${m.trend>0?'▲ lên':'▼ xuống'}</span></div>
      <div class="nf-state" style="margin-top:6px">${verdict}</div>` : '<div class="nf-state">⚠️ Không đọc được chỉ số (kênh riêng tư hoặc bị chặn).</div>'}
    </div>`;
  }).join('') + '</div>');
}

function nfRenderBw(r){
  const d = r.result || {}, sc = Math.max(0, Math.min(100, Number(d.score)||0));
  const col = sc >= 71 ? 'var(--accent)' : sc >= 51 ? '#5fbf7f' : '#e08a8a';
  document.getElementById('nfBwState').textContent = `✅ Xong — ${r.chars} ký tự` + (d.layered ? ' · ý nhiều tầng' : '');
  const ladder = _NF_RUNGS.map(([lo,hi,txt]) => {
    const on = sc >= lo && sc <= hi;
    return `<div class="rung${on?' on':''}"><span class="rg">${lo}–${hi}</span><span class="rl"></span><span>${txt}${on?' ← <b>bạn ở đây</b>':''}</span></div>`;
  }).join('');
  const alts = (d.alts||[]).map(a => {
    const _i = _nfRegIdea({ topic: a.title, src: 'Chấm B&W' });
    return `<div class="alt"><span>${_nfEsc(a.title)}<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px">${_nfEsc(a.why||'')}</div></span>
    <span class="nf-badge ${(Number(a.score)||0)>=71?'nf-hi':'nf-mid'}">${Number(a.score)||0}</span>
    <button class="nf-btn ghost" style="padding:4px 10px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Dùng tiêu đề này làm chủ đề cho video mới">🎬</button></div>`;
  }).join('');
  _nfSet('nfBwOut', `<div class="nf-card">
      <div class="bw-gauge">
        <div class="bw-ring" style="background:conic-gradient(${col} 0 ${sc}%,rgba(255,255,255,.07) ${sc}% 100%)"><b>${sc}</b><small>B&amp;W</small></div>
        <div style="flex:1;min-width:240px">${ladder}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div class="pole"><b>Cực A tìm thấy</b>${d.poleA ? _nfEsc(d.poleA) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
        <div class="pole"><b>Cực B tìm thấy</b>${d.poleB ? _nfEsc(d.poleB) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
      </div>
      <div class="nf-state" style="margin-top:9px">${_nfEsc(d.verdict||'')}</div>
    </div>
    ${alts ? `<div class="nf-card"><h5 style="margin-bottom:8px">✍️ Viết lại theo cặp đối lập</h5>${alts}</div>` : ''}`);
}

function nfRenderAttention(r){
  document.getElementById('nfAttState').textContent =
    `✅ Xong — ${r.scanned||0} video, ${r.outliers||0} vượt trội · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r);
  const cards = (r.items||[]).map(t => {
    const bw = Number(t.bw)||0;
    const _i = _nfRegIdea({ topic: t.idea, angle: t.need || '', src: 'Thị trường Chú ý' });
    return `<div class="nf-card">
      <h5><span>🎯 ${_nfEsc(t.segment)}</span><span style="font-size:11.5px;font-weight:700;color:var(--accent);white-space:nowrap">🔥 ${t.fire||0} outlier</span></h5>
      <div class="nf-state" style="margin:0 0 5px">Nhu cầu: ${_nfEsc(t.demand||'')}${t.avgViews?` · view TB tệp ${_t11oNum(t.avgViews)}`:''}</div>
      <div class="nf-line"><b>Đang muốn:</b> ${_nfEsc(t.need)}</div>
      <div class="nf-title-ex">💡 ${_nfEsc(t.idea)} ${bw?`<span class="nf-badge ${bw>=71?'nf-hi':'nf-mid'}">B&amp;W ${bw}</span>`:''}
        ${t.poles?`<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Cặp đối lập: ${_nfEsc(t.poles)}</div>`:''}</div>
      ${(t.samples||[]).length?`<div class="nf-state" style="margin-top:7px">Dựa trên: ${t.samples.map(s=>`<a href="${_nfEsc(s.url)}" target="_blank" style="color:var(--text-muted)">${_nfEsc(String(s.title).slice(0,44))} (${_nfEsc(s.viewsFmt)}, ${s.ratio}×)</a>`).join(' · ')}</div>`:''}
      <div style="margin-top:9px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div>
    </div>`;
  }).join('');
  _nfSet('nfAttOut', cards || '<div class="nf-state">Không dựng được tệp khán giả nào.</div>');
}

function nfRenderSpike(r){
  const fq = r.failedQueries || [];
  let head;
  if (r.firstRun) head = `✅ Quét ${r.scanned || 0} video · đã lưu MỐC ĐẦU TIÊN (mốc riêng của app để so sau) — bức tốc bên dưới tính theo NGÀY ĐĂNG (mốc của YouTube)`;
  else head = `✅ So ${r.overlap || 0}/${r.scanned || 0} video với mốc cách đây ${r.windowHours}h` + (r.baselineKept ? ' (mốc cũ được giữ vì 2 lần quét quá sát)' : '');
  document.getElementById('nfSpState').textContent = head + (fq.length ? ` · ⚠️ ${fq.length} góc lỗi` : '') + (r.enriched ? ' · 📊 có like/comment/sub' : ' · chỉ view');
  let h = '';
  if (!r.firstRun && (r.videos || []).length){
    h += `<div class="win"><i class="r">NHẢY VIEW CAO NHẤT</i><em>view tăng thêm giữa 2 lần quét — đang được YouTube đẩy</em><s></s></div>`
      + `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Video</th><th class="n">Nhảy</th><th class="n">%</th><th class="n">View</th><th class="n">Tuổi</th><th></th></tr>`
      + r.videos.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<tr>
            <td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a><div style="font-size:10.5px;color:var(--text-muted)">${_nfEsc(v.channel)}</div></td>
            <td class="n" style="color:var(--green);font-weight:800">${_nfEsc(v.deltaFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.deltaPct != null ? ('+' + v.deltaPct + '%') : '—'}</td>
            <td class="n">${_nfEsc(v.viewsFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.days != null ? v.days + 'n' : '?'}</td>
            <td class="n"><button class="nf-btn ghost" style="padding:3px 8px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Làm video cùng mô-típ">🎬</button></td></tr>`;
        }).join('') + `</table></div>`;
  }
  if (!r.firstRun && (r.channels || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="p">KÊNH ĐANG BÙNG</i><em>tổng view các video của kênh tăng giữa 2 lần quét</em><s></s></div><div class="sim-grid" style="margin-top:10px">`
      + r.channels.map(c => `<div class="nf-card" style="margin:0">
          <div style="font-size:13px;font-weight:700">${c.channelUrl ? `<a href="${_nfEsc(c.channelUrl)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(c.channel)}</a>` : _nfEsc(c.channel)}</div>
          <div class="nf-state" style="margin:2px 0 5px"><b style="color:var(--green)">${_nfEsc(c.gainedFmt)}</b> view · ${c.videos} video đang chạy</div>
          ${c.sample ? `<div class="nf-title-ex" style="font-size:11.5px">🔥 ${_nfEsc(c.sample.title)} (${_nfEsc(c.sample.deltaFmt)})</div>` : ''}
        </div>`).join('') + `</div>`;
  }
  if ((r.rockets || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="r">🚀 BỨC TỐC THEO MỐC YOUTUBE</i><em>view/ngày tính từ NGÀY ĐĂNG — video ≤ 7 ngày đang bùng ngay bây giờ${r.medVel ? ` · trung vị video cũ: ${_t11oNum(r.medVel)}/ngày` : ''}</em><s></s></div>`
      + `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Video</th><th class="n">Bức tốc</th><th class="n">xN</th><th class="n">View</th><th class="n">Tuổi</th><th></th></tr>`
      + r.rockets.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<tr>
            <td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a><div style="font-size:10.5px;color:var(--text-muted)">${_nfEsc(v.channel)}</div></td>
            <td class="n" style="color:var(--green);font-weight:800">${_nfEsc(v.velFmt)}</td>
            <td class="n" style="color:var(--accent);font-weight:700">${v.xVel != null ? 'x' + v.xVel : '—'}</td>
            <td class="n">${_nfEsc(v.viewsFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.days}n</td>
            <td class="n"><button class="nf-btn ghost" style="padding:3px 8px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Làm video cùng mô-típ">🎬</button></td></tr>`;
        }).join('') + `</table></div>`;
  }
  if ((r.newVideos || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="r">VỪA LÊN SÓNG</i><em>đăng ≤ 2 ngày — chưa có mốc để so, view là toàn bộ từ lúc đăng</em><s></s></div>`
      + r.newVideos.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<div class="nf-card"><h5><span>🆕 ${_nfEsc(v.title)}</span><span class="chip" style="font-weight:700;color:var(--accent)">${_nfEsc(v.viewsFmt)} view</span></h5>
          <div class="nf-state" style="margin:0 0 5px">${_nfEsc(v.channel)} · ${v.days === 0 ? 'đăng hôm nay' : 'đăng hôm qua'}</div>
          <div style="margin-top:7px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div></div>`;
        }).join('');
  }
  if (r.analysis) h += `<div class="nf-card" style="margin-top:12px"><div class="nf-title-ex" style="white-space:pre-wrap">${_nfEsc(r.analysis)}</div></div>`;
  else if (r.analysisError) h += `<div class="nf-card" style="margin-top:12px"><div class="nf-state">⚠️ Phân tích AI lỗi: ${_nfEsc(r.analysisError)}</div></div>`;
  if (!h) h = '<div class="nf-state">Chưa có gì nổi bật — hãy quét lại sau vài giờ, hoặc thử ngách rộng hơn.</div>';
  _nfSet('nfSpOut', h);
}

function nfRenderPain(r){
  document.getElementById('nfPainState').textContent =
    `✅ ${r.commentCount || 0} bình luận · quét ${r.videosScanned || 0} video` + (r.fromCache ? ' · ⚡cache' : '') + (r.failed && r.failed.length ? ` · ⚠️ ${r.failed.length} video lỗi` : '');
  const res = r.result || {};
  const needs = res.needs || [];
  const gaps = res.gaps || [];
  const ideas = res.ideas || [];
  let h = '';
  if (needs.length) h += `<div class="win"><i class="p">NHU CẦU HÀNG ĐẦU</i><em>khán giả đang tìm kiếm</em><s></s></div><div class="nf-card" style="padding:8px 12px"><ul class="nf-list">${needs.map(n => `<li>${_nfEsc(n)}</li>`).join('')}</ul></div>`;
  if (gaps.length) h += `<div class="win" style="margin-top:12px"><i class="r">KHOẢNG TRỐNG NỘI DUNG</i><em>chưa ai làm đủ</em><s></s></div><div class="nf-card" style="padding:8px 12px"><ul class="nf-list">${gaps.map(g => `<li>${_nfEsc(g)}</li>`).join('')}</ul></div>`;
  if (ideas.length) h += `<div class="win" style="margin-top:12px"><i class="r">💡 Ý TƯỞNG VIDEO MỚI</i><em>đáp ứng nhu cầu trên</em><s></s></div><div class="sim-grid">${ideas.map((idea, idx) => {
    const _i = _nfRegIdea({ topic: idea.title, src: 'Pain Point' });
    return `<div class="nf-card"><h5>${idx+1}. ${_nfEsc(idea.title)}</h5><div class="nf-state" style="margin:4px 0 0">${_nfEsc(idea.description)}</div><div style="margin-top:8px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div></div>`;
  }).join('')}</div>`;
  if (!h) h = '<div class="nf-state">Không tìm thấy pain point rõ ràng — thử ngách khác hoặc quét thêm bình luận.</div>';
  _nfSet('nfPainOut', h);
}

function nfRenderForecast(r){
  document.getElementById('nfForecastState').textContent =
    `✅ ${r.rocketsCount || 0} video bứt tốc · ${r.moversCount || 0} video chuyển động` + (r.fromCache ? ' · ⚡cache' : '');
  const status = r.status || 'chưa xác định';
  const rec = r.recommendation || '';
  const forecast = r.forecast || '';
  const medVel = r.medVel || 0;
  const avgVel = r.avgRocketVel || 0;
  let h = `<div class="nf-card"><div style="font-size:18px;font-weight:800;color:${status === 'tăng trưởng mạnh' ? 'var(--green)' : status === 'đang tăng' ? 'var(--accent)' : status === 'ổn định' ? '#f0c040' : '#e08a8a'}">📊 ${status}</div>
    <div class="nf-state" style="margin:4px 0 8px">${_nfEsc(rec)}</div>
    <div class="nf-title-ex" style="white-space:pre-wrap">${_nfEsc(forecast)}</div>
    <div style="display:flex;gap:20px;margin-top:10px;font-size:12px;color:var(--text-muted)">
      <span>Bức tốc TB: ${_t11oNum(avgVel)}/ngày</span>
      <span>Trung vị video cũ: ${_t11oNum(medVel)}/ngày</span>
    </div></div>`;
  _nfSet('nfForecastOut', h);
}

function nfRenderKeywords(r){
  const clusters = r.clusters || [];
  const total = r.totalVideos || 0;
  const fq = r.failedQueries || [];
  document.getElementById('nfKeywordsState').textContent =
    `✅ ${clusters.length} cụm · ${total} video` + (fq.length ? ` · ⚠️ ${fq.length} góc lỗi` : '') + (r.fromCache ? ' · ⚡cache' : '');
  if (!clusters.length) { _nfSet('nfKeywordsOut', '<div class="nf-state">Không tìm thấy cụm từ khoá.</div>'); return; }
  let h = `<div class="sim-grid">` + clusters.map(c => {
    const comp = c.competition || 'Trung bình';
    const col = comp === 'Cao' ? '#e08a8a' : comp === 'Thấp' ? '#5fbf7f' : '#f0c040';
    return `<div class="nf-card"><h5>📌 ${_nfEsc(c.cluster_name)}</h5>
      <div><span class="chip">${_nfEsc(c.keywords ? c.keywords.join(', ') : '')}</span></div>
      <div class="nf-state" style="margin:4px 0"><b style="color:${col}">${comp}</b> · từ khoá chính: <b>${_nfEsc(c.suggested_main || '')}</b></div>
    </div>`;
  }).join('') + `</div>`;
  _nfSet('nfKeywordsOut', h);
}

function nfRenderBreakdown(r){
  const outliers = r.outliers || [];
  const res = r.result || {};
  document.getElementById('nfBreakdownState').textContent =
    `✅ ${outliers.length} video vượt trội` + (r.fromCache ? ' · ⚡cache' : '');
  if (!outliers.length) { _nfSet('nfBreakdownOut', '<div class="nf-state">Không có video nào vượt trội đáng kể.</div>'); return; }
  let h = `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Tiêu đề</th><th class="n">View</th><th class="n">Tuổi</th><th class="n">Kênh</th></tr>`
    + outliers.map(v => `<tr><td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a></td>
        <td class="n" style="color:var(--accent);font-weight:700">${_nfEsc(v.viewsFmt)}</td>
        <td class="n" style="color:var(--text-muted)">${v.days != null ? v.days + 'n' : '?'}</td>
        <td class="n">${_nfEsc(v.channel)}</td></tr>`).join('') + `</table></div>`;
  const lessons = res.lessons || [];
  if (lessons.length) h += `<div class="nf-card" style="margin-top:12px"><h5>📝 Bài học cho faceless</h5><ul class="nf-list">${lessons.map(l => `<li>${_nfEsc(l)}</li>`).join('')}</ul></div>`;
  if (res.common_title_pattern) h += `<div class="nf-card" style="margin-top:8px"><b>Cấu trúc tiêu đề:</b> ${_nfEsc(res.common_title_pattern)}</div>`;
  if (res.common_duration) h += `<div class="nf-card" style="margin-top:4px"><b>Độ dài phổ biến:</b> ${_nfEsc(res.common_duration)}</div>`;
  if (res.common_opening) h += `<div class="nf-card" style="margin-top:4px"><b>Góc mở đầu:</b> ${_nfEsc(res.common_opening)}</div>`;
  _nfSet('nfBreakdownOut', h);
}

function _nfRegIdea(idea){ _nfIdeas.push(idea); return _nfIdeas.length - 1; }

function nfMakeVideo(i){
  const it = _nfIdeas[i]; if (!it) return;
  const el = document.getElementById('tsTopic'); if (!el) return;
  el.value = it.topic || '';
  switchTool('toolscript');
  const st = document.getElementById('statusScript');
  if (st){ st.className = 'status-bar ok'; st.textContent = `✅ Đã chuyển chủ đề từ Nghiên cứu Ngách (${it.src || ''}) — chỉnh số từ rồi bấm Viết Kịch Bản.`; }
}

function _nfMd(mod){
  const r = _nfLast[mod]; if (!r) return '';
  const L = [];
  if (mod === 'hot'){
    L.push(`# 🔥 Chủ đề Hot — ngách "${r.seed || ''}"`, `Trung vị ngách ${r.median || 0} view · quét ${r.scanned || 0} video · ${(r.queries || []).length} góc${(r.failedQueries || []).length ? ` · ${r.failedQueries.length} góc lỗi` : ''}`, '');
    (r.items || []).forEach(t => L.push(`- **${t.topic}** (${t.window === 'rising' ? 'đang lên' : 'đã ăn'} · ${t.heat}) — x${t.ratio} · ${t.count} video. Vì sao: ${t.why}. Góc làm: ${t.angle}. Tiêu đề mẫu: ${t.title}`));
  } else if (mod === 'scorecard'){
    L.push(`# 🩺 Thẻ điểm kênh — ${r.channel || ''}`, `${r.subsFmt || 0} sub · trung vị ${r.median || 0} view · sức khoẻ ${r.health ?? '?'}/100${r.monetized ? ' · đã bật kiếm tiền' : ''}`, '');
    if (r.analysis) L.push(r.analysis, '');
    else if (r.analysisError) L.push(`(Phân tích AI lỗi: ${r.analysisError})`, '');
    (r.outliers || []).forEach(o => L.push(`- x${o.ratio} · ${o.viewsFmt} view · ${Math.round((o.dur || 0) / 60)}p · ${o.url} — ${o.title}`));
  } else if (mod === 'attention'){
    L.push(`# ❤️ Thị trường chú ý — ngách "${r.seed || ''}"`, `Trung vị ${r.median || 0} view · ${r.outliers || 0} outlier vượt trội`, '');
    (r.items || []).forEach(t => L.push(`- **${t.segment}** (🔥 ${t.fire} outlier · nhu cầu ${t.demand}) — đang muốn: ${t.need}. Ý tưởng: ${t.idea} (B&W ${t.bw})`));
  } else if (mod === 'bw'){
    const d = r.result || {};
    L.push(`# ⚖️ Chấm B&W — "${r.title || ''}"`, `Điểm ${d.score ?? '?'}/100${d.layered ? ' · ý nhiều tầng' : ''} — ${d.verdict || ''}`, '');
    (d.alts || []).forEach(a => L.push(`- ${a.score}/100 — ${a.title} (${a.why || ''})`));
  } else if (mod === 'similar'){
    L.push(`# 👥 Kênh giống — ${r.seed || ''}`, '');
    (r.cards || []).forEach(c => L.push(`- ${c.channel} · ${c.subsFmt} sub · VPS ${c.metrics ? c.metrics.vps + '×' : '?'} · trùng ${c.hits} truy vấn — ${c.url}`));
  } else if (mod === 'spike'){
    L.push(`# ⚡ Đột phá view — ngách "${r.seed || ''}"`,
      r.firstRun ? 'Lần đầu quét — mốc đã lưu, quét lại sau ≥1 giờ để so' : `So với mốc cách đây ${r.windowHours}h · ${r.overlap || 0}/${r.scanned || 0} video trùng`, '');
    (r.videos || []).forEach(v => L.push(`- ${v.deltaFmt} view (${v.deltaPct != null ? '+' + v.deltaPct + '%' : '?'}) · ${v.viewsFmt} view · ${v.title} — ${v.channel} · ${v.url}`));
    (r.rockets || []).forEach(v => L.push(`- 🚀 ${v.velFmt}${v.xVel ? ` (x${v.xVel} trung vị)` : ''} · ${v.viewsFmt} view · ${v.days} ngày tuổi · ${v.title} — ${v.channel} · ${v.url}`));
    (r.channels || []).forEach(c => L.push(`- Kênh **${c.channel}**: ${c.gainedFmt} view qua ${c.videos} video${c.sample ? ' · dẫn đầu: ' + c.sample.title : ''}`));
    (r.newVideos || []).forEach(v => L.push(`- Mới: ${v.viewsFmt} view · ${v.title} — ${v.channel} · ${v.url}`));
    if (r.analysis) L.push('', r.analysis);
    else if (r.analysisError) L.push('', `(Phân tích AI lỗi: ${r.analysisError})`);
  } else if (mod === 'pain'){
    const res = r.result || {};
    L.push(`# 🧠 Pain Point — ngách "${r.seed || ''}"`, `Quét ${r.videosScanned || 0} video · ${r.commentCount || 0} bình luận`, '');
    if (res.needs && res.needs.length) L.push('## Nhu cầu hàng đầu', ...res.needs.map(n => `- ${n}`), '');
    if (res.gaps && res.gaps.length) L.push('## Khoảng trống nội dung', ...res.gaps.map(g => `- ${g}`), '');
    if (res.ideas && res.ideas.length) L.push('## Ý tưởng video mới', ...res.ideas.map(i => `- **${i.title}**: ${i.description}`), '');
  } else if (mod === 'forecast'){
    L.push(`# 📈 Dự báo xu hướng — "${r.seed || ''}"`, `Trạng thái: **${r.status || 'chưa xác định'}**`, '');
    if (r.recommendation) L.push(`Khuyến nghị: ${r.recommendation}`, '');
    if (r.forecast) L.push(r.forecast, '');
    L.push(`Bức tốc TB: ${r.avgRocketVel || 0}/ngày · Trung vị video cũ: ${r.medVel || 0}/ngày`);
  } else if (mod === 'keywords'){
    const clusters = r.clusters || [];
    L.push(`# 🔑 Từ khoá SEO — "${r.seed || ''}"`, `Phân cụm ${clusters.length} nhóm từ khoá`, '');
    clusters.forEach(c => {
      L.push(`## ${c.name} (Cạnh tranh: ${c.competition || '?'})`);
      if (c.keywords && c.keywords.length) L.push(...c.keywords.map(k => `- ${k}`));
      L.push('');
    });
  } else if (mod === 'breakdown'){
    const outliers = r.outliers || [];
    const res = r.result || {};
    L.push(`# 🎬 Phân tích video — "${r.seed || ''}"`, `${outliers.length} video vượt trội`, '');
    outliers.forEach(v => L.push(`- **${v.title}** (${v.viewsFmt} view · ${v.days != null ? v.days + ' ngày' : '?'}) — ${v.channel} · ${v.url}`));
    if (res.lessons && res.lessons.length) L.push('', '## Bài học cho faceless', ...res.lessons.map(l => `- ${l}`));
    if (res.common_title_pattern) L.push('', `**Cấu trúc tiêu đề:** ${res.common_title_pattern}`);
    if (res.common_duration) L.push(`**Độ dài phổ biến:** ${res.common_duration}`);
    if (res.common_opening) L.push(`**Góc mở đầu:** ${res.common_opening}`);
  }
  return L.join('\n');
}

function _nfCopyFallback(md, done){
  const ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } finally { ta.remove(); }
}

function nfCopy(mod){
  const md = _nfMd(mod);
  const st = document.getElementById((NF_MAP[mod] && NF_MAP[mod].state) || (mod === 'similar' ? 'nfSimState' : ''));
  if (!md){ if (st) st.textContent = '⚠️ Chưa có kết quả để copy — chạy nghiên cứu trước.'; return; }
  const done = () => { if (st){ const old = st.textContent; st.textContent = `📋 Đã copy ${md.length} ký tự ra clipboard`; setTimeout(() => { st.textContent = old; }, 2500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(done, () => _nfCopyFallback(md, done));
  else _nfCopyFallback(md, done);
}

function _t9RefSt(msg, color){ const el = document.getElementById('t9RefStatus'); if (el){ el.textContent = msg || ''; el.style.color = color || 'var(--text-dim)'; } }

function _t9RefTopicSource(){
  const t = (document.getElementById('t10TitleInput')?.value || document.getElementById('t9Title')?.value || '').trim();
  if (t) return { txt: t, from: 'tiêu đề' };
  const lg = (state.videoLogline || '').trim();
  if (lg) return { txt: lg.slice(0, 180), from: 'logline' };
  const sc = (state.script || document.getElementById('t9Script')?.value || '').trim();
  if (sc) return { txt: sc.replace(/\s+/g, ' ').slice(0, 220), from: 'kịch bản' };
  return { txt: '', from: '' };
}

async function _t9RefTopicQuery(){
  const src = _t9RefTopicSource();
  if (!src.txt) return { q: '', from: '' };
  let q = src.txt.replace(/["“”'’|—–\-:!?.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (_hasViet(q) && typeof callLLM === 'function'){
    try {
      const r = await callLLM(`Convert the following video description into 3-6 ENGLISH KEYWORDS to search YouTube for videos on the same topic. Print only the keywords, comma-separated, no explanation.\n\n"${q.slice(0, 200)}"`, { maxTokens: 60 });
      const k = String(r || '').replace(/[\n"]+/g, ' ').trim();
      if (k && k.length < 120) q = k;
    } catch (e) {}
  }
  return { q: q.split(' ').slice(0, 9).join(' '), from: src.from };
}

function _t9ChosenTitle(){
  return (document.getElementById('t10TitleInput')?.value || document.getElementById('t9Title')?.value || '').trim()
    || ((t9State && t9State.result && (t9State.result.titles || [])[0]) || '').trim();
}

async function _t9RefDescribe(){
  if (!t9Ref.base64) return null;
  if (t9Ref.spec) return t9Ref.spec;
  const ask = 'Analyse this YouTube thumbnail and return ONLY JSON with these keys:\n'
    + '"style": rendering technique, line/shading treatment, colour palette, lighting and mood (40-70 words).\n'
    + '"background": what fills the background and how it is treated.\n'
    + '"layout": the layout skeleton — which zone of the frame holds what (left/right/top/bottom/centre), and relative sizes.\n'
    + '"content": what is actually depicted — objects, people, diagrams, screenshots, scenery — how many, and exactly how they are arranged.\n'
    + '"caption": the largest headline text, verbatim. Empty string if the image has no headline.\n'
    + '"captionStyle": its typeface weight, casing, colour, decoration (underline/box/outline/shadow). Empty if no headline.\n'
    + '"captionLayout": HOW the headline is arranged — is it ONE block or SPLIT into several parts? how many parts, where each part sits, how many lines each, and whether it wraps around or is interrupted by the subject. Be precise (e.g. "split into two blocks: left part at top-left, right part at top-right, the subject head between them"). Empty if no headline.\n'
    + '"secondaryText": array of the other text items, verbatim, max 8. Empty array if none.\n'
    + '"textDevice": how that secondary text is attached, in your own words (e.g. label above each figure, leader line to a part, sticker badge, list down one side). Empty if none.\n'
    + '"extras": array of other recurring devices — badges, arrows, circles, frames, borders, progress bars, logos-shaped blocks. Empty array if none.\n'
    + 'Describe only what is VISUALLY present. Do not name the video topic, the channel, or any real person.';
  const msg = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: t9Ref.mime || 'image/jpeg', data: t9Ref.base64 } },
    { type: 'text', text: ask }
  ] }];
  try {
    const d = await callLLMJson('', { messages: msg, maxTokens: 700, validate: v => v && typeof v === 'object' && (v.style || v.layout) });
    const arr = (x) => Array.isArray(x) ? x.map(y => String(y || '').trim()).filter(Boolean).slice(0, 8) : [];
    t9Ref.spec = {
      style: String(d.style || '').trim(), background: String(d.background || '').trim(),
      layout: String(d.layout || '').trim(), content: String(d.content || '').trim(),
      caption: String(d.caption || '').trim(), captionStyle: String(d.captionStyle || '').trim(),
      captionLayout: String(d.captionLayout || '').trim(),
      secondaryText: arr(d.secondaryText), textDevice: String(d.textDevice || '').trim(), extras: arr(d.extras)
    };
    t9Ref.cap = t9Ref.spec.caption;
  } catch (e) { t9Ref.spec = null; t9Ref.cap = ''; }
  return t9Ref.spec;
}

function _t9RefConcepts(spec, title, count, captions){
  const capOf = (i) => (Array.isArray(captions) ? (captions[i] || captions[0] || '') : (captions || ''));
  const topic = String(title || '').replace(/["“”']/g, '').trim();
  const L = [];
  L.push('Recreate this thumbnail TEMPLATE exactly as described, then fill it with new content.');
  if (spec.style)      L.push('RENDERING: ' + spec.style + ' — match this exactly.');
  if (spec.background) L.push('BACKGROUND: ' + spec.background + ' — keep the same treatment.');
  if (spec.layout)     L.push('LAYOUT: ' + spec.layout + ' — keep every zone in the same place and the same relative size.');
  if (spec.content)    L.push('COMPOSITION TO PRESERVE: ' + spec.content + '. Keep the same KIND, the same COUNT and the same ARRANGEMENT; only the specific identity/details change to fit the new topic.');
  if (spec.extras.length) L.push('KEEP these devices: ' + spec.extras.join('; ') + '.');
  // Chữ: chỉ khi mẫu có. Mẫu không chữ thì ảnh cũng không chữ.
  const _capBlock = (cap) => {
    const A = [];
    A.push('HEADLINE TEXT: render exactly "' + cap + '" — these words and nothing else. Do not write the video title anywhere.');
    if (spec.captionStyle)  A.push('HEADLINE STYLING: ' + spec.captionStyle + ' — match exactly.');
    if (spec.captionLayout) A.push('HEADLINE ARRANGEMENT (critical): ' + spec.captionLayout + '. Reproduce this arrangement exactly — if the reference splits the headline into separate blocks, split my headline the same way at a natural word break, with the same number of parts in the same positions and the same relative sizes. Do NOT collapse it into a single line.');
    return A.join('\n');
  };
  if (!spec.caption) L.push('The template has NO headline text — do NOT add one.');
  if (spec.secondaryText.length) L.push('SECONDARY TEXT: keep the same device (' + (spec.textDevice || 'as in the reference') + ') with ' + spec.secondaryText.length + ' items, same lettering, but rewrite the wording for the new topic. Never leave one blank.');
  else L.push('The template has NO secondary text, labels or leader lines — do NOT invent any.');
  L.push('NEW TOPIC to fill the template with: ' + topic + '.');
  L.push('Do NOT copy the reference\'s own subject matter, wording, logos or any recognisable real person. Same template, clearly different picture.');
  const base = L.join('\n');
  const tweaks = [
    ' Fill it straightforwardly for the topic.',
    ' Keep the arrangement identical; vary the details, poses or angles of what is depicted.',
    ' Keep the arrangement identical; swap the secondary props/details for related ones.',
    ' Keep the arrangement identical; frame slightly tighter, all elements in the same relative positions.',
    ' Keep the arrangement identical; vary the surface details and materials.',
    ' Keep the arrangement identical; nudge the accent colour within the same palette family.'
  ];
  return Array.from({ length: count }, (_, i) => {
    const cap = capOf(i);
    const capPart = (spec.caption && cap) ? ('\n' + _capBlock(cap)) : (spec.caption ? '\nLeave the headline area EMPTY — render no headline text at all.' : '');
    return base + capPart + (tweaks[i] || tweaks[1]);
  });
}

async function _t9CaptionsFromPattern(myTitle, n){
  const refTitle = ((t9Ref.items || [])[t9Ref.sel] || {}).title || '';
  const refCap = t9Ref.cap || '';
  const key = myTitle + '|' + n;
  if (t9Ref.capsFor === key && Array.isArray(t9Ref.caps) && t9Ref.caps.length) return t9Ref.caps;
  const p = refCap
    ? `A YouTube thumbnail caption is NOT the video title — it is shorter and more provocative.\n\nREFERENCE video title: "${refTitle}"\nREFERENCE thumbnail caption: "${refCap}"\n\nWork out the TRANSFORMATION pattern between them (tone, person, length, what is dropped, what is added, punctuation, casing), then apply that SAME pattern to my video title: "${myTitle}"\n\nGive ${n} DIFFERENT caption options — same pattern, different angles (different hook word, different emphasis). Each about the same word count as the reference caption.\nReturn ONLY a JSON array of ${n} strings.`
    : `Write ${n} DIFFERENT YouTube thumbnail captions for this video title: "${myTitle}".\nEach 3-7 words, UPPERCASE, provocative, second person where it fits. Do not repeat the title verbatim. Different angle each.\nReturn ONLY a JSON array of ${n} strings.`;
  try {
    const arr = await callLLMJson(p, { maxTokens: 60 + n * 40, validate: v => Array.isArray(v) && v.length });
    const out = (arr || []).map(x => String(x || '').replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 80).trim()).filter(Boolean).slice(0, n);
    if (out.length) { t9Ref.capsFor = key; t9Ref.caps = out; }
    return out;
  } catch (e) { return []; }
}


/* === Stub functions (recovered from original index.html — v2 extractor would catch these) === */
function _giongCloud(){ try { return JSON.parse(localStorage.getItem('_giongCloudCache') || '[]'); } catch(_){ return []; } }
function _giongCloudLuu(ds){ try { localStorage.setItem('_giongCloudCache', JSON.stringify(ds || [])); } catch(_){} }
