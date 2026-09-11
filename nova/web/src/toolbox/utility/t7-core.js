/* T7 — Nova timeline/editor — LÕI: helper nền (scene/clip/media/timing/persist/clone/rails/candidates) + sync-col
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

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
    // Chặn chiều cao KHUNG XEM cho cột vừa đúng vùng nhìn thấy — bằng MỘT công thức
    // hội tụ (fixed-point), KHÔNG đo-ghi-đo-lại:
    //   moc = chiều cao player hiện tại − phần tràn trang hiện tại
    // Trừ đúng phần tràn (hoặc cộng đúng phần thiếu khi trang ngắn hơn viewport) thì
    // player khớp viewport sau ĐÚNG MỘT lần ghi; lượt ResizeObserver chạy lại tính ra
    // CÙNG một giá trị → bỏ ghi → vòng phản hồi RO tự tắt.
    // (Công thức cũ: ghi mốc lớn theo viewport → đo tràn du → bớt du → player co →
    // RO nổ → chạy lại từ mốc lớn → ghi du → ... dao động moc1↔moc2 suốt ~1s sau mỗi
    // lần bấm Tách / ↻ Đồng bộ, khung nhấp nháy liên tục — bản ghi 2026-09-11.)
    const player = document.getElementById('t7Player');
    if (player){
      const ph = Math.round(player.getBoundingClientRect().height);
      const du = document.documentElement.scrollHeight - window.innerHeight;   // dương = tràn, âm = còn thiếu
      const moc = Math.max(220, ph - du);           // mốc tuyệt đối đã trừ/bù sẵn du, không cộng dồn
      _t7SyncColHeight._moc = moc;
      if (player.style.maxHeight !== moc + 'px'){   // cùng giá trị → khỏi ghi → không đánh thức RO
        player.style.maxHeight = moc + 'px';
      }
      _t7SyncColHeight._pinW(player, stage, moc);   // ghi width trùng giá trị cũ = không đổi layout
      void player.offsetHeight;
    }
    let h = Math.round(stage.getBoundingClientRect().height);
    // Lưới an toàn CSS phải nới theo, không thì nó cắt cột cảnh thấp hơn cột xem trước.
    if (document.body.style.getPropertyValue('--t7-col-h') !== h + 'px'){
      document.body.style.setProperty('--t7-col-h', h + 'px');
    }
    const ghim = (h > 260) ? (h + 'px') : '';       // khung xem chưa dựng xong thì để nguyên
    if (bin.style.height !== ghim) bin.style.height = ghim;
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

async function _t7ImgToDataUrl(img){
  if (!img) return null; if (/^data:/.test(img)) return img;
  try { const resp = await fetch(img); const blob = await resp.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); }); }
  catch (_) { return null; }
}
