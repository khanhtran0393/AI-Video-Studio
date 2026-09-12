/* DASHBOARD — renderDashboard + thống kê + điều khiển auto-run nhanh (dash*)
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _dashStats(){
  const profiles = (state.profiles || []).length;
  let videos = 0; (state.profiles || []).forEach(p => { videos += Array.isArray(p.videos) ? p.videos.length : 1; });
  const doneTotal = parseInt(localStorage.getItem('av_done_total') || '0') || 0;
  const doneMonth = parseInt(localStorage.getItem('av_done_' + _ymKey()) || '0') || 0;
  const producing = (typeof _autoBusy !== 'undefined' && _autoBusy) ? 1 : 0;
  const queue = (typeof _prodQueue !== 'undefined' && Array.isArray(_prodQueue)) ? _prodQueue.length : 0;
  return { profiles, videos, doneTotal, doneMonth, producing, queue };
}

function _dashWorkflow(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const hasStyle = !!(p && (p.characterStyle || p.backgroundStyle || p.sceneStyle));
  const hasScript = (state.script || '').trim().length > 0;
  // Giọng đọc: file đã nạp vào Dựng Video (t7State.audioFile) — pipeline hiện tại dùng file giọng làm master clock.
  const hasVoice = !!(typeof t7State === 'object' && t7State && t7State.audioFile);
  const nScenes = (state.scenes || []).length;
  const nPrompts = Object.keys(state.scenePrompts || {}).filter(k => state.scenePrompts[k]).length;
  const nImg = Object.keys(state.sceneImages || {}).filter(k => state.sceneImages[k]?.base64).length;
  const sv = state.sceneVideos || {}; const nVid = Object.keys(sv).filter(k => sv[k] && !sv[k].error).length;
  const nClips = (typeof t7State === 'object' && t7State && Array.isArray(t7State.clips)) ? t7State.clips.length : 0;
  // 7 bước theo tool THẬT của app hiện tại (Prompt nhân vật & stock đã gộp vào Phân Cảnh).
  const steps = [
    { nm: 'Profile', done: hasStyle, sb: hasStyle ? 'đã có style' : '—', tool: 'tool1' },
    { nm: 'Kịch bản', done: hasScript, sb: hasScript ? (state.script.length + ' ký tự') : '—', tool: 'toolscript' },
    { nm: 'Giọng đọc', done: hasVoice, sb: hasVoice ? 'đã nạp' : '—', tool: 'toolvoice' },
    { nm: 'Phân cảnh', done: nScenes > 0, sb: nScenes ? (nScenes + ' cảnh · ' + nPrompts + ' prompt') : '—', tool: 'tool2' },
    { nm: 'Ảnh cảnh', done: nImg > 0, sb: nImg ? (nImg + ' ảnh') : '—', tool: 'toolflow' },
    { nm: 'Video cảnh', done: nVid > 0, sb: nVid ? (nVid + ' clip') : '—', tool: 'tool6' },
    { nm: 'Dựng video', done: nClips > 0, sb: nClips ? (nClips + ' clip timeline') : '—', tool: 'tool7' },
  ];
  let cur = steps.findIndex(s => !s.done); if (cur < 0) cur = steps.length - 1;
  return { steps, cur };
}

function renderDashboard(){
  const box = document.getElementById('dashBody'); if (!box) return;
  // Đăng nhập đã gỡ bỏ — không còn #userName; header không chào theo user nữa.
  let dateStr = ''; try { dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch {}
  const s = _dashStats();
  const wf = _dashWorkflow();
  const ic = {
    prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    vid: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    scene: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    veo: '<path d="M13 2L4.5 13H11l-1 9 8.5-12H12l1-8z"/>',
  };
  const card = (cls, ico, lab, val) => `<div class="dcard"><span class="ico ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="lab">${lab}</div><div class="val">${val}</div></div></div>`;
  const qa = (act, ico, t, d) => `<a onclick="${act}"><span class="qi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="qt">${t}</div><div class="qd">${d}</div></div></a>`;
  const stepHtml = wf.steps.map((st, i) => `${i ? '<span class="arr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>' : ''}<div class="st ${st.done ? 'done' : (i === wf.cur ? 'cur' : '')}"><div class="dot">${st.done ? '✓' : (i + 1)}</div><div class="nm">${st.nm}</div><div class="sb">${st.sb}</div></div>`).join('');
  const projs = (state.profiles || []).slice(0, 6).map((p, i) => `<div class="dproj"><span class="th">🎬</span><div style="flex:1;min-width:0"><div class="pn">${escapeHtml(p.tenKenh || 'Profile ' + (i + 1))}</div><div class="pd">${(Array.isArray(p.videos) ? p.videos.length : 1)} video · ${escapeHtml(p.ngach || p.visualStyle || '')}</div></div><button class="btn ghost sm" onclick="switchProfile(${i});switchTool('tool1')">Mở</button></div>`).join('') || '<div class="empty-state">Chưa có profile. Bấm "Tạo Profile mới".</div>';

  box.innerHTML = `
    <div><h1 class="dash-hi">Trung tâm sản xuất video 🎬</h1><p class="dash-sub">${dateStr ? dateStr[0].toUpperCase() + dateStr.slice(1) + ' · ' : ''}Kịch bản → ảnh → giọng đọc → dựng video → YouTube, tất cả trong một app · mọi tính năng Pro/Max đã mở khoá sẵn.</p></div>
    <div class="dash-stats">
      ${card('di-green', '<path d="M20 6L9 17l-5-5"/>', 'Video hoàn thành', s.doneTotal)}
      ${card('di-accent', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Đang sản xuất', s.producing)}
      ${card('di-violet', '<path d="M4 6h3M4 12h3M4 18h3"/><rect x="8" y="4" width="12" height="16" rx="2"/>', 'Trong hàng đợi', s.queue)}
      ${card('di-blue', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>', 'Sản xuất tháng này', s.doneMonth)}
      ${card('di-violet', ic.prof, 'Kênh (profile)', s.profiles)}
      ${card('di-teal', ic.vid, 'Tổng video', s.videos)}
    </div>
    <div class="dsec">
      <div class="dsec-h">⚡ Truy cập nhanh</div>
      <div class="dqa">
        ${qa("switchTool('tool1')", ic.prof, 'Profile Kênh', 'Tạo &amp; quản lý kênh')}
        ${qa("switchTool('toolscript')", '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>', 'Tạo Kịch Bản', 'AI viết kịch bản (chế độ Novel)')}
        ${qa("switchTool('tool2')", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>', 'Phân Cảnh', 'Chia cảnh, prompt ảnh &amp; nhân vật')}
        ${qa("switchTool('toolflow')", '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>', 'Tạo Ảnh', 'Google Flow sinh ảnh')}
        ${qa("switchTool('toolvoice')", '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 'Tạo giọng nói', 'OmniVoice TTS')}
        ${qa("switchTool('tool6')", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z"/>', 'Tạo Video', 'Xen video từng cảnh')}
        ${qa("switchTool('tool7')", '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>', 'Dựng Video', 'Timeline, hiệu ứng, xuất file')}
        ${qa("switchTool('toolvideoagent')", '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 12l5 3.5V8.5L8 12z"/>', 'Video Agent', 'Pipeline tự động 17 bước')}
        ${qa("switchTool('toolniche')", '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/>', 'Nghiên cứu Ngách', 'Chủ đề hot &amp; soi đối thủ')}
        ${qa("switchTool('tool9')", '<path d="M12 3l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4"/>', 'YouTube SEO', 'Tiêu đề, mô tả, thumbnail')}
        ${qa("switchTool('toolupscale')", '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-4"/><path d="M14 6h4v4"/><path d="M18 6l-5 5"/>', 'Nâng cấp ảnh', 'Làm nét ảnh cảnh')}
        ${qa("switchTool('tool4')", '<path d="M4 7l3-3 3 3M7 4v9M20 17l-3 3-3-3M17 20v-9"/>', 'Đổi Tên Ảnh', 'Đổi tên hàng loạt')}
        ${qa("switchTool('toolwhiteboard')", '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>', 'Whiteboard Studio', 'SRT → video bảng vẽ tay')}
        ${qa("switchTool('toolhanddraw')", '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', 'Vẽ Tay Ảnh', 'Ảnh tĩnh → video vẽ tay')}
        ${qa("switchTool('toolimzic')", '<path d="M3 12h18M3 4h18M3 20h18"/><path d="M6 4v16"/>', 'I-MZic', 'Ảnh + nhạc, hiệu ứng theo nhịp')}
        ${qa("switchTool('toolsrttranslate')", '<path d="M4 7l3-3 3 3M7 4v9M20 17l-3 3-3-3M17 20v-9"/>', 'Dịch SRT', 'AI dịch phụ đề SRT')}
        ${qa("switchTool('toolviralcut')", '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>', 'Viral Cut', 'Tách highlight viral thành clip ngắn')}
        ${qa("switchTool('toolspy')", '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', 'Spy Storyboard', 'Soi storyboard video đối thủ')}
        ${qa("switchTool('tool10')", '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>', 'Tạo Thumbnail', 'Thumbnail YouTube bằng AI')}
      </div>
    </div>
    <div class="dsec">
      <div class="dsec-h">🛠 Công cụ FFmpeg</div>
      <div class="dqa">
        ${qa("switchTool('toolffxaudio')", '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', 'Tách MP3', 'Tách âm thanh từ video')}
        ${qa("switchTool('toolffxcut')", '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>', 'Cắt Video', 'Cắt theo giây, không re-encode')}
        ${qa("switchTool('toolffxjoin')", '<rect x="2" y="5" width="8" height="14" rx="2"/><rect x="14" y="5" width="8" height="14" rx="2"/><path d="M10 12h4"/>', 'Ghép Video', 'Ghép nhiều file đúng thứ tự')}
        ${qa("switchTool('toolffxloop')", '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/>', 'Loop Video', 'Lặp N lần thành 1 file dài')}
        ${qa("switchTool('toolffxcompress')", '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><path d="M9 12h6"/>', 'Nén Video', 'Giảm dung lượng (H.264 + CRF)')}
        ${qa("switchTool('toolffxframes')", '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 'Trích Frame', 'Trích ảnh theo giây / mỗi N giây')}
        ${qa("switchTool('toolffxmute')", '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/>', 'Xoá Tiếng', 'Xoá track âm, giữ nguyên hình')}
        ${qa("switchTool('toolffxconvert')", '<path d="M17 3l4 4-4 4"/><path d="M21 7H8a5 5 0 00-5 5"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h13a5 5 0 005-5"/>', 'Đổi Định Dạng', 'MP4/WEBM/MKV/MOV · MP3/WAV')}
        ${qa("switchTool('toolffxmusic')", '<rect x="2" y="6" width="12" height="12" rx="2"/><path d="M9 18V5l12-2v13"/><circle cx="18" cy="16" r="3"/>', 'Ghép Nhạc', 'Trộn / thay nhạc nền video')}
        ${qa("switchTool('toolffxgif')", '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 10v4M12 10v4M8 12h2M16 10a2 2 0 000 4"/>', 'Xuất GIF', 'GIF loop palette 2 pass')}
      </div>
    </div>
    <div class="dsec">
      <div class="dsec-h">⚙️ Hệ thống</div>
      <div class="dqa">
        ${qa("switchTool('toolsettings')", '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="3.5" cy="18" r="1.5"/>', 'API &amp; Tài khoản', 'API key, tài khoản Flow &amp; OmniVoice')}
        ${qa("switchTool('toollog')", '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>', 'Nhật ký', 'Lỗi &amp; hoạt động của app')}
      </div>
    </div>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>📈 Tiến độ video hiện tại</span>
        <button class="btn ghost sm" onclick="switchTool('${(wf.steps[wf.cur] && wf.steps[wf.cur].tool) || 'toolscript'}')" style="text-transform:none;letter-spacing:0">Tiếp tục bước này ➜</button>
      </div>
      <div class="dstep">${stepHtml}</div>
    </div>
    <div class="dsec dauto">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>🚀 Sản xuất video tự động — 1 nút chạy cả quy trình</span>
        <button class="btn ghost sm" onclick="queueAdd()" style="text-transform:none;font-weight:600;letter-spacing:0">＋ Thêm vào hàng đợi</button>
      </div>
      <style>@keyframes autopulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dsh-lbl{font-size:12px;color:var(--text-muted);margin:0 0 6px;display:block}
        .dsh-field{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;font-size:13px;color:var(--text);font-family:inherit}
        .dsh-field:focus{outline:none;border-color:var(--accent)}
      </style>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;font-size:13px;padding:9px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px">
        <span style="color:var(--text-muted);white-space:nowrap">💾 Lưu về máy:</span>
        <select id="dashSaveMode" onchange="dashSaveMode(this.value)" style="max-width:220px;width:auto">
          <option value="perTask" selected>Tạo thư mục theo video</option>
          <option value="flat">Lưu thẳng vào thư mục</option>
        </select>
        <input type="text" id="dashSaveName" placeholder="Tên thư mục (tuỳ chọn)" style="max-width:190px" oninput="_autoSaveName=this.value;try{localStorage.setItem('av_save_name',this.value)}catch(e){}">
        <input type="text" id="dashSaveFolder" readonly placeholder="Chưa chọn thư mục lưu" style="flex:1;min-width:180px">
        <button class="btn ghost sm" onclick="autoPickFolder()">📁 Chọn thư mục</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span>⚡ Tài khoản Flow (tạo ảnh):</span>
        <span id="dashFlowAcc">đang kiểm tra…</span>
        <button class="btn ghost sm" style="margin-left:auto" onclick="switchTool('toolflow')">Thêm / quản lý tài khoản</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:14px;font-size:13px">
        <label style="display:flex;gap:8px;align-items:center">Bắt đầu từ:
          <select id="dashStart" style="width:auto" onchange="dashToggleStart()">
            <option value="script" selected>Kịch bản (làm từ đầu)</option>
            <option value="scenes">Prompt cảnh (đã có kịch bản + giọng)</option>
          </select>
        </label>
      </div>
      <div id="dashTopicRow" style="margin-bottom:14px">
        <label class="dsh-lbl">Chủ đề / Tiêu đề video</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
            <select class="dsh-field" style="flex:1;font-size:12px;padding:7px 10px;" onchange="let m=this.value, s=this.nextElementSibling.value, v = m ? (m + (s ? ' - ' : '') + s) : ''; const tt=document.getElementById('dashTopic'); tt.value=v; window._autoTopic=v;">
            <option value="" selected>-- Chọn Chủ Đề --</option>
            <optgroup label="1. CHỦ ĐỀ">
                <option value="Xuyên Không">Xuyên Không</option>
                <option value="Trùng Sinh">Trùng Sinh</option>
                <option value="Hệ Thống">Hệ Thống</option>
                <option value="Sinh Tồn">Sinh Tồn</option>
                <option value="Võ Hiệp">Võ Hiệp</option>
                <option value="Trinh Thám">Trinh Thám</option>
                <option value="Dị Năng">Dị Năng</option>
                <option value="Linh Khí Khôi Phục">Linh Khí Khôi Phục</option>
                <option value="Kinh Dị">Kinh Dị</option>
                <option value="Hài Hước">Hài Hước</option>
                <option value="Cơ Giáp / Mecha">Cơ Giáp / Mecha</option>
                <option value="Ngôn Tình">Ngôn Tình</option>
                <option value="Báo Thù">Báo Thù</option>
                <option value="Phản Công">Phản Công</option>
                <option value="Nông Trường">Nông Trường</option>
                <option value="Thương Chiến">Thương Chiến</option>
                <option value="Quân Sự">Quân Sự</option>
                <option value="Cung Đấu">Cung Đấu</option>
                <option value="Học Đường">Học Đường</option>
                <option value="Thể Thao">Thể Thao</option>
                <option value="Ẩm Thực">Ẩm Thực</option>
                <option value="Y Học">Y Học</option>
                <option value="Game / Võng Du">Game / Võng Du</option>
                <option value="Kỳ Ảo Mạo Hiểm">Kỳ Ảo Mạo Hiểm</option>
                <option value="Thần Thoại">Thần Thoại</option>
                <option value="Đồng Nhân">Đồng Nhân</option>
                <option value="Đạo Tặc / Heist">Đạo Tặc / Heist</option>
                <option value="Chính Trị">Chính Trị</option>
                <option value="Tình Báo">Tình Báo</option>
                <option value="Du Hành / Di Cư">Du Hành / Di Cư</option>
                <option value="Trộm Mộ / Thám Hiểm Cổ Mộ">Trộm Mộ / Thám Hiểm Cổ Mộ</option>
                <option value="Xuyên Sách / Phản Diện">Xuyên Sách / Phản Diện</option>
                <option value="Giải Trí / Showbiz">Giải Trí / Showbiz</option>
                <option value="Điền Viên / Chữa Lành">Điền Viên / Chữa Lành</option>
                <option value="Mạt Thế / Xác Sống">Mạt Thế / Xác Sống</option>
                <option value="Binh Vương / Đặc Chủng">Binh Vương / Đặc Chủng</option>
                <option value="Sống Trùng Lặp (Time Loop)">Sống Trùng Lặp (Time Loop)</option>
                <option value="Triệu Hoán / Ngự Thú">Triệu Hoán / Ngự Thú</option>
                <option value="Xây Dựng Tông Môn">Xây Dựng Tông Môn</option>
                <option value="Nữ Cường / Quyền Lực">Nữ Cường / Quyền Lực</option>
                <option value="Hào Môn Thế Gia">Hào Môn Thế Gia</option>
                <option value="Thần Bí / Cthulhu">Thần Bí / Cthulhu</option>
                <option value="Tâm Cơ / Trí Đấu">Tâm Cơ / Trí Đấu</option>
                <option value="Đa Vũ Trụ">Đa Vũ Trụ</option>
                <option value="Khoa Kỹ / Xây Dựng Căn Cứ">Khoa Kỹ / Xây Dựng Căn Cứ</option>
                <option value="Nghệ Thuật / Âm Nhạc">Nghệ Thuật / Âm Nhạc</option>
                <option value="Tâm Trí / Hack Não">Tâm Trí / Hack Não</option>
                <option value="Quái Vật Khổng Lồ (Kaiju)">Quái Vật Khổng Lồ (Kaiju)</option>
                <option value="Sứ Giả Thần Linh">Sứ Giả Thần Linh</option>
                <option value="Người Ngoài Hành Tinh">Người Ngoài Hành Tinh</option>
                <option value="Truy Tìm Kho Báu">Truy Tìm Kho Báu</option>
                <option value="Thần Đồng / Thiên Tài">Thần Đồng / Thiên Tài</option>
                <option value="Khảo Cổ Viễn Tưởng">Khảo Cổ Viễn Tưởng</option>
                <option value="Đấu Sủng (Trận Chiến Thú Cưng)">Đấu Sủng (Trận Chiến Thú Cưng)</option>
                <option value="Dưỡng Thành (Nuôi Dưỡng Trưởng Thành)">Dưỡng Thành (Nuôi Dưỡng Trưởng Thành)</option>
                <option value="Nghề Nghiệp Đặc Thù">Nghề Nghiệp Đặc Thù (Pháp Y, Tâm Lý...)</option>
                <option value="Trộm Mệnh / Đổi Đời">Trộm Mệnh / Đổi Đời</option>
                <option value="Giấu Giếm Thân Phận (Ẩn Nhẫn)">Giấu Giếm Thân Phận (Ẩn Nhẫn)</option>
                <option value="Nhặt Nhạnh Đồng Nát">Nhặt Nhạnh Đồng Nát (Nhặt ve chai)</option>
                <option value="Phục Sinh / Hồi Sinh">Phục Sinh / Hồi Sinh</option>
                <option value="Siêu Trí Tuệ Ái Nhân (AI Romance)">Siêu Trí Tuệ Ái Nhân (AI Romance)</option>
                <option value="Đấu Trí Phòng Kín (Escape Room)">Đấu Trí Phòng Kín (Escape Room)</option>
                <option value="Phá Mộng / Xuyên Mộng">Phá Mộng / Xuyên Mộng</option>
                <option value="Thế Giới Ngầm (Underworld)">Thế Giới Ngầm (Underworld)</option>
                <option value="Cuộc Chiến Băng Đảng">Cuộc Chiến Băng Đảng</option>
                <option value="Bảo Tiêu / Lính Đánh Thuê">Bảo Tiêu / Lính Đánh Thuê</option>
                <option value="Ma Pháp Sư / Phù Thủy Học Việc">Ma Pháp Sư / Phù Thủy Học Việc</option>
                <option value="Đọa Lạc / Sa Ngã (Corruption Arc)">Đọa Lạc / Sa Ngã (Corruption Arc)</option>
                <option value="Thay Trời Hành Đạo">Thay Trời Hành Đạo</option>
                <option value="Diệt Thần (Godslayer)">Diệt Thần (Godslayer)</option>
                <option value="Săn Lùng Quái Vật (Monster Hunter)">Săn Lùng Quái Vật (Monster Hunter)</option>
                <option value="Thức Tỉnh Cột Mốc">Thức Tỉnh Cột Mốc (Awakening Event)</option>
                <option value="Sinh Sinh Diệt Diệt">Sinh Sinh Diệt Diệt (Reincarnation Cycle)</option>
                <option value="Trốn Tìm Sinh Tử">Trốn Tìm Sinh Tử (Deadly Hide & Seek)</option>
                <option value="Cấm Thuật / Huyết Tế">Cấm Thuật / Huyết Tế</option>
                <option value="Nghịch Thiên Cải Mệnh">Nghịch Thiên Cải Mệnh</option>
                <option value="Cờ Bạc / Xúc Xắc Sinh Tử">Cờ Bạc / Xúc Xắc Sinh Tử</option>
                <option value="Sinh Tồn Nơi Hoang Dã">Sinh Tồn Nơi Hoang Dã</option>
                <option value="Chinh Phục Ngọn Núi">Chinh Phục Ngọn Núi</option>
                <option value="Thám Hiểm Đáy Biển">Thám Hiểm Đáy Biển Mảnh Vỡ</option>
                <option value="Phiêu Lưu Trên Bầu Trời">Phiêu Lưu Trên Bầu Trời (Sky Islands)</option>
                <option value="Sát Thủ Bàn Phím (Cyber Hacker)">Sát Thủ Bàn Phím (Cyber Hacker)</option>
                <option value="Truy Ký Hiệp Khách">Truy Ký Hiệp Khách</option>
                <option value="Giới Thượng Lưu / Gia Tộc">Giới Thượng Lưu / Gia Tộc Bí Ẩn</option>
                <option value="Đảo Ngược Thời Gian (Rewind)">Đảo Ngược Thời Gian (Rewind)</option>
                <option value="Cây Sinh Mệnh / Thần Mộc">Cây Sinh Mệnh / Thần Mộc</option>
                <option value="Hồi Ức Chắp Vá (Amnesia)">Hồi Ức Chắp Vá (Amnesia)</option>
                <option value="Sinh Vật Biến Đổi Gen">Sinh Vật Biến Đổi Gen</option>
                <option value="Kho Tàng Thư Viện">Kho Tàng Thư Viện Chứa Bí Mật</option>
                <option value="Tội Phạm Hoàn Hảo">Tội Phạm Hoàn Hảo</option>
                <option value="Lãnh Chúa / Lãnh Địa">Lãnh Chúa / Lãnh Địa Khai Hoang</option>
                <option value="Nhà Thám Hiểm / Phiêu Lưu Giả">Nhà Thám Hiểm / Phiêu Lưu Giả</option>
                <option value="Truy Tìm Dấu Tích">Truy Tìm Dấu Tích Chủng Tộc Cũ</option>
                <option value="Giả Tưởng Học Đường">Giả Tưởng Học Đường (Magic School)</option>
                <option value="Giới Trẻ Lạc Lối">Giới Trẻ Lạc Lối (Youth Rebellion)</option>
                <option value="Nuôi Con / Papa/Mama">Nuôi Con / Papa/Mama (Parenting)</option>
                <option value="Nhập Vai Kháng Địch">Nhập Vai Kháng Địch (Tower Defense)</option>
                <option value="Cảnh Sát Hình Sự">Cảnh Sát Hình Sự / Thám Tử Tư</option>
                <option value="Bậc Thầy Sân Khấu / Ảo Thuật">Bậc Thầy Sân Khấu / Ảo Thuật</option>
                <option value="Giao Dịch Ác Quỷ">Giao Dịch Ác Quỷ (Devil's Bargain)</option>
            </optgroup>
          </select>
            <select class="dsh-field" style="flex:1;font-size:12px;padding:7px 10px;" onchange="let m=this.previousElementSibling.value, s=this.value, v = (m && s) ? (m + ' - ' + s) : (m || ''); const tt=document.getElementById('dashTopic'); tt.value=v; window._autoTopic=v;">
            <option value="" selected>-- Phong Cách --</option>
            <optgroup label="2. PHONG CÁCH">
                <option value="Tu Tiên / Tiên Hiệp">Tu Tiên / Tiên Hiệp</option>
                <option value="Huyền Huyễn">Huyền Huyễn</option>
                <option value="Đô Thị">Đô Thị</option>
                <option value="Viễn Tưởng">Viễn Tưởng</option>
                <option value="Dystopia">Dystopia</option>
                <option value="Cổ Đại">Cổ Đại</option>
                <option value="Cyberpunk">Cyberpunk</option>
                <option value="Steampunk">Steampunk</option>
                <option value="Hắc Ám">Hắc Ám</option>
                <option value="Đồng Nhân">Đồng Nhân</option>
                <option value="Kiếm Hiệp">Kiếm Hiệp</option>
                <option value="Huyền Nghi">Huyền Nghi</option>
                <option value="Tâm Lý Tội Phạm">Tâm Lý Tội Phạm</option>
                <option value="Siêu Anh Hùng">Siêu Anh Hùng</option>
                <option value="Western">Western</option>
                <option value="Hải Tặc">Hải Tặc</option>
                <option value="Không Gian">Không Gian</option>
                <option value="Xây Dựng Thế Giới">Xây Dựng Thế Giới</option>
                <option value="Đông Phương Kỳ Ảo">Đông Phương Kỳ Ảo</option>
                <option value="Phương Tây Kỳ Ảo">Phương Tây Kỳ Ảo</option>
                <option value="LitRPG">LitRPG</option>
                <option value="Military Sci-Fi">Military Sci-Fi</option>
                <option value="Romantasy">Romantasy</option>
                <option value="Slice of Life">Slice of Life</option>
                <option value="Epic / Sử Thi">Epic / Sử Thi</option>
                <option value="Gothic">Gothic</option>
                <option value="Thriller">Thriller</option>
                <option value="Hard Sci-Fi">Hard Sci-Fi</option>
                <option value="Noir">Noir</option>
                <option value="Biopunk">Biopunk</option>
                <option value="Post-Apocalyptic">Post-Apocalyptic (Hậu Tận Thế)</option>
                <option value="Lovecraftian">Lovecraftian / Cosmic Horror</option>
                <option value="Dark Comedy">Dark Comedy (Hài Đen)</option>
                <option value="Magical Realism">Magical Realism (Hiện Thực Huyền Ảo)</option>
                <option value="Grimdark">Grimdark</option>
                <option value="Urban Legend">Urban Legend (Truyền Thuyết Đô Thị)</option>
                <option value="Dark Fairy Tale">Dark Fairy Tale (Cổ Tích Đen)</option>
                <option value="Alternate History">Alternate History (Lịch Sử Giả Định)</option>
                <option value="Whodunit">Whodunit (Phá Án Suy Luận)</option>
                <option value="Space Opera">Space Opera</option>
                <option value="Solar Punk">Solar Punk</option>
                <option value="Atompunk">Atompunk</option>
                <option value="Giallo">Giallo / Án mạng kinh dị</option>
                <option value="Isekai">Isekai</option>
                <option value="Wuxia Truyền Thống">Wuxia Truyền Thống</option>
                <option value="Xianxia Cổ Điển">Xianxia Cổ Điển</option>
                <option value="Low Fantasy">Low Fantasy</option>
                <option value="High Fantasy">High Fantasy</option>
                <option value="Surrealism">Surrealism (Siêu Thực)</option>
                <option value="Psychological Horror">Psychological Horror (Kinh Dị Tâm Lý)</option>
                <option value="Mythopoeia">Mythopoeia (Kiến tạo Thần Thoại)</option>
                <option value="Urban Fantasy">Urban Fantasy (Kỳ Ảo Đô Thị)</option>
                <option value="Dark Academia">Dark Academia</option>
                <option value="Light Academia">Light Academia</option>
                <option value="Sword and Sorcery">Sword and Sorcery (Kiếm & Ma Thuật)</option>
                <option value="Flintlock Fantasy">Flintlock Fantasy (Kỳ Ảo Súng Hỏa Mai)</option>
                <option value="Gaslamp Fantasy">Gaslamp Fantasy (Kỳ Ảo Đèn Khí Đá)</option>
                <option value="Weird West">Weird West (K Kỳ Ảo Viễn Tây)</option>
                <option value="Space Western">Space Western (Viễn Tây Vũ Trụ)</option>
                <option value="Cassette Futurism">Cassette Futurism</option>
                <option value="Raypunk">Raypunk (Sci-Fi Thập niên 50)</option>
                <option value="Nanopunk">Nanopunk (Công nghệ Nano)</option>
                <option value="Splatterpunk">Splatterpunk (Bạo lực máu me)</option>
                <option value="Bizarro Fiction">Bizarro Fiction (Viễn Tưởng Kỳ Dị)</option>
                <option value="Slipstream">Slipstream (Giả Tưởng Đa Tầng)</option>
                <option value="Paranormal Romance">Paranormal Romance (Lãng Mạn Siêu Nhiên)</option>
                <option value="Apocalyptic">Apocalyptic (Hủy Diệt Đồng Loạt)</option>
                <option value="Cli-Fi">Cli-Fi (Viễn Tưởng Khí Hậu)</option>
                <option value="Solarpunk Cổ Điển">Solarpunk Cổ Điển</option>
                <option value="Decopunk">Decopunk (Nghệ thuật & Công nghệ)</option>
                <option value="Mythic Fiction">Mythic Fiction (Tiểu Thuyết Huyền Đam)</option>
                <option value="Fairy Tale Retelling">Fairy Tale Retelling (Kể Lại Cổ Tích)</option>
                <option value="Grimms' Fairy Tales">Grimms' Fairy Tales (Phong cách Grimm)</option>
                <option value="Arthurian Legend">Arthurian Legend (Huyền thoại vua Arthur)</option>
                <option value="Ninja / Samurai Fiction">Ninja / Samurai Fiction</option>
                <option value="Mecha-Musume">Mecha-Musume (Cơ Giáp Nữ Sinh)</option>
                <option value="Sentai / Tokusatsu">Sentai / Tokusatsu</option>
                <option value="Magical Girl">Magical Girl (Mahou Shoujo)</option>
                <option value="B-Movie Horror">B-Movie Horror (Kinh Dị Bình Dân)</option>
                <option value="Slasher">Slasher (Sát Nhân Hàng Loạt)</option>
                <option value="Found Footage">Found Footage (Phim Tài Liệu Giả)</option>
                <option value="Gothic Romance">Gothic Romance</option>
                <option value="Southern Gothic">Southern Gothic</option>
                <option value="Suburban Gothic">Suburban Gothic</option>
                <option value="Hard-boiled Detective">Hard-boiled Detective (Thám Tử Gai Góc)</option>
                <option value="Cozy Mystery">Cozy Mystery (Trinh Thám Ấm Áp)</option>
                <option value="Legal Thriller">Legal Thriller (Giật Gân Tòa Án)</option>
                <option value="Medical Thriller">Medical Thriller (Giật Gân Y Khoa)</option>
                <option value="Techno-Thriller">Techno-Thriller (Giật Gân Công Nghệ)</option>
                <option value="Spy Fiction">Spy Fiction (Tiểu Thuyết Gián Điệp)</option>
                <option value="Heist / Caper">Heist / Caper (Siêu Trộm)</option>
                <option value="Picaresque">Picaresque (Lãng Tử / Giang Hồ)</option>
                <option value="Bildungsroman">Bildungsroman (Trưởng Thành qua Thử Thách)</option>
                <option value="Epistolary">Epistolary (Viết Dưới Dạng Thư Từ)</option>
                <option value="Metafiction">Metafiction (Tiểu Thuyết Siêu Cấu Trúc)</option>
                <option value="Satire / Trào Phúng">Satire / Trào Phúng</option>
                <option value="Absurdist Fiction">Absurdist Fiction (Phi Lý)</option>
                <option value="Utopian">Utopian (Xã Hội Không Tưởng)</option>
                <option value="Speculative Evolution">Speculative Evolution (Tiến Hóa Giả Định)</option>
                <option value="New Weird">New Weird (Tân Kỳ Dị)</option>
            </optgroup>
          </select>
        </div>
        <input id="dashTopic" class="dsh-field" placeholder="Hoặc tự nhập: Bí ẩn sự sụp đổ của Đế chế La Mã" oninput="_autoTopic=this.value">
        <div id="dashWordsWrap" style="display:flex;align-items:flex-end;gap:12px;margin-top:12px;flex-wrap:wrap">
          <div>
            <label class="dsh-lbl">Chương</label>
            <input id="dashChapters" class="dsh-field" type="number" min="1" step="1" value="1" oninput="dashWordEst()" style="width:90px">
          </div>
          <div>
            <label class="dsh-lbl">Từ / chương</label>
            <input id="dashWordsPerChapter" class="dsh-field" type="number" min="100" step="100" value="1200" oninput="dashWordEst()" style="width:110px">
          </div>
          <div style="flex:1;min-width:150px">
            <label class="dsh-lbl">Ngôn ngữ</label>
            <select id="dashLang" class="dsh-field" style="padding:7px 10px"></select>
          </div>
          <span id="dashWordEst" style="font-size:12px;color:var(--text-dim);white-space:nowrap;padding-bottom:11px">Tổng dự tính: ~9 phút · ≈ 9 phút/chương</span>
        </div>
      </div>
      <div id="dashPrepared" style="display:none;margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">📄 Kịch bản (file .txt)</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <input type="file" id="dashScriptFile" accept=".txt,text/plain" onchange="dashLoadScriptFile(this.files)">
          <span id="dashScriptName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px">Để trống = tự lấy kịch bản từ tab Tạo Kịch Bản / Phân Cảnh.</div>
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">🎙 File giọng đọc <span style="text-transform:none">(tuỳ chọn)</span></label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input type="file" id="dashVoiceFile" accept="audio/*" onchange="dashPickVoice(this.files)">
          <span id="dashVoiceName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px">Để trống file giọng = video xuất không kèm tiếng (ghép sau ở Dựng Video).</div>
      </div>
      <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:2px">Điền form rồi bấm <b>Chạy hàng đợi</b> (dưới). Luồng tự động chạy tới <b>Dựng video</b> rồi <b>dừng</b> (chưa xuất file) — bạn sang tab <b>Dựng Video</b> kiểm/tạo lại cảnh lỗi rồi tự bấm <b>Xuất</b>. Muốn làm nhiều: bấm <b>Thêm vào hàng đợi</b> từng cái rồi mới Chạy.</div>
      <div id="autoLog" style="font-size:12.5px;color:var(--text-muted);margin-top:6px;min-height:18px"></div>
    </div>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>Hàng đợi <span id="queueCount" style="color:var(--text-muted);font-weight:400;font-size:12px;text-transform:none;letter-spacing:0">0 mục</span></span>
        <span style="display:flex;gap:8px">
          <button class="btn primary sm" id="queueRunBtn" onclick="runQueue()" style="text-transform:none;letter-spacing:0">▶ Chạy hàng đợi</button>
          <button class="btn sm" id="queueStopBtn" onclick="queueStop()" style="display:none;background:var(--red);color:#fff;text-transform:none;letter-spacing:0">■ Dừng</button>
        </span>
      </div>
      <div id="queueList"></div>
    </div>
    <details class="dsec" style="margin-top:0">
      <summary style="cursor:pointer;list-style:none;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between">
        <span>🕘 Lịch sử chạy</span>
        <span onclick="event.preventDefault();_histClear()" style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-dim);cursor:pointer">Xoá lịch sử</span>
      </summary>
      <div id="histList" style="margin-top:10px"></div>
    </details>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>🎬 Kênh của bạn</span>
        <button class="btn ghost sm" onclick="switchTool('tool1')" style="text-transform:none;letter-spacing:0">Quản lý Profile ➜</button>
      </div>
      ${projs}
    </div>`;
  try {
    _histRender();
    _dashFlowStatus();
    _autoRender();
    const tt = document.getElementById('dashTopic'); if (tt && _autoTopic) tt.value = _autoTopic;
    const sm = document.getElementById('dashSaveMode'); if (sm) sm.value = _autoSaveMode;
    const snm = document.getElementById('dashSaveName'); if (snm) snm.value = _autoSaveName || '';
    dashSaveMode(_autoSaveMode);
    const sf = document.getElementById('dashSaveFolder'); if (sf) { const base = _autoOutDir || _autoDefaultDir; if (base) sf.value = base; }
    const ss = document.getElementById('dashStart'); if (ss) ss.value = _autoStartFrom;
    // QUY MÔ: mirror giá trị tab Tạo Kịch Bản (chương × từ/chương × ngôn ngữ); danh sách ngôn ngữ
    // clone từ tsLang — không nhân đôi 27 option giữa 2 nơi (một nguồn, một hợp đồng).
    const dl = document.getElementById('dashLang');
    if (dl) { const sl = document.getElementById('tsLang'); if (sl) { dl.innerHTML = sl.innerHTML; dl.value = sl.value || 'Tiếng Việt'; } }
    const dch = document.getElementById('dashChapters'), dwpc = document.getElementById('dashWordsPerChapter');
    const tch = document.getElementById('tsChapters'), twpc = document.getElementById('tsWordsPerChapter');
    if (dch && tch) dch.value = tch.value;
    if (dwpc && twpc) dwpc.value = twpc.value;
    if (typeof dashWordEst === 'function') dashWordEst();
    dashToggleStart();
    const vn = document.getElementById('dashVoiceName'); if (vn && _autoVoiceFile) vn.textContent = '✓ ' + _autoVoiceFile.name;
    if (_autoLastLog) _autoLog(_autoLastLog.msg, _autoLastLog.type);
    queueRender();
    if (_queueRunning) { const r = document.getElementById('queueRunBtn'), st = document.getElementById('queueStopBtn'); if (r) r.style.display = 'none'; if (st) st.style.display = ''; }
  } catch (e) {}
}

function _isQuotaErr(m){ return /quota|giới hạn|hết lượt|hết token|hết ngày|hết lần|daily|rate.?limit|429|too many|exhaust|limit reach|out of credit|no credit|insufficient credit|hết credit/i.test(String(m || '')); }

function _clipEntities(){
  const out = [];
  try { (state.charactersV || []).forEach(n => out.push(n)); } catch (e) {}
  try { (state.backgroundsV || []).forEach(n => out.push(n)); } catch (e) {}
  return out.map(x => String(x || '').trim()).filter(Boolean).slice(0, 12);
}

async function _autoFetchWebClips(scenes, budgetMs){
  if (!Array.isArray(scenes) || !scenes.length) return { ok: 0, fail: 0, stop: '' };
  if (typeof searchWebSources !== 'function' || typeof webLayClip !== 'function')
    return { ok: 0, fail: 0, stop: 'chưa nạp được nguồn web' };
  if (!window.native || !window.native.nguonWeb) return { ok: 0, fail: 0, stop: 'chỉ chạy trong app Nova' };
  const _han = Date.now() + (budgetMs || 20 * 60000);
  if (!state.mediaPicks) state.mediaPicks = {};
  if (!state.webCandidates) state.webCandidates = {};
  let ok = 0, fail = 0, lienTiep = 0, stop = '', xong = 0;
  const _N = _t2SoLuong();
  await _t2SongSong(scenes, _N, async (s) => {
    if (Date.now() > _han){ if (!stop) stop = 'hết giờ cho phép, còn ' + (scenes.length - xong) + ' cảnh'; return; }
    _autoLog(`🌐 Tìm tư liệu web cảnh ${s.id} (${++xong}/${scenes.length}, ${_N} luồng)…`);
    try {
      const r = await t2FetchWebOne(s.id);
      if (r.err) throw new Error(r.err);
      if (!r.added) throw new Error('không có ứng viên nào hợp');
      // Lượt tự động chỉ lấy ứng viên dùng được cho kênh kiếm tiền.
      const hopA = (state.webCandidates[s.id] || []).filter(x => !x.camTM);
      const pick = _t2XepUngVien(hopA, s, _t2DaDung(s.id)).ds[0] || hopA[0];
      if (!pick) throw new Error('không có ứng viên nào dùng được (còn lại đều cấm thương mại)');
      const clip = await webLayClip(pick, parseFloat(s.duration) || 4);
      if (!clip.ok) throw new Error(clip.error);
      state.mediaPicks[s.id] = { kind: 'video', downloadUrl: clip.dataUrl, source: pick.source,
        duration: clip.duration, web: true, trangUrl: pick.trangUrl, license: pick.license, author: pick.author };
      ok++; lienTiep = 0;
      if (typeof novaLog === 'function') novaLog(`🌐 Cảnh ${s.id} gắn tư liệu ${webNhan(pick.platId)}: "${String(pick.ten || '').slice(0, 50)}".`, 'ok');
    } catch (e){
      fail++; lienTiep++;
      const msg = String((e && e.message) || e).slice(0, 90);
      if (typeof novaLog === 'function') novaLog(`🌐 Cảnh ${s.id} không lấy được tư liệu web: ${msg}`, 'warn');
      // Ba cảnh liên tiếp hỏng thường là bị chặn nhịp hoặc mất mạng — dừng cả bước
      // còn hơn ngồi đốt thời gian cho 300 cảnh nữa cũng hỏng y hệt.
      if (lienTiep >= 3 && !stop) stop = msg;
    }
  }, () => _autoAbort || state.cancelRequested || !!stop);
  if (!stop && (_autoAbort || state.cancelRequested)) stop = 'đã dừng';
  try { if (ok && typeof saveState === 'function') saveState(true); } catch (e) {}
  return { ok, fail, stop };
}

async function _autoFetchYtClips(scenes, budgetMs){
  if (!Array.isArray(scenes) || !scenes.length) return { ok: 0, fail: 0, stop: '' };
  const _deadline = Date.now() + (budgetMs || 15 * 60000);   // mỗi cảnh ~40-60s → giới hạn để bước Xen video không bị 'Quá giờ'
  if (!window.native || typeof window.native.smartClip !== 'function' || typeof window.native.readFileB64 !== 'function')
    return { ok: 0, fail: 0, stop: 'chỉ chạy trong app Nova' };
  if (!state.mediaPicks) state.mediaPicks = {};
  if (!state.ytCandidates) state.ytCandidates = {};
  let ok = 0, fail = 0, streak = 0, stop = '', xong = 0;
  const _ents = _clipEntities();
  /* yt-dlp + ffmpeg mỗi cảnh ~40-60s. Chạy song song rút thẳng theo số luồng,
     nhưng YouTube chặn IP nhanh hơn các trang khác nên giữ tối đa 2 luồng.  */
  const _N = Math.min(2, _t2SoLuong());
  await _t2SongSong(scenes, _N, async (s) => {
    if (Date.now() > _deadline){ if (!stop) stop = 'hết giờ cho phép, còn ' + (scenes.length - xong) + ' cảnh'; return; }
    _autoLog(`▶️ Tìm clip YouTube cảnh ${s.id} (${++xong}/${scenes.length}, ${_N} luồng)…`);
    try {
      const hint = (state.scenePrompts && state.scenePrompts[s.id]) || (state.scenePrompts2 && state.scenePrompts2[s.id]) || '';
      const dur = parseFloat(s.duration) || 4;
      const r = await window.native.smartClip({ narration: s.text || '', hint, duration: dur, vision: false, score: true, entities: _ents });
      if (!r || !r.ok) throw new Error((r && r.error) || 'không tìm được clip');
      const b = await window.native.readFileB64(r.path);
      if (!b || !b.dataUrl) throw new Error('không đọc được clip');
      if (r.candidates && r.candidates.length) state.ytCandidates[s.id] = r.candidates;
      state.mediaPicks[s.id] = { kind: 'video', downloadUrl: b.dataUrl, source: r.source || 'yt-smart', duration: r.duration || dur };
      ok++; streak = 0;
      if (typeof novaLog === 'function') novaLog(`▶️ Cảnh ${s.id} gắn clip YouTube: "${_logClip(r.query || '')}".${(r.notes && r.notes.length) ? ' (' + r.notes.join(' · ') + ')' : ''}`, 'ok');
    } catch (e){
      fail++; streak++;
      const msg = String((e && e.message) || e).slice(0, 90);
      if (typeof novaLog === 'function') novaLog(`▶️ Cảnh ${s.id} không lấy được clip: ${msg}`, 'warn');
      if (streak >= 3 && !stop) stop = msg;
    }
  }, () => _autoAbort || state.cancelRequested || !!stop);
  if (!stop && (_autoAbort || state.cancelRequested)) stop = 'đã dừng';
  try { if (ok && typeof saveState === 'function') saveState(true); } catch (e) {}
  return { ok, fail, stop };
}

