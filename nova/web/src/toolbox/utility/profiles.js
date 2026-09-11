/* PROFILES — cloud state (saveState), profile CRUD, style preset & style images
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function loadCloudState(){
  if (!window.currentUser || !window.firebaseLoadDoc) return;
  const uid = window.currentUser.uid;
  try {
    // 1. Load state nhẹ từ Firestore
    const data = await window.firebaseLoadDoc(uid);
    if (data && data.state) {
      Object.assign(state, data.state);
      console.log('✓ Loaded state from Firestore');
    }
    // 1b. Load tier + hạn dùng (proUntil). Hết hạn → tự về free.
    state.userTier = (data && data.tier) || 'free';
    state.proUntil = (data && data.proUntil) || null;
    if ((state.userTier === 'pro' || state.userTier === 'max') && state.proUntil && Date.now() > state.proUntil) {
      state.userTier = 'free';
      console.log('⏰ Pro đã hết hạn → về Free.');
    }
    console.log('✓ User tier:', state.userTier);
    // Backfill email vào doc để trang admin thấy được (chỉ ghi khi thiếu/khác).
    if (window.currentUser?.email && data?.email !== window.currentUser.email && window.firebaseSaveDoc) {
      window.firebaseSaveDoc(window.currentUser.uid, { email: window.currentUser.email }).catch(() => {});
    }
    // 1c. Migration: ensure all profiles have profileId + workData; migrate global state nếu cần
    if (typeof migrateProfiles === 'function' && state.profiles?.length) {
      const migrated = migrateProfiles();
      if (migrated) saveCloudState(true);
    }
    // 1d. Load current profile's workData → state (pull data từ profile vào state)
    const curP = getProfile();
    if (curP) {
      await mergeLocalWorkData(curP);   // nạp kịch bản/cảnh local (IDB) đè bản cloud có thể lưu hụt (doc >1MB)
      loadStateFromProfile(curP);
      // One-time: bản cũ mặc định "Xen video Veo" = Vừa(6); nay mặc định TẮT → đưa các video còn kẹt giá trị cũ (6) về 0. Chạy SAU khi đã merge/nạp để bắt giá trị cuối; 1 lần; KHÔNG đụng lựa chọn khác (8/10/…).
      try {
        if (!localStorage.getItem('vmDefaultOff2')) {
          (state.profiles || []).forEach(p => (p.videos || []).forEach(v => { if (v.workData && v.workData.videoMix === 6) v.workData.videoMix = 0; }));
          if (state.videoMix === 6) { state.videoMix = 0; const vmEl = document.getElementById('t2VideoMix'); if (vmEl) vmEl.value = '0'; }
          localStorage.setItem('vmDefaultOff2', '1');
          saveCloudState(true);   // ghi 0 xuống IDB/cloud để giữ luôn
        }
      } catch (e) {}
      // 2. Load ảnh (asset chung profile + cảnh riêng video) từ IndexedDB
      try {
        await loadProfileImages(curP.profileId, _curVideoId(curP));
        console.log('✓ Loaded images from IndexedDB for profile:', curP.profileId);
      } catch (e) {
        console.warn('IDB load failed:', e);
      }
    } else {
      // Không có profile → state rỗng
      loadStateFromProfile(null);
    }
    // 3. Render tier-dependent UI
    renderTierBadge();
    if (typeof initAdminUI === 'function') initAdminUI();
  } catch (e) {
    console.warn('Cloud load failed:', e);
  }
}

function _lightWorkData(wd){ if (!wd || typeof wd !== 'object') return {}; const o = {}; for (const k of _WD_LIGHT_KEYS) if (wd[k] !== undefined) o[k] = wd[k]; return o; }

async function saveCloudState(immediate = false, skipImages = false){
  if (!window.currentUser || !window.firebaseSaveDoc) return;
  clearTimeout(_saveTimer);
  const doSave = async () => {
    const uid = window.currentUser.uid;
    setSyncStatus('💾 Đang lưu...', 'working');
    // Sync state.{...} → current profile's workData trước khi save
    if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile();
    // Tách ảnh + working data ra khỏi state root (Firestore giới hạn 1MB/doc; userTier là admin-controlled).
    const { styleRefImages, characterImages, sceneImages, sceneImagesB, backgroundImages, userTier,
            script, scenes, scenePrompts, charactersV, backgroundsV,
            assetCharPrompts, assetBgPrompts, styleRefPrompt, veoPrompts, pexelsResults, mediaPicks, ytCandidates,
            sceneVideos, motionPrompts,
            ...lightState } = state;
    const curP = getProfile();
    const pid = curP?.profileId;
    const vid = curP ? _curVideoId(curP) : 'v_main';
    // ① LƯU LOCAL (IndexedDB) TRƯỚC — quan trọng nhất. Cloud lỗi (doc >1MB khi nhiều cảnh) KHÔNG được làm mất dữ liệu máy.
    try {
      if (pid) {
        const b = uid + '/' + pid + '/' + vid + '/';
        // workData (kịch bản/cảnh/prompt) LUÔN lưu, kể cả light save → sống qua restart, không dính giới hạn 1MB Firestore.
        try { const _cv = getCurrentVideo(curP); if (_cv && _cv.workData) await IDB.set(b + 'workData', _cv.workData); } catch (e) { console.warn('IDB workData save failed:', e); }
        if (!skipImages) {
          // Mỗi VIDEO có bộ ảnh riêng (chỉ Style TEXT dùng chung — nằm trong profile object).
          await IDB.set(b + 'styleRefImages', styleRefImages || []);
          await IDB.set(b + 'characterImages', characterImages || {});
          await IDB.set(b + 'backgroundImages', backgroundImages || {});
          await IDB.set(b + 'sceneImages', sceneImages || {});
          await IDB.set(b + 'sceneImagesB', sceneImagesB || {});
          await IDB.set(b + 'sceneVideoBlobs', mvVideoBlobs || {});
          await IDB.set(b + 'sceneVideosMeta', sceneVideos || {});
          await IDB.set(b + 'motionPrompts', motionPrompts || {});
        }
      }
    } catch (e) { console.warn('IDB save failed:', e); try { setSyncStatus('⚠️ Lưu máy LỖI (ảnh/clip) — ' + String(e && e.message || e).slice(0, 60), 'error'); } catch (_) {} }
    // Lưu workData các video xuống IDB — CHỈ khi workData ĐẦY ĐỦ (có cảnh) HOẶC là video ĐANG MỞ.
    // ⛔ TUYỆT ĐỐI KHÔNG ghi bản NHẸ (từ cloud, video chưa mở) đè lên bản đầy đủ trong IDB → tránh mất dữ liệu video đã làm xong.
    try {
      for (const P of (state.profiles || [])){
        if (!P.profileId || !Array.isArray(P.videos)) continue;
        for (const v of P.videos){
          if (!v || !v.id || !v.workData) continue;
          const isCur = (P.profileId === pid && v.id === vid);
          const isFull = Array.isArray(v.workData.scenes) && v.workData.scenes.length > 0;   // CÓ cảnh = bản đầy đủ (bản nhẹ từ cloud KHÔNG có scenes)
          if (isCur || isFull) await IDB.set(uid + '/' + P.profileId + '/' + v.id + '/workData', v.workData);
          // else: bản NHẸ (video chưa mở phiên này, chỉ có script/metadata) → GIỮ NGUYÊN bản đầy đủ trong IDB, KHÔNG đè.
        }
      }
    } catch (e) { console.warn('IDB all-workData save failed:', e); try { setSyncStatus('⚠️ Lưu máy LỖI — dữ liệu có thể mất khi tải lại: ' + String(e && e.message || e).slice(0, 60), 'error'); } catch (_) {} }
    // ② Rồi lưu cloud (state nhẹ) — profiles đã CẮT workData nặng → doc nhỏ, không vượt 1MB → profile/metadata luôn lưu được.
    try {
      const cloudProfiles = (lightState.profiles || []).map(P => (P && Array.isArray(P.videos)) ? { ...P, videos: P.videos.map(v => ({ ...v, workData: _lightWorkData(v.workData) })) } : P);
      await window.firebaseSaveDoc(uid, {
        state: { ...lightState, profiles: cloudProfiles },
        email: window.currentUser?.email || null,   // để trang admin hiện email
        updatedAt: Date.now()
      });
      setSyncStatus('✓ Đã đồng bộ', 'ok');
    } catch (e) {
      console.warn('Cloud save failed:', e);
      // Local đã lưu → không mất gì; chỉ đồng bộ đám mây trượt (thường do storyboard nhiều cảnh > 1MB).
      if (e.code === 'invalid-argument' || /too large|maximum|exceeds|larger than/i.test(e.message || '')) setSyncStatus('✓ Đã lưu (máy) · cloud bỏ qua (quá lớn)', 'ok');
      else setSyncStatus('✓ Đã lưu (máy) · cloud lỗi', 'ok');
    }
  };
  if (immediate) {
    await doSave();
  } else {
    _saveTimer = setTimeout(doSave, 600);
  }
}

async function saveState(immediate, skipImages){ return saveCloudState(immediate, skipImages); }

function initAppDirect(){
  // Ẩn mọi mảng tài khoản/đăng nhập còn sót (phòng khi HTML cũ bị cache)
  ['userBoxAuth','userBoxGuest','authGate'].forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  var sec = document.querySelector('.user-section'); if (sec) sec.style.display = 'none';
  // Load API settings cục bộ để dùng tool ngay + dựng UI
  if (typeof loadApiSettings === 'function') { try { loadApiSettings(); } catch (e) {} }
  if (typeof _relocateUserBox === 'function') _relocateUserBox();
  // Gom API + Tài khoản Flow về Cài đặt NGAY TỪ BOOT (trước đây chỉ dời khi user mở tab
  // Cài đặt → tool "Tạo Ảnh Hàng Loạt" hiện khối tài khoản TRÙNG với Cài đặt, rồi lại
  // mất khối đó sau khi user từng vào Cài đặt — không nhất quán). Xem MEMORY.md 2026-09-11c.
  if (typeof _relocateSettings === 'function') _relocateSettings();
  if (typeof restoreUI === 'function') restoreUI();
  if (typeof renderTierBadge === 'function') renderTierBadge();
}

function getProfile(){ return state.currentProfileIdx >= 0 ? state.profiles[state.currentProfileIdx] : null; }

function makeEmptyProfile(){
  return {
    profileId: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    tenKenh: '', ngach: '',
    visualStyle: 'Crayon Capital — Dark',
    ngonNgu: 'Tiếng Việt',
    povStyle: 'Ngôi thứ 2 (Bạn)',
    cauTruc: 'Levels / Escalation / POV',
    soPhan: 8, targetPhut: 12,
    characterStyle: '', backgroundStyle: '', sceneStyle: '',
    charIdentity: '',
    promptRules: 'No text, no watermark, consistent character design, avoid gore',
    styleGuide: '', dnaKenh: '', chuDe: '',
    characters: [], backgrounds: [],
    workData: createEmptyWorkData()  // Per-profile working data
  };
}

function createEmptyWorkData(){
  return {
    script: '',
    scenes: [],
    scenePrompts: {},
    scenePrompts2: {},
    charactersV: [],
    backgroundsV: [],
    assetCharPrompts: {},
    assetBgPrompts: {},
    styleRefPrompt: '',
    veoPrompts: {},
    pexelsResults: {},
    mediaPicks: {},
    stockCandidates: {},
    ytCandidates: {},
    seo: null,            // gói SEO đã tạo (tiêu đề/mô tả/tags/chapters) — lưu THEO VIDEO
    seoTitle: '',         // tiêu đề đã chốt (dùng cho thumbnail)
    sceneTrans: {},
    wardrobe: {},
    descMode: 'tag',
    charBible: {},
    bgBible: {},
    t3Era: '',
    t3BgLayout: 'single',
    nguonBat: { veo: false, stock: false, yt: false, kho: false, web: false },
    webBat: null,          // null → dựng mặc định lần đầu chạm tới (chỉ nhóm tư liệu công)
    webCandidates: {},
    videoMix: 0,
    stockMix: 0,
    ytMix: 0,
    stockType: 'videos',
    videoLogline: '',
    brandProfile: null
  };
}

function makeEmptyVideo(name){
  return { id: 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || 'Video 1', createdAt: Date.now(), workData: createEmptyWorkData() };
}

function _ensureVideos(p){
  if (!p) return;
  if (!Array.isArray(p.videos) || !p.videos.length){
    p.videos = [{ id: 'v_main', name: 'Video 1', createdAt: p.createdAt || Date.now(), workData: p.workData || createEmptyWorkData() }];
    p.currentVideoId = 'v_main';
    try { delete p.workData; } catch (e) { p.workData = undefined; }   // tránh nhân đôi khi lưu
  }
  if (!p.currentVideoId || !p.videos.some(v => v.id === p.currentVideoId)) p.currentVideoId = p.videos[0].id;
}

function getCurrentVideo(p){ p = p || getProfile(); if (!p) return null; _ensureVideos(p); return p.videos.find(v => v.id === p.currentVideoId) || p.videos[0]; }

function _curVideoId(p){ const v = getCurrentVideo(p); return v ? v.id : 'v_main'; }

function syncStateToCurrentProfile(){
  const v = getCurrentVideo();
  if (!v) return;
  if (!v.workData) v.workData = createEmptyWorkData();
  const p = { workData: v.workData };   // ghi vào workData của video hiện tại
  p.workData.script = state.script || '';
  p.workData.scenes = state.scenes || [];
  p.workData.scenePrompts = state.scenePrompts || {};
  p.workData.scenePrompts2 = state.scenePrompts2 || {};
  p.workData.charactersV = state.charactersV || [];
  p.workData.backgroundsV = state.backgroundsV || [];
  p.workData.assetCharPrompts = state.assetCharPrompts || {};
  p.workData.assetBgPrompts = state.assetBgPrompts || {};
  p.workData.styleRefPrompt = state.styleRefPrompt || '';
  p.workData.veoPrompts = state.veoPrompts || {};
  p.workData.pexelsResults = state.pexelsResults || {};
  p.workData.mediaPicks = state.mediaPicks || {};
  p.workData.stockCandidates = state.stockCandidates || {};
  // Vứt mục giả "(chọn tay)" khỏi dự án luôn — không phải ứng viên, giữ chỉ tổ rác.
  try { const yc = state.ytCandidates || {};
    for (const k in yc) if (Array.isArray(yc[k])) yc[k] = yc[k].filter(x => x && x.url && x.title !== '(chọn tay)');
  } catch (e) {}
  p.workData.ytCandidates = state.ytCandidates || {};
  // SEO: lưu theo VIDEO để thoát app không mất (trước đây chỉ nằm trong biến tạm t9State)
  try { p.workData.seo = (typeof t9State === 'object' && t9State && t9State.result) ? t9State.result : (p.workData.seo || null); } catch (e) {}
  try { p.workData.seoTitle = (document.getElementById('t9Title')?.value || document.getElementById('t10TitleInput')?.value || p.workData.seoTitle || '').trim(); } catch (e) {}
  // ⚠️ sceneSpecs trước đây chỉ ĐỌC từ dự án mà không ghi lại — thoát app là mất sạch đồ hoạ.
  p.workData.sceneSpecs = state.sceneSpecs || {};
  // Trợ lý dựng: bản đồ vai trò + hàng đề xuất đã duyệt. Không lưu thì mở lại phải
  // chạy lại cả 60+ lượt gọi cho một việc vừa làm xong 5 phút trước.
  p.workData.nguonBat = state.nguonBat || {};
  // 55 nền tảng web bật/tắt + ứng viên đã tìm cho từng cảnh — không lưu thì mở
  // lại phải tìm lại từ đầu, mà tìm web có trần nhịp nên rất tốn.
  p.workData.webBat = state.webBat || {};
  p.workData.webCandidates = state.webCandidates || {};
  p.workData.aiMap = state.aiMap || {};
  p.workData.aiQueue = state.aiQueue || [];
  p.workData.globalGfx = state.globalGfx || [];
  // Nguồn clip YouTube của từng cảnh — cần để biết thẻ nào đang được dùng khi mở lại.
  // CHỈ lưu url/dur/start: heatmap là mảng 100 phần tử, nhân với gần 200 cảnh là phình
  // workData vô ích, mà từ khi bỏ thanh chọn đoạn thì không ai đọc tới nữa.
  try {
    const cs = {};
    for (const [k, v] of Object.entries(state.clipSrc || {})) {
      if (v && v.url) cs[k] = { url: v.url, dur: v.dur || 0, start: v.start || 0 };
    }
    p.workData.clipSrc = cs;
  } catch (e) {}
  p.workData.sceneTrans = state.sceneTrans || {};
  p.workData.wardrobe = state.wardrobe || {};
  p.workData.descMode = state.descMode || 'tag';
  p.workData.charBible = state.charBible || {};
  p.workData.bgBible = state.bgBible || {};
  p.workData.t3Era = state.t3Era || '';
  p.workData.t3BgLayout = state.t3BgLayout || 'single';
  p.workData.videoMix = (state.videoMix != null ? state.videoMix : 0);
  p.workData.shortRefPrompt = !!state.shortRefPrompt;
  p.workData.stockMix = (state.stockMix != null ? state.stockMix : 0);
  p.workData.ytMix = (state.ytMix != null ? state.ytMix : 0);
  p.workData.stockType = state.stockType || 'videos';
  p.workData.videoLogline = state.videoLogline || '';
  p.workData.sceneTypesOn = (Array.isArray(state.sceneTypesOn) && state.sceneTypesOn.length) ? state.sceneTypesOn : SCENE_TYPES_CORE.slice();
  p.workData.brandProfile = state.brandProfile || null;
}

function loadStateFromProfile(p){
  const v = p ? getCurrentVideo(p) : null;
  const wd = (v && v.workData) || createEmptyWorkData();
  state.script = wd.script || '';
  state.scenes = wd.scenes || [];
  state.scenePrompts = wd.scenePrompts || {};
  state.scenePrompts2 = wd.scenePrompts2 || {};
  state.charactersV = wd.charactersV || [];
  state.backgroundsV = wd.backgroundsV || [];
  state.assetCharPrompts = wd.assetCharPrompts || {};
  state.assetBgPrompts = wd.assetBgPrompts || {};
  state.styleRefPrompt = wd.styleRefPrompt || '';
  state.veoPrompts = wd.veoPrompts || {};
  state.pexelsResults = wd.pexelsResults || {};
  state.mediaPicks = wd.mediaPicks || {};
  state.stockCandidates = wd.stockCandidates || {};
  state.ytCandidates = wd.ytCandidates || {};
  // Nạp lại gói SEO của video này + vẽ lại kết quả
  try {
    if (typeof t9State === 'object' && t9State) t9State.result = wd.seo || null;
    const _st = document.getElementById('t9Title'), _tt = document.getElementById('t10TitleInput');
    if (_st) _st.value = wd.seoTitle || '';
    if (_tt) _tt.value = wd.seoTitle || '';
    if (wd.seo && typeof t9RenderResults === 'function') setTimeout(() => { try { t9RenderResults(wd.seo); } catch (e) {} }, 60);
    else { const box = document.getElementById('t9Results'); if (box) box.style.display = 'none'; }
    if (typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 120);
  } catch (e) {}
  state.sceneTrans = wd.sceneTrans || {};
  state.wardrobe = wd.wardrobe || {};
  state.descMode = wd.descMode || 'tag';
  state.charBible = wd.charBible || {};
  state.bgBible = wd.bgBible || {};
  state.t3Era = wd.t3Era || '';
  state.t3BgLayout = wd.t3BgLayout || 'single';
  state.videoMix = (wd.videoMix != null ? wd.videoMix : 0);
  state.shortRefPrompt = !!wd.shortRefPrompt;
  state.stockMix = (wd.stockMix != null ? wd.stockMix : 0);
  state.ytMix = (wd.ytMix != null ? wd.ytMix : 0);
  state.stockType = wd.stockType || 'videos';
  state.sceneTypesOn = (Array.isArray(wd.sceneTypesOn) && wd.sceneTypesOn.length) ? wd.sceneTypesOn.filter(k => SCENE_TYPES[k]) : SCENE_TYPES_CORE.slice();
  state.videoLogline = wd.videoLogline || '';
  state.nguonBat = wd.nguonBat || { veo: false, stock: false, yt: false, kho: false, web: false };
  state.webBat = (wd.webBat && typeof wd.webBat === 'object') ? wd.webBat : null;   // null → _webBat() dựng mặc định (chỉ nhóm tư liệu công)
  state.webCandidates = wd.webCandidates || {};
  state.aiMap = wd.aiMap || {};
  state.aiQueue = Array.isArray(wd.aiQueue) ? wd.aiQueue : [];
  state.brandProfile = wd.brandProfile || null;
  // logline đã lưu coi như khớp kịch bản đã lưu → set chữ ký để khỏi sinh lại thừa sau reload
  const _lgScript = (wd.script || '').trim();
  state.videoLoglineSig = (state.videoLogline && _lgScript) ? (_lgScript.length + '|' + _lgScript.slice(0, 60)) : '';
  const loglineEl = document.getElementById('videoLogline');
  if (loglineEl) loglineEl.value = state.videoLogline;
  const eraEl2 = document.getElementById('t3Era');
  if (eraEl2) eraEl2.value = state.t3Era;
  const bgLayoutEl2 = document.getElementById('t3BgLayout');
  if (bgLayoutEl2) bgLayoutEl2.value = state.t3BgLayout;
  const bgLayoutEl2b = document.getElementById('t2BgLayout');
  if (bgLayoutEl2b) bgLayoutEl2b.value = state.t3BgLayout || 'single';
  const vmEl = document.getElementById('t2VideoMix');
  if (vmEl) vmEl.value = String(state.videoMix != null ? state.videoMix : 0);
  const srEl = document.getElementById('t2ShortRef');
  if (srEl) srEl.checked = !!state.shortRefPrompt;
  const smEl = document.getElementById('t2StockMix');
  if (smEl) smEl.value = String(state.stockMix != null ? state.stockMix : 0);
  const ymEl = document.getElementById('t2YtMix');
  if (ymEl) ymEl.value = String(state.ytMix != null ? state.ytMix : 0);
  try { _t2ChuyenNguonCu(); } catch (e) {}   // thiết lập cũ → bảng ⚙ (một lần)
  try { t2RenderNguon(); } catch (e) {}
  const dm = document.getElementById('t2DescMode');
  if (dm) dm.value = state.descMode;
  // Images sẽ load từ IDB theo profileId — clear trước
  state.characterImages = {};
  state.sceneImages = {};
  state.sceneImagesB = {};
  state.backgroundImages = {};
  state.styleRefImages = [];
}

async function mergeLocalWorkData(p, videoId){
  try {
    const uid = window.currentUser?.uid;
    if (!uid || !p || !p.profileId) return;
    _ensureVideos(p);
    const vid = videoId || _curVideoId(p);
    let wd = await IDB.get(uid + '/' + p.profileId + '/' + vid + '/workData');
    if (wd == null && vid === 'v_main') wd = await IDB.get(uid + '/' + p.profileId + '/workData');   // key cũ (trước khi tách video)
    if (wd && typeof wd === 'object' && ((Array.isArray(wd.scenes) && wd.scenes.length) || (typeof wd.script === 'string' && wd.script.trim()))) {
      const v = p.videos.find(x => x.id === vid) || getCurrentVideo(p);
      if (v) v.workData = { ...(v.workData || {}), ...wd };   // máy là nguồn chính → local đè cloud
    }
  } catch (e) { console.warn('mergeLocalWorkData:', e); }
}

async function loadProfileImages(profileId, videoId){
  const uid = window.currentUser?.uid;
  if (!uid || !profileId) return;
  const p = getProfile();
  const vid = videoId || (p && p.profileId === profileId ? _curVideoId(p) : 'v_main');
  const prof = uid + '/' + profileId + '/';             // key cũ (trước khi tách video)
  const vbase = uid + '/' + profileId + '/' + vid + '/'; // dữ liệu RIÊNG từng video
  const useLegacy = (vid === 'v_main');                  // chỉ Video 1 (migrate) kế thừa ảnh cũ
  const g = async (name, empty) => {
    let v = await IDB.get(vbase + name);
    const isEmpty = v == null || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) || (Array.isArray(v) && !v.length);
    if (isEmpty && useLegacy){ const lg = await IDB.get(prof + name); if (lg != null) v = lg; }
    return v == null ? empty : v;
  };
  try {
    // Tất cả ảnh đều RIÊNG từng video (chỉ Style TEXT dùng chung).
    state.characterImages = await g('characterImages', {});
    state.backgroundImages = await g('backgroundImages', {});
    state.styleRefImages = await g('styleRefImages', []);
    state.sceneImages = await g('sceneImages', {});
    state.sceneImagesB = await g('sceneImagesB', {});
    try {
      mvVideoBlobs = await g('sceneVideoBlobs', {});
      state.sceneVideos = await g('sceneVideosMeta', {});
      state.motionPrompts = await g('motionPrompts', {});
      if (typeof mvVideoRender === 'function') mvVideoRender();
    } catch (e){ /* */ }
    // 🎙 Giọng đọc (MP3) RIÊNG từng video → nạp lại; không có thì xoá cho sạch (mỗi video 1 MP3).
    try {
      let mp3 = await IDB.get(vbase + 'voiceMp3');
      if (mp3 == null && useLegacy) mp3 = await IDB.get(prof + 'voiceMp3');
      if (mp3){
        const f = (mp3 instanceof File) ? mp3 : new File([mp3], (mp3.name || 'voice.mp3'), { type: mp3.type || 'audio/mpeg' });
        _autoAudioFile = f; _autoAudioWords = null;
        if (typeof t7State === 'object' && t7State){ t7State.audioFile = f; t7State.audioPeaks = null; }
        const vi = document.getElementById('t7VoInfo'); if (vi) vi.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
        if (typeof t2AudioInfo === 'function') t2AudioInfo(f);
        if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn();
        if (typeof _t7DecodePeaks === 'function') _t7DecodePeaks(f).then(r => { if (t7State){ t7State.audioPeaks = r?.peaks || null; t7State.audioDur = r?.duration || 0; if (typeof _t7CoverAudio === 'function') _t7CoverAudio(); } if (state.tool === 'tool7'){ if (typeof t7RenderRows === 'function') t7RenderRows(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); } }).catch(() => {});
      } else {
        if (typeof _t2ResetTimingAudio === 'function') _t2ResetTimingAudio();
        if (typeof t7State === 'object' && t7State){ t7State.audioFile = null; t7State.audioPeaks = null; }
        const vi = document.getElementById('t7VoInfo'); if (vi) vi.textContent = 'Chưa có giọng đọc';
      }
    } catch (e){ /* */ }
  } catch(e) { console.warn('Load workspace images failed:', e); }
}

