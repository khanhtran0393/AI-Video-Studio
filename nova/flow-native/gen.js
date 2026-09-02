/* ── Tách từ flow-native.plain.js — tạo ảnh (tRPC project/upload/genImage/upsample) + tạo video (Veo:
     submitVideo/pollVideo/resolveVideoData) + POOL round-robin + template "học" video/upscale.
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const flowChrome = require('../flow-chrome');   // engine Chrome thật (account có a.engine==='chrome')
const { sleep, accounts, acctSession, FLOW_API_BASE, TRPC_CREATE_PROJECT, UPLOAD_IMAGE_URL, CAPTCHA_IMAGE, FLOW_TAB_URL, deepFindProjectId, extractApiError } = require('./nen-tang');
const { ensureWindow, pageEval, pageFetch, pageFetchImage, solveCaptcha } = require('./tien-trinh');
const { triggerTokenRefresh, ensurePoolTokens } = require('./token-captcha');
const { primary, syncChromeAccounts } = require('./dang-nhap');

// ── tRPC tạo project ────────────────────────────────────────────────────
async function createProject(a, title) {
  if (!a || !a.token) return { error: 'NO_FLOW_KEY' };
  try {
    const r = await pageFetch(a, {
      url: TRPC_CREATE_PROJECT,
      headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify({ json: { projectTitle: title, toolName: 'PINHOLE' } }),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: (extractApiError(data) || String(r.text).slice(0, 180)) ? 'PROJECT_' + r.status + ': ' + (extractApiError(data) || String(r.text).slice(0, 180)) : 'PROJECT_' + r.status };
    const pid = deepFindProjectId(data);
    if (!pid) return { error: 'NO_PROJECT_ID · Google trả: ' + JSON.stringify(data).slice(0, 250) };
    return { project_id: pid };
  } catch (e) { return { error: e.message || 'TRPC_FAILED' }; }
}

// ── Upload ảnh tham chiếu ───────────────────────────────────────────────
async function uploadImage(a, { projectId, base64, mime, fileName }) {
  if (!a || !a.token) return { error: 'NO_FLOW_KEY' };
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  const body = {
    clientContext: { projectId: String(projectId), tool: 'PINHOLE' },
    fileName: fileName || 'ref.png', imageBytes: clean,
    isHidden: false, isUserUploaded: true, mimeType: mime || 'image/png',
  };
  try {
    const r = await pageFetch(a, {
      url: UPLOAD_IMAGE_URL,
      headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(body),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'UPLOAD_' + r.status };
    const mediaId = data && data.media && data.media.name;
    if (!mediaId) return { error: 'NO_MEDIA_ID' };
    return { media_id: mediaId };
  } catch (e) { return { error: e.message || 'UPLOAD_FAILED' }; }
}

// ── Sinh ảnh ────────────────────────────────────────────────────────────
function genImageUrl(projectId) { return `${FLOW_API_BASE}/v1/projects/${projectId}/flowMedia:batchGenerateImages`; }

function buildImageBody({ prompt, projectId, aspect, modelName, tier, variantCount, refMediaIds }) {
  const n = Math.max(1, Math.min(Number(variantCount) || 1, 4));
  const ts = Date.now();
  const ctx = {
    projectId: String(projectId),
    recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token: '' },
    sessionId: `;${ts}`, tool: 'PINHOLE', userPaygateTier: tier,
  };
  const refIds = Array.isArray(refMediaIds) ? refMediaIds.filter(Boolean) : [];
  const imageInputs = refIds.length ? refIds.map((mid) => ({ name: mid, imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE' })) : null;
  const requests = [];
  for (let i = 0; i < n; i++) {
    const item = {
      clientContext: { ...ctx, recaptchaContext: { ...ctx.recaptchaContext }, sessionId: `;${ts + i}` },
      seed: (ts + i * 9973) % 1000000,
      structuredPrompt: { parts: [{ text: prompt }] },
      imageAspectRatio: aspect, imageModelName: modelName,
    };
    if (imageInputs) item.imageInputs = imageInputs.slice();
    requests.push(item);
  }
  return { clientContext: ctx, mediaGenerationContext: { batchId: cryptoRandomUUID() }, useNewMedia: true, requests };
}

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

async function attachImageData(a, entries, quality) {
  // LUÔN fetch URL gốc: sizedUrl (=w2048/=w3840) phá chữ ký URL Flow → 403.
  // 2K/4K xử lý bằng UPSCALE THẬT (đổi e.url thành bản đã nâng) hoặc canvas ở app.
  for (const e of entries) {
    if (e.dataUrl) continue;   // đã có ảnh (base64 từ upscale 2K/4K) → khỏi fetch
    if (!e.url) continue;
    try {
      const img = await pageFetchImage(a, e.url);
      e.dataUrl = img.dataUrl; e.b64 = img.b64; e.mime = img.mime;
    } catch (err) {
      // Bản nâng (2K/4K) fetch lỗi → LÙI VỀ ẢNH GỐC để không hỏng cả tấm.
      if (e.origUrl && e.origUrl !== e.url) {
        try {
          const img2 = await pageFetchImage(a, e.origUrl);
          e.dataUrl = img2.dataUrl; e.b64 = img2.b64; e.mime = img2.mime;
          e.upscaleFailed = true; e.url = e.origUrl;
          continue;
        } catch (err2) { e.fetchError = err2.message || 'FETCH_FAILED'; continue; }
      }
      e.fetchError = err.message || 'FETCH_FAILED';
      console.warn('[flow] attachImageData LỖI', e.fetchError, 'url=', String(e.url).slice(0, 140));
    }
  }
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

async function apiGenWithCaptcha(a, body) {
  let capToken;
  try { capToken = await solveCaptcha(a, CAPTCHA_IMAGE); }
  catch (e) { return { error: 'CAPTCHA_FAILED: ' + (e.message || 'unknown') }; }
  if (!capToken) return { error: 'CAPTCHA_FAILED: empty' };

  const finalBody = JSON.parse(JSON.stringify(body));
  if (finalBody.clientContext && finalBody.clientContext.recaptchaContext) finalBody.clientContext.recaptchaContext.token = capToken;
  if (Array.isArray(finalBody.requests)) {
    for (const r of finalBody.requests) { if (r.clientContext && r.clientContext.recaptchaContext) r.clientContext.recaptchaContext.token = capToken; }
  }
  try {
    const r = await pageFetch(a, {
      url: genImageUrl(finalBody.clientContext.projectId),
      headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(finalBody),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'API_' + r.status, status: r.status };
    const innerErr = extractApiError(data);
    if (innerErr) return { error: innerErr, status: r.status };
    return { status: r.status, data };
  } catch (e) { return { error: e.message || 'API_REQUEST_FAILED' }; }
}

// UPSCALE THẬT (2K/4K): gọi /v1/flow/upsampleImage với mediaId của ảnh vừa tạo → trả URL bản đã nâng.
function _qualityToRes(q){ return q === '2048' ? 'UPSAMPLE_IMAGE_RESOLUTION_2K' : q === '3840' ? 'UPSAMPLE_IMAGE_RESOLUTION_4K' : null; }
async function upsampleImage(a, mediaId, resolution){
  if (!a || !a.token) return { error: 'NO_FLOW_KEY' };
  const tpl = _upscaleTemplate();
  let capToken = '';
  try { capToken = await solveCaptcha(a, CAPTCHA_IMAGE); } catch (e) { return { error: 'CAPTCHA_FAILED' }; }
  let body; try { body = JSON.parse(tpl.body); } catch { body = { clientContext: { recaptchaContext: {} } }; }
  body.mediaId = mediaId;
  if (resolution) body.targetResolution = resolution;
  _deepSet(body, k => k === 'token', capToken);
  const url = tpl.url || 'https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage';
  const r = await pageFetch(a, { url, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + a.token }, body: JSON.stringify(body) });
  if (!r.ok) { console.warn('[flow] upsample', resolution, 'API_' + r.status); return { error: 'API_' + r.status }; }
  let data; try { data = JSON.parse(r.text); } catch { return { error: 'BAD_JSON' }; }
  // Flow trả ẢNH ĐÃ NÂNG dạng base64 trong `encodedImage` (KHÔNG phải URL).
  if (typeof data.encodedImage === 'string' && data.encodedImage.length > 100) {
    const b64 = data.encodedImage;
    const mime = b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    return { b64, mime };
  }
  // Dự phòng: nếu Flow đổi sang trả URL.
  const gen = (data.media && data.media.image && data.media.image.generatedImage) || (data.image && data.image.generatedImage);
  if (gen && typeof gen.fifeUrl === 'string') return { url: gen.fifeUrl };
  const urls = deepCollect(data, s => typeof s === 'string' && /^https?:\/\//.test(s) && /(googleusercontent|fife|lh3|flow-content|ggpht|usercontent)/i.test(s));
  if (urls.length) return { url: urls[urls.length - 1] };
  console.warn('[flow] upsample không tìm thấy ảnh — resp:', String(r.text || '').slice(0, 300));
  return { error: 'NO_UPSCALE_URL' };
}

async function genImage(a, params) {
  if (!a) return { error: 'NO_ACCOUNTS' };
  const maxTries = 3;
  let lastErr = 'UNKNOWN';
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    if (!a.token) { lastErr = 'NO_FLOW_KEY'; await triggerTokenRefresh(a); await sleep(1200); continue; }
    const tier = params.tier || a.tier || 'PAYGATE_TIER_ONE';
    const body = buildImageBody({ ...params, tier });
    const resp = await apiGenWithCaptcha(a, body);
    if (!resp.error) {
      const entries = extractMediaEntries(resp);
      // Chất lượng 2K/4K → UPSCALE THẬT trên server. Flow trả ảnh base64 (encodedImage) → gán thẳng.
      const upRes = _qualityToRes(params.quality);
      let upscaled = false;
      if (upRes) {   // 2K/4K → upscale THẬT (template sẵn có, không cần học)
        for (const e of entries) {
          if (!e.media_id) continue;
          try {
            const up = await upsampleImage(a, e.media_id, upRes);
            if (up && up.b64) { e.b64 = up.b64; e.mime = up.mime; e.dataUrl = 'data:' + up.mime + ';base64,' + up.b64; e.upscaled = true; upscaled = true; }
            else if (up && up.url) { e.origUrl = e.url; e.url = up.url; upscaled = true; }
          } catch (e2) { /* nâng lỗi → giữ ảnh gốc */ }
        }
      }
      // Ảnh nào đã có dataUrl (base64 từ upscale) thì attachImageData bỏ qua; còn lại fetch e.url gốc.
      if (params.withData) await attachImageData(a, entries, 'orig');
      return { media_entries: entries, attempts: attempt, upscaled };
    }
    lastErr = resp.error;
    if (!isRetryable(resp.error) || attempt === maxTries) break;
    if (_isAuthErr(resp.error)) await triggerTokenRefresh(a);
    if (_isCaptchaErr(resp.error)) { try { flowChrome.rotateCaptcha(); } catch {} }   // xoay máy captcha → token tươi từ profile khác
    const wait = /API_429/i.test(resp.error) ? 4000 * attempt : 1200 * attempt;
    await sleep(wait);
  }
  return { error: lastErr };
}

