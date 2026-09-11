/* AUTO-EXTRACTED from index.html block 3 - prefix: tts */

async function ttsDoc(text, onTien){
  const uu = _giongDS.find(v => v.key === _giongChon) || _giongDS[0];
  if (!uu) throw new Error('Chưa có giọng nào trong thư viện.');
  const thu = [_voiceBackend].concat(Object.keys(_TTS_TEN).filter(e => e !== _voiceBackend));
  let loiDau = null;
  for (const eng of thu){
    try {
      if (onTien && eng !== _voiceBackend) onTien('chuyển sang ' + _TTS_TEN[eng]);
      const blob = await _ttsChay(eng, uu, text, giongDocTuyChon(), onTien);
      return { blob, giong: uu, engine: eng, luiVe: eng !== _voiceBackend };
    } catch (e){
      if (!loiDau) loiDau = e;
      // engine thật sự hỏng (chưa cài, lỗi model…) → chấm đỏ, đừng để xanh dối lòng.
      if (_giongTT[eng] === 'ok'){ _giongTT[eng] = 'err'; try { giongKiemEngineVe(); } catch (_){} }
      try { novaLog('🎙 ' + _TTS_TEN[eng] + ' lỗi — ' + (e.message || e), 'warn'); } catch (_){}
    }
  }
  throw loiDau || new Error('Không engine nào đọc được.');
}


/* === Moved verbatim from shared-consts.js (2026-09-10, task move-9-tts): engine TTS + key-UI + tra giọng + nhân bản === */

// === L7861 (34d9dff5): function _ttsKey ===
function _ttsKey(e){
  const k = (localStorage.getItem(_TTS_KHOA[e]) || '').trim();
  // OpenAI: mượn luôn key của provider AI nếu tab API đã có, khỏi nhập hai lần.
  if (!k && e === 'openai') return (localStorage.getItem('api_key_openai') || '').split('\n')[0].trim();
  return k.split('\n')[0].trim();
}

// (_ttsChay / _ttsLocal / _giongFetchJson thuộc miền voice — khai báo trong utility/voice.js)

// === L?: function _ttsGiaiThich ===
function _ttsGiaiThich(msg){
  for (const [re, vi] of _TTS_LOI) if (re.test(msg)) return vi + ' [' + String(msg).slice(0, 110) + ']';
  return msg;
}

// === L?: function _ttsBlob ===
function _ttsBlob(r, ten){
  if (!r) throw new Error(ten + ': không có phản hồi.');
  if (r.error) throw new Error(ten + ': ' + r.error);
  if (!r.b64){
    let m = r.text || ('HTTP ' + (r.status || '?'));
    try { const j = JSON.parse(r.text); m = (j.error && (j.error.message || j.error)) || j.detail && (j.detail.message || j.detail) || m; } catch (e){}
    throw new Error(ten + ': ' + _ttsGiaiThich(String(m)).slice(0, 320));
  }
  const bin = atob(r.b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: r.mime || 'audio/mpeg' });
}

async function _ttsOmni(v, text, o, onTien){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend OmniVoice chưa sẵn sàng.'); }
  const body = { text, language: o.lang, speed: o.tocDo, gap_ms: Math.round(o.gap), attributes: {}, preset_id: v.id };
  const sub = await fetch(VOICE_URL + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const tid = sub.task_id;
  if (!tid) throw new Error('Backend không nhận việc.');
  for (let i = 0; i < 900; i++){
    await new Promise(r => setTimeout(r, 1000));
    const s = await fetch(VOICE_URL + '/api/status/' + tid).then(r => r.json());
    if (s.total && onTien) onTien(s.progress + '/' + s.total + ' khối');
    if (s.status === 'completed' || s.status === 'done'){
      if (!s.results || !s.results.merged) throw new Error('Backend không trả file.');
      return await fetch(VOICE_URL + s.results.merged).then(r => r.blob());
    }
    if (s.status === 'failed' || s.status === 'error') throw new Error(s.error || 'Backend báo lỗi.');
  }
  throw new Error('Quá lâu không xong.');
}

async function _ttsEleven(v, text, o){
  const k = _ttsKey('elevenlabs');
  if (!k) throw new Error('Chưa có key ElevenLabs — bấm "Sửa key".');
  return _ttsBlob(await window.native.ttsFetch({
    url: 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(v.id),
    method: 'POST',
    headers: { 'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text, model_id: v.model || 'eleven_multilingual_v2',
      voice_settings: { stability: o.onDinh, similarity_boost: o.tuongDong, speed: o.tocDo },
    }),
    timeoutMs: 300000,
  }), 'ElevenLabs');
}

async function _ttsOpenAI(v, text, o){
  const k = _ttsKey('openai');
  if (!k) throw new Error('Chưa có key OpenAI — bấm "Sửa key".');
  return _ttsBlob(await window.native.ttsFetch({
    url: 'https://api.openai.com/v1/audio/speech',
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: v.model || 'gpt-4o-mini-tts', input: text, voice: v.id,
      speed: Math.max(0.25, Math.min(4, o.tocDo)), response_format: 'mp3',
    }),
    timeoutMs: 300000,
  }), 'OpenAI');
}

// [P0a] Đã xoá: giongVeKey + _giongTraNgay (UI cloud ElevenLabs/OpenAI đã bỏ —
// không còn lời gọi nào; biến mồ côi _giongTra/_giongTraHen/_giongTraId/
// _giongTenTay trong shared-consts.js cũng đã xoá).

// === L?: function giongMoKey ===
function giongMoKey(eng){
  const b = document.getElementById('giongThemBox');
  if (b && b.style.display === 'none'){ _giongThemMo = false; giongThemBat(); }
  const c = document.getElementById('giongThemCach'); if (c) c.value = 'nhap';
  const e = document.getElementById('gtEngine'); if (e && eng) e.value = eng;
  giongThemDoi();
  const o = document.getElementById('gtKey');
  if (o){ o.scrollIntoView({ block: 'center' }); o.focus(); }
}

async function _giongNhanBan(eng, id, model, ten, nhan){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend OmniVoice chưa sẵn sàng — cần nó để giữ bản sao.'); }
  const lang = ((document.getElementById('voiceLang') || {}).value === 'en') ? 'en' : 'vi';
  const doan = _GIONG_MAU_CLONE[lang];
  giongBao('Đang nhờ ' + _TTS_TEN[eng] + ' đọc ' + doan.length + ' ký tự làm mẫu…');
  const o = giongDocTuyChon();
  const gia = { engine: eng, id, model };
  const blob = eng === 'elevenlabs' ? await _ttsEleven(gia, doan, o) : await _ttsOpenAI(gia, doan, o);
  if (!blob || blob.size < 4000) throw new Error(_TTS_TEN[eng] + ' trả file rỗng.');
  giongBao('Đang nạp mẫu ' + Math.round(blob.size / 1024) + ' KB vào OmniVoice…');
  const fd = new FormData();
  fd.append('file', new File([blob], 'mau-' + eng + '.mp3', { type: blob.type || 'audio/mpeg' }));
  const up = await fetch(VOICE_URL + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
  if (!up || !up.path) throw new Error('OmniVoice không nhận được file mẫu.');
  await fetch(VOICE_URL + '/api/voices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ten, ref_text: doan, ref_audio: up.path, attributes: { lang }, tags: nhan.concat(['nhân bản']) }),
  }).then(r => r.json());
}
