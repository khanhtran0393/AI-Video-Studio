/* whiteboard-studio-ai.js — AI cho Whiteboard Studio (renderer)
   ------------------------------------------------------------
   2 khối chức năng, TÁI DÙNG bộ gọi AI sẵn có của app (callLLMJson —
   src/toolbox/utility/llm.js, đi qua window.native.llmFetch) và
   engine Flow sẵn có của tab Tạo Ảnh Hàng Loạt (flowBridge +
   tfDispatchGen — src/toolbox/utility/tf.js):
   2026-09-17: vision (wbAiRegionsCore) đi qua wbAiVisionJson — toggle
   "🤖 Antigravity khoanh vùng" (Bước 4) đổi đường dây sang Antigravity
   (agentCopilot:chat, vision thuần disableTools); hợp đồng JSON +
   validate giữ nguyên tuyệt đối, lỗi lộ liễu không fallback ngầm.
   2026-09-17 (nâng cấp "Antigravity thật"): wbAiVisionSelfCheck — vòng
   tự kiểm 1 lượt (nhìn lại ảnh lần 2, verdict ok/fix); wbVisionMemory —
   ghi nhớ nhãn ≤6 cảnh trước để tên vật thể nhất quán giữa các câu;
   wbVisionPlan — kế hoạch có tick tiến độ cho luồng nhiều cảnh. Vòng
   agentic CÓ GIỚI HẠN này thuộc NGOẠI LỆ Antigravity của Luật 8
   (AGENTS.md §4) — mọi vòng đều khai báo trong log, vẫn cấm fallback
   ngầm (Luật 10).

   1) wbAiPrompts — sinh prompt ảnh: AI đọc TỪNG CÂU kịch bản
      (cảnh đã chia theo timing SRT ở Bước 2) → mỗi cảnh nhận
      imagePrompt (tiếng Anh, line-art whiteboard nhất quán) +
      objects (vật thể AI nhận dạng trong câu để vẽ, kèm share =
      tỷ trọng nhịp kẻ → dùng phân bố giờ vẽ). Gọi nội bộ từ Bước 3.

   2) wbAnalyzePromptData — Bước 3, nút "Phân tích prompt" (nút duy
      nhất của luồng AI): chạy trọn chuỗi wbAiPrompts() →
      wbAiGenImages(): (a) sinh prompt cho câu còn thiếu, (b) Flow
      sinh ảnh line-art cho TỪNG câu (aspect ép 16:9 khớp canvas
      1280×720; model/quality theo tab Tạo Ảnh; multi-account dùng
      POOL, 1 account dùng project riêng), (c) lưu ảnh vào
      <thư mục lưu>/whiteboard-anh/<profile = tên bản TTS>/cau-NNN.png
      (saveFile IPC, kèm metadata cau-NNN.json: prompt + text + khung
      thời gian SRT + objects + cấu hình Flow) rồi gán vào cảnh đúng
      khung thời gian SRT, (d) wbAiRegionsCore tự khoanh vùng
      khoanh vùng người/vật thể/sự kiện trên ảnh đó + giờ vẽ theo
      nhịp kẻ. Câu đã có ảnh được bỏ qua — chạy lại để tạo tiếp.

   3) Nút "🖼 Gen ảnh" (hiện sau khi Phân tích prompt thành công) —
      wbAiGenImages riêng lẻ: gen/retry các câu còn thiếu, cùng cấu
      hình và cùng thư mục profile với luồng trên. Nút "📥 Gọi lại
      ảnh" — wbRecallImages: chọn thư mục profile → đọc metadata
      cau-NNN.json → gán lại prompt + khung thời gian + ảnh vào cảnh
      hiện có, hoặc dựng lại toàn bộ cảnh khi panel vừa reload (timing
      theo metadata, cues rỗng — khai báo) → Bước 4 sắp xếp timeline
      bình thường.

   Pattern vision port từ src/hd/hd-ai-export.js (không copy chéo
   state — mỗi panel context riêng). Module nạp SAU
   whiteboard-studio-panel.js, lấy context qua window.wbStudioCtx;
   panel lazy-mount → chờ nút xuất hiện bằng MutationObserver.
   KHÔNG import/export (AGENTS.md §4). */

'use strict';

