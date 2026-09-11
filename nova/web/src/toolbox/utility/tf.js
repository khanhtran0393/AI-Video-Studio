/* TF — Google Flow engine UI: tf*, bulk*, fc*, wm status, tfGenScenes/tfGenAssets
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _t2AnalyzeSyncBtn(running){
  const b = document.getElementById('t2AnalyzeBtn'); if (!b) return;
  b.dataset.run = running ? '1' : '';
  b.textContent = running ? '■ Dừng' : '✨ Phân tích kịch bản';
  b.style.background = running ? 'var(--red)' : 'linear-gradient(180deg,var(--accent-2),var(--accent))';
}

function requestCancel(){
  state.cancelRequested = true;
  try { if (typeof tfState === 'object' && tfState) tfState.stop = true; } catch (e) {}   // dừng LUÔN tạo ảnh cảnh / asset / hàng đợi tạo lại qua Flow (tfPool + regen pool đều kiểm tfState.stop)
  try { if (typeof _flowAbort === 'function') _flowAbort(true); } catch (e) {}   // báo backend bỏ NGAY lượt gen đang chạy dở
  try { if (typeof _t2RegenPending !== 'undefined') _t2RegenPending.clear(); } catch (e) {}   // xoá hàng đợi tạo lại đang chờ
  if (typeof setStatus2 === 'function') setStatus2('⏸ Đang dừng sau khi xong ảnh đang chạy dở…', 'info');
}

function clearCancel(){
  state.cancelRequested = false;
}

function tfInit(){
  flowBridge.init();
  tfSyncModeUI();
  tfRenderExtStatus();
  tfRefreshConn();
  tfRenderScenes();
  tfRenderAssets();
  if (typeof bulkUpdateCount === 'function') bulkUpdateCount();
  if (typeof bulkRenderRefs === 'function') bulkRenderRefs();
  if (typeof bulkRenderGrid === 'function') bulkRenderGrid();
  if (typeof bulkFlowStatus === 'function') bulkFlowStatus();
  if (typeof bulkUpsCheck === 'function') bulkUpsCheck();
}

function tfAssetImageMap(){
  const map = {};
  const ci = state.characterImages || {};
  const bi = state.backgroundImages || {};
  for (const n in ci) if (ci[n]?.base64) map[n] = ci[n];
  for (const n in bi) if (bi[n]?.base64) map[n] = bi[n];
  return map;
}

function tfExtractRefNames(promptText, imgMap){
  const keys = Object.keys(imgMap);
  const tags = String(promptText || '').match(/\[([^\[\]]+)\]/g) || [];
  const out = [];
  for (const raw of tags){
    // Tag có thể GHÉP nhiều người "[patient, oncologist]" → tách ra khớp TỪNG người (asset giờ là cá nhân).
    const names = (typeof _splitCharNames === 'function') ? _splitCharNames(raw.slice(1, -1)) : [raw.slice(1, -1).trim()];
    for (const name of names){
      if (!name) continue;
      // Khớp chính xác trước; nếu không có ảnh → khớp LINH HOẠT biến thể tên ngắn/dài (vd [protagonist-male] ↔ ảnh "protagonist-male-trader") để face-lock vẫn ăn.
      let hit = imgMap[name] ? name : (keys.find(k => k === name || k.startsWith(name + '-') || name.startsWith(k + '-')) || null);
      if (hit && !out.includes(hit)) out.push(hit);
    }
  }
  return out;
}

async function tfEnsureRefUploaded(name, projectId, imgMap){
  if (tfState.uploaded[name]) return tfState.uploaded[name];
  const img = imgMap[name];
  if (!img) return null;
  const raw = img.base64.startsWith('data:') ? img.base64.split(',')[1] : img.base64;
  const r = await flowBridge.call('UPLOAD_IMAGE', { projectId, base64: raw, mime: img.mediaType || 'image/png', fileName: _slug(name) + '.png' });
  if (r?.error || !r?.media_id) { console.warn('[Flow] upload ảnh tham chiếu LỖI:', name, '→', r?.error); return null; }
  console.log('[Flow] upload tham chiếu OK:', name, '→', r.media_id);
  tfState.uploaded[name] = r.media_id;
  return r.media_id;
}

function _bulkParse(){
  const raw = (document.getElementById('bulkPrompts')?.value || '');
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const seen = {};
  return lines.map((ln, i) => {
    let name = '', prompt = ln;
    const m = ln.match(/^([^|]{1,60})\|(.+)$/);
    if (m) { name = _slug(m[1].trim()); prompt = m[2].trim(); }
    if (!name) name = 'anh-' + String(i + 1).padStart(3, '0');
    if (seen[name]) { seen[name]++; name = name + '-' + seen[name]; } else seen[name] = 1;
    return { name, prompt };
  });
}

function bulkUpdateCount(){ const el = document.getElementById('bulkCount'); if (el) el.textContent = _bulkParse().length + ' ảnh'; }

function bulkImportFile(input){
  const f = input.files && input.files[0]; if (!f) return; input.value = '';
  const r = new FileReader();
  r.onload = () => { const ta = document.getElementById('bulkPrompts'); if (ta) { const cur = ta.value.trim(); ta.value = (cur ? cur + '\n' : '') + String(r.result || ''); bulkUpdateCount(); } };
  r.readAsText(f, 'utf-8');
}

function bulkAddRefs(files){
  [...(files || [])].forEach(f => { const r = new FileReader(); r.onload = () => { bulkState.refs.push({ name: 'ref-' + (bulkState.refs.length + 1), base64: String(r.result || ''), mediaType: f.type || 'image/png' }); bulkRenderRefs(); }; r.readAsDataURL(f); });
}

function bulkRenderRefs(){
  const el = document.getElementById('bulkRefThumbs'); if (!el) return;
  el.innerHTML = bulkState.refs.map((rf, i) => `<span style="position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:3px;width:58px"><span style="position:relative;width:52px;height:52px;border-radius:7px;overflow:hidden;background:#0002"><img src="${rf.base64}" style="width:100%;height:100%;object-fit:cover"><button title="Xoá" onclick="bulkState.refs.splice(${i},1);bulkRenderRefs()" style="position:absolute;top:-3px;right:-3px;background:var(--red);color:#fff;border:none;width:16px;height:16px;border-radius:50%;font-size:10px;cursor:pointer;line-height:1;padding:0">×</button></span><input value="${escapeHtml(rf.name)}" title="Tên ref — gõ [${escapeHtml(rf.name)}] trong prompt để chỉ đính ref này" onchange="_bulkRenameRef(${i}, this.value)" style="width:56px;font-size:9.5px;text-align:center;border:1px solid var(--border);border-radius:5px;padding:2px 3px;background:var(--surface);color:var(--text)"></span>`).join('');
}

function _bulkRenameRef(i, v){
  const rf = bulkState.refs[i]; if (!rf) return;
  let name = String(v || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  if (!name) name = 'ref-' + (i + 1);
  // tránh trùng tên (tag sẽ nhập nhằng)
  if (bulkState.refs.some((r, j) => j !== i && r.name === name)) name = name + '-' + (i + 1);
  rf.name = name; bulkRenderRefs();
}

function _bulkAspect(){ const a = (document.getElementById('tfAspect')?.value || '16:9'); return a.indexOf('9:16') >= 0 ? '9/16' : a.indexOf('1:1') >= 0 ? '1/1' : '16/9'; }

function _bulkTile(it, i){
  const ar = _bulkAspect(), s = it.status;
  let im;
  if (s === 'done') { const q = (document.getElementById('tfQuality')?.value || 'orig'); const qLbl = q === '2048' ? '2K' : q === '3840' ? '4K' : ''; const badge = qLbl ? (it.upscaled ? `<span style="position:absolute;top:5px;right:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(22,163,74,.92);color:#fff" title="Upscale thật của Flow">${qLbl}</span>` : `<span style="position:absolute;top:5px;right:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.6);color:#fbbf24" title="Flow chưa nâng kịp — dùng ảnh gốc, không lỗi">gốc</span>`) : ''; im = `<div style="position:relative;aspect-ratio:${ar};cursor:zoom-in" onclick="bulkEnlarge(${i})"><img src="${it.dataUrl}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;top:5px;left:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.6);color:#fff">✓</span>${badge}</div>`; }
  else if (s === 'gen') im = `<div style="aspect-ratio:${ar};background:linear-gradient(135deg,#3b3f45,#25282d);position:relative"><span id="bpct-${i}" style="position:absolute;top:7px;right:9px;color:#e8e8ea;font-size:13px;font-weight:700">${Math.round(it.pct || 0)}%</span><span id="bfill-${i}" style="position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--accent-2),var(--accent));width:${it.pct || 4}%"></span></div>`;
  else if (s === 'err') im = `<div title="${escapeHtml(it.err || '')}" style="aspect-ratio:${ar};background:color-mix(in srgb,var(--red) 12%,var(--surface-3));display:grid;place-items:center;color:var(--red);font-size:12px;font-weight:600;text-align:center;padding:6px">✗ lỗi<br><span style="font-size:9px;font-weight:400">${escapeHtml((it.err || '').slice(0, 60))}</span></div>`;
  else im = `<div style="aspect-ratio:${ar};background:var(--surface-3);display:grid;place-items:center;color:var(--text-dim);font-size:12px;opacity:.6">chờ…</div>`;
  return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;overflow:hidden">${im}<div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(it.prompt || '')}">${escapeHtml(it.name)}</div></div>`;
}

function bulkRenderGrid(){
  const grid = document.getElementById('bulkGrid'); if (!grid) return;
  if (!bulkState.items.length) { grid.innerHTML = '<div class="empty-state">Nhập prompt ở trên → bấm ▶ Tạo tất cả.</div>'; const i0 = document.getElementById('bulkInfo'); if (i0) i0.textContent = ''; return; }
  grid.innerHTML = bulkState.items.map((it, i) => _bulkTile(it, i)).join('');
  const done = bulkState.items.filter(x => x.status === 'done').length, gen = bulkState.items.filter(x => x.status === 'gen').length, err = bulkState.items.filter(x => x.status === 'err').length;
  const info = document.getElementById('bulkInfo'); if (info) info.textContent = `${done}/${bulkState.items.length} xong · ${gen} đang chạy · ${err} lỗi`;
}

function bulkEnlarge(i){ const it = bulkState.items[i]; if (!it || !it.dataUrl) return; const m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:30px'; m.onclick = () => m.remove(); m.innerHTML = `<img src="${it.dataUrl}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px">`; document.body.appendChild(m); }

function bulkStop(){ bulkState.stop = true; setStatusF('Đang dừng…', 'info'); }

function bulkToggle(){ if (bulkState.running) bulkStop(); else bulkGenerate(); }

function _bulkSyncBtn(){
  const b = document.getElementById('bulkGenBtn'); if (!b) return;
  b.className = bulkState.running ? 'btn ghost sm' : 'btn primary sm';
  b.style.color = bulkState.running ? 'var(--red)' : '';
  b.style.borderColor = bulkState.running ? 'var(--red)' : '';
  b.textContent = bulkState.running ? '■ Dừng' : '▶ Tạo tất cả';
}

function bulkRetryFailed(){ bulkGenerate(true); }

function _bulkRefsFor(promptText, imgMap, allNames){
  const s = String(promptText || '');
  const tags = s.match(/\[([^\[\]]+)\]/g) || [];
  if (!tags.length) return { refNames: allNames, text: s };
  const keys = Object.keys(imgMap);
  const matched = []; let text = s;
  for (const raw of tags){
    const name = raw.slice(1, -1).trim().toLowerCase();
    const hit = imgMap[name] ? name : (keys.find(k => k === name || k.startsWith(name + '-') || name.startsWith(k + '-')) || null);
    if (hit){ if (!matched.includes(hit)) matched.push(hit); text = text.split(raw).join(' '); }   // xoá tag khớp khỏi prompt
  }
  text = text.replace(/\s+/g, ' ').trim();
  // Có [..] nhưng KHÔNG khớp ref nào (vd viết [close up] như ghi chú) → không coi là tag ref,
  // giữ nguyên prompt + đính TẤT CẢ ref (tránh vô tình bỏ hết ref).
  if (!matched.length) return { refNames: allNames, text: s };
  return { refNames: matched, text };
}

function _bulkFriendlyErr(e){
  const s = String(e || '');
  if (/PER_MODEL_DAILY_QUOTA|RESOURCE_EXHAUSTED|EXHAUSTED|QUOTA/i.test(s)) return 'Hết lượt tạo ảnh hôm nay — đổi model, thêm tài khoản, hoặc chờ sang ngày mới';
  if (/MODEL_ACCESS_DENIED|does not have permission/i.test(s)) return 'Tài khoản không có quyền model/chất lượng này (cần gói trả phí)';
  if (/API_401|UNAUTHENT|NO_FLOW_KEY/i.test(s)) return 'Tài khoản hết phiên — quét lại/đăng nhập ở Cài đặt';
  if (/\bAPI_0\b|API_5\d\d|ECONN|ETIMEDOUT|network|timeout|no response|failed to fetch/i.test(s)) return 'Flow chưa sẵn sàng (mới mở Chrome) hoặc mạng chập — đợi vài giây rồi thử lại';
  if (/FILTER|SAFETY|PROMINENT_PEOPLE/i.test(s)) return 'Prompt bị lọc (nội dung nhạy cảm) — sửa prompt';
  if (/ALL_ACCOUNTS_EXHAUSTED/i.test(s)) return 'Tất cả tài khoản đã hết lượt hôm nay';
  return s.length > 90 ? s.slice(0, 90) + '…' : s;
}

async function bulkGenerate(retryOnly){
  if (bulkState.running) return;
  if (!retryOnly) bulkState.items = _bulkParse().map(x => ({ ...x, status: 'wait', pct: 0, err: '', dataUrl: null }));
  if (!bulkState.items.length) { setStatusF('Chưa có prompt. Nhập danh sách prompt trước.', 'error'); return; }
  const targets = retryOnly ? bulkState.items.filter(x => x.status === 'err') : bulkState.items;
  if (!targets.length) { setStatusF('Không có ảnh nào cần tạo.', 'info'); return; }
  targets.forEach(x => { x.status = 'wait'; x.pct = 0; x.err = ''; });
  bulkRenderGrid();
  if (!(await flowBridge.waitReady(1500))) { setStatusF('Chưa kết nối. Thêm/đăng nhập tài khoản ở Cài đặt.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))) { setStatusF('Chưa đăng nhập. Thêm/đăng nhập tài khoản ở Cài đặt.', 'error'); return; }
  const cfg = tfCfg();
  // Luôn dùng POOL (project per-account) — kể cả 1 account — để project + credit chui đúng account,
  // không dồn vào tài khoản đang đăng nhập ở tab extension (chế độ Extension "1 tab + N token").
  const multi = flowBridge.mode === 'extension' ? (st.accountCount || 0) >= 1 : (st.accountCount || 0) > 1;
  bulkState.running = true; bulkState.stop = false; _bulkSyncBtn();
  let projectId = null;
  try { if (multi) await flowBridge.call('POOL_RESET'); else projectId = await tfEnsureProject(); }
  catch (e) { bulkState.running = false; _bulkSyncBtn(); setStatusF('Lỗi mở project: ' + (e.message || e), 'error'); return; }
  const conc = multi ? Math.max(1, st.accountCount) : cfg.conc;   // = số tài khoản (1 request/tài khoản): SONG SONG đủ, không quá tải (tránh reCAPTCHA)
  const _asImg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + targets.length + ' ảnh', 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc + (cfg.upscale && cfg.upscale !== '1' ? ' · Nâng nét: ' + cfg.upscale : ''), 'acc');
  novaLog('  • Lưu về máy: ' + (_asImg.enabled && _asImg.folder ? _asImg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  const imgMap = {}; bulkState.refs.forEach(rf => imgMap[rf.name] = rf);
  const allRefNames = bulkState.refs.map(rf => rf.name);
  const tier = st.paygateTier;
  let done = 0, err = 0;
  const _t0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();   // ⏱ cho ETA
  const _fmtEta = (s) => s > 0 ? (Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0')) : '';
  try {
    await tfPool(targets, async (it) => {
      if (bulkState.stop) return;
      const idx = bulkState.items.indexOf(it);
      it.status = 'gen'; it.pct = 6; bulkRenderGrid();
      novaLog('🖼 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → đang tạo…', 'acc');
      const tick = setInterval(() => { if (it.status === 'gen') { it.pct = Math.min(92, it.pct + Math.random() * 9); const pe = document.getElementById('bpct-' + idx); if (pe) pe.textContent = Math.round(it.pct) + '%'; const fe = document.getElementById('bfill-' + idx); if (fe) fe.style.width = it.pct + '%'; } }, 500);
      try {
        // Tag [tên-ref] trong prompt → chỉ đính ref khớp; không tag → đính tất cả (như cũ). Tag khớp bị xoá khỏi prompt.
        const sel = _bulkRefsFor(it.prompt || '', imgMap, allRefNames);
        const r = await tfDispatchGen(cleanPrompt(sel.text), sel.refNames, { multi, cfg, imgMap, projectId, tier });
        it._acc = (r && r.account) || null;
        it._rotated = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        clearInterval(tick);
        const entries = (r && r.media_entries) || [];
        const e0 = entries.find(e => e.dataUrl);
        if (r && r.error) { it.status = 'err'; it.err = _bulkFriendlyErr(String(r.error)); err++; }
        else if (e0) {
          it.status = 'done'; it.pct = 100; it.mime = e0.mime || 'image/png';
          // Extension đã lo chất lượng: 2K/4K = upscale THẬT của Flow (e0.upscaled), lỗi thì lùi ảnh gốc.
          // KHÔNG canvas-resize ở app nữa (phóng canvas chỉ to pixel chứ không nét hơn).
          // Bật "Tự xoá dấu ✦" → xoá watermark NGAY (Canvas) để ảnh HIỂN THỊ trong tool + file lưu đều sạch.
          it.dataUrl = _wmCfg().enabled ? await wmGeminiClean(e0.dataUrl) : e0.dataUrl;
          it.upscaled = !!e0.upscaled; it.upscaleFailed = !!e0.upscaleFailed;
          done++;
          try { if (typeof autoSaveMedia === 'function') { const sv = await autoSaveMedia(it.name + '.' + ((it.mime.split('/')[1] || 'png').replace('jpeg', 'jpg')), it.dataUrl, 'anh', true); if (sv && sv.path) it._savedPath = sv.path; } } catch (e2) {}
        }
        else {
          const fe = entries.find(e => e.fetchError);
          it.status = 'err';
          it.err = fe ? ('tải ảnh lỗi: ' + fe.fetchError) : (r && r.account ? ('không có ảnh (tài khoản ' + r.account + ' — token hết hạn? Quét lại ở Cài đặt)') : (entries.length ? 'ảnh trống (fetch lỗi)' : 'không có ảnh trả về — token hết hạn / model / bị lọc?'));
          console.warn('[bulk] "' + it.name + '" không ra ảnh — response:', r);
          err++;
        }
      } catch (e) { clearInterval(tick); it.status = 'err'; it.err = e.message || String(e); err++; }
      // Nhật ký per-account (như đối thủ)
      try {
        // Xoay tài khoản do hết lượt/credit → ghi rõ
        if (Array.isArray(it._rotated)) for (const ex of it._rotated) novaLog('⚠️ ' + ex + ' hết lượt hôm nay → chuyển ' + it.name + ' sang ' + (it._acc || 'tài khoản khác'), 'warn');
        if (it.status === 'done') { novaLog('✅ ' + it.name + ' · tài khoản ' + (it._acc || '?') + ' · thành công' + (it.upscaled ? ' (2K/4K)' : ''), 'ok'); if (it._savedPath) novaLog('   💾 đã lưu: ' + it._savedPath, 'ok'); }
        else if (it.status === 'err') { const q = /429|QUOTA|EXHAUSTED|hết giới hạn/i.test(String(it.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + (it._acc ? ('tài khoản ' + it._acc + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (it.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e3) {}
      bulkRenderGrid();
      const _rem = targets.length - done - err;
      const _eta = (done > 0 && _t0) ? _fmtEta(((performance.now() - _t0) / 1000 / done) * _rem) : '';
      setStatusF(`Tạo ảnh: ${done} xong · ${err} lỗi · còn ${_rem}${_eta ? ' · ~' + _eta + ' nữa' : ''}`, 'working');
    }, conc, cfg.delay || 0);
  } catch (e) { setStatusF('Lỗi: ' + (e.message || e), 'error'); }
  // 📊 Tóm tắt: tách lỗi do QUOTA (tài khoản hết lượt) vs lỗi tạm thời (có thể tự thử lại).
  const _reQuota = /429|QUOTA|EXHAUSTED|hết lượt|hết quota|hết giới hạn|ALL_ACCOUNTS/i;
  const errItems = bulkState.items.filter(it => it.status === 'err');
  const quotaErr = errItems.filter(it => _reQuota.test(String(it.err))).length;
  const softErr = errItems.length - quotaErr;
  novaLog('━━━ ' + (bulkState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + targets.length + ' ảnh' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  if (quotaErr) novaLog('  • ' + quotaErr + ' ảnh lỗi do TÀI KHOẢN HẾT LƯỢT — thêm tài khoản Flow ở Cài đặt, hoặc thử lại sau khi quota hồi.', 'warn');
  bulkState.running = false; _bulkSyncBtn();
  bulkRenderGrid();
  // ↻ AUTO-RETRY: chỉ lỗi TẠM THỜI (không phải quota), tối đa 2 lần, sau 2.5s.
  if (!retryOnly) bulkState._autoRetries = 0;
  if (!bulkState.stop && softErr > 0 && (bulkState._autoRetries || 0) < 2){
    bulkState._autoRetries = (bulkState._autoRetries || 0) + 1;
    setStatusF(`↻ Tự thử lại ${softErr} ảnh lỗi tạm thời (lần ${bulkState._autoRetries})…`, 'working');
    novaLog('↻ Tự thử lại ' + softErr + ' ảnh lỗi tạm thời (lần ' + bulkState._autoRetries + ')…', 'acc');
    setTimeout(() => { if (!bulkState.running && !bulkState.stop) bulkGenerate(true); }, 2500);
    return;
  }
  setStatusF(bulkState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh${err ? `, ${err} lỗi${quotaErr ? ' (' + quotaErr + ' do hết quota)' : ''}` : ''}.`, err ? 'error' : 'ok');
  try { if (typeof notifyDone === 'function') notifyDone('✓ Tạo ảnh hàng loạt xong', `${done} ảnh, ${err} lỗi.`); } catch (e) {}
}

function bulkUpsRender(st){
  const el = document.getElementById('bulkUpsStatus'); if (!el) return;
  // Upscale luôn SẴN CÓ nhờ template mặc định (không cần học). Học chỉ là dự phòng khi Flow đổi API.
  el.textContent = (st && st.learned) ? '✓ 2K/4K: upscale thật (đã cập nhật)' : '✓ 2K/4K: upscale thật (Flow super-res, sẵn có)';
  el.style.color = 'var(--green)';
}

async function bulkUpsCheck(){ try { bulkUpsRender(await flowBridge.call('UPSCALE_LEARN_STATUS')); } catch (e) {} }

async function bulkLearnUpscale(){
  try {
    const r = await flowBridge.call('UPSCALE_LEARN_ARM');
    if (r && r.error){ setStatusF('Cần đăng nhập tài khoản Flow trước (ở Cài đặt).', 'error'); return; }
    setStatusF('Đã mở cửa sổ Flow. Bấm Tải xuống → 2K trên 1 ảnh bất kỳ để app học… (đang chờ)', 'working');
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      let st = null; try { st = await flowBridge.call('UPSCALE_LEARN_STATUS'); } catch (e) {}
      bulkUpsRender(st);
      if (st && st.learned){ clearInterval(iv); setStatusF('✓ Đã học 2K! Từ giờ chọn 2K/4K sẽ upscale thật.', 'ok'); }
      else if (tries > 120){ clearInterval(iv); setStatusF('Chưa bắt được request 2K. Thử lại: bấm Tải xuống → 2K trên 1 ảnh trong cửa sổ Flow.', 'info'); }
    }, 1500);
  } catch (e){ setStatusF('Lỗi: ' + (e.message || e), 'error'); }
}

async function bulkFlowStatus(){
  const el = document.getElementById('bulkAcctBar'); if (!el) return;
  const setg = ' <a href="#" onclick="switchTool(\'toolsettings\');return false" style="color:var(--accent);font-weight:600">Cài đặt</a>';
  el.innerHTML = '<span style="color:var(--text-dim)">⏳ Kiểm tra kết nối…</span>';
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) {
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa kết nối</b> <span style="color:var(--text-muted)">— thêm/đăng nhập tài khoản ở' + setg + '</span>'; return;
    }
    const st = await flowBridge.call('GET_STATUS');
    const accs = (st && st.accounts) || [];
    const active = accs.filter(a => a.enabled !== false && !a.needLogin && (a.hasToken || a.engine === 'chrome'));
    const needLoginN = accs.filter(a => a.needLogin).length;
    const n = active.length || ((needLoginN || !accs.length) ? 0 : ((st && st.accountCount) || 0));
    if (!n && !(st && st.hasToken)) {
      // Có tài khoản nhưng ĐỀU cần đăng nhập lại → báo rõ, đừng để "đã kết nối" ảo.
      if (needLoginN) { el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Cần đăng nhập lại · ' + needLoginN + ' tài khoản</b> <span style="color:var(--text-muted)">— mở tab Flow đăng nhập, hoặc' + setg + '</span>'; return; }
      el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span> <b style="color:var(--amber)">Chưa đăng nhập</b> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; return;
    }
    let html = '<span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span> <b>Đã kết nối · ' + n + ' tài khoản</b>' + (needLoginN ? ' <span style="color:var(--amber);font-size:11px">· ' + needLoginN + ' cần đăng nhập lại</span>' : '');
    active.slice(0, 6).forEach(a => { const cr = (a.credits != null) ? (' · ' + a.credits + ' credit') : ''; html += '<span style="font-size:11px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:99px;padding:3px 10px;color:var(--text-muted)">' + escapeHtml(String(a.email || 'tài khoản').split('@')[0]) + cr + '</span>'; });
    html += '<a href="#" onclick="switchTool(\'toolsettings\');return false" style="margin-left:auto;color:var(--accent);font-weight:600;font-size:11.5px">⚙️ Quản lý ở Cài đặt</a>';
    el.innerHTML = html;
    // Đã kết nối → dọn thông báo lỗi "Chưa kết nối" CŨ còn kẹt ở thanh trạng thái Flow (statusflow) để 2 chỗ không mâu thuẫn.
    try { const sf = document.getElementById('statusflow'); if (sf && /Chưa kết nối|Chưa đăng nhập/i.test(sf.textContent || '')) setStatusF('✓ Đã kết nối · ' + n + ' tài khoản.', 'info'); } catch (e) {}
  } catch (e) { el.innerHTML = '<span style="color:var(--amber)">⚠️ Chưa kết nối</span> <span style="color:var(--text-muted)">— vào' + setg + '</span>'; }
}

async function bulkDownloadAll(){
  const done = bulkState.items.filter(x => x.status === 'done' && x.dataUrl);
  if (!done.length) { setStatusF('Chưa có ảnh nào để tải.', 'error'); return; }
  for (const it of done) { const a = document.createElement('a'); a.href = it.dataUrl; a.download = it.name + '.' + (((it.mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg')); document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 120)); }
  setStatusF(`Đã tải ${done.length} ảnh.`, 'ok');
}

function tfCfg(){
  return {
    model: document.getElementById('tfModel').value,
    aspect: document.getElementById('tfAspect').value,
    quality: document.getElementById('tfQuality').value,
    conc: parseInt(document.getElementById('tfConc').value) || 2,
    delay: (document.getElementById('tfDelay')?.value === 'rand510' ? -1 : (parseInt(document.getElementById('tfDelay')?.value) || 0)),   // độ trễ giữa các lần gọi ảnh (ms); -1 = ngẫu nhiên 5–10s
  };
}

async function tfRefreshConn(){
  const el = document.getElementById('tfConn');
  if (!el) return;
  el.innerHTML = '';   // trạng thái kết nối đã hiện ở mục "Chế độ xác thực" phía trên → panel chỉ hiện danh sách tài khoản (khỏi trùng)
  // Chế độ Tích hợp sẵn: bảng tự làm mới sống để thấy account lên 🟢 khi auto-refresh chạy.
  if (flowBridge.mode === 'builtin') tfStartBuiltinPoll();
  else if (_tfBuiltinPoll){ clearInterval(_tfBuiltinPoll); _tfBuiltinPoll = null; }
  try { fcRenderList(); } catch (e) {}   // danh sách account Chrome (GĐ2)
}

function tfStartBuiltinPoll(){
  if (_tfBuiltinPoll) return;   // đã chạy
  _tfBuiltinPoll = setInterval(async () => {
    if (flowBridge.mode !== 'builtin'){ clearInterval(_tfBuiltinPoll); _tfBuiltinPoll = null; return; }
    const el = document.getElementById('tfConn');
    if (!el || el.contains(document.activeElement)) return;   // đang gõ trong bảng → khỏi vẽ lại
    const s = await flowBridge.call('GET_STATUS').catch(() => null);
    if (s && !s.error) tfRenderConn(s);
  }, 6000);
}

function tfTierName(t){ return t === 'PAYGATE_TIER_TWO' ? 'Ultra' : t === 'PAYGATE_TIER_ONE' ? 'Pro' : t ? 'Free' : null; }   // tier null = CHƯA verify được → KHÔNG được hiện nhầm thành "Free"
function tfTierCell(t){ const n = tfTierName(t); if (!n) return '<span style="color:var(--text-dim)" title="Chưa verify — bấm ↻ Làm mới để cập nhật gói + tín dụng">Chưa rõ</span>'; const col = t === 'PAYGATE_TIER_TWO' ? 'var(--violet)' : t === 'PAYGATE_TIER_ONE' ? 'var(--accent)' : 'var(--text-muted)'; return `<b style="color:${col}">${n}</b>`; }

function _tfFmtExpiry(ms){ const d = new Date(ms); const p = n => String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`; }

function _tfExpCell(ms){
  if (!ms) return '<span style="color:var(--text-dim)">—</span>';
  const left = ms - Date.now();
  const col = left <= 0 ? 'var(--red)' : (left < 24*3600*1000 ? 'var(--amber)' : 'var(--text)');
  return `<span style="color:${col};${left<=0?'font-weight:600':''};white-space:nowrap">${_tfFmtExpiry(ms)}</span>`;
}

function tfRenderConn(s){
  const el = document.getElementById('tfConn');
  if (!el) return;
  if (!s || s.error){ el.innerHTML = '<span style="color:var(--red)">Lỗi trạng thái: ' + escapeHtml(s?.error || '') + '</span>'; return; }
  const ext = flowBridge.mode === 'extension';
  const accs = Array.isArray(s.accounts) ? s.accounts : [];
  if (ext && accs.length) _tfAutoPersist(accs);   // vẫn lưu tài khoản extension vào kho app
  el.innerHTML = ext ? '<div style="font-size:12px;color:var(--green)">● Extension đã kết nối</div>' : '';   // 1 danh sách DUY NHẤT = bảng bên dưới; ẩn danh sách pool cũ
  return;
  const readyCount = ext ? (s.hasToken ? accs.length : 0) : accs.filter(a => a.enabled !== false && a.hasToken).length;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div><b>${accs.length}</b> tài khoản · <span style="color:var(--green)">${readyCount} sẵn sàng</span>${ext ? ' <span style="color:var(--text-muted);font-size:11px">(quản lý trong Chrome)</span>' : ''}</div>
    </div>`;

  if (!accs.length){
    html += ext
      ? '<div style="color:var(--text-muted);font-size:13px">Chưa thấy tài khoản. Bấm <b>🌐 Mở Flow trong Chrome</b>, đăng nhập Google, rồi bấm <b>Quét lại</b>.</div>'
      : '<div style="color:var(--text-muted);font-size:13px">Chưa có tài khoản. Bấm <b>＋ Thêm tài khoản Flow</b> (đăng nhập Google) hoặc dán Cookie bên dưới.</div>';
  } else {
    html += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="text-align:left;color:var(--text-muted)">
        ${ext ? '' : '<th style="padding:5px 4px">Bật</th>'}<th style="padding:5px 4px">Tài khoản</th><th style="padding:5px 4px">Gói</th>
        <th style="padding:5px 4px">Credit</th>${ext ? '' : '<th style="padding:5px 4px">Hạn Cookie</th><th style="padding:5px 4px">Hạn Token</th>'}<th style="padding:5px 4px">Trạng thái</th>
        ${ext ? '' : '<th style="padding:5px 4px">Proxy</th><th style="padding:5px 4px"></th>'}
      </tr></thead><tbody>`;
    for (const a of accs){
      if (a.engine === 'chrome') continue;   // tài khoản CfT chỉ hiện ở danh sách CfT bên dưới (khỏi trùng)
      const active = ext ? !!s.hasToken : !!a.hasToken;
      const st = active ? '<span style="color:var(--green)">● Hoạt động</span>' : '<span style="color:var(--red)">○ Hết hạn</span>';
      const tokExp = a.capturedAt ? (a.capturedAt + 55 * 60 * 1000) : null;
      html += `<tr style="border-top:1px solid var(--border)">
        ${ext ? '' : `<td style="padding:5px 4px"><input type="checkbox" ${a.enabled !== false ? 'checked' : ''} onchange="tfSetEnabled(${a.id}, this.checked)"></td>`}
        <td style="padding:5px 4px">${a.engine === 'chrome' ? '🖥️ ' : ''}${escapeHtml(a.email || ('TK ' + (a.id ?? '')))}</td>
        <td style="padding:5px 4px">${tfTierCell(a.tier)}</td>
        <td style="padding:5px 4px">${a.credits ?? '—'}</td>
        ${ext ? '' : `<td style="padding:5px 4px">${_tfExpCell(a.cookieExpiry)}</td><td style="padding:5px 4px">${_tfExpCell(tokExp)}</td>`}
        <td style="padding:5px 4px">${st}</td>
        ${ext ? '' : `<td style="padding:5px 4px"><input value="${escapeHtml(a.proxy || '')}" placeholder="host:port" onchange="tfSetProxy(${a.id}, this.value)" style="width:118px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px"></td>
        <td style="padding:5px 4px;white-space:nowrap">
          <button class="btn ghost sm" onclick="tfRefreshAcc(${a.id})" title="Làm mới token + credit">↻</button>
          <button class="btn ghost sm" onclick="tfDelAcc(${a.id})" title="Xoá tài khoản" style="color:var(--red)">🗑</button>
        </td>`}
      </tr>`;
    }
    html += '</tbody></table></div>';
  }

  if (!ext){
    html += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">🍪 <b>Thêm bằng Cookie</b> (xuất từ extension <em>Cookie Exporter</em> trên labs.google/fx — dán JSON hoặc chuỗi cookie, khỏi đăng nhập):</div>
        <textarea id="tfCookieInput" placeholder="Dán cookie vào đây…" style="width:100%;height:52px;padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:11px;box-sizing:border-box;resize:vertical"></textarea>
        <button class="btn ghost sm" style="margin-top:6px" onclick="tfAddCookie()">＋ Thêm bằng Cookie</button>
      </div>`;
  } else {
    html += '<div id="tfSaveNote" style="margin-top:10px;font-size:11.5px;color:var(--text-muted)">💾 Tự động lưu tài khoản vào app để dùng lại khi đổi trình duyệt…</div>';
  }

  el.innerHTML = html;
  if (ext && accs.length) _tfAutoPersist(accs);
}

async function tfSetEnabled(id, en){ await flowBridge.call('SET_ENABLED', { id, enabled: en }); }

async function tfSetProxy(id, proxy){
  const r = await flowBridge.call('SET_PROXY', { id, proxy: (proxy || '').trim() });
  setStatusF(r?.error ? ('Proxy lỗi: ' + r.error) : 'Đã lưu proxy cho tài khoản.', r?.error ? 'error' : 'ok');
}

async function tfRefreshAcc(id){
  setStatusF('Đang làm mới tài khoản…', 'info');
  const r = await flowBridge.call('REFRESH_ACCOUNT', { id });
  tfRefreshConn();
  setStatusF(r?.hasToken ? 'Đã làm mới.' : 'Chưa lấy được token — bấm ＋ Thêm tài khoản Flow để đăng nhập lại account này.', r?.hasToken ? 'ok' : 'info');
}

async function tfDelAcc(id){
  if (!confirm('Xoá tài khoản Flow này khỏi app?')) return;
  await flowBridge.call('REMOVE_ACCOUNT', { id });
  tfRefreshConn();
}

async function tfAddCookie(){
  const ta = document.getElementById('tfCookieInput');
  const v = ta ? ta.value.trim() : '';
  if (!v){ setStatusF('Dán chuỗi cookie vào ô trước đã.', 'info'); return; }
  setStatusF('Đang thêm tài khoản bằng cookie…', 'info');
  const r = await flowBridge.call('ADD_ACCOUNT_COOKIE', { cookies: v });
  if (r?.error){ setStatusF('Thêm cookie lỗi: ' + r.error, 'error'); }
  else { setStatusF('Đã thêm tài khoản' + (r.email ? ': ' + r.email : '') + '.', 'ok'); if (ta) ta.value = ''; }
  tfRefreshConn();
}

async function tfScan(){
  const el = document.getElementById('tfConn');
  const ok = await flowBridge.waitReady(1500);
  if (!ok){ tfRefreshConn(); return; }
  if (el) el.textContent = 'Đang quét…';
  tfRenderConn(await flowBridge.call('SCAN'));
}

async function tfCftAdd(){
  if (_tfCftBusy) return;
  if (!window.native?.flowCftAdd){ setStatusF('Chỉ dùng được trong app desktop.', 'error'); return; }
  if (!window._cftHooked && window.native.onFlowCftProgress){
    window._cftHooked = true;
    window.native.onFlowCftProgress((o) => {
      if (o.type === 'download') setStatusF('⬇ Đang tải Chrome for Testing… ' + o.pct + '%', 'working');
      else if (o.msg) setStatusF(o.msg, 'working');
    });
  }
  _tfCftBusy = true;
  const btn = document.getElementById('tfCftBtn'); if (btn){ btn.disabled = true; btn.textContent = '🌐 Đang mở Chrome… (Huỷ)'; btn.onclick = tfCftCancel; }
  setStatusF('🌐 Đang mở Chrome — hãy đăng nhập tài khoản Google trong cửa sổ vừa mở.', 'working');
  let added = false;
  try {
    const r = await window.native.flowCftAdd();
    if (r?.error) setStatusF('Lỗi: ' + r.error, 'error');
    else if (r?.hasToken || r?.ok){ added = true; setStatusF('✓ Đã lưu tài khoản' + (r.email ? ' ' + r.email : '') + ' vào kho app. Đang hiện kho "Tích hợp sẵn" (nơi chạy song song nhiều tài khoản).', 'ok'); }
    else setStatusF('Chưa lưu được — thử lại.', 'error');
  } catch (e){ setStatusF('Lỗi: ' + (e.message || e), 'error'); }
  _tfCftBusy = false;
  if (btn){ btn.disabled = false; btn.textContent = '🌐 Thêm bằng Chrome (lưu vào app)'; btn.onclick = tfCftAdd; }
  // Tài khoản "Thêm bằng Chrome" lưu vào kho BUILT-IN → chuyển panel sang đó để thấy ngay.
  if (added) tfSetMode('builtin'); else tfRefreshConn();
}

function tfCftCancel(){ try { window.native?.flowCftCancel?.(); } catch (e) {} setStatusF('Đã huỷ.', 'info'); }

function _fcStatus(html, col){ const el = document.getElementById('fcStatus'); if (el){ el.innerHTML = html; el.style.color = col || 'var(--text-muted)'; } }

/* Poll trong lúc chờ thao tác Chrome dài (LOGIN_AUTO/REFRESH/RELOGIN): main đang chờ user bấm
   consent ủy quyền Google Labs lần đầu (cờ ssoConsent từ GET_ACCOUNTS) → hiện cảnh báo vàng
   lên ô trạng thái thay vì để ô đứng im ở "⏳…". Trả về hàm stop() gọi sau khi thao tác xong. */
