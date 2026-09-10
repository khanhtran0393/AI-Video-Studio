/* promote-shared-to-peer: 1 hàm thay bằng bản đầy đủ từ shared-consts.js */
/* AUTO-EXTRACTED from index.html block 3 - prefix: cap */

function captureChannelCfg(){
  const p = (typeof getProfile === 'function') ? getProfile() : null; if (!p) return;
  p.t2Cfg = _capCfg(_T2_FIELDS);
  const vc = _capCfg(_VOICE_FIELDS);
  vc.voiceMode = document.querySelector('input[name="voiceMode"]:checked')?.value || '';
  vc.preset = (typeof _voicePreset !== 'undefined') ? (_voicePreset || '') : '';
  p.voiceCfg = vc;
}

