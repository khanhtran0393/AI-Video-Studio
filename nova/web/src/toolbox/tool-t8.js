/* AUTO-EXTRACTED from index.html block 3 - prefix: t8 */

function t8GetProvider(){ return localStorage.getItem('t8_provider') || 'groq'; }

function t8GetKey(provider){ return localStorage.getItem('t8_key_' + (provider || t8GetProvider())) || ''; }

function t8GetLang(){ return localStorage.getItem('t8_language') ?? 'en'; }

function t8PickModel(provider, lang){
  if (provider === 'groq') {
    /* Groq công bố: large-v3 8,4% WER · turbo 12% WER, đổi lại turbo nhanh hơn
       13% (216× so với 189× thời gian thực). Cả hai đều MIỄN PHÍ nên đây không
       phải chuyện tiền, chỉ là chính xác hay nhanh.
       Nova lấy large-v3 làm mặc định vì việc ở đây là CĂN GIỜ — sai một từ là
       ảnh rơi sai câu. Thêm nữa turbo chỉ có 4 lớp giải mã thay vì 32, mà mốc
       thời gian từng từ sinh ra chính từ khối đó, nên chênh lệch về timestamp
       nhiều khả năng còn lớn hơn chênh lệch WER. (Suy luận, chưa đo.)          */
    return 'whisper-large-v3';
  }
  if (provider === 'openai') {
    return 'whisper-1';  // OpenAI chỉ có 1 whisper model qua API này
  }
  if (provider === 'local') {
    // English → base.en (English-only, chính xác hơn cho English)
    return lang === 'en' ? 'Xenova/whisper-base.en' : 'Xenova/whisper-base';
  }
  return 'whisper-large-v3-turbo';
}

function t8UpdateModelInfo(){
  const prov = document.getElementById('t8Provider')?.value || 'groq';
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const model = t8PickModel(prov, lang);
  const langLabel = document.getElementById('t8Language')?.selectedOptions[0]?.text || 'Auto';
  const el = document.getElementById('t8ModelInfo');
  if (!el) return;
  let note = '';
  if (prov === 'groq') note = ' (đa ngôn ngữ, nhanh nhất)';
  else if (prov === 'local' && lang === 'en') note = ' (English-only, chính xác hơn)';
  else if (lang === '') note = ' (Whisper tự nhận ngôn ngữ)';
  el.innerHTML = `📌 Sẽ dùng model: <strong>${model}</strong>${note} · Ngôn ngữ: ${langLabel}`;
}

function t8OnLanguageChange(){
  const lang = document.getElementById('t8Language').value;
  localStorage.setItem('t8_language', lang);
  t8UpdateModelInfo();
}

function t8OnProviderChange(){
  const prov = document.getElementById('t8Provider').value;
  const cfg = T8_PROVIDERS[prov];
  document.getElementById('t8ProviderHint').innerHTML = cfg.hint;
  const keyWrap = document.getElementById('t8KeyWrap');
  const keyInput = document.getElementById('t8ApiKey');
  const keyBtns = document.getElementById('t8KeyBtns');
  if (prov === 'local') {
    keyWrap.style.display = 'none';           // local: ẩn hẳn UI API key (không cần)
    if (keyBtns) keyBtns.style.display = 'none';
    keyInput.disabled = true; keyInput.value = '';
  } else {
    keyWrap.style.display = '';
    if (keyBtns) keyBtns.style.display = 'flex';
    keyWrap.style.opacity = '1';
    keyInput.disabled = false;
    keyInput.placeholder = cfg.placeholder;
    keyInput.value = t8GetKey(prov);
  }
  t8UpdateModelInfo();
}

function t8SaveKey(){
  const prov = document.getElementById('t8Provider').value;
  localStorage.setItem('t8_provider', prov);
  if (prov !== 'local') {
    const key = document.getElementById('t8ApiKey').value.trim();
    localStorage.setItem('t8_key_' + prov, key);
  }
  document.getElementById('t8KeyStatus').innerHTML = '<span style="color:var(--green)">✓ Đã lưu cài đặt transcribe.</span>';
  setTimeout(() => { const e = document.getElementById('t8KeyStatus'); if (e) e.innerHTML = ''; }, 3000);
}

