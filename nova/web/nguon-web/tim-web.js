/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ TÌM WEB (lùi về khi nền tảng không có API) ═══════════════════════════════ */
function _ddgGo(u) {
  try {
    const p = new URL(String(u), 'https://duckduckgo.com');
    if (p.pathname === '/l/' && p.searchParams.get('uddg')) return decodeURIComponent(p.searchParams.get('uddg'));
    return p.toString();
  } catch (_) { return String(u); }
}
/* Bing giờ bọc MỌI kết quả trong bing.com/ck/a?u=a1<base64url>. Bộ trích xuất
   bên test tool chỉ đọc href thô nên trả về 0 — đây là chỗ sửa.              */
function _bingGo(u) {
  try {
    const p = new URL(String(u).replace(/&amp;/g, '&'));
    let v = p.searchParams.get('u') || '';
    if (!v) return '';
    if (/^a1/i.test(v)) v = v.slice(2);
    const bin = atob(v.replace(/-/g, '+').replace(/_/g, '/'));
    const by = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const s = new TextDecoder('utf-8').decode(by);
    return /^https?:\/\//i.test(s) ? s : '';
  } catch (_) { return ''; }
}

function _webTruyVan(q, plat) {
  const p = _webById(plat);
  const base = String(q || '').replace(/\s+/g, ' ').trim();
  if (!base || !p) return base;
  return p.site ? base + ' site:' + p.site : base;
}
/* Bộ lọc site: KHÔNG đáng tin — đã đo trên chính SearXNG của người dùng:
     "city street site:vimeo.com"  → 0 URL   ·  "vimeo city street"  → 20 URL
     "city street site:flickr.com" → 20 URL  ·  "flickr city street" → 0 URL
   Cùng một máy tìm mà hai dạng cho kết quả ngược nhau, tuỳ engine phía sau có
   tôn trọng site: hay không. Nên thử CẢ HAI dạng rồi gộp, thay vì tin một dạng
   rồi kết luận nền tảng chết.                                                */
