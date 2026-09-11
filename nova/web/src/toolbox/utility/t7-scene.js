/* T7 — Nova timeline/editor — THẺ CẢNH: scene body, note, storyboard cell, quick frames, stock fill urls
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7QuickFrames(id){
  return Promise.all([1, 2, 3].map(n => new Promise(res => {
    const u = `https://i.ytimg.com/vi/${id}/hq${n}.jpg`, im = new Image();
    im.onload = () => res(im.naturalWidth > 100 ? u : '');   // 120×90 = ảnh thay thế, bỏ
    im.onerror = () => res('');
    im.src = u;
  }))).then(a => a.filter(Boolean));
}

function _t7SbCell(sb, t){
  if (!sb || !Array.isArray(sb.frags) || !sb.frags.length) return null;
  let i = 0, acc = 0;
  for (; i < sb.frags.length; i++){
    const d = sb.frags[i].dur || 0;
    if (t < acc + d || i === sb.frags.length - 1) break;
    acc += d;
  }
  const f = sb.frags[i]; if (!f) return null;
  const per = (f.dur || 1) / (sb.rows * sb.cols);          // mỗi ô phủ bao nhiêu giây
  const k = Math.max(0, Math.min(sb.rows * sb.cols - 1, Math.floor((t - acc) / per)));
  return { url: f.url, x: (k % sb.cols) * sb.w, y: Math.floor(k / sb.cols) * sb.h, w: sb.w, h: sb.h,
    sw: sb.w * sb.cols, sh: sb.h * sb.rows };
}

function _t7SetNote(sceneId, msg, type){
  if (msg) _t7Notes[sceneId] = { msg, type: type || 'info' }; else delete _t7Notes[sceneId];
  setStatus7(msg || '', type);
  t7RenderSceneList();
}

function _t7NoteHtml(sceneId){
  const n = _t7Notes[sceneId]; if (!n) return '';
  const col = { ok:'var(--green)', error:'var(--red)', working:'var(--violet)', info:'var(--text-muted)' }[n.type] || 'var(--text-muted)';
  return `<div style="font-size:11.5px;line-height:1.5;margin:7px 0 0;color:${col}">${escapeHtml(n.msg)}</div>`;
}

function _t7SceneBody(c){
  const esc = escapeHtml;
  const useVid = _t7UsesVideo(c);
  const pk = (state.mediaPicks || {})[c.sceneId] || {};
  const isStock = /pexels|stock|pixabay|coverr/i.test(pk.source || '');
  // Dọn rác cũ: bản trước lưu mục giả "(chọn tay)" (không link xem được, không ảnh)
  // mỗi lần chọn clip bằng tay, ghi đè cả danh sách thật. Đã chặn ghi mới, nhưng
  // dự án cũ vẫn còn — lọc ở đây để không hiện ra như một ứng viên.
  // ⚠️ Ứng viên hai nguồn có SƠ ĐỒ TRƯỜNG KHÁC NHAU:
  //   YouTube → url / title / thumbnail / durationSec
  //   Stock   → downloadUrl / thumb / duration  (không có url, không có title)
  // Lọc theo mỗi x.url là quét sạch clip stock — tìm được 8 clip mà vẫn báo "chưa có".
  const _clean = (a) => (a || []).filter(x => x && (x.url || x.downloadUrl) && x.title !== '(chọn tay)');
  const yt = _clean((state.ytCandidates || {})[c.sceneId]);
  const st = _clean((state.stockCandidates || {})[c.sceneId]);
  // Tab mặc định = nguồn cảnh đang dùng; sau đó theo lựa chọn của người dùng.
  const now = !useVid ? 'ai' : (isStock ? 'st' : 'yt');
  const tab = _t7SrcTab[c.sceneId] || now;

  const seg = `<div class="t7-seg">
    <button class="${tab === 'ai' ? 'on' : ''}" onclick="event.stopPropagation();t7UseImage('${c.id}');t7SrcTab('${c.sceneId}','ai')">🖼 Ảnh AI</button>
    <button class="${tab === 'yt' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','yt')">🎬 YouTube${yt.length ? ` <span class="cnt">${yt.length}</span>` : ''}</button>
    <button class="${tab === 'st' ? 'on' : ''}" onclick="event.stopPropagation();t7SrcTab('${c.sceneId}','st')">🔍 Stock${st.length ? ` <span class="cnt">${st.length}</span>` : ''}</button>
  </div>`;

  // ── nội dung theo TỪNG tập, không trộn ──
  let body = '';
  if (tab === 'ai'){
    const img = _t7ClipImg(c);
    body = `<div class="t7-slb">Ảnh AI của cảnh</div>` + (img
      ? `<div style="display:flex;gap:9px;align-items:center">
           <span style="display:block;width:112px;height:63px;border-radius:7px;background:#0b1020 center/cover no-repeat url('${esc(img)}');border:1.5px solid ${now === 'ai' ? 'var(--accent)' : 'transparent'}"></span>
           <span style="font-size:11px;color:var(--text-dim);line-height:1.5">Ảnh do AI dựng ở tab Phân Cảnh.<br>Muốn đổi hình thì sang tập YouTube hoặc Stock.</span>
         </div>`
      : `<div style="font-size:11.5px;color:var(--text-dim);line-height:1.55">Cảnh chưa có ảnh AI. Sang tab <b style="color:var(--text)">Phân Cảnh</b> bấm ✨ Tạo ảnh, hoặc chọn clip ở tập YouTube / Stock.</div>`);
  } else {
    const list = tab === 'yt' ? yt : st;
    const label = tab === 'yt' ? 'YouTube' : 'Stock';
    const find = tab === 'yt' ? `t7SrcYt('${c.id}','${c.sceneId}')` : `t7SrcStock('${c.sceneId}')`;
    const more = tab === 'yt' ? `t7OpenYtPicker('${c.sceneId}')` : `t2OpenStockPicker('${c.sceneId}')`;
    // Clip đang chạy chỉ được đánh ✓ khi cảnh THẬT SỰ dùng video của ĐÚNG nguồn này.
    // ⚠️ pk.downloadUrl là ĐƯỜNG DẪN FILE ĐÃ CẮT trên máy — không bao giờ trùng url
    // YouTube của thẻ, nên trước đây không thẻ nào được đánh dấu "đang dùng".
    // Nguồn thật nằm ở state.clipSrc[sceneId].url; so thêm cả theo id video để
    // youtu.be/XXX và watch?v=XXX vẫn khớp nhau.
    const cur = (useVid && now === tab) ? (pk.downloadUrl || pk.url || '') : '';
    const curSrc = (useVid && now === tab) ? (((state.clipSrc || {})[c.sceneId] || {}).url || '') : '';
    const curId = _t7YtId(curSrc);
    if (!list.length){
      body = `<div class="t7-slb">Clip ${label}</div>
        <div style="font-size:11.5px;color:var(--text-dim);line-height:1.55;margin-bottom:7px">Chưa tìm clip ${label} cho cảnh này.</div>
        <button class="btn ghost sm" style="padding:5px 13px;font-size:11.5px;border-color:var(--accent);color:var(--accent);font-weight:600" onclick="event.stopPropagation();${find}">🔎 Tìm clip ${label}</button>` + _t7NoteHtml(c.sceneId);
    } else {
      /* 🎯 Khớp lời chỉ hiện khi cảnh ĐANG dùng video của tập này — nó cắt lại
         chính clip đang gắn, không có clip thì không có gì để cắt.           */
      const _coNguon = !!(useVid && now === tab && (((state.clipSrc || {})[c.sceneId] || {}).url || c.srcUrl));
      body = `<div class="t7-slb" style="justify-content:flex-end;gap:10px">
          ${_coNguon ? `<button style="border:0;background:none;color:var(--teal);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            title="Bóc băng video nguồn rồi cắt lại đúng giây đang nói nội dung cảnh này. Chỉ hợp với tư liệu CÓ LỜI (phát biểu, phỏng vấn, điều trần) — b-roll không có gì để khớp. Tải tiếng có thể mất từ 10 giây tới vài phút tuỳ nền tảng."
            onclick="event.stopPropagation();t7KhopLoi('${c.id}')">🎯 Khớp lời</button>` : ''}
          <button style="border:0;background:none;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:0;text-transform:none;padding:0"
            onclick="event.stopPropagation();${more}">🔎 Tìm thêm</button></div>
        <div class="t7-strip">${list.map((x, i) => {
          const xu = x.url || x.downloadUrl || '';
          const xth = tab === 'yt' ? (x.thumbnail || x.thumb || '') : _stockThumb(x);
          const xdur = x.durationSec || x.duration || 0;
          const xti = x.title || (x.kind === 'image' ? '🖼 Ảnh' : '🎞 Clip') + ' ' + (x.source || 'stock');
          const on = (cur && (xu === cur || x.downloadUrl === cur))
                  || (curSrc && xu === curSrc)
                  || (curId && _t7YtId(xu) === curId);
          const fn = tab === 'yt' ? `t7PickYt('${c.sceneId}',${i})` : `t2PickStock('${c.sceneId}',${i})`;
          // Xem thử động chỉ có nghĩa với YouTube (dựa vào id video để đoán link ảnh).
          const hov = tab === 'yt' ? ` onmouseenter="t7CandHover('${esc(xu)}',this)" onmouseleave="t7CandLeave()"` : '';
          return `<button class="t7-cd${on ? ' on' : ''}"${on ? ' data-on="1"' : ''} onclick="event.stopPropagation();${fn}" title="${esc(xti)}"${hov}>
            <span class="im${xth ? '' : ' noimg'}"${xth ? ` style="background-image:url('${esc(xth)}')"` : ''}>${on ? '<u>✓</u><em>đang dùng</em>' : ''}${xdur ? `<s>${Math.round(xdur)}s</s>` : ''}</span>
            <i>${esc(String(xti).slice(0, 48))}</i></button>`;
        }).join('')}</div>` + _t7NoteHtml(c.sceneId);
    }
  }

  let nGfx = 0;
  try { const sp = (state.sceneSpecs || {})[c.sceneId];
    (sp && sp.layers || []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; }); } catch (e) {}
  const ft = `<div class="t7-sft">
    <span>Dài <b class="k">${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s</b></span>
    ${nGfx ? `<button class="gf" onclick="event.stopPropagation();t7GfxClearScene('${c.sceneId}')"
        title="Đồ hoạ do 🎬 AI dựng đồ hoạ gắn vào — bấm để gỡ khỏi cảnh này">✦ ${nGfx} lớp ✕</button>`
      : '<span style="color:var(--text-dim)">—</span>'}
    <span style="flex:1"></span>
    <button onclick="event.stopPropagation();t7DupSel()">⧉ Nhân đôi</button>
    <button class="dg" onclick="event.stopPropagation();t7DeleteSel()">🗑 Xoá</button>
  </div>`;
  return `<div class="t7-sbd">${seg}${body}${ft}</div>`;
}

async function _t7StockFillUrls(c, sceneDur, vd){
  if (!c || c.imported) return [];
  const pk = state.mediaPicks?.[c.sceneId];
  if (!pk || pk.kind !== 'video') return [];
  if (!(vd > 0.1) || vd >= sceneDur - 0.05) return [];
  const cands = (state.stockCandidates || {})[c.sceneId] || [];
  const others = cands.filter(x => x && x.kind === 'video' && x.downloadUrl && x.downloadUrl !== pk.downloadUrl);
  const out = []; let need = sceneDur - vd;
  for (const o of others){
    if (need <= 0.05) break;
    try { let u = o.downloadUrl; if (/^https?:/.test(u)) u = await _t7UrlToDataUrl(u); out.push(u); need -= Math.max(1, Number(o.duration) || 2); }
    catch (e){ /* bỏ ứng viên tải lỗi */ }
  }
  return out;
}
