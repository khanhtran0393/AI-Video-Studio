'use strict';
/* ============================================================
   SESSION SNAPSHOT — "làm dở" của GUI, tự khôi phục khi mở lại app
   ------------------------------------------------------------
   saveState/saveCloudState (profiles.js) đã lưu dữ liệu dự án
   (kịch bản, cảnh, prompt…) nhưng chỉ khi tool tự gọi. Những gì
   NẰM NGOÀI state — chữ vừa gõ chưa kịp blur (change), checkbox/
   select lẻ, vị trí cuộn — mất trắng khi tắt app. File này chụp
   một "ảnh nhanh" nhẹ của toàn bộ input có id rồi ghi vào:
     • localStorage (origin hiện tại) — đọc nhanh lúc boot;
     • file nova-settings.json trong userData (qua window.novaStore
       — cùng kho bền với API key, không dính origin/port) — nguồn
       chân lý khôi phục khi Chromium dọn kho hoặc port đổi.
   Khôi phục: hook trong profiles.js (initAppDirect gọi sớm 1 lần,
   loadCloudState gọi lại sau khi state/IDB nạp xong để thắng các
   render đè lên input).

   Quy ước renderer (AGENTS.md §8): tên cấp đầu tiền tố `sessSnap`
   — đây là "module system" thay thế của nova/web (không build step,
   KHÔNG import/export; thứ tự nạp trong index.html = ngữ nghĩa:
   nạp TRƯỚC boot.js, sau flow-keys.js).

   API cho panel khác:
     sessSnapPatch(key, value) — nhét dữ liệu riêng vào snapshot
       (vd Video Agent lưu projectDir gần nhất để resume);
     sessSnapGet(key) — đọc 1 key (không truyền key → cả snapshot).
   ============================================================ */

var sessSnapKey = 'novaSession';
var sessSnapTimer = null;
var sessSnapDirty = false;
/* Đang khôi phục → event input/change do restore bắn ra không được đánh dấu
   bẩn (tránh chụp lại chính giá trị vừa trả lại). */
var sessSnapRestoring = false;
/* Giới hạn cứng kích thước snapshot (JSON string) — vượt thì bỏ phần
   input, giữ phần metadata (tool, patch của panel khác). */
var SESSSNAP_MAX_BYTES = 256 * 1024;
/* Phiên bản layout UI của snapshot. Khi sửa cấu trúc modal/panel (đổi id,
   đổi kiểu input, đổi mặc định parity…) thì TĂNG số này: snapshot chụp từ
   UI cũ sẽ bị bỏ qua phần input/scroll (khai báo qua console, không im
   lặng — Luật 10) để không "hồi sinh" giá trị đã hết hiệu lực.
   Bug thật 2026-09-19: snapshot của modal T7 xuất bản cũ (select % default
   100 + batch "stop" đầu danh sách) hồi sinh lên modal mới thành
   t7ExpVoiceVol="100" (vượt max 5) + t7ExpBatchErr="stop", đè mặc định
   parity 1.5 / continue. tool + patch của panel khác vẫn được giữ. */
var SESSSNAP_UI_VER = 2;

