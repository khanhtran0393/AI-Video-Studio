/* ── tool-ffx.js — CÔNG CỤ FFMPEG (sidebar dropdown "Công cụ FFmpeg"):
      Tách MP3/M4A/WAV / Cắt / Ghép (đổi thứ tự) / Loop / Nén / Trích Frame /
      Xoá Tiếng / Đổi Định Dạng / Ghép Nhạc / GIF / Shorts 9:16 / Đóng Phụ Đề /
      Âm Thanh Nâng Cao (loudnorm, bỏ lời, fade).
      Renderer script thường (không import/export). Mọi tên cấp đầu tiền tố ffx*
      (module system của renderer — AGENTS.md §8). Chạy qua IPC ffx:* → window.native.ffx.
      Tiến bộ: progress % thật (parse time= phía main), nút Huỷ, probe thời lượng/dung lượng
      sau khi chọn, nhập giờ dạng "90" hoặc "mm:ss"/"hh:mm:ss", ghi nhớ thư mục output,
      xác nhận ghi đè file tồn tại. Dialog chọn file THẬT do main process mở. ── */

/* Trạng thái nguồn đã chọn cho từng tool (đường dẫn file thật trên đĩa). */
var ffxState = {
  audio: '', cut: '', loop: '', loopAudio: '', join: [],
  compress: '', frames: '', mute: '', convert: '',
  music: '', musicFile: '', gif: '',
  shorts: '', subs: '', subsFile: '', audiofx: '',
};

/* Tool đang chạy (statusId) — nhận sự kiện ffx:progress để cập nhật đúng progress bar. */
var ffxActiveStatus = '';

function ffxNative() {
  const n = window.native && window.native.ffx;
  if (!n) throw new Error('Chỉ dùng được trong app AI Video Studio (thiếu bridge ffx).');
  return n;
}

function ffxSetStatus(id, text, isErr) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.style.color = isErr ? 'var(--danger, #e5484d)' : 'var(--accent)'; }
}

function ffxBaseName(p) {
  const s = String(p || '');
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i >= 0 ? s.slice(i + 1) : s;
}