function dashSaveMode(v){
  _autoSaveMode = v || 'perTask'; try { localStorage.setItem('av_save_mode', _autoSaveMode); } catch (e) {}
  const nm = document.getElementById('dashSaveName'); if (nm) nm.style.display = _autoSaveMode === 'flat' ? 'none' : '';
}

function dashToggleStart(){
  const sel = document.getElementById('dashStart'); const v = sel ? sel.value : 'script';
  _autoStartFrom = v;
  const box = document.getElementById('dashPrepared'); if (box) box.style.display = v === 'scenes' ? 'block' : 'none';
  // Khối Chủ đề + QUY MÔ chỉ hiện khi làm từ đầu (viết kịch bản); từ Prompt cảnh → ẩn cả khối.
  const trow = document.getElementById('dashTopicRow'); if (trow) trow.style.display = v === 'scenes' ? 'none' : '';
  const wrow = document.getElementById('dashWordsWrap'); if (wrow) wrow.style.display = v === 'scenes' ? 'none' : 'flex';
}

function dashPickVoice(files){
  const f = files && files[0]; _autoVoiceFile = f || null;
  const nm = document.getElementById('dashVoiceName'); if (nm) nm.textContent = f ? ('✓ ' + f.name) : '';
}

function dashWordEst(){
  // Cùng công thức ước lượng như khối QUY MÔ tab Tạo Kịch Bản (140 từ/phút).
  const ch = parseInt(document.getElementById('dashChapters')?.value) || 1;
  const wpc = parseInt(document.getElementById('dashWordsPerChapter')?.value) || 0;
  const el = document.getElementById('dashWordEst');
  if (!el) return;
  if (!wpc) { el.textContent = ''; return; }
  const total = ch * wpc, speed = 140;
  el.textContent = 'Tổng dự tính: ~' + Math.max(1, Math.round(total / speed)) + ' phút · ≈ ' + Math.max(1, Math.round(wpc / speed)) + ' phút/chương';
}

async function dashLoadScriptFile(files){
  const f = files && files[0]; if (!f) return;
  try {
    const txt = await f.text();
    _autoScriptText = (txt || '').trim();
    const nm = document.getElementById('dashScriptName'); if (nm) nm.textContent = '✓ ' + f.name;
    _autoLog('✓ Đã tải kịch bản từ ' + f.name, 'ok');
  } catch (e) { _autoLog('Không đọc được file: ' + (e.message || e), 'error'); }
}

