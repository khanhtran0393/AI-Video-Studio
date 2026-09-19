/* T7 SUBPANEL — panel "Phụ đề" kiểu EZMAXSUB cho Dựng Video (Tool 7)
   2026-09-18: thay nội dung tab 💬 Phụ đề của bin (_t7RailSubs cũ chỉ có kiểu chữ) bằng
   bảng phân đoạn phụ đề đầy đủ: danh sách theo timeline, tìm kiếm, chip lọc
   (Tất cả / Chưa dịch / Cần chú ý / Thiếu audio), Dịch thuyết minh, Tạo giọng thuyết minh
   (TTS từng câu → ghép đúng khe timing bằng Web Audio → gắn vào timeline qua t7HandleAudio),
   Nhập file SRT (parseSRT có sẵn), thêm/sửa phân đoạn tại playhead.
   NGUỒN DỮ LIỆU — không nhân bản: text = state.scenes[].text (qua _t7ClipText/_t7ClipScene),
   bản dịch = state.sceneTrans (cùng nguồn với nút "🌐 Dịch tiếng Việt"), giọng = t7State.audioFile,
   vị trí audio từng phân đoạn do panel tạo = state.t7SubAudioAt (lưu theo profile).
   Toàn bộ là function declaration + let trạng thái riêng tiền tố _t7Sub* — không đụng tên khác. */

let _t7SubQ = '', _t7SubFilter = 'all', _t7SubOpenId = null, _t7SubDraft = null, _t7SubBusyVoice = false;

/* ── DỮ LIỆU: phân đoạn phụ đề suy ra từ timeline (1 cảnh không-import = 1 phân đoạn) ── */
function _t7SubCues(){
  const out = []; let t = 0;
  const clips = _t7Clips();
  for (let i = 0; i < clips.length; i++){
    const c = clips[i], dur = _t7ClipDur(c);
    if (!c.imported){
      const sc = _t7ClipScene(c);
      out.push({ clip: c, idx: i, start: t, end: t + dur, dur,
        text: String((sc && sc.text) || '').trim(),
        trans: String((state.sceneTrans || {})[c.sceneId] || '').trim(),
        scene: sc || null });
    }
    t += dur;
  }
  return out;
}
/* Trạng thái 1 phân đoạn: empty → trống chữ; noaudio → chưa có giọng; warn → đọc không kịp/bị dồn;
   untrans → chưa có bản dịch tham khảo; ok. "Thiếu audio": chưa gắn track giọng nào, HOẶC
   đã có đánh dấu audio-theo-phân-đoạn (state.t7SubAudioAt) mà phân đoạn này bị thiếu. */
function _t7SubAudioMark(sceneId){ return ((state.t7SubAudioAt || {})[sceneId]) || null; }

function _t7SubStatusOf(cue){
  if (!cue.text) return 'empty';
  const mark = _t7SubAudioMark(cue.clip.sceneId);
  const anyMark = Object.keys(state.t7SubAudioAt || {}).length > 0;
  if (!t7State.audioFile || (anyMark && !mark)) return 'noaudio';
  const wps = cue.text.split(/\s+/).filter(Boolean).length / Math.max(0.5, cue.dur);
  if (wps > 5 || (mark && mark.over)) return 'warn';
  if (!cue.trans) return 'untrans';
  return 'ok';
}

function _t7SubCounts(cues){
  const n = { all: cues.length, untrans: 0, warn: 0, noaudio: 0 };
  for (const c of cues){ const st = _t7SubStatusOf(c); if (n[st] != null) n[st]++; }
  return n;
}

function _t7SubFilterCues(cues){
  const q = _t7SubQ;
  return cues.filter(c => {
    if (q && !(c.text.toLowerCase().includes(q) || c.trans.toLowerCase().includes(q))) return false;
    if (_t7SubFilter === 'untrans') return !!c.text && !c.trans;
    if (_t7SubFilter === 'warn') return _t7SubStatusOf(c) === 'warn';
    if (_t7SubFilter === 'noaudio') return _t7SubStatusOf(c) === 'noaudio';
    return true;
  });
}

