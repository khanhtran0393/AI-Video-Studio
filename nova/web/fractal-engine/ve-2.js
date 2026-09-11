/* ── Tách từ fractal-engine.js (683 dòng) thành 4 script nạp theo thứ tự
     trong fractal-antarctica-render.html: nen-tang → ve-1 → ve-2 → chuyen.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — trang HTML và script khác không đổi tên. ── */

AR.shape = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1920 1080'); svg.style.cssText='position:absolute;inset:0;width:100%;height:100%';
    const mk=(t,a)=>{ const n=document.createElementNS('http://www.w3.org/2000/svg',t); for(const k in a)n.setAttribute(k,a[k]); return n; };
    const line = mk('path',{d:'M360 700 L960 380 L1560 700', fill:'none', stroke:P.accent, 'stroke-width':14, 'stroke-linecap':'round'});
    const circ = mk('circle',{cx:960, cy:540, r:230, fill:'none', stroke:P.fg, 'stroke-width':8, opacity:.4});
    svg.append(circ,line); wrap.appendChild(svg);
    const dots = el('div','position:absolute;bottom:200px;left:0;right:0;display:flex;justify-content:center;gap:34px');
    const ds=[]; for(let i=0;i<7;i++){ const d=el('div',`width:34px;height:34px;border-radius:50%;background:${P.accent}`); dots.appendChild(d); ds.push(d); }
    wrap.appendChild(dots); st.appendChild(wrap);
    const L = line.getTotalLength ? line.getTotalLength() : 1400;
    line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
    return {line,circ,ds,L};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,P.delay+.9));
    N.line.style.strokeDashoffset = N.L*(1-p);
    N.circ.setAttribute('r', lerp(60,230,E(seg(T,P.delay+.1,P.delay+.8))));
    N.circ.style.opacity = .45*E(seg(T,P.delay,P.delay+.5));
    N.ds.forEach((d,i)=>{ const a=P.delay+.4+i*P.stagger, q=E(seg(T,a,a+.4));
      d.style.transform=`scale(${lerp(0,1,q)})`; d.style.opacity=q; });
  }
};

AR.list = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;align-content:center;padding:0 220px;gap:34px`);
    const h = el('div',`font-size:64px;font-weight:800;color:${P.fg};margin-bottom:14px`, P.headline||'Key points');
    wrap.appendChild(h);
    const rows = ['Điểm nội dung thứ nhất','Điểm nội dung thứ hai','Điểm nội dung thứ ba','Điểm nội dung thứ tư'].map((tx,i)=>{
      const r = el('div','display:flex;align-items:center;gap:30px');
      const b = el('div',`width:56px;height:56px;border-radius:14px;background:${P.accent};color:#0B0F14;
        display:grid;place-items:center;font-size:30px;font-weight:800;flex:0 0 auto`, String(i+1));
      const s = el('div',`font-size:48px;color:${P.fg}dd`, tx);
      r.append(b,s); wrap.appendChild(r); return r;
    });
    st.appendChild(wrap); return {rows,h};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    N.h.style.opacity=E(seg(T,P.delay,P.delay+P.aDur));
    N.h.style.transform=`translateY(${lerp(P.dist*.5,0,E(seg(T,P.delay,P.delay+P.aDur)))}px)`;
    N.rows.forEach((r,i)=>{ const a=P.delay+.22+i*Math.max(P.stagger,.08), p=E(seg(T,a,a+P.aDur));
      r.style.opacity=p; r.style.transform=`translateX(${lerp(P.dist,0,p)}px)`; });
  }
};

AR.frame = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center;overflow:hidden`);
    wrap.appendChild(el('div',media(1920,1080,P.bg,4)+';position:absolute;inset:-40px;filter:blur(46px) saturate(.7);opacity:.55'));
    const fr = el('div',`position:relative;border-radius:14px;overflow:hidden;border:14px solid ${P.fg};
      box-shadow:0 40px 90px rgba(0,0,0,.6)`);
    fr.appendChild(el('div', media(1160,652,P.bg,1)));
    const cap = el('div',`position:absolute;bottom:150px;left:0;right:0;text-align:center;font-size:38px;
      letter-spacing:6px;text-transform:uppercase;color:${P.fg}`, P.headline||'');
    const cover = el('div',`position:absolute;inset:0;background:${P.accent}`);
    fr.appendChild(cover);
    wrap.append(fr,cap); st.appendChild(wrap); return {fr,cap,cover};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,P.delay+P.aDur));
    N.fr.style.transform=`scale(${lerp(.86,1,p)}) rotate(${lerp(-3,0,p)}deg)`; N.fr.style.opacity=p;
    const q=E(seg(T,P.delay+.25,P.delay+.85)); N.cover.style.transform=`translateX(${q*100}%)`;
    N.cap.style.opacity=E(seg(T,P.delay+.55,P.delay+1.1));
  }
};

