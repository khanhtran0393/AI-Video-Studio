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
    // Chip metadata (2026-09-18o đợt 2, đề xuất #5) — tóm tắt nhanh trường
    // mở rộng v2/v4/v5: số mục QA, số nhãn hook, swatch color palette, version.
    // Chỉ đọc — không sinh event. Click vào card vẫn mở modal Hướng dẫn.
    var chips = [];
    var ver = s.version || 'v1';
    chips.push('<span style="display:inline-block;padding:1px 6px;border-radius:6px;background:' + (ver === 'v1' ? 'var(--bg-elev,#222)' : 'rgba(255,200,80,0.15)') + ';color:' + (ver === 'v1' ? 'var(--text-muted)' : '#d4a045') + ';font-size:10px;font-weight:600">v' + (ver.replace(/^v/, '')) + '</span>');
    if (Array.isArray(s.qaChecklist) && s.qaChecklist.length)
      chips.push('<span title="' + s.qaChecklist.length + ' mục QA" style="display:inline-block;padding:1px 6px;border-radius:6px;background:rgba(80,200,120,0.15);color:#5fb87a;font-size:10px">✓ ' + s.qaChecklist.length + ' QA</span>');
    if (Array.isArray(s.hookLabels) && s.hookLabels.length)
      chips.push('<span title="' + s.hookLabels.length + ' nhãn hook: ' + s.hookLabels.join(', ') + '" style="display:inline-block;padding:1px 6px;border-radius:6px;background:rgba(120,160,255,0.15);color:#8ab0ff;font-size:10px">🏷 ' + s.hookLabels.length + '</span>');
    if (Array.isArray(s.negativePrompts) && s.negativePrompts.length)
      chips.push('<span title="' + s.negativePrompts.length + ' câu cấm AI đề xuất" style="display:inline-block;padding:1px 6px;border-radius:6px;background:rgba(255,120,120,0.15);color:#ff8888;font-size:10px">🚫 ' + s.negativePrompts.length + '</span>');
    if (Array.isArray(s.seedQuestions) && s.seedQuestions.length)
      chips.push('<span title="' + s.seedQuestions.length + ' câu hỏi hạt giống" style="display:inline-block;padding:1px 6px;border-radius:6px;background:rgba(200,160,255,0.15);color:#c4a0f0;font-size:10px">🌱 ' + s.seedQuestions.length + '</span>');
    if (s.visualHints && Array.isArray(s.visualHints.colorPalette) && s.visualHints.colorPalette.length){
      var swatches = s.visualHints.colorPalette.slice(0, 6).map(function (c){
        // Mỗi mục có thể là tên màu ("đen") hoặc hex ("#1a1a1a"). Thử parse hex trước.
        var cstr = String(c).trim();
        var isHex = /^#?[0-9a-f]{3,8}$/i.test(cstr);
        var bg = isHex ? (cstr.startsWith('#') ? cstr : '#' + cstr) : cstr;   // browser chấp nhận tên màu CSS
        return '<span title="' + sklEsc(c) + '" style="display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--border);background:' + bg + ';vertical-align:middle;margin-right:2px"></span>';
      }).join('');
      if (s.visualHints.colorPalette.length > 6) swatches += '<span style="font-size:10px;color:var(--text-muted)">+' + (s.visualHints.colorPalette.length - 6) + '</span>';
      chips.push('<span title="Bảng màu gợi ý" style="display:inline-flex;align-items:center;gap:0;padding:1px 6px;border-radius:6px;background:var(--bg-elev,#222);font-size:10px">' + swatches + '</span>');
    }
    return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg)">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<div style="font-weight:600;font-size:13px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + sklEsc(s.name) + ' ' + chips.join(' ') + '</div>'
      + '<div style="display:flex;gap:6px">'
      + '<button class="btn ghost sm" onclick="sklUse(\'' + s.id + '\')" title="Chọn skill này trong tab Tạo Kịch Bản">✍️ Dùng</button>'
      + '<button class="btn ghost sm" onclick="sklShowGuide(\'' + s.id + '\')" title="Xem + Copy prompt hướng dẫn AI" style="color:var(--accent);border-color:var(--accent)">📋 Hướng dẫn</button>'
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

