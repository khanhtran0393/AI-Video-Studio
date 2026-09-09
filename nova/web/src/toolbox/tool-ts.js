/* AUTO-EXTRACTED from index.html block 3 - prefix: ts */

function tsSetWords(n){
  const el = document.getElementById('tsWords'); if (el) el.value = n;
  document.querySelectorAll('#tool-toolscript .ts-chip').forEach(ch => ch.classList.toggle('on', parseInt(ch.textContent) === n));
  tsEstimate();
}

function tsEstimate(){
  const w = parseInt(document.getElementById('tsWords')?.value) || 0;
  const mins = w / 150;   // ~150 từ/phút khi đọc TTS
  const el = document.getElementById('tsWordEst');
  if (el) el.textContent = w ? `≈ ${mins < 1 ? Math.round(mins * 60) + ' giây' : mins.toFixed(1).replace('.0','') + ' phút'} đọc` : '';
  document.querySelectorAll('#tool-toolscript .ts-chip').forEach(ch => ch.classList.toggle('on', parseInt(ch.textContent) === w));
}

function tsInit(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const nameEl = document.getElementById('tsProfName'); if (nameEl) nameEl.textContent = p?.tenKenh ? '· ' + p.tenKenh : '';
  const pp = document.getElementById('tsProfPrompt');
  if (pp) pp.textContent = (p?.scriptPrompt || '').trim() || 'Chưa có — bấm "Sửa ở Profile" để thêm phong cách viết kịch bản cho kênh.';
  // Trạng thái nút Novel (giữ giữa các phiên app) — chỉ khôi phục khi QUY MÔ
  // vẫn hợp lệ (≥ 2 chương); localStorage cũ lệch điều kiện thì xoá sạch.
  const nb = document.getElementById('tsNovelBtn');
  if (nb && localStorage.getItem('ts_novel_mode') === '1'){
    const ch = parseInt(document.getElementById('tsChapters')?.value) || 1;
    if (ch < 2){
      try { localStorage.setItem('ts_novel_mode', '0'); } catch (e) {}
    } else {
      nb.classList.add('on');
      const h = document.getElementById('tsNovelHint'); if (h) h.style.display = '';
    }
  }
  tsEstimate(); tsOutMeta();
}

