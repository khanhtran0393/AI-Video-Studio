/* ── Skill Panel — Kho skill viết kịch bản (sidebar nhóm "Cài đặt") ──────────
   Quản lý thư viện "skill viết kịch bản" theo từng chủ đề & phong cách:
   thêm / sửa / xoá / lọc / dùng ngay trong tab Tạo Kịch Bản (tool-ts).
   - Dữ liệu: localStorage key 'skl_library_v1' (mảng object) — index.html
     persist tiền tố 'skl_' ra nova-settings.json nên skill không mất khi
     port/origin đổi (cơ chế seed hai chiều có sẵn).
   - Tích hợp Tạo Kịch Bản:
       sklSyncTsOptions() — chèn skill đã lưu vào <select id="tsSkill">
       (optgroup "Skill của tôi"); gọi lại sau mỗi lần CRUD.
       sklGuideFor(name)  — trả HƯỚNG DẪN VIẾT của skill để tool-ts ghép
       vào mệnh đề WRITING SKILL của prompt (tool-ts guard bằng typeof nên
       thiếu module này không chết gì).
   - Danh sách Chủ Đề / Phong cách gợi ý lấy RUNTIME từ tab Tạo Kịch Bản
     (optgroup "1. CHỦ ĐỀ" + select #tsTone) — không nhân bản dữ liệu UI.
   - Renderer KHÔNG build step: mọi khai báo cấp đầu tiền tố `skl` (AGENTS §8). */

var SKL_KEY = 'skl_library_v1';

function sklLoadAll(){
  try {
    var raw = JSON.parse(localStorage.getItem(SKL_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e){ return []; }
}

function sklSaveAll(list){
  localStorage.setItem(SKL_KEY, JSON.stringify(list));
  sklSyncTsOptions();
}

function sklEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Datalist Chủ Đề / Phong cách: lấy từ toolscript ─────────────────────── */
function sklSyncDatalists(){
  var topics = document.getElementById('sklTopicList');
  if (topics){
    topics.innerHTML = '<option value="Tất cả chủ đề"></option>';
    var og = document.querySelector('#tool-toolscript optgroup[label="1. CHỦ ĐỀ"]');
    if (og) og.querySelectorAll('option').forEach(function (op){
      var v = (op.value || '').trim();
      if (v) topics.insertAdjacentHTML('beforeend', '<option value="' + sklEsc(v) + '"></option>');
    });
  }
  var styles = document.getElementById('sklStyleList');
  if (styles){
    styles.innerHTML = '<option value="Tất cả phong cách"></option>';
    var tone = document.getElementById('tsTone');
    if (tone) tone.querySelectorAll('option').forEach(function (op){
      var v = (op.value || '').trim();
      if (v) styles.insertAdjacentHTML('beforeend', '<option value="' + sklEsc(v) + '"></option>');
    });
  }
}

/* ── Form: thêm / sửa ─────────────────────────────────────────────────────── */
function sklSetStatus(msg, type){
  var el = document.getElementById('statusSkl');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? 'var(--red)' : (type === 'ok' ? 'var(--teal)' : '');
}

function sklResetForm(){
  document.getElementById('sklEditId').value = '';
  document.getElementById('sklName').value = '';
  document.getElementById('sklTopic').value = '';
  document.getElementById('sklStyle').value = '';
  document.getElementById('sklInstructions').value = '';
  document.getElementById('sklFormTitle').textContent = '➕ Thêm skill mới';
  document.getElementById('sklCancelBtn').style.display = 'none';
}

function sklSave(){
  var name = (document.getElementById('sklName').value || '').trim();
  var guide = (document.getElementById('sklInstructions').value || '').trim();
  if (!name){ sklSetStatus('Chưa nhập TÊN SKILL.', 'error'); return; }
  if (!guide){ sklSetStatus('Chưa nhập HƯỚNG DẪN VIẾT CHO AI.', 'error'); return; }
  var topic = (document.getElementById('sklTopic').value || '').trim() || 'Tất cả chủ đề';
  var style = (document.getElementById('sklStyle').value || '').trim() || 'Tất cả phong cách';
  var editId = document.getElementById('sklEditId').value;
  var list = sklLoadAll();
  if (editId){
    var it = list.find(function (s){ return s.id === editId; });
    if (!it){ sklSetStatus('Skill cần sửa không còn trong kho (đã xoá ở phiên khác?).', 'error'); sklResetForm(); return; }
    it.name = name; it.topic = topic; it.style = style; it.instructions = guide;
    sklSaveAll(list); sklRender(); sklResetForm();
    sklSetStatus('✓ Đã cập nhật skill "' + name + '".', 'ok');
    return;
  }
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name, topic: topic, style: style, instructions: guide,
    createdAt: new Date().toISOString(),
  });
  sklSaveAll(list); sklRender(); sklResetForm();
  sklSetStatus('✓ Đã thêm skill "' + name + '". Vào tab Tạo Kịch Bản để dùng.', 'ok');
}

