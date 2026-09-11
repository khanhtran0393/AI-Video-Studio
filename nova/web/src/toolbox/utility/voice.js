/* VOICE — giọng đọc OmniVoice/TTS: voice*, giong* (nạp, vẽ, thử, ghép, backend)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function voiceInit(){
  const st = document.getElementById('voiceBackendStatus');
  if (!window.native?.voiceStart){
    if (st) st.innerHTML = '<span style="color:var(--red)">Chỉ dùng được trong app desktop.</span>';
    return;
  }
  try { _giongSuNapDia(); } catch (_){}   // nạp lịch sử "Đã tạo" đã lưu trên đĩa (không cần backend)
  // Xác minh backend còn sống (không chỉ dựa cờ cũ — phòng khi backend đã tắt/khởi động lại).
  const cur = await window.native.voiceStatus().catch(() => null);
  if (cur?.running){ _voiceReady = true; if (cur?.url) VOICE_URL = cur.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice · VieNeu · XTTS)</span>'; voiceLoadVoices(); voiceHWNap(); try { giongKiemEngine(); } catch (_){} return; }
  _voiceReady = false;
  // Đã cài backend trên máy chưa? (thay vì báo lỗi đỏ → hiện panel hướng dẫn cài)
  const pb = window.native.voiceProbe ? await window.native.voiceProbe().catch(() => null) : null;
  if (pb && !pb.hasRoot){ voiceShowSetup('need-install'); return; }
  if (pb && pb.hasRoot && !pb.hasPython){ voiceShowSetup('need-python'); return; }
  // Có backend → tự khởi động (im lặng) khi mở tab.
  if (st) st.innerHTML = '⏳ Đang khởi động backend giọng nói (OmniVoice · VieNeu · XTTS)… lần đầu ~30-60s, giữ app mở.';
  if (!_voiceStarting) _voiceStarting = window.native.voiceStart();
  const r = await _voiceStarting; _voiceStarting = null;
  if (r?.ok){ _voiceReady = true; if (r?.url) VOICE_URL = r.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice · VieNeu · XTTS)</span>'; voiceLoadVoices(); voiceHWNap(); try { giongKiemEngine(); } catch (_){} }
  else if (st) st.innerHTML = '<span style="color:var(--red)">Lỗi khởi động: ' + escapeHtml(r?.error || '') + '</span>';
}

async function voiceHWNap(){
  if (!_voiceReady) return;
  try {
    const h = await _giongFetchJson(VOICE_URL + '/api/hardware');
    if (!h || !h.profile) return;
    _voiceHW = h;
    const st = document.getElementById('voiceBackendStatus');
    if (st && /sẵn sàng/.test(st.textContent || '')){
      const chip = h.device === 'cuda'
        ? ' · ' + (h.gpu || 'GPU') + (h.vram_gb ? ' ' + h.vram_gb + 'GB' : '') + ' 🚀'
        : (h.device === 'xpu' ? ' · ' + (h.gpu || 'Intel GPU') + ' 🚀'
        : (h.device === 'mps' ? ' · Apple GPU' : ' · CPU ' + (h.cpu_cores || '?') + ' nhân'));
      st.innerHTML += '<span style="color:var(--text-dim)">' + escapeHtml(chip) + '</span>';
    }
    if (h.profile !== 'gpu' && _voiceBackendMacDinh && _voiceBackend === 'omni'){
      _voiceBackend = 'vieneu';
      _voiceBackendMacDinh = false;   // đã chủ đích chọn theo phần cứng — health không đè lại
      try { novaLog('🎙 máy không có GPU → mặc định VieNeu (ONNX CPU, nhanh hơn OmniVoice trên CPU)'); } catch (_){}
      voiceBackendVe(); try { giongVe(); giongVeThanh(); } catch (_){}
    }
  } catch (_){}   // backend cũ chưa có /api/hardware → dùng mặc định 400/400
  voicePrewarm();   // nạp sẵn model engine đang chọn → lần đọc đầu không phải chờ tải model
}

async function voicePrewarm(){
  try {
    const eng = _TTS_BACKEND_ID[_voiceBackend] || 'omnivoice';
    await _giongFetchJson(VOICE_URL + '/api/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: eng }),
    });
  } catch (_){}
}

function voiceShowSetup(kind){
  const st = document.getElementById('voiceBackendStatus');
  if (!st) return;
  const needPy = kind === 'need-python';
  const msg = needPy
    ? 'Đã tìm thấy thư mục voice-studio nhưng <b>chưa cài môi trường Python</b>. Mở voice-studio và chạy file cài đặt <b>setup-omni</b> (cài đủ cả 3 engine: OmniVoice · VieNeu · XTTS) một lần, rồi bấm “Kiểm tra lại”.'
    : 'Giọng nói AI chạy <b>ngay trên máy bạn</b> (đọc bao nhiêu cũng miễn phí), gồm đủ 3 engine <b>OmniVoice · VieNeu · XTTS</b>. Bấm <b>“Cài backend vào máy”</b> — app tự cài vào thư mục của app, <b>không cần chọn nơi lưu</b>. Chỉ cài một lần là xong.';
  st.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:720px">
      <div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px">🎙 Cài backend giọng nói (OmniVoice · VieNeu · XTTS) trên máy</div>
      <div style="font-size:12.8px;color:var(--text-muted);line-height:1.65;margin-bottom:12px">${msg}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary sm" onclick="voiceInstallBackend()">📥 Cài backend vào máy</button>
        <button class="btn ghost sm" onclick="voicePickRoot()">📁 Đã cài nơi khác — chọn thư mục</button>
        <button class="btn ghost sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
      </div>
    </div>`;
}

async function voiceInstallBackend(){
  if (!window.native?.voiceInstallBackend){ voicePickRoot(); return; }
  const st = document.getElementById('voiceBackendStatus');
  if (st) st.innerHTML = '⏳ Đang chép backend ra máy…';
  const r = await window.native.voiceInstallBackend().catch(() => null);
  if (r?.ok){
    if (st) st.innerHTML = `
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:760px">
        <div style="font-weight:800;color:var(--green);margin-bottom:6px">✓ Đã chép backend vào máy</div>
        <div style="font-size:12.8px;color:var(--text-muted);line-height:1.7">
          Thư mục: <code style="background:var(--surface-3);padding:2px 6px;border-radius:5px">${escapeHtml(r.path)}</code> (đã mở sẵn).<br>
          <b>Bước tiếp — cài Python + model (1 lần):</b> vào thư mục đó, chạy
          <b>setup-omni.bat</b> (Windows) hoặc <b>setup-omni.command</b> (Mac) — cài đủ cả 3 engine
          <b>OmniVoice · VieNeu · XTTS</b> (nặng ~2GB, chờ vài phút). Xong bấm <b>🔄 Kiểm tra lại</b>.<br>
          <span style="color:var(--text-dim)">Chi tiết xem file HUONG-DAN-KHACH.md trong thư mục đó.</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primary sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
        </div>
      </div>`;
  } else if (r && !r.canceled){
    if (st) st.insertAdjacentHTML('beforeend', '<div style="color:var(--red);font-size:12px;margin-top:8px">' + escapeHtml(r.error || 'Lỗi cài đặt') + '</div>');
  }
}

async function voicePickRoot(){
  if (!window.native?.voicePickRoot) return;
  const r = await window.native.voicePickRoot().catch(() => null);
  if (r?.ok){ voiceInit(); return; }
  if (r && r.error){ const st = document.getElementById('voiceBackendStatus'); if (st) st.insertAdjacentHTML('beforeend', '<div style="color:var(--red);font-size:12px;margin-top:8px">' + escapeHtml(r.error) + '</div>'); }
}

async function _giongFetchJson(url, opt){
  const r = await fetch(url, opt);
  const data = await r.json().catch(() => null);
  if (!r.ok){
    let d = data && (data.detail || data.error || data.message);
    if (Array.isArray(d)) d = (d[0] && (d[0].msg || d[0].detail)) || '';
    const msg = (typeof d === 'string' && d) ? d : ('HTTP ' + r.status);
    throw new Error(msg);
  }
  return data || {};
}

// Tên tiếng Việt của mã ngôn ngữ (dùng cho option dropdown + chip lọc lưới thẻ).
function _giongLangTen(l){
  const ban = { th: 'Tiếng Thái', id: 'Tiếng Indonesia', ms: 'Tiếng Mã Lai', ar: 'Tiếng Ả Rập', hi: 'Tiếng Hindi', nl: 'Tiếng Hà Lan', pl: 'Tiếng Ba Lan', tr: 'Tiếng Thổ Nhĩ Kỳ', sv: 'Tiếng Thụy Điển', da: 'Tiếng Đan Mạch', no: 'Tiếng Na Uy', fi: 'Tiếng Phần Lan', uk: 'Tiếng Ukraine', cs: 'Tiếng Séc', ro: 'Tiếng Rumani', hu: 'Tiếng Hungary', el: 'Tiếng Hy Lạp', he: 'Tiếng Do Thái', vi: 'Tiếng Việt' };
  return ban[l] || (String(l || '').toUpperCase() + ' (thư viện)');
}

async function giongTaiDS(){
  const ds = [];
  let taiThanhCong = false;
  try {
    const data = await _giongFetchJson(VOICE_URL + '/api/voices');
    const list = Array.isArray(data) ? data : (data.voices || []);
    for (const v of list){
      // Voice factory cũng phải hiện tên trong UI. Trước đây continue ở đây làm
      // danh sách trống dù backend đã seed thành công các voice có sẵn.
      const factory = !!v.is_factory;
      const thietKe = !!(v.attributes && v.attributes.instruct);
      const builtin = !!(v.attributes && v.attributes.voice);
      ds.push({
        key: 'omni:' + v.id, id: v.id, name: v.name || v.id,
        src: factory ? 'Giọng có sẵn' : (thietKe ? 'Thiết kế từ mô tả' : 'Clone từ mẫu'),
        kind: factory ? 'san' : (thietKe ? 'design' : 'clone'),
        tags: (v.tags || []).slice(0, 3),
        lang: (v.attributes && v.attributes.lang) || 'vi',
        // Engine "gốc" của giọng, suy từ nguồn: built-in (attributes.voice) →
        // VieNeu; thiết kế (attributes.instruct) → OmniVoice; clone WAV →
        // OmniVoice (XTTS cũng đọc được clone nhưng OmniVoice là gốc).
        engine: builtin ? 'vieneu' : 'omni',
        factory,
      });
    }
    taiThanhCong = true;
  } catch (e){ /* backend tạm thời chưa lên — giữ danh sách đang dùng */ }
  // Không xoá thư viện/selection đang hiện chỉ vì một lần reload gặp backend lỗi.
  // Lần khởi tạo đầu vẫn giữ [] để UI hiển thị đúng trạng thái rỗng.
  if (taiThanhCong){
    _giongDS = ds;
    // Ngôn ngữ có trong thư viện nhưng thiếu trong dropdown tĩnh (OmniVoice có
    // 600+ ngôn ngữ) → thêm option để giọng đó vẫn lọc/chọn được theo ngôn ngữ.
    const sl = document.getElementById('voiceLang');
    if (sl){
      for (const v of ds){
        const l = v.lang;
        if (l && !Array.from(sl.options).some(o => o.value === l)){
          const o = document.createElement('option');
          o.value = l;
          o.textContent = _giongLangTen(l);
          sl.appendChild(o);
        }
      }
    }
  }
  if (!_giongDS.some(v => v.key === _giongChon)) _giongChon = (_giongDS[0] || {}).key || '';
  giongVe();
}