async function t8TestKey(){
  const prov = document.getElementById('t8Provider').value;
  const statusEl = document.getElementById('t8KeyStatus');
  if (prov === 'local') {
    statusEl.innerHTML = '<span style="color:var(--text-muted)">Local không cần test key. Bấm Whisper Align để tải model + chạy.</span>';
    return;
  }
  const key = document.getElementById('t8ApiKey').value.trim();
  if (!key) { statusEl.innerHTML = '<span style="color:var(--red)">Chưa nhập key.</span>'; return; }
  const cfg = T8_PROVIDERS[prov];
  if (!key.startsWith(cfg.keyPrefix)) {
    statusEl.innerHTML = `<span style="color:var(--red)">Key ${cfg.name} thường bắt đầu bằng "${cfg.keyPrefix}". Kiểm tra lại.</span>`;
    return;
  }
  statusEl.innerHTML = '<span style="color:var(--text-muted)">Đang test...</span>';
  // Test bằng cách gọi models endpoint (nhẹ)
  try {
    const testUrl = prov === 'groq' ? 'https://api.groq.com/openai/v1/models' : 'https://api.openai.com/v1/models';
    const r = await fetch(testUrl, { headers: { 'Authorization': 'Bearer ' + key } });
    if (r.ok) {
      statusEl.innerHTML = `<span style="color:var(--green)">✓ Key ${cfg.name} hợp lệ! Đã sẵn sàng.</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:var(--red)">Key không hợp lệ (HTTP ${r.status}).</span>`;
    }
  } catch (e) {
    statusEl.innerHTML = `<span style="color:var(--red)">Lỗi kết nối: ${e.message}</span>`;
  }
}

function t8HandleAudio(file){
  if (!file) return;
  t8State.audioFile = file;
  document.getElementById('t8AudioInfo').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  const player = document.getElementById('t8AudioPlayer');
  player.src = URL.createObjectURL(file);
  player.style.display = 'block';
  // Decode để lấy duration
  player.onloadedmetadata = () => {
    t8State.audioDuration = player.duration;
    document.getElementById('t8AudioDur').textContent = player.duration.toFixed(1) + 's';
    t8UpdateInfo();
  };
  // Cảnh báo size cho Groq free (25MB)
  const prov = t8GetProvider();
  if (prov === 'groq' && file.size > 25 * 1024 * 1024) {
    setStatus8('⚠️ File > 25MB — vượt giới hạn Groq free tier. Nén audio xuống hoặc dùng OpenAI.', 'error');
  } else {
    setStatus8(`✓ Đã load audio. Bấm Whisper Align.`, 'ok');
  }
}

function t8UpdateInfo(){
  const sc = state.scenes?.length || 0;
  document.getElementById('t8SceneCount').textContent = sc;
  const estTotal = (state.scenes || []).reduce((a, s) => a + (s.duration || 0), 0);
  document.getElementById('t8EstTotal').textContent = estTotal + 's';
  const warn = document.getElementById('t8DurWarn');
  if (t8State.audioDuration && estTotal) {
    const diff = Math.abs(t8State.audioDuration - estTotal);
    warn.textContent = diff > 5 ? `Lệch ${diff.toFixed(0)}s giữa ước tính và audio — căn timing sẽ fix.` : '';
  }
}

