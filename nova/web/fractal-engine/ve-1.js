/* ── Tách từ fractal-engine.js (683 dòng) thành 4 script nạp theo thứ tự
     trong fractal-antarctica-render.html: nen-tang → ve-1 → ve-2 → chuyen.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — trang HTML và script khác không đổi tên. ── */

AR.title = {
  build(st,P){
    const words = (P.headline||'Headline').split(/\s+/).slice(0,6);
    const wrap = el('div',`position:absolute;inset:0;display:grid;place-items:center;background:${P.bg}`);
    const line = el('div','display:flex;gap:22px;flex-wrap:wrap;justify-content:center;max-width:1500px;position:relative');
    const plate = el('div',`position:absolute;inset:-26px -40px;border-radius:18px;background:${P.accent};opacity:0;z-index:0`);
    line.appendChild(plate);
    const ws = words.map((w,i)=>{
      const n = el('div',`position:relative;z-index:1;font-size:118px;font-weight:800;letter-spacing:-3px;color:${P.fg};white-space:nowrap`);
      const bar = el('div',`position:absolute;left:-10px;right:-10px;top:14%;bottom:14%;background:${P.accent};transform-origin:left;transform:scaleX(0);z-index:-1;border-radius:4px`);
      const tx = el('span','position:relative;display:inline-block',w);
      n.append(bar,tx); line.appendChild(n); return {n,bar,tx};
    });
    const sub = el('div',`position:absolute;bottom:250px;left:0;right:0;text-align:center;font-size:30px;
      letter-spacing:7px;text-transform:uppercase;color:${P.fg}99`, P.dek||'');
    wrap.append(line,sub); st.appendChild(wrap);
    return {ws,sub,plate,line};
  },
  update(N,t,P){
    const E=P.ease, v=P.variant;
    N.ws.forEach((w,i)=>{
      const a = P.delay + i*P.stagger, p = E(seg(t*P.dur, a, a+P.aDur));
      w.n.style.opacity = v==='tracking'?p:p;
      if(v==='typewriter'){ w.n.style.opacity=1;
        const chars = Math.round(p*w.tx.textContent.length);
        w.tx.style.clipPath=`inset(0 ${100-100*p}% 0 0)`;
      } else if(v==='mask'){ w.n.style.opacity=1; w.tx.style.clipPath=`inset(0 ${100-100*p}% 0 0)`; }
      else if(v==='tracking'){ w.n.style.letterSpacing = px(lerp(46,-3,p)); w.n.style.transform='none'; }
      else if(v==='pop'){ w.n.style.transform=`scale(${lerp(.72,1,p)})`; }
      else { w.n.style.transform=`translateY(${lerp(P.dist,0,p)}px)`; }
      if(v==='highlight' && i===Math.min(1,N.ws.length-1)){
        const h = E(seg(t*P.dur, a+.42, a+.42+.4)); w.bar.style.transform=`scaleX(${h})`;
        w.n.style.color = h>.5? '#0B0F14' : P.fg;
      }
      if(v==='duotone') w.n.style.color = i%2 ? P.accent : P.fg;
    });
    if(v==='plate'){ const p=E(seg(t*P.dur,0,.5)); N.plate.style.opacity=.16*p; N.plate.style.transform=`scale(${lerp(.9,1,p)})`; }
    N.sub.style.opacity = E(seg(t*P.dur,.5,1.1));
  }
};

