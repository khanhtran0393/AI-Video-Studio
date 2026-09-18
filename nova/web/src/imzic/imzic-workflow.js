'use strict';

/* imzic-workflow.js — Reset toàn bộ tool + 🗑 Xoá dữ liệu (giữ cài đặt) + 🎲 Tự động
 * chọn hiệu ứng + Hàng chờ xuất video nhiều sản phẩm. Thêm ngày 2026-09-15 (KHÔNG
 * thuộc 12 file tách từ img-to-vid-panel.js) — nạp CUỐI CÙNG trong img-to-vid.html, sau imzic-export.js:
 * mọi lệnh chạy ngay ở đây chỉ đọc tên ($, state, isExporting, imzNative,
 * applySettingsInputs, exportOffline…) đã khai báo ở các file trước — đúng ràng
 * buộc thứ tự nạp của AGENTS.md §8. Không import/export (renderer không build step).
 *
 * Hàng chờ chỉ sống trong phiên (File object không persist được) — ghi rõ trong UI.
 * Xuất hàng loạt dùng "⚡ Xuất nhanh" (exportOffline) với autoSave {dir,name}:
 * IPC imzic-offline-export nhận thêm saveDir/saveName → bỏ hộp thoại lưu,
 * tự đặt tên file theo từng mục và KHÔNG ghi đè file có sẵn (thêm hậu tố " (n)").
 */

// 2026-09-17zu (mitigation 3): helper đọc File → dataUrl (base64) để lưu vào
// hàng chờ; tái dựng File từ dataUrl khi apply. Giới hạn 5 MB/ file để queue
// JSON không phình quá localStorage quota (5-10 MB) — vượt → setStatus cảnh báo
// + skip lưu (chỉ lưu tên, hàng chờ chạy sẽ fail lộ liễu khi apply).
const IMZIC_QUEUE_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
function imzFileToDataUrl(f){
  return new Promise((resolve, reject)=>{
    if(!f) { reject(new Error('Không có file')); return; }
    if(typeof f.size === 'number' && f.size > IMZIC_QUEUE_FILE_MAX_BYTES){
      reject(Object.assign(new Error('File ' + f.name + ' quá lớn (' + (f.size/1024/1024).toFixed(1) + ' MB > 5 MB) — không lưu được vào hàng chờ. Chạy ngay trong phiên hoặc dùng file nhỏ hơn.'), { code: 'IMZIC_QUEUE_FILE_TOO_BIG', size: f.size }));
      return;
    }
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = ()=> reject(Object.assign(new Error('Đọc file thất bại: ' + f.name), { code: 'IMZIC_QUEUE_READ_FAIL' }));
    fr.readAsDataURL(f);
  });
}
async function imzDataUrlToFile(dataUrl, name, type){
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: type || blob.type || 'application/octet-stream' });
}

// ---- 🧹 RESET toàn bộ tool ----
$('resetBtn').addEventListener('click', async ()=>{
  if(isExporting){ setStatus('Đang ghi video — không Reset giữa chừng. Chờ xong (hoặc bấm ✕ Huỷ ghi) đã nhé.', true); return; }
  const ok = await imzModalConfirm({
    title:'🧹 Reset toàn bộ I-MZic?',
    message:'• Xoá ảnh / nhạc / SRT đang chọn\n• Trả MỌI cài đặt về mặc định (preset đã lưu vẫn giữ nguyên)\n• Xoá hàng chờ xuất',
    okText:'Reset',
    danger:true
  });
  if(!ok) return;
  try{ localStorage.removeItem(SETTINGS_KEY); }catch(e){}
  // reload iframe = trạng thái sạch tuyệt đối, không tự "suy đoán" giá trị mặc định
  location.reload();
});

