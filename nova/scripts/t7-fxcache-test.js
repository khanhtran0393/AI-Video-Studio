/* Kiểm định cache bền kho FX của Tool 7 (nova/web/src/toolbox/utility/t7-gfx.js)
   Nạp nguyên văn file renderer vào vm với stub localStorage/document/window.native
   (stub `_t7Cat/_t7Trans/_t7Bits/_t7Prev` đúng thứ tự nạp thật: shared/t7.js trước
   utility/t7-gfx.js), xác minh bằng code:
   (1) lần đầu nạp sống → lưu cache vào localStorage;
   (2) phiên sau hydrate ĐỒNG BỘ từ cache — 0 lời gọi previewLayers trước render;
   (3) revalidate ngầm bắt được thay đổi kho → thay dữ liệu + vẽ lại + ghi đè cache;
   (4) IPC lỗi khi kiểm chứng → giữ cache + KHAI BÁO rõ (Luật 10), không fallback câm;
   (5) cache sai version → vứt, nạp sống.
   Lịch sử: sinh 2026-09-18 sau khi phát hiện `let _t7FxSw` mất khai báo (dedup) khiến
   t7FxTab chết giữa chừng → panel Chữ/Chuyển động/Chuyển cảnh kẹt vĩnh viễn "Đang nạp…". */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'web', 'src', 'toolbox', 'utility', 't7-gfx.js'), 'utf8');

function makeEnv(store, opts) {
  opts = opts || {};
  const CAT = opts.cat || [
    { template: 'tu-lieu', label: 'Tư liệu toàn khung', params: [] },
    { template: 'fx-glitch', label: 'FX · Glitch', params: [] },
  ];
  const TRANS = [{ id: 'fade', label: 'Fade', family: 'basic', durationSec: 0.5 }];
  const calls = [];
  const native = {
    sceneTemplates: async () => { calls.push('sceneTemplates'); return { ok: true, items: CAT }; },
    sceneTransitions: async () => { calls.push('sceneTransitions'); return { ok: true, items: TRANS }; },
    sceneBits: async () => { calls.push('sceneBits'); return { ok: true, items: [] }; },
    fxPreviews: async () => { calls.push('fxPreviews'); return { ok: true, items: {} }; },
    previewLayers: async () => { calls.push('previewLayers'); return { ok: true, items: [{ kind: 'fx', pieces: [] }] }; },
  };
  if (opts.failSceneTemplates) native.sceneTemplates = async () => { calls.push('sceneTemplates'); throw new Error('IPC dead'); };
  const badgeEl = { textContent: '' };
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: { getElementById: () => badgeEl },
    window: { native: opts.noNative ? undefined : native },
    t7State: { mediaTab: 'motion' },
    _t7Cat: null, _t7Trans: null, _t7Bits: null, _t7Prev: null,   // khai báo ở shared/t7.js, nạp TRƯỚC t7-gfx.js
    t7RenderRail: () => { calls.push('t7RenderRail'); },
    t7FxTab: () => { calls.push('t7FxTab'); },
    setStatus7: (m) => { calls.push('status:' + m); },
    escapeHtml: (s) => String(s),
    _t7LayerHtml: () => '<b>x</b>',
    _t7Catalog: async () => { calls.push('_t7Catalog'); return CAT; },
    _t7LoadTrans: async () => { calls.push('_t7LoadTrans'); return TRANS; },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 't7-gfx.js' });
  return { ctx, calls, badgeEl };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (cond, name) => { console.log((cond ? '  OK  ' : '  FAIL') + ' ' + name); if (!cond) fail++; };

