/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ TRẠNG THÁI BẬT/TẮT ══════════════════════════════════════════════════════
   Mặc định bật đúng nhóm tư liệu công — nhóm duy nhất không có rủi ro bản
   quyền. Muốn bật báo đài / mạng xã hội thì tự vào bảng tick, để việc đó là
   một lựa chọn có ý thức chứ không phải mặc định lặng lẽ.                    */
const _WEB_MAC_DINH = NOVA_WEB_NEN_TANG.filter((p) => p.nhom === 'cong').map((p) => p.id);

function _webBat() {
  // `state` khai báo bằng const trong index.html → nằm ở global lexical
  // environment, KHÔNG lên window. Hỏi window.state là luôn undefined và cả bộ
  // bật/tắt câm lặng — phải hỏi bằng tên trần.
  if (typeof state === 'undefined' || !state) return {};
  if (!state.webBat || typeof state.webBat !== 'object') {
    state.webBat = {};
    _WEB_MAC_DINH.forEach((id) => { state.webBat[id] = true; });
  }
  return state.webBat;
}
function _webDangBat() {
  const b = _webBat();
  return NOVA_WEB_NEN_TANG.filter((p) => b[p.id]);
}
function webToggle(id) {
  const b = _webBat();
  b[id] = !b[id];
  webRenderBang();
  try { if (typeof t2RenderNguon === 'function') t2RenderNguon(); } catch (_) {}
  try { if (typeof saveState === 'function') saveState(); } catch (_) {}
}
function webToggleNhom(nhom, bat) {
  const b = _webBat();
  NOVA_WEB_NEN_TANG.filter((p) => p.nhom === nhom).forEach((p) => { b[p.id] = !!bat; });
  webRenderBang();
  try { if (typeof t2RenderNguon === 'function') t2RenderNguon(); } catch (_) {}
  try { if (typeof saveState === 'function') saveState(); } catch (_) {}
}

/* ══ BẢNG CHỌN NỀN TẢNG ══════════════════════════════════════════════════════ */
function webMoBang() {
  let m = document.getElementById('webBangModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'webBangModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:22px';
    m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    document.body.appendChild(m);
  }
  m.style.display = 'flex';
  webRenderBang();
}
function webDongBang() {
  const m = document.getElementById('webBangModal');
  if (m) m.style.display = 'none';
}

/* Khoá của ba kho ảnh nằm bên index.html. Gọi bằng tên trần vì chúng khai báo
   bằng function/const ở top-level script → không lên window.               */
function _webCoKhoaKho(id) {
  try {
    if (id === 'pexels')   return typeof getPexelsKey === 'function' && !!getPexelsKey();
    if (id === 'pixabay')  return typeof getPixabayKey === 'function' && !!getPixabayKey();
    if (id === 'unsplash') return typeof getUnsplashKey === 'function' && !!getUnsplashKey();
  } catch (_) {}
  return true;
}
/* ══ KIỂM TRA NỀN TẢNG ════════════════════════════════════════════════════
   Vạch màu chỉ nói nền tảng CÓ API hay không — là dự đoán. Cái người dùng cần
   biết là nó CÓ RA KẾT QUẢ KHÔNG. Nên chạy thử một truy vấn qua từng nền tảng
   rồi ghi lại. Kết quả nằm trong state.webTT nên mở bảng lần sau không phải
   kiểm lại.
     ok  = ra ≥1 ứng viên
     ko  = chạy được nhưng không ra gì (hoặc lỗi)
     khoa = thiếu khoá API, chưa kiểm được
   Truy vấn thử cố tình dùng từ phổ thông: nền tảng nào cũng phải có mới đúng
   là "chạy được".                                                            */
/* Mỗi nền tảng một truy vấn thử RIÊNG, hợp với thứ nó thật sự có. Thử C-SPAN
   bằng "city street" thì đương nhiên trắng tay — nó là kho phiên điều trần
   Quốc hội. Bộ truy vấn này lấy từ registry của test tool.                   */
