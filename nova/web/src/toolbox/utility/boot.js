/* ── Tách từ inline <script> trong index.html. BOOT: gọi initAppDirect +
   renderDashboard + switchTool(state.tool) SAU KHI mọi toolbox + nguon-web đã nạp.
   Phải luôn là một trong các script CUỐI cùng của index.html. ── */

/* === BOOT: gọi sau khi mọi toolbox + nguon-web đã load === */
(function bootApp(){
  function run(){
    try {
      if (typeof initAppDirect === 'function') initAppDirect();
    } catch (e) { try { console.error('[boot] initAppDirect failed', e); } catch (_) {} }
    try {
      if (typeof renderDashboard === 'function') renderDashboard();
    } catch (e) { try { console.error('[boot] renderDashboard failed', e); } catch (_) {} }
    try {
      // Kích hoạt tool mặc định nếu switchTool có sẵn
      if (typeof switchTool === 'function' && typeof state !== 'undefined' && state && state.tool) {
        try { switchTool(state.tool); } catch (_) {}
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