/* ── TƯƠNG TÁC: lọc / tìm / tua / sửa / thêm ── */
function t7SubSetFilter(f){ _t7SubFilter = String(f || 'all'); t7SubRender(); }

function t7SubSearch(v){ _t7SubQ = String(v || '').toLowerCase().trim(); t7SubRender(); }

function t7SubSeek(clipId){ t7SelectClip(clipId); }   // t7SelectClip đã tự đưa playhead về đầu cảnh

function t7SubToggle(clipId){
  if (_t7SubOpenId === clipId){ _t7SubOpenId = null; _t7SubDraft = null; }
  else {
    const cue = _t7SubCues().find(c => c.clip.id === clipId);
    _t7SubOpenId = clipId;
    _t7SubDraft = { clipId, text: cue ? cue.text : '' };
  }
  t7SubRender();
}

function t7SubDraftSet(v){ if (_t7SubDraft) _t7SubDraft.text = v; }

function t7SubSave(clipId){
  const cue = _t7SubCues().find(c => c.clip.id === clipId);
  if (!cue || !cue.scene) return setStatus7('Không tìm thấy phân đoạn để lưu phụ đề.', 'error');
  const v = String((_t7SubDraft && _t7SubDraft.clipId === clipId) ? _t7SubDraft.text : cue.text).trim();
  cue.scene.text = v; cue.scene.userEdited = true;
  try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
  _t7SubOpenId = null; _t7SubDraft = null;
  t7AfterEdit(false); t7SubRender();
  setStatus7('✓ Đã lưu phụ đề phân đoạn ' + (cue.idx + 1) + '.', 'ok');
}

function t7SubAdd(){
  if (typeof _pfRequireActive === 'function') _pfRequireActive('thêm phân đoạn phụ đề');
  const at = _t7ClipAt(t7State.playT || 0);
  if (!Array.isArray(state.scenes)) state.scenes = [];
  let mx = 0;
  state.scenes.forEach(s => { const n = parseInt(s && s.id, 10); if (Number.isFinite(n) && n > mx) mx = n; });
  const id = String(mx + 1).padStart(3, '0');
  const sc = { id, text: '', duration: 3, userEdited: true };
  // chèn vào state.scenes NGAY SAU cảnh của clip đang đứng để thứ tự khớp timeline
  let pos = state.scenes.length;
  const atSceneId = (at && at.clip && !at.clip.imported) ? at.clip.sceneId : null;
  if (atSceneId){ const k = state.scenes.findIndex(s => s && s.id === atSceneId); if (k >= 0) pos = k + 1; }
  state.scenes.splice(pos, 0, sc);
  t7Snapshot();
  const clip = { id: _t7NewId(), sceneId: id, dur: 3, fx: 'none', trans: 'none', transDur: 0.5, scale: 1 };
  t7State.clips.splice(at ? at.index + 1 : t7State.clips.length, 0, clip);
  t7State.selClip = clip.id;
  t7AfterEdit(true);
  _t7SubOpenId = clip.id; _t7SubDraft = { clipId: clip.id, text: '' };
  if (t7State.mediaTab === 'dub'){
    // đang ở panel Thuyết minh (rail trái) → KHÔNG đá user sang tab 'subs' (tab đó render
    // vào cột phải, rail trái sẽ treo HTML cũ và mọi nút trông như chết) — vẽ lại rail dub.
    if (typeof _t7dpRender === 'function') _t7dpRender(); else t7SetMediaTab('subs');
  }
  else if (t7State.mediaTab !== 'subs') t7SetMediaTab('subs'); else t7SubRender();
  if (typeof _t7dpRender === 'function') _t7dpRender();   // panel dub đang mở thì cập nhật đếm phân đoạn
  setStatus7('✓ Đã thêm phân đoạn phụ đề mới tại vạch phát — gõ nội dung ở cột 💬 Phụ đề (phải) rồi bấm Lưu.', 'ok');
}
/* ── BACKUP audio gốc trước khi giọng dub đè lên timeline (cho Hoàn tác ♪ Audio trả lại) ──
   Chỉ backup khi audio hiện tại là file người dùng import (không có marker _t7dub).
   File không persist được — backup sống cùng phiên với audioFile, đúng vòng đời. */
