/* AUTO-EXTRACTED from index.html block 3 - prefix: t9 */

function t9BuildSceneTimeline(){
  if (!state.scenes || !state.scenes.length) return [];
  let acc = 0;
  const fmt = sec => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  return state.scenes.map(sc => {
    const start = fmt(acc);
    acc += (sc.duration || 0);
    return { id: sc.id, start, text: (sc.text || '').slice(0, 120) };
  });
}

function t9LoadFromTool2(){
  const script = state.script || (state.scenes || []).map(s => s.text).join(' ');
  if (!script.trim()) return setStatus9('Tool 02 chưa có kịch bản/cảnh. Chia cảnh trước đã.', 'error');
  document.getElementById('t9Script').value = script;
  const timeline = t9BuildSceneTimeline();
  const info = document.getElementById('t9TimingInfo');
  if (timeline.length) {
    const total = (state.scenes || []).reduce((a, s) => a + (s.duration || 0), 0);
    info.innerHTML = `✓ Đã lấy ${state.scenes.length} cảnh (tổng ~${Math.floor(total/60)}:${String(Math.floor(total%60)).padStart(2,'0')}). Chapters sẽ dùng timing này.`;
  } else {
    info.textContent = 'Đã lấy kịch bản (chưa có cảnh để tạo chapters).';
  }
  setStatus9('✓ Đã nạp nội dung. Bấm Tạo SEO Pack.', 'ok');
}

