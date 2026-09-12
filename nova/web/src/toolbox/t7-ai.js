/* T7 AI — đề xuất media theo cảnh (t7AiPropose) + thiết kế cảnh (t7AiDesign + clear)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
// Dựng câu hỏi cho MỘT lô cảnh — MỘT nguồn duy nhất: lô đầy đủ của t7AiPropose và cảnh lẻ của
// "Thử lại"/"Tạo lại" cùng qua đây, nên đổi luật (ngôn ngữ chữ, trần hạn ngạch, ưu tiên không chữ)
// chỉ phải sửa một chỗ. C = { map, allowed, cat, catLine, S, topic }.
function _t7AiPrompt(lot, C){
  const list = lot.map((c, k) => {
    const sc = _t7ClipScene(c), mp = C.map[c.sceneId] || {};
    const meta = [mp.role, mp.emp != null ? 'nhấn ' + mp.emp : '', mp.key ? 'tên: ' + mp.key : '', mp.num ? 'số: ' + mp.num : ''].filter(Boolean).join(' · ');
    return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s]${meta ? ' {' + meta + '}' : ''} ${_t7Gist(sc && sc.text, 200) || '(không có lời)'}`;
  }).join('\n');
  const topic = C.topic;
  return `You are a motion-graphics editor for faceless Vietnamese videos.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}For EACH scene below, pick 0–2 graphics templates to overlay, AND explain why.

USABLE TEMPLATES (you may only choose from this list):
${C.catLine}

REMAINING QUOTAS FOR THE WHOLE VIDEO (going over gets auto-rejected):
${_t7AiQuotaLine(C.S)}

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
}

// Biến kết quả AI của một lô thành entry hàng đợi, qua ĐÚNG bộ lọc hạn ngạch như lô đầy đủ.
// C = { map, allowed, cat, S, clips }. C.S được cập nhật → hạn ngạch tính liên tục cả video.
// Trả số entry đã thêm (0 = AI không đề xuất gì hợp lệ cho lô này).
function _t7AiIngest(arr, lot, i0, C){
  let them = 0;
  arr.forEach(row => {
    const k = Number(row && row.i);
    const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
    // C.index cho biết vị trí THẬT của cảnh trong video — cần khi thử lại từng cảnh lẻ,
    // nếu lấy k trong lô thì quy tắc "không lặp lại mẫu cách dưới 3 cảnh" tính sai nhịp.
    const idx = (C.index && C.index[c.sceneId] != null) ? C.index[c.sceneId]
      : (i0 + (Number.isFinite(k) ? k : 0));
    const dur = parseFloat(_t7ClipDur(c)) || 3;
    // AI bịa tên mẫu thì bỏ — engine không phải đoán. Rồi soi tiếp qua hạn ngạch.
    const picks = [];
    (Array.isArray(row.picks) ? row.picks : []).slice(0, 2).forEach(x => {
      if (!x || !C.allowed.has(x.template)) return;
      if (dur < 2.5 && _t7TplTextKey(C.cat, x.template)) return;   // cảnh chớp mắt, chữ chưa kịp đọc
      if (_t7AiGate(x.template, idx, C.S, C.cat)) return;
      _t7AiTake(x.template, idx, C.S, C.cat);
      picks.push(Object.assign({}, x));               // bản sao: về sau lọc trường không đụng object của AI
    });
    // Không có mẫu nào hợp → AI tự bố cục. Lọc + kẹp mọi con số trước khi nhận.
    const custom = picks.length ? [] : _t7AiFixLayers(row.custom, dur);
    if (!picks.length && !custom.length) return;
    if (custom.length){
      if (custom.some(L => L.type === 'text') && C.S.txt >= C.S.quota._text) return;   // vẫn tính vào trần chữ
      if (custom.some(L => L.type === 'text')) C.S.txt++;
    }
    const sc = _t7ClipScene(c), mp = C.map[c.sceneId] || {};
    _t7AiQ.push({
      sceneId: c.sceneId, fx: c.fx, name: _t7ClipLabel(c), picks, custom, role: mp.role || '',
      // Dấu vân tay lời lúc đề xuất — lần mở sau đối chiếu, lời đổi là đề xuất hết hiệu lực.
      h: _t7AiEntrySig({ sceneId: c.sceneId }, C.clips) || _t7AiSig(sc && sc.text),
      tplLabel: custom.length ? _t7CustomNhan(custom)
        : picks.map(x => (C.allowed.get(x.template) || {}).label || x.template).join(' + '),
      line: _t7Gist(sc && sc.text, 110) || '(không có lời)',
      why: String(row.why || '').trim() || 'Trợ lý không nêu lý do — nên xem kỹ trước khi gắn.',
      state: '', drop: '',
    });
    them++;
  });
  return them;
}


// Hỏi AI LẠI cho một nhóm cảnh đã chọn — đường dùng chung của "Thử lại cảnh lỗi" (#4) và
// "↻ Tạo lại thẻ này" (#5). Đi đúng qua _t7AiPrompt + _t7AiIngest như lô đầy đủ nên không có
// nhánh luật riêng: cùng danh sách trắng, cùng bộ lọc hạn ngạch, cùng cách kẹp toạ độ.
// ctx = { cat, allowed, catLine, topic, map, index, clips } — lấy từ lượt phân tích gần nhất.
// Trả { them, hong } (hong = cảnh vẫn lỗi sau khi đã thử 2 lần).
async function _t7AiAskScenes(cans, ctx){
  const cat = ctx.cat;
  // Hạn ngạch seeding từ sceneSpecs THẬT (_t7AiSeed) → hỏi lại từng cảnh KHÔNG được phép vượt
  // trần chữ / trần lớp không khí của cả video, đúng như dòng quota in trong prompt.
  const S = _t7AiSeed(cat, ctx.clips, state.sceneSpecs, Math.max(1, ctx.clips.length));
  const C = Object.assign({}, ctx, { S });
  let them = 0; const hong = [];
  for (let i = 0; i < cans.length; i += _T7_AI_BATCH){
    if (state.cancelRequested) break;
    const lot = cans.slice(i, i + _T7_AI_BATCH);
    const prompt = _t7AiPrompt(lot, C);
    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await _t7AiJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('✨ Thử lại cảnh lỗi: ' + String(e.message || e).slice(0, 90), 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push({ sceneId: c.sceneId, name: _t7ClipLabel(c) })); continue; }
    them += _t7AiIngest(arr, lot, 0, C);
  }
  return { them, hong };
}

// Soi khung cho các đề xuất mới thêm rồi dựng lại + chốt vào dự án. Ba nút dưới đều dùng.
async function _t7AiAfterAsk(nThem, ctx, noteOk){
  if (nThem){
    await _t7AiVision(ctx.cat, (d, t) => setStatus7('👁 Soi ' + d + '/' + t + ' khung hình…', 'working'));
    setStatus7(noteOk, 'ok');
  } else {
    setStatus7(noteOk || 'Trợ lý xét các cảnh này nên để trơn — không có gì để gắn.', 'info');
  }
  _t7AiRender(); _t7AiSave();
}

// Nút "↻ Tạo lại" trên từng thẻ (#5) — chỉ hỏi riêng cảnh của thẻ, rồi THAY THẺ ĐÓ bằng kết quả
// mới. Không đụng các thẻ khác, không chạy lại cả video. Thẻ đã duyệt thì khoá (đừng phá quyết định).
async function t7AiRegen(i){
  if (_t7AiBusy){ setStatus7('Trợ lý đang chạy — chờ xong rồi tạo lại.', 'info'); return; }
  const q = _t7AiQ[i]; if (!q || q.state || q.kind === 'tr') return;
  const ctx = _t7AiCtx;
  if (!ctx || !ctx.cat){ setStatus7('Chưa có ngữ cảnh phân tích — bấm ↻ Phân tích lại trước.', 'error'); return; }
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  const c = clips.find(x => x && x.sceneId === q.sceneId);
  if (!c){ setStatus7('Cảnh này không còn trên dòng thời gian.', 'error'); return; }
  _t7AiBusy = true;
  const cu = _t7AiQ[i];
  try {
    setStatus7('✨ Đang nghĩ lại cảnh ' + (cu.name || '') + '…', 'working');
    _t7AiQ.splice(i, 1);                                 // gỡ thẻ cũ TRƯỚC khi hỏi — hỏi hỏng thì còn đường trả lại
    _t7AiRender();
    const tru = _t7AiQ.length;                           // đề xuất mới được push xuống cuối…
    const kq = await _t7AiAskScenes([c], ctx);
    if (_t7AiQ.length > tru){
      // …nhưng thẻ vừa tạo lại phải NGỒI LẠI ĐÚNG CHỖ CŨ, không nhảy xuống cuối danh sách —
      // người dùng đang xem dở vị trí đó, xáo thứ tự là mất dấu.
      _t7AiQ.splice(i, 0, ..._t7AiQ.splice(tru, _t7AiQ.length - tru));
    }
    if (kq.them){
      await _t7AiAfterAsk(kq.them, ctx, '✓ Đã nghĩ lại cảnh ' + (cu.name || '') + '.');
    } else if (!kq.hong.length){
      setStatus7('Trợ lý đổi ý: cảnh ' + (cu.name || '') + ' nên để trơn — đã bỏ thẻ.', 'info');
      _t7AiRender(); _t7AiSave();
    } else {
      _t7AiQ.splice(i, 0, cu);                           // hỏi KHÔNG được → trả lại thẻ cũ, nói rõ lý do
      setStatus7('Không hỏi lại được cho cảnh này — giữ nguyên đề xuất cũ.', 'error');
      _t7AiRender();
    }
  } finally { _t7AiBusy = false; }
}

// Nút "↩ Dùng lại" cho một mục đã bị soi khung / tự kiểm loại (#6). Mục bị loại VẪN nằm trong
// hàng đợi với state='dr' → persistence miễn phí (state.aiQueue lưu cả hàng), không có kho riêng.
// Lý do loại vẫn hiển thị để người dùng quyết định có thật sự muốn dùng lại không.
function t7AiRestore(i){
  const q = _t7AiQ[i]; if (!q || q.state !== 'dr') return;
  q.state = ''; delete q.drop;                 // xoá lý do: nó chỉ đúng với đề xuất cũ
  // KHÔNG để hai thẻ cùng một cảnh nằm cạnh nhau: nếu cảnh này đã có đề xuất khác đang chờ
  // (do tạo lại / thử lại sinh ra) thì thẻ vừa khôi phục là bản cũ → dẹp hẳn, nói rõ vì sao.
  const trung = _t7AiQ.findIndex((x, k) => k !== i && x.sceneId === q.sceneId && x.kind === q.kind && !x.state);
  if (trung >= 0){
    _t7AiQ.splice(i, 1);
    _t7AiRender(); _t7AiSave();
    setStatus7('Cảnh ' + (q.name || '') + ' đã có đề xuất khác đang chờ — không trả bản bị loại về nữa.', 'info');
    return;
  }
  _t7AiRender(); _t7AiSave();
  setStatus7('↩ Đã trả "' + (q.name || '') + '" về hàng đợi chờ duyệt — bấm Gắn nếu chắc.', 'ok');
}

// Nút "Thử lại" ở mục cảnh lỗi (#4) — hỏi LẠI đúng những cảnh lô AI làm hỏng, gộp vào ít lượt
// gọi nhất. Thành công thì xoá khỏi _t7AiHong; vẫn hỏng thì giữ lại để người dùng biết.
async function t7AiRetryFailed(){
  if (_t7AiBusy){ setStatus7('Trợ lý đang chạy — chờ xong đã.', 'info'); return; }
  const ctx = _t7AiCtx;
  if (!ctx || !ctx.cat){ setStatus7('Chưa có kết quả phân tích để thử lại — bấm ↻ Phân tích lại.', 'error'); return; }
  const danh = _t7AiHong.slice();
  if (!danh.length){ setStatus7('Không còn cảnh nào thiếu đề xuất.', 'info'); return; }
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  const cans = clips.filter(c => c && danh.some(h => h.sceneId === c.sceneId));
  _t7AiBusy = true;
  setStatus7(`✨ Đang hỏi lại ${cans.length || danh.length} cảnh thiếu đề xuất…`, 'working');
  try {
    if (!cans.length){ _t7AiHong = []; _t7AiRender(); _t7AiSave();
      setStatus7('Các cảnh lỗi đã bị xoá khỏi dự án.', 'info'); return; }
    const kq = await _t7AiAskScenes(cans, ctx);
    // Cảnh đã thử xong → loại khỏi danh sách lỗi; cảnh vẫn lỗi của lần này thế chỗ.
    _t7AiHong = kq.hong;
    await _t7AiAfterAsk(kq.them, ctx,
      `✓ Bổ sung ${kq.them} đề xuất${_t7AiHong.length ? ` · vẫn còn ${_t7AiHong.length} cảnh lỗi` : ''}.`);
    if (!kq.them) setStatus7(_t7AiHong.length
      ? `Vẫn còn ${_t7AiHong.length} cảnh hỏi không được — kiểm tra kết nối/API rồi thử lại.`
      : 'Trợ lý xét các cảnh còn lại nên để trơn.', _t7AiHong.length ? 'error' : 'info');
  } finally { _t7AiBusy = false; }
}

// Ghi lại ngữ cảnh của một lượt/phên nạp hàng đợi để các nút "↻ Tạo lại" / "↻ Thử lại" hỏi lại
// ĐÚNG như lúc phân tích đầy đủ (cùng danh mục, cùng trần chữ, cùng bản đồ vai trò).
function _t7AiSetCtx(cat, map, clips){
  _t7AiCtx = {
    cat, allowed: new Map(cat.map(c => [c.template, c])),
    catLine: cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n'),
    topic: String(state.videoLogline || '').trim(), map, index: (() => {
      const ix = {}; (clips || []).forEach((c, k) => { ix[c.sceneId] = k; }); return ix;
    })(), clips: clips || [],
  };
  return _t7AiCtx;
}

// Wrapper chống chạy chồng: mọi nút dẫn vào lượt phân tích (Trợ lý dựng / AI dựng đồ hoạ /
// Phân tích lại) đều đi qua đây. Trước đây chỉ t7AiDesign có lá chắn (_t7AiGfxRunning) nên bấm
// "Trợ lý dựng" hai lần vẫn spawn hai vòng lặp cùng ghi lên một hàng đợi.
async function t7AiPropose(lamLai){
  if (_t7AiBusy){ setStatus7('Trợ lý đang chạy — chờ xong hoặc bấm Dừng trước đã.', 'info'); return; }
  _t7AiBusy = true;
  try { await _t7AiProposeRun(lamLai); }
  finally { _t7AiBusy = false; }
}

async function _t7AiProposeRun(lamLai){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  // Mở khung trợ lý + báo đang chạy NGAY TRƯỚC mọi lượt chờ AI — nếu chờ danh mục
  // xong mới mở thì lúc "Phân tích lại" màn hình im lặng, tưởng bấm hụt.
  const m = document.getElementById('t7Ai'); if (m) m.classList.add('on');
  _t7AiSteps(0, { 0: 'đang chuẩn bị…' });
  document.getElementById('t7AiProps').innerHTML = '<div class="t7-empty">'
    + (lamLai ? '↻ Đang phân tích lại từ đầu… đọc kịch bản và so khớp kho mẫu.' : 'Đang nạp dự án…') + '</div>';
  setStatus7(lamLai ? '✨ Trợ lý dựng đang phân tích lại toàn bộ cảnh…' : '✨ Trợ lý dựng đang nạp dự án…', 'working');
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  // Kho mẫu rỗng thì BỎ QUA phần đồ hoạ chứ không thoát hẳn — chuyển cảnh vẫn chạy được.
  // Chạy phần đề xuất mẫu khi kho rỗng chỉ tổ đốt 60 lượt gọi rồi loại sạch.
  const boQuaDoHoa = !cat.length;
  const allowed = new Map(cat.map(c => [c.template, c]));

  // ── Mở lại video cũ: dựng thẳng hàng đề xuất đã lưu, KHÔNG gọi lại AI ──
  if (!lamLai){
    // Đề xuất lấy CHÍNH lời thoại của cảnh làm nguyên liệu: lời đã sửa thì đề xuất cũ sai theo lời mới.
    // So vân tay lời hiện tại (_t7AiEntrySig — mối nối tính trên cả cặp cảnh hai bên) với dấu 'h'
    // đã đóng khi đề xuất; entry đời chưa có dấu thì mượn vân tay của bản đồ vai trò (cùng phép tính).
    // Lệch hoặc cảnh bị xoá → BỎ hẳn, không dựng lại cái đã lỗi thời (Luật 10: không âm thầm giữ).
    const mapCu = state.aiMap || {};
    // Khôi phục danh sách cảnh lỗi của dự án TRƯỚC khi bất kỳ _t7AiSave() nào chạy — nếu không
    // nó sẽ ghi đè state.aiHong bằng mảng rỗng trong bộ nhớ rồi mới đọc lại, mất sạch.
    _t7AiHong = (Array.isArray(state.aiHong) ? state.aiHong : []).filter(h => h && h.sceneId);
    const hopLe = [], loai = { matCanh: 0, doiLoi: 0 };
    (state.aiQueue || []).filter(q => q && q.sceneId).forEach(q => {
      const h = _t7AiEntrySig(q, clips);
      if (h == null){ loai.matCanh++; return; }                        // cảnh không còn trên dòng thời gian
      const cu = (q.h != null) ? q.h
        : (q.kind === 'tr' ? null : ((mapCu[q.sceneId] || {}).h));   // bản đồ chỉ có vân tay 1 cảnh → không dùng được cho mối nối
      if (cu != null && cu !== h){ loai.doiLoi++; return; }            // lời đổi → đề xuất hết hiệu lực
      q.h = h;                                                        // đóng dấu để lần sau khỏi mượn bản đồ
      hopLe.push(q);
    });
    const loaiHet = loai.matCanh + loai.doiLoi;
    if (hopLe.length){
      _t7AiQ = hopLe; state.aiQueue = hopLe;
      if (loaiHet) _t7AiSave();                                        // ghi luôn việc đã bỏ entry cũ
      const cho = hopLe.filter(q => !q.state).length;
      const nMap = Object.keys(mapCu).length;
      const nTrCu = hopLe.filter(q => q.kind === 'tr').length;
      _t7AiHong = _t7AiHong.filter(h => clips.some(c => c.sceneId === h.sceneId)
        && !hopLe.some(q => q.sceneId === h.sceneId && q.kind !== 'tr'));   // cảnh đã xoá hoặc đã có đề xuất → không còn "thiếu"
      _t7AiStat.calls = 0; _t7AiStat.ms = 0;        // phiên khôi phục: không gọi AI nên số đếm để trống
      _t7AiSetCtx(cat, state.aiMap || {}, clips);    // cho phép Tạo lại / Thử lại ngay, khỏi phân tích lại cả video
      _t7AiSteps(6, { 0: clips.length + ' cảnh', 1: nMap + ' cảnh đã có vai trò',
        2: (hopLe.length - nTrCu) + ' đồ hoạ (kết quả đã lưu)', 3: 'đã soi lần trước', 4: 'đã kiểm lần trước',
        5: nTrCu + ' chuyển cảnh' });
      _t7AiRender();
      if (loaiHet) setStatus7(`⚠️ ${loaiHet} đề xuất cũ không còn hợp lệ`
        + (loai.doiLoi ? ` (lời thoại đã sửa: ${loai.doiLoi})` : '')
        + (loai.matCanh ? `${loai.doiLoi ? ' · ' : ' ('}cảnh đã xoá: ${loai.matCanh})` : '')
        + ` — còn ${hopLe.length} đề xuất lấy từ dự án. Bấm ↻ Phân tích lại cho các cảnh vừa đổi lời.`, 'warn');
      else setStatus7(cho ? `✨ ${cho}/${hopLe.length} đề xuất còn chờ duyệt (lấy từ dự án, không chạy lại AI).`
                     : `✓ Đã duyệt hết ${hopLe.length} đề xuất của video này. Bấm ↻ Phân tích lại nếu muốn làm mới.`, 'ok');
      return;
    }
    if (loaiHet) setStatus7(`⚠️ Cả ${loaiHet} đề xuất đã lưu không còn hợp lệ (lời thoại sửa / cảnh bị xoá) — trợ lý đọc lại từ đầu.`, 'info');
  }
  _t7AiQ = []; state.aiQueue = _t7AiQ;
  _t7AiStatReset();                 // lượt mới: đếm lại số gọi AI + xoá danh sách cảnh lỗi của lượt trước
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
  // Hạn ngạch KHỞI ĐẦU TỪ NHỮNG GÌ ĐÃ THỰC SỰ GẮN trong video, không phải từ 0: prompt vẫn
  // tuyên bố "REMAINING QUOTAS FOR THE WHOLE VIDEO", nên code phải tính đúng như lời nó nói —
  // nếu không, bấm "Phân tích lại" lần hai là trần chữ của cả video bị reset và video phình chữ.
  const S = _t7AiSeed(cat, clips, state.sceneSpecs, clips.length);
  const hong = _t7AiHong;                            // mảng toàn cục — sheet đọc để hiện nút "thử lại"
  const index = {}; clips.forEach((c, k) => { index[c.sceneId] = k; });   // vị trí thật của cảnh → cooldown hạn ngạch đúng
  const C = { map, allowed, cat, catLine, S, topic, clips, index };
  _t7AiSetCtx(cat, map, clips);                       // "#5 Tạo lại cảnh này" hỏi đúng như lô đầy đủ
  const BATCH = _T7_AI_BATCH;
  for (let i = 0; boQuaDoHoa ? false : i < todo.length; i += BATCH){
    if (state.cancelRequested) break;
    const lot = todo.slice(i, i + BATCH);
    _t7AiSteps(2, { 1: nRole + ' cảnh · ' + roleLine, 2: Math.min(i + BATCH, todo.length) + '/' + todo.length + ' cảnh · ' + _t7AiQ.length + ' đề xuất' });
    setStatus7(`✨ Trợ lý đọc cảnh ${i + 1}–${Math.min(i + BATCH, todo.length)}/${todo.length}…`, 'working');
    const prompt = _t7AiPrompt(lot, C);

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await _t7AiJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog(`✨ Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push({ sceneId: c.sceneId, name: _t7ClipLabel(c) })); continue; }

    _t7AiIngest(arr, lot, i, C);
    _t7AiRender();
    _t7AiSave();                       // chốt từng lô vào dự án — đóng app giữa lượt không mất cả nghìn credit
  }

  // ── 4. Soi khung hình những cảnh định đặt chữ ───────────────────────
  let vis = { xong: 0, doi: 0 };
  const nTxt = _t7AiQ.filter(q => q.picks.some(p => _t7TplTextKey(cat, p.template))).length;
  if (nTxt && !boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(3, { 3: '0/' + nTxt + ' khung hình' });
    setStatus7(`👁 Soi ${nTxt} khung hình để đặt chữ vào chỗ trống…`, 'working');
    vis = await _t7AiVision(cat, (d, t) => _t7AiSteps(3, { 3: d + '/' + t + ' khung hình' }));
    _t7AiRender();
    _t7AiSave();                       // vision đổi vị trí/chữ của đề xuất — đắt, chốt ngay khỏi mất khi gián đoạn
  }

  // ── 5. Tự kiểm ──────────────────────────────────────────────────────
  let nBo = 0;
  if (!boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(4, { 4: 'đang soi lại cả kế hoạch…' });
    setStatus7('🧐 Tự kiểm cả kế hoạch…', 'working');
    nBo = await _t7AiCritic(cat);
  }
  // Mục bị soi khung / tự kiểm loại KHÔNG bị vứt khỏi hàng đợi — đánh dấu 'dr' rồi gập vào
  // mục "Đã tự loại". Người dùng thấy trợ lý đã loại gì và vì sao, bấm ↩ là dùng lại được;
  // trước đây chúng biến mất lặng lẽ nên không phân biệt được "không có gì" với "bị loại".
  const nDrop = _t7AiQ.filter(q => q.drop).length;
  _t7AiQ.forEach(q => { if (q.drop) q.state = 'dr'; });
  _t7AiSave();                       // kết quả tự kiểm là thứ không muốn phải trả credit lần hai

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
  if (hong.length) novaLog && novaLog(`✨ ${hong.length} cảnh không đề xuất được (lô lỗi): ${hong.map(h => h.name).slice(0, 6).join(', ')}${hong.length > 6 ? '…' : ''}`, 'warn');
  // Đếm riêng để báo đúng: nGfx = số THẺ còn chờ duyệt, nTr = mối nối, nDrop = mục đã loại.
  const nCh = _t7AiQ.filter(q => q.state !== 'dr').length;   // thẻ đang chờ / đã duyệt
  const nGfx = Math.max(0, nCh - nTr);
  if (boQuaDoHoa && !nTr){
    setStatus7('Kho mẫu và kho chuyển cảnh đều rỗng — thêm vào editor-pro/nova-remotion/src/ rồi chạy lại.', 'info');
    _t7AiRender(); return;
  }
  const thongKe = _t7AiStatLine();
  setStatus7(_t7AiQ.length
    ? `✨ ${nGfx} đồ hoạ + ${nTr} chuyển cảnh${nDrop ? ` · đã tự loại ${nDrop}` : ''}${hong.length ? ` · ${hong.length} cảnh lỗi (thử lại trong bảng)` : ''}${thongKe ? ` · ${thongKe}` : ''} — duyệt ở bảng bên phải.`
    : `Trợ lý không đề xuất gì thêm.${thongKe ? ' ' + thongKe : ''}`, _t7AiQ.length ? 'ok' : 'info');
}

// t7AiDesign TRƯỚC ĐÂY là đường tắt riêng: đọc kịch bản rồi GẮN THẲNG vào sceneSpecs,
// bỏ qua bước duyệt từng cảnh mà toàn bộ thiết kế của Trợ lý dựng dựa vào, và cũng không đi
// qua hạn ngạch / soi khung hình / tự kiểm. Nay nó chỉ còn là BƯỚC NGÕ vào đúng luồng có
// duyệt: cùng một hàng đợi, cùng nút Gắn/Bỏ qua — không còn hai đường ra hai chất lượng.
// Giữ TÊN hàm vì call-site (nút "AI dựng đồ hoạ" ở t7-top + mục trong rail AI) trỏ vào đây.
function t7AiDesign(){ return t7AiPropose(false); }

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
