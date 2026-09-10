/* AUTO-EXTRACTED from index.html block 3 - prefix: t10 */

/* AUTO-EXTRACTED wrapper: tool-t10 ẩn mọi t9* ra khỏi code. */
// t9Ref/_t9RefDescribe/_t9RefConcepts/_t9CaptionsFromPattern/T9_REF_RULE ở shared-consts.js const top-level,
// cùng realm nên vẫn thấy. Ở đây wrap thành t10* để tool-t10.js độc lập về ý nghĩa.
const t10Ref = t9Ref;                          // state object (cùng reference)
const t10RefDescribe = _t9RefDescribe;         // describe ảnh mẫu
const t10RefConcepts = _t9RefConcepts;         // dựng N concept
const t10RefCaptionsFromPattern = _t9CaptionsFromPattern;  // sinh N câu chữ
const T10_REF_RULE = T9_REF_RULE;              // rule string
function t10GetTitle(){
  return (document.getElementById('t10TitleInput')?.value || '').trim()
    || (document.getElementById('tsTopic')?.value || '').trim()
    || (document.getElementById('t9Title')?.value || '').trim()
    || (t9State?.result?.titles?.[0] || '').trim()
    || '';
}

function t10SyncTitleInput(){
  const el = document.getElementById('t10TitleInput'); if (!el) return;
  if (!el.value.trim()) {
    const t = (document.getElementById('tsTopic')?.value || '').trim()
      || (document.getElementById('t9Title')?.value || '').trim()
      || (t9State?.result?.titles?.[0] || '').trim() || '';
    if (t) el.value = t;
  }
}

function t10SyncStyleState(){
  const el = document.getElementById('t10StyleState'); if (!el) return;
  const p = getProfile();
  const has = p && (p.thumbPrompt || (Array.isArray(p.thumbRefs) && p.thumbRefs.length));
  const n = (p && Array.isArray(p.thumbRefs)) ? p.thumbRefs.length : 0;
  el.textContent = has ? `style kênh: ✓ đã có${n ? ` (${n} ảnh mẫu)` : ''}` : 'style kênh: chưa có — thêm ở Profile';
  el.style.color = has ? 'var(--green)' : 'var(--amber)';
}

function t10LoadFromProfile(){
  const p = getProfile();
  t10State.refs = (p && Array.isArray(p.thumbRefs))
    ? p.thumbRefs.map(r => ({ base64: r.base64, mime: r.mime || 'image/jpeg', name: r.name || 'mau' }))
    : [];
  t10State.loadedProfileId = p ? p.profileId : null;
}

function t10OnProfileSwitch(){
  t10LoadFromProfile();
  t10SyncStyleState();
}

function t10ToggleText(){
  const on = document.getElementById('t10WithText')?.checked;
  const w = document.getElementById('t10TextWrap');
  if (w) w.style.display = on ? 'block' : 'none';
}

function t10TextSpec(){
  const on = document.getElementById('t10WithText')?.checked;
  const text = (document.getElementById('t10Text')?.value || '').trim();
  return { withText: !!on, text };
}

async function t10MakeConcepts(style, title, count){
  const styleLine = style || 'Bold, high-contrast, vivid, dramatic viral YouTube thumbnail illustration.';
  const p = `You are a viral YouTube thumbnail art director.
CHANNEL STYLE GUIDE (every concept MUST strictly follow this — medium, colors, rendering, layout):
${styleLine}

VIDEO TITLE: "${title}"

Propose ${count} DISTINCT thumbnail concepts for THIS video. Each must be a clearly different scene / subject / composition / emotion from the others, each a strong click magnet. For each, write ONE full English image-generation prompt (3-5 sentences) that:
- strictly follows the CHANNEL STYLE GUIDE above,
- depicts a specific fresh scene fitting this exact title, one clear focal subject with strong exaggerated emotion,
- keeps a clear area on one side for a bold caption,
- contains NO caption words or letters (caption is handled separately).
Return ONLY a JSON array of exactly ${count} strings (the prompts).`;
  const arr = await callLLMJson(p, { maxTokens: 400 + count * 280, validate: v => Array.isArray(v) && v.length });
  return (Array.isArray(arr) ? arr : []).filter(x => typeof x === 'string' && x.trim()).slice(0, count);
}

