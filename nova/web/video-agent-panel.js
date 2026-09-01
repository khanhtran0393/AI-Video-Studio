'use strict';

/* §25 — Video Agent UI panel. Integrated directly into main app (replaces separate window). */
(function () {
  const native = window.native && window.native.videoAgent;
  const notice = document.getElementById('notice');
  const panelsEl = document.getElementById('panels');
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  let jobId = null;
  let acceptingEvents = false;
  let currentProjectDir = null;

  if (!native) {
    notice.style.display = 'block';
    notice.innerHTML = '<b>⚠ Chưa có native bridge.</b> Hãy mở trang này từ Electron app (Nova) để dùng đầy đủ.';
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  }

  function panel(num, title, cls = '') {
    const body = el('div');
    const box = el('section', { class: `panel ${cls}` }, el('h2', {}, title, el('span', { class: 'num' }, num)), body);
    panelsEl.append(box);
    return body;
  }

  function setProgress(phase, percent) {
    progressFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    progressLabel.textContent = phase || 'idle';
  }

  function fmt(n) { return Number(n || 0).toFixed(2); }

  async function safe(fn, fallback = null) { try { return await fn(); } catch (error) { return fallback === null ? { error: String(error.message || error) } : fallback; } }

  // ── Panel 1: Project ──
  const projectBody = panel('01', 'Dự án');
  const projectList = el('ul');
  const projectSelect = el('select');
  const titleInput = el('input', { placeholder: 'Tiêu đề phim tài liệu' });
  projectBody.append(projectList, el('div', { class: 'row' }, projectSelect), el('div', { class: 'row' }, titleInput));

  // ── Panel 2: Script (content lock §2) ──
  const scriptBody = panel('02', 'Kịch bản (Narration)');
  const narrationArea = el('textarea', { placeholder: 'Dán narration tại đây. Mỗi đoạn (dòng trống) = 1 scene.' });
  const unlockBtn = el('button', { class: 'secondary' }, 'Unlock');
  const lockState = el('div', { class: 'meta' }, '—');
  scriptBody.append(narrationArea, el('div', { class: 'row' }, unlockBtn), lockState);

  // ── Panel 3: Assets ──
  const assetsBody = panel('03', 'Thư viện asset');
  const assetList = el('ul');
  const assetPath = el('textarea', { placeholder: 'Mỗi dòng: đường_dẫn_ảnh | tiêu đề, tag1, tag2' });
  assetsBody.append(assetList, assetPath);

  // ── Panel 4: Visual Beats & Plan (§3/§4/§7) ──
  const beatsBody = panel('04', 'Scene map & Visual plan', 'wide');
  const beatsList = el('div');
  beatsBody.append(beatsList);

  // ── Panel 5: Asset Matching (§11-13) ──
  const matchBody = panel('05', 'Asset matching');
  const matchList = el('div');
  matchBody.append(matchList);

  // ── Panel 6: Timeline (§20/§21) ──
  const timelineBody = panel('06', 'Timeline (audio master)', 'wide');
  const timelineTable = el('table');
  timelineBody.append(timelineTable);

  // ── Panel 7: Motion Plan (§14/§15) ──
  const motionBody = panel('07', 'Motion plan & presets');
  const motionList = el('div');
  motionBody.append(motionList);

  // ── Panel 8: Render (§19) ──
  const renderBody = panel('08', 'Render & Export');
  const renderBtn = el('button', { class: 'primary' }, 'Render Video');
  const renderInfo = el('div', { class: 'meta' }, 'Chưa render');
  renderBody.append(renderBtn, renderInfo);

  // ── Panel 9: Jobs (§22) ──
  const jobsBody = panel('09', 'Công việc');
  const jobsList = el('ul');
  jobsBody.append(jobsList);

  // ── Panel 10: Cost (§23) ──
  const costBody = panel('10', 'Chi phí ước tính');
  const costInfo = el('div');
  costBody.append(costInfo);

  // ── Panel 11: QA (§24) ──
  const qaBody = panel('11', 'Kiểm tra chất lượng');
  const qaInfo = el('div');
  qaBody.append(qaInfo);

  // ── Panel 12: History (§25) ──
  const historyBody = panel('12', 'Lịch sử');
  const historyList = el('ul');
  historyBody.append(historyList);

  async function refreshProjects() {
    if (!native) return;
    const projects = await native.listProjects();
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
    if (!native || !projectId) return;
    currentProjectDir = projectId;
    const project = await native.get(projectId);
    if (!project) return;

    titleInput.value = project.title || '';
    narrationArea.value = project.narration || '';
    assetPath.value = (project.assets || []).map(a => `${a.path} | ${a.title || ''}, ${a.tags ? a.tags.join(', ') : ''}`).join('\n');

    renderInfo.textContent = project.renderStatus ? `Render: ${project.renderStatus}` : 'Chưa render';
    lockState.textContent = project.lockContent ? 'Đã khóa nội dung' : 'Tự do chỉnh sửa';

    // Render timeline
    timelineTable.innerHTML = '<tr><th>#</th><th>Scene</th><th>Bắt đầu</th><th>Dur</th><th>Asset</th></tr>';
    const scenes = (project.timeline && project.timeline.scenes) || [];
    if (!scenes.length) { timelineTable.append(el('tr', {}, el('td', { colspan: '5', class: 'meta' }, 'Chưa có timeline.'))); return; }
    for (const scene of scenes) timelineTable.append(el('tr', {}, el('td', {}, String(scene.index + 1)), el('td', {}, String(scene.sceneId)), el('td', {}, fmt(scene.startSec)), el('td', {}, fmt(scene.durationSec)), el('td', {}, scene.assetId || '-')));
    timelineTable.append(el('tr', {}, el('td', { colspan: '2', class: 'meta' }, 'Tổng duration'), el('td', { colspan: '3' }, `${fmt(project.timeline.durationSec)}s`)));

    // Render QA
    if (project.qa) {
      qaInfo.innerHTML = '';
      const table = el('table');
      const rows = [
        ['Tổng scene', project.qa.totalScenes],
        ['Đạt', project.qa.passedScenes],
        ['Lỗi', project.qa.failedScenes],
        ['Tỷ lệ', `${project.qa.passRate}%`],
        ['Độ tin cậy', `${project.qa.confidence}%`]
      ];
      for (const [label, value] of rows) table.append(el('tr', {}, el('td', { class: 'meta' }, label), el('td', {}, String(value || 0))));
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
      assets.push({ id: `asset_${assets.length + 1}`, title: t || p, path: p, type: 'image', tags: t.split(',').map(s => s.trim()).filter(Boolean) });
    }
    await native.create({ projectId, overwrite: true, title: titleInput.value || 'Untitled', narration: narrationArea.value, assets });
    setProgress('starting', 2);
    try {
      const result = await native.runFull({ projectId, input: { lockContent: true, autoFix: true, render: false }, concurrency: 4 });
      renderInfo.textContent = `Pipeline xong · ${result.timeline.scenes.length} scene · QA ${result.qa.status}`;
      await openProject(projectId);
    } catch (error) {
      setProgress('error', 0); progressLabel.textContent = `Lỗi: ${error.message}`;
    }
  }

  async function renderVideo() {
    if (!native || !currentProjectDir) return;
    renderInfo.textContent = 'Đang render…';
    try {
      const result = await native.render({ projectId: currentProjectDir });
      renderInfo.textContent = result && result.ok ? `Rendered: ${result.outputPath || 'OK'}` : 'Render failed';
    } catch (error) { renderInfo.textContent = `Lỗi: ${error.message}`; }
  }

  document.getElementById('btnNew').onclick = () => { projectSelect.value = ''; titleInput.value = ''; narrationArea.value = ''; assetPath.value = ''; currentProjectDir = null; };
  document.getElementById('btnRunFull').onclick = runFull;
  projectSelect.onchange = () => openProject(projectSelect.value);
  unlockBtn.onclick = () => native && currentProjectDir && native.unlock(currentProjectDir).then(() => openProject(currentProjectDir));
  renderBtn.onclick = renderVideo;

  if (native) {
    native.onProgress(update => setProgress(update.phase, update.percent));
    native.onJob(update => { jobsList.append(el('li', {}, `${update.key}: ${update.status}${update.error ? ' — ' + update.error : ''}`)); jobsList.scrollTop = jobsList.scrollHeight; });
    refreshProjects();
    safe(() => native.presets(), []).then(list => { presets = list || []; });
    safe(() => native.providers(), null).then(providers => { if (providers) costInfo.append(el('div', { class: 'meta' }, `Providers: ${Object.entries(providers).map(([role, info]) => `${role}=${info.provider || 'fallback'}`).join(', ')}`)); });
  }
  // Navigation is handled by switchTool; no route changes needed
})();