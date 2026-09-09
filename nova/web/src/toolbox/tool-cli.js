/* AUTO-EXTRACTED from index.html block 3 - prefix: cli */

async function cliLogin(){
  const ep = _cliEp();
  const box = document.getElementById('cliLoginBox');
  if (!ep){ box.innerHTML = '<span style="color:var(--red)">Nhập Endpoint trước (vd http://localhost:8795).</span>'; return; }
  box.innerHTML = '⏳ Đang kiểm tra…';
  // 1) Đã đăng nhập sẵn trên máy? → dùng luôn, khỏi làm gì.
  if (await _cliTestWorks(ep)){ box.innerHTML = '<span style="color:var(--green)">✅ Đã đăng nhập sẵn trên máy này — dùng được luôn.</span>'; return; }
  // 2) Chưa → khởi động đăng nhập (mở trình duyệt).
  box.innerHTML = 'Đang khởi động đăng nhập…';
  try { await fetch(ep + '/login/start', { method: 'POST' }); }
  catch { box.innerHTML = '<span style="color:var(--red)">Không kết nối được bridge (app tự chạy — thử mở lại app).</span>'; return; }
  let shown = false;
  const started = Date.now();
  clearInterval(_cliPoll);
  _cliPoll = setInterval(async () => {
    // Ưu tiên: nếu giờ bridge gọi được CLI (user vừa đăng nhập xong trên trình duyệt) → thành công.
    if (await _cliTestWorks(ep)){ clearInterval(_cliPoll); box.innerHTML = '<span style="color:var(--green)">✅ Đăng nhập thành công! Dùng được rồi.</span>'; return; }
    let s; try { s = await (await fetch(ep + '/login/status')).json(); } catch { s = null; }
    if (s && s.done){ clearInterval(_cliPoll); box.innerHTML = '<span style="color:var(--green)">✅ Đăng nhập thành công! Dùng được rồi.</span>'; return; }
    if (s && s.url && !shown){
      shown = true;
      box.innerHTML = `<div style="line-height:1.7">1. Đăng nhập ở cửa sổ trình duyệt vừa mở (hoặc mở link): <a href="${s.url}" target="_blank" style="color:var(--accent);word-break:break-all">${escapeHtml(s.url)}</a><br>2. Đăng nhập xong quay lại đây — sẽ tự nhận.</div>
        <div id="cliLoginMsg" style="font-size:11px;color:var(--text-muted);margin-top:4px"></div>`;
    }
    // Có lỗi (chưa cài CLI / cần Terminal…) → dừng, hiện lỗi + nút hướng dẫn (KHÔNG treo nữa)
    if (s && s.error){
      clearInterval(_cliPoll);
      box.innerHTML = '<div style="color:var(--red);font-size:12.5px">' + escapeHtml(s.error) + '</div>' + _cliGuideBtn();
      return;
    }
    // Quá 30s vẫn chưa xong (không có URL, không lỗi) → nhiều khả năng chưa cài CLI → thoát treo
    if (!shown && Date.now() - started > 30000){
      clearInterval(_cliPoll);
      box.innerHTML = '<div style="color:var(--amber);font-size:12.5px">Không đăng nhập được sau 30 giây — máy này có thể <b>chưa cài ' + (_cliIsGpt() ? 'Codex (ChatGPT)' : 'Claude Code') + ' CLI</b>.</div>' + _cliGuideBtn();
    }
  }, 2500);
}

