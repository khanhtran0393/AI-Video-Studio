/* T2 CAST — thu cast → assets (_collectCastToAssets), renderT2Assets, renderPreview
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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

