/* ADDED API — khung "📋 API đã thêm" trong tab Cài đặt · API & Tài khoản.
   Khi người dùng bấm 💾 Lưu ở khung 🤖 AI Provider (saveApiSettings), API vừa lưu
   được ghi nhận vào danh sách này (key hiện 4 đầu + 4 cuối, Base URL hiện 2 ký tự
   sau http:// + 2 ký tự cuối — giá trị thật vẫn lưu trong entry),
   rồi form 🤖 AI Provider được RESET về trạng thái trống để nhập API mới tiếp.
   KHUNG NÀY LÀ NGUỒN API CHO CÁC CÔNG VIỆC DÙNG AI (addedApiResolveAiSource,
   callLLM đọc qua _apiKeyPool): ưu tiên API đã thêm → API Key Flow (key Gemini,
   api_key_flow) → cấu hình lưu sẵn. CLI (subscription) không bị chi phối.
   Script thường (renderer không có build step): mọi tên cấp đầu có tiền tố addedApi / _addedApi.
   Luật quan trọng: reset CHỈ xoá form nhập — KHÔNG xoá kho key đã lưu trong localStorage
   (cơ chế _addedApiGuard chặn việc ghi rỗng đè lên kho key của provider vừa reset). */

var _addedApiGuard = null;        // provider vừa bị reset form — ô key trống là trạng thái mặc định, không phải "đã xoá key"
var _addedApiListenerOn = false;  // listener dọn guard khi người dùng bắt đầu gõ key

function addedApiGet(){
  try { return JSON.parse(localStorage.getItem('api_added_list') || '[]'); } catch (e) { return []; }
}

function addedApiFingerprint(provider, model, keys){
  const s = (provider || '') + '|' + (model || '') + '|' + (keys || []).join(',');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 'fp' + h.toString(36);
}

function addedApiRender(){
  const box = document.getElementById('addedApiList');
  if (!box) return;
  const list = addedApiGet();
  if (!list.length){
    box.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Chưa có API nào được thêm. Nhập API ở khung 🤖 AI Provider (cột trái) rồi bấm 💾 Lưu — API sẽ hiện ở đây.</div>';
    return;
  }
  box.innerHTML = list.map(e => {
    const d = new Date(e.at);
    const when = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const keyMask = e.keys && e.keys.length ? addedApiMaskKey(e.keys[0]) + (e.keys.length > 1 ? ' (+' + (e.keys.length - 1) + ')' : '') : '••••';
    const urlMask = e.url ? ' · 🌐 ' + addedApiMaskUrl(e.url) : '';
    const star = e === list[0] ? ' <span style="color:var(--green);font-size:10.5px">✓ đang dùng cho AI</span>' : '';
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">' +
      '<span class="api-status ok"></span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(e.label || e.provider) + star + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">Model: ' + escapeHtml(e.model || '—') + ' · 🔑 ' + escapeHtml(keyMask) + urlMask + ' · thêm ' + when + '</div>' +
      '</div>' +
      '<button class="btn ghost sm" onclick="addedApiRemove(\'' + e.id + '\')" title="Xoá khỏi danh sách (không xoá key đã lưu)" style="color:var(--red);padding:4px 9px">✕</button>' +
    '</div>';
  }).join('');
}

// Mask API key: 4 ký tự ĐẦU + 4 ký tự CUỐI, giữa chấm kín
function addedApiMaskKey(k){
  const s = String(k || '');
  if (!s) return '';
  if (s.length <= 8) return s.slice(0, 2) + '••••••';
  return s.slice(0, 4) + '••••••' + s.slice(-4);
}