function ffxStripExt(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

function ffxShort(p) { return ffxBaseName(p); }

/* Thư mục cha của đường dẫn (renderer không có module path — tự tách bằng dấu \ hoặc /). */
function ffxDirOf(p) {
  const s = String(p || '');
  const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return i > 0 ? s.slice(0, i) : s;
}

function ffxEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Parse giờ: "90" | "90.5" | "mm:ss" | "hh:mm:ss" → giây (NaN nếu sai). */
function ffxParseTime(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return NaN;
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (!m) return NaN;
  return (m[1] ? (+m[1]) * 3600 : 0) + (+m[2]) * 60 + parseFloat(m[3]);
}

/* "4832 giây" → "1:20:32" gọn cho hiển thị. */
function ffxFmtDur(sec) {
  const t = Math.round(Number(sec) || 0);
  if (t <= 0) return '';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    : m + ':' + String(s).padStart(2, '0');
}

function ffxFmtSize(bytes) {
  const b = Number(bytes) || 0;
  if (b <= 0) return '';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  return Math.round(b / 1024) + ' KB';
}

/* ── Progress UI: chèn động thanh tiến trình + nút Huỷ vào hàng hành động của tool ── */
function ffxProgressBox(statusId) {
  const status = document.getElementById(statusId);
  if (!status || !status.parentElement) return null;
  const row = status.parentElement;
  let box = row.querySelector('.ffx-prog');
  if (!box) {
    box = document.createElement('div');
    box.className = 'ffx-prog';
    box.style.cssText = 'flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px';
    box.innerHTML =
      '<div class="ffx-prog-track" style="background:var(--border,#2a2d3a);border-radius:6px;height:8px;overflow:hidden">' +
      '<div class="ffx-prog-bar" style="height:100%;width:0%;background:var(--accent);transition:width .2s"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<span class="ffx-prog-text" style="font-size:11px;color:var(--text-muted)">0%</span>' +
      '<button class="btn ghost sm" onclick="ffxCancel()">✖ Huỷ</button>' +
      '</div>';
    row.appendChild(box);
  }
  return box;
}

function ffxShowProgress(statusId) {
  const box = ffxProgressBox(statusId);
  if (!box) return;
  const bar = box.querySelector('.ffx-prog-bar');
  const text = box.querySelector('.ffx-prog-text');
  if (bar) bar.style.width = '0%';
  if (text) text.textContent = '0%';
}

function ffxUpdateProgressUI(statusId, pct, extra) {
  const box = ffxProgressBox(statusId);
  if (!box) return;
  const bar = box.querySelector('.ffx-prog-bar');
  const text = box.querySelector('.ffx-prog-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = pct + '%' + (extra || '');
}

function ffxHideProgress(statusId) {
  const status = document.getElementById(statusId);
  if (!status || !status.parentElement) return;
  const box = status.parentElement.querySelector('.ffx-prog');
  if (box) box.remove();
}

/* Đăng ký sự kiện ffx:progress MỘT LẦN — cập nhật progress bar của tool đang chạy. */
function ffxWireProgress() {
  const n = ffxNative();
  if (n.__ffxWired) return;
  n.__ffxWired = true;
  n.onProgress((s) => {
    if (!ffxActiveStatus) return;
    const pct = s && typeof s.pct === 'number' ? s.pct : 0;
    const extra = (s && s.speed ? ' · ' + s.speed + 'x' : '') + (s && s.fps ? ' · ' + Math.round(s.fps) + ' fps' : '');
    ffxUpdateProgressUI(ffxActiveStatus, pct, extra);
    ffxSetStatus(ffxActiveStatus, '⏳ Đang xử lý… (' + pct + '%' + extra + ')', false);
  });
}

async function ffxCancel() {
  try { await ffxNative().cancel(); } catch (e) { /* lỗi bridge — hiển thị qua luồng run */ }
}

/* Probe thời lượng + dung lượng, nối thêm vào span hiển thị nguồn ("name · 1:20 · 12 MB"). */
async function ffxAppendInfo(el, p) {
  if (!el) return;
  try {
    const info = await ffxNative().probe(p);
    if (info && !info.error) {
      const parts = [];
      if (info.durationSec > 0) parts.push(ffxFmtDur(info.durationSec));
      if (info.sizeBytes > 0) parts.push(ffxFmtSize(info.sizeBytes));
      if (parts.length) el.textContent = ffxBaseName(p) + ' · ' + parts.join(' · ');
    }
  } catch (e) { /* probe lỗi (file lạ) — chỉ hiện tên, không chặn */ }
}

/* Chọn 1 video nguồn cho tool (key trong ffxState + span hiển thị + status). */
async function ffxPickInput(key) {
  try {
    const n = ffxNative();
    const r = await n.pickInput();
    if (!r || r.error) { ffxSetStatus('ffx' + key.charAt(0).toUpperCase() + key.slice(1) + 'Status', 'Lỗi chọn file: ' + (r && r.error), true); return; }
    if (r.canceled || !r.path) return;
    ffxState[key] = r.path;
    const labelId = 'ffx' + key.charAt(0).toUpperCase() + key.slice(1) + 'Input';
    const el = document.getElementById(labelId);
    if (el) { el.textContent = ffxShort(r.path); el.title = r.path; ffxAppendInfo(el, r.path); }
    if (key === 'compress' && typeof ffxCompressEstimateUI === 'function') ffxCompressEstimateUI();
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chọn media bất kỳ (đổi định dạng). */
async function ffxPickMedia() {
  try {
    const n = ffxNative();
    const r = await n.pickMedia();
    if (!r || r.error) { ffxSetStatus('ffxConvertStatus', 'Lỗi chọn file: ' + (r && r.error), true); return; }
    if (r.canceled || !r.path) return;
    ffxState.convert = r.path;
    const el = document.getElementById('ffxConvertInput');
    if (el) { el.textContent = ffxShort(r.path); el.title = r.path; ffxAppendInfo(el, r.path); }
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chọn file nhạc (ghép nhạc). */
async function ffxPickMusic() {
  try {
    const n = ffxNative();
    const r = await n.pickAudio();
    if (!r || r.error) { ffxSetStatus('ffxMusicStatus', 'Lỗi chọn nhạc: ' + (r && r.error), true); return; }
    if (r.canceled || !r.path) return;
    ffxState.musicFile = r.path;
    const el = document.getElementById('ffxMusicFile');
    if (el) { el.textContent = ffxShort(r.path); el.title = r.path; ffxAppendInfo(el, r.path); }
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chọn file nhạc cho loop nhạc (mode audio của Loop). */
async function ffxPickLoopAudio() {
  try {
    const n = ffxNative();
    const r = await n.pickAudio();
    if (!r || r.error) { ffxSetStatus('ffxLoopStatus', 'Lỗi chọn nhạc: ' + (r && r.error), true); return; }
    if (r.canceled || !r.path) return;
    ffxState.loopAudio = r.path;
    const el = document.getElementById('ffxLoopAudioFile');
    if (el) { el.textContent = ffxShort(r.path); el.title = r.path; ffxAppendInfo(el, r.path); }
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chọn file phụ đề SRT/ASS (Đóng Phụ Đề). */
async function ffxPickSubFile() {
  try {
    const n = ffxNative();
    if (typeof n.pickSub !== 'function') throw new Error('Thiếu bridge ffx.pickSub — cần khởi động lại app.');
    const r = await n.pickSub();
    if (!r || r.error) { ffxSetStatus('ffxSubsStatus', 'Lỗi chọn phụ đề: ' + (r && r.error), true); return; }
    if (r.canceled || !r.path) return;
    ffxState.subsFile = r.path;
    const el = document.getElementById('ffxSubsFile');
    if (el) { el.textContent = ffxShort(r.path); el.title = r.path; }
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chọn N clip để ghép (đúng thứ tự chọn). */
async function ffxPickInputs() {
  try {
    const n = ffxNative();
    const r = await n.pickInputs();
    if (!r || r.error) { ffxSetStatus('ffxJoinStatus', 'Lỗi chọn file: ' + (r && r.error), true); return; }
    if (r.canceled || !Array.isArray(r.paths) || !r.paths.length) return;
    ffxState.join = r.paths;
    ffxRenderJoinList();
  } catch (e) {
    if (typeof novaToast === 'function') novaToast('FFmpeg: ' + (e.message || e));
  }
}

/* Chế độ Trích Frame: every/single/count/scene/grid — đổi nhãn ô nhập + hàng lưới ô. */
function ffxFramesModeUI() {
  const mode = (document.getElementById('ffxFramesMode') || {}).value || 'every';
  const label = document.getElementById('ffxFramesSecsLabel');
  const input = document.getElementById('ffxFramesSecs');
  const gridRow = document.getElementById('ffxFramesGridRow');
  if (label) label.textContent = mode === 'single' ? 'Trích tại giây' : (mode === 'count' ? 'Số ảnh muốn trích' : 'Khoảng cách (giây)');
  if (input) input.value = mode === 'single' ? '0' : (mode === 'count' ? '10' : '5');
  if (gridRow) gridRow.style.display = mode === 'grid' ? '' : 'none';
}

/* Chế độ Ghép Nhạc: mix → hiện 2 thanh volume, replace → chỉ volume nhạc. */
function ffxMusicModeUI() {
  const mode = (document.getElementById('ffxMusicMode') || {}).value || 'mix';
  const row = document.getElementById('ffxMusicVolRow');
  const vrow = document.getElementById('ffxMusicVideoVolRow');
  if (row) row.style.display = '';
  if (vrow) vrow.style.display = mode === 'mix' ? '' : 'none';
}

function ffxMusicVolUI() {
  const v = (document.getElementById('ffxMusicVol') || {}).value || '100';
  const t = document.getElementById('ffxMusicVolText');
  if (t) t.textContent = v + '%';
}

function ffxMusicVideoVolUI() {
  const v = (document.getElementById('ffxMusicVideoVol') || {}).value || '100';
  const t = document.getElementById('ffxMusicVideoVolText');
  if (t) t.textContent = v + '%';
}

/* Cắt: accurate → hiện fade in/out (copy không re-encode được nên không fade). */
function ffxCutModeUI() {
  const mode = (document.getElementById('ffxCutMode') || {}).value || 'copy';
  const row = document.getElementById('ffxCutFadeRow');
  if (row) row.style.display = mode === 'accurate' ? 'flex' : 'none';
}

/* Ghép: transition → hiện cấu hình xfade. */
function ffxJoinModeUI() {
  const mode = (document.getElementById('ffxJoinMode') || {}).value || 'copy';
  const row = document.getElementById('ffxJoinXfadeRow');
  if (row) row.style.display = mode === 'transition' ? 'flex' : 'none';
}

/* Loop: times/total/pingpong/crossfade/audio — hiện đúng ô nhập tương ứng. */
function ffxLoopModeUI() {
  const mode = (document.getElementById('ffxLoopMode') || {}).value || 'times';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('ffxLoopTimesRow', mode === 'times' || mode === 'audio');
  show('ffxLoopTotalRow', mode === 'total');
  show('ffxLoopXfadeRow', mode === 'crossfade');
  show('ffxLoopAudioRow', mode === 'audio');
}

/* Nén: crf ↔ size — hiện ô dung lượng đích + cập nhật ước lượng. */
function ffxCompressModeUI() {
  const mode = (document.getElementById('ffxCompressMode') || {}).value || 'crf';
  const row = document.getElementById('ffxCompressSizeRow');
  if (row) row.style.display = mode === 'size' ? '' : 'none';
  if (typeof ffxCompressEstimateUI === 'function') ffxCompressEstimateUI();
}

/* Preset nền tảng cho Nén: điền mode/CRF/dung lượng đích/giới hạn chiều cao. */
function ffxCompressPresetUI() {
  const v = (document.getElementById('ffxCompressPreset') || {}).value || 'custom';
  const map = {
    zalo: { mode: 'size', mb: 25, h: 0 },
    email: { mode: 'size', mb: 10, h: 720 },
    youtube: { mode: 'crf', crf: 23, h: 0 },
    tiktok: { mode: 'crf', crf: 26, h: 1080 },
    web: { mode: 'crf', crf: 30, h: 720 },
  };
  const m = map[v];
  if (!m) return;
  const mode = document.getElementById('ffxCompressMode');
  const crf = document.getElementById('ffxCompressCrf');
  const mb = document.getElementById('ffxCompressTargetMb');
  const h = document.getElementById('ffxCompressHeight');
  if (mode) mode.value = m.mode;
  if (crf) crf.value = String(m.crf);
  if (mb) mb.value = String(m.mb);
  if (h) h.value = String(m.h);
  ffxCompressModeUI();
}

/* ── Ghi nhớ thư mục output lần cuối (localStorage) ── */
function ffxRememberOutDir(p) {
  try {
    const i = Math.max(String(p).lastIndexOf('\\'), String(p).lastIndexOf('/'));
    if (i > 0) localStorage.setItem('ffxLastOutDir', String(p).slice(0, i));
  } catch (e) { /* localStorage chặn — bỏ qua */ }
}

function ffxLastOutDir() {
  try { return localStorage.getItem('ffxLastOutDir') || ''; } catch (e) { return ''; }
}

/* Thumbnail cache chung (đường dẫn + mốc giây): sinh 1 lần rồi hiển thị qua avs-media:// (bypass CSP).
   Dùng chung cho grid Ghép, danh sách đoạn Cắt và panel Kết quả gần đây. */
var ffxThumbCache = {};

function ffxThumbUrl(key, inputPath, atSec, onReady) {
  if (ffxThumbCache[key] !== undefined) return ffxThumbCache[key];
  ffxThumbCache[key] = '';
  ffxNative().thumb({ inputPath: inputPath, atSec: atSec }).then((r) => {
    if (r && r.ok && r.path) {
      ffxThumbCache[key] = 'avs-media://m/' + encodeURIComponent(r.path);
      if (typeof onReady === 'function') onReady();
    }
  }).catch(() => { /* thumbnail lỗi — ô vẫn hiển thị tên file */ });
  return '';
}

function ffxJoinThumbUrl(p) { return ffxThumbUrl('join|' + p, p, 1, ffxRenderJoinList); }

/* Render grid thẻ clip ghép: thumbnail + tên + ↑/↓ đổi thứ tự + ✕ bỏ clip. */
function ffxRenderJoinList() {
  const arr = ffxState.join;
  const cnt = document.getElementById('ffxJoinCount');
  const list = document.getElementById('ffxJoinList');
  if (cnt) cnt.textContent = arr.length ? 'Đã chọn ' + arr.length + ' clip' : 'Chưa chọn clip nào';
  if (!list) return;
  if (!arr.length) { list.innerHTML = ''; list.title = ''; return; }
  const cards = arr.map((p, i) => {
    const up = i > 0 ? '<button class="btn ghost sm" onclick="ffxJoinMove(' + i + ',-1)" title="Đưa lên">↑</button>' : '';
    const down = i < arr.length - 1 ? '<button class="btn ghost sm" onclick="ffxJoinMove(' + i + ',1)" title="Đưa xuống">↓</button>' : '';
    const thumb = ffxJoinThumbUrl(p);
    const thumbHtml = thumb ? '<img src="' + thumb + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '⏳';
    return '<div style="width:168px;border:1px solid var(--border,#333);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px">' +
      '<div style="width:100%;height:88px;background:#000;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center">' + thumbHtml + '</div>' +
      '<div style="font-size:11px;color:var(--text);word-break:break-all" title="' + ffxEsc(p) + '">' + (i + 1) + '. ' + ffxEsc(ffxBaseName(p)) + '</div>' +
      '<div style="display:flex;gap:4px;align-items:center">' + up + down +
      '<button class="btn ghost sm" onclick="ffxJoinRemove(' + i + ')" title="Bỏ clip này khỏi danh sách">✕</button>' +
      '</div></div>';
  }).join('');
  list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' + cards + '</div>';
  (async () => {
    try {
      let total = 0;
      for (const p of arr) {
        const info = await ffxNative().probe(p);
        if (info && !info.error) total += info.durationSec || 0;
      }
      list.title = 'Tổng thời lượng ~ ' + ffxFmtDur(total);
    } catch (e) { /* probe lỗi — bỏ qua */ }
  })();
}

function ffxJoinMove(i, d) {
  const a = ffxState.join;
  const j = i + d;
  if (j < 0 || j >= a.length) return;
  const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  ffxRenderJoinList();
}

/* Bỏ 1 clip khỏi danh sách ghép (giữ nguyên thứ tự các clip còn lại). */
function ffxJoinRemove(i) {
  ffxState.join.splice(i, 1);
  ffxRenderJoinList();
}

/* Chọn nơi lưu output; trả đường dẫn hoặc '' (huỷ/đổi ý khi trùng). Xác nhận GHI ĐÈ khi trùng. */
async function ffxPickOutput(defaultName, statusId) {
  const n = ffxNative();
  const r = await n.pickOutput(defaultName, ffxLastOutDir());
  if (!r || r.error) { ffxSetStatus(statusId, 'Lỗi chọn nơi lưu: ' + (r && r.error), true); return ''; }
  if (r.canceled || !r.path) return '';
  if (r.exists && !window.confirm('File "' + ffxBaseName(r.path) + '" đã tồn tại. Ghi đè lên file cũ?')) return '';
  return r.path;
}

/* Kết quả thành công — link "Mở" + "Mở thư mục" + probe output (dung lượng/thời lượng) + ghi nhớ thư mục. */
function ffxDone(statusId, r) {
  ffxActiveStatus = '';
  if (r && r.ok && r.path) {
    ffxRememberOutDir(r.path);
    if (typeof ffxHistoryPush === 'function') ffxHistoryPush(statusId, r.path);
    ffxHideProgress(statusId);
    const note = r.count > 1 ? ' (' + r.count + ' ảnh)' : '';
    const escPath = String(r.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escDir = ffxDirOf(r.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const open = ' <a href="#" onclick="ffxOpen(\'' + escPath + '\');return false" style="color:var(--accent)">Mở</a>';
    const openDir = ' <a href="#" onclick="ffxOpen(\'' + escDir + '\');return false" style="color:var(--text-muted)">Mở thư mục</a>';
    ffxSetStatus(statusId, '✅ Xong: ' + ffxShort(r.path) + note + open + openDir, false);
    // Probe output: nối thêm "· 0:16 · 12.4 MB" (Trích Frame trả outputDir → probe lỗi, bỏ qua im lặng).
    (async () => {
      try {
        const info = await ffxNative().probe(r.path);
        if (info && !info.error) {
          const parts = [];
          if (info.durationSec > 0) parts.push(ffxFmtDur(info.durationSec));
          if (info.sizeBytes > 0) parts.push(ffxFmtSize(info.sizeBytes));
          const el = document.getElementById(statusId);
          if (el && parts.length && el.querySelector('a')) el.appendChild(document.createTextNode(' · ' + parts.join(' · ')));
        }
      } catch (e) { /* probe lỗi — không chặn kết quả */ }
    })();
  } else {
    ffxHideProgress(statusId);
    ffxSetStatus(statusId, '❌ ' + ((r && r.error) || 'Thất bại'), true);
  }
}

/* Lỗi exception trong luồng run — phân biệt "Đã huỷ" vs lỗi thật. */
function ffxFail(statusId, e) {
  ffxActiveStatus = '';
  ffxHideProgress(statusId);
  const m = (e && e.message) || String(e);
  ffxSetStatus(statusId, m.indexOf('FFX_CANCELLED') === 0 ? '⚠️ Đã huỷ.' : '❌ ' + m, true);
}

async function ffxOpen(p) {
  try { if (window.native && typeof window.native.openPath === 'function') await window.native.openPath(p); } catch (e) { /* bỏ qua */ }
}

/* ── 1) Tách MP3/M4A/WAV/FLAC (+ loudnorm tuỳ chọn) ── */
async function ffxRunExtract() {
  const id = 'ffxAudioStatus';
  try {
    ffxWireProgress();
    if (!ffxState.audio) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const fmt = (document.getElementById('ffxAudioFormat') || {}).value || 'mp3';
    const br = (document.getElementById('ffxAudioBitrate') || {}).value || '192k';
    const loudnorm = !!(document.getElementById('ffxAudioLoudnorm') || {}).checked;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang tách… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.audio)) + '.' + fmt, id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().extractAudio({ inputPath: ffxState.audio, outputPath: out, bitrate: br, format: fmt, loudnorm: loudnorm }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 2) Cắt video (mode copy/accurate + fade khi accurate) ── */
async function ffxRunCut() {
  const id = 'ffxCutStatus';
  try {
    ffxWireProgress();
    if (!ffxState.cut) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const s = ffxParseTime((document.getElementById('ffxCutStart') || {}).value);
    const e2 = ffxParseTime((document.getElementById('ffxCutEnd') || {}).value);
    if (!Number.isFinite(s) || s < 0) { ffxSetStatus(id, 'Giờ bắt đầu không hợp lệ — nhập "90" hoặc "01:30"', true); return; }
    if (!Number.isFinite(e2) || e2 <= s) { ffxSetStatus(id, 'Giờ kết thúc phải LỚN HƠN giờ bắt đầu', true); return; }
    const mode = (document.getElementById('ffxCutMode') || {}).value || 'copy';
    const fade = Number((document.getElementById('ffxCutFade') || {}).value) || 0;
    if (fade < 0) { ffxSetStatus(id, 'Fade phải ≥ 0', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang cắt… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.cut)) + '-cat.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().cutVideo({ inputPath: ffxState.cut, outputPath: out, startSec: s, endSec: e2, mode: mode, fade: fade }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 2b) Cắt nhiều đoạn + ghép 1 file (cutMulti) — danh sách đoạn + dò cảnh tự sinh ── */
var ffxCutSegs = [];

function ffxCutSegRender() {
  const list = document.getElementById('ffxCutSegList');
  if (!list) return;
  if (!ffxCutSegs.length) { list.innerHTML = ''; return; }
  list.innerHTML = ffxCutSegs.map((seg, i) => {
    const d = ffxFmtDur((ffxParseTime(seg.endSec) || 0) - (ffxParseTime(seg.startSec) || 0));
    const t = ffxSegThumb(i);
    const thumbHtml = '<div id="ffxCutSegT' + i + '" style="width:84px;height:46px;background:#000;border-radius:4px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center">' + (t ? '<img src="' + t + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '') + '</div>';
    return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0">' +
      thumbHtml +
      '<span style="min-width:38px">Đoạn ' + (i + 1) + '</span>' +
      '<input type="text" id="ffxCutSegS' + i + '" value="' + ffxEsc(seg.startSec) + '" placeholder="0" style="max-width:110px" onchange="ffxCutSegSync(' + i + ',1)">' +
      '<span>→</span>' +
      '<input type="text" id="ffxCutSegE' + i + '" value="' + ffxEsc(seg.endSec) + '" placeholder="mm:ss" style="max-width:110px" onchange="ffxCutSegSync(' + i + ',2)">' +
      (d ? '<span style="color:var(--text-muted)">(' + d + ')</span>' : '') +
      '<button class="btn ghost sm" onclick="ffxCutSegDel(' + i + ')" title="Xoá đoạn">✖</button>' +
      '</div>';
  }).join('');
}

/* Thumbnail mốc bắt đầu của đoạn cắt: cache theo nguồn+giây, khi có ảnh cập nhật TRỰC TIẾP
   ô thumbnail theo id (không re-render toàn bộ danh sách để không mất ô nhập đang gõ). */
function ffxSegThumb(i) {
  const seg = ffxCutSegs[i];
  if (!seg || !ffxState.cut) return '';
  const at = ffxParseTime(seg.startSec);
  if (!Number.isFinite(at) || at < 0) return '';
  const key = 'seg|' + ffxState.cut + '|' + at;
  const cached = ffxThumbCache[key];
  if (cached !== undefined) return cached;
  ffxThumbCache[key] = '';
  const elId = 'ffxCutSegT' + i;
  ffxNative().thumb({ inputPath: ffxState.cut, atSec: at }).then((r) => {
    if (r && r.ok && r.path) {
      ffxThumbCache[key] = 'avs-media://m/' + encodeURIComponent(r.path);
      const el = document.getElementById(elId);
      if (el) el.innerHTML = '<img src="' + ffxThumbCache[key] + '" alt="" style="width:100%;height:100%;object-fit:cover">';
    }
  }).catch(() => { /* thumbnail lỗi — ô vẫn trống */ });
  return '';
}

/* Đồng bộ ô nhập về state (1 = start, 2 = end) — không dùng oninput để tránh parse mỗi phím. */
function ffxCutSegSync(i, which) {
  const el = document.getElementById((which === 1 ? 'ffxCutSegS' : 'ffxCutSegE') + i);
  if (el && ffxCutSegs[i]) { ffxCutSegs[i][which === 1 ? 'startSec' : 'endSec'] = el.value; ffxCutSegRender(); }
}

function ffxCutSegAdd(s, e2) {
  ffxCutSegs.push({ startSec: s == null ? '0' : String(s), endSec: e2 == null ? '' : String(e2) });
  ffxCutSegRender();
}

function ffxCutSegDel(i) { ffxCutSegs.splice(i, 1); ffxCutSegRender(); }

/* Dò cảnh chuyển → sinh các đoạn giữa các mốc (đoạn cuối đóng bằng thời lượng file). */
async function ffxCutDetectScenes() {
  const id = 'ffxCutMultiStatus';
  try {
    if (!ffxState.cut) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    ffxSetStatus(id, '🎬 Đang dò cảnh…', false);
    const sc = await ffxNative().scenes({ inputPath: ffxState.cut });
    if (!sc || sc.error) { ffxSetStatus(id, 'Lỗi dò cảnh: ' + (sc && sc.error), true); return; }
    const info = await ffxNative().probe(ffxState.cut);
    const dur = info && !info.error ? info.durationSec : 0;
    const pts = (sc.times || []).slice();
    ffxCutSegs = [];
    for (let i = 0; i < pts.length; i++) {
      const e2 = i + 1 < pts.length ? pts[i + 1] : (dur > pts[i] ? dur : 0);
      if (e2 > pts[i]) ffxCutSegs.push({ startSec: String(pts[i]), endSec: String(e2) });
    }
    if (!ffxCutSegs.length) { ffxSetStatus(id, 'Không sinh được đoạn nào — thêm đoạn thủ công', true); return; }
    ffxCutSegRender();
    ffxSetStatus(id, '🎬 Đã sinh ' + ffxCutSegs.length + ' đoạn — sửa/xoá rồi bấm "Cắt & ghép các đoạn"', false);
  } catch (e) { ffxSetStatus(id, 'Lỗi dò cảnh: ' + (e.message || e), true); }
}

async function ffxRunCutMulti() {
  const id = 'ffxCutMultiStatus';
  try {
    ffxWireProgress();
    if (!ffxState.cut) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    if (!ffxCutSegs.length) { ffxSetStatus(id, 'Chưa có đoạn nào — bấm "Thêm đoạn" hoặc "Dò cảnh"', true); return; }
    const mode = (document.getElementById('ffxCutMode') || {}).value || 'copy';
    const segments = [];
    for (let i = 0; i < ffxCutSegs.length; i++) {
      const s = ffxParseTime(ffxCutSegs[i].startSec);
      const e2 = ffxParseTime(ffxCutSegs[i].endSec);
      if (!Number.isFinite(s) || s < 0 || !Number.isFinite(e2) || e2 <= s) {
        ffxSetStatus(id, 'Đoạn ' + (i + 1) + ': giờ không hợp lệ (kết thúc phải LỚN HƠN bắt đầu)', true); return;
      }
      segments.push({ startSec: s, endSec: e2 });
    }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang cắt ' + segments.length + ' đoạn… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.cut)) + '-daot.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().cutMulti({ inputPath: ffxState.cut, outputPath: out, segments: segments, mode: mode }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 3) Ghép video (copy / auto chuẩn hoá / xfade) ── */
async function ffxRunJoin() {
  const id = 'ffxJoinStatus';
  try {
    ffxWireProgress();
    if (ffxState.join.length < 2) { ffxSetStatus(id, 'Cần chọn ít nhất 2 clip để ghép', true); return; }
    const mode = (document.getElementById('ffxJoinMode') || {}).value || 'copy';
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang ghép… (0%)', false);
    const out = await ffxPickOutput('ghep-video.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    let r;
    if (mode === 'transition') {
      const dur = Number((document.getElementById('ffxJoinXfadeDur') || {}).value) || 0.5;
      const type = (document.getElementById('ffxJoinXfadeType') || {}).value || 'fade';
      if (dur < 0.2 || dur > 5) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Độ dài chuyển cảnh phải 0.2–5 giây', true); return; }
      r = await ffxNative().concatTransition({ inputPaths: ffxState.join, outputPath: out, transition: type, durationSec: dur });
    } else if (mode === 'auto') {
      r = await ffxNative().concatAuto({ inputPaths: ffxState.join, outputPath: out });
    } else {
      try {
        r = await ffxNative().concatVideos({ inputPaths: ffxState.join, outputPath: out });
      } catch (err) {
        // Clip khác chuẩn → hỏi chuyển sang Auto-hoà (re-encode) thay vì fail chung chung.
        if (err && err.message && err.message.indexOf('FFX_JOIN_MISMATCH') === 0 &&
          window.confirm('Các clip KHÔNG cùng chuẩn nên không ghép trực tiếp được:\n\n' +
            err.message.replace('FFX_JOIN_MISMATCH: ', '') +
            '\n\nChuyển sang chế độ Auto-hoà chuẩn (re-encode về chiều cao/fps chung thấp nhất)?')) {
          ffxSetStatus(id, '⏳ Auto-hoà chuẩn… (0%)', false);
          r = await ffxNative().concatAuto({ inputPaths: ffxState.join, outputPath: out });
        } else { throw err; }
      }
    }
    ffxDone(id, r);
  } catch (e) { ffxFail(id, e); }
}

/* ── 4) Loop video (times/total/pingpong/crossfade) ── */
async function ffxRunLoop() {
  const id = 'ffxLoopStatus';
  try {
    ffxWireProgress();
    const mode = (document.getElementById('ffxLoopMode') || {}).value || 'times';
    if (mode !== 'audio' && !ffxState.loop) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang loop… (0%)', false);
    let out, r;
    if (mode === 'audio') {
      // Loop NHẠC: nguồn = file nhạc đã chọn, không dùng video nguồn.
      if (!ffxState.loopAudio) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Chưa chọn file nhạc — bấm "Chọn nhạc" ở mục Lặp NHẠC', true); return; }
      const targetRaw = String((document.getElementById('ffxLoopAudioTarget') || {}).value || '').trim();
      const times = Number((document.getElementById('ffxLoopTimes') || {}).value) || 0;
      let target = null;
      if (targetRaw !== '') {
        target = ffxParseTime(targetRaw);
        if (!Number.isFinite(target) || target <= 0) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Tổng thời lượng cần phải hợp lệ ("180" hoặc "03:00")', true); return; }
      } else if (!Number.isInteger(times) || times < 2) {
        ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Nhập "Tổng thời lượng cần" HOẶC "Số lần lặp" ≥ 2', true); return;
      }
      const srcExt = (ffxBaseName(ffxState.loopAudio).lastIndexOf('.') >= 0 ? ffxBaseName(ffxState.loopAudio).split('.').pop() : '').toLowerCase();
      const outExt = ['mp3', 'm4a', 'wav', 'flac'].indexOf(srcExt) >= 0 ? srcExt : 'mp3';
      out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loopAudio)) + '-loop.' + outExt, id);
      if (out) {
        ffxSetStatus(id, '⏳ Đang loop nhạc… (0%)', false);
        r = await ffxNative().loopAudio(target !== null
          ? { inputPath: ffxState.loopAudio, outputPath: out, targetSec: target }
          : { inputPath: ffxState.loopAudio, outputPath: out, times: times });
      }
    } else if (mode === 'total') {
      const total = ffxParseTime((document.getElementById('ffxLoopTotal') || {}).value);
      if (!Number.isFinite(total) || total <= 0) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Nhập tổng thời lượng hợp lệ ("60" hoặc "01:00")', true); return; }
      out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loop)) + '-total.mp4', id);
      if (out) r = await ffxNative().loopVideo({ inputPath: ffxState.loop, outputPath: out, mode: 'total', targetSec: total });
    } else if (mode === 'pingpong') {
      // ping-pong 1 chu kỳ xuôi→ngược (times=2); backend giới hạn clip ≤ 120s
      out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loop)) + '-pingpong.mp4', id);
      if (out) r = await ffxNative().loopPingPong({ inputPath: ffxState.loop, outputPath: out, times: 2 });
    } else if (mode === 'crossfade') {
      const xf = Number((document.getElementById('ffxLoopXfadeSec') || {}).value) || 0.5;
      if (xf < 0.2 || xf > 5) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Crossfade phải 0.2–5 giây', true); return; }
      out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loop)) + '-xloop.mp4', id);
      if (out) r = await ffxNative().loopCrossfade({ inputPath: ffxState.loop, outputPath: out, times: 2, fadeDur: xf });
    } else {
      const times = Number((document.getElementById('ffxLoopTimes') || {}).value);
      if (!Number.isInteger(times) || times < 2) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, 'Số lần lặp phải là số nguyên ≥ 2', true); return; }
      out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loop)) + '-loop.mp4', id);
      if (out) r = await ffxNative().loopVideo({ inputPath: ffxState.loop, outputPath: out, times: times });
    }
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, r);
  } catch (e) { ffxFail(id, e); }
}