function _t7SubBackupAudioForDub(){
  if (t7State.audioFile && !t7State.audioFile._t7dub){
    t7State.dubPrevAudio = { file: t7State.audioFile, peaks: t7State.audioPeaks || null, dur: t7State.audioDur || 0 };
  }
}
/* ── NHẬP FILE SRT → đổ text vào phân đoạn theo mốc thời gian ── */
function t7SubImportSrt(){
  let inp = document.getElementById('t7SubSrtInput');
  if (!inp){
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 't7SubSrtInput'; inp.accept = '.srt,.vtt,text/plain';
    inp.style.display = 'none';
    inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) t7SubApplySrtFile(f); };
    document.body.appendChild(inp);
  }
  inp.click();
}

async function t7SubApplySrtFile(file){
  let text = '';
  try { text = await file.text(); }
  catch (e){ return setStatus7('Không đọc được file phụ đề: ' + (e.message || e), 'error'); }
  if (typeof parseSRT !== 'function') return setStatus7('Bộ đọc SRT (parseSRT) không có trong renderer.', 'error');
  const srts = parseSRT(text);
  if (!srts.length) return setStatus7('File không có mốc thời gian hợp lệ (cần SRT/VTT).', 'error');
  const cues = _t7SubCues();
  if (!cues.length) return setStatus7('Chưa có cảnh nào trên timeline — Sang tab Phân Cảnh để chia cảnh trước.', 'error');
  const total = _t7Total();
  const groups = new Map();                    // cue.idx → [text…]
  let outside = 0;
  for (const s of srts){
    const mid = (s.start + s.end) / 2;
    const cue = (mid >= 0 && mid < total) ? cues.find(c => mid >= c.start && mid < c.end) : null;
    if (!cue){ outside++; continue; }
    const txt = String(s.text || '').trim();
    if (!txt) continue;
    if (!groups.has(cue.idx)) groups.set(cue.idx, []);
    groups.get(cue.idx).push(txt);
  }
  let hit = 0;
  for (const [idx, arr] of groups){
    const cue = cues[idx];
    if (!cue || !cue.scene) continue;
    cue.scene.text = arr.join(' ');
    cue.scene.userEdited = true;
    hit++;
  }
  try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
  t7AfterEdit(false); t7SubRender();
  if (typeof _t7dpRender === 'function') _t7dpRender();   // panel Thuyết minh (rail dub) đang mở → cập nhật đếm
  setStatus7('✓ Đã nạp phụ đề từ ' + file.name + ' vào ' + hit + '/' + cues.length + ' phân đoạn'
    + (outside ? ' · ' + outside + ' dòng nằm ngoài thời lượng video nên bỏ qua' : '') + '.', hit ? 'ok' : 'error');
}

/* ── DỊCH THUYẾT MINH: dùng đúng t7TranslateAll (state.sceneTrans — một nguồn) ── */
async function t7SubTranslate(){
  await t7TranslateAll();
  t7SubRender();
}
/* ── TẠO GIỌNG THUYẾT MINH: TTS từng phân đoạn → ghép đúng khe → gắn vào timeline ──
   Lỗi ở phân đoạn nào thì DỪNG LỘ LIỄU ở phân đoạn đó (không bỏ qua ngầm).           */
function _t7SubEncodeWav(buf){
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true); ws(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++){
    for (let c = 0; c < ch; c++){
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2;
    }
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

async function _t7SubResample(buf, rate){
  if (buf.sampleRate === rate) return buf;
  const oc = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.length * rate / buf.sampleRate), rate);
  const src = oc.createBufferSource(); src.buffer = buf; src.connect(oc.destination); src.start();
  return oc.startRendering();
}

