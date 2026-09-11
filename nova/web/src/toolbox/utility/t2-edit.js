/* T2 EDIT — renumber, sửa/gộp/thêm cảnh, SRT, restoreUI
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function renumberScenes(){
  // Re-id scenes thành 001, 002, ... theo array order, remap prompts
  const oldToNew = {};
  state.scenes.forEach((s, i) => {
    const newId = String(i + 1).padStart(3, '0');
    if (s.id !== newId) oldToNew[s.id] = newId;
    s.id = newId;
  });
  if (Object.keys(oldToNew).length === 0) return;
  // Remap scenePrompts
  if (state.scenePrompts) {
    const newSP = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.scenePrompts[sourceId]) newSP[s.id] = state.scenePrompts[sourceId];
    }
    // Fallback: also keep unchanged IDs
    for (const [k, v] of Object.entries(state.scenePrompts)) {
      if (state.scenes.find(s => s.id === k) && !newSP[k]) newSP[k] = v;
    }
    state.scenePrompts = newSP;
  }
  // Remap veoPrompts
  if (state.veoPrompts) {
    const newVP = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.veoPrompts[sourceId]) newVP[s.id] = state.veoPrompts[sourceId];
    }
    for (const [k, v] of Object.entries(state.veoPrompts)) {
      if (state.scenes.find(s => s.id === k) && !newVP[k]) newVP[k] = v;
    }
    state.veoPrompts = newVP;
  }
  // Remap sceneImages (storyboard)
  if (state.sceneImages) {
    const newSI = {};
    for (const s of state.scenes) {
      const oldId = Object.keys(oldToNew).find(k => oldToNew[k] === s.id);
      const sourceId = oldId || s.id;
      if (state.sceneImages[sourceId]) newSI[s.id] = state.sceneImages[sourceId];
    }
    for (const [k, v] of Object.entries(state.sceneImages)) {
      if (state.scenes.find(s => s.id === k) && !newSI[k]) newSI[k] = v;
    }
    state.sceneImages = newSI;
  }
}

function editScene(idx){
  state.editingSceneIdx = idx;
  renderTable();
  // Focus text input
  setTimeout(() => { const t = document.getElementById('edt_text_' + idx); if (t) t.focus(); }, 50);
}

function cancelEditScene(){
  state.editingSceneIdx = -1;
  renderTable();
}

function saveEditScene(idx){
  const s = state.scenes[idx];
  if (!s) return;
  s.text = document.getElementById('edt_text_' + idx).value.trim();
  s.character = document.getElementById('edt_char_' + idx).value.trim();
  s.background = document.getElementById('edt_bg_' + idx).value.trim();
  s.camera = document.getElementById('edt_cam_' + idx).value.trim() || 'medium';
  s.duration = parseInt(document.getElementById('edt_dur_' + idx).value) || 3;
  // D2: danh dau user da chinh sua thu cong -> AI khong tu ghi de
  s.userEdited = true;
  if (s.userEditedAt == null) s.userEditedAt = Date.now();
  // Neu text thay doi so voi prompt cu, xoa scenePrompts[id] de regen
  const _oldPrompt = state.scenePrompts && state.scenePrompts[s.id];
  if (_oldPrompt && s.promptSeed && _oldPrompt.indexOf(s.promptSeed.slice(0, 30)) < 0){
    // prompt cu khong con lien quan den text moi -> xoa
    try { if (typeof novaLog === 'function') novaLog('Phat hien prompt cu khong khop text moi -> can regen', 'warn'); } catch(_){}
    if (state.scenePrompts) delete state.scenePrompts[s.id];
    if (state.veoPrompts) delete state.veoPrompts[s.id];
  }
  state.editingSceneIdx = -1;
  renderTable(); renderPreview(); renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateStats === 'function') updateStats(); saveState(true);
  setStatus2(`✓ Đã sửa cảnh ${s.id}.`, 'ok');
}

function mergeSceneWithNext(idx){
  if (idx < 0 || idx >= state.scenes.length - 1) return;
  const cur = state.scenes[idx];
  const next = state.scenes[idx+1];
  if (!confirm(`Gộp cảnh ${cur.id} với ${next.id}?\nLời thoại sẽ ghép nối, thời lượng cộng dồn.`)) return;
  // Xoá prompts của cảnh sau (cảnh trước có thể vẫn dùng được nhưng có khả năng phải re-gen)
  if (state.scenePrompts) delete state.scenePrompts[next.id];
  if (state.veoPrompts) delete state.veoPrompts[next.id];
  cur.text = (cur.text || '') + ' ' + (next.text || '');
  cur.duration = (cur.duration || 0) + (next.duration || 0);
  // Char/bg/camera: giữ của cảnh trước (không ghi đè bằng cảnh sau)
  state.scenes.splice(idx + 1, 1);
  renumberScenes();
  renderTable(); renderPreview(); renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateStats === 'function') updateStats(); saveState(true);
  setStatus2(`✓ Đã gộp cảnh.`, 'ok');
}

function addSceneAfter(idx){
  if (state.scenes.length >= getMaxScenes()) {
    return showGate(`Gói Free chỉ chứa ${getMaxScenes()} cảnh. Nâng cấp Pro để thêm.`);
  }
  const newScene = {
    id: 'tmp',
    text: '',
    duration: 3,
    character: '',
    background: '',
    camera: 'medium',
    level: 'normal'
  };
  state.scenes.splice(idx + 1, 0, newScene);
  renumberScenes();
  renderTable();
  // Mở edit mode cho cảnh vừa thêm
  state.editingSceneIdx = idx + 1;
  renderTable();
  setTimeout(() => { const t = document.getElementById('edt_text_' + (idx+1)); if (t) t.focus(); }, 50);
}

function addSceneAtEnd(){
  addSceneAfter(state.scenes.length - 1);
}

function renderPromptsV(){
  const box = document.getElementById('promptsListV');
  if (!box) return;
  const cnt = Object.keys(state.scenePrompts).length;
  document.getElementById('badge-prompts').textContent = cnt;
  if (state.scenes.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có cảnh.</div>'; return; }
  box.innerHTML = state.scenes.map(s => {
    const p = cleanPrompt(state.scenePrompts[s.id]);
    const p2 = cleanPrompt((state.scenePrompts2 || {})[s.id]);
    const promptEsc = p ? p.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const prompt2Esc = p2 ? p2.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const editing = isEditingPrompt('scene', s.id);
    const editing2 = isEditingPrompt('scene2', s.id);
    const hasB = !!(p2 || editing2);
    return `<div class="prompt-card ${p ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="prompt-card-head">
        <span class="prompt-card-id">[${s.id}]</span>
        <span class="prompt-card-meta">${escapeHtml(s.character) || '—'} · ${escapeHtml(s.background) || '—'} · ${s.camera} · ${s.duration}s</span>
      </div>
      <div class="prompt-card-vo">"${escapeHtml(s.text)}"</div>
      ${editing
        ? renderEditPromptUI(p)
        : `<div class="prompt-card-text" style="margin-bottom:4px">${p ? escapeHtml(p) : 'Chưa có prompt.'}</div>
           <div class="prompt-card-actions">
             ${p ? `<button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)">📋 Sao chép</button>
             <button class="btn ghost sm" onclick="startEditPrompt('scene','${s.id}')">✏️ Sửa</button>` : ''}
             <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleScenePrompt('${s.id}')" title="Tạo lại prompt A">🔧 ${p ? 'Tạo lại' : 'Tạo prompt'}</button>
             ${p ? `<button class="btn ghost sm" style="border-color:#dc2626;color:#dc2626" onclick="makeSafePrompt('${s.id}','A')" title="Làm mềm prompt bị G-Labs chặn — đổi từ nhạy cảm thành an toàn">🛡 Sửa vi phạm</button>` : ''}
             ${p && !hasB ? `<button class="btn ghost sm" style="border-color:var(--teal);color:var(--teal)" onclick="addPromptB('${s.id}')">✂️ Thêm ảnh B</button>` : ''}
           </div>`
      }
      ${hasB ? `<div style="margin-top:10px;padding-top:10px;border-top:1.5px dashed var(--teal)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:var(--teal);background:rgba(13,148,136,.1);padding:2px 8px;border-radius:20px">🖼 ẢNH B</span>
          <span style="font-size:11px;color:var(--text-dim)">nửa sau cảnh · ${s.duration}s</span>
          <button class="btn ghost sm" style="margin-left:auto;color:var(--red);border-color:var(--red);font-size:11px;padding:3px 8px" onclick="removePromptB('${s.id}')">🗑</button>
        </div>
        ${editing2
          ? renderEditPromptUI(p2)
          : `<div class="prompt-card-text" style="margin-bottom:4px">${p2 ? escapeHtml(p2) : '<em style="color:var(--text-dim)">Chưa có prompt B.</em>'}</div>
             <div class="prompt-card-actions">
               ${p2 ? `<button class="btn ghost sm" onclick="copyText(\`${prompt2Esc}\`)">📋 Sao chép</button>
               <button class="btn ghost sm" onclick="startEditPrompt('scene2','${s.id}')">✏️ Sửa</button>` : ''}
               <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleScenePromptB('${s.id}')">🔧 ${p2 ? 'Tạo lại B' : 'Tạo prompt B'}</button>
               ${p2 ? `<button class="btn ghost sm" style="border-color:#dc2626;color:#dc2626" onclick="makeSafePrompt('${s.id}','B')" title="Làm mềm prompt B bị chặn">🛡 Sửa vi phạm</button>` : ''}
             </div>`
        }
      </div>` : ''}
    </div>`;
  }).join('');
  // Fill unified textarea — A rồi B liền nhau, 1 dòng trống giữa
  const ta = document.getElementById('allPromptsV');
  if (ta) {
    const lines = [];
    state.scenes.forEach(s => {
      const a = cleanPrompt(state.scenePrompts[s.id]);
      const b = cleanPrompt((state.scenePrompts2 || {})[s.id]);
      if (a) lines.push(a);
      if (b) lines.push(b);
    });
    ta.value = lines.join('\n\n');
  }
  // Nút "Tạo nốt cảnh thiếu" — hiện khi có cảnh chưa có prompt
  const missing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
  const fillBtn = document.getElementById('t2FillBtn');
  const missEl = document.getElementById('t2MissingCount');
  if (fillBtn && missEl) {
    if (missing > 0 && cnt > 0) {
      fillBtn.style.display = '';
      missEl.textContent = '(' + missing + ')';
    } else {
      fillBtn.style.display = 'none';
    }
  }
}

function renderStats2(){
  const el = document.getElementById('statScenes');
  if (!el) return;
  el.textContent = state.scenes.length;
  const assigned = state.scenes.filter(s => s.character || s.background).length;
  const sa = document.getElementById('statAssigned');
  sa.textContent = assigned;
  sa.className = 'v ' + (assigned === state.scenes.length && assigned > 0 ? 'green' : (assigned > 0 ? '' : 'dim'));
  document.getElementById('statChars').textContent = state.charactersV.length || '—';
  document.getElementById('statBgs').textContent = state.backgroundsV.length || '—';
  const _td = totalDur();
  document.getElementById('statDur').textContent = Math.floor(_td / 60) + ':' + String(Math.round(_td % 60)).padStart(2, '0');
}

function totalDur(){ return state.scenes.reduce((a, s) => a + s.duration, 0); }

function delScene(i){
  if (!confirm('Xoá cảnh này?')) return;
  const r = state.scenes.splice(i, 1)[0];
  if (state.scenePrompts) delete state.scenePrompts[r.id];
  if (state.veoPrompts) delete state.veoPrompts[r.id];
  renumberScenes();
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState(true);
}

function copyAllScenePrompts(){
  const lines = [];
  state.scenes.forEach(s => {
    const a = cleanPrompt(state.scenePrompts[s.id]);
    const b = cleanPrompt((state.scenePrompts2 || {})[s.id]);
    if (a) lines.push(a);
    if (b) lines.push(b);
  });
  if (!lines.length) return setStatus2('Chưa có prompt nào.', 'error');
  navigator.clipboard.writeText(lines.join('\n\n'));
  const scenesWithPrompt = state.scenes.filter(s => cleanPrompt(state.scenePrompts[s.id])).length;
  const scenesWithB = state.scenes.filter(s => cleanPrompt((state.scenePrompts2||{})[s.id])).length;
  const missing = state.scenes.length - scenesWithPrompt;
  document.getElementById('copyAllInfo').textContent =
    `✓ Đã sao chép ${lines.length} prompts (${scenesWithPrompt} cảnh${scenesWithB > 0 ? ` + ${scenesWithB} ảnh B` : ''})` + (missing > 0 ? ` ⚠️ thiếu ${missing} cảnh` : '');
  setStatus2(missing > 0
    ? `✓ Copy ${lines.length} prompt. ⚠️ ${missing} cảnh CHƯA có prompt.`
    : `✓ Đã sao chép đủ ${lines.length} prompt (bao gồm ảnh B).`, missing > 0 ? 'info' : 'ok');
}

function generateSRT(){
  if (state.scenes.length === 0) return;
  let t = 0;
  document.getElementById('srtOutput').value = state.scenes.map((s, i) => {
    const st = t;
    t += s.duration;
    return `${i + 1}\n${srtT(st)} --> ${srtT(t)}\n${s.text}\n`;
  }).join('\n');
  setStatus2('✓ Đã tạo SRT.', 'ok');
}

function srtT(s){
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},000`;
}

function downloadSRT(){
  const s = document.getElementById('srtOutput').value;
  if (!s) return;
  const b = new Blob([s], { type: 'text/plain' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = 'video.srt'; a.click();
  URL.revokeObjectURL(u);
}

function copySRT(){
  const s = document.getElementById('srtOutput').value;
  if (s) navigator.clipboard.writeText(s);
  setStatus2('✓ Đã sao chép SRT.', 'ok');
}

function restoreUI(){
  const $ = id => document.getElementById(id);
  if ($('minChars')) $('minChars').value = state.minChars || 30;
  if ($('maxChars')) $('maxChars').value = state.maxChars || 150;
  if ($('splitMode')) $('splitMode').value = state.splitMode || 'smart';
  if ($('scriptInput')) $('scriptInput').value = state.script || '';
  if ($('charsInputV')) $('charsInputV').value = (state.charactersV || []).join('\n');
  if ($('bgInputV')) $('bgInputV').value = (state.backgroundsV || []).join('\n');
  renderProfileSelect();
  if (typeof renderVideoSelect === 'function') renderVideoSelect();
  renderProfileStyles();
  if (typeof renderDashboard === 'function') renderDashboard();
  syncTool2FromProfile();
  renderAllT2();
}

