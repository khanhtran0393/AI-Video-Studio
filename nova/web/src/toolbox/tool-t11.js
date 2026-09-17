/* AUTO-EXTRACTED from index.html block 3 - prefix: t11 */

function t11Init(){
  const el = document.getElementById('t11YtKey');
  if (el) el.value = localStorage.getItem('yt_api_key') || '';
  _t11KeyState();
}

function t11SaveKeys(){
  const el = document.getElementById('t11YtKey');
  try { localStorage.setItem('yt_api_key', (el?.value || '').trim()); _t11KeyState(); }
  catch (e) { const st = document.getElementById('t11KeyState'); if (st) st.textContent = 'Lỗi lưu: ' + e.message; }
}

// ⚡ Thử key: gọi THẬT YouTube Data API v3 (videos.list = 1 unit quota, video công khai
// dQw4w9WgXcQ) để biết key sống hay chết. Lỗi 400/403 được map thành hướng xử lý
// tiếng Việt cụ thể kèm link mở thẳng trang cần sửa — không để user tự đoán (Luật 10).
async function t11TestKey(){
  const st = document.getElementById('t11KeyState'); if (!st) return;
  const key = (document.getElementById('t11YtKey')?.value || '').trim() || (localStorage.getItem('yt_api_key') || '').trim();
  if (!key) { st.innerHTML = '<span style="color:var(--orange)">Chưa có key — dán key vào ô trên rồi thử lại.</span>'; return; }
  st.textContent = '⏳ Đang thử key (gọi thật YouTube Data API v3)…';
  let r, j;
  try {
    r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=dQw4w9WgXcQ&key=' + encodeURIComponent(key));
    j = await r.json();
  } catch (e) {
    st.innerHTML = '<span style="color:var(--red)">✗ Không gọi được API — kiểm tra mạng rồi thử lại.</span>';
    return;
  }
  if (r.ok && Array.isArray(j.items) && j.items.length) {
    st.innerHTML = '<span style="color:var(--green)">✓ Key hoạt động, còn quota — Phân tích đối thủ sẽ dùng API (nhanh, thêm sub/engagement chính xác).</span>';
    return;
  }
  const reason = String((j && j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '');
  const msg = String((j && j.error && j.error.message) || ('HTTP ' + r.status));
  const A = (u) => '<a href="' + u + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;text-decoration:none">mở ↗</a>';
  if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(msg)) {
    st.innerHTML = '<span style="color:var(--orange)">⚠ Key hợp lệ nhưng <b>chưa bật YouTube Data API v3</b> cho project của key.</span> '
      + 'Bấm ' + A('https://console.cloud.google.com/apis/library/youtube.googleapis.com') + ' → chọn đúng project ở thanh trên → nút <b>Enable</b> → bấm ⚡ Thử key lại.';
  } else if (reason === 'keyInvalid' || reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) {
    st.innerHTML = '<span style="color:var(--red)">✗ Key sai hoặc đã bị xoá/thu hồi.</span> Tạo key mới: ' + A('https://console.cloud.google.com/apis/credentials') + ' → Create Credentials → API key → copy rồi dán lại vào ô trên.';
  } else if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    st.innerHTML = '<span style="color:var(--orange)">⚠ Key hợp lệ nhưng <b>hết quota hôm nay</b> (mặc định 10.000 unit/ngày).</span> App vẫn chạy đủ qua yt-dlp; quota reset lúc nửa đêm giờ Mỹ (≈12-14h trưa VN). Còn có thể tạo project Google Cloud khác để có quota riêng.';
  } else if (reason === 'ipRefererBlocked' || reason === 'forbidden' || /referer|restricted/i.test(msg)) {
    st.innerHTML = '<span style="color:var(--orange)">⚠ Key hợp lệ nhưng bị <b>giới hạn IP/referrer</b>.</span> Vào trang key ' + A('https://console.cloud.google.com/apis/credentials') + ' → bấm tên key → <b>Application restrictions</b> → chọn <b>None</b> → Save → thử lại.';
  } else if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
    st.innerHTML = '<span style="color:var(--orange)">⚠ Bị giới hạn tốc độ tạm thời — đợi vài giây rồi bấm ⚡ Thử key lại.</span>';
  } else {
    st.innerHTML = '<span style="color:var(--red)">✗ Lỗi không nhận dạng được: HTTP ' + r.status + ' — ' + String(msg).slice(0, 140) + '</span>';
  }
}

