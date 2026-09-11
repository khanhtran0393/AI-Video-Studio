/* ── Tách từ inline <script> trong index.html. Tinh chỉnh mặc định CHỈ cho
   app desktop (bật xuất MP4 FFmpeg, ép Whisper local, thu gọn khung transcribe). ── */

/* APP DESKTOP: tinh chỉnh mặc định cho app (Whisper local, xuất MP4) — không còn login. */
(function(){
  if (!(window.native && window.native.isDesktop)) return;
  function apply(){
    var mp4 = document.getElementById('t7Mp4Btn'); if (mp4) mp4.style.display = '';   // bật xuất MP4 FFmpeg
    // Whisper: ÉP dùng LOCAL (chạy trong máy, không cần key) + thu gọn khung transcribe cho app.
    try {
      localStorage.setItem('t8_provider', 'local');
      var pv = document.getElementById('t8Provider');
      if (pv) { pv.value = 'local'; if (typeof t8OnProviderChange === 'function') t8OnProviderChange(); }
      ['t8ProvWrap', 't8ProviderHint', 't8ModelInfo'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
      var head = document.querySelector('#t8ApiPanel .panel-head span'); if (head) head.innerHTML = '🎙 Whisper — chạy trong máy (Local, miễn phí, không cần key)';
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
