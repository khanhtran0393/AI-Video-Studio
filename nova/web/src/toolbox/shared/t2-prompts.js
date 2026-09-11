/* T2-PROMPTS — Tool 2 prompt: VISUAL_METAPHOR_RULE, _laThuc, T2_TUY_CHON (đã dọn 10 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 10 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
// === L?: const VISUAL_METAPHOR_RULE ===
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

// === L?: const _laThuc ===
const _laThuc = (s) => !!(s && (s.wantStock || s.wantYt || s.wantKho || s.wantWeb));

// === L?: const T2_TUY_CHON ===
const T2_TUY_CHON = {
  highDetail: false,
  hybridIcon: false,
  autoVerify: false,
};

// === L?: function buildSceneGenPrompt ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=26142c, shared=24339c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-prompts.js)

// === L?: let _autoRunning ===
