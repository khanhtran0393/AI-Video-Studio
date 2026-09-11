/* T7 — Nova timeline/editor: _t7* (clips, layers, AI edit, export, rails) + quản lý video
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _t7FileToDataUrl(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

async function _t7UrlToDataUrl(url){ const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const b = await r.blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); }

function _t7Scenes(){ return Array.isArray(state.scenes) ? state.scenes : []; }

function _t7SceneById(id){ return _t7Scenes().find(s => s.id === id) || null; }

function _t7ImgVar(sceneId, variant){ const m = state[variant === 'B' ? 'sceneImagesB' : 'sceneImages']; return (m && m[sceneId] && m[sceneId].base64) || null; }

function _t7SceneHasA(id){ return !!_t7ImgVar(id, 'A'); }

function _t7SceneHasB(id){ return !!_t7ImgVar(id, 'B'); }

function _t7SceneHasBPrompt(id){ try { const p = state.scenePrompts2 && state.scenePrompts2[id]; return !!(p && String(p).trim()); } catch (e){ return false; } }

function _t7SceneWantsAB(id){ return _t7SceneHasBPrompt(id) || (_t7SceneHasA(id) && _t7SceneHasB(id)); }

function _t7SceneDur(s){ const d = parseFloat(s && s.duration); return (!isNaN(d) && d > 0) ? d : 3; }

function _t7Fmt(t){ t = Math.max(0, Math.round(t)); const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'); }

function _t7NewId(){ return 'c' + (++t7State._seq); }

function _t7EnsureUniqueIds(clips){
  for (const c of clips){ const m = c && /^c(\d+)$/.exec(c.id); if (m) t7State._seq = Math.max(t7State._seq, +m[1]); }  // đẩy _seq qua id lớn nhất
  const seen = new Set();
  for (const c of clips){ if (!c) continue; if (!c.id || seen.has(c.id)) c.id = _t7NewId(); seen.add(c.id); }           // id trùng/thiếu → cấp id mới (không đụng id cũ)
  return clips;
}

function _t7Clips(){ return t7State.clips; }

function _t7ClipDur(c){ const d = parseFloat(c && c.dur); return (!isNaN(d) && d > 0) ? d : 0.3; }

function _t7ClipScene(c){ return _t7SceneById(c && c.sceneId); }

function _t7MediaById(id){ return (t7State.media || []).find(m => m.id === id) || null; }   // Thư viện nhập

function _t7ClipImg(c){ if (c && c.imported){ const m = _t7MediaById(c.mediaId); return (m && m.kind === 'image') ? m.dataUrl : null; } if (c && !c.imported){ const pk = state.mediaPicks && state.mediaPicks[c.sceneId]; if (pk && pk.kind === 'image' && pk.downloadUrl) return pk.downloadUrl; } return _t7ImgVar(c && c.sceneId, (c && c.variant) || 'A'); }

function _t7ThumbImg(c){
  try {
    if (c && !c.imported && _t7UsesVideo(c)){
      const pk = state.mediaPicks && state.mediaPicks[c.sceneId];
      if (pk && pk.kind === 'video'){
        const t = _stockThumb(pk);
        if (t) return t;
        // Clip YouTube: pick chỉ giữ file đã cắt (base64), ảnh nằm ở ứng viên → dò theo link gốc.
        const src = ((state.clipSrc || {})[c.sceneId] || {}).url || '';
        const id = (typeof _t7YtId === 'function') ? _t7YtId(src) : '';
        const cand = ((state.ytCandidates || {})[c.sceneId] || []).find(x => x && x.url && (x.url === src
          || (id && typeof _t7YtId === 'function' && _t7YtId(x.url) === id)));
        if (cand && (cand.thumbnail || cand.thumb)) return cand.thumbnail || cand.thumb;
      }
    }
  } catch (e) { /* */ }
  return _t7ClipImg(c);
}

function _t7ClipText(c){ if (c && c.imported) return c.name || ''; const s = _t7ClipScene(c); return (s && s.text) || ''; }

function _t7ClipLabel(c){ return (c && c.imported) ? (c.name || 'Media nhập') : ('Cảnh ' + (c && c.sceneId)); }

function _t7StockVid(c){ try { const pk = c && !c.imported && state.mediaPicks && state.mediaPicks[c.sceneId]; return (pk && pk.kind === 'video' && pk.downloadUrl) ? pk.downloadUrl : null; } catch (e){ return null; } }

function _t7HasVideo(c){ try { if (c && c.imported){ const m = _t7MediaById(c.mediaId); return !!(m && m.kind === 'video'); } if (_t7StockVid(c)) return true; return !!(c && typeof mvVideoBlobs === 'object' && mvVideoBlobs[c.sceneId] && mvVideoBlobs[c.sceneId].b64); } catch (e){ return false; } }

function _t7ClipVideoUrl(c){ if (c && c.imported){ const m = _t7MediaById(c.mediaId); return (m && m.kind === 'video') ? m.dataUrl : null; } const sv = _t7StockVid(c); if (sv) return sv; if (!_t7HasVideo(c)) return null; const v = mvVideoBlobs[c.sceneId]; return `data:${v.mime || 'video/mp4'};base64,${v.b64}`; }

function _t7UsesVideo(c){ if (c && c.imported) return _t7HasVideo(c); if (_t7StockVid(c)) return true; return !!(c && c.useVideo && _t7HasVideo(c)); }

function _t7VidKind(c){
  try {
    if (c && !c.imported){
      const pk = state.mediaPicks && state.mediaPicks[c.sceneId];
      if (pk && pk.kind === 'video'){
        const s = String(pk.source || '');
        if (/pexels|stock|coverr|pixabay/i.test(s)) return 'Clip stock';
        if (/yt|youtube/i.test(s)) return 'Clip YouTube';
        return 'Clip';
      }
    }
    if (c && c.imported){ const m = _t7MediaById(c.mediaId); if (m && m.kind === 'video') return 'Video nhập'; }
  } catch (_) {}
  return 'Video Veo';   // mvVideoBlobs = video Veo (AI motion)
}

function _t7VideoDuration(url){ return new Promise((res) => { try { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = url; } catch (e){ res(0); } }); }

function _t7Total(){ return _t7Clips().reduce((a, c) => a + _t7ClipDur(c), 0); }

function _t7CoverAudio(){
  try {
    const aud = +t7State.audioDur || 0; const clips = t7State.clips || [];
    if (!(aud > 0.3) || !clips.length) return;
    const gap = aud - _t7Total();
    if (gap > 0.3){ const last = clips[clips.length - 1]; if (last && !last.imported) last.dur = +(_t7ClipDur(last) + gap).toFixed(2); }
  } catch (e) {}
}

function _t7ClipStart(i){ let t = 0; for (let k = 0; k < i; k++) t += _t7ClipDur(t7State.clips[k]); return t; }

function _t7ClipAt(time){ let acc = 0; const cl = t7State.clips; for (let i = 0; i < cl.length; i++){ acc += _t7ClipDur(cl[i]); if (time < acc) return { clip: cl[i], index: i }; } const i = cl.length - 1; return i >= 0 ? { clip: cl[i], index: i } : null; }

function _t7Doc(){ try { const p = getProfile(); const v = p && getCurrentVideo(p); return v ? v.workData : null; } catch (e){ return null; } }

function _t7PersistClips(){ const wd = _t7Doc(); if (wd){ wd.editClips = t7State.clips.map(c => ({ id: c.id, sceneId: c.sceneId, variant: c.variant || 'A', dur: c.dur, fx: c.fx || 'none', trans: c.trans || 'none', transDur: c.transDur || 0.5, useVideo: !!c.useVideo, vidDur: c.vidDur || 0, scale: c.scale || 1, imported: !!c.imported, mediaId: c.mediaId || null, kind: c.kind || null, name: c.name || null })); wd.overlays = (t7State.overlays || []).map(o => ({ id: o.id, dataUrl: o.dataUrl, name: o.name || '', start: o.start || 0, dur: o.dur || 3 })); wd.media = (t7State.media || []).map(m => ({ id: m.id, kind: m.kind, name: m.name || '', dataUrl: m.dataUrl, dur: m.dur || 0 })); try { if (typeof saveState === 'function') saveState(true); } catch (e) {} }
  try { if (typeof t7RemotionRefresh === 'function') t7RemotionRefresh(); } catch (e) {}   // đổi fx/thời lượng/thứ tự → nạp lại composition cho bản xem trước Remotion
}

function _t7FxFromScene(s){
  const VALID = ['zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','none'];
  const REMAP = { punch: 'zoom-in', static: 'none' };
  let fx = (s && s.motion) ? String(s.motion).trim() : '';
  fx = REMAP[fx] || fx;
  if (VALID.includes(fx)) return fx;
  const shot = s && s.shot;
  return shot === 'establishing' ? 'pan-right' : shot === 'b-roll' ? 'pan-left' : 'zoom-in';
}

function _t7AutoBuild(){
  const wd0 = _t7Doc();
  // nạp lại Lớp trên (overlay) từ workData nếu phiên chưa có
  if (wd0 && Array.isArray(wd0.overlays) && !(t7State.overlays || []).length) t7State.overlays = wd0.overlays.map(o => ({ id: o.id || _t7NewId(), dataUrl: o.dataUrl, name: o.name || 'Ảnh đè', start: +o.start || 0, dur: +o.dur || 3 }));
  // nạp lại Thư viện media
  if (wd0 && Array.isArray(wd0.media) && !(t7State.media || []).length) t7State.media = wd0.media.map(m => ({ id: m.id || _t7NewId(), kind: m.kind, name: m.name || '', dataUrl: m.dataUrl, dur: +m.dur || 0 }));
  const _sceneHasVid = (id) => { try { return !!(typeof mvVideoBlobs === 'object' && mvVideoBlobs[id] && mvVideoBlobs[id].b64); } catch (e){ return false; } };
  // Tạo clip MỚI từ 1 cảnh (chỉ dùng cho cảnh CHƯA có clip nào).
  const mk = (s, variant, dur) => {
    const hasImg = _t7SceneHasA(s.id) || _t7SceneHasB(s.id), hasVid = _sceneHasVid(s.id);
    const useVid = (hasVid && !hasImg);
    return { id: _t7NewId(), sceneId: s.id, variant, dur: Math.max(0.3, +(+dur).toFixed(2)),
      fx: useVid ? 'none' : _t7FxFromScene(s), trans: "none", transDur: 0.5, useVideo: useVid, vidDur: 0, scale: 1 };
  };
  const _addSceneClips = (arr, s) => {
    // LUÔN thêm mọi cảnh Tool 2 (kể cả CHƯA có ảnh → clip placeholder khung trống + số cảnh + thời lượng).
    // Cấu trúc A/B bám Tool 2 (Prompt B) chứ không bám ảnh → không lệch khi ảnh chưa tạo xong.
    const dur = _t7SceneDur(s);
    if (_t7SceneWantsAB(s.id)){ const h = dur / 2; arr.push(mk(s, 'A', h)); arr.push(mk(s, 'B', dur - h)); }
    else arr.push(mk(s, (_t7SceneHasB(s.id) && !_t7SceneHasA(s.id)) ? 'B' : 'A', dur));
  };
  const scenes = _t7Scenes();
  const sceneIds = new Set(scenes.map(s => s.id));
  const mediaIds = new Set((t7State.media || []).map(m => m.id));
  // Nguồn clip ĐÃ CHỈNH: ưu tiên phiên hiện tại, else editClips đã lưu trong workData.
  const savedClips = (t7State.clips && t7State.clips.length) ? t7State.clips
    : ((wd0 && Array.isArray(wd0.editClips)) ? wd0.editClips : []);
  // Mẫu do AI thiết kế cho từng cảnh (engine Nova Scene) — nạp lại theo video đang mở.
  if (!state.sceneSpecs || !Object.keys(state.sceneSpecs).length) state.sceneSpecs = (wd0 && wd0.sceneSpecs) || {};
  if (!Array.isArray(state.globalGfx) || !state.globalGfx.length) state.globalGfx = (wd0 && wd0.globalGfx) || [];
  if (!state.clipSrc || !Object.keys(state.clipSrc).length) state.clipSrc = (wd0 && wd0.clipSrc) || {};
  // Đẩy _seq qua id lớn nhất đã lưu TRƯỚC khi tách A/B → id clip mới không trùng id cũ (phiên trước).
  for (const c of savedClips){ const m = c && /^c(\d+)$/.exec(c.id); if (m) t7State._seq = Math.max(t7State._seq, +m[1]); }

  if (savedClips.length){
    // 🔒 GIỮ NGUYÊN chỉnh sửa (tách/nhân đôi/trim/sắp xếp/hiệu ứng): chỉ BỎ clip mà cảnh/media không còn,
    //    và THÊM cảnh MỚI (chưa có clip nào phủ) vào cuối. KHÔNG dựng lại từ đầu (mất edit).
    const kept = []; const covered = new Set();
    for (const c of savedClips){
      if (c.imported){ if (c.mediaId && mediaIds.has(c.mediaId)) kept.push({ ...c, id: c.id || _t7NewId() }); continue; }
      if (sceneIds.has(c.sceneId)){ kept.push({ ...c, id: c.id || _t7NewId() }); covered.add(c.sceneId); }
    }
    // Cảnh mới có ảnh (vd cảnh vừa tạo lại) → CHÈN ĐÚNG VỊ TRÍ theo thứ tự cảnh, KHÔNG dồn xuống cuối.
    const sceneOrder = new Map(scenes.map((s, i) => [s.id, i]));
    for (const s of scenes){
      if (covered.has(s.id)) continue;
      const news = []; _addSceneClips(news, s);
      if (!news.length) continue;
      const myOrder = sceneOrder.get(s.id);
      let at = kept.length;
      for (let i = 0; i < kept.length; i++){ const kc = kept[i]; if (kc.imported) continue; const ko = sceneOrder.get(kc.sceneId); if (ko != null && ko > myOrder){ at = i; break; } }
      kept.splice(at, 0, ...news); covered.add(s.id);
    }
    // 🔧 ĐỒNG BỘ CẤU TRÚC A/B theo Phân Cảnh (Tool 2): cảnh vừa được THÊM ảnh B sau khi timeline đã dựng
    //    (thêm Prompt B cho cảnh dài rồi tạo lại) → timeline còn 1 clip A cũ, phải tách thành A+B; ngược lại cảnh
    //    MẤT B → gộp về 1 clip. CHỈ áp cho cảnh ở dạng "tự động" (1 clip, hoặc đúng 1 A + 1 B); cảnh bạn TÁCH TAY
    //    (nhiều clip / trùng biến thể) thì GIỮ NGUYÊN. → ảnh ở Dựng Video luôn khớp Phân Cảnh, hết cảnh bị kéo dài.
    {
      const _g = {};
      for (const c of kept){ if (!c.imported && c.sceneId){ (_g[c.sceneId] = _g[c.sceneId] || []).push(c); } }
      for (const s of scenes){
        const arr = _g[s.id]; if (!arr || !arr.length) continue;
        const wantAB = _t7SceneWantsAB(s.id);   // cần A+B theo Tool 2 (Prompt B) — không phụ thuộc đã có ảnh chưa
        const vars = arr.map(c => c.variant || 'A');
        const isSingle = arr.length === 1;
        const isAB = arr.length === 2 && vars.includes('A') && vars.includes('B');
        if (!isSingle && !isAB) continue;                 // tách tay → giữ nguyên
        const sd = _t7SceneDur(s);
        if (wantAB && isSingle){                           // cảnh vừa có thêm ảnh B → tách A+B (giữ fx/chuyển cảnh)
          const base = arr[0]; const idx = kept.indexOf(base); if (idx < 0) continue;
          const h = +(sd / 2).toFixed(2);
          const mkc = (variant, d) => ({ ...base, id: _t7NewId(), variant, dur: d, useVideo: false });
          kept.splice(idx, 1, mkc('A', h), mkc('B', +(sd - h).toFixed(2)));
        } else if (!wantAB && isAB){                       // cảnh mất ảnh B → gộp về 1 clip
          const keepVar = (_t7SceneHasA(s.id) || !_t7SceneHasB(s.id)) ? 'A' : 'B';
          const keepC = arr.find(c => (c.variant || 'A') === keepVar) || arr[0];
          const dropC = arr.find(c => c !== keepC);
          keepC.variant = keepVar; keepC.dur = +(+sd).toFixed(2);
          const di = kept.indexOf(dropC); if (di >= 0) kept.splice(di, 1);
        }
      }
    }
    // 🔄 KHỚP THỜI LƯỢNG theo Phân Cảnh ("thời lượng luôn lấy từ Tool 2"): cảnh 1 clip → = độ dài cảnh; cảnh A+B → chia đôi.
    //    Cảnh bị TÁCH TAY (nhiều clip cùng biến thể) thì GIỮ NGUYÊN edit. → tổng Dựng Video = tổng Phân Cảnh, hết lệch/dư đuôi audio.
    const _byScene = {};
    for (const c of kept){ if (!c.imported && c.sceneId){ (_byScene[c.sceneId] = _byScene[c.sceneId] || []).push(c); } }
    for (const sid in _byScene){
      const arr = _byScene[sid]; const s = _t7SceneById(sid); if (!s) continue; const sd = _t7SceneDur(s);
      if (arr.length === 1){ arr[0].dur = +(+sd).toFixed(2); }
      else if (arr.length === 2 && arr.some(c => (c.variant || 'A') === 'A') && arr.some(c => (c.variant || 'A') === 'B')){ const h = +(sd / 2).toFixed(2); arr.forEach(c => { c.dur = (c.variant === 'B') ? +(sd - h).toFixed(2) : h; }); }
      // else: cảnh bị tách tay (nhiều clip cùng biến thể) → giữ nguyên
    }
    t7State.clips = _t7EnsureUniqueIds(kept);
    return;
  }
  // Chưa có clip nào → dựng mới toàn bộ từ Phân Cảnh.
  const clips = [];
  for (const s of scenes) _addSceneClips(clips, s);
  const importedClips = (wd0 && Array.isArray(wd0.editClips)) ? wd0.editClips.filter(c => c && c.imported) : [];
  for (const c of importedClips){ if (c.mediaId && mediaIds.has(c.mediaId)) clips.push({ ...c, id: c.id || _t7NewId() }); }
  t7State.clips = _t7EnsureUniqueIds(clips);
}

