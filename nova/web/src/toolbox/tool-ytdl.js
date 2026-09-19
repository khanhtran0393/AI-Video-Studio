'use strict';
/* TẢI VIDEO (yt-dlp đóng gói sẵn nova/ytdlp-bin) — panel "Công cụ FFmpeg" → "Tải Video".
   Tool con của nhóm ffx nhưng file riêng: mọi tên cấp đầu có tiền tố ydl* (module system
   renderer — §8 AGENTS.md). LƯU Ý checker: id DOM và hàm handler KHÔNG được trùng tên
   (implicit global từ id đè hàm — check:shadow bắt; hàm status đặt tên ydlStatusMsg để
   khỏi trùng id #ydlStatus). Dùng window.native.ytdl (preload).
   Luật 10: mọi lỗi trả {error, code} → hiện lộ liễu, không nuốt. */

var ydlState = { info: null, dir: '', running: false };

function ydlFmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0
    ? h + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
    : m + ':' + String(ss).padStart(2, '0');
}

function ydlStatusMsg(msg) {
  const el = document.getElementById('ydlStatus');
  if (el) el.textContent = msg || '';
}

function ydlBar(pct, extra) {
  const wrap = document.getElementById('ydlBarWrap');
  const fill = document.getElementById('ydlBarFill');
  if (!wrap || !fill) return;
  if (pct == null) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  const txt = document.getElementById('ydlBarTxt');
  if (txt) txt.textContent = pct + '%' + (extra ? ' — ' + extra : '');
}

/* Progress: đăng ký listener MỘT LẦN lúc nạp file (mô hình ffx:progress của tool-ffx.js). */
(function () {
  const n = window.native;
  if (n && n.ytdl && typeof n.ytdl.onProgress === 'function') {
    n.ytdl.onProgress(function (s) {
      if (!s || !ydlState.running) return;
      const extra = [s.speed ? '⇣ ' + s.speed : '', s.eta ? 'còn ' + s.eta : ''].filter(Boolean).join(' · ');
      ydlBar(s.pct, extra);
    });
  }
})();

/* ── Lấy thông tin video: nhập URL → metadata (tiêu đề/kênh/thời lượng/ảnh) ── */
async function ydlFetchInfo() {
  if (ydlState.running) { ydlStatusMsg('⏳ Đang tải — huỷ trước khi làm việc khác.'); return; }
  const url = (document.getElementById('ydlUrl') || {}).value || '';
  ydlStatusMsg('⏳ Đang lấy thông tin video…');
  try {
    const r = await window.native.ytdl.info({ url });
    if (r && r.error) { ydlState.info = null; ydlRenderInfo(); ydlStatusMsg('❌ ' + r.error); return; }
    ydlState.info = r;
    ydlRenderInfo();
    ydlStatusMsg('✓ ' + r.title);
  } catch (err) {
    ydlState.info = null; ydlRenderInfo();
    ydlStatusMsg('❌ ' + ((err && err.message) || err));
  }
}

function ydlRenderInfo() {
  const box = document.getElementById('ydlInfo');
  if (!box) return;
  const i = ydlState.info;
  if (!i) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = '';
  const dur = i.duration ? ydlFmtDur(i.duration) : '?';
  box.innerHTML =
    '<div style="display:flex;gap:10px;align-items:flex-start">' +
    (i.thumbnail ? '<img src="' + i.thumbnail.replace(/"/g, '&quot;') + '" style="width:120px;border-radius:6px;flex:none">' : '') +
    '<div style="min-width:0">' +
    '<div style="font-weight:600;word-break:break-word">' + i.title.replace(/</g, '&lt;') + '</div>' +
    '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">' +
    (i.uploader ? '📺 ' + i.uploader.replace(/</g, '&lt;') + ' · ' : '') +
    '⏱ ' + dur + (i.extractor ? ' · ' + i.extractor.replace(/</g, '&lt;') : '') + '</div>' +
    '</div></div>';
}

/* ── Chọn thư mục lưu (dialog THẬT từ main — pick-folder) ── */
async function ydlPickDir() {
  const r = await window.native.pickFolder();
  if (!r || r.canceled || !r.path) return;
  ydlState.dir = r.path;
  const el = document.getElementById('ydlDir');
  if (el) { el.textContent = r.path; el.title = r.path; }
}

/* ── Bắt đầu tải ── */
async function ydlStart() {
  if (ydlState.running) return;
  const url = (document.getElementById('ydlUrl') || {}).value || '';
  const audioOnly = !!(document.getElementById('ydlAudioOnly') || {}).checked;
  const quality = audioOnly ? 'best' : ((document.getElementById('ydlQuality') || {}).value || 'best');
  if (!ydlState.info) { ydlStatusMsg('❌ Bấm "Lấy thông tin" trước khi tải.'); return; }
  if (!ydlState.dir) { ydlStatusMsg('❌ Chọn thư mục lưu trước khi tải.'); return; }
  ydlState.running = true;
  ydlBar(0);
  ydlStatusMsg('⏳ Đang tải ' + ydlState.info.title + '…');
  try {
    const r = await window.native.ytdl.download({
      url: url.trim(), dir: ydlState.dir, title: ydlState.info.title,
      quality, audioOnly,
    });
    if (r && r.error) {
      ydlBar(null);
      ydlStatusMsg((r.cancelled ? '⚠ Đã huỷ — ' : '❌ ') + r.error);
    } else {
      ydlStatusMsg('✓ Đã lưu: ' + (r.path || '?'));
      if (typeof novaToast === 'function') novaToast('✓ Tải xong: ' + (r.path || ''));
    }
  } catch (err) {
    ydlBar(null);
    ydlStatusMsg('❌ ' + ((err && err.message) || err));
  } finally {
    ydlState.running = false;
  }
}

/* ── Huỷ lượt tải đang chạy ── */
async function ydlCancel() {
  if (!ydlState.running) { ydlStatusMsg('Không có lượt tải nào đang chạy.'); return; }
  const r = await window.native.ytdl.cancel();
  if (!r || r.ok !== true) ydlStatusMsg('⚠ ' + ((r && r.error) || 'không huỷ được'));
}