AR.background = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};overflow:hidden`);
    const g = el('div',`position:absolute;inset:-10%;background:radial-gradient(60% 60% at 40% 35%,${P.accent}55,transparent 70%),
      radial-gradient(50% 50% at 75% 75%,${P.accent}33,transparent 68%)`);
    const grid = el('div',`position:absolute;inset:0;opacity:.14;background-image:
      linear-gradient(${P.fg}44 1px,transparent 1px),linear-gradient(90deg,${P.fg}44 1px,transparent 1px);background-size:96px 96px`);
    const vig = el('div','position:absolute;inset:0;background:radial-gradient(70% 70% at 50% 50%,transparent 40%,rgba(0,0,0,.72))');
    const dots = el('div','position:absolute;inset:0');
    const ds=[]; for(let i=0;i<38;i++){ const d=el('div',`position:absolute;width:${6+i%5*3}px;height:${6+i%5*3}px;border-radius:50%;
      background:${P.fg};left:${(i*97)%1900}px;top:${(i*211)%1050}px;opacity:.3`); dots.appendChild(d); ds.push(d); }
    const tx = el('div',`position:absolute;inset:0;display:grid;place-items:center;font-size:82px;font-weight:800;color:${P.fg}`, P.headline||'');
    wrap.append(g,grid,dots,vig,tx); st.appendChild(wrap); return {g,grid,ds,tx,vig};
  },
  update(N,t,P){
    const T=t*P.dur;
    N.g.style.transform=`translate(${Math.sin(T*.5)*70}px,${Math.cos(T*.4)*46}px) scale(${1+Math.sin(T*.6)*.06})`;
    N.grid.style.transform=`translateX(${(T*16)%96}px)`;
    N.ds.forEach((d,i)=>{ d.style.opacity=.14+Math.abs(Math.sin(T*1.3+i))*.4;
      d.style.transform=`translateY(${Math.sin(T*.7+i*.5)*22}px)`; });
    N.tx.style.opacity=P.ease(seg(T,.2,1));
  }
};

AR.avatar = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};overflow:hidden`);
    wrap.appendChild(el('div',`position:absolute;inset:0;opacity:.2;background-image:
      linear-gradient(${P.accent}44 1px,transparent 1px),linear-gradient(90deg,${P.accent}44 1px,transparent 1px);background-size:110px 110px`));
    const card = el('div',`position:absolute;left:170px;top:250px;width:820px;height:580px;border-radius:26px;overflow:hidden;
      box-shadow:0 40px 90px rgba(0,0,0,.55)`);
    card.appendChild(el('div', media(820,580,P.bg,1)+';position:absolute;inset:0'));
    card.appendChild(el('div',`position:absolute;inset:0;background:${stripes(P.accent)};opacity:.5`));
    const av = el('div','position:absolute;left:1120px;bottom:0;width:520px;height:760px;transform-origin:50% 100%');
    av.appendChild(el('div',`position:absolute;left:50%;bottom:470px;transform:translateX(-50%);width:250px;height:250px;
      border-radius:60px;background:linear-gradient(150deg,${P.accent},${P.accent}88)`));
    av.appendChild(el('div',`position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:430px;height:500px;
      border-radius:120px 120px 0 0;background:linear-gradient(180deg,${P.fg}ee,${P.fg}66)`));
    const head = el('div',`position:absolute;left:170px;top:120px;font-size:74px;font-weight:800;color:${P.fg};max-width:900px`, P.headline||'Headline');
    wrap.append(card,av,head); st.appendChild(wrap); return {card,av,head};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    const a=E(seg(T,P.delay,P.delay+P.aDur+.2));
    N.av.style.transform=`translateY(${lerp(760,0,a)}px) rotate(${Math.sin(T*1.6)*2.4}deg)`;
    const b=E(seg(T,P.delay+.15,P.delay+.15+P.aDur));
    N.card.style.transform=`translateX(${lerp(-P.dist-200,0,b)}px) rotate(${lerp(-4,0,b)}deg)`; N.card.style.opacity=b;
    const c=E(seg(T,P.delay+.5,P.delay+1.1));
    N.head.style.opacity=c; N.head.style.transform=`translateY(${lerp(40,0,c)}px)`;
  }
};

