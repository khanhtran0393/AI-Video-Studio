/* ── Tách từ inline <script> trong index.html. Tự sắp xếp DOM panel .tool
   theo thứ tự sidebar (idempotent). Chạy SAU boot.js. ── */

/* ══════ TỰ SẮP XẾP DOM PANEL THEO THỨ TỰ SIDEBAR ══════
 * Thứ tự DOM hiện tại trong HTML không khớp thứ tự sidebar
 * (panel mới dồn lên đầu khi phát triển). Hiển thị vẫn đúng nhờ
 * switchTool() dùng class .active, nhưng DOM gây khó đọc/bảo trì.
 * Script này reorder DOM theo thứ tự sidebar, idempotent + safe. */
(function reorderPanelsBySidebar() {
  try {
    var ORDER = [
      'tooldash','tool1','toolscript','tool2',
      'tool3'  /* gộp vào Tool 2 — nav ẩn */,
      'tool8','tool5'  /* gộp vào Tool 2 — nav ẩn */,
      // 5 khâu sản xuất — sidebar nhóm "Sản xuất video" (dời từ "Công cụ AI" 2026-09-12)
      'toolflow','tool6','tool7','toolupscale','toolvoice',
      'tool4','tool9','tool10',
      // Nhóm "Công cụ AI" — bám sát thứ tự nav trong partials/app-sidebar.html
      // (toolimzic về đúng vị trí sau toollive; toolspy về cuối nhóm — 2026-09-12)
      'toolniche','toolvideoagent','toolviralcut',
      'toollive'  /* Phát Trực Tiếp — Livestream Studio đa nền tảng */,
      'toolimzic','toolwhiteboard','toolhanddraw','toolsrttranslate',
      'toolspy'  /* Spy Storyboard — roadmap P4.4, cuối nhóm "Công cụ AI" */,
      'toolffxaudio','toolffxcut','toolffxjoin','toolffxloop',
      'toolffxcompress','toolffxframes','toolffxmute','toolffxconvert',
      'toolffxmusic','toolffxgif','toolffxaudiofx','toolffxads',
      'toolffxhistory'  /* Công cụ FFmpeg (sidebar dropdown) */,
      'toolsettings','toolskill'  /* Kho skill viết kịch bản (Skill panel, 2026-09-16) */,'tooladmin','toollog',
      'toolanim'  /* mồ côi: mở từ Tool 7, không có nav-item */
    ];
    // Lấy parent chứa các panel .tool (cùng parent với nav-item thường là .content hoặc body)
    var panels = {};
    for (var i = 0; i < ORDER.length; i++) {
      var el = document.getElementById('tool-' + ORDER[i]);
      if (el) panels[ORDER[i]] = el;
    }
    // Tìm parent chung
    var first = null;
    for (var k in panels) { first = panels[k]; break; }
    if (!first || !first.parentNode) { console.warn('[reorder] no parent'); return; }
    var parent = first.parentNode;
    // Idempotency check: nếu đã đúng thứ tự thì skip
    var current = Array.prototype.slice.call(parent.children)
      .filter(function (c) { return c.classList && c.classList.contains('tool'); })
      .map(function (c) { return c.id.replace(/^tool-/, ''); });
    var target = ORDER.filter(function (id) { return panels[id]; });
    var needReorder = current.length !== target.length;
    if (!needReorder) {
      for (var j = 0; j < target.length; j++) {
        if (current[j] !== target[j]) { needReorder = true; break; }
      }
    }
    if (!needReorder) return;
    // Reorder bằng appendChild (idempotent, move node)
    for (var m = 0; m < target.length; m++) {
      parent.appendChild(panels[target[m]]);
    }
    console.log('[reorder] panels reordered to match sidebar order');
  } catch (e) {
    console.warn('[reorder] failed (non-fatal):', e && e.message);
  }
})();