function _giongHop(v){
  if (_giongLoc === '*') return true;
  if (_giongLoc.startsWith('e:')) return giongThuocBackend(v, _giongLoc.slice(2));
  if (_giongLoc.startsWith('k:')) return v.kind === _giongLoc.slice(2);
  if (_giongLoc.startsWith('l:')) return v.lang === _giongLoc.slice(2);
  return (v.tags || []).includes(_giongLoc);
}

// Giọng nào "thuộc" backend nào (UX chọn backend trước — dropdown giọng lọc theo đây):
// - OmniVoice: giọng có sẵn + thiết kế từ mô tả + clone (gốc OmniVoice).
// - VieNeu: giọng built-in tiếng Việt (attributes.voice).
// - XTTS: chuyên đọc giọng nhân bản từ mẫu WAV (clone).
function giongThuocBackend(v, eng){
  eng = eng || _voiceBackend;
  if (!v) return false;
  if (eng === 'vieneu') return v.engine === 'vieneu';
  if (eng === 'xtts') return v.kind === 'clone';
  return v.engine === 'omni';
}

function giongVe(){
  const box = document.getElementById('giongLuoi');
  const chips = document.getElementById('giongChips');
  if (!box) return;

  if (chips){
    const dem = f => _giongDS.filter(v => { const c = _giongLoc; _giongLoc = f; const k = _giongHop(v); _giongLoc = c; return k; }).length;
    const muc = [['*', 'Tất cả']];
    for (const [k, t] of [['k:clone','Clone'],['k:design','Thiết kế']]) if (_giongDS.some(v => v.kind === k.slice(2))) muc.push([k, t]);
    for (const [e, t] of [['omni', _TTS_TEN.omni], ['vieneu', _TTS_TEN.vieneu], ['xtts', _TTS_TEN.xtts]])
      if (_giongDS.some(v => giongThuocBackend(v, e))) muc.push(['e:' + e, t]);
    const nhan = {};
    for (const v of _giongDS) for (const t of (v.tags || [])) nhan[t] = (nhan[t] || 0) + 1;
    for (const t of Object.keys(nhan).sort((a,b) => nhan[b] - nhan[a]).slice(0, 4)) muc.push([t, t]);
    // Chip lọc ngôn ngữ: các ngôn ngữ ngoài 'vi' đông nhất trong thư viện (tối đa 3).
    const langDem = {};
    for (const v of _giongDS){ const l = v.lang || 'vi'; langDem[l] = (langDem[l] || 0) + 1; }
    for (const l of Object.keys(langDem).filter(l => l !== 'vi').sort((a, b) => langDem[b] - langDem[a]).slice(0, 3))
      muc.push(['l:' + l, _giongLangTen(l)]);
    chips.innerHTML = muc.map(([f, t]) =>
      `<div class="gchip${f === _giongLoc ? ' on' : ''}" onclick="giongDatLoc('${escapeHtml(f)}')">${escapeHtml(t)}<span class="c">${dem(f)}</span></div>`).join('');
  }

  const hien = _giongDS.filter(_giongHop);
  box.innerHTML = hien.map(v => {
    const chon = v.key === _giongChon, dangPhat = v.key === _giongPhat;
    return `<div class="gcard${chon ? ' sel' : ''}${dangPhat ? ' play' : ''}${v.factory ? '' : ' has-del'}" onclick="giongBam('${escapeHtml(v.key)}')">
      ${v.factory ? '' : `<button type="button" class="btn sm ghost gdel" onclick="event.stopPropagation();giongXoa('${escapeHtml(v.key)}')" title="Xoá giọng clone" aria-label="Xoá giọng">Xóa</button>`}
      <div class="gtop">
        <span class="gpico">${_giongTao === v.key ? '⏳' : (dangPhat ? '❙❙' : '▶')}</span>
        <div style="min-width:0"><div class="gname">${escapeHtml(v.name)}</div><div class="gsrc">${escapeHtml(v.src)}</div></div>
      </div>
      <div class="gtags">${(v.tags || []).map(t => `<span class="gtg">${escapeHtml(t)}</span>`).join('')}</div>
    </div>`;
  }).join('') + `<div class="gadd" onclick="giongThemBat()">＋ Thêm giọng</div>`;

  const n = document.getElementById('giongDem'); if (n) n.textContent = _giongDS.length + ' giọng';
  const cur = _giongDS.find(v => v.key === _giongChon);
  const lb = document.getElementById('giongDangChon');
  if (lb) lb.textContent = cur ? (cur.name + ' · ' + _TTS_TEN[_voiceBackend]) : 'chưa chọn giọng';
  try { giongDDVe(); } catch (e){}   // dropdown "Giọng đọc" dưới cũng chạy theo thư viện
  try { giongLibVe(); } catch (e){}  // dropdown "Thư viện giọng" phía trên cũng vậy
  giongVeThanh();
}