const _WEB_THU_Q = 'city street';
const _webThuQ = (p) => String((p && p.thuQ) || _WEB_THU_Q);
let _webDangKiem = false;
let _webCanhBao = '';   // lời nhắc hiện ở đầu bảng khi kiểm bị chặn

function _webTT() {
  if (typeof state === 'undefined' || !state) return {};
  if (!state.webTT || typeof state.webTT !== 'object') state.webTT = {};
  return state.webTT;
}

/* Kiểm MỘT nền tảng. Trả {tt, so, loi}. Không ném lỗi ra ngoài. */
async function _webKiemMot(p) {
  try {
    if (p.canKhoa && !_webCoKhoaKho(p.id)) return { tt: 'khoa', so: 0, loi: 'chưa cắm khoá API' };
    // Nền tảng do máy stock/kho/yt lo → hỏi thẳng máy đó.
    /* Các hàm tìm nằm bên index.html, khai báo bằng `async function` ở top-level
       của script thường → CÓ lên window (khác const/let). Gọi qua window là đủ. */
    if (p.may === 'stock' || p.may === 'kho') {
      const ten = { pexels: 'searchPexels', pixabay: 'searchPixabay', unsplash: 'searchUnsplash',
                    wikimedia: '_khoWikimedia', nasa: '_khoNasa',
                    openverse: '_khoOpenverse', archive_org: '_khoArchive' }[p.id];
      const fn = ten && window[ten];
      if (typeof fn !== 'function') return { tt: 'ko', so: 0, loi: 'chưa nạp được hàm tìm' };
      // searchPexels/... nhận (q, type) trả {photos,videos}; _kho... nhận (q, n) trả mảng.
      const r = (p.may === 'stock') ? await fn(_webThuQ(p), 'both') : await fn(_webThuQ(p), 4);
      const so = Array.isArray(r)
        ? r.filter(Boolean).length
        : ((r && r.photos) || []).length + ((r && r.videos) || []).length;
      if (so) return { tt: 'ok', so };
      /* Archive.org có HAI đường: ảnh qua _khoArchive, video qua _WEB_API.archive.
         Đường này rỗng thì thử đường kia trước khi kết luận là hỏng.          */
      if (p.api && _WEB_API[p.api]) {
        try {
          const r2 = await _WEB_API[p.api](_webThuQ(p), 4);
          if ((r2 || []).length) return { tt: 'ok', so: r2.length };
        } catch (_) {}
      }
      const e = r && r._err;
      return { tt: 'ko', so: 0, loi: (Array.isArray(e) ? e[0] : e) || 'không ra kết quả' };
    }
    // Còn lại: đúng đường mà lúc chạy thật sẽ đi.
    let ra;
    if (p.api && _WEB_API[p.api]) ra = await _WEB_API[p.api](_webThuQ(p), 4);
    else ra = await _webTimQuaCongCu(p.id, _webThuQ(p), 4);
    const so = (ra || []).length;
    return so ? { tt: 'ok', so } : { tt: 'ko', so: 0, loi: 'không ra kết quả' };
  } catch (e) {
    return { tt: 'ko', so: 0, loi: String((e && e.message) || e).slice(0, 60) };
  }
}

/* Máy tìm chết thì MỌI nền tảng nhóm ○ đều trắng tay, và bảng sẽ đỏ oan hàng
   loạt. Đã gặp thật: SearXNG chạy tốt, thử nặng một lúc rồi trả 0 kết quả cho
   cả "city street" — engine thượng nguồn chặn nhịp. Nên hỏi một câu đối chứng
   trước; máy tìm câm thì báo thẳng chứ đừng đổ tội cho nền tảng.             */
