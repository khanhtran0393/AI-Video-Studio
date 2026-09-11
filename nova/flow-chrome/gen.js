/* â”€â”€ TÃ¡ch tá»« flow-chrome.js â€” gen áº£nh (test) + pipeline video há»c request + upscale + watermark + genVideo + getAllTokens (getAccountData chuyá»ƒn tá»« 683â€“709 cuá»‘i file â€” háº¡ gá»£i chu trÃ¬nh vá»›i cÃ¡c háº±ng).
     State dÃ¹ng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) náº±m
     trong ./trang-thai (S) vÃ¬ bá»‹ gÃ¡n láº¡i xuyÃªn file â€” destructuring require chá»‰ snapshot giÃ¡ trá»‹ cÅ©. â”€â”€ */
const S = require('./trang-thai');
const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { FLOW_API_BASE, FLOW_API_KEY, accounts, LOG, evalInPage, FLOW_URL, sleep, evalInPageT, persist, SITE_KEY } = require('./nen-tang');
const { ensureLive, pageEval } = require('./token-captcha');
const { closeChrome, apiFetch, running, readCookies } = require('./tien-trinh');

// â”€â”€ HÃ m thuáº§n (copy tá»« flow-native Ä‘á»ƒ test Ä‘á»™c láº­p, khÃ´ng Ä‘á»¥ng engine cÅ©) â”€â”€
const TRPC_CREATE_PROJECT = 'https://labs.google/fx/api/trpc/project.createProject';
/* SITE_KEY — định nghĩa một nguồn ở ./nen-tang (cùng nhóm hằng Flow) */
function genImageUrl(projectId) { return `${FLOW_API_BASE}/v1/projects/${projectId}/flowMedia:batchGenerateImages`; }
function cryptoRandomUUID() { try { return require('crypto').randomUUID(); } catch { return 'b-' + Date.now(); } }
function deepFindProjectId(o, d = 0) { if (!o || typeof o !== 'object' || d > 8) return null; if (typeof o.projectId === 'string' && o.projectId) return o.projectId; for (const k of Object.keys(o)) { const v = deepFindProjectId(o[k], d + 1); if (v) return v; } return null; }
function extractApiError(data) { const e = data && typeof data === 'object' ? data.error : null; if (!e || typeof e !== 'object') return null; const reason = (e.details || []).map((x) => x && x.reason).find(Boolean); const msg = e.message || e.status || 'API error'; return reason ? `${reason}: ${msg}` : String(msg); }
function extractApiError(data) { const e = data && typeof data === 'object' ? data.error : null; if (!e || typeof e !== 'object') return null; const reason = (e.details || []).map((x) => x && x.reason).find(Boolean); const msg = e.message || e.status || 'API error'; return reason ? `${reason}: ${msg}` : String(msg); }
function extractMediaEntries(data) { const media = (data && data.media) || (data && data.data && data.data.media); if (!Array.isArray(media)) return []; const out = []; for (const m of media) { if (!m || typeof m !== 'object') continue; const id = m.name; if (typeof id !== 'string' || !id) continue; let url = null; const gen = m.image && m.image.generatedImage; if (gen) url = gen.fifeUrl || gen.servingUri || gen.servingUrl || gen.url || null; if (!url) { const u = _vAnyUrl(m); if (u.length) url = u[u.length - 1]; } out.push({ media_id: id, url }); } return out; }
function buildImageBody({ prompt, projectId, aspect, modelName, tier, variantCount }) {
  const n = Math.max(1, Math.min(Number(variantCount) || 1, 4)); const ts = Date.now();
  const ctx = { projectId: String(projectId), recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token: '' }, sessionId: `;${ts}`, tool: 'PINHOLE', userPaygateTier: tier };
  const requests = [];
  for (let i = 0; i < n; i++) requests.push({ clientContext: { ...ctx, recaptchaContext: { ...ctx.recaptchaContext }, sessionId: `;${ts + i}` }, seed: (ts + i * 9973) % 1000000, structuredPrompt: { parts: [{ text: prompt }] }, imageAspectRatio: aspect, imageModelName: modelName });
  return { clientContext: ctx, mediaGenerationContext: { batchId: cryptoRandomUUID() }, useNewMedia: true, requests };
}
function captchaCode(action) {
  return `(async () => {
    const s = Date.now();
    while (!(window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute)) { if (Date.now()-s>15000) throw new Error('grecaptcha not available'); await new Promise(r=>setTimeout(r,200)); }
    var key=null; try{ if(typeof ___grecaptcha_cfg!=='undefined'&&___grecaptcha_cfg.clients){ var cs=___grecaptcha_cfg.clients,ids=Object.keys(cs); outer:for(var i=0;i<ids.length;i++){var c=cs[ids[i]];for(var k in c){var o=c[k];if(o&&typeof o==='object')for(var k2 in o){var v=o[k2];if(v&&typeof v==='object'&&v.sitekey){key=v.sitekey;break outer;}}}} } }catch(e){}
    if(!key){ try{ var sc=document.querySelectorAll('script[src*="recaptcha"]'); for(var j=0;j<sc.length;j++){ var m=sc[j].src.match(/[?&]render=([^&]+)/); if(m&&m[1]&&m[1]!=='explicit'){ key=m[1]; break; } } }catch(e){} }
    if(!key)key=${JSON.stringify(SITE_KEY)};
    await new Promise(function(res){ try{ window.grecaptcha.enterprise.ready(res); }catch(e){ res(); } });   // chá» grecaptcha init xong
    return await Promise.race([
      window.grecaptcha.enterprise.execute(key,{action:${JSON.stringify(action)}}),
      new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('CAPTCHA_TIMEOUT')); }, 25000); })   // chá»‘ng treo vÃ´ háº¡n
    ]);
  })()`;
}