function migrateProfiles(){
  let needSave = false;
  state.profiles.forEach(p => {
    if (!p.profileId) {
      p.profileId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      needSave = true;
    }
  });
  // One-time (rất cũ): global state → workData của profile hiện tại — TRƯỚC khi bọc videos.
  const curP = getProfile();
  if (curP && !Array.isArray(curP.videos)) {
    const wd = curP.workData;
    const wdEmpty = !wd || (!wd.script && !(wd.scenes && wd.scenes.length));
    const hasGlobal = state.script || (state.scenes && state.scenes.length) || (state.scenePrompts && Object.keys(state.scenePrompts).length);
    if (wdEmpty && hasGlobal) {
      curP.workData = {
        script: state.script || '', scenes: state.scenes || [], scenePrompts: state.scenePrompts || {},
        charactersV: state.charactersV || [], backgroundsV: state.backgroundsV || [],
        assetCharPrompts: state.assetCharPrompts || {}, assetBgPrompts: state.assetBgPrompts || {},
        styleRefPrompt: state.styleRefPrompt || '', veoPrompts: state.veoPrompts || {},
        pexelsResults: state.pexelsResults || {}, mediaPicks: state.mediaPicks || {},
        stockCandidates: state.stockCandidates || {}
        , sceneTrans: state.sceneTrans || {}, wardrobe: state.wardrobe || {}
      };
      needSave = true;
      console.log('✓ Migrated global state → workData');
    }
  }
  // Bọc workData → videos[] (Video 1 = 'v_main'), xoá workData thừa (khỏi nhân đôi khi lưu Firestore).
  state.profiles.forEach(p => {
    if (!Array.isArray(p.videos) || !p.videos.length){ _ensureVideos(p); needSave = true; }
  });
  return needSave;
}

