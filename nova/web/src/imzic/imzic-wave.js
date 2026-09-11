'use strict';

/* imzic-wave.js — 16 kiểu sóng nhạc + helper màu (hexToRgba/hexToHsl).
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- audio wave: several smooth, popular visualizer styles ----
let waveTime = 0;

function waveEnergyAt(bins, t){
  const idx = Math.min(bins.length-1, Math.floor(t*(bins.length-1)));
  return analyser ? bins[idx]/255 : 0.15;
}

function hexToRgba(hex, a){
  // #perf: hàm này được gọi HÀNG TRĂM lần mỗi frame (bead/dot/bar của sóng)
  // — cache phần parse hex; chuỗi rgba trả về GIỮ NGUYÊN từng ký tự.
  let norm = hexCache.get(hex);
  if(norm === undefined){
    let h = hex.replace('#','');
    if(h.length===3) h = h.split('').map(c=>c+c).join('');
    norm = parseInt(h.substring(0,2),16) + ',' + parseInt(h.substring(2,4),16) + ',' + parseInt(h.substring(4,6),16);
    hexCache.set(hex, norm);
  }
  return `rgba(${norm},${a})`;
}
const hexCache = new Map();

function hexToHsl(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r=parseInt(hex.substring(0,2),16)/255, g=parseInt(hex.substring(2,4),16)/255, b=parseInt(hex.substring(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=(g-b)/d+(g<b?6:0);
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60;
  }
  return [h, s*100, l*100];
}

// shared, always-on shimmering gradient built from the user's chosen wave
// colour — this is what keeps every wave style looking like a glowing
// ribbon instead of one flat, plain colour
function buildWaveGradient(startX,widthPx){
  const [h,s,l] = hexToHsl(state.waveColor);
  const drift = waveTime*14;
  const grad = ctx.createLinearGradient(startX,0,startX+widthPx,0);
  grad.addColorStop(0,    `hsla(${h-32+drift},${Math.min(100,s+8)}%,${Math.min(80,l+18)}%,0.92)`);
  grad.addColorStop(0.35, `hsla(${h+drift},${s}%,${l}%,1)`);
  grad.addColorStop(0.65, `hsla(${h+26+drift},${s}%,${Math.max(28,l-8)}%,1)`);
  grad.addColorStop(1,    `hsla(${h+50+drift},${Math.min(100,s+8)}%,${Math.min(80,l+18)}%,0.92)`);
  return grad;
}

function roundRectPath(c,x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}

// 1) flowing line — travels side-to-side while riding up/down with the beat
function drawWaveLine(bins,w,h,baseY,startX,widthPx,amp){
  const segments = 72;
  const swayPhase = Math.sin(waveTime*0.55) * 2.2;
  const swayPhase2 = Math.sin(waveTime*0.33 + 1.7) * 1.4;
  ctx.beginPath();
  for(let i=0;i<=segments;i++){
    const t = i/segments;
    const x = startX + t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const y = baseY
      + Math.sin(t*Math.PI*3.2 + swayPhase) * amp * (0.35 + energy*0.85)
      + Math.sin(t*Math.PI*6.1 - swayPhase2) * amp * 0.22 * (0.3+energy);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

// 2) filled ribbon / blob — soft glowing gradient band, very smooth (Siri-style)
function drawWaveRibbon(bins,w,h,baseY,startX,widthPx,amp){
  const segments = 56;
  const swayPhase = Math.sin(waveTime*0.5) * 2;
  const topPts=[], botPts=[];
  for(let i=0;i<=segments;i++){
    const t = i/segments;
    const x = startX + t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const off = Math.abs(Math.sin(t*Math.PI*3 + waveTime + swayPhase)) * amp * (0.4+energy*0.85) + amp*0.12;
    topPts.push({x, y: baseY-off});
    botPts.push({x, y: baseY+off});
  }
  const [h2,s2,l2] = hexToHsl(state.waveColor);
  const drift = waveTime*10;
  const grad = ctx.createLinearGradient(startX,0,startX+widthPx,0);
  grad.addColorStop(0,   `hsla(${h2-30},${s2}%,${l2}%,0.05)`);
  grad.addColorStop(0.3, `hsla(${h2-8+drift},${s2}%,${Math.min(82,l2+12)}%,0.62)`);
  grad.addColorStop(0.6, `hsla(${h2+24+drift},${s2}%,${l2}%,0.62)`);
  grad.addColorStop(1,   `hsla(${h2+45},${s2}%,${l2}%,0.05)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(topPts[0].x, topPts[0].y);
  for(let i=1;i<topPts.length;i++) ctx.lineTo(topPts[i].x, topPts[i].y);
  for(let i=botPts.length-1;i>=0;i--) ctx.lineTo(botPts[i].x, botPts[i].y);
  ctx.closePath();
  ctx.fill();
}

// 3) mirrored equalizer bars — classic, punchy, symmetric around the baseline
function drawWaveBars(bins,w,h,baseY,startX,widthPx,amp){
  const barCount = 38;
  const barW = Math.max(2, state.waveSize*1.6);
  for(let i=0;i<barCount;i++){
    const t = barCount<=1 ? 0 : i/(barCount-1);
    const x = startX + t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const sway = 0.82 + Math.sin(waveTime*0.8 + t*Math.PI*2.4)*0.18;
    const barH = Math.max(2, amp * (0.18 + energy*0.9) * sway);
    ctx.beginPath();
    roundRectPath(ctx, x-barW/2, baseY-barH, barW, barH*2, barW/2);
    ctx.fill();
  }
}

// 4) circular radial pulse — spectrum ring, slowly rotating
function drawWaveCircular(bins,w,h,baseY,startX,widthPx,amp){
  const cx = w/2, cy = baseY;
  const baseR = Math.max(20, widthPx*0.28);
  const spikes = 64;
  ctx.beginPath();
  for(let i=0;i<=spikes;i++){
    const t = i/spikes;
    const angle = t*Math.PI*2 + waveTime*0.3;
    const energy = waveEnergyAt(bins,t);
    const r = baseR + amp*(0.3+energy*0.9);
    const x = cx+Math.cos(angle)*r, y = cy+Math.sin(angle)*r;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.stroke();
}

// 5) dotted wave — bouncing dots tracing the melody line, each one a soft glowing orb
function drawWaveDots(bins,w,h,baseY,startX,widthPx,amp){
  const n = 46;
  for(let i=0;i<n;i++){
    const t = n<=1?0:i/(n-1);
    const x = startX + t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const y = baseY + Math.sin(t*Math.PI*3 + waveTime) * amp * (0.3+energy*0.9);
    const r = Math.max(1.5, state.waveSize*0.6) * (0.55+energy*0.9);
    const g = ctx.createRadialGradient(x,y,0,x,y,r*1.8);
    g.addColorStop(0, hexToRgba(state.waveColor,0.95));
    g.addColorStop(1, hexToRgba(state.waveColor,0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r*1.8,0,Math.PI*2);
    ctx.fill();
  }
}

// 6) gradient rainbow ribbon line — hue travels along the wave over time
function drawWaveRainbow(bins,w,h,baseY,startX,widthPx,amp){
  const segments = 60;
  ctx.lineWidth = state.waveSize;
  for(let i=0;i<segments;i++){
    const t0=i/segments, t1=(i+1)/segments;
    const e0=waveEnergyAt(bins,t0), e1=waveEnergyAt(bins,t1);
    const x0=startX+t0*widthPx, x1=startX+t1*widthPx;
    const y0=baseY+Math.sin(t0*Math.PI*3+waveTime)*amp*(0.35+e0*0.85);
    const y1=baseY+Math.sin(t1*Math.PI*3+waveTime)*amp*(0.35+e1*0.85);
    const hue = (t0*300 + waveTime*40) % 360;
    ctx.strokeStyle = `hsl(${hue},85%,65%)`;
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.stroke();
  }
}

// 7) bottom-anchored equalizer bars — each bar glows brightest at its tip
function drawWaveBottomBars(bins,w,h,baseY,startX,widthPx,amp){
  const barCount = 34, barW = Math.max(2, state.waveSize*1.5);
  for(let i=0;i<barCount;i++){
    const t = barCount<=1?0:i/(barCount-1);
    const x = startX+t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const sway = 0.85 + Math.sin(waveTime*0.8 + t*Math.PI*2.4)*0.15;
    const barH = Math.max(2, amp*(0.2+energy*1.1)*sway);
    const g = ctx.createLinearGradient(0, baseY-barH, 0, baseY);
    g.addColorStop(0, hexToRgba(state.waveColor,1));
    g.addColorStop(1, hexToRgba(state.waveColor,0.1));
    ctx.fillStyle = g;
    ctx.beginPath();
    roundRectPath(ctx, x-barW/2, baseY-barH, barW, barH, barW/2);
    ctx.fill();
  }
}

// 8) bouncing arc / rainbow bridge shape
function drawWaveArc(bins,w,h,baseY,startX,widthPx,amp){
  const segments = 48;
  ctx.beginPath();
  for(let i=0;i<=segments;i++){
    const t = i/segments;
    const angle = Math.PI*(1-t);
    const x = startX + t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const archH = amp*(0.5+energy*0.9);
    const y = baseY - Math.sin(angle)*archH;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

// 9) glowing orb trail
function drawWaveGlow(bins,w,h,baseY,startX,widthPx,amp){
  const n = 24;
  for(let i=0;i<n;i++){
    const t = n<=1?0:i/(n-1);
    const x = startX+t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const y = baseY + Math.sin(t*Math.PI*2.4+waveTime*1.1)*amp*(0.3+energy*0.9);
    const r = Math.max(2, state.waveSize*0.9) * (0.6+energy*1.1);
    const grad = ctx.createRadialGradient(x,y,0,x,y,r*2.2);
    grad.addColorStop(0, hexToRgba(state.waveColor,0.9));
    grad.addColorStop(1, hexToRgba(state.waveColor,0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x,y,r*2.2,0,Math.PI*2);
    ctx.fill();
  }
}

// 10) twin mirrored lines with slight offset (interference look)
function drawWaveTwin(bins,w,h,baseY,startX,widthPx,amp){
  for(const sign of [1,-1]){
    ctx.beginPath();
    for(let i=0;i<=64;i++){
      const t = i/64;
      const x = startX+t*widthPx;
      const energy = waveEnergyAt(bins,t);
      const y = baseY + sign*Math.abs(Math.sin(t*Math.PI*3+waveTime))*amp*(0.3+energy*0.8)*0.65;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
}

// 11) dashed traveling line
function drawWaveDashed(bins,w,h,baseY,startX,widthPx,amp){
  ctx.setLineDash([state.waveSize*1.5, state.waveSize*1.2]);
  ctx.lineDashOffset = -waveTime*40;
  drawWaveLine(bins,w,h,baseY,startX,widthPx,amp);
  ctx.setLineDash([]);
}

// 12) spiral, flattened to fit the frame, rotating slowly
function drawWaveSpiral(bins,w,h,baseY,startX,widthPx,amp){
  const cx = w/2, cy = baseY, turns = 2.2, segments = 140;
  const baseR = Math.max(10, widthPx*0.05);
  ctx.beginPath();
  for(let i=0;i<=segments;i++){
    const t = i/segments;
    const angle = t*Math.PI*2*turns + waveTime*0.6;
    const energy = waveEnergyAt(bins,t);
    const r = baseR + t*widthPx*0.35*(0.5+energy*0.8) + amp*0.2*energy;
    const x = cx+Math.cos(angle)*r, y = cy+Math.sin(angle)*r*0.5;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

// 13) stacked-circle bars ("beaded" bars) — brighter beads near the tip
function drawWaveCircleDots(bins,w,h,baseY,startX,widthPx,amp){
  const barCount = 24, r = Math.max(2, state.waveSize*0.9);
  for(let i=0;i<barCount;i++){
    const t = barCount<=1?0:i/(barCount-1);
    const x = startX+t*widthPx;
    const energy = waveEnergyAt(bins,t);
    const sway = 0.85 + Math.sin(waveTime*0.8+t*Math.PI*2)*0.15;
    const count = Math.max(1, Math.round((amp*(0.2+energy*1.0)*sway)/(r*2.2)));
    for(let k=0;k<count;k++){
      const y = baseY - k*(r*2.2) - r;
      const fade = 1 - (k/Math.max(1,count));
      ctx.fillStyle = hexToRgba(state.waveColor, 0.3+fade*0.7);
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
  }
}

// 14) neon double-stroke glow line
function drawWaveNeon(bins,w,h,baseY,startX,widthPx,amp){
  ctx.save();
  ctx.lineWidth = state.waveSize*2.4;
  ctx.globalAlpha = 0.35;
  ctx.shadowBlur = state.waveSize*4;
  drawWaveLine(bins,w,h,baseY,startX,widthPx,amp);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(1, state.waveSize*0.5);
  ctx.strokeStyle = '#ffffff';
  ctx.shadowBlur = state.waveSize*1.5;
  drawWaveLine(bins,w,h,baseY,startX,widthPx,amp);
  ctx.restore();
}
