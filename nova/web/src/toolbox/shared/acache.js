/* ACACHE — vùng cache chung cho sản phẩm trung gian đang nằm trong RAM (tách 2026-09-12f).
   Mô hình 2 vùng như voice: sản phẩm cuối đã có kho riêng (kịch bản/cảnh/ảnh → IDB qua
   profiles.js; render/upscale → đĩa), còn các sản phẩm TRUNG GIAN dưới đây trước giờ chỉ
   sống trong RAM — tắt app là mất:
     - tsOutput   : kịch bản AI (Tool Script / Novel)
     - t9Script / t9Desc / t9Tags : SEO pack (Tool 9)
     - srtOutput  : SRT dựng theo cảnh (Tool 2)
     - bulkPrompts / tvPrompts    : danh sách prompt hàng loạt
     - veo_cache  : cache video Veo theo (prompt+model+dur) — tiết kiệm credit
   Lưu qua IDB (store 'blobs', key 'ac:*') — bền trong profile, tắt mở vẫn còn.
   Sweep 3s bắt CẢ ghi programmatic (out.value = …) mà input event không thấy.
   Lỗi lưu/đọc báo rõ qua console.warn — KHÔNG nuốt lỗi (Luật 10). */

var ACACHE_TEXT_BINDS = [
  ['tsOutput',     'ts_script'],
  ['t9Script',     't9_script'],
  ['t9Desc',       't9_desc'],
  ['t9Tags',       't9_tags'],
  ['srtOutput',    'srt_output'],
  ['bulkPrompts',  'bulk_prompts'],
  ['tvPrompts',    'tv_prompts'],
];
var _acacheTimers = {};      // debounce gõ tay: key → timer
var _acacheLast   = {};      // sweep: elementId → giá trị lần quét trước

function acacheSet(key, val){
  return IDB.set('ac:' + key, val).catch(function(e){
    console.warn('[acache] LƯU THẤT BẠI ' + key + ' — sản phẩm này sẽ mất khi tắt app:', e);
    try { if (typeof novaLog === 'function') novaLog('⚠️ Cache lưu thất bại (' + key + '): ' + (e && e.message || e), 'error'); } catch (_) {}
  });
}
function acacheGet(key){
  return IDB.get('ac:' + key).catch(function(e){
    console.warn('[acache] ĐỌC THẤT BẠI ' + key + ':', e);
    return null;
  });
}

/* Lưu NGAY giá trị hiện tại của một textarea (gọi tại nơi ghi programmatic nếu cần).
   key không truyền thì tra theo bảng ACACHE_TEXT_BINDS theo id. */
function acacheNote(id, key){
  const el = document.getElementById(id);
  if (!el || typeof el.value !== 'string') return;
  const bind = ACACHE_TEXT_BINDS.find(b => b[0] === id);
  acacheSet(key || (bind && bind[1]) || id, el.value);
  _acacheLast[id] = el.value;
}

/* Boot: khôi phục nội dung đã cache + bật listener gõ tay + sweep định kỳ */
function acacheBoot(){
  // 1) Khôi phục text — chỉ điền khi ô đang TRỐNG, không đè nội dung vừa sinh ra
  ACACHE_TEXT_BINDS.forEach(b => {
    const id = b[0], key = b[1];
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(_acacheTimers[key]);
      _acacheTimers[key] = setTimeout(() => { acacheSet(key, el.value); _acacheLast[id] = el.value; }, 800);
    });
  });
  // 2) Nạp giá trị đã lưu (song song, không chặn boot)
  ACACHE_TEXT_BINDS.forEach(b => {
    const id = b[0], key = b[1];
    acacheGet(key).then(v => {
      const el = document.getElementById(id);
      if (!el || v == null || typeof v !== 'string') return;
      if (!String(el.value).trim()) { el.value = v; }
      _acacheLast[id] = el.value;
    });
  });
  // 3) Sweep 3s: bắt mọi thay đổi (kể cả out.value = … từ code) rồi lưu
  setInterval(() => {
    ACACHE_TEXT_BINDS.forEach(b => {
      const id = b[0], key = b[1];
      const el = document.getElementById(id);
      if (!el) return;
      const v = el.value;
      if (typeof _acacheLast[id] === 'string' && v !== _acacheLast[id]) {
        _acacheLast[id] = v;
        clearTimeout(_acacheTimers[key]);
        acacheSet(key, v);
      }
    });
  }, 3000);
  // 4) Hâm nóng cache Veo từ lần chạy trước
  acacheGet('veo_cache').then(snap => {
    if (!snap || !Array.isArray(snap.entries) || typeof _t6VeoCache === 'undefined') return;
    snap.entries.forEach(en => { if (en && en.k && en.blob) _t6VeoCache.set(en.k, { blob: en.blob, hits: 0, t: en.t || Date.now() }); });
    try { if (typeof novaLog === 'function') novaLog('Veo cache đã hồi phục từ cache app: ' + _t6VeoCache.size + ' video (tắt mở vẫn còn, tiết kiệm credit)', 'ok'); } catch (_) {}
  }).catch(() => {});
}

/* Snapshot cache Veo ghi xuống IDB — gọi từ _t6VeoCachePut (write-through) */
function _acacheVeoPersist(){
  if (typeof _t6VeoCache === 'undefined') return;
  const entries = [];
  _t6VeoCache.forEach((v, k) => { entries.push({ k: k, blob: v.blob, t: v.t }); });
  acacheSet('veo_cache', { version: 1, savedAt: Date.now(), entries: entries });
}