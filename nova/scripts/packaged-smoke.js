'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { CdpClient } = require('./smoke-cdp');
const { runMcpChecks } = require('./smoke-mcp');
const { acquirePipelineLock } = require('./pipeline-lock');
const {
  appExeRows, closeServer, descendants, findPackagedExe, forceKill, httpJson, isPortOpen,
  killAppExes, listen, processTable, redact, sleep, waitForJson, waitForPort,
} = require('./smoke-runtime');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXED_PORTS = [8793, 8794, 8795, 8796];
const MOCK_KEY = 'smoke-secret-loopback-only';
const OUTPUT_MARKER = 'NOVA_SMOKE_UI_OUTPUT_2026';
const MOCK_CONTENT = '```text\n' + OUTPUT_MARKER + ' confirms that the packaged renderer reached the loopback OpenAI-compatible API through Electron IPC.\n\nThe response was parsed, cleaned, and written into the real script output control.\n```';
// tooladmin chỉ mở cho admin; clean profile không có admin nên tab này được phép không kích hoạt.
const OPTIONAL_ACTIVATION_TOOLS = new Set(['tooladmin']);

// Console error benign đã biết của Electron khi DevTools/CDP gắn vào renderer
// sandboxed (sandbox_bundle ném "preloadScripts ... null" trong target DevTools).
// Xuất hiện ngay cả ở các run hoàn toàn khoẻ (VD: 2026-09-02T03-12 pass) nên
// không được tính là lỗi app.
const KNOWN_BENIGN_CONSOLE_ERRORS = [
  /^error: Electron sandboxed_renderer\.bundle\.js script failed to run$/,
  /^error: TypeError: Cannot destructure property 'preloadScripts' of 'binding\.startupData' as it is null\./,
];
const isRendererConsoleError = (line) =>
  String(line).startsWith('error') && !KNOWN_BENIGN_CONSOLE_ERRORS.some((re) => re.test(String(line)));

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function deepRedact(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(deepRedact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRedact(item)]));
  return value;
}

function startMock() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body || '{}'); } catch (_) {}
      const authOkay = req.headers.authorization === 'Bearer ' + MOCK_KEY;
      requests.push({
        method: req.method,
        path: req.url,
        authOkay,
        model: parsed?.model || null,
        messageCount: Array.isArray(parsed?.messages) ? parsed.messages.length : 0,
        maxTokens: parsed?.max_tokens || parsed?.max_completion_tokens || null,
      });
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'not found' } }));
      }
      if (!parsed || !authOkay) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'smoke authentication failed' } }));
      }
      const response = {
        id: 'smoke-loopback', object: 'chat.completion', created: 0, model: parsed.model,
        choices: [{ index: 0, message: { role: 'assistant', content: MOCK_CONTENT }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 25, completion_tokens: 35, total_tokens: 60 },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  });
  return { server, requests };
}

/**
 * Clean-room environment: mô phỏng máy trắng / user mới cài.
 * - PATH đúng bằng PATH chuẩn của Windows mới cài: system32, Windows, Wbem,
 *   WindowsPowerShell\v1.0 và OpenSSH — powershell.exe phải gọi được (unzip
 *   Chrome-for-Testing của flow dùng Expand-Archive qua powershell); vẫn KHÔNG
 *   chứa node/python/ffmpeg/claude… → app không thể "ăn nhờ" dev tools.
 * - USERPROFILE trỏ vào profile riêng của run, có đủ cấu trúc như profile
 *   Windows thật: AppData\Roaming + AppData\Local\Temp (Electron suy ra appData
 *   từ USERPROFILE — thiếu AppData\Roaming thì getPath('appData') ném lỗi và app
 *   crash) + Downloads + Videos (known-folder mà 'export-dir' đọc).
 * - APPDATA/LOCALAPPDATA/TEMP/TMP trỏ đồng nhất vào các thư mục con đó.
 * - Không kế thừa biến môi trường dev (NOVA_STUDIO_DEV_URL, proxy, v.v.).
 */
