/* whiteboard-studio-ai.js �€” AI cho Whiteboard Studio (renderer)
   ------------------------------------------------------------
   3 tính n�ƒng, TÁI D�™NG b�™ gọi AI sẵn có của app (callLLMJson �€”
   src/toolbox/utility/llm.js, �‘i qua window.native.llmFetch) và
   engine Flow sẵn có của tab Tạo Ảnh Hàng Loạt (flowBridge +
   tfDispatchGen �€” src/toolbox/utility/tf.js):

   1) wbAiPrompts �€” "�Ÿ�– AI sinh prompt ảnh": AI �‘ọc TỪNG C�‚U k�‹ch bản
      (cảnh �‘ã chia theo timing SRT �€” nút �Ÿ�� Chia theo câu) �†’ m�—i
      cảnh nhận: imagePrompt (tiếng Anh, line-art whiteboard nhất
      quán) + objects (vật th�ƒ AI nhận dạng trong câu �‘�ƒ vẽ, kèm
      share = t�‰ trọng nh�‹p k�ƒ �†’ dùng phân b�• giờ vẽ).

   2) wbAiGenImages �€” "�Ÿ�– AI sinh ảnh theo câu (auto)": TR�ŒN LU�’NG
      tự �‘�™ng �€” (a) sinh prompt cho câu còn thiếu, (b) Flow sinh ảnh
      line-art cho TỪNG câu theo prompt (aspect ép 16:9 kh�›p canvas
      1280�—720; model/quality theo tab Tạo Ảnh; multi-account dùng
      POOL, 1 account dùng project riêng), (c) lưu ảnh vào
      <thư mục lưu>/whiteboard-anh/cau-NNN.png (saveFile IPC) r�“i
      gán vào cảnh �‘úng khung thời gian SRT, (d) wbAiRegionsCore tự
      khoanh vùng người/vật th�ƒ/sự ki�‡n trên ảnh �‘ó + giờ vẽ theo
      nh�‹p k�ƒ. Câu �‘ã có ảnh �‘ược bỏ qua �€” bấm lại �‘�ƒ tạo tiếp.

   3) wbAiRegions �€” "�ŸŽ� AI khoanh vùng vật th�ƒ": AI vision soi ảnh
      của cảnh �‘ang chọn �†’ polygon toạ �‘�™ chuẩn hoá 0�€“1000 �†’ phần
      tử vẽ (schema whiteboard-annotation.js), giờ reveal phân b�•
      theo share của objects (nếu kh�›p s�‘ lượng) hoặc �‘ều.

   Pattern vision port từ src/hd/hd-ai-export.js (không copy chéo
   state �€” m�—i panel context riêng). Module nạp SAU
   whiteboard-studio-panel.js, lấy context qua window.wbStudioCtx;
   panel lazy-mount �†’ chờ nút xuất hi�‡n bằng MutationObserver.
   KH�”NG import/export (AGENTS.md §4). */

'use strict';

