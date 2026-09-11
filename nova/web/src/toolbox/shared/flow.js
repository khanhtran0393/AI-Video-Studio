/* FLOW — Flow bridge + Tool 2 state: flowBridge, tfState, bulkState, _tf*, var _capModeCache, setStatus1/2 (đã dọn 2 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 2 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
const setStatusF = (m, t) => setStatusBar('statusflow', m, t);

// === L?: const flowBridge ===
const flowBridge = {
  ready: false, version: null, _inited: false, _seq: 0,
  _pending: {}, _waiters: [],
  mode: (localStorage.getItem('tfAuthMode') || 'builtin'),   // 'builtin' | 'extension'
  // App desktop: Flow chạy NATIVE (không cần extension) qua window.native.flow.
  get _native(){ return (window.native && typeof window.native.flow === 'function') ? window.native.flow : null; },
  get _ext(){ return (window.native && typeof window.native.flowExt === 'function') ? window.native.flowExt : null; },
  setMode(m){ this.mode = (m === 'extension') ? 'extension' : 'builtin'; localStorage.setItem('tfAuthMode', this.mode); },
  _channel(){
    if (this.mode === 'extension' && this._ext) return this._ext;   // Chrome thật qua bridge
    if (this._native) return this._native;                          // trình duyệt nhúng
    return null;
  },
  init(){
    if (this._inited) return; this._inited = true;
    if (this._native || this._ext){ this.ready = true; this.version = 'native'; return; }   // app: sẵn sàng ngay
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== 'FLOWGEN_EXT') return;
      if (d.type === 'READY'){ this.ready = true; this.version = d.version; this._waiters.forEach(fn => fn()); this._waiters = []; return; }
      if (d.id && this._pending[d.id]){
        const p = this._pending[d.id]; delete this._pending[d.id];
        p.resolve(d.ok ? d.result : { error: d.error || 'BRIDGE_ERROR' });
      }
    });
    this.ping();
  },
  ping(){ if (this._native || this._ext) return; window.postMessage({ source: 'FLOWGEN_PAGE', action: 'PING' }, window.location.origin); },
  waitReady(ms = 1500){
    if (this._native || this._ext) return Promise.resolve(true);   // app: luôn sẵn sàng
    return new Promise((res) => {
      if (this.ready) return res(true);
      const to = setTimeout(() => res(false), ms);
      this._waiters.push(() => { clearTimeout(to); res(true); });
      this.ping();
    });
  },
  call(action, payload){
    const ch = this._channel();
    if (ch) return ch(action, payload).catch(e => ({ error: (e && e.message) || 'NATIVE_ERROR' }));
    return new Promise((resolve) => {
      const id = 'f' + (++this._seq) + '_' + Date.now();
      this._pending[id] = { resolve };
      window.postMessage({ source: 'FLOWGEN_PAGE', id, action, payload }, window.location.origin);
      setTimeout(() => { if (this._pending[id]){ delete this._pending[id]; resolve({ error: 'TIMEOUT' }); } }, 600000);
    });
  }
};

// === L?: const tfState ===
const tfState = { running: false, stop: false, projectId: null, uploaded: {}, onProgress: null };

// === L?: let bulkState ===
let bulkState = { items: [], running: false, stop: false, refs: [] };

// === L?: let _tfBuiltinPoll ===
let _tfBuiltinPoll = null;

// === L?: let _tfCftBusy ===
let _tfCftBusy = false;

// === L?: var _capModeCache ===
var _capModeCache = 'guest';

// === L?: let _tfPersistKey ===
let _tfPersistKey = '';

// === L?: let _tfExtPoll ===
let _tfExtPoll = null;

// === L?: const setStatus1 ===
const setStatus1 = (m, t) => setStatusBar('status1', m, t);

// === L?: const setStatus2 ===
const setStatus2 = (m, t) => setStatusBar('status2', m, t);

// === L?: const SCENE_TYPES ===
