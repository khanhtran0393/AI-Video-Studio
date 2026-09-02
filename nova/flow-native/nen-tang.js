/* ── Tách từ flow-native.plain.js — nền tảng: hằng số endpoint + kho account (Map) + persist/restore file
     + acctSession/hookToken + helpers thuần (deepFindProjectId, extractApiError).
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Flow Native — bê logic từ extension flow-image-gen vào tiến trình chính Electron.
 * Mỗi tài khoản Flow = 1 BrowserWindow ẩn với session (partition) + proxy RIÊNG:
 *   - Load https://labs.google/fx/tools/flow (đăng nhập Google trong cửa sổ đó).
 *   - Bắt Bearer token ya29.* qua session.webRequest.
 *   - Giải reCAPTCHA Enterprise qua webContents.executeJavaScript(grecaptcha).
 *   - Gọi API bằng fetch NGAY TRONG TRANG (đúng origin labs.google, đúng cookie/proxy).
 * Router handle(action,payload) mô phỏng đúng giao thức extension để UI dùng y như cũ.
 */

const FLOW_API_BASE       = 'https://aisandbox-pa.googleapis.com';
const FLOW_API_KEY        = 'AIzaSyBtrm0o5ab1c-Ec8ZuLcGt3oJAA5VWt3pY';
const CREDITS_URL         = `${FLOW_API_BASE}/v1/credits`;
const TRPC_CREATE_PROJECT = 'https://labs.google/fx/api/trpc/project.createProject';
const UPLOAD_IMAGE_URL    = `${FLOW_API_BASE}/v1/flow/uploadImage`;
const FLOW_TAB_URL        = 'https://labs.google/fx/tools/flow';
const SITE_KEY            = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
const CAPTCHA_IMAGE       = 'IMAGE_GENERATION';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// account: { id, partition, email, token, tier, credits, proxy, win }
const accounts = new Map();

function storeFile() { return path.join(app.getPath('userData'), 'flow-accounts.json'); }

function persist() {
  try {
    const data = S.order.map((id) => {
      const a = accounts.get(id);
      return a.engine === 'chrome' ? null : { id: a.id, email: a.email, tier: a.tier, credits: a.credits, proxy: a.proxy || null, enabled: a.enabled !== false, cookieExpiry: a.cookieExpiry || null };
    }).filter(Boolean);
    fs.writeFileSync(storeFile(), JSON.stringify({ nextId: S.nextId, accounts: data }, null, 2));
  } catch (e) { console.warn('[flow] persist lỗi:', e.message); }
}

function acctSession(a) { return session.fromPartition(a.partition); }

function hookToken(a) {
  const ses = acctSession(a);
  if (ses.__flowHooked) return;
  ses.__flowHooked = true;
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
    (details, cb) => {
      const hs = details.requestHeaders || {};
      const key = Object.keys(hs).find((k) => k.toLowerCase() === 'authorization');
      const val = key ? hs[key] : '';
      if (typeof val === 'string' && val.startsWith('Bearer ya29.')) {
        a.token = val.replace(/^Bearer\s+/i, '').trim();
      }
      cb({ requestHeaders: hs });
    },
  );
}

// Tìm sâu 'projectId' trong mọi cấu trúc phản hồi (object/array lồng nhau).
function deepFindProjectId(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return null;
  if (typeof obj.projectId === 'string' && obj.projectId) return obj.projectId;
  for (const k of Object.keys(obj)) {
    const v = deepFindProjectId(obj[k], depth + 1);
    if (v) return v;
  }
  return null;
}

// ── Lỗi API ────────────────────────────────────────────────────────────
function extractApiError(data) {
  const err = data && typeof data === 'object' ? data.error : null;
  if (!err || typeof err !== 'object') return null;
  const reason = (err.details || []).map((d) => d && d.reason).find(Boolean);
  const msg = err.message || err.status || 'API error';
  return reason ? `${reason}: ${msg}` : String(msg);
}

module.exports = { sleep, FLOW_API_BASE, FLOW_API_KEY, CREDITS_URL, TRPC_CREATE_PROJECT, UPLOAD_IMAGE_URL, FLOW_TAB_URL, SITE_KEY, CAPTCHA_IMAGE, accounts, storeFile, persist, acctSession, hookToken, deepFindProjectId, extractApiError };