function giongDatLoc(f){ _giongLoc = f; giongVe(); }

function giongVeThanh(){
  // VieNeu Turbo chưa nhận tham số tốc độ, và chỉ đọc tiếng Việt —
  // mờ phần tương ứng khi chọn VieNeu, KHÔNG giấu (đúng triết lý tab này).
  const vi = _voiceBackend === 'vieneu';
  const el = document.getElementById('slTocDo');
  if (el) el.classList.toggle('off', vi);
  const wy = document.getElementById('whyTocDo');
  if (wy) wy.textContent = vi ? 'VieNeu Turbo chưa có tốc độ' : '';
  const nn = document.getElementById('slNgonNgu');
  if (nn) nn.classList.toggle('off', vi);
  const wn = document.getElementById('whyNgonNgu');
  // Ghi chú ngắn gọn đúng năng lực từng engine (chi tiết đã dời vào title của nhãn).
  if (vi) wn.textContent = 'VieNeu thuần tiếng Việt';
  else if (_voiceBackend === 'xtts') wn.textContent = 'XTTS: 17 ngôn ngữ (Việt cần viXTTS)';
  else wn.textContent = 'OmniVoice: 600+ ngôn ngữ';
  // Tham số nâng cao chỉ có tác dụng với engine ghi trong data-engines của khối
  // (Top P/Top K/Repetition → VieNeu · Tốc độ sinh/Sắc nét → OmniVoice) — mờ các
  // khối không áp dụng cho engine đang chọn, KHÔNG giấu (đúng triết lý tab này).
  document.querySelectorAll('.sl[data-engines]').forEach(el => {
    const ds = (el.getAttribute('data-engines') || '').split(',').map(s => s.trim()).filter(Boolean);
    el.classList.toggle('off', ds.length > 0 && !ds.includes(_voiceBackend));
  });
}

function giongTheoBackend(v){
  if (!v) return;
  if (_TTS_TEN[v.engine] && v.engine !== _voiceBackend){
    _voiceBackend = v.engine;
    _voiceBackendMacDinh = false;   // chọn theo giọng = chọn có chủ đích
    try { localStorage.setItem('voice_backend', v.engine); } catch (e){}
    _giongMauXoa();      // mẫu nghe thử đang cache tạo bằng engine cũ — xoá cho đúng (cả trên đĩa)
    try { voiceBackendVe(); giongVeThanh(); } catch (e){}
    try { giongBao('Đã chuyển engine sang ' + _TTS_TEN[v.engine] + ' (theo giọng đang chọn)', 'green'); } catch (e){}
    try { novaLog('🎙 engine theo giọng ' + v.name + ': ' + _TTS_TEN[v.engine]); } catch (e){}
  }
  // Ngôn ngữ cũng theo giọng: chọn giọng Nhật → dropdown sang tiếng Nhật.
  const sl = document.getElementById('voiceLang');
  if (sl && v.lang && sl.value !== v.lang && Array.from(sl.options).some(o => o.value === v.lang)){
    sl.value = v.lang;
  }
}

// === L9806 (068263fe^): sync — delegate _giongPhatThu (thử-engine fallback) ===
async function giongBam(key){
  const v = _giongDS.find(x => x.key === key);
  if (!v) return;
  _giongChon = key;
  giongTheoBackend(v);
  return _giongPhatThu(key);
}

async function giongThu(key){
  return _giongPhatThu(key);
}

async function _giongTTS(v, text){
  // Engine đầu tiên thử là engine GỐC CỦA GIỌNG (chọn theo backend) — nghe
  // thử giọng built-in VieNeu mà đang chọn OmniVoice thì thử VieNeu trước,
  // đỡ chạy nhầm engine không sở hữu giọng rồi mới fallback.
  const thu = _giongThuTu(v);
  let loiDau = null;
  for (const eng of thu){
    try { return { blob: await _ttsChay(eng, v, text, giongDocTuyChon(), null), engine: eng }; }
    catch (e){
      if (!loiDau) loiDau = e;
      // engine thật sự hỏng → chấm đỏ, đừng để xanh dối lòng (giống ttsDoc).
      if (_giongTT[eng] === 'ok'){ _giongTT[eng] = 'err'; try { giongKiemEngineVe(); } catch (_){} }
      try { novaLog('🎙 nghe thử: ' + _TTS_TEN[eng] + ' lỗi — ' + (e.message || e), 'warn'); } catch (_){}
    }
  }
  throw loiDau || new Error('Không engine nào đọc được.');
}

function _giongThuTu(v){
  const goc = (v && _TTS_TEN[v.engine]) ? v.engine : _voiceBackend;
  return [goc].concat([_voiceBackend].concat(Object.keys(_TTS_TEN)).filter(e => e !== goc && _TTS_TEN[e]).filter((e, i, a) => a.indexOf(e) === i));
}

function _giongMauFileKey(eng, key){ return _GIONG_MAU_V + '|' + eng + '|' + key; }

async function _giongMauDocDia(eng, key){
  try {
    if (!(window.native && window.native.voiceSampleLoad)) return null;   // bản web không có IPC
    const r = await window.native.voiceSampleLoad(_giongMauFileKey(eng, key));
    if (r && r.ok && typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:')) return r.dataUrl;
  } catch (_){}
  return null;
}

async function _giongMauGhiDia(eng, key, blob){
  try {
    if (!(window.native && window.native.voiceSampleSave) || !blob) return;
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(new Error('đọc blob lỗi')); fr.readAsDataURL(blob); });
    if (dataUrl && dataUrl.startsWith('data:')) window.native.voiceSampleSave({ key: _giongMauFileKey(eng, key), dataUrl });   // fire-and-forget: lỗi ghi không chặn việc nghe
  } catch (_){}
}

function _giongMauXoa(key){
  if (key != null){
    const u = _giongMau.get(key);
    if (u){ try { URL.revokeObjectURL(u); } catch (_){} _giongMau.delete(key); }
    try { if (window.native && window.native.voiceSampleClear){ for (const e of Object.keys(_TTS_TEN)) window.native.voiceSampleClear(_giongMauFileKey(e, key)); } } catch (_){}
  } else {
    _giongMau.forEach(u => { try { URL.revokeObjectURL(u); } catch (_){} });
    _giongMau.clear();
    try { if (window.native && window.native.voiceSampleClear) window.native.voiceSampleClear(null); } catch (_){}
  }
}

