/* AUTO PIPELINE — _runPipeline, lịch sử job (_hist*), cấu hình kênh (applyChannelCfg, _capCfg/_appCfg)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _autoRender(){ /* thanh 9 bước lớn đã bỏ — tiến trình hiện ở dòng hàng đợi (mini bar). Giữ hàm rỗng cho các nơi còn gọi. */ }

function _autoSet(key, status, sub){
  _autoState[key] = { status, sub }; _autoRender();
  if (_queueCurId) {
    const j = _prodQueue.find(x => x.id === _queueCurId);
    if (j) {
      if (status === 'run') { const st = PROD_STEPS.find(s => s.key === key); j.detail = (st ? st.label : key) + (sub && sub !== 'đang chạy…' ? ': ' + sub : '…'); }
      queueRender();   // cập nhật thanh mini theo mọi thay đổi bước
    }
  }
}

function _autoLog(msg, type){
  _autoLastLog = { msg, type };
  const el = document.getElementById('autoLog'); if (!el) return;
  const c = type === 'error' ? 'var(--red)' : type === 'ok' ? 'var(--green)' : 'var(--text-muted)';
  el.innerHTML = `<span style="color:${c}">${escapeHtml(msg)}</span>`;
}

function _autoBumpDone(){
  try {
    localStorage.setItem('av_done_total', String((parseInt(localStorage.getItem('av_done_total') || '0') || 0) + 1));
    const k = 'av_done_' + _ymKey();
    localStorage.setItem(k, String((parseInt(localStorage.getItem(k) || '0') || 0) + 1));
  } catch (e) {}
}

async function _persistJob(heavy){ try { if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile(); await saveState(true, !heavy); } catch (e) {} queueSave(); }

function _stepTO(res){ return _STEP_TO[res] || 45 * 60000; }

function _clearAutoRetry(){ if (_autoRetryTimer) { clearTimeout(_autoRetryTimer); _autoRetryTimer = null; } }

function _histAdd(job, status, detail){
  try {
    const h = JSON.parse(localStorage.getItem('av_history') || '[]') || [];
    h.unshift({ t: Date.now(), title: job.title || '', profile: job.profileName || '', status, detail: (detail || job.detail || '').slice(0, 80) });
    localStorage.setItem('av_history', JSON.stringify(h.slice(0, 60)));
  } catch (e) {}
}

function _histClear(){ try { localStorage.removeItem('av_history'); } catch (e) {} _histRender(); }

async function _dashFlowStatus(){
  const el = document.getElementById('dashFlowAcc'); if (!el) return;
  try {
    if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1200))) { el.innerHTML = '<span style="color:var(--amber)">chưa kết nối extension Flow</span>'; return; }
    const st = await flowBridge.call('GET_STATUS');
    const n = st?.accountCount || 0;
    if (!n) el.innerHTML = '<span style="color:var(--amber)">chưa đăng nhập tài khoản nào</span>';
    else if (n === 1) el.innerHTML = '<b>1</b> tài khoản · <span style="color:var(--text-dim)">thêm ≥2 để tự bật pool (chia + song song)</span>';
    else el.innerHTML = '<b style="color:var(--green)">⚡ ' + n + ' tài khoản · pool TỰ BẬT</b> <span style="color:var(--text-dim)">(chia đều + chạy song song + né quota)</span>';
  } catch (e) { el.innerHTML = '<span style="color:var(--text-dim)">—</span>'; }
}

