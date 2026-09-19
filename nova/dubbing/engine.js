'use strict';
/* ============================================================
   DUBBING — ENGINE (main process, thuần Node — KHÔNG electron)
   ------------------------------------------------------------
   Lồng tiếng theo phụ đề (tham chiếu hành vi DgtAutoTTSMM):
   SRT là MASTER CLOCK — mỗi cue được phát đúng tại startMs của
   nó (khai báo có chủ đích, khác Luật 6 của video-agent nơi TTS
   là master clock; ở đây timeline gốc là chuẩn, Luật 10: khai
   báo rõ thay vì ngầm đổi ngữ nghĩa).
   Hàm thuần, deterministic — test tại nova/dubbing/test.js.
   ============================================================ */

/* Lập kế hoạch khớp audio TTS vào khe thời gian của từng cue:
   - audio ngắn hơn khe → phát nguyên bản (speed 1).
   - audio dài hơn khe → TĂNG TỐC GIỮ CAO ĐỘ (atempo) đúng đủ lấp khe;
     trần maxSpeed (mặc định 1.35×) — vẫn lố → TRIM phần đuôi vượt
     (trimmedMs khai báo rõ trong kế hoạch, không ngâm ép).
   - slot của cue cuối = totalMs − startMs (nếu có); SRT lỗi (cue đè
     cue sau) → slot vô hạn, chỉ trim theo trần tốc độ. */
function fitCuePlan(cues, durationsMs, opts = {}) {
  const maxSpeed = Math.max(1, Math.min(2.5, Number(opts.maxSpeed) || 1.35));
  const totalMs = Number(opts.totalMs) > 0 ? Math.round(Number(opts.totalMs)) : null;
  const list = Array.isArray(cues) ? cues : [];
  const durs = Array.isArray(durationsMs) ? durationsMs : [];
  const plan = [];
  let prevStart = -Infinity;
  for (let i = 0; i < list.length; i++) {
    const c = list[i] || {};
    const startMs = Math.max(0, Math.round(Number(c.startMs) || 0));
    const audioMs = Math.max(0, Math.round(Number(durs[i]) || 0));
    const nextStart = (i + 1 < list.length) ? Math.round(Number(list[i + 1].startMs) || 0) : null;
    let slotMs = null;
    if (nextStart != null && nextStart > startMs) slotMs = nextStart - startMs;
    else if (totalMs != null && totalMs > startMs) slotMs = totalMs - startMs;
    let speed = 1;
    let trimmedMs = 0;
    if (slotMs != null && audioMs > slotMs) {
      speed = audioMs / slotMs;
      if (speed > maxSpeed) {
        speed = maxSpeed;
        trimmedMs = Math.max(0, Math.round(audioMs - Math.round(slotMs * maxSpeed)));
      }
      speed = Math.round(speed * 1000) / 1000;
    }
    // Hiệu quả: phần còn lại sau trim được phát ở tốc độ speed — lấp đúng khe
    // khi bị chặn trần (slot * speed = audioMs - trimmedMs).
    const effMs = Math.max(1, Math.round((audioMs - trimmedMs) / speed));
    plan.push({
      i, startMs,
      slotMs,                       // null = khe không giới hạn (cue cuối / SRT lỗi)
      audioMs, speed, trimmedMs,
      endMs: startMs + effMs,
      prevOverlap: startMs < prevStart, // khai báo SRT lỗi — không sửa ngầm
    });
    prevStart = startMs;
  }
  return plan;
}

/* Cue sau khi khớp — dùng để xuất SRT mới KHỚP với audio đã lồng. */
function buildOutCues(cues, plan) {
  const list = Array.isArray(cues) ? cues : [];
  const pl = Array.isArray(plan) ? plan : [];
  return list.map((c, i) => {
    const p = pl[i] || {};
    const startMs = Math.round(Number(p.startMs) || 0);
    const effMs = Math.max(1, Math.round(Number(p.endMs) || 0) - startMs);
    return Object.assign({}, c, { startMs, endMs: startMs + effMs });
  });
}