AR.lowerThird = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg}`);
    wrap.appendChild(el('div',media(1920,1080,P.bg,3)+';position:absolute;inset:0;opacity:.5'));
    const box = el('div','position:absolute;left:150px;bottom:200px;display:flex;align-items:stretch;gap:0');
    const bar = el('div',`width:12px;background:${P.accent};border-radius:6px 0 0 6px`);
    const body = el('div',`background:rgba(9,13,19,.86);backdrop-filter:blur(6px);padding:26px 54px 26px 34px;border-radius:0 8px 8px 0`);
    const nm = el('div',`font-size:64px;font-weight:700;color:${P.fg};letter-spacing:-1px`, P.headline||'Tên nhân vật');
    const role = el('div',`font-size:30px;letter-spacing:5px;text-transform:uppercase;color:${P.accent};margin-top:8px`, P.dek||'Chức danh · Vai trò');
    body.append(nm,role); box.append(bar,body); wrap.appendChild(box);
    const cover = el('div',`position:absolute;left:150px;bottom:200px;height:160px;background:${P.accent};border-radius:8px`);
    wrap.appendChild(cover);
    st.appendChild(wrap); return {box,cover,nm,role,bar};
  },
  update(N,t,P){
    const E=P.ease, p = E(seg(t*P.dur, P.delay, P.delay+P.aDur));
    N.box.style.transform = `translateX(${lerp(-P.dist-120,0,p)}px)`; N.box.style.opacity = cl01(p*1.4);
    const w = N.box.offsetWidth||760;
    const q = E(seg(t*P.dur, P.delay+.25, P.delay+.25+.45));
    N.cover.style.width = px(w * (q<.5 ? q*2 : (1-q)*2));
    N.cover.style.left = px(150 + (q<.5?0:w*(q-.5)*2));
    N.cover.style.opacity = q>0 && q<1 ? 1 : 0;
    const o = E(seg(t*P.dur,.72,1)); N.box.style.opacity = p*(1-o*.98);
  }
};

AR.wipe = {
  build(st,P){
    const wrap = el('div','position:absolute;inset:0;overflow:hidden');
    const a = el('div', media(1920,1080,P.bg,1)+';position:absolute;inset:0');
    const b = el('div', media(1920,1080,P.bg,4)+';position:absolute;inset:0');
    const cover = el('div',`position:absolute;inset:0;background:${P.accent}`);
    const lbl = el('div',`position:absolute;left:0;right:0;bottom:120px;text-align:center;font-size:34px;
      letter-spacing:8px;text-transform:uppercase;color:${P.fg};text-shadow:0 4px 20px rgba(0,0,0,.6)`,P.headline||'');
    wrap.append(a,b,cover,lbl); st.appendChild(wrap); return {a,b,cover,lbl};
  },
  update(N,t,P){
    const E=P.ease, p=E(cl01(t*1.05));
    const dir = P.variant;
    const set = (n,ins)=>{ n.style.clipPath=`inset(${ins})`; };
    if(dir==='up')      { set(N.b,`${(1-p)*100}% 0 0 0`); N.cover.style.clipPath=`inset(${(1-p)*100}% 0 ${Math.max(0,p*100-6)}% 0)`; }
    else if(dir==='down'){ set(N.b,`0 0 ${(1-p)*100}% 0`); N.cover.style.clipPath=`inset(${Math.max(0,p*100-6)}% 0 ${(1-p)*100}% 0)`; }
    else if(dir==='right'){ set(N.b,`0 0 0 ${(1-p)*100}%`); N.cover.style.clipPath=`inset(0 ${(1-p)*100}% 0 ${Math.max(0,p*100-6)}%)`; }
    else if(dir==='circle'){ const r=p*130; N.b.style.clipPath=`circle(${r}% at 50% 50%)`; N.cover.style.clipPath=`circle(${Math.max(0,r-4)}% at 50% 50%)`; N.cover.style.opacity=p<1?.35:0; }
    else if(dir==='split'){ N.b.style.clipPath=`inset(0 ${50-p*50}% 0 ${50-p*50}%)`; N.cover.style.clipPath=`inset(0 ${50-p*50}% 0 ${50-p*50}%)`; N.cover.style.opacity=.25; }
    else if(dir==='flash'){ N.b.style.clipPath='inset(0)'; N.b.style.opacity = t>.5?1:0; N.cover.style.opacity = Math.max(0,1-Math.abs(t-.5)*9); N.cover.style.background='#fff'; N.cover.style.clipPath='inset(0)'; }
    else if(dir==='blurzoom'){ N.b.style.clipPath='inset(0)'; N.b.style.opacity=E(seg(t,.35,.75));
      const z=1+Math.sin(cl01(t)*Math.PI)*.25, bl=Math.sin(cl01(t)*Math.PI)*14;
      N.a.style.transform=N.b.style.transform=`scale(${z})`; N.a.style.filter=N.b.style.filter=`blur(${bl}px)`; N.cover.style.opacity=0; }
    else if(dir==='stripe'){ let c=''; for(let i=0;i<8;i++){ const q=cl01((p-i*.05)*1.6)*100; c+= `${q}%`; }
      N.b.style.clipPath=`inset(0 ${(1-p)*100}% 0 0)`; N.cover.style.background=stripes(P.accent); N.cover.style.opacity=1-p; N.cover.style.clipPath='inset(0)'; }
    else if(dir==='diagonal'){ N.b.style.clipPath=`polygon(0 0, ${p*180}% 0, ${p*180-80}% 100%, 0 100%)`; N.cover.style.clipPath=`polygon(${p*180-6}% 0, ${p*180}% 0, ${p*180-80}% 100%, ${p*180-86}% 100%)`; }
    else                { set(N.b,`0 ${(1-p)*100}% 0 0`); N.cover.style.clipPath=`inset(0 ${Math.max(0,(1-p)*100-6)}% 0 ${p*100}%)`; }
    N.lbl.style.opacity = cl01(1-Math.abs(t-.5)*2.4);
  }
};

AR.callout = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg}`);
    wrap.appendChild(el('div',media(1920,1080,P.bg,2)+';position:absolute;inset:0;opacity:.6'));
    const ring = el('div',`position:absolute;left:640px;top:380px;width:300px;height:300px;border-radius:50%;
      border:8px solid ${P.accent};box-sizing:border-box`);
    const ring2 = el('div',`position:absolute;left:640px;top:380px;width:300px;height:300px;border-radius:50%;
      border:4px solid ${P.accent};opacity:.5`);
    const line = el('div',`position:absolute;left:940px;top:530px;height:4px;background:${P.accent};transform-origin:left;width:340px`);
    const tag = el('div',`position:absolute;left:1290px;top:472px;padding:20px 34px;border-radius:12px;
      background:${P.accent};color:#0B0F14;font-size:44px;font-weight:800;white-space:nowrap`, P.headline||'Callout');
    wrap.append(ring2,ring,line,tag); st.appendChild(wrap); return {ring,ring2,line,tag};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    const p = E(seg(T,P.delay,P.delay+P.aDur));
    N.ring.style.transform=`scale(${lerp(.4,1,p)})`; N.ring.style.opacity=p;
    const pulse = (T*1.4)%1; N.ring2.style.transform=`scale(${lerp(1,1.5,pulse)})`; N.ring2.style.opacity=(1-pulse)*.55*p;
    const q = E(seg(T,P.delay+.25,P.delay+.75)); N.line.style.transform=`scaleX(${q})`;
    const r = E(seg(T,P.delay+.5,P.delay+1.05));
    N.tag.style.opacity=r; N.tag.style.transform=`translateX(${lerp(-40,0,r)}px) scale(${lerp(.9,1,r)})`;
  }
};

