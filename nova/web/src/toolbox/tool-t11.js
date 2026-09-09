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

