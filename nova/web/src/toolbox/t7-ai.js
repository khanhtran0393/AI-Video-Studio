/* T7 AI — đề xuất media theo cảnh (t7AiPropose) + thiết kế cảnh (t7AiDesign + clear)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function t7AiPropose(lamLai){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  // Kho mẫu rỗng thì BỎ QUA phần đồ hoạ chứ không thoát hẳn — chuyển cảnh vẫn chạy được.
  // Chạy phần đề xuất mẫu khi kho rỗng chỉ tổ đốt 60 lượt gọi rồi loại sạch.
  const boQuaDoHoa = !cat.length;
  const allowed = new Map(cat.map(c => [c.template, c]));

  const m = document.getElementById('t7Ai'); if (m) m.classList.add('on');

  // ── Mở lại video cũ: dựng thẳng hàng đề xuất đã lưu, KHÔNG gọi lại AI ──
  if (!lamLai){
    const co = new Set(clips.map(c => c.sceneId));
    const cu = (state.aiQueue || []).filter(q => q && q.sceneId && co.has(q.sceneId));   // bỏ cảnh đã xoá
    if (cu.length){
      _t7AiQ = cu; state.aiQueue = cu;
      const cho = cu.filter(q => !q.state).length;
      const nMap = Object.keys(state.aiMap || {}).length;
      const nTrCu = cu.filter(q => q.kind === 'tr').length;
      _t7AiSteps(6, { 0: clips.length + ' cảnh', 1: nMap + ' cảnh đã có vai trò',
        2: (cu.length - nTrCu) + ' đồ hoạ (kết quả đã lưu)', 3: 'đã soi lần trước', 4: 'đã kiểm lần trước',
        5: nTrCu + ' chuyển cảnh' });
      _t7AiRender();
      setStatus7(cho ? `✨ ${cho}/${cu.length} đề xuất còn chờ duyệt (lấy từ dự án, không chạy lại AI).`
                     : `✓ Đã duyệt hết ${cu.length} đề xuất của video này. Bấm ↻ Phân tích lại nếu muốn làm mới.`, 'ok');
      return;
    }
  }
  _t7AiQ = []; state.aiQueue = _t7AiQ;
  clearCancel && clearCancel();
  const nWord = clips.reduce((n, c) => {
    const sc = _t7ClipScene(c); return n + String((sc && sc.text) || '').trim().split(/\s+/).filter(Boolean).length; }, 0);
  _t7AiSteps(0, { 0: clips.length + ' cảnh · ' + nWord.toLocaleString('vi-VN') + ' chữ' });
  document.getElementById('t7AiProps').innerHTML = '<div class="t7-empty">Đang đọc kịch bản…</div>';

  // Chỉ xét cảnh CHƯA có lớp nào — khỏi đề xuất chồng lên cảnh đã dựng.
  const todo = clips.filter(c => {
    const sp = (state.sceneSpecs || {})[c.sceneId];
    return !(sp && (sp.layers || []).some(L => L && L.type !== 'backdrop'));
  });
  if (!todo.length){ _t7AiSteps(5, {}); _t7AiRender(); return; }

  // ── 2. Bản đồ vai trò ───────────────────────────────────────────────
  _t7AiSteps(1, { 1: 'đang đọc cả video…' });
  setStatus7('✨ Trợ lý đọc toàn bộ kịch bản để nắm mạch…', 'working');
  const map = await _t7AiMap(todo, (d, t) => _t7AiSteps(1, { 1: d + '/' + t + ' cảnh' }));
  const nRole = Object.keys(map).length;
  const dem = {}; Object.values(map).forEach(v => { dem[v.role] = (dem[v.role] || 0) + 1; });
  const roleLine = Object.entries(dem).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' · ');
  if (state.cancelRequested){ _t7AiSteps(1, { 1: 'đã dừng' }); _t7AiRender(); return; }

  // ── 3. Đề xuất theo lô, hạn ngạch giữ bằng code ─────────────────────
  const topic = String(state.videoLogline || '').trim();
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const S = { quota: _t7AiQuota(todo.length), used: {}, last: {}, amb: 0, txt: 0 };
  const hong = [];                                  // lô lỗi → báo tên cảnh, không nuốt câm
  const BATCH = 10;
  for (let i = 0; boQuaDoHoa ? false : i < todo.length; i += BATCH){
    if (state.cancelRequested) break;
    const lot = todo.slice(i, i + BATCH);
    _t7AiSteps(2, { 1: nRole + ' cảnh · ' + roleLine, 2: Math.min(i + BATCH, todo.length) + '/' + todo.length + ' cảnh · ' + _t7AiQ.length + ' đề xuất' });
    setStatus7(`✨ Trợ lý đọc cảnh ${i + 1}–${Math.min(i + BATCH, todo.length)}/${todo.length}…`, 'working');
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      const meta = [mp.role, mp.emp != null ? 'nhấn ' + mp.emp : '', mp.key ? 'tên: ' + mp.key : '', mp.num ? 'số: ' + mp.num : ''].filter(Boolean).join(' · ');
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s]${meta ? ' {' + meta + '}' : ''} ${_t7Gist(sc && sc.text, 200) || '(không có lời)'}`;
    }).join('\n');

    const prompt = `You are a motion-graphics editor for faceless Vietnamese videos.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}For EACH scene below, pick 0–2 graphics templates to overlay, AND explain why.

USABLE TEMPLATES (you may only choose from this list):
${catLine}

REMAINING QUOTAS FOR THE WHOLE VIDEO (going over gets auto-rejected):
${_t7AiQuotaLine(S)}

🌐 ON-SCREEN TEXT LANGUAGE — MOST IMPORTANT:
The script is written in ${_t7AiLang()}. EVERY piece of text shown on screen must be written in EXACTLY ${_t7AiLang()}:
text, subtitle, headline, title, value, unit, kicker, note, caption, label, name, body, dek, stamp.
If viewers see text in a different language than the voiceover, the whole video is ruined.
ONLY the "why" field is written in Vietnamese — it is an explanation for the human editor, never shown on screen.

RULES:
- THE DEFAULT IS TO ADD NOTHING. Only propose something when the scene is genuinely improved by it.
  The whole video should have roughly 1/8 of its scenes carrying text. Leaving a scene empty is the right call, not laziness.
- Max 1 template per scene. Two templates in one scene only when one is a no-text ambient layer.
- Prioritize scenes with {nhấn 2} or {nhấn 3}. Scenes with {nhấn 0} are almost always left empty.
- A {so-lieu} scene that has "số:" (number) → prioritize a data-presentation template and fill in EXACTLY that number.
- Only scenes with "tên:" (name) may use a name/label template, filled with exactly that name.
- On-screen text must be SHORT (under 6 words), the key takeaway — do NOT copy the full voiceover line.
- Scenes under 2.5 seconds should not get templates with long text.

⚠️ PREFER NO-TEXT TEMPLATES when the library has them. A video where every scene is plastered with text looks
cheap and tiring — viewers already hear the voiceover, they don't need to re-read the same line on screen.
A {nhấn 0} or {nhấn 1} scene that still needs something → pick a NO-TEXT template, don't force text in.

${_t7CustomSpec()}


The REASON ("why") must reference the actual voiceover line and the scene length, written in Vietnamese, 1 sentence under 22 words.
Good example: "Câu có con số gây bất ngờ nên phóng chữ rồi nảy, khớp nhịp nhấn."
BAD example (generic, forbidden): "Mẫu này đẹp và phù hợp với cảnh."

SCENES:
${list}

Return a JSON array, one element per scene WITH a proposal (skip scenes that need nothing entirely):
[{"i":0,"why":"short reason","picks":[{"template":"template-name","text":"short text if the template needs it"}]}]
Fill in only the fields the template accepts. Do not add strange fields.
For custom-designed scenes, omit "picks" and use "custom" following the exact schema above.`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog(`✨ Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push(_t7ClipLabel(c))); continue; }

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + (Number.isFinite(k) ? k : 0);
      const dur = parseFloat(_t7ClipDur(c)) || 3;
      // AI bịa tên mẫu thì bỏ — engine không phải đoán. Rồi soi tiếp qua hạn ngạch.
      const picks = [];
      (Array.isArray(row.picks) ? row.picks : []).slice(0, 2).forEach(x => {
        if (!x || !allowed.has(x.template)) return;
        if (dur < 2.5 && _t7TplTextKey(cat, x.template)) return;   // cảnh chớp mắt, chữ chưa kịp đọc
        if (_t7AiGate(x.template, idx, S, cat)) return;
        _t7AiTake(x.template, idx, S, cat);
        picks.push(x);
      });
      // Không có mẫu nào hợp → AI tự bố cục. Lọc + kẹp mọi con số trước khi nhận.
      const custom = picks.length ? [] : _t7AiFixLayers(row.custom, dur);
      if (!picks.length && !custom.length) return;
      if (custom.length){
        if (custom.some(L => L.type === 'text') && S.txt >= S.quota._text) return;   // vẫn tính vào trần chữ
        if (custom.some(L => L.type === 'text')) S.txt++;
      }
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      _t7AiQ.push({
        sceneId: c.sceneId, fx: c.fx, name: _t7ClipLabel(c), picks, custom, role: mp.role || '',
        tplLabel: custom.length ? _t7CustomNhan(custom)
          : picks.map(x => (allowed.get(x.template) || {}).label || x.template).join(' + '),
        line: _t7Gist(sc && sc.text, 110) || '(không có lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do — nên xem kỹ trước khi gắn.',
        state: '', drop: '',
      });
    });
    _t7AiRender();
  }

  // ── 4. Soi khung hình những cảnh định đặt chữ ───────────────────────
  let vis = { xong: 0, doi: 0 };
  const nTxt = _t7AiQ.filter(q => q.picks.some(p => _t7TplTextKey(cat, p.template))).length;
  if (nTxt && !boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(3, { 3: '0/' + nTxt + ' khung hình' });
    setStatus7(`👁 Soi ${nTxt} khung hình để đặt chữ vào chỗ trống…`, 'working');
    vis = await _t7AiVision(cat, (d, t) => _t7AiSteps(3, { 3: d + '/' + t + ' khung hình' }));
    _t7AiRender();
  }

  // ── 5. Tự kiểm ──────────────────────────────────────────────────────
  let nBo = 0;
  if (!boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(4, { 4: 'đang soi lại cả kế hoạch…' });
    setStatus7('🧐 Tự kiểm cả kế hoạch…', 'working');
    nBo = await _t7AiCritic(cat);
  }
  const nDrop = _t7AiQ.filter(q => q.drop).length;
  _t7AiQ = _t7AiQ.filter(q => !q.drop);

  // ── 6. Chuyển cảnh ──────────────────────────────────────────────────
  let nTr = 0;
  if (!state.cancelRequested){
    try { if (!_t7Trans) await _t7LoadTrans(); } catch (e) {}
    const trCat = _t7Trans || [];
    if (trCat.length > 1){
      _t7AiSteps(5, { 5: '0/' + Math.max(0, clips.length - 1) + ' mối nối' });
      setStatus7('⚡ Chọn chuyển cảnh cho ' + Math.max(0, clips.length - 1) + ' mối nối…', 'working');
      const tr = await _t7AiTrans(clips, map, trCat,
        (d, t, n) => _t7AiSteps(5, { 5: d + '/' + t + ' mối nối · ' + n + ' đề xuất' }));
      _t7AiQ = _t7AiQ.concat(tr); nTr = tr.length;
    } else {
      _t7AiSteps(5, { 5: 'kho chuyển cảnh rỗng — bỏ qua' });
    }
  }
  _t7AiSave();                                   // chốt kết quả vào dự án ngay khi chạy xong

  _t7AiSteps(6, {
    1: nRole + ' cảnh · ' + roleLine,
    2: boQuaDoHoa ? 'kho mẫu rỗng — bỏ qua' : (todo.length + ' cảnh đã đọc'),
    3: boQuaDoHoa ? 'bỏ qua' : (nTxt ? (vis.xong + '/' + nTxt + ' khung' + (vis.doi ? ' · ' + vis.doi + ' cảnh chưa có hình' : '')) : 'không cảnh nào đặt chữ'),
    4: boQuaDoHoa ? 'bỏ qua' : (nDrop ? ('loại ' + nDrop + ' đề xuất yếu') : 'kế hoạch sạch'),
    5: nTr ? (nTr + '/' + Math.max(1, clips.length - 1) + ' mối nối khác cắt thẳng') : 'tất cả cắt thẳng',
  });
  _t7AiRender();
  if (hong.length) novaLog && novaLog(`✨ ${hong.length} cảnh không đề xuất được (lô lỗi): ${hong.slice(0, 6).join(', ')}${hong.length > 6 ? '…' : ''}`, 'warn');
  const nGfx = _t7AiQ.length - nTr;
  if (boQuaDoHoa && !nTr){
    setStatus7('Kho mẫu và kho chuyển cảnh đều rỗng — thêm vào editor-pro/nova-remotion/src/ rồi chạy lại.', 'info');
    _t7AiRender(); return;
  }
  setStatus7(_t7AiQ.length
    ? `✨ ${nGfx} đồ hoạ + ${nTr} chuyển cảnh${nDrop ? ` (đã tự loại ${nDrop})` : ''}${hong.length ? ` · ${hong.length} cảnh lỗi, xem Nhật ký` : ''} — duyệt ở bảng bên phải.`
    : 'Trợ lý không đề xuất gì thêm.', _t7AiQ.length ? 'ok' : 'info');
}

async function t7AiDesign(){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return;
  }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  const allowed = new Set(cat.map(c => c.template));

  // Khoá ĐÚNG nút của chính hàm này (trước khoá nhầm t7AiDesignBtn = nút "Trợ lý dựng"),
  // đồng thời chặn bấm lần hai gây chạy chồng 2 vòng lặp trên cùng danh sách cảnh.
  if (_t7AiGfxRunning){ if (typeof requestCancel === 'function') requestCancel();
    setStatus7('⏸ Sẽ dừng sau khi xong lô đang chạy…', 'info'); return; }
  _t7AiGfxRunning = true;
  const btn = document.getElementById('t7AiGfxBtn');
  if (btn){ btn.textContent = '■ Dừng dựng'; btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; }
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const specs = Object.assign({}, state.sceneSpecs || {});
  let done = 0, picked = 0;
  const BATCH = 12;                                   // lô nhỏ để JSON không vỡ ở kịch bản dài

  try {
    for (let i = 0; i < clips.length; i += BATCH){
      if (state.cancelRequested){ setStatus7('Đã dừng.', 'warn'); break; }
      const lot = clips.slice(i, i + BATCH);
      setStatus7(`🎬 AI dựng đồ hoạ ${i + 1}–${Math.min(i + BATCH, clips.length)}/${clips.length}…`, 'working');
      const list = lot.map((c, k) => {
        const sc = (typeof _t7ClipScene === 'function') ? _t7ClipScene(c) : null;
        return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(sc && sc.text, 180) || '(không có lời)'}`;
      }).join('\n');

      const prompt = `You are a motion-graphics editor for faceless Vietnamese videos.
For EACH scene below, pick 0–2 graphics templates to overlay. Leaving it empty (empty array) is allowed when a scene needs nothing.

USABLE TEMPLATES (you may only choose from this list):
${catLine}

RULES:
- Don't overuse: most scenes need only 0 or 1 templates. Text covering every scene clutters and hides the imagery.
- On-screen text must be SHORT (under 6 words), the key takeaway of the scene — do NOT copy the full voiceover line.
- lower-thirds only when the scene mentions a specific person/place name.
- typewriter-text / kinetic-typography only for emphasized scenes, at most 1-2 scenes in the whole video.
- vignette / film-grain / light-leak are ambient layers, use sparingly and without text.
- Scenes shorter than 2.5 seconds should not get templates with long text.

SCENES:
${list}

Return a JSON array of ${lot.length} elements, element k matching scene k:
[{"i":0,"picks":[{"template":"template-name","text":"short text if the template needs it"}]}]
Fill in only the fields the template accepts. Do not add strange fields.`;

      let arr = [];
      try {
        arr = await callLLMJson(prompt, { maxTokens: 1400, validate: (d) => Array.isArray(d) });
      } catch (e) {
        novaLog && novaLog(`🎬 Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn');
        done += lot.length; continue;                 // hỏng 1 lô thì bỏ qua, không chết cả lượt
      }

      arr.forEach((row) => {
        const k = Number(row && row.i);
        const c = lot[Number.isFinite(k) ? k : -1];
        if (!c) return;
        const picks = Array.isArray(row.picks) ? row.picks.slice(0, 2) : [];
        // Chỉ nhận mẫu có thật — AI bịa tên thì bỏ, không để engine phải đoán.
        const layers = picks
          .filter(p => p && allowed.has(p.template))
          .map(p => Object.assign({}, p));
        if (!layers.length){ delete specs[c.sceneId]; return; }
        specs[c.sceneId] = {
          rev: Date.now(),
          // Ảnh cảnh luôn nằm dưới cùng; '@scene' được _t7NovaScenes thay bằng ảnh thật lúc dựng.
          layers: [{ type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } }].concat(layers),
        };
        picked += layers.length;
      });
      done += lot.length;
    }

    state.sceneSpecs = specs;
    const nScene = Object.keys(specs).length;
    if (typeof saveState === 'function') saveState(true);
    setStatus7(`✓ AI đã gắn ${picked} lớp đồ hoạ cho ${nScene}/${clips.length} cảnh.`, 'ok');
    if (typeof novaLog === 'function') novaLog(`🎬 AI dựng đồ hoạ: ${picked} lớp / ${nScene} cảnh.`, 'ok');
    if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  } finally {
    _t7AiGfxRunning = false;
    if (btn){ btn.disabled = false; btn.textContent = '🎬 AI dựng đồ hoạ'; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof clearCancel === 'function') clearCancel();
  }
}

function t7AiDesignClear(){
  state.sceneSpecs = {};
  if (typeof saveState === 'function') saveState(true);
  // Trước đây chỉ xoá dữ liệu rồi thôi — màn hình vẫn hiện y nguyên đồ hoạ đã gỡ.
  if (typeof t7RenderDetail === 'function') t7RenderDetail();
  if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã gỡ hết lớp đồ hoạ AI.', 'ok');
}

function t7AiDesignClearAsk(){
  const n = Object.keys(state.sceneSpecs || {}).length;
  if (!n){ setStatus7('Không có cảnh nào đang gắn đồ hoạ AI.', 'info'); return; }
  if (confirm(`Gỡ đồ hoạ AI khỏi ${n} cảnh? Ảnh và clip giữ nguyên, chỉ bỏ lớp chữ/hiệu ứng.`)) t7AiDesignClear();
}