// Test táº¡o 1 áº£nh trÃªn 1 account Chrome (chá»©ng minh gen qua CDP cháº¡y).
async function genTest(id, prompt, tokenId) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  let live; try { live = await ensureLive(id); } catch (e) { return { error: 'Má»Ÿ Chrome lá»—i: ' + (e.message || e) }; }
  const { cdp } = live; let token = live.token; let a = accounts.get(id);
  // TEST token-only: dÃ¹ng Chrome cá»§a account `id` (chá»‰ Ä‘á»ƒ giáº£i captcha) + TOKEN cá»§a account `tokenId`.
  if (tokenId && tokenId !== id && accounts.has(tokenId)) {
    try { const t2 = await ensureLive(tokenId); token = t2.token; await closeChrome(tokenId); a = accounts.get(tokenId); LOG('TEST token-only: Chrome acc', id, '+ token acc', tokenId); }
    catch (e) { return { error: 'Láº¥y token acc ' + tokenId + ' lá»—i: ' + (e.message || e) }; }
  }
  try {
    LOG('acc', id, 'genTest: táº¡o projectâ€¦');
    const pr = await apiFetch(cdp, { url: TRPC_CREATE_PROJECT, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify({ json: { projectTitle: 'Nova Chrome', toolName: 'PINHOLE' } }) });
    let pd; try { pd = JSON.parse(pr.text); } catch { pd = pr.text; }
    if (!pr.ok) return { error: 'PROJECT_' + pr.status + ': ' + (extractApiError(pd) || String(pr.text).slice(0, 150)) };
    const projectId = deepFindProjectId(pd);
    if (!projectId) return { error: 'NO_PROJECT_ID' };
    LOG('acc', id, 'genTest: giáº£i captchaâ€¦');
    // Mint qua MÁY CAPTCHA (pageEval): trang account giờ là flow.google.com — không còn grecaptcha
    // như labs.google cũ; mode guest mint trên máy guest, mode machine đi cửa sổ captcha riêng.
    let capToken; try { capToken = await pageEval(id, captchaCode('IMAGE_GENERATION')); } catch (e) { return { error: 'CAPTCHA: ' + (e.message || e) }; }
    if (!capToken) return { error: 'CAPTCHA_EMPTY' };
    const body = buildImageBody({ prompt, projectId, aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE', modelName: 'GEM_PIX_2', tier: a.tier || null, variantCount: 1 });
    body.clientContext.recaptchaContext.token = capToken;
    for (const rq of body.requests) { if (rq.clientContext && rq.clientContext.recaptchaContext) rq.clientContext.recaptchaContext.token = capToken; }
    LOG('acc', id, 'genTest: gá»i batchGenerateImagesâ€¦');
    const gr = await apiFetch(cdp, { url: genImageUrl(projectId), method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    let gd; try { gd = JSON.parse(gr.text); } catch { gd = gr.text; }
    if (!gr.ok) return { error: 'GEN_' + gr.status + ': ' + (extractApiError(gd) || String(gr.text).slice(0, 150)) };
    const entries = extractMediaEntries(gd);
    if (!entries.length) LOG('acc', id, 'genTest 0 áº£nh â€” Flow tráº£:', String(gr.text).slice(0, 500));
    LOG('acc', id, 'genTest â†’ âœ“', entries.length, 'áº£nh; url0', entries[0] && String(entries[0].url).slice(0, 60));
    // Gen áº£nh trá»« tÃ­n dá»¥ng nhÆ°ng API generate khÃ´ng tráº£ sá»‘ dÆ° â†’ chá»§ Ä‘á»™ng há»i /v1/credits rá»“i ghi ngÆ°á»£c (giá»‘ng nhÃ¡nh video poll).
    try { const cr = await apiFetch(cdp, { url: FLOW_API_BASE + '/v1/credits?key=' + encodeURIComponent(FLOW_API_KEY), method: 'GET', headers: { authorization: 'Bearer ' + token } }); if (cr.ok) { const cd = JSON.parse(cr.text); if (typeof cd.credits === 'number' && a && a.credits !== cd.credits) { a.credits = cd.credits; persist(); LOG('acc', id, 'genTest â†’ credits', cd.credits); } } } catch (e) { LOG('acc', id, 'genTest credits (bá» qua):', e && e.message); }
    return { ok: entries.length > 0, count: entries.length, url: entries[0] && entries[0].url, credits: a && a.credits, raw: entries.length ? undefined : String(gr.text).slice(0, 300) };
  } catch (e) { return { error: 'genTest lá»—i: ' + (e.message || e) }; }
}

// â•â•â•â•â•â•â•â•â•â•â• VIDEO â€” cÃ´ng thá»©c bÃª tá»« extension (Ä‘Ã£ "há»c" request tháº­t) â•â•â•â•â•â•â•â•â•â•â•
const UPLOAD_IMAGE_URL = `${FLOW_API_BASE}/v1/flow/uploadImage`;
const DEFAULT_VIDEO = { "genText": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_t2v\",\"seed\":0,\"metadata\":{}}],\"useV2ModelConfig\":true}" }, "genImage": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_r2v_lite\",\"seed\":0,\"metadata\":{},\"referenceImages\":[{\"mediaId\":\"\",\"imageUsageType\":\"IMAGE_USAGE_TYPE_ASSET\"}]}],\"useV2ModelConfig\":true}" }, "poll": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus", "body": "{\"media\":[{\"name\":\"\",\"projectId\":\"\"}]}" }, "modelKeys": { "omni-flash": "abra_t2v_8s", "veo31-fast": "veo_3_1_t2v_fast", "veo31-lite": "veo_3_1_t2v_lite", "veo31-quality": "veo_3_1_t2v" } };
function _vDeepSet(o, pred, val) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (pred(k)) o[k] = val; else if (o[k] && typeof o[k] === 'object') _vDeepSet(o[k], pred, val); } }
function _vDeepSet2(o, pred, fn) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (pred(k)) o[k] = fn(o[k]); else if (o[k] && typeof o[k] === 'object') _vDeepSet2(o[k], pred, fn); } }
function _vSetPrompt(o, prompt) { (function w(x) { if (!x || typeof x !== 'object') return; if (x.structuredPrompt && Array.isArray(x.structuredPrompt.parts)) x.structuredPrompt.parts.forEach((p) => { if (p && 'text' in p) p.text = prompt; }); for (const k of Object.keys(x)) if (x[k] && typeof x[k] === 'object') w(x[k]); })(o); }
function _vAnyUrl(data) { const out = []; (function w(v) { if (!v) return; if (typeof v === 'string') { if (/^https?:\/\/\S{8,}/.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach(w); else if (typeof v === 'object') for (const k in v) w(v[k]); })(data); return out; }
const _VID_URL_RE = /(flow-content\.google|\/video\/|videoplayback|\.mp4)/i;
// TÃ¬m ÄÃšNG link video cá»§a mediaId trong cÃ¢y JSON projectInitialData.
// URL phá»¥c vá»¥ (fife/serving) KHÃ”NG chá»©a mediaId, nÃªn pháº£i khá»›p theo ENTRY (name===mediaId) rá»“i láº¥y URL trong entry Ä‘Ã³.
function _findVideoUrlForMedia(d, mediaId) {
  if (!d || !mediaId) return null;
  const mid = String(mediaId);
  const hit = (v) => typeof v === 'string' && (v === mid || (mid.length >= 12 && v.includes(mid)));
  let found = null;
  (function w(o) {
    if (found || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) { w(x); if (found) return; } return; }
    if (hit(o.name) || hit(o.mediaId) || hit(o.mediaGenerationId) || hit(o.id)) {
      const gv = (o.video && o.video.generatedVideo) || o.generatedVideo || null;
      let u = null;
      if (gv && typeof gv === 'object') u = gv.fifeUrl || gv.servingUri || gv.servingUrl || gv.url || gv.downloadUri || null;
      if (!u) { const arr = _vAnyUrl(o).filter((x) => _VID_URL_RE.test(x)); if (arr.length) u = arr[arr.length - 1]; }
      if (u) { found = u; return; }
    }
    for (const k in o) { w(o[k]); if (found) return; }
  })(d);
  return found;
}
function _vLearnedFor(imageMediaId) { return imageMediaId ? DEFAULT_VIDEO.genImage : DEFAULT_VIDEO.genText; }
function _vResolveModelKey(modelKey) { if (modelKey && DEFAULT_VIDEO.modelKeys[modelKey]) return DEFAULT_VIDEO.modelKeys[modelKey]; return modelKey; }
function _vBodyFromLearned({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs }) {
  const tpl = _vLearnedFor(imageMediaId); if (!tpl || !tpl.body) return null;
  let body; try { body = JSON.parse(tpl.body); } catch { return null; }
  _vDeepSet(body, (k) => k === 'token', capToken);
  _vDeepSet(body, (k) => k === 'projectId', String(projectId));
  _vDeepSet(body, (k) => k === 'seed', Math.floor(Date.now() % 100000));
  _vDeepSet(body, (k) => k === 'sessionId', ';' + Date.now());
  if (modelKey) {
    const typed = _vResolveModelKey(modelKey);
    if (imageMediaId) {
      const R2V_FALLBACK = { 'veo_3_1_t2v_fast': 'veo_3_1_r2v_lite', 'veo_3_1_t2v': 'veo_3_1_r2v_lite', 'veo_3_1_t2v_lite': 'veo_3_1_r2v_lite', 'abra_t2v_8s': 'abra_r2v_8s' };
      _vDeepSet(body, (k) => k === 'videoModelKey', R2V_FALLBACK[typed] || typed);
    } else {
      _vDeepSet(body, (k) => k === 'videoModelKey', typed);
    }
  }
  if (durationSecs) _vDeepSet2(body, (k) => k === 'videoModelKey', (cur) => (typeof cur === 'string' && !/^abra_/.test(cur) ? cur.replace(/_(\d+)s\b/, '_' + durationSecs + 's') : cur));
  if (prompt) _vSetPrompt(body, prompt);
  if (imageMediaId) (function w(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o.referenceImages)) o.referenceImages.forEach((ri) => { if (ri && typeof ri === 'object' && 'mediaId' in ri) ri.mediaId = imageMediaId; }); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') w(o[k]); })(body);
  return body;
}

const _vProjects = new Map();   // id -> projectId (cache/account)
async function vEnsureProject(id, token) {
  if (_vProjects.has(id)) return _vProjects.get(id);
  const { cdp } = await ensureLive(id);
  const r = await apiFetch(cdp, { url: TRPC_CREATE_PROJECT, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify({ json: { projectTitle: 'Nova Chrome video', toolName: 'PINHOLE' } }) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) throw new Error('PROJECT_' + r.status);
  const pid = deepFindProjectId(d); if (!pid) throw new Error('NO_PROJECT_ID');
  _vProjects.set(id, pid); return pid;
}
async function vUploadImage(id, token, projectId, { base64, mime, fileName }) {
  const { cdp } = await ensureLive(id);
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  const body = { clientContext: { projectId: String(projectId), tool: 'PINHOLE' }, fileName: fileName || 'ref.png', imageBytes: clean, isHidden: false, isUserUploaded: true, mimeType: mime || 'image/png' };
  const r = await apiFetch(cdp, { url: UPLOAD_IMAGE_URL, method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) return { error: extractApiError(d) || 'UPLOAD_' + r.status };
  const mediaId = d && d.media && d.media.name; if (!mediaId) return { error: 'NO_MEDIA_ID' };
  return { media_id: mediaId };
}
async function vSubmit(id, { token, prompt, projectId, imageMediaId, modelKey, durationSecs }) {
  const { cdp } = await ensureLive(id);
  let capToken; try { capToken = await pageEval(id, captchaCode('VIDEO_GENERATION')); } catch (e) { return { error: 'CAPTCHA: ' + (e.message || e) }; }   // mint qua máy captcha — xem genTest
  if (!capToken) return { error: 'CAPTCHA_EMPTY' };
  const body = _vBodyFromLearned({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs });
  if (!body) return { error: 'VIDEO_BODY_NULL' };
  const tpl = _vLearnedFor(imageMediaId);
  const r = await apiFetch(cdp, { url: tpl.url, method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) return { error: extractApiError(d) || 'VIDEO_' + r.status };
  const ie = extractApiError(d); if (ie) return { error: ie };
  const first = d && Array.isArray(d.media) && d.media[0]; const mediaId = first && first.name;
  if (!mediaId) return { error: 'NO_MEDIA_ID' };
  return { mediaId, projectId: (first && first.projectId) || projectId };
}
async function vPoll(id, { token, projectId, mediaId }) {
  const { cdp } = await ensureLive(id);
  let url = DEFAULT_VIDEO.poll.url, body;
  try { body = JSON.parse(DEFAULT_VIDEO.poll.body); _vDeepSet(body, (k) => k === 'projectId', String(projectId)); (function w(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o.media)) o.media.forEach((m) => { if (m && typeof m === 'object') { if ('name' in m) m.name = mediaId; if ('mediaId' in m) m.mediaId = mediaId; } }); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') w(o[k]); })(body); } catch { body = { media: [{ name: mediaId, projectId: String(projectId) }] }; }
  const r = await apiFetch(cdp, { url, method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) return { error: extractApiError(d) || 'POLL_' + r.status };
  const first = d && Array.isArray(d.media) && d.media[0];
  const status = (first && first.mediaMetadata && first.mediaMetadata.mediaStatus && first.mediaMetadata.mediaStatus.mediaGenerationStatus) || '';
  const done = /SUCCESSFUL/i.test(status), failed = /FAIL|ERROR|REJECT|BLOCK/i.test(status);
  const vf = first && first.video; let videoUrl = null;
  if (vf && typeof vf === 'object') { videoUrl = vf.fifeUrl || vf.servingUri || vf.servingUrl || vf.url || vf.downloadUri || (vf.generatedVideo && (vf.generatedVideo.fifeUrl || vf.generatedVideo.servingUri || vf.generatedVideo.servingUrl || vf.generatedVideo.url)) || null; if (!videoUrl) { const u = _vAnyUrl(vf); if (u.length) videoUrl = u[u.length - 1]; } }
  if (!videoUrl) { const u = _vAnyUrl(d); if (u.length) videoUrl = u[u.length - 1]; }
  const credits = (d && typeof d.remainingCredits === 'number') ? d.remainingCredits : null;
  return { status, done, failed, credits, videoUrl };
}
// Táº£i video á»Ÿ tiáº¿n trÃ¬nh chÃ­nh (nÃ© CORS) â€” nhÆ° áº£nh.
async function fetchVideoData(id, url) {
  let cookieHeader = '';
  try { const rec = running.get(id); if (rec && rec.cdp) { const cks = await readCookies(rec.cdp); cookieHeader = (cks || []).filter((c) => /google/.test(c.domain || '')).map((c) => c.name + '=' + c.value).join('; '); } } catch {}
  return new Promise((resolve, reject) => {
    let done = false; const fin = (fn, v) => { if (!done) { done = true; fn(v); } };
    const req = net.request(url); if (cookieHeader) { try { req.setHeader('cookie', cookieHeader); } catch {} }
    req.on('response', (res) => { if (res.statusCode >= 400) { fin(reject, new Error('VID_HTTP_' + res.statusCode)); return; } const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => { const buf = Buffer.concat(chunks); let mime = res.headers['content-type'] || 'video/mp4'; if (Array.isArray(mime)) mime = mime[0]; fin(resolve, { b64: buf.toString('base64'), mime, size: buf.length }); }); res.on('error', (e) => fin(reject, new Error(e.message || 'VID_READ'))); });
    req.on('error', (e) => fin(reject, new Error(e.message || 'VID_FETCH_FAILED')));
    req.end();
  });
}
// Láº¥y link video: má»Ÿ trang project trong Chrome, phÃ¡t video, chá»™p URL /video/<id> (CDP Network) hoáº·c <video>.currentSrc.
let _vResolveChain = Promise.resolve();
function resolveVideo(id, opts) { const run = () => _resolveVideo(id, opts); const p = _vResolveChain.then(run, run); _vResolveChain = p.catch(() => {}); return p; }
async function _resolveVideo(id, { projectId, mediaId, withData }) {
  const { cdp } = await ensureLive(id);
  const rec = running.get(id); if (rec) rec.videoUrls = (rec.videoUrls || []).filter((r) => !r.url.includes(mediaId));
  const setWin = async (st) => { try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: st } }); } catch {} };
  // Tá»I Æ¯U: báº¯t THáº²NG response projectInitialData (chá»©a link video, cháº¡y báº±ng cookie phiÃªn) â†’ khá»i phÃ¡t video + cÃ o, giá»¯ cá»­a sá»• áº©N.
  let _piaUrl = null; const _piaReq = new Set();
  const _piaCatch = async (m) => {
    try {
      if (m.method === 'Network.responseReceived') { const u = m.params.response && m.params.response.url; if (u && /projectInitialData/i.test(u)) _piaReq.add(m.params.requestId); }
      else if (m.method === 'Network.loadingFinished' && _piaReq.has(m.params.requestId)) {
        _piaReq.delete(m.params.requestId);
        const b = await cdp.send('Network.getResponseBody', { requestId: m.params.requestId }).catch(() => null);
        if (b && b.body) {
          const raw = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : String(b.body);
          let d; try { d = JSON.parse(raw); } catch { d = null; }
          // 1) Khá»›p CHÃNH XÃC theo entry mediaId (Ä‘Ã¡ng tin nháº¥t â€” trÃ¡nh láº¥y nháº§m video cÅ© trong project).
          const exact = d ? _findVideoUrlForMedia(d, mediaId) : null;
          if (exact) { _piaUrl = exact; return; }
          // 2) KhÃ´ng cÃ³ mediaId â†’ má»›i Ä‘Æ°á»£c phÃ©p láº¥y video má»›i nháº¥t trong response.
          if (!mediaId) {
            const urls = d ? _vAnyUrl(d) : (raw.match(/https?:\\?\/\\?\/[^"'\\ ]+/g) || []).map((u) => u.replace(/\\\//g, '/'));
            const vids = urls.filter((u) => _VID_URL_RE.test(u));
            if (vids.length) _piaUrl = vids[vids.length - 1];
          }
          // CÃ³ mediaId nhÆ°ng chÆ°a khá»›p â†’ KHÃ”NG láº¥y bá»«a; Ä‘á»ƒ vÃ²ng láº·p chá»/response sau khá»›p Ä‘Ãºng.
        }
      }
    } catch {}
  };
  cdp.on(_piaCatch);
  await setWin('minimized');   // láº¥y link tá»« API â†’ khÃ´ng cáº§n bung cá»­a sá»•/phÃ¡t video
  try { await cdp.send('Page.navigate', { url: `${FLOW_URL}/project/${projectId}` }); } catch {}
  for (let i = 0; i < 24 && !_piaUrl; i++) await sleep(500);   // chá» projectInitialData tráº£ vá» (tá»‘i Ä‘a ~12s)
  if (!_piaUrl && mediaId) {   // chÆ°a khá»›p mediaId â†’ reload 1 láº§n (video vá»«a táº¡o cÃ³ thá»ƒ chÆ°a vÃ o projectInitialData) rá»“i thá»­ láº¡i khá»›p chÃ­nh xÃ¡c
    try { await cdp.send('Page.navigate', { url: `${FLOW_URL}/project/${projectId}?_r=1` }); } catch {}
    for (let i = 0; i < 20 && !_piaUrl; i++) await sleep(500);
  }
  let vurl = _piaUrl;
  // FALLBACK: API khÃ´ng ra link â†’ cÃ¡ch cÅ© (bung cá»­a sá»•, phÃ¡t video, cÃ o URL).
  if (!vurl) {
    await setWin('normal'); await sleep(3000);
    const grab = () => { const arr = (rec && rec.videoUrls) || []; const hit = arr.filter((r) => r.url && /\/video\//.test(r.url) && (!mediaId || r.url.includes(mediaId))); return hit.length ? hit[hit.length - 1].url : null; };
    for (let i = 0; i < 20; i++) {
      vurl = grab(); if (vurl) break;
      try {
        const s = await evalInPage(cdp, `(async()=>{const nap=ms=>new Promise(r=>setTimeout(r,ms));for(const v of document.querySelectorAll('video')){try{v.muted=true;v.preload='auto';const p=v.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}}const cards=Array.from(document.querySelectorAll('img,video,[role="button"]')).filter(el=>(el.clientWidth||0)>150).slice(0,6);for(const c of cards){try{['mouseover','mouseenter','pointerover'].forEach(ev=>c.dispatchEvent(new MouseEvent(ev,{bubbles:true})));}catch(e){}}await nap(400);for(const c of cards){try{c.click();}catch(e){}}await nap(600);for(const v of document.querySelectorAll('video')){try{v.muted=true;v.play&&v.play().catch(()=>{});}catch(e){}}await nap(500);const MID=${JSON.stringify(mediaId || '')};for(const v of document.querySelectorAll('video')){const u=v.currentSrc||v.src;if(u&&/^https?:/.test(u)&&(MID?(u.includes(MID)||/\\/video\\//.test(u)):/\\/video\\//.test(u)))return u;}return null;})()`);
        if (s) { vurl = s; break; }
      } catch {}
      vurl = grab(); if (vurl) break;
      await sleep(2200);
    }
    await setWin('minimized');
  } else { LOG('acc', id, 'láº¥y link video nhanh tá»« projectInitialData âœ“'); }
  if (!vurl) return { videoUrl: null };
  let vid = null;
  if (withData && !/^blob:/.test(vurl)) { try { vid = await fetchVideoData(id, vurl); } catch (e) { vid = { fetchError: e.message }; } }
  return { videoUrl: /^blob:/.test(vurl) ? null : vurl, video: vid };
}

// â”€â”€ UPSCALE VIDEO 1080p (há»c request 1 láº§n trÃªn Flow â†’ replay hÃ ng loáº¡t) â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Video 1080p/4K cá»§a Flow lÃ  bÆ°á»›c NÃ‚NG Äá»˜ PHÃ‚N GIáº¢I riÃªng (nhÆ° áº£nh 2K/4K). App há»c request khi
// user báº¥m Táº£i xuá»‘ng â†’ 1080p 1 láº§n, rá»“i tá»± replay cho cÃ¡c video khÃ¡c. Sáº¡ch: phiÃªn tháº­t, khÃ´ng giáº£ header.
const VUP_FILE = () => path.join(app.getPath('userData'), 'flow-video-upscale.json');
let vUpTpl = null;   // { url, body, at }
let _vUpArm = null;  // { id } Ä‘ang chá» user báº¥m 1080p
try { const _d = JSON.parse(fs.readFileSync(VUP_FILE(), 'utf8')); if (_d && _d.url) vUpTpl = _d; } catch {}
function _saveVUp() { try { fs.writeFileSync(VUP_FILE(), JSON.stringify(vUpTpl)); } catch {} }
// Nháº­n diá»‡n request NÃ‚NG Ä‘á»™ phÃ¢n giáº£i video (endpoint tÃªn chÆ°a biáº¿t cháº¯c â†’ xÃ©t cáº£ url láº«n body).
function _looksVUp(u, pd) {
  if (!u) return false;
  if (/(projectInitialData|auth\/session|recaptcha|batchCheckAsync|CheckAsyncVideoGenerationStatus)/i.test(u)) return false;   // loáº¡i poll/session/captcha
  if (/(upsampl|upscal|superres|super_res|enhanc|highres|increaseresolution|highResolution)/i.test(u)) return true;           // endpoint upscale rÃµ rÃ ng
  // dá»± phÃ²ng: body nháº¯c 1080/upscale mÃ  KHÃ”NG pháº£i submit gen 720p thÆ°á»ng
  if (pd && /(1080|UPSAMPLE|UPSCALE|SUPER_?RES|HIGH_?RES|ENHANCE|RECONSTRUCT)/i.test(pd) && !/VIDEO_RESOLUTION_720P/i.test(pd)) return true;
  return false;
}
function videoUpscaleStatus() { return { learned: !!vUpTpl, url: vUpTpl && vUpTpl.url, at: vUpTpl && vUpTpl.at }; }
function videoUpscaleDump() { return vUpTpl ? { url: vUpTpl.url, body: String(vUpTpl.body || '').slice(0, 4000), at: vUpTpl.at } : null; }
// Báº­t há»c: má»Ÿ CfT cá»§a account (hiá»‡n cá»­a sá»•), chá» user báº¥m 1080p â†’ CDP chá»™p POST request.
function _firstEnabledId() { return S.order.find((x) => { const a = accounts.get(x); return a && a.enabled !== false; }) || null; }
async function armVideoUpscale(id) {
  // id chá»‰ Ä‘á»‹nh â†’ dÃ¹ng náº¿u Ä‘ang Báº¬T; khÃ´ng thÃ¬ láº¥y tÃ i khoáº£n Báº¬T Ä‘áº§u tiÃªn (khÃ´ng má»Ÿ account Ä‘Ã£ táº¯t).
  let realId = (id != null && accounts.has(id) && accounts.get(id).enabled !== false) ? id : _firstEnabledId();
  if (!realId) return { error: 'ChÆ°a cÃ³ tÃ i khoáº£n nÃ o ÄANG Báº¬T. Báº­t 1 tÃ i khoáº£n trÆ°á»›c rá»“i thá»­ láº¡i.' };
  const { cdp } = await ensureLive(realId);
  try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); } catch {}
  try { await cdp.send('Page.navigate', { url: FLOW_URL }); } catch {}
  _vUpArm = { id: realId, at: Date.now() };
  const rec = running.get(realId);
  if (rec && rec.cdp && !rec._vUpHooked) {
    rec._vUpHooked = true;
    rec.cdp.on((m) => {
      try {
        if (!_vUpArm) return;
        if (m.method === 'Network.requestWillBeSent' && m.params.request && m.params.request.method === 'POST') {
          const u = m.params.request.url; const pd = m.params.request.postData;
          if (!u || !/googleapis\.com|labs\.google/i.test(u)) return;
          if (/(auth\/session|recaptcha|projectInitialData|batchCheckAsync)/i.test(u)) return;   // bá» nhiá»…u
          LOG('  [há»c 1080p] POST', u.replace(/\?.*$/, ''));   // ghi má»i request Ä‘á»ƒ soi náº¿u báº¯t há»¥t
          if (pd && _looksVUp(u, pd)) {
            vUpTpl = { url: u, body: pd, at: Date.now() }; _saveVUp(); _vUpArm = null;
            LOG('acc', realId, 'âœ” ÄÃƒ Há»ŒC upscale video:', u);
            LOG('  BODY:', String(pd).slice(0, 1500));
          }
        }
      } catch {}
    });
  }
  return { ok: true, note: 'ÄÃ£ má»Ÿ Chrome. Trong Flow, báº¥m â‹® (hoáº·c nÃºt Táº£i xuá»‘ng) â†’ chá»n 1080p trÃªn 1 video báº¥t ká»³. App sáº½ tá»± Há»ŒC vÃ  lÆ°u láº¡i.' };
}

// â”€â”€ Táº®T WATERMARK (nhÃ¬n tháº¥y) hÃ ng loáº¡t: há»c request Google gá»­i khi gáº¡t "Visible watermarking" â†’ phÃ¡t láº¡i cho má»i tÃ i khoáº£n.
// Chá»‰ táº¯t watermark HIá»‚N THá»Š (Google cho phÃ©p táº¯t sáºµn trong menu); SynthID áº©n cá»§a Google KHÃ”NG Ä‘á»¥ng tá»›i.
const WM_FILE = () => path.join(app.getPath('userData'), 'flow-watermark.json');
let wmTpl = null;   // { url, method, body, at }
let _wmArm = null;
try { const _d = JSON.parse(fs.readFileSync(WM_FILE(), 'utf8')); if (_d && _d.url) wmTpl = _d; } catch {}
function _saveWM() { try { fs.writeFileSync(WM_FILE(), JSON.stringify(wmTpl)); } catch {} }
function _looksWM(u, pd) {
  const url = u || ''; const s = url + ' ' + (pd || '');
  if (/(auth\/session|recaptcha|projectInitialData|batchCheckAsync|GenerateVideo|GenerateImage|AsyncGenerate)/i.test(url)) return false;   // loáº¡i gen/poll/session/captcha
  return /(watermark|synth ?id|visible.?mark|imagewatermark|mediawatermark|showwatermark|disablewatermark|mark_?visib)/i.test(s);
}
// Endpoint táº¯t/báº­t watermark hiá»ƒn thá»‹ Ä‘Ã£ xÃ¡c Ä‘á»‹nh (KHÃ”NG phá»¥ thuá»™c tÃ i khoáº£n â€” chá»‰ 1 cá», account theo phiÃªn).
const WM_URL = 'https://aisandbox-pa.googleapis.com/v1/flow/userSettings';
function _wmBody(enabled) { return JSON.stringify({ userSettings: { isWatermarkEnabledByUser: !!enabled }, updateMask: 'isWatermarkEnabledByUser' }); }
function watermarkStatus() { return { learned: true, url: WM_URL, at: (wmTpl && wmTpl.at) || null }; }   // luÃ´n sáºµn (bake sáºµn request), khÃ¡ch khá»i há»c
function watermarkDump() { return wmTpl ? { url: wmTpl.url, method: wmTpl.method, body: String(wmTpl.body || '').slice(0, 3000), at: wmTpl.at } : null; }
async function armWatermarkLearn(id) {
  let realId = (id != null && accounts.has(id) && accounts.get(id).enabled !== false) ? id : _firstEnabledId();
  if (!realId) return { error: 'ChÆ°a cÃ³ tÃ i khoáº£n nÃ o ÄANG Báº¬T. Báº­t 1 tÃ i khoáº£n rá»“i thá»­ láº¡i.' };
  const { cdp } = await ensureLive(realId);
  try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); } catch {}
  try { await cdp.send('Page.navigate', { url: FLOW_URL }); } catch {}
  _wmArm = { id: realId, at: Date.now() };
  const rec = running.get(realId);
  if (rec && rec.cdp && !rec._wmHooked) {
    rec._wmHooked = true;
    rec.cdp.on((m) => {
      try {
        if (!_wmArm) return;
        if (m.method === 'Network.requestWillBeSent' && m.params.request && /^(POST|PUT|PATCH)$/i.test(m.params.request.method || '')) {
          const u = m.params.request.url; const pd = m.params.request.postData;
          if (!u || !/googleapis\.com|labs\.google/i.test(u)) return;
          if (/(auth\/session|recaptcha|projectInitialData|batchCheckAsync)/i.test(u)) return;
          LOG('  [há»c watermark] ' + m.params.request.method + ' ' + u.replace(/\?.*$/, ''));   // ghi má»i request Ä‘á»ƒ soi náº¿u báº¯t há»¥t
          if (_looksWM(u, pd)) {
            wmTpl = { url: u, method: m.params.request.method, body: pd || '', at: Date.now() }; _saveWM(); _wmArm = null;
            LOG('acc', realId, 'âœ” ÄÃƒ Há»ŒC táº¯t watermark:', u);
            LOG('  BODY:', String(pd || '').slice(0, 1200));
          }
        }
      } catch {}
    });
  }
  return { ok: true, id: realId, note: 'ÄÃ£ má»Ÿ Chrome. Báº¥m avatar (gÃ³c pháº£i Flow) â†’ gáº¡t "Visible watermarking" sang ÄANG Táº®T. App sáº½ tá»± Há»ŒC (chá»‰ cáº§n lÃ m 1 láº§n).' };
}
async function applyWatermarkOne(id, off) {
  const live = await ensureLive(id);   // má»Ÿ phiÃªn RIÃŠNG cá»§a account â†’ request Ã¡p Ä‘Ãºng account Ä‘Ã³
  const r = await apiFetch(live.cdp, { url: WM_URL, method: 'PATCH', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + live.token }, body: _wmBody(off === false) });   // off (máº·c Ä‘á»‹nh) â†’ isWatermarkEnabledByUser=false
  if (id !== S._captchaId) { try { await closeChrome(id); } catch {} }   // Ä‘Ã³ng láº¡i cho gá»n (giá»¯ mÃ¡y captcha)
  return { ok: !!(r && r.ok), status: r && r.status };
}
async function applyWatermarkAll() {
  const ids = S.order.filter((x) => { const a = accounts.get(x); return a && a.enabled !== false; });
  if (!ids.length) return { error: 'ChÆ°a cÃ³ tÃ i khoáº£n nÃ o Ä‘ang báº­t.' };
  const out = [];
  for (const id of ids) {
    try { const r = await applyWatermarkOne(id); out.push({ id, ok: r.ok, status: r.status }); LOG('acc', id, r.ok ? 'âœ” Ä‘Ã£ táº¯t watermark hiá»ƒn thá»‹' : ('âš ï¸ táº¯t watermark tráº£ HTTP ' + (r.status || '?'))); }
    catch (e) { out.push({ id, ok: false, error: e && e.message }); LOG('acc', id, 'âŒ táº¯t watermark lá»—i:', e && e.message); }
  }
  return { ok: true, results: out, done: out.filter((x) => x.ok).length, total: ids.length };
}
function _uuid() { try { return require('crypto').randomUUID(); } catch { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(Math.random() * 16); const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); }); } }
// Replay upscale 1080p cho 1 video (endpoint Ä‘Ã£ há»c: video:batchAsyncGenerateVideoUpsampleVideo).
// Body: requests[0].videoInput.mediaId = video nguá»“n, clientContext.projectId, recaptchaContext.token.
async function upsampleVideo(id, { mediaId, projectId, aspect, withData }) {
  if (!vUpTpl) return { error: 'CHÆ¯A_Há»ŒC_UPSCALE' };
  const { cdp, token } = await ensureLive(id);
  let capToken = ''; try { capToken = await pageEval(id, captchaCode('VIDEO_GENERATION')); } catch {}   // mint qua máy captcha — xem genTest
  if (!capToken) return { error: 'CAPTCHA_EMPTY' };
  let body; try { body = JSON.parse(vUpTpl.body); } catch { return { error: 'TPL_BODY_BAD' }; }
  // Äiá»n Ä‘Ãºng cáº¥u trÃºc Ä‘Ã£ há»c.
  if (body.clientContext) { body.clientContext.projectId = String(projectId); if (body.clientContext.recaptchaContext) body.clientContext.recaptchaContext.token = capToken; }
  else { _vDeepSet(body, (k) => k === 'projectId', String(projectId)); _vDeepSet(body, (k) => k === 'token', capToken); }
  if (body.mediaGenerationContext) body.mediaGenerationContext.batchId = _uuid();
  const reqs = Array.isArray(body.requests) ? body.requests : [];
  for (const rq of reqs) {
    if (rq && typeof rq === 'object') {
      if (rq.videoInput && typeof rq.videoInput === 'object') rq.videoInput.mediaId = String(mediaId); else rq.videoInput = { mediaId: String(mediaId) };
      if (aspect) rq.aspectRatio = aspect;
      if (rq.metadata && typeof rq.metadata === 'object') rq.metadata.workflowId = _uuid();
    }
  }
  if (!reqs.length) _vDeepSet(body, (k) => k === 'mediaId', String(mediaId));   // dá»± phÃ²ng náº¿u cáº¥u trÃºc khÃ¡c
  const r = await apiFetch(cdp, { url: vUpTpl.url, method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) return { error: extractApiError(d) || ('UPSCALE_HTTP_' + r.status) };
  const ie = extractApiError(d); if (ie) return { error: ie };
  const first = d && Array.isArray(d.media) && d.media[0]; const opName = (first && first.name) || (d && d.name) || null;
  if (!opName) return { error: 'NO_UPSCALE_MEDIA_ID' };
  // Poll nhÆ° video thÆ°á»ng tá»›i khi báº£n 1080p xong â†’ láº¥y link. (nÃ¢ng 1080p hay ~5-6 phÃºt â†’ chá» tá»›i 8 phÃºt)
  let vurl = null; const started = Date.now();
  while (Date.now() - started < 480000) {
    await sleep(5000);
    const p = await vPoll(id, { token, projectId, mediaId: opName });
    if (p.failed) return { error: 'UPSCALE_FAIL' };
    if (p.done && p.videoUrl) { vurl = p.videoUrl; break; }
    if (p.videoUrl) { vurl = p.videoUrl; break; }
  }
  if (!vurl) { const rv = await resolveVideo(id, { projectId, mediaId: opName, withData: false }); vurl = rv.videoUrl; }
  if (!vurl) return { error: 'NO_UPSCALE_URL' };
  let vid = null;
  if (withData !== false && !/^blob:/.test(vurl)) { try { vid = await fetchVideoData(id, vurl); } catch (e) { vid = { fetchError: e.message }; } }
  return { mediaId: opName || mediaId, videoUrl: vurl, video: vid };
}

// Táº¡o 1 video trÃªn 1 account Chrome (mirror runVideoOnToken cá»§a extension). Tráº£ {ok,...}|{error}.
async function genVideo(id, params) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  let token; try { token = (await ensureLive(id)).token; } catch (e) { return { error: 'Má»Ÿ Chrome lá»—i: ' + (e.message || e) }; }
  let projectId; try { projectId = await vEnsureProject(id, token); } catch (e) { return { error: e.message || 'NO_PROJECT' }; }
  let imageMediaId = null;
  if (params.image && params.image.base64) {
    const up = await vUploadImage(id, token, projectId, { base64: params.image.base64, mime: params.image.mime || 'image/png', fileName: (params.sceneId || 'frame') + '.png' });
    if (up.error) return { error: 'UPLOAD: ' + up.error };
    imageMediaId = up.media_id;
  }
  const sub = await vSubmit(id, { token, prompt: params.prompt, projectId, imageMediaId, modelKey: params.modelKey || params.modelName, durationSecs: params.durationSecs });
  if (sub.error) return { error: sub.error };
  const started = Date.now(); let videoUrl = null, credits = null, done = false;
  while (Date.now() - started < 360000) {
    await sleep(6000);
    const p = await vPoll(id, { token, projectId: sub.projectId, mediaId: sub.mediaId });
    if (p.credits != null){ credits = p.credits; const _a = accounts.get(id); if (_a && _a.credits !== credits){ _a.credits = credits; persist(); } }   // ghi ngÆ°á»£c tÃ­n dá»¥ng má»›i nháº¥t vÃ o account â†’ báº£ng hiá»‡n sá»‘ tháº­t, khá»i báº¥m â†»
    if (p.error) return { error: p.error, mediaId: sub.mediaId };
    if (p.failed) return { error: 'Flow bÃ¡o táº¡o video THáº¤T Báº I (' + (p.status || '?') + ')', mediaId: sub.mediaId };
    if (p.done) { videoUrl = p.videoUrl; done = true; break; }
  }
  if (!done) return { error: 'TIMEOUT chá» video', mediaId: sub.mediaId };
  let vid = null;
  // Poll tráº£ link theo ÄÃšNG mediaId â†’ táº£i bytes THáº²NG tá»« Ä‘Ã³ (trÃ¡nh cÃ o projectInitialData láº¥y nháº§m video cÅ© trong project).
  if (videoUrl && !/^blob:/.test(videoUrl) && params.withData) {
    try { vid = await fetchVideoData(id, videoUrl); } catch (e) { vid = null; }
  }
  // ChÆ°a cÃ³ link, hoáº·c táº£i tháº³ng lá»—i â†’ resolve qua projectInitialData (Ä‘Ã£ khá»›p mediaId chÃ­nh xÃ¡c trong JSON).
  if (!videoUrl || (params.withData && (!vid || vid.fetchError))) {
    const rv = await resolveVideo(id, { projectId: sub.projectId, mediaId: sub.mediaId, withData: params.withData });
    if (!videoUrl) videoUrl = rv.videoUrl;
    if (!vid || vid.fetchError) vid = rv.video || vid;
  }
  // NÃ‚NG 1080p (tuá»³ chá»n) â€” video gá»‘c lÃ  720p; náº¿u user chá»n 1080p vÃ  Ä‘Ã£ há»c request thÃ¬ nÃ¢ng Ä‘á»™ phÃ¢n giáº£i.
  let resolution = '720p';
  if (/1080/.test(String(params.resolution || ''))) {
    if (!vUpTpl) { LOG('acc', id, 'âš ï¸ chÆ°a há»c nÃ¢ng 1080p â€” giá»¯ 720p (vÃ o Táº¡o Video â†’ "Há»c nÃ¢ng 1080p")'); }
    else {
      LOG('acc', id, 'â¬† nÃ¢ng 1080pâ€¦');
      try {
        const up = await upsampleVideo(id, { mediaId: sub.mediaId, projectId: sub.projectId, aspect: params.aspect, withData: params.withData });
        if (up && !up.error && (up.videoUrl || up.video?.b64)) { videoUrl = up.videoUrl || videoUrl; if (up.video) vid = up.video; resolution = '1080p'; LOG('acc', id, 'âœ” Ä‘Ã£ nÃ¢ng 1080p'); }
        else { LOG('acc', id, 'âš ï¸ nÃ¢ng 1080p lá»—i (' + ((up && up.error) || '?') + ') â€” giá»¯ 720p'); }
      } catch (e) { LOG('acc', id, 'âš ï¸ nÃ¢ng 1080p lá»—i: ' + (e.message || e) + ' â€” giá»¯ 720p'); }
    }
  }
  return { ok: true, mediaId: sub.mediaId, projectId: sub.projectId, videoUrl, video: vid, credits, resolution };
}

