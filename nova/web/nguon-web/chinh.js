/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ TÌM TRÊN CÁC NGUỒN WEB ĐANG BẬT ═════════════════════════════════════════
   Trả ứng viên đúng hình dạng ứng viên stock để cắm thẳng vào bảng chọn có
   sẵn: { kind, downloadUrl, source, duration, thumb, license, author }.
   Khác một điểm: downloadUrl ở đây là URL TRANG, không phải file media — nên
   có cờ 'web:true' để đường tải biết phải đi qua yt-dlp.                     */
async function searchWebSources(query, opts) {
  const o = opts || {};
  const q = String(query || '').trim();
  if (!q) return { items: [], loi: [] };
  /* Pexels/Pixabay/Unsplash/NASA/Openverse do máy stock & kho lo (searchAllSources
     bên index.html), KHÔNG đi đường này — lọt vào đây là gọi _WEB_API['stock']
     không tồn tại rồi ném lỗi giả vào danh sách lỗi.                          */
  const ds = ((Array.isArray(o.platIds) && o.platIds.length)
    ? o.platIds.map(_webById).filter(Boolean)
    : _webDangBat()).filter((p) => p.may !== 'stock' && p.may !== 'kho');
  if (!ds.length) return { items: [], loi: ['chưa bật nền tảng nào'] };

  const moiNen = Math.max(2, Math.min(8, Number(o.moiNen) || 4));
  const items = [];
  const loi = [];

  // API riêng chạy song song (nhanh, không đụng phanh nhịp);
  // nhóm phải tìm web thì chạy tuần tự vì có phanh.
  const coApi = ds.filter((p) => p.api);
  const khongApi = ds.filter((p) => !p.api);

  const gom = (p, arr) => {
    (arr || []).forEach((x) => {
      if (!x || !x.url) return;
      items.push({
        kind: 'video',
        downloadUrl: x.taiThang || x.url,
        trangUrl: x.url,
        web: true,
        platId: p.id,
        source: 'web:' + p.id,
        nhom: p.nhom,
        duration: Number(x.giay) || 0,
        thumb: x.anh || '',
        license: _webGoEntity(x.giayPhep),
        author: _webGoEntity(x.tacGia),
        ten: _webGoEntity(x.ten),
        // Không CHẶN ở đây: bạn đã cố ý bật nhóm nền tảng có bản quyền, chặn
        // riêng mấy nguồn trung thực khai báo NC là ngược đời. Gắn cờ để lượt
        // tự động bỏ qua, còn chọn tay thì vẫn thấy kèm nhãn đỏ.
        camTM: _webGpCam(x.giayPhep),
      });
    });
  };

  const nho = (p, arr) => { _webNho.set(_webNhoKey(p.id, q), arr); return arr; };
  const lay = (p) => _webNho.get(_webNhoKey(p.id, q));

  await Promise.all(coApi.map(async (p) => {
    const cu = lay(p);
    if (cu) { gom(p, cu); return; }
    try { gom(p, nho(p, await _WEB_API[p.api](q, moiNen))); }
    catch (e) { loi.push(p.ten + ': ' + String((e && e.message) || e).slice(0, 40)); }
  }));

  /* Nhóm ○ phải chạy TUẦN TỰ vì có phanh nhịp. Bật cả 43 nền tảng mà chạy hết
     là 43 × 2 lượt × 5 giây > 7 phút cho MỘT cảnh, và hết sạch hạn mức 40 lượt
     ngay ở nền tảng thứ hai mươi. Nên chặn trần theo việc có khoá hay không:
     có khoá thì gọi API trả tiền, không đụng phanh, đi được nhiều; không khoá
     thì mỗi lượt đều tốn 5 giây mà xác suất ra kết quả thấp — đi ít thôi.
     Bỏ bớt bao nhiêu thì NÓI RA, không cắt lặng.                             */
  const coKhoaTim = (() => { const K = _webKey(); return !!(K.key || (K.may === 'searxng' && K.base)); })();
  const tranO = coKhoaTim ? 15 : 3;

  /* Đo được: tầng ● cho 15 ứng viên trong ~1 giây, tầng ◐/○ thêm 5 ứng viên mà
     tốn 64 giây (phần lớn là yt-dlp đọc thông tin từng URL trần). Với video vài
     trăm cảnh thì tỉ lệ đó không dùng được. Nên tầng chậm chỉ chạy khi tầng
     nhanh CHƯA ĐỦ để chọn — hoặc khi người dùng bấm "Tìm thêm" (o.day).      */
  const DU = Math.max(6, moiNen * 2);
  if (!o.day && items.length >= DU) {
    if (khongApi.length) loi.push(`đã đủ ${items.length} ứng viên từ nguồn nhanh — bỏ qua ${khongApi.length} nền tảng chậm (bấm 🔎 Tìm thêm nếu muốn quét cả nhóm đó)`);
    khongApi.length = 0;
  }
  // Nền tảng ◐ (đọc được ô tìm của chính trang) không tốn phanh nhịp → luôn thử.
  const uuTien = khongApi.filter((p) => p.timTrang);
  const conLai = khongApi.filter((p) => !p.timTrang);
  const chay = uuTien.concat(conLai.slice(0, tranO));
  const boQua = khongApi.length - chay.length;

  for (const p of chay) {
    if (o.dungLai && o.dungLai()) break;
    const cu = lay(p);
    if (cu) { gom(p, cu); continue; }
    try { gom(p, nho(p, await _webTimQuaCongCu(p.id, q, moiNen))); }
    catch (e) {
      loi.push(p.ten + ': ' + String((e && e.message) || e).slice(0, 40));
      if (_WEB_NHIP.chan) { loi.push('… dừng tìm web, các nền tảng còn lại bỏ qua'); break; }
    }
  }
  if (boQua > 0) loi.push(`bỏ qua ${boQua} nền tảng nhóm ○ cho lượt này (trần ${tranO}${coKhoaTim ? '' : ' vì chưa cắm khoá API tìm kiếm'})`);

  // Trộn XEN KẼ theo nền tảng để đầu danh sách không phải toàn một nơi.
  const theoNen = new Map();
  items.forEach((x) => { if (!theoNen.has(x.platId)) theoNen.set(x.platId, []); theoNen.get(x.platId).push(x); });
  const tron = [];
  const dai = Math.max(0, ...[...theoNen.values()].map((a) => a.length));
  for (let i = 0; i < dai; i++) for (const a of theoNen.values()) if (a[i]) tron.push(a[i]);

  return { items: tron, loi };
}