AR.browser = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center;perspective:1800px`);
    wrap.appendChild(el('div',`position:absolute;inset:0;background:radial-gradient(50% 50% at 50% 45%,${P.accent}33,transparent 68%)`));
    const win = el('div',`position:relative;width:1280px;border-radius:16px;overflow:hidden;background:#151B24;
      box-shadow:0 50px 120px rgba(0,0,0,.65);border:1px solid ${P.fg}22`);
    const bar = el('div','display:flex;align-items:center;gap:14px;padding:20px 26px;background:#1D2531');
    ['#FB7185','#F5A524','#3ECF8E'].forEach(c=>bar.appendChild(el('div',`width:22px;height:22px;border-radius:50%;background:${c}`)));
    bar.appendChild(el('div',`flex:1;height:38px;border-radius:19px;background:#0F141C;margin-left:16px;
      display:flex;align-items:center;padding:0 20px;font-family:ui-monospace,monospace;font-size:20px;color:${P.fg}88`, 'https://example.com'));
    win.appendChild(bar);
    win.appendChild(el('div', media(1280,700,P.bg,0)));
    wrap.appendChild(win); st.appendChild(wrap); return {win};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,P.delay+P.aDur+.5));
    const drift = Math.sin(T*.6)*3;
    N.win.style.transform = `scale(${lerp(.28,1,p)}) rotateY(${lerp(34,drift,p)}deg) rotateX(${lerp(-12,1.5,p)}deg)`;
    N.win.style.opacity = cl01(p*1.6);
  }
};

AR.search = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center`);
    const col = el('div','display:grid;justify-items:center;gap:44px');
    const brand = el('div',`font-size:96px;font-weight:800;color:${P.fg};letter-spacing:-3px`, P.headline||'Tìm kiếm');
    const pill = el('div',`display:flex;align-items:center;gap:24px;width:0;overflow:hidden;height:104px;
      border-radius:52px;background:${P.fg}12;border:2px solid ${P.fg}2a;padding:0 34px`);
    const ico = el('div',`width:40px;height:40px;border-radius:50%;border:5px solid ${P.accent};flex:0 0 auto`);
    const q = el('div',`font-size:40px;color:${P.fg};white-space:nowrap;font-family:ui-monospace,monospace`,'');
    pill.append(ico,q);
    const cursor = el('div',`position:absolute;width:36px;height:36px;border-radius:50%;border:3px solid ${P.fg};opacity:0`);
    col.append(brand,pill); wrap.append(col,cursor); st.appendChild(wrap);
    return {brand,pill,q,cursor,col};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    const a=E(seg(T,P.delay,P.delay+P.aDur)); N.brand.style.opacity=a; N.brand.style.transform=`scale(${lerp(.9,1,a)})`;
    const b=E(seg(T,P.delay+.25,P.delay+.95)); N.pill.style.width=px(lerp(120,980,b));
    const txt = (P.dek||'preset motion graphics'), c=seg(T,P.delay+.8,P.delay+2.1);
    N.q.textContent = txt.slice(0,Math.round(c*txt.length)) + (c<1 && Math.floor(T*4)%2 ? '▌':'');
    const d=seg(T,P.delay+2.2,P.delay+2.8); N.cursor.style.opacity=d>0?1:0;
    N.cursor.style.transform=`translate(${lerp(400,60,d)}px,${lerp(340,180,d)}px) scale(${d>.9?.8:1})`;
    N.col.style.transform=`scale(${lerp(1,1.08,E(seg(T,P.delay+1.6,P.dur)))})`;
  }
};

