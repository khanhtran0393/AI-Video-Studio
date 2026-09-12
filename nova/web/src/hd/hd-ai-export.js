/* hd-ai-export.js — Bước 2b · vùng mẫu AI vision (hdImageDataUrl, aiRegionToElement,
 * generateElementsAI) + Bước 4 · xuất MP4 (exportVideo, setProgress,
 * stopExport, syncButtons).
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
    els,
    state,
    hdFileUrl,
    log,
    pv,
    rescheduleElements,
  } = C;

  /* ════════ BƯỚC 2b · VÙNG MẪU AI (VISION) — AI soi ảnh, tự khoanh vật thể ════════
     Dùng callLLMJson của app (index.html): provider hiện tại (Anthropic/OpenAI/
     Gemini…), ảnh gửi kèm dạng Anthropic image-part → bridge tự chuyển cho từng
     provider. AI trả polygon toạ độ chuẩn hoá 0–1000 → scale về pixel canvas,
     tạo phần tử + phân lại giờ theo tỉ lệ 2/8. */
  async function hdImageDataUrl(imagePath, maxEdge) {
    const resp = await fetch(hdFileUrl(imagePath));
    if (!resp || !resp.ok) throw new Error('không tải được ảnh (HTTP ' + (resp && resp.status) + ')');
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(8, Math.round(bmp.width * sc));
    const h = Math.max(8, Math.round(bmp.height * sc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const du = c.toDataURL('image/jpeg', 0.86);
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(du);
    if (!m) throw new Error('không mã hoá được ảnh base64');
    return { mediaType: m[1], data: m[2] };
  }

  function aiRegionToElement(raw, idx, s) {
    const W = s.canvas.width, H = s.canvas.height;
    const pts = [];
    (raw && Array.isArray(raw.points) ? raw.points : []).forEach((q) => {
      const x = Math.round((Number(q && q[0]) || 0) * W / 1000);
      const y = Math.round((Number(q && q[1]) || 0) * H / 1000);
      if (isFinite(x) && isFinite(y)) pts.push([Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    });
    if (pts.length < 3) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((q) => {
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    });
    return A.normalizeElement({
      id: 'element-' + (idx + 1),
      label: String((raw && raw.label) || ('Vùng AI ' + (idx + 1))).slice(0, 60),
      type: 'illustration',
      region: { x: minX, y: minY, width: Math.max(8, maxX - minX), height: Math.max(8, maxY - minY), points: pts },
      reveal: {
        direction: (maxX - minX) >= (maxY - minY) ? 'left_to_right' : 'top_to_bottom',
        startMs: 0, durationMs: 1000, maskPaddingPx: 16, protectedRegions: [],
      },
      handPath: {
        start: [pts[0][0], pts[0][1]],
        end: [pts[pts.length - 1][0], pts[pts.length - 1][1]],
        easing: 'easeInOut',
      },
    }, idx, s.canvas);
  }

  async function generateElementsAI() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.canvas) { log('⚠ cần ảnh trước khi để AI khoanh vùng'); return; }
    if (typeof callLLMJson !== 'function') {
      log('⚠ chưa có bộ gọi AI (callLLMJson) — chạy panel trong app Nova');
      return;
    }
    const btn = els.aiElementsBtn;
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; btn.textContent = '🤖 AI đang soi ảnh…'; }
    try {
      log('🤖 AI vision đang nhìn: ' + s.image.split(/[\\/]/).pop());
      const img = await hdImageDataUrl(s.image, 896);
      const prompt =
        'You are looking at ONE image that will be redrawn as a hand-drawn animation. ' +
        'Detect the 2–6 most important visual objects/subjects of the image (not the whole image, no tiny details, no text lines). ' +
        'For each object output a closed polygon outlining it. ' +
        'Coordinates are NORMALIZED 0–1000 relative to image width (x, right) and height (y, down). ' +
        'Each polygon: 4–14 points [x, y] as integers, ordered clockwise. ' +
        'Regions must be listed background → foreground (natural drawing order). ' +
        'Return ONLY JSON: {"regions":[{"label":"short object name in Vietnamese","points":[[x,y],...]},...]}';
      const messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { media_type: img.mediaType, data: img.data } },
          { type: 'text', text: prompt },
        ],
      }];
      const out = await callLLMJson(prompt, {
        messages, maxTokens: 1200, tries: 2,
        validate: (o) => {
          if (!o || !Array.isArray(o.regions) || !o.regions.length) throw new Error('AI thiếu mảng regions');
          o.regions.forEach((r, i) => {
            if (!r || !Array.isArray(r.points) || r.points.length < 3) throw new Error('regions[' + i + '] thiếu points');
          });
          return o;
        },
      });
      const built = [];
      out.regions.forEach((r, i) => {
        const el = aiRegionToElement(r, built.length, s);
        if (el) built.push(el);
        else log('⚠ vùng AI ' + (i + 1) + ' points không dùng được — bỏ qua');
      });
      if (!built.length) throw new Error('AI không trả vùng nào dùng được');
      s.elements = built;           // vùng mẫu AI = thay toàn bộ vùng cũ (giống nút chia dải)
      s.previewPath = null;
      // đảm bảo đủ giờ: mỗi vùng 1500ms vẽ + 2/8 nghỉ, cộng lead-in + hold
      const need = A.LEAD_IN_MS + built.length * (1500 + Math.round(1500 * 2 / 8)) + A.HOLD_MS;
      if (need > (s.durationMs || 0)) s.durationMs = need;
      rescheduleElements(s);
      if (els.durationInput) els.durationInput.value = (s.durationMs / 1000).toFixed(1);
      pv.sel = s.elements.length - 1;
      log('✓ AI khoanh ' + s.elements.length + ' vùng: ' + s.elements.map((e) => e.label).join(' · '));
      C.renderSceneList();
      C.renderSceneDetail();
    } catch (err) {
      log('❌ AI vision lỗi: ' + String((err && err.message) || err));
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
    }
  }

  /* ════════ BƯỚC 4 · RENDER → MERGE → MP4 (không tiếng) ════════ */

  async function exportVideo(outPath) {
    if (!state.scenes.length) { log('⚠ chưa có ảnh nào'); return; }
    if (!window.native || !window.native.whiteboard || typeof window.native.whiteboard.export !== 'function') {
      log('❌ không thấy bridge app (window.native.whiteboard) — chỉ xuất được trong app Nova desktop, không phải tab trình duyệt. Nếu đang trong app: bấm Ctrl+F5 tải lại JS mới.');
      return;
    }
    for (let i = 0; i < state.scenes.length; i++) {
      const s = state.scenes[i];
      const ann = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, elements: s.elements || [] }, s.canvas);
      const v = A.validateAnnotation(ann);
      if (!v.ok) { log('❌ ảnh #' + (i + 1) + ': ' + v.errors.join('; ')); state.selected = i; C.renderSceneList(); C.renderSceneDetail(); return; }
    }
    let out;
    if (typeof outPath === 'string' && outPath) {
      out = { path: outPath };                 // API path: bỏ qua dialog
    } else {
      // contract preload: pickOutput(defaultName: string) — KHÔNG truyền object
      out = await window.native.whiteboard.pickOutput('handdraw_animation.mp4');
      if (!out) return;                                   // bridge trả undefined bất thường
      if (out.ok === false) { log('❌ chọn nơi lưu lỗi: ' + (out.error || 'không rõ')); return; }
      if (out.canceled || !out.path) return;              // người dùng huỷ dialog
    }
    const payload = {
      scenes: state.scenes.map((s) => ({
        sceneId: s.sceneId, image: s.image, durationMs: s.durationMs,
        canvas: s.canvas, elements: s.elements,
      })),
      audioTracks: [],           // vẽ tay thuần — không ghép tiếng
      outputPath: out.path,
      options: {
        inkPath: state.brush.inkPath,
        colorFill: state.brush.colorFill,
        tipMode: state.brush.tipMode,          // hand | pen | none → py-backend map sang --bare-tip / hand=''
        brushRadius: state.brush.brushRadius,
        capLongEdge: state.brush.capLongEdge,
      },
    };
    state.exporting = true;
    syncButtons();
    setProgress(0, 'khởi động…');
    log('▶ vẽ tay ' + payload.scenes.length + ' ảnh → ' + out.path +
        ' (bút: ' + state.brush.tipMode + ' · nét: ' + state.brush.inkPath + ' · tô: ' + state.brush.colorFill + ')');
    /* watchdog: 15s không có event nào từ main → cảnh báo THẲNG vào label
       (không chỉ Log, interval 5s) — phân biệt "engine bận nhưng vẫn chảy"
       (event 2-3/s từ py-backend) với "luồng tiến trình chết/treo" */
    C.lastProgressAt = Date.now();
    const watchdog = setInterval(() => {
      if (!state.exporting) { clearInterval(watchdog); return; }
      const idleMs = Date.now() - C.lastProgressAt;
      if (idleMs > 15000) {
        const warn = '⚠ ' + Math.round(idleMs / 1000) + 's không nhận tiến trình — luồng có thể treo; nếu chắc chắn treo: bấm Dừng rồi thử lại';
        if (els.progressMsg) els.progressMsg.textContent = warn;
        log('⏳ ' + warn);
      }
    }, 5000);
    let r;
    try {
      r = await window.native.whiteboard.export(payload);
    } catch (err) {
      r = { ok: false, error: String((err && err.message) || err) };
    }
    clearInterval(watchdog);
    try {
      state.exporting = false;
      syncButtons();
      if (!r || typeof r !== 'object') {
        setProgress(0, 'lỗi');
        log('❌ export trả kết quả bất thường (' + JSON.stringify(r) + ') — bridge main↔renderer lỗi, thử Ctrl+F5 rồi xuất lại.');
        return;
      }
      if (r.ok) {
        setProgress(100, 'xong');
        log('✓ hoàn tất: ' + r.path + (r.durationSec ? ' (' + r.durationSec.toFixed(1) + 's)' : ''));
      } else {
        setProgress(0, 'lỗi');
        log('❌ export lỗi: ' + (r.error || 'không rõ'));
      }
    } catch (e) {
      /* Luật 10: exception sau export phải lộ ra Log, không chết thầm để bar kẹt giữa chừng */
      setProgress(0, 'lỗi');
      log('❌ lỗi sau export: ' + String((e && e.message) || e));
    }
  }

  function setProgress(pct, msg) {
    if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (els.progressPct) els.progressPct.textContent = Math.round(pct) + '%';
    if (els.progressMsg) els.progressMsg.textContent = msg || '';
  }

  async function stopExport() {
    const r = await window.native.whiteboard.exportCancel();
    log(r && r.ok ? '■ đã huỷ render' : '■ không có tiến trình nào đang chạy');
    state.exporting = false;
    syncButtons();
  }

  function syncButtons() {
    if (els.exportBtn) els.exportBtn.disabled = state.exporting || !state.scenes.length;
    if (els.stopBtn) els.stopBtn.disabled = !state.exporting;
  }

  /* ── đăng ký vào context dùng chung ── */
  C.hdImageDataUrl = hdImageDataUrl;
  C.aiRegionToElement = aiRegionToElement;
  C.generateElementsAI = generateElementsAI;
  C.exportVideo = exportVideo;
  C.setProgress = setProgress;
  C.stopExport = stopExport;
  C.syncButtons = syncButtons;
})();
