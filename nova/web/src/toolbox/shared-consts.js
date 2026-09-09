/* ============================================================
   SHARED CONSTS — khôi phục từ HEAD nova/web/index.html
   (do quá trình tách block 3 → src/toolbox/ chưa chuyển vào)
   274 top-level const/let/var
============================================================ */

// === L5650-5687: state ===
const state = {
  // Profile data (sẽ phát triển ở Phase 2+)
  profiles: [],
  currentProfileIdx: -1,
  // Tool data (sẽ phát triển ở Phase 2+)
  scenes: [],
  scenePrompts: {},
  scenePrompts2: {},
  characterImages: {},
  assetCharPrompts: {},
  assetBgPrompts: {},
  styleRefImages: [],
  styleRefPrompt: '',
  characterPrompts: {},
  backgroundPrompts: {},
  script: '',
  voLang: 'Tiếng Việt',
  minChars: 30,
  maxChars: 150,
  splitMode: 'smart',
  videoLogline: '',   // 🎯 tóm tắt toàn video — nhồi vào MỌI prompt cảnh để không lạc chủ đề
  // ✨ Trợ lý dựng — lưu THEO TỪNG VIDEO, thoát app vào lại không phải phân tích lại.
  aiMap: {},          // sceneId → {role, key, num, emp, h}. h = vân tay lời thoại: lời đổi mới đọc lại cảnh đó.
  aiQueue: [],        // đề xuất + trạng thái đã duyệt của từng cảnh
  charactersV: [],
  backgroundsV: [],
  descMode: 'tag',
  charBible: {},
  bgBible: {},
  tool: 'tool1',
  sub: 'list',
  cancelRequested: false,
  editingSceneIdx: -1,
  editingPrompt: null,  // {type, key} — only one prompt edit at a time
  assetLibrary: { chars: {}, bgs: {} },  // Library nhân vật + bối cảnh dùng chung qua các video
  sceneImages: {},  // {sceneId: {base64, mediaType, fileName}} — storyboard ảnh từng cảnh (IDB)
  userTier: 'max'  // ✅ ĐÃ MỞ TOÀN BỘ — mặc định Max cho mọi user (không còn kiểm tra gói)
};

// === L5692-5692: ALL_TOOLS ===
const ALL_TOOLS = ['tool1', 'tool2', 'tool3', 'tool4', 'tool5', 'tool6', 'tool7', 'tool8', 'tool9', 'toolniche', 'toolflow', 'toolvoice', 'tooldash', 'toolsettings', 'toolscript'];

// === L5694-5699: TOOL_LABELS ===
const TOOL_LABELS = {
  tool1: 'Profile Kênh', toolscript: 'Tạo Kịch Bản', tool2: 'Phân Cảnh', tool3: 'Prompt Nhân vật & Bối cảnh',
  tool4: 'Đổi Tên Ảnh', tool5: 'Tìm Media', tool6: 'Tạo Video (Image→Video)', tool7: 'Dựng Video',
  tool8: 'Căn Timing', tool9: 'YouTube SEO & Thumbnail AI', toolniche: 'Nghiên cứu Ngách',
  toolflow: 'Tạo Ảnh Hàng Loạt', toolvoice: 'Tạo giọng nói', tooldash: 'Dashboard', toolsettings: 'Cài đặt'
};

// === L5700-5732: TIER_CONFIG ===
const TIER_CONFIG = {
  free: {
    name: 'Free',
    maxProfiles: 1,
    maxScenes: 10,     // mỗi video tối đa 10 cảnh
    maxFlow: 1,        // 1 tài khoản Google Flow
    maxQueue: 0,       // không dùng hàng đợi tự động
    autoRun: false,    // không có Dashboard 1-nút tự động
    // Free thấy MỌI tool trên menu, nhưng chỉ DÙNG được nhóm cơ bản; các tool nâng cao báo nâng cấp:
    allowedTools: ['tool1', 'toolscript', 'tool2', 'tool3', 'tool7', 'tooldash', 'toolsettings'],
    badge: { text: 'FREE', bg: '#94918a', color: '#fff' }
  },
  pro: {   // gói Sáng tạo
    name: 'Pro',
    maxProfiles: 3,
    maxScenes: Infinity,
    maxFlow: 3,
    maxQueue: 5,
    autoRun: true,
    allowedTools: ALL_TOOLS.slice(),
    badge: { text: 'PRO ✨', bg: 'linear-gradient(180deg,var(--accent-2),var(--accent))', color: '#fff' }
  },
  max: {   // gói Studio
    name: 'Max',
    maxProfiles: Infinity,
    maxScenes: Infinity,
    maxFlow: Infinity,
    maxQueue: Infinity,
    autoRun: true,
    allowedTools: ALL_TOOLS.slice(),
    badge: { text: 'MAX 👑', bg: 'linear-gradient(180deg,#a855f7,#7c3aed)', color: '#fff' }
  }
};

// === L5734-5734: TOOL_MIN_TIER ===
const TOOL_MIN_TIER = { tool4: 'pro', tool5: 'pro', tool6: 'pro', tool8: 'pro', tool9: 'pro', toolniche: 'pro', toolflow: 'pro', toolvoice: 'pro' };

// === L5736-5741: PRICING ===
const PRICING = {
  plus: { priceVND: 299000, label: 'Sáng tạo',                 period: '1 tháng' },
  max:  { priceVND: 399000, label: 'Studio',                   period: '1 tháng' },
  demo: { priceVND: 30000,  label: 'Demo 1 ngày (full Sáng tạo)', period: '1 ngày' },
  pro:  { priceVND: 499000, originalVND: 1000000, period: '1 tháng' }
};

// === L5744-5755: PAYMENT_INFO ===
const PAYMENT_INFO = {
  bank: {
    name: 'MBBank',
    bankCode: 'MB',             // mã ngân hàng cho VietQR (VCB, TCB, MB, ACB, BIDV, VPB...)
    accountNumber: '181220010000',
    owner: 'CHU KHAC KIEN'
  },
  contact: {
    zalo: '0373382451',
    email: 'admin@novastudio.app'
  }
};

