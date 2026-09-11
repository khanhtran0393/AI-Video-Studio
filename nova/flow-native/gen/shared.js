/* ── Helpers dùng chung cho gen/ — tách từ gen/legacy.js (nguồn flow-native.plain.js).
     Thuần hàm, không require module ngoài (chỉ Node builtin inline) → 1 nguồn sự thật cho mọi module gen/. ── */

function cryptoRandomUUID() {
  try { return require('crypto').randomUUID(); }
  catch { return 'b-' + Date.now() + '-' + Math.floor(Math.random() * 1e9); }
}

function extractMediaEntries(data) {
  const media = (data && data.data && data.data.media) || (data && data.media);   // nhận cả top-level 'media'
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    if (!m || typeof m !== 'object') continue;
    const id = m.name;
    if (typeof id !== 'string' || !id) continue;
    let url = null;
    const gen = m.image && m.image.generatedImage;
    if (gen && typeof gen.fifeUrl === 'string') url = gen.fifeUrl;
    out.push({ media_id: id, url });
  }
  return out;
}

function sizedUrl(url, quality) {
  if (!url) return url;
  if (!quality || quality === 'orig') return url;
  const base = url.replace(/=[^/]*$/, '');
  return base + '=w' + quality;
}

// Lỗi xác thực token: Google trả nguyên văn "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie…"
// (KHÔNG phải chuỗi "API_401") → phải bắt được để (a) coi là retryable, (b) làm mới token rồi thử lại.
function _isAuthErr(err) {
  return /API_401|UNAUTHENT|NO_FLOW_KEY|invalid authentication|login cooki|Expected OAuth/i.test(String(err || ''));
}
function isRetryable(err) {
  const e = String(err || '');
  if (/FILTER|PROMINENT_PEOPLE|SAFETY|INVALID_ARGUMENT|QUOTA|EXHAUSTED|RESOURCE_EXHAUSTED|API_400|API_404/i.test(e)) return false;
  if (_isAuthErr(e)) return true;
  return /CAPTCHA_FAILED|UNUSUAL_ACTIVITY|reCAPTCHA|CAPTCHA evaluation|API_401|API_403|API_429|API_5\d\d|Failed to fetch|NetworkError|TIMEOUT|NO_FLOW_KEY|IMG_HTTP_5|API_REQUEST_FAILED/i.test(e);
}

// Lỗi reCAPTCHA/hoạt-động-bất-thường → xoay MÁY CAPTCHA (đổi profile) để reset điểm reCAPTCHA rồi thử lại.
function _isCaptchaErr(err) { return /UNUSUAL_ACTIVITY|reCAPTCHA|CAPTCHA_FAILED|CAPTCHA evaluation/i.test(String(err || '')); }

// UPSCALE THẬT (2K/4K): gọi /v1/flow/upsampleImage với mediaId của ảnh vừa tạo → trả URL bản đã nâng.
function _qualityToRes(q){ return q === '2048' ? 'UPSAMPLE_IMAGE_RESOLUTION_2K' : q === '3840' ? 'UPSAMPLE_IMAGE_RESOLUTION_4K' : null; }

// #2 — Lỗi TẠM (mạng/5xx/timeout) khác lỗi quota: nên thử account KHÁC vài lần rồi mới bỏ, đừng bỏ prompt ngay.
function isTransientErr(e) { return /\b(5\d\d)\b|TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|SOCKET|NETWORK|UNAVAILABLE|INTERNAL|BACKEND|TEMPORAR|try again|fetch failed|aborted/i.test(String(e || '')); }

// Lỗi "tài khoản này hết lượt" → XOAY account khác: quota/429 (giới hạn ngày ảnh) HOẶC hết credit (video).
function isQuotaErr(e) { return /QUOTA|EXHAUSTED|RESOURCE_EXHAUSTED|PER_MODEL_DAILY|API_429|INSUFFICIENT|NO_CREDIT|OUT_OF_CREDIT|NOT_ENOUGH|CREDIT_|PAYGATE|DAILY_LIMIT|LIMIT_EXCEEDED|RATE_LIMIT/i.test(String(e || '')); }

// Lỗi content-filter phía upstream (học từ VEO3 `_is_upstream_content_filter`): Flow chặn
// prompt vì an toàn/nhân vật nổi tiếng. Đặc điểm: KHÔNG đáng retry account khác (đốt vô ích),
// nhưng CÓ THỂ sửa được bằng cách viết lại prompt (prompt-fix.js) rồi gen lại.
function isContentFilterErr(e) {
  return /CONTENT_FILTER|UPSTREAM_CONTENT|PROMINENT_PEOPLE|SAFETY|PROHIBITED|POLICY_VIOLAT|SENSITIVE_CONTENT|BLOCKED_BY/i.test(String(e || ''));
}

// Đi sâu tìm mọi chuỗi khớp regex (operation name / video url) trong phản hồi.
function deepCollect(obj, test, out = [], depth = 0) {
  if (out.length > 40 || depth > 10 || !obj) return out;
  if (typeof obj === 'string') { if (test(obj)) out.push(obj); return out; }
  if (typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) deepCollect(obj[k], test, out, depth + 1);
  return out;
}

// Đặt giá trị cho MỌI field trùng tên trong object lồng nhau (token, projectId, seed…).
function _deepSet(obj, keyMatch, value) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (keyMatch(k)) obj[k] = value;
    else if (obj[k] && typeof obj[k] === 'object') _deepSet(obj[k], keyMatch, value);
  }
}

// Thay prompt vào chỗ structuredPrompt.parts[].text (sâu bao nhiêu cũng tìm).
function _setVideoPrompt(obj, prompt) {
  let done = false;
  (function walk(o) {
    if (!o || typeof o !== 'object' || done) return;
    if (o.structuredPrompt && Array.isArray(o.structuredPrompt.parts)) {
      o.structuredPrompt.parts.forEach(p => { if (p && typeof p.text === 'string') { p.text = prompt; done = true; } });
    }
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]);
  })(obj);
  return done;
}

module.exports = { cryptoRandomUUID, extractMediaEntries, sizedUrl, _isAuthErr, isRetryable, _isCaptchaErr, _qualityToRes, isTransientErr, isQuotaErr, isContentFilterErr, deepCollect, _deepSet, _setVideoPrompt };
