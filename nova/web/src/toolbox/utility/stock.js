/* STOCK — tìm media đa nguồn (Pexels/Pixabay/Unsplash/archives), web picker, tải & xuất CSV/SRT
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function savePexelsKey(){
  const el = document.getElementById('pexelsKey'); if (!el) return;
  const key = el.value.trim();
  // bỏ 'if (!key) return' — xoá ô rồi bấm Lưu là phải xoá được key sai, chứ không
  // phải im lặng giữ nguyên cái cũ (hai hàm Pixabay/Unsplash bên dưới vốn đã vậy).
  try { localStorage.setItem('pexels-key', key); } catch (e) {}
  try { delete _t2StockTT['pexels']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Pexels API key.', 'ok');
}

function loadPexelsKey(){
  try {
    const el = document.getElementById('pexelsKey'); if (!el) return;
    const k = localStorage.getItem('pexels-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('pexels-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getPexelsKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('pexelsKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('pexels-key') || '').trim(); } catch (e) { return ''; }
}

function loadScenesForSearch(){
  if (state.scenes.length === 0) return setStatus5('Tool 02 chưa có cảnh. Chia cảnh trước.', 'error');
  renderSceneSearchList();
  updatePickCount();
  setStatus5(`✓ Đã load ${state.scenes.length} cảnh từ Tool 02.`, 'ok');
}

function renderSceneSearchList(){
  const box = document.getElementById('mediaSearchResults');
  if (!box) return;
  box.innerHTML = state.scenes.map(s => `
    <div class="panel mb-16" id="media-${s.id}">
      <div class="panel-head">
        <span style="color:var(--accent);font-weight:600">[${s.id}]</span>
        <span style="flex:1;margin-left:10px;font-size:12.5px;color:var(--text);font-weight:400;text-transform:none;letter-spacing:0">${escapeHtml(s.text)}</span>
        <button class="btn ghost sm" onclick="searchForScene('${s.id}')">🔍 Tìm</button>
      </div>
      <div class="panel-body" id="media-results-${s.id}" style="min-height:40px">
        <span style="color:var(--text-dim);font-size:11.5px">Bấm Tìm hoặc Tìm tất cả</span>
      </div>
    </div>
  `).join('');
  // Khôi phục kết quả đã tìm trong phiên + lựa chọn đã lưu
  for (const s of state.scenes) {
    const cached = _t5Results[s.id];
    if (cached) renderSceneResults(s.id, cached.keywords, cached);
    else if (state.mediaPicks?.[s.id]) renderSceneResults(s.id, '', { photos: [], videos: [] });
  }
}

async function generateSearchAngles(voText, opts){
  const o = opts || {};
  const topic = String(state.videoLogline || '').trim();
  const vaiTro = o.role || ((state.aiMap || {})[o.sceneId] || {}).role || '';
  const truoc = String(o.truoc || '').trim(), sau = String(o.sau || '').trim();

  const prompt = `You are a footage researcher for documentary-style videos. Generate stock-library SEARCH KEYWORDS.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}${vaiTro ? 'SCENE ROLE: ' + vaiTro + '\n' : ''}
THIS SCENE'S VOICEOVER LINE: "${voText}"
${truoc ? 'Previous line: "' + truoc + '"\n' : ''}${sau ? 'Next line: "' + sau + '"\n' : ''}
⚠️ COMMON TRAP: voiceover lines often borrow an object for COMPARISON ("cheaper than a cup of coffee",
"big as a bus", "thin as paper"). That object is NOT the subject of the scene —
the subject is what the whole video is about. Pulling eight coffee clips for a video about
aviation is wrong. If there is a comparison object, put it in the "doi-chieu" angle, NEVER
as the first angle.

Return 2–3 DIFFERENT search angles, each 2–4 short English keywords (concrete nouns,
no vague adjectives). You may add EXACTLY 1 camera keyword if it truly fits:
aerial, close-up, macro, top-down, timelapse, slow motion, handheld.

Usable angles:
- "chu-the"   — the literal thing this scene talks about. ALWAYS present, always first.
- "boi-canh"  — surrounding place / atmosphere, for b-roll.
- "doi-chieu" — an object used for comparison or metaphor, ONLY if the line truly has one.

Return JSON: [{"goc":"chu-the","q":"airline profit margin"},{"goc":"boi-canh","q":"airport terminal wide"}]`;

  try {
    const arr = await callLLMJson(prompt, { maxTokens: 300,
      validate: a => Array.isArray(a) && a.length > 0 && a.every(x => x && x.q) });
    const ok = ['chu-the', 'boi-canh', 'doi-chieu'];
    const ra = arr.map(x => ({ goc: ok.includes(x.goc) ? x.goc : 'chu-the', q: String(x.q || '').trim() }))
      .filter(x => x.q).slice(0, 3);
    // Ép chủ thể lên đầu: model đôi khi vẫn xếp đối chiếu trước dù đã dặn.
    ra.sort((a, b) => ok.indexOf(a.goc) - ok.indexOf(b.goc));
    return ra.length ? ra : null;
  } catch (_) { return null; }
}

function _t2TronNguon(cands){
  const theo = {};
  cands.forEach(c => { (theo[c.source || 'stock'] = theo[c.source || 'stock'] || []).push(c); });
  const ds = Object.values(theo), ra = [];
  const n = Math.max(0, ...ds.map(a => a.length));
  for (let i = 0; i < n; i++) for (const a of ds) if (a[i]) ra.push(a[i]);
  return ra;
}

function _t2TronGoc(theoGoc){
  const ra = [], n = Math.max(...theoGoc.map(g => g.cands.length), 0);
  for (let i = 0; i < n; i++)
    for (const g of theoGoc)
      if (g.cands[i]) ra.push(Object.assign({ goc: g.goc, q: g.q }, g.cands[i]));
  return ra;
}

async function generateSearchKeywords(voText, opts){
  // fallback: rút vài từ khoá từ chính VO nếu AI lỗi
  const fallback = () => (voText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(', ')) || voText.slice(0, 40);
  const o = opts || {};
  // Giữ tương thích: bậc cũ {broader:true} tương đương bậc 3.
  const bac = Number(o.bac) || (o.broader ? 3 : 1);
  const chuDe = String(state.videoLogline || '').trim();

  const LUAT = 'Rules: the subject goes FIRST. Return a JSON array where EACH ELEMENT IS ONE short English keyword '
    + '(2-4 elements), do not cram multiple keywords into one element, do not repeat the subject across elements. '
    + 'Stock libraries search by keyword, they do not understand sentences — no full sentences, no vague adjectives '
    + '(beautiful, amazing, stunning). You may add 1 camera keyword if it fits: aerial, close-up, timelapse, slow motion.';

  const P = {
    1: `Generate 2-4 stock photo/video search keywords for the content below — TIER "EXACT": the actual event, subject or action mentioned.
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.
CONTENT: "${voText}"`,

    2: `Exact-tier keywords for "${voText}" are returning 0 results.
Generate 2-4 English keywords for TIER "SURROUNDINGS": stop searching for the event itself, search what is AROUND it —
the place it happens, related objects, crowds, building facades, equipment, vehicles.
Example: "an airline-margin hearing" → tier 2 is "airport terminal exterior, airline counter, boarding gate".
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.`,

    3: `Both previous tiers for "${voText}" returned 0 results.
Generate 2-3 BROAD, SIMPLE English keywords for TIER "GENERIC B-ROLL": pretty b-roll on the same topic,
accepting no detail match, as long as it surely exists in stock libraries.
${chuDe ? 'WHOLE VIDEO TOPIC: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Return a JSON array of strings.`,
  };

  try {
    const arr = await callLLMJson(P[bac] || P[1], { maxTokens: 200, validate: a => Array.isArray(a) && a.length > 0 });
    /* Luật "chủ thể đứng ĐẦU" khiến model hay lặp lại chủ thể trước mỗi từ khoá:
       "Warren Buffett, portrait, Warren Buffett, speaking, Warren Buffett".
       Trùng lặp chỉ làm loãng truy vấn — bỏ trùng, không phân biệt hoa thường. */
    const thay = new Set();
    return arr
      .flatMap(s => String(s).split(','))        // mỗi phần tử có thể là "a, b, c" → tách ra đã
      .map(s => s.trim()).filter(Boolean)
      .filter(s => { const k = s.toLowerCase(); if (thay.has(k)) return false; thay.add(k); return true; })
      .slice(0, 5).join(', ');
  } catch (_) {
    return fallback();
  }
}