function buildCleanEnv(profileRoot) {
  const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const restrictedPath = [
    path.join(systemRoot, 'System32'),
    systemRoot,
    path.join(systemRoot, 'System32', 'Wbem'),
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
    path.join(systemRoot, 'System32', 'OpenSSH'),
  ].join(path.delimiter);
  const userprofile = path.join(profileRoot, 'userprofile');
  const roaming = path.join(userprofile, 'AppData', 'Roaming');
  const local = path.join(userprofile, 'AppData', 'Local');
  const temp = path.join(local, 'Temp');
  const downloads = path.join(userprofile, 'Downloads');
  const videos = path.join(userprofile, 'Videos');
  for (const dir of [roaming, local, temp, downloads, videos]) fs.mkdirSync(dir, { recursive: true });
  return {
    SystemRoot: systemRoot,
    windir: systemRoot,
    SYSTEMDRIVE: process.env.SYSTEMDRIVE || 'C:',
    PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD',
    OS: process.env.OS || 'Windows_NT',
    NUMBER_OF_PROCESSORS: String(process.env.NUMBER_OF_PROCESSORS || 4),
    PROCESSOR_ARCHITECTURE: process.env.PROCESSOR_ARCHITECTURE || 'AMD64',
    COMPUTERNAME: process.env.COMPUTERNAME || 'NOVA-CLEANROOM',
    USERNAME: 'CleanRoom',
    PATH: restrictedPath,
    USERPROFILE: userprofile,
    APPDATA: roaming,
    LOCALAPPDATA: local,
    TEMP: temp,
    TMP: temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    ELECTRON_ENABLE_LOGGING: '1',
  };
}

// Tự kiểm tra: với PATH đã hạn chế, where.exe PHẢI KHÔNG tìm thấy dev tools.
// Nếu tìm thấy thì clean-room không sạch → hủy chạy thay vì ra kết quả giả.
function assertCleanPath(restrictedPath) {
  const tools = ['node.exe', 'python.exe', 'ffmpeg.exe', 'claude.exe', 'codex.exe'];
  return Promise.all(tools.map((tool) => new Promise((resolve) => {
    execFile('where.exe', [tool], { env: { PATH: restrictedPath, SystemRoot: process.env.SystemRoot || 'C:\\Windows' }, windowsHide: true }, (error) => resolve({ tool, leaked: !error }));
  }))).then((results) => {
    const leaked = results.filter((item) => item.leaked);
    if (leaked.length) {
      throw new Error(`Clean-room PATH is not clean; dev tools still resolvable: ${leaked.map((item) => item.tool).join(', ')}.`);
    }
    return { ok: true, checked: results.map((item) => item.tool) };
  });
}

/**
 * Quét toàn bộ tool nav của app như người dùng thật: click từng tab, chờ panel
 * kích hoạt, ghi lại mọi exception/console-error phát sinh trong lúc init của
 * tool đó. Video Agent hiện là wizard (không còn lưới 12 panel cũ), nên contract
 * là đủ bốn bước dễ cùng các control đầu/cuối; chế độ nâng cao có thêm ba bước.
 */