function sklEdit(id){
  var it = sklLoadAll().find(function (s){ return s.id === id; });
  if (!it){ sklSetStatus('Skill không tồn tại.', 'error'); return; }
  document.getElementById('sklEditId').value = it.id;
  document.getElementById('sklName').value = it.name;
  document.getElementById('sklTopic').value = it.topic || '';
  document.getElementById('sklStyle').value = it.style || '';
  document.getElementById('sklInstructions').value = it.instructions || '';
  document.getElementById('sklFormTitle').textContent = '✏️ Sửa skill: ' + it.name;
  document.getElementById('sklCancelBtn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sklDelete(id){
  var list = sklLoadAll();
  var it = list.find(function (s){ return s.id === id; });
  if (!it) return;
  list = list.filter(function (s){ return s.id !== id; });
  sklSaveAll(list); sklRender();
  sklSetStatus('Đã xoá skill "' + it.name + '".', 'ok');
}

/* ── Tải / xoá hàng loạt (2026-09-17zg) ───────────────────────────────────── */
/* sklSlug: biến tên skill thành tên file an toàn (bỏ dấu tiếng Việt,
   thay ký tự cấm Windows bằng "-"). */
function sklSlug(name){
  return (String(name || 'skill').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60)) || 'skill';
}

/* sklDownloadFile: lưu text ra file qua Blob + a.download (pattern chung
   của renderer — imzic-export, t7-export). */
function sklDownloadFile(filename, text){
  var blob = new Blob([text], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function (){ URL.revokeObjectURL(url); }, 2000);
}

/* sklDownload: tải 1 skill ra file .json (sao lưu / chia sẻ). */
function sklDownload(id){
  var it = sklLoadAll().find(function (s){ return s.id === id; });
  if (!it){ sklSetStatus('Skill không tồn tại.', 'error'); return; }
  sklDownloadFile('skill-' + sklSlug(it.name) + '.json', JSON.stringify(it, null, 2));
  sklSetStatus('⬇ Đã tải skill "' + it.name + '" ra file .json.', 'ok');
}