function savePixabayKey(){
  const key = document.getElementById('pixabayKey').value.trim();
  try { localStorage.setItem('pixabay-key', key); } catch (e) {}
  try { delete _t2StockTT['pixabay']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Pixabay API key.', 'ok');
}

function loadPixabayKey(){
  try {
    const el = document.getElementById('pixabayKey'); if (!el) return;
    const k = localStorage.getItem('pixabay-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('pixabay-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getPixabayKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('pixabayKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('pixabay-key') || '').trim(); } catch (e) { return ''; }
}

function saveUnsplashKey(){
  const key = document.getElementById('unsplashKey').value.trim();
  try { localStorage.setItem('unsplash-key', key); } catch (e) {}
  try { delete _t2StockTT['unsplash']; t2RenderStockRows(); } catch (e) {}
  setStatus5('✓ Đã lưu Unsplash Access Key.', 'ok');
}

function loadUnsplashKey(){
  try {
    const el = document.getElementById('unsplashKey'); if (!el) return;
    const k = localStorage.getItem('unsplash-key');
    if (k) el.value = k;
    // tự lưu khi rời ô: gõ xong quên bấm 💾 là mất trắng, mà chẳng có gì báo
    if (!el._autoSave){
      el._autoSave = 1;
      el.addEventListener('change', () => { try { localStorage.setItem('unsplash-key', el.value.trim()); } catch (e) {} });
    }
  } catch (e) {}
}

function getUnsplashKey(){
  // Lấy từ Ô TRƯỚC, không có thì quay về localStorage. Trước đây chỉ đọc ô, nên hễ
  // ô chưa kịp nạp (hoặc nạp hỏng) là coi như "chưa có key" — tìm clip stock chết
  // câm dù key vẫn nằm nguyên trong máy.
  const el = document.getElementById('unsplashKey');
  const v = el ? el.value.trim() : '';
  if (v) return v;
  try { return (localStorage.getItem('unsplash-key') || '').trim(); } catch (e) { return ''; }
}

async function searchUnsplash(query, type = 'both'){
  const key = getUnsplashKey();
  const results = { photos: [], videos: [] };
  if (!key || type === 'videos') return results;
  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=4&orientation=landscape`,
      { headers: { 'Authorization': 'Client-ID ' + key } }
    );
    if (r.ok) {
      const d = await r.json();
      results.photos = (d.results || []).map(h => ({
        url: h.links?.html || h.urls?.regular,
        width: h.width, height: h.height,
        src: { small: h.urls?.small, large: h.urls?.regular, original: h.urls?.full },
        _source: 'unsplash',
        _downloadUrl: h.urls?.full || h.urls?.regular
      }));
    } else results._err = 'Unsplash ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 403 ? ' — hết lượt' : ''));
  } catch (e) { results._err = 'Unsplash: ' + String(e.message || e).slice(0, 40); }
  return results;
}

function _pixabayThumbFromUrl(u){
  const s = String(u || '');
  return /^https?:\/\/cdn\.pixabay\.com\/video\/.+\.mp4/i.test(s) ? s.split('?')[0].replace(/\.mp4$/i, '.jpg') : '';
}

function _stockThumb(c){
  if (!c) return '';
  const t = c.thumb || c.thumbnail || '';
  if (t && !/i\.vimeocdn\.com/i.test(t) && !/undefined/.test(t)) return t;
  return _pixabayThumbFromUrl(c.downloadUrl || c.url) || (/i\.vimeocdn\.com|undefined/i.test(t) ? '' : t);
}

async function searchPixabay(query, type = 'both'){
  const key = getPixabayKey();
  if (!key) return { photos: [], videos: [] };
  const results = { photos: [], videos: [] };

  if (type === 'both' || type === 'photos') {
    try {
      const r = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&per_page=8&orientation=horizontal&image_type=photo`);
      if (r.ok) {
        const d = await r.json();
        // Chuẩn hoá về format giống Pexels
        results.photos = (d.hits || []).map(h => ({
          url: h.pageURL,
          width: h.imageWidth, height: h.imageHeight,
          src: { small: h.previewURL, large: h.largeImageURL, original: h.largeImageURL },
          _source: 'pixabay',
          _downloadUrl: h.largeImageURL
        }));
      }
      else results._err = 'Pixabay ' + r.status + (r.status === 429 ? ' — hết lượt' : '');
    } catch (e) { results._err = 'Pixabay: ' + String(e.message || e).slice(0, 40); }
  }

  if (type === 'both' || type === 'videos') {
    try {
      const r = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=8`);
      if (r.ok) {
        const d = await r.json();
        results.videos = (d.hits || []).map(h => ({
          url: h.pageURL,
          duration: h.duration,
          // Pixabay đã BỎ trường picture_id → link i.vimeocdn.com/video/undefined_… luôn 404
          // (ô xem trước đen thui). Ảnh đại diện giờ nằm ngay trong từng cỡ video.
          image: (h.videos?.large?.thumbnail || h.videos?.medium?.thumbnail || h.videos?.small?.thumbnail
                  || h.videos?.tiny?.thumbnail || _pixabayThumbFromUrl(h.videos?.large?.url) || ''),
          _source: 'pixabay',
          _downloadUrl: (h.videos?.large?.url || h.videos?.medium?.url || h.videos?.small?.url)
        }));
      }
      else results._err = 'Pixabay ' + r.status + (r.status === 429 ? ' — hết lượt' : '');
    } catch (e) { results._err = 'Pixabay: ' + String(e.message || e).slice(0, 40); }
  }
  return results;
}

async function _khoJson(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(r.status + '');
  return r.json();
}

async function _khoWikimedia(q, n){
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + '&generator=search&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap')
    + '&gsrnamespace=6&gsrlimit=' + n + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280';
  const d = await _khoJson(u);
  return Object.values((d.query && d.query.pages) || {}).map(p => {
    const ii = (p.imageinfo || [])[0] || {}, m = ii.extmetadata || {};
    const lic = _khoText((m.LicenseShortName || {}).value);
    if (!_khoOk(lic)) return null;
    const url = ii.thumburl || ii.url;
    // ii.url giờ kèm tham số UTM (…?utm_source=…&utm_content=original) nên phải cắt
    // query trước khi kiểm đuôi file, không thì mọi ảnh đều bị loại.
    const sach = String(ii.url || '').split('?')[0];
    // Wikimedia dựng sẵn bản thu nhỏ JPEG cho cả .TIF/.SVG, nên soi ĐUÔI FILE GỐC
    // là loại oan ảnh dùng được (đã đo: mất "Nut cracking Sapajus libidinosus.TIF").
    // Có thumburl nghĩa là Wikimedia render được — chỉ cần chặn thẳng tài liệu/âm thanh.
    if (!url || !ii.thumburl) return null;
    if (/\.(pdf|djvu|ogg|oga|mid|flac|wav|webm|ogv|mp3)$/i.test(sach)) return null;
    return { url: p.title, src: { small: ii.thumburl || url, large: url, original: ii.url || url },
      _source: 'wikimedia', _downloadUrl: ii.url || url,
      _license: lic, _author: _khoText((m.Artist || {}).value).slice(0, 60) };
  }).filter(Boolean);
}

async function _khoNasa(q, n){
  const d = await _khoJson('https://images-api.nasa.gov/search?media_type=image&q=' + encodeURIComponent(q));
  return ((d.collection && d.collection.items) || []).slice(0, n).map(it => {
    const dat = (it.data || [])[0] || {}, link = (it.links || [])[0] || {};
    if (!link.href) return null;
    return { url: dat.nasa_id, src: { small: link.href, large: link.href, original: link.href },
      _source: 'nasa', _downloadUrl: link.href, _license: 'Public domain (NASA)',
      _author: _khoText(dat.center || 'NASA') };
  }).filter(Boolean);
}

async function _khoOpenverse(q, n){
  const d = await _khoJson('https://api.openverse.org/v1/images/?page_size=' + n
    + '&q=' + encodeURIComponent(q));
  return (d.results || []).map(r => {
    const lic = String(r.license || '') + (r.license_version ? ' ' + r.license_version : '');
    if (!_khoOk(lic)) return null;                      // chặn by-nc / by-nd ngay ở đây
    const url = r.url || r.thumbnail;
    if (!url) return null;
    return { url: r.foreign_landing_url || url, src: { small: r.thumbnail || url, large: url, original: url },
      _source: 'openverse', _downloadUrl: url,
      _license: 'CC ' + lic.toUpperCase(), _author: _khoText(r.creator).slice(0, 60) };
  }).filter(Boolean);
}

async function _khoArchive(q, n){
  const truyVan = q + ' AND mediatype:(movies) AND (licenseurl:(*creativecommons*) OR rights:(*public domain*))';
  const d = await _khoJson('https://archive.org/advancedsearch.php?output=json&rows=' + n
    + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=licenseurl&fl%5B%5D=creator'
    + '&q=' + encodeURIComponent(truyVan));
  return ((d.response && d.response.docs) || []).map(x => {
    const lic = String(x.licenseurl || 'public domain');
    if (x.licenseurl && _KHO_CAM.test(lic)) return null;
    return { url: 'https://archive.org/details/' + x.identifier, duration: 0,
      image: 'https://archive.org/services/img/' + x.identifier,
      _source: 'archive', _downloadUrl: 'https://archive.org/download/' + x.identifier + '/' + x.identifier + '.mp4',
      _license: lic.replace('https://creativecommons.org/', 'CC ').replace(/\/$/, ''),
      _author: _khoText(x.creator).slice(0, 60), _canKiem: true };
  }).filter(Boolean);
}

async function searchOpenArchives(query, type = 'both'){
  const kq = { photos: [], videos: [] };
  const loi = [];
  const chay = [];
  if (type !== 'videos'){
    chay.push(['Wikimedia', _khoWikimedia(query, 6)], ['NASA', _khoNasa(query, 5)], ['Openverse', _khoOpenverse(query, 6)]);
  }
  if (type !== 'photos') chay.push(['Archive.org', _khoArchive(query, 6)]);
  const ra = await Promise.all(chay.map(([ten, p]) => p.then(v => ({ ten, v })).catch(e => ({ ten, e }))));
  ra.forEach(({ ten, v, e }) => {
    if (e){ loi.push(ten + ': ' + String(e.message || e).slice(0, 24)); return; }
    if (ten === 'Archive.org') kq.videos.push(...v); else kq.photos.push(...v);
  });
  if (loi.length) kq._err = loi;
  return kq;
}

async function searchPexels(query, type = 'both'){
  const key = getPexelsKey();
  const results = { photos: [], videos: [] };
  if (!key) return results;
  const headers = { 'Authorization': key };

  if (type === 'both' || type === 'photos') {
    try {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        results.photos = (d.photos || []).map(p => ({ ...p, _source: 'pexels', _downloadUrl: p.src?.original || p.src?.large2x || p.src?.large }));
      } else results._err = 'Pexels ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 429 ? ' — hết lượt hôm nay' : ''));
    } catch (e) { results._err = 'Pexels: ' + String(e.message || e).slice(0, 40); }
  }

  if (type === 'both' || type === 'videos') {
    try {
      const r = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        results.videos = (d.videos || []).map(v => {
          // Lấy file video chất lượng cao nhất
          const best = (v.video_files || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
          return { ...v, _source: 'pexels', _downloadUrl: best?.link || '' };
        });
      } else results._err = 'Pexels ' + r.status + (r.status === 401 ? ' — key sai' : (r.status === 429 ? ' — hết lượt hôm nay' : ''));
    } catch (e) { results._err = 'Pexels: ' + String(e.message || e).slice(0, 40); }
  }
  return results;
}

async function searchAllSources(query, type = 'both'){
  const [pexels, pixabay, unsplash] = await Promise.all([
    searchPexels(query, type),
    searchPixabay(query, type),
    searchUnsplash(query, type)
  ]);
  // Nguồn nào hỏng thì NÓI RA. Trước đây trả mảng rỗng nên key sai vẫn im như thóc,
  // người dùng chỉ thấy "ít ứng viên" mà không biết một nguồn đang chết.
  // Kho mở chỉ chạy khi người dùng BẬT — nó thêm 4 lượt gọi mạng mỗi lần tìm.
  let kho = { photos: [], videos: [] };
  if ((state.nguonBat || {}).kho){
    try { kho = await searchOpenArchives(query, type); } catch (e) { kho = { photos: [], videos: [], _err: ['Kho mở: ' + String(e.message || e).slice(0, 30)] }; }
  }
  const _err = [pexels._err, pixabay._err, unsplash._err].filter(Boolean).concat(kho._err || []);
  return {
    _err,
    photos: [...(pexels.photos || []), ...(pixabay.photos || []), ...(unsplash.photos || []), ...(kho.photos || [])],
    videos: [...(pexels.videos || []), ...(pixabay.videos || []), ...(kho.videos || [])]
  };
}

async function searchForScene(sceneId){
  const scene = state.scenes.find(s => s.id === sceneId);
  if (!scene) return;
  if (!getPexelsKey() && !getPixabayKey() && !getUnsplashKey()) return setStatus5('Cần ít nhất 1 API key (Pexels / Pixabay / Unsplash).', 'error');

  const box = document.getElementById('media-results-' + sceneId);
  box.innerHTML = '<div style="font-size:11.5px;color:var(--violet);margin-bottom:8px"><span class="spinner" style="vertical-align:-2px"></span> Đang tìm media...</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + '<div class="skeleton sk-tile"></div>'.repeat(6) + '</div>';

  try {
    let keywords = await generateSearchKeywords(scene.text);
    const type = document.getElementById('mediaType').value;
    let results = await searchAllSources(keywords, type);
    // Query rỗng kết quả → tự thử lại 1 lần với từ khoá rộng/đơn giản hơn (thay vì để trắng cảnh)
    if (!(results.photos || []).length && !(results.videos || []).length) {
      try {
        const broaderKw = await generateSearchKeywords(scene.text, { broader: true });
        if (broaderKw && broaderKw !== keywords) {
          const retryResults = await searchAllSources(broaderKw, type);
          if ((retryResults.photos || []).length || (retryResults.videos || []).length) {
            keywords = broaderKw + ' (đã nới rộng)';
            results = retryResults;
          }
        }
      } catch (_) { /* giữ kết quả rỗng ban đầu nếu retry cũng lỗi */ }
    }
    _t5Results[sceneId] = { keywords, photos: results.photos || [], videos: results.videos || [] };
    renderSceneResults(sceneId, keywords, results);
  } catch (e) {
    box.innerHTML = '<span style="color:var(--red);font-size:11.5px">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
}

function _t2LoaiMedia(scene){
  const sh = String((scene && scene.shot) || '').toLowerCase();
  if (_T2_CANH_ANH.has(sh)) return 'photos';
  // Kho mở gần như chỉ có ảnh → cảnh giao cho kho thì nhận cả hai, khỏi trắng tay.
  if (scene && scene.wantKho) return 'both';
  return 'videos';
}

function _t2LoaiNguon(ten){
  const t = String(ten || '');
  if (!t) return null;
  for (const x of _T2_LOAI_NGUON) if (x.re.test(t)) return x;
  return null;
}

function _t2LyDoChu(bo){
  const e = Object.entries(bo || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return e.slice(0, 3).map(([k, v]) => `${v} ${_T2_LY_DO[k] || k}`).join(', ');
}

function _t2ChamUngVien(c, scene, daDung){
  if (!c) return { diem: -99, loai: 'rong' };
  let d = 0;
  const ten = String(c.ten || c.title || '').trim();
  const giay = Number(c.duration) || 0;
  const canh = Math.max(1, parseFloat(scene && scene.duration) || 4);

  // ① Vừa thời lượng — clip NGẮN HƠN cảnh là không lấp đủ, phải loại thẳng.
  if (giay > 0){
    if (giay < canh * 0.9) return { diem: -99, loai: 'qua-ngan' };
    if (giay >= canh * 1.5 && giay <= 600) d += 3;        // dư dải để cắt, lại không phải phim dài
    else if (giay > 3600) d -= 2;                          // hơn 1 tiếng: tải lâu, hay là bản full
  }

  // ② Phạt trùng lặp — cùng một clip dùng ở hai cảnh là lộ ngay khi xem.
  const khoa = String(c.trangUrl || c.downloadUrl || '');
  if (khoa && daDung && daDung.has(khoa)) return { diem: -99, loai: 'trung-lap' };

  // ③ Phân loại theo tiêu đề. Chỉ chấm khi CÓ tiêu đề (ứng viên stock không có).
  if (ten){
    const lop = _t2LoaiNguon(ten);
    if (lop){
      if (lop.chan) return { diem: -99, loai: lop.lop };    // loại thẳng, không cứu được
      d += lop.d;
    }
    // ④ Phạt tiêu đề chung chung / nhiều thẻ băm; cộng cho dấu hiệu b-roll tốt.
    if (_T2_TIEU_DE_CHUNG.test(ten)) d -= 2;
    if (_T2_TIEU_DE_TOT.test(ten)) d += 1.5;
    if ((ten.match(/#/g) || []).length >= 2) d -= 2;
    if (ten.length >= 18) d += 1;                          // tiêu đề có mô tả thật
  }

  // Ảnh tĩnh không có thời lượng — không phạt, nhưng nhường video khi cùng điểm.
  if (c.kind === 'image') d -= 0.5;
  if (c.thumb) d += 0.5;                                   // có ảnh xem trước = ứng viên thật

  return { diem: d, loai: '' };
}

function _t2XepUngVien(cands, scene, daDung){
  const nhan = [], bo = {};
  (cands || []).forEach(c => {
    const r = _t2ChamUngVien(c, scene, daDung);
    if (r.loai){ bo[r.loai] = (bo[r.loai] || 0) + 1; return; }
    nhan.push({ c, d: r.diem });
  });
  nhan.sort((a, b) => b.d - a.d);
  return { ds: nhan.map(x => x.c), bo };
}

function _t2DaDung(trSceneId){
  const s = new Set();
  const mp = state.mediaPicks || {};
  for (const id in mp){
    if (id === trSceneId) continue;
    const v = mp[id]; if (!v) continue;
    const k = String(v.trangUrl || v.downloadUrl || '');
    if (k) s.add(k);
  }
  return s;
}

function _t2StockCands(res, type){
  const out = [];
  if (type !== 'photos') (res.videos || []).forEach(v => { if (v && v._downloadUrl) out.push({ kind: 'video', downloadUrl: v._downloadUrl, source: v._source || 'stock', duration: v.duration || 0, thumb: v.image || _pixabayThumbFromUrl(v._downloadUrl) || '', license: v._license || '', author: v._author || '' }); });
  if (type !== 'videos') (res.photos || []).forEach(p => { if (p && p._downloadUrl) out.push({ kind: 'image', downloadUrl: p._downloadUrl, source: p._source || 'stock', duration: 0, thumb: (p.src && p.src.small) || p._downloadUrl || '', license: p._license || '', author: p._author || '' }); });
  return out;
}

function _t2WebPickerRender(sceneId, note){
  const m = document.getElementById('t2WebPickerModal'); if (!m) return;
  const cands = (state.webCandidates || {})[sceneId] || [];
  const so = (state.scenes || []).findIndex(s => s.id === sceneId) + 1;
  const dung = (state.mediaPicks || {})[sceneId] || {};
  const dangDung = dung.trangUrl || '';

  const the = cands.map((c, i) => {
    const chon = dangDung && (c.trangUrl === dangDung);
    const gp = c.license ? escapeHtml(String(c.license).slice(0, 30)) : '';
    const tg = c.author ? escapeHtml(String(c.author).slice(0, 26)) : '';
    const rui = c.nhom && c.nhom !== 'cong';
    return `<div style="width:212px;border-radius:9px;overflow:hidden;border:2px solid ${chon ? 'var(--accent)' : 'var(--border)'};background:var(--surface-2);display:flex;flex-direction:column">
      <div onclick="t2PickWeb('${sceneId}',${i})" style="cursor:pointer;position:relative;height:120px;background:#000">
        ${c.thumb ? `<img src="${escapeHtml(c.thumb)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.opacity=.15">`
                  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:22px">🌐</div>'}
        <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.68);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px">${c.duration ? c.duration + 's' : 'video'}</span>
        ${chon ? '<span style="position:absolute;top:6px;right:6px;background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">✓ Đang dùng</span>' : ''}
        ${c.camTM ? '<span title="Giấy phép CẤM dùng thương mại hoặc cấm sửa đổi — kênh bật kiếm tiền dùng là vi phạm. Lượt tự động đã bỏ qua thẻ này." style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.8);color:#ff6b6b;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px">⛔ cấm thương mại</span>'
          : (rui ? '<span title="Nội dung có bản quyền — cân nhắc khi bật kiếm tiền" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.68);color:var(--amber);font-size:10px;padding:2px 5px;border-radius:4px">⚠️ bản quyền</span>' : '')}
      </div>
      <div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);line-height:1.45;flex:1 1 auto">
        <div style="font-weight:650;color:var(--text);max-height:28px;overflow:hidden">${escapeHtml(String(c.ten || '').slice(0, 62))}</div>
        <div style="margin-top:3px">${_srcBadge(c.source)}</div>
        ${gp ? `<div style="color:var(--teal)">📄 ${gp}</div>` : ''}
        ${tg ? `<div style="color:var(--text-dim)">© ${tg}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;padding:0 8px 8px">
        <button class="btn ghost sm" style="flex:1;font-size:10.5px;padding:4px" onclick="t2PickWeb('${sceneId}',${i})">Dùng cảnh này</button>
        <button class="btn ghost sm" style="font-size:10.5px;padding:4px 7px" title="Sao chép link trang gốc (app không mở cửa sổ ngoài)" onclick="event.stopPropagation();novaCopyLink('${escapeHtml(c.trangUrl || '')}')">↗</button>
      </div>
    </div>`;
  }).join('');

  const nhip = (typeof webTrangThaiNhip === 'function') ? webTrangThaiNhip() : null;
  const nhipTxt = nhip ? `Tìm web đã dùng ${nhip.daDung}/${nhip.tran} lượt phiên này${nhip.chan ? ' · <span style="color:var(--amber)">đang bị chặn nhịp</span>' : ''}.` : '';
  m.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(940px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:15px 18px 10px;border-bottom:1px solid var(--border);flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:14.5px;font-weight:750">🌐 Tư liệu web — cảnh ${so}</span>
      <span style="font-size:11px;color:var(--text-dim)">${cands.length} ứng viên</span>
      <span style="flex:1"></span>
      <input id="t2WebKw" placeholder="Gõ từ khoá tiếng Anh rồi bấm Tìm thêm" style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:6px 10px;font-size:12px;width:250px">
      <button class="btn ghost sm" id="t2WebMoreBtn" onclick="t2WebTimThem('${sceneId}')">🔎 Tìm thêm</button>
      <button class="btn ghost sm" onclick="webMoBang()">⚙ Nền tảng</button>
      <button class="btn ghost sm" onclick="t2CloseWebPicker()">Đóng</button>
    </div>
    <div id="t2WebNote" style="padding:8px 18px 0;font-size:11px;color:var(--text-dim);line-height:1.55;flex:0 0 auto">${note ? escapeHtml(note) + '<br>' : ''}${nhipTxt}</div>
    <div style="padding:12px 18px 16px;overflow:auto;flex:1 1 auto;display:flex;flex-wrap:wrap;gap:10px">${the || '<div style="color:var(--text-dim);font-size:12px">Chưa có ứng viên nào.</div>'}</div>
  </div>`;
}

async function searchAllScenes(){
  if (typeof gateTool==='function' && gateTool('tool5')) return;
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  if (!getPexelsKey() && !getPixabayKey() && !getUnsplashKey()) return setStatus5('Cần ít nhất 1 API key (Pexels / Pixabay / Unsplash).', 'error');
  setStatus5('Đang tìm media cho tất cả cảnh...', 'working');
  clearCancel();

  for (let i = 0; i < state.scenes.length; i++) {
    if (state.cancelRequested) {
      clearCancel();
      document.getElementById('searchProgress').textContent = '';
      setStatus5(`⏸ Đã dừng tại cảnh ${i + 1}/${state.scenes.length}. Kết quả đã tìm được giữ lại.`, 'info');
      return;
    }
    document.getElementById('searchProgress').textContent = `${i + 1}/${state.scenes.length}`;
    await searchForScene(state.scenes[i].id);
    await new Promise(r => setTimeout(r, 200));
  }
  document.getElementById('searchProgress').textContent = '';
  setStatus5(`✓ Đã tìm xong ${state.scenes.length} cảnh.`, 'ok');
}

function _srcBadge(s){
  // Nguồn web mang dạng 'web:<id>' — nhãn tra từ danh sách 55 nền tảng, kèm ⚠️
  // cho nhóm báo đài / mạng xã hội để rủi ro bản quyền hiện ngay trên thẻ.
  if (typeof s === 'string' && s.startsWith('web:') && typeof webNhan === 'function') return webNhan(s.slice(4));
  return { pixabay: '🟢 Pixabay', unsplash: '🟣 Unsplash', pexels: '🔵 Pexels',
    wikimedia: '🏛 Wikimedia', nasa: '🚀 NASA', openverse: '🧩 Openverse', archive: '📼 Archive' }[s] || '🔵 Pexels';
}

function renderSceneResults(sceneId, keywords, results){
  // Số thứ tự cảnh để đặt tên file (001, 002...)
  const sceneIdx = state.scenes.findIndex(s => s.id === sceneId);
  const sceneNum = sceneIdx >= 0 ? sceneIdx + 1 : '';
  const box = document.getElementById('media-results-' + sceneId);
  if (!box) return;
  const photos = results.photos || [];
  const videos = results.videos || [];
  const pick = state.mediaPicks?.[sceneId];
  const pickedUrl = pick?.downloadUrl || '';

  let html = '';
  // Tóm tắt lựa chọn hiện tại
  if (pick) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 10px;background:var(--accent-soft);border-radius:6px;font-size:11.5px">
      <span style="color:var(--accent);font-weight:600">✓ Đã chọn:</span>
      <span>${pick.kind === 'video' ? '🎬' : '📷'} ${_srcBadge(pick.source)}${pick.duration ? ' · ' + pick.duration + 's' : ''}</span>
      <button class="btn ghost sm" style="margin-left:auto;padding:2px 8px;font-size:10px;color:var(--red);border-color:var(--red)" onclick="unpickMedia('${sceneId}')">✗ Bỏ chọn</button>
    </div>`;
  }

  if (!photos.length && !videos.length) {
    box.innerHTML = html + `<span style="color:var(--text-dim);font-size:11.5px">${keywords ? 'Không tìm thấy kết quả cho "' + escapeHtml(keywords) + '"' : 'Bấm Tìm để lấy ứng viên.'}</span>`;
    return;
  }
  html += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Từ khoá: <strong>${escapeHtml(keywords)}</strong> · ${photos.length} ảnh, ${videos.length} video</div>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  photos.forEach((p, i) => {
    const dl = (p._downloadUrl || '').replace(/'/g, "\\'");
    const sel = pickedUrl && p._downloadUrl === pickedUrl;
    html += `<div style="width:150px;border-radius:6px;overflow:hidden;border:2px solid ${sel ? 'var(--accent)' : 'var(--border)'}">
      <a href="${p.url}" target="_blank" style="display:block;text-decoration:none"><img src="${p.src.small}" style="width:100%;height:90px;object-fit:cover" loading="lazy"></a>
      <div style="padding:5px 8px;font-size:10px;color:var(--text-muted);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>📷 ${_srcBadge(p._source)}</span>
        <span style="display:flex;gap:4px">
          <button class="btn ghost" style="padding:2px 6px;font-size:10px;border-color:${sel ? 'var(--accent)' : 'var(--teal)'};color:${sel ? 'var(--accent)' : 'var(--teal)'}" onclick="pickMedia('${sceneId}','photos',${i})" title="Dùng ảnh này cho cảnh">${sel ? '✓' : 'Dùng'}</button>
          <button class="btn ghost" style="padding:2px 6px;font-size:10px" onclick="downloadMedia('${dl}','jpg','${sceneNum}')" title="Tải ảnh về (tên = số cảnh)">⬇</button>
        </span>
      </div>
    </div>`;
  });
  videos.forEach((v, j) => {
    const thumb = v.image || v.video_pictures?.[0]?.picture || _pixabayThumbFromUrl(v._downloadUrl) || '';
    const dl = (v._downloadUrl || '').replace(/'/g, "\\'");
    const sel = pickedUrl && v._downloadUrl === pickedUrl;
    html += `<div style="width:150px;border-radius:6px;overflow:hidden;border:2px solid ${sel ? 'var(--accent)' : 'var(--border)'}">
      <a href="${v.url}" target="_blank" style="display:block;text-decoration:none;position:relative"><img src="${thumb}" style="width:100%;height:90px;object-fit:cover" loading="lazy">
      <div style="position:absolute;top:45px;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px">▶</div></a>
      <div style="padding:5px 8px;font-size:10px;color:var(--text-muted);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>🎬 ${v.duration}s ${_srcBadge(v._source)}</span>
        <span style="display:flex;gap:4px">
          <button class="btn ghost" style="padding:2px 6px;font-size:10px;border-color:${sel ? 'var(--accent)' : 'var(--teal)'};color:${sel ? 'var(--accent)' : 'var(--teal)'}" onclick="pickMedia('${sceneId}','videos',${j})" title="Dùng video này cho cảnh">${sel ? '✓' : 'Dùng'}</button>
          <button class="btn ghost" style="padding:2px 6px;font-size:10px" onclick="downloadMedia('${dl}','mp4','${sceneNum}')" title="Tải video về (tên = số cảnh)">⬇</button>
        </span>
      </div>
    </div>`;
  });
  html += '</div>';
  box.innerHTML = html;
}

async function downloadMedia(url, kind, sceneNum){
  if (!url) return setStatus5('Không có link tải.', 'error');
  setStatus5('Đang tải...', 'working');
  let ext = (url.split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'mp4') ? 'mp4' : 'jpg';
  ext = ext.toLowerCase();
  // Tên file = số cảnh (001, 002...) nếu có, fallback timestamp
  const baseName = sceneNum ? String(sceneNum).padStart(3, '0') : `stock-${Date.now()}`;
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    setStatus5(`✓ Đã tải về: ${baseName}.${ext}`, 'ok');
  } catch (e) {
    novaCopyLink(url, 'CORS chặn tải trực tiếp — đã sao chép liên kết:');
    setStatus5('Không tải trực tiếp được (CORS) — link đã sao chép, app không mở cửa sổ ngoài.', 'info');
  }
}

function _mediaExt(url, kind){
  let ext = (String(url || '').split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'video') ? 'mp4' : 'jpg';
  return ext.toLowerCase();
}

function pickMedia(sceneId, listType, index){
  const cached = _t5Results[sceneId];
  if (!cached) return;
  const arr = listType === 'videos' ? cached.videos : cached.photos;
  const item = arr && arr[index];
  if (!item) return;
  const kind = listType === 'videos' ? 'video' : 'photo';
  if (!state.mediaPicks) state.mediaPicks = {};
  state.mediaPicks[sceneId] = {
    kind,
    source: item._source || 'pexels',
    thumb: kind === 'video' ? (item.image || item.video_pictures?.[0]?.picture || _pixabayThumbFromUrl(item._downloadUrl) || '') : (item.src?.small || ''),
    downloadUrl: item._downloadUrl || '',
    pageUrl: item.url || '',
    duration: kind === 'video' ? (item.duration || null) : null,
    keywords: cached.keywords || ''
  };
  renderSceneResults(sceneId, cached.keywords, cached);
  updatePickCount();
  saveState(true);
}

function unpickMedia(sceneId){
  if (state.mediaPicks) delete state.mediaPicks[sceneId];
  const cached = _t5Results[sceneId];
  if (cached) renderSceneResults(sceneId, cached.keywords, cached);
  else { const b = document.getElementById('media-results-' + sceneId); if (b) b.innerHTML = '<span style="color:var(--text-dim);font-size:11.5px">Bấm Tìm hoặc Tìm tất cả</span>'; }
  updatePickCount();
  saveState(true);
}

function updatePickCount(){
  const el = document.getElementById('pickCount');
  if (!el) return;
  const total = state.scenes.length;
  const picked = state.scenes.filter(s => state.mediaPicks?.[s.id]?.downloadUrl).length;
  el.textContent = `Đã chọn ${picked}/${total}`;
}

async function downloadAllPicks(){
  const picks = state.scenes
    .map((s, i) => ({ s, num: i + 1, pick: state.mediaPicks?.[s.id] }))
    .filter(x => x.pick?.downloadUrl);
  if (!picks.length) return setStatus5('Chưa chọn media cho cảnh nào. Bấm "Tự chọn tất cả" hoặc nút "Dùng" ở từng cảnh.', 'error');
  setStatus5(`Đang tải ${picks.length} file đã chọn...`, 'working');
  let ok = 0, fail = 0;
  for (const { num, pick } of picks) {
    try {
      await downloadMedia(pick.downloadUrl, pick.kind, num);
      ok++;
    } catch (e) { fail++; }
    await new Promise(r => setTimeout(r, 400));   // tránh trình duyệt chặn tải hàng loạt
  }
  setStatus5(`✓ Đã tải ${ok}/${picks.length} file đã chọn (đặt tên theo số cảnh).${fail ? ' ' + fail + ' file lỗi — thử tải tay từ nút ⬇.' : ''}`, 'ok');
}

function _downloadTextFile(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const u = URL.createObjectURL(blob);
  a.href = u; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

function _srtTime(sec){
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec - Math.floor(sec)) * 1000);
  const p = (n, l) => String(n).padStart(l, '0');
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(ms, 3)}`;
}

function _csvCell(v){
  const str = String(v == null ? '' : v);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function exportMediaCSV(){
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  const rows = [['scene_num','scene_id','start_s','end_s','duration_s','type','source','file_name','download_url','page_url','keywords','vo_text']];
  let t = 0, picked = 0;
  state.scenes.forEach((s, i) => {
    const dur = parseFloat(s.duration) || 0;
    const start = t; const end = +(t + dur).toFixed(1); t = end;
    const pk = state.mediaPicks?.[s.id];
    if (pk?.downloadUrl) picked++;
    const fileName = pk?.downloadUrl ? String(i + 1).padStart(3, '0') + '.' + _mediaExt(pk.downloadUrl, pk.kind) : '';
    rows.push([
      i + 1, s.id, start, end, dur,
      pk?.kind || '', pk?.source || '', fileName,
      pk?.downloadUrl || '', pk?.pageUrl || '', pk?.keywords || '',
      (s.text || '').replace(/\s+/g, ' ').trim()
    ]);
  });
  const csv = rows.map(r => r.map(_csvCell).join(',')).join('\r\n');
  const p = getProfile();
  const base = 'media-timing-' + ((p?.tenKenh || 'video').replace(/\W+/g, '-'));
  _downloadTextFile(base + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  setStatus5(`✓ Đã xuất CSV timing (${state.scenes.length} cảnh, ${picked} đã chọn media).`, 'ok');
}

function exportMediaSRT(){
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  let t = 0; const cues = [];
  state.scenes.forEach((s, i) => {
    const dur = parseFloat(s.duration) || 0;
    const start = t; const end = +(t + dur).toFixed(3); t = end;
    const pk = state.mediaPicks?.[s.id];
    const fileName = pk?.downloadUrl ? String(i + 1).padStart(3, '0') + '.' + _mediaExt(pk.downloadUrl, pk.kind) : '(chưa chọn media)';
    const text = `[${String(i + 1).padStart(3, '0')}] ${fileName}\n${(s.text || '').replace(/\s+/g, ' ').trim()}`;
    cues.push(`${i + 1}\n${_srtTime(start)} --> ${_srtTime(end)}\n${text}`);
  });
  const p = getProfile();
  const base = 'media-timing-' + ((p?.tenKenh || 'video').replace(/\W+/g, '-'));
  _downloadTextFile(base + '.srt', cues.join('\n\n') + '\n', 'application/x-subrip;charset=utf-8');
  setStatus5(`✓ Đã xuất SRT timeline (${state.scenes.length} cảnh).`, 'ok');
}

