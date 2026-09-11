/* ── gen-bx.js — Gen ảnh qua batchexecute `ogiZ0b` của flow.google.com (đo 11/9/2026).
   Giao thức mới của Flow sau khi dời domain (protocol recon 9/2026):
     • Trigger : batchexecute rpcid=ogiZ0b — response trả SYNCHRONOUS link CDN ảnh
                 (https://flow-content.google/image/<mediaId>?...) + kích thước.
     • Poll    : jwpduf chỉ là progress UI — gen ảnh KHÔNG cần poll (đã xác nhận qua
                 capture rpc-ogiZ0b-req/res: response wrb.fr chứa URL ngay).
   Chạy NGAY TRONG page flow.google.com (same-origin fetch) nên tự mang cookie
   session. f.req dựng từ TEMPLATE thu hoạch (chrome-accounts/flow-bx-template.json,
   sản phẩm của capture gen thật) + thay các trường NONCE mỗi request: prompt,
   reCAPTCHA Enterprise token (mint trong page), seedNum, client UUID.
   LỖI lộ liễu theo Luật 10: BX_NO_BL / BX_NO_AT / BX_NAVIGATE / BX_HTTP_<code> /
   BX_BAD_RESPONSE / BX_RPC_ERROR_<code> / BX_NO_MEDIA / BX_NO_TEMPLATE. ── */
const fs = require('fs');
const path = require('path');
const { LOG, evalInPage, profilesRoot, sleep, SITE_KEY } = require('./nen-tang');

const FLOW_ORIGIN = 'https://flow.google.com';

/* ── Template f.req (thu hoạch từ gen thật) ─────────────────────────────── */
const templateFile = () => path.join(profilesRoot(), 'flow-bx-template.json');
function loadTemplate() {
  try { return JSON.parse(fs.readFileSync(templateFile(), 'utf8')); }
  catch { return null; }
}
function saveTemplate(t) {
  fs.mkdirSync(profilesRoot(), { recursive: true });
  fs.writeFileSync(templateFile(), JSON.stringify(t, null, 1), 'utf8');
}

/* Clone payload template + thay các trường nonce:
   • prompt  [1][0][8] = [[["<prompt>"]]]
   • captcha [1][0][7][10] và [3][10] = [<reCAPTCHA Enterprise token ~2.4KB>, 1]
     (token 0cAFcWeA… trong capture CHÍNH LÀ recaptcha token — dùng 1 lần;
      replay token cũ → PUBLIC_ERROR_UNUSUAL_ACTIVITY — đo live 11/9/2026)
   • seedNum [1][0][3] + client UUID [12]/[13] → random mỗi request
   • projectId đồng bộ ở CẢ HAI ctx slot ([1][0][7] và [3]). */
function buildOgiZ0bPayload({ prompt, projectId, template, captchaToken, seedNum }) {
  if (template && template.payload && template.rpcid === 'ogiZ0b') {
    const p = JSON.parse(JSON.stringify(template.payload));
    p[1][0][8] = [[[String(prompt)]]];
    if (!p[1][0][7]) p[1][0][7] = [null, 22, null, null, null, projectId, null, null, null, null, null];
    if (projectId) {
      if (p[1][0][7].length > 5) p[1][0][7][5] = projectId;
      if (Array.isArray(p[3]) && p[3].length > 5) p[3][5] = projectId;
    }
    if (captchaToken) {
      const slot = [captchaToken, 1];
      if (Array.isArray(p[1][0][7][10])) p[1][0][7][10] = slot;
      if (Array.isArray(p[3]) && Array.isArray(p[3][10])) p[3][10] = [...slot];
    }
    if (seedNum) p[1][0][3] = seedNum;
    if (!p[3]) p[3] = JSON.parse(JSON.stringify(p[1][0][7]));
    return p;
  }
  const ctx = [null, 22, null, null, null, projectId, null, null, null, null, null];
  const uuid = () => (typeof require('crypto').randomUUID === 'function' ? require('crypto').randomUUID() : 'b-' + Date.now()).toUpperCase();
  return [null, [[null, null, null, seedNum || Math.floor(Math.random() * 2000000000), 3, 'NARWHAL', null, ctx, [[[String(prompt)]]], null, null, null, uuid(), uuid()]], 1, JSON.parse(JSON.stringify(ctx)), [uuid()]];
}

