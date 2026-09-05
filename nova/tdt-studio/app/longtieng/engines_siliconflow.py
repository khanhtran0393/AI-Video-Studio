'\nengines_siliconflow.py — SiliconFlow TTS engine (online, cần API key).\nAPI docs: https://docs.siliconflow.cn/en/api-reference/audio/create-speech\nHỗ trợ 2 model: Fish-Speech 1.5 và CosyVoice2-0.5B, mỗi model 8 giọng preset.\nVoice ID format: "model_prefix:voice_name" e.g. "fish:alex", "cosy:alex"\n'
from __future__ import annotations
import os
from typing import Callable
_MODEL_MAP = {'fish': 'fishaudio/fish-speech-1.5', 'cosy': 'FunAudioLLM/CosyVoice2-0.5B'}
SILICONFLOW_MODELS: 'list[tuple[str, str]]' = [('fishaudio/fish-speech-1.5', 'Fish-Speech 1.5'), ('FunAudioLLM/CosyVoice2-0.5B', 'CosyVoice2-0.5B')]
SILICONFLOW_VOICES: 'list[tuple[str, str]]' = [('fish:alex', 'Alex (Nam) — Fish'), ('fish:benjamin', 'Benjamin (Nam) — Fish'), ('fish:charles', 'Charles (Nam) — Fish'), ('fish:david', 'David (Nam) — Fish'), ('fish:anna', 'Anna (Nữ) — Fish'), ('fish:bella', 'Bella (Nữ) — Fish'), ('fish:claire', 'Claire (Nữ) — Fish'), ('fish:diana', 'Diana (Nữ) — Fish'), ('cosy:alex', 'Alex (Nam) — Cosy'), ('cosy:benjamin', 'Benjamin (Nam) — Cosy'), ('cosy:charles', 'Charles (Nam) — Cosy'), ('cosy:david', 'David (Nam) — Cosy'), ('cosy:anna', 'Anna (Nữ) — Cosy'), ('cosy:bella', 'Bella (Nữ) — Cosy'), ('cosy:claire', 'Claire (Nữ) — Cosy'), ('cosy:diana', 'Diana (Nữ) — Cosy')]
SILICONFLOW_VOICE_META: 'dict[str, tuple[str, str]]' = {'fish:alex': ('male', ''), 'fish:benjamin': ('male', ''), 'fish:charles': ('male', ''), 'fish:david': ('male', ''), 'fish:anna': ('female', ''), 'fish:bella': ('female', ''), 'fish:claire': ('female', ''), 'fish:diana': ('female', ''), 'cosy:alex': ('male', ''), 'cosy:benjamin': ('male', ''), 'cosy:charles': ('male', ''), 'cosy:david': ('male', ''), 'cosy:anna': ('female', ''), 'cosy:bella': ('female', ''), 'cosy:claire': ('female', ''), 'cosy:diana': ('female', '')}

class SiliconFlowTTSEngine:
    __doc__ = '\nTạo speech bằng SiliconFlow TTS API (OpenAI-compatible).\nEndpoint: POST https://api.siliconflow.com/v1/audio/speech\nVoice ID format: "model_prefix:voice_name" → auto-resolve model.\n'
    _BASE_URL = 'https://api.siliconflow.com/v1/audio/speech'

    def __init__(self, api_key: str, voice: str='fish:alex', speed: float=1.0, relay_url: str='', relay_secret: str='', **_kw):
        self._relay_url = relay_url.rstrip('/') if relay_url else ''
        self._relay_secret = relay_secret.strip() if relay_secret else ''
        if api_key and api_key.strip():
            self._key = api_key.strip()
            if ':' in voice:
                prefix, vname = (voice.split(':', 1)[0], voice.split(':', 1)[1])
                self.model = _MODEL_MAP.get(prefix, 'fishaudio/fish-speech-1.5')
                self.voice_name = vname
            else:
                self.model = 'fishaudio/fish-speech-1.5'
                self.voice_name = voice
            self.speed = max(0.25, min(4.0, speed))
        elif self._relay_url:
            self._key = ''
        else:
            raise ValueError('SiliconFlow API Key không được để trống!\nLấy tại: cloud.siliconflow.com → API Keys')

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        import requests
        if self._relay_url:
            try:
                pass
            except Exception as _relay_err:
                if self._key:
                    if progress_cb:
                        progress_cb('⚠️ Relay lỗi, thử direct...')
                else:
                    raise
        else:
            if progress_cb:
                progress_cb('📡 Gửi yêu cầu SiliconFlow TTS...')
            full_voice = f'{self.model}:{self.voice_name}'
            headers = {'Authorization': f'Bearer {self._key}', 'Content-Type': 'application/json'}
            payload = {'model': self.model, 'input': text, 'voice': full_voice, 'response_format': 'mp3', 'stream': False, 'speed': self.speed}
            try:
                resp = requests.post(self._BASE_URL, headers=headers, json=payload, timeout=60)
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f'❌ Lỗi kết nối SiliconFlow: {e}') from e
            ct = resp.headers.get('content-type', '')
            if 'audio' in ct or 'octet' in ct:
                if len(resp.content) < 100:
                    raise RuntimeError('SiliconFlow API: file audio quá nhỏ!')
                with open(output_path, 'wb') as f:
                    f.write(resp.content)
                if os.path.getsize(output_path) == 0:
                    raise RuntimeError('SiliconFlow API: file audio rỗng!')
                return output_path
            if resp.status_code == 401:
                raise RuntimeError('❌ SiliconFlow API Key không hợp lệ!\nLấy tại: cloud.siliconflow.com → API Keys')
            try:
                data = resp.json()
                msg = data.get('message', data.get('error', resp.text[:200]))
            except Exception:
                msg = resp.text[:200]
            raise RuntimeError(f'❌ SiliconFlow lỗi {resp.status_code}: {msg}')

    def _generate_via_relay(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        full_voice = f'{self.model}:{self.voice_name}'
        url = f'{self._relay_url}/sf/tts'
        payload = {'text': text, 'model': self.model, 'voice': full_voice, 'speed': self.speed}
        headers = {'Content-Type': 'application/json'}
        try:
            from ._relay_auth import relay_auth_headers
            headers.update(relay_auth_headers(self._relay_secret))
        except Exception:
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
        if progress_cb:
            progress_cb('📡 Gửi qua Relay → SiliconFlow...')
        resp = requests.post(url, json=payload, headers=headers, timeout=60)
        if resp.status_code == 401:
            raise RuntimeError('❌ Relay: sai secret!')
        if resp.status_code == 503:
            raise RuntimeError('❌ Relay: hết SiliconFlow key!')
        ct = resp.headers.get('content-type', '')
        if 'audio' in ct or 'octet' in ct:
            if len(resp.content) < 100:
                raise RuntimeError('SiliconFlow: audio quá nhỏ!')
            with open(output_path, 'wb') as f:
                f.write(resp.content)
                return output_path
            return output_path
        try:
            data = resp.json()
            msg = data.get('error', data.get('detail', resp.text[:200]))
        except Exception:
            msg = resp.text[:200]
        raise RuntimeError(f'❌ Relay SiliconFlow lỗi {resp.status_code}: {msg}')