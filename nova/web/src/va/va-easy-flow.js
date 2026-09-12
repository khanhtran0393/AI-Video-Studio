'use strict';

/* va-easy-flow.js — chế độ DỄ: logic chạy (luồng Nhanh qua bridge
 * documentary, luồng Pipeline đầy đủ §25 qua bridge videoAgent), sự kiện
 * realtime, kết quả/QA, mở & làm mới dự án đã lưu. Tách từ
 * video-agent-panel.js. Nạp SAU va-easy-ui.js; syncEasyReady (easy-ui) gọi
 * qua C.<tên>. KHÔNG import/export. */
(function () {
  const C = window.vaPanelCtx;
  const { el, esc, fmt, fileName, folderOf, errText, STAGE_VI, state, ui, notice, logLine,
    doc, va25, sys, setStepState, b64FromText, b64FromBlob, saveViaBridge, SAMPLE_TITLE } = C;

  /* ════════ CHẾ ĐỘ DỄ — LOGIC ════════ */
  /** Tiêu đề dự án: ưu tiên tiêu đề nhận từ tool YouTube SEO / dự án đã mở;
      chưa có thì tự đặt từ dòng đầu kịch bản; cùng lắm fallback "Video". */
  function easyProjectTitle() {
    if (C.easyTitle) return C.easyTitle;
    const firstLine = String((ui.narrationArea && ui.narrationArea.value) || '')
      .split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
    return firstLine ? firstLine.slice(0, 60) : 'Video';
  }
  function fillSample() {
    if (!ui.narrationArea) return;
    C.easyTitle = SAMPLE_TITLE;
    ui.narrationArea.value = SAMPLE_NARRATION;
    C.syncEasyReady();
    notice('Đã điền ví dụ mẫu — bấm "🎬 Tạo video của tôi" ở Bước 3 để thử.', 'info');
  }

  async function pickAsset() {
    const s = sys();
    if (!s || typeof s.pickMediaFile !== 'function') { notice('Chưa có bridge chọn file. Hãy chạy trong app Electron.'); return; }
    try {
      const r = await s.pickMediaFile('image');
      if (!r || r.canceled || !r.path) return;
      state.assets.push({
        id: `asset_${state.assets.length + 1}`,
        title: fileName(r.path),
        path: r.path,
        type: r.video ? 'video' : 'image',
        tags: [],
      });
      renderChips();
    } catch (error) { notice(errText(error, 'Chọn ảnh')); }
  }

  function renderChips() {
    if (!ui.chipsBox) return;
    ui.chipsBox.innerHTML = '';
    state.assets.forEach((a, i) => {
      const chip = el('span', { class: 'va-chip', title: a.path }, `🖼 ${a.title}`,
        el('button', { onclick: () => { state.assets.splice(i, 1); renderChips(); }, title: 'Xoá ảnh này' }, '✕'));
      ui.chipsBox.append(chip);
    });
    if (ui.step2) setStepState(ui.step2, state.assets.length ? 'done' : '');
  }

  function setEasyProgress(label, percent) {
    if (ui.easyProgFill) ui.easyProgFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    if (ui.easyProgLabel) ui.easyProgLabel.textContent = label || '';
  }

  async function runEasy() {
    if (state.running) return;
    const narration = ui.narrationArea.value.trim();
    if (!narration) {
      notice('Bạn hãy dán kịch bản ở Bước 1 trước (hoặc bấm "Điền ví dụ mẫu").');
      if (ui.step1 && ui.step1.card) ui.step1.card.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (ui.fullPipelineChk && ui.fullPipelineChk.checked) { await runEasyPipeline(); return; }

    const bridge = doc();
    if (!bridge) { notice('Chưa có native bridge. Hãy mở tab này từ app Electron.'); return; }

    state.running = true;
    state.outputPath = null;
    if (ui.runBtn) ui.runBtn.disabled = true;
    notice(null);
    setStepState(ui.step3, 'active');
    setStepState(ui.step4, '');
    if (ui.resultBox) ui.resultBox.innerHTML = '';
    if (ui.easyLog) ui.easyLog.innerHTML = '';
    if (ui.easyLog) ui.easyLog.style.display = 'block';
    setEasyProgress('Đang bắt đầu…', 2);
    logLine(ui.easyLog, 'Bắt đầu tạo video…');

    try {
      const projectId = `video_${Date.now().toString(36)}`;
      state.projectId = projectId;
      const projTitle = easyProjectTitle();
      logLine(ui.easyLog, `Tạo dự án "${projTitle}" (${projectId})…`);
      await bridge.create({
        projectId,
        overwrite: true,
        title: projTitle,
        narration,
        assets: state.assets,
      });

      setEasyProgress('Agent đang dựng timeline…', 30);
      logLine(ui.easyLog, 'Agent đang phân tích lời thoại, chia cảnh và ghép ảnh…');
      const result = await bridge.runFull({
        projectId,
        input: { lockContent: true, autoFix: true, render: false },
        concurrency: 4,
      });
      const scenes = (result && result.timeline && result.timeline.scenes) || [];
      logLine(ui.easyLog, `Dựng xong ${scenes.length} cảnh · QA ${(result && result.qa && result.qa.status) || 'not-run'}.`);

      let renderResult = null;
      if (ui.autoRenderChk && ui.autoRenderChk.checked) {
        setEasyProgress('Đang render MP4 — bước này có thể lâu vài phút…', 60);
        logLine(ui.easyLog, 'Bắt đầu render MP4…');
        renderResult = await bridge.render({ projectId });
        if (renderResult && renderResult.ok) {
          state.outputPath = renderResult.outputPath || null;
          logLine(ui.easyLog, `Render xong: ${state.outputPath || 'OK'}`);
        } else {
          throw (renderResult && (renderResult.error || renderResult)) || new Error('Render thất bại');
        }
      }
      setEasyProgress('Hoàn tất 🎉', 100);
      showEasyResult(result, renderResult);
      setStepState(ui.step3, 'done');
      setStepState(ui.step4, 'active');
      refreshProjects(); /* dự án mới xuất hiện trong "Mở dự án đã có" */
      if (ui.step4 && ui.step4.card) ui.step4.card.scrollIntoView({ behavior: 'smooth' });
      notice('Video đã sẵn sàng ở Bước 4! 🎉', 'ok');
    } catch (error) {
      setEasyProgress('Lỗi', 0);
      notice(errText(error, 'Tạo video'));
      logLine(ui.easyLog, 'Lỗi: ' + errText(error));
    } finally {
      state.running = false;
      C.syncEasyReady();
    }
  }
  /* ════════ CHẾ ĐỘ DỄ — LUỒNG PIPELINE ĐẦY ĐỦ (videoAgent §25) ════════
     Gom dữ liệu wizard (lời thoại + giọng đọc/ảnh đã nhận) thành thư mục
     dự án chuẩn §4 (script/ tts/ images/ + config.json) rồi chạy 17 bước.
     Ghi file qua native.saveFile / readFileB64 có sẵn — KHÔNG thêm kênh
     IPC mới (Luật 1). */

  async function runEasyPipeline() {
    const s = sys();
    const bridge = va25();
    if (!s || typeof s.saveFile !== 'function' || typeof s.pickFolder !== 'function') {
      notice('Thiếu bridge native (saveFile / pickFolder) — hãy chạy trong app Electron mới nhất.');
      return;
    }
    if (!bridge || typeof bridge.run !== 'function') {
      notice('Thiếu bridge videoAgent — hãy chạy trong app Electron mới nhất.');
      return;
    }

    state.running = true;
    state.easyPipeline = true;
    state.outputPath = null;
    if (ui.runBtn) ui.runBtn.disabled = true;
    notice(null);
    setStepState(ui.step3, 'active');
    setStepState(ui.step4, '');
    if (ui.resultBox) ui.resultBox.innerHTML = '';
    if (ui.easyLog) { ui.easyLog.innerHTML = ''; ui.easyLog.style.display = 'block'; }
    setEasyProgress('Chọn nơi lưu dự án…', 2);
    logLine(ui.easyLog, 'Chạy pipeline đầy đủ 17 bước (Video Agent §25)…');

    try {
      const fr = await s.pickFolder();
      if (!fr || fr.canceled || !fr.path) {
        logLine(ui.easyLog, 'Đã huỷ — chưa chọn thư mục lưu dự án.');
        setEasyProgress('Đã huỷ', 0);
        return;
      }
      const dir = fr.path;
      logLine(ui.easyLog, 'Thư mục dự án: ' + dir);
      // Nhớ projectDir cho lần mở app sau (resume công việc dang dở).
      if (typeof sessSnapPatch === 'function') { try { sessSnapPatch('vaEasyProjectDir', dir); } catch (e) {} }

      /* script/script.md — bắt buộc theo §4 (discover VA_SCRIPT_MISSING) */
      const title = easyProjectTitle();
      setEasyProgress('Đang ghi kịch bản…', 5);
      await saveViaBridge(s, {
        dir, subdir: 'script', name: 'script.md',
        base64: b64FromText('# ' + title + '\n\n' + ui.narrationArea.value.trim() + '\n'),
      });
      logLine(ui.easyLog, 'Đã ghi script/script.md');

      /* tts/voice.<ext> — chỉ khi đã nhận giọng đọc từ tool Giọng nói */
      if (state.importedVoice && state.importedVoice.blob) {
        setEasyProgress('Đang ghi giọng đọc…', 8);
        await saveViaBridge(s, {
          dir, subdir: 'tts', name: 'voice.' + state.importedVoice.ext,
          base64: await b64FromBlob(state.importedVoice.blob),
        });
        logLine(ui.easyLog, 'Đã ghi tts/voice.' + state.importedVoice.ext + ' (' + state.importedVoice.ten + ')');
      } else {
        logLine(ui.easyLog, 'Chưa nhận giọng đọc — Agent dựng timeline theo thời lượng ước tính.');
      }

      /* images/ — ảnh nhân vật đã nhận + ảnh đã chọn ở Bước 2 (chép qua readFileB64) */
      setEasyProgress('Đang ghi ảnh…', 10);
      let nImg = 0;
      for (const img of state.importedImages) {
        const name = String(img.fileName || (img.name + '.png')).replace(/[/\\:*?"<>|]+/g, '_');
        const b64 = String(img.base64 || '').replace(/^data:[^;]+;base64,/, '');
        if (!b64) { logLine(ui.easyLog, 'Bỏ qua ảnh "' + img.name + '" (không có dữ liệu).'); continue; }
        await saveViaBridge(s, { dir, subdir: 'images', name, base64: b64 });
        nImg++;
      }
      for (const a of state.assets) {
        if (!a.path || a.type !== 'image') continue;
        try {
          const r = await s.readFileB64(a.path);
          if (!r || r.error || !r.dataUrl) throw new Error(String((r && r.error) || 'Không đọc được file ảnh.'));
          await saveViaBridge(s, { dir, subdir: 'images', name: fileName(a.path), base64: r.dataUrl });
          nImg++;
        } catch (e) {
          logLine(ui.easyLog, 'Bỏ qua ảnh ' + fileName(a.path) + ': ' + errText(e));
        }
      }
      logLine(ui.easyLog, 'Đã ghi ' + nImg + ' ảnh vào images/.');

      /* config.json — tiêu đề cho pipeline (discover.loadConfig) */
      await saveViaBridge(s, { dir, name: 'config.json', base64: b64FromText(JSON.stringify({ title }, null, 2)) });
      logLine(ui.easyLog, 'Đã ghi config.json');

      setEasyProgress('Agent đang chạy 17 bước — theo dõi nhật ký bên dưới…', 15);
      // Tạo inputData từ dữ liệu nhập (ưu tiên dùng dữ liệu trực tiếp thay vì file)
      const inputData = {
        script: ui.narrationArea.value.trim(),
        title: easyProjectTitle(),
        rootDir: dir,
        config: { title: easyProjectTitle() },
        tts: null,
        images: [],
        assets: state.assets,
      };
      // Nếu có giọng đọc
      if (state.importedVoice && state.importedVoice.blob) {
        const audioBase64 = await b64FromBlob(state.importedVoice.blob);
        inputData.tts = {
          audio: audioBase64,
          filename: 'voice.' + state.importedVoice.ext,
          // Nếu có timestamps, có thể thêm sau
        };
      }
      // Ảnh từ importedImages
      for (const img of state.importedImages) {
        if (img.base64) {
          inputData.images.push({
            name: img.fileName || img.name + '.png',
            data: img.base64.replace(/^data:[^;]+;base64,/, ''),
            type: 'scene',
            fileName: img.fileName || img.name + '.png',
          });
        }
      }
      // Ảnh từ state.assets (nếu có dữ liệu base64)
      for (const a of state.assets) {
        if (a.path && a.type === 'image') {
          try {
            const r = await s.readFileB64(a.path);
            if (r && r.dataUrl) {
              inputData.images.push({
                name: fileName(a.path),
                data: r.dataUrl.replace(/^data:[^;]+;base64,/, ''),
                type: a.tags && a.tags.includes('character') ? 'character' : 'scene',
                fileName: fileName(a.path),
              });
            }
          } catch (_) {}
        }
      }
      // Gọi bridge.run với inputData
      const r = await bridge.run({ inputData, options: { skipPreview: false } });
      if (!r || r.ok === false) throw (r && (r.error || r)) || new Error('Video Agent chạy thất bại.');

      state.outputPath = r.output || r.outputPath || (r.job && (r.job.output || r.job.outputPath)) || null;
      setEasyProgress('Hoàn tất 🎉', 100);
      showEasyPipelineResult(r, dir);
      setStepState(ui.step3, 'done');
      setStepState(ui.step4, 'active');
      if (ui.step4 && ui.step4.card) ui.step4.card.scrollIntoView({ behavior: 'smooth' });
      notice('Pipeline đầy đủ đã chạy xong — xem video ở Bước 4! 🎉', 'ok');
    } catch (error) {
      setEasyProgress('Lỗi', 0);
      notice(errText(error, 'Chạy pipeline đầy đủ'));
      logLine(ui.easyLog, 'Lỗi: ' + errText(error));
    } finally {
      state.running = false;
      state.easyPipeline = false;
      C.syncEasyReady();
    }
  }

  /** Bước 4 — kết quả luồng pipeline §25 (dạng rút gọn của showAdvResult). */
  function showEasyPipelineResult(r, dir) {
    if (!ui.resultBox) return;
    ui.resultBox.innerHTML = '';
    const out = state.outputPath;
    const scenes = (r.timeline && r.timeline.scenes)
      || (r.job && r.job.timeline && r.job.timeline.scenes) || [];
    const qa = r.qa || (r.job && r.job.qa) || {};
    ui.resultBox.append(el('div', { class: 'va-kv' },
      el('span', { class: 'k' }, 'Trạng thái'), el('span', {}, r.status ? String(r.status) : (r.ok ? 'xong' : '—')),
      el('span', { class: 'k' }, 'Số cảnh'), el('span', {}, String(scenes.length)),
      el('span', { class: 'k' }, 'Chất lượng (QA)'), el('span', {}, qaSummary(qa)),
      el('span', { class: 'k' }, 'File video'), el('span', {}, out ? esc(out) : '— xem output/ trong thư mục dự án —'),
      el('span', { class: 'k' }, 'Thư mục dự án'), el('span', {}, esc(dir))));
    const row = el('div', { class: 'va-row' });
    if (out) row.append(
      el('button', { class: 'va-btn primary', onclick: () => openSys(out) }, '▶ Mở video'),
      el('button', { class: 'va-btn ghost', onclick: () => previewVideo(out) }, '👁 Xem trước trong app'));
    row.append(el('button', { class: 'va-btn ghost', onclick: () => openSys(dir) }, '📂 Mở thư mục dự án'));
    ui.resultBox.append(row, el('div', { id: 'va-video-holder' }));
  }

  /** videoAgent:event khi §25 chạy từ chế độ Dễ — log + thanh tiến trình Bước 3. */
  function onEasyVaEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'log') {
      logLine(ui.easyLog, ev.message || '');
      if (ui.easyLog) ui.easyLog.style.display = 'block';
      return;
    }
    if (ev.type === 'progress' || ev.type === 'stage' || ev.type === 'state') {
      const stage = ev.stage || ev.state || (ev.data && (ev.data.stage || ev.data.state)) || '';
      const pct = ev.percent != null ? ev.percent : (ev.progress != null ? ev.progress : (ev.data && (ev.data.percent || ev.data.progress)));
      const vi = STAGE_VI[stage] || (ev.message || '');
      setEasyProgress(vi ? vi + (pct != null ? ' — ' + pct + '%' : '') : (ev.message || ''),
        pct != null ? Math.max(15, Number(pct) || 0) : null);
      if (ev.message || vi) logLine(ui.easyLog, ev.message || vi);
    }
  }

  /** Bước 4 — kết quả thân thiện + xem trước + mở file. */
  function showEasyResult(result, renderResult) {
    if (!ui.resultBox) return;
    ui.resultBox.innerHTML = '';
    const scenes = (result && result.timeline && result.timeline.scenes) || [];
    const qa = (result && result.qa) || {};
    const out = state.outputPath || (renderResult && renderResult.outputPath) || null;

    const openVideoBtn = el('button', { class: 'va-btn primary', onclick: () => openSys(out) }, '▶ Mở video');
    const openFolderBtn = el('button', { class: 'va-btn ghost', onclick: () => openSys(folderOf(out)) }, '📂 Mở thư mục chứa');
    const previewBtn = el('button', { class: 'va-btn ghost', onclick: () => previewVideo(out) }, '👁 Xem trước trong app');

    const kv = el('div', { class: 'va-kv' },
      el('span', { class: 'k' }, 'Số cảnh'), el('span', {}, String(scenes.length)),
      el('span', { class: 'k' }, 'Thời lượng'), el('span', {}, `${fmt(result && result.timeline && result.timeline.durationSec)} giây`),
      el('span', { class: 'k' }, 'Chất lượng (QA)'), el('span', {}, qaSummary(qa)),
      el('span', { class: 'k' }, 'File video'), el('span', {}, out ? esc(out) : '— chưa render (bỏ qua bước render MP4) —'));

    ui.resultBox.append(
      kv,
      el('div', { class: 'va-row' }, openVideoBtn, openFolderBtn, previewBtn),
      el('div', { id: 'va-video-holder' }),
    );

    if (scenes.length) {
      const table = el('table', { class: 'va-table' });
      table.append(el('tr', {},
        el('th', {}, '#'), el('th', {}, 'Cảnh'), el('th', {}, 'Bắt đầu (s)'), el('th', {}, 'Dài (s)'), el('th', {}, 'Ảnh')));
      for (const sc of scenes) {
        table.append(el('tr', {},
          el('td', {}, String((sc.index || 0) + 1)),
          el('td', {}, String(sc.sceneId || '-')),
          el('td', {}, fmt(sc.startSec)),
          el('td', {}, fmt(sc.durationSec)),
          el('td', {}, sc.assetId || '—')));
      }
      ui.resultBox.append(el('details', { class: 'va-more' }, el('summary', {}, 'Xem timeline từng cảnh'), table));
    }
  }

  function qaSummary(qa) {
    if (!qa || !qa.status) return '— chưa chạy —';
    if (qa.status === 'passed' || qa.status === 'pass') return `✅ Đạt — ${qa.passedScenes || '?'}/${qa.totalScenes || '?'} cảnh (${qa.passRate || 0}%)`;
    if (qa.status === 'failed' || qa.status === 'fail') return `⚠ Có ${qa.failedScenes || 0} cảnh lỗi — vẫn xem được video, có thể bấm tạo lại.`;
    return `Đã kiểm tra (${qa.status}) — ${qa.passedScenes || 0}/${qa.totalScenes || 0} cảnh đạt.`;
  }

  async function previewVideo(path) {
    const s = sys();
    const holder = document.getElementById('va-video-holder');
    if (!path || !holder || !s || typeof s.readFileB64 !== 'function') return;
    holder.innerHTML = '';
    holder.append(el('div', { class: 'va-hint' }, 'Đang nạp video để xem trước…'));
    try {
      const r = await s.readFileB64(path);
      if (!r || r.error || !r.dataUrl) throw (r && r.error) || new Error('Không đọc được file video.');
      holder.innerHTML = '';
      holder.append(el('video', { class: 'va-video', src: r.dataUrl, controls: 'controls' }));
    } catch (error) {
      holder.innerHTML = '';
      holder.append(el('div', { class: 'va-hint' }, 'Không xem trước được trong app — hãy bấm "▶ Mở video": ' + esc(errText(error))));
    }
  }

  function openSys(p) {
    const s = sys();
    if (!p || !s || typeof s.openPath !== 'function') { notice('Không mở được — thiếu bridge openPath.'); return; }
    try { s.openPath(p); } catch (error) { notice(errText(error, 'Mở file')); }
  }

  /** Mở dự án đã có: đổ dữ liệu + kết quả mới nhất vào wizard. */
  async function openEasyProject(projectId) {
    const bridge = doc();
    if (!bridge) return;
    try {
      const project = await bridge.read(projectId);
      /* bridge.read trả null khi project.json không còn trên đĩa — báo lỗi
         tiếng Việt thay vì để TypeError "reading 'title'". */
      if (!project) throw new Error('Không tìm thấy dự án "' + projectId + '" — có thể file dự án đã bị xoá hoặc di chỗ.');
      state.projectId = projectId;
      if (project.title) C.easyTitle = String(project.title);
      if (ui.narrationArea && project.narration) ui.narrationArea.value = project.narration;
      state.assets = Array.isArray(project.assets) ? project.assets.map((a) => ({ ...a })) : [];
      renderChips();
      C.syncEasyReady();
      notice(`Đã mở dự án "${project.title || projectId}" — bấm "🎬 Tạo video của tôi" để chạy lại.`, 'info');
      const output = project && project.render && project.render.outputPath;
      if (output) {
        state.outputPath = output;
        showEasyResult(project, { ok: true, outputPath: output });
        setStepState(ui.step3, 'done');
        setStepState(ui.step4, 'active');
      }
    } catch (error) {
      notice(errText(error, `Mở dự án ${projectId}`));
      ui.projectSelect.value = '';
    }
  }

  async function refreshProjects() {
    const bridge = doc();
    if (!bridge || !ui.projectSelect) return;
    try {
      const projects = (await bridge.list()) || [];
      const current = ui.projectSelect.value;
      ui.projectSelect.innerHTML = '';
      ui.projectSelect.append(el('option', { value: '' }, `— Mở dự án đã có (${projects.length}) —`));
      for (const p of projects) {
        ui.projectSelect.append(el('option', { value: p.projectId }, `${p.title || p.projectId} (${p.projectId})`));
      }
      if (current) ui.projectSelect.value = current;
    } catch (_) { /* im lặng — người mới không cần thấy lỗi này */ }
  }

  /* ── đăng ký ── */
  C.easyProjectTitle = easyProjectTitle; C.fillSample = fillSample;
  C.pickAsset = pickAsset; C.renderChips = renderChips;
  C.setEasyProgress = setEasyProgress; C.runEasy = runEasy;
  C.runEasyPipeline = runEasyPipeline; C.showEasyPipelineResult = showEasyPipelineResult;
  C.onEasyVaEvent = onEasyVaEvent; C.showEasyResult = showEasyResult;
  C.qaSummary = qaSummary; C.previewVideo = previewVideo; C.openSys = openSys;
  C.openEasyProject = openEasyProject; C.refreshProjects = refreshProjects;
})();
