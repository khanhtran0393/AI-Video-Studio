/* PROMPT LIB — sửa prompt tại chỗ, style tail, thư viện asset (_getLib), setSyncStatus
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _sceneStyleTail(p){
  const base = (_cleanSceneStyle(p && p.sceneStyle) || '').trim().replace(/\s*[.;]\s*$/, '');
  const med = _profileMedium(p).medium;
  const head = base || med || 'consistent cinematic style, cohesive lighting';
  // Chỉ thêm medium khi Scene Style CHƯA nói rõ chất liệu — tránh lặp kiểu "flat-2D … — hand-drawn 2D illustration".
  const said = /\b(2d|flat|hand.?drawn|photo|3d|anime|watercolou?r|line.?art|render)\b/i.test(base);
  return head + (med && (!base || !said) ? ' — ' + med : '') + '. 16:9 cinematic framing. no text, no watermark, no logos.';
}

function _forceStyleTail(prompt, p){
  let s = String(prompt || '').trim();
  s = s.replace(/\s*(?:→\s*)?(?:Modern\s+flat-?2D|Scene aesthetic|Style\s*:|Aesthetic\s*:)[\s\S]*$/i, '');   // cắt từ chỗ AI bắt đầu tả style
  s = s.replace(/\s*(?:\.|,)?\s*(?:no text|no watermark|no logos|all text in English[^.]*|no Korean[^.]*)\.?\s*$/gi, '');
  s = s.replace(/\s*Consistent reference\s*:\s*\[[^\]]+\]\.?\s*$/i, (m) => m);   // giữ nguyên phần tham chiếu nếu có
  s = s.trim().replace(/[.,;\s]+$/, '');
  const ref = /Consistent reference\s*:\s*\[[^\]]+\]/i.exec(prompt || '');
  const refTxt = ref ? ' ' + ref[0].trim().replace(/\.$/, '') + '.' : '';
  s = s.replace(/\s*Consistent reference\s*:\s*\[[^\]]+\]\.?/i, '').trim().replace(/[.,;\s]+$/, '');
  return s + '. ' + _sceneStyleTail(p) + refTxt;
}

function cleanPrompt(p){
  if (!p) return '';
  let s = String(p).trim();
  // Loop strip multiple prefixes if AI stacks them
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s.replace(/^LO[ẠA]I\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.replace(/^TYPE\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.replace(/^\[\s*\d+\s*\]\s*/, '');
    s = s.replace(/^SCENE\s*\d+\s*[—–\-:]\s*/i, '');
    s = s.trim();
    if (s === before) break;
  }
  return s;
}

function _ensureSceneTags(promptText, scene){
  if ((state.descMode || 'tag') !== 'tag' || !scene) return promptText;   // chỉ chế độ Tag mới cần [tag]
  let t = String(promptText || '').trim();
  if (!t) return t;
  // Cảnh GIẢI THÍCH kiểu icon nền trắng (style lai) → KHÔNG chèn tag bối cảnh/nhân vật (icon trên nền trắng, không reference)
  if (/plain\s+(solid\s+)?white background|line-art (pictogram|icon)|pictogram icons?|no scenery/i.test(t)) return t;
  const need = [];
  // Bối cảnh: luôn nên có (kể cả cảnh b-roll vẫn có địa điểm)
  if (scene.background && !t.includes('[' + scene.background + ']')) need.push('[' + scene.background + ']');
  // Nhân vật: cảnh CÓ slug nhân vật (storyboard chỉ gán khi thật sự có người; b-roll/biểu đồ để rỗng) → LUÔN chèn [tag]
  // để đính ĐÚNG ref, không phụ thuộc regex tên vai (dễ sót "monarch", "oncologist"…).
  if (scene.character && !t.includes('[' + scene.character + ']')) need.unshift('[' + scene.character + ']');
  if (need.length) t += (t.endsWith('.') ? ' ' : '. ') + 'Consistent reference: ' + need.join(', ') + '.';
  return t;
}

function _mirrorTagsFromA(promptB, promptA){
  let t = String(promptB || '').trim();
  if (!t) return t;
  const aTags = String(promptA || '').match(/\[[^\[\]]+\]/g) || [];
  const missing = [];
  for (const tag of aTags) if (!t.includes(tag) && !missing.includes(tag)) missing.push(tag);
  if (missing.length) t += (t.endsWith('.') ? ' ' : '. ') + 'Consistent reference: ' + missing.join(', ') + '.';
  return t;
}

function _isLazyPrompt(text){
  let s = String(text || '').trim();
  // bỏ phần đuôi do app tự chèn để xét đúng phần AI viết
  s = s.replace(/\bConsistent reference:.*$/i, '').replace(/--ar\s*\d+:\d+\s*$/i, '').trim();
  if (s.length < 40) return true;                                  // quá ngắn = không phải prompt thật
  if (/^[.\s…]+$/.test(s)) return true;                            // toàn dấu chấm
  if (/\.{2,}\s*full prompt|full prompt\s*\.{2,}|\[full prompt\]|<full prompt>|^\s*\.{3}/i.test(s)) return true;
  if (/\b(same as (above|previous|before)|như (trên|cảnh trước|trước)|tương tự (cảnh )?trên|see above)\b/i.test(s)) return true;
  return false;
}

