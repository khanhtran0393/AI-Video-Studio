'use strict';
/* binman.js — "Toàn vẹn binary" (Cài đặt, cạnh "Máy của bạn & Tối ưu").
 * Bước 4 lộ trình ezmaxsub: kiểm sha256 binary runtime (nova/ytdlp-bin,
 * ffmpeg/ffprobe-static) qua window.native.binman (preload).
 * - status  : verify CHỈ ĐỌC — so baseline (userData/bin-manifest.json)
 *             + SHA2-256SUMS upstream của yt-dlp. Lệch KHÔNG tự ghi đè.
 * - refresh : ghi baseline mới — chỉ khi user bấm rõ ràng (có confirm).
 * Toàn bộ trong IIFE (không thêm tên global) — id DOM tiền tố `binman*`.
 * Nạp trong index.html sau hwz.js (chỉ cần window.native). */
(function binmanPanel() {
  const card = () => document.getElementById('binmanCard');

  function binmanEsc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function binmanFmtBytes(n) {
    if (!Number.isFinite(n)) return '—';
    if (n >= 1073741824) return (Math.round(n / 107374182.4) / 10) + ' GB';
    if (n >= 1048576) return (Math.round(n / 104857.6) / 10) + ' MB';
    if (n >= 1024) return (Math.round(n / 102.4) / 10) + ' KB';
    return n + ' B';
  }

  const STATUS_META = {
    ok: { chip: 'Nguyên vẹn', color: 'var(--green)' },
    'no-baseline': { chip: 'Chưa có baseline', color: 'var(--yellow,#eab308)' },
    changed: { chip: 'LỆCH', color: 'var(--red)' },
    unavailable: { chip: 'Không có trên máy', color: 'var(--text-muted)' },
    error: { chip: 'LỖI', color: 'var(--red)' },
  };

  function binmanRow(t) {
    const meta = STATUS_META[t.status] || STATUS_META.error;
    let html = '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)">'
      + '<b style="font-size:12px;min-width:210px">' + binmanEsc(t.label) + '</b>'
      + '<span style="font-size:11.5px;font-weight:700;color:' + meta.color + '">' + meta.chip + '</span>'
      + (t.files != null ? '<span style="font-size:11px;color:var(--text-muted)">' + t.files + ' file · ' + binmanFmtBytes(t.bytes) + '</span>' : '')
      + '</div>';
    if (t.status === 'changed') {
      const parts = [];
      for (const c of (t.changed || [])) parts.push('⟳ ' + c.path);
      for (const m of (t.missing || [])) parts.push('✖ thiếu: ' + m.path);
      for (const x of (t.extra || [])) parts.push('＋ lạ: ' + x.path);
      if (parts.length) {
        html += '<div style="font-size:11px;color:var(--red);font-family:monospace;margin:2px 0 6px 218px">' + binmanEsc(parts.join(' · ')) + '</div>';
      }
    }
    if (t.sums && t.sums.present) {
      const okN = t.sums.checked.filter((c) => c.ok).length;
      const sumColor = t.sums.mismatches.length ? 'var(--red)' : 'var(--green)';
      html += '<div style="font-size:11px;color:var(--text-dim);margin:0 0 6px 218px">SHA2-256SUMS upstream: '
        + '<b style="color:' + sumColor + '">' + okN + '/' + t.sums.checked.length + ' khớp</b>'
        + (t.sums.skipped ? ' (' + t.sums.skipped + ' platform không ship — bỏ qua)' : '') + '</div>';
    }
    if (t.status === 'error') {
      html += '<div style="font-size:11px;color:var(--red);font-family:monospace;margin:2px 0 6px 218px">' + binmanEsc(t.error || '') + '</div>';
    }
    return html;
  }

  function binmanRender(res) {
    const c = card();
    if (!c) return;
    if (!res || res.ok !== true) {
      c.innerHTML = '<div style="font-size:12px;color:var(--red)">Không kiểm được binary: ' + binmanEsc((res && res.error) || 'không rõ')
        + (res && res.code ? ' <span style="color:var(--text-muted)">[' + binmanEsc(res.code) + ']</span>' : '') + '</div>';
      return;
    }
    const changed = res.targets.filter((t) => t.status === 'changed' || t.status === 'error');
    const allOk = changed.length === 0;
    const head = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">'
      + '<b style="font-size:12.5px;color:' + (allOk ? 'var(--green)' : 'var(--red)') + '">'
      + (allOk ? '✓ Binary nguyên vẹn' : '✗ Phát hiện binary lệch (' + changed.length + ' mục)')
      + '</b><span style="flex:1"></span>'
      + '<button class="btn ghost sm" id="binmanBtnCheck">🔄 Kiểm tra lại</button>'
      + '<button class="btn ghost sm" id="binmanBtnRefresh" title="Ghi nhận trạng thái hiện tại làm baseline mới — chỉ bấm sau khi cập nhật binary có chủ đích">🧭 Ghi baseline</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Baseline ghi lúc '
      + binmanEsc(res.baselineAt ? new Date(res.baselineAt).toLocaleString() : '— chưa có — bấm "Ghi baseline" sau khi cài/đổi binary.')
      + '</div>';
    c.innerHTML = head + res.targets.map(binmanRow).join('');
    const bc = document.getElementById('binmanBtnCheck');
    const br = document.getElementById('binmanBtnRefresh');
    if (bc) bc.addEventListener('click', binmanCheck);
    if (br) br.addEventListener('click', binmanRefresh);
  }

  async function binmanCheck() {
    if (!binmanNative()) return;
    binmanLoading('Đang hash binary (yt-dlp + FFmpeg, vài giây)…');
    try { binmanRender(await binmanNative().status()); } catch (e) { binmanRender({ ok: false, error: (e && e.message) || String(e) }); }
  }

  async function binmanRefresh() {
    if (!binmanNative()) return;
    if (!window.confirm('Ghi baseline mới = chấp nhận trạng thái binary HIỆN TẠI làm chuẩn.\nChỉ bấm OK nếu bạn vừa cập nhật binary có chủ đích.')) return;
    binmanLoading('Đang ghi baseline mới…');
    try { binmanRender(await binmanNative().refresh()); } catch (e) { binmanRender({ ok: false, error: (e && e.message) || String(e) }); }
  }

  function binmanLoading(msg) {
    const c = card();
    if (c) c.innerHTML = '<div style="color:var(--text-muted);font-size:12px">' + binmanEsc(msg || 'Đang kiểm tra binary…') + '</div>';
  }

  function binmanNative() {
    if (typeof window === 'undefined' || !window.native || !window.native.binman) {
      const c = card();
      if (c) c.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Chỉ chạy trong app desktop (cần window.native.binman).</div>';
      return null;
    }
    return window.native.binman;
  }

  const initial = card();
  if (initial) binmanCheck();
})();

