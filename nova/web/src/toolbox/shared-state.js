
/* ============================================================

   SHARED STATE — tách từ shared-consts.js 2026-09-10
   Block này chỉ chứa: state object + tool registry (ALL_TOOLS, TOOL_LABELS)
   + tier/pricing/models config (TIER_CONFIG, TOOL_MIN_TIER, PRICING, PAYMENT_INFO, MODELS)
   + provider helpers (VISION_PROVIDERS, _provKeyName).
   Load TRƯỚC shared-consts.js; Tat ca khai bao dung var de vao globalThis trong renderer (const/let KHONG vao global)..

============================================================ */

// === L?: var state === (2026-09-10: doi tu const thanh var de vao globalThis trong renderer)
var state = {
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

// === L?: const ALL_TOOLS ===
var ALL_TOOLS = ['tool1', 'tool2', 'tool3', 'tool4', 'tool5', 'tool6', 'tool7', 'tool8', 'tool9', 'toolniche', 'toolflow', 'toolvoice', 'tooldash', 'toolsettings', 'toolscript'];

// === L?: const TOOL_LABELS ===
var TOOL_LABELS = {
  tool1: 'Profile Kênh', toolscript: 'Tạo Kịch Bản', tool2: 'Phân Cảnh', tool3: 'Prompt Nhân vật & Bối cảnh',
  tool4: 'Đổi Tên Ảnh', tool5: 'Tìm Media', tool6: 'Tạo Video (Image→Video)', tool7: 'Dựng Video',
  tool8: 'Căn Timing', tool9: 'YouTube SEO & Thumbnail AI', toolniche: 'Nghiên cứu Ngách',
  toolflow: 'Tạo Ảnh Hàng Loạt', toolvoice: 'Tạo giọng nói', tooldash: 'Dashboard', toolsettings: 'Cài đặt'
};

// === L?: const TIER_CONFIG ===
var TIER_CONFIG = {
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

// === L?: const TOOL_MIN_TIER ===
var TOOL_MIN_TIER = { tool4: 'pro', tool5: 'pro', tool6: 'pro', tool8: 'pro', tool9: 'pro', toolniche: 'pro', toolflow: 'pro', toolvoice: 'pro' };

// === L?: const PRICING ===
var PRICING = {
  plus: { priceVND: 299000, label: 'Sáng tạo',                 period: '1 tháng' },
  max:  { priceVND: 399000, label: 'Studio',                   period: '1 tháng' },
  demo: { priceVND: 30000,  label: 'Demo 1 ngày (full Sáng tạo)', period: '1 ngày' },
  pro:  { priceVND: 499000, originalVND: 1000000, period: '1 tháng' }
};

// === L?: const PAYMENT_INFO ===
var PAYMENT_INFO = {
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

// === L?: const MODELS ===
var MODELS = {
  anthropic: [
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

// === L?: const VISION_PROVIDERS ===
var VISION_PROVIDERS = ['anthropic', 'openai', 'gemini', 'openrouter', 'mistral', 'cohere', 'perplexity', 'openai-compatible'];

// === L?: const _provKeyName ===
var _provKeyName = p => 'api_key_' + (p || 'anthropic');

// === L?: let _keyFieldsProvider ===
var _keyFieldsProvider = null;


// === END OF SHARED STATE BLOCK ===
