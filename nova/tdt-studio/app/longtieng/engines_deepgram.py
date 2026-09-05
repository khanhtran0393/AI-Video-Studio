'Deepgram Aura TTS — POST /v1/speak ghi MP3. Không relay. Không STT.'
from __future__ import annotations
from pathlib import Path
from typing import Callable
SPEAK_URL = 'https://api.deepgram.com/v1/speak'

class DeepgramTTSEngine:
    __doc__ = 'TTS Aura tiếng Anh. speed nhận cho khớp chữ ký generate_all_voices — không gửi API.'

    def __init__(self, api_key: str, voice: str='aura-asteria-en', speed: float=1.0, **_):
        key = str(api_key or '').strip()
        if key:
            self._key = key
            self.voice = str(voice or 'aura-asteria-en').strip() or 'aura-asteria-en'
            self.speed = speed
        else:
            raise ValueError('Deepgram API Key không được để trống!\nLấy tại: https://console.deepgram.com')

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        import requests
        if progress_cb:
            progress_cb('📡 Gửi yêu cầu Deepgram TTS...')
        try:
            resp = requests.post(SPEAK_URL, headers={'Authorization': f'Token {self._key}', 'Content-Type': 'application/json'}, params={'model': self.voice, 'encoding': 'mp3'}, json={'text': text}, timeout=60)
        except requests.RequestException as exc:
            raise RuntimeError(f'❌ Lỗi kết nối Deepgram: {exc}') from exc
        status = int(resp.status_code)
        headers = resp.headers or {}
        ct = str(headers.get('content-type') or headers.get('Content-Type') or '').lower()
        body = resp.content or b''
        if status == 200 and ('audio' in ct or 'octet' in ct) and (len(body) > 100):
            dest = Path(output_path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            return str(dest)
        raise RuntimeError('❌ Deepgram API Key không hợp lệ (401).\nLấy tại: https://console.deepgram.com' if status == 401 else '❌ Deepgram lỗi 429: quá nhiều yêu cầu, thử lại sau.' if status == 429 else f'❌ Deepgram lỗi {status}.')