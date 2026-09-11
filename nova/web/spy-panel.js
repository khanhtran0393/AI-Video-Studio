/* ── SPY STORYBOARD PANEL — UI cho native-tools/spy.js (P4.4, mục 15 roadmap VEO3).
     Script thường không module (Luật 4), tự mount vào #spyToolRoot, booted ngay khi DOM sẵn.
     Cần desktop (window.native.spy) — trên web thuần hiện thông báo. ── */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SHELL = `
  <div class="st-root" style="display:flex;flex-direction:column;gap:14px;max-width:980px">
    <div class="info-box">
      <span class="lbl">💡 Quy trình:</span> Dán URL YouTube (youtube.com / youtu.be / music.youtube.com) → app tải video ≤720p
      bằng yt-dlp → trích <b>N frame</b> đều theo thời lượng → ghép <b>lưới storyboard</b> để nghiên cứu nhịp cảnh của đối thủ.
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <label style="flex:1;min-width:280px;display:flex;flex-direction:column;gap:4px">
        <span class="lbl">URL YouTube</span>
        <input id="spyUrl" type="text" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px">
        <span class="lbl">Số frame</span>
        <input id="spyFrames" type="number" min="4" max="48" step="1" value="12" style="width:90px">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px">
        <span class="lbl">Cột</span>
        <input id="spyCols" type="number" min="2" max="8" step="1" value="4" style="width:70px">
      </label>
      <button id="spyRunBtn" class="btn" style="height:38px">🎬 Spy</button>
      <button id="spyCancelBtn" class="btn" style="height:38px;display:none">⏹ Huỷ</button>
    </div>
    <div id="spyStatus" style="font-size:13px;color:var(--text-muted)">Sẵn sàng.</div>
    <div id="spyResult" style="display:flex;flex-direction:column;gap:12px"></div>
    <div>
      <div class="lbl" style="margin-bottom:6px">Job đã spy (mới nhất trước)</div>
      <div id="spyList" class="empty-state" style="font-size:12.5px">Chưa có job nào.</div>
    </div>
  </div>`;

  let busy = false;
  let curJobId = null;

  function $(sel) { return document.querySelector(sel); }

  function status(msg, kind) {
    const el = $('#spyStatus'); if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'err' ? 'var(--red)' : kind === 'ok' ? 'var(--green)' : 'var(--text-muted)';
  }

  function setBusy(b, jobId) {
    busy = b; curJobId = b ? (jobId || curJobId) : null;
    const rb = $('#spyRunBtn'), cb = $('#spyCancelBtn');
    if (rb) rb.disabled = b;
    if (cb) cb.style.display = b ? '' : 'none';
  }

  function fmtTime(ms) { try { return new Date(ms).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  async function refreshList() {
    const box = $('#spyList'); if (!box) return;
    if (!(window.native && window.native.spy)) { box.innerHTML = 'Chỉ khả dụng trên app desktop.'; return; }
    try {
      const jobs = await window.native.spy.list();
      if (!jobs.length) { box.className = 'empty-state'; box.textContent = 'Chưa có job nào.'; return; }
      box.className = '';
      box.innerHTML = jobs.map((j) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid var(--border)">
          <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,monospace">${esc(j.jobId)}</span>
          <span style="font-size:11px;color:var(--text-dim)">${esc(fmtTime(j.mtime))}</span>
          ${j.storyboard ? `<button class="btn" data-view="${esc(j.dir)}" style="padding:2px 10px;font-size:12px">Xem</button>` : ''}
        </div>`).join('');
      box.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewJob(b.getAttribute('data-view'))));
    } catch (e) { box.textContent = 'Lỗi list: ' + (e.message || e); }
  }

  async function viewJob(dir) {
    if (!(window.native && window.native.spy)) return;
    try {
      const jobs = await window.native.spy.list();
      const j = jobs.find((x) => x.dir === dir);
      if (!j || !j.storyboard) return status('Job này chưa có storyboard.jpg — chạy lại để tạo.', 'err');
      renderStoryboard(j.storyboard, j.jobId);
    } catch (e) { status('Lỗi: ' + (e.message || e), 'err'); }
  }

  function renderStoryboard(src, jobId) {
    const box = $('#spyResult'); if (!box) return;
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <b style="font-size:13px">Storyboards — ${esc(jobId)}</b>
        <span style="font-size:11px;color:var(--text-dim)">file lưới: ${esc(src)}</span>
      </div>
      <img src="file://${String(src).replace(/\\/g, '/')}" alt="storyboard" style="width:100%;border:1px solid var(--border);border-radius:8px;background:#000">`;
  }

  async function run() {
    if (busy) return;
    if (!(window.native && window.native.spy)) return status('Spy Storyboard chỉ chạy trên app desktop.', 'err');
    const url = ($('#spyUrl') && $('#spyUrl').value || '').trim();
    const frames = Math.max(4, Math.min(48, parseInt($('#spyFrames') && $('#spyFrames').value, 10) || 12));
    const cols = Math.max(2, Math.min(8, parseInt($('#spyCols') && $('#spyCols').value, 10) || 4));
    if (!url) return status('Nhập URL YouTube trước.', 'err');
    setBusy(true);
    status('Đang spy… (tải video → trích frame → ghép lưới, có thể mất vài phút)');
    const box = $('#spyResult'); if (box) box.innerHTML = '';
    try {
      const r = await window.native.spy.run({ url, frames, cols });
      if (r && r.ok) {
        status('Xong! Storyboard: ' + r.storyboard, 'ok');
        renderStoryboard(r.storyboard, r.jobId);
        refreshList();
      } else {
        status('Lỗi [' + ((r && r.code) || 'SPY_ERROR') + ']: ' + ((r && r.error) || 'Thất bại'), 'err');
      }
    } catch (e) {
      status('Lỗi [' + (e.code || 'SPY_ERROR') + ']: ' + (e.message || e), 'err');
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!(window.native && window.native.spy)) return;
    try { await window.native.spy.cancel(curJobId); status('Đã huỷ job ' + (curJobId || 'đang chạy')); }
    catch (e) { status('Huỷ: ' + (e.message || e), 'err'); }
  }

  function bind() {
    const rb = $('#spyRunBtn'), cb = $('#spyCancelBtn');
    if (rb) rb.addEventListener('click', run);
    if (cb) cb.addEventListener('click', cancel);
  }

  window.SpyPanel = { init: (el) => boot(el || document.getElementById('spyToolRoot')) };

  function boot(el) {
    root = el || document.getElementById('spyToolRoot');
    if (!root || booted) return;
    booted = true;
    root.innerHTML = SHELL;
    bind();
    refreshList();
  }

  var booted = false;
  var root = null;
  const _spyToolRoot = document.getElementById('spyToolRoot');
  if (_spyToolRoot) boot(_spyToolRoot);
  else document.addEventListener('DOMContentLoaded', () => boot(document.getElementById('spyToolRoot')));
})();
