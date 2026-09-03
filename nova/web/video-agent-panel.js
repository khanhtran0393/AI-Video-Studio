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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Lỗi hệ thống (bắn từ fs/ffmpeg/Remotion) → tiếng Việt, trả '' nếu không khớp. */
  function sysText(msg) {
    if (/ENOSPC|no space left/i.test(msg)) return 'Ổ đĩa đã đầy — không còn chỗ để ghi file. Hãy dọn bớt dung lượng rồi thử lại.';
    if (/EACCES|EPERM/i.test(msg)) return 'Không có quyền ghi vào thư mục dự án. Hãy chọn thư mục khác (vd Desktop).';
    if (/EROFS/i.test(msg)) return 'Thư mục nằm trên ổ chỉ-đọc. Hãy chọn thư mục khác còn ghi được.';
    if (/ENOENT|no such file/i.test(msg)) return 'Không tìm thấy file/thư mục cần dùng. Kiểm tra lại các file trong dự án.';
    return '';
  }

  /** Mọi lỗi (string/Error/{code,message}) → câu tiếng Việt rõ ràng.
   *  Electron bọc lỗi IPC: "Error invoking remote method 'x': Error: …" → bóc bỏ,
   *  main đã trả message tiếng Việt nên thường chỉ cần làm sạch + fallback an toàn. */
  function errText(x, context) {
    if (x == null) return context ? `${context} thất bại (không rõ nguyên nhân).` : 'Lỗi không xác định.';
    let msg = typeof x === 'string'
      ? x
      : (x.message || (x.error && (x.error.message || x.error)) || x.original || (x.code ? `mã lỗi ${x.code}` : ''));
    msg = String(msg).trim()
      .replace(/^Error invoking remote method '[^']*':\s*/i, '')
      .replace(/^Error:\s*/i, '');
    const sys = sysText(msg);
    if (sys) msg = sys;
    msg = msg.trim();
    if (!msg) msg = 'Lỗi không xác định.';
    return context ? `${context} thất bại: ${msg}` : msg;
  }

  /** Hiển thị lỗi tiếng Việt: banner notice + nhãn tiến độ. */
  function showError(text) {
    setProgress('error', 0);
    if (progressLabel) progressLabel.textContent = `Lỗi: ${text}`;
    if (notice) {
      notice.style.display = 'block';
      notice.innerHTML = `<b>⚠ ${esc(text)}</b>`;
    }
  }

  function hideNotice() {
    if (notice) {
      notice.style.display = 'none';
      notice.textContent = '';
    }
  }

  async function safe(fn, fallback = null) {
    try {
      return await fn();
    } catch (error) {
      return fallback === null ? { error: errText(error) } : fallback;
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
        native.unlock(currentProjectDir)
          .then(() => openProject(currentProjectDir))
          .catch(error => showError(errText(error, 'Mở khóa kịch bản')));
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
    catch (error) { showError(errText(error, 'Tải danh sách dự án')); return; }
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
    let project;
    try { project = await native.get(projectId); }
    catch (error) { showError(errText(error, 'Đọc dự án')); return; }
    if (!project) { showError(`Không tìm thấy dự án "${projectId}".`); return; }

    titleInput.value = project.title || '';
    narrationArea.value = project.narration || '';
    assetPath.value = (project.assets || []).map((a) => `${a.path} | ${a.title || ''}, ${a.tags ? a.tags.join(', ') : ''}`).join('\n');

    if (renderInfo) {
      // Field thật là project.render.status (không phải renderStatus) — trước đây
      // luôn rơi vào 'Chưa render' và ĐÈ 'Pipeline xong/Đã render xong' vừa ghi.
      const rs = project.render && project.render.status;
      renderInfo.textContent = rs === 'complete'
        ? `Đã render xong: ${project.render.outputPath || 'OK'}`
        : rs === 'failed'
          ? 'Render thất bại — xem thông báo lỗi ở trên.'
          : rs === 'ready'
            ? 'Đã sẵn sàng để render video.'
            : (rs ? `Render: ${rs}` : 'Chưa render');
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

    setProgress('starting', 2);
    try {
      // create nằm TRONG try: lỗi tạo dự án (tên trùng, projectId sai, đĩa đầy…)
      // phải hiện ra UI thay vì chết im lặng.
      if (typeof native.create === 'function') {
        await native.create({
          projectId,
          overwrite: true,
          title: titleInput.value || 'Untitled',
          narration: narrationArea.value,
          assets
        });
      }
      const result = await native.runFull({
        projectId,
        input: { lockContent: true, autoFix: true, render: false },
        concurrency: 4
      });
      // Guard shape: pipeline lỗi shape khác phải báo rõ, không crash "Cannot read …".
      const scenes = (result && result.timeline && result.timeline.scenes) || [];
      const qaStatus = (result && result.qa && result.qa.status) || 'not-run';
      await openProject(projectId);
      // Ghi SAU openProject để không bị 'Chưa render/Đã sẵn sàng' đè mất kết quả.
      renderInfo.textContent = `Pipeline xong · ${scenes.length} scene · QA ${qaStatus}`;
      hideNotice();
    } catch (error) {
      showError(errText(error, 'Pipeline'));
    }
  }

  async function renderVideo() {
    if (!native || !currentProjectDir) return;
    renderInfo.textContent = 'Đang render…';
    try {
      const result = await native.render({ projectId: currentProjectDir });
      if (result && result.ok) {
        renderInfo.textContent = `Đã render xong: ${result.outputPath || 'OK'}`;
        hideNotice();
      } else {
        // renderNovaScenes lỗi trả { ok:false, error } (không ném) → vẫn báo rõ.
        const reason = errText(result && (result.error || result), 'Render');
        renderInfo.textContent = `Render thất bại — xem thông báo lỗi ở trên.`;
        showError(reason);
      }
    } catch (error) {
      const reason = errText(error, 'Render');
      renderInfo.textContent = 'Render thất bại — xem thông báo lỗi ở trên.';
      showError(reason);
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
        jobsList.append(el('li', {}, `${update.key}: ${update.status}${update.error ? ' — ' + errText(update.error) : ''}`));
        jobsList.scrollTop = jobsList.scrollHeight;
      });
    }
    if (typeof native.onEvent === 'function') {
      native.onEvent(ev => {
        if (!ev) return;
        if (ev.stage) {
          setProgress(ev.stage, typeof ev.percent === 'number' ? ev.percent : 0);
          if (jobsList) {
            jobsList.append(el('li', {}, `${ev.jobId || '-'}: ${ev.stage}${ev.error ? ' — ' + errText(ev.error) : ''}`));
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

    // Bridge ĐÚNG của panel này là window.native.documentary (create/runFull/
    // render/unlock/presets/providers/onProgress/onJob, xem nova/documentary/
    // ipc.js). Trước đây lấy window.native.videoAgent (API §25: run/status/
    // spec…) → bấm "Chạy pipeline" chết với "native.runFull is not a function".
    // Map tên method panel dùng sang tên kênh documentary: get→read,
    // listProjects→list. Fallback videoAgent cho bản preload cũ (các call đều
    // được guard bằng typeof nên không chết panel).
    const bridge = window.native && (window.native.documentary || window.native.videoAgent);
    native = bridge ? {
      create: bridge.create,
      runFull: bridge.runFull,
      run: bridge.run,
      render: bridge.render,
      unlock: bridge.unlock,
      presets: bridge.presets,
      providers: bridge.providers,
      get: (id) => (typeof bridge.read === 'function' ? bridge.read(id) : undefined),
      listProjects: () => (typeof bridge.list === 'function' ? bridge.list() : undefined),
      onProgress: bridge.onProgress,
      onJob: bridge.onJob,
      onEvent: bridge.onEvent,
    } : null;
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