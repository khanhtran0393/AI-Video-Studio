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
   → skip (đã nạp từ phiên trước). */
function sklImportCatalog(){
  var cat = (typeof SKL_CATALOG === 'undefined' || !Array.isArray(SKL_CATALOG)) ? [] : SKL_CATALOG;
  if (!cat.length){
    sklSetStatus('Không tìm thấy bộ skill mẫu (src/toolbox/skill-catalog.js chưa được nạp).', 'error');
    return;
  }
  var list = sklLoadAll();
  var byKey = {};
  list.forEach(function (s){
    byKey[String(s.name) + '@' + (s.version || 'v1')] = true;
  });
  var added = 0, skipped = 0, upgraded = 0;
  cat.forEach(function (c){
    var rawName = String(c.name || '').trim();
    if (!rawName || !c.instructions){ skipped++; return; }
    var cver = c.version || 'v1';
    var key = rawName + '@' + cver;
    if (byKey[key]){ skipped++; return; }     // trùng key (cùng name+version) → skip

    // Nếu trùng name nhưng khác version → thêm với hậu tố "(v2)" nếu catalog
    // name chưa có (giúp user phân biệt v1 vs v2 ngay trong dropdown).
    var finalName = rawName;
    if (cver === 'v2' && !/\(v\d+\)\s*$/.test(rawName)){
      // Chỉ thêm "(v2)" khi bản v1 cùng tên đã tồn tại trong kho.
      var v1Key = rawName + '@v1';
      if (byKey[v1Key]){
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
    byKey[key] = true;
    if (finalName !== rawName) byKey[finalName + '@' + cver] = true;
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