function _fcConsentPoll(){
  const t = setInterval(async () => {
    const s = await window.native.flowChrome('GET_ACCOUNTS').catch(() => null);
    if (s?.ssoConsent) _fcStatus('⚠️ <b>' + escapeHtml(s.ssoConsent.message) + '</b>' + (s.ssoConsent.email ? ' (' + escapeHtml(s.ssoConsent.email) + ')' : ''), 'var(--amber)');
  }, 2500);
  return () => clearInterval(t);
}

function wmRefreshStatus(){
  const el = document.getElementById('fcWmStatus');
  if (el){ el.textContent = 'sẵn sàng — bấm để tắt'; el.style.color = 'var(--text-muted)'; }
}

function _fcDate(ms){
  if (!ms) return '<span style="color:var(--text-dim)">—</span>';
  const d = new Date(ms), p = n => String(n).padStart(2,'0'), exp = ms <= Date.now();
  return `<span style="color:${exp?'var(--red)':'var(--text)'};white-space:nowrap;font-size:11px">${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}</span>`;
}

async function fcRenderList(){
  const el = document.getElementById('fcList'); if (!el || !window.native?.flowChrome) return;
  if (typeof wmRefreshStatus === 'function') wmRefreshStatus();   // cập nhật trạng thái ô Watermark
  const s = await window.native.flowChrome('GET_ACCOUNTS').catch(() => null);
  const accs = s?.accounts || [];
  const canhBao = s?.ssoConsent ? `<div style="margin:0 0 9px;padding:8px 10px;border:1px solid var(--amber);border-radius:8px;background:rgba(255,170,0,.08);color:var(--amber);font-size:12.5px">⚠️ <b>${escapeHtml(s.ssoConsent.message)}</b>${s.ssoConsent.email ? ' (' + escapeHtml(s.ssoConsent.email) + ')' : ''}</div>` : '';
  const activeN = accs.filter(a => a.enabled !== false && a.hasToken && !a.needLogin).length;
  let h = canhBao + `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:9px">
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer"><input type="checkbox" ${accs.length && accs.every(a=>a.enabled!==false)?'checked':''} onchange="fcSetAllEnabled(this.checked)"> Bật tất cả</label>
      <span style="font-size:12px;color:var(--text-muted)">Tài khoản hoạt động: <b style="color:var(--green)">${activeN}</b>/${accs.length}</span>
      <select id="capModeSel" onchange="fcSetCapMode(this.value)" title="Máy giải reCAPTCHA. Guest (như đối thủ): Chrome trống dùng-1-lần, xoay profile+proxy mới liên tục → né 'unusual activity', KHÔNG đụng tài khoản thật. Account: xoay giữa các tài khoản." style="margin-left:auto;font-size:11.5px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">
        <option value="guest" ${(typeof _capModeCache==='undefined'||_capModeCache!=='account')?'selected':''}>🕵️ Captcha: Guest (khuyến nghị)</option>
        <option value="account" ${(typeof _capModeCache!=='undefined'&&_capModeCache==='account')?'selected':''}>👤 Captcha: Tài khoản</option>
      </select>
      <button class="btn ghost sm" onclick="fcRefreshAll()">↻ Làm mới tất cả</button>
    </div>`;
  if (!accs.length){ el.innerHTML = h + '<div style="color:var(--text-dim);font-size:12.5px;padding:8px 0">Chưa có tài khoản. Bấm <b>＋ Thêm tài khoản</b> ở trên để đăng nhập Google.</div>'; return; }
  h += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">
      <th style="padding:6px 5px">#</th><th style="padding:6px 5px">Bật</th><th style="padding:6px 5px">Ảnh</th><th style="padding:6px 5px">Video</th>
      <th style="padding:6px 5px">Tài khoản</th><th style="padding:6px 5px">Loại</th><th style="padding:6px 5px">Tín dụng</th>
      <th style="padding:6px 5px">Proxy</th><th style="padding:6px 5px">Hạn Cookie</th><th style="padding:6px 5px">Hạn Token</th>
      <th style="padding:6px 5px">Trạng thái</th><th style="padding:6px 5px">Hành động</th>
    </tr></thead><tbody>`;
  accs.forEach((a, i) => {
    const st = a.needLogin ? '<span style="color:var(--amber);font-weight:600">CẦN ĐN LẠI</span>'
      : (a.hasToken ? '<span style="color:var(--green);font-weight:600">HOẠT ĐỘNG</span>' : '<span style="color:var(--red);font-weight:600">HẾT HẠN</span>');
    const relogin = a.needLogin ? `<button class="btn sm" style="background:var(--amber);color:#111" title="Đăng nhập lại" onclick="fcRelogin(${a.id})">🔑 Đăng nhập lại</button> ` : '';
    h += `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 5px;color:var(--text-dim)">${i+1}</td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.enabled!==false?'checked':''} onchange="fcSetEnabled(${a.id},this.checked)"></td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.useImage!==false?'checked':''} onchange="fcSetUse(${a.id},'image',this.checked)"></td>
      <td style="padding:6px 5px"><input type="checkbox" ${a.useVideo!==false?'checked':''} onchange="fcSetUse(${a.id},'video',this.checked)"></td>
      <td style="padding:6px 5px;white-space:nowrap">${escapeHtml(a.email||('Chrome '+a.id))}</td>
      <td style="padding:6px 5px">${tfTierCell(a.tier)}</td>
      <td style="padding:6px 5px;color:var(--amber)">${a.credits ?? '—'}</td>
      <td style="padding:6px 5px"><input value="${escapeHtml(a.proxy||'')}" placeholder="host:port" onchange="fcSetProxy(${a.id},this.value)" style="width:96px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px"></td>
      <td style="padding:6px 5px">${_fcDate(a.cookieExpiry)}</td>
      <td style="padding:6px 5px">${_fcDate(a.tokenExpiry)}</td>
      <td style="padding:6px 5px">${st}</td>
      <td style="padding:6px 5px;white-space:nowrap">${relogin}<button class="btn ghost sm" title="Làm mới" onclick="fcRefresh(${a.id})">↻</button> <button class="btn ghost sm" style="color:var(--red)" title="Xoá" onclick="fcRemove(${a.id})">🗑</button></td>
    </tr>`;
  });
  el.innerHTML = h + '</tbody></table></div>';
}

async function fcAddAccount(){
  _fcStatus('⏳ Đang mở Chrome for Testing… Hãy <b>đăng nhập Google</b> trong cửa sổ vừa mở. App sẽ <b>tự nhận biết & lưu</b> — không cần bấm gì thêm.', 'var(--violet)');
  const stop = _fcConsentPoll();
  const r = await window.native.flowChrome('LOGIN_AUTO').catch(e=>({error:String(e)}));
  stop();
  if (r?.error){ _fcStatus('❌ ' + r.error, 'var(--red)'); fcRenderList(); return; }
  _fcStatus('✅ <b>Đã thêm tài khoản</b>' + (r.email ? ' — ' + escapeHtml(r.email) : '') + '.', 'var(--green)');
  fcRenderList();
  try { if (typeof tfRefreshConn === 'function') tfRefreshConn(); } catch (e) {}   // cập nhật chỉ báo kết nối/đếm tài khoản ở các tab
  try { if (typeof bulkFlowStatus === 'function') bulkFlowStatus(); } catch (e) {}
}

async function fcSetUse(id, kind, val){ await window.native.flowChrome('SET_USE', { id, kind, val }).catch(()=>{}); }

async function fcSetProxy(id, proxy){ await window.native.flowChrome('SET_PROXY', { id, proxy:(proxy||'').trim() }).catch(()=>{}); _fcStatus('Đã lưu proxy.', 'var(--green)'); }

async function fcSetAllEnabled(on){ const s = await window.native.flowChrome('GET_ACCOUNTS').catch(()=>null); for (const a of (s?.accounts||[])) await window.native.flowChrome('SET_ENABLED',{id:a.id,enabled:on}).catch(()=>{}); fcRenderList(); }

async function fcSetCapMode(m){
  _capModeCache = (m === 'account') ? 'account' : 'guest';
  try { await window.native.flowChrome('SET_CAPTCHA_MODE', { mode: _capModeCache }); } catch (e) {}
  _fcStatus(_capModeCache === 'guest' ? '✓ Máy captcha: Guest — Chrome trống xoay liên tục (né unusual-activity, không đụng tài khoản).' : '✓ Máy captcha: Tài khoản — xoay giữa các account.', 'var(--green)');
}

async function fcRefreshAll(){ _fcStatus('⏳ Đang làm mới tất cả (mở Chrome từng cái)…','var(--violet)'); const s = await window.native.flowChrome('GET_ACCOUNTS').catch(()=>null); let okC = 0, tot = 0; const errs = []; for (const a of (s?.accounts||[])){ if (a.enabled!==false && !a.needLogin){ tot++; const r = await window.native.flowChrome('REFRESH',{id:a.id}).catch(e=>({error:String(e)})); if (r?.credits != null) okC++; if (r?.error) errs.push('#'+a.id+': '+r.error); } } if (errs.length) _fcStatus('❌ Làm mới xong ' + okC + '/' + tot + ' đọc được tín dụng — lỗi: ' + escapeHtml(errs.join(' | ').slice(0,180)), 'var(--red)'); else if (okC === tot && tot > 0) _fcStatus('✅ Đã làm mới tất cả — ' + okC + '/' + tot + ' đọc được gói + tín dụng.', 'var(--green)'); else _fcStatus('⚠️ Làm mới xong nhưng chỉ ' + okC + '/' + tot + ' đọc được gói/tín dụng — đóng hết cửa sổ Chrome Flow rồi thử lại.', 'var(--amber)'); fcRenderList(); }

async function tfAddCookie2(){
  const ta = document.getElementById('tfCookieInput2'); const v = ta ? ta.value.trim() : '';
  if (!v){ _fcStatus('Dán chuỗi cookie vào ô trước đã.', 'var(--amber)'); return; }
  _fcStatus('⏳ Đang thêm bằng cookie…', 'var(--violet)');
  const r = await flowBridge.call('ADD_ACCOUNT_COOKIE', { cookies: v }).catch(e=>({error:String(e)}));
  if (r?.error){ _fcStatus('❌ Thêm cookie lỗi: ' + r.error, 'var(--red)'); }
  else { _fcStatus('✅ Đã thêm tài khoản' + (r.email ? ': ' + escapeHtml(r.email) : '') + '.', 'var(--green)'); if (ta) ta.value=''; }
  fcRenderList();
}

async function fcSetEnabled(id, en){ await window.native.flowChrome('SET_ENABLED', { id, enabled: en }).catch(()=>{}); }

async function fcRefresh(id){ _fcStatus('⏳ Làm mới account #' + id + '… (mở Chrome điều khiển, ~10s)', 'var(--violet)'); const stop = _fcConsentPoll(); const r = await window.native.flowChrome('REFRESH', { id }).catch(e=>({error:String(e)})); stop();
  if (r?.error){ _fcStatus('❌ ' + r.error, 'var(--red)'); }
  else {
    const ten = tfTierName(r.tier);
    if (r.credits != null && ten) _fcStatus('✅ Đã làm mới' + (r.email ? ' ' + escapeHtml(r.email) : '') + ' — ' + ten + ' · ' + r.credits + ' tín dụng.', 'var(--green)');
    else if (r.credits != null) _fcStatus('✅ Đã làm mới — ' + r.credits + ' tín dụng (gói chưa rõ).', 'var(--green)');
    else _fcStatus('⚠️ Đã làm mới token nhưng chưa đọc được gói/tín dụng' + (r.creditsStatus ? ' (HTTP ' + r.creditsStatus + ')' : '') + ' — đóng hết cửa sổ Chrome Flow rồi bấm ↻ thử lại.', 'var(--amber)');
  }
  fcRenderList(); }

async function fcRemove(id){ if (!confirm('Xoá account Chrome #' + id + '? (xoá cả profile đăng nhập)')) return; await window.native.flowChrome('REMOVE', { id }).catch(()=>{}); fcRenderList(); }

async function fcRelogin(id){
  _fcStatus('⏳ Đang mở Chrome for Testing… Hãy <b>đăng nhập Google</b> trong cửa sổ vừa mở. App sẽ <b>tự nhận biết & hoàn tất</b> — không cần bấm gì thêm.', 'var(--violet)');
  const stop = _fcConsentPoll();
  const r = await window.native.flowChrome('RELOGIN', { id }).catch(e=>({error:String(e)}));
  stop();
  if (r?.error){ _fcStatus('❌ ' + r.error, 'var(--red)'); fcRenderList(); return; }
  _fcStatus('✅ <b>Đã đăng nhập lại tự động</b>' + (r.email ? ' — ' + escapeHtml(r.email) : ' #' + id) + ' (Chrome for Testing).', 'var(--green)');
  fcRenderList();
}

function _tfBridgeTimed(action, payload, ms){
  return Promise.race([ flowBridge.call(action, payload || {}), new Promise(r => setTimeout(() => r({ error: 'TIMEOUT' }), ms || 8000)) ]);
}

async function _tfAutoPersist(accs){
  const key = (accs || []).map(a => a.email || a.id).sort().join('|');
  if (!key || key === _tfPersistKey) return;   // đã thử cho bộ này rồi
  _tfPersistKey = key;
  const setNote = (m, c) => { const el = document.getElementById('tfSaveNote'); if (el){ el.innerHTML = m; el.style.color = c || 'var(--text-muted)'; } };
  if (!window.native?.flow){ setNote('💾 Lưu vào app chỉ hoạt động ở bản desktop.'); return; }
  setNote('⏳ Đang lưu tài khoản vào app…', 'var(--violet)');
  // Danh sách đã lưu trong app (nhanh, không mở cửa sổ).
  const have = new Set();
  try { const cur = await window.native.flow('GET_ACCOUNTS'); (cur?.accounts || []).forEach(a => { if (a.email) have.add(a.email.toLowerCase()); }); } catch (e) {}
  let saved = 0; accs.forEach(a => { if (a.email && have.has(a.email.toLowerCase())) saved++; });
  // Xin cookie từ extension → lưu vào kho app.
  let got = 0, exported = false;
  for (const act of ['EXPORT_COOKIES', 'GET_COOKIES', 'EXPORT_COOKIE']){
    const r = await _tfBridgeTimed(act, {}, 8000);
    if (!r || r.error) continue;
    exported = true;
    const list = Array.isArray(r) ? r : (r.accounts || (r.cookies ? [r] : []));
    for (const it of list){
      const ck = it.cookies || it.cookie || (typeof it === 'string' ? it : null); if (!ck) continue;
      const em = (it.email || '').toLowerCase(); if (em && have.has(em)) continue;   // đã lưu rồi
      setNote('⏳ Đang lưu tài khoản… (mở phiên bắt token, chờ ~20s)', 'var(--violet)');
      try { const rr = await window.native.flow('ADD_ACCOUNT_COOKIE', { cookies: ck }); if (rr && !rr.error){ got++; if (rr.email) have.add(rr.email.toLowerCase()); } } catch (e) {}
    }
    break;
  }
  const total = saved + got;
  if (total > 0){
    setNote('✓ Đã lưu <b>' + total + '</b> tài khoản vào app — dùng lại được khi đổi trình duyệt (chọn chế độ <b>Tích hợp sẵn</b>).', 'var(--green)');
  } else if (!exported){
    setNote('⚠️ Extension chưa cho lấy cookie — hãy <b>Reload extension</b> (chrome://extensions → ⟳) rồi bấm <b>Quét lại</b>. Hoặc dùng <b>Tích hợp sẵn</b> để app tự giữ tài khoản.', 'var(--amber)');
  } else {
    setNote('⚠️ Chưa lưu được (cookie chưa hợp lệ / đã hết hạn). Đăng nhập lại tài khoản rồi Quét lại.', 'var(--amber)');
  }
}

function tfSetMode(m){
  flowBridge.setMode(m);
  tfSyncModeUI();
  const el = document.getElementById('tfConn');   // xóa bảng cũ ngay, tránh lẫn tài khoản 2 chế độ
  if (el) el.innerHTML = '';
  tfRenderExtStatus();
  tfRefreshConn();
  // Chuyển sang chế độ Extension → tự đẩy token sang extension (thay cho nút "Đẩy sang Extension" đã bỏ).
  if (m === 'extension' && window.native?.flowPushExt){ window.native.flowPushExt().catch(()=>{}); }
}

function tfSyncModeUI(){
  const m = flowBridge.mode;
  ['builtin','extension'].forEach(k => {
    const r = document.querySelector(`input[name="tfAuthMode"][value="${k}"]`);
    if (r) r.checked = (k === m);
    const card = document.getElementById('tfModeCard_' + k);
    if (card){ card.style.borderColor = (k === m) ? 'var(--accent)' : 'var(--border)'; card.style.background = (k === m) ? 'rgba(124,58,237,.05)' : 'transparent'; }
  });
  const addBtn = document.getElementById('tfAddBtn');
  if (addBtn) addBtn.textContent = (m === 'extension') ? '🌐 Mở Flow trong Chrome' : '＋ Thêm tài khoản Flow';
}

function tfRenderExtStatus(){
  const el = document.getElementById('tfExtStatus');
  if (!el) return;
  if (flowBridge.mode !== 'extension' || !window.native?.flowBridgeStatus){
    el.innerHTML = '';
    if (_tfExtPoll){ clearInterval(_tfExtPoll); _tfExtPoll = null; }
    return;
  }
  const tick = async () => {
    const s = await window.native.flowBridgeStatus().catch(() => null);
    const connected = !!s?.extensionConnected;
    if (connected) {
      // Extension cũ hơn bản đóng gói trong app → nhắc khách tải lại + reload.
      const outdated = s.extVersion && s.latestExtVersion && s.extVersion !== s.latestExtVersion;
      if (outdated) {
        el.innerHTML = `<div style="background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.5);border-radius:10px;padding:11px 13px">
            <div style="color:var(--amber);font-weight:700;font-size:13px;margin-bottom:8px">⚠️ Extension cũ (v${escapeHtml(s.extVersion)}) — đã có bản mới <b>v${escapeHtml(s.latestExtVersion)}</b>. Cập nhật 2 bước:</div>
            <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px">
              <button class="btn primary sm" onclick="tfDownloadExt()">⬇ 1 · Tải lại extension (ghi đè)</button>
              <button class="btn ghost sm" onclick="tfCopyExtUrl()">📋 Copy chrome://extensions</button>
            </div>
            <div style="font-size:12px;color:var(--text)"><b>2.</b> Vào <b>chrome://extensions</b> → bấm nút <b>⟳ (Reload)</b> trên AI Video Studio.</div>
          </div>`;
        return;
      }
      el.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.4);color:var(--green);padding:6px 12px;border-radius:8px;font-weight:600;font-size:13px">✅ Extension đã kết nối${s.extVersion ? ' (v' + escapeHtml(s.extVersion) + ')' : ''} — sẵn sàng chạy</div>`;
      return;
    }
    // Chưa kết nối → hiện hướng dẫn 4 bước rõ ràng cho khách.
    el.innerHTML = `
      <div style="background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:12px 14px">
        <div style="color:var(--amber);font-weight:700;font-size:13.5px;margin-bottom:10px">⚠️ Chưa kết nối extension — làm 4 bước dưới (chỉ lần đầu, ~2 phút)</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn primary sm" onclick="tfDownloadExt()">⬇ Bước 1 · Tải Extension</button>
          <button class="btn ghost sm" onclick="tfCopyExtUrl()">📋 Copy <b>chrome://extensions</b></button>
          <button class="btn ghost sm" onclick="tfScan()">↻ Quét lại</button>
        </div>
        <div style="color:var(--text);line-height:1.85;font-size:12.5px">
          <b>1.</b> Bấm <b>⬇ Bước 1 · Tải Extension</b> → chọn nơi lưu (app tự mở thư mục lên cho bạn).<br>
          <b>2.</b> Mở <b>Chrome</b> → bấm <b>📋 Copy chrome://extensions</b> ở trên → dán vào thanh địa chỉ Chrome → Enter.<br>
          <b>3.</b> Bật <b>Chế độ dành cho nhà phát triển</b> (nút gạt góc trên phải) → bấm <b>Tải tiện ích chưa đóng gói</b> → chọn thư mục vừa tải ở bước 1.<br>
          <b>4.</b> Mở 1 tab vào <b>labs.google/fx/tools/flow</b>, đăng nhập Google → quay lại đây, app <b>tự kết nối</b> (hoặc bấm ↻ Quét lại).
        </div>
        <div style="margin-top:9px;font-size:11.5px;color:var(--text-muted)">💡 Sau khi cập nhật app: vào <b>chrome://extensions</b> bấm nút <b>⟳ (Reload)</b> trên AI Video Studio để dùng bản mới.</div>
      </div>`;
  };
  tick();
  if (_tfExtPoll) clearInterval(_tfExtPoll);
  _tfExtPoll = setInterval(tick, 3000);
}

