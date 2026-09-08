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
      '<div class="ts-native-dock" id="tsNativeDock" aria-label="Vùng Studio nhúng">',
      '  <div class="ts-skeleton" id="tsSkeleton" aria-hidden="true">',
      '    <div class="ts-skel-logo"></div>',
      '    <div class="ts-skel-bar w70"></div>',
      '    <div class="ts-skel-bar w40"></div>',
      '    <div class="ts-skel-bar w85"></div>',
      '    <div class="ts-skel-hint" id="tsSkelHint">Đang nạp Studio lần đầu — lần sau sẽ tức thì…</div>',
      '  </div>',
      '</div>',
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
      /* Skeleton chờ Qt ready — tránh cảm giác "đơ" khi lần đầu khởi động */
      '.ts-skeleton{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:linear-gradient(180deg,var(--bg) 0%,var(--surface) 100%);animation:ts-fade-in .25s ease;}',
      '.ts-skeleton.hidden{display:none;}',
      '.ts-skel-logo{width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,var(--accent) 0%,color-mix(in srgb,var(--accent) 50%,var(--bg)) 100%);opacity:.55;animation:pulse-dot 1.6s ease-in-out infinite;box-shadow:0 4px 18px color-mix(in srgb,var(--accent) 25%,transparent);}',
      '.ts-skel-bar{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--surface) 0%,color-mix(in srgb,var(--text-dim) 30%,var(--surface)) 50%,var(--surface) 100%);background-size:200% 100%;animation:ts-skel-shimmer 1.4s ease-in-out infinite;}',
      '.ts-skel-bar.w40{width:40%;}',
      '.ts-skel-bar.w70{width:70%;}',
      '.ts-skel-bar.w85{width:85%;}',
      '.ts-skel-hint{font-size:12px;color:var(--text-muted);margin-top:8px;max-width:320px;text-align:center;line-height:1.5;}',
      '@keyframes ts-skel-shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}',
      '@keyframes ts-fade-in{from{opacity:0;}to{opacity:1;}}',
      '.ts-error{position:absolute;z-index:2;left:16px;right:16px;top:16px;padding:10px 14px;border:1px solid var(--red);border-radius:8px;background:color-mix(in srgb,var(--red) 12%,var(--surface));color:var(--red);font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.3);}',
    ].join('');
    container.appendChild(wrap);
    container.appendChild(style);
  }

  function hideSkeleton() {
    const sk = document.getElementById('tsSkeleton');
    if (sk) sk.classList.add('hidden');
  }
  function setSkeletonHint(msg) {
    const el = document.getElementById('tsSkelHint');
    if (el) el.textContent = String(msg || '');
  }
  function showSkeleton() {
    const sk = document.getElementById('tsSkeleton');
    if (sk) sk.classList.remove('hidden');
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
      // Qt đã sẵn sàng — ẩn skeleton để lộ vùng dock
      hideSkeleton();
      clearSlowHint();
    } else if (running && !ready) {
      dot.className = 'ts-dot starting';
      label.textContent = 'Đang khởi động...';
      setSkeletonHint('Đang nạp giao diện Studio (lần đầu khoảng vài giây, lần sau tức thì)…');
    } else if (exitCode !== null && exitCode !== 0) {
      dot.className = 'ts-dot stopped';
      label.textContent = 'Đã dừng (lỗi ' + exitCode + ')';
      setSkeletonHint('Studio đã dừng — bấm 🔄 để khởi động lại.');
      clearSlowHint();
    } else if (exitCode === 0) {
      dot.className = 'ts-dot stopped';
      label.textContent = 'Đã dừng';
      setSkeletonHint('Studio đã dừng — bấm 🔄 để khởi động lại.');
      clearSlowHint();
    } else {
      dot.className = 'ts-dot';
      label.textContent = 'Chưa khởi động';
      setSkeletonHint('Studio chưa chạy — đang chuẩn bị môi trường…');
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
    /* Nếu tab Studio đã từng ẩn Qt (leave) trước đó, khi user quay lại tab mà
       Qt chưa ready hoặc process đã thoát → bật lại skeleton để biết đang chờ.
       Nếu Qt đã sẵn sàng (preload thành công) thì chỉ cần show() là gần tức thì. */
    showSkeleton();
    refreshStatus();
    startRectSync();
    armSlowHint();
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
      /* Quay lại tab Studio sau leave: nếu Qt vẫn đang chạy → show ngay
         (gần tức thì, <100ms); nếu đã thoát thì launch lại. */
      const nat = NATIVE();
      if (nat) nat.status().then((st) => {
        if (st && st.ready) {
          // Qt còn sẵn sàng → chỉ cần show, gần như tức thì.
          sendRect();
          nat.show().catch(() => {});
          refreshStatus();
        } else if (st && st.running) {
          // Đang khởi động (do preload chẳng hạn) — chờ event ready.
          refreshStatus();
        } else {
          // Process đã thoát khi user ở tab khác → bật skeleton + launch lại.
          showSkeleton();
          setSkeletonHint('Studio đã dừng lúc bạn ở tab khác — đang khởi động lại…');
          TS.autoLaunched = true; // đánh dấu để status polling tái sử dụng
          nat.launch()
            .then((r) => { if (r && r.error) showError(r.error); refreshStatus(); setTimeout(sendRect, 1500); })
            .catch((e) => showError((e && e.message) || 'Không thể mở Studio.'));
        }
      }).catch(() => {});
    }
  }

  /* Sau 8 giây chờ mà Qt vẫn chưa ready, đổi hint sang "chậm hơn bình thường"
     để user biết tiến trình vẫn đang chạy, không phải treo. Reset khi ready/exit. */
  let _slowHintTimer = 0;
  function armSlowHint() {
    if (_slowHintTimer) clearTimeout(_slowHintTimer);
    _slowHintTimer = setTimeout(() => {
      const dot = document.getElementById('tsDot');
      // chỉ escalate khi vẫn đang 'starting' (chưa ready/stopped)
      if (dot && dot.className.indexOf('starting') !== -1) {
        setSkeletonHint('Lần đầu nạp nặng hơn bình thường — đang nạp xong, vui lòng đợi thêm…');
      }
    }, 8000);
  }
  function clearSlowHint() {
    if (_slowHintTimer) { clearTimeout(_slowHintTimer); _slowHintTimer = 0; }
  }

  function leave() {
    TS.active = false;
    clearSlowHint();
    stopRectSync();
    const nat = NATIVE();
    if (nat) nat.hide().catch(() => {});
  }

  window.TdtStudioPanel = { init, leave, refreshStatus };
})();
