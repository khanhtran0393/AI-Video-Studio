/* AUTO-EXTRACTED from index.html block 3 - prefix: ts */

function tsSetWords(n){
  const el = document.getElementById('tsWords'); if (el) el.value = n;
  document.querySelectorAll('#tool-toolscript .ts-chip').forEach(ch => ch.classList.toggle('on', parseInt(ch.textContent) === n));
  tsEstimate();
}

function tsEstimate(){
  const w = parseInt(document.getElementById('tsWords')?.value) || 0;
  // Ô ước lượng tsWordEst đã bỏ trong redesign — chỉ còn chip chọn số từ.
  document.querySelectorAll('#tool-toolscript .ts-chip').forEach(ch => ch.classList.toggle('on', parseInt(ch.textContent) === w));
}

function tsInit(){
  // (Đã bỏ hiển thị "📋 Prompt kịch bản (từ Profile)" — tab này không còn đọc Profile.)
  // Trạng thái nút gạt Novel (giữ giữa các phiên app) — chỉ khôi phục khi QUY MÔ
  // vẫn hợp lệ (≥ 2 chương); localStorage cũ lệch điều kiện thì xoá sạch.
  const nb = document.getElementById('tsNovelBtn');
  if (nb && localStorage.getItem('ts_novel_mode') === '1'){
    const ch = parseInt(document.getElementById('tsChapters')?.value) || 1;
    if (ch < 2){
      try { localStorage.setItem('ts_novel_mode', '0'); } catch (e) {}
    } else {
      nb.checked = true;
      const h = document.getElementById('tsNovelHint'); if (h) h.style.display = '';
    }
  }
  tsEstimate(); tsOutMeta();
}

/* ── 📺 NGUỒN YOUTUBE (source-brief · P1) ──────────────────────────────
   Nạp hồ sơ nguồn thật từ video YouTube (metadata + chapters + heatmap +
   transcript + bình luận) qua IPC `viralCut:buildBrief` — rồi tsGenerate
   dùng làm NGUỒN viết kịch bản thay vì bịa từ đầu. Không có nguồn → hành
   vi cũ giữ nguyên. Video không phụ đề → lỗi lộ liễu VC_YT_NO_CAPTION. */
let tsYtBrief = null; // { title, durationSec, lang, text, jsonPath, txtPath, comments }

async function tsNapNguon(){
  const url = (document.getElementById('tsYtUrl')?.value || '').trim();
  if (!url){ setStatusScript('Dán link video YouTube vào ô nguồn trước.', 'error'); return; }
  if (!window.native || !window.native.viralCut || typeof window.native.viralCut.buildBrief !== 'function'){
    setStatusScript('Nguồn YouTube chỉ chạy trong app Nova.', 'error');
    return;
  }
  const btn = document.getElementById('tsYtBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang lấy nguồn…'; }
  setStatusScript('Đang tạo hồ sơ nguồn YouTube (phụ đề + chương + heatmap + bình luận)…', 'working');
  try {
    const r = await window.native.viralCut.buildBrief({ url });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Không rõ lỗi.');
    tsYtBrief = { title: r.title, durationSec: r.durationSec, lang: r.lang, text: r.text,
      jsonPath: r.jsonPath, txtPath: r.txtPath, comments: r.comments };
    const info = document.getElementById('tsYtInfo');
    if (info){
      const phut = Math.max(0, Math.round((r.durationSec || 0) / 60));
      info.textContent = '📺 ' + r.title + ' · ' + phut + ' phút'
        + (r.lang ? ' · phụ đề ' + r.lang : '')
        + ' · ' + r.transcriptChars + ' ký tự transcript'
        + ' · ' + r.comments + ' bình luận — đã sẵn sàng làm NGUỒN cho "Viết kịch bản".';
    }
    setStatusScript('✓ Đã nạp nguồn YouTube. Bấm "Viết kịch bản" — AI sẽ viết DỰA TRÊN nguồn này.', 'ok');
  } catch (e){
    tsYtBrief = null;
    setStatusScript('Lỗi lấy nguồn YouTube: ' + String((e && e.message) || e).slice(0, 160), 'error');
  }
  if (btn){ btn.disabled = false; btn.textContent = '📺 Lấy nguồn'; }
}

function tsXoaNguon(){
  tsYtBrief = null;
  const inp = document.getElementById('tsYtUrl'); if (inp) inp.value = '';
  const info = document.getElementById('tsYtInfo');
  if (info) info.textContent = 'Khi có nguồn: AI viết kịch bản DỰA TRÊN hồ sơ nguồn (transcript + chương + đoạn được xem lại nhiều + bình luận) thay vì bịa từ đầu. Cần video có phụ đề.';
  setStatusScript('Đã bỏ nguồn YouTube — viết theo chủ đề thuần như cũ.', 'info');
}

function tsNguonDangBat(){ return !!(tsYtBrief && tsYtBrief.text); }