async function _giongPhatThu(key){
  const v = _giongDS.find(x => x.key === key);
  if (!v) return;
  if (_giongPhat === key && _giongAudio && !_giongAudio.paused){ _giongAudio.pause(); _giongPhat = ''; giongVe(); return; }
  if (_giongTao === key) return;   // đang tạo mẫu cho chính giọng này — chờ, bấm thêm không spawn thêm task
  giongVe();
  try {
    let url = _giongMau.get(key);
    if (!url){
      // RAM không có → đọc cache trên đĩa (đã sinh từ phiên trước, phát ngay).
      // Dò theo đúng thứ tự engine ưu tiên như lúc tạo để không bỏ sót mẫu
      // tạo bằng engine fallback, và dò được là dừng.
      for (const e of _giongThuTu(v)){
        const duLieu = await _giongMauDocDia(e, key);
        if (duLieu){
          try {
            const r = await fetch(duLieu); const blob = await r.blob();
            if (blob && blob.size){ url = URL.createObjectURL(blob); _giongMau.set(key, url); }
          } catch (_){}
          break;
        }
      }
    }
    if (!url){
      _giongTao = key; _giongPhat = ''; giongVe();
      // Lần đầu model nạp lười mất ~30-60s — báo rõ đang chạy, đừng để tưởng treo.
      giongBao('⏳ Đang tạo mẫu nghe thử của "' + v.name + '"… lần đầu model nạp ~30-60 giây, giữ app mở.', 'text-muted');
      const kq = await _giongTTS(v, _GIONG_THU);   // { blob, engine }
      url = URL.createObjectURL(kq.blob); _giongMau.set(key, url);
      _giongMauGhiDia(kq.engine, key, kq.blob);    // ghi đĩa — phiên sau nghe ngay không tạo lại
    }
    _giongTao = '';
    if (!_giongAudio) _giongAudio = new Audio();
    _giongAudio.onended = () => { _giongPhat = ''; giongVe(); };
    _giongAudio.src = url; _giongPhat = key; giongVe();
    await _giongAudio.play();
  } catch (err){
    _giongPhat = ''; _giongTao = '';
    giongVe();
    giongBao('Nghe thử lỗi: ' + (err.message || err), 'red');
  }
}

function giongDocTuyChon(){
  const s = id => parseFloat((document.getElementById(id) || {}).value);
  const int = id => parseInt((document.getElementById(id) || {}).value, 10);
  return {
    tocDo: isFinite(s('voiceSpeed')) ? s('voiceSpeed') : 1,
    caoDo: isFinite(s('voicePitch')) ? s('voicePitch') : 0,
    gap: isFinite(s('voiceGap')) ? s('voiceGap') : 300,
    lang: (function(){
      const sl = document.getElementById('voiceLang');
      const lv = sl ? sl.value : 'vi';
      if (lv && lv !== 'all') return lv;   // 'all' = theo ngôn ngữ của giọng đang chọn
      const cur = _giongDS.find(v => v.key === _giongChon);
      return (cur && cur.lang) || 'vi';
    })(),
    // Tham số nâng cao
    top_p: isFinite(s('voiceTopP')) ? s('voiceTopP') : 0.85,
    top_k: isFinite(int('voiceTopK')) ? int('voiceTopK') : 50,
    repetition_penalty: isFinite(s('voiceRepPen')) ? s('voiceRepPen') : 2.0,
    generation_speed: isFinite(s('voiceGenSpeed')) ? s('voiceGenSpeed') : 0.9,
    diffusion_steps: isFinite(int('voiceDiffSteps')) ? int('voiceDiffSteps') : 16,
  };
}

async function _ttsLocal(eng, v, text, o, onTien){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend giọng nói chưa sẵn sàng.'); }
  if (!v || !v.id) throw new Error('Chưa chọn giọng.');
  // chunk_chars theo phần cứng backend dò được (/api/hardware): GPU VRAM rộng → khối
  // to (600, giảm số lần gọi model); máy yếu CPU → khối nhỏ (200, ra audio sớm). Mặc định 400.
  const body = {
    text,
    language: o.lang,
    speed: o.tocDo,
    pitch: o.caoDo || 0,
    gap_ms: Math.round(o.gap),
    chunk_chars: (_voiceHW && _voiceHW.recommended && _voiceHW.recommended.chunk_chars) || 400,
    attributes: {},
    preset_id: v.id,
    engine: _TTS_BACKEND_ID[eng] || 'omnivoice',
    // Tham số nâng cao (chỉ gửi nếu engine là omnivoice hoặc engine hỗ trợ)
    top_p: o.top_p,
    top_k: o.top_k,
    repetition_penalty: o.repetition_penalty,
    generation_speed: o.generation_speed,
    diffusion_steps: o.diffusion_steps,
  };
  const sub = await _giongFetchJson(VOICE_URL + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const tid = sub.task_id;
  if (!tid) throw new Error('Backend không nhận việc.');
  for (let i = 0; i < 3600; i++){   // chờ tới 60 phút — kịch bản dài trên máy chậm vẫn kịp
    await new Promise(r => setTimeout(r, 1000));
    const s = await _giongFetchJson(VOICE_URL + '/api/status/' + tid);
    if (s.total && onTien) onTien(s.progress + '/' + s.total + ' khối');
    if (s.status === 'completed' || s.status === 'done'){
      if (!s.results || !s.results.merged) throw new Error('Backend không trả file.');
      const fileRes = await fetch(VOICE_URL + s.results.merged);
      if (!fileRes.ok) throw new Error('Không tải được file giọng (HTTP ' + fileRes.status + ').');
      const blob = await fileRes.blob();
      if (!blob || !blob.size) throw new Error('File giọng rỗng.');
      return blob;
    }
    if (s.status === 'failed' || s.status === 'error') throw new Error(s.error || 'Backend báo lỗi.');
  }
  throw new Error('Quá lâu không xong.');
}

// === L9990 (068263fe^): sync 5-arg engine-based — SSOT bản split ===
async function _ttsChay(eng, v, text, o, onTien){
  if (!_TTS_TEN[eng]) throw new Error('Engine lạ: ' + eng);
  const blob = await _ttsLocal(eng, v, text, o, onTien);
  // Đọc ra file là bằng chứng mạnh hơn mọi phép thăm dò — nâng chấm lên xanh.
  if (_giongTT[eng] !== 'ok'){ _giongTT[eng] = 'ok'; try { giongKiemEngineVe(); } catch (_){} }
  return blob;
}

function giongBao(msg, mau){
  const gs = document.getElementById('voiceGenStatus');
  if (gs) gs.innerHTML = mau ? `<span style="color:var(--${mau})">${escapeHtml(msg)}</span>` : escapeHtml(msg);
}

function voiceLoadScript(){
  let txt = (state.script || '').trim();
  if (!txt && state.scenes && state.scenes.length) txt = state.scenes.map(s => (s.text || '').trim()).filter(Boolean).join(' ');
  if (!txt){ giongBao('Chưa có kịch bản ở Tool 2.', 'text-muted'); return; }
  const ta = document.getElementById('voiceText'); if (ta){ ta.value = txt; giongDemChu(); }
}

function giongDemChu(){
  const t = (document.getElementById('voiceText') || {}).value || '';
  const tu = t.trim() ? t.trim().split(/\s+/).length : 0;
  const giay = Math.round(tu / 2.5);
  const el = document.getElementById('giongDemChu');
  if (!el) return;
  el.innerHTML = escapeHtml(tu + ' từ · ' + t.length + ' ký tự · ước ' + Math.floor(giay / 60) + ' phút ' + (giay % 60) + ' giây');
}

function _giongDemTu(s){ const t = String(s || '').trim(); return t ? t.split(/\s+/).length : 0; }

function _giongTachCau(p){
  return String(p || '').split(/(?<=[\.\!\?\…。！？])\s+/).map(s => s.trim()).filter(Boolean);
}

function _giongTachDoan(text, maxTu){
  maxTu = maxTu || 400;
  const don = [];
  for (const p of String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean)){
    if (_giongDemTu(p) <= maxTu){ don.push(p); continue; }   // dòng/đoạn ngắn giữ nguyên
    for (const c of _giongTachCau(p)) don.push(c);           // quá dài → tách tiếp theo câu
  }
  const ds = []; let cur = '', curTu = 0;
  for (const d of don){
    const w = _giongDemTu(d);
    if (cur && curTu + w > maxTu){ ds.push(cur); cur = d; curTu = w; }
    else { cur = cur ? cur + '\n\n' + d : d; curTu += w; }
  }
  if (cur) ds.push(cur);
  return ds;
}