async function tsGenerate(rewrite){
  const topic = document.getElementById('tsTopic')?.value.trim();
  if (!topic){ setStatusScript('Nhập chủ đề / tiêu đề trước.', 'error'); return; }
  const words = parseInt(document.getElementById('tsWords')?.value) || 800;
  const lang = document.getElementById('tsLang')?.value || 'Tiếng Việt';
  const tone = document.getElementById('tsTone')?.value || 'Kể chuyện cuốn hút';
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const sp = (p?.scriptPrompt || '').trim();
  // Chế độ Novel (chip 📖 bật): pipeline viết theo chương + memory xuyên suốt.
  // Luồng thường (1 lần gọi) giữ nguyên — tắt chip là quay về y như cũ.
  if (tsNovelOn()){
    // Novel yêu cầu QUY MÔ ≥ 2 chương (chip đã chặn bật khi < 2 — tsToggleNovel).
    // Nếu vẫn lọt vào đây do state lệch (vd localStorage cũ) → chết LỘ LIỄU,
    // KHÔNG tự tách chương ngầm (Luật 10).
    const n = parseInt(document.getElementById('tsChapters')?.value) || 0;
    if (n < 2){
      setStatusScript('Chế độ Novel cần tối thiểu 2 chương trong khối QUY MÔ (đang là ' + (n || 1) + ') — chỉnh CHƯƠNG ≥ 2 hoặc tắt chip Novel.', 'error');
      return;
    }
    // chWords tính từ tổng words/n (không đọc trực tiếp tsWordsPerChapter) để
    // không lệch tổng khi user chọn số từ bằng chip tsSetWords().
    const chWords = Math.max(100, Math.round(words / n));
    return tsGenerateNovel({ topic, words, lang, tone, style: sp, rewrite: !!rewrite,
      n, chWords });
  }
  const buildPrompt = (style) =>
`You are a professional voiceover scriptwriter for faceless YouTube videos.
TASK: Write ONE complete voiceover script for this topic: "${topic}".
LANGUAGE: ${lang}. TONE: ${tone}. LENGTH: about ${words} words (max 10% deviation).
${style ? 'CHANNEL STYLE — MUST follow (but the LENGTH rules below override any word counts inside it):\n' + style.replace(/\{\{\s*WORDS\s*\}\}/gi, String(words)) + '\n' : ''}${rewrite ? 'Write a DIFFERENT version with a fresh angle and a new opening compared to the usual approach.\n' : ''}
LENGTH — top priority, overrides any numbers found in the channel style:
- Ignore any word counts written in the channel style.
- The total script length MUST be about ${words} words (max 10% deviation). Rescale the number of sections and their proportions to fit ${words} words — keep the structure and voice of the channel style but compress or expand to hit ${words} words.
RETENTION — ${style ? 'baseline; wherever the CHANNEL STYLE above says otherwise, follow the CHANNEL STYLE' : 'required'}:
- First 15 seconds: the opening sentence must be at most 15 words and jump straight into the story. Do not open with a year, a setting, or a definition. Banned openers: "Hãy tưởng tượng", "Bạn có biết".
- Open loop: plant a contradiction or an unanswered question right in the hook. Call it back 2-3 times spread evenly through the script, each time adding a new detail (never repeat verbatim), and resolve it near the end.
- Object through-line: pick one small concrete object or detail, plant it in the opening, bring it back at least twice, once near the end.
- Every paragraph must push exactly ONE new thing (an event, a number, a consequence) — never restate the previous idea in different words.
- Forbidden: transition signposts like "ít ai biết rằng", addressing the audience ("các bạn ơi"), moralizing, syrupy endings.
OUTPUT RULES (very important):
- Return ONLY the narration text as one flowing piece. The first character must be the first letter of the script's opening sentence.
- Absolutely no lead-in such as "The script is complete...", "Here it is:", "Here is the script", "Đây là kịch bản", "Dưới đây là", and no word counts.
- No titles, no "Kịch bản:" lines, no numbering, no [Intro]/[Hook]/[Kết] labels, no director notes, no emoji, no markdown, no bullet points.
- Split into short paragraphs of 2-4 sentences, easy to read aloud for an AI voice (TTS). Start immediately with the hook; end with a closing line.
Return only the script content, nothing else.`;
  const btn = document.getElementById('tsGenBtn'); if (btn) btn.disabled = true;
  const _tk = _startElapsed('✍️ Đang viết kịch bản', setStatusScript,
    'bản dài / chạy bằng gói Claude-ChatGPT có thể chờ vài phút — cứ để yên');
  try {
    const maxT = Math.min(16000, Math.round(words * 2.5) + 600);
    // Channel Style còn viết bằng tiếng Việt (tạo trước bản sửa prompt này) có thể bị content
    // filter của gateway chặn cả prompt. Khi lỗi/rỗng mà có style → thử lại 1 lần KHÔNG kèm
    // style, để user vẫn có kịch bản thay vì chết lỗi.
    let raw = '';
    try { raw = await callLLM(buildPrompt(sp), { maxTokens: maxT }); }
    catch (e){ if (!sp) throw e; }
    if ((!raw || !String(raw).trim()) && sp){
      raw = await callLLM(buildPrompt(''), { maxTokens: maxT });
    }
    _stopElapsed(_tk);
    const clean = _tsClean(raw);
    const out = document.getElementById('tsOutput'); if (out) out.value = clean;
    tsOutMeta();
    setStatusScript('✓ Đã viết xong. Kiểm tra rồi Đưa vào Giọng nói / Sang Phân Cảnh.', 'ok');
  } catch (e){ _stopElapsed(_tk); setStatusScript('Lỗi: ' + (e.message || e), 'error'); }
  if (btn) btn.disabled = false;
}

function tsNovelOn(){
  const b = document.getElementById('tsNovelBtn');
  return !!(b && b.classList.contains('on'));
}

