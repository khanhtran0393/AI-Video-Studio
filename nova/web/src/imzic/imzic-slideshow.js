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
// vẽ 1 ảnh slide (raster hoặc gốc) với zoom bass + Ken Burns + kiểu vừa khung
function drawSlideLayer(slide, idx, zq, scale, kb, fitMode){
  const w = logicW, h = logicH;
  const raster = getSlideRaster(idx, zq) || slide.img;
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
// ---- lịch phát slideshow: mảng {start,end,idx,entry} phủ hết bài ----
// 'time': mỗi ảnh slideSecs giây, xoay vòng; 'cue': đổi ảnh theo từng câu SRT
let slideSchedule = { key:'', list:[] };
function getSlideSchedule(){
  const n = state.slides.length;
  if(!n) return {list:[], key:''};
  const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
  const key = [n, state.slideMode, state.slideSecs, dur.toFixed(3), state.lyricsCues.length, lyricsVersion].join('|');
  if(slideSchedule.key === key) return slideSchedule;
  const list = [];
  if(state.slideMode === 'cue' && state.lyricsCues.length){
    // ranh giới: 0 + các mốc bắt đầu câu + hết bài
    const bounds = [0];
    state.lyricsCues.forEach(c => { if(c.start > 0.05 && c.start < dur) bounds.push(c.start); });
    bounds.push(dur);
    for(let i=0;i<bounds.length-1;i++){
      if(bounds[i+1] - bounds[i] < 0.25) continue;
      list.push({start:bounds[i], end:bounds[i+1], idx:i%n, entry:i});
    }
  } else {
    const len = Math.max(0.5, state.slideSecs);
    const total = dur > 0 ? Math.max(1, Math.ceil(dur/len)) : 1;
    for(let i=0;i<total;i++){
      list.push({start:i*len, end:(i+1)*len, idx:i%n, entry:i});
    }
  }
  slideSchedule = {key, list};
  return slideSchedule;
}