async function _giongLuuBan(blob, giong, engine, text, nhan){
  const url = URL.createObjectURL(blob);
  const au = new Audio(url);
  const giay = await new Promise(r => { au.onloadedmetadata = () => r(au.duration || 0); au.onerror = () => r(0); });
  const h = { url, blob, ten: (nhan ? nhan + ' · ' : '') + giong.name, engine, giay, text, khi: Date.now() };
  _giongSu.unshift(h);
  _giongSu = _giongSu.slice(0, 40);   // kịch bản tách nhiều đoạn cần nhiều slot hơn 12
  giongSuVe();
  try { _giongSuLuuDia(h); } catch (_){}   // persist đĩa — lỗi lưu không chặn phiên
}

// ── Lịch sử "Đã tạo" persist qua IPC (userData/voice-history) ───────────────
// Bản đọc còn đó sau khi reload/app khởi động lại. Audio ghi nhị phân, meta
// ghi .json cùng tên; main tự prune (≤40 bản, ≤64MB). Thất bại = im lặng:
// lịch sử trong RAM vẫn dùng bình thường.
async function _giongSuLuuDia(h){
  try {
    if (!(window.native && window.native.voiceHistorySave) || !h || !h.blob) return;
    if (h.blob.size > 64 * 1024 * 1024) return;   // main cũng prune ở 64MB — bỏ qua bản quá to
    const ext = /(mpeg|mp3)/.test(h.blob.type) ? '.mp3' : '.wav';
    const buf = new Uint8Array(await h.blob.arrayBuffer());
    await window.native.voiceHistorySave({
      khi: h.khi, ext, buf,
      meta: { khi: h.khi, ten: h.ten || '', engine: h.engine || '', giay: h.giay || 0, text: h.text || '', ext },
    });
  } catch (_){}
}

async function _giongSuNapDia(){
  if (_giongSuDaNap || !(window.native && window.native.voiceHistoryList)) return;
  _giongSuDaNap = true;
  try {
    const r = await window.native.voiceHistoryList();
    if (!r || !r.ok || !Array.isArray(r.items) || !r.items.length) return;
    for (const it of r.items){
      const m = it.meta || {};
      if (!m.khi || _giongSu.some(x => x.khi === m.khi)) continue;   // bản vừa tạo trong phiên đã có
      try {
        const blob = new Blob([it.buf], { type: m.ext === '.mp3' ? 'audio/mpeg' : 'audio/wav' });
        _giongSu.push({ url: URL.createObjectURL(blob), blob, ten: m.ten || '', engine: m.engine || '', giay: m.giay || 0, text: m.text || '', khi: m.khi });
      } catch (_){}
    }
    _giongSu.sort((a, b) => b.khi - a.khi);
    _giongSu = _giongSu.slice(0, 40);
    giongSuVe();
  } catch (_){}
}

async function voiceGenerate(){
  if (typeof gateTool === 'function' && gateTool('toolvoice')) return;
  const text = ((document.getElementById('voiceText') || {}).value || '').trim();
  if (!text){ giongBao('Nhập nội dung trước.', 'red'); return; }
  const btn = document.getElementById('voiceGenBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo…'; }
  try {
    const t0 = Date.now();
    // Độ dài đoạn theo phần cứng (/api/hardware): GPU nhanh → đoạn dài 500 từ (khỏi tách
    // vụn); máy yếu CPU → 250 từ (nghe được sớm, không dính trần chờ). Mặc định 400.
    const doan = _giongTachDoan(text, (_voiceHW && _voiceHW.recommended && _voiceHW.recommended.seg_words) || 400);

    if (doan.length <= 1){
      // Ngắn — giữ nguyên luồng cũ: 1 task trọn vẹn.
      giongBao('Đang tạo giọng…');
      const { blob, giong, engine, luiVe } = await ttsDoc(text, s => giongBao('Đang tạo… ' + s));
      await _giongLuuBan(blob, giong, engine, text);
      giongBao('✓ Xong sau ' + Math.round((Date.now() - t0) / 1000) + ' giây' + (luiVe ? ' (đã lui về ' + _TTS_TEN[engine] + ')' : ''), 'green');
      return;
    }

    // Dài — render từng đoạn tuần tự, xong đoạn nào lưu ngay đoạn đó.
    let xong = 0;
    for (let i = 0; i < doan.length; i++){
      const nhan = 'Đoạn ' + (i + 1) + '/' + doan.length;
      let loi = null;
      for (let thu = 1; thu <= 2; thu++){   // thử tối đa 2 lần mỗi đoạn
        try {
          giongBao('Đang tạo ' + nhan + ' (~' + _giongDemTu(doan[i]) + ' từ)' + (thu > 1 ? ' · thử lần ' + thu : '') + '…');
          const { blob, giong, engine } = await ttsDoc(doan[i], s => giongBao(nhan + ' · ' + s));
          await _giongLuuBan(blob, giong, engine, doan[i], nhan);
          xong++;
          giongBao('✓ ' + nhan + ' xong (' + xong + '/' + doan.length + ')' + (i + 1 < doan.length ? ' — đang sang đoạn tiếp…' : ''), 'green');
          loi = null;
          break;
        } catch (e){ loi = e; }
      }
      if (loi){
        // Dừng ngay: lỗi thường mang tính hệ thống (backend/engine hỏng), chạy tiếp chỉ tốn giờ.
        const conLai = doan.slice(i).reduce((a, d) => a + _giongDemTu(d), 0);
        giongBao('⚠ ' + nhan + ' lỗi sau 2 lần thử (' + (loi.message || loi) + '). Đã xong ' + xong + '/' + doan.length + ' đoạn (đã lưu trong lịch sử bên dưới). Muốn làm tiếp: dán phần văn bản còn lại (~' + conLai + ' từ) vào ô rồi bấm “Tạo giọng”.', 'red');
        return;
      }
    }
    giongBao('✓ Xong ' + doan.length + ' đoạn sau ' + Math.round((Date.now() - t0) / 1000) + ' giây — bấm “🔗 Ghép các đoạn đã xong” ở khung Đã tạo để có 1 file trọn vẹn.', 'green');
  } catch (e){
    giongBao('Lỗi: ' + (e.message || e), 'red');
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '🎙 Tạo giọng'; }
  }
}