// Extension mode: video gen á»Ÿ extension nhÆ°ng KHÃ”NG táº£i Ä‘Æ°á»£c file (phiÃªn trÃ¬nh duyá»‡t â‰  chá»§ project).
// â†’ App resolve giÃºp: má»Ÿ Chrome for Testing cá»§a CHÃNH tÃ i khoáº£n Ä‘Ã³ (Ä‘Ãºng phiÃªn) Ä‘á»ƒ láº¥y link + táº£i file.
async function resolveVideoForApp({ email, projectId, mediaId, resolution, aspect, withData }) {
  let id = null;
  for (const aid of S.order) { const a = accounts.get(aid); if (a && a.email && email && a.email.toLowerCase() === String(email).toLowerCase()) { id = aid; break; } }
  if (id == null) return { error: 'KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n CfT khá»›p email ' + email + ' Ä‘á»ƒ resolve video.' };
  try {
    // Chá»n 1080p (cháº¿ Ä‘á»™ Extension) â†’ NÃ‚NG trÆ°á»›c khi táº£i (náº¿u Ä‘Ã£ há»c request).
    if (/1080/.test(String(resolution || ''))) {
      if (!vUpTpl) LOG('acc', id, 'âš ï¸ chÆ°a há»c nÃ¢ng 1080p â€” giá»¯ 720p');
      else {
        LOG('acc', id, 'â¬† nÃ¢ng 1080pâ€¦');
        const up = await upsampleVideo(id, { mediaId, projectId, aspect, withData: withData !== false });
        if (up && !up.error && (up.videoUrl || up.video?.b64)) { LOG('acc', id, 'âœ” Ä‘Ã£ nÃ¢ng 1080p'); return { ok: true, videoUrl: up.videoUrl || null, video: up.video || null, resolution: '1080p' }; }
        LOG('acc', id, 'âš ï¸ nÃ¢ng 1080p lá»—i (' + ((up && up.error) || '?') + ') â€” giá»¯ 720p');
      }
    }
    const rv = await resolveVideo(id, { projectId, mediaId, withData: withData !== false });
    return { ok: true, videoUrl: rv.videoUrl || null, video: rv.video || null, resolution: '720p' };
  } catch (e) { return { error: 'RESOLVE lá»—i: ' + (e.message || e) }; }
}

