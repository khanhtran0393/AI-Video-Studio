/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ PHANH NHỊP CHO TÌM WEB ══════════════════════════════════════════════════
   DuckDuckGo khoá IP sau khoảng 100 truy vấn liên tiếp (đã đo: sau đó mọi
   truy vấn trả 403). Nên: cách nhau tối thiểu 5 giây, trần 40 lượt mỗi phiên,
   và nhớ kết quả cũ để cùng một truy vấn không gọi lại lần hai.              */
const _WEB_NHIP = { cach: 5000, tran: 40, lanCuoi: 0, daDung: 0, chan: false, chan_ddg: false, chan_bing: false };
const _webNho = new Map();

function _webNhoKey(platId, q) { return platId + ' :: ' + String(q).toLowerCase().trim(); }

/* Phanh nhịp phải CHỊU ĐƯỢC gọi song song. Bản cũ đọc lanCuoi rồi mới ghi,
   hai luồng vào cùng lúc sẽ cùng thấy "đã đủ 5s" và cùng bắn — mất tác dụng
   phanh. Nối đuôi bằng một chuỗi promise: luồng sau chờ luồng trước xong.   */
let _webNhipHang = Promise.resolve();
function _webChoNhip() {
  const ket = _webNhipHang.then(async () => {
    const cho = _WEB_NHIP.cach - (Date.now() - _WEB_NHIP.lanCuoi);
    if (cho > 0) await new Promise((r) => setTimeout(r, cho));
    _WEB_NHIP.lanCuoi = Date.now();
  });
  _webNhipHang = ket.catch(() => {});   // một lỗi không được làm kẹt cả hàng
  return ket;
}

function webTrangThaiNhip() {
  return { daDung: _WEB_NHIP.daDung, tran: _WEB_NHIP.tran, chan: _WEB_NHIP.chan };
}
function webResetNhip() { _WEB_NHIP.daDung = 0; _WEB_NHIP.chan = false; _WEB_NHIP.chan_ddg = false; _WEB_NHIP.chan_bing = false; }

/* ══ CẦU NỐI SANG MAIN ════════════════════════════════════════════════════════ */
const _webNative = () => (window.native && window.native.nguonWeb) || null;

async function _webGet(url, opts) {
  const n = _webNative();
  if (!n) return { ok: false, error: 'chỉ chạy trong app Nova' };
  try { return await n.get(Object.assign({ url }, opts || {})); }
  catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 90) }; }
}
async function _webJson(url, opts) {
  const r = await _webGet(url, opts);
  if (!r || !r.ok) throw new Error((r && (r.error || ('HTTP ' + r.status))) || 'lỗi mạng');
  try { return JSON.parse(r.text); } catch (_) { throw new Error('không đọc được JSON'); }
}