function giongSuVe(){
  const box = document.getElementById('giongSu');
  if (!box) return;
  // Nút gộp: chỉ hiện khi có nhóm ≥2 đoạn auto-split đã xong (kể cả thiếu đoạn).
  const g = _giongNhomDoan();
  const gb = document.getElementById('giongGhepBtn');
  if (gb){
    const ok = !!(g && g.items.length >= 2);
    gb.style.display = ok ? '' : 'none';
    if (ok) gb.textContent = '🔗 Ghép các đoạn đã xong (' + g.items.length + '/' + g.N + ')';
  }
  if (!_giongSu.length){ box.innerHTML = '<div class="empty-state">Chưa tạo bản nào. Bản đã tạo được lưu trên máy — còn đó khi mở lại app.</div>'; return; }
  box.innerHTML = _giongSu.map((h, i) => {
    const ph = Math.floor(h.giay / 60), gi = Math.round(h.giay % 60);
    return `<div class="grow-row" onclick="giongSuPhat(${i})">
      <span class="gpico">▶</span>
      <div style="flex:1;min-width:0">
        <div class="gh-txt">${escapeHtml(h.text.slice(0, 70))}${h.text.length > 70 ? '…' : ''}</div>
        <div class="gh-meta">${escapeHtml(h.ten)}${h.engine ? ' · ' + (_TTS_TEN[h.engine] || '') : ''} · ${ph}:${String(gi).padStart(2,'0')} · ${_giongKhiNao(h.khi)}</div>
      </div>
      <div class="gh-act">
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuTai(${i})">Tải</button>
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuDungChoVideo(${i})">Dùng cho video</button>
      </div>
    </div>`;
  }).join('');
}

function _giongKhiNao(t){
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  return Math.floor(s / 3600) + ' giờ trước';
}

function giongSuPhat(i){
  const h = _giongSu[i]; if (!h) return;
  if (!_giongAudio) _giongAudio = new Audio();
  _giongAudio.src = h.url; _giongAudio.play().catch(() => {});
}

function giongSuTai(i){
  const h = _giongSu[i]; if (!h) return;
  const a = document.createElement('a');
  a.href = h.url; a.download = 'giong-noi-' + h.khi + (/(mpeg|mp3)/.test(h.blob.type) ? '.mp3' : '.wav');
  a.click();
}

function giongSuDungChoVideo(i){
  const h = _giongSu[i]; if (!h) return;
  const mp3 = /(mpeg|mp3)/.test(h.blob.type);
  const f = new File([h.blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: h.blob.type || 'audio/wav' });
  // t7HandleAudio lo hết: sóng âm, lưu theo video, đồng bộ Tool 2, kéo dài cảnh cuối.
  try { t7HandleAudio(f); } catch (e){ t7State.audioFile = f; }
  giongBao('✓ Đã gán vào dựng video — sang tab Dựng video là thấy.', 'green');
}

function _giongNhomDoan(){
  let best = null;   // nhóm "Đoạn i/N" có entry mới nhất
  for (const h of _giongSu){
    if (!h.ten) continue;
    const m = _GIONG_DOAN_RE.exec(h.ten);
    if (!m) continue;
    if (!best || h.khi > best.khi) best = { N: +m[2], giong: m[3], khi: h.khi };
  }
  if (!best) return null;
  const map = new Map();   // số đoạn → entry mới nhất
  for (const h of _giongSu){
    if (!h.ten) continue;
    const m = _GIONG_DOAN_RE.exec(h.ten);
    if (!m || +m[2] !== best.N || m[3] !== best.giong) continue;
    const idx = +m[1];
    if (!map.has(idx) || map.get(idx).h.khi < h.khi) map.set(idx, { idx, h });
  }
  return { N: best.N, giong: best.giong, items: Array.from(map.values()).sort((a, b) => a.idx - b.idx) };
}

function _giongWav16(ab){   // AudioBuffer → Blob WAV PCM 16-bit
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, len = ab.length;
  const bytes = 44 + len * nCh * 2;
  const dv = new DataView(new ArrayBuffer(bytes));
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * nCh * 2, true); dv.setUint16(32, nCh * 2, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, len * nCh * 2, true);
  const chans = []; for (let c = 0; c < nCh; c++) chans.push(ab.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++){
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2;
  }
  return new Blob([dv], { type: 'audio/wav' });
}

async function giongSuGhep(){
  const g = _giongNhomDoan();
  if (!g || g.items.length < 2){ giongBao('Cần ít nhất 2 đoạn đã xong trong lịch sử để ghép.', 'red'); return; }
  const btn = document.getElementById('giongGhepBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang ghép ' + g.items.length + ' đoạn…'; }
  try {
    // 1) Decode từng blob (mp3/wav đều được).
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const bufs = [];
    for (const it of g.items) bufs.push(await ctx.decodeAudioData(await it.h.blob.arrayBuffer()));
    try { ctx.close(); } catch (_){ }
    // 2) Nối qua OfflineAudioContext — tự resample nếu các đoạn khác sample-rate.
    const sr = Math.max(...bufs.map(b => b.sampleRate));
    const nCh = Math.max(...bufs.map(b => b.numberOfChannels));
    const total = bufs.reduce((a, b) => a + b.length, 0);
    const off = new OfflineAudioContext(nCh, total, sr);
    let t = 0;
    for (const b of bufs){
      const s = off.createBufferSource(); s.buffer = b;
      s.connect(off.destination); s.start(t);
      t += b.length / b.sampleRate;
    }
    const out = await off.startRendering();
    // 3) Encode WAV → lưu vào lịch sử như 1 bản (Tải / Dùng cho video như bản khác).
    const blob = _giongWav16(out);
    const hGhep = {
      url: URL.createObjectURL(blob), blob,
      ten: 'Gộp ' + g.items.length + ' đoạn · ' + g.giong,
      engine: g.items[0].h.engine, giay: out.duration,
      text: g.items.map(x => x.h.text).join(' '), khi: Date.now(),
    };
    _giongSu.unshift(hGhep);
    _giongSu = _giongSu.slice(0, 40);
    giongSuVe();
    try { _giongSuLuuDia(hGhep); } catch (_){}   // bản gộp cũng persist đĩa
    const thieu = g.N - g.items.length;
    giongBao('✓ Đã ghép ' + g.items.length + '/' + g.N + ' đoạn thành 1 file (' + Math.round(out.duration) + ' giây)'
      + (thieu > 0 ? ' — thiếu ' + thieu + ' đoạn chưa xong, render nốt rồi ghép lại sẽ đủ.' : '')
      + ' Bản "Gộp…" nằm đầu lịch sử: bấm Tải hoặc Dùng cho video.', 'green');
  } catch (e){
    giongBao('Lỗi ghép: ' + (e.message || e), 'red');
  } finally {
    if (btn) btn.disabled = false;
    giongSuVe();
  }
}

function giongThemBat(){ _giongThemMo = !_giongThemMo; const b = document.getElementById('giongThemBox'); if (b) b.style.display = _giongThemMo ? '' : 'none'; if (_giongThemMo) giongThemDoi(); }

function giongThemDoi(){
  const c = (document.getElementById('giongThemCach') || {}).value || 'clone';
  for (const [id, hop] of [['gtClone', c === 'clone'], ['gtDesign', c === 'design'], ['gtDesignInfo', c === 'design']]){
    const el = document.getElementById(id); if (el) el.style.display = hop ? '' : 'none';
  }
  const tt = document.getElementById('gtVoiceTT'); if (tt) tt.textContent = '';
}