function rerenderAllAfterProfileLoad(){
  if (typeof renderVideoSelect === 'function') renderVideoSelect();
  if (typeof _syncChLang === 'function') _syncChLang();   // NGÔN NGỮ theo profile: nạp lại dropdown + áp vào tool ở MỌI lần đổi/tạo/mở profile
  // Script textarea (Tool 2) — ID đúng là scriptInput
  const sc = document.getElementById('scriptInput'); if (sc) sc.value = state.script || '';
  // Prescan output textareas (Tool 2)
  const csIn = document.getElementById('charsInputV'); if (csIn) csIn.value = (state.charactersV || []).join('\n');
  const bgIn = document.getElementById('bgInputV'); if (bgIn) bgIn.value = (state.backgroundsV || []).join('\n');
  // Tool 3 char/bg textareas
  const charTA = document.getElementById('t3Characters'); if (charTA) charTA.value = (state.charactersV || []).join('\n');
  const bgTA = document.getElementById('t3Backgrounds'); if (bgTA) bgTA.value = (state.backgroundsV || []).join('\n');
  // Tool 3 Style Prompts (display, từ profile object)
  const p = getProfile();
  const t3CS = document.getElementById('t3CharStyle'); if (t3CS) t3CS.value = p?.characterStyle || '';
  const t3CSB = document.getElementById('t3CharStyleB'); if (t3CSB) t3CSB.value = p?.characterStyleB || '';
  const t3BS = document.getElementById('t3BgStyle'); if (t3BS) t3BS.value = p?.backgroundStyle || '';
  const t3SS = document.getElementById('t3SceneStyle'); if (t3SS) t3SS.value = p?.sceneStyle || '';
  const t3PR = document.getElementById('t3PromptRules'); if (t3PR) t3PR.value = p?.promptRules || '';
  // Tool 3 Visual Style/Ngạch/POV
  const t3Vs = document.getElementById('t3VisualStyle'); if (t3Vs) t3Vs.value = p?.visualStyle || '';
  const t3Ng = document.getElementById('t3Ngach'); if (t3Ng) t3Ng.value = p?.ngach || '';
  const t3Pv = document.getElementById('t3PovStyle'); if (t3Pv) t3Pv.value = p?.povStyle || '';
  // Tool 2 visual style readonly
  const v2 = document.getElementById('visualStyle2'); if (v2) v2.value = p?.visualStyle || '';
  // Tool 6 Veo settings
  const v6Vs = document.getElementById('v6VisualStyle'); if (v6Vs) v6Vs.value = p?.visualStyle || '';
  // Unified textareas + lists
  if (typeof renderAllT2 === 'function') renderAllT2();
  if (typeof renderTable === 'function') renderTable();
  if (typeof renderPreview === 'function') renderPreview();
  if (typeof renderPromptsV === 'function') renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (state.tool === 'tool7' && typeof t7Build === 'function') { try { t7Build(); } catch (e) {} }
  if (typeof updateStats === 'function') updateStats();
  if (typeof updateAllAssetPromptsBox === 'function') updateAllAssetPromptsBox();
  if (state.charactersV?.length && typeof renderAssetCharPrompts === 'function') renderAssetCharPrompts(state.charactersV);
  else { const cl = document.getElementById('t3CharPromptsList'); if (cl) cl.innerHTML = '<div class="empty-state">Chưa có nhân vật.</div>'; }
  if (state.backgroundsV?.length && typeof renderAssetBgPrompts === 'function') renderAssetBgPrompts(state.backgroundsV);
  else { const bl = document.getElementById('t3BgPromptsList'); if (bl) bl.innerHTML = '<div class="empty-state">Chưa có bối cảnh.</div>'; }
  // Style Reference panel
  const stPanel = document.getElementById('styleRefPanel');
  if (stPanel) stPanel.style.display = state.styleRefPrompt ? 'block' : 'none';
  if (typeof renderStyleRef === 'function') renderStyleRef();
  // Tool 5 search results
  document.querySelectorAll('[id^="media-results-"]').forEach(el => el.innerHTML = '');
  // Tool 3 character image gallery
  if (typeof renderCharImageGallery === 'function') renderCharImageGallery();
  if (typeof renderStyleImageGallery === 'function') renderStyleImageGallery();
  // Char count display
  if (typeof updateScriptCount === 'function') updateScriptCount();
  syncTool2FromProfile();
  renderProfileStyles();
}