async function tfCopyExtUrl(){
  try { await navigator.clipboard.writeText('chrome://extensions'); setStatusF('✓ Đã copy "chrome://extensions" — dán vào thanh địa chỉ Chrome rồi Enter.', 'success'); }
  catch(e){ setStatusF('Copy lỗi — gõ tay: chrome://extensions', 'info'); }
}

async function tfDownloadExt(){
  if (!window.native?.flowExtExport){ setStatusF('Chức năng tải extension chỉ có trên bản app.', 'error'); return; }
  setStatusF('Đang xuất extension…', 'info');
  const r = await window.native.flowExtExport().catch((e) => ({ error: String(e) }));
  if (r?.canceled){ setStatusF('Đã huỷ.', 'info'); return; }
  if (r?.error){ setStatusF('Lỗi tải extension: ' + r.error, 'error'); return; }
  setStatusF('✓ Đã lưu extension vào: ' + (r.path || '') + ' — giờ mở chrome://extensions và "Tải tiện ích chưa đóng gói" trỏ vào thư mục này.', 'success');
}

function _flowAbort(on){ try { flowBridge.call('POOL_ABORT', { on: !!on }); } catch (e) {} }

function tfStop(){ tfState.stop = true; _flowAbort(true); setStatusF('⏸ Đang dừng ngay…', 'info'); }

