'use strict';

/* §25 — Video Agent UI panel. Integrated directly into main app (replaces separate window). */
(function () {
  let initialized = false;
  let native = null;
  let notice;
  let panelsEl;
  let progressFill;
  let progressLabel;
  let lockState;

  let jobId = null;
  let currentProjectDir = null;
  let presets = [];

  // UI refs created on init
  let projectSelect;
  let titleInput;
  let narrationArea;
  let assetPath;
  let unlockBtn;
  let renderBtn;
  let renderInfo;
  let timelineTable;
  let qaInfo;
  let jobsList;
  let costInfo;
  let projectList;
  let beatsList;
  let matchList;
  let motionList;
  let historyList;

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children) {
      if (child == null) continue;
      node.append(child);
    }
    return node;
  }

  function panel(num, title, cls = '') {
    const body = el('div');
    const box = el('section', { class: `panel ${cls}` }, el('h2', {}, title, el('span', { class: 'num' }, num)), body);
    panelsEl.append(box);
    return body;
  }

  function setProgress(phase, percent) {
    if (!progressFill || !progressLabel) return;
    progressFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    progressLabel.textContent = phase || 'idle';
  }

  function fmt(n) { return Number(n || 0).toFixed(2); }

  async function safe(fn, fallback = null) {
    try {
      return await fn();
    } catch (error) {
      return fallback === null ? { error: String(error.message || error) } : fallback;
    }
  }

  function setupStaticPanels() {
    // Panel 1: Project
    const projectBody = panel('01', 'Dự án');
    projectList = el('ul');
    projectSelect = el('select');
    titleInput = el('input', { placeholder: 'Tiêu đề phim tài liệu' });
    projectBody.append(projectList, el('div', { class: 'row' }, projectSelect), el('div', { class: 'row' }, titleInput));

    // Panel 2: Script (content lock §2)
    const scriptBody = panel('02', 'Kịch bản (Narration)');
    narrationArea = el('textarea', { placeholder: 'Dán narration tại đây. Mỗi đoạn (dòng trống) = 1 scene.' });
    unlockBtn = el('button', { class: 'secondary' }, 'Unlock');
    lockState = el('div', { class: 'meta' }, '—');
    scriptBody.append(narrationArea, el('div', { class: 'row' }, unlockBtn), lockState);

    // Panel 3: Assets
    const assetsBody = panel('03', 'Thư viện asset');
    const assetList = el('ul');
    assetPath = el('textarea', { placeholder: 'Mỗi dòng: đường_dẫn_ảnh | tiêu đề, tag1, tag2' });
    assetsBody.append(assetList, assetPath);

    // Panel 4: Visual Beats & Plan (§3/§4/§7)
    const beatsBody = panel('04', 'Scene map & Visual plan', 'wide');
    beatsList = el('div');
    beatsBody.append(beatsList);

    // Panel 5: Asset Matching (§11-§13)
    const matchBody = panel('05', 'Asset matching');
    matchList = el('div');
    matchBody.append(matchList);

    // Panel 6: Timeline (§20/§21)
    const timelineBody = panel('06', 'Timeline (audio master)', 'wide');
    timelineTable = el('table');
    timelineBody.append(timelineTable);

    // Panel 7: Motion Plan (§14/§15)
    const motionBody = panel('07', 'Motion plan & presets');
    motionList = el('div');
    motionBody.append(motionList);

    // Panel 8: Render & Export
    const renderBody = panel('08', 'Render & Export');
    renderBtn = el('button', { class: 'primary' }, 'Render Video');
    renderInfo = el('div', { class: 'meta' }, 'Chưa render');
    renderBody.append(renderBtn, renderInfo);

    // Panel 9: Jobs (§22)
    const jobsBody = panel('09', 'Công việc');
    jobsList = el('ul');
    jobsBody.append(jobsList);

    // Panel 10: Cost (§23)
    const costBody = panel('10', 'Chi phí ước tính');
    costInfo = el('div');
    costBody.append(costInfo);

    // Panel 11: QA (§24)
    const qaBody = panel('11', 'Kiểm tra chất lượng');
    qaInfo = el('div');
    qaBody.append(qaInfo);

    // Panel 12: History (§25)
    const historyBody = panel('12', 'Lịch sử');
    historyList = el('ul');
    historyBody.append(historyList);
  }

  function attachEvents() {
    const btnNew = document.getElementById('btnNew');
    const btnRunFull = document.getElementById('btnRunFull');

    if (btnNew) {
      btnNew.onclick = () => {
        projectSelect.value = '';
        titleInput.value = '';
        narrationArea.value = '';
        assetPath.value = '';
        currentProjectDir = null;
      };
    }

    if (btnRunFull) {
      btnRunFull.onclick = runFull;
    }

    if (projectSelect) {
      projectSelect.onchange = () => openProject(projectSelect.value);
    }

    if (unlockBtn) {
      unlockBtn.onclick = () => {
        if (!native || !currentProjectDir || typeof native.unlock !== 'function') return;
        native.unlock(currentProjectDir).then(() => openProject(currentProjectDir));
      };
    }

    if (renderBtn) {
      renderBtn.onclick = renderVideo;
    }
  }

  async function refreshProjects() {
    if (!native || typeof native.listProjects !== 'function') return;
    let projects = [];
    try { projects = (await native.listProjects()) || []; }
    catch (_) { return; }
    if (!projectSelect) return;
    projectSelect.innerHTML = '';
    for (const p of projects) {
      const opt = el('option', { value: p.projectId }, p.title || p.projectId);
      projectSelect.append(opt);
    }
    if (projects.length > 0) {
      projectSelect.value = projects[0].projectId;
      await openProject(projects[0].projectId);
    }
  }

  async function openProject(projectId) {
    if (!native || !projectId || typeof native.get !== 'function') return;
    currentProjectDir = projectId;
    const project = await native.get(projectId);
    if (!project) return;

    titleInput.value = project.title || '';
    narrationArea.value = project.narration || '';
    assetPath.value = (project.assets || []).map((a) => `${a.path} | ${a.title || ''}, ${a.tags ? a.tags.join(', ') : ''}`).join('\n');

    if (renderInfo) {
      renderInfo.textContent = project.renderStatus ? `Render: ${project.renderStatus}` : 'Chưa render';
    }
    if (lockState) {
      lockState.textContent = project.lockContent ? 'Đã khóa nội dung' : 'Tự do chỉnh sửa';
    }

    if (!timelineTable) return;

    // Render timeline
    timelineTable.innerHTML = '<tr><th>#</th><th>Scene</th><th>Bắt đầu</th><th>Dur</th><th>Asset</th></tr>';
    const scenes = (project.timeline && project.timeline.scenes) || [];
    if (!scenes.length) {
      timelineTable.append(el('tr', {}, el('td', { colspan: '5', class: 'meta' }, 'Chưa có timeline.')));
      return;
    }
    for (const scene of scenes) {
      timelineTable.append(el(
        'tr',
        {},
        el('td', {}, String(scene.index + 1)),
        el('td', {}, String(scene.sceneId)),
        el('td', {}, fmt(scene.startSec)),
        el('td', {}, fmt(scene.durationSec)),
        el('td', {}, scene.assetId || '-')
      ));
    }
    timelineTable.append(el('tr', {}, el('td', { colspan: '2', class: 'meta' }, 'Tổng duration'), el('td', { colspan: '3' }, `${fmt(project.timeline.durationSec)}s`)));

    // Render QA
    if (project.qa && qaInfo) {
      qaInfo.innerHTML = '';
      const table = el('table');
      const rows = [
        ['Tổng scene', project.qa.totalScenes],
        ['Đạt', project.qa.passedScenes],
        ['Lỗi', project.qa.failedScenes],
        ['Tỷ lệ', `${project.qa.passRate}%`],
        ['Độ tin cậy', `${project.qa.confidence}%`]
      ];
      for (const [label, value] of rows) {
        table.append(el('tr', {}, el('td', { class: 'meta' }, label), el('td', {}, String(value || 0))));
      }
      table.append(el('tr', {}, el('td', { class: 'meta' }, 'Ước tính cost'), el('td', {}, `$${project.qa.estimatedCost || 0}`)));
      qaInfo.append(table);
    }
  }

  async function runFull() {
    if (!native) return;
    const projectId = projectSelect.value || `video_${Date.now().toString(36)}`;
    const assets = [];
    for (const line of assetPath.value.split('\n')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      const [p, t = ''] = parts;
      assets.push({
        id: `asset_${assets.length + 1}`,
        title: t || p,
        path: p,
        type: 'image',
        tags: t.split(',').map(s => s.trim()).filter(Boolean)
      });
    }

    if (typeof native.create === 'function') {
      await native.create({
        projectId,
        overwrite: true,
        title: titleInput.value || 'Untitled',
        narration: narrationArea.value,
        assets
      });
    }
    setProgress('starting', 2);

    try {
      const result = await native.runFull({
        projectId,
        input: { lockContent: true, autoFix: true, render: false },
        concurrency: 4
      });
      renderInfo.textContent = `Pipeline xong · ${result.timeline.scenes.length} scene · QA ${result.qa.status}`;
      await openProject(projectId);
    } catch (error) {
      setProgress('error', 0);
      progressLabel.textContent = `Lỗi: ${error.message}`;
    }
  }

  async function renderVideo() {
    if (!native || !currentProjectDir) return;
    renderInfo.textContent = 'Đang render…';
    try {
      const result = await native.render({ projectId: currentProjectDir });
      renderInfo.textContent = result && result.ok ? `Rendered: ${result.outputPath || 'OK'}` : 'Render failed';
    } catch (error) {
      renderInfo.textContent = `Lỗi: ${error.message}`;
    }
  }

  function setupNative() {
    if (!native) return;

    // Bridge preload hiện chỉ expose onEvent (kênh 'videoAgent:event' từ main,
    // payload: { jobId, stage, ... }). Panel phải chịu được bridge thiếu
    // onProgress/onJob thay vì ném TypeError chết toàn bộ panel khi init.
    if (typeof native.onProgress === 'function') {
      native.onProgress(update => setProgress(update.phase, update.percent));
    }
    if (typeof native.onJob === 'function') {
      native.onJob(update => {
        jobsList.append(el('li', {}, `${update.key}: ${update.status}${update.error ? ' — ' + update.error : ''}`));
        jobsList.scrollTop = jobsList.scrollHeight;
      });
    }
    if (typeof native.onEvent === 'function') {
      native.onEvent(ev => {
        if (!ev) return;
        if (ev.stage) {
          setProgress(ev.stage, typeof ev.percent === 'number' ? ev.percent : 0);
          if (jobsList) {
            jobsList.append(el('li', {}, `${ev.jobId || '-'}: ${ev.stage}${ev.error ? ' — ' + ev.error : ''}`));
            jobsList.scrollTop = jobsList.scrollHeight;
          }
        }
      });
    }

    refreshProjects();
    safe(() => native.presets(), []).then(list => { presets = list || []; });
    safe(() => native.providers(), null).then(providers => {
      if (!providers || !costInfo) return;
      const lines = Object.entries(providers).map(([role, info]) => `${role}=${info.provider || 'fallback'}`);
      if (!lines.length) return;
      costInfo.append(el('div', { class: 'meta' }, `Providers: ${lines.join(', ')}`));
    });
  }

  function initVideoAgentPanel() {
    // Called by switchTool('toolvideoagent'). Keep idempotent.
    if (initialized) {
      if (native) refreshProjects();
      return;
    }

    native = window.native && window.native.videoAgent;
    notice = document.getElementById('notice');
    panelsEl = document.getElementById('panels');
    progressFill = document.getElementById('progressFill');
    progressLabel = document.getElementById('progressLabel');

    if (!notice || !panelsEl || !progressFill || !progressLabel) {
      return;
    }

    if (!native) {
      notice.style.display = 'block';
      notice.innerHTML = '<b>⚠ Chưa có native bridge.</b> Hãy mở trang này từ Electron app (Nova) để dùng đầy đủ.';
    }

    setupStaticPanels();
    attachEvents();
    if (native) setupNative();

    initialized = true;
  }

  window.videoAgentPanel = Object.assign({}, window.videoAgentPanel || {}, {
    init: initVideoAgentPanel
  });
})();