function _t7Clone(){ return t7State.clips.map(c => ({ ...c })); }

/* Ghim bề ngang KHUNG XEM là số chắc. Chromium co dần một box có aspect-ratio +
   width:auto về min-content (preview chỉ còn ~21×12px, thanh điều khiển trồi lên
   trên bị header đè → bấm không ăn). Với width giải được (100% hoặc px) thì
   aspect-ratio suy ra chiều cao bình thường; khung dọc (9:16) phải tự hẹp lại cho
   vừa mốc chiều cao thì tỉ lệ khung mới không vỡ (lớp khung an toàn đi theo box). */
_t7SyncColHeight._pinW = function(player, stage, moc){
  try {
    const asp = String((document.getElementById('t7Aspect') || {}).value || '16:9').split(':');
    const aw = +asp[0] || 16, ah = +asp[1] || 9;
    const availW = Math.max(120, stage.clientWidth - 28);   // .t7-player margin 14px mỗi bên
    player.style.width = Math.min(availW, Math.round(moc * aw / ah)) + 'px';
  } catch (e) { player.style.width = ''; }
};

function _t7SyncColHeight(){
  if (_t7SyncColHeight._busy) return;               // ResizeObserver bắt lại chính cú sửa của mình
  try {
    const grid = document.querySelector('#tool-tool7 .t7-grid'); if (!grid) return;
    const secs = grid.querySelectorAll(':scope > section');
    const bin = secs[0], stage = secs[1]; if (!bin || !stage) return;
    if (!document.body.classList.contains('t7-lean')){ bin.style.height = ''; return; }
    _t7SyncColHeight._busy = 1;
    // ĐO HAI BƯỚC. Hai cột nằm chung một hàng và đều bị giãn cho bằng hàng, nên đo
    // thẳng cột xem trước chỉ ra lại đúng cái chiều cao đã bị 192 cảnh thổi lên.
    // Rút cột cảnh về 0 trước → hàng co lại đúng bằng NỘI DUNG cột xem trước → đo → ghim.
    bin.style.height = '0px';
    void bin.offsetHeight;                          // ép tính lại ngay, không đợi frame sau
    // Chặn chiều cao KHUNG XEM cho cả cột vừa đúng vùng nhìn thấy. Khung 9:16 cao gấp
    // đôi 16:9, không chặn thì cả trang dài ra và lại thừa một mảng trắng dưới đáy.
    const player = document.getElementById('t7Player');
    if (player){
      const conLai = window.innerHeight - (grid.getBoundingClientRect().top + window.scrollY) - 14;
      const ngoaiKhung = Math.round(stage.getBoundingClientRect().height) - Math.round(player.getBoundingClientRect().height);
      _t7SyncColHeight._moc = Math.max(220, Math.round(conLai - ngoaiKhung));   // mốc tuyệt đối, không cộng dồn
      player.style.maxHeight = _t7SyncColHeight._moc + 'px';
      _t7SyncColHeight._pinW(player, stage, _t7SyncColHeight._moc);
      void player.offsetHeight;
    }
    let h = Math.round(stage.getBoundingClientRect().height);
    // Lưới an toàn CSS phải nới theo, không thì nó cắt cột cảnh thấp hơn cột xem trước.
    document.body.style.setProperty('--t7-col-h', h + 'px');
    bin.style.height = (h > 260) ? (h + 'px') : '';  // khung xem chưa dựng xong thì để nguyên
    // Còn tràn (lề/đệm dưới lưới mà phép tính ở trên không thấy) → bớt đúng phần dư, một lần.
    const du = document.documentElement.scrollHeight - window.innerHeight;
    if (du > 2 && player && _t7SyncColHeight._moc){
      const moc2 = Math.max(220, _t7SyncColHeight._moc - du);
      player.style.maxHeight = moc2 + 'px';
      _t7SyncColHeight._pinW(player, stage, moc2);
      void player.offsetHeight;
      bin.style.height = '0px'; void bin.offsetHeight;
      h = Math.round(stage.getBoundingClientRect().height);
      document.body.style.setProperty('--t7-col-h', h + 'px');
      bin.style.height = (h > 260) ? (h + 'px') : '';
    }
  } catch (e) { /* */ }
  finally { _t7SyncColHeight._busy = 0; }
}

function _t7HookColSync(){
  if (_t7HookColSync._on) { _t7SyncColHeight(); return; }
  const grid = document.querySelector('#tool-tool7 .t7-grid'); if (!grid) return;
  const stage = grid.querySelectorAll(':scope > section')[1]; if (!stage) return;
  _t7HookColSync._on = 1;
  try { new ResizeObserver(() => _t7SyncColHeight()).observe(stage); } catch (e) {}
  window.addEventListener('resize', _t7SyncColHeight);
  _t7SyncColHeight();
}

function _t7NotifyImage(sceneId){
  try {
    if (typeof t7State !== 'object' || !t7State || !(t7State.clips || []).length) return;
    if (state.tool !== 'tool7') return;   // không mở Dựng Video → sẽ tự đấu khi vào tab (t7Build)
    const box = document.getElementById('t7Rows'); const rows = box ? box.querySelectorAll('.t7-srow') : [];
    t7State.clips.forEach((c, i) => {
      if (c.imported || c.sceneId !== sceneId) return;
      const img = _t7ThumbImg(c); if (!img) return;
      const el = rows[i] && rows[i].querySelector('img.t7-thumb'); if (el) el.src = img;   // thay thumbnail tại chỗ
    });
    if (!t7State.playing) t7RenderPreview();
    if (typeof _t7TimelineRaf === 'function') _t7TimelineRaf();
  } catch (e) {}
}

function _t7Mmss(s){ s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }

function _t7RailCount(k){
  try {
    if (k === 'scenes') return (t7State.clips || []).length;
    if (k === 'media')  return (t7State.media || []).length;
    if (k === 'trans')  return (_t7Trans || []).length;
    if (k === 'motion') return (_t7Cat || []).length + (_t7Bits || []).length;
    if (k === 'text')   return (_t7Cat || []).filter(_t7IsTextTpl).length;
    if (k === 'audio')  return (_t7Sfx || []).length;
    if (k === 'subs')   return Object.keys(typeof T7_SUBSTYLES === 'object' ? T7_SUBSTYLES : {}).length;
  } catch (_) {}
  return 0;
}

async function _t7RailAudio(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  if (!_t7Sfx){
    if (_t7SfxCache) _t7Sfx = _t7SfxCache;                       // hộp SFX đã tải rồi thì dùng lại
    else if (window.native && typeof window.native.sfxLibrary === 'function'){
      try { const r = await window.native.sfxLibrary(); _t7Sfx = _t7SfxCache = (r && r.items) || []; } catch (_) { _t7Sfx = []; }
    }
  }
  if (!_t7Sfx) _t7Sfx = [];
  t7RenderRail();
  const list = _t7Sfx.filter(x => !_t7RailQ || String(x.name || x.id || x).toLowerCase().includes(_t7RailQ));
  box.innerHTML = `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để chèn tại vạch phát (${(t7State.playT||0).toFixed(1)}s).</div>` +
    (list.length ? list.map(x => {
      const id = String(x.id || x.file || x.name || x), nm = String(x.nameVi || x.name || id);
      return `<div class="t7-fxi" onclick="t7SfxLibAdd('${escapeHtml(id)}')" title="${escapeHtml(nm)}"><b>🔊 ${escapeHtml(nm)}</b><s>${x.durationSec ? x.durationSec.toFixed(1) + 's' : ''}</s></div>`;
    }).join('') : '<div class="t7-dim" style="font-size:11.5px">Chưa có hiệu ứng âm thanh nào.</div>') +
    `<button class="btn ghost sm" style="width:100%;margin-top:8px;justify-content:center" onclick="t7SfxLibOpen()">📂 Mở kho đầy đủ</button>`;
}

function _t7RailSubs(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  box.innerHTML = `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Kiểu chữ khi burn phụ đề vào video.</div>
    <div id="t7SubStyleChipsRail" style="display:flex;gap:7px;flex-wrap:wrap"></div>
    <label class="t7-mlab" style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
      <input type="checkbox" id="t7SubsRailOn" style="accent-color:var(--accent);width:15px;height:15px"
             onchange="(function(v){const e=document.getElementById('t7ExpSubs');if(e){e.checked=v;} if(typeof t7RenderPreview==='function'&&!t7State.playing)t7RenderPreview();})(this.checked)">
      Ghi phụ đề vào video khi xuất
    </label>`;
  const on = document.getElementById('t7ExpSubs'); const cb = document.getElementById('t7SubsRailOn');
  if (on && cb) cb.checked = !!on.checked;
  // Dùng lại đúng bộ chip của hộp Xuất — một nguồn sự thật, không dựng bản thứ hai.
  try { const src = document.getElementById('t7SubStyleChips'); const dst = document.getElementById('t7SubStyleChipsRail');
    if (typeof t7RenderSubStyleChips === 'function') t7RenderSubStyleChips();
    if (src && dst) dst.innerHTML = src.innerHTML; } catch (_) {}
}

function _t7RailAi(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  const B = (fn, ic, t, d) => `<div class="t7-fxi" style="align-items:flex-start;padding:9px 10px" onclick="${fn}">
    <b style="display:block">${ic} ${t}</b><s style="display:block;white-space:normal;line-height:1.35;margin-top:2px">${d}</s></div>`;
  box.innerHTML =
    B('t7AiDesign()', '🎬', 'AI dựng đồ hoạ', 'Đọc lời từng cảnh rồi tự gắn mẫu chuyển động — chỉ chọn trong kho có sẵn.') +
    B('t7AiDesignClearAsk()', '🧹', 'Gỡ hết đồ hoạ AI', 'Trả mọi cảnh về video trơn — bỏ chữ nhấn, lower-third, hạt phim…') +
    B('t7TranslateAll()', '🌐', 'Dịch tiếng Việt', 'Dịch lời thoại mọi cảnh để soát — không ghi vào video.') +
    B('t7Build()', '↻', 'Đồng bộ từ Phân Cảnh', 'Nạp lại toàn bộ cảnh, ảnh và lời thoại từ tab Phân Cảnh.') +
    B('t7OpenExport()', '⬆', 'Xuất Video', 'Mở hộp thoại xuất — chọn độ phân giải, phụ đề, GPU.');
}

