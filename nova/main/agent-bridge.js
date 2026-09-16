'use strict';
/**
 * Agent Bridge — cửa ngõ HTTP cho AI agent ngoài (Zisu_AI) gửi lệnh vào app.
 *
 * - Route: POST /agent/command (được gắn vào local server 127.0.0.1 trong server.js).
 * - Body JSON: { "action": "<tên>", "params": { ... } }
 * - Phản hồi: { ok: true, data: ... } | { ok: false, error: { code, message } }
 * - Luật 10 (không fallback ngầm): mọi lỗi trả error code lộ liễu, không nuốt.
 *
 * Action hiện có:
 *   - ping   : xác nhận app đang chạy, trả danh sách action hợp lệ.
 *   - status : trạng thái runtime (cửa sổ chính, port server).
 *   - focus  : hiện & focus cửa sổ chính.
 *   - app.eval : chạy 1 script trong renderer cửa sổ chính qua
 *     webContents.executeJavaScript. Mặc định TẮT — phải bật bằng env
 *     AI_VIDEO_STUDIO_AGENT_EVAL=1 khi khởi động app. Dùng cho E2E tự động
 *     (CDP verify T7…). Kết quả được chuẩn hoá JSON-safe, mọi lỗi ném ra
 *     từ script được bọc thành { ok: false, error: { name, message, stack } }.
 *   - browser.* : điều khiển Chrome flow-chrome ĐANG CHẠY qua CDP (navigate/
 *     click/type/scroll/wait_for/eval/list_tabs/screenshot + record.start/
 *     record.stop/cancel) — ủy thác cho nova/flow-chrome/browser-agent.js.
 *     Mọi action browser.* là ASYNC: handleAgentCommand await kết quả.
 */
const state = require('./state');

// Giới hạn kích thước body để bridge không trở thành điểm tràn bộ nhớ.
const MAX_BODY_BYTES = 64 * 1024;

const AGENT_COMMAND_PATH = '/agent/command';

function sendJson(res, httpCode, obj) {
  res.writeHead(httpCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        const e = new Error('Body vượt giới hạn ' + MAX_BODY_BYTES + ' bytes');
        e.code = 'AVS_AGENT_BODY_TOO_LARGE';
        reject(e);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', (e) => {
      if (!e.code) e.code = 'AVS_AGENT_BODY_READ_FAILED';
      reject(e);
    });
  });
}

// ── Action: mỗi hàm (params) => data, lỗi thì throw Error có .code ──

function actionPing() {
  return {
    app: 'AI Video Studio',
    commandPath: AGENT_COMMAND_PATH,
    actions: Object.keys(ACTIONS),
  };
}

function actionStatus() {
  return {
    mainWindow: !!(state.mainWindow && !state.mainWindow.isDestroyed()),
    serverPort: state.serverPort,
    isQuitting: state.isQuitting,
  };
}

function actionFocus() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) {
    const e = new Error('Cửa sổ chính chưa được tạo hoặc đã đóng — không thể focus.');
    e.code = 'AVS_AGENT_NO_WINDOW';
    throw e;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return { focused: true };
}

// ── app.eval: chạy 1 script trong renderer cửa sổ chính. Dùng cho E2E tự động
// (CDP verify T7, …). Mặc định KHÔNG bật khi khởi động — bật qua env
// AI_VIDEO_STUDIO_AGENT_EVAL=1, nếu không có thì trả 403 lộ liễu.
// Giới hạn: script ≤ 4096 byte, đơn biến string, timeout 10s, không truyền
// userGesture. Kết quả được JSON.stringify-safe (chỉ trả JSON an toàn, không
// trả DOM node/function).
const APP_EVAL_MAX_BYTES = 4096;
const APP_EVAL_TIMEOUT_MS = 10000;
function appEvalEnabled() {
  return process.env.AI_VIDEO_STUDIO_AGENT_EVAL === '1';
}
function safeStringify(v) {
  // Trả về JSON-safe string. Hàm → mô tả ngắn; DOM node → tagName; circular → '[Circular]';
  // mọi thứ khác → JSON.stringify fallback. Throw nếu không an toàn.
  const seen = new WeakSet();
  const replacer = (_k, val) => {
    if (typeof val === 'function') return '[Function]';
    if (typeof val === 'bigint') return val.toString() + 'n';
    if (typeof val === 'undefined') return null;
    if (val && typeof val === 'object') {
      if (typeof Element !== 'undefined' && val instanceof Element) {
        return '[Element ' + (val.tagName || '?') + ']';
      }
      if (typeof val.nodeType === 'number' && typeof val.tagName === 'string') {
        // DOM node (main process không có Element, nhưng kết quả executeJavaScript
        // có thể chứa DOM node) → mô tả ngắn.
        return '[DOM ' + val.tagName + ']';
      }
      if (val instanceof Error) return { name: val.name, message: val.message, code: val.code };
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  };
  try {
    return JSON.parse(JSON.stringify(v, replacer));
  } catch (e) {
    throw Object.assign(new Error('Kết quả không serialize được: ' + e.message), {
      code: 'AVS_AGENT_EVAL_UNSERIALIZABLE',
    });
  }
}
async function actionAppEval(params) {
  if (!appEvalEnabled()) {
    const e = new Error('app.eval đang tắt. Bật bằng env AI_VIDEO_STUDIO_AGENT_EVAL=1 khi khởi động app.');
    e.code = 'AVS_AGENT_EVAL_DISABLED';
    throw e;
  }
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) {
    const e = new Error('Cửa sổ chính chưa được tạo hoặc đã đóng — không thể eval.');
    e.code = 'AVS_AGENT_NO_WINDOW';
    throw e;
  }
  const script = params && typeof params.script === 'string' ? params.script : '';
  if (!script) {
    const e = new Error('Thiếu trường "script" (string) trong params.');
    e.code = 'AVS_AGENT_EVAL_BAD_SCRIPT';
    throw e;
  }
  if (Buffer.byteLength(script, 'utf8') > APP_EVAL_MAX_BYTES) {
    const e = new Error('Script vượt ' + APP_EVAL_MAX_BYTES + ' bytes.');
    e.code = 'AVS_AGENT_EVAL_TOO_LARGE';
    throw e;
  }
  const wc = win.webContents;
  // Inline script bằng JSON.stringify để chèn an toàn (escape \ " \n \r \u2028
  // \u2029 đúng chuẩn JSON). Đây là cách an toàn nhất để nhúng chuỗi user
  // vào body code mà không qua closure (closure của main process bị mất khi
  // executeJavaScript nhận string ở renderer).
  const scriptLiteral = JSON.stringify(script);
  const task = wc.executeJavaScript(
    '(async () => { try { return await (eval(' + scriptLiteral + ')); }' +
    ' catch (e) { return { __err: { name: e && e.name, message: e && e.message, stack: e && e.stack } }; } })()',
    false
  );
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      const e = new Error('Script vượt quá ' + APP_EVAL_TIMEOUT_MS + 'ms — đã huỷ.');
      e.code = 'AVS_AGENT_EVAL_TIMEOUT';
      reject(e);
    }, APP_EVAL_TIMEOUT_MS);
  });
  let raw;
  try {
    raw = await Promise.race([task, timeout]);
  } catch (e) {
    if (e && e.code === 'AVS_AGENT_EVAL_TIMEOUT') {
      // Cố gắng ngắt script thông qua việc hủy promise; executeJavaScript của
      // Electron không có abort, nhưng timeout đã reject task — lỗi đã lộ ra.
      throw e;
    }
    const wrapped = new Error('executeJavaScript thất bại: ' + (e && e.message || e));
    wrapped.code = e && e.code ? e.code : 'AVS_AGENT_EVAL_FAILED';
    throw wrapped;
  }
  // Phân biệt kết quả lỗi do script ném ra (đã được bọc thành __err).
  if (raw && typeof raw === 'object' && raw.__err) {
    return { ok: false, error: raw.__err };
  }
  return { ok: true, result: safeStringify(raw) };
}