async function _webMayTimCon() {
  const K = _webKey();
  if (!(K.key && K.may === 'brave') && !(K.may === 'searxng' && K.base)) return { con: true, vi: 'không dùng khoá' };
  try {
    const r = (K.may === 'brave')
      ? await _webBrave('city street', 5, K.key)
      : await _webSearxng('city street', 5, K.base, K.key);
    return (r || []).length ? { con: true } : { con: false, vi: 'trả 0 kết quả cho câu đối chứng' };
  } catch (e) {
    return { con: false, vi: String((e && e.message) || e).slice(0, 60) };
  }
}

async function webKiemTra() {
  if (_webDangKiem) { _webDangKiem = false; return; }          // bấm lần hai = dừng
  const b = _webBat();
  const ds = NOVA_WEB_NEN_TANG.filter((x) => b[x.id]);
  if (!ds.length) return;
  const tt = _webTT();

  // Có nền tảng nào phải nhờ máy tìm không? Có thì kiểm máy tìm trước.
  if (ds.some((x) => !x.api && !x.may && !x.timTrang)) {
    _webCanhBao = 'Đang thử máy tìm…';
    webRenderBang();
    const m = await _webMayTimCon();
    if (!m.con) {
      _webCanhBao = 'Máy tìm đang không trả kết quả (' + m.vi + '). Nếu kiểm lúc này thì nhóm ○ sẽ đỏ OAN — nghỉ vài phút rồi bấm lại, hoặc đổi sang khoá Brave.';
      webRenderBang();
      return;
    }
    _webCanhBao = '';
  }
  _webDangKiem = true;
  ds.forEach((x) => { tt[x.id] = Object.assign({}, tt[x.id], { dangChay: true }); });
  webRenderBang();

  // Dùng đúng số luồng người dùng đặt ở Tool 2; phanh nhịp đã nối đuôi riêng.
  const N = (typeof _t2SoLuong === 'function') ? _t2SoLuong() : 3;
  let ke = 0;
  const chay = async () => {
    while (_webDangKiem) {
      const i = ke++;
      if (i >= ds.length) return;
      const p = ds[i];
      const r = await _webKiemMot(p);
      tt[p.id] = { tt: r.tt, so: r.so || 0, loi: r.loi || '', luc: _webGio() };
      webRenderBang();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(N, ds.length)) }, chay));
  ds.forEach((x) => { if (tt[x.id] && tt[x.id].dangChay) delete tt[x.id].dangChay; });
  _webDangKiem = false;
  try { if (typeof saveState === 'function') saveState(); } catch (_) {}
  webRenderBang();
}