function sessSnapRead() {
  try {
    const raw = window.localStorage.getItem(sessSnapKey);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch (e) { return {}; }
}

function sessSnapWrite(snap) {
  let json;
  try { json = JSON.stringify(snap || {}); } catch (e) { return false; }
  /* Quá lớn → thử bỏ inputs (phần dễ sinh lại nhất), vẫn lớn thì bỏ. */
  if (json.length > SESSSNAP_MAX_BYTES) {
    try { const lite = Object.assign({}, snap, { inputs: undefined }); json = JSON.stringify(lite); } catch (e) { return false; }
    if (json.length > SESSSNAP_MAX_BYTES) return false;
  }
  let okLocal = false;
  try { window.localStorage.setItem(sessSnapKey, json); okLocal = true; } catch (e) { /* đầy kho — file vẫn còn */ }
  /* Ghi kèm ra file bền (nova-settings.json) — giống cơ chế API key. */
  try {
    if (window.novaStore && typeof window.novaStore.set === 'function') window.novaStore.set(sessSnapKey, json);
  } catch (e) { console.warn('[sessnap] ghi file thất bại:', e); }
  return okLocal;
}

/** Chụp trạng thái hiện tại của GUI (KHÔNG ghi). */
function sessSnapCollect() {
  const snap = sessSnapRead();
  const inputs = {};
  try {
    const nodes = document.querySelectorAll('input[id], textarea[id], select[id]');
    for (const el of nodes) {
      const t = (el.type || '').toLowerCase();
      if (t === 'file' || t === 'password' || t === 'submit' || t === 'button') continue;
      if (el.closest && el.closest('[data-sessnap-skip]')) continue;
      if (t === 'checkbox' || t === 'radio') { if (el.id) inputs[el.id] = !!el.checked; continue; }
      const v = el.value;
      /* Lưu cả chuỗi rỗng — nếu chỉ lưu khi khác rỗng, ô user CỐ TÌNH xoá trắng
         sẽ bị "hồi sinh" giá trị cũ từ lần chụp trước. */
      if (typeof v === 'string') inputs[el.id] = v.length > 64 * 1024 ? v.slice(0, 64 * 1024) : v;
    }
  } catch (e) { console.warn('[sessnap] collect inputs:', e); }
  const st = (typeof state !== 'undefined' && state && state.tool) ? state.tool : null;
  snap.tool = st || snap.tool || null;
  snap.inputs = inputs;
  try {
    const main = document.querySelector('.main');
    snap.scroll = { main: main ? Math.round(main.scrollTop) : 0, win: Math.round(window.scrollY || 0) };
  } catch (e) { snap.scroll = null; }
  snap.at = Date.now();
  snap.uiVer = SESSSNAP_UI_VER;
  return snap;
}

function sessSnapFlush() {
  sessSnapDirty = false;
  clearTimeout(sessSnapTimer);
  sessSnapTimer = null;
  sessSnapWrite(sessSnapCollect());
}

/** Đánh dấu bẩn + debounce 2s (gõ chữ không phải cứ mỗi phím lại ghi đĩa). */
function sessSnapMarkDirty() {
  if (sessSnapRestoring) return;   // event do chính restore bắn ra — bỏ qua
  sessSnapDirty = true;
  clearTimeout(sessSnapTimer);
  sessSnapTimer = setTimeout(sessSnapFlush, 2000);
}

/** Nhét/đè 1 key riêng vào snapshot (panel khác dùng, vd Video Agent). */
function sessSnapPatch(key, value) {
  const snap = sessSnapRead();
  if (value === null || value === undefined) delete snap[key];
  else snap[key] = value;
  snap.at = Date.now();
  return sessSnapWrite(snap);
}

function sessSnapGet(key) {
  const snap = sessSnapRead();
  return key ? snap[key] : snap;
}

/** Khôi phục tool + input/checkbox/select + vị trí cuộn (idempotent — gọi lại được).
 *  opts.switchTool: chuyển về đúng tool đang mở lúc chụp (dùng cho lần restore
 *  sau khi state/IDB nạp xong — boot chỉ switchTool với tool mặc định). */
function sessSnapRestore(opts) {
  const snap = sessSnapRead();
  /* Chụp từ UI cũ (uiVer lệch) → bỏ qua phần input/scroll, KHÔNG im lặng
     (Luật 10): giá trị chụp theo layout cũ có thể không còn hợp lệ. */
  const stale = snap.uiVer !== SESSSNAP_UI_VER;
  if (stale) {
    try { console.info('[sessnap] snapshot UI ver ' + (snap.uiVer || 0) + ' ≠ ' + SESSSNAP_UI_VER
      + ' → bỏ phần input/scroll (UI đã đổi layout), giữ tool/patch'); } catch (e) {}
  }
  /* Chuyển tool TRƯỚC khi trả input — switchTool có thể render lại panel. */
  if (opts && opts.switchTool && snap.tool) {
    try {
      const cur = (typeof state !== 'undefined' && state) ? state.tool : null;
      if (typeof switchTool === 'function' && cur !== snap.tool) switchTool(snap.tool);
    } catch (e) { console.warn('[sessnap] switchTool:', e); }
  }
  sessSnapRestoring = true;
  try {
    const inputs = stale ? null : snap.inputs;
    if (inputs && typeof inputs === 'object') {
      for (const id of Object.keys(inputs)) {
        let el = null;
        try { el = document.getElementById(id); } catch (e) { continue; }
        if (!el) continue;
        const t = (el.type || '').toLowerCase();
        try {
          if (t === 'checkbox' || t === 'radio') {
            el.checked = !!inputs[id];
            /* Bắn event để panel/react-logic lắng nghe cập nhật theo (đếm, enable nút…). */
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            continue;
          }
          if (t === 'file' || t === 'password') continue;
          /* Field có chủ riêng (data-sessnap-skip — panel tự khôi phục theo kho
             của nó) thì không hồi sinh, kể cả khi entry cũ còn nằm trong snapshot. */
          if (el.closest && el.closest('[data-sessnap-skip]')) continue;
          /* number ngoài min/max của phần tử HIỆN TẠI → giá trị chụp từ UI cũ
             đã chết, bỏ qua (không gán value vượt range). */
          if (t === 'number' && inputs[id] !== '') {
            const nv = parseFloat(inputs[id]);
            const lo = parseFloat(el.min), hi = parseFloat(el.max);
            if (!Number.isFinite(nv)
              || (Number.isFinite(lo) && nv < lo)
              || (Number.isFinite(hi) && nv > hi)) continue;
          }
          const v = inputs[id];
          if (typeof v !== 'string' || v === el.value) continue;
          if (el.tagName === 'SELECT') {
            let has = false;
            for (const opt of el.options) { if (opt.value === v) { has = true; break; } }
            if (!has) continue;
          }
          el.value = v;
          try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        } catch (e) { /* phần tử lạ — bỏ qua, không chặn các input khác */ }
      }
    }
    try {
      const sc = stale ? null : snap.scroll;
      if (sc) {
        const main = document.querySelector('.main');
        if (main && sc.main) main.scrollTop = sc.main;
        if (sc.win) window.scrollTo(0, sc.win);
      }
    } catch (e) { /* */ }
  } finally { sessSnapRestoring = false; }
}

/* ── wire: ghi khi rời app + khi ẩn tab + debounce khi người dùng gõ ── */
(function sessSnapWire() {
  try {
    document.addEventListener('input', sessSnapMarkDirty, true);
    document.addEventListener('change', sessSnapMarkDirty, true);
  } catch (e) { console.warn('[sessnap] wire input:', e); }
  try { window.addEventListener('pagehide', sessSnapFlush); } catch (e) { /* */ }
  try { window.addEventListener('beforeunload', sessSnapFlush); } catch (e) { /* */ }
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sessSnapFlush();
    });
  } catch (e) { /* */ }
  /* Mỗi lần chuyển tool, input ĐỘNG (hàng prompt render theo scene, field sinh
     sau boot) có thể vừa được tạo — khôi phục lại giá trị snapshot cho tool đó.
     Wrap ở đây thay vì sửa thân switchTool trong nav.js (header nav.js cấm sửa). */
  try {
    if (typeof switchTool === 'function' && !switchTool.__sessSnapWrapped) {
      const orig = switchTool;
      var sessSnapWrappedSwitchTool = function (name) {
        const r = orig.apply(this, arguments);
        try { sessSnapRestore(); } catch (e) {}
        return r;
      };
      sessSnapWrappedSwitchTool.__sessSnapWrapped = true;
      switchTool = sessSnapWrappedSwitchTool;
    }
  } catch (e) { console.warn('[sessnap] wrap switchTool:', e); }
})();