/* Ghi chú diễn giải cho từng Bút pháp kể chuyện (đưa vào prompt tiếng Anh). */
/* Bản EN rút gọn CHO RIÊNG prompt tool-ts — KHÔNG được tên `_tsButPhapNote`!
   Tên `_tsButPhapNote` là của utility/ts-prompt.js (bảng _TS_BUT_PHAP giàu chi tiết
   pov/pace/voice/dialogue/address/close) mà utility/ts.js dùng để dựng prompt Novel;
   bản này từng ĐÈ LẶNG LẼ vì tool-ts.js nạp sau (index.html:188 > 138) làm prompt
   Novel mất chi tiết bút pháp → đổi tên thành _tsButPhapNoteEn. */
function _tsButPhapNoteEn(tone){
  if (tone === 'Review ở góc nhìn thứ 3') return 'third-person review/commentary — the narrator analyzes and reviews the subject from an outside perspective, no character dialogue';
  if (tone === 'Tự sự - lời thoại của nhân vật') return 'narration woven with short character dialogue lines — dialogue appears inline inside the flowing narration, no speaker labels';
  if (tone === 'Review - lời thoại') return 'third-person review mixed with short character/subject dialogue lines woven inline into the commentary, no speaker labels';
  return 'natural storytelling voice';
}