// ---- 🗑 XOÁ DỮ LIỆU ----
// Khác 🧹 Reset: CHỈ bỏ dữ liệu đang chọn (ảnh/slideshow/nhạc/lời/logo) + cache
// của phiên (phân tích offline, raster/blur khung, lịch slideshow) — GIỮ NGUYÊN
// mọi cài đặt và KHÔNG reload trang. Muốn reset cả cài đặt dùng 🧹 Reset.
$('clearDataBtn').addEventListener('click', async ()=>{
  if(isExporting){ setStatus('Đang ghi video — không xoá dữ liệu giữa chừng. Chờ ghi xong (hoặc bấm ✕ Huỷ ghi) đã nhé.', true); return; }
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy — chờ xong rồi xoá dữ liệu nhé.', true); return; }
  const hasData = !!(state.imgFile || state.slides.length || state.audioFile
    || (state.lyricsCues && state.lyricsCues.length) || state.bgFile || state.wmImg
    || state.videoFile || state.videos.length);
  if(!hasData){ setStatus('Chưa có dữ liệu nào để xoá — chọn ảnh + nhạc trước đã.', false); return; }
  const ok = await imzModalConfirm({
    title:'🗑 Xoá toàn bộ dữ liệu đang dùng?',
    message:'• Bỏ ảnh / slideshow / nhạc / lời bài hát / logo đang chọn\n• Xoá cache phân tích nhịp + cache dựng khung (tool tự tính lại khi cần)\n• GIỮ NGUYÊN mọi cài đặt (muốn reset cả cài đặt thì dùng 🧹 Reset)',
    okText:'Xoá dữ liệu',
    danger:true
  });
  if(!ok) return;

  // 1) nhạc: dừng phát + thu hồi object URL + bỏ file
  try{ audioEl.pause(); }catch(e){}
  state.playing = false; $('playBtn').textContent = '▶ Phát thử';
  state.audioFile = null; state.audioReady = false;
  if(audObjUrl){ try{ URL.revokeObjectURL(audObjUrl); }catch(e){} audObjUrl = null; }
  audioEl.removeAttribute('src'); audioEl.load();
  $('audName').textContent = 'Chọn file nhạc';
  if($('audInput')) $('audInput').value = '';

  // 2) ảnh + slideshow + ảnh nền riêng
  state.img = null; state.imgFile = null; state.slides = [];
  if(imgObjUrl){ try{ URL.revokeObjectURL(imgObjUrl); }catch(e){} imgObjUrl = null; }
  $('imgName').textContent = 'Chọn ảnh nền';
  if($('imgInput')) $('imgInput').value = '';
  if($('slidesInput')) $('slidesInput').value = '';
  if($('slidesHint')) $('slidesHint').textContent = '';
  state.bgImg = null; state.bgFile = null;
  $('bgName').textContent = 'Chọn ảnh nền riêng (tuỳ chọn)';
  if($('bgInput')) $('bgInput').value = '';
  if($('bgClearBtn')) $('bgClearBtn').style.display = 'none';

  // 2.5) video: gỡ <video> ẩn + thu hồi URL (imzicClearVideos có sẵn trong imzic-render)
  if(typeof imzicClearVideos === 'function') imzicClearVideos();

  // 3) logo / watermark
  state.wmImg = null; state.wmName = '';
  if($('wmName')) $('wmName').textContent = '(chưa chọn)';
  if($('wmInput')) $('wmInput').value = '';

  // 4) lời bài hát (lyricsVersion++ hạ cache wrap lời + lịch slideshow 'cue')
  state.lyricsCues = []; state._lastLyricIdx = -2; lyricsVersion++;
  $('srtName').textContent = 'Chọn file .srt / .lrc';
  if($('srtInput')) $('srtInput').value = '';
  if($('srtPaste')) $('srtPaste').value = '';

  // 5) cache: phân tích offline (nhịp/envelope) + raster/blur khung + lịch slideshow
  offlineAnalysis = null; offlineAnalysisPromise = null;
  slideRasterCache.clear(); slideBlurCache.clear(); squareBlurCache.clear();
  if(typeof imageBlurCache !== 'undefined' && imageBlurCache.clear) imageBlurCache.clear();
  slideSchedule = { key:'', list:[] };
  rebuildParticles();

  // 6) UI về trạng thái trống như mới mở tool (giữ nguyên cài đặt)
  emptyState.style.display = '';
  const seek = $('seekBar'); seek.value = 0; seek.disabled = true;
  $('tCur').textContent = '0:00'; $('tDur').textContent = '0:00';
  ['playBtn','restartBtn','exportAudioBtn','exportSilentBtn','exportOfflineBtn','snapshotBtn'].forEach(id=>{ $(id).disabled = true; });
  $('exportOpts').style.display = 'none';
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  if(typeof saveSettingsSoon === 'function') saveSettingsSoon();
  setStatus('Đã xoá toàn bộ dữ liệu + cache. Cài đặt giữ nguyên — chọn lại ảnh + nhạc là xem tiếp được.', false);
});