/* ── Xem + Copy hướng dẫn (2026-09-18o đợt 2, đề xuất #1) ──────────────────── */
/* Modal dùng theme app (AGENTS §8 cấm alert/confirm hệ thống): backdrop blur,
   nút .btn primary/ghost, Esc = đóng, click nền = đóng. Trả về text prompt
   để user copy hoặc dán vào Tạo Kịch Bản (tool-ts). Nếu entry không tìm
   thấy hoặc sklGuideFor trả rỗng → báo rõ "chưa có hướng dẫn mở rộng". */
function sklShowGuide(id){
  var it = sklLoadAll().find(function (s){ return s.id === id; });
  if (!it){ sklSetStatus('Skill không tồn tại trong kho.', 'error'); return; }
  var guide = sklGuideFor(it.name) || '';
  // Xoá modal cũ nếu có (idempotent)
  var old = document.getElementById('sklGuideModal');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'sklGuideModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:720px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.4)';
  panel.innerHTML = ''
    + '<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px">'
    +   '<div style="font-weight:600;font-size:14px">📋 Hướng dẫn AI — ' + sklEsc(it.name) + '</div>'
    +   '<button class="btn ghost sm" data-act="close" style="padding:2px 8px">✕</button>'
    + '</div>'
    + '<div style="padding:14px 18px;overflow:auto;flex:1;font-family:var(--mono,monospace);font-size:12px;line-height:1.5;white-space:pre-wrap;color:var(--text)" id="sklGuideText">' + (guide ? sklEsc(guide) : '<em style="color:var(--text-muted)">(Skill này chưa có hướng dẫn mở rộng — chỉ có "instructions" ngắn. Mở ✏️ để nâng cấp lên v2/v4/v5.)</em>') + '</div>'
    + '<div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">'
    +   '<button class="btn ghost sm" data-act="close">Đóng</button>'
    +   '<button class="btn primary sm" data-act="copy"' + (guide ? '' : ' disabled style="opacity:0.5;cursor:not-allowed"') + '>📋 Copy prompt</button>'
    + '</div>';
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Event delegation
  overlay.addEventListener('click', function (e){
    if (e.target === overlay) overlay.remove();        // click nền = đóng
    var act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (act === 'close') overlay.remove();
    if (act === 'copy' && guide){
      var ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(guide).then(function(){
            sklSetStatus('✓ Đã copy ' + guide.length + ' ký tự hướng dẫn vào clipboard.', 'ok');
          }).catch(function(){
            // fallback khi clipboard API fail (Electron có thể chặn)
            sklFallbackCopy(guide);
          });
          ok = true;
        }
      } catch (ex){}
      if (!ok) sklFallbackCopy(guide);
      overlay.remove();
    }
  });
  // Esc = đóng
  function onKey(e){
    if (e.key === 'Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); }
  }
  document.addEventListener('keydown', onKey);
}

/* Fallback copy: dùng textarea + execCommand khi clipboard API fail.
   KHÔNG dùng cho dữ liệu nhạy cảm (chỉ là text prompt của user). */
function sklFallbackCopy(text){
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) sklSetStatus('✓ Đã copy ' + text.length + ' ký tự (fallback).', 'ok');
    else sklSetStatus('⚠ Không copy được — tự chọn text và Ctrl+C.', 'error');
  } catch (e){
    sklSetStatus('⚠ Copy lỗi: ' + (e && e.message || e), 'error');
  }
}

