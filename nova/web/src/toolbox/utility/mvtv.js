/* MV+TV — motion vision (_mv*) + sinh video TV (tvGenerate, model keys, upscale arm)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _mvImgSrc(img){ return img.base64.startsWith('data:') ? img.base64 : ('data:' + (img.mediaType || 'image/png') + ';base64,' + img.base64); }

function _mvRenderSceneList(){
  const info = document.getElementById('mvInfo');
  if (info) info.textContent = mvScenes.length ? (mvScenes.length + ' ảnh sẵn sàng. Bấm Sinh prompt chuyển động.') : 'Chưa có ảnh — tải ảnh lên (test) hoặc lấy ảnh cảnh đã tạo.';
  const box = document.getElementById('mvSceneList');
  if (!box) return;
  box.innerHTML = mvScenes.length
    ? mvScenes.map(s => `<div style="display:flex;gap:8px;align-items:center;font-size:12px"><img src="${_mvImgSrc(s.img)}" style="width:44px;height:26px;object-fit:cover;border-radius:4px;border:1px solid var(--border)"><b>[${escapeHtml(s.id)}]</b> <span style="color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${s.uploaded ? '<i>ảnh tải lên</i>' : escapeHtml((s.vo || '').slice(0, 90))}</span>${s.uploaded ? `<button class="btn ghost sm" style="padding:1px 7px" onclick="mvRemoveUpload('${s.id}')">×</button>` : ''}</div>`).join('')
    : '<div class="empty-state">Tải ảnh lên (test) hoặc "Lấy ảnh cảnh đã tạo" từ Tool 2 / Tạo Ảnh Hàng Loạt.</div>';
}

function _mvFileToB64(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(',') + 1)); }; r.onerror = rej; r.readAsDataURL(file); }); }

function _mvRules(cfg){
  // Câu khoá style phải theo PROFILE — trước đây ép cứng "flat 2D" nên kênh ảnh thật/lịch sử cũng bị kéo về hoạt hình.
  const _pm = (typeof _profileMedium === 'function') ? _profileMedium(typeof getProfile === 'function' ? getProfile() : null) : { is2D: true, isPhoto: false };
  const _lookLock = _pm.isPhoto ? 'Keep the photorealistic look and stable facial features throughout.'
    : _pm.is2D ? 'Keep the flat 2D look and stable facial features throughout.'
    : 'Keep the exact art style of the still image and stable facial features throughout.';
  const _exStyle = _pm.isPhoto ? 'Photorealistic documentary cinematography, muted desaturated palette, tense somber mood.'
    : _pm.is2D ? 'Dark 2D hand-drawn storybook style, muted desaturated palette, tense somber mood.'
    : 'Same art style as the still image, muted desaturated palette, tense somber mood.';
  return `OFFICIAL VEO FORMULA — write the 5 parts IN THIS EXACT ORDER, camera FIRST:
[Cinematography] → [Subject] → [Action] → [Context] → [Style & Ambiance]
Sample (match this voice):
"Very slow push-in, close-up. A young farmer's solemn face. He slowly glances toward the tree line, faint breath visible in the cold air. Village clearing before dawn, drifting mist and a distant flicker of torchlight behind him. ${_exStyle} ${_lookLock}"

MANDATORY RULES:
1. Opening Cinematography = "${cfg.camText}" + shot size (close-up / medium / wide establishing shot) inferred from the image content.
2. Describe ONLY the MOTION applied to the existing still image — KEEP the characters, composition and art style unchanged. Do NOT add new objects/characters, do NOT change the scene, do NOT re-describe appearance details (the image already locks them).
3. Action = SMALL, SLOW motion (breathing, blinking, gaze shift, hair/cloth sway, thin wisp of smoke, flickering firelight, drifting mist, ripples, falling leaves). Intensity: ${cfg.intText}. Minimal motion so faces/masks are NOT distorted.
4. NEVER include spoken lines and NEVER use quotation marks for speech (this channel records voiceover separately — no character voices, no sound/music/SFX descriptions).
5. Style & Ambiance goes LAST, ending with: "${_lookLock}"${cfg.extra ? '\n6. Extra notes: ' + cfg.extra : ''}`;
}

function _mvCfg(){
  // Mặc định: chuyển động tinh tế + push-in chậm điện ảnh (an toàn nhất cho khuôn mặt).
  // Độ dài lấy theo panel "Tạo video Flow" (mvVidDur) để prompt khớp clip sẽ render.
  return {
    clip: document.getElementById('mvVidDur')?.value || '8',
    extra: '',
    intText: 'rất tinh tế, tối thiểu (an toàn nhất cho khuôn mặt)',
    camText: 'Very slow push-in',
  };
}

async function _mvGenVision(s, cfg){
  const messages = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: s.img.mediaType || 'image/png', data: s.img.base64 } },
    { type: 'text', text: `The image above is the FIRST FRAME of a ${cfg.clip}s Veo (image→video) clip. Look at the image and write 1 MOTION prompt IN ENGLISH for Veo.

${_mvRules(cfg)}

Return ONLY 1 JSON: {"motion":"..."}` },
  ] }];
  const data = await callLLMJson('', { maxTokens: 900, messages, validate: d => d && typeof d.motion === 'string' && d.motion.length > 20 });
  return data.motion.trim();
}

function tvSetMode(m){
  tvState.mode = m;
  document.querySelectorAll('#tool-tool6 .tv-mbody').forEach(d => { d.style.display = (d.dataset.m === m) ? '' : 'none'; });
  const pair = document.getElementById('tvPairWrap'); if (pair) pair.style.display = (m === 'prompt') ? 'none' : '';
  tvRenderRows();
}

function _tvModeRows(){
  if (tvState.mode === 'image') return mvScenes.filter(s => s.uploaded);
  return mvScenes.filter(s => !s.uploaded);   // scene
}

function tvRenderRows(){
  const box = document.getElementById('tvRows'); if (!box) return;
  const mp = state.motionPrompts || {};
  const rows = _tvModeRows();
  // Mặc định: nếu có cảnh đánh dấu 🎬 (chế độ Xen video) → CHỈ chọn các cảnh đó; không thì chọn hết. Giữ lựa chọn cũ.
  const _wantSet = new Set((state.scenes || []).filter(x => x.wantVideo).map(x => x.id));
  const _useMark = _wantSet.size > 0;
  rows.forEach(s => { if (!tvState.initSel || !tvState.selected.has('_seen_' + s.id)) { if (!_useMark || _wantSet.has(s.id)) tvState.selected.add(s.id); tvState.selected.add('_seen_' + s.id); } });
  tvState.initSel = true;
  if (!rows.length){ box.innerHTML = '<div class="empty-state">' + (tvState.mode === 'image' ? 'Chưa có ảnh. Bấm ⬆ Tải ảnh lên.' : 'Chưa có ảnh cảnh. Bấm 📥 Lấy ảnh + prompt từ Phân Cảnh.') + '</div>'; return; }
  box.innerHTML = rows.map(s => {
    const on = tvState.selected.has(s.id);
    const pr = escapeHtml(mp[s.id] || '');
    return `<div class="tv-row${on ? '' : ' off'}">
      <span><input type="checkbox" class="tv-ck" ${on ? 'checked' : ''} onchange="tvToggleRow('${s.id}',this.checked)"></span>
      <span class="tv-idx">${escapeHtml(s.id)}</span>
      <img class="tv-thumb" src="${_mvImgSrc(s.img)}" onclick="tvEnlarge('${s.id}')">
      <textarea class="tv-pr" rows="2" oninput="tvEditPrompt('${s.id}',this.value)" placeholder="— trống → AI tự sinh khi tạo —">${pr}</textarea>
      <span class="tv-x" title="Bỏ dòng" onclick="tvRemoveRow('${s.id}')">✕</span>
    </div>`;
  }).join('');
}

function tvToggleRow(id, on){ if (on) tvState.selected.add(id); else tvState.selected.delete(id); tvRenderRows(); }

function tvToggleAll(on){ _tvModeRows().forEach(s => { if (on) tvState.selected.add(s.id); else tvState.selected.delete(s.id); }); tvRenderRows(); }

function tvEditPrompt(id, v){ if (!state.motionPrompts) state.motionPrompts = {}; state.motionPrompts[id] = v; }

function tvRemoveRow(id){
  const s = mvScenes.find(x => x.id === id);
  if (s && s.uploaded) { mvUploaded = mvUploaded.filter(u => u.id !== id); mvRebuild(); }
  else { tvState.selected.delete(id); tvRenderRows(); }   // cảnh từ Tool 2: chỉ bỏ chọn
}

function tvEnlarge(id){ const s = mvScenes.find(x => x.id === id); if (!s) return; const m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:30px'; m.onclick = () => m.remove(); m.innerHTML = `<img src="${_mvImgSrc(s.img)}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px">`; document.body.appendChild(m); }

function tvSelectedIds(){ return new Set(_tvModeRows().filter(s => tvState.selected.has(s.id)).map(s => s.id)); }

function _tvParsePrompts(){
  return (document.getElementById('tvPrompts')?.value || '').split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(/^([^|]{1,60})\|(.+)$/);
    return m ? { name: m[1].trim(), prompt: m[2].trim() } : { name: 'video-' + String(i + 1).padStart(3, '0'), prompt: line };
  });
}

function tvUpdatePromptCount(){ const el = document.getElementById('tvPromptCount'); if (el) el.textContent = String(_tvParsePrompts().length); }

function tvImportPromptFile(file){ if (!file) return; const r = new FileReader(); r.onload = () => { const t = document.getElementById('tvPrompts'); if (t){ t.value = (t.value ? t.value + '\n' : '') + String(r.result || ''); tvUpdatePromptCount(); } }; r.readAsText(file); }

async function tvFlowStatus(){
  const el = document.getElementById('tvAcctBar'); if (!el) return;
  const setg = ' <a href="#" onclick="switchTool(\'toolsettings\');return false" style="color:var(--accent);font-weight:600">Cài đặt</a>';
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa kết nối</b> <span style="color:var(--text-muted)">— thêm/đăng nhập tài khoản ở' + setg + '</span>'; return; }
    const st = await flowBridge.call('GET_STATUS');
    const accs = (st && st.accounts) || []; const n = (st && st.accountCount) || accs.filter(a => a.hasToken).length || 0;
    if (!n && !(st && st.hasToken)) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa đăng nhập</b> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; return; }
    let html = '<span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span> <b>Đã kết nối · ' + n + ' tài khoản</b>';
    accs.slice(0, 6).forEach(a => { const cr = (a.credits != null) ? (' · ' + a.credits + ' credit') : ''; html += '<span style="font-size:11px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:99px;padding:3px 10px;color:var(--text-muted)">' + escapeHtml(String(a.email || 'tài khoản').split('@')[0]) + cr + '</span>'; });
    html += '<a href="#" onclick="switchTool(\'toolsettings\');return false" style="margin-left:auto;color:var(--accent);font-weight:600;font-size:11.5px">⚙️ Quản lý ở Cài đặt</a>';
    el.innerHTML = html;
    // Đã kết nối → dọn thông báo lỗi "Chưa kết nối" CŨ còn kẹt ở thanh trạng thái Flow (statusflow) để 2 chỗ không mâu thuẫn.
    try { const sf = document.getElementById('statusflow'); if (sf && /Chưa kết nối|Chưa đăng nhập/i.test(sf.textContent || '')) setStatusF('✓ Đã kết nối · ' + n + ' tài khoản.', 'info'); } catch (e) {}
  } catch (e) { el.innerHTML = '<span style="color:var(--amber)">⚠️ Chưa kết nối</span> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; }
}

function _mvDownload(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

function _autoSaveCfg(){ if (!state.autoSave) state.autoSave = { enabled: false, mode: 'perTask', folder: '' }; return state.autoSave; }

function _autoSaveChannel(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  return String((p && p.name) || document.getElementById('pTenKenh')?.value || 'novastudio');
}

function _autoSaveTask(){
  const custom = (_autoSaveCfg().taskName || '').trim();
  // Không đặt riêng → theo TÊN VIDEO hiện tại (khớp thư mục luồng tự động), else theo tên kênh.
  let vname = ''; try { const v = (typeof getCurrentVideo === 'function') ? getCurrentVideo() : null; vname = (v && v.name) || ''; } catch (e) {}
  return (_slug(custom || vname || _autoSaveChannel()) || 'task').slice(0, 60);
}

function _autoSaveSyncUI(){
  const c = _autoSaveCfg();
  const ch = _slug(_autoSaveChannel()).slice(0, 60) || 'task';
  document.querySelectorAll('.asv-enabled').forEach(e => { e.checked = !!c.enabled; });
  document.querySelectorAll('.asv-mode').forEach(e => { e.value = c.mode || 'perTask'; });
  document.querySelectorAll('.asv-folder').forEach(e => { e.value = c.folder || ''; });
  const wmEl = document.getElementById('wmToggle'); if (wmEl) wmEl.checked = !!c.wmRemove;
  const wmO = document.getElementById('wmOff'); if (wmO && c.off) wmO.value = c.off;
  const wmS = document.getElementById('wmSide'); if (wmS && c.side) wmS.value = c.side;
  document.querySelectorAll('.asv-name').forEach(e => { e.value = c.taskName || ''; e.placeholder = 'Tên thư mục (mặc định: ' + ch + ')'; e.style.display = (c.mode === 'flat') ? 'none' : ''; });
}

function _wmCfg(){ const c = _autoSaveCfg(); if (typeof c.wmRemove === 'undefined') c.wmRemove = false; return { enabled: !!c.wmRemove }; }

function _wmSetStatus(msg, tone){ const el = document.getElementById('wmStatus'); if (el){ el.textContent = msg; el.style.color = tone === 'ok' ? 'var(--ok,#22c55e)' : tone === 'err' ? 'var(--danger,#ef4444)' : tone === 'work' ? 'var(--brand,#f97316)' : 'var(--text-dim)'; } }

function wmToggle(el){ const on = !!(el && el.checked); _autoSaveCfg().wmRemove = on; try { saveState(true); } catch {} _wmSetStatus(on ? '✓ Bật — ảnh tạo ra sẽ tự xoá dấu ✦ rồi hiển thị & lưu.' : 'Tắt.', on ? 'ok' : ''); }

async function wmGeminiClean(src){
  try {
    if (!window.native?.wmInpaint) return src;   // chỉ chạy ở bản App (cần main-process + model AI)
    const s = String(src).startsWith('data:') ? String(src) : ('data:image/png;base64,' + src);
    const mime = (s.match(/^data:([^;,]+)/) || [])[1] || 'image/png';
    const r = await window.native.wmInpaint(s, mime);   // AI inpaint (MI-GAN) ở tiến trình chính
    return (r && String(r).startsWith('data:')) ? r : src;
  } catch (e){ return src; }
}

async function _mvPersistVideos(){
  try {
    const p = (typeof getProfile === 'function') ? getProfile() : null;
    const uid = window.currentUser?.uid; const pid = p?.profileId;
    if (!uid || !pid || typeof IDB === 'undefined') return;
    const b = uid + '/' + pid + '/' + _curVideoId(p) + '/';
    await IDB.set(b + 'sceneVideoBlobs', mvVideoBlobs || {});
    await IDB.set(b + 'sceneVideosMeta', state.sceneVideos || {});
  } catch (e){ /* */ }
}