/* sklDownloadAll: tải TOÀN BỘ skill đã lưu ra 1 file .json. */
function sklDownloadAll(){
  var list = sklLoadAll();
  if (!list.length){ sklSetStatus('Kho đang trống — không có skill nào để tải.', 'error'); return; }
  sklDownloadFile('skills-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(list, null, 2));
  sklSetStatus('⬇ Đã tải ' + list.length + ' skill ra file .json.', 'ok');
}

/* sklDeleteAll: xoá TOÀN BỘ skill trong kho — có confirm chặn lại,
   không thể hoàn tác (theo pattern window.confirm của tool-ffx, imzic). */
function sklDeleteAll(){
  var list = sklLoadAll();
  if (!list.length){ sklSetStatus('Kho đang trống — không có skill nào để xoá.', 'error'); return; }
  if (!window.confirm('Xoá TOÀN BỘ ' + list.length + ' skill đã lưu?\n\nHành động này KHÔNG THỂ hoàn tác.')) return;
  sklSaveAll([]);
  sklRender();
  sklResetForm();
  sklSetStatus('🗑 Đã xoá toàn bộ ' + list.length + ' skill.', 'ok');
}

/* ── Chuẩn hoá v1 → v2 (2026-09-17zi) ─────────────────────────────────────── */
/* Bộ skill v1 có format nhãn cố định trong instructions:
   "Mở đầu bằng … Cấu trúc: … Nhịp: … Loop: … Cấm: …"
   sklParseV1Instructions tách các nhãn đó (chỉ nhãn ĐẦU TIÊN của mỗi loại) —
   KHÔNG suy đoán gì thêm; thiếu nhãn → trường trống. */
function sklParseV1Instructions(text){
  var t = String(text || '').trim();
  if (!t) return null;
  var LABELS = [
    { key: 'hook',      re: /Mở đầu bằng/ },
    { key: 'structure', re: /Cấu trúc[^:]{0,30}:/ },
    { key: 'rhythm',    re: /Nhịp[^:]{0,20}:/ },
    { key: 'loop',      re: /Loop\s*:/i },
    { key: 'forbidden', re: /Cấm[^:]{0,20}:/ }
  ];
  var marks = [];
  LABELS.forEach(function (L){
    var m = t.match(L.re);
    if (m && m.index >= 0) marks.push({ key: L.key, at: m.index, len: m[0].length });
  });
  if (!marks.length) return null;
  marks.sort(function (a, b){ return a.at - b.at; });
  var seg = {};
  marks.forEach(function (mk, i){
    var end = i + 1 < marks.length ? marks[i + 1].at : t.length;
    seg[mk.key] = t.slice(mk.at, end).trim();   // giữ nguyên văn kể cả nhãn
  });
  return seg;
}

/* sklSplitList: tách list theo separator truyền vào (';' hoặc ',') —
   bỏ item quá ngắn (<2 ký tự), bỏ chấm cuối item. */
function sklSplitList(text, sep){
  var re = sep === ',' ? /,/ : /;/;
  return String(text || '').split(re).map(function (x){ return x.trim(); })
    .map(function (x){ return x.replace(/\.$/, ''); })
    .filter(function (x){ return x.length > 1; });
}

/* sklStripLabel: bỏ nhãn đầu ("Cấu trúc:" v.v.) khỏi đoạn đã tách. */
function sklStripLabel(seg, re){
  return String(seg || '').replace(re, '').trim();
}

/* sklNormalizeAll: duyệt kho — skill v1 (hoặc v2 khuyết trường) parse được nhãn
   → nâng cấp lên chuẩn v2 (hookTemplates/structure/voice/antiPatterns) và
   GHI LẠI vào kho. role/audience/examples KHÔNG BỊA — để trống cho user bổ sung.
   instructions giữ nguyên (sklGuideFor dùng làm "GHI CHÚ THÊM"). */
function sklNormalizeAll(){
  var list = sklLoadAll();
  if (!list.length){ sklSetStatus('Kho đang trống — không có skill nào để chuẩn hoá.', 'error'); return; }
  var keptV2 = 0, plan = [], notParseable = [];
  list.forEach(function (s){
    var isFullV2 = s.version === 'v2' && (s.structure || s.hookTemplates || s.rules || s.antiPatterns);
    if (isFullV2){ keptV2++; return; }
    var seg = sklParseV1Instructions(s.instructions);
    if (seg) plan.push({ s: s, seg: seg });
    else notParseable.push(s.name);
  });
  if (!plan.length){
    sklSetStatus('Không có skill nào parse được. Đã là v2: ' + keptV2 +
      (notParseable.length ? ' — ' + notParseable.length + ' skill không có nhãn (Mở đầu bằng/Cấu trúc/Nhịp/Loop/Cấm) → giữ nguyên.' : '.'), 'ok');
    return;
  }
  var msg = 'Chuẩn hoá ' + plan.length + ' skill v1 → v2 và GHI LẠI vào kho?\n\n' +
    'Đã là v2 (giữ nguyên): ' + keptV2 + '\n' +
    'Không nhận diện được nhãn (giữ nguyên): ' + notParseable.length + '\n\n' +
    'Ánh xạ: "Mở đầu bằng" → hookTemplates · "Cấu trúc" → structure (tách ";") · "Loop" → structure · "Nhịp" → voice · "Cấm" → antiPatterns (tách ",").\n' +
    'role/audience/examples để trống — không bịa. instructions giữ nguyên.';
  if (!window.confirm(msg)) return;
  var upgraded = 0;
  plan.forEach(function (p){
    var s = p.s, seg = p.seg;
    // Structure: nhãn có biến thể ("Cấu trúc:", "Cấu trúc bậc thang:") — item tách theo ';' vì item chứa dấu phẩy.
    var structure = sklSplitList(sklStripLabel(seg.structure, /^Cấu trúc[^:]*:\s*/), ';');
    var loop = sklStripLabel(seg.loop, /^Loop\s*:\s*/i);
    if (loop) structure.push('Loop: ' + loop.replace(/\.$/, ''));
    if (structure.length) s.structure = structure;
    if (seg.hook) s.hookTemplates = [seg.hook];
    var rhythm = sklStripLabel(seg.rhythm, /^Nhịp[^:]*:\s*/);
    if (rhythm) s.voice = 'Nhịp kể: ' + rhythm;
    var bans = sklSplitList(sklStripLabel(seg.forbidden, /^Cấm[^:]*:\s*/), ',');
    if (bans.length) s.antiPatterns = bans;
    s.version = 'v2';
    upgraded++;
  });
  sklSaveAll(list);
  sklRender();
  sklSetStatus('🧰 Đã chuẩn hoá ' + upgraded + ' skill lên v2 (đã là v2: ' + keptV2 +
    (notParseable.length ? ', bỏ qua: ' + notParseable.length : '') + ').', 'ok');
}


/* ── Dùng ngay: đẩy skill sang tab Tạo Kịch Bản ──────────────────────────── */
function sklUse(id){
  var it = sklLoadAll().find(function (s){ return s.id === id; });
  if (!it){ sklSetStatus('Skill không tồn tại.', 'error'); return; }
  sklSyncTsOptions();
  var sel = document.getElementById('tsSkill');
  if (!sel || !sklGuideFor(it.name)){
    sklSetStatus('Không chèn được vào tab Tạo Kịch Bản (trang chưa nạp đủ).', 'error');
    return;
  }
  sel.value = it.name;
  if (typeof switchTool === 'function') switchTool('toolscript');
  if (typeof setStatusScript === 'function')
    setStatusScript('✓ Đã chọn skill "' + it.name + '" (' + (it.topic || '') + ' · ' + (it.style || '') + '). Nhập chủ đề rồi bấm Viết kịch bản.', 'ok');
}

/* ── Danh sách skill đã lưu (có lọc) ─────────────────────────────────────── */
function sklRender(){
  var ft = (document.getElementById('sklFilterTopic')?.value || '').toLowerCase().trim();
  var fs = (document.getElementById('sklFilterStyle')?.value || '').toLowerCase().trim();
  var all = sklLoadAll();
  var list = all.filter(function (s){
    if (ft && String(s.topic || '').toLowerCase().indexOf(ft) < 0) return false;
    if (fs && String(s.style || '').toLowerCase().indexOf(fs) < 0) return false;
    return true;
  });
  var cnt = document.getElementById('sklCount');
  if (cnt) cnt.textContent = all.length ? '· ' + all.length + ' skill' + (list.length !== all.length ? ' (lọc ra ' + list.length + ')' : '') : '';
  var box = document.getElementById('sklList');
  if (!box) return;
  if (!list.length){
    box.innerHTML = '<div style="color:var(--text-muted);font-size:12px">' + (all.length ? 'Không skill nào khớp bộ lọc.' : 'Chưa có skill nào — thêm skill đầu tiên ở cột trái.') + '</div>';
    return;
  }
  var html = list.map(function (s){
    return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg)">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<div style="font-weight:600;font-size:13px">' + sklEsc(s.name) + '</div>'
      + '<div style="display:flex;gap:6px">'
      + '<button class="btn ghost sm" onclick="sklUse(\'' + s.id + '\')" title="Chọn skill này trong tab Tạo Kịch Bản">✍️ Dùng</button>'
      + '<button class="btn ghost sm" onclick="sklEdit(\'' + s.id + '\')">✏️</button>'
      + '<button class="btn ghost sm" onclick="sklDownload(\'' + s.id + '\')" title="Tải skill này xuống máy (file .json)">⬇</button>'
      + '<button class="btn ghost sm" style="color:var(--red);border-color:var(--red)" onclick="sklDelete(\'' + s.id + '\')">🗑</button>'
      + '</div></div>'
      + '<div style="font-size:11px;color:var(--accent);margin:4px 0">🏷 ' + sklEsc(s.topic || 'Tất cả chủ đề') + ' · 🎭 ' + sklEsc(s.style || 'Tất cả phong cách') + '</div>'
      + '<div style="font-size:11.5px;color:var(--text-dim);white-space:pre-wrap;max-height:70px;overflow:hidden">' + sklEsc(s.instructions || '') + '</div>'
      + '</div>';
  }).join('');
  box.innerHTML = html;
}