// Mask Base URL: 2 ký tự NGAY SAU http(s):// + 2 ký tự CUỐI của URL
function addedApiMaskUrl(u){
  const s = String(u || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  const rest = s.replace(/^https?:\/\//i, '');
  if (rest.length <= 6) return rest;
  return rest.slice(0, 2) + '…' + s.slice(-2);
}

function addedApiRemove(id){
  const list = addedApiGet().filter(e => e.id !== id);
  localStorage.setItem('api_added_list', JSON.stringify(list));
  addedApiRender();
}

// RESET form 🤖 AI Provider về trạng thái trống để người dùng nhập API mới.
// _addedApiGuard bảo vệ kho key của provider vừa reset khỏi bị ghi rỗng/nạp lại nhầm.
function addedApiResetForm(){
  const sel = document.getElementById('apiProvider');
  if (!sel) return;
  _addedApiGuard = null;
  sel.value = 'anthropic';
  _keyFieldsProvider = 'anthropic';
  if (typeof renderKeyFields === 'function') renderKeyFields(['']);
  _addedApiGuard = 'anthropic';
  if (typeof onProviderChange === 'function') onProviderChange();
  // onProviderChange có thể dò api_model cũ trong localStorage sang ô "Tuỳ chỉnh" —
  // form reset phải trọn model mặc định của provider, không mang theo cấu hình cũ.
  const selM = document.getElementById('apiModel');
  if (selM) selM.value = (MODELS.anthropic && MODELS.anthropic[0]) ? MODELS.anthropic[0].id : '';
  const cm = document.getElementById('apiModelCustom');
  if (cm){ cm.value = ''; cm.style.display = 'none'; }
  const bu = document.getElementById('apiBaseUrl');
  if (bu) bu.value = '';
}

// Hook gọi từ saveApiSettings sau khi lưu thành công.
// Ghi nhận ĐẦY ĐỦ url + keys vào entry (cần cho việc làm NGUỒN key AI — addedApiResolveAiSource);
// khi HIỂN THỊ chỉ mask 4 đầu/4 cuối key, 2 sau http:// + 2 cuối URL.
function addedApiOnSave(provider, model, keys, url){
  const sel = document.getElementById('apiProvider');
  const label = (sel && sel.selectedOptions && sel.selectedOptions[0]) ? sel.selectedOptions[0].textContent.trim() : provider;
  const list = addedApiGet();
  const now = Date.now();
  const fp = addedApiFingerprint(provider, model, keys);
  const ex = list.find(e => e.fp === fp);
  if (ex){ ex.at = now; ex.model = model; ex.keyCount = keys.length; ex.label = label; ex.url = url || ''; ex.keys = keys.slice(); }
  else {
    list.unshift({ id: 'apil_' + now.toString(36) + Math.random().toString(36).slice(2, 6), fp, provider, label, model, url: url || '', keys: keys.slice(), keyCount: keys.length, at: now });
  }
  while (list.length > 30) list.pop();
  localStorage.setItem('api_added_list', JSON.stringify(list));
  addedApiRender();
  addedApiResetForm();
}

// Kho key "API Key Flow" (mục Tài khoản Google Flow — key Gemini, lưu qua novaStore/localStorage).
// Đúng định nghĩa từ editor-pro/niche/loi.js: provider 'gemini' lấy key từ api_key_flow.
function addedApiFlowKeys(){
  let raw = '';
  try {
    if (window.novaStore && window.novaStore.seed && typeof window.novaStore.seed['api_key_flow'] === 'string') raw = window.novaStore.seed['api_key_flow'];
  } catch (e) {}
  if (!raw){ try { raw = localStorage.getItem('flowApiKey') || ''; } catch (e) {} }
  return String(raw).split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
}

// NGUỒN API CHO CÁC CÔNG VIỆC DÙNG AI (callLLM): ưu tiên "📋 API đã thêm" (các entry
// CÙNG provider với entry mới nhất — entry mới nhất đứng trước để xoay key mới nhất trước);
// nếu không khả dụng → API Key Flow (key Gemini); nếu vẫn không có → null (callLLM
// dùng cấu hình hiện tại như cũ). Provider/model/base URL cũng trả theo entry để
// key luôn khớp đúng endpoint — không ghép chéo key OpenAI vào endpoint Anthropic.
function addedApiResolveAiSource(){
  const list = addedApiGet().filter(e => Array.isArray(e.keys) && e.keys.length);
  if (list.length){
    const head = list[0];
    const keys = [];
    for (const e of list){                                   // các entry cùng provider đều vào pool xoay key
      if (e.provider !== head.provider) continue;
      for (const k of e.keys) if (!keys.includes(k)) keys.push(k);
    }
    return { source: 'added', provider: head.provider, model: head.model || '', baseUrl: head.url || '', keys };
  }
  const flow = addedApiFlowKeys();
  if (flow.length){
    const model = (typeof MODELS !== 'undefined' && MODELS.gemini && MODELS.gemini[0]) ? MODELS.gemini[0].id : 'gemini-2.5-flash';
    return { source: 'flow', provider: 'gemini', model, baseUrl: '', keys: flow };
  }
  return null;
}

function addedApiInitGuardListener(){
  if (_addedApiListenerOn) return;
  _addedApiListenerOn = true;
  document.addEventListener('input', function(e){
    // Người dùng bắt đầu gõ key → hết trạng thái reset, guard tự nhả
    if (e.target && e.target.classList && e.target.classList.contains('api-key-field')) _addedApiGuard = null;
  });
}

function addedApiLoad(){
  addedApiInitGuardListener();
  addedApiRender();
}
