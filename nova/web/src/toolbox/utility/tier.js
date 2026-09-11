/* TIER & ADMIN — Pro/Max gate (isPro, gateTool, upgrade modal) + admin dashboard (adm*)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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