function t8AlignScenesToWords(scenes, words){
  /* Bỏ DẤU trước khi so. Whisper hay nghe đúng tiếng mà đánh sai dấu thanh —
     "chuyện" ra "chuyên", "sẽ" ra "se" — thế là từ đúng bị tính thành sai, timing
     lệch và cảnh báo "audio không khớp" nổi lên oan. Bỏ dấu xong thì mấy trường
     hợp đó khớp bình thường, mà vẫn phân biệt được hai từ THẬT SỰ khác nhau.    */
  const norm = w => String(w || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  const N = words.length;
  const timelineEnd = N ? words[N - 1].end : 0;

  // 1) Tìm START (index trong words) của mỗi cảnh — bỏ qua từ thừa trong VO/SRT để tự bám lại
  const startIdx = [];
  let j = 0;
  // Đếm bao nhiêu từ trong kịch bản tìm thấy trong bản transcribe. Đây là phép đo
  // TRỰC TIẾP xem audio có đúng là đọc kịch bản này không — tổng thời lượng khớp
  // nhau chẳng nói lên điều gì, vì bước "Căn lại" ép tổng khớp bằng mọi giá.
  let khopTu = 0, tongTu = 0;
  for (const scene of scenes) {
    const sw = (scene.text || '').trim().split(/\s+/).map(norm).filter(Boolean);
    if (j >= N || !sw.length) { startIdx.push(j < N ? j : null); continue; }
    startIdx.push(j);
    const jStart = j;
    for (const w of sw) {
      tongTu++;
      if (j >= N) break;
      if (norm(words[j].word) === w) { j++; khopTu++; continue; }
      let found = -1;
      for (let d = 1; d <= 7; d++) { if (j + d < N && norm(words[j + d].word) === w) { found = j + d; break; } }
      if (found >= 0) { j = found + 1; khopTu++; }   // bỏ qua từ thừa trong SRT
      // else: từ này là từ thừa trong VO (SRT không có) → bỏ qua, giữ nguyên j
    }
    // 🛡 CHỐNG KẸT: cảnh hầu như không khớp được (tên riêng/số lạ) → con trỏ không nhích → các cảnh sau dồn về 1 mốc (0.3s).
    // Nếu nhích quá ít so với số từ của cảnh → đẩy j theo ~số từ cảnh để tiến đều; cảnh sau khớp được sẽ tự bám lại.
    if (sw.length >= 3 && (j - jStart) < sw.length * 0.4) {
      j = Math.min(N, jStart + Math.round(sw.length * 0.9));
    }
  }
  const startSec = startIdx.map(idx => (idx == null ? null : words[idx].start));

  // 2) Gap-fill: duration = start cảnh kế tiếp − start cảnh này (cảnh cuối → hết timeline)
  /* 🛡 CHẶN TRÊN. Trước đây chỉ có chặn DƯỚI (dur > 0.05). Khi Whisper trả mốc
     thời gian nhảy cóc — hay gặp ở cuối file dài — hoặc con trỏ khớp lệch, thì
     khoảng cách giữa hai mốc phình thành hàng phút và cảnh nhận nguyên cục đó.
     Đo thật trên máy khách: câu 63 ký tự ("He will spend the next 10 years…")
     nhận 215,2 giây — gấp 54 lần mức hợp lý.
     Ước theo tốc độ đọc THẬT của chính file này (tổng giây / tổng ký tự) rồi
     chặn ở 4 lần. Cảnh nào vượt coi như căn hỏng → trả null, giữ thời lượng cũ
     tính theo văn bản, để bước "Căn lại" co giãn đều cho khớp tổng audio.     */
  // Lượt 1: tính thô để lấy tốc độ đọc chuẩn. Phải dùng TRUNG VỊ chứ không phải
  // trung bình — chỉ một cú nhảy 215 giây là kéo trung bình lên đủ để tự vô
  // hiệu hoá chính cái chặn này (đã thử, bỏ lọt sạch).
  const tho = [];
  for (let i = 0; i < scenes.length; i++){
    if (startSec[i] == null){ tho.push(null); continue; }
    let ns = timelineEnd;
    for (let k = i + 1; k < scenes.length; k++) if (startSec[k] != null){ ns = startSec[k]; break; }
    tho.push(Math.max(0.05, ns - startSec[i]));
  }
  const tiLe = tho.map((d, i) => (d == null ? null : d / Math.max(1, String(scenes[i].text || '').length)))
    .filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  const giayMoiChu = tiLe.length ? tiLe[Math.floor(tiLe.length / 2)] : 0;
  let boQua = 0;
  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (startSec[i] == null) {
      results.push({ id: s.id, text: s.text, oldDur: s.duration || 0, newStart: null, newEnd: null, newDur: null });
      continue;
    }
    let nextStart = timelineEnd;
    for (let k = i + 1; k < scenes.length; k++) { if (startSec[k] != null) { nextStart = startSec[k]; break; } }
    let dur = nextStart - startSec[i];
    if (!(dur > 0.05)) dur = 0.3;   // fallback nếu 2 cảnh trùng mốc
    const uoc = giayMoiChu * String(s.text || '').length;
    if (uoc > 0 && dur > Math.max(15, uoc * 4)){
      boQua++;
      results.push({ id: s.id, text: s.text, oldDur: s.duration || 0, newStart: startSec[i], newEnd: nextStart, newDur: null, hong: +(dur).toFixed(1), uoc: +uoc.toFixed(1) });
      continue;
    }
    results.push({ id: s.id, text: s.text, oldDur: s.duration || 0, newStart: startSec[i], newEnd: nextStart, newDur: Math.round(dur * 10) / 10 });
  }
  results._boQua = boQua;
  results._khop = tongTu ? khopTu / tongTu : 0;
  results._khopTu = khopTu; results._tongTu = tongTu;
  return results;
}

