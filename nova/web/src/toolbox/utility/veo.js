/* VEO — cache prompt Veo (_t6Veo*) + sinh prompt Veo (genSingleVeoPrompt, renderVeoPrompts)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
// === L?: var _t6VeoCache / _T6_VEO_MAX === (2026-09-12f: hai tên này TRƯỚC GIỜ KHÔNG TỒN TẠI
//    ở đâu cả → _t6VeoCachePut/Get ném ReferenceError bị try/catch nuốt ⇒ cache Veo chết ngầm.
//    Khai báo tại đây + write-through xuống IDB qua shared/acache.js — tắt mở vẫn còn.)
var _t6VeoCache = new Map();
var _T6_VEO_MAX = 6;   // tối đa 6 video b64 trong cache (RAM + IDB đồng bộ qua _acacheVeoPersist)

function _t6VeoKey(prompt, model, dur, seed){
  const norm = String(prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return [norm.slice(0, 200), String(model || 'veo31-fast'), String(dur || 8), String(seed || '')].join('|');
}

function _t6VeoCacheGet(prompt, model, dur, seed){
  const k = _t6VeoKey(prompt, model, dur, seed);
  if (!k) return null;
  const hit = _t6VeoCache.get(k);
  if (hit) {
    hit.hits = (hit.hits || 0) + 1;
    try { if (typeof novaLog === 'function') novaLog('Veo cache HIT (lan ' + hit.hits + ')', 'ok'); } catch (_) {}
    return hit.blob;
  }
  return null;
}

function _t6VeoCachePut(prompt, model, dur, seed, blob){
  const k = _t6VeoKey(prompt, model, dur, seed);
  if (!k || !blob) return;
  _t6VeoCache.set(k, { blob, hits: 0, t: Date.now() });
  if (_t6VeoCache.size > _T6_VEO_MAX){
    const first = _t6VeoCache.keys().next().value;
    _t6VeoCache.delete(first);
  }
  if (typeof _acacheVeoPersist === 'function') _acacheVeoPersist();   // write-through: tắt mở vẫn còn
}

function _t6VeoCacheStats(){ return { size: _t6VeoCache.size, max: _T6_VEO_MAX }; }

async function genSingleVeoPrompt(id){
  const p = getProfile();
  if (!p) return setStatus6('Cần Profile (Tool 1) trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const dur = getSceneDuration(scene);
  const aspectRatio = document.getElementById('v6AspectRatio')?.value || '16:9';
  const audioMode = document.getElementById('v6AudioMode')?.value || 'none';
  const audioLine = audioMode === 'none' ? 'Do NOT add an audio line.' : 'Add a line "Audio: [ambient music + sfx description fitting the scene]" at the end of the prompt.';
  const gLabsPrompt = state.scenePrompts[id] ? `\nG-Labs prompt (style reference): ${state.scenePrompts[id].slice(0, 200)}` : '';
  setStatus6(`Đang tạo prompt Veo 3 cảnh [${id}]...`, 'working');
  try {
    const prompt = `You are a Veo 3 prompt engineer. Create 1 video prompt for the following scene.
Profile: ${p.tenKenh} | Style: ${p.sceneStyle || '2D animated'} | Rules: ${p.promptRules || ''}
Characters: ${state.charactersV.join(', ') || '-'} | Backgrounds: ${state.backgroundsV.join(', ') || '-'}
Aspect ratio: ${aspectRatio} | Audio: ${audioMode === 'none' ? 'none' : 'yes'}

Scene [${id}]: VO: "${scene.text}" | character: ${scene.character || '-'} | background: ${scene.background || '-'} | camera: ${scene.camera} | duration: ${dur}s${gLabsPrompt}

Requirements: Subject+Action+CameraMovement+Lighting+Style. ${audioLine}
70-130 English words. Start directly with the visual description. Return ONLY the text prompt, no JSON.`;
    const reply = await callClaude(prompt, 600);
    const clean = cleanPrompt(reply.trim());
    if (clean) {
      if (!state.veoPrompts) state.veoPrompts = {};
      state.veoPrompts[id] = { prompt: clean };
      renderVeoPrompts();
      renderVeoStats();
      setStatus6(`✓ Đã tạo prompt Veo 3 cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus6(`⚠️ Cảnh [${id}] tạo lỗi, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus6('Lỗi: ' + e.message, 'error');
  }
}

function _veoDurMode(){
  const el = document.getElementById('v6Duration');
  const v = el && el.value ? String(el.value) : 'auto';
  return (v === 'auto' || Number.isFinite(parseInt(v))) ? v : 'auto';
}

function renderVeoStats(){
  const elScenes = document.getElementById('v6StatScenes');
  const sp = document.getElementById('v6StatPrompts');
  const elDur = document.getElementById('v6StatDur');
  const elCount = document.getElementById('v6PromptCount');
  if (!elScenes && !sp && !elDur && !elCount) return;   // khung Veo không còn trên trang

  const promptCount = Object.keys(state.veoPrompts || {}).length;
  if (elScenes) elScenes.textContent = state.scenes.length;
  if (sp){
    sp.textContent = promptCount;
    sp.className = 'v ' + (promptCount === state.scenes.length && promptCount > 0 ? 'green' : (promptCount > 0 ? '' : 'dim'));
  }
  const durMode = _veoDurMode();
  let totalDur = 0;
  for (const s of state.scenes) {
    totalDur += (durMode === 'auto') ? Math.min(s.duration, 8) : parseInt(durMode);
  }
  if (elDur) elDur.textContent = totalDur + 's (~' + Math.round(totalDur / 60) + 'p)';
  if (elCount) elCount.textContent = `${promptCount} / ${state.scenes.length}`;
}

function getSceneDuration(scene){
  const mode = _veoDurMode();
  if (mode === 'auto') return Math.min((scene && scene.duration) || 8, 8);   // trần 8s của Veo 3
  return parseInt(mode);
}

function renderVeoPrompts(){
  const box = document.getElementById('v6PromptsList');
  if (!box) return;
  if (state.scenes.length === 0) {
    box.innerHTML = '<div class="empty-state">Chưa có cảnh. Load từ Tool 02 trước.</div>';
    const ta1 = document.getElementById('allVeoPromptsBox');
    if (ta1) ta1.value = '';
    return;
  }
  box.innerHTML = state.scenes.map(s => {
    const entry = state.veoPrompts?.[s.id];
    const p = cleanPrompt(entry?.prompt);
    const dur = getSceneDuration(s);
    const promptEsc = p ? p.replace(/`/g, "'").replace(/\\/g, "\\\\") : '';
    const editing = isEditingPrompt('veo', s.id);
    return `<div class="prompt-card ${p ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="prompt-card-head">
        <span class="prompt-card-id">[${s.id}]</span>
        <span class="prompt-card-meta">${escapeHtml(s.character) || '—'} · ${escapeHtml(s.background) || '—'} · ${s.camera} · ${dur}s</span>
      </div>
      <div class="prompt-card-vo">VO: "${escapeHtml(s.text)}"</div>
      ${editing
        ? renderEditPromptUI(p)
        : `<div class="prompt-card-text">${p ? escapeHtml(p) : 'Chưa có prompt. Bấm Sinh Prompt Veo 3.'}</div>
           <div class="prompt-card-actions">
             ${p ? `<button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)">📋 Sao chép</button>
             <button class="btn ghost sm" onclick="startEditPrompt('veo','${s.id}')">✏️ Sửa</button>` : ''}
             <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="genSingleVeoPrompt('${s.id}')">🔧 ${p ? 'Tạo lại' : 'Tạo'}</button>
           </div>`
      }
    </div>`;
  }).join('');
  const ta = document.getElementById('allVeoPromptsBox');
  if (ta) {
    ta.value = state.scenes.map(s => cleanPrompt(state.veoPrompts?.[s.id]?.prompt)).filter(Boolean).join('\n\n');
  }
  // Nút "Tạo nốt cảnh thiếu" cho Veo
  const vMissing = state.scenes.filter(s => !state.veoPrompts?.[s.id]?.prompt).length;
  const vHas = state.scenes.length - vMissing;
  const vFillBtn = document.getElementById('v6FillBtn');
  const vMissEl = document.getElementById('v6MissingCount');
  if (vFillBtn && vMissEl) {
    if (vMissing > 0 && vHas > 0) {
      vFillBtn.style.display = '';
      vMissEl.textContent = '(' + vMissing + ')';
    } else {
      vFillBtn.style.display = 'none';
    }
  }
}

function setStatus7(msg, type){
  const c = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' };
  const col = c[type] || c.info;
  // #status7 nằm TRONG cột chi tiết — ở bố cục gọn cột đó là ngăn trượt đóng, nên
  // ghi vào đó là ghi vào chỗ không ai thấy. Ghi thêm ra dòng dưới khung xem.
  [document.getElementById('status7'), document.getElementById('t7StatusLean')].forEach(el => {
    if (!el) return; el.textContent = msg; el.style.color = col;
  });
}

