/* T2 SPLIT — nạp kịch bản, tách cảnh fast/smart/AI, cân bằng thời lượng (balanceScenes)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function loadScriptFile(input){
  const file = input.files && input.files[0];
  if (!file) return;
  // Chặn file quá lớn (>5MB) — kịch bản text không bao giờ to vậy, tránh treo trình duyệt
  if (file.size > 5 * 1024 * 1024) {
    setStatus2('File quá lớn (>5MB) — đây có phải file văn bản kịch bản không?', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    let txt = String(reader.result || '');
    // File .srt/.vtt: bỏ số thứ tự + dòng thời gian, chỉ giữ lời thoại
    if (/\.(srt|vtt)$/i.test(file.name)) {
      txt = txt.replace(/^WEBVTT.*$/im, '')
        .replace(/^\d+\s*$/gm, '')
        .replace(/^\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n').trim();
    }
    const ta = document.getElementById('scriptInput');
    if (ta) ta.value = txt;
    state.script = txt;
    state.videoLogline = ''; state.videoLoglineSig = '';   // kịch bản mới → bỏ logline cũ
    const lgEl = document.getElementById('videoLogline'); if (lgEl) lgEl.value = '';
    updateScriptCount();
    saveState();
    setStatus2(`✓ Đã nạp file "${file.name}" (${txt.length.toLocaleString()} ký tự). Bấm Chia Cảnh hoặc 🚀 Auto.`, 'ok');
    input.value = '';   // reset để chọn lại cùng file vẫn kích hoạt
  };
  reader.onerror = () => { setStatus2('Không đọc được file: ' + (reader.error?.message || 'lỗi không rõ'), 'error'); input.value = ''; };
  reader.readAsText(file, 'utf-8');
}

function cleanScript(){
  const ta = document.getElementById('scriptInput');
  let s = ta.value;
  // Loại bỏ markdown headers + đường gạch ngang (markup nguyên dòng — an toàn)
  s = s.replace(/^#+\s.*$/gm, '').replace(/^[-=*]{3,}$/gm, '');
  // Marker đạo diễn/chú thích trong ngoặc (cười, nhạc, pause, cảnh 1, 0:05...) → bỏ.
  // CHỈ bỏ khi nội dung trong ngoặc TRÔNG NHƯ chỉ dẫn — GIỮ nguyên ngoặc chứa nội dung thật.
  const cueWords = /^(cười|khóc|thở dài|ngừng|im lặng|lặng|nhạc|nhạc nền|âm thanh|hiệu ứng|sfx|sound|music|pause|beat|laughs?|sighs?|silence|cut|fade|transition|b-?roll|cảnh\s*\d+|scene\s*\d+|\d{1,2}:\d{2}(?::\d{2})?)\b/i;
  s = s.replace(/\(([^()]{0,40})\)/g, (m, inner) => cueWords.test(inner.trim()) ? '' : m);
  s = s.replace(/\[([^\[\]]{0,40})\]/g, (m, inner) => cueWords.test(inner.trim()) ? '' : m);
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  ta.value = s;
  state.script = s;
  updateScriptCount();
  setStatus2('✓ Đã lọc kịch bản.', 'ok');
}

function updateScriptCount(){
  const el = document.getElementById('scriptCount');
  if (el) el.textContent = (state.script || '').length.toLocaleString() + ' ký tự';
}

function splitIntoSentences(text){
  text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\r/g, '');
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const sents = [];
  for (const para of paras) {
    const re = /[^.!?…。．！？]+[.!?…。．！？]+(?:["')\]]*)/g;   // + dấu câu CJK (Hàn/Trung/Nhật)
    let last = 0, m;
    const local = [];
    while ((m = re.exec(para)) !== null) { local.push(m[0].trim()); last = re.lastIndex; }
    const rem = para.slice(last).trim();
    if (rem) local.push(rem);
    if (local.length === 0) local.push(para);
    sents.push(...local);
    sents.push('__PARA__');
  }
  return sents.filter(Boolean);
}

function splitLong(s, max){
  let parts = [], buf = '';
  for (let i = 0; i < s.length; i++) {
    buf += s[i];
    const asciiBreak = /[,;:—–]/.test(s[i]) && s[i + 1] === ' ';
    const cjkBreak = /[，、；：]/.test(s[i]);                       // dấu phẩy CJK (không cần khoảng trắng sau)
    if (asciiBreak || cjkBreak) { parts.push(buf.trim()); buf = ''; if (asciiBreak) i++; }
  }
  if (buf.trim()) parts.push(buf.trim());
  const f = [];
  for (const p of parts) {
    if (p.length <= max) f.push(p);
    else {
      const w = p.split(' ');
      let ch = '';
      for (let x of w) {
        // từ/cụm quá dài (CJK không khoảng trắng) → cắt cứng theo ký tự
        while (x.length > max) { if (ch) { f.push(ch); ch = ''; } f.push(x.slice(0, max)); x = x.slice(max); }
        const t = ch ? ch + ' ' + x : x;
        if (t.length > max && ch) { f.push(ch); ch = x; }
        else ch = t;
      }
      if (ch) f.push(ch);
    }
  }
  return f;
}

function _t2StampSeed(s){
  s.promptSeed = (s.text || '').slice(0, 80);
  s.seedAt = Date.now();
}

function splitScenesFast(text, min, max){
  const sents = splitIntoSentences(text);
  const scenes = [];
  let buf = '';
  function flush(){ if (buf.trim()) { scenes.push(buf.trim()); buf = ''; } }
  for (const s of sents) {
    if (s === '__PARA__') { flush(); continue; }
    // Giữ NGUYÊN cả câu — chỉ chặt nếu câu dài bất thường (>2.5x max), tránh vỡ câu có nghĩa
    const units = s.length > max * 2.5 ? splitLong(s, max) : [s];
    for (const u of units) {
      const c = buf ? buf + ' ' + u : u;
      if (c.length <= max) buf = c;
      else { flush(); buf = u; }
    }
  }
  flush();
  return scenes;
}

async function splitScenesSmart(text, min, max){
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const all = [];
  const batches = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > 2000 && cur) { batches.push(cur); cur = p; }
    else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) batches.push(cur);
  clearCancel();
  const lanes = _concurrency();

  const buildPrompt = (batchText) => `You are a video editor. Split the following script segment into scenes for image-based video production.

MOST IMPORTANT RULES — NEVER VIOLATE:
- THE SMALLEST UNIT IS 1 COMPLETE SENTENCE (ending with . ! ? …).
- NEVER cut one sentence into two scenes — not even a long sentence, not even one containing a comma "," or a dash "—" / ":" mid-sentence.
- Your job is to MERGE sentences into scenes, NOT to CUT sentences.

Merging rules:
- 1 long sentence → keep the WHOLE sentence in 1 scene (even if it exceeds ${max} characters — keep it intact).
- Several short sentences sharing the same visual idea → may merge into 1 scene (target ${min}-${max} characters, but sentence boundaries matter more than character counts).
- A striking short sentence (like "Wow.", "Wait.") may stand alone as its own scene.
- Keep the original wording 100% — you only decide where to merge, never edit the text.

OUTPUT FORMAT — MUST follow this template, one scene per line, separated by a "===SCENE===" line:

===SCENE===
scene 1 content here
===SCENE===
scene 2 content here
===SCENE===
scene 3 content here

No JSON, no quotation marks around scenes, no numbering. ONLY scenes separated by "===SCENE===".

Script segment:
"""
${batchText}
"""`;
  const parse = (r) => {
    let ps = r.split(/===SCENE===/i).map(s => s.trim()).filter(Boolean);
    if (ps.length && ps[0].length < 80 && !/[.!?…]$/.test(ps[0])) ps = ps.slice(1); // bỏ preamble
    return ps;
  };
  // Hợp lệ khi: model CÓ dùng delimiter + tổng độ dài xấp xỉ kịch bản gốc (chống model trả suy luận/echo prompt)
  const valid = (r, ps, batchText) => {
    if (!ps.length || !/===SCENE===/i.test(r)) return false;
    const ratio = ps.join(' ').length / Math.max(1, batchText.length);
    return ratio >= 0.6 && ratio <= 1.6;
  };

  let doneCount = 0;
  // SONG SONG theo số luồng — các đoạn độc lập, runConcurrent trả kết quả theo ĐÚNG thứ tự
  const results = await runConcurrent(batches, async (batchText, bi) => {
    if (state.cancelRequested) return [];
    let parts;
    try {
      const prompt = buildPrompt(batchText);
      // Thinking OFF: tránh DeepSeek viết suy luận tràn vào output (định dạng ===SCENE===)
      let reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
      parts = parse(reply);
      if (!valid(reply, parts, batchText)) { reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } }); parts = parse(reply); }
      if (!valid(reply, parts, batchText)) {
        console.warn('Smart split đoạn ' + (bi + 1) + ' không hợp lệ → fallback regex');
        parts = splitScenesFast(batchText, min, max);
      }
    } catch (e) {
      console.warn('Smart split đoạn ' + (bi + 1) + ' lỗi → fallback regex:', e.message);
      parts = splitScenesFast(batchText, min, max);
    }
    // Chống "1 cảnh khổng lồ": model hay gộp cả đoạn thành 1 cảnh (thường gặp với tiếng Hàn/Nhật/Trung).
    // Cảnh nào dài bất thường → tách lại theo CÂU bằng bộ tách nhanh (xử lý được dấu . CJK).
    parts = parts.flatMap(pp => (pp && pp.length > max * 1.6) ? splitScenesFast(pp, min, max) : [pp]);
    doneCount++;
    setStatus2(`AI đang chia cảnh... ${doneCount}/${batches.length} phần${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    return parts;
  }, lanes, () => state.cancelRequested);

  // Ghép theo thứ tự đoạn
  results.forEach(parts => { if (Array.isArray(parts)) all.push(...parts); });
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Đã chia được ${all.length} cảnh.`, 'info'); }
  return all;
}

function calcDur(text){
  // ~15 chars per second VO
  return Math.max(2, Math.round(text.length / 15));
}

function _splitTextByDuration(text, maxSec, realDur){
  const estDur = calcDur(text);
  // Dùng độ dài THẬT (đã căn SRT/MP3) nếu lớn hơn ước lượng.
  const totalDur = Math.max((realDur && realDur > 0) ? realDur : 0, estDur);
  if (totalDur <= maxSec) return [text];
  // Số ký tự TƯƠNG ĐƯƠNG maxSec (theo tốc độ đọc của chính cảnh này) → mỗi phần ≤ maxSec dù phân bố giây không đều.
  const charsPerSec = text.length / totalDur;
  const maxChars = Math.max(24, Math.round(maxSec * charsPerSec));
  // Câu cực ngắn (vài từ) → không tách dù giây lớn (chống từ-lẻ)
  if (text.split(/\s+/).filter(Boolean).length < 8) return [text];
  // 1) Tách thành units tại ranh giới CÂU (. ! ? …) rồi MỆNH ĐỀ (, ; : — –)
  let units = [], buf = '';
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (/[.!?…,;:—–]/.test(text[i]) && (text[i + 1] === ' ' || i === text.length - 1)) { units.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) units.push(buf.trim());
  units = units.filter(Boolean);
  // 2) Unit dài hơn maxChars → cắt nhỏ theo TỪ (mỗi mảnh ≥5 từ) để không có phần nào vượt ngưỡng
  const fine = [];
  for (const u of units) {
    if (u.length <= maxChars) { fine.push(u); continue; }
    const w = u.split(/\s+/); let cw = '';
    for (const x of w) {
      const t = cw ? cw + ' ' + x : x;
      if (t.length > maxChars && cw.split(/\s+/).length >= 5) { fine.push(cw); cw = x; }
      else cw = t;
    }
    if (cw) fine.push(cw);
  }
  // 3) GÓI THAM LAM: dồn units vào 1 phần tới khi sắp vượt maxChars → mỗi phần ~ ≤ maxSec
  const parts = [];
  let cur = '';
  for (const u of fine) {
    if (cur && (cur.length + 1 + u.length) > maxChars) { parts.push(cur); cur = u; }
    else cur = cur ? cur + ' ' + u : u;
  }
  if (cur) parts.push(cur);
  return parts.length > 1 ? parts : [text];
}

function mergeFragmentScenes(){
  syncTool2();
  if (!state.scenes || !state.scenes.length) return setStatus2('Chưa có cảnh để gộp. Bấm "Chia Cảnh" trước.', 'error');
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (hasWork && !confirm('Gộp câu sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const endsComplete = t => /[.!?…]["')\]]*\s*$/.test((t || '').trim());
  const out = [];
  let cur = null;
  for (const s of state.scenes) {
    if (!cur) {
      cur = { ...s };
    } else {
      cur.text = (cur.text.trim() + ' ' + (s.text || '').trim()).trim();
      cur.duration = (parseFloat(cur.duration) || 0) + (parseFloat(s.duration) || 0);
      if (!cur.character && s.character) cur.character = s.character;     // giữ nhân vật/bối cảnh đầu tiên có
      if (!cur.background && s.background) cur.background = s.background;
    }
    if (endsComplete(cur.text)) { out.push(cur); cur = null; }
  }
  if (cur) {  // mảnh cuối chưa hoàn chỉnh → nối vào cảnh trước
    if (out.length) {
      const last = out[out.length - 1];
      last.text = (last.text.trim() + ' ' + cur.text.trim()).trim();
      last.duration = (parseFloat(last.duration) || 0) + (parseFloat(cur.duration) || 0);
    } else out.push(cur);
  }

  const before = state.scenes.length;
  state.scenes = out;
  state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
  state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState();
  setStatus2(`✓ Đã gộp câu vụn: ${before} → ${state.scenes.length} cảnh (mỗi cảnh là 1 câu hoàn chỉnh).`, 'ok');
}

async function mergeScenesByMeaningAI(silent){
  if (!silent) syncTool2();
  if (!state.scenes || !state.scenes.length) { if (!silent) setStatus2('Chưa có cảnh để gộp.', 'error'); return; }
  if (state.scenes.length < 2) return;
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (!silent && hasWork && !confirm('Gộp theo ý sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const N = state.scenes.length;
  const maxChars = state.maxChars || 150;
  const list = state.scenes.map((s, i) => `${i + 1}. ${(s.text || '').replace(/\s+/g, ' ').trim()}`).join('\n');
  const prompt = `Below is a numbered list of SCENES (one per line, each is one sentence).
Task: MERGE CONSECUTIVE scenes that share THE SAME VISUAL IDEA (drawable in one single frame) into one group, to reduce fragmentation.

MANDATORY RULES:
- ONLY merge CONSECUTIVE scenes. NEVER cut, NEVER reorder, NEVER skip any scene.
- 1 idea/object/moment = 1 group. Consecutive sentences describing the same visual scene → same group. New idea → new group.
- Do NOT over-merge: each group has at most ~3 sentences or ~${maxChars} characters.
- A sentence that is already one clear idea → keep it as its own group.

Return a JSON array of groups, each group being an array of scene NUMBERS. Each number from 1 to ${N} appears EXACTLY ONCE, in ascending order.
Example: [[1],[2,3],[4],[5,6,7]]
Print ONLY the JSON, no explanation.

LIST (${N} scenes):
${list}`;

  try {
    if (!silent) setStatus2('AI đang gộp cảnh theo ý...', 'working');
    // callLLMJson: lặp + ép JSON + chỉ nhận nhóm phủ ĐÚNG 1..N, mỗi số 1 lần, đúng thứ tự
    let groups;
    try {
      groups = await callLLMJson(prompt, {
        maxTokens: Math.min(8000, 1500 + N * 12),
        validate: g => { const f = Array.isArray(g) ? g.flat() : []; return Array.isArray(g) && f.length === N && f.every((n, i) => n === i + 1); }
      });
    } catch (e) {
      console.warn('Gộp theo ý: nhóm không hợp lệ → giữ nguyên.', e.message);
      if (!silent) setStatus2('⚠️ AI gộp ý không hợp lệ → giữ nguyên cảnh.', 'info');
      return;
    }
    const out = groups.map(g => {
      const items = g.map(n => state.scenes[n - 1]);
      const base = { ...items[0] };
      base.text = items.map(s => (s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
      base.duration = items.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
      base.character = (items.find(s => s.character) || {}).character || '';
      base.background = (items.find(s => s.background) || {}).background || '';
      return base;
    });
    const before = N;
    state.scenes = out;
    state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
    state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
    renderAllT2();
    if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
    saveState();
    if (!silent) setStatus2(`✓ Gộp theo ý (AI): ${before} → ${state.scenes.length} cảnh.`, 'ok');
  } catch (e) {
    console.error(e);
    if (!silent) setStatus2('Lỗi gộp theo ý: ' + e.message, 'error');
  }
}

function _balanceScenesCore(minSec, maxSec){
  // 1) TÁCH cảnh DÀI > maxSec thành các phần ≤ maxSec (gói theo ký tự tương đương giây) — gán giây theo tỉ lệ ký tự
  const split = [];
  for (const s of state.scenes) {
    const sdur = parseFloat(s.duration) || calcDur(s.text);
    const parts = _splitTextByDuration(s.text, maxSec, sdur);
    if (parts.length <= 1) { split.push({ ...s, duration: sdur }); continue; }
    const totalChars = parts.reduce((a, t) => a + t.length, 0) || 1;
    parts.forEach(t => split.push({ ...s, text: t, duration: +(sdur * t.length / totalChars).toFixed(1) }));
  }
  // 2) GỘP các cảnh NGẮN liền kề (kể cả đuôi vụn vừa tách ra) lên tới band, không vượt max → hết cảnh quá ngắn
  const out = [];
  let cur = null;
  for (const s of split) {
    const sd = parseFloat(s.duration) || calcDur(s.text);
    if (!cur) { cur = { ...s }; cur.duration = sd; }
    else if ((cur.duration < minSec || sd < minSec) && (cur.duration + sd) <= maxSec) {
      cur.text = (cur.text.trim() + ' ' + (s.text || '').trim()).trim();
      cur.duration += sd;
      if (!cur.character && s.character) cur.character = s.character;
      if (!cur.background && s.background) cur.background = s.background;
    } else { out.push(cur); cur = { ...s }; cur.duration = sd; }
  }
  if (cur) out.push(cur);

  // 3) HÚT cảnh quá NGẮN còn lẻ (kẹp giữa 2 cảnh to) vào hàng xóm NGẮN HƠN — cho nới max ~20% để khử hẳn cảnh lẻ
  const SLACK = maxSec * 1.2;
  let changed = true, guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      if (out.length <= 1) break;
      const sd = parseFloat(out[i].duration) || 0;
      if (sd >= minSec) continue;                       // không ngắn → bỏ qua
      const cands = [];
      if (i > 0) cands.push({ idx: i - 1, dur: parseFloat(out[i - 1].duration) || 0, side: 'prev' });
      if (i < out.length - 1) cands.push({ idx: i + 1, dur: parseFloat(out[i + 1].duration) || 0, side: 'next' });
      cands.sort((a, b) => a.dur - b.dur);              // ưu tiên hàng xóm NGẮN HƠN
      const pick = cands.find(c => (c.dur + sd) <= SLACK);
      if (!pick) continue;                              // cả 2 bên đều vượt slack → đành để lẻ
      const tgt = out[pick.idx], cu = out[i];
      tgt.text = pick.side === 'prev'
        ? (tgt.text.trim() + ' ' + cu.text.trim()).trim()
        : (cu.text.trim() + ' ' + tgt.text.trim()).trim();
      tgt.duration = (parseFloat(tgt.duration) || 0) + sd;
      if (!tgt.character && cu.character) tgt.character = cu.character;
      if (!tgt.background && cu.background) tgt.background = cu.background;
      out.splice(i, 1);
      changed = true;
      break;                                            // mảng đổi → quét lại
    }
  }

  // Cap theo tier
  const maxScenes = getMaxScenes();
  if (out.length > maxScenes) out.length = maxScenes;
  state.scenes = out;
  state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
  state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
  renderAllT2();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  saveState();
}

function _t2FitToAudio(){
  const sc = state.scenes || [];
  const audio = (typeof _t2AudioDurCache === 'number') ? _t2AudioDurCache : 0;
  if (!sc.length || !(audio > 0)) return null;
  const tot = sc.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
  if (!(tot > 0)) return null;
  const diff = tot - audio;
  if (Math.abs(diff) < 0.5) return { diff: 0, before: tot, after: tot };
  const k = audio / tot;
  // Làm tròn 0,1s mỗi cảnh × 183 cảnh vẫn trôi gần 1s nếu chỉ bù ở cảnh cuối.
  // Giữ phần dư và bù ngay cảnh kế → tổng khớp tuyệt đối, không cảnh nào lệch quá 0,1s.
  let run = 0, carry = 0;
  sc.forEach((s, i) => {
    if (i === sc.length - 1) return;
    const want = (parseFloat(s.duration) || 0) * k + carry;
    const got = Math.max(0.5, +want.toFixed(1));
    carry = want - got;
    s.duration = got; run += got;
  });
  sc[sc.length - 1].duration = Math.max(0.5, +(audio - run).toFixed(1));
  return { diff: +diff.toFixed(1), before: +tot.toFixed(1), after: audio };
}

function balanceScenes(){
  syncTool2();
  if (!state.scenes || !state.scenes.length) return setStatus2('Chưa có cảnh. Bấm "Chia Cảnh" trước.', 'error');
  const maxSec = parseInt(document.getElementById('maxSecPerImg')?.value) || 8;
  let minSec = parseInt(document.getElementById('minSecPerImg')?.value);
  if (!(minSec >= 1)) minSec = Math.max(2, Math.round(maxSec / 2.5));
  if (minSec >= maxSec) minSec = Math.max(2, maxSec - 2);
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (hasWork && !confirm('Cân đều cảnh sẽ đổi ranh giới → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;
  const before = state.scenes.length;
  _balanceScenesCore(minSec, maxSec);
  const fit = _t2FitToAudio();                     // chia lại xong PHẢI khớp lại audio
  setStatus2(`✓ Đã cân đều: ${before} → ${state.scenes.length} cảnh, mỗi ảnh ~${minSec}–${maxSec}s.`
    + (fit && fit.diff ? ` Đã bù ${Math.abs(fit.diff).toFixed(1)}s cho khớp audio.` : ''), 'ok');
}

