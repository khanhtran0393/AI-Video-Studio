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
  };
  const root = () => document.getElementById('tdtStudioRoot');
  const NATIVE = () => (window.native && window.native.tdtStudio) ? window.native.tdtStudio : null;

  function buildUI(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'ts-wrap';
    wrap.innerHTML = [
      '<div class="ts-native-dock" id="tsNativeDock" aria-label="Vùng Studio nhúng"></div>',
      '<div class="ts-error" id="tsError" role="alert" hidden></div>',
    ].join('');
    const style = document.createElement('style');
    style.textContent = [
      '.ts-wrap{padding:0;display:flex;flex-direction:column;height:100%;min-height:300px}',
      '.ts-native-dock{flex:1;min-height:300px;background:#0b0f17;overflow:hidden}',
      '.ts-error{position:absolute;z-index:2;left:16px;right:16px;top:16px;padding:10px 12px;border:1px solid #fecaca;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:13px}',
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

  async function refreshStatus() {
    const nat = NATIVE();
    if (!nat) {
      showError('Studio chưa kết nối được với ứng dụng.');
      return;
    }
    try {
      TS.status = await nat.status();
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
    if (!TS.inited || c.childElementCount === 0) {
      buildUI(c);
      TS.inited = true;
      const nat = NATIVE();
      if (nat && typeof nat.onEvent === 'function') {
        nat.onEvent((ev) => {
          if (!ev || !ev.type) return;
          // Bridge emits a flat event. Accept the former nested shape too so
          // renderer/main can be upgraded independently.
          const d = (ev.data && typeof ev.data === 'object') ? ev.data : ev;
          if (ev.type === 'log' && d.level === 'error' && d.line) showError(d.line);
          else if (ev.type === 'ready') { refreshStatus(); sendRect(); }
          else if ((ev.type === 'exit' || ev.type === 'exited') && Number(d.code != null ? d.code : d.exitCode) !== 0) {
            showError('Studio đã dừng do lỗi (mã ' + (d.code != null ? d.code : d.exitCode) + ').');
          } else if (ev.type === 'error') { showError(d.message || 'Không thể mở Studio.'); }
        });
      }
      window.addEventListener('resize', () => { if (TS.rectTimer) sendRect(); });
    }
    refreshStatus();
    startRectSync();
    // Lần đầu vào tool: tự khởi động Studio nhúng
    if (!TS.autoLaunched) {
      TS.autoLaunched = true;
      const nat = NATIVE();
      if (nat) {
        nat.launch()
          .then((r) => { if (r && r.error) showError(r.error); refreshStatus(); setTimeout(sendRect, 1500); })
          .catch((e) => showError((e && e.message) || 'Không thể mở Studio.'));
      }
    } else {
      // đã từng chạy: nếu còn sống thì hiện lại và re-dock
      const nat = NATIVE();
      if (nat) nat.status().then((st) => {
        if (st && st.running) { sendRect(); nat.show().catch(() => {}); }
        refreshStatus();
      }).catch(() => {});
    }
  }

  function leave() {
    stopRectSync();
    const nat = NATIVE();
    if (nat) nat.hide().catch(() => {});
  }

  window.TdtStudioPanel = { init, leave, refreshStatus };
})();