function renderProfileSelect(){
  const sel = document.getElementById('profileSelect');
  if (!sel) return;
  sel.innerHTML = state.profiles.map((p, i) =>
      `<option value="${i}" ${i === state.currentProfileIdx ? 'selected' : ''}>${escapeHtml(p.tenKenh || 'Profile ' + (i + 1))}</option>`
    ).join('') + '<option value="__new">＋ Tạo Profile mới</option>';
}

function _profileLang(){ const p = getProfile(); return (p && p.ngonNgu) || 'Tiếng Việt'; }

function _langVoiceCode(lang){ return _LANG_VOICE[lang || _profileLang()] || null; }

function _applyLangToTools(lang){
  const ts = document.getElementById('tsLang');
  if (ts){ if (![...ts.options].some(o => o.value === lang || o.textContent === lang)){ const o=document.createElement('option'); o.value=lang; o.textContent=lang; ts.appendChild(o); } ts.value = lang; }
  const vc = _langVoiceCode(lang), vl = document.getElementById('voiceLang');
  if (vc && vl) vl.value = vc;   // OmniVoice có mã tương ứng thì set; ngôn ngữ khác giữ nguyên (dùng TTS ngoài)
}

function _syncChLang(){
  const sel = document.getElementById('chLang'); if (!sel) return;
  const lang = _profileLang();
  if (![...sel.options].some(o => o.value === lang)){ const o=document.createElement('option'); o.value=lang; o.textContent='🌐 '+lang; sel.appendChild(o); }
  sel.value = lang;
  _applyLangToTools(lang);
}