async function runToolSweep(cdp, report) {
  const tools = await cdp.evaluate(`(() => [...document.querySelectorAll('.nav-item[data-tool]')].map((el) => el.dataset.tool))()`);
  if (!Array.isArray(tools) || tools.length < 10) {
    throw new Error(`Expected the full tool navigation in packaged UI, found: ${JSON.stringify(tools)}`);
  }
  const results = [];
  for (const tool of tools) {
    const excBefore = report.diagnostics.rendererExceptions.length;
    const errBefore = report.diagnostics.rendererConsole.filter(isRendererConsoleError).length;
    await cdp.click(`[data-tool="${tool}"]`);
    if (OPTIONAL_ACTIVATION_TOOLS.has(tool)) {
      await sleep(300);
      const active = await cdp.evaluate(`(() => { const el = document.getElementById(${JSON.stringify('tool-' + tool)}); return !!el && el.classList.contains('active'); })()`);
      results.push({ tool, activated: active, optional: true });
      continue;
    }
    await cdp.waitFor(`(() => { const el = document.getElementById(${JSON.stringify('tool-' + tool)}); return !!el && el.classList.contains('active'); })()`, `tool ${tool} activation`, 5000);
    await sleep(400);   // cho các hàm init của tool (voiceInit, nicheInit, animInit…) chạy bậc async
    const exceptions = report.diagnostics.rendererExceptions.slice(excBefore);
    const consoleErrors = report.diagnostics.rendererConsole.filter(isRendererConsoleError).slice(errBefore);
    results.push({ tool, activated: true, exceptions, consoleErrors });
  }
  const videoAgentWizard = await cdp.evaluate(`(() => {
    const root = document.querySelector('#videoAgentRoot');
    const boxes = root ? [...root.children].filter((el) => !el.classList.contains('va-notice') && !el.classList.contains('va-tabs')) : [];
    return {
      totalSteps: root?.querySelectorAll('.va-step').length || 0,
      easySteps: boxes[0]?.querySelectorAll('.va-step').length || 0,
      advancedSteps: boxes[1]?.querySelectorAll('.va-step').length || 0,
      titleInput: !!root?.querySelector('#vaTitle'),
      runButton: !!root?.querySelector('#vaRunBtn'),
      result: !!root?.querySelector('#vaResult'),
    };
  })()`);
  return { tools: results, videoAgentWizard };
}

async function closeApp(cdp, child) {
  if (cdp) {
    try { await cdp.send('Browser.close', {}, 5000); } catch (_) {}
  }
  const deadline = Date.now() + 15000;
  while (child && child.exitCode === null && Date.now() < deadline) await sleep(200);
}

