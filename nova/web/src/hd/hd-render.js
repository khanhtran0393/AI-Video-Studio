/* hd-render.js — RENDER UI: renderSceneList (danh sách cảnh), renderSceneDetail
 * (chi tiết cảnh đang chọn) và renderElementsTable (bảng phần tử).
 * Tách từ handdraw-studio-panel.js (1393 dòng) theo mô hình src/va: mỗi file là 1
 * IIFE góp tên vào context chung window.hdPanelCtx (renderer không build step —
 * AGENTS.md §4/§8). Thứ tự nạp trong index.html = ngữ nghĩa: hd-core → hd-scenes →
 * hd-canvas → hd-ai-export → hd-render → hd-main. Thân hàm giữ NGUYÊN VĂN từ bản
 * trước khi tách; tên của module nạp SAU gọi qua C.<tên> (late-bound), tên module
 * nạp TRƯỚC được destructure từ C. KHÔNG import/export. */

'use strict';

(function () {
  const C = window.hdPanelCtx;
  const {
    A,
    sec,
    els,
    state,
    hide,
    replaceImage,
    moveScene,
    removeScene,
    moveElement,
    removeElement,
    elementEdited,
    pvLoad,
    syncButtons,
  } = C;

  /* ════════ RENDER UI ════════ */

  function renderSceneList() {
    const box = els.sceneList;
    if (!box) return;
    box.textContent = '';
    const total = state.scenes.reduce((t, s) => t + s.durationMs, 0);
    state.scenes.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'wb-item' + (i === state.selected ? ' selected' : '');
      row.dataset.index = String(i);
      const head = document.createElement('div');
      head.className = 'wb-item-head';
      const meta = document.createElement('span');
      meta.textContent = '#' + (i + 1) + ' · ' + sec(s.durationMs) + ' · ' + (s.image ? s.image.split(/[\\/]/).pop().slice(0, 48) : '—');
      meta.style.fontWeight = '600';
      const mark = document.createElement('span');
      mark.textContent = s.elements && s.elements.length ? '✏️' : '⚠ chưa có phần tử';
      mark.style.cssText = 'margin-left:8px;font-size:12px';
      head.appendChild(meta); head.appendChild(mark);
      row.appendChild(head);
      const actions = document.createElement('div');
      actions.className = 'wb-item-actions';
      const mkBtn = (txt, fn) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        return b;
      };
      actions.appendChild(mkBtn('▲', () => moveScene(i, -1)));
      actions.appendChild(mkBtn('▼', () => moveScene(i, 1)));
      actions.appendChild(mkBtn(s.image ? '🔄 đổi ảnh' : '🖼 chọn ảnh', () => replaceImage(i)));
      actions.appendChild(mkBtn('✕ xoá', () => removeScene(i)));
      row.appendChild(actions);
      row.addEventListener('click', () => { state.selected = i; renderSceneList(); renderSceneDetail(); });
      box.appendChild(row);
    });
    if (els.hdTotal) els.hdTotal.textContent = total ? ('tổng ' + sec(total)) : '';
    syncButtons();   // thêm/xoá/đổi ảnh → cập nhật trạng thái nút Xuất MP4
  }

  function renderSceneDetail() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    els.sceneImageLabel.textContent = s && s.image ? s.image.split(/[\\/]/).pop() : '—';
    els.sceneCanvasLabel.textContent = s && s.canvas ? s.canvas.width + '×' + s.canvas.height : '—';
    if (els.durationInput) {
      els.durationInput.value = s ? (s.durationMs / 1000).toFixed(1) : '';
      els.durationInput.disabled = !s;
    }
    els.genElementsBtn.disabled = !(s && s.image && s.canvas);
    if (els.aiElementsBtn) els.aiElementsBtn.disabled = !(s && s.image && s.canvas);
    if (els.reschedBtn) els.reschedBtn.disabled = !(s && s.elements && s.elements.length);
    pvLoad(s);
    renderElementsTable(s);
  }

  function renderElementsTable(s) {
    const body = els.elementsBody;
    if (!body) return;
    body.textContent = '';
    if (!s || !s.elements || !s.elements.length) {
      if (els.elementsTable) els.elementsTable.classList.add('wb-hide');
      return;
    }
    if (els.elementsTable) els.elementsTable.classList.remove('wb-hide');
    const optionsHtml = (arr, cur) => arr.map((d) => '<option value="' + d + '"' + (d === cur ? ' selected' : '') + '>' + d + '</option>').join('');
    s.elements.forEach((e, i) => {
      const tr = document.createElement('tr');
      const html =
        '<td class="wb-seq">' + e.sequence + '</td>' +
        '<td><input type="text" class="wb-label-in" value="' + (e.label || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-k="label"></td>' +
        '<td><input type="number" min="0" step="0.1" class="wb-num-in" value="' + ((e.reveal.startMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="start"></td>' +
        '<td><input type="number" min="0.1" step="0.1" class="wb-num-in" value="' + ((e.reveal.durationMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="dur"></td>' +
        '<td><select class="wb-dir-in" data-i="' + i + '" data-k="dir">' + optionsHtml(A.REVEAL_DIRECTIONS, e.reveal.direction) + '</select></td>' +
        '<td class="wb-act">' +
          '<button data-act="up" data-i="' + i + '">▲</button>' +
          '<button data-act="down" data-i="' + i + '">▼</button>' +
          '<button data-act="del" data-i="' + i + '">✕</button>' +
        '</td>';
      tr.innerHTML = html;
      body.appendChild(tr);
    });
    body.querySelectorAll('input,select').forEach((input) => {
      input.addEventListener('change', () => {
        const i = parseInt(input.dataset.i, 10);
        const e = s.elements[i];
        const k = input.dataset.k;
        if (k === 'label') e.label = input.value.slice(0, 80);
        else if (k === 'start') e.reveal.startMs = Math.max(0, Math.round(parseFloat(input.value) * 1000) || 0);
        else if (k === 'dur') e.reveal.durationMs = Math.max(100, Math.round(parseFloat(input.value) * 1000) || 100);
        else if (k === 'dir') e.reveal.direction = input.value;
        elementEdited();
      });
    });
    body.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i, 10);
        if (b.dataset.act === 'up') moveElement(i, -1);
        else if (b.dataset.act === 'down') moveElement(i, 1);
        else removeElement(i);
      });
    });
  }

  /* ── đăng ký vào context dùng chung ── */
  C.renderSceneList = renderSceneList;
  C.renderSceneDetail = renderSceneDetail;
  C.renderElementsTable = renderElementsTable;
})();
