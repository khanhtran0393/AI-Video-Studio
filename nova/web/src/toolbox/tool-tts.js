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