// ── POOL round-robin nhiều tài khoản ───────────────────────────────────

function poolReset() { S.pool = { cursor: 0, projects: {}, uploads: {}, _proj: {}, _up: {}, exhausted: new Set(), exhDay: {}, busy: new Set() }; }
function poolAccounts() { return S.order.filter((id) => { const a = accounts.get(id); return a && a.token && a.enabled !== false; }); }

// #1 — Quota Flow reset lúc nửa đêm giờ Thái Bình Dương. Đánh dấu account hết quota kèm "ngày PT";
// qua ngày mới thì TỰ bỏ đánh dấu → sáng hôm sau pool tự chạy lại, khỏi bấm reset tay.
function _ptDay(ms) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(0, 10); } }
function _markExhausted(id) { S.pool.exhausted.add(id); S.pool.exhDay[id] = _ptDay(Date.now()); }
function _pruneExhausted() {
  const today = _ptDay(Date.now());
  for (const id of [...S.pool.exhausted]) if (S.pool.exhDay[id] !== today) { S.pool.exhausted.delete(id); delete S.pool.exhDay[id]; console.log('[flow] quota sang ngày mới → mở lại account', id); }
}
// #2 — Lỗi TẠM (mạng/5xx/timeout) khác lỗi quota: nên thử account KHÁC vài lần rồi mới bỏ, đừng bỏ prompt ngay.
function isTransientErr(e) { return /\b(5\d\d)\b|TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|SOCKET|NETWORK|UNAVAILABLE|INTERNAL|BACKEND|TEMPORAR|try again|fetch failed|aborted/i.test(String(e || '')); }


