'\nengines_vbee.py — Vbee AIStudio TTS engine (online, trả phí, cần API key).\nTách từ longtieng_engine.py để giảm kích thước file.\n'
from __future__ import annotations
import os
from typing import Callable

class VbeeTTSEngine:
    __doc__ = '\nTạo speech bằng Vbee AIStudio (online, trả phí, cần API key).\nWebsite: https://studio.vbee.vn\nKhách hàng tự đăng ký tài khoản và nhập API key của họ.\n'
    _BASE_URL = 'https://vbee.vn/api/v1/tts'
    _POLL_INTERVAL = 2.0
    _MAX_WAIT = 90

    def __init__(self, api_key: str, voice: str='hn_female_ngochuyen_full_48k-fhg', speed: float=1.0):
        if api_key and api_key.strip():
            raw = api_key.strip()
            import re
            _UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
            _JWT = 'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+'
            m = re.search(f'({_UUID})\\s*\\S?\\s*({_JWT})', raw)
            if m:
                self.app_id = m.group(1)
                self.token = m.group(2)
            elif '|' in raw:
                parts = raw.split('|', 1)
                self.app_id = parts[0].strip()
                self.token = parts[1].strip()
            else:
                self.app_id = raw
                self.token = raw
            self.voice = voice
            self.speed = speed
        else:
            raise ValueError('Vbee API Key không được để trống!\nNhập theo format: APP_ID|TOKEN\nLấy tại: studio.vbee.vn → Tích hợp API → Ứng dụng')

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        import time
        import requests
        headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {self.token}'}
        payload = {'app_id': self.app_id, 'input_text': text, 'voice_code': self.voice, 'audio_type': 'mp3', 'speed_rate': str(self.speed), 'bitrate': 128, 'response_type': 'indirect', 'callback_url': 'https://vbee.vn/callback'}
        if progress_cb:
            progress_cb('📡 Gửi yêu cầu Vbee API...')
        try:
            resp = requests.post(self._BASE_URL, json=payload, headers=headers, timeout=30)
        except requests.exceptions.RequestException as net_err:
            raise RuntimeError(f'❌ Lỗi kết nối Vbee: {net_err}') from net_err
        if resp.status_code == 401:
            raise RuntimeError('❌ API Key không hợp lệ hoặc hết hạn!\nNhập đúng format: APP_ID|TOKEN\nLấy tại: studio.vbee.vn → Tích hợp API → Ứng dụng')
        if resp.status_code == 403:
            raise RuntimeError('❌ Tài khoản Vbee hết quota hoặc bị khoá!')
        resp.raise_for_status()
        data = resp.json()
        if data.get('status') == 0:
            err_msg = data.get('error_message') or data.get('message') or 'Lỗi không xác định'
            raise RuntimeError(f'❌ Vbee API: {err_msg}')
        result = data.get('result') or data
        audio_link = result.get('audio_link') or result.get('audio_url')
        request_id = result.get('request_id') or result.get('id')
        if not audio_link and request_id:
            elapsed = 0.0
            while elapsed < self._MAX_WAIT:
                time.sleep(self._POLL_INTERVAL)
                elapsed += self._POLL_INTERVAL
                if progress_cb:
                    progress_cb(f'⏳ Vbee đang xử lý... ({int(elapsed)}s)')
                try:
                    poll = requests.get(f'{self._BASE_URL}/{request_id}', headers=headers, timeout=15)
                    poll.raise_for_status()
                    pdata = poll.json()
                    presult = pdata.get('result') or pdata
                    audio_link = presult.get('audio_link') or presult.get('audio_url')
                    status = str(presult.get('status', '')).upper()
                    if status in ('FAILED', 'ERROR', 'CANCELLED'):
                        raise RuntimeError(f"Vbee API lỗi xử lý: {presult.get('message', status)}")
                    if not audio_link and elapsed < self._MAX_WAIT:
                        continue
                except requests.exceptions.RequestException:
                    continue
            if not audio_link:
                raise RuntimeError(f'Vbee API: timeout sau {int(elapsed)}s — Máy chủ Vbee quá tải.')
        else:
            if audio_link:
                if progress_cb:
                    progress_cb('⬇️ Đang tải audio từ Vbee...')
                audio_resp = requests.get(audio_link, timeout=60)
                audio_resp.raise_for_status()
                with open(output_path, 'wb') as f:
                    f.write(audio_resp.content)
                if os.path.getsize(output_path) == 0:
                    raise RuntimeError('Vbee API: file audio tải về rỗng!')
                return output_path
            raise RuntimeError('Vbee API: không nhận được link audio!')