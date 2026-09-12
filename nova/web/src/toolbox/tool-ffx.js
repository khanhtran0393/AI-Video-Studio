/* ── tool-ffx.js — CÔNG CỤ FFMPEG (sidebar dropdown "Công cụ FFmpeg"):
      Tách MP3/M4A/WAV / Cắt / Ghép (đổi thứ tự) / Loop / Nén / Trích Frame /
      Xoá Tiếng / Đổi Định Dạng / Ghép Nhạc / GIF.
      Renderer script thường (không import/export). Mọi tên cấp đầu tiền tố ffx*
      (module system của renderer — AGENTS.md §8). Chạy qua IPC ffx:* → window.native.ffx.
      Tiến bộ: progress % thật (parse time= phía main), nút Huỷ, probe thời lượng/dung lượng
      sau khi chọn, nhập giờ dạng "90" hoặc "mm:ss"/"hh:mm:ss", ghi nhớ thư mục output,
      xác nhận ghi đè file tồn tại. Dialog chọn file THẬT do main process mở. ── */

/* Trạng thái nguồn đã chọn cho từng tool (đường dẫn file thật trên đĩa). */
var ffxState = {
  audio: '', cut: '', loop: '', join: [],
  compress: '', frames: '', mute: '', convert: '',
  music: '', musicFile: '', gif: '',
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

function ffxUpdateProgressUI(statusId, pct) {
  const box = ffxProgressBox(statusId);
  if (!box) return;
  const bar = box.querySelector('.ffx-prog-bar');
  const text = box.querySelector('.ffx-prog-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = pct + '%';
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
    ffxUpdateProgressUI(ffxActiveStatus, pct);
    ffxSetStatus(ffxActiveStatus, '⏳ Đang xử lý… (' + pct + '%)', false);
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

/* Chế độ Trích Frame: "mỗi N giây" ↔ "1 ảnh tại giây" — đổi nhãn ô nhập. */
function ffxFramesModeUI() {
  const mode = (document.getElementById('ffxFramesMode') || {}).value || 'every';
  const label = document.getElementById('ffxFramesSecsLabel');
  const input = document.getElementById('ffxFramesSecs');
  if (label) label.textContent = mode === 'single' ? 'Trích tại giây' : 'Khoảng cách (giây)';
  if (input) input.value = mode === 'single' ? '0' : '5';
}

/* Chế độ Ghép Nhạc: mix → hiện thanh âm lượng, replace → ẩn. */
function ffxMusicModeUI() {
  const mode = (document.getElementById('ffxMusicMode') || {}).value || 'mix';
  const row = document.getElementById('ffxMusicVolRow');
  if (row) row.style.display = mode === 'mix' ? '' : 'none';
}

function ffxMusicVolUI() {
  const v = (document.getElementById('ffxMusicVol') || {}).value || '100';
  const t = document.getElementById('ffxMusicVolText');
  if (t) t.textContent = v + '%';
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

/* Render danh sách clip ghép + nút đổi thứ tự ↑/↓; title = tổng thời lượng. */
function ffxRenderJoinList() {
  const arr = ffxState.join;
  const cnt = document.getElementById('ffxJoinCount');
  const list = document.getElementById('ffxJoinList');
  if (cnt) cnt.textContent = arr.length ? 'Đã chọn ' + arr.length + ' clip' : 'Chưa chọn clip nào';
  if (!list) return;
  if (!arr.length) { list.innerHTML = ''; list.title = ''; return; }
  list.innerHTML = arr.map((p, i) => {
    const up = i > 0 ? '<button class="btn ghost sm" onclick="ffxJoinMove(' + i + ',-1)" title="Đưa lên">↑</button>' : '';
    const down = i < arr.length - 1 ? '<button class="btn ghost sm" onclick="ffxJoinMove(' + i + ',1)" title="Đưa xuống">↓</button>' : '';
    return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0">' +
      '<span style="flex:1;min-width:0;word-break:break-all">' + (i + 1) + '. ' + ffxEsc(ffxBaseName(p)) + '</span>' +
      up + down + '</div>';
  }).join('');
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

/* Chọn nơi lưu output; trả đường dẫn hoặc '' (huỷ/đổi ý khi trùng). Xác nhận GHI ĐÈ khi trùng. */
async function ffxPickOutput(defaultName, statusId) {
  const n = ffxNative();
  const r = await n.pickOutput(defaultName, ffxLastOutDir());
  if (!r || r.error) { ffxSetStatus(statusId, 'Lỗi chọn nơi lưu: ' + (r && r.error), true); return ''; }
  if (r.canceled || !r.path) return '';
  if (r.exists && !window.confirm('File "' + ffxBaseName(r.path) + '" đã tồn tại. Ghi đè lên file cũ?')) return '';
  return r.path;
}

/* Kết quả thành công — link "Mở" + ghi nhớ thư mục. */
function ffxDone(statusId, r) {
  ffxActiveStatus = '';
  if (r && r.ok && r.path) {
    ffxRememberOutDir(r.path);
    ffxHideProgress(statusId);
    const note = r.count > 1 ? ' (' + r.count + ' ảnh)' : '';
    const open = ' <a href="#" onclick="ffxOpen(\'' + String(r.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\');return false" style="color:var(--accent)">Mở</a>';
    ffxSetStatus(statusId, '✅ Xong: ' + ffxShort(r.path) + note + open, false);
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

/* ── 1) Tách MP3/M4A/WAV ── */
async function ffxRunExtract() {
  const id = 'ffxAudioStatus';
  try {
    ffxWireProgress();
    if (!ffxState.audio) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const fmt = (document.getElementById('ffxAudioFormat') || {}).value || 'mp3';
    const br = (document.getElementById('ffxAudioBitrate') || {}).value || '192k';
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang tách… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.audio)) + '.' + fmt, id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().extractAudio({ inputPath: ffxState.audio, outputPath: out, bitrate: br, format: fmt }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 2) Cắt video (nhập "90" hoặc mm:ss / hh:mm:ss) ── */
async function ffxRunCut() {
  const id = 'ffxCutStatus';
  try {
    ffxWireProgress();
    if (!ffxState.cut) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const s = ffxParseTime((document.getElementById('ffxCutStart') || {}).value);
    const e2 = ffxParseTime((document.getElementById('ffxCutEnd') || {}).value);
    if (!Number.isFinite(s) || s < 0) { ffxSetStatus(id, 'Giờ bắt đầu không hợp lệ — nhập "90" hoặc "01:30"', true); return; }
    if (!Number.isFinite(e2) || e2 <= s) { ffxSetStatus(id, 'Giờ kết thúc phải LỚN HƠN giờ bắt đầu', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang cắt… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.cut)) + '-cat.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().cutVideo({ inputPath: ffxState.cut, outputPath: out, startSec: s, endSec: e2 }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 3) Ghép video (thứ tự chỉnh được bằng ↑/↓) ── */
async function ffxRunJoin() {
  const id = 'ffxJoinStatus';
  try {
    ffxWireProgress();
    if (ffxState.join.length < 2) { ffxSetStatus(id, 'Cần chọn ít nhất 2 clip để ghép', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang ghép… (0%)', false);
    const out = await ffxPickOutput('ghep-video.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().concatVideos({ inputPaths: ffxState.join, outputPath: out }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 4) Loop video ── */
async function ffxRunLoop() {
  const id = 'ffxLoopStatus';
  try {
    ffxWireProgress();
    if (!ffxState.loop) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const times = Number((document.getElementById('ffxLoopTimes') || {}).value);
    if (!Number.isInteger(times) || times < 2) { ffxSetStatus(id, 'Số lần lặp phải là số nguyên ≥ 2', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang loop… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.loop)) + '-loop.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().loopVideo({ inputPath: ffxState.loop, outputPath: out, times: times }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 5) Nén video ── */
async function ffxRunCompress() {
  const id = 'ffxCompressStatus';
  try {
    ffxWireProgress();
    if (!ffxState.compress) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const crf = Number((document.getElementById('ffxCompressCrf') || {}).value) || 28;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang nén… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.compress)) + '-nen.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().compressVideo({ inputPath: ffxState.compress, outputPath: out, crf: crf }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 6) Trích frame (output = thư mục lưu ảnh, dùng pickFolder có sẵn) ── */
async function ffxRunFrames() {
  const id = 'ffxFramesStatus';
  try {
    ffxWireProgress();
    if (!ffxState.frames) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const mode = (document.getElementById('ffxFramesMode') || {}).value || 'every';
    const fmt = (document.getElementById('ffxFramesFormat') || {}).value || 'png';
    const raw = Number((document.getElementById('ffxFramesSecs') || {}).value);
    if (!Number.isFinite(raw) || raw < 0) { ffxSetStatus(id, mode === 'single' ? 'Nhập giây trích ≥ 0' : 'Khoảng cách giây phải ≥ 0.1', true); return; }
    if (mode === 'every' && raw < 0.1) { ffxSetStatus(id, 'Khoảng cách giây phải ≥ 0.1', true); return; }
    ffxSetStatus(id, '📁 Chọn thư mục lưu ảnh…', false);
    const n = ffxNative();
    const dir = window.native && typeof window.native.pickFolder === 'function' ? await window.native.pickFolder() : null;
    if (!dir || dir.error || dir.canceled || !dir.path) { ffxSetStatus(id, '', false); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang trích… (0%)', false);
    const payload = mode === 'single'
      ? { inputPath: ffxState.frames, outputDir: dir.path, mode: 'single', atSec: raw, format: fmt }
      : { inputPath: ffxState.frames, outputDir: dir.path, mode: 'every', everySec: raw, format: fmt };
    ffxDone(id, await n.extractFrames(payload));
  } catch (e) { ffxFail(id, e); }
}

/* ── 7) Xoá tiếng ── */
async function ffxRunMute() {
  const id = 'ffxMuteStatus';
  try {
    ffxWireProgress();
    if (!ffxState.mute) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang xoá tiếng… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.mute)) + '-cam.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().removeAudio({ inputPath: ffxState.mute, outputPath: out }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 8) Đổi định dạng ── */
async function ffxRunConvert() {
  const id = 'ffxConvertStatus';
  try {
    ffxWireProgress();
    if (!ffxState.convert) { ffxSetStatus(id, 'Chưa chọn media nguồn', true); return; }
    const target = (document.getElementById('ffxConvertTarget') || {}).value || 'mp4';
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang chuyển… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.convert)) + '.' + target, id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().convertMedia({ inputPath: ffxState.convert, outputPath: out }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 9) Ghép nhạc (mix có âm lượng / replace) ── */
async function ffxRunMusic() {
  const id = 'ffxMusicStatus';
  try {
    ffxWireProgress();
    if (!ffxState.music) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    if (!ffxState.musicFile) { ffxSetStatus(id, 'Chưa chọn file nhạc', true); return; }
    const mode = (document.getElementById('ffxMusicMode') || {}).value || 'mix';
    const volPct = Number((document.getElementById('ffxMusicVol') || {}).value);
    const musicVolume = mode === 'mix' && Number.isFinite(volPct) ? volPct / 100 : 1;
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang ghép nhạc… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.music)) + '-nhac.mp4', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().addMusic({ inputPath: ffxState.music, musicPath: ffxState.musicFile, outputPath: out, mode: mode, musicVolume: musicVolume }));
  } catch (e) { ffxFail(id, e); }
}

/* ── 10) Xuất GIF (palette 2 pass; từ/đến tuỳ chọn, nhập "90" hoặc mm:ss) ── */
async function ffxRunGif() {
  const id = 'ffxGifStatus';
  try {
    ffxWireProgress();
    if (!ffxState.gif) { ffxSetStatus(id, 'Chưa chọn video nguồn', true); return; }
    const width = Number((document.getElementById('ffxGifWidth') || {}).value) || 480;
    const fps = Number((document.getElementById('ffxGifFps') || {}).value) || 12;
    const startRaw = (document.getElementById('ffxGifStart') || {}).value;
    const endRaw = (document.getElementById('ffxGifEnd') || {}).value;
    const s = String(startRaw).trim() === '' ? 0 : ffxParseTime(startRaw);
    const e2 = String(endRaw).trim() === '' ? null : ffxParseTime(endRaw);
    if (!Number.isFinite(s) || s < 0) { ffxSetStatus(id, 'Giờ bắt đầu không hợp lệ — nhập "90" hoặc "01:30"', true); return; }
    if (e2 !== null && (!Number.isFinite(e2) || e2 <= s)) { ffxSetStatus(id, 'Giờ kết thúc phải LỚN HƠN giờ bắt đầu', true); return; }
    ffxActiveStatus = id; ffxShowProgress(id);
    ffxSetStatus(id, '⏳ Đang xuất GIF… (0%)', false);
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxState.gif)) + '.gif', id);
    if (!out) { ffxActiveStatus = ''; ffxHideProgress(id); ffxSetStatus(id, '', false); return; }
    ffxDone(id, await ffxNative().toGif({ inputPath: ffxState.gif, outputPath: out, width: width, fps: fps, startSec: s, endSec: e2 }));
  } catch (e) { ffxFail(id, e); }
}