function t8HandleSrt(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    t8SrtText = e.target.result;
    const cues = parseSRT(t8SrtText);
    document.getElementById('t8SrtInfo').innerHTML = cues.length
      ? `✓ Đã đọc <strong>${file.name}</strong> — ${cues.length} dòng phụ đề. Bấm "📄 Căn theo SRT".`
      : `⚠️ Không đọc được mốc thời gian trong file. Kiểm tra định dạng SRT.`;
  };
  reader.readAsText(file);
}

function t8SrtToWords(cues){
  const words = [];
  for (const c of cues) {
    const ws = (c.text || '').trim().split(/\s+/).filter(Boolean);
    if (!ws.length) continue;
    const dur = Math.max(0, c.end - c.start);
    const per = dur / ws.length;
    ws.forEach((w, i) => words.push({ word: w, start: c.start + i * per, end: c.start + (i + 1) * per }));
  }
  return words;
}

function t8AlignBySRT(){
  if (typeof gateTool==='function' && gateTool('tool8')) return;
  if (!state.scenes || state.scenes.length === 0) return setStatus8('Tool 02 chưa có cảnh. Chia cảnh trước.', 'error');
  if (!t8SrtText) return setStatus8('Chưa upload file SRT. Chọn file SRT ở khung bên trái.', 'error');
  const cues = parseSRT(t8SrtText);
  if (!cues.length) return setStatus8('File SRT không có mốc thời gian hợp lệ.', 'error');
  const words = t8SrtToWords(cues);
  if (!words.length) return setStatus8('SRT không có nội dung text để căn.', 'error');
  t8State.alignResults = t8AlignScenesToWords(state.scenes, words);
  t8RenderResults();
  const matched = t8State.alignResults.filter(r => r.newDur != null).length;
  setStatus8(`✓ Đã căn ${matched}/${state.scenes.length} cảnh theo SRT (${cues.length} dòng). Xem bảng → bấm "Áp dụng timing".`, 'ok');
}

async function t8WhisperAlign(){
  if (typeof gateTool==='function' && gateTool('tool8')) return;
  if (!state.scenes || state.scenes.length === 0) return setStatus8('Tool 02 chưa có cảnh. Chia cảnh trước.', 'error');
  if (!t8State.audioFile) return setStatus8('Cần upload audio VO trước.', 'error');
  const prov = document.getElementById('t8Provider').value;

  let words = null;
  try {
    if (prov === 'local') {
      words = await t8TranscribeLocal(t8State.audioFile);
    } else {
      words = await t8TranscribeAPI(prov, t8State.audioFile);
    }
  } catch (e) {
    console.error(e);
    return setStatus8('Lỗi transcribe: ' + e.message, 'error');
  }

  if (!words || words.length === 0) {
    return setStatus8('Whisper không trả về word timestamps. Thử lại hoặc đổi provider.', 'error');
  }

  setStatus8(`✓ Transcribe xong (${words.length} từ). Đang căn timing...`, 'working');
  t8State.alignResults = t8AlignScenesToWords(state.scenes, words);
  t8RenderResults();
  const matched = t8State.alignResults.filter(r => r.newDur != null).length;
  setStatus8(`✓ Đã căn ${matched}/${state.scenes.length} cảnh. Xem bảng so sánh → bấm "Áp dụng timing".`, 'ok');
  notifyDone('✓ Căn timing xong!', `${matched} cảnh đã khớp audio.`);
}