// ---- 🎲 TỰ ĐỘNG CHỌN HIỆU ỨNG ----
// Ghép ngẫu nhiên một bộ hài hoà: hạt bay + hướng + tham số + sóng nhạc + FX toàn
// khung. Cố tình KHÔNG chọn milkdrop (cần nhạc phát thật, không dùng được với
// "⚡ Xuất nhanh") và chromakey (chỉ có nghĩa với nền xanh). Lựa chọn chỉ là
// "người dùng bấm chọn hộ" — khi xuất, render vẫn deterministic theo state (Luật 8).
function imzicAutoEffect(){
  if(isExporting){ setStatus('Đang ghi video — không đổi hiệu ứng giữa chừng (bản ghi sẽ hỏng).', true); return; }
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy — chờ xong rồi thử hiệu ứng mới nhé.', true); return; }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dispatch = (id, ev) => { const el = $(id); if(el) el.dispatchEvent(new Event(ev)); };

  // 1) hạt bay + màu mặc định theo hiệu ứng (listener change của effectSel tự lo)
  const eff = pick(['none', 'snow', 'leaves', 'stars', 'rain', 'bubbles', 'petals', 'fireflies', 'hearts', 'bokeh', 'sparks']);
  $('effectSel').value = eff; dispatch('effectSel', 'change');
  // 2) hướng bay — đa số để random, thỉnh thoảng cố định một hướng
  const dir = (Math.random() < 0.55) ? 'random' : pick(['left', 'right', 'down', 'up', 'center']);
  $('dirSel').value = dir; dispatch('dirSel', 'change');
  // 3) tham số hạt trong khoảng dễ chịu
  const density = pick([30, 40, 60, 70, 90, 120]);
  const speed = pick([60, 80, 100, 120, 160]);
  const alpha = pick([70, 80, 85, 90, 100]);
  $('density').value = String(density); dispatch('density', 'input');
  $('pspeed').value = String(speed); dispatch('pspeed', 'input');
  $('alpha').value = String(alpha); dispatch('alpha', 'input');
  // 4) sóng nhạc: ~2/3 lần bật — bật/tắt nằm ngay "Kiểu sóng" ('off' = tắt)
  const waveOn = (Math.random() < 0.65);
  let waveStyle = 'off';
  if(waveOn){
    waveStyle = pick(['line', 'ribbon', 'bars', 'circular', 'bottombars', 'arc', 'glow', 'twin', 'spiral', 'neon', 'curved']);
    $('waveColor').value = pick(['#9b8bff', '#7dd3fc', '#fca5a5', '#86efac', '#fcd34d', '#f0abfc', '#a5b4fc', '#5eead4']);
    dispatch('waveColor', 'input');
  }
  $('waveStyleSel').value = waveStyle; dispatch('waveStyleSel', 'change');
  // 5) FX toàn khung — danh sách an toàn cho xuất nhanh
  const fx = pick(['none', 'none', 'none', 'pulse', 'godrays', 'lightleak', 'zoomblur', 'aurora', 'huecycle', 'motionblur']);
  $('fxSel').value = fx; dispatch('fxSel', 'change');
  const fxLevel = pick([30, 40, 50, 60, 70]);
  $('fxLevel').value = String(fxLevel); dispatch('fxLevel', 'input');

  if(typeof saveSettingsSoon === 'function') saveSettingsSoon();
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  const effLabel = (eff === 'none') ? 'không hạt bay'
    : ({ snow: 'tuyết bay', leaves: 'lá rơi', stars: 'sao bay', rain: 'mưa bay',
         bubbles: 'bong bóng bay', petals: 'cánh hoa rơi', fireflies: 'đom đóm',
         hearts: 'tim bay', bokeh: 'bokeh mờ', sparks: 'tia lửa' })[eff];
  const fxLabel = (fx === 'none') ? 'không FX' : 'FX ' + fx;
  setStatus('🎲 Đã chọn bộ hiệu ứng: ' + effLabel + ' (mật độ ' + density + ', tốc ' + speed
    + '%)' + (waveOn ? ' + sóng nhạc "' + waveStyle + '"' : ' + không sóng')
    + ' + ' + fxLabel + '. Bấm lại để đổi bộ khác.', false);
}
$('autoFxBtn').addEventListener('click', imzicAutoEffect);