/* ── Validate entry schema (2026-09-18o đợt 2, đề xuất #7) ────────────── */
/* Trả về mảng lỗi (rỗng = OK). Không silent skip — ghi rõ trường nào sai
   để người dùng/bảo trì sửa. Áp dụng trong sklImportCatalog (fail-fast
   per-entry) + có thể dùng cho sklSave nếu user tự nhập tay.

   Schema cho mỗi trường mở rộng (v2 + v4 + v5):
   - role/audience/voice/personaVN: string 1-dòng, 0..500 ký tự
   - structure/hookTemplates/rules/antiPatterns/voiceUse/voiceAvoid/
     qaChecklist/hookLabels/negativePrompts/seedQuestions: string[] (mỗi mục 1..500 ký tự, 0..50 mục)
   - examples: object { hook?, outro?, scene? } (mỗi key optional string 0..1000 ký tự) HOẶC string cũ (back-compat)
   - visualHints: object { colorPalette?, wardrobe?, locations?, camera?, fx?, props?, forbidden? } mỗi key string[] 0..50 mục
   - crosswalk: object { related?, contrast?, genre?, noMix? } mỗi key string|string[] 0..50
   - pacing: object { tempo?, beatMap? } tempo string, beatMap string[] 0..30
   - voiceSample: string 0..500 ký tự (1 đoạn mẫu) */