function setChannelLang(v){
  const p = getProfile();
  if (!p){ if (typeof setStatusScript==='function') setStatusScript('Tạo/chọn Profile kênh trước khi đặt ngôn ngữ.', 'error'); _syncChLang(); return; }
  p.ngonNgu = v;
  const pn = document.getElementById('pNgonNgu'); if (pn) pn.value = v;
  _applyLangToTools(v);
  if (typeof saveState === 'function') saveState(true);
}

async function switchProfile(val){
  if (val === '__new'){ if (typeof newProfile === 'function') newProfile(); else renderProfileSelect(); return; }   // option "＋ Tạo Profile mới"
  const newIdx = val === '' ? -1 : parseInt(val);
  // Save current profile's workData trước khi switch
  if (state.currentProfileIdx >= 0 && state.currentProfileIdx !== newIdx) {
    syncStateToCurrentProfile();
  }
  state.currentProfileIdx = newIdx;
  if (newIdx >= 0) {
    const newP = state.profiles[newIdx];
    _ensureVideos(newP);
    await mergeLocalWorkData(newP);   // nạp kịch bản/cảnh local (IDB) — cloud chỉ giữ bản nhẹ
    loadStateFromProfile(newP);
    await loadProfileImages(newP.profileId, _curVideoId(newP));
  } else {
    loadStateFromProfile(null); // clear all
  }
  rerenderAllAfterProfileLoad();
  if (typeof t10OnProfileSwitch === 'function') t10OnProfileSwitch();
  if (typeof applyChannelCfg === 'function') applyChannelCfg();   // nạp cấu hình Tool 2 + giọng của kênh vừa chọn
  if (typeof _syncChLang === 'function') _syncChLang();            // đồng bộ ngôn ngữ kênh vào topbar + các tool
  saveState(true);
}

async function newProfile(){
  if (state.profiles.length >= getMaxProfiles()) {
    return showGate(`Gói ${tierPlanName(state.userTier)} chỉ tạo được ${getMaxProfiles()} kênh. Nâng cấp gói để tạo thêm.`);
  }
  // Save current profile workData
  if (state.currentProfileIdx >= 0) syncStateToCurrentProfile();
  state.profiles.push(makeEmptyProfile());
  state.currentProfileIdx = state.profiles.length - 1;
  // Reset state về workData rỗng của profile mới (đã rỗng sẵn)
  loadStateFromProfile(state.profiles[state.currentProfileIdx]);
  renderProfileSelect();
  rerenderAllAfterProfileLoad();
  openProfile();
  saveState(true);
}

async function deleteProfile(){
  if (state.currentProfileIdx < 0) return;
  const p = getProfile();
  if (!confirm('Xoá profile "' + (p.tenKenh || 'unnamed') + '"?\nTOÀN BỘ kịch bản, cảnh, prompt, ảnh storyboard của profile này sẽ mất. Không hoàn tác được.')) return;
  // Cleanup IDB images cho profile này
  const uid = window.currentUser?.uid;
  if (uid && p.profileId) {
    try {
      await IDB.set(uid + '/' + p.profileId + '/characterImages', null);
      await IDB.set(uid + '/' + p.profileId + '/sceneImages', null);
      await IDB.set(uid + '/' + p.profileId + '/styleRefImages', null);
    } catch(e) {}
  }
  state.profiles.splice(state.currentProfileIdx, 1);
  state.currentProfileIdx = state.profiles.length > 0 ? 0 : -1;
  if (state.currentProfileIdx >= 0) {
    const newP = state.profiles[state.currentProfileIdx];
    _ensureVideos(newP);
    loadStateFromProfile(newP);
    await loadProfileImages(newP.profileId, _curVideoId(newP));
  } else {
    loadStateFromProfile(null);
  }
  renderProfileSelect();
  closeProfile();
  rerenderAllAfterProfileLoad();
  saveState(true);
}