(async () => {
  // (1) Lần đầu — nạp sống, phải lưu cache vào localStorage
  {
    const store = {}; const env = makeEnv(store, {});
    const n = await env.ctx._t7LoadFx();
    await env.ctx._t7FxSwatchLoad();
    await sleep(10);
    ok(n === 3, 'lan dau: n = cat(2) + trans(1) + bits(0) = 3, that te la ' + n);
    ok(!!store.t7FxKhoCacheV1, 'lan dau: cache da luu vao localStorage');
    const j = JSON.parse(store.t7FxKhoCacheV1);
    ok(j.cat.length === 2 && j.trans.length === 1 && j.sw && typeof j.sw === 'object', 'cache dung cau truc cat/trans/sw');
  }
  await part2({ ok, sleep, makeEnv });
})().catch(e => { console.error('LOI TEST:', e); process.exit(2); });

async function part2({ ok, sleep, makeEnv }) {
  // (2) Phiên sau — hydrate đồng bộ: KHÔNG IPC nào chạy trước khi return
  {
    const store = {}; const envA = makeEnv(store, {});
    await envA.ctx._t7LoadFx(); await envA.ctx._t7FxSwatchLoad(); await sleep(10);
    const envB = makeEnv(store, {});
    const n = await envB.ctx._t7LoadFx();
    const sw = await envB.ctx._t7FxSwatchLoad();
    ok(n === 3, 'phien sau: hydrate n = 3 (khong nap lai tu IPC)');
    ok(sw && typeof sw === 'object', 'phien sau: swatch lay tu cache, khong sinh lai');
    ok(!envB.calls.some(c => c === 'previewLayers'), 'phien sau: swatch tu cache, khong goi previewLayers truoc render');
    ok(envB.badgeEl.textContent === 3, 'phien sau: badge cap nhat = 3');
  }
  // (3) Revalidate — kho đổi (thêm mẫu) → thay dữ liệu sống + vẽ lại
  {
    const store = {}; const envA = makeEnv(store, {});
    await envA.ctx._t7LoadFx(); await envA.ctx._t7FxSwatchLoad(); await sleep(10);
    const envB = makeEnv(store, { cat: [{ template: 'moi', label: 'Mẫu mới', params: [] }, { template: 'fx-glitch', label: 'FX · Glitch', params: [] }] });
    await envB.ctx._t7LoadFx(); await sleep(20);
    ok(envB.ctx._t7Cat.length === 2 && envB.ctx._t7Cat[0].template === 'moi', 'revalidate: thay dung kho moi');
    ok(envB.calls.some(c => c === 't7RenderRail') && envB.calls.some(c => c === 't7FxTab'), 'revalidate: ve lai rail + tab');
    ok(envB.calls.some(c => String(c).indexOf('hiệu ứng đã thay đổi') >= 0), 'revalidate: bao nguoi dung biet');
    const j = JSON.parse(store.t7FxKhoCacheV1);
    ok(j.cat[0].template === 'moi', 'revalidate: cache da ghi de ban moi');
  }
  // (4) Revalidate lỗi IPC → giữ cache, KHÔNG rỗng dữ liệu (degrade khai báo)
  {
    const store = {}; const envA = makeEnv(store, {});
    await envA.ctx._t7LoadFx(); await envA.ctx._t7FxSwatchLoad(); await sleep(10);
    const envB = makeEnv(store, { failSceneTemplates: true });
    await envB.ctx._t7LoadFx(); await sleep(20);
    ok(envB.ctx._t7Cat && envB.ctx._t7Cat.length === 2, 'IPC loi: van giu du lieu cache (khong bat trang)');
    ok(envB.calls.some(c => String(c).indexOf('Không kiểm chứng được') >= 0), 'IPC loi: co khai bao ro (Luat 10)');
  }
  // (5) Cache sai version → bỏ, nạp sống
  {
    const store = { t7FxKhoCacheV1: JSON.stringify({ v: 'v0-cu', cat: [{ template: 'rac', label: 'x' }], trans: [], bits: [] }) };
    const env = makeEnv(store, {});
    const n = await env.ctx._t7LoadFx();
    ok(n === 3 && env.ctx._t7Cat[0].template === 'tu-lieu', 'cache version cu -> bo, nap song');
  }
  console.log(fail ? ('KET QUA: ' + fail + ' FAIL') : 't7-fxcache-test: TAT CA PASS');
  process.exit(fail ? 1 : 0);
}
