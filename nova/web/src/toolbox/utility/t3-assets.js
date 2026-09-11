/* T3/T5 ASSETS — prompt nhân vật/bối cảnh, dropzone, renamer, zip
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function loadAssetsFromTool2(skipEra){
  // Khôi phục bối cảnh/thời đại đã nhập (giữ trong phiên)
  const eraEl = document.getElementById('t3Era');
  if (eraEl && state.t3Era) eraEl.value = state.t3Era;
  const bgLayoutEl = document.getElementById('t3BgLayout');
  if (bgLayoutEl && state.t3BgLayout) bgLayoutEl.value = state.t3BgLayout;
  if (!skipEra) autoFillEra(false);   // tự suy từ kịch bản nếu ô đang trống (fire-and-forget)
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus3('Tool 02 chưa có nhân vật/bối cảnh. Chạy Quét Trước ở Tool 02.', 'error');

  const p = getProfile();

  // Merge nhân vật mặc định kênh vào đầu danh sách (không trùng lặp)
  const defaultChars = (p?.defaultChars || []);
  const defaultBgs   = (p?.defaultBgs   || []);
  const videoChars   = state.charactersV || [];
  const videoBgs     = state.backgroundsV || [];

  // Strip tag để so sánh tên
  const stripTag = s => s.replace(/\s*\[.*?\]\s*$/, '').trim();
  const videoCharNames = new Set(videoChars.map(stripTag));
  const videoBgNames   = new Set(videoBgs.map(stripTag));

  // Nhân vật mặc định không có trong video → thêm vào đầu
  const extraChars = defaultChars.filter(c => !videoCharNames.has(stripTag(c)));
  const extraBgs   = defaultBgs.filter(b => !videoBgNames.has(stripTag(b)));

  const mergedChars = [...extraChars, ...videoChars];
  const mergedBgs   = [...extraBgs,   ...videoBgs];

  document.getElementById('t3Characters').value = mergedChars.join('\n');
  document.getElementById('t3Backgrounds').value = mergedBgs.join('\n');
  document.getElementById('t3CharCount').textContent = mergedChars.length;
  document.getElementById('t3BgCount').textContent = mergedBgs.length;

  if (extraChars.length || extraBgs.length) {
    setStatus3(`✓ Load từ Tool 02 + thêm ${extraChars.length} nhân vật / ${extraBgs.length} bối cảnh mặc định kênh.`, 'ok');
  } else {
    setStatus3('✓ Load từ Tool 02.', 'ok');
  }

  if (p) {
    document.getElementById('t3VisualStyle').value = p.visualStyle || '';
    document.getElementById('t3Ngach').value = p.ngach || '';
    document.getElementById('t3PovStyle').value = p.povStyle || '';
    document.getElementById('t3CharStyle').value = p.characterStyle || '';
    document.getElementById('t3BgStyle').value = p.backgroundStyle || '';
    document.getElementById('t3SceneStyle').value = p.sceneStyle || '';
    document.getElementById('t3PromptRules').value = p.promptRules || '';
  }

  // Populate character select for image upload
  const sel = document.getElementById('t3CharSelect');
  sel.innerHTML = '<option value="">— Chọn từ danh sách nhân vật —</option>' +
    mergedChars.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  setStatus3(`✓ Đã load ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.`, 'ok');
}

function uploadCharImage(){
  const charName = document.getElementById('t3CharSelect').value;
  if (!charName) return alert('Chọn nhân vật trước khi upload ảnh.');
  const input = document.getElementById('t3ImgInput');
  input.onchange = function(){
    const file = this.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('File quá lớn (max 5MB).');
    const reader = new FileReader();
    reader.onload = function(e){
      const base64 = e.target.result.split(',')[1];
      const mediaType = file.type;
      state.characterImages[charName] = { base64, mediaType, fileName: file.name };
      renderCharImageGallery();
      setStatus3(`✓ Đã upload ảnh cho [${charName}].`, 'ok');
      saveState();
    };
    reader.readAsDataURL(file);
    this.value = '';
  };
  input.click();
}

function renderCharImageGallery(){
  const gallery = document.getElementById('t3ImgGallery');
  if (!gallery) return;
  const entries = Object.entries(state.characterImages || {});
  document.getElementById('t3ImgCount').textContent = entries.length + ' ảnh';
  if (entries.length === 0) { gallery.innerHTML = ''; return; }
  gallery.innerHTML = entries.map(([name, img]) => `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;width:130px">
      <img src="data:${img.mediaType};base64,${img.base64}" style="width:110px;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px">
      <div style="color:var(--teal);font-size:11px;font-weight:600;word-break:break-all">${escapeHtml(name)}</div>
      <button class="btn ghost sm" style="margin-top:6px;font-size:10px" onclick="delete state.characterImages['${name.replace(/'/g, "\\'")}'];renderCharImageGallery();saveState()">Xoá</button>
    </div>
  `).join('');
}

function clearAllCharImages(){
  if (!confirm('Xoá tất cả ảnh tham chiếu nhân vật?')) return;
  state.characterImages = {};
  renderCharImageGallery();
  saveState();
}

function _t3StyleCtx(){
  const p = getProfile();
  const charStyle  = document.getElementById('t3CharStyle').value  || p?.characterStyle  || '';
  const charStyleB = document.getElementById('t3CharStyleB')?.value || p?.characterStyleB || '';
  const bgStyle    = document.getElementById('t3BgStyle').value    || p?.backgroundStyle  || '';
  const rules = document.getElementById('t3PromptRules').value || p?.promptRules || '';
  // 🏺 Ngữ cảnh THỜI ĐẠI cho trang phục: ưu tiên ô "Bối cảnh & thời đại", nếu trống → trích kịch bản Tool 02
  const eraInput = (document.getElementById('t3Era')?.value || state.t3Era || '').trim();
  const scriptHint = (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 700);
  const eraCtx = eraInput
    ? `\nSETTING & ERA (infer period-correct CLOTHING from this): ${eraInput}`
    : (scriptHint ? `\nSCRIPT EXCERPT (infer era + clothing from this): "${scriptHint}"` : '');
  const eraRule = (eraInput || scriptHint)
    ? `\n- Clothing + HAIR/HEADWEAR + accessories must be CORRECT for the era/setting above (e.g. ancient Egypt → linen kilts/skirts, linen cloaks, wesekh collars, papyrus sandals; NO modern suits/shirts/ties/aprons when anachronistic). KEEP the channel's art-style/render medium EXACTLY as defined in the Character Style above (e.g. real-photo channel stays photoreal, 2D channel stays 2D) — ONLY change clothes, hair, headwear, jewelry to match the era, NEVER change the drawing style/material.`
    : '';
  // 🏺 Luật thời đại cho BỐI CẢNH (kiến trúc/vật liệu/đồ vật/ánh sáng theo đúng thời)
  const eraRuleBg = (eraInput || scriptHint)
    ? `\n- The setting's architecture, materials, objects and light sources must be CORRECT for the era/place above — NO anachronistic modern elements (e.g. ancient Egypt → mud-brick/stone walls, hieroglyph-carved columns, oil lamps/torches; NO electric bulbs, glass, modern metal/plastic).`
    : '';
  // 🖼 Kiểu ảnh bối cảnh: 'single' = 1 ảnh/mỗi bối cảnh (nét, ít lỗi) | 'grid' = 4 góc trong 1 ảnh
  const bgLayoutMode = (document.getElementById('t3BgLayout')?.value || state.t3BgLayout || 'single');
  const bgLayout = (bgLayoutMode === 'grid') ? ASSET_BG_LAYOUT : ASSET_BG_LAYOUT_SINGLE;
  return { p, charStyle, charStyleB, bgStyle, rules, eraInput, scriptHint, eraCtx, eraRule, eraRuleBg, bgLayout };
}

function _sanitizeCharPrompt(text){
  return String(text || '')
    .split(/(?<=[.!?])\s+/)               // tách theo câu
    .filter(seg => !_CHAR_RISKY.test(seg)) // bỏ câu chứa cụm cởi trần
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _charDescFromScenes(name){
  try {
    const tag = '[' + name + ']';
    const prompts = Object.values(state.scenePrompts || {}).concat(Object.values(state.scenePrompts2 || {}));
    const cand = {};
    for (const p of prompts){
      const s = String(p || ''); let idx = s.indexOf(tag);
      while (idx >= 0){
        const after = s.slice(idx + tag.length, idx + tag.length + 340);
        const m = after.match(/[^.]*\b(wear|wears|wearing|dressed|hoodie|shirt|jacket|suit|dress|coat|vest|jeans|trousers|robe|uniform|gown|blazer|cardigan|sneakers|boots)\b[^.]*\./i);
        if (m){ let d = m[0].replace(/^[\s,;:]+/, '').trim(); if (d.length > 25 && d.length < 340) cand[d] = (cand[d] || 0) + 1; }
        idx = s.indexOf(tag, idx + 1);
      }
    }
    let best = '', bc = 0; for (const [d, c] of Object.entries(cand)) if (c > bc){ bc = c; best = d; }
    return best;
  } catch (e){ return ''; }
}

function _isGenericCharName(n){
  const base = String(n || '').toLowerCase().replace(/[\s_\-]+/g, ' ').trim().split(' ')[0];
  return /^(protagonist|narrator|hero|heroine|antagonist|villain|character|main|mc|speaker|host|presenter|guy|man|woman|person|boy|girl|kid|child|lady|gentleman|worker|customer|shopper|user|viewer|nhanvat)$/.test(base);
}

async function genOneCharPrompt(rawName, ctx, opts = {}){
  const tagMatch = rawName.match(/^(.*?)\s*\[\s*(\w+)\s*\]\s*$/);
  const name    = tagMatch ? tagMatch[1].trim() : rawName.trim();
  const charTag = tagMatch ? tagMatch[2].toLowerCase() : '';
  // Bất kỳ tag nào → dùng Style B (nếu có); không tag → Style chính
  const useStyle = (charTag && ctx.charStyleB) ? ctx.charStyleB : ctx.charStyle;
  // Kênh ẢNH THẬT → dùng layout dạng ảnh chụp (tránh AI vẽ thành anime model-sheet)
  // Dùng CHUNG bộ dò medium với prompt cảnh — không thì ref nhân vật và ảnh cảnh lệch nhau (một bên vẽ, một bên ảnh).
  const _isPhotoreal = _profileMedium({ sceneStyle: (ctx.p?.sceneStyle || ''), characterStyle: useStyle, visualStyle: (ctx.p?.visualStyle || '') }).isPhoto;
  const charLayout = _isPhotoreal ? ASSET_CHAR_LAYOUT_PHOTO : ASSET_CHAR_LAYOUT;
  if (!state.assetCharPrompts) state.assetCharPrompts = {};

  // 📚 LIBRARY CHECK — nếu nhân vật đã có trong Library thì pull, skip AI gen (trừ khi forceAI HOẶC tên vai chung chung).
  if (!opts.forceAI && !_isGenericCharName(name)){
    const libEntry = checkLibraryFor('char', name);
    if (libEntry) {
      state.assetCharPrompts[name] = libEntry.prompt;
      if (libEntry.hasImage) {
        const uid = window.currentUser?.uid;
        if (uid) {
          try {
            const img = await IDB.get(uid + '/libraryImages/' + name);
            if (img) {
              if (!state.characterImages) state.characterImages = {};
              state.characterImages[name] = img;
            }
          } catch(e) {}
        }
      }
      return { name, pulled: true };
    }
  }

  const img = state.characterImages?.[name];
  const anchor = (state.styleRefImages && state.styleRefImages[0]) || null;

  // AI CHỈ tả NGOẠI HÌNH riêng của nhân vật (trang phục/tóc/đặc điểm theo thời đại).
  // Còn STYLE đầy đủ + LAYOUT (turnaround 5 góc, không hàng biểu cảm) + luật NO-TEXT → app tự RÁP CỐ ĐỊNH → mọi nhân vật đồng nhất, không bị AI bỏ sót.
  /* Trích đúng những câu KỊCH BẢN có nhắc tới nhân vật này.
     Trước đây mô tả ngoại hình chỉ suy từ TÊN + THỜI ĐẠI + NGÁCH. Với sáu
     video cùng "Mỹ hiện đại" thì AI nhận gần như cùng một đầu vào và cho ra
     gần như cùng một người — chỉ khác cái tên, mà tên thì không quyết định
     được ngoại hình. Đưa thêm câu kịch bản vào để AI biết người này LÀM GÌ:
     CEO hãng bay, nhà phân tích, thợ rửa xe — nghề nghiệp mới là thứ quyết
     định trang phục.                                                         */
  const _nhanVatTrongKichBan = (slug) => {
    const kb = String(state.script || '').replace(/\s+/g, ' ').trim();
    if (!kb) return '';
    // slug "ed-bastian" → tìm "ed bastian", và cả họ đứng riêng ("bastian").
    const tu = String(slug).split(/[-_]+/).filter(x => x.length > 2);
    if (!tu.length) return '';
    const mau = [tu.join('[\\s-]+')].concat(tu.length > 1 ? [tu[tu.length - 1]] : []);
    const cau = kb.split(/(?<=[.!?])\s+/);
    const ra = [];
    for (const m of mau) {
      let re; try { re = new RegExp('\\b' + m + '\\b', 'i'); } catch (_) { continue; }
      for (const c of cau) {
        if (re.test(c) && !ra.includes(c) && c.length > 25) ra.push(c);
        if (ra.length >= 3) break;
      }
      if (ra.length) break;                       // khớp cả tên rồi thì khỏi tìm theo họ
    }
    return ra.join(' ').slice(0, 600);
  };
  /* Hai nhân vật khác nghề vẫn hay ra cùng "blazer navy" vì mỗi người được
     sinh ĐỘC LẬP. Bản đầu tôi cho đọc trang phục của người đã sinh rồi bắt
     chọn khác — nhưng hàm này chạy SONG SONG (runConcurrent theo số key), nên
     mọi nhân vật khởi động cùng lúc và danh sách đó rỗng. Luật thành vô dụng
     ngay khi người dùng nâng số luồng.

     Nay gán MÀU theo CHỈ SỐ nhân vật trong danh sách — xác định trước, không
     phụ thuộc ai chạy xong trước. Song song bao nhiêu luồng cũng đúng.      */
  const _MAU_AO = [
    'navy blue', 'warm rust / terracotta', 'charcoal grey', 'olive green',
    'burgundy', 'cream / off-white', 'slate teal', 'mustard ochre',
    'deep plum', 'sand beige',
  ];
  const _mauCua = (() => {
    const ds = (state.charactersV || []).map(c => (typeof c === 'string' ? c : (c && (c.name || c.slug)) || ''));
    let k = ds.indexOf(name);
    if (k < 0) k = Math.abs([...String(name)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % _MAU_AO.length;
    return _MAU_AO[k % _MAU_AO.length];
  })();
  const _khacCtx = `\nMANDATORY OUTER GARMENT COLOR for this character: ${_mauCua}. Each character in the video is assigned a DIFFERENT color — this channel draws minimal faces, so GARMENT COLOR is the ONLY way to tell people apart. Pick a garment style fitting the profession, but the color must be exactly the color above.`;

  const _ctxKB = _nhanVatTrongKichBan(name);
  const _kbCtx = _ctxKB
    ? `\nTHIS CHARACTER IN THE SCRIPT (infer PROFESSION + role from this, then choose fitting clothing): "${_ctxKB}"`
    : '';

  const descReq = (extra) => `Describe the INDIVIDUAL appearance of character [${name}] for the channel "${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}".${ctx.eraCtx}${_kbCtx}${_khacCtx}
${extra}
Return 1-3 SHORT English sentences (40-80 words), STARTING with "The character [${name}] wears", describing: period-correct CLOTHING, HAIR/HEADWEAR, age/gender, distinctive identifying traits.
Do NOT re-describe the channel's overall art-style, do NOT describe layout/composition, no no-text rules. Return ONLY the description sentence(s).`;

  let desc;
  const _sceneDesc = (!opts.forceRewrite) ? _charDescFromScenes(name) : '';   // opts.forceRewrite → bỏ qua, cho AI viết mới
  if (_sceneDesc) {
    // ✅ Dùng ĐÚNG mô tả trang phục trong prompt cảnh → ảnh tham chiếu khớp ảnh cảnh (hết lệch quần áo).
    desc = `The character [${name}] is ${_sceneDesc}`;
  } else if (img) {
    desc = await callClaudeWithImage(descReq('Base your answer EXACTLY on the attached reference image (clothing, colors, hairstyle, facial features).'), img.base64, img.mediaType, 400);
  } else if (anchor) {
    desc = await callClaudeWithImage(descReq('Infer clothing/hair/traits from the character NAME + era + channel niche (the attached image is only a style-spirit reference).'), anchor.base64, anchor.mediaType, 400);
  } else {
    desc = await callClaude(descReq('Infer clothing/hair/traits from the character NAME + era + channel niche.'), 400);
  }
  desc = cleanPrompt(String(desc || '').trim());
  if (desc && !desc.includes('[' + name + ']')) desc = `The character [${name}]. ` + desc;   // đảm bảo có tag
  // 🧩 RÁP CỐ ĐỊNH: [style đầy đủ] + [mô tả nhân vật] + [LAYOUT kèm no-text] → luôn đủ định dạng
  // 🛡 Lọc cụm cởi trần (chống nhân vật trẻ em bị bộ lọc child-safety chặn "vi phạm chính sách")
  state.assetCharPrompts[name] = _sanitizeCharPrompt(`${useStyle} ${desc} ${charLayout}`);
  return { name, pulled: false };
}

async function genOneBgPrompt(name, ctx, opts = {}){
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  if (!opts.forceAI){
    const libEntry = checkLibraryFor('bg', name);
    if (libEntry) { state.assetBgPrompts[name] = libEntry.prompt; return { name, pulled: true }; }
  }
  const promptText = `Create 1 detailed image prompt for a background reference location [${name}].

Style template:
"""
${ctx.bgStyle}
"""

LOOK DIRECTION (phrase POSITIVELY in the prompt — do NOT copy it verbatim as a "no/not" list): ${ctx.rules}
Channel: ${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}${ctx.eraCtx}

Requirements:
- Describe the environment, props and lighting in detail, plus COMPOSITION & DEPTH (foreground–midground–background) so the setting has real space
- Include the background name [${name}] in the prompt
- POSITIVE PHRASING: describe what you WANT to see, MINIMIZE "no X / not Y" (Nano Banana is an instruction-following model, no SDXL-style negatives). Keep only the few truly needed negatives: no text, no watermark, and no people / no characters (this is an empty background plate)${ctx.eraRuleBg}
- ${ctx.bgLayout}
- 100-150 English words
- Return ONLY the prompt text.`;
  state.assetBgPrompts[name] = await callClaude(promptText, 500);
  return { name, pulled: false };
}

async function regenOneCharPrompt(rawName){
  const ctx = _t3StyleCtx();
  if (!ctx.charStyle && !ctx.charStyleB) return setStatus3('Cần có Character Style trong Profile.', 'error');
  const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  delete state.assetCharPrompts[name];
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  renderAssetCharPrompts(chars);
  setStatus3(`🎲 Đang tạo lại nhân vật [${name}]...`, 'working');
  try {
    await genOneCharPrompt(rawName, ctx, { forceAI: true });
    renderAssetCharPrompts(chars);
    setStatus3(`✓ Đã tạo lại nhân vật [${name}].`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi tạo lại: ' + e.message, 'error');
  }
}

async function regenOneBgPrompt(name){
  const ctx = _t3StyleCtx();
  if (!ctx.bgStyle) return setStatus3('Cần có Background Style trong Profile.', 'error');
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  delete state.assetBgPrompts[name];
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  renderAssetBgPrompts(bgs);
  setStatus3(`🎲 Đang tạo lại bối cảnh [${name}]...`, 'working');
  try {
    await genOneBgPrompt(name, ctx, { forceAI: true });
    renderAssetBgPrompts(bgs);
    setStatus3(`✓ Đã tạo lại bối cảnh [${name}].`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi tạo lại: ' + e.message, 'error');
  }
}

async function genAllAssetPrompts(){
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (chars.length === 0 && bgs.length === 0) return setStatus3('Cần load nhân vật/bối cảnh trước.', 'error');

  const ctx = _t3StyleCtx();
  const { p, charStyle, charStyleB, bgStyle, rules, eraCtx, eraRule, eraRuleBg, bgLayout } = ctx;
  if (!charStyle && !bgStyle) return setStatus3('Cần có Style Prompts trong Profile.', 'error');

  setStatus3('AI đang tạo prompt reference sheets...', 'working');
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  clearCancel();

  try {
    // Character prompts — chạy SONG SONG theo số key (mỗi nhân vật độc lập). Check Library → skip AI nếu có.
    let libPulledChars = 0;
    const charsToDo = chars.filter(rawName => {
      const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      return !(state.assetCharPrompts[name] && state.assetCharPrompts[name].trim());
    });
    const charLanes = _concurrency();
    await runConcurrent(charsToDo, async (rawName) => {
      if (state.cancelRequested) return;
      const res = await genOneCharPrompt(rawName, ctx);
      if (res && res.pulled) libPulledChars++;
      renderAssetCharPrompts(chars);
      const done = Object.keys(state.assetCharPrompts).length;
      setStatus3(`Nhân vật ${done}/${chars.length}...${charLanes > 1 ? ` (⚡ ${charLanes} luồng)` : ''}${libPulledChars ? ` · 📚 ${libPulledChars} từ Library` : ''}`, 'working');
    }, charLanes, () => state.cancelRequested);
    if (state.cancelRequested) {
      clearCancel();
      setStatus3(`⏸ Đã dừng. Đã tạo ${Object.keys(state.assetCharPrompts).length}/${chars.length} prompt nhân vật. Bấm lại để chạy tiếp.`, 'info');
      saveState();
      return;
    }

    // Background prompts — GỘP tất cả vào 1 lần gọi API (tiết kiệm chi phí)
    let libPulledBgs = 0;
    const bgsToGen = []; // bối cảnh cần AI tạo (chưa có prompt, không trong Library)
    for (const name of bgs) {
      if (state.assetBgPrompts[name] && state.assetBgPrompts[name].trim()) continue;
      const libEntry = checkLibraryFor('bg', name);
      if (libEntry) {
        state.assetBgPrompts[name] = libEntry.prompt;
        libPulledBgs++;
        renderAssetBgPrompts(bgs);
        setStatus3(`📚 ${name}: pull từ Library (${libPulledBgs} bg đã pull)`, 'info');
        continue;
      }
      bgsToGen.push(name);
    }

    if (bgsToGen.length && !state.cancelRequested) {
      setStatus3(`Đang tạo ${bgsToGen.length} prompt bối cảnh (1 lần gọi)...`, 'working');
      const bgListStr = bgsToGen.map(n => `[${n}]`).join('\n');
      const batchBgPrompt = `Create detailed image prompts for the MULTIPLE background reference locations below.

Style template:
"""
${bgStyle}
"""

NEGATIVE/RULES: ${rules}
Channel: ${p?.tenKenh || ''} — ${p?.ngach || ''}${eraCtx}

Background list:
${bgListStr}

For EACH background, create 1 prompt:
- Describe the environment, props and lighting in detail
- Include the background name [name] in the prompt
- NO characters NO people${eraRuleBg}
- ${bgLayout}
- 100-150 English words per prompt

Return a JSON object keyed by background name (no brackets), value being the prompt text. Example: {"ship-cabin-night":"...","ship-deck-night":"..."}
Return ONLY JSON, no explanation.`;
      try {
        const reply = await callClaude(batchBgPrompt, 3000);
        const clean = reply.replace(/```json|```/g, '').trim();
        const obj = JSON.parse(clean);
        for (const name of bgsToGen) {
          if (obj[name] && typeof obj[name] === 'string') {
            state.assetBgPrompts[name] = obj[name].trim();
          }
        }
        renderAssetBgPrompts(bgs);
      } catch (e) {
        // Fallback: JSON lỗi → gọi từng cái
        console.warn('Batch BG lỗi, fallback từng cái:', e.message);
        for (const name of bgsToGen) {
          if (state.cancelRequested) break;
          await genOneBgPrompt(name, ctx, { forceAI: true });
          renderAssetBgPrompts(bgs);
        }
      }
    }

    // QUÉT LẠI: asset NÀO còn thiếu prompt (do lô rớt mạng) → thử lại tối đa 2 vòng (tránh "cần prompt" như traveler/bucees-interior).
    const _cn = rn => rn.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    for (let sweep = 0; sweep < 2 && !state.cancelRequested; sweep++){
      const missC = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim()));
      const missB = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim()));
      if (!missC.length && !missB.length) break;
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missC.length} nhân vật + ${missB.length} bối cảnh thiếu mô tả — thử lại (vòng ${sweep + 1})…`, 'warn');
      const lanes2 = _concurrency();
      await runConcurrent(missC, async (rn) => { if (state.cancelRequested) return; try { await genOneCharPrompt(rn, ctx, { forceAI: true }); renderAssetCharPrompts(chars); } catch (e) { console.warn('char sweep:', e.message); } }, lanes2, () => state.cancelRequested);
      await runConcurrent(missB, async (nm) => { if (state.cancelRequested) return; try { await genOneBgPrompt(nm, ctx, { forceAI: true }); renderAssetBgPrompts(bgs); } catch (e) { console.warn('bg sweep:', e.message); } }, lanes2, () => state.cancelRequested);
    }
    const _mc = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim())).length;
    const _mb = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim())).length;
    if ((_mc || _mb) && typeof novaLog === 'function') novaLog(`⚠️ Còn ${_mc} nhân vật + ${_mb} bối cảnh chưa có mô tả (mạng chập) — bấm "🔄 Viết lại mô tả" để bù.`, 'err');

    setStatus3(`✓ Đã tạo ${chars.length} prompt nhân vật + ${bgs.length} prompt bối cảnh.`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

async function genStyleReference(){
  const p = getProfile();
  if (!p) return setStatus3('Cần Profile.', 'error');
  setStatus3('AI đang tạo Style Reference prompt...', 'working');
  try {
    const prompt = `Create 1 image prompt for a "Channel Visual Style Reference Sheet" — one master image summarizing the channel's entire visual style, used as the standard for all future videos.

Channel: ${p.tenKenh} — ${p.ngach}
Visual Style: ${p.visualStyle}
Character Style (apply IN FULL — especially how bodies, arms/legs, hands and faces are built): ${p.characterStyle || ''}
Background Style: ${(p.backgroundStyle || '').slice(0, 700)}
Scene Style: ${(p.sceneStyle || '').slice(0, 400)}

MANDATORY LAYOUT — the image is divided into 3 clear horizontal rows, separated by thin divider lines:
- ROW 1 (top): color palette — 8 color squares representing the channel's dominant palette (taken from the style), evenly spaced in a row
- ROW 2 (middle): a line-up of 8 diverse sample characters (male/female, old/young, different professions fitting the channel niche) — ALL in the same consistent art style, standing full-body front view, white background, soft drop shadow under their feet. The BODY CONSTRUCTION of all 8 characters MUST exactly follow the Character Style above (e.g. if the Character Style calls for thin black stick arms/legs + white mitten hands + off-white faces, all 8 must be drawn that way) — NEVER draw them as regular-proportioned cartoon people
- ROW 3 (bottom): 3 sample background cells (3 typical environments of the channel) with different lighting and moods, slightly rounded corners

The prompt must:
- Describe the EXACT art style AND character body construction (arms, legs, hands, faces) exactly per the Character Style above — copy the identifying features verbatim, do NOT replace them with regular cartoon human proportions
- Apply the correct color palette and mood per the Visual Style
- 130-180 English words
- End with: "channel style reference sheet, consistent art style throughout, clean layout, no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only"
- Return ONLY the prompt text.`;
    state.styleRefPrompt = await callClaude(prompt, 600);
    document.getElementById('styleRefPanel').style.display = 'block';
    renderStyleRef();
    updateAllAssetPromptsBox();
    setStatus3('✓ Đã tạo Style Reference prompt (3 hàng: palette + nhân vật + bối cảnh).', 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

function renderAssetCharPrompts(chars){
  const box = document.getElementById('t3CharPromptsList');
  if (!box) return;
  document.getElementById('t3CharPromptCount').textContent = Object.keys(state.assetCharPrompts || {}).length;
  if (!chars || chars.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có nhân vật.</div>'; return; }
  box.innerHTML = chars.map(rawName => {
    // Strip tag: "passenger-narrator [b]" → "passenger-narrator"
    const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    const tag  = (rawName.match(/\[\s*(\w+)\s*\]/) || [])[1] || '';
    const pr = state.assetCharPrompts?.[name];
    const promptEsc = pr ? pr.replace(/`/g, "'").replace(/\\/g, '\\\\') : '';
    const editing = isEditingPrompt('char', name);
    const nameEsc = name.replace(/'/g, "\\'");
    const rawNameEsc = rawName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const inLib = !!_getLib().chars[name];
    const tagBadge = tag ? `<span style="font-size:10px;background:rgba(13,148,136,.15);color:var(--teal);padding:1px 6px;border-radius:6px;margin-left:4px">[${tag}] Style B</span>` : '';
    return `<div class="ref-sheet-card ${pr ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="ref-sheet-card-head">
        <span class="ref-sheet-card-name">${escapeHtml(name)}${tagBadge} ${inLib ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 5px;border-radius:6px;margin-left:4px">📚 Library</span>' : ''}</span>
        ${editing ? '' : (pr ? `<div style="display:flex;gap:6px">
          <button class="btn ghost sm" onclick="regenOneCharPrompt('${rawNameEsc}')" title="🎲 Tạo lại prompt nhân vật này" style="color:var(--teal)">🎲</button>
          <button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)" title="Sao chép">📋</button>
          <button class="btn ghost sm" onclick="startEditPrompt('char','${nameEsc}')" title="Sửa prompt">✏️</button>
          <button class="btn ghost sm" onclick="saveToLibraryUI('char','${nameEsc}')" title="Lưu vào Library để dùng cho video sau" style="color:var(--accent)">💾</button>
        </div>` : '')}
      </div>
      ${editing ? renderEditPromptUI(pr) : `<div class="ref-sheet-card-text">${pr ? escapeHtml(pr) : 'Đang tạo...'}</div>`}
    </div>`;
  }).join('');
  updateAllAssetPromptsBox();
}

