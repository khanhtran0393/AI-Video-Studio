/* AUTO-EXTRACTED from index.html block 3 - prefix: auto */

async function autoPickFolder(){
  if (!window.native || typeof window.native.pickFolder !== 'function') return _autoLog('Chỉ chọn được thư mục ở bản desktop.', 'error');
  try {
    const r = await window.native.pickFolder();
    const path = r && (r.path || (typeof r === 'string' ? r : ''));
    if (path) { _autoOutDir = path; try { localStorage.setItem('av_save_dir', path); } catch (e2) {} const on = document.getElementById('dashSaveFolder'); if (on) on.value = path; }
  } catch (e) { _autoLog('Lỗi chọn thư mục: ' + (e.message || e), 'error'); }
}

function autoSaveToggle(el){ _autoSaveCfg().enabled = !!(el ? el.checked : true); _autoSaveSyncUI(); try { saveState(true); } catch {} }

function autoSaveMode(el){ _autoSaveCfg().mode = (el && el.value) || 'perTask'; _autoSaveSyncUI(); try { saveState(true); } catch {} }

function autoSaveName(el){ _autoSaveCfg().taskName = (el && el.value) || ''; try { saveState(true); } catch {} }

async function autoSavePickFolder(){
  if (!window.native?.pickFolder){ alert('Chọn thư mục chỉ có ở bản App (desktop).'); return; }
  const r = await window.native.pickFolder();
  if (r && r.path){ const c = _autoSaveCfg(); c.folder = r.path; c.enabled = true; _autoSaveSyncUI(); try { saveState(true); } catch {} }
}

async function autoSaveMedia(name, base64, kind, skipWm){
  const c = _autoSaveCfg();
  // Ưu tiên cấu hình auto-save riêng; nếu chưa bật nhưng dashboard "Lưu về máy" đã chọn thư mục → VẪN lưu vào đó.
  // → ảnh tạo lại thủ công (sửa cảnh lỗi) cũng tự lưu về đúng thư mục <thư mục>/<video>/anh/ như luồng tự động.
  const folder = (c.enabled && c.folder) ? c.folder : (_autoOutDir || '');
  if (!folder || !window.native?.saveFile || !base64) return null;
  const mode = (c.enabled ? c.mode : (_autoSaveMode || 'perTask')) || 'perTask';
  const subdir = mode === 'perTask' ? (_autoSaveTask() + '/' + kind) : kind;
  // Xoá watermark Nano-Banana/Gemini NGAY trong app (Canvas) trước khi ghi ra đĩa — tức thì, không cần Python.
  let outData = base64;
  if (kind === 'anh' && !skipWm && _wmCfg().enabled) { try { outData = await wmGeminiClean(base64); } catch (e){} }
  try {
    return await window.native.saveFile({ dir: folder, subdir, name, base64: outData });
  }
  catch (e){ return { error: e.message || String(e) }; }
}