/* ── 5) Nén video (CRF / 2-pass target size + GPU) ── */
async function ffxRunCompress() {
  const id = 'ffxCompressStatus';
  try {
    ffxWireProgress();
    if (!ffxState.compress) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const mode = (document.getElementById('ffxCompressMode') || {}).value || 'crf';
    const useGpu = !!(document.getElementById('ffxCompressGpu') || {}).checked;
    const payload = { inputPath: ffxState.compress, outputPath: '', mode: mode, useGpu: useGpu };
    if (mode === 'size') {
      const mb = Number((document.getElementById('ffxCompressTargetMb') || {}).value);
      if (!Number.isFinite(mb) || mb < 1) { ffxSetStatus(id, 'Nhập dung lượng đích ≥ 1 MB', true); return; }
      payload.targetMB = mb;
    } else {
      payload.crf = Number((document.getElementById('ffxCompressCrf') || {}).value) || 28;
    }
    payload.maxHeight = Number((document.getElementById('ffxCompressHeight') || {}).value) || 0;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, mode === 'size' ? '⏳ Đang nén 2-pass… (0%)' : '⏳ Đang nén… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.compress)) + '-nen.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    payload.outputPath = out;
    ffxDone(id, await ffxNative().compressVideo(payload));
  } catch (e) { ffxFail(id, e); }
}