/* ── Gọi batchexecute TỪ PAGE (same-origin) ─────────────────────────────── */
const BX_PAGE_FN = `
  async (argsJson) => {
    const args = JSON.parse(argsJson);
    const W = window.WIZ_global_data || {};
    const at = W.SNlM0e || null;
    const sid = W.FdrFJe || null;
    let bl = W.cfb2h || null;
    if (!bl) {
      const m = document.documentElement.outerHTML.match(/boq_labs-ai-sandbox-frontend_([0-9.]+)_p0/);
      bl = m ? 'boq_labs-ai-sandbox-frontend_' + m[1] + '_p0' : null;
    }
    if (!bl) return JSON.stringify({ error: 'BX_NO_BL' });
    if (!at) return JSON.stringify({ error: 'BX_NO_AT' });
    window.__novaBxReqid = ((window.__novaBxReqid || 0) + 100001) % 1000000;
    const url = '/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=' + encodeURIComponent(args.rpcid) +
      '&source-path=' + encodeURIComponent(args.sourcePath) +
      '&bl=' + encodeURIComponent(bl) + '&f.sid=' + encodeURIComponent(sid || '') +
      '&hl=en-US&_reqid=' + window.__novaBxReqid + '&rt=c';
    const body = 'f.req=' + encodeURIComponent(args.freq) + '&at=' + encodeURIComponent(at);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, credentials: 'include' });
    if (!r.ok) return JSON.stringify({ error: 'BX_HTTP_' + r.status });
    const text = await r.text();
    return JSON.stringify({ ok: true, bl, sid, text: text.slice(0, 2000000) });
  }
`;

/* Eval dùng hàm arrow với tham số — evalInPage chỉ nhận expression, nên bọc call. */
async function evalArrow(cdp, fnSrc, argJson) {
  const expr = '(' + fnSrc + ')(' + JSON.stringify(argJson) + ')';
  return evalInPage(cdp, expr);
}

/* Parse response rt=c: )]}’\n\n<len>\n<json>\n... → mảng các entry wrb.fr */
function parseBxResponse(text) {
  let rest = String(text || '').replace(/^\)\]\}'[^\n]*\n/, '').replace(/^\s+/, '');
  const out = [];
  while (rest.length) {
    const m = rest.match(/^(\d+)\s*\n/);
    if (!m) break;
    // KHÔNG slice theo số prefix: prefix đếm BYTE (UTF-8) còn JS string đếm CHAR —
    // JSON có ký tự multi-byte sẽ lệch (đo live 11/9: 1157 byte = 1156 char) →
    // chunk dính rác dòng sau → JSON.parse nổ → mất entry. batchexecute luôn
    // đặt JSON trên MỘT dòng → tách theo '\n' là đúng tuyệt đối.
    rest = rest.slice(m[0].length);
    const nl = rest.indexOf('\n');
    const chunk = nl < 0 ? rest : rest.slice(0, nl);
    rest = nl < 0 ? '' : rest.slice(nl + 1);
    let arr; try { arr = JSON.parse(chunk); } catch { continue; }
    /* batchexecute bọc 2 lớp: [[["wrb.fr",...],["di",...]]] — arr[0] mới là mảng entry.
       Response đo thật 20:03 11/9: arr = [[wrb.fr-entry, di, af.httprm]] → duyệt arr trực tiếp
       thì entry là MẢNG CON, entry[0] !== 'wrb.fr' → mất hết entry (bug bx-bad-resp.txt).
       Nếu arr đã phẳng (mỗi phần tử là entry) thì giữ nguyên. */
    let list = arr;
    if (Array.isArray(list[0]) && Array.isArray(list[0][0])) list = list[0];
    for (const entry of (list || [])) {
      if (Array.isArray(entry) && entry[0] === 'wrb.fr') out.push({ rpcid: entry[1], payload: entry[2], code: entry[4] !== undefined ? entry[4] : null, kind: entry[5] || entry[3] });
    }
  }
  return out;
}