function _t7MediaKind(type){ if (/^image\//.test(type)) return 'image'; if (/^video\//.test(type)) return 'video'; if (/^audio\//.test(type)) return 'audio'; return null; }

function _t7MediaDuration(dataUrl, kind){
  return new Promise((res) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata'; el.onloadedmetadata = () => res(el.duration || 0); el.onerror = () => res(0);
    try { el.src = dataUrl; } catch (e){ res(0); } setTimeout(() => res(el.duration || 0), 4000);
  });
}

function _t7SelectAdjacent(dir){
  const clips = _t7Clips(); if (!clips.length) return;
  let idx = clips.findIndex(c => c.id === t7State.selClip);
  idx = (idx < 0) ? 0 : Math.max(0, Math.min(clips.length - 1, idx + dir));
  t7SelectClip(clips[idx].id);
}

function _t7CandList(c){
  const yt = ((state.ytCandidates || {})[c.sceneId] || []).map(x => Object.assign({ _k: 'yt' }, x));
  const st = ((state.stockCandidates || {})[c.sceneId] || []).map(x => Object.assign({ _k: 'st' }, x));
  const all = yt.concat(st);
  const esc = escapeHtml;
  if (!all.length){
    return `<div class="t7-dim" style="font-size:11.5px;line-height:1.55;padding:14px 2px">
      Chưa có clip nào để chọn. Bấm <b style="color:var(--text)">🎬 YouTube</b> hoặc
      <b style="color:var(--text)">🔍 Stock</b> ở trên để tìm — tìm xong danh sách hiện ngay đây.</div>`;
  }
  const cur = (state.mediaPicks || {})[c.sceneId] || {};
  const rows = all.map((x, i) => {
    const on = cur.downloadUrl && (x.url === cur.downloadUrl || x.downloadUrl === cur.downloadUrl);
    const idx = x._k === 'yt' ? i : (i - yt.length);
    const fn = x._k === 'yt' ? `t7PickYt('${c.sceneId}',${idx})` : `t2PickStock('${c.sceneId}',${idx})`;
    return `<button class="t7-cand${on ? ' on' : ''}" onclick="${fn}" title="${esc(x.title || '')}">
      <span class="th" style="background-image:url('${esc(x.thumbnail || '')}')"></span>
      <span class="tx"><b>${esc((x.title || '(không tên)').slice(0, 52))}</b>
        <s>${x.durationSec ? Math.round(x.durationSec) + 's · ' : ''}${esc(x._k === 'yt' ? 'YouTube' : (x.source || 'stock'))}</s></span>
      ${on ? '<span class="ok">✓</span>' : ''}</button>`;
  }).join('');
  return `<div class="t7-dim" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin:12px 0 7px">
      Chọn clip khác · ${all.length}</div><div class="t7-candlist">${rows}</div>`;
}

function _t7GfxLayers(sceneId){
  const sp = (state.sceneSpecs || {})[sceneId];
  const arr = (sp && Array.isArray(sp.layers)) ? sp.layers : [];
  return arr.map((L, i) => ({ L, i })).filter(x => x.L && x.L.type !== 'backdrop');
}

function _t7GfxKind(L){
  if (L.type === 'bit') return 'bit';
  if (!L.template) return 'man';                              // tự thêm bằng tay
  if (/^md-/.test(L.template)) return 'md';                   // mẫu dựng lại từ motion template
  if (/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in/.test(L.template)) return 'ov';  // lớp phủ không khí
  if (/progress|highlight|circle|sliding/.test(L.template)) return 'sh';                                      // hình khối
  return 'tx';                                                // còn lại là chữ
}

function _t7GfxName(L){
  if (L.template){
    const c = (_t7Cat || []).find(x => x.template === L.template);
    return (c && c.label) || L.template;
  }
  if (L.type === 'text') return 'Chữ: ' + String(L.text || '').slice(0, 18);
  if (L.type === 'bit') return 'Bit: ' + String(L.bit || '');
  return L.type || 'lớp';
}

function _t7LayerPanel(L, ctx){
  const cat = (_t7Cat || []).find(x => x.template === L.template);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));
  const lb = (t, extra) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700;display:flex;justify-content:space-between"><span>${t}</span><span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-dim)">${extra || ''}</span></div>`;
  // Ô ảnh: nút chọn file thay vì bắt gõ data URL. Ô còn lại là ô chữ thường.
  const IMGK = /^(src|image|img|photo|logo|thumb)$/i;
  const fld = (k, v) => IMGK.test(k)
    ? `<div style="display:flex;gap:6px;align-items:center">
         <div class="t7-mfield" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:7px 9px">${v === '@scene' ? '🖼 ảnh của cảnh' : (v ? (String(v).startsWith('data:') ? '🖼 ảnh đã chọn' : (_t7IsVid(v) ? '🎬 ' + esc(String(v).split(/[\\/]/).pop()) : esc(String(v).slice(0, 40)))) : '— chưa có ảnh/video —')}</div>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickImg('${k}')" title="Ảnh — nhúng thẳng vào dự án">🖼 Ảnh</button>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickVid('${k}')" title="Video — lưu đường dẫn, lúc xuất tự chép vào bản dựng">🎬 Video</button>
         ${ctx.scene ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px" title="Dùng chính ảnh của cảnh này" onclick="t7LUseSceneImg('${k}')">🖼</button>` : ''}
         ${v ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px;color:var(--red)" onclick="t7LSet('${k}','')">✕</button>` : ''}
       </div>`
    : `<input class="t7-mfield" style="width:100%" value="${esc(v)}" onchange="t7LSet('${k}',this.value)">`;

  // Ô nội dung: đúng những trường mẫu khai, bỏ các trường màu (đưa xuống nhóm Màu).
  const COLORK = /^(bg|ink|color|color2|track|mark|fill)$/;
  const params = (cat && cat.params) || Object.keys(L).filter(k => !/^(template|type|at|until|z|id|in|out|hold|box|style|dx|dy|scale|rotate|opacity)$/.test(k));
  const content = params.filter(k => !COLORK.test(k)).map(k => lb(k) + fld(k, L[k])).join('');
  const colors = params.filter(k => COLORK.test(k));

  const chip = (grp, val, label, cur) =>
    `<span class="t7-cchip${cur === val ? ' on' : ''}" onclick="t7LAnim('${grp}','${val}')">${label}</span>`;
  const IN = [['fade','mờ dần'],['rise','dâng lên'],['drop','rơi xuống'],['slideL','trượt trái'],['slideR','trượt phải'],['pop','bật'],['defocus','nhoè'],['wipeL','quét ngang'],['zoom','phóng vào'],['deal','chia bài'],['none','không']];
  const OUT = [['fade','mờ dần'],['sinkL','chìm trái'],['sinkR','chìm phải'],['fall','rơi xuống'],['shrink','co lại'],['wipeR','quét'],['none','không']];
  const HOLD = [['none','không'],['kenIn','Ken Burns – phóng vào'],['kenOut','Ken Burns – phóng ra'],['panL','lia trái'],['panR','lia phải'],['panU','lia lên'],['panD','lia xuống'],['drift','trôi'],['breathe','thở'],['growX','chạy đầy ngang'],['growY','chạy đầy dọc']];
  const curIn = (L.in && L.in.preset) || 'fade', curOut = (L.out && L.out.preset) || 'none', curHold = (L.hold && L.hold.preset) || 'none';
  // ── Chuyển động đơn giản: 1 thẻ = phối sẵn Vào+Giữ+Ra, cộng thanh Mức độ. ──
  // Người dùng thường bấm 1 thẻ là xong; 3 hàng chip kỹ thuật gốc vẫn giữ nguyên
  // trong "Nâng cao" cho ai cần chỉnh riêng từng pha. Engine/render không đổi.
  const curAmp = (L.hold && L.hold.amp != null) ? Number(L.hold.amp) : 1;
  const curStyle = (_T7_STYLES || []).find(s => s.hold === curHold);
  const comboMatch = !!(curStyle && curStyle.in === curIn && curStyle.out === curOut);
  const styleCard = (s) =>
    `<div class="t7-stylecard${curStyle && curStyle.id === s.id ? ' on' : ''}" onclick="t7LStyle('${s.id}')" title="${esc(s.desc)}">
       <i>${s.icon}</i><span><b>${s.name}</b><s>${s.desc}</s></span>
     </div>`;

  // ── Vị trí / cỡ / độ mờ: mẫu tự dựng bố cục, các ô này ĐÈ LÊN bố cục đó ──
  const b = L.box || {};
  const B = (k, ph) => { const cur = _t7BoxRead(L, k);
    return `<input class="t7-mfield" style="width:100%" type="number" step="1" placeholder="${ph}" value="${cur != null ? esc(cur) : ''}" onchange="t7LBox('${k}',this.value)">`; };
  const N = (k, ph, step, dflt) => `<input class="t7-mfield" style="width:100%" type="number" step="${step}" placeholder="${ph}" value="${L[k] != null ? esc(L[k]) : ''}" onchange="t7LNum('${k}',this.value,${dflt})">`;
  const aBtn = (k, v, lbl) => `<span class="t7-cchip${(b[k] || (k === 'align' ? 'left' : 'top')) === v ? ' on' : ''}" onclick="t7LBoxSet('${k}','${v}')">${lbl}</span>`;
  const opa = Math.round((L.opacity != null ? Number(L.opacity) : 1) * 100);
  const layout = `<details class="t7-sect">
    <summary><span><b>📐 Vị trí &amp; cỡ</b><em>Đè lên bố cục mẫu — tính theo % khung hình nên đổi 16:9 ↔ 9:16 vẫn đúng chỗ.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2">
      <div class="t7-g2"><div>${lb('X (%)')}${B('x','8')}</div><div>${lb('Y (%)')}${B('y','8')}</div></div>
      <div class="t7-g2"><div>${lb('Rộng (%)')}${B('w','tự')}</div><div>${lb('Cao (%)')}${B('h','tự')}</div></div>
      ${lb('Canh chữ trong hộp')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('align','left','trái')}${aBtn('align','center','giữa')}${aBtn('align','right','phải')}</div>
      ${lb('Canh dọc')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('vAlign','top','trên')}${aBtn('vAlign','center','giữa')}${aBtn('vAlign','bottom','dưới')}</div>
      <div class="t7-g3" style="margin-top:4px">
        <div>${lb('Cỡ ×')}${N('scale','1','0.05',1)}</div>
        <div>${lb('Xoay °')}${N('rotate','0','1',0)}</div>
        <div>${lb('Mờ %')}<input class="t7-mfield" style="width:100%" type="number" min="0" max="100" step="5" value="${opa}" onchange="t7LNum('opacity',this.value===''?'':(parseFloat(this.value)/100),1)"></div>
      </div>
      <div class="t7-g2"><div>${lb('Dịch ngang %')}${N('dx','0','1',0)}</div><div>${lb('Dịch dọc %')}${N('dy','0','1',0)}</div></div>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7LPin()" title="Hiện khung 8 nút trên bản xem trước để kéo bằng chuột">📌 Kéo trên khung</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7LReset()">↺ Về bố cục gốc</button>
      </div>
    </div>
  </details>`;

  return `<details class="t7-sect" open>
    <summary><span><b>✏️ Nội dung lớp</b><em>${esc((cat && cat.label) || L.template || L.type)} — ô do chính mẫu khai.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">${content || '<div class="t7-dim" style="font-size:11.5px">Mẫu này không có ô điền.</div>'}</div>
  </details>
  ${layout}
  ${colors.length ? `<details class="t7-sect">
    <summary><span><b>🎨 Màu</b><em>Đè lên màu mặc định của mẫu.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">${colors.map(k => `<div>${lb(k)}<div style="display:flex;gap:5px;align-items:center"><input type="color" style="width:30px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer" value="${esc(/^#[0-9a-f]{6}$/i.test(L[k] || '') ? L[k] : ((cat && cat.defaults && cat.defaults[k]) || '#888888'))}" onchange="t7LSet('${k}',this.value)"><input class="t7-mfield" style="flex:1;min-width:0;font-family:monospace;font-size:11px" value="${esc(L[k] || '')}" placeholder="mặc định" onchange="t7LSet('${k}',this.value)"></div></div>`).join('')}</div></div>
  </details>` : ''}
  <details class="t7-sect" open>
    <summary><span><b>🎞 Chuyển động</b><em>Bấm 1 kiểu là đủ — phần vào/ra đã phối sẵn.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${(_T7_STYLES || []).map(styleCard).join('')}</div>
      ${lb('Mức độ chuyển động')}
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <span style="font-size:10.5px;color:var(--text-muted)">nhẹ</span>
        <input type="range" min="0.25" max="2" step="0.05" value="${curAmp}" style="flex:1;accent-color:var(--accent)" onchange="t7LAmp(this.value)" title="Kéo sang phải để chuyển động mạnh/đậm hơn">
        <span style="font-size:10.5px;color:var(--text-muted)">mạnh</span>
      </div>
      ${comboMatch ? '' : `<div style="font-size:10.5px;color:var(--text-dim);margin-top:7px">⚙️ Đang chỉnh tay (${esc(curIn)} · ${esc(curHold)} · ${esc(curOut)}) — bấm 1 kiểu bên trên để áp bộ chuẩn.</div>`}
      <details style="margin-top:9px">
        <summary style="font-size:10.5px;color:var(--text-dim);cursor:pointer;user-select:none;list-style:none">⚙️ Nâng cao — chỉnh riêng từng pha (Vào / Giữ / Ra)</summary>
        <div style="margin-top:6px">
          ${lb('Vào', IN.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${IN.map(([v,l]) => chip('in', v, l, curIn)).join('')}</div>
          ${lb('Ra', OUT.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${OUT.map(([v,l]) => chip('out', v, l, curOut)).join('')}</div>
          ${lb('Giữ', HOLD.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${HOLD.map(([v,l]) => chip('hold', v, l, curHold)).join('')}</div>
        </div>
      </details>
    </div>
  </details>
  ${ctx.timing || ''}${ctx.tail || ''}`;
}

function _t7GfxEditor(c){
  const idx = Number(_t7GfxSel.split(':')[1]);
  const sp = (state.sceneSpecs || {})[c.sceneId];
  const L = sp && sp.layers && sp.layers[idx];
  if (!L) return '';
  const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const timing = `<details class="t7-sect">
    <summary><span><b>⏱ Thời điểm</b><em>Hiện lúc nào, tắt lúc nào trong cảnh.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Hiện ở (giây)')}<input class="t7-mfield" style="width:100%" value="${esc(L.at != null ? L.at : 0)}" onchange="t7LSet('at',parseFloat(this.value)||0)"></div>
      <div>${lb('Tắt ở (giây)')}<input class="t7-mfield" style="width:100%" placeholder="hết cảnh" value="${esc(L.until != null ? L.until : '')}" onchange="t7LSet('until',this.value===''?null:(parseFloat(this.value)||null))"></div>
    </div></div>
  </details>`;
  const tail = `<details class="t7-sect" open>
    <summary><span><b>📋 Dùng lại lớp này</b><em>Chép sang cảnh khác — khỏi gắn tay 192 lần.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:flex;gap:5px;margin-bottom:5px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxCopy()" title="⌘C">📋 Chép</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxDup()" title="⌘D">⧉ Nhân đôi</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxPaste()" title="⌘V">📥 Dán</button>
      </div>
      <button class="btn ghost sm" style="width:100%;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7GfxToGlobal()" title="Phủ cả video, chỉ 1 lớp — nhẹ hơn dán 192 lần">🌐 Chuyển thành lớp TOÀN CỤC</button>
      <button class="btn ghost sm" style="width:100%;margin-top:4px;padding:5px;font-size:11px" onclick="t7GfxPasteAll()" title="⇧⌘V">📥 Dán vào tất cả cảnh (192 bản sao)</button>
    </div>
  </details>
  <details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp này khỏi cảnh · phím Delete.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GfxDel(${idx})">Gỡ lớp đồ hoạ</button></div>
  </details>`;
  return _t7LayerPanel(L, { scene: true, timing, tail });
}

function _t7GlobEditor(){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return '';
  const L = g.layer || {}; const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const tot = (typeof _t7Total === 'function') ? _t7Total() : 0;
  const timing = `<details class="t7-sect" open>
    <summary><span><b>⏱ Thời gian trên CẢ VIDEO</b><em>Không thuộc cảnh nào — mốc tính từ đầu video (tổng ${tot.toFixed(1)}s).</em></span><span class="cv">⌃</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Bắt đầu (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0" step="0.5" value="${(Number(g.start) || 0).toFixed(1)}" onchange="t7GlobTime('start',this.value)"></div>
      <div>${lb('Kéo dài (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0.3" step="0.5" value="${(Number(g.dur) || 3).toFixed(1)}" onchange="t7GlobTime('dur',this.value)"></div>
    </div>
    <button class="btn ghost sm" style="width:100%;margin-top:7px;padding:5px;font-size:11px" onclick="t7GlobFull()">⇤⇥ Phủ trọn cả video (0 → ${tot.toFixed(1)}s)</button>
    </div>
  </details>`;
  const tail = `<details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp toàn cục này.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GlobDel(${_t7GlobSel})">Gỡ lớp toàn cục</button></div>
  </details>`;
  return `<div class="t7-drow" style="margin-bottom:8px"><span class="t7-dlab">🌐 Lớp toàn cục</span><div class="t7-dfield" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(_t7GfxName(L))}</div></div>
  ${_t7LayerPanel(L, { scene: false, timing, tail })}`;
}

async function _t7LoadFx(){
  if (!_t7Cat) await _t7Catalog();
  if (!_t7Trans) await _t7LoadTrans();
  if (!_t7Bits && window.native && typeof window.native.sceneBits === 'function'){
    try { const r = await window.native.sceneBits(); if (r && r.ok) _t7Bits = r.items || []; } catch (e) { _t7Bits = []; }
  }
  if (!_t7Bits) _t7Bits = [];
  if (!_t7Prev && window.native && typeof window.native.fxPreviews === 'function'){
    try { const r = await window.native.fxPreviews(); _t7Prev = (r && r.ok) ? (r.items || {}) : {}; } catch (e) { _t7Prev = {}; }
  }
  if (!_t7Prev) _t7Prev = {};
  const n = (_t7Cat || []).length + (_t7Trans || []).length + _t7Bits.length;
  const c = document.getElementById('t7FxCount'); if (c) c.textContent = n || '—';
  return n;
}

async function _t7FxSwatchLoad(){
  if (_t7FxSw) return _t7FxSw;
  _t7FxSw = {};
  const fxs = (_t7Cat || []).filter(t => /^fx-/.test(t.template));
  for (const t of fxs){
    try {
      const r = await window.native.previewLayers({ spec: { durationSec: 2, layers: [{ template: t.template }] }, t: 1.2 });
      const it = (r && r.ok && r.items || []).find(x => x && x.kind === 'fx');
      if (it && (it.pieces || []).length){
        _t7FxSw[t.template] = '<div style="position:relative;width:100%;height:100%;overflow:hidden">' + _t7LayerHtml(it) + '</div>';
      }
    } catch (e) {}
  }
  return _t7FxSw;
}

function _t7ABImgs(){
  if (_t7AB) return _t7AB;
  const imgs = [];
  for (const c of (t7State.clips || [])){
    const im = _t7ClipImg(c);
    if (im && imgs.indexOf(im) < 0) imgs.push(im);
    if (imgs.length >= 2) break;
  }
  _t7AB = { a: imgs[0] || '', b: imgs[1] || imgs[0] || '' };
  return _t7AB;
}

function _t7FxTargetSpec(){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c){ setStatus7('Chọn một cảnh trước đã.', 'error'); return null; }
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[c.sceneId];
  if (!sp){
    // Chưa có spec → dựng khung có lớp nền '@scene' để ảnh cảnh vẫn hiện dưới đồ hoạ.
    sp = state.sceneSpecs[c.sceneId] = { rev: Date.now(), layers: [
      { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } },
    ] };
  }
  return { c, sp };
}

function animOpen(){
  try { if (typeof t7Focus === 'function') t7Focus(false); } catch (e) {}
  switchTool('toolanim');                                  // switchTool tự gọi animInit()
}

async function animInit(){
  const body = document.getElementById('animBody'); if (!body) return;
  if (!_animLoaded){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">Đang nạp kho hiệu ứng…</div>';
    try { await _t7LoadFx(); } catch (e) {}
    _animLoaded = true;
  }
  animRender();
}

function animSetStatus(msg, tone){
  const el = document.getElementById('animStatus'); if (!el) return;
  el.textContent = msg || '';
  el.style.color = tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--accent)'
    : tone === 'error' ? 'var(--red)' : 'var(--text-muted)';
}

function _animSelClip(){
  try { return (t7State.clips || []).find(x => x.id === t7State.selClip) || null; }
  catch (e) { return null; }
}

function animGoT7(){
  switchTool('tool7');                                     // switchTool tự gọi t7Build()
  try { if (typeof t7SetMediaTab === 'function') t7SetMediaTab('fx'); } catch (e) {}
  try { if (typeof t7FxTab === 'function') t7FxTab('motion'); } catch (e) {}
}

function animApply(kind, name){
  if (!window.native || !window.native.sceneTemplates){
    animSetStatus('Chỉ áp được trong app Nova (Electron) — mở app desktop.', 'error'); return;
  }
  const c = _animSelClip();
  if (!c){
    animGoT7();
    animSetStatus('Chưa chọn cảnh — đã mở Dựng Video. Bấm chọn một cảnh trên timeline rồi quay lại đây bấm hiệu ứng.', 'warn');
    return;
  }
  if (kind === 'tpl' && typeof t7FxAddTpl === 'function') t7FxAddTpl(name);
  else if (kind === 'bit' && typeof t7FxAddBit === 'function') t7FxAddBit(name);
  else if (kind === 'tr' && typeof t7FxSetTrans === 'function') t7FxSetTrans(name);
  else { animSetStatus('Không áp được (thiếu hàm của Tool 7).', 'error'); return; }
  const nhan = kind === 'tr' ? 'chuyển cảnh' : (kind === 'bit' ? 'bit' : 'mẫu');
  animSetStatus('✓ Đã áp ' + nhan + ' vào cảnh ' + c.sceneId + ' — bấm 🎬 Mở Dựng Video để xem kết quả.', 'ok');
}

function animRender(){
  const body = document.getElementById('animBody'); if (!body) return;
  const qEl = document.getElementById('animQ');
  const q = (qEl ? qEl.value : '').toLowerCase();
  const esc = escapeHtml;
  const cat = _t7Cat || [], bits = _t7Bits || [], trans = _t7Trans || [];
  const stat = document.getElementById('animStat');
  if (stat) stat.textContent = cat.length + ' mẫu · ' + bits.length + ' bit · ' + trans.length + ' chuyển cảnh';
  if (!window.native || !window.native.sceneTemplates){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">⚠️ Kho hiệu ứng chỉ nạp được trong app Nova (Electron) — mở bằng app desktop. Trong trình duyệt thường sẽ thấy trống.</div>';
    return;
  }
  const _hit = (s) => !q || String(s || '').toLowerCase().includes(q);
  let html = '';
  // 1) Mẫu đồ hoạ động — ảnh xem trước thật từ nova:fxPreviews
  const t = cat.filter(x => _hit(x.label + ' ' + x.template));
  html += '<div class="anim-sec">Mẫu đồ hoạ động · ' + t.length + '</div>';
  html += t.length
    ? '<div class="anim-grid">' + t.map(x => {
        const im = (_t7Prev || {})['tpl_' + x.template];
        return '<div class="anim-card" onclick="animApply(\'tpl\',\'' + esc(x.template) + '\')" title="' + esc((x.params || []).join(' · ')) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x.label) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có mẫu nào khớp.</div>';
  // 2) Bit Remotion
  const b = bits.filter(_hit);
  html += '<div class="anim-sec">Bit Remotion · ' + b.length + '</div>';
  html += b.length
    ? '<div class="anim-grid">' + b.map(x => {
        const im = (_t7Prev || {})['bit_' + x];
        return '<div class="anim-card" onclick="animApply(\'bit\',\'' + esc(x) + '\')" title="' + esc(x) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có bit nào khớp.</div>';
  // 3) Chuyển cảnh — gom theo nhóm y như Tool 7 để dễ tìm
  const fam = {};
  trans.filter(x => _hit(x.label + ' ' + x.id)).forEach(x => { (fam[x.family] = fam[x.family] || []).push(x); });
  const famKeys = Object.keys(fam);
  const nTr = famKeys.reduce((n, f) => n + fam[f].length, 0);
  html += '<div class="anim-sec">Chuyển cảnh · ' + nTr + '</div>';
  html += famKeys.length
    ? famKeys.map(f =>
        '<div class="anim-fam">' + esc(_T7_FAM[f] || f) + '</div>' +
        '<div class="anim-trgrid">' + fam[f].map(x =>
          '<div class="anim-tr" onclick="animApply(\'tr\',\'' + esc(x.id) + '\')" title="' + esc(x.description || '') + ' — bấm để gán cho cảnh đang chọn"><b>' + esc(x.label) + '</b><s>' + (x.durationSec || '') + 's</s></div>').join('') + '</div>'
      ).join('')
    : '<div class="anim-dim">Không có chuyển cảnh nào khớp.</div>';
  body.innerHTML = html;
}

function _t7DragOk(want){ return !!_t7Drag && (want === 'any' || _t7Drag.kind === want || (want === 'layer' && _t7Drag.kind !== 'tr')); }

function _t7Snap(sec){
  if (t7State.snap === false) return sec;
  const tol = 6 / (t7State.pps || 8);                       // 6px quy ra giây
  const marks = [0, t7State.playT || 0];
  let acc = 0;
  _t7Clips().forEach(c => { marks.push(acc); acc += _t7ClipDur(c); });
  marks.push(acc);
  let best = sec, dmin = tol;
  marks.forEach(m => { const d = Math.abs(m - sec); if (d < dmin){ dmin = d; best = m; } });
  return best;
}

function _t7GfxCur(){
  if (!_t7GfxSel) return null;
  const [sid, k] = _t7GfxSel.split(':');
  const sp = (state.sceneSpecs || {})[sid];
  const L = sp && sp.layers && sp.layers[Number(k)];
  return L ? { sid, idx: Number(k), sp, L } : null;
}

function _t7Globs(){ if (!Array.isArray(state.globalGfx)) state.globalGfx = []; return state.globalGfx; }

function _t7GlobTouch(){
  if (typeof saveState === 'function') saveState(true);
  _t7OvKey = ''; t7RenderDetail(); t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
}

function _t7GfxSpec(){
  if (!_t7GfxSel) return null;
  const sid = _t7GfxSel.split(':')[0];
  return (state.sceneSpecs || {})[sid] || null;
}

function _t7GfxTouch(sp){
  sp.rev = Date.now();                                   // đổi rev → bản xem trước nạp lại spec
  _t7OvKey = '';                                          // ép vẽ lại lớp đồ hoạ ngay
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail();
  if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
}

function _t7LRef(){
  if (_t7GlobSel != null){
    const g = _t7Globs()[_t7GlobSel];
    return g ? { kind: 'glob', L: (g.layer = g.layer || {}), g, touch: _t7GlobTouch } : null;
  }
  const c = _t7GfxCur();
  return c ? { kind: 'scene', L: c.L, sp: c.sp, idx: c.idx, touch: () => _t7GfxTouch(c.sp) } : null;
}

function _t7BoxRead(L, key){
  if (L.template) return L[key];
  return (L.box || {})[key];
}

function _t7SelBox(){
  const r = _t7LRef(); if (!r) return null;
  const L = r.L;
  // Lớp mẫu: bố cục do mẫu dựng, chỉ biết vị trí khi người dùng đã đè x/y.
  const x = _t7BoxRead(L, 'x'), y = _t7BoxRead(L, 'y'), w = _t7BoxRead(L, 'w'), h = _t7BoxRead(L, 'h');
  if (x == null || y == null) return null;                 // chưa đè → không vẽ khung, tránh vẽ sai chỗ
  const centred = !!L.template || (L.box && L.box.anchor === 'center');
  const W = Number(w) || 30, H = Number(h) || 18;
  return { x: Number(x), y: Number(y), w: W, h: H, centred, hasW: w != null, hasH: h != null };
}

function _t7DrawSel(){
  const box = document.getElementById('t7GfxSel'); if (!box) return;
  const b = _t7SelBox();
  if (!b){ box.innerHTML = ''; return; }
  const left = b.centred ? b.x - b.w / 2 : b.x;
  const top  = b.centred ? b.y - b.h / 2 : b.y;
  const H = (n, cx, cy) => `<i data-h="${n}" style="position:absolute;${cy}:-4px;${cx}:-4px;width:9px;height:9px;border-radius:2px;background:var(--accent);border:1px solid #fff;pointer-events:auto;cursor:${n}-resize"></i>`;
  box.innerHTML = `<div id="t7SelBox" style="position:absolute;left:${left}%;top:${top}%;width:${b.w}%;height:${b.h}%;
      outline:1.5px solid var(--accent);outline-offset:2px;border-radius:3px;pointer-events:auto;cursor:move">
    ${H('nw','left','top')}${H('ne','right','top')}${H('sw','left','bottom')}${H('se','right','bottom')}
    <span style="position:absolute;left:0;top:-19px;background:var(--accent);color:var(--on-accent);font-size:9px;padding:1px 6px;border-radius:4px;white-space:nowrap">${escapeHtml(_t7GfxName(_t7LRef().L))}</span>
  </div>`;
  document.getElementById('t7SelBox').onpointerdown = _t7SelDrag;
}

function _t7SelDrag(ev){
  const stage = document.getElementById('t7GfxSel'); if (!stage) return;
  const b0 = _t7SelBox(); if (!b0) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const handle = ev.target && ev.target.dataset ? ev.target.dataset.h : null;
  ev.preventDefault(); ev.stopPropagation();
  const x0 = ev.clientX, y0 = ev.clientY;
  const el = document.getElementById('t7SelBox');
  const move = (e) => {
    const dx = (e.clientX - x0) / rect.width * 100;
    const dy = (e.clientY - y0) / rect.height * 100;
    let { x, y, w, h } = b0;
    if (!handle){ x += dx; y += dy; }
    else {
      // Kéo góc: đổi bề rộng, giữ tâm đúng phía đối diện cho tay cảm thấy tự nhiên.
      const sx = /w$/.test(handle) ? -1 : 1, sy = /^n/.test(handle) ? -1 : 1;
      w = Math.max(3, w + dx * sx * (b0.centred ? 2 : 1));
      h = Math.max(3, h + dy * sy * (b0.centred ? 2 : 1));
      if (!b0.centred){ if (sx < 0) x += dx; if (sy < 0) y += dy; }
    }
    x = Math.max(-20, Math.min(120, x)); y = Math.max(-20, Math.min(120, y));
    if (el){                                              // nhích khung ngay, chưa ghi vào dự án
      const L = b0.centred ? x - w / 2 : x, T = b0.centred ? y - h / 2 : y;
      el.style.left = L + '%'; el.style.top = T + '%'; el.style.width = w + '%'; el.style.height = h + '%';
    }
    move._v = { x, y, w, h };
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const v = move._v; if (!v) return;
    const r1 = Math.round(v.x * 10) / 10, r2 = Math.round(v.y * 10) / 10;
    if (!handle){ t7LBox('x', r1); t7LBox('y', r2); }
    else {
      t7LBox('w', Math.round(v.w * 10) / 10);
      if (b0.hasH || !b0.centred) t7LBox('h', Math.round(v.h * 10) / 10);
      if (!b0.centred){ t7LBox('x', r1); t7LBox('y', r2); }
    }
    setStatus7('📐 Đã đổi bố cục lớp trên khung.', 'ok');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

async function _t7DoSmartClip(c, opts){
  opts = opts || {};
  try {
    const s = _t7ClipScene(c); const narration = (s && s.text || '').trim();
    const hint = (state.scenePrompts && state.scenePrompts[c.sceneId]) || (state.scenePrompts2 && state.scenePrompts2[c.sceneId]) || '';
    const dur = parseFloat(_t7ClipDur(c)) || 4;
    const topic = (state.videoLogline || '').trim();   // chủ đề CẢ VIDEO — để phân biệt "gate" sân bay với "gate" nhà hàng
    const r = await window.native.smartClip({ keyword: opts.keyword || '', pickUrl: opts.pickUrl || '', startSec: opts.startSec, narration, hint, topic, duration: dur, vision: opts.vision !== false, score: true, entities: _clipEntities() });
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Lỗi' };
    // Chỉ ghi đè khi THẬT SỰ có tìm kiếm. Đường pickUrl (chọn tay / cắt lại đoạn)
    // trả về đúng 1 mục giả "(chọn tay)" không ảnh — ghi đè là mất sạch 8 clip đã
    // tìm được, dải clip còn mỗi ô đen.
    if (!opts.pickUrl && r.candidates && r.candidates.length){
      if (!state.ytCandidates) state.ytCandidates = {}; state.ytCandidates[c.sceneId] = r.candidates;
    }
    const b = await window.native.readFileB64(r.path);
    if (!b || !b.dataUrl) return { ok: false, error: 'Không đọc được clip' };
    if (!state.mediaPicks) state.mediaPicks = {};
    state.mediaPicks[c.sceneId] = { kind: 'video', downloadUrl: b.dataUrl, source: r.source || 'yt-smart', duration: r.duration || dur };
    // Giữ thông tin video GỐC để vẽ thanh chọn đoạn (heatmap) và cắt lại chỗ khác.
    if (!state.clipSrc) state.clipSrc = {};
    state.clipSrc[c.sceneId] = { url: r.srcUrl || opts.pickUrl || '', dur: r.srcDur || 0,
      heatmap: r.heatmap || null, sb: r.sb || null, start: r.winStart || 0, title: '' };
    try { c.useVideo = true; } catch (_) {}
    // LƯU NGAY (clip + danh sách ứng viên) — không thì tải lại app là mất, phải tìm lại từ đầu.
    try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); else if (typeof saveState === 'function') saveState(true); } catch (_) {}
    return { ok: true, query: r.query, source: r.source };
  } catch (e){ return { ok: false, error: String(e).slice(0, 120) }; }
}

function _t7RefreshAfterPick(sceneId){
  try {
    if (typeof t7State !== 'object' || !t7State || !Array.isArray(t7State.clips)) return;
    const c = t7State.clips.find(x => x.sceneId === sceneId); if (c) c.useVideo = true;
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
    if (typeof t7RenderRows === 'function') t7RenderRows();
    if (typeof t7RenderDetail === 'function') t7RenderDetail();
    if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
  } catch (e) {}
}

async function _t7ImgToDataUrl(img){
  if (!img) return null; if (/^data:/.test(img)) return img;
  try { const resp = await fetch(img); const blob = await resp.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); }); }
  catch (_) { return null; }
}

async function _t7LoadTrans(){
  if (_t7Trans) return _t7Trans;
  try {
    const r = await window.native.sceneTransitions();
    if (r && r.ok && Array.isArray(r.items) && r.items.length){ _t7Trans = r.items; return _t7Trans; }
  } catch (e) {}
  _t7Trans = _T7_TRANS_FALLBACK; return _t7Trans;
}

async function _t7AssetUrl(img){
  const src = await _t7ImgToDataUrl(img);
  if (!src) return '';
  if (!src.startsWith('data:')) return src;
  if (_t7BlobUrls.has(src)) return _t7BlobUrls.get(src);
  try { const blob = await (await fetch(src)).blob(); const url = URL.createObjectURL(blob); _t7BlobUrls.set(src, url); return url; }
  catch (e) { return src; }
}

function _t7DefaultSpec(c, src){
  const prev = null;
  return { id: c.sceneId, durationSec: parseFloat(_t7ClipDur(c)) || 3,
    // Chuyển cảnh GIỮA hai cảnh — NovaSequence đọc trường này, khác với in.preset là hiệu ứng của RIÊNG lớp.
    trans: c.trans || 'none', transDur: c.transDur || 0,
    theme: { bg: '#000000' },
    layers: src ? [{ type:'backdrop', src, at:0,
      in:  { preset: _T7_IN[c.trans] || 'fade', dur: Math.min(0.5, (c.transDur || 0.5)) },
      // Giãn nhịp: ngoài 30 giây đầu thì phần lớn cảnh để TĨNH.
      hold:{ preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 },
      out: { preset: 'fade', dur: 0.35 } }] : [] };
}

async function _t7NovaScenes(opts){
  const inline = !!(opts && opts.inline);
  const out = [];
  for (const c of _t7Clips()){
    const img = _t7ClipImg(c);
    const src = img ? (inline ? await _t7ImgToDataUrl(img) : await _t7AssetUrl(img)) : '';
    const designed = (state.sceneSpecs || {})[c.sceneId];
    if (designed && Array.isArray(designed.layers) && designed.layers.length){
      // Spec AI thiết kế: ÉP thời lượng theo cảnh + thay chỗ giữ "@scene" bằng ảnh thật.
      const spec = JSON.parse(JSON.stringify(designed));
      spec.id = c.sceneId;
      spec.durationSec = parseFloat(_t7ClipDur(c)) || 3;
      spec.trans = c.trans || 'none'; spec.transDur = c.transDur || 0;   // chuyển cảnh do clip quyết, không phải spec AI
      spec.layers.forEach(L => { if (L && L.src === '@scene') L.src = src; });
      spec.layers = spec.layers.filter(L => !(L && (L.type === 'backdrop' || L.type === 'image') && !L.src));
      out.push(spec);
    } else {
      out.push(_t7DefaultSpec(c, src));
    }
  }
  return out;
}

async function _t7Catalog(){
  if (_t7Cat) return _t7Cat;
  try {
    const r = await window.native.sceneTemplates();
    // Kho rỗng là trạng thái HỢP LỆ (vừa xoá sạch để thay mới) — trước đây coi là lỗi đọc.
    if (r && r.ok && Array.isArray(r.items)) { _t7Cat = r.items; return _t7Cat; }
  } catch (e) {}
  return null;
}

function _t7Gist(s, n){ const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }

function _t7AiSig(t){
  const s = String(t || '');
  let h = 0; for (let i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

function _t7AiSave(){
  try { state.aiQueue = _t7AiQ; if (typeof saveState === 'function') saveState(true); } catch (e) {}
}

function _t7AiSteps(cur, note){
  const box = document.getElementById('t7AiSteps'); if (!box) return;
  if (cur === 0) _t7AiNote = {};
  Object.assign(_t7AiNote, note || {});
  box.innerHTML = _T7_AI_STEP.map((ten, i) => {
    const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
    const phu = _t7AiNote[i] || (i === cur ? 'đang chạy…' : '');
    return `<div class="st ${cls}"><u>${i < cur ? '✓' : (i + 1)}</u>${escapeHtml(ten)}${phu ? ' · <span style="color:var(--text-dim)">' + escapeHtml(phu) + '</span>' : ''}</div>`;
  }).join('');
}

function _t7AiTally(){
  const ap = _t7AiQ.filter(x => x.state === 'ap').length;
  const nTr = _t7AiQ.filter(x => x.kind === 'tr').length;
  const el = document.getElementById('t7AiCnt');
  if (el) el.textContent = ap + ' / ' + _t7AiQ.length + ' đã gắn' + (nTr ? ' · ' + nTr + ' mối nối' : '');
  const n = document.getElementById('t7GfxCount');
  if (n){ let t = 0; try { Object.values(state.sceneSpecs || {}).forEach(sp =>
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') t++; })); } catch (e) {}
    n.textContent = t ? t + ' lớp' : ''; }
}

function _t7AiApply(q){
  // Mối nối: không đụng sceneSpecs, chỉ đặt kiểu chuyển lên chính clip đó.
  if (q.kind === 'tr'){
    const c = (t7State.clips || []).find(x => x.id === q.clipId || x.sceneId === q.sceneId);
    if (c){ c.trans = q.tr; c.transDur = q.trDur || 0.5;
      try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); } catch (e) {} }
    return;
  }
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[q.sceneId];
  if (!sp) sp = state.sceneSpecs[q.sceneId] = { rev: Date.now(), layers: [
    { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 },
      hold: { preset: _T7_HOLD[q.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } } ] };
  if (!Array.isArray(sp.layers)) sp.layers = [];
  const dua = (q.custom && q.custom.length) ? q.custom : q.picks;   // lớp thô hay mẫu — engine đọc chung một kiểu
  dua.forEach(pk => sp.layers.push(JSON.parse(JSON.stringify(pk))));
  sp.rev = Date.now();
}

function _t7AiLang(){
  try { return (typeof _profileLang === 'function' && _profileLang()) || 'Tiếng Việt'; }
  catch (e) { return 'Tiếng Việt'; }
}

function _t7AiClip(q){ return (t7State.clips || []).find(c => c.sceneId === q.sceneId) || null; }

function _t7AiDur(q){ const c = _t7AiClip(q); return c ? (parseFloat(_t7ClipDur(c)) || 3) : 3; }

function _t7AiSpecOf(q, dur){
  const L = (q.custom && q.custom.length) ? q.custom : (q.picks || []);
  return { rev: 1, durationSec: dur, layers: JSON.parse(JSON.stringify(L)) };
}

async function _t7AiPvHtml(q, t){
  if (!window.native || typeof window.native.previewLayers !== 'function') return '';
  const key = q.sceneId + '|d' + t.toFixed(2);
  if (_t7AiPv.has(key)) return _t7AiPv.get(key);
  const dur = _t7AiDur(q);
  let html = '';
  try {
    const r = await window.native.previewLayers({ spec: _t7AiSpecOf(q, dur), t: Math.min(t, dur) });
    if (r && r.ok) html = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e) { /* để trống, ô vẫn có nhãn báo */ }
  _t7AiPv.set(key, html);
  return html;
}

async function _t7AiPvDraw(i, chiNen){
  const q = _t7AiQ[i]; if (!q) return;
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  const pv = box.querySelector('.pv'); if (!pv) return;
  if (chiNen){ pv.innerHTML = ''; return; }        // "Trước" = cảnh trần, không cần hỏi engine
  const html = await _t7AiPvHtml(q, _t7AiTStill(_t7AiDur(q)));
  if (box.isConnected) pv.innerHTML = html;
}

function _t7AiTryClear(){
  if (!_t7AiTry) return;
  _t7AiTry = null; _t7OvKey = '';
  try { if (!t7State.playing) t7RenderPreview(); } catch (e) {}
}

function _t7AiPvHook(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  try { if (_t7AiObs) _t7AiObs.disconnect(); } catch (e) {}
  const nodes = box.querySelectorAll('.prev[data-i]');
  if (typeof IntersectionObserver !== 'function'){ nodes.forEach(e => _t7AiPvDraw(+e.dataset.i, false)); return; }
  _t7AiObs = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting){ _t7AiPvDraw(+e.target.dataset.i, e.target.dataset.mode === 'truoc'); _t7AiObs.unobserve(e.target); }
  }, { root: box, rootMargin: '300px' });
  nodes.forEach(e => _t7AiObs.observe(e));
}

function _t7AiFields(cat, tpl){
  const e = (cat || []).find(c => c.template === tpl); if (!e) return [];
  const d = e.defaults || {};
  const uu = ['text', 'headline', 'title', 'value', 'unit', 'kicker', 'subtitle', 'note', 'body', 'dek',
              'caption', 'label', 'name', 'chip', 'stamp', 'range', 'role', 'date',
              'position', 'pos', 'from', 'side', 'animation', 'dir', 'mode', 'size'];
  return (e.params || [])
    .filter(k => k !== 'src')                        // ảnh riêng của mẫu — chọn file, không sửa ở đây
    .map(k => {
      const v = d[k];
      let kind = 'text';
      if (_T7_ENUM[k]) kind = 'chon';
      else if (typeof v === 'number') kind = 'so';
      else if (typeof v === 'string' && /^(#|rgba?\()/.test(v)) kind = 'mau';
      return { key: k, kind, mac: v, chon: _T7_ENUM[k] || null };
    })
    .sort((a, b) => {
      const ia = uu.indexOf(a.key), ib = uu.indexOf(b.key);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

function _t7Hex(v){
  const s = String(v || '');
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
  return '#ffffff';
}

function _t7AiEditCustom(q, i){
  return (q.custom || []).map((L, j) => {
    const o = (key, nhan, kind, val, chon) => {
      const id = `cu${i}_${j}_${key}`;
      const set = `t7AiCustomSet(${i},${j},'${key}',this.value)`;
      if (kind === 'chon')
        return `<label for="${id}">${nhan}</label><select id="${id}" onchange="${set}">${
          chon.map(x => `<option value="${x}"${String(val) === x ? ' selected' : ''}>${(typeof NOVA_ANIM_LABELS !== 'undefined' && NOVA_ANIM_LABELS[x]) ? NOVA_ANIM_LABELS[x] : x}</option>`).join('')}</select>`;
      if (kind === 'mau')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="color" value="${_t7Hex(val)}" oninput="${set}">`;
      if (kind === 'so')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="number" value="${escapeHtml(String(val))}" oninput="${set}">`;
      return `<label for="${id}">${nhan}</label><input id="${id}" type="text" value="${escapeHtml(String(val == null ? '' : val))}" oninput="${set}">`;
    };
    const b = L.box || {}, st = L.style || {};
    const os = [
      L.type === 'text' ? o('text', 'Chữ', 'text', L.text) : '',
      o('x', 'Trái %', 'so', b.x), o('y', 'Trên %', 'so', b.y),
      o('w', 'Rộng %', 'so', b.w), o('h', 'Cao %', 'so', b.h),
      L.type === 'text' ? o('align', 'Canh', 'chon', b.align, ['left', 'center', 'right']) : '',
      L.type === 'text' ? o('size', 'Cỡ', 'so', st.size) : '',
      L.type === 'text' ? o('color', 'Màu chữ', 'mau', st.color) : o('fill', 'Màu khối', 'mau', st.fill),
      o('in', 'Vào cảnh', 'chon', L.in && L.in.preset, NOVA_IN_PRESETS),
      o('hold', 'Chuyển động chính', 'chon', L.hold && L.hold.preset, NOVA_HOLD_PRESETS),
    ].filter(Boolean).join('');
    return `<div class="edg"><b>Lớp ${j + 1} · ${L.type === 'text' ? 'chữ' : 'khối'}</b><div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7AiEditVeLai(i, q){
  clearTimeout(_t7AiEditT2);
  _t7AiEditT2 = setTimeout(() => {
    for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
    t7AiPvStop(); _t7AiPvDraw(i, false);
    if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){
      _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q)); _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {}
    }
    _t7AiSave();
  }, 220);
}

function _t7AiEditHtml(q, i, cat){
  if (q.custom && q.custom.length) return _t7AiEditCustom(q, i);
  return (q.picks || []).map((pk, j) => {
    const nhan = ((cat || []).find(c => c.template === pk.template) || {}).label || pk.template;
    const os = _t7AiFields(cat, pk.template).map(f => {
      const v = (pk[f.key] != null) ? pk[f.key] : f.mac;
      const id = `ed${i}_${j}_${f.key}`;
      const set = `t7AiEditSet(${i},${j},'${f.key}',this.${f.kind === 'mau' ? 'value' : 'value'})`;
      if (f.kind === 'chon')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <select id="${id}" onchange="${set}">${f.chon.map(o => `<option${String(v) === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      if (f.kind === 'so')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="number" step="${Number(f.mac) < 5 ? '0.05' : '1'}" value="${escapeHtml(String(v))}" oninput="${set}">`;
      if (f.kind === 'mau')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="color" value="${_t7Hex(v)}" oninput="${set}">`;
      return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="text" value="${escapeHtml(String(v == null ? '' : v))}" oninput="${set}">`;
    }).join('');
    return `<div class="edg">${(q.picks.length > 1) ? `<b>${escapeHtml(nhan)}</b>` : ''}<div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7DeNhau(a, b){
  return !(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1);
}

function _t7AiFixLayers(arr, dur){
  if (!Array.isArray(arr)) return [];
  const ra = [], hop = [];
  for (const L0 of arr.slice(0, _T7_MAX_LAYER + 2)){
    if (!L0 || typeof L0 !== 'object') continue;
    const type = (L0.type === 'shape') ? 'shape' : 'text';
    if (type === 'text' && !String(L0.text || '').trim()) continue;

    const b0 = L0.box || {};
    let x = _t7Kep(_t7Num(b0.x, 8), _T7_SAFE.x0, _T7_SAFE.x1);
    let y = _t7Kep(_t7Num(b0.y, 70), _T7_SAFE.y0, _T7_SAFE.y1);
    let w = _t7Kep(_t7Num(b0.w, 55), 8, 92);
    let h = _t7Kep(_t7Num(b0.h, type === 'shape' ? 12 : 18), 3, 90);
    if (x + w > _T7_SAFE.x1) w = _T7_SAFE.x1 - x;      // tràn mép phải → co lại, không đẩy
    if (y + h > _T7_SAFE.y1) h = _T7_SAFE.y1 - y;
    if (w < 8 || h < 3) continue;
    const hopNay = { x, y, w, h };
    if (hop.some(o => _t7DeNhau(o, hopNay))) continue;  // đè lớp đã nhận → bỏ

    const st0 = L0.style || {}, st = {};
    if (type === 'text'){
      st.size = _t7Kep(_t7Num(st0.size, 54), _T7_SIZE.min, _T7_SIZE.max);
      st.weight = _t7Kep(_t7Num(st0.weight, 800), 300, 900);
      st.color = _t7MauOk(st0.color) || '#ffffff';
      if (_t7MauOk(st0.bg)) st.bg = _t7MauOk(st0.bg);
      if (st0.upper) st.upper = true;
      st.shadow = st0.shadow !== false;                 // chữ trên video: mặc định có bóng cho đọc được
    } else {
      st.fill = _t7MauOk(st0.fill) || 'rgba(0,0,0,.55)';
      if (_t7MauOk(st0.fill2)) st.fill2 = _t7MauOk(st0.fill2);
      if (['gradient', 'radial'].includes(st0.fillType)) st.fillType = st0.fillType;
      st.radius = _t7Kep(_t7Num(st0.radius, 10), 0, 40);
    }

    const L = { type, box: { x, y, w, h, align: ['left', 'center', 'right'].includes(b0.align) ? b0.align : 'left' },
      style: st,
      at: _t7Kep(_t7Num(L0.at, 0), 0, Math.max(0, dur - 0.3)),
      in:   { preset: _t7Preset(L0.in && L0.in.preset, NOVA_IN_PRESETS, 'fade'),   dur: _t7Kep(_t7Num(L0.in && L0.in.dur, 0.45), 0.15, 1.2) },
      hold: { preset: _t7Preset(L0.hold && L0.hold.preset, NOVA_HOLD_PRESETS, 'none') },
      out:  { preset: _t7Preset(L0.out && L0.out.preset, NOVA_OUT_PRESETS, 'fade'), dur: _t7Kep(_t7Num(L0.out && L0.out.dur, 0.35), 0.15, 1.2) },
      z: ra.length + 1 };
    if (type === 'text') L.text = String(L0.text).trim().slice(0, 60);
    if (L0.shape === 'ellipse') L.shape = 'ellipse';
    ra.push(L); hop.push(hopNay);
    if (ra.length >= _T7_MAX_LAYER) break;
  }
  // Lớp nền (shape) phải nằm DƯỚI chữ, không thì che mất.
  ra.sort((a, b) => (a.type === 'shape' ? 0 : 1) - (b.type === 'shape' ? 0 : 1));
  ra.forEach((L, i) => { L.z = i + 1; });
  return ra;
}

function _t7CustomNhan(layers){
  const nT = (layers || []).filter(L => L.type === 'text').length;
  const nS = (layers || []).length - nT;
  return '✎ Tự thiết kế · ' + [nT ? nT + ' chữ' : '', nS ? nS + ' khối' : ''].filter(Boolean).join(' + ');
}

function _t7CustomSpec(){ return `
✎ CUSTOM DESIGN (use VERY SPARINGLY):
If none of the templates above fits this scene but graphics are still warranted, replace "picks" with "custom":
"custom":[
 {"type":"shape","box":{"x":6,"y":62,"w":52,"h":22},"style":{"fill":"rgba(0,0,0,.6)","radius":12},
  "at":0,"in":{"preset":"wipeL","dur":0.4},"out":{"preset":"fade","dur":0.3}},
 {"type":"text","text":"short text","box":{"x":9,"y":66,"w":46,"align":"left"},
  "style":{"size":64,"weight":800,"color":"#ffffff"},
  "at":0.15,"in":{"preset":"rise","dur":0.45},"hold":{"preset":"drift"},"out":{"preset":"fade","dur":0.3}}]
- Coordinates are % of the frame, origin at the top-left corner. Max 3 layers, NEVER let two boxes overlap.
- type may only be "text" or "shape". in/hold/out must use exact names from these lists:
  in: ${NOVA_IN_PRESETS.join(' ')}
  hold: ${NOVA_HOLD_PRESETS.join(' ')}
  out:  ${NOVA_OUT_PRESETS.join(' ')}
- Only use this when a truly custom layout is needed. If a template fits, ALWAYS use the template instead of drawing your own.`; }

function _t7AiTrQuota(n){
  return {
    _tong: Math.max(2, Math.round(n * 0.2)),   // tối đa 20% mối nối được khác cut
    'dip-white': 2, 'flash-cut': 2, 'glow-bloom': 1,
    'zoom-through': 2, 'match-zoom': 2, 'film-burn': 2, 'light-leak': 2,
    'barn-door': 1, 'shutter': 1, 'iris': 1, 'film-roll': 1,
    'paper-drop': 3, 'grain-dissolve': 3, 'defocus': 3,
    'wipe-left': 3, 'wipe-up': 3, 'push-left': 3, 'push-up': 3,
  };
}

function _t7AiTrGate(id, idx, S, cat){
  if (id === 'cut') return '';
  if (!S.cho.has(id)) return 'không có trong danh mục';
  if (S.dung >= S.quota._tong) return 'đã đủ ' + S.quota._tong + ' mối nối khác cut';
  const q = S.quota[id];
  if (q != null && (S.used[id] || 0) >= q) return 'hết trần của cú này';
  const last = S.last[id];
  if (last != null && idx - last < 4) return 'vừa dùng cách ' + (idx - last) + ' mối nối';
  if (S.lienTiep && idx - S.lienTiep < 2) return 'hai mối nối liền nhau đều có hiệu ứng';
  return '';
}

function _t7AiTrTake(id, idx, S){
  S.used[id] = (S.used[id] || 0) + 1; S.last[id] = idx; S.dung++; S.lienTiep = idx;
}

async function _t7AiTrans(clips, map, cat, onTick){
  const noi = clips.slice(0, -1);                    // clip cuối không có mối nối
  if (noi.length < 2) return [];
  const S = { quota: _t7AiTrQuota(noi.length), used: {}, last: {}, dung: 0, lienTiep: null,
              cho: new Set((cat || []).filter(x => x.id !== 'cut' && !(x.tags || []).includes('tranh')).map(x => x.id)) };
  const bang = (cat || []).filter(x => S.cho.has(x.id))
    .map(x => `${x.id} (${x.label}) — ${x.description}`).join('\n');
  const topic = String(state.videoLogline || '').trim();
  const ra = [];
  const CH = 40;

  for (let i = 0; i < noi.length; i += CH){
    if (state.cancelRequested) break;
    const lot = noi.slice(i, i + CH);
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), nx = _t7ClipScene(clips[i + k + 1]);
      const mp = map[c.sceneId] || {}, mn = map[clips[i + k + 1].sceneId] || {};
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s ${mp.role || '?'} → ${mn.role || '?'}] `
        + `"${_t7Gist(sc && sc.text, 70) || '—'}" ⇒ "${_t7Gist(nx && nx.text, 70) || '—'}"`;
    }).join('\n');

    const prompt = `You are a documentary film editor. Choose the TRANSITION for each junction below.
${topic ? 'TOPIC: ' + topic + '\n' : ''}
⚠️ MOST IMPORTANT RULE: the default is a HARD CUT. A good documentary keeps about 80% of junctions
as hard cuts; every other transition is an EXCEPTION that needs a reason. For this whole batch you should
nominate at most ${Math.max(1, Math.round(lot.length * 0.2))} junctions. Omit any junction that should be a hard cut ENTIRELY from the result.

USABLE TRANSITIONS:
${bang}

WHEN TO USE:
- Chapter change, time jump, full location change → dip-black
- Shift of idea within the same thread, short time drift → dissolve
- Decisive topic change, needs a punch → whip-pan
- Cutting to archive footage / flashback → grain-dissolve, defocus, light-leak, film-burn
- Paper-cut scenes chained together → paper-slide, paper-drop
- Maps, charts, lists chained together → wipe-left, wipe-up, push-left, push-up
- Two scenes with the SAME composition → match-zoom
Do NOT use a strong transition in the middle of a continuous narrative passage.

JUNCTIONS (the number is the index within the batch):
${list}

Return a JSON array containing ONLY the junctions that need something other than a hard cut:
[{"i":0,"tr":"dip-black","why":"short Vietnamese reason, under 16 words"}]`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1200, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('⚡ Lô chuyển cảnh lỗi: ' + String(e.message || e).slice(0, 80), 'warn'); }
    }
    if (arr == null) continue;

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + k;
      const id = String(row.tr || '').trim();
      if (_t7AiTrGate(id, idx, S, cat)) return;
      _t7AiTrTake(id, idx, S);
      const e = (cat || []).find(x => x.id === id) || {};
      ra.push({ kind: 'tr', sceneId: c.sceneId, clipId: c.id, name: _t7ClipLabel(c),
        tr: id, trLabel: e.label || id, trDur: Number(e.durationSec) || 0.5,
        line: _t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 90) || '(không lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do.', state: '', picks: [], custom: [] });
    });
    if (onTick) onTick(Math.min(i + CH, noi.length), noi.length, ra.length);
  }
  return ra;
}

function _t7AiRender(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  if (!_t7AiQ.length){ box.innerHTML = '<div class="t7-empty">Trợ lý không đề xuất gì thêm — các cảnh đang ổn.</div>'; return; }
  box.innerHTML = _t7AiQ.map((q, i) => {
    // Đã quyết định thì gập lại một dòng — khỏi chiếm chỗ của những cảnh còn phải xem.
    if (q.state) return `<div class="drow ${q.state === 'ap' ? 'ap' : 'sk'}">
      <span class="sc">${escapeHtml(q.name)}${q.kind === 'tr' ? ' →' : ''}</span>
      <span class="msg">${q.state === 'ap' ? '✓ Đã gắn · ' + escapeHtml(q.kind === 'tr' ? q.trLabel : q.tplLabel) : 'Đã bỏ qua'}</span></div>`;
    // Mối nối là chỗ GIỮA hai cảnh, không có khung hình riêng để xem trước → thẻ gọn.
    if (q.kind === 'tr') return `<div class="pr trrow" data-i="${i}">
      <div class="prb">
        <div class="prh"><span class="sc">${escapeHtml(q.name)} → cảnh sau</span>
          <span class="tpl">⚡ ${escapeHtml(q.trLabel)}</span></div>
        <p class="prq">“${escapeHtml(q.line)}”</p>
        <p class="why">${escapeHtml(q.why)}</p>
        <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn chuyển cảnh</button>
          <button onclick="t7AiDecide(${i},false)">Cắt thẳng</button></div>
      </div></div>`;
    const cl = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const nen = cl ? (_t7ThumbImg(cl) || '') : '';
    return `<div class="pr" data-i="${i}">
    <div class="prev" data-i="${i}" data-mode="sau" onclick="t7AiTry(${i})" title="Bấm để xem cảnh này trên khung lớn"${nen ? ` style="background-image:url('${escapeHtml(nen)}')"` : ''}>
      <div class="pv"></div>
      ${nen ? '' : '<div class="nohint">cảnh chưa có hình — chỉ xem được lớp đồ hoạ</div>'}
      <div class="ab"><button data-m="sau" class="on" onclick="t7AiPvMode(${i},'sau',event)">Sau</button><button data-m="truoc" onclick="t7AiPvMode(${i},'truoc',event)">Trước</button></div>
      <button class="play" onclick="t7AiPvPlay(${i},event)">▶ Xem chuyển động</button>
    </div>
    <div class="prb">
      <div class="prh"><span class="sc">${escapeHtml(q.name)}${q.role ? ' · ' + escapeHtml(q.role) : ''}</span><span class="tpl">${escapeHtml(q.tplLabel)}</span></div>
      <p class="prq">“${escapeHtml(q.line)}”</p>
      <p class="why">${escapeHtml(q.why)}</p>
      <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn vào cảnh</button>
        <button onclick="t7AiDecide(${i},false)">Bỏ qua</button>
        <button class="edbtn" onclick="t7AiEditToggle(${i},event)" title="Sửa chữ, vị trí, cỡ, màu của hiệu ứng này">⚙ Chỉnh</button></div>
    </div>
  </div>`; }).join('');
  _t7AiTally();
  _t7AiPvHook();
}

function _t7QuickFrames(id){
  return Promise.all([1, 2, 3].map(n => new Promise(res => {
    const u = `https://i.ytimg.com/vi/${id}/hq${n}.jpg`, im = new Image();
    im.onload = () => res(im.naturalWidth > 100 ? u : '');   // 120×90 = ảnh thay thế, bỏ
    im.onerror = () => res('');
    im.src = u;
  }))).then(a => a.filter(Boolean));
}

function _t7SbCell(sb, t){
  if (!sb || !Array.isArray(sb.frags) || !sb.frags.length) return null;
  let i = 0, acc = 0;
  for (; i < sb.frags.length; i++){
    const d = sb.frags[i].dur || 0;
    if (t < acc + d || i === sb.frags.length - 1) break;
    acc += d;
  }
  const f = sb.frags[i]; if (!f) return null;
  const per = (f.dur || 1) / (sb.rows * sb.cols);          // mỗi ô phủ bao nhiêu giây
  const k = Math.max(0, Math.min(sb.rows * sb.cols - 1, Math.floor((t - acc) / per)));
  return { url: f.url, x: (k % sb.cols) * sb.w, y: Math.floor(k / sb.cols) * sb.h, w: sb.w, h: sb.h,
    sw: sb.w * sb.cols, sh: sb.h * sb.rows };
}

function _t7SetNote(sceneId, msg, type){
  if (msg) _t7Notes[sceneId] = { msg, type: type || 'info' }; else delete _t7Notes[sceneId];
  setStatus7(msg || '', type);
  t7RenderSceneList();
}

function _t7NoteHtml(sceneId){
  const n = _t7Notes[sceneId]; if (!n) return '';
  const col = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' }[n.type] || 'var(--text-muted)';
  return `<div style="font-size:11.5px;line-height:1.5;margin:7px 0 0;color:${col}">${escapeHtml(n.msg)}</div>`;
}

function _t7SceneBody(c){
  const esc = escapeHtml;
  const useVid = _t7UsesVideo(c);
  const pk = (state.mediaPicks || {})[c.sceneId] || {};
  const isStock = /pexels|stock|pixabay|coverr/i.test(pk.source || '');
  // Dọn rác cũ: bản trước lưu mục giả "(chọn tay)" (không link xem được, không ảnh)
  // mỗi lần chọn clip bằng tay, ghi đè cả danh sách thật. Đã chặn ghi mới, nhưng
  // dự án cũ vẫn còn — lọc ở đây để không hiện ra như một ứng viên.
  // ⚠️ Ứng viên hai nguồn có SƠ ĐỒ TRƯỜNG KHÁC NHAU:
  //   YouTube → url / title / thumbnail / durationSec
  //   Stock   → downloadUrl / thumb / duration  (không có url, không có title)
  // Lọc theo mỗi x.url là quét sạch clip stock — tìm được 8 clip mà vẫn báo "chưa có".
  const _clean = (a) => (a || []).filter(x => x && (x.url || x.downloadUrl) && x.title !== '(chọn tay)');
  const yt = _clean((state.ytCandidates || {})[c.sceneId]);
  const st = _clean((state.stockCandidates || {})[c.sceneId]);
  // Tab mặc định = nguồn cảnh đang dùng; sau đó theo lựa chọn của người dùng.
  const now = !useVid ? 'ai' : (isStock ? 'st' : 'yt');
  const tab = _t7SrcTab[c.sceneId] || now;

  const seg = `<div class="t7-seg">
    <button class="${tab === 'ai' ? 'on' : ''}" onclick="event.stopPropagation();t7UseImage('${c.id}');t7SrcTab('${c.sceneId}','ai')">🖼 Ảnh AI</button>
    <button class="${tab === 'yt' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','yt')">🎬 YouTube${yt.length ? ` <span class="cnt">${yt.length}</span>` : ''}</button>
    <button class="${tab === 'st' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','st')">🔍 Stock${st.length ? ` <span class="cnt">${st.length}</span>` : ''}</button>
  </div>`;

  // ── nội dung theo TỪNG tập, không trộn ──
  let body = '';
  if (tab === 'ai'){
    const img = _t7ClipImg(c);
    body = `<div class="t7-slb">Ảnh AI của cảnh</div>` + (img
      ? `<div style="display:flex;gap:9px;align-items:center">
           <span style="display:block;width:112px;height:63px;border-radius:7px;background:#0b1020 center/cover no-repeat url('${esc(img)}');border:1.5px solid ${now === 'ai' ? 'var(--accent)' : 'transparent'}"></span>
           <span style="font-size:11px;color:var(--text-dim);line-height:1.5">Ảnh do AI dựng ở tab Phân Cảnh.<br>Muốn đổi hình thì sang tập YouTube hoặc Stock.</span>
         </div>`
      : `<div style="font-size:11.5px;color:var(--text-dim);line-height:1.55">Cảnh chưa có ảnh AI. Sang tab <b style="color:var(--text)">Phân Cảnh</b> bấm ✨ Tạo ảnh, hoặc chọn clip ở tập YouTube / Stock.</div>`);
  } else {
    const list = tab === 'yt' ? yt : st;
    const label = tab === 'yt' ? 'YouTube' : 'Stock';
    const find = tab === 'yt' ? `t7SrcYt('${c.id}','${c.sceneId}')` : `t7SrcStock('${c.sceneId}')`;
    const more = tab === 'yt' ? `t7OpenYtPicker('${c.sceneId}')` : `t2OpenStockPicker('${c.sceneId}')`;
    // Clip đang chạy chỉ được đánh ✓ khi cảnh THẬT SỰ dùng video của ĐÚNG nguồn này.
    // ⚠️ pk.downloadUrl là ĐƯỜNG DẪN FILE ĐÃ CẮT trên máy — không bao giờ trùng url
    // YouTube của thẻ, nên trước đây không thẻ nào được đánh dấu "đang dùng".
    // Nguồn thật nằm ở state.clipSrc[sceneId].url; so thêm cả theo id video để
    // youtu.be/XXX và watch?v=XXX vẫn khớp nhau.
    const cur = (useVid && now === tab) ? (pk.downloadUrl || pk.url || '') : '';
    const curSrc = (useVid && now === tab) ? (((state.clipSrc || {})[c.sceneId] || {}).url || '') : '';
    const curId = _t7YtId(curSrc);
    if (!list.length){
      body = `<div class="t7-slb">Clip ${label}</div>
        <div style="font-size:11.5px;color:var(--text-dim);line-height:1.55;margin-bottom:7px">Chưa tìm clip ${label} cho cảnh này.</div>
        <button class="btn ghost sm" style="padding:5px 13px;font-size:11.5px;border-color:var(--accent);color:var(--accent);font-weight:600" onclick="event.stopPropagation();${find}">🔎 Tìm clip ${label}</button>` + _t7NoteHtml(c.sceneId);
    } else {
      /* 🎯 Khớp lời chỉ hiện khi cảnh ĐANG dùng video của tập này — nó cắt lại
         chính clip đang gắn, không có clip thì không có gì để cắt.           */
      const _coNguon = !!(useVid && now === tab && (((state.clipSrc || {})[c.sceneId] || {}).url || c.srcUrl));
      body = `<div class="t7-slb" style="justify-content:flex-end;gap:10px">
          ${_coNguon ? `<button style="border:0;background:none;color:var(--teal);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            title="Bóc băng video nguồn rồi cắt lại đúng giây đang nói nội dung cảnh này. Chỉ hợp với tư liệu CÓ LỜI (phát biểu, phỏng vấn, điều trần) — b-roll không có gì để khớp. Tải tiếng có thể mất từ 10 giây tới vài phút tuỳ nền tảng."
            onclick="event.stopPropagation();t7KhopLoi('${c.id}')">🎯 Khớp lời</button>` : ''}
          <button style="border:0;background:none;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            onclick="event.stopPropagation();${more}">🔎 Tìm thêm</button></div>
        <div class="t7-strip">${list.map((x, i) => {
          const xu = x.url || x.downloadUrl || '';
          const xth = tab === 'yt' ? (x.thumbnail || x.thumb || '') : _stockThumb(x);
          const xdur = x.durationSec || x.duration || 0;
          const xti = x.title || (x.kind === 'image' ? '🖼 Ảnh' : '🎞 Clip') + ' ' + (x.source || 'stock');
          const on = (cur && (xu === cur || x.downloadUrl === cur))
                  || (curSrc && xu === curSrc)
                  || (curId && _t7YtId(xu) === curId);
          const fn = tab === 'yt' ? `t7PickYt('${c.sceneId}',${i})` : `t2PickStock('${c.sceneId}',${i})`;
          // Xem thử động chỉ có nghĩa với YouTube (dựa vào id video để đoán link ảnh).
          const hov = tab === 'yt' ? ` onmouseenter="t7CandHover('${esc(xu)}',this)" onmouseleave="t7CandLeave()"` : '';
          return `<button class="t7-cd${on ? ' on' : ''}"${on ? ' data-on="1"' : ''} onclick="event.stopPropagation();${fn}" title="${esc(xti)}"${hov}>
            <span class="im${xth ? '' : ' noimg'}"${xth ? ` style="background-image:url('${esc(xth)}')"` : ''}>${on ? '<u>✓</u><em>đang dùng</em>' : ''}${xdur ? `<s>${Math.round(xdur)}s</s>` : ''}</span>
            <i>${esc(String(xti).slice(0, 48))}</i></button>`;
        }).join('')}</div>` + _t7NoteHtml(c.sceneId);
    }
  }

  let nGfx = 0;
  try { const sp = (state.sceneSpecs || {})[c.sceneId];
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; }); } catch (e) {}
  const ft = `<div class="t7-sft">
    <span>Dài <b class="k">${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s</b></span>
    ${nGfx ? `<button class="gf" onclick="event.stopPropagation();t7GfxClearScene('${c.sceneId}')"
        title="Đồ hoạ do 🎬 AI dựng đồ hoạ gắn vào — bấm để gỡ khỏi cảnh này">✦ ${nGfx} lớp ✕</button>`
      : '<span style="color:var(--text-dim)">—</span>'}
    <span style="flex:1"></span>
    <button onclick="event.stopPropagation();t7DupSel()">⧉ Nhân đôi</button>
    <button class="dg" onclick="event.stopPropagation();t7DeleteSel()">🗑 Xoá</button>
  </div>`;
  return `<div class="t7-sbd">${seg}${body}${ft}</div>`;
}

function _t7TplTextKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.find(p => _T7_TXT_KEYS.includes(p)) || '') : '';
}

