/* UTILITY KERNEL — hàm dùng chéo toàn app (giữ lại tại chỗ theo hợp đồng web-origin-qa.js: _t7FileUrl + /local-media phải nằm trong utility.js).
   889 hàm còn lại đã tách sang utility/<cụm-nghiệp-vụ>.js — xem nova/ARCHITECTURE.md (cây toolbox). */
/* promote-shared-to-peer: 4 hàm thay bằng bản đầy đủ từ shared-consts.js */
/* AUTO-EXTRACTED utility functions */

function _isMac(){ return !!(window.native && window.native.platform === 'darwin'); }

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

function _qid(){ return 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1e6); }

function _slug(s){ return String(s || '').slice(0, 60).replace(/[^\w\sÀ-ỹ-]/g, '').trim().replace(/\s+/g, '-') || 'video'; }

function _fmtDur(s){ return s < 60 ? s + ' giây' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' phút'; }

function _b64ToBlob(b64, mime){ const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'video/mp4' }); }

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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

function naturalSort(a, b){
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
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

