/* T2 SCENES — kiểm soát cảnh, nguồn (nguon), tags canon, wardrobe
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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
  const w = [];
  const txt = String(s.text || '').trim();
  const pr  = (state.scenePrompts || {})[s.id] || '';
  // A5: canh trong (khong co gi het) -> chip warning nhạt
  if (!txt && !pr.trim() && !String(s.character || '').trim() && !String(s.background || '').trim()){
    w.push('canh trong - can nhap text hoac generate prompt');
  }
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