/* ── Catalog: nạp trọn bộ skill mẫu (SKL_CATALOG — skill-catalog.js) ──────── */
/* Chỉ THÊM MỚI: skill trùng key (name+version) trong kho bị bỏ qua — tuyệt đối
   không ghi đè lên skill người dùng tự tạo hay tự sửa.

   Versioning (2026-09-16d): key so sánh = name+version. Bản catalog cũ thiếu
   `version` → coi như v1, key = name+@v1. Bản catalog mới có `version: 'v2'`,
   nếu user đã có bản v1 cùng tên → thêm bản v2 với hậu tố " (v2)" ở tên để
   user chọn. Nếu catalog name đã có "(v2)" sẵn thì giữ nguyên. Trùng key
   → skip (đã nạp từ phiên trước).

   Idempotency fix (2026-09-17v): key so sánh là CANONICAL (strip hậu tố
   "(v\d+)" ở tên trước khi ghép version) để re-import phát hiện đúng entry
   trùng. Trước fix: `byKey` lưu key theo tên thực (có/không "(v2)") nên
   re-import catalog v2 cùng tên với v1 đã import → "Xuyên Không@v2" không
   khớp "Xuyên Không (v2)@v2" → tạo duplicate. Sau fix: cả 2 dạng đều map
   về cùng canonical key "Xuyên Không@v2" → skip. */