async function t8TranscribeAPI(prov, file){
  const cfg = T8_PROVIDERS[prov];
  let mono;
  try {
    setStatus8('Đang nén audio (16kHz mono) để vượt giới hạn 25MB...', 'working');
    mono = await _decodeToMono16k(file);
  } catch (e) {
    // Không decode được (format lạ) → gửi thẳng nếu nhỏ, else báo nén
    if (file.size <= 24 * 1024 * 1024) { setStatus8(`Đang gửi audio lên ${cfg.name}...`, 'working'); return _t8TranscribeBlob(prov, file, file.name); }
    throw new Error('File >24MB và trình duyệt không giải mã được để nén. Hãy xuất lại mp3 64kbps mono rồi thử.');
  }
  const RATE = 16000, CHUNK_SEC = 600;        // 10 phút/đoạn ≈ 19MB WAV (an toàn < 25MB)
  const chunkSamples = CHUNK_SEC * RATE;
  const nChunks = Math.ceil(mono.length / chunkSamples);
  const words = [];
  for (let ci = 0; ci < nChunks; ci++) {
    const slice = mono.subarray(ci * chunkSamples, Math.min((ci + 1) * chunkSamples, mono.length));
    const blob = _pcmToWav(slice, RATE);
    if (nChunks > 1) setStatus8(`Transcribe ${cfg.name}: đoạn ${ci + 1}/${nChunks} (${Math.round(blob.size / 1048576)}MB)...`, 'working');
    else setStatus8(`Đang gửi audio lên ${cfg.name} (${Math.round(blob.size / 1048576)}MB)...`, 'working');
    const w = await _t8TranscribeBlob(prov, blob, `chunk${ci}.wav`);
    const offset = ci * CHUNK_SEC;
    w.forEach(x => words.push({ word: x.word, start: (x.start || 0) + offset, end: (x.end || 0) + offset }));
  }
  return words;
}

async function t8TranscribeLocal(file){
  const t0 = performance.now();
  // D5: log từng bước (transformers.js -> model -> decode -> transcribe) để user biết kẹt ở đâu khi than 'tai mai'.
  setStatus8('Whisper local: đang nạp transformers.js... (1/4)', 'working');
  let transformers;
  try {
    transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  } catch (e) {
    throw new Error('Không tải được transformers.js. Cần mạng + browser hỗ trợ ES module. Thử Groq thay thế.');
  }
  const { pipeline } = transformers;
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const localModel = t8PickModel('local', lang);
  setStatus8(`Whisper local: đang tải model {localModel} (2/4)... lần đầu ~150MB, lần sau cache.`, 'working');
  const transcriber = await pipeline('automatic-speech-recognition', localModel);
  const _t2 = ((performance.now() - t0) / 1000).toFixed(1);
  setStatus8(`Whisper local: model xong sau {_t2}s. Đang giải mã audio (3/4)...`, 'working');
  // Decode audio → Float32Array 16kHz mono
  const arrayBuf = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  const raw = decoded.getChannelData(0);
  const _t3 = ((performance.now() - t0) / 1000).toFixed(1);
  setStatus8(`Whisper local: giải mã xong ({raw.length} mẫu, {_t3}s). Bắt đầu transcribe (4/4)...`, 'working');
  audioCtx.close();
  // ⚡ CHỐNG ĐƠ UI: xử lý theo TỪNG KHÚC 30s + NHẢ LUỒNG giữa các khúc (thay vì nuốt cả file 1 lần).
  const SR = 16000, CHUNK = 30 * SR;             // khúc 30 giây
  const total = raw.length, nChunks = Math.max(1, Math.ceil(total / CHUNK));
  const words = [];
  const isEn = localModel.endsWith('.en');
  // Khúc nào hỏng là mất trắng 30 giây từ → danh sách từ thủng một lỗ → cảnh nằm
  // đúng chỗ đó nuốt nguyên khoảng trống, thành cảnh dài hàng phút. Trước đây
  // chỉ console.warn nên không ai biết. Giờ đếm và báo ra ngoài.
  let khucHong = 0, khucRong = 0;
  _t8LocalStop = false;
  for (let ci = 0; ci < nChunks; ci++) {
    if (_t8LocalStop || (typeof state !== 'undefined' && state.cancelRequested)) { setStatus8('⏸ Đã dừng transcribe.', 'info'); break; }
    const off = ci * CHUNK;
    const seg = raw.subarray(off, Math.min(off + CHUNK, total));
    const opts = { return_timestamps: 'word' };
    if (lang && !isEn) opts.language = lang;
    let out;
    try { out = await transcriber(seg, opts); }
    catch (e) { console.warn('chunk ' + ci + ' lỗi:', e.message); out = null; khucHong++; }
    const baseT = off / SR;
    if (out && (!out.chunks || !out.chunks.length)) khucRong++;
    if (out && out.chunks) {
      for (const c of out.chunks) {
        const ts = c.timestamp || [];
        if (ts[0] == null) continue;
        words.push({ word: c.text, start: baseT + ts[0], end: baseT + (ts[1] != null ? ts[1] : ts[0]) });
      }
    }
    setStatus8(`🎤 Đang transcribe local… ${Math.round((ci + 1) / nChunks * 100)}% (khúc ${ci + 1}/${nChunks}) — bấm Dừng nếu muốn`, 'working');
    await new Promise(r => setTimeout(r, 40));    // nhả luồng cho UI thở giữa các khúc
  }
  if (!words.length) throw new Error('Local Whisper không ra timestamps. Thử Groq (nhanh + chính xác hơn, cần key ở Cài đặt).');
  try {
    novaLog('🎤 Căn timing chạy LOCAL bằng ' + localModel + ' (~74 triệu tham số) — nhỏ hơn bản Groq khoảng 11 lần, '
      + 'mốc thời gian kém chính xác hơn nhiều. Điền GROQ WHISPER API KEY ở Cài đặt để dùng whisper-large-v3 (miễn phí 2.000 lượt/ngày).',
      khucHong || khucRong ? 'warn' : 'info');
    if (khucHong || khucRong) novaLog('⚠️ Local Whisper: ' + khucHong + ' khúc lỗi, ' + khucRong + ' khúc không ra chữ, trên tổng ' + nChunks
      + ' khúc 30 giây. Mỗi khúc hụt là một lỗ ~30 giây trong dòng thời gian — cảnh rơi vào đó sẽ dài bất thường.', 'warn');
  } catch (_){}
  return words;
}

