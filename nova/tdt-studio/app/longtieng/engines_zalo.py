'\nengines_zalo.py — Zalo AI TTS engine (online, cần API key).\nAPI docs: https://ai.zalo.solutions/docs/api/text-to-audio-converter\nChỉ hỗ trợ tiếng Việt (4 giọng Bắc + 2 giọng Nam).\n'
from __future__ import annotations
import os
import urllib.parse
from typing import Callable
ZALO_VOICES: 'list[tuple[str, str]]' = [('1', 'Nữ miền Nam 1'), ('2', 'Nữ miền Bắc 1'), ('3', 'Nam miền Nam'), ('4', 'Nam miền Bắc'), ('5', 'Nữ miền Bắc 2'), ('6', 'Nữ miền Nam 2')]
ZALO_VOICE_META: 'dict[str, tuple[str, str]]' = {'zalo_1': ('female', ''), 'zalo_2': ('female', ''), 'zalo_3': ('male', ''), 'zalo_4': ('male', ''), 'zalo_5': ('female', ''), 'zalo_6': ('female', '')}

class ZaloTTSEngine:
    __doc__ = '\nTạo speech bằng Zalo AI Text-to-Speech (online, cần API key).\nEndpoint: POST https://api.zalo.ai/v1/tts/synthesize\nChỉ hỗ trợ tiếng Việt, giới hạn 2000 ký tự/request.\n'
    _BASE_URL = 'https://api.zalo.ai/v1/tts/synthesize'
    _MAX_CHARS = 2000

    def __init__(self, api_key: str, voice: str='1', speed: float=1.0, relay_url: str='', relay_secret: str=''):
        self._relay_url = relay_url.rstrip('/') if relay_url else ''
        self._relay_secret = relay_secret.strip() if relay_secret else ''
        if api_key and api_key.strip():
            self._key = api_key.strip()
            self.voice = voice
            self.speed = max(0.8, min(1.2, speed))
        elif self._relay_url:
            self._key = ''
        else:
            raise ValueError('Zalo API Key không được để trống!\nLấy tại: ai.zalo.solutions → Getting Started')

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
            if len(text) > self._MAX_CHARS:
                text = text[:self._MAX_CHARS]
            if progress_cb:
                progress_cb('📡 Gửi yêu cầu Zalo TTS...')
            headers = {'apikey': self._key, 'Content-Type': 'application/x-www-form-urlencoded'}
            post_data = urllib.parse.urlencode({'input': text, 'speaker_id': self.voice, 'speed': str(self.speed), 'encode_type': '1', 'quality': '0'}).encode('utf-8')
            try:
                resp = requests.post(self._BASE_URL, headers=headers, data=post_data, timeout=30)
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f'❌ Lỗi kết nối Zalo: {e}') from e
            if resp.status_code != 200:
                raise RuntimeError(f'❌ Zalo HTTP {resp.status_code}: {resp.text[:200]}')
            data = resp.json()
            error_code = data.get('error_code', -1)
            if error_code != 0:
                error_msg = data.get('error_message', 'Lỗi không xác định')
                raise RuntimeError('❌ Zalo API Key không hợp lệ!\nLấy tại: ai.zalo.solutions → Getting Started' if error_code == 401 else f'❌ Zalo lỗi: {error_msg} (code {error_code})')
            audio_url = data.get('data', {}).get('url', '')
            if audio_url:
                if progress_cb:
                    progress_cb('⬇️ Đang tải audio...')
                try:
                    dl = requests.get(audio_url, timeout=30)
                    dl.raise_for_status()
                except requests.exceptions.RequestException as e:
                    raise RuntimeError(f'❌ Lỗi tải audio Zalo: {e}') from e
                if len(dl.content) < 100:
                    raise RuntimeError('Zalo API: file audio tải về quá nhỏ!')
                with open(output_path, 'wb') as f:
                    f.write(dl.content)
                if os.path.getsize(output_path) == 0:
                    raise RuntimeError('Zalo API: file audio tải về rỗng!')
                return output_path
            raise RuntimeError('Zalo API: không nhận được link audio!')

    def _generate_via_relay(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        if len(text) > self._MAX_CHARS:
            text = text[:self._MAX_CHARS]
        url = f'{self._relay_url}/zalo/tts'
        payload = {'text': text, 'speaker_id': self.voice, 'speed': str(self.speed), 'encode_type': 1, 'quality': 0}
        headers = {'Content-Type': 'application/json'}
        try:
            from ._relay_auth import relay_auth_headers
            headers.update(relay_auth_headers(self._relay_secret))
        except Exception:
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
        if progress_cb:
            progress_cb('📡 Gửi qua Relay → Zalo TTS...')
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 401:
            raise RuntimeError('❌ Relay: sai secret!')
        if resp.status_code == 503:
            raise RuntimeError('❌ Relay: hết Zalo key!')
        if resp.status_code != 200:
            raise RuntimeError(f'❌ Relay Zalo lỗi HTTP {resp.status_code}')
        data = resp.json()
        error_code = data.get('error_code', -1)
        if error_code != 0:
            raise RuntimeError(f"❌ Zalo lỗi: {data.get('error_message', 'Lỗi')} (code {error_code})")
        audio_url = data.get('data', {}).get('url', '')
        if audio_url:
            if progress_cb:
                progress_cb('⬇️ Đang tải audio...')
            dl = requests.get(audio_url, timeout=30)
            dl.raise_for_status()
            if len(dl.content) < 100:
                raise RuntimeError('Zalo API: file audio quá nhỏ!')
            with open(output_path, 'wb') as f:
                f.write(dl.content)
                return output_path
            return output_path
        raise RuntimeError('Zalo API: không nhận được link audio!')