/* ── 5b) Nén hàng loạt: N video → chạy tuần tự cùng cấu hình → thư mục con mới (không ghi đè file cũ). ── */
async function ffxBatchCompress() {
  const id = 'ffxCompressStatus';
  try {
    ffxWireProgress();
    const n = ffxNative();
    const r = await n.pickInputs();
    if (!r || r.error) { ffxSetStatus(id, 'Lỗi chọn file: ' + (r && r.error), true); return; }
    if (r.canceled || !Array.isArray(r.paths) || !r.paths.length) return;
    const dir = window.native && typeof window.native.pickFolder === 'function' ? await window.native.pickFolder() : null;
    if (!dir || dir.error || dir.canceled || !dir.path) return;
    const mode = (document.getElementById('ffxCompressMode') || {}).value || 'crf';
    const useGpu = !!(document.getElementById('ffxCompressGpu') || {}).checked;
    const cfg = { mode: mode, useGpu: useGpu };
    if (mode === 'size') {
      const mb = Number((document.getElementById('ffxCompressTargetMb') || {}).value);
      if (!Number.isFinite(mb) || mb < 1) { ffxSetStatus(id, 'Nhập dung lượng đích ≥ 1 MB', true); return; }
      cfg.targetMB = mb;
    } else {
      cfg.crf = Number((document.getElementById('ffxCompressCrf') || {}).value) || 28;
    }
    cfg.maxHeight = Number((document.getElementById('ffxCompressHeight') || {}).value) || 0;
    const outDir = dir.path.replace(/[\\/]+$/, '') + '/nen-hang-loat-' + Date.now();
    const files = r.paths;
    ffxActiveStatus = id; ffxShowProgress(id);
    for (let i = 0; i < files.length; i++) {
      const src = files[i];
      const outPath = outDir + '/' + ffxStripExt(ffxBaseName(src)) + '-nen.mp4';
      ffxSetStatus(id, '⏳ [' + (i + 1) + '/' + files.length + '] ' + ffxShort(src) + '… (0%)', false);
      ffxUpdateProgressUI(id, Math.round((i * 100) / files.length));
      const res = await n.compressVideo(Object.assign({ inputPath: src, outputPath: outPath }, cfg));
      if (!res || res.ok !== true) {
        throw new Error('File ' + (i + 1) + '/' + files.length + ' (' + ffxBaseName(src) + '): ' + ((res && res.error) || 'thất bại'));
      }
    }
    ffxActiveStatus = '';
    ffxHideProgress(id);
    const escDir = outDir.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    ffxSetStatus(id, '✅ Đã nén xong ' + files.length + ' file → ' +
      '<a href="#" onclick="ffxOpen(\'' + escDir + '\');return false" style="color:var(--accent)">Mở thư mục</a>', false);
  } catch (e) { ffxFail(id, e); }
}

