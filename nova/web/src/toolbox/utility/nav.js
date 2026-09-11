/* NAV — switchTool: điều hướng giữa các tool panel
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function switchTool(name){
  if (name === 'toollog') { setTimeout(novaLogRender, 0); }
  if (name === 'tooladmin') {
    if (!isAdmin()) return;   // tab admin: chỉ admin
  } else if (name === 'toolsettings') {
    /* trang Cài đặt: luôn cho vào */
  }
  // Free XEM được mọi tool (không chặn ở đây); chặn ở NÚT hành động trong từng tool → hiện thông báo.
  // I-MZic: nếu iframe đang ghi video (MediaRecorder) thì CHẶN chuyển tool —
  // Chromium throttle canvas của iframe ẩn → video xuất ra đứng hình giữa chừng.
  if (state.tool === 'toolimzic' && name !== 'toolimzic') {
    const _izFrame = document.getElementById('imzicFrame');
    let _izExporting = false;
    try { _izExporting = !!(_izFrame && _izFrame.contentWindow && _izFrame.contentWindow.__imzicExporting === true); }
    catch (e) { /* iframe chưa nạp / lỗi same-origin — không chặn */ }
    if (_izExporting) {
      if (typeof novaToast === 'function') novaToast('Đang xuất video I-MZic — chờ ghi xong rồi mới chuyển tab (chuyển sớm sẽ làm video đứng hình).');
      return;
    }
  }
  state.tool = name;
  document.querySelectorAll('.nav-item').forEach(t =>
    t.classList.toggle('active', t.dataset.tool === name)
  );
  document.querySelectorAll('.tool').forEach(t =>
    t.classList.toggle('active', t.id === 'tool-' + name)
  );
  // Tool-specific init
  if (name === 'tool2' && typeof renderSceneTypeToggles === 'function') { renderSceneTypeToggles(); if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn(); }
  if (name === 'tooldash' && typeof renderDashboard === 'function') renderDashboard();
  if (name === 'tool6'){ if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); if (typeof tvFlowStatus === 'function') tvFlowStatus(); if (typeof tvLoadModelKeys === 'function') tvLoadModelKeys(); if (typeof tvOnModelChange === 'function') tvOnModelChange(); if (typeof tvSetMode === 'function') tvSetMode(document.getElementById('tvMode')?.value || 'scene'); if (typeof tvRenderVideos === 'function') tvRenderVideos(); }
  if (name === 'tool8' && typeof t8Init === 'function') t8Init();
  if (name === 'tool7' && typeof t7Build === 'function') t7Build();
  if (name === 'toolanim' && typeof animInit === 'function') animInit();   // tab Hoạt Ảnh — nạp kho hiệu ứng chuyển động
  if (name === 'tool9' && typeof t9Init === 'function') t9Init();
  if (name === 'tool9' && typeof t10Init === 'function') t10Init();   // khởi tạo state thumbnail (ảnh mẫu profile…) dùng chung với tab Tạo Thumbnail
  if (name === 'tool9' && typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 200);   // bước 2 (thumbnail) chỉ mở khi đã có tiêu đề
  if (name === 'tool10'){
    if (typeof t10Init === 'function') t10Init();                     // nạp ảnh mẫu từ Profile + prefill tiêu đề + sync nhãn style kênh
    if (typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 200);   // gate "Tạo Thumbnail" nằm trong tool-tool10 → refresh như tool9
  }
  if (name === 'toolniche' && typeof nicheInit === 'function') nicheInit();
  if (name === 'toolflow'){ if (typeof tfInit === 'function') tfInit(); if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); }
  if (name === 'tool2'){ try { t2RenderNguon(); } catch (e) {} }
  if (name === 'toolsettings'){ if (typeof _relocateSettings === 'function') _relocateSettings(); if (typeof tfInit === 'function') tfInit(); if (typeof loadApiSettings === 'function') try { loadApiSettings(); } catch(e){} if (typeof t11Init === 'function') try { t11Init(); } catch(e){} }
  if (name === 'toolvoice'){
    // Ba việc độc lập: OmniVoice có thể chưa cài mà giọng đám mây vẫn phải hiện.
    if (typeof voiceInit === 'function') voiceInit();
    if (typeof giongTaiDS === 'function') giongTaiDS();
    if (typeof giongKiemEngine === 'function') giongKiemEngine();
  }
  if (name === 'toolupscale' && typeof upInit === 'function') upInit();
  if (name === 'toolscript' && typeof tsInit === 'function') tsInit();
  if (name === 'toolvideoagent') {
    if (window.videoAgentPanel && typeof window.videoAgentPanel.init === 'function') {
      window.videoAgentPanel.init();
    }
  }
  if (name === 'toolwhiteboard') {
    const _wbC = document.getElementById('whiteboardRoot');
    if (_wbC && window.WhiteboardPanel && typeof window.WhiteboardPanel.init === 'function') {
      try { window.WhiteboardPanel.init(_wbC); }
      catch (e) { console.error('[whiteboard] init lỗi:', e); }
    }
  }
  if (name === 'toolhanddraw') {
    const _hdC = document.getElementById('handdrawRoot');
    if (_hdC && window.HanddrawPanel && typeof window.HanddrawPanel.init === 'function') {
      try { window.HanddrawPanel.init(_hdC); }
      catch (e) { console.error('[handdraw] init lỗi:', e); }
    }
  }
  if (name === 'toolsrttranslate') {
    const _stC = document.getElementById('srtTranslateRoot');
    if (_stC && window.SrtTranslatePanel && typeof window.SrtTranslatePanel.init === 'function') {
      try { window.SrtTranslatePanel.init(_stC); }
      catch (e) { console.error('[srt-translate] init lỗi:', e); }
    }
  }
  if (name === 'toolimzic') {
    const frame = document.getElementById('imzicFrame');
    const isLoaded = frame && (frame.getAttribute('data-loaded') === '1');
    if (frame && !isLoaded) {
      const target = frame.getAttribute('data-src') || 'img-to-vid.html';
      frame.src = target;
      frame.setAttribute('data-loaded', '1');
    }
    if (frame && frame.style) {
      frame.style.display = 'block';
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.minHeight = '75vh';
    }
  }
  if (name === 'tooladmin' && typeof admListUsers === 'function') admListUsers();
  if (name === 'tooladmin' && typeof admRenderDash === 'function') admRenderDash();
  if (typeof _syncChLang === 'function') _syncChLang();   // áp ngôn ngữ kênh vào tool vừa mở
}