function renderAssetBgPrompts(bgs){
  const box = document.getElementById('t3BgPromptsList');
  if (!box) return;
  document.getElementById('t3BgPromptCount').textContent = Object.keys(state.assetBgPrompts || {}).length;
  if (!bgs || bgs.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có bối cảnh.</div>'; return; }
  box.innerHTML = bgs.map(name => {
    const pr = state.assetBgPrompts?.[name];
    const promptEsc = pr ? pr.replace(/`/g, "'").replace(/\\/g, "\\\\") : '';
    const editing = isEditingPrompt('bg', name);
    const nameEsc = name.replace(/'/g, "\\'");
    const inLib = !!_getLib().bgs[name];
    return `<div class="ref-sheet-card bg-card ${pr ? '' : 'empty'} ${editing ? 'editing' : ''}">
      <div class="ref-sheet-card-head">
        <span class="ref-sheet-card-name">${escapeHtml(name)} ${inLib ? '<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:1px 5px;border-radius:6px;margin-left:4px">📚 Library</span>' : ''}</span>
        ${editing ? '' : (pr ? `<div style="display:flex;gap:6px">
          <button class="btn ghost sm" onclick="regenOneBgPrompt('${nameEsc}')" title="🎲 Tạo lại prompt bối cảnh này" style="color:var(--rose)">🎲</button>
          <button class="btn ghost sm" onclick="copyText(\`${promptEsc}\`)" title="Sao chép">📋</button>
          <button class="btn ghost sm" onclick="startEditPrompt('bg','${nameEsc}')" title="Sửa prompt">✏️</button>
          <button class="btn ghost sm" onclick="saveToLibraryUI('bg','${nameEsc}')" title="Lưu vào Library để dùng cho video sau" style="color:var(--accent)">💾</button>
        </div>` : '')}
      </div>
      ${editing ? renderEditPromptUI(pr) : `<div class="ref-sheet-card-text">${pr ? escapeHtml(pr) : 'Đang tạo...'}</div>`}
    </div>`;
  }).join('');
  updateAllAssetPromptsBox();
}

function updateAllAssetPromptsBox(){
  const ta = document.getElementById('allAssetPromptsBox');
  if (!ta) return;
  const parts = [];
  const cp = state.assetCharPrompts || {};
  const bp = state.assetBgPrompts || {};
  const oneLine = p => p.replace(/\s*\n\s*/g, ' ').trim();
  // Chỉ lấy nhân vật/bối cảnh đang dùng trong video hiện tại
  const chars = (document.getElementById('t3Characters')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const bgs   = (document.getElementById('t3Backgrounds')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const charKeys = chars.length ? chars : Object.keys(cp);
  const bgKeys   = bgs.length   ? bgs   : Object.keys(bp);
  for (const name of charKeys) if (cp[name]) parts.push(`[CHARACTER: ${name}] ${oneLine(cp[name])}`);
  for (const name of bgKeys)   if (bp[name]) parts.push(`[BACKGROUND: ${name}] ${oneLine(bp[name])}`);
  if (state.styleRefPrompt) parts.push(`[STYLE REFERENCE] ${oneLine(state.styleRefPrompt)}`);
  ta.value = parts.join('\n');
}

function copyAllAssetPrompts(){
  const parts = [];
  const cp = state.assetCharPrompts || {};
  const bp = state.assetBgPrompts || {};
  const oneLine = p => p.replace(/\s*\n\s*/g, ' ').trim();
  const chars = (document.getElementById('t3Characters')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const bgs   = (document.getElementById('t3Backgrounds')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const charKeys = chars.length ? chars : Object.keys(cp);
  const bgKeys   = bgs.length   ? bgs   : Object.keys(bp);
  for (const name of charKeys) if (cp[name]) parts.push(`[CHARACTER: ${name}] ${oneLine(cp[name])}`);
  for (const name of bgKeys)   if (bp[name]) parts.push(`[BACKGROUND: ${name}] ${oneLine(bp[name])}`);
  if (state.styleRefPrompt) parts.push(`[STYLE REFERENCE] ${oneLine(state.styleRefPrompt)}`);
  if (!parts.length) return setStatus3('Chưa có prompt nào.', 'error');
  navigator.clipboard.writeText(parts.join('\n'));
  setStatus3(`✓ Đã sao chép ${parts.length} prompts.`, 'ok');
}

function exportAssetPrompts(){
  downloadJSON({
    charPrompts: state.assetCharPrompts,
    bgPrompts: state.assetBgPrompts,
    styleRef: state.styleRefPrompt,
    exportedAt: new Date().toISOString()
  }, 'asset-prompts-' + Date.now() + '.json');
  setStatus3('✓ Đã xuất.', 'ok');
}

function setupAssetDropzone(){
  const dz = document.getElementById('assetDropzone');
  if (!dz) return;
  const inp = document.getElementById('assetFileInput');
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    addAssetFiles(Array.from(e.dataTransfer.files));
  });
  inp.addEventListener('change', e => addAssetFiles(Array.from(e.target.files)));
  document.getElementById('t3AssetNames').addEventListener('input', renderAssetPreview);
}

function addAssetFiles(files){
  const imgs = files.filter(f => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  assetRenamer.files = assetRenamer.files.concat(imgs)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  document.getElementById('t3AssetImgCount').textContent = assetRenamer.files.length + ' ảnh đã chọn';
  renderAssetPreview();
}

function clearAssetFiles(){
  assetRenamer.files = [];
  document.getElementById('t3AssetImgCount').textContent = '0 ảnh đã chọn';
  renderAssetPreview();
}

function renderAssetPreview(){
  const panel = document.getElementById('assetPreviewPanel');
  const list = document.getElementById('assetPreviewList');
  if (!panel || !list) return;
  const names = document.getElementById('t3AssetNames').value.split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('t3AssetCount').textContent = names.length + ' assets';
  if (!assetRenamer.files.length || !names.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const count = Math.min(assetRenamer.files.length, names.length);
  list.innerHTML = `<table class="scene-table">
    <thead><tr><th>#</th><th>File gốc</th><th></th><th>Tên mới</th></tr></thead>
    <tbody>` +
    assetRenamer.files.slice(0, names.length).map((f, i) => {
      const name = names[i] || '?';
      const ext = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
      return `<tr>
        <td class="id">${i + 1}</td>
        <td style="color:var(--text-muted)">${escapeHtml(f.name)}</td>
        <td style="text-align:center;color:var(--text-dim)">→</td>
        <td style="color:var(--accent);font-weight:600">${escapeHtml(name)}${ext}</td>
      </tr>`;
    }).join('') + `</tbody></table>` +
    (assetRenamer.files.length > names.length ? `<div style="padding:8px 14px;color:var(--text-dim);font-size:11px">${assetRenamer.files.length - names.length} ảnh thừa (không đủ tên asset)</div>` : '') +
    (names.length > assetRenamer.files.length ? `<div style="padding:8px 14px;color:var(--text-dim);font-size:11px">${names.length - assetRenamer.files.length} asset thiếu ảnh</div>` : '') +
    `<div style="padding:8px 14px;color:var(--green);font-size:11px">✓ ${count} files sẵn sàng</div>`;
}

async function downloadAssetZip(){
  const names = document.getElementById('t3AssetNames').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!assetRenamer.files.length) return setStatus3('Cần thêm ảnh.', 'error');
  if (!names.length) return setStatus3('Cần danh sách tên assets.', 'error');
  if (typeof JSZip === 'undefined') return setStatus3('JSZip chưa tải.', 'error');

  const zip = new JSZip();
  const count = Math.min(assetRenamer.files.length, names.length);
  for (let i = 0; i < count; i++) {
    const f = assetRenamer.files[i];
    const ext = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    zip.file(names[i] + ext, await f.arrayBuffer());
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'assets-' + Date.now() + '.zip'; a.click();
  URL.revokeObjectURL(url);
  document.getElementById('assetZipStatus').innerHTML = '<span style="color:var(--green)">✓ Đã tạo ZIP với ' + count + ' ảnh.</span>';
}

function setupDropzone(){
  const dz = document.getElementById('dropzone');
  if (!dz) return;
  const inp = document.getElementById('fileInput');
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files));
  });
  inp.addEventListener('change', e => addFiles(Array.from(e.target.files)));
}

function addFiles(files){
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return setStatus4('Chỉ chấp nhận file ảnh.', 'error');
  renamer.files = renamer.files.concat(imgs).sort(naturalSort);
  if (renamer.buildOrder) applyBuildOrderToFiles();
  else renderFileList();
  setStatus4(`Đã thêm ${imgs.length} ảnh. Tổng ${renamer.files.length}.`, 'ok');
}

function sortFiles(){
  renamer.files.sort(naturalSort);
  renderFileList();
  setStatus4('Đã sắp xếp lại theo tên.', 'ok');
}

function clearFiles(){
  if (!renamer.files.length) return;
  if (!confirm('Xoá tất cả?')) return;
  renamer.files = [];
  renamer.isB = [];
  renderFileList();
  setStatus4('Đã xoá.', 'ok');
}

function renderFileList(){
  const list = document.getElementById('fileList');
  if (!list) return;
  document.getElementById('fileCount').textContent = renamer.files.length + ' ảnh';
  if (!renamer.files.length) { list.innerHTML = '<div class="empty-state">Chưa có file.</div>'; return; }

  const start = parseInt(document.getElementById('startNum').value) || 1;
  const pad   = parseInt(document.getElementById('padding').value) || 3;
  const ext   = document.getElementById('keepExt').value;

  // Build new names — track scene counter, handle A/B
  // renamer.isB[i] = true nếu ảnh đó là ảnh B (nửa sau cảnh)
  if (!renamer.isB) renamer.isB = [];
  while (renamer.isB.length < renamer.files.length) renamer.isB.push(false);

  // Tính số thứ tự từng ảnh
  const names = [];
  let sceneNum = start;
  for (let i = 0; i < renamer.files.length; i++) {
    const f   = renamer.files[i];
    const oe  = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const ne  = ext === 'keep' ? oe : '.' + ext;
    const isB = renamer.isB[i];
    // Nếu là B → dùng cùng số với ảnh trước (A), thêm suffix 'b'
    // Nếu là A (nhưng có B theo sau) → suffix 'a'
    const nextIsB = renamer.isB[i + 1];
    const prevIsB = i > 0 && renamer.isB[i - 1];
    if (isB) {
      // B: dùng sceneNum hiện tại (chưa tăng)
      const num = String(sceneNum - 1).padStart(pad, '0');
      names.push({ num, suffix: 'b', ne, sceneNum: sceneNum - 1 });
    } else {
      const num = String(sceneNum).padStart(pad, '0');
      // A: có suffix 'a' nếu ảnh kế là B
      const suffix = nextIsB ? 'a' : '';
      names.push({ num, suffix, ne, sceneNum });
      sceneNum++;
    }
  }

  list.innerHTML = `<table class="scene-table">
    <thead><tr><th>#</th><th>File gốc</th><th></th><th>Tên mới</th><th>A/B</th><th></th></tr></thead>
    <tbody>` +
    renamer.files.map((f, i) => {
      const { num, suffix, ne } = names[i];
      const isB = renamer.isB[i];
      const newName = num + suffix + ne;
      const abBtn = `<button class="btn ghost sm" style="font-size:11px;padding:2px 7px;${isB ? 'background:var(--teal);color:#fff;border-color:var(--teal)' : 'color:var(--text-dim)'}"
        onclick="toggleB(${i})" title="${isB ? 'Đang là ảnh B — click để bỏ' : 'Đánh dấu là ảnh B (nửa sau cảnh)'}">${isB ? '🖼B' : '+B'}</button>`;
      return `<tr>
        <td class="id" style="color:${isB ? 'var(--teal)' : ''}">${num}${suffix}</td>
        <td style="color:var(--text-muted)">${escapeHtml(f.name)}</td>
        <td style="text-align:center;color:var(--text-dim)">→</td>
        <td style="color:var(--accent);font-weight:600">${escapeHtml(newName)}</td>
        <td>${abBtn}</td>
        <td class="actions"><button class="del" onclick="renamer.files.splice(${i},1);renamer.isB.splice(${i},1);renderFileList()" title="Xoá">×</button></td>
      </tr>`;
    }).join('') + `</tbody></table>
    <div style="padding:6px 14px;font-size:11px;color:var(--text-dim)">
      💡 Bấm <strong>+B</strong> để đánh dấu ảnh là "nửa sau" của cảnh trước → tên sẽ thêm hậu tố <strong>a/b</strong> (VD: 002a, 002b)
    </div>`;
}

function toggleB(i){
  if (!renamer.isB) renamer.isB = [];
  renamer.isB[i] = !renamer.isB[i];
  renderFileList();
}

function loadFromTool2ForRenamer(){
  if (!state.scenes || !state.scenes.length)
    return setStatus4('❌ Chưa có dữ liệu Tool 2 — hãy chia cảnh trước.', 'error');

  // Build order + bSet từ state trực tiếp
  const buildOrder = [];
  const bSet = new Set();
  state.scenes.forEach(s => {
    const hasB = !!(state.scenePrompts2 && state.scenePrompts2[s.id] && state.scenePrompts2[s.id].trim());
    if (hasB) {
      buildOrder.push(s.id + 'a');
      buildOrder.push(s.id + 'b');
      bSet.add(s.id + 'b');
    } else {
      buildOrder.push(s.id);
    }
  });

  renamer.buildOrder = buildOrder;
  renamer.bSet = bSet;

  if (renamer.files.length) applyBuildOrderToFiles();

  const bCount = bSet.size;
  setStatus4(`✓ Load từ Tool 2: ${buildOrder.length} slots (${bCount} ảnh B). ${renamer.files.length ? 'Đã tự điền A/B.' : 'Kéo ảnh vào để tự điền.'}`, 'ok');
}

async function loadXlsxForRenamer(input){
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  if (typeof XLSX === 'undefined') return setStatus4('Thư viện XLSX chưa tải.', 'error');
  setStatus4('Đang đọc scene-list.xlsx...', 'working');
  try {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    if (!wb.SheetNames.includes('build')) {
      return setStatus4('❌ Không tìm thấy sheet "build" trong file XLSX — hãy xuất lại từ Tool 2.', 'error');
    }
    const ws   = wb.Sheets['build'];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    // Lấy danh sách scene_id từ sheet build theo thứ tự
    const buildOrder = rows.map(r => String(r['scene_id'] || '').trim()).filter(Boolean);
    if (!buildOrder.length) return setStatus4('❌ Sheet "build" trống.', 'error');

    // Map: scene_id → index trong buildOrder
    const sceneIndex = {};
    buildOrder.forEach((sid, i) => { sceneIndex[sid] = i; });

    // Tìm các scene_id kết thúc bằng 'b' → là ảnh B
    // VD: "001b", "014b" — phân biệt với tên không có suffix
    const bSet = new Set(buildOrder.filter(sid => /^[0-9]+b$/.test(sid)));

    // Nếu chưa có ảnh thì chỉ lưu thứ tự để dùng khi kéo ảnh vào
    renamer.buildOrder = buildOrder;
    renamer.bSet = bSet;

    // Nếu đã có ảnh → tự map và set isB
    if (renamer.files.length) {
      applyBuildOrderToFiles();
    }

    const bCount = bSet.size;
    setStatus4(`✓ Đọc được ${buildOrder.length} cảnh từ sheet "build" (${bCount} ảnh B). ${renamer.files.length ? 'Đã tự điền A/B.' : 'Kéo ảnh vào để tự điền.'}`, 'ok');
  } catch(e) {
    setStatus4('❌ Lỗi đọc XLSX: ' + e.message, 'error');
  }
}

function applyBuildOrderToFiles(){
  if (!renamer.buildOrder || !renamer.buildOrder.length) return;
  const bSet = renamer.bSet || new Set();
  if (!renamer.isB) renamer.isB = [];
  // Sort files theo buildOrder: files được sắp xếp theo natural sort trước
  // Gán isB[i] = true nếu file thứ i trong danh sách sau khi sort tương ứng với scene là B
  // Logic: đếm sequential — file thứ i map với buildOrder[i]
  for (let i = 0; i < renamer.files.length; i++) {
    const sid = renamer.buildOrder[i];
    renamer.isB[i] = sid ? bSet.has(sid) : false;
  }
  renderFileList();
}

async function downloadZip(){
  if (typeof gateTool==='function' && gateTool('tool4')) return;
  if (!renamer.files.length) return setStatus4('Không có file.', 'error');
  if (typeof JSZip === 'undefined') return setStatus4('JSZip chưa tải.', 'error');

  setStatus4('Đang tạo ZIP...', 'working');
  const zip  = new JSZip();
  const start = parseInt(document.getElementById('startNum').value) || 1;
  const pad   = parseInt(document.getElementById('padding').value) || 3;
  const ext   = document.getElementById('keepExt').value;
  if (!renamer.isB) renamer.isB = [];

  let sceneNum = start;
  let abCount = 0;
  for (let i = 0; i < renamer.files.length; i++) {
    const f   = renamer.files[i];
    const oe  = f.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const ne  = ext === 'keep' ? oe : '.' + ext;
    const isB = renamer.isB[i] || false;
    const nextIsB = renamer.isB[i + 1] || false;

    let filename;
    if (isB) {
      filename = String(sceneNum - 1).padStart(pad, '0') + 'b' + ne;
      abCount++;
    } else {
      const suffix = nextIsB ? 'a' : '';
      filename = String(sceneNum).padStart(pad, '0') + suffix + ne;
      sceneNum++;
    }
    zip.file(filename, await f.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = 'images-' + Date.now() + '.zip'; a.click();
  URL.revokeObjectURL(u);
  const msg = abCount > 0
    ? `✓ ZIP ${renamer.files.length} ảnh (${abCount} ảnh B có hậu tố a/b).`
    : `✓ ZIP ${renamer.files.length} ảnh.`;
  setStatus4(msg, 'ok');
}