function t8RenderResults(){
  const panel = document.getElementById('t8ResultPanel');
  const body = document.getElementById('t8ResultBody');
  if (!t8State.alignResults) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const matched = t8State.alignResults.filter(r => r.newDur != null).length;
  document.getElementById('t8MatchCount').textContent = matched + ' cảnh';
  body.innerHTML = t8State.alignResults.map(r => {
    const diff = r.newDur != null ? (r.newDur - r.oldDur) : null;
    const diffStr = diff == null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(1) + 's';
    const diffColor = diff == null ? 'var(--text-muted)' : (Math.abs(diff) > 1.5 ? 'var(--red)' : 'var(--text-muted)');
    return `<tr>
      <td class="id">${r.id}</td>
      <td class="vo">${escapeHtml((r.text || '').slice(0, 80))}${(r.text||'').length>80?'...':''}</td>
      <td style="text-align:right;color:var(--text-muted)">${r.oldDur}s</td>
      <td style="text-align:right;font-weight:600;color:${r.newDur!=null?'var(--accent)':'var(--text-muted)'}">${r.newDur != null ? r.newDur + 's' : 'thiếu audio'}</td>
      <td style="text-align:right;color:${diffColor}">${diffStr}</td>
    </tr>`;
  }).join('');
}

function t8ApplyTimings(){
  if (!t8State.alignResults) return setStatus8('Chưa có kết quả. Bấm Whisper Align trước.', 'error');
  let applied = 0;
  for (const r of t8State.alignResults) {
    if (r.newDur == null) continue;
    const scene = state.scenes.find(s => s.id === r.id);
    if (scene) { scene.duration = r.newDur; applied++; }
  }
  // Re-render Tool 2 + sync profile
  if (typeof renderTable === 'function') renderTable();
  if (typeof updateStats === 'function') updateStats();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  syncStateToCurrentProfile();
  saveState(true);
  setStatus8(`✓ Đã áp dụng timing thật cho ${applied} cảnh. Qua Tool 02 / Dựng Clip để kiểm tra.`, 'ok');
}

async function t8TranscribeSegments(prov, file){
  const cfg = T8_PROVIDERS[prov];
  const key = t8GetKey(prov) || document.getElementById('t8ApiKey').value.trim();
  if (!key) throw new Error(`Chưa có ${cfg.name} key. Nhập + Lưu key trước.`);
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const model = t8PickModel(prov, lang);
  setStatus8(`Đang gửi audio lên ${cfg.name} (${model})...`, 'working');
  const form = new FormData();
  form.append('file', file);
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');  // lấy word-level
  if (lang) form.append('language', lang);
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key },
    body: form
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(`${cfg.name} HTTP ${r.status}: ${txt.slice(0, 200)}`); }
  const data = await r.json();

  // Độ dài dòng mong muốn
  const maxSec = Math.max(2, parseInt(document.getElementById('srtLineSec')?.value) || 4);

  // Nếu có word-level → gộp thành dòng ngắn
  if (data.words && data.words.length) {
    return groupWordsIntoLines(data.words, maxSec);
  }
  // Fallback segment
  if (data.segments && data.segments.length) {
    return data.segments.map(s => ({ start: s.start, end: s.end, text: (s.text || '').trim() }));
  }
  if (data.text) return [{ start: 0, end: t8State.audioDuration || 5, text: data.text.trim() }];
  throw new Error('Không có word/segment timestamps trong response.');
}