function _t7TplPosKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.includes('position') ? 'position' : (e.params.includes('pos') ? 'pos' : '')) : '';
}

function _t7AiQuota(n){
  // Kho mẫu đang RỖNG nên không còn trần theo tên. Thêm mẫu mới thì đặt trần ở đây:
  //   'ten-mau': 2,   → cả video tối đa 2 lần
  return {
    _ambient: Math.max(3, Math.ceil(n * 0.18)),
    _text: Math.max(3, Math.round(n * 0.12)),   // trần số cảnh ĐƯỢC đặt chữ
  };
}

function _t7AiGate(tpl, idx, S, cat){
  const q = S.quota;
  // Cần toạ độ vật thể mà model không nhìn thấy khung hình → khoanh bừa. Chặn hẳn.
  if (_T7_CAM.includes(tpl)) return 'mẫu cần toạ độ, model không thấy khung hình';
  if (q[tpl] != null && (S.used[tpl] || 0) >= q[tpl]) return 'hết hạn ngạch mẫu này';
  if (_T7_AMBIENT.includes(tpl) && S.amb >= q._ambient) return 'đủ lớp không khí cho cả video';
  if (_t7TplTextKey(cat, tpl) && S.txt >= q._text) return 'đã quá nhiều cảnh có chữ';
  const last = S.last[tpl];
  if (last != null && idx - last < 3) return 'vừa dùng cách đây ' + (idx - last) + ' cảnh';
  return '';
}