function autoSaveSceneImage(id, isB, dataUrl, mime){
  const num = /^\d+$/.test(String(id)) ? String(id).padStart(3, '0') : _slug(String(id));
  // hasB suy từ PROMPT B (cố định), không từ ảnh đã lưu — vì A/B chạy song song, ảnh B có thể chưa kịp set khi A lưu → tên lệch.
  const hasB = !!(state.scenePrompts2 && state.scenePrompts2[id] && String(state.scenePrompts2[id]).trim());
  const base = isB ? (num + 'b') : (num + (hasB ? 'a' : ''));
  const ext = ((mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
  if (typeof _t7NotifyImage === 'function') _t7NotifyImage(num);   // đấu ảnh sang Dựng Video ngay khi tạo/tạo lại
  return autoSaveMedia(base + '.' + ext, dataUrl, 'anh');
}

async function autoExtract(){
  const sg = document.getElementById('pStyleGuide').value;
  const dk = document.getElementById('pDnaKenh').value;
  const cd = document.getElementById('pChuDe').value;
  if (!sg && !dk && !cd) return alert('Cần paste ít nhất 1 tài liệu.');
  const status = document.getElementById('extractStatus');
  status.innerHTML = '<span class="spinner"></span> AI đang phân tích...';
  document.getElementById('btnAutoExtract').disabled = true;

  try {
    const prompt = `Read the 3 documents below and extract information to fill a video channel profile.

=== STYLE GUIDE ===
${sg || '(none)'}

=== CHANNEL DNA ===
${dk || '(none)'}

=== TOPIC ===
${cd || '(none)'}

Return EXACTLY 1 JSON object (no markdown):
{
  "tenKenh": "channel name",
  "ngach": "niche",
  "visualStyle": "visual style preset",
  "ngonNgu": "VO language",
  "povStyle": "POV style",
  "cauTruc": "video structure",
  "soPhan": 8,
  "targetPhut": 12,
  "characterStyle": "character reference image prompt, 80-120 English words",
  "backgroundStyle": "background reference image prompt, 80-120 English words",
  "sceneStyle": "short 30-50 English word prompt for scene aesthetic",
  "promptRules": "negative prompt rules"
}

Character/Background/Scene style prompts MUST be in English.`;
    const data = await callLLMJson(prompt, {
      maxTokens: 3000,
      validate: d => d && typeof d === 'object' && !Array.isArray(d) && (d.tenKenh || d.ngach || d.characterStyle || d.visualStyle)
    });
    if (data.tenKenh) document.getElementById('pTenKenh').value = data.tenKenh;
    if (data.ngach) document.getElementById('pNgach').value = data.ngach;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngonNgu) document.getElementById('pNgonNgu').value = data.ngonNgu;
    if (data.povStyle) document.getElementById('pPovStyle').value = data.povStyle;
    if (data.cauTruc) document.getElementById('pCauTruc').value = data.cauTruc;
    if (data.soPhan) document.getElementById('pSoPhan').value = data.soPhan;
    if (data.targetPhut) document.getElementById('pTargetPhut').value = data.targetPhut;
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã điền tự động. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAutoExtract').disabled = false;
}

async function autoAddPromptBForLongScenes(autoMode = false){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const THRESHOLD = parseInt(document.getElementById('maxSecPerImg')?.value) || 8; // = số giây tối đa/ảnh

  // Cảnh VƯỢT max, đã có Prompt A, chưa có Prompt B, KHÔNG phải infographic tĩnh (biểu đồ/bản đồ giữ 1 ảnh)
  const targets = state.scenes.filter(s => {
    const dur = parseFloat(s.duration) || 0;
    const hasA = state.scenePrompts && state.scenePrompts[s.id] && state.scenePrompts[s.id].trim();
    const hasB = state.scenePrompts2 && state.scenePrompts2[s.id] && state.scenePrompts2[s.id].trim();
    return dur > THRESHOLD && hasA && !hasB;
  });

  if (!targets.length) {
    return setStatus2(`Không có cảnh nào vượt ${THRESHOLD}s cần thêm ảnh B (hoặc đã có B).`, 'info');
  }

  const BATCH = 8;
  const numCalls = Math.ceil(targets.length / BATCH);
  if (!autoMode && !confirm(`${targets.length} cảnh dài hơn ${THRESHOLD}s CHƯA có ảnh B.\n(Cảnh đã có A/B được BỎ QUA, không làm lại.)\n\nTạo ảnh B cho ${targets.length} cảnh này?\n(Gọi AI ${numCalls} lần, mỗi lần ${BATCH} cảnh — tiết kiệm hơn gọi từng cảnh)`)) return;

  if (!state.scenePrompts2) state.scenePrompts2 = {};
  clearCancel();

  const lanes = _concurrency();
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  let done = 0;
  // SONG SONG theo số luồng — mỗi batch độc lập (gán Prompt B theo id)
  await runConcurrent(batches, async (batch) => {
    if (state.cancelRequested) return;
    try {
      await genBatchPromptB(batch, p);
      done += batch.length;
      renderPromptsV();
      saveState(true);
      setStatus2(`Đang tạo Prompt B: ${Math.min(done, targets.length)}/${targets.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}...`, 'working');
    } catch (e) {
      console.warn('Prompt B batch lỗi → bỏ qua:', e.message);
    }
  }, lanes, () => state.cancelRequested);

  // QUÉT LẠI: cảnh dài NÀO còn thiếu B (do lô rớt mạng / AI trả thiếu) → gom lại thử thêm tối đa 2 vòng.
  for (let sweep = 0; sweep < 2 && !state.cancelRequested; sweep++){
    const miss = targets.filter(s => !(state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim()));
    if (!miss.length) break;
    if (typeof novaLog === 'function') novaLog(`↻ Còn ${miss.length} cảnh dài thiếu ảnh B — thử lại (vòng ${sweep + 1})…`, 'warn');
    const mbatches = [];
    for (let i = 0; i < miss.length; i += BATCH) mbatches.push(miss.slice(i, i + BATCH));
    await runConcurrent(mbatches, async (batch) => {
      if (state.cancelRequested) return;
      try { await genBatchPromptB(batch, p); renderPromptsV(); saveState(true); } catch (e) { console.warn('Prompt B sweep lỗi:', e.message); }
    }, lanes, () => state.cancelRequested);
  }
  const _stillMiss = targets.filter(s => !(state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim())).length;
  if (_stillMiss && typeof novaLog === 'function') novaLog(`⚠️ Còn ${_stillMiss} cảnh dài chưa có ảnh B (mạng chập) — bấm "✂️ Cảnh dài → 2 ảnh (A/B)" để bù.`, 'err');

  renderPromptsV();
  saveState(true);
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Đã thêm Prompt B cho ${done}/${targets.length} cảnh.`, 'info'); return; }
  setStatus2(`✓ Đã thêm Prompt B cho ${done}/${targets.length} cảnh dài hơn ${THRESHOLD}s.`, 'ok');
}

async function autoFillEra(force){
  const el = document.getElementById('t3Era');
  if (!el) return;
  if (!force && el.value.trim()) return;            // đã có giá trị → không đè (trừ khi bấm nút)
  const script = (state.script || '').trim();
  if (!script) { if (force) setStatus3('Tool 02 chưa có kịch bản để suy bối cảnh.', 'info'); return; }
  const prevPh = el.placeholder;
  el.placeholder = '⏳ Đang suy bối cảnh & thời đại từ kịch bản...';
  try {
    const prompt = `Read the script excerpt below. Return ONLY 1 JSON object describing the SETTING + ERA + CULTURE (in English, one line) so that period-correct CLOTHING + HAIR/HEADWEAR can be chosen: place, time period (with year if inferable), a few signature garments, signature hairstyles/headwear.
Format: {"era":"<one-line description>"}
Example: {"era":"Ancient Egypt, New Kingdom (~1300 BCE) — clothing: linen kilts, wesekh collars, sandals; hair: shaved heads or black bob wigs, nemes headcloth; no modern clothing or hairstyles"}
Print ONLY the JSON, no explanation.

SCRIPT:
"""
${script.slice(0, 2500)}
"""`;
    let reply = '';
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có era là chuỗi không rỗng
    try {
      const o = await callLLMJson(prompt, { maxTokens: 300, validate: o => o && typeof o.era === 'string' && o.era.trim() });
      reply = String(o.era).trim();
    } catch (_) {}
    if (!reply) {  // fallback: model trả văn xuôi → quét dòng đúng format (có "clothing:"/"—"/"hair:")
      const raw = (await callClaude(prompt, 300)) || '';
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
      reply = (lines.find(l => /clothing:|hair:|—/i.test(l)) || lines[lines.length - 1] || '').replace(/^["'\s]+|["'\s]+$/g, '');
    }
    if (!reply) throw new Error('AI trả về rỗng');
    el.value = reply;
    state.t3Era = reply;
    setStatus3('✓ Đã tự điền Bối cảnh & thời đại từ kịch bản — kiểm tra/sửa nếu cần rồi Generate.', 'ok');
    saveState();
  } catch (e) {
    console.warn('autoFillEra:', e);
    if (force) setStatus3('Không suy được bối cảnh: ' + e.message, 'error');
  } finally {
    el.placeholder = prevPh;
  }
}

function autoFillAssetNames(){
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('t3AssetNames').value = [...chars, ...bgs].join('\n');
  document.getElementById('t3AssetCount').textContent = [...chars, ...bgs].length + ' assets';
  renderAssetPreview();
}

function autoPickAll(){
  if (state.scenes.length === 0) return setStatus5('Cần load cảnh trước.', 'error');
  if (!state.mediaPicks) state.mediaPicks = {};
  let n = 0, noResult = 0;
  for (const s of state.scenes) {
    if (state.mediaPicks[s.id]?.downloadUrl) continue;     // đã chọn → giữ
    const cached = _t5Results[s.id];
    if (!cached || (!cached.photos.length && !cached.videos.length)) { noResult++; continue; }
    if (cached.videos.length) pickMedia(s.id, 'videos', 0);
    else pickMedia(s.id, 'photos', 0);
    n++;
  }
  const note = noResult ? ` (${noResult} cảnh chưa có kết quả — bấm "Tìm tất cả" trước)` : '';
  setStatus5(`✨ Đã tự chọn ${n} cảnh.${note}`, n ? 'ok' : 'info');
}

