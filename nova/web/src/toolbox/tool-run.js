/* AUTO-EXTRACTED from index.html block 3 - prefix: run */

async function runQueue(){
  if (_queueRunning) return;
  _clearAutoRetry();   // chạy tay → huỷ hẹn tự thử lại
  // Form đang soạn còn nội dung → tự thêm thành 1 video trước khi chạy.
  if (_composeHasContent()) queueAdd();
  if (!_prodQueue.some(j => _QRUN.includes(j.status))) return _autoLog('Hàng đợi trống — điền chủ đề (hoặc thêm video) trước khi chạy.', 'error');
  _queueRunning = true; _queueAbort = false; _autoAbort = false; _flowExhausted = false;
  _toggleQueueBtns(true);
  const attempted = new Set();
  let ok = 0, fail = 0, paused = 0;
  while (!_queueAbort) {
    const job = _prodQueue.find(j => _QRUN.includes(j.status) && !attempted.has(j.id));
    if (!job) break;
    attempted.add(job.id);
    _queueCurId = job.id; job.status = 'running';
    if (!job.detail || job.detail === 'chờ tới lượt') job.detail = 'bắt đầu…';
    _autoTopic = job.topic || ''; queueSave(); queueRender();
    _autoLog((job.videoId ? '▶ Làm tiếp: ' : '▶ Đang làm: ') + job.title, 'info');
    try {
      await _runPipeline(job);
      job.status = 'done'; job.detail = 'đã dựng — sang Dựng Video để xuất'; ok++; _autoBumpDone(); _histAdd(job, 'done', 'đã dựng (chưa xuất)');
    } catch (e) {
      if (e && e.flowQuota) {
        // Hết giới hạn Flow → TẠM DỪNG video này (đã lưu dữ liệu/ảnh), chuyển sang video khác làm bước CLI.
        job.status = 'paused'; job.detail = '⏸ chờ Flow (hết quota) · đã lưu, sẽ làm tiếp khi có quota';
        _flowExhausted = true; paused++; _histAdd(job, 'paused', 'chờ Flow (hết quota)');
      } else if (_queueAbort) { job.status = 'paused'; job.detail = 'tạm dừng — bấm Chạy để làm tiếp'; }
      else { job.status = 'error'; job.detail = (e.message || 'lỗi').slice(0, 60); fail++; _histAdd(job, 'error', e.message || 'lỗi'); }
    }
    _queueCurId = null; queueSave(); queueRender();
  }
  _queueRunning = false; _toggleQueueBtns(false);
  const msg = `Xong: ${ok} video${paused ? `, ${paused} chờ Flow` : ''}${fail ? `, ${fail} lỗi` : ''}.`;
  // (2) Còn video "Chờ Flow" và không phải do user dừng → tự hẹn thử lại sau _RETRY_MIN phút.
  _clearAutoRetry();
  if (paused > 0 && !_queueAbort) {
    _autoLog(msg + ` Tự thử lại sau ${_RETRY_MIN} phút (hoặc bấm Chạy hàng đợi ngay).`, 'info');
    _autoRetryTimer = setTimeout(() => { if (!_queueRunning && _prodQueue.some(j => j.status === 'paused')) { _autoLog('⏳ Tự thử lại các video chờ Flow…', 'info'); runQueue(); } }, _RETRY_MIN * 60000);
  } else {
    _autoLog(msg, fail ? 'error' : 'ok');
  }
  if (typeof notifyDone === 'function' && (ok || paused || fail)) notifyDone('Hàng đợi sản xuất', msg);
  try { if (state.tool === 'tooldash') renderDashboard(); } catch (e) {}
}

async function runConcurrent(items, worker, limit, shouldStop){
  limit = Math.max(1, limit | 0);
  let idx = 0;
  const results = new Array(items.length);
  async function lane(){
    while (true) {
      if (shouldStop && shouldStop()) return;
      const i = idx++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); }
      catch (e) { results[i] = { __error: e }; console.warn('runConcurrent item lỗi:', e); }
    }
  }
  const lanes = [];
  for (let k = 0; k < Math.min(limit, items.length); k++) lanes.push(lane());
  await Promise.all(lanes);
  return results;
}