function _t7AiTake(tpl, idx, S, cat){
  S.used[tpl] = (S.used[tpl] || 0) + 1; S.last[tpl] = idx;
  if (_T7_AMBIENT.includes(tpl)) S.amb++;
  if (_t7TplTextKey(cat, tpl)) S.txt++;
}

function _t7AiQuotaLine(S){
  const q = S.quota, out = [];
  Object.keys(q).forEach(k => {
    if (k[0] === '_') return;
    const con = q[k] - (S.used[k] || 0);
    if (con <= 0) out.push(`${k}: EXHAUSTED, do not use`);
  });
  const ambCon = q._ambient - S.amb, txtCon = q._text - S.txt;
  out.push(`ambient layers: ${Math.max(0, ambCon)} remaining`);
  out.push(`${Math.max(0, txtCon)} scenes still allowed to carry text`);
  const kchu = _T7_NOTEXT.reduce((a2, k) => a2 + (S.used[k] || 0), 0);
  out.push(`used ${S.txt} text templates and ${kchu} no-text templates` +
    (S.txt >= 3 && kchu === 0 ? ' → HEAVILY SKEWED TOWARD TEXT, prioritize no-text templates in this batch' : ''));
  return out.join(' · ');
}

async function _t7AiMap(clips, onTick){
  if (!state.aiMap) state.aiMap = {};
  const map = state.aiMap;                       // kho của DỰ ÁN, không phải biến tạm
  const CH = 70;                                 // 70 cảnh/lượt: gọn trong cửa sổ, vẫn thấy toàn cảnh
  const topic = String(state.videoLogline || '').trim();
  // Chỉ đọc cảnh CHƯA có trong bản đồ hoặc đã bị sửa lời. Mở lại video cũ → 0 lượt gọi.
  const can = clips.filter(c => {
    const sc = _t7ClipScene(c), h = _t7AiSig(sc && sc.text);
    const cu = map[c.sceneId];
    return !(cu && cu.h === h);
  });
  if (!can.length){ if (onTick) onTick(clips.length, clips.length, 0); return map; }
  clips = can;
  for (let i = 0; i < clips.length; i += CH){
    if (state.cancelRequested) break;
    const lot = clips.slice(i, i + CH);
    const list = lot.map((c, k) => `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 120) || '(không lời)'}`).join('\n');
    const prompt = `You are a video editor. Read the ENTIRE script segment below, then score each scene.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}
For EACH scene return:
- role: exactly one of mo-dau | dan-dat | so-lieu | trich-dan | chuyen-y | chot
- key: the specific person / organization / place name appearing in the line ("")
- num: a number worth showing on screen in the line, kept as written ("")
- emp: 0-3 — how much it deserves a graphics emphasis. 0 = connective sentence, 3 = closing/shocking line.
The whole video should have only a few emp=3 scenes. Do not grade generously.

SCENES:
${list}

Return a JSON array with all ${lot.length} elements: [{"i":0,"role":"mo-dau","key":"","num":"","emp":2}]`;
    let arr = [];
    try { arr = await callLLMJson(prompt, { maxTokens: 2600, validate: (d) => Array.isArray(d) }); }
    catch (e){ novaLog && novaLog(`✨ Bản đồ cảnh ${i + 1}–${i + lot.length} lỗi: ${String(e.message || e).slice(0, 80)}`, 'warn'); }
    arr.forEach(r => {
      const k = Number(r && r.i); const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const sc = _t7ClipScene(c);
      map[c.sceneId] = { role: String(r.role || '').slice(0, 12), key: String(r.key || '').slice(0, 40),
        num: String(r.num || '').slice(0, 24), emp: Math.max(0, Math.min(3, Number(r.emp) || 0)),
        h: _t7AiSig(sc && sc.text) };
    });
    if (onTick) onTick(Math.min(i + CH, clips.length), clips.length, clips.length);
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // bản đồ là thứ đắt nhất, lưu ngay
  return map;
}

async function _t7AiVision(cat, onTick){
  const jobs = [];
  _t7AiQ.forEach((q, i) => {
    if (q.kind === 'tr') return;
    const coChu = (q.custom && q.custom.length) ? q.custom.some(L => L.type === 'text')
                                                : q.picks.some(p => _t7TplTextKey(cat, p.template));
    if (coChu) jobs.push(i);
  });
  let done = 0, doi = 0;
  const one = async (qi) => {
    const q = _t7AiQ[qi]; if (!q || q.state) return;
    const clip = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const img = clip ? _t7ThumbImg(clip) : null;
    if (!img){ doi++; return; }
    let b64 = '', mime = 'image/jpeg';
    try {
      const durl = await _t7ImgToDataUrl(img);
      const m = /^data:([^;,]+);base64,(.+)$/.exec(String(durl || ''));
      if (!m){ doi++; return; }
      mime = m[1]; b64 = m[2];
    } catch (e){ doi++; return; }
    // Mẫu tự sinh: chữ nằm ngay ở L.text, vị trí là hộp x/y nên không đổi theo "góc".
    const tuVe = !!(q.custom && q.custom.length);
    const pk = tuVe ? q.custom.find(L => L.type === 'text') : q.picks.find(p => _t7TplTextKey(cat, p.template));
    if (!pk){ doi++; return; }
    const tk = tuVe ? 'text' : _t7TplTextKey(cat, pk.template);
    const posKey = tuVe ? '' : _t7TplPosKey(cat, pk.template);
    const prompt = `This is the REAL frame of a video scene. We plan to overlay this text on it: "${String(pk[tk] || '').slice(0, 60)}" (template: ${tuVe ? 'custom design' : pk.template}).

Return JSON: {"ok":true/false,"pos":"corner","text":"edited text if needed","why":"one short Vietnamese sentence"}
- ok=false IF: the frame already has text/logo, or is too busy, or the subject fills nearly the whole frame so any text would cover faces.
- pos: pick from ${_T7_POS.join(' | ')} — the EMPTIEST area, avoiding faces and key objects.
- text: keep unchanged if fine; shorten to under 6 words if long; "" if ok=false.
  Write it in EXACTLY ${_t7AiLang()} — the same language as the script, do not translate to Vietnamese.
Print ONLY the JSON.`;
    let r = null;
    try {
      r = await callLLMJson(prompt, { maxTokens: 300, tries: 2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: prompt } ] }],
        validate: (d) => d && typeof d === 'object' && !Array.isArray(d) });
    } catch (e){ doi++; return; }
    if (!r) { doi++; return; }
    if (r.ok === false){
      q.drop = 'Khung hình không còn chỗ đặt chữ' + (r.why ? ' — ' + String(r.why).slice(0, 70) : '');
      return;
    }
    if (posKey && _T7_POS.includes(String(r.pos))) pk[posKey] = String(r.pos);
    const t2 = String(r.text || '').trim();
    if (t2 && t2 !== pk[tk]){ pk[tk] = t2.slice(0, 70); }
    q.why += ' · Đã soi khung: đặt ' + (posKey ? (pk[posKey] || 'mặc định') : 'vị trí mẫu') + '.';
  };
  // 4 luồng song song — nhanh gấp mấy lần chạy tuần tự mà không dội request.
  const pool = 4; let cur = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (cur < jobs.length && !state.cancelRequested){
      const qi = jobs[cur++];
      await one(qi);
      done++; if (onTick) onTick(done, jobs.length);
    }
  }));
  return { xong: done, doi };
}

