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
    actions: ['ping', 'status', 'focus'],
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

const ACTIONS = { ping: actionPing, status: actionStatus, focus: actionFocus };

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
    const data = fn(parsed.params || {});
    return sendJson(res, 200, { ok: true, data });
  } catch (e) {
    // Lỗi nghiệp vụ (vd chưa có cửa sổ) — lộ liễu kèm error code (Luật 10).
    return sendJson(res, 409, {
      ok: false,
      error: { code: e.code || 'AVS_AGENT_ACTION_FAILED', message: e.message },
    });
  }
}

module.exports = { handleAgentCommand, AGENT_COMMAND_PATH };