AR.chart = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;align-content:center;padding:0 200px;gap:56px`);
    const h = el('div',`font-size:60px;font-weight:800;color:${P.fg}`, P.headline||'Số liệu');
    const row = el('div','display:flex;align-items:flex-end;gap:40px;height:460px');
    const vals=[.42,.66,.38,.88,.55,.74];
    const bars = vals.map((v,i)=>{
      const c = el('div','flex:1;display:grid;justify-items:center;gap:16px;align-content:end');
      const b = el('div',`width:100%;height:0;border-radius:12px 12px 0 0;background:${i===3?P.accent:P.fg+'33'}`);
      const l = el('div',`font-family:ui-monospace,monospace;font-size:26px;color:${P.fg}99`, 'Q'+(i+1));
      c.append(b,l); row.appendChild(c); return {b,v,l};
    });
    wrap.append(h,row); st.appendChild(wrap); return {bars,h};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    N.h.style.opacity=E(seg(T,P.delay,P.delay+P.aDur));
    N.bars.forEach((o,i)=>{ const a=P.delay+.15+i*Math.max(P.stagger,.06), p=E(seg(T,a,a+P.aDur+.15));
      o.b.style.height = px(p*o.v*420); o.l.style.opacity=p; });
  }
};

AR.nodePath = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg}`);
    wrap.appendChild(el('div',`position:absolute;inset:0;opacity:.16;background-image:
      linear-gradient(${P.accent}55 1px,transparent 1px),linear-gradient(90deg,${P.accent}55 1px,transparent 1px);background-size:120px 120px`));
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1920 1080'); svg.style.cssText='position:absolute;inset:0;width:100%;height:100%';
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d','M300 780 L640 780 L640 540 L1000 540 L1000 320 L1620 320');
    p.setAttribute('fill','none'); p.setAttribute('stroke',P.fg); p.setAttribute('stroke-width','8');
    p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round');
    svg.appendChild(p); wrap.appendChild(svg);
    const pts=[[300,780],[640,540],[1000,320],[1620,320]];
    const nodes = pts.map((c,i)=>{
      const n = el('div',`position:absolute;left:${c[0]-46}px;top:${c[1]-46}px;width:92px;height:92px;border-radius:50%;
        background:${P.accent};color:#0B0F14;display:grid;place-items:center;font-size:38px;font-weight:800`, String(i+1));
      const l = el('div',`position:absolute;left:${c[0]-140}px;top:${c[1]+62}px;width:280px;text-align:center;
        font-size:30px;letter-spacing:3px;text-transform:uppercase;color:${P.fg}cc`, ['Bắt đầu','Xử lý','Kiểm tra','Kết quả'][i]);
      wrap.append(n,l); return {n,l};
    });
    st.appendChild(wrap);
    const L = p.getTotalLength?p.getTotalLength():2000; p.style.strokeDasharray=L; p.style.strokeDashoffset=L;
    return {path:p,L,nodes};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, p=E(seg(T,P.delay,Math.max(P.delay+.6,P.dur*.7)));
    N.path.style.strokeDashoffset = N.L*(1-p);
    N.nodes.forEach((o,i)=>{ const a=P.delay+i*.22, q=E(seg(T,a,a+P.aDur));
      o.n.style.transform=`scale(${lerp(0,1,q)})`; o.n.style.opacity=q; o.l.style.opacity=E(seg(T,a+.15,a+.6)); });
  }
};