// === L5760-5849: MODELS ===
const MODELS = {
  anthropic: [
    // Gateway agentrouter (đi qua CLI bridge, KHÔNG cần API key) — id phải khớp catalog của họ.
    // Claude series trên agentrouter đang bị ngừng; GLM/DeepSeek/GPT còn kênh + budget.
    // ⚠️ Đặt model CÒN SỐNG lên đầu — MODELS[provider][0] là mặc định cho người dùng mới.
    { id: 'glm-5.3',           name: 'GLM 5.3 (agentrouter)' },
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (agentrouter)' },
    { id: 'gpt-5.6-sol',       name: 'GPT-5.6 Sol (agentrouter)' },
    // ⚠️ HHTECH đặt id KHÔNG nhất quán: Opus dùng dấu GẠCH (4-7), Sonnet/Haiku dùng dấu CHẤM (4.6). Giữ đúng như catalog của họ.
    { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-sonnet-5',   name: 'Claude Sonnet 5' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-5',     name: 'Claude Opus 5' },
    { id: 'claude-opus-4-8',   name: 'Claude Opus 4.8' },
    { id: 'claude-opus-4-7',   name: 'Claude Opus 4.7' },
    { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6' },
    { id: 'claude-fable-5',    name: 'Claude Fable 5' },
    { id: 'claude-haiku-4.5',  name: 'Claude Haiku 4.5' }
  ],
  openai: [
    // Key OpenAI TRỰC TIẾP — id chính thức. Rẻ hơn hẳn 5.6 cho việc hàng loạt.
    { id: 'gpt-5-mini',          name: 'GPT-5 mini — rẻ, hợp hầu hết khâu' },
    { id: 'gpt-5-nano',          name: 'GPT-5 nano — rẻ nhất, việc khuôn mẫu' },
    { id: 'gpt-5',               name: 'GPT-5 — mạnh, đắt' },
    // Catalog HHTECH (gateway) — chỉ chạy khi dùng Base URL của họ
    { id: 'gpt-5.6-luna',        name: 'GPT-5.6 Luna (HHTECH)' },
    { id: 'gpt-5.6-sol',         name: 'GPT-5.6 Sol (HHTECH)' },
    { id: 'gpt-5.6-terra',       name: 'GPT-5.6 Terra (HHTECH)' },
    { id: 'gpt-5.5',             name: 'GPT-5.5' },
    { id: 'gpt-5.4',             name: 'GPT-5.4' },
    { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark' }
  ],
  "openai-compatible": [
    { id: 'custom-model', name: '🔧 Nhập model tuỳ chỉnh (dùng ô bên dưới)' }
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (preview, nhanh)' },
    { id: 'deepseek-v4-pro',   name: 'DeepSeek V4 Pro (preview, mạnh nhất)' }
  ],
  gemini: [
    { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash (nhanh, rẻ)' },
    { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro (mạnh)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (rẻ nhất)' }
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-5',                name: 'GPT-5' },
    { id: 'openai/gpt-5-mini',           name: 'GPT-5 mini' },
    { id: 'google/gemini-2.5-flash',     name: 'Gemini 2.5 Flash' },
    { id: 'meta-llama/llama-4',          name: 'Llama 4' },
    { id: 'deepseek/deepseek-v4',        name: 'DeepSeek V4' },
    { id: 'mistral/mistral-large',       name: 'Mistral Large' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B' },
    { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it',            name: 'Gemma 2 9B' }
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    { id: 'mistral-small-latest',  name: 'Mistral Small' },
    { id: 'codestral-latest',      name: 'Codestral' }
  ],
  cohere: [
    { id: 'command-r-plus', name: 'Command R+' },
    { id: 'command-r',      name: 'Command R' }
  ],
  perplexity: [
    { id: 'sonar-pro',      name: 'Sonar Pro' },
    { id: 'sonar-small',    name: 'Sonar Small' }
  ],
  together: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct',  name: 'Llama 3.1 8B' },
    { id: 'mistralai/Mixtral-8x7B-Instruct',   name: 'Mixtral 8x7B' }
  ],
  fireworks: [
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',  name: 'Llama 3.1 8B' },
    { id: 'accounts/fireworks/models/mixtral-8x7b-instruct',  name: 'Mixtral 8x7B' }
  ],
  cli: [
    { id: 'default', name: 'Claude (mặc định)' },
    { id: 'sonnet',  name: 'Claude Sonnet' },
    { id: 'opus',    name: 'Claude Opus' },
    { id: 'chatgpt', name: 'ChatGPT' }
  ]
};

// === L5854-5854: VISION_PROVIDERS ===
const VISION_PROVIDERS = ['anthropic', 'openai', 'gemini', 'openrouter', 'mistral', 'cohere', 'perplexity', 'openai-compatible'];

// === L5857-5857: _provKeyName ===
const _provKeyName = p => 'api_key_' + (p || 'anthropic');

// === L5858-5860: _keyFieldsProvider ===
let _keyFieldsProvider = null;   // provider mà các ô key đang hiển thị thuộc về
function _saveCurrentKeyFields(){
  if (!_keyFieldsProvider) return;

// === L5912-5925: KEY_URLS ===
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

// === L5983-5990: BRIDGE_FILES ===
const BRIDGE_FILES = {
  "claude-bridge.js": 'LyoqCiAqIENsYXVkZS9Db2RleCBDTEkgQnJpZGdlIOKAlCBiaeG6v24gQ0xJIGfDs2kgc3Vic2NyaXB0aW9uIGPhu6dhIELhuqBOIHRow6BuaCBBUEkga2nhu4N1IE9wZW5BSS4KICoKICogRMO5bmcgxJHhu4MgY2h1a2llbm1lZGlhIChwcm92aWRlciAiQ0xJIHThu7EgaG9zdCIpIGfhu41pIGfDs2kgQ2xhdWRlL0NoYXRHUFQgY+G7p2EgYuG6oW4sCiAqIEtIw5RORyBj4bqnbiBBUEkga2V5IHRy4bqjIHRp4buBbi4gTeG7l2kgdXNlciB04buxIGNo4bqheSBjw6FpIG7DoHkgdHLDqm4gbcOheS9WUFMgY+G7p2EgbcOsbmguCiAqCiAqIFnDilUgQ+G6plU6CiAqICAgMS4gQ8OgaSBDbGF1ZGUgQ29kZSBDTEkgdsOgIMSRxINuZyBuaOG6rXAgYuG6sW5nIGfDs2kgY+G7p2EgYuG6oW4gKFByby9NYXgpOiAgYGNsYXVkZWAgICjEkcSDbmcgbmjhuq1wIDEgbOG6p24pCiAqICAgICAgKEhv4bq3YyBDb2RleCBDTEkgY2hvIGfDs2kgQ2hhdEdQVCDigJQgxJHhu5VpIEVOR0lORSBiw6puIGTGsOG7m2kuKQogKiAgIDIuIENo4bqheTogIG5vZGUgY2xhdWRlLWJyaWRnZS5qcwogKiAgIDMuIFRyb25nIGNodWtpZW5tZWRpYSDihpIgQVBJIFNldHRpbmdzIOKGkiBwcm92aWRlciAiQ0xJIHThu7EgaG9zdCIg4oaSIEVuZHBvaW50OiBodHRwOi8vbG9jYWxob3N0Ojg3OTAKICoKICog4pqg77iPIENo4buJIGTDuW5nIGfDs2kgQ+G7pkEgQuG6oE4gY2hvIHZp4buHYyBj4bunYSBC4bqgTi4gQ2hpYSBz4bq7L2LDoW4gbOG6oWkgcXV54buBbiAxIHTDoGkga2hv4bqjbgogKiAgICBzdWJzY3JpcHRpb24gY2hvIG5oaeG7gXUgbmfGsOG7nWkgbMOgIHZpIHBo4bqhbSDEkWnhu4F1IGtob+G6o24gQW50aHJvcGljL09wZW5BSS4KICovCgpjb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpOwpjb25zdCB7IHNwYXduIH0gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7Cgpjb25zdCBQT1JUID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuQlJJREdFX1BPUlQpIHx8IDg3OTA7ICAgICAgIC8vIENsYXVkZT04NzkwLCBDaGF0R1BUPTg3OTEKY29uc3QgRU5HSU5FID0gcHJvY2Vzcy5lbnYuQlJJREdFX0VOR0lORSB8fCAnY2xhdWRlJzsgICAgICAgIC8vICdjbGF1ZGUnIChDbGF1ZGUgQ29kZSkgaG/hurdjICdjb2RleCcgKENoYXRHUFQpCmNvbnN0IFRPS0VOID0gcHJvY2Vzcy5lbnYuQlJJREdFX1RPS0VOIHx8ICcnOyAgICAgICAgICAgICAgICAvLyDEkeG6t3QgY2h14buXaSBiw60gbeG6rXQgbuG6v3UgbXXhu5FuIGLhuqNvIHbhu4cKY29uc3QgTUFYX0NPTkNVUlJFTlQgPSAyOyAgICAgICAgICAgICAgICAvLyBz4buRIGzhu4duaCBDTEkgY2jhuqF5IGPDuW5nIGzDumMgKGfDs2kgc3Vic2NyaXB0aW9uIGPDsyBo4bqhbiBt4bupYyDihpIgxJHhu4MgMS0yKQpjb25zdCBUSU1FT1VUX01TID0gMTgwMDAwOyAgICAgICAgICAgICAgIC8vIGjhur90IDMgcGjDunQgdGjDrCBodeG7tyBs4buHbmggQ0xJIMSRw7MKCi8vIEjDoG5nIMSR4bujaSBnaeG7m2kgaOG6oW4gc+G7kSB0aeG6v24gdHLDrG5oIENMSSBzb25nIHNvbmcuCmxldCBfYWN0aXZlID0gMDsKY29uc3QgX3F1ZXVlID0gW107CmZ1bmN0aW9uIF9hY3F1aXJlKCkgewogIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gewogICAgY29uc3QgdHJ5UnVuID0gKCkgPT4gewogICAgICBpZiAoX2FjdGl2ZSA8IE1BWF9DT05DVVJSRU5UKSB7IF9hY3RpdmUrKzsgcmVzb2x2ZSgpOyB9CiAgICAgIGVsc2UgX3F1ZXVlLnB1c2godHJ5UnVuKTsKICAgIH07CiAgICB0cnlSdW4oKTsKICB9KTsKfQpmdW5jdGlvbiBfcmVsZWFzZSgpIHsKICBfYWN0aXZlLS07CiAgY29uc3QgbmV4dCA9IF9xdWV1ZS5zaGlmdCgpOwogIGlmIChuZXh0KSBuZXh0KCk7Cn0KCmZ1bmN0aW9uIGJ1aWxkUHJvbXB0KG1lc3NhZ2VzKSB7CiAgcmV0dXJuIChtZXNzYWdlcyB8fCBbXSkubWFwKG0gPT4gewogICAgY29uc3QgYyA9IHR5cGVvZiBtLmNvbnRlbnQgPT09ICdzdHJpbmcnCiAgICAgID8gbS5jb250ZW50CiAgICAgIDogKG0uY29udGVudCB8fCBbXSkubWFwKHggPT4geC50ZXh0IHx8ICcnKS5qb2luKCdcbicpOwogICAgY29uc3QgdGFnID0gbS5yb2xlID09PSAnc3lzdGVtJyA/ICdbU3lzdGVtXVxuJyA6IG0ucm9sZSA9PT0gJ2Fzc2lzdGFudCcgPyAnW0Fzc2lzdGFudF1cbicgOiAnJzsKICAgIHJldHVybiB0YWcgKyBjOwogIH0pLmpvaW4oJ1xuXG4nKTsKfQoKYXN5bmMgZnVuY3Rpb24gcnVuQ0xJKHByb21wdCwgbW9kZWwpIHsKICBhd2FpdCBfYWNxdWlyZSgpOwogIHRyeSB7CiAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgICBsZXQgY21kLCBhcmdzLCB1c2VTdGRpbiA9IHRydWU7CiAgICAgIGlmIChFTkdJTkUgPT09ICdjb2RleCcpIHsKICAgICAgICAvLyBDb2RleDogYuG7jyBxdWEga2nhu4NtIHRyYSBnaXQgcmVwbywgdHJ1eeG7gW4gcHJvbXB0IGzDoG0gdGhhbSBz4buRIChraMO0bmcgcXVhIHN0ZGluKS4KICAgICAgICBjbWQgPSAnY29kZXgnOyBhcmdzID0gWydleGVjJywgJy0tc2tpcC1naXQtcmVwby1jaGVjaycsIHByb21wdF07IHVzZVN0ZGluID0gZmFsc2U7CiAgICAgIH0gZWxzZSB7CiAgICAgICAgY21kID0gJ2NsYXVkZSc7IGFyZ3MgPSBbJy1wJywgJy0tb3V0cHV0LWZvcm1hdCcsICd0ZXh0J107ICAgLy8gQ2xhdWRlIENvZGUgcHJpbnQgbW9kZSwgxJHhu41jIHN0ZGluCiAgICAgICAgaWYgKG1vZGVsID09PSAnb3B1cycgfHwgbW9kZWwgPT09ICdzb25uZXQnKSBhcmdzLnB1c2goJy0tbW9kZWwnLCBtb2RlbCk7CiAgICAgIH0KICAgICAgY29uc3QgY3AgPSBzcGF3bihjbWQsIGFyZ3MsIHsgZW52OiBwcm9jZXNzLmVudiwgY3dkOiBwcm9jZXNzLmVudi5IT01FIHx8IHVuZGVmaW5lZCwgc2hlbGw6IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgfSk7CiAgICAgIGxldCBvdXQgPSAnJywgZXJyID0gJycsIGRvbmUgPSBmYWxzZTsKICAgICAgY29uc3QgZmluaXNoID0gKGZuLCB2KSA9PiB7IGlmIChkb25lKSByZXR1cm47IGRvbmUgPSB0cnVlOyBjbGVhclRpbWVvdXQodGltZXIpOyBmbih2KTsgfTsKICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHsgdHJ5IHsgY3Aua2lsbCgnU0lHS0lMTCcpOyB9IGNhdGNoIHt9IGZpbmlzaChyZWplY3QsIG5ldyBFcnJvcignQ0xJIHRpbWVvdXQnKSk7IH0sIFRJTUVPVVRfTVMpOwogICAgICBjcC5zdGRvdXQub24oJ2RhdGEnLCBkID0+IChvdXQgKz0gZCkpOwogICAgICBjcC5zdGRlcnIub24oJ2RhdGEnLCBkID0+IChlcnIgKz0gZCkpOwogICAgICBjcC5vbignZXJyb3InLCBlID0+IGZpbmlzaChyZWplY3QsIGUpKTsKICAgICAgY3Aub24oJ2Nsb3NlJywgY29kZSA9PiAoY29kZSA9PT0gMCA/IGZpbmlzaChyZXNvbHZlLCBvdXQudHJpbSgpKSA6IGZpbmlzaChyZWplY3QsIG5ldyBFcnJvcihlcnIudHJpbSgpIHx8ICgnZXhpdCAnICsgY29kZSkpKSkpOwogICAgICBpZiAodXNlU3RkaW4pIGNwLnN0ZGluLndyaXRlKHByb21wdCk7CiAgICAgIGNwLnN0ZGluLmVuZCgpOwogICAgfSk7CiAgfSBmaW5hbGx5IHsKICAgIF9yZWxlYXNlKCk7CiAgfQp9CgpmdW5jdGlvbiBjb3JzKHJlcykgewogIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7CiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICcqJyk7CiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycsICdQT1NULCBPUFRJT05TJyk7Cn0KCmZ1bmN0aW9uIHNlbmRKU09OKHJlcywgb2JqLCBjb2RlID0gMjAwKSB7IHJlcy53cml0ZUhlYWQoY29kZSwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KG9iaikpOyB9CmZ1bmN0aW9uIHJlYWRCb2R5KHJlcSkgeyByZXR1cm4gbmV3IFByb21pc2UociA9PiB7IGxldCBiID0gJyc7IHJlcS5vbignZGF0YScsIGMgPT4gKGIgKz0gYykpOyByZXEub24oJ2VuZCcsICgpID0+IHIoYikpOyB9KTsgfQoKLy8g4pSA4pSAIMSQxIJORyBOSOG6rFAgUVVBIFdFQiAoQ8OhY2ggQikg4oCUIGtow7RuZyBj4bqnbiB0ZXJtaW5hbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKLy8gQuG7jWMgbOG7h25oIGxvZ2luIGPhu6dhIENMSTogYuG6r3QgVVJMIG7DsyBpbiByYSDihpIgaGnhu4duIGzDqm4gd2ViIOKGkiBuaOG6rW4gY29kZSB04burIHdlYiDihpIgxJHhuql5IHbDoG8gc3RkaW4uCmNvbnN0IExPR0lOX0FSR1MgPSBFTkdJTkUgPT09ICdjb2RleCcgPyBbJ2xvZ2luJ10gOiBbJ3NldHVwLXRva2VuJ107CmxldCBsb2dpbiA9IG51bGw7ICAgLy8geyBwcm9jLCB1cmwsIGRvbmUsIGVycm9yLCBidWYgfQoKZnVuY3Rpb24gc3RhcnRMb2dpblByb2MoKSB7CiAgaWYgKGxvZ2luICYmIGxvZ2luLnByb2MpIHsgdHJ5IHsgbG9naW4ucHJvYy5raWxsKCdTSUdLSUxMJyk7IH0gY2F0Y2gge30gfQogIGxvZ2luID0geyBwcm9jOiBudWxsLCB1cmw6IG51bGwsIGRvbmU6IGZhbHNlLCBlcnJvcjogbnVsbCwgYnVmOiAnJyB9OwogIGNvbnN0IGNwID0gc3Bhd24oRU5HSU5FLCBMT0dJTl9BUkdTLCB7IGVudjogcHJvY2Vzcy5lbnYsIHNoZWxsOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInIH0pOwogIGxvZ2luLnByb2MgPSBjcDsKICBjb25zdCBvbkRhdGEgPSBkID0+IHsKICAgIGxvZ2luLmJ1ZiArPSBkLnRvU3RyaW5nKCk7CiAgICBpZiAoIWxvZ2luLnVybCkgeyBjb25zdCBtID0gbG9naW4uYnVmLm1hdGNoKC9odHRwcz86XC9cL1teXHMnIl0rLyk7IGlmIChtKSBsb2dpbi51cmwgPSBtWzBdOyB9CiAgfTsKICBjcC5zdGRvdXQub24oJ2RhdGEnLCBvbkRhdGEpOwogIGNwLnN0ZGVyci5vbignZGF0YScsIG9uRGF0YSk7CiAgY3Aub24oJ2Vycm9yJywgZSA9PiB7IGxvZ2luLmVycm9yID0gZS5tZXNzYWdlOyB9KTsKICBjcC5vbignY2xvc2UnLCBjb2RlID0+IHsgbG9naW4uZG9uZSA9IGNvZGUgPT09IDA7IGlmIChjb2RlICE9PSAwICYmICFsb2dpbi5lcnJvcikgbG9naW4uZXJyb3IgPSAnZXhpdCAnICsgY29kZSArIChsb2dpbi5idWYgPyAnOiAnICsgbG9naW4uYnVmLnNsaWNlKC0yMDApIDogJycpOyB9KTsKfQoKY29uc3QgTE9HSU5fSFRNTCA9IGA8IWRvY3R5cGUgaHRtbD48bWV0YSBjaGFyc2V0PSJ1dGYtOCI+PHRpdGxlPsSQxINuZyBuaOG6rXAgZ8OzaSBDbGF1ZGU8L3RpdGxlPgo8c3R5bGU+Ym9keXtmb250OjE1cHgvMS42IC1hcHBsZS1zeXN0ZW0sU2Vnb2UgVUksUm9ib3RvLHNhbnMtc2VyaWY7bWF4LXdpZHRoOjU2MHB4O21hcmdpbjo0MHB4IGF1dG87cGFkZGluZzowIDIwcHg7Y29sb3I6IzFhMWEyZX0KaDJ7Zm9udC1zaXplOjIwcHh9YnV0dG9ue2JhY2tncm91bmQ6IzdjNWNmZjtjb2xvcjojZmZmO2JvcmRlcjowO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCAxNnB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTRweH0KYnV0dG9uLmd7YmFja2dyb3VuZDojZWVlO2NvbG9yOiMzMzN9aW5wdXR7d2lkdGg6MTAwJTtwYWRkaW5nOjEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjY2NjO2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxNHB4O2JveC1zaXppbmc6Ym9yZGVyLWJveH0KLmJveHtib3JkZXI6MXB4IHNvbGlkICNlM2UzZWY7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MThweDttYXJnaW4tdG9wOjE2cHh9YXtjb2xvcjojN2M1Y2ZmO3dvcmQtYnJlYWs6YnJlYWstYWxsfS5va3tjb2xvcjojMTZhMzRhfS5lcnJ7Y29sb3I6I2RjMjYyNn0ubXV0ZWR7Y29sb3I6Izg4ODtmb250LXNpemU6MTNweH08L3N0eWxlPgo8aDI+8J+UkCDEkMSDbmcgbmjhuq1wIGfDs2kgQ2xhdWRlIChraMO0bmcgY+G6p24gdGVybWluYWwpPC9oMj4KPHAgY2xhc3M9Im11dGVkIj7EkMSDbmcgbmjhuq1wIGLhurFuZyBnw7NpIENsYXVkZS9DaGF0R1BUIGPhu6dhIGLhuqFuIMSR4buDIGJyaWRnZSBkw7luZyDEkcaw4bujYy4gQ2jhu4kgbMOgbSAxIGzhuqduLjwvcD4KPGJ1dHRvbiBpZD0ic3RhcnQiPkLhuq90IMSR4bqndSDEkcSDbmcgbmjhuq1wPC9idXR0b24+CjxkaXYgaWQ9InN0ZXAiIGNsYXNzPSJib3giIHN0eWxlPSJkaXNwbGF5Om5vbmUiPgogIDxkaXY+MS4gTeG7nyBsaW5rIG7DoHkgxJHhu4MgxJHEg25nIG5o4bqtcDo8L2Rpdj4KICA8cD48YSBpZD0idXJsIiB0YXJnZXQ9Il9ibGFuayI+PC9hPjwvcD4KICA8ZGl2PjIuIMSQxINuZyBuaOG6rXAgeG9uZywgbuG6v3UgdHJhbmcgaGnhu4duIDxiPm3DoyAoY29kZSk8L2I+IHRow6wgZMOhbiB2w6BvIMSRw6J5OjwvZGl2PgogIDxpbnB1dCBpZD0iY29kZSIgcGxhY2Vob2xkZXI9IkTDoW4gY29kZSAobuG6v3UgY8OzKSBy4buTaSBi4bqlbSBYw6FjIG5o4bqtbiI+CiAgPHA+PGJ1dHRvbiBpZD0ic3VibWl0Ij5Yw6FjIG5o4bqtbjwvYnV0dG9uPiA8c3BhbiBpZD0ibXNnIiBjbGFzcz0ibXV0ZWQiPjwvc3Bhbj48L3A+CjwvZGl2Pgo8ZGl2IGlkPSJkb25lQm94IiBjbGFzcz0iYm94IG9rIiBzdHlsZT0iZGlzcGxheTpub25lIj7inIUgxJDEg25nIG5o4bqtcCB0aMOgbmggY8O0bmchIEJyaWRnZSDEkcOjIHPhurVuIHPDoG5nLiDEkMOzbmcgdGFiIG7DoHkgxJHGsOG7o2MgcuG7k2kuPC9kaXY+CjxzY3JpcHQ+CmNvbnN0ICQ9aWQ9PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtsZXQgcG9sbD1udWxsOwphc3luYyBmdW5jdGlvbiBwb3N0KHUsYil7Y29uc3Qgcj1hd2FpdCBmZXRjaCh1LHttZXRob2Q6J1BPU1QnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sYm9keTpiP0pTT04uc3RyaW5naWZ5KGIpOm51bGx9KTtyZXR1cm4gci5qc29uKCl9CmFzeW5jIGZ1bmN0aW9uIHN0YXR1cygpe2NvbnN0IHI9YXdhaXQgZmV0Y2goJy9sb2dpbi9zdGF0dXMnKTtyZXR1cm4gci5qc29uKCl9CmZ1bmN0aW9uIHN0YXJ0UG9sbCgpe2NsZWFySW50ZXJ2YWwocG9sbCk7cG9sbD1zZXRJbnRlcnZhbChhc3luYygpPT57Y29uc3Qgcz1hd2FpdCBzdGF0dXMoKTsKICBpZihzLnVybCYmISQoJ3VybCcpLmhyZWYpeyQoJ3VybCcpLmhyZWY9cy51cmw7JCgndXJsJykudGV4dENvbnRlbnQ9cy51cmw7JCgnc3RlcCcpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJ30KICBpZihzLmVycm9yKXskKCdtc2cnKS5pbm5lckhUTUw9JzxzcGFuIGNsYXNzPWVycj4nK3MuZXJyb3IrJzwvc3Bhbj4nfQogIGlmKHMuZG9uZSl7Y2xlYXJJbnRlcnZhbChwb2xsKTskKCdzdGVwJykuc3R5bGUuZGlzcGxheT0nbm9uZSc7JCgnZG9uZUJveCcpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJ30KfSwxNTAwKX0KJCgnc3RhcnQnKS5vbmNsaWNrPWFzeW5jKCk9PnskKCdzdGFydCcpLmRpc2FibGVkPXRydWU7JCgnc3RhcnQnKS50ZXh0Q29udGVudD0nxJBhbmcga2jhu59pIMSR4buZbmcuLi4nO2F3YWl0IHBvc3QoJy9sb2dpbi9zdGFydCcpO3N0YXJ0UG9sbCgpfTsKJCgnc3VibWl0Jykub25jbGljaz1hc3luYygpPT57JCgnbXNnJykudGV4dENvbnRlbnQ9J8SQYW5nIHjDoWMgbmjhuq1uLi4uJzthd2FpdCBwb3N0KCcvbG9naW4vY29kZScse2NvZGU6JCgnY29kZScpLnZhbHVlfSk7fTsKPC9zY3JpcHQ+YDsKCmh0dHAuY3JlYXRlU2VydmVyKGFzeW5jIChyZXEsIHJlcykgPT4gewogIGNvcnMocmVzKTsKICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7IHJlcy53cml0ZUhlYWQoMjA0KTsgcmV0dXJuIHJlcy5lbmQoKTsgfQogIGNvbnN0IHBhdGggPSAocmVxLnVybCB8fCAnJykuc3BsaXQoJz8nKVswXTsKCiAgLy8gVHJhbmcgxJHEg25nIG5o4bqtcCBxdWEgd2ViIChDw6FjaCBCKQogIGlmIChyZXEubWV0aG9kID09PSAnR0VUJyAmJiBwYXRoID09PSAnL2xvZ2luJykgeyByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcgfSk7IHJldHVybiByZXMuZW5kKExPR0lOX0hUTUwpOyB9CiAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJyAmJiBwYXRoID09PSAnL2xvZ2luL3N0YXJ0JykgeyBzdGFydExvZ2luUHJvYygpOyByZXR1cm4gc2VuZEpTT04ocmVzLCB7IG9rOiB0cnVlIH0pOyB9CiAgaWYgKHJlcS5tZXRob2QgPT09ICdHRVQnICYmIHBhdGggPT09ICcvbG9naW4vc3RhdHVzJykgeyByZXR1cm4gc2VuZEpTT04ocmVzLCBsb2dpbiA/IHsgdXJsOiBsb2dpbi51cmwsIGRvbmU6IGxvZ2luLmRvbmUsIGVycm9yOiBsb2dpbi5lcnJvciB9IDogeyBlcnJvcjogJ2NoxrBhIGLhuq90IMSR4bqndScgfSk7IH0KICBpZiAocmVxLm1ldGhvZCA9PT0gJ1BPU1QnICYmIHBhdGggPT09ICcvbG9naW4vY29kZScpIHsKICAgIGNvbnN0IGIgPSBhd2FpdCByZWFkQm9keShyZXEpOyBsZXQgY29kZSA9ICcnOyB0cnkgeyBjb2RlID0gSlNPTi5wYXJzZShiIHx8ICd7fScpLmNvZGUgfHwgJyc7IH0gY2F0Y2gge30KICAgIGlmICghbG9naW4gfHwgIWxvZ2luLnByb2MpIHJldHVybiBzZW5kSlNPTihyZXMsIHsgZXJyb3I6ICdDaMawYSBi4bqvdCDEkeG6p3UgxJHEg25nIG5o4bqtcC4nIH0sIDQwMCk7CiAgICB0cnkgeyBsb2dpbi5wcm9jLnN0ZGluLndyaXRlKFN0cmluZyhjb2RlKS50cmltKCkgKyAnXG4nKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gc2VuZEpTT04ocmVzLCB7IGVycm9yOiBlLm1lc3NhZ2UgfSwgNTAwKTsgfQogICAgcmV0dXJuIHNlbmRKU09OKHJlcywgeyBvazogdHJ1ZSB9KTsKICB9CgogIC8vIEFQSSB04bqhbyB2xINuIGLhuqNuIChPcGVuQUktY29tcGF0aWJsZSkgY2hvIGNodWtpZW5tZWRpYQogIGlmIChyZXEubWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aC5pbmNsdWRlcygnL2NoYXQvY29tcGxldGlvbnMnKSkgewogICAgaWYgKFRPS0VOKSB7IGNvbnN0IGF1dGggPSAocmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbiB8fCAnJykucmVwbGFjZSgvXkJlYXJlclxzKy9pLCAnJyk7IGlmIChhdXRoICE9PSBUT0tFTikgeyByZXMud3JpdGVIZWFkKDQwMSk7IHJldHVybiByZXMuZW5kKCd1bmF1dGhvcml6ZWQnKTsgfSB9CiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEJvZHkocmVxKTsKICAgIHRyeSB7CiAgICAgIGNvbnN0IHsgbWVzc2FnZXMsIG1vZGVsIH0gPSBKU09OLnBhcnNlKGJvZHkgfHwgJ3t9Jyk7CiAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCBydW5DTEkoYnVpbGRQcm9tcHQobWVzc2FnZXMpLCBtb2RlbCk7CiAgICAgIHJldHVybiBzZW5kSlNPTihyZXMsIHsgY2hvaWNlczogW3sgaW5kZXg6IDAsIG1lc3NhZ2U6IHsgcm9sZTogJ2Fzc2lzdGFudCcsIGNvbnRlbnQ6IHRleHQgfSwgZmluaXNoX3JlYXNvbjogJ3N0b3AnIH1dIH0pOwogICAgfSBjYXRjaCAoZSkgewogICAgICBjb25zb2xlLmVycm9yKCdicmlkZ2UgZXJyb3I6JywgZS5tZXNzYWdlIHx8IGUpOwogICAgICByZXR1cm4gc2VuZEpTT04ocmVzLCB7IGVycm9yOiB7IG1lc3NhZ2U6IFN0cmluZyhlLm1lc3NhZ2UgfHwgZSkgfSB9LCA1MDApOwogICAgfQogIH0KCiAgcmVzLndyaXRlSGVhZCg0MDQpOyByZXMuZW5kKCdub3QgZm91bmQnKTsKfSkubGlzdGVuKFBPUlQsICcxMjcuMC4wLjEnLCAoKSA9PiB7ICAgLy8gQ0jhu4ggbG9jYWxob3N0IOKAlCBtw6F5IGtow6FjIHRyb25nIG3huqFuZyBLSMOUTkcgZ+G7jWkgxJHGsOG7o2MKICBjb25zb2xlLmxvZyhg4pyFICR7RU5HSU5FfSBicmlkZ2UgY2jhuqF5IHThuqFpIGh0dHA6Ly9sb2NhbGhvc3Q6JHtQT1JUfSAg4oaSIGTDoW4gdsOgbyBjaHVraWVubWVkaWFgKTsKICBjb25zb2xlLmxvZyhgICAgxJDEg25nIG5o4bqtcCBraMO0bmcgY+G6p24gdGVybWluYWw6IG3hu58gaHR0cDovL2xvY2FsaG9zdDoke1BPUlR9L2xvZ2luYCk7Cn0pOwo=',
  "Bridge.command": 'IyEvYmluL2Jhc2gKIyDEkEnhu4BVIEtISeG7gk4gQlJJREdFIChNYWMpIOKAlCAxIGZpbGUgbMOgbSBo4bq/dC4gQuG6pW0gxJHDunAgxJHhu4MgbeG7nyBtZW51LgpjZCAiJChkaXJuYW1lICIkMCIpIgpESVI9IiQocHdkKSIKQlJJREdFPSIkRElSL2NsYXVkZS1icmlkZ2UuanMiCgplbnN1cmVfbm9kZSgpeyBjb21tYW5kIC12IG5vZGUgPi9kZXYvbnVsbCAyPiYxIHx8IHsgZWNobyAi4p2MIENoxrBhIGPDoGkgTm9kZS5qcy4gTeG7nyBub2RlanMub3JnLCBjw6BpIHLhu5NpIGNo4bqheSBs4bqhaS4iOyBvcGVuIGh0dHBzOi8vbm9kZWpzLm9yZyAyPi9kZXYvbnVsbDsgcmV0dXJuIDE7IH07IH0KZW5zdXJlX2NsaSgpewogIGlmIFsgIiQxIiA9ICJjb2RleCIgXTsgdGhlbiBjb21tYW5kIC12IGNvZGV4ID4vZGV2L251bGwgMj4mMSB8fCB7IGVjaG8gIuKGkiBDw6BpIENvZGV4IENMSS4uLiI7IG5wbSBpbnN0YWxsIC1nIEBvcGVuYWkvY29kZXggMj4vZGV2L251bGwgfHwgc3VkbyBucG0gaW5zdGFsbCAtZyBAb3BlbmFpL2NvZGV4OyB9CiAgZWxzZSBjb21tYW5kIC12IGNsYXVkZSA+L2Rldi9udWxsIDI+JjEgfHwgeyBlY2hvICLihpIgQ8OgaSBDbGF1ZGUgQ0xJLi4uIjsgbnBtIGluc3RhbGwgLWcgQGFudGhyb3BpYy1haS9jbGF1ZGUtY29kZSAyPi9kZXYvbnVsbCB8fCBzdWRvIG5wbSBpbnN0YWxsIC1nIEBhbnRocm9waWMtYWkvY2xhdWRlLWNvZGU7IH07IGZpCn0KCnN0YXJ0X2JnKCl7ICMgZW5naW5lIHBvcnQgbGFiZWwKICBsb2NhbCBlbmdpbmU9JDEgcG9ydD0kMiBsYWJlbD0kMwogIGxvY2FsIE5PREUgTkQgQ0QgUExJU1QKICBOT0RFPSIkKGNvbW1hbmQgLXYgbm9kZSkiOyBORD0iJChkaXJuYW1lICIkTk9ERSIpIgogIENEPSIkKGRpcm5hbWUgIiQoY29tbWFuZCAtdiAke2VuZ2luZS9jb2RleC9jb2RleH0gMj4vZGV2L251bGwgfHwgZWNobyAiJE5EL3giKSIpIgogIFBMSVNUPSIkSE9NRS9MaWJyYXJ5L0xhdW5jaEFnZW50cy8kbGFiZWwucGxpc3QiCiAgbWtkaXIgLXAgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzIgogIGNhdCA+ICIkUExJU1QiIDw8RU9GCjw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04Ij8+CjwhRE9DVFlQRSBwbGlzdCBQVUJMSUMgIi0vL0FwcGxlLy9EVEQgUExJU1QgMS4wLy9FTiIgImh0dHA6Ly93d3cuYXBwbGUuY29tL0RURHMvUHJvcGVydHlMaXN0LTEuMC5kdGQiPgo8cGxpc3QgdmVyc2lvbj0iMS4wIj48ZGljdD4KPGtleT5MYWJlbDwva2V5PjxzdHJpbmc+JGxhYmVsPC9zdHJpbmc+CjxrZXk+UHJvZ3JhbUFyZ3VtZW50czwva2V5PjxhcnJheT48c3RyaW5nPiROT0RFPC9zdHJpbmc+PHN0cmluZz4kQlJJREdFPC9zdHJpbmc+PC9hcnJheT4KPGtleT5FbnZpcm9ubWVudFZhcmlhYmxlczwva2V5PjxkaWN0Pgo8a2V5PkJSSURHRV9FTkdJTkU8L2tleT48c3RyaW5nPiRlbmdpbmU8L3N0cmluZz4KPGtleT5CUklER0VfUE9SVDwva2V5PjxzdHJpbmc+JHBvcnQ8L3N0cmluZz4KPGtleT5QQVRIPC9rZXk+PHN0cmluZz4kTkQ6JENEOi91c3IvYmluOi9iaW46L3Vzci9zYmluOi9zYmluPC9zdHJpbmc+CjxrZXk+SE9NRTwva2V5PjxzdHJpbmc+JEhPTUU8L3N0cmluZz48L2RpY3Q+CjxrZXk+UnVuQXRMb2FkPC9rZXk+PHRydWUvPjxrZXk+S2VlcEFsaXZlPC9rZXk+PHRydWUvPgo8a2V5PlN0YW5kYXJkT3V0UGF0aDwva2V5PjxzdHJpbmc+JERJUi9icmlkZ2UtJGVuZ2luZS5sb2c8L3N0cmluZz4KPGtleT5TdGFuZGFyZEVycm9yUGF0aDwva2V5PjxzdHJpbmc+JERJUi9icmlkZ2UtJGVuZ2luZS5sb2c8L3N0cmluZz4KPC9kaWN0PjwvcGxpc3Q+CkVPRgogIGxhdW5jaGN0bCB1bmxvYWQgIiRQTElTVCIgMj4vZGV2L251bGw7IGxhdW5jaGN0bCBsb2FkICIkUExJU1QiOyBzbGVlcCAxCiAgZWNobyAi4pyFIELhuq10IG7hu4FuOiAke2VuZ2luZX0g4oCUIGPhu5VuZyAke3BvcnR9ICh04buxIGNo4bqheSBraGkgbeG7nyBtw6F5KS4iCn0KCnN0YXR1cygpewogIGZvciBwbiBpbiAiODc5MDpDbGF1ZGUiICI4NzkxOkNoYXRHUFQiOyBkbwogICAgbG9jYWwgcG9ydD0ke3BuJSU6Kn0gbmFtZT0ke3BuIyMqOn0KICAgIGlmIGN1cmwgLXMgLW0gMiAiaHR0cDovL2xvY2FsaG9zdDokcG9ydCIgPi9kZXYvbnVsbCAyPiYxOyB0aGVuIGVjaG8gIuKchSAkbmFtZSAoY+G7lW5nICRwb3J0KSDEkEFORyBDSOG6oFkiOyBlbHNlIGVjaG8gIuKtlSAkbmFtZSAoY+G7lW5nICRwb3J0KSB04bqvdCI7IGZpCiAgZG9uZQp9Cgp3aGlsZSB0cnVlOyBkbwogIGNsZWFyCiAgZWNobyAi4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEZMT1cgQlJJREdFIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCIKICBlY2hvICIgMSkg4pa2IELhuq10IENMQVVERSAoY2jhuqF5IG7hu4FuLCBj4buVbmcgODc5MCkiCiAgZWNobyAiIDIpIOKWtiBC4bqtdCBDSEFUR1BUIChjaOG6oXkgbuG7gW4sIGPhu5VuZyA4NzkxKSIKICBlY2hvICIgMykg8J+UkCDEkMSDbmcgbmjhuq1wIENsYXVkZSAobMOgbSAxIGzhuqduKSIKICBlY2hvICIgNCkg8J+UkCDEkMSDbmcgbmjhuq1wIENoYXRHUFQgKGzDoG0gMSBs4bqnbikiCiAgZWNobyAiIDUpIOKWoCBU4bqvdCB04bqldCBj4bqjIGJyaWRnZSIKICBlY2hvICIgNikg8J+UjSBLaeG7g20gdHJhIHRy4bqhbmcgdGjDoWkiCiAgZWNobyAiIDApIFRob8OhdCIKICBlY2hvICLilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAiCiAgcmVhZCAtcCAiQ2jhu41uIHPhu5E6ICIgYwogIGVjaG8gIiIKICBjYXNlICIkYyIgaW4KICAgIDEpIGVuc3VyZV9ub2RlICYmIGVuc3VyZV9jbGkgY2xhdWRlICYmIHN0YXJ0X2JnIGNsYXVkZSA4NzkwIGNvbS5jaHVraWVuLmNsaWJyaWRnZSA7OwogICAgMikgZW5zdXJlX25vZGUgJiYgZW5zdXJlX2NsaSBjb2RleCAgJiYgc3RhcnRfYmcgY29kZXggIDg3OTEgY29tLmNodWtpZW4uY29kZXhicmlkZ2UgOzsKICAgIDMpIGVuc3VyZV9ub2RlICYmIGVuc3VyZV9jbGkgY2xhdWRlICYmIHsgZWNobyAi4oaSIMSQxINuZyBuaOG6rXAgeG9uZywgZ8O1IC9leGl0IHLhu5NpIEVudGVyLiI7IGNsYXVkZTsgfSA7OwogICAgNCkgZW5zdXJlX25vZGUgJiYgZW5zdXJlX2NsaSBjb2RleCAgJiYgY29kZXggbG9naW4gOzsKICAgIDUpIGxhdW5jaGN0bCB1bmxvYWQgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzL2NvbS5jaHVraWVuLmNsaWJyaWRnZS5wbGlzdCIgMj4vZGV2L251bGw7IGxhdW5jaGN0bCB1bmxvYWQgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzL2NvbS5jaHVraWVuLmNvZGV4YnJpZGdlLnBsaXN0IiAyPi9kZXYvbnVsbDsgZWNobyAi4pagIMSQw6MgdOG6r3QgdOG6pXQgY+G6oy4iIDs7CiAgICA2KSBzdGF0dXMgOzsKICAgIDApIGV4aXQgMCA7OwogICAgKikgZWNobyAiQ2jhu41uIDAtNi4iIDs7CiAgZXNhYwogIGVjaG8gIiI7IHJlYWQgLXAgIk5o4bqlbiBFbnRlciDEkeG7gyB24buBIG1lbnUuLi4iCmRvbmUK',
  "Bridge.bat": 'QGVjaG8gb2ZmCmNoY3AgNjUwMDEgPm51bApjZCAvZCAiJX5kcDAiCgo6bWVudQpjbHMKZWNobyA9PT09PT09PSBGTE9XIEJSSURHRSA9PT09PT09PQplY2hvICAxKSBCYXQgQ0xBVURFIChjaGF5IG5lbiwgY29uZyA4NzkwKQplY2hvICAyKSBCYXQgQ0hBVEdQVCAoY2hheSBuZW4sIGNvbmcgODc5MSkKZWNobyAgMykgRGFuZyBuaGFwIENsYXVkZSAobGFtIDEgbGFuKQplY2hvICA0KSBEYW5nIG5oYXAgQ2hhdEdQVCAobGFtIDEgbGFuKQplY2hvICA1KSBUYXQgdGF0IGNhIGJyaWRnZQplY2hvICA2KSBLaWVtIHRyYSB0cmFuZyB0aGFpCmVjaG8gIDcpIFR1IGJhdCBraGkgbW8gbWF5ICh0aGVtIHZhbyBTdGFydHVwKQplY2hvICAwKSBUaG9hdAplY2hvID09PT09PT09PT09PT09PT09PT09PT09PT09PT09CnNldCAvcCBjPUNob24gc286CmVjaG8uCmlmICIlYyUiPT0iMSIgKCBjYWxsIDplbnN1cmVOb2RlICYmIGNhbGwgOmVuc3VyZUNsYXVkZSAmJiBzdGFydCAiIiB3c2NyaXB0LmV4ZSAiJX5kcDBoaWRkZW4tY2xhdWRlLnZicyIgJiBlY2hvIERhIGJhdCBDTEFVREUgbmVuLiApCmlmICIlYyUiPT0iMiIgKCBjYWxsIDplbnN1cmVOb2RlICYmIGNhbGwgOmVuc3VyZUNvZGV4ICAmJiBzdGFydCAiIiB3c2NyaXB0LmV4ZSAiJX5kcDBoaWRkZW4tY2hhdGdwdC52YnMiICYgZWNobyBEYSBiYXQgQ0hBVEdQVCBuZW4uICkKaWYgIiVjJSI9PSIzIiAoIGNhbGwgOmVuc3VyZUNsYXVkZSAmJiBjbGF1ZGUgKQppZiAiJWMlIj09IjQiICggY2FsbCA6ZW5zdXJlQ29kZXggJiYgY29kZXggbG9naW4gKQppZiAiJWMlIj09IjUiICggdGFza2tpbGwgL0YgL0lNIG5vZGUuZXhlID5udWwgMj5udWwgJiBlY2hvIERhIHRhdCB0YXQgY2EuICkKaWYgIiVjJSI9PSI2IiAoIGNhbGwgOnN0YXR1cyApCmlmICIlYyUiPT0iNyIgKAogIGNvcHkgL1kgIiV+ZHAwaGlkZGVuLWNsYXVkZS52YnMiICAiJUFQUERBVEElXE1pY3Jvc29mdFxXaW5kb3dzXFN0YXJ0IE1lbnVcUHJvZ3JhbXNcU3RhcnR1cFwiID5udWwKICBjb3B5IC9ZICIlfmRwMGhpZGRlbi1jaGF0Z3B0LnZicyIgIiVBUFBEQVRBJVxNaWNyb3NvZnRcV2luZG93c1xTdGFydCBNZW51XFByb2dyYW1zXFN0YXJ0dXBcIiA+bnVsCiAgZWNobyBEYSB0aGVtIHZhbyBTdGFydHVwIC0gdHUgYmF0IGtoaSBtbyBtYXkuCikKaWYgIiVjJSI9PSIwIiBleGl0CmVjaG8uCnBhdXNlCmdvdG8gbWVudQoKOmVuc3VyZU5vZGUKd2hlcmUgbm9kZSA+bnVsIDI+bnVsIHx8ICggZWNobyBDYWkgTm9kZS5qcyB0YWkgbm9kZWpzLm9yZyByb2kgY2hheSBsYWkuICYgc3RhcnQgaHR0cHM6Ly9ub2RlanMub3JnICYgZXhpdCAvYiAxICkKZXhpdCAvYiAwCjplbnN1cmVDbGF1ZGUKd2hlcmUgY2xhdWRlID5udWwgMj5udWwgfHwgKCBlY2hvIENhaSBDbGF1ZGUgQ0xJLi4uICYgY2FsbCBucG0gaW5zdGFsbCAtZyBAYW50aHJvcGljLWFpL2NsYXVkZS1jb2RlICkKZXhpdCAvYiAwCjplbnN1cmVDb2RleAp3aGVyZSBjb2RleCA+bnVsIDI+bnVsIHx8ICggZWNobyBDYWkgQ29kZXggQ0xJLi4uICYgY2FsbCBucG0gaW5zdGFsbCAtZyBAb3BlbmFpL2NvZGV4ICkKZXhpdCAvYiAwCjpzdGF0dXMKY3VybCAtcyAtbSAyIGh0dHA6Ly9sb2NhbGhvc3Q6ODc5MCA+bnVsIDI+bnVsICYmIGVjaG8gQ2xhdWRlIDg3OTA6IERBTkcgQ0hBWSB8fCBlY2hvIENsYXVkZSA4NzkwOiB0YXQKY3VybCAtcyAtbSAyIGh0dHA6Ly9sb2NhbGhvc3Q6ODc5MSA+bnVsIDI+bnVsICYmIGVjaG8gQ2hhdEdQVCA4NzkxOiBEQU5HIENIQVkgfHwgZWNobyBDaGF0R1BUIDg3OTE6IHRhdApleGl0IC9iIDAK',
  "hidden-claude.vbs": 'JyBDaOG6oXkgYnJpZGdlIENsYXVkZSAoY+G7lW5nIDg3OTApIOG6qW4sIGtow7RuZyBoaeG7h24gY+G7rWEgc+G7lS4gQuG6pW0gxJHDunAgxJHhu4MgYuG6rXQgbuG7gW4uClNldCBzaCA9IENyZWF0ZU9iamVjdCgiV1NjcmlwdC5TaGVsbCIpClNldCBmc28gPSBDcmVhdGVPYmplY3QoIlNjcmlwdGluZy5GaWxlU3lzdGVtT2JqZWN0IikKZGlyID0gZnNvLkdldFBhcmVudEZvbGRlck5hbWUoV1NjcmlwdC5TY3JpcHRGdWxsTmFtZSkKc2guQ3VycmVudERpcmVjdG9yeSA9IGRpcgpzaC5SdW4gIm5vZGUgIiIiICYgZGlyICYgIlxjbGF1ZGUtYnJpZGdlLmpzIiIiLCAwLCBGYWxzZQo=',
  "hidden-chatgpt.vbs": 'JyBDaOG6oXkgYnJpZGdlIENoYXRHUFQgKGPhu5VuZyA4NzkxKSDhuqluLCBraMO0bmcgaGnhu4duIGPhu61hIHPhu5UuIELhuqVtIMSRw7pwIMSR4buDIGLhuq10IG7hu4FuLgpTZXQgc2ggPSBDcmVhdGVPYmplY3QoIldTY3JpcHQuU2hlbGwiKQpTZXQgZnNvID0gQ3JlYXRlT2JqZWN0KCJTY3JpcHRpbmcuRmlsZVN5c3RlbU9iamVjdCIpClNldCBlbnYgPSBzaC5FbnZpcm9ubWVudCgiUHJvY2VzcyIpCmVudigiQlJJREdFX0VOR0lORSIpID0gImNvZGV4IgplbnYoIkJSSURHRV9QT1JUIikgPSAiODc5MSIKZGlyID0gZnNvLkdldFBhcmVudEZvbGRlck5hbWUoV1NjcmlwdC5TY3JpcHRGdWxsTmFtZSkKc2guQ3VycmVudERpcmVjdG9yeSA9IGRpcgpzaC5SdW4gIm5vZGUgIiIiICYgZGlyICYgIlxjbGF1ZGUtYnJpZGdlLmpzIiIiLCAwLCBGYWxzZQo=',
  "HUONG-DAN.txt": 'PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KIETDmU5HIEfDk0kgQ0xBVURFIC8gQ0hBVEdQVCBD4bumQSBC4bqgTiBDSE8gQ0hVS0lFTk1FRElBCiAoa2jDtG5nIGPhuqduIG11YSBBUEkga2V5KQo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoKQuG6oW4gY2jhuqF5IDEgImJyaWRnZSIgbmjhu48gdHLDqm4gbcOheSAtPiBkw7luZyBjaMOtbmggZ8OzaSBDbGF1ZGUgKFByby9NYXgpCmhv4bq3YyBDaGF0R1BUIChQbHVzL1BybykgY+G7p2EgYuG6oW4gdHJvbmcgdG9vbC4gQ8OgaSAxIEzhuqZOLCBzYXUgxJHDsyB04buxIGNo4bqheS4KCgotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpCxq/hu5pDIDAg4oCUIEPDgEkgTk9ERS5KUyAobMOgbSAxIGzhuqduKQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpWw6BvIHRyYW5nICBub2RlanMub3JnICAtPiB04bqjaSBi4bqjbiBMVFMgLT4gY8OgaSBuaMawIHBo4bqnbiBt4buBbSBiw6xuaCB0aMaw4budbmcuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyAxIOKAlCBN4bueIELhuqJORyDEkEnhu4BVIEtISeG7gk4KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBNQUM6ICAgICBi4bqlbSDEkcO6cCBmaWxlICBCcmlkZ2UuY29tbWFuZAogICAgICAgICAgIChs4bqnbiDEkeG6p3UgTWFjIGNo4bq3biAtPiBjaHXhu5l0IHBo4bqjaSAtPiBPcGVuIC0+IE9wZW4pCgotIFdJTkRPV1M6IGLhuqVtIMSRw7pwIGZpbGUgIEJyaWRnZS5iYXQKICAgICAgICAgICAoYsOhbyBj4bqjbmggLT4gTW9yZSBpbmZvIC0+IFJ1biBhbnl3YXkpCgpT4bq9IGhp4buHbiBNRU5VIGNo4buNbiBz4buROgogICAgMSkgQuG6rXQgQ0xBVURFIChjaOG6oXkgbuG7gW4pCiAgICAyKSBC4bqtdCBDSEFUR1BUIChjaOG6oXkgbuG7gW4pCiAgICAzKSDEkMSDbmcgbmjhuq1wIENsYXVkZQogICAgNCkgxJDEg25nIG5o4bqtcCBDaGF0R1BUCiAgICA1KSBU4bqvdCB04bqldCBj4bqjCiAgICA2KSBLaeG7g20gdHJhIHRy4bqhbmcgdGjDoWkKICAgIDcpIChXaW5kb3dzKSBU4buxIGLhuq10IGtoaSBt4bufIG3DoXkKCgotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpCxq/hu5pDIDIg4oCUIMSQxIJORyBOSOG6rFAgKGNo4buJIGzDoG0gMSBs4bqnbikKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBEw7luZyBDTEFVREU6ICBjaOG7jW4gMyAtPiDEkcSDbmcgbmjhuq1wIGfDs2kgQ2xhdWRlIHF1YSB0csOsbmggZHV54buHdAogICAgICAgICAgICAgICAgKMSRxINuZyBuaOG6rXAgeG9uZyBnw7UgIC9leGl0ICBy4buTaSBFbnRlcikKCi0gRMO5bmcgQ0hBVEdQVDogY2jhu41uIDQgLT4gxJHEg25nIG5o4bqtcCBnw7NpIENoYXRHUFQgcXVhIHRyw6xuaCBkdXnhu4d0CgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyAzIOKAlCBC4bqsVCBCUklER0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBDaOG7jW4gMSAoQ2xhdWRlKSB2w6AvaG/hurdjIDIgKENoYXRHUFQpIC0+IGNo4bqheSBu4buBbi4KLSBXaW5kb3dzOiBjaOG7jW4gdGjDqm0gNyDEkeG7gyB04buxIGLhuq10IGtoaSBt4bufIG3DoXkuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyA0IOKAlCBO4buQSSBWw4BPIFRPT0wKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KMS4gTeG7nyAgY2h1a2llbm1lZGlhLmNvbSAgLT4gZ8OzYyB0csOhaSAgQVBJIFNldHRpbmdzCjIuIE5ow6AgY3VuZyBj4bqlcDogIENMSSB04buxIGhvc3QKMy4gTW9kZWw6IGNo4buNbiBDbGF1ZGUgaG/hurdjIENoYXRHUFQgKMSR4buLYSBjaOG7iSB04buxIMSRw7puZyA4NzkwIC8gODc5MSkKNC4gQuG6pW0gIEzGsHUgIC0+ICBUZXN0ICAtPiAgcmEgIkNMSSBob+G6oXQgxJHhu5luZyIgbMOgIFhPTkcuCgpU4burIGdp4budOiBt4bufIG3DoXkgLT4gYnJpZGdlIHThu7EgY2jhuqF5IC0+IGNo4buJIG3hu58gdG9vbCBsw6AgZMO5bmcuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KSOG7jkkgTkhBTkgKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KKiBUZXN0IGLDoW8gIkZhaWxlZCB0byBmZXRjaCI/CiAgLT4gQnJpZGdlIGNoxrBhIGNo4bqheS4gTeG7nyBCcmlkZ2UuY29tbWFuZCAvIEJyaWRnZS5iYXQsIGNo4buNbiAxIChob+G6t2MgMikuCgoqIEtp4buDbSB0cmEgYnJpZGdlIGPDsm4gc+G7kW5nPyAgICAgIC0+IG1lbnUgY2jhu41uIDYuCiogxJDEg25nIG5o4bqtcCBs4bqhaSBt4buXaSBs4bqnbiBraMO0bmc/ICAgLT4gS0jDlE5HLCBjaOG7iSAxIGzhuqduLgoqIMSQw7NuZyBj4butYSBz4buVIGPDsyBzYW8ga2jDtG5nPyAgICAgIC0+IEtow7RuZywgYnJpZGdlIGNo4bqheSBu4buBbi4KKiBE4buvIGxp4buHdSBjw7MgbMOqbiBs4buLY2ggc+G7rSBjaGF0PyAgIC0+IEtow7RuZyBoaeG7h24g4bufIGNsYXVkZS5haS9jaGF0Z3B0LmNvbSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmjGsG5nIHbhuqtuIHTDrW5oIHbDoG8gaOG6oW4gbeG7qWMgZ8OzaSBj4bunYSBi4bqhbi4KCkPDoWMgZmlsZSBraMOhYyAoY2xhdWRlLWJyaWRnZS5qcywgaGlkZGVuLSoudmJzLCAqLmxvZykgbMOgIHJ14buZdCBtw6F5LApLSMOUTkcgY+G6p24gYuG6pW0uCj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Cg==',
};

// === L5994-5994: _cliPoll ===
let _cliPoll = null;

// === L6070-6070: _keyVisible ===
let _keyVisible = false;

// === L6148-6148: _upgOrderId ===
let _upgOrderId = null, _upgPollTimer = null, _upgCountTimer = null;

// === L6314-6314: ADMIN_EMAILS ===
const ADMIN_EMAILS = ['admin@novastudio.app', 'admin@novastudio.app', 'admin@novastudio.app'];

// === L6315-6315: ADMIN_UIDS ===
const ADMIN_UIDS = ['UxxIxoq6v1Zk1sa0oc40C7AMuVB3'];

// === L6326-6328: setStatusAdm ===
const setStatusAdm = (m, t) => setStatusBar('statusadm', m, t);

function admFmtDate(ts){ if (!ts) return 'Vĩnh viễn'; try { return new Date(ts).toLocaleDateString('vi-VN'); } catch { return String(ts); } }

// === L6612-6612: _TF_CFG_IDS ===
const _TF_CFG_IDS = ['tfModel', 'tfAspect', 'tfQuality', 'tfConc', 'tfDelay'];

// === L6644-6644: _updState ===
let _updState = null, _appVer = '', _updDismissed = false;

// === L6653-6653: NOVA_AUTH_LINK_HOSTS ===
const NOVA_AUTH_LINK_HOSTS = /(^|\.)(accounts\.google\.com|google\.com|firebaseapp\.com|novastudio\.com)$/i;

// === L6659-6659: NOVA_GET_KEY_LINK_HOSTS ===
const NOVA_GET_KEY_LINK_HOSTS = /(^|\.)(console\.anthropic\.com|platform\.openai\.com|aistudio\.google\.com|console\.cloud\.google\.com|platform\.deepseek\.com|openrouter\.ai|console\.groq\.com|console\.mistral\.ai|dashboard\.cohere\.com|docs\.perplexity\.ai|api\.together\.xyz|fireworks\.ai|pexels\.com|pixabay\.com|unsplash\.com)$/i;

// === L6719-6719: MAC_DL_URL ===
const MAC_DL_URL = 'https://novastudio-vn.netlify.app/#tai-app';

// === L6721-6721: SUPPORT_ZALO ===
const SUPPORT_ZALO = 'https://zalo.me/0373382451';

// === L6722-6722: SUPPORT_YOUTUBE ===
const SUPPORT_YOUTUBE = 'https://www.youtube.com/@DinoFact200-1';

// === L7229-7241: PROD_STEPS ===
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

// === L7338-7339: _autoBusy ===
let _autoBusy = false, _autoAbort = false, _autoState = {}, _autoOutDir = '', _autoTopic = '';
let _autoVoiceFile = null, _autoStartFrom = 'script', _autoDefaultDir = '', _autoScriptText = '';

// === L7339-7339: _autoVoiceFile ===
let _autoVoiceFile = null, _autoStartFrom = 'script', _autoDefaultDir = '', _autoScriptText = '';

// === L7340-7340: _autoSaveMode ===
let _autoSaveMode = 'perTask', _autoSaveName = '';

// === L7402-7402: _autoLastLog ===
let _autoLastLog = null;

// === L7426-7428: _prodQueue ===
let _prodQueue = [], _queueRunning = false, _queueAbort = false, _queueCurId = null, _queueVoice = {}, _flowExhausted = false;
// heavy=true (bước tạo ảnh) → ghi cả ảnh xuống IndexedDB; còn lại chỉ ghi state nhẹ (workData) → đỡ ~8 transaction IDB/bước.
async function _persistJob(heavy){ try { if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile(); await saveState(true, !heavy); } catch (e) {} queueSave(); }

// === L7433-7433: _STEP_TO ===
const _STEP_TO = { cli: 45 * 60000, voice: 30 * 60000, flow: 60 * 60000, local: 40 * 60000 };

// === L7436-7436: _autoRetryTimer ===
let _autoRetryTimer = null; const _RETRY_MIN = 30;

// === L7494-7494: _T2_FIELDS ===
const _T2_FIELDS = { splitMode: 'v', t2DescMode: 'v', minChars: 'v', maxChars: 'v', minSecPerImg: 'v', maxSecPerImg: 'v', batchSize: 'v', shortPromptMode: 'c', highDetailMode: 'c', brollMode: 'c', noCharMode: 'c', hybridIconMode: 'c' };

// === L7495-7495: _VOICE_FIELDS ===
const _VOICE_FIELDS = { voiceLang: 'v', voiceSpeed: 'v', voicePitch: 'v', voiceGap: 'v' };

// === L7871-7871: _QRUN ===
const _QRUN = ['queued', 'running', 'paused'];   // trạng thái còn phải chạy/chạy tiếp

// === L8005-8005: PROVIDER_LABEL ===
const PROVIDER_LABEL = { anthropic: 'Claude', openai: 'OpenAI', deepseek: 'DeepSeek' };

// === L8080-8080: _apiKeyIdx ===
let _apiKeyIdx = 0;

// === L8133-8136: LLM_TIMEOUT_MS ===
const LLM_TIMEOUT_MS = 180000;   // 3 phút/lần gọi — lô nhỏ trả trong ~30-90s; treo thì fail sớm để thử lại nhanh
const LLM_MAX_RETRY  = 4;        // số lần thử lại khi lỗi TẠM (429/5xx/mất mạng/timeout). LƯU Ý lồng trong callLLMJson (3 lần) → đừng để quá cao.
async function _withRetry(fn){
  const MAX = LLM_MAX_RETRY;   // tổng số lần thử

// === L8134-8136: LLM_MAX_RETRY ===
const LLM_MAX_RETRY  = 4;        // số lần thử lại khi lỗi TẠM (429/5xx/mất mạng/timeout). LƯU Ý lồng trong callLLMJson (3 lần) → đừng để quá cao.
async function _withRetry(fn){
  const MAX = LLM_MAX_RETRY;   // tổng số lần thử

// === L8265-8275: LLM_PRICE ===
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

// === L8276-8276: _llmUse ===
let _llmUse = { calls: 0, inTok: 0, cacheTok: 0, outTok: 0, usd: 0, steps: {} };

// === L8277-8279: _llmStep ===
let _llmStep = 'khác';                                   // nhãn bước hiện tại, đặt ở các vòng lặp lớn
function _llmTrack(model, u){
  if (!u) return;

// === L8290-8290: _k ===
const _k = n => (n / 1000).toFixed(1) + 'k';

// === L8677-8677: _novaLog ===
let _novaLog = [];

// === L8735-8735: __epInited ===
let __epInited = false;

// === L8848-8848: upState ===
const upState = { items: [], running: false, seq: 0, wired: false };

// === L8965-8965: _upThumbBusy ===
let _upThumbBusy = false;

// === L9504-9511: VOICE_URL ===
let VOICE_URL = 'http://127.0.0.1:8771';   // cổng mặc định; voiceInit() thay bằng URL thật từ main (hỗ trợ backend cũ ở 8770)
// ⚠️ ĐỔI link này thành trang tải + hướng dẫn cài backend giọng nói (voice-studio) của bạn
const VOICE_SETUP_URL = 'https://github.com/khanhtran0393/AI-Novel#giong-noi';
let _voiceReady = false;
let _voiceStarting = null;

async function voiceInit(){
  const st = document.getElementById('voiceBackendStatus');

// === L9506-9506: VOICE_SETUP_URL ===
const VOICE_SETUP_URL = 'https://github.com/khanhtran0393/AI-Novel#giong-noi';

// === L9507-9507: _voiceReady ===
let _voiceReady = false;

// === L9508-9508: _voiceStarting ===
let _voiceStarting = null;

// === L9538-9540: _voiceHW ===
let _voiceHW = null;   // { device, gpu, vram_gb, cpu_cores, profile, recommended }
async function voiceHWNap(){
  if (!_voiceReady) return;

// === L9634-9634: _TTS_TEN ===
const _TTS_TEN = { omni: 'OmniVoice', vieneu: 'VieNeu', xtts: 'XTTS' };

// === L9636-9636: _TTS_BACKEND_ID ===
const _TTS_BACKEND_ID = { omni: 'omnivoice', vieneu: 'vieneu', xtts: 'xtts' };

// === L9637-9637: _GIONG_THU ===
const _GIONG_THU = 'Xin chào, đây là giọng đọc thử của AI Video Studio.';

// === L9643-9643: _voiceBackend ===
let _voiceBackend = 'omni';

// === L9644-9644: _voiceBackendMacDinh ===
let _voiceBackendMacDinh = true;

// === L9649-9653: _BE_MO_TA ===
const _BE_MO_TA = {
  omni:   { mo: 'trên máy · đa ngôn ngữ' },
  vieneu: { mo: 'trên máy · tiếng Việt' },
  xtts:   { mo: 'trên máy · clone giọng' },
};

// === L9655-9655: _giongDS ===
let _giongDS = [];            // danh sách hợp nhất

// === L9656-9661: _giongChon ===
let _giongChon = '';          // khoá giọng đang chọn
let _giongLoc = '*';          // chip lọc đang bật
let _giongPhat = '';          // khoá đang phát thử
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được
let _giongAudio = null;       // thẻ audio dùng chung cho nghe thử
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9657-9661: _giongLoc ===
let _giongLoc = '*';          // chip lọc đang bật
let _giongPhat = '';          // khoá đang phát thử
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được
let _giongAudio = null;       // thẻ audio dùng chung cho nghe thử
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9658-9661: _giongPhat ===
let _giongPhat = '';          // khoá đang phát thử
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được
let _giongAudio = null;       // thẻ audio dùng chung cho nghe thử
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9659-9661: _giongTao ===
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được
let _giongAudio = null;       // thẻ audio dùng chung cho nghe thử
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9660-9661: _giongAudio ===
let _giongAudio = null;       // thẻ audio dùng chung cho nghe thử
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9661-9661: _giongMau ===
const _giongMau = new Map();  // khoá → objectURL mẫu 4 giây (khỏi gọi lại)

// === L9662-9662: _giongSu ===
let _giongSu = [];            // lịch sử bản đã tạo trong phiên

// === L9663-9663: _giongTT ===
let _giongTT = { omni: 'no', vieneu: 'no', xtts: 'no' };

// === L9664-9664: _giongThemMo ===
let _giongThemMo = false;

// === L9665-9665: _giongBusy ===
let _giongBusy = false;

// === L9713-9716: voiceLoadVoices ===
const voiceLoadVoices = giongTaiDS;   // tên cũ voiceInit() còn gọi

function _giongHop(v){
  if (_giongLoc === '*') return true;

// === L9854-9854: _GIONG_MAU_V ===
const _GIONG_MAU_V = 'v1';

// === L10187-10187: _GIONG_DOAN_RE ===
const _GIONG_DOAN_RE = /^Đoạn (\d+)\/(\d+) · (.+)$/;

// === L10478-10478: _giongLuoiMo ===
let _giongLuoiMo = false;

// === L10522-10522: mvScenes ===
let mvScenes = [];

// === L10523-10523: mvUploaded ===
let mvUploaded = [];   // ảnh test tải lên trực tiếp (không cần pipeline trước)

// === L10660-10660: tvState ===
const tvState = { mode: 'scene', selected: new Set(), initSel: false };

// === L10734-10734: mvVideoBlobs ===
let mvVideoBlobs = {};   // {id:{b64,mime}} — nạp từ IndexedDB (lưu bền qua reload)

// === L10905-10905: tvResults ===
let tvResults = [];   // [{id,name,status:'wait|gen|done|err',pct,videoUrl,b64,mime,err,_item}]

// === L11021-11021: tvModelKeys ===
let tvModelKeys = {};

// === L11022-11022: TV_MODEL_LABEL ===
const TV_MODEL_LABEL = { 'omni-flash': 'Omni Flash', 'veo31-lite': 'Veo 3.1 Lite', 'veo31-fast': 'Veo 3.1 Fast', 'veo31-quality': 'Veo 3.1 Quality' };

// === L11024-11024: TV_BUILTIN_MODEL_KEYS ===
const TV_BUILTIN_MODEL_KEYS = { 'omni-flash': 'abra_t2v_8s', 'veo31-fast': 'veo_3_1_t2v_fast', 'veo31-lite': 'veo_3_1_t2v_lite', 'veo31-quality': 'veo_3_1_t2v' };

// === L11401-11401: _libTab ===
let _libTab = 'chars';

// === L11558-11599: IDB ===
const IDB = {
  db: null,
  async open(){
    if (this.db) return this.db;
    return new Promise((res, rej) => {
      const r = indexedDB.open('AI Video Studio', 1);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async set(key, value){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(key){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  async del(key){
    const db = await this.open();
    return new Promise((res) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
};

// === L11667-11667: _WD_LIGHT_KEYS ===
const _WD_LIGHT_KEYS = ['script', 'videoLogline', 'videoLoglineSig', 'thumbUrl', 'exportPath', 'videoMix', 'stockMix', 'ytMix', 'stockType', 'seo', 'seoTitle', 'descMode', 't3Era', 't3BgLayout', 'sceneTypesOn'];

// === L11789-11794: PRESET ===
const PRESET = {
  characterStyleB: "Simple stick figure character, large round white circle head (pure white no fill), two small black dot eyes, simple curved smile, thin single black line body arms legs, minimal clothing suggestion with flat color fill, NO detailed features, hand-drawn cartoon style, professional white background",
  characterStyle: "2D cartoon character, bold thick black ink outlines, perfectly round WHITE circle head (pure white, NOT skin-colored), small simple black dot eyes, thin simple eyebrow lines, simple small curved mouth, body with detailed era-appropriate clothing (visible folds layers buttons collars), THIN single black line arms with small round black circle hands, THIN single black line legs ending in X-crossed feet, clothing has warm muted dark colors browns grays dark greens navy, flat color fills no gradients, hand-drawn cartoon style, professional white background",
  backgroundStyle: "2D cartoon background illustration, bold black outlines, detailed interior or exterior environment with depth and atmosphere, muted dark color palette browns grays dark greens warm shadows, visible furniture props architectural details environmental storytelling elements, cinematic moody lighting with warm practical light sources, flat color fills with subtle tone variation, hand-drawn illustration style, NO characters NO people NO figures NO text NO words, 16:9 ratio",
  sceneStyle: "simple 2D flat animation style, thick black outlines, round expressive eyes, simple hand-drawn aesthetic, warm muted color palette, educational explainer video style, no photorealism, flat colors"
};

// === L11797-11873: STYLE_PRESETS ===
const STYLE_PRESETS = {
  '': { label: '— Chọn preset style —' },
  cartoon2d: {
    label: '🎨 Cartoon 2D (flat vector)',
    characterStyle: 'Flat 2D cartoon character drawn as a clean hand-drawn vector illustration. Bold, clean black outlines of even constant weight on every shape. Simple expressive face: two solid dot eyes, a small simple nose, bold eyebrows as the main emotion driver, and one curved expressive mouth. Simplified, slightly stylized body proportions (head a touch large), clear silhouette. Flat solid color fills with NO gradients and only light minimal cel-shading for form. Era- and role-appropriate clothing built from simple bold shapes and flat colors. Full-body front view, clean plain off-white background, soft contact shadow under the feet. Identical character design, proportions and palette in every pose and camera angle.',
    backgroundStyle: 'Flat 2D cartoon environment illustration matching the character style. Bold clean black outlines of even weight, clear foreground / midground / background depth, simple props and architecture drawn as flat bold shapes. Muted, harmonious color palette with soft flat cel-shading, NO gradients, hand-drawn vector aesthetic. Crisp clean linework, readable composition. NO characters NO people NO figures NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'simple flat 2D animation aesthetic, thick even black outlines, flat solid colors with light cel-shading, round expressive faces, warm muted harmonious palette, clean educational explainer-video look, NOT photorealistic, NOT 3D, NOT anime.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D shading, no gradients, no realistic skin/fabric/material texture, no painterly brushwork. Keep thick even black outlines on every element, flat color fills only, the SAME character design, proportions and colors across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'flat 2D cartoon, bold even black outline, dot eyes, flat solid colors, simple slightly-large-head proportions'
  },
  realistic: {
    label: '📷 Ảnh thực (photorealistic)',
    characterStyle: 'Photorealistic real human. Natural skin with realistic texture, pores and subtle imperfections; realistic hair rendered strand by strand; anatomically accurate human proportions and hands (five correct fingers). Age-, gender- and role-appropriate detailed clothing with real fabric texture, weight and natural folds. Soft natural three-point studio lighting, sharp focus, shot on a full-frame camera with a 50mm lens, shallow depth of field, professional portrait photography, neutral grey seamless backdrop. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Photorealistic real-world environment. Physically accurate materials and surface textures, correct perspective and depth, natural or practical lighting with realistic soft shadows, reflections and bounce light, cinematic color grading, high dynamic range, ultra-detailed, shot on a wide cinematic lens with subtle depth of field. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'photorealistic cinematic photography, natural realistic lighting, true-to-life materials and textures, sharp focus with shallow depth of field, subtle film grain, professional color grading, real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render / painterly look. No plastic or waxy skin, no distorted anatomy, no extra or missing fingers, no warped faces or limbs. Keep the SAME person\'s facial identity, hairstyle and body consistent across all scenes.',
    charIdentity: 'same real person, consistent photoreal face and hairstyle, natural skin with pores, realistic human proportions'
  },
  anime: {
    label: '🌸 Anime / Manga',
    characterStyle: 'Anime / manga character with clean crisp cel-shaded coloring (2–3 flat shadow tones, sharp shadow edges). Large expressive eyes with bright catchlights, detailed stylized hair built from distinct strand clusters, slim stylized anime proportions, sharp confident clean lineart of varied weight. Vibrant yet harmonious saturated colors, detailed era- and role-appropriate costume. Full-body front view, plain white background, soft shadow under the feet. Identical character design, hairstyle, eye shape and outfit in every pose.',
    backgroundStyle: 'Anime background art: detailed semi-painterly environment, soft gradient skies, atmospheric depth with light rays and bloom, cel-shaded lighting with warm/cool contrast, vibrant saturated but harmonious colors, clean edges, studio-anime feature-film quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'anime cel-shaded aesthetic, clean confident lineart, vibrant saturated colors, expressive dramatic lighting, detailed semi-painterly backgrounds, Japanese animation feature-film look.',
    promptRules: 'No text, no captions, no watermark, no logos. No photorealism, no 3D render, no Western-cartoon look. Keep the clean cel-shaded anime style and the SAME character design, hairstyle and outfit across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'anime cel-shaded, large expressive eyes with catchlights, clean lineart, consistent stylized hair and outfit'
  },
  render3d: {
    label: '🧊 3D Render (Pixar-like)',
    characterStyle: '3D rendered character in a stylized Pixar / DreamWorks animation look. Appealing stylized proportions (slightly large head, expressive eyes), smooth subsurface-scattering skin, soft rounded sculpted forms, detailed textured clothing with believable physically-based material shading. Lit with soft global illumination, subtle ambient occlusion in the creases and a gentle rim light. Clean studio render, neutral seamless background, gentle depth of field. The SAME character model, proportions and textures kept consistent across all shots.',
    backgroundStyle: '3D rendered environment in a stylized animated-film look. Props and architecture with smooth clean surfaces and physically-based materials, soft global illumination, ambient occlusion, gentle depth of field, warm cinematic key light with cool fill. High render quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'stylized 3D render, Pixar-like, soft global illumination, smooth surfaces, physically-based materials, cinematic lighting with ambient occlusion and gentle depth of field.',
    promptRules: 'No text, no captions, no watermark, no logos. No 2D flat look, no hand-drawn lineart, no photoreal human. Keep the SAME stylized 3D character model, proportions and textures consistent across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'stylized 3D Pixar-like model, smooth subsurface skin, soft rounded forms, consistent character model'
  },
  watercolor: {
    label: '🖌 Màu nước (watercolor)',
    characterStyle: 'Traditional watercolor-illustration character. Soft hand-painted washes layered wet-on-wet, visible cold-press paper texture, gentle bleeding pigment edges, loose expressive brushwork, delicate pencil-and-ink linework on top. Soft muted harmonious palette, airy light feel, white paper background. Recognizable, consistent character design, palette and silhouette kept the same in every pose.',
    backgroundStyle: 'Watercolor painted environment: layered soft washes and blooming colors, visible cold-press paper grain, loose wet-on-wet brushwork, gentle muted harmonious palette, airy light atmosphere with soft feathered edges, delicate ink accents. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'traditional watercolor illustration, soft hand-painted layered washes, visible paper texture, loose expressive brushwork, gentle muted palette, soft bleeding edges, warm storybook feel.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep the soft watercolor look with visible paper texture and bleeding edges; no hard digital edges, no photorealism, no 3D, no heavy black outlines. Keep the SAME character design and palette across all scenes.',
    charIdentity: 'watercolor washes, visible paper texture, loose brushwork, delicate ink lines, consistent muted palette'
  },
  lineart: {
    label: '✏️ Line art tối giản',
    characterStyle: 'Minimalist line-art character: clean single-weight black lines on pure white, minimal or no fill (at most one subtle accent color), simple confident geometric shapes, strong clear silhouette, generous negative space, modern editorial illustration. Full-body front view, white background. The SAME simple design and line weight kept consistent in every pose.',
    backgroundStyle: 'Minimalist line-art environment: clean thin even single-weight black lines on pure white, only the essential lines and props, generous negative space, modern editorial aesthetic, optional single subtle accent color. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'minimalist single-weight line art, clean thin black lines on white, lots of negative space, modern editorial look, minimal or no fill, at most one subtle accent color.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep a minimalist clean even line weight; no heavy shading, no gradients, no color fills beyond one subtle accent, avoid clutter. Keep the SAME simple design across all scenes.',
    charIdentity: 'minimalist single-weight black line art on white, minimal fill, simple consistent geometric shapes'
  },
  lifestyle: {
    label: '🏡 Đời sống (ảnh thật sáng)',
    characterStyle: 'Photorealistic real person in a warm, bright lifestyle-photography look. Natural healthy skin with real texture, soft natural window light, relaxed candid expression and posture, casual modern everyday clothing with real fabric texture. Shot on a full-frame camera with a 35–50mm lens, shallow depth of field, clean bright exposure, gentle warm color grade. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Bright, clean, real-world lifestyle environment (modern home, kitchen, café, outdoors) with warm natural daylight, soft shadows, tidy uncluttered composition, pleasant realistic materials and props, subtle bokeh, airy inviting mood. Cinematic but natural color grade, high detail. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'bright natural lifestyle photography, warm daylight, clean airy composition, shallow depth of field, realistic materials, gentle warm color grade, inviting real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render look. Keep bright natural lighting and realistic skin/materials; no plastic/waxy skin, no distorted anatomy, no extra fingers. Keep the SAME person consistent across scenes.',
    charIdentity: 'same real person, bright natural lifestyle photo, realistic skin and proportions, consistent face and hair'
  },
  infographic: {
    label: '📊 Mẹo vặt / Infographic phẳng',
    characterStyle: 'Simple flat vector character for an explainer / tips channel: clean even outlines (or outline-free flat shapes), friendly minimal face, simple rounded body, flat solid brand-like colors, modern flat-design illustration. Clear readable silhouette, full-body front view, plain light background. The SAME simple design, proportions and palette kept consistent in every scene.',
    backgroundStyle: 'Clean flat-design infographic environment: simple flat shapes, 1–2 clear icons or a simple diagram, generous negative space, a modern harmonious flat color palette (2–4 colors), soft or no shadows, tidy grid-like composition, crisp vector edges. NO photorealism. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'clean modern flat-design vector illustration, simple bold shapes, harmonious 2–4 color palette, generous negative space, crisp edges, friendly explainer / infographic look, flat minimal shading.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no gradients-heavy shading. Keep flat vector shapes, a consistent limited palette and the SAME simple character design across all scenes. Icons stay simple and iconic. No clutter.',
    charIdentity: 'flat vector explainer character, simple friendly shapes, flat solid colors, consistent limited palette',
    noChar: true
  },
  whiteboard: {
    label: '🖊 Whiteboard doodle',
    characterStyle: 'Hand-drawn whiteboard-doodle character: black marker line art on a pure white board, simple confident sketchy strokes, minimal or single-accent color fill, friendly simple face, clear silhouette, the look of a marker sketch. Full-body front view on white. The SAME simple doodle design and line weight kept consistent in every scene.',
    backgroundStyle: 'Whiteboard-doodle environment: black marker sketch lines on a clean white board, only the essential doodled props and simple scenery, lots of white space, optional single accent color, hand-drawn marker feel. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'hand-drawn whiteboard marker doodle, black sketch lines on white, simple confident strokes, lots of white space, optional single accent color, friendly explainer look.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no heavy color. Keep black marker doodle lines on white with lots of negative space and a consistent simple hand-drawn look across all scenes.',
    charIdentity: 'whiteboard marker doodle, black sketch lines on white, simple consistent hand-drawn shapes',
    noChar: true
  }
};

// === L12260-12260: _LANG_VOICE ===
const _LANG_VOICE = { 'Tiếng Việt':'vi', 'English':'en', '한국어 (Korean)':'ko', '日本語 (Japanese)':'ja', '中文 (Chinese)':'zh' };

// === L12507-12514: _PF_ICONS ===
const _PF_ICONS = {
  char: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bg: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>',
  scene: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  rule: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  script: '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>',
  thumb: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l4.5-4 3.5 2.5L16 11l4 4"/>',
};

// === L12966-12968: setStatusF ===
const setStatusF = (m, t) => setStatusBar('statusflow', m, t);

const flowBridge = {

// === L12968-13016: flowBridge ===
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

// === L13018-13018: tfState ===
const tfState = { running: false, stop: false, projectId: null, uploaded: {}, onProgress: null };

// === L13077-13077: bulkState ===
let bulkState = { items: [], running: false, stop: false, refs: [] };

// === L13348-13348: _tfBuiltinPoll ===
let _tfBuiltinPoll = null;

// === L13466-13466: _tfCftBusy ===
let _tfCftBusy = false;

// === L13494-13494: _fcTestId ===
let _fcTestId = null;

// === L13562-13564: _capModeCache ===
var _capModeCache = 'guest';   // chế độ máy captcha (đồng bộ từ backend lúc mở)
async function fcSetCapMode(m){
  _capModeCache = (m === 'account') ? 'account' : 'guest';

// === L13591-13591: _tfPersistKey ===
let _tfPersistKey = '';

// === L13653-13653: _tfExtPoll ===
let _tfExtPoll = null;

// === L14220-14221: setStatus1 ===
const setStatus1 = (m, t) => setStatusBar('status1', m, t);
const setStatus2 = (m, t) => setStatusBar('status2', m, t);

// === L14221-14225: setStatus2 ===
const setStatus2 = (m, t) => setStatusBar('status2', m, t);


// 📄 Tải file văn bản lên ô kịch bản (.txt .md .srt .vtt ...)
function loadScriptFile(input){

// === L14827-14839: SCENE_TYPES ===
const SCENE_TYPES = {
  hook:         { core:true,  color:'#dc2626', vi:'mở đầu gây tò mò/sốc',        recipe:'an extreme close-up or an unusual dramatic angle, high contrast, dark moody lighting, a sense of tension or an unanswered question', motion:'punch' },
  establishing: { core:true,  color:'#2563eb', vi:'cảnh rộng mở bối cảnh/chương', recipe:'a wide establishing shot showing the whole environment, orienting light that sets the place and time of day', motion:'zoom-in' },
  scene:        { core:true,  color:'#64748b', vi:'kể chuyện thường (mặc định)',  recipe:'a medium shot with natural narrative framing', motion:'' },
  'close-up':   { core:true,  color:'#ea580c', vi:'cận nhấn cảm xúc/chi tiết',    recipe:'a macro close-up with shallow depth of field, focused on one emotional detail (hands, eyes, a key object)', motion:'zoom-in' },
  'b-roll':     { core:true,  color:'#0d9488', vi:'minh hoạ không nhân vật',      recipe:'illustrative b-roll of scenery, objects or textures with no people in frame', motion:'pan-right' },
  compare:      { core:false, color:'#b45309', vi:'giải thích/so sánh/số liệu',   recipe:'a clean, minimal side-by-side comparison or simple infographic on a plain white background — mostly ICONS, simple shapes and bars with LOTS of empty space; use text VERY SPARINGLY: at most a short 2-4 word title plus a few KEY numbers or 1-2 word labels (spelled correctly, matching the narration). NO sentences, NO paragraphs, NO long descriptive labels, NO cluttered wall of words — keep it clean and mostly visual', motion:'static' },
  flashback:    { core:false, color:'#7c3aed', vi:'hồi tưởng/quá khứ',            recipe:'a memory tone — desaturated sepia palette, soft vignette, heavier film grain to mark the past', motion:'zoom-in' },
  dream:        { core:false, color:'#0891b2', vi:'tưởng tượng/giả định',         recipe:'a surreal dreamlike look with soft glow and an ethereal palette', motion:'zoom-out' },
  map:          { core:false, color:'#65a30d', vi:'bản đồ/địa lý/di chuyển',      recipe:'an illustrated map or geographic view with routes and location markers, WITH short real place-name labels written on it (1-3 words each, spelled correctly)', motion:'pan-left' },
  reveal:       { core:false, color:'#9333ea', vi:'lật mở/before-after/twist',    recipe:'a dramatic reveal using a split or before-and-after composition with strong contrast', motion:'punch' },
  transition:   { core:false, color:'#94a3b8', vi:'chuyển chương/tiêu đề phần',   recipe:'a minimal transitional shot with negative space and subtle motion', motion:'static' },
};

// === L14840-14841: SCENE_TYPES_CORE ===
const SCENE_TYPES_CORE = Object.keys(SCENE_TYPES).filter(k => SCENE_TYPES[k].core);
function _sceneTypesOn(){ const on = (state && Array.isArray(state.sceneTypesOn) && state.sceneTypesOn.length) ? state.sceneTypesOn : SCENE_TYPES_CORE; return on.filter(k => SCENE_TYPES[k]); }

// === L14937-14939: _t2Gist ===
const _t2Gist = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n || 90);

/* ══ CHẠY SONG SONG CÓ GIỚI HẠN ═══════════════════════════════════════════

// === L14947-14947: _T2_LUONG_MAC_DINH ===
const _T2_LUONG_MAC_DINH = 3;

// === L14949-14949: _t2DragSrc ===
let _t2DragSrc = -1;

// === L14951-14951: _t2Snapshots ===
const _t2Snapshots = [];   // LRU 5 snapshot

// === L14952-14952: _T2_SNAP_MAX ===
const _T2_SNAP_MAX = 5;

// === L15022-15022: _t2Sel ===
const _t2Sel = new Set();

// === L15248-15255: _T2_NGUON_DS ===
const _T2_NGUON_DS = [
  { id: 'veo',   ten: 'Video Veo AI',  icon: '🎬', mo: 'Cảnh cần chuyển động thật, có nhân vật. Tốn credit Flow.' },
  { id: 'stock', ten: 'Video stock',   icon: '🎞', mo: 'Pexels + Pixabay. Cảnh đời thực, b-roll không nhân vật.' },
  { id: 'yt',    ten: 'Clip YouTube',  icon: '▶️', mo: '⚠️ Nội dung có bản quyền — rủi ro Content ID khi bật kiếm tiền.' },
  { id: 'kho',   ten: 'Kho mở',        icon: '🏛', mo: 'Wikimedia · NASA · Openverse · Archive.org. Giấy phép rõ, đã lọc bỏ NC/ND.' },
  { id: 'web',   ten: 'Nguồn web',     icon: '🌐', mo: '55 nền tảng — kho ảnh/video sẵn (Pexels, Pixabay, NASA, Openverse…), YouTube, Archive.org, C-SPAN, BBC… Bấm ⚙ để chọn nền tảng nào được dùng.',
    moAi: 'Tư liệu quay thật đã công bố: phiên điều trần, sự kiện lịch sử, phóng sự hiện trường, phim lưu trữ.' },
];

// === L15261-15261: _T2_NGUON_HIEN ===
const _T2_NGUON_HIEN = ['veo', 'web'];

// === L15622-15623: _T2_TAG_RE ===
const _T2_TAG_RE = /\[([^\[\]]+)\]/g;
function _t2TagsIn(text){

// === L16356-16370: VISUAL_METAPHOR_RULE ===
const VISUAL_METAPHOR_RULE = `
🎭 VISUAL METAPHOR RULE — many narration lines are abstract (ideas, emotions, the passing of time, cause and effect, statistics, generalizations). NEVER render such a line as a plain talking head or a text panel. Instead invent ONE concrete, depictable scene that carries the idea through tangible objects, actions and staging.
- Map the concept to props: lost opportunity → a door closing or a path forking away; passing time → an hourglass, a burning-down candle, a clock; growth → a rising stack or tower; a hidden deal → a sealed or unfurling document; looming danger → a long shadow or cracking ground; a hard choice → a fork in the road; a burden → a heavy weight on the shoulders. Pick objects that fit the script's era and setting.
- MATCH THE METAPHOR TO THE STYLE'S REALISM. For stylized looks (2D cartoon, illustration, infographic, anime) overt symbolic props and exaggerated staging are welcome. For photorealistic / live-action-cinematic looks, keep metaphors grounded and subtle — real objects in plausible real settings, carrying meaning through composition, lighting, gesture and depth of field rather than floating or glowing symbols, so the shot never looks fake or absurd.
- Respect whatever character design, era and style are defined for this profile; the metaphor only adds props, staging and mood — it never overrides them.
- Convey meaning through what is visibly in the frame; describe only the scene, WITHOUT "symbolizing/representing" clauses. Follow this profile's own rule on whether any text may appear in the image.
- Vary camera framing/angle across neighboring scenes for rhythm.
- If a line is ALREADY concrete (a specific action, place or event), depict it directly — do not force a metaphor.
- Reuse a small set of recurring motifs within one video for cohesion.
`;

// 🎯 Sinh LOGLINE toàn video (1 lần) → nhồi vào MỌI prompt cảnh để không lạc chủ đề.
// force=true: tạo lại dù đã có. Cache ở state.videoLogline. Trả chuỗi logline (hoặc '' nếu không có kịch bản).
async function genVideoLogline(force){
  const script = (state.script || '').trim();

// === L16452-16452: _laThuc ===
const _laThuc = (s) => !!(s && (s.wantStock || s.wantYt || s.wantKho || s.wantWeb));

// === L16464-16468: T2_TUY_CHON ===
const T2_TUY_CHON = {
  highDetail: false,
  hybridIcon: false,
  autoVerify: false,
};

// === L17230-17230: _autoRunning ===
let _autoRunning = false;

// === L17231-17231: _autoStopFlag ===
let _autoStopFlag = false;

// === L17232-17236: _autoAudioFile ===
let _autoAudioFile = null;    // MP3 VO đính cho Auto để căn timing (Whisper)
let _autoAudioWords = null;   // cache word-timestamps đã transcribe (transcribe 1 lần, dùng cho cả 2 lần căn)

function loadAutoAudio(input){
  const f = input.files[0];

// === L17233-17236: _autoAudioWords ===
let _autoAudioWords = null;   // cache word-timestamps đã transcribe (transcribe 1 lần, dùng cho cả 2 lần căn)

function loadAutoAudio(input){
  const f = input.files[0];

// === L17275-17275: _t6VeoCache ===
const _t6VeoCache = new Map();

// === L17276-17278: _T6_VEO_MAX ===
const _T6_VEO_MAX = 16;     // 16 video cache (trung binh 8MB moi cai, ~128MB RAM)
function _t6VeoKey(prompt, model, dur, seed){
  const norm = String(prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');

// === L17362-17372: AUTO_STEPS ===
const AUTO_STEPS = [
  { label: 'Lọc' },
  { label: 'Chia cảnh' },
  { label: 'Căn timing' },
  { label: 'Cân đều cảnh' },
  { label: 'Căn lại' },
  { label: 'Quét trước' },
  { label: 'Gán tài nguyên' },
  { label: 'Prompt ảnh' },
  { label: 'Ảnh B (cảnh dài)' }
];

// === L17374-17378: FLOW_STEPS ===
const FLOW_STEPS = [
  { label: '🎭 Prompt asset' },
  { label: '🖼 Ảnh asset' },
  { label: '🖼 Ảnh cảnh' }
];

// === L17379-17384: FS_ASSET_PROMPT ===
const FS_ASSET_PROMPT = AUTO_STEPS.length;       // 9
const FS_ASSET_IMG    = AUTO_STEPS.length + 1;   // 10
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;   // 11

function _autoStepsAll(){
  return document.getElementById('autoFlowImages')?.checked

// === L17380-17384: FS_ASSET_IMG ===
const FS_ASSET_IMG    = AUTO_STEPS.length + 1;   // 10
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;   // 11

function _autoStepsAll(){
  return document.getElementById('autoFlowImages')?.checked

// === L17381-17384: FS_SCENE_IMG ===
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;   // 11

function _autoStepsAll(){
  return document.getElementById('autoFlowImages')?.checked

// === L17764-17764: SCENE_TYPE_VI ===
const SCENE_TYPE_VI = { hook: 'Mở màn', establishing: 'Cảnh rộng', scene: 'Kể chuyện', 'close-up': 'Cận cảnh', 'b-roll': 'Minh hoạ', compare: 'So sánh', flashback: 'Hồi tưởng', dream: 'Tưởng tượng', map: 'Bản đồ', reveal: 'Lật mở', transition: 'Chuyển chương' };

// === L17801-17802: _CROWD_RE ===
const _CROWD_RE = /^(crowd|crowds|people|persons?|bystanders?|passers?[- ]?by|onlookers?|audience|extras?|villagers?|workers?|colleagues?|co[- ]?workers?|staff|patients|doctors|nurses|guests|attendees|group|team|everyone|others?|strangers?|figures?|silhouettes?|men|women|children|kids|customers?|shoppers?|pedestrians?|soldiers?|students?|guards?|reporters?|crowd of .*)$/i;
function _isCrowdName(n){ n = String(n || '').trim(); if (!n) return true; if (_CROWD_RE.test(n)) return true; if (n.split(/\s+/).length > 4) return true; return false; }

// === L17807-17807: _T2_BG_MIN ===
const _T2_BG_MIN = 2;

// === L18036-18038: _t2KhopCuoi ===
let _t2KhopCuoi = null;   // {ti, khop, tong} của lần căn timing gần nhất
function t2RenderTimingWarn(){
  const el = document.getElementById('t2TimingWarn'); if (!el) return;

// === L18079-18079: _t2RegenPending ===
let _t2RegenPending = new Set();

// === L18080-18080: _t2RegenRunning ===
let _t2RegenRunning = false;

// === L18081-18081: _t2RegenDone ===
let _t2RegenDone = 0, _t2RegenErr = 0, _t2RegenTotal = 0;

// === L18082-18082: _t2RegenSeen ===
let _t2RegenSeen = new Map();   // key(id | id::b) → 'wait'|'done'|'err' — để hiện KHUNG ảnh đang tạo lại cho user soi

// === L18083-18083: _t2RegenPanelOpen ===
let _t2RegenPanelOpen = true;

// === L18140-18140: _t2RegenCtx ===
let _t2RegenCtx = null, _t2RegenConc = 1, _t2RegenWorkers = 0, _t2RegenSetup = false, _t2RegenOwn = false;

// === L18737-18740: setStatus3 ===
const setStatus3 = (m, t) => setStatusBar('status3', m, t);

// 🏺 Tự suy BỐI CẢNH + THỜI ĐẠI từ kịch bản (để chọn trang phục đúng thời)
async function autoFillEra(force){

// === L18783-18783: _autoT3Running ===
let _autoT3Running = false;

// === L18919-18919: ASSET_NO_TEXT_RULE ===
const ASSET_NO_TEXT_RULE = 'NO-TEXT RULE (mandatory, highest priority): the final image must NOT contain any text at all — no titles, no headers, no panel numbers, no labels, no emotion names, no captions, no watermarks, no signatures. NEVER label the views or the expressions. The prompt you write MUST end with exactly this sentence: "no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only".';

// === L18921-18921: ASSET_CHAR_LAYOUT ===
const ASSET_CHAR_LAYOUT = 'LAYOUT: one clean character reference sheet on a plain off-white background. The SAME character shown full-body from five angles in a single horizontal row: front, three-quarter front, side profile, three-quarter back, full back. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles below or beside the figures. Identical character design, proportions and outfit in every pose. LIGHTING: even, soft, neutral reference lighting that reveals every design detail clearly — no heavy dramatic shadows that hide the face, hands or costume. CRISPNESS: razor-sharp clean linework with precise edges, high resolution, deep sharp focus across the whole sheet, richly detailed, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L18924-18924: ASSET_CHAR_LAYOUT_PHOTO ===
const ASSET_CHAR_LAYOUT_PHOTO = 'LAYOUT: one character reference board made of REAL PHOTOGRAPHS of the SAME real person on a plain neutral-grey photo-studio background: full-body photos from five angles in a single row (front, three-quarter front, side profile, three-quarter back, full back) with identical outfit, hair and lighting. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles. Photorealistic studio photography throughout, the SAME face, hair and wardrobe consistent in every photo. This is a PHOTO casting board — NOT a drawing, NOT an illustration, NOT an anime/manga model sheet, NOT a cartoon, NOT concept art, no color-palette swatches. LIGHTING: even, soft, neutral studio lighting that shows the face, hair and wardrobe clearly — no heavy dramatic shadows. Sharp focus, high resolution, crisp fine detail throughout, never soft or blurry. ' + ASSET_NO_TEXT_RULE;

// === L18926-18926: ASSET_BG_LAYOUT ===
const ASSET_BG_LAYOUT = 'LAYOUT: one background/location reference sheet as a clean 2x2 grid of four views of the SAME place — wide establishing view, medium view from the opposite side, high isometric overview, and a low close-up detail with dramatic lighting. Consistent architecture, props and color palette across all four cells. No people, no characters. CRISPNESS: render every cell razor-sharp and highly detailed — crisp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus throughout; keep the lighting moody and atmospheric but the artwork itself must be sharp and punchy, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L18928-18928: ASSET_BG_LAYOUT_SINGLE ===
const ASSET_BG_LAYOUT_SINGLE = 'LAYOUT: ONE single full-frame cinematic image of this one location — NOT a grid, NOT multiple panels, NOT split into cells, just ONE clean wide establishing shot that clearly shows the architecture, key props and lighting of the place, with strong perspective and layered depth, 16:9. CRISPNESS: razor-sharp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus across the whole frame, punchy — keep the lighting moody and atmospheric but NEVER soft, blurry, hazy or washed out. No people, no characters. ' + ASSET_NO_TEXT_RULE;

// === L18960-18961: _CHAR_RISKY ===
const _CHAR_RISKY = /\b(topless|bare[-\s]?chest(ed)?|shirtless|hip[-\s]?wrap|loin[-\s]?cloth|no body hair|chest dots|naked|nude|underwear|undressed)\b/i;
function _sanitizeCharPrompt(text){

// === L19454-19454: assetRenamer ===
const assetRenamer = { files: [] };

// === L19551-19552: setStatus4 ===
const setStatus4 = (m, t) => setStatusBar('status4', m, t);
const renamer = { files: [] };

// === L19552-19552: renamer ===
const renamer = { files: [] };

// === L19808-19812: setStatus5 ===
const setStatus5 = (m, t) => setStatusBar('status5', m, t);

// Thử key stock ngay tại chỗ. Trước đây key sai chỉ biểu hiện bằng "ít ứng viên",
// không có cách nào biết nguồn nào chết.
const _T2_NGUON = [

// === L19812-19816: _T2_NGUON ===
const _T2_NGUON = [
  { id:'pexels',   ten:'Pexels',   video:true,  lay:'pexels.com/api',    mo:'ảnh + video' },
  { id:'pixabay',  ten:'Pixabay',  video:true,  lay:'pixabay.com/api/docs', mo:'ảnh + video' },
  { id:'unsplash', ten:'Unsplash', video:false, lay:'unsplash.com/developers', mo:'CHỈ ảnh' },
];

// === L19817-19817: _t2StockTT ===
let _t2StockTT = {};   // id → {ok, msg}

// === L19843-19845: _T_NGUON_HONG ===
const _T_NGUON_HONG = () => _T2_NGUON.filter(n => _t2StockTT[n.id] && !_t2StockTT[n.id].ok).map(n => n.ten);

async function t2TestStockKey(nguon, imLang){

// === L19908-19908: _t5Results ===
let _t5Results = {};

// === L19949-19949: _T2_GOC_NHAN ===
const _T2_GOC_NHAN = { 'chu-the': 'chủ thể', 'boi-canh': 'bối cảnh', 'doi-chieu': 'đối chiếu' };

// === L20221-20222: _KHO_CAM ===
const _KHO_CAM = /(^|[-\s])n[cd]([-\s]|$)|non[\s-]?commercial|no[\s-]?deriv/i;
const _khoOk = (lic) => {

// === L20222-20223: _khoOk ===
const _khoOk = (lic) => {
  const s = String(lic || '').toLowerCase();

// === L20228-20230: _khoText ===
const _khoText = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').trim();

async function _khoJson(url){

// === L20422-20422: _T2_CANH_ANH ===
const _T2_CANH_ANH = new Set(['compare', 'map', 'flashback']);

// === L20448-20468: _T2_LOAI_NGUON ===
const _T2_LOAI_NGUON = [
  // Video ca nhạc / AMV / lyric — hình bám nhịp nhạc, cắt ra là lạc hẳn.
  { lop: 'nhac', chan: true, d: -10,
    re: /\b(amv|music video|official (?:video|audio)|lyrics?|lyric video|ost|soundtrack|full song|cover|remix|concert|live performance|instrumental|karaoke)\b/i },
  // Fan edit / tổng hợp — dính watermark, hiệu ứng, nhạc đè.
  { lop: 'fan-edit', chan: true, d: -9,
    re: /\b(compilation|fan ?edit|edits|tribute|highlights?|best (?:moments|scenes|of)|top \d+|scene ?pack|twixtor|must credit|free clips)\b/i },
  // Gameplay / sản phẩm — không phải cảnh quay đời thực.
  { lop: 'game', chan: true, d: -9,
    re: /\b(gameplay|walkthrough|speedrun|let'?s play|board game|card game|mod showcase|cheat)\b/i },
  // Đăng lại từ mạng xã hội — gần như luôn có watermark.
  { lop: 'repost-mxh', chan: true, d: -8,
    re: /\b(tiktok|capcut|reels?|shorts? compilation|repost)\b/i },
  // Trailer fan làm / live action tự dựng.
  { lop: 'fan-trailer', chan: true, d: -8,
    re: /\b(fan ?(?:trailer|made|film)|concept trailer|live action (?:remake|version)|imagined cast)\b/i },
  // Người ngồi nói — trừ điểm nặng nhưng KHÔNG chặn: đôi khi có b-roll xen giữa.
  { lop: 'binh-luan', chan: false, d: -6,
    re: /\b(interview|podcast|reaction|reacts?|vlog|talking head|explains?|explained|review|unboxing|q&a|ama|livestream|live stream|commentary|analysis|breakdown|recap|video essay|my thoughts|face ?cam|webcam)\b/i },
  // Hướng dẫn / bài giảng — khung hình là màn chiếu hoặc bảng, không phải cảnh thật.
  { lop: 'huong-dan', chan: false, d: -4,

// === L20482-20482: _T2_TIEU_DE_CHUNG ===
const _T2_TIEU_DE_CHUNG = /\b(part \d+|full (?:episode|video)|mix \d+|shorts?)\b/i;

// === L20484-20486: _T2_TIEU_DE_TOT ===
const _T2_TIEU_DE_TOT = /\b(4k|uhd|1080p|60fps|no copyright|copyright[- ]free|free stock|royalty[- ]free|b[- ]?roll|stock footage|aerial|drone|timelapse)\b/i;

/* Trả { diem, loai } — loai rỗng nghĩa là nhận. Điểm càng cao càng hợp.     */

// === L20489-20498: _T2_LY_DO ===
const _T2_LY_DO = {
  'qua-ngan':    'clip ngắn hơn cảnh',
  'trung-lap':   'đã dùng ở cảnh khác',
  'rong':        'ứng viên rỗng',
  'nhac':        'video ca nhạc / AMV',
  'fan-edit':    'fan edit / tổng hợp',
  'game':        'gameplay',
  'repost-mxh':  'đăng lại từ mạng xã hội',
  'fan-trailer': 'trailer fan làm',
};

// === L20574-20577: _T2_STOCK_MAX ===
const _T2_STOCK_MAX = 24;   // trần ứng viên giữ cho MỖI cảnh (bấm "Tìm thêm" nhiều lần vẫn không phình vô hạn)
// Tìm THÊM ứng viên stock cho MỘT cảnh (đổi clip lúc xem lại) — kwManual = từ khoá tự gõ, để trống thì AI tự suy.
async function t2FetchStockOne(sceneId, kwManual){
  const sc = (state.scenes || []).find(x => x.id === sceneId);

// === L20670-20670: _T2_WEB_MAX ===
const _T2_WEB_MAX = 18;

// === L21246-21249: setStatus6 ===
const setStatus6 = (m, t) => setStatusBar('statusMvVid', m, t);

// state.veoPrompts = { sceneId: { prompt, audio } }
if (!state.veoPrompts) state.veoPrompts = {};

// === L21405-21415: t7State ===
const t7State = {
  images: [],        // giữ tương thích chỗ reset ở newVideo/switchVideo
  clips: [], selClip: null, past: [], future: [], _seq: 0,
  overlays: [], selOverlay: null,   // 🖼 Lớp trên (ảnh đè full-frame): {id,dataUrl,name,start,dur}
  media: [], mediaTab: 'scenes',    // 📁 Thư viện phương tiện nhập vào: {id,kind:image|video|audio,name,dataUrl,dur}
  audioFile: null, audioPeaks: null, audioDur: 0,
  bgmFile: null, bgmPeaks: null, bgmDur: 0,
  selId: null,
  playing: false, playT: 0, pps: 8, _t0: 0, _raf: null, _progHooked: false, _kbHooked: false,
  _drag: null
};

// === L21785-21796: _T7_RAIL ===
const _T7_RAIL = [
  { k: 'scenes', ic: '🎬', lb: 'Cảnh' },
  { k: 'media',  ic: '🖼', lb: 'Ảnh' },
  { k: 'sep' },
  { k: 'text',   ic: 'T',  lb: 'Chữ' },
  { k: 'motion', ic: '✨', lb: 'Chuyển động' },
  { k: 'trans',  ic: '⇄',  lb: 'Chuyển cảnh' },
  { k: 'sep' },
  { k: 'audio',  ic: '🔊', lb: 'Âm thanh' },
  { k: 'subs',   ic: '💬', lb: 'Phụ đề' },
  { k: 'ai',     ic: '🪄', lb: 'Trợ lý' },
];

// === L21799-21799: _t7IsTextTpl ===
const _t7IsTextTpl = (t) => !/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in|progress|circle|frame|khung|fx-/i.test(t.template + ' ' + (t.label || ''));

// === L21816-21824: _T7_GUT ===
const _T7_GUT = (() => {
  try {
    const el = document.getElementById('tool-tool7');
    const v = el && getComputedStyle(el).getPropertyValue('--t7-gut');
    const n = parseFloat(v); if (Number.isFinite(n)) return n + 5;
  } catch (e) {}
  return 31;
})();
function t7RenderTlStats(){

// === L21849-21849: _t7Sfx ===
let _t7Sfx = null, _t7RailQ = '';

// === L21902-21902: _T7_TABS ===
const _T7_TABS = ['scenes','media','text','motion','trans','audio','subs','ai'];

// === L21903-21903: _T7_TITLE ===
const _T7_TITLE = { scenes:'Cảnh', media:'Ảnh', text:'Chữ', motion:'Chuyển động', trans:'Chuyển cảnh', audio:'Âm thanh', subs:'Phụ đề', ai:'Trợ lý' };

// === L22165-22169: _t7GfxSel ===
let _t7GfxSel = null;                                   // 'sceneId:index' của lớp đang mở bảng chỉnh

// Bỏ qua lớp nền (backdrop @scene) — đó là ảnh cảnh, không phải đồ hoạ.
function _t7GfxLayers(sceneId){
  const sp = (state.sceneSpecs || {})[sceneId];

// === L22197-22206: _T7_STYLES ===
const _T7_STYLES = [
  { id: 'still',   icon: '🖼', name: 'Đứng yên',      desc: 'Không di chuyển — lời dẫn trầm lặng',      in: 'fade',  hold: 'none',    out: 'fade'  },
  { id: 'pushin',  icon: '🎥', name: 'Phóng chậm vào', desc: 'Ken Burns cổ điển — tốt cho mọi ảnh tĩnh', in: 'fade',  hold: 'kenIn',   out: 'fade'  },
  { id: 'pullout', icon: '🔍', name: 'Phóng chậm ra', desc: 'Cảm giác lùi xa, kết mở',                  in: 'fade',  hold: 'kenOut',  out: 'fade'  },
  { id: 'side',    icon: '↔️', name: 'Lia ngang',     desc: 'Quét sang trái — hợp ảnh rộng',            in: 'fade',  hold: 'panL',    out: 'fade'  },
  { id: 'updown',  icon: '↕️', name: 'Lia dọc',       desc: 'Đi từ trên xuống — hợp toà nhà, nhân vật', in: 'fade',  hold: 'panD',    out: 'fade'  },
  { id: 'breathe', icon: '🌬', name: 'Hơi thở',       desc: 'Phập phồng rất nhẹ — chữ, nhãn hút mắt',    in: 'fade',  hold: 'breathe', out: 'fade'  },
  { id: 'lively',  icon: '✨', name: 'Sống động',     desc: 'Nảy vào rồi trôi nhẹ — thẻ ảnh, sticker',  in: 'pop',   hold: 'drift',   out: 'fade'  },
  { id: 'epic',    icon: '🌄', name: 'Kịch tính',     desc: 'Phóng mạnh vào, thu nhỏ ra — cao trào',    in: 'zoom',  hold: 'kenIn',   out: 'shrink'},
];

// === L22208-22216: NOVA_ANIM_LABELS ===
const NOVA_ANIM_LABELS = {
  none: 'Không', fade: 'Mờ dần', rise: 'Dâng lên', drop: 'Rơi xuống',
  slideL: 'Trượt trái', slideR: 'Trượt phải', pop: 'Bật nảy', defocus: 'Nhoè dần',
  wipeL: 'Quét ngang', zoom: 'Phóng vào', deal: 'Chia bài',
  sinkL: 'Chìm trái', sinkR: 'Chìm phải', fall: 'Rơi xuống', shrink: 'Co lại', wipeR: 'Quét ra',
  kenIn: 'Phóng chậm vào', kenOut: 'Phóng chậm ra',
  panL: 'Lia trái', panR: 'Lia phải', panU: 'Lia lên', panD: 'Lia xuống',
  drift: 'Trôi nhẹ', breathe: 'Hơi thở', growX: 'Chạy đầy ngang', growY: 'Chạy đầy dọc',
};

// === L22389-22389: _t7FxTab ===
let _t7FxTab = 'tpl', _t7Bits = null, _t7Prev = null;

// === L22408-22408: _t7FxSw ===
let _t7FxSw = null;

// === L22427-22427: _t7AB ===
let _t7AB = null;

// === L22440-22443: _T7_FLASH ===
const _T7_FLASH = {
  'dip-black':'#000', 'dip-white':'#fff', 'flashbang':'#fff', 'glare':'#fff5d0',
  'strobe':'#fff', 'burn':'#ff7a2f', 'film-roll':'#0a0806', 'shutter':'#0a0806', 'reverse-shutter':'#0a0806',
};

// === L22445-22446: _T7_ANIMFAM ===
const _T7_ANIMFAM = { wipe:'f-wipe', push:'f-push', whip:'f-whip', zoom:'f-zoom', shape:'f-shape',
  split:'f-split', glitch:'f-glitch', compress:'f-compress', flip:'f-flip', sweep:'f-sweep', camera:'f-zoom' };

// === L22555-22555: _animLoaded ===
let _animLoaded = false;

// === L22656-22656: _t7Drag ===
let _t7Drag = null;

// === L22781-22784: _t7Clip ===
let _t7Clip = null;                                     // bộ nhớ tạm 1 lớp

function _t7GfxCur(){
  if (!_t7GfxSel) return null;

// === L22910-22910: _t7GlobSel ===
let _t7GlobSel = null;

// === L23094-23094: _t7IsVid ===
const _t7IsVid = (v) => /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(String(v || ''));

// === L23147-23147: _t7SmartWired ===
let _t7SmartWired = false;

// === L23300-23300: T7_NOVA ===
const T7_NOVA = { fps: 30, width: 1920, height: 1080, comp: 'NovaSequence' };

// === L23305-23310: _T7_HOLD ===
const _T7_HOLD = {
  'zoom-in': 'kenIn',  'zoom-out': 'kenOut',
  'pan-left': 'panL',  'pan-right': 'panR',
  'pan-up': 'panU',    'pan-down': 'panD',
  'none': 'none',
};

// === L23313-23317: _T7_IN ===
const _T7_IN = { fade:'fade', dissolve:'fade', slide:'slideL', 'slide-left':'slideL', wipe:'wipeL', circle:'pop', none:'none',
  cut:'none', 'dip-black':'fade', 'dip-white':'fade', 'flash-cut':'pop', 'whip-pan':'slideL', defocus:'defocus',
  'zoom-through':'zoom', 'match-zoom':'zoom', 'light-leak':'fade', 'film-burn':'fade', 'glow-bloom':'fade',
  'wipe-left':'wipeL', 'wipe-up':'rise', 'push-left':'slideL', 'push-up':'rise', 'barn-door':'wipeL', shutter:'wipeL',
  iris:'pop', 'paper-slide':'deal', 'paper-drop':'drop', 'grain-dissolve':'fade', 'film-roll':'fade' };

// === L23321-23321: _t7Trans ===
let _t7Trans = null;

// === L23322-23326: _T7_TRANS_FALLBACK ===
const _T7_TRANS_FALLBACK = [
  { id:'cut', label:'Cắt thẳng', family:'cut' }, { id:'fade', label:'Mờ dần', family:'dissolve' },
  { id:'dip-black', label:'Nhúng đen', family:'dissolve' }, { id:'push-left', label:'Trượt trái', family:'push' },
  { id:'wipe-left', label:'Gạt trái', family:'wipe' }, { id:'iris', label:'Vòng tròn', family:'shape' },
];

// === L23327-23331: _T7_FAM ===
const _T7_FAM = { cut:'Cắt', dissolve:'Hoà tan', camera:'Máy quay', push:'Đẩy', wipe:'Gạt', split:'Tách đôi',
  whip:'Quật nhanh', flip:'Lật', shape:'Hình khối', flash:'Chớp sáng', glitch:'Nhiễu số', zoom:'Phóng',
  sweep:'Quét', film:'Chất phim', blend:'Chồng ảnh', compress:'Bóp',
  // Nhóm mới của catalog() vốn đã tiếng Việt — khai cho đủ map; nhánh _T7_FAM[f] || f vẫn an toàn.
  'Cắt & hoà':'Cắt & hoà', 'Quang học':'Quang học', 'Hình học':'Hình học', 'Chất liệu giấy & phim':'Chất liệu giấy & phim' };

// === L23344-23344: _t7BlobUrls ===
const _t7BlobUrls = new Map();

// === L23398-23398: _t7Cat ===
let _t7Cat = null;

// === L23417-23417: _t7AiQ ===
let _t7AiQ = [];                                     // đề xuất đang chờ (trỏ thẳng vào state.aiQueue)

// === L23434-23435: _T7_AI_STEP ===
const _T7_AI_STEP = ['Đọc kịch bản', 'Lập bản đồ vai trò cảnh', 'Đề xuất mẫu chuyển động',
                     'Soi khung hình cảnh có chữ', 'Tự kiểm cả kế hoạch', 'Chọn chuyển cảnh'];

// === L23436-23436: _t7AiNote ===
let _t7AiNote = {};

// === L23494-23494: _t7AiBulk ===
let _t7AiBulk = false;

// === L23508-23508: _t7AiPv ===
const _t7AiPv = new Map();            // 'sceneId|d0.60' → chuỗi HTML lớp

// === L23509-23516: _t7AiPlay ===
let _t7AiPlay = null;                 // {i, timer} — thẻ đang chạy chuyển động
let _t7AiTry = null;                  // {sceneId, spec} — lớp vẽ TẠM lên khung xem lớn

// Chữ LÊN HÌNH phải cùng ngôn ngữ với kịch bản, không phải ngôn ngữ của giao diện.
// Cả prompt viết bằng tiếng Việt nên model mặc định trả chữ tiếng Việt — kịch bản
// tiếng Anh mà phụ đề đồ hoạ tiếng Việt thì hỏng cả video.
function _t7AiLang(){
  try { return (typeof _profileLang === 'function' && _profileLang()) || 'Tiếng Việt'; }

// === L23510-23516: _t7AiTry ===
let _t7AiTry = null;                  // {sceneId, spec} — lớp vẽ TẠM lên khung xem lớn

// Chữ LÊN HÌNH phải cùng ngôn ngữ với kịch bản, không phải ngôn ngữ của giao diện.
// Cả prompt viết bằng tiếng Việt nên model mặc định trả chữ tiếng Việt — kịch bản
// tiếng Anh mà phụ đề đồ hoạ tiếng Việt thì hỏng cả video.
function _t7AiLang(){
  try { return (typeof _profileLang === 'function' && _profileLang()) || 'Tiếng Việt'; }

// === L23546-23548: _t7AiTStill ===
const _t7AiTStill = (dur) => Math.min(0.75, Math.max(0.3, dur * 0.35));

async function _t7AiPvDraw(i, chiNen){

// === L23638-23638: _t7AiObs ===
let _t7AiObs = null;

// === L23656-23664: _T7_ENUM ===
const _T7_ENUM = {
  position: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'],
  pos: ['top', 'center', 'bottom'],
  from: ['left', 'right', 'top', 'bottom'],
  side: ['top', 'bottom', 'left', 'right'],
  animation: ['slide-in', 'fade-in', 'pop-in', 'typewriter', 'bounce-in', 'rise-in'],
  dir: ['up', 'down', 'left', 'right'],
  mode: ['hot', 'cold'],
};

// === L23665-23674: _T7_NHAN ===
const _T7_NHAN = {
  text: 'Chữ', subtitle: 'Dòng phụ', headline: 'Tiêu đề', title: 'Tiêu đề', value: 'Số',
  unit: 'Đơn vị', kicker: 'Nhãn trên', note: 'Ghi chú', caption: 'Chú thích', label: 'Nhãn',
  name: 'Tên', body: 'Nội dung', dek: 'Mô tả', chip: 'Thẻ', stamp: 'Con dấu', range: 'Khoảng',
  role: 'Vai', date: 'Ngày', position: 'Vị trí', pos: 'Vị trí', from: 'Vào từ', side: 'Phía',
  animation: 'Kiểu vào', size: 'Cỡ', color: 'Màu chữ', bg: 'Màu nền', accent: 'Màu nhấn',
  ink: 'Màu mực', track: 'Màu rãnh', mark: 'Màu bôi', color2: 'Màu 2', thickness: 'Độ dày',
  alpha: 'Độ đậm', strength: 'Độ mạnh', blur: 'Độ mờ', amount: 'Mức', angle: 'Góc',
  speed: 'Tốc độ', inner: 'Lõi', dir: 'Hướng', mode: 'Kiểu', x: 'X', y: 'Y', w: 'Rộng', h: 'Cao',
};

// === L23753-23753: _t7AiEditT2 ===
let _t7AiEditT2 = null;

// === L23805-23805: _t7AiEditT ===
let _t7AiEditT = null;

// === L23848-23848: _T7_SAFE ===
const _T7_SAFE = { x0: 4, x1: 96, y0: 5, y1: 95 };       // vùng an toàn, % khung hình

// === L23849-23849: _T7_SIZE ===
const _T7_SIZE = { min: 18, max: 220 };

// === L23850-23850: _T7_MAX_LAYER ===
const _T7_MAX_LAYER = 3;

// === L23852-23853: _t7Num ===
const _t7Num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const _t7Kep = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// === L23853-23854: _t7Kep ===
const _t7Kep = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const _t7MauOk = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v.trim())) ? v.trim() : null;

// === L23854-23855: _t7MauOk ===
const _t7MauOk = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v.trim())) ? v.trim() : null;
const _t7Preset = (v, ds, mac) => (ds.includes(String(v)) ? String(v) : mac);

// === L23855-23858: _t7Preset ===
const _t7Preset = (v, ds, mac) => (ds.includes(String(v)) ? String(v) : mac);

// Hai hộp đè nhau → bỏ hộp sau. AI hay xếp chồng chữ lên chữ.
function _t7DeNhau(a, b){

// === L23962-23963: _t7TrCam ===
const _t7TrCam = (cat, id) => {
  const e = (cat || []).find(x => x.id === id);

// === L24101-24103: _t7Open ===
let _t7Open = null;                                   // id cảnh đang mở
function t7SceneToggle(id){
  _t7Open = (_t7Open === id) ? null : id;

// === L24165-24165: _t7SrcTab ===
let _t7SrcTab = {};                                   // sceneId → 'ai' | 'yt' | 'st'

// === L24174-24174: _t7SbCache ===
const _t7SbCache = {};                                // url → sb (hoặc null nếu không có)

// === L24175-24175: _t7SbTimer ===
let _t7SbTimer = null;

// === L24183-24186: _t7YtId ===
const _t7YtId = (u) => { const m = String(u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/); return m ? m[1] : ''; };

// tải trước và chỉ giữ ảnh có thật (hq2/hq3 nhiều clip ngắn không có → 404)
function _t7QuickFrames(id){

// === L24262-24262: _t7Notes ===
const _t7Notes = {};

// === L24406-24406: _T7_TXT_KEYS ===
const _T7_TXT_KEYS = ['text', 'headline', 'title', 'value', 'caption', 'label', 'name'];

// === L24408-24408: _T7_AMBIENT ===
const _T7_AMBIENT = [];   // lớp không khí — điền lại khi thêm mẫu mới

// === L24409-24409: _T7_POS ===
const _T7_POS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];

// === L24431-24431: _T7_NOTEXT ===
const _T7_NOTEXT = [];   // mẫu không chữ — điền lại khi thêm mẫu mới

// === L24432-24432: _T7_CAM ===
const _T7_CAM = [];   // mẫu cấm vì cần toạ độ — điền lại khi thêm mẫu mới

// === L24939-24939: _t7RmState ===
const _t7RmState = { on:false, frame:-1, attempt:0, ready:false, busy:false, sig:'' };

// === L25072-25072: NOVA_IN_PRESETS ===
const NOVA_IN_PRESETS   = ['none','fade','slideL','slideR','rise','drop','pop','deal','wipeL','defocus','zoom'];

// === L25073-25073: NOVA_OUT_PRESETS ===
const NOVA_OUT_PRESETS  = ['none','fade','sinkL','sinkR','fall','shrink','wipeR'];

// === L25074-25074: NOVA_HOLD_PRESETS ===
const NOVA_HOLD_PRESETS = ['none','kenIn','kenOut','panL','panR','panU','panD','growX','growY','drift','breathe'];

// === L25078-25082: _t7AiGfxRunning ===
let _t7AiGfxRunning = false;   // đang chạy "AI dựng đồ hoạ" — chặn bấm chồng lượt

// 🎬 XUẤT BẰNG BUNDLE CŨ (animated-slideshow) — giữ lại vì đó là đường vào 67 mẫu dựng sẵn của editor-pro.
// Bản xem trước ◈ đã chuyển sang engine Nova Scene, nên nhánh này KHÔNG còn khớp xem trước — chỉ dùng khi cần so sánh.
const _T7_SLIDESHOW_FX = { 'zoom-in':'slowZoomIn','zoom-out':'slowZoomOut','pan-left':'panLeft','pan-right':'panRight','pan-up':'panUp','pan-down':'panDown','none':'breathe' };

// === L25082-25082: _T7_SLIDESHOW_FX ===
const _T7_SLIDESHOW_FX = { 'zoom-in':'slowZoomIn','zoom-out':'slowZoomOut','pan-left':'panLeft','pan-right':'panRight','pan-up':'panUp','pan-down':'panDown','none':'breathe' };

// === L25084-25084: _t7BatchRunning ===
let _t7BatchRunning = false;

// === L25155-25155: _t7OvBusy ===
let _t7OvBusy = false, _t7OvKey = '';

// === L25185-25185: _t7GlobKey ===
let _t7GlobKey = '';

// === L25208-25208: _t7Kebab ===
const _t7Kebab = (k) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// === L25361-25361: _t7ThumbObs ===
let _t7ThumbObs = [];   // giữ observer để không bị GC

// === L25570-25570: _t7SfxCache ===
let _t7SfxCache = null; let _t7SfxAudio = null;

// === L25574-25574: _t7SfxAudioCache ===
const _t7SfxAudioCache = new Map();

// === L25676-25676: _t7TlRaf ===
let _t7TlRaf = 0;

// === L25719-25719: _T7_RATES ===
const _T7_RATES = [0.5, 1, 1.5, 2];

// === L26034-26034: _t7AutoWired ===
let _t7AutoWired = false;

// === L26079-26081: _t7Gpu ===
let _t7Gpu = null;                                       // {gpu, gpuLabel} — hỏi main 1 lần rồi nhớ
async function _t7ShowGpuRow(){
  const row = document.getElementById('t7ExpGpuRow'); if (!row) return;

// === L26104-26110: T7_SUBSTYLES ===
const T7_SUBSTYLES = {
  vien:    { name: 'Viền (karaoke)', prev: 'color:#fff;text-shadow:0 0 3px #000,2px 2px 3px #000,-2px -2px 3px #000' },
  nova:    { name: 'Nền đen',        prev: 'color:#fff;background:rgba(0,0,0,.72);padding:2px 10px;border-radius:5px' },
  cam:     { name: 'Khối cam',       prev: 'color:#fff;background:rgba(194,65,12,.85);padding:2px 10px;border-radius:5px' },
  vang:    { name: 'Vàng đậm',       prev: 'color:#ffe000;text-shadow:0 0 3px #000,2px 2px 4px #000,-1px -1px 3px #000' },
  toigian: { name: 'Tối giản',       prev: 'color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.9)' },
};

// === L26428-26430: setStatus8 ===
const setStatus8 = (m, t) => setStatusBar('status8', m, t);

const t8State = {

// === L26430-26434: t8State ===
const t8State = {
  audioFile: null,
  audioDuration: 0,
  alignResults: null  // [{id, text, oldDur, newStart, newEnd, newDur}]
};

// === L26436-26458: T8_PROVIDERS ===
const T8_PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
    keyPrefix: 'gsk_',
    hint: '<strong>Groq</strong> (miễn phí): đăng ký tại <span style="color:var(--accent)">console.groq.com</span> → tạo key (không cần thẻ). Free tier 2.000 lượt/ngày, whisper-large-v3-turbo, file ≤25MB.',
    placeholder: 'Paste Groq API key (gsk_...)'
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    keyPrefix: 'sk-',
    hint: '<strong>OpenAI Whisper</strong>: $0.006/phút. Key tại platform.openai.com. Cần nạp credit.',
    placeholder: 'Paste OpenAI API key (sk-...)'
  },
  local: {
    name: 'Local Browser',
    hint: '<strong>Local Browser</strong>: chạy Whisper ngay trên máy bằng transformers.js. Miễn phí, không cần key. Tải model ~150MB lần đầu. Chậm hơn (đặc biệt máy không GPU). Model base → kém chính xác hơn large-v3.',
    placeholder: 'Không cần key cho Local'
  }
};

// === L26696-26696: t8SrtText ===
let t8SrtText = null;

// === L26949-26949: _t8LocalStop ===
let _t8LocalStop = false;

// === L27162-27163: setStatus9 ===
const setStatus9 = (m, t) => setStatusBar('status9', m, t);
const t9State = { result: null };

// === L27163-27163: t9State ===
const t9State = { result: null };

// === L27462-27463: setStatus11 ===
const setStatus11 = (m, t) => setStatusBar('status11', m, t);
const YT_API = 'https://www.googleapis.com/youtube/v3';

// === L27463-27463: YT_API ===
const YT_API = 'https://www.googleapis.com/youtube/v3';

// === L27464-27464: _T11_SIGNAL ===
const _T11_SIGNAL = { direct_request: '🎯 Yêu cầu trực tiếp', question: '❓ Câu hỏi', gap: '🕳 Khoảng trống' };

// === L27466-27466: T11_SIGNAL_WEIGHT ===
const T11_SIGNAL_WEIGHT = { direct_request: 3, gap: 2, question: 1 };

// === L27486-27486: _uploadsOf ===
const _uploadsOf = channelId => 'UU' + String(channelId).slice(2);

// === L27505-27516: NF_MAP ===
const NF_MAP = {
  hot:       { fn: 'hot',       state: 'nfHotState',   out: 'nfHotOut',   btn: 'nfHotBtn',   seed: 'nfHotSeed',   render: nfRenderHot },
  scorecard: { fn: 'scorecard', state: 'nfScState',    out: 'nfScOut',    btn: 'nfScBtn',    seed: 'nfScSeed',    render: nfRenderScorecard, key: 'channel' },
  bw:        { fn: 'bw',        state: 'nfBwState',    out: 'nfBwOut',    btn: 'nfBwBtn',    render: nfRenderBw },
  attention: { fn: 'attention', state: 'nfAttState',    out: 'nfAttOut',    btn: 'nfAttBtn',    seed: 'nfAttSeed',    render: nfRenderAttention },
  similar:   { fn: 'similar',   state: 'nfSimState',    out: 'nfSimOut',    btn: 'nfSimBtn',    seed: 'nfSimSeed',    render: nfRenderSimilar, key: 'channel' },
  spike:     { fn: 'spike',     state: 'nfSpState',    out: 'nfSpOut',    btn: 'nfSpBtn',    seed: 'nfSpSeed',    render: nfRenderSpike },
  pain:      { fn: 'pain',      state: 'nfPainState',  out: 'nfPainOut',  btn: 'nfPainBtn',  seed: 'nfPainSeed',  render: nfRenderPain },
  forecast:  { fn: 'forecast',  state: 'nfForecastState', out: 'nfForecastOut', btn: 'nfForecastBtn', seed: 'nfForecastSeed', render: nfRenderForecast },
  keywords:  { fn: 'keywords',  state: 'nfKeywordsState', out: 'nfKeywordsOut', btn: 'nfKeywordsBtn', seed: 'nfKeywordsSeed', render: nfRenderKeywords },
  breakdown: { fn: 'breakdown', state: 'nfBreakdownState', out: 'nfBreakdownOut', btn: 'nfBreakdownBtn', seed: 'nfBreakdownSeed', render: nfRenderBreakdown },
};

// === L27517-27517: _nfWired ===
let _nfWired = false, _nfActive = 'hot';

// === L27519-27519: _nfLast ===
const _nfLast = { hot: null, scorecard: null, attention: null, bw: null, similar: null, spike: null, pain: null, forecast: null, keywords: null, breakdown: null };

// === L27520-27520: _nfIdeas ===
const _nfIdeas = [];

// === L27623-27623: _nfScChannel ===
let _nfScChannel = '';

// === L27678-27684: _NF_RUNGS ===
const _NF_RUNGS = [
  [86,100,'Hiếm: nhị phân bắt ngay + hàm ý sâu'],
  [71,85,'Rất mạnh, "vì sao phải click" hiển nhiên'],
  [51,70,'Hook rõ, có căng, làm được'],
  [21,50,'Có mới nhưng còn chung chung'],
  [0,20,'Tầm thường, dễ lướt qua'],
];

// === L27954-27954: _nfWv ===
let _nfWv = null;

// === L27975-27976: setStatus10 ===
const setStatus10 = (m, t) => setStatusBar('status10', m, t);
const t10State = { refs: [], results: [], loadedProfileId: null };  // refs: [{base64, mime, name}]

// === L27976-27976: t10State ===
const t10State = { refs: [], results: [], loadedProfileId: null };  // refs: [{base64, mime, name}]

// === L28058-28058: t9Ref ===
const t9Ref = { mode: 'topic', items: [], sel: null, base64: null, mime: '' };

// === L28128-28134: T9_REF_RULE ===
const T9_REF_RULE = ' The attached reference image is the TEMPLATE. Match its art technique, background treatment, layout skeleton, caption styling and position, callout devices, palette and contrast as closely as possible — a viewer should recognise them as the same template. '
  + 'Change only the depicted subject and label wording so they fit this video. '
  + 'Never reproduce a recognisable real person, a logo or a brand mark from the reference.';

// Tự suy CHỦ ĐỀ tìm ảnh mẫu từ tiêu đề → logline → kịch bản (không bắt người dùng tự gõ tiếng Anh).
function _t9RefTopicSource(){
  const t = (document.getElementById('t10TitleInput')?.value || document.getElementById('t9Title')?.value || '').trim();

// === L28142-28144: _hasViet ===
const _hasViet = (x) => /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(String(x || ''));
// Câu tìm kiếm: bỏ dấu câu, giữ ~8 từ. Nội dung tiếng Việt → nhờ AI đổi sang cụm khoá tiếng Anh (1 call rẻ).
async function _t9RefTopicQuery(){

// === L28158-28158: _t9RefAuto ===
let _t9RefAuto = false;

// === L28467-28482: VEO_SHOT_TYPES ===
const VEO_SHOT_TYPES = {
  ESTABLISHING:{ key:"ESTABLISHING", label:"Establishing", vi:"Toàn cảnh",
    camera:"Epic wide establishing shot — either a STATIC locked-off frame OR ONE slow lateral drift; the subject is dwarfed by a vast environment to emphasize scale (never zoom, never pull back)", color:"#5B8DEF" },
  STATIC:{ key:"STATIC", label:"Static", vi:"Tĩnh (tripod)",
    camera:"STATIC locked-off tripod shot — camera perfectly still; only the subject and the environment move inside the frame (wind, dust, water). No camera movement at all", color:"#8A8F98" },
  WIDE:{ key:"WIDE", label:"Wide", vi:"Góc rộng",
    camera:"Wide shot, subject small within a large environment to emphasize scale — STATIC locked-off, OR ONE slow lateral tracking / cinematic pan for parallax depth (never zoom, never pull back)", color:"#46A0E0" },
  MEDIUM:{ key:"MEDIUM", label:"Medium", vi:"Góc trung",
    camera:"Medium shot from roughly mid-body up — STATIC, OR ONE slow gentle push-in (dolly-in). Never pull back", color:"#2FA88E" },
  ACTION:{ key:"ACTION", label:"Action", vi:"Hành động",
    camera:"ONE slow lateral tracking shot following the subject (single move, no pan or zoom), low angle for scale", color:"#E8A33D" },
  CLOSEUP:{ key:"CLOSEUP", label:"Close-up", vi:"Cận cảnh",
    camera:"ONE slow push-in / gentle dolly-in close-up, shallow depth of field (single move, never pull back)", color:"#A878E8" },
  CUTAWAY:{ key:"CUTAWAY", label:"Cutaway / B-roll", vi:"Cảnh phụ",
    camera:"STATIC, OR ONE slow pan across the environment — atmospheric b-roll, no main subject; the environment itself is the star", color:"#4FB286" },
};

// === L28483-28488: VEO_ROTATIONS ===
const VEO_ROTATIONS = {
  wideMedium: ["WIDE","STATIC","MEDIUM","WIDE","CUTAWAY","MEDIUM","STATIC"],  // rộng/trung + tĩnh, KHÔNG cận
  staticDoc:  ["STATIC","WIDE","STATIC","MEDIUM","CUTAWAY","STATIC","WIDE"],  // tĩnh nhiều (sắc nét nhất)
  balanced:   ["ACTION","MEDIUM","CLOSEUP","CUTAWAY","STATIC"],               // cân bằng (có cận)
  closeup:    ["CLOSEUP","MEDIUM","CLOSEUP","ACTION","CUTAWAY"],              // nhiều cận cảnh
};

// === L28489-28503: VEO_ROTATION ===
let VEO_ROTATION = VEO_ROTATIONS.wideMedium;   // mặc định: rộng & trung + tĩnh
const VEO_STYLE_PRESETS = {
  paleorealism:{
    label:"Paleorealism (Ice Age / wildlife)",
    baseStyle:"In the style of a BBC Earth photorealistic wildlife documentary,",
    motionGuard:"slow, deliberate, weighty motion — never modern-animal speed" },
  cosmic:{
    label:"Cosmic / space documentary",
    baseStyle:"In the style of a NASA-grade photorealistic deep-space documentary,",
    motionGuard:"near-still cosmic drift, immense scale, slow parallax — never fast or jittery" },
  cinematicDoc:{
    label:"Generic cinematic documentary",
    baseStyle:"In the style of a premium photorealistic cinematic documentary,",
    motionGuard:"smooth, slow, deliberate camera and subject motion" },
};

// === L28490-28503: VEO_STYLE_PRESETS ===
const VEO_STYLE_PRESETS = {
  paleorealism:{
    label:"Paleorealism (Ice Age / wildlife)",
    baseStyle:"In the style of a BBC Earth photorealistic wildlife documentary,",
    motionGuard:"slow, deliberate, weighty motion — never modern-animal speed" },
  cosmic:{
    label:"Cosmic / space documentary",
    baseStyle:"In the style of a NASA-grade photorealistic deep-space documentary,",
    motionGuard:"near-still cosmic drift, immense scale, slow parallax — never fast or jittery" },
  cinematicDoc:{
    label:"Generic cinematic documentary",
    baseStyle:"In the style of a premium photorealistic cinematic documentary,",
    motionGuard:"smooth, slow, deliberate camera and subject motion" },
};

// === L28507-28507: veoUI ===
const veoUI = { mode:"script", shots:[], busy:false, stop:false };
