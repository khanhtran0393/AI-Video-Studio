'use strict';
/* ══════════════════════════════════════════════════════════════
   SMOKE TEST runtime cho handdraw-studio-panel.js (KHÔNG cần Electron)
   Nạp panel thật + DOM giả tối thiểu, rồi chạy đúng luồng người dùng:
     boot panel → loadImages() → bấm "Vùng mẫu (chia dải)" →
     exportTo(mp4) qua PyBackend THẬT (giống whiteboard:export trong ipc.js).
   Chạy:  node web/_smoke_handdraw.js
   ══════════════════════════════════════════════════════════════ */
const path = require('path');
const os = require('os');
const fs = require('fs');

/* ── DOM giả ── */
function mkCtx() {
  const grad = { addColorStop() {} };
  const t = {};
  return new Proxy(t, {
    get(target, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return {};
      if (typeof k === 'string' && !(k in target)) target[k] = () => {};
      return target[k];
    },
    set(target, k, v) { target[k] = v; return true; },
  });
}
function mkEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    value: '', textContent: '', innerHTML: '', disabled: false, title: '',
    scrollTop: 0, scrollHeight: 0, width: 300, height: 300,
    addEventListener(type, fn) { (el._ev = el._ev || {})[type] = fn; },
    removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    insertBefore(c) { el.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getContext() { return mkCtx(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 }; },
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, blur() {},
  };
  return el;
}
const byId = {};
global.document = {
  getElementById(id) { if (!byId[id]) byId[id] = mkEl('div'); return byId[id]; },
  createElement(tag) { return mkEl(tag); },
};
global.window = global;
global.createImageBitmap = async () => ({ width: 10, height: 10 });
global.Image = class {
  constructor() { this.onload = null; this.onerror = null; this._src = ''; }
  set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); }
  get src() { return this._src; }
};
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

/* ── Annotation thật (UMD dùng chung với app) ── */
window.WhiteboardAnnotation = require('./whiteboard-annotation.js');

/* ── PyBackend thật (main process) ── */
const PyBackend = require('../whiteboard-studio/py-backend.js');

/* ── window.native giả = đúng contract preload.js ── */
const IMG = path.join(PyBackend.repoDir, 'examples', 'scene-01-monkey-mountain.png');
window.native = {
  whiteboard: {
    onExportProgress(cb) { window.__hdProg = cb; return () => {}; },
    pyStatus: async () => ({ ok: true, repoPresent: true, venvReady: true, deps: true, ffmpeg: true }),
    pyPrepare: async () => ({ ok: true }),
    probeImage: async () => ({ ok: true, width: 1672, height: 941 }),
    pickImage: async () => ({ canceled: true }),
    pickImages: async () => ({ canceled: true }),
    pickImagesDir: async () => ({ canceled: true }),
    // ĐÚNG chữ ký preload.js (dòng 141): pickOutput(defaultName) → invoke('whiteboard:pickOutput', { defaultName }).
    // Mô phỏng thêm validation Electron: defaultPath không phải chuỗi → ném
    // "Default path must be a string" (bug thật 9/5 khi panel truyền object).
    pickOutput: async (defaultName) => {
      window.__hdPickArg = defaultName;
      if (typeof defaultName !== 'string' || !defaultName.trim()) {
        return { ok: false, error: 'Default path must be a string (mô phỏng validation Electron — panel truyền sai kiểu)' };
      }
      return { canceled: true };
    },
    exportCancel: async () => ({ ok: false }),
    export: async (payload) => {
      // mô phỏng đúng handler whiteboard:export trong ipc.js
      const scenes = (payload.scenes || []).map((s) => ({
        sceneId: s.sceneId,
        image: String(s.image || ''),
        durationMs: Math.max(1500, Math.round((Number(s.durationMs) || 4000))),
        canvas: s.canvas || null,
        elements: s.elements || null,
        annotation: s.annotation || null,
      }));
      return PyBackend.exportVideo({
        scenes,
        audioTracks: [],
        outputPath: payload.outputPath || null,
        options: payload.options || {},
        onProgress: (st) => { try { window.__hdProg && window.__hdProg(st); } catch (e) {} },
        onLog: () => {},
      });
    },
  },
};