AR.cards = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center;overflow:hidden`);
    const row = el('div','display:flex;gap:34px;align-items:center');
    const cs=[0,1,2,3,4].map(i=>{
      const c = el('div',`position:relative;width:300px;height:420px;border-radius:20px;overflow:hidden;
        box-shadow:0 30px 70px rgba(0,0,0,.5)`);
      c.appendChild(el('div', media(300,420,P.bg,i)+';position:absolute;inset:0'));
      if(i===2) c.appendChild(el('div',`position:absolute;inset:0;background:${stripes(P.accent)};opacity:.7`));
      row.appendChild(c); return c;
    });
    const cap = el('div',`position:absolute;bottom:120px;left:0;right:0;text-align:center;font-size:52px;
      font-weight:800;color:${P.fg}`, P.headline||'');
    wrap.append(row,cap); st.appendChild(wrap); return {cs,row,cap};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    N.cs.forEach((c,i)=>{ const a=P.delay+i*Math.max(P.stagger,.06), p=E(seg(T,a,a+P.aDur));
      const hero = i===2 ? 1+ E(seg(T,.3,P.dur*.6))*.22 : 1;
      c.style.transform=`translateY(${lerp(P.dist+60,0,p)}px) scale(${lerp(.86,hero,p)})`; c.style.opacity=p; });
    N.row.style.transform=`translateX(${lerp(160,0,E(seg(T,0,P.dur*.8)))}px)`;
    N.cap.style.opacity=E(seg(T,P.dur*.45,P.dur*.85));
  }
};

AR.newspaper = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:#EFEAE0;overflow:hidden`);
    const plate = el('div',`position:absolute;inset:-8%;opacity:.9;
      background:repeating-linear-gradient(0deg,#0B0F1418 0 3px,transparent 3px 13px),
                 repeating-linear-gradient(90deg,#0B0F140f 0 2px,transparent 2px 260px)`);
    const chip = el('div',`position:absolute;left:190px;top:220px;padding:12px 26px;border-radius:6px;
      background:${P.accent};color:#0B0F14;font-size:26px;font-weight:800;letter-spacing:4px;text-transform:uppercase`, 'Nguồn');
    const head = el('div',`position:absolute;left:190px;top:300px;width:1500px;font-size:104px;line-height:1.06;
      font-weight:800;color:#0B0F14;letter-spacing:-3px`, P.headline||'Tiêu đề bài viết');
    const mark = el('div',`position:absolute;left:180px;top:430px;height:96px;width:0;background:${P.accent};opacity:.55;mix-blend-mode:multiply`);
    const rule = el('div','position:absolute;left:190px;top:640px;width:0;height:6px;background:#0B0F14');
    const dek = el('div',`position:absolute;left:190px;top:700px;width:1200px;font-size:34px;color:#0B0F14aa;line-height:1.55`, P.dek||'Dòng mô tả ngắn dưới tiêu đề.');
    wrap.append(plate,chip,head,mark,rule,dek); st.appendChild(wrap);
    return {plate,chip,head,mark,rule,dek};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur;
    N.plate.style.transform=`translate(${-(T*26)%260}px,${Math.sin(T*.5)*16}px)`;
    const a=E(seg(T,P.delay,P.delay+P.aDur)); N.chip.style.opacity=a; N.chip.style.transform=`translateX(${lerp(-60,0,a)}px)`;
    const b=E(seg(T,P.delay+.15,P.delay+.15+P.aDur)); N.head.style.opacity=b; N.head.style.transform=`translateY(${lerp(30,0,b)}px)`;
    N.rule.style.width=px(E(seg(T,P.delay+.5,P.delay+1))*1500);
    N.dek.style.opacity=E(seg(T,P.delay+.7,P.delay+1.2));
    N.mark.style.width=px(E(seg(T,P.dur*.55,P.dur*.9))*880);
  }
};