/* ── 6) Trích frame (every/single/count/scene/grid + timestamp) ── */
async function ffxRunFrames() {
  const id = 'ffxFramesStatus';
  try {
    ffxWireProgress();
    if (!ffxState.frames) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const mode = (document.getElementById('ffxFramesMode') || {}).value || 'every';
    const fmt = (document.getElementById('ffxFramesFormat') || {}).value || 'png';
    const stamp = !!(document.getElementById('ffxFramesStamp') || {}).checked;
    const raw = Number((document.getElementById('ffxFramesSecs') || {}).value);
    if (!Number.isFinite(raw) || raw < 0) { ffxSetStatus(id, mode === 'single' ? 'Nhập giây trích ≥ 0' : (mode === 'count' ? 'Số ảnh phải ≥ 1' : 'Khoảng cách giây phải ≥ 0.1'), true); return; }
    if (mode === 'every' && raw < 0.1) { ffxSetStatus(id, 'Khoảng cách giây phải ≥ 0.1', true); return; }
    if (mode === 'count' && (!Number.isInteger(raw) || raw < 1)) { ffxSetStatus(id, 'Số ảnh phải là số nguyên ≥ 1', true); return; }
    ffxSetStatus(id, '📁 Chọn thư mục lưu ảnh…', false);
    const n = ffxNative();
    const dir = window.native && typeof window.native.pickFolder === 'function' ? await window.native.pickFolder() : null;
    if (!dir || dir.error || dir.canceled || !dir.path) { ffxSetStatus(id, '', false); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang trích… (0%)', false);
    const payload = { inputPath: ffxState.frames, outputDir: dir.path, mode: mode, format: fmt, stamp: stamp };
    if (mode === 'single') payload.atSec = raw;
    else if (mode === 'count') payload.count = raw;
    else if (mode === 'every') payload.everySec = raw;
    else if (mode === 'grid') {
      // grid = 1 ảnh contact-sheet: cols (2–10) + tổng frame count (2–100), rows tự tính
      const cols = Math.min(10, Math.max(2, Number((document.getElementById('ffxFramesGridCols') || {}).value) || 4));
      const rows = Math.min(10, Math.max(1, Number((document.getElementById('ffxFramesGridRows') || {}).value) || 4));
      payload.cols = cols;
      payload.count = Math.min(100, Math.max(2, cols * rows));
    } else if (mode === 'scene') payload.threshold = (raw > 0 && raw < 1) ? raw : 0.3;
    ffxDone(id, await n.extractFrames(payload));
  } catch (e) { ffxFail(id, e); }
}

/* Xoá tiếng: tick "chỉ xoá trong khoảng" → hiện 2 ô Từ/Đến. */
function ffxMuteRangeUI() {
  const on = !!(document.getElementById('ffxMuteRange') || {}).checked;
  const row = document.getElementById('ffxMuteRangeRow');
  if (row) row.style.display = on ? 'flex' : 'none';
}

/* ── 7) Xoá tiếng (toàn bộ | chỉ câm trong khoảng Từ→Đến) ── */
async function ffxRunMute() {
  const id = 'ffxMuteStatus';
  try {
    ffxWireProgress();
    if (!ffxState.mute) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const payload = { inputPath: ffxState.mute, outputPath: '' };
    if (!!(document.getElementById('ffxMuteRange') || {}).checked) {
      const s = ffxParseTime((document.getElementById('ffxMuteRangeStart') || {}).value);
      const e2 = ffxParseTime((document.getElementById('ffxMuteRangeEnd') || {}).value);
      if (!Number.isFinite(s) || s < 0 || !Number.isFinite(e2) || e2 <= s) {
        ffxSetStatus(id, 'Khoảng xoá tiếng không hợp lệ — cần Từ < Đến ("5" hoặc "00:05")', true); return;
      }
      payload.rangeStartSec = s;
      payload.rangeEndSec = e2;
    }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang xử lý… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.mute)) + '-cam.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    payload.outputPath = out;
    ffxDone(id, await ffxNative().removeAudio(payload));
  } catch (e) { ffxFail(id, e); }
}

/* Đích là audio → ẩn các tuỳ chọn video (codec/GPU/độ phân giải/fps/sub). */
function ffxConvertTargetUI() {
  const target = (document.getElementById('ffxConvertTarget') || {}).value || 'mp4';
  const isAudio = target === 'mp3' || target === 'm4a' || target === 'wav' || target === 'flac' || target === 'ogg';
  const row = document.getElementById('ffxConvertVideoOpts');
  if (row) row.style.display = isAudio ? 'none' : 'flex';
}

/* ── 8) Đổi định dạng (codec h264/h265 + GPU + scale/fps + giữ sub) ── */
async function ffxRunConvert() {
  const id = 'ffxConvertStatus';
  try {
    ffxWireProgress();
    if (!ffxState.convert) { ffxSetStatus(id, 'Chưa chọn media nguồn', true); return; }
    const target = (document.getElementById('ffxConvertTarget') || {}).value || 'mp4';
    const isAudio = target === 'mp3' || target === 'm4a' || target === 'wav' || target === 'flac' || target === 'ogg';
    const payload = { inputPath: ffxState.convert, outputPath: '' };
    if (!isAudio) {
      payload.codec = (document.getElementById('ffxConvertCodec') || {}).value || 'h264';
      payload.useGpu = !!(document.getElementById('ffxConvertGpu') || {}).checked;
      payload.height = Number((document.getElementById('ffxConvertHeight') || {}).value) || 0;
      payload.fps = Number((document.getElementById('ffxConvertFps') || {}).value) || 0;
      payload.keepSubs = !!(document.getElementById('ffxConvertSubs') || {}).checked;
    }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang chuyển… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.convert)) + '.' + target, id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    payload.outputPath = out;
    ffxDone(id, await ffxNative().convertMedia(payload));
  } catch (e) { ffxFail(id, e); }
}

/* ── 9) Ghép nhạc (mix 2 volume / replace + offset + fade + loop + loudnorm) ── */
async function ffxRunMusic() {
  const id = 'ffxMusicStatus';
  try {
    ffxWireProgress();
    if (!ffxState.music) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    if (!ffxState.musicFile) { ffxSetStatus(id, 'Chưa chọn file nhạc', true); return; }
    const mode = (document.getElementById('ffxMusicMode') || {}).value || 'mix';
    const volPct = Number((document.getElementById('ffxMusicVol') || {}).value);
    const musicVolume = Number.isFinite(volPct) ? volPct / 100 : 1;
    const vvPct = Number((document.getElementById('ffxMusicVideoVol') || {}).value);
    const videoVolume = Number.isFinite(vvPct) ? vvPct / 100 : 1;
    const startSec = Number((document.getElementById('ffxMusicStart') || {}).value) || 0;
    const fadeInSec = Number((document.getElementById('ffxMusicFadeIn') || {}).value) || 0;
    const fadeOutSec = Number((document.getElementById('ffxMusicFadeOut') || {}).value) || 0;
    if (startSec < 0 || fadeInSec < 0 || fadeOutSec < 0) { ffxSetStatus(id, 'Giây offset/fade phải ≥ 0', true); return; }
    // Vùng video nghe nhạc (tuỳ chọn): điền cả 2 = vùng [từ, đến]; chỉ Từ = đến hết; chỉ Đến = lỗi.
    const playStartRaw = String((document.getElementById('ffxMusicPlayStart') || {}).value || '').trim();
    const playEndRaw = String((document.getElementById('ffxMusicPlayEnd') || {}).value || '').trim();
    const payload = {
      inputPath: ffxState.music, musicPath: ffxState.musicFile, outputPath: '',
      mode: mode, musicVolume: musicVolume, videoVolume: videoVolume,
      musicStartSec: startSec, fadeInSec: fadeInSec, fadeOutSec: fadeOutSec,
      loopMusic: !!(document.getElementById('ffxMusicLoop') || {}).checked,
      normalizeMusic: !!(document.getElementById('ffxMusicNorm') || {}).checked,
    };
    if (playStartRaw !== '' || playEndRaw !== '') {
      const ps = playStartRaw !== '' ? ffxParseTime(playStartRaw) : 0;
      const pe = playEndRaw !== '' ? ffxParseTime(playEndRaw) : NaN;
      if (playStartRaw === '' || (!Number.isFinite(ps) || ps < 0)) { ffxSetStatus(id, 'Vùng nghe nhạc: "Từ" không hợp lệ ("10" hoặc "00:10")', true); return; }
      if (playEndRaw !== '' && (!Number.isFinite(pe) || pe <= ps)) { ffxSetStatus(id, 'Vùng nghe nhạc: "Đến" phải LỚN HƠN "Từ"', true); return; }
      payload.playStartSec = ps;
      if (playEndRaw !== '') payload.playEndSec = pe;
    }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang ghép nhạc… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.music)) + '-nhac.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    payload.outputPath = out;
    ffxDone(id, await ffxNative().addMusic(payload));
  } catch (e) { ffxFail(id, e); }
}

