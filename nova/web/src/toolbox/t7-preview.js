/* T7 PREVIEW — dựng khung xem trước (t7RenderPreview) + timeline (t7RenderTimeline)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7RenderPreview(){
  _t7UpdateOverlay();
  try { _t7DrawGfx(); } catch (e) {}   // 🖼 ảnh đè full-frame lên trên
  try { _t7DrawSel(); } catch (e) {}   // 🖱 khung 8 nút của lớp đang chọn (kéo/co trực tiếp) (nếu playhead nằm trong khoảng của nó)
  // Ảnh/video hiển thị = clip tại playhead (nhất quán khi phát/tua/chọn).
  const at = _t7ClipAt(t7State.playT);
  const c = (at && at.clip) || t7State.clips.find(x => x.id === t7State.selClip) || t7State.clips[0];
  // Nhãn "Cảnh N" ở giữa bản xem trước LUÔN khớp clip đang hiện (kể cả khi tua/phát) — hết kẹt nhãn cũ.
  const _stage = document.getElementById('t7StageChip'); if (_stage) _stage.textContent = c ? _t7ClipLabel(c) : '—';
  // Lời thoại + dịch tiếng Việt dưới bản xem trước (chỉ để kiểm tra, KHÔNG ghi vào video).
  const vo = (c && _t7ClipText(c) || '').trim();
  const vi = (c && state.sceneTrans && state.sceneTrans[c.sceneId] || '').trim();
  const subOn = !!document.getElementById('t7ExpSubs')?.checked;   // đang burn phụ đề vào video?
  // Phụ đề ĐÈ LÊN video xem trước — GIỐNG y hệt lúc xuất (WYSIWYG). Chỉ hiện khi bật "Ghi phụ đề vào video".
  const subEl = document.getElementById('t7PreviewSub');
  if (subEl){
    const burnTxt = (subOn && c && !c.imported) ? vo : '';
    if (burnTxt){
      const player = document.getElementById('t7Player');
      const h = (player && player.clientHeight) || 300;
      const fsz = Math.max(13, Math.round(h * 0.075));   // ~ khớp cỡ chữ burn (co theo khung)
      const sv = (typeof T7_SUBSTYLES !== 'undefined') ? T7_SUBSTYLES[state.t7SubStyle || 'vien'] : null;
      const isBox = sv && /background/.test(sv.prev);
      subEl.style.cssText = `position:absolute;left:4%;right:4%;bottom:9%;z-index:6;text-align:center;font-weight:800;line-height:1.18;pointer-events:none;white-space:pre-wrap;font-size:${fsz}px;`;
      if (isBox){ subEl.innerHTML = `<span style="display:inline-block;${sv.prev}">${escapeHtml(burnTxt)}</span>`; }
      else { subEl.style.cssText += (sv ? sv.prev : 'color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.6)'); subEl.textContent = burnTxt; }
      subEl.style.display = '';
    } else subEl.style.display = 'none';
  }
  const cap = document.getElementById('t7PreviewCap');
  if (cap){
    const showVoBelow = vo && !subOn;   // đang burn → VO đã hiện TRÊN video; dưới chỉ để bản dịch tham khảo
    if (showVoBelow || vi){ cap.style.display = ''; cap.innerHTML = (showVoBelow ? `<div class="vo">“${escapeHtml(vo)}”</div>` : '') + (vi ? `<div class="vi">${escapeHtml(vi)}</div>` : ''); }
    else cap.style.display = 'none';
  }
  const vid = document.getElementById('t7PreviewVid');
  const useVid = _t7UsesVideo(c);
  // ---- nhánh VIDEO ----
  if (useVid && vid){
    const el0 = document.getElementById('t7PreviewImg'); if (el0) el0.style.display = 'none';
    const empty0 = document.getElementById('t7PreviewEmpty'); if (empty0) empty0.style.display = 'none';
    const url = _t7ClipVideoUrl(c);
    const dur = _t7ClipDur(c);
    // So NGUỒN THẬT (URL + mediaId), KHÔNG so id clip: Tách/Đồng bộ sinh clip id MỚI
    // nhưng vẫn cùng video → trước đây vid.src bị gán lại = reload = khung đen → NHÁY.
    // (Đổi nguồn thật — chọn clip khác/đổi media — URL hoặc mediaId đổi và vẫn nạp lại đúng.)
    const urlS = String(url || ''), midS = String(c.mediaId || '');
    const changed = vid.getAttribute('data-src') !== urlS || vid.getAttribute('data-mid') !== midS;
    // poster = ảnh của ĐÚNG clip đang dùng: clip stock tải từ mạng, chưa có khung hình đầu
    // thì khung xem trước trống trơn / còn dính cảnh cũ.
    if (changed){ vid.poster = _t7ThumbImg(c) || ''; vid.src = url; }
    vid.setAttribute('data-cid', c.id); vid.setAttribute('data-src', urlS); vid.setAttribute('data-mid', midS);
    vid.style.display = '';
    // KHỚP EXPORT: giữ TỐC ĐỘ GỐC (rate 1) — video dài hơn cảnh → cắt; ngắn hơn → lặp (thẻ <video loop>). KHÔNG tua nhanh/chậm.
    vid.playbackRate = 1; if (changed) vid.onloadedmetadata = () => { vid.playbackRate = 1; };
    const local = Math.max(0, t7State.playT - _t7ClipStart(at.index));
    const vd = c.vidDur || vid.duration || dur;
    if (t7State.playing){ if (changed){ try { vid.currentTime = 0; } catch (e) {} } try { if (vid.paused) vid.play(); } catch (e) {} }
    else {
      try {
        vid.pause();
        const lt = (vd > 0.1) ? (local % vd) : local;
        const target = Math.min(lt, (vid.duration || vd) - 0.05);
        // CHỈ seek khi mốc thật sự lệch: render lặp (Tách/Đồng bộ khi nguồn không đổi)
        // mà vẫn ghi currentTime → video đang pause decode lại khung → chớp màn hình.
        if (changed || Math.abs(vid.currentTime - target) > 0.05) vid.currentTime = target;
      } catch (e) {}
    }
    return;
  }
  // Rời nhánh video → chỉ ẩn + pause, GIỮ data-src/data-mid làm khoá cache:
  // quay lại CÙNG video sau đó không phải nạp lại (không nháy).
  if (vid){ try { vid.pause(); } catch (e) {} vid.style.display = 'none'; vid.removeAttribute('data-cid'); }
  const img = c ? _t7ClipImg(c) : null;
  const el = document.getElementById('t7PreviewImg'), empty = document.getElementById('t7PreviewEmpty');
  if (img){
    // Khoá invalidation = ẢNH (chuỗi src) + mediaId, KHÔNG phải id clip: Tách/Đồng bộ
    // render lại preview cùng ảnh → trước đây gán el.src + reset animation MỖI lần
    // → ảnh nạp lại / animation đứt → NHÁY.
    const imgS = String(img || ''), midS = String((c && c.mediaId) || '');
    const changed = el.getAttribute('data-src') !== imgS || el.getAttribute('data-mid') !== midS;
    if (changed){ el.src = img; el.setAttribute('data-src', imgS); el.setAttribute('data-mid', midS); }
    el.style.display = ''; el.setAttribute('data-cid', c ? c.id : '');
    el.style.transformOrigin = 'center'; el.style.transform = (c && c.scale && c.scale !== 1) ? ('scale(' + c.scale + ')') : '';   // 🔍 tỉ lệ ảnh
    if (empty) empty.style.display = 'none';
    // hiệu ứng vào cảnh mới theo kiểu chuyển cảnh của clip TRƯỚC
    const wrap = document.getElementById('t7PreviewWrap');
    const prev = (at && at.index > 0) ? t7State.clips[at.index - 1] : null;
    if (wrap){
      const kf = { fade: 't7fade', dissolve: 't7fade', slide: 't7slide', wipe: 't7wipe', circle: 't7circle' };
      const name = (changed && prev && kf[prev.trans]) ? kf[prev.trans] : null;
      // CHỈ reset animation khi ẢNH thật sự đổi (chuyển cảnh). Trước đây reset MỌI lần
      // render → animation đang chạy bị đứt ngay khi Tách/Đồng bộ → nháy.
      if (changed){
        wrap.style.animation = 'none'; void wrap.offsetWidth;   // reset để chạy lại
        if (name) wrap.style.animation = `${name} ${(prev.transDur || 0.5)}s ease both`;
      }
    }
  } else { el.style.display = 'none'; el.removeAttribute('data-cid'); if (empty) empty.style.display = ''; }
  _t7UpdatePreviewFx();
}

function t7RenderTimeline(){
  try { t7RenderRail(); } catch (e) {}
  // Timeline đang ẩn → khỏi dựng. Vẫn chạy hết phần trên để rail/số liệu đúng.
  const _tl = document.getElementById('t7Tl');
  if (_tl && _tl.style.display === 'none') return;
  try { t7RenderTlStats(); } catch (e) {}
  const clips = _t7Clips();
  const total = _t7Total();
  const pps = t7State.pps = (parseInt(document.getElementById('t7Zoom')?.value) || 80) / 10;
  document.getElementById('t7TlTotal').textContent = total ? (_t7Fmt(total) + ' · ' + total.toFixed(1) + 's · ' + clips.length + ' clip') : '0s';
  const step = total > 120 ? 20 : 10;
  const ruler = document.getElementById('t7Ruler');
  if (ruler){ let h = ''; for (let t = 0; t <= total + step; t += step) h += `<span style="flex:0 0 auto;width:${step * pps}px">${_t7Fmt(t)}</span>`; ruler.innerHTML = h; }
  // subtitle chips theo clip
  const subs = document.getElementById('t7TrkSubs');
  // ⚠️ Bề rộng phụ đề = ĐÚNG thời lượng × pps (KHÔNG min-width) để khớp thước thời gian + playhead + preview.
  if (subs) subs.innerHTML = clips.map(c => `<div class="t7-sub" style="width:${Math.max(2, _t7ClipDur(c) * pps)}px" title="${escapeHtml(_t7ClipText(c))}">${escapeHtml((_t7ClipText(c) || '—').trim() || '—')}</div>`).join('');
  // scene clips (có handle trim + chọn + kéo)
  const trk = document.getElementById('t7TrkScenes');
  if (trk){
    // KHÔNG nhét base64 vào innerHTML (264 clip = chuỗi HTML ~13MB → khựng). Chỉ dựng khung; ảnh gắn LAZY khi cuộn tới (IntersectionObserver).
    trk.innerHTML = clips.map((c, i) => {
      const d = _t7ClipDur(c);
      const w = Math.max(2, d * pps); const sel = c.id === t7State.selClip;
      // Ba mức theo bề rộng: ≥60px hiện TÊN + phụ · ≥20px chỉ số giây · nhỏ hơn thì khối trơn.
      // 192 clip trên 16 phút mà cố nhét chữ thì thành một dải mù.
      const tier = w >= 60 ? 'lg' : (w >= 20 ? 'sm' : 'xs');
      const src = _t7UsesVideo(c) ? 'src-vid' : (_t7ClipImg(c) ? 'src-img' : 'src-none');
      const xf = ((c.trans || 'none') !== 'none' && i < clips.length - 1) ? `<span class="t7-xf" title="Chuyển cảnh: ${escapeHtml(c.trans)}">⋈</span>` : '';
      const sub = d.toFixed(1) + 's' + (tier === 'lg' ? ' · ' + escapeHtml(_t7UsesVideo(c) ? _t7VidKind(c) : (_t7ClipImg(c) ? 'ảnh AI' : 'thiếu ảnh')) : '');
      const box = tier === 'xs' ? '' :
        `<span class="t7-clipbox">${tier === 'lg' ? `<span class="t7-clipname">${escapeHtml(_t7ClipLabel(c))}</span>` : ''}<span class="t7-cliplab">${sub}</span></span>`;
      return `<div class="t7-clip tier-${tier} ${src}${sel ? ' sel' : ''}" data-cid="${c.id}" data-idx="${i}" onpointerdown="t7ClipPointerDown(event,'${c.id}')" style="width:${w}px" title="Cảnh ${escapeHtml(c.sceneId)} · ${d.toFixed(1)}s (kéo mép phải để chỉnh)">${box}<span class="t7-trim" onpointerdown="t7TrimPointerDown(event,'${c.id}')"></span>${xf}</div>`;
    }).join('');
    _t7LazyThumbs(trk, '.t7-clip[data-cid]', trk.closest('.t7-tlscroll'));
  }
  // ── RÃNH ĐỒ HOẠ + CHUYỂN CẢNH ────────────────────────────────────────────
  // Đặt tuyệt đối theo giây (không xếp dòng như rãnh Cảnh) vì nhiều lớp chồng thời gian nhau.
  const gtrk = document.getElementById('t7TrkGfx');
  if (gtrk){
    // Gom TOÀN BỘ lớp về mốc tuyệt đối rồi XẾP TẦNG: lớp nào chồng thời gian với lớp
    // đang ở tầng đó thì đẩy xuống tầng dưới. Trước đây mọi lớp cùng top → nhãn đè lên nhau.
    let acc = 0; const all = [];
    clips.forEach((c) => {
      const d = _t7ClipDur(c);
      _t7GfxLayers(c.sceneId).forEach(({ L, i }) => {
        const at = Math.max(0, Number(L.at) || 0);
        const until = (L.until != null) ? Math.min(d, Number(L.until)) : d;
        all.push({ c, L, i, s: acc + at, e: acc + Math.max(at + 0.15, until) });
      });
      acc += d;
    });
    all.sort((a, b) => a.s - b.s);
    const MAXROW = 3;
    const lastEnd = [];                                   // mốc kết thúc của từng tầng
    all.forEach(x => {
      let r = lastEnd.findIndex(e => e <= x.s + 1e-6);
      if (r < 0){ r = Math.min(lastEnd.length, MAXROW - 1); }
      lastEnd[r] = x.e; x.row = r;
    });
    const rows = Math.max(1, Math.min(MAXROW, lastEnd.length));
    // Mỗi tầng là MỘT HÀNG CAO ĐẦY ĐỦ (kiểu CapCut), không bóp lại. Rãnh tự cao lên theo số tầng.
    const dense = pps < 12;
    const rowH = dense ? 14 : 34, gap = 3;
    gtrk.parentElement.style.height = (rows * (rowH + gap) + 6) + 'px';
    gtrk.style.height = '100%';

    const html = all.map(x => {
      const { c, L, i } = x;
      const key = c.sceneId + ':' + i;
      const kind = _t7GfxKind(L);
      const top = 3 + x.row * (rowH + gap);
      const w = Math.max(dense ? 4 : 16, (x.e - x.s) * pps - 2);
      const sel = _t7GfxSel === key ? ' sel' : '';
      const nm = _t7GfxName(L);
      const tip = escapeHtml(nm) + ' · cảnh ' + escapeHtml(c.sceneId);
      const st = `left:${5 + x.s * pps}px;width:${w}px;top:${top}px;height:${rowH}px`;
      if (dense){
        return `<div class="t7-gtick k-${kind}${sel}" style="${st}"
          onclick="t7GfxJump('${c.id}','${c.sceneId}',${i})" title="${tip}"></div>`;
      }
      // Hàng cao đầy đủ → hiện được 2 dòng như clip cảnh, ngưỡng thấp hơn vì đã có chỗ.
      const big = w >= 66;
      const sub = (L.template || L.bit || L.type || '') + ' · ' + (x.e - x.s).toFixed(1) + 's';
      return `<div class="t7-gclip k-${kind}${big ? ' big' : ''}${sel}" style="${st}"
        onclick="t7GfxJump('${c.id}','${c.sceneId}',${i})" title="${tip}">${
          big ? `<b>${escapeHtml(nm)}</b><s>${escapeHtml(sub)}</s>`
              : (w > 40 ? escapeHtml(nm) : '')}</div>`;
    }).join('');
    gtrk.innerHTML = html;
    gtrk.style.width = Math.max(60, total * pps + 10) + 'px';
    const cnt = document.getElementById('t7GfxCount');
    if (cnt) cnt.textContent = all.length ? (all.length + ' lớp' + (dense ? ' · phóng to để xem tên' : '')) : '';
  }
  const ttrk = document.getElementById('t7TrkTrans');
  if (ttrk){
    let acc = 0, html = '';
    clips.forEach((c, i) => {
      acc += _t7ClipDur(c);
      if (i >= clips.length - 1) return;                       // cảnh cuối không có mối nối sau
      const nx = clips[i + 1];
      const tn = (nx.trans && nx.trans !== 'none') ? nx.trans : '';
      // Cảnh KHÔNG có chuyển cảnh chỉ vẽ chấm mờ 3px — 191 viên rỗng như trước là nhiễu mắt.
      html += tn
        ? `<div class="t7-tclip on" style="left:${5 + acc * pps - 8}px" onclick="t7TransJump('${nx.id}')" title="Chuyển cảnh: ${escapeHtml(tn)}">⋈</div>`
        : `<div class="t7-tdot" style="left:${5 + acc * pps - 1.5}px" onclick="t7TransJump('${nx.id}')" title="Cắt thẳng — bấm để chọn kiểu"></div>`;
    });
    ttrk.innerHTML = html;
    ttrk.style.width = Math.max(60, total * pps + 10) + 'px';
  }

  // audio + music waveform
  const _waveRow = (file, peaks, dur, fillVar, label) => {
    if (!file) return `<div class="t7-wave" style="color:var(--text-dim)">— chưa có ${label} —</div>`;
    const w = Math.max(60, (dur || total) * pps);
    // Dải ĐẶC màu, sóng vẽ đè bằng mực tối — nhìn ra ngay là rãnh tiếng, khác hẳn
    // vệt nhạt 12% trước đây gần như tàng hình trên nền timeline.
    return `<div class="t7-wave" style="width:${w}px;padding:0;background:linear-gradient(180deg,${fillVar},color-mix(in srgb,${fillVar} 78%,#000));position:relative;overflow:hidden">${_t7WaveSvg(peaks, 'rgba(30,20,0,.45)')}<span style="position:absolute;left:8px;top:3px;font-size:10px;font-weight:700;color:rgba(30,20,0,.78);pointer-events:none">${escapeHtml(file.name)}</span></div>`;
  };
  const aw = document.getElementById('t7TrkAudio'); if (aw) aw.innerHTML = _waveRow(t7State.audioFile, t7State.audioPeaks, t7State.audioDur, '#efb02f', 'giọng đọc');
  const mw = document.getElementById('t7TrkMusic'); if (mw) mw.innerHTML = _waveRow(t7State.bgmFile, t7State.bgmPeaks, t7State.bgmDur, '#5b8dd9', 'nhạc nền');
  // 🖼 Lớp trên (overlay full-frame) — đặt theo start, rộng theo dur
  const ov = document.getElementById('t7TrkOverlay');
  if (ov){
    const list = t7State.overlays || [];
    const globs = _t7Globs();
    // Lớp đồ hoạ toàn cục vẽ chung rãnh với ảnh đè — cả hai đều tính giây theo CẢ VIDEO.
    const gHtml = globs.map((g, i) => {
      const left = 5 + Math.max(0, Number(g.start) || 0) * pps;
      const w = Math.max(18, (Number(g.dur) || 3) * pps - 2);
      const nm = _t7GfxName(g.layer || {});
      return `<div class="t7-gclip k-${_t7GfxKind(g.layer || {})}${_t7GlobSel === i ? ' sel' : ''}${w >= 66 ? ' big' : ''}"
        style="left:${left}px;width:${w}px;top:3px;bottom:3px;height:auto" onclick="t7GlobPick(${i})"
        title="${escapeHtml(nm)} · toàn cục ${(Number(g.start)||0).toFixed(1)}s → ${((Number(g.start)||0)+(Number(g.dur)||3)).toFixed(1)}s">${
          w >= 66 ? `<b>${escapeHtml(nm)}</b><s>toàn cục · ${(Number(g.dur)||3).toFixed(1)}s</s>` : (w > 40 ? escapeHtml(nm) : '')}</div>`;
    }).join('');
    if (!list.length && !globs.length){ ov.innerHTML = '<div class="t7-ovempty">Kéo hiệu ứng vào đây để phủ CẢ VIDEO, hoặc bấm “＋ ảnh” để thêm ảnh đè.</div>'; }
    else ov.innerHTML = gHtml + list.map(o => {
      const left = 5 + Math.max(0, (o.start || 0)) * pps, w = Math.max(20, (o.dur || 3) * pps); const sel = o.id === t7State.selOverlay;
      return `<div class="t7-ov${sel ? ' sel' : ''}" data-oid="${o.id}" onpointerdown="t7OverlayPointerDown(event,'${o.id}')" style="left:${left}px;width:${w}px;background-image:url('${o.dataUrl}')" title="${escapeHtml(o.name || 'Ảnh đè')} · ${(o.dur||3).toFixed(1)}s (kéo để dời, kéo mép phải để chỉnh dài)"><span class="lab">${escapeHtml(o.name || 'Ảnh đè')}</span><span class="trim" onpointerdown="t7OverlayTrim(event,'${o.id}')"></span></div>`;
    }).join('');
  }
  // 🔊 Hiệu ứng âm thanh (SFX) — đặt theo start.
  const sx = document.getElementById('t7TrkSfx');
  if (sx){
    const list = t7State.sfx || [];
    sx.innerHTML = list.map(s => {
      const left = 5 + Math.max(0, (s.start || 0)) * pps;
      return `<div class="t7-ov" data-sid="${s.id}" style="left:${left}px;width:auto;padding:0 9px;min-width:44px;background:#8a3d5e;display:flex;align-items:center;gap:6px" title="${escapeHtml(s.name||'SFX')} · tại ${(s.start||0).toFixed(1)}s"><span class="lab" style="position:static">🔊 ${escapeHtml((s.name||'sfx').slice(0,14))}</span><span style="cursor:pointer;color:#ffd0e0" onclick="event.stopPropagation();t7DelSfx('${s.id}')">✕</span></div>`;
    }).join('') || '<div class="t7-ovempty">Bấm “＋ SFX” để thêm hiệu ứng âm thanh tại vạch phát.</div>';
  }
  // Ẩn track TRỐNG cho gọn (thêm lại qua nút 🖼/🔊 ở thanh công cụ / “Chọn” ở Âm thanh & Xuất).
  const _showRow = (rid, show) => { const el = document.getElementById(rid); if (el) el.style.display = show ? '' : 'none'; };
  // Luôn hiện ĐỦ track (như mockup) — kể cả trống, để thấy rõ cấu trúc nhiều lằn.
  _showRow('t7RowOverlay', true);
  _showRow('t7RowAudio', true);
  _showRow('t7RowMusic', true);
  _showRow('t7RowSfx', true);
  t7UpdatePlayhead();
}