async function runAutoTool2(){
  if (_autoRunning) return;
  syncTool2();

  // --- Tiền kiểm tra ---
  const p = getProfile();
  if (!p) return setStatus2('Cần tạo Profile (Tool 1) trước khi chạy Auto.', 'error');
  if (!state.script.trim()) return setStatus2('Dán kịch bản vào ô bên trên trước đã.', 'error');

  _autoRunning = true;
  _autoStopFlag = false;
  clearCancel();
  _toggleAutoUI(true);
  _autoRenderSteps();
  _autoStepsAll().forEach((_, i) => _autoSetStep(i, null));

  const t0 = Date.now();
  const stopped = () => _autoStopFlag;  // inner funcs tự clearCancel, nên dựa vào cờ riêng

  try {
    // BƯỚC 0→3 — Lọc + Chia cảnh + Căn timing (lần 1) + Tách cảnh dài (CHỈ khi chưa có cảnh → tránh xoá prompt cũ khi chạy tiếp)
    if (state.scenes.length === 0){
      _autoSetStep(0, 'active');
      cleanScript(); syncTool2();
      _autoSetStep(0, 'done');
      if (stopped()) throw 'STOP';

      _autoSetStep(1, 'active');
      await doSplit();
      if (!state.scenes.length){ _autoSetStep(1, 'fail'); throw new Error('Chia cảnh không ra cảnh nào — kiểm tra lại kịch bản.'); }
      // Gộp câu vụn (local, tức thì) — luôn chạy, không tốn AI
      mergeFragmentScenes();
      // Gộp theo Ý (AI): CHỈ chạy cho Chia nhanh (regex không hiểu "ý").
      // Chia thông minh (AI) đã gộp câu theo ý hình ảnh rồi → bỏ qua để khỏi lặp 1 lượt AI + tránh gộp quá tay.
      if (state.splitMode !== 'smart') {
        setStatus2('AI đang gộp cảnh theo ý...', 'working');
        await mergeScenesByMeaningAI(true);
      }
      _autoSetStep(1, 'done');
      if (stopped()) throw 'STOP';

      // Căn timing LẦN 1 (TRƯỚC tách) từ MP3 — để tách cảnh dài dựa trên độ dài THẬT
      try {
        const n1 = await _autoAlignAudioOnce();
        _autoSetStep(2, n1 == null ? 'skip' : 'done');
      } catch(e){ console.warn('Auto căn timing 1 lỗi:', e); _autoSetStep(2, 'fail'); }
      if (stopped()) throw 'STOP';

      // Cân đều cảnh: gộp cảnh ngắn + tách cảnh dài → mỗi ảnh trong khoảng min–max (dựa trên độ dài thật nếu đã căn)
      _autoSetStep(3, 'active');
      {
        const _maxSec = parseInt(document.getElementById('maxSecPerImg')?.value) || 8;
        let _minSec = parseInt(document.getElementById('minSecPerImg')?.value);
        if (!(_minSec >= 1)) _minSec = Math.max(2, Math.round(_maxSec / 2.5));
        if (_minSec >= _maxSec) _minSec = Math.max(2, _maxSec - 2);
        _balanceScenesCore(_minSec, _maxSec);
      }
      _autoSetStep(3, 'done');

      // SO SÁNH cảnh vs kịch bản gốc — bắt lỗi chia sai/rác (vd AI trả suy luận thay vì cảnh)
      const diff = _diffScenesScript();
      if (!diff.exact && (diff.missN + diff.extraN) > Math.max(10, Math.round(diff.oLen * 0.05))) {
        _autoSetStep(1, 'fail');
        throw new Error(`Cảnh KHÔNG khớp kịch bản gốc (thiếu ${diff.missN} từ, thừa ${diff.extraN} từ) — có thể AI chia sai/trả rác. Bấm "🗑 Xoá hết" rồi chia lại bằng "Chia nhanh (regex)", hoặc đổi provider sang Claude/OpenAI cho bước chia.`);
      }
      setStatus2(diff.exact
        ? `✓ Cảnh khớp 100% kịch bản gốc (${diff.oLen} từ).`
        : `✓ Cảnh khớp kịch bản (lệch nhỏ: thiếu ${diff.missN}, thừa ${diff.extraN} từ).`, 'working');
    } else {
      _autoSetStep(0, 'skip');
      _autoSetStep(1, 'skip');
      _autoSetStep(2, 'skip');
      _autoSetStep(3, 'skip');
    }
    if (stopped()) throw 'STOP';

    // BƯỚC 4 — Căn LẠI độ dài theo MP3 (SAU tách — gán độ dài thật cho cảnh con; dùng lại bản transcribe đã cache)
    if (_autoAudioFile){
      _autoSetStep(4, 'active');
      try {
        const n2 = await _autoAlignAudioOnce();
        if (n2 != null) setStatus2(`✓ Đã căn lại timing ${n2}/${state.scenes.length} cảnh theo MP3.`, 'working');
        _autoSetStep(4, n2 == null ? 'skip' : 'done');
      } catch(e){ console.warn('Auto căn lại lỗi:', e); _autoSetStep(4, 'fail'); }
    } else {
      _autoSetStep(4, 'skip');
    }
    if (stopped()) throw 'STOP';

    // Video KHÔNG nhân vật → bỏ qua Quét Trước + Gán
    const _noChar = document.getElementById('noCharMode')?.checked;

    // BƯỚC 5 — Quét trước nhân vật/bối cảnh (bỏ qua nếu đã quét, hoặc video không nhân vật)
    if (!_noChar && !(state.charactersV.length || state.backgroundsV.length)){
      _autoSetStep(5, 'active');
      // Quét có thể fail do AI trả JSON không hợp lệ → thử lại tối đa 2 lần, đừng âm thầm bỏ Gán
      let scanned = 0;
      for (let attempt = 1; attempt <= 2 && !scanned && !stopped(); attempt++){
        clearCancel();
        if (attempt > 1) setStatus2(`🔁 Quét lại nhân vật/bối cảnh (lần ${attempt})...`, 'working');
        scanned = await doPrescan();
      }
      _autoSetStep(5, scanned ? 'done' : 'fail');
      if (!scanned && !stopped())
        setStatus2('⚠️ Chưa quét được nhân vật/bối cảnh (AI trả không hợp lệ) → BỎ QUA bước Gán. Bấm "⚡ Quét Trước" tay rồi "Gán", hoặc đổi provider sang Claude/OpenAI cho bước này.', 'info');
    } else {
      _autoSetStep(5, 'skip');
    }
    if (stopped()) throw 'STOP';

    // BƯỚC 6 — Gán tài nguyên (bỏ qua nếu đã gán, không có nhân vật/bối cảnh, hoặc video không nhân vật)
    if (!_noChar && (state.charactersV.length || state.backgroundsV.length)){
      const alreadyAssigned = state.scenes.some(s => s.character || s.background);
      if (!alreadyAssigned){
        _autoSetStep(6, 'active');
        clearCancel();
        await doAssign();
        // 🔍 KIỂM GÁN: cảnh trống CẢ nhân vật lẫn bối cảnh = dấu hiệu batch lỗi → ép gán lại đúng những cảnh đó (1 lượt)
        if (!stopped()) {
          const empties = state.scenes.filter(s => !s.character && !s.background);
          if (empties.length && empties.length < state.scenes.length) {  // còn vài cảnh trống (không phải tất cả)
            setStatus2(`🔍 Kiểm Gán: ${empties.length} cảnh trống → gán lại...`, 'working');
            clearCancel();
            await doAssign(empties);
          }
        }
        _autoSetStep(6, 'done');
      } else {
        _autoSetStep(6, 'skip');
      }
    } else {
      _autoSetStep(6, 'skip');
    }
    if (stopped()) throw 'STOP';

    // 🎯 Logline toàn video — tạo TRƯỚC bước prompt để mọi cảnh bám đúng chủ đề (tự sinh lại nếu kịch bản đổi)
    setStatus2('🎯 Đang tóm tắt toàn video (logline)...', 'working');
    await genVideoLogline(false);
    if (stopped()) throw 'STOP';

    // BƯỚC 7 — Prompt ảnh (hàm tự bỏ qua cảnh đã có prompt + tự xử lý Dừng trong vòng lặp)
    _autoSetStep(7, 'active');
    clearCancel();
    await doGenerateScenePrompts();
    const promptCount = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
    if (promptCount === 0){ _autoSetStep(7, 'fail'); throw new Error('AI chưa tạo được prompt nào — thử giảm Batch xuống 2-3.'); }
    _autoSetStep(7, 'done');
    if (stopped()) throw 'STOP';  // user bấm Dừng trong lúc gen prompt

    // BƯỚC 8 — Tự thêm ảnh B cho cảnh dài (autoMode = bỏ confirm)
    _autoSetStep(8, 'active');
    clearCancel();
    await autoAddPromptBForLongScenes(true);
    _autoSetStep(8, 'done');

    // KIỂM TRA CUỐI (tuỳ chọn) — rà chất lượng prompt + tạo lại cảnh lỗi 1 lượt
    let verifyNote = '';
    if (T2_TUY_CHON.autoVerify && !stopped()) {
      let bad = _scanBadPrompts();
      if (bad.length) {
        setStatus2(`🔍 Kiểm tra: ${bad.length} cảnh prompt nghi lỗi → đang tạo lại...`, 'working');
        bad.forEach(b => { delete state.scenePrompts[b.id]; });   // xoá để gen lại
        clearCancel();
        await doGenerateScenePrompts();                           // chỉ gen các cảnh vừa xoá
        const still = _scanBadPrompts();
        verifyNote = ` · 🔍 đã tạo lại ${bad.length} cảnh lỗi${still.length ? `, còn ${still.length} cảnh nghi lỗi (xem Console)` : ' — ok'}.`;
        if (still.length) console.warn('Cảnh prompt còn nghi lỗi:', still);
      } else {
        verifyNote = ' · 🔍 tất cả prompt đạt.';
      }
    }

    // BƯỚC 9 (tuỳ chọn) — Trọn gói ảnh bằng Flow: prompt asset → ảnh asset → ảnh cảnh
    if (document.getElementById('autoFlowImages')?.checked && !stopped()) {
      // 9a — Tạo prompt nhân vật/bối cảnh (Tool 3)
      _autoSetStep(FS_ASSET_PROMPT, 'active');
      try {
        setStatus2('🎭 Đang tạo prompt nhân vật/bối cảnh (Tool 3)…', 'working');
        loadAssetsFromTool2(true);
        clearCancel();
        await genAllAssetPrompts();
        if (typeof tfRenderAssets === 'function') tfRenderAssets();
        _autoSetStep(FS_ASSET_PROMPT, 'done');
      } catch (e){ _autoSetStep(FS_ASSET_PROMPT, 'fail'); verifyNote += ' · 🎭 prompt asset lỗi: ' + (e.message || e); }

      // 9b — Tạo ảnh nhân vật + bối cảnh bằng Flow (để làm ảnh tham chiếu)
      if (!stopped()) {
        _autoSetStep(FS_ASSET_IMG, 'active');
        setStatus2('🖼 Đang tạo ảnh nhân vật/bối cảnh bằng Flow…', 'working');
        tfState.onProgress = (p) => _autoSetStepLabel(FS_ASSET_IMG, `🖼 Ảnh asset ${p.done}/${p.total}`);
        try {
          const rc = await tfGenAssets('char');
          const rb = await tfGenAssets('bg');
          tfState.onProgress = null;
          // ⚠️ ĐẢM BẢO đủ ảnh tham chiếu: tạo lại asset còn THIẾU ảnh (lỗi/hết quota) trước khi tạo cảnh.
          const _missAssets = () => [
            ...tfAssetList('char').filter(a => a.prompt && String(a.prompt).trim() && !state.characterImages?.[a.name]?.base64),
            ...tfAssetList('bg').filter(a => a.prompt && String(a.prompt).trim() && !state.backgroundImages?.[a.name]?.base64),
          ];
          for (let round = 1; round <= 3 && !stopped(); round++){
            const miss = _missAssets();
            if (!miss.length) break;
            _autoSetStepLabel(FS_ASSET_IMG, `🔁 Tạo lại ${miss.length} ảnh tham chiếu thiếu (lần ${round})`);
            const mc = tfAssetList('char').some(a => a.prompt && String(a.prompt).trim() && !state.characterImages?.[a.name]?.base64);
            const mb = tfAssetList('bg').some(a => a.prompt && String(a.prompt).trim() && !state.backgroundImages?.[a.name]?.base64);
            if (mc) await tfGenAssets('char', true);
            if (mb && !stopped()) await tfGenAssets('bg', true);
          }
          tfState.onProgress = null;
          const skip = rc?.skipped ? rc : (rb?.skipped ? rb : null);
          const stillMiss = _missAssets().length;
          if (skip) { _autoSetStep(FS_ASSET_IMG, 'skip'); verifyNote += ` · 🎭 ảnh asset bỏ qua (${skip.reason}).`; }
          else if (stillMiss) { _autoSetStep(FS_ASSET_IMG, 'fail'); verifyNote += ` · ⚠️ còn ${stillMiss} ảnh tham chiếu THIẾU (hết quota?) — cảnh liên quan có thể thiếu ref.`; }
          else { _autoSetStep(FS_ASSET_IMG, 'done'); verifyNote += ` · 🎭 asset đủ ảnh tham chiếu.`; }
        } catch (e){ _autoSetStep(FS_ASSET_IMG, 'fail'); verifyNote += ' · 🎭 ảnh asset lỗi: ' + (e.message || e); }
        finally { tfState.onProgress = null; }
      } else _autoSetStep(FS_ASSET_IMG, 'skip');

      // 9c — Tạo ảnh cảnh (tự đính ảnh asset vừa tạo làm tham chiếu)
      if (!stopped()) {
        _autoSetStep(FS_SCENE_IMG, 'active');
        setStatus2('🖼 Đang tạo ảnh cảnh bằng Flow… (theo dõi ở tab ✨ Tạo Ảnh Hàng Loạt)', 'working');
        tfState.onProgress = (p) => _autoSetStepLabel(FS_SCENE_IMG, `🖼 Ảnh cảnh ${p.done}/${p.total}`);
        try {
          if (typeof tfRenderScenes === 'function') tfRenderScenes();
          const res = await tfGenScenes(false);
          if (res?.skipped) { _autoSetStep(FS_SCENE_IMG, 'skip'); verifyNote += ` · 🖼 ảnh cảnh bỏ qua (${res.reason}).`; }
          else { _autoSetStep(FS_SCENE_IMG, res?.err ? 'fail' : 'done'); verifyNote += ` · 🖼 cảnh: ${res?.done || 0} ảnh${res?.err ? `, ${res.err} lỗi` : ''}.`; }
        } catch (e){ _autoSetStep(FS_SCENE_IMG, 'fail'); verifyNote += ' · 🖼 ảnh cảnh lỗi: ' + (e.message || e); }
        finally { tfState.onProgress = null; }
      } else _autoSetStep(FS_SCENE_IMG, 'skip');
    }

    // --- Tổng kết ---
    const secs = Math.round((Date.now() - t0) / 1000);
    const missing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
    setStatus2(
      missing > 0
        ? `✓ Auto xong (${secs}s) — còn ${missing} cảnh prompt lỗi. Bấm "🔧 Tạo nốt cảnh thiếu", rồi sang tab "🎨 Prompt ảnh" để copy.${verifyNote}`
        : `🎉 Auto xong toàn bộ ${state.scenes.length} cảnh trong ${secs}s!${verifyNote} Mở tab "🎨 Prompt ảnh" → "📋 Sao chép tất cả" → paste sang G-Labs/Flow để gen ảnh.`,
      missing > 0 ? 'info' : 'ok'
    );
    saveState(true);

  } catch (err){
    if (err === 'STOP'){
      const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
      setStatus2(`⏸ Đã dừng Auto. Tiến độ được giữ (đã có ${done}/${state.scenes.length} prompt). Bấm "🚀 Auto" lần nữa để chạy tiếp từ chỗ còn thiếu.`, 'info');
    } else {
      console.error('[Auto] lỗi:', err);
      setStatus2('Auto lỗi: ' + (err && err.message ? err.message : err), 'error');
    }
    saveState(true);
  } finally {
    _autoRunning = false;
    _autoStopFlag = false;
    clearCancel();
    _toggleAutoUI(false);
  }
}