/* Thống kê kế hoạch cho UI/event: bao nhiêu cue phải tăng tốc / trim. */
function summarizePlan(plan) {
  const pl = Array.isArray(plan) ? plan : [];
  return {
    total: pl.length,
    spedUp: pl.filter((p) => p.speed > 1).length,
    trimmed: pl.filter((p) => p.trimmedMs > 0).length,
    maxSpeed: pl.reduce((m, p) => Math.max(m, p.speed), 1),
    trimmedTotalMs: pl.reduce((a, p) => a + (p.trimmedMs || 0), 0),
  };
}

/* Tách tên nhân vật khỏi văn bản cue (2026-09-17): "Nam: chào cả nhà" →
   { speaker: 'Nam', spokenText: 'chào cả nhà' }. Prefix nhận cả ':' và '：',
   tên tối đa 24 ký tự. Cue không prefix → speaker '' (giọng chính). */
const SPEAKER_RE = /^([^:：\n]{1,24})\s*[:：]\s+/;
function splitSpeakerCues(cues) {
  const list = Array.isArray(cues) ? cues : [];
  return list.map((c) => {
    const text = String((c && c.text) || '');
    const m = SPEAKER_RE.exec(text);
    if (!m) return Object.assign({}, c, { speaker: '', spokenText: text });
    return Object.assign({}, c, { speaker: m[1].trim(), spokenText: text.slice(m[0].length) });
  });
}

/* Gán giọng cho từng nhân vật: theo THỨ TỰ XUẤT HIỆN ĐẦU TIÊN, round-robin qua
   voicePids (deterministic — không random). speaker '' = giọng đầu tiên. Trả
   map {speaker → pid} + mảng giọng theo từng cue.
   (2026-09-19u) explicitMap (tuỳ chọn): gán tay {tên nhân vật → pid} — nhân
   vật có trong map DÙNG ĐÚNG pid của nó, các nhân vật còn lại round-robin
   (bộ đếm riêng chỉ chạy qua nhân vật tự gán — không lệch vì nhân vật tay).
   Map sai kiểu / có giá trị rỗng → DUB_SPEAKER_MAP lộ liễu (Luật 10). */
function assignSpeakerVoices(splitCues, voicePids, explicitMap) {
  const pids = (Array.isArray(voicePids) ? voicePids : [])
    .map((v) => String(v || '').trim()).filter(Boolean);
  let manual = null;
  if (explicitMap !== undefined && explicitMap !== null) {
    if (typeof explicitMap !== 'object' || Array.isArray(explicitMap)) {
      const e = new Error('DUB_SPEAKER_MAP: gán giọng nhân vật phải là object {tên → pid giọng}.');
      e.code = 'DUB_SPEAKER_MAP'; throw e;
    }
    manual = {};
    for (const k of Object.keys(explicitMap)) {
      const v = String(explicitMap[k] || '').trim();
      if (!v) { const e = new Error('DUB_SPEAKER_MAP: nhân vật "' + k + '" chưa có pid giọng — bỏ khỏi map hoặc điền pid.'); e.code = 'DUB_SPEAKER_MAP'; throw e; }
      manual[String(k)] = v;
    }
  }
  const map = {};
  const voices = [];
  let autoIdx = 0; // chỉ đếm nhân vật gán TỰ ĐỘNG — không lệch vì nhân vật tay
  for (const c of (Array.isArray(splitCues) ? splitCues : [])) {
    const sp = (c && c.speaker) || '';
    if (!(sp in map)) {
      if (manual && manual[sp]) map[sp] = manual[sp];
      else map[sp] = pids.length ? pids[autoIdx++ % pids.length] : '';
    }
    voices.push(map[sp]);
  }
  return { map, voices };
}