async function _t7AiCritic(cat){
  const live = _t7AiQ.map((q, i) => ({ q, i })).filter(x => !x.q.drop && x.q.kind !== 'tr');
  if (live.length < 4) return 0;
  const list = live.map((x, k) => {
    if (x.q.custom && x.q.custom.length){
      const t = (x.q.custom.find(L => L.type === 'text') || {}).text || '';
      return `${k}. ${x.q.name} · tự thiết kế (${x.q.custom.length} lớp) · "${String(t).slice(0, 40)}"`;
    }
    const tk = _t7TplTextKey(cat, x.q.picks[0].template);
    return `${k}. ${x.q.name} · ${x.q.picks.map(p => p.template).join('+')} · "${String((tk && x.q.picks[0][tk]) || '').slice(0, 40)}"`;
  }).join('\n');
  const prompt = `This is the ENTIRE graphics plan of a video. Review it like a demanding editor.

Point out ONLY the items that should be DROPPED because: they duplicate the adjacent item, repeat the same text, put text on a scene that doesn't deserve it, or a whole cluster is too dense and clutters the video.
Do not drop more than 20% of the items. If the plan is already fine, return an empty array.

PLAN:
${list}

Return JSON: [{"k":3,"why":"short Vietnamese reason, under 15 words"}]`;
  let arr = [];
  try { arr = await callLLMJson(prompt, { maxTokens: 900, validate: (d) => Array.isArray(d) }); }
  catch (e){ return 0; }
  let n = 0;
  const tran = Math.ceil(live.length * 0.2);
  arr.slice(0, tran).forEach(r => {
    const k = Number(r && r.k); const x = live[Number.isFinite(k) ? k : -1]; if (!x) return;
    x.q.drop = 'Tự kiểm loại: ' + (String(r.why || '').slice(0, 70) || 'trùng ý với cảnh bên cạnh'); n++;
  });
  return n;
}