(function () {
  const C = window.wbStudioCtx;
  if (!C || !C.state) return;                     // panel chưa nạp — module này vô dụng nếu thiếu ctx
  const { state, log, wbFileUrl, A } = C;

  const BATCH = 6;          // câu / lần gọi LLM (lô nhỏ — tránh token trần, lỗi thử lại nhanh)
  const MAX_OBJECTS = 8;

  /* ── ảnh → base64 (giảm cạnh dài để gửi vision) ── */
  async function wbAiDataUrl(imagePath, maxEdge) {
    const resp = await fetch(wbFileUrl(imagePath));
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

  /* ════════ 1 · AI SINH PROMPT ẢNH THEO CÂU ════════ */

  function wbAiNormalizeShares(objects) {
    // chuẩn hoá share về tổng 100 (deterministic — không tin tưởng AI giữ tổng)
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
  /* lõi sinh prompt cho danh sách targets [{s, idx}] — dùng chung cho
     nút 🤖 AI prompt ảnh và luồng auto 🤖 AI sinh ảnh theo câu */
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
            if (!sc || !want.has(sc.i)) throw new Error('scenes[' + k + '] sai số thứ tự câu (i=' + sc.i + ')');
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
      log('✓ AI prompt: ' + Math.min(base + BATCH, targets.length) + '/' + targets.length + ' câu');
    }
    return done;
  }

  async function wbAiPrompts() {
    if (!state.scenes.length) { log('\u26a0 ch\u01b0a c\u00f3 c\u1ea3nh \u2014 c\u1ea7n chia c\u00e2u SRT (B\u01b0\u1edbc 2) tr\u01b0\u1edbc'); return; }
    if (typeof callLLMJson !== 'function') { log('⚠ chưa có bộ gọi AI (callLLMJson) — chạy panel trong app Nova'); return; }
    const targets = state.scenes
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s.text && x.s.text.length > 3);
    if (!targets.length) { log('⚠ cảnh nào cũng chưa có lời thoại (text) — cần SRT/kịch bản trước'); return; }
    try {
      const done = await wbAiPromptCore(targets);
      log('\u2705 xong prompt \u1ea3nh cho ' + done + ' c\u1ea3nh \u2014 Flow s\u1ebd sinh \u1ea3nh + khoanh v\u00f9ng ngay sau \u0111\u00f3.');
    } catch (err) {
      log('❌ AI prompt lỗi: ' + String((err && err.message) || err));
    } finally {
      C.renderSceneList(); C.renderSceneDetail();
    }
  }

  /* ════════ 1b · PHÂN TÍCH PROMPT (Bước 3 của luồng 6 bước) ════════
     Nút "🧠 Phân tích prompt": tách kịch bản (Bước 1) thành câu có nghĩa +
     đối chiếu .SRT (Bước 2) để mỗi câu có thời lượng đọc chính xác — logic
     chia/khớp nằm ở wbAnalyzePromptData (panel, deterministic — Luật 8);
     xong thì AI sinh prompt ảnh cho các câu còn thiếu (dùng lại wbAiPrompts). */
  async function wbAnalyzePrompt() {
    const btn = document.getElementById('wb-analyzePromptBtn');
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; btn.textContent = '🧠 Đang tách câu + khớp timing .SRT…'; }
    try {
      const r = C.wbAnalyzePromptData();
      if (!r) return; // lỗi lộ liễu (WB_NO_SCRIPT / WB_NO_SRT) đã log trong panel
      /* phân tích thành công → mở khóa nút "🖼 Gen ảnh" (gen riêng, retry thiếu) */
      if (typeof C.showGenImagesBtn === 'function') C.showGenImagesBtn();
      await wbAiPrompts();
      await wbAiGenImages();
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
    }
  }

  /* ════════ 2 · AI VISION KHOANH VÙNG VẬT THỂ TRÊN ẢNH ════════ */

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

  /* giờ reveal theo NHỊP KỂ: span = durationMs - LEAD_IN - HOLD; mỗi phần tử
     nhận share/100 * span (min 600ms), nối tiếp nhau từ LEAD_IN. Không có
     objects / số lượng lệch → chia đều. */
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
  /* ── Đường dây vision: user API → Antigravity → Google Vision (một nguồn hợp đồng) ──
     Toggle "🤖 Antigravity khoanh vùng" (Bước 4, localStorage wb_antigravity):
     khi bật và provider của Sếp VÀO ĐƯỢC kênh Copilot (chuẩn OpenAI: openai/
     gemini/openai-compatible) → wbAiRegionsCore đi qua Antigravity
     (agentCopilot:chat) ở chế độ VISION THUẦN: disableTools → main không khai
     báo tools cho model, KHÔNG vòng lặp agentic; systemPrompt chuyên biệt
     override. Config AI luôn là API NGƯỜI DÙNG CÀI ĐẶT — cùng thứ tự ưu tiên
     với callLLM: "📋 API đã thêm" → API Key Flow (key Gemini) → provider đang
     chọn (api_provider/api_key_<provider>/api_key mirror/api_model/api_base_url).
     Provider KHÔNG đi được kênh Copilot nhưng đọc được ảnh (anthropic native,
     gateway…) → dùng trực tiếp callLLMJson (báo log rõ ràng, không phải fallback
     ngầm). Provider KHÔNG hỗ trợ vision (deepseek/cli/groq…) → THÔNG BÁO cho
     người dùng rồi CHUYỂN SANG GOOGLE VISION (Gemini qua API Key Flow); thiếu
     key Flow → lỗi lộ liễu WB_VISION_NO_GOOGLE_KEY (Luật 10). */
  const WB_AC_VISION_SYSTEM = 'Bạn là mắt nhìn của Whiteboard Studio: chỉ nhìn MỘT ảnh và trả về DUY NHẤT một JSON hợp lệ đúng yêu cầu. KHÔNG gọi tool nào, KHÔNG giải thích, KHÔNG markdown — chỉ JSON.';
  /* Provider đi được kênh Antigravity (main resolveEndpoint CHỈ nhận chuẩn OpenAI)
     VÀ đọc được ảnh. deepseek vào được kênh nhưng KHÔNG thấy ảnh → loại. */
  const WB_AC_CHANNEL_PROVIDERS = ['openai', 'gemini', 'openai-compatible'];
  function wbAcEnabled() {
    try { return localStorage.getItem('wb_antigravity') !== '0'; } catch (_) { return true; }
  }
  /* Nguồn AI NGƯỜI DÙNG CÀI ĐẶT — CÙNG thứ tự ưu tiên với _apiKeyPool (llm.js):
     "📋 API đã thêm" → API Key Flow (key Gemini, addedApiFlowKeys) → provider
     đang chọn (api_key_<provider>, fallback kho cũ 'api_key'). Trả
     {provider, model, key, baseUrl} — key CÓ THỂ rỗng (đường trực tiếp tự xử lý). */
  function wbAcUserSource() {
    const src = (typeof addedApiResolveAiSource === 'function') ? addedApiResolveAiSource() : null;
    if (src && src.provider && Array.isArray(src.keys) && src.keys.length) {
      return { provider: src.provider, model: src.model || '', key: src.keys[0], baseUrl: src.baseUrl || '' };
    }
    const provider = localStorage.getItem('api_provider') || 'anthropic';
    const keyRaw = (typeof _provKeyName === 'function')
      ? (localStorage.getItem(_provKeyName(provider)) || localStorage.getItem('api_key') || '')
      : (localStorage.getItem('api_key') || '');
    return {
      provider,
      model: localStorage.getItem('api_model') || '',
      key: keyRaw.split(/[\n,]+/)[0].trim(),
      baseUrl: localStorage.getItem('api_base_url') || '',
    };
  }
  /* Tách JSON từ văn bản model (bỏ fence ```json), rồi chạy validate —
     cùng hợp đồng đầu ra như callLLMJson. */
  function wbAiParseJson(text, validate) {
    const m = /```(?:json)?\s*([\s\S]*?)```/.exec(String(text || ''));
    const raw = (m ? m[1] : String(text || '')).trim();
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { throw new Error('WB_AC_JSON_BAD — trả lời không parse được JSON: ' + String(e.message || e)); }
    return validate(obj);
  }
  /* Convert messages kiểu Anthropic (block {type:'image',source:{media_type,data}}) →
     schema OpenAI ({type:'image_url',image_url:{url:dataURL}}). Kênh agentCopilot:chat
     chuyển tiếp messages NGUYÊN VẸN lên endpoint chuẩn OpenAI (anthropic native bị
     chặn AC_PROVIDER_UNSUPPORTED từ trước) nên BẮT BUỘC convert trước khi gửi.
     Đường callLLMJson không cần — llm.js tự convert theo provider. */
  function wbAcToOpenAiMessages(messages) {
    return (messages || []).map((m) => {
      if (!Array.isArray(m.content)) return m;
      return {
        role: m.role,
        content: m.content.map((c) => {
          if (c && c.type === 'image' && c.source && c.source.data) {
            return { type: 'image_url', image_url: { url: 'data:' + (c.source.media_type || 'image/png') + ';base64,' + c.source.data } };
          }
          return c;
        }),
      };
    });
  }
  /* Đường dây vision 1 lần gọi — thác 3 bậc, MỌI chuyển hướng đều BÁO CHO NGƯỜI DÙNG:
     1) Antigravity (nếu bật + provider user vào được kênh Copilot và thấy được ảnh);
     2) gọi TRỰC TIẾP theo Cài đặt khi provider đọc được ảnh nhưng không vào kênh
        Copilot (anthropic native, openrouter, gateway…);
     3) provider KHÔNG hỗ trợ vision → thông báo + chuyển GOOGLE VISION (Gemini
        qua API Key Flow); thiếu key Flow → lỗi lộ liễu.
     Cùng hợp đồng: (prompt, messages, validate) → object JSON ĐÃ QUA validate.
     messages vào đây ở kiểu Anthropic (chuẩn builder của wbAiRegionsCore); nhánh
     Copilot convert sang OpenAI qua wbAcToOpenAiMessages, đường callLLMJson để
     llm.js tự convert theo provider. */
  async function wbAiVisionJson(prompt, messages, validate) {
    const src = wbAcUserSource();
    const acOn = wbAcEnabled() && window.native && typeof window.native.agentCopilotChat === 'function';
    // 1) Antigravity — vision thuần qua kênh Copilot
    if (acOn && WB_AC_CHANNEL_PROVIDERS.includes(src.provider)) {
      if (!src.key) throw new Error('WB_AC_NO_KEY — Antigravity chưa có API key (Cài đặt → API). Tắt "🤖 Antigravity khoanh vùng" ở Bước 4 nếu muốn dùng luồng LLM cũ.');
      log('🤖 Antigravity đang nhìn ảnh (vision thuần, không tool)…');
      const r = await window.native.agentCopilotChat(wbAcToOpenAiMessages(messages), {
        ...src,
        disableTools: true,
        systemPrompt: WB_AC_VISION_SYSTEM,
      });
      if (!r || !r.ok) throw new Error('WB_AC_FAILED — ' + ((r && r.error) || 'Antigravity không trả lời'));
      return wbAiParseJson(r.text, validate);
    }
    // 2) Provider user đọc được ảnh → gọi trực tiếp đúng Cài đặt (hỗ trợ anthropic native)
    if (typeof VISION_PROVIDERS !== 'undefined' && VISION_PROVIDERS.includes(src.provider)) {
      if (acOn) log('ℹ Provider "' + src.provider + '" không đi được kênh Antigravity — dùng trực tiếp API đã cấu hình trong Cài đặt…');
      return callLLMJson(prompt, { messages, maxTokens: 1200, tries: 2, validate });
    }
    // 3) Provider KHÔNG hỗ trợ vision → THÔNG BÁO + chuyển Google Vision (Gemini, key Flow)
    log('⚠ Provider "' + src.provider + '" không đọc được ảnh — chuyển sang Google Vision (Gemini qua API Key Flow)…');
    const flowKeys = (typeof addedApiFlowKeys === 'function') ? addedApiFlowKeys() : [];
    if (!flowKeys.length) {
      throw new Error('WB_VISION_NO_GOOGLE_KEY — provider "' + src.provider + '" không hỗ trợ vision và chưa có API Key Flow (key Gemini). Thêm key ở Cài đặt → Tài khoản Google Flow, hoặc đổi provider hỗ trợ ảnh (Anthropic/OpenAI/Gemini).');
    }
    const gModel = (typeof MODELS !== 'undefined' && MODELS.gemini && MODELS.gemini[0]) ? MODELS.gemini[0].id : 'gemini-2.5-flash';
    log('🔍 Google Vision (Gemini ' + gModel + ', key Flow) đang đọc ảnh…');
    return callLLMJson(prompt, {
      messages, maxTokens: 1200, tries: 2, validate,
      _override: { provider: 'gemini', key: flowKeys[0], model: gModel },
    });
  }
  /* ══ NĂNG LƯỢNG "ANTIGRAVITY THẬT" (bổ sung 2026-09-17 — miễn trừ luật §4.8) ══
     Antigravity thật không chỉ nhìn 1 lần: nó TỰ KIỂM kết quả của chính mình,
     NHỚ ngữ cảnh qua các bước, và HIỂN THỊ kế hoạch. Ở đây mô phỏng đúng 3
     năng lượng đó nhưng CÓ GIỚI HẠN (≤2 lượt gọi/ảnh, nhớ ≤6 cảnh) và MỌI vòng
     đều khai báo trong log (Luật 10 — không fallback ngầm):
     1) wbAiVisionSelfCheck — sau lượt khoanh vùng 1, gửi lượt 2 ("ảnh này + JSON
        lượt 1 — đúng không?") → verdict "ok" giữ nguyên, "fix" nhận bản sửa
        (cùng validate). Lượt 2 lỗi → khai báo rõ + giữ lượt 1, KHÔNG im lặng.
     2) wbVisionMemory — ghi nhớ nhãn vùng của ≤6 cảnh trước, nhét vào prompt
        cảnh sau để tên vật thể nhất quán giữa các câu ("chiếc bàn" vẫn là
        "chiếc bàn", không thành "table").
     3) wbVisionPlan — kế hoạch có đánh dấu tiến độ cho luồng chạy nhiều cảnh
        (Sắp xếp dữ liệu): log kế hoạch đầu vòng, tick từng bước. */
  const WB_VISION_SELF_CHECK_TOGGLE = 'wb_vision_selfcheck';   // '0' = tắt
  function wbVisionSelfCheckEnabled() {
    try { return localStorage.getItem(WB_VISION_SELF_CHECK_TOGGLE) !== '0'; } catch (_) { return true; }
  }
  const wbVisionMemory = { scenes: [], max: 6 };   // [{idx, labels:[…]}] — state nội bộ module, không đụng state.js (main process)
  function wbVisionRemember(idx, labels) {
    wbVisionMemory.scenes = wbVisionMemory.scenes.filter((x) => x.idx !== idx);
    wbVisionMemory.scenes.push({ idx, labels });
    while (wbVisionMemory.scenes.length > wbVisionMemory.max) wbVisionMemory.scenes.shift();
  }
  function wbVisionStyleContext() {
    if (!wbVisionMemory.scenes.length) return '';
    return 'For cross-scene visual consistency, previously outlined scenes used these Vietnamese labels: ' +
      wbVisionMemory.scenes.map((x) => 'scene ' + (x.idx + 1) + ': ' + x.labels.join(', ')).join(' | ') +
      '. Reuse the SAME Vietnamese label wording when the same object appears again. ';
  }
  /* Lượt 2 — tự kiểm: image + JSON lượt 1 → {"verdict":"ok"} hoặc
     {"verdict":"fix","regions":[…]} (cùng hợp đồng regions lượt 1). */
  function wbAiVisionSelfCheckPrompt(firstJson) {
    return 'You already outlined this image. The first attempt produced this JSON:\n' +
      JSON.stringify(firstJson) + '\n' +
      'Look at the image again and VERIFY every polygon: correct labels (Vietnamese, matching visible objects), ' +
      'polygons actually enclosing their object, no missing major object, no points outside the image, ' +
      'normalized 0-1000 coordinates. If everything is correct return ONLY {"verdict":"ok"}. ' +
      'Otherwise return ONLY {"verdict":"fix","regions":[{"label":"…","points":[[x,y],…]},…]} ' +
      '(full corrected list, background to foreground, same format as the first attempt). JSON only — no explanations, no markdown.';
  }
  async function wbAiVisionSelfCheck(img, firstJson) {
    if (!wbVisionSelfCheckEnabled()) { log('ℹ vòng tự kiểm đang tắt (' + WB_VISION_SELF_CHECK_TOGGLE + "=0) — dùng kết quả lượt 1"); return firstJson; }
    log('🤖 Antigravity tự kiểm: nhìn lại ảnh lần 2 để xác minh khoanh vùng lượt 1…');
    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { media_type: img.mediaType, data: img.data } },
        { type: 'text', text: wbAiVisionSelfCheckPrompt(firstJson) },
      ],
    }];
    let second = null;
    try {
      second = await wbAiVisionJson(wbAiVisionSelfCheckPrompt(firstJson), messages, (o) => {
        if (!o || (o.verdict !== 'ok' && o.verdict !== 'fix')) throw new Error('self-check thiếu verdict ok/fix');
        if (o.verdict === 'fix') {
          if (!Array.isArray(o.regions) || !o.regions.length) throw new Error('self-check verdict fix nhưng thiếu regions');
          o.regions.forEach((r, i) => {
            if (!r || !Array.isArray(r.points) || r.points.length < 3) throw new Error('self-check regions[' + i + '] thiếu points');
          });
        }
        return o;
      });
    } catch (e) {
      /* Degrade CÓ KHAI BÁO (Luật 10): lượt 2 không trả lời được → giữ lượt 1,
         ghi rõ vào log — không nuốt lỗi ngầm, không sửa kết quả im lặng. */
      log('⚠ vòng tự kiểm lỗi (' + String((e && e.message) || e) + ') — GIỮ kết quả lượt 1 (khai báo: self-check unavailable)');
      return firstJson;
    }
    if (second.verdict === 'fix' && Array.isArray(second.regions) && second.regions.length) {
      log('🔁 Antigravity tự kiểm phát hiện sai → nhận bản sửa lượt 2 (' + second.regions.length + ' vùng)');
      return { regions: second.regions };
    }
    log('✓ Antigravity tự kiểm: khoanh vùng lượt 1 đạt — giữ nguyên');
    return firstJson;
  }
  /* Kế hoạch hiển thị (plan artifact) — log kế hoạch đầu vòng + tick tiến độ. */
  const wbVisionPlan = {
    steps: [],
    reset(title, steps) {
      this.steps = steps.map((label) => ({ label, done: false }));
      log('📋 ' + title + ' — kế hoạch ' + this.steps.length + ' bước:');
      this.steps.forEach((s, i) => log('   ' + (i + 1) + '. ' + s.label));
    },
    mark(i) {
      if (!this.steps[i]) return;
      this.steps[i].done = true;
      const done = this.steps.filter((s) => s.done).length;
      log('📋 kế hoạch ' + done + '/' + this.steps.length + ' ✓ — ' + this.steps[i].label);
    },
  };

  /* lõi vision cho 1 cảnh — dùng chung cho nút 🎯 AI khoanh vùng và
  /* lõi vision cho 1 cảnh — dùng chung cho nút 🎯 AI khoanh vùng và
     luồng auto 🤖 AI sinh ảnh theo câu. s.image + s.canvas phải có. */
  async function wbAiRegionsCore(s) {
    log('🎯 AI vision đang nhìn: ' + s.image.split(/[\\/]/).pop() +
      (s.objects && s.objects.length ? ' (vật thể theo lời thoại: ' + s.objects.map((o) => o.label).join(', ') + ')' : ''));
    const img = await wbAiDataUrl(s.image, 896);
    const focus = (Array.isArray(s.objects) && s.objects.length)
      ? 'The narration of this scene mentions these objects: ' + s.objects.map((o) => o.label).join(', ') +
        '. Prioritize outlining THOSE objects if visible (labels in that order), plus at most a couple of essential others. '
      : '';
    const prompt = 'You are looking at ONE image that will be redrawn as a hand-drawn animation. ' +
      'Detect the 2-6 most important visual objects/subjects of the image (not the whole image, no tiny details, no text lines). ' +
      focus +
      wbVisionStyleContext() +
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
    let out = await wbAiVisionJson(prompt, messages, (o) => {
      if (!o || !Array.isArray(o.regions) || !o.regions.length) throw new Error('AI thiếu mảng regions');
      o.regions.forEach((r, i) => {
        if (!r || !Array.isArray(r.points) || r.points.length < 3) throw new Error('regions[' + i + '] thiếu points');
      });
      return o;
    });
    /* vòng tự kiểm 1 vòng (Antigravity thật tự verify) — fix thì thay, lỗi thì khai báo giữ lượt 1 */
    out = await wbAiVisionSelfCheck(img, out);
    const built = [];
    out.regions.forEach((r, i) => {
      const e2 = wbAiRegionToElement(r, built.length, s);
      if (e2) built.push(e2);
      else log('⚠ vùng AI ' + (i + 1) + ' points không dùng được — bỏ qua');
    });
    if (!built.length) throw new Error('AI không trả vùng nào dùng được');
    s.elements = built;
    s.previewPath = null;
    s.elementsDirty = false;
    wbAiScheduleReveal(built, s);
    /* ghi nhớ nhãn cảnh này cho các cảnh sau (nhất quán tên vật thể giữa các câu) */
    wbVisionRemember(state.scenes.indexOf(s), built.map((e2) => e2.label));
    log('🎯 AI khoanh ' + built.length + ' vùng: ' + built.map((e2) => e2.label).join(' · ') +
      (Array.isArray(s.objects) && s.objects.length === built.length ? ' — giờ vẽ theo share nhịp kể' : ' — giờ vẽ chia đều (objects không khớp số vùng)'));
    return built;
  }

  /* ════════ 3 · SINH ẢNH TỰ ĐỘNG THEO CÂU (Flow) ════════ */
  /* Trọn luồng: prompt cho câu còn thiếu → Flow sinh ảnh line-art từng
     câu → lưu + gán đúng khung thời gian SRT → AI vision khoanh vùng +
     giờ vẽ theo nhịp kể. TÁI DÙNG engine Flow của tab Tạo Ảnh Hàng Loạt
     (flowBridge + tfDispatchGen + tfEnsureProject + tfCfg — global của
     index.html, panel này chạy trong cùng trang). KHÔNG chế kênh mới. */

  const _wbQuotaRe = /429|QUOTA|EXHAUSTED|hết lượt|hết quota|hết giới hạn|ALL_ACCOUNTS/i;
  const _wbSoftRe = /FILTER|SAFETY|PROMINENT|UNAUTHENT|API_401|MODEL_ACCESS/i;
  const _wbTrafficRe = /TOO_MUCH_TRAFFIC|UNUSUAL_ACTIVITY|reCAPTCHA|RATE_?LIMIT|\b429\b|invalid authentication|login cooki/i;
  const wbAiSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function wbAiGenEngine() {
    if (typeof flowBridge === 'undefined' || flowBridge === null ||
        typeof tfDispatchGen !== 'function' || typeof tfEnsureProject !== 'function') {
      throw new Error('thiếu engine Flow (flowBridge/tfDispatchGen) — panel phải chạy trong index.html của app');
    }
  }

  async function wbAiGenStatus() {
    if (!(await flowBridge.waitReady(1500))) throw new Error('chưa kết nối Flow');
    const st = await flowBridge.call('GET_STATUS');
    if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))) {
      throw new Error('chưa đăng nhập Flow — mở tab "Tạo Ảnh Hàng Loạt" để thêm/đăng nhập tài khoản rồi thử lại');
    }
    return st;
  }

  async function wbAiGenSave(dataUrl, idx, opts) {
    const o = opts || {};
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('phản hồi Flow không có ảnh đọc được (thiếu dataUrl)');
    let dir = '';
    try { dir = localStorage.getItem('av_save_dir') || ''; } catch (e) {}
    if (!dir) {
      if (!window.native || typeof window.native.pickFolder !== 'function') {
        throw new Error('chưa có thư mục lưu ảnh — chọn "Lưu về máy" ở Dashboard hoặc cho phép chọn thư mục');
      }
      const r = await window.native.pickFolder();
      if (!r || !r.path) throw new Error('chưa chọn thư mục lưu ảnh');
      dir = r.path;
      try { localStorage.setItem('av_save_dir', dir); } catch (e) {}
    }
    const ext = ((m[1] || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
    const name = 'cau-' + String(idx + 1).padStart(3, '0') + '.' + ext;
    const sv = await window.native.saveFile({ dir, subdir: o.subdir || 'whiteboard-anh', name, base64: m[2] });
    if (!sv || !sv.path) throw new Error('lưu ảnh lỗi: ' + ((sv && sv.error) || 'không rõ'));
    /* metadata gắn ngầm vào ảnh (cau-NNN.json cạnh cau-NNN.png): prompt + text +
       khung thời gian SRT + objects + cấu hình Flow — để "📥 Gọi lại ảnh" dựng
       lại timeline mà không cần chạy lại phân tích. Ghi lỗi → KHÔNG nuốt: log ⚠
       khai báo rõ (Luật 10) nhưng vẫn giữ ảnh đã lưu. */
    if (o.meta) {
      try {
        o.meta.image = sv.path;   // đường dẫn ảnh thật (dir có thể từ pickFolder)
        const json = JSON.stringify(o.meta, null, 2);
        const u = new TextEncoder().encode(json);
        let bin = '';
        u.forEach((c) => { bin += String.fromCharCode(c); });
        const jw = await window.native.saveFile({
          dir, subdir: o.subdir || 'whiteboard-anh',
          name: 'cau-' + String(idx + 1).padStart(3, '0') + '.json',
          base64: btoa(bin),
        });
        if (!jw || !jw.path) throw new Error((jw && jw.error) || 'không rõ');
      } catch (e2) {
        log('⚠ metadata câu ' + (idx + 1) + ' chưa ghi được (ảnh vẫn đã lưu): ' + String((e2 && e2.message) || e2));
      }
    }
    return sv.path;
  }

  /* gen 1 ảnh + retry lỗi mềm (giống tfGenScenes: mềm ≤2 lần, bị chặn traffic ≤3 lần) */
  async function wbAiGenOne(prompt, ctx) {
    let e0 = null, err = '', rotated = null;
    for (let att = 0; ; att++) {
      const r = await tfDispatchGen(prompt, [], ctx);
      e0 = ((r && r.media_entries) || []).find((e) => e && e.dataUrl) || null;
      err = (r && r.error) || (!e0 ? 'phản hồi không có ảnh' : '');
      rotated = (r && r.rotated) || null;
      if (e0) break;
      const soft = !_wbQuotaRe.test(err) && !_wbSoftRe.test(err);
      const traffic = _wbTrafficRe.test(err);
      if (!soft || att >= (traffic ? 3 : 2)) break;
      const wait = traffic ? (6000 + att * 4000) : 1500;
      log('↻ lỗi mềm (' + String(err).slice(0, 140) + ') → nghỉ ' + Math.round(wait / 1000) + 's rồi thử lại lần ' + (att + 1));
      await wbAiSleep(wait);
    }
    return { e0, err, rotated };
  }

  window.wbStudioAi = { wbAiPrompts, wbAiGenImages, wbAiRegionsCore, wbAiScheduleReveal, wbAnalyzePrompt, wbArrangeRegions, wbAiVisionJson, wbAcUserSource, wbAiVisionSelfCheck, wbAiVisionSelfCheckPrompt, wbVisionSelfCheckEnabled, wbVisionMemory, wbVisionRemember, wbVisionStyleContext, wbVisionPlan, wbRecallImages };

  /* ════════ 2b · SẮP XẾP DỮ LIỆU (Bước 4 của luồng 6 bước) ════════
     Nút "🗺 Sắp xếp dữ liệu": AI vision khoanh vùng TẤT CẢ cảnh có ảnh.
     Giờ vẽ (start/duration) do wbAiScheduleReveal phân bổ — neo theo khung
     thời lượng câu (startMs/endMs từ SRT ở Bước 3) nên giờ vẽ khớp đúng
     thời lượng đọc từng câu. Cảnh thiếu ảnh → lỗi lộ liễu từng cụm
     (WB_ARRANGE_NO_IMAGE), KHÔNG bỏ qua ngầm (Luật 10). */
  async function wbArrangeRegions() {
    if (!state.scenes.length) { log('[WB_LOI] WB_NO_SCENES — chưa có cảnh nào. Bấm "🧠 Phân tích prompt" ở Bước 3 trước.'); return; }
    if (typeof callLLMJson !== 'function') { log('⚠ chưa có bộ gọi AI (callLLMJson) — chạy panel trong app Nova'); return; }
    const missing = [];
    state.scenes.forEach((s, i) => { if (!s.image || !s.canvas) missing.push(i + 1); });
    if (missing.length) {
      log('[WB_LOI] WB_ARRANGE_NO_IMAGE — ' + missing.length + '/' + state.scenes.length + ' cảnh chưa có ảnh (câu: ' + missing.join(', ') + '). Hoàn tất "🖼 AI sinh ảnh theo prompt (Flow)" hoặc gán ảnh tay ở Bước 3 trước.');
      return;
    }
    const btn = document.getElementById('wb-arrangeBtn');
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; }
    let ok = 0; const errs = [];
    try {
      /* kế hoạch hiển thị (Antigravity thật luôn có task list) — mỗi cảnh 1 bước: nhìn → khoanh → tự kiểm → nhớ */
      wbVisionPlan.reset('🗺 Sắp xếp dữ liệu (AI vision ' + state.scenes.length + ' cảnh)', state.scenes.map((s, i) =>
        'Câu ' + (i + 1) + ' — nhìn ảnh → khoanh vùng → tự kiểm lượt 2 → ghi nhớ nhãn'));
      for (let i = 0; i < state.scenes.length; i++) {
        const s = state.scenes[i];
        if (btn) btn.textContent = '🗺 AI đang sắp xếp cảnh ' + (i + 1) + '/' + state.scenes.length + '…';
        try {
          await wbAiRegionsCore(s);
          ok++;
          wbVisionPlan.mark(i);
        } catch (err) {
          errs.push('câu ' + (i + 1) + ': ' + String((err && err.message) || err));
        }
      }
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
      C.renderSceneList(); C.renderSceneDetail();
    }
    log('━━━ Sắp xếp dữ liệu xong: ' + ok + '/' + state.scenes.length + ' cảnh có vùng vẽ khớp khung thời lượng câu ━━━');
    if (errs.length) log('❌ ' + errs.length + ' cảnh lỗi (lộ liễu, sửa rồi bấm lại): ' + errs.join(' | '));
  }

  async function wbAiGenImages() {
    if (!state.scenes.length) { log('⚠ chưa có cảnh — bấm "🧩 Chia theo câu (SRT)" trước'); return; }
    if (typeof callLLMJson !== 'function') { log('⚠ chưa có bộ gọi AI (callLLMJson) — chạy panel trong app Nova'); return; }
    try {
      wbAiGenEngine();
      const st = await wbAiGenStatus();
      /* (a) prompt cho câu còn thiếu */
      const targets = state.scenes.map((s, idx) => ({ s, idx })).filter((x) => x.s.text && x.s.text.length > 3);
    if (!targets.length) { log('⚠ cảnh nào cũng chưa có lời thoại (text) — cần SRT/kịch bản trước'); return; }
      const needP = targets.filter((x) => !x.s.imagePrompt);
      if (needP.length) {
        log('🤖 AI sinh prompt cho ' + needP.length + ' câu chưa có prompt…');
        await wbAiPromptCore(needP);
      }
      const units = targets.filter((x) => x.s.imagePrompt);
      if (!units.length) { log('⚠ không có câu nào có prompt ảnh — AI prompt lỗi?'); return; }
      const gen = units.filter((x) => !x.s.image);
      const skipN = units.length - gen.length;
      if (skipN) log('ℹ bỏ qua ' + skipN + ' câu đã có ảnh (xoá ảnh của cảnh để tạo lại)');
      if (!gen.length) { log('✓ tất cả câu đã có ảnh — không tạo thêm'); return; }

        /* (b) cấu hình Flow — model/quality theo tab Tạo Ảnh, ép 16:9 khớp canvas 1280×720;
           multi-account → POOL round-robin, 1 account → project riêng (giống tfGenScenes) */
      const cfg = (typeof tfCfg === 'function') ? tfCfg() : { model: '', aspect: '16:9', quality: '', conc: 2, delay: 0 };
      cfg.kind = 'image';
      cfg.aspect = '16:9';
      const multi = flowBridge.mode === 'extension' ? (st.accountCount || 0) >= 1 : (st.accountCount || 0) > 1;
      let projectId = null;
      if (multi) await flowBridge.call('POOL_RESET');
      else projectId = await tfEnsureProject();
      const ctx = { multi, cfg, imgMap: {}, projectId, tier: st.paygateTier };
      /* thư mục riêng theo profile: <lưu>/whiteboard-anh/<tên bản TTS> (Bước 2).
         Chưa nhận TTS → chay-<timestamp>. Giữ nguyên trong phiên để gen tiếp/
         retry vào đúng thư mục đó; đổi TTS → tự sang thư mục mới. */
      if (state.wbImgGroupFor !== (state.ttsName || '')) {
        const base = String(state.ttsName || '').trim();
        state.wbImgGroup = base ? base.replace(/[/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
        state.wbImgGroupFor = state.ttsName || '';
        if (!state.wbImgGroup) state.wbImgGroup = null;
      }
      if (!state.wbImgGroup) state.wbImgGroup = 'chay-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      const wbSubdir = 'whiteboard-anh/' + state.wbImgGroup;
      const wbMetaOf = (s, idx) => ({
        v: 1, scene: idx + 1, profile: state.wbImgGroup,
        text: s.text || '', imagePrompt: s.imagePrompt || '',
        startMs: s.startMs || 0, endMs: s.endMs || 0,
        objects: Array.isArray(s.objects) ? s.objects : [],
        cfg: { model: cfg.model || '', aspect: cfg.aspect || '16:9', quality: cfg.quality || '' },
        image: '', createdAt: new Date().toISOString(),
      });
      const conc = multi ? Math.max(1, st.accountCount) : Math.max(1, cfg.conc || 2);
        log('🖼 Flow bắt đầu tạo ' + gen.length + ' ảnh' + (multi ? ' (⚡ ' + st.accountCount + ' tài khoản, ' + conc + ' luồng)' : (' · ' + conc + ' luồng')) + ' → ' + wbSubdir + '…');

        /* (c)+(d) pool đơn giản: mỗi câu — gen → lưu → gán → AI khoanh vùng */
      let i = 0;
      const runner = async () => {
        while (i < gen.length) {
          const my = i++;
          const { s, idx } = gen[my];
          const label = 'Câu ' + (idx + 1);
          try {
              log('🖼 ' + label + ' [' + ((s.startMs || 0) / 1000).toFixed(1) + 's → ' + ((s.endMs || 0) / 1000).toFixed(1) + 's] gửi prompt → Flow đang tạo…');
            const { e0, err, rotated } = await wbAiGenOne(String(s.imagePrompt), ctx);
              if (Array.isArray(rotated)) for (const ex of rotated) log('⚠ ' + ex + ' hết lượt → chuyển tài khoản');
            if (!e0) throw new Error(err || 'Flow không trả ảnh');
            const path = await wbAiGenSave(e0.dataUrl, idx, { subdir: wbSubdir, meta: wbMetaOf(s, idx) });
            await C.setImageForScene(idx, path);
              if (!s.canvas) throw new Error('ảnh lưu xong nhưng không đọc được kích thước');
            await wbAiRegionsCore(s);
            done++;
              log('✓ ' + label + ' xong: ảnh gán đúng khung thời gian + vùng vẽ theo nhịp kể (' + path.split(/[\\/]/).pop() + ')');
          } catch (e2) {
            failed++;
            const msg = String((e2 && e2.message) || e2);
              log((_wbQuotaRe.test(msg) ? '⚠ ' : '❌ ') + label + ' · ' + msg +
                (_wbQuotaRe.test(msg) ? ' (tài khoản hết lượt — thêm account Flow ở Tạo Ảnh Hàng Loạt hoặc thử lại sau)' : ''));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, gen.length) }, runner));
      log('━━━ Sinh ảnh xong: ' + done + '/' + gen.length + ' câu' + (failed ? ' · ' + failed + ' lỗi' : '') + ' ━━━');
      if (failed) log('\u2139 ch\u1ea1y l\u1ea1i B\u01b0\u1edbc 3 (Ph\u00e2n t\u00edch prompt) \u0111\u1ec3 T\u1ea0O TI\u1ebeP c\u00e1c c\u00e2u c\u00f2n thi\u1ebfu (c\u00e2u \u0111\u00e3 c\u00f3 \u1ea3nh \u0111\u01b0\u1ee3c gi\u1eef nguy\u00ean)');
    } catch (err) {
      log('❌ AI sinh ảnh lỗi: ' + String((err && err.message) || err));
    } finally {
      C.renderSceneList(); C.renderSceneDetail();
    }
  }

  /* ════════ 3b · GỌI LẠI ẢNH ĐÃ GEN (metadata cau-NNN.json) ════════
     Nút "📥 Gọi lại ảnh": chọn thư mục whiteboard-anh/<profile> → đọc JSON
     metadata ghi kèm lúc gen (prompt + text + startMs/endMs + objects + ảnh) →
     gán lại vào cảnh hiện có, hoặc DỰNG LẠI toàn bộ cảnh khi panel vừa reload
     (không cần chạy lại TTS/phân tích). Cảnh dựng lại có cues rỗng (khai báo)
     — timing dùng startMs/endMs từ metadata nên Bước 4 sắp xếp timeline bình
     thường. Metadata thiếu/hỏng → lỗi lộ liễu từng câu (Luật 10). */
  function wbRecallReadJson(r) {
    if (!r || r.error || !r.dataUrl) throw new Error((r && r.error) ? String(r.error) : 'read-file-b64 không trả dữ liệu');
    const k = r.dataUrl.indexOf('base64,');
    if (k < 0) throw new Error('read-file-b64 thiếu base64');
    const bin = atob(r.dataUrl.slice(k + 7));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function wbRecallJoin(dir, name) {
    return dir.replace(/[\\/]+$/, '') + '\\' + name;
  }
  function wbRecallApplyMeta(s, meta) {
    if (typeof meta.imagePrompt === 'string' && meta.imagePrompt.trim()) s.imagePrompt = meta.imagePrompt.trim();
    if (Number(meta.startMs) > 0 && Number(meta.endMs) > Number(meta.startMs)) {
      s.startMs = Math.round(meta.startMs);
      s.endMs = Math.round(meta.endMs);
      s.durationMs = Math.max(500, s.endMs - s.startMs);
      s.durationSec = s.durationMs / 1000;
    }
    if (Array.isArray(meta.objects) && meta.objects.length) s.objects = wbAiNormalizeShares(meta.objects);
  }
  async function wbRecallImages() {
    if (!window.native || typeof window.native.pickFolder !== 'function' || typeof window.native.readFileB64 !== 'function') {
      log('⚠ thiếu IPC chọn thư mục/đọc file — chạy panel trong app Nova'); return;
    }
    const r = await window.native.pickFolder();
    if (!r || !r.path) return;
    const dir = r.path;
    const readMeta = async (i) => {
      const f = wbRecallJoin(dir, 'cau-' + String(i + 1).padStart(3, '0') + '.json');
      try { return wbRecallReadJson(await window.native.readFileB64(f)); }
      catch (e) { log('❌ câu ' + (i + 1) + ': không đọc được metadata ' + f + ' — ' + String((e && e.message) || e)); return null; }
    };
    try {
      /* (a) đang có cảnh trong phiên → bơm metadata theo đúng số câu */
      if (state.scenes.length) {
        let ok = 0;
        for (let i = 0; i < state.scenes.length; i++) {
          const meta = await readMeta(i);
          if (!meta) continue;
          wbRecallApplyMeta(state.scenes[i], meta);
          if (meta.image) await C.setImageForScene(i, meta.image);
          ok++;
          log('✓ gọi lại câu ' + (i + 1) + ' — prompt + khung ' + ((state.scenes[i].startMs || 0) / 1000).toFixed(1) + 's → ' + ((state.scenes[i].endMs || 0) / 1000).toFixed(1) + 's' + (meta.image ? ' + ảnh' : ' (chưa có ảnh)'));
        }
        log('━━━ Gọi lại xong: ' + ok + '/' + state.scenes.length + ' câu ━━━');
        return;
      }
      /* (b) chưa có cảnh (reload/panel mới) → dựng lại tuần tự tới khi thiếu metadata */
      const built = [];
      for (let i = 0; ; i++) {
        const meta = await readMeta(i);
        if (!meta) break;
        const startMs = Math.max(0, Math.round(Number(meta.startMs) || 0));
        const endMs = Math.max(startMs + 500, Math.round(Number(meta.endMs) || 0));
        built.push({
          sceneId: 'scene-' + String(i + 1).padStart(2, '0'),
          startMs, endMs,
          durationMs: Math.max(500, endMs - startMs),
          durationSec: Math.max(500, endMs - startMs) / 1000,
          text: String(meta.text || ''),
          cues: [],   // metadata không chứa cue SRT — timing dùng startMs/endMs (khai báo)
          image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
        });
        wbRecallApplyMeta(built[i], meta);
        if (meta.image) await C.setImageForScene(i, meta.image);
        log('✓ dựng lại câu ' + (i + 1) + ' — ' + ((endMs - startMs) / 1000).toFixed(1) + 's' + (meta.image ? ' + ảnh' : ' (chưa có ảnh)'));
      }
      if (!built.length) { log('❌ WB_RECALL_EMPTY — không đọc được metadata nào trong thư mục đã chọn (cần thư mục whiteboard-anh/<profile> do "🖼 Gen ảnh" tạo).'); return; }
      state.scenes = built;
      state.selected = 0;
      log('━━━ Gọi lại xong: dựng lại ' + built.length + ' cảnh từ metadata (cues rỗng — timing theo metadata; Bước 4 sắp xếp timeline bình thường) ━━━');
      if (typeof C.showGenImagesBtn === 'function') C.showGenImagesBtn();
    } finally {
      C.renderSceneList(); C.renderSceneDetail();
    }
  }

  /* ── boot: panel lazy-mount → chờ nút xuất hiện (MutationObserver) ── */
  function boot() {
    /* Luồng 6 bước rút gọn: Bước 3 chỉ còn "Phân tích prompt" (chuỗi đầy đủ
       tách câu + SRT + prompt + Flow sinh ảnh + khoanh vùng), Bước 4 chỉ còn
       "Sắp xếp dữ liệu". Các nút AI rời (prompt/gen/khoanh vùng đơn) đã gỡ. */
    const b4 = document.getElementById('wb-analyzePromptBtn');
    const b5 = document.getElementById('wb-arrangeBtn');
    const bGen = document.getElementById('wb-genImagesBtn');
    const bRecall = document.getElementById('wb-recallImagesBtn');
    if (bGen && !bGen.dataset.wbAiBound) { bGen.dataset.wbAiBound = '1'; bGen.addEventListener('click', wbAiGenImages); }
    if (bRecall && !bRecall.dataset.wbAiBound) { bRecall.dataset.wbAiBound = '1'; bRecall.addEventListener('click', wbRecallImages); }
    if (b4 && !b4.dataset.wbAiBound) { b4.dataset.wbAiBound = '1'; b4.addEventListener('click', wbAnalyzePrompt); }
    if (b5 && !b5.dataset.wbAiBound) { b5.dataset.wbAiBound = '1'; b5.addEventListener('click', wbArrangeRegions); }
    return !!(b4 && b5 && bGen && bRecall);
  }
  if (!boot()) {
    const mo = new MutationObserver(() => { if (boot()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
