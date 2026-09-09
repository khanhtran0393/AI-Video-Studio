/* AUTO-EXTRACTED from index.html block 3 - prefix: cap */

function captureChannelCfg(){
  const p = (typeof getProfile === 'function') ? getProfile() : null; if (!p) return;
  p.t2Cfg = _capCfg(_T2_FIELDS);
  const vc = _capCfg(_VOICE_FIELDS);
  p.voiceCfg = vc;
}