function _t7RemotionFrame(){ return document.getElementById('t7RemotionFrame'); }

function _t7NovaSig(){
  const specs = state.sceneSpecs || {};
  return _t7Clips().map(c => c.sceneId + ':' + _t7ClipDur(c).toFixed(2) + ':' + (c.fx || 'none') + ':' + (c.trans || 'none') + ':' + ((specs[c.sceneId] && specs[c.sceneId].rev) || 0)).join('|');
}

async function _t7NovaLoad(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  if (!win || typeof win.remotion_setBundleMode !== 'function') return false;
  const scenes = await _t7NovaScenes({ inline:false });
  if (!scenes.length){ setStatus7('Chưa có cảnh nào để dựng.', 'error'); return false; }
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  const durationInFrames = Math.max(1, Math.round(totalSec * T7_NOVA.fps));
  const props = JSON.stringify({ scenes });
  win.remotion_setBundleMode({
    type: 'composition',
    compositionName: T7_NOVA.comp,
    serializedResolvedPropsWithSchema: props,
    serializedDefaultPropsWithCustomSchema: props,
    compositionDurationInFrames: durationInFrames,
    compositionFps: T7_NOVA.fps,
    compositionWidth: T7_NOVA.width,
    compositionHeight: T7_NOVA.height,
    compositionDefaultCodec: 'h264',
    compositionDefaultOutName: null,
    compositionDefaultVideoImageFormat: null,
    compositionDefaultPixelFormat: null,
    compositionDefaultProResProfile: null,
  });
  _t7RmState.sig = _t7NovaSig();
  _t7RmState.frame = -1;
  return true;
}

function _t7RemotionFit(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  const host = document.getElementById('t7PreviewWrap');
  if (!fr || !win || !host) return;
  const canvas = win.document.getElementById('remotion-canvas');
  if (!canvas) return;
  const r = host.getBoundingClientRect();
  const s = Math.min(r.width / T7_NOVA.width, r.height / T7_NOVA.height) || 1;
  canvas.style.transform = 'scale(' + s + ')';
  canvas.style.transformOrigin = 'top left';
  const body = win.document.body;
  if (body){ body.style.margin = '0'; body.style.background = '#000'; body.style.overflow = 'hidden'; }
  const vc = win.document.getElementById('video-container');
  if (vc){
    vc.style.position = 'absolute';
    vc.style.left = Math.max(0, (r.width - T7_NOVA.width * s) / 2) + 'px';
    vc.style.top = Math.max(0, (r.height - T7_NOVA.height * s) / 2) + 'px';
  }
}

function _t7UpdateOverlay(){
  const el = document.getElementById('t7OverlayImg'); if (!el) return;
  const o = _t7OverlayAt(t7State.playT);
  if (o){ if (el.getAttribute('data-oid') !== o.id){ el.src = o.dataUrl; el.setAttribute('data-oid', o.id); } el.style.display = ''; }
  else { el.style.display = 'none'; el.removeAttribute('data-oid'); }
}

async function _t7DrawGfx(){
  const box = document.getElementById('t7GfxOv'); if (!box) return;
  if (!window.native || typeof window.native.previewLayers !== 'function'){ box.innerHTML = ''; return; }
  const at = _t7ClipAt(t7State.playT);
  const c = (at && at.clip) || t7State.clips.find(x => x.id === t7State.selClip);
  // Đang bấm thử một đề xuất → vẽ lớp TẠM của nó, không đụng state.sceneSpecs.
  const sp = (c && _t7AiTry && _t7AiTry.sceneId === c.sceneId) ? _t7AiTry.spec
           : (c && (state.sceneSpecs || {})[c.sceneId]);
  if (!c || !sp){ box.innerHTML = ''; _t7OvKey = ''; _t7OvPend = ''; return; }
  // _t7ClipAt chỉ trả {clip,index} — tự tính giây TRONG cảnh, không thì lớp luôn đứng ở giây 0.
  let _t0 = 0; for (const x of t7State.clips){ if (x.id === c.id) break; _t0 += _t7ClipDur(x); }
  const tIn = Math.max(0, Math.min(_t7ClipDur(c), (t7State.playT || 0) - _t0));
  // Chỉ gọi lại khi đổi cảnh / đổi spec / nhích quá 0.1s — tránh gọi IPC mỗi khung.
  const key = c.sceneId + ':' + (sp.rev || 0) + ':' + (_t7AiTry ? 'thu' : '') + ':' + tIn.toFixed(1);
  if (key === _t7OvKey){ _t7OvPend = ''; return; }
  if (_t7OvBusy){ _t7OvPend = key; return; }   // có request mới hơn chờ vẽ → response hiện tại về muộn sẽ bị bỏ
  _t7OvBusy = true;
  _t7OvPend = key;
  try {
    // Gửi kèm ảnh cảnh để main thay chỗ giữ '@scene' — không thì xem trước cố tải ảnh tên "@scene".
    let sceneSrc = '';
    try { const im = _t7ClipImg(c); if (im) sceneSrc = await _t7AssetUrl(im); } catch (e) {}
    const r = await window.native.previewLayers({ spec: Object.assign({}, sp, { durationSec: _t7ClipDur(c) }), t: tIn, sceneSrc });
    // Response cũ về muộn (đã có key mới hơn được yêu cầu trong lúc chờ) → BỎ, không ghi đè lớp
    // đang hiển thị. Không có token này thì khi phát/tua qua biên cảnh (đặc biệt ngay sau
    // Tách/Nhân đôi) lớp đồ hoạ bị vẽ chéo giữa 2 cảnh → ảnh xem trước nhấp nháy 2 ảnh A/B.
    if (_t7OvPend !== key) return;
    _t7OvKey = key; _t7OvPend = '';
    if (!r || !r.ok){ box.innerHTML = ''; return; }
    box.innerHTML = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e){
    if (_t7OvPend === key){ _t7OvKey = key; _t7OvPend = ''; box.innerHTML = ''; }
  }
  finally {
    _t7OvBusy = false;
    // Vẫn còn key mới hơn chưa được vẽ (request bị skip khi đang bận) → vẽ tiếp ĐÚNG key mới nhất.
    if (_t7OvPend && _t7OvPend !== _t7OvKey) _t7DrawGfx();
  }
  _t7DrawGlob();
}

async function _t7DrawGlob(){
  const box = document.getElementById('t7GlobOv'); if (!box) return;
  const gs = _t7Globs().filter(g => {
    const st = Number(g.start) || 0;
    return t7State.playT >= st && t7State.playT <= st + (Number(g.dur) || 3);
  });
  if (!gs.length){ box.innerHTML = ''; _t7GlobKey = ''; return; }
  const key = gs.map(g => g.id).join(',') + ':' + t7State.playT.toFixed(1);
  if (key === _t7GlobKey) return;
  _t7GlobKey = key;
  const out = [];
  for (const g of gs){
    try {
      const r = await window.native.previewLayers({
        spec: { durationSec: Number(g.dur) || 3, theme: g.theme || {}, layers: [g.layer] },
        t: t7State.playT - (Number(g.start) || 0),
      });
      if (r && r.ok) out.push(...(r.items || []));
    } catch (e) {}
  }
  box.innerHTML = out.map(_t7LayerHtml).join('');
}

function _t7LayerHtml(L){
  const w = Object.entries(L.wrap).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';');
  const cs = L.css ? Object.entries(L.css).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') : '';
  if (L.kind === 'text'){
    const inner = L.chars
      ? L.chars.map(ch => `<span style="display:inline-block;white-space:pre;opacity:${ch.opacity};transform:${ch.transform}">${escapeHtml(ch.ch === ' ' ? '\u00a0' : ch.ch)}</span>`).join('')
      : escapeHtml(L.text);
    return `<div style="${w}"><div style="${cs};text-align:${L.align}">${inner}</div></div>`;
  }
  if (L.kind === 'shape') return `<div style="${w}"><div style="${cs}"></div></div>`;
  if (L.kind === 'media' && L.src){
    // Video: tua tới đúng giây bằng mảnh #t= để khung xem trước khớp playhead.
    if (L.isVideo) return `<div style="${w}"><video src="${_t7FileUrl(L.src)}${/#/.test(L.src)?'':'#t='+(L.vt||0).toFixed(2)}" style="${cs}" muted playsinline preload="metadata"></video></div>`;
    return `<div style="${w}"><img src="${_t7FileUrl(L.src)}" style="${cs}"></div>`;
  }
  if (L.kind === 'bit') return `<div style="${w}"><div style="width:100%;height:100%;border:0.3cqh dashed rgba(255,255,255,.5);border-radius:1cqh;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:2cqh">✨ ${escapeHtml(L.name)}</div></div>`;
  // FX phủ toàn khung: main đã tính sẵn từng mảnh (effects.js) — chỉ dựng <div>.
  if (L.kind === 'fx'){
    const ps = (L.pieces || []).map(p => '<div style="' + Object.entries(p).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') + '"></div>').join('');
    return `<div style="${w}">${ps}</div>`;
  }
  return '';
}

function _t7PreviewFx(effect, i, p){
  let e = effect; if (e === 'random') e = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'][i % 4];
  if (e === 'zoom-in') return `scale(${(1 + 0.15 * p).toFixed(4)})`;
  if (e === 'zoom-out') return `scale(${(1.15 - 0.15 * p).toFixed(4)})`;
  if (e === 'pan-left') return `scale(1.08) translateX(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-right') return `scale(1.08) translateX(${(-4 + 8 * p).toFixed(3)}%)`;
  if (e === 'pan-up') return `scale(1.08) translateY(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-down') return `scale(1.08) translateY(${(-4 + 8 * p).toFixed(3)}%)`;
  return 'none';
}

function _t7UpdatePreviewFx(){
  // Bật xem trước Remotion → engine thật vẽ khung, bỏ qua hẳn nhánh mô phỏng CSS bên dưới.
  if (typeof _t7RmState === 'object' && _t7RmState.on){ t7RemotionSeek(t7State.playT); return; }
  const el = document.getElementById('t7PreviewImg'); if (!el) return;
  const at = _t7ClipAt(t7State.playT); if (!at){ el.style.transform = 'none'; return; }
  const sc = (at.clip.scale && at.clip.scale !== 1) ? at.clip.scale : 1;   // 🔍 tỉ lệ ảnh người dùng đặt
  const effect = at.clip.fx || 'none';
  if (effect === 'none'){ el.style.transform = (sc !== 1) ? ('scale(' + sc + ')') : 'none'; return; }
  const start = _t7ClipStart(at.index); const p = Math.max(0, Math.min(1, (t7State.playT - start) / _t7ClipDur(at.clip)));
  const fx = _t7PreviewFx(effect, at.index, p);
  el.style.transform = (sc !== 1) ? ('scale(' + sc + ')' + (fx && fx !== 'none' ? ' ' + fx : '')) : fx;   // kết hợp scale + Ken Burns
}

function _t7WaveSvg(peaks, colorVar){
  if (!peaks || !peaks.length) return '';
  const n = peaks.length, H = 38, mid = H / 2;
  let rects = '';
  for (let i = 0; i < n; i++){ const a = Math.max(0.6, peaks[i] * mid * 0.9); rects += `<rect x="${i}" y="${(mid - a).toFixed(1)}" width="0.7" height="${(a * 2).toFixed(1)}"/>`; }
  return `<svg viewBox="0 0 ${n} ${H}" preserveAspectRatio="none" width="100%" height="${H}" style="display:block;opacity:.6" fill="${colorVar}">${rects}</svg>`;
}

function _t7ApplyThumb(el){
  const c = t7State.clips.find(x => x.id === el.getAttribute('data-cid'));
  const img = c ? _t7ThumbImg(c) : null; if (!img) return;
  if (el.tagName === 'IMG') el.src = img; else el.style.backgroundImage = `url('${img}')`;
}

function _t7LazyThumbs(container, sel, root){
  try {
    const nodes = container.querySelectorAll(sel);
    if (typeof IntersectionObserver !== 'function'){ nodes.forEach(_t7ApplyThumb); return; }   // fallback
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries){ if (e.isIntersecting){ _t7ApplyThumb(e.target); obs.unobserve(e.target); } }
    }, { root: root || null, rootMargin: '600px' });   // nạp trước 600px để cuộn không thấy trống
    nodes.forEach(el => obs.observe(el));
    _t7ThumbObs.push(obs); while (_t7ThumbObs.length > 6){ try { _t7ThumbObs.shift().disconnect(); } catch (e) {} }
  } catch (e) { /* bỏ qua: giữ nền xám */ }
}

function _t7OverlayAt(t){ for (const o of (t7State.overlays || [])){ const s = o.start || 0; if (t >= s && t < s + (o.dur || 3)) return o; } return null; }

