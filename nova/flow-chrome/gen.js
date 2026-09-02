/* ── Tách từ flow-chrome.js — gen ảnh (test) + pipeline video học request + upscale + watermark + genVideo + getAllTokens (getAccountData chuyển từ 683–709 cuối file — hạ gợi chu trình với các hằng).
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { FLOW_API_BASE, accounts, LOG, evalInPage, FLOW_URL, sleep, evalInPageT, persist } = require('./nen-tang');
const { ensureLive } = require('./token-captcha');
const { closeChrome, apiFetch, running, readCookies } = require('./tien-trinh');

// ── Hàm thuần (copy từ flow-native để test độc lập, không đụng engine cũ) ──
const TRPC_CREATE_PROJECT = 'https://labs.google/fx/api/trpc/project.createProject';
const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
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
    await new Promise(function(res){ try{ window.grecaptcha.enterprise.ready(res); }catch(e){ res(); } });   // chờ grecaptcha init xong
    return await Promise.race([
      window.grecaptcha.enterprise.execute(key,{action:${JSON.stringify(action)}}),
      new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('CAPTCHA_TIMEOUT')); }, 25000); })   // chống treo vô hạn
    ]);
  })()`;
}

// Test tạo 1 ảnh trên 1 account Chrome (chứng minh gen qua CDP chạy).
async function genTest(id, prompt, tokenId) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  let live; try { live = await ensureLive(id); } catch (e) { return { error: 'Mở Chrome lỗi: ' + (e.message || e) }; }
  const { cdp } = live; let token = live.token; let a = accounts.get(id);
  // TEST token-only: dùng Chrome của account `id` (chỉ để giải captcha) + TOKEN của account `tokenId`.
  if (tokenId && tokenId !== id && accounts.has(tokenId)) {
    try { const t2 = await ensureLive(tokenId); token = t2.token; await closeChrome(tokenId); a = accounts.get(tokenId); LOG('TEST token-only: Chrome acc', id, '+ token acc', tokenId); }
    catch (e) { return { error: 'Lấy token acc ' + tokenId + ' lỗi: ' + (e.message || e) }; }
  }
  try {
    LOG('acc', id, 'genTest: tạo project…');
    const pr = await apiFetch(cdp, { url: TRPC_CREATE_PROJECT, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify({ json: { projectTitle: 'Nova Chrome', toolName: 'PINHOLE' } }) });
    let pd; try { pd = JSON.parse(pr.text); } catch { pd = pr.text; }
    if (!pr.ok) return { error: 'PROJECT_' + pr.status + ': ' + (extractApiError(pd) || String(pr.text).slice(0, 150)) };
    const projectId = deepFindProjectId(pd);
    if (!projectId) return { error: 'NO_PROJECT_ID' };
    LOG('acc', id, 'genTest: giải captcha…');
    let capToken; try { capToken = await evalInPage(cdp, captchaCode('IMAGE_GENERATION')); } catch (e) { return { error: 'CAPTCHA: ' + (e.message || e) }; }
    if (!capToken) return { error: 'CAPTCHA_EMPTY' };
    const body = buildImageBody({ prompt, projectId, aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE', modelName: 'GEM_PIX_2', tier: a.tier || null, variantCount: 1 });
    body.clientContext.recaptchaContext.token = capToken;
    for (const rq of body.requests) { if (rq.clientContext && rq.clientContext.recaptchaContext) rq.clientContext.recaptchaContext.token = capToken; }
    LOG('acc', id, 'genTest: gọi batchGenerateImages…');
    const gr = await apiFetch(cdp, { url: genImageUrl(projectId), method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    let gd; try { gd = JSON.parse(gr.text); } catch { gd = gr.text; }
    if (!gr.ok) return { error: 'GEN_' + gr.status + ': ' + (extractApiError(gd) || String(gr.text).slice(0, 150)) };
    const entries = extractMediaEntries(gd);
    if (!entries.length) LOG('acc', id, 'genTest 0 ảnh — Flow trả:', String(gr.text).slice(0, 500));
    LOG('acc', id, 'genTest → ✓', entries.length, 'ảnh; url0', entries[0] && String(entries[0].url).slice(0, 60));
    return { ok: entries.length > 0, count: entries.length, url: entries[0] && entries[0].url, raw: entries.length ? undefined : String(gr.text).slice(0, 300) };
  } catch (e) { return { error: 'genTest lỗi: ' + (e.message || e) }; }
}

// ═══════════ VIDEO — công thức bê từ extension (đã "học" request thật) ═══════════
const UPLOAD_IMAGE_URL = `${FLOW_API_BASE}/v1/flow/uploadImage`;
const DEFAULT_VIDEO = { "genText": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_t2v\",\"seed\":0,\"metadata\":{}}],\"useV2ModelConfig\":true}" }, "genImage": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_r2v_lite\",\"seed\":0,\"metadata\":{},\"referenceImages\":[{\"mediaId\":\"\",\"imageUsageType\":\"IMAGE_USAGE_TYPE_ASSET\"}]}],\"useV2ModelConfig\":true}" }, "poll": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus", "body": "{\"media\":[{\"name\":\"\",\"projectId\":\"\"}]}" }, "modelKeys": { "omni-flash": "abra_t2v_8s", "veo31-fast": "veo_3_1_t2v_fast", "veo31-lite": "veo_3_1_t2v_lite", "veo31-quality": "veo_3_1_t2v" } };
function _vDeepSet(o, pred, val) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (pred(k)) o[k] = val; else if (o[k] && typeof o[k] === 'object') _vDeepSet(o[k], pred, val); } }
function _vDeepSet2(o, pred, fn) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (pred(k)) o[k] = fn(o[k]); else if (o[k] && typeof o[k] === 'object') _vDeepSet2(o[k], pred, fn); } }
function _vSetPrompt(o, prompt) { (function w(x) { if (!x || typeof x !== 'object') return; if (x.structuredPrompt && Array.isArray(x.structuredPrompt.parts)) x.structuredPrompt.parts.forEach((p) => { if (p && 'text' in p) p.text = prompt; }); for (const k of Object.keys(x)) if (x[k] && typeof x[k] === 'object') w(x[k]); })(o); }
function _vAnyUrl(data) { const out = []; (function w(v) { if (!v) return; if (typeof v === 'string') { if (/^https?:\/\/\S{8,}/.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach(w); else if (typeof v === 'object') for (const k in v) w(v[k]); })(data); return out; }
const _VID_URL_RE = /(flow-content\.google|\/video\/|videoplayback|\.mp4)/i;
// Tìm ĐÚNG link video của mediaId trong cây JSON projectInitialData.
// URL phục vụ (fife/serving) KHÔNG chứa mediaId, nên phải khớp theo ENTRY (name===mediaId) rồi lấy URL trong entry đó.
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
  if (modelKey) { const wantType = imageMediaId ? 'r2v' : 't2v'; const typed = _vResolveModelKey(modelKey).replace(/(^|_)(t2v|r2v|i2v)(?=_|$)/, '$1' + wantType); _vDeepSet(body, (k) => k === 'videoModelKey', typed); }
  if (durationSecs) _vDeepSet2(body, (k) => k === 'videoModelKey', (cur) => (typeof cur === 'string' ? cur.replace(/_(\d+)s\b/, '_' + durationSecs + 's') : cur));
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
  let capToken; try { capToken = await evalInPage(cdp, captchaCode('VIDEO_GENERATION')); } catch (e) { return { error: 'CAPTCHA: ' + (e.message || e) }; }
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
// Tải video ở tiến trình chính (né CORS) — như ảnh.
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
// Lấy link video: mở trang project trong Chrome, phát video, chộp URL /video/<id> (CDP Network) hoặc <video>.currentSrc.
let _vResolveChain = Promise.resolve();
function resolveVideo(id, opts) { const run = () => _resolveVideo(id, opts); const p = _vResolveChain.then(run, run); _vResolveChain = p.catch(() => {}); return p; }
async function _resolveVideo(id, { projectId, mediaId, withData }) {
  const { cdp } = await ensureLive(id);
  const rec = running.get(id); if (rec) rec.videoUrls = (rec.videoUrls || []).filter((r) => !r.url.includes(mediaId));
  const setWin = async (st) => { try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: st } }); } catch {} };
  // TỐI ƯU: bắt THẲNG response projectInitialData (chứa link video, chạy bằng cookie phiên) → khỏi phát video + cào, giữ cửa sổ ẩN.
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
          // 1) Khớp CHÍNH XÁC theo entry mediaId (đáng tin nhất — tránh lấy nhầm video cũ trong project).
          const exact = d ? _findVideoUrlForMedia(d, mediaId) : null;
          if (exact) { _piaUrl = exact; return; }
          // 2) Không có mediaId → mới được phép lấy video mới nhất trong response.
          if (!mediaId) {
            const urls = d ? _vAnyUrl(d) : (raw.match(/https?:\\?\/\\?\/[^"'\\ ]+/g) || []).map((u) => u.replace(/\\\//g, '/'));
            const vids = urls.filter((u) => _VID_URL_RE.test(u));
            if (vids.length) _piaUrl = vids[vids.length - 1];
          }
          // Có mediaId nhưng chưa khớp → KHÔNG lấy bừa; để vòng lặp chờ/response sau khớp đúng.
        }
      }
    } catch {}
  };
  cdp.on(_piaCatch);
  await setWin('minimized');   // lấy link từ API → không cần bung cửa sổ/phát video
  try { await cdp.send('Page.navigate', { url: `${FLOW_URL}/project/${projectId}` }); } catch {}
  for (let i = 0; i < 24 && !_piaUrl; i++) await sleep(500);   // chờ projectInitialData trả về (tối đa ~12s)
  if (!_piaUrl && mediaId) {   // chưa khớp mediaId → reload 1 lần (video vừa tạo có thể chưa vào projectInitialData) rồi thử lại khớp chính xác
    try { await cdp.send('Page.navigate', { url: `${FLOW_URL}/project/${projectId}?_r=1` }); } catch {}
    for (let i = 0; i < 20 && !_piaUrl; i++) await sleep(500);
  }
  let vurl = _piaUrl;
  // FALLBACK: API không ra link → cách cũ (bung cửa sổ, phát video, cào URL).
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
  } else { LOG('acc', id, 'lấy link video nhanh từ projectInitialData ✓'); }
  if (!vurl) return { videoUrl: null };
  let vid = null;
  if (withData && !/^blob:/.test(vurl)) { try { vid = await fetchVideoData(id, vurl); } catch (e) { vid = { fetchError: e.message }; } }
  return { videoUrl: /^blob:/.test(vurl) ? null : vurl, video: vid };
}

// ── UPSCALE VIDEO 1080p (học request 1 lần trên Flow → replay hàng loạt) ─────────
// Video 1080p/4K của Flow là bước NÂNG ĐỘ PHÂN GIẢI riêng (như ảnh 2K/4K). App học request khi
// user bấm Tải xuống → 1080p 1 lần, rồi tự replay cho các video khác. Sạch: phiên thật, không giả header.
const VUP_FILE = () => path.join(app.getPath('userData'), 'flow-video-upscale.json');
let vUpTpl = null;   // { url, body, at }
let _vUpArm = null;  // { id } đang chờ user bấm 1080p
try { const _d = JSON.parse(fs.readFileSync(VUP_FILE(), 'utf8')); if (_d && _d.url) vUpTpl = _d; } catch {}
function _saveVUp() { try { fs.writeFileSync(VUP_FILE(), JSON.stringify(vUpTpl)); } catch {} }
// Nhận diện request NÂNG độ phân giải video (endpoint tên chưa biết chắc → xét cả url lẫn body).
function _looksVUp(u, pd) {
  if (!u) return false;
  if (/(projectInitialData|auth\/session|recaptcha|batchCheckAsync|CheckAsyncVideoGenerationStatus)/i.test(u)) return false;   // loại poll/session/captcha
  if (/(upsampl|upscal|superres|super_res|enhanc|highres|increaseresolution|highResolution)/i.test(u)) return true;           // endpoint upscale rõ ràng
  // dự phòng: body nhắc 1080/upscale mà KHÔNG phải submit gen 720p thường
  if (pd && /(1080|UPSAMPLE|UPSCALE|SUPER_?RES|HIGH_?RES|ENHANCE|RECONSTRUCT)/i.test(pd) && !/VIDEO_RESOLUTION_720P/i.test(pd)) return true;
  return false;
}
function videoUpscaleStatus() { return { learned: !!vUpTpl, url: vUpTpl && vUpTpl.url, at: vUpTpl && vUpTpl.at }; }
function videoUpscaleDump() { return vUpTpl ? { url: vUpTpl.url, body: String(vUpTpl.body || '').slice(0, 4000), at: vUpTpl.at } : null; }
// Bật học: mở CfT của account (hiện cửa sổ), chờ user bấm 1080p → CDP chộp POST request.
function _firstEnabledId() { return S.order.find((x) => { const a = accounts.get(x); return a && a.enabled !== false; }) || null; }
async function armVideoUpscale(id) {
  // id chỉ định → dùng nếu đang BẬT; không thì lấy tài khoản BẬT đầu tiên (không mở account đã tắt).
  let realId = (id != null && accounts.has(id) && accounts.get(id).enabled !== false) ? id : _firstEnabledId();
  if (!realId) return { error: 'Chưa có tài khoản nào ĐANG BẬT. Bật 1 tài khoản trước rồi thử lại.' };
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
          if (/(auth\/session|recaptcha|projectInitialData|batchCheckAsync)/i.test(u)) return;   // bỏ nhiễu
          LOG('  [học 1080p] POST', u.replace(/\?.*$/, ''));   // ghi mọi request để soi nếu bắt hụt
          if (pd && _looksVUp(u, pd)) {
            vUpTpl = { url: u, body: pd, at: Date.now() }; _saveVUp(); _vUpArm = null;
            LOG('acc', realId, '✔ ĐÃ HỌC upscale video:', u);
            LOG('  BODY:', String(pd).slice(0, 1500));
          }
        }
      } catch {}
    });
  }
  return { ok: true, note: 'Đã mở Chrome. Trong Flow, bấm ⋮ (hoặc nút Tải xuống) → chọn 1080p trên 1 video bất kỳ. App sẽ tự HỌC và lưu lại.' };
}

// ── TẮT WATERMARK (nhìn thấy) hàng loạt: học request Google gửi khi gạt "Visible watermarking" → phát lại cho mọi tài khoản.
// Chỉ tắt watermark HIỂN THỊ (Google cho phép tắt sẵn trong menu); SynthID ẩn của Google KHÔNG đụng tới.
const WM_FILE = () => path.join(app.getPath('userData'), 'flow-watermark.json');
let wmTpl = null;   // { url, method, body, at }
let _wmArm = null;
try { const _d = JSON.parse(fs.readFileSync(WM_FILE(), 'utf8')); if (_d && _d.url) wmTpl = _d; } catch {}
function _saveWM() { try { fs.writeFileSync(WM_FILE(), JSON.stringify(wmTpl)); } catch {} }
function _looksWM(u, pd) {
  const url = u || ''; const s = url + ' ' + (pd || '');
  if (/(auth\/session|recaptcha|projectInitialData|batchCheckAsync|GenerateVideo|GenerateImage|AsyncGenerate)/i.test(url)) return false;   // loại gen/poll/session/captcha
  return /(watermark|synth ?id|visible.?mark|imagewatermark|mediawatermark|showwatermark|disablewatermark|mark_?visib)/i.test(s);
}
// Endpoint tắt/bật watermark hiển thị đã xác định (KHÔNG phụ thuộc tài khoản — chỉ 1 cờ, account theo phiên).
const WM_URL = 'https://aisandbox-pa.googleapis.com/v1/flow/userSettings';
function _wmBody(enabled) { return JSON.stringify({ userSettings: { isWatermarkEnabledByUser: !!enabled }, updateMask: 'isWatermarkEnabledByUser' }); }
function watermarkStatus() { return { learned: true, url: WM_URL, at: (wmTpl && wmTpl.at) || null }; }   // luôn sẵn (bake sẵn request), khách khỏi học
function watermarkDump() { return wmTpl ? { url: wmTpl.url, method: wmTpl.method, body: String(wmTpl.body || '').slice(0, 3000), at: wmTpl.at } : null; }
async function armWatermarkLearn(id) {
  let realId = (id != null && accounts.has(id) && accounts.get(id).enabled !== false) ? id : _firstEnabledId();
  if (!realId) return { error: 'Chưa có tài khoản nào ĐANG BẬT. Bật 1 tài khoản rồi thử lại.' };
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
          LOG('  [học watermark] ' + m.params.request.method + ' ' + u.replace(/\?.*$/, ''));   // ghi mọi request để soi nếu bắt hụt
          if (_looksWM(u, pd)) {
            wmTpl = { url: u, method: m.params.request.method, body: pd || '', at: Date.now() }; _saveWM(); _wmArm = null;
            LOG('acc', realId, '✔ ĐÃ HỌC tắt watermark:', u);
            LOG('  BODY:', String(pd || '').slice(0, 1200));
          }
        }
      } catch {}
    });
  }
  return { ok: true, id: realId, note: 'Đã mở Chrome. Bấm avatar (góc phải Flow) → gạt "Visible watermarking" sang ĐANG TẮT. App sẽ tự HỌC (chỉ cần làm 1 lần).' };
}
async function applyWatermarkOne(id, off) {
  const live = await ensureLive(id);   // mở phiên RIÊNG của account → request áp đúng account đó
  const r = await apiFetch(live.cdp, { url: WM_URL, method: 'PATCH', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + live.token }, body: _wmBody(off === false) });   // off (mặc định) → isWatermarkEnabledByUser=false
  if (id !== S._captchaId) { try { await closeChrome(id); } catch {} }   // đóng lại cho gọn (giữ máy captcha)
  return { ok: !!(r && r.ok), status: r && r.status };
}
async function applyWatermarkAll() {
  const ids = S.order.filter((x) => { const a = accounts.get(x); return a && a.enabled !== false; });
  if (!ids.length) return { error: 'Chưa có tài khoản nào đang bật.' };
  const out = [];
  for (const id of ids) {
    try { const r = await applyWatermarkOne(id); out.push({ id, ok: r.ok, status: r.status }); LOG('acc', id, r.ok ? '✔ đã tắt watermark hiển thị' : ('⚠️ tắt watermark trả HTTP ' + (r.status || '?'))); }
    catch (e) { out.push({ id, ok: false, error: e && e.message }); LOG('acc', id, '❌ tắt watermark lỗi:', e && e.message); }
  }
  return { ok: true, results: out, done: out.filter((x) => x.ok).length, total: ids.length };
}
function _uuid() { try { return require('crypto').randomUUID(); } catch { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(Math.random() * 16); const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); }); } }
// Replay upscale 1080p cho 1 video (endpoint đã học: video:batchAsyncGenerateVideoUpsampleVideo).
// Body: requests[0].videoInput.mediaId = video nguồn, clientContext.projectId, recaptchaContext.token.
async function upsampleVideo(id, { mediaId, projectId, aspect, withData }) {
  if (!vUpTpl) return { error: 'CHƯA_HỌC_UPSCALE' };
  const { cdp, token } = await ensureLive(id);
  let capToken = ''; try { capToken = await evalInPage(cdp, captchaCode('VIDEO_GENERATION')); } catch {}
  if (!capToken) return { error: 'CAPTCHA_EMPTY' };
  let body; try { body = JSON.parse(vUpTpl.body); } catch { return { error: 'TPL_BODY_BAD' }; }
  // Điền đúng cấu trúc đã học.
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
  if (!reqs.length) _vDeepSet(body, (k) => k === 'mediaId', String(mediaId));   // dự phòng nếu cấu trúc khác
  const r = await apiFetch(cdp, { url: vUpTpl.url, method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
  if (!r.ok) return { error: extractApiError(d) || ('UPSCALE_HTTP_' + r.status) };
  const ie = extractApiError(d); if (ie) return { error: ie };
  const first = d && Array.isArray(d.media) && d.media[0]; const opName = (first && first.name) || (d && d.name) || null;
  if (!opName) return { error: 'NO_UPSCALE_MEDIA_ID' };
  // Poll như video thường tới khi bản 1080p xong → lấy link. (nâng 1080p hay ~5-6 phút → chờ tới 8 phút)
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

// Tạo 1 video trên 1 account Chrome (mirror runVideoOnToken của extension). Trả {ok,...}|{error}.
async function genVideo(id, params) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  let token; try { token = (await ensureLive(id)).token; } catch (e) { return { error: 'Mở Chrome lỗi: ' + (e.message || e) }; }
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
    if (p.credits != null) credits = p.credits;
    if (p.error) return { error: p.error, mediaId: sub.mediaId };
    if (p.failed) return { error: 'Flow báo tạo video THẤT BẠI (' + (p.status || '?') + ')', mediaId: sub.mediaId };
    if (p.done) { videoUrl = p.videoUrl; done = true; break; }
  }
  if (!done) return { error: 'TIMEOUT chờ video', mediaId: sub.mediaId };
  let vid = null;
  // Poll trả link theo ĐÚNG mediaId → tải bytes THẲNG từ đó (tránh cào projectInitialData lấy nhầm video cũ trong project).
  if (videoUrl && !/^blob:/.test(videoUrl) && params.withData) {
    try { vid = await fetchVideoData(id, videoUrl); } catch (e) { vid = null; }
  }
  // Chưa có link, hoặc tải thẳng lỗi → resolve qua projectInitialData (đã khớp mediaId chính xác trong JSON).
  if (!videoUrl || (params.withData && (!vid || vid.fetchError))) {
    const rv = await resolveVideo(id, { projectId: sub.projectId, mediaId: sub.mediaId, withData: params.withData });
    if (!videoUrl) videoUrl = rv.videoUrl;
    if (!vid || vid.fetchError) vid = rv.video || vid;
  }
  // NÂNG 1080p (tuỳ chọn) — video gốc là 720p; nếu user chọn 1080p và đã học request thì nâng độ phân giải.
  let resolution = '720p';
  if (/1080/.test(String(params.resolution || ''))) {
    if (!vUpTpl) { LOG('acc', id, '⚠️ chưa học nâng 1080p — giữ 720p (vào Tạo Video → "Học nâng 1080p")'); }
    else {
      LOG('acc', id, '⬆ nâng 1080p…');
      try {
        const up = await upsampleVideo(id, { mediaId: sub.mediaId, projectId: sub.projectId, aspect: params.aspect, withData: params.withData });
        if (up && !up.error && (up.videoUrl || up.video?.b64)) { videoUrl = up.videoUrl || videoUrl; if (up.video) vid = up.video; resolution = '1080p'; LOG('acc', id, '✔ đã nâng 1080p'); }
        else { LOG('acc', id, '⚠️ nâng 1080p lỗi (' + ((up && up.error) || '?') + ') — giữ 720p'); }
      } catch (e) { LOG('acc', id, '⚠️ nâng 1080p lỗi: ' + (e.message || e) + ' — giữ 720p'); }
    }
  }
  return { ok: true, mediaId: sub.mediaId, projectId: sub.projectId, videoUrl, video: vid, credits, resolution };
}

// Extension mode: video gen ở extension nhưng KHÔNG tải được file (phiên trình duyệt ≠ chủ project).
// → App resolve giúp: mở Chrome for Testing của CHÍNH tài khoản đó (đúng phiên) để lấy link + tải file.
async function resolveVideoForApp({ email, projectId, mediaId, resolution, aspect, withData }) {
  let id = null;
  for (const aid of S.order) { const a = accounts.get(aid); if (a && a.email && email && a.email.toLowerCase() === String(email).toLowerCase()) { id = aid; break; } }
  if (id == null) return { error: 'Không tìm thấy tài khoản CfT khớp email ' + email + ' để resolve video.' };
  try {
    // Chọn 1080p (chế độ Extension) → NÂNG trước khi tải (nếu đã học request).
    if (/1080/.test(String(resolution || ''))) {
      if (!vUpTpl) LOG('acc', id, '⚠️ chưa học nâng 1080p — giữ 720p');
      else {
        LOG('acc', id, '⬆ nâng 1080p…');
        const up = await upsampleVideo(id, { mediaId, projectId, aspect, withData: withData !== false });
        if (up && !up.error && (up.videoUrl || up.video?.b64)) { LOG('acc', id, '✔ đã nâng 1080p'); return { ok: true, videoUrl: up.videoUrl || null, video: up.video || null, resolution: '1080p' }; }
        LOG('acc', id, '⚠️ nâng 1080p lỗi (' + ((up && up.error) || '?') + ') — giữ 720p');
      }
    }
    const rv = await resolveVideo(id, { projectId, mediaId, withData: withData !== false });
    return { ok: true, videoUrl: rv.videoUrl || null, video: rv.video || null, resolution: '720p' };
  } catch (e) { return { error: 'RESOLVE lỗi: ' + (e.message || e) }; }
}

// Gom token TƯƠI của tất cả account (mở Chrome từng cái 1 nhịp) → để bơm sang extension.
async function getAllTokens(force) {
  if (S._busy) { LOG('bỏ qua làm mới token: đang bận thao tác khác'); return []; }   // không xen vào đăng nhập lại
  S._busy = true;
  try {
    const out = [];
    for (const id of S.order) {
      const a = accounts.get(id);
      if (!a || a.enabled === false) continue;
      if (force) S.tokens.delete(id);   // ép mint token MỚI
      // Token cache CÒN HẠN THẬT (24h) + đã có project + email → DÙNG LẠI, KHỎI mở Chrome (chuyển chế độ/refresh không mở Chrome vô ích).
      const tk = S.tokens.get(id);
      if (!force && tk && tk.token && tk.expiry && Date.now() < tk.expiry - 5 * 60 * 1000 && a.projectId) {   // bỏ yêu cầu email (Windows hay null) → cache vẫn dùng lại được
        a.needLogin = false;
        out.push({ email: a.email, token: tk.token, project_id: a.projectId, tier: a.tier || null, credits: a.credits ?? null });
        LOG('acc', id, 'dùng token cache (còn hạn) — khỏi mở Chrome');
        continue;
      }
      try {
        const d = await getAccountData(id);
        if (d.token) { a.needLogin = false; out.push({ email: a.email || ('Chrome ' + id), token: d.token, project_id: d.projectId || null, tier: a.tier || null, credits: a.credits ?? null }); }
        LOG('cho extension: acc', id, d.token ? 'token OK' : 'rỗng', 'proj', d.projectId || '-');
      } catch (e) {
        a.needLogin = true;   // profile không ra token → cần đăng nhập lại (thường do đổi trình duyệt)
        LOG('⚠️ acc', id, (a.email || '') + ': chưa đăng nhập bằng Chrome for Testing — bấm "Đăng nhập lại" cho tài khoản này (1 lần).');
      }
    }
    return out;
  } finally { S._busy = false; }
}

// ── (hoán vị từ flow-chrome.js gốc dòng 683–709 — hạ gợi chu trình require) ──
async function getAccountData(id) {
  if (!accounts.has(id)) throw new Error('NO_ACC');
  const a = accounts.get(id);
  const live = await ensureLive(id);   // Chrome của CHÍNH account id → phiên riêng của nó
  const token = live.token;
  // Lấy EMAIL từ session endpoint (trả user.email) để hiện tên account thật thay "Chrome N".
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
      if (projectId && a) { a.projectId = projectId; persist(); LOG('acc', id, 'project riêng', projectId); }
      else LOG('acc', id, 'tạo project lỗi:', String(pr.text).slice(0, 120));
    } catch (e) { LOG('acc', id, 'createProject lỗi', e && e.message); }
  }
  S.tokens.set(id, { token, at: Date.now(), expiry: S._lastTokenExpiry });
  persist();   // lưu token + hạn xuống đĩa → tắt/mở app còn hạn thì xài lại, khỏi mở Chrome
  try { await closeChrome(id); } catch {}   // lấy xong ĐÓNG HẲN — không giữ cửa sổ nào (gen chạy ở extension)
  return { token, projectId };
}
module.exports = { TRPC_CREATE_PROJECT, SITE_KEY, genImageUrl, cryptoRandomUUID, deepFindProjectId, extractApiError, extractApiError, extractMediaEntries, buildImageBody, captchaCode, genTest, UPLOAD_IMAGE_URL, DEFAULT_VIDEO, vEnsureProject, vUploadImage, vSubmit, vPoll, fetchVideoData, resolveVideo, VUP_FILE, vUpTpl, videoUpscaleStatus, videoUpscaleDump, armVideoUpscale, WM_FILE, wmTpl, WM_URL, watermarkStatus, watermarkDump, armWatermarkLearn, applyWatermarkOne, applyWatermarkAll, upsampleVideo, genVideo, resolveVideoForApp, getAllTokens, getAccountData };