async function t7SubGenerateVoice(){
  if (_t7SubBusyVoice) return setStatus7('⏳ Đang tạo giọng thuyết minh — chờ lô hiện tại xong.', 'info');
  const cues = _t7SubCues().filter(c => c.text);
  if (!cues.length) return setStatus7('Không có câu thoại nào để tạo giọng thuyết minh.', 'error');
  if (typeof ttsDoc !== 'function') return setStatus7('Engine giọng nói (ttsDoc) không có trong renderer.', 'error');
  if (typeof _pfRequireActive === 'function') _pfRequireActive('tạo giọng thuyết minh');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return setStatus7('Môi trường không hỗ trợ Web Audio để ghép giọng.', 'error');
  const btn = document.getElementById('t7SubVoiceBtn'); if (btn) btn.disabled = true;
  _t7SubBusyVoice = true;
  const ctx = new AC();
  const placed = [];
  try {
    for (let i = 0; i < cues.length; i++){
      setStatus7('🎙 Tạo giọng thuyết minh ' + (i + 1) + '/' + cues.length + '…', 'working');
      const r = await ttsDoc(cues[i].text);
      if (!r || !r.blob) throw new Error('TTS không trả file âm thanh.');
      const buf = await ctx.decodeAudioData(await r.blob.arrayBuffer());
      if (!buf || !buf.length) throw new Error('File âm thanh đọc được rỗng.');
      placed.push({ cue: cues[i], buf });
    }
  } catch (e){
    try { ctx.close(); } catch (_){}
    _t7SubBusyVoice = false; if (btn) btn.disabled = false; t7SubRender();
    return setStatus7('❌ Tạo giọng dừng ở phân đoạn ' + (placed.length + 1) + ': ' + (e.message || e), 'error');
  }
  // Xếp từng đoạn audio vào đúng khe của phân đoạn; giọng dài hơn khe → dồn (khai báo "over")
  const sr = placed[0].buf.sampleRate;
  let prevEnd = 0, over = 0;
  for (const p of placed){
    p.at = Math.max(p.cue.start, prevEnd);
    if (p.at > p.cue.start + 0.05) over++;
    prevEnd = p.at + p.buf.duration;
  }
  const total = Math.max(_t7Total(), prevEnd) + 0.2;
  setStatus7('🎚 Ghép ' + placed.length + ' đoạn giọng vào timeline…', 'working');
  const oc = new OfflineAudioContext(1, Math.ceil(total * sr), sr);
  for (const p of placed){
    const b = await _t7SubResample(p.buf, sr);
    const src = oc.createBufferSource(); src.buffer = b; src.connect(oc.destination); src.start(p.at);
  }
  const mixed = await oc.startRendering();
  const wav = _t7SubEncodeWav(mixed);
  try { ctx.close(); } catch (_){}
  _t7SubBusyVoice = false; if (btn) btn.disabled = false;
  if (!state.t7SubAudioAt) state.t7SubAudioAt = {};
  for (const p of placed){
    state.t7SubAudioAt[p.cue.clip.sceneId] = { start: +p.at.toFixed(2), dur: +p.buf.duration.toFixed(2), over: p.at > p.cue.start + 0.05 };
  }
  try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
  _t7SubBackupAudioForDub();   // giữ audio gốc đã import (nếu có) để Hoàn tác ♪ Audio trả lại
  const dubFile = new File([wav], 'thuyet-minh-tu-dong.wav', { type: 'audio/wav' });
  dubFile._t7dub = true;       // MARKER: track này do Thuyết minh sinh — mọi lần import audio mới tự mất cờ (đổi object File)
  await t7HandleAudio(dubFile);
  t7SubRender();
  setStatus7('✓ Đã tạo giọng thuyết minh cho ' + placed.length + ' phân đoạn'
    + (over ? ' · ⚠️ ' + over + ' khe bị dồn tiếng (giọng dài hơn cảnh — kéo dài cảnh hoặc rút chữ)' : '')
    + '. File giọng đã gắn vào timeline.', over ? 'info' : 'ok');
}
/* ── CHUYỂN TAB CỘT PHẢI (t7-studio): 💬 Phụ đề ⇄ ⚙ Chi tiết cảnh ── */
function t7RightTab(t){
  const sub = document.getElementById('t7SubPanel'), insp = document.getElementById('t7InspBody');
  const bS = document.getElementById('t7RTabSubs'), bI = document.getElementById('t7RTabInsp');
  const onSub = (t !== 'insp');
  if (sub) sub.style.display = onSub ? '' : 'none';
  if (insp) insp.style.display = onSub ? 'none' : '';
  if (bS) bS.classList.toggle('on', onSub);
  if (bI) bI.classList.toggle('on', !onSub);
  if (onSub) t7SubRender();
}