function tsToggleNovel(){
  const b = document.getElementById('tsNovelBtn'); if (!b) return;
  const turningOn = !b.classList.contains('on');
  if (turningOn){
    // Điều kiện bật Novel: QUY MÔ tối thiểu 2 chương (memory xuyên suốt chỉ có
    // ý nghĩa từ chương 2 trở đi). Chặn bật + báo rõ, không tự tách chương ngầm.
    const ch = parseInt(document.getElementById('tsChapters')?.value) || 1;
    if (ch < 2){
      setStatusScript('Chế độ Novel cần tối thiểu 2 chương — chỉnh CHƯƠNG trong khối QUY MÔ lên ≥ 2 rồi bật lại.', 'error');
      return;
    }
  }
  b.classList.toggle('on');
  const on = b.classList.contains('on');
  try { localStorage.setItem('ts_novel_mode', on ? '1' : '0'); } catch (e) {}
  const h = document.getElementById('tsNovelHint'); if (h) h.style.display = on ? '' : 'none';
}

async function tsGenerateNovel(o){
  const btn = document.getElementById('tsGenBtn'); if (btn) btn.disabled = true;
  const out = document.getElementById('tsOutput'); if (out) out.value = '';
  const _tk = _startElapsed('📖 Novel · đang dựng khung truyện', setStatusScript,
    'chế độ Novel viết từng chương + ghi nhớ sau mỗi chương — chậm hơn thường, cứ để yên');
  try {
    const bible = await _tsNovelArchitect(o);
    const chapters = (bible.chapters || []).map((c) => ({
      title: String((c && c.title) || ''), goal: String((c && c.goal) || ''),
      words: parseInt(c && c.words) || o.chWords,
    }));
    if (chapters.length < 2) throw new Error('Architect trả về ít hơn 2 chương.');
    o.n = chapters.length;
    const mem = {
      chapters: [], states: {},
      threads: (bible.threads || []).map((t) => ({
        id: (String((t && t.id) || '').trim().toUpperCase() || 'T?'),
        name: String((t && t.name) || ''), status: 'open', note: String((t && t.description) || ''),
      })),
    };
    setStatusScript(`📖 Khung truyện xong: ${o.n} chương · ${(bible.characters || []).length} nhân vật · ${mem.threads.length} tuyến. Bắt đầu viết từng chương…`, 'working');
    const parts = [];
    for (let i = 0; i < chapters.length; i++){
      const ch = chapters[i];
      const raw = await callLLM(_tsNovelChapterPrompt(o, bible, mem, ch, i),
        { maxTokens: Math.min(16000, Math.round(ch.words * 2.5) + 600) });
      const clean = _tsClean(raw);
      if (!clean) throw new Error('Chương ' + (i + 1) + '/' + o.n + ' trả về rỗng.');
      parts.push(clean);
      if (out){ out.value = parts.join('\n\n'); tsOutMeta(); }   // ghi dần: lỗi giữa chừng không mất chương đã viết
      if (i < chapters.length - 1){
        setStatusScript(`📖 Novel · Chương ${i + 1}/${o.n} xong · đang ghi nhớ (tóm tắt + nhân vật + tuyến)…`, 'working');
        let up = null;
        try { up = await _tsNovelRemember(clean, bible, mem, i); }
        catch (e){   // Luật 10: degrade LỘ LIỄU, không nuốt lỗi
          setStatusScript(`⚠ Chương ${i + 1}: trích memory lỗi (${String(e.message || e).slice(0, 70)}) — tạm dùng 4 câu đầu chương làm tóm tắt.`, 'error');
          up = { summary: clean.split(/(?<=[.!?…])\s+/).slice(0, 4).join(' '), stateChanges: [], threads: [] };
        }
        _tsNovelMerge(mem, up, ch.title);
      }
    }
    _stopElapsed(_tk);
    setStatusScript(`✓ Novel xong: ${o.n} chương · ${_tsWordCount(parts.join(' '))} từ. Kiểm tra rồi Đưa vào Giọng nói / Sang Phân Cảnh.`, 'ok');
  } catch (e){
    _stopElapsed(_tk);
    setStatusScript('Lỗi Novel: ' + (e.message || e) + (out && out.value.trim() ? ' — phần chương đã viết còn trong ô Kịch bản.' : ''), 'error');
  }
  if (btn) btn.disabled = false;
}

