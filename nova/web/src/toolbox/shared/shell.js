/* SHELL — const shell/admin/upgrade + hàng đợi sản xuất: KEY_URLS, ADMIN_*, PROD_STEPS, _auto*, _prodQueue, _T2_FIELDS, _VOICE_FIELDS
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 0 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
/* dedup-same-ast: 993 hàm trùng AST với peer đã xoá khỏi shared-consts.js */
/* ============================================================

   SHARED CONSTS — Tier A refactor 2026-09-10
   11 const/let da tach sang shared-state.js (load truoc)
   File nay chi con function decls + VEO consts (Tool 6)

============================================================ */


// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=157c, shared=157c). Peer load SAU → ghi đè bản này. Sửa ở peer.


// === L?: const KEY_URLS ===
const KEY_URLS = {
  anthropic:  'https://console.anthropic.com/settings/keys',
  openai:     'https://platform.openai.com/api-keys',
  gemini:     'https://aistudio.google.com/apikey',
  deepseek:   'https://platform.deepseek.com/api_keys',
  openrouter: 'https://openrouter.ai/keys',
  groq:       'https://console.groq.com/keys',
  mistral:    'https://console.mistral.ai/api-keys/',
  cohere:     'https://dashboard.cohere.com/api-keys',
  perplexity: 'https://docs.perplexity.ai/',
  together:   'https://api.together.xyz/settings/api-keys',
  fireworks:  'https://fireworks.ai/api-keys',
  'openai-compatible': '#'
};

// === L?: let _cliPoll ===
let _cliPoll = null;

// === L?: let _keyVisible ===
let _keyVisible = false;

// === L?: let _upgOrderId, _upgPollTimer, _upgCountTimer ===
let _upgOrderId = null, _upgPollTimer = null, _upgCountTimer = null;

// === L?: const ADMIN_EMAILS ===
const ADMIN_EMAILS = ['admin@novastudio.app', 'admin@novastudio.app', 'admin@novastudio.app'];

// === L?: const ADMIN_UIDS ===
const ADMIN_UIDS = ['UxxIxoq6v1Zk1sa0oc40C7AMuVB3'];

// === L?: const setStatusAdm ===
const setStatusAdm = (m, t) => setStatusBar('statusadm', m, t);

// === L?: const _TF_CFG_IDS ===
const _TF_CFG_IDS = ['tfModel', 'tfAspect', 'tfQuality', 'tfConc', 'tfDelay'];

// === L?: let _updState, _appVer, _updDismissed ===
let _updState = null, _appVer = '', _updDismissed = false;

// === L?: const MAC_DL_URL ===
const MAC_DL_URL = 'https://novastudio-vn.netlify.app/#tai-app';

// === L?: const SUPPORT_ZALO ===
const SUPPORT_ZALO = 'https://zalo.me/0373382451';

// === L?: function _dashStats ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=621c, shared=507c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function _dashWorkflow ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1878c, shared=1314c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function renderDashboard ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=32886c, shared=10786c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: const PROD_STEPS ===
const PROD_STEPS = [
  { key: 'script', label: 'Kịch bản',        tool: 'toolscript', res: 'cli' },
  { key: 'voice',  label: 'Giọng đọc',       tool: 'toolvoice',  res: 'voice' },
  { key: 'scenes', label: 'Prompt cảnh',     tool: 'tool2',      res: 'cli' },
  { key: 'assets', label: 'Prompt nhân vật', tool: 'tool3',      res: 'cli' },
  { key: 'seo',    label: 'YouTube SEO',     tool: 'tool9',      res: 'cli' },
  { key: 'images', label: 'Tạo ảnh',         tool: 'toolflow',   res: 'flow' },
  { key: 'videos', label: 'Xen video',       tool: 'tool6',      res: 'local' },
  { key: 'thumb',  label: 'Thumbnail',       tool: 'tool9',      res: 'flow' },
  { key: 'build',  label: 'Dựng video',      tool: 'tool7',      res: 'local' },
  // ⛔ Bỏ bước 'Xuất file' khỏi luồng tự động: dừng sau khi ráp timeline để user kiểm & tạo lại cảnh lỗi,
  //    rồi tự bấm Xuất ở tab Dựng Video. (Handler export bên dưới giữ lại, chỉ không nằm trong quy trình auto.)
];

// === L?: let _autoBusy, _autoAbort, _autoState, _autoOutDir, _autoTopic ===
let _autoBusy = false, _autoAbort = false, _autoState = {}, _autoOutDir = '', _autoTopic = '';

// === L?: let _autoVoiceFile, _autoStartFrom, _autoDefaultDir, _autoScriptText ===
let _autoVoiceFile = null, _autoStartFrom = 'script', _autoDefaultDir = '', _autoScriptText = '';

// === L?: let _autoSaveMode, _autoSaveName ===
let _autoSaveMode = 'perTask', _autoSaveName = '';

// === L?: function dashToggleStart ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=602c, shared=492c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function dashWordEst ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=578c, shared=235c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: let _autoLastLog ===
let _autoLastLog = null;

// === L?: let _prodQueue, _queueRunning, _queueAbort, _queueCurId, _queueVoice, _flowExhausted ===
let _prodQueue = [], _queueRunning = false, _queueAbort = false, _queueCurId = null, _queueVoice = {}, _flowExhausted = false;

// === L?: const _STEP_TO ===
const _STEP_TO = { cli: 45 * 60000, voice: 30 * 60000, flow: 60 * 60000, local: 40 * 60000 };

// === L?: let _autoRetryTimer ===
let _autoRetryTimer = null;

// === L?: const _RETRY_MIN ===
const _RETRY_MIN = 30;

// === L?: const _T2_FIELDS ===
const _T2_FIELDS = { splitMode: 'v', t2DescMode: 'v', minChars: 'v', maxChars: 'v', minSecPerImg: 'v', maxSecPerImg: 'v', batchSize: 'v', shortPromptMode: 'c', highDetailMode: 'c', brollMode: 'c', noCharMode: 'c', hybridIconMode: 'c' };

// === L?: const _VOICE_FIELDS ===
const _VOICE_FIELDS = { voiceLang: 'v', voiceSpeed: 'v', voiceGap: 'v', voiceInstruct: 'v' };

// === L?: function applyChannelCfg ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=791c, shared=567c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/autopipe.js)

// === L?: function queueAdd ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-queue.js (peer=3200c, shared=3156c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-queue.js)

