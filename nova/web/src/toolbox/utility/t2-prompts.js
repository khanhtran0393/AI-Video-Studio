/* T2 PROMPTS — doSplit/doPrescan/doAssign, buildSceneGenPrompt, prompt B, doGenerateScenePrompts
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function doSplit(){
  syncTool2();
  const txt = state.script.trim();
  if (!txt) return setStatus2('Cần kịch bản.', 'error');
  setStatus2('Đang chia cảnh...', 'working');
  try {
    let scenes;
    if (state.splitMode === 'smart') {
      scenes = await splitScenesSmart(txt, state.minChars, state.maxChars);
    } else {
      scenes = splitScenesFast(txt, state.minChars, state.maxChars);
    }
    state.scenes = scenes.map((s, i) => ({
      id: String(i + 1).padStart(3, '0'),
      text: s,
      level: 'L1',
      character: '',
      background: '',
      camera: 'medium',
      duration: calcDur(s),
      userEdited: false,
      promptSeed: s.slice(0, 80),
      seedAt: Date.now()
    }));
    // Cap số cảnh theo tier
    const maxScenes = getMaxScenes();
    let trimmedNotice = '';
    if (state.scenes.length > maxScenes) {
      const cut = state.scenes.length - maxScenes;
      state.scenes = state.scenes.slice(0, maxScenes);
      trimmedNotice = ` (Đã cắt ${cut} cảnh vượt giới hạn gói Free — nâng cấp Pro để mở khoá)`;
      // Show upgrade modal sau 500ms để user kịp đọc status
      setTimeout(() => showGate(`Kịch bản chia ra ${maxScenes + cut} cảnh, nhưng gói Free chỉ giữ ${maxScenes}. Nâng cấp Pro để dùng không giới hạn.`), 500);
    }
    state.scenePrompts = {};
    state.scenePrompts2 = {};
    renderAllT2();
    setStatus2(`✓ Đã chia thành ${state.scenes.length} cảnh.${trimmedNotice}`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doPrescan(){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const p = getProfile();
  if (!p) return setStatus2('Cần tạo Profile trước.', 'error');

  setStatus2('AI đang quét nhân vật & bối cảnh...', 'working');
  const bibleMode = (state.descMode === 'inline_bible');
  try {
    const allText = state.scenes.map(s => s.text).join(' ');
    const prompt = bibleMode
      ? `Read the entire script and list the (human) CHARACTERS + (location) SETTINGS that will appear, WITH fixed appearance descriptions to keep them consistent.

Rules:
- Names: English kebab-case (e.g.: protagonist-young, hospital-room).
- "desc": a FIXED appearance description IN ENGLISH (characters: age, gender, outfit+colors, hair, traits; settings: type of place, objects, lighting, palette). 15-30 words. This gets inserted into EVERY scene using that character/setting, so it must be detailed enough + consistent.
- List EVERY HUMAN character DRAWN in ≥2 scenes → give each a slug (for a reference image, keeping the FACE consistent): main characters, RECURRING side characters, and even the "viewer" in a like-subscribe call-to-action IF the script shows a viewer scene. People appearing only ONCE are NOT listed (described inline in the prompt instead). Max 10 characters, 8 settings.

Script:
"""
${allText.slice(0, 8000)}
"""

Return ONLY JSON:
{"characters":[{"name":"...","desc":"..."}],"backgrounds":[{"name":"...","desc":"..."}]}`
      : `Read the entire script and list the (human) CHARACTERS + (location) SETTINGS that will appear.

Naming rules:
- Characters: English kebab-case, a short role + trait description (e.g.: protagonist-young, narrator, agent-male, victim-female)
- Settings: English kebab-case, a place description (e.g.: dark-office-night, kitchen-interior, hospital-room)
- List EVERY HUMAN character DRAWN in ≥2 scenes (needs a consistent FACE → give a slug): main characters, RECURRING side characters, and even the "viewer" in a like-subscribe call-to-action IF there is a viewer scene. People appearing only ONCE → NOT listed (described inline). Animals are not listed (described directly in the scene prompt).
- Max 10 characters, 8 settings.

Script:
"""
${allText.slice(0, 8000)}
"""

Return ONLY JSON:
{"characters": ["name1", "name2"], "backgrounds": ["bg1", "bg2"]}`;
    const maxTok = bibleMode ? 1500 : 800;
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có ít nhất 1 mảng characters/backgrounds
    const data = await callLLMJson(prompt, {
      maxTokens: maxTok,
      validate: d => d && typeof d === 'object' && (Array.isArray(d.characters) || Array.isArray(d.backgrounds))
    });
    if (bibleMode) {
      state.charBible = {}; state.bgBible = {};
      state.charactersV = (data.characters || []).map(c => {
        const name = typeof c === 'string' ? c : c.name;
        if (c.desc) state.charBible[name] = c.desc;
        return name;
      });
      state.backgroundsV = (data.backgrounds || []).map(b => {
        const name = typeof b === 'string' ? b : b.name;
        if (b.desc) state.bgBible[name] = b.desc;
        return name;
      });
    } else {
      state.charactersV = (data.characters || []).map(c => typeof c === 'string' ? c : c.name);
      state.backgroundsV = (data.backgrounds || []).map(b => typeof b === 'string' ? b : b.name);
    }
    // Bỏ nhân vật GHÉP + QUẦN CHÚNG khỏi danh sách (mỗi người 1 sheet, không tạo sheet cho quần chúng).
    if (typeof _isComboName === 'function') state.charactersV = (state.charactersV || []).filter(n => n && !_isComboName(n) && !_isCrowdName(n));
    if (typeof _isCrowdName === 'function') state.backgroundsV = (state.backgroundsV || []).filter(n => n && !_isCrowdName(n));
    { const ci = document.getElementById('charsInputV'); if (ci) ci.value = state.charactersV.join('\n'); }
    { const bi = document.getElementById('bgInputV'); if (bi) bi.value = state.backgroundsV.join('\n'); }
    renderStats2();
    setStatus2(`✓ Tìm thấy ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.` + (bibleMode ? ' Đã tạo hồ sơ mô tả.' : ''), 'ok');
    saveState();
    return state.charactersV.length + state.backgroundsV.length;   // >0 = quét được, để Auto biết
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi quét nhân vật/bối cảnh: ' + e.message, 'error');
    return 0;   // lỗi → trả 0 để Auto retry / không âm thầm bỏ Gán
  }
}

async function doAssign(only){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus2('Cần Quét Trước nhân vật/bối cảnh trước.', 'error');

  // only = danh sách cảnh CẦN gán lại (vd cảnh trống sau lần Gán đầu).
  // DeepSeek trả KHÁC NHAU mỗi lần → TÍCH LUỸ: chỉ gán cảnh CHƯA có gì, GIỮ NGUYÊN cảnh đã gán
  // (tránh bấm lại bị nhảy kết quả / xoá mất cảnh đã đúng). Provider khác (Claude/OpenAI) ổn định → gán tất như cũ.
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const isDeepSeek = provider === 'deepseek';
  const needsAssign = s => !s.character && !s.background;
  const isFullCall = !(Array.isArray(only) && only.length);
  const pool = !isFullCall ? only : (isDeepSeek ? state.scenes.filter(needsAssign) : state.scenes);
  if (!pool.length) { setStatus2('✓ Mọi cảnh đã có nhân vật/bối cảnh — không cần gán lại.', 'ok'); return; }
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  setStatus2('AI đang gán nhân vật + bối cảnh...', 'working');
  clearCancel();
  const charList = state.charactersV.map(c => '- ' + c).join('\n') || '(không có)';
  const bgList   = state.backgroundsV.map(b => '- ' + b).join('\n') || '(không có)';
  const CAM = ['wide', 'medium', 'close', 'over-shoulder', 'pov'];
  // Chỉ nhận tên KHỚP danh sách (khớp đúng, hoặc gần đúng kiểu chứa nhau) — chống AI bịa tên
  const matchInList = (name, list) => {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return '';
    const exact = list.find(x => x.toLowerCase() === n);
    if (exact) return exact;
    return list.find(x => { const lx = x.toLowerCase(); return lx.includes(n) || n.includes(lx); }) || '';
  };
  const buildAssignPrompt = (batch) => `Assign a character + setting + camera angle to each scene.

CHARACTER LIST (you may only pick EXACTLY 1 name from here, or "" if the scene has no people):
${charList}

SETTING LIST (you may only pick EXACTLY 1 name from here, or "" if unclear):
${bgList}

Rules:
- character / background: MUST be a name exactly as in the lists above, or "" — do NOT invent new names.
- camera: wide | medium | close | over-shoulder | pov
- level: L1 | L2 | L3 | L4

Return ONLY 1 JSON object, keyed by scene id:
{"001":{"character":"...","background":"...","camera":"medium","level":"L1"}, "002":{...}}

THE SCENES:
${batch.map(s => `[${s.id}] "${s.text}"`).join('\n')}`;

  // Chuẩn hoá kết quả về dạng { id: {character,background,camera,level} } dù AI trả object hay array
  const normalize = (parsed) => {
    const o = {};
    if (Array.isArray(parsed)) { for (const x of parsed) if (x && x.id) o[String(x.id).padStart(3, '0')] = x; }
    else if (parsed && typeof parsed === 'object') { for (const [k, v] of Object.entries(parsed)) o[String(k).padStart(3, '0')] = v || {}; }
    return o;
  };

  // 1 lượt gán cho 1 danh sách cảnh (tách ra để gọi lại ở pass 2)
  const runAssign = async (poolScenes) => {
    const lanes = _concurrency();
    const batches = [];
    for (let i = 0; i < poolScenes.length; i += bs) batches.push(poolScenes.slice(i, i + bs));
    let done = 0;
    await runConcurrent(batches, async (batch) => {
      if (state.cancelRequested) return;
      const batchIds = new Set(batch.map(s => s.id));
      // callLLMJson: lặp + ép JSON + chỉ nhận khối normalize ra ≥1 cảnh hợp lệ
      let obj = null;
      try {
        const got = await callLLMJson(buildAssignPrompt(batch), {
          maxTokens: 1500,
          validate: p => Object.keys(normalize(p)).length > 0
        });
        obj = normalize(got);
      } catch (e) { console.warn('Gán batch lỗi:', e.message); }
      if (obj) {
        for (const [id, x] of Object.entries(obj)) {
          if (!batchIds.has(id)) continue;            // chỉ ghi cho cảnh thuộc batch này
          const sc = state.scenes.find(s => s.id === id);
          if (!sc) continue;
          const mc = matchInList(x.character, state.charactersV);   // chỉ nhận tên có thật
          const mb = matchInList(x.background, state.backgroundsV);
          // DeepSeek: KHÔNG ghi đè '' lên giá trị đã có (tránh xoá nhầm cảnh đúng); provider khác gán bình thường
          if (mc || !isDeepSeek) sc.character = mc;
          if (mb || !isDeepSeek) sc.background = mb;
          sc.camera = CAM.includes(x.camera) ? x.camera : (sc.camera || 'medium');
          sc.level = /^L[1-4]$/.test(x.level) ? x.level : (sc.level || 'L1');
        }
      }
      done += batch.length;
      renderAllT2();
      setStatus2(`Gán... ${Math.min(done, poolScenes.length)}/${poolScenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    }, lanes, () => state.cancelRequested);
  };

  try {
    await runAssign(pool);
    if (state.cancelRequested) {
      clearCancel();
      setStatus2('⏸ Đã dừng. Kết quả gán được giữ lại.', 'info');
      saveState();
      return;
    }
    // 🔁 PASS 2 (chỉ DeepSeek, lần gán đầy đủ): cảnh VẪN trống → kiểm lại 1 lần nữa
    // (DeepSeek flaky: cảnh trống có thể do batch lỗi, không phải vì thật sự không có nhân vật/bối cảnh)
    if (isDeepSeek && isFullCall) {
      const still = state.scenes.filter(needsAssign);
      if (still.length && still.length < state.scenes.length) {
        setStatus2(`🔁 Kiểm lần 2: ${still.length} cảnh còn trống...`, 'working');
        clearCancel();
        await runAssign(still);
        if (state.cancelRequested) { clearCancel(); setStatus2('⏸ Đã dừng (sau kiểm lần 2). Kết quả được giữ lại.', 'info'); saveState(); return; }
      }
    }
    // Cảnh báo nếu gán được quá ít (dấu hiệu model trả rác) → khuyên đổi provider
    const withRes = state.scenes.filter(s => s.character || s.background).length;
    if (withRes < state.scenes.length * 0.15) {
      setStatus2(`⚠️ Chỉ gán được ${withRes}/${state.scenes.length} cảnh — model có thể trả JSON lỗi. Thử đổi provider sang Claude/OpenAI cho bước Gán, hoặc Quét Trước lại.`, 'info');
    } else {
      setStatus2(`✓ Đã gán xong (${withRes}/${state.scenes.length} cảnh có nhân vật/bối cảnh).`, 'ok');
    }
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function genVideoLogline(force){
  const script = (state.script || '').trim();
  if (!script) return state.videoLogline || '';
  // Chữ ký kịch bản → đổi kịch bản thì logline cũ coi như hết hạn, tự sinh lại.
  // Logline cũ còn dấu < > = rác (AI chép lại đề bài) → cũng coi là hết hạn để sinh lại.
  const sig = script.length + '|' + script.slice(0, 60);
  const looksReal = state.videoLogline && state.videoLogline.trim() && !/[<>]/.test(state.videoLogline);
  const fresh = looksReal && state.videoLoglineSig === sig;
  if (!force && fresh) return state.videoLogline;
  const p = getProfile();
  const ngach = p && p.ngach ? p.ngach : '';
  const prompt = `Read the video script below and WRITE A LOGLINE summarizing the WHOLE VIDEO (so every scene stays on topic when images are generated).
${ngach ? 'Channel niche: ' + ngach + '\n' : ''}Requirements: 2-4 sentences IN VIETNAMESE — main story/content + the recurring character + setting & era + emotional tone. Specific and concise. Do NOT list individual scenes, do NOT narrate chronologically.
⚠️ Write a REAL logline derived from the script — NEVER copy the request lines above, no < or > characters.
Correct example: {"logline":"Hành trình một cậu bé Hy Lạp cổ đại bị bán làm nô lệ sau chiến tranh, từ làng quê tới khu chợ buôn người ở thế giới cổ đại. Tông bi tráng, hoài niệm."}

Return ONLY 1 JSON object: {"logline":"..."}

SCRIPT:
"""
${script.slice(0, 6000)}
"""`;
  try {
    const o = await callLLMJson(prompt, {
      maxTokens: 400,
      // Chặn AI chép lại đề bài: phải đủ dài, không có dấu < >, không chứa cụm meta của yêu cầu
      validate: o => {
        if (!o || typeof o.logline !== 'string') return false;
        const s = o.logline.trim();
        return s.length >= 25 && !/[<>]/.test(s)
          && !/KHÔNG\s+liệt kê|nội dung\/câu chuyện|2-4 câu tiếng Việt|câu tiếng Việt:|2-4 sentences|main story\/content|recurring character/i.test(s);
      }
    });
    state.videoLogline = o.logline.trim();
    state.videoLoglineSig = sig;
    const el = document.getElementById('videoLogline');
    if (el) el.value = state.videoLogline;
    saveState();
    return state.videoLogline;
  } catch (e) {
    console.warn('genVideoLogline:', e.message);
    return state.videoLogline || '';
  }
}

function _profileStyleStr(p){
  return (((p?.sceneStyle || '') + ' ' + (p?.characterStyle || '') + ' ' + (p?.visualStyle || '') + ' ' + (p?.styleDesc || '') + ' ' + (p?.ngach || '')).toLowerCase())
    .replace(/\b(no|not|non|without|avoid|never|kh[ôo]ng)[\s-]+(3d|anime|manga|photo-?real\w*|photograph\w*|cgi|octane|water-?colou?r|line-?art|cartoon|flat-?2d|realistic|realism)\b/g, ' ');
}

function _profileMedium(p){
  const s = _profileStyleStr(p);
  const is2D = /flat.?2d|2d cartoon|2d animation|hand.?drawn|hand drawn|storybook|flat drawn|explainer.?cartoon|line.?art|stick figure|vector|doodle|whiteboard|cartoon|tranh v[ẽe]|v[ẽe] tay|ho[ạa]t h[ìi]nh/.test(s);
  const explicitPhoto = /photoreal|photo-?real|photograph|photography|film still|live.?action|real (human|people|person)|realistic skin|hyper.?real|documentary photo|[ảa]nh th[ậa]t|ng[ưu][ờo]i th[ậa]t/.test(s);
  // "realistic/tả thực" mà KHÔNG kèm chữ vẽ/tranh → coi là ảnh thật; kèm "illustration/painting" thì để Profile tự nói.
  const realish = /\brealistic|realism|lifelike|true.to.life|t[ảa] th[ựu]c/.test(s);
  const drawish = /illustration|painting|painted|drawn|drawing|sketch|comic|cartoon|tranh|v[ẽe]/.test(s);
  const isPhoto = !is2D && (explicitPhoto || (realish && !drawish));
  let medium = '';
  if (isPhoto) medium = 'a real photograph, natural realistic lighting';
  else if (!is2D && /\b3d\b|pixar|\bcgi\b|octane|stylized 3d/.test(s)) medium = 'a stylized 3D render';
  else if (/\b(anime|manga)\b/.test(s)) medium = 'anime-style illustration';
  else if (/water ?colou?r/.test(s)) medium = 'a hand-painted watercolor illustration';
  else if (/line ?[- ]?art/.test(s)) medium = 'clean line-art illustration';
  else if (is2D) medium = 'hand-drawn 2D illustration, flat drawn art';
  return { is2D, isPhoto, medium };
}

function _cleanSceneStyle(raw){
  let s = String(raw || '');
  const is2D = /flat.?2d|2d cartoon|2d animation|hand.?drawn|storybook|explainer.?cartoon|line.?art|vector|stick/i.test(s);
  if (is2D){
    s = s.replace(/[,;·—-]?\s*(a\s+)?(stylized\s+)?3d[\s-]*render[^.,;·]*/gi, '')
         .replace(/[,;·—-]?\s*pixar[- ]?(like|inspired|style|esque)?/gi, '')
         .replace(/[,;·—-]?\s*(photo-?real\w*|photograph\w*)[^.,;·]*/gi, '')
         .replace(/\s{2,}/g, ' ').replace(/\s*[—,;·-]\s*$/,'').trim();
  }
  return s;
}