/* ── RENDER PANEL ── */
function _t7SubDot(st){
  const m = {
    ok:      ['var(--green)', 'Đã đủ chữ, giọng và bản dịch tham khảo'],
    untrans: ['var(--violet)', 'Chưa có bản dịch tham khảo — bấm "Dịch thuyết minh"'],
    warn:    ['var(--amber, #f59e0b)', 'Cần chú ý: đọc không kịp hoặc giọng bị dồn sang khe sau'],
    noaudio: ['var(--red)', 'Chưa có giọng thuyết minh — bấm "Tạo giọng thuyết minh"'],
    empty:   ['var(--text-dim)', 'Phân đoạn trống — bấm để gõ nội dung'],
  };
  const e = m[st] || m.empty;
  return '<span class="dot" style="background:' + e[0] + '" title="' + escapeHtml(e[1]) + '"></span>';
}

function t7SubRender(){
  const box = document.getElementById('t7SubPanel'); if (!box) return;   // cột phải t7-studio (tab 💬 Phụ đề)
  const cues = _t7SubCues();
  const n = _t7SubCounts(cues);
  const shown = _t7SubFilterCues(cues);
  const chips = [
    ['all', 'Tất cả', n.all], ['untrans', 'Chưa dịch', n.untrans],
    ['warn', 'Cần chú ý', n.warn], ['noaudio', 'Thiếu audio', n.noaudio],
  ].map(([k, lb, v]) => {
    const on = _t7SubFilter === k;
    return '<button class="t7-mini" onclick="t7SubSetFilter(\'' + k + '\')" style="' + (on
      ? 'background:var(--accent);color:#1a1207;border-color:var(--accent);font-weight:700'
      : '') + '">' + lb + ' <span style="opacity:.75">' + v + '</span></button>';
  }).join('');
  const list = shown.map(c => {
    const st = _t7SubStatusOf(c);
    const open = _t7SubOpenId === c.clip.id;
    const wps = c.text ? Math.round(c.text.split(/\s+/).filter(Boolean).length / Math.max(0.5, c.dur) * 10) / 10 : 0;
    const mark = _t7SubAudioMark(c.clip.sceneId);
    const meta = [
      _t7Fmt(c.start) + ' → ' + _t7Fmt(c.end),
      c.dur.toFixed(1) + 's',
      wps ? wps + ' từ/s' : '',
      mark ? '🎙 ' + mark.start + 's +' + mark.dur.toFixed(1) + 's' : '',
    ].filter(Boolean).join(' · ');
    const body = !open ? '' :
      '<div class="t7-sbd" style="padding:8px 10px 10px">' +
        '<textarea rows="3" oninput="t7SubDraftSet(this.value)" style="width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 9px;font-size:12.5px;line-height:1.45;resize:vertical">' + escapeHtml((_t7SubDraft && _t7SubDraft.clipId === c.clip.id) ? _t7SubDraft.text : c.text) + '</textarea>' +
        (c.trans ? '<div class="t7-dim" style="font-size:11.5px;margin:7px 0 0;line-height:1.5"><b style="color:var(--violet)">🌐</b> ' + escapeHtml(c.trans) + '</div>' : '') +
        '<div style="display:flex;gap:7px;margin-top:9px">' +
          '<button class="btn primary sm" style="flex:1;justify-content:center" onclick="t7SubSave(\'' + c.clip.id + '\')">✓ Lưu</button>' +
          '<button class="btn ghost sm" style="justify-content:center" onclick="t7SubToggle(\'' + c.clip.id + '\')">Đóng</button>' +
        '</div>' +
      '</div>';
    return '<div class="t7-sc' + (open ? ' open' : '') + '">' +
      '<button class="t7-lrow' + (open ? ' on' : '') + '" onclick="t7SubToggle(\'' + c.clip.id + '\')">' +
        '<span class="th"><b>' + c.dur.toFixed(1) + 's</b></span>' +
        '<span class="tx"><b>' + (Number(c.clip.sceneId) || (c.idx + 1)) + ' · ' + escapeHtml(c.text ? c.text.slice(0, 70) : '— phân đoạn trống —') + '</b>' +
        '<s>' + escapeHtml(meta) + (c.trans ? ' · 🌐 ' + escapeHtml(c.trans.slice(0, 48)) : '') + '</s></span>' +
        _t7SubDot(st) +
      '</button>' + body + '</div>';
  }).join('');
  const empty = '<div class="t7-empty t7-sub-empty" style="padding:26px 14px;text-align:center">' +
      '<div style="width:52px;height:52px;margin:0 auto 10px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px">💬</div>' +
      '<div style="font-size:13px;font-weight:700;color:var(--text)">Chưa có phụ đề</div>' +
      '<div style="font-size:11.5px;line-height:1.6;color:var(--text-dim);margin-top:3px">Thêm một câu thoại tại vạch phát<br>hoặc nhập file SRT có sẵn.</div>' +
      '<button class="ez-goldbtn" style="margin-top:12px;padding:8px 16px" onclick="t7SubAdd()">＋ Thêm phụ đề</button>' +
    '</div>';
  box.innerHTML =
    '<div style="display:flex;align-items:center;gap:7px;margin:2px 0 8px">' +
      '<span class="t7-ezhead">Danh sách phụ đề</span>' +
      '<span class="t7-chip">' + n.all + ' phân đoạn</span>' +
      '<span style="flex:1"></span>' +
      '<button class="ez-goldbtn" onclick="t7SubAdd()" title="Thêm phân đoạn phụ đề mới tại vạch phát">＋ Thêm</button>' +
    '</div>' +
    '<input id="t7SubSearchBox" placeholder="Tìm trong phụ đề…" value="' + escapeHtml(_t7SubQ) + '" oninput="t7SubSearch(this.value)" ' +
      'style="width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 9px;font-size:12px;margin-bottom:8px">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + chips + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button class="btn ghost sm" id="t7SubTransBtn" onclick="t7SubTranslate()" title="Dịch các câu thoại sang tiếng Việt để tham khảo (state.sceneTrans)">🌐 Dịch thuyết minh (' + n.untrans + ')</button>' +
      '<button class="btn ghost sm" id="t7SubVoiceBtn" onclick="t7SubGenerateVoice()" title="TTS từng phân đoạn rồi ghép đúng khe timing thành track giọng đọc">🎙 Tạo giọng (' + cues.filter(c => c.text).length + ')</button>' +
      '<button class="btn ghost sm" onclick="t7SubImportSrt()" title="Nhập file SRT/VTT — đổ text vào phân đoạn theo mốc thời gian">📄 Nhập file</button>' +
    '</div>' +
    (shown.length ? list : (cues.length
      ? '<div class="t7-empty" style="padding:16px">Không có phân đoạn nào khớp bộ lọc / từ khoá.</div>'
      : empty)) +
    '<div style="border-top:1px solid var(--border);margin:12px -10px 0;padding:9px 10px 0">' +
      '<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Kiểu chữ khi burn phụ đề vào video.</div>' +
      '<div id="t7SubStyleChipsRail" style="display:flex;gap:7px;flex-wrap:wrap"></div>' +
      '<label class="t7-mlab" style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">' +
        '<input type="checkbox" id="t7SubsRailOn" style="accent-color:var(--accent);width:15px;height:15px" ' +
        'onchange="(function(v){const e=document.getElementById(\'t7ExpSubs\');if(e){e.checked=v;} if(typeof t7RenderPreview===\'function\'&&!t7State.playing)t7RenderPreview();})(this.checked)">' +
        'Ghi phụ đề vào video khi xuất' +
      '</label>' +
    '</div>';
  // đồng bộ toggle + chip kiểu chữ với hộp Xuất — một nguồn sự thật như _t7RailSubs cũ
  const on = document.getElementById('t7ExpSubs'), cb = document.getElementById('t7SubsRailOn');
  if (on && cb) cb.checked = !!on.checked;
  try {
    const src = document.getElementById('t7SubStyleChips'), dst = document.getElementById('t7SubStyleChipsRail');
    if (typeof t7RenderSubStyleChips === 'function') t7RenderSubStyleChips();
    if (src && dst) dst.innerHTML = src.innerHTML;
  } catch (_) {}


}