/* Date.now() gói riêng cho dễ đọc — chỉ dùng để hiện "kiểm lúc mấy giờ". */
function _webGio() { return Date.now(); }
function _webGioChu(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  const nay = new Date(); const cungNgay = d.toDateString() === nay.toDateString();
  return cungNgay ? `${hh}:${mm}` : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hh}:${mm}`;
}

let _webMoCauHinh = false;                 // giữ trạng thái mở/đóng của ngăn khoá
function webToggleCauHinh(){ _webMoCauHinh = !_webMoCauHinh; webRenderBang(); }

function webRenderBang() {
  const m = document.getElementById('webBangModal');
  if (!m || m.style.display === 'none') return;
  const b = _webBat();
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
  const tt = _webTT();

  /* Thiết kế lại: bản cũ vẽ 55 ô đều nhau, ô nào cũng có viền màu + ba ký hiệu
     (☑ ● 🔑) đứng trước tên → mắt không biết nhìn đâu trước. Nay:
       · TRẠNG THÁI đọc bằng NỀN, không bằng viền — bật thì có nền, tắt thì phẳng.
       · BẬC nguồn (●◐○) thành VẠCH MÀU bên trái, đọc lướt được cả cột.
       · 🔑 chỉ hiện khi THIẾU khoá; đủ khoá thì im, đỡ một ký hiệu thừa.
       · Ngăn cấu hình khoá tìm kiếm gập lại — nó là thiết lập phụ, không phải
         thứ cần chiếm chỗ ngay dưới tiêu đề mỗi lần mở bảng.                 */
  const nhomHtml = ['kho', 'cong', 'bao', 'xh'].map((nh) => {
    const meta = _WEB_NHOM[nh];
    const ds = NOVA_WEB_NEN_TANG.filter((p) => p.nhom === nh);
    const soBat = ds.filter((p) => b[p.id]).length;
    const o = ds.map((p) => {
      const on = !!b[p.id];
      const s = tt[p.id] || {};
      /* Chấm nói TÌNH TRẠNG ĐÃ ĐO, không phải dự đoán:
           xanh lá = thử ra kết quả · cam = thiếu khoá API
           đỏ = thử rồi, không ra gì · rỗng = chưa kiểm
         Bậc nguồn (có API riêng hay phải nhờ công cụ tìm) lùi vào tooltip.  */
      const bac = (p.api || p.may) ? 'có API tìm riêng'
                : (p.timTrang ? 'đọc được ô tìm của trang' : 'phải nhờ công cụ tìm kiếm');
      const D = s.dangChay
        ? { m: 'var(--teal)', v: '', n: 'đang kiểm…' }
        : (s.tt === 'ok'   ? { m: 'var(--green)', v: '', n: `chạy tốt — ra ${s.so} ứng viên lúc ${_webGioChu(s.luc)}` }
        : (s.tt === 'khoa' ? { m: 'var(--amber)', v: '', n: 'cần cắm khoá API — Cài đặt → Tìm Media' }
        : (s.tt === 'ko'   ? { m: 'var(--red)',   v: '', n: `không ra kết quả lúc ${_webGioChu(s.luc)}${s.loi ? ' — ' + s.loi : ''}` }
                           : { m: 'transparent', v: '1.5px solid var(--border-bright)', n: 'chưa kiểm' })));
      return `<button type="button" onclick="webToggle('${p.id}')"
        title="${esc(p.ten)} · ${esc(p.site)}\n${D.n}\n${bac}"
        onmouseover="this.style.background='var(--surface-3)'"
        onmouseout="this.style.background='${on ? 'var(--surface-3)' : 'transparent'}'"
        style="display:flex;align-items:center;gap:8px;text-align:left;
          border:0;border-radius:7px;padding:8px 10px;font-size:12px;font-family:inherit;
          font-weight:${on ? '650' : '500'};cursor:pointer;transition:background .12s;
          background:${on ? 'var(--surface-3)' : 'transparent'};
          color:${on ? 'var(--text)' : 'var(--text-dim)'}">
        <span style="width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:${D.m};${D.v ? 'border:' + D.v + ';' : ''}${s.dangChay ? 'animation:webNhay 1s infinite;' : ''}"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.ten)}</span>
        ${s.tt === 'khoa' ? '<span style="font-size:9.5px;color:var(--text-dim);font-weight:600">khoá</span>' : ''}
      </button>`;
    }).join('');
    const day = soBat === ds.length, rong = soBat === 0;
    return `<section style="margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:9px;padding:6px 4px 7px;border-bottom:1px solid var(--border)">
        <span style="font-size:13px">${meta.icon}</span>
        <span style="font-weight:700;font-size:12.5px;color:${meta.mau}">${meta.ten}</span>
        <span style="font-size:10.5px;color:var(--text-dim);font-variant-numeric:tabular-nums">${soBat}/${ds.length}</span>
        <span style="flex:1"></span>
        <button type="button" onclick="webToggleNhom('${nh}',${day ? 'false' : 'true'})"
          style="border:0;background:transparent;font-family:inherit;font-size:10.5px;font-weight:650;
            cursor:pointer;padding:2px 4px;color:${rong || !day ? 'var(--accent)' : 'var(--text-dim)'}">
          ${day ? 'Tắt hết' : 'Bật hết'}</button>
      </div>
      ${meta.mo ? `<div style="font-size:10.5px;color:var(--text-dim);margin:6px 10px 2px;line-height:1.55">${esc(meta.mo)}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:3px;padding:6px 2px 12px">${o}</div>
    </section>`;
  }).join('');

  const dsBat = NOVA_WEB_NEN_TANG.filter((p) => b[p.id]);
  const tongBat = dsBat.length;
  const dem = (k) => dsBat.filter((p) => (tt[p.id] || {}).tt === k).length;
  const soOk = dem('ok'), soKhoa = dem('khoa'), soKo = dem('ko');
  const soChua = tongBat - soOk - soKhoa - soKo;
  const lucCuoi = Math.max(0, ...dsBat.map((p) => (tt[p.id] || {}).luc || 0));
  // Cảnh báo khoá chỉ còn ý nghĩa với nền tảng PHẢI nhờ công cụ tìm.
  const batPhaiTim = dsBat.filter((p) => !p.api && !p.may && !p.timTrang).length;
  const K = _webKey();
  const coKhoa = !!(K.key || (K.may === 'searxng' && K.base));
  const canChuY = batPhaiTim && !coKhoa;
  if (canChuY && !_webMoCauHinh && !document.getElementById('webMay')) _webMoCauHinh = true;   // có vấn đề thì mở sẵn
  // Đọc lựa chọn ĐANG hiện trên màn hình chứ không chỉ cái đã lưu.
  const elMay = document.getElementById('webMay');
  const mayNay = elMay ? elMay.value : K.may;
  const elBase = document.getElementById('webBase');
  const baseNay = elBase ? elBase.value : K.base;
  const elKey = document.getElementById('webKey');
  const keyNay = elKey ? elKey.value : K.key;

  const oCss = 'background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:6px 9px;font-size:11.5px';
  const cauHinh = !_webMoCauHinh ? '' : `
    <div style="display:flex;gap:6px;align-items:center;margin-top:9px;flex-wrap:wrap;padding:10px;border-radius:9px;background:var(--surface-2)">
      <select id="webMay" onchange="webRenderBang()" style="${oCss};font-family:inherit">
        <option value=""${!mayNay ? ' selected' : ''}>Không dùng khoá</option>
        <option value="brave"${mayNay === 'brave' ? ' selected' : ''}>Brave Search API</option>
        <option value="searxng"${mayNay === 'searxng' ? ' selected' : ''}>SearXNG</option>
      </select>
      ${mayNay === 'searxng'
        ? `<input id="webBase" value="${esc(baseNay)}" placeholder="https://searxng-tu-dung-cua-ban" title="Máy chủ SearXNG có bật định dạng JSON. Máy chủ công cộng hầu hết tắt JSON hoặc chặn nhịp — đã đo 11 cái, không cái nào dùng được." style="${oCss};width:210px">` : ''}
      <input id="webKey" type="password" value="${esc(keyNay)}" placeholder="${mayNay === 'searxng' ? 'Khoá (bỏ trống nếu máy chủ không đòi)' : 'Khoá API'}" style="${oCss};width:190px">
      <button class="btn ghost sm" style="font-size:11px;padding:5px 10px" onclick="webLuuKey(document.getElementById('webMay').value,document.getElementById('webKey').value,(document.getElementById('webBase')||{}).value||'')">Lưu</button>
      <button class="btn ghost sm" id="webThuBtn" style="font-size:11px;padding:5px 10px;border-color:var(--accent);color:var(--accent)" onclick="webThuKey()" title="Gửi một truy vấn thử có site: để xem khoá chạy không, và máy tìm có tôn trọng bộ lọc site: không">⚡ Thử</button>
      <div id="webThuKQ" style="flex:1 0 100%;font-size:10.5px;margin-top:3px;line-height:1.5"></div>
    </div>`;

  const oCham = (mau, vien, so) =>
    `<span style="display:inline-flex;align-items:center;gap:5px">
       <span style="width:8px;height:8px;border-radius:50%;background:${mau};${vien ? 'border:' + vien + ';' : ''}"></span>
       <b style="color:var(--text)">${so}</b></span>`;

  // Nhịp nháy cho chấm "đang kiểm" — chèn một lần, style thẻ nằm trong modal.
  const nhay = `<style>@keyframes webNhay{50%{opacity:.25}}</style>`;
  m.innerHTML = nhay + `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;
      width:min(960px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:15px 18px 12px;border-bottom:1px solid var(--border);flex:0 0 auto">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:15px;font-weight:750">🌐 Nguồn web</span>
        <span style="font-size:12px;color:var(--text-dim)">${tongBat}/${NOVA_WEB_NEN_TANG.length} nền tảng đang bật</span>
        <span style="flex:1"></span>
        <button type="button" onclick="webToggleCauHinh()"
          title="Khoá cho công cụ tìm kiếm (Brave / SearXNG)"
          style="border:1px solid ${canChuY ? 'var(--amber)' : 'var(--border-2)'};background:transparent;font-family:inherit;
            border-radius:8px;padding:4px 10px;font-size:11px;font-weight:650;cursor:pointer;
            color:${canChuY ? 'var(--amber)' : (coKhoa ? 'var(--teal)' : 'var(--text-muted)')}">
          ${canChuY ? '⚠️ Cần khoá tìm kiếm' : (coKhoa ? '✓ Đã có khoá tìm kiếm' : 'Khoá tìm kiếm')}</button>
        <button type="button" onclick="webKiemTra()" title="Chạy thử một truy vấn qua từng nền tảng đang bật để biết cái nào ra kết quả thật. Nhóm phải nhờ công cụ tìm có phanh nhịp 5 giây nên lần đầu hơi lâu."
          style="border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:inherit;
            border-radius:8px;padding:4px 11px;font-size:11px;font-weight:650;cursor:pointer">
          ${_webDangKiem ? '■ Dừng kiểm' : '⚡ Kiểm tra' + (lucCuoi ? ' lại' : ' tất cả')}</button>
        <button class="btn ghost sm" onclick="webDongBang()">Đóng</button>
      </div>
      <div style="display:flex;gap:15px;align-items:center;font-size:11px;color:var(--text-muted);margin-top:9px;flex-wrap:wrap">
        ${oCham('var(--green)', '', soOk)} chạy tốt
        ${soKhoa ? oCham('var(--amber)', '', soKhoa) + ' cần khoá' : ''}
        ${oCham('var(--red)', '', soKo)} không ra kết quả
        ${oCham('transparent', '1.5px solid var(--border-bright)', soChua)} chưa kiểm
        ${lucCuoi ? `<span style="color:var(--text-dim)">· kiểm lúc ${_webGioChu(lucCuoi)}</span>` : ''}
      </div>
      ${_webCanhBao ? `<div style="font-size:11px;color:var(--amber);margin-top:8px;line-height:1.55;padding:8px 10px;border-radius:8px;background:var(--surface-2)">⚠️ ${esc(_webCanhBao)}</div>` : ''}
      ${canChuY ? `<div style="font-size:10.5px;color:var(--amber);margin-top:7px;line-height:1.5">⚠️ ${batPhaiTim} nền tảng vạch xám hiện hay KHÔNG ra kết quả — Bing/DuckDuckGo chặn nhịp. Cắm khoá Brave hoặc SearXNG ở nút trên.</div>` : ''}
      ${cauHinh}
    </div>
    <div style="padding:12px 14px;overflow:auto;flex:1 1 auto">${nhomHtml}</div>
    <div style="padding:10px 18px;border-top:1px solid var(--border);flex:0 0 auto;font-size:10.5px;color:var(--text-dim);line-height:1.55">
      Tải về dùng yt-dlp có sẵn trong app nên nền tảng nào yt-dlp đọc được là lấy được clip; ứng viên nào
      yt-dlp không đọc nổi thì bị loại ngay từ lúc tìm. Ứng viên từ nhóm báo đài / mạng xã hội có nhãn ⚠️ trên thẻ để bạn tự quyết.
    </div>
  </div>`;
}