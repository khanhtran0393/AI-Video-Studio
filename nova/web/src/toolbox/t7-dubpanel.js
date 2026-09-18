/* T7 DUB PANEL — cột trái "Thuyết minh" kiểu EZMAXSUB cho Dựng Video (Tool 7)
   2026-09-18: rail item 🎙 Thuyết minh (k='dub') → _t7RailDub() render vào #t7RailPanel
   (bin 300px — đúng vị trí panel trái 300px của EZMAXSUB). Bố cục chép theo ảnh gốc:
   cặp tab đầu panel → 3 khung accordion (Nhận dạng giọng nói / Dịch thuật / Thuyết minh)
   → nút gold "✨ Xử lý video" (gradient + glow) → hàng 3 nút nhanh → khối HOÀN TÁC.
   NGUYÊN TẮC — KHÔNG có logic mới: mọi nút gọi đúng hàm có sẵn của Tool 7
   (t7SubImportSrt / t7SubAdd / t7SubTranslate / t7SubGenerateVoice / t7RightTab /
   t7Undo + xoá state có sẵn); "Xử lý video" chỉ XÍCH 2 bước có thật (dịch → tạo giọng),
   KHÔNG bịa bước nhận dạng giọng nói — app chưa có ASR nên ghi rõ trong phần mô tả.
   Toàn bộ function declaration + let riêng tiền tố _t7dp* — không đụng tên khác. */

let _t7dpOpen = null;      // accordion đang mở: 'asr' | 'trans' | 'tts' | null (mặc định đóng hết như ảnh gốc)
let _t7dpBusy = false;     // khoá nút "Xử lý video" khi đang chạy lô dịch + TTS

/* ── RENDER PANEL (gọi từ t7SetMediaTab khi mediaTab === 'dub') ── */
function _t7RailDub(){
  const box = document.getElementById('t7RailPanel'); if (!box) return;
  const cues = (typeof _t7SubCues === 'function') ? _t7SubCues() : [];
  const nText = cues.filter(c => c.text).length;
  const nUntrans = cues.filter(c => c.text && !c.trans).length;
  const nVoice = nText;   // phân đoạn có chữ là phân đoạn có thể tạo giọng

  const acc = (key, ic, lb, body) => {
    const open = _t7dpOpen === key;
    return '<div class="t7dp-acc' + (open ? ' open' : '') + '">' +
      '<button class="t7dp-acc-h" onclick="_t7dpToggle(\'' + key + '\')" aria-expanded="' + open + '">' +
        '<span class="t7dp-acc-ic">' + ic + '</span>' +
        '<span class="t7dp-acc-lb">' + lb + '</span>' +
        '<span class="t7dp-acc-ch">›</span>' +
      '</button>' +
      (open ? '<div class="t7dp-acc-b">' + body + '</div>' : '') +
    '</div>';
  };

  const btn = (fn, ic, lb, cnt, title) =>
    '<button class="t7dp-act" onclick="' + fn + '" title="' + title + '">' + ic + ' ' + lb +
      (cnt != null ? ' <u>' + cnt + '</u>' : '') + '</button>';

  const bodyAsr =
    '<div class="t7dp-note">App chưa nhận dạng giọng nói tự động. Nạp phụ đề có sẵn (SRT/VTT) hoặc gõ tay từng phân đoạn — mỗi cảnh trên timeline là một phân đoạn.</div>' +
    '<div class="t7dp-row2">' +
      btn('t7SubImportSrt()', '📄', 'Nhập file SRT', null, 'Nhập file SRT/VTT — đổ text vào phân đoạn theo mốc thời gian') +
      btn('t7SubAdd()', '＋', 'Thêm phân đoạn', null, 'Thêm phân đoạn phụ đề mới tại vạch phát') +
    '</div>';
  const bodyTrans =
    '<div class="t7dp-note">Dịch câu thoại mọi phân đoạn sang tiếng Việt làm bản dịch tham khảo (không ghi vào video).</div>' +
    '<div class="t7dp-row2">' +
      btn('t7SubTranslate()', '🌐', 'Dịch thuyết minh', nUntrans, 'Dịch các câu thoại sang tiếng Việt để tham khảo') +
    '</div>';
  const bodyTts =
    '<div class="t7dp-note">TTS từng phân đoạn rồi ghép đúng khe timing thành track giọng đọc gắn vào timeline.</div>' +
    '<div class="t7dp-row2">' +
      btn('t7SubGenerateVoice()', '🎙', 'Tạo giọng thuyết minh', nVoice, 'TTS từng phân đoạn rồi ghép đúng khe timing') +
    '</div>';

  box.innerHTML =
    /* Cặp tab đầu panel (như EZMAXSUB) — tab 2 là đường tắt sang bảng phụ đề cột phải */
    '<div class="t7dp-tabs">' +
      '<button class="t7dp-tab on" type="button">🎙 Thuyết minh</button>' +
      '<button class="t7dp-tab" type="button" onclick="t7RightTab(\'subs\')" title="Mở bảng phụ đề ở cột phải">💬 Phụ đề</button>' +
    '</div>' +
    acc('asr',  '🎙', 'Nhận dạng giọng nói', bodyAsr) +
    acc('trans','🌐', 'Dịch thuật',          bodyTrans) +
    acc('tts',  '🔊', 'Thuyết minh',          bodyTts) +
    _t7dpHtmlActions(nText, cues.length);
}

