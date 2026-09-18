'use strict';

/* imzic-draw.js — drawWave + drawLeaf + drawParticles.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// 2026-09-18j: dispatch 16 kiểu sóng tách thành hàm riêng — dùng chung bởi
// drawWave (kiểu thường) và drawWaveBent (hiệu ứng "Uốn cong" vẽ kiểu nền vào
// canvas tạm). Bảng ánh xạ kiểu → hàm vẽ GIỮ NGUYÊN so với trước.
// 2026-09-18n: nhúng bản sao hàm thuần imzBend* từ nova/imzic-bend/engine.js
// (renderer không có build step — không require). Khi sửa hằng số/điều kiện
// trong engine, COPY LẠI bản inline dưới đây cho khớp (mất đồng bộ là lỗi
// thật — kiểm chứng bằng test node nova/imzic-bend/test.js + hàm dưới).
const IMZ_BEND_PI = Math.PI;
function imzBend_check(cond, code, msg){ if(!cond) throw new Error(code+': '+msg); }
function imzBendCEff(c, beat, kBeat){
  imzBend_check(Number.isFinite(c), 'IMZIC_BEND_C', 'c not finite');
  const c0 = Math.min(1, Math.max(0, c));
  if(c0 <= 0) return 0;
  if(!kBeat) return c0;
  imzBend_check(Number.isFinite(beat), 'IMZIC_BEND_C', 'beat not finite');
  imzBend_check(beat >= 0 && beat <= 1, 'IMZIC_BEND_C', 'beat not in [0,1]');
  return Math.min(1, c0 * (1 + kBeat * beat));
}
function imzBendRadius(widthPx, cEff){
  imzBend_check(widthPx > 0, 'IMZIC_BEND_W', 'widthPx <= 0');
  return widthPx / (2 * IMZ_BEND_PI * cEff);
}
function imzBendArcPoint(t, cEff, anchor, side, startX, widthPx, baseY){
  imzBend_check(Number.isFinite(t), 'IMZIC_BEND_T', 't not finite');
  imzBend_check(t >= 0 && t <= 1, 'IMZIC_BEND_T', 't not in [0,1]');
  imzBend_check(anchor==='start'||anchor==='center'||anchor==='end','IMZIC_BEND_ANCHOR','anchor='+anchor);
  imzBend_check(side==='up'||side==='down','IMZIC_BEND_SIDE','side='+side);
  if(cEff <= 0) return { x: startX + t*widthPx, y: baseY, angle: 0 };
  const R = imzBendRadius(widthPx, cEff);
  const tOff = anchor==='center' ? 0.5 : (anchor==='end' ? 1 : 0);
  const cx = anchor==='center' ? (startX + widthPx/2) : (anchor==='end' ? (startX + widthPx) : startX);
  const cy = side==='down' ? (baseY + R) : (baseY - R);
  const phi0 = side==='down' ? -IMZ_BEND_PI/2 : IMZ_BEND_PI/2;
  const phi = phi0 - 2*IMZ_BEND_PI*cEff*(t - tOff);
  const tx = Math.sin(phi);
  const ty = -Math.cos(phi);
  return {
    x: cx + Math.cos(phi)*R,
    y: cy + Math.sin(phi)*R,
    angle: Math.atan2(ty, tx)
  };
}
function imzBendSegCount(widthPx, cEff){
  imzBend_check(widthPx > 0, 'IMZIC_BEND_W', 'widthPx <= 0');
  imzBend_check(cEff >= 0, 'IMZIC_BEND_C', 'cEff < 0');
  const base = Math.max(48, Math.min(160, Math.round(widthPx/8)));
  return Math.max(48, Math.min(240, Math.round(base * (1 + cEff*0.5))));
}
function imzWaveDrawStyle(style,bins,w,h,baseY,startX,widthPx,amp){
  if(style==='ribbon') drawWaveRibbon(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='bars') drawWaveBars(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='circular') drawWaveCircular(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='dots') drawWaveDots(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='rainbow') drawWaveRainbow(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='bottombars') drawWaveBottomBars(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='arc') drawWaveArc(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='glow') drawWaveGlow(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='twin') drawWaveTwin(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='dashed') drawWaveDashed(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='spiral') drawWaveSpiral(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='circledots') drawWaveCircleDots(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='neon') drawWaveNeon(bins,w,h,baseY,startX,widthPx,amp);
  else if(style==='curved') drawWaveCurved(bins,w,h,baseY,startX,widthPx,amp);
  else drawWaveLine(bins,w,h,baseY,startX,widthPx,amp);
}

function drawWave(dt){
  if(!state.waveOn) return;
  waveTime += dt * 0.045;
  const bins = freqData || new Uint8Array(64);
  const w = logicW, h = logicH;
  const baseY = h * (state.wavePos/100);
  const widthPx = w * (state.waveWidth/100);
  // vị trí ngang (trái ↔ phải): 50% = giữa khung như cũ
  const startX = w * (state.wavePosX/100) - widthPx/2;
  const amp = state.waveHeight;

  ctx.save();
  // 2026-09-18j: hiệu ứng "Uốn cong" — tự dựng style setup riêng vì gradient
  // phải tạo từ context của canvas tạm (xem drawWaveBent).
  if(state.waveStyle==='bend'){
    drawWaveBent(bins,w,h,baseY,startX,widthPx,amp);
    ctx.restore();
    return;
  }
  const grad = buildWaveGradient(startX, widthPx, ctx);
  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;
  ctx.lineWidth = state.waveSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // colour radiates outward as a soft glow instead of a flat, hard edge
  ctx.shadowColor = state.waveColor;
  ctx.shadowBlur = state.waveSize * 3.4;

  imzWaveDrawStyle(state.waveStyle,bins,w,h,baseY,startX,widthPx,amp);

  ctx.restore();
}

// ---- 2026-09-18j: hiệu ứng "Uốn cong" (waveStyle='bend') — đã tái cấu trúc
// 2026-09-18n dùng hàm thuần imzBend* (định nghĩa ở đầu file). Vẫn render kiểu
// nền vào canvas tạm (cùng kích thước khung), rồi ghép các lát dọc lên canvas
// chính dọc theo cung. arcLen = widthPx đảm bảo, neo 3 kiểu (start/center/end),
// hướng vồng 2 kiểu (up/down), hơi thở theo nhạc, xoay chậm khi đóng vòng.
let imzBendCv = null, imzBendCvw = 0, imzBendCvh = 0;
function imzBendCanvas(w,h){
  if(!imzBendCv || imzBendCvw!==w || imzBendCvh!==h){
    imzBendCv = document.createElement('canvas');
    imzBendCv.width = w; imzBendCv.height = h;
    imzBendCvw = w; imzBendCvh = h;
  }
  return imzBendCv;
}
function imzBendBaseStyleOf(){
  return (state.waveBendBase && state.waveBendBase!=='off' && state.waveBendBase!=='bend')
    ? state.waveBendBase : 'line';
}
// 2026-09-18n: lấy năng lượng nhịp thật từ bins — tính theo dải bass/treble,
// chuẩn hoá 0..1, làm mượt (attack nhanh / release chậm) để không giật.
let imzBendBeatSmooth = 0;
function imzBendBeatOf(bins){
  if(!bins || !bins.length) return 0;
  const n = bins.length;
  const bn = Math.max(1, Math.floor(n/8));
  const tn = Math.max(1, Math.floor(n/4));
  let s = 0; for(let i=0;i<bn;i++) s += bins[i];
  const bass = s / (bn * 255);
  s = 0; for(let i=n-tn;i<n;i++) s += bins[i];
  const treble = s / (tn * 255);
  const e = Math.min(1, bass*0.7 + treble*0.3);
  if(e > imzBendBeatSmooth) imzBendBeatSmooth = imzBendBeatSmooth*0.82 + e*0.18;
  else                      imzBendBeatSmooth = imzBendBeatSmooth*0.94 + e*0.06;
  return imzBendBeatSmooth;
}
function drawWaveBent(bins,w,h,baseY,startX,widthPx,amp){
  const base = imzBendBaseStyleOf();
  const cRaw = Math.max(0, Math.min(1, state.waveCurve == null ? 0 : +state.waveCurve));
  // 2026-09-18n: nâng ngưỡng fast-path 0.001 → 0.03 — dưới ngưỡng gần như thẳng,
  // vẽ thẳng cho rẻ, tránh sinh canvas tạm + ghép lát cho c rất nhỏ.
  if(cRaw <= 0.03){
    const grad0 = buildWaveGradient(startX, widthPx, ctx);
    ctx.strokeStyle = grad0; ctx.fillStyle = grad0;
    ctx.lineWidth = state.waveSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = state.waveColor; ctx.shadowBlur = state.waveSize * 3.4;
    imzWaveDrawStyle(base,bins,w,h,baseY,startX,widthPx,amp);
    return;
  }
  // 2026-09-18n: hơi thở theo nhạc — beat 0..1 nhân hệ số 0.4 (c_eff = c·(1+0.4·beat)),
  // kẹp ≤ 1. Chỉ bật khi waveOn + c>0.4 (vùng cong thật, tránh dao động ở thẳng).
  const beat = (state.waveOn && cRaw > 0.4) ? imzBendBeatOf(bins) : 0;
  const cEff = imzBendCEff(cRaw, beat, 0.4);
  // 1) vẽ kiểu nền vào canvas tạm (hoán tạm ctx)
  const cv = imzBendCanvas(w,h);
  const bctx = cv.getContext('2d');
  bctx.setTransform(1,0,0,1,0,0);
  bctx.clearRect(0,0,w,h);
  const saved = ctx;
  ctx = bctx;
  try{
    bctx.save();
    const grad = buildWaveGradient(startX, widthPx, bctx);
    bctx.strokeStyle = grad; bctx.fillStyle = grad;
    bctx.lineWidth = state.waveSize; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
    bctx.shadowColor = state.waveColor; bctx.shadowBlur = state.waveSize * 3.4;
    imzWaveDrawStyle(base,bins,w,h,baseY,startX,widthPx,amp);
    bctx.restore();
  } finally {
    ctx = saved;
  }
  // 2) ghép lát dọc theo cung — neo + hướng vồng + hơi thở
  const pad = 36;
  const x0 = startX - pad, x1 = startX + widthPx + pad;
  const segN = imzBendSegCount(widthPx, cEff);
  const segW = (x1 - x0) / segN;
  const anchor = (state.waveBendAnchor === 'center' || state.waveBendAnchor === 'end')
    ? state.waveBendAnchor : 'start';
  const side   = (state.waveBendSide === 'down') ? 'down' : 'up';
  const dir = (state.waveCurveDir === 'rev') ? -1 : 1;
  // 2026-09-18n: alpha<1 → lát vừa khít (không overlap) tránh seam tối; alpha=1
  // vẫn overlap nhẹ 1.5px như cũ để che khe hở do số học dấu phẩy động.
  const alpha = (state.alpha == null ? 0.85 : +state.alpha);
  const sliceW = (alpha < 0.999) ? segW : segW + 1.5;
  const sliceXOffset = (alpha < 0.999) ? 0 : -0.75;
  // 2026-09-18n: xoay chậm khi đã gần đóng vòng (cEff≥0.85) + neo center.
  // Tốc độ 0.06 rad/s (~1 vòng/phút), waveTime đã tăng theo dt ở drawWave.
  const spin = (anchor === 'center' && cEff >= 0.85) ? (waveTime * 0.06) : 0;
  // 2026-09-18n: chất lượng nội suy cao khi ghép lát cung
  const prevQ = ctx.imageSmoothingQuality;
  ctx.imageSmoothingQuality = 'high';
  for(let i=0;i<segN;i++){
    const tg = (i + 0.5) / segN;
    const tScan = dir > 0 ? tg : (1 - tg);
    const p = imzBendArcPoint(tScan, cEff, anchor, side, startX, widthPx, baseY);
    const sx = x0 + i*segW + sliceXOffset;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + spin);
    ctx.drawImage(cv, sx, 0, sliceW, h, -sliceW/2, -baseY, sliceW, h);
    ctx.restore();
  }
  ctx.imageSmoothingQuality = prevQ || 'low';
}

function drawLeaf(cx,cy,r,rot){
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0,-r);
  ctx.quadraticCurveTo(r*0.9, -r*0.2, 0, r);
  ctx.quadraticCurveTo(-r*0.9, -r*0.2, 0, -r);
  ctx.fill();
  ctx.restore();
}

function drawParticles(dt, treblePulse){
  if(state.effect==='none') return;
  particleClock += dt*0.05;
  const color = state.color || defaultColors[state.effect];
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // #bands: hệ số treble (0..1) — treble=0 thì grow=boost=1 → hình ảnh giữ
  // NGUYÊN hệ cũ (nhạc trầm/im lặng không đổi gì); hi-hat mạnh thì hạt nở nhẹ
  // (tối đa +30% cỡ) và sáng nhẹ (tối đa +25%) theo nhịp gõ.
  const grow  = 1 + treblePulse*0.30;
  const boost = 1 + treblePulse*0.25;
  for(const p of particles){
    updateParticle(p, logicW, logicH, dt);
    const sz = (p.mode==='center' ? p.curSize : p.size) * grow;
    // fade in near the very center so particles don't "pop" at full alpha
    const fadeIn = p.mode==='center' ? Math.min(1, p.radius / (p.maxR*0.08)) : 1;
    // random flicker/fade per object — each particle dims & brightens on its own cycle
    const twinkle = 0.5 + 0.5*Math.sin(particleClock*p.twinkleSpeed + p.twinklePhase);
    ctx.globalAlpha = Math.min(1, state.alpha * p.alphaJit * fadeIn * (0.45 + twinkle*0.55) * boost);
    if(state.effect==='snow'){
      drawSnowflake(p.x,p.y,sz*0.6,p.rot);
    } else if(state.effect==='leaves'){
      drawLeaf(p.x,p.y,sz*0.6,p.rot);
    } else if(state.effect==='stars'){
      drawStar(p.x,p.y,sz*0.6,p.rot);
    } else if(state.effect==='rain'){
      let dx,dy;
      if(p.mode==='center'){ dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
      else { const mag = Math.hypot(p.vx,p.vy) || 0.001; dx = p.vx/mag; dy = p.vy/mag; }
      const dirAngle = Math.atan2(dy,dx);
      drawRaindrop(p.x,p.y,sz*0.5,dirAngle);
    } else if(state.effect==='bubbles'){
      drawBubble(p.x,p.y,sz*0.9,p.rot);
    } else if(state.effect==='petals'){
      drawPetal(p.x,p.y,sz*0.7,p.rot);
    } else if(state.effect==='fireflies'){
      drawFirefly(p.x,p.y,sz*0.5,twinkle);
    } else if(state.effect==='hearts'){
      drawHeart(p.x,p.y,sz*0.7,p.rot);
    } else if(state.effect==='bokeh'){
      // đĩa bokeh to & mờ hơn hẳn hạt thường — alpha tổng hạ để không lóa khung
      ctx.globalAlpha *= 0.45;
      drawBokeh(p.x,p.y,sz*2.4);
    } else if(state.effect==='sparks'){
      let dx,dy;
      if(p.mode==='center'){ dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
      else { const mag = Math.hypot(p.vx,p.vy) || 0.001; dx = p.vx/mag; dy = p.vy/mag; }
      drawSpark(p.x,p.y,sz*0.5,Math.atan2(dy,dx), p.x + p.y);
    }
  }
  ctx.restore();
}
