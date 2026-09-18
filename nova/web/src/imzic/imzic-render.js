'use strict';

/* imzic-render.js — vẽ nền + render loop + nạp ảnh/nhạc + checkReady/fmtTime.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- vẽ nền: 1 ảnh hoặc slideshow (chuyển cảnh + Ken Burns + fit-mode) ----
// scale = zoom bass (như cũ); KB = Ken Burns per-slide deterministic.
const KB_HEADROOM = 1.15;   // raster đủ cho zoom bass × Ken Burns đỉnh (1.18×1.14)

// 2026-09-17zq: video phát làm nền, loop đến hết nhạc. Mỗi phần tử `videos[i]`
// có `.el` (HTMLVideoElement ẩn, muted, autoplay theo t) và `.name`. Khi `t`
// vượt duration, tua `currentTime` về 0 (không pause — phát tiếp) để nối mượt.
// Loop CHỈ áp dụng khi nhạc còn chạy (audioEl.duration - audioEl.currentTime > 0.5);
// khi nhạc gần hết, video freeze tại frame cuối (đỡ giật).
function syncVideoTime(el, t){
  if(!el || !el.duration || !isFinite(el.duration)) return;
  if(t < 0) t = 0;
  // tua về 0 nếu đã chạy hết — KHÔNG pause (giữ frame cuối nếu muốn thì thêm pause)
  if(el.currentTime >= el.duration - 0.1){
    try { el.currentTime = 0; } catch(e){}
  }
  // 2026-09-17zu (mitigation 2): trong export offline, mỗi khung `t` tăng theo
  // loop nhưng browser có thể chưa decode frame mới → vẽ frame cũ lên canvas →
  // VideoFrame capture trễ 1-2 frame. Nếu lệch > 0.1s mà CHƯA vượt duration
  // → ép seek nhẹ về `t` (delta < 0.5s để browser KHÔNG re-decode toàn bộ).
  // Lưu ý: chỉ làm khi offlineRendering (xuất nhanh), không áp dụng cho
  // preview realtime (ở đó audioEl.currentTime chạy tự nhiên theo t).
  if(typeof offlineRendering !== 'undefined' && offlineRendering && t < el.duration - 0.5){
    const dt = Math.abs(el.currentTime - t);
    if(dt > 0.1 && dt < 0.5){
      try { el.currentTime = t; } catch(e){}
    }
  }
}

// Vẽ 1 frame video tại thời điểm `t` (giây) theo `fitMode`.
// fitMode ∈ cover/contain/blur/square — giống ảnh đơn (xem drawBackground dưới).
// scale = zoom bass; kb = Ken Burns (đã tính sẵn cho ảnh, ở đây bỏ qua vì video
// đã có chuyển động riêng — chỉ áp zoom bass cho cover, các mode khác cố định).
function drawVideoFrame(el, w, h, fitMode, scale, t){
  if(!el) return;
  if(el.readyState < 2) return; // HAVE_CURRENT_DATA
  syncVideoTime(el, t);
  const vw = el.videoWidth, vh = el.videoHeight;
  if(!vw || !vh) return;
  if(fitMode === 'square'){
    // "Ô vuông giữa + nền mờ" — dùng cùng logic ảnh, lấy frame video hiện tại
    // làm nguồn cho cả nền mờ lẫn ô vuông (bgImg riêng nếu có ưu tiên bgImg trước).
    if(state.bgImg){
      drawSquareLayout(state.bgImg, null);
    } else {
      // tạo canvas tạm chứa frame hiện tại rồi dùng làm "ảnh" cho drawSquareLayout
      const tmp = imzVideoFrameCanvas(el);
      if(tmp) drawSquareLayout(tmp, tmp);
    }
    return;
  }
  if(fitMode === 'blur'){
    // nền mờ từ chính frame video (kéo dãn đầy khung rồi blur)
    const tmp = imzVideoFrameCanvas(el, w, h);
    if(tmp){
      ctx.filter = 'blur(' + Math.max(4, state.bgBlur || 12) + 'px)';
      ctx.drawImage(tmp, 0, 0, w, h);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#050508'; ctx.fillRect(0,0,w,h);
    }
    // ảnh chính: vừa đủ (contain), không zoom bass
    const s2 = Math.min(w/vw, h/vh);
    const dw2 = vw*s2, dh2 = vh*s2;
    ctx.drawImage(el, (w-dw2)/2, (h-dh2)/2, dw2, dh2);
    return;
  }
  if(fitMode === 'contain'){
    // viền đen + ảnh chính vừa đủ
    ctx.fillStyle = '#050508'; ctx.fillRect(0,0,w,h);
    const s2 = Math.min(w/vw, h/vh) * scale;
    const dw2 = vw*s2, dh2 = vh*s2;
    ctx.drawImage(el, (w-dw2)/2, (h-dh2)/2, dw2, dh2);
    return;
  }
  // cover: lấp đầy khung + zoom bass
  const cover = Math.max(w/vw, h/vh) * scale;
  const dw = vw*cover, dh = vh*cover;
  ctx.drawImage(el, (w-dw)/2, (h-dh)/2, dw, dh);
}

// Helper: tạo canvas chứa frame video hiện tại (dùng cho square/blur).
// Không cache vì video là live (frame đổi liên tục) — mỗi frame vẽ 1 lần.
// Tối ưu: nếu chỉ cần kích thước gốc thì truyền w/h=null; nếu cần scale thì truyền.
function imzVideoFrameCanvas(el, sw, sh){
  if(!el || el.readyState < 2) return null;
  const vw = el.videoWidth, vh = el.videoHeight;
  if(!vw || !vh) return null;
  const c = document.createElement('canvas');
  c.width = sw || vw;
  c.height = sh || vh;
  const cctx = c.getContext('2d');
  if(sw && sh){
    // cover fit: lấp đầy canvas (sw×sh)
    const sc = Math.max(sw/vw, sh/vh);
    const dw = vw*sc, dh = vh*sc;
    cctx.drawImage(el, (sw-dw)/2, (sh-dh)/2, dw, dh);
  } else {
    cctx.drawImage(el, 0, 0, vw, vh);
  }
  return c;
}

// Lấy videoEl hiện tại theo `t` (giây) — hỗ trợ cả 1 video lẫn slideshow video.
// videos: [{el,name,duration}]; nếu chỉ 1 video thì trả về luôn (loop mượt).
// Trả về null nếu videos rỗng.
function imzGetCurrentVideoEl(t){
  const vids = state.videos;
  if(!vids || !vids.length) return null;
  if(vids.length === 1) return vids[0].el;
  // slideshow: chia đều theo duration nhạc
  const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
  if(dur <= 0) return vids[0].el;
  const segs = vids.length;
  const idx = Math.max(0, Math.min(segs-1, Math.floor(t / dur * segs)));
  return vids[idx].el;
}

function drawBackground(scale, t){
  const w = logicW, h = logicH;
  if(state.slides.length){
    const sched = getSlideSchedule().list;
    if(!sched.length){
      ctx.fillStyle = '#050508'; ctx.fillRect(0,0,w,h);
      return;
    }
    let seg = sched[sched.length-1], segIdx = sched.length-1;
    for(let i=0;i<sched.length;i++){
      if(t >= sched[i].start && t < sched[i].end){ seg = sched[i]; segIdx = i; break; }
    }
    const durSeg = Math.max(0.001, seg.end - seg.start);
    const p = Math.max(0, Math.min(1, (t - seg.start) / durSeg));
    const kb = kenBurnsAt(seg.idx, seg.entry, p);
    const zq = Math.max(0.05, Math.ceil((state.zoomMax * KB_HEADROOM - 1e-9) / RASTER_ZOOM_STEP) * RASTER_ZOOM_STEP);
    const TRANS = 0.6; // giây
    const inTrans = state.transition !== 'none' && segIdx > 0 && (t - seg.start) < TRANS;
    if(!inTrans){
      drawSlideLayer(state.slides[seg.idx], seg.idx, zq, scale, kb, state.fitMode);
      return;
    }
    const mix = (t - seg.start) / TRANS;        // 0 → 1
    const prev = sched[segIdx-1];
    const kbPrev = kenBurnsAt(prev.idx, prev.entry, 1);
    if(state.transition === 'black'){
      // chớp đen: ảnh cũ mờ đi nửa đầu, ảnh mới hiện dần nửa sau
      ctx.fillStyle = '#050508'; ctx.fillRect(0,0,w,h);
      if(mix < 0.5){
        ctx.globalAlpha = 1 - mix*2;
        drawSlideLayer(state.slides[prev.idx], prev.idx, zq, scale, kbPrev, state.fitMode);
      } else {
        ctx.globalAlpha = (mix-0.5)*2;
        drawSlideLayer(state.slides[seg.idx], seg.idx, zq, scale, kb, state.fitMode);
      }
      ctx.globalAlpha = 1;
    } else if(state.transition === 'slide'){
      // đẩy ngang: ảnh cũ trượt sang trái, ảnh mới trượt vào từ phải
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,w,h); ctx.clip();
      ctx.translate(-w*mix, 0);
      drawSlideLayer(state.slides[prev.idx], prev.idx, zq, scale, kbPrev, state.fitMode);
      ctx.translate(w, 0);
      drawSlideLayer(state.slides[seg.idx], seg.idx, zq, scale, kb, state.fitMode);
      ctx.restore();
    } else {
      // fade: crossfade mượt
      drawSlideLayer(state.slides[prev.idx], prev.idx, zq, scale, kbPrev, state.fitMode);
      ctx.globalAlpha = mix;
      drawSlideLayer(state.slides[seg.idx], seg.idx, zq, scale, kb, state.fitMode);
      ctx.globalAlpha = 1;
    }
    return;
  }
  // 2026-09-17zq: video nguồn — ưu tiên khi state.sourceMode === 'video' VÀ có
  // video. Nếu user chọn cả ảnh + video, mặc định ưu tiên ảnh (sourceMode='image')
  // — đổi qua 'video' bằng dropdown `sourceModeSel`.
  if(state.sourceMode === 'video' && state.videos.length){
    drawVideoFrame(imzGetCurrentVideoEl(t), w, h, state.fitMode || 'cover', scale, t);
    return;
  }
  if(state.img){
    const fm = state.fitMode || 'cover';
    // 2026-09-17zp: ảnh đơn tôn trọng ĐỦ 4 fitMode (trước đây chỉ square đặc
    // biệt, còn lại rơi về cover cứng → ảnh bị cắt dù user chọn contain/blur).
    if(fm === 'square'){
      drawSquareLayout(state.img, getImageRaster());
      return;
    }
    const raster = getImageRaster();
    const iw = state.img.width, ih = state.img.height;
    if(fm === 'blur'){
      const bg = getImageBlurBg(state.img);
      if(bg) ctx.drawImage(bg, 0, 0, w, h);
      // ảnh chính: vừa đủ trên nền mờ (giống nhánh 'blur' của slideshow) — không
      // zoom bass để viền không phập phồng khi không có slideshow.
      const s2 = Math.min(w/iw, h/ih);
      const dw2 = iw*s2, dh2 = ih*s2;
      ctx.drawImage(raster || state.img, (w-dw2)/2, (h-dh2)/2, dw2, dh2);
      return;
    }
    if(fm === 'contain'){
      // vừa đủ khung, viền đen 2 bên nếu lệch tỉ lệ — zoom bass nhẹ 1× để không
      // giật, giữ ảnh không bị cắt (nghĩa đen 'contain').
      const s2 = Math.min(w/iw, h/ih) * scale;
      const dw2 = iw*s2, dh2 = ih*s2;
      ctx.drawImage(raster || state.img, (w-dw2)/2, (h-dh2)/2, dw2, dh2);
      return;
    }
    // cover: lấp đầy khung (giữ tương thích tuyệt đối với hành vi cũ) — đây
    // là nhánh mặc định state.fitMode === 'cover'.
    // #perf: vẽ từ raster đã quét sẵn (luôn ≥ khổ hiển thị) thay vì resample
    // ảnh gốc độ phân giải đầy đủ mỗi frame — vị trí/kích thước giữ nguyên.
    const cover = Math.max(w/iw, h/ih) * scale;
    const dw = iw*cover, dh = ih*cover;
    const dx = (w-dw)/2, dy = (h-dh)/2;
    ctx.drawImage(raster || state.img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0,0,w,h);
  }
}

// ---- render loop ----
let rafId = null;
let lastT = performance.now();
let offlineRendering = false; // "⚡ Xuất nhanh" đang tự render từng khung — rAF tạm nghỉ
// #perf: DOM refs + throttle 100ms cho UI tiến trình (#2) — thanh chạy vẫn
// mượt mắt, còn hoàn toàn nằm NGOÀI canvas nên không dính gì tới file xuất.
const progEls = { wrap:$('progWrap'), bar:$('progBar'), text:$('progText') };
let lastProgUiMs = 0;
// ---- chống chết vòng render âm thầm (khung đen vĩnh viễn, không báo lỗi) ----
// 1 exception trong 1 frame KHÔNG được phép giết vòng rAF. Chiến lược fail-loud
// (Luật 10): báo code IMZIC_RENDER_LOOP rõ ràng ngay lần đầu, thử chạy tiếp
// (glitch 1 frame thường tự hồi); lỗi 5 frame LIÊN TIẾP → dừng hẳn, không tự
// hồi phục ngầm. Nếu đang ghi export → huỷ sạch để không chốt file hỏng.
let imzRenderErrStreak = 0;
let imzRenderLoopDead = false;
function render(now){
  if(imzRenderLoopDead) return;
  try{
    renderFrame(now);
    imzRenderErrStreak = 0;
  }catch(err){
    imzRenderErrStreak++;
    if(imzRenderErrStreak === 1 || imzRenderErrStreak === 5){
      setStatus('Vòng render gặp lỗi [' + ((err && err.code) || 'IMZIC_RENDER_LOOP') + ']: ' + (err && err.message ? err.message : String(err)) + (imzRenderErrStreak >= 5 ? ' — lỗi lặp 5 frame liên tiếp, render DỪNG. Tải lại trang tool (chuyển tab qua lại) để khôi phục.' : ''), true);
    }
    if(imzRenderErrStreak === 1 && isExporting && typeof activeExportCancel === 'function'){
      try{ activeExportCancel(); }catch(e){}
    }
    if(imzRenderErrStreak >= 5){ imzRenderLoopDead = true; return; }
  }
  rafId = requestAnimationFrame(render);
}
function renderFrame(now){
  now = now || performance.now();
  let dtMs = now - lastT;
  lastT = now;
  // clamp so a big stall (tab was hidden) doesn't cause one huge jump,
  // but still catches particles/zoom back up to real time quickly
  dtMs = Math.min(dtMs, 250);
  const dt = dtMs / 16.67; // 1.0 == normal 60fps frame

  // offline render ("⚡ Xuất nhanh") tự vẽ theo đồng hồ logic — rAF chỉ đợi
  if(offlineRendering) return; // wrapper render() lo lập lại nhịp rAF

  const w = logicW, h = logicH;
  // canvas vật lý to hơn khi đang ghi xuất (#9) — phóng hệ toạ độ logic bằng transform
  ctx.setTransform(canvas.width/logicW, 0, 0, canvas.height/logicH, 0, 0);
  ctx.clearRect(0,0,w,h);

  // audio energy -> zoom + particle pulse
  // #bands: tách dải từ CÙNG một lần quét FFT mỗi frame (fftSize 256 → 128 bin
  // × ~172 Hz/bin @44.1 kHz):
  //   bass   = bin 0-3   (0-~690 Hz, kick/bass guitar) → zoom ảnh nền (như cũ
  //            nhưng giờ đúng dải trầm, nhịp đấm mạnh hơn thay vì trộn cả giọng hát)
  //   treble = bin 24-63 (~4.1-11 kHz, hi-hat/chuông)  → hạt tuyết/hoa/stars
  //            nở nhẹ + sáng nhẹ theo nhịp gõ
  // sóng nhạc giữ nguyên ánh xạ toàn bộ phổ (waveEnergyAt) như trước.
  let targetEnergy = 0, targetTreble = 0;
  if(analyser){
    analyser.getByteFrequencyData(freqData);
    const n = freqData.length;
    targetEnergy = Math.min(1, avgFreqRange(0, Math.min(4, n)) * state.sensitivity);
    // bin treble thường nhỏ biên độ hơn bass → nhân 1.4 để nhịp vẫn thấy rõ
    targetTreble = Math.min(1, avgFreqRange(Math.min(24, n), Math.min(64, n)) * 1.4);
  }
  const smoothing = state.smoothness;
  // time-based smoothing so convergence speed doesn't depend on frame rate
  const smoothFactor = Math.pow(smoothing, dt);
  smoothedEnergy += (targetEnergy - smoothedEnergy) * (1 - smoothFactor);
  // #bands: treble dùng attack/decay nhanh hơn (0.72/frame @60fps) để hạt
  // "phập" theo từng nhịp hi-hat thay vì trôi mượt như zoom
  const trebleFactor = Math.pow(0.72, dt);
  smoothedTreble += (targetTreble - smoothedTreble) * (1 - trebleFactor);
  const scale = state.zoomMin + (state.zoomMax - state.zoomMin) * smoothedEnergy;

  // fade in/out (mục 6): áp lên nhánh ra tiếng (loa + bản ghi), không đụng analyser
  if(fadeGain) fadeGain.gain.value = fadeGainAt(audioEl.currentTime || 0);

  // cắt nhạc: tới điểm kết thúc (hoặc hết bài) thì dừng như 'ended' — cả xem
  // trước lẫn bản ghi realtime (bản ghi offline tự bó trong khoảng trim)
  const tNow = audioEl.currentTime || 0;
  const effEnd = (state.trimEnd > state.trimStart && state.trimEnd > 0) ? state.trimEnd : Infinity;
  if(state.playing && tNow >= effEnd){
    try { audioEl.currentTime = isFinite(effEnd) ? effEnd : 0; } catch(e){}
    audioEl.pause();
    state.playing = false; $('playBtn').textContent = '▶ Phát thử';
    if(activeExportRecorder){ try { activeExportRecorder.stop(); } catch(e){} }
  }

  drawBackground(scale, tNow);

  drawWave(dt);
  drawParticles(dt, smoothedTreble); // #bands: hạt nhịp theo dải treble
  drawLyrics(tNow);
  drawTextLines(tNow); // E6: Text lên màn hình (mục 11) — dưới FX toàn khung, khớp lời hát
  applyFx(smoothedEnergy); // FX toàn khung phủ trên cùng (như z:90 của Nova)
  drawWatermark();         // E4: logo vẽ CUỐI cùng — trên mọi FX, luôn nét

  glowRing.style.setProperty('--pulse', (0.10 + smoothedEnergy*0.55).toFixed(3));

  // #2 — tiến trình ghi theo vị trí phát của nhạc (chỉ khi đang xuất).
  // #perf: cập nhật DOM ~10 lần/giây là đủ mắt người (thuần UI ngoài canvas).
  if(isExporting && now - lastProgUiMs >= 100 && progEls.wrap.style.display !== 'none'){
    lastProgUiMs = now;
    const d = audioEl.duration;
    const p = (isFinite(d) && d > 0) ? Math.min(100, (audioEl.currentTime / d) * 100) : 0;
    progEls.bar.style.width = p.toFixed(1) + '%';
    progEls.text.textContent = fmtTime(audioEl.currentTime) + ' / ' + fmtTime(d) + '  ·  ' + Math.floor(p) + '%';
  }
}
requestAnimationFrame(render);

// ---- file loading ----
// Hàm nạp tách khỏi listener input để HÀNG CHỜ (imzic-workflow.js) nạp lại
// từng mục bằng đúng một luồng — không nhân bản logic (AGENTS.md §4 Luật 1).
// Trả Promise: resolve khi file nạp xong, reject với error code lộ liễu (Luật 10).
let imgObjUrl = null;
function imzicLoadImageFile(f, inputEl){
  const looksImage = (f.type && f.type.startsWith('image')) || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name);
  if(!looksImage){
    setStatus('File này có vẻ không phải ảnh — chọn lại file png/jpg/webp nhé.', true);
    if(inputEl) inputEl.value = '';
    return Promise.reject(Object.assign(new Error('File không phải ảnh: ' + f.name), { code: 'IMZIC_NOT_IMAGE' }));
  }
  state.imgFile = f;
  $('imgName').textContent = f.name;
  const url = URL.createObjectURL(f);
  const im = new Image();
  return new Promise((resolve, reject)=>{
    im.onload = ()=>{
      // ảnh đã decode xong nằm trong bộ nhớ — thu hồi object URL cũ tránh rò rỉ
      if(imgObjUrl && imgObjUrl !== url) URL.revokeObjectURL(imgObjUrl);
      imgObjUrl = url;
      state.img = im;
      // 2026-09-17zp: ảnh mới → cache blur của ảnh cũ vô dụng, key dựa src
      if(typeof imageBlurCache !== 'undefined' && imageBlurCache.clear) imageBlurCache.clear();
      // 2026-09-15r: hiện nút "Bỏ ảnh nền" sau khi nạp thành công
      if($('imgClearBtn')) $('imgClearBtn').style.display = '';
      // CHỈ CHỌN 1 TRONG 2: ảnh nền đơn và slideshow loại trừ lẫn nhau
      // (chiều ngược lại slidesInput đã tự xoá ảnh nền). Nếu không xoá ở đây,
      // slideshow cũ còn tồn tại → vẽ theo slideshow dù người dùng vừa chọn
      // ảnh đơn, và hàng chờ kế thừa slideshow của mục trước sang mục ảnh đơn.
      if(state.slides.length){
        state.slides = [];
        slideRasterCache.clear(); slideBlurCache.clear();
        slideSchedule = { key:'', list:[] };
        if($('slidesHint')) $('slidesHint').textContent = '';
        if(typeof updateSlideFields === 'function') updateSlideFields();
        setStatus('Đã nạp ảnh: ' + f.name + ' (đã bỏ slideshow — chỉ dùng 1 trong 2: ảnh nền đơn HOẶC slideshow).', false);
      } else {
        setStatus('Đã nạp ảnh: ' + f.name, false);
      }
      // ảnh đơn cũng dùng được fitMode — hiện luôn khối "Ảnh lệch khung…"
      if(typeof updateSlideFields === 'function') updateSlideFields();
      checkReady();
      resolve(im);
    };
    im.onerror = ()=>{
      // lỗi lộ rõ (Luật 10): file hỏng / định dạng không hỗ trợ phải báo ngay
      URL.revokeObjectURL(url);
      setStatus('Không đọc được file ảnh này (file hỏng hoặc định dạng không hỗ trợ) — chọn ảnh khác nhé.', true);
      if(inputEl) inputEl.value = '';
      reject(Object.assign(new Error('Không đọc được file ảnh: ' + f.name), { code: 'IMZIC_BAD_IMAGE' }));
    };
    im.src = url;
  });
}
$('imgInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi ảnh giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  imzicLoadImageFile(f, e.target);
});
// 2026-09-15r: nút bỏ ảnh nền đã chọn (đúng pattern bgClearBtn/slidesClearBtn)
$('imgClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không bỏ ảnh giữa chừng (bản ghi sẽ hỏng).', true); return; }
  if(!state.img && !state.imgFile) return;
  if(imgObjUrl){ URL.revokeObjectURL(imgObjUrl); imgObjUrl = null; }
  state.img = null; state.imgFile = null;
  // 2026-09-17zp: bỏ ảnh → cache blur của ảnh cũ cũng vô dụng
  if(typeof imageBlurCache !== 'undefined' && imageBlurCache.clear) imageBlurCache.clear();
  $('imgName').textContent = 'Chọn ảnh nền';
  if($('imgInput')) $('imgInput').value = '';
  $('imgClearBtn').style.display = 'none';
  if(typeof updateSlideFields === 'function') updateSlideFields();
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  checkReady();
  if(!state.slides.length && !state.audioFile && emptyState) emptyState.style.display = '';
  setStatus('Đã bỏ ảnh nền. Chọn ảnh mới hoặc thêm slideshow để tiếp tục.', false);
});

// ---- ảnh nền RIÊNG cho fitMode 'square' (tuỳ chọn) ----
// Có chọn → nền mờ fullscreen của bố cục "Ô vuông giữa" dùng ảnh này; không
// chọn → nền tự dùng chính ảnh đang phát (ảnh đơn hoặc ảnh slide hiện tại).
let bgObjUrl = null;
function imzicLoadBgImageFile(f, inputEl){
  const looksImage = (f.type && f.type.startsWith('image')) || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name);
  if(!looksImage){
    setStatus('File này có vẻ không phải ảnh — chọn lại file png/jpg/webp nhé.', true);
    if(inputEl) inputEl.value = '';
    return Promise.reject(Object.assign(new Error('File không phải ảnh nền: ' + f.name), { code: 'IMZIC_NOT_IMAGE' }));
  }
  state.bgFile = f;
  $('bgName').textContent = f.name;
  const url = URL.createObjectURL(f);
  const im = new Image();
  return new Promise((resolve, reject)=>{
    im.onload = ()=>{
      // ảnh đã decode xong nằm trong bộ nhớ — thu hồi object URL cũ tránh rò rỉ
      if(bgObjUrl && bgObjUrl !== url) URL.revokeObjectURL(bgObjUrl);
      bgObjUrl = url;
      state.bgImg = im;
      if(typeof squareBlurCache !== 'undefined' && squareBlurCache.clear) squareBlurCache.clear();
      if($('bgClearBtn')) $('bgClearBtn').style.display = '';
      setStatus('Đã nạp ảnh nền riêng: ' + f.name + ' — bố cục "Ô vuông giữa + nền mờ" sẽ dùng ảnh này làm nền.', false);
      resolve(im);
    };
    im.onerror = ()=>{
      // lỗi lộ rõ (Luật 10): file hỏng / định dạng không hỗ trợ phải báo ngay
      URL.revokeObjectURL(url);
      setStatus('Không đọc được file ảnh nền này (file hỏng hoặc định dạng không hỗ trợ) — chọn ảnh khác nhé.', true);
      if(inputEl) inputEl.value = '';
      reject(Object.assign(new Error('Không đọc được file ảnh nền: ' + f.name), { code: 'IMZIC_BAD_IMAGE' }));
    };
    im.src = url;
  });
}
$('bgInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi ảnh giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  imzicLoadBgImageFile(f, e.target);
});
$('bgClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không xoá ảnh nền giữa chừng.', true); return; }
  state.bgImg = null; state.bgFile = null;
  $('bgName').textContent = 'Chọn ảnh nền riêng (tuỳ chọn)';
  if($('bgInput')) $('bgInput').value = '';
  $('bgClearBtn').style.display = 'none';
  if(typeof squareBlurCache !== 'undefined' && squareBlurCache.clear) squareBlurCache.clear();
  setStatus('Đã bỏ ảnh nền riêng — nền mờ sẽ tự dùng chính ảnh đang phát.', false);
});

// 2026-09-17zq: video nguồn (1 video hoặc slideshow video) — thay thế ảnh đơn.
let videoObjUrls = [];   // mỗi video 1 url, thu hồi khi clear
function imzicLoadVideoFile(f, inputEl){
  const looksVideo = (f.type && f.type.startsWith('video')) || /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(f.name);
  if(!looksVideo){
    setStatus('File này có vẻ không phải video — chọn lại file mp4/webm nhé.', true);
    if(inputEl) inputEl.value = '';
    return Promise.reject(Object.assign(new Error('File không phải video: ' + f.name), { code: 'IMZIC_NOT_VIDEO' }));
  }
  state.videoFile = f;
  $('videoName').textContent = f.name;
  const url = URL.createObjectURL(f);
  videoObjUrls.push(url);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
  document.body.appendChild(v);
  return new Promise((resolve, reject)=>{
    // 2026-09-17zu (mitigation 1): đợi `oncanplay` (readyState ≥ 3, có frame decode sẵn)
    // thay vì `onloadedmetadata` (chỉ có metadata, chưa có frame). Giải quyết
    // nền đen 1-2 frame đầu khi drawVideoFrame bị gọi trước khi decode xong.
    let resolved = false;
    const finalize = ()=>{
      if(resolved) return; resolved = true;
      // 1 video đơn → thay thế state.videos (xoá slideshow video nếu có)
      if(state.videos.length){
        imzicClearVideos();
      }
      state.videos = [{el: v, name: f.name, duration: isFinite(v.duration) ? v.duration : 0}];
      if($('videoClearBtn')) $('videoClearBtn').style.display = '';
      // CHỈ 1 TRONG 2: video và ảnh (đơn + slideshow) loại trừ lẫn nhau — nếu đã
      // có ảnh, dùng mặc định sourceMode='image' (xem dropdown để đổi).
      if(typeof updateSlideFields === 'function') updateSlideFields();
      checkReady();
      const dur = isFinite(v.duration) ? v.duration.toFixed(1) + 's' : '?';
      setStatus('Đã nạp video: ' + f.name + ' (dài ' + dur + ') — chuyển "Nguồn hiển thị chính" sang 🎬 Video để xem.', false);
      resolve(v);
    };
    v.oncanplay = finalize;
    // fallback 4s: nếu oncanplay không bắn (codec lạ, file nhỏ decode < 16ms) → vẫn
    // resolve để không kẹt UI. Kinh nghiệm: video mp4 thường bắn oncanplay < 200ms.
    setTimeout(()=>{ if(!resolved) finalize(); }, 4000);
    v.onerror = ()=>{
      if(resolved) return; resolved = true;
      URL.revokeObjectURL(url);
      try { v.remove(); } catch(e){}
      setStatus('Không đọc được file video này (file hỏng hoặc codec không hỗ trợ) — chọn video khác nhé.', true);
      if(inputEl) inputEl.value = '';
      reject(Object.assign(new Error('Không đọc được file video: ' + f.name), { code: 'IMZIC_BAD_VIDEO' }));
    };
    v.src = url;
    v.load();
  });
}
function imzicLoadVideoSlidesFiles(files, inputEl){
  if(!files || !files.length){
    return Promise.reject(Object.assign(new Error('Không có file video nào'), { code: 'IMZIC_NO_VIDEO' }));
  }
  for(const f of files){
    const ok = (f.type && f.type.startsWith('video')) || /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(f.name);
    if(!ok){
      setStatus('File "' + f.name + '" không phải video — chỉ chấp nhận mp4/webm/mov.', true);
      if(inputEl) inputEl.value = '';
      return Promise.reject(Object.assign(new Error('File không phải video: ' + f.name), { code: 'IMZIC_NOT_VIDEO' }));
    }
  }
  imzicClearVideos();
  const results = [];
  const promises = files.map(f => new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(f);
    videoObjUrls.push(url);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
    document.body.appendChild(v);
    // 2026-09-17zu (mitigation 1): đợi `oncanplay` thay vì `onloadedmetadata` —
    // đảm bảo frame decode sẵn trước khi slideshow chiếu. Fallback 4s.
    let resolved = false;
    const finalize = ()=>{
      if(resolved) return; resolved = true;
      results.push({el: v, name: f.name, duration: isFinite(v.duration) ? v.duration : 0});
      resolve();
    };
    v.oncanplay = finalize;
    setTimeout(()=>{ if(!resolved) finalize(); }, 4000);
    v.onerror = ()=>{
      if(resolved) return; resolved = true;
      URL.revokeObjectURL(url);
      try { v.remove(); } catch(e){}
      reject(Object.assign(new Error('Không đọc được video: ' + f.name), { code: 'IMZIC_BAD_VIDEO' }));
    };
    v.src = url;
    v.load();
  }));
  return Promise.all(promises).then(()=>{
    state.videos = results;
    if($('vslidesHint')) $('vslidesHint').textContent = results.length + ' video';
    if($('vslidesClearBtn')) $('vslidesClearBtn').style.display = '';
    if(typeof updateSlideFields === 'function') updateSlideFields();
    checkReady();
    setStatus('Đã nạp slideshow ' + results.length + ' video — chia đều theo nhạc. Chuyển "Nguồn hiển thị chính" sang 🎬 Video để xem.', false);
    return results;
  }).catch(err=>{
    setStatus(err.message || 'Lỗi không đọc được slideshow video.', true);
    if(inputEl) inputEl.value = '';
    throw err;
  });
}
function imzicClearVideos(){
  for(const it of state.videos){
    try { it.el.pause(); } catch(e){}
    try { it.el.remove(); } catch(e){}
  }
  for(const u of videoObjUrls){ try { URL.revokeObjectURL(u); } catch(e){} }
  videoObjUrls = [];
  state.videos = [];
  state.videoFile = null;
  if($('videoName')) $('videoName').textContent = 'Chọn 1 video (tuỳ chọn)';
  if($('vslidesHint')) $('vslidesHint').textContent = '';
  if($('videoInput')) $('videoInput').value = '';
  if($('vslidesInput')) $('vslidesInput').value = '';
  if($('videoClearBtn')) $('videoClearBtn').style.display = 'none';
  if($('vslidesClearBtn')) $('vslidesClearBtn').style.display = 'none';
  if(typeof updateSlideFields === 'function') updateSlideFields();
  checkReady();
}
// Listeners cho input/clear video — đặt NGAY SAU loader để tránh biến undefined
if($('videoInput')) $('videoInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi video giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  imzicLoadVideoFile(f, e.target);
});
if($('vslidesInput')) $('vslidesInput').addEventListener('change', e=>{
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi slideshow video giữa chừng (bản ghi sẽ hỏng).', true); e.target.value = ''; return; }
  imzicLoadVideoSlidesFiles(files, e.target);
});
if($('videoClearBtn')) $('videoClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không bỏ video giữa chừng (bản ghi sẽ hỏng).', true); return; }
  imzicClearVideos();
  setStatus('Đã bỏ video. Chọn video mới hoặc thêm slideshow video để tiếp tục.', false);
});
if($('vslidesClearBtn')) $('vslidesClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không bỏ slideshow video giữa chừng (bản ghi sẽ hỏng).', true); return; }
  // chỉ xoá slideshow video, giữ 1 video nếu có
  const keep = state.videos.length > 1 ? [state.videos[0]] : [];
  for(let i = 1; i < state.videos.length; i++){
    try { state.videos[i].el.pause(); } catch(e){}
    try { state.videos[i].el.remove(); } catch(e){}
  }
  state.videos = keep;
  if($('vslidesHint')) $('vslidesHint').textContent = '';
  if($('vslidesClearBtn')) $('vslidesClearBtn').style.display = 'none';
  if($('vslidesInput')) $('vslidesInput').value = '';
  if(typeof updateSlideFields === 'function') updateSlideFields();
  checkReady();
  setStatus('Đã bỏ slideshow video' + (keep.length ? ' (còn 1 video).' : '.'), false);
});
if($('sourceModeSel')) $('sourceModeSel').addEventListener('change', e=>{
  state.sourceMode = e.target.value;
  if(typeof updateSlideFields === 'function') updateSlideFields();
  setStatus('Nguồn hiển thị chính: ' + (state.sourceMode === 'video' ? '🎬 Video' : '🖼️ Ảnh') + '.', false);
});

let audObjUrl = null;
function imzicLoadAudioFile(f, inputEl){
  const looksAudio = (f.type && f.type.startsWith('audio')) || /\.(mp3|wav|m4a|aac|ogg|flac|wma|opus|mp4|3gp)$/i.test(f.name);
  if(!looksAudio){
    setStatus('File này có vẻ không phải nhạc — chọn lại giúp mình file mp3/wav/m4a/aac nhé.', true);
    if(inputEl) inputEl.value = '';
    return Promise.reject(Object.assign(new Error('File không phải nhạc: ' + f.name), { code: 'IMZIC_NOT_AUDIO' }));
  }
  state.audioFile = f;
  state.audioReady = false;
  offlineAnalysis = null; offlineAnalysisPromise = null; // file mới → phân tích lại
  $('audName').textContent = f.name;
  if(audObjUrl) URL.revokeObjectURL(audObjUrl);
  audObjUrl = URL.createObjectURL(f);
  audioEl.src = audObjUrl;
  audioEl.load();
  return new Promise((resolve, reject)=>{
    audioEl.onloadedmetadata = ()=>{
      const dur = isFinite(audioEl.duration) ? audioEl.duration : 100; // webm có thể trả Infinity lúc đầu
      $('seekBar').max = dur;
      $('seekBar').disabled = false;
      $('tDur').textContent = fmtTime(audioEl.duration);
      state.audioReady = true;
      // 2026-09-15r: hiện nút "Bỏ file nhạc" sau khi nạp thành công
      if($('audClearBtn')) $('audClearBtn').style.display = '';
      checkReady();
      // phân tích offline (marker nhịp + envelope cho "⚡ Xuất nhanh") chạy nền
      ensureOfflineAnalysis();
      resolve();
    };
    audioEl.onerror = ()=>{
      state.audioReady = false;
      setStatus('Không đọc được file nhạc này (file hỏng hoặc codec không hỗ trợ) — chọn file khác nhé.', true);
      if(inputEl) inputEl.value = '';
      reject(Object.assign(new Error('Không đọc được file nhạc: ' + f.name), { code: 'IMZIC_BAD_AUDIO' }));
    };
  });
}
$('audInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi nhạc giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  imzicLoadAudioFile(f, e.target);
});
// 2026-09-15r: nút bỏ file nhạc đã chọn — dừng phát, thu hồi object URL,
// reset seek bar + phân tích offline (không fallback ngầm — Luật 10)
$('audClearBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không bỏ nhạc giữa chừng (bản ghi sẽ hỏng).', true); return; }
  if(!state.audioFile) return;
  audioEl.pause(); state.playing = false; $('playBtn').textContent = '▶ Phát thử';
  if(audObjUrl){ URL.revokeObjectURL(audObjUrl); audObjUrl = null; }
  audioEl.removeAttribute('src'); audioEl.load();
  state.audioFile = null; state.audioReady = false;
  offlineAnalysis = null; offlineAnalysisPromise = null;
  $('audName').textContent = 'Chọn file nhạc';
  if($('audInput')) $('audInput').value = '';
  $('audClearBtn').style.display = 'none';
  $('seekBar').disabled = true; $('seekBar').value = 0;
  $('tCur').textContent = '0:00'; $('tDur').textContent = '0:00';
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  checkReady();
  if(!state.img && !state.slides.length && emptyState) emptyState.style.display = '';
  setStatus('Đã bỏ file nhạc. Chọn nhạc mới để phát hoặc xuất video.', false);
});


// ---- E4: logo / watermark overlay ----
// Vẽ SAU CÙNG trong stack (sau applyFx) nên logo không bị FX bóp méo.
// Deterministic (Luật 8): chỉ phụ thuộc state (vị trí/cỡ/độ mờ) — preview, 2
// nút ghi realtime và "⚡ Xuất nhanh" đều gọi cùng hàm này → file ra khớp preview.
function drawWatermark(){
  const img = state.wmImg;
  if(!img || !img.width || !img.height) return;
  const w = logicW, h = logicH;
  const dw = Math.max(8, w * Math.min(0.5, Math.max(0.02, (+state.wmSize || 18) / 100)));
  const dh = dw * img.height / img.width;
  const margin = Math.round(w * 0.03);
  const pos = String(state.wmPos || 'br');
  const vert = pos[0], horiz = pos[1];
  const x = horiz === 'l' ? margin : horiz === 'r' ? (w - margin - dw) : (w - dw) / 2;
  const y = vert === 't' ? margin : vert === 'b' ? (h - margin - dh) : (h - dh) / 2;
  ctx.globalAlpha = Math.max(0.05, Math.min(1, (state.wmAlpha == null ? 0.6 : +state.wmAlpha)));
  ctx.drawImage(img, x, y, dw, dh);
  ctx.globalAlpha = 1;
}

function checkReady(){
  const hasVisual = state.img || state.slides.length;
  if(hasVisual && state.audioFile && state.audioReady){
    emptyState.style.display = 'none';
    $('playBtn').disabled = false;
    $('restartBtn').disabled = false;
    $('exportAudioBtn').disabled = false;
    $('exportSilentBtn').disabled = false;
    $('exportOfflineBtn').disabled = false;
    $('snapshotBtn').disabled = false;
    $('exportOpts').style.display = 'flex';
  } else {
    // 2026-09-15r: chiều ngược — bỏ ảnh/nhạc (nút 🗑) thì khoá lại nút phát/xuất,
    // tránh "bấm được nhưng chạy sai" khi thiếu dữ liệu (Luật 10)
    $('playBtn').disabled = true;
    $('restartBtn').disabled = true;
    $('exportAudioBtn').disabled = true;
    $('exportSilentBtn').disabled = true;
    $('exportOfflineBtn').disabled = true;
    $('snapshotBtn').disabled = true;
    $('exportOpts').style.display = 'none';
  }
}

function fmtTime(s){
  if(!isFinite(s)) return '0:00';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return m+':'+String(sec).padStart(2,'0');
}

audioEl.addEventListener('timeupdate', ()=>{
  if(!isSeeking){
    $('seekBar').value = audioEl.currentTime;
    $('tCur').textContent = fmtTime(audioEl.currentTime);
  }
});
audioEl.addEventListener('ended', ()=>{
  state.playing = false;
  $('playBtn').textContent = '▶ Phát thử';
});

let isSeeking = false;
$('seekBar').addEventListener('input', e=>{
  if(isExporting) return; // vẫn cho kéo nhưng không cập nhật trạng thái seek
  isSeeking = true; $('tCur').textContent = fmtTime(+e.target.value);
});
$('seekBar').addEventListener('change', e=>{
  if(isExporting){
    // phải reset isSeeking, không thì timeupdate bị khoá vĩnh viễn sau khi ghi xong
    isSeeking = false;
    setStatus('Đang ghi video — không tua lúc này (sẽ làm lệch đồng bộ bản ghi).', true);
    return;
  }
  audioEl.currentTime = Math.max(state.trimStart || 0, Math.min((state.trimEnd > 0 && state.trimEnd > state.trimStart) ? state.trimEnd : (+e.target.value), +e.target.value));
  isSeeking = false;
});
