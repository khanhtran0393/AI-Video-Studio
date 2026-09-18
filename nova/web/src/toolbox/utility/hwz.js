'use strict';
/* hwz.js — "Máy của bạn & Tối ưu" (Cài đặt).
 * Dùng window.native.hardwareProfile / hardwareCuda* (preload) — chỉ chạy trong
 * app desktop; chạy trong trình duyệt thường thì hiện thông báo và dừng.
 * Toàn bộ trong IIFE (không thêm tên global) — id DOM tiền tố `hwz*`.
 * Nạp trong index.html sau các utility khác (chỉ cần window.native). */
(function hwzPanel() {
  let _hwzBusy = false;

  function hwzFmtGb(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + ' GB'; }

  function hwzChip(label, value, tone) {
    const c = tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--yellow,#eab308)' : tone === 'bad' ? 'var(--red)' : 'var(--text)';
    return '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg,rgba(0,0,0,.25));border:1px solid var(--border);border-radius:9px;padding:5px 10px;font-size:11.5px">'
      + '<span style="color:var(--text-muted)">' + label + '</span>'
      + '<b style="color:' + c + '">' + value + '</b></span>';
  }

  function hwzProfileLabel(p) {
    if (p === 'gpu') return 'GPU (giọng đọc qua CUDA/MPS)';
    if (p === 'cpu-weak') return 'CPU yếu (khối đọc nhỏ)';
    return 'CPU (khối đọc 400 ký tự)';
  }
  function hwzRender(profile, lane) {
    const card = document.getElementById('hwzCard');
    if (!card) return;
    const cpu = profile.cpu || {};
    const gpu = profile.gpu || {};
    const voice = profile.voice || {};
    const cuda = profile.cuda || {};

    // GPU: NVIDIA → tên + VRAM (tone ok). Không NVIDIA → hiện GPU thật đang có
    // (AMD/Intel…) kèm chú thích không hỗ trợ CUDA (tone warn) thay vì báo cụt.
    const gpuAll = Array.isArray(profile.gpuAll) ? profile.gpuAll : null;
    const gpuVal = gpu.present
      ? (gpu.name + ' · ' + gpu.vramTotalMb + 'MB')
      : (gpuAll && gpuAll.length ? gpuAll.map((g) => g.name).join(' + ') + ' — không hỗ trợ CUDA' : 'Không có GPU NVIDIA');
    const lines = [];
    lines.push('<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + hwzChip('CPU', (cpu.cores || '—') + ' nhân', (cpu.cores || 0) >= 8 ? 'ok' : '')
      + hwzChip('RAM', hwzFmtGb(cpu.totalRamGb), (cpu.totalRamGb || 0) >= 8 ? 'ok' : '')
      + hwzChip('GPU', gpuVal, gpu.present ? 'ok' : 'warn')
      + '</div>');

    const torchTxt = voice.torch || (lane && lane.real && lane.real.torch) || 'chưa cài';
    const devTxt = voice.backendRunning ? (voice.device || 'cpu') : 'backend chưa chạy';
    lines.push('<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">'
      + hwzChip('Giọng đọc', hwzProfileLabel(profile.profile), profile.profile === 'gpu' ? 'ok' : '')
      + hwzChip('torch', torchTxt, torchTxt.indexOf('+cpu') === -1 && torchTxt !== 'chưa cài' ? 'ok' : '')
      + hwzChip('Khối đọc', voice.recommended ? (voice.recommended.chunk_chars + ' ký tự / ' + voice.recommended.seg_words + ' từ') : '—', '')
      + '</div>');
    lines.push('<div style="font-size:11px;color:var(--text-dim);margin-top:8px">Backend giọng nói: '
      + (voice.backendRunning ? 'đang chạy — device <b style="color:var(--green)">' + devTxt + '</b>' : 'chưa chạy (mở tab Tạo giọng nói để bật)')
      + (cuda.blockReason ? ' · Runtime AI (GPU): <b style="color:var(--red)">' + cuda.blockReason + '</b>' : '')
      + '</div>');

    // Nút: hiện theo ĐIỀU KIỆN THẬT — torch thật là +cpu và GPU đủ VRAM thì mới
    // cho cài; marker lane=cuda mà torch thật là +cpu → nút cài lại vẫn hiện.
    const torchIsCpu = torchTxt === 'chưa cài' || /\+cpu/.test(String(torchTxt));
    const btns = [];
    if (cuda.eligible && (torchIsCpu || !voice.backendRunning)) {
      btns.push('<button class="btn primary sm" id="hwzBtnInstall" ' + (_hwzBusy ? 'disabled' : '') + '>⚡ Tải Runtime AI (GPU) cho giọng đọc</button>');
    }
    if (!torchIsCpu) {
      btns.push('<button class="btn sm" id="hwzBtnRollback" style="color:var(--red);border-color:var(--red)" ' + (_hwzBusy ? 'disabled' : '') + '>↩ Quay về CPU</button>');
    }
    btns.push('<button class="btn ghost sm" id="hwzBtnRefresh">🔄 Quét lại</button>');
    lines.push('<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' + btns.join('') + '</div>');

    card.innerHTML = lines.join('');
    const bi = document.getElementById('hwzBtnInstall');
    if (bi) bi.addEventListener('click', hwzInstall);
    const br = document.getElementById('hwzBtnRollback');
    if (br) br.addEventListener('click', hwzRollback);
    const bf = document.getElementById('hwzBtnRefresh');
    if (bf) bf.addEventListener('click', function () { hwzLoad(true); });
  }

  function hwzLog(p) {
    const box = document.getElementById('hwzLog');
    if (!box) return;
    box.style.display = 'block';
    box.appendChild(document.createTextNode((p && p.line) || p || ''));
    box.appendChild(document.createElement('br'));
    box.scrollTop = box.scrollHeight;
  }

  // Modal thông báo/xác nhận CÙNG THEME app (thay alert/confirm hệ thống —
  // dialog trắng của Windows lệch hẳn nền tối). Trả Promise<boolean>:
  // true = bấm nút chính, false = bấm Huỷ/nút đóng/bấm ra nền.
  function hwzDialog(opts) {
    return new Promise(function (resolve) {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--surface);border:2px solid var(--accent);border-radius:16px;max-width:460px;width:100%;padding:24px 26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.45)';
      const done = function (v) {
        document.removeEventListener('keydown', onKey);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        resolve(v);
      };
      const onKey = function (e) { if (e.key === 'Escape') done(false); };
      card.innerHTML = '<div style="font-size:15.5px;font-weight:800;color:var(--accent);margin:0 0 12px">' + (opts.title || 'AI Video Studio') + '</div>'
        + '<div style="font-size:13px;color:var(--text);line-height:1.65;white-space:pre-line">' + (opts.msg || '') + '</div>';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:20px';
      if (opts.cancelText) {
        const bc = document.createElement('button');
        bc.className = 'btn ghost sm';
        bc.style.cssText = 'font-size:13px;padding:9px 16px';
        bc.textContent = opts.cancelText;
        bc.addEventListener('click', function () { done(false); });
        row.appendChild(bc);
      }
      const ok = document.createElement('button');
      ok.className = 'btn primary sm';
      ok.style.cssText = 'font-size:13px;padding:9px 16px';
      ok.textContent = opts.okText || 'Đóng';
      ok.addEventListener('click', function () { done(true); });
      row.appendChild(ok);
      card.appendChild(row);
      ov.appendChild(card);
      ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(ov);
      ok.focus();
    });
  }


  async function hwzLoad(force) {
    const card = document.getElementById('hwzCard');
    if (!card) return;
    if (!window.native || !window.native.hardwareProfile) {
      card.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Chỉ có trong app desktop (Nova Studio).</div>';
      return;
    }
    try {
      const profile = await window.native.hardwareProfile();
      const lane = await window.native.hardwareCudaStatus().catch(function () { return null; });
      hwzRender(profile, lane);
    } catch (e) {
      card.innerHTML = '<div style="font-size:12px;color:var(--red)">Dò phần cứng lỗi: ' + String(e && e.message || e) + '</div>';
    }
  }

  async function hwzInstall() {
    if (_hwzBusy) return;
    if (!window.native || !window.native.hardwareCudaInstall) return;
    const go = await hwzDialog({
      title: '⚡ Tải Runtime AI (GPU) cho giọng đọc?',
      msg: '• Tải ~2.5–3 GB (chỉ làm 1 lần)\n• Kiểm tra bằng phép tính GPU thật sau khi cài\n• Nếu GPU không chạy được → app TỰ quay về CPU, không mất gì',
      okText: 'Tải & cài', cancelText: 'Huỷ'
    });
    if (!go) return;
    _hwzBusy = true;
    const log = document.getElementById('hwzLog');
    if (log) { log.textContent = ''; log.style.display = 'block'; }
    try {
      window.native.onHardwareCudaProgress(function (p) { hwzLog(p); });
      const r = await window.native.hardwareCudaInstall();
      if (r && r.ok) await hwzDialog({ title: '✅ Đã bật GPU cho giọng đọc', msg: 'Giọng đọc giờ chạy trên ' + (r.gpu || 'GPU') + ' (torch ' + (r.torch || '') + ').', okText: 'Đóng' });
      else if (r && r.error) await hwzDialog({ title: '⚠️ Không bật được GPU', msg: String(r.error), okText: 'Đóng' });
    } catch (e) {
      await hwzDialog({ title: '⚠️ Cài Runtime AI lỗi', msg: String(e && e.message || e), okText: 'Đóng' });
    } finally {
      _hwzBusy = false;
      hwzLoad(true);
    }
  }

  async function hwzRollback() {
    if (_hwzBusy) return;
    if (!window.native || !window.native.hardwareCudaRollback) return;
    const go = await hwzDialog({
      title: '↩ Quay giọng đọc về CPU?',
      msg: 'Gỡ ưu tiên GPU, cài lại wheel CPU. Backend sẽ khởi động lại.',
      okText: 'Quay về CPU', cancelText: 'Huỷ'
    });
    if (!go) return;
    _hwzBusy = true;
    const log = document.getElementById('hwzLog');
    if (log) { log.textContent = ''; log.style.display = 'block'; }
    try {
      window.native.onHardwareCudaProgress(function (p) { hwzLog(p); });
      await window.native.hardwareCudaRollback();
    } finally {
      _hwzBusy = false;
      hwzLoad(true);
    }
  }

  // Render khi mở tab Cài đặt (mỗi lần mở → dữ liệu tươi, không dùng cache cũ).
  document.addEventListener('DOMContentLoaded', function () {
    hwzLoad(false);
    var nav = document.getElementById('nav-tool-toolsettings');
    if (nav) nav.addEventListener('click', function () { setTimeout(function () { hwzLoad(true); }, 50); });
  });
})();