(async () => {
  /* 1 · boot panel — bắt lỗi init (bind/thẻ bút/wireEvents/render) */
  require('./handdraw-studio-panel.js');
  if (!window.HanddrawPanel || typeof window.HanddrawPanel.init !== 'function') throw new Error('HanddrawPanel không nạp được');
  console.log('[1] panel boot OK (không lỗi init)');

  /* 2 · load ảnh thật qua API panel */
  await window.HanddrawPanel.loadImages([IMG]);
  if (!byId['hd-sceneList'] || !byId['hd-sceneList'].children.length) throw new Error('sceneList rỗng sau loadImages');
  console.log('[2] loadImages OK — sceneList có ' + byId['hd-sceneList'].children.length + ' ảnh');

  /* 3 · bấm "✨ Vùng mẫu (chia dải)" qua handler đã wire */
  const genBtn = byId['hd-genElementsBtn'];
  if (!genBtn || !genBtn._ev || !genBtn._ev.click) throw new Error('genElementsBtn chưa wire click');
  await genBtn._ev.click();
  const rows = byId['hd-elementsBody'];
  const nRows = rows ? rows.children.length : -1;
  if (nRows < 2) throw new Error('elementsBody chỉ có ' + nRows + ' hàng (mong đợi ≥2 sau chia dải)');
  console.log('[3] chia dải OK — ' + nRows + ' phần tử trong bảng');

  /* 4 · bấm "↻ Phân lại giờ 2/8" */
  const rsBtn = byId['hd-reschedBtn'];
  if (rsBtn && rsBtn._ev && rsBtn._ev.click) { rsBtn._ev.click(); console.log('[4] phân lại giờ 2/8 OK'); }
  else console.log('[4] ⚠ reschedBtn chưa wire');

  /* 4b · bấm "🎬 Xuất MP4" (không truyền path) → panel phải gọi pickOutput(STRING)
         đúng contract preload — nếu truyền object, mock sẽ trả lỗi như Electron thật */
  const expBtn = byId['hd-exportBtn'];
  if (!expBtn || !expBtn._ev || !expBtn._ev.click) throw new Error('exportBtn chưa wire click');
  expBtn._ev.click();
  await new Promise((res) => setTimeout(res, 500));
  if (typeof window.__hdPickArg !== 'string') {
    throw new Error('contract lệch: pickOutput nhận ' + JSON.stringify(window.__hdPickArg) + ' — preload kỳ vọng chuỗi');
  }
  console.log('[4b] contract pickOutput OK — panel truyền chuỗi: "' + window.__hdPickArg + '"');

  /* 5 · bấm "🎬 Xuất MP4" qua handler exportVideo → PyBackend thật */
  const dumpLog = (tag) => {
    const lb = byId['hd-logBox'];
    const lines = lb ? lb.children.map((d) => d.textContent) : [];
    console.log('--- LOG ' + tag + ' (' + lines.length + ' dòng) ---');
    lines.slice(-25).forEach((l) => console.log('   ' + l));
  };
  const out = path.join(os.tmpdir(), 'hd-smoke-' + Date.now() + '.mp4');
  const r = await window.HanddrawPanel.exportTo(out);
  await new Promise((res) => setTimeout(res, 3000));   // chờ render Python chạy xong
  dumpLog('sau exportTo');
  if (r && r.ok === false) throw new Error('export lỗi: ' + (r.error || '?'));
  const exists = fs.existsSync(out);
  const mb = exists ? (fs.statSync(out).size / 1048576).toFixed(2) : '0';
  console.log('[5] export MP4 OK — ' + out + ' — ' + mb + ' MB');
  if (!exists) throw new Error('file MP4 không tồn tại');

  /* 6 · chọn mẫu bút 'pen' rồi xuất lại — kiểm tra option đi qua */
  const tipCard = (byId['hd-tipCards'].children || []).find((c) => c.dataset && c.dataset.v === 'pen');
  if (!tipCard || !tipCard._ev || !tipCard._ev.click) throw new Error('thẻ tipMode "pen" không wire được click');
  tipCard._ev.click();
  const out2 = path.join(os.tmpdir(), 'hd-smoke-pen-' + Date.now() + '.mp4');
  const r2 = await window.HanddrawPanel.exportTo(out2);
  if (r2 && r2.ok === false) throw new Error('export (pen) lỗi: ' + (r2.error || '?'));
  console.log('[6] export chế độ "ngòi bút" OK — ' + (fs.statSync(out2).size / 1048576).toFixed(2) + ' MB');

  console.log('PASS ✔ panel runtime + export end-to-end (không Electron)');
  process.exit(0);
})().catch((e) => { console.error('FAIL ✘', (e && e.stack) || e); process.exit(1); });