// Gom token TÆ¯Æ I cá»§a táº¥t cáº£ account (má»Ÿ Chrome tá»«ng cÃ¡i 1 nhá»‹p) â†’ Ä‘á»ƒ bÆ¡m sang extension.
async function getAllTokens(force) {
  if (S._busy) { LOG('bá» qua lÃ m má»›i token: Ä‘ang báº­n thao tÃ¡c khÃ¡c'); return []; }   // khÃ´ng xen vÃ o Ä‘Äƒng nháº­p láº¡i
  S._busy = true;
  try {
    const out = [];
    for (const id of S.order) {
      const a = accounts.get(id);
      if (!a || a.enabled === false) continue;
      if (force) S.tokens.delete(id);   // Ã©p mint token Má»šI
      // Token cache CÃ’N Háº N THáº¬T (24h) + Ä‘Ã£ cÃ³ project + email â†’ DÃ™NG Láº I, KHá»ŽI má»Ÿ Chrome (chuyá»ƒn cháº¿ Ä‘á»™/refresh khÃ´ng má»Ÿ Chrome vÃ´ Ã­ch).
      const tk = S.tokens.get(id);
      if (!force && tk && tk.token && tk.expiry && Date.now() < tk.expiry - 5 * 60 * 1000 && a.projectId) {   // bá» yÃªu cáº§u email (Windows hay null) â†’ cache váº«n dÃ¹ng láº¡i Ä‘Æ°á»£c
        a.needLogin = false;
        out.push({ email: a.email, token: tk.token, project_id: a.projectId, tier: a.tier || null, credits: a.credits ?? null });
        LOG('acc', id, 'dÃ¹ng token cache (cÃ²n háº¡n) â€” khá»i má»Ÿ Chrome');
        continue;
      }
      try {
        const d = await getAccountData(id);
        if (d.token) { a.needLogin = false; out.push({ email: a.email || ('Chrome ' + id), token: d.token, project_id: d.projectId || null, tier: a.tier || null, credits: a.credits ?? null }); }
        LOG('cho extension: acc', id, d.token ? 'token OK' : 'rá»—ng', 'proj', d.projectId || '-');
      } catch (e) {
        a.needLogin = true;   // profile khÃ´ng ra token â†’ cáº§n Ä‘Äƒng nháº­p láº¡i (thÆ°á»ng do Ä‘á»•i trÃ¬nh duyá»‡t)
        LOG('âš ï¸ acc', id, (a.email || '') + ': chÆ°a Ä‘Äƒng nháº­p báº±ng Chrome for Testing â€” báº¥m "ÄÄƒng nháº­p láº¡i" cho tÃ i khoáº£n nÃ y (1 láº§n).');
      }
    }
    return out;
  } finally { S._busy = false; }
}

