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
function drawBackground(scale, t){
  const w = logicW, h = logicH;
  if(state.slides.length){
    const sched = getSlideSchedule().list;
    if(!sched.length){
      ctx.fillStyle = '#050508'; ctx.fillRect(0,0,w,h);
      return;
    }
    let seg = sched[sched.length-1];
    for(const s of sched){ if(t >= s.start && t < s.end){ seg = s; break; } }
    const segIdx = sched.indexOf(seg);
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
  if(state.img){
    // #perf: vẽ từ raster đã quét sẵn (luôn ≥ khổ hiển thị) thay vì resample
    // ảnh gốc độ phân giải đầy đủ mỗi frame — vị trí/kích thước giữ nguyên.
    const raster = getImageRaster();
    const iw = state.img.width, ih = state.img.height;
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
function render(now){
  now = now || performance.now();
  let dtMs = now - lastT;
  lastT = now;
  // clamp so a big stall (tab was hidden) doesn't cause one huge jump,
  // but still catches particles/zoom back up to real time quickly
  dtMs = Math.min(dtMs, 250);
  const dt = dtMs / 16.67; // 1.0 == normal 60fps frame

  // offline render ("⚡ Xuất nhanh") tự vẽ theo đồng hồ logic — rAF chỉ đợi
  if(offlineRendering){
    rafId = requestAnimationFrame(render);
    return;
  }

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
  applyFx(smoothedEnergy); // FX toàn khung phủ trên cùng (như z:90 của Nova)

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

  rafId = requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ---- file loading ----
let imgObjUrl = null;
$('imgInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi ảnh giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  const looksImage = (f.type && f.type.startsWith('image')) || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name);
  if(!looksImage){
    setStatus('File này có vẻ không phải ảnh — chọn lại file png/jpg/webp nhé.', true);
    e.target.value = '';
    return;
  }
  state.imgFile = f;
  $('imgName').textContent = f.name;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = ()=>{
    // ảnh đã decode xong nằm trong bộ nhớ — thu hồi object URL cũ tránh rò rỉ
    if(imgObjUrl && imgObjUrl !== url) URL.revokeObjectURL(imgObjUrl);
    imgObjUrl = url;
    state.img = im;
    checkReady();
    setStatus('Đã nạp ảnh: ' + f.name, false);
  };
  im.onerror = ()=>{
    // lỗi lộ rõ (Luật 10): file hỏng / định dạng không hỗ trợ phải báo ngay
    URL.revokeObjectURL(url);
    setStatus('Không đọc được file ảnh này (file hỏng hoặc định dạng không hỗ trợ) — chọn ảnh khác nhé.', true);
    e.target.value = '';
  };
  im.src = url;
});

let audObjUrl = null;
$('audInput').addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(isExporting){ setStatus('Đang ghi video — không đổi nhạc giữa chừng (bản ghi sẽ hỏng). Chờ ghi xong rồi đổi nhé.', true); e.target.value = ''; return; }
  const looksAudio = (f.type && f.type.startsWith('audio')) || /\.(mp3|wav|m4a|aac|ogg|flac|wma|opus|mp4|3gp)$/i.test(f.name);
  if(!looksAudio){
    setStatus('File này có vẻ không phải nhạc — chọn lại giúp mình file mp3/wav/m4a/aac nhé.', true);
    e.target.value = '';
    return;
  }
  state.audioFile = f;
  state.audioReady = false;
  offlineAnalysis = null; offlineAnalysisPromise = null; // file mới → phân tích lại
  $('audName').textContent = f.name;
  if(audObjUrl) URL.revokeObjectURL(audObjUrl);
  audObjUrl = URL.createObjectURL(f);
  audioEl.src = audObjUrl;
  audioEl.load();
  audioEl.onloadedmetadata = ()=>{
    const dur = isFinite(audioEl.duration) ? audioEl.duration : 100; // webm có thể trả Infinity lúc đầu
    $('seekBar').max = dur;
    $('seekBar').disabled = false;
    $('tDur').textContent = fmtTime(audioEl.duration);
    state.audioReady = true;
    checkReady();
    // phân tích offline (marker nhịp + envelope cho "⚡ Xuất nhanh") chạy nền
    ensureOfflineAnalysis();
  };
  audioEl.onerror = ()=>{
    state.audioReady = false;
    setStatus('Không đọc được file nhạc này (file hỏng hoặc codec không hỗ trợ) — chọn file khác nhé.', true);
  };
});

function checkReady(){
  const hasVisual = state.img || state.slides.length;
  if(hasVisual && state.audioFile && state.audioReady){
    emptyState.style.display = 'none';
    $('playBtn').disabled = false;
    $('restartBtn').disabled = false;
    $('exportAudioBtn').disabled = false;
    $('exportSilentBtn').disabled = false;
    $('exportOfflineBtn').disabled = false;
    $('exportOpts').style.display = 'flex';
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
