/* ── Tách từ inline <script> trong index.html (ô Flow API key ở Cài đặt).
   Key ẨN mặc định (mask •), giá trị thật nằm trong closure `realValue`, lưu
   qua window.novaStore (kho cài đặt bền). Hàm gắn lên window cho markup gọi. ── */

// Flow API Key management
// Key được ẨN mặc định trong textarea (chỉ lộ 4 ký tự đầu + 4 cuối) để bảo vệ
// người dùng khi quay màn hình / demo. Giá trị thật nằm trong `realValue`,
// không bao giờ đổ nguyên văn vào textarea khi đang ở chế độ ẩn.
(function() {
  var MASK_CHAR = '•';
  var realValue = '';   // chuỗi key thật, phân tách bằng '\n'
  var revealed = false; // trạng thái hiện/ẩn

  function maskLine(s) {
    if (!s) return s;
    if (s.length <= 8) return new Array(s.length + 1).join(MASK_CHAR);
    return s.slice(0, 4) + new Array(9).join(MASK_CHAR) + s.slice(-4);
  }

  function renderInput() {
    var input = document.getElementById('flowApiKey');
    if (!input) return;
    if (revealed) {
      input.value = realValue;
    } else {
      input.value = realValue.split(/\r?\n/).filter(function (s) { return s.trim().length > 0; })
        .map(maskLine).join('\n');
    }
  }

  function setReveal(v) {
    revealed = !!v;
    renderInput();
    var btn = document.getElementById('flowApiKeyToggle');
    if (btn) btn.textContent = revealed ? '🙈 Ẩn' : '👁 Hiện';
  }

  window.toggleFlowApiKeyVisibility = function() {
    setReveal(!revealed);
  };

  function loadFlowApiKey() {
    const input = document.getElementById('flowApiKey');
    const status = document.getElementById('flowApiKeyStatus');
    if (!input) return;
    var val = null;
    try {
      if (window.novaStore && window.novaStore.seed && typeof window.novaStore.seed['api_key_flow'] === 'string') {
        val = window.novaStore.seed['api_key_flow'];
      }
    } catch (e) {}
    if (val == null) {
      try { val = localStorage.getItem('flowApiKey'); } catch (e) {}
    }
    if (val) {
      realValue = val;
      renderInput(); // hiển thị dạng ẩn mặc định
      var count = val.split(/\r?\n/).filter(function (s) { return s.trim().length > 0; }).length;
      if (status) status.textContent = '✅ Đã tải ' + count + ' key (đã ẩn — bấm 👁 Hiện để xem)';
    } else if (status) {
      status.textContent = '';
    }
  }

  window.saveFlowApiKey = function() {
    const input = document.getElementById('flowApiKey');
    const status = document.getElementById('flowApiKeyStatus');
    if (!input) return;
    var lines = input.value.split(/\r?\n/).map(function (s) { return s.trim(); });
    var realLines = realValue ? realValue.split(/\r?\n/).filter(function (s) { return s.trim().length > 0; }) : [];
    // Bản đồ mask → key thật, để "giải" dòng bị ẩn khi lưu
    var maskMap = {};
    realLines.forEach(function (r) { maskMap[maskLine(r)] = r; });
    // Dòng chứa ký tự mask → giữ key thật ở cùng vị trí (không lưu ký tự '•' vào kho).
    // Muốn thay key: xoá dòng đó rồi dán key mới.
    var resolved = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln.length === 0) continue;
      if (ln.indexOf(MASK_CHAR) !== -1) {
        var real = (realLines[i] && maskLine(realLines[i]) === ln) ? realLines[i] : maskMap[ln];
        if (real) resolved.push(real);
      } else {
        resolved.push(ln);
      }
    }
    if (!resolved.length) {
      if (status) status.textContent = '⚠️ Vui lòng nhập ít nhất một API key (muốn thay key đã ẩn: xoá dòng đó rồi dán key mới)';
      return;
    }
    const key = resolved.join('\n');
    var saved = false;
    try {
      if (window.novaStore && typeof window.novaStore.set === 'function') {
        saved = window.novaStore.set('api_key_flow', key) === true;
      }
    } catch (e) { saved = false; }
    if (saved) {
      realValue = key;
      setReveal(false); // quay về chế độ ẩn sau khi lưu
      if (status) status.textContent = '✅ Đã lưu ' + resolved.length + ' key (đã ẩn)';
    } else {
      if (status) status.textContent = '❌ Lưu thất bại (kho cài đặt không khả dụng)';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFlowApiKey);
  } else {
    loadFlowApiKey();
  }
})();
