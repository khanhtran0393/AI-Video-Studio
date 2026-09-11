/* PROFILE — profile/kho: IDB, PRESET, STYLE_PRESETS, _LANG_VOICE, _PF_ICONS, _libTab (đã dọn 4 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 4 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
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

// === L?: const _WD_LIGHT_KEYS ===
const _WD_LIGHT_KEYS = ['script', 'videoLogline', 'videoLoglineSig', 'thumbUrl', 'exportPath', 'videoMix', 'stockMix', 'ytMix', 'stockType', 'seo', 'seoTitle', 'descMode', 't3Era', 't3BgLayout', 'sceneTypesOn'];

// === L?: let _saveTimer ===
let _saveTimer;

// === L?: const PRESET ===
const PRESET = {
  characterStyleB: "Simple stick figure character, large round white circle head (pure white no fill), two small black dot eyes, simple curved smile, thin single black line body arms legs, minimal clothing suggestion with flat color fill, NO detailed features, hand-drawn cartoon style, professional white background",
  characterStyle: "2D cartoon character, bold thick black ink outlines, perfectly round WHITE circle head (pure white, NOT skin-colored), small simple black dot eyes, thin simple eyebrow lines, simple small curved mouth, body with detailed era-appropriate clothing (visible folds layers buttons collars), THIN single black line arms with small round black circle hands, THIN single black line legs ending in X-crossed feet, clothing has warm muted dark colors browns grays dark greens navy, flat color fills no gradients, hand-drawn cartoon style, professional white background",
  backgroundStyle: "2D cartoon background illustration, bold black outlines, detailed interior or exterior environment with depth and atmosphere, muted dark color palette browns grays dark greens warm shadows, visible furniture props architectural details environmental storytelling elements, cinematic moody lighting with warm practical light sources, flat color fills with subtle tone variation, hand-drawn illustration style, NO characters NO people NO figures NO text NO words, 16:9 ratio",
  sceneStyle: "simple 2D flat animation style, thick black outlines, round expressive eyes, simple hand-drawn aesthetic, warm muted color palette, educational explainer video style, no photorealism, flat colors"
};

// === L?: const STYLE_PRESETS ===
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

// === L?: const _LANG_VOICE ===
const _LANG_VOICE = { 'Tiếng Việt':'vi', 'English':'en', '한국어 (Korean)':'ko', '日本語 (Japanese)':'ja', '中文 (Chinese)':'zh' };

// === L?: const _PF_ICONS ===
const _PF_ICONS = {
  char: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bg: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>',
  scene: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  rule: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  script: '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>',
  thumb: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l4.5-4 3.5 2.5L16 11l4 4"/>',
};

// === L?: const setStatusF ===
