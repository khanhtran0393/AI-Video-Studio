/* T7 PLAYBACK — playhead/trim/kéo clip, tốc độ/loop/safe/settings, play/pause/seek/ruler, phím tắt (t7HookKeys)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7UpdatePlayhead(){
  const total = _t7Total(), pps = t7State.pps;
  _t7UpdateOverlay();   // bật/tắt ảnh đè theo playhead khi đang phát
  const ph = document.getElementById('t7Playhead'); if (ph) ph.style.left = (_T7_GUT + Math.min(t7State.playT, total) * pps) + 'px';
  const fill = document.getElementById('t7SeekFill'); if (fill) fill.style.width = (total ? (Math.min(t7State.playT, total) / total * 100) : 0) + '%';
  const tc = document.getElementById('t7TimeCode'); if (tc) tc.textContent = _t7Fmt(t7State.playT) + ' / ' + _t7Fmt(total);
}

function t7TrimPointerDown(e, id){
  e.preventDefault(); e.stopPropagation();
  const c = t7State.clips.find(x => x.id === id); if (!c) return;
  t7State.selClip = id;
  t7Snapshot();
  const startX = e.clientX, startDur = _t7ClipDur(c);
  // Mốc bắt đầu của clip này, để hút MÉP PHẢI về mốc tuyệt đối chứ không phải về độ dài tròn số.
  const _t0 = (() => { let a = 0; for (const x of _t7Clips()){ if (x.id === id) break; a += _t7ClipDur(x); } return a; })();
  const move = (ev) => {
    const dx = ev.clientX - startX;
    let end = _t7Snap(_t0 + startDur + dx / t7State.pps);
    c.dur = Math.max(0.3, +(end - _t0).toFixed(2));
    _t7LiveResizeClip(id);
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); _t7PersistClips(); t7RenderTimeline(); t7RenderRows(); t7RenderDetail(); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7ClipPointerDown(e, id){
  // chọn ngay; nếu kéo ngang đủ xa thì đổi vị trí (reorder)
  t7SelectClip(id);
  const startX = e.clientX; let moved = false, snapped = false;
  const idxOf = () => t7State.clips.findIndex(c => c.id === id);
  const move = (ev) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved){ moved = true; t7Snapshot(); snapped = true; }
    // vị trí chuột trên track → chỉ số mục tiêu
    const body = document.getElementById('t7TrkScenes'); if (!body) return;
    const r = body.getBoundingClientRect(); const x = ev.clientX - r.left;
    let acc = 0, target = t7State.clips.length - 1;
    for (let i = 0; i < t7State.clips.length; i++){ const w = Math.max(28, _t7ClipDur(t7State.clips[i]) * t7State.pps) + 2; if (x < acc + w / 2){ target = i; break; } acc += w; }
    const cur = idxOf(); if (target !== cur && target >= 0){ const a = t7State.clips; const [m] = a.splice(cur, 1); a.splice(target, 0, m); _t7TimelineRaf(); }
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (snapped){ _t7PersistClips(); t7RenderRows(); t7RenderDetail(); } };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7SetRate(v){
  const r = _T7_RATES.find(x => x === Number(v)) || 1;
  t7State.rate = r;
  const b = document.getElementById('t7Rate'); if (b) b.value = String(r);
  // Đang phát thì khởi động lại vòng phát để mốc thời gian tính theo tốc độ mới.
  if (t7State.playing){ t7Pause(); t7Play(); }
}

function t7CycleRate(){
  const i = _T7_RATES.indexOf(t7State.rate || 1);
  t7State.rate = _T7_RATES[(i + 1) % _T7_RATES.length];
  const b = document.getElementById('t7Rate'); if (b) b.textContent = t7State.rate + 'x';
  // Đang phát thì khởi động lại vòng phát để mốc thời gian tính theo tốc độ mới.
  if (t7State.playing){ t7Pause(); t7Play(); }
}

function t7ToggleLoop(){
  t7State.loop = !t7State.loop;
  const b = document.getElementById('t7LoopBtn');
  if (b){ b.style.color = t7State.loop ? 'var(--accent)' : ''; b.style.opacity = t7State.loop ? '1' : '.45'; }
  setStatus7(t7State.loop ? '🔁 Bật lặp lại.' : 'Tắt lặp lại.', 'info');
}

function t7ToggleSafe(){
  const el = document.getElementById('t7Safe'); if (!el) return;
  const on = el.style.display === 'none';
  el.style.display = on ? '' : 'none';
  const b = document.getElementById('t7SafeBtn');
  if (b){ b.style.color = on ? 'var(--accent)' : ''; b.style.opacity = on ? '1' : '.45'; }
}

function t7ToggleSettings(){
  const p = document.getElementById('t7SetPanel'), d = document.getElementById('t7Detail');
  if (!p) return;
  const on = p.style.display === 'none';
  p.style.display = on ? '' : 'none';
  if (d) d.style.display = on ? 'none' : '';
  const b = document.getElementById('t7SetBtn'); if (b) b.classList.toggle('on', on);
  // Cột chi tiết giờ là ngăn trượt ẩn (chi tiết cảnh đã chuyển vào dòng) → bảng ⚙
  // phải tự trượt ra, không thì bấm ⚙ không thấy gì.
  try { on ? t7OpenInsp() : t7CloseInsp(); } catch (e) {}
  if (on) t7RenderSettings();
}

function t7RenderSettings(){
  const box = document.getElementById('t7SetPanel'); if (!box) return;
  const esc = escapeHtml;
  const nSc = (t7State.clips || []).length;
  let nGfx = 0, nTr = 0;
  try { Object.values(state.sceneSpecs || {}).forEach(sp => {
    (sp && Array.isArray(sp.layers) ? sp.layers : []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; });
    if (sp && sp.trans && sp.trans !== 'none') nTr++; }); } catch (e) {}
  const tot = _t7Total();
  const mm = (v) => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
  const sub = (typeof T7_SUBSTYLES === 'object' && T7_SUBSTYLES[state.t7SubStyle || 'vien']) || null;
  const row = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--text-muted)">${k}</span><b>${esc(v)}</b></div>`;
  const swi = (id, lb, on, fn) => `<label style="display:flex;align-items:center;justify-content:space-between;gap:9px;padding:6px 0;font-size:12px;cursor:pointer">
      <span style="color:var(--text-muted)">${lb}</span>
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''} onchange="${fn}" style="accent-color:var(--accent);width:15px;height:15px"></label>`;
  const H = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:13px 0 3px;font-weight:700">${t}</div>`;
  box.innerHTML = `<div style="padding:2px 13px 14px">
    ${H('Hiển thị')}
    ${swi('t7SetSafe', 'Khung an toàn', document.getElementById('t7Safe')?.style.display === '', "t7ToggleSafe()")}
    ${swi('t7SetLoop', 'Lặp khi hết', !!t7State.loop, "t7ToggleLoop()")}
    ${swi('t7SetSub', 'Ghi phụ đề vào video', !!document.getElementById('t7ExpSubs')?.checked, "t7ToggleSubPreview()")}
    ${swi('t7SetSnap', 'Bám mốc khi kéo', t7State.snap !== false, "t7ToggleSnap()")}
    ${H('Dự án')}
    ${row('Thời lượng', mm(tot) + ' (' + tot.toFixed(1) + 's)')}
    ${row('Số cảnh', nSc)}
    ${row('Lớp đồ hoạ', nGfx)}
    ${row('Lớp toàn cục', (state.globalGfx || []).length)}
    ${row('Chuyển cảnh', nTr)}
    ${row('Ảnh đè', (t7State.overlays || []).length)}
    ${row('SFX', (t7State.sfx || []).length)}
    ${row('Kiểu phụ đề', sub ? sub.name : '—')}
    ${row('Tỉ lệ khung', document.getElementById('t7Aspect')?.value || '16:9')}
    <button class="btn ghost sm" style="width:100%;margin-top:11px;justify-content:center" onclick="t7RenderSettings()">↻ Cập nhật số liệu</button>
  </div>`;
}

function t7TogglePlay(){ t7State.playing ? t7Pause() : t7Play(); }

function t7ToggleSubPreview(){
  const cb = document.getElementById('t7ExpSubs'); if (cb) cb.checked = !cb.checked;
  const on = cb ? cb.checked : true;
  const b = document.getElementById('t7SubPrevBtn'); if (b){ b.style.color = on ? 'var(--accent)' : ''; b.style.borderColor = on ? 'var(--accent)' : ''; }
  if (typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(on ? '🅣 Hiện phụ đề (lấy từ lời thoại cảnh) — cũng sẽ ghi vào video khi Xuất.' : 'Đã ẩn phụ đề trên preview.', 'info');
}

function t7Fullscreen(){ try { const el = document.getElementById('t7Player'); if (el && el.requestFullscreen) el.requestFullscreen(); } catch (_) {} }

function t7Play(){
  const total = _t7Total(); if (total <= 0) return;
  if (t7State.playT >= total) t7State.playT = 0;
  t7State.playing = true;
  document.getElementById('t7PlayBtn').textContent = '⏸';
  const au = document.getElementById('t7PreviewAudio');
  if (t7State.audioFile && au){
    // audioFile có thể khôi phục từ phiên trước mà chưa gán src → gán lại để nghe được.
    try { if (!au.src) au.src = URL.createObjectURL(t7State.audioFile); } catch (e) {}
    try { au.currentTime = t7State.playT; au.play(); } catch (e) {}
  }
  const rate = t7State.rate || 1;
  try { if (au) au.playbackRate = rate; } catch (e) {}
  t7State._t0 = performance.now() - (t7State.playT * 1000) / rate;
  let lastScene = null;
  const step = () => {
    if (!t7State.playing) return;
    const au2 = document.getElementById('t7PreviewAudio');
    // Đồng hồ chính = wall-clock (LUÔN tiến). Chỉ để audio dẫn khi nó THỰC SỰ chạy (currentTime>0.01),
    // tránh kẹt kim ở 00:00 khi file VO lớn đang buffer (paused=false nhưng currentTime kẹt 0).
    let t;
    if (t7State.audioFile && au2 && !au2.paused && au2.currentTime > 0.01){
      t = au2.currentTime; t7State._t0 = performance.now() - t * 1000;   // resync wall-clock theo audio
    } else {
      t = (performance.now() - t7State._t0) / 1000 * (t7State.rate || 1);
    }
    t7State.playT = t;
    if (t >= total){
      if (t7State.loop){ t7State.playT = 0; t7Pause(); t7Play(); return; }   // lặp: quay đầu, phát tiếp
      t7State.playT = total; t7Pause(); t7UpdatePlayhead(); t7RenderPreview(); return;
    }
    const at = _t7ClipAt(t);
    if (at && at.clip.id !== lastScene){ lastScene = at.clip.id; t7RenderPreview(); }
    else _t7UpdatePreviewFx();
    t7UpdatePlayhead();
    t7State._raf = requestAnimationFrame(step);
  };
  t7State._raf = requestAnimationFrame(step);
}

function t7Pause(){
  t7State.playing = false;
  const b = document.getElementById('t7PlayBtn'); if (b) b.textContent = '▶';
  const au = document.getElementById('t7PreviewAudio'); if (au) { try { au.pause(); } catch (e) {} }
  // Clip của cảnh chạy bằng thẻ <video> RIÊNG, không dính vào vòng lặp phát.
  // Trước đây chỉ dừng giọng đọc + huỷ rAF → bấm ⏸ mà hình vẫn chạy tiếp.
  const vd = document.getElementById('t7PreviewVid'); if (vd) { try { vd.pause(); } catch (e) {} }
  if (t7State._raf) cancelAnimationFrame(t7State._raf);
}

function t7SeekClick(e){
  const track = document.getElementById('t7Seek'); if (!track) return;
  const r = track.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  t7State.playT = frac * _t7Total();
  const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e2) {} }
  t7State._t0 = performance.now() - t7State.playT * 1000;
  t7UpdatePlayhead(); t7RenderPreview();
}

function t7SeekPointerDown(e){
  const track = document.getElementById('t7Seek'); if (!track) return;
  e.preventDefault();
  const wasPlaying = t7State.playing; if (wasPlaying) t7Pause();
  track.classList.add('drag');
  const seek = (ev) => t7SeekClick(ev);
  seek(e);
  const up = () => {
    window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up);
    track.classList.remove('drag');
    if (wasPlaying) t7Play();
  };
  window.addEventListener('pointermove', seek); window.addEventListener('pointerup', up);
}

function t7RulerPointerDown(e){
  e.preventDefault();
  const inner = document.getElementById('t7TlInner'); if (!inner) return;
  const wasPlaying = t7State.playing; if (wasPlaying) t7Pause();
  const seek = (ev) => {
    const r = inner.getBoundingClientRect();
    const x = ev.clientX - r.left - _T7_GUT;           // lệch của tay nắm rãnh + padding
    t7State.playT = Math.max(0, Math.min(_t7Total(), x / t7State.pps));
    const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e2) {} }
    t7State._t0 = performance.now() - t7State.playT * 1000;
    t7UpdatePlayhead(); t7RenderPreview();
  };
  seek(e);
  const up = () => { window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up); if (wasPlaying) t7Play(); };
  window.addEventListener('pointermove', seek); window.addEventListener('pointerup', up);
}

function t7HookKeys(){
  if (t7State._kbHooked) return; t7State._kbHooked = true;
  document.addEventListener('keydown', (e) => {
    if (state.tool !== 'tool7') return;
    const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) return;
    if (e.key === ' '){ e.preventDefault(); t7TogglePlay(); }
    else if (e.key === 's' || e.key === 'S'){ e.preventDefault(); t7SplitAtPlayhead(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); t7DeleteSel(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); if (e.shiftKey) t7Redo(); else t7Undo(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); t7Redo(); }
  });
}