function tsOutMeta(){
  const t = document.getElementById('tsOutput')?.value || '';
  const w = _tsWordCount(t); const mins = w / 150;
  const el = document.getElementById('tsOutMeta');
  if (el) el.textContent = w ? `· ${w} từ · ~${mins < 1 ? Math.round(mins*60)+'s' : mins.toFixed(1).replace('.0','')+' phút'}` : '';
}

function tsCopy(){
  const t = document.getElementById('tsOutput')?.value || '';
  if (!t.trim()){ setStatusScript('Chưa có kịch bản.', 'error'); return; }
  try { navigator.clipboard.writeText(t); setStatusScript('📋 Đã copy kịch bản.', 'ok'); } catch (e){ setStatusScript('Không copy được.', 'error'); }
}

function tsToVoice(){
  const t = document.getElementById('tsOutput')?.value.trim();
  if (!t){ setStatusScript('Chưa có kịch bản để đưa vào giọng nói.', 'error'); return; }
  const vt = document.getElementById('voiceText'); if (vt) vt.value = t;
  switchTool('toolvoice');
}

function tsToScenes(){
  const t = document.getElementById('tsOutput')?.value.trim();
  if (!t){ setStatusScript('Chưa có kịch bản để phân cảnh.', 'error'); return; }
  state.script = t;
  const si = document.getElementById('scriptInput'); if (si) si.value = t;
  try { if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile(); if (typeof saveState === 'function') saveState(true); } catch (e) {}
  switchTool('tool2');
}

