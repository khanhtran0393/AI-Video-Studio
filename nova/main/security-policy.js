'use strict';
/**
 * Security policy — tập trung mọi quyết định "URL này có được mở/điều hướng không".
 *
 * Bài học từ AI Novel (securityPolicy.js): dùng `new URL().origin` so sánh chính xác
 * thay vì substring/regex hostname — chống open-redirect, chống tab mở URL lạ.
 *
 * Sử dụng:
 *  - window.js: setWindowOpenHandler / will-navigate
 *  - flow-extension: trước khi mở externalUrl
 *  - agent-bridge: kiểm tra URL từ AI agent trước khi navigate
 *
 * Không throw — luôn trả boolean để caller xử lý deny có thông báo.
 */

/**
 * URL có phải là absolute hợp lệ không.
 */
function isValidAbsoluteUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * So sánh URL với origin cố định (vd window.location.origin của renderer).
 * Trả true nếu URL có cùng origin với `expectedOrigin`.
 */
function isExactOriginUrl(value, expectedOrigin) {
  if (!isValidAbsoluteUrl(value) || !expectedOrigin) return false;
  try {
    return new URL(value).origin === expectedOrigin;
  } catch (_) {
    return false;
  }
}

/**
 * Kiểm tra URL có thuộc allowlist set không.
 * @param {string} value
 * @param {Set<string>} allowlist Set các host hợp lệ (chỉ hostname, vd "google.com")
 */
function isAllowlistedHost(value, allowlist) {
  if (!isValidAbsoluteUrl(value) || !(allowlist instanceof Set) || !allowlist.size) return false;
  let host;
  try { host = new URL(value).hostname; } catch (_) { return false; }
  if (allowlist.has(host)) return true;
  // Cho phép subdomain của entry trong allowlist: nếu "google.com" → "accounts.google.com" cũng OK.
  for (const base of allowlist) {
    if (host === base || host.endsWith('.' + base)) return true;
  }
  return false;
}

/**
 * URL có được phép mở ĐIỀU HƯỚNG nội bộ (trong app) không.
 * Điều kiện: cùng origin renderer HOẶC thuộc trustedNavHosts (set allowlist).
 */
function isTrustedNavigationUrl(value, expectedOrigin, trustedNavHosts) {
  if (isExactOriginUrl(value, expectedOrigin)) return true;
  if (trustedNavHosts instanceof Set && isAllowlistedHost(value, trustedNavHosts)) return true;
  return false;
}

/**
 * URL có được mở bằng trình duyệt ngoài (shell.openExternal) không.
 * Mặc định từ chối mọi URL ngoài — caller truyền Set các host được phép.
 * Nếu allowlist là null/empty: trả false (deny-by-default).
 */
function isTrustedExternalUrl(value, allowlist) {
  return isAllowlistedHost(value, allowlist);
}

/**
 * Tách hostname an toàn từ URL — trả '' nếu URL không hợp lệ.
 * Gọi isValidAbsoluteUrl trước (đã parse 1 lần) rồi dùng URL.parse trên chuỗi
 * đã được validate. Tuy vẫn parse lại lần nữa (Node URL không có cache), nhưng
 * đảm bảo tính đúng đắn: nếu pass isValidAbsoluteUrl thì new URL chắc chắn OK.
 */
function safeHostname(value) {
  if (!isValidAbsoluteUrl(value)) return '';
  try { return new URL(value).hostname; } catch (_) { return ''; }
}

module.exports = {
  isValidAbsoluteUrl,
  isExactOriginUrl,
  isAllowlistedHost,
  isTrustedNavigationUrl,
  isTrustedExternalUrl,
  safeHostname,
};