async function runAutoTool3(){
  if (_autoT3Running) return;
  const p = getProfile();
  if (!p) return setStatus3('Cần tạo Profile (Tool 1) trước khi chạy Auto.', 'error');
  const btn = document.getElementById('autoT3Btn');
  _autoT3Running = true;
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '⏳ Đang chạy...'; }
  try {
    setStatus3('🚀 Auto: đang load nhân vật/bối cảnh từ Tool 02...', 'working');
    loadAssetsFromTool2(true);   // load assets, bỏ qua auto-era ở bước này
    if (state.charactersV.length === 0 && state.backgroundsV.length === 0) {
      setStatus3('Tool 02 chưa có nhân vật/bối cảnh — chạy Quét Trước ở Tool 02 trước đã.', 'error');
      return;
    }
    setStatus3('🚀 Auto: đang suy bối cảnh & thời đại từ kịch bản...', 'working');
    await autoFillEra(false);    // điền thời đại (chờ xong để Generate dùng được)
    setStatus3('🚀 Auto: đang tạo prompt nhân vật + bối cảnh...', 'working');
    await genAllAssetPrompts();  // tạo tất cả prompt (tự set status khi xong)
  } catch (e) {
    console.error('[AutoT3]', e);
    setStatus3('Auto lỗi: ' + (e && e.message ? e.message : e), 'error');
  } finally {
    _autoT3Running = false;
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || '🚀 Auto'; }
  }
}

