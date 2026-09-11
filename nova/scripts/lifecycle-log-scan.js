'use strict';

/**
 * lifecycle-log-scan — chuẩn hoá bước đọc lifecycle.log của AGENTS.md §6.5(b).
 * Phân loại sự cố theo 2 nhóm:
 *   (a) NOISE teardown lúc ĐÓNG app — renderer/Network Service `crashed exitCode=-1`
 *       rồi `window-all-closed → quit` ngay sau → vô hại;
 *   (b) REAL crash thật giữa phiên — exitCode ≠ -1, hoặc cụm GPU+Network+renderer
 *       chết CÙNG MỘT GIÂY mà main process CÒN GHI LOG sau đó (recovery…), hoặc
 *       render-recovery-stopped "cần can thiệp thủ công", hoặc window-unresponsive
 *       không hồi phục → cửa sổ trắng/treo.
 *   Lưu ý (thí nghiệm 2026-09-11): kill main process TỪ NGOÀI (taskkill/shutdown/
 *       harness) sinh CÙNG signature cụm -1 cùng giây rồi log CÂM hoàn toàn (main
 *       chết không ghi được quit) → cụm -1 câm cuối log chỉ WARN, không chặn CI.
 * Exit 0 = sạch hoặc chỉ có noise; exit 1 = có crash thật (kèm chi tiết từng cụm).
 * Cách dùng:
 *   npm run scan:lifecycle                 — quét %APPDATA%\AI Video Studio Independent\lifecycle.log
 *   npm run scan:lifecycle -- <đường log>  — quét log cụ thể
 *   npm run scan:lifecycle -- --json       — output máy đọc (CI/automation)
 *   npm run scan:lifecycle -- --self-test  — chạy fixture dựng sẵn, không đọc log thật
 * Format dòng: `[<ISO 8601>] <event>[ <detail>]` (ghi bởi nova/main/lifecycle-log.js).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_LOG = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'AI Video Studio Independent', 'lifecycle.log');

const LINE_RE = /^\[([^\]]+)\] (.*)$/;
const QUIT_EVENTS = new Set(['window-all-closed', 'before-quit', 'will-quit', 'quit']);
// Sự kiện crash tiến trình; window-render-process-gone là tín hiệu KÉP (per-window) của
// render-process-gone — bị khử trùng lặp khi gom cụm để một renderer không tính 2 lần.
const CRASH_RE = /^(?:render-process-gone|window-render-process-gone|child-process-gone)$/;
// Giới hạn thời gian: cụm crash (crash cách nhau ≤2s coi là cùng sự cố), cửa sổ
// "ngay sau" giữa crash và quit (teardown noise), khoảng khử trùng lặp tín hiệu kép.
const CLUSTER_GAP_MS = 2000;
const TEARDOWN_QUIT_MS = 5000;
const DUP_WINDOW_MS = 150;
// Bằng chứng "main còn sống" sau cụm crash phải cách cụm ít nhất khoảng này —
// auto-reload trong cùng nhịp chết (+ms) không đủ (xem classifyCluster).
const SURVIVE_EVIDENCE_MS = 10000;

function parseLog(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const ts = Date.parse(m[1]);
    if (!Number.isFinite(ts)) continue;
    events.push({ ts, event: m[2].split(' ')[0], detail: m[2] });
  }
  return events;
}

function exitCodeOf(detail) {
  const m = detail.match(/\bexitCode=(-?\d+)/);
  return m ? Number(m[1]) : null;
}

// Tách theo session: mỗi `gpu-feature-status` (ghi 1 lần mỗi lần app ready) mở session mới.
// Chunk trước gpu-feature-status đầu tiên là teardown của session cũ còn sót log.
function sessions(events) {
  const out = [];
  let cur = [];
  for (const e of events) {
    if (e.event === 'gpu-feature-status' && cur.length) { out.push(cur); cur = []; }
    cur.push(e);
  }
  if (cur.length) out.push(cur);
  return out;
}

// Gom crash thành cụm: crash cách nhau ≤ CLUSTER_GAP_MS coi là cùng một sự cố.
function clusters(crashes) {
  const out = [];
  for (const c of crashes) {
    const last = out[out.length - 1];
    if (last && c.ts - last[last.length - 1].ts <= CLUSTER_GAP_MS) last.push(c);
    else out.push([c]);
  }
  return out;
}

// Khử tín hiệu kép: window-render-process-gone trùng render-process-gone (±DUP_WINDOW_MS
// và cùng exitCode) không được tính lại. Trả về crash đại diện cho từng tiến trình thật.
function dedupeDupSignals(crashes) {
  const out = [];
  for (const c of crashes) {
    if (c.event === 'window-render-process-gone' &&
        out.some(o => Math.abs(o.ts - c.ts) <= DUP_WINDOW_MS &&
          exitCodeOf(o.detail) === exitCodeOf(c.detail) &&
          (o.event === 'render-process-gone' || o.event === 'child-process-gone'))) continue;
    out.push(c);
  }
  return out;
}

function classifyCluster(cluster, eventsAfterClusterEnd) {
  const quitTs = eventsAfterClusterEnd.find(e => QUIT_EVENTS.has(e.event));
  if (quitTs && quitTs.ts - cluster[cluster.length - 1].ts <= TEARDOWN_QUIT_MS) {
    return { kind: 'NOISE', reason: 'teardown lúc đóng app: có window-all-closed/will-quit/quit ngay sau' };
  }
  const kinds = new Set(cluster.map(c => /child-process-gone/.test(c.event) ? 'child' : 'renderer'));
  const codes = cluster.map(c => exitCodeOf(c.detail)).filter(c => c !== null);
  const nonMinus1 = codes.find(c => c !== -1);
  // reason=killed + exitCode 0x40010004/0xC000013A (STATUS_CONTROL_C_EXIT) = tiến trình bị
  // chấm dứt có chủ đích (Ctrl+C/teardown) — KHÔNG phải crash.
  const killed = cluster.some(c => /\breason=killed\b/.test(c.detail));
  if (nonMinus1 !== undefined && !killed) {
    return { kind: 'REAL', reason: `exitCode=${nonMinus1} giữa phiên, không có quit theo sau (không phải noise teardown exitCode=-1)` };
  }
  if (kinds.size >= 2) {
    // Bằng chứng main process SỐNG TIẾP sau cụm: sự kiện non-quit cách cụm ≥
    // SURVIVE_EVIDENCE_MS. Auto-reload phát trong cùng nhịp chết (+vài ms) KHÔNG tính —
    // 2026-09-11: Stop-Process main từ ngoài sinh đúng cụm GPU+Network+renderer
    // exitCode=-1 cùng giây kèm render-recovery auto-reload rồi log câm (main chết
    // không thể ghi quit) → không phân biệt được với crash treo → chỉ WARN.
    const surviveTs = cluster[cluster.length - 1].ts + SURVIVE_EVIDENCE_MS;
    const survived = eventsAfterClusterEnd.some(e => !QUIT_EVENTS.has(e.event) && e.ts >= surviveTs);
    if (survived) {
      return { kind: 'REAL', reason: `crash cụm giữa phiên: ${[...kinds].join('+')} chết cùng lúc, main process còn sống ≥${Math.round(SURVIVE_EVIDENCE_MS / 1000)}s sau đó (pattern GPU+Network+renderer §6.5(b))` };
    }
    return { kind: 'WARN', reason: 'cụm exitCode=-1 cuối session (log câm/recovery trong nhịp chết): kill main ngoài hoặc crash treo — không phân biệt được, mở lại app và quét lại' };
  }
  if (killed) {
    return { kind: 'WARN', reason: 'reason=killed (chấm dứt chủ đích) nhưng session không thấy quit — kiểm chứng thêm' };
  }
  return { kind: 'WARN', reason: 'crash exitCode=-1 đơn lẻ giữa phiên (không phải cụm §6.5(b)) — có thể đã được render-recovery xử lý' };
}

function analyze(events) {
  const findings = [];
  for (const ses of sessions(events)) {
    for (const e of ses) {
      if (e.event === 'render-recovery-stopped') {
        findings.push({ kind: 'REAL', ts: e.ts, reason: 'render-recovery-stopped — reload 3 lần/60s không giữ được renderer, cần can thiệp thủ công', detail: e.detail });
      }
      if (e.event === 'window-unresponsive' && !ses.some(x => x.event === 'window-responsive' && x.ts >= e.ts)) {
        findings.push({ kind: 'REAL', ts: e.ts, reason: 'window-unresponsive không hồi phục trong session', detail: e.detail });
      }
    }
    const crashes = dedupeDupSignals(ses.filter(e => CRASH_RE.test(e.event)).sort((a, b) => a.ts - b.ts));
    let cursor = 0;
    for (const cluster of clusters(crashes)) {
      const endTs = cluster[cluster.length - 1].ts;
      while (cursor < ses.length && ses[cursor].ts <= endTs) cursor++;
      const verdict = classifyCluster(cluster, ses.slice(cursor));
      findings.push({ kind: verdict.kind, ts: cluster[0].ts, reason: verdict.reason, detail: cluster.map(c => c.detail).join(' | ') });
    }
  }
  findings.sort((a, b) => a.ts - b.ts);
  const count = (k) => findings.filter(f => f.kind === k).length;
  return { findings, sessions: sessions(events).length, realCount: count('REAL'), warnCount: count('WARN'), noiseCount: count('NOISE') };
}

function fmtTs(ts) { return new Date(ts).toISOString(); }

function runSelfTest() {
  const base = Date.parse('2026-09-11T10:00:00.000Z');
  const L = (offsetMs, line) => `[${new Date(base + offsetMs).toISOString()}] ${line}`;
  const fixtureLines = (specs) => specs.join('\n');

  const fixtures = [
    {
      name: '(a) noise teardown: renderer+Network Service chết exitCode=-1 → window-all-closed → quit',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(301000, 'render-process-gone reason=crashed exitCode=-1 exitCodeHex=0xffffffff url=app://x'),
        L(301200, 'window-render-process-gone reason=crashed exitCode=-1'),
        L(301500, 'child-process-gone type=Utility reason=crashed exitCode=-1 name=Network Service'),
        L(302000, 'window-all-closed'),
        L(302100, 'will-quit'),
        L(302200, 'quit'),
      ]),
      expectReal: 0,
    },
    {
      name: '(b) crash thật giữa phiên: GPU+Network Service+renderer chết cụm cùng giây, main còn ghi log sau (recovery)',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(100000, 'render-process-gone reason=crashed exitCode=-1 exitCodeHex=0xffffffff url=app://x'),
        L(100050, 'child-process-gone type=Utility reason=crashed exitCode=-1 name=Network Service'),
        L(100100, 'child-process-gone type=GPU reason=crashed exitCode=-1'),
        L(100120, 'window-render-process-gone reason=crashed exitCode=-1'),
        L(115600, 'render-recovery auto-reload sau crashed exitCode=-1 (lần 2/3 trong 60s)'),
      ]),
      expectMinReal: 1,
    },
    {
      name: '(b*) cụm -1 cùng giây rồi log CÂM (EOF) → WARN: kill main ngoài / crash treo không phân biệt được (thí nghiệm 2026-09-11)',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(300000, 'child-process-gone type=Utility reason=crashed exitCode=-1 name=Network Service'),
        L(300050, 'child-process-gone type=GPU reason=crashed exitCode=-1'),
        L(300090, 'render-process-gone reason=crashed exitCode=-1 exitCodeHex=0xffffffff url=app://x'),
        L(300100, 'window-render-process-gone reason=crashed exitCode=-1'),
      ]),
      expectReal: 0,
      expectWarn: 1,
    },
    {
      name: '(b) exitCode=2 loop + render-recovery-stopped (cần can thiệp thủ công)',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(200000, 'render-process-gone reason=crashed exitCode=2 exitCodeHex=0x2 url=app://x'),
        L(206000, 'render-process-gone reason=crashed exitCode=2 exitCodeHex=0x2 url=app://x'),
        L(212000, 'render-process-gone reason=crashed exitCode=2 exitCodeHex=0x2 url=app://x'),
        L(212500, 'render-recovery-stopped reason=crashed'),
      ]),
      expectMinReal: 2,
    },
    {
      name: '(b) window-unresponsive không hồi phục',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(400000, 'window-unresponsive'),
      ]),
      expectMinReal: 1,
    },
    {
      name: '(c) reason=killed 0x40010004 (Ctrl+C/teardown chủ đích) → KHÔNG phải crash',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(500000, 'child-process-gone type=Utility reason=killed exitCode=1073807364 name=Audio Service'),
        L(500050, 'child-process-gone type=Utility reason=killed exitCode=1073807364 name=Network Service'),
      ]),
      expectReal: 0,
      expectWarn: 1,
    },
    {
      name: '(c) crash exitCode=-1 đơn lẻ (chỉ Network Service, không cụm) → WARN, không REAL',
      text: fixtureLines([
        L(0, 'gpu-feature-status {"2d_canvas":"enabled"}'),
        L(600000, 'child-process-gone type=Utility reason=crashed exitCode=-1 name=Network Service'),
      ]),
      expectReal: 0,
      expectWarn: 1,
    },
  ];

  let fail = 0;
  for (const fx of fixtures) {
    const r = analyze(parseLog(fx.text));
    const ok = fx.expectMinReal !== undefined
      ? r.realCount >= fx.expectMinReal
      : r.realCount === fx.expectReal &&
        (fx.expectWarn === undefined || r.warnCount === fx.expectWarn);
    console.log(`  ${ok ? 'OK ' : 'FAI'} ${fx.name} → REAL=${r.realCount} WARN=${r.warnCount} NOISE=${r.noiseCount}`);
    if (!ok) fail++;
  }
  console.log(`lifecycle-log-scan self-test: ${fixtures.length - fail}/${fixtures.length} PASS`);
  return fail ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) process.exit(runSelfTest());

  const logPath = argv.find((a) => !a.startsWith('--')) || DEFAULT_LOG;
  if (!fs.existsSync(logPath)) {
    console.error(`[lifecycle-log-scan] Khong tim thay log: ${logPath}`);
    console.error('[lifecycle-log-scan] Chay app truoc (khoidong.bat) hoac truyen duong log cu the.');
    process.exit(1);
  }

  const result = analyze(parseLog(fs.readFileSync(logPath, 'utf8')));
  const summary = {
    log: logPath,
    sessions: result.sessions,
    real: result.realCount,
    warn: result.warnCount,
    noise: result.noiseCount,
    findings: result.findings,
  };
  if (argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`[lifecycle-log-scan] log=${logPath}`);
    console.log(`[lifecycle-log-scan] session=${result.sessions}  REAL=${result.realCount}  WARN=${result.warnCount}  NOISE=${result.noiseCount}`);
    for (const f of result.findings) {
      console.log(`  [${f.kind}] ${fmtTs(f.ts)} — ${f.reason}`);
      console.log(`          ${f.detail.slice(0, 160)}`);
    }
    if (result.realCount > 0) {
      console.error('[lifecycle-log-scan] Co crash THAT giua phien (nhom b §6.5) — xem chi tiết trên.');
    } else if (result.warnCount > 0) {
      console.log('[lifecycle-log-scan] Khong co crash THAT, nhung co WARN can xem — khong chan, chi canh bao.');
    } else {
      console.log('[lifecycle-log-scan] Sach (hoac chi co noise teardown — nhom a §6.5).');
    }
  }
  process.exit(result.realCount > 0 ? 1 : 0);
}

main();

