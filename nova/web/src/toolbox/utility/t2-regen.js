/* T2 REGEN — pool sinh lại cảnh (_t2Regen*), renderTable, videoAgent event bridge
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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

