/* ── gen-bx.js — Gen ảnh qua batchexecute `ogiZ0b` của flow.google.com (đo 11/9/2026).
   Giao thức mới của Flow sau khi dời domain (protocol recon 9/2026):
     • Trigger : batchexecute rpcid=ogiZ0b — response trả SYNCHRONOUS link CDN ảnh
                 (https://flow-content.google/image/<mediaId>?...) + kích thước.
     • Poll    : jwpduf chỉ là progress UI — gen ảnh KHÔNG cần poll (đã xác nhận qua
                 capture rpc-ogiZ0b-req/res: response wrb.fr chứa URL ngay).
   Chạy NGAY TRONG page flow.google.com (same-origin fetch) nên tự mang cookie
   session + không cần Bearer/captcha như đường REST aisandbox cũ (đã chết).
   f.req dựng từ TEMPLATE thu hoạch (chrome-accounts/flow-bx-template.json — sản
   phẩm của capture gen thật); chỉ thay prompt. Trường chưa rõ nguồn (seed token
   0cAFcWeA…, seedNum, sceneUuid) giữ nguyên từ template — server chấp nhận replay.
   LỖI lộ liễu theo Luật 10: BX_NO_BL / BX_NO_AT / BX_NAVIGATE / BX_HTTP_<code> /
   BX_BAD_RESPONSE / BX_RPC_ERROR_<code> / BX_NO_MEDIA / BX_NO_TEMPLATE. ── */
const fs = require('fs');
const path = require('path');
const { LOG, evalInPage, profilesRoot, sleep } = require('./nen-tang');

const FLOW_ORIGIN = 'https://flow.google.com';
const BX_PATH = '/_/AiSandboxAngularFrontend/data/batchexecute';

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

/* Clone payload template + thay prompt ở slot [1][0][8] = [[["<prompt>"]]].
   Template không có → dựng khung tối thiểu (server sẽ quyết định nhận hay không). */
function buildOgiZ0bPayload({ prompt, projectId, template, seedNum }) {
  if (template && template.payload && template.rpcid === 'ogiZ0b') {
    const p = JSON.parse(JSON.stringify(template.payload));
    p[1][0][8] = [[[String(prompt)]]];
    if (!p[1][0][7]) p[1][0][7] = [null, 22, null, null, null, projectId, null, null, null, null, null];
    // Đồng bộ projectId ở CẢ HAI ctx slot ([1][0][7] và [3]) — source-path phải khớp.
    if (projectId) {
      if (p[1][0][7].length > 5) p[1][0][7][5] = projectId;
      if (Array.isArray(p[3]) && p[3].length > 5) p[3][5] = projectId;
    }
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
  let rest = String(text || '').replace(/^\)\]\}'\s*\n/, '');
  const out = [];
  while (rest.length) {
    const m = rest.match(/^(\d+)\s*\n/);
    if (!m) break;
    const len = Number(m[1]);
    rest = rest.slice(m[0].length);
    const chunk = rest.slice(0, len);
    rest = rest.slice(len + 1);
    let arr; try { arr = JSON.parse(chunk); } catch { continue; }
    for (const entry of (arr || [])) {
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
  await evalArrow(cdp,`async (u) => { window.location.href = u; return 'nav'; }`, FLOW_ORIGIN + '/project/' + projectId).catch((e) => { throw new Error('BX_NAVIGATE: ' + (e.message || e)); });
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
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

/* Trích media từ payload ogiZ0b (schema đo 11/9/2026):
   [0][0][0]=mediaId  [0][0][2]=assetId  [0][0][6][0][13]=CDN URL  [0][0][6][2]=[w,h] */
function parseOgiZ0b(payloadStr) {
  let inner; try { inner = JSON.parse(payloadStr); } catch { return null; }
  const item = inner && inner[0] && inner[0][0];
  if (!item) return null;
  const meta = item[6] && item[6][0];
  const dims = item[6] && item[6][2];
  return {
    mediaId: item[0] || null,
    assetId: item[2] || null,
    prompt: meta ? meta[7] : null,
    url: (meta && typeof meta[13] === 'string' && meta[13].startsWith('http')) ? meta[13] : null,
    width: dims ? dims[0] : null,
    height: dims ? dims[1] : null,
    raw: inner,
  };
}

/* Gen 1 ảnh qua ogiZ0b. Trả { ok, mediaId, assetId, url, width, height }
   hoặc NÉM lỗi có mã (Luật 10 — không fallback ngầm). */
async function genImageBX(cdp, { prompt, projectId, template }) {
  if (!prompt) throw new Error('BX_NO_PROMPT');
  if (!projectId) throw new Error('BX_NO_PROJECT');
  const tpl = template || loadTemplate();
  if (!tpl) throw new Error('BX_NO_TEMPLATE (chưa thu hoạch flow-bx-template.json — chạy capture gen thật trước)');
  await ensureProjectPage(cdp, projectId);
  const payload = buildOgiZ0bPayload({ prompt, projectId, template: tpl });
  const freq = JSON.stringify([[['ogiZ0b', JSON.stringify(payload), null, 'generic']]]);
  const res = await bxFetch(cdp, { rpcid: 'ogiZ0b', freq, sourcePath: '/project/' + projectId });
  const entries = parseBxResponse(res.text);
  const own = entries.find((e) => e.rpcid === 'ogiZ0b');
  if (!own) throw new Error('BX_BAD_RESPONSE: thiếu wrb.fr/ogiZ0b (len=' + (res.text || '').length + ')');
  let parsed = parseOgiZ0b(own.payload);
  if (!parsed) {
    // server từ chối: payload có thể là lỗi dạng gRPC/code — lộ liễu cho caller
    throw new Error('BX_RPC_ERROR: ' + String(own.payload).slice(0, 200));
  }
  if (!parsed.url) throw new Error('BX_NO_MEDIA: response không chứa link (mediaId=' + parsed.mediaId + ') — cần poll jwpduf?');
  return { ok: true, ...parsed };
}

/* Gen N ảnh tuần tự (mỗi ảnh 1 request ogiZ0b — server đếm credit theo request). */
async function genImagesBX(cdp, { prompt, projectId, count = 1, template, onEach }) {
  const out = [];
  for (let i = 0; i < Math.max(1, Math.min(Number(count) || 1, 4)); i++) {
    const r = await genImageBX(cdp, { prompt, projectId, template });
    out.push(r);
    if (onEach) try { onEach(r, i); } catch { /* sink lỗi người dùng */ }
  }
  return out;
}

module.exports = { genImageBX, genImagesBX, loadTemplate, saveTemplate, buildOgiZ0bPayload, parseBxResponse, parseOgiZ0b, ensureProjectPage, bxFetch, templateFile };


