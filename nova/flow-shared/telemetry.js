/* ── H5 — telemetry "batchLogFrontendEvents" (Flow tracking).
   Mục tiêu: gọi `https://flow.google/api/tracking/batchLogFrontendEvents` TRƯỚC mỗi
   `apiFetch` quan trọng (gen image / gen video) để giảm captcha/giúp dòng lỗi.
   Fail mềm: log warn, KHÔNG retry, KHÔNG throw, KHÔNG block caller (Luật 10).
   Tham khảo: extension bắt được endpoint + body shape `[{eventTimeUsec,eventName,
   eventParams:{project_id,model_key,aspect,tier,is_desktop,app_id:NOVA_STUDIO}}]`. */

const { net } = require('electron');
const FALLBACK_FETCH = (typeof fetch === 'function') ? fetch : null;

const ENDPOINT = 'https://flow.google/api/tracking/batchLogFrontendEvents';
const APP_ID = 'NOVA_STUDIO';
const IS_DESKTOP = true;

function _nowUsec() { return Math.floor(Date.now() * 1000); }

function buildTelemetryBody({ projectId, modelKey, aspect, tier, isDesktop, appId, eventName }) {
  const p = {
    project_id: projectId || '',
    model_key: modelKey || '',
    aspect: aspect || '',
    tier: tier || '',
    is_desktop: !!(isDesktop != null ? isDesktop : IS_DESKTOP),
    app_id: appId || APP_ID,
  };
  return [{
    eventTimeUsec: _nowUsec(),
    eventName: eventName || 'generate_media',
    eventParams: p,
  }];
}

async function _send(body) {
  const text = JSON.stringify(body);
  // Ưu tiên electron `net` (ghi log + qua proxy hệ thống); fallback `fetch` (Node 18+).
  if (net && typeof net.request === 'function') {
    return new Promise((resolve) => {
      try {
        const req = net.request({ method: 'POST', url: ENDPOINT });
        req.setHeader('Content-Type', 'application/json');
        req.on('response', (r) => { r.on('data', () => {}); r.on('end', () => resolve(r.statusCode || 0)); });
        req.on('error', () => resolve(0));
        req.write(text); req.end();
      } catch (_) { resolve(0); }
    });
  }
  if (FALLBACK_FETCH) {
    try {
      const r = await FALLBACK_FETCH(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
      return r && r.status || 0;
    } catch (_) { return 0; }
  }
  return 0;
}

// Gọi telemetry KHÔNG await bắt buộc (fire-and-forget) — caller không bao giờ bị block.
function fireTelemetry(opts) {
  try {
    const body = buildTelemetryBody(opts || {});
    const p = _send(body);
    if (p && typeof p.then === 'function') p.then((st) => { if (!st) console.warn('[flow-telemetry] non-2xx/err'); }).catch(() => {});
  } catch (e) { console.warn('[flow-telemetry] build/send err:', e && e.message); }
}

module.exports = { buildTelemetryBody, fireTelemetry, ENDPOINT, APP_ID };
