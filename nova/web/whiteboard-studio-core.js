'use strict';
/* ============================================================
   WHITEBOARD STUDIO — CORE (UMD, dùng chung 3 môi trường)
   ------------------------------------------------------------
   Port hành vi "TPL Studio Stories v1.0.2" (Whiteboard Animation
   Studio, PyQt5/Nuitka) sang Nova — phần logic THUẦN, không phụ
   thuộc Electron/node: chạy được cả trong renderer (browser),
   main process (require) và test (node).

   Ánh xạ module gốc (trích từ binary tham chiếu):
     core.auto_scene_model  → scene-model (AnimationItem,
                               TextSlotConfig, FrameTemplate,
                               AutoProjectConfig)
     core.path_engine +
     core.animation_engine  → animation-engine (progress vẽ chữ/
                               reveal ảnh, hand, fade)
     SRT parsing (srt_prompt_worker) → srt
     core.auto_generator    → auto-generator (phân phối thời gian
                               TỶ LỆ theo scene, KHÔNG cap cứng)
     prompt frame (worker)  → prompt-builder (chuỗi request theo
                               khung + tail N giây cuối)

   File này là NGUỒN DUY NHẤT cho logic core — main process
   require trực tiếp (nova/whiteboard-studio/ipc.js), renderer
   nạp qua <script src="whiteboard-studio-core.js">.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WhiteboardCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     1) SCENE MODEL  (core.auto_scene_model)
     ────────────────────────────────────────────────────────── */

  const ITEM_TYPES = ['text', 'image', 'traced_image', 'audio'];
  const REVEAL_DIRS = ['left', 'right', 'top', 'bottom'];

  /** Palette quay vòng như MainWindow._next_color của app gốc. */
  const ITEM_COLORS = [
    '#1F2937', '#B91C1C', '#1D4ED8', '#047857', '#B45309',
    '#6D28D9', '#0E7490', '#BE185D',
  ];

  let __colorSeq = 0;
  /** Màu kế tiếp trong palette (quay vòng) — như MainWindow._next_color. */
  function nextColor() { return ITEM_COLORS[__colorSeq++ % ITEM_COLORS.length]; }


  function AnimationItem(o) {
    o = o || {};
    this.item_id = String(o.item_id || nextId('item'));
    this.item_type = ITEM_TYPES.indexOf(o.item_type) >= 0 ? o.item_type : 'text';
    this.start_time = num(o.start_time, 0);
    this.duration = num(o.duration, 5);
    this.label = String(o.label || '');
    this.color = String(o.color || '#1F2937');
    // text
    this.text = String(o.text || '');
    this.font_size = num(o.font_size, 42);
    // image
    this.image_path = o.image_path ? String(o.image_path) : null;
    this.image_x = num(o.image_x, 0.14);   // toạ độ theo TỶ LỆ (0..1) canvas
    this.image_y = num(o.image_y, 0.12);
    this.image_w = num(o.image_w, 0.72);
    this.image_h = num(o.image_h, 0.62);
    this.reveal_dir = REVEAL_DIRS.indexOf(o.reveal_dir) >= 0 ? o.reveal_dir : 'right';
    // timing vẽ
    this.draw_duration = Math.max(0.05, num(o.draw_duration, Math.min(5, this.duration * 0.6)));
    this.center_x = num(o.center_x, 0.5);
    this.center_y = num(o.center_y, 0.5);
    // nét vẽ (traced_image)
    this.subpaths = Array.isArray(o.subpaths) ? o.subpaths : [];
    this.pen_width = num(o.pen_width, 1.8);
    // audio
    this.media_offset = num(o.media_offset, 0);
  }
  AnimationItem.prototype.clone = function () {
    const c = new AnimationItem(JSON.parse(JSON.stringify(this)));
    c.item_id = nextId('item');
    return c;
  };

  let __idSeq = 1;
  function nextId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + (__idSeq++); }
  function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

  /** TextSlotConfig — cấu hình 1 ô chữ trong template frame. */
  function TextSlotConfig(o) {
    o = o || {};
    this.slot_id = String(o.slot_id || nextId('slot'));
    this.x = clamp01(num(o.x, 0.06));   // tỷ lệ 0..1 so khung
    this.y = clamp01(num(o.y, 0.68));
    this.w = clamp01(num(o.w, 0.88));
    this.h = clamp01(num(o.h, 0.24));
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /**
   * FrameTemplate — template áp dụng cho TẤT CẢ các frame
   * (đúng hành vi app gốc: "Template áp dụng cho TẤT CẢ frame").
   * 1 frame = 1 ảnh + nội dung chữ (AI fill).
   */
  function FrameTemplate(o) {
    o = o || {};
    const slots = (Array.isArray(o.slots) ? o.slots : [])
      .map(function (s) { return s instanceof TextSlotConfig ? s : new TextSlotConfig(s); });
    this.slots = slots;
    // vùng ảnh trong frame (tỷ lệ 0..1)
    this.image_x = clamp01(num(o.image_x, 0.14));
    this.image_y = clamp01(num(o.image_y, 0.10));
    this.image_w = clamp01(num(o.image_w, 0.72));
    this.image_h = clamp01(num(o.image_h, 0.52));
  }
  FrameTemplate.prototype.add_text_slot = function (slot) {
    this.slots.push(slot instanceof TextSlotConfig ? slot : new TextSlotConfig(slot));
    return this.slots[this.slots.length - 1];
  };
  FrameTemplate.prototype.remove_last_slot = function () { return this.slots.pop() || null; };
  /**
   * get_text_for_slot — chia text thành N phần theo số slot
   * (app gốc: chia đều theo từ).
   */
  FrameTemplate.prototype.get_text_for_slot = function (text, slotIndex) {
    const parts = splitEvenly(String(text || ''), this.slots.length);
    return parts[Math.max(0, Math.min(this.slots.length - 1, slotIndex))] || '';
  };
  /**
   * build_time_slots — lấy text SRT trong cửa sổ [start,end] rồi
   * chia vào các slot hiện có.
   */
  FrameTemplate.prototype.build_time_slots = function (entries, start, end) {
    const text = srtWindowText(entries, start, end);
    const out = [];
    for (let i = 0; i < this.slots.length; i++) out.push(this.get_text_for_slot(text, i));
    return out;
  };

  /** Chia text thành n phần gần đều (theo từ, không cắt giữa từ). */
  function splitEvenly(text, n) {
    text = String(text || '').trim();
    n = Math.max(1, Math.floor(n || 1));
    if (!text) return new Array(n).fill('');
    const words = text.split(/\s+/);
    if (n === 1) return [text];
    const per = Math.ceil(words.length / n);
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(words.slice(i * per, (i + 1) * per).join(' '));
    return parts;
  }

  /**
   * AutoProjectConfig — toàn bộ cấu hình 1 project Whiteboard Auto
   * (app gốc: "Toàn bộ cấu hình của 1 project Whiteboard Auto").
   */
  function AutoProjectConfig(o) {
    o = o || {};
    this.frame_seconds = Math.max(1, num(o.frame_seconds, 6));     // ⏱ thời gian mỗi khung
    this.tail_secs = Math.max(0.5, num(o.tail_secs, 5));           // ⚡ N giây cuối mỗi khung
    this.num_text_slots = Math.max(0, Math.min(6, Math.floor(num(o.num_text_slots, 2)))); // 💬 ô chữ/frame
    this.font_size = Math.max(10, num(o.font_size, 34));           // 🔤 Font / Cỡ
    this.image_draw_ratio = Math.max(0.1, Math.min(1, num(o.image_draw_ratio, 0.7))); // 🖼 ảnh vẽ/kết thúc
    this.image_start_ratio = Math.max(0, Math.min(0.8, num(o.image_start_ratio, 0)));
    this.fade_out = Math.max(0, num(o.fade_out, 0.8));             // fade out cuối
    this.width = Math.floor(num(o.width, 1280));
    this.height = Math.floor(num(o.height, 720));
    this.fps = Math.max(1, Math.min(60, Math.floor(num(o.fps, 30))));
    this.template_prompt = String(o.template_prompt || '');
    this.bg_color = String(o.bg_color || '#FFFFFF');
    this.template = o.template instanceof FrameTemplate ? o.template : new FrameTemplate(o.template || {});
    if (!(o.num_text_slots >= 0) && !o.template) {
      // mặc định: 2 slot (đúng app gốc) nằm dưới ảnh
      this.template = new FrameTemplate({});
      while (this.template.slots.length < 2) this.template.add_text_slot({});
    }
  }

  /* ──────────────────────────────────────────────────────────
     2) SRT  (phân tích SRT của srt_prompt_worker)
     ────────────────────────────────────────────────────────── */

  function tsToSec(ts) {
    const m = String(ts || '').trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
    const m2 = String(ts || '').trim().match(/(\d+):(\d+):(\d+)/);
    if (m2) return (+m2[1]) * 3600 + (+m2[2]) * 60 + (+m2[3]);
    return 0;
  }

  /** parseSrt — trả [{index,start,end,text}]; loại dòng rác. */
  function parseSrt(raw) {
    const out = [];
    const blocks = String(raw || '').replace(/\r\n/g, '\n').split(/\n\s*\n/);
    for (const b of blocks) {
      const lines = b.split('\n').filter(function (l) { return l.trim().length; });
      if (!lines.length) continue;
      let i = 0;
      if (/^\d+$/.test(lines[0].trim())) i = 1;
      const tm = lines[i] && lines[i].match(/(\d{1,2}:\d{2}:\d{2}[,.]\d+)\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d+)/);
      if (!tm) continue;
      const text = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      out.push({ index: out.length + 1, start: tsToSec(tm[1]), end: tsToSec(tm[2]), text: text });
    }
    return out;
  }

  /** Text SRT trong cửa sổ [start,end] (chồng lấn 1 phần cũng tính). */
  function srtWindowText(entries, start, end) {
    const parts = [];
    for (const e of entries || []) {
      if (e.start < end - 0.01 && e.end > start + 0.01) parts.push(e.text);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * srtTailText — "Lấy text SRT từ N giây CUỐI của cửa sổ
   * [window_start, window_end]" → prompt ảnh khớp voice-over
   * đang đọc ở cuối khung (đúng docstring app gốc).
   */
  function srtTailText(entries, windowStart, windowEnd, tailSecs) {
    const tail = Math.max(0, Number(tailSecs) || 0);
    return srtWindowText(entries, Math.max(windowStart, windowEnd - tail), windowEnd);
  }

  /* ──────────────────────────────────────────────────────────
     3) ANIMATION ENGINE  (core.animation_engine + path_engine)
     ────────────────────────────────────────────────────────── */

  /**
   * itemState(item, t, ctx) — trạng thái render của 1 item tại t.
   * ctx: { totalDuration, fadeOut } cho fade toàn video.
   * Trả { visible, drawProgress, alpha, hand: {x, y, visible} }.
   * - drawProgress 0..1 (chữ: % glyph đã viết; ảnh: % diện tích
   *   đã wipe; traced: % nét đã vẽ).
   * - "Items hiển thị đến cuối scene" → visible giữ true từ lúc
   *   xuất hiện đến khi item hết duration (text) / hết scene.
   */
  function itemState(item, t, ctx) {
    ctx = ctx || {};
    const st = { visible: false, drawProgress: 0, alpha: 1, hand: { x: 0, y: 0, visible: false } };
    if (!item) return st;
    const start = Math.max(0, item.start_time);
    const appearEnd = start + Math.max(0.05, item.draw_duration);
    if (t < start) return st;
    st.visible = true;
    st.drawProgress = Math.max(0, Math.min(1, (t - start) / Math.max(0.05, item.draw_duration)));
    // hand chạy theo mép đang vẽ trong lúc chưa xong
    if (t < appearEnd) {
      st.hand.visible = true;
      st.hand.progress = st.drawProgress;
    }
    // fade out cuối video (toàn project)
    const total = ctx.totalDuration != null ? ctx.totalDuration : null;
    const fadeOut = Math.max(0, ctx.fadeOut || 0);
    if (total != null && fadeOut > 0 && t > total - fadeOut) {
      st.alpha = Math.max(0, (total - t) / fadeOut);
    }
    // item có duration riêng (audio) → sau khi hết thì ẩn
    if (item.item_type === 'audio' && t > start + item.duration) st.visible = false;
    return st;
  }

  /** Vị trí tay (tỷ lệ 0..1 trong khung) theo kiểu item + hướng reveal. */
  function handPos(item, progress) {
    const p = Math.max(0, Math.min(1, progress));
    switch (item.item_type) {
      case 'image':
      case 'traced_image': {
        const x0 = item.image_x, y0 = item.image_y;
        const w = item.image_w, h = item.image_h;
        switch (item.reveal_dir) {
          case 'left': return { x: x0, y: y0 + h * 0.5, w: w * p, h: h };
          case 'right': return { x: x0 + w * (1 - p), y: y0 + h * 0.5, w: w * p, h: h };
          case 'top': return { x: x0 + w * 0.5, y: y0, w: w, h: h * p };
          case 'bottom': default: return { x: x0 + w * 0.5, y: y0 + h * (1 - p), w: w, h: h * p };
        }
      }
      default: // text: tay chạy ngang theo % chữ
        return { x: null, y: null, textProgress: p };
    }
  }

  /** Tổng thời lượng timeline = max(start + duration) các item. */
  function totalDuration(items) {
    let t = 0;
    for (const it of items || []) t = Math.max(t, it.start_time + Math.max(0.05, it.duration));
    return t;
  }

  /**
   * Phân phối thời gian TỰ ĐỘNG (docstring app gốc):
   * "tốc độ viết tỷ lệ với thời lượng scene. KHÔNG giới hạn cứng
   *  5s — hoàn toàn tỷ lệ. Items hiển thị đến cuối scene."
   */
  function autoDrawDuration(sceneDuration, ratio) {
    return Math.max(0.3, sceneDuration * Math.max(0.05, Math.min(1, ratio || 0.6)));
  }

  /* ──────────────────────────────────────────────────────────
     4) AUTO GENERATOR  (core.auto_generator)
     ────────────────────────────────────────────────────────── */

  /**
   * buildAutoProject({images, srtEntries, audioDuration, config}):
   * - frameCount = ceil(audioDuration / frame_seconds)
   * - mỗi frame: ảnh (draw theo image_draw_ratio, HIỂN THỊ ĐẾN
   *   CUỐI scene) + text slots (viết tỷ lệ theo scene).
   * - ảnh thiếu → xoay vòng (cảnh báo); ảnh dư → bỏ.
   * Trả {frames, items, totalDuration, warnings}.
   */
  function buildAutoProject(input) {
    const cfg = input.config instanceof AutoProjectConfig ? input.config : new AutoProjectConfig((input && input.config) || {});
    const images = (input && input.images) || [];
    const entries = (input && input.srtEntries) || [];
    const audioDuration = Math.max(0, Number(input && input.audioDuration) || 0);
    const warnings = [];
    if (audioDuration <= 0) warnings.push('Không xác định được thời lượng!');
    const frameCount = Math.max(1, Math.ceil(audioDuration / cfg.frame_seconds));
    if (!images.length) warnings.push('Thiếu ảnh — chọn thư mục ảnh trước!');
    const frames = [];
    const items = [];
    for (let f = 0; f < frameCount; f++) {
      const start = f * cfg.frame_seconds;
      const dur = Math.min(cfg.frame_seconds, Math.max(0.5, audioDuration - start));
      const end = start + dur;
      const tail = srtTailText(entries, start, end, cfg.tail_secs);
      const slotTexts = [];
      const nSlots = Math.max(0, cfg.template.slots.length);
      for (let s = 0; s < nSlots; s++) slotTexts.push(cfg.template.get_text_for_slot(tail, s));
      const img = images.length ? images[f % images.length] : null;
      if (img && f >= images.length) warnings.push('Ảnh chỉ có ' + images.length + ' — tái dùng theo vòng lặp ở frame ' + (f + 1));
      const frame = {
        frame: f + 1, start: start, end: end, duration: dur,
        image: img, tail_text: tail, slot_texts: slotTexts,
        prompt_text: tail,
      };
      frames.push(frame);
      // Ảnh: bắt đầu theo image_start_ratio, vẽ hết image_draw_ratio
      // của scene, xuất hiện đến cuối scene (không biến mất).
      if (img) {
        items.push(new AnimationItem({
          item_type: 'image',
          start_time: start + dur * cfg.image_start_ratio,
          duration: dur,                                  // hiển thị đến cuối scene
          draw_duration: Math.max(0.3, dur * cfg.image_draw_ratio),
          image_path: img,
          image_x: cfg.template.image_x, image_y: cfg.template.image_y,
          image_w: cfg.template.image_w, image_h: cfg.template.image_h,
          reveal_dir: 'right',
          label: imgLabel(img),
          color: '#2C2C2C',
        }));
      }
      // Text: viết tỷ lệ thời lượng scene (KHÔNG cap cứng).
      let slotIdx = 0;
      for (const stext of slotTexts) {
        const slot = cfg.template.slots[slotIdx++];
        if (!stext) continue;
        const textStart = start + dur * (cfg.image_start_ratio + 0.05);
        const writeDur = autoDrawDuration(dur, 0.55);
        items.push(new AnimationItem({
          item_type: 'text',
          start_time: textStart,
          duration: Math.max(writeDur, end - textStart),   // giữ đến cuối scene
          draw_duration: writeDur,
          text: stext, font_size: cfg.font_size,
          image_x: slot.x, image_y: slot.y, image_w: slot.w, image_h: slot.h,
          color: '#1F2937', label: 'chữ: ' + stext.slice(0, 24),
        }));
      }
    }
    return { frames: frames, items: items, totalDuration: totalDuration(items), warnings: warnings, config: cfg };
  }

  function imgLabel(p) {
    const s = String(p || '').replace(/\\/g, '/');
    return s.slice(s.lastIndexOf('/') + 1);
  }

  /* ──────────────────────────────────────────────────────────
     5) PROMPT BUILDER  (phần thuần của core.srt_prompt_worker)
     ────────────────────────────────────────────────────────── */

  /**
   * buildFramePromptRequests({srtEntries, audioDuration, frameSeconds,
   * tailSecs}) → [{frame, start, end, text}] cho từng khung hình.
   * "Worker tạo image prompt theo TỪNG KHUNG HÌNH của video… lấy
   * SRT từ N giây CUỐI mỗi khung (tail_secs)". Ví dụ app gốc:
   * khung 23s, tail=5s → SRT 18-23s → prompt cho khung đó.
   */
  function buildFramePromptRequests(input) {
    const entries = (input && input.srtEntries) || [];
    const audioDuration = Math.max(0, Number(input && input.audioDuration) || 0);
    const frameSeconds = Math.max(1, Number(input && input.frameSeconds) || 6);
    const tailSecs = Math.max(0, Number(input && input.tailSecs) || 5);
    const n = Math.max(1, Math.ceil(audioDuration / frameSeconds));
    const reqs = [];
    for (let f = 0; f < n; f++) {
      const start = f * frameSeconds;
      const end = Math.min(audioDuration, start + frameSeconds);
      reqs.push({
        frame: f + 1, start: start, end: end,
        text: srtTailText(entries, start, end, tailSecs),
      });
    }
    return reqs;
  }

  /** Template prompt mặc định (app gốc để trống = mặc định). */
  const DEFAULT_PROMPT_TEMPLATE =
    'Minimal flat vector illustration on pure white background, black outlines, ' +
    'no text, no watermark, clean composition, 16:9. Subject: {TEXT}';

  function fillPromptTemplate(template, text) {
    const t = String(template || '').trim();
    const body = t ? t : DEFAULT_PROMPT_TEMPLATE;
    return body.replace(/\{TEXT\}|%TEXT%|\{text\}/gi, String(text || '').trim());
  }

  /**
   * Chuẩn hoá keyword chủ đề — "Bắt buộc ĐÚNG 2 từ tiếng Việt có
   * nghĩa" (worker gọi Gemini trả về n keyword, mỗi cái 2 từ, retry).
   */
  function isTwoVietnameseWords(s) {
    const t = String(s || '').trim().toLowerCase();
    if (!t) return false;
    const words = t.split(/\s+/);
    if (words.length !== 2) return false;
    // có dấu tiếng Việt hoặc chữ cái latin
    return /^[a-zà-ỹăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ0-9-]+(\s[a-zà-ỹăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ0-9-]+)$/.test(t);
  }

  function topicKeywordsPrompt(topic, n) {
    n = Math.max(1, Math.floor(n || 8));
    return 'Chủ đề: ' + String(topic || '').trim() + '\n' +
      'Hãy trả về ĐÚNG ' + n + ' keyword tiếng Việt, mỗi keyword ĐÚNG 2 từ có nghĩa, ' +
      'để tìm ảnh minh hoạ (whiteboard style). Chỉ trả JSON: {"keywords":["từ thứ nhất","từ hai",…]}';
  }

  function framePromptRequestText(frameReq, template) {
    return fillPromptTemplate(template, frameReq.text);
  }

  return {
    // model
    AnimationItem: AnimationItem,
    TextSlotConfig: TextSlotConfig,
    FrameTemplate: FrameTemplate,
    AutoProjectConfig: AutoProjectConfig,
    ITEM_COLORS: ITEM_COLORS,
    nextColor: nextColor,
    nextId: nextId,
    splitEvenly: splitEvenly,
    // srt
    parseSrt: parseSrt,
    srtWindowText: srtWindowText,
    srtTailText: srtTailText,
    tsToSec: tsToSec,
    // engine
    itemState: itemState,
    handPos: handPos,
    totalDuration: totalDuration,
    autoDrawDuration: autoDrawDuration,
    // auto generator
    buildAutoProject: buildAutoProject,
    // prompt
    buildFramePromptRequests: buildFramePromptRequests,
    fillPromptTemplate: fillPromptTemplate,
    DEFAULT_PROMPT_TEMPLATE: DEFAULT_PROMPT_TEMPLATE,
    isTwoVietnameseWords: isTwoVietnameseWords,
    topicKeywordsPrompt: topicKeywordsPrompt,
    framePromptRequestText: framePromptRequestText,
    REVEAL_DIRS: REVEAL_DIRS,
    VERSION: '1.0.2-port',
  };
});
