'use strict';
/* ── Scheduler — chạy job video tự động theo lịch (P3 roadmap, học từ VEO3 scheduler).
 * Thiết kế:
 *   - Job lưu file `<userData>/nova-schedules.json` (atomic write) — sống qua restart.
 *   - Job shape: { id, name, timeOfDay 'HH:MM' | everyMinutes N, enabled, lastRun, nextRun,
 *     payload } — khi đến giờ, main gửi event `schedule:fire` cho renderer
 *     (renderer có đầy đủ tool function nên tự quyết định chạy gì — main KHÔNG
 *     gọi nghiệp vụ UI). Payload chỉ là dữ liệu, không phải code.
 *   - Thuần timer Node; state.schedules giữ danh sách (key khai báo trong
 *     main/state.js — Luật 3).
 *   - Lỗi tick được ghi log lộ liễu, KHÔNG nuốt để "coi như chạy" (Luật 10). ── */

const fs = require('fs');
const path = require('path');
const electron = require('electron');
const { atomicWriteFile } = require('./atomic-write');
const state = require('./state');

const TICK_MS = 30 * 1000;

let _timer = null;

function storeFile() {
  try { return path.join(electron.app.getPath('userData'), 'nova-schedules.json'); }
  catch (_) { return path.join(require('os').tmpdir(), 'nova-schedules-test.json'); }
}

function load() {
  if (state.schedules) return state.schedules;
  try {
    const d = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    state.schedules = Array.isArray(d.jobs) ? d.jobs : [];
  } catch (_) { state.schedules = []; }
  return state.schedules;
}

function persist() {
  try {
    atomicWriteFile(storeFile(), JSON.stringify({ jobs: load() }, null, 1));
  } catch (e) { console.warn('[scheduler] lưu lịch thất bại:', (e && e.message) || e); }
}

// Tính lần chạy kế tiếp cho 1 job (ms epoch). Trả null nếu job không có lịch hợp lệ.
function nextRunFor(job, from = Date.now()) {
  if (job.timeOfDay && /^\d{1,2}:\d{2}$/.test(job.timeOfDay)) {
    const [h, m] = job.timeOfDay.split(':').map(Number);
    const d = new Date(from);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= from) d.setDate(d.getDate() + 1);   // đã qua giờ hôm nay → hẹn mai
    return d.getTime();
  }
  const every = Number(job.everyMinutes);
  if (Number.isFinite(every) && every >= 1) {
    const last = Number(job.lastRun) || from;
    return Math.max(from, last + every * 60 * 1000);
  }
  return null;
}

function sendFire(job) {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) { console.warn('[scheduler] không có cửa sổ chính — bỏ qua fire job', job.id); return false; }
  win.webContents.send('schedule:fire', { id: job.id, name: job.name, payload: job.payload || null, at: Date.now() });
  return true;
}

// Đến giờ chạy job: cập nhật lastRun/nextRun, persist, fire. Trả true nếu đã fire.
function fireJob(job, now = Date.now()) {
  job.lastRun = now;
  job.nextRun = nextRunFor(job, now);
  persist();
  const ok = sendFire(job);
  if (!ok) console.warn('[scheduler] job', job.id, 'đã đánh dấu chạy nhưng renderer không nhận được (cửa sổ chưa sẵn sàng).');
  return ok;
}
// Quét 1 tick: fire job đến giờ; job lỡ hẹn (restart) chạy bù tối đa 1 lần.
function tick(now = Date.now()) {
  const jobs = load();
  let fired = 0;
  for (const job of jobs) {
    if (job.enabled === false) continue;
    if (job.nextRun == null) { job.nextRun = nextRunFor(job, now); continue; }
    if (now >= Number(job.nextRun)) {
      const missed = now - Number(job.nextRun) > TICK_MS * 2;
      if (missed && job._missedFired) { job.nextRun = nextRunFor(job, now); persist(); continue; }   // đã bù 1 lần → chỉ dịch lịch
      if (missed) job._missedFired = true; else job._missedFired = false;
      fireJob(job, now);
      fired++;
      if (fired >= 4) break;   // 1 tick fire tối đa 4 job — chống dội
    }
  }
  return fired;
}

function start() {
  if (_timer) return { ok: true, already: true };
  load();   // nạp + tính lại nextRun cho job thiếu
  for (const job of load()) if (job.nextRun == null) { job.nextRun = nextRunFor(job); }
  persist();
  _timer = setInterval(() => { try { tick(); } catch (e) { console.error('[scheduler] tick lỗi:', (e && e.stack) || e); } }, TICK_MS);
  if (_timer.unref) _timer.unref();
  console.log('[scheduler] khởi động với', load().length, 'job');
  return { ok: true, jobs: load().length };
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  return { ok: true };
}

// ── CRUD (IPC gọi vào) ──
function list() {
  return { ok: true, jobs: load() };
}

function add(payload = {}) {
  const jobs = load();
  const job = {
    id: 'sched-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
    name: String(payload.name || 'Job không tên').slice(0, 120),
    timeOfDay: payload.timeOfDay || null,        // 'HH:MM' (giờ địa phương) — hoặc
    everyMinutes: payload.everyMinutes || null,  // số phút lặp lại
    enabled: payload.enabled !== false,
    payload: payload.payload || null,
    createdAt: Date.now(), lastRun: null, nextRun: null,
  };
  if (!job.timeOfDay && !(job.everyMinutes != null && Number.isFinite(Number(job.everyMinutes)) && Number(job.everyMinutes) >= 1)) return { error: 'VA_SCHED_INVALID', message: 'Job cần timeOfDay "HH:MM" hoặc everyMinutes >= 1' };
  job.nextRun = nextRunFor(job);
  jobs.push(job);
  persist();
  return { ok: true, job };
}

function remove(id) {
  const jobs = load();
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return { error: 'VA_SCHED_NOT_FOUND', id };
  const [gone] = jobs.splice(i, 1);
  persist();
  return { ok: true, removed: gone && gone.id };
}

function setPaused(id, paused) {
  const job = load().find((j) => j.id === id);
  if (!job) return { error: 'VA_SCHED_NOT_FOUND', id };
  job.enabled = paused === true ? false : true;
  if (job.enabled) job.nextRun = nextRunFor(job);
  persist();
  return { ok: true, job };
}

function runNow(id) {
  const job = load().find((j) => j.id === id);
  if (!job) return { error: 'VA_SCHED_NOT_FOUND', id };
  const ok = fireJob(job);
  return { ok, fired: ok, job };
}

module.exports = { start, stop, list, add, remove, setPaused, runNow, tick, nextRunFor, storeFile };

