/* ── State dùng CHUNG giữa các file của flow-native/ — phải qua object S:
     CommonJS không có live binding: destructuring require chỉ snapshot giá trị let.
     order/nextId gán lại trong restore()/addAccount*(); pool gán lại trong poolReset();
     _poolAbort đổi qua handle(POOL_ABORT); _capChain trong _withCapLock();
     _autoTimer/_genActive đổi trong token-captcha. ── */
const S = {
  order: [],              // id -> thứ tự account (từng là let, gán lại trong restore()/syncChromeAccounts())
  nextId: 1,              // id kế tiếp (từng là let, gán lại trong restore())
  pool: { cursor: 0, projects: {}, uploads: {}, _proj: {}, _up: {}, exhausted: new Set(), exhDay: {}, busy: new Set(), slots: { perAccount: 1, machine: 2 }, _busyCount: {}, _activeGens: 0 },
  _poolAbort: false,      // bấm Dừng ở app → bật cờ này để poolGen BỎ NGAY, khỏi xoay hết account × captcha (mỗi lượt có thể vài phút).
  _capChain: Promise.resolve(),
  _autoTimer: null,
  _genActive: 0,          // >0 = đang tạo ảnh/video → auto-refresh nghỉ (tránh reload cửa sổ đang chạy)
};
module.exports = S;
