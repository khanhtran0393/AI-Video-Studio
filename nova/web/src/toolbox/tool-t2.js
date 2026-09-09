/* AUTO-EXTRACTED from index.html block 3 - prefix: t2 */

function t2HandleSceneImage(sceneId, file){
  if (!file) return;
  if (!file.type.startsWith('image/')) return setStatus2('File phải là ảnh.', 'error');
  if (file.size > 5 * 1024 * 1024) return setStatus2('Ảnh > 5MB, dùng ảnh nhỏ hơn.', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    if (!state.sceneImages) state.sceneImages = {};
    state.sceneImages[sceneId] = {
      base64: e.target.result,
      mediaType: file.type,
      fileName: file.name
    };
    renderTable();
    if (typeof _t7NotifyImage === 'function') _t7NotifyImage(sceneId);   // đấu ảnh sang Dựng Video ngay
    saveState(true);
    setStatus2(`✓ Đã thêm ảnh cảnh ${sceneId}.`, 'ok');
  };
  reader.onerror = () => setStatus2('Lỗi đọc file ảnh.', 'error');
  reader.readAsDataURL(file);
}

function t2RemoveSceneImage(sceneId, variant){
  const store = variant === 'b' ? state.sceneImagesB : state.sceneImages;
  if (!store?.[sceneId]) return;
  delete store[sceneId];
  renderTable();
  saveState(true);
  setStatus2(`✓ Đã xoá ảnh cảnh ${sceneId}${variant === 'b' ? ' (B)' : ''}.`, 'ok');
}

function t2EnlargeSceneImage(sceneId, variant){
  const img = (variant === 'b' ? state.sceneImagesB : state.sceneImages)?.[sceneId];
  if (!img) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:30px';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `<div style="position:relative;max-width:90%;max-height:90%">
    <img src="${img.base64}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px;display:block">
    <div style="position:absolute;bottom:-30px;left:0;right:0;text-align:center;color:#fff;font-size:13px">Cảnh ${sceneId} · ${escapeHtml(img.fileName || '')}</div>
  </div>`;
  document.body.appendChild(modal);
}

function t2BulkUploadSceneImages(files){
  if (!files || files.length === 0) return;
  const imgFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (imgFiles.length === 0) return setStatus2('Không có ảnh hợp lệ.', 'error');
  imgFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const sceneIds = state.scenes.map(s => s.id);
  if (imgFiles.length > sceneIds.length) {
    if (!confirm(`Có ${imgFiles.length} ảnh nhưng chỉ ${sceneIds.length} cảnh. Chỉ assign cho ${sceneIds.length} cảnh đầu, bỏ qua ảnh thừa. Tiếp tục?`)) return;
  }
  setStatus2(`Đang gán ${Math.min(imgFiles.length, sceneIds.length)} ảnh...`, 'working');
  if (!state.sceneImages) state.sceneImages = {};
  let done = 0;
  const total = Math.min(imgFiles.length, sceneIds.length);
  for (let i = 0; i < total; i++) {
    const sid = sceneIds[i];
    const f = imgFiles[i];
    const reader = new FileReader();
    reader.onload = e => {
      state.sceneImages[sid] = { base64: e.target.result, mediaType: f.type, fileName: f.name };
      done++;
      if (done === total) {
        renderTable();
        saveState(true);
        setStatus2(`✓ Đã gán ${total} ảnh cho ${total} cảnh đầu.`, 'ok');
      }
    };
    reader.readAsDataURL(f);
  }
}

function t2AnalyzeToggle(){
  const b = document.getElementById('t2AnalyzeBtn');
  if (b && b.dataset.run){ if (typeof requestCancel === 'function') requestCancel(); if (typeof setStatus2 === 'function') setStatus2('⏸ Đang dừng sau bước hiện tại…', 'info'); }
  else if (typeof t2StoryboardAI === 'function') t2StoryboardAI();
}

async function t2TimingFromAudio(){
  const af = (typeof t8State === 'object' && t8State && t8State.audioFile)
    || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile) || null;
  if (!af) return setStatus2('Cần đính MP3 giọng đọc trước.', 'error');
  if (typeof _autoAlignAudioOnce !== 'function') return setStatus2('Chưa sẵn sàng căn timing.', 'error');
  const btn = document.getElementById('t2AsrBtn'); if (btn) btn.disabled = true;
  try {
    if (typeof _autoAudioFile !== 'undefined' && _autoAudioFile !== af){ _autoAudioFile = af; _autoAudioWords = null; }
    const prov = (typeof _whisperProviderAuto === 'function') ? _whisperProviderAuto() : 'local';
    setStatus2(`🎤 Đang căn timing theo giọng đọc (Whisper ${prov})…`, 'working');
    const n = await _autoAlignAudioOnce();
    if (n == null) return setStatus2('⚠️ Whisper chưa transcribe được — vẫn dùng ước lượng theo chữ. Kiểm key Groq ở Cài đặt.', 'error');
    if (typeof saveState === 'function') saveState(true);
    if (typeof renderAllT2 === 'function') renderAllT2();
    const msg = `✓ Căn timing theo giọng đọc (${prov}): ${n}/${(state.scenes || []).length} cảnh khớp.`;
    setStatus2(msg, 'ok');
    if (typeof novaLog === 'function') novaLog(msg, 'ok');
  } catch (e) {
    setStatus2('⚠️ ' + (e.message || e), 'error');
  } finally { if (btn) btn.disabled = false; }
}

function t2FitAudioNow(){
  const r = _t2FitToAudio();
  if (!r) return setStatus2('Chưa có audio để căn (đính MP3 giọng đọc trước).', 'error');
  if (!r.diff) return setStatus2('✓ Cảnh đã khớp audio.', 'ok');
  if (typeof saveState === 'function') saveState(true);
  if (typeof renderAllT2 === 'function') renderAllT2();
  const f = x => Math.floor(x / 60) + ':' + String(Math.round(x % 60)).padStart(2, '0');
  const msg = `✓ Đã khớp audio: ${f(r.before)} → ${f(r.after)} (bù ${r.diff > 0 ? '-' : '+'}${Math.abs(r.diff).toFixed(1)}s chia đều ${(state.scenes || []).length} cảnh).`;
  setStatus2(msg, 'ok');
  if (typeof novaLog === 'function') novaLog(msg, 'ok');
}

function t2ToggleNguon(id){
  const b = _t2NguonBat();
  b[id] = !b[id];
  t2RenderNguon();
  try { if (typeof saveState === 'function') saveState(); } catch (e) {}
}

function t2ToggleTiLeAuto(){
  state.t2TiLeNgoai = (_t2TiLeNgoai() === null) ? 50 : null;
  t2RenderTiLe();
  try { if (typeof saveState === 'function') saveState(); } catch (e) {}
}

function t2SetTiLe(v){
  state.t2TiLeNgoai = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  t2RenderTiLe();
  try { if (typeof saveState === 'function') saveState(); } catch (e) {}
}

function t2SetLuong(v){
  const n = Math.max(1, Math.min(6, Number(v) || _T2_LUONG_MAC_DINH));
  state.t2SoLuong = n;
  try { if (typeof saveState === 'function') saveState(); } catch (e) {}
}

function t2RenderTiLe(){
  const box = document.getElementById('t2TiLeBox'); if (!box) return;
  const b = _t2NguonBat();
  const soBat = _T2_NGUON_DS.filter(n => _T2_NGUON_HIEN.includes(n.id) && b[n.id]).length;
  box.style.display = soBat ? '' : 'none';
  if (!soBat) return;

  const tay = _t2TiLeNgoai();
  const auto = tay === null;
  const nut = document.getElementById('t2TiLeAuto');
  if (nut){
    nut.style.borderColor = auto ? 'var(--accent)' : 'var(--border-2)';
    nut.style.background  = auto ? 'var(--accent-soft)' : 'var(--surface)';
    nut.style.color       = auto ? 'var(--accent)' : 'var(--text-muted)';
  }
  // Ở chế độ tự động: hiện con số AI SẼ dùng (nếu đã chia cảnh) để không phải đoán.
  const sc = (state.scenes || []);
  const _uoc = sc.length ? Math.min(80, Math.max(35, Math.round(sc.filter(s => s.thuc).length / sc.length * 100))) : null;
  const pct = auto ? (_uoc === null ? 50 : _uoc) : tay;

  const sl = document.getElementById('t2TiLeSlider');
  if (sl){ sl.value = pct; sl.disabled = auto; sl.style.opacity = auto ? '.45' : '1'; sl.style.cursor = auto ? 'not-allowed' : 'pointer'; }

  const sel = document.getElementById('t2SoLuong');
  if (sel) sel.value = String(_t2SoLuong());

  const doc = document.getElementById('t2TiLeDoc');
  if (doc){
    const canh = (n) => sc.length ? `~${Math.round(sc.length * n / 100)} cảnh` : '&nbsp;';
    doc.innerHTML =
      `<span style="color:var(--text-muted);line-height:1.35">🎨 Ảnh AI <b style="color:var(--text)">${100 - pct}%</b>` +
        `<br><span style="color:var(--text-dim);font-size:10px">${canh(100 - pct)}</span></span>` +
      `<span style="color:var(--text-muted);line-height:1.35;text-align:right">🎞 Ngoài <b style="color:var(--accent)">${pct}%</b>` +
        `<br><span style="color:var(--text-dim);font-size:10px">${canh(pct)}</span></span>`;
  }
}

function t2RenderNguon(){
  const box = document.getElementById('t2NguonChips'); if (!box) return;
  const b = _t2NguonBat();
  box.innerHTML = _T2_NGUON_DS.filter(n => _T2_NGUON_HIEN.includes(n.id)).map(n => {
    const on = !!b[n.id];
    return `<button type="button" onclick="t2ToggleNguon('${n.id}')" title="${escapeHtml(n.mo)}"
      style="display:inline-flex;align-items:center;gap:5px;border-radius:9px;padding:7px 11px;font-size:12px;
        font-weight:650;cursor:pointer;white-space:nowrap;
        border:1px solid ${on ? 'var(--accent)' : 'var(--border-2)'};
        background:${on ? 'var(--accent-soft)' : 'var(--surface-2)'};
        color:${on ? 'var(--accent)' : 'var(--text-muted)'}">
      <span style="font-size:13px">${n.icon}</span>${n.ten}</button>`;
  }).join('');
  // 🌐 Nguồn web có 55 nền tảng nên cần bảng riêng — chip chỉ bật/tắt cả cụm.
  if (b.web && typeof webMoBang === 'function'){
    const dsBat = (typeof _webDangBat === 'function') ? _webDangBat() : [];
    box.insertAdjacentHTML('beforeend', `<button type="button" onclick="webMoBang()"
      title="Chọn trong 55 nền tảng: kho ảnh/video sẵn, YouTube, tư liệu công, báo đài…"
      style="display:inline-flex;align-items:center;gap:5px;border-radius:9px;padding:7px 11px;font-size:12px;
        font-weight:650;cursor:pointer;white-space:nowrap;border:1px dashed var(--accent);
        background:transparent;color:var(--accent)">⚙ ${dsBat.length}/${(window.NOVA_WEB_NEN_TANG||[]).length} nền tảng</button>`);
  }
  const soBat = _T2_NGUON_DS.filter(n => _T2_NGUON_HIEN.includes(n.id) && b[n.id]).length;
  const note = document.getElementById('t2NguonNote');
  // Không còn ô "Loại stock" nên cũng hết cảnh báo về nó: mỗi cảnh tự chọn
  // ảnh hay video theo kiểu cảnh (xem _t2LoaiMedia).
  // Bỏ dòng nhắc bản quyền theo yêu cầu — chỉ giữ trạng thái khi CHƯA bật nguồn nào.
  if (note) note.innerHTML = soBat ? '' : 'Tất cả cảnh dùng ảnh AI. Bật thêm nguồn để AI xen hình thật vào cảnh hợp.';
  t2RenderTiLe();

}

