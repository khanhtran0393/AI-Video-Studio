/* TS — Tool kịch bản / novel architect (_tsNovel*), timer elapsed
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function setStatusScript(msg, type){
  const el = document.getElementById('statusScript'); if (!el) return;
  const c = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' };
  el.textContent = msg; el.style.color = c[type] || c.info;
}

function _tsClean(t){
  let s = String(t || '').trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();          // bỏ code fence
  // Bỏ câu dẫn/preamble AI hay chèn ở ĐẦU (vd "The script is complete at 4,420 words. Here it is:")
  for (let k = 0; k < 3; k++) {
    const before = s;
    s = s.replace(/^\s*(?:[^\n]*\b(?:the script is|here(?:'s| is)\b[^\n]*\bscript|here it is|below is\b[^\n]*\bscript|word count|final script)\b[^\n]*|đây là[^\n]*kịch bản[^\n]*|kịch bản[^\n]*(?:hoàn chỉnh|của bạn|đây)[^\n]*|dưới đây là[^\n]*)\r?\n+/i, '').trim();
    if (s === before) break;
  }
  s = s.replace(/^\s*(kịch bản|voiceover|lời đọc|tiêu đề|title|script)\s*[:：].*$/gim, '').trim();  // bỏ dòng nhãn
  s = s.replace(/^\s*#{1,6}\s+/gm, '');                                    // bỏ heading markdown
  s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');       // bỏ đậm/nghiêng
  s = s.replace(/^\s*\[[^\]]+\]\s*/gm, '');                                // bỏ [Intro]/[Hook]
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

async function _tsNovelArchitect(o){
  const prompt =
`You are the story ARCHITECT for a long multi-chapter faceless YouTube voiceover script.
TOPIC: "${o.topic}". LANGUAGE: ${o.lang}. TONE: ${o.tone}. TOTAL: about ${o.words} words, split into ${o.n} chapters of ~${o.chWords} words each.
${o.style ? 'CHANNEL STYLE (voice & tone only; ignore any word counts inside it):\n' + o.style.replace(/\{\{\s*WORDS\s*\}\}/gi, String(o.words)) + '\n' : ''}${o.rewrite ? 'Design a DIFFERENT angle and a different opening twist than the obvious approach.\n' : ''}
Design the skeleton so later chapters CAN stay consistent with earlier ones.
Return ONLY raw JSON, EXACTLY these keys:
{"premise":"1-2 câu tiền đề","ending":"hướng kết cục (mở/đóng) + cảm xúc cuối","characters":[{"name":"","role":"","description":"1 câu"}],"threads":[{"id":"T1","name":"","description":"1 câu"}],"chapters":[{"title":"","goal":"1 câu — chương này đạt được gì để mạch truyện tiến","words":${o.chWords}}]}
Rules: 3-7 characters (tên theo ${o.lang}), 3-6 threads (id T1,T2,…), EXACTLY ${o.n} chapters. Threads mở/đẩy/khép dần qua các chương — chương cuối khép các tuyến chính.`;
  return await callLLMJson(prompt, { maxTokens: 2200, tries: 3,
    validate: (d) => d && typeof d === 'object' && !Array.isArray(d)
      && Array.isArray(d.chapters) && d.chapters.length >= 2
      && Array.isArray(d.characters) && Array.isArray(d.threads) });
}

function _tsNovelMemBlock(mem){
  const parts = [];
  const n = mem.chapters.length;
  if (!n) parts.push('(Chưa có chương nào đã viết — đây là chương đầu tiên.)');
  mem.chapters.forEach((c, i) => {
    const s = String(c.summary || '').trim() || '(trống)';
    parts.push(`- (Ch.${i + 1}${c.title ? ' · ' + c.title : ''}) `
      + (i >= n - 3 ? s : (s.split(/(?<=[.!?…])\s+/)[0] || s)));
  });
  const states = Object.keys(mem.states).map((k) => {
    const byField = {};
    mem.states[k].forEach((c) => { if (c.field) byField[c.field] = c; });
    const s = Object.values(byField).map((c) => `${c.field}=${c.to}`).join('; ');
    return `- ${k}: ${s || '(chưa đổi trạng thái)'}`;
  });
  const threads = mem.threads.map((t) =>
    `- ${t.id}${t.name && t.name !== t.id ? ' · ' + t.name : ''}: [${t.status}] ${t.note || ''}`);
  return ['--- STORY MEMORY (bắt buộc nhất quán, không mâu thuẫn) ---',
    'DIỄN BIẾN ĐẾN NAY (3 chương gần nhất đầy đủ, chương cũ nén 1 câu):', ...parts,
    ...(states.length ? ['NHÂN VẬT & TRẠNG THÁI HIỆN TẠI (giá trị mới nhất từng trường):', ...states] : []),
    ...(threads.length ? ['TUYẆN NỘI DUNG (open=chưa khép, advanced=đã đẩy, resolved=đã khép):', ...threads] : []),
  ].join('\n');
}

