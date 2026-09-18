'use strict';

/* imzic-controls.js — nối mọi control + Butterchurn + trim + cài đặt + setStatus.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- controls ----
$('playBtn').addEventListener('click', async ()=>{
  if(isExporting){ setStatus('Đang ghi video — không phát/tạm dừng lúc này (sẽ làm hỏng bản ghi).', true); return; }
  ensureAudioGraph();
  if(audioCtx.state === 'suspended') await audioCtx.resume();
  if(state.playing){
    audioEl.pause(); state.playing=false; $('playBtn').textContent='▶ Phát thử';
  } else {
    try {
      await audioEl.play();
    } catch(err){
      setStatus('Không phát được file nhạc: ' + (err && err.message ? err.message : String(err)) + ' — thử file khác nếu lỗi lặp lại.', true);
      return;
    }
    state.playing=true; $('playBtn').textContent='⏸ Tạm dừng';
  }
});
$('restartBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không tua lại từ đầu lúc này.', true); return; }
  audioEl.currentTime = 0; rebuildParticles();
});

$('zoomMin').addEventListener('input', e=>{ state.zoomMin = +e.target.value; $('v-zmin').textContent = state.zoomMin.toFixed(2)+'x'; });
$('zoomMax').addEventListener('input', e=>{ state.zoomMax = +e.target.value; $('v-zmax').textContent = state.zoomMax.toFixed(2)+'x'; });
$('sensitivity').addEventListener('input', e=>{ state.sensitivity = (+e.target.value)/100; $('v-sens').textContent = e.target.value+'%'; });
$('smoothness').addEventListener('input', e=>{ state.smoothness = (+e.target.value)/100; $('v-smooth').textContent = e.target.value+'%'; });

$('density').addEventListener('input', e=>{ state.density = +e.target.value; $('v-density').textContent = e.target.value; rebuildParticles(); });
$('pspeed').addEventListener('input', e=>{ state.pspeed = (+e.target.value)/100; $('v-speed').textContent = e.target.value+'%'; });
$('sizeMin').addEventListener('input', e=>{ state.sizeMin = +e.target.value; $('v-szmin').textContent = e.target.value+'px'; rebuildParticles(); });
$('sizeMax').addEventListener('input', e=>{ state.sizeMax = +e.target.value; $('v-szmax').textContent = e.target.value+'px'; rebuildParticles(); });
$('alpha').addEventListener('input', e=>{ state.alpha = (+e.target.value)/100; $('v-alpha').textContent = e.target.value+'%'; });
$('pcolor').addEventListener('input', e=>{ state.color = e.target.value; $('colorHint').textContent = 'Màu tuỳ chỉnh đang dùng'; });

// chip-group đã gom thành dropdown (select) — hợp đồng state[key] giữ nguyên
function setupSel(selId, key, after){
  const el = $(selId);
  if(!el) return;
  el.addEventListener('change', ()=>{
    state[key] = el.value;
    if(after) after();
  });
}
// đặt giá trị dropdown (kèm cập nhật state) mà KHÔNG bắn change — tránh đệ quy
function setSelValue(selId, key, value){
  const el = $(selId);
  if(el) el.value = value;
  state[key] = value;
}
setupSel('effectSel','effect', ()=>{
  if(!state.colorTouched) $('pcolor').value = defaultColors[state.effect];
  if(state.effect==='rain' && !state.dirTouched){
    setSelValue('dirSel','direction','down');
  }
  if(state.effect==='bubbles' && !state.dirTouched){
    // bong bóng nổi lên tự nhiên — mặc định bay lên (vẫn đổi được tay như rain)
    setSelValue('dirSel','direction','up');
  }
  rebuildParticles();
});
setupSel('dirSel','direction', ()=>{ state.dirTouched = true; rebuildParticles(); });
$('pcolor').addEventListener('change', ()=>{ state.colorTouched = true; });

// ---- audio wave controls ----
// Bật/tắt sóng hợp nhất vào "Kiểu sóng" (2026-09-16): 'off' = tắt — không vẽ
// sóng + ẩn khối tham số waveParams. Hợp đồng vẽ giữ nguyên: drawWave vẫn đọc
// state.waveOn; state.waveStyle chỉ có nghĩa khi bật (AGENTS §4 Luật 1).
// 2026-09-18j: nhớ kiểu đang chọn trước khi chuyển sang 'bend' (nắm kiểu nền tự động)
let imzPrevWaveStyle = state.waveStyle || 'line';
setupSel('waveStyleSel','waveStyle', ()=>{
  state.waveOn = (state.waveStyle !== 'off');
  // 2026-09-18j: hiệu ứng "Uốn cong" (bend) — tự nắm kiểu đang chọn TRƯỚC đó
  // làm kiểu sóng nền (nếu hợp lệ: không phải off/bend)
  if(state.waveStyle === 'bend' && imzPrevWaveStyle !== 'off' && imzPrevWaveStyle !== 'bend'){
    state.waveBendBase = imzPrevWaveStyle;
    const bsel = $('waveBendBaseSel');
    if(bsel) bsel.value = state.waveBendBase;
  }
  imzPrevWaveStyle = state.waveStyle;
  const wp = $('waveParams'); if(wp) wp.style.display = state.waveOn ? '' : 'none';
  // kiểu 'curved' và 'bend' đều dùng slider mức uốn + hướng uốn
  const f = $('waveCurveField'); const h = $('waveCurveHint');
  const on = (state.waveStyle === 'curved' || state.waveStyle === 'bend');
  if(f) f.style.display = on ? '' : 'none';
  if(h) h.style.display = on ? '' : 'none';
  // chỉ 'bend' mới hiện chọn kiểu sóng nền + điểm uốn + hướng vồng
  const bf = $('waveBendBaseField');
  if(bf) bf.style.display = (state.waveStyle === 'bend') ? '' : 'none';
  const af = $('waveBendAnchorField'); // 2026-09-18m: điểm neo khi uốn
  if(af) af.style.display = (state.waveStyle === 'bend') ? '' : 'none';
  const sf = $('waveBendSideField'); // 2026-09-18n: hướng vồng lên/xuống
  if(sf) sf.style.display = (state.waveStyle === 'bend') ? '' : 'none';
});
setupSel('waveCurveDirSel','waveCurveDir');
setupSel('waveBendBaseSel','waveBendBase');
setupSel('waveBendAnchorSel','waveBendAnchor'); // 2026-09-18m: 'start'|'center'|'end'
setupSel('waveBendSideSel','waveBendSide'); // 2026-09-18n: 'up'|'down'
$('waveCurve').addEventListener('input', e=>{
  state.waveCurve = Math.max(0, Math.min(1, (+e.target.value || 0) / 100));
  const lbl = $('v-wcurve'); if(lbl) lbl.textContent = e.target.value + '%';
});

// ---- FX toàn khung ----
// Lazy-load vendor Butterchurn (~826KB) — chỉ nạp khi user chọn FX Milkdrop lần đầu.
// Lỗi tải → reject lộ liễu code IMZIC_BUTTERCHURN_LOAD (Luật 10, không fallback ngầm).
var _bcVendorLoaded = false;
var _bcVendorLoading = null;
function bcEnsureVendor(){
  if (_bcVendorLoaded) return Promise.resolve();
  if (_bcVendorLoading) return _bcVendorLoading;
  _bcVendorLoading = new Promise(function(resolve, reject){
    var s1 = document.createElement('script');
    s1.src = 'vendor/butterchurn.min.js';
    s1.onload = function(){
      var s2 = document.createElement('script');
      s2.src = 'vendor/butterchurn-presets.min.js';
      s2.onload = function(){ _bcVendorLoaded = true; resolve(); };
      s2.onerror = function(){ _bcVendorLoading = null; reject(Object.assign(new Error('Không nạp được vendor/butterchurn-presets.min.js'), { code:'IMZIC_BUTTERCHURN_LOAD' })); };
      document.head.appendChild(s2);
    };
    s1.onerror = function(){ _bcVendorLoading = null; reject(Object.assign(new Error('Không nạp được vendor/butterchurn.min.js'), { code:'IMZIC_BUTTERCHURN_LOAD' })); };
    document.head.appendChild(s1);
  });
  return _bcVendorLoading;
}

$('fxSel').addEventListener('change', e=>{
  const v = e.target.value;
  if(v === 'milkdrop'){
    try{ bcEnsureVendor().then(function(){ refreshBcPresetList(); bcEnsure(); }).catch(function(err){
      e.target.value = 'none';
      state.fx = 'none';
      setStatus('[' + ((err && err.code) || 'IMZIC_BUTTERCHURN') + '] ' + (err && err.message ? err.message : String(err)), true);
    }); }
    catch(err){
      // Không fallback ngầm (Luật 10): trả FX về Tắt + báo lỗi lộ liễu với code
      e.target.value = 'none';
      state.fx = 'none';
      setStatus('[' + ((err && err.code) || 'IMZIC_BUTTERCHURN') + '] ' + (err && err.message ? err.message : String(err)), true);
      return;
    }
    state.fx = v;
    $('bcPresetField').style.display = '';
    return;
  }
  state.fx = v;
  $('bcPresetField').style.display = (v === 'milkdrop') ? '' : 'none';
});
$('fxLevel').addEventListener('input', e=>{ state.fxLevel = (+e.target.value)/100; $('v-fxlevel').textContent = e.target.value+'%'; });

// ---- Butterchurn (Milkdrop) — nguồn mở MIT: jberg/butterchurn + butterchurn-presets,
//      bản vendor UMD tại nova/web/vendor/ (chỉ dùng cho FX 'milkdrop') ----
function bcDefaultPresetName(){
  const presets = window.butterchurnPresets || {};
  const names = Object.keys(presets).sort();
  return names.length ? names[0] : '';
}
function bcLoadPreset(name, transitionSec){
  const presets = window.butterchurnPresets;
  if(!presets || !bcViz) return;
  const pName = (name && presets[name]) ? name : bcDefaultPresetName();
  if(!pName || !presets[pName]){
    throw Object.assign(new Error('Không có preset Butterchurn nào để nạp (vendor/butterchurn-presets.min.js trống hoặc chưa nạp).'), { code:'IMZIC_BUTTERCHURN_NO_PRESET' });
  }
  bcViz.loadPreset(presets[pName], transitionSec || 0);
  bcVizPreset = pName;
}
// tạo/bảo đảm visualizer đúng kích thước canvas vật lý hiện tại (preview 720,
// khi ghi realtime/export phóng 1.5× → dựng lại — butterchurn 2.6.7 không có
// setCanvasSize nên tái tạo context là hợp đồng chính thức của version này)
function bcEnsure(){
  if(typeof window.butterchurn !== 'object' || !window.butterchurn || typeof window.butterchurn.createVisualizer !== 'function'){
    throw Object.assign(new Error('Thiếu lib Butterchurn — nova/web/vendor/butterchurn.min.js chưa nạp được.'), { code:'IMZIC_BUTTERCHURN_UNAVAILABLE' });
  }
  ensureAudioGraph();
  const W = canvas.width, H = canvas.height;
  if(!bcCanvas || bcCanvas.width !== W || bcCanvas.height !== H){
    bcCanvas = document.createElement('canvas');
    bcCanvas.width = W; bcCanvas.height = H;
    const gl = bcCanvas.getContext('webgl2');
    if(!gl){
      bcCanvas = null; bcViz = null;
      throw Object.assign(new Error('Trình duyệt không cấp được WebGL2 — FX Milkdrop (Butterchurn) cần WebGL2.'), { code:'IMZIC_NO_WEBGL2' });
    }
    // GPU reset → context lost: vứt viz + canvas (đối tượng butterchurn gắn với
    // context cũ đã invalid), frame kế bcEnsure tự dựng lại trên context mới
    bcCanvas.addEventListener('webglcontextlost', (e)=>{
      e.preventDefault();
      bcViz = null; bcCanvas = null; bcVizPreset = '';
    }, false);
    bcViz = window.butterchurn.createVisualizer(audioCtx, bcCanvas, { width: W, height: H, pixelRatio: 1, textureRatio: 1 });
    bcViz.connectAudio(sourceNode);
    bcVizPreset = '';
  }
  if(!bcVizPreset) bcLoadPreset(state.bcPreset, 0);
}
function refreshBcPresetList(){
  const sel = $('bcPresetSel'); if(!sel) return;
  const presets = window.butterchurnPresets || {};
  const names = Object.keys(presets).sort();
  const frag = document.createDocumentFragment();
  names.forEach(n=>{ const o = document.createElement('option'); o.value = n; o.textContent = n; frag.appendChild(o); });
  sel.innerHTML = ''; sel.appendChild(frag);
  if(!state.bcPreset || !presets[state.bcPreset]) state.bcPreset = bcDefaultPresetName();
  sel.value = state.bcPreset;
}
$('bcPresetSel').addEventListener('change', ()=>{
  state.bcPreset = $('bcPresetSel').value;
  if(state.fx === 'milkdrop' && bcViz){
    try{ bcLoadPreset(state.bcPreset, 2.5); }
    catch(err){ setStatus('[' + ((err && err.code) || 'IMZIC_BUTTERCHURN') + '] ' + (err && err.message ? err.message : String(err)), true); }
  }
});
refreshBcPresetList();
$('wavePos').addEventListener('input', e=>{ state.wavePos = +e.target.value; $('v-wpos').textContent = e.target.value+'%'; });
$('waveSize').addEventListener('input', e=>{ state.waveSize = +e.target.value; $('v-wsize').textContent = e.target.value+'px'; });
$('waveHeight').addEventListener('input', e=>{ state.waveHeight = +e.target.value; $('v-wamp').textContent = e.target.value+'px'; });
$('waveWidth').addEventListener('input', e=>{ state.waveWidth = +e.target.value; $('v-wwidth').textContent = e.target.value+'%'; });
// vị trí ngang sóng nhạc (trái ↔ phải) — 50% = giữa khung như mặc định
$('wavePosX').addEventListener('input', e=>{ state.wavePosX = +e.target.value; $('v-wposx').textContent = e.target.value+'%'; });
$('waveColor').addEventListener('input', e=>{ state.waveColor = e.target.value; });

// ---- slideshow nhiều ảnh (#slideshow) ----
// đổi ảnh giữa lúc ghi bị chặn ở input gốc (imgInput/slidesInput) — đảm bảo
// canvas không resize, raster cache không bị phá giữa chừng
let slideLoadToken = 0;
function updateSlideFields(){
  const hasSlides = state.slides.length > 0;
  const hasImg = !!state.img;
  const hasVideo = state.videos.length > 0;
  $('slideModeField').style.display = hasSlides ? '' : 'none';
  $('slideOrderField').style.display = hasSlides ? '' : 'none';
  $('slideShuffleBtn').style.display = (hasSlides && state.slideOrder === 'shuffle') ? '' : 'none';
  $('slideSecsField').style.display = (hasSlides && state.slideMode === 'time') ? '' : 'none';
  $('slideBeatField').style.display = (hasSlides && state.slideMode === 'time') ? '' : 'none';
  $('slideLookField').style.display = hasSlides ? '' : 'none';
  // fitMode dùng được cho ảnh đơn, slideshow ảnh, 1 video, slideshow video — hiện khi có nguồn bất kỳ
  $('slideFitField').style.display = (hasSlides || hasImg || hasVideo) ? '' : 'none';
  // 2026-09-17zq: dropdown chuyển nguồn (ảnh/video) — chỉ hiện khi có CẢ ảnh
  // (đơn hoặc slideshow) VÀ video (đơn hoặc slideshow). Không hiện khi chỉ 1 loại
  // vì lúc đó ưu tiên đã rõ (chỉ ảnh HOẶC chỉ video).
  $('sourceModeField').style.display = ((hasSlides || hasImg) && hasVideo) ? '' : 'none';
  // 2026-09-17zq: ảnh nền riêng (bgImg, cho "Ô vuông giữa") chỉ hiện khi đang
  // dùng 1 ảnh đơn — không áp dụng cho slideshow (sẽ rất phức tạp + không có
  // ý nghĩa với video vì video có khung hình riêng).
  const showBg = hasImg && !hasSlides && !hasVideo && state.fitMode === 'square';
  const bgEl = $('bgBox');
  if(bgEl) bgEl.style.display = showBg ? '' : 'none';
  $('slidesClearBtn').style.display = hasSlides ? '' : 'none';
}
// hiện/ẩn khối tuỳ chọn "Ô vuông giữa + nền mờ" theo fitMode đang chọn
function updateSquareFields(){
  const el = $('squareFields');
  if(el) el.style.display = (state.fitMode === 'square') ? '' : 'none';
  // 2026-09-17zq: ảnh nền riêng (bgBox) cũng phụ thuộc fitMode — hiện lại nếu
  // đang dùng 1 ảnh đơn + fitMode='square', ẩn nếu khác. Logic giống hệt
  // trong updateSlideFields nhưng KHÔNG gọi đệ quy (gây vòng lặp vô hạn).
  const hasImg = !!state.img;
  const hasSlides = state.slides.length > 0;
  const hasVideo = state.videos.length > 0;
  const showBg = hasImg && !hasSlides && !hasVideo && state.fitMode === 'square';
  const bgEl = $('bgBox');
  if(bgEl) bgEl.style.display = showBg ? '' : 'none';
}
$('slidesInput').addEventListener('change', async e=>{
  const files = [...e.target.files];
  if(!files.length) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi slideshow giữa chừng (bản ghi sẽ hỏng).', true); e.target.value=''; return; }
  const token = ++slideLoadToken;
  setStatus('Đang nạp ' + files.length + ' ảnh cho slideshow...', true);
  const loaded = [];
  for(const f of files){
    const looksImage = (f.type && f.type.startsWith('image')) || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name);
    if(!looksImage) continue;
    try{
      const url = URL.createObjectURL(f);
      const im = new Image();
      await new Promise((resolve, reject)=>{ im.onload = resolve; im.onerror = reject; im.src = url; });
      loaded.push({img: im, name: f.name});
    }catch(err){
      setStatus('Bỏ qua 1 ảnh không đọc được: ' + f.name, true);
    }
  }
  if(token !== slideLoadToken) return; // người dùng vừa chọn bộ khác — bỏ kết quả cũ
  if(!loaded.length){
    setStatus('Không có ảnh nào đọc được — chọn lại file png/jpg/webp nhé.', true);
    e.target.value = '';
    return;
  }
  state.slides = loaded;
  state.img = null; state.imgFile = null;      // slideshow thay thế ảnh nền đơn
  $('imgName').textContent = '(dùng slideshow: ' + loaded.length + ' ảnh)';
  $('slidesHint').textContent = loaded.length + ' ảnh';
  slideRasterCache.clear(); slideBlurCache.clear(); slideSchedule = {key:'', list:[]};
  updateSlideFields();
  checkReady();
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  setStatus('Slideshow đã nạp: ' + loaded.length + ' ảnh. Mỗi ảnh chạy Ken Burns riêng, đổi ảnh theo lựa chọn của bạn.', false);
  e.target.value = '';
});
$('slidesClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không xoá slideshow giữa chừng.', true); return; }
  state.slides = [];
  slideRasterCache.clear(); slideBlurCache.clear(); slideSchedule = {key:'', list:[]};
  $('slidesHint').textContent = '';
  updateSlideFields();
  setStatus('Đã xoá slideshow — trở lại dùng ảnh nền đơn.', false);
});
setupSel('slideModeSel','slideMode', ()=>{ updateSlideFields(); slideSchedule = {key:'', list:[]}; });
setupSel('slideOrderSel','slideOrder', ()=>{ updateSlideFields(); slideSchedule = {key:'', list:[]}; });
$('slideShuffleBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không xáo lại ảnh giữa chừng (bản ghi sẽ hỏng).', true); return; }
  if(!state.slides.length) return;
  state.slideShuffleSeed++;
  slideSchedule = {key:'', list:[]};
  saveSettingsSoon();
  setStatus('Đã xáo lại thứ tự ảnh slideshow.', false);
});
$('slideSecs').addEventListener('input', e=>{
  state.slideSecs = +e.target.value;
  $('v-ssecs').textContent = e.target.value + 's';
  slideSchedule = {key:'', list:[]};
});
setupSel('transSel','transition');
setupSel('fitSel','fitMode', ()=>{
  slideRasterCache.clear(); slideBlurCache.clear();
  if(typeof squareBlurCache !== 'undefined' && squareBlurCache.clear) squareBlurCache.clear();
  updateSquareFields();
});

// ---- tuỳ chọn bố cục "Ô vuông giữa + nền mờ" (fitMode 'square') ----
// state key trùng id slider; đổi blur/lệch blur → xoá cache nền mờ để dựng lại
const SQUARE_FMT = {
  bgBlur:     v => v + 'px',
  bgBlurSide: v => (v === 0 ? 'đều 2 bên' : (v < 0 ? 'trái +' + (-v) : 'phải +' + v)),
  sqSize:     v => v + '%',
  sqTilt:     v => v + '°',
  sqSkew:     v => v + '°'
};
['bgBlur','bgBlurSide','sqSize','sqTilt','sqSkew'].forEach(id=>{
  $(id).addEventListener('input', e=>{
    state[id] = +e.target.value;
    const lab = $('v-' + id);
    if(lab) lab.textContent = SQUARE_FMT[id](+e.target.value);
    if(typeof squareBlurCache !== 'undefined' && squareBlurCache.clear) squareBlurCache.clear();
  });
});
// 2026-09-17zp: 4 nút ↑↓←→ + "↺ Về giữa" cho state.sqX/sqY (dịch ảnh ô vuông khỏi
// trung tâm khi ảnh gốc chủ thể nằm lệch tâm). Bước dịch = state.sqStep (% chiều
// rộng/cao logic), mặc định 5%. Bấm nút → chỉ state, render loop tự vẽ lại.
function refreshSqXYLabel(){
  const el = $('v-sqXY'); if(!el) return;
  const x = Math.round(Number(state.sqX) || 0);
  const y = Math.round(Number(state.sqY) || 0);
  el.textContent = (x === 0 && y === 0) ? 'giữa (0, 0)' : ('x=' + x + '%, y=' + y + '%');
}
function shiftSq(dx, dy){
  const step = Math.max(1, Math.min(100, Number(state.sqStep) || 5));
  state.sqX = Math.max(-100, Math.min(100, (Number(state.sqX) || 0) + dx * step));
  state.sqY = Math.max(-100, Math.min(100, (Number(state.sqY) || 0) + dy * step));
  refreshSqXYLabel();
  saveSettingsSoon();
}
[
  ['sqUpBtn',    0, -1],
  ['sqDownBtn',  0,  1],
  ['sqLeftBtn', -1,  0],
  ['sqRightBtn', 1,  0]
].forEach(([id, dx, dy])=>{
  const el = $(id);
  if(!el) return;
  // 'click' cho tap chuột; 'pointerdown' thêm để bấm giữ trên desktop lặp nhanh
  el.addEventListener('click', ()=>shiftSq(dx, dy));
});
$('sqResetBtn').addEventListener('click', ()=>{
  state.sqX = 0; state.sqY = 0;
  refreshSqXYLabel();
  saveSettingsSoon();
});
$('sqStep').addEventListener('input', e=>{
  state.sqStep = +e.target.value;
  const lab = $('v-sqStep'); if(lab) lab.textContent = e.target.value + '%';
});

// ---- lyric: karaoke / kiểu chữ / hiệu ứng dòng (bổ sung cho section 10) ----
setupSel('lyricKaraokeSel','lyricKaraoke');
setupSel('lyricStyleSel','lyricStyle');
setupSel('lyricAnimSel','lyricAnim');
$('lyricAccent').addEventListener('input', e=>{ state.lyricAccent = e.target.value; });

// ---- cắt & đổ dần nhạc (mục 6) ----
function refreshTrimHint(){
  const el = $('secTrimHint'); if(!el) return;
  const s = Math.max(0, state.trimStart||0);
  const e = (state.trimEnd > s && state.trimEnd > 0) ? state.trimEnd : null;
  el.textContent = (s > 0 || e !== null) ? (fmtTime(s) + ' – ' + (e !== null ? fmtTime(e) : 'hết bài')) : 'Nguyên bài';
}
['trimStart','trimEnd','fadeIn','fadeOut'].forEach(id=>{
  $(id).addEventListener('change', e=>{
    if(isExporting){
      setStatus('Đang ghi video — không đổi cắt/fade giữa chừng (âm thanh bản ghi sẽ lệch).', true);
      return;
    }
    let v = Math.max(0, +e.target.value || 0);
    if(id === 'trimEnd' && v > 0){
      const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
      if(dur && v > dur) v = Math.floor(dur);
      if(v <= state.trimStart){ setStatus('Điểm kết thúc phải SAU điểm bắt đầu (' + state.trimStart.toFixed(1) + 's) — chưa áp.', true); v = 0; }
    }
    if(id === 'trimStart'){
      const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
      if(dur && v >= dur - 0.5){ setStatus('Điểm bắt đầu phải trước hết bài — chưa áp.', true); v = 0; }
      if(v > 0 && state.trimEnd > 0 && v >= state.trimEnd){ setStatus('Điểm bắt đầu phải TRƯỚC điểm kết thúc (' + state.trimEnd.toFixed(1) + 's) — chưa áp.', true); v = 0; }
    }
    state[id] = v;
    e.target.value = v;
    refreshTrimHint();
    saveSettingsSoon();
  });
});

// ---- tuỳ chọn xuất: fps + chất lượng ----
$('exportFpsSel').addEventListener('change', e=>{ state.exportFps = +e.target.value; saveSettingsSoon(); });
$('qualitySel').addEventListener('change', e=>{ state.exportQuality = e.target.value; saveSettingsSoon(); });
$('exportResSel').addEventListener('change', e=>{ state.exportRes = e.target.value; saveSettingsSoon(); });

// ---- C3: chuẩn hoá âm lượng (áp cho bước ghép FFmpeg của "⚡ Xuất nhanh") ----
$('loudnormSel').addEventListener('change', e=>{
  state.loudnorm = e.target.value === 'on';
  setStatus(state.loudnorm ? 'Sẽ chuẩn hoá âm lượng -14 LUFS khi "⚡ Xuất nhanh" (loudnorm một-pass).'
                           : 'Đã tắt chuẩn hoá âm lượng — giữ nguyên âm lượng gốc.', false);
  saveSettingsSoon();
});

// ---- E1: căn chuyển cảnh slideshow theo nhịp ----
$('slideBeatSel').addEventListener('change', e=>{
  state.slideBeatSnap = e.target.value === 'on';
  saveSettingsSoon();
});

// ---- E4: logo / watermark ----
// Lưu ý: ảnh logo KHÔNG nằm trong settings lưu localStorage (File object không
// persist được) — mở lại trang phải chọn lại logo; vị trí/cỡ/độ mờ thì được lưu.
let wmObjUrl = null;
$('wmInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(wmObjUrl){ URL.revokeObjectURL(wmObjUrl); wmObjUrl = null; }
  if(!f){
    state.wmImg = null; state.wmName = '';
    $('wmName').textContent = '(chưa chọn)';
    $('secWmHint').textContent = 'Chưa chọn logo';
    return;
  }
  if(!(f.type && f.type.startsWith('image'))){
    setStatus('File này không phải ảnh — chọn logo dạng PNG/JPG (PNG trong suốt là đẹp nhất).', true);
    e.target.value = '';
    return;
  }
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{
    state.wmImg = img; state.wmName = f.name;
    $('wmName').textContent = f.name;
    $('secWmHint').textContent = f.name;
  };
  img.onerror = ()=>{
    setStatus('Không đọc được ảnh logo này — chọn file ảnh khác nhé.', true);
    URL.revokeObjectURL(url);
    e.target.value = '';
  };
  img.src = url; wmObjUrl = url;
});
$('wmPosSel').addEventListener('change', e=>{ state.wmPos = e.target.value; saveSettingsSoon(); });
$('wmSize').addEventListener('input', e=>{
  state.wmSize = +e.target.value || 18;
  $('v-wmsize').textContent = state.wmSize + '%';
});
$('wmAlpha').addEventListener('input', e=>{
  state.wmAlpha = Math.max(0.05, Math.min(1, (+e.target.value || 60) / 100));
  $('v-wmalpha').textContent = e.target.value + '%';
});

// ---- lead / early-sync ----
$('leadMs').addEventListener('input', e=>{
  if(isExporting){
    // đổi delay giữa lúc ghi sẽ làm lệch nhịp audio của chính bản ghi — hoàn tác
    e.target.value = state.leadMs;
    $('v-lead').textContent = state.leadMs + ' ms';
    setStatus('Đang ghi video — không đổi độ đồng bộ sớm giữa chừng (âm thanh bản ghi sẽ lệch nhịp).', true);
    return;
  }
  state.leadMs = +e.target.value;
  $('v-lead').textContent = e.target.value+' ms';
  if(delayNode) delayNode.delayTime.value = state.leadMs/1000;
});

// ---- orientation (khổ dọc / khổ ngang, có tuỳ chỉnh kích thước cho khổ ngang) ----
const stageWrap = $('stageWrap');
state.orientation = 'portrait';
let appliedOrientation = 'portrait'; // khổ đã THỰC SỰ áp lên canvas — dùng hoàn tác khi đang ghi
function applyLandscapeCustomSize(){
  if(isExporting){
    // đổi kích thước canvas giữa lúc captureStream đang ghi sẽ làm hỏng track video
    $('customW').value = canvas.width;
    $('customH').value = canvas.height;
    setStatus('Đang ghi video — không đổi kích thước khung hình giữa chừng (bản ghi sẽ hỏng).', true);
    return;
  }
  const w = Math.max(480, Math.min(3840, +$('customW').value || 1280));
  const h = Math.max(270, Math.min(2160, +$('customH').value || 720));
  canvas.width = w; canvas.height = h;
  logicW = w; logicH = h;
  stageWrap.style.aspectRatio = w+'/'+h;
  rebuildParticles();
}
function setOrientation(o){
  if(isExporting){
    // đổi select đã ghi state.orientation = o — hoàn tác về khổ đang áp dụng
    state.orientation = appliedOrientation;
    setSelValue('ratioSel','orientation', appliedOrientation);
    setStatus('Đang ghi video — không đổi khổ dọc/ngang giữa chừng (bản ghi sẽ hỏng).', true);
    return;
  }
  appliedOrientation = o;
  if(o === 'landscape'){
    $('customSizeField').style.display = '';
    applyLandscapeCustomSize();
  } else {
    $('customSizeField').style.display = 'none';
    canvas.width = 720; canvas.height = 1280;
    logicW = 720; logicH = 1280;
    stageWrap.style.aspectRatio = '9/16';
    rebuildParticles();
  }
}
setupSel('ratioSel','orientation', ()=> setOrientation(state.orientation));
$('customW').addEventListener('change', applyLandscapeCustomSize);
$('customH').addEventListener('change', applyLandscapeCustomSize);

// ---- lyrics controls ----
$('srtInput').addEventListener('change', async e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi lời giữa chừng (lời sẽ lệch bản ghi). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  let text;
  try { text = await f.text(); }
  catch(err){
    setStatus('Không đọc được file SRT này: ' + (err && err.message ? err.message : String(err)), true);
    e.target.value = '';
    return;
  }
  loadLyricsFromText(text, f.name);
});
$('loadSrtPasteBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không đổi lời giữa chừng (lời sẽ lệch bản ghi). Chờ ghi xong rồi đổi nhé.', true); return; }
  const text = $('srtPaste').value;
  if(!text.trim()){ setStatus('Dán nội dung SRT vào ô trước đã nhé.', true); return; }
  loadLyricsFromText(text, 'Đã dán');
});
$('lyricFont').addEventListener('change', e=>{ state.lyricFont = e.target.value; });
$('lyricSize').addEventListener('input', e=>{ state.lyricSize = +e.target.value; $('v-lsize').textContent = e.target.value+'px'; });
$('lyricColor').addEventListener('input', e=>{ state.lyricColor = e.target.value; });
setupSel('lyricShadowSel','lyricShadowRaw', ()=>{ state.lyricShadow = (state.lyricShadowRaw === 'on'); });
$('lyricPosX').addEventListener('input', e=>{ state.lyricPosX = +e.target.value; $('v-lposx').textContent = e.target.value+'%'; });
$('lyricPosY').addEventListener('input', e=>{ state.lyricPosY = +e.target.value; $('v-lposy').textContent = e.target.value+'%'; });

// đồng bộ UI waveCurve (label + field ẩn/hiện) ngay khi khởi tạo — phòng
// trường hợp settings cũ đã lưu waveStyle='curved' nhưng field mặc định ẩn
(function(){
  const sl = $('waveCurve'); if(!sl) return;
  const v = Math.round((state.waveCurve == null ? 0 : +state.waveCurve) * 100);
  sl.value = String(v);
  const lbl = $('v-wcurve'); if(lbl) lbl.textContent = v + '%';
  // 2026-09-18j: đổ option "Kiểu sóng được uốn" từ waveStyleSel (trừ ✕ Tắt và
  // chính "Uốn cong") — một nguồn nhãn, không lệch khi thêm kiểu mới
  const bsel = $('waveBendBaseSel');
  const src = $('waveStyleSel');
  if(bsel && src){
    bsel.innerHTML = '';
    Array.prototype.forEach.call(src.options, op=>{
      if(op.value === 'off' || op.value === 'bend') return;
      const o = document.createElement('option');
      o.value = op.value; o.textContent = op.textContent;
      bsel.appendChild(o);
    });
    bsel.value = state.waveBendBase;
    if(bsel.selectedIndex < 0) bsel.value = 'line';
  }
  const f = $('waveCurveField'); const h = $('waveCurveHint');
  const on = (state.waveStyle === 'curved' || state.waveStyle === 'bend');
  if(f) f.style.display = on ? '' : 'none';
  if(h) h.style.display = on ? '' : 'none';
  const bf = $('waveBendBaseField');
  if(bf) bf.style.display = (state.waveStyle === 'bend') ? '' : 'none';
  // 2026-09-18m: giá trị "Điểm uốn" + ẩn/hiện (fallback khai báo — không để rỗng)
  const asel = $('waveBendAnchorSel');
  if(asel){
    asel.value = (state.waveBendAnchor === 'center' || state.waveBendAnchor === 'end')
      ? state.waveBendAnchor : 'start';
    const af = $('waveBendAnchorField');
    if(af) af.style.display = (state.waveStyle === 'bend') ? '' : 'none';
  }
  // 2026-09-18n: hướng vồng — fallback 'up' nếu state rỗng/giá trị lạ
  const ssel = $('waveBendSideSel');
  if(ssel){
    ssel.value = (state.waveBendSide === 'down') ? 'down' : 'up';
    const sf = $('waveBendSideField');
    if(sf) sf.style.display = (state.waveStyle === 'bend') ? '' : 'none';
  }
})();

rebuildParticles();

// ---- #4: nhớ cài đặt giữa các lần mở tool (localStorage, best-effort) ----
// Khôi phục bằng cách set giá trị rồi dispatch lại event — listener sẵn có
// sẽ tự cập nhật state + nhãn + rebuild, nên không phải nhân bản logic.
const SETTINGS_KEY = 'imzic:settings:v1';
const SETTINGS_RANGE_IDS = ['zoomMin','zoomMax','sensitivity','smoothness','density','pspeed','sizeMin','sizeMax','alpha','wavePos','wavePosX','waveSize','waveHeight','waveWidth','leadMs','fxLevel','lyricSize','lyricPosX','lyricPosY','slideSecs','wmSize','wmAlpha','waveCurve','bgBlur','bgBlurSide','sqSize','sqTilt','sqSkew','sqStep'];
// 2026-09-17zp: sqX/sqY lưu riêng vì do nút bấm dịch chuyển (không qua range)
const SETTINGS_SQXY = ['sqX','sqY','sourceMode'];
const SETTINGS_COLOR_IDS = ['pcolor','waveColor','lyricColor','lyricAccent'];
const SETTINGS_SELECT_IDS = ['lyricFont','effectSel','dirSel','waveStyleSel','ratioSel','lyricShadowSel','fxSel','slideModeSel','slideOrderSel','transSel','fitSel','lyricKaraokeSel','lyricStyleSel','lyricAnimSel','exportFpsSel','qualitySel','exportResSel','bcPresetSel','loudnormSel','slideBeatSel','wmPosSel','waveCurveDirSel','waveBendBaseSel','waveBendAnchorSel','waveBendSideSel'];
const SETTINGS_NUMBER_IDS = ['customW','customH','trimStart','trimEnd','fadeIn','fadeOut'];
// chip-group đã gom thành dropdown — bản lưu cũ có {chips:{}} được đổi tên ở loadSettings.
// waveChips bản cũ là bật/tắt ('on'/'off') → hợp nhất vào waveStyleSel ('off' = tắt).
const LEGACY_CHIP_TO_SEL = { effectChips:'effectSel', dirChips:'dirSel', waveChips:'waveStyleSel', waveStyleChips:'waveStyleSel', ratioChips:'ratioSel', lyricShadowChips:'lyricShadowSel' };

function collectSettingsInputs(){
  const inputs = {};
  SETTINGS_RANGE_IDS.concat(SETTINGS_COLOR_IDS, SETTINGS_SELECT_IDS, SETTINGS_NUMBER_IDS).forEach(id=>{
    const el = $(id); if(el) inputs[id] = el.value;
  });
  // 2026-09-17zp: sqX/sqY đi theo state (nút bấm không qua input range)
  SETTINGS_SQXY.forEach(id=>{ if(state[id] !== undefined) inputs[id] = state[id]; });
  const srtBox = $('srtPaste'); if(srtBox) inputs.srtPaste = srtBox.value.slice(0, 20000);
  // E6: Text lên màn hình (mục 11) — đi cùng preset / hàng chờ / dự án .json
  inputs.textLines = JSON.stringify(state.textLines || []);
  return inputs;
}
function saveSettings(){
  try{
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({v:1, inputs: collectSettingsInputs()}));
  }catch(e){
    // tiện ích best-effort: localStorage có thể bị khoá theo origin — không để chết tool
    console.warn('[I-MZic] Không lưu được cài đặt:', e && e.message);
  }
}
let saveSettingsTimer = null;
function saveSettingsSoon(){
  if(saveSettingsTimer) clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(saveSettings, 400);
}
// áp một object inputs (từ localStorage hoặc preset) vào UI + state bằng cách
// set giá trị rồi dispatch event — listener sẵn có tự cập nhật, không nhân bản logic
function applySettingsInputs(inp){
  // 1) giá trị số phải vào TRƯỚC — select khổ ngang đổi sẽ đọc customW/H ngay
  SETTINGS_NUMBER_IDS.forEach(id=>{ if(inp[id] !== undefined && $(id)) $(id).value = inp[id]; });
  // 2) chips bản cũ (trước khi gom dropdown) — đổi tên sang select rồi dispatch
  //    change để listener sẵn có tự chạy callback (đổi khổ, màu mặc định…)
  if(inp.chips){
    // waveChips bản cũ là bật/tắt: 'off' → kiểu 'off'; 'on' → bỏ (giữ kiểu sóng
    // đã lưu trong waveStyleChips để không bật sóng kiểu rỗng)
    if(typeof inp.chips.waveChips === 'string' && inp.chips.waveChips !== 'off') delete inp.chips.waveChips;
    Object.keys(LEGACY_CHIP_TO_SEL).forEach(gid=>{
      const v = inp.chips[gid];
      const el = v !== undefined ? $(LEGACY_CHIP_TO_SEL[gid]) : null;
      if(el && el.value !== String(v)){ el.value = String(v); el.dispatchEvent(new Event('change')); }
    });
  }
  // 3) khổ ngang: áp kích thước tuỳ chỉnh đã lưu
  if(state.orientation === 'landscape'){
    ['customW','customH'].forEach(id=>{ if(inp[id] !== undefined && $(id)) $(id).dispatchEvent(new Event('change')); });
  }
  // 3b) bản lưu cũ (era dropdown, trước 2026-09-16): bật/tắt sóng là select riêng
  //     waveOnSel — đã gỡ khỏi UI nên hợp nhất vào waveStyleSel ('off' = tắt)
  if(inp.waveOnSel !== undefined){
    if(inp.waveOnSel === 'off' && inp.waveStyleSel !== undefined) inp.waveStyleSel = 'off';
    delete inp.waveOnSel;
  }
  // 4) range + màu + select — dispatch để listener cũ tự cập nhật state/nhãn
  SETTINGS_RANGE_IDS.forEach(id=>{ if(inp[id] !== undefined && $(id)){ $(id).value = inp[id]; $(id).dispatchEvent(new Event('input')); } });
  SETTINGS_COLOR_IDS.forEach(id=>{ if(inp[id] !== undefined && $(id)){ $(id).value = inp[id]; $(id).dispatchEvent(new Event('input')); } });
  SETTINGS_SELECT_IDS.forEach(id=>{ if(inp[id] !== undefined && $(id)){ $(id).value = inp[id]; $(id).dispatchEvent(new Event('change')); } });
  // 2026-09-17zp: khôi phục sqX/sqY (đi cùng state, nhãn hiển thị phải tự vẽ lại)
  SETTINGS_SQXY.forEach(id=>{
    if(inp[id] !== undefined){ state[id] = +inp[id] || 0; }
  });
  if(typeof refreshSqXYLabel === 'function') refreshSqXYLabel();
  // 5) ô dán SRT: chỉ điền lại nội dung — không tự nạp lời
  if(inp.srtPaste && $('srtPaste')) $('srtPaste').value = inp.srtPaste;
  // 6) Text lên màn hình (mục 11) — hàm của imzic-text.js (nạp trước controls)
  if(inp.textLines !== undefined && typeof imzicTextApplySaved === 'function') imzicTextApplySaved(inp.textLines);
}
function loadSettings(){
  let data = null;
  try{ data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); }catch(e){ return; }
  if(!data || data.v !== 1 || !data.inputs) return;
  try{
    // bản lưu rất cũ có chips ở cấp data — chuyển xuống inputs cho apply chung
    if(data.chips && data.inputs.chips === undefined) data.inputs.chips = data.chips;
    applySettingsInputs(data.inputs);
  }catch(e){
    console.warn('[I-MZic] Cài đặt đã lưu bị hỏng, bỏ qua:', e && e.message);
  }
}
// mọi thay đổi của người dùng → lưu lại (debounce 400ms)
SETTINGS_RANGE_IDS.concat(SETTINGS_COLOR_IDS).forEach(id=>{
  const el = $(id); if(el) el.addEventListener('input', saveSettingsSoon);
});
SETTINGS_SELECT_IDS.concat(SETTINGS_NUMBER_IDS).forEach(id=>{
  const el = $(id); if(el) el.addEventListener('change', saveSettingsSoon);
});
const srtBox = $('srtPaste'); if(srtBox) srtBox.addEventListener('input', saveSettingsSoon);
// loadSettings() được gọi SAU khi `let isExporting` được khai báo (bên dưới):
// các listener nó kích hoạt (leadMs, setOrientation…) đều đọc isExporting.

// ---- status helper ----
function setStatus(msg, active){
  $('statusLine').textContent = msg || '';
  $('statusLine').classList.toggle('active', !!active);
}

// ---- EXPORT: video hình + nhạc gốc riêng (video-only, lossless-safe) ----
$('exportSilentBtn').addEventListener('click', async ()=>{
  await recordAndExport(false);
});
// ---- EXPORT: video kèm nhạc (re-encoded, tiện dùng ngay) ----
$('exportAudioBtn').addEventListener('click', async ()=>{
  await recordAndExport(true);
});

let isExporting = false;
// Cờ cho trang cha (index.html) đọc same-origin: đang ghi thì chặn chuyển tool,
// vì Chromium throttle canvas trong iframe ẩn → video xuất ra bị đứng hình.
Object.defineProperty(window, '__imzicExporting', { get(){ return isExporting === true; } });
let activeExportCancel = null; // hàm huỷ bản ghi đang chạy — gọi từ nút "✕ Huỷ ghi"
let activeExportRecorder = null; // recorder realtime đang chạy — render loop chốt file khi tới điểm trim kết thúc
let lastSilentBlob = null;     // blob video câm vừa xuất — cho nút "⚡ Ghép nhạc tự động"
function finishExportUI(){
  isExporting = false;
  activeExportRecorder = null;
  activeExportCancel = null;
  $('cancelExportBtn').style.display = 'none';
  $('progWrap').style.display = 'none';
}
// giờ mới an toàn để khôi phục cài đặt: mọi listener đã đăng ký + isExporting đã khởi tạo
loadSettings();