function openProfile(){
  if (state.currentProfileIdx < 0) {
    if (state.profiles.length === 0) { newProfile(); return; }
    state.currentProfileIdx = 0;
  }
  const p = getProfile(); if (!p) return;
  document.getElementById('pTenKenh').value = p.tenKenh || '';
  document.getElementById('pNgach').value = p.ngach || '';
  document.getElementById('pVisualStyle').value = p.visualStyle || 'Crayon Capital — Dark';
  document.getElementById('pNgonNgu').value = p.ngonNgu || 'Tiếng Việt';
  document.getElementById('pPovStyle').value = p.povStyle || 'Ngôi thứ 2 (Bạn)';
  document.getElementById('pCauTruc').value = p.cauTruc || 'Levels / Escalation / POV';
  document.getElementById('pSoPhan').value = p.soPhan || 8;
  document.getElementById('pTargetPhut').value = p.targetPhut || 12;
  document.getElementById('pCharStyle').value = p.characterStyle || '';
  if (document.getElementById('pCharIdentity')) document.getElementById('pCharIdentity').value = p.charIdentity || '';
  document.getElementById('pBgStyle').value = p.backgroundStyle || '';
  document.getElementById('pSceneStyle').value = p.sceneStyle || '';
  document.getElementById('pPromptRules').value = p.promptRules || '';
  if (document.getElementById('pScriptPrompt')) document.getElementById('pScriptPrompt').value = p.scriptPrompt || '';
  document.getElementById('pStyleGuide').value = p.styleGuide || '';
  document.getElementById('pDnaKenh').value = p.dnaKenh || '';
  document.getElementById('pChuDe').value = p.chuDe || '';
  document.getElementById('modalProfileTitle').textContent = p.tenKenh ? 'Sửa: ' + p.tenKenh : 'Profile mới';
  renderStyleImageGallery();
  document.getElementById('profileModal').classList.add('show');
}

function closeProfile(){ document.getElementById('profileModal').classList.remove('show'); }

function saveProfile(){
  if (state.currentProfileIdx < 0) return;
  const p = getProfile();
  p.tenKenh = document.getElementById('pTenKenh').value;
  p.ngach = document.getElementById('pNgach').value;
  p.visualStyle = document.getElementById('pVisualStyle').value;
  p.ngonNgu = document.getElementById('pNgonNgu').value;
  p.povStyle = document.getElementById('pPovStyle').value;
  p.cauTruc = document.getElementById('pCauTruc').value;
  p.soPhan = parseInt(document.getElementById('pSoPhan').value) || 8;
  p.targetPhut = parseInt(document.getElementById('pTargetPhut').value) || 12;
  p.characterStyle  = document.getElementById('pCharStyle').value;
  if (document.getElementById('pCharIdentity')) p.charIdentity = document.getElementById('pCharIdentity').value;
  p.backgroundStyle = document.getElementById('pBgStyle').value;
  p.sceneStyle = document.getElementById('pSceneStyle').value;
  p.promptRules = document.getElementById('pPromptRules').value;
  if (document.getElementById('pScriptPrompt')) p.scriptPrompt = document.getElementById('pScriptPrompt').value;
  p.styleGuide = document.getElementById('pStyleGuide').value;
  p.dnaKenh = document.getElementById('pDnaKenh').value;
  p.chuDe = document.getElementById('pChuDe').value;
  renderProfileSelect();
  syncTool2FromProfile();
  renderProfileStyles();
  // Refresh Tool 3 style fields ngay sau khi lưu
  const rp = getProfile();
  const _csb = document.getElementById('t3CharStyleB'); if (_csb) _csb.value = rp?.characterStyleB || '';
  const _cs  = document.getElementById('t3CharStyle');  if (_cs)  _cs.value  = rp?.characterStyle  || '';
  const _bs  = document.getElementById('t3BgStyle');    if (_bs)  _bs.value  = rp?.backgroundStyle || '';
  const _ss  = document.getElementById('t3SceneStyle'); if (_ss)  _ss.value  = rp?.sceneStyle      || '';
  const _pr  = document.getElementById('t3PromptRules');if (_pr)  _pr.value  = rp?.promptRules     || '';
  closeProfile();
  saveState(true);
  setStatus1('✓ Đã lưu Profile: ' + p.tenKenh, 'ok');
}

async function renameProfile(){
  const p = getProfile(); if (!p) return;
  const name = (typeof _askText === 'function') ? await _askText('Đổi tên Profile:', p.tenKenh || '') : prompt('Đổi tên Profile:', p.tenKenh);
  if (name === null || name === undefined) return;
  p.tenKenh = String(name).trim() || p.tenKenh;
  const el = document.getElementById('pTenKenh'); if (el) el.value = p.tenKenh;
  const ttl = document.getElementById('modalProfileTitle'); if (ttl) ttl.textContent = 'Sửa: ' + p.tenKenh;
  renderProfileSelect();
  saveState(true);
}

function exportProfile(){
  const p = getProfile(); if (!p) return;
  downloadJSON(p, 'profile-' + (p.tenKenh || 'unnamed').replace(/\W+/g, '-') + '-' + Date.now() + '.json');
}

function importProfile(event){
  const f = event.target.files[0]; if (!f) return;
  if (state.profiles.length >= getMaxProfiles()) {
    event.target.value = '';
    return showGate(`Gói ${tierPlanName(state.userTier)} chỉ chứa được ${getMaxProfiles()} kênh. Xoá kênh cũ hoặc nâng cấp gói.`);
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const loaded = JSON.parse(e.target.result);
      state.profiles.push(loaded);
      state.currentProfileIdx = state.profiles.length - 1;
      renderProfileSelect();
      renderProfileStyles();
      openProfile();
      saveState(true);
    } catch (err) {
      alert('Lỗi import: ' + err.message);
    }
  };
  reader.readAsText(f);
  event.target.value = '';
}