function _histRender(){
  const box = document.getElementById('histList'); if (!box) return;
  let h = []; try { h = JSON.parse(localStorage.getItem('av_history') || '[]') || []; } catch (e) {}
  if (!h.length) { box.innerHTML = '<div class="empty-state" style="padding:10px 4px;font-size:12px">Chưa có lịch sử.</div>'; return; }
  const ic = { done: ['✓', 'var(--green)'], error: ['✕', 'var(--red)'], paused: ['⏸', 'var(--amber)'] };
  box.innerHTML = h.slice(0, 20).map(r => {
    const m = ic[r.status] || ['•', 'var(--text-muted)'];
    let tm = ''; try { tm = new Date(r.t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border);font-size:12.5px">
      <span style="color:${m[1]};font-weight:700;width:14px;text-align:center">${m[0]}</span>
      <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.title || '(không tên)')}</span>
      <span style="font-size:11px;color:var(--text-dim);font-family:ui-monospace,monospace;white-space:nowrap">${escapeHtml(r.profile || '')} · ${escapeHtml(r.detail || '')}</span>
      <span style="font-size:11px;color:var(--text-dim);white-space:nowrap">${tm}</span>
    </div>`;
  }).join('');
}

function _capCfg(fields){ const o = {}; for (const id in fields){ const el = document.getElementById(id); if (!el) continue; o[id] = fields[id] === 'c' ? !!el.checked : el.value; } return o; }

function _appCfg(fields, cfg){ if (!cfg) return; for (const id in fields){ if (!(id in cfg)) continue; const el = document.getElementById(id); if (!el) continue; if (fields[id] === 'c') el.checked = !!cfg[id]; else el.value = cfg[id]; } }

function applyChannelCfg(p){
  p = p || ((typeof getProfile === 'function') ? getProfile() : null); if (!p) return;
  _appCfg(_T2_FIELDS, p.t2Cfg);
  if (p.voiceCfg) _appCfg(_VOICE_FIELDS, p.voiceCfg);
  // _appCfg set .value trực tiếp → sự kiện oninput không chạy, label thanh trượt
  // (Tốc độ / Cao độ) vẫn hiển thị số cũ. Đồng bộ lại label cho khớp giá trị thật.
  const _vSync = (id, val, fmt) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };
  const sp = (document.getElementById('voiceSpeed') || {}).value;
  if (sp !== undefined) _vSync('vSpeedVal', sp, v => (+v).toFixed(2) + '×');
  const pt = (document.getElementById('voicePitch') || {}).value;
  if (pt !== undefined) _vSync('vPitchVal', pt, v => (+v > 0 ? '+' : '') + v + ' st');
}

async function _purgeJobVideo(job){
  if (!job || !job.videoId) return;
  const p = (state.profiles || [])[job.profileIdx]; if (!p || !Array.isArray(p.videos)) return;
  const idx = p.videos.findIndex(v => v.id === job.videoId); if (idx < 0) return;
  try { const uid = window.currentUser?.uid; if (uid && p.profileId){ const b = uid + '/' + p.profileId + '/' + job.videoId + '/'; for (const k of ['styleRefImages','characterImages','backgroundImages','sceneImages','sceneImagesB','sceneVideoBlobs','sceneVideosMeta','motionPrompts','voiceMp3']){ try { await IDB.set(b + k, null); } catch (e) {} } } } catch (e) {}
  if (p.videos.length > 1) {
    const wasCur = p.currentVideoId === job.videoId;
    p.videos.splice(idx, 1);
    if (wasCur) p.currentVideoId = p.videos[Math.max(0, idx - 1)].id;
  } else { p.videos[idx].workData = createEmptyWorkData(); }   // video duy nhất → giữ vỏ, dọn ruột
  try { await saveState(true); } catch (e) {}
  if (state.currentProfileIdx === job.profileIdx) { loadStateFromProfile(p); try { await loadProfileImages(p.profileId, p.currentVideoId); } catch (e) {} if (typeof rerenderAllAfterProfileLoad === 'function') rerenderAllAfterProfileLoad(); if (typeof renderVideoSelect === 'function') renderVideoSelect(); }
}

async function _runPipeline(job){
  const topic = job.topic || ''; const startFrom = job.startFrom || 'script';
  const resuming = !!job.videoId;   // đã có video → đang làm tiếp (chỉ bù bước/ảnh còn thiếu)

  // Đúng profile của job
  if (typeof job.profileIdx === 'number' && job.profileIdx >= 0 && job.profileIdx !== state.currentProfileIdx && typeof switchProfile === 'function') {
    try { await switchProfile(job.profileIdx); } catch (e) {}
  }
  try { applyChannelCfg(getProfile()); } catch (e) {}   // dùng cấu hình Tool 2 + giọng RIÊNG của kênh này
  if (!resuming) {
    try { await newVideo(); } catch (e) {}   // lần đầu: video trắng riêng
    const nv = (typeof getCurrentVideo === 'function') ? getCurrentVideo(getProfile()) : null;
    if (nv) { job.videoId = nv.id; if (job.title) nv.name = job.title; }
    job.step = 0;
    PROD_STEPS.forEach(s => _autoState[s.key] = { status: 'idle' });
  } else {
    try { if (typeof switchVideo === 'function') await switchVideo(job.videoId); } catch (e) {}   // nạp lại video đã làm dở
    PROD_STEPS.forEach((s, idx) => _autoState[s.key] = { status: idx < (job.step || 0) ? 'done' : 'idle' });
  }
  _autoRender();
  const getVid = () => { const p = getProfile(); return (typeof getCurrentVideo === 'function') ? getCurrentVideo(p) : null; };

  const RUN = {
    script: async () => {
      if (startFrom === 'scenes') {
        let scr = (job.script || '').trim();
        if (!scr) { try { scr = ((await IDB.get('qs_' + job.id)) || '').trim(); } catch (e) {} if (scr) job.script = scr; }   // nạp lại từ IndexedDB sau khi khởi động lại
        scr = scr || state.script || '';
        if (!scr) throw new Error('Chưa có kịch bản.');
        state.script = scr; const si = document.getElementById('scriptInput'); if (si) si.value = scr; return { sub: scr.length + ' ký tự (có sẵn)' };
      }
      const tt = document.getElementById('tsTopic'); if (tt) tt.value = topic;
      // Đồng bộ QUY MÔ đúng như tab: chương × từ/chương × ngôn ngữ → tsUpdateScale() tự ghi
      // tsWords = chương × từ/chương VÀ tự bật Chế độ Novel khi ≥ 2 chương (đúng hành vi
      // người dùng chỉnh tay trên tab — pipeline không lệch quy mô với tab nữa).
      // Job cũ (chỉ có words, hàng đợi lưu trước bản này) → giữ đường cũ: ghi thẳng tổng từ.
      if (job.chapters != null) {
        const ch = document.getElementById('tsChapters'); if (ch) ch.value = job.chapters;
        const wp = document.getElementById('tsWordsPerChapter'); if (wp) wp.value = job.wpc || 1200;
        const lg = document.getElementById('tsLang'); if (lg && job.lang) lg.value = job.lang;
        if (typeof tsUpdateScale === 'function') tsUpdateScale();
      } else {
        const tw = document.getElementById('tsWords'); if (tw && job.words) tw.value = job.words;
      }
      await tsGenerate(false);
      const scr = (document.getElementById('tsOutput')?.value || '').trim();
      if (!scr) throw new Error('AI chưa tạo được kịch bản (kiểm tra AI provider / CLI bridge).');
      const si = document.getElementById('scriptInput'); if (si) si.value = scr; state.script = scr;
      return { sub: scr.length + ' ký tự' };
    },
    voice: async () => {
      if (startFrom === 'scenes') { const vf = _queueVoice[job.id]; if (vf) { t7State.audioFile = vf; return { sub: 'file có sẵn' }; } return { skip: true, sub: 'bỏ qua' }; }
      // Gọi thẳng engine. Trước đây bước này bấm nút rồi CÀO thẻ <audio> trong
      // DOM — backend chết là cả job chết. Giờ ttsDoc() tự lui về engine còn sống.
      if (!_giongDS.length) await giongTaiDS();
      const vt = document.getElementById('voiceText'); if (vt){ vt.value = state.script; giongDemChu(); }
      const { blob, giong, engine, luiVe } = await ttsDoc(state.script, null);
      const mp3 = /(mpeg|mp3)/.test(blob.type);
      await t7HandleAudio(new File([blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: blob.type || 'audio/wav' }));
      return { sub: giong.name + (luiVe ? ' (lui về ' + _TTS_TEN[engine] + ')' : '') };
    },
    scenes: async () => {
      const si = document.getElementById('scriptInput'); if (si) si.value = state.script;
      // Áp mức xen video 🎞/🎬 mà kênh đã chọn (ghi lúc Thêm) — vì newVideo() vừa đưa DOM về mặc định.
      if (job.videoMix != null){ state.videoMix = job.videoMix; const e = document.getElementById('t2VideoMix'); if (e) e.value = String(job.videoMix); }
      if (job.stockMix != null){ state.stockMix = job.stockMix; const e = document.getElementById('t2StockMix'); if (e) e.value = String(job.stockMix); }
      if (job.ytMix != null){ state.ytMix = job.ytMix; const e = document.getElementById('t2YtMix'); if (e) e.value = String(job.ytMix); }
      if (job.nguonBat){ state.nguonBat = Object.assign({ veo:false, stock:false, yt:false, kho:false, web:false }, job.nguonBat); try { t2RenderNguon(); } catch (e) {} }
      if (job.webBat && Object.keys(job.webBat).length) state.webBat = Object.assign({}, job.webBat);
      // Đưa file giọng vào Tool 2 để TỰ CĂN TIMING (Whisper) — thời lượng cảnh khớp giọng đọc. Không có giọng → dùng độ dài ước lượng.
      try { _autoAudioFile = (t7State && t7State.audioFile) || null; _autoAudioWords = null; } catch (e) {}
      const chk = document.getElementById('autoFlowImages'); const prev = chk ? chk.checked : false; if (chk) chk.checked = false;
      try { await runAutoTool2(); } finally { if (chk) chk.checked = prev; }
      const n = (state.scenes || []).length; if (!n) throw new Error('Chưa chia được cảnh.'); return { sub: n + ' cảnh' + (t7State.audioFile ? ' (căn theo giọng)' : '') };
    },
    assets: async () => { await runAutoTool3(); return { sub: ((state.charactersV || []).length + (state.backgroundsV || []).length) + ' asset' }; },
    seo: async () => {
      if (typeof t9Init === 'function') t9Init();
      const ti = document.getElementById('t9Title'); if (ti) ti.value = topic || '';
      await t9Generate(); if (!t9State.result) throw new Error('SEO chưa tạo được.');
      const seoTitle = (t9State.result.titles && t9State.result.titles[0]) || ''; const finalTitle = topic || seoTitle;
      if (finalTitle && finalTitle !== job.title) { job.title = finalTitle; const v = getVid(); if (v) v.name = finalTitle; queueRender(); }
      return { sub: 'xong' };
    },
    images: async () => {
      // Tự lưu ảnh về máy vào thư mục của video này (đặt tên theo cảnh/nhân vật). Giữ lại cấu hình cũ của tab Flow.
      const prevAsv = state.autoSave;
      const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      state.autoSave = { enabled: !!idir, mode: 'perTask', folder: idir, taskName: _slug(job.title) };
      let n = 0, quota = '';
      try {
        for (const r of [await tfGenAssets('char', resuming), await tfGenAssets('bg', resuming), await tfGenScenes(resuming)]) {
          if (r && r.skipped) { if (_isQuotaErr(r.reason)) return { quota: true, reason: r.reason }; throw new Error(r.reason || 'Flow chưa sẵn sàng'); }
          n += (r && r.done) || 0;
          if (r && r.err > 0 && _isQuotaErr(r.lastErr || r.error || '')) quota = r.lastErr || r.error;
        }
      } finally { state.autoSave = prevAsv; }
      if (quota) return { quota: true, reason: quota, sub: n + ' ảnh (còn thiếu)' };
      return { sub: n + ' ảnh' };
    },
    videos: async () => {
      // Xen video cho cảnh đánh dấu: 🎞 stock (free) + 🎬 Veo (best-effort) + ▶️ clip YouTube. Không cảnh nào đánh dấu → bỏ qua.
      const scenes = state.scenes || [];
      const wantStock = scenes.filter(s => s.wantStock || s.wantKho);   // kho mở đi chung đường lấy stock
      const wantVideo = scenes.filter(s => s.wantVideo);
      const wantYtAll = scenes.filter(s => s.wantYt);
      const wantWebAll = scenes.filter(s => s.wantWeb);
      if (!wantStock.length && !wantVideo.length && !wantYtAll.length && !wantWebAll.length) return { skip: true, sub: 'không có cảnh xen video' };
      const parts = [];
      // 1) STOCK 🎞 — free, ổn định (Pexels/Pixabay)
      if (wantStock.length){
        if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
          try { await t2FetchStockVideos(); const got = wantStock.filter(s => state.mediaPicks?.[s.id]).length; parts.push(`${got}/${wantStock.length} stock`); }
          catch (e){ parts.push('stock lỗi'); }
        } else parts.push('stock: thiếu API key (Cài đặt)');
      }
      // 2) VEO 🎬 — best-effort, tốn quota Flow; bỏ qua nếu hết quota / gói không mở tool6 / lỗi (KHÔNG làm dừng pipeline)
      if (wantVideo.length && typeof isToolAllowed === 'function' && isToolAllowed('tool6') && !_flowExhausted){
        try {
          mvLoadScenes();
          const ids = new Set(wantVideo.map(s => s.id));
          mvScenes = mvScenes.filter(s => ids.has(s.origId || s.id) && s.img && s.img.base64 && s.variant !== 'b');
          if (mvScenes.length){
            await mvGenerate();                              // sinh motion prompt cho cảnh 🎬
            if (!_autoAbort) await mvVideoGenerate();        // tạo video Veo (lỗi/quota tự ghi per-cảnh, không throw)
            const got = wantVideo.filter(s => mvVideoBlobs[s.id]).length;
            parts.push(`${got}/${wantVideo.length} Veo`);
          }
        } catch (e){ parts.push('Veo bỏ qua (' + (e.message || 'lỗi') + ')'); }
        finally { try { mvLoadScenes(); } catch (e){} }      // khôi phục danh sách cảnh đầy đủ
      } else if (wantVideo.length){
        parts.push('Veo bỏ qua (hết quota / gói chưa mở)');
      }
      // 3) YOUTUBE ▶️ — cắt clip thật đúng thời lượng cảnh (yt-dlp + FFmpeg trên máy). Bỏ cảnh đã có stock; lỗi KHÔNG làm dừng pipeline.
      const wantYt = wantYtAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantYt.length && !_autoAbort){
        const ry = await _autoFetchYtClips(wantYt);
        parts.push(`${ry.ok}/${wantYt.length} YouTube${ry.stop ? ' (dừng: ' + ry.stop + ')' : ''}`);
      }
      // 4) NGUỒN WEB 🌐 — 55 nền tảng; tìm rồi cắt đúng giây cảnh bằng yt-dlp.
      const wantWeb = wantWebAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantWeb.length && !_autoAbort){
        const rw = await _autoFetchWebClips(wantWeb);
        parts.push(`${rw.ok}/${wantWeb.length} web${rw.stop ? ' (dừng: ' + rw.stop + ')' : ''}`);
      }
      // 5) CỨU cảnh vẫn trống — trả về ảnh AI + sinh prompt bù, không để cảnh đen.
      if (!_autoAbort){
        try { const rc = await _t2CuuCanhTrong(true); if (rc.cuu) parts.push(`${rc.cuu} cảnh về ảnh AI`); }
        catch (e){ /* cứu hỏng thì thôi, đừng chặn pipeline */ }
      }
      return { sub: parts.join(', ') || 'xong' };
    },
    thumb: async () => {
      const ti = document.getElementById('t10TitleInput'); const title = topic || job.title || (t9State.result?.titles?.[0] || '');
      if (ti) ti.value = title; await t10Generate();
      if (!(t10State.results || []).length) throw new Error('Thumbnail chưa tạo được (Flow?).');
      // Lưu thumbnail: bản nhỏ vào workData (xem lại trong app) + file đầy đủ ra thư mục video.
      try {
        const first = t10State.results[0];
        if (first && first.dataUrl) {
          const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.thumbUrl = await _shrinkDataUrl(first.dataUrl, 360, 0.72); }
          const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
          if (idir && window.native?.saveFile) { try { await window.native.saveFile({ dir: idir, subdir: _slug(job.title), name: 'thumbnail.png', base64: first.dataUrl }); } catch (e) {} }
        }
      } catch (e) {}
      return { sub: t10State.results.length + ' ảnh' };
    },
    build: async () => { t7Build(); const n = (t7State.clips || []).length; if (!n) throw new Error('Không có cảnh để dựng.'); return { sub: n + ' clip' }; },
    export: async () => {
      if (!(window.native && typeof window.native.renderVideo === 'function')) return { skip: true, sub: 'chỉ desktop' };
      // Nơi lưu RIÊNG của video này (đã ghi lúc thêm); fallback về cài đặt chung nếu job cũ.
      let base = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      const wrap = ((job.saveName != null ? job.saveName : _autoSaveName) || '').trim();
      const mode = job.saveMode || _autoSaveMode || 'perTask';
      if (wrap) base = base ? (base + '/' + _slug(wrap)) : _slug(wrap);
      const nf = _slug(job.title);
      const finalDir = (mode === 'flat') ? base : (base ? (base + '/' + nf) : nf);
      const d = document.getElementById('t7ExpDir'); if (d) d.value = finalDir;
      const nm = document.getElementById('t7ExpName'); if (nm) nm.value = nf;
      await t7DoExport();
      try { const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.exportPath = (finalDir ? finalDir + '/' : '') + nf + '.mp4'; } } catch (e) {}   // nhớ nơi file xuất
      return { sub: (mode === 'flat') ? 'đã xuất' : ('→ ' + nf) };
    },
  };

  for (let i = job.step || 0; i < PROD_STEPS.length; i++) {
    const s = PROD_STEPS[i];
    if (_autoAbort) throw new Error('Đã dừng theo yêu cầu.');
    // Flow đã hết quota trong phiên này → tạm dừng ngay tại bước Flow, không gọi phí thêm.
    if (s.res === 'flow' && _flowExhausted) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(false); const e = new Error('Hết giới hạn Flow'); e.flowQuota = true; throw e; }
    _autoSet(s.key, 'run', 'đang chạy…');
    let res;
    try {
      res = await Promise.race([
        RUN[s.key](),
        new Promise((_, rej) => setTimeout(() => { const e = new Error('Quá giờ (' + Math.round(_stepTO(s.res) / 60000) + ' phút) ở bước ' + s.label); e.timeout = true; rej(e); }, _stepTO(s.res))),
      ]);
    } catch (e) {
      if (e.timeout) { try { if (typeof stopAutoTool2 === 'function') stopAutoTool2(); if (typeof tfStop === 'function') tfStop(); if (typeof requestCancel === 'function') requestCancel(); } catch (_) {} }
      if (s.res === 'flow' && _isQuotaErr(e.message)) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(e.message); q.flowQuota = true; throw q; }
      _autoSet(s.key, 'error', (e.message || 'lỗi').slice(0, 32)); await _persistJob(s.res === 'flow'); throw e;
    }
    if (res && res.quota) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(res.reason || 'Hết giới hạn Flow'); q.flowQuota = true; throw q; }
    if (res && res.skip) { _autoSet(s.key, 'skip', res.sub || 'bỏ qua'); }
    else { _autoSet(s.key, 'done', (res && res.sub) || 'xong'); }
    job.step = i + 1; await _persistJob(s.res === 'flow'); queueRender();
  }
}

function _toggleQueueBtns(running){
  const r = document.getElementById('queueRunBtn'), st = document.getElementById('queueStopBtn');
  if (r) r.style.display = running ? 'none' : ''; if (st) st.style.display = running ? '' : 'none';
}

function _composeHasContent(){
  const sf = document.getElementById('dashStart')?.value || 'script';
  if (sf === 'script') return !!(document.getElementById('dashTopic')?.value || '').trim();
  return !!((_autoScriptText || '').trim() || (state.script || '').trim());
}

