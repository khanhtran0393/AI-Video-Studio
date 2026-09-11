/* LLM — LLM/api-key: _QRUN, PROVIDER_LABEL, LLM_TIMEOUT_MS, LLM_PRICE, _llm*, _k, _novaLog, upState (đã dọn 5 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 5 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
// === L?: const _QRUN ===
const _QRUN = ['queued', 'running', 'paused'];

// === L?: const PROVIDER_LABEL ===
const PROVIDER_LABEL = { anthropic: 'Claude', openai: 'OpenAI', deepseek: 'DeepSeek' };

// === L?: let _apiKeyIdx ===
let _apiKeyIdx = 0;

// === L?: const LLM_TIMEOUT_MS ===
const LLM_TIMEOUT_MS = 180000;

// === L?: const LLM_MAX_RETRY ===
const LLM_MAX_RETRY  = 4;

// === L?: const LLM_PRICE ===
const LLM_PRICE = {
  'gpt-5':          [1.25, 0.125, 10],
  'gpt-5-mini':     [0.25, 0.025, 2],
  'gpt-5-nano':     [0.05, 0.005, 0.40],
  'gpt-5.6-sol':    [5,    5,     30],
  'gpt-5.6-terra':  [2.5,  2.5,   15],
  'gpt-5.6-luna':   [1,    1,     6],
  'gemini-2.5-flash-lite': [0.10, 0.01, 0.40],
  'gemini-2.5-flash':      [0.30, 0.03, 2.50],
  'gemini-2.5-pro':        [1.25, 0.125, 10],
};

// === L?: let _llmUse ===
let _llmUse = { calls: 0, inTok: 0, cacheTok: 0, outTok: 0, usd: 0, steps: {} };

// === L?: let _llmStep ===
let _llmStep = 'khác';

// === L?: const _k ===
const _k = n => (n / 1000).toFixed(1) + 'k';

// === L?: let _novaLog ===
let _novaLog = [];

// === L?: function novaLog ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=276c, shared=268c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/llm.js)

// === L?: function switchTool ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6216c, shared=3075c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/nav.js)

// === L?: const upState ===
const upState = { items: [], running: false, seq: 0, wired: false };

// === L?: let _upThumbBusy ===
let _upThumbBusy = false;

// === L?: function tsInit ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-ts.js (peer=1020c, shared=441c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-ts.js)

// === L?: let VOICE_URL ===