async function tsGenerate(rewrite){
  const topic = document.getElementById('tsTopic')?.value.trim();
  if (!topic){ setStatusScript('Nhập chủ đề / tiêu đề trước.', 'error'); return; }
  const words = parseInt(document.getElementById('tsWords')?.value) || 800;
  const lang = document.getElementById('tsLang')?.value || 'Tiếng Việt';
  const tone = document.getElementById('tsTone')?.value || 'Tự sự thuần';
  const skill = (document.getElementById('tsSkill')?.value || '').trim();
  // Hướng dẫn chi tiết của skill tự thêm từ Skill panel (sidebar · Cài đặt · Skill).
  // Skill cài sẵn chỉ có tên → sklGuideFor trả rỗng, prompt giữ nguyên như cũ.
  const sklGuide = (typeof sklGuideFor === 'function') ? sklGuideFor(skill) : '';
  const lever = (document.getElementById('tsLever')?.value || '').trim();
  const cta = !!document.getElementById('tsCta')?.checked;
  // Chế độ Novel (nút gạt 📖 bật): pipeline viết theo chương + memory xuyên suốt.
  // Luồng thường (1 lần gọi) giữ nguyên — tắt gạt là quay về y như cũ.
  const coNguon = (typeof tsNguonDangBat === 'function') && tsNguonDangBat();
  if (tsNovelOn()){
    // Nguồn YouTube (source-brief) chỉ cài cho luồng thường: pipeline Novel
    // dựng truyện theo chương từ topic, không đọc hồ sơ nguồn → chặn lộ liễu,
    // KHÔNG âm thầm bỏ nguồn (Luật 10).
    if (coNguon){
      setStatusScript('Nguồn YouTube (source-brief) chưa hỗ trợ chế độ Novel — bấm ✕ để bỏ nguồn hoặc tắt nút gạt Novel.', 'error');
      return;
    }
    // Novel yêu cầu QUY MÔ ≥ 2 chương (nút gạt đã chặn bật khi < 2 — tsToggleNovel).
    // Nếu vẫn lọt vào đây do state lệch (vd localStorage cũ) → chết LỘ LIỄU,
    // KHÔNG tự tách chương ngầm (Luật 10).
    const n = parseInt(document.getElementById('tsChapters')?.value) || 0;
    if (n < 2){
      setStatusScript('Chế độ Novel cần tối thiểu 2 chương trong khối QUY MÔ (đang là ' + (n || 1) + ') — chỉnh CHƯƠNG ≥ 2 hoặc tắt nút gạt Novel.', 'error');
      return;
    }
    // chWords tính từ tổng words/n (không đọc trực tiếp tsWordsPerChapter) để
    // không lệch tổng khi user chọn số từ bằng chip tsSetWords().
    const chWords = Math.max(100, Math.round(words / n));
    return tsGenerateNovel({ topic, words, lang, tone, skill, lever, cta,
      rewrite: !!rewrite, n, chWords });
  }
  const styleNote = _tsButPhapNoteEn(tone);   // bản EN rút gọn của tool-ts (bản RICH _tsButPhapNote của ts-prompt.js dành cho pipeline Novel trong utility/ts.js)
  // extras = Đòn bẩy tâm lý + Kỹ năng viết + CTA (do người dùng chọn trên UI).
  const buildPrompt = (withExtras) =>
`You are a professional voiceover scriptwriter for faceless YouTube videos.
TASK: Write ONE complete voiceover script for this topic: "${topic}".${coNguon ? ' The script must be BASED ON THE SOURCE MATERIAL below — use its real facts, story and numbers; do NOT invent contradictory facts.' : ''}
LANGUAGE: ${lang}. NARRATIVE STYLE (bút pháp kể chuyện): ${tone} — ${styleNote}.
${_tsPVanHoaSpec(lang)}
${withExtras && skill ? _tsPSkillSpec(skill) + '\n' : ''}${withExtras && lever ? _tsPLeverSpec(lever) + '\n' : ''}${withExtras && cta ? _tsPCtaSpec() + '\n' : ''}${coNguon ? 'SOURCE MATERIAL (source-brief: transcript verbatim + chapters + most-replayed windows + top viewer comments). The topic above is the ANGLE — this material is the FACTS:\n' + tsYtBrief.text + '\n' : ''}${rewrite ? 'Write a DIFFERENT version with a fresh angle and a new opening compared to the usual approach.\n' : ''}
LENGTH — top priority:
- The total script length MUST be about ${words} words (max 10% deviation). Rescale the number of sections and their proportions to fit ${words} words — keep the same structure and voice but compress or expand to hit ${words} words.
RETENTION — required:
- First 15 seconds: the opening sentence must be at most 15 words and jump straight into the story. Do not open with a year, a setting, or a definition. Banned openers: "Hãy tưởng tượng", "Bạn có biết".${lever ? ' (The psychological lever above shapes this opening.)' : ''}
- Open loop: plant a contradiction or an unanswered question right in the hook. Call it back 2-3 times spread evenly through the script, each time adding a new detail (never repeat verbatim), and resolve it near the end.
- Object through-line: pick one small concrete object or detail, plant it in the opening, bring it back at least twice, once near the end.
- Every paragraph must push exactly ONE new thing (an event, a number, a consequence) — never restate the previous idea in different words.
- Forbidden: transition signposts like "ít ai biết rằng", addressing the audience ("các bạn ơi"), moralizing, syrupy endings${cta ? ' — EXCEPT the single CTA moment near the end' : ''}.
OUTPUT RULES (very important):
- Return ONLY the narration text as one flowing piece. The first character must be the first letter of the script's opening sentence.
- Absolutely no lead-in such as "The script is complete...", "Here it is:", "Here is the script", "Đây là kịch bản", "Dưới đây là", and no word counts.
- No titles, no "Kịch bản:" lines, no numbering, no [Intro]/[Hook]/[Kết] labels, no director notes, no emoji, no markdown, no bullet points.${tone.indexOf('lời thoại') >= 0 ? ' Character dialogue lines are written inline as flowing narration — quotes are fine, labels and speaker tags are not.' : ''}
- Split into short paragraphs of 2-4 sentences, easy to read aloud for an AI voice (TTS). Start immediately with the hook; end with a closing line${cta ? ' (the CTA is the natural last beat before the final line)' : ''}.
Return only the script content, nothing else.`;
  const btn = document.getElementById('tsGenBtn'); if (btn) btn.disabled = true;
  const _tk = _startElapsed('✍️ Đang viết kịch bản', setStatusScript,
    'bản dài / chạy bằng gói Claude-ChatGPT có thể chờ vài phút — cứ để yên');
  try {
    const maxT = Math.min(16000, Math.round(words * 2.5) + 600);
    // Extras do người dùng nhập (đòn bẩy/skill/CTA) có thể bị content filter của
    // gateway chặn cả prompt. Khi lỗi/rỗng mà CÓ extras → thử lại 1 lần KHÔNG kèm
    // extras (degrade có chủ đích, báo rõ ở status), để user vẫn có kịch bản.
    const coExtras = !!(lever || skill || cta);
    let raw = '';
    try { raw = await callLLM(buildPrompt(true), { maxTokens: maxT }); }
    catch (e){ if (!coExtras) throw e; }
    if ((!raw || !String(raw).trim()) && coExtras){
      setStatusScript('⚠ Lần viết đầu bị lỗi/chặn — thử lại KHÔNG kèm đòn bẩy / kỹ năng viết / CTA…', 'info');
      raw = await callLLM(buildPrompt(false), { maxTokens: maxT });
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
  return !!(b && b.checked);
}

function tsToggleNovel(){
  const b = document.getElementById('tsNovelBtn'); if (!b) return;
  const turningOn = b.checked;
  if (turningOn){
    // Điều kiện bật Novel: QUY MÔ tối thiểu 2 chương (memory xuyên suốt chỉ có
    // ý nghĩa từ chương 2 trở đi). Chặn bật + báo rõ, không tự tách chương ngầm.
    const ch = parseInt(document.getElementById('tsChapters')?.value) || 1;
    if (ch < 2){
      b.checked = false;   // onchange đã gạt sẵn — hoàn tác về OFF và báo rõ
      setStatusScript('Chế độ Novel cần tối thiểu 2 chương — chỉnh CHƯƠNG trong khối QUY MÔ lên ≥ 2 rồi bật lại.', 'error');
      return;
    }
  }
  try { localStorage.setItem('ts_novel_mode', b.checked ? '1' : '0'); } catch (e) {}
  const h = document.getElementById('tsNovelHint'); if (h) h.style.display = b.checked ? '' : 'none';
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



