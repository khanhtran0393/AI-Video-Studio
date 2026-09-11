'use strict';
/* ── Voice engine registry (P4 roadmap, học từ VEO3 voice-engine registry).
 * Mỗi engine khai báo metadata: id, label, available, reason (khi không sẵn sàng), capabilities.
 * 'omnivoice' là engine đang chạy thật (voice-native.js). 'edge'/'piper' KHÔNG dò mạng,
 * KHÔNG tự cài ngầm: khai báo `available: false` + reason lộ liễu để UI hiển thị rõ
 * (degrade có chủ đích — Luật 10). Khi backend thật được cài, đổi `available` ở đây. ── */

const ENGINES = [
  { id: 'omnivoice', label: 'OmniVoice (nội bộ)', available: true, reason: null, fixHint: '', capabilities: { voices: 'multi-language', streaming: true } },
  {
    id: 'edge', label: 'Microsoft Edge TTS', available: false, reason: 'VOICE_ENGINE_NOT_INSTALLED',
    fixHint: 'Cần bridge engine Edge (WSS + token Sec-MS-GEC) — sẽ bật khi backend được cài đặt.',
    capabilities: {},
  },
  {
    id: 'piper', label: 'Piper TTS (offline)', available: false, reason: 'VOICE_ENGINE_NOT_INSTALLED',
    fixHint: 'Tải piper binary + voice model (HuggingFace), khai báo đường dẫn trong cài đặt rồi bật engine này.',
    capabilities: {},
  },
];

function listEngines() { return { ok: true, engines: ENGINES.map((e) => ({ ...e })) }; }

module.exports = { listEngines, ENGINES };
