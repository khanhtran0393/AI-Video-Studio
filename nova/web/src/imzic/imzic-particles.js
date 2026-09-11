'use strict';

/* imzic-particles.js — hạt hiệu ứng (snow/leaves/stars/rain) + draw primitives.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- particles ----
let particles = [];
let particleClock = 0;
function rand(a,b){ return a + Math.random()*(b-a); }

function spawnParticle(w,h, initial){
  const dir = state.direction;

  if(dir==='center'){
    const maxR = Math.hypot(w,h)/2 * 1.05;
    return {
      mode:'center',
      cx: w/2, cy: h/2,
      angle: rand(0,Math.PI*2),
      radius: initial ? rand(0,maxR) : 0,
      maxR,
      speedFactor: rand(0.5,1.3),
      rot: rand(0,Math.PI*2),
      vrot: rand(-0.02,0.02),
      alphaJit: rand(0.6,1),
      twinklePhase: rand(0,Math.PI*2), twinkleSpeed: rand(0.5,2.2)
    };
  }

  let vx=0, vy=0;
  const base = 0.4 * state.pspeed;
  if(dir==='random'){ vx = rand(-1,1)*base; vy = rand(0.3,1)*base; }
  else if(dir==='left'){ vx = -rand(0.5,1.2)*base; vy = rand(-0.2,0.2)*base; }
  else if(dir==='right'){ vx = rand(0.5,1.2)*base; vy = rand(-0.2,0.2)*base; }
  else if(dir==='down'){ vy = rand(0.6,1.3)*base; vx = rand(-0.2,0.2)*base; }
  else if(dir==='up'){ vy = -rand(0.6,1.3)*base; vx = rand(-0.2,0.2)*base; }

  return {
    mode:'linear',
    x: rand(0,w), y: initial ? rand(0,h) : rand(-40,-5),
    size: rand(state.sizeMin, state.sizeMax),
    vx, vy,
    rot: rand(0,Math.PI*2),
    vrot: rand(-0.02,0.02),
    sway: rand(0,Math.PI*2),
    alphaJit: rand(0.6,1),
    twinklePhase: rand(0,Math.PI*2), twinkleSpeed: rand(0.5,2.2)
  };
}

function rebuildParticles(){
  const w = logicW, h = logicH;
  const n = state.effect === 'none' ? 0 : Math.round(state.density);
  particles = [];
  for(let i=0;i<n;i++) particles.push(spawnParticle(w,h,true));
}

function updateParticle(p, w, h, dt){
  p.rot += p.vrot * dt;

  if(p.mode==='center'){
    p.radius += p.speedFactor * state.pspeed * dt;
    if(p.radius > p.maxR){
      p.radius = 0;
      p.angle = rand(0,Math.PI*2);
      p.speedFactor = rand(0.5,1.3);
    }
    p.x = p.cx + Math.cos(p.angle)*p.radius;
    p.y = p.cy + Math.sin(p.angle)*p.radius;
    // grows from small (center) to large (edge)
    p.curSize = state.sizeMin + (state.sizeMax - state.sizeMin) * Math.min(1, p.radius / p.maxR);
    return;
  }

  p.sway += 0.02 * dt;
  let x = p.x + (p.vx + Math.sin(p.sway)*0.6) * dt;
  let y = p.y + p.vy * dt;
  // wrap
  if(x < -30) x = w+20; if(x > w+30) x = -20;
  if(y < -30) y = h+20; if(y > h+30) y = -20;
  p.x = x; p.y = y;
}

function drawStar(cx,cy,r,rot){
  const spikes=5, step=Math.PI/spikes;
  ctx.beginPath();
  let angle = rot;
  for(let i=0;i<spikes*2;i++){
    const rad = (i%2===0) ? r : r*0.45;
    const px = cx + Math.cos(angle)*rad;
    const py = cy + Math.sin(angle)*rad;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    angle += step;
  }
  ctx.closePath();
  ctx.fill();
}

// proper 6-branch dendrite snowflake instead of a plain dot
function drawSnowflake(cx,cy,r,rot){
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.lineWidth = Math.max(0.6, r*0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a = i*Math.PI/3;
    const x2 = Math.cos(a)*r, y2 = Math.sin(a)*r;
    ctx.moveTo(0,0); ctx.lineTo(x2,y2);
    const bx = Math.cos(a)*r*0.55, by = Math.sin(a)*r*0.55;
    const bl = r*0.32;
    const a1 = a+Math.PI/4, a2 = a-Math.PI/4;
    ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a1)*bl, by+Math.sin(a1)*bl);
    ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a2)*bl, by+Math.sin(a2)*bl);
  }
  ctx.stroke();
  ctx.restore();
}

// teardrop raindrop shape, oriented along its direction of travel
function drawRaindrop(cx,cy,r,dirAngle){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(dirAngle - Math.PI/2);
  ctx.beginPath();
  ctx.moveTo(0,-r*1.6);
  ctx.bezierCurveTo(r*0.85,-r*0.25, r*0.7,r*1.05, 0,r*1.3);
  ctx.bezierCurveTo(-r*0.7,r*1.05, -r*0.85,-r*0.25, 0,-r*1.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