async function t8AudioToSRT(){
  if (typeof gateTool==='function' && gateTool('tool8')) return;
  if (!t8State.audioFile) return setStatus8('Cần upload file audio trước (ô Audio Voiceover).', 'error');
  const prov = t8GetProvider();
  if (prov === 'local') return setStatus8('Chế độ này cần Groq/OpenAI (không dùng local). Đổi provider.', 'error');

  try {
    setStatus8('Đang transcribe audio → SRT...', 'working');
    const segments = await t8TranscribeSegments(prov, t8State.audioFile);
    if (!segments.length) return setStatus8('Không nhận được nội dung từ audio.', 'error');

    const fmt = sec => {
      if (sec == null) sec = 0;
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const s = String(Math.floor(sec % 60)).padStart(2, '0');
      const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };
    let srt = '';
    segments.forEach((seg, i) => {
      srt += `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text}\n\n`;
    });

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = (t8State.audioFile.name || 'audio').replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${baseName}.srt`;
    a.click();
    URL.revokeObjectURL(url);

    const total = segments[segments.length - 1]?.end || 0;
    setStatus8(`✓ Đã tải SRT từ audio (${segments.length} dòng, ${Math.round(total)}s). File: ${baseName}.srt`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus8('Lỗi transcribe: ' + e.message, 'error');
  }
}

function t8ExportSRT(){
  // Ưu tiên kết quả align mới nhất; nếu mất (reload) → fallback dùng state.scenes (đã áp dụng timing)
  let entries;
  if (t8State.alignResults && t8State.alignResults.length) {
    entries = t8State.alignResults.map(r => ({
      text: r.text || '',
      start: r.newStart,
      end: r.newEnd,
      fallbackDur: r.oldDur
    }));
  } else if (state.scenes && state.scenes.length) {
    let cur = 0;
    entries = state.scenes.map(s => {
      const start = cur;
      const end = cur + (s.duration || 2);
      cur = end;
      return { text: s.text || '', start, end };
    });
  } else {
    return setStatus8('Chưa có cảnh để xuất SRT. Chia cảnh ở Tool 02 trước.', 'error');
  }
  const fmt = sec => {
    if (sec == null) sec = 0;
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(sec % 60)).padStart(2, '0');
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };
  let srt = '';
  let cursor = 0;
  entries.forEach((e, idx) => {
    const start = e.start != null ? e.start : cursor;
    const end = e.end != null ? e.end : start + (e.fallbackDur || 2);
    srt += `${idx + 1}\n${fmt(start)} --> ${fmt(end)}\n${e.text}\n\n`;
    cursor = end;
  });
  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const profile = getProfile();
  const safeName = (profile?.tenKenh || 'video').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  a.href = url;
  a.download = `subtitle_${safeName}_${new Date().toISOString().slice(0,10)}.srt`;
  a.click();
  URL.revokeObjectURL(url);
  const total = entries[entries.length - 1]?.end || 0;
  const source = t8State.alignResults?.length ? 'theo audio thật' : 'theo duration cảnh hiện tại';
  setStatus8(`✓ Đã tải SRT (${entries.length} dòng, ${Math.round(total)}s, ${source}). Import vào CapCut/Premiere/YouTube.`, 'ok');
}

function t8Reset(){
  t8State.alignResults = null;
  document.getElementById('t8ResultPanel').style.display = 'none';
  setStatus8('Đã xoá kết quả. Sẵn sàng align lại.', 'info');
}

function t8Init(){
  const provSel = document.getElementById('t8Provider');
  if (provSel) {
    provSel.value = t8GetProvider();
    t8OnProviderChange();
  }
  const langSel = document.getElementById('t8Language');
  if (langSel) langSel.value = t8GetLang();
  t8UpdateModelInfo();
  t8UpdateInfo();
}