// Còn dùng được (chưa hết quota HÔM NAY theo giờ PT).
function poolAvailable() { _pruneExhausted(); return poolAccounts().filter((id) => !S.pool.exhausted.has(id)); }
// Lỗi "tài khoản này hết lượt" → XOAY account khác: quota/429 (giới hạn ngày ảnh) HOẶC hết credit (video).
function isQuotaErr(e) { return /QUOTA|EXHAUSTED|RESOURCE_EXHAUSTED|PER_MODEL_DAILY|API_429|INSUFFICIENT|NO_CREDIT|OUT_OF_CREDIT|NOT_ENOUGH|CREDIT_|PAYGATE|DAILY_LIMIT|LIMIT_EXCEEDED|RATE_LIMIT/i.test(String(e || '')); }

function poolEnsureProject(a) {
  const email = a.id;
  if (S.pool.projects[email]) return Promise.resolve(S.pool.projects[email]);
  if (!S.pool._proj[email]) {
    S.pool._proj[email] = (async () => {
      const r = await createProject(a, 'AI Video Studio pool');
      if (r.error || !r.project_id) throw new Error(r.error || 'NO_PROJECT');
      S.pool.projects[email] = r.project_id;
      return r.project_id;
    })();
  }
  return S.pool._proj[email];
}

function poolEnsureRef(a, projectId, ref) {
  const email = a.id;
  const key = email + '|' + ref.name;
  if (S.pool.uploads[email] && S.pool.uploads[email][ref.name]) return Promise.resolve(S.pool.uploads[email][ref.name]);
  if (!S.pool._up[key]) {
    S.pool._up[key] = (async () => {
      const r = await uploadImage(a, { projectId, base64: ref.base64, mime: ref.mime, fileName: (ref.name || 'ref') + '.png' });
      if (r.error || !r.media_id) return null;
      (S.pool.uploads[email] || (S.pool.uploads[email] = {}))[ref.name] = r.media_id;
      return r.media_id;
    })();
  }
  return S.pool._up[key];
}

async function poolGen(params) {
  syncChromeAccounts();                                        // gộp account Chrome vào pool
  await ensurePoolTokens();                                    // account chưa có token (kể cả Chrome) → mở + bắt token
  if (!poolAccounts().length) return { error: 'NO_ACCOUNTS' };
  let lastErr = 'UNKNOWN'; const rotated = []; let transient = 0;
  // Thử lần lượt account còn dùng được; hết quota → đánh dấu, lỗi tạm → thử account khác, lỗi content → trả luôn.
  for (let attempt = 0; attempt < poolAccounts().length + 3; attempt++) {
    if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated };   // user bấm Dừng → thoát ngay, không thử account tiếp
    const avail = poolAvailable();
    if (!avail.length) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay', lastError: lastErr, rotated };
    // #4 — ưu tiên account đang RẢNH (chia đều tải); hết rảnh mới dùng account bận (không kẹt).
    const free = avail.filter((x) => !S.pool.busy.has(x));
    const useList = free.length ? free : avail;
    const id = useList[S.pool.cursor % useList.length];
    S.pool.cursor++;
    const a = accounts.get(id);
    S.pool.busy.add(id);                                         // #4 — giữ chỗ (pick+mark đồng bộ, không await xen giữa)
    try {
      let projectId;
      try { projectId = await poolEnsureProject(a); }
      catch (e) {
        lastErr = 'PROJECT: ' + (e.message || e);
        if (isQuotaErr(lastErr)) { _markExhausted(id); rotated.push(a.email || id); continue; }               // hết quota → account khác
        if (isTransientErr(lastErr) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
        return { error: lastErr, account: a.email || id, rotated };
      }

      const refMediaIds = [];
      if (Array.isArray(params.refs) && params.refs.length) {
        for (const ref of params.refs) {
          if (!ref || !ref.base64 || !ref.name) continue;
          const mid = await poolEnsureRef(a, projectId, ref);
          if (mid) refMediaIds.push(mid);
        }
      }

      if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated };   // vừa xong ref/project mà user bấm Dừng → khỏi tốn 1 lượt gen nữa
      const res = await genImage(a, {
        prompt: params.prompt, projectId, aspect: params.aspect, modelName: params.modelName,
        tier: a.tier, variantCount: params.variantCount || 1, quality: params.quality,
        withData: params.withData, refMediaIds,
      });
      if (!res.error) return { ...res, account: a.email || id, rotated };
      lastErr = res.error;
      if (isQuotaErr(res.error)) { _markExhausted(id); rotated.push(a.email || id); continue; }                 // hết quota → account khác
      if (isTransientErr(res.error) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
      return { ...res, account: a.email || id, rotated };      // lỗi content/filter → trả luôn, khỏi đốt account khác
    } finally {
      S.pool.busy.delete(id);                                    // #4 — luôn nhả account sau mỗi lượt
    }
  }
  return { error: 'ALL_ACCOUNTS_EXHAUSTED', lastError: lastErr, rotated };
}