function _tfRaceStop(promise){
  let settled = false;
  const p = Promise.resolve(promise).then(v => { settled = true; return v; }, e => { settled = true; return { error: (e && e.message) || String(e) }; });
  const stopP = new Promise(res => {
    const t = setInterval(() => {
      if (settled){ clearInterval(t); return; }
      if (tfState.stop){ clearInterval(t); res({ _stopped: true }); }
    }, 200);
  });
  return Promise.race([p, stopP]);
}

function _tfSleepStop(ms){
  return new Promise(res => {
    const end = Date.now() + ms;
    const t = setInterval(() => {
      if (tfState.stop){ clearInterval(t); res(true); }
      else if (Date.now() >= end){ clearInterval(t); res(false); }
    }, 200);
  });
}

async function tfPool(items, worker, limit, delayMs = 0){
  if (!tfState.stop) _flowAbort(false);   // bắt đầu mẻ mới (không phải sau khi bấm Dừng) → gỡ cờ abort backend còn sót từ lần Dừng trước
  let i = 0;
  const n = Math.min(limit, items.length);
  const _rand = (delayMs === -1);                                       // -1 = NGẪU NHIÊN 5–10s mỗi ảnh (né bot tốt nhất)
  const _base = _rand ? 7500 : delayMs;                                 // giá trị nền để rải nhịp khởi động
  const jitter = (ms) => ms > 0 ? Math.round(ms * (0.7 + Math.random() * 0.6)) : 0;   // ±30% cho tự nhiên
  const perImg = () => _rand ? (5000 + Math.floor(Math.random() * 5001)) : jitter(delayMs);   // 5000–10000ms nếu random
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const runners = Array.from({ length: n }, async (_v, k) => {
    if (_base > 0 && k > 0) await sleep(jitter(_base / n) * k);   // rải nhịp khởi động, đừng bắn cùng lúc
    while (!tfState.stop && i < items.length){
      const my = i++;
      await worker(items[my], my);
      if ((_rand || delayMs > 0) && !tfState.stop && i < items.length) await sleep(perImg());   // nghỉ giữa các ảnh
    }
  });
  await Promise.all(runners);
}

