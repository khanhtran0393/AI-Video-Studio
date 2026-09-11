/* SHELL — theme, nav filter, sidebar/user box, toast, link hỗ trợ, cập nhật app
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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