/* Đảm bảo page đang ở trang project (same-origin + source-path khớp server state).
   CDP Page.navigate bị bỏ qua trên tab này (đo 11/9) → dùng window.location.href. */
async function ensureProjectPage(cdp, projectId) {
  const u = await evalArrow(cdp,`async () => location.href`, '');
  if (String(u).includes('/project/' + projectId)) return { ok: true };
  await cdp.send('Page.enable', {}).catch(() => {});
  const target = FLOW_ORIGIN + '/project/' + projectId;
  for (let i = 0; i < 30; i++) {   // ~60s: gán lại location mỗi 3 vòng (tab mới mở hay bị redirect về /about)
    if (i % 3 === 0) {
      await evalArrow(cdp,`async (u) => { window.location.href = u; return 'nav'; }`, target).catch(() => 'ctx die (đang navigate)');
    }
    await sleep(2000);
    const u2 = await evalArrow(cdp,`async () => location.href`, '').catch(() => '');
    if (String(u2).includes('/project/' + projectId)) {
      for (let j = 0; j < 8; j++) {   // chờ WIZ_global_data sẵn sàng
        const ready = await evalArrow(cdp,`async () => !!(window.WIZ_global_data && window.WIZ_global_data.SNlM0e)`, '').catch(() => false);
        if (ready) return { ok: true };
        await sleep(1000);
      }
    }
  }
  throw new Error('BX_NAVIGATE: không tới được trang project ' + projectId);
}

async function bxFetch(cdp, { rpcid, freq, sourcePath }) {
  const r = await evalArrow(cdp,BX_PAGE_FN, JSON.stringify({ rpcid, freq, sourcePath }));
  let out; try { out = JSON.parse(r); } catch { throw new Error('BX_BAD_RESPONSE: ' + String(r).slice(0, 120)); }
  if (out.error) throw new Error(out.error);
  return out;
}

/* Trích media từ payload ogiZ0b. Schema ĐO THẬT (response 20:03 11/9, bx-bad-resp.txt):
   item=[0]=mediaId · [2]=assetId · [7]=prompt · [13]=CDN URL · [19]=[w,h]
   (schema đo trước đây theo nested item[6][0][13]/item[6][2] — giữ làm fallback; ngoài ra
   tìm sâu bất kỳ chuỗi flow-content/hoặc cặp [w,h] để chống schema dịch tiếp). */