function _webTruyVanPhu(q, plat) {
  const p = _webById(plat);
  const base = String(q || '').replace(/\s+/g, ' ').trim();
  if (!base || !p) return '';
  const ten = String(p.ten || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
  return ten ? ten + ' ' + base : '';
}

/* ── Khoá API tìm kiếm (tuỳ chọn) ──────────────────────────────────────────
   44/55 nền tảng không có API tìm riêng. Đã đo: Bing HTML BỎ QUA bộ lọc site:
   (24 link giải mã được, 0 link đúng trang), DuckDuckGo trả 202 chặn mềm. Nên
   muốn nhóm đó ra kết quả đều thì phải có một API tìm kiếm thật. Không có key
   vẫn chạy, chỉ là nhóm ấy hay trắng tay.
   Tiền tố 'api_' để bootstrap ở đầu index.html ghi ra file, thoát app không mất. */
function _webKey() {
  try {
    return {
      may: localStorage.getItem('api_websearch_may') || '',
      key: localStorage.getItem('api_websearch_key') || '',
      base: localStorage.getItem('api_websearch_base') || '',
    };
  } catch (_) { return { may: '', key: '', base: '' }; }
}
/* Thử khoá ngay tại chỗ. Dán khoá xong mà không biết đúng sai thì đến lúc dựng
   video mới phát hiện — đúng cái đã vướng với key Pexels lần trước.
   Truy vấn thử có site: để kiểm luôn thứ quan trọng nhất: máy tìm này CÓ tôn
   trọng bộ lọc site: không (Bing thì không, nên nhóm ○ mới trắng).           */
let _webThuDang = false;
async function webThuKey() {
  if (_webThuDang) return;
  const may = (document.getElementById('webMay') || {}).value || '';
  const key = (document.getElementById('webKey') || {}).value || '';
  const base = (document.getElementById('webBase') || {}).value || '';
  const o = document.getElementById('webThuKQ');
  const bao = (txt, mau) => { if (o) o.innerHTML = `<span style="color:${mau}">${txt}</span>`; };
  if (!may) { bao('Chọn máy tìm trước đã.', 'var(--amber)'); return; }
  if (may === 'brave' && !key) { bao('Chưa dán khoá.', 'var(--amber)'); return; }
  if (may === 'searxng' && !base) { bao('Chưa nhập địa chỉ máy chủ SearXNG.', 'var(--amber)'); return; }

  _webThuDang = true;
  bao('⏳ Đang thử…', 'var(--text-dim)');
  const btn = document.getElementById('webThuBtn');
  if (btn) btn.disabled = true;
  const truy = 'documentary site:archive.org';
  try {
    const urls = (may === 'brave') ? await _webBrave(truy, 5, key) : await _webSearxng(truy, 5, base, key);
    const dung = urls.filter((u) => /(^|\/\/|\.)archive\.org\//i.test(String(u)));
    const hong = (urls._hong || []);
    const vi = hong.length ? ' Máy tìm hỏng: ' + hong.join(', ') + '.' : '';
    if (!urls.length) {
      bao(may === 'searxng'
        ? `⚠️ Kết nối được máy chủ nhưng không máy tìm nào trả kết quả.${vi || ' (máy chủ không nói lý do)'}`
        : '⚠️ Khoá chạy nhưng không trả kết quả nào.', 'var(--amber)');
    } else if (!dung.length) {
      bao(`⚠️ Trả ${urls.length} kết quả nhưng KHÔNG cái nào đúng site: — máy tìm bỏ qua bộ lọc, nhóm ○ vẫn sẽ trắng.${vi}`, 'var(--amber)');
    } else {
      bao(`✓ Chạy tốt — ${dung.length}/${urls.length} kết quả đúng bộ lọc site:. Nhóm ○ dùng được.${vi}`, 'var(--teal)');
    }
  } catch (e) {
    const ma = String((e && e.ma) || '');
    const m = String((e && e.message) || e);
    // Hai máy tìm hỏng theo kiểu hoàn toàn khác nhau nên tách hẳn nhánh. Trộn
    // chung là 429 của SearXNG bị gán nhãn "vượt hạn mức" của Brave — sai chỗ
    // để đi sửa (một bên là hết quota mình mua, một bên là máy chủ chặn bot).
    let goi;
    if (may === 'brave') {
      // Brave có hai dạng thân lỗi: một dạng có error.code, một dạng chỉ có
      // error.detail. Soi cả hai, không thì khoá sai lại hiện nguyên câu tiếng Anh.
      goi = (/SUBSCRIPTION_TOKEN_INVALID/i.test(ma) || /subscription token is invalid/i.test(m)) ? 'khoá sai hoặc chưa kích hoạt'
        : /VALIDATION/i.test(ma) ? 'khoá trống hoặc sai định dạng'
        : (/RATE_LIMIT|QUOTA/i.test(ma) || e.http === 429) ? 'vượt hạn mức của gói, chờ rồi thử lại'
        : /PLAN|SUBSCRIPTION_EXPIRED/i.test(ma) ? 'gói hiện tại không cho dùng web search'
        : (m || 'không rõ lỗi').slice(0, 80);
    } else {
      goi = /KHONG_BAT_JSON/.test(ma) ? 'máy chủ TẮT API JSON — phải thêm "json" vào search.formats trong settings.yml rồi khởi động lại'
        : e.http === 429 ? 'máy chủ chặn nhịp (429) — máy chủ công cộng gần như luôn chặn gọi tự động, phải tự dựng riêng'
        : e.http === 403 ? 'máy chủ từ chối (403) — chặn bot, hoặc cần khoá mà chưa dán'
        : e.http === 401 ? 'máy chủ đòi khoá xác thực — dán khoá vào ô bên cạnh'
        : e.http === 404 ? 'sai địa chỉ — phải là gốc máy chủ, ví dụ https://searx.vidu.com (đừng kèm /search)'
        : (m || 'không kết nối được').slice(0, 80);
    }
    bao('✗ ' + goi, 'var(--red,#e5484d)');
  } finally {
    _webThuDang = false;
    if (btn) btn.disabled = false;
  }
}

function webLuuKey(may, key, base) {
  try {
    localStorage.setItem('api_websearch_may', String(may || ''));
    localStorage.setItem('api_websearch_key', String(key || ''));
    localStorage.setItem('api_websearch_base', String(base || ''));
  } catch (_) {}
  webRenderBang();
}

// Brave Search API — có bậc miễn phí, tôn trọng site:, trả JSON sạch.
async function _webBrave(truy, n, key) {
  const r = await _webGet('https://api.search.brave.com/res/v1/web/search?count=' + Math.min(20, n * 4)
    + '&q=' + encodeURIComponent(truy), { timeoutMs: 15000, headers: { 'X-Subscription-Token': key, accept: 'application/json' } });
  if (!r || !r.ok) {
    // Brave trả 422 cho MỌI lỗi khoá, không phải 401 — đoán theo mã HTTP là gán
    // sai nhãn (đã dính: khoá bịa bị báo thành "gói không hỗ trợ"). Mã thật nằm
    // trong thân phản hồi.
    let ma = '', chiTiet = '';
    try { const e = (JSON.parse(r.text || '{}') || {}).error || {}; ma = String(e.code || ''); chiTiet = String(e.detail || ''); } catch (_) {}
    const e = new Error(chiTiet || (r && r.error) || ('HTTP ' + (r && r.status)));
    e.ma = ma; e.http = r && r.status;
    throw e;
  }
  const d = JSON.parse(r.text);
  return (((d || {}).web || {}).results || []).map((x) => String(x.url || '')).filter(Boolean);
}
// SearXNG — đúng backend mà folder test tool dùng; ai tự dựng hoặc có key thì cắm vào.
async function _webSearxng(truy, n, base, key) {
  const u = String(base).replace(/\/+$/, '') + '/search?format=json&q=' + encodeURIComponent(truy);
  const r = await _webGet(u, { timeoutMs: 15000, headers: key ? { authorization: 'Bearer ' + key, accept: 'application/json' } : { accept: 'application/json' } });
  if (!r || !r.ok) {
    const e = new Error((r && (r.error || ('HTTP ' + r.status))) || 'SearXNG lỗi');
    e.http = r && r.status;
    throw e;
  }
  // Máy chủ SearXNG mặc định TẮT định dạng JSON — nó trả trang HTML kèm HTTP 200.
  // Đo 11 máy chủ công cộng: không cái nào bật JSON và mở cho gọi từ ngoài.
  // Không bắt riêng thì người dùng nhận nguyên câu "Unexpected token '<'".
  let d = null;
  try { d = JSON.parse(r.text); }
  catch (_) {
    const e = new Error('máy chủ trả HTML, không phải JSON');
    e.ma = 'KHONG_BAT_JSON';
    throw e;
  }
  // SearXNG kèm sẵn danh sách máy tìm hỏng kèm lý do (CAPTCHA, too many
  // requests…). Đây là thứ giá trị nhất để chẩn đoán, đừng vứt đi.
  const hong = (Array.isArray(d && d.unresponsive_engines) ? d.unresponsive_engines : [])
    .map((x) => (Array.isArray(x) ? x.join('=') : String(x))).filter(Boolean);
  const ra = (Array.isArray(d && d.results) ? d.results : []).map((x) => String(x.url || '')).filter(Boolean);
  ra._hong = hong;
  return ra;
}

/* ── Ô tìm kiếm của chính trang đó ─────────────────────────────────────────
   Chỉ bật cho nền tảng đã ĐO là đọc được link từ HTML thô (arte.tv,
   democracynow.org). Phần lớn trang khác dựng kết quả bằng JS phía client nên
   HTML thô rỗng không, hoặc chặn bot thẳng — thêm vào chỉ tổ chậm.          */
async function _webTimTrang(p, q, n) {
  const t = p.timTrang;
  if (!t) return [];
  const r = await _webGet(t.url + encodeURIComponent(q), { timeoutMs: 18000 });
  if (!r || !r.ok) return [];
  const h = String(r.text || '');
  const ra = [];
  for (const m of h.matchAll(/(?:href=["']|"url":"|"@id":"|data-url=["'])([^"'<> ]+)/gi)) {
    let u = m[1].replace(/\\\//g, '/');
    if (u.startsWith('/')) u = 'https://' + t.dom + u;
    if (_webUrlHop(p.id, u) && !ra.includes(u)) ra.push(u);
    if (ra.length >= n) break;
  }
  return ra;
}

/* ── Tìm cho MỘT nền tảng không có API riêng ───────────────────────────────
   Thứ tự: API tìm kiếm có key (tốt nhất) → ô tìm của chính trang → DuckDuckGo
   → Bing. Dừng ngay khi đủ số cần, để không tiêu lượt vô ích.               */
async function _webTimQuaCongCu(platId, q, n) {
  const p = _webById(platId);
  if (!p) return [];
  const truy = _webTruyVan(q, platId);
  const ra = [];
  const them = (u) => { if (u && _webUrlHop(platId, u) && !ra.includes(u)) ra.push(u); };

  // 1) API tìm kiếm thật — không đụng phanh nhịp vì đây là dịch vụ trả tiền/tự dựng.
  const K = _webKey();
  const mayTim = async (t, soLay) => {
    if (K.key && K.may === 'brave') return await _webBrave(t, soLay, K.key);
    if (K.may === 'searxng' && K.base) return await _webSearxng(t, soLay, K.base, K.key);
    return [];
  };
  if (ra.length < n) {
    // Lấy dư (n*3) rồi mới lọc: máy tìm hay trả link chết/link không phải trang xem.
    try { (await mayTim(truy, n * 3)).forEach(them); } catch (_) {}
    // Dạng site: không ra thì thử dạng "tên-nền-tảng + từ khoá".
    if (!ra.length) {
      const phu = _webTruyVanPhu(q, platId);
      if (phu) { try { (await mayTim(phu, n * 3)).forEach(them); } catch (_) {} }
    }
  }

  // 2) Ô tìm của chính trang.
  if (ra.length < n && p.timTrang) {
    try { (await _webTimTrang(p, q, n)).forEach(them); } catch (_) {}
  }

  // 3–4) Công cụ tìm kiếm chung — chỉ tới đây mới tính phanh nhịp.
  if (ra.length < n) {
    _WEB_NHIP.chan = _WEB_NHIP.chan_ddg && _WEB_NHIP.chan_bing;   // tổng = cả hai cùng chết
    if (_WEB_NHIP.chan) { if (!ra.length) throw new Error('công cụ tìm đang chặn — cắm khoá API tìm kiếm hoặc nghỉ vài phút'); }
    else if (_WEB_NHIP.daDung >= _WEB_NHIP.tran) {
      _WEB_NHIP.chan = true;
      if (!ra.length) throw new Error('đã dùng hết ' + _WEB_NHIP.tran + ' lượt tìm web của phiên này');
    } else {
      /* Trước đây cờ `chan` dùng CHUNG cho cả hai máy: DuckDuckGo bị chặn mềm
         là đặt cờ, rồi dòng đầu vòng lặp kế tiếp thấy cờ liền break — Bing
         không bao giờ chạy. Nay mỗi máy một cờ riêng.                       */
      for (const may of ['ddg', 'bing']) {
        if (ra.length >= n) break;
        if (_WEB_NHIP['chan_' + may]) continue;
        await _webChoNhip();
        _WEB_NHIP.daDung++;
        const url = may === 'ddg'
          ? 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(truy)
          : 'https://www.bing.com/search?q=' + encodeURIComponent(truy);
        const r = await _webGet(url, { timeoutMs: 15000 });
        if (!r || !r.ok) { if (r && r.status === 403) _WEB_NHIP['chan_' + may] = true; continue; }
        // DuckDuckGo chặn mềm bằng 202 + trang rỗng, không phải 403 — phải bắt cả kiểu này.
        if (may === 'ddg' && (r.status === 202 || String(r.text || '').length < 20000)) { _WEB_NHIP.chan_ddg = true; continue; }
        const h = String(r.text || '');
        if (may === 'ddg') {
          for (const m of h.matchAll(/href=["']([^"'<> ]+)["']/gi)) them(_ddgGo(m[1]));
        } else {
          for (const m of h.matchAll(/href="(https?:\/\/www\.bing\.com\/ck\/a[^"]+)"/gi)) them(_bingGo(m[1]));
          for (const m of h.matchAll(/href="(https?:\/\/(?!www\.bing\.com|r\.bing\.com|go\.microsoft)[^"<> ]+)"/gi)) them(m[1]);
        }
      }
    }
  }

  // Các đường trên chỉ trả URL trần: không tiêu đề, không ảnh, không thời lượng.
  // yt-dlp đọc được ~1800 trang nên hỏi nó là ra đủ — và cái nào nó không đọc
  // được thì tải cũng hỏng, loại luôn ở đây còn hơn để người dùng bấm mới biết.
  /* Máy tìm hay trả video đã bị xoá/khoá vùng (đã đo trên YouTube: link đầu
     SearXNG trả về báo "Video unavailable" trong khi YouTube vẫn chạy tốt).
     Nên hỏi yt-dlp nhiều link hơn số cần, ai đọc được thì giữ — một vài link
     chết không được phép làm cả nền tảng bị coi là hỏng.                     */
  const nt = _webNative();
  const giu = ra.slice(0, Math.max(n, Math.min(n * 3, 12)));
  if (!giu.length) return [];
  if (!nt) return giu.map((u) => ({ url: u, ten: u, anh: '', giay: 0, giayPhep: '', tacGia: '' }));
  const tt = await Promise.all(giu.map((u) => nt.info({ url: u, timeoutMs: 30000 }).catch(() => null)));
  return giu.map((u, i) => {
    const t = tt[i];
    if (!t || !t.ok) return null;
    return { url: u, ten: t.ten || u, anh: t.anh || '', giay: t.giay || 0, giayPhep: t.giayPhep || '', tacGia: t.tacGia || '' };
  }).filter(Boolean).slice(0, n);
}