async function giongThemLuu(){
  const cach = (document.getElementById('giongThemCach') || {}).value || 'clone';
  const ten = ((document.getElementById('gtTen') || {}).value || '').trim();
  if (!ten){ giongBao('Đặt tên cho giọng trước.', 'red'); return; }
  try {
    if (!_voiceReady){ await voiceInit(); if (!_voiceReady){ giongBao('Backend giọng nói chưa sẵn sàng.', 'red'); return; } }
    const body = { name: ten, ref_text: '', attributes: {}, tags: [] };
    if (cach === 'clone'){
      const f = (document.getElementById('gtFile') || {}).files && document.getElementById('gtFile').files[0];
      if (!f){ giongBao('Chọn file giọng mẫu.', 'red'); return; }
      giongBao('Đang tải file mẫu…');
      const fd = new FormData(); fd.append('file', f);
      const up = await fetch(VOICE_URL + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      body.ref_audio = up.path;
    } else {
      const ins = ((document.getElementById('gtMoTa') || {}).value || '').trim();
      if (!ins){ giongBao('Nhập mô tả giọng.', 'red'); return; }
      body.attributes.instruct = ins;
    }
    const kq = await fetch(VOICE_URL + '/api/voices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    giongThemBat();
    await giongTaiDS();
    // Chọn luôn giọng vừa thêm; nếu backend đang chọn không sở hữu giọng này
    // (vd thêm "Thiết kế" khi đang ở XTTS) thì đổi backend theo giọng mới,
    // đừng để người dùng tưởng giọng biến mất.
    const idMoi = kq && (kq.id || (kq.voice && kq.voice.id));
    const nv = idMoi ? _giongDS.find(x => x.id === idMoi) : null;
    if (nv){ _giongChon = nv.key; giongTheoBackend(nv); giongVe(); }
    giongBao('✓ Đã thêm giọng "' + ten + '".', 'green');
  } catch (e){ giongBao('Thêm giọng lỗi: ' + (e.message || e), 'red'); }
}

async function giongXoa(key){
  if (_giongBusy) return;
  const v = _giongDS.find(x => x.key === key);
  if (!v){ giongBao('Không tìm thấy giọng.', 'red'); return; }
  if (v.factory){ giongBao('Không xoá được giọng có sẵn.', 'red'); return; }
  if (!confirm('Xoá giọng "' + v.name + '"? File mẫu clone sẽ bị gỡ khỏi thư viện.')) return;
  _giongBusy = true;
  try {
    await _giongFetchJson(VOICE_URL + '/api/voices/' + encodeURIComponent(v.id), { method: 'DELETE' });
    _giongMauXoa(key);   // bỏ cả cache đĩa của giọng đã xoá (thử mọi engine)
    if (_giongPhat === key){
      try { if (_giongAudio) _giongAudio.pause(); } catch (e){}
      _giongPhat = '';
    }
    if (_giongChon === key) _giongChon = '';
    await giongTaiDS();
    giongBao('✓ Đã xoá giọng "' + v.name + '".', 'green');
  } catch (e){ giongBao('Xoá lỗi: ' + (e.message || e), 'red'); }
  finally { _giongBusy = false; }
}

function giongKiemEngineVe(){
    const el = document.getElementById('giongEngine');
    if (!el) return;
    const cham = e => `<span class="gdot ${_giongTT[e] || 'no'}"></span>`;
    const cac = ['omni', 'vieneu', 'xtts'];
    const hong = cac.filter(e => _giongTT[e] === 'err');
    el.innerHTML =
      cham('omni') + '<b>' + _TTS_TEN.omni + '</b> <span style="color:var(--text-dim)">máy</span>' +
      '<span class="sep">·</span>' + cham('vieneu') + _TTS_TEN.vieneu +
      '<span class="sep">·</span>' + cham('xtts') + _TTS_TEN.xtts +
      hong.map(e => '<div style="flex-basis:100%;font-size:12px;color:var(--red);margin-top:6px">'
        + escapeHtml(_TTS_TEN[e]) + ': ' + escapeHtml(_giongTTLoi[e] || 'đọc lỗi lần gần nhất — đọc được lại thì chấm tự xanh')
        + '</div>').join('');
    const n = document.getElementById('giongEngineDem');
    if (n) n.textContent = cac.filter(e => _giongTT[e] === 'ok').length + '/3 sẵn sàng';
}

async function giongKiemEngine(){
  const ve = giongKiemEngineVe;
  ve();
  // 3 engine chạy chung một backend local (voice-studio, :8771) — một phép thăm là đủ.
  // Backend chạy → engine chưa từng lỗi = xanh; lỗi lần đọc gần nhất giữ đỏ (đọc được lại tự xanh).
  // Backend chưa chạy → cả ba xám.
  let up = false;
  try { const s = await window.native.voiceStatus(); up = !!(s && s.running); if (s && s.url) VOICE_URL = s.url; } catch (_){}
  for (const e of ['omni', 'vieneu', 'xtts']) _giongTT[e] = up ? (_giongTT[e] === 'err' ? 'err' : 'ok') : 'no';
  ve();
}

function voiceBackendMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('voiceBackendDD');
  if (dd) dd.classList.toggle('mo');
  const btn = document.getElementById('voiceBackendBtn');
  if (btn) btn.setAttribute('aria-expanded', dd && dd.classList.contains('mo') ? 'true' : 'false');
}

function voiceBackendChon(eng){
  if (!_TTS_TEN[eng]) return;
  _voiceBackend = eng;
  _voiceBackendMacDinh = false;   // đã chọn tay — health không tự đổi nữa
  try { localStorage.setItem('voice_backend', eng); } catch (e){}
  const dd = document.getElementById('voiceBackendDD');
  if (dd) dd.classList.remove('mo');
  _giongMauXoa();      // mẫu nghe thử đang cache tạo bằng engine cũ — xoá cho đúng (cả trên đĩa)
  // UX "backend trước": giữ giọng đang chọn nếu vẫn thuộc backend mới, không thì
  // chọn sẵn giọng đầu tiên của backend đó cho người dùng.
  if (!giongThuocBackend(_giongDS.find(v => v.key === _giongChon), eng)){
    // Ưu tiên giọng đầu tiên của backend mới đúng ngôn ngữ đang chọn (nếu có).
    const sl = document.getElementById('voiceLang');
    const lv = sl ? sl.value : '';
    const dau = (lv && lv !== 'all' && _giongDS.find(v => giongThuocBackend(v, eng) && v.lang === lv))
      || _giongDS.find(v => giongThuocBackend(v, eng));
    _giongChon = dau ? dau.key : '';
  }
  voiceBackendVe();
  giongVe();
  giongVeThanh();
}

function voiceBackendVe(){
  const eng = _TTS_TEN[_voiceBackend] ? _voiceBackend : 'omni';
  const ten = document.getElementById('voiceBackendTen');
  const mo  = document.getElementById('voiceBackendNote');
  const dot = document.getElementById('voiceBackendDot');
  if (ten) ten.textContent = _TTS_TEN[eng];
  if (mo)  mo.textContent  = _BE_MO_TA[eng].mo;
  if (dot) dot.className = 'gdot ' + (_giongTT[eng] || 'no');
  for (const [e, id] of [['omni', 'beDotOmni'], ['vieneu', 'beDotVieneu'], ['xtts', 'beDotXtts']]){
    const d = document.getElementById(id); if (d) d.className = 'gdot ' + (_giongTT[e] || 'no');
    const it = document.querySelector('#voiceBackendMenu .be-item[data-eng="' + e + '"]');
    if (it) it.classList.toggle('sel', e === eng);
  }
}

function giongDDMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('voiceGiongDD'); if (!dd) return;
  dd.classList.toggle('mo');
  const btn = document.getElementById('voiceGiongBtn');
  if (btn) btn.setAttribute('aria-expanded', dd.classList.contains('mo') ? 'true' : 'false');
}

