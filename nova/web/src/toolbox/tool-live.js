/* ── tool-live.js — PHÁT TRỰC TIẾP (Livestream Studio, mô hình TikTok LIVE Studio):
      Đa nền tảng RTMP (YouTube / TikTok / Facebook / Tùy chỉnh) + Stream Key riêng từng
      nền tảng, MỖI nền tảng GÁN vào MỘT nguồn phát; nguồn: video có sẵn (lặp vô hạn /
      lặp theo số lần) / webcam (dshow) / NHIỀU cửa sổ ứng dụng cùng lúc (gdigrab — mỗi
      nguồn 1 tiến trình ffmpeg riêng). FFmpeg tee muxer đẩy song song qua IPC
      livestream:* → window.native.liveStudio.
      Renderer script thường (không import/export) — mọi tên cấp đầu tiền tố lstudio*
      (module system của renderer — AGENTS.md §8). Cấu hình nền tảng + key lưu localStorage. ── */

/* Preset RTMP mặc định của từng nền tảng (user sửa được URL — key luôn nhập tay). */
var lstudioPresets = {
  youtube: { name: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2/' },
  tiktok: { name: 'TikTok LIVE', url: 'rtmp://push.tiktokcdn-live.com/live/' },
  facebook: { name: 'Facebook Live', url: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  custom: { name: 'Tùy chỉnh', url: '' },
};

var lstudioState = {
  platforms: [],   // { id, enabled, preset, url, key, srcId } — srcId = nguồn được gán
  windows: [],     // nguồn cửa sổ: { id, title } — THÊM NHIỀU để live song song
  winOptions: [],  // cache danh sách cửa sổ (list-windows) cho select của từng hàng
  running: false,
  elapsedTimer: null,
};
var lstudioSeq = 0;

function lstudioNative() {
  const n = window.native && window.native.liveStudio;
  if (!n) throw new Error('Chỉ dùng được trong app AI Video Studio (thiếu bridge liveStudio).');
  return n;
}

function lstudioSetStatus(text, isErr) {
  const el = document.getElementById('lstudioStatus');
  if (el) { el.textContent = text; el.style.color = isErr ? 'var(--danger, #e5484d)' : 'var(--accent)'; }
}

/* ── Lưu / nạp cấu hình (localStorage — Stream Key chỉ nằm trên máy user) ── */
var LSTUDIO_STORE = 'lstudio.config.v1';

function lstudioSave() {
  try {
    const cfg = {
      platforms: lstudioState.platforms,
      windows: lstudioState.windows,
      winOptions: lstudioState.winOptions,
      res: document.getElementById('lstudioRes').value,
      fps: document.getElementById('lstudioFps').value,
      kbps: document.getElementById('lstudioKbps').value,
      loopMode: document.getElementById('lstudioLoopMode').value,
      loopCount: Number(document.getElementById('lstudioLoopCount').value) || 3,
      noAudioVideo: document.getElementById('lstudioNoAudioVideo').checked,
      noAudioCap: document.getElementById('lstudioNoAudioCap').checked,
      encoder: document.getElementById('lstudioEncSel').value,
      retryOn: document.getElementById('lstudioRetryOn').checked,
      retryMax: Number(document.getElementById('lstudioRetryMax').value) || 3,
    };
    localStorage.setItem(LSTUDIO_STORE, JSON.stringify(cfg));
  } catch (_) { /* localStorage đầy/chặn — bỏ qua, config chỉ là tiện nghi */ }
}

function lstudioLoad() {
  try {
    const raw = localStorage.getItem(LSTUDIO_STORE);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (Array.isArray(cfg.platforms)) lstudioState.platforms = cfg.platforms;
    if (Array.isArray(cfg.windows)) lstudioState.windows = cfg.windows;
    if (Array.isArray(cfg.winOptions)) lstudioState.winOptions = cfg.winOptions;
    if (cfg.res) document.getElementById('lstudioRes').value = cfg.res;
    if (cfg.fps) document.getElementById('lstudioFps').value = cfg.fps;
    if (cfg.kbps) document.getElementById('lstudioKbps').value = cfg.kbps;
    if (cfg.loopMode) document.getElementById('lstudioLoopMode').value = cfg.loopMode;
    if (cfg.loopCount) document.getElementById('lstudioLoopCount').value = cfg.loopCount;
    document.getElementById('lstudioNoAudioVideo').checked = !!cfg.noAudioVideo;
    document.getElementById('lstudioNoAudioCap').checked = !!cfg.noAudioCap;
    if (cfg.encoder) document.getElementById('lstudioEncSel').value = cfg.encoder;
    document.getElementById('lstudioRetryOn').checked = !!cfg.retryOn;
    document.getElementById('lstudioRetryMax').value = cfg.retryMax || 3;
    lstudioOnRetryChange();
    lstudioUpdateBw();
  } catch (_) { /* config hỏng → bỏ qua, dùng mặc định */ }
}

function lstudioEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══ PHẦN 2: nguồn phát hiện tại ═══ */

/* Danh sách nguồn theo chế độ đang chọn — dùng cho select "Nguồn" của nền tảng
   và select "nhận bởi" của micro. Giá trị phụ thuộc input hiện tại của UI. */
function lstudioSourceDefs() {
  const mode = document.getElementById('lstudioMode').value;
  if (mode === 'video') {
    const path = document.getElementById('lstudioVideoPath').textContent;
    return [{ id: 'v1', label: 'Video: ' + (path === 'Chưa chọn' ? '(chưa chọn)' : path.split(/[\\/]/).pop()) }];
  }
  if (mode === 'camera') {
    const cam = document.getElementById('lstudioCamSel').value;
    return [{ id: 'c1', label: 'Webcam: ' + (cam || '(chưa chọn)') }];
  }
  return lstudioState.windows.map((w) => ({ id: 'w' + w.id, label: 'Cửa sổ: ' + (w.title || '(chưa chọn)') }));
}
/* Hàng nguồn cửa sổ — thêm nhiều ứng dụng để live song song. */
function lstudioRenderWinRows() {
  const box = document.getElementById('lstudioWinRows');
  if (!box) return;
  box.innerHTML = '';
  for (const w of lstudioState.windows) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    const opts = lstudioState.winOptions.includes(w.title) || !w.title
      ? lstudioState.winOptions
      : [w.title].concat(lstudioState.winOptions);
    row.innerHTML =
      '<select style="flex:1;min-width:280px" onchange="lstudioOnWinTitleChange(' + w.id + ', this.value)" title="Chọn cửa sổ ứng dụng để phát">' +
      '<option value="">— chọn cửa sổ —</option>' +
      opts.map((t) => '<option value="' + lstudioEsc(t) + '"' + (w.title === t ? ' selected' : '') + '>' + lstudioEsc(t) + '</option>').join('') +
      '</select>' +
      '<button class="btn ghost sm" onclick="lstudioRemoveWindow(' + w.id + ')" title="Bỏ nguồn cửa sổ này">✕</button>';
    box.appendChild(row);
  }
  lstudioSyncMicSrcBox();   // hộp "nhận bởi" đổi theo số nguồn cửa sổ
  lstudioSave();
}

function lstudioAddWindow() {
  lstudioSeq += 1;
  lstudioState.windows.push({ id: lstudioSeq, title: '' });
  lstudioRenderWinRows();
  lstudioRenderPlatforms();   // options "Nguồn" của nền tảng đổi theo
}

function lstudioRemoveWindow(id) {
  lstudioState.windows = lstudioState.windows.filter((w) => w.id !== id);
  lstudioRenderWinRows();
  lstudioRenderPlatforms();
}

function lstudioOnWinTitleChange(id, title) {
  const w = lstudioState.windows.find((x) => x.id === id);
  if (w) w.title = title;
  lstudioRenderWinRows();
  lstudioRenderPlatforms();
}

function lstudioRefreshWindows() {
  lstudioSetStatus('Đang dò cửa sổ ứng dụng…', false);
  try {
    lstudioNative().listWindows().then((r) => {
      if (r && r.error) { lstudioSetStatus(r.error, true); return; }
      lstudioState.winOptions = (r && r.windows) || [];
      lstudioRenderWinRows();
      lstudioRenderPlatforms();
      lstudioSetStatus('Tìm thấy ' + lstudioState.winOptions.length + ' cửa sổ', false);
    });
  } catch (e) { lstudioSetStatus(e.message, true); }
}

/* ── Lặp video: 1 lần / vô hạn / theo số lần ── */
function lstudioOnLoopModeChange() {
  const finite = document.getElementById('lstudioLoopMode').value === 'finite';
  const box = document.getElementById('lstudioLoopCountBox');
  box.style.display = finite ? 'inline-flex' : 'none';
  lstudioSave();
}
/* ═══ PHẦN 3: render nền tảng (kèm select gán nguồn) ═══ */

function lstudioRenderPlatforms() {
  const box = document.getElementById('lstudioPlatforms');
  if (!box) return;
  const defs = lstudioSourceDefs();
  box.innerHTML = '';
  for (const p of lstudioState.platforms) {
    // srcId không còn hợp lệ (nguồn bị xoá/đổi mode) → gán về nguồn đầu tiên, lộ liễu qua select.
    if (!defs.some((d) => d.id === p.srcId)) p.srcId = defs[0].id;
    const multi = defs.length > 1;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;border:1px solid rgba(128,128,128,.25);border-radius:10px';
    row.innerHTML =
      '<input type="checkbox" ' + (p.enabled !== false ? 'checked' : '') + ' onchange="lstudioTogglePlatform(' + p.id + ')" title="Bật/tắt nền tảng này">' +
      '<select style="max-width:150px" onchange="lstudioOnPresetChange(' + p.id + ', this.value)">' +
      Object.keys(lstudioPresets).map((k) =>
        '<option value="' + k + '"' + (p.preset === k ? ' selected' : '') + '>' + lstudioEsc(lstudioPresets[k].name) + '</option>').join('') +
      '</select>' +
      '<select style="max-width:190px" onchange="lstudioOnSourceChange(' + p.id + ', this.value)" title="Nguồn phát cho nền tảng này"' + (multi ? '' : ' disabled') + '>' +
      defs.map((d) => '<option value="' + lstudioEsc(d.id) + '"' + (p.srcId === d.id ? ' selected' : '') + '>' + lstudioEsc(d.label) + '</option>').join('') +
      '</select>' +
      '<input type="text" id="lstudioUrl' + p.id + '" placeholder="rtmp://server/app/" value="' + lstudioEsc(p.url) + '" style="flex:1;min-width:180px" onchange="lstudioOnUrlChange(' + p.id + ', this.value)" title="Địa chỉ RTMP server (rtmp:// hoặc rtmps://)">' +
      '<input type="password" id="lstudioKey' + p.id + '" placeholder="Stream Key" value="' + lstudioEsc(p.key) + '" style="flex:1;min-width:150px" onchange="lstudioOnKeyChange(' + p.id + ', this.value)" title="Stream Key lấy từ YouTube Studio / TikTok LIVE / Facebook — chỉ lưu trên máy bạn">' +
      '<button class="btn ghost sm" onclick="lstudioToggleKey(' + p.id + ')" title="Hiện/ẩn Stream Key">👁</button>' +
      '<button class="btn ghost sm" onclick="lstudioRemovePlatform(' + p.id + ')" title="Xoá nền tảng này">✕</button>';
    box.appendChild(row);
  }
  lstudioSave();
  lstudioUpdateBw();
}

function lstudioAddPlatform(preset) {
  const defs = lstudioSourceDefs();
  lstudioSeq += 1;
  lstudioState.platforms.push({ id: lstudioSeq, enabled: true, preset: preset || 'custom', url: (lstudioPresets[preset] || lstudioPresets.custom).url, key: '', srcId: defs[0].id });
  lstudioRenderPlatforms();
}

function lstudioRemovePlatform(id) {
  lstudioState.platforms = lstudioState.platforms.filter((p) => p.id !== id);
  lstudioRenderPlatforms();
}

function lstudioTogglePlatform(id) {
  const p = lstudioState.platforms.find((x) => x.id === id);
  if (p) p.enabled = !p.enabled;
  lstudioSave();
  lstudioUpdateBw();
}

function lstudioOnPresetChange(id, preset) {
  const p = lstudioState.platforms.find((x) => x.id === id);
  if (!p) return;
  p.preset = preset;
  p.url = (lstudioPresets[preset] || lstudioPresets.custom).url;
  lstudioRenderPlatforms();
}

function lstudioOnSourceChange(id, srcId) {
  const p = lstudioState.platforms.find((x) => x.id === id);
  if (p) { p.srcId = srcId; lstudioSave(); }
}

function lstudioOnUrlChange(id, v) {
  const p = lstudioState.platforms.find((x) => x.id === id);
  if (p) { p.url = v; lstudioSave(); }
}

function lstudioOnKeyChange(id, v) {
  const p = lstudioState.platforms.find((x) => x.id === id);
  if (p) { p.key = v; lstudioSave(); }
}

/* Hiện/ẩn Stream Key (ô key mặc định dạng password). */
function lstudioToggleKey(id) {
  const inp = document.getElementById('lstudioKey' + id);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* Tự thử lại khi mất kết nối: bật/tắt ô số lần thử. */
function lstudioOnRetryChange() {
  const on = document.getElementById('lstudioRetryOn').checked;
  document.getElementById('lstudioRetryBox').style.display = on ? 'inline-flex' : 'none';
  lstudioSave();
}

/* Cảnh báo băng thông đẩy lên: mỗi nền tảng nhận MỘT luồng đủ bitrate,
   tổng = số nền tảng bật × kbps — vượt uplink phổ thông thì lên sóng sẽ rớt. */
function lstudioUpdateBw() {
  const el = document.getElementById('lstudioBw');
  if (!el) return;
  const kbps = Number(document.getElementById('lstudioKbps').value) || 4500;
  const n = lstudioState.platforms.filter((p) => p.enabled !== false).length;
  if (!n) { el.textContent = ''; return; }
  const total = n * kbps;
  el.textContent = '⇅ Băng thông đẩy lên ước tính: ' + (total / 1000).toFixed(1) + ' Mbps (' + n + ' nền tảng × ' + kbps + ' kbps)';
  el.style.color = total >= 15000 ? 'var(--danger,#e5484d)' : total >= 8000 ? '#e8a33d' : 'var(--accent)';
}

/* Đổi bitrate → cập nhật cảnh báo băng thông. */
function lstudioOnQualityChange() {
  lstudioSave();
  lstudioUpdateBw();
}
/* ═══ PHẦN 4: mode / micro / camera ═══ */

function lstudioOnModeChange() {
  const mode = document.getElementById('lstudioMode').value;
  document.getElementById('lstudioVideoBox').style.display = mode === 'video' ? '' : 'none';
  document.getElementById('lstudioCamBox').style.display = mode === 'camera' ? '' : 'none';
  document.getElementById('lstudioWinBox').style.display = mode === 'window' ? '' : 'none';
  document.getElementById('lstudioMicBox').style.display = (mode === 'camera' || mode === 'window') ? '' : 'none';
  if (mode === 'camera') lstudioRefreshCameras();
  if (mode === 'window') {
    // Chưa có nguồn nào thì tự thêm 1 hàng cho sẵn (user bấm "+ Thêm cửa sổ" để thêm tiếp).
    if (!lstudioState.windows.length) lstudioAddWindow();
    else lstudioRenderWinRows();
    if (!lstudioState.winOptions.length) lstudioRefreshWindows();
  }
  lstudioRenderPlatforms();
  lstudioSave();
}

function lstudioPickVideo() {
  try {
    lstudioNative().pickVideo().then((r) => {
      if (r && r.path) {
        document.getElementById('lstudioVideoPath').textContent = r.path;
        lstudioSetStatus('Đã chọn video: ' + r.path.split(/[\\/]/).pop(), false);
        lstudioRenderPlatforms();
      }
    });
  } catch (e) { lstudioSetStatus(e.message, true); }
}

function lstudioFillSelect(selId, items) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— không —</option>' +
    items.map((x) => '<option value="' + lstudioEsc(x) + '">' + lstudioEsc(x) + '</option>').join('');
}

function lstudioRefreshCameras() {
  lstudioSetStatus('Đang dò webcam/micro…', false);
  try {
    lstudioNative().listCameras().then((r) => {
      if (r && r.error) { lstudioSetStatus(r.error, true); return; }
      lstudioFillSelect('lstudioCamSel', (r && r.cameras) || []);
      lstudioFillSelect('lstudioMicSel', (r && r.mics) || []);
      lstudioSetStatus('Tìm thấy ' + ((r && r.cameras) || []).length + ' webcam, ' + ((r && r.mics) || []).length + ' micro', false);
    });
  } catch (e) { lstudioSetStatus(e.message, true); }
}

/* Micro chỉ nhận bởi MỘT nguồn (dshow là exclusive) — chọn nguồn nào nhận khi có nhiều nguồn. */
function lstudioSyncMicSrcBox() {
  const mode = document.getElementById('lstudioMode').value;
  const show = mode === 'window' && lstudioState.windows.length > 1;
  const box = document.getElementById('lstudioMicSrcBox');
  box.style.display = show ? 'inline-flex' : 'none';
  if (!show) return;
  const sel = document.getElementById('lstudioMicSrcSel');
  const prev = sel.value;
  sel.innerHTML = lstudioState.windows.map((w, i) =>
    '<option value="' + i + '"' + (prev === String(i) ? ' selected' : '') + '>' + lstudioEsc('Cửa sổ: ' + (w.title || '(chưa chọn)') + ' #' + (i + 1)) + '</option>').join('');
}

function lstudioOnMicSrcChange() {
  lstudioSave();   // giữ lựa chọn qua value của select (không cần state riêng)
}
/* ═══ PHẦN 5: start/stop/progress/init ═══ */

function lstudioSetRunning(on) {
  lstudioState.running = on;
  document.getElementById('lstudioStartBtn').disabled = on;
  document.getElementById('lstudioStartBtn').style.opacity = on ? '.5' : '';
  document.getElementById('lstudioStopBtn').style.display = on ? '' : 'none';
  const stats = document.getElementById('lstudioStats');
  if (on) {
    lstudioState.startedAt = Date.now();
    stats.style.display = '';
    const rows = document.getElementById('lstudioStatRows');
    if (rows) rows.innerHTML = '';   // stats theo từng nguồn — reset khi bắt đầu phiên
    if (lstudioState.elapsedTimer) clearInterval(lstudioState.elapsedTimer);
    lstudioState.elapsedTimer = setInterval(() => {
      const s = Math.floor((Date.now() - lstudioState.startedAt) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      const head = document.getElementById('lstudioStatHead');
      if (head) head.textContent = '🔴 ĐANG PHÁT · ' + mm + ':' + ss;
    }, 1000);
  } else {
    if (lstudioState.elapsedTimer) { clearInterval(lstudioState.elapsedTimer); lstudioState.elapsedTimer = null; }
    stats.style.display = 'none';
    const head = document.getElementById('lstudioStatHead');
    if (head) head.textContent = '';
    const rows = document.getElementById('lstudioStatRows');
    if (rows) rows.innerHTML = '';
  }
}

/* Xây payload đa nguồn từ UI: sources[] + platforms[] (mỗi nền tảng gán sourceId). */
function lstudioBuildPayload() {
  const mode = document.getElementById('lstudioMode').value;
  const noAudioCap = document.getElementById('lstudioNoAudioCap').checked;
  const mic = document.getElementById('lstudioMicSel').value;
  const sources = [];
  if (mode === 'video') {
    let videoPath = document.getElementById('lstudioVideoPath').textContent;
    if (videoPath === 'Chưa chọn') videoPath = '';
    sources.push({
      id: 'v1', mode: 'video', videoPath,
      loopMode: document.getElementById('lstudioLoopMode').value,
      loopCount: Number(document.getElementById('lstudioLoopCount').value) || 3,
      noAudio: document.getElementById('lstudioNoAudioVideo').checked,
    });
  } else if (mode === 'camera') {
    sources.push({ id: 'c1', mode: 'camera', camera: document.getElementById('lstudioCamSel').value, mic, noAudio: noAudioCap });
  } else {
    const micIdx = Number(document.getElementById('lstudioMicSrcSel').value || 0);
    lstudioState.windows.forEach((w, i) => {
      sources.push({
        id: 'w' + w.id, mode: 'window', windowTitle: w.title,
        mic: i === micIdx ? mic : '',   // một micro chỉ nhận bởi MỘT nguồn (dshow exclusive)
        noAudio: noAudioCap,
      });
    });
  }
  return {
    mode,
    res: document.getElementById('lstudioRes').value,
    fps: Number(document.getElementById('lstudioFps').value),
    kbps: Number(document.getElementById('lstudioKbps').value),
    encoder: document.getElementById('lstudioEncSel').value,
    retry: {
      enabled: document.getElementById('lstudioRetryOn').checked,
      maxRetries: Number(document.getElementById('lstudioRetryMax').value) || 3,
    },
    sources,
    platforms: lstudioState.platforms.map((p) => ({
      name: (lstudioPresets[p.preset] || {}).name || 'Nền tảng',
      enabled: p.enabled !== false,
      url: p.url, key: p.key, sourceId: p.srcId || '',
    })),
  };
}

function lstudioStart() {
  let payload;
  try { payload = lstudioBuildPayload(); } catch (e) { lstudioSetStatus(e.message, true); return; }
  try {
    lstudioSetStatus('Đang khởi động FFmpeg…', false);
    lstudioNative().start(payload).then((r) => {
      if (r && r.error) { lstudioSetStatus(r.error, true); return; }
      const srcCount = (r.sources || []).length;
      lstudioSetStatus('Đã kết nối ' + srcCount + ' nguồn → ' + (r.targets || []).join(' + '), false);
      lstudioSetRunning(true);
    }).catch((e) => lstudioSetStatus(e.message || String(e), true));
  } catch (e) { lstudioSetStatus(e.message, true); }
}

function lstudioStop() {
  try {
    lstudioNative().stop().then((r) => {
      if (r && r.error) { lstudioSetStatus(r.error, true); return; }
      lstudioSetStatus('Đã yêu cầu dừng…', false);
    });
  } catch (e) { lstudioSetStatus(e.message, true); }
}

/* Đồng bộ trạng thái thật từ main (sau khi FFmpeg thoát / lỗi kết nối / nguồn kết thúc). */
function lstudioApplyStatus(s) {
  if (!s) return;
  if (s.running) {
    lstudioSetRunning(true);
    if (s.sourceRetry) {
      lstudioSetStatus('🔁 Nguồn "' + s.sourceRetry.label + '" mất kết nối — tự thử lại lần ' + s.sourceRetry.attempt + '/' + s.sourceRetry.maxRetries + ' sau ' + s.sourceRetry.delaySec + 's…', true);
      return;
    }
    if (s.platformDropped) {
      lstudioSetStatus('⚠️ Nền tảng "' + s.platformDropped.name + '" ngừng nhận luồng từ nguồn "' + s.platformDropped.sourceLabel + '" — các nền tảng khác vẫn đang phát. ' + (s.platformDropped.detail || ''), true);
      return;
    }
    const ended = s.endedSource;
    if (ended) {
      lstudioSetStatus(ended.error
        ? 'Nguồn "' + ended.label + '" dừng với lỗi: ' + ended.error
        : 'Nguồn "' + ended.label + '" đã kết thúc — còn ' + (s.remaining || '?') + ' nguồn đang phát.', !!ended.error);
    } else {
      lstudioSetStatus('Đang phát ' + (s.sources || []).length + ' nguồn → ' + (s.targets || []).join(' + '), false);
    }
  } else {
    lstudioSetRunning(false);
    if (s.error) lstudioSetStatus(s.error, true);
    else if (s.stoppedByUser) lstudioSetStatus('⏹ Đã dừng phát.', false);
    else if (s.endedSource && s.endedSource.finishedNormally) lstudioSetStatus('✅ Đã phát đủ số lần lặp — phiên kết thúc.', false);
  }
}

function lstudioInit() {
  lstudioLoad();
  lstudioOnLoopModeChange();
  if (!lstudioState.platforms.length) lstudioAddPlatform('youtube');
  else lstudioRenderPlatforms();
  lstudioOnModeChange();
  try {
    const n = lstudioNative();
    n.onProgress((p) => {
      if (!lstudioState.running || !p || !p.sourceId) return;
      const rows = document.getElementById('lstudioStatRows');
      if (!rows) return;
      let row = document.getElementById('lstudioStat-' + p.sourceId);
      if (!row) { row = document.createElement('div'); row.id = 'lstudioStat-' + p.sourceId; rows.appendChild(row); }
      const bits = [];
      if (p.fps) bits.push(p.fps + ' fps');
      if (p.bitrateKbps) bits.push(p.bitrateKbps + ' kbps');
      if (p.speed) bits.push(p.speed + 'x');
      row.textContent = '• ' + (p.sourceLabel || p.sourceId) + ': ' + (bits.join(' · ') || '…');
    });
    n.onStatus((s) => lstudioApplyStatus(s));
    // Mở lại panel/app giữa chừng: hỏi main xem có phiên phát nào đang chạy không.
    n.status().then((s) => lstudioApplyStatus(s));
  } catch (_) { /* chạy ngoài app — bỏ qua */ }
}

lstudioInit();
