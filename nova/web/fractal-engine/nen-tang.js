/* ── Tách từ fractal-engine.js (683 dòng) thành 4 script nạp theo thứ tự
     trong fractal-antarctica-render.html: nen-tang → ve-1 → ve-2 → chuyen.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — trang HTML và script khác không đổi tên. ── */

/* ═══ 4. Motion engine ══════════════════════════════════════ */
function bezier(x1,y1,x2,y2){
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx;
  const cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t, dfx=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{ let t=x; for(let i=0;i<6;i++){const e=fx(t)-x, d=dfx(t); if(Math.abs(e)<1e-5)break; if(!d)break; t-=e/d;}
    return ((ay*t+by)*t+cy)*t; };
}
const EASINGS = {
  'linear': t=>t,
  'ease-out': bezier(0,0,.58,1),
  'ease-in-out': bezier(.42,0,.58,1),
  'cubic-bezier(0.22, 1, 0.36, 1)': bezier(.22,1,.36,1),
  'cubic-bezier(0.16, 1, 0.3, 1)': bezier(.16,1,.3,1),
  'cubic-bezier(0.34, 1.56, 0.64, 1)': bezier(.34,1.56,.64,1),
  'cubic-bezier(0.7, 0, 0.84, 0)': bezier(.7,0,.84,0)
};
function easeFn(name){
  if(EASINGS[name]) return EASINGS[name];
  const m = /cubic-bezier\(([^)]+)\)/.exec(name||'');
  if(m){ const n = m[1].split(',').map(Number); if(n.length===4 && n.every(v=>!isNaN(v))) return EASINGS[name]=bezier(...n); }
  return EASINGS['cubic-bezier(0.22, 1, 0.36, 1)'];
}
const cl01 = v => v<0?0:v>1?1:v;
const seg = (t,a,b) => cl01((t-a)/Math.max(1e-6,b-a));
const lerp = (a,b,t) => a+(b-a)*t;
const el = (tag,css,html) => { const n=document.createElement(tag); if(css)n.style.cssText=css; if(html!=null)n.innerHTML=html; return n; };
const px = v => v+'px';

/* --- archetype resolution --- */
function archetype(it){
  const d = it.data, id = d.id, cat = d.category || '';
  if(it.lib==='transition') return 'transitionAB';
  if(it.lib==='remotion'){
    const by = {titles_typography:'title', lower_thirds:'lowerThird', transitions_wipes:'wipe',
      callouts_badges:'callout', social_cta:'cta', logo_brand:'logo', timers_counters:'counter',
      hud_tech:'hud', shapes_lines:'shape', lists_bullets:'list', photo_video_frames:'frame',
      backgrounds_atmosphere:'background'};
    return by[cat] || 'title';
  }
  if(/avatar|presenter/.test(id)) return 'avatar';
  if(/browser/.test(id)) return 'browser';
  if(/search/.test(id)) return 'search';
  if(/chart|pie|pyramid|box-chart|dashboard/.test(id)) return 'chart';
  if(/node-path|milestone|link-line|link-circles|overlap|progress-line|phase-line|story-rail|point-burst/.test(id)) return 'nodePath';
  if(/card-lane|triptych|collage|stack|frame|video-frame|cutout|profile|social-post/.test(id)) return 'cards';
  if(/newspaper|article|classical|opener-card/.test(id)) return 'newspaper';
  if(/highlight/.test(id)) return 'highlight';
  if(/outro/.test(id)) return 'outro';
  if(/opener|logo|aperture|slam|shatter/.test(id)) return 'logo';
  return 'title';
}

/* --- shared bits --- */
function media(w,h,tone,seed){
  const hues=[210,262,28,168,340], hu=hues[seed%hues.length];
  return `background:
    radial-gradient(120% 90% at 22% 18%, hsl(${hu} 62% 46% / .85), transparent 62%),
    radial-gradient(110% 80% at 82% 88%, hsl(${(hu+58)%360} 58% 38% / .8), transparent 58%),
    linear-gradient(150deg,#1a2330,#0d131c);width:${w}px;height:${h}px`;
}
function stripes(c){ return `repeating-linear-gradient(115deg, ${c}22 0 18px, transparent 18px 40px)`; }

/* --- renderers: build(stage,P) -> nodes ; update(nodes,t,P) --- */
const AR = {};