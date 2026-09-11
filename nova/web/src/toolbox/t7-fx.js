/* T7 FX — danh mục FX/chuyển cảnh (t7FxTab/AddTpl/AddBit/SetTrans), kéo-thả rãnh/stage, clipboard đồ hoạ, lớp toàn cục (global layers)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7GlobTime(key, v){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return;
  const n = parseFloat(v); if (!Number.isFinite(n)) return;
  g[key] = key === 'dur' ? Math.max(0.3, n) : Math.max(0, n);
  _t7GlobTouch();
}

function t7GlobFull(){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return;
  g.start = 0; g.dur = _t7Total(); _t7GlobTouch();
  setStatus7('⇤⇥ Lớp phủ trọn cả video.', 'ok');
}

async function t7FxTab(which){
  // Tên cũ ('tpl'/'tr'/'bit') vẫn nhận để không phá chỗ gọi cũ; tên mới đến từ rail.
  const MAP = { tpl: 'motion', bit: 'motion', tr: 'trans' };
  _t7FxTab = MAP[which] || which || 'motion';
  ['t7FxTabT','t7FxTabR','t7FxTabB'].forEach((id, k) => {
    const b = document.getElementById(id); if (b) b.classList.toggle('on', ['motion','trans','motion'][k] === _t7FxTab);
  });
  const box = document.getElementById('t7FxList'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  await _t7LoadFx();
  await _t7FxSwatchLoad();
  const esc = escapeHtml;
  const sel = t7State.clips.find(x => x.id === t7State.selClip);
  const head = sel
    ? `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để thêm vào <b style="color:var(--text)">cảnh ${esc(sel.sceneId)}</b>.</div>`
    : `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">⚠️ Chọn một cảnh trước đã.</div>`;
  let html = head;
  const _q = _t7RailQ;
  const _hit = (s) => !_q || String(s || '').toLowerCase().includes(_q);
  if (_t7FxTab === 'tpl' || _t7FxTab === 'motion' || _t7FxTab === 'text'){
    const cat = (_t7Cat || []).filter(t => (_t7FxTab !== 'text' || _t7IsTextTpl(t)) && _hit(t.label + ' ' + t.template));
    html += '<div class="t7-fxgrid">' + cat.map(t => {
      const im = _t7Prev['tpl_' + t.template];
      // Thẻ FX chưa có ảnh JPG → dùng swatch CSS sống (đúng engine, co theo thẻ).
      const sw = (!im && /^fx-/.test(t.template) && _t7FxSw && _t7FxSw[t.template]) || null;
      return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'tpl','${esc(t.template)}')" onclick="t7FxAddTpl('${esc(t.template)}')" title="${esc((t.params||[]).join(' · '))} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
        <div class="pv">${im ? `<img src="${im}" loading="lazy">` : (sw || '<span>—</span>')}</div>
        <div class="nm">${esc(t.label)}</div></div>`;
    }).join('') + '</div>';
    // Nhóm "Chuyển động" gộp luôn bit Remotion — trước phải bấm sang tab con khác mới thấy.
    if (_t7FxTab !== 'text'){
      const bits = (_t7Bits || []).filter(_hit);
      if (bits.length) html += `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;font-weight:700">Bit Remotion · ${bits.length}</div>`
        + '<div class="t7-fxgrid">' + bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>';
    }
    if (!cat.length && (_t7FxTab === 'text' || !(_t7Bits || []).length)) html += '<div class="t7-dim" style="font-size:11.5px">Không có mẫu nào khớp.</div>';
  } else if (_t7FxTab === 'tr' || _t7FxTab === 'trans'){
    const fam = {};
    (_t7Trans || []).filter(t => _hit(t.label + ' ' + t.id)).forEach(t => { (fam[t.family] = fam[t.family] || []).push(t); });
    html += Object.keys(fam).map(f =>
      `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:9px 0 4px;font-weight:700">${esc(_T7_FAM[f] || f)}</div>` +
      fam[f].map(t => `<div class="t7-fxi" onclick="t7FxSetTrans('${esc(t.id)}')" title="${esc(t.description || '')}">
        <b>${esc(t.label)}</b><s>${t.durationSec}s</s></div>`).join('')).join('');
  } else {
    html += _t7Bits.length
      ? '<div class="t7-fxgrid">' + _t7Bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>'
      : '<div class="t7-dim" style="font-size:11.5px">Không nạp được danh sách bit (khởi động lại app).</div>';
  }
  box.innerHTML = html;
}

function t7FxAddTpl(name){
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push({ template: name });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  setStatus7('＋ Đã thêm mẫu vào cảnh ' + t.c.sceneId + '.', 'ok');
}

function t7FxAddBit(bit){
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push({ type: 'bit', bit, box: { x: 8, y: 12, w: 84, h: 72 }, in: { preset: 'fade', dur: 0.4 } });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  setStatus7('＋ Đã thêm bit "' + bit + '".', 'ok');
}

function t7FxSetTrans(id){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c){ setStatus7('Chọn một cảnh trước đã.', 'error'); return; }
  if (typeof t7SetClipTrans === 'function') t7SetClipTrans(c.id, id);
  else { c.trans = id; _t7PersistClips(); }
  t7RenderDetail(); t7RenderTimeline();
  setStatus7('⋈ Cảnh ' + c.sceneId + ' dùng chuyển cảnh "' + id + '".', 'ok');
}

function t7FxDrag(ev, kind, name){
  _t7Drag = { kind, name };
  // Kiểu MIME riêng để rãnh/khung từ chối được loại sai (học từ 'application/x-lab-tile').
  try {
    ev.dataTransfer.setData('application/x-nova-fx', JSON.stringify({ kind, name }));
    ev.dataTransfer.setData('text/plain', kind + ':' + name);
    ev.dataTransfer.effectAllowed = 'copy';
  } catch (e) {}
}

function t7GfxDragOver(ev){
  if (!_t7DragOk('layer')) return;         // không preventDefault → trình duyệt hiện dấu cấm
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  ev.currentTarget.classList.add('drop');
}

function t7GfxDragLeave(ev){ ev.currentTarget.classList.remove('drop'); }

function t7GfxDrop(ev){
  ev.preventDefault(); ev.currentTarget.classList.remove('drop');
  const d = _t7Drag; _t7Drag = null;
  if (!d) return;
  // Điểm thả → giây tuyệt đối → tìm cảnh chứa nó + giây TRONG cảnh.
  const r = ev.currentTarget.getBoundingClientRect();
  const sec = Math.max(0, (ev.clientX - r.left - 5 + ev.currentTarget.parentElement.scrollLeft) / (t7State.pps || 8));
  let acc = 0, target = null, local = 0;
  for (const c of _t7Clips()){
    const dd = _t7ClipDur(c);
    if (sec < acc + dd){ target = c; local = sec - acc; break; }
    acc += dd;
  }
  if (!target){ setStatus7('Thả ngoài vùng có cảnh.', 'error'); return; }
  t7State.selClip = target.id;
  const t = _t7FxTargetSpec(); if (!t) return;
  const at = +Math.max(0, Math.min(_t7ClipDur(target) - 0.2, local)).toFixed(2);
  t.sp.layers.push(d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x: 8, y: 12, w: 84, h: 72 }, at, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name, at });
  _t7GfxSel = target.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(`＋ Thả vào cảnh ${target.sceneId} tại ${at}s.`, 'ok');
}

function t7StageDragOver(ev){
  if (!_t7DragOk('layer')) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  const box = ev.currentTarget.getBoundingClientRect();
  const mk = document.getElementById('t7DropMark');
  if (mk){
    mk.style.display = 'block';
    mk.style.left = ((ev.clientX - box.left) / box.width * 100) + '%';
    mk.style.top = ((ev.clientY - box.top) / box.height * 100) + '%';
  }
  ev.currentTarget.classList.add('drop');
}

function t7StageDragLeave(ev){
  if (ev.currentTarget.contains(ev.relatedTarget)) return;
  ev.currentTarget.classList.remove('drop');
  const mk = document.getElementById('t7DropMark'); if (mk) mk.style.display = 'none';
}

function t7StageDrop(ev){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drop');
  const mk = document.getElementById('t7DropMark'); if (mk) mk.style.display = 'none';
  const d = _t7Drag; _t7Drag = null;
  if (!d) return;
  const t = _t7FxTargetSpec();
  if (!t){ setStatus7('Chọn một cảnh trước, hoặc kéo xuống rãnh Đồ hoạ.', 'error'); return; }
  const box = ev.currentTarget.getBoundingClientRect();
  const x = +Math.max(2, Math.min(98, (ev.clientX - box.left) / box.width * 100)).toFixed(1);
  const y = +Math.max(2, Math.min(98, (ev.clientY - box.top) / box.height * 100)).toFixed(1);
  // anchor:'center' để tâm lớp rơi đúng điểm thả, không phải góc trên trái.
  t.sp.layers.push(d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x, y, w: 60, h: 45, anchor: 'center' }, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name, x, y, box: { x, y, w: 60, align: 'center', anchor: 'center' } });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(`＋ Thả vào cảnh ${t.c.sceneId} tại ${x}% × ${y}%.`, 'ok');
}

function t7GfxJump(clipId, sceneId, i){
  t7State.selClip = clipId;
  _t7GfxSel = sceneId + ':' + i;
  t7RenderDetail(); t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
}

function t7TransJump(clipId){
  t7State.selClip = clipId; _t7GfxSel = null; _t7GlobSel = null;
  t7RenderDetail(); t7RenderTimeline();
  setStatus7('Chọn kiểu ở ô "Chuyển cảnh vào" bên phải — ' + ((_t7Trans || []).length) + ' kiểu.', 'ok');
}

function t7ToggleSnap(){
  t7State.snap = !(t7State.snap !== false);
  const el = document.getElementById('t7Snap');
  if (el) el.classList.toggle('on', t7State.snap !== false);
  setStatus7(t7State.snap !== false ? '🧲 Bám mốc: BẬT' : '🧲 Bám mốc: TẮT', 'ok');
}

function t7GfxCopy(){
  const c = _t7GfxCur(); if (!c) return;
  _t7Clip = JSON.parse(JSON.stringify(c.L));
  setStatus7('📋 Đã chép lớp "' + _t7GfxName(c.L) + '".', 'ok');
}

function t7GfxCut(){ const c = _t7GfxCur(); if (!c) return; t7GfxCopy(); t7GfxDel(c.idx); }

function t7GfxDup(){
  const c = _t7GfxCur(); if (!c) return;
  const n = JSON.parse(JSON.stringify(c.L));
  if (n.at != null) n.at = +(Number(n.at) + 0.3).toFixed(2);   // lệch chút cho khỏi trùng khít
  c.sp.layers.splice(c.idx + 1, 0, n);
  _t7GfxSel = c.sid + ':' + (c.idx + 1);
  _t7GfxTouch(c.sp);
  setStatus7('⧉ Đã nhân đôi lớp.', 'ok');
}

function t7GfxPaste(){
  if (!_t7Clip){ setStatus7('Chưa chép lớp nào.', 'error'); return; }
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push(JSON.parse(JSON.stringify(_t7Clip)));
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7('📥 Đã dán vào cảnh ' + t.c.sceneId + '.', 'ok');
}

function t7GfxPasteAll(){
  if (!_t7Clip){ setStatus7('Chưa chép lớp nào.', 'error'); return; }
  const clips = _t7Clips();
  if (!clips.length) return;
  if (!confirm(`Dán lớp "${_t7GfxName(_t7Clip)}" vào tất cả ${clips.length} cảnh?`)) return;
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let n = 0;
  clips.forEach(c => {
    let sp = state.sceneSpecs[c.sceneId];
    if (!sp) sp = state.sceneSpecs[c.sceneId] = { rev: Date.now(), layers: [
      { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } },
    ] };
    sp.layers.push(JSON.parse(JSON.stringify(_t7Clip)));
    sp.rev = Date.now(); n++;
  });
  if (typeof saveState === 'function') saveState(true);
  _t7OvKey = ''; t7RenderDetail(); t7RenderTimeline();
  setStatus7(`📥 Đã dán vào ${n} cảnh.`, 'ok');
}

function t7Focus(on){
  const b = document.body;
  const want = (on === undefined) ? !b.classList.contains('t7-focus') : !!on;
  b.classList.toggle('t7-focus', want);
  const inf = document.getElementById('t7FocusInfo');
  if (inf && want){
    const n = _t7Clips().length;
    let g = 0; Object.values(state.sceneSpecs || {}).forEach(sp => { g += (sp.layers || []).filter(L => L && L.type !== 'backdrop').length; });
    inf.textContent = `${n} cảnh · ${_t7Fmt(_t7Total())}` + (g ? ` · ${g} lớp đồ hoạ` : '');
  }
  try { window.scrollTo(0, 0); } catch (e) {}
  setTimeout(() => { try { t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); } catch (e) {} }, 60);
}

function t7GlobDragOver(ev){
  if (!_t7DragOk('layer')) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  ev.currentTarget.classList.add('drop');
}

function t7GlobDrop(ev){
  ev.preventDefault(); ev.currentTarget.classList.remove('drop');
  const d = _t7Drag; _t7Drag = null; if (!d) return;
  const r = ev.currentTarget.getBoundingClientRect();
  const start = +Math.max(0, _t7Snap((ev.clientX - r.left - 5 + (ev.currentTarget.parentElement.scrollLeft || 0)) / (t7State.pps || 8))).toFixed(2);
  const layer = d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x: 8, y: 12, w: 84, h: 72 }, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name };
  _t7Globs().push({ id: 'g' + Date.now() + Math.floor(Math.random() * 100), start, dur: 5, layer });
  _t7GlobSel = _t7Globs().length - 1; _t7GfxSel = null;
  _t7GlobTouch();
  setStatus7(`＋ Lớp toàn cục tại ${start}s (kéo mép để đổi độ dài).`, 'ok');
}

function t7GfxToGlobal(){
  const c = _t7GfxCur(); if (!c) return;
  const L = JSON.parse(JSON.stringify(c.L));
  delete L.at; delete L.until;
  _t7Globs().push({ id: 'g' + Date.now(), start: 0, dur: _t7Total(), layer: L });
  t7GfxDel(c.idx);
  _t7GlobSel = _t7Globs().length - 1;
  _t7GlobTouch();
  setStatus7('🌐 Đã chuyển thành lớp toàn cục, phủ cả video.', 'ok');
}

function t7GlobPick(i){ _t7GlobSel = (_t7GlobSel === i) ? null : i; _t7GfxSel = null; t7RenderDetail(); t7RenderTimeline(); }

function t7GlobDel(i){ _t7Globs().splice(i, 1); _t7GlobSel = null; _t7GlobTouch(); setStatus7('🗑 Đã gỡ lớp toàn cục.', 'ok'); }

function t7GfxPick(sceneId, i){
  const key = sceneId + ':' + i;
  _t7GfxSel = (_t7GfxSel === key) ? null : key;
  _t7GlobSel = null;
  t7RenderDetail();
}