// ═══════════════════════════════════════════════════════════════════════
// VIDEO (Veo image→video) — sinh video từ ảnh cảnh, giống luồng tạo ảnh.
// 2 lớp: (1) gọi trực tiếp theo shape suy từ API ảnh; (2) "học" request THẬT
// từ Flow của user (webRequest) rồi replay → khóa đúng API nếu lớp 1 sai.
// ═══════════════════════════════════════════════════════════════════════
const CAPTCHA_VIDEO = 'VIDEO_GENERATION';
// Endpoint THẬT (bắt được từ Flow): reference-to-video (ảnh khung đầu) + poll trạng thái.
const GEN_VIDEO_URL  = `${FLOW_API_BASE}/v1/video:batchAsyncGenerateVideoReferenceImages`;
const POLL_VIDEO_URL = `${FLOW_API_BASE}/v1/video:batchCheckAsyncVideoGenerationStatus`;

// Bộ bắt FULL (request + RESPONSE) — cài ngay trong trang Flow bằng cách wrap fetch/XHR.
// Nhờ có response mới biết đúng: tên operation, endpoint poll, link video cuối.
const VIDEO_CAP_INSTALL = `(function(){
  if (window.__ckmVidCap) return 'already';
  window.__ckmVidCap = { events: [] };
  var keep = /(video|Video|generateVideo|AsyncGenerate|operation|Operation|Status|scene|Scene)/;
  function rec(url, method, reqBody, status, respBody){
    try {
      if (!/aisandbox-pa|labs\\.google/.test(url)) return;
      if (!keep.test(url) && !(reqBody && keep.test(String(reqBody)))) return;
      window.__ckmVidCap.events.push({ url: url, method: method, reqBody: (typeof reqBody==='string'? reqBody.slice(0,20000): null), status: status, respBody: (respBody? String(respBody).slice(0,20000): null), at: Date.now() });
      if (window.__ckmVidCap.events.length > 30) window.__ckmVidCap.events.shift();
    } catch(e){}
  }
  var of = window.fetch;
  window.fetch = function(input, init){
    var url = (typeof input==='string')? input : (input && input.url) || '';
    var method = (init && init.method) || (input && input.method) || 'GET';
    var body = init && init.body;
    var p = of.apply(this, arguments);
    p.then(function(res){ try { res.clone().text().then(function(t){ rec(url, method, (typeof body==='string'?body:null), res.status, t); }); } catch(e){} }).catch(function(){});
    return p;
  };
  var XO = window.XMLHttpRequest.prototype.open, XS = window.XMLHttpRequest.prototype.send;
  window.XMLHttpRequest.prototype.open = function(m, u){ this.__cku=u; this.__ckm=m; return XO.apply(this, arguments); };
  window.XMLHttpRequest.prototype.send = function(b){ var self=this; this.addEventListener('load', function(){ try { rec(self.__cku||'', self.__ckm||'', (typeof b==='string'?b:null), self.status, self.responseText); } catch(e){} }); return XS.apply(this, arguments); };
  return 'installed';
})()`;

// Template VIDEO MẶC ĐỊNH — bắt từ Flow thật (giống flow-chrome/extension), model veo_3_1.
// Dùng sẵn cho MỌI khách, KHÔNG cần "học" lại. Chỉ token/project/seed/prompt/ảnh thay theo lần gọi.
const DEFAULT_VIDEO = { "genText": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_t2v\",\"seed\":0,\"metadata\":{}}],\"useV2ModelConfig\":true}" }, "genImage": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_r2v_lite\",\"seed\":0,\"metadata\":{},\"referenceImages\":[{\"mediaId\":\"\",\"imageUsageType\":\"IMAGE_USAGE_TYPE_ASSET\"}]}],\"useV2ModelConfig\":true}" }, "poll": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus", "body": "{\"media\":[{\"name\":\"\",\"projectId\":\"\"}]}" }, "modelKeys": { "omni-flash": "abra_t2v_8s", "veo31-fast": "veo_3_1_t2v_fast", "veo31-lite": "veo_3_1_t2v_lite", "veo31-quality": "veo_3_1_t2v" } };
function _vResolveModelKey(mk) { if (mk && DEFAULT_VIDEO.modelKeys[mk]) return DEFAULT_VIDEO.modelKeys[mk]; return mk; }

