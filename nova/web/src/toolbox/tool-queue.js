/* AUTO-EXTRACTED from index.html block 3 - prefix: queue */

function queueSave(){ try { localStorage.setItem('av_queue', JSON.stringify(_prodQueue.map(j => { const c = { ...j }; delete c.script; return c; }))); } catch (e) {} }   // kịch bản để ở IndexedDB (qs_<id>), không nhét localStorage

function queueAdd(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  if (!p) return _autoLog('Chưa có Profile — tạo/chọn Profile trước.', 'error');
  // Hệ thống gói/tier đã gỡ bỏ (mọi tính năng mở khoá sẵn) — không còn giới hạn hàng đợi.
  const startFrom = document.getElementById('dashStart')?.value || 'script';
  const topic = (document.getElementById('dashTopic')?.value || '').trim();
  let script = (_autoScriptText || '').trim();
  // Quy mô theo khối QUY MÔ tab Tạo Kịch Bản: chương × từ/chương (không còn ô "số từ" riêng lẻ).
  const chapters = Math.max(1, parseInt(document.getElementById('dashChapters')?.value) || 1);
  const wpc = Math.max(100, parseInt(document.getElementById('dashWordsPerChapter')?.value) || 1200);
  const words = chapters * wpc;
  const lang = document.getElementById('dashLang')?.value || 'Tiếng Việt';
  if (startFrom === 'script') { if (!topic) return _autoLog('Nhập chủ đề video trước khi thêm.', 'error'); }
  else { if (!script) script = (state.script || document.getElementById('tsOutput')?.value || '').trim(); if (!script) return _autoLog('Chưa có kịch bản — chọn file .txt, hoặc viết ở tab Tạo Kịch Bản.', 'error'); }
  const title = topic || ('Video ' + (_prodQueue.length + 1) + ' — chờ SEO đặt tên');
  const id = _qid();
  captureChannelCfg();   // lưu cấu hình Tool 2 + giọng hiện tại vào kênh này
  const pname = (p.tenKenh || '').trim() || ('Profile ' + (state.currentProfileIdx + 1));
  const job = {
    id, title, topic, startFrom, script: startFrom === 'scenes' ? script : '', words,
    chapters, wpc, lang,   // QUY MÔ lúc bấm Thêm — pipeline set đúng vào tab Tạo Kịch Bản
    profileIdx: state.currentProfileIdx, profileName: pname, status: 'queued', detail: 'chờ tới lượt',
    // Ghi nhớ nơi lưu RIÊNG cho video này (theo cài đặt lúc bấm Thêm)
    saveMode: _autoSaveMode, saveName: (_autoSaveName || '').trim(), saveDir: (_autoOutDir || _autoDefaultDir || ''),
  };
  if (startFrom === 'scenes' && _autoVoiceFile) { _queueVoice[id] = _autoVoiceFile; job.voiceName = _autoVoiceFile.name; }
  // Ghi mức xen video 🎞/🎬 LÚC bấm Thêm → pipeline dùng ĐÚNG lựa chọn của kênh (không bị newVideo đưa về mặc định).
  { const b = state.nguonBat || {};
    job.nguonBat = Object.assign({}, b);
    job.webBat = Object.assign({}, state.webBat || {});
    job.videoMix = b.veo ? 6 : 0; job.stockMix = b.stock ? 6 : 0; job.ytMix = b.yt ? 6 : 0;
  }
  if (job.script) { try { IDB.set('qs_' + id, job.script); } catch (e) {} }   // kịch bản → IndexedDB (giữ localStorage nhẹ)
  _prodQueue.push(job); queueSave(); queueRender();
  // Xoá form soạn để thêm cái kế
  const tt = document.getElementById('dashTopic'); if (tt) tt.value = ''; _autoTopic = '';
  _autoScriptText = ''; const sn = document.getElementById('dashScriptName'); if (sn) sn.textContent = '';
  const sf = document.getElementById('dashScriptFile'); if (sf) sf.value = '';
  _autoVoiceFile = null; const vn = document.getElementById('dashVoiceName'); if (vn) vn.textContent = '';
  const vf = document.getElementById('dashVoiceFile'); if (vf) vf.value = '';
  _autoLog('✓ Đã thêm "' + title + '" vào hàng đợi.', 'ok');
}

async function queueRemove(id){
  const job = _prodQueue.find(j => j.id === id);
  if (job && job.videoId) {
    if (!confirm('Xoá "' + (job.title || 'video này') + '" khỏi hàng đợi?\nToàn bộ kịch bản, cảnh, ảnh của video này (trong app) cũng bị xoá. File đã xuất ra thư mục thì vẫn còn.')) return;
    await _purgeJobVideo(job);
  }
  _prodQueue = _prodQueue.filter(j => j.id !== id); delete _queueVoice[id];
  try { IDB.del('qs_' + id); } catch (e) {}
  queueSave(); queueRender();
}

function queueRetry(id){ const j = _prodQueue.find(x => x.id === id); if (j) { j.status = 'queued'; j.detail = 'chờ tới lượt'; queueSave(); queueRender(); } }