AR.highlight = {
  build(st,P){ return AR.title.build(st,{...P, variant:'highlight'}); },
  update(N,t,P){ return AR.title.update(N,t,{...P, variant:'highlight'}); }
};
AR.outro = {
  build(st,P){
    const wrap = el('div',`position:absolute;inset:0;background:${P.bg};display:grid;place-items:center`);
    const col = el('div','display:grid;justify-items:center;gap:36px');
    const h = el('div',`font-size:92px;font-weight:800;color:${P.fg};text-align:center;max-width:1400px`, P.headline||'Cảm ơn đã xem');
    const r = el('div',`width:0;height:6px;border-radius:3px;background:${P.accent}`);
    const s = el('div',`font-size:32px;letter-spacing:8px;text-transform:uppercase;color:${P.fg}88`, P.dek||'subscribe · follow');
    col.append(h,r,s); wrap.appendChild(col); st.appendChild(wrap); return {h,r,s};
  },
  update(N,t,P){
    const E=P.ease, T=t*P.dur, a=E(seg(T,P.delay,P.delay+P.aDur));
    N.h.style.opacity=a; N.h.style.transform=`translateY(${lerp(P.dist*.6,0,a)}px)`;
    N.r.style.width=px(E(seg(T,P.delay+.3,P.delay+.9))*480);
    N.s.style.opacity=E(seg(T,P.delay+.55,P.delay+1.1));
  }
};


// ── AR.thumbnailText (P4.6, mục 17 roadmap): thumbnail chữ viền (outlined text)
//    — renderer khung 1 cảnh, chữ đậm viền dày + từ nhấn nền accent, scale-in nhẹ.
//    Không file mới ngoài fractal-engine (đúng phạm vi roadmap). ──
AR.thumbnailText = {
  build(st,P){
    const bg = P.bg || '#0b1220', fg = P.fg || '#ffffff', accent = P.accent || '#ffcc00';
    const stroke = P.stroke || '#000000', strokeW = P.strokeW || 10;
    const wrap = el('div',`position:absolute;inset:0;display:grid;place-items:center;background:${bg};overflow:hidden`);
    const box = el('div','display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 6%;text-align:center');
    const hl = String(P.highlight || P.dek || '').toLowerCase();
    const words = String(P.text || P.headline || 'THUMBNAIL').split(/\s+/).slice(0, 8);
    const line = el('div','display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:baseline');
    const ws = words.map((w)=>{
      const isHl = hl && w.toLowerCase().replace(/[^a-zà-ỹ0-9]/gi,'').includes(hl);
      const n = el('div',`font-size:${P.fontSize||150}px;font-weight:900;letter-spacing:-3px;line-height:1.02;white-space:nowrap;`
        + `color:${isHl ? accent : fg};-webkit-text-stroke:${strokeW}px ${stroke};paint-order:stroke fill;`
        + `text-shadow:0 ${strokeW}px 0 ${stroke}`);
      n.textContent = w; line.appendChild(n); return n;
    });
    const sub = P.sub ? el('div',`font-size:${P.subSize||44}px;font-weight:700;letter-spacing:2px;color:${fg}cc;text-transform:uppercase`) : null;
    if (sub) sub.textContent = P.sub;
    box.append(line); if (sub) box.appendChild(sub); wrap.appendChild(box); st.appendChild(wrap);
    return { wrap, ws, sub, line };
  },
  update(N,t,P){
    const E = P.ease, v = E(seg(t*P.dur, P.delay, P.delay + 0.45));
    N.wrap.style.opacity = v;
    N.wrap.style.transform = `scale(${0.86 + 0.14*v})`;
    N.ws.forEach((w,i)=>{
      const p = E(seg(t*P.dur, P.delay + 0.08 + i*P.stagger, P.delay + 0.5 + i*P.stagger));
      w.style.opacity = p; w.style.transform = `translateY(${(1-p)*26}px)`;
    });
    if (N.sub) N.sub.style.opacity = E(seg(t*P.dur, P.delay+0.5, P.delay+1.0));
  }
};