// Bộ "học" (dự phòng): nếu Flow đổi API, khách tạo 1 video tay để cập nhật template. Lưu ra đĩa.
const videoLearn = { gen: null, poll: null };
function videoStoreFile() { return path.join(app.getPath('userData'), 'flow-video.json'); }
function saveVideoLearn() { try { fs.writeFileSync(videoStoreFile(), JSON.stringify({ gen: videoLearn.gen, poll: videoLearn.poll })); } catch (e) {} }
function loadVideoLearn() { try { const d = JSON.parse(fs.readFileSync(videoStoreFile(), 'utf8')); if (d && (d.gen || d.poll)) { videoLearn.gen = d.gen || null; videoLearn.poll = d.poll || null; console.log('[flow] khôi phục video request đã học'); } } catch (e) { /* chưa có */ } }
loadVideoLearn();
// Template gen cho lần gọi: ưu tiên request đã học; không có thì dùng DEFAULT_VIDEO (t2v nếu không ảnh, r2v nếu có ảnh).
function _videoGenTpl(imageMediaId) { if (videoLearn.gen && videoLearn.gen.body) return videoLearn.gen; return imageMediaId ? DEFAULT_VIDEO.genImage : DEFAULT_VIDEO.genText; }
function hookVideoLearn(a) {
  const ses = acctSession(a);
  if (ses.__vidLearnHooked) return;
  ses.__vidLearnHooked = true;
  const urls = ['https://aisandbox-pa.googleapis.com/*'];
  try {
    ses.webRequest.onBeforeRequest({ urls }, (d, cb) => {
      try {
        if (d.method === 'POST' && d.uploadData && d.uploadData[0] && d.uploadData[0].bytes) {
          const body = Buffer.from(d.uploadData[0].bytes).toString('utf8');
          if (/(Status|Check|Operation|batchGet|Poll)/i.test(d.url)) {
            if (/video|operation/i.test(d.url + body)) { videoLearn.poll = { url: d.url, body, at: Date.now() }; saveVideoLearn(); }
          } else if (/(GenerateVideo|AsyncGenerate|video)/i.test(d.url) && /video/i.test(d.url + body)) {
            videoLearn.gen = { url: d.url, body, at: Date.now() }; saveVideoLearn();   // lưu ra đĩa → không mất khi restart
          }
        }
      } catch { /* bỏ qua */ }
      cb({});
    });
  } catch (e) { console.warn('[flow] hookVideoLearn:', e.message); }
}