// ---- HÀNG CHỜ XUẤT VIDEO ----
const imzicQueue = [];            // { name, imgFile, slides, audioFile, settings, status, resultPath }
let imzicQueueRunning = false;
let imzicQueueStopFlag = false;
let imzicQueueDir = null;         // thư mục lưu do người dùng chọn 1 lần (IPC imzic-pick-dir)
const IMZIC_QUEUE_DIR_KEY = 'imzic:queueDir:v1';
try{ imzicQueueDir = localStorage.getItem(IMZIC_QUEUE_DIR_KEY) || null; }catch(e){}

// bridge native của trang cha (iframe cùng origin) — giống muxBtn/exportOffline
function imzicQueueNat(){
  return (typeof imzNative === 'function') ? imzNative() : null;
}

function imzicEscapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

const IMZIC_QUEUE_STATUS_LABEL = {
  pending:  'Đang chờ',
  running:  '⏳ Đang xuất…',
  done:     '✅ Xong',
  error:    '❌ Lỗi',
  canceled: '⛔ Đã bỏ qua',
};


function imzicQueueRefreshUI(){
  const list = $('queueList'); if(!list) return;
  list.innerHTML = '';
  imzicQueue.forEach((it, i)=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:7px 10px;background:var(--panel-2);';
    const label = document.createElement('div');
    label.style.cssText = 'flex:1;min-width:0;font-size:12px;';
    const sub = (it.status === 'done' && it.resultPath)
      ? '<div style="font-size:10.5px;color:var(--green);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + imzicEscapeHtml(it.resultPath) + '">' + imzicEscapeHtml(it.resultPath) + '</div>'
      : '';
    label.innerHTML = '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + (i + 1) + '. ' + imzicEscapeHtml(it.name) + '</div>'
      + '<div style="color:' + (it.status === 'error' ? 'var(--red)' : 'var(--muted)') + ';">'
      + (IMZIC_QUEUE_STATUS_LABEL[it.status] || it.status) + '</div>' + sub;
    row.appendChild(label);
    const mkBtn = (txt, title, fn, dis) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = txt; b.title = title;
      b.style.cssText = 'padding:4px 8px;font-size:12px;min-width:0;';
      b.disabled = !!dis;
      b.addEventListener('click', fn);
      row.appendChild(b);
    };
    const locked = imzicQueueRunning;
    mkBtn('▲', 'Chuyển lên trên', ()=>{ if(i > 0){ const t = imzicQueue[i-1]; imzicQueue[i-1] = imzicQueue[i]; imzicQueue[i] = t; imzicQueueRefreshUI(); } }, locked || i === 0);
    mkBtn('▼', 'Chuyển xuống dưới', ()=>{ if(i < imzicQueue.length-1){ const t = imzicQueue[i+1]; imzicQueue[i+1] = imzicQueue[i]; imzicQueue[i] = t; imzicQueueRefreshUI(); } }, locked || i === imzicQueue.length-1);
    mkBtn('✕', 'Bỏ mục này', ()=>{ if(locked){ setStatus('Hàng chờ đang chạy — không bỏ mục giữa chừng (dùng ⏹ Dừng).', true); return; } imzicQueue.splice(i, 1); imzicQueueRefreshUI(); }, locked);
    list.appendChild(row);
  });
  const nDone = imzicQueue.filter(x => x.status === 'done').length;
  const hintEl = $('secQueueHint'); if(hintEl) hintEl.textContent = imzicQueue.length ? (nDone + '/' + imzicQueue.length + ' xong') : 'Trống';
  const dirBtn = $('queueDirBtn');
  if(dirBtn){
    const short = imzicQueueDir ? (imzicQueueDir.split(/[\\/]/).pop() || imzicQueueDir) : null;
    dirBtn.textContent = '📁 ' + (short ? short : 'Thư mục lưu…');
    dirBtn.title = imzicQueueDir || 'Chọn thư mục lưu file xuất của hàng chờ';
  }
}
imzicQueueRefreshUI();

