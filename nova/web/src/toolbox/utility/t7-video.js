/* T7 — Quản lý VIDEO của profile: new/switch/rename/delete video, video select, video manager, clearAllT3/T5
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _renumberVideos(p){
  if (!p || !Array.isArray(p.videos)) return;
  let n = 0;
  for (const v of p.videos){ n++; if (/^Video \d+$/.test(String(v.name || ''))) v.name = 'Video ' + n; }
}

async function newVideo(){
  const p = getProfile();
  if (!p){ newProfile(); return; }
  _ensureVideos(p);
  // Lưu video hiện tại trước (workData + ảnh IDB).
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}
  // Thêm video mới + chuyển sang. Đặt tên theo vị trí rồi renumber → số thứ tự luôn 1,2,3… (xoá xong về đúng số).
  const v = makeEmptyVideo('Video ' + ((p.videos || []).length + 1));
  p.videos.push(v);
  _renumberVideos(p);
  p.currentVideoId = v.id;
  loadStateFromProfile(p);                 // workData rỗng của video mới
  // Nhân vật/bối cảnh + ảnh của chúng dùng CHUNG profile → giữ; cảnh/ảnh cảnh/video rỗng.
  try { await loadProfileImages(p.profileId, v.id); } catch (e) {}
  // Reset dữ liệu tạm Tool 7/8.
  try { if (typeof t7State === 'object' && t7State) { t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.audioFile = null; t7State.audioPeaks = null; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  try { if (typeof t8State === 'object' && t8State) { t8State.audioFile = null; t8State.alignResults = null; } } catch (e) {}
  try { _t2ResetTimingAudio(); } catch (e) {}   // xoá MP3 căn timing của video cũ
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
  if (typeof setStatus1 === 'function') setStatus1('✓ Đã tạo "' + v.name + '" — trắng tinh, dùng chung style + nhân vật/bối cảnh của kênh. Bắt đầu ở Phân Cảnh.', 'ok');
}

async function switchVideo(id){
  const p = getProfile();
  if (!p || !id) return;
  _ensureVideos(p);
  if (id === p.currentVideoId) return;
  syncStateToCurrentProfile();
  try { await saveState(true); } catch (e) {}   // lưu ảnh video hiện tại theo id cũ
  p.currentVideoId = id;
  // 🧹 Reset dữ liệu TẠM Dựng Video (overlay/media/clip/undo/nhạc nền) → KHÔNG rò rỉ sang video khác; workData video mới sẽ nạp lại.
  try { if (typeof t7State === 'object' && t7State){ t7State.images = []; t7State.clips = []; t7State.past = []; t7State.future = []; t7State.selClip = null; t7State.overlays = []; t7State.selOverlay = null; t7State.media = []; t7State.mediaTab = 'scenes'; t7State.playT = 0; t7State.bgmFile = null; t7State.bgmPeaks = null; } } catch (e) {}
  await mergeLocalWorkData(p, id);   // nạp kịch bản/cảnh local (IDB) của video mới trước khi đổ ra state
  loadStateFromProfile(p);
  try { await loadProfileImages(p.profileId, id); } catch (e) {}   // loadProfileImages tự nạp/xoá MP3 giọng đọc riêng của video này
  rerenderAllAfterProfileLoad();
  renderVideoSelect();
  saveState(true);
}

async function renameVideo(){
  const p = getProfile(); if (!p) return;
  const v = getCurrentVideo(p); if (!v) return;
  const name = await _askText('Đổi tên video', v.name || 'Video');
  if (name == null) return;
  v.name = (name.trim() || v.name);
  renderVideoSelect();
  saveState(true);
}

function renderVideoSelect(){
  const sel = document.getElementById('videoSelect');
  if (!sel) return;
  const p = getProfile();
  if (!p){ sel.innerHTML = '<option>—</option>'; sel.disabled = true; return; }
  _ensureVideos(p);
  sel.disabled = false;
  sel.innerHTML = p.videos.map(v => `<option value="${v.id}" ${v.id === p.currentVideoId ? 'selected' : ''}>🎬 ${escapeHtml(v.name || 'Video')}</option>`).join('');
}

function openVideoManager(){
  const p = getProfile(); if (!p){ alert('Chưa có profile.'); return; }
  _ensureVideos(p);
  closeVideoManager();
  const ov = document.createElement('div');
  ov.id = 'videoMgrModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
  const rows = p.videos.map(v => {
    const wd = v.workData || {};
    const thumb = wd.thumbUrl
      ? `<img src="${wd.thumbUrl}" style="width:54px;height:31px;object-fit:cover;border-radius:5px;border:1px solid var(--border);flex:none">`
      : `<span style="width:54px;height:31px;border-radius:5px;background:var(--surface-3);display:grid;place-items:center;flex:none;font-size:14px">🎬</span>`;
    const path = wd.exportPath ? `<div style="font-size:10.5px;color:var(--text-dim);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(wd.exportPath)}">📄 ${escapeHtml(wd.exportPath)}</div>` : '';
    return `<div style="display:flex;align-items:center;gap:11px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:${v.id === p.currentVideoId ? 'var(--surface-2)' : 'transparent'}">
      <input type="checkbox" class="_vmChk" value="${v.id}" style="width:16px;height:16px;flex:none">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(v.name || 'Video')}${v.id === p.currentVideoId ? ' <span style="color:var(--accent);font-size:11px;font-weight:700">• đang mở</span>' : ''}</div>
        ${path}
      </div>
      <button class="btn ghost sm" onclick="switchVideo('${v.id}');closeVideoManager()">Mở</button>
    </div>`;
  }).join('');
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;width:min(520px,94vw);max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:17px;font-weight:800">Quản lý Video — ${escapeHtml(p.tenKenh || 'Kênh')}</div>
      <button class="btn ghost sm" onclick="closeVideoManager()">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px">
      <label style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px"><input type="checkbox" id="_vmAll" onclick="document.querySelectorAll('._vmChk').forEach(c=>c.checked=this.checked)" style="width:15px;height:15px"> Chọn tất cả</label>
      <button class="btn" style="border-color:var(--red);color:var(--red)" onclick="deleteSelectedVideos()">🗑 Xóa video đã chọn</button>
    </div>
  </div>`;
  ov.onclick = (e) => { if (e.target === ov) closeVideoManager(); };
  document.body.appendChild(ov);
}

function closeVideoManager(){ const m = document.getElementById('videoMgrModal'); if (m) m.remove(); }

async function deleteSelectedVideos(){
  const p = getProfile(); if (!p) return; _ensureVideos(p);
  const ids = [...document.querySelectorAll('._vmChk:checked')].map(c => c.value);
  if (!ids.length){ alert('Chưa tích video nào để xóa.'); return; }
  if (ids.length >= p.videos.length){ alert('Không thể xóa hết — profile phải còn ít nhất 1 video.'); return; }
  if (!confirm('Xóa ' + ids.length + ' video đã chọn?\nKịch bản/cảnh/ảnh/video của chúng sẽ mất. Style + thông tin kênh vẫn giữ.')) return;
  const uid = window.currentUser?.uid;
  for (const id of ids){
    if (uid && p.profileId){ const b = uid + '/' + p.profileId + '/' + id + '/'; for (const k of ['styleRefImages','characterImages','backgroundImages','sceneImages','sceneImagesB','sceneVideoBlobs','sceneVideosMeta','motionPrompts','voiceMp3']){ try { await IDB.set(b + k, null); } catch (e) {} } }
  }
  const del = new Set(ids);
  const curDeleted = del.has(p.currentVideoId);
  p.videos = p.videos.filter(v => !del.has(v.id));
  // Đồng bộ hàng đợi: bỏ các job trỏ tới video vừa xoá.
  try {
    if (typeof _prodQueue !== 'undefined' && _prodQueue.length) {
      const before = _prodQueue.length;
      _prodQueue.forEach(j => { if (del.has(j.videoId)) { try { IDB.del('qs_' + j.id); } catch (e) {} if (typeof _queueVoice === 'object') delete _queueVoice[j.id]; } });
      _prodQueue = _prodQueue.filter(j => !del.has(j.videoId));
      if (_prodQueue.length !== before) { if (typeof queueSave === 'function') queueSave(); if (typeof queueRender === 'function') queueRender(); }
    }
  } catch (e) {}
  if (curDeleted){
    p.currentVideoId = p.videos[0].id;
    loadStateFromProfile(p);
    try { await loadProfileImages(p.profileId, p.currentVideoId); } catch (e) {}
    rerenderAllAfterProfileLoad();
  }
  renderVideoSelect(); renderProfileStyles(); closeVideoManager();
  saveState(true);
}

function clearAllT3(){
  if (!confirm('Xoá HẾT prompt asset của profile hiện tại (nhân vật + bối cảnh + style reference + ảnh nhân vật)?\n\nStyle Prompts (Character Style, Background Style...) KHÔNG bị xoá — chúng là của Profile.')) return;
  state.assetCharPrompts = {};
  state.assetBgPrompts = {};
  state.styleRefPrompt = '';
  state.characterImages = {};
  syncStateToCurrentProfile();
  rerenderAllAfterProfileLoad();
  saveState(true);
  setStatus3('✓ Đã xoá hết prompt asset + ảnh ref của profile hiện tại.', 'ok');
}

function clearAllT5(){
  if (!confirm('Xoá HẾT kết quả tìm media + lựa chọn của profile hiện tại?')) return;
  state.pexelsResults = {};
  state.mediaPicks = {};
  _t5Results = {};
  document.querySelectorAll('[id^="media-results-"]').forEach(el => el.innerHTML = '');
  const sp = document.getElementById('searchProgress'); if (sp) sp.textContent = '';
  updatePickCount();
  syncStateToCurrentProfile();
  saveState(true);
  setStatus5('✓ Đã xoá hết kết quả tìm media + lựa chọn của profile hiện tại.', 'ok');
}