AR.cta = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center`);
    wrap.appendChild(el('div',media(1920,1080,P.bg,0)+';position:absolute;inset:0;opacity:.45'));
    const pill = el('div',`position:relative;display:flex;align-items:center;gap:26px;padding:30px 56px;border-radius:999px;
      background:${P.accent};box-shadow:0 24px 60px ${P.accent}55`);
    const ico = el('div',`width:66px;height:66px;border-radius:50%;background:rgba(0,0,0,.24);display:grid;place-items:center;
      font-size:34px`,'▲');
    const tx = el('div','font-size:54px;font-weight:800;color:#0B0F14;white-space:nowrap', P.headline||'Subscribe');
    pill.append(ico,tx); wrap.appendChild(pill);
    const halo = el('div',`position:absolute;width:640px;height:180px;border-radius:999px;border:5px solid ${P.accent}`);
    wrap.appendChild(halo);
    st.appendChild(wrap); return {pill,ico,halo};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,P.delay+P.aDur));
    N.pill.style.transform=`translateY(${lerp(P.dist,0,p)}px) scale(${lerp(.85,1,p)})`; N.pill.style.opacity=p;
    const b = Math.sin(T*4)*.03+1; if(p>=1) N.pill.style.transform=`scale(${b})`;
    const h=(T*.9)%1; N.halo.style.transform=`scale(${lerp(1,1.6,h)})`; N.halo.style.opacity=(1-h)*.5*p;
    N.ico.style.transform=`rotate(${Math.sin(T*6)*12}deg)`;
  }
};

AR.logo = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center;overflow:hidden`);
    const stripe = el('div',`position:absolute;inset:0;background:${stripes(P.accent)};opacity:0`);
    const mark = el('div',`position:relative;width:210px;height:210px;border-radius:26px;
      background:linear-gradient(140deg,${P.accent},${P.accent}77);display:grid;place-items:center`);
    mark.appendChild(el('div',`width:78px;height:78px;border-radius:8px;background:${P.bg}`));
    const col = el('div','display:grid;justify-items:center;gap:34px;position:relative');
    const word = el('div',`font-size:96px;font-weight:800;letter-spacing:-2px;color:${P.fg};overflow:hidden`, P.headline||'BRAND');
    const rule = el('div',`height:5px;width:0;background:${P.accent};border-radius:3px`);
    const tag = el('div',`font-size:28px;letter-spacing:9px;text-transform:uppercase;color:${P.fg}99`, P.dek||'motion identity');
    col.append(mark,word,rule,tag); wrap.append(stripe,col); st.appendChild(wrap);
    return {mark,word,rule,tag,stripe};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    const a=E(seg(T,P.delay,P.delay+P.aDur));
    N.mark.style.transform=`scale(${lerp(.2,1,a)}) rotate(${lerp(-24,0,a)}deg)`; N.mark.style.opacity=a;
    const b=E(seg(T,P.delay+.3,P.delay+.3+P.aDur));
    N.word.style.clipPath=`inset(0 ${100-100*b}% 0 0)`; N.word.style.opacity=b>0?1:0;
    N.rule.style.width=px(E(seg(T,P.delay+.55,P.delay+1.05))*420);
    N.tag.style.opacity=E(seg(T,P.delay+.8,P.delay+1.3));
    N.stripe.style.opacity=.12*E(seg(T,.2,1.2));
    N.stripe.style.transform=`translateX(${(T*40)%80}px)`;
  }
};

