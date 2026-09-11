/* ── Tách từ inline <script> trong index.html. Sidebar: bấm tiêu đề nhóm để
   thu/mở danh sách tool, nhớ trạng thái qua localStorage (navCollapsed). ── */

/* Sidebar: bấm tiêu đề nhóm (Chuẩn bị kênh, Sản xuất cảnh…) để THU/MỞ danh sách tool → gọn. Nhớ trạng thái. */
(function navAccordion(){
  function setup(){
    var groups = document.querySelectorAll('.nav-group');
    if (!groups.length) return;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('navCollapsed') || '{}'); } catch (e) {}
    groups.forEach(function(g){
      if (g.dataset.acc) return; g.dataset.acc = '1';
      var key = g.textContent.trim(); g.dataset.key = key;
      g.style.cursor = 'pointer'; g.style.userSelect = 'none';
      var chev = document.createElement('span');
      chev.className = 'nav-chev';
      chev.style.cssText = 'float:right;opacity:.45;font-size:9px;transition:transform .15s';
      chev.textContent = '▾';
      g.appendChild(chev);
      function apply(collapsed){
        chev.textContent = collapsed ? '▸' : '▾';
        var el = g.nextElementSibling;
        while (el && !el.classList.contains('nav-group')) {
          if (el.classList.contains('nav-item')) el.style.display = collapsed ? 'none' : '';
          el = el.nextElementSibling;
        }
      }
      g.addEventListener('click', function(){
        var collapsed = !g.classList.contains('nav-collapsed');
        g.classList.toggle('nav-collapsed', collapsed);
        apply(collapsed);
        try { var st = JSON.parse(localStorage.getItem('navCollapsed') || '{}'); st[key] = collapsed; localStorage.setItem('navCollapsed', JSON.stringify(st)); } catch (e) {}
      });
      if (saved[key]) { g.classList.add('nav-collapsed'); apply(true); }   // khôi phục trạng thái thu
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
  // Chạy lại sau chút để chắc (sidebar có thể render động).
  setTimeout(setup, 800);
})();