function sklKeyOf(name, version){
  // Canonical key: strip hậu tố "(v\d+)" để "Foo" và "Foo (v2)" map cùng key.
  var n = String(name || '').replace(/\s*\(v\d+\)\s*$/, '').trim();
  return n + '@' + (version || 'v1');
}

/* ── Lazy-load Skill Catalog (2026-09-17x) ─────────────────────────────────
   4 file skill-catalog (~670KB) KHÔNG còn nạp đồng bộ lúc boot trong index.html.
   sklEnsureCatalog(cb) nạp động theo đúng THỨ TỰ CŨ (part-01 → part-02 → part-03
   → index.js — index concat các SKL_PART_* nên PHẢI nạp sau cả 3 part) rồi gọi cb.
   Nạp 1 lần duy nhất; lỗi mạng/file thiếu → báo lộ liễu qua status (Luật 10). */
var sklCatalogLoading = false;
var sklCatalogQueue = [];
function sklEnsureCatalog(cb){
  if (typeof SKL_CATALOG !== 'undefined' && Array.isArray(SKL_CATALOG)){ cb(); return; }
  sklCatalogQueue.push(cb);
  if (sklCatalogLoading) return;   // đang nạp — cb đã xếp hàng, chờ onload cuối cùng
  sklCatalogLoading = true;
  var files = [
    'src/toolbox/skill-catalog/part-01.js',
    'src/toolbox/skill-catalog/part-02.js',
    'src/toolbox/skill-catalog/part-03.js',
    'src/toolbox/skill-catalog/index.js'
  ];
  function flush(){
    var q = sklCatalogQueue; sklCatalogQueue = [];
    q.forEach(function (f){ try { f(); } catch (e) { /* cb tự chịu */ } });
  }
  function loadNext(i){
    if (i >= files.length){
      sklCatalogLoading = false;
      if (typeof SKL_CATALOG === 'undefined' || !Array.isArray(SKL_CATALOG) || !SKL_CATALOG.length){
        sklSetStatus('Lỗi nạp bộ skill mẫu: script đã tải nhưng SKL_CATALOG không hợp lệ.', 'error');
        flush();
        return;
      }
      flush();
      return;
    }
    var s = document.createElement('script');
    s.src = files[i];
    s.onload = function(){ loadNext(i + 1); };
    s.onerror = function(){
      sklCatalogLoading = false;
      sklSetStatus('Lỗi nạp bộ skill mẫu: không tải được ' + files[i] + '.', 'error');
      flush();
    };
    document.head.appendChild(s);
  }
  sklSetStatus('Đang nạp bộ skill mẫu…', '');
  loadNext(0);
}

