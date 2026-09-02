/* ── Tạo ảnh — tRPC createProject/uploadImage/genImage + upsample (2K/4K). Tách từ gen/legacy.js.
     Upscale THẬT (upsampleImage + template "học") nằm ở ./learn để sát state upscale. ── */
const flowChrome = require('../../flow-chrome');   // engine Chrome thật (xoay máy captcha khi lỗi reCAPTCHA)
const { sleep, FLOW_API_BASE, TRPC_CREATE_PROJECT, UPLOAD_IMAGE_URL, CAPTCHA_IMAGE, deepFindProjectId, extractApiError } = require('../nen-tang');
const { pageFetch, pageFetchImage, solveCaptcha } = require('../tien-trinh');
const { triggerTokenRefresh } = require('../token-captcha');
const { cryptoRandomUUID, extractMediaEntries, _isAuthErr, _isCaptchaErr, isRetryable, _qualityToRes } = require('./shared');
const { upsampleImage } = require('./learn');

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

module.exports = { createProject, uploadImage, genImage };