// Template UPSCALE MẶC ĐỊNH (bắt từ Flow 1 lần) — dùng sẵn cho MỌI khách, không cần học lại.
// Chỉ mediaId + captcha token là thay theo từng ảnh; body còn lại cố định.
const DEFAULT_UPSCALE = {
  url: 'https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage',
  body: JSON.stringify({
    mediaId: '',
    targetResolution: 'UPSAMPLE_IMAGE_RESOLUTION_2K',
    clientContext: { recaptchaContext: { token: '', applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' } },
  }),
};
// Bộ "học" UPSCALE (dự phòng): nếu Flow đổi API, khách bấm 2K tay 1 lần để cập nhật template.
const upscaleLearn = { req: null, poll: null };
function _upscaleTemplate() { return (upscaleLearn.req && upscaleLearn.req.body) ? upscaleLearn.req : DEFAULT_UPSCALE; }
function upscaleStoreFile() { return path.join(app.getPath('userData'), 'flow-upscale.json'); }
function saveUpscaleLearn() { try { fs.writeFileSync(upscaleStoreFile(), JSON.stringify({ req: upscaleLearn.req, poll: upscaleLearn.poll })); } catch (e) {} }
function loadUpscaleLearn() { try { const d = JSON.parse(fs.readFileSync(upscaleStoreFile(), 'utf8')); if (d && d.req) { upscaleLearn.req = d.req; upscaleLearn.poll = d.poll || null; console.log('[flow] khôi phục upscale request đã học'); } } catch (e) { /* chưa có */ } }
loadUpscaleLearn();
function hookUpscaleLearn(a) {
  const ses = acctSession(a);
  if (ses.__upsLearnHooked) return;
  ses.__upsLearnHooked = true;
  const urls = ['https://aisandbox-pa.googleapis.com/*'];
  try {
    ses.webRequest.onBeforeRequest({ urls }, (d, cb) => {
      try {
        if (d.method === 'POST' && d.uploadData && d.uploadData[0] && d.uploadData[0].bytes) {
          const body = Buffer.from(d.uploadData[0].bytes).toString('utf8');
          const hay = d.url + ' ' + body;
          // upscale/super-res/increase resolution — LOẠI TRỪ gen ảnh/video.
          if (/([Uu]pscale|[Rr]esolution|[Hh]ighRes|[Ss]uperRes|[Ee]nhance|[Rr]econstruct|[Ii]ncrease)/.test(hay)
              && !/(GenerateVideo|AsyncGenerate|batchGenerateImages|GenerateImage)/i.test(d.url)) {
            if (/(Status|Check|Operation|Poll|batchGet|Get[A-Z])/i.test(d.url)) upscaleLearn.poll = { url: d.url, body, at: Date.now() };
            else upscaleLearn.req = { url: d.url, body, at: Date.now() };
            saveUpscaleLearn();   // lưu ra đĩa → không mất khi restart
            console.log('[flow] HỌC upscale:', d.method, d.url, '\nBODY:', body.slice(0, 1500));
          }
        }
      } catch { /* bỏ qua */ }
      cb({});
    });
  } catch (e) { console.warn('[flow] hookUpscaleLearn:', e.message); }
}
async function armUpscaleLearn() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  await ensureWindow(a, { show: true });
  return { ok: true, note: 'Đã mở cửa sổ Flow. Bấm Tải xuống → 2K (hoặc 4K) trên 1 ảnh bất kỳ để app học request upscale.' };
}
function upscaleLearnStatus() { return { learned: !!upscaleLearn.req, hasPoll: !!upscaleLearn.poll, url: upscaleLearn.req && upscaleLearn.req.url, at: upscaleLearn.req && upscaleLearn.req.at }; }
function upscaleLearnDump() { return { req: upscaleLearn.req, poll: upscaleLearn.poll }; }

// Đi sâu tìm mọi chuỗi khớp regex (operation name / video url) trong phản hồi.
function deepCollect(obj, test, out = [], depth = 0) {
  if (out.length > 40 || depth > 10 || !obj) return out;
  if (typeof obj === 'string') { if (test(obj)) out.push(obj); return out; }
  if (typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) deepCollect(obj[k], test, out, depth + 1);
  return out;
}

// Body THẬT (bắt từ Flow): reference-to-video. Ảnh khung đầu = referenceImages[].mediaId.
function buildVideoBody({ prompt, projectId, aspect, modelKey, tier, imageMediaId, seed }) {
  const ts = Date.now();
  return {
    mediaGenerationContext: { batchId: cryptoRandomUUID(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
    clientContext: {
      projectId: String(projectId), tool: 'PINHOLE', userPaygateTier: tier || 'PAYGATE_TIER_ONE',
      sessionId: ';' + ts,
      recaptchaContext: { token: '', applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
    },
    requests: [{
      aspectRatio: aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE',
      textInput: { structuredPrompt: { parts: [{ text: prompt }] } },
      videoModelKey: modelKey || 'abra_r2v_8s',
      seed: (seed != null ? seed : ts % 100000),
      metadata: {},
      referenceImages: imageMediaId ? [{ mediaId: imageMediaId, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }] : [],
    }],
    useV2ModelConfig: true,
  };
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
// Dựng body từ template (request đã học HOẶC DEFAULT_VIDEO) → thay prompt/ảnh/token/seed/project/model.
function _bodyFromLearnedGen({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs }) {
  const tpl = _videoGenTpl(imageMediaId);
  if (!tpl || !tpl.body) return null;
  let body; try { body = JSON.parse(tpl.body); } catch { return null; }
  _deepSet(body, k => k === 'token', capToken);
  _deepSet(body, k => k === 'projectId', String(projectId));
  _deepSet(body, k => k === 'seed', Date.now() % 100000);
  _deepSet(body, k => k === 'batchId', cryptoRandomUUID());
  _deepSet(body, k => k === 'sessionId', ';' + Date.now());
  // Đổi model nếu khách chọn (khớp đúng t2v/r2v theo có ảnh hay không); không chọn → giữ model mặc định của template.
  if (modelKey) { const wantType = imageMediaId ? 'r2v' : 't2v'; const typed = _vResolveModelKey(modelKey).replace(/(^|_)(t2v|r2v|i2v)(?=_|$)/, '$1' + wantType); _deepSet(body, k => k === 'videoModelKey', typed); }
  if (durationSecs) (function walk(o) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (k === 'videoModelKey' && typeof o[k] === 'string') o[k] = o[k].replace(/_(\d+)s\b/, '_' + durationSecs + 's'); else if (o[k] && typeof o[k] === 'object') walk(o[k]); } })(body);
  _setVideoPrompt(body, prompt);
  if (imageMediaId) (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.referenceImages)) o.referenceImages.forEach(ri => { if (ri && typeof ri === 'object' && 'mediaId' in ri) ri.mediaId = imageMediaId; });
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]);
  })(body);
  return body;
}

