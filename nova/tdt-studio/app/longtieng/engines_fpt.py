'\nengines_fpt.py — FPT.AI TTS engine (online, trả phí, cần API key).\nTách từ longtieng_engine.py để giảm kích thước file.\n'
from __future__ import annotations
import os
from typing import Callable

class FptTTSEngine:
    __doc__ = '\nTạo speech bằng FPT.AI Text-to-Speech (online, trả phí, cần API key).\nWebsite: https://console.fpt.ai\nAPI docs: https://docs.fpt.ai/docs/en/speech/api/text-to-speech.html\nHỗ trợ nhiều key (ngăn bằng |) — xoay vòng random, retry khi 401/403/429.\n'
    _BASE_URL = 'https://api.fpt.ai/hmi/tts/v5'
    _POLL_INTERVAL = 2.0
    _MAX_WAIT = 90

    @staticmethod
    def _speed_to_fpt(speed: float) -> str:
        return '-3' if speed <= 0.4 else '-2' if speed <= 0.6 else '-1' if speed <= 0.8 else '0' if speed <= 1.2 else '1' if speed <= 1.5 else '2' if speed <= 1.8 else '3'

    @staticmethod
    def _parse_keys(raw: str) -> list[str]:
        import re
        parts = re.split('[|\\n,]+', raw)
        return [k.strip() for k in parts if k.strip()]

    def __init__(self, api_key: str, voice: str='banmai', speed: float=1.0, relay_url: str='', relay_secret: str=''):
        self._relay_url = relay_url.rstrip('/') if relay_url else ''
        self._relay_secret = relay_secret.strip() if relay_secret else ''
        if api_key and api_key.strip():
            self._keys = self._parse_keys(api_key)
            self.voice = voice
            self.speed = speed
        elif self._relay_url:
            self._keys = []
        else:
            raise ValueError('FPT API Key không được để trống!\nLấy tại: console.fpt.ai → API Keys')

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        import time
        import requests
        if self._relay_url:
            try:
                pass
            except Exception as _relay_err:
                if self._keys:
                    if progress_cb:
                        _relay_msg = str(_relay_err)
                        if '503' in _relay_msg or 'hết' in _relay_msg.lower():
                            progress_cb('⚠️ Relay hết FPT key, thử direct...')
                        else:
                            progress_cb('⚠️ Relay lỗi, thử direct...')
                else:
                    raise
        else:
            import random as _random
            keys = list(self._keys)
            last_err = None
            _backoff_s = 1.0
            for _ki, key in enumerate(keys):
                headers = {'api-key': key, 'voice': self.voice, 'speed': self._speed_to_fpt(self.speed), 'format': 'mp3', 'Cache-Control': 'no-cache'}
                if progress_cb:
                    progress_cb('📡 Gửi yêu cầu FPT.AI TTS...')
                try:
                    resp = requests.post(self._BASE_URL, data=text.encode('utf-8'), headers=headers, timeout=30)
                    if resp.status_code in (401, 403):
                        last_err = RuntimeError(f'❌ FPT key ...{key[-4:]}: HTTP {resp.status_code}')
                        if progress_cb:
                            progress_cb(f'⚠️ Key ...{key[-4:]} lỗi {resp.status_code}, thử key khác...')
                        continue
                    if resp.status_code == 429:
                        last_err = RuntimeError(f'❌ FPT key ...{key[-4:]}: HTTP {resp.status_code}')
                        if progress_cb:
                            progress_cb(f'⚠️ Key ...{key[-4:]} rate-limited, chờ {_backoff_s:.1f}s...')
                        time.sleep(_backoff_s + _random.uniform(0, 0.5))
                        _backoff_s = min(_backoff_s * 2, 8.0)
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    if data.get('error') and data['error'] != 0:
                        err_msg = data.get('message', 'Lỗi không xác định')
                        raise RuntimeError(f'❌ FPT API: {err_msg}')
                    async_url = data.get('async', '')
                    if async_url:
                        if progress_cb:
                            progress_cb('⏳ FPT đang xử lý audio...')
                        elapsed = 0.0
                        audio_content = None
                        while elapsed < self._MAX_WAIT:
                            time.sleep(self._POLL_INTERVAL)
                            elapsed += self._POLL_INTERVAL
                            if progress_cb:
                                progress_cb(f'⏳ FPT đang xử lý... ({int(elapsed)}s)')
                            try:
                                dl = requests.get(async_url, timeout=30)
                                if dl.status_code == 200 and len(dl.content) > 500:
                                    audio_content = dl.content
                                    break
                                if elapsed < self._MAX_WAIT:
                                    continue
                            except requests.exceptions.RequestException:
                                continue
                        if audio_content is None:
                            raise RuntimeError(f'FPT API: timeout sau {int(elapsed)}s — file chưa sẵn sàng.')
                        with open(output_path, 'wb') as f:
                            f.write(audio_content)
                        if os.path.getsize(output_path) == 0:
                            raise RuntimeError('FPT API: file audio tải về rỗng!')
                        return output_path
                    raise RuntimeError('FPT API: không nhận được link audio!')
                except requests.exceptions.RequestException as net_err:
                    last_err = RuntimeError(f'❌ Lỗi kết nối FPT: {net_err}')
                    continue
        if last_err and '429' in str(last_err):
            raise RuntimeError('❌ Tất cả FPT API Key đều hết quota free (100K ký tự/tháng)!\n→ Vào console.fpt.ai tạo API Key mới\n→ Hoặc đợi đầu tháng sau FPT reset quota\n→ Dán key mới vào ô API Key (có thể nhập nhiều key ngăn bằng |)')
        raise last_err or RuntimeError('❌ Tất cả FPT API Key đều lỗi!\nKiểm tra tại: console.fpt.ai → API Keys')

    def _generate_via_relay(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import time
        import requests
        url = f'{self._relay_url}/fpt/tts'
        payload = {'text': text, 'voice': self.voice, 'speed': self._speed_to_fpt(self.speed)}
        headers = {'Content-Type': 'application/json'}
        try:
            from ._relay_auth import relay_auth_headers
            headers.update(relay_auth_headers(self._relay_secret))
        except Exception:
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
        if progress_cb:
            progress_cb('📡 Gửi qua Relay → FPT.AI...')
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 401:
            raise RuntimeError('❌ Relay: sai secret!')
        if resp.status_code == 503:
            raise RuntimeError('❌ Relay: hết FPT key!')
        if resp.status_code != 200:
            raise RuntimeError(f'❌ Relay FPT lỗi HTTP {resp.status_code}')
        data = resp.json()
        if data.get('error') and data['error'] != 0:
            raise RuntimeError(f"❌ FPT API: {data.get('message', 'Lỗi')}")
        async_url = data.get('async', '')
        if async_url:
            if progress_cb:
                progress_cb('⏳ FPT đang xử lý audio...')
            elapsed = 0.0
            audio_content = None
            while elapsed < self._MAX_WAIT:
                time.sleep(self._POLL_INTERVAL)
                elapsed += self._POLL_INTERVAL
                if progress_cb:
                    progress_cb(f'⏳ FPT đang xử lý... ({int(elapsed)}s)')
                try:
                    dl = requests.get(async_url, timeout=30)
                    if dl.status_code == 200 and len(dl.content) > 500:
                        audio_content = dl.content
                        break
                    if elapsed < self._MAX_WAIT:
                        continue
                except requests.exceptions.RequestException:
                    continue
            if audio_content is None:
                raise RuntimeError(f'FPT API: timeout sau {int(elapsed)}s')
            with open(output_path, 'wb') as f:
                f.write(audio_content)
            if os.path.getsize(output_path) == 0:
                raise RuntimeError('FPT API: file audio rỗng!')
            return output_path
        raise RuntimeError('FPT API: không nhận được link audio!')