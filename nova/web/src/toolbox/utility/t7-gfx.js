/* T7 — Nova timeline/editor — KHO HIỆU ỨNG & LỚP ĐỒ HOẠ: layer panel, gfx/glob editor, load fx/anim tool, catalog/trans/spec nguồn
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7GfxLayers(sceneId){
  const sp = (state.sceneSpecs || {})[sceneId];
  const arr = (sp && Array.isArray(sp.layers)) ? sp.layers : [];
  return arr.map((L, i) => ({ L, i })).filter(x => x.L && x.L.type !== 'backdrop');
}

function _t7GfxKind(L){
  if (L.type === 'bit') return 'bit';
  if (!L.template) return 'man';                              // tự thêm bằng tay
  if (/^md-/.test(L.template)) return 'md';                   // mẫu dựng lại từ motion template
  if (/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in/.test(L.template)) return 'ov';  // lớp phủ không khí
  if (/progress|highlight|circle|sliding/.test(L.template)) return 'sh';                                      // hình khối
  return 'tx';                                                // còn lại là chữ
}

function _t7GfxName(L){
  if (L.template){
    const c = (_t7Cat || []).find(x => x.template === L.template);
    return (c && c.label) || L.template;
  }
  if (L.type === 'text') return 'Chữ: ' + String(L.text || '').slice(0, 18);
  if (L.type === 'bit') return 'Bit: ' + String(L.bit || '');
  return L.type || 'lớp';
}

function _t7LayerPanel(L, ctx){
  const cat = (_t7Cat || []).find(x => x.template === L.template);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));
  const lb = (t, extra) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700;display:flex;justify-content:space-between"><span>${t}</span><span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-dim)">${extra || ''}</span></div>`;
  // Ô ảnh: nút chọn file thay vì bắt gõ data URL. Ô còn lại là ô chữ thường.
  const IMGK = /^(src|image|img|photo|logo|thumb)$/i;
  const fld = (k, v) => IMGK.test(k)
    ? `<div style="display:flex;gap:6px;align-items:center">
         <div class="t7-mfield" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:7px 9px">${v === '@scene' ? '🖼 ảnh của cảnh' : (v ? (String(v).startsWith('data:') ? '🖼 ảnh đã chọn' : (_t7IsVid(v) ? '🎬 ' + esc(String(v).split(/[\\/]/).pop()) : esc(String(v).slice(0, 40)))) : '— chưa có ảnh/video —')}</div>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickImg('${k}')" title="Ảnh — nhúng thẳng vào dự án">🖼 Ảnh</button>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickVid('${k}')" title="Video — lưu đường dẫn, lúc xuất tự chép vào bản dựng">🎬 Video</button>
         ${ctx.scene ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px" title="Dùng chính ảnh của cảnh này" onclick="t7LUseSceneImg('${k}')">🖼</button>` : ''}
         ${v ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px;color:var(--red)" onclick="t7LSet('${k}','')">✕</button>` : ''}
       </div>`
    : `<input class="t7-mfield" style="width:100%" value="${esc(v)}" onchange="t7LSet('${k}',this.value)">`;

  // Ô nội dung: đúng những trường mẫu khai, bỏ các trường màu (đưa xuống nhóm Màu).
  const COLORK = /^(bg|ink|color|color2|track|mark|fill)$/;
  const params = (cat && cat.params) || Object.keys(L).filter(k => !/^(template|type|at|until|z|id|in|out|hold|box|style|dx|dy|scale|rotate|opacity)$/.test(k));
  const content = params.filter(k => !COLORK.test(k)).map(k => lb(k) + fld(k, L[k])).join('');
  const colors = params.filter(k => COLORK.test(k));

  const chip = (grp, val, label, cur) =>
    `<span class="t7-cchip${cur === val ? ' on' : ''}" onclick="t7LAnim('${grp}','${val}')">${label}</span>`;
  const IN = [['fade','mờ dần'],['rise','dâng lên'],['drop','rơi xuống'],['slideL','trượt trái'],['slideR','trượt phải'],['pop','bật'],['defocus','nhoè'],['wipeL','quét ngang'],['zoom','phóng vào'],['deal','chia bài'],['none','không']];
  const OUT = [['fade','mờ dần'],['sinkL','chìm trái'],['sinkR','chìm phải'],['fall','rơi xuống'],['shrink','co lại'],['wipeR','quét'],['none','không']];
  const HOLD = [['none','không'],['kenIn','Ken Burns – phóng vào'],['kenOut','Ken Burns – phóng ra'],['panL','lia trái'],['panR','lia phải'],['panU','lia lên'],['panD','lia xuống'],['drift','trôi'],['breathe','thở'],['growX','chạy đầy ngang'],['growY','chạy đầy dọc']];
  const curIn = (L.in && L.in.preset) || 'fade', curOut = (L.out && L.out.preset) || 'none', curHold = (L.hold && L.hold.preset) || 'none';
  // ── Chuyển động đơn giản: 1 thẻ = phối sẵn Vào+Giữ+Ra, cộng thanh Mức độ. ──
  // Người dùng thường bấm 1 thẻ là xong; 3 hàng chip kỹ thuật gốc vẫn giữ nguyên
  // trong "Nâng cao" cho ai cần chỉnh riêng từng pha. Engine/render không đổi.
  const curAmp = (L.hold && L.hold.amp != null) ? Number(L.hold.amp) : 1;
  const curStyle = (_T7_STYLES || []).find(s => s.hold === curHold);
  const comboMatch = !!(curStyle && curStyle.in === curIn && curStyle.out === curOut);
  const styleCard = (s) =>
    `<div class="t7-stylecard${curStyle && curStyle.id === s.id ? ' on' : ''}" onclick="t7LStyle('${s.id}')" title="${esc(s.desc)}">
       <i>${s.icon}</i><span><b>${s.name}</b><s>${s.desc}</s></span>
     </div>`;

  // ── Vị trí / cỡ / độ mờ: mẫu tự dựng bố cục, các ô này ĐÈ LÊN bố cục đó ──
  const b = L.box || {};
  const B = (k, ph) => { const cur = _t7BoxRead(L, k);
    return `<input class="t7-mfield" style="width:100%" type="number" step="1" placeholder="${ph}" value="${cur != null ? esc(cur) : ''}" onchange="t7LBox('${k}',this.value)">`; };
  const N = (k, ph, step, dflt) => `<input class="t7-mfield" style="width:100%" type="number" step="${step}" placeholder="${ph}" value="${L[k] != null ? esc(L[k]) : ''}" onchange="t7LNum('${k}',this.value,${dflt})">`;
  const aBtn = (k, v, lbl) => `<span class="t7-cchip${(b[k] || (k === 'align' ? 'left' : 'top')) === v ? ' on' : ''}" onclick="t7LBoxSet('${k}','${v}')">${lbl}</span>`;
  const opa = Math.round((L.opacity != null ? Number(L.opacity) : 1) * 100);
  const layout = `<details class="t7-sect">
    <summary><span><b>📐 Vị trí &amp; cỡ</b><em>Đè lên bố cục mẫu — tính theo % khung hình nên đổi 16:9 ↔ 9:16 vẫn đúng chỗ.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2">
      <div class="t7-g2"><div>${lb('X (%)')}${B('x','8')}</div><div>${lb('Y (%)')}${B('y','8')}</div></div>
      <div class="t7-g2"><div>${lb('Rộng (%)')}${B('w','tự')}</div><div>${lb('Cao (%)')}${B('h','tự')}</div></div>
      ${lb('Canh chữ trong hộp')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('align','left','trái')}${aBtn('align','center','giữa')}${aBtn('align','right','phải')}</div>
      ${lb('Canh dọc')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('vAlign','top','trên')}${aBtn('vAlign','center','giữa')}${aBtn('vAlign','bottom','dưới')}</div>
      <div class="t7-g3" style="margin-top:4px">
        <div>${lb('Cỡ ×')}${N('scale','1','0.05',1)}</div>
        <div>${lb('Xoay °')}${N('rotate','0','1',0)}</div>
        <div>${lb('Mờ %')}<input class="t7-mfield" style="width:100%" type="number" min="0" max="100" step="5" value="${opa}" onchange="t7LNum('opacity',this.value===''?'':(parseFloat(this.value)/100),1)"></div>
      </div>
      <div class="t7-g2"><div>${lb('Dịch ngang %')}${N('dx','0','1',0)}</div><div>${lb('Dịch dọc %')}${N('dy','0','1',0)}</div></div>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7LPin()" title="Hiện khung 8 nút trên bản xem trước để kéo bằng chuột">📌 Kéo trên khung</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7LReset()">↺ Về bố cục gốc</button>
      </div>
    </div>
  </details>`;

  return `<details class="t7-sect" open>
    <summary><span><b>✏️ Nội dung lớp</b><em>${esc((cat && cat.label) || L.template || L.type)} — ô do chính mẫu khai.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">${content || '<div class="t7-dim" style="font-size:11.5px">Mẫu này không có ô điền.</div>'}</div>
  </details>
  ${layout}
  ${colors.length ? `<details class="t7-sect">
    <summary><span><b>🎨 Màu</b><em>Đè lên màu mặc định của mẫu.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">${colors.map(k => `<div>${lb(k)}<div style="display:flex;gap:5px;align-items:center"><input type="color" style="width:30px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer" value="${esc(/^#[0-9a-f]{6}$/i.test(L[k] || '') ? L[k] : ((cat && cat.defaults && cat.defaults[k]) || '#888888'))}" onchange="t7LSet('${k}',this.value)"><input class="t7-mfield" style="flex:1;min-width:0;font-family:monospace;font-size:11px" value="${esc(L[k] || '')}" placeholder="mặc định" onchange="t7LSet('${k}',this.value)"></div></div>`).join('')}</div></div>
  </details>` : ''}
  <details class="t7-sect" open>
    <summary><span><b>🎞 Chuyển động</b><em>Bấm 1 kiểu là đủ — phần vào/ra đã phối sẵn.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${(_T7_STYLES || []).map(styleCard).join('')}</div>
      ${lb('Mức độ chuyển động')}
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <span style="font-size:10.5px;color:var(--text-muted)">nhẹ</span>
        <input type="range" min="0.25" max="2" step="0.05" value="${curAmp}" style="flex:1;accent-color:var(--accent)" onchange="t7LAmp(this.value)" title="Kéo sang phải để chuyển động mạnh/đậm hơn">
        <span style="font-size:10.5px;color:var(--text-muted)">mạnh</span>
      </div>
      ${comboMatch ? '' : `<div style="font-size:10.5px;color:var(--text-dim);margin-top:7px">⚙️ Đang chỉnh tay (${esc(curIn)} · ${esc(curHold)} · ${esc(curOut)}) — bấm 1 kiểu bên trên để áp bộ chuẩn.</div>`}
      <details style="margin-top:9px">
        <summary style="font-size:10.5px;color:var(--text-dim);cursor:pointer;user-select:none;list-style:none">⚙️ Nâng cao — chỉnh riêng từng pha (Vào / Giữ / Ra)</summary>
        <div style="margin-top:6px">
          ${lb('Vào', IN.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${IN.map(([v,l]) => chip('in', v, l, curIn)).join('')}</div>
          ${lb('Ra', OUT.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${OUT.map(([v,l]) => chip('out', v, l, curOut)).join('')}</div>
          ${lb('Giữ', HOLD.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${HOLD.map(([v,l]) => chip('hold', v, l, curHold)).join('')}</div>
        </div>
      </details>
    </div>
  </details>
  ${ctx.timing || ''}${ctx.tail || ''}`;
}

function _t7GfxEditor(c){
  const idx = Number(_t7GfxSel.split(':')[1]);
  const sp = (state.sceneSpecs || {})[c.sceneId];
  const L = sp && sp.layers && sp.layers[idx];
  if (!L) return '';
  const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const timing = `<details class="t7-sect">
    <summary><span><b>⏱ Thời điểm</b><em>Hiện lúc nào, tắt lúc nào trong cảnh.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Hiện ở (giây)')}<input class="t7-mfield" style="width:100%" value="${esc(L.at != null ? L.at : 0)}" onchange="t7LSet('at',parseFloat(this.value)||0)"></div>
      <div>${lb('Tắt ở (giây)')}<input class="t7-mfield" style="width:100%" placeholder="hết cảnh" value="${esc(L.until != null ? L.until : '')}" onchange="t7LSet('until',this.value===''?null:(parseFloat(this.value)||null))"></div>
    </div></div>
  </details>`;
  const tail = `<details class="t7-sect" open>
    <summary><span><b>📋 Dùng lại lớp này</b><em>Chép sang cảnh khác — khỏi gắn tay 192 lần.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      <div style="display:flex;gap:5px;margin-bottom:5px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxCopy()" title="⌘C">📋 Chép</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxDup()" title="⌘D">⧉ Nhân đôi</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7GfxPaste()" title="⌘V">📥 Dán</button>
      </div>
      <button class="btn ghost sm" style="width:100%;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7GfxToGlobal()" title="Phủ cả video, chỉ 1 lớp — nhẹ hơn dán 192 lần">🌐 Chuyển thành lớp TOÀN CỤC</button>
      <button class="btn ghost sm" style="width:100%;margin-top:4px;padding:5px;font-size:11px" onclick="t7GfxPasteAll()" title="⇧⌘V">📥 Dán vào tất cả cảnh (192 bản sao)</button>
    </div>
  </details>
  <details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp này khỏi cảnh · phím Delete.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GfxDel(${idx})">Gỡ lớp đồ hoạ</button></div>
  </details>`;
  return _t7LayerPanel(L, { scene: true, timing, tail });
}

function _t7GlobEditor(){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return '';
  const L = g.layer || {}; const esc = escapeHtml;
  const lb = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700">${t}</div>`;
  const tot = (typeof _t7Total === 'function') ? _t7Total() : 0;
  const timing = `<details class="t7-sect" open>
    <summary><span><b>⏱ Thời gian trên CẢ VIDEO</b><em>Không thuộc cảnh nào — mốc tính từ đầu video (tổng ${tot.toFixed(1)}s).</em></span><span class="cv">⌃</span></summary>
    <div class="bd2"><div class="t7-g2">
      <div>${lb('Bắt đầu (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0" step="0.5" value="${(Number(g.start) || 0).toFixed(1)}" onchange="t7GlobTime('start',this.value)"></div>
      <div>${lb('Kéo dài (giây)')}<input class="t7-mfield" style="width:100%" type="number" min="0.3" step="0.5" value="${(Number(g.dur) || 3).toFixed(1)}" onchange="t7GlobTime('dur',this.value)"></div>
    </div>
    <button class="btn ghost sm" style="width:100%;margin-top:7px;padding:5px;font-size:11px" onclick="t7GlobFull()">⇤⇥ Phủ trọn cả video (0 → ${tot.toFixed(1)}s)</button>
    </div>
  </details>`;
  const tail = `<details class="t7-sect danger">
    <summary><span><b>⚠️ Vùng nguy hiểm</b><em>Gỡ lớp toàn cục này.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><button class="btn ghost sm" style="width:100%;padding:7px;color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)" onclick="t7GlobDel(${_t7GlobSel})">Gỡ lớp toàn cục</button></div>
  </details>`;
  return `<div class="t7-drow" style="margin-bottom:8px"><span class="t7-dlab">🌐 Lớp toàn cục</span><div class="t7-dfield" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(_t7GfxName(L))}</div></div>
  ${_t7LayerPanel(L, { scene: false, timing, tail })}`;
}

async function _t7LoadFx(){
  if (!_t7Cat) await _t7Catalog();
  if (!_t7Trans) await _t7LoadTrans();
  if (!_t7Bits && window.native && typeof window.native.sceneBits === 'function'){
    try { const r = await window.native.sceneBits(); if (r && r.ok) _t7Bits = r.items || []; } catch (e) { _t7Bits = []; }
  }
  if (!_t7Bits) _t7Bits = [];
  if (!_t7Prev && window.native && typeof window.native.fxPreviews === 'function'){
    try { const r = await window.native.fxPreviews(); _t7Prev = (r && r.ok) ? (r.items || {}) : {}; } catch (e) { _t7Prev = {}; }
  }
  if (!_t7Prev) _t7Prev = {};
  const n = (_t7Cat || []).length + (_t7Trans || []).length + _t7Bits.length;
  const c = document.getElementById('t7FxCount'); if (c) c.textContent = n || '—';
  return n;
}

async function _t7FxSwatchLoad(){
  if (_t7FxSw) return _t7FxSw;
  _t7FxSw = {};
  const fxs = (_t7Cat || []).filter(t => /^fx-/.test(t.template));
  for (const t of fxs){
    try {
      const r = await window.native.previewLayers({ spec: { durationSec: 2, layers: [{ template: t.template }] }, t: 1.2 });
      const it = (r && r.ok && r.items || []).find(x => x && x.kind === 'fx');
      if (it && (it.pieces || []).length){
        _t7FxSw[t.template] = '<div style="position:relative;width:100%;height:100%;overflow:hidden">' + _t7LayerHtml(it) + '</div>';
      }
    } catch (e) {}
  }
  return _t7FxSw;
}

function _t7ABImgs(){
  if (_t7AB) return _t7AB;
  const imgs = [];
  for (const c of (t7State.clips || [])){
    const im = _t7ClipImg(c);
    if (im && imgs.indexOf(im) < 0) imgs.push(im);
    if (imgs.length >= 2) break;
  }
  _t7AB = { a: imgs[0] || '', b: imgs[1] || imgs[0] || '' };
  return _t7AB;
}

function _t7FxTargetSpec(){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c){ setStatus7('Chọn một cảnh trước đã.', 'error'); return null; }
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[c.sceneId];
  if (!sp){
    // Chưa có spec → dựng khung có lớp nền '@scene' để ảnh cảnh vẫn hiện dưới đồ hoạ.
    sp = state.sceneSpecs[c.sceneId] = { rev: Date.now(), layers: [
      { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } },
    ] };
  }
  return { c, sp };
}

function animOpen(){
  try { if (typeof t7Focus === 'function') t7Focus(false); } catch (e) {}
  switchTool('toolanim');                                  // switchTool tự gọi animInit()
}

async function animInit(){
  const body = document.getElementById('animBody'); if (!body) return;
  if (!_animLoaded){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">Đang nạp kho hiệu ứng…</div>';
    try { await _t7LoadFx(); } catch (e) {}
    _animLoaded = true;
  }
  animRender();
}

function animSetStatus(msg, tone){
  const el = document.getElementById('animStatus'); if (!el) return;
  el.textContent = msg || '';
  el.style.color = tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--accent)'
    : tone === 'error' ? 'var(--red)' : 'var(--text-muted)';
}

function _animSelClip(){
  try { return (t7State.clips || []).find(x => x.id === t7State.selClip) || null; }
  catch (e) { return null; }
}

function animGoT7(){
  switchTool('tool7');                                     // switchTool tự gọi t7Build()
  try { if (typeof t7SetMediaTab === 'function') t7SetMediaTab('fx'); } catch (e) {}
  try { if (typeof t7FxTab === 'function') t7FxTab('motion'); } catch (e) {}
}

function animApply(kind, name){
  if (!window.native || !window.native.sceneTemplates){
    animSetStatus('Chỉ áp được trong app Nova (Electron) — mở app desktop.', 'error'); return;
  }
  const c = _animSelClip();
  if (!c){
    animGoT7();
    animSetStatus('Chưa chọn cảnh — đã mở Dựng Video. Bấm chọn một cảnh trên timeline rồi quay lại đây bấm hiệu ứng.', 'warn');
    return;
  }
  if (kind === 'tpl' && typeof t7FxAddTpl === 'function') t7FxAddTpl(name);
  else if (kind === 'bit' && typeof t7FxAddBit === 'function') t7FxAddBit(name);
  else if (kind === 'tr' && typeof t7FxSetTrans === 'function') t7FxSetTrans(name);
  else { animSetStatus('Không áp được (thiếu hàm của Tool 7).', 'error'); return; }
  const nhan = kind === 'tr' ? 'chuyển cảnh' : (kind === 'bit' ? 'bit' : 'mẫu');
  animSetStatus('✓ Đã áp ' + nhan + ' vào cảnh ' + c.sceneId + ' — bấm 🎬 Mở Dựng Video để xem kết quả.', 'ok');
}

function animRender(){
  const body = document.getElementById('animBody'); if (!body) return;
  const qEl = document.getElementById('animQ');
  const q = (qEl ? qEl.value : '').toLowerCase();
  const esc = escapeHtml;
  const cat = _t7Cat || [], bits = _t7Bits || [], trans = _t7Trans || [];
  const stat = document.getElementById('animStat');
  if (stat) stat.textContent = cat.length + ' mẫu · ' + bits.length + ' bit · ' + trans.length + ' chuyển cảnh';
  if (!window.native || !window.native.sceneTemplates){
    body.innerHTML = '<div class="anim-dim" style="padding:10px">⚠️ Kho hiệu ứng chỉ nạp được trong app Nova (Electron) — mở bằng app desktop. Trong trình duyệt thường sẽ thấy trống.</div>';
    return;
  }
  const _hit = (s) => !q || String(s || '').toLowerCase().includes(q);
  let html = '';
  // 1) Mẫu đồ hoạ động — ảnh xem trước thật từ nova:fxPreviews
  const t = cat.filter(x => _hit(x.label + ' ' + x.template));
  html += '<div class="anim-sec">Mẫu đồ hoạ động · ' + t.length + '</div>';
  html += t.length
    ? '<div class="anim-grid">' + t.map(x => {
        const im = (_t7Prev || {})['tpl_' + x.template];
        return '<div class="anim-card" onclick="animApply(\'tpl\',\'' + esc(x.template) + '\')" title="' + esc((x.params || []).join(' · ')) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x.label) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có mẫu nào khớp.</div>';
  // 2) Bit Remotion
  const b = bits.filter(_hit);
  html += '<div class="anim-sec">Bit Remotion · ' + b.length + '</div>';
  html += b.length
    ? '<div class="anim-grid">' + b.map(x => {
        const im = (_t7Prev || {})['bit_' + x];
        return '<div class="anim-card" onclick="animApply(\'bit\',\'' + esc(x) + '\')" title="' + esc(x) + ' — bấm để áp vào cảnh đang chọn">'
          + '<div class="pv">' + (im ? '<img src="' + im + '" loading="lazy">' : '<span>—</span>') + '</div>'
          + '<div class="nm">' + esc(x) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="anim-dim">Không có bit nào khớp.</div>';
  // 3) Chuyển cảnh — gom theo nhóm y như Tool 7 để dễ tìm
  const fam = {};
  trans.filter(x => _hit(x.label + ' ' + x.id)).forEach(x => { (fam[x.family] = fam[x.family] || []).push(x); });
  const famKeys = Object.keys(fam);
  const nTr = famKeys.reduce((n, f) => n + fam[f].length, 0);
  html += '<div class="anim-sec">Chuyển cảnh · ' + nTr + '</div>';
  html += famKeys.length
    ? famKeys.map(f =>
        '<div class="anim-fam">' + esc(_T7_FAM[f] || f) + '</div>' +
        '<div class="anim-trgrid">' + fam[f].map(x =>
          '<div class="anim-tr" onclick="animApply(\'tr\',\'' + esc(x.id) + '\')" title="' + esc(x.description || '') + ' — bấm để gán cho cảnh đang chọn"><b>' + esc(x.label) + '</b><s>' + (x.durationSec || '') + 's</s></div>').join('') + '</div>'
      ).join('')
    : '<div class="anim-dim">Không có chuyển cảnh nào khớp.</div>';
  body.innerHTML = html;
}

async function _t7LoadTrans(){
  if (_t7Trans) return _t7Trans;
  try {
    const r = await window.native.sceneTransitions();
    if (r && r.ok && Array.isArray(r.items) && r.items.length){ _t7Trans = r.items; return _t7Trans; }
  } catch (e) {}
  _t7Trans = _T7_TRANS_FALLBACK; return _t7Trans;
}

async function _t7AssetUrl(img){
  const src = await _t7ImgToDataUrl(img);
  if (!src) return '';
  if (!src.startsWith('data:')) return src;
  if (_t7BlobUrls.has(src)) return _t7BlobUrls.get(src);
  try { const blob = await (await fetch(src)).blob(); const url = URL.createObjectURL(blob); _t7BlobUrls.set(src, url); return url; }
  catch (e) { return src; }
}

function _t7DefaultSpec(c, src){
  const prev = null;
  return { id: c.sceneId, durationSec: parseFloat(_t7ClipDur(c)) || 3,
    // Chuyển cảnh GIỮA hai cảnh — NovaSequence đọc trường này, khác với in.preset là hiệu ứng của RIÊNG lớp.
    trans: c.trans || 'none', transDur: c.transDur || 0,
    theme: { bg: '#000000' },
    layers: src ? [{ type:'backdrop', src, at:0,
      in:  { preset: _T7_IN[c.trans] || 'fade', dur: Math.min(0.5, (c.transDur || 0.5)) },
      // Giãn nhịp: ngoài 30 giây đầu thì phần lớn cảnh để TĨNH.
      hold:{ preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 },
      out: { preset: 'fade', dur: 0.35 } }] : [] };
}

async function _t7NovaScenes(opts){
  const inline = !!(opts && opts.inline);
  const out = [];
  for (const c of _t7Clips()){
    const img = _t7ClipImg(c);
    const src = img ? (inline ? await _t7ImgToDataUrl(img) : await _t7AssetUrl(img)) : '';
    const designed = (state.sceneSpecs || {})[c.sceneId];
    if (designed && Array.isArray(designed.layers) && designed.layers.length){
      // Spec AI thiết kế: ÉP thời lượng theo cảnh + thay chỗ giữ "@scene" bằng ảnh thật.
      const spec = JSON.parse(JSON.stringify(designed));
      spec.id = c.sceneId;
      spec.durationSec = parseFloat(_t7ClipDur(c)) || 3;
      spec.trans = c.trans || 'none'; spec.transDur = c.transDur || 0;   // chuyển cảnh do clip quyết, không phải spec AI
      spec.layers.forEach(L => { if (L && L.src === '@scene') L.src = src; });
      spec.layers = spec.layers.filter(L => !(L && (L.type === 'backdrop' || L.type === 'image') && !L.src));
      out.push(spec);
    } else {
      out.push(_t7DefaultSpec(c, src));
    }
  }
  return out;
}

async function _t7Catalog(){
  if (_t7Cat) return _t7Cat;
  try {
    const r = await window.native.sceneTemplates();
    // Kho rỗng là trạng thái HỢP LỆ (vừa xoá sạch để thay mới) — trước đây coi là lỗi đọc.
    if (r && r.ok && Array.isArray(r.items)) { _t7Cat = r.items; return _t7Cat; }
  } catch (e) {}
  return null;
}