async function t9Generate(){
  if (typeof gateTool==='function' && gateTool('tool9')) return;
  const script = document.getElementById('t9Script').value.trim();
  if (!script) return setStatus9('Cần nội dung video. Bấm "Lấy từ Tool 02" hoặc paste vào.', 'error');

  // Ngôn ngữ tự động: viết đúng ngôn ngữ của nội dung video.
  const langName = 'the SAME language as the video content below';
  const existingTitle = document.getElementById('t9Title').value.trim();
  const timeline = t9BuildSceneTimeline();

  let timelineBlock = '';
  if (timeline.length) {
    timelineBlock = '\n\nSCENE TIMELINE (use these REAL timestamps to build chapters — group scenes into logical chapters, each chapter must be at least 10 seconds apart, first chapter MUST be 0:00):\n'
      + timeline.map(t => `[${t.start}] ${t.text}`).join('\n');
  }

  const titleInstruction = existingTitle
    ? `The creator's chosen title is: "${existingTitle}".
- Put this EXACT title as titles[0] (do not change it).
- titles[1-9]: 9 improved alternative variations, under 60 characters, keyword front-loaded.
- Derive the main keyword from this title and make the whole description match it.`
    : `Generate 10 title strings, each under 60 characters, primary keyword in first 5-7 words, mixed angles (curiosity, number, how-to, emotional, question, bold claim).`;

  // Mô tả theo CHUẨN 6 KHỐI cố định (khung dùng y hệt cho mọi video)
  const prompt = `You are a YouTube SEO expert. Based on the video content below, generate a complete SEO package in ${langName}.
The DESCRIPTION must read like a real creator wrote it — plain spoken, concrete, no marketing filler. Follow this skeleton:

[1] HOOK — 2-3 SHORT paragraphs (1-3 sentences each), second person, opening on the concrete paradox of the story. Use REAL numbers and details taken from the video content. The first sentence must contain the main keyword naturally. Example of the register wanted: "You drive into a scrap yard with a dead car — and they pay you to take it away. So how does a business that hands cash to every single customer actually make money? It's not the scrap metal you can see."

[2] WHAT THE VIDEO BREAKS DOWN — ONE paragraph starting like "This is how… / In this video we…", listing the specific things covered, woven into prose with the real figures and specifics from the content (not a bullet list).

[3] TOPICS COVERED — a single line starting "Topics covered:" followed by 6-10 comma-separated keyword phrases people would actually search. This is where the SEO keywords live.

[4] CHAPTERS — the bare word "Chapters" on its own line (no colon), then the timestamps.
   • 5-8 chapters TOTAL for the whole video — group the timeline into LOGICAL SECTIONS (setup, the problem, the mechanism, the twist, the payoff). NEVER one chapter per scene, never 12+ chapters.
   • First MUST be 0:00. Space them roughly evenly across the runtime.
   • Titles 3-6 words, curiosity-driven, in the same voice as the hook — a reason to jump there, not a label. Good: "They pay YOU to walk in" · "The arithmetic that flips it" · "Why you were never the buyer". Bad: "Introduction", "Profit per passenger", "Fees and revenue".

[5] CTA — ONE short line inviting subscribe, phrased around what this channel does. Skip it if it would sound hollow.

[6] HASHTAGS — 5-8 hashtags on one or two lines.

⛔ NEVER include: a "Playlist:" line, music/image/visual credits, data-source lines, disclaimers, or any sentence describing your own SEO work (never write things like "semantic variations of the keyword appear across the video"). Write the description, not a report about it.

VIDEO CONTENT:
${script.slice(0, 6000)}
${existingTitle ? `\nCHOSEN TITLE: "${existingTitle}"` : ''}
${timelineBlock}

Return ONLY valid JSON (no markdown, no backticks, no preamble) with this EXACT structure:
{
  "titles": [10 title strings. ${existingTitle ? 'titles[0] = the chosen title EXACTLY; titles[1-9] = alternatives' : 'all 10 freshly generated'}],
  "hook": "BLOCK 1 — 2-3 short paragraphs separated by \\n\\n, spoken register, real numbers, main keyword in the first sentence",
  "body": "BLOCK 2 — ONE paragraph: what the video breaks down, woven into prose with real figures",
  "topics": "BLOCK 3 — one line: 6-10 comma-separated search phrases (no leading label, the app adds it)",
  "chapters": [${timeline.length ? 'BLOCK 4 — array of {"time":"M:SS","label":"..."} grouped from the REAL timeline above into 5-8 LOGICAL SECTIONS (never one per scene), first 0:00' : 'BLOCK 4 — 5-8 logical chapters as {"time":"M:SS","label":"..."}, first MUST be 0:00'}],
  "cta": "BLOCK 5 — ONE short subscribe line about what this channel does. Empty string if it would sound hollow",
  "tags": [15-20 relevant tag strings, mix of short and long-tail],
  "hashtags": [3-5 hashtag strings WITH the # symbol, most relevant first]
}

TITLE INSTRUCTIONS: ${titleInstruction}

All text must be in ${langName}. Return JSON only.`;

  setStatus9('Đang tạo SEO pack (title, mô tả, chapters, tags)...', 'working');
  let raw;
  try {
    raw = await callClaude(prompt, 2500);
  } catch (e) {
    return setStatus9('Lỗi API: ' + e.message, 'error');
  }

  // Parse JSON (strip code fences nếu có)
  let data;
  try {
    let clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first >= 0 && last >= 0) clean = clean.slice(first, last + 1);
    data = JSON.parse(clean);
  } catch (e) {
    console.error('Parse fail:', raw);
    return setStatus9('AI trả về sai định dạng. Bấm Tạo lại.', 'error');
  }

  // Nắn chapter về đúng mốc cảnh (khớp giọng đọc) trước khi lưu/vẽ
  try {
    const _sn = _t9SnapChapters(data.chapters);
    if (_sn.list.length) {
      data.chapters = _sn.list;
      const _last = _sn.list[_sn.list.length - 1];
      const _lastS = (parseInt(_last.time.split(':')[0]) || 0) * 60 + (parseInt(_last.time.split(':')[1]) || 0);
      const _gap = Math.round(_sn.total - _lastS);
      if (typeof novaLog === 'function' && (_sn.moved || _gap > 180))
        novaLog(`📑 Chapters: ${_sn.list.length} mục${_sn.moved ? ` · nắn ${_sn.moved} mốc về đúng đầu cảnh` : ''}${_gap > 180 ? ` · ⚠ chương cuối còn cách hết video ${Math.floor(_gap / 60)}:${String(_gap % 60).padStart(2, '0')}` : ''}.`, _gap > 180 ? 'warn' : 'ok');
    }
  } catch (e) {}
  t9State.result = data;
  try { if (typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 100); } catch (e) {}   // có tiêu đề → mở khoá bước 2
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // lưu gói SEO theo video ngay
  t9RenderResults(data);
  setStatus9('✓ Xong! Chọn tiêu đề, copy mô tả (đã gồm hashtags) + tags để upload.', 'ok');
  notifyDone('✓ SEO Pack xong!', `${(data.titles||[]).length} tiêu đề + mô tả + chapters.`);
}