AR.counter = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center;gap:0`);
    const col = el('div','display:grid;justify-items:center;gap:22px');
    const num = el('div',`font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:230px;
      font-weight:800;color:${P.fg};letter-spacing:-8px;line-height:1`,'0');
    const lbl = el('div',`font-size:32px;letter-spacing:10px;text-transform:uppercase;color:${P.accent}`, P.headline||'Counter');
    const track = el('div',`width:760px;height:10px;border-radius:6px;background:${P.fg}1f;overflow:hidden`);
    const fill = el('div',`height:100%;width:0;background:${P.accent};border-radius:6px`);
    track.appendChild(fill); col.append(num,lbl,track); wrap.appendChild(col); st.appendChild(wrap);
    return {num,lbl,fill,col};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,Math.max(P.delay+.4,P.dur*.75)));
    N.num.textContent = Math.round(p*(P.variant==='pct'?100:1247)).toLocaleString('en-US');
    N.fill.style.width = (p*100)+'%';
    const i = E(seg(T,0,P.aDur)); N.col.style.transform=`scale(${lerp(.94,1,i)})`; N.col.style.opacity=i;
  }
};

AR.hud = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};overflow:hidden`);
    wrap.appendChild(el('div',`position:absolute;inset:0;opacity:.35;
      background-image:linear-gradient(${P.accent}33 1px,transparent 1px),linear-gradient(90deg,${P.accent}33 1px,transparent 1px);
      background-size:80px 80px`));
    const ret = el('div',`position:absolute;left:760px;top:340px;width:400px;height:400px;border:3px solid ${P.accent}`);
    ['0 0 auto auto','0 auto auto 0','auto 0 0 auto','auto auto 0 0'].forEach(pos=>{
      const [t,r,b,l]=pos.split(' ');
      ret.appendChild(el('div',`position:absolute;top:${t};right:${r};bottom:${b};left:${l};width:56px;height:56px;
        border:6px solid ${P.fg};border-radius:2px;margin:-14px`));
    });
    const scan = el('div',`position:absolute;left:0;right:0;height:4px;background:linear-gradient(90deg,transparent,${P.accent},transparent)`);
    const bars = el('div','position:absolute;left:150px;bottom:180px;display:flex;align-items:flex-end;gap:14px;height:180px');
    const bs=[]; for(let i=0;i<9;i++){ const b=el('div',`width:26px;background:${P.accent};border-radius:3px;height:10px`); bars.appendChild(b); bs.push(b); }
    const rd = el('div',`position:absolute;right:150px;top:170px;font-family:ui-monospace,monospace;font-size:30px;
      color:${P.accent};text-align:right;line-height:1.7;font-variant-numeric:tabular-nums`);
    wrap.append(ret,scan,bars,rd); st.appendChild(wrap); return {ret,scan,bs,rd};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,P.delay+P.aDur));
    N.ret.style.transform=`scale(${lerp(1.25,1,p)}) rotate(${lerp(6,0,p)}deg)`; N.ret.style.opacity=p;
    N.scan.style.top = px(((T*.5)%1)*1080); N.scan.style.opacity=.85*p;
    N.bs.forEach((b,i)=>{ b.style.height = px(20+Math.abs(Math.sin(T*3+i*.7))*150*p); });
    N.rd.innerHTML = `SIG ${(p*99.4).toFixed(1)}%<br>FRM ${String(Math.round(t*P.dur*30)).padStart(3,'0')}<br>LOCK ${p>.9?'OK':'…'}`;
    N.rd.style.opacity=p;
  }
};
