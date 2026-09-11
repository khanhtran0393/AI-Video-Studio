/* UPSCALE — hàng đợi upscale ảnh (up*)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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