function t9RenderResults(data){
  document.getElementById('t9Results').style.display = 'block';

  // Titles — mỗi cái 1 dòng + nút copy + đếm ký tự
  const titles = data.titles || [];
  const hasOwnTitle = !!document.getElementById('t9Title').value.trim();
  document.getElementById('t9Titles').innerHTML = titles.map((t, i) => {
    const len = t.length;
    const lenColor = len > 60 ? 'var(--red)' : (len > 50 ? 'var(--amber)' : 'var(--green)');
    const safe = escapeHtml(t).replace(/'/g, "\\'");
    const ownBadge = (hasOwnTitle && i === 0)
      ? '<span style="font-size:9.5px;background:var(--accent);color:var(--on-accent);padding:1px 6px;border-radius:4px;margin-left:4px">CỦA BẠN</span>'
      : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text-muted);font-size:12px;min-width:20px">${i + 1}.</span>
      <span style="flex:1;font-size:13.5px">${escapeHtml(t)}${ownBadge}</span>
      <span style="font-size:11px;color:${lenColor};min-width:42px;text-align:right">${len} ký</span>
      <button class="btn ghost sm" style="padding:3px 9px;font-size:11px" onclick="copyText('${safe}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1200)">📋</button>
    </div>`;
  }).join('');

  // Description: Hook → Video mổ xẻ gì → Topics covered → Chapters → CTA → Hashtags
  const _ok = (x) => { const v = String(x || '').trim(); return (!v || /^(n\/?a|none|null|-)$/i.test(v)) ? '' : v; };   // model hay trả "N/A" cho khối bỏ trống
  let desc = '';
  if (_ok(data.hook)) desc += _ok(data.hook) + '\n\n';
  if (_ok(data.body)) desc += _ok(data.body) + '\n\n';
  else if (_ok(data.summary)) desc += _ok(data.summary) + '\n\n';   // tương thích ngược
  if (_ok(data.topics)) desc += 'Topics covered: ' + _ok(data.topics).replace(/^topics covered:\s*/i, '') + '\n\n';
  if (data.chapters && data.chapters.length) {
    desc += 'Chapters\n' + data.chapters.map(c => `${c.time} ${c.label}`).join('\n') + '\n\n';
  }
  if (_ok(data.cta)) desc += _ok(data.cta) + '\n\n';
  else if (_ok(data.utility)) desc += _ok(data.utility) + '\n\n';   // tương thích ngược
  if (data.hashtags && data.hashtags.length) desc += data.hashtags.join(' ');
  document.getElementById('t9Desc').value = desc.trim();

  // Tags — phẩy
  document.getElementById('t9Tags').value = (data.tags || []).join(', ');
}

function t9Reset(){
  t9State.result = null;
  document.getElementById('t9Results').style.display = 'none';
  setStatus9('Đã xoá kết quả. Sẵn sàng tạo lại.', 'info');
}

async function t9GenTitleFromContent(){
  const script = document.getElementById('t9Script').value.trim();
  if (!script) return setStatus9('Chưa có nội dung video. Lấy kịch bản từ Phân Cảnh trước.', 'error');
  const cur = (document.getElementById('t9Title')?.value || '').trim();
  setStatus9('AI đang đặt 10 tiêu đề từ nội dung…', 'working');
  // Dùng ĐÚNG bộ luật của SEO Pack để hai chỗ ra cùng một chất giọng.
  const anchor = cur
    ? `The creator's current title is: "${cur}".
- Put this EXACT title as option 1 (do not change it).
- Options 2-10: improved alternative variations around it.`
    : `Write 10 titles from scratch.`;
  const p = `You are a YouTube SEO title writer. Based on the video content below, write titles in the SAME language as the content.

${anchor}

RULES for every title:
- Under 60 characters.
- Primary keyword inside the first 5-7 words.
- Mixed angles across the set: curiosity, number, how-to, emotional, question, bold claim — do not repeat the same angle twice.
- Title Case (capitalise main words), no ALL-CAPS, no clickbait phrasing like "You Won't Believe".
- No more than 2 titles may start with the same word.
- No numbering, no quotes, no emoji.

Return ONLY a JSON array of 10 strings.

CONTENT:
${script.slice(0, 4000)}`;
  try {
    const arr = await callLLMJson(p, { maxTokens: 700, validate: v => Array.isArray(v) && v.length });
    const list = (arr || []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 10);
    if (!list.length) throw new Error('AI chưa trả tiêu đề nào.');
    t9ShowTitlePicker(list, cur);
    setStatus9(`✓ ${list.length} tiêu đề — chọn 1 để điền vào ô Tiêu đề video.`, 'ok');
  } catch (e) { setStatus9('Lỗi: ' + e.message, 'error'); }
}

function t9ShowTitlePicker(list, cur){
  const old = document.getElementById('t9TitlePickOv'); if (old) old.remove();
  const rows = list.map((t, i) => `<div onclick="t9PickTitle(${i})" style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
      <span style="font-family:var(--mono,monospace);font-size:11.5px;color:var(--text-dim);width:18px">${i + 1}</span>
      <span style="flex:1;font-size:13.5px;font-weight:600">${escapeHtml(t)}${(cur && t === cur) ? ' <span style="background:var(--accent);color:var(--on-accent);font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;vertical-align:middle">CỦA BẠN</span>' : ''}</span>
      <span style="font-family:var(--mono,monospace);font-size:11px;color:${t.length <= 60 ? 'var(--green)' : 'var(--amber)'}">${t.length} ký</span>
    </div>`).join('');
  const ov = document.createElement('div'); ov.id = 't9TitlePickOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:640px;width:100%;max-height:84vh;overflow:auto;box-shadow:0 24px 70px -18px rgba(0,0,0,.5)" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--border)">
        <b style="font-size:14px">📝 Chọn tiêu đề</b>
        <span style="font-size:11.5px;color:var(--text-dim)">bấm 1 dòng để điền vào ô Tiêu đề video</span>
        <button class="btn ghost sm" style="margin-left:auto" onclick="document.getElementById('t9TitlePickOv').remove()">✕</button>
      </div>${rows}</div>`;
  document.body.appendChild(ov);
  window._t9TitleList = list;
}

function t9PickTitle(i){
  const t = (window._t9TitleList || [])[i]; if (!t) return;
  const el = document.getElementById('t9Title'); if (el) el.value = t;
  const ti = document.getElementById('t10TitleInput'); if (ti) ti.value = t;
  const ov = document.getElementById('t9TitlePickOv'); if (ov) ov.remove();
  try { if (typeof t9Step2Refresh === 'function') t9Step2Refresh(); if (typeof saveState === 'function') saveState(true); } catch (e) {}
  setStatus9(`✓ Đã chọn tiêu đề: "${t}"`, 'ok');
}

function t9Init(){
  // Tự nạp nội dung nếu ô trống: ưu tiên Phân Cảnh (có timing cho chapters), nếu chưa có thì lấy từ tab Tạo Kịch Bản.
  const ta = document.getElementById('t9Script');
  if (ta && !ta.value.trim()) {
    if (state.script || (state.scenes && state.scenes.length)) {
      t9LoadFromTool2();
    } else {
      const ts = (document.getElementById('tsOutput')?.value || '').trim();
      if (ts) { ta.value = ts; setStatus9('✓ Đã nạp kịch bản từ tab Tạo Kịch Bản.', 'ok'); }
    }
  }
  // Tiêu đề tự lấy từ tab Tạo Kịch Bản (tsTopic) nếu ô đang trống
  const tt = document.getElementById('t9Title');
  if (tt && !tt.value.trim()) {
    const t = (document.getElementById('tsTopic')?.value || '').trim();
    if (t) tt.value = t;
  }
}

function t9RefTab(mode){
  t9Ref.mode = mode;
  const b1 = document.getElementById('t9RefTab1'), b2 = document.getElementById('t9RefTab2');
  if (b1) b1.style.background = mode === 'topic' ? 'var(--surface)' : '';
  if (b2) b2.style.background = mode === 'url' ? 'var(--surface)' : '';
  const row = document.getElementById('t9RefUrlRow');
  if (row) row.style.display = mode === 'url' ? 'flex' : 'none';   // tab chủ đề: tự tìm theo tiêu đề, khỏi ô nhập
  const q = document.getElementById('t9RefQuery'); if (q && mode === 'url') q.value = '';
  if (mode === 'topic') t9RefAutofill(true);
}

async function t9RefSearch(){
  const q = (document.getElementById('t9RefQuery')?.value || '').trim();
  if (!q) return _t9RefSt(t9Ref.mode === 'url' ? 'Dán link video vào đã.' : 'Nhập chủ đề đã.', 'var(--red)');
  if (!window.native || typeof window.native.thumbOutliers !== 'function') return _t9RefSt('Chỉ chạy trong app Nova (cần yt-dlp).', 'var(--red)');
  const btn = document.getElementById('t9RefBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳'; }
  try {
    if (t9Ref.mode === 'url'){
      const r = await window.native.thumbFromUrl({ url: q });
      if (!r || !r.ok) throw new Error((r && r.error) || 'Không lấy được');
      t9Ref.items = [{ ...r, title: 'Video đã dán', channel: '', ratio: 0 }];
    } else {
      _t9RefSt('🔎 Đang tìm video theo chủ đề…');
      const r = await window.native.thumbOutliers({ topic: q, count: 40 });
      if (!r || !r.ok) throw new Error((r && r.error) || 'Không tìm được');
      t9Ref.items = r.items || [];
      const _md = r.median >= 1000 ? (r.median / 1000).toFixed(r.median >= 10000 ? 0 : 1) + 'k' : String(r.median);
      _t9RefSt(`${t9Ref.items.length} video · nhãn x = bội số view so với trung vị (${_md} view) · chủ đề: "${q}"`);
    }
    t9RefRender();
  } catch (e){ _t9RefSt('⚠️ ' + String(e.message || e).slice(0, 140), 'var(--red)'); }
  finally { if (btn){ btn.disabled = false; btn.textContent = t9Ref.mode === 'url' ? 'Lấy ảnh' : 'Tìm'; } }
}

function t9RefRender(){
  const box = document.getElementById('t9RefGrid'); if (!box) return;
  box.innerHTML = (t9Ref.items || []).map((x, i) => {
    const on = t9Ref.sel === i;
    const xr = x.ratio ? `<span style="position:absolute;left:6px;bottom:6px;background:var(--green);color:#fff;font:700 10px ui-monospace,monospace;padding:2px 6px;border-radius:4px">x${x.ratio}</span>` : '';
    const ch = x.channel ? `<span style="position:absolute;left:6px;top:6px;background:rgba(0,0,0,.6);color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.channel)}</span>` : '';
    return `<div onclick="t9RefPick(${i})" title="${escapeHtml(x.title || '')}" style="position:relative;aspect-ratio:16/9;border-radius:9px;overflow:hidden;cursor:pointer;border:2px solid ${on ? 'var(--accent)' : 'var(--border)'};background:#000 center/cover no-repeat url('${x.thumbSmall || x.thumb}')">
      ${ch}${xr}${on ? '<span style="position:absolute;right:6px;top:6px;width:19px;height:19px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">✓</span>' : ''}</div>`;
  }).join('') || '<div style="grid-column:1/-1;font-size:12px;color:var(--text-dim)">Chưa có mẫu — nhập chủ đề rồi bấm Tìm.</div>';
  if (t9Ref.items.length === 1) t9RefPick(0);
}

async function t9RefPick(i){
  const x = (t9Ref.items || [])[i]; if (!x) return;
  t9Ref.sel = i; t9RefRender();
  const pv = document.getElementById('t9RefPreview');
  if (pv){ pv.style.backgroundImage = `url('${x.thumb}')`; pv.textContent = ''; }
  const meta = document.getElementById('t9RefMeta');
  if (meta) meta.innerHTML = `${x.ratio ? `<b style="color:var(--green)">x${x.ratio}</b> · ` : ''}${escapeHtml((x.channel || '').slice(0, 28))}<br>${escapeHtml((x.title || '').slice(0, 70))}`;
  _t9RefSt('⏳ Tải ảnh mẫu…');
  try {
    const r = await fetch(x.thumb).catch(() => null);
    let blob = (r && r.ok) ? await r.blob() : null;
    if (!blob){ const r2 = await fetch(x.thumb.replace('maxresdefault', 'hqdefault')); blob = r2.ok ? await r2.blob() : null; }   // video cũ không có maxres
    if (!blob) throw new Error('không tải được ảnh');
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
    t9Ref.base64 = b64; t9Ref.mime = blob.type || 'image/jpeg'; t9Ref.spec = null; t9Ref.cap = ''; t9Ref.capOut = ''; t9Ref.capFor = '';   // mẫu mới → đọc lại từ đầu
    _t9RefSt('✓ Đã chọn mẫu — bấm ✨ Gen Thumbnail để tạo theo bố cục này.', 'var(--green)');
  } catch (e){ t9Ref.base64 = null; _t9RefSt('⚠️ Không tải được ảnh mẫu: ' + String(e.message || e).slice(0, 80), 'var(--red)'); }
}

function t9RefClear(){
  t9Ref.sel = null; t9Ref.base64 = null; t9Ref.items = []; t9Ref.spec = null; t9Ref.cap = '';
  const pv = document.getElementById('t9RefPreview'); if (pv){ pv.style.backgroundImage = ''; pv.textContent = 'chưa chọn'; }
  const meta = document.getElementById('t9RefMeta'); if (meta) meta.innerHTML = '';
  t9RefRender(); _t9RefSt('');
}

async function t9RefAutofill(force){
  const inp = document.getElementById('t9RefQuery'); if (!inp) return;
  if (_t9RefAuto && !force) return;
  if (inp.value.trim() && !force) return;
  const { q, from } = await _t9RefTopicQuery();
  if (!q) { _t9RefSt('Chưa có tiêu đề/kịch bản — gõ chủ đề rồi bấm Tìm.'); return; }
  inp.value = q; _t9RefAuto = true;
  _t9RefSt(`🔎 Chủ đề lấy từ ${from}: "${q}" — đang tìm…`);
  if (t9Ref.mode === 'topic') await t9RefSearch();
}

function t9Step2Refresh(){
  const btn = document.getElementById('t9Step2Btn'), hint = document.getElementById('t9Step2Hint');
  const t = _t9ChosenTitle();
  if (btn) btn.disabled = !t;
  if (hint) hint.textContent = t ? ('Tiêu đề đang dùng: "' + t.slice(0, 70) + '"') : 'Chưa có tiêu đề — bấm ✨ Tạo SEO Pack ở bước 1, hoặc gõ tay tiêu đề.';
}

async function t9OpenStep2(){
  const t = _t9ChosenTitle();
  if (!t) { setStatus10('Cần tiêu đề trước — tạo SEO ở bước 1, hoặc gõ tiêu đề vào ô Tiêu đề.', 'error'); return; }
  const gate = document.getElementById('t9Step2Gate'), body = document.getElementById('t9Step2Body');
  if (gate) gate.style.display = 'none';
  if (body) body.style.display = '';
  const ti = document.getElementById('t10TitleInput'); if (ti && !ti.value.trim()) ti.value = t;   // chốt tiêu đề sang bước 2
  try { if (typeof t10Init === 'function') t10Init(); } catch (e) {}
  await t9RefAutofill(true);        // tìm ảnh mẫu THEO ĐÚNG tiêu đề vừa chốt
}