/* Tách kịch bản text thành các câu để TTS + tạo SRT chuẩn giờ (2026-09-17ze):
   tách theo dòng trước, rồi theo dấu câu .!?… (giữ nguyên dấu); chỉ gộp mảnh
   VÔ CÙNG ngắn (< 4 ký tự — nhiễu tách câu, vd "Ừ") vào câu liền kề; câu dài
   hơn maxChars (kẹp 20..400) tách tại dấu phẩy/chấm phẩy/dấu cách gần maxChars
   nhất (không cắt giữa từ nếu tránh được). Deterministic. */
const SHORT_SENT_LEN = 4;
function splitScriptText(text, opts = {}) {
  const maxChars = Math.max(20, Math.min(400, Number(opts.maxChars) || 180));
  const raw = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  const sentences = [];
  for (const line of raw.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || [t];
    for (const p of parts) { const s = p.trim(); if (s) sentences.push(s); }
  }
  const merged = [];
  for (const s of sentences) {
    if (merged.length && merged[merged.length - 1].length < SHORT_SENT_LEN) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  if (merged.length > 1 && merged[merged.length - 1].length < SHORT_SENT_LEN) {
    const last = merged.pop();
    merged[merged.length - 1] += ' ' + last;
  }
  const out = [];
  for (const s of merged) {
    if (s.length <= maxChars) { out.push(s); continue; }
    let rest = s;
    while (rest.length > maxChars) {
      const win = rest.slice(0, maxChars);
      const floor = Math.floor(maxChars * 0.4);
      const sep = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
      let cut;
      if (sep >= floor) cut = sep + 1; // giữ dấu câu ở CUỐI đoạn trước (không mất dấu khi ghép lại)
      else {
        cut = win.lastIndexOf(' ');
        if (cut < floor) cut = maxChars;
      }
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter(Boolean);
}

/* Xếp các câu đã TTS thành cue TUẦN TỰ: cue sau bắt đầu sau cue trước + gapMs.
   Thiếu thời lượng (audio hỏng/probe=0) → lỗi lộ liễu DUB_PROBE — không bịa số. */
function cuesFromDurationsMs(texts, durationsMs, opts = {}) {
  const list = Array.isArray(texts) ? texts : [];
  const durs = Array.isArray(durationsMs) ? durationsMs : [];
  const gapMs = Math.max(0, Math.round(Number(opts.gapMs) || 0));
  const cues = [];
  let cursor = 0;
  for (let i = 0; i < list.length; i++) {
    const dur = Math.round(Number(durs[i]) || 0);
    if (!(dur > 0)) {
      const e = new Error('DUB_PROBE: thiếu thời lượng audio cho câu ' + (i + 1) + ' — không bịa số.');
      e.code = 'DUB_PROBE';
      throw e;
    }
    const startMs = cursor;
    cues.push({ startMs, endMs: startMs + dur, text: String(list[i]) });
    cursor = startMs + dur + gapMs;
  }
  return cues;
}

/* Key cache TTS theo vân tay cấu hình (2026-09-19u): hash được tính ở caller
   (sha1) — hàm này sinh CHUỖI gốc deterministic để mọi nơi gọi (dub:render,
   dub:textToSrt) dùng chung một công thức, khỏi lệch key.
   Tốc độ đọc (ttsSpeed) NẰM TRONG KEY — audio sinh ở speed khác là file khác.
   speed = 1 (mặc định) → chuỗi GIỮ NGUYÊN dạng cũ 4 phần (text|pid|lang|
   translateTo) để cache đã tồn tại không bị vứt. */
function ttsCacheKey(text, voicePid, lang, translateTo, ttsSpeed) {
  const base = String(text == null ? '' : text) + '|' + String(voicePid || '') +
    '|' + String(lang || '') + '|' + String(translateTo || '');
  const speed = Number(ttsSpeed);
  if (!(speed > 0 && speed !== 1)) return base; // speed rỗng/1 → dạng cũ
  return base + '|speed:' + (Math.round(speed * 1000) / 1000);
}

module.exports = { fitCuePlan, buildOutCues, summarizePlan, splitSpeakerCues, assignSpeakerVoices, splitScriptText, cuesFromDurationsMs, ttsCacheKey };