function _tsNovelChapterPrompt(o, bible, mem, ch, i){
  const chars = (bible.characters || []).map((c) => `${c.name} (${c.role || '?'}) — ${c.description || ''}`).join('; ');
  return `You are a professional voiceover scriptwriter for faceless YouTube videos, writing ONE chapter of a multi-chapter story.
TASK: Write ONLY chapter ${i + 1} of ${o.n} — "${ch.title}". CHAPTER GOAL: ${ch.goal || '(theo mạch truyện)'}.
LANGUAGE: ${o.lang}. TONE: ${o.tone}. LENGTH: about ${ch.words} words (max 10% deviation).
${o.style ? 'CHANNEL STYLE (giọng văn; quy tắc LENGTH dưới đây đè lên mọi số từ trong style):\n' + o.style.replace(/\{\{\s*WORDS\s*\}\}/gi, String(ch.words)) + '\n' : ''}
STORY BIBLE (khung cố định):
- Tiền đề: ${bible.premise || ''}
- Hướng kết cục: ${bible.ending || ''}
- Nhân vật: ${chars || '(tự định hình ít nhân vật)'}
${_tsNovelMemBlock(mem)}
ABSOLUTE CONSISTENCY (quan trọng nhất):
- Tên, quan hệ, địa điểm, sự kiện PHẢI khớp STORY MEMORY ở trên. Không đặt lại tên nhân vật, không hồi sinh/hồi vị trí vô lý, không kể lại sự kiện đã xảy ra như thể mới.
- Chương ${i === 0 ? '1: mở bằng hook ≤ 15 từ, trồng 1 câu hỏi/mâu thuẫn mở (open loop)' : (i + 1) + ': mở đầu nối mạch chương trước, KHÔNG tóm lại chương cũ'}.
- Tuyến còn [open] thì chỉ ĐẨY TIẾN (thêm chi tiết mới, không lặp nguyên văn), chưa khép; khép các tuyến chính ở chương cuối.
- Mỗi đoạn chỉ tiến THÊM 1 điều mới (biến cố/con số/hậu quả); cấm diễn giải lại ý cũ bằng lời khác.
RETENTION:
- Cấm: "ít ai biết rằng", xưng hô khán giả ("các bạn ơi"), kết kiểu đạo lý.
OUTPUT RULES (very important):
- Return ONLY the narration text of THIS chapter. First character = first letter of the opening sentence.
- No chapter titles, no numbering, no [labels], no markdown, no emoji, no lead-in, no word counts.
- Chia đoạn ngắn 2-4 câu, dễ đọc cho TTS.`;
}

async function _tsNovelRemember(chText, bible, mem, i){
  const prompt =
`You are the STORY CONTINUITY EDITOR. Chapter ${i + 1} was just written. Extract memory updates for future chapters.
Return ONLY raw JSON, EXACTLY these keys:
{"summary":"3-5 câu tóm tắt chương này (tiếng Việt, kể đủ biến cố chính)","stateChanges":[{"entity":"","field":"location|status|relation|knowledge|possession|alive|khác","from":"","to":"","reason":""}],"threads":[{"id":"T1","status":"open|advanced|resolved","note":"1 câu"}]}
Rules: stateChanges CHỈ ghi thay đổi THẬT so với MEMORY cũ (không lặp lại trạng thái chưa đổi). threads: chỉ tuyến được mở/đẩy/khép trong chương này, giữ nguyên id.

STORY BIBLE (tham chiếu):
- Tiền đề: ${String(bible.premise || '').slice(0, 400)}
- Tuyến đã biết: ${(mem.threads || []).map((t) => t.id).join(', ') || '(chưa có)'}

MEMORY HIỆN TẠI:
${_tsNovelMemBlock(mem)}

CHƯƠNG VỪA VIẾT:
${chText.slice(0, 9000)}`;
  return await callLLMJson(prompt, { maxTokens: 900, tries: 2,
    validate: (d) => d && typeof d === 'object' && typeof d.summary === 'string' && d.summary.trim().length > 20 });
}

function _tsNovelMerge(mem, up, chTitle){
  mem.chapters.push({ title: String(chTitle || ''), summary: String(up.summary || '').trim() });
  (Array.isArray(up.stateChanges) ? up.stateChanges : []).forEach((c) => {
    const k = String((c && c.entity) || '').trim(); if (!k) return;
    (mem.states[k] = mem.states[k] || []).push({
      field: String((c && c.field) || '').trim() || 'status',
      to: String((c && (c.to ?? c.new_value)) || '').trim(),
      reason: String((c && c.reason) || '').trim(),
    });
  });
  (Array.isArray(up.threads) ? up.threads : []).forEach((t) => {
    const id = String((t && t.id) || '').trim().toUpperCase(); if (!id) return;
    const cur = mem.threads.find((x) => x.id === id);
    if (cur){ if (t.status) cur.status = String(t.status); if (t.note) cur.note = String(t.note); }
    else mem.threads.push({ id, name: id, status: String((t && t.status) || 'open'), note: String((t && t.note) || '') });
  });
}

function _startElapsed(label, setter, hint){
  let sec = 0;
  const tick = () => { sec += 1; try { setter(label + '… ' + _fmtDur(sec) + (sec >= 15 && hint ? ' · ' + hint : ''), 'working'); } catch (e){} };
  tick();
  return setInterval(tick, 1000);
}

function _stopElapsed(h){ try { clearInterval(h); } catch (e){} }

function _tsWordCount(t){ return (String(t || '').trim().match(/\S+/g) || []).length; }