async function main() {
  const startedAt = new Date();
  const runDir = path.join(ROOT, 'smoke-results', stamp());
  const profileRoot = path.join(runDir, 'profile');
  fs.mkdirSync(profileRoot, { recursive: true });

  const report = {
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    root: ROOT,
    runDir,
    status: 'running',
    checks: {},
    diagnostics: { rendererConsole: [], rendererExceptions: [], appStdout: '', appStderr: '' },
  };
  let child = null;
  let cdp = null;
  let mock = null;
  let appPids = [];
  let releaseLock = null;

  try {
    // Mutex với mọi run khác cùng chạm app/dist/ports (smoke, e2e, build):
    // chờ hàng đợi thay vì chạy song song rồi giết nhau (e2e 04-57-03Z).
    releaseLock = await acquirePipelineLock('packaged-smoke');
    report.checks.pipelineLock = { ok: true, label: 'packaged-smoke' };

    report.executable = findPackagedExe(ROOT, process.env.NOVA_SMOKE_EXE || process.argv[2]);
    report.installDir = path.dirname(report.executable);

    // Single-instance lock là "kẻ giết im lặng": 1 instance cũ còn sống giữ lock thì
    // instance mới exit ngay lập tức, 0 output, ports chết — khó debug. Chặn sớm.
    const runningRows = appExeRows(await processTable(), report.installDir);
    if (runningRows.length) {
      throw new Error(
        `Smoke preflight refused to start: ${runningRows.length} packaged-app process(es) already running `
        + `(PID ${runningRows.map((r) => r.processId || r.ProcessId).join(', ')}) — they hold the single-instance lock `
        + `and would make the new instance exit silently. Kill them first.`
      );
    }
    report.checks.preflightNoRunningApp = { ok: true };

    const occupied = [];
    for (const port of FIXED_PORTS) if (await isPortOpen(port)) occupied.push(port);
    if (occupied.length) throw new Error(`Smoke preflight refused to disturb occupied Nova ports: ${occupied.join(', ')}.`);
    report.checks.preflightPorts = { ok: true, closed: FIXED_PORTS };

    const env = buildCleanEnv(profileRoot);
    report.checks.cleanRoom = { ok: true, ...(await assertCleanPath(env.PATH)), path: env.PATH };

    // Seed Chrome-for-Testing vào profile sạch nếu máy có sẵn bản ghim: profile mới →
    // flow-cft sẽ tự tải ~180MB từ mạng (chậm, phụ thuộc mạng). Đây chỉ là binary
    // cache (không phải app state/cookie) — code path cachedCft() vẫn được test; muốn
    // test cả nhánh tải về thì unset NOVA_SMOKE_CFT_SEED và xoá seed mặc định.
    const cftSeedSource = process.env.NOVA_SMOKE_CFT_SEED
      || path.join(process.env.APPDATA || '', 'AI Video Studio Independent', 'cft');
    const cftSeedTarget = path.join(profileRoot, 'userprofile', 'AppData', 'Roaming', 'AI Video Studio Independent', 'cft');
    report.checks.cftSeed = { ok: true, seeded: false };
    try {
      if (fs.existsSync(path.join(cftSeedSource, 'PINNED_VERSION'))) {
        fs.cpSync(cftSeedSource, cftSeedTarget, { recursive: true });
        report.checks.cftSeed = { ok: true, seeded: true, from: cftSeedSource };
      }
    } catch (e) { report.checks.cftSeed = { ok: false, seeded: false, error: redact(e.message) }; }

    mock = startMock();
    const mockPort = await listen(mock.server, 0);
    const discoveryServer = http.createServer();
    const cdpPort = await listen(discoveryServer, 0);
    await closeServer(discoveryServer);
    report.mock = { baseUrl: `http://127.0.0.1:${mockPort}`, port: mockPort };
    report.cdpPort = cdpPort;

    child = spawn(report.executable, [`--remote-debugging-port=${cdpPort}`, '--no-first-run'], {
      cwd: report.installDir, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk) => { report.diagnostics.appStdout = (report.diagnostics.appStdout + redact(chunk)).slice(-16000); });
    child.stderr?.on('data', (chunk) => { report.diagnostics.appStderr = (report.diagnostics.appStderr + redact(chunk)).slice(-16000); });
    child.once('error', (error) => { report.diagnostics.spawnError = error.message; });
    report.app = { rootPid: child.pid };
    for (const port of FIXED_PORTS) await waitForPort(port, true, 30000);
    const health = await waitForJson('http://127.0.0.1:8794/health', (value) => value?.ok === true, 10000);
    report.checks.bridgeStartup = { ok: true, ports: FIXED_PORTS, mcpHealth: health };

    const target = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`, (targets) =>
      Array.isArray(targets) && targets.find((item) => item.type === 'page' && /\/index\.html(?:$|[?#])/.test(item.url || '')), 45000);
    const page = target.find((item) => item.type === 'page' && /\/index\.html(?:$|[?#])/.test(item.url || ''));
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    cdp.on('Runtime.consoleAPICalled', (event) => {
      const line = (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' ');
      report.diagnostics.rendererConsole.push(redact(`${event.type}: ${line}`).slice(0, 1000));
      report.diagnostics.rendererConsole = report.diagnostics.rendererConsole.slice(-80);
    });
    cdp.on('Runtime.exceptionThrown', (event) => {
      report.diagnostics.rendererExceptions.push(redact(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'renderer exception').slice(0, 2000));
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-tool="toolsettings"]')`, 'Nova UI readiness', 30000);
    report.checks.uiReady = { ok: true, url: page.url, title: page.title };

    // Quét UI như người dùng thật: click toàn bộ 11 tool, bắt lỗi từng tool.
    const sweep = await runToolSweep(cdp, report);
    const sweepFailures = sweep.tools.filter((entry) => (entry.exceptions && entry.exceptions.length) || (entry.consoleErrors && entry.consoleErrors.length));
    const wizard = sweep.videoAgentWizard || {};
    if (wizard.easySteps !== 4 || wizard.advancedSteps < 1 || wizard.totalSteps !== wizard.easySteps + wizard.advancedSteps
      || !wizard.titleInput || !wizard.runButton || !wizard.result) {
      throw new Error(`Video Agent wizard regression: expected four easy steps, advanced steps, and primary controls; found ${JSON.stringify(wizard)}.`);
    }
    if (sweepFailures.length) {
      const detail = sweepFailures.map((entry) => `${entry.tool}: ${[...(entry.exceptions || []), ...(entry.consoleErrors || [])].join(' | ')}`).join('\n');
      throw new Error(`UI tool sweep surfaced renderer errors:\n${detail}`);
    }
    report.checks.toolSweep = { ok: true, tools: sweep.tools.map((entry) => entry.tool), videoAgentWizard: wizard };

    await cdp.click('[data-tool="toolsettings"]');
    await cdp.waitFor(`getComputedStyle(document.querySelector('#apiSection')).display !== 'none'`, 'API settings visibility', 10000);
    await cdp.setValue('#apiProvider', 'openai-compatible');
    await cdp.setValue('#apiModel', 'custom');
    await cdp.setValue('#apiModelCustom', 'nova-smoke-model');
    await cdp.setValue('#apiKeyList .api-key-field', MOCK_KEY);
    await cdp.setValue('#apiBaseUrl', `http://127.0.0.1:${mockPort}`);
    await cdp.click('#apiSection button[onclick="saveApiSettings()"]');
    const settingsState = await cdp.waitFor(`(() => {
      const text = document.querySelector('#apiStatus')?.textContent || '';
      return text.includes('Đã lưu') ? {
        provider: document.querySelector('#apiProvider')?.value,
        model: document.querySelector('#apiModelCustom')?.value,
        baseUrl: document.querySelector('#apiBaseUrl')?.value,
        keyCount: document.querySelectorAll('#apiKeyList .api-key-field').length,
      } : null;
    })()`, 'saved API settings', 10000);
    if (settingsState.provider !== 'openai-compatible' || settingsState.model !== 'nova-smoke-model') throw new Error('API controls did not retain the selected provider/model.');
    report.checks.apiConfiguration = { ok: true, ...settingsState };
    await cdp.click('[data-tool="toolscript"]');
    await cdp.waitFor(`document.querySelector('#tool-toolscript')?.classList.contains('active')`, 'script tool activation', 10000);
    await cdp.setValue('#tsTopic', 'Packaged AI Video Studio clean-room smoke test');
    await cdp.setValue('#tsWords', '300');
    await cdp.click('#tsGenBtn');
    const uiResult = await cdp.waitFor(`(() => {
      const output = document.querySelector('#tsOutput')?.value || '';
      const status = document.querySelector('#statusScript')?.textContent || '';
      return output.includes(${JSON.stringify(OUTPUT_MARKER)}) && status.includes('Đã viết xong')
        ? { output, status, meta: document.querySelector('#tsOutMeta')?.textContent || '' } : null;
    })()`, 'generated script output', 30000);
    if (uiResult.output.includes('The script is complete') || uiResult.output.includes('```')) throw new Error('Script cleaner left mock preamble or code fences in the UI output.');
    const request = mock.requests.find((item) => item.path === '/v1/chat/completions');
    if (!request?.authOkay || request.model !== 'nova-smoke-model') throw new Error('Loopback mock did not receive the expected authenticated model request.');
    report.checks.scriptGeneration = { ok: true, output: uiResult.output, status: uiResult.status, meta: uiResult.meta, request };

    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 15000);
    const screenshotPath = path.join(runDir, 'script-output.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    report.checks.screenshot = { ok: true, path: screenshotPath, bytes: fs.statSync(screenshotPath).size };

    // Cổng chặn: bất kỳ exception/error nào phát sinh trong renderer đều làm hỏng
    // smoke — không được nuốt lỗi để ra kết quả "passed" giả nữa.
    if (report.diagnostics.rendererExceptions.length) {
      throw new Error(`Renderer exceptions occurred during the packaged run:\n${report.diagnostics.rendererExceptions.join('\n---\n')}`);
    }
    // Nhiễu nội bộ Electron (KHÔNG phải code app): Electron 43 log các dòng này từ
    // sandbox bundle của chính nó trong frame phụ khi CDP bật Runtime (lỗi đã biết,
    // electron#36198). Preload của app vẫn chạy đúng — mọi check IPC/UI phía trên
    // đã chứng minh window.native hoạt động. Chỉ cho đúng 2 mẫu này qua cổng chặn.
    const isElectronInternalNoise = (line) =>
      line.includes('sandboxed_renderer.bundle.js script failed to run') ||
      line.includes("Cannot destructure property 'preloadScripts' of 'binding.startupData'");
    const allConsoleErrorLines = report.diagnostics.rendererConsole.filter((line) => line.startsWith('error'));
    const consoleErrorLines = allConsoleErrorLines.filter((line) => !isElectronInternalNoise(line));
    if (consoleErrorLines.length) {
      throw new Error(`Renderer console errors occurred during the packaged run:\n${consoleErrorLines.join('\n---\n')}`);
    }
    report.checks.rendererClean = {
      ok: true,
      exceptions: 0,
      consoleErrors: 0,
      electronInternalNoiseIgnored: allConsoleErrorLines.length - consoleErrorLines.length,
    };

    // Cổng chặn tương tự cho MAIN process: "Error occurred in handler for 'x'" là
    // exception thoát khỏi ipcMain.handle (ví dụ lỗi cũ export-dir → getPath('downloads')
    // ném trong catch), "Uncaught exception"/"Unhandled promise rejection" trong main
    // cũng là bug thật — không được coi smoke là passed khi chúng xuất hiện.
    const mainErrorLines = report.diagnostics.appStderr
      .split('\n')
      .filter((line) => /Error occurred in handler for|Uncaught exception|Unhandled promise rejection|Failed to get '.+?' path/i.test(line))
      .map((line) => line.trim());
    if (mainErrorLines.length) {
      throw new Error(`Main-process errors occurred during the packaged run:\n${mainErrorLines.join('\n---\n')}`);
    }
    report.checks.mainProcessClean = { ok: true, stderrErrorLines: 0 };

    report.checks.mcp = { ok: true, ...(await runMcpChecks(report.executable, env)) };
    const table = await processTable();
    appPids = descendants(table, child.pid);
    report.app.pidsDuringRun = appPids;

    await closeApp(cdp, child);
    cdp.close(); cdp = null;
    // If the app hasn't exited after Browser.close, force-kill the entire process tree
    if (child.exitCode === null) {
      console.warn('Packaged app did not exit after Browser.close; force-killing process tree...');
      await forceKill(child.pid);
      await sleep(500); // give OS a moment to terminate
      if (child.exitCode === null) throw new Error('Packaged app process did not exit after Browser.close and force-kill.');
    }
    report.app.exitCode = child.exitCode;
    report.app.signalCode = child.signalCode;

    for (const port of FIXED_PORTS) await waitForPort(port, false, 15000);
    const after = await processTable();
    const alive = new Set(after.map((row) => Number(row.ProcessId)));
    const leakedPids = appPids.filter((pid) => alive.has(pid));
    if (leakedPids.length) throw new Error(`Packaged process leak detected (descendant scan): ${leakedPids.join(', ')}.`);
    // Name-based sweep: tree walk misses re-parented orphans (a leaked
    // "AI Video Studio.exe" survived a previous "passed" run), so also verify no
    // executable from this install dir remains on the machine.
    const orphanRows = appExeRows(after, report.installDir);
    if (orphanRows.length) throw new Error(`Packaged app orphans survived shutdown (name scan): ${orphanRows.map((row) => `${row.ProcessId} (${row.ExecutablePath})`).join(', ')}.`);
    report.checks.shutdown = { ok: true, portsClosed: FIXED_PORTS, leakedPids: [], orphans: [] };
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: redact(error.message), stack: redact(error.stack || '') };
    process.exitCode = 1;
  } finally {
    try { if (cdp) await closeApp(cdp, child); } catch (_) {}
    try { cdp?.close(); } catch (_) {}
    if (child && child.exitCode === null) await forceKill(child.pid);
    try { await killAppExes(report.installDir); } catch (_) {}   // dọn cả orphan đã re-parent
    if (mock) await closeServer(mock.server);
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAt.getTime();
    const safeReport = deepRedact(report);
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(safeReport, null, 2) + '\n');
    console.log(JSON.stringify({ status: safeReport.status, report: path.join(runDir, 'report.json'), screenshot: safeReport.checks.screenshot?.path || null }, null, 2));
    try { if (releaseLock) releaseLock(); } catch (_) {}
  }
}

main().catch((error) => { console.error(redact(error.stack || error)); process.exitCode = 1; });