async function t10Generate(){
  if (typeof gateTool==='function' && gateTool('tool9')) return;
  const title = t10GetTitle();
  if (!title) return setStatus10('Cần TIÊU ĐỀ (tự lấy từ Tạo Kịch Bản/SEO, hoặc gõ vào ô Tiêu đề).', 'error');

  const count = parseInt(document.getElementById('t10Count').value) || 1;
  const p = getProfile();
  const style = (p && p.thumbPrompt) ? p.thumbPrompt.trim() : '';
  const { withText, text } = t10TextSpec();
  const refs = t10State.refs.map((r, i) => ({ name: `mau_${i + 1}`, base64: r.base64, mime: r.mime }));
  // 🖼 Ảnh mẫu chọn ở khối "Ảnh mẫu thumbnail" → đưa lên ĐẦU danh sách ref + gắn luật bắt chước (ẩn).
  const _hasRef = !!(typeof t10Ref === 'object' && t10Ref && t10Ref.base64);
  if (_hasRef) refs.unshift({ name: 'bo_cuc_mau', base64: t10Ref.base64, mime: t10Ref.mime || 'image/jpeg' });
  const _refItem = _hasRef ? (t10Ref.items || [])[t10Ref.sel] : null;

  // 1) AI viết N ý tưởng prompt khác nhau
  let concepts = [], _refCaps = [];
  if (_hasRef) {
    // Có ảnh mẫu → đọc mẫu bằng vision rồi TÁI DỰNG đúng bố cục, chỉ đổi chủ thể/chữ cho khớp tiêu đề.
    setStatus10('👁 Đang đọc bố cục ảnh mẫu…', 'working');
    const spec = await t10RefDescribe();
    // Mẫu có chữ → AI tự nghĩ N câu khác nhau (mỗi phương án một câu). Mẫu không chữ → không thêm chữ.
    if (spec && spec.caption) {
      _refCaps = await t10RefCaptionsFromPattern(title, count);
      if (_refCaps.length) setStatus10(`✍️ Chữ trên ảnh: ${_refCaps.map(c => '"' + c + '"').join(' · ')}`, 'working');
    }
    if (spec) {
      concepts = t10RefConcepts(spec, title, count, _refCaps);
      const bits = [spec.caption ? 'có chữ' : 'không chữ', spec.secondaryText.length ? spec.secondaryText.length + ' nhãn' : 'không nhãn'];
      setStatus10(`Đã đọc khuôn (${bits.join(' · ')}) — tạo ${count} ảnh bám mẫu…`, 'working');
    }
  }
  if (!concepts.length) {
    setStatus10(`AI đang viết ${count} ý tưởng thumbnail khác nhau từ tiêu đề + style kênh...`, 'working');
    try { concepts = await t10MakeConcepts(style, title, count); } catch (e) { concepts = []; }
  }
  if (!concepts.length) {
    concepts = [`${style || 'A bold high-contrast viral YouTube thumbnail in 16:9.'}\n\nVIDEO TOPIC: "${title}". A specific fresh scene for this topic, one clear focal subject with strong exaggerated emotion, clear space on one side for a caption.`];
  }
  const N = concepts.length;

  // Ghép chữ + ref role vào từng concept.
  // idx 0 khi có ảnh mẫu VÀ tạo ≥2 ảnh → giữ NGUYÊN chữ gốc của ảnh mẫu để so sánh.
  const buildFinal = (scene, idx) => {
    let pr = scene;
    if (_hasRef) pr += ' ' + T10_REF_RULE;
    if (_hasRef) {
      // Luật chữ/nhãn đã nằm trong concept (dựng từ spec của mẫu) → ở đây chỉ gắn vai trò ảnh tham chiếu.
      if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
      return pr;
    }
    if (withText && text) {
      pr += ` IMPORTANT — render this exact caption baked into the image, spelled EXACTLY: "${text}". Bold YouTube thumbnail caption: large uppercase sans-serif, the single most important word in bright red, the rest black or white with a subtle outline, placed in the empty area beside the subject. Add a hand-drawn black curved arrow pointing from the caption toward the subject. No other text anywhere in the image.`;
    } else {
      pr += ` The image must contain absolutely NO text, letters, numbers, words or logos — leave the side area clean so a caption can be added later.`;
    }
    if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
    return pr;
  };

  // 2) Sẵn sàng Flow?
  if (!(await flowBridge.waitReady(1500))) {
    return setStatus10('Chưa kết nối Flow. Vào Cài đặt → kết nối tài khoản Flow (extension) trước.', 'error');
  }
  const cfg = (typeof tfCfg === 'function') ? tfCfg() : {};
  const model = cfg.model || undefined;
  const quality = cfg.quality || 'orig';

  t10State.results = [];
  document.getElementById('t10Results').innerHTML = '';
  document.getElementById('t10ResultPanel').style.display = 'block';
  clearCancel();

  // Chạy SONG SONG theo ô "Luồng song song" ở Cài đặt (trước đây tạo tuần tự từng ảnh, rất chậm).
  const _lanes = Math.max(1, Math.min(N, parseInt(document.getElementById('tfConc')?.value) || 2));
  let _done = 0, _err = '';
  const _one = async (i) => {
    if (state.cancelRequested) return;
    try {
      const r = await flowBridge.call('POOL_GEN', { prompt: buildFinal(concepts[i], i), aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE', modelName: model, quality, variantCount: 1, withData: true, refs });
      if (r?.error) throw new Error(r.error);
      const e0 = (r?.media_entries || []).find(e => e.dataUrl || e.b64);
      if (!e0) throw new Error('Flow không trả ảnh (kiểm tra tài khoản/quota).');
      const dataUrl = e0.dataUrl || (`data:${e0.mime || 'image/png'};base64,${e0.b64}`);
      t10State.results.push({ dataUrl, mime: e0.mime || 'image/png' });
      t10RenderResults();
    } catch (e) { _err = `Ảnh ${i + 1}: ${String(e.message || e).slice(0, 120)}`; }
    _done++;
    setStatus10(`Đang tạo thumbnail… ${_done}/${N}${_lanes > 1 ? ` (⚡ ${_lanes} luồng)` : ''}`, 'working');
  };
  const _idx = Array.from({ length: N }, (_, i) => i);
  if (typeof runConcurrent === 'function') await runConcurrent(_idx, _one, _lanes, () => state.cancelRequested);
  else for (const i of _idx) { if (state.cancelRequested) break; await _one(i); }
  if (_err && !t10State.results.length) { setStatus10('Lỗi ' + _err, 'error'); return; }
  if (t10State.results.length) {
    setStatus10(`✓ Xong ${t10State.results.length}/${N} thumbnail${_err ? ' · ' + _err : ''}. Tải về, chọn cái đẹp nhất.`, _err ? 'info' : 'ok');
    notifyDone('✓ Thumbnail xong!', `${t10State.results.length} ảnh đã tạo.`);
  }
}

function t10RenderResults(){
  document.getElementById('t10Results').innerHTML = t10State.results.map((img, i) =>
    `<div style="display:flex;flex-direction:column;gap:6px">
      <img src="${img.dataUrl}" style="width:320px;max-width:100%;border-radius:8px;border:1px solid var(--border)">
      <button class="btn ghost sm" onclick="t10Download(${i})">↓ Tải ảnh ${i + 1}</button>
    </div>`
  ).join('');
}

function t10Download(i){
  const img = t10State.results[i];
  if (!img) return;
  const ext = ((img.mime || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
  const a = document.createElement('a');
  a.href = img.dataUrl;
  a.download = `thumbnail-${Date.now()}-${i + 1}.${ext}`;
  a.click();
}

function t10Reset(){
  t10State.results = [];
  document.getElementById('t10Results').innerHTML = '';
  document.getElementById('t10ResultPanel').style.display = 'none';
  setStatus10('Đã xoá kết quả. Sẵn sàng gen lại.', 'info');
}

function t10Init(){
  t10SyncTitleInput();     // prefill tiêu đề (sửa được)
  t10ToggleText();
  t10LoadFromProfile();    // nạp ảnh mẫu ẩn (reference cho Flow)
  t10SyncStyleState();     // nhãn trạng thái style của profile
}