/* ══ LẤY CLIP CHO MỘT CẢNH ═══════════════════════════════════════════════════
   Ứng viên web là URL trang → phải qua yt-dlp mới thành file. Cắt luôn đúng
   số giây của cảnh rồi trả data URL, giống hệt đường clip YouTube đang chạy,
   nên xem trước và xuất video không phải sửa gì.                             */
async function webLayClip(cand, giay) {
  const nt = _webNative();
  if (!nt) return { ok: false, error: 'chỉ chạy trong app Nova' };
  if (!window.native || typeof window.native.readFileB64 !== 'function') return { ok: false, error: 'thiếu cầu đọc file' };
  const url = (cand && (cand.trangUrl || cand.downloadUrl)) || '';
  if (!url) return { ok: false, error: 'ứng viên không có URL' };
  const dur = Math.max(1.5, Number(giay) || 4);
  // Bỏ qua đoạn mở đầu: tư liệu dài hay có logo/intro ở đầu, cắt từ giây 0 là dính.
  const start = (Number(cand.duration) > dur * 3) ? Math.floor(Number(cand.duration) * 0.15) : 0;
  const r = await nt.clip({ url, dur, start });
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'tải clip lỗi' };
  const b = await window.native.readFileB64(r.path);
  if (!b || !b.dataUrl) return { ok: false, error: 'không đọc được clip đã tải' };
  return { ok: true, dataUrl: b.dataUrl, path: r.path, duration: dur };
}

// Nhãn nguồn cho thẻ ứng viên (⚠️ với nhóm có bản quyền).
function webNhan(platId) {
  const p = _webById(platId);
  if (!p) return '🌐 web';
  return (p.nhom === 'cong' ? '🏛 ' : '⚠️ ') + p.ten;
}

try {
  window.NOVA_WEB_NEN_TANG = NOVA_WEB_NEN_TANG;
  window.searchWebSources = searchWebSources;
  window.webLayClip = webLayClip;
  window.webNhan = webNhan;
  window._webGpCam = _webGpCam;
  window.webMoBang = webMoBang;
  window.webDongBang = webDongBang;
  window.webRenderBang = webRenderBang;
  window.webToggle = webToggle;
  window.webToggleNhom = webToggleNhom;
  window.webToggleCauHinh = webToggleCauHinh;
  window.webKiemTra = webKiemTra;
  window.webLuuKey = webLuuKey;
  window.webThuKey = webThuKey;
  window.webTrangThaiNhip = webTrangThaiNhip;
  window.webResetNhip = webResetNhip;
  window._webDangBat = _webDangBat;
  window._webUrlHop = _webUrlHop;
  window._webNhanDang = _webNhanDang;
} catch (_) {}