async function t2StoryboardAI(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  syncTool2();
  const txt = (state.script || '').trim();
  if (!txt) return setStatus2('⚠️ Chưa có kịch bản. Dán kịch bản vào ô Bước 1 rồi thử lại.', 'error');
  // BẮT BUỘC có MP3 giọng đọc để căn timing chính xác (không cho chạy nếu thiếu)
  const af = (typeof t8State === 'object' && t8State && t8State.audioFile) || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile) || null;
  if (!af) return setStatus2('⚠️ Cần đính MP3 giọng đọc để căn timing. Bấm 🎵 "Đính MP3 căn timing" ở Bước 1 rồi thử lại.', 'error');
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const secMin = Math.max(2, parseInt(document.getElementById('minSecPerImg')?.value) || 3);
  const secMax = Math.max(secMin + 1, parseInt(document.getElementById('maxSecPerImg')?.value) || 15);
  const secAvg = Math.round((secMin + secMax) / 2);
  // Style anchor GỌN cho cảnh (BỎ characterStyle 300 từ — cái đó thuộc ref nhân vật, nhồi vào đây gây trôi style).
  const style = [p?.visualStyle, p?.sceneStyle, p?.promptRules].map(x => (x || '').trim()).filter(Boolean).join('. ') || 'cinematic, consistent visual style, cohesive lighting';
  // Cụm aesthetic NGẮN, CỐ ĐỊNH — MỌI cảnh KẾT bằng ĐÚNG chuỗi này để đồng nhất 1 style.
  // ⚠️ sceneStyle có thể RẤT DÀI (cả đoạn) → phải RÚT còn ~1 mệnh đề ngắn, nếu không AI sẽ dán cả đoạn vào mỗi prompt (phình) và lô sau tự rút gọn (lệch nhau).
  // ⚠️ BỎ cụm PHỦ ĐỊNH ("not 3D", "no anime", "không 3d"…) trước khi dò style — nếu không regex match nhầm chữ trong câu phủ định
  //    (vd profile flat-2D ghi "NOT 3D" → tưởng là 3D → gắn nhầm "a stylized 3D render").
  // Rút gọn: lấy mệnh đề ĐẦU (tới dấu chấm/xuống dòng/gạch ngang), cắt tối đa ~90 ký tự ở ranh giới từ.
  let _tag = (p?.sceneStyle || p?.visualStyle || p?.characterStyle || '').trim().split(/[\n.]|—|\s-\s/)[0].trim();
  if (_tag.length > 90) _tag = _tag.slice(0, 90).replace(/[\s,;:-]+\S*$/, '').trim();
  if (!_tag) _tag = 'consistent cinematic visual style, cohesive lighting';   // trung tính — KHÔNG tự chèn medium
  // Medium BÁM ĐÚNG style của Profile. Không nhận ra kiểu gì → KHÔNG gắn medium (để chữ của Profile dẫn dắt),
  // trước đây mặc định "2D" nên kênh người thật/lịch sử vẫn ra prompt hoạt hình.
  const _pm = _profileMedium(p);
  const styleTag = _tag + (_pm.medium ? ' — ' + _pm.medium : '');
  // Style NHÂN VẬT riêng của profile (nét vẽ/mặt/tỉ lệ) → ép nhân vật phụ/quần chúng vẽ ĐÚNG style này, khớp nhân vật chính.
  const _charId = (p?.charIdentity || '').trim();
  const _charIdRule = _charId ? ` — cụ thể vẽ theo ĐÚNG style nhân vật của kênh: "${_charId}"` : '';
  const noChar = document.getElementById('noCharMode')?.checked;

  // Đọc độ dài audio để căn timing (af đã bắt buộc có ở trên).
  let audioTotal = 0;
  setStatus2('🎧 Đọc độ dài audio…', 'working'); audioTotal = await _t2AudioDur(af); _t2AudioDurCache = audioTotal;

  clearCancel();
  // Chia kịch bản thành lô để vừa ngữ cảnh, giữ dàn nhân vật/bối cảnh xuyên suốt.
  // ⚠️ CLI bridge VÀ gateway bên thứ 3 (Base URL) hay TREO/hỏng khi output lớn → chia lô NHỎ (mỗi call nhẹ, trả nhanh, không quá timeout gateway).
  // Chỉ API CHÍNH CHỦ (không Base URL) mới để lô lớn cho nhanh.
  const _cliMode = (typeof _usingCli === 'function') ? _usingCli() : false;
  const _thirdParty = !!(localStorage.getItem('api_base_url') || '').trim();   // dùng gateway ngoài (gwai/hhtech…) → coi như CLI: lô nhỏ
  const _smallBatch = _cliMode || _thirdParty;
  // ⚠️ Lô phải đủ NHỎ để output JSON không bị cắt: mỗi cảnh ~150 token, lô 900 từ ≈ 55 cảnh ≈ 8k token.
  // Lô NHỎ = output ngắn = gần như không bao giờ bị cắt, và lỗi 1 lô chỉ mất vài cảnh.
  const _batchWords = _cliMode ? 500 : 600;
  const _batchMaxTok = _smallBatch ? 6000 : 16000;   // trần rộng tay: chỉ trả tiền phần THỰC SỰ sinh ra
  const paras = txt.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const batches = []; let cur = '';
  for (const pa of paras) { if (_wcSb(cur + ' ' + pa) > _batchWords && cur) { batches.push(cur); cur = pa; } else cur = cur ? cur + '\n\n' + pa : pa; }
  if (cur) batches.push(cur);

  // Lập TỦ ĐỒ cố định + SUY THỜI ĐẠI (trang phục/đạo cụ đúng thời, chống drift quần áo).
  if (typeof novaLog === 'function') novaLog(`📝 Phân Cảnh: bắt đầu — kịch bản ${txt.length} ký tự, chia ${batches.length} lô. Nếu dùng CLI (gói Claude/ChatGPT) mỗi bước AI sẽ chậm hơn API.`, 'acc');
  setStatus2('👕 Đang lập tủ đồ + xác định thời đại…', 'working');
  if (typeof novaLog === 'function') novaLog('👕 Đang lập tủ đồ + xác định thời đại (1 lần gọi AI lớn, gửi cả kịch bản)…');
  const _t2t0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  const _wp = await _t2PlanWardrobe(txt, noChar, (state.t3Era || '').trim());
  const wardrobe = _wp.wb || {};
  const era = _wp.era || '';
  if (typeof novaLog === 'function') { let _s = ''; try { _s = _t2t0 ? ` (${((performance.now() - _t2t0) / 1000).toFixed(0)}s)` : ''; } catch (e) {} novaLog(`👕 Tủ đồ xong${_s}: ${Object.keys(wardrobe).length} nhân vật cố định${era ? ', thời đại: ' + era : ''}.`, 'ok'); }
  if (era && !state.t3Era) { state.t3Era = era; const _eEl = document.getElementById('t3Era'); if (_eEl) _eEl.value = era; }
  state.wardrobe = wardrobe;
  const eraText = era
    ? `\n- ERA/SETTING: "${era}". ALL clothing, hairstyles, props, architecture and vehicles must be CORRECT for this era — ABSOLUTELY no modern items if it is a historical period.`
    : '';
  const wbText = Object.keys(wardrobe).length
    ? '\n- FIXED WARDROBE (MUST paste the exact "desc" matching the moment — do NOT invent different outfits; same period = dressed the SAME):\n'
      + Object.entries(wardrobe).map(([n, os]) => `  • [${n}]: ${os.map(o => `when ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')
    : '';

  // 🎯 LOGLINE toàn video — sinh 1 lần rồi nhồi vào MỌI lô storyboard để các lô sau không lạc mạch/đổi tông (giống web tool).
  let _loglineSb = '';
  setStatus2('🎯 Đang tóm cốt truyện toàn video (logline)…', 'working');
  try { if (typeof genVideoLogline === 'function') _loglineSb = (await genVideoLogline(false)) || ''; } catch (e) { console.warn('logline:', e); }
  if (typeof novaLog === 'function' && _loglineSb) novaLog('🎯 Logline: ' + _loglineSb.slice(0, 120) + (_loglineSb.length > 120 ? '…' : ''), 'acc');
  const loglineText = (_loglineSb && _loglineSb.trim())
    ? `\n\n🎯 WHOLE-VIDEO PREMISE (every scene MUST stick to this): "${_loglineSb.trim()}"\n- Every scene — including abstract lines / rhetorical questions / transitions — must stay inside this video's VISUAL WORLD (correct characters, settings, era, palette). Do NOT draw generic imagery that drifts off the story.`
    : '';

/* ── Chia cảnh phải BIẾT đang bật nguồn nào ─────────────────────────────
     Bản cũ chia cảnh xong mới chọn nguồn, nên kịch bản luôn được chia theo lối
     "mỗi cảnh một ẢNH AI": cảnh ngắn, nhân vật cố định, tả bối cảnh chi tiết.
     Khi phần lớn cảnh sẽ dùng TƯ LIỆU CÓ SẴN thì lối chia đó sai — tư liệu
     thật cần cảnh DÀI hơn để chuyển động chạy hết, và không thể khớp một nhân
     vật do AI bịa ra. Nên đưa luật riêng vào ngay từ bước chia.             */
  const _nguonThuc = (() => {
    const b = (typeof _t2NguonBat === 'function') ? _t2NguonBat() : {};
    return ['stock', 'yt', 'kho', 'web'].filter(k => b[k]);
  })();
  const _coThuc = _nguonThuc.length > 0;
  const luatNguon = _coThuc ? `

🎥 THIS VIDEO USES STOCK FOOTAGE (${_nguonThuc.length} sources enabled) — SPLIT SCENES DIFFERENTLY:
- Most scenes will be filled with REAL-LIFE CLIPS, not AI images. So:
  • Make stock-footage scenes LONGER (close to ${secMax}s) — a clip needs time for its motion to play out. Chopping into 3-second bites wastes footage and looks jumpy.
  • Do NOT assign a character to those scenes: a stock clip cannot match the face of an AI-invented character. Leave character EMPTY.
  • Describe scenes using things that REALLY EXIST and are FINDABLE (animals, objects, places, concrete actions) — do not describe cinematic color grading or staged lighting, because nobody can search stock by mood.
- Mark "thuc": true for scenes that depict REAL, ALREADY-FILMED things (species, phenomena, landmarks, everyday activities, historical footage, artifacts). Mark "thuc": false for abstract, metaphorical, inner-monologue scenes, or scenes needing a consistent character — those still use AI images.
- STILL IMAGES are only for EXPLANATORY scenes (comparisons, data, maps, artifacts needing close study). Story scenes get moving footage.` : '';

  const typesOn = _sceneTypesOn();
  const typeList = typesOn.map(t => `"${t}" (${SCENE_TYPES[t].vi})`).join(' · ');
  const typeRecipes = typesOn.map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  // Kiểu cảnh TẮT thì prompt KHÔNG được nhắc tới, không thì AI vẫn trả về (vd tắt "So sánh" mà storyboard đầy biểu đồ).
  const _hasCmp = typesOn.includes('compare'), _hasMap = typesOn.includes('map');
  const _infoShots = [_hasCmp ? '"compare"' : '', _hasMap ? '"map"' : ''].filter(Boolean).join('/');
  const cmpHint = _hasCmp ? '; đoạn giải thích/so sánh/số liệu → "compare"' : '';
  const cmpRule = _hasCmp
    ? '\n- ⚖️ LIMIT "compare" (charts) — PREFER TELLING WITH EVERYDAY IMAGERY: do NOT turn every number-containing line into a chart. ONLY use "compare" when two numbers/options MUST sit SIDE BY SIDE to be understood (a true comparison). Everything else — including lines with money/ratios — should be conveyed as a CONCRETE SCENE or a METAPHOR (someone holding a stack of cash, a long receipt, objects stacked high, a price board on a wall, an empty wallet...) using "scene"/"close-up"/"b-roll". TARGET: "compare" should be only ~1/5–1/4 of all scenes. NEVER let 2 "compare" scenes sit adjacent — if 2 consecutive lines are both data, switch at least one to an everyday/metaphor scene.'
    : '\n- ⛔ THIS VIDEO USES NO CHARTS/INFOGRAPHICS: ABSOLUTELY do NOT return shot "compare"/"diagram"/"map", do not draw charts, data tables, diagrams. Lines with numbers/comparisons must still be told through EVERYDAY SCENES or CONCRETE METAPHORS (someone holding a stack of cash, a long receipt, objects stacked high, a price board on a wall, an empty wallet...) with "scene"/"close-up"/"b-roll".';
  const infoBgRule = _infoShots
    ? `📊 For chart/data/infographic shots (${_infoShots}): leave background EMPTY (do NOT create a setting asset) and DESCRIBE the chart content DIRECTLY in "prompt" — describe each chart SEPARATELY per its own numbers/content, do NOT merge them, do NOT invent numbers. `
    : '';
  const infoTextRule = _infoShots
    ? `  ${_infoShots} scenes: only the FEW ESSENTIAL pieces of text (one 2-4 word title + a few NUMBERS or 1-2 word labels), mostly ICONS/shapes/bars, WITH lots of empty space — ABSOLUTELY no wall of words, no long sentences, no long descriptive labels.\n`
    : '';
  const noTextRule = _infoShots
    ? `- 🚫 TEXT IN IMAGE: every scene that is NOT ${_infoShots} must contain ABSOLUTELY no text/labels/sentences/numbers/watermark/logo in the image (subtitles are handled at the editing stage). Clean images, visuals only.`
    : `- 🚫 TEXT IN IMAGE: ABSOLUTELY no scene may contain text/labels/sentences/numbers/watermark/logo in the image (subtitles are handled at the editing stage). Clean images, visuals only.`;
  // 🔖 Prompt NGẮN (chỉ tag, kiểu @leo/@mia) — MẶC ĐỊNH LUÔN (ẩn UI): nhân vật có slug chỉ ghi [slug] + hành động, KHÔNG lặp trang phục → dựa ảnh tham chiếu.
  const _shortRef = true;
  const promptLen = _shortRef ? '55-110' : '60-120';
  const charSlugRule = _shortRef
    ? `  👤 CHARACTERS WITH a slug: write ONLY [slug] + (if needed) 1-2 words of age/gender + the ACTION/pose/expression. ⛔ ABSOLUTELY do NOT repeat outfit/hair/clothing colors in the prompt — the [slug] reference image handles the entire appearance. (Only characters WITHOUT a slug get a full appearance description.) ✅ The words saved by skipping outfit description → SPEND on describing the ENVIRONMENT/setting in DETAIL + lighting (direction/color/contrast) + composition & DEPTH (fore/mid/background) → the prompt stays RICH and CINEMATIC (only the character part stays terse).`
    : `  👤 CHARACTERS WITH a slug: write [slug] THEN IMMEDIATELY add a short-but-COMPLETE description in the prompt: age/gender/build + hair + the FULL OUTFIT with EXACT COLORS per item (paste the "desc" VERBATIM from the FIXED WARDROBE above — e.g. "a faded navy-blue polo shirt and khaki shorts, white sneakers"). ⚠️ Keep the EXACT same colors + outfit in EVERY scene — do NOT change, do NOT invent, do NOT shorten colors. (Reference tags alone STILL get colors wrong → the colors MUST be stated explicitly in the prompt.) Characters with multiple outfits → pick the one matching the moment (based on "when"). Face/age/gender/build are locked absolutely.`;
  const beats = []; const cast = new Set(Object.keys(wardrobe)), locs = new Set();
  for (let bi = 0; bi < batches.length; bi++) {
    if (state.cancelRequested) { setStatus2('⏸ Đã dừng. Giữ ' + beats.length + ' cảnh.', 'info'); if (typeof novaLog === 'function') novaLog('⏸ Phân Cảnh: đã dừng theo yêu cầu — giữ ' + beats.length + ' cảnh.', 'warn'); break; }
    _llmStep = 'chia cảnh';
    if (typeof novaLog === 'function') novaLog(`🎬 Chia cảnh lô ${bi + 1}/${batches.length}…`);
    const _biN = beats.length;
    const known = 'Characters already created: ' + ([...cast].join(', ') || '(none)') + '. Settings already created: ' + ([...locs].join(', ') || '(none)') + '.';
    const _mkPrompt = (SCRIPT) =>
`You are a storyboard director for faceless videos. Split the script SEGMENT below into SCENES for illustration images — GROUP by visual idea, do NOT chop into single sentences.${loglineText}

RULES:
- Each scene = ONE frame, ${secMin}-${secMax}s of narration (avg ~${secAvg}s ≈ ${Math.round(secAvg * 2.6)} words). ⛔ MANDATORY: no scene longer than ${secMax}s. A LONG paragraph must be SPLIT into SEVERAL consecutive scenes — each scene one DISTINCT frame (different angle / close-wide / detail / different action), do NOT merge into one long scene repeating the same image. Dramatic/closing lines → SHORT scenes but ⛔ NOT UNDER ${secMin}s: if a line is too short (reads under ${secMin}s), MERGE it with an adjacent line of the SAME idea into one scene, do NOT let it stand alone as a tiny scene. Do NOT cut mid-sentence.
- Keep the narration VERBATIM in "text" (join the scene's sentences, no edits).
- Keep the CAST & SETTINGS consistent across the whole video, with SHORT FIXED slugs of 1-3 words (e.g. "protagonist-male","call-center-night"). Each person/place gets ONLY one unique name throughout — REUSE existing slugs, ABSOLUTELY do NOT change suffixes between scenes (once "protagonist-male" is used, it stays "protagonist-male", never "protagonist-male-trader"). ⚠️ MERGE toward FEWER settings: SIMILAR places/rooms → share ONE slug; create a NEW slug only when clearly different; prefer reusing existing slugs. ${infoBgRule}👤 CREATE a character slug for EVERY character with a ROLE or explicitly mentioned in the script — EVEN those appearing only ONCE (e.g. "the giant TV buyer", "the taste-testing man", "the man holding the copper tube") → give them a slug so a REFERENCE IMAGE keeps the FACE + outfit CONSISTENT between image A and B. ⚠️ Max ~6 characters for the WHOLE video — if exceeded, MERGE similar roles / drop the least important role, do NOT spawn them carelessly. Leave character EMPTY (describe fully inline, do NOT create an asset) ONLY for: passing crowds that need no identification, or completely insignificant walk-ons. 🏠 SETTINGS — PROACTIVELY spot the BACKBONE locations recurring in ≥2 scenes and CREATE SLUGS for them (long videos usually have 2–6 backbone locations: home, office, HQ, store...). MERGE similar places into ONE shared slug; reuse existing slugs, do NOT change suffixes. Leave background EMPTY and describe inline in the prompt only when: ${_infoShots ? '(a) it is a chart/data/infographic scene, (b)' : '(a)'} the place appears only ONCE, or ${_infoShots ? '(c)' : '(b)'} it is generic enough that one sentence covers it (sky, a road, a desk corner, a beach...). ⚠️ Do NOT return 0 settings for a long video — pick AT LEAST a few backbone locations to keep the space consistent; you may only return 0 when the video is TRULY purely abstract (no recurring physical place at all). Balance: enough backbone places for consistency, but don't turn every passing place into an asset. ${known}${noChar ? ' NO-PEOPLE CHANNEL: every scene is scenery/objects/processes only, leave character empty.' : ''}${eraText}${wbText}
- 🎬 CHARACTER SPACING: MAX 3 CONSECUTIVE scenes with the same character. Every 3-4 people-scenes MUST include at least 1 scene WITHOUT people (character empty, shot "b-roll"): objects, places, detail close-ups, processes. A 150+ scene video where every scene shows the same person is very boring to watch.
- "shot" = SCENE TYPE, pick EXACTLY 1 from: ${typeList}. Default "scene". Pick by content: the video's OPENING line/hook → "hook"; opening a chapter/introducing a place → "establishing"; an emotional/detail line → "close-up"; a narration line describing people-less scenery → "b-roll"${cmpHint}.${cmpRule}
- Do NOT write image prompts at this step — the next pass handles that. Return only the scene structure.${luatNguon}
- "camera": wide|medium|close. "motion": zoom-in|zoom-out|pan-left|pan-right|static|punch (short scenes use punch/quick zoom).

Return ONLY 1 JSON array IN ORDER, no markdown:
[{"text":"...","character":"slug or empty","background":"slug","camera":"medium","shot":"scene","motion":"zoom-in"${_coThuc ? ', "thuc":true' : ''}}]

SCRIPT SEGMENT:
"""${SCRIPT}"""`;
    // Gateway/API bên thứ 3 hay RỚT call to ("Failed to fetch") dù call nhỏ vẫn qua → khi rớt MẠNG thì CHIA ĐÔI đoạn gọi lại (call nhẹ dễ qua), tối đa 3 tầng.
    const _isNetErr = (m) => /Failed to fetch|Load failed|NetworkError|ERR_NETWORK|ERR_CONNECTION|socket hang up|ECONN|Quá thời gian|aborted/i.test(String(m || ''));
    const _runSeg = async (SCRIPT, depth) => {
      try { return (await callLLMJson(_mkPrompt(SCRIPT), { maxTokens: _batchMaxTok, validate: a => Array.isArray(a) })) || []; }
      catch (e) {
        const ps = String(SCRIPT).split(/\n+/).map(s => s.trim()).filter(Boolean);
        // CHIA ĐÔI GỌI LẠI cho MỌI lỗi (rớt mạng, JSON hỏng, output bị cắt) — thà mất nửa lô còn hơn mất cả lô.
        if (depth < 4 && ps.length > 1) {
          const mid = Math.ceil(ps.length / 2);
          if (typeof novaLog === 'function') novaLog(`  ↻ Lô ${bi + 1} lỗi: ${String(e.message || '').slice(0, 200)} — chia đôi gọi lại…`, 'warn');
          await new Promise(r => setTimeout(r, 1500));
          const a1 = await _runSeg(ps.slice(0, mid).join('\n\n'), depth + 1);
          await new Promise(r => setTimeout(r, 800));
          const a2 = await _runSeg(ps.slice(mid).join('\n\n'), depth + 1);
          return a1.concat(a2);
        }
        throw e;
      }
    };
    try {
      const arr = await _runSeg(batches[bi], 0);
      (arr || []).forEach(o => {
        const text = String(o.text || '').trim(); if (!text) return;
        const ch = noChar ? '' : String(o.character || '').trim();
        const bg = String(o.background || '').trim();
        if (ch) cast.add(ch); if (bg) locs.add(bg);
        const shot = _validShot(o.shot);
        beats.push({ text, prompt: String(o.prompt || '').trim(), character: ch, background: bg,
          camera: (String(o.camera || 'medium').trim() || 'medium'), shot: shot, motion: String(o.motion || '').trim() || (SCENE_TYPES[shot] ? SCENE_TYPES[shot].motion : ''),
          // Cảnh tả thứ CÓ THẬT đã được quay → ưu tiên giao cho nguồn tư liệu.
          thuc: o.thuc === true });
      });
    } catch (e) { console.warn('storyboard lô ' + bi + ':', e.message); if (typeof novaLog === 'function') novaLog(`⚠️ Lô ${bi + 1} lỗi: ${(e.message || e)}. Bỏ qua, chạy tiếp.`, 'err'); }
    // Lưu NGAY sau mỗi lô — dừng/sập giữa chừng vẫn giữ phần đã có (học web đối thủ: trả về tới đâu lưu tới đó).
    try { if (beats.length) { state.scenes = beats.map((b, i) => ({ id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1', character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc, duration: (typeof calcDur === 'function' ? calcDur(b.text) : 3) })); saveState(true); } } catch (e) {}
    const _pct = Math.round((bi + 1) / batches.length * 100);
    setStatus2(`✨ Chia cảnh… ${beats.length} cảnh · lô ${bi + 1}/${batches.length} · ${_pct}%`, 'working');
    if (typeof novaLog === 'function') novaLog(`  ✓ Lô ${bi + 1}/${batches.length}: +${beats.length - _biN} cảnh (tổng ${beats.length}).`, 'ok');
  }
  if (!beats.length) { if (typeof novaLog === 'function') novaLog('❌ Phân Cảnh: AI chưa tạo được cảnh nào (kiểm tra kết nối AI / CLI).', 'err'); return setStatus2('AI chưa tạo được cảnh. Thử lại hoặc kiểm tra kết nối AI.', 'error'); }

  // GỘP TÊN TRÙNG BIẾN THỂ về 1 tên chuẩn xuyên suốt (khắc phục lô AI đặt tên lệch: protagonist-male ↔ protagonist-male-trader)
  const charMap = _canonMap(beats.map(b => b.character));
  const bgMap = _canonMap(beats.map(b => b.background));
  let _fixed = 0;
  beats.forEach(b => {
    if (b.character && charMap[b.character]) b.character = charMap[b.character];
    if (b.background && bgMap[b.background]) b.background = bgMap[b.background];
    b.prompt = _canonTags(b.prompt, charMap, bgMap);
    // Còn tag nào không nằm trong dàn asset → quy về slug của chính cảnh; không có
    // thì bỏ ngoặc. Để nguyên là tool tạo ảnh thấy một token vô nghĩa và bỏ qua.
    const n = _t2RepairTags(b);
    if (n) _fixed += n;
  });
  if (_fixed && typeof novaLog === 'function') novaLog(`🔧 Sửa ${_fixed} tag lạ trong prompt (tag không có ảnh tham chiếu → nhân vật biến mất khỏi cảnh).`, 'ok');

  const totalWords = beats.reduce((a, b) => a + _wcSb(b.text), 0) || 1;
  const totalDur = audioTotal > 0 ? audioTotal : beats.reduce((a, b) => a + calcDur(b.text), 0);
  const maxScenes = (typeof getMaxScenes === 'function') ? getMaxScenes() : Infinity;
  let cut = 0; if (beats.length > maxScenes) { cut = beats.length - maxScenes; beats.length = maxScenes; }

  state.scenes = beats.map((b, i) => ({
    id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1',
    character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc,
    duration: Math.max(1, +((totalDur * _wcSb(b.text) / totalWords)).toFixed(1)),
  }));
  state.scenePrompts = {}; state.scenePrompts2 = {};
  // 🔒 ÉP [tag] nhân vật/bối cảnh vào prompt (chế độ Tag) → tool tạo ảnh đính ĐÚNG ref, không lạc nhân vật. AI hay quên ngoặc.
  beats.forEach((b, i) => { if (b.prompt) state.scenePrompts[String(i + 1).padStart(3, '0')] = _ensureSceneTags(b.prompt, { character: b.character, background: b.background }); });

  // ⛔ CẮT TRẦN cứng: cảnh nào dài hơn max giây → TÁCH thành nhiều cảnh (chia đều thời lượng + text theo câu), giữ prompt/nhân vật/bối cảnh.
  // Dùng lại được (gọi cả TRƯỚC và SAU khi Whisper căn giọng — vì Whisper có thể căn 1 cảnh dài vượt max SAU khi đã cắt lần đầu).
  // Góc máy tiến dần cho các ảnh CÙNG 1 cảnh gốc → tránh ảnh giống hệt (chán).
  const _SPLIT_FRAMES = [
    { cam: 'wide',   mo: 'zoom-in',   note: 'wide establishing framing of this scene' },
    { cam: 'medium', mo: 'pan-right', note: 'tighter medium shot of the same moment from a different camera angle' },
    { cam: 'close',  mo: 'zoom-in',   note: 'close-up detail from the same scene, a new angle' },
    { cam: 'medium', mo: 'pan-left',  note: 'reverse-angle medium shot of the same scene' },
  ];
  // allowSubSplit: cho phép chia 1 CÂU ĐƠN dài (không tách được theo câu) thành NHIỀU ẢNH (cùng text, khác góc máy)
  //   → chỉ bật ở lần cắt SAU Whisper (thời lượng đã thật; không còn căn giọng nên text trùng không gây loạn).
  const _enforceMaxDur = (cap, allowSubSplit) => {
    if (!(cap > 0)) return 0;
    const _splitTxt = (t, n) => { const s = (String(t).match(/[^.!?…。！？]+[.!?…。！？]*/g) || [t]).map(x => x.trim()).filter(Boolean); if (s.length <= 1) return [t]; const per = Math.ceil(s.length / n); const r = []; for (let k = 0; k < n; k++){ const c = s.slice(k * per, (k + 1) * per).join(' ').trim(); if (c) r.push(c); } return r.length ? r : [t]; };
    const outScenes = [], outPrompts = {}; let nSplit = 0;
    // CẢNH DÀI KHÔNG tách thành cảnh riêng cùng-câu nữa (tránh 2 ảnh trùng lời). Giữ tới 2× max trong MỘT cảnh
    // → autoAddPromptBForLongScenes() sẽ thêm ẢNH B (prompt AI khác) → 2 ảnh/1 cảnh, Dựng Video chia đôi thời lượng.
    // CHỈ tách cảnh khi CỰC dài (>2× max) VÀ nhiều câu — mỗi phần vẫn ≤2× max để B lấp phần còn lại.
    for (const sc of state.scenes){
      const pr = state.scenePrompts[sc.id] || '';
      if (sc.duration <= cap * 2){ const id = String(outScenes.length + 1).padStart(3, '0'); outScenes.push({ ...sc, id }); if (pr) outPrompts[id] = pr; continue; }
      const nBy = Math.min(6, Math.max(2, Math.ceil(sc.duration / (cap * 2))));
      const texts = _splitTxt(sc.text, nBy); const m = texts.length;
      const wc = texts.map(t => Math.max(1, _wcSb(t))); const totW = wc.reduce((a, b) => a + b, 0) || 1;
      texts.forEach((tx, pi) => {
        const partDur = Math.max(1, +(sc.duration * wc[pi] / totW).toFixed(1));
        const id = String(outScenes.length + 1).padStart(3, '0');
        outScenes.push({ ...sc, id, text: tx, duration: partDur });   // mỗi câu 1 cảnh, giữ prompt A; autoAddB thêm B sau
        if (pr) outPrompts[id] = pr;
      });
      if (m > 1) nSplit++;
    }
    if (nSplit) { state.scenes = outScenes; state.scenePrompts = outPrompts; }
    return nSplit;
  };
  _enforceMaxDur(secMax, false);
  _llmStep = 'khác';
  try {
    const _cv = _t2Coverage(state.script, state.scenes);
    if (typeof novaLog === 'function'){
      if (_cv.missing.length) novaLog(`⚠️ Độ phủ: ${_cv.missing.length}/${_cv.total} câu kịch bản KHÔNG có trong cảnh nào — vd: "${_cv.missing[0].slice(0, 60)}…"`, 'warn');
      if (_cv.dup.length) novaLog(`⚠️ ${_cv.dup.length} cảnh TRÙNG lời đọc (${_cv.dup.slice(0, 5).join(', ')}).`, 'warn');
      if (!_cv.missing.length && !_cv.dup.length) novaLog(`✓ Độ phủ: đủ ${_cv.total} câu, không cảnh nào trùng lời.`, 'ok');
    }
  } catch (e) {}
  _t2MarkVideoScenes();   // 🎬 đánh dấu vài cảnh động làm video (xen giữa ảnh tĩnh)
  if (typeof novaLog === 'function'){ const _nv = (state.scenes || []).filter(s => s.wantVideo).length, _ns = (state.scenes || []).filter(s => s.wantStock).length, _ny = (state.scenes || []).filter(s => s.wantYt).length; novaLog(`🎞 Chia cảnh xong: ${state.scenes.length} cảnh${_nv ? ' · ' + _nv + ' cảnh 🎬 Veo' : ''}${_ns ? ' · ' + _ns + ' cảnh 🎞 stock' : ''}${state.ytMix ? ' · ' + _ny + ' cảnh ▶️ YouTube' : ''}.`, 'ok'); }

  // CĂN CHÍNH XÁC TỪNG CẢNH theo giọng đọc: Whisper transcribe MP3 + align lời vào timestamp thật.
  // Nếu Whisper lỗi/không có → giữ timing ước lượng theo chữ (đã tính ở trên).
  // Whisper TỰ LẤY NGÔN NGỮ theo Profile (vi/en/ko/… ; không map được → auto-detect).
  // _t8TranscribeBlob đọc từ DOM #t8Language (panel Tool 8 ẩn nhưng còn) → phải set cả DOM.
  try {
    if (typeof _langVoiceCode === 'function') {
      const _lc = _langVoiceCode(_profileLang()) || '';
      localStorage.setItem('t8_language', _lc);
      const _le = document.getElementById('t8Language'); if (_le) _le.value = _lc;
    }
  } catch (e) {}
  try {
    if (_autoAudioFile !== af) { _autoAudioFile = af; _autoAudioWords = null; }
    if (typeof _autoAlignAudioOnce === 'function') {
      setStatus2('🎯 Đang căn timing chính xác theo giọng đọc (Whisper)…', 'working');
      if (typeof novaLog === 'function') novaLog('🎯 Căn timing theo giọng đọc (Whisper transcribe MP3)…');
      const nAlign = await _autoAlignAudioOnce();
      if (nAlign == null) { setStatus2('⚠️ Whisper chưa transcribe được — tạm dùng timing ước lượng theo chữ (cài key Groq ở Cài đặt để chính xác hơn).', 'info'); if (typeof novaLog === 'function') novaLog('⚠️ Whisper chưa transcribe được — dùng timing ước lượng theo chữ.', 'warn'); }
      else if (typeof novaLog === 'function') novaLog(`🎯 Căn timing xong: ${nAlign} cảnh khớp giọng đọc.`, 'ok');
    }
  } catch (e) { console.warn('whisper align:', e); }

  // 🔗 GỘP CẢNH NGẮN sau Whisper: cảnh dưới min giây → gộp vào cảnh liền TRƯỚC (nối lời, cộng giây), miễn không vượt max.
  const _mergeShort = (minS, maxS) => {
    if (!(minS > 0) || !Array.isArray(state.scenes) || state.scenes.length < 2) return 0;
    const out = [], outP = {}; let merged = 0;
    for (const s of state.scenes){
      const pr = state.scenePrompts[s.id] || '';
      const prev = out[out.length - 1];
      if (prev && s.duration < minS && (prev.duration + s.duration) <= maxS * 1.05 && s.text && !prev.text.includes(String(s.text).trim())){
        prev.text = (prev.text + ' ' + s.text).trim();          // gộp lời vào cảnh trước (bỏ qua mảnh CÙNG LỜI = biến thể góc máy để không nhân đôi text)
        prev.duration = +(prev.duration + s.duration).toFixed(1); // giữ prompt/nhân vật/bối cảnh của cảnh trước
        merged++;
      } else {
        const id = String(out.length + 1).padStart(3, '0');
        out.push({ ...s, id }); if (pr) outP[id] = pr;
      }
    }
    if (merged){ state.scenes = out; state.scenePrompts = outP; }
    return merged;
  };
  const _nMerge = _mergeShort(secMin, secMax);
  if (_nMerge && typeof novaLog === 'function') novaLog(`🔗 Gộp ${_nMerge} cảnh ngắn (<${secMin}s) vào cảnh liền trước.`, 'ok');

  // ⛔ ÉP LẠI CAP SAU WHISPER: Whisper có thể căn 1 cảnh dài vượt max (vd 14.5s > 8s) → cắt lại + đánh dấu lại.
  const _nCut2 = _enforceMaxDur(secMax, true);   // sau Whisper: cho phép chia câu đơn dài thành nhiều ảnh khác góc máy
  if (_nCut2 && typeof novaLog === 'function') novaLog(`⛔ Cắt lại ${_nCut2} cảnh vượt ${secMax}s sau khi căn giọng (câu dài → nhiều ảnh đổi góc).`, 'ok');
  const _nMerge2 = _mergeShort(secMin, secMax);   // GỘP LẠI cảnh ngắn (khác lời) sinh ra sau bước cắt → hết cảnh <min như "The window." 1s
  if (_nMerge2 && typeof novaLog === 'function') novaLog(`🔗 Gộp thêm ${_nMerge2} cảnh ngắn sau khi cắt.`, 'ok');
  if (_nCut2 || _nMerge || _nMerge2) _t2MarkVideoScenes();

  // ── AI chọn nguồn hình cho từng cảnh (chỉ khi có nguồn nào được bật) ──
  // Chạy SAU khi cảnh đã chốt số lượng, vì nó đọc lời thoại từng cảnh.
  try {
    const _b = _t2NguonBat();
    if (Object.values(_b).some(Boolean) && !state.cancelRequested){
      setStatus2('🎯 AI chọn nguồn hình cho từng cảnh…', 'working');
      const _r = await _t2ChonNguonChoCanh(state.scenes || []);
      if (_r && _r.doi) {
        if (typeof novaLog === 'function') novaLog(`🎯 ${_r.doi}/${state.scenes.length} cảnh dùng nguồn ngoài, còn lại ảnh AI (trần ${_r.tran}).`, 'ok');
      } else {
        // AI không đổi cảnh nào (hoặc lỗi cả lô) → chia đều theo cửa sổ như bản cũ.
        _t2MarkVideoScenes();
        if (typeof novaLog === 'function') novaLog('🎯 AI không chọn được nguồn — dùng cách chia đều theo cửa sổ.', 'warn');
      }
    }
  } catch (e){ try { _t2MarkVideoScenes(); } catch (_) {} }

  // Đổ dàn nhân vật/bối cảnh sang hệ asset (để tab "Nhân vật & Bối cảnh" dùng)
  _collectCastToAssets();

  // Nếu người dùng đã bấm Dừng → chốt phần đã có, KHÔNG chạy tiếp bước viết mô tả.
  if (state.cancelRequested) {
    clearCancel();
    if (typeof renderAllT2 === 'function') renderAllT2();
    saveState();
    setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh + prompt (chưa viết mô tả nhân vật — bấm "🔄 Viết lại mô tả" khi cần).`, 'info');
    return;
  }

  // TỰ viết prompt reference sheet cho nhân vật/bối cảnh → xong là bấm "Tạo tất cả ảnh" chạy luôn
  try {
    if (typeof loadAssetsFromTool2 === 'function') loadAssetsFromTool2(true);
    if (typeof genAllAssetPrompts === 'function') { setStatus2('✨ Đang viết mô tả nhân vật & bối cảnh…', 'working'); if (typeof novaLog === 'function') novaLog('✍️ Viết mô tả nhân vật & bối cảnh (prompt reference sheet)…'); await genAllAssetPrompts(); }
  } catch (e) { console.warn('auto asset prompts:', e); if (typeof novaLog === 'function') novaLog('⚠️ Viết mô tả gặp lỗi: ' + (e.message || e), 'err'); }
  // ── LƯỢT 2: viết prompt ảnh cho từng cảnh (tách khỏi lượt chia cảnh → output mỗi call nhỏ, hỏng 1 lô không mất cảnh)
  if (!state.cancelRequested) {
    try {
      setStatus2('✍️ Lượt 2: viết prompt ảnh cho từng cảnh…', 'working');
      if (typeof novaLog === 'function') novaLog('✍️ Lượt 2 — viết prompt ảnh (mỗi lô vài cảnh, lỗi chỉ mất cảnh đó)…');
      await doGenerateScenePrompts();
    } catch (e) { console.warn('lượt 2 prompt:', e); if (typeof novaLog === 'function') novaLog('⚠️ Lượt 2 lỗi: ' + (e.message || e), 'err'); }
  }
  // Cảnh dài vượt max giây/ẢNH (không phải infographic) → thêm ẢNH B (prompt AI khác) → Dựng Video chia đôi ⇒ MỖI ảnh ≤ max. Infographic giữ 1 ảnh (chart hiển thị lâu, tránh 2 chart trùng).
  if (!state.cancelRequested) {
    try { if (typeof autoAddPromptBForLongScenes === 'function') { if (typeof novaLog === 'function') novaLog('✂️ Thêm ảnh B cho cảnh dài (>max giây/ảnh) → mỗi ảnh trong ngưỡng…'); await autoAddPromptBForLongScenes(true); } } catch (e) { console.warn('autoAddB:', e); if (typeof novaLog === 'function') novaLog('⚠️ Thêm ảnh B lỗi: ' + (e.message || e), 'err'); }
  }
  // 🎞 Cảnh đánh dấu Xen video stock → tìm luôn (chỉ gọi API tìm, vài giây/cảnh, chưa tải file).
  const _stk = (state.scenes || []).filter(s => s.wantStock && !(state.mediaPicks || {})[s.id]);
  if (_stk.length && !state.cancelRequested){
    if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
      try {
        setStatus2(`🎞 Tìm video stock cho ${_stk.length} cảnh…`, 'working');
        await t2FetchStockVideos();
        const got = _stk.filter(x => (state.mediaPicks || {})[x.id]).length;
        if (typeof novaLog === 'function') novaLog(`🎞 Video stock: ${got}/${_stk.length} cảnh có ứng viên.`, got ? 'ok' : 'warn');
      } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Tìm stock lỗi: ' + (e.message || e), 'err'); }
    } else if (typeof novaLog === 'function') {
      novaLog(`🎞 ${_stk.length} cảnh đánh dấu stock — thiếu API key Pexels/Pixabay (Cài đặt → Nguồn ảnh/video stock).`, 'warn');
    }
  }
  // 🎬 VEO: cần ảnh cảnh đã tạo xong mới làm được (ảnh→video) + tốn quota Flow → KHÔNG tự chạy, chỉ nhắc.
  const _veo = (state.scenes || []).filter(s => s.wantVideo).length;
  if (_veo && typeof novaLog === 'function') novaLog(`🎬 ${_veo} cảnh đánh dấu Veo — tạo ảnh xong rồi sang tab Tạo Video để dựng (cần ảnh trước, tốn quota Flow).`, 'acc');
  // ▶️ Cảnh đánh dấu Xen clip YouTube → LẤY CLIP luôn ở đây (trước chỉ đánh dấu rồi bỏ đó).
  const _yt = (state.scenes || []).filter(s => s.wantYt && !(state.mediaPicks || {})[s.id]);
  if (_yt.length && !state.cancelRequested && window.native && typeof window.native.smartClip === 'function'){
    setStatus2(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh (~${Math.round(_yt.length * 0.8)} phút) — bấm Dừng nếu muốn bỏ qua…`, 'working');
    if (typeof novaLog === 'function') novaLog(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh đã đánh dấu…`);
    try {
      const r = await _autoFetchYtClips(_yt, 20 * 60000);
      if (typeof novaLog === 'function') novaLog(`▶️ Clip YouTube: ${r.ok}/${_yt.length} cảnh${r.stop ? ' (dừng: ' + r.stop + ')' : ''}.`, r.ok ? 'ok' : 'warn');
    } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Lấy clip lỗi: ' + (e.message || e), 'err'); }
  } else if (_yt.length && typeof novaLog === 'function') {
    novaLog(`▶️ ${_yt.length} cảnh đánh dấu YouTube — mở app Nova để lấy clip (bản web không chạy được yt-dlp).`, 'warn');
  }
  if (typeof renderAllT2 === 'function') renderAllT2();
  saveState();
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh.`, 'info'); return; }
  const dm = Math.floor(totalDur / 60), ds = Math.round(totalDur % 60);
  setStatus2(`✓ Storyboard: ${state.scenes.length} cảnh mạch lạc + prompt${audioTotal > 0 ? ` · khớp audio ${dm}:${String(ds).padStart(2, '0')}` : ''}${cut ? ` (cắt ${cut} vượt gói)` : ''}. Xem tab "Prompt ảnh".`, 'ok');
  if (typeof novaLog === 'function') novaLog(`✅ Phân Cảnh HOÀN TẤT: ${state.scenes.length} cảnh + prompt + mô tả nhân vật/bối cảnh${cut ? ' (cắt ' + cut + ' cảnh vượt gói)' : ''}.`, 'ok');
}

async function t2RegenAllPrompts(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  const p = getProfile(); if (!p) return setStatus2('Cần Profile trước.', 'error');
  /* Cảnh đã giao cho nguồn tư liệu KHÔNG cần prompt ảnh — bấm "Tạo lại tất cả"
     mà quét cả chúng là đốt lại cả trăm lượt gọi AI cho thứ không ai đọc.     */
  const _tuLieu = (state.scenes || []).filter(_laThuc).length;
  const scenes = (state.scenes || []).filter(s => !_laThuc(s));
  if (!scenes.length) return setStatus2(_tuLieu
    ? `Cả ${_tuLieu} cảnh đều dùng tư liệu có sẵn — không cảnh nào cần prompt ảnh.`
    : 'Chưa có cảnh nào.', _tuLieu ? 'info' : 'error');
  if (!confirm(`Tạo lại prompt ảnh cho ${scenes.length} cảnh dùng ẢNH AI`
    + (_tuLieu ? ` (bỏ qua ${_tuLieu} cảnh dùng tư liệu có sẵn)` : '')
    + `?\nGIỮ nguyên chia cảnh, timing, lời đọc, danh sách nhân vật/bối cảnh. Prompt cũ sẽ bị thay.`)) return;
  const btn = document.getElementById('t2RegenAllBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo lại…'; }
  if (typeof clearCancel === 'function') clearCancel();
  try {
    if (typeof genVideoLogline === 'function') { try { await genVideoLogline(false); } catch (e) {} }
    const profileContext = `Channel: ${p.tenKenh}\nNiche: ${p.ngach}\nPOV: ${p.povStyle}\nStructure: ${p.cauTruc}`;
    const B = 6; let done = 0;
    if (!state.scenePrompts) state.scenePrompts = {};
    const batches = [];
    for (let i = 0; i < scenes.length; i += B) batches.push({ list: scenes.slice(i, i + B), start: i });
    const CONC = Math.min(4, batches.length);   // ⚡ chạy SONG SONG 4 lô cho nhanh (API chịu được)
    let bi = 0, finished = 0;
    const worker = async () => {
      while (bi < batches.length && !state.cancelRequested){
        const b = batches[bi++];
        let prevSceneCtx = '';
        if (b.start > 0){ const pv = scenes[b.start - 1]; const pp = state.scenePrompts[pv.id]; if (pp) prevSceneCtx = `[${pv.id}] ${String(pp).slice(0, 220)}`; }
        try {
          const prompt = buildSceneGenPrompt(b.list, prevSceneCtx, p, profileContext, '');
          let parsed = [];
          for (let attempt = 0; attempt < 2 && !parsed.length; attempt++){
            const reply = await callLLM(prompt, { maxTokens: 2200, _override: { thinking: false } });
            parsed = safeParseJSON(reply, a => Array.isArray(a)) || [];
          }
          for (const it of parsed){
            if (!it) continue;
            const sc = b.list.find(s => String(s.id) === String(it.id)) || null;
            const raw = cleanPrompt(String(it.prompt || ''));
            if (sc && raw && !_isLazyPrompt(raw)){
              state.scenePrompts[sc.id] = _ensureSceneTags(raw, sc);
              if (state.scenePrompts2 && state.scenePrompts2[sc.id] && typeof _mirrorTagsFromA === 'function')
                state.scenePrompts2[sc.id] = _mirrorTagsFromA(state.scenePrompts2[sc.id], state.scenePrompts[sc.id]);
              done++;
            }
          }
        } catch (e){ console.warn('[regenAll]', e); }
        finished++;
        setStatus2(`🔧 Tạo lại prompt… ${finished}/${batches.length} lô (${done} cảnh xong)`, 'working');
        if (typeof renderPromptsV === 'function') renderPromptsV();
      }
    };
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    if (typeof saveState === 'function') saveState();
    if (typeof renderPromptsV === 'function') renderPromptsV();
    if (typeof renderTable === 'function') renderTable();
    setStatus2(`✓ Đã tạo lại ${done}/${scenes.length} prompt (giữ nguyên cảnh). Ảnh cũ vẫn còn — tạo lại ảnh nếu muốn khớp prompt mới.`, 'ok');
  } catch (e){ console.error(e); setStatus2('Lỗi tạo lại prompt: ' + (e.message || e), 'error'); }
  finally { const b = document.getElementById('t2RegenAllBtn'); if (b){ b.disabled = false; b.textContent = '🔧 Tạo lại tất cả prompt'; } }
}

function t2MergeShortNow(){
  if (!Array.isArray(state.scenes) || state.scenes.length < 2) return setStatus2('Chưa có cảnh để gộp.', 'error');
  const minS = parseInt(document.getElementById('minSecPerImg')?.value) || 3;
  const maxS = parseInt(document.getElementById('maxSecPerImg')?.value) || 6;
  const P = state.scenePrompts || {}, P2 = state.scenePrompts2 || {}, IMG = state.sceneImages || {}, IMGB = state.sceneImagesB || {}, VID = state.sceneVideos || {}, VEO = state.veoPrompts || {}, MOT = state.motionPrompts || {};
  const out = [], nP = {}, nP2 = {}, nIMG = {}, nIMGB = {}, nVID = {}, nVEO = {}, nMOT = {};
  let merged = 0;
  for (const s of state.scenes){
    const prev = out[out.length - 1];
    if (prev && (+s.duration || 0) < minS && ((+prev.duration || 0) + (+s.duration || 0)) <= maxS * 1.05 && s.text && !String(prev.text || '').includes(String(s.text).trim())){
      prev.text = (String(prev.text || '') + ' ' + s.text).trim();
      prev.duration = +((+prev.duration || 0) + (+s.duration || 0)).toFixed(1);
      merged++;   // dữ liệu của cảnh bị gộp bỏ đi, giữ prompt/ảnh của cảnh trước
    } else {
      const nid = String(out.length + 1).padStart(3, '0'); const old = s.id;
      out.push({ ...s, id: nid });
      if (P[old]) nP[nid] = P[old]; if (P2[old]) nP2[nid] = P2[old];
      if (IMG[old]) nIMG[nid] = IMG[old]; if (IMGB[old]) nIMGB[nid] = IMGB[old];
      if (VID[old]) nVID[nid] = VID[old]; if (VEO[old]) nVEO[nid] = VEO[old]; if (MOT[old]) nMOT[nid] = MOT[old];
    }
  }
  if (!merged) return setStatus2('✓ Không có cảnh nào ngắn hơn ' + minS + 's — khỏi gộp.', 'ok');
  state.scenes = out; state.scenePrompts = nP; state.scenePrompts2 = nP2;
  state.sceneImages = nIMG; state.sceneImagesB = nIMGB; state.sceneVideos = nVID; state.veoPrompts = nVEO; state.motionPrompts = nMOT;
  if (typeof renderAllT2 === 'function') renderAllT2(); else { if (typeof renderTable === 'function') renderTable(); if (typeof renderPromptsV === 'function') renderPromptsV(); }
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState(true);
  setStatus2('🔗 Đã gộp ' + merged + ' cảnh ngắn (<' + minS + 's) → còn ' + out.length + ' cảnh.', 'ok');
}

function t2SplitLongNow(){ return autoAddPromptBForLongScenes(false); }

async function t2RegenAsset(kind, name){
  if (typeof tfRegenAsset !== 'function') return;
  setStatus2('🔄 Đang tạo ảnh ' + name + '…', 'working');
  await tfRegenAsset(kind, name);
  renderT2Assets();
  const store = kind === 'char' ? state.characterImages : state.backgroundImages;
  if (store?.[name]?.base64) setStatus2('✓ Đã tạo ảnh ' + name + '.', 'ok');
  else setStatus2('✗ Chưa tạo được ảnh ' + name + ' — bấm lại, hoặc kiểm tra kết nối Flow ở tab Tạo Ảnh.', 'error');
}

async function t2GenSceneImages(){
  if (typeof tfGenScenes !== 'function') return setStatus2('Chưa sẵn sàng tạo ảnh.', 'error');
  if (!(state.scenes || []).length) return setStatus2('Chưa có cảnh. Bấm ✨ Phân tích kịch bản trước.', 'error');
  setStatus2('🔌 Kiểm tra kết nối Flow…', 'working');
  if (!(await _t2FlowReady())) return setStatus2('⚠️ Chưa kết nối Flow. Mở tab "Tạo Ảnh Hàng Loạt" để đăng nhập/thêm tài khoản rồi thử lại.', 'error');
  setStatus2('🖼 Đang tạo ảnh cảnh còn thiếu qua Flow…', 'working');
  try {
    await tfGenScenes(true);
    if (typeof renderTable === 'function') renderTable();   // cập nhật ảnh + số "còn thiếu" trên nút
    const miss = (typeof _t2GenSceneMissCount === 'function') ? _t2GenSceneMissCount() : 0;
    setStatus2(miss ? ('🖼 Tạo ảnh cảnh xong · còn ' + miss + ' ảnh thiếu — bấm lại để tạo tiếp.') : '✓ Đã tạo đủ ảnh cảnh.', miss ? 'info' : 'ok');
  } catch (e) { setStatus2('Lỗi tạo ảnh cảnh: ' + (e.message || e), 'error'); }
}

async function t2GenAllAssetImages(){
  if (typeof tfGenAssets !== 'function') return setStatus2('Chưa sẵn sàng tạo ảnh.', 'error');
  setStatus2('🔌 Kiểm tra kết nối Flow…', 'working');
  if (!(await _t2FlowReady())) return setStatus2('⚠️ Chưa kết nối Flow. Mở tab "Tạo Ảnh Hàng Loạt" để đăng nhập/thêm tài khoản rồi thử lại.', 'error');
  setStatus2('✨ Đang tạo ảnh nhân vật + bối cảnh qua Flow…', 'working');
  let rc = null, rb = null;
  try {
    rc = await tfGenAssets('char', true);
    if (rc && rc.err && !rc.done){ setStatus2('↻ Flow mới mở chưa sẵn sàng — tự thử lại nhân vật sau 3s…', 'working'); await new Promise(r => setTimeout(r, 3000)); rc = await tfGenAssets('char', true); }   // toàn lỗi (thường do Chrome vừa mở) → thử lại 1 lần
    rb = await tfGenAssets('bg', true);
    if (rb && rb.err && !rb.done){ await new Promise(r => setTimeout(r, 3000)); rb = await tfGenAssets('bg', true); }
  } catch (e) { renderT2Assets(); return setStatus2('Lỗi tạo ảnh asset: ' + (e.message || e), 'error'); }
  renderT2Assets();
  const done = (rc?.done || 0) + (rb?.done || 0), err = (rc?.err || 0) + (rb?.err || 0);
  if (err && !done) setStatus2('❌ Tạo asset lỗi ' + err + ' ảnh — xem Nhật ký. Nếu vừa mở app/thêm tài khoản, đợi ~10s rồi bấm "Tạo tất cả ảnh" lại.', 'error');
  else setStatus2('✓ Tạo asset xong: ' + done + ' ảnh' + (err ? ' · còn ' + err + ' lỗi (bấm lại để tạo tiếp cái thiếu)' : '') + '.', err ? 'error' : 'ok');
}

function t2UploadAsset(kind, name, file){
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    const store = kind === 'char' ? (state.characterImages || (state.characterImages = {})) : (state.backgroundImages || (state.backgroundImages = {}));
    store[name] = { base64: String(r.result || ''), mediaType: file.type || 'image/png', fileName: file.name };
    if (typeof saveState === 'function') saveState(true);
    renderT2Assets();
    setStatus2(`✓ Đã gán ảnh cho "${name}".`, 'ok');
  };
  r.readAsDataURL(file);
}

async function t2AudioInfo(file){
  const nm = document.getElementById('t2AudioName'), pill = document.getElementById('t2AudioPill');
  if (!file || !nm) return;
  nm.textContent = file.name;
  if (pill) { pill.style.color = 'var(--accent)'; pill.style.borderColor = 'var(--accent)'; pill.style.background = 'var(--accent-soft, #fff5ed)'; }
  t2UpdateCost(); t2UpdateAnalyzeBtn();
  // Giải mã độ dài để hiện "tên · mm:ss" + phục vụ cảnh báo timing
  try {
    const dur = await _t2AudioDur(file);
    if (dur > 0) { _t2AudioDurCache = dur; const mm = Math.floor(dur / 60), ss = Math.round(dur % 60); nm.textContent = file.name + ' · ' + mm + ':' + String(ss).padStart(2, '0'); if (typeof t2RenderTimingWarn === 'function') t2RenderTimingWarn(); }
  } catch (e) {}
}

function t2UpdateAnalyzeBtn(){
  const btn = document.getElementById('t2AnalyzeBtn'); const hint = document.getElementById('t2AnalyzeHint');
  const hasScript = !!((document.getElementById('scriptInput')?.value) || '').trim();
  const hasAudio = !!((typeof t8State === 'object' && t8State && t8State.audioFile) || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile));
  const ok = hasScript && hasAudio;
  if (btn) { btn.style.opacity = ok ? '1' : '.55'; btn.style.filter = ok ? 'none' : 'grayscale(.3)'; }
  if (hint) hint.textContent = ok ? '✓ Đủ kịch bản + MP3 — sẵn sàng.' : (!hasScript && !hasAudio ? 'Cần dán kịch bản + đính MP3.' : (!hasScript ? 'Cần dán kịch bản.' : 'Cần đính MP3 giọng đọc để căn timing.'));
  if (hint) hint.style.color = ok ? 'var(--green)' : 'var(--amber)';
}

function t2UpdateCost(){
  const el = document.getElementById('t2CostLine'); if (!el) return;
  const nScene = (state.scenes || []).length;
  const nChar = (state.charactersV || []).length, nBg = (state.backgroundsV || []).length;
  let scenesTxt;
  if (nScene) scenesTxt = nScene + ' cảnh';
  else {
    const words = ((state.script || '').trim().match(/\S+/g) || []).length;
    const secMin = Math.max(1, parseInt((document.getElementById('minSecPerImg') || {}).value) || 3);
    const secMax = Math.max(secMin + 1, parseInt((document.getElementById('maxSecPerImg') || {}).value) || 8);
    const est = words ? Math.max(1, Math.round(words / (((secMin + secMax) / 2) * 2.6))) : 0;
    scenesTxt = est ? '~' + est + ' cảnh' : '—';
  }
  const parts = [scenesTxt];
  if (nChar) parts.push(nChar + ' nhân vật');
  if (nBg) parts.push(nBg + ' bối cảnh');
  const nAcc = (typeof flowAccountCount === 'function') ? flowAccountCount() : 0;
  if (nAcc) parts.push(nAcc + ' tài khoản Flow');
  el.innerHTML = parts.join(' · ').replace(scenesTxt, '<b style="color:var(--accent-2)">' + scenesTxt + '</b>');
}

function t2RenderTimingWarn(){
  const el = document.getElementById('t2TimingWarn'); if (!el) return;
  const sc = state.scenes || [];
  const af = (typeof t8State === 'object' && t8State && t8State.audioFile) || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile) || null;
  const audioDur = (typeof _t2AudioDurCache === 'number') ? _t2AudioDurCache : 0;
  if (!sc.length || !af || !audioDur) { el.style.display = 'none'; return; }
  const tot = sc.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
  const diff = Math.round(tot - audioDur);
  /* Lệch NỘI DUNG nặng hơn lệch tổng nhiều: tổng có thể khớp chằn chặn mà audio
     lại là bản đọc của kịch bản khác. Báo cái này trước, và không tự tắt khi
     "Căn lại" đã ép tổng cho khớp.                                             */
  if (_t2KhopCuoi && _t2KhopCuoi.tong > 30 && _t2KhopCuoi.ti < 0.6){
    el.style.display = 'flex';
    el.innerHTML = `❌ Audio KHÔNG khớp kịch bản — chỉ <b style="margin:0 3px">${Math.round(_t2KhopCuoi.ti * 100)}%</b>
      số từ (${_t2KhopCuoi.khop}/${_t2KhopCuoi.tong}) tìm thấy trong bản đọc. Timing của mọi cảnh đều không đáng tin.
      <span style="color:var(--text-dim);margin-left:6px">Tạo lại giọng cho đúng kịch bản đang mở, hoặc nạp đúng file audio.</span>
      <button class="btn ghost sm" style="margin-left:auto;border-color:var(--accent);color:var(--accent)" onclick="t2TimingFromAudio()">Căn lại bằng Whisper</button>`;
    return;
  }
  if (Math.abs(diff) <= 3) { el.style.display = 'none'; return; }
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  el.style.display = 'flex';
  el.innerHTML = `⚠️ Tổng cảnh <b style="margin:0 3px">${fmt(tot)}</b> lệch ${diff > 0 ? '+' : ''}${diff}s so với audio ${fmt(audioDur)}.
    <button class="btn ghost sm" id="t2AsrBtn" style="margin-left:auto;border-color:var(--accent);color:var(--accent)" onclick="t2TimingFromAudio()" title="Chạy lại Whisper (Groq → OpenAI → Local) để căn ranh giới cảnh theo giọng đọc thật">🎤 Căn lại theo giọng đọc</button>
    <button class="btn ghost sm" style="border-color:var(--amber);color:var(--amber)" onclick="t2FitAudioNow()" title="Co giãn đều cho TỔNG khớp audio — nhanh nhưng ranh giới từng cảnh vẫn là ước lượng">Khớp nhanh</button>`;
}

function t2QueueRegen(id, variant){
  id = String(id);
  const isB = variant === 'b';
  const store = isB ? state.scenePrompts2 : state.scenePrompts;
  if (!(store && store[id] && String(store[id]).trim()))
    return setStatus2('Cảnh ' + id + (isB ? ' (ảnh B)' : '') + ' chưa có prompt — không tạo lại được.', 'error');
  const key = isB ? id + '::b' : id;
  if (_t2RegenPending.has(key)) return;
  _t2RegenPending.add(key); _t2RegenTotal++;
  _t2RegenSeen.set(key, 'wait'); _t2RegenPanelOpen = true;   // hiện khung ảnh đang tạo lại
  _t2MarkQueued(id); _t2RegenBar();
  setStatus2('➕ Xếp hàng tạo lại (' + _t2RegenPending.size + ' chờ) — bấm thêm cảnh để nối hàng; chạy song song theo số tài khoản.', 'working');
  _t2StartRegenPool();
}

async function t2RewriteDescs(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  const nc = (state.charactersV || []).length, nb = (state.backgroundsV || []).length;
  if (!nc && !nb) { setStatus2('Chưa có nhân vật/bối cảnh. Bấm "✨ Phân tích kịch bản" trước.', 'error'); return; }
  if (!confirm(`Viết LẠI mô tả cho ${nc} nhân vật + ${nb} bối cảnh? (tốn lượt AI — chỉ dùng khi muốn làm mới mô tả)`)) return;
  state.assetCharPrompts = {}; state.assetBgPrompts = {};   // xoá cũ → buộc viết lại tất cả
  loadAssetsFromTool2(true);
  setStatus2('✍️ Đang viết lại mô tả nhân vật + bối cảnh…', 'working');
  try { await genAllAssetPrompts(); if (typeof renderT2Assets === 'function') renderT2Assets(); setStatus2('✓ Đã viết lại mô tả xong.', 'ok'); }
  catch (e) { setStatus2('Lỗi viết mô tả: ' + (e.message || e), 'error'); }
}

function t2RenderStockRows(){
  const box = document.getElementById('t2StockRows'); if (!box) return;
  const co = { pexels: getPexelsKey, pixabay: getPixabayKey, unsplash: getUnsplashKey };
  const co_key = _T2_NGUON.filter(n => (co[n.id]() || '').trim());
  if (!co_key.length){ box.innerHTML = '<span class="api-status"></span> Chưa có key nguồn nào'; return; }
  box.innerHTML = co_key.map(n => {
    const tt = _t2StockTT[n.id];
    const lop = tt ? (tt.ok ? ' ok' : ' err') : '';
    return `<span style="margin-right:11px;white-space:nowrap" title="${escapeHtml(tt ? tt.msg : 'chưa thử')}"><span class="api-status${lop}"></span>${n.ten}</span>`;
  }).join('') + (_T_NGUON_HONG().length
    ? ` <span style="color:var(--red)">· ${escapeHtml(_T_NGUON_HONG().join(', '))} lỗi</span>`
    : '');
}

async function t2TestStockAll(){
  const box = document.getElementById('t2StockRows');
  if (box) box.innerHTML = '<span class="api-status"></span> Đang thử…';
  for (const n of _T2_NGUON) if ((({ pexels: getPexelsKey, pixabay: getPixabayKey, unsplash: getUnsplashKey })[n.id]() || '').trim())
    await t2TestStockKey(n.id, true);
  t2RenderStockRows();
}

async function t2TestStockKey(nguon, imLang){
  const ten = { pexels: 'Pexels', pixabay: 'Pixabay', unsplash: 'Unsplash' }[nguon];
  const key = ({ pexels: getPexelsKey, pixabay: getPixabayKey, unsplash: getUnsplashKey })[nguon]();
  const ghi = (ok, msg) => {
    _t2StockTT[nguon] = { ok, msg };
    t2RenderStockRows();
    if (!imLang) setStatus5((ok ? '✓ ' : '✗ ') + ten + ': ' + msg, ok ? 'ok' : 'error');
  };
  if (!key){ delete _t2StockTT[nguon]; t2RenderStockRows();
    if (!imLang) setStatus5(ten + ': chưa có key.', 'info');
    return; }
  // Key Pexels không bao giờ có dạng "12345678-…" — đó là khuôn của Pixabay.
  // Bắt trước khi gọi mạng để khỏi tốn một lượt chỉ để nhận 401.
  if (nguon === 'pexels' && /^\d+-/.test(key)){
    ghi(false, 'đang là key Pixabay (dạng số-gạch ngang) — key Pexels dài ~56 ký tự, không có gạch');
    return;
  }
  let r;
  try {
    if (nguon === 'pexels') r = await searchPexels('ocean', 'videos');
    else if (nguon === 'pixabay') r = await searchPixabay('ocean', 'videos');
    else r = await searchUnsplash('ocean');
  } catch (e){ r = { _err: String(e.message || e).slice(0, 60) }; }
  const n = (r.videos || []).length + (r.photos || []).length;
  if (r._err) ghi(false, r._err);
  else ghi(true, 'chạy được — trả về ' + n + ' kết quả' + (nguon === 'unsplash' ? ' (không có video)' : ''));
}

async function t2FetchStockOne(sceneId, kwManual){
  const sc = (state.scenes || []).find(x => x.id === sceneId);
  if (!sc) return { err: 'Không thấy cảnh.' };
  if (!getPexelsKey() && !getPixabayKey()) return { err: 'Cần API key Pexels hoặc Pixabay (Cài đặt → Nguồn ảnh/video stock).' };
  const type = _t2LoaiMedia(sc);
  let kw = String(kwManual || '').trim();
  let cands = [], nguonLoi = [], goc = null;
  if (kw){
    // Người dùng gõ tay thì tôn trọng, tìm đúng chuỗi đó.
    try { const res = await searchAllSources(kw, type); nguonLoi = res._err || []; cands = _t2StockCands(res, type); }
    catch (e) { return { err: 'Lỗi tìm: ' + String(e.message || e).slice(0, 60) }; }
  } else {
    const dsScene = state.scenes || [];
    const vt = dsScene.findIndex(x => x.id === sceneId);
    goc = await generateSearchAngles(sc.text, { sceneId,
      truoc: vt > 0 ? dsScene[vt - 1].text : '', sau: (vt >= 0 && vt < dsScene.length - 1) ? dsScene[vt + 1].text : '' });
    if (!goc){
      try { kw = await generateSearchKeywords(sc.text); } catch (e) { return { err: 'Không suy được từ khoá — gõ tay giúp em.' }; }
      try { const res = await searchAllSources(kw, type); nguonLoi = res._err || []; cands = _t2StockCands(res, type); }
      catch (e) { return { err: 'Lỗi tìm: ' + String(e.message || e).slice(0, 60) }; }
    } else {
      const theoGoc = [];
      for (const g of goc){
        try { const res = await searchAllSources(g.q, type);
          (res._err || []).forEach(e => { if (!nguonLoi.includes(e)) nguonLoi.push(e); });
          // Trần MỖI góc: không cho một góc chiếm hết danh sách như bản cũ.
          theoGoc.push({ goc: g.goc, q: g.q, cands: _t2TronNguon(_t2StockCands(res, type)).slice(0, 6) });
        } catch (e) { /* góc lỗi thì bỏ, còn góc khác */ }
      }
      cands = _t2TronGoc(theoGoc);
      kw = goc.map(g => g.q).join(' · ');
    }
  }
  if (!state.stockCandidates) state.stockCandidates = {};
  const old = state.stockCandidates[sceneId] || [];
  const seen = new Set(old.map(c => c.downloadUrl));
  const fresh = cands.filter(c => c.downloadUrl && !seen.has(c.downloadUrl));
  state.stockCandidates[sceneId] = old.concat(fresh).slice(0, _T2_STOCK_MAX);
  if (typeof saveState === 'function') saveState(true);
  return { added: fresh.length, total: state.stockCandidates[sceneId].length, kw, nguonLoi,
           goc: goc ? goc.map(g => (_T2_GOC_NHAN[g.goc] || g.goc) + ': ' + g.q) : null };
}

async function t2FetchStockVideos(){
  const scenes = (state.scenes || []).filter(s => s.wantStock);
  if (!scenes.length){ setStatus2('Chưa có cảnh nào đánh dấu 🎞. Bật "🎞 Xen video stock" rồi bấm "Phân tích kịch bản".', 'error'); return; }
  if (!getPexelsKey() && !getPixabayKey()){ setStatus2('Cần API key Pexels hoặc Pixabay (Cài đặt → Tìm Media) để lấy video stock.', 'error'); return; }
  const _candsFrom = (res, sc) => _t2StockCands(res, _t2LoaiMedia(sc));
  if (!state.mediaPicks) state.mediaPicks = {};
  if (!state.stockCandidates) state.stockCandidates = {};
  clearCancel(); let done = 0, ok = 0;
  const lyDo = {};                                  // mã lý do loại, gộp cho cả lô
  const bacDem = {};                                // đếm cảnh phải leo xuống bậc 2 / 3
  const N = _t2SoLuong();
  await _t2SongSong(scenes, N, async (s) => {
    try {
      const type = _t2LoaiMedia(s);
      const kw = await generateSearchKeywords(s.text);
      let cands = _candsFrom(await searchAllSources(kw, type), s);
      // Leo thang: bậc 1 trượt thì thử bậc 2 (bối cảnh), rồi mới tới bậc 3 (nền chung).
      let _bacDung = 1;
      for (const _b of [2, 3]){
        if (cands.length || state.cancelRequested) break;
        try {
          const _kw = await generateSearchKeywords(s.text, { bac: _b });
          if (_kw && _kw !== kw){ cands = _candsFrom(await searchAllSources(_kw, type), s); if (cands.length) _bacDung = _b; }
        } catch (e) { /* bậc này hỏng thì thử bậc sau */ }
      }
      if (_bacDung > 1) bacDem[_bacDung] = (bacDem[_bacDung] || 0) + 1;
      if (cands.length){
        // Xếp theo điểm trước khi chốt — trước đây lấy thẳng cands[0].
        const xep = _t2XepUngVien(cands, s, _t2DaDung(s.id));
        Object.entries(xep.bo).forEach(([k, v]) => { lyDo[k] = (lyDo[k] || 0) + v; });
        const ds = xep.ds.length ? xep.ds : cands;      // loại sạch thì thà lấy nguyên bản còn hơn trắng cảnh
        state.stockCandidates[s.id] = ds.slice(0, _T2_STOCK_MAX);
        if (!state.mediaPicks[s.id]) state.mediaPicks[s.id] = ds[0];
        ok++;
      }
    } catch (e){ /* bỏ qua cảnh lỗi */ }
    finally { setStatus2(`🎞 Tìm stock… ${++done}/${scenes.length} cảnh · ${N} luồng`, 'working'); }
  }, () => state.cancelRequested);
  clearCancel();
  try { await _t2CuuCanhTrong(true); } catch (e) {}   // cảnh tìm không ra → về ảnh AI
  if (typeof saveState === 'function') saveState(true);
  if (typeof renderAllT2 === 'function') renderAllT2();
  const _ld = _t2LyDoChu(lyDo);
  const _bac = [2, 3].filter(b => bacDem[b]).map(b => `${bacDem[b]} cảnh phải xuống bậc ${b}`).join(', ');
  setStatus2(`✓ Đã lấy ${ok}/${scenes.length} stock cho cảnh 🎞${_bac ? ' · ' + _bac : ''}${_ld ? ' · loại: ' + _ld : ''} (bấm 🎞 trên cảnh để xem/đổi ứng viên). Vào Dựng Video để xem.`, ok ? 'ok' : 'info');
}

async function t2FetchWebOne(sceneId, kwManual, day){
  const sc = (state.scenes || []).find(x => x.id === sceneId);
  if (!sc) return { err: 'Không thấy cảnh.' };
  if (typeof searchWebSources !== 'function') return { err: 'Chưa nạp được nguồn web.' };
  if (!window.native || !window.native.nguonWeb) return { err: 'Nguồn web chỉ chạy trong app Nova.' };
  const dsBat = (typeof _webDangBat === 'function') ? _webDangBat() : [];
  if (!dsBat.length) return { err: 'Chưa bật nền tảng nào — bấm ⚙ để chọn.' };
  if (!state.webCandidates) state.webCandidates = {};

  let truyVan = [];
  const kw = String(kwManual || '').trim();
  if (kw){
    truyVan = [kw];                                     // gõ tay thì tôn trọng nguyên văn
  } else {
    const ds = state.scenes || [];
    const vt = ds.findIndex(x => x.id === sceneId);
    let goc = null;
    try {
      goc = await generateSearchAngles(sc.text, { sceneId,
        truoc: vt > 0 ? ds[vt - 1].text : '', sau: (vt >= 0 && vt < ds.length - 1) ? ds[vt + 1].text : '' });
    } catch (_) {}
    if (goc && goc.length) truyVan = goc.filter(g => g.goc !== 'doi-chieu').map(g => g.q).filter(Boolean);
    if (!truyVan.length){
      try { truyVan = [await generateSearchKeywords(sc.text)]; }
      catch (e){ return { err: 'Không suy được từ khoá — gõ tay giúp em.' }; }
    }
  }
  truyVan = truyVan.filter(Boolean).slice(0, 2);        // 2 góc là đủ; mỗi góc là một lượt tìm thật
  if (!truyVan.length) return { err: 'Không có từ khoá để tìm.' };

  const gom = [], loi = [];
  for (const q of truyVan){
    if (state.cancelRequested || _autoAbort) break;
    try {
      const r = await searchWebSources(q, { moiNen: 4, day: !!day, dungLai: () => state.cancelRequested || _autoAbort });
      (r.items || []).forEach(x => gom.push(Object.assign({ q }, x)));
      (r.loi || []).forEach(e => { if (!loi.includes(e)) loi.push(e); });
    } catch (e){ loi.push(String((e && e.message) || e).slice(0, 60)); }
  }

  const cu = state.webCandidates[sceneId] || [];
  const daCo = new Set(cu.map(c => c.trangUrl || c.downloadUrl));
  const moi = gom.filter(c => { const k = c.trangUrl || c.downloadUrl; if (!k || daCo.has(k)) return false; daCo.add(k); return true; });
  state.webCandidates[sceneId] = cu.concat(moi).slice(0, _T2_WEB_MAX);
  return { added: moi.length, total: state.webCandidates[sceneId].length, kw: truyVan.join(' · '), loi };
}

async function t2LayTuLieu(){
  const sc = state.scenes || [];
  if (!sc.length){ setStatus2('Chưa có cảnh nào. Bấm "Phân tích kịch bản" trước.', 'error'); return; }
  const coStock = sc.some(s => s.wantStock || s.wantKho);
  const coYt    = sc.some(s => s.wantYt);
  const coWeb   = sc.some(s => s.wantWeb);
  if (!coStock && !coYt && !coWeb){
    setStatus2('Chưa cảnh nào được giao nguồn ngoài. Bật "🌐 Nguồn web", chọn nền tảng ở ⚙, rồi bấm "Phân tích kịch bản".', 'error');
    return;
  }
  const xong = [];
  try {
    if (coStock){ await t2FetchStockVideos(); xong.push('kho ảnh/video'); }
    if (coYt && !state.cancelRequested){
      const r = await _autoFetchYtClips(sc.filter(s => s.wantYt), 20 * 60000);
      xong.push(`YouTube ${r.ok}/${r.ok + r.fail}`);
    }
    if (coWeb && !state.cancelRequested){ await t2FetchWebClips(); xong.push('nguồn web'); }
  } catch (e){
    setStatus2('Lỗi lấy tư liệu: ' + String((e && e.message) || e).slice(0, 80), 'error');
    return;
  }
  if (xong.length > 1) setStatus2('✓ Đã chạy: ' + xong.join(' · '), 'ok');
}

async function t2FetchWebClips(){
  const scenes = (state.scenes || []).filter(s => s.wantWeb);
  if (!scenes.length){ setStatus2('Chưa có cảnh nào đánh dấu 🌐. Bật "🌐 Nguồn web" rồi bấm "Phân tích kịch bản".', 'error'); return; }
  if (typeof webLayClip !== 'function'){ setStatus2('Chưa nạp được nguồn web.', 'error'); return; }
  if (!state.mediaPicks) state.mediaPicks = {};
  clearCancel();
  let done = 0, ok = 0;
  const loiChung = [];
  const N = _t2SoLuong();
  await _t2SongSong(scenes, N, async (s) => {
    try {
      const r = await t2FetchWebOne(s.id);
      (r.loi || []).forEach(e => { if (!loiChung.includes(e)) loiChung.push(e); });
      if (r.err) throw new Error(r.err);
      const hop = (state.webCandidates[s.id] || []).filter(x => !x.camTM);
      const xep = _t2XepUngVien(hop, s, _t2DaDung(s.id));
      Object.entries(xep.bo).forEach(([k, v]) => { loiChung.push('bỏ ' + v + ' ' + k); });
      const pick = xep.ds[0] || hop[0];                  // loại sạch thì vẫn lấy cái đầu còn hơn trắng cảnh
      if (!pick) return;
      if (state.mediaPicks[s.id]) { ok++; return; }      // cảnh đã có hình rồi thì giữ
      const clip = await webLayClip(pick, parseFloat(s.duration) || 4);
      if (!clip.ok) throw new Error(clip.error);
      state.mediaPicks[s.id] = { kind: 'video', downloadUrl: clip.dataUrl, source: pick.source,
        duration: clip.duration, web: true, trangUrl: pick.trangUrl, license: pick.license, author: pick.author };
      ok++;
    } catch (e){
      const m = String((e && e.message) || e).slice(0, 60);
      if (!loiChung.includes(m)) loiChung.push(m);
    } finally {
      // Chạy song song nên xong không theo thứ tự — đếm số VIỆC XONG, kèm số luồng.
      setStatus2(`🌐 Lấy tư liệu web… ${++done}/${scenes.length} cảnh · ${N} luồng`, 'working');
    }
  }, () => state.cancelRequested);
  clearCancel();
  try { await _t2CuuCanhTrong(true); } catch (e) {}   // cảnh tìm không ra → về ảnh AI
  if (typeof saveState === 'function') saveState(true);
  if (typeof renderAllT2 === 'function') renderAllT2();
  const nhip = (typeof webTrangThaiNhip === 'function') ? webTrangThaiNhip() : null;
  const themNhip = (nhip && nhip.chan) ? ' · công cụ tìm web đã chặn nhịp, nghỉ vài phút rồi bấm lại' : '';
  setStatus2(`${ok ? '✓' : '⚠️'} Web: ${ok}/${scenes.length} cảnh${loiChung.length ? ' · ' + loiChung.slice(0, 2).join(' · ') : ''}${themNhip}`, ok ? 'ok' : 'info');
}

function t2OpenWebPicker(sceneId, note){
  const cands = (state.webCandidates || {})[sceneId] || [];
  if (!cands.length && !note){
    setStatus2('Cảnh này chưa có ứng viên web. Bấm "🌐 Lấy tư liệu web" trước, hoặc mở lại bảng rồi bấm 🔎 Tìm thêm.', 'info');
    return;
  }
  let m = document.getElementById('t2WebPickerModal');
  if (!m){
    m = document.createElement('div');
    m.id = 't2WebPickerModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px';
    m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    document.body.appendChild(m);
  }
  m.dataset.scene = sceneId;
  m.style.display = 'flex';
  _t2WebPickerRender(sceneId, note);
}

function t2CloseWebPicker(){ const m = document.getElementById('t2WebPickerModal'); if (m) m.style.display = 'none'; }

async function t2WebTimThem(sceneId){
  const btn = document.getElementById('t2WebMoreBtn');
  const kw = (document.getElementById('t2WebKw') || {}).value || '';
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tìm…'; }
  const r = await t2FetchWebOne(sceneId, kw, true);   // bấm tay → quét cả nhóm chậm
  if (btn){ btn.disabled = false; btn.textContent = '🔎 Tìm thêm'; }
  const msg = r.err ? r.err
    : `Thêm ${r.added} ứng viên (tổng ${r.total}) · từ khoá: ${r.kw}${(r.loi || []).length ? ' · ' + r.loi.slice(0, 2).join(' · ') : ''}`;
  try { if (typeof saveState === 'function') saveState(true); } catch (_) {}
  _t2WebPickerRender(sceneId, msg);
}

async function t2PickWeb(sceneId, idx){
  const c = ((state.webCandidates || {})[sceneId] || [])[idx];
  if (!c) return;
  const sc = (state.scenes || []).find(x => x.id === sceneId);
  const note = document.getElementById('t2WebNote');
  if (note) note.innerHTML = '⏳ Đang tải và cắt clip bằng yt-dlp… (tư liệu dài có thể mất một lúc)';
  const r = await webLayClip(c, parseFloat(sc && sc.duration) || 4);
  if (!r.ok){ _t2WebPickerRender(sceneId, '⚠️ Không lấy được clip: ' + r.error); return; }
  if (!state.mediaPicks) state.mediaPicks = {};
  state.mediaPicks[sceneId] = { kind: 'video', downloadUrl: r.dataUrl, source: c.source,
    duration: r.duration, web: true, trangUrl: c.trangUrl, license: c.license, author: c.author };
  try { if (typeof saveState === 'function') saveState(true); } catch (_) {}
  try { if (typeof renderAllT2 === 'function') renderAllT2(); } catch (_) {}
  _t2WebPickerRender(sceneId, '✓ Đã gắn vào cảnh.');
}

function t2OpenStockPicker(sceneId, note, kwKeep){
  const cands = (state.stockCandidates || {})[sceneId] || [];
  const scene = (state.scenes || []).find(s => s.id === sceneId);
  if (!cands.length && !note){ setStatus2('Cảnh này chưa có ứng viên stock. Bấm "🎞 Lấy video stock" trước (hoặc mở lại bảng này rồi bấm 🔎 Tìm thêm).', 'info'); return; }
  const cur = state.mediaPicks?.[sceneId]?.downloadUrl || '';
  let modal = document.getElementById('t2StockPickerModal');
  if (!modal){
    modal = document.createElement('div');
    modal.id = 't2StockPickerModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    document.body.appendChild(modal);
  }
  const sceneNum = (state.scenes || []).findIndex(s => s.id === sceneId) + 1;
  const tiles = cands.map((c, i) => {
    const sel = cur && c.downloadUrl === cur;
    const isVid = c.kind === 'video';
    return `<div onclick="t2PickStock('${sceneId}',${i})" style="cursor:pointer;width:200px;border-radius:8px;overflow:hidden;border:2px solid ${sel ? 'var(--accent)' : 'var(--border)'};background:var(--surface-2)">
      <div style="position:relative;height:118px;background:#000">
        <img src="${_stockThumb(c)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.opacity=.2">
        <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px">${isVid ? '🎬 ' + (c.duration ? c.duration + 's' : 'video') : '📷 ảnh'}</span>
        ${sel ? '<span style="position:absolute;top:6px;right:6px;background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">✓ Đang dùng</span>' : ''}
      </div>
      <div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">
        <span>${_srcBadge(c.source)}${c.goc ? ` <em style="font-style:normal;color:var(--teal)">· ${escapeHtml(_T2_GOC_NHAN[c.goc] || c.goc)}</em>` : ''}</span>
        <span style="color:${sel ? 'var(--accent)' : 'var(--teal)'};font-weight:600">${sel ? '✓' : 'Chọn'}</span>
      </div>
    </div>`;
  }).join('');
  modal.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:900px;width:100%;max-height:88vh;overflow:auto;padding:20px" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <h3 style="margin:0;font-size:15px">🎞 Chọn media cho cảnh ${sceneNum || ''}</h3>
      <button class="btn ghost sm" style="margin-left:auto;padding:3px 10px" onclick="document.getElementById('t2StockPickerModal').style.display='none'">Đóng ✕</button>
    </div>
    <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px">${escapeHtml((scene?.text || '').slice(0, 160))}${(scene?.text || '').length > 160 ? '…' : ''}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <input id="t2StockKw" type="text" value="${escapeHtml(kwKeep || '')}" placeholder="Từ khoá tiếng Anh để tìm thêm (bỏ trống = AI tự suy từ lời đọc)" style="flex:1;min-width:240px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 11px;font-size:12.5px" onkeydown="if(event.key==='Enter')t2StockSearchMore('${sceneId}')">
      <button id="t2StockMoreBtn" class="btn ghost sm" style="border-color:var(--teal);color:var(--teal)" onclick="t2StockSearchMore('${sceneId}')">🔎 Tìm thêm</button>
      <span style="font-size:11.5px;color:var(--text-dim)">${cands.length} ứng viên</span>
    </div>
    ${note ? `<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:10px">${escapeHtml(note)}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:12px">${tiles || '<span style="font-size:12px;color:var(--text-dim)">Chưa có ứng viên nào — gõ từ khoá rồi bấm 🔎 Tìm thêm.</span>'}</div>
  </div>`;
  modal.style.display = 'flex';
}

async function t2StockSearchMore(sceneId){
  const kw = (document.getElementById('t2StockKw')?.value || '').trim();
  const btn = document.getElementById('t2StockMoreBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tìm…'; }
  const r = await t2FetchStockOne(sceneId, kw);
  const canhBao = (r.nguonLoi && r.nguonLoi.length) ? ' · ⚠️ ' + r.nguonLoi.join(' · ') : '';
  const tuKhoa = r.goc ? r.goc.join(' · ') : ('"' + r.kw + '"');
  const note = r.err ? '⚠️ ' + r.err
    : r.added ? `✓ Thêm ${r.added} ứng viên mới (tổng ${r.total}) · ${tuKhoa}${canhBao}`
    : `Không có ứng viên MỚI cho ${tuKhoa} — thử từ khoá khác.${canhBao}`;
  t2OpenStockPicker(sceneId, note, kw);
}

function t2PickStock(sceneId, idx){
  const cands = (state.stockCandidates || {})[sceneId] || [];
  const c = cands[idx];
  if (!c) return;
  if (!state.mediaPicks) state.mediaPicks = {};
  state.mediaPicks[sceneId] = c;
  if (typeof saveState === 'function') saveState(true);
  if (typeof renderAllT2 === 'function') renderAllT2();
  _t7RefreshAfterPick(sceneId);                          // đang ở Dựng Video thì thấy đổi ngay
  // Chỉ vẽ lại bảng khi bảng ĐANG mở (để cập nhật viền "Đang dùng").
  // Bấm chọn ở dải ứng viên bên phải Dựng Video cũng gọi vào đây — trước là bung
  // luôn cái bảng lớn chắn hết màn hình dù không ai mở nó.
  const _pm = document.getElementById('t2StockPickerModal');
  if (_pm && _pm.style.display !== 'none') t2OpenStockPicker(sceneId);
  setStatus2(`✓ Cảnh dùng ${c.kind === 'video' ? 'video' : 'ảnh'} ${_srcBadge(c.source)}${c.duration ? ' · ' + c.duration + 's' : ''}.`, 'ok');
}