function giongDDChon(key){
  const v = _giongDS.find(x => x.key === key); if (!v) return;
  _giongChon = key;
  // Backend do dropdown "Backend tạo giọng" quyết định (UX chọn backend trước) —
  // chọn giọng trong dropdown này KHÔNG tự đổi engine nữa, chỉ đồng bộ ngôn ngữ theo giọng.
  const sl = document.getElementById('voiceLang');
  if (sl && v.lang && sl.value !== v.lang && Array.from(sl.options).some(o => o.value === v.lang)){
    sl.value = v.lang;
  }
  const dd = document.getElementById('voiceGiongDD'); if (dd) dd.classList.remove('mo');
  giongVe();   // vẽ lại thẻ thư viện + nhãn + chính dropdown này
}

function _giongMenuItem(v, chonFn){
  const phat = v.key === _giongPhat, tao = v.key === _giongTao;
  return `<div class="be-item${v.key === _giongChon ? ' sel' : ''}" role="option" onclick="${chonFn}('${escapeHtml(v.key)}')">` +
    `<span class="be-ten">${escapeHtml(v.name)}</span><span class="be-mo">${escapeHtml(v.src || '')}</span>` +
    `<button type="button" class="gplay${phat ? ' on' : ''}" title="${tao ? 'Đang tạo mẫu nghe thử…' : (phat ? 'Dừng nghe thử' : 'Nghe thử 4 giây')}" aria-label="Nghe thử" onclick="event.stopPropagation();giongThu('${escapeHtml(v.key)}')">${tao ? '⏳' : (phat ? '❙❙' : '▶')}</button></div>`;
}

function giongDDVe(){
  const ten = document.getElementById('voiceGiongTen');
  const note = document.getElementById('voiceGiongNote');
  const menu = document.getElementById('voiceGiongMenu');
  const why = document.getElementById('whyGiong');
  if (!ten || !note || !menu) return;
  if (!_giongDS.length){
    ten.textContent = 'chưa có giọng nào';
    note.textContent = '';
    menu.innerHTML = '<div class="be-item" style="cursor:default;color:var(--text-dim)">Chưa có giọng trong thư viện</div>';
    if (why) why.textContent = 'Bấm “＋ Thêm giọng” trong Thư viện giọng phía trên (clone từ file mẫu 5–15 giây, hoặc thiết kế từ mô tả chữ) — lưu xong sẽ chọn được ở đây.';
    return;
  }
  // UX "backend trước": dropdown chỉ liệt kê giọng thuộc backend đang chọn
  // (đổi backend ở "Backend tạo giọng" → danh sách giọng ở đây đổi theo).
  const hopBe0 = _giongDS.filter(v => giongThuocBackend(v));
  if (!hopBe0.length){
    ten.textContent = 'chưa có giọng cho ' + (_TTS_TEN[_voiceBackend] || _voiceBackend);
    note.textContent = '';
    menu.innerHTML = '<div class="be-item" style="cursor:default;color:var(--text-dim)">Backend này chưa có giọng phù hợp</div>';
    if (why) why.textContent = _voiceBackend === 'xtts'
      ? 'XTTS đọc giọng nhân bản: bấm “＋ Thêm giọng” trong Thư viện giọng phía trên để clone từ file mẫu 5–15 giây.'
      : 'Bấm “＋ Thêm giọng” trong Thư viện giọng phía trên để tạo giọng cho backend này (clone từ mẫu hoặc thiết kế từ mô tả).';
    return;
  }
  // Lọc thêm theo ngôn ngữ đã chọn — nếu backend không có giọng nào cho ngôn ngữ
  // đó thì thôi lọc (hiện tất cả) kèm ghi chú, tránh danh sách trắng trơn.
  let hopBe = hopBe0;
  const slL = document.getElementById('voiceLang');
  const lang = slL ? slL.value : '';
  const locLang = lang && lang !== 'all';
  const hopLang = locLang ? hopBe.filter(v => v.lang === lang) : hopBe;
  let chuY = '';
  if (hopLang.length) hopBe = hopLang;
  else if (locLang) chuY = 'Chưa có giọng cho ngôn ngữ này — đang hiện tất cả giọng của backend.';
  // Giọng đang chọn bị lọc ra (đổi ngôn ngữ tay…) → tạm chọn giọng đầu của bộ lọc
  // để nhãn trên dropdown luôn trùng với giọng sẽ được dùng khi tạo tiếng.
  if (hopBe.length && !hopBe.some(v => v.key === _giongChon)) _giongChon = hopBe[0].key;
  const hop = hopBe;
  const cur = hop.find(v => v.key === _giongChon) || hop[0];
  ten.textContent = cur.name;
  note.textContent = cur.src || '';
  menu.innerHTML = (chuY ? '<div class="be-item" style="cursor:default;color:var(--text-dim);font-size:12px">' + escapeHtml(chuY) + '</div>' : '')
    + hop.map(v => _giongMenuItem(v, 'giongDDChon')).join('');
  if (why) why.textContent = '';
}

function giongLibMo(e){
  if (e) e.stopPropagation();
  const dd = document.getElementById('giongLibDD'); if (!dd) return;
  dd.classList.toggle('mo');
  const btn = document.getElementById('giongLibBtn');
  if (btn) btn.setAttribute('aria-expanded', dd.classList.contains('mo') ? 'true' : 'false');
}

function giongLibChon(key){
  const v = _giongDS.find(x => x.key === key); if (!v) return;
  _giongChon = key;
  giongTheoBackend(v);   // chọn giọng → engine/ngôn ngữ đổi theo backend của giọng
  const dd = document.getElementById('giongLibDD'); if (dd) dd.classList.remove('mo');
  giongVe();   // vẽ lại nút, nhãn, lưới (nếu mở) + dropdown "Giọng đọc"
}

function giongLibVe(){
  const ten = document.getElementById('giongLibTen');
  const note = document.getElementById('giongLibNote');
  const menu = document.getElementById('giongLibMenu');
  if (!ten || !note || !menu) return;
  if (!_giongDS.length){
    ten.textContent = 'chưa có giọng nào';
    note.textContent = '';
    menu.innerHTML = '<div class="be-item" style="cursor:default;color:var(--text-dim)">Chưa có giọng trong thư viện</div>';
    return;
  }
  const cur = _giongDS.find(v => v.key === _giongChon);
  ten.textContent = cur ? cur.name : 'chưa chọn giọng';
  note.textContent = cur ? (cur.src || '') : '';
  menu.innerHTML = _giongDS.map(v => _giongMenuItem(v, 'giongLibChon')).join('');
}

function giongLuoiBat(){
  _giongLuoiMo = !_giongLuoiMo;
  const w = document.getElementById('giongLuoiWrap');
  if (w) w.style.display = _giongLuoiMo ? '' : 'none';
  const b = document.getElementById('giongLuoiBtn');
  if (b) b.textContent = _giongLuoiMo ? '▦ Ẩn lưới thẻ' : '▦ Xem dạng lưới thẻ';
}