function queueRender(){
  const box = document.getElementById('queueList'); const cnt = document.getElementById('queueCount');
  if (cnt) cnt.textContent = _prodQueue.length + ' mục';
  if (!box) return;
  if (!_prodQueue.length) { box.innerHTML = '<div class="empty-state" style="padding:16px 4px">Hàng đợi trống. Soạn video ở trên rồi bấm “＋ Thêm vào hàng đợi”.</div>'; return; }
  const badge = (j) => {
    const map = {
      queued: ['Trong hàng', 'var(--text-muted)', 'var(--surface-3)'],
      error: ['Cần xử lý', 'var(--red)', 'rgba(220,38,38,.12)'],
      done: ['Đã xuất', 'var(--green)', 'rgba(21,128,61,.12)'],
    };
    let m = map[j.status];
    if (j.status === 'running') {
      let lbl = '';
      if (j.id === _queueCurId) { const rs = PROD_STEPS.find(s => (_autoState[s.key] || {}).status === 'run'); if (rs) lbl = rs.label; }
      if (!lbl) { const s = PROD_STEPS[Math.min(j.step || 0, PROD_STEPS.length - 1)]; lbl = s ? s.label : ''; }
      m = ['▶ ' + (lbl || 'Đang chạy'), 'var(--accent)', 'rgba(194,65,12,.12)'];
    } else if (j.status === 'paused') { const s = PROD_STEPS[j.step || 0]; m = ['⏸ Chờ ' + (s ? s.label : 'tiếp'), 'var(--amber)', 'rgba(180,83,9,.15)']; }
    if (!m) m = map.queued;
    return `<span style="font-size:11px;font-weight:600;color:${m[1]};background:${m[2]};padding:3px 11px;border-radius:999px;white-space:nowrap">${m[0]}</span>`;
  };
  const _segCol = (s, paused) => s === 'done' ? 'var(--green)' : s === 'error' ? 'var(--red)' : s === 'run' ? (paused ? 'var(--amber)' : 'var(--accent)') : 'var(--surface-3)';
  // Thanh 9 bước mini: video đang chạy đọc _autoState; video chờ Flow suy từ job.step.
  const miniBar = (j) => {
    const cur = j.id === _queueCurId, paused = j.status === 'paused';
    return '<div style="display:flex;gap:3px;margin-top:6px;max-width:380px">' + PROD_STEPS.map((s, idx) => {
      const status = cur ? ((_autoState[s.key] || {}).status || 'idle')
        : (idx < (j.step || 0) ? 'done' : (idx === (j.step || 0) && paused ? 'run' : 'idle'));
      const pulse = (status === 'run' && !paused) ? ';animation:autopulse 1s infinite' : '';
      return `<div title="${s.label}" style="flex:1;height:4px;border-radius:99px;background:${_segCol(status, paused)}${pulse}"></div>`;
    }).join('') + '</div>';
  };
  const stepNo = (j) => j.id === _queueCurId
    ? Math.min(PROD_STEPS.filter(s => ['done', 'skip'].includes((_autoState[s.key] || {}).status)).length + 1, PROD_STEPS.length)
    : Math.min((j.step || 0) + 1, PROD_STEPS.length);
  box.innerHTML = _prodQueue.map((j, i) => {
    const active = j.status === 'running' || j.status === 'paused';
    return `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 4px;border-bottom:1px solid var(--border)${j.status === 'running' ? ';background:linear-gradient(90deg,rgba(222,93,10,.06),transparent);border-radius:10px' : ''}">
      <span style="color:var(--text-dim);font-size:12px;min-width:16px;text-align:center">${i + 1}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(j.title)}</div>
        <div style="font-size:11.5px;color:var(--text-dim);font-family:ui-monospace,SFMono-Regular,monospace">${escapeHtml(j.profileName || '')} · ${active ? ('bước ' + stepNo(j) + '/' + PROD_STEPS.length + ' · ') : ''}${escapeHtml(j.detail || '')}</div>
        ${active ? miniBar(j) : ''}
      </div>
      ${badge(j)}
      <div style="display:flex;gap:4px">
        ${(j.status === 'error' || j.status === 'done' || j.status === 'paused') ? `<button class="btn ghost sm" title="Chạy lại từ bước dở" onclick="queueRetry('${j.id}')">↻</button>` : ''}
        <button class="btn ghost sm" title="Xoá khỏi hàng đợi" onclick="queueRemove('${j.id}')">✕</button>
      </div>
    </div>`; }).join('');
}

function queueStop(){
  _queueAbort = true; _autoAbort = true; _clearAutoRetry();
  if (typeof requestCancel === 'function') requestCancel();        // dừng vòng lặp AI (chia cảnh / prompt)
  if (typeof stopAutoTool2 === 'function') { try { stopAutoTool2(); } catch (e) {} }   // dừng bước Prompt cảnh (runAutoTool2)
  if (typeof tfStop === 'function') { try { tfStop(); } catch (e) {} }                 // dừng bước Tạo ảnh (Flow)
  _autoLog('Đang dừng… (cắt luôn bước đang chạy)', 'info');
}