// â”€â”€ (hoÃ¡n vá»‹ tá»« flow-chrome.js gá»‘c dÃ²ng 683â€“709 â€” háº¡ gá»£i chu trÃ¬nh require) â”€â”€
async function getAccountData(id) {
  if (!accounts.has(id)) throw new Error('NO_ACC');
  const a = accounts.get(id);
  const live = await ensureLive(id);   // Chrome cá»§a CHÃNH account id â†’ phiÃªn riÃªng cá»§a nÃ³
  const token = live.token;
  // Láº¥y EMAIL tá»« session endpoint (tráº£ user.email) Ä‘á»ƒ hiá»‡n tÃªn account tháº­t thay "Chrome N".
  if (a && !a.email) {
    try {
      const em = await evalInPageT(live.cdp, `(async()=>{try{const c=new AbortController();const t=setTimeout(()=>c.abort(),6000);const r=await fetch('https://labs.google/fx/api/auth/session',{credentials:'include',signal:c.signal});clearTimeout(t);const d=await r.json();return (d&&d.user&&d.user.email)||null;}catch(e){return null;}})()`, 9000);
      if (em) { a.email = em; persist(); LOG('acc', id, 'email', em); }
    } catch {}
  }
  let projectId = a && a.projectId;
  if (!projectId && token) {
    try {
      const pr = await apiFetch(live.cdp, { url: TRPC_CREATE_PROJECT, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify({ json: { projectTitle: 'Nova pool', toolName: 'PINHOLE' } }) });
      let pd; try { pd = JSON.parse(pr.text); } catch { pd = null; }
      projectId = pd ? deepFindProjectId(pd) : null;
      if (projectId && a) { a.projectId = projectId; persist(); LOG('acc', id, 'project riÃªng', projectId); }
      else LOG('acc', id, 'táº¡o project lá»—i:', String(pr.text).slice(0, 120));
    } catch (e) { LOG('acc', id, 'createProject lá»—i', e && e.message); }
  }
  S.tokens.set(id, { token, at: Date.now(), expiry: S._lastTokenExpiry });
  persist();   // lÆ°u token + háº¡n xuá»‘ng Ä‘Ä©a â†’ táº¯t/má»Ÿ app cÃ²n háº¡n thÃ¬ xÃ i láº¡i, khá»i má»Ÿ Chrome
  try { await closeChrome(id); } catch {}   // láº¥y xong ÄÃ“NG Háº²N â€” khÃ´ng giá»¯ cá»­a sá»• nÃ o (gen cháº¡y á»Ÿ extension)
  return { token, projectId };
}
module.exports = { TRPC_CREATE_PROJECT, SITE_KEY, genImageUrl, cryptoRandomUUID, deepFindProjectId, extractApiError, extractApiError, extractMediaEntries, buildImageBody, captchaCode, genTest, UPLOAD_IMAGE_URL, DEFAULT_VIDEO, vEnsureProject, vUploadImage, vSubmit, vPoll, fetchVideoData, resolveVideo, VUP_FILE, vUpTpl, videoUpscaleStatus, videoUpscaleDump, armVideoUpscale, WM_FILE, wmTpl, WM_URL, watermarkStatus, watermarkDump, armWatermarkLearn, applyWatermarkOne, applyWatermarkAll, upsampleVideo, genVideo, resolveVideoForApp, getAllTokens, getAccountData };