// ➕ thêm mục = chụp nhanh ảnh/slideshow + nhạc + TOÀN BỘ cài đặt hiện tại
$('queueAddBtn').addEventListener('click', async ()=>{
  if(isExporting || imzicQueueRunning){ setStatus('Đang xuất video — chờ xong rồi thêm mục mới nhé.', true); return; }
  if(!state.audioFile){ setStatus('Chưa có nhạc — chọn nhạc trước khi thêm vào hàng chờ.', true); return; }
  if(!state.img && !state.slides.length && !state.videos.length){
    setStatus('Chưa có ảnh, slideshow ảnh, hoặc video — chọn trước khi thêm vào hàng chờ.', true); return;
  }
  const name = (state.audioFile.name.replace(/\.[^.]+$/, '') || 'video');
  // 2026-09-17zu (mitigation 3): chuyển File video → dataUrl base64 để lưu vào
  // hàng chờ (File không serialize được). Giới hạn 5 MB/ file; quá lớn → lưu
  // chỉ tên + setStatus cảnh báo (mục sẽ fail lộ liễu khi apply, user tự xử lý).
  let videoFileItem = null;
  if(state.videoFile){
    try{
      const dataUrl = await imzFileToDataUrl(state.videoFile);
      videoFileItem = { name: state.videoFile.name, size: state.videoFile.size, type: state.videoFile.type, dataUrl };
    }catch(err){
      setStatus('⚠ ' + (err.message || 'Không đọc được file video để lưu hàng chờ') + ' — mục chỉ lưu tên, sẽ fail khi chạy nếu đóng phiên.', true);
      videoFileItem = { name: state.videoFile.name, size: state.videoFile.size, type: state.videoFile.type, dataUrl: null };
    }
  }
  imzicQueue.push({
    name,
    imgFile: state.imgFile || null,
    // slideshow giữ nguyên ảnh đã decode (Image object) — nạp lại tức thì khi chạy
    slides: state.slides.length ? state.slides.map(s => ({ img: s.img, name: s.name })) : null,
    // 2026-09-17zu: video 1 file — lưu dataUrl nếu ≤ 5 MB; quá lớn → dataUrl null
    videoFile: videoFileItem,
    // 2026-09-17zu: slideshow video — hiện chỉ lưu tên (state.videos[i].el là
    // HTMLVideoElement chứ không phải File, không có File gốc để đọc dataUrl).
    // TODO nâng cấp: lưu File gốc vào state.videosFiles[] song song để đọc dataUrl.
    videoSlides: state.videos.length ? state.videos.map(v => ({ name: v.name })) : null,
    audioFile: state.audioFile,
    settings: collectSettingsInputs(),
    status: 'pending',
    resultPath: null,
  });
  imzicQueueRefreshUI();
  setStatus('Đã thêm "' + name + '" vào hàng chờ (' + imzicQueue.length + ' mục). Chọn thư mục lưu (nếu chưa) rồi bấm ▶ Xuất tất cả.', false);
});

$('queueClearBtn').addEventListener('click', ()=>{
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy — bấm ⏹ Dừng trước đã.', true); return; }
  if(!imzicQueue.length){ setStatus('Hàng chờ đang trống.', true); return; }
  imzicQueue.length = 0;
  imzicQueueRefreshUI();
  setStatus('Đã xoá hết mục trong hàng chờ.', false);
});

// 📁 chọn thư mục lưu 1 lần — IPC imzic-pick-dir (dialog openDirectory trong app)
$('queueDirBtn').addEventListener('click', async ()=>{
  const nat = imzicQueueNat();
  if(!nat || typeof nat.imzicPickDir !== 'function'){
    setStatus('Chọn thư mục chỉ chạy trong app Nova (cần IPC "imzic-pick-dir"). Hàng chờ tự lưu file nên bắt buộc chạy trong app.', true);
    return;
  }
  try{
    const r = await nat.imzicPickDir();
    if(r && r.ok && r.path){
      imzicQueueDir = r.path;
      try{ localStorage.setItem(IMZIC_QUEUE_DIR_KEY, imzicQueueDir); }catch(e){}
      imzicQueueRefreshUI();
      setStatus('Thư mục lưu hàng chờ: ' + imzicQueueDir, false);
    }
  }catch(err){
    setStatus('Không mở được hộp thoại chọn thư mục: ' + (err && err.message ? err.message : String(err)), true);
  }
});

