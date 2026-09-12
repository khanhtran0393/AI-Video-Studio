/* T7 — Nova timeline/editor — TRỢ LÝ AI: map vai trò, đề xuất mẫu/chuyển cảnh, vision, critic, render queue duyệt
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7Gist(s, n){ const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }

function _t7AiSig(t){
  const s = String(t || '');
  let h = 0; for (let i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

function _t7AiSave(){
  // Danh sách cảnh lỗi đi cùng hàng đợi: mở lại dự án vẫn thấy "cảnh nào chưa lấy được đề
  // xuất" và bấm Thử lại được — nếu chỉ nằm trong biến tạm thì mất sạch sau mỗi lần đóng app.
  try { state.aiQueue = _t7AiQ; state.aiHong = _t7AiHong; if (typeof saveState === 'function') saveState(true); } catch (e) {}
}

// Mọi lượt gọi AI của Trợ lý đi qua đây để đếm được SỐ LẦN + THỜI GIAN đã chờ (#7 minh bạch chi phí).
// Không phải fallback: chỉ cộng dồn số liệu, phần còn lại giao nguyên cho callLLMJson.
async function _t7AiJson(prompt, opts){
  const t0 = Date.now();
  _t7AiStat.calls++;
  try { return await callLLMJson(prompt, opts); }
  finally { _t7AiStat.ms += Date.now() - t0; }
}

// Đặt lại số đếm khi bắt đầu một lượt phân tích mới (không cộng dồn qua nhiều lần bấm).
function _t7AiStatReset(){ _t7AiStat.calls = 0; _t7AiStat.ms = 0; _t7AiHong = []; }

// Đọc số đếm thành một dòng ngắn cho chân sheet.
function _t7AiStatLine(){
  if (!_t7AiStat.calls) return '';
  const giay = _t7AiStat.ms / 1000;
  return `${_t7AiStat.calls} lượt gọi AI · ${giay < 60 ? giay.toFixed(1) + 's' : Math.round(giay / 60) + ' phút'} chờ`;
}

// Vân tay LỜI THOẠI làm nên đề xuất này — để đối chiếu với hiện tại khi dựng lại hàng đợi.
// Lời đổi → vân tay đổi → đề xuất cũ hết hiệu lực (Luật 10: lộ ra bằng cách BỎ, không âm thầm giữ cái sai).
// Mối nối phụ thuộc lời của CẢ HAI cảnh hai bên nên vân tay tính trên cả cặp.
// Trả null khi không tìm thấy clip — nghĩa là hàng đợi đang nói về cảnh không còn tồn tại.
function _t7AiEntrySig(q, clips){
  const ds = clips || t7State.clips || [];
  const i = ds.findIndex(c => c && c.sceneId === (q && q.sceneId));
  if (i < 0) return null;
  const sc = _t7ClipScene(ds[i]);
  if (q.kind === 'tr'){
    const nx = _t7ClipScene(ds[i + 1]);
    return _t7AiSig(String((sc && sc.text) || '') + '\u241f' + String((nx && nx.text) || ''));
  }
  return _t7AiSig(sc && sc.text);
}

// Chỉ giữ TÊN MẪU + đúng các trường danh mục khai nhận cho mẫu đó.
// AI (hoặc người sửa DOM) nhét trường lạ vào q.picks thì _t7AiApply không được phép đẩy thẳng
// xuống sceneSpecs — expandOne sẽ Object.assign đè lên tham số mẫu (box/z/at/src…) → phá bố cục.
// Custom layers ĐÃ qua _t7AiFixLayers kẹp chặt nên không đi qua đây.
function _t7AiPrunePick(cat, pk){
  if (!pk || !pk.template) return null;
  const e = (cat || []).find(c => c.template === pk.template);
  if (!e) return null;                                   // mẫu không còn trong danh mục → bỏ
  const out = { template: pk.template };
  (e.params || []).forEach(k => { if (pk[k] != null) out[k] = pk[k]; });
  return out;
}

function _t7AiSteps(cur, note){
  const box = document.getElementById('t7AiSteps'); if (!box) return;
  if (cur === 0) _t7AiNote = {};
  Object.assign(_t7AiNote, note || {});
  box.innerHTML = _T7_AI_STEP.map((ten, i) => {
    const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
    const phu = _t7AiNote[i] || (i === cur ? 'đang chạy…' : '');
    return `<div class="st ${cls}"><u>${i < cur ? '✓' : (i + 1)}</u>${escapeHtml(ten)}${phu ? ' · <span style="color:var(--text-dim)">' + escapeHtml(phu) + '</span>' : ''}</div>`;
  }).join('');
}

function _t7AiTally(){
  const ap = _t7AiQ.filter(x => x.state === 'ap').length;
  const nTr = _t7AiQ.filter(x => x.kind === 'tr').length;
  const loai = _t7AiQ.filter(x => x.state === 'dr').length;
  const tu = _t7AiQ.length - loai;                  // KHÔNG đếm mục đã bị loại vào mẫu số —
  const el = document.getElementById('t7AiCnt');    // "0 / 0 đã gắn" khác hẳn "0 / 12 đã gắn"
  if (el) el.textContent = ap + ' / ' + tu + ' đã gắn' + (nTr ? ' · ' + nTr + ' mối nối' : '')
    + (loai ? ' · đã loại ' + loai : '')
    + (_t7AiHong.length ? ' · thiếu ' + _t7AiHong.length : '')
    + (_t7AiStat.calls ? ' · ' + _t7AiStatLine() : '');
  const n = document.getElementById('t7GfxCount');
  if (n){ let t = 0; try { Object.values(state.sceneSpecs || {}).forEach(sp =>
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') t++; })); } catch (e) {}
    n.textContent = t ? t + ' lớp' : ''; }
}

function _t7AiApply(q){
  // Mối nối: không đụng sceneSpecs, chỉ đặt kiểu chuyển lên chính clip đó.
  if (q.kind === 'tr'){
    const c = (t7State.clips || []).find(x => x.id === q.clipId || x.sceneId === q.sceneId);
    if (c){ c.trans = q.tr; c.transDur = q.trDur || 0.5;
      try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); } catch (e) {} }
    return;
  }
  // Lớp thô (custom) hay mẫu (picks) — engine đọc chung một kiểu. Custom đã bị _t7AiFixLayers
  // kẹp chặt từng trường; picks thì chưa, nên lọc theo params của danh mục ngay tại cánh cửa
  // DUY NHẤT này trước khi nó chạm sceneSpecs. Danh mục chưa nạp thì giữ nguyên như cũ
  // (picks đã được `allowed.has` chặn tên lạ ở bước đề xuất) — khỏi phá luồng khôi phục hàng đợi.
  const tuVe = !!(q.custom && q.custom.length);
  let lay = tuVe ? q.custom.slice() : (q.picks || []).slice();
  if (!tuVe && Array.isArray(_t7Cat) && _t7Cat.length)
    lay = lay.map(pk => _t7AiPrunePick(_t7Cat, pk)).filter(Boolean);
  if (!lay.length) return;                                // không còn lớp nào hợp lệ → đừng tạo spec rỗng
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let sp = state.sceneSpecs[q.sceneId];
  if (!sp) sp = state.sceneSpecs[q.sceneId] = { rev: Date.now(), layers: [
    { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 },
      hold: { preset: _T7_HOLD[q.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } } ] };
  if (!Array.isArray(sp.layers)) sp.layers = [];
  lay.forEach(pk => sp.layers.push(JSON.parse(JSON.stringify(pk))));
  sp.rev = Date.now();
}

function _t7AiLang(){
  try { return (typeof _profileLang === 'function' && _profileLang()) || 'Tiếng Việt'; }
  catch (e) { return 'Tiếng Việt'; }
}

function _t7AiClip(q){ return (t7State.clips || []).find(c => c.sceneId === q.sceneId) || null; }

function _t7AiDur(q){ const c = _t7AiClip(q); return c ? (parseFloat(_t7ClipDur(c)) || 3) : 3; }

function _t7AiSpecOf(q, dur){
  const L = (q.custom && q.custom.length) ? q.custom : (q.picks || []);
  return { rev: 1, durationSec: dur, layers: JSON.parse(JSON.stringify(L)) };
}

async function _t7AiPvHtml(q, t){
  if (!window.native || typeof window.native.previewLayers !== 'function') return '';
  const key = q.sceneId + '|d' + t.toFixed(2);
  if (_t7AiPv.has(key)) return _t7AiPv.get(key);
  const dur = _t7AiDur(q);
  let html = '';
  try {
    const r = await window.native.previewLayers({ spec: _t7AiSpecOf(q, dur), t: Math.min(t, dur) });
    if (r && r.ok) html = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e) { /* để trống, ô vẫn có nhãn báo */ }
  _t7AiPv.set(key, html);
  return html;
}

