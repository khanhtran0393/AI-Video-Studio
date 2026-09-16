'use strict';
/**
 * gpu-policy.js — DÒ & CHỌN cấu hình đồ hoạ của main process trên MỌI PC.
 *
 * Luật 10: degrade có chủ đích phải KHAI BÁO RÕ, không fallback ngầm.
 *
 * Bối cảnh (điều tra 2026-09-11j, 2026-09-15r): Chromium 149 trên máy đích
 * (Pascal GTX 1050 Ti + driver R580 582.66, Win10 LTSC 19044) tự chấm
 * dx12FeatureLevel = "Not supported" TRÁI bằng chứng OS rồi tự tắt toàn bộ GPU
 * feature; force GPU bằng --ignore-gpu-blocklist thì crash GPU/Network/renderer
 * (CfT 149). Từ đó app chạy --disable-gpu cứng — đúng cho MÁY ĐÓ, nhưng máy
 * khác có GPU tốt thì bị mất OAN.
 *
 * Thiết kế mới (2026-09-16b): GPU policy 3 lớp, tự dò trên từng máy:
 *   auto     (mặc định, launch đầu) — KHÔNG gắn cờ gì. Sau whenReady ~6s hỏi
 *            app.getGPUFeatureStatus(): gpu_compositing bật → chốt 'gpu'.
 *   force    — Chromium chặn oan → ghi trạng thái, relaunch MỘT lần với
 *            --ignore-gpu-blocklist (khai báo rõ, có chủ đích).
 *   software — force crash GPU process (circuit breaker) hoặc force vô hiệu →
 *            rút lui về --disable-gpu + SwiftShader như cấu hình 2026-09-15r.
 *   gpu      — force/auto ổn định 30s → chốt GPU thật vĩnh viễn cho máy này.
 *  Chế độ 'gpu' vẫn canh crash: ≥2 lần GPU process chết trong 60s → software.
 * Quyết định lưu tại userData/gpu-policy-mode.json (ghi nguyên tử .tmp+rename).
 * Override chẩn đoán: env AI_VIDEO_STUDIO_GPU_POLICY=auto|gpu|force|software
 * (chỉ phiên hiện tại, không ghi đè quyết định đã lưu).
 * Encode video bằng GPU (NVENC/QSV/AMF — editor-pro/gpu-encoder.js) KHÔNG phụ
 * thuộc chính sách này: nó probe ffmpeg riêng, chạy được ở mọi mode.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = 'gpu-policy-mode.json';
const VALID_MODES = ['auto', 'gpu', 'force', 'software'];
const PROBE_DELAY_MS = 6000;     // sau whenReady: đợi GPU process ổn định rồi hỏi status
const PROBE_TIMEOUT_MS = 10000;  // status/getGPUInfo không trả lời → bỏ probe, không đoán
const STABILITY_MS = 30000;      // 'force' sống yên bấy lâu thì chốt 'gpu'
const CRASH_WINDOW_MS = 60000;   // cửa sổ đếm crash GPU process ở chế độ 'gpu'/'auto'
const CRASH_LIMIT = 2;

function defaultState() {
  return { version: 1, mode: 'auto', escalations: 0, decidedAt: null, history: [] };
}

function stateFileOf(app) {
  try { return path.join(app.getPath('userData'), STATE_FILE); } catch (_) { return null; }
}

function pushHistory(st, event, detail) {
  try {
    st.history.push({ at: new Date().toISOString(), event, detail: String(detail || '').slice(0, 200) });
    if (st.history.length > 20) st.history = st.history.slice(-20);
  } catch (_) {}
}

function saveState(app, st, file) {
  const target = file || stateFileOf(app);
  if (!target) return false;
  try {
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(st, null, 2), 'utf8');
    fs.renameSync(tmp, target);
    return true;
  } catch (e) {
    console.warn('[gpu-policy] [LOI] không ghi được ' + STATE_FILE + ':', (e && e.message) || e);
    return false;
  }
}

function loadState(app) {
  const file = stateFileOf(app);
  let st = defaultState();
  if (file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && VALID_MODES.indexOf(parsed.mode) !== -1) {
        st = {
          version: 1,
          mode: parsed.mode,
          escalations: Number(parsed.escalations) || 0,
          decidedAt: parsed.decidedAt || null,
          history: Array.isArray(parsed.history) ? parsed.history.slice(-20) : [],
        };
      } else {
        // Khai báo lộ liễu — không nuốt: file sai dạng thì nói ra rồi dùng 'auto'.
        console.warn('[gpu-policy] trạng thái cũ sai dạng → dùng "auto" (đã khai báo, không fallback ngầm)');
      }
    } catch (e) {
      if (e && e.code !== 'ENOENT') {
        console.warn('[gpu-policy] đọc ' + STATE_FILE + ' lỗi (' + ((e && e.message) || e) + ') → dùng "auto"');
      }
    }
  }
  return { st, file };
}

function say(app, event, detail) {
  try { require('./lifecycle-log').logLifecycle(app, event, detail); } catch (_) {
    console.log('[gpu-policy]', event, detail);
  }
}

function applySwitches(app, mode) {
  try {
    if (mode === 'software') {
      app.commandLine.appendSwitch('disable-gpu');
      // WebGL2 phần mềm (SwiftShader) cho FX shader I-MZic — giữ nguyên cấu hình
      // 2026-09-15r: không đụng driver GPU thật.
      app.commandLine.appendSwitch('use-angle', 'swiftshader');
      app.commandLine.appendSwitch('enable-unsafe-swiftshader');
    } else if (mode === 'force') {
      app.commandLine.appendSwitch('ignore-gpu-blocklist');
    }
    // 'auto' / 'gpu': KHÔNG gắn cờ — Chromium tự dùng GPU thật nếu máy cho phép.
  } catch (e) {
    console.warn('[gpu-policy] [LOI] không gắn được cờ đồ hoạ:', (e && e.message) || e);
  }
}

function setMode(app, st, file, mode, why) {
  const from = st.mode;
  st.mode = mode;
  if (mode !== 'auto') st.decidedAt = new Date().toISOString();
  pushHistory(st, 'mode:' + from + '->' + mode, why);
  saveState(app, st, file);
  say(app, 'gpu-policy-mode', 'mode=' + from + '->' + mode + ' (' + why + ')');
  console.log('[gpu-policy] chế độ đồ hoạ: ' + from + ' -> ' + mode + ' — ' + why);
  return from !== mode;
}

function relaunch(app, reason) {
  if (app.isQuitting) return;
  try {
    say(app, 'gpu-policy-relaunch', reason);
    app.relaunch({ args: process.argv.slice(1) });
    app.quit();
  } catch (e) {
    console.warn('[gpu-policy] [LOI] relaunch thất bại (' + reason + '):', (e && e.message) || e);
  }
}

function withTimeout(p, ms) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => { setTimeout(() => rej(new Error('timeout ' + ms + 'ms')), ms); }),
  ]);
}

async function probeGpu(app, st, file) {
  let status = null;
  try {
    const raw = app.getGPUFeatureStatus();
    status = (raw && typeof raw.then === 'function') ? await withTimeout(raw, PROBE_TIMEOUT_MS) : raw;
  } catch (e) {
    // Probe lỗi/timeout: KHÔNG đoán, giữ nguyên chế độ hiện tại và nói rõ ra log.
    say(app, 'gpu-policy-probe', 'mode=' + st.mode + ' LOI status=' + ((e && e.message) || e));
    return;
  }
  if (!status || typeof status !== 'object') {
    say(app, 'gpu-policy-probe', 'mode=' + st.mode + ' status KHONG HOP LE');
    return;
  }
  let gpuInfo = '?';
  try {
    const gi = await withTimeout(Promise.resolve(app.getGPUInfo('basic')), PROBE_TIMEOUT_MS);
    if (gi && Array.isArray(gi.gpuDevice) && gi.gpuDevice.length) {
      gpuInfo = gi.gpuDevice.map((d) => String(d.vendor || d.vendorId || '?') + '/' + String(d.device || d.deviceId || '?')).join('|');
    }
  } catch (_) {}
  const compose = String(status.gpu_compositing || '');
  const webgl = String(status.webgl || '');
  const enabled = compose.indexOf('enabled') === 0;
  say(app, 'gpu-policy-probe', 'mode=' + st.mode + ' gpu_compositing=' + compose + ' webgl=' + webgl + ' gpu=' + gpuInfo);

  if (st.mode === 'auto') {
    if (enabled) {
      setMode(app, st, file, 'gpu', 'GPU that hoat dong (Chromium cho phép) — chốt dùng GPU');
    } else if (st.escalations < 1) {
      st.escalations += 1;
      if (setMode(app, st, file, 'force', 'Chromium chan GPU (' + compose + ') — thử MỘT lần --ignore-gpu-blocklist')) {
        relaunch(app, 'escalate auto->force');
      }
    } else {
      if (setMode(app, st, file, 'software', 'Chromium van chan GPU sau khi force — chốt software SwiftShader')) {
        relaunch(app, 'escalate auto->software');
      }
    }
  } else if (st.mode === 'force') {
    if (enabled) {
      // Force có hiệu lực: đợi cửa sổ ổn định rồi mới chốt, tránh chờ crash đến nơi.
      setTimeout(() => {
        if (st.mode === 'force') {
          setMode(app, st, file, 'gpu', 'force on dinh ' + (STABILITY_MS / 1000) + 's — chốt GPU thật cho máy này');
        }
      }, STABILITY_MS);
    } else {
      if (setMode(app, st, file, 'software', 'force vo hieu (' + compose + ') — chốt software SwiftShader')) {
        relaunch(app, 'force->software (vo hieu)');
      }
    }
  }
  // mode 'gpu': đã quyết — chỉ log, không đổi gì.
}

function installGpuPolicy(app) {
  let st;
  let file = null;
  try {
    const loaded = loadState(app);
    st = loaded.st;
    file = loaded.file;
  } catch (e) {
    st = defaultState();
    console.warn('[gpu-policy] [LOI] không nạp được trạng thái:', (e && e.message) || e);
  }

  // Override chẩn đoán (tiền tố env đúng Luật 3): chỉ phiên này, không ghi đè file.
  const envMode = process.env.AI_VIDEO_STUDIO_GPU_POLICY;
  if (envMode && VALID_MODES.indexOf(envMode) !== -1) {
    st.mode = envMode;
    console.log('[gpu-policy] override AI_VIDEO_STUDIO_GPU_POLICY=' + envMode + ' (chỉ phiên này)');
  }

  // Chia sẻ trạng thái cho module main khác qua state.js (check:shared), không global.
  try {
    const state = require('./state');
    state.gpuPolicy = { mode: st.mode, decidedAt: st.decidedAt, escalations: st.escalations };
  } catch (_) {}

  applySwitches(app, st.mode);
  console.log('[gpu-policy] mode=' + st.mode + ' (auto=thử GPU thật · gpu=GPU thật · force=ignore-blocklist · software=SwiftShader) — khai báo lộ liễu, quyết định lưu ở ' + STATE_FILE);
  say(app, 'gpu-policy-mode', 'khoi dong mode=' + st.mode + ' escalations=' + st.escalations);

  // Circuit breaker: GPU process chết là bằng chứng MẠNH hơn mọi lý thuyết blocklist.
  const gpuCrashTimes = [];
  app.on('child-process-gone', (_e, d) => {
    const tag = String((d && d.type) || '') + ' ' + String((d && d.name) || '');
    if (!/gpu/i.test(tag)) return;
    const now = Date.now();
    gpuCrashTimes.push(now);
    while (gpuCrashTimes.length && now - gpuCrashTimes[0] > CRASH_WINDOW_MS) gpuCrashTimes.shift();
    const detail = (d && d.reason ? d.reason : '?') + ' exit=' + (d && d.exitCode);
    if (st.mode === 'force') {
      say(app, 'gpu-policy-crash-guard', 'GPU process crash o che do force (' + detail + ') → rút lui về software');
      if (setMode(app, st, file, 'software', 'GPU process crash khi force (' + detail + ') — máy này không chịu GPU thật')) {
        relaunch(app, 'crash-guard force->software');
      }
    } else if (gpuCrashTimes.length >= CRASH_LIMIT) {
      say(app, 'gpu-policy-crash-guard', CRASH_LIMIT + ' lan crash GPU process trong ' + (CRASH_WINDOW_MS / 1000) + 's (' + detail + ') → rút lui về software');
      if (setMode(app, st, file, 'software', CRASH_LIMIT + ' lần crash GPU process trong ' + (CRASH_WINDOW_MS / 1000) + 's (' + detail + ')')) {
        relaunch(app, 'crash-guard ->software');
      }
    }
  });

  app.whenReady().then(() => {
    setTimeout(() => {
      probeGpu(app, st, file).catch((e) => {
        say(app, 'gpu-policy-probe', 'LOI khong du doan: ' + ((e && e.message) || e));
      });
    }, PROBE_DELAY_MS);
  }).catch((e) => {
    console.warn('[gpu-policy] [LOI] whenReady:', (e && e.message) || e);
  });
}

module.exports = { installGpuPolicy };