async function _mvRunLimited(items, limit, worker){
  let idx = 0;
  const runNext = async () => { while (idx < items.length && !window.__mvVidStop){ const i = idx++; await worker(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => runNext()));
}

function tvRenderVideos(){
  const box = document.getElementById('mvVidResultList'); if (!box) return;
  if (!tvResults.length){ box.innerHTML = '<div class="empty-state">Chưa có video.</div>'; return; }
  const dur = document.getElementById('mvVidDur')?.value || '8';
  box.innerHTML = tvResults.map((r, i) => {
    let inner;
    if (r.status === 'done'){ const src = r.b64 ? ('data:' + (r.mime || 'video/mp4') + ';base64,' + r.b64) : (r.videoUrl || ''); inner = `<div style="aspect-ratio:16/9;position:relative;background:#000">${src ? `<video src="${src}" controls style="width:100%;height:100%;object-fit:cover"></video>` : '<div style="display:grid;place-items:center;height:100%;color:#fff;font-size:11px">video</div>'}<span style="position:absolute;top:5px;left:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(22,163,74,.92);color:#fff">${dur}s ✓</span></div>`; }
    else if (r.status === 'gen'){ inner = `<div style="aspect-ratio:16/9;background:linear-gradient(135deg,#3b3f45,#25282d);position:relative"><span style="position:absolute;top:7px;right:9px;color:#e8e8ea;font-size:13px;font-weight:700">${Math.round(r.pct || 0)}%</span><span style="position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--accent-2),var(--accent));width:${r.pct || 4}%"></span></div>`; }
    else if (r.status === 'err'){ inner = `<div title="${escapeHtml(r.err || '')}" style="min-height:120px;background:color-mix(in srgb,var(--red) 10%,var(--surface-3));color:var(--red);font-size:10px;line-height:1.4;font-weight:500;padding:8px;overflow:auto;word-break:break-word;font-family:ui-monospace,monospace">✗ ${escapeHtml(r.err || '')}</div>`; }
    else inner = `<div style="aspect-ratio:16/9;background:var(--surface-3);display:grid;place-items:center;color:var(--text-dim);font-size:12px;opacity:.6">chờ…</div>`;
    return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;overflow:hidden">${inner}<div style="padding:6px 9px;font-size:11px;color:var(--text-muted);display:flex;gap:6px;align-items:center"><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.name)}.mp4</span>${r.status === 'done' && (r.b64 || r.videoUrl) ? `<span style="cursor:pointer;color:var(--accent)" onclick="tvDownloadOne(${i})">↓</span>` : ''}</div></div>`;
  }).join('');
}

function _tvBuildItems(){
  if (tvState.mode === 'prompt'){ return _tvParsePrompts().map(p => ({ id: p.name, name: p.name, prompt: p.prompt, image: null })); }
  const mp = state.motionPrompts || {}; const sel = tvSelectedIds();
  return _tvModeRows().filter(s => sel.has(s.id)).map(s => ({ id: s.id, name: _mvVidName(s.id).replace(/\.[^.]+$/, ''), prompt: mp[s.id] || '', image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, sceneId: s.id }));
}

async function tvGenerate(retryOnly){
  if (typeof gateTool === 'function' && gateTool('tool6')) return;
  if (window.__tvRunning) return;
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))){ setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập.', 'error'); return; }
  let items = retryOnly ? tvResults.filter(r => r.status === 'err').map(r => r._item).filter(Boolean) : _tvBuildItems();
  if (!items.length){ setStatusBar('statusMvVid', retryOnly ? 'Không có video lỗi để thử lại.' : (tvState.mode === 'prompt' ? 'Chưa nhập prompt.' : 'Chưa chọn cảnh (hoặc chưa có ảnh).'), 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))){ setStatusBar('statusMvVid', 'Chưa đăng nhập. Vào Cài đặt.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelSlug = document.getElementById('mvVidModel').value.trim();
  let modelKey = '';
  if (modelSlug){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || tvModelKeys; } catch (e){} const mk = tvModelKeys[modelSlug] || TV_BUILTIN_MODEL_KEYS[modelSlug]; if (!mk){ setStatusBar('statusMvVid', '⚠️ Model "' + (TV_MODEL_LABEL[modelSlug] || modelSlug) + '" không hỗ trợ.', 'error'); return; } modelKey = mk; }
  const cMode = document.getElementById('mvVidConc')?.value || '0';
  const conc = cMode === '0' ? Math.min(Math.max(st.accountCount || 1, 1), 8) : (parseInt(cMode) || 1);
  const tvRes = document.getElementById('mvVidRes')?.value || '720p';
  if (tvRes === '1080p'){ try { const us = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if (!us || !us.learned){ setStatusBar('statusMvVid', '⚠️ Chọn 1080p nhưng chưa "học nâng 1080p". Bấm 🎓 Học nâng 1080p (ô vàng) trước, hoặc đổi về 720p.', 'error'); return; } } catch(e){} }
  if (!retryOnly) tvResults = items.map(it => ({ id: it.id, name: it.name, status: 'wait', pct: 0, _item: it }));
  else items.forEach(it => { const r = tvResults.find(x => x.id === it.id); if (r){ r.status = 'wait'; r.pct = 0; r.err = ''; } });
  window.__tvRunning = true; window.__mvVidStop = false; _mvVidSyncBtn(true);
  try { await flowBridge.call('POOL_RESET'); } catch (e) { /* */ }
  tvRenderVideos();
  let done = 0, err = 0; const total = items.length;
  setStatusBar('statusMvVid', `🎬 Render ${total} video · ${conc} luồng… mỗi clip ~1-3 phút.`, 'working');
  // ── Nhật ký chi tiết (kiểu chuyên nghiệp) ──
  const _modelLbl = (typeof TV_MODEL_LABEL !== 'undefined' && TV_MODEL_LABEL[modelSlug]) || modelSlug || 'mặc định';
  const _asCfg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + total + ' video (Text→Video)', 'acc');
  novaLog('  • Model: ' + _modelLbl + ' · Độ dài: ' + durationSecs + 's · Tỉ lệ: ' + aspect + ' · Độ nét: ' + tvRes + (tvRes === '1080p' ? ' (nâng)' : ''), 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc, 'acc');
  novaLog('  • Lưu về máy: ' + (_asCfg.enabled && _asCfg.folder ? _asCfg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  await _mvRunLimited(items, conc, async (it) => {
    if (window.__mvVidStop) return;
    const row = tvResults.find(x => x.id === it.id); if (!row) return;
    row.status = 'gen'; row.pct = 6; tvRenderVideos();
    novaLog('🎬 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → Veo đang dựng…', 'acc');
    const tick = setInterval(() => { if (row.status === 'gen'){ row.pct = Math.min(90, row.pct + Math.random() * 6); tvRenderVideos(); } }, 2500);
    try {
      // C5: cache Veo theo (prompt+model+dur). Cung prompt tao 2 lan -> tra cache, khong ton credit.
      const _cacheHit = _t6VeoCacheGet(it.prompt, modelKey, durationSecs, '');
      if (_cacheHit && _cacheHit.b64){
        try { if (typeof novaLog === 'function') novaLog('Veo cache HIT (' + it.name + ') - tiet kiem credit', 'ok'); } catch(_){}
        clearInterval(tick);
        row.status = 'done'; row.pct = 100; row.b64 = _cacheHit.b64; row.mime = _cacheHit.mime || 'video/mp4';
        done++;
        tvRenderVideos();
        return;
      }
      let r = await flowBridge.call('POOL_GEN_VIDEO', { prompt: it.prompt, aspect, durationSecs, modelKey, resolution: tvRes, sceneId: it.sceneId || it.id, image: it.image || undefined, withData: true });
      r = await _videoAppResolve(r, { resolution: tvRes, aspect });   // extension farm mode → app resolve (+ nâng 1080p nếu chọn)
      clearInterval(tick);
      let savedPath = null;
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        row.status = 'done'; row.pct = 100; row.videoUrl = r.videoUrl || null;
        if (r.video?.b64){ row.b64 = r.video.b64; row.mime = r.video.mime || 'video/mp4'; try { const sv = await autoSaveMedia(it.name + '.mp4', r.video.b64, 'video'); if (sv && sv.path) savedPath = sv.path; } catch (e2) { /* */ } }
        // C5: put cache for next time
        try { if (r.video && r.video.b64) _t6VeoCachePut(it.prompt, modelKey, durationSecs, '', { b64: r.video.b64, mime: r.video.mime || 'video/mp4' }); } catch(_){}
        done++;
      } else { row.status = 'err'; row.err = _bulkFriendlyErr(String((r && (r.error || r.raw)) || 'Không rõ lỗi')); err++; }
      // Nhật ký per-video + xoay tài khoản
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển ' + it.name + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (row.status === 'done'){
          const sz = (r && r.video && r.video.size) ? ' · ' + _logMB(r.video.size) : '';
          const cr = (r && r.credits != null) ? ' · còn ' + r.credits + ' credit' : '';
          const res = (r && r.resolution) ? ' · ' + r.resolution : '';
          novaLog('✅ ' + it.name + '.mp4 · tài khoản ' + ((r && r.account) || '?') + ' · thành công' + res + sz + cr, 'ok');
          if (savedPath) novaLog('   💾 đã lưu: ' + savedPath, 'ok');
        }
        else { const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(String(row.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit' : (row.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e5) {}
    } catch (e){ clearInterval(tick); row.status = 'err'; row.err = e.message || String(e); err++; novaLog('❌ ' + it.name + ' · ' + (e.message || String(e)), 'err'); }
    tvRenderVideos();
    setStatusBar('statusMvVid', `🎬 ${done} xong · ${err} lỗi · còn ${total - done - err}…`, 'working');
  });
  novaLog('━━━ ' + (window.__mvVidStop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + total + ' video' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  window.__tvRunning = false; _mvVidSyncBtn(false);
  tvRenderVideos();
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${done} video.` : `✓ Xong ${done} video${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
}

function tvToggleGen(){ if (window.__tvRunning) window.__mvVidStop = true; else tvGenerate(); }

function _mvVidSyncBtn(running){
  const b = document.getElementById('mvVidGenBtn'); if (!b) return;
  b.disabled = false;
  b.className = running ? 'btn ghost sm' : 'btn primary sm';
  b.style.color = running ? 'var(--red)' : '';
  b.style.borderColor = running ? 'var(--red)' : '';
  b.textContent = running ? '■ Dừng' : '▶ Tạo tất cả';
}

function tvDownloadOne(i){ const r = tvResults[i]; if (!r) return; if (r.b64) _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); else if (r.videoUrl) novaDownloadUrl(r.videoUrl, r.name + '.mp4'); }

async function _videoAppResolve(r, opts){
  if (!r || !r.needsAppResolve || !r.projectId || !r.mediaId || !window.native?.flowChrome) return r;
  const o = opts || {};
  try {
    const rv = await window.native.flowChrome('RESOLVE_VIDEO', { email: r.account, projectId: r.projectId, mediaId: r.mediaId, resolution: o.resolution || '720p', aspect: o.aspect || null, withData: true });
    if (rv && !rv.error && (rv.video?.b64 || rv.videoUrl)) return { ...r, video: rv.video || r.video, videoUrl: rv.videoUrl || r.videoUrl, resolution: rv.resolution || r.resolution };
    return { ...r, ok: false, error: (rv && rv.error) || 'Không lấy được file video (app resolve)' };
  } catch(e){ return { ...r, ok: false, error: 'App resolve lỗi: ' + (e.message || e) }; }
}

async function tvLoadModelKeys(){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || {}; } catch (e){} tvRenderModelOptions(); }

async function tvRefreshModels(){ const sb = (typeof setStatusBar === 'function'); if (sb) setStatusBar('statusMvVid', 'Đang quét model từ Flow…', 'working'); await tvLoadModelKeys(); if (sb) setStatusBar('statusMvVid', 'Đã cập nhật danh sách model.', 'ok'); }

function tvRenderModelOptions(){
  const sel = document.getElementById('mvVidModel'); if (!sel) return;
  const cur = sel.value;
  const merged = Object.assign({}, TV_BUILTIN_MODEL_KEYS, tvModelKeys || {});
  const labels = Object.assign({}, TV_MODEL_LABEL, { 'omni-flash': 'Omni Flash (FREE)' });
  let html = '';
  for (const slug of Object.keys(merged)) { const v = merged[slug]; const key = (v && typeof v === 'object') ? (v.image || v.text) : v; if (typeof key !== 'string' || !key) continue; html += '<option value="' + slug + '"' + (slug === cur ? ' selected' : '') + '>' + (labels[slug] || slug) + '</option>'; }
  if (html) { sel.innerHTML = html; if (typeof tvOnModelChange === 'function') tvOnModelChange(); }
}

function tvOnModelChange(){ const m = document.getElementById('mvVidModel')?.value || ''; const w = document.getElementById('tvDurWrap'); if (w) w.style.display = (/^veo/.test(m) || m === 'omni-flash') ? 'none' : ''; }

function tvOnResChange(){ const r = document.getElementById('mvVidRes')?.value || '720p'; if (r === '1080p') tvRefreshUpsStatus(); else { const row = document.getElementById('tvUpsRow'); if (row) row.style.display = 'none'; } }

async function tvRefreshUpsStatus(){
  const row = document.getElementById('tvUpsRow'); const el = document.getElementById('tvUpsStatus');
  const is1080 = (document.getElementById('mvVidRes')?.value === '1080p');
  try {
    const s = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null);
    if (s && s.learned){ if (row) row.style.display = 'none'; return; }   // đã học → ẩn hộp cho gọn
    if (row) row.style.display = is1080 ? 'flex' : 'none';
    if (el) el.innerHTML = '1080p cần "học" 1 lần: bấm <b>🎓 Học nâng 1080p</b> → trong Flow bấm Tải xuống → 1080p trên 1 video bất kỳ.';
  } catch(e){ if (row) row.style.display = is1080 ? 'flex' : 'none'; }
}

async function tvArmUpscale(){
  const el = document.getElementById('tvUpsStatus');
  if (el) el.innerHTML = '⏳ Đang mở Chrome… hãy bấm <b>Tải xuống → 1080p</b> trên 1 video bất kỳ trong Flow.';
  try {
    const r = await window.native.flowChrome('VIDEO_UPSCALE_ARM').catch(e=>({error:String(e)}));
    if (r && r.error){ if (el) el.innerHTML = '❌ ' + r.error; return; }
    if (el) el.innerHTML = '✅ Đã mở Chrome. Bấm <b>⋮ / Tải xuống → 1080p</b> trên 1 video. Học xong bấm ↻ để kiểm tra.';
    // tự kiểm tra lại sau vài giây
    let n = 0; const iv = setInterval(async () => { n++; const s = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if ((s && s.learned) || n > 40){ clearInterval(iv); tvRefreshUpsStatus(); } }, 3000);
  } catch(e){ if (el) el.innerHTML = '❌ ' + (e.message || e); }
}

function _mvVidName(id){
  const s = mvScenes.find(x => x.id === id);
  if (s && !s.uploaded && s.origId != null){
    const num = /^\d+$/.test(String(s.origId)) ? String(s.origId).padStart(3, '0') : _slug(String(s.origId));
    return num + (s.variant === 'b' ? 'b' : (s.variant === 'a' ? 'a' : '')) + '.mp4';
  }
  if (s && s.uploaded && s.uploadedName){
    return s.uploadedName.replace(/\.[a-z0-9]+$/i, '') + '.mp4';
  }
  // dự phòng: theo thứ tự
  const sv = state.sceneVideos || {};
  const idx = mvScenes.filter(x => sv[x.id] && !sv[x.id].error).findIndex(x => x.id === id);
  return 'canh-' + String((idx < 0 ? 0 : idx) + 1).padStart(3, '0') + '.mp4';
}