async function tsAnalyzeCompetitor(files){
  const arr = Array.from(files || []); if (!arr.length) return;
  const p = getProfile(); if (!p){ alert('Chưa có Profile. Tạo Profile trước.'); return; }
  const st = document.getElementById('pScriptAnalyzeStatus');
  const setSt = (m, c) => { if (st){ st.textContent = m; st.style.color = c || 'var(--text-muted)'; } };
  setSt('Đang đọc ' + arr.length + ' file…', 'var(--violet)');
  // Đọc tối đa 6 file; cắt tổng ~48k ký tự để không tràn ngữ cảnh.
  const picked = arr.slice(0, 6);
  const perFile = Math.max(4000, Math.floor(48000 / picked.length));
  const texts = [];
  for (const f of picked){
    try { const t = await f.text(); if (t && t.trim()) texts.push({ name: f.name, text: t.trim().slice(0, perFile) }); } catch (e) {}
  }
  if (!texts.length){ setSt('Không đọc được nội dung (chọn file .txt).', 'var(--red)'); return; }
  const n = texts.length;
  setSt('🤖 AI đang phân tích ' + n + ' kịch bản (9 lớp → prompt 8 khối)…', 'var(--violet)');
  const joined = texts.map((x, i) => `━━━ KỊCH BẢN ${i + 1} (${x.name}) ━━━\n${x.text}`).join('\n\n');
  const prompt =
`You are an expert analyst of VIRAL faceless video scripts and a master META-PROMPT writer — you produce the detailed instruction set that another AI will use to write a NEW script in the same style. Below are ${n} SUCCESSFUL sample scripts from channel(s) in the same niche.

${joined}

Work in 2 steps. Output ONLY the result of Step 2.

STEP 1 — ANALYZE (do it in your head, MEASURE WITH NUMBERS, do not output it; a trait only becomes a "rule" when it repeats in ${n > 1 ? 'most of the ' + n + ' scripts' : 'the script'}). Extract: genre & writer persona; emotional goal; narrative PERSON + TENSE; narration language. Structure: number of parts/chapters, PERCENTAGE split for opening/body/ending (use %, never fixed word counts). Hook: what the first 2-3 sentences do, opening pattern, first-sentence length, whether a year is mentioned. Body beats: the repeating formula per block + how invisible transitions are made. Voice: average sentence length, frequency of short punchy sentences, signature words/phrases, banned words, number of rhetorical questions. Retention devices: backbone mystery, open loop, object motif, reframe line, dramatic irony, sting line, micro-payoff. Energy curve (2 axes) + position of the emotional peak. Ending: closing pattern, final line. Guardrails: how real numbers/names/dates are used and hedged.

STEP 2 — WRITE THE "SCRIPT PROMPT": a COMPLETE, DETAILED META-PROMPT, ready to paste for another AI to write a NEW script in this viral style. Write the INSTRUCTIONS IN ENGLISH (the narration itself will still be written in the language detected in Step 1 — state that language in block 2); quoted example lines stay in their original language verbatim. Use the NUMBERS/RATIOS extracted in Step 1, specific enough that reading it is enough to start writing. Include these numbered blocks:

1. ROLE — writer persona + genre + emotional goal (one punchy paragraph, like "You are… The viewer does NOT learn about X; the viewer IS…").
2. OUTPUT — absolute TTS rules: ONLY flowing narration; state the PERSON + TENSE extracted in Step 1; numbers & money SPELLED OUT as words; no titles/labels/emoji/markdown/symbols; standard punctuation only; state the narration language detected in Step 1 (e.g. Vietnamese).
3. LENGTH & BUDGET — Total ≈ {{WORDS}} words (use the EXACT string {{WORDS}}, NEVER replace it with a number). Split into N parts by PERCENTAGE (e.g. hook ~13%, body ~74%, ending ~13%); each block states its % of the total, NEVER a fixed word count. Add an anti-shrink rule: the final blocks must keep the same budget as the first ones — do not compress just to finish early.
4. HIDDEN SKELETON / FORMAT — the genre's beats spread evenly across the parts; NEVER name beats/format inside the narration. The viewer must only FEEL the structure, never see the map.
5. LENS — 4-6 angles so no two videos feel the same; name the default lens + one "seasoning-only" lens. (The thumbnail already shouts — the narration must not.)
6. ENERGY CURVE — 2 opposing axes fitting the genre; save the emotional peak for near the end; ANTI-FOG rule: every part must push ONE new thing, not just repaint the atmosphere.
7. RETENTION DEVICES — keep only what fits the genre, each with 1 sentence on how: backbone mystery, quiet/hard open loop, OBJECT MOTIF (a small object planted in the opening, returning at least twice, once near the end), REFRAME LINE, NARRATIVE GAP/dramatic irony, STING LINE, micro-payoff.
8. HOOK — first-15-seconds rules (first sentence ≤ ~15 words; no year in the opening; banned opener "Imagine you are"); 1 open loop planted in the hook, re-teased 2-3 times, resolved in the ending; include a HOOK-BANK of 8-10 rotating archetypes (a different one each video), written fresh, with short samples for "feel".
9. VOICE & RHYTHM — person + tense; sentence length (in words); interspersed short sentences; syntactic repetition (anaphora); cap on rhetorical questions; signature vocabulary.
10. BANNED — cliché openers; transition signposts ("little did you know"…); addressing the audience; preaching; syrupy endings; bragging; symbols that are hard to read for TTS.
11. EVIDENCE & GUARDRAILS — use REAL numbers/names/dates + everyday comparisons; honest hedging; NEVER invent fake names–years–precise numbers.
12. ENDING (anti-formula) — the closing sequence + 3-5 rotating ending patterns so no two videos end the same; a sample final line if any.
13. FEW-SHOT — 2-3 short VERBATIM excerpts from the sample scripts (a hook, a transition line, the closing line) as exemplary models.
14. SELF-CHECK — a silent checklist to run before submitting (does it hit {{WORDS}} words by ratio? right person/tense? strong enough hook? does the object motif return? clean for TTS? ending pattern not repeated?).

OUTPUT: return ONLY the "SCRIPT PROMPT" content (the numbered blocks), do NOT print Step 1, no extra lead-in. You MUST keep the string {{WORDS}} verbatim in blocks 3 and 14 so the tool can inject the word count — NEVER replace {{WORDS}} with a number.`;
  try {
    const raw = await callLLM(prompt, { maxTokens: 8000 });
    p.scriptPrompt = _tsCleanPrompt(raw);
    if (typeof saveState === 'function') saveState(true);
    renderProfileStyles();
    if (typeof setStatus1 === 'function') setStatus1('✓ Đã phân tích ' + n + ' kịch bản → tạo Prompt kịch bản viral (9 lớp → 8 khối).' + (n < 3 ? ' 💡 Nên gửi ≥3 kịch bản để rút "luật" chuẩn hơn.' : ''), 'ok');
  } catch (e){ setSt('Lỗi phân tích: ' + (e.message || e), 'var(--red)'); }
}

