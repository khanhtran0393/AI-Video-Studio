/* T7 LAYERS — bảng thuộc tính lớp (t7L*), set/del/clear lớp đồ hoạ, dùng ảnh AI, smart clip
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7LSet(key, val){
  const r = _t7LRef(); if (!r) return;
  if (val === null || val === '') delete r.L[key]; else r.L[key] = val;
  r.touch();
}

function t7LNum(key, val, dflt){
  const n = parseFloat(val);
  t7LSet(key, (val === '' || !Number.isFinite(n) || n === dflt) ? null : n);
}

function t7LBox(key, val){
  const r = _t7LRef(); if (!r) return;
  const n = parseFloat(val);
  const blank = (val === '' || !Number.isFinite(n));
  if (r.L.template){
    if (blank) delete r.L[key]; else r.L[key] = n;
    // x và y đi thành cặp — thiếu một cái thì expandOne bỏ qua cả hai.
    if (key === 'x' && r.L.y == null && !blank) r.L.y = 50;
    if (key === 'y' && r.L.x == null && !blank) r.L.x = 50;
  } else {
    const b = Object.assign({}, r.L.box || {});
    if (blank) delete b[key]; else b[key] = n;
    r.L.box = b;
  }
  r.touch();
}

function t7LBoxSet(key, val){
  const r = _t7LRef(); if (!r) return;
  r.L.box = Object.assign({}, r.L.box || {}, { [key]: val }); r.touch();
}

function t7LStyle(id){
  const r = _t7LRef(); if (!r) return;
  const s = (_T7_STYLES || []).find(x => x.id === id); if (!s) return;
  r.L.in   = Object.assign({}, r.L.in   || {}, { preset: s.in,   dur: (r.L.in   && r.L.in.dur)   != null ? r.L.in.dur   : 0.45 });
  r.L.hold = Object.assign({}, r.L.hold || {}, { preset: s.hold, amp:  (r.L.hold && r.L.hold.amp) != null ? r.L.hold.amp : 1 });
  r.L.out  = Object.assign({}, r.L.out  || {}, { preset: s.out,  dur: (r.L.out  && r.L.out.dur)  != null ? r.L.out.dur  : 0.35 });
  r.touch();
}

function t7LAmp(v){
  const r = _t7LRef(); if (!r) return;
  const amp = Math.min(2, Math.max(0.25, Number(v) || 1));
  r.L.hold = Object.assign({}, r.L.hold || {}, { preset: (r.L.hold && r.L.hold.preset) || 'kenIn', amp });
  r.touch();
}

function t7LAnim(grp, val){
  const r = _t7LRef(); if (!r) return;
  r.L[grp] = Object.assign({}, r.L[grp] || {}, { preset: val });
  r.touch();
}

function t7LPickImg(key){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { t7LSet(key, String(rd.result || '')); if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview(); };
    rd.readAsDataURL(f);
  };
  inp.click();
}

function t7LPin(){
  const r = _t7LRef(); if (!r) return;
  if (_t7BoxRead(r.L, 'x') == null){ t7LBox('x', 50); t7LBox('y', 50); }
  _t7DrawSel();
  setStatus7('📌 Đã ghim lớp — giờ kéo thẳng trên khung xem trước được.', 'ok');
}

async function t7LPickVid(key){
  if (!window.native || typeof window.native.pickMediaFile !== 'function'){ setStatus7('Bản này chưa hỗ trợ chọn video.', 'error'); return; }
  const r = await window.native.pickMediaFile('video');
  if (!r || r.canceled) return;
  if (r.error){ setStatus7('Không mở được file: ' + r.error, 'error'); return; }
  t7LSet(key, r.path);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7('🎬 Đã gắn video vào lớp.', 'ok');
}

function t7LUseSceneImg(key){ t7LSet(key, '@scene'); setStatus7('🖼 Ô ảnh dùng ảnh của cảnh.', 'ok'); }

function t7LReset(){
  const r = _t7LRef(); if (!r) return;
  ['dx','dy','scale','rotate','opacity','x','y','w','h'].forEach(k => delete r.L[k]);
  if (!r.L.template) delete r.L.box;
  r.touch(); setStatus7('↺ Đã trả lớp về bố cục gốc của mẫu.', 'ok');
}

function t7GfxSet(idx, key, val){
  const sp = _t7GfxSpec(); if (!sp || !sp.layers[idx]) return;
  if (val === null) delete sp.layers[idx][key]; else sp.layers[idx][key] = val;
  _t7GfxTouch(sp);
}

function t7GfxDel(idx){
  const sp = _t7GfxSpec(); if (!sp) return;
  sp.layers.splice(idx, 1);
  _t7GfxSel = null;
  // Chỉ còn lớp nền → bỏ hẳn spec để cảnh về trạng thái mặc định.
  if (!sp.layers.some(L => L && L.type !== 'backdrop')){
    const sid = Object.keys(state.sceneSpecs || {}).find(k => state.sceneSpecs[k] === sp);
    if (sid) delete state.sceneSpecs[sid];
  }
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail(); if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  setStatus7('🗑 Đã gỡ lớp đồ hoạ.', 'ok');
}

function t7GfxClearScene(sceneId){
  if (!state.sceneSpecs || !state.sceneSpecs[sceneId]) return;
  delete state.sceneSpecs[sceneId];
  _t7GfxSel = null;
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail(); if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  setStatus7('🗑 Đã gỡ hết đồ hoạ của cảnh ' + sceneId + '.', 'ok');
}

function t7UseImage(id){ const c = t7State.clips.find(x => x.id === id); if (!c) return; try { if (state.mediaPicks) delete state.mediaPicks[c.sceneId]; } catch (_) {} c.useVideo = false; if (typeof _t7PersistClips === 'function') _t7PersistClips(); t7RenderDetail(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); setStatus7('🖼 Cảnh ' + c.sceneId + ' dùng ẢNH AI.', 'ok'); }

function t7SetClipFxChip(id, v){ t7SetClipFx(id, v); t7RenderDetail(); }

async function t7SmartClipScene(clipId){
  const c = t7State.clips.find(x => x.id === clipId); if (!c) return;
  if (!window.native || typeof window.native.smartClip !== 'function'){ setStatus7('⚠️ Chỉ chạy trong app Nova.', 'error'); return; }
  // Ô #t7SmartStatus_<id> vẫn được t7RenderDetail dựng, NHƯNG nó nằm trong cột chi
  // tiết — ở bố cục gọn cột đó là ngăn trượt đóng, nên báo vào đó là báo vào chỗ
  // khuất. Dùng dòng trạng thái dưới khung xem.
  if (!_t7SmartWired && typeof window.native.onSmartClipProgress === 'function'){
    _t7SmartWired = true;
    window.native.onSmartClipProgress(d => setStatus7(`🎬 ${d.percent || 0}% — ${d.message || ''}`, 'working'));
  }
  setStatus7('⏳ Dịch nội dung cảnh → tìm clip…', 'working');
  const r = await _t7DoSmartClip(c, { vision: true });
  if (!r.ok){ setStatus7('❌ ' + (r.error || 'Lỗi'), 'error'); return; }
  if (typeof t7RenderSceneList === 'function') t7RenderSceneList();
  if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  // Nói rõ CÓ kiểm nội dung hay không, và kiểm xong thấy gì.
  const src = String(r.source || '');
  const chk = src.includes('+vision') ? ' · đã soi frame né mặt/chữ' : '';
  const warn = src.includes('?') ? ' ⚠️ vision thấy clip LẠC ĐỀ nhưng hết clip để thử — nên đổi tay' : '';
  setStatus7(`✅ Đã gắn clip · tìm bằng "${r.query || ''}"${chk}${warn}`, warn ? 'error' : 'ok');
}