function sklImportCatalog(){
  // Lazy-load: catalog chưa nạp → nạp động rồi import.
  if (typeof SKL_CATALOG === 'undefined' || !Array.isArray(SKL_CATALOG) || !SKL_CATALOG.length){
    sklEnsureCatalog(sklImportCatalog);
    return;
  }
  var cat = (typeof SKL_CATALOG === 'undefined' || !Array.isArray(SKL_CATALOG)) ? [] : SKL_CATALOG;
  if (!cat.length){
    sklSetStatus('Không tìm thấy bộ skill mẫu (src/toolbox/skill-catalog.js chưa được nạp).', 'error');
    return;
  }
  var list = sklLoadAll();
  var byKey = {};
  list.forEach(function (s){
    byKey[sklKeyOf(s.name, s.version)] = true;
  });
  var added = 0, skipped = 0, upgraded = 0;
  cat.forEach(function (c){
    var rawName = String(c.name || '').trim();
    if (!rawName || !c.instructions){ skipped++; return; }
    var cver = c.version || 'v1';
    // Canonical key: strip "(v\d+)" suffix nếu catalog name đã có sẵn.
    var canonKey = sklKeyOf(rawName, cver);
    if (byKey[canonKey]){ skipped++; return; }     // đã có trong kho (cùng name canonical + version)

    // Nếu trùng name canonical nhưng khác version → thêm với hậu tố "(v2)" nếu catalog
    // name chưa có (giúp user phân biệt v1 vs v2 ngay trong dropdown).
    var finalName = rawName;
    if (cver === 'v2' && !/\(v\d+\)\s*$/.test(rawName)){
      // Chỉ thêm "(v2)" khi bản v1 cùng tên canonical đã tồn tại trong kho.
      if (byKey[sklKeyOf(rawName, 'v1')]){
        finalName = rawName + ' (v2)';
        upgraded++;
      }
    }

    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: finalName,
      version: cver,
      topic: c.topic || 'Tất cả chủ đề',
      style: c.style || 'Tất cả phong cách',
      instructions: String(c.instructions || '').trim(),
      createdAt: new Date().toISOString(),
    };
    // Mang theo trường v2 (role/audience/voice/structure/hookTemplates/rules/
    // antiPatterns/examples) nếu có — dùng cho sklGuideFor mở rộng prompt.
    ['role', 'audience', 'voice', 'structure', 'hookTemplates', 'rules', 'antiPatterns', 'examples'].forEach(function (k){
      if (c[k] !== undefined && c[k] !== null && c[k] !== ''){
        entry[k] = c[k];
      }
    });
    list.push(entry);
    byKey[sklKeyOf(finalName, cver)] = true;   // canonical key, không phân biệt có/không "(v2)"
    added++;
  });
  if (!added){
    sklSetStatus('Bộ skill mẫu đã có sẵn trong kho — bỏ qua ' + skipped + ' skill trùng key, không ghi đè.', 'ok');
    return;
  }
  sklSaveAll(list); sklRender();
  var msg = '✓ Đã nạp ' + added + ' skill mẫu' + (skipped ? ' (bỏ qua ' + skipped + ' trùng key)' : '');
  if (upgraded){ msg += ' — trong đó ' + upgraded + ' bản v2 được thêm song song với v1 cùng tên'; }
  msg += '. Skill đã có trong kho KHÔNG bị ghi đè.';
  sklSetStatus(msg, 'ok');
}

