/* T7 SRC — nguồn media YouTube/stock (t7YtForScene, t7StockForScene, t7SrcYt/Stock/Tab), AI quyết định ảnh/video (t7AiDecide/Pv/Try/Edit), inspector + khớp lỗi, render danh sách cảnh
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7YtForScene(clipId, sceneId){
  const n = ((state.ytCandidates || {})[sceneId] || []).length;
  if (n) { t7OpenYtPicker(sceneId, null, ''); return; }
  t7SmartClipScene(clipId);
}

async function t7StockForScene(sceneId){
  const have = ((state.stockCandidates || {})[sceneId] || []).length;
  if (have){ t2OpenStockPicker(sceneId); return; }
  setStatus7('🔎 Đang tìm video stock cho cảnh ' + sceneId + '…', 'working');
  const r = await t2FetchStockOne(sceneId, '');
  if (r.err){ setStatus7('⚠️ ' + r.err, 'error'); return; }
  // LUÔN truyền note để bảng chọn mở ra kể cả khi tìm rỗng (không thì nó im lặng thoát ở Dựng Video).
  t2OpenStockPicker(sceneId, r.added ? `✓ Tìm được ${r.added} ứng viên · từ khoá: "${r.kw}"` : `Không tìm được ứng viên cho "${r.kw || ''}" — gõ từ khoá khác rồi bấm 🔎 Tìm thêm.`, '');
  setStatus7(r.added ? '✓ Tìm xong — chọn clip trong bảng.' : 'Chưa có ứng viên — thử từ khoá khác trong bảng.', r.added ? 'ok' : 'info');
}

async function t7YtSearchMore(sceneId){
  if (!window.native || typeof window.native.smartClip !== 'function'){ setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const kw = (document.getElementById('t7YtKw')?.value || '').trim();
  const sc = (state.scenes || []).find(x => x.id === sceneId);
  const btn = document.getElementById('t7YtMoreBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tìm…'; }
  let note = '';
  try {
    const hint = (state.scenePrompts && state.scenePrompts[sceneId]) || '';
    const r = await window.native.smartClip({ keyword: kw, narration: (sc && sc.text) || '', hint, duration: 4, searchOnly: true });
    if (!r || !r.ok) throw new Error((r && r.error) || 'không tìm được');
    if (!state.ytCandidates) state.ytCandidates = {};
    const old = state.ytCandidates[sceneId] || [];
    const seen = new Set(old.map(c => c.url));
    const fresh = (r.candidates || []).filter(c => c.url && !seen.has(c.url));
    state.ytCandidates[sceneId] = old.concat(fresh).slice(0, _T2_STOCK_MAX);
    try { if (typeof saveState === 'function') saveState(true); } catch (e) {}
    note = fresh.length ? `✓ Thêm ${fresh.length} clip mới (tổng ${state.ytCandidates[sceneId].length}) · từ khoá: "${r.query || kw}"`
                        : `Không có clip MỚI cho "${r.query || kw}" — thử từ khoá khác.`;
  } catch (e){ note = '⚠️ ' + String(e.message || e).slice(0, 90); }
  t7OpenYtPicker(sceneId, note, kw);
}

function t7OpenYtPicker(sceneId, note, kwKeep){
  const cands = (state.ytCandidates && state.ytCandidates[sceneId]) || [];
  if (!cands.length && !note){ setStatus7('Chưa có ứng viên — bấm "Clip YouTube" tìm cho cảnh này trước.', 'info'); return; }
  const rows = cands.map((c, i) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:0.5px solid var(--border)">
      <img src="${c.thumbnail || ''}" onerror="this.style.visibility='hidden'" style="width:120px;height:68px;object-fit:cover;border-radius:6px;background:#0003;flex:0 0 auto">
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;line-height:1.35;max-height:35px;overflow:hidden">${escapeHtml(c.title || '(không tên)')}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${c.durationSec ? Math.round(c.durationSec) + 's · ' : ''}${escapeHtml(c.source || 'youtube')}</div></div>
      <button class="btn sm primary" style="flex:0 0 auto" onclick="t7PickYt('${sceneId}',${i})">Chọn</button></div>`).join('');
  const old = document.getElementById('t7YtPickerOv'); if (old) old.remove();   // mở lại sau khi Tìm thêm
  const ov = document.createElement('div'); ov.id = 't7YtPickerOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:640px;width:92%;max-height:82vh;overflow:auto;padding:14px;box-shadow:0 24px 70px -18px rgba(0,0,0,.6)" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Chọn clip YouTube — cảnh ${escapeHtml(String(sceneId))}</b>
      <button class="btn ghost sm" onclick="document.getElementById('t7YtPickerOv').remove()">✕</button></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <input id="t7YtKw" type="text" value="${escapeHtml(kwKeep || '')}" placeholder="Từ khoá tiếng Anh (bỏ trống = AI tự suy từ lời đọc)" style="flex:1;min-width:220px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 11px;font-size:12.5px" onkeydown="if(event.key==='Enter')t7YtSearchMore('${sceneId}')">
        <button id="t7YtMoreBtn" class="btn ghost sm" style="border-color:#e23d4c;color:#e23d4c" onclick="t7YtSearchMore('${sceneId}')">🔎 Tìm thêm</button>
        <span style="font-size:11.5px;color:var(--text-dim)">${cands.length} clip</span>
      </div>
      ${note ? `<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">${escapeHtml(note)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Bấm Chọn = tải + cắt đúng thời lượng cảnh (~40-60s/clip).</div>
      ${rows || '<span style="font-size:12px;color:var(--text-dim)">Chưa có clip nào — gõ từ khoá rồi bấm 🔎 Tìm thêm.</span>'}</div>`;
  document.body.appendChild(ov);
}

async function t7PickYt(sceneId, idx){
  const cands = (state.ytCandidates && state.ytCandidates[sceneId]) || []; const cand = cands[idx]; if (!cand || !cand.url) return;
  const ov = document.getElementById('t7YtPickerOv'); if (ov) ov.remove();
  const c = t7State.clips.find(x => x.sceneId === sceneId); if (!c){ setStatus7('Không thấy clip của cảnh.', 'error'); return; }
  setStatus7('⏳ Tải clip đã chọn (cắt đúng thời lượng)…', 'working');
  const r = await _t7DoSmartClip(c, { pickUrl: cand.url, vision: false });
  if (r && r.ok){ if (typeof _t7PersistClips === 'function') _t7PersistClips(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); if (typeof t7RenderDetail === 'function') t7RenderDetail(); if (!t7State.playing) t7RenderPreview(); setStatus7('✓ Đã đổi clip cho cảnh ' + sceneId + '.', 'ok'); }
  else setStatus7('Lỗi tải clip đã chọn: ' + ((r && r.error) || ''), 'error');
}

function t7AiClose(){ const m = document.getElementById('t7Ai'); if (m) m.classList.remove('on');
  try { t7AiPvStop(); _t7AiTryClear(); } catch (e) {} }

function t7AiDecide(i, ok){
  const q = _t7AiQ[i]; if (!q || q.state) return;
  q.state = ok ? 'ap' : 'sk';
  if (ok) _t7AiApply(q);
  // Thẻ đã duyệt gập thành một dòng → vẽ lại cả danh sách thay vì vá DOM tại chỗ.
  if (!_t7AiBulk) _t7AiRender();
  _t7AiTryClear(); t7AiPvStop();
  _t7AiTally();
  if (!_t7AiBulk) _t7AiSave();                     // bỏ qua cũng phải nhớ, không thì mở lại hỏi lại từ đầu
  if (ok){
    _t7OvKey = '';
    if (q.kind === 'tr'){ try { t7RenderSceneList(); } catch (e) {} }
    try { t7RenderTimeline(); } catch (e) {}
    if (!t7State.playing) try { t7RenderPreview(); } catch (e) {}
  }
}

function t7AiAll(ok){
  _t7AiBulk = true;
  try { _t7AiQ.forEach((q, i) => { if (!q.state) t7AiDecide(i, ok); }); }
  finally { _t7AiBulk = false; }
  _t7AiRender();
  _t7AiSave();
}

function t7AiPvMode(i, mode, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  t7AiPvStop();
  box.dataset.mode = mode;
  box.querySelectorAll('.ab button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  _t7AiPvDraw(i, mode === 'truoc');
}

function t7AiPvStop(){
  if (_t7AiPlay){ clearInterval(_t7AiPlay.timer);
    const b = document.querySelector('#t7AiProps .prev[data-i="' + _t7AiPlay.i + '"] .play');
    if (b){ b.classList.remove('on'); b.textContent = '▶ Xem chuyển động'; }
    _t7AiPlay = null; }
}

async function t7AiPvPlay(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const dangChay = _t7AiPlay && _t7AiPlay.i === i;
  t7AiPvStop();
  if (dangChay) return;                          // bấm lần hai = dừng
  const q = _t7AiQ[i]; if (!q) return;
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  const btn = box.querySelector('.play');
  if (btn){ btn.classList.add('on'); btn.textContent = '⏳ đang nạp…'; }
  // Nhịp vào của mẫu chỉ ~0,3s. Rải mẫu trên 2s thì gần hết khung rơi vào đoạn
  // đứng yên, nhìn ra như không động. Lấy dày trong 0,9s rồi GIỮ khung cuối một nhịp.
  const dur = _t7AiDur(q), het = Math.min(dur, 0.9), N = 12;
  const khung = [];
  for (let k = 0; k < N; k++) khung.push(await _t7AiPvHtml(q, (het * k) / (N - 1)));
  for (let k = 0; k < 5; k++) khung.push(khung[N - 1]);      // giữ khung cuối cho đỡ giật
  if (!box.isConnected) return;
  if (btn){ btn.textContent = '⏸ Dừng'; }
  box.dataset.mode = 'sau';
  box.querySelectorAll('.ab button').forEach(b => b.classList.toggle('on', b.dataset.m === 'sau'));
  const pv = box.querySelector('.pv');
  const TONG = khung.length;
  let k = 0;
  const timer = setInterval(() => {
    if (!box.isConnected){ clearInterval(timer); return; }
    pv.innerHTML = khung[k % TONG]; k++;
  }, Math.max(70, Math.round((het * 1000) / N)));
  _t7AiPlay = { i, timer };
}

function t7AiTry(i){
  const q = _t7AiQ[i]; if (!q) return;
  const c = _t7AiClip(q); if (!c){ setStatus7('Cảnh này không còn trong timeline.', 'info'); return; }
  document.querySelectorAll('#t7AiProps .prev').forEach(e => e.classList.remove('sel'));
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (box) box.classList.add('sel');
  _t7AiTry = { sceneId: q.sceneId, spec: _t7AiSpecOf(q, _t7AiDur(q)) };
  let t0 = 0; for (const x of t7State.clips){ if (x.id === c.id) break; t0 += _t7ClipDur(x); }
  if (t7State.playing) t7Pause();
  // t7SelectClip snap playhead về ĐẦU cảnh → phải đặt giây SAU nó. Đặt trước thì
  // khung lớn vẽ ở giây 0, lúc đồ hoạ còn chưa hiện, nhìn ra như không có gì.
  try { t7SelectClip(c.id); } catch (e) {}
  t7State.playT = t0 + Math.min(_t7AiTStill(_t7AiDur(q)), _t7ClipDur(c) - 0.05);
  t7State._t0 = performance.now() - t7State.playT * 1000;
  _t7OvKey = '';                                  // ép _t7DrawGfx vẽ lại
  try { t7UpdatePlayhead(); } catch (e) {}
  try { t7RenderPreview(); } catch (e) {}
  // _t7DrawGfx bỏ qua lời gọi mới khi đang bận (_t7OvBusy), mà nó lại đặt _t7OvKey
  // SAU khi await xong — cú vẽ của cảnh cũ về muộn là ghi đè mất lớp vừa vẽ.
  // Đợi nó rảnh hẳn rồi vẽ lại, không thì bấm thẻ mà khung lớn trơ ra.
  setTimeout(async () => {
    for (let k = 0; k < 15 && _t7OvBusy; k++) await new Promise(r => setTimeout(r, 60));
    if (!_t7AiTry) return;
    _t7OvKey = ''; try { await _t7DrawGfx(); } catch (e) {}
  }, 60);
}

function t7AiCustomSet(i, j, key, val){
  const q = _t7AiQ[i]; const L = q && q.custom && q.custom[j]; if (!L) return;
  if (!q._goc) q._goc = JSON.parse(JSON.stringify(q.custom));
  if (['x', 'y', 'w', 'h'].includes(key)) { L.box = L.box || {}; L.box[key] = parseFloat(val) || 0; }
  else if (key === 'align') { L.box = L.box || {}; L.box.align = val; }
  else if (key === 'size') { L.style = L.style || {}; L.style.size = parseFloat(val) || 54; }
  else if (key === 'color' || key === 'fill') { L.style = L.style || {}; L.style[key] = val; }
  else if (key === 'in' || key === 'hold') { L[key] = Object.assign({}, L[key], { preset: val }); }
  else L[key] = val;
  // Kẹp lại y như lúc nhận từ AI — sửa tay cũng không cho chữ chạy ra ngoài khung.
  q.custom = _t7AiFixLayers(q.custom, _t7AiDur(q));
  _t7AiEditVeLai(i, q);
}

function t7AiEditToggle(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const card = document.querySelector('#t7AiProps .pr[data-i="' + i + '"]'); if (!card) return;
  let box = card.querySelector('.edit');
  const nut = card.querySelector('.edbtn');
  if (box){ box.remove(); if (nut) nut.classList.remove('on'); return; }
  box = document.createElement('div');
  box.className = 'edit';
  box.onclick = (e) => e.stopPropagation();
  box.innerHTML = _t7AiEditHtml(_t7AiQ[i], i, _t7Cat) +
    `<button class="edreset" onclick="t7AiEditReset(${i},event)">↺ Về như AI đề xuất</button>`;
  card.querySelector('.prb').appendChild(box);
  if (nut) nut.classList.add('on');
}

function t7AiEditSet(i, j, key, val){
  const q = _t7AiQ[i]; if (!q || !q.picks[j]) return;
  if (!q._goc) q._goc = JSON.parse(JSON.stringify(q.picks));    // giữ bản AI đề xuất để hoàn nguyên
  const f = _t7AiFields(_t7Cat, q.picks[j].template).find(x => x.key === key);
  q.picks[j][key] = (f && f.kind === 'so') ? (parseFloat(val) || 0) : val;
  // Vẽ lại ô xem trước: xoá cache của CẢNH này rồi dựng lại. Gõ phím nào cũng gọi
  // engine thì giật, nên gom lại 220ms.
  clearTimeout(_t7AiEditT);
  _t7AiEditT = setTimeout(() => {
    for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
    t7AiPvStop();
    _t7AiPvDraw(i, false);
    if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){          // đang xem trên khung lớn thì cập nhật luôn
      _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q));
      _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {}
    }
    _t7AiSave();
  }, 220);
}

function t7AiEditReset(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const q = _t7AiQ[i]; if (!q || !q._goc) return;
  if (q.custom && q.custom.length) q.custom = JSON.parse(JSON.stringify(q._goc));
  else q.picks = JSON.parse(JSON.stringify(q._goc));
  for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
  const card = document.querySelector('#t7AiProps .pr[data-i="' + i + '"]');
  const box = card && card.querySelector('.edit');
  if (box) box.innerHTML = _t7AiEditHtml(q, i, _t7Cat) + `<button class="edreset" onclick="t7AiEditReset(${i},event)">↺ Về như AI đề xuất</button>`;
  _t7AiPvDraw(i, false);
  if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){ _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q)); _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {} }
  _t7AiSave();
}

function t7CloseInsp(){ const i = document.querySelector('#tool-tool7 .t7-inspector'); if (i) i.classList.remove('open'); }

function t7OpenInsp(){ const i = document.querySelector('#tool-tool7 .t7-inspector'); if (i) i.classList.add('open'); }

function t7SceneToggle(id){
  _t7Open = (_t7Open === id) ? null : id;
  if (_t7Open) t7SelectClip(id);
  t7RenderSceneList();
}

async function t7KhopLoi(clipId){
  const c = (t7State.clips || []).find(x => x.id === clipId);
  if (!c) return;
  const sid = c.sceneId;
  const s = _t7ClipScene(c);
  const loi = (s && s.text || '').trim();
  const src = c.srcUrl || (state.mediaPicks && state.mediaPicks[sid] && (state.mediaPicks[sid].trangUrl || state.mediaPicks[sid].downloadUrl)) || '';
  if (!src) return _t7SetNote(sid, 'Cảnh này chưa có video nguồn — tìm clip trước đã.', 'error');
  if (!loi) return _t7SetNote(sid, 'Cảnh này không có lời thoại để khớp.', 'error');
  if (!window.native || typeof window.native.khopLoi !== 'function') return _t7SetNote(sid, 'Chỉ chạy trong app Nova.', 'error');

  _t7SetNote(sid, '🎯 Đang khớp lời… (tải tiếng có thể lâu)', 'working');
  try {
    const r = await window.native.khopLoi({ url: src, narration: loi, duration: parseFloat(_t7ClipDur(c)) || 4 });
    if (!r || !r.ok) return _t7SetNote(sid, '⚠️ ' + ((r && r.error) || 'không khớp được'), 'error');
    _t7SetNote(sid, `✂ Khớp tại ${r.startSec}s (${r.nguon}) — đang cắt lại…`, 'working');
    // Cắt lại đúng nguồn cũ, chỉ đổi điểm bắt đầu.
    const kq = await _t7DoSmartClip(c, { pickUrl: src, startSec: r.startSec });
    if (!kq || !kq.ok) return _t7SetNote(sid, '⚠️ Cắt lại lỗi: ' + ((kq && kq.error) || ''), 'error');
    _t7SetNote(sid, `✓ Đã cắt tại ${r.startSec}s · khớp: "${(r.doanText || '').slice(0, 60)}"`, 'ok');
  } catch (e){
    _t7SetNote(sid, '⚠️ Lỗi: ' + String((e && e.message) || e).slice(0, 90), 'error');
  }
}

async function t7SrcYt(clipId, sceneId){
  const has = ((state.ytCandidates || {})[sceneId] || []).length;
  if (has){ _t7SetNote(sceneId, `Đã có ${has} clip — chọn ngay trong dải bên phải.`, 'info'); return; }
  _t7SetNote(sceneId, '🔎 Đang tìm clip YouTube…', 'working');
  try { await t7SmartClipScene(clipId); }
  catch (e) { return _t7SetNote(sceneId, '⚠️ Lỗi tìm: ' + String(e && e.message || e).slice(0, 90), 'error'); }
  const n = ((state.ytCandidates || {})[sceneId] || []).length;
  _t7SetNote(sceneId, n ? `✓ Tìm được ${n} clip.` : 'Không tìm được clip nào — thử Tìm thêm để gõ từ khoá khác.', n ? 'ok' : 'info');
}

async function t7SrcStock(sceneId){
  const has = ((state.stockCandidates || {})[sceneId] || []).length;
  if (has){ _t7SetNote(sceneId, `Đã có ${has} clip stock — chọn ngay trong dải.`, 'info'); return; }
  _t7SetNote(sceneId, '🔎 Đang tìm video stock…', 'working');
  let r;
  try { r = await t2FetchStockOne(sceneId, ''); }
  catch (e) { return _t7SetNote(sceneId, '⚠️ Lỗi tìm: ' + String(e && e.message || e).slice(0, 90), 'error'); }
  if (r.err) return _t7SetNote(sceneId, '⚠️ ' + r.err, 'error');
  _t7SetNote(sceneId, r.added ? `✓ Tìm được ${r.added} clip · từ khoá "${r.kw}"`
    : `Không tìm được clip cho "${r.kw || ''}" — bấm Tìm thêm để gõ từ khoá khác.`, r.added ? 'ok' : 'info');
}

function t7SrcTab(sceneId, tab){
  _t7SrcTab[sceneId] = tab;
  t7RenderSceneList();
}

async function t7CandHover(url, el){
  t7CandLeave();                                       // dừng ô đang chạy
  if (!url) return;
  const im = el.querySelector('.im'); if (!im) return;
  const orig = im.style.backgroundImage, ow = im.style.backgroundSize, op = im.style.backgroundPosition;
  const restore = () => { im.style.backgroundImage = orig; im.style.backgroundSize = ow; im.style.backgroundPosition = op; };
  im._restore = restore;
  const token = {};                                    // để biết lượt rê này còn hiệu lực
  _t7SbTimer = { id: 0, im, token };

  const showFlat = (u) => { im.style.backgroundImage = `url('${u}')`; im.style.backgroundSize = 'cover'; im.style.backgroundPosition = 'center'; };
  const showCell = (c) => { im.style.backgroundImage = `url('${c.url}')`; im.style.backgroundSize = c.sw + 'px ' + c.sh + 'px'; im.style.backgroundPosition = `-${c.x}px -${c.y}px`; };
  const live = () => _t7SbTimer && _t7SbTimer.token === token;
  const swap = (fn) => { if (!live()) return; clearInterval(_t7SbTimer.id); _t7SbTimer.id = setInterval(fn, 420); fn(); };

  // ── bước 1: ảnh tĩnh, hiện gần như tức thì
  const id = _t7YtId(url);
  if (id) _t7QuickFrames(id).then(fr => {
    if (!live() || !fr.length || _t7SbTimer._hasSb) return;
    let k = 0;
    swap(() => showFlat(fr[k++ % fr.length]));
  });

  // ── bước 2: storyboard thật (14 mốc), nếu kịp
  if (!window.native || typeof window.native.probeVideo !== 'function') return;
  let sb = _t7SbCache[url];
  if (sb === undefined){
    im.classList.add('loading');
    try { const r = await window.native.probeVideo(url); sb = _t7SbCache[url] = (r && r.ok && r.sb) ? r.sb : null; }
    catch (e) { sb = _t7SbCache[url] = null; }
    im.classList.remove('loading');
  }
  if (!live() || !sb || !sb.frags || !sb.frags.length) return;
  _t7SbTimer._hasSb = 1;
  const total = sb.frags.reduce((a, f) => a + (f.dur || 0), 0) || 1;
  const N = 14;                                        // 14 mốc rải đều — đủ thấy clip có gì
  let k = 0;
  swap(() => { const c = _t7SbCell(sb, total * ((k++ % N) + 0.5) / N); if (c) showCell(c); });
}

function t7CandLeave(){
  if (!_t7SbTimer) return;
  if (_t7SbTimer.id) clearInterval(_t7SbTimer.id);
  try { if (_t7SbTimer.im && _t7SbTimer.im._restore) _t7SbTimer.im._restore(); } catch (e) {}
  _t7SbTimer = null;
}

function t7RenderSceneList(){
  const box = document.getElementById('t7Rows'); if (!box) return;
  const _keepScroll = box.scrollTop;                  // dựng lại KHÔNG được vọt về đầu danh sách
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ box.innerHTML = '<div class="t7-empty">Chưa có cảnh. Sang tab Phân Cảnh để chia cảnh trước.</div>'; return; }
  box.innerHTML = clips.map(c => {
    const sc = _t7ClipScene(c), img = _t7ThumbImg(c);
    const line = String((sc && sc.text) || '').trim().replace(/\s+/g, ' ');
    const has = !!img || _t7UsesVideo(c);
    const open = _t7Open === c.id;
    return `<div class="t7-sc${open ? ' open' : ''}">
      <button class="t7-lrow${open ? ' on' : ''}" onclick="t7SceneToggle('${c.id}')">
        <span class="th"${img ? ` style="background-image:url('${img}')"` : ''}><b>${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s</b></span>
        <span class="tx"><b>${escapeHtml(_t7ClipLabel(c))}</b><s>${escapeHtml(line ? line.slice(0, 60) : '— chưa có lời thoại —')}</s></span>
        <span class="dot" style="background:${has ? 'var(--green)' : 'var(--text-dim)'}"></span>
      </button>
      ${open ? _t7SceneBody(c) : ''}
    </div>`;
  }).join('');
  box.scrollTop = _keepScroll;
  // Dải clip cuộn ngang, 24 thẻ — thẻ đang dùng rất dễ nằm ngoài tầm nhìn.
  // Kéo nó vào giữa để mở cảnh ra là thấy ngay đang chạy clip nào.
  try {
    const on = box.querySelector('.t7-sc.open .t7-cd[data-on="1"]');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  } catch (e) {}
}