// nạp lại đầy đủ 1 mục vào tool: cài đặt → ảnh/slideshow → nhạc → lời SRT
async function imzicQueueApplyItem(it){
  if(typeof applySettingsInputs !== 'function'){
    throw Object.assign(new Error('Thiếu applySettingsInputs — trang chưa nạp đủ module imzic-*'), { code: 'IMZIC_QUEUE_ENV' });
  }
  applySettingsInputs(it.settings);
  if(typeof refreshTrimHint === 'function') refreshTrimHint();
  // 2026-09-17zq: nạp ảnh/slideshow HOẶC video (ưu tiên ảnh nếu có cả 2, khớp
  // logic queue push ở trên). Không có gì → lỗi.
  const hasImg = it.imgFile || (it.slides && it.slides.length);
  const hasVideo = it.videoFile || (it.videoSlides && it.videoSlides.length);
  if(!hasImg && !hasVideo){
    throw Object.assign(new Error('Mục không còn file ảnh/video nào'), { code: 'IMZIC_QUEUE_NO_MEDIA' });
  }
  if(it.slides && it.slides.length){
    state.slides = it.slides;
    state.img = null; state.imgFile = null;
    $('imgName').textContent = '(slideshow: ' + it.slides.length + ' ảnh)';
    if($('slidesHint')) $('slidesHint').textContent = it.slides.length + ' ảnh';
    if(typeof slideRasterCache !== 'undefined' && slideRasterCache && slideRasterCache.clear) slideRasterCache.clear();
    if(typeof slideBlurCache !== 'undefined' && slideBlurCache && slideBlurCache.clear) slideBlurCache.clear();
    if(typeof slideSchedule !== 'undefined' && slideSchedule) slideSchedule = { key: '', list: [] };
    if(typeof updateSlideFields === 'function') updateSlideFields();
    checkReady();
  } else if(it.imgFile){
    await imzicLoadImageFile(it.imgFile);
  } else if(it.videoFile){
    // 2026-09-17zu (mitigation 3): nạp lại từ dataUrl nếu có (đã lưu khi push
    // nếu ≤ 5 MB). Fallback cũ: truyền thẳng object cũ (khi mục được tạo trước
    // bản mitigation này, không có dataUrl).
    if(it.videoFile.dataUrl){
      try{
        const f = await imzDataUrlToFile(it.videoFile.dataUrl, it.videoFile.name, it.videoFile.type);
        await imzicLoadVideoFile(f, $('videoInput'));
      }catch(err){
        setStatus('Không tái dựng được file video từ hàng chờ: ' + (err.message || err) + ' — chọn lại file thủ công.', true);
        throw Object.assign(new Error('Mục video lỗi dataUrl: ' + (err.message || err)), { code: 'IMZIC_QUEUE_VIDEO_DATAURL' });
      }
    } else {
      // 2026-09-17zq: 1 video đơn — nạp lại từ File (mục cũ, không có dataUrl)
      await imzicLoadVideoFile(it.videoFile, $('videoInput'));
    }
  } else if(it.videoSlides && it.videoSlides.length){
    // 2026-09-17zu: slideshow video — hiện chỉ lưu tên (state.videos[i].el là
    // HTMLVideoElement không phải File). TODO: khi state.videosFiles[] được
    // thêm, lưu dataUrl cho từng video và tái dựng File[] ở đây. Hiện tại
    // setStatus cảnh báo rõ + bỏ qua slideshow (chỉ giữ lại tên để user tham chiếu).
    setStatus('Hàng chờ chưa hỗ trợ slideshow video (chỉ 1 video đơn). Mục "' + it.name + '" bị bỏ qua phần slideshow video.', true);
  }
  if(!it.audioFile){
    throw Object.assign(new Error('Mục không còn file nhạc'), { code: 'IMZIC_QUEUE_NO_AUDIO' });
  }
  await imzicLoadAudioFile(it.audioFile);
  // lời SRT: nội dung đã nằm trong settings.srtPaste (applySettingsInputs điền lại ô dán)
  const srt = (it.settings && it.settings.srtPaste) || '';
  if(srt.trim()){
    loadLyricsFromText(srt, 'Hàng chờ');
  } else {
    state.lyricsCues = []; state._lastLyricIdx = -2;
    if(typeof lyricsVersion === 'number') lyricsVersion++;
    $('srtName').textContent = 'Chọn file .srt / .lrc';
  }
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
}