/* ── Cầu nối sang Tạo Kịch Bản (tool-ts) ─────────────────────────────────── */
/* Chèn skill đã lưu vào <select id="tsSkill"> dưới 1 optgroup riêng.
   Rebuild mỗi lần gọi: xoá optgroup cũ trước khi thêm lại (idempotent). */
function sklSyncTsOptions(){
  var sel = document.getElementById('tsSkill');
  if (!sel) return;
  var old = document.getElementById('sklTsGroup');
  if (old) old.remove();
  var list = sklLoadAll();
  if (!list.length) return;
  var og = document.createElement('optgroup');
  og.id = 'sklTsGroup';
  og.label = '✍️ Skill của tôi (Skill panel)';
  list.forEach(function (s){
    var op = document.createElement('option');
    op.value = s.name;
    op.textContent = s.name + (s.topic && s.topic !== 'Tất cả chủ đề' ? ' · ' + s.topic : '');
    og.appendChild(op);
  });
  sel.appendChild(og);
}

/* Trả HƯỚNG DẪN VIẾT của skill theo TÊN (tool-ts ghép vào prompt WRITING SKILL).
   Không tìm thấy → rỗng (prompt chỉ dùng tên như cũ).

   v2 (2026-09-16d): nếu entry có version 'v2' và đủ 8 trường mở rộng
   (role/audience/voice/structure/hookTemplates/rules/antiPatterns/examples),
   ghép thành prompt chuyên gia (writer frame) thay vì chỉ trả về
   `instructions` ngắn. Mục đích: AI học được giọng văn + structure + anti-
   pattern của persona, không chỉ hướng dẫn chung chung. */
function sklGuideFor(name){
  var n = String(name || '').trim();
  if (!n) return '';
  var it = sklLoadAll().find(function (s){ return s.name === n; });
  if (!it) return '';

  // Bản cũ (v1 hoặc thiếu version, không có trường mở rộng) → trả về instructions.
  if ((it.version || 'v1') !== 'v2'){
    return String(it.instructions || '').trim();
  }

  // Bản v2 — ghép prompt chuyên gia.
  var lines = [];
  if (it.role)        lines.push('▶ VAI TRÒ: ' + String(it.role).trim());
  if (it.audience)    lines.push('\n▶ ĐỐI TƯỢNG XEM: ' + String(it.audience).trim());
  if (it.voice)       lines.push('\n▶ GIỌNG VĂN: ' + String(it.voice).trim());
  if (Array.isArray(it.structure) && it.structure.length){
    lines.push('\n▶ CẤU TRÚC:');
    it.structure.forEach(function (s, i){
      lines.push('  ' + (i + 1) + '. ' + String(s).trim());
    });
  }
  if (Array.isArray(it.hookTemplates) && it.hookTemplates.length){
    lines.push('\n▶ CÂU MỞ ĐẦU MẪU:');
    it.hookTemplates.forEach(function (h){
      lines.push('  • ' + String(h).trim());
    });
  }
  if (Array.isArray(it.rules) && it.rules.length){
    lines.push('\n▶ QUY TẮC CỨNG:');
    it.rules.forEach(function (r){
      lines.push('  ✓ ' + String(r).trim());
    });
  }
  if (Array.isArray(it.antiPatterns) && it.antiPatterns.length){
    lines.push('\n▶ CẤM (anti-pattern):');
    it.antiPatterns.forEach(function (a){
      lines.push('  ✗ ' + String(a).trim());
    });
  }
  if (it.examples && (it.examples.hook || it.examples.outro)){
    lines.push('\n▶ VÍ DỤ MẪU:');
    if (it.examples.hook)  lines.push('  — Mở đầu: ' + String(it.examples.hook).trim());
    if (it.examples.outro) lines.push('  — Kết: ' + String(it.examples.outro).trim());
  }
  if (it.instructions) lines.push('\n▶ GHI CHÚ THÊM: ' + String(it.instructions).trim());

  return lines.join('\n');
}

/* ── Boot: panel markup đã parse trước script (script nằm cuối body) ─────── */
sklSyncDatalists();
sklSyncTsOptions();
sklRender();
setTimeout(sklSyncDatalists, 600);   // chốt lại sau khi DOM panel sort xong