function parseOgiZ0b(payloadStr) {
  let inner; try { inner = JSON.parse(payloadStr); } catch { return null; }
  const item = inner && inner[0] && inner[0][0];
  if (!item) return null;
  const deepFind = (pred, node, depth) => {
    if (depth > 8 || node == null) return undefined;
    if (pred(node)) return node;
    if (Array.isArray(node)) { for (const c of node) { const f = deepFind(pred, c, depth + 1); if (f !== undefined) return f; } }
    return undefined;
  };
  const meta = item[6] && Array.isArray(item[6]) ? item[6][0] : null;
  const dimsNested = item[6] && Array.isArray(item[6]) ? item[6][2] : null;
  const url =
    deepFind((v) => typeof v === 'string' && v.startsWith('https://flow-content.google/image/'), item, 0) ||
    (meta && typeof meta[13] === 'string' && meta[13].startsWith('http') ? meta[13] : null) || null;
  const dims = deepFind((v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[0] > 0 && v[1] > 0, item, 0) || dimsNested || null;
  const prompt = (typeof item[7] === 'string' && item[7]) || (meta ? meta[7] : null) || null;
  return {
    mediaId: item[0] || null,
    assetId: item[2] || null,
    prompt,
    url,
    width: dims ? dims[0] : null,
    height: dims ? dims[1] : null,
    raw: inner,
  };
}

/* ── Credits (rpcid `nzlxg` = /VideoFxService.GetCredits) ─────────────────
   Capture thật 11/9: f.req = [[["nzlxg","[]",null,"generic"]]] — payload rỗng "[]".
   Response inner JSON = [remaining, ?, ?, ?, null, total] (đo: [576,1,2,2,null,576]).
   Lỗi lộ liễu: BX_CREDITS_BAD_RESPONSE / BX_CREDITS_NO_DATA. */
async function getCreditsBX(cdp, { projectId }) {
  if (!projectId) throw new Error('BX_NO_PROJECT');
  const freq = JSON.stringify([[['nzlxg', '[]', null, 'generic']]]);
  const res = await bxFetch(cdp, { rpcid: 'nzlxg', freq, sourcePath: '/project/' + projectId });
  const entries = parseBxResponse(res.text);
  const own = entries.find((e) => e.rpcid === 'nzlxg');
  if (!own) throw new Error('BX_CREDITS_BAD_RESPONSE: thiếu wrb.fr/nzlxg (len=' + (res.text || '').length + ')');
  let inner; try { inner = JSON.parse(own.payload); } catch (e) { throw new Error('BX_CREDITS_BAD_RESPONSE: payload không parse được: ' + String(own.payload).slice(0, 120)); }
  if (!Array.isArray(inner) || typeof inner[0] !== 'number') throw new Error('BX_CREDITS_NO_DATA: schema lạ — ' + JSON.stringify(inner).slice(0, 120));
  return { ok: true, remaining: inner[0], total: typeof inner[5] === 'number' ? inner[5] : null, raw: inner };
}

/* Health-check trước khi gen hàng loạt: đọc bl/f.sid/at live từ page, so với
   template đã thu hoạch, và check credits. bl/f.sid bxFetch TỰ ĐỌC live từ
   WIZ_global_data nên server xoay version KHÔNG làm hỏng gen — template chỉ
   đóng góp payload. Trả { bl, fSid, templateBl, blMatch, templateFresh, credits }. */
async function healthCheckBX(cdp, { projectId, template }) {
  const tpl = template || loadTemplate();
  if (!tpl) throw new Error('BX_NO_TEMPLATE (chưa thu hoạch flow-bx-template.json)');
  await ensureProjectPage(cdp, projectId);
  const freq = JSON.stringify([[['nzlxg', '[]', null, 'generic']]]);
  const res = await bxFetch(cdp, { rpcid: 'nzlxg', freq, sourcePath: '/project/' + projectId });
  const bl = res.bl || null, fSid = res.sid || null;
  const credits = await (async () => {
    const entries = parseBxResponse(res.text);
    const own = entries.find((e) => e.rpcid === 'nzlxg');
    if (!own) return null;
    try { const inner = JSON.parse(own.payload); return Array.isArray(inner) ? { remaining: inner[0], total: typeof inner[5] === 'number' ? inner[5] : null } : null; }
    catch { return null; }
  })();
  return {
    ok: true, bl, fSid,
    templateBl: tpl.bl || null,
    blMatch: !tpl.bl || !bl || tpl.bl === bl,
    templateFresh: bl ? tpl.bl === bl : null,   // null = không đọc được bl live
    credits,
  };
}

/* Mint reCAPTCHA Enterprise token NGAY TRONG page project (đã đăng nhập —
   enterprise.js chỉ nạp ở /project/<id>, đo 11/9/2026 trong nen-tang). */
const CAPTCHA_PAGE_FN = `
  async (args) => {
    const s = Date.now();
    while (!(window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute)) {
      if (Date.now() - s > 15000) throw new Error('BX_NO_GRECAPTCHA');
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((res) => { try { window.grecaptcha.enterprise.ready(res); } catch (e) { res(); } });
    return await Promise.race([
      window.grecaptcha.enterprise.execute(args.siteKey, { action: args.action || 'IMAGE_GENERATION' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('BX_CAPTCHA_TIMEOUT')), 25000)),
    ]);
  }
`;

/* Gen 1 ảnh qua ogiZ0b. Trả { ok, mediaId, assetId, url, width, height }
   hoặc NÉM lỗi có mã (Luật 10 — không fallback ngầm). */
async function genImageBX(cdp, { prompt, projectId, template, captchaToken, siteKey }) {
  if (!prompt) throw new Error('BX_NO_PROMPT');
  if (!projectId) throw new Error('BX_NO_PROJECT');
  const tpl = template || loadTemplate();
  if (!tpl) throw new Error('BX_NO_TEMPLATE (chưa thu hoạch flow-bx-template.json — chạy capture gen thật trước)');
  await ensureProjectPage(cdp, projectId);
  // Mint captcha mới mỗi request (dùng-một-lần; bỏ qua nếu caller tự cấp)
  let cap = captchaToken || null;
  if (!cap) {
    cap = await evalArrow(cdp, CAPTCHA_PAGE_FN, { siteKey: siteKey || SITE_KEY, action: 'VIDEO_GENERATION' }).catch((e) => { throw new Error('BX_CAPTCHA: ' + (e.message || e)); });
    if (!cap || String(cap).length < 100) throw new Error('BX_CAPTCHA_EMPTY');
  }
  const uuid = () => (require('crypto').randomUUID() || 'b-' + Date.now()).toUpperCase();
  const payload = buildOgiZ0bPayload({ prompt, projectId, template: tpl, captchaToken: cap, seedNum: Math.floor(Math.random() * 2000000000) });
  if (Array.isArray(payload[1][0]) && payload[1][0].length > 12) { payload[1][0][12] = uuid(); payload[1][0][13] = uuid(); }
  const freq = JSON.stringify([[['ogiZ0b', JSON.stringify(payload), null, 'generic']]]);
  const res = await bxFetch(cdp, { rpcid: 'ogiZ0b', freq, sourcePath: '/project/' + projectId });
  const entries = parseBxResponse(res.text);
  const own = entries.find((e) => e.rpcid === 'ogiZ0b');
  if (!own) {
    try { fs.writeFileSync(path.join(require('os').tmpdir(), 'flow-gen-capture', 'bx-bad-resp.txt'), res.text || '', 'utf8'); } catch { /* sink */ }
    throw new Error('BX_BAD_RESPONSE: thiếu wrb.fr/ogiZ0b (len=' + (res.text || '').length + ') head=' + JSON.stringify(String(res.text || '').slice(0, 400)));
  }
  const parsed = parseOgiZ0b(own.payload);
  if (!parsed) {
    const errInfo = String(own.payload || '').match(/([A-Z_]{6,})/);
    throw new Error('BX_RPC_ERROR' + (errInfo ? '_' + errInfo[1] : '') + ': ' + String(own.payload).slice(0, 200));
  }
  if (!parsed.url) throw new Error('BX_NO_MEDIA: response không chứa link (mediaId=' + parsed.mediaId + ') — cần poll jwpduf?');
  return { ok: true, ...parsed };
}

/* Gen N ảnh tuần tự (mỗi ảnh 1 request ogiZ0b — server đếm credit theo request).
   PREFLIGHT: check credits (nzlxg) TRƯỚC khi batch — hết credit hoặc thiếu
   credit cho count → nổ lộ liễu BX_NO_CREDITS, KHÔNG gen dở dang (Luật 10). */
async function genImagesBX(cdp, { prompt, projectId, count = 1, template, onEach, skipCreditCheck }) {
  const n = Math.max(1, Math.min(Number(count) || 1, 4));
  if (!skipCreditCheck) {
    const c = await getCreditsBX(cdp, { projectId });
    if (!(c.remaining > 0)) throw new Error('BX_NO_CREDITS: còn ' + c.remaining + '/' + (c.total ?? '?') + ' credit — dừng trước khi gen (nzlxg)');
    if (n > c.remaining) throw new Error('BX_NO_CREDITS: cần ' + n + ' credit, chỉ còn ' + c.remaining + '/' + (c.total ?? '?'));
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = await genImageBX(cdp, { prompt, projectId, template });
    out.push(r);
    if (onEach) try { onEach(r, i); } catch { /* sink lỗi người dùng */ }
  }
  return out;
}

/* ── VIDEO gen (rpcid `YhhmEf`) — schema đo thật 11/9/2026 (UI capture ×3) ──
   Trigger f.req payload (JSON string trong wrb.fr):
     [0]  = [[[ [null,null,[[[PROMPT]]], MODEL, 2, null, [null,null,null,null,U1,U2] ]]]]
     [1]  = [null,22,null,null,null,projectId,null,null,null,null,[CAPTCHA,1]]
     [2]  = [U3, 2]
   MODEL = "abra_t2v_8s" (text-to-video 8s; 360p/720p/aspect nằm ở slot "2").
   Response: [null, <credits còn lại>, [[taskId,null,null,[title,ts,null,null,
   mediaId,otherId,ts], projectId]], [[…]]] — SYNCHRONOUS (không cần poll trigger).
   Poll kết quả: as29s với payload ["<mediaId>"] → record chứa status ([2]=đang
   xử lý, [3]=xong) + URL https://flow-content.google/video/<mediaId>?…
   Chi phí: 12 credits / video (x1, 720p, 8s — đo 11/9). */
function buildYhhmEfPayload({ prompt, projectId, captchaToken, model }) {
  if (!prompt) throw new Error('BX_NO_PROMPT');
  if (!projectId) throw new Error('BX_NO_PROJECT');
  if (!captchaToken) throw new Error('BX_NO_CAPTCHA');
  const uuid = () => (typeof require('crypto').randomUUID === 'function' ? require('crypto').randomUUID() : 'b-' + Date.now()).toUpperCase();
  /* Scene = [promptBlock, model, 2, null, uuids] — shape khớp capture thật (tmp-video-shape2.txt):
     inner[0]=[scene] (A1) · scene=A5 · scene[0]=A3=[null,null,[[[PROMPT]]]] · inner[1]=ctx A11 · inner[2]=[U3,2]. */
  const scene = [
    [null, null, [[[String(prompt)]]]],
    model || 'abra_t2v_8s',
    2,
    null,
    [null, null, null, null, uuid(), uuid()],
  ];
  return [
    [scene],
    [null, 22, null, null, null, projectId, null, null, null, null, [captchaToken, 1]],
    [uuid(), 2],
  ];
}

/* Trích media/task từ response YhhmEf. Trả { taskId, mediaId, creditsAfter }. */
function parseYhhmEf(payloadStr) {
  let inner; try { inner = JSON.parse(payloadStr); } catch { return null; }
  if (!Array.isArray(inner) || !Array.isArray(inner[2]) || !Array.isArray(inner[2][0])) return null;
  const gen = inner[2][0];
  const taskId = typeof gen[0] === 'string' ? gen[0] : null;
  let mediaId = null;
  if (Array.isArray(gen[3])) mediaId = gen[3][4] || null;
  return { taskId, mediaId, creditsAfter: typeof inner[1] === 'number' ? inner[1] : null, raw: inner };
}

/* Trích kết quả as29s: { status, videoUrl, imageUrl, raw }. */
function parseAs29s(payloadStr) {
  let inner; try { inner = JSON.parse(payloadStr); } catch { return null; }
  const deepFind = (pred, node, depth) => {
    if (depth > 10 || node == null) return undefined;
    if (pred(node)) return node;
    if (Array.isArray(node)) { for (const c of node) { const f = deepFind(pred, c, depth + 1); if (f !== undefined) return f; } }
    return undefined;
  };
  const videoUrl = deepFind((v) => typeof v === 'string' && v.startsWith('https://flow-content.google/video/'), inner, 0) || null;
  const imageUrl = deepFind((v) => typeof v === 'string' && v.startsWith('https://flow-content.google/image/'), inner, 0) || null;
  const mediaId = typeof inner[0] === 'string' ? inner[0] : null;
  let status = null;
  const statusArr = deepFind((v) => Array.isArray(v) && v.length === 1 && typeof v[0] === 'number', inner, 0);
  if (statusArr) status = statusArr[0];
  return { mediaId, status, videoUrl, imageUrl, raw: inner };
}

/* Gen 1 video qua YhhmEf + poll as29s đến khi có URL. Trả
   { ok, mediaId, taskId, videoUrl, imageUrl, creditsAfter } hoặc NÉM lỗi có mã. */
async function genVideoBX(cdp, { prompt, projectId, captchaToken, siteKey, model, pollMs = 15000, pollMax = 40 }) {
  if (!prompt) throw new Error('BX_NO_PROMPT');
  if (!projectId) throw new Error('BX_NO_PROJECT');
  await ensureProjectPage(cdp, projectId);
  let cap = captchaToken || null;
  if (!cap) {
    cap = await evalArrow(cdp, CAPTCHA_PAGE_FN, { siteKey: siteKey || SITE_KEY, action: 'IMAGE_GENERATION' }).catch((e) => { throw new Error('BX_CAPTCHA: ' + (e.message || e)); });
    if (!cap || String(cap).length < 100) throw new Error('BX_CAPTCHA_EMPTY');
  }
  const payload = buildYhhmEfPayload({ prompt, projectId, captchaToken: cap, model });
  const freq = JSON.stringify([[['YhhmEf', JSON.stringify(payload), null, 'generic']]]);
  const res = await bxFetch(cdp, { rpcid: 'YhhmEf', freq, sourcePath: '/project/' + projectId });
  const entries = parseBxResponse(res.text);
  const own = entries.find((e) => e.rpcid === 'YhhmEf');
  if (!own) throw new Error('BX_BAD_RESPONSE: thiếu wrb.fr/YhhmEf (len=' + (res.text || '').length + ') head=' + JSON.stringify(String(res.text || '').slice(0, 300)));
  const parsed = parseYhhmEf(own.payload);
  if (!parsed || !parsed.mediaId) {
    const errInfo = String(own.payload || '').match(/([A-Z_]{6,})/);
    throw new Error('BX_RPC_ERROR' + (errInfo ? '_' + errInfo[1] : '') + ': ' + String(own.payload).slice(0, 200));
  }
  /* Poll as29s — payload chỉ cần [mediaId]. [3] trong record = video URL khi xong. */
  const pollFreq = () => JSON.stringify([[['as29s', JSON.stringify([parsed.mediaId]), null, 'generic']]]);
  let last = null;
  for (let i = 0; i < Math.max(1, pollMax); i++) {
    await sleep(pollMs);
    const pres = await bxFetch(cdp, { rpcid: 'as29s', freq: pollFreq(), sourcePath: '/project/' + projectId });
    const pentries = parseBxResponse(pres.text);
    const pown = pentries.find((e) => e.rpcid === 'as29s');
    if (!pown) continue;   // mạng hiccups — vẫn tiếp tục poll, chỉ nổ khi hết pollMax
    const st = parseAs29s(pown.payload);
    if (st) last = st;
    if (st && st.videoUrl) return { ok: true, mediaId: parsed.mediaId, taskId: parsed.taskId, creditsAfter: parsed.creditsAfter, ...st };
  }
  throw new Error('BX_VIDEO_TIMEOUT: mediaId=' + parsed.mediaId + ' status=' + (last && last.status) + ' sau ' + pollMax + ' lần poll');
}

module.exports = { genImageBX, genImagesBX, genVideoBX, getCreditsBX, healthCheckBX, buildYhhmEfPayload, parseYhhmEf, parseAs29s, loadTemplate, saveTemplate, buildOgiZ0bPayload, parseBxResponse, parseOgiZ0b, ensureProjectPage, bxFetch, templateFile };


