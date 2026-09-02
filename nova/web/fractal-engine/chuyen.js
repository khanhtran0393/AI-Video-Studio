/* ── Tách từ fractal-engine.js (683 dòng) thành 4 script nạp theo thứ tự
     trong fractal-antarctica-render.html: nen-tang → ve-1 → ve-2 → chuyen.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — trang HTML và script khác không đổi tên. ── */

/* transitions A→B */
AR.transitionAB = {
  build(st,P){
    const wrap = el('div','position:absolute;inset:0;overflow:hidden;background:#000');
    const mkClip=(seed,label)=>{
      const c = el('div', media(1920,1080,P.bg,seed)+';position:absolute;inset:0;display:grid;place-items:center');
      c.appendChild(el('div',`font-size:200px;font-weight:800;color:#ffffffcc;letter-spacing:-8px`, label));
      return c;
    };
    const a = mkClip(1,'A'), b = mkClip(4,'B');
    const flash = el('div','position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none');
    const gA = el('div','position:absolute;inset:0;overflow:hidden'), gB = el('div','position:absolute;inset:0;overflow:hidden');
    gA.appendChild(a); gB.appendChild(b);
    wrap.append(gA,gB,flash);
    const name = el('div',`position:absolute;left:0;right:0;bottom:70px;text-align:center;font-family:ui-monospace,monospace;
      font-size:30px;letter-spacing:6px;text-transform:uppercase;color:#ffffff88`, P.headline||'');
    wrap.appendChild(name); st.appendChild(wrap);
    return {a,b,gA,gB,flash,name};
  },
  update(N,t,P){
    const id = P.tid||'', E=P.ease;
    // p = transition progress centered in the middle 55% of the clip
    const p = cl01((t-.24)/.52), q = E(p);
    const A=N.gA, B=N.gB, a=N.a, bb=N.b, F=N.flash;
    // reset
    A.style.clipPath=B.style.clipPath='none'; A.style.opacity=1; B.style.opacity=1;
    a.style.transform=bb.style.transform='none'; a.style.filter=bb.style.filter='none';
    a.style.opacity=bb.style.opacity=1; F.style.opacity=0; F.style.background='#fff';
    B.style.zIndex=2; A.style.zIndex=1;
    const bell = Math.sin(cl01(p)*Math.PI);

    if(/-cut$/.test(id))            { B.style.opacity = p>.5?1:0; }
    else if(/-fade$/.test(id))      { B.style.opacity = q; }
    else if(/dip-black|dip-white/.test(id)){
      const white=/white/.test(id); F.style.background = white?'#fff':'#000';
      F.style.opacity = bell; B.style.opacity = p>.5?1:0; }
    else if(/cross-zoom/.test(id))  { B.style.opacity=q; a.style.transform=`scale(${1+q*.3})`; bb.style.transform=`scale(${lerp(1.3,1,q)})`; }
    else if(/slide-left/.test(id))  { a.style.transform=`translateX(${-q*100}%)`; bb.style.transform=`translateX(${(1-q)*100}%)`; }
    else if(/slide-right/.test(id)) { a.style.transform=`translateX(${q*100}%)`; bb.style.transform=`translateX(${-(1-q)*100}%)`; }
    else if(/slide-up/.test(id))    { a.style.transform=`translateY(${-q*100}%)`; bb.style.transform=`translateY(${(1-q)*100}%)`; }
    else if(/slide-down/.test(id))  { a.style.transform=`translateY(${q*100}%)`; bb.style.transform=`translateY(${-(1-q)*100}%)`; }
    else if(/wipe-left/.test(id))   { B.style.clipPath=`inset(0 0 0 ${(1-q)*100}%)`; }
    else if(/wipe-right/.test(id))  { B.style.clipPath=`inset(0 ${(1-q)*100}% 0 0)`; }
    else if(/wipe-up/.test(id))     { B.style.clipPath=`inset(${(1-q)*100}% 0 0 0)`; }
    else if(/wipe-down/.test(id))   { B.style.clipPath=`inset(0 0 ${(1-q)*100}% 0)`; }
    else if(/split-vertical/.test(id)){ B.style.clipPath=`inset(${50-q*50}% 0 ${50-q*50}% 0)`; }
    else if(/split-horizontal/.test(id)){ B.style.clipPath=`inset(0 ${50-q*50}% 0 ${50-q*50}%)`; }
    else if(/whip-(left|right)/.test(id)){ const s=/left/.test(id)?-1:1;
      a.style.transform=`translateX(${s*-q*130}%)`; bb.style.transform=`translateX(${s*(1-q)*130}%)`;
      a.style.filter=bb.style.filter=`blur(${bell*36}px)`; }
    else if(/whip-(up|down)/.test(id)){ const s=/up/.test(id)?-1:1;
      a.style.transform=`translateY(${s*-q*130}%)`; bb.style.transform=`translateY(${s*(1-q)*130}%)`;
      a.style.filter=bb.style.filter=`blur(${bell*32}px)`; }
    else if(/flip-right/.test(id))  { A.style.transform=`perspective(2400px) rotateY(${q*-90}deg)`;
      B.style.transform=`perspective(2400px) rotateY(${(1-q)*90}deg)`; B.style.opacity=p>.5?1:0; A.style.opacity=p<.5?1:0; }
    else if(/-iris$/.test(id))      { B.style.clipPath=`circle(${q*75}% at 50% 50%)`; }
    else if(/clock-wipe/.test(id))  { const deg=q*360;
      B.style.clipPath = `polygon(50% 50%, 50% 0%, ${deg>90?'100% 0%,':''} ${deg>90?'100% '+Math.min(100,(deg-90)/90*100)+'%,':''} ${clockPt(deg)})`;
      if(q>=1) B.style.clipPath='none'; }
    else if(/glare|burn/.test(id))  { B.style.opacity=q; F.style.opacity=bell*.85;
      F.style.background=/burn/.test(id)?'radial-gradient(60% 60% at 50% 50%,#FFD08A,#FF6A2A)':'linear-gradient(105deg,transparent 30%,#fff 50%,transparent 70%)'; }
    else if(/flashbang/.test(id))   { F.style.opacity=Math.pow(bell,.4); B.style.opacity=p>.5?1:0; }
    else if(/strobe/.test(id))      { const k=Math.floor(p*7); F.style.opacity = k%2?.92:0; B.style.opacity=p>.5?1:0; }
    else if(/lens-glitch|glitch-blur/.test(id)){
      const j=bell; B.style.opacity=q;
      a.style.filter=`blur(${j*10}px) saturate(${1+j*2})`; bb.style.filter=`blur(${j*10}px)`;
      a.style.transform=`translateX(${Math.sin(p*44)*j*40}px)`; bb.style.transform=`translateX(${Math.cos(p*38)*j*34}px)`;
      F.style.background=`linear-gradient(90deg,#FF2D5522,#00E5FF22)`; F.style.opacity=j*.8; }
    else if(/radial-blur|blur-zoom/.test(id)){ B.style.opacity=q;
      a.style.filter=bb.style.filter=`blur(${bell*26}px)`;
      a.style.transform=`scale(${1+bell*.35})`; bb.style.transform=`scale(${1+bell*.35})`; }
    else if(/streamer/.test(id))    { B.style.clipPath=`polygon(0 0, ${q*190}% 0, ${q*190-90}% 100%, 0 100%)`;
      F.style.background=`linear-gradient(105deg,transparent 46%,#fff 50%,transparent 54%)`;
      F.style.opacity=.9; F.style.transform=`translateX(${lerp(-100,100,p)}%)`; }
    else if(/gradient-wipe/.test(id)){ const s=q*140;
      B.style.clipPath=`polygon(0 0, ${s}% 0, ${s-40}% 100%, 0 100%)`; B.style.filter=`blur(0px)`; }
    else if(/-erase$/.test(id))     { B.style.clipPath=`inset(0 ${(1-q)*100}% 0 0)`;
      F.style.background=`linear-gradient(90deg,transparent,${P.accent})`;
      F.style.clipPath=`inset(0 ${(1-q)*100}% 0 ${Math.max(0,q*100-5)}%)`; F.style.opacity=p>0&&p<1?.9:0; }
    else if(/film-roll/.test(id))   { const off=bell;
      a.style.transform=`translateY(${-q*115}%) skewY(${off*2}deg)`; bb.style.transform=`translateY(${(1-q)*115}%)`;
      F.style.background='repeating-linear-gradient(0deg,#0000 0 26px,#0006 26px 32px)'; F.style.opacity=off*.9; }
    else if(/reverse-shutter/.test(id)){ B.style.clipPath=`polygon(50% 50%, ${50-q*90}% ${50-q*70}%, ${50+q*90}% ${50-q*70}%, ${50+q*90}% ${50+q*70}%, ${50-q*90}% ${50+q*70}%)`; }
    else if(/-shutter$/.test(id))   { const k=p<.5? p*2 : (p-.5)*2;
      if(p<.5){ A.style.clipPath=`inset(${k*50}% ${k*50}% ${k*50}% ${k*50}%)`; B.style.opacity=0; }
      else { B.style.clipPath=`inset(${(1-k)*50}% ${(1-k)*50}% ${(1-k)*50}% ${(1-k)*50}%)`; A.style.opacity=0; } }
    else if(/superimpose/.test(id)) { B.style.opacity=q; A.style.opacity=1-q*.35; a.style.transform=`scale(${1+q*.08})`; }
    else if(/converge/.test(id))    { A.style.clipPath=`inset(0 ${q*50}% 0 ${q*50}%)`; a.style.transform=`scaleX(${lerp(1,.15,q)})`;
      B.style.clipPath=`inset(0 ${(1-q)*50}% 0 ${(1-q)*50}%)`; }
    else                            { B.style.opacity=q; }
    N.name.style.opacity = .9;
  }
};
function clockPt(deg){
  const r=deg*Math.PI/180, x=50+Math.sin(r)*80, y=50-Math.cos(r)*80;
  return `${x}% ${y}%`;
}