function _t7dpHtmlActions(nText, nCues){
  return /* Nút gold chính — chạy xích 2 bước có thật: dịch → tạo giọng */
    '<button class="t7dp-run" id="t7dpRunBtn" type="button" onclick="t7dpRunAll()" title="Chạy liền: Dịch thuyết minh → Tạo giọng thuyết minh">' +
      '✨ Xử lý video</button>' +
    /* Hàng 3 nút nhanh (mỗi bước chạy riêng) */
    '<div class="t7dp-chips">' +
      '<button type="button" onclick="t7SubImportSrt()" title="Nhập phụ đề có sẵn">📄 Nhận dạng</button>' +
      '<button type="button" onclick="t7SubTranslate()" title="Dịch thuyết minh">🌐 Dịch</button>' +
      '<button type="button" onclick="t7SubGenerateVoice()" title="Tạo giọng thuyết minh">🎙 Thuyết minh</button>' +
    '</div>' +
    /* Khối HOÀN TÁC — gỡ từng artifact đã tạo, không đụng chữ gốc */
    '<div class="t7dp-undo-h"><span class="t7dp-undo-ic">↺</span> Hoàn tác</div>' +
    '<div class="t7dp-chips">' +
      '<button type="button" onclick="t7dpRevertAudio()" title="Gỡ track giọng thuyết minh khỏi timeline (chữ vẫn giữ nguyên)">♪ Audio</button>' +
      '<button type="button" onclick="t7dpRevertTrans()" title="Xoá toàn bộ bản dịch tham khảo đã tạo">🌐 Bản dịch</button>' +
      '<button type="button" onclick="t7dpRevertBurn()" title="Tắt ghi phụ đề vào video khi xuất (chữ vẫn giữ nguyên)">💬 Phụ đề</button>' +
    '</div>' +
    '<div class="t7dp-foot">' + nText + '/' + nCues + ' phân đoạn có chữ</div>';
}

function _t7dpToggle(key){ _t7dpOpen = (_t7dpOpen === key) ? null : key; _t7dpRender(); }

function _t7dpRender(){
  // render lại panel nếu nó đang hiển thị (mediaTab 'dub') — hành động ở tab khác thì thôi
  if (t7State.mediaTab === 'dub') _t7RailDub();
}

/* ── "Xử lý video": xích 2 bước CÓ THẬT (dịch → tạo giọng). Không bịa bước ASR. ── */
async function t7dpRunAll(){
  if (_t7dpBusy || _t7SubBusyVoice) return setStatus7('⏳ Đang xử lý — chờ lô hiện tại xong.', 'info');
  const cues = _t7SubCues().filter(c => c.text);
  if (!cues.length) return setStatus7('Chưa có câu thoại nào — nhập file SRT hoặc gõ chữ vào phân đoạn trước đã.', 'error');
  if (typeof _pfRequireActive === 'function') _pfRequireActive('xử lý video (dịch + tạo giọng)');
  _t7dpBusy = true;
  const rb = document.getElementById('t7dpRunBtn');
  if (rb){ rb.disabled = true; rb.textContent = '⏳ Đang xử lý…'; }
  try {
    setStatus7('⚙ Xử lý video 1/2: dịch thuyết minh…', 'working');
    await t7SubTranslate();
    setStatus7('⚙ Xử lý video 2/2: tạo giọng thuyết minh…', 'working');
    await t7SubGenerateVoice();
    setStatus7('✓ Xử lý xong: đã dịch + tạo giọng thuyết minh. Bấm ⬆ Xuất Video để dựng file.', 'ok');
  } catch (e){
    setStatus7('❌ Xử lý video dừng: ' + (e.message || e), 'error');
  } finally {
    _t7dpBusy = false;
    _t7dpRender();
  }
}

/* ── HOÀN TÁC: gỡ từng artifact đã tạo (không đụng chữ gốc của phân đoạn) ── */
function t7dpRevertAudio(){
  const had = !!t7State.audioFile || Object.keys(state.t7SubAudioAt || {}).length > 0;
  if (!had) return setStatus7('Chưa có track giọng thuyết minh nào để gỡ.', 'info');
  t7State.audioFile = null; t7State.audioPeaks = null; t7State.audioDur = 0;
  state.t7SubAudioAt = {};
  const au = document.getElementById('t7PreviewAudio');
  if (au){ try { au.pause(); } catch (_) {} au.removeAttribute('src'); }
  const info = document.getElementById('t7VoInfo'); if (info) info.textContent = '';
  try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
  t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  _t7dpRender();
  setStatus7('↺ Đã gỡ track giọng thuyết minh khỏi timeline.', 'ok');
}

function t7dpRevertTrans(){
  const n = Object.keys(state.sceneTrans || {}).length;
  if (!n) return setStatus7('Chưa có bản dịch tham khảo nào để xoá.', 'info');
  state.sceneTrans = {};
  try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
  try { t7RenderDetail(); } catch (e) {}
  _t7dpRender();
  setStatus7('↺ Đã xoá ' + n + ' bản dịch tham khảo.', 'ok');
}

function t7dpRevertBurn(){
  const on = document.getElementById('t7ExpSubs');
  if (!on) return setStatus7('Không tìm thấy thiết lập ghi phụ đề (t7ExpSubs).', 'error');
  if (!on.checked) return setStatus7('Phụ đề đang TẮT ghi vào video rồi — không cần hoàn tác.', 'info');
  on.checked = false;
  const cb = document.getElementById('t7SubsRailOn'); if (cb) cb.checked = false;
  if (!t7State.playing) t7RenderPreview();
  setStatus7('↺ Đã tắt ghi phụ đề vào video khi xuất (chữ vẫn giữ nguyên).', 'ok');
}
