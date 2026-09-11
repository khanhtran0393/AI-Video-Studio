/* ── State dùng CHUNG giữa các file của flow-chrome/ — phải qua object S:
     CommonJS không có live binding: destructuring require chỉ snapshot giá trị let.
     order/nextId bị gán lại trong restore(); _busy/_lastTokenExpiry/_captchaId đổi xuyên file;
     tokens là Map dùng chung giữa nen-tang (persist/restore) và token-captcha. ── */
const S = {
  order: [],              // id -> thứ tự account (từng là let, gán lại trong restore())
  nextId: 1,
  _busy: false,           // đang có thao tác Chrome (đăng nhập lại / lấy token) → chặn thao tác khác xen vào
  _lastTokenExpiry: null, // hạn thật của token vừa bắt (từ field expires của session, ~24h)
  _captchaId: null,
  tokens: new Map(),      // id -> { token, at, expiry }
  ssoConsent: null,       // OAuth Labs đang chờ user bấm consent/ủy quyền lần đầu: { id, email, since, message } | null
};
module.exports = S;