/* ── 10) Xuất GIF (loop N / màu / dither / slideshow; từ-đến nhập "90" hoặc mm:ss) ── */
async function ffxRunGif() {
  const id = 'ffxGifStatus';
  try {
    ffxWireProgress();
    if (!ffxState.gif) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const width = Number((document.getElementById('ffxGifWidth') || {}).value) || 480;
    const fps = Number((document.getElementById('ffxGifFps') || {}).value) || 12;
    const loopCount = Number((document.getElementById('ffxGifLoop') || {}).value);
    const maxColors = Number((document.getElementById('ffxGifColors') || {}).value) || 256;
    const dither = (document.getElementById('ffxGifDither') || {}).value || 'sierra2_4a';
    const slideshow = !!(document.getElementById('ffxGifSlideshow') || {}).checked;
    const startRaw = (document.getElementById('ffxGifStart') || {}).value;
    const endRaw = (document.getElementById('ffxGifEnd') || {}).value;
    const s = String(startRaw).trim() === '' ? 0 : ffxParseTime(startRaw);
    const e2 = String(endRaw).trim() === '' ? null : ffxParseTime(endRaw);
    if (!Number.isFinite(s) || s < 0) { ffxSetStatus(id, 'Giờ bắt đầu không hợp lệ — nhập "90" hoặc "01:30"', true); return; }
    if (e2 !== null && (!Number.isFinite(e2) || e2 <= s)) { ffxSetStatus(id, 'Giờ kết thúc phải LỚN HƠN giờ bắt đầu', true); return; }
    if (slideshow) {
      // Pre-check lộ liễu: GIF slideshow trên video 1 cảnh liền mạch → 0 frame ("Output file is empty").
      // Chặn sớm trước khi chạy để người dùng biết rõ nguyên nhân (Luật 10 — không để fail chung chung).
      ffxSetStatus(id, '🎬 Kiểm tra cảnh chuyển cho slideshow…', false);
      const sc = await ffxNative().scenes({ inputPath: ffxState.gif });
      if (!sc || sc.error) { ffxSetStatus(id, 'Lỗi dò cảnh: ' + (sc && sc.error), true); return; }
      if ((sc.times || []).length < 2) {
        ffxSetStatus(id, '❌ Video nguồn KHÔNG có cảnh chuyển (1 cảnh liền mạch) — GIF slideshow sẽ rỗng. Bỏ tick slideshow hoặc chọn video nhiều cảnh.', true);
        return;
      }
    }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang xuất GIF… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.gif)) + '.gif', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().toGif({
      inputPath: ffxState.gif, outputPath: out, width: width, fps: fps, startSec: s, endSec: e2,
      loopCount: Number.isFinite(loopCount) ? loopCount : 0, maxColors: maxColors, dither: dither, slideshow: slideshow,
    }));
  } catch (e) { ffxFail(id, e); }
}

/* ═══ 11) KẾT QUẢ GẦN ĐÂY & HÀNG ĐỢI & KÉO-THẢ ═══ */

/* Nguồn từ đường dẫn bất kỳ (drag-drop): state + span hiển thị + probe info. */
function ffxSetInput(key, p, labelId) {
  ffxState[key] = p;
  const el = document.getElementById(labelId || ('ffx' + key.charAt(0).toUpperCase() + key.slice(1) + 'Input'));
  if (el) { el.textContent = ffxShort(p); el.title = p; ffxAppendInfo(el, p); }
  if (key === 'compress' && typeof ffxCompressEstimateUI === 'function') ffxCompressEstimateUI();
}

/* ── Nén: ước lượng dung lượng đầu ra (probe nguồn 1 lần + hệ số theo CRF/chiều cao) ──
   Chỉ là ƯỚC LƯỢNG THÔ để định hướng trước khi bấm nén — mode "size" 2-pass mới bám sát đích. */
var ffxCompressInfo = null;

async function ffxCompressEstimateUI() {
  const el = document.getElementById('ffxCompressEst');
  if (!el) return;
  const p = ffxState.compress;
  if (!p) { el.textContent = ''; return; }
  try {
    if (!ffxCompressInfo || ffxCompressInfo.path !== p) {
      const info = await ffxNative().probe(p);
      if (!info || info.error) { el.textContent = ''; return; }
      ffxCompressInfo = { path: p, sizeBytes: info.sizeBytes || 0, height: (info.video && info.video.height) || 0 };
    }
    const mode = (document.getElementById('ffxCompressMode') || {}).value || 'crf';
    const srcMB = ffxCompressInfo.sizeBytes / 1048576;
    let estMB = 0;
    if (mode === 'size') {
      estMB = Number((document.getElementById('ffxCompressTargetMb') || {}).value) || 0;
    } else {
      const crf = Number((document.getElementById('ffxCompressCrf') || {}).value) || 28;
      const mh = Number((document.getElementById('ffxCompressHeight') || {}).value) || 0;
      const hScale = (mh > 0 && ffxCompressInfo.height > 0) ? Math.min(1, mh / ffxCompressInfo.height) : 1;
      // Heuristic: CRF 28 ≈ 0.35× nguồn, mỗi -6 CRF ≈ ×2 bitrate; giảm chiều cao → ×(h/H)².
      estMB = srcMB * 0.35 * Math.pow(2, (28 - crf) / 6) * hScale * hScale;
    }
    el.textContent = (srcMB > 0 && estMB > 0) ? '≈ ' + estMB.toFixed(1) + ' MB (ước lượng thô — tuỳ nội dung)' : '';
  } catch (e) { el.textContent = ''; }
}

/* ── Kết quả gần đây (localStorage, tối đa 30 — chỉ lưu đường dẫn, KHÔNG xoá file đĩa) ── */
var FFX_VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts', 'gif'];

function ffxToolName(statusId) {
  const map = {
    ffxAudioStatus: 'Tách audio', ffxCutStatus: 'Cắt video', ffxCutMultiStatus: 'Cắt nhiều đoạn',
    ffxJoinStatus: 'Ghép video', ffxLoopStatus: 'Loop', ffxCompressStatus: 'Nén',
    ffxFramesStatus: 'Trích frame', ffxMuteStatus: 'Xoá tiếng', ffxConvertStatus: 'Đổi định dạng',
    ffxMusicStatus: 'Ghép nhạc', ffxGifStatus: 'Xuất GIF', ffxHistoryStatus: 'Tách MP3 nhanh',
  };
  return map[statusId] || 'FFmpeg';
}

