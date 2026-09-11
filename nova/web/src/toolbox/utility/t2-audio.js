/* T2 AUDIO — auto audio, whisper keys, auto steps, syncTool2, renderSceneTimeline, scene types
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function loadAutoAudio(input){
  const f = input.files[0];
  if (!f) return;
  _autoAudioFile = f;
  _autoAudioWords = null;     // file mới → xoá cache
  const info = document.getElementById('autoSrtInfo');
  if (info) info.textContent = `✓ Đã đính audio: ${f.name} — Auto sẽ transcribe (Whisper) & căn timing.`;
  const clr = document.getElementById('autoSrtClear');
  if (clr) clr.style.display = 'inline-flex';
  input.value = '';
  // Refresh nút "Phân tích kịch bản": onchange gọi t2AudioInfo TRƯỚC khi _autoAudioFile được set ở đây → phải cập nhật lại nút.
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  // 💾 Lưu MP3 theo TỪNG video (IDB) + 🎙 tự đưa sang Dựng Video làm giọng đọc (như ảnh cảnh).
  _t2SaveVoicePerVideo(f);
  try { if (typeof t7HandleAudio === 'function') t7HandleAudio(f); } catch (e) {}
}

function _t2SaveVoicePerVideo(f){
  try {
    const uid = window.currentUser?.uid, p = (typeof getProfile === 'function') ? getProfile() : null;
    if (uid && p && p.profileId && f && typeof IDB !== 'undefined' && typeof _curVideoId === 'function'){
      IDB.set(uid + '/' + p.profileId + '/' + _curVideoId(p) + '/voiceMp3', f).catch(() => {});
    }
  } catch (e) {}
}

function _t2ResetTimingAudio(){
  _autoAudioFile = null; _autoAudioWords = null;
  try { _t2AudioDurCache = 0; } catch (e) {}
  try { if (typeof t8State === 'object' && t8State) t8State.audioFile = null; } catch (e) {}
  const nm = document.getElementById('t2AudioName'); if (nm) nm.textContent = 'Đính MP3 căn timing';
  const pill = document.getElementById('t2AudioPill'); if (pill){ pill.style.color = ''; pill.style.borderColor = ''; pill.style.background = ''; }
  const info = document.getElementById('autoSrtInfo'); if (info) info.textContent = '';
  const clr = document.getElementById('autoSrtClear'); if (clr) clr.style.display = 'none';
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  if (typeof t2UpdateCost === 'function') t2UpdateCost();
  if (typeof t2RenderTimingWarn === 'function') t2RenderTimingWarn();
}

function _whisperProviderAuto(){
  const groq = (localStorage.getItem('t8_key_groq') || '').trim();
  const oai = (localStorage.getItem('t8_key_openai') || '').trim();
  if (groq) return 'groq';
  if (oai) return 'openai';
  return 'local';
}

function _whisperKeyState(){
  const el = document.getElementById('setWhisperState'); if (!el) return;
  const prov = _whisperProviderAuto();
  el.innerHTML = prov === 'groq' ? '<span style="color:var(--green)">✓ Đang dùng Groq (nhanh, free)</span>'
    : prov === 'openai' ? '<span style="color:var(--green)">✓ Đang dùng OpenAI Whisper</span>'
    : '<span style="color:var(--amber)">● Chưa có key → chạy Local (không cần key, chậm hơn)</span>';
}

function saveWhisperKey(){
  const v = (document.getElementById('setWhisperKey')?.value || '').trim();
  try { if (v) localStorage.setItem('t8_key_groq', v); else localStorage.removeItem('t8_key_groq'); } catch (e) {}
  _whisperKeyState();
}

function saveWhisperKeyOpenai(){
  const v = (document.getElementById('setWhisperKeyOpenai')?.value || '').trim();
  try { if (v) localStorage.setItem('t8_key_openai', v); else localStorage.removeItem('t8_key_openai'); } catch (e) {}
  _whisperKeyState();
}

async function _autoAlignAudioOnce(){
  if (!_autoAudioFile) return null;
  if (!_autoAudioWords) {
    const prov = _whisperProviderAuto();   // có key → API (groq/openai); không → local
    setStatus2(`🎤 Đang transcribe audio (Whisper ${prov})...`, 'working');
    _autoAudioWords = (prov === 'local' && typeof t8TranscribeLocal === 'function')
      ? await t8TranscribeLocal(_autoAudioFile)
      : await t8TranscribeAPI(prov, _autoAudioFile);
  }
  if (!_autoAudioWords || !_autoAudioWords.length) return null;
  const results = t8AlignScenesToWords(state.scenes, _autoAudioWords);
  let upd = 0;
  results.forEach((r, i) => { if (r.newDur != null && state.scenes[i]){ state.scenes[i].duration = r.newDur; upd++; } });
  _t2KhopCuoi = { ti: results._khop, khop: results._khopTu, tong: results._tongTu, khi: Date.now() };
  if (results._khop < 0.6){
    try { novaLog('❌ Căn timing: chỉ ' + Math.round(results._khop * 100) + '% số từ trong kịch bản tìm thấy trong audio ('
      + results._khopTu + '/' + results._tongTu + '). Audio này rất có thể KHÔNG phải bản đọc của kịch bản đang mở — '
      + 'timing sẽ sai. Tạo lại giọng cho đúng kịch bản, hoặc nạp đúng file audio.', 'error'); } catch (_){}
  }
  try { t2RenderTimingWarn(); } catch (_){}
  const bo = results.filter(r => r.hong);
  if (bo.length){
    try {
      novaLog('⚠️ Căn timing: bỏ ' + bo.length + '/' + results.length + ' cảnh có mốc thời gian vô lý (Whisper trả timestamp nhảy cóc). '
        + bo.slice(0, 3).map(r => 'cảnh ' + r.id + ' ' + r.hong + 's thay vì ~' + r.uoc + 's').join(', ')
        + (bo.length > 3 ? '…' : '') + ' — mấy cảnh này giữ thời lượng ước theo văn bản.', 'warn');
    } catch (_){}
  }
  renderAllT2();
  return upd;
}

function _autoStepsAll(){
  return document.getElementById('autoFlowImages')?.checked
    ? AUTO_STEPS.concat(FLOW_STEPS)
    : AUTO_STEPS;
}

function _autoRenderSteps(){
  const bar = document.getElementById('autoBar');
  if (!bar) return;
  bar.innerHTML = _autoStepsAll().map((s, i) =>
    `<span class="auto-step" id="autoStep-${i}"><b>${i + 1}</b>&nbsp;${s.label}</span>`
  ).join('<span class="auto-arrow">→</span>');
}

function _autoSetStep(idx, status){
  const el = document.getElementById('autoStep-' + idx);
  if (!el) return;
  el.classList.remove('active', 'done', 'skip', 'fail');
  if (status) el.classList.add(status);
}

function _autoSetStepLabel(idx, text){
  const el = document.getElementById('autoStep-' + idx);
  if (el) el.innerHTML = `<b>${idx + 1}</b>&nbsp;${text}`;
}

function _toggleAutoUI(running){
  const auto = document.getElementById('autoRunBtn');
  const stop = document.getElementById('autoStopBtn');
  const bar  = document.getElementById('autoBar');
  if (auto) auto.style.display = running ? 'none' : 'inline-flex';
  if (stop) stop.style.display = running ? 'inline-flex' : 'none';
  if (bar && running) bar.style.display = 'flex';  // hiện khi chạy, GIỮ lại sau khi xong để thấy ✓
}

function stopAutoTool2(){
  if (!_autoRunning) return;
  _autoStopFlag = true;
  requestCancel();  // báo cho các vòng lặp AI (Prompt ảnh / Ảnh B) dừng
  setStatus2('⏸ Đang dừng sau bước hiện tại...', 'info');
}

function syncTool2(){
  const g = id => document.getElementById(id);
  state.script = g('scriptInput')?.value || '';
  state.minChars = parseInt(g('minChars')?.value) || 30;
  state.maxChars = parseInt(g('maxChars')?.value) || 150;
  state.splitMode = g('splitMode')?.value || 'smart';
  // ⛔ KHÔNG đọc ngược charsInputV / bgInputV nữa.
  // Hai ô đó là DI TÍCH của bản Tool 2 cũ, giờ nằm trong .prescan{display:none} —
  // không ai gõ được vào, chỉ có code ghi state → ô. Đọc ngược thành vòng luẩn quẩn:
  //   _collectCastToAssets() lập dàn nhân vật/bối cảnh từ storyboard (dòng ~12349)
  //   → KHÔNG cập nhật hai ô ẩn
  //   → syncTool2() chạy ngay sau đó (12415 / 12457 / 12536) đọc ô ẩn RỖNG
  //   → state.charactersV = []  ← "tạo xong rồi tự nhiên mất"
  // Không chỗ nào khác đọc hai ô này, nên bỏ đọc là hết vòng lặp; state là nguồn duy nhất.
  const dmEl = g('t2DescMode');
  state.descMode = dmEl ? dmEl.value : (state.descMode || 'tag');   // mặc định tag (khoá mặt) khi UI đã bỏ
}

function _normalizeScenesShots(){
  const ok = (typeof _shotAllowed === 'function') ? _shotAllowed() : null; if (!ok) return 0;
  let n = 0;
  (state.scenes || []).forEach(s => { const sh = String(s.shot || '').trim().toLowerCase(); if (sh && sh !== 'scene' && !ok.has(sh)){ s.shot = 'scene'; n++; } });
  return n;
}

function renderAllT2(){
  try { const _n = _normalizeScenesShots(); if (_n && typeof novaLog === 'function') novaLog(`🎬 ${_n} cảnh dùng kiểu đã tắt → đưa về "Kể chuyện".`, 'warn'); } catch (e) {}
  renderPreview(); renderTable(); renderSceneTimeline(); renderPromptsV(); renderStats2(); updateScriptCount(); renderSceneTypeToggles();
  if (typeof renderT2Assets === 'function') renderT2Assets();
  if (typeof t2UpdateCost === 'function') t2UpdateCost();
  if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
  if (typeof t2RenderTimingWarn === 'function') t2RenderTimingWarn();
  const si = document.getElementById('statSceneImg'); if (si) si.textContent = Object.keys(state.sceneImages || {}).length + ' / ' + ((state.scenes || []).length || 0);
  // Tổng hợp cảnh cần xem lại (như "62 scene · 62 cần xem lại" của web đối thủ)
  try {
    const el = document.getElementById('statScenes');
    if (el && (state.scenes || []).length){
      const n = _t2WarnCount();
      const bd = _t2WarnBreakdown();
      const tip = bd.map(([k, v]) => `${v} cảnh: ${k}`).join('\n') || 'Không có cảnh báo';
      const top = bd.length ? bd[0][0] : '';
      el.innerHTML = (state.scenes.length) + (n
        ? ` <span title="${escapeHtml(tip)}" style="font-size:11px;color:var(--amber);font-weight:600">· ${n} cần xem lại</span>`
          + (top ? `<div style="font-size:10.5px;color:var(--text-dim);font-weight:400;margin-top:3px;line-height:1.4">chủ yếu: ${escapeHtml(top)}${bd.length > 1 ? ` · +${bd.length - 1} loại khác` : ''}</div>` : '')
        : '');
    }
  } catch (e) {}
}

function _shotBadge(shot){
  const k = SCENE_TYPES[shot] ? shot : 'scene'; const t = SCENE_TYPES[k];
  const vi = (typeof SCENE_TYPE_VI !== 'undefined' && SCENE_TYPE_VI[k]) || k;
  return `<span title="${t.vi}" style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;color:${t.color};background:${t.color}22;white-space:nowrap">${vi}</span>`;
}

function renderSceneTimeline(){
  const el = document.getElementById('sceneTimeline'); if (!el) return;
  el.style.display = 'none'; el.innerHTML = ''; return;   // Đã bỏ dòng thời gian theo yêu cầu
  const sc = state.scenes || [];
  if (!sc.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  const bars = sc.map(s => {
    const t = SCENE_TYPES[s.shot] || SCENE_TYPES.scene; const w = Math.max(0.5, parseFloat(s.duration) || 1);
    return `<i title="#${s.id} · ${SCENE_TYPES[s.shot] ? s.shot : 'scene'} · ${w}s" onclick="_tlJump('${s.id}')" style="flex:${w};background:${t.color};min-width:3px;cursor:pointer;transition:filter .12s" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter=''"></i>`;
  }).join('');
  const present = [...new Set(sc.map(s => SCENE_TYPES[s.shot] ? s.shot : 'scene'))];
  const legend = present.map(k => { const t = SCENE_TYPES[k]; return `<span style="display:inline-flex;align-items:center;gap:4px"><b style="width:9px;height:9px;border-radius:2px;background:${t.color};display:inline-block"></b>${k}</span>`; }).join('');
  const tot = sc.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
  const mm = Math.floor(tot / 60), ss = Math.round(tot % 60);
  el.innerHTML = `<div style="font-family:ui-monospace,monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Dòng thời gian · ${sc.length} cảnh · ${mm}:${String(ss).padStart(2, '0')}</div>
    <div style="display:flex;gap:1px;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--border)">${bars}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-family:ui-monospace,monospace;font-size:10px;color:var(--text-muted)">${legend}</div>`;
}

function _tlJump(id){
  const row = document.querySelector('#sceneBody tr[data-sid="' + id + '"]');
  if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); const o = row.style.background; row.style.transition = 'background .3s'; row.style.background = 'var(--accent-soft)'; setTimeout(() => { row.style.background = o; }, 1000); }
}

function renderSceneTypeToggles(){
  const box = document.getElementById('sceneTypeToggles'); if (!box) return;
  if (!Array.isArray(state.sceneTypesOn) || !state.sceneTypesOn.length) state.sceneTypesOn = SCENE_TYPES_CORE.slice();
  const optional = Object.keys(SCENE_TYPES).filter(k => !SCENE_TYPES[k].core);
  box.innerHTML = optional.map(k => {
    const t = SCENE_TYPES[k]; const on = state.sceneTypesOn.includes(k);
    const vi = SCENE_TYPE_VI[k] || k;
    return `<button type="button" onclick="toggleSceneType('${k}')" title="${t.vi} — bật để AI dùng kiểu cảnh này khi hợp" style="font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:99px;cursor:pointer;border:1px solid ${on ? t.color : 'var(--border-2)'};color:${on ? '#fff' : 'var(--text-muted)'};background:${on ? t.color : 'transparent'}">${on ? '✓ ' : '+ '}${vi}</button>`;
  }).join('');
}

function toggleSceneType(k){
  if (!SCENE_TYPES[k] || SCENE_TYPES[k].core) return;
  if (!Array.isArray(state.sceneTypesOn) || !state.sceneTypesOn.length) state.sceneTypesOn = SCENE_TYPES_CORE.slice();
  const i = state.sceneTypesOn.indexOf(k);
  const turningOff = i >= 0;
  if (turningOff) state.sceneTypesOn.splice(i, 1); else state.sceneTypesOn.push(k);
  const vi = SCENE_TYPE_VI[k] || k;
  // Tắt kiểu nào thì các cảnh ĐANG dùng kiểu đó về "Kể chuyện" luôn — không để bảng còn nhãn của kiểu đã tắt.
  let moved = 0;
  if (turningOff) { try { moved = _normalizeScenesShots(); } catch (e) {} }
  renderSceneTypeToggles(); if (typeof saveState === 'function') saveState();
  if (moved){
    if (typeof renderAllT2 === 'function') renderAllT2();
    setStatus2(`✓ Tắt kiểu "${vi}" — đã đưa ${moved} cảnh về "Kể chuyện". Prompt cũ vẫn tả theo kiểu cũ → bấm 🔧 Tạo lại tất cả prompt nếu muốn vẽ lại.`, 'ok');
  } else {
    setStatus2(`✓ ${turningOff ? 'Tắt' : 'Bật'} kiểu cảnh "${vi}" cho lần Phân tích kịch bản tới.`, 'info');
  }
}