async function _t7SfxDoc(id){
  const x = (_t7SfxCache || []).find(i => i.id === id);
  if (!x) return null;
  let d = _t7SfxAudioCache.get(id);
  if (d === undefined){
    try { const b = await window.native.readFileB64(x.path); d = (b && b.dataUrl) || null; }
    catch (_){ d = null; }
    if (d){
      _t7SfxAudioCache.set(id, d);
      while (_t7SfxAudioCache.size > 24) _t7SfxAudioCache.delete(_t7SfxAudioCache.keys().next().value);
    } else {
      _t7SfxAudioCache.set(id, null);   // nhớ cả lỗi để bấm lại không đọc đĩa thêm lần nữa
    }
  }
  return d;
}

function _t7LiveResizeClip(id){
  const clips = _t7Clips(); const c = clips.find(x => x.id === id); if (!c) return;
  const pps = t7State.pps || 8; const w = Math.max(2, _t7ClipDur(c) * pps) + 'px';
  const idx = clips.findIndex(x => x.id === id);
  const el = document.querySelector('#t7TrkScenes .t7-clip[data-cid="' + id + '"]');
  if (el){ el.style.width = w; const lab = el.querySelector('.t7-cliplab'); if (lab) lab.textContent = _t7ClipDur(c).toFixed(1) + 's'; }
  const subs = document.querySelectorAll('#t7TrkSubs .t7-sub'); if (subs && subs[idx]) subs[idx].style.width = w;
  t7UpdatePlayhead();
}

function _t7TimelineRaf(){ if (_t7TlRaf) return; _t7TlRaf = requestAnimationFrame(() => { _t7TlRaf = 0; t7RenderTimeline(); }); }

async function _t7DecodePeaks(file, buckets){
  buckets = buckets || 600;
  try {
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ab = await ctx.decodeAudioData(buf);
    const ch = ab.getChannelData(0);
    const block = Math.max(1, Math.floor(ch.length / buckets));
    const peaks = new Float32Array(buckets); let max = 1e-6;
    for (let i = 0; i < buckets; i++){ let p = 0; const s = i * block, e = Math.min(ch.length, s + block); for (let j = s; j < e; j++){ const v = Math.abs(ch[j]); if (v > p) p = v; } peaks[i] = p; if (p > max) max = p; }
    for (let i = 0; i < buckets; i++) peaks[i] /= max;
    try { ctx.close(); } catch (e) {}
    return { peaks, duration: ab.duration };
  } catch (e){ return null; }
}

function _t7DurVi(s){ s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? h + ' giờ ' : '') + (m || h ? m + ' phút ' : '') + sec + ' giây'; }

function _t7ExpModalHide(){ const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'none'; }

function _t7ExpModalShow(info){
  info = info || {};
  const m = document.getElementById('t7ExpModal'); if (!m) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpModalTitle', 'Xuất video · ' + (info.name || ''));
  set('t7ExpState', 'Đang xuất');
  const th = document.getElementById('t7ExpThumb'); if (th) th.src = info.thumb || '';
  const rows = [['Tên video', info.name || '—'], ['Thời lượng', info.dur || '—'], ['Kích cỡ', info.size || '—'], ['Độ phân giải', info.res || '—'], ['Codec', info.codec || 'H.264'], ['Định dạng', 'mp4'], ['Không gian màu', 'Rec. 709 SDR'], ['Tỷ lệ khung hình', (info.fps || 30) + 'fps']];
  const box = document.getElementById('t7ExpInfo'); if (box) box.innerHTML = rows.map(([k, v]) => `<div style="color:var(--text-muted)">${k}</div><div style="font-weight:600">${escapeHtml(String(v))}</div>`).join('');
  set('t7ExpPct', '0%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '0%'; set('t7ExpElapsed', '⏱ 00:00');
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = ''; if (cl) cl.style.display = 'none';
  t7State._expT0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  m.style.display = 'flex';
}

function _t7ExpModalDone(ok, msg){
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpState', ok ? '✓ Đã xuất xong' : '❌ ' + (msg || 'Lỗi xuất'));
  if (ok){ set('t7ExpPct', '100%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '100%'; }
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = 'none'; if (cl) cl.style.display = '';
}

function _t7ExpDims(){
  const asp = document.getElementById('t7Aspect')?.value || '16:9';
  const r = parseInt(document.getElementById('t7ExpRes')?.value) || 1080;   // cạnh ngắn
  if (asp === '9:16') return [r, Math.round(r * 16 / 9)];
  if (asp === '1:1') return [r, r];
  return [Math.round(r * 16 / 9), r];
}

function _t7RecBitrateK(W, H, fps){
  const px = W * H;
  let b;
  if (H <= 720) b = 5000; else if (H <= 1080) b = 8000; else if (H <= 1440) b = 16000; else b = 40000;
  const ref = (H <= 720) ? 1280 * 720 : (H <= 1080) ? 1920 * 1080 : (H <= 1440) ? 2560 * 1440 : 3840 * 2160;
  b = b * (px / ref);
  if (fps >= 48) b *= 1.5;
  return Math.round(b);
}

function _t7ExpBitrateK(){
  const [W, H] = _t7ExpDims();
  const fps = parseInt(document.getElementById('t7ExpFps')?.value) || 30;
  const rec = _t7RecBitrateK(W, H, fps);
  const mode = document.getElementById('t7ExpBitrate')?.value || 'auto';
  const mult = mode === 'high' ? 1.6 : mode === 'low' ? 0.55 : 1.0;
  let b = Math.round(rec * mult);
  if (document.getElementById('t7ExpCodec')?.value === 'h265') b = Math.round(b * 0.65);   // HEVC nhẹ hơn ~35%
  return b;
}

async function _t7ShowGpuRow(){
  const row = document.getElementById('t7ExpGpuRow'); if (!row) return;
  if (_t7Gpu === null && window.native && typeof window.native.ffmpegInfo === 'function'){
    try { _t7Gpu = await window.native.ffmpegInfo(); } catch (_) { _t7Gpu = {}; }
  }
  const g = _t7Gpu || {};
  row.style.display = g.gpu ? 'flex' : 'none';
  const lab = document.getElementById('t7ExpGpuLab');
  if (lab && g.gpu) lab.textContent = `⚡ Tăng tốc GPU (${g.gpuLabel} — xuất nhanh hơn nhiều, nhất là 4K)`;
}

function _t7SrtTime(sec){ sec = Math.max(0, sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = Math.floor(sec%60), ms = Math.round((sec - Math.floor(sec))*1000); return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms).padStart(3,'0'); }

function _t7BuildSrt(clips){
  const out = []; let n = 1, t = 0;
  for (const c of clips){ const dur = _t7ClipDur(c); const txt = c.imported ? '' : (_t7ClipText(c) || '').replace(/\s+/g,' ').trim(); if (txt){ out.push(n + '\n' + _t7SrtTime(t) + ' --> ' + _t7SrtTime(t + dur) + '\n' + txt); n++; } t += dur; }   // clip nhập (media) không lấy tên file làm phụ đề
  return out.join('\n\n');
}

function _t7SubStyle(H){
  const fs = Math.max(16, Math.round((H || 1080) / 45)); const mv = Math.round((H || 1080) * 0.045);
  const base = `Fontname=Arial,Fontsize=${fs},Bold=1,Alignment=2,MarginV=${mv}`;
  const S = {
    vien:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1`,
    nova:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H66000000,BorderStyle=3,Outline=6,Shadow=0`,
    cam:     `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H000C41C2,BackColour=&H400C41C2,BorderStyle=3,Outline=6,Shadow=0`,
    vang:    `${base},PrimaryColour=&H0000E0FF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1`,
    toigian: `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=0,Shadow=2`,
  };
  return S[state.t7SubStyle || 'vien'] || S.vien;
}

async function _t7StockFillUrls(c, sceneDur, vd){
  if (!c || c.imported) return [];
  const pk = state.mediaPicks?.[c.sceneId];
  if (!pk || pk.kind !== 'video') return [];
  if (!(vd > 0.1) || vd >= sceneDur - 0.05) return [];
  const cands = (state.stockCandidates || {})[c.sceneId] || [];
  const others = cands.filter(x => x && x.kind === 'video' && x.downloadUrl && x.downloadUrl !== pk.downloadUrl);
  const out = []; let need = sceneDur - vd;
  for (const o of others){
    if (need <= 0.05) break;
    try { let u = o.downloadUrl; if (/^https?:/.test(u)) u = await _t7UrlToDataUrl(u); out.push(u); need -= Math.max(1, Number(o.duration) || 2); }
    catch (e){ /* bỏ ứng viên tải lỗi */ }
  }
  return out;
}

function _renumberVideos(p){
  if (!p || !Array.isArray(p.videos)) return;
  let n = 0;
  for (const v of p.videos){ n++; if (/^Video \d+$/.test(String(v.name || ''))) v.name = 'Video ' + n; }
}

async function newVideo(){
  const p = getProfile();
  if (!p){ newProfile(); return; }
  _ensureVideos(p);
  // Lưu video hiện tại trước (workData + ảnh IDB).
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}
  // Thêm video mới + chuyển sang. Đặt tên theo vị trí rồi renumber → số thứ tự luôn 1,2,3… (xoá xong về đúng số).
  const v = makeEmptyVideo('Video ' + ((p.videos || []).length + 1));
  p.videos.push(v);
  _renumberVideos(p);
  p.currentVideoId = v.id;
  loadStateFromProfile(p);                 // workData rỗng của video mới
  // Nhân vật/bối cảnh + ảnh của chúng dùng CHUNG profile → giữ; cảnh/ảnh cảnh/video rỗng.
  try { await loadProfileImages(p.profileId, v.id); } catch (e) {}
  // Reset dữ liệu tạm Tool 7/8.
  try { if (typeof t7State === 'object' && t7State) { t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.audioFile = null; t7State.audioPeaks = null; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  try { if (typeof t8State === 'object' && t8State) { t8State.audioFile = null; t8State.alignResults = null; } } catch (e) {}
  try { _t2ResetTimingAudio(); } catch (e) {}   // xoá MP3 căn timing của video cũ
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
  if (typeof setStatus1 === 'function') setStatus1('✓ Đã tạo "' + v.name + '" — trắng tinh, dùng chung style + nhân vật/bối cảnh của kênh. Bắt đầu ở Phân Cảnh.', 'ok');
}

async function switchVideo(id){
  const p = getProfile();
  if (!p || !id) return;
  _ensureVideos(p);
  if (id === p.currentVideoId) return;
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}   // lưu ảnh video hiện tại theo id cũ
  p.currentVideoId = id;
  // 🧹 Reset dữ liệu TẠM Dựng Video (overlay/media/clip/undo/nhạc nền) → KHÔNG rò rỉ sang video khác; workData video mới sẽ nạp lại.
  try { if (typeof t7State === 'object' && t7State){ t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  await mergeLocalWorkData(p, id);   // nạp kịch bản/cảnh local (IDB) của video mới trước khi đổ ra state
  loadStateFromProfile(p);
  try { await loadProfileImages(p.profileId, id); } catch (e) {}   // loadProfileImages tự nạp/xoá MP3 giọng đọc riêng của video này
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
}

async function renameVideo(){
  const p = getProfile(); if (!p) return;
  const v = getCurrentVideo(p); if (!v) return;
  const name = await _askText('Đổi tên video', v.name || 'Video');
  if (name == null) return;
  v.name = (name.trim() || v.name);
  renderVideoSelect();
  saveState(true);
}

function renderVideoSelect(){
  const sel = document.getElementById('videoSelect');
  if (!sel) return;
  const p = getProfile();
  if (!p){ sel.innerHTML = '<option>—</option>'; sel.disabled = true; return; }
  _ensureVideos(p);
  sel.disabled = false;
  sel.innerHTML = p.videos.map(v => `<option value="${v.id}" ${v.id === p.currentVideoId ? 'selected' : ''}>🎬 ${escapeHtml(v.name || 'Video')}</option>`).join('');
}

function openVideoManager(){
  const p = getProfile(); if (!p){ alert('Chưa có profile.'); return; }
  _ensureVideos(p);
  closeVideoManager();
  const ov = document.createElement('div');
  ov.id = 'videoMgrModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
  const rows = p.videos.map(v => {
    const wd = v.workData || {};
    const thumb = wd.thumbUrl
      ? `<img src="${wd.thumbUrl}" style="width:54px;height:31px;object-fit:cover;border-radius:5px;border:1px solid var(--border);flex:none">`
      : `<span style="width:54px;height:31px;border-radius:5px;background:var(--surface-3);display:grid;place-items:center;flex:none;font-size:14px">🎬</span>`;
    const path = wd.exportPath ? `<div style="font-size:10.5px;color:var(--text-dim);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(wd.exportPath)}">📄 ${escapeHtml(wd.exportPath)}</div>` : '';
    return `<div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:${v.id === p.currentVideoId ? 'var(--surface-2)' : 'transparent'}">
      <input type="checkbox" class="_vmChk" value="${v.id}" style="width:16px;height:16px;flex:none">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(v.name || 'Video')}${v.id === p.currentVideoId ? ' <span style="color:var(--accent);font-size:11px;font-weight:700">• đang mở</span>' : ''}</div>
        ${path}
      </div>
      <button class="btn ghost sm" onclick="switchVideo('${v.id}');closeVideoManager()">Mở</button>
    </div>`;
  }).join('');
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;width:min(520px,94vw);max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:17px;font-weight:800">Quản lý Video — ${escapeHtml(p.tenKenh || 'Kênh')}</div>
      <button class="btn ghost sm" onclick="closeVideoManager()">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px">
      <label style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px"><input type="checkbox" id="_vmAll" onclick="document.querySelectorAll('._vmChk').forEach(c=>c.checked=this.checked)" style="width:15px;height:15px"> Chọn tất cả</label>
      <button class="btn" style="border-color:var(--red);color:var(--red)" onclick="deleteSelectedVideos()">🗑 Xóa video đã chọn</button>
    </div>
  </div>`;
  ov.onclick = (e) => { if (e.target === ov) closeVideoManager(); };
  document.body.appendChild(ov);
}

function closeVideoManager(){ const m = document.getElementById('videoMgrModal'); if (m) m.remove(); }

async function deleteSelectedVideos(){
  const p = getProfile(); if (!p) return; _ensureVideos(p);
  const ids = [...document.querySelectorAll('._vmChk:checked')].map(c => c.value);
  if (!ids.length){ alert('Chưa tích video nào để xóa.'); return; }
  if (ids.length >= p.videos.length){ alert('Không thể xóa hết — profile phải còn ít nhất 1 video.'); return; }
  if (!confirm('Xóa ' + ids.length + ' video đã chọn?\nKịch bản/cảnh/ảnh/video của chúng sẽ mất. Style + thông tin kênh vẫn giữ.')) return;
  const uid = window.currentUser?.uid;
  for (const id of ids){
    if (uid && p.profileId){ const b = uid + '/' + p.profileId + '/' + id + '/'; for (const k of ['styleRefImages','characterImages','backgroundImages','sceneImages','sceneImagesB','sceneVideoBlobs','sceneVideosMeta','motionPrompts','voiceMp3']){ try { await IDB.set(b + k, null); } catch (e) {} } }
  }
  const del = new Set(ids);
  const curDeleted = del.has(p.currentVideoId);
  p.videos = p.videos.filter(v => !del.has(v.id));
  // Đồng bộ hàng đợi: bỏ các job trỏ tới video vừa xoá.
  try {
    if (typeof _prodQueue !== 'undefined' && _prodQueue.length) {
      const before = _prodQueue.length;
      _prodQueue.forEach(j => { if (del.has(j.videoId)) { try { IDB.del('qs_' + j.id); } catch (e) {} if (typeof _queueVoice === 'object') delete _queueVoice[j.id]; } });
      _prodQueue = _prodQueue.filter(j => !del.has(j.videoId));
      if (_prodQueue.length !== before) { if (typeof queueSave === 'function') queueSave(); if (typeof queueRender === 'function') queueRender(); }
    }
  } catch (e) {}
  if (curDeleted){
    p.currentVideoId = p.videos[0].id;
    loadStateFromProfile(p);
    try { await loadProfileImages(p.profileId, p.currentVideoId); } catch (e) {}
    rerenderAllAfterProfileLoad();
  }
  renderVideoSelect(); renderProfileStyles(); closeVideoManager();
  saveState(true);
}

function clearAllT3(){
  if (!confirm('Xoá HẾT prompt asset của profile hiện tại (nhân vật + bối cảnh + style reference + ảnh nhân vật)?\n\nStyle Prompts (Character Style, Background Style...) KHÔNG bị xoá — chúng là của Profile.')) return;
  state.assetCharPrompts = {};
  state.assetBgPrompts = {};
  state.styleRefPrompt = '';
  state.characterImages = {};
  syncStateToCurrentProfile();
  rerenderAllAfterProfileLoad();
  saveState(true);
  setStatus3('✓ Đã xoá hết prompt asset + ảnh ref của profile hiện tại.', 'ok');
}

function clearAllT5(){
  if (!confirm('Xoá HẾT kết quả tìm media + lựa chọn của profile hiện tại?')) return;
  state.pexelsResults = {};
  state.mediaPicks = {};
  _t5Results = {};
  document.querySelectorAll('[id^="media-results-"]').forEach(el => el.innerHTML = '');
  const sp = document.getElementById('searchProgress'); if (sp) sp.textContent = '';
  updatePickCount();
  syncStateToCurrentProfile();
  saveState(true);
  setStatus5('✓ Đã xoá hết kết quả tìm media + lựa chọn của profile hiện tại.', 'ok');
}

