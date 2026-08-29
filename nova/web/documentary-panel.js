'use strict';

/* §32 — Documentary UI panel. 12 khối thông tin, mọi thao tác qua window.native.documentary. */
(function () {
  const native = window.native && window.native.documentary;
  const notice = document.getElementById('notice');
  const panelsEl = document.getElementById('panels');
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  let current = null; // project đang mở
  let presets = [];

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

  // ── Panel 8: AI Jobs (§24) ──
  const jobsBody = panel('08', 'AI Jobs');
  const jobsList = el('ul');
  jobsBody.append(jobsList);

  // ── Panel 9: QA (§22/§23) ──
  const qaBody = panel('09', 'QA & Auto-Fix');
  const qaList = el('ul');
  qaBody.append(qaList);

  // ── Panel 10: Render (§27) ──
  const renderBody = panel('10', 'Render');
  const renderInfo = el('div', { class: 'meta' }, 'Chưa render.');
  const renderBtn = el('button', { class: 'secondary' }, 'Render video');
  renderBody.append(renderInfo, el('div', { class: 'row' }, renderBtn));

  // ── Panel 11: Versions (§31) ──
  const versionsBody = panel('11', 'Phiên bản & Rollback');
  const versionList = el('ul');
  versionsBody.append(versionList);

  // ── Panel 12: Cost (§36) + Providers (§26) ──
  const costBody = panel('12', 'Chi phí & Providers');
  const costInfo = el('div');
  costBody.append(costInfo);

  async function refreshProjects() {
    projectList.innerHTML = '';
    const items = native ? await safe(native.list, []) : [];
    if (!items.length) projectList.append(el('li', { class: 'meta' }, 'Chưa có dự án nào.'));
    projectSelect.innerHTML = '<option value="">— Chọn / tạo mới —</option>';
    for (const item of items) {
      projectList.append(el('li', {}, `${item.title} · ${item.status} · ${item.updatedAt || ''}`));
      projectSelect.append(el('option', { value: item.projectId }, `${item.title} (${item.projectId})`));
    }
  }

  async function openProject(projectId) {
    if (!projectId) { current = null; return; }
    const project = await native.read(projectId);
    current = project;
    titleInput.value = project.title || '';
    narrationArea.value = project.script && project.script.narration || '';
    const locked = project.script && project.script.lockedAt;
    lockState.textContent = locked ? `Locked @ ${project.script.lockedAt}` : 'Chưa lock';
    narrationArea.disabled = Boolean(locked);
    assetList.innerHTML = '';
    for (const asset of project.assets || []) assetList.append(el('li', {}, `${asset.id} · ${asset.title || asset.path || ''}`));
    renderBeats(project); renderMatch(project); renderTimeline(project); renderMotion(project);
    renderQa(project); renderVersions(projectId); renderCost(project);
  }

  function renderBeats(project) {
    beatsList.innerHTML = '';
    const scenes = (project.sceneMap && project.sceneMap.scenes) || (project.timeline && project.timeline.scenes) || [];
    if (!scenes.length) { beatsList.append(el('div', { class: 'meta' }, 'Chạy pipeline để sinh scene/beat.')); return; }
    for (const scene of scenes) {
      const beats = scene.beats || [{ beatId: scene.sceneId, text: scene.text, startSec: scene.startSec, endSec: scene.endSec, assetId: scene.assetId, confidence: scene.confidence, motion: scene.motion }];
      for (const beat of beats) {
        beatsList.append(el('div', { class: 'beat' },
          el('div', { class: 'bt' }, el('b', {}, beat.text || ''), el('span', {}, `${fmt(beat.startSec)}-${fmt(beat.endSec)}s`)),
          el('div', { class: 'meta' }, `asset: ${beat.assetId || '-'} · conf: ${fmt(beat.confidence)}${beat.motion ? ` · motion: ${beat.motion.preset}` : ''}`)
        ));
      }
    }
  }

  function renderMatch(project) {
    matchList.innerHTML = '';
    const scenes = (project.timeline && project.timeline.scenes) || [];
    let count = 0;
    for (const scene of scenes) for (const beat of scene.beats || []) {
      count += 1;
      if (count > 8) continue;
      matchList.append(el('div', { class: 'beat' }, el('div', { class: 'bt' }, el('b', {}, beat.beatId), el('span', {}, `score ${fmt(beat.confidence)}`)), el('div', { class: 'meta' }, `-> ${beat.assetId || '(không khớp)'}`)));
    }
    if (!count) matchList.append(el('div', { class: 'meta' }, 'Chưa có kết quả matching.'));
  }

  function renderMotion(project) {
    motionList.innerHTML = '';
    if (presets.length) motionList.append(el('div', { class: 'meta' }, `Preset library (${presets.length}): ${presets.map(p => p.name).join(', ')}`));
    const scenes = (project.timeline && project.timeline.scenes) || [];
    let shown = 0;
    for (const scene of scenes) for (const beat of scene.beats || []) {
      if (!beat.motion) continue;
      if (shown++ > 8) continue;
      motionList.append(el('div', { class: 'beat' }, el('div', { class: 'bt' }, el('b', {}, beat.motion.preset), el('span', {}, `intensity ${beat.motion.intensity}`)), el('div', { class: 'meta' }, beat.motion.motionType || '')));
    }
    if (!shown) motionList.append(el('div', { class: 'meta' }, 'Chưa có motion plan.'));
  }

  function renderQa(project) {
    qaList.innerHTML = '';
    const qa = project.qa || {};
    qaList.append(el('li', {}, el('span', { class: `status-${qa.status}` }, `Trạng thái: ${qa.status || '-'}`), ` · ${qa.beatsChecked || 0} beat kiểm`));
    for (const item of qa.errors || []) qaList.append(el('li', { class: 'err' }, `X ${item.code}: ${item.message || ''}`));
    for (const item of qa.warnings || []) qaList.append(el('li', { class: 'warn' }, `! ${item.code}: ${item.message || ''}`));
  }

  async function renderVersions(projectId) {
    versionList.innerHTML = '';
    if (!native || !projectId) return;
    const versions = await safe(() => native.versions(projectId), []);
    if (!versions.length) { versionList.append(el('li', { class: 'meta' }, 'Chưa có version.')); return; }
    for (const v of versions.slice(-8).reverse()) {
      versionList.append(el('li', {}, `${v.stage}#${v.version} · ${v.at}${v.note ? ' · ' + v.note : ''} `, el('button', { class: 'secondary', onclick: () => rollback(projectId, v.stage, v.version) }, 'rollback')));
    }
  }

  async function rollback(projectId, stage, version) {
    if (!window.confirm(`Rollback về ${stage}#${version}?`)) return;
    await native.rollback(projectId, stage, version);
    await openProject(projectId);
  }

  function renderCost(project) {
    costInfo.innerHTML = '';
    const costs = project.costs || {};
    const usage = costs.usage || {};
    const rows = [
      ['API calls', usage.apiCalls], ['Input tokens', usage.inputTokens], ['Output tokens', usage.outputTokens],
      ['Vision calls', usage.visionCalls], ['Embed calls', usage.embedCalls], ['Cache hits', usage.cacheHits],
      ['Image gen', usage.imageGenerations], ['I2V', usage.imageToVideoCalls],
    ];
    const table = el('table');
    for (const [label, value] of rows) table.append(el('tr', {}, el('td', { class: 'meta' }, label), el('td', {}, String(value || 0))));
    table.append(el('tr', {}, el('td', { class: 'meta' }, 'Ước tính cost'), el('td', {}, `$${costs.estimatedCost || 0}`)));
    costInfo.append(table);
  }


  function renderTimeline(project) {
    timelineTable.innerHTML = '<tr><th>#</th><th>Scene</th><th>Bắt đầu</th><th>Dur</th><th>Asset</th></tr>';
    const scenes = (project.timeline && project.timeline.scenes) || [];
    if (!scenes.length) { timelineTable.append(el('tr', {}, el('td', { colspan: '5', class: 'meta' }, 'Chưa có timeline.'))); return; }
    for (const scene of scenes) timelineTable.append(el('tr', {}, el('td', {}, String(scene.index + 1)), el('td', {}, String(scene.sceneId)), el('td', {}, fmt(scene.startSec)), el('td', {}, fmt(scene.durationSec)), el('td', {}, scene.assetId || '-')));
    timelineTable.append(el('tr', {}, el('td', { colspan: '2', class: 'meta' }, 'Tổng duration'), el('td', { colspan: '3' }, `${fmt(project.timeline.durationSec)}s`)));
  }

  async function runFull() {
    if (!native) return;
    const projectId = projectSelect.value || `doc_${Date.now().toString(36)}`;
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
    if (!native || !current) return;
    renderInfo.textContent = 'Đang render…';
    try {
      const result = await native.render({ projectId: current.projectId });
      renderInfo.textContent = result && result.ok ? `Rendered: ${result.outputPath || 'OK'}` : 'Render failed';
    } catch (error) { renderInfo.textContent = `Lỗi: ${error.message}`; }
  }

  document.getElementById('btnNew').onclick = () => { projectSelect.value = ''; titleInput.value = ''; narrationArea.value = ''; assetPath.value = ''; current = null; };
  document.getElementById('btnRunFull').onclick = runFull;
  projectSelect.onchange = () => openProject(projectSelect.value);
  unlockBtn.onclick = () => native && current && native.unlock(current.projectId).then(() => openProject(current.projectId));
  renderBtn.onclick = renderVideo;

  if (native) {
    native.onProgress(update => setProgress(update.phase, update.percent));
    native.onJob(update => { jobsList.append(el('li', {}, `${update.key}: ${update.status}${update.error ? ' — ' + update.error : ''}`)); jobsList.scrollTop = jobsList.scrollHeight; });
    refreshProjects();
    safe(() => native.presets(), []).then(list => { presets = list || []; });
    safe(() => native.providers(), null).then(providers => { if (providers) costInfo.append(el('div', { class: 'meta' }, `Providers: ${Object.entries(providers).map(([role, info]) => `${role}=${info.provider || 'fallback'}`).join(', ')}`)); });
  }
})();