function applyStylePreset(key){
  if (!key) return;
  const p = STYLE_PRESETS[key];
  if (!p || !p.characterStyle) return;
  const cs = document.getElementById('pCharStyle');
  const bs = document.getElementById('pBgStyle');
  const ss = document.getElementById('pSceneStyle');
  const pr = document.getElementById('pPromptRules');
  const hasContent = (cs && cs.value.trim()) || (bs && bs.value.trim()) || (ss && ss.value.trim());
  if (hasContent && !confirm('Đè 4 ô style hiện tại bằng preset "' + (p.label || key) + '"?')) {
    document.getElementById('pStylePreset').value = '';
    return;
  }
  if (cs) cs.value = p.characterStyle || '';
  if (bs) bs.value = p.backgroundStyle || '';
  if (ss) ss.value = p.sceneStyle || '';
  if (pr) pr.value = p.promptRules || '';
  const ci = document.getElementById('pCharIdentity');
  if (ci) ci.value = p.charIdentity || '';   // dòng đặc điểm lặp mỗi cảnh → giữ nhất quán
  // 🚫👤 Ngách không cần nhân vật (infographic/whiteboard) → tự tick "Kênh không người" ở Phân Cảnh.
  const nc = document.getElementById('noCharMode');
  if (nc && p.noChar){ nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
  const st = document.getElementById('extractStatus');
  if (st) st.innerHTML = '<span style="color:var(--green)">✓ Đã điền preset ' + (p.label || key) + (p.noChar ? ' + tự bật "Kênh không người"' : '') + '. Sửa lại cho khớp kênh rồi Lưu.</span>';
}

function quickFill(){
  document.getElementById('pTenKenh').value = 'Ancient Curiosities';
  document.getElementById('pNgach').value = 'Dark educational, mysteries, lịch sử bí ẩn';
  document.getElementById('pVisualStyle').value = 'Crayon Capital — Dark';
  document.getElementById('pCharStyle').value = PRESET.characterStyle;
  if (document.getElementById('pCharStyleB') && PRESET.characterStyleB) {
    document.getElementById('pCharStyleB').value = PRESET.characterStyleB;
  }
  document.getElementById('pBgStyle').value = PRESET.backgroundStyle;
  document.getElementById('pSceneStyle').value = PRESET.sceneStyle;
  document.getElementById('pPromptRules').value = 'No text, no watermark, consistent character design across all scenes, avoid gore, no realistic human faces, maintain flat 2D cartoon aesthetic';
  document.getElementById('extractStatus').innerHTML = '<span style="color:var(--green)">✓ Đã điền mẫu. Sửa lại rồi Lưu.</span>';
}

function syncTool2FromProfile(){
  const p = getProfile();
  const el = document.getElementById('visualStyle2');
  if (!el) return;
  el.value = p ? p.visualStyle : '';
}

function _profileStyleCard(field, label, kind){
  const p = getProfile();
  const val = p?.[field] || '';
  const editing = state.editingProfileStyle === field;
  const icoHtml = `<span class="pc-ico i-${kind}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${_PF_ICONS[kind]}</svg></span>`;
  if (editing){
    return `<div class="pcard editing">
      <div class="pc-head">${icoHtml}<h3>${label}</h3></div>
      <textarea id="editProfileStyleTA" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveProfileStyle('${field}')}else if(event.key==='Escape'){cancelProfileStyle()}" style="width:100%;min-height:180px;font-size:12.5px;line-height:1.6;border:2px solid var(--accent)">${escapeHtml(val)}</textarea>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn primary sm" onclick="saveProfileStyle('${field}')">✓ Lưu</button>
        <button class="btn ghost sm" onclick="cancelProfileStyle()">✗ Huỷ</button>
        <span style="font-size:11px;color:var(--text-muted)">Ctrl+Enter lưu nhanh</span>
      </div></div>`;
  }
  const long = (val || '').length > 210;
  return `<div class="pcard">
    <div class="pc-head">${icoHtml}<h3>${label}</h3>
      <span class="pc-acts">
        <button class="btn ghost sm" onclick="editProfileStyle('${field}')" title="Sửa trực tiếp">✏️ Sửa</button>
        <button class="btn ghost sm" onclick="copyText((getProfile()||{}).${field}||'')">📋 Sao chép</button>
      </span>
    </div>
    <div class="pc-body ${long ? 'clamp' : ''}">${escapeHtml(val || '(trống)')}</div>
    ${long ? `<div class="pc-more" onclick="pfToggleFull(this)">Xem đầy đủ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M6 9l6 6 6-6"/></svg></div>` : ''}
  </div>`;
}

function _profileScriptCard(){
  const base = _profileStyleCard('scriptPrompt', 'Prompt kịch bản', 'script');
  if (state.editingProfileStyle === 'scriptPrompt') return base;
  const tools = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <input type="file" id="pScriptFiles" accept=".txt,text/plain" multiple style="display:none" onchange="tsAnalyzeCompetitor(this.files)">
      <span style="font-size:11.5px;color:var(--text-muted)">Gửi <b>nhiều kịch bản đối thủ</b> (.txt, nên ≥3) → AI phân tích 9 lớp → tạo <b>prompt viral</b> 8 khối tự điền:</span>
      <button class="btn ghost sm" onclick="document.getElementById('pScriptFiles').click()">📄 Chọn file kịch bản</button>
      <span id="pScriptAnalyzeStatus" style="font-size:11.5px;color:var(--text-muted)"></span>
    </div>`;
  return base.replace(/<\/div>\s*$/, tools + '</div>');
}

function _tsCleanPrompt(t){
  let s = String(t || '').trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();          // bỏ code fence
  s = s.replace(/^\s*(prompt kịch bản|đây là prompt|kết quả)\s*[:：].*$/i, '').trim();  // bỏ dòng dẫn đầu
  return s;
}

function renderProfileStyles(){
  const box = document.getElementById('profileStylesDisplay');
  if (!box) return;
  const p = getProfile();
  if (!p) {
    box.innerHTML = '<div class="empty-state">Chưa có Profile. Bấm <strong>+ Tạo mới</strong> ở trên.</div>';
    return;
  }
  const s = _pfStats();
  const icoScene = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>';
  const icoImg = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>';
  const icoVid = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>';
  box.innerHTML = `
    <div class="pf-grid">
      <div class="pf-cards">
        ${_profileStyleCard('characterStyle', 'Character Style', 'char')}
        ${_profileStyleCard('backgroundStyle', 'Background Style', 'bg')}
        ${_profileStyleCard('sceneStyle', 'Scene Style / Aesthetic', 'scene')}
        ${_profileStyleCard('promptRules', 'Prompt Rules / Negative', 'rule')}
        <div style="grid-column:1 / -1">${_profileScriptCard()}</div>
      </div>
      <div class="pf-side">
        <div class="pf-panel"><div class="ph">Thông tin profile</div><div class="pb">
          <div class="pf-hero"><span class="pf-th">🎬</span><div style="min-width:0">
            <div class="pf-nm">${escapeHtml(p.tenKenh || 'Profile')}</div>
            <span class="pf-chip"><span class="d"></span>Đang hoạt động</span></div></div>
          <div class="pf-kv"><span class="k">Ngạch</span><span class="v">${escapeHtml(p.ngach || '—')}</span></div>
          <div class="pf-kv"><span class="k">Visual style</span><span class="v">${escapeHtml(p.visualStyle || '—')}</span></div>
          <div class="pf-kv"><span class="k">Số phần · Target</span><span class="v">${escapeHtml(String(p.soPhan || '—'))} · ${escapeHtml(String(p.targetPhut || '—'))}p</span></div>
        </div></div>
        <div class="pf-panel"><div class="ph">Thống kê (dữ liệu thật)</div><div class="pb">
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoScene}</svg>Số cảnh</span><span class="n">${s.scenes}</span></div>
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoImg}</svg>Ảnh đã tạo</span><span class="n">${s.imgs}</span></div>
          <div class="pf-stat"><span class="lab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icoVid}</svg>Video đã dựng</span><span class="n">${s.vids}</span></div>
        </div></div>
        <div class="pf-panel"><div class="ph">Hành động nhanh</div><div class="pb" style="gap:2px">
          <div class="pf-qa" onclick="newProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Tạo Profile mới</div>
          <div class="pf-qa" onclick="openProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg>Sửa thông tin kênh</div>
          <div class="pf-qa" onclick="newVideo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>Video mới (trong kênh này)</div>
          <div class="pf-qa" onclick="renameVideo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg>Đổi tên video</div>
          <div class="pf-qa" onclick="openVideoManager()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M9 9l2 2 4-4"/></svg>Quản lý / Xóa video</div>
          <div class="pf-qa danger" onclick="deleteProfile()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>Xóa Profile</div>
        </div></div>
      </div>
    </div>`;
}

function _pfStats(){
  const scenes = (state.scenes || []).length;
  const si = state.sceneImages || {}, sib = state.sceneImagesB || {};
  const imgs = Object.keys(si).filter(k => si[k]?.base64).length + Object.keys(sib).filter(k => sib[k]?.base64).length;
  const sv = state.sceneVideos || {};
  const vids = Object.keys(sv).filter(k => sv[k] && !sv[k].error).length;
  return { scenes, imgs, vids };
}

function pfToggleFull(btn){
  const card = btn.closest('.pcard'); const body = card && card.querySelector('.pc-body'); if (!body) return;
  const nowClamped = body.classList.toggle('clamp');
  btn.firstChild.textContent = nowClamped ? 'Xem đầy đủ ' : 'Thu gọn ';
}

function editProfileStyle(field){
  if (!getProfile()) return;
  state.editingProfileStyle = field;
  renderProfileStyles();
  setTimeout(() => {
    const ta = document.getElementById('editProfileStyleTA');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function cancelProfileStyle(){
  state.editingProfileStyle = null;
  renderProfileStyles();
}

function saveProfileStyle(field){
  const ta = document.getElementById('editProfileStyleTA');
  const p = getProfile();
  if (!ta || !p) return;
  p[field] = ta.value;
  state.editingProfileStyle = null;
  renderProfileStyles();
  if (typeof syncTool2FromProfile === 'function') syncTool2FromProfile();
  // Đồng bộ sang ô style của Tool 3
  const mirror = { characterStyle: 't3CharStyle', backgroundStyle: 't3BgStyle', sceneStyle: 't3SceneStyle', promptRules: 't3PromptRules' };
  const el = document.getElementById(mirror[field]);
  if (el) el.value = p[field] || '';
  saveState(true);
  setStatus1('✓ Đã lưu style: ' + field, 'ok');
}

function renderStyleImageGallery(){
  const gallery = document.getElementById('pStyleImgGallery');
  if (!gallery) return;
  document.getElementById('pStyleImgCount').textContent = state.styleRefImages.length + ' ảnh';
  gallery.innerHTML = state.styleRefImages.map((img, i) =>
    `<div class="img-tile">
      <img src="data:${img.mediaType};base64,${img.base64}" alt="">
      <button class="rm" onclick="state.styleRefImages.splice(${i},1);renderStyleImageGallery()">×</button>
    </div>`
  ).join('');
}

function clearStyleImages(){
  state.styleRefImages = [];
  renderStyleImageGallery();
  document.getElementById('styleAnalysisStatus').innerHTML = '';
}

async function analyzeStyleImages(){
  if (!state.styleRefImages.length) return alert('Cần upload ít nhất 1 ảnh mẫu.');
  const status = document.getElementById('styleAnalysisStatus');
  status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang phân tích style từ ' + state.styleRefImages.length + ' ảnh...</span>';
  document.getElementById('btnAnalyzeStyle').disabled = true;

  try {
    const content = [];
    for (const img of state.styleRefImages.slice(0, 4)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    }
    content.push({
      type: 'text',
      text: `Analyze the visual style of the ${state.styleRefImages.length} sample images above IN DEPTH (images from one faceless video/animation channel). Goal: write an EXTREMELY DETAILED "STYLE GUIDE" so every future generated image keeps the exact style and stays consistent. ABSOLUTELY no sketchy work, no short generic paragraph.

Return EXACTLY 1 JSON object (no markdown, no characters outside the JSON). ALL values written IN ENGLISH for G-Labs, use \\n for line breaks between sections:
{
  "characterStyle": "VERY DETAILED 200-350 words, MULTIPLE clearly sectioned paragraphs. The opening sentence locks the overall style (e.g. 'A minimalist stick-limb storybook character, hand-drawn with...'). Then describe by section:\\n#1 BODY & PROPORTIONS: head shape & proportions, head/body ratio, neck-arms-legs (thin stick limbs or real limbs, muscles/joints or not), hands (mitten/fingers), feet.\\n#2 FACE: face/skin color, eye style (dots/oval/with iris/eyelashes), nose, mouth, eyebrows, default expression.\\n#3 HAIR & CLOTHING: hairstyle & how it is drawn, how clothing adapts to setting/era.\\nSTATE CLEARLY the linework: outline thickness, cel-shading style, grain present or not. Lock the style with a clear ASSERTIVE, POSITIVE sentence (e.g. 'flat 2D hand-drawn cartoon, cel-shaded, grounded human proportions with slim rounded limbs') — MINIMIZE 'NOT/no' (Nano Banana is an instruction-following model, no SDXL-style negatives); if needed add at most 1-2 short things to avoid. Only describe what is ACTUALLY visible in the images.",
  "backgroundStyle": "VERY DETAILED 150-300 words, multiple paragraphs: outline thickness & sharpness, environment detail level COMPARED to characters, specific palette, cel-shading style + light sources (direction/color/warm-cold contrast), perspective & depth layers (foreground/midground/background), materials & textures (wood, stone, fabric, metal, paper...), prop types. End with: NO characters, NO people, NO figures, NO text, NO words, 16:9 ratio.",
  "sceneStyle": "60-120 words: overall aesthetic for EVERY scene — drawing style, linework, palette, cel-shading, light contrast, mood/tone, 16:9 frame, consistent across all scenes.",
  "promptRules": "SHORT list (max ~8-12 phrases) — MOSTLY positive assertions of things to KEEP (correct linework & outline weight, correct body proportions, the images' palette, character consistent across scenes), plus only the truly needed avoidances: no text, no watermark, no logo, no distorted anatomy, no extra fingers. Do NOT write a long SDXL-style negative list — Nano Banana is an instruction-following model.",
  "visualStyle": "short 2-5 word name for this style"
}

IMPORTANT: characterStyle & backgroundStyle MUST be long and sectioned like a REAL STYLE GUIDE (not one short paragraph). Analyze from the ACTUAL images, do NOT invent, do NOT guess what is not visible.`
    });

    const data = await callLLMJson('', {
      maxTokens: 4000,
      messages: [{ role: 'user', content }],
      validate: d => d && typeof d === 'object' && !Array.isArray(d)
        && typeof d.characterStyle === 'string' && d.characterStyle.length > 250
        && typeof d.backgroundStyle === 'string' && d.backgroundStyle.length > 150
    });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã phân tích xong. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAnalyzeStyle').disabled = false;
}

async function genStyleFromText(){
  const desc = (document.getElementById('pStyleDesc')?.value || '').trim();
  if (!desc) return alert('Gõ mô tả kênh trước (ngách + phong cách).');
  const status = document.getElementById('styleDescStatus');
  if (status) status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang viết style guide…</span>';
  const btn = document.getElementById('btnGenStyleText'); if (btn) btn.disabled = true;
  try {
    const prompt = `You are an art director for a faceless video channel. From the CHANNEL DESCRIPTION below, write a DETAILED STYLE GUIDE so that EVERY generated image (via Nano Banana / Imagen) keeps the EXACT style and stays consistent.

CHANNEL DESCRIPTION: "${desc}"

Return EXACTLY 1 JSON object (no markdown, no characters outside the JSON). ALL values IN ENGLISH, use \\n for line breaks between sections:
{
  "characterStyle": "150-300 words, sectioned: BODY & PROPORTIONS, FACE, HAIR & CLOTHING, line quality/render material. Use POSITIVE phrasing (instruction-following model — MINIMIZE 'no/not'). If it is a real-photo channel, describe as real-person photography; if animated, describe the linework. If the niche has NO human characters (scenery/objects/processes), describe the niche's typical main subject.",
  "backgroundStyle": "120-250 words: the niche's typical settings/environments, level of detail, color palette, lighting (direction/color/contrast), perspective & depth, materials/textures. End with: no characters, no people, no text, 16:9 ratio.",
  "sceneStyle": "40-90 SHORT words: overall aesthetic for EVERY scene — image/drawing style, color palette, lighting, mood, 16:9 frame, consistent. (This tag block gets appended to the END of every prompt, so it must be concise.)",
  "promptRules": "8-12 phrases, MOSTLY positive (things to KEEP), with only a few truly needed negatives: no text, no watermark. Do NOT write a long SDXL-style negative list.",
  "visualStyle": "short style name, 2-5 words",
  "ngach": "short niche",
  "noPeople": true if this niche almost NEVER has human characters (tips, objects, processes, infographics, scenery, products...), false if it usually does (storytelling, real-person vlogs, characters...)
}
Infer the correct industry from the description. Do NOT invent details contradicting the description.`;
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && typeof d === 'object' && !Array.isArray(d) && typeof d.sceneStyle === 'string' && d.sceneStyle.length > 20 });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngach){ const e = document.getElementById('pNgach'); if (e && !e.value.trim()) e.value = data.ngach; }
    const _sp = document.getElementById('pStylePreset'); if (_sp) _sp.value = '';   // đã tùy biến → bỏ chọn preset
    // 🚫👤 Ngách không người → tự tick "Kênh không người".
    const _nc = document.getElementById('noCharMode');
    if (_nc && data.noPeople === true){ _nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
    if (status) status.innerHTML = '<span style="color:var(--green)">✓ Đã điền 4 ô style' + (data.noPeople === true ? ' + tự bật "Kênh không người"' : '') + '. Kiểm tra rồi Lưu.</span>';
  } catch (e){ console.error(e); if (status) status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message || String(e)) + '</span>'; }
  if (btn) btn.disabled = false;
}