async function _t7AiPvDraw(i, chiNen){
  const q = _t7AiQ[i]; if (!q) return;
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  const pv = box.querySelector('.pv'); if (!pv) return;
  if (chiNen){ pv.innerHTML = ''; return; }        // "Trước" = cảnh trần, không cần hỏi engine
  const html = await _t7AiPvHtml(q, _t7AiTStill(_t7AiDur(q)));
  if (box.isConnected) pv.innerHTML = html;
}

function _t7AiTryClear(){
  if (!_t7AiTry) return;
  _t7AiTry = null; _t7OvKey = '';
  try { if (!t7State.playing) t7RenderPreview(); } catch (e) {}
}

function _t7AiPvHook(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  try { if (_t7AiObs) _t7AiObs.disconnect(); } catch (e) {}
  const nodes = box.querySelectorAll('.prev[data-i]');
  if (typeof IntersectionObserver !== 'function'){ nodes.forEach(e => _t7AiPvDraw(+e.dataset.i, false)); return; }
  _t7AiObs = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting){ _t7AiPvDraw(+e.target.dataset.i, e.target.dataset.mode === 'truoc'); _t7AiObs.unobserve(e.target); }
  }, { root: box, rootMargin: '300px' });
  nodes.forEach(e => _t7AiObs.observe(e));
}