async function submitVideo(a, { prompt, projectId, aspect, modelKey, tier, imageMediaId, durationSecs }) {
  let capToken;
  try { capToken = await solveCaptcha(a, CAPTCHA_VIDEO); }
  catch (e) { return { error: 'CAPTCHA_FAILED: ' + (e.message || 'unknown') }; }
  // Dùng template (đã học HOẶC DEFAULT_VIDEO veo_3_1); chỉ khi template hỏng mới rơi về body hardcode cũ.
  let url = GEN_VIDEO_URL;
  let body = _bodyFromLearnedGen({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs });
  if (body) { url = _videoGenTpl(imageMediaId).url || GEN_VIDEO_URL; }
  else { body = buildVideoBody({ prompt, projectId, aspect, modelKey, tier, imageMediaId, seed: Date.now() % 100000 }); body.clientContext.recaptchaContext.token = capToken; }
  try {
    const r = await pageFetch(a, {
      url, headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(body),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'VIDEO_' + r.status, status: r.status, raw: String(r.text).slice(0, 500) };
    const innerErr = extractApiError(data);
    if (innerErr) return { error: innerErr, status: r.status, raw: String(r.text).slice(0, 500) };
    const first = data && Array.isArray(data.media) && data.media[0];
    const mediaId = first && first.name;
    if (!mediaId) return { error: 'NO_MEDIA_ID · ' + String(r.text).slice(0, 200) };
    return { mediaId, projectId: (first && first.projectId) || projectId };
  } catch (e) { return { error: e.message || 'VIDEO_REQUEST_FAILED' }; }
}

async function pollVideo(a, { projectId, mediaId }) {
  // Ưu tiên poll request THẬT đã học; không có thì dùng body mặc định.
  let url = POLL_VIDEO_URL, body = null;
  if (videoLearn.poll && videoLearn.poll.body) {
    try {
      body = JSON.parse(videoLearn.poll.body);
      url = videoLearn.poll.url || POLL_VIDEO_URL;
      _deepSet(body, k => k === 'projectId', String(projectId));
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o.media)) o.media.forEach(m => { if (m && typeof m === 'object') { if ('name' in m) m.name = mediaId; if ('mediaId' in m) m.mediaId = mediaId; } });
        for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]);
      })(body);
    } catch { body = null; }
  }
  if (!body) body = { media: [{ name: mediaId, projectId: String(projectId) }] };
  try {
    const r = await pageFetch(a, {
      url, headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(body),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'POLL_' + r.status, raw: String(r.text).slice(0, 400) };
    const first = data && Array.isArray(data.media) && data.media[0];
    const status = first?.mediaMetadata?.mediaStatus?.mediaGenerationStatus || '';
    const done = /SUCCESSFUL/i.test(status);
    const failed = /FAIL|ERROR|REJECT|BLOCK/i.test(status);
    // Link video (nếu response có kèm) — dò sâu mọi field.
    const urls = deepCollect(data, (s) => /^https?:\/\//.test(s) && /(\.mp4|fife|googleusercontent|googlevideo|videoplayback|servingUri|downloadUri|Uri)/i.test(s));
    const credits = (data && typeof data.remainingCredits === 'number') ? data.remainingCredits : null;
    return { data, status, done, failed, credits, videoUrl: urls[0] || null, raw: String(r.text).slice(0, 300) };
  } catch (e) { return { error: e.message || 'POLL_REQUEST_FAILED' }; }
}

// Sau khi SUCCESSFUL, lấy link/bytes video: navigate cửa sổ Flow tới project rồi đọc <video> src.
async function resolveVideoData(a, { projectId, mediaId, withData }) {
  try {
    const win = await ensureWindow(a);
    await win.loadURL(`${FLOW_TAB_URL}/project/${projectId}`);
    // Chờ media xuất hiện + đọc URL từ DOM/blob.
    const code = `(async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 45000) {
        const vids = Array.from(document.querySelectorAll('video'));
        const v = vids.map(x => x.currentSrc || x.src).find(u => u && !u.startsWith('blob:'));
        if (v) return { url: v };
        await new Promise(r => setTimeout(r, 1500));
      }
      return { url: null };
    })()`;
    const got = await pageEval(a, code);
    if (!got || !got.url) return { videoUrl: null };
    let vid = null;
    if (withData) { try { vid = await fetchVideoData(a, got.url); } catch (e) { vid = { fetchError: e.message }; } }
    return { videoUrl: got.url, video: vid };
  } catch (e) { return { videoUrl: null, resolveError: e.message }; }
}

// Tải video (blob) về base64 để lưu/hiển thị, đúng origin Flow.
async function fetchVideoData(a, url) {
  const code = `(async () => {
    const r = await fetch(${JSON.stringify(url)});
    if (!r.ok) throw new Error('VID_HTTP_' + r.status);
    const b = await r.blob(); const buf = await b.arrayBuffer();
    let bin = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return { b64: btoa(bin), mime: b.type || 'video/mp4', size: u.length };
  })()`;
  return pageEval(a, code);
}

// Chờ 1 account rảnh (chưa hết quota, chưa bận) → đặt trước (busy) để chạy SONG SONG.
async function acquireAccount() {
  const start = Date.now();
  while (Date.now() - start < 900000) {   // chờ tối đa 15 phút
    _pruneExhausted();   // #1 — qua ngày PT thì mở lại account đã hết quota
    const free = poolAccounts().filter((id) => !S.pool.exhausted.has(id) && !S.pool.busy.has(id));
    if (free.length) { const id = free[S.pool.cursor % free.length]; S.pool.cursor++; S.pool.busy.add(id); return accounts.get(id); }
    if (poolAccounts().every((id) => S.pool.exhausted.has(id))) return null;   // tất cả hết quota
    await sleep(1500);
  }
  return null;
}

// Chạy tạo video 1 cảnh trên 1 account cụ thể. Trả {ok|error, quota?}.
async function runVideoOnAccount(a, params) {
  if (a.engine === 'chrome') {   // engine Chrome thật → dùng công thức video bê từ extension
    const r = await flowChrome.genVideo(a.chromeId, params);
    if (r && r.error && isQuotaErr(r.error)) return { quota: true, error: r.error };
    return r;
  }
  const id = a.id;
  let projectId;
  try { projectId = await poolEnsureProject(a); }
  catch (e) { const m = 'PROJECT: ' + (e.message || e); return isQuotaErr(m) ? { quota: true, error: m } : { error: m }; }

  let imageMediaId = null;
  if (params.image && params.image.base64) {
    const up = await uploadImage(a, { projectId, base64: params.image.base64, mime: params.image.mime || 'image/png', fileName: (params.sceneId || 'frame') + '.png' });
    if (up.error) return isQuotaErr(up.error) ? { quota: true, error: 'UPLOAD: ' + up.error } : { error: 'UPLOAD: ' + up.error };
    imageMediaId = up.media_id;
  }

  const modelKey = params.modelName || null;   // null → template dùng model mặc định veo_3_1 (r2v_lite nếu có ảnh, t2v nếu không)
  const sub = await submitVideo(a, { prompt: params.prompt, projectId, aspect: params.aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE', modelKey, tier: a.tier, imageMediaId, durationSecs: params.durationSecs });
  if (sub.error) return isQuotaErr(sub.error) ? { quota: true, error: sub.error } : { ...sub };

  const started = Date.now();
  let doneOk = false, videoUrl = null, credits = null;
  while (Date.now() - started < 360000) {
    await sleep(6000);
    const p = await pollVideo(a, { projectId: sub.projectId, mediaId: sub.mediaId });
    if (p.credits != null) credits = p.credits;
    if (p.error) return isQuotaErr(p.error) ? { quota: true, error: p.error, mediaId: sub.mediaId } : { error: p.error, mediaId: sub.mediaId };
    if (p.failed) { const fe = 'Flow báo tạo video THẤT BẠI (' + (p.status || '?') + ')'; return isQuotaErr(p.status || fe) ? { quota: true, error: fe, mediaId: sub.mediaId } : { error: fe, mediaId: sub.mediaId }; }
    if (p.done) { doneOk = true; videoUrl = p.videoUrl || null; break; }
  }
  if (!doneOk) return { error: 'TIMEOUT chờ video', mediaId: sub.mediaId };

  let vid = null;
  if (!videoUrl || params.withData) {
    const rv = await resolveVideoData(a, { projectId: sub.projectId, mediaId: sub.mediaId, withData: params.withData });
    videoUrl = videoUrl || rv.videoUrl;
    vid = rv.video || null;
  }
  return { ok: true, mediaId: sub.mediaId, projectId: sub.projectId, videoUrl, video: vid, credits };
}

// Sinh video 1 cảnh qua POOL: đặt account rảnh → chạy → nhả. Nhiều lời gọi đồng thời = song song.
async function genVideoPool(params) {
  syncChromeAccounts();
  if (!poolAccounts().length) { await ensurePoolTokens(); }
  if (!poolAccounts().length) return { error: 'NO_ACCOUNTS' };
  while (true) {
    const a = await acquireAccount();
    if (!a) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay' };
    const id = a.id;
    try {
      const r = await runVideoOnAccount(a, params);
      if (r.quota) { _markExhausted(id); continue; }   // account này hết quota → thử account khác (qua ngày tự mở lại)
      return { ...r, account: a.email || id };
    } catch (e) {
      return { error: e.message || 'VIDEO_FAILED', account: a.email || id };
    } finally {
      S.pool.busy.delete(id);
    }
  }
}

async function capEvents(a) {
  try { const ev = await pageEval(a, `(window.__ckmVidCap && window.__ckmVidCap.events) || []`); return Array.isArray(ev) ? ev : []; }
  catch { return []; }
}
async function videoLearnStatus() {
  const a = primary();
  const ev = a ? await capEvents(a) : [];
  // Coi là "gen" nếu có event POST trả về operation/scene; "poll" nếu có event Status/Check.
  const gen = ev.some(e => e.method === 'POST' && /(AsyncGenerate|generateVideo|:batch)/i.test(e.url) && !/(Status|Check)/i.test(e.url));
  const poll = ev.some(e => /(Status|Check|Operation)/i.test(e.url));
  // DEFAULT_VIDEO đã có sẵn text/image/poll → luôn báo "sẵn sàng" cho UI (khách không phải học lại).
  return { text: true, image: true, gen: gen || !!videoLearn.gen, poll: true, captured: ev.length, learned: !!videoLearn.gen };
}
async function videoLearnDump() {
  const a = primary();
  const ev = a ? await capEvents(a) : [];
  return { events: ev, count: ev.length, webReq: { gen: videoLearn.gen, poll: videoLearn.poll } };
}
async function armVideoLearn() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  await ensureWindow(a, { show: true });
  let installed = null;
  try { installed = await pageEval(a, VIDEO_CAP_INSTALL); } catch (e) { installed = 'err:' + (e.message || e); }
  return { ok: true, installed, note: 'Đã mở Flow + bật bắt request. Hãy tạo 1 video CÓ ĐÍNH ẢNH làm khung đầu + prompt.' };
}

// Đọc danh sách MODEL video thật từ trang Flow (quét __NEXT_DATA__ + script + request đã bắt).
async function videoModels() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  try { await ensureWindow(a); } catch { /* */ }
  // 1) Quét trong trang: các model key kiểu abra_*/veo* r2v/i2v + nhãn hiển thị gần đó.
  const scrape = `(function(){
    const keys = new Set();
    const addKey = s => { if (s && /^[a-z0-9_]{4,48}$/i.test(s) && /(r2v|i2v|_v2v|veo|abra)/i.test(s)) keys.add(s); };
    const scan = t => { if (!t) return; const re = /["\\']([a-z0-9_]{4,48})["\\']/gi; let m; while ((m = re.exec(t))) addKey(m[1]); };
    try { const nd = document.getElementById('__NEXT_DATA__'); if (nd) scan(nd.textContent); } catch(e){}
    try { for (const sc of document.scripts) { const t = sc.textContent || ''; if (t && t.length < 800000 && /r2v|abra|veo/i.test(t)) scan(t); } } catch(e){}
    return Array.from(keys).slice(0, 60);
  })()`;
  let pageKeys = [];
  try { pageKeys = await pageEval(a, scrape) || []; } catch { /* */ }
  // 2) Bổ sung từ request video đã bắt (nếu có).
  const ev = await capEvents(a);
  const capKeys = [];
  for (const e of ev) {
    const body = (e.reqBody || '') + (e.respBody || '');
    const re = /"videoModel(?:Key|Name)"\s*:\s*"([^"]+)"/g; let m;
    while ((m = re.exec(body))) capKeys.push(m[1]);
  }
  const all = Array.from(new Set([...capKeys, ...pageKeys]))
    .filter(k => /r2v|i2v/i.test(k))   // chỉ giữ model ảnh→video
    .sort();
  return { models: all, fromCapture: capKeys, fromPage: pageKeys.length };
}

module.exports = { createProject, uploadImage, genImage, poolReset, poolAccounts, poolGen, genVideoPool, armVideoLearn, videoLearnStatus, videoLearnDump, armUpscaleLearn, upscaleLearnStatus, upscaleLearnDump, videoModels, hookVideoLearn, hookUpscaleLearn };