async function tfEnsureProject(){
  if (tfState.projectId) return tfState.projectId;
  const r = await flowBridge.call('CREATE_PROJECT', { title: 'AI Video Studio ' + new Date().toLocaleString('vi-VN') });
  if (r?.error || !r?.project_id) throw new Error('Không tạo được project: ' + (r?.error || '?'));
  tfState.projectId = r.project_id;
  return tfState.projectId;
}

function _tfImgSrc(img){
  if (!img) return '';
  return img.base64.startsWith('data:') ? img.base64 : ('data:' + (img.mediaType || 'image/png') + ';base64,' + img.base64);
}

function _slugId(s){ return String(s).replace(/[^a-zA-Z0-9]/g, '_'); }

function tfScenesWithPrompt(){
  if (!state.scenes) return [];
  // Cảnh ĐÃ có clip video (YouTube/stock) thì khỏi tạo ảnh AI — clip sẽ đè lên, tạo ảnh chỉ tốn quota Flow.
  const hasClip = (id) => { const pk = (state.mediaPicks || {})[id]; return !!(pk && pk.kind === 'video' && pk.downloadUrl); };
  return state.scenes.filter(s => state.scenePrompts && state.scenePrompts[s.id] && String(state.scenePrompts[s.id]).trim() && !hasClip(s.id));
}