var SKL_FIELD_SCHEMA = {
  // string
  role:        { type: 'string', maxLen: 500 },
  audience:    { type: 'string', maxLen: 500 },
  voice:       { type: 'string', maxLen: 500 },
  personaVN:   { type: 'string', maxLen: 500 },
  voiceSample: { type: 'string', maxLen: 500 },
  // string[]
  structure:       { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  hookTemplates:   { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  rules:           { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  antiPatterns:    { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  voiceUse:        { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  voiceAvoid:      { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  qaChecklist:     { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  hookLabels:      { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  negativePrompts: { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  seedQuestions:   { type: 'array', of: 'string', maxItems: 50, itemMaxLen: 500 },
  // object với sub-key cố định
  examples:    { type: 'object', shape: { hook: 'string', outro: 'string', scene: 'string' }, loose: true },
  visualHints: { type: 'object', shape: { colorPalette: 'array', wardrobe: 'array', locations: 'array', camera: 'array', fx: 'array', props: 'array', forbidden: 'array' } },
  crosswalk:   { type: 'object', shape: { related: 'mixed', contrastWith: 'mixed', genre: 'mixed', forbidMix: 'mixed' } },
  pacing:      { type: 'object', shape: { tempo: 'string', beatMap: 'array' } }
};

function sklValidateEntry(name, entry){
  var errs = [];
  if (!entry || typeof entry !== 'object'){
    errs.push('entry không phải object');
    return errs;
  }
  Object.keys(SKL_FIELD_SCHEMA).forEach(function (key){
    var v = entry[key];
    if (v === undefined || v === null) return;   // optional
    var s = SKL_FIELD_SCHEMA[key];
    if (s.type === 'string'){
      if (typeof v !== 'string'){ errs.push(key + ': phải là string, nhận ' + typeof v); return; }
      if (v.length > s.maxLen) errs.push(key + ': ' + v.length + ' ký tự > ' + s.maxLen);
    } else if (s.type === 'array'){
      if (!Array.isArray(v)){ errs.push(key + ': phải là array, nhận ' + typeof v); return; }
      if (v.length > s.maxItems) errs.push(key + ': ' + v.length + ' mục > ' + s.maxItems);
      v.forEach(function (it, i){
        if (s.of === 'string' && typeof it !== 'string'){
          errs.push(key + '[' + i + ']: phải là string, nhận ' + typeof it);
        } else if (s.of === 'string' && it.length > s.itemMaxLen){
          errs.push(key + '[' + i + ']: ' + it.length + ' ký tự > ' + s.itemMaxLen);
        }
      });
    } else if (s.type === 'object'){
      // Nếu loose = true (vd examples cho phép string back-compat v1) → chấp nhận string.
      if (s.loose && typeof v === 'string') return;
      if (typeof v !== 'object' || Array.isArray(v)){
        errs.push(key + ': phải là object, nhận ' + (Array.isArray(v) ? 'array' : typeof v));
        return;
      }
      // shape check: mỗi sub-key khai báo trong schema
      Object.keys(s.shape).forEach(function (sub){
        var subV = v[sub];
        if (subV === undefined || subV === null) return;
        var expected = s.shape[sub];
        if (expected === 'string' && typeof subV !== 'string'){
          errs.push(key + '.' + sub + ': phải là string, nhận ' + typeof subV);
        } else if (expected === 'array' && !Array.isArray(subV)){
          errs.push(key + '.' + sub + ': phải là array, nhận ' + typeof subV);
        }
        // 'mixed' = chấp nhận string|string[] (vd crosswalk.related có thể "CORE 02" hoặc ["CORE 02","CORE 09"])
      });
      // Nếu !loose, các sub-key NGOÀI shape → cảnh báo
      if (!s.loose){
        Object.keys(v).forEach(function (sub){
          if (!(sub in s.shape)) errs.push(key + '.' + sub + ': sub-key không có trong schema');
        });
      }
    }
  });
  return errs;
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
    // antiPatterns/examples) + nâng cấp v4 (visualHints/voiceUse/voiceAvoid/
    // crosswalk/qaChecklist/personaVN/hookLabels — 7 trường) + v5
    // (negativePrompts/seedQuestions/pacing/voiceSample) nếu có — dùng cho
    // sklGuideFor mở rộng prompt. Validate fail-fast (Luật 10) trước khi
    // đẩy vào kho: entry nào sai schema → bỏ qua + ghi log, không silent.
    // examples.scene hiện hoãn (chờ user cung cấp content thật).
    ['role', 'audience', 'voice', 'structure', 'hookTemplates', 'rules', 'antiPatterns', 'examples',
     'visualHints', 'voiceUse', 'voiceAvoid', 'crosswalk', 'qaChecklist', 'personaVN', 'hookLabels',
     'negativePrompts', 'seedQuestions', 'pacing', 'voiceSample'
    ].forEach(function (k){
      if (c[k] !== undefined && c[k] !== null && c[k] !== ''){
        entry[k] = c[k];
      }
    });
    // Schema validation (2026-09-18o đợt 2) — fail-fast per-entry, log cảnh báo
    // nhưng KHÔNG nuốt (không silent skip): nếu errs rỗng → add; nếu có errs
    // → tăng `badCount` và in console.group để user/bảo trì thấy ngay.
    var errs = sklValidateEntry(rawName, entry);
    if (errs.length){
      if (window.console && console.groupCollapsed){
        console.groupCollapsed('⚠ SKL_CATALOG entry "' + rawName + '" (' + cver + ') bỏ qua — ' + errs.length + ' lỗi schema');
        errs.forEach(function (e){ console.warn('  · ' + e); });
        console.groupEnd();
      }
      skipped++;
      return;
    }
    list.push(entry);
    byKey[sklKeyOf(finalName, cver)] = true;   // canonical key, không phân biệt có/không "(v2)"
    added++;
  });
  if (!added){
    sklSetStatus('Bộ skill mẫu đã có sẵn trong kho — bỏ qua ' + skipped + ' skill trùng key, không ghi đè.', 'ok');
    return;
  }
  sklSaveAll(list); sklRender();
  var msg = '✓ Đã nạp ' + added + ' skill mẫu' + (skipped ? ' (bỏ qua ' + skipped + ' trùng key / schema lỗi — xem DevTools console)' : '');
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

  // ── Upgrade v4 (P0+P1+P2, 2026-09-18) — 6 section mới ──
  // Hiển thị có điều kiện: chỉ khi trường tồn tại và có nội dung. Trường rỗng
  // KHÔNG in header rỗng (giữ prompt gọn).
  function _pushLines(prefix, arr){
    if (!Array.isArray(arr) || !arr.length) return;
    lines.push('\n▶ ' + prefix + ':');
    arr.forEach(function (x){ lines.push('  • ' + String(x).trim()); });
  }
  if (Array.isArray(it.voiceUse) && it.voiceUse.length){
    _pushLines('GIỌNG NÊN DÙNG', it.voiceUse);
  }
  if (Array.isArray(it.voiceAvoid) && it.voiceAvoid.length){
    _pushLines('GIỌNG CẦN TRÁNH', it.voiceAvoid);
  }
  if (it.visualHints && typeof it.visualHints === 'object'){
    var vh = it.visualHints;
    var vhParts = [];
    if (Array.isArray(vh.colorPalette) && vh.colorPalette.length) vhParts.push('màu: ' + vh.colorPalette.join(', '));
    if (Array.isArray(vh.wardrobe) && vh.wardrobe.length)         vhParts.push('trang phục: ' + vh.wardrobe.join(', '));
    if (Array.isArray(vh.locations) && vh.locations.length)       vhParts.push('bối cảnh: ' + vh.locations.join(', '));
    if (typeof vh.camera === 'string' && vh.camera.trim())         vhParts.push('camera: ' + vh.camera.trim());
    if (typeof vh.fx === 'string' && vh.fx.trim())                 vhParts.push('hiệu ứng: ' + vh.fx.trim());
    if (Array.isArray(vh.props) && vh.props.length)                vhParts.push('đạo cụ: ' + vh.props.join(', '));
    if (vhParts.length){
      lines.push('\n▶ GỢI Ý HÌNH ẢNH:');
      vhParts.forEach(function (p){ lines.push('  • ' + p); });
    }
  }
  if (it.crosswalk && typeof it.crosswalk === 'object'){
    var cw = it.crosswalk;
    var cwParts = [];
    if (Array.isArray(cw.relatedSkills) && cw.relatedSkills.length)
      cwParts.push('liên quan: ' + cw.relatedSkills.join(' · '));
    if (Array.isArray(cw.contrastWith) && cw.contrastWith.length)
      cwParts.push('đối chiếu: ' + cw.contrastWith.join(' · '));
    if (typeof cw.genre === 'string' && cw.genre.trim())
      cwParts.push('thể loại: ' + cw.genre.trim());
    if (typeof cw.forbidMix === 'string' && cw.forbidMix.trim())
      cwParts.push('CẤM trộn: ' + cw.forbidMix.trim());
    if (cwParts.length){
      lines.push('\n▶ LIÊN KẾT VỚI SKILL KHÁC:');
      cwParts.forEach(function (p){ lines.push('  • ' + p); });
    }
  }
  if (Array.isArray(it.qaChecklist) && it.qaChecklist.length){
    _pushLines('CHECKLIST TỰ KIỂM', it.qaChecklist);
  }
  if (typeof it.personaVN === 'string' && it.personaVN.trim()){
    lines.push('\n▶ CHẤT VIỆT (persona): ' + it.personaVN.trim());
  }
  if (Array.isArray(it.hookLabels) && it.hookLabels.length){
    lines.push('\n▶ NHÃN HOOK GỢI Ý: ' + it.hookLabels.join(', '));
  }
  // v5 (2026-09-18o đợt 2): 4 section mới phục vụ AI generate chuyên sâu hơn
  if (Array.isArray(it.negativePrompts) && it.negativePrompts.length){
    _pushLines('CẤM ĐỀ XUẤT (negative prompts)', it.negativePrompts);
  }
  if (Array.isArray(it.seedQuestions) && it.seedQuestions.length){
    _pushLines('CÂU HỎI HẠT GIỐNG (seed)', it.seedQuestions);
  }
  if (it.pacing && typeof it.pacing === 'object'){
    var pParts = [];
    if (typeof it.pacing.tempo === 'string' && it.pacing.tempo.trim())
      pParts.push('nhịp: ' + it.pacing.tempo.trim());
    if (Array.isArray(it.pacing.beatMap) && it.pacing.beatMap.length)
      pParts.push('beat: ' + it.pacing.beatMap.join(' → '));
    if (pParts.length){
      lines.push('\n▶ PACING (nhịp kể):');
      pParts.forEach(function (p){ lines.push('  • ' + p); });
    }
  }
  if (typeof it.voiceSample === 'string' && it.voiceSample.trim()){
    lines.push('\n▶ MẪU GIỌNG (1 câu chuẩn):');
    lines.push('  "' + it.voiceSample.trim() + '"');
  }

  return lines.join('\n');
}

/* ── Boot: panel markup đã parse trước script (script nằm cuối body) ─────── */
sklSyncDatalists();
sklSyncTsOptions();
sklRender();
setTimeout(sklSyncDatalists, 600);   // chốt lại sau khi DOM panel sort xong
