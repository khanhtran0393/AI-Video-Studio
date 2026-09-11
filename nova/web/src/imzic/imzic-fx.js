'use strict';

/* imzic-fx.js — FX toàn khung (glitch/vhs/motion-blur/god-rays/milkdrop…).
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- FX toàn khung (vizzy-style: glitch / vhs-NTSC / zoom mờ / motion blur / hạt / nhịp / god-rays / nét FSR / chromakey / noise / hue / shader-GL / milkdrop) ----
// Post-process vẽ LÊN canvas sau ảnh+hạt+sóng+lời → tự nằm trong video xuất
// (MediaRecorder ghi canvas). Deterministic (Luật 8): mọi "ngẫu nhiên" là
// sin-hash theo số khung — render lại ra đúng từng khung, không Math.random.
let fxFrame = 0;
function fxH01(n){ const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); }

// 4 tile nhiễu hạt 256×256 sinh 1 lần bằng mulberry32 (seed cố định)
const fxNoiseTiles = [];
(function buildFxNoiseTiles(){
  let seed = 20260906;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for(let k=0;k<4;k++){
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const cc = c.getContext('2d');
    const d = cc.createImageData(256, 256);
    for(let i=0;i<d.data.length;i+=4){
      const v = 36 + Math.floor(rnd()*184);
      d.data[i]=v; d.data[i+1]=v; d.data[i+2]=v; d.data[i+3]=255;
    }
    cc.putImageData(d, 0, 0);
    fxNoiseTiles.push(c);
  }
})();
let fxNoisePatterns = null; // pattern tạo từ ctx chính, cache sau lần đầu
// buffer sharpen (unsharp mask kiểu FSR): A = bản gốc, B = bản blur — tạo lazily
let fxSharpenA = null, fxSharpenB = null;
// buffer chromakey/despill (nguồn mở Vizzy credit: otdavies/UnityChromakey) — tạo lazily
let fxKeyA = null;
// buffer nhỏ 1/4 độ phân giải chung cho FX noise (smoke/aurora) — tạo lazily
let fxLowA = null;
// mã lỗi shader đã báo (báo đúng 1 lần — IMZIC_NO_WEBGL2 / IMZIC_GL_COMPILE / IMZIC_GL_LINK)
let fxGLErrCode = null;
// Butterchurn (Milkdrop) — vendor UMD nova/web/vendor/, báo mất context đúng 1 lần
let bcViz = null, bcCanvas = null, bcVizPreset = '', bcWarnedLost = false;
// tile scanline VHS: 1×4 px (2 sáng / 2 tối) — lặp bằng createPattern
const fxScanTile = (function(){
  const c = document.createElement('canvas'); c.width = 1; c.height = 4;
  const cc = c.getContext('2d');
  cc.fillStyle = 'rgba(0,0,0,0.55)'; cc.fillRect(0, 2, 1, 2);
  return c;
})();

function applyFx(bassEnergy){
  const f = state.fx;
  if(!f || f === 'none') return;
  fxFrame++;
  const W = canvas.width, H = canvas.height;   // toạ độ VẬT LÝ
  const k = W / logicW;                        // logic → vật lý (khi ghi xuất phóng 1.5×)
  const L = state.fxLevel;                     // 0.1..1
  const fr = fxFrame;
  const prevAlpha = ctx.globalAlpha, prevComp = ctx.globalCompositeOperation;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try{
    if(f === 'glitch'){
      // 1) tách màu RGB mảnh nhẹ MỖI khung
      const shift = (2 + 10*L) * k * (fxH01(fr*0.331)*2 - 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.07 + 0.09*L;
      ctx.drawImage(canvas, -shift, 0, W, H);
      ctx.drawImage(canvas,  shift, 0, W, H);
      // 2) trượt dải ngang — chỉ nổ ra trên ~12% khung theo sin-hash
      if(fxH01(fr*0.713) > 1 - 0.12*L){
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const nStrips = 2 + Math.floor(fxH01(fr*1.917)*3);
        for(let i=0;i<nStrips;i++){
          const sy = fxH01(fr*7.31 + i*13.7) * H;
          const sh = (6 + fxH01(fr*3.77 + i*5.1) * H*0.05) * k;
          const off = (fxH01(fr*9.13 + i*3.3)*2 - 1) * W * 0.06 * L;
          ctx.drawImage(canvas, 0, sy, W, sh, off, sy, W, sh);
        }
      }
    } else if(f === 'vhs'){
      // 1) lệch màu nhẹ (chroma bleed)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05 + 0.07*L;
      ctx.drawImage(canvas, (2 + 4*L)*k, 0, W, H);
      // 2) dải sáng lăn chậm dọc khung
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const bandY = (((fr*0.004) % 1.3) - 0.15) * H;
      const bandH = H*0.12;
      const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      bg.addColorStop(0, 'rgba(255,255,255,0)');
      bg.addColorStop(0.5, 'rgba(255,255,255,' + (0.08*L).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, bandY, W, bandH);
      // 3) scanline đè mờ
      ctx.globalAlpha = 0.22 + 0.18*L;
      const pat = ctx.createPattern(fxScanTile, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      // 4) chroma crawl dọc — tách màu theo quét ngang, lấy tinh thần thuật toán
      //    NTSC composite (MAME hlsl/ntsc.fx, BSD-3) nhưng chưng cất còn 2 bản sao
      //    lệch dọc ngược pha đè bằng 'lighter' — đủ "analog" mà vẫn rẻ từng khung
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.04 + 0.08*L;
      const craw = (1 + 2*L) * k;
      ctx.drawImage(canvas, 0, -craw, W, H);
      ctx.drawImage(canvas, 0,  craw, W, H);
      // 5) lỗi tracking ngang — chỉ nổ ra trên một phần khung theo sin-hash (deterministic)
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if(fxH01(fr*0.911) > 1 - 0.25*L){
        ctx.drawImage(canvas, (fxH01(fr*3.71)*2 - 1) * 3 * k, 0, W, H);
      }
    } else if(f === 'zoomblur'){
      // vẽ lại chính khung phóng nhẹ 2 nấc — quét tia từ tâm ra
      ctx.globalCompositeOperation = 'source-over';
      const s1 = 1 + 0.008 + 0.03*L, s2 = 1 + 0.016 + 0.06*L;
      ctx.globalAlpha = 0.22*L;
      ctx.drawImage(canvas, -(W*(s1-1))/2, -(H*(s1-1))/2, W*s1, H*s1);
      ctx.globalAlpha = 0.13*L;
      ctx.drawImage(canvas, -(W*(s2-1))/2, -(H*(s2-1))/2, W*s2, H*s2);
    } else if(f === 'motionblur'){
      // vẽ lại chính khung trượt ngang — vệt lia máy
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.18*L;
      ctx.drawImage(canvas, -(6 + 10*L)*k, 0, W, H);
      ctx.globalAlpha = 0.11*L;
      ctx.drawImage(canvas,  (12 + 16*L)*k, 0, W, H);
    } else if(f === 'noise'){
      // hạt phim: 4 tile quay vòng theo số khung, đè bằng blend 'overlay'
      if(!fxNoisePatterns) fxNoisePatterns = fxNoiseTiles.map(t => ctx.createPattern(t, 'repeat'));
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.05 + 0.09*L;
      ctx.fillStyle = fxNoisePatterns[fr % fxNoisePatterns.length];
      ctx.fillRect(0, 0, W, H);
    } else if(f === 'pulse'){
      // viền tối co giật theo bass THẬT của FFT (0..1) — music-reactive
      const a = Math.min(0.85, (0.22 + 0.60*bassEnergy) * L);
      const g = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.26, W/2, H/2, Math.max(W,H)*0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + a.toFixed(3) + ')');
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if(f === 'godrays'){
      // God rays — nguồn mở Vizzy credit: medium.com/community-play-3d
      // "god-rays-what's-that" + shadertoy ls2Xzd. Bản canvas 2D: chùm tia loe
      // từ nguồn sáng trên đỉnh, quét chậm quanh trục, sáng lên theo bass.
      // Mọi chuyển động là sin/sin-hash theo số khung → render lại giống hệt (Luật 8).
      const srcX = W * (0.5 + 0.18 * Math.sin(fr*0.0021));
      const srcY = -H * 0.08;
      const beams = 7;
      ctx.globalCompositeOperation = 'lighter';
      for(let i=0;i<beams;i++){
        const off = (i - (beams-1)/2) * 0.16 + 0.08 * Math.sin(fr*0.0016 + i*2.1);
        const len = H * 1.4;
        const wid = W * (0.05 + 0.16 * (0.5 + 0.5*Math.sin(fr*0.0011 + i*1.7)));
        const a = (0.05 + 0.16*L) * (0.4 + 0.6*bassEnergy) * (0.35 + 0.65*(0.5 + 0.5*Math.sin(fr*0.0026 + i*2.9)));
        if(a <= 0.004) continue;
        ctx.save();
        ctx.translate(srcX, srcY);
        ctx.rotate(off);
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, 'rgba(255,244,214,' + Math.min(1, a*1.4).toFixed(3) + ')');
        g.addColorStop(0.6, 'rgba(255,236,190,' + (a*0.5).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-wid*0.12, 0);
        ctx.lineTo(wid*0.12, 0);
        ctx.lineTo(wid, len);
        ctx.lineTo(-wid, len);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // quầng sáng quanh nguồn — đập theo bass
      ctx.globalAlpha = 1;
      const aGlow = Math.min(0.5, (0.08 + 0.30*L) * (0.3 + 0.7*bassEnergy));
      const rg = ctx.createRadialGradient(srcX, srcY, 0, srcX, srcY, Math.min(W,H)*0.5);
      rg.addColorStop(0, 'rgba(255,248,224,' + aGlow.toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,248,224,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    } else if(f === 'sharpen'){
      // Nét & tương phản — theo AMD FidelityFX FSR (credit nguồn mở của Vizzy:
      // agyild mpv port → goingdigital WebGL port). Canvas 2D không sample lân cận
      // nên dùng unsharp mask: A=bản gốc, B=bản blur; canvas = |A−B| (difference)
      // rồi cộng A lại bằng 'lighter' kèm filter contrast/saturate → cạnh sáng rõ,
      // màu đậm hơn. Cường độ L điều khiển bán kính blur + độ cộng cạnh.
      if(!fxSharpenA){
        fxSharpenA = document.createElement('canvas');
        fxSharpenB = document.createElement('canvas');
      }
      if(fxSharpenA.width !== W || fxSharpenA.height !== H){
        fxSharpenA.width = W; fxSharpenA.height = H;
        fxSharpenB.width = W; fxSharpenB.height = H;
      }
      const a = fxSharpenA.getContext('2d');
      a.setTransform(1,0,0,1,0,0); a.globalAlpha = 1; a.filter = 'none';
      a.clearRect(0, 0, W, H);
      a.drawImage(canvas, 0, 0, W, H);
      const b = fxSharpenB.getContext('2d');
      b.setTransform(1,0,0,1,0,0); b.globalAlpha = 1;
      b.clearRect(0, 0, W, H);
      b.filter = 'blur(' + Math.max(1, (1.2 + 1.6*L)*k).toFixed(1) + 'px)';
      b.drawImage(fxSharpenA, 0, 0, W, H);
      b.filter = 'none';
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = 1;
      ctx.drawImage(fxSharpenB, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.30 + 0.45*L;
      ctx.filter = 'contrast(' + (1 + 0.30*L).toFixed(2) + ') saturate(' + (1 + 0.18*L).toFixed(2) + ')';
      ctx.drawImage(fxSharpenA, 0, 0, W, H);
    } else if(f === 'chromakey'){
      // Gỡ phông xanh — theo thuật toán UnityChromakey (credit nguồn mở của Vizzy:
      // github.com/otdavies/UnityChromakey): đổi RGB → YCbCr, đo khoảng cách chroma
      // tới khoá xanh lè (0,1,0), xoá pixel trong ngưỡng có dải mềm (feather) ở viền;
      // pixel bán khoá được despill — hút xanh lây (g > max(r,b)) về max(r,b).
      // Vùng đã khoá lấp bằng nền đen ('destination-over') → preview và video xuất
      // nhìn giống hệt nhau (alpha trong MediaRecorder không đáng tin). fxLevel mở
      // rộng ngưỡng khoá + lực despill. Loop ảnh vật lý mỗi khung — nặng hơn các FX
      // khác, chỉ chạy khi người dùng chọn. Deterministic (Luật 8): không ngẫu nhiên.
      if(!fxKeyA) fxKeyA = document.createElement('canvas');
      if(fxKeyA.width !== W || fxKeyA.height !== H) fxKeyA.width = W, fxKeyA.height = H;
      const a = fxKeyA.getContext('2d');
      a.setTransform(1,0,0,1,0,0); a.globalAlpha = 1;
      a.clearRect(0, 0, W, H);
      a.drawImage(canvas, 0, 0, W, H);
      const img = a.getImageData(0, 0, W, H);
      const d = img.data;
      const tol = 0.055 + 0.22 * L;          // ngưỡng khoá (cường độ → vùng xoá rộng hơn)
      const feather = 0.10;                  // bề rộng dải mềm quanh ngưỡng
      const spill = Math.min(1, 0.35 + 0.65 * L); // lực hút xanh lây ở viền
      const cbKey = 0.5 - 0.331264, crKey = 0.5 - 0.418688; // (0,1,0) qua rgb2cb/rgb2cr
      for(let i = 0; i < d.length; i += 4){
        const r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
        const cb = 0.5 - 0.168736*r - 0.331264*g + 0.5*b;
        const cr = 0.5 + 0.5*r - 0.418688*g - 0.081312*b;
        const dist = Math.hypot(cb - cbKey, cr - crKey);
        let alpha = 1;
        if(dist < tol) alpha = 0;
        else if(dist < tol + feather){
          alpha = (dist - tol) / feather;
          const mx = Math.max(r, b);
          if(g > mx) d[i+1] = Math.round((g - (g - mx) * spill * (1 - alpha)) * 255);
        }
        d[i+3] = Math.round(255 * alpha);
      }
      a.putImageData(img, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(fxKeyA, 0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    } else if(f === 'smoke' || f === 'aurora'){
      // FX noise — tái tạo webgl-noise (ashima/stegu, MIT) dạng canvas 2D qua
      // imzic-noise.js (fbm deterministic — Luật 8): render ở 1/4 độ phân giải rồi
      // phóng mượt (noise tần số thấp không mất chất), composite glsl-blend.
      const sw = Math.max(2, W >> 2), sh2 = Math.max(2, H >> 2);
      if(!fxLowA) fxLowA = document.createElement('canvas');
      if(fxLowA.width !== sw || fxLowA.height !== sh2){ fxLowA.width = sw; fxLowA.height = sh2; }
      const sc = fxLowA.getContext('2d');
      const im = sc.createImageData(sw, sh2);
      const dd = im.data;
      const bass = Math.min(1, bassEnergy || 0);
      if(f === 'smoke'){
        // Khói trôi: 2 lớp fbm lệch tần số/tốc độ, chỉ giữ dải trên ngưỡng
        const t = fr * 0.0035 * (1 + L);
        for(let y = 0; y < sh2; y++){
          for(let x = 0; x < sw; x++){
            const n = imzNFbm(x * 0.035 + t, y * 0.05 - t * 0.6);
            const m = imzNFbm(x * 0.012 + t * 1.7 + 40.0, y * 0.012 - 9.0);
            const v = Math.max(0, n * 0.75 + m * 0.45 - 0.52) * 2.2;
            const i4 = (y * sw + x) * 4;
            dd[i4] = Math.min(255, v * 190);
            dd[i4+1] = Math.min(255, v * 185);
            dd[i4+2] = Math.min(255, v * 200);
            dd[i4+3] = 255;
          }
        }
        sc.putImageData(im, 0, 0);
        ctx.globalCompositeOperation = 'screen'; // glsl-blend screen — chỉ sáng phần khói
        ctx.globalAlpha = 0.16 + 0.38 * L;
        ctx.drawImage(fxLowA, 0, 0, W, H);
      } else {
        // Aurora: 2 dải sáng uốn theo fbm, đập theo bass — tâm dải tính MỖI CỘT
        // một lần (không lặp theo hàng)
        const t = fr * 0.0028;
        const pulse = 0.55 + 0.75 * bass;
        const c1 = new Float32Array(sw), c2 = new Float32Array(sw);
        for(let x = 0; x < sw; x++){
          const u = x / sw;
          c1[x] = 0.30 + 0.13 * Math.sin(imzNFbm(u * 2.2 + t, t * 0.7) * 6.283 + u * 2.0);
          c2[x] = 0.62 + 0.10 * Math.sin(imzNFbm(u * 2.6 - t * 1.3, 7.0 + t * 0.5) * 6.283 - u * 1.4);
        }
        for(let y = 0; y < sh2; y++){
          const v = y / sh2;
          for(let x = 0; x < sw; x++){
            const a1 = Math.exp(-Math.pow((v - c1[x]) * 14.0, 2.0)) * pulse;
            const a2 = Math.exp(-Math.pow((v - c2[x]) * 16.0, 2.0)) * 0.8 * pulse;
            const i4 = (y * sw + x) * 4;
            dd[i4] = Math.min(255, a2 * 150);
            dd[i4+1] = Math.min(255, a1 * 210 + a2 * 90);
            dd[i4+2] = Math.min(255, a1 * 120 + a2 * 180);
            dd[i4+3] = 255;
          }
        }
        sc.putImageData(im, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.18 + 0.32 * L;
        ctx.drawImage(fxLowA, 0, 0, W, H);
      }
    } else if(f === 'huecycle'){
      // Xoay sắc màu toàn khung — tái tạo GLSL-Color-Spaces (tobspr, MIT) qua
      // imzRgb2hsv/imzHsv2rgb; lệch hue = nhịp frame (deterministic) + bass thật.
      const im = ctx.getImageData(0, 0, W, H);
      const d = im.data;
      const shift = ((fr * 0.0016) + 0.06 * Math.min(1, bassEnergy || 0)) % 1.0;
      for(let i = 0; i < d.length; i += 4){
        const hsv = imzRgb2hsv(d[i] / 255, d[i+1] / 255, d[i+2] / 255);
        if(hsv[1] < 0.05) continue; // pixel xám gần như giữ nguyên
        const rgb = imzHsv2rgb(hsv[0] + shift, hsv[1], hsv[2]);
        d[i] = Math.round(rgb[0] * 255);
        d[i+1] = Math.round(rgb[1] * 255);
        d[i+2] = Math.round(rgb[2] * 255);
      }
      ctx.putImageData(im, 0, 0);
    } else if(f === 'lightleak'){
      // Light leak — quầng sáng hueso tràn từ mép khung, composite 'soft-light'
      // (glsl-blend) + một lớp 'screen' mỏng cho phần cháy sáng. Vị trí rò rỉ
      // đổi mỗi ~90 frame theo hash deterministic (fxH01).
      const px = (fxH01(Math.floor(fr / 90)) * 0.7 - 0.35) * W;
      const rad = (0.55 + 0.25 * L) * H;
      const grd = ctx.createRadialGradient(W * 0.5 + px, -0.06 * H, 0, W * 0.5 + px, -0.06 * H, rad);
      grd.addColorStop(0, 'rgba(255,168,90,0.95)');
      grd.addColorStop(0.5, 'rgba(255,120,60,0.45)');
      grd.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.5 + 0.4 * L;
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.10 + 0.14 * L;
      ctx.fillRect(0, 0, W, H);
    } else if(f === 'godrays-gl' || f === 'ntsc-gl'){
      // Shader thật qua mini WebGL engine (imzic-glsl.js — vai glea.js):
      //  - godrays-gl: volumetric scattering shadertoy ls2Xzd (thuật gốc Vizzy)
      //  - ntsc-gl: composite encode→decode 1-pass chưng cất từ MAME ntsc.fx
      // LỖI WebGL2/compile → fail-loud có chủ đích (báo đúng 1 lần, code rõ —
      // Luật 10), khung tiếp tục vẽ nội dung gốc; lỗi khác KHÔNG nuốt.
      try{
        const out = imzGLRender(f, f === 'ntsc-gl' ? imzGL_FRAG_NTSC : imzGL_FRAG_GODRAYS, canvas, W, H, { time: fr, bass: Math.min(1, bassEnergy || 0), level: L });
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(out, 0, 0, W, H);
      }catch(err){
        if(err && (err.code === 'IMZIC_NO_WEBGL2' || err.code === 'IMZIC_GL_COMPILE' || err.code === 'IMZIC_GL_LINK')){
          if(fxGLErrCode !== err.code){
            fxGLErrCode = err.code;
            setStatus('FX ' + f + ' cần WebGL2 (' + err.code + ') — máy đang chạy --disable-gpu hoặc driver cũ. Khung đang chỉ vẽ nội dung gốc. Chọn lại FX để thử lại.', true);
          }
        } else {
          throw err;
        }
      }
    } else if(f === 'milkdrop'){
      // Milkdrop — Butterchurn (MIT, github.com/jberg/butterchurn + butterchurn-presets,
      // vendor UMD tại nova/web/vendor/). Visualizer WebGL2 riêng, vẽ theo nhạc phát
      // THẬT (tap vào sourceNode không qua delay), composite 'screen' đè lên khung
      // với alpha theo cường độ → ảnh/hạt/sóng/lời vẫn nhìn thấy bên dưới.
      if(bcViz && bcCanvas){
        if(bcCanvas.width !== canvas.width || bcCanvas.height !== canvas.height){
          try{ bcEnsure(); }catch(err){ /* báo 1 lần bên dưới */ }
        }
        bcViz.render();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(1, 0.30 + 0.55*L);
        ctx.drawImage(bcCanvas, 0, 0, W, H);
      } else if(!bcWarnedLost){
        bcWarnedLost = true;
        setStatus('FX Milkdrop không render được (thiếu lib Butterchurn hoặc mất WebGL2) — khung đang chỉ vẽ nội dung gốc. Chọn lại FX trong mục 7 để thử lại.', true);
      }
    }
  } finally {
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = prevComp;
  }
}
