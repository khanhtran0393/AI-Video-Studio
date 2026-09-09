/* AUTO-EXTRACTED from index.html block 3 - prefix: mv */

function mvRebuild(){
  const scenes = state.scenes || [];
  const SP = state.scenePrompts || {}, SP2 = state.scenePrompts2 || {}, SI = state.sceneImages || {}, SI2 = state.sceneImagesB || {};
  mvScenes = [];
  for (const s of scenes){
    const hasB = !!SI2[s.id]?.base64;
    if (SI[s.id]?.base64) mvScenes.push({ id: s.id, origId: s.id, variant: (hasB ? 'a' : ''), vo: s.text || '', imgPrompt: SP[s.id] || '', img: SI[s.id] });
    if (hasB) mvScenes.push({ id: s.id + 'b', origId: s.id, variant: 'b', vo: s.text || '', imgPrompt: SP2[s.id] || '', img: SI2[s.id] });
  }
  for (const u of mvUploaded) mvScenes.push(u);
  _mvRenderSceneList();
  mvRender();
  mvVideoRender();
  if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI();
}

function mvLoadScenes(){ mvRebuild(); }

async function mvUpload(files){
  const arr = Array.from(files || []);
  let n = 0;
  for (const f of arr){
    if (!/^image\//.test(f.type || '')) continue;
    try {
      const b64 = await _mvFileToB64(f);
      mvUploaded.push({ id: 'up' + Date.now().toString(36) + (++n), vo: '', imgPrompt: '', uploaded: true, uploadedName: f.name || '', img: { base64: b64, mediaType: f.type || 'image/png', fileName: f.name || '' } });
    } catch (e){ /* bỏ ảnh lỗi */ }
  }
  mvRebuild();
  if (n) setStatusBar('statusMvVid', `Đã tải ${n} ảnh test. Bấm "Sinh prompt chuyển động" (ảnh tải lên sẽ dùng vision để đọc nội dung).`, 'ok');
}

function mvRemoveUpload(id){ mvUploaded = mvUploaded.filter(u => u.id !== id); mvRebuild(); }

async function mvGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  if (!mvScenes.length){ setStatusBar('statusMvVid', 'Chưa có ảnh — tải ảnh lên (test) hoặc "Lấy ảnh cảnh đã tạo".', 'error'); return; }
  const cfg = _mvCfg();
  if (!state.motionPrompts) state.motionPrompts = {};
  const btn = document.getElementById('mvGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvStopBtn'); stop.style.display = '';
  window.__mvStop = false;
  setStatusBar('statusMvVid', '✨ Đang sinh prompt chuyển động…', 'working');
  let done = 0;
  const tick = () => { done++; mvRender(); setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working'); };
  try {
    const visionOnes = mvScenes.filter(s => s.uploaded && !s.imgPrompt);
    const textOnes = mvScenes.filter(s => !(s.uploaded && !s.imgPrompt));

    // Đường VISION cho ảnh tải lên (từng ảnh, model tự nhìn).
    for (const s of visionOnes){
      if (window.__mvStop) break;
      try { state.motionPrompts[s.id] = await _mvGenVision(s, cfg); }
      catch (e){ state.motionPrompts[s.id] = ''; }
      tick();
    }

    // Đường TEXT (batch) cho cảnh đã có mô tả từ pipeline.
    const BATCH = 8;
    for (let i = 0; i < textOnes.length && !window.__mvStop; i += BATCH){
      const chunk = textOnes.slice(i, i + BATCH);
      const list = chunk.map(s => `[${s.id}] Lời VO: "${(s.vo || '').replace(/\s+/g, ' ').slice(0, 160)}" | Nội dung ảnh: ${(s.imgPrompt || '').replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
      const prompt = `You are an IMAGE-TO-VIDEO prompt expert for GOOGLE VEO. Each scene below ALREADY HAS A STILL IMAGE — that image is the FIRST FRAME. Write 1 MOTION prompt IN ENGLISH so Veo animates the image into a ${cfg.clip}s clip.

${_mvRules(cfg)}

Return ONLY 1 JSON: {"shots":[{"id":"<exact id>","motion":"..."}]}

SCENES:
${list}`;
      const data = await callLLMJson(prompt, { maxTokens: 2200, validate: d => d && Array.isArray(d.shots) });
      for (const sh of (data.shots || [])){ if (sh && sh.id && sh.motion) state.motionPrompts[String(sh.id)] = String(sh.motion).trim(); }
      done += chunk.length; mvRender();
      setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working');
    }
    saveState(true); mvRender();
    const okc = mvScenes.filter(s => state.motionPrompts[s.id]).length;
    setStatusBar('statusMvVid', window.__mvStop ? `Đã dừng. ${okc} prompt.` : `✓ Xong ${okc}/${mvScenes.length} prompt chuyển động.`, 'ok');
  } catch (e){ setStatusBar('statusMvVid', 'Lỗi: ' + (e.message || e), 'error'); }
  finally { btn.disabled = false; stop.style.display = 'none'; }
}

function mvRender(){ if (typeof tvRenderRows === 'function') tvRenderRows(); }

async function mvVideoGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  const flow = (a, p) => flowBridge.call(a, p);   // theo chế độ: extension mode → extension, builtin → native
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))) { setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập trước.', 'error'); return; }
  if (!mvScenes.length) mvLoadScenes();
  const mp = state.motionPrompts || {};
  const targets = mvScenes.filter(s => mp[s.id]);
  if (!targets.length){ setStatusBar('statusMvVid', 'Chưa có prompt chuyển động cho cảnh nào. Sinh prompt trước.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelName = document.getElementById('mvVidModel').value.trim();   // để trống → native tự chọn abra_r2v_<dur>s
  if (!state.sceneVideos) state.sceneVideos = {};
  const btn = document.getElementById('mvVidGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvVidStopBtn'); stop.style.display = '';
  window.__mvVidStop = false;
  try { await flow('POOL_RESET'); } catch { /* */ }
  // Số luồng song song = số tài khoản Flow đang dùng được (mỗi account 1 cảnh cùng lúc).
  let conc = 3;
  try { const st = await flow('GET_STATUS'); const n = (st.accounts || []).filter(a => a.hasToken && a.enabled !== false).length; if (n) conc = Math.min(Math.max(n, 1), 8); } catch { /* */ }
  const total = targets.length; let done = 0, okc = 0, lastCredit = null;
  const work = async (s) => {
    if (window.__mvVidStop) return;
    try {
      let r = await flow('POOL_GEN_VIDEO', {
        prompt: mp[s.id], aspect, durationSecs, modelName, sceneId: s.id,
        image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, withData: true,
      });
      r = await _videoAppResolve(r);   // extension farm mode → app resolve file video
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        if (r.video?.b64){ mvVideoBlobs[s.id] = { b64: r.video.b64, mime: r.video.mime || 'video/mp4' }; autoSaveMedia(_mvVidName(s.id), r.video.b64, 'video'); }
        state.sceneVideos[s.id] = { url: r.videoUrl || null, account: r.account || null, credits: (r.credits ?? null), hasBlob: !!(r.video?.b64) };
        if (r.credits != null) lastCredit = r.credits;
        okc++;

        // D4: auto-fallback model. Neu model goc la veo-3.1 (dat) va loi quota/credit, retry 1 lan voi veo-3.1-fast.
        const _errText = String((r && (r.error || r.raw)) || '');
        const _isQuota = /QUOTA|EXHAUSTED|h\u1EBFt gi\u1EDBi h\u1EA1n|INSUFFICIENT|CREDIT|PAYGATE|LIMIT|429|503/i.test(_errText);
        const _isExpensive = /veo-?3\.1(?!\-fast)/i.test(String(modelName || '')) || /veo-?3(?:\.0)?(?!\-fast)/i.test(String(modelName || ''));
        if (_isQuota && _isExpensive && !s._fallbackTried){
          s._fallbackTried = true;
          try { if (typeof novaLog === 'function') novaLog('Canh ' + s.id + ': doi veo-3.1-fast (fallback) sau quota/credit', 'warn'); } catch(_){}
          try {
            const r2 = await flow('POOL_GEN_VIDEO', { prompt: mp[s.id], aspect, durationSecs, modelName: 'veo-3.1-fast', sceneId: s.id, image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, withData: true });
            if (r2 && r2.ok && (r2.video?.b64 || r2.videoUrl)){
              r = r2;   // promote len success path
              mvVideoBlobs[s.id] = { b64: r2.video.b64, mime: r2.video.mime || 'video/mp4' };
              try { autoSaveMedia(_mvVidName(s.id), r2.video.b64, 'video'); } catch(_){}
              state.sceneVideos[s.id] = { url: r2.videoUrl || null, account: r2.account || null, credits: (r2.credits ?? null), hasBlob: !!(r2.video?.b64), fallback: 'veo-3.1-fast' };
              if (r2.credits != null) lastCredit = r2.credits;
              okc++;
              try { if (typeof novaLog === 'function') novaLog('Canh ' + s.id + ': fallback veo-3.1-fast THANH CONG', 'ok'); } catch(_){}
              // bo qua set error o duoi -> can sua flow
            }
          } catch (eFb) { try { if (typeof novaLog === 'function') novaLog('Fallback err: ' + eFb.message, 'warn'); } catch(_){} }
        }
      } else {
        state.sceneVideos[s.id] = { error: (r && (r.error || r.raw)) || 'Không rõ lỗi', account: r && r.account || null };
      }
      // Nhật ký per-cảnh + xoay tài khoản (như ảnh)
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển video cảnh ' + s.id + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (r && r.ok && (r.video?.b64 || r.videoUrl)) novaLog('✅ video cảnh ' + s.id + ' · tài khoản ' + ((r && r.account) || '?') + ' · thành công', 'ok');
        else { const em = String((r && (r.error || r.raw)) || ''); const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(em); novaLog((q ? '⚠️ ' : '❌ ') + 'video cảnh ' + s.id + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit → hết tài khoản' : (em || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e4) {}
    } catch (e){ state.sceneVideos[s.id] = { error: e.message || String(e) }; novaLog('❌ video cảnh ' + s.id + ' · ' + (e.message || String(e)), 'err'); }
    done++; mvVideoRender();
    setStatusBar('statusMvVid', `🎬 ${done}/${total} xong${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}…`, done < total ? 'working' : 'ok');
    try { saveState(true); } catch { /* */ }
    await _mvPersistVideos();
  };
  setStatusBar('statusMvVid', `🎬 Đang render ${total} cảnh · ${conc} luồng song song… mỗi cảnh ~1-3 phút.`, 'working');
  await _mvRunLimited(targets, conc, work);
  await _mvPersistVideos();
  btn.disabled = false; stop.style.display = 'none';
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${okc}/${total} video xong.` : `✓ Xong ${okc}/${total} video${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}.`, okc ? 'ok' : 'error');
}

function mvVideoRender(){ if (typeof tvRenderVideos === 'function') tvRenderVideos(); }

async function mvVideoDownloadAll(){
  const rows = tvResults.filter(r => r.status === 'done' && (r.b64 || r.videoUrl));
  if (!rows.length){ setStatusBar('statusMvVid', 'Chưa có video nào để tải.', 'info'); return; }
  for (const r of rows){
    if (r.b64){ _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); }
    else if (r.videoUrl){ await novaDownloadUrl(r.videoUrl, r.name + '.mp4'); }
    await new Promise(res => setTimeout(res, 450));   // giãn cách tránh trình duyệt chặn tải hàng loạt
  }
  setStatusBar('statusMvVid', `✓ Đã tải ${rows.length} video.`, 'ok');
}

