/* T8-T10 — Tool 8/9/10 state: t8State, T8_PROVIDERS, setStatus8/9/10, t9State, t9Ref, T9_REF_RULE, t10State (đã dọn 3 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 3 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
const t8State = {
  audioFile: null,
  audioDuration: 0,
  alignResults: null  // [{id, text, oldDur, newStart, newEnd, newDur}]
};

// === L?: const T8_PROVIDERS ===
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

// === L?: let t8SrtText ===
let t8SrtText = null;

// === L?: let _t8LocalStop ===
let _t8LocalStop = false;

// === L?: const setStatus9 ===
const setStatus9 = (m, t) => setStatusBar('status9', m, t);

// === L?: const t9State ===
const t9State = { result: null };

// === L?: const _uploadsOf ===
const _uploadsOf = channelId => 'UU' + String(channelId).slice(2);

// [P0a-nf] Cụm NF_MAP / nfRun / nfRenderHot / nfRenderScorecard / nfRenderBw / nfRenderAttention /
// _NF_RUNGS / _nfScChannel / _nfWired / _nfActive / _nfWv đã DỜI về utility/niche.js (2026-09-10i).
// Lý do: bảng NF_MAP ở đây capture `render: nfRenderHot...` ngay lúc nạp (stale capture) — bản render
// mới trong niche.js không bao giờ chạy qua m.render dù tên fn bị ghi đè. Xoá bản cũ → niche.js là owner duy nhất.

// === L?: const setStatus10 ===
const setStatus10 = (m, t) => setStatusBar('status10', m, t);

// === L?: const t10State ===
const t10State = { refs: [], results: [], loadedProfileId: null };

// === L?: const t9Ref ===
const t9Ref = { mode: 'topic', items: [], sel: null, base64: null, mime: '' };

// === L?: const T9_REF_RULE ===
const T9_REF_RULE = ' The attached reference image is the TEMPLATE. Match its art technique, background treatment, layout skeleton, caption styling and position, callout devices, palette and contrast as closely as possible — a viewer should recognise them as the same template. '
  + 'Change only the depicted subject and label wording so they fit this video. '
  + 'Never reproduce a recognisable real person, a logo or a brand mark from the reference.';

// === L?: const _hasViet ===
const _hasViet = (x) => /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(String(x || ''));

// === L?: let _t9RefAuto ===
let _t9RefAuto = false;

/* === _BE_MO_TA stub (recovered for v2 extractor future-proofing) === */
const _BE_MO_TA = { omni: { mo: 'OmniVoice' }, vieneu: { mo: 'VieNeu' }, xtts: { mo: 'XTTS' } };