function buildSceneGenPrompt(batch, prevSceneCtx, p, profileContext, neighborVO){
  const _ssClean = _cleanSceneStyle(p.sceneStyle);   // dùng thay p.sceneStyle ở các cụm aesthetic
  /* ── Cảnh dùng TƯ LIỆU CÓ SẴN phải viết kiểu khác hẳn ──────────────────
     Style profile (tông màu, chất liệu vẽ, ánh sáng dàn dựng, nhân vật khoá
     theo ảnh tham chiếu) chỉ có nghĩa khi ẢNH DO AI VẼ. Đem nguyên bộ đó đi
     tìm clip có sẵn thì hỏng cả hai đầu: không kho nào có "flat-2D teal
     palette", mà từ khoá lại bị nhấn chìm dưới đống chữ tả tông màu.
     Với cảnh có ⚑ thì "prompt" đổi vai: nó là MÔ TẢ ĐỂ ĐI TÌM, không phải
     lệnh vẽ.                                                               */
  const _coThucBatch = (Array.isArray(batch) ? batch : []).some(_laThuc);
  const luatThuc = _coThucBatch ? `

⚑ SCENES LABELED "TƯ LIỆU THẬT" (REAL FOOTAGE) — WRITE COMPLETELY DIFFERENTLY:
- These scenes do NOT get AI images. They will be filled with REAL filmed clips/photos from stock libraries.
- For those scenes, "prompt" is NOT a drawing instruction but a SEARCH DESCRIPTION: 6–14 English words, only
  CONCRETE NOUNS + REAL ACTIONS (e.g. "capuchin monkey cracking nut with stone",
  "archaeologist brushing soil at excavation trench").
- ⛔ ABSOLUTELY do NOT include: color grading, drawing style, medium (2D/3D/watercolor/render),
  staged lighting, character [slug] names, or any Style Profile wording. No stock library can
  search by color mood, and those words only dilute the keywords.
- Scenes WITHOUT the label follow all the AI-image rules below as normal.` : '';
  const _pmScene = _profileMedium(p);                 // Profile trống thì bám medium suy ra được, KHÔNG mặc định 2D
  // Công thức hình theo KIỂU CẢNH — lượt 1 chỉ chọn kiểu, lượt này mới cần công thức để viết prompt.
  const _shotRecipes = _sceneTypesOn().map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  const highDetail = T2_TUY_CHON.highDetail;
  // Hai chế độ ĐỘC LẬP: shortMode = nhân vật do ảnh reference lo (đồng nhất); highDetail = môi trường tả dày.
  // Bật CẢ HAI = nhân vật khoá theo reference + bối cảnh chi tiết.
  // Ô shortPromptMode cũng đã gỡ. Không sao: refShape bên dưới vẫn TRUE nhờ
  // descMode mặc định 'tag' → hành vi không đổi.
  const shortMode = false;
  // refShape = nhân vật do ẢNH REFERENCE gánh → prompt NGẮN, KHÔNG nhồi body-lock/NOT-list (đúng Bản 1 Nano Banana).
  // Chế độ tag ([tên-nhân-vật] + reference sheet) mặc định coi là có ref → luôn dùng shape ngắn.
  const refShape = shortMode || (state.descMode || 'tag') === 'tag';
  const noCharMode = document.getElementById('noCharMode')?.checked;
  const _brollEl = document.getElementById('brollMode');   // ô tick đã gỡ khỏi UI redesign → không có ô = BẬT (mặc định cũ)
  const brollMode = (_brollEl ? _brollEl.checked : true) || noCharMode;
  // 🧩 Style lai: cảnh kể = người que + bối cảnh, cảnh giải thích = icon nền trắng
  const hybridIconMode = T2_TUY_CHON.hybridIcon && !noCharMode;
  const hybridRule = hybridIconMode ? `
🧩 HYBRID STYLE — SPLIT INTO 2 SCENE KINDS (MANDATORY, decide by VO content):
1) STORYTELLING scenes (VO is an action/emotion/narration by a PERSON) → draw the CHARACTER (the channel's stick figures) in full SETTINGS per the Scene Style.
2) EXPLANATORY scenes (VO explains a concept / process / comparison / data / cause-effect, NOT a character's action) → draw SIMPLE line-art ICONS / PICTOGRAMS, bold black strokes, sign-like, on a PLAIN SOLID WHITE background. NO stick-figure characters, NO rooms/scenery. 1–4 icons per scene, minimal, lots of white space.
   - Prompts of this kind MUST state: "minimalist black line-art pictogram icons on a plain solid white background, no scenery, no characters, lots of negative space".
- Decide per scene from the VO. Most narrative lines → kind 1; explanatory/concept lines → kind 2.
` : '';
  // 🏺 Khoá thời đại cho prompt cảnh: ưu tiên giá trị đã đặt ở Tool 3 (state.t3Era), nếu trống → trích kịch bản
  const eraHintT2 = (state.t3Era && state.t3Era.trim())
    ? state.t3Era.trim()
    : (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const eraBlockT2 = eraHintT2
    ? `\n🏺 SETTING & ERA (applies to EVERY scene): ${eraHintT2}\n- The clothing, hair/headwear and props of EVERY character — including freely-described secondary characters, crowds, passers-by — MUST match this era/setting; no anachronistic modern items/hair. KEEP the channel's art-style/render medium (per Character/Scene Style) on every character — only adapt outfit/hair/props to the era.\n`
    : '';
  // 🎬 Cảnh b-roll / 🚫 không nhân vật
  const brollRule = noCharMode ? `
🚫 THIS VIDEO HAS NO CHARACTERS (PURE TUTORIAL / B-ROLL) — TOP-PRIORITY RULE, APPLIES TO EVERY SCENE:
- ABSOLUTELY no people, no characters, no presenter, no human silhouettes, no faces in ANY scene.
- EVERY scene is only: scenery / objects / processes / close-ups (close-up, macro) / tools / simple diagrams.
- When the VO describes a person's action → convert it into a scene showing the OBJECT / RESULT / PROCESS, no person. Example: "you water the plants" → "close-up of a watering can pouring water onto green seedlings, no person"; emotional/pronoun lines ("she smiles") → replace with related scenery fitting the context.
- SKIP the character classification section below entirely.
- EVERY prompt MUST end with: "no people, no person, no humans, no figures, no hands".
` : (brollMode ? `
🎬 Not every scene needs people — DECIDE YOURSELF from the VO content:
- VO about PEOPLE (actions, presenter lines, emotions, dialogue) → scene WITH characters.
- VO describing OBJECTS / PLACES / PROCESSES / detail CLOSE-UPS / concrete phenomena (e.g. "ants on a leaf", "the vegetable bed", "a jar of baking soda", "roots in the soil", "rain falling") → make it a B-ROLL / INSERT / CLOSE-UP scene with only objects + setting, NO people, NO presenter looking at camera.
- Goal: INTERLEAVE people-scenes and b-roll scenes so the video feels natural — do NOT force a presenter into every frame.
- ⚠️ IMPORTANT: a scene may ALREADY have an assigned character ("nhân vật:" in the scene line), BUT if that scene's VO describes OBJECTS / CONCEPTS / METAPHORS / abstract lines (not a concrete action of that character) → you MAY drop the person and make a b-roll/object INSERT, you are NOT forced to include the assigned [character] tag. The character tag is a hint, not a hard order, for b-roll.
- B-roll scenes still keep the channel's exact style/palette/lighting; describe the subject clearly, the shot size (close-up/macro/wide), the composition.
` : '');
  // ---- Mode-aware: Tag / Inline / Inline+bible ----
      const dm = state.descMode || 'tag';
      let charCtx, bgCtx, charHeader, bgHeader, mode1Rule;
      if (dm === 'inline_bible') {
        charCtx = state.charactersV.map(c => `- ${c}: ${(state.charBible && state.charBible[c]) || '(no profile yet — run Pre-scan)'}`).join('\n');
        bgCtx = state.backgroundsV.map(b => `- ${b}: ${(state.bgBible && state.bgBible[b]) || '(no profile yet)'}`).join('\n');
        charHeader = 'CHARACTERS — PASTE the fixed description below VERBATIM into the prompt (do not change a word, no square brackets):';
        bgHeader = 'SETTINGS — PASTE the fixed description below VERBATIM:';
        mode1Rule = `- Pose/expression/action: describe per the VO
- When the character is a PERSON: PASTE that character's fixed description (from the list above) VERBATIM into the prompt, not one word changed, no square brackets → the character stays identical across every scene. Example: "a tired female nurse, mid-30s, mint-green scrubs, brown hair in low bun, stands at the desk..."
- Animals/objects: describe normally
- Settings: PASTE that setting's fixed description VERBATIM`;
      } else if (dm === 'inline') {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'CHARACTERS (role hints — describe the FULL appearance in the prompt):';
        bgHeader = 'SETTINGS (hints):';
        mode1Rule = `- Pose/expression/action: describe per the VO
- When the character is a PERSON: describe the FULL appearance IN the prompt itself (age, gender, outfit+colors, hair, traits), no square brackets. Example: "a young male agent in a grey suit, short black hair, stands at the desk..."
- If the same character appears in multiple scenes: describe them IDENTICALLY each time for consistency
- Animals/objects: describe normally
- Settings: describe the setting FULLY in the prompt (no square brackets)`;
      } else {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'CHARACTERS WITH REFERENCE SHEETS (write the [name] tag):';
        bgHeader = 'SETTINGS (referenced from the sheet):';
        mode1Rule = `- Character IN the list above: write [character-name] (e.g. "[narrator] stands at desk...")
- SECONDARY characters NOT in the list (appear in VO but have no reference): describe them FREELY in a few words matching the channel's main style — e.g. if the scene has a stranger, passer-by, crowd → describe "a [short description] character in same art style" WITHOUT square brackets
- If the scene has MULTIPLE characters: include both the main characters (tags) and secondary ones (free description). Example: "[narrator] talking to a worried elderly woman in plain dress, both in same cartoon style, inside [office-night]"
- Animals/objects: describe normally, NO square brackets
- Setting: write [setting-name] (e.g. "inside [dark-office-night]...")
- Secondary characters must MATCH the main characters' style (same linework, same proportions)`;
      }
      // Detect animation/cartoon style → inject formula block
      const styleStr = (p.sceneStyle || '').toLowerCase();
      const isCartoon2D = /cartoon|flat|2d|animation|hand.drawn|stick|explainer|educational/.test(styleStr);
      // Lấy mô tả nhân vật NGẮN GỌN từ characterStyle của Profile (không hardcode)
      // Ưu tiên "Đặc điểm nhận dạng" (1 dòng do user đặt) → lặp gọn mỗi cảnh, không bloat prompt.
      // Nếu trống → lấy 600 ký tự đầu Character Style (đủ chứa đặc điểm cốt lõi như stick-limb; trước đây cắt 280 nên mất).
      const charStyleShort = ((p.charIdentity && p.charIdentity.trim())
        ? p.charIdentity.trim()
        : _trimToSentence((p.characterStyle || '').replace(/\s+/g, ' ').trim(), 600));
      const animFormulaBlock = (isCartoon2D && refShape) ? `
🎬 STYLE IS CARRIED BY THE REFERENCE IMAGE (VARIANT 1 — scenes with [character-name] get a reference image attached at generation time):
- ABSOLUTELY do NOT re-describe the character's full appearance / body proportions / linework in the prompt (the reference image already LOCKS those — re-describing them will FIGHT the reference). Write only [character-name] + the action/expression from the VO.
- Write the prompt TERSELY in the Nano Banana shape: [subject + action] at [setting] → [camera angle] → [lighting/atmosphere] → END with 1 SHORT positive scene-aesthetic phrase (e.g. "${_ssClean || _pmScene.medium || 'consistent cinematic style, cohesive lighting'}").
- NO NOT/no lists (except "no text, no watermark" at the end). Phrase POSITIVELY.
- Secondary characters WITHOUT a reference image: describe their appearance BRIEFLY per the channel style.
` : (isCartoon2D ? `
🎬 STYLE MASTER AT THE END (VARIANT 2 — NO reference image, describe the style yourself at the end of the prompt):
APPLY THE IMAGE FORMULA per the "type" of each scene (do NOT write the type name into the prompt):
${_shotRecipes}
⛔ Do NOT write a style/aesthetic phrase at the end of the prompt — the system APPENDS the exact same standard phrase to every scene itself. Describe only the visual content.
⛔ Do NOT describe READABLE TEXT, NUMBERS, labels, signs or titles in the image (no "labeled '35'", no "screen reads DEVALUATION"). To convey data, express it through QUANTITY/size/height/thickness of objects — e.g. 'a towering stack of suitcases next to one lone case' instead of writing the number.
- Write the prompt in this shape: [subject + action] at [setting] → [camera angle] → [lighting] → then FINALLY append 1 positive STYLE sentence summarizing the character design + linework (based on: "${charStyleShort || 'the channel character style'}").
- Phrase POSITIVELY, NO NOT lists (keep only no text, no watermark at the end).
` : '');

      // 🎯 Logline toàn video — áp cho MỌI cảnh để không lạc chủ đề / không đứt mạch giữa batch
      const loglineBlock = (state.videoLogline && state.videoLogline.trim())
        ? `\n🎯 WHOLE-VIDEO PREMISE (every scene MUST stick to this):\n"${state.videoLogline.trim()}"\n- Every scene — including abstract lines / rhetorical questions / transitions — must stay inside this video's VISUAL WORLD (correct characters, settings, era, palette above). Do NOT draw generic imagery that drifts off the story.\n`
        : '';
      const prompt = `You are a G-Labs prompt engineer (Imagen / Nano Banana). Write a scene prompt for each scene below.

CHANNEL PROFILE:
${profileContext}
${loglineBlock}
SCENE AESTHETIC (used for EVERY scene): "${_ssClean || 'consistent visual style across all scenes'}"

LOOK DIRECTION (phrase POSITIVELY in the prompt — do NOT copy verbatim as a "no/not" list; keep only the few truly needed negatives like no text, no watermark): "${p.promptRules || ''}"
${eraBlockT2}${animFormulaBlock}

${charHeader}
${charCtx || '(none)'}
${(state.wardrobe && Object.keys(state.wardrobe).length) ? ('\n👕 FIXED WARDROBE (MUST paste the EXACT "desc" — do NOT invent different outfits; same period = dressed the SAME):\n' + Object.entries(state.wardrobe).map(([n, os]) => `  • [${n}]: ${(os || []).map(o => `when ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')) : ''}

${bgHeader}
${bgCtx || '(none)'}

For each scene, FIRST determine the SCENE KIND from the VO content, then write a matching prompt:
${hybridRule}${brollRule}${VISUAL_METAPHOR_RULE}
🔹 KIND 1 — CHARACTERS IN A SETTING (VO is about a person's action):
${mode1Rule}

🔹 KIND 2 — SIMPLE INFOGRAPHIC / CHART (VO is about data, comparisons, statistics):
- Keep it SIMPLE: 1-2 simple icons/charts + a character ${dm === 'tag' ? '[character-name]' : 'in the channel style (do NOT default to stick figures)'} pointing or standing beside it
- Keep it SIMPLE, no multi-panel layout. Write REAL TEXT/NUMBERS into the chart (a title + a few SHORT 1-4 word labels / exact numbers, matching the VO, spelled correctly) — ABSOLUTELY no EMPTY label cells / "[TEXT]" / "reserved caption". Keep the text SHORT so the model renders it clearly.
- Do NOT draw internal organs or medical symbols unless the VO explicitly calls for them
- Example: "${dm === 'tag' ? '[narrator-male]' : 'A simple character in the channel art style'} pointing at a simple bar chart with 3 labelled bars — \\"Storage 20\\", \\"Mall 12\\", \\"Office 8\\" written under them, title \\"Cost per month\\" on top; clean flat background, minimal style, short real text spelled correctly"

🔹 KIND 3 — PROCESS / STEPS (VO explains how to do something, step by step):
- Describe 2-3 steps left to right with simple arrows
- ${dm === 'tag' ? 'If a character is involved: write [character-name] performing the action' : 'A simple character (in the CHANNEL STYLE) performs each step'}
- Example: "Three steps left to right with arrows: step 1 seed icon, step 2 watering can icon, step 3 plant sprouting, warm muted palette, flat 2D style"

🔹 KIND 4 — ICON / CONCEPT (VO explains an abstract concept):
- 1 large central icon + at most 4 smaller icons around it, simple flat illustration style
- Use visual metaphors (brain = thinking, heart = emotion, wallet = finance)
- Do NOT draw realistic characters, do NOT draw human internal organs unless the VO is specifically medical
- ${dm === 'tag' ? 'If a secondary character is involved: write [character-name] standing beside the icon' : 'If people are needed: draw a simple character in the CHANNEL STYLE (do NOT default to stick figures)'}
- Example: "Central large coin icon surrounded by 4 small flat icons: house, car, graduation cap, piggy bank, connected by dotted lines, warm yellow background, flat 2D style"

🔹 KIND 5 — STRIKING NUMBER/KEYWORD + ILLUSTRATION (ONLY when the VO has a shocking number, a specific year, or a single key word):
- ONLY for 1-4 WORD text, NOT for narrative lines/dialogue
- Short bold text at top/center + a simple illustration below
- Example: "Bold black text '13,000 YEARS' at top center, below a simple flat illustration of ancient cave with campfire, warm earthy palette, flat 2D style"
- Do NOT use KIND 5 if the VO is a story line — choose KIND 1 (characters) or KIND 4 (concept icon)

GENERAL RULES:
- Always describe the SPATIAL COMPOSITION (left/right/top/bottom/center)
- 🎬 PURPOSEFUL LIGHTING per the VO's EMOTION (don't leave it flat/even in every scene): tense/fear → harsh backlight, strong shadows, high contrast; warm/nostalgic → golden hour, soft slanted sun; sad/still → cold blue, diffused; joyful/hopeful → bright, clear, radiant; mysterious → mostly dark + 1 highlight streak. State the light source + direction + atmosphere clearly.
- 🧭 DEPTH & COMPOSITION: build foreground–midground–background layers for space; place the subject by the rule of thirds; use leading lines/perspective to draw the eye to the subject; "close-up" favors a slightly blurred background (shallow depth of field) to isolate the subject.
- End with the scene aesthetic tag

⚠️ TEXT IN IMAGE — VERY IMPORTANT (MOST SCENES SHOULD HAVE NO TEXT):
- DEFAULT: NO text in the image. Let the visuals tell the story through characters, icons, composition.
- Add text ONLY when it truly punctuates: a number ('8 HOURS'), a year ('1965'), 1 key word ('WARNING', 'DANGER')
- HARD LIMIT: in-image text is at most 4 WORDS. Written in CAPS, in single quotes.
- ABSOLUTELY no full VO lines, dialogue, or long titles in the image (e.g. do NOT write 'SKIP SEVERAL NIGHTS? THE STREETS STOP WORKING' or 'SLEEP IS WHEN THE CLEANUP HAPPENS')
- ABSOLUTELY do NOT translate the VO into English as the text — text is only an ultra-short punch, not a sentence title
- 🌐 TEXT LANGUAGE: ENGLISH ONLY. ABSOLUTELY no Korean, Chinese, Japanese, Thai, Arabic, or any other script. You MUST state in the prompt: "all text in English only, no Korean / Chinese / Japanese characters"
- KIND 4 CONCEPT ICONS: icons use pure VISUAL METAPHORS (brain, clock, symbols) — do NOT paste a text label under each icon (a common failure: the AI defaults to adding Korean labels under health/medical icons)

🔗 IMAGE CONTINUITY (so the video does NOT feel disjointed — very important):
- These are CONSECUTIVE scenes in the SAME video → keep the visual flow continuous.
- Consecutive scenes in the SAME setting → keep the SPACE consistent (same room, same layout, same light direction), only change camera angle/action.
- Change camera angles PURPOSEFULLY (e.g. wide → medium → close to guide the viewer), do NOT jump to random angles between scenes.
- Same content segment → palette + lighting + composition must flow smoothly from the previous scene, no abrupt changes.
${prevSceneCtx ? '\n📍 THE IMMEDIATELY PREVIOUS SCENE (the first scene below must flow smoothly from this one):\n"' + prevSceneCtx + '"\n' : ''}
${neighborVO ? `\n🔗 NEIGHBOR CONTEXT (the previous & next scenes' VO — USE it to understand the setting when the current scene lacks imagery):\n${neighborVO}\n
⚠️ If the current scene's VO has no concrete imagery (rhetorical questions, transitions, abstract lines like "what does it feel like?", "hold that feeling", "here's the thing") → BORROW the setting/characters/atmosphere from the previous or next scene to draw a fitting, seamless image. Do NOT leave the prompt empty or overly generic. The image must continue the story naturally.` : ''}
⚠️ ABSOLUTELY DO NOT:
- Do NOT write "KIND 1", "KIND 2", "KIND 3", "KIND 4", "KIND 5" into the output prompt
- Do NOT write "Type 1", "Type 2", ... or any classification label
- Do NOT write "[001]", "[002]" or scene indices into the prompt
${dm === 'tag' ? '- ALWAYS use [character-name] and [setting-name] for every scene with characters — do NOT describe inline\n- Correct: "[narrator-male] walks in [outdoor-nature-daytime]" | WRONG: "a generic character walks in a green field"\n' : '- Do NOT use square brackets [] for character/setting names — describe them DIRECTLY in English words\n'}- The scene kind is ONLY for the AI to pick the style INTERNALLY, it must NOT APPEAR in the final text prompt
- The returned prompt must START IMMEDIATELY with the visual description (e.g. "Medium shot of...", "Split layout showing...", "Wide angle of..."), with no other prefix

📐 NANO BANANA FORMULA (Google DeepMind — an instruction-following model built on Gemini; write prompts in EXACTLY this shape):
- ORDER: [Subject + specific adjectives] doing [action] at [setting] → [composition/camera angle] → [lighting/atmosphere] → [style/linework near the END]. Put SUBJECT–ACTION–SETTING FIRST, style/aesthetic at the END (do NOT front-load style).
- POSITIVE PHRASING: describe what you WANT to see, MINIMIZE "no X / not Y" (this model does not use SDXL-style negative prompts). E.g. "clean plain white background" instead of "no clutter/no background"; "empty street" instead of "no cars". Keep only the few truly needed negatives: no text, no watermark (+ no people for b-roll). ⚠️ EXCEPTION: INFOGRAPHIC / CHART / COMPARISON / MAP scenes SHOULD include real short TEXT/NUMBERS (a title + 1-4 word labels / correct numbers) — for those scenes do NOT add "no text".
- NATURAL, coherent language, full sentences — do NOT stuff loose keywords separated by commas.
- Do NOT write "--ar" or aspect ratios into the prompt (the tool sets the ratio separately via the API).

🛡 CONTENT SAFETY (MANDATORY — to pass the image tool's filters):
The image tool (G-Labs) REJECTS prompts with directly deadly/violent/casualty content. When the VO mentions death, drowning, freezing, bodies, victims, blood, suffering... you MUST write the prompt INDIRECTLY, metaphorically, focused on the ATMOSPHERE instead of the action:
- "drowning" → "floating in dark water looking up, peaceful, eyes closed"
- "dead body" → "figure drifting gently in deep water, calm, distant"
- "freezing to death" → "shivering, breath visible, wrapped in cold blue tones"
- "1,500 victims died / thousands dead" → "vast empty dark ocean, scattered distant lights, somber mood" (no dead bodies, no casualty numbers)
- "blood / gore" → drop entirely, replace with a dark somber atmosphere
- ABSOLUTELY do NOT use the words: dead, death, dying, corpse, drowning, blood, gore, victim, suffering in the English prompt
- Replace with: peaceful, drifting, floating, cold, somber, quiet, still, distant, fading
- Keep the scene's EXACT emotion and atmosphere, only change the phrasing so it does not violate policy

Prompt language: ENGLISH (for image gen). ${refShape && highDetail ? '70-130 words/prompt (characters are handled by the reference image; describe the ENVIRONMENT densely in detail).' : refShape ? '55-110 words/prompt (characters are ONLY a tag — the reference image handles the appearance, do NOT re-describe body-lock; SPEND the words on the detailed ENVIRONMENT/setting + lighting (direction/color/contrast) + composition & DEPTH → the prompt stays RICH and CINEMATIC, terse only on the character part).' : highDetail ? '90-160 words/prompt (HIGH DETAIL).' : '60-120 words/prompt.'}
${highDetail ? `
🔍 HIGH-DETAIL MODE — make the image DENSELY detailed like narrative illustration:
- FOREGROUND PROPS: name 3-6 concrete objects in the scene (e.g. wooden crates, coiled rope, clay jars, torches, a workbench, weapons on the wall, a market stall) — do NOT leave the background empty.
- MATERIALS & TEXTURE: state surface materials (worn wood, nailed brass, mossy stone, linen fabric, rusted metal, cracked plaster) so the image gains depth.
- DEPTH LAYERS: describe foreground / midground / background separately (e.g. distant mountains, temple columns, ships, rooftops, a blurred crowd) to create depth.
- SPECIFIC LIGHTING: source + direction + color (e.g. "warm torchlight from the left casting long shadows", "overcast grey daylight from above").
- Still keep the channel's EXACT art-style (linework, character proportions, palette) — only add ENVIRONMENTAL detail, do NOT change the character style.
- Add detail but STILL respect the NO-TEXT rules above — do NOT add text/labels into the image.
` : ''}${shortMode ? `
⚡ SHORT PROMPT MODE (the user will attach the character's REFERENCE IMAGE when generating):
- Do NOT describe the character's appearance in detail (no round head, eyes, limbs, hair, clothes, body proportions) — the reference image handles that
- Write ONLY: [character-name] + ACTION + POSE + emotion (e.g.: "[passenger-bunk] lying on bunk staring at ceiling, worried")
- FOCUS on describing: setting, lighting, camera angle, palette, atmosphere
- Do NOT repeat character style traits — let the reference image decide
- Still keep the general style description for the ENVIRONMENT (flat 2D, colors, outline) but do NOT apply it to characters
` : ''}

${luatThuc}

⚠️ Write the FULL SEPARATE prompt for EVERY scene in the list — do NOT get lazy:
- No "...", "...full prompt...", "[full prompt]", "same as above", "like the previous scene", "similar".
- No blanks, no abbreviations. Every scene MUST have 1 complete standalone prompt, fully written.

Return ONLY a JSON array (each scene 1 COMPLETE element):
[{"id":"001","prompt":"<complete prompt>"}, ...]

THE SCENES:
${batch.map(s => `[${s.id}] VO: "${s.text}" | character: ${s.character || '-'} | setting: ${s.background || '-'} | camera: ${s.camera} | ${s.duration}s${_laThuc(s) ? ' | ⚑ REAL FOOTAGE' : ''}`).join('\n')}`;
  return prompt;
}

async function _t2CuuCanhTrong(imLang){
  const ds = (state.scenes || []).filter(s =>
    _laThuc(s)
    && !((state.mediaPicks || {})[s.id])
    && !((state.scenePrompts || {})[s.id] || '').trim());
  if (!ds.length) return { cuu: 0 };
  if (!imLang) setStatus2(`🩹 ${ds.length} cảnh không tìm được tư liệu — chuyển về ảnh AI…`, 'working');
  if (typeof novaLog === 'function')
    novaLog(`🩹 ${ds.length} cảnh tìm tư liệu không ra → trả về ảnh AI, sinh prompt bù.`, 'warn');

  // Gỡ cờ nguồn TRƯỚC khi sinh prompt: buildSceneGenPrompt đọc cờ này để quyết
  // viết lệnh vẽ hay viết mô tả đi tìm. Còn cờ thì nó lại viết mô tả tìm kiếm.
  ds.forEach(s => { s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; s.nguonVi = ''; });

  let ok = 0;
  for (const s of ds){
    if (state.cancelRequested) break;
    try { await genSingleScenePrompt(s.id); if (((state.scenePrompts || {})[s.id] || '').trim()) ok++; }
    catch (e){ /* cảnh lỗi thì bỏ, đừng chặn cả lượt */ }
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (_) {}
  try { if (typeof renderAllT2 === 'function') renderAllT2(); } catch (_) {}
  if (!imLang) setStatus2(`🩹 Đã sinh prompt bù cho ${ok}/${ds.length} cảnh không có tư liệu.`, ok ? 'ok' : 'info');
  return { cuu: ok, tong: ds.length };
}

async function genSingleScenePrompt(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  await genVideoLogline(false);
  const scene = state.scenes[idx];
  const profileContext = `Channel: ${p.tenKenh}\nNiche: ${p.ngach}\nPOV: ${p.povStyle}\nStructure: ${p.cauTruc}`;
  // Lấy cảnh ngay trước làm ngữ cảnh liên tục
  let prevSceneCtx = '';
  if (idx > 0) {
    const prev = state.scenes[idx - 1];
    const pp = state.scenePrompts[prev.id];
    if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
  }
  // Lời thoại cảnh trước + sau (để mượn bối cảnh nếu cảnh này thiếu hình)
  let neighborVO = '';
  const prevS = state.scenes[idx - 1];
  const nextS = state.scenes[idx + 1];
  if (prevS) neighborVO += `Previous scene [${prevS.id}]: "${(prevS.text || '').slice(0, 200)}"\n`;
  if (nextS) neighborVO += `Next scene [${nextS.id}]: "${(nextS.text || '').slice(0, 200)}"`;
  setStatus2(`Đang tạo lại prompt cảnh [${id}]...`, 'working');
  try {
    const prompt = buildSceneGenPrompt([scene], prevSceneCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt})
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      const reply = await callLLM(prompt, { maxTokens: 1000, _override: { thinking: false } });
      parsed = safeParseJSON(reply, vArr);
    }
    // Lấy prompt đầu tiên trả về (chỉ có 1 cảnh) — không phụ thuộc ID AI trả
    const got = parsed.find(x => x && x.prompt);
    const raw = got ? cleanPrompt(got.prompt) : '';
    if (raw && !_isLazyPrompt(raw)) {
      state.scenePrompts[id] = _ensureSceneTags(raw, scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo lại prompt cảnh [${id}].`, 'ok');
      saveState();
    } else {
      setStatus2(`⚠️ Cảnh [${id}] AI trả prompt lười/lỗi — bấm 🔧 Tạo lại lần nữa (hoặc đổi Claude).`, 'error');
    }
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function makeSafePrompt(id, which){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile.', 'error');
  const store = which === 'B' ? state.scenePrompts2 : state.scenePrompts;
  const original = store && store[id];
  if (!original) return setStatus2('Chưa có prompt để sửa.', 'error');

  setStatus2(`Đang làm mềm prompt [${id}${which === 'B' ? 'b' : ''}]...`, 'working');
  try {
    const prompt = `The image prompt below was REJECTED by a content filter (it contains death/violence/casualty content). REWRITE it so it passes the filter while KEEPING the same meaning, setting, style and camera angle.

REWRITE RULES:
- Remove every word: dead, death, dying, corpse, drowning, blood, gore, victim, suffering, kill, die
- Replace with indirect wording: peaceful, drifting, floating, eyes closed, cold, somber, quiet, still, distant, fading, motionless
- A dead/drowning person → "figure drifting peacefully in dark water, eyes closed, calm"
- Mass casualties → "vast empty dark scene, somber mood, distant scattered lights" (do NOT draw people)
- Keep unchanged: character names [in brackets], background names [in brackets], style, lighting, camera angle, color tone
- Keep roughly the same length

ORIGINAL PROMPT (blocked):
${original}

Return ONLY the rewritten prompt (in English), no explanation.`;
    const safe = await callClaude(prompt, 600);
    store[id] = safe.trim();
    renderPromptsV();
    saveState(true);
    setStatus2(`✓ Đã làm mềm prompt [${id}${which === 'B' ? 'b' : ''}] — thử gen lại trong G-Labs.`, 'ok');
  } catch (e) {
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

function addPromptB(id){
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  state.scenePrompts2[id] = '';
  renderPromptsV();
  saveState(true);
  // Tự động tạo prompt B ngay sau khi thêm
  genSingleScenePromptB(id);
}

async function genBatchPromptB(batch, p){
  const sceneBlocks = batch.map(s => {
    const promptA = cleanPrompt(state.scenePrompts[s.id] || '');
    const tag = _isInfographicShot(s.shot) ? ' [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]' : '';
    return `[${s.id}]${tag} (${s.duration}s)\nVO: "${s.text}"\nPrompt A: "${promptA}"`;
  }).join('\n\n');

  const sysPrompt = `You are a G-Labs prompt engineer. For EACH scene below, create Prompt B — the SECOND image of the SAME scene (shown right after Prompt A, splitting the duration in half).

Each Prompt B must:
- Use the same characters, setting and style as that scene's Prompt A
- KEEP the reference tags [character-name] and [background-name] EXACTLY as in Prompt A: if Prompt A has [dealer-male] [perfumed-room] then Prompt B MUST reuse exactly [dealer-male] [perfumed-room] (with brackets) — NEVER change them to "dealer-male", "the man", "the child"... (so G-Labs keeps characters/settings consistent with the reference sheet)
- Normal scenes: show the NEXT moment/action (second half) within the same scene.
- Scenes tagged [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]: do NOT draw a "next action". Instead draw a DIFFERENT ANGLE/COMPLEMENTARY PART of the same data (e.g. Prompt A shows the number/first half → Prompt B shows the remaining half or the conclusion), white background, mostly icons/shapes, VERY LITTLE text (at most a short title + a few numbers) — do NOT repeat Prompt A verbatim, do not stuff text.
- Same length & format as Prompt A (~60-100 words)
- In English, starting directly with the visual description

SCENES:
${sceneBlocks}

Return a JSON object keyed by scene id, value being Prompt B (in English). Example: {"007":"...","012":"..."}
Return ONLY JSON, no explanation, no reasoning.`;

  // callLLMJson: ép JSON + thinking off + validate (object có ≥1 value chuỗi cho id trong batch)
  // → chống DeepSeek xả nguyên đoạn suy luận vào prompt B
  const ids = new Set(batch.map(s => String(s.id).padStart(3, '0')));
  let obj;
  try {
    obj = await callLLMJson(sysPrompt, {
      maxTokens: 2500,
      validate: o => o && typeof o === 'object' && !Array.isArray(o)
        && Object.entries(o).some(([k, v]) => ids.has(String(k).padStart(3, '0')) && typeof v === 'string' && v.trim())
    });
  } catch (e) {
    // Hết cách ở dạng batch → thử từng cảnh (cũng đã JSON-hardened)
    for (const s of batch) {
      if (state.cancelRequested) break;
      await genSingleScenePromptB(s.id);
    }
    return;
  }

  // Chuẩn hoá key về 3 chữ số rồi gán đúng cảnh
  const norm = {};
  for (const [k, v] of Object.entries(obj)) norm[String(k).padStart(3, '0')] = v;
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  for (const s of batch) {
    const b = norm[s.id];
    if (b && typeof b === 'string' && b.trim()) {
      // B phải có ĐÚNG tag của A; nếu A thiếu thì backstop theo scene
      const aPrompt = state.scenePrompts[s.id] || '';
      state.scenePrompts2[s.id] = _ensureSceneTags(_mirrorTagsFromA(cleanPrompt(b.trim()), aPrompt), s);
    }
  }
}

function removePromptB(id){
  if (state.scenePrompts2) delete state.scenePrompts2[id];
  renderPromptsV();
  saveState(true);
}

async function genSingleScenePromptB(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const promptA = cleanPrompt(state.scenePrompts[id]);
  if (!promptA) return setStatus2(`Cần tạo Prompt A cho cảnh [${id}] trước.`, 'error');
  setStatus2(`Đang tạo Prompt B cảnh [${id}]...`, 'working');
  try {
    const sysPrompt = `You are a G-Labs prompt engineer. Based on the scene's Prompt A, create Prompt B for the SECOND HALF of that scene.
Prompt B must:
- Use the same characters, setting and style as Prompt A
- KEEP the reference tags [character-name] and [background-name] EXACTLY as in Prompt A: if Prompt A has [dealer-male] [perfumed-room] then Prompt B MUST reuse exactly [dealer-male] [perfumed-room] (with brackets) — NEVER change them to "dealer-male", "the man", "the child"... (so G-Labs keeps characters/settings consistent with the reference sheet)
- Show the NEXT action / state (after Prompt A ends)
- Same length and format as Prompt A (~60-100 words)
- In English, starting directly with the visual description

Scene VO: "${scene.text}"
Duration: ${scene.duration}s
Prompt A: "${promptA}"

Return ONLY 1 JSON object: {"prompt":"<Prompt B in English, starting directly with the visual description, no prefix>"}. No explanation, no reasoning, no prose outside the JSON.`;
    // callLLMJson: ép JSON + thinking off → chống DeepSeek xả suy luận thành prompt
    const got = await callLLMJson(sysPrompt, {
      maxTokens: 500,
      validate: o => o && typeof o.prompt === 'string' && o.prompt.trim().length > 20
    });
    const clean = cleanPrompt(String(got.prompt).trim());
    if (clean) {
      if (!state.scenePrompts2) state.scenePrompts2 = {};
      // B phải có ĐÚNG tag của A (cùng nhân vật + bối cảnh); backstop theo scene nếu A thiếu
      state.scenePrompts2[id] = _ensureSceneTags(_mirrorTagsFromA(clean, promptA), scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo Prompt B cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus2(`⚠️ Tạo Prompt B thất bại, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doGenerateScenePrompts(){
  _llmStep = 'prompt cảnh';
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');

  /* Chỉ tạo cảnh CHƯA có prompt → bấm lại sau khi Dừng sẽ chạy tiếp, không làm lại từ đầu.
     BỎ HẲN cảnh đã giao cho nguồn tư liệu: prompt của chúng KHÔNG được dùng ở đâu cả —
     đường stock và đường web đều tìm bằng LỜI THOẠI (generateSearchAngles(sc.text)),
     không đọc scenePrompts. Video 155 cảnh mà 90 cảnh dùng tư liệu thì đó là 90 lượt
     gọi AI viết ra thứ vứt đi. Cảnh nào tìm không ra hình sẽ được cứu ở bước sau
     (_t2CuuCanhTrong) — lúc đó mới sinh prompt, và chỉ cho đúng số cảnh cần.        */
  const _boQua = state.scenes.filter(_laThuc).length;
  const todo = state.scenes.filter(s => !_laThuc(s) && (!state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()));
  const already = state.scenes.length - todo.length - _boQua;
  if (todo.length === 0) {
    return setStatus2(_boQua
      ? `Không còn cảnh nào cần prompt — ${_boQua} cảnh dùng tư liệu có sẵn (không cần prompt), còn lại đã có.`
      : `Tất cả ${state.scenes.length} cảnh đã có prompt. Muốn tạo lại từ đầu? Bấm "🗑 Xoá hết" rồi tạo lại.`, 'info');
  }
  if (_boQua && typeof novaLog === 'function')
    novaLog(`✍️ Bỏ qua ${_boQua} cảnh dùng tư liệu có sẵn — không cần prompt ảnh.`, 'ok');

  // 🎯 Đảm bảo có logline (tự sinh lại nếu kịch bản đã đổi) → mọi cảnh bám chủ đề toàn video
  setStatus2('🎯 Kiểm tra logline toàn video...', 'working');
  await genVideoLogline(false);

  setStatus2(already > 0
    ? `Chạy tiếp: đã có ${already} prompt, còn ${todo.length} cảnh...`
    : 'AI đang sinh prompt ảnh...', 'working');
  clearCancel();
  const profileContext = `Channel: ${p.tenKenh}\nNiche: ${p.ngach}\nPOV: ${p.povStyle}\nStructure: ${p.cauTruc}`;

  // Ngữ cảnh cảnh ngay trước (giữ mạch hình ảnh liền lạc, tránh rời rạc)
  let prevSceneCtx = '';
  // Nếu chạy tiếp, lấy prompt cảnh ngay trước cảnh đầu tiên trong todo làm mồi
  if (todo.length && state.scenes.length) {
    const firstIdx = state.scenes.findIndex(s => s.id === todo[0].id);
    if (firstIdx > 0) {
      const prev = state.scenes[firstIdx - 1];
      const pp = state.scenePrompts[prev.id];
      if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
    }
  }

  // Xử lý 1 batch (độc lập). seedCtx = ngữ cảnh mồi (chỉ dùng khi chạy tuần tự).
  const processSceneBatch = async (batch, seedCtx) => {
    let neighborVO = '';
    const fi = state.scenes.findIndex(s => s.id === batch[0].id);
    const li = state.scenes.findIndex(s => s.id === batch[batch.length - 1].id);
    const bPrev = fi > 0 ? state.scenes[fi - 1] : null;
    const bNext = li >= 0 && li < state.scenes.length - 1 ? state.scenes[li + 1] : null;
    if (bPrev) neighborVO += `Cảnh trước batch [${bPrev.id}]: "${(bPrev.text || '').slice(0, 180)}"\n`;
    if (bNext) neighborVO += `Cảnh sau batch [${bNext.id}]: "${(bNext.text || '').slice(0, 180)}"`;
    const prompt = buildSceneGenPrompt(batch, seedCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt}) — chống DeepSeek nhét suy luận vào output
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      try {
        const reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
        parsed = safeParseJSON(reply, vArr);
      } catch (e) { if (attempt) throw e; }
    }
    // Vẫn hỏng mà lô còn nhiều cảnh → CHIA ĐÔI gọi lại (đệ quy tới từng cảnh) — mất 1 cảnh còn hơn mất cả lô.
    if (!parsed.length && batch.length > 1 && !state.cancelRequested) {
      const mid = Math.ceil(batch.length / 2);
      if (typeof novaLog === 'function') novaLog(`  ↻ Lô prompt ${batch[0].id}-${batch[batch.length - 1].id} hỏng — chia đôi thử lại…`, 'warn');
      await processSceneBatch(batch.slice(0, mid), seedCtx);
      if (!state.cancelRequested) await processSceneBatch(batch.slice(mid), seedCtx);
      return;
    }
    // CHỈ gán cho cảnh thuộc batch này → không đè nhầm cảnh khác
    const batchIds = batch.map(s => s.id);
    const batchIdSet = new Set(batchIds);
    parsed.forEach((x, idx) => {
      let id = String(x.id || '').padStart(3, '0');
      if (!batchIdSet.has(id)) id = batchIds[idx];   // AI trả ID sai → khớp theo vị trí
      if (id && batchIdSet.has(id) && x.prompt) {
        const sc = state.scenes.find(s => s.id === id);
        const raw = _forceStyleTail(cleanPrompt(x.prompt), p);   // đuôi style do APP gắn → 155 cảnh giống hệt
        if (_isLazyPrompt(raw)) return;   // prompt lười/placeholder → BỎ, để trống cho "Tạo nốt cảnh thiếu"
        state.scenePrompts[id] = _ensureSceneTags(raw, sc);
      }
    });
    renderPromptsV();
    const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
    setStatus2(`Tạo prompt... ${done}/${state.scenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
  };

  const lanes = Math.min(3, _concurrency());   // trần 3 luồng — nhiều hơn chỉ ăn 429 chứ không nhanh hơn
  const batches = [];
  for (let i = 0; i < todo.length; i += bs) batches.push(todo.slice(i, i + bs));

  try {
    if (lanes > 1) {
      // SONG SONG (nhiều key): chạy batch ĐẦU trước làm "mỏ neo" phong cách mở đầu,
      // rồi chạy các batch còn lại song song — mỗi batch tự lấy prompt cảnh NGAY TRƯỚC làm mồi NẾU đã có
      // → đỡ đứt tông ở mối nối batch. Mối nối sâu vẫn dựa vào 🎯 logline + VO lân cận.
      const seedFor = (b) => {
        const fi = state.scenes.findIndex(s => s.id === b[0].id);
        if (fi > 0) { const pv = state.scenes[fi - 1]; const pp = state.scenePrompts[pv.id]; if (pp && pp.trim()) return `[${pv.id}] ${pp.slice(0, 220)}`; }
        return '';
      };
      if (batches.length) await processSceneBatch(batches[0], prevSceneCtx);
      const rest = batches.slice(1);
      if (!state.cancelRequested && rest.length)
        await runConcurrent(rest, b => processSceneBatch(b, seedFor(b)), lanes, () => state.cancelRequested);
    } else {
      // TUẦN TỰ (1 key): giữ liên kết mạch hình ảnh giữa các batch
      for (const batch of batches) {
        if (state.cancelRequested) break;
        await processSceneBatch(batch, prevSceneCtx);
        for (let k = batch.length - 1; k >= 0; k--) {
          const pp = state.scenePrompts[batch[k].id];
          if (pp && pp.trim()) { prevSceneCtx = `[${batch[k].id}] ${pp.slice(0, 220)}`; break; }
        }
      }
    }
    if (state.cancelRequested) {
      clearCancel();
      const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
      setStatus2(`⏸ Đã dừng. Đã tạo ${done}/${state.scenes.length}. Bấm "Tạo Prompt ảnh" để chạy TIẾP từ chỗ dừng.`, 'info');
      saveState();
      return;
    }
    const finalMissing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
    setStatus2(finalMissing > 0
      ? `⚠️ Xong nhưng còn ${finalMissing} cảnh AI tạo lỗi. Bấm "🔧 Tạo nốt cảnh thiếu" lại, hoặc giảm Batch xuống 2-3 cho chắc.`
      : `✓ Đã sinh đủ ${state.scenes.length} prompt ảnh.`, finalMissing > 0 ? 'info' : 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