function ffxHistoryLoad() {
  try { const v = JSON.parse(localStorage.getItem('ffxHistoryV1') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

function ffxHistorySave(list) {
  try { localStorage.setItem('ffxHistoryV1', JSON.stringify(list.slice(0, 30))); } catch (e) { /* localStorage chặn — bỏ qua */ }
}

function ffxHistoryPush(statusId, p) {
  if (!p) return;
  const list = ffxHistoryLoad();
  list.unshift({ ts: Date.now(), tool: String(statusId || ''), path: String(p) });
  ffxHistorySave(list);
  ffxHistoryRender();
}

function ffxHistoryThumb(p, i) {
  const cached = ffxThumbCache['h|' + p];
  if (cached !== undefined) return cached;
  ffxThumbCache['h|' + p] = '';
  ffxNative().thumb({ inputPath: p, atSec: 0.5 }).then((r) => {
    if (r && r.ok && r.path) {
      ffxThumbCache['h|' + p] = 'avs-media://m/' + encodeURIComponent(r.path);
      const el = document.getElementById('ffxHistoryThumb' + i);
      if (el) el.innerHTML = '<img src="' + ffxThumbCache['h|' + p] + '" alt="" style="width:100%;height:100%;object-fit:cover">';
    }
  }).catch(() => { /* thumbnail lỗi — ô vẫn trống */ });
  return '';
}

function ffxHistoryRender() {
  const box = document.getElementById('ffxHistoryList');
  if (!box) return;
  const list = ffxHistoryLoad();
  if (!list.length) {
    box.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Chưa có kết quả nào — các file xuất ra từ Công cụ FFmpeg sẽ tự xuất hiện ở đây (lưu tối đa 30 dòng).</div>';
    return;
  }
  box.innerHTML = list.map((it, i) => {
    const name = ffxBaseName(it.path);
    const ext = (name.lastIndexOf('.') >= 0 ? name.split('.').pop() : '').toLowerCase();
    const isVideo = FFX_VIDEO_EXT.indexOf(ext) >= 0;
    const thumb = isVideo ? ffxHistoryThumb(it.path, i) : '';
    const mp3Btn = (isVideo && ext !== 'gif') ? '<button class="btn ghost sm" onclick="ffxHistoryMp3(' + i + ')" title="Tách MP3 nhanh 192k lưu cạnh file">🎵 MP3</button>' : '';
    return '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border,#333);border-radius:8px;padding:6px 8px;margin:4px 0">' +
      '<div id="ffxHistoryThumb' + i + '" style="width:84px;height:46px;background:#000;border-radius:4px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center">' + (thumb ? '<img src="' + thumb + '" alt="" style="width:100%;height:100%;object-fit:cover">' : (isVideo ? '⏳' : '🎵')) + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;word-break:break-all" title="' + ffxEsc(it.path) + '">' + ffxEsc(name) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">' + ffxEsc(ffxToolName(it.tool)) + ' · ' + new Date(it.ts).toLocaleString() + '</div>' +
      '</div>' +
      '<button class="btn ghost sm" onclick="ffxHistoryOpen(' + i + ')">Mở</button>' +
      mp3Btn +
      '<button class="btn ghost sm" onclick="ffxHistoryRemove(' + i + ')" title="Xoá khỏi danh sách (không xoá file)">✕</button>' +
      '</div>';
  }).join('');
}

function ffxHistoryOpen(i) {
  const it = ffxHistoryLoad()[i];
  if (it) ffxOpen(it.path);
}

function ffxHistoryRemove(i) {
  const list = ffxHistoryLoad();
  list.splice(i, 1);
  ffxHistorySave(list);
  ffxHistoryRender();
}

function ffxHistoryClear() {
  if (!window.confirm('Xoá toàn bộ danh sách Kết quả gần đây? (chỉ xoá khỏi danh sách — KHÔNG xoá file trên đĩa)')) return;
  ffxHistorySave([]);
  ffxHistoryRender();
}

/* Tách MP3 nhanh 1 chạm từ Kết quả gần đây (192k, chọn nơi lưu qua dialog có xác nhận ghi đè). */
async function ffxHistoryMp3(i) {
  const id = 'ffxHistoryStatus';
  try {
    const it = ffxHistoryLoad()[i];
    if (!it) return;
    ffxWireProgress();
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(it.path)) + '.mp3', id);
    if (!out) return;
    ffxActiveStatus = id;
    ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang tách MP3… (0%)', false);
    ffxDone(id, await ffxNative().extractAudio({ inputPath: it.path, outputPath: out, bitrate: '192k', format: 'mp3' }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 11) Shorts 9:16 (nền mờ | cắt giữa) ── */
async function ffxRunShorts() {
  const id = 'ffxShortsStatus';
  try {
    ffxWireProgress();
    if (!ffxState.shorts) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const mode = (document.getElementById('ffxShortsMode') || {}).value || 'blur';
    const gpu = !!(document.getElementById('ffxShortsGpu') || {}).checked;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang dựng 9:16… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.shorts)) + (mode === 'crop' ? '-crop916.mp4' : '-shorts916.mp4'), id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().shortsVideo({ inputPath: ffxState.shorts, outputPath: out, mode: mode, useGpu: gpu }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 12) Đóng phụ đề cứng (SRT/ASS) ── */
async function ffxRunSubs() {
  const id = 'ffxSubsStatus';
  try {
    ffxWireProgress();
    if (!ffxState.subs) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    if (!ffxState.subsFile) { ffxSetStatus(id, 'Chưa chọn file phụ đề .srt / .ass', true); return; }
    const size = Number((document.getElementById('ffxSubsSize') || {}).value) || 24;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang đóng phụ đề… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.subs)) + '-phude.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().burnSubs({ inputPath: ffxState.subs, subPath: ffxState.subsFile, outputPath: out, fontSize: size }));
  } catch (e) { ffxFail(id, e); }
}

/* Đuôi file xuất âm thanh: giữ đuôi nguồn nếu hợp lệ, không thì M4A (chuẩn YouTube). */
function ffxAudioOutExt(p) {
  const ext = (ffxBaseName(p).lastIndexOf('.') >= 0 ? ffxBaseName(p).split('.').pop() : '').toLowerCase();
  return ['mp3', 'm4a', 'wav', 'flac'].indexOf(ext) >= 0 ? ext : 'm4a';
}

/* ── 13a) Chuẩn hoá âm lượng EBU R128 (loudnorm 2-pass) ── */
async function ffxRunNorm() {
  const id = 'ffxNormStatus';
  try {
    ffxWireProgress();
    if (!ffxState.audiofx) { ffxSetStatus(id, 'Chưa chọn file nguồn', true); return; }
    const target = Number((document.getElementById('ffxNormTarget') || {}).value) || -16;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang đo + chuẩn hoá (2 pass)… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.audiofx)) + '-chuannhat.' + ffxAudioOutExt(ffxState.audiofx), id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().normalizeAudio({ inputPath: ffxState.audiofx, outputPath: out, targetLU: target }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 13b) Bỏ lời / tách giọng thô ── */
async function ffxRunVocal() {
  const id = 'ffxVocalStatus';
  try {
    ffxWireProgress();
    if (!ffxState.audiofx) { ffxSetStatus(id, 'Chưa chọn file nguồn', true); return; }
    const mode = (document.getElementById('ffxVocalMode') || {}).value || 'instrumental';
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang xử lý… (0%)', false);
    const suffix = mode === 'vocal' ? '-giongtho' : '-khongloi';
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.audiofx)) + suffix + '.' + ffxAudioOutExt(ffxState.audiofx), id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().removeVocals({ inputPath: ffxState.audiofx, outputPath: out, mode: mode }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 13c) Fade in/out video + audio ── */
async function ffxRunFades() {
  const id = 'ffxFadeStatus';
  try {
    ffxWireProgress();
    if (!ffxState.audiofx) { ffxSetStatus(id, 'Chưa chọn file nguồn', true); return; }
    const vin = ffxParseTime((document.getElementById('ffxFadeVin') || {}).value);
    const vout = ffxParseTime((document.getElementById('ffxFadeVout') || {}).value);
    const ain = ffxParseTime((document.getElementById('ffxFadeAin') || {}).value);
    const aout = ffxParseTime((document.getElementById('ffxFadeAout') || {}).value);
    const vals = [['Video mở', vin], ['Video khép', vout], ['Tiếng mở', ain], ['Tiếng khép', aout]];
    for (const v of vals) {
      if (Number.isFinite(v[1]) && (v[1] < 0 || v[1] > 10)) { ffxSetStatus(id, v[0] + ' phải trong khoảng 0–10 giây', true); return; }
    }
    if (!vals.some((v) => v[1] > 0)) { ffxSetStatus(id, 'Nhập ít nhất 1 giá trị fade > 0', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang thêm fade… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.audiofx)) + '-fade.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().addFades({
      inputPath: ffxState.audiofx, outputPath: out,
      videoInSec: Number.isFinite(vin) ? vin : 0, videoOutSec: Number.isFinite(vout) ? vout : 0,
      audioInSec: Number.isFinite(ain) ? ain : 0, audioOutSec: Number.isFinite(aout) ? aout : 0,
    }));
  } catch (e) { ffxFail(id, e); }
}

/* ── Hàng đợi tác vụ nặng: chụp NGUYÊN nguồn + cấu hình form LÚC BẤM NÚT — đến lượt thì
   khôi phục đúng cấu hình đó rồi chạy tuần tự. Không bao giờ dùng nhầm cấu hình mới của user. ── */
var ffxQueueArr = [];
var ffxQueueBusy = false;

function ffxFormSnap(ids) {
  const o = {};
  (ids || []).forEach((id) => {
    const el = document.getElementById(id);
    if (el) o[id] = el.type === 'checkbox' ? !!el.checked : el.value;
  });
  return o;
}

function ffxFormApply(snap) {
  for (const id in (snap || {})) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!snap[id];
    else el.value = snap[id];
  }
}

function ffxEnqueue(label, stateSnap, formIds, runName) {
  ffxQueueArr.push({ label: label, state: JSON.parse(JSON.stringify(stateSnap)), form: ffxFormSnap(formIds), run: runName });
  ffxQueueRender();
  ffxQueuePump();
}

async function ffxQueuePump() {
  if (ffxQueueBusy) return;
  ffxQueueBusy = true;
  try {
    while (ffxQueueArr.length) {
      // Chờ mọi tác vụ đang chạy (kể cả run thủ công xen giữa) xong rồi mới tới lượt tiếp theo.
      while (ffxActiveStatus) { await new Promise((res) => setTimeout(res, 400)); }
      const t = ffxQueueArr.shift();
      ffxQueueRender();
      try {
        for (const k in t.state) { if (k in ffxState) ffxState[k] = t.state[k]; }
        ffxFormApply(t.form);
        const fn = window[t.run];
        if (typeof fn !== 'function') throw new Error('FFX_QUEUE: thiếu hàm chạy ' + t.run);
        await fn();
      } catch (e) {
        if (typeof novaToast === 'function') novaToast('Hàng đợi: ' + ((e && e.message) || e));
      }
    }
  } finally { ffxQueueBusy = false; ffxQueueRender(); }
}

function ffxQueueRender() {
  const box = document.getElementById('ffxQueueList');
  if (!box) return;
  if (!ffxQueueArr.length) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Hàng đợi trống — bấm "⏳ Vào hàng đợi" ở tool Nén / Đổi định dạng / Ghép / Loop / Ghép nhạc / Shorts 9:16 / Đóng Phụ Đề / Chuẩn hoá âm lượng để xếp việc chạy tuần tự (cấu hình được chụp lại lúc bấm nút).</span>';
    return;
  }
  box.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
    ffxQueueArr.map((t, i) => '<span style="font-size:11.5px;border:1px solid var(--border,#333);border-radius:999px;padding:2px 10px">' + (i + 1) + '. ' + ffxEsc(t.label) + '</span>').join('') +
    '<button class="btn ghost sm" onclick="ffxQueueClear()">Xoá hàng đợi</button></div>';
}