function _tfSceneCard(id, variant){
  const store = variant === 'b' ? state.sceneImagesB : state.sceneImages;
  const src = _tfImgSrc(store?.[id]);
  const sid = escapeHtml(String(id));
  const isB = variant === 'b';
  const cardId = 'tf-scene-' + id + (isB ? 'b' : '');
  const vArg = isB ? "'b'" : "'a'";
  return `<div class="tf-card" id="${cardId}" style="border:1px solid ${isB ? 'var(--accent)' : 'var(--border)'};border-radius:10px;overflow:hidden;background:var(--surface)">
      <div class="tf-thumb" ${src ? `onclick="tfEnlargeScene('${sid}',${vArg})" ` : ''}style="aspect-ratio:16/9;background:#0002 center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);cursor:${src ? 'zoom-in' : 'default'}">${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">` : 'cảnh ' + sid + (isB ? ' B' : '')}</div>
      <div style="padding:6px;display:flex;gap:6px;align-items:center">
        <span style="flex:1;font-size:11px;color:var(--text-muted)">Cảnh ${sid}${isB ? ' <b style="color:var(--accent)">B</b>' : ''}</span>
        <button class="btn ghost sm" style="padding:2px 7px;font-size:13px" onclick="tfEnlargeScene('${sid}',${vArg})" title="Xem lớn">🔍</button>
        <button class="btn ghost sm" style="padding:2px 7px;font-size:13px" onclick="tfRegenScene('${sid}',${vArg})" title="Tạo lại">🔄</button>
      </div>
    </div>`;
}

function tfRenderScenes(){
  const info = document.getElementById('tfSceneInfo');
  const grid = document.getElementById('tfSceneGrid');
  if (!info || !grid) return;
  const withP = tfScenesWithPrompt();
  let bCount = 0, aImg = 0, bImg = 0, html = '';
  for (const s of withP){
    if (state.sceneImages && state.sceneImages[s.id]) aImg++;
    html += _tfSceneCard(s.id, 'a');
    const hasB = state.scenePrompts2 && state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim();
    if (hasB){ bCount++; if (state.sceneImagesB && state.sceneImagesB[s.id]) bImg++; html += _tfSceneCard(s.id, 'b'); }
  }
  const totalUnits = withP.length + bCount;
  info.innerHTML = `Có prompt: <b>${withP.length}</b> cảnh${bCount ? ` + <b>${bCount}</b> ảnh B` : ''} = <b>${totalUnits}</b> ảnh · Đã tạo: <b>${aImg + bImg}</b>`;
  grid.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px">Chưa có prompt cảnh nào. Chạy Tool 2 tạo prompt trước.</div>';
}

function tfEnlarge(src){
  if (!src) return;
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:24px';
  m.innerHTML = `<img src="${src}" style="max-width:96vw;max-height:92vh;border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,.6)">`;
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  m.onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
}

function tfEnlargeScene(id, variant){
  const store = variant === 'b' ? state.sceneImagesB : state.sceneImages;
  const src = _tfImgSrc(store?.[id]);
  if (!src) return setStatusF('Cảnh ' + id + (variant === 'b' ? ' B' : '') + ' chưa có ảnh.', 'info');
  tfEnlarge(src);
}

async function tfRegenScene(id, variant){
  // Báo trạng thái ra CẢ tab Flow lẫn Tool 2 (nút tạo lại nằm ở bảng cảnh Tool 2 → nếu chỉ setStatusF thì bấm không thấy gì).
  const _rs = (m, t) => { try { setStatusF(m, t); } catch (e) {} if (typeof setStatus2 === 'function') { try { setStatus2(m, t); } catch (e) {} } };
  if (tfState.running) { _rs('Đang chạy mẻ khác — đợi xong rồi tạo lại.', 'error'); return; }
  const isB = variant === 'b';
  const lbl = 'cảnh ' + id + (isB ? ' B' : '');
  const prompt = (isB ? state.scenePrompts2 : state.scenePrompts)?.[id];
  if (!prompt || !String(prompt).trim()) { _rs(lbl + ' chưa có prompt — bấm "Tạo prompt" ở tab Prompt ảnh trước.', 'error'); return; }
  _rs('🎨 Đang tạo lại ' + lbl + '… (~20–40s)', 'working');
  if (!(await flowBridge.waitReady(1500))) { _rs('Chưa thấy Flow. Vào Cài đặt bật/đăng nhập tài khoản Flow trước.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)) { _rs('Chưa kết nối Flow (chưa có tài khoản/token). Vào Cài đặt → Tài khoản Flow.', 'error'); return; }

  const cfg = tfCfg();
  const useRefs = !!document.getElementById('tfUseRefs')?.checked;
  const imgMap = tfAssetImageMap();
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  const thumb = document.getElementById('tf-scene-' + id + (isB ? 'b' : ''))?.querySelector('.tf-thumb');

  tfState.running = true; tfState.stop = false; tfState.projectId = null; tfState.uploaded = {};
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    if (thumb) { thumb.classList.remove('tf-fail'); thumb.textContent = '⏳'; }
    _rs('🔄 Đang tạo lại ' + lbl + '…', 'working');
    const refNames = useRefs ? tfExtractRefNames(prompt, imgMap) : [];
    const r = await tfDispatchGen(cleanPrompt(_t2WithPalette(prompt)), refNames, { multi, cfg, imgMap, projectId, tier: st.paygateTier });
    const e0 = (r?.media_entries || []).find(e => e.dataUrl);
    if (r?.error || !e0) { if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống'); _rs('Tạo lại ' + lbl + ' lỗi: ' + (r?.error || 'trống'), 'error'); }
    else {
      if (!state.sceneImages) state.sceneImages = {};
      if (!state.sceneImagesB) state.sceneImagesB = {};
      const store = isB ? state.sceneImagesB : state.sceneImages;
      store[id] = { base64: e0.dataUrl, mediaType: e0.mime || 'image/png', fileName: `scene-${id}${isB ? 'b' : ''}.png` };
      autoSaveSceneImage(id, isB, e0.dataUrl, e0.mime);
      saveState(true);
      if (typeof renderTable === 'function') renderTable();
      tfRenderScenes();
      _rs('✓ Đã tạo lại ' + lbl, 'ok');
    }
  } catch (e){ _rs('Lỗi tạo lại: ' + (e.message || e), 'error'); }
  finally { tfState.running = false; }
}

function tfEnlargeAsset(kind, name){
  const store = kind === 'char' ? state.characterImages : state.backgroundImages;
  const src = _tfImgSrc(store?.[name]);
  if (!src) return setStatusF(name + ' chưa có ảnh.', 'info');
  tfEnlarge(src);
}

async function tfRegenAsset(kind, name){
  if (tfState.running) { setStatusF('Đang chạy mẻ khác — đợi xong rồi tạo lại.', 'error'); return; }
  const prompt = (kind === 'char' ? state.assetCharPrompts : state.assetBgPrompts)?.[name];
  if (!prompt || !String(prompt).trim()) { setStatusF(name + ' chưa có prompt.', 'error'); return; }
  if (!(await flowBridge.waitReady(1500))) { setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)) { setStatusF('Chưa kết nối Flow.', 'error'); return; }

  const cfg = tfCfg();
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  const card = document.getElementById('tf-asset-' + kind + '-' + _slugId(name));
  const thumb = card?.querySelector('.tf-thumb');

  tfState.running = true; tfState.stop = false; tfState.projectId = null;
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    if (thumb) { thumb.classList.remove('tf-fail'); thumb.textContent = '⏳'; }
    setStatusF('🔄 Đang tạo lại ' + name + '…', 'working');
    // Lỗi MỀM (NO_ACCOUNTS do race, kẹt traffic/reCAPTCHA, token vừa hết) → tự thử lại vài lần, đừng fail ngay.
    let r, _tries = 0;
    while (true){
      r = await tfDispatchGen(cleanPrompt(prompt), [], { multi, cfg, projectId, tier: st.paygateTier });
      const soft = /NO_ACCOUNTS|TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki|UNAUTHENT|API_401|BRIDGE_TIMEOUT|\bTIMEOUT\b/i.test(String(r?.error || ''));
      if (!r?.error || !soft || _tries >= 3 || tfState.stop) break;
      _tries++;
      setStatusF('↻ ' + name + ' · ' + r.error + ' → thử lại (' + _tries + ')…', 'working');
      await new Promise(res => setTimeout(res, 1500 + _tries * 1500));
    }
    const e0 = (r?.media_entries || []).find(e => e.b64);
    if (r?.error || !e0) { if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống'); setStatusF('Tạo lại ' + name + ' lỗi: ' + (r?.error || 'trống'), 'error'); }
    else {
      if (kind === 'char') { if (!state.characterImages) state.characterImages = {}; }
      else { if (!state.backgroundImages) state.backgroundImages = {}; }
      const store = kind === 'char' ? state.characterImages : state.backgroundImages;
      store[name] = { base64: e0.b64, mediaType: e0.mime || 'image/png', fileName: name + '.png' };
      saveState(true);
      if (kind === 'char' && typeof renderCharImageGallery === 'function') renderCharImageGallery();
      tfRenderAssets();
      setStatusF('✓ Đã tạo lại ' + name, 'ok');
    }
  } catch (e){ setStatusF('Lỗi tạo lại: ' + (e.message || e), 'error'); }
  finally { tfState.running = false; }
}

function _refRoleNote(names){
  if (!names || !names.length) return '';
  return '\n\nREFERENCE IMAGES: The attached image(s) are REFERENCE SHEETS. A character model sheet shows the SAME character in several poses / a turnaround (and possibly a row of expression thumbnails); a location reference board shows the SAME place from several angles (e.g. a 2x2 grid of views). Use them ONLY to learn the IDENTITY, ARCHITECTURE, COLOUR PALETTE and ART STYLE of: '
    + names.join(', ')
    + '.\nHARD RULES for the image you generate:\n'
    + '- Produce ONE single scene exactly as described below, from ONE single camera angle. Do NOT reproduce any reference-sheet layout.\n'
    + '- Do NOT split the image into panels, tiles or a grid; do NOT draw multiple views / a 2x2 grid / a turnaround / a lineup; do NOT draw a row of expression thumbnails or a strip of faces; do NOT add borders, frames, captions or labels.\n'
    + '- Show each character only as many times as this scene needs (usually exactly once), and show each location as ONE continuous space seen from ONE viewpoint — fully integrated into the scene.\n'
    + '- For a person: keep the SAME face, hairstyle, age, body type, art style AND the SAME outfit/clothing (same garments, colours and accessories) as the reference across EVERY scene — only the POSE, ACTION and single facial expression change to fit this scene. Keep the character wearing the reference outfit for consistency UNLESS this scene\'s own text explicitly describes different clothing (e.g. it literally says pajamas / a raincoat), in which case follow the scene. Do NOT reproduce the sheet\'s layout or turnaround pose; render one single natural scene. Pick the ONE expression that fits the moment; never show several expressions.\n'
    + '- For a location: keep the same place, architecture, props and colour palette, but render it as ONE single natural establishing view for THIS scene — NOT a multi-angle sheet or grid.\n'
    + '- Keep line work, shading, colour palette and overall art style consistent with the reference.';
}

async function tfDispatchGen(prompt, refNames, o){
  if (o.multi){
    const refs = (refNames || []).map(n => {
      const img = o.imgMap[n]; if (!img) return null;
      const raw = img.base64.startsWith('data:') ? img.base64.split(',')[1] : img.base64;
      return { name: n, base64: raw, mime: img.mediaType || 'image/png' };
    }).filter(Boolean);
    // Có ref thật đính kèm → gán role trong prompt.
    const p = refs.length ? (prompt + _refRoleNote(refs.map(r => r.name))) : prompt;
    return flowBridge.call('POOL_GEN', { prompt: p, aspect: o.cfg.aspect, modelName: o.cfg.model, quality: o.cfg.quality, variantCount: 1, withData: true, refs });
  }
  let refMediaIds = [], okNames = [];
  for (const n of (refNames || [])){ const mid = await tfEnsureRefUploaded(n, o.projectId, o.imgMap); if (mid){ refMediaIds.push(mid); okNames.push(n); } }
  const p = refMediaIds.length ? (prompt + _refRoleNote(okNames)) : prompt;
  return flowBridge.call('GEN_IMAGE', { prompt: p, projectId: o.projectId, aspect: o.cfg.aspect, modelName: o.cfg.model, tier: o.tier, variantCount: 1, quality: o.cfg.quality, withData: true, refMediaIds });
}

function _t2PaletteSuffix(){
  const p = (typeof getProfile === 'function') ? getProfile() : null; if (!p) return '';
  const src = ((p.sceneStyle || '') + '. ' + (p.backgroundStyle || ''));
  const cl = src.split(/[\n.]/).map(s => s.trim()).filter(Boolean)
    .find(c => /(palette|colou?r|muted|desaturat|earthy|neon|saturat|somber|sepia|monochrom|nostalg)/i.test(c) && c.length > 12);
  if (!cl) return '';
  return cl.length > 160 ? cl.slice(0, 160).replace(/[\s,;:-]+\S*$/, '').trim() : cl;
}

function _t2WithPalette(prompt){
  let s = String(prompt || '');
  if (/consistent muted palette|consistent .*palette in every scene/i.test(s)) return s;   // đã có đuôi → khỏi lặp
  const pal = _t2PaletteSuffix();
  const palPart = pal ? `keep the same consistent muted ${pal} in every scene (never brighten/saturate to the setting); ` : 'keep a consistent muted palette across scenes; ';
  return s.replace(/\s*$/, '') + ` [${palPart}keep in-image text minimal.]`;
}

async function tfGenScenes(onlyMissing, opts){
  if (typeof gateTool==='function' && gateTool('toolflow')) return;
  if (tfState.running) return { skipped: true, reason: 'đang chạy' };
  const cfg = tfCfg();
  const shardN = Math.max(1, parseInt(document.getElementById('tfShardN')?.value) || 1);
  const shardK = Math.min(shardN, Math.max(1, parseInt(document.getElementById('tfShardK')?.value) || 1));
  const onlyIds = (opts && opts.onlyIds && opts.onlyIds.length) ? new Set(opts.onlyIds.map(String)) : null;   // giới hạn đúng các cảnh đã tick (Tạo lại đã chọn)
  const scenes = tfScenesWithPrompt().filter((s, i) => (shardN <= 1 || (i % shardN) === (shardK - 1)) && (!onlyIds || onlyIds.has(String(s.id))));
  // Đơn vị tạo: mỗi cảnh = ảnh A (+ ảnh B nếu cảnh có prompt B).
  const units = [];
  for (const s of scenes){
    const aP = state.scenePrompts?.[s.id];
    if (aP && String(aP).trim() && !(onlyMissing && state.sceneImages?.[s.id])) units.push({ id: s.id, variant: 'a', prompt: aP });
    const bP = state.scenePrompts2?.[s.id];
    if (bP && String(bP).trim() && !(onlyMissing && state.sceneImagesB?.[s.id])) units.push({ id: s.id, variant: 'b', prompt: bP });
  }
  if (!units.length){ setStatusF('Không có ảnh nào để tạo' + (shardN > 1 ? ` (máy ${shardK}/${shardN})` : '') + '.', 'error'); return { skipped: true, reason: 'không có cảnh' }; }
  if (!(await flowBridge.waitReady(1500))){ setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return { skipped: true, reason: 'chưa cài extension' }; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)){ setStatusF('Chưa kết nối Flow. Mở tab Flow + đăng nhập rồi Quét lại.', 'error'); return { skipped: true, reason: 'chưa đăng nhập Flow' }; }
  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)

  tfState.running = true; tfState.stop = false; tfState.projectId = null; tfState.uploaded = {};
  const useRefs = !!document.getElementById('tfUseRefs')?.checked;
  const imgMap = tfAssetImageMap();
  console.log('[Flow] Ảnh asset dùng làm tham chiếu:', Object.keys(imgMap));
  // ⚠️ Tag trong prompt mà KHÔNG có ảnh tham chiếu → trước đây bỏ qua im lặng, ảnh
  // ra không có nhân vật hoặc mỗi cảnh một người. Đếm và báo trước khi chạy.
  if (useRefs){
    const miss = {};
    units.forEach(u => (typeof _t2TagsIn === 'function' ? _t2TagsIn(u.prompt) : []).forEach(t => {
      const has = imgMap[t] || Object.keys(imgMap).some(k => k === t || k.startsWith(t + '-') || t.startsWith(k + '-'));
      if (!has) miss[t] = (miss[t] || 0) + 1;
    }));
    const names = Object.keys(miss).sort((a, b) => miss[b] - miss[a]);
    if (names.length){
      const top = names.slice(0, 4).map(n => `[${n}]×${miss[n]}`).join(', ');
      const msg = `⚠️ ${names.length} tag không có ảnh tham chiếu: ${top}${names.length > 4 ? '…' : ''} — các cảnh này sẽ vẽ người KHÁC nhau. Bấm 🔧 Sửa tag lạ ở Phân Cảnh.`;
      setStatusF(msg, 'error');
      if (typeof novaLog === 'function') novaLog(msg, 'warn');
      console.warn('[Flow] tag thiếu ảnh tham chiếu:', miss);
    }
  }
  let done = 0, err = 0, refUsed = 0, lastErr = '';
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    // Số luồng = số tài khoản (1 request/account), NHƯNG lấy ô "Luồng song song" làm MỨC TRẦN:
    // bạn để 3 → tối đa 3 account chạy cùng lúc dù có 6 → xin token reCAPTCHA thưa hơn, ít lỗi UNUSUAL_ACTIVITY.
    const conc = multi ? Math.min(Math.max(1, st.accountCount), Math.max(1, cfg.conc || st.accountCount)) : cfg.conc;
    if (!state.sceneImages) state.sceneImages = {};
    if (!state.sceneImagesB) state.sceneImagesB = {};
    const nRef = Object.keys(imgMap).length;
    setStatusF(`Đang tạo ${units.length} ảnh (A+B)…${shardN > 1 ? ` [máy ${shardK}/${shardN}]` : ''}${multi ? ` (⚡ ${st.accountCount} tài khoản)` : ''}${useRefs && nRef ? ` +tham chiếu` : ''}`, 'working');
    if (typeof novaLog === 'function'){ novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc'); novaLog('▶ Tạo ' + units.length + ' ẢNH CẢNH' + (multi ? ' · ' + st.accountCount + ' tài khoản' : '') + (useRefs && nRef ? ' · tham chiếu ' + nRef + ' asset' : ''), 'acc'); }
    const _hasImg = (u) => !!((u.variant === 'b' ? state.sceneImagesB : state.sceneImages)?.[u.id]);
    let hadRetryable = false;
    const _genUnit = async (u) => {
      const thumb = document.getElementById('tf-scene-' + u.id + (u.variant === 'b' ? 'b' : ''))?.querySelector('.tf-thumb');
      if (thumb) thumb.textContent = '⏳';
      const refNames = useRefs ? tfExtractRefNames(u.prompt, imgMap) : [];
      if (refNames.length) { refUsed++; console.log('[Flow] cảnh ' + u.id + (u.variant === 'b' ? 'B' : '') + ' → đính tham chiếu:', refNames); }
      const _lbl = 'Cảnh ' + u.id + (u.variant === 'b' ? 'B' : '');
      if (typeof novaLog === 'function') novaLog('🖼 ' + _lbl + ' · gửi prompt' + (refNames.length ? ' + ref [' + refNames.join(', ') + ']' : '') + ' → đang tạo…', 'acc');
      if (tfState.stop){ if (thumb) thumb.textContent = '⏸'; return; }   // bấm Dừng trước khi tới lượt → bỏ qua, khỏi gọi gen
      let r, e0, _att = 0;
      while (true){
        // Đua lượt gen (xoay account + captcha, có thể lâu) với cờ Dừng → bấm Dừng là thoát NGAY.
        r = await _tfRaceStop(tfDispatchGen(cleanPrompt(_t2WithPalette(u.prompt || '')), refNames, { multi, cfg, imgMap, projectId, tier: st.paygateTier }));
        if (r && r._stopped){ if (thumb) thumb.textContent = '⏸'; return; }   // đã dừng → KHÔNG tính lỗi/xong cho cảnh này
        e0 = (r?.media_entries || []).find(e => e.dataUrl);
        // Lỗi MỀM (Internal error / mạng / server / bị Google chặn traffic) — không phải quota/lọc/hết phiên → tự thử lại tối đa 3 lần.
        const soft = !e0 && r?.error && !_isQuotaErr(r.error) && !/FILTER|SAFETY|PROMINENT|UNAUTHENT|API_401|MODEL_ACCESS/i.test(String(r.error));
        const traffic = /TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki/i.test(String(r?.error || ''));
        if (e0 || !soft || _att >= (traffic ? 3 : 2) || tfState.stop) break;
        _att++;
        const wait = traffic ? (6000 + _att * 4000) : 1500;   // bị Google chặn/token chập → NGHỈ LÂU (6-14s) cho "nguội" rồi mới thử; lỗi thường 1.5s.
        if (typeof novaLog === 'function') novaLog('↻ ' + _lbl + ' lỗi mềm (' + _bulkFriendlyErr(String(r.error)) + ') → nghỉ ' + Math.round(wait / 1000) + 's rồi thử lại lần ' + _att + '…', 'warn');
        if (await _tfSleepStop(wait)) break;   // nghỉ nhưng bấm Dừng là thoát ngay
      }
      if (Array.isArray(r?.rotated) && typeof novaLog === 'function') for (const ex of r.rotated) novaLog('⚠️ ' + ex + ' hết lượt → chuyển ' + _lbl + ' sang ' + (r.account || 'tài khoản khác'), 'warn');
      if (r?.error || !e0){
        err++; if (r?.error) lastErr = r.error; if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống');
        if (r?.error && !_isQuotaErr(r.error) && !/FILTER|SAFETY|PROMINENT|MODEL_ACCESS/i.test(String(r.error))) hadRetryable = true;   // lỗi TẠM (traffic/reCAPTCHA/mạng…) → cho phép quét lại
        if (typeof novaLog === 'function'){ const q = _isQuotaErr(r?.error || ''); novaLog((q ? '⚠️ ' : '❌ ') + _lbl + ' · ' + (r?.account ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (r?.error ? _bulkFriendlyErr(String(r.error)) : 'không có ảnh trả về (token hết hạn? bị lọc? — quét lại token ở Cài đặt)')), q ? 'warn' : 'err'); }
      }
      else {
        const store = u.variant === 'b' ? state.sceneImagesB : state.sceneImages;
        store[u.id] = { base64: e0.dataUrl, mediaType: e0.mime || 'image/png', fileName: `scene-${u.id}${u.variant === 'b' ? 'b' : ''}.png` };
        autoSaveSceneImage(u.id, u.variant === 'b', e0.dataUrl, e0.mime);
        done++;
        if (thumb) thumb.innerHTML = `<img src="${e0.dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
        if (typeof novaLog === 'function') novaLog('✅ ' + _lbl + ' · tài khoản ' + (r?.account || '?') + ' · thành công' + (refNames.length ? ' (có ref)' : ''), 'ok');
      }
      setStatusF(`Cảnh: ${done} xong · ${err} lỗi · còn ${units.length - done - err}`, 'working');
      if (tfState.onProgress) tfState.onProgress({ done, err, total: units.length });
    };
    // 🔁 TỰ ĐỘNG quét lại ảnh CÒN THIẾU do lỗi TẠM (traffic/reCAPTCHA/mạng) → nghỉ dài cho "nguội" rồi tạo lại,
    //    tối đa vài vòng. KHÔNG lặp nếu chỉ còn lỗi cứng (bị lọc/hết quota) → tránh chạy vô ích.
    let pending = units, sweep = 0;
    const MAX_SWEEP = (opts && opts.maxSweep != null) ? opts.maxSweep : 4;
    while (true){
      hadRetryable = false;
      await tfPool(pending, _genUnit, conc, cfg.delay || 0);
      const missing = units.filter(u => !_hasImg(u));
      if (!missing.length || tfState.stop || sweep >= MAX_SWEEP || !hadRetryable) break;
      sweep++;
      const wait = 12000 + sweep * 6000;   // 18s → 24s → 30s → 36s: nghỉ tăng dần cho Google hạ cờ "unusual traffic"
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missing.length} ảnh thiếu (lỗi tạm) → tự nghỉ ${Math.round(wait/1000)}s rồi tạo lại · vòng ${sweep}/${MAX_SWEEP}`, 'warn');
      setStatusF(`Còn ${missing.length} ảnh thiếu → nghỉ ${Math.round(wait/1000)}s rồi TỰ tạo lại (vòng ${sweep}/${MAX_SWEEP})…`, 'working');
      if (await _tfSleepStop(wait)) break;   // đang nghỉ giữa 2 vòng mà bấm Dừng → thoát ngay
      if (multi){ try { await flowBridge.call('POOL_RESET'); } catch (e) {} }
      pending = missing;
    }
    done = units.filter(_hasImg).length; err = units.length - done;   // chốt theo state (tránh đếm trùng qua nhiều vòng)
    if (typeof novaLog === 'function') novaLog('━━━ ' + (tfState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' ảnh cảnh · ' + done + '/' + units.length + (err ? ' · ' + err + ' lỗi' : '') + (refUsed ? ' · ' + refUsed + ' có ref' : '') + (sweep ? ' · ' + sweep + ' vòng quét lại' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
    saveState(true);
    if (typeof renderTable === 'function') renderTable();
    tfRenderScenes();
    const refNote = useRefs ? (refUsed ? ` · 🔗 ${refUsed} ảnh có tham chiếu` : (Object.keys(imgMap).length ? ' · ⚠️ 0 ảnh khớp tham chiếu (tag không trùng tên asset?)' : ' · (chưa có ảnh asset để tham chiếu)')) : '';
    setStatusF(tfState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh cảnh${err ? `, ${err} lỗi` : ''}${refNote}`, err ? 'error' : 'ok');
    notifyDone('✓ Tạo ảnh cảnh xong', `${done} ảnh, ${err} lỗi.`);
    return { done, err, refUsed, lastErr };
  } catch (e){ setStatusF('Lỗi: ' + e.message, 'error'); return { done, err, error: e.message, lastErr: lastErr || e.message }; }
  finally { tfState.running = false; }
}

