// 2026-09-18n: test hàm thuần engine Uốn cong I-MZic.
'use strict';

const E = require('./engine');
const PI = Math.PI;
let pass = 0, fail = 0;
function ok(name, cond, info){
  if(cond){ pass++; console.log('  PASS', name, info||''); }
  else    { fail++; console.log('  FAIL', name, info||''); }
}
function approx(a, b, eps){ return Math.abs(a-b) <= (eps||1e-6); }
function dist(a, b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function arcLen(pts){ let s=0; for(let i=1;i<pts.length;i++) s+=dist(pts[i-1], pts[i]); return s; }
function throws(fn){ try { fn(); return null; } catch(e){ return e.message||String(e); } }

const W = 1200, x0 = 200, y0 = 800;

console.log('== imzBendCEff ==');
ok('c=0 -> 0', E.imzBendCEff(0) === 0);
ok('c=0.5 nguyen', E.imzBendCEff(0.5) === 0.5);
ok('c=0.5 beat=0 kBeat=0.5 -> 0.5', approx(E.imzBendCEff(0.5, 0, 0.5), 0.5));
ok('c=0.5 beat=1 kBeat=0.5 -> 0.75', approx(E.imzBendCEff(0.5, 1, 0.5), 0.75));
ok('c=1 beat=1 kBeat=0.5 -> 1 (clamp)', E.imzBendCEff(1, 1, 0.5) === 1);
ok('c=2 -> 1 (clamp)', E.imzBendCEff(2) === 1);
ok('c=-1 -> 0 (clamp)', E.imzBendCEff(-1) === 0);
ok('c=NaN -> IMZIC_BEND_C', /IMZIC_BEND_C/.test(throws(()=>E.imzBendCEff(NaN))));
ok('beat ngoai khoang -> IMZIC_BEND_C', /IMZIC_BEND_C/.test(throws(()=>E.imzBendCEff(0.5, 1.5, 0.2))));

console.log('== imzBendRadius ==');
ok('R = W/(2*PI*c)', approx(E.imzBendRadius(1200, 0.5), 1200/PI));
ok('W<=0 -> IMZIC_BEND_W', /IMZIC_BEND_W/.test(throws(()=>E.imzBendRadius(0, 0.5))));

console.log('== imzBendArcPoint (start, up) - hanh vi cu ==');
{
  const p0 = E.imzBendArcPoint(0, 1, 'start', 'up', x0, W, y0);
  ok('start P(0)=(x0,y0) tai c=1', approx(p0.x, x0) && approx(p0.y, y0), JSON.stringify(p0));
  const p1 = E.imzBendArcPoint(1, 1, 'start', 'up', x0, W, y0);
  ok('start P(0)=P(1) tai c=1 (khep kin)', dist(p0, p1) < 1e-6, 'gap=' + dist(p0,p1));
  const s0 = E.imzBendArcPoint(0, 1e-6, 'start', 'up', x0, W, y0);
  const s1 = E.imzBendArcPoint(1, 1e-6, 'start', 'up', x0, W, y0);
  ok('start c~0 thang baseline', approx(s0.y, y0, 0.5) && approx(s1.y, y0, 0.5));
  ok('start t=0 tiep tuyen 0 rad', approx(E.imzBendArcPoint(0, 0.5, 'start', 'up', x0, W, y0).angle, 0, 1e-6));
  const pts = []; for(let i=0;i<=200;i++) pts.push(E.imzBendArcPoint(i/200, 0.5, 'start', 'up', x0, W, y0));
  ok('start arcLen ~ widthPx c=0.5', Math.abs(arcLen(pts) - W) < 1, 'len=' + arcLen(pts).toFixed(3));
}

console.log('== imzBendArcPoint (center, up) ==');
{
  const mid = E.imzBendArcPoint(0.5, 1, 'center', 'up', x0, W, y0);
  ok('center P(0.5)=(giua,y0) neo tai c=1', approx(mid.x, x0+W/2) && approx(mid.y, y0), JSON.stringify(mid));
  const p0 = E.imzBendArcPoint(0, 1, 'center', 'up', x0, W, y0);
  const p1 = E.imzBendArcPoint(1, 1, 'center', 'up', x0, W, y0);
  ok('center P(0)=P(1) tai c=1 (2 dau trung)', dist(p0, p1) < 1e-6, 'gap=' + dist(p0,p1));
  ok('center t=0.5 tiep tuyen 0 rad', approx(E.imzBendArcPoint(0.5, 0.5, 'center', 'up', x0, W, y0).angle, 0, 1e-6));
  const a = E.imzBendArcPoint(0.25, 0.5, 'center', 'up', x0, W, y0);
  const b = E.imzBendArcPoint(0.75, 0.5, 'center', 'up', x0, W, y0);
  ok('center doi xung truc tai t=0.5', approx(a.x + b.x, 2*(x0+W/2), 1e-6) && approx(a.y, b.y, 1e-6), '(' + a.x.toFixed(2)+','+a.y.toFixed(2) + ') vs (' + b.x.toFixed(2)+','+b.y.toFixed(2)+')');
  const pts = []; for(let i=0;i<=200;i++) pts.push(E.imzBendArcPoint(i/200, 0.5, 'center', 'up', x0, W, y0));
  ok('center arcLen ~ widthPx c=0.5', Math.abs(arcLen(pts) - W) < 1, 'len=' + arcLen(pts).toFixed(3));
}

console.log('== imzBendArcPoint (end, up) ==');
{
  const p1 = E.imzBendArcPoint(1, 1, 'end', 'up', x0, W, y0);
  ok('end P(1)=(x0+W,y0) tai c=1', approx(p1.x, x0+W) && approx(p1.y, y0), JSON.stringify(p1));
  const p0 = E.imzBendArcPoint(0, 1, 'end', 'up', x0, W, y0);
  ok('end P(0)=P(1) tai c=1', dist(p0, p1) < 1e-6);
}

console.log('== imzBendArcPoint (side=down) - vong xuong ==');
{ const R = E.imzBendRadius(W, 1); const p0 = E.imzBendArcPoint(0, 1, 'start', 'down', x0, W, y0); ok('down start P(0)=(x0,y0) dinh tren', approx(p0.x, x0, 1e-6) && approx(p0.y, y0, 1e-6), JSON.stringify(p0)); const p1 = E.imzBendArcPoint(1, 1, 'start', 'down', x0, W, y0); ok('down start P(1)=(x0,y0) dinh tren (khep kin)', dist(p0, p1) < 1e-6, JSON.stringify(p1)); const pmid = E.imzBendArcPoint(0.5, 1, 'start', 'down', x0, W, y0); ok('down start P(0.5)=(x0,y0+2R) dinh duoi cung', approx(pmid.x, x0, 1e-6) && approx(pmid.y, y0+2*R, 1e-6), JSON.stringify(pmid)); const cmid = E.imzBendArcPoint(0.5, 1, 'center', 'down', x0, W, y0); ok('down center P(0.5)=(x0+W/2,y0) neo giua', approx(cmid.x, x0+W/2, 1e-6) && approx(cmid.y, y0, 1e-6), JSON.stringify(cmid)); const cp0 = E.imzBendArcPoint(0, 1, 'center', 'down', x0, W, y0); const cp1 = E.imzBendArcPoint(1, 1, 'center', 'down', x0, W, y0); ok('down center P(0)=P(1) khep kin dinh duoi (cx,y0+2R)', dist(cp0, cp1) < 1e-6 && approx(cp0.x, x0+W/2, 1e-6) && approx(cp0.y, y0+2*R, 1e-6), JSON.stringify(cp0)); const a = E.imzBendArcPoint(0.25, 0.5, 'center', 'down', x0, W, y0); const b = E.imzBendArcPoint(0.75, 0.5, 'center', 'down', x0, W, y0); ok('down center doi xung truc x0+W/2', approx(a.x + b.x, 2*(x0+W/2), 1e-6) && approx(a.y, b.y, 1e-6)); ok('down start t=0.5 tiep tuyen 0 rad', approx(pmid.angle, 0, 1e-6)); const pts = []; for(let i=0;i<=200;i++) pts.push(E.imzBendArcPoint(i/200, 0.5, 'start', 'down', x0, W, y0)); ok('down arcLen ~ widthPx', Math.abs(arcLen(pts) - W) < 1, 'len=' + arcLen(pts).toFixed(3)); }


console.log('== imzBendArcPoint - rang buoc ==');
ok('t<0 -> IMZIC_BEND_T', /IMZIC_BEND_T/.test(throws(()=>E.imzBendArcPoint(-0.1, 0.5, 'start', 'up', x0, W, y0))));
ok('t>1 -> IMZIC_BEND_T', /IMZIC_BEND_T/.test(throws(()=>E.imzBendArcPoint(1.1, 0.5, 'start', 'up', x0, W, y0))));
ok('anchor sai -> IMZIC_BEND_ANCHOR', /IMZIC_BEND_ANCHOR/.test(throws(()=>E.imzBendArcPoint(0.5, 0.5, 'mid', 'up', x0, W, y0))));
ok('side sai -> IMZIC_BEND_SIDE', /IMZIC_BEND_SIDE/.test(throws(()=>E.imzBendArcPoint(0.5, 0.5, 'start', 'left', x0, W, y0))));

console.log('== imzBendSegCount ==');
ok('c=0 -> base', E.imzBendSegCount(1200, 0) === Math.max(48, Math.min(160, 150)));
ok('c=1 -> base*1.5 (kep 160)', E.imzBendSegCount(1200, 1) === Math.round(150 * 1.5));
ok('c=0.5 -> base*1.25', E.imzBendSegCount(1200, 0.5) === Math.round(150 * 1.25));
ok('W nho -> kep 48', E.imzBendSegCount(100, 0) === 48);
ok('W<=0 -> IMZIC_BEND_W', /IMZIC_BEND_W/.test(throws(()=>E.imzBendSegCount(0, 0.5))));

console.log('== c_eff ap len arc - tich hop ==');
{
  const c0 = E.imzBendCEff(0.5);
  const c1 = E.imzBendCEff(0.5, 1, 0.3);
  ok('c_eff to hon khi beat=1', c1 > c0, 'c0=' + c0 + ' c1=' + c1);
  ok('R giam khi c_eff tang', E.imzBendRadius(W, c1) < E.imzBendRadius(W, c0));
  const c2 = E.imzBendCEff(0.99, 1, 0.5);
  ok('c_eff <= 1 tuyet doi', c2 <= 1, 'c2=' + c2);
}

console.log('');
console.log('TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
