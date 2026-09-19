/* Kiểm định HÀM THUẦN cache mẫu nghe thử v4 + chữ ký cài đặt (utility/voice.js).
   Nạp nguyên văn shared/voice.js (state) + utility/voice.js (logic) vào sandbox `vm`
   theo ĐÚNG thứ tự nạp của index.html (shared trước, utility sau), stub DOM tối
   thiểu — không mạng, không Electron. Test đúng hàng rào BẰNG CODE:
   - _giongThuSig: chữ ký cài đặt ổn định + NHẠY (đổi 1 tham số → đổi sig).
   - _giongHash16/_giongThamSo: hash ổn định, phân biệt cài đặt + câu nghe thử.
   - _giongMauFileKey/_giongMauKeyDia: key v4 + HỢP ĐỒNG sanitize renderer ≡ main
     (voiceSampleFile: /[/\:*?"<>|]+/g → '_', '..+' → '_', cắt 180).
   - _giongMauKhop/_giongMauCo/_giongMauTienToDia: forward-map badge ▶ đúng 3 trạng
     thái (khớp / có-mẫu-lệch-cài-đặt / chưa có) và tiền tố tách đúng từng giọng
     (giọng 'a' không ăn nhầm cache của 'ab').
   - _giongMauXoa: dọn RAM theo giọng + gọi voiceSampleClear({ prefix }) cho MỌI engine.
   - _giongThuText: câu gõ tay → trim, trống → câu mặc định, cap 240 ký tự. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FAIL = [];
function kiem(ten, dieuKien){
  if (dieuKien) console.log('  ✓ ' + ten);
  else { console.error('  ✗ ' + ten); FAIL.push(ten); }
}

// ── Sandbox: stub DOM/window tối thiểu ──────────────────────────────────────────
const thuCauEl = { value: '' };   // ô giongThuCau điều khiển được từ test
const clearCalls = [];            // mọi voiceSampleClear({ prefix }) renderer gửi

function makeDoc(){
  return {
    getElementById(id){ return id === 'giongThuCau' ? thuCauEl : null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){},
    removeEventListener(){},
    createElement(){ return { style: {}, setAttribute(){}, appendChild(){}, addEventListener(){}, querySelector(){ return null; } }; },
    body: { appendChild(){} },
  };
}

const sandbox = {
  console,
  document: makeDoc(),
  window: { native: { voiceSampleClear: (p) => { clearCalls.push(p); } } },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  navigator: { userAgent: 'voice-preview-cache-test' },
  novaLog(){},
  escapeHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  setTimeout(){ return 0; },
  clearTimeout(){},
  URL: { createObjectURL(){ return 'blob:fake'; }, revokeObjectURL(){} },
  fetch(){ return Promise.reject(new Error('không mạng trong test')); },
  FormData: function(){},
  FileReader: function(){ this.readAsDataURL = () => {}; },
  Audio: function(){},
  VOICE_URL: 'http://127.0.0.1:8771',
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

const webDir = path.join(__dirname, '..', 'web', 'src', 'toolbox');
for (const rel of ['shared/voice.js', 'utility/voice.js']){
  const code = fs.readFileSync(path.join(webDir, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}
console.log('• Đã nạp shared/voice.js + utility/voice.js vào sandbox');

// Lấy handle các hàm/thuộc tính (let/const không nằm trên globalThis → đọc trong ctx).
const T = vm.runInContext('({ sig: _giongThuSig, hash16: _giongHash16, thamso: _giongThamSo, fileKey: _giongMauFileKey, keyDia: _giongMauKeyDia, tienTo: _giongMauTienToDia, khop: _giongMauKhop, co: _giongMauCo, mauXoa: _giongMauXoa, thuText: _giongThuText, GIONG_THU: _GIONG_THU, MAU_V: _GIONG_MAU_V, ttsTen: _TTS_TEN })', ctx);

// main sanitize (voiceSampleFile) — hợp đồng mà renderer phải khớp từng ký tự.
function mainSanitize(s){ return String(s || '').replace(/[/\\:*?"<>|]+/g, '_').replace(/\.\.+/g, '_').slice(0, 180); }

(async () => {
  console.log('\n— 1. _GIONG_MAU_V phải là v4 (multi-sample theo cài đặt + câu) —');
  kiem('phiên bản cache = v4', T.MAU_V === 'v4');

  console.log('\n— 2. _giongThuSig: ổn định + nhạy từng tham số —');
  const a = { tocDo: 1, caoDo: 0, gap: 300, lang: 'vi', top_p: 0.85, top_k: 50, repetition_penalty: 2.0, generation_speed: 0.9, diffusion_steps: 16 };
  const b = Object.assign({}, a);
  kiem('cùng giá trị (khác thứ tự key) → cùng sig', T.sig(a) === T.sig(b));
  const ds = [];
  for (const k of ['tocDo', 'caoDo', 'gap', 'lang', 'top_p', 'top_k', 'repetition_penalty', 'generation_speed', 'diffusion_steps']){
    const x = Object.assign({}, a); x[k] = k === 'top_k' ? 51 : (k === 'lang' ? 'en' : 999);
    ds.push(T.sig(x));
  }
  kiem('đổi TỪNG tham số → sig khác', ds.every(s => s !== T.sig(a)));
  kiem('đổi tham số khác nhau → sig khác nhau', new Set(ds).size === ds.length);

  console.log('\n— 3. _giongHash16/_giongThamSo: ổn định + phân biệt —');
  const h1 = T.hash16('abc');
  kiem('hash xác định', T.hash16('abc') === h1);
  kiem('hash 16 hex', /^[0-9a-f]{16}$/.test(h1));
  kiem('input khác → hash khác', T.hash16('abd') !== h1 && T.hash16('') !== h1);
  const sig0 = T.sig(a);
  kiem('thamso(sig, text) xác định', T.thamso(sig0, 'Xin chào') === T.thamso(sig0, 'Xin chào'));
  kiem('câu khác → thamso khác', T.thamso(sig0, 'Câu A') !== T.thamso(sig0, 'Câu B'));
  kiem('cài đặt khác → thamso khác', T.thamso(sig0, 't') !== T.thamso(T.sig(Object.assign({}, a, { tocDo: 1.25 })), 't'));

  console.log('\n— 4. Key v4 + hợp đồng sanitize renderer ≡ main —');
  const vk = 'omni:spk_ab12cd34';
  const ts = T.thamso(sig0, 'Xin chào');
  kiem('fileKey đủ 4 đoạn v4|engine|giọng|thamso', T.fileKey('omni', vk, ts) === 'v4|omni|' + vk + '|' + ts);
  kiem('keyDia ≡ main voiceSampleFile sanitize', T.keyDia('omni', vk, ts) === mainSanitize(T.fileKey('omni', vk, ts)));
  kiem('keyDia không còn ký tự cấm Windows', !/[/\\:*?"<>|]/.test(T.keyDia('omni', vk, ts)));
  kiem('keyDia dài ≤ 180', T.keyDia('omni', vk, ts).length <= 180);
  const vkDai = 'omni:' + 'x'.repeat(300);
  kiem('voice key 300 ký tự → keyDia vẫn ≤ 180 và xác định', T.keyDia('omni', vkDai, ts).length <= 180 && T.keyDia('omni', vkDai, ts) === T.keyDia('omni', vkDai, ts));

  console.log('\n— 5. Badge: khớp / có-mẫu-lệch / chưa có (forward-map) —');
  vm.runInContext('_giongMauSan = new Set()', ctx);
  const engS = Object.keys(T.ttsTen);
  kiem('chưa có mẫu → _giongMauCo=false, _giongMauKhop=false', !T.co(vk) && !T.khop(vk, ts));
  // Tiền tố phải trùng đúng phần đầu của key đã sanitize và kết thúc bằng '_'
  const keySan = mainSanitize(T.fileKey('omni', vk, ts));
  kiem('tiền tố khớp key đĩa đã sanitize', keySan.indexOf(T.tienTo('omni', vk)) === 0 && keySan.endsWith(ts));
  // Giọng 'ab' KHÔNG được ăn nhầm cache của 'ab12cd34' (tiền tố kết thúc bằng '_')
  kiem('giọng "omni:ab" không ăn nhầm cache của "omni:ab12cd34"', !T.co('omni:ab') && !T.khop('omni:ab', ts));
  vm.runInContext('_giongMauSan.add(' + JSON.stringify(keySan) + ')', ctx);
  kiem('có mẫu đúng tham số → khop=true, co=true', T.khop(vk, ts) === true && T.co(vk) === true);
  const tsKhac = T.thamso(sig0, 'Câu khác');
  kiem('mẫu lệch tham số → khop=false NHƯNG co=true (badge ⟳)', T.khop(vk, tsKhac) === false && T.co(vk) === true);
  // Thêm mẫu engine khác cho cùng giọng
  const keySan2 = mainSanitize(T.fileKey('xtts', vk, tsKhac));
  vm.runInContext('_giongMauSan.add(' + JSON.stringify(keySan2) + ')', ctx);
  kiem('engine khác có mẫu tham số khác → vẫn co=true', T.co(vk) === true);

  console.log('\n— 6. _giongMauXoa: dọn RAM theo giọng + clear theo PREFIX mọi engine —');
  vm.runInContext(
    '_giongMau.set(' + JSON.stringify(T.fileKey('omni', vk, ts)) + ', { url: "blob:a", sig: "s" });' +
    '_giongMau.set(' + JSON.stringify(T.fileKey('xtts', vk, tsKhac)) + ', { url: "blob:b", sig: "s" });' +
    '_giongMau.set(' + JSON.stringify(T.fileKey('omni', 'omni:spk_giukhac', ts)) + ', { url: "blob:c", sig: "s" });',
    ctx);
  T.mauXoa(vk);
  const ramCon = vm.runInContext('Array.from(_giongMau.keys())', ctx);
  kiem('RAM: giữ giọng khác, xoá sạch mọi tham số của giọng đã xoá', ramCon.length === 1 && ramCon[0].indexOf('giukhac') !== -1);
  const sanCon = vm.runInContext('Array.from(_giongMauSan)', ctx);
  kiem('badge set: xoá sạch tiền tố giọng đã xoá', sanCon.every(k => k.indexOf(mainSanitize(T.fileKey('omni', vk, ''))) !== 0 && k.indexOf(mainSanitize(T.fileKey('xtts', vk, ''))) !== 0));
  kiem('voiceSampleClear gọi theo prefix cho MỌI engine (' + engS.length + ')', clearCalls.length === engS.length && clearCalls.every(p => p && typeof p.prefix === 'string' && p.prefix.startsWith('v4|')));
  kiem('prefix gửi đi chưa sanitize (main tự sanitize)', clearCalls.some(p => p.prefix === T.fileKey('omni', vk, '')));

  console.log('\n— 7. _giongThuText: câu gõ tay / mặc định / cap 240 —');
  thuCauEl.value = '   Câu nghe thử riêng   ';
  kiem('trim câu gõ tay', T.thuText() === 'Câu nghe thử riêng');
  thuCauEl.value = '   ';
  kiem('chỉ khoảng trắng → câu mặc định', T.thuText() === T.GIONG_THU);
  thuCauEl.value = 'y'.repeat(500);
  kiem('cap 240 ký tự', T.thuText().length === 240);

  console.log('\n────────────────────────────────────────');
  if (FAIL.length){
    console.error('FAIL: ' + FAIL.length + ' kiểm định không đạt:');
    for (const f of FAIL) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('PASS toàn bộ kiểm định cache mẫu nghe thử v4.');
  process.exit(0);
})().catch((e) => { console.error('LỖI test:', e && e.stack || e); process.exit(1); });