function startEditPrompt(type, key){
  state.editingPrompt = { type, key };
  rerenderAfterPromptEdit();
  // Focus textarea after render
  setTimeout(() => {
    const ta = document.getElementById('editPromptTA');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function cancelEditPrompt(){
  state.editingPrompt = null;
  rerenderAfterPromptEdit();
}

function saveEditPrompt(){
  const ta = document.getElementById('editPromptTA');
  if (!ta || !state.editingPrompt) return;
  const val = ta.value.trim();
  const { type, key } = state.editingPrompt;
  if (type === 'scene') state.scenePrompts[key] = val;
  else if (type === 'scene2') { if (!state.scenePrompts2) state.scenePrompts2 = {}; state.scenePrompts2[key] = val; }
  else if (type === 'char') state.assetCharPrompts[key] = val;
  else if (type === 'bg') state.assetBgPrompts[key] = val;
  else if (type === 'styleRef') state.styleRefPrompt = val;
  else if (type === 'veo') {
    if (!state.veoPrompts[key]) state.veoPrompts[key] = {};
    state.veoPrompts[key].prompt = val;
  }
  state.editingPrompt = null;
  rerenderAfterPromptEdit();
  saveState(true);
}

function rerenderAfterPromptEdit(){
  if (typeof renderPromptsV === 'function') renderPromptsV();
  if (state.charactersV?.length && typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  if (state.backgroundsV?.length && typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  // Style ref render (handle both view + edit mode)
  renderStyleRef();
}

function renderStyleRef(){
  const body = document.getElementById('t3StyleRefBody');
  if (!body) return;
  const editing = isEditingPrompt('styleRef', null);
  if (editing) {
    body.innerHTML = renderEditPromptUI(state.styleRefPrompt || '');
    setTimeout(() => {
      const ta = document.getElementById('editPromptTA');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 50);
  } else {
    body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:13px">${escapeHtml(state.styleRefPrompt || '')}</div>`;
  }
}

function isEditingPrompt(type, key){
  return state.editingPrompt && state.editingPrompt.type === type && state.editingPrompt.key === key;
}

function renderEditPromptUI(currentValue){
  const safe = String(currentValue || '').replace(/</g, '&lt;');
  return `<textarea id="editPromptTA" style="width:100%;min-height:120px;font-size:12.5px;line-height:1.6;background:var(--surface);border:2px solid var(--accent);padding:10px;border-radius:6px">${safe}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button class="btn primary sm" onclick="saveEditPrompt()">✓ Lưu</button>
      <button class="btn ghost sm" onclick="cancelEditPrompt()">✗ Huỷ</button>
      <span style="font-size:11px;color:var(--text-muted);align-self:center;margin-left:8px">Ctrl+Enter để lưu nhanh</span>
    </div>`;
}

function _getLib(){
  if (!state.assetLibrary) state.assetLibrary = { chars: {}, bgs: {} };
  if (!state.assetLibrary.chars) state.assetLibrary.chars = {};
  if (!state.assetLibrary.bgs) state.assetLibrary.bgs = {};
  return state.assetLibrary;
}

async function saveToLibraryUI(type, name){
  const isChar = type === 'char';
  const prompt = isChar ? state.assetCharPrompts?.[name] : state.assetBgPrompts?.[name];
  if (!prompt) return alert(`Asset "${name}" chưa có prompt. Generate trước khi lưu Library.`);
  const lib = _getLib();
  const target = isChar ? lib.chars : lib.bgs;
  const isUpdate = !!target[name];
  if (isUpdate && !confirm(`"${name}" đã có trong Library. Ghi đè?`)) return;
  // Save image to IDB if char has image
  let hasImage = false;
  if (isChar && state.characterImages?.[name]) {
    const uid = window.currentUser?.uid;
    if (uid) {
      try {
        await IDB.set(uid + '/libraryImages/' + name, state.characterImages[name]);
        hasImage = true;
      } catch(e) { console.warn('IDB save lib image failed:', e); }
    }
  }
  target[name] = { name, prompt, hasImage, savedAt: Date.now() };
  saveState(true);
  setStatus3(`📚 ✓ Đã lưu "${name}" vào Library${hasImage ? ' (có ảnh)' : ''}.`, 'ok');
  if (document.getElementById('libraryModal')?.style.display === 'flex') renderAssetLibrary();
}

async function deleteFromLibrary(type, name){
  if (!confirm(`Xoá "${name}" khỏi Library?\nVideo đã dùng asset này vẫn không bị ảnh hưởng.`)) return;
  const lib = _getLib();
  const target = type === 'char' ? lib.chars : lib.bgs;
  if (!target[name]) return;
  const hasImg = target[name].hasImage;
  delete target[name];
  if (hasImg) {
    const uid = window.currentUser?.uid;
    if (uid) {
      try { await IDB.set(uid + '/libraryImages/' + name, null); } catch(e) {}
    }
  }
  renderAssetLibrary();
  saveState(true);
}

async function useFromLibrary(type, name){
  const isChar = type === 'char';
  const lib = _getLib();
  const entry = isChar ? lib.chars[name] : lib.bgs[name];
  if (!entry) return false;
  if (isChar) {
    if (!state.assetCharPrompts) state.assetCharPrompts = {};
    state.assetCharPrompts[name] = entry.prompt;
    state.charactersV = state.charactersV || [];
    if (!state.charactersV.includes(name)) state.charactersV.push(name);
    if (entry.hasImage) {
      const uid = window.currentUser?.uid;
      if (uid) {
        try {
          const img = await IDB.get(uid + '/libraryImages/' + name);
          if (img) {
            if (!state.characterImages) state.characterImages = {};
            state.characterImages[name] = img;
          }
        } catch(e) {}
      }
    }
    if (typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  } else {
    if (!state.assetBgPrompts) state.assetBgPrompts = {};
    state.assetBgPrompts[name] = entry.prompt;
    state.backgroundsV = state.backgroundsV || [];
    if (!state.backgroundsV.includes(name)) state.backgroundsV.push(name);
    if (typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  }
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  saveState(true);
  setStatus3(`📚 ✓ Đã pull "${name}" từ Library vào video hiện tại.`, 'ok');
  closeAssetLibrary();
  return true;
}

function checkLibraryFor(type, name){
  const lib = _getLib();
  return type === 'char' ? lib.chars[name] : lib.bgs[name];
}

function closeAssetLibrary(){
  const m = document.getElementById('libraryModal');
  if (m) m.style.display = 'none';
}

function switchLibTab(tab){
  _libTab = tab;
  document.querySelectorAll('.lib-tab').forEach(b => {
    const active = b.dataset.tab === tab;
    b.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    b.style.color = active ? 'var(--text)' : 'var(--text-muted)';
    b.style.fontWeight = active ? '600' : '400';
  });
  renderAssetLibrary();
}

function renderAssetLibrary(){
  const content = document.getElementById('libContent');
  if (!content) return;
  const lib = _getLib();
  const charCount = Object.keys(lib.chars).length;
  const bgCount = Object.keys(lib.bgs).length;
  const cc = document.getElementById('libCharCount'); if (cc) cc.textContent = charCount;
  const bc = document.getElementById('libBgCount'); if (bc) bc.textContent = bgCount;
  const target = _libTab === 'chars' ? lib.chars : lib.bgs;
  const items = Object.values(target).sort((a,b) => (b.savedAt||0) - (a.savedAt||0));
  const search = (document.getElementById('libSearch')?.value || '').toLowerCase().trim();
  const filtered = items.filter(a => !search || a.name.toLowerCase().includes(search));
  if (filtered.length === 0) {
    content.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--text-muted);font-size:13px">
      ${search ? `Không tìm thấy "${escapeHtml(search)}".` : 'Library rỗng. Vào Tool 3, bấm <strong>💾 Lưu Library</strong> trên prompt asset để bắt đầu.'}
    </div>`;
    return;
  }
  const typeKey = _libTab === 'chars' ? 'char' : 'bg';
  content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px">` +
    filtered.map(a => {
      const nameEsc = a.name.replace(/'/g, "\\'");
      const promptPreview = (a.prompt || '').slice(0, 200);
      const dateStr = a.savedAt ? new Date(a.savedAt).toLocaleDateString('vi-VN') : '';
      return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:8px">
          <strong style="font-size:13px;line-height:1.3;word-break:break-word">${escapeHtml(a.name)}</strong>
          ${a.hasImage ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:2px 6px;border-radius:8px;white-space:nowrap">🖼 Có ảnh</span>' : ''}
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);line-height:1.55;flex:1;max-height:80px;overflow:hidden;margin-bottom:10px">${escapeHtml(promptPreview)}${a.prompt.length>200?'...':''}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn primary sm" style="flex:1;font-size:11.5px" onclick="useFromLibrary('${typeKey}','${nameEsc}')">↓ Dùng vào video này</button>
          <button class="btn ghost sm" onclick="deleteFromLibrary('${typeKey}','${nameEsc}')" title="Xoá khỏi Library">🗑</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px;text-align:right">Lưu: ${dateStr}</div>
      </div>`;
    }).join('') + '</div>';
}

function setSyncStatus(msg, type){
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const colors = { ok: 'var(--green)', err: 'var(--red)', working: 'var(--violet)', info: 'var(--text-dim)' };
  el.textContent = msg;
  el.style.color = colors[type] || colors.info;
}