function ffxQueueClear() { ffxQueueArr = []; ffxQueueRender(); }

/* Nút "⏳ Vào hàng đợi" của từng tool — chụp cấu hình form hiện tại: */
function ffxEnqueueCompress() {
  if (!ffxState.compress) { ffxSetStatus('ffxCompressStatus', 'Chưa chọn video nguồn', true); return; }
  ffxEnqueue('Nén: ' + ffxBaseName(ffxState.compress), { compress: ffxState.compress },
    ['ffxCompressMode', 'ffxCompressCrf', 'ffxCompressTargetMb', 'ffxCompressHeight', 'ffxCompressGpu'], 'ffxRunCompress');
}

function ffxEnqueueConvert() {
  if (!ffxState.convert) { ffxSetStatus('ffxConvertStatus', 'Chưa chọn media nguồn', true); return; }
  ffxEnqueue('Đổi dạng: ' + ffxBaseName(ffxState.convert), { convert: ffxState.convert },
    ['ffxConvertTarget', 'ffxConvertCodec', 'ffxConvertGpu', 'ffxConvertHeight', 'ffxConvertFps', 'ffxConvertSubs'], 'ffxRunConvert');
}

function ffxEnqueueJoin() {
  if (ffxState.join.length < 2) { ffxSetStatus('ffxJoinStatus', 'Cần chọn ít nhất 2 clip để ghép', true); return; }
  ffxEnqueue('Ghép: ' + ffxState.join.length + ' clip', { join: ffxState.join },
    ['ffxJoinMode', 'ffxJoinXfadeDur', 'ffxJoinXfadeType'], 'ffxRunJoin');
}

function ffxEnqueueLoop() {
  const mode = (document.getElementById('ffxLoopMode') || {}).value || 'times';
  if (mode === 'audio' && !ffxState.loopAudio) { ffxSetStatus('ffxLoopStatus', 'Chưa chọn file nhạc cho Lặp NHẠC', true); return; }
  if (mode !== 'audio' && !ffxState.loop) { ffxSetStatus('ffxLoopStatus', 'Chưa chọn video nguồn', true); return; }
  ffxEnqueue('Loop (' + mode + '): ' + ffxBaseName(mode === 'audio' ? ffxState.loopAudio : ffxState.loop),
    { loop: ffxState.loop, loopAudio: ffxState.loopAudio },
    ['ffxLoopMode', 'ffxLoopTimes', 'ffxLoopTotal', 'ffxLoopXfadeSec', 'ffxLoopAudioTarget'], 'ffxRunLoop');
}

function ffxEnqueueMusic() {
  if (!ffxState.music) { ffxSetStatus('ffxMusicStatus', 'Chưa chọn video nguồn', true); return; }
  if (!ffxState.musicFile) { ffxSetStatus('ffxMusicStatus', 'Chưa chọn file nhạc', true); return; }
  ffxEnqueue('Ghép nhạc: ' + ffxBaseName(ffxState.music), { music: ffxState.music, musicFile: ffxState.musicFile },
    ['ffxMusicMode', 'ffxMusicVol', 'ffxMusicVideoVol', 'ffxMusicStart', 'ffxMusicFadeIn', 'ffxMusicFadeOut', 'ffxMusicPlayStart', 'ffxMusicPlayEnd', 'ffxMusicLoop', 'ffxMusicNorm'], 'ffxRunMusic');
}

function ffxEnqueueShorts() {
  if (!ffxState.shorts) { ffxSetStatus('ffxShortsStatus', 'Chưa chọn video nguồn', true); return; }
  ffxEnqueue('Shorts 9:16: ' + ffxBaseName(ffxState.shorts), { shorts: ffxState.shorts },
    ['ffxShortsMode', 'ffxShortsGpu'], 'ffxRunShorts');
}

function ffxEnqueueSubs() {
  if (!ffxState.subs) { ffxSetStatus('ffxSubsStatus', 'Chưa chọn video nguồn', true); return; }
  if (!ffxState.subsFile) { ffxSetStatus('ffxSubsStatus', 'Chưa chọn file phụ đề', true); return; }
  ffxEnqueue('Đóng phụ đề: ' + ffxBaseName(ffxState.subs), { subs: ffxState.subs, subsFile: ffxState.subsFile },
    ['ffxSubsSize'], 'ffxRunSubs');
}

function ffxEnqueueNorm() {
  if (!ffxState.audiofx) { ffxSetStatus('ffxNormStatus', 'Chưa chọn file nguồn', true); return; }
  ffxEnqueue('Chuẩn hoá âm lượng: ' + ffxBaseName(ffxState.audiofx), { audiofx: ffxState.audiofx },
    ['ffxNormTarget'], 'ffxRunNorm');
}

/* ── Kéo-thả file từ Explorer vào panel tool (Electron 43 gỡ File.path → phải qua
   webUtils.getPathForFile do preload expose là ffx.pathForFile) ── */
var FFX_DROP_EXT = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts', 'gif', 'mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'];
var FFX_SUB_EXT = ['srt', 'ass'];

function ffxDropExtOk(p, extraExts) {
  const name = ffxBaseName(p);
  const ext = (name.lastIndexOf('.') >= 0 ? name.split('.').pop() : '').toLowerCase();
  return FFX_DROP_EXT.indexOf(ext) >= 0 || (extraExts || []).indexOf(ext) >= 0;
}

function ffxSetInputLabel(key, p, labelId) {
  const el = document.getElementById(labelId);
  if (el) { el.textContent = ffxShort(p); el.title = p; ffxAppendInfo(el, p); }
}

/* Bật drop cho 1 panel: key = ô nguồn trong ffxState (single), 'join' = nối danh sách ghép,
   'subs' = tách theo đuôi: video → nguồn, .srt/.ass → file phụ đề.
   extraExts = đuôi mở rộng được nhận thêm (vd ['srt','ass']). */
function ffxEnableDrop(toolId, key, labelId, extraExts) {
  const el = document.getElementById(toolId);
  if (!el || el.__ffxDrop) return;
  el.__ffxDrop = true;
  el.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  el.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    const n = ffxNative();
    if (!n.pathForFile) return;
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    const paths = [];
    let skipped = 0;
    for (const f of files) {
      try {
        const p = n.pathForFile(f);
        if (p && ffxDropExtOk(p, extraExts)) paths.push(p);
        else skipped++;
      } catch (err) { skipped++; }
    }
    if (!paths.length) {
      if (skipped && typeof novaToast === 'function') novaToast('Kéo-thả: chỉ nhận file media (video/âm thanh phổ biến' + (extraExts && extraExts.length ? '/' + extraExts.join('/') : '') + ')');
      return;
    }
    if (key === 'join') {
      ffxState.join = ffxState.join.concat(paths);
      ffxRenderJoinList();
    } else if (key === 'subs') {
      // Panel Đóng Phụ Đề có 2 ô nguồn — tách theo đuôi file.
      let firstVideo = '';
      for (const p of paths) {
        const ext = (ffxBaseName(p).lastIndexOf('.') >= 0 ? ffxBaseName(p).split('.').pop() : '').toLowerCase();
        if (FFX_SUB_EXT.indexOf(ext) >= 0) { ffxState.subsFile = p; ffxSetInputLabel('subsFile', p, 'ffxSubsFile'); }
        else if (!firstVideo) { firstVideo = p; }
      }
      if (firstVideo) { ffxState.subs = firstVideo; ffxSetInputLabel('subs', firstVideo, 'ffxSubsInput'); }
      if (paths.length > 1 && typeof novaToast === 'function') novaToast('Kéo-thả: video nhận file đầu tiên, phụ đề nhận file .srt/.ass');
    } else {
      ffxSetInput(key, paths[0], labelId);
      if (paths.length > 1 && typeof novaToast === 'function') novaToast('Kéo-thả: dùng file đầu tiên trong ' + paths.length + ' file');
    }
    if (skipped && typeof novaToast === 'function') novaToast('Kéo-thả: bỏ qua ' + skipped + ' file không phải media');
  });
}

function ffxInitDrops() {
  ffxEnableDrop('tool-toolffxaudio', 'audio');
  ffxEnableDrop('tool-toolffxcut', 'cut');
  ffxEnableDrop('tool-toolffxjoin', 'join');
  ffxEnableDrop('tool-toolffxloop', 'loop');
  ffxEnableDrop('tool-toolffxcompress', 'compress');
  ffxEnableDrop('tool-toolffxframes', 'frames');
  ffxEnableDrop('tool-toolffxmute', 'mute');
  ffxEnableDrop('tool-toolffxconvert', 'convert');
  ffxEnableDrop('tool-toolffxmusic', 'music');
  ffxEnableDrop('tool-toolffxgif', 'gif');
  // Gói E: Shorts 9:16 / Đóng Phụ Đề (nhận thêm .srt/.ass) / Âm Thanh Nâng Cao
  ffxEnableDrop('tool-toolffxshorts', 'shorts');
  ffxEnableDrop('tool-toolffxsubs', 'subs', '', FFX_SUB_EXT);
  ffxEnableDrop('tool-toolffxaudiofx', 'audiofx');
  ffxHistoryRender();
  ffxQueueRender();
}

ffxInitDrops();