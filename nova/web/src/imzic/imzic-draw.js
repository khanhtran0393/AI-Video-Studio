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

// ---- 2026-09-18j: hiệu ứng "Uốn cong" (waveStyle='bend') ----
// Uốn KIỂU SÓNG NỀN (state.waveBendBase) theo mức uốn state.waveCurve:
//   0% = đường thẳng (vẽ kiểu nền trực tiếp), 100% = khép kín thành hình tròn.
// Cách làm tổng quát cho MỌI kiểu sóng: vẽ kiểu nền vào canvas tạm cùng kích
// thước khung (hoán tạm ctx), rồi ghép các lát dọc của canvas tạm lên canvas
// chính dọc theo cung tròn. Công thức cung bảo toàn chiều dài:
//   R = widthPx/(2π·c)            → chiều dài cung = R·2πc = widthPx (khớp c=1)
//   φ(t) = π/2 − 2π·c·t           → điểm đầu (t=0) tại (startX, baseY), tiếp
//                                   tuyến nằm ngang; cung vồng LÊN trên baseline
//   P(t) = (startX, baseY−R) + R·(cosφ, sinφ)
// Tại c→0: R→∞, P(t) → đường thẳng (khai triển Taylor liên tục) — chuyển mượt.
// Export vẫn đi qua drawWave này nên hiệu ứng có mặt trong file xuất (canvas tạm
// dựng ở kích thước LOGIC, ctx chính đang mang transform phóng của export tự áp).
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
  // kiểu nền khai báo rõ: mặc định 'line', không nhận 'off'/'bend' làm nền
  return (state.waveBendBase && state.waveBendBase!=='off' && state.waveBendBase!=='bend')
    ? state.waveBendBase : 'line';
}
function drawWaveBent(bins,w,h,baseY,startX,widthPx,amp){
  const base = imzBendBaseStyleOf();
  const c = Math.max(0, Math.min(1, state.waveCurve == null ? 0 : +state.waveCurve));
  if(c <= 0.001){
    // 0% = đường thẳng — vẽ kiểu nền như bình thường, không tốn canvas tạm
    const grad0 = buildWaveGradient(startX, widthPx, ctx);
    ctx.strokeStyle = grad0; ctx.fillStyle = grad0;
    ctx.lineWidth = state.waveSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = state.waveColor; ctx.shadowBlur = state.waveSize * 3.4;
    imzWaveDrawStyle(base,bins,w,h,baseY,startX,widthPx,amp);
    return;
  }
  // 1) vẽ kiểu nền vào canvas tạm (hoán tạm ctx — thuật toán vẽ đọc ctx toàn cục)
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
    ctx = saved; // trả ctx chính — Luật 10: không nuốt lỗi, lỗi vẽ vẫn ném ra
  }
  // 2) ghép các lát dọc theo cung — dir chỉ đổi THỨ TỰ quét nội dung (như 'curved')
  const pad = 36; // đệm phủ glow/bán độ rộng cột tràn khỏi dải sóng
  const x0 = startX - pad, x1 = startX + widthPx + pad;
  const segN = Math.max(48, Math.min(160, Math.round(widthPx/8)));
  const segW = (x1 - x0) / segN;
  const R = widthPx / (2 * Math.PI * c);
  const cx = startX, cy = baseY - R;
  const dir = (state.waveCurveDir === 'rev') ? -1 : 1;
  for(let i=0;i<segN;i++){
    const tg = (i + 0.5) / segN;
    const tScan = dir > 0 ? tg : (1 - tg);
    const phi = Math.PI/2 - 2*Math.PI*c*tScan;
    const px = cx + Math.cos(phi)*R;
    const py = cy + Math.sin(phi)*R;
    // tiếp tuyến P'(t) ∝ (sinφ, −cosφ) — góc xoay của lát
    const ang = Math.atan2(-Math.cos(phi), Math.sin(phi));
    const sx = x0 + i*segW;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    // lát dày hơn khoảng cách 1.5px để khít mép ghép (che khe hở vòng cung)
    ctx.drawImage(cv, sx, 0, segW + 1.5, h, -segW/2 - 0.75, -baseY, segW + 1.5, h);
    ctx.restore();
  }
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