async function imzicQueueRun(){
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy rồi.', true); return; }
  if(isExporting){ setStatus('Đang có lần xuất chạy — chờ xong (hoặc ✕ Huỷ ghi) đã nhé.', true); return; }
  const pending = imzicQueue.filter(it => it.status === 'pending' || it.status === 'error');
  if(!pending.length){ setStatus('Không còn mục nào chờ xuất — bấm ➕ để thêm cấu hình hiện tại.', true); return; }
  if(!imzicQueueDir){ setStatus('Chưa chọn thư mục lưu — bấm "📁 Thư mục lưu…" trước khi chạy hàng chờ.', true); return; }
  imzicQueueRunning = true; imzicQueueStopFlag = false;
  let imzicQueueStopped = false; // có dừng giữa chừng (huỷ/lỗi/stop) → không báo "hoàn tất"
  $('queueRunBtn').disabled = true;
  $('queueStopBtn').style.display = '';
  try{
    for(const it of pending){
      if(imzicQueueStopFlag){ setStatus('Đã dừng hàng chờ theo yêu cầu — các mục còn lại giữ nguyên, bấm ▶ để chạy tiếp.', false); imzicQueueStopped = true; break; }
      imzicQueueSetStatus(it, 'running');
      imzicQueueRefreshUI();
      setStatus('Hàng chờ [' + it.name + '] — đang nạp ảnh/nhạc/cài đặt…', true);
      try{
        await imzicQueueApplyItem(it);
        setStatus('Hàng chờ [' + it.name + '] — đang xuất nhanh (⚡) vào thư mục đã chọn…', true);
        const r = await exportOffline({ autoSave: { dir: imzicQueueDir, name: it.name + '.mp4' } });
        if(r && r.ok){
          imzicQueueSetStatus(it, 'done', r.path);
          setStatus('Hàng chờ: xong "' + it.name + '" → ' + r.path, false);
        } else if(r && r.canceled){
          imzicQueueSetStatus(it, 'canceled');
          setStatus('Hàng chờ dừng: mục "' + it.name + '" bị huỷ giữa chừng, không tạo file.', true);
          imzicQueueStopped = true;
          break;
        } else {
          imzicQueueSetStatus(it, 'error');
          setStatus('Hàng chờ dừng tại "' + it.name + '" — xem thông báo lỗi phía trên, sửa xong bấm ▶ chạy lại (mục lỗi sẽ được xuất lại).', true);
          imzicQueueStopped = true;
          break;
        }
      }catch(err){
        imzicQueueSetStatus(it, 'error');
        setStatus('Hàng chờ dừng tại "' + it.name + '": ' + (err && err.message ? err.message : String(err)), true);
        imzicQueueStopped = true;
        break;
      }
      imzicQueueRefreshUI();
    }
    if(!imzicQueueStopped){
      const okN = imzicQueue.filter(x => x.status === 'done').length;
      const errN = imzicQueue.filter(x => x.status === 'error').length;
      const pendN = imzicQueue.filter(x => x.status === 'pending').length;
      setStatus('Hàng chờ hoàn tất: ' + okN + '/' + pending.length + ' mục xuất thành công'
        + (errN ? ', ' + errN + ' lỗi (bấm ▶ để xuất lại)' : '')
        + (pendN ? ', ' + pendN + ' chưa chạy' : '')
        + (okN ? ' — kiểm tra file trong: ' + imzicQueueDir : '') + '.', !errN);
    }
  } finally {
    imzicQueueRunning = false;
    imzicQueueStopFlag = false;
    $('queueRunBtn').disabled = false;
    $('queueStopBtn').style.display = 'none';
    imzicQueueRefreshUI();
  }
}
$('queueRunBtn').addEventListener('click', imzicQueueRun);
$('queueStopBtn').addEventListener('click', ()=>{
  imzicQueueStopFlag = true;
  setStatus('Sẽ dừng hàng chờ sau mục đang chạy…', false);
});

function imzicQueueSetStatus(item, status, resultPath){
  item.status = status;
  if(resultPath !== undefined) item.resultPath = resultPath;
}
