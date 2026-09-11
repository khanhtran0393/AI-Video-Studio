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

function drawWave(dt){
  if(!state.waveOn) return;
  waveTime += dt * 0.045;
  const bins = freqData || new Uint8Array(64);
  const w = logicW, h = logicH;
  const baseY = h * (state.wavePos/100);
  const widthPx = w * (state.waveWidth/100);
  const startX = (w - widthPx)/2;
  const amp = state.waveHeight;

  ctx.save();
  const grad = buildWaveGradient(startX, widthPx);
  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;
  ctx.lineWidth = state.waveSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // colour radiates outward as a soft glow instead of a flat, hard edge
  ctx.shadowColor = state.waveColor;
  ctx.shadowBlur = state.waveSize * 3.4;

  if(state.waveStyle==='ribbon') drawWaveRibbon(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='bars') drawWaveBars(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='circular') drawWaveCircular(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='dots') drawWaveDots(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='rainbow') drawWaveRainbow(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='bottombars') drawWaveBottomBars(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='arc') drawWaveArc(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='glow') drawWaveGlow(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='twin') drawWaveTwin(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='dashed') drawWaveDashed(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='spiral') drawWaveSpiral(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='circledots') drawWaveCircleDots(bins,w,h,baseY,startX,widthPx,amp);
  else if(state.waveStyle==='neon') drawWaveNeon(bins,w,h,baseY,startX,widthPx,amp);
  else drawWaveLine(bins,w,h,baseY,startX,widthPx,amp);

  ctx.restore();
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
    }
  }
  ctx.restore();
}
