'use strict';

/* va-easy-ui.js — chế độ DỄ: dựng giao diện wizard 4 bước (Bước 1 nhận
 * nguyên liệu qua checklist import, Bước 2 ảnh, Bước 3 luồng tạo video,
 * Bước 4 kết quả) + đồng bộ sẵn sàng. Tách từ video-agent-panel.js.
 * Nạp SAU va-core.js (destructure window.vaPanelCtx), TRƯỚC va-easy-flow.js
 * (tham chiếu hàm logic chạy qua C.<tên> — muộn-bound lúc user bấm). */
(function () {
  const C = window.vaPanelCtx;
  const { el, esc, fmt, state, ui, notice, appGlobals, stepCard, setStepState, syncFlowCards } = C;

  /* ✍️ Dán tay: mở/đóng ô textarea kịch bản thủ công (wrap ẩn mặc định). */
  let easyPasteOpen = false;
  /* ════════ NHẬN DỮ LIỆU TỪ TOOL KHÁC TRONG APP ════════
     Đọc (không ghi) các binding toàn cục của index.html:
     state.script / state.scenes (Tạo Kịch Bản · Phân Cảnh),
     t9State.result.titles (YouTube SEO), _giongSu (Giọng nói —
     bản trong phiên), state.characterImages (Prompt Nhân vật &
     Bối cảnh), state.sceneImages (ảnh cảnh đã tạo từ prompt). */
  function buildImportBox() {
    /* Checklist nguyên liệu LUÔN MỞ (không còn <details>): mỗi dòng 1 nút
       "Nhận", dấu ✓ khi đã nhận vào Agent, badge x/5 + dòng đủ/thiếu. */
    ui.importBox = el('div', { class: 'va-import' });
    ui.importSumBadge = el('span', { class: 'va-import-badge' }, '0/5');
    ui.importReady = el('div', { class: 'va-import-ready' }, '');
    ui.importBox.append(
      el('div', { class: 'va-import-sum' },
        el('span', { class: 'va-import-sum-ic' }, '🧺'),
        el('span', { class: 'va-import-sum-t' },
          el('b', {}, 'Checklist nguyên liệu'),
          el('span', { class: 'va-import-sum-s' }, 'Kịch bản · Giọng đọc · Ảnh nhân vật · Ảnh cảnh · Tiêu đề')),
        ui.importSumBadge),
      ui.importReady);
    ui.importBody = el('div', { class: 'va-src-grid' });
    ui.importBox.append(ui.importBody);
    return ui.importBox;
  }

  /** Vẽ lại danh sách nguồn: chỉ hiện nút "Dùng" khi tool gốc có dữ liệu. */
  function renderImportBox() {
    if (!ui.importBody) return;
    ui.importBody.innerHTML = '';
    const g = appGlobals();
    const st = g.state || {};

    const scriptText = String(st.script || '').trim();
    const sceneTexts = (Array.isArray(st.scenes) ? st.scenes : [])
      .map((s) => s && s.text).filter(Boolean);
    const narr = String((ui.narrationArea && ui.narrationArea.value) || '').trim();
    const srcReady = scriptText ? 'sẵn: kịch bản từ tool Tạo Kịch Bản'
      : sceneTexts.length ? 'sẵn: ' + sceneTexts.length + ' cảnh từ tool Phân Cảnh' : '';
    const scriptRow = importRow('📝', 'Kịch bản (Tạo Kịch Bản · Phân Cảnh) — BẮT BUỘC',
      narr ? 'đã nhận — ' + narr.length + ' ký tự · mỗi đoạn cách dòng = 1 cảnh'
        : (srcReady || 'chưa có — mở tool Tạo Kịch Bản / Phân Cảnh'),
      (scriptText || sceneTexts.length) ? () => {
        ui.narrationArea.value = scriptText || sceneTexts.join('\n\n');
        syncEasyReady();
        renderImportBox();
        notice('Đã nhận kịch bản — Agent sẽ chia cảnh theo từng đoạn (TTS làm đồng hồ).', 'ok');
      } : null, !!narr);
    /* ✍️ Dán tay: fallback cho ai chưa chạy tool phía trên */
    const pasteBtn = el('button', { class: 'va-btn ghost va-src-btn', title: 'Mở ô dán kịch bản thủ công' }, '✍️ Dán tay');
    pasteBtn.addEventListener('click', () => {
      easyPasteOpen = !easyPasteOpen;
      if (ui.pasteWrap) ui.pasteWrap.classList.toggle('va-hide', !easyPasteOpen);
    });
    scriptRow.append(pasteBtn);
    ui.importBody.append(scriptRow);

    let seoTitle = '';
    try {
      seoTitle = String(((g.seo && g.seo.result && g.seo.result.titles) || [])[0] || '').trim();
    } catch (_) { seoTitle = ''; }
    if (!seoTitle) {
      const t9 = document.getElementById('t9Title');
      if (t9) seoTitle = String(t9.value || '').trim();
    }
    ui.importBody.append(importRow('🏷', 'Tiêu đề (tool YouTube SEO)',
      seoTitle ? seoTitle : 'chưa có — mở tool YouTube SEO trước',
      seoTitle ? () => {
        C.easyTitle = seoTitle;
        notice('Đã nhận tiêu đề phim từ tool YouTube SEO — sẽ dùng đặt tên video khi chạy.', 'ok');
      } : null));

    appendVoiceImport(g.voices);

    const charImgs = [];
    const ci = st.characterImages || {};
    for (const name of Object.keys(ci)) {
      const img = ci[name];
      if (img && img.base64) {
        charImgs.push({ name, base64: img.base64, mediaType: img.mediaType || 'image/png', fileName: img.fileName });
      }
    }
    ui.importBody.append(importRow('🖼', 'Ảnh nhân vật (tool Prompt Nhân vật & Bối cảnh)',
      charImgs.length ? charImgs.length + ' ảnh' : 'chưa có — mở tool Prompt Nhân vật & Bối cảnh trước',
      charImgs.length ? () => {
        state.importedImages = charImgs.map((c) => ({ ...c }));
        notice('Đã nhận ' + charImgs.length + ' ảnh nhân vật — sẽ ghi vào images/ khi chạy pipeline đầy đủ (Bước 3).', 'ok');
        renderImportBox();
      } : null));

    /* Ảnh cảnh đã tạo từ prompt (tool Phân Cảnh) — Agent chỉ nhận ảnh
       sẵn có, không tự sinh: ghép vào images/ rồi tự xếp theo timeline. */
    const sceneImgs = [];
    const si = st.sceneImages || {};
    for (const sid of Object.keys(si)) {
      const img = si[sid];
      if (img && img.base64) {
        sceneImgs.push({ name: 'canh-' + sid, base64: img.base64, mediaType: img.mediaType || 'image/png', fileName: img.fileName || ('canh-' + sid + '.png') });
      }
    }
    ui.importBody.append(importRow('🖼', 'Ảnh cảnh đã tạo (tool Phân Cảnh · Prompt ảnh)',
      sceneImgs.length ? sceneImgs.length + ' ảnh' : 'chưa có — tạo ảnh ở tab Prompt ảnh trước',
      sceneImgs.length ? () => {
        state.importedImages = state.importedImages.concat(sceneImgs.map((c) => ({ ...c })));
        notice('Đã nhận ' + sceneImgs.length + ' ảnh cảnh — Agent sẽ ghi vào images/ và tự xếp đúng timeline giọng đọc.', 'ok');
        renderImportBox();
      } : null));

    /* chip giọng đọc / ảnh nhân vật panel đang giữ */
    if (state.importedVoice) {
      ui.importBody.append(el('div', { class: 'va-chips' },
        el('span', { class: 'va-chip', title: state.importedVoice.ten },
          '🎧 ' + state.importedVoice.ten + ' · ' + fmt(state.importedVoice.giay) + ' giây',
          el('button', { onclick: () => { state.importedVoice = null; renderImportBox(); }, title: 'Bỏ giọng đọc này' }, '✕'))));
    }
    if (state.importedImages.length) {
      const chips = el('div', { class: 'va-chips' });
      state.importedImages.forEach((img, i) => {
        chips.append(el('span', { class: 'va-chip', title: img.fileName || img.name },
          '🖼 ' + img.name,
          el('button', { onclick: () => { state.importedImages.splice(i, 1); renderImportBox(); }, title: 'Bỏ ảnh này' }, '✕')));
      });
      ui.importBody.append(chips);
    }

    /* badge trên summary: số nguồn sẵn sàng nhận ngay */
    if (ui.importSumBadge && ui.importBody) {
      const kids = Array.prototype.slice.call(ui.importBody.children || []);
      const ok = kids.filter((c) => String(c.className || '').split(' ').indexOf('ok') >= 0).length;
      ui.importSumBadge.textContent = String(ok);
    }
    ui.importBody.append(el('div', { class: 'va-hint' },
      '💡 Dữ liệu chỉ được đọc từ tool gốc — không thay đổi gì ở tool đó. Giọng đọc & ảnh nhân vật chỉ được dùng ở luồng "Pipeline đầy đủ" (Bước 3).'));
  }

  /** 1 thẻ nguồn dữ liệu (card): icon · tên · tình trạng · nút "Nhận"/"Dùng".
      done=true → đã nhận vào Agent (icon ✓, class ok); onUse → nút nhận;
      không có dữ liệu cũng chưa nhận → class .bad. */
  function importRow(icon, label, desc, onUse, done) {
    const card = el('div', { class: 'va-src' + (done || onUse ? ' ok' : ' bad') });
    card.append(
      el('span', { class: 'va-src-ic' }, done ? '✓' : icon),
      el('div', { class: 'va-src-info' },
        el('div', { class: 'va-src-name' }, label),
        el('div', { class: 'va-src-desc' }, desc)),
    );
    if (onUse) {
      const btn = el('button', { class: 'va-btn va-src-btn' }, done ? 'Nhận lại' : 'Nhận');
      btn.addEventListener('click', onUse);
      card.append(btn);
    } else if (done) {
      card.append(el('span', { class: 'va-src-check' }, '✓'));
    }
    return card;
  }

  /** Giọng đọc: thẻ nguồn riêng (wide) — select các bản trong phiên + nút "Nhận". */
  function appendVoiceImport(voices) {
    const list = Array.isArray(voices) ? voices : [];
    const done = !!state.importedVoice;
    if (!list.length) {
      ui.importBody.append(importRow('🎧', 'Giọng đọc đã tạo (tool Giọng nói)',
        done ? 'đã nhận: ' + state.importedVoice.ten + ' · ' + fmt(state.importedVoice.giay) + ' giây'
          : 'chưa có bản nào trong phiên này',
        null, done));
      return;
    }
    const sel = el('select', { class: 'va-field', style: 'width:auto;min-width:0;flex:1' });
    list.forEach((h, i) => {
      sel.append(el('option', { value: String(i) }, (h.ten || 'bản ghi') + ' · ' + fmt(h.giay) + ' giây'));
    });
    const useBtn = el('button', { class: 'va-btn va-src-btn', style: 'padding:6px 16px' }, done ? 'Nhận lại' : 'Nhận');
    useBtn.addEventListener('click', () => {
      const h = list[Number(sel.value)] || list[0];
      if (!h || !h.blob) { notice('Bản giọng đọc này thiếu dữ liệu audio — hãy tạo lại ở tool Giọng nói.'); return; }
      state.importedVoice = {
        blob: h.blob,
        ten: h.ten || 'bản giọng đọc',
        giay: h.giay || 0,
        khi: h.khi || Date.now(),
        ext: /(mpeg|mp3)/.test(String(h.blob.type || '')) ? 'mp3' : 'wav',
      };
      /* nhận được giọng đọc → bật pipeline đầy đủ (người dùng bấm thẻ Nhanh để bỏ) */
      if (ui.fullPipelineChk) ui.fullPipelineChk.checked = true;
      if (ui.autoRenderChk) ui.autoRenderChk.disabled = true;
      syncFlowCards();
      renderImportBox();
      notice('Đã nhận giọng đọc — đã chuyển sang luồng "Pipeline đầy đủ" ở Bước 3 (bấm thẻ Nhanh nếu muốn luồng nhẹ).', 'ok');
    });
    const card = el('div', { class: 'va-src' + (done ? ' ok' : ' bad') + ' wide' });
    card.append(
      el('span', { class: 'va-src-ic' }, done ? '✓' : '🎧'),
      el('div', { class: 'va-src-info' },
        el('div', { class: 'va-src-name' }, 'Giọng đọc đã tạo (tool Giọng nói)'),
        el('div', { class: 'va-voice-pick' }, sel, useBtn)));
    if (done) card.append(el('span', { class: 'va-src-check' }, '✓'));
    ui.importBody.append(card);
  }

  /* ════════ CHẾ ĐỘ DỄ ════════ */
  const RAIL_LABELS = ['Nguyên liệu', 'Ảnh', 'Tạo video', 'Xem video'];
  function buildEasy(box) {
    /* ── banner chế độ Dễ + thanh tiến trình 4 bước (va-rail) ── */
    const hero = el('div', { class: 'va-hero' },
      el('div', { class: 'va-hero-in' },
        el('span', { class: 'va-hero-badge' }, '🎬 NOVA VIDEO AGENT'),
        el('h2', { class: 'va-hero-title' }, 'Lắp ráp video faceless trong 4 bước'),
        el('p', { class: 'va-hero-sub' },
          'Nhận kịch bản, giọng đọc (TTS), ảnh nhân vật & ảnh đã tạo từ prompt ở các tool phía trên — Agent tự chia cảnh theo timeline giọng đọc, xếp ảnh đúng từng câu, rồi render MP4.'),
        el('div', { class: 'va-hero-chips' },
          el('span', { class: 'va-hero-chip' }, '📝 Kịch bản đã có'),
          el('span', { class: 'va-hero-chip' }, '🎙 Giọng đọc TTS làm đồng hồ'),
          el('span', { class: 'va-hero-chip' }, '🖼 Ảnh đã tạo từ prompt'),
          el('span', { class: 'va-hero-chip' }, '⚙ Pipeline 17 bước (tuỳ chọn)'))));
    const rail = el('div', { class: 'va-rail' });
    ui.rail = RAIL_LABELS.map((lbl, i) => {
      const dot = el('span', { class: 'va-rail-dot' }, String(i + 1));
      const node = el('div', { class: 'va-rail-node' }, dot, el('span', { class: 'va-rail-lbl' }, lbl));
      rail.append(node);
      return { node, dot };
    });
    const steps = el('div', { class: 'va-steps' });

    /* ── BƯỚC 1 · Nhận nguyên liệu từ các tool phía trên ── */
    const s1 = stepCard(1, 'Nhận nguyên liệu', 'Nhận kịch bản, giọng đọc, ảnh từ các tool phía trên — hoặc dán kịch bản bên dưới. Mỗi đoạn cách nhau bằng một dòng trống sẽ thành 1 cảnh phim.');
    ui.step1 = s1;
    ui.narrationArea = el('textarea', { class: 'va-field', id: 'vaNarration', placeholder: 'Dán kịch bản (narration) tại đây nếu chưa nhận từ tool phía trên…\n\nĐoạn 1 sẽ là cảnh mở màn.\n\nĐoạn 2 là cảnh tiếp theo.' });
    ui.narrationArea.addEventListener('input', syncEasyReady);
    const sampleBtn = el('button', { class: 'va-btn ghost', onclick: C.fillSample }, '✨ Điền ví dụ mẫu');
    ui.projectSelect = el('select', { class: 'va-field', id: 'vaProjectSelect' });
    ui.projectSelect.append(el('option', { value: '' }, '— Mở dự án đã có (nếu có) —'));
    ui.projectSelect.addEventListener('change', () => { if (ui.projectSelect.value) C.openEasyProject(ui.projectSelect.value); });
    s1.body.append(
      el('div', {}, el('div', { class: 'va-lbl' }, 'Kịch bản / lời thoại (narration)'), ui.narrationArea),
      el('div', { class: 'va-row' }, sampleBtn),
      el('div', { class: 'va-hint' }, '💡 Mẹo: 1 đoạn ngắn 1–2 câu = 1 cảnh đẹp. Agent chia timeline theo từng câu của giọng đọc (TTS là master clock).'),
      el('div', { class: 'va-hint' }, '📂 Dự án đã lưu trước đó:'),
      ui.projectSelect,
      buildImportBox(),
    );

    /* ── BƯỚC 2 · Thêm ảnh ── */
    const s2 = stepCard(2, 'Thêm ảnh cho video', 'Tuỳ chọn — ảnh nhân vật & ảnh cảnh nhận ở Bước 1 là đủ; chọn thêm ảnh từ máy nếu muốn.');
    ui.step2 = s2;
    const pickBtn = el('button', { class: 'va-btn', onclick: C.pickAsset }, '📁 Chọn ảnh…');
    ui.chipsBox = el('div', { class: 'va-chips', id: 'vaChips' });
    s2.body.append(
      el('div', { class: 'va-row' }, pickBtn),
      ui.chipsBox,
      el('div', { class: 'va-hint' }, '💡 Agent sẽ tự ghép mỗi ảnh vào cảnh khớp nội dung theo timeline giọng đọc. Có thể chọn nhiều lần.'),
    );

    /* ── BƯỚC 3 · Tạo video ── */
    const s3 = stepCard(3, 'Tạo video', 'Agent chia cảnh theo timeline giọng đọc, xếp ảnh từng câu, rồi render MP4 — chỉ cần bấm 1 nút.');
    ui.step3 = s3;
    ui.autoRenderChk = el('input', { type: 'checkbox', checked: 'checked' });
    ui.fullPipelineChk = el('input', { type: 'checkbox' });
    ui.fullPipelineChk.addEventListener('change', () => {
      /* pipeline §25 luôn render MP4 hoàn chỉnh → khoá tuỳ chọn render riêng */
      if (ui.autoRenderChk) ui.autoRenderChk.disabled = !!(ui.fullPipelineChk && ui.fullPipelineChk.checked);
      syncFlowCards();
    });
    ui.runBtn = el('button', { class: 'va-btn primary big va-cta', id: 'vaRunBtn', onclick: C.runEasy }, '🎬 Tạo video của tôi');
    ui.easyProgFill = el('div', { class: 'va-prog-fill', id: 'vaProgressFill' });
    ui.easyProgLabel = el('span', { class: 'va-hint', id: 'vaProgressLabel' }, 'Chưa chạy.');
    ui.easyLog = el('div', { class: 'va-log', id: 'vaLog', style: 'display:none' });
    /* 2 thẻ luồng: thẻ Pipeline là label ô checkbox (bấm là tick), thẻ Nhanh
       là div tự tắt pipeline. Trạng thái .on chỉ để CSS highlight. */
    const selectFastFlow = () => {
      if (ui.fullPipelineChk && ui.fullPipelineChk.checked) {
        ui.fullPipelineChk.checked = false;
        if (ui.autoRenderChk) ui.autoRenderChk.disabled = false;
        syncFlowCards();
      }
    };
    ui.flowFull = el('label', { class: 'va-flow' }, ui.fullPipelineChk,
      el('div', { class: 'va-flow-ic' }, '⚙'),
      el('div', { class: 'va-flow-t' },
        el('b', {}, 'Pipeline đầy đủ 17 bước'),
        el('span', {}, 'Dùng giọng đọc & ảnh nhân vật đã nhận — render MP4 hoàn chỉnh, QA từng cảnh.')),
      el('span', { class: 'va-flow-check' }, '✓'));
    ui.flowFast = el('div', { class: 'va-flow on', role: 'button', tabindex: '0',
      onclick: selectFastFlow,
      onkeydown: (ev) => { if (ev && (ev.key === 'Enter' || ev.key === ' ')) selectFastFlow(); } },
      el('div', { class: 'va-flow-ic' }, '⚡'),
      el('div', { class: 'va-flow-t' },
        el('b', {}, 'Nhanh (mặc định)'),
        el('span', {}, 'Engine documentary dựng ngay — không cần giọng đọc hay thư mục dự án.')),
      el('span', { class: 'va-flow-check' }, '✓'));
    s3.body.append(
      el('div', { class: 'va-lbl' }, 'Chọn luồng tạo video'),
      el('div', { class: 'va-flow-grp' }, ui.flowFast, ui.flowFull),
      el('div', { class: 'va-hint' }, '💡 Nhận giọng đọc ở Bước 1 sẽ tự chuyển sang luồng Pipeline đầy đủ.'),
      el('label', { class: 'va-opt' }, ui.autoRenderChk, el('span', {}, 'Tự render MP4 sau khi dựng xong (khuyến nghị — chỉ luồng Nhanh)')),
      el('div', { class: 'va-row' }, ui.runBtn),
      el('div', { class: 'va-prog' }, ui.easyProgFill),
      ui.easyProgLabel,
      ui.easyLog,
    );
    syncFlowCards();

    /* ── BƯỚC 4 · Video của bạn ── */
    const s4 = stepCard(4, 'Video của bạn', 'Sẽ hiện ở đây sau khi Agent chạy xong.');
    ui.step4 = s4;
    ui.resultBox = el('div', { id: 'vaResult' });
    s4.body.append(ui.resultBox);

    steps.append(s1.card, s2.card, s3.card, s4.card);
    box.append(hero, rail, steps);
    setStepState(ui.step1, 'active');
    C.renderChips();
  }

  /** Bật/tắt nút "Tạo video" theo nội dung Bước 1. */
  function syncEasyReady() {
    const ready = !!(ui.narrationArea && ui.narrationArea.value.trim());
    if (ui.runBtn) ui.runBtn.disabled = !ready && !state.running;
    setStepState(ui.step1, ready ? 'done' : 'active');
  }

  /* ── đăng ký ── */
  C.buildImportBox = buildImportBox; C.renderImportBox = renderImportBox;
  C.importRow = importRow; C.appendVoiceImport = appendVoiceImport;
  C.buildEasy = buildEasy; C.syncEasyReady = syncEasyReady;
})();