function _t7AiFields(cat, tpl){
  const e = (cat || []).find(c => c.template === tpl); if (!e) return [];
  const d = e.defaults || {};
  const uu = ['text', 'headline', 'title', 'value', 'unit', 'kicker', 'subtitle', 'note', 'body', 'dek',
              'caption', 'label', 'name', 'chip', 'stamp', 'range', 'role', 'date',
              'position', 'pos', 'from', 'side', 'animation', 'dir', 'mode', 'size'];
  return (e.params || [])
    .filter(k => k !== 'src')                        // ảnh riêng của mẫu — chọn file, không sửa ở đây
    .map(k => {
      const v = d[k];
      let kind = 'text';
      if (_T7_ENUM[k]) kind = 'chon';
      else if (typeof v === 'number') kind = 'so';
      else if (typeof v === 'string' && /^(#|rgba?\()/.test(v)) kind = 'mau';
      return { key: k, kind, mac: v, chon: _T7_ENUM[k] || null };
    })
    .sort((a, b) => {
      const ia = uu.indexOf(a.key), ib = uu.indexOf(b.key);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

function _t7Hex(v){
  const s = String(v || '');
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
  return '#ffffff';
}

function _t7AiEditCustom(q, i){
  return (q.custom || []).map((L, j) => {
    const o = (key, nhan, kind, val, chon) => {
      const id = `cu${i}_${j}_${key}`;
      const set = `t7AiCustomSet(${i},${j},'${key}',this.value)`;
      if (kind === 'chon')
        return `<label for="${id}">${nhan}</label><select id="${id}" onchange="${set}">${
          chon.map(x => `<option value="${x}"${String(val) === x ? ' selected' : ''}>${(typeof NOVA_ANIM_LABELS !== 'undefined' && NOVA_ANIM_LABELS[x]) ? NOVA_ANIM_LABELS[x] : x}</option>`).join('')}</select>`;
      if (kind === 'mau')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="color" value="${_t7Hex(val)}" oninput="${set}">`;
      if (kind === 'so')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="number" value="${escapeHtml(String(val))}" oninput="${set}">`;
      return `<label for="${id}">${nhan}</label><input id="${id}" type="text" value="${escapeHtml(String(val == null ? '' : val))}" oninput="${set}">`;
    };
    const b = L.box || {}, st = L.style || {};
    const os = [
      L.type === 'text' ? o('text', 'Chữ', 'text', L.text) : '',
      o('x', 'Trái %', 'so', b.x), o('y', 'Trên %', 'so', b.y),
      o('w', 'Rộng %', 'so', b.w), o('h', 'Cao %', 'so', b.h),
      L.type === 'text' ? o('align', 'Canh', 'chon', b.align, ['left', 'center', 'right']) : '',
      L.type === 'text' ? o('size', 'Cỡ', 'so', st.size) : '',
      L.type === 'text' ? o('color', 'Màu chữ', 'mau', st.color) : o('fill', 'Màu khối', 'mau', st.fill),
      o('in', 'Vào cảnh', 'chon', L.in && L.in.preset, NOVA_IN_PRESETS),
      o('hold', 'Chuyển động chính', 'chon', L.hold && L.hold.preset, NOVA_HOLD_PRESETS),
    ].filter(Boolean).join('');
    return `<div class="edg"><b>Lớp ${j + 1} · ${L.type === 'text' ? 'chữ' : 'khối'}</b><div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7AiEditVeLai(i, q){
  clearTimeout(_t7AiEditT2);
  _t7AiEditT2 = setTimeout(() => {
    for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
    t7AiPvStop(); _t7AiPvDraw(i, false);
    if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){
      _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q)); _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {}
    }
    _t7AiSave();
  }, 220);
}

function _t7AiEditHtml(q, i, cat){
  if (q.custom && q.custom.length) return _t7AiEditCustom(q, i);
  return (q.picks || []).map((pk, j) => {
    const nhan = ((cat || []).find(c => c.template === pk.template) || {}).label || pk.template;
    const os = _t7AiFields(cat, pk.template).map(f => {
      const v = (pk[f.key] != null) ? pk[f.key] : f.mac;
      const id = `ed${i}_${j}_${f.key}`;
      const set = `t7AiEditSet(${i},${j},'${f.key}',this.${f.kind === 'mau' ? 'value' : 'value'})`;
      if (f.kind === 'chon')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <select id="${id}" onchange="${set}">${f.chon.map(o => `<option${String(v) === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      if (f.kind === 'so')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="number" step="${Number(f.mac) < 5 ? '0.05' : '1'}" value="${escapeHtml(String(v))}" oninput="${set}">`;
      if (f.kind === 'mau')
        return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="color" value="${_t7Hex(v)}" oninput="${set}">`;
      return `<label for="${id}">${escapeHtml(_T7_NHAN[f.key] || f.key)}</label>
          <input id="${id}" type="text" value="${escapeHtml(String(v == null ? '' : v))}" oninput="${set}">`;
    }).join('');
    return `<div class="edg">${(q.picks.length > 1) ? `<b>${escapeHtml(nhan)}</b>` : ''}<div class="edf">${os}</div></div>`;
  }).join('');
}

function _t7DeNhau(a, b){
  return !(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1);
}

function _t7AiFixLayers(arr, dur){
  if (!Array.isArray(arr)) return [];
  const ra = [], hop = [];
  for (const L0 of arr.slice(0, _T7_MAX_LAYER + 2)){
    if (!L0 || typeof L0 !== 'object') continue;
    const type = (L0.type === 'shape') ? 'shape' : 'text';
    if (type === 'text' && !String(L0.text || '').trim()) continue;

    const b0 = L0.box || {};
    let x = _t7Kep(_t7Num(b0.x, 8), _T7_SAFE.x0, _T7_SAFE.x1);
    let y = _t7Kep(_t7Num(b0.y, 70), _T7_SAFE.y0, _T7_SAFE.y1);
    let w = _t7Kep(_t7Num(b0.w, 55), 8, 92);
    let h = _t7Kep(_t7Num(b0.h, type === 'shape' ? 12 : 18), 3, 90);
    if (x + w > _T7_SAFE.x1) w = _T7_SAFE.x1 - x;      // tràn mép phải → co lại, không đẩy
    if (y + h > _T7_SAFE.y1) h = _T7_SAFE.y1 - y;
    if (w < 8 || h < 3) continue;
    const hopNay = { x, y, w, h };
    if (hop.some(o => _t7DeNhau(o, hopNay))) continue;  // đè lớp đã nhận → bỏ

    const st0 = L0.style || {}, st = {};
    if (type === 'text'){
      st.size = _t7Kep(_t7Num(st0.size, 54), _T7_SIZE.min, _T7_SIZE.max);
      st.weight = _t7Kep(_t7Num(st0.weight, 800), 300, 900);
      st.color = _t7MauOk(st0.color) || '#ffffff';
      if (_t7MauOk(st0.bg)) st.bg = _t7MauOk(st0.bg);
      if (st0.upper) st.upper = true;
      st.shadow = st0.shadow !== false;                 // chữ trên video: mặc định có bóng cho đọc được
    } else {
      st.fill = _t7MauOk(st0.fill) || 'rgba(0,0,0,.55)';
      if (_t7MauOk(st0.fill2)) st.fill2 = _t7MauOk(st0.fill2);
      if (['gradient', 'radial'].includes(st0.fillType)) st.fillType = st0.fillType;
      st.radius = _t7Kep(_t7Num(st0.radius, 10), 0, 40);
    }

    const L = { type, box: { x, y, w, h, align: ['left', 'center', 'right'].includes(b0.align) ? b0.align : 'left' },
      style: st,
      at: _t7Kep(_t7Num(L0.at, 0), 0, Math.max(0, dur - 0.3)),
      in:   { preset: _t7Preset(L0.in && L0.in.preset, NOVA_IN_PRESETS, 'fade'),   dur: _t7Kep(_t7Num(L0.in && L0.in.dur, 0.45), 0.15, 1.2) },
      hold: { preset: _t7Preset(L0.hold && L0.hold.preset, NOVA_HOLD_PRESETS, 'none') },
      out:  { preset: _t7Preset(L0.out && L0.out.preset, NOVA_OUT_PRESETS, 'fade'), dur: _t7Kep(_t7Num(L0.out && L0.out.dur, 0.35), 0.15, 1.2) },
      z: ra.length + 1 };
    if (type === 'text') L.text = String(L0.text).trim().slice(0, 60);
    if (L0.shape === 'ellipse') L.shape = 'ellipse';
    ra.push(L); hop.push(hopNay);
    if (ra.length >= _T7_MAX_LAYER) break;
  }
  // Lớp nền (shape) phải nằm DƯỚI chữ, không thì che mất.
  ra.sort((a, b) => (a.type === 'shape' ? 0 : 1) - (b.type === 'shape' ? 0 : 1));
  ra.forEach((L, i) => { L.z = i + 1; });
  return ra;
}

function _t7CustomNhan(layers){
  const nT = (layers || []).filter(L => L.type === 'text').length;
  const nS = (layers || []).length - nT;
  return '✎ Tự thiết kế · ' + [nT ? nT + ' chữ' : '', nS ? nS + ' khối' : ''].filter(Boolean).join(' + ');
}

function _t7CustomSpec(){ return `
✎ CUSTOM DESIGN (use VERY SPARINGLY):
If none of the templates above fits this scene but graphics are still warranted, replace "picks" with "custom":
"custom":[
 {"type":"shape","box":{"x":6,"y":62,"w":52,"h":22},"style":{"fill":"rgba(0,0,0,.6)","radius":12},
  "at":0,"in":{"preset":"wipeL","dur":0.4},"out":{"preset":"fade","dur":0.3}},
 {"type":"text","text":"short text","box":{"x":9,"y":66,"w":46,"align":"left"},
  "style":{"size":64,"weight":800,"color":"#ffffff"},
  "at":0.15,"in":{"preset":"rise","dur":0.45},"hold":{"preset":"drift"},"out":{"preset":"fade","dur":0.3}}]
- Coordinates are % of the frame, origin at the top-left corner. Max 3 layers, NEVER let two boxes overlap.
- type may only be "text" or "shape". in/hold/out must use exact names from these lists:
  in: ${NOVA_IN_PRESETS.join(' ')}
  hold: ${NOVA_HOLD_PRESETS.join(' ')}
  out:  ${NOVA_OUT_PRESETS.join(' ')}
- Only use this when a truly custom layout is needed. If a template fits, ALWAYS use the template instead of drawing your own.`; }

function _t7AiTrQuota(n){
  return {
    _tong: Math.max(2, Math.round(n * 0.2)),   // tối đa 20% mối nối được khác cut
    'dip-white': 2, 'flash-cut': 2, 'glow-bloom': 1,
    'zoom-through': 2, 'match-zoom': 2, 'film-burn': 2, 'light-leak': 2,
    'barn-door': 1, 'shutter': 1, 'iris': 1, 'film-roll': 1,
    'paper-drop': 3, 'grain-dissolve': 3, 'defocus': 3,
    'wipe-left': 3, 'wipe-up': 3, 'push-left': 3, 'push-up': 3,
  };
}

function _t7AiTrGate(id, idx, S, cat){
  if (id === 'cut') return '';
  if (!S.cho.has(id)) return 'không có trong danh mục';
  if (S.dung >= S.quota._tong) return 'đã đủ ' + S.quota._tong + ' mối nối khác cut';
  const q = S.quota[id];
  if (q != null && (S.used[id] || 0) >= q) return 'hết trần của cú này';
  const last = S.last[id];
  if (last != null && idx - last < 4) return 'vừa dùng cách ' + (idx - last) + ' mối nối';
  if (S.lienTiep && idx - S.lienTiep < 2) return 'hai mối nối liền nhau đều có hiệu ứng';
  return '';
}

function _t7AiTrTake(id, idx, S){
  S.used[id] = (S.used[id] || 0) + 1; S.last[id] = idx; S.dung++; S.lienTiep = idx;
}

async function _t7AiTrans(clips, map, cat, onTick){
  const noi = clips.slice(0, -1);                    // clip cuối không có mối nối
  if (noi.length < 2) return [];
  const S = { quota: _t7AiTrQuota(noi.length), used: {}, last: {}, dung: 0, lienTiep: null,
              cho: new Set((cat || []).filter(x => x.id !== 'cut' && !(x.tags || []).includes('tranh')).map(x => x.id)) };
  const bang = (cat || []).filter(x => S.cho.has(x.id))
    .map(x => `${x.id} (${x.label}) — ${x.description}`).join('\n');
  const topic = String(state.videoLogline || '').trim();
  const ra = [];
  const CH = _T7_AI_CH;

  for (let i = 0; i < noi.length; i += CH){
    if (state.cancelRequested) break;
    const lot = noi.slice(i, i + CH);
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), nx = _t7ClipScene(clips[i + k + 1]);
      const mp = map[c.sceneId] || {}, mn = map[clips[i + k + 1].sceneId] || {};
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s ${mp.role || '?'} → ${mn.role || '?'}] `
        + `"${_t7Gist(sc && sc.text, 70) || '—'}" ⇒ "${_t7Gist(nx && nx.text, 70) || '—'}"`;
    }).join('\n');

    const prompt = `You are a documentary film editor. Choose the TRANSITION for each junction below.
${topic ? 'TOPIC: ' + topic + '\n' : ''}
⚠️ MOST IMPORTANT RULE: the default is a HARD CUT. A good documentary keeps about 80% of junctions
as hard cuts; every other transition is an EXCEPTION that needs a reason. For this whole batch you should
nominate at most ${Math.max(1, Math.round(lot.length * 0.2))} junctions. Omit any junction that should be a hard cut ENTIRELY from the result.

USABLE TRANSITIONS:
${bang}

WHEN TO USE:
- Chapter change, time jump, full location change → dip-black
- Shift of idea within the same thread, short time drift → dissolve
- Decisive topic change, needs a punch → whip-pan
- Cutting to archive footage / flashback → grain-dissolve, defocus, light-leak, film-burn
- Paper-cut scenes chained together → paper-slide, paper-drop
- Maps, charts, lists chained together → wipe-left, wipe-up, push-left, push-up
- Two scenes with the SAME composition → match-zoom
Do NOT use a strong transition in the middle of a continuous narrative passage.

JUNCTIONS (the number is the index within the batch):
${list}

Return a JSON array containing ONLY the junctions that need something other than a hard cut:
[{"i":0,"tr":"dip-black","why":"short Vietnamese reason, under 16 words"}]`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await _t7AiJson(prompt, { maxTokens: 1200, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('⚡ Lô chuyển cảnh lỗi: ' + String(e.message || e).slice(0, 80), 'warn'); }
    }
    if (arr == null) continue;

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + k;
      const id = String(row.tr || '').trim();
      if (_t7AiTrGate(id, idx, S, cat)) return;
      _t7AiTrTake(id, idx, S);
      const e = (cat || []).find(x => x.id === id) || {};
      ra.push({ kind: 'tr', sceneId: c.sceneId, clipId: c.id, name: _t7ClipLabel(c),
        h: _t7AiEntrySig({ kind: 'tr', sceneId: c.sceneId }, clips),   // dấu vân tay lời CẢ HAI cảnh của mối nối
        tr: id, trLabel: e.label || id, trDur: Number(e.durationSec) || 0.5,
        line: _t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 90) || '(không lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do.', state: '', picks: [], custom: [] });
    });
    if (onTick) onTick(Math.min(i + CH, noi.length), noi.length, ra.length);
  }
  return ra;
}

function _t7AiRender(){
  const box = document.getElementById('t7AiProps'); if (!box) return;
  if (!_t7AiQ.length && !_t7AiHong.length){
    box.innerHTML = '<div class="t7-empty">Trợ lý không đề xuất gì thêm — các cảnh đang ổn.</div>';
    _t7AiTally(); return;
  }
  // VẺ THEO HAI NHÓM: đề xuất đang chờ + đã duyệt ở trên, những mục bị soi khung/tự kiểm loại
  // gom xuống cuối thành nhóm "Đã tự loại (n)" kèm LÝ DO và nút ↩ dùng lại (#6). Trước đây chúng
  // bị xoá lặng lẽ nên "không còn gì để duyệt" nhìn giống hệt "trợ lý đã loại 5 đề xuất".
  // i là chỉ số TRONG _t7AiQ ở cả hai nhóm — mọi handler vẫn nhận đúng thứ tự hàng đợi.
  const dong = (q, i) => {
    // Mục bị loại: giữ nguyên trong hàng đợi với state='dr' → persistence miễn phí theo video.
    if (q.state === 'dr') return `<div class="drow dr">
      <span class="sc">${escapeHtml(q.name)}${q.kind === 'tr' ? ' →' : ''}</span>
      <span class="msg">${escapeHtml(q.drop || 'Đã tự loại')}</span>
      <button class="rst" onclick="t7AiRestore(${i})" title="Trả đề xuất này về hàng đợi chờ duyệt">↩ Dùng lại</button></div>`;
    // Đã quyết định thì gập lại một dòng — khỏi chiếm chỗ của những cảnh còn phải xem.
    if (q.state) return `<div class="drow ${q.state === 'ap' ? 'ap' : 'sk'}">
      <span class="sc">${escapeHtml(q.name)}${q.kind === 'tr' ? ' →' : ''}</span>
      <span class="msg">${q.state === 'ap' ? '✓ Đã gắn · ' + escapeHtml(q.kind === 'tr' ? q.trLabel : q.tplLabel) : 'Đã bỏ qua'}</span></div>`;
    // Mối nối là chỗ GIỮA hai cảnh, không có khung hình riêng để xem trước → thẻ gọn.
    if (q.kind === 'tr') return `<div class="pr trrow" data-i="${i}">
      <div class="prb">
        <div class="prh"><span class="sc">${escapeHtml(q.name)} → cảnh sau</span>
          <span class="tpl">⚡ ${escapeHtml(q.trLabel)}</span></div>
        <p class="prq">“${escapeHtml(q.line)}”</p>
        <p class="why">${escapeHtml(q.why)}</p>
        <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn chuyển cảnh</button>
          <button onclick="t7AiDecide(${i},false)">Cắt thẳng</button></div>
      </div></div>`;
    const cl = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const nen = cl ? (_t7ThumbImg(cl) || '') : '';
    return `<div class="pr" data-i="${i}">
    <div class="prev" data-i="${i}" data-mode="sau" onclick="t7AiTry(${i})" title="Bấm để xem cảnh này trên khung lớn"${nen ? ` style="background-image:url('${escapeHtml(nen)}')"` : ''}>
      <div class="pv"></div>
      ${nen ? '' : '<div class="nohint">cảnh chưa có hình — chỉ xem được lớp đồ hoạ</div>'}
      <div class="ab"><button data-m="sau" class="on" onclick="t7AiPvMode(${i},'sau',event)">Sau</button><button data-m="truoc" onclick="t7AiPvMode(${i},'truoc',event)">Trước</button></div>
      <button class="play" onclick="t7AiPvPlay(${i},event)">▶ Xem chuyển động</button>
    </div>
    <div class="prb">
      <div class="prh"><span class="sc">${escapeHtml(q.name)}${q.role ? ' · ' + escapeHtml(q.role) : ''}</span><span class="tpl">${escapeHtml(q.tplLabel)}</span></div>
      <p class="prq">“${escapeHtml(q.line)}”</p>
      <p class="why">${escapeHtml(q.why)}</p>
      <div class="pra"><button class="yes" onclick="t7AiDecide(${i},true)">Gắn vào cảnh</button>
        <button onclick="t7AiDecide(${i},false)">Bỏ qua</button>
        <button class="edbtn" onclick="t7AiEditToggle(${i},event)" title="Sửa chữ, vị trí, cỡ, màu của hiệu ứng này">⚙ Chỉnh</button>
        <button class="rgbtn" onclick="t7AiRegen(${i})" title="Hỏi trợ lý lại RIÊNG cảnh này rồi thay thẻ này — không đụng các cảnh khác">↻ Tạo lại</button></div>
    </div>
  </div>`;
  };
  const chinh = [], loai = [];
  _t7AiQ.forEach((q, i) => (q.state === 'dr' ? loai : chinh).push(dong(q, i)));
  box.innerHTML = chinh.join('')
  + (loai.length ? `<div class="grp">🚫 Đã tự loại (${loai.length}) — bấm ↩ nếu muốn dùng lại</div>` + loai.join('') : '')
  // Những cảnh lô AI làm hỏng (#4): chỉ một dòng + một nút gộp, vì thử lại từng cảnh lẻ = nhiều
  // lượt gọi, trong khi lỗi kiểu này thường do mạng/API → thử cả nhóm một lần là đủ.
  + (_t7AiHong.length ? `<div class="miss">
      <div class="missh">⚠️ ${_t7AiHong.length} cảnh không lấy được đề xuất (lô AI hỏng)</div>
      <div class="missl">${_t7AiHong.slice(0, 12).map(h => escapeHtml(h.name || String(h.sceneId))).join(' · ')}</div>
      <button onclick="t7AiRetryFailed()">↻ Thử lại ${_t7AiHong.length} cảnh này</button></div>` : '');
  _t7AiTally();
  _t7AiPvHook();
}

function _t7TplTextKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.find(p => _T7_TXT_KEYS.includes(p)) || '') : '';
}

function _t7TplPosKey(cat, tpl){
  const e = cat.find(c => c.template === tpl);
  return e ? (e.params.includes('position') ? 'position' : (e.params.includes('pos') ? 'pos' : '')) : '';
}

// Tập hợp mẫu ambient / mẫu không-chữ đọc từ SIÊU DỮ DỤNG danh mục (#8) — không còn phải
// bảo trì ba mảng _T7_AMBIENT/_T7_NOTEXT/_T7_CAM rỗng ở renderer. Gọi một lần mỗi lượt phân tích.
function _t7AiPolicy(cat){
  const a = new Set(), t = new Set();
  (cat || []).forEach(c => {
    if (c.ambient) a.add(c.template);
    if (!_t7TplTextKey(cat, c.template)) t.add(c.template);
  });
  return { amb: a, noText: t };
}

// Dựng lại TRẠNG THÁI hạn ngạch từ những gì ĐÃ THỰC SỰ nằm trong video (state.sceneSpecs),
// thay vì bắt đầu từ 0. Nếu không, mỗi lần "Tạo lại cảnh này" hay "Phân tích lại" một phần là
// trần chữ / trần lớp không khí của cả video bị tính lại từ đầu → video vẫn phình chữ.
// n = số cảnh dùng làm mẫu số cho trần tỉ lệ.
function _t7AiSeed(cat, clips, specs, n){
  const p = _t7AiPolicy(cat);
  const S = { quota: _t7AiQuota(n, cat), used: {}, last: {}, amb: p.amb, ambN: 0, noText: p.noText, txt: 0 };
  (clips || []).forEach((c, idx) => {
    const sp = (specs || {})[c.sceneId];
    if (!sp || !Array.isArray(sp.layers)) return;
    let coChu = false;
    sp.layers.forEach(L => {
      if (!L || L.type === 'backdrop') return;
      if (L.template){
        S.used[L.template] = (S.used[L.template] || 0) + 1;
        S.last[L.template] = idx;
        if (p.amb.has(L.template)) S.ambN++;
        if (_t7TplTextKey(cat, L.template)) coChu = true;
      } else if (L.type === 'text'){ coChu = true; }      // lớp chữ tự thiết kế cũng chiếm trần chữ
    });
    if (coChu) S.txt++;
  });
  return S;
}

function _t7AiQuota(n, cat){
  // Trần theo TỪNG mẫu nằm trong metadata danh mục (maxUse). Thêm mẫu mới → khai maxUse ở
  // templates.js, không phải sửa renderer.
  const q = {
    _ambient: Math.max(3, Math.ceil(n * 0.18)),
    _text: Math.max(3, Math.round(n * 0.12)),   // trần số cảnh ĐƯỢC đặt chữ
  };
  (cat || []).forEach(c => { if (c.maxUse != null) q[c.template] = Number(c.maxUse); });
  return q;
}

function _t7AiGate(tpl, idx, S, cat){
  const q = S.quota;
  // Cần toạ độ vật thể mà model không nhìn thấy khung hình → khoanh bừa. Chặn hẳn.
  if (_T7_CAM.includes(tpl)) return 'mẫu cần toạ độ, model không thấy khung hình';
  if (q[tpl] != null && (S.used[tpl] || 0) >= q[tpl]) return 'hết hạn ngạch mẫu này';
  const isAmb = S.amb ? S.amb.has(tpl) : _T7_AMBIENT.includes(tpl);
  if (isAmb && S.ambN >= q._ambient) return 'đủ lớp không khí cho cả video';
  if (_t7TplTextKey(cat, tpl) && S.txt >= q._text) return 'đã quá nhiều cảnh có chữ';
  const last = S.last[tpl];
  if (last != null && idx - last < 3) return 'vừa dùng cách đây ' + (idx - last) + ' cảnh';
  return '';
}

function _t7AiTake(tpl, idx, S, cat){
  S.used[tpl] = (S.used[tpl] || 0) + 1; S.last[tpl] = idx;
  const isAmb = S.amb ? S.amb.has(tpl) : _T7_AMBIENT.includes(tpl);
  if (isAmb) S.ambN++;
  if (_t7TplTextKey(cat, tpl)) S.txt++;
}

function _t7AiQuotaLine(S){
  const q = S.quota, out = [];
  Object.keys(q).forEach(k => {
    if (k[0] === '_') return;
    const con = q[k] - (S.used[k] || 0);
    if (con <= 0) out.push(`${k}: EXHAUSTED, do not use`);
  });
  const ambCon = q._ambient - S.ambN, txtCon = q._text - S.txt;
  out.push(`ambient layers: ${Math.max(0, ambCon)} remaining`);
  out.push(`${Math.max(0, txtCon)} scenes still allowed to carry text`);
  const ktu = S.noText ? Object.keys(S.used).filter(k => S.noText.has(k)) : _T7_NOTEXT;
  const kchu = ktu.reduce((a2, k) => a2 + (S.used[k] || 0), 0);
  out.push(`used ${S.txt} text templates and ${kchu} no-text templates` +
    (S.txt >= 3 && kchu === 0 ? ' → HEAVILY SKEWED TOWARD TEXT, prioritize no-text templates in this batch' : ''));
  return out.join(' · ');
}

async function _t7AiMap(clips, onTick){
  if (!state.aiMap) state.aiMap = {};
  const map = state.aiMap;                       // kho của DỰ ÁN, không phải biến tạm
  const CH = _T7_AI_MAP_CH;                           // bản đồ cần nhìn cả video để chấm đúng nhịp nhấn
  const topic = String(state.videoLogline || '').trim();
  // Chỉ đọc cảnh CHƯA có trong bản đồ hoặc đã bị sửa lời. Mở lại video cũ → 0 lượt gọi.
  const can = clips.filter(c => {
    const sc = _t7ClipScene(c), h = _t7AiSig(sc && sc.text);
    const cu = map[c.sceneId];
    return !(cu && cu.h === h);
  });
  if (!can.length){ if (onTick) onTick(clips.length, clips.length, 0); return map; }
  clips = can;
  for (let i = 0; i < clips.length; i += CH){
    if (state.cancelRequested) break;
    const lot = clips.slice(i, i + CH);
    const list = lot.map((c, k) => `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 120) || '(không lời)'}`).join('\n');
    const prompt = `You are a video editor. Read the ENTIRE script segment below, then score each scene.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}
For EACH scene return:
- role: exactly one of mo-dau | dan-dat | so-lieu | trich-dan | chuyen-y | chot
- key: the specific person / organization / place name appearing in the line ("")
- num: a number worth showing on screen in the line, kept as written ("")
- emp: 0-3 — how much it deserves a graphics emphasis. 0 = connective sentence, 3 = closing/shocking line.
The whole video should have only a few emp=3 scenes. Do not grade generously.

SCENES:
${list}

Return a JSON array with all ${lot.length} elements: [{"i":0,"role":"mo-dau","key":"","num":"","emp":2}]`;
    let arr = [];
    try { arr = await _t7AiJson(prompt, { maxTokens: 2600, validate: (d) => Array.isArray(d) }); }
    catch (e){ novaLog && novaLog(`✨ Bản đồ cảnh ${i + 1}–${i + lot.length} lỗi: ${String(e.message || e).slice(0, 80)}`, 'warn'); }
    arr.forEach(r => {
      const k = Number(r && r.i); const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const sc = _t7ClipScene(c);
      map[c.sceneId] = { role: String(r.role || '').slice(0, 12), key: String(r.key || '').slice(0, 40),
        num: String(r.num || '').slice(0, 24), emp: Math.max(0, Math.min(3, Number(r.emp) || 0)),
        h: _t7AiSig(sc && sc.text) };
    });
    if (onTick) onTick(Math.min(i + CH, clips.length), clips.length, clips.length);
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // bản đồ là thứ đắt nhất, lưu ngay
  return map;
}

// Áp kết quả soi khung hình vào đề xuất. Tách ra để cả kết quả MỚI và kết quả CACHE cùng đi
// qua một đường, không phân nhánh logic (cache chỉ tiết kiệm lượt gọi, không đổi cách áp dụng).
function _t7AiVisApply(r, q, pk, tk, posKey){
  if (r.ok === false){
    q.drop = 'Khung hình không còn chỗ đặt chữ' + (r.why ? ' — ' + String(r.why).slice(0, 70) : '');
    return;
  }
  if (posKey && _T7_POS.includes(String(r.pos))) pk[posKey] = String(r.pos);
  const t2 = String(r.text || '').trim();
  if (t2 && t2 !== pk[tk]){ pk[tk] = t2.slice(0, 70); }
  if (String(q.why || '').indexOf('· Đã soi khung:') < 0)
    q.why += ' · Đã soi khung: đặt ' + (posKey ? (pk[posKey] || 'mặc định') : 'vị trí mẫu') + '.';
}

async function _t7AiVision(cat, onTick){
  const jobs = [];
  _t7AiQ.forEach((q, i) => {
    if (q.kind === 'tr') return;
    const coChu = (q.custom && q.custom.length) ? q.custom.some(L => L.type === 'text')
                                                : q.picks.some(p => _t7TplTextKey(cat, p.template));
    if (coChu) jobs.push(i);
  });
  let done = 0, doi = 0;
  const one = async (qi) => {
    const q = _t7AiQ[qi]; if (!q || q.state) return;
    const clip = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const img = clip ? _t7ThumbImg(clip) : null;
    if (!img){ doi++; return; }
    let b64 = '', mime = 'image/jpeg';
    try {
      const durl = await _t7ImgToDataUrl(img);
      const m = /^data:([^;,]+);base64,(.+)$/.exec(String(durl || ''));
      if (!m){ doi++; return; }
      mime = m[1]; b64 = m[2];
    } catch (e){ doi++; return; }
    // Mẫu tự sinh: chữ nằm ngay ở L.text, vị trí là hộp x/y nên không đổi theo "góc".
    const tuVe = !!(q.custom && q.custom.length);
    const pk = tuVe ? q.custom.find(L => L.type === 'text') : q.picks.find(p => _t7TplTextKey(cat, p.template));
    if (!pk){ doi++; return; }
    const tk = tuVe ? 'text' : _t7TplTextKey(cat, pk.template);
    const posKey = tuVe ? '' : _t7TplPosKey(cat, pk.template);
    const prompt = `This is the REAL frame of a video scene. We plan to overlay this text on it: "${String(pk[tk] || '').slice(0, 60)}" (template: ${tuVe ? 'custom design' : pk.template}).

Return JSON: {"ok":true/false,"pos":"corner","text":"edited text if needed","why":"one short Vietnamese sentence"}
- ok=false IF: the frame already has text/logo, or is too busy, or the subject fills nearly the whole frame so any text would cover faces.
- pos: pick from ${_T7_POS.join(' | ')} — the EMPTIEST area, avoiding faces and key objects.
- text: keep unchanged if fine; shorten to under 6 words if long; "" if ok=false.
  Write it in EXACTLY ${_t7AiLang()} — the same language as the script, do not translate to Vietnamese.
Print ONLY the JSON.`;
    // Cache theo vân tay(ảnh)+vân tay(câu hỏi): cùng khung hình + cùng chữ định đặt → trả lời
    // như cũ, khỏi trả credit lần hai khi "Phân tích lại" hoặc khi cảnh khác trùng khung.
    const vkey = _t7AiSig(b64) + '|' + _t7AiSig(prompt);
    if (_t7AiVis.has(vkey)){ _t7AiVisApply(_t7AiVis.get(vkey), q, pk, tk, posKey); return; }
    let r = null;
    try {
      r = await _t7AiJson(prompt, { maxTokens: 300, tries: 2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: prompt } ] }],
        validate: (d) => d && typeof d === 'object' && !Array.isArray(d) });
    } catch (e){ doi++; return; }
    if (!r) { doi++; return; }
    if (_t7AiVis.size > 400) _t7AiVis.clear();     // ảnh băm cả video → chặn phình vô hạn khi soi nhiều lượt
    _t7AiVis.set(vkey, r);
    _t7AiVisApply(r, q, pk, tk, posKey);
  };
  // Vài luồng song song — nhanh gấp mấy lần chạy tuần tự mà không dội request.
  const pool = _T7_AI_POOL; let cur = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (cur < jobs.length && !state.cancelRequested){
      const qi = jobs[cur++];
      await one(qi);
      done++; if (onTick) onTick(done, jobs.length);
    }
  }));
  return { xong: done, doi };
}

async function _t7AiCritic(cat){
  const live = _t7AiQ.map((q, i) => ({ q, i })).filter(x => !x.q.drop && x.q.kind !== 'tr');
  if (live.length < 4) return 0;
  const list = live.map((x, k) => {
    if (x.q.custom && x.q.custom.length){
      const t = (x.q.custom.find(L => L.type === 'text') || {}).text || '';
      return `${k}. ${x.q.name} · tự thiết kế (${x.q.custom.length} lớp) · "${String(t).slice(0, 40)}"`;
    }
    const tk = _t7TplTextKey(cat, x.q.picks[0].template);
    return `${k}. ${x.q.name} · ${x.q.picks.map(p => p.template).join('+')} · "${String((tk && x.q.picks[0][tk]) || '').slice(0, 40)}"`;
  }).join('\n');
  const prompt = `This is the ENTIRE graphics plan of a video. Review it like a demanding editor.

Point out ONLY the items that should be DROPPED because: they duplicate the adjacent item, repeat the same text, put text on a scene that doesn't deserve it, or a whole cluster is too dense and clutters the video.
Do not drop more than 20% of the items. If the plan is already fine, return an empty array.

PLAN:
${list}

Return JSON: [{"k":3,"why":"short Vietnamese reason, under 15 words"}]`;
  let arr = [];
  try { arr = await _t7AiJson(prompt, { maxTokens: 900, validate: (d) => Array.isArray(d) }); }
  catch (e){ return 0; }
  let n = 0;
  const tran = Math.ceil(live.length * 0.2);
  arr.slice(0, tran).forEach(r => {
    const k = Number(r && r.k); const x = live[Number.isFinite(k) ? k : -1]; if (!x) return;
    x.q.drop = 'Tự kiểm loại: ' + (String(r.why || '').slice(0, 70) || 'trùng ý với cảnh bên cạnh'); n++;
  });
  return n;
}