// ── Browser agent: ủy thác cho nova/flow-chrome/browser-agent.js ─────
// Lazy-require BÊN TRONG hàm (không nạp flow-chrome khi server khởi động,
// và để test Node thuần đi được nhánh lỗi không cần Electron).
function browserAgent() { return require('../flow-chrome/browser-agent'); }

function browserAction(commandName) {
  return (params) => browserAgent().run(commandName, params || {});
}

const ACTIONS = {
  ping: actionPing,
  status: actionStatus,
  focus: actionFocus,
  'browser.navigate': browserAction('NAVIGATE'),
  'browser.click': browserAction('CLICK'),
  'browser.type': browserAction('TYPE'),
  'browser.scroll': browserAction('SCROLL'),
  'browser.wait_for': browserAction('WAIT_FOR'),
  'browser.eval': browserAction('EVAL'),
  'browser.list_tabs': browserAction('LIST_TABS'),
  'browser.screenshot': browserAction('CAPTURE_TAB'),
  'browser.record.start': browserAction('RECORD_START'),
  'browser.record.stop': browserAction('RECORD_STOP'),
  'browser.cancel': browserAction('CANCEL'),
  'app.eval': actionAppEval,
};

async function handleAgentCommand(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: { code: 'AVS_AGENT_METHOD_NOT_ALLOWED', message: 'Chỉ chấp nhận POST ' + AGENT_COMMAND_PATH },
    });
  }
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return sendJson(res, 413, {
      ok: false,
      error: { code: e.code || 'AVS_AGENT_BODY_READ_FAILED', message: e.message },
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch (e) {
    return sendJson(res, 400, {
      ok: false,
      error: { code: 'AVS_AGENT_BAD_JSON', message: 'Body không phải JSON hợp lệ: ' + e.message },
    });
  }
  const action = parsed && typeof parsed.action === 'string' ? parsed.action : '';
  if (!action) {
    return sendJson(res, 400, {
      ok: false,
      error: { code: 'AVS_AGENT_NO_ACTION', message: 'Thiếu trường "action" trong body.' },
    });
  }
  const fn = ACTIONS[action];
  if (!fn) {
    return sendJson(res, 400, {
      ok: false,
      error: {
        code: 'AVS_AGENT_UNKNOWN_ACTION',
        message: 'Action "' + action + '" không tồn tại. Hợp lệ: ' + Object.keys(ACTIONS).join(', '),
      },
    });
  }
  try {
    const data = await fn(parsed.params || {});
    return sendJson(res, 200, { ok: true, data });
  } catch (e) {
    // Lỗi nghiệp vụ — lộ liễu kèm error code (Luật 10).
    // browser.* : nếu còn phiên ghi hình đang chạy → đóng + trả WebM kèm lỗi
    // (dữ liệu phục hồi, KHÔNG che lỗi gốc).
    let recording = null;
    if (action.indexOf('browser.') === 0) {
      try { recording = await browserAgent().finalizeOnError(); } catch (_) { recording = null; }
    }
    return sendJson(res, 409, {
      ok: false,
      error: Object.assign(
        { code: e.code || 'AVS_AGENT_ACTION_FAILED', message: e.message },
        recording ? { recording } : {}
      ),
    });
  }
}

module.exports = { handleAgentCommand, AGENT_COMMAND_PATH };
