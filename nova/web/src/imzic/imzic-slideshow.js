'use strict';

/* imzic-slideshow.js — raster cache + slideshow nhiều ảnh + Ken Burns + lịch phát.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- #perf: raster cache cho ảnh nền ----
// drawImage từ ảnh GỐC (độ phân giải gốc, có thể vài nghìn px) MỖI FRAME là
// thao tác đắt nhất của render loop — nặng nhất khi ghi xuất 1080×1920. Ta
// quét ảnh MỘT LẦN vào canvas offscreen đúng khổ lớn nhất frame có thể cần,
// rồi mỗi frame chỉ vẽ từ bản raster này:
//   • raster = cover(khung VẬT LÝ) × zoomMax (làm tròn LÊN từng bước 0.05)
//     → luôn ≥ khổ hiển thị thật, chỉ bị downscale nhẹ (≤ zoomMax), không bao
//     giờ upscale → độ nét giữ nguyên so với vẽ từ ảnh gốc.
//   • bước quét lớn dùng imageSmoothingQuality 'high' — resample chất lượng
//     cao đúng MỘT lần, còn nét hơn resample mặc định lặp mỗi frame như cũ.
// Build lại chỉ khi: đổi ảnh / đổi khổ canvas (vào-ra chế độ ghi) / zoomMax
// vượt bước 0.05 kế tiếp — canvas vật lý không resize khi key giữ nguyên nên
// không phá track đang ghi.
let imgRaster = null, imgRasterKey = '';
const RASTER_ZOOM_STEP = 0.05;
function getImageRaster(){
  const img = state.img;
  if(!img || !img.width || !img.height) return null;
  // làm tròn LÊN theo bước 0.05 để kéo slider zoom không build lại liên tục
  const zq = Math.max(state.zoomMin,
    Math.ceil((state.zoomMax - 1e-9) / RASTER_ZOOM_STEP) * RASTER_ZOOM_STEP);
  const key = [img.src, img.width, img.height, canvas.width, canvas.height, zq.toFixed(3)].join('|');
  if(imgRaster && imgRasterKey === key) return imgRaster;
  const cover = Math.max(canvas.width/img.width, canvas.height/img.height) * zq;
  const rw = Math.max(1, Math.round(img.width*cover));
  const rh = Math.max(1, Math.round(img.height*cover));
  const oc = document.createElement('canvas');
  oc.width = rw; oc.height = rh;
  const octx = oc.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, 0, 0, rw, rh);
  imgRaster = oc; imgRasterKey = key;
  return oc;
}

// ---- #slideshow: raster + nền blur cho TỪNG ảnh của slideshow ----
// Raster giữ tối đa 3 ảnh gần nhất (1080×1920×4B ≈ 8MB/ảnh → giới hạn bộ nhớ);
// ảnh chuyển cảnh vẽ trực tiếp từ Image gốc (chỉ ~0.6s nên không ảnh hưởng hiệu năng).
const slideRasterCache = new Map(); // idx → {key, canvas}
const slideBlurCache  = new Map(); // idx → {key, canvas}
function rasterKeyFor(img, zq){
  return [img.src, img.width, img.height, canvas.width, canvas.height, zq.toFixed(3)].join('|');
}
function buildRaster(img, zq){
  const cover = Math.max(canvas.width/img.width, canvas.height/img.height) * zq;
  const oc = document.createElement('canvas');
  oc.width  = Math.max(1, Math.round(img.width * cover));
  oc.height = Math.max(1, Math.round(img.height * cover));
  const octx = oc.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, 0, 0, oc.width, oc.height);
  return oc;
}
function getSlideRaster(idx, zq){
  const img = state.slides[idx] && state.slides[idx].img;
  if(!img || !img.width) return null;
  const key = rasterKeyFor(img, zq);
  const hit = slideRasterCache.get(idx);
  if(hit && hit.key === key) return hit.canvas;
  const oc = buildRaster(img, zq);
  slideRasterCache.set(idx, {key, canvas: oc});
  // dọn cache giữ tối đa 3 phần tử (idx hiện tại + 2 hàng xóm khi chuyển cảnh)
  while(slideRasterCache.size > 3){
    const first = slideRasterCache.keys().next().value;
    if(first === idx) break;
    slideRasterCache.delete(first);
  }
  return oc;
}
// nền blur: cover-phóng ảnh để lấp khung, blur 1 LẦN vào offscreen rồi dùng lại
function getSlideBlurBg(idx){
  const img = state.slides[idx] && state.slides[idx].img;
  if(!img || !img.width) return null;
  const key = [img.src, img.width, img.height, canvas.width, canvas.height].join('|');
  const hit = slideBlurCache.get(idx);
  if(hit && hit.key === key) return hit.canvas;
  const w = canvas.width, h = canvas.height;
  const small = document.createElement('canvas');
  small.width = Math.max(16, Math.round(w/24));   // thu nhỏ → blur rẻ mà nhìn giống hệt
  small.height = Math.max(16, Math.round(h/24));
  const sctx = small.getContext('2d');
  const cover = Math.max(small.width/img.width, small.height/img.height);
  const dw = img.width*cover, dh = img.height*cover;
  sctx.filter = 'blur(6px)';
  sctx.drawImage(img, (small.width-dw)/2, (small.height-dh)/2, dw, dh);
  sctx.filter = 'none';
  // làm tối nhẹ để ảnh chính nổi lên
  sctx.fillStyle = 'rgba(0,0,0,0.35)';
  sctx.fillRect(0, 0, small.width, small.height);
  slideBlurCache.set(idx, {key, canvas: small});
  while(slideBlurCache.size > 4){
    const first = slideBlurCache.keys().next().value;
    if(first === idx) break;
    slideBlurCache.delete(first);
  }
  return small;
}
// ---- fitMode 'square': bố cục "Ô vuông giữa + nền mờ" ----
// Nền: fullscreen cover của ảnh nền RIÊNG (state.bgImg) nếu có chọn, không thì
// tự dùng chính ảnh đang phát — blur theo state.bgBlur (logic px), lệch mờ
// trái/phải theo state.bgBlurSide (gradient: âm = trái mờ nhiều hơn, dương =
// phải mờ nhiều hơn). Chính: ảnh (hoặc ảnh slide hiện tại) cắt VUÔNG đúng tâm
// (chia điều tâm), cạnh = 1/3 chiều cao khung × state.sqSize%, xoay
// state.sqTilt° + nghiêng state.sqSkew°. Deterministic (Luật 8) — không random,
// không phụ thuộc nhạc; export offline đi qua cùng đường vẽ nên giữ nguyên.
const squareBlurCache = new Map(); // key → canvas nền mờ (LRU 4)
function getSquareBlurBg(img){
  if(!img || !img.width || !img.height) return null;
  const w = canvas.width, h = canvas.height;
  const b = Math.max(0, state.bgBlur || 0);
  const side = state.bgBlurSide || 0;
  const key = [img.src, img.width, img.height, w, h, b, side].join('|');
  const hit = squareBlurCache.get(key);
  if(hit) return hit;
  const K = 10; // dựng nhỏ rồi phóng toàn khung — blur rẻ mà nhìn như blur to (như getSlideBlurBg)
  const sw = Math.max(16, Math.round(w/K)), sh = Math.max(16, Math.round(h/K));
  const base = document.createElement('canvas'); base.width = sw; base.height = sh;
  const bx = base.getContext('2d');
  const cover = Math.max(sw/img.width, sh/img.height);
  const dw = img.width*cover, dh = img.height*cover;
  // quy đổi blur: state.bgBlur tính theo px LOGIC; canvas nhỏ là 1/K canvas vật
  // lý (w = logicW × hệ số phóng khi ghi) → blur nhỏ = blurLogic × (sw/logicW)
  const kBlur = sw / logicW;
  if(b > 0.5) bx.filter = 'blur(' + (b*kBlur).toFixed(2) + 'px)';
  bx.drawImage(img, (sw-dw)/2, (sh-dh)/2, dw, dh);
  bx.filter = 'none';
  if(side !== 0 && b > 0.5){
    // lớp blur MẠNH HƠN phủ dần về phía được chọn (mờ lệch trái/phải)
    const extra = (Math.abs(side)/100) * 22; // cộng thêm tối đa 22 logic px
    const lay = document.createElement('canvas'); lay.width = sw; lay.height = sh;
    const lx = lay.getContext('2d');
    lx.filter = 'blur(' + ((b+extra)*kBlur).toFixed(2) + 'px)';
    lx.drawImage(img, (sw-dw)/2, (sh-dh)/2, dw, dh);
    lx.filter = 'none';
    lx.globalCompositeOperation = 'destination-in';
    const g = lx.createLinearGradient(0, 0, sw, 0);
    if(side > 0){ g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); }
    else        { g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
    lx.fillStyle = g;
    lx.fillRect(0, 0, sw, sh);
    bx.drawImage(lay, 0, 0);
  }
  // làm tối nhẹ để ô vuông nổi lên (đồng bộ cách làm của getSlideBlurBg)
  bx.fillStyle = 'rgba(0,0,0,0.28)';
  bx.fillRect(0, 0, sw, sh);
  squareBlurCache.set(key, base);
  while(squareBlurCache.size > 4){
    const first = squareBlurCache.keys().next().value;
    if(first === key) break;
    squareBlurCache.delete(first);
  }
  return base;
}
// vẽ cả bố cục: nền mờ fullscreen + ô vuông chính giữa. ai gọi truyền (ảnh
// chính, raster đã quét sẵn của ảnh đó — không có thì vẽ từ ảnh gốc)
function drawSquareLayout(img, raster){
  const w = logicW, h = logicH;
  const bg = getSquareBlurBg(state.bgImg || img);
  if(bg) ctx.drawImage(bg, 0, 0, w, h);
  else { ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, w, h); }
  if(!img || !img.width || !img.height) return;
  const src = raster || img;
  if(!src.width || !src.height) return;
  const side = h/3 * (state.sqSize/100); // mặc định: hình vuông = 1/3 chiều cao
  // cắt VUÔNG đúng tâm ảnh (chia điều tâm) — raster cover giữ tâm = tâm ảnh
  const sside = Math.min(src.width, src.height);
  const sx = (src.width - sside)/2, sy = (src.height - sside)/2;
  ctx.save();
  ctx.translate(w/2, h/2);
  if(state.sqTilt) ctx.rotate(state.sqTilt * Math.PI/180);
  if(state.sqSkew) ctx.transform(1, 0, Math.tan(state.sqSkew * Math.PI/180), 1, 0, 0);
  // đổ bóng nhẹ để ô vuông tách khỏi nền mờ
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = side * 0.08;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sside, sside, -side/2, -side/2, side, side);
  ctx.restore();
}
// vẽ 1 ảnh slide (raster hoặc gốc) với zoom bass + Ken Burns + kiểu vừa khung
function drawSlideLayer(slide, idx, zq, scale, kb, fitMode){
  const w = logicW, h = logicH;
  const raster = getSlideRaster(idx, zq) || slide.img;
  if(fitMode === 'square'){
    // "Ô vuông giữa + nền mờ": nền mờ từ ảnh nền riêng (hoặc chính ảnh slide),
    // ô vuông cắt từ ảnh slide hiện tại — có crossfade tự nhiên khi chuyển cảnh
    drawSquareLayout(slide.img, raster);
    return;
  }
  if(fitMode !== 'cover'){
    // nền: blur (từ chính ảnh) hoặc đen (contain)
    if(fitMode === 'blur'){
      const bg = getSlideBlurBg(idx);
      if(bg) ctx.drawImage(bg, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
    }
    // ảnh chính: vừa đủ (contain) — chỉ chạy Ken Burns nhẹ, không nhân zoom bass
    // (zoom bass toàn khung làm viền phập phồng, nhìn khó chịu)
    const kbOnly = kb.scale / Math.max(0.0001, scale);
    const s2 = Math.min(w/slide.img.width, h/slide.img.height) * kbOnly;
    const dw2 = slide.img.width * s2, dh2 = slide.img.height * s2;
    ctx.drawImage(raster, (w-dw2)/2 + kb.px*w, (h-dh2)/2 + kb.py*h, dw2, dh2);
    return;
  }
  // cover: zoom bass + Ken Burns, lấp đầy khung
  const cover = Math.max(w/slide.img.width, h/slide.img.height) * scale * kb.scale;
  const dw = slide.img.width*cover, dh = slide.img.height*cover;
  const dx = (w-dw)/2 + kb.px*w*cover, dy = (h-dh)/2 + kb.py*h*cover;
  ctx.drawImage(raster, dx, dy, dw, dh);
}
// Ken Burns: deterministic theo (idx ảnh, lần phát thứ k) — Luật 8, không Math.random
function kenBurnsAt(idx, entry, p){
  const h1 = fxH01(idx*7.61 + 13.7);
  const h2 = fxH01(idx*3.17 + 71.3);
  const h3 = fxH01(idx*9.77 + entry*5.31);
  const e = p*p*(3-2*p);                       // smoothstep — chậm dần về cuối
  const zoomIn = h1 < 0.5;                     // nửa ảnh zoom to, nửa zoom lùi
  const z0 = 1.04, z1 = 1.14;
  const kbScale = zoomIn ? (z0 + (z1-z0)*e) : (z1 - (z1-z0)*e);
  const px = (h2 - 0.5) * 0.10 * (zoomIn ? e : 1-e) * (h3 < 0.5 ? 1 : -1);
  const py = (fxH01(idx*5.13 + entry*2.9) - 0.5) * 0.06 * (zoomIn ? e : 1-e);
  return {scale: kbScale, px, py};
}
// ---- thứ tự ảnh slideshow: 'order' theo thứ tự chọn / 'shuffle' xáo trộn ----
// Luật 8 (deterministic): KHÔNG Math.random vào render — xáo trộn Fisher–Yates
// với PRNG LCG seed cố định = hash tên file (đổi bộ ảnh → xáo khác nhau)
// ^ seed tăng mỗi lần bấm "🔄 Xáo lại". Trong MỘT lần render/xuất thứ tự giữ
// nguyên (reproducible — preview khớp file xuất).
function slideNamesSeed(names){
  let h = 2166136261;
  for(let i=0;i<names.length;i++){
    const s = String(names[i] || '');
    for(let j=0;j<s.length;j++){ h ^= s.charCodeAt(j); h = (h * 16777619) >>> 0; }
  }
  return h >>> 0;
}
function slideShuffleOrder(n, seed){
  const arr = [];
  for(let i=0;i<n;i++) arr.push(i);
  let s = seed >>> 0;
  if(!s) s = 0x9E3779B9; // seed 0 làm LCG kẹt ở 0 — trộn hằng số vô hại
  for(let i=n-1;i>0;i--){
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((s / 4294967296) * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
// ---- E1: dồn ranh giới về nhịp gần nhất (deterministic — binary search) ----
// offlineAnalysis.beats do imzic-analysis.js tạo TRƯỚC (load order) — chỉ đọc
// lúc runtime nên không phụ thuộc thứ tự khai báo.
function snapBoundToBeat(t, lo, len){
  const beats = offlineAnalysis.beats;
  let a = 0, b = beats.length - 1;
  while(a < b){ const m = (a + b) >> 1; if(beats[m] < t) a = m + 1; else b = m; }
  let best = -1, bestD = Infinity;
  for(const i of [a, a - 1]){
    if(i >= 0 && i < beats.length){
      const d = Math.abs(beats[i] - t);
      if(d < bestD){ bestD = d; best = beats[i]; }
    }
  }
  if(best < 0 || bestD > len * 0.4) return t;   // không có nhịp đủ gần → giữ nguyên
  if(best <= lo + 0.5) return t;                // nhịp quá sát ranh giới trước → giữ nguyên
  return best;
}
// ---- lịch phát slideshow: mảng {start,end,idx,entry} phủ hết bài ----
// 'time': mỗi ảnh slideSecs giây, xoay vòng; 'cue': đổi ảnh theo từng câu SRT.
// 'shuffle': idx xoay vòng qua HOÁN VỊ đã xáo thay vì 0,1,2… — ảnh không lặp
// lại cho đến khi hết một vòng đầy đủ.
let slideSchedule = { key:'', list:[] };
function getSlideSchedule(){
  const n = state.slides.length;
  if(!n) return {list:[], key:''};
  const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
  const namesSeed = slideNamesSeed(state.slides.map(s => s.name));
  const key = [n, state.slideMode, state.slideSecs, dur.toFixed(3), state.lyricsCues.length, lyricsVersion, state.slideOrder, state.slideShuffleSeed, namesSeed, state.slideBeatSnap, (state.slideBeatSnap && offlineAnalysis) ? offlineAnalysis.beats.length : 0].join('|');
  if(slideSchedule.key === key) return slideSchedule;
  const orderList = (state.slideOrder === 'shuffle')
    ? slideShuffleOrder(n, (namesSeed ^ Math.imul(state.slideShuffleSeed + 1, 2654435761)) >>> 0)
    : null;
  const idxAt = i => orderList ? orderList[i % n] : (i % n);
  const list = [];
  if(state.slideMode === 'cue' && state.lyricsCues.length){
    // ranh giới: 0 + các mốc bắt đầu câu + hết bài
    const bounds = [0];
    state.lyricsCues.forEach(c => { if(c.start > 0.05 && c.start < dur) bounds.push(c.start); });
    bounds.push(dur);
    for(let i=0;i<bounds.length-1;i++){
      if(bounds[i+1] - bounds[i] < 0.25) continue;
      list.push({start:bounds[i], end:bounds[i+1], idx:idxAt(i), entry:i});
    }
  } else {
    const len = Math.max(0.5, state.slideSecs);
    const total = dur > 0 ? Math.max(1, Math.ceil(dur/len)) : 1;
    // E1 beat-snap: ranh giới trong (i>0) dồn về nhịp gần nhất (±40% len) khi
    // bật "Bám nhịp" và đã có phân tích nhạc; không có dữ liệu → ranh giới đều
    // như cũ (khai báo rõ, không fallback ngầm). Preview và "⚡ Xuất nhanh" dùng
    // CÙNG lịch này (Luật 8 — file xuất khớp preview).
    const snap = !!state.slideBeatSnap && offlineAnalysis && offlineAnalysis.beats && offlineAnalysis.beats.length > 0;
    const bounds = [0];
    for(let i=1;i<total;i++) bounds.push(snap ? snapBoundToBeat(i*len, bounds[i-1], len) : i*len);
    for(let i=0;i<total;i++){
      list.push({start:bounds[i], end:(i+1)*len, idx:idxAt(i), entry:i});
    }
  }
  slideSchedule = {key, list};
  return slideSchedule;
}