function tfAssetList(kind){
  const arr = kind === 'char' ? (state.charactersV || []) : (state.backgroundsV || []);
  const promptMap = kind === 'char' ? state.assetCharPrompts : state.assetBgPrompts;
  return arr.map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
    .map(n => ({ name: n, prompt: promptMap?.[n] }));
}

function tfRenderAssets(){
  const info = document.getElementById('tfAssetInfo');
  const grid = document.getElementById('tfAssetGrid');
  if (!info || !grid) return;
  const chars = tfAssetList('char'), bgs = tfAssetList('bg');
  info.innerHTML = `Nhân vật: <b>${chars.filter(c => c.prompt).length}</b> có prompt · Bối cảnh: <b>${bgs.filter(c => c.prompt).length}</b> có prompt`;
  const all = chars.map(c => ({ ...c, kind: 'char' })).concat(bgs.map(c => ({ ...c, kind: 'bg' })));
  grid.innerHTML = all.map(a => {
    const store = a.kind === 'char' ? state.characterImages : state.backgroundImages;
    const src = _tfImgSrc(store?.[a.name]);
    const njs = String(a.name).replace(/['\\]/g, '\\$&');
    return `<div class="tf-card" id="tf-asset-${a.kind}-${_slugId(a.name)}" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
      <div class="tf-thumb" ${src ? `onclick="tfEnlargeAsset('${a.kind}','${njs}')" ` : ''}style="aspect-ratio:1;background:#0002 center/cover;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);cursor:${src ? 'zoom-in' : 'default'}">${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">` : (a.prompt ? '' : 'thiếu prompt')}</div>
      <div style="padding:6px;display:flex;gap:4px;align-items:center">
        <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.kind === 'char' ? '👤' : '🏞'} ${escapeHtml(a.name)}</span>
        <button class="btn ghost sm" style="padding:2px 6px;font-size:12px" onclick="tfEnlargeAsset('${a.kind}','${njs}')" title="Xem lớn">🔍</button>
        <button class="btn ghost sm" style="padding:2px 6px;font-size:12px" onclick="tfRegenAsset('${a.kind}','${njs}')" title="Tạo lại">🔄</button>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:12px">Chưa có nhân vật/bối cảnh. Chạy Tool 3 trước.</div>';
}

async function tfGenAssets(kind, onlyMissing){
  if (typeof gateTool==='function' && gateTool('toolflow')) return;
  if (tfState.running) return { skipped: true, reason: 'đang chạy' };
  const cfg = tfCfg();
  const store0 = kind === 'char' ? (state.characterImages || {}) : (state.backgroundImages || {});
  // onlyMissing: chỉ tạo asset CHƯA có ảnh (dùng để retry ảnh tham chiếu lỗi, khỏi đốt lại credit).
  const list = tfAssetList(kind).filter(a => a.prompt && String(a.prompt).trim() && (!onlyMissing || !store0?.[a.name]?.base64));
  if (!list.length){ setStatusF('Không có ' + (kind === 'char' ? 'nhân vật' : 'bối cảnh') + ' có prompt.', 'error'); return { skipped: true, reason: 'không có prompt' }; }
  if (!(await flowBridge.waitReady(1500))){ setStatusF('Chưa thấy extension AI Video Studio.', 'error'); return { skipped: true, reason: 'chưa cài extension' }; }
  const st = await flowBridge.call('GET_STATUS');
  if (!_flowStOk(st)){ setStatusF('Chưa kết nối Flow. Mở tab Flow + đăng nhập rồi Quét lại.', 'error'); return { skipped: true, reason: 'chưa đăng nhập Flow' }; }

  const multi = (st.accountCount || 0) > 1;   // luôn dùng nhiều tài khoản khi có >1 account (chia + song song + tự né quota)
  tfState.running = true; tfState.stop = false; tfState.projectId = null;
  let done = 0, err = 0, lastErr = '';
  try {
    let projectId = null;
    if (multi) await flowBridge.call('POOL_RESET');
    else projectId = await tfEnsureProject();
    // Số luồng = số tài khoản (1 request/account), NHƯNG lấy ô "Luồng song song" làm MỨC TRẦN:
    // bạn để 3 → tối đa 3 account chạy cùng lúc dù có 6 → xin token reCAPTCHA thưa hơn, ít lỗi UNUSUAL_ACTIVITY.
    const conc = multi ? Math.min(Math.max(1, st.accountCount), Math.max(1, cfg.conc || st.accountCount)) : cfg.conc;
    if (kind === 'char'){ if (!state.characterImages) state.characterImages = {}; }
    else { if (!state.backgroundImages) state.backgroundImages = {}; }
    setStatusF(`Đang tạo ${list.length} ảnh…${multi ? ` (⚡ ${st.accountCount} tài khoản)` : ''}`, 'working');
    if (typeof novaLog === 'function'){ novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc'); novaLog('▶ Tạo ' + list.length + ' ảnh ' + (kind === 'char' ? 'NHÂN VẬT' : 'BỐI CẢNH') + (multi ? ' · ' + st.accountCount + ' tài khoản' : ''), 'acc'); }
    await tfPool(list, async (a) => {
      const card = document.getElementById('tf-asset-' + kind + '-' + _slugId(a.name));
      const thumb = card?.querySelector('.tf-thumb');
      if (thumb) thumb.textContent = '⏳';
      if (typeof novaLog === 'function') novaLog('🖼 ' + a.name + ' · gửi prompt → đang tạo…', 'acc');
      // Lỗi MỀM (NO_ACCOUNTS do race song song, kẹt traffic/reCAPTCHA, token vừa hết) → tự thử lại vài lần, đừng bỏ ảnh.
      let r, _tries = 0;
      while (true){
        r = await tfDispatchGen(cleanPrompt(a.prompt), [], { multi, cfg, projectId, tier: st.paygateTier });
        const soft = /NO_ACCOUNTS|TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki|UNAUTHENT|API_401|BRIDGE_TIMEOUT|\bTIMEOUT\b/i.test(String(r?.error || ''));
        if (!r?.error || !soft || _tries >= 3 || tfState.stop) break;
        _tries++;
        if (typeof novaLog === 'function') novaLog('↻ ' + a.name + ' · ' + r.error + ' → thử lại (' + _tries + ')…', 'warn');
        await new Promise(res => setTimeout(res, 1500 + _tries * 1500));
      }
      const e0 = (r?.media_entries || []).find(e => e.b64);
      if (Array.isArray(r?.rotated) && typeof novaLog === 'function') for (const ex of r.rotated) novaLog('⚠️ ' + ex + ' hết lượt → chuyển ' + a.name + ' sang ' + (r.account || 'tài khoản khác'), 'warn');
      if (r?.error || !e0){
        err++; if (r?.error) lastErr = r.error; if (thumb) thumb.textContent = '✗ ' + (r?.error || 'trống');
        if (typeof novaLog === 'function'){ const q = _isQuotaErr(r?.error || ''); novaLog((q ? '⚠️ ' : '❌ ') + a.name + ' · ' + (r?.account ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết quota → chuyển tài khoản' : (r?.error ? _bulkFriendlyErr(String(r.error)) : 'không có ảnh trả về (token hết hạn? bị lọc? — quét lại token ở Cài đặt)')), q ? 'warn' : 'err'); }
      }
      else {
        const store = kind === 'char' ? state.characterImages : state.backgroundImages;
        store[a.name] = { base64: e0.b64, mediaType: e0.mime || 'image/png', fileName: a.name + '.png' };
        // Lưu ảnh nhân vật/bối cảnh về máy theo TÊN đã đặt (nếu bật auto-save).
        try { const ext = ((e0.mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg'); autoSaveMedia(_slug(a.name) + '.' + ext, 'data:' + (e0.mime || 'image/png') + ';base64,' + e0.b64, 'anh'); } catch (e) {}
        done++;
        if (thumb) thumb.innerHTML = `<img src="${e0.dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
        if (typeof novaLog === 'function') novaLog('✅ ' + a.name + ' · tài khoản ' + (r?.account || '?') + ' · thành công', 'ok');
      }
      setStatusF(`${done} xong · ${err} lỗi · còn ${list.length - done - err}`, 'working');
      if (tfState.onProgress) tfState.onProgress({ done, err, total: list.length });
    }, conc, cfg.delay || 0);
    if (typeof novaLog === 'function') novaLog('━━━ ' + (tfState.stop ? '■ Đã dừng' : '✔ Hoàn tất') + ' asset ' + (kind === 'char' ? 'nhân vật' : 'bối cảnh') + ' · ' + done + '/' + list.length + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
    saveState(true);
    if (kind === 'char' && typeof renderCharImageGallery === 'function') renderCharImageGallery();
    if (kind === 'char' && typeof renderAssetCharPrompts === 'function' && state.charactersV) renderAssetCharPrompts(state.charactersV);
    tfRenderAssets();
    setStatusF(tfState.stop ? `Đã dừng. ${done} ảnh.` : `✓ Xong ${done} ảnh${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
    notifyDone('✓ Tạo ảnh asset xong', `${done} ảnh, ${err} lỗi.`);
    return { done, err, lastErr };
  } catch (e){ setStatusF('Lỗi: ' + e.message, 'error'); return { done, err, error: e.message, lastErr: lastErr || e.message }; }
  finally { tfState.running = false; }
}