(function () {
  const C = window.wbStudioCtx;
  if (!C || !C.state) return;                     // panel chưa nạp �€” module này vô dụng nếu thiếu ctx
  const { state, log, wbFileUrl, A } = C;

  const BATCH = 6;          // câu / lần gọi LLM (lô nhỏ �€” tránh token trần, l�—i thử lại nhanh)
  const MAX_OBJECTS = 8;

  /* �”€�”€ ảnh �†’ base64 (giảm cạnh dài �‘�ƒ gửi vision) �”€�”€ */
  async function wbAiDataUrl(imagePath, maxEdge) {
    const resp = await fetch(wbFileUrl(imagePath));
    if (!resp || !resp.ok) throw new Error('không tải �‘ược ảnh (HTTP ' + (resp && resp.status) + ')');
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
    if (!m) throw new Error('không mã hoá �‘ược ảnh base64');
    return { mediaType: m[1], data: m[2] };
  }

  /* �•��•��•��•��•��•��•��•� 1 · AI SINH PROMPT ẢNH THEO C�‚U �•��•��•��•��•��•��•��•� */

  function wbAiNormalizeShares(objects) {
    // chuẩn hoá share về t�•ng 100 (deterministic �€” không tin tư�Ÿng AI giữ t�•ng)
    const arr = (objects || []).slice(0, MAX_OBJECTS);
    if (!arr.length) return [];
    const sum = arr.reduce((t, o) => t + Math.max(1, Number(o.share) || 0), 0);
    let acc = 0;
    return arr.map((o, i) => {
      const raw = Math.max(1, Number(o.share) || 0) * 100 / sum;
      const v = (i === arr.length - 1) ? 100 - acc : Math.round(raw);
      acc += v;
      return { label: String(o.label || ('Vật ' + (i + 1))).slice(0, 60), share: Math.max(1, v) };
    });
  }

  function wbAiPromptBatch(batch, firstIdx) {
    const list = batch.map((s, k) =>
      (firstIdx + k + 1) + '. [' + (s.durationMs / 1000).toFixed(1) + 's] ' + s.text).join('\n');
    return 'You are the art director of a WHITEBOARD EXPLAINER video (hand-drawn line-art on white paper, one image per sentence). ' +
      'For EACH numbered sentence below (duration in seconds shown), produce:\n' +
      '1. "prompt": ONE English image-generation prompt for a hand-drawn whiteboard line-art illustration of that sentence. ' +
      'Keep ONE consistent main character across all sentences (generic friendly man, simple outfit) unless the sentence clearly needs another subject. ' +
      'Style: black ink outlines on plain white background, minimal, clean, no text/letters/numbers in the image, no shading gradients.\n' +
      '2. "objects": the 2-6 concrete visual objects/subjects MENTIONED IN THAT SENTENCE that the hand should draw, ' +
      'in natural drawing order (background to foreground), each with "share": percentage of the sentence duration spent drawing it ' +
      '(following the narration rhythm - the key noun being spoken gets more time). shares are roughly proportional, no need to sum exactly 100.\n' +
      'Return ONLY JSON: {"scenes":[{"i":<same number>,"prompt":"...","objects":[{"label":"short Vietnamese label","share":30},...]}]}\n\n' +
      'Sentences:\n' + list;
  }
  /* lõi sinh prompt cho danh sách targets [{s, idx}] �€” dùng chung cho
     nút �Ÿ�– AI prompt ảnh và lu�“ng auto �Ÿ�– AI sinh ảnh theo câu */
  async function wbAiPromptCore(targets) {
    let done = 0;
    for (let base = 0; base < targets.length; base += BATCH) {
      const batch = targets.slice(base, base + BATCH);
      const out = await callLLMJson(wbAiPromptBatch(batch.map((x) => x.s), batch[0].idx), {
        maxTokens: 350 * batch.length + 500,
        tries: 2,
        validate: (o) => {
          if (!o || !Array.isArray(o.scenes) || !o.scenes.length) throw new Error('AI thiếu mảng scenes');
          const want = new Set(batch.map((x) => x.idx + 1));
          o.scenes.forEach((sc, k) => {
            if (!sc || !want.has(sc.i)) throw new Error('scenes[' + k + '] sai s�‘ thứ tự câu (i=' + sc.i + ')');
            if (typeof sc.prompt !== 'string' || sc.prompt.trim().length < 20) throw new Error('scenes[' + k + '] prompt quá ngắn');
          });
          return o;
        },
      });
      out.scenes.forEach((sc) => {
        const t = state.scenes[sc.i - 1];
        if (!t) return;
        t.imagePrompt = sc.prompt.trim();
        t.objects = wbAiNormalizeShares(sc.objects);
        done++;
      });
      log('�œ“ AI prompt: ' + Math.min(base + BATCH, targets.length) + '/' + targets.length + ' câu');
    }
    return done;
  }

  async function wbAiPrompts() {
    if (!state.scenes.length) { log('�š� chưa có cảnh �€” bấm "�Ÿ�� Chia theo câu (SRT)" hoặc phân cảnh trư�›c'); return; }
    if (typeof callLLMJson !== 'function') { log('�š� chưa có b�™ gọi AI (callLLMJson) �€” chạy panel trong app Nova'); return; }
    const targets = state.scenes
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s.text && x.s.text.length > 3);
    if (!targets.length) { log('�š� cảnh nào cũng chưa có lời thoại (text) �€” cần SRT/k�‹ch bản trư�›c'); return; }
    const btn = C.els.aiPromptsBtn;
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; btn.textContent = '�Ÿ�– AI �‘ang �‘ọc k�‹ch bản�€�'; }
    try {
      const done = await wbAiPromptCore(targets);
      log('�œ“ xong prompt ảnh cho ' + done + ' cảnh �€” bấm "�Ÿ�– AI sinh ảnh theo câu (auto)" �‘�ƒ Flow tạo ảnh + khoanh vùng luôn.');
    } catch (err) {
      log('�Œ AI prompt l�—i: ' + String((err && err.message) || err));
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
      C.renderSceneList(); C.renderSceneDetail();
    }
  }

  /* �•��•��•��•��•��•��•��•� 1b · PH�‚N TÍCH PROMPT (Bư�›c 3 của lu�“ng 6 bư�›c) �•��•��•��•��•��•��•��•�
     Nút "�Ÿ�� Phân tích prompt": tách k�‹ch bản (Bư�›c 1) thành câu có nghĩa +
     �‘�‘i chiếu .SRT (Bư�›c 2) �‘�ƒ m�—i câu có thời lượng �‘ọc chính xác �€” logic
     chia/kh�›p nằm �Ÿ wbAnalyzePromptData (panel, deterministic �€” Luật 8);
     xong thì AI sinh prompt ảnh cho các câu còn thiếu (dùng lại wbAiPrompts). */
  async function wbAnalyzePrompt() {
    const btn = document.getElementById('wb-analyzePromptBtn');
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; btn.textContent = '�Ÿ�� Đang tách câu + kh�›p timing .SRT�€�'; }
    try {
      const r = C.wbAnalyzePromptData();
      if (!r) return; // l�—i l�™ li�…u (WB_NO_SCRIPT / WB_NO_SRT) �‘ã log trong panel
      await wbAiPrompts();
      await wbAiGenImages();
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
    }
  }

  /* �•��•��•��•��•��•��•��•� 2 · AI VISION KHOANH V�™NG VẬT TH�‚ TR�ŠN ẢNH �•��•��•��•��•��•��•��•� */

  function wbAiRegionToElement(raw, idx, s) {
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

  /* giờ reveal theo NH�ŠP K�‚: span = durationMs - LEAD_IN - HOLD; m�—i phần tử
     nhận share/100 * span (min 600ms), n�‘i tiếp nhau từ LEAD_IN. Không có
     objects / s�‘ lượng l�‡ch �†’ chia �‘ều. */
  function wbAiScheduleReveal(elements, s) {
    const span = Math.max(1000, (s.durationMs || 0) - A.LEAD_IN_MS - A.HOLD_MS);
    const n = elements.length;
    const shares = (Array.isArray(s.objects) && s.objects.length === n)
      ? s.objects.map((o) => Math.max(1, Number(o.share) || 0))
      : elements.map(() => 1);
    const sum = shares.reduce((t, v) => t + v, 0);
    let t = A.LEAD_IN_MS;
    elements.forEach((e, i) => {
      const d = Math.max(600, Math.round(span * shares[i] / sum));
      e.reveal.startMs = t;
      e.reveal.durationMs = Math.min(d, Math.max(600, (s.durationMs || d) - A.HOLD_MS - t));
      t += d;
    });
  }
  /* lõi vision cho 1 cảnh �€” dùng chung cho nút �ŸŽ� AI khoanh vùng và
     lu�“ng auto �Ÿ�– AI sinh ảnh theo câu. s.image + s.canvas phải có. */
  async function wbAiRegionsCore(s) {
    log('�ŸŽ� AI vision �‘ang nhìn: ' + s.image.split(/[\\/]/).pop() +
      (s.objects && s.objects.length ? ' (vật th�ƒ theo lời thoại: ' + s.objects.map((o) => o.label).join(', ') + ')' : ''));
    const img = await wbAiDataUrl(s.image, 896);
    const focus = (Array.isArray(s.objects) && s.objects.length)
      ? 'The narration of this scene mentions these objects: ' + s.objects.map((o) => o.label).join(', ') +
        '. Prioritize outlining THOSE objects if visible (labels in that order), plus at most a couple of essential others. '
      : '';
    const prompt = 'You are looking at ONE image that will be redrawn as a hand-drawn animation. ' +
      'Detect the 2-6 most important visual objects/subjects of the image (not the whole image, no tiny details, no text lines). ' +
      focus +
      'For each object output a closed polygon outlining it. ' +
      'Coordinates are NORMALIZED 0-1000 relative to image width (x, right) and height (y, down). ' +
      'Each polygon: 4-14 points [x, y] as integers, ordered clockwise. ' +
      'Regions must be listed background to foreground (natural drawing order). ' +
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
      const e2 = wbAiRegionToElement(r, built.length, s);
      if (e2) built.push(e2);
      else log('�š� vùng AI ' + (i + 1) + ' points không dùng �‘ược �€” bỏ qua');
    });
    if (!built.length) throw new Error('AI không trả vùng nào dùng �‘ược');
    s.elements = built;
    s.previewPath = null;
    s.elementsDirty = false;
    wbAiScheduleReveal(built, s);
    log('�ŸŽ� AI khoanh ' + built.length + ' vùng: ' + built.map((e2) => e2.label).join(' · ') +
      (Array.isArray(s.objects) && s.objects.length === built.length ? ' �€” giờ vẽ theo share nh�‹p k�ƒ' : ' �€” giờ vẽ chia �‘ều (objects không kh�›p s�‘ vùng)'));
    return built;
  }

  /* �•��•��•��•��•��•��•��•� 3 · SINH ẢNH TỰ Đ�˜NG THEO C�‚U (Flow) �•��•��•��•��•��•��•��•� */
  /* Trọn lu�“ng: prompt cho câu còn thiếu �†’ Flow sinh ảnh line-art từng
     câu �†’ lưu + gán �‘úng khung thời gian SRT �†’ AI vision khoanh vùng +
     giờ vẽ theo nh�‹p k�ƒ. TÁI D�™NG engine Flow của tab Tạo Ảnh Hàng Loạt
     (flowBridge + tfDispatchGen + tfEnsureProject + tfCfg �€” global của
     index.html, panel này chạy trong cùng trang). KH�”NG chế kênh m�›i. */

  const _wbQuotaRe = /429|QUOTA|EXHAUSTED|hết lượt|hết quota|hết gi�›i hạn|ALL_ACCOUNTS/i;
  const _wbSoftRe = /FILTER|SAFETY|PROMINENT|UNAUTHENT|API_401|MODEL_ACCESS/i;
  const _wbTrafficRe = /TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki/i;
  const wbAiSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function wbAiGenEngine() {
    if (typeof flowBridge === 'undefined' || flowBridge === null ||
        typeof tfDispatchGen !== 'function' || typeof tfEnsureProject !== 'function') {
      throw new Error('thiếu engine Flow (flowBridge/tfDispatchGen) �€” panel phải chạy trong index.html của app');
    }
  }

  async function wbAiGenStatus() {
    if (!(await flowBridge.waitReady(1500))) throw new Error('chưa kết n�‘i Flow');
    const st = await flowBridge.call('GET_STATUS');
    if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))) {
      throw new Error('chưa �‘�ƒng nhập Flow �€” m�Ÿ tab "Tạo Ảnh Hàng Loạt" �‘�ƒ thêm/�‘�ƒng nhập tài khoản r�“i thử lại');
    }
    return st;
  }

  async function wbAiGenSave(dataUrl, idx) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('phản h�“i Flow không có ảnh �‘ọc �‘ược (thiếu dataUrl)');
    let dir = '';
    try { dir = localStorage.getItem('av_save_dir') || ''; } catch (e) {}
    if (!dir) {
      if (!window.native || typeof window.native.pickFolder !== 'function') {
        throw new Error('chưa có thư mục lưu ảnh �€” chọn "Lưu về máy" �Ÿ Dashboard hoặc cho phép chọn thư mục');
      }
      const r = await window.native.pickFolder();
      if (!r || !r.path) throw new Error('chưa chọn thư mục lưu ảnh');
      dir = r.path;
      try { localStorage.setItem('av_save_dir', dir); } catch (e) {}
    }
    const ext = ((m[1] || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
    const name = 'cau-' + String(idx + 1).padStart(3, '0') + '.' + ext;
    const sv = await window.native.saveFile({ dir, subdir: 'whiteboard-anh', name, base64: m[2] });
    if (!sv || !sv.path) throw new Error('lưu ảnh l�—i: ' + ((sv && sv.error) || 'không rõ'));
    return sv.path;
  }

  /* gen 1 ảnh + retry l�—i mềm (gi�‘ng tfGenScenes: mềm �‰�2 lần, b�‹ chặn traffic �‰�3 lần) */
  async function wbAiGenOne(prompt, ctx) {
    let e0 = null, err = '', rotated = null;
    for (let att = 0; ; att++) {
      const r = await tfDispatchGen(prompt, [], ctx);
      e0 = ((r && r.media_entries) || []).find((e) => e && e.dataUrl) || null;
      err = (r && r.error) || (!e0 ? 'phản h�“i không có ảnh' : '');
      rotated = (r && r.rotated) || null;
      if (e0) break;
      const soft = !_wbQuotaRe.test(err) && !_wbSoftRe.test(err);
      const traffic = _wbTrafficRe.test(err);
      if (!soft || att >= (traffic ? 3 : 2)) break;
      const wait = traffic ? (6000 + att * 4000) : 1500;
      log('�†� l�—i mềm (' + String(err).slice(0, 140) + ') �†’ ngh�‰ ' + Math.round(wait / 1000) + 's r�“i thử lại lần ' + (att + 1));
      await wbAiSleep(wait);
    }
    return { e0, err, rotated };
  }

  window.wbStudioAi = { wbAiPrompts, wbAiGenImages, wbAiRegionsCore, wbAiScheduleReveal, wbAnalyzePrompt, wbArrangeRegions };

  /* �•��•��•��•��•��•��•��•� 2b · SẮP XẾP DỮ LI�†U (Bư�›c 4 của lu�“ng 6 bư�›c) �•��•��•��•��•��•��•��•�
     Nút "�Ÿ—� Sắp xếp dữ li�‡u": AI vision khoanh vùng TẤT CẢ cảnh có ảnh.
     Giờ vẽ (start/duration) do wbAiScheduleReveal phân b�• �€” neo theo khung
     thời lượng câu (startMs/endMs từ SRT �Ÿ Bư�›c 3) nên giờ vẽ kh�›p �‘úng
     thời lượng �‘ọc từng câu. Cảnh thiếu ảnh �†’ l�—i l�™ li�…u từng cụm
     (WB_ARRANGE_NO_IMAGE), KH�”NG bỏ qua ngầm (Luật 10). */
  async function wbArrangeRegions() {
    if (!state.scenes.length) { log('[WB_LOI] WB_NO_SCENES �€” chưa có cảnh nào. Bấm "�Ÿ�� Phân tích prompt" �Ÿ Bư�›c 3 trư�›c.'); return; }
    if (typeof callLLMJson !== 'function') { log('�š� chưa có b�™ gọi AI (callLLMJson) �€” chạy panel trong app Nova'); return; }
    const missing = [];
    state.scenes.forEach((s, i) => { if (!s.image || !s.canvas) missing.push(i + 1); });
    if (missing.length) {
      log('[WB_LOI] WB_ARRANGE_NO_IMAGE �€” ' + missing.length + '/' + state.scenes.length + ' cảnh chưa có ảnh (câu: ' + missing.join(', ') + '). Hoàn tất "�Ÿ�– AI sinh ảnh theo prompt (Flow)" hoặc gán ảnh tay �Ÿ Bư�›c 3 trư�›c.');
      return;
    }
    const btn = document.getElementById('wb-arrangeBtn');
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; }
    let ok = 0; const errs = [];
    try {
      for (let i = 0; i < state.scenes.length; i++) {
        const s = state.scenes[i];
        if (btn) btn.textContent = '�Ÿ—� AI �‘ang sắp xếp cảnh ' + (i + 1) + '/' + state.scenes.length + '�€�';
        try {
          await wbAiRegionsCore(s);
          ok++;
        } catch (err) {
          errs.push('câu ' + (i + 1) + ': ' + String((err && err.message) || err));
        }
      }
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
      C.renderSceneList(); C.renderSceneDetail();
    }
    log('�”��”��”� Sắp xếp dữ li�‡u xong: ' + ok + '/' + state.scenes.length + ' cảnh có vùng vẽ kh�›p khung thời lượng câu �”��”��”�');
    if (errs.length) log('�Œ ' + errs.length + ' cảnh l�—i (l�™ li�…u, sửa r�“i bấm lại): ' + errs.join(' | '));
  }

  async function wbAiGenImages() {
    if (!state.scenes.length) { log('�š� chưa có cảnh �€” bấm "�Ÿ�� Chia theo câu (SRT)" trư�›c'); return; }
    if (typeof callLLMJson !== 'function') { log('�š� chưa có b�™ gọi AI (callLLMJson) �€” chạy panel trong app Nova'); return; }
    try {
      wbAiGenEngine();
      const st = await wbAiGenStatus();
      /* (a) prompt cho câu còn thiếu */
      const targets = state.scenes.map((s, idx) => ({ s, idx })).filter((x) => x.s.text && x.s.text.length > 3);
      if (!targets.length) { log('�š� cảnh nào cũng chưa có lời thoại (text) �€” cần SRT/k�‹ch bản trư�›c'); return; }
      const needP = targets.filter((x) => !x.s.imagePrompt);
      if (needP.length) {
        log('�Ÿ�– AI sinh prompt cho ' + needP.length + ' câu chưa có prompt�€�');
        await wbAiPromptCore(needP);
      }
      const units = targets.filter((x) => x.s.imagePrompt);
      if (!units.length) { log('�š� không có câu nào có prompt ảnh �€” AI prompt l�—i?'); return; }
      const gen = units.filter((x) => !x.s.image);
      const skipN = units.length - gen.length;
      if (skipN) log('�„� bỏ qua ' + skipN + ' câu �‘ã có ảnh (xoá ảnh của cảnh �‘�ƒ tạo lại)');
      if (!gen.length) { log('�œ“ tất cả câu �‘ã có ảnh �€” không tạo thêm'); return; }

      const btn = document.getElementById('wb-aiGenBtn');
      const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
      if (btn) { btn.disabled = true; btn.textContent = '�Ÿ–� AI �‘ang sinh ảnh 0/' + gen.length + '�€�'; }
      let done = 0, failed = 0;
      try {
        /* (b) cấu hình Flow �€” model/quality theo tab Tạo Ảnh, ép 16:9 kh�›p canvas 1280�—720;
           multi-account �†’ POOL round-robin, 1 account �†’ project riêng (gi�‘ng tfGenScenes) */
        const cfg = (typeof tfCfg === 'function') ? tfCfg() : { model: '', aspect: '16:9', quality: '', conc: 2, delay: 0 };
        cfg.kind = 'image';
        cfg.aspect = '16:9';
        const multi = flowBridge.mode === 'extension' ? (st.accountCount || 0) >= 1 : (st.accountCount || 0) > 1;
        let projectId = null;
        if (multi) await flowBridge.call('POOL_RESET');
        else projectId = await tfEnsureProject();
        const ctx = { multi, cfg, imgMap: {}, projectId, tier: st.paygateTier };
        const conc = multi ? Math.max(1, st.accountCount) : Math.max(1, cfg.conc || 2);
        log('�Ÿ–� Flow bắt �‘ầu tạo ' + gen.length + ' ảnh' + (multi ? ' (�š� ' + st.accountCount + ' tài khoản, ' + conc + ' lu�“ng)' : (' · ' + conc + ' lu�“ng')) + '�€�');

        /* (c)+(d) pool �‘ơn giản: m�—i câu �€” gen �†’ lưu �†’ gán �†’ AI khoanh vùng */
        let i = 0;
        const runner = async () => {
          while (i < gen.length) {
            const my = i++;
            const { s, idx } = gen[my];
            const label = 'Câu ' + (idx + 1);
            try {
              if (btn) btn.textContent = '�Ÿ–� AI �‘ang sinh ảnh ' + (done + failed + 1) + '/' + gen.length + '�€�';
              log('�Ÿ–� ' + label + ' [' + ((s.startMs || 0) / 1000).toFixed(1) + 's �†’ ' + ((s.endMs || 0) / 1000).toFixed(1) + 's] gửi prompt �†’ Flow �‘ang tạo�€�');
              const { e0, err, rotated } = await wbAiGenOne(String(s.imagePrompt), ctx);
              if (Array.isArray(rotated)) for (const ex of rotated) log('�š� ' + ex + ' hết lượt �†’ chuy�ƒn tài khoản');
              if (!e0) throw new Error(err || 'Flow không trả ảnh');
              const path = await wbAiGenSave(e0.dataUrl, idx);
              await C.setImageForScene(idx, path);
              if (!s.canvas) throw new Error('ảnh lưu xong nhưng không �‘ọc �‘ược kích thư�›c');
              await wbAiRegionsCore(s);
              done++;
              log('�œ“ ' + label + ' xong: ảnh gán �‘úng khung thời gian + vùng vẽ theo nh�‹p k�ƒ (' + path.split(/[\\/]/).pop() + ')');
            } catch (e2) {
              failed++;
              const msg = String((e2 && e2.message) || e2);
              log((_wbQuotaRe.test(msg) ? '�š� ' : '�Œ ') + label + ' · ' + msg +
                (_wbQuotaRe.test(msg) ? ' (tài khoản hết lượt �€” thêm account Flow �Ÿ Tạo Ảnh Hàng Loạt hoặc thử lại sau)' : ''));
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(conc, gen.length) }, runner));
      } finally {
        if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
      }
      log('�”��”��”� Sinh ảnh xong: ' + done + '/' + gen.length + ' câu' + (failed ? ' · ' + failed + ' l�—i' : '') + ' �”��”��”�');
      if (failed) log('�„� bấm lại "�Ÿ�– AI sinh ảnh theo câu (auto)" �‘�ƒ TẠO TIẾP các câu còn thiếu (câu �‘ã có ảnh �‘ược giữ nguyên)');
    } catch (err) {
      log('�Œ AI sinh ảnh l�—i: ' + String((err && err.message) || err));
    } finally {
      C.renderSceneList(); C.renderSceneDetail();
    }
  }

  /* �”€�”€ boot: panel lazy-mount �†’ chờ nút xuất hi�‡n (MutationObserver) �”€�”€ */
  function boot() {
    /* Luồng 6 bước r�t gọn: Bước 3 chỉ c�n "Ph�n t�ch prompt" (chuỗi đầy đủ
       t�ch c�u + SRT + prompt + Flow sinh ảnh + khoanh v�ng), Bước 4 chỉ c�n
       "Sắp xếp dữ liệu". C�c n�t AI rời (prompt/gen/khoanh v�ng đơn) đ� gỡ. */
    const b4 = document.getElementById('wb-analyzePromptBtn');
    const b5 = document.getElementById('wb-arrangeBtn');
    if (b4 && !b4.dataset.wbAiBound) { b4.dataset.wbAiBound = '1'; b4.addEventListener('click', wbAnalyzePrompt); }
    if (b5 && !b5.dataset.wbAiBound) { b5.dataset.wbAiBound = '1'; b5.addEventListener('click', wbArrangeRegions); }
    return !!(b4 && b5);
  }
  if (!boot()) {
    const mo = new MutationObserver(() => { if (boot()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
