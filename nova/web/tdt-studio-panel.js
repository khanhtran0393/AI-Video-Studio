'use strict';
/* ============================================================
   STUDIO (TDTStudio PyQt nhúng) — panel renderer
   ------------------------------------------------------------
   Tool "Studio": điều khiển tiến trình TDTStudio (PyQt) chạy
   bằng runtime Python nội bộ qua window.native.tdtStudio
   (IPC tdt-studio:*). Cửa sổ Qt dock đúng vùng #tdtStudioRoot
   Panel này chỉ cung cấp vùng dock; toàn bộ GUI thật nằm trong
   cửa sổ Qt nhúng và được mở thẳng cùng ứng dụng.
   ============================================================ */
(function () {
  const TS = {
    inited: false,
    autoLaunched: false,
    status: null,
    rectTimer: 0,
    preloadReady: false,
    active: false,
  };
  const root = () => document.getElementById('tdtStudioRoot');
  const NATIVE = () => (window.native && window.native.tdtStudio) ? window.native.tdtStudio : null;

  function buildUI(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'ts-wrap';
    wrap.innerHTML = [
      '<div class="ts-controls">',
      '  <div class="ts-status">',
      '    <span class="ts-dot" id="tsDot"></span>',
      '    <span class="ts-label" id="tsLabel">Đang khởi động...</span>',
      '  </div>',
      '  <div class="ts-actions">',
      '    <button class="btn sm ghost" id="tsRestartBtn" title="Khởi động lại Studio">🔄</button>',
      '    <button class="btn sm ghost danger" id="tsStopBtn" title="Dừng Studio">⏹</button>',
      '  </div>',
      '</div>',
      '<div class="ts-native-dock" id="tsNativeDock" aria-label="Vùng Studio nhúng"></div>',
      '<div class="ts-error" id="tsError" role="alert" hidden></div>',
    ].join('');
    const style = document.createElement('style');
    style.textContent = [
      '.ts-wrap{display:flex;flex-direction:column;height:100%;min-height:300px;padding:0;background:var(--bg);}',
      '.ts-controls{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;gap:12px;}',
      '.ts-status{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--text);}',
      '.ts-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0;background:var(--text-dim);transition:background .3s;}',
      '.ts-dot.running{background:var(--green);box-shadow:0 0 8px var(--green);}',
      '.ts-dot.stopped{background:var(--red);box-shadow:0 0 8px var(--red);}',
      '.ts-dot.starting{background:var(--amber);box-shadow:0 0 8px var(--amber);animation:pulse-dot 1s infinite;}',
      '@keyframes pulse-dot{0%,100%{opacity:1;}50%{opacity:.4;}}',
      '.ts-label{color:var(--text-muted);font-weight:400;}',
      '.ts-actions{display:flex;gap:6px;flex-shrink:0;}',
      '.ts-actions .btn{font-size:16px;padding:4px 10px;line-height:1.4;}',
      '.ts-actions .btn.danger:hover{border-color:var(--red);color:var(--red);}',
      '.ts-native-dock{flex:1;min-height:280px;background:var(--bg);overflow:hidden;position:relative;}',
      '.ts-error{position:absolute;z-index:2;left:16px;right:16px;top:16px;padding:10px 14px;border:1px solid var(--red);border-radius:8px;background:color-mix(in srgb,var(--red) 12%,var(--surface));color:var(--red);font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.3);}',
    ].join('');
    container.appendChild(wrap);
    container.appendChild(style);
  }

  function showError(message) {
    const error = document.getElementById('tsError');
    if (!error) return;
    error.textContent = String(message || 'Không thể mở Studio.');
    error.hidden = false;
  }

  function updateStatusUI(status) {
    const dot = document.getElementById('tsDot');
    const label = document.getElementById('tsLabel');
    if (!dot || !label) return;
    const running = status && status.running;
    const ready = status && status.ready;
    const exitCode = status && status.exitCode;
    if (running && ready) {
      dot.className = 'ts-dot running';
      label.textContent = 'Đang chạy';
    } else if (running && !ready) {
      dot.className = 'ts-dot starting';
      label.textContent = 'Đang khởi động...';
    } else if (exitCode !== null && exitCode !== 0) {
      dot.className = 'ts-dot stopped';
      label.textContent = 'Đã dừng (lỗi ' + exitCode + ')';
    } else if (exitCode === 0) {
      dot.className = 'ts-dot stopped';
      label.textContent = 'Đã dừng';
    } else {
      dot.className = 'ts-dot';
      label.textContent = 'Chưa khởi động';
    }
  }

  async function refreshStatus() {
    const nat = NATIVE();
    if (!nat) {
      showError('Studio chưa kết nối được với ứng dụng.');
      return;
    }
    try {
      TS.status = await nat.status();
      updateStatusUI(TS.status);
      const error = document.getElementById('tsError');
      if (error && (!TS.status || !TS.status.exitCode)) error.hidden = true;
      if (TS.status && TS.status.exitCode && TS.status.exitCode !== 0) {
        showError('Studio đã dừng do lỗi (mã ' + TS.status.exitCode + ').');
      }
    } catch (e) {
      showError('Không đọc được trạng thái Studio: ' + ((e && e.message) || e));
    }
  }

  function sendRect() {
    const nat = NATIVE();
    if (!nat) return;
    const el = document.getElementById('tsNativeDock');
    if (!el) return;
    const r = el.getBoundingClientRect();
    // A native WS_CHILD is not clipped by DOM overflow. Clamp it to the visible
    // content viewport, especially above the fixed bottom status bar.
    const statusBar = document.getElementById('statusBar');
    const statusTop = statusBar ? statusBar.getBoundingClientRect().top : window.innerHeight;
    const left = Math.max(0, r.left);
    const top = Math.max(0, r.top);
    const right = Math.min(window.innerWidth, r.right);
    const bottom = Math.min(window.innerHeight, statusTop, r.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (width < 100 || height < 80) {
      nat.hide().catch(() => {});
      return;
    }
    nat.setRect({
      relX: Math.round(left),
      relY: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      // CSS px → physical px trong client area app (hỗ trợ display scale/zoom)
      dpr: window.devicePixelRatio || 1,
    }).catch(() => {});
  }

  function startRectSync() {
    stopRectSync();
    sendRect();
    TS.rectTimer = setInterval(sendRect, 700);
  }
  function stopRectSync() {
    if (TS.rectTimer) { clearInterval(TS.rectTimer); TS.rectTimer = 0; }
  }


  function init(container) {
    const c = container || root();
    if (!c) return;
    TS.active = true;
    if (!TS.inited || c.childElementCount === 0) {
      buildUI(c);
      TS.inited = true;
      const restartBtn = document.getElementById('tsRestartBtn');
      const stopBtn = document.getElementById('tsStopBtn');
      if (restartBtn) restartBtn.addEventListener('click', () => { TS.autoLaunched = false; init(container); });
      if (stopBtn) stopBtn.addEventListener('click', () => { const nat = NATIVE(); if (nat) nat.quit().catch(() => {}); });
      const nat = NATIVE();
      if (nat && typeof nat.onEvent === 'function') {
        nat.onEvent((ev) => {
          if (!ev || !ev.type) return;
          const d = (ev.data && typeof ev.data === 'object') ? ev.data : ev;
          if (ev.type === 'log' && d.level === 'error' && d.line) showError(d.line);
          else if (ev.type === 'ready') { TS.preloadReady = true; refreshStatus(); sendRect(); if (TS.active && NATIVE()) NATIVE().show().catch(() => {}); }
          else if (ev.type === 'preload-ready') { TS.preloadReady = true; refreshStatus(); sendRect(); if (TS.active && NATIVE()) NATIVE().show().catch(() => {}); }
          else if ((ev.type === 'exit' || ev.type === 'exited') && Number(d.code != null ? d.code : d.exitCode) !== 0) {
            showError('Studio đã dừng do lỗi (mã ' + (d.code != null ? d.code : d.exitCode) + ').');
          } else if (ev.type === 'error') { showError(d.message || 'Không thể mở Studio.'); }
          refreshStatus();
        });
      }
      window.addEventListener('resize', () => { if (TS.rectTimer) sendRect(); });
    }
    refreshStatus();
    startRectSync();
    if (!TS.autoLaunched) {
      TS.autoLaunched = true;
      const nat = NATIVE();
      if (nat) {
        nat.status().then((st) => {
          if (st && st.ready) {
            // đã ready, show
            TS.preloadReady = true;
            nat.show().catch(() => {});
            sendRect();
            refreshStatus();
          } else if (st && st.running) {
            // đang khởi động (preload hoặc launch trước) — chờ sự kiện ready/preload-ready
            refreshStatus();
          } else {
            // chưa chạy, launch
            nat.launch()
              .then((r) => { if (r && r.error) showError(r.error); refreshStatus(); setTimeout(sendRect, 1500); })
              .catch((e) => showError((e && e.message) || 'Không thể mở Studio.'));
          }
        }).catch(() => {
          // fallback launch
          nat.launch()
            .then((r) => { if (r && r.error) showError(r.error); refreshStatus(); setTimeout(sendRect, 1500); })
            .catch((e) => showError((e && e.message) || 'Không thể mở Studio.'));
        });
      }
    } else {
      const nat = NATIVE();
      if (nat) nat.status().then((st) => {
        if (st && st.running) { sendRect(); nat.show().catch(() => {}); }
        refreshStatus();
      }).catch(() => {});
    }
  }

  function leave() {
    TS.active = false;
    stopRectSync();
    const nat = NATIVE();
    if (nat) nat.hide().catch(() => {});
  }

  window.TdtStudioPanel = { init, leave, refreshStatus };
})();
