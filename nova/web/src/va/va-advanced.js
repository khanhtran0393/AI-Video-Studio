'use strict';

/* va-advanced.js — chế độ NÂNG CAO: pipeline Video Agent §25 trên thư mục
 * dự án chuẩn (chọn/kiểm tra thư mục, checklist 17 stage, chạy/huỷ/thử
 * lại, sự kiện, kết quả, phiên bản spec). Tách từ video-agent-panel.js.
 * Nạp SAU va-easy-flow.js (qaSummary/openSys gọi qua C.<tên>).
 * KHÔNG import/export. */
(function () {
  const C = window.vaPanelCtx;
  const { el, esc, fmt, folderOf, errText, STAGE_VI, STAGE_ORDER, state, ui, notice, logLine,
    sys, va25, stepCard, setStepState } = C;

  /* ════════ CHẾ ĐỘ NÂNG CAO (Video Agent §25) ════════ */
  function buildAdvanced(box) {
    const steps = el('div', { class: 'va-steps' });

    /* ── chọn dự án ── */
    const s1 = stepCard(1, 'Chọn thư mục dự án', 'Cấu trúc chuẩn: script/ (kịch bản .md/.txt), tts/ (giọng đọc), images/, music/, sfx/.');
    const pickBtn = el('button', { class: 'va-btn', onclick: pickAdvProject }, '📁 Chọn thư mục dự án…');
    ui.advPathInput = el('input', { class: 'va-field', placeholder: '…hoặc dán đường dẫn thư mục rồi bấm Kiểm tra' });
    const inspectBtn = el('button', { class: 'va-btn ghost', onclick: inspectAdvPath }, '🔎 Kiểm tra');
    ui.advChecklist = el('div', { class: 'va-check' });
    s1.body.append(
      el('div', { class: 'va-row' }, pickBtn),
      el('div', { class: 'va-row' }, ui.advPathInput, inspectBtn),
      ui.advChecklist,
      el('div', { class: 'va-hint' }, '💡 Thiếu giọng đọc / ảnh vẫn chạy được — Agent sẽ tự dùng nội dung chữ.'),
    );

    /* ── chạy agent ── */
    const s2 = stepCard(2, 'Chạy Video Agent (17 bước tự động)', 'Agent đọc kịch bản → dựng cảnh → render → tự kiểm tra & sửa lỗi → xuất video.');
    ui.advSkipChk = el('input', { type: 'checkbox' });
    ui.advRunBtn = el('button', { class: 'va-btn primary big', onclick: runAdv }, '🤖 Chạy Video Agent');
    ui.advRunBtn.disabled = true;
    ui.advCancelBtn = el('button', { class: 'va-btn ghost', onclick: cancelAdv, disabled: 'disabled' }, '✖ Huỷ');
    ui.advRetryBtn = el('button', { class: 'va-btn ghost', onclick: retryAdv, disabled: 'disabled' }, '↻ Thử lại');
    ui.advProgFill = el('div', { class: 'va-prog-fill' });
    ui.advProgLabel = el('span', { class: 'va-hint' }, 'Chưa chạy.');
    ui.advStages = el('div', { class: 'va-check' });
    ui.advLog = el('div', { class: 'va-log', style: 'display:none' });
    s2.body.append(
      el('label', { class: 'va-opt' }, ui.advSkipChk, el('span', {}, 'Nhanh hơn: bỏ bước render bản xem trước (không khuyến nghị)')),
      el('div', { class: 'va-row' }, ui.advRunBtn, ui.advCancelBtn, ui.advRetryBtn),
      el('div', { class: 'va-prog' }, ui.advProgFill),
      ui.advProgLabel,
      el('details', { class: 'va-more' }, el('summary', {}, 'Xem 17 bước Agent sẽ làm'), ui.advStages),
      ui.advLog,
    );
    buildAdvStageList();

    /* ── kết quả ── */
    const s3 = stepCard(3, 'Kết quả & phiên bản', 'Video hoàn chỉnh + khôi phục các phiên bản spec trước đó.');
    ui.advResult = el('div', { class: 'va-hint' }, 'Chưa có kết quả.');
    ui.advVerSelect = el('select', { class: 'va-field' });
    ui.advRestoreBtn = el('button', { class: 'va-btn ghost', onclick: restoreAdvVersion, disabled: 'disabled' }, '⏪ Khôi phục phiên bản');
    s3.body.append(ui.advResult,
      el('div', { class: 'va-row' }, ui.advVerSelect, ui.advRestoreBtn));

    steps.append(s1.card, s2.card, s3.card);
    box.append(steps);
  }

  /** Checklist 17 stage: ✓ đã xong · ● đang chạy · ○ chờ. */
  function buildAdvStageList() {
    if (!ui.advStages) return;
    ui.advStages.innerHTML = '';
    for (const st of STAGE_ORDER) {
      const ic = el('span', { class: 'va-ic' }, '○');
      const row = el('div', { class: 'va-check-row', 'data-stage': st }, ic, el('span', {}, STAGE_VI[st]));
      ui.advStages.append(row);
    }
  }
  function markAdvStages(currentStage) {
    if (!ui.advStages) return;
    const idx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
    const rows = ui.advStages.querySelectorAll('.va-check-row');
    rows.forEach((row, i) => {
      const st = row.getAttribute('data-stage');
      const ic = row.querySelector('.va-ic');
      row.classList.toggle('cur', st === currentStage);
      if (ic) ic.textContent = i < idx ? '✓' : st === currentStage ? '●' : '○';
      row.style.color = i < idx ? 'var(--green)' : '';
    });
  }

  /* ════════ CHẾ ĐỘ NÂNG CAO — LOGIC ════════ */
  function advSetRunButtons() {
    if (ui.advRunBtn) ui.advRunBtn.disabled = state.advRunning || !state.advProject;
    if (ui.advCancelBtn) ui.advCancelBtn.disabled = !state.advRunning;
    if (ui.advRetryBtn) ui.advRetryBtn.disabled = state.advRunning || !state.advJobId;
  }

  function advSetProgress(label, percent) {
    if (ui.advProgFill) ui.advProgFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    if (ui.advProgLabel) ui.advProgLabel.textContent = label || '';
  }

  /** Checklist đầu vào từ kết quả discover (§15). */
  function renderAdvChecklist(project) {
    if (!ui.advChecklist) return;
    ui.advChecklist.innerHTML = '';
    const files = (project && project.files) || {};
    const rows = [
      ['Kịch bản (script/)', files.script, 'Bắt buộc — file .md/.txt chứa cảnh quay'],
      ['Giọng đọc (tts/ audio)', files.ttsAudio, 'MP3/WAV — nếu thiếu, Agent dùng thời lượng ước tính'],
      ['Mốc thời gian giọng đọc', files.ttsTimestamps, 'JSON — giúp khớp timeline chính xác hơn'],
      ['Ảnh nền (images/)', (files.images || []).length ? files.images.join(', ') : null, 'JPG/PNG — Agent tự ghép vào cảnh'],
      ['Nhạc nền (music/)', (files.music || []).length ? files.music.join(', ') : null, 'Tùy chọn'],
      ['Hiệu ứng âm thanh (sfx/)', (files.sfx || []).length ? files.sfx.join(', ') : null, 'Tùy chọn'],
    ];
    let requiredOk = false;
    for (const [label, val, hint] of rows) {
      const present = val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
      if (label.indexOf('Kịch bản') === 0) requiredOk = present;
      const ic = el('span', { class: 'va-ic' }, present ? '✓' : '○');
      ic.style.color = present ? 'var(--green)' : 'var(--amber)';
      const txt = `${label} — ${present ? (Array.isArray(val) ? `${val.length} file` : fileName(val)) : 'chưa có'}`;
      ui.advChecklist.append(el('div', { class: 'va-check-row', title: hint }, ic, el('span', {}, txt)));
    }
    if (state.advProject && ui.advRunBtn) ui.advRunBtn.disabled = !requiredOk;
  }

  async function pickAdvProject() {
    const bridge = va25();
    if (!bridge || typeof bridge.pickProject !== 'function') { notice('Chưa có bridge videoAgent — mở app Electron mới nhất.'); return; }
    try {
      const r = await bridge.pickProject();
      if (!r || r.canceled) return;
      if (!r.ok) { notice(errText(r.error || r, 'Chọn dự án')); return; }
      applyAdvInspect(r);
      notice(`Đã nhận dự án "${(r.project && r.project.chapterId) || fileName(r.projectDir)}" — bấm "🤖 Chạy Video Agent".`, 'ok');
    } catch (error) { notice(errText(error, 'Chọn dự án')); }
  }

  async function inspectAdvPath() {
    const bridge = va25();
    const dir = ui.advPathInput && ui.advPathInput.value.trim();
    /* preload expose bridge tên `inspect` (nova/preload.js: videoAgent.inspect) —
       giữ fallback `inspectProject` cho bridge cửa sổ video-agent.html cũ. */
    const inspectFn = bridge && (typeof bridge.inspect === 'function' ? bridge.inspect
      : (typeof bridge.inspectProject === 'function' ? bridge.inspectProject : null));
    if (!inspectFn) { notice('Chưa có bridge videoAgent — mở app Electron mới nhất.'); return; }
    if (!dir) { notice('Hãy dán đường dẫn thư mục dự án (hoặc bấm "Chọn thư mục dự án…").'); return; }
    try {
      const r = await inspectFn.call(bridge, dir);
      if (!r || !r.ok) {
        /* đường dẫn vừa đổi sang chỗ không hợp lệ → bỏ dự án đã chọn trước đó,
           khoá nút Chạy lại để không chạy nhầm thư mục cũ. */
        state.advProject = null;
        state.advJobId = null;
        advSetRunButtons();
        notice(errText((r && (r.error || r.code)) || r, 'Kiểm tra thư mục'));
        return;
      }
      applyAdvInspect(r);
    } catch (error) { notice(errText(error, 'Kiểm tra thư mục')); }
  }

  function applyAdvInspect(r) {
    /* projectDir có thể vắng ở bridge cũ → fallback project.root (giống pickProject). */
    state.advProject = { projectDir: r.projectDir || (r.project && r.project.root), project: r.project, job: r.job || null };
    if (ui.advPathInput) ui.advPathInput.value = state.advProject.projectDir;
    renderAdvChecklist(r.project);
    advSetRunButtons();
    refreshAdvVersions(r.projectDir);
    if (r.job && r.job.status === 'failed') {
      state.advJobId = r.job.jobId || r.job.id;
      notice('Lần chạy trước bị lỗi — bấm "↻ Thử lại" để chạy lại từ đầu.', 'info');
      advSetRunButtons();
    }
  }
  async function runAdv() {
    const bridge = va25();
    if (!bridge || !state.advProject || state.advRunning) return;
    state.advRunning = true;
    state.advJobId = null;
    advSetRunButtons();
    notice(null);
    if (ui.advLog) { ui.advLog.innerHTML = ''; ui.advLog.style.display = 'block'; }
    buildAdvStageList();
    advSetProgress('Đang khởi chạy Agent…', 1);
    logLine(ui.advLog, `Chạy Video Agent trên: ${state.advProject.projectDir}`);
    try {
      const r = await bridge.run({
        projectDir: state.advProject.projectDir,
        options: { skipPreview: !!(ui.advSkipChk && ui.advSkipChk.checked) },
      });
      state.advJobId = (r && r.jobId) || state.advJobId;
      advSetRunButtons();
      if (!r || r.ok === false) {
        advSetProgress('Lỗi', 0);
        notice(errText(r && (r.error || r), 'Chạy Video Agent'));
        logLine(ui.advLog, 'Lỗi: ' + errText(r && (r.error || r)));
        return;
      }
      showAdvResult(r);
      refreshAdvVersions(state.advProject.projectDir);
      markAdvStages('COMPLETED');
      advSetProgress('Hoàn tất 🎉', 100);
      notice('Video Agent đã chạy xong — xem kết quả ở Bước 3. 🎉', 'ok');
    } catch (error) {
      advSetProgress('Lỗi', 0);
      notice(errText(error, 'Chạy Video Agent'));
      logLine(ui.advLog, 'Lỗi: ' + errText(error));
    } finally {
      state.advRunning = false;
      advSetRunButtons();
    }
  }

  async function cancelAdv() {
    const bridge = va25();
    if (!bridge || !state.advJobId) return;
    try {
      await bridge.cancel(state.advJobId);
      logLine(ui.advLog, 'Đã gửi lệnh huỷ — Agent sẽ dừng ở bước hiện tại.');
    } catch (error) { notice(errText(error, 'Huỷ Agent')); }
  }

  async function retryAdv() {
    const bridge = va25();
    if (!bridge || !state.advJobId) return;
    state.advRunning = true;
    advSetRunButtons();
    try {
      logLine(ui.advLog, 'Thử lại từ đầu…');
      const r = await bridge.retry(state.advJobId);
      if (!r || r.ok === false) { notice(errText(r && (r.error || r), 'Thử lại')); return; }
      showAdvResult(r);
      markAdvStages('COMPLETED');
      advSetProgress('Hoàn tất 🎉', 100);
    } catch (error) { notice(errText(error, 'Thử lại')); } finally { state.advRunning = false; advSetRunButtons(); }
  }

  /** Tiến trình realtime từ orchestrator (videoAgent:onEvent). */
  function onAdvEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'log') {
      logLine(ui.advLog, ev.message || '');
      if (ui.advLog) ui.advLog.style.display = 'block';
      return;
    }
    if (ev.type === 'progress' || ev.type === 'stage' || ev.type === 'state') {
      const stage = ev.stage || ev.state || (ev.data && (ev.data.stage || ev.data.state)) || '';
      const pct = ev.percent != null ? ev.percent : (ev.progress != null ? ev.progress : (ev.data && (ev.data.percent || ev.data.progress)));
      if (stage) markAdvStages(String(stage).toUpperCase());
      const vi = STAGE_VI[stage] || (ev.message || '');
      advSetProgress(vi ? `${vi}${pct != null ? ` — ${pct}%` : ''}` : (ev.message || ''), pct);
      if (ev.message) logLine(ui.advLog, ev.message);
    }
  }

  function showAdvResult(r) {
    if (!ui.advResult) return;
    ui.advResult.className = '';
    ui.advResult.innerHTML = '';
    const out = r.output || r.outputPath || (r.job && (r.job.output || r.job.outputPath));
    const scenes = (r.timeline && r.timeline.scenes) || [];
    const qa = r.qa || (r.job && r.job.qa) || {};
    ui.advResult.append(el('div', { class: 'va-kv' },
      el('span', { class: 'k' }, 'Trạng thái'), el('span', {}, r.status ? String(r.status) : (r.ok ? 'xong' : '—')),
      el('span', { class: 'k' }, 'Số cảnh'), el('span', {}, String(scenes.length)),
      el('span', { class: 'k' }, 'Chất lượng (QA)'), el('span', {}, C.qaSummary(qa)),
      el('span', { class: 'k' }, 'File video'), el('span', {}, out ? esc(out) : '— xem job trong thư mục dự án —')));
    if (out) {
      ui.advResult.append(el('div', { class: 'va-row' },
        el('button', { class: 'va-btn primary', onclick: () => C.openSys(out) }, '▶ Mở video'),
        el('button', { class: 'va-btn ghost', onclick: () => C.openSys(folderOf(out)) }, '📂 Mở thư mục chứa')));
    }
  }

  async function refreshAdvVersions(projectDir) {
    const bridge = va25();
    if (!bridge || typeof bridge.versions !== 'function' || !ui.advVerSelect) return;
    try {
      const r = await bridge.versions(projectDir);
      ui.advVerSelect.innerHTML = '';
      const versions = (r && r.versions) || [];
      if (!versions.length) {
        ui.advVerSelect.append(el('option', { value: '' }, '— chưa có phiên bản nào —'));
        if (ui.advRestoreBtn) ui.advRestoreBtn.disabled = true;
        return;
      }
      versions.forEach((v) => {
        ui.advVerSelect.append(el('option', { value: String(v.version) },
          `v${v.version} — ${v.createdAt || v.date || ''} ${v.note ? '· ' + v.note : ''}`));
      });
      if (ui.advRestoreBtn) ui.advRestoreBtn.disabled = false;
    } catch (_) { /* im lặng */ }
  }

  async function restoreAdvVersion() {
    const bridge = va25();
    const v = ui.advVerSelect && ui.advVerSelect.value;
    if (!bridge || !v || !state.advProject) return;
    try {
      const r = await bridge.restore(state.advProject.projectDir, v);
      if (!r || r.ok === false) { notice(errText(r && (r.error || r), `Khôi phục v${v}`)); return; }
      notice(`Đã khôi phục spec về phiên bản v${v}. Bấm "🤖 Chạy Video Agent" để dựng lại video.`, 'ok');
    } catch (error) { notice(errText(error, `Khôi phục v${v}`)); }
  }

  /* ── đăng ký ── */
  C.buildAdvanced = buildAdvanced; C.buildAdvStageList = buildAdvStageList;
  C.markAdvStages = markAdvStages; C.advSetRunButtons = advSetRunButtons;
  C.advSetProgress = advSetProgress; C.renderAdvChecklist = renderAdvChecklist;
  C.pickAdvProject = pickAdvProject; C.inspectAdvPath = inspectAdvPath;
  C.applyAdvInspect = applyAdvInspect; C.runAdv = runAdv; C.cancelAdv = cancelAdv;
  C.retryAdv = retryAdv; C.onAdvEvent = onAdvEvent; C.showAdvResult = showAdvResult;
  C.refreshAdvVersions = refreshAdvVersions; C.restoreAdvVersion = restoreAdvVersion;
})();
