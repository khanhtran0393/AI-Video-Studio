'\nengines_minimax.py — MiniMax Speech TTS engine (online, cần API key).\nAPI docs: https://platform.minimaxi.com/docs/api-reference/speech-t2a-http\nModel: speech-2.8-hd (MiniMax Speech 2.8)\n'
from __future__ import annotations
import os
from typing import Callable
MINIMAX_VOICES: 'list[tuple[str, str]]' = [('male-qn-qingse', 'Thanh Sắc (Nam - Trẻ)'), ('male-qn-jingying', 'Tinh Anh (Nam - Trẻ)'), ('male-qn-badao', 'Bá Đạo (Nam - Trẻ)'), ('male-qn-daxuesheng', 'Đại Học Sinh (Nam)'), ('presenter_male', 'MC Nam'), ('audiobook_male_1', 'Sách Nói Nam 1'), ('audiobook_male_2', 'Sách Nói Nam 2'), ('female-shaonv', 'Thiếu Nữ (Nữ - Trẻ)'), ('female-yujie', 'Ngự Tỷ (Nữ - Trưởng thành)'), ('female-chengshu', 'Thành Thục (Nữ)'), ('female-tianmei', 'Điềm Mỹ (Nữ - Ngọt ngào)'), ('presenter_female', 'MC Nữ'), ('audiobook_female_1', 'Sách Nói Nữ 1'), ('audiobook_female_2', 'Sách Nói Nữ 2'), ('clever_boy', 'Cậu Bé Thông Minh'), ('cute_boy', 'Cậu Bé Dễ Thương'), ('lovely_girl', 'Cô Bé Đáng Yêu'), ('cartoon_pig', 'Heo Hoạt Hình'), ('bingjiao_didi', 'Bingjiào Didi (Nam)'), ('Zhifeng_Monologue', 'Zhifeng Monologue (Nam)'), ('Santa_Claus', 'Santa Claus'), ('Grinch', 'Grinch'), ('Rudolph', 'Rudolph'), ('Arnold', 'Arnold')]
MINIMAX_VOICE_META: 'dict[str, tuple[str, str]]' = {'male-qn-qingse': ('male', ''), 'male-qn-jingying': ('male', ''), 'male-qn-badao': ('male', ''), 'male-qn-daxuesheng': ('male', ''), 'presenter_male': ('male', ''), 'audiobook_male_1': ('male', ''), 'audiobook_male_2': ('male', ''), 'female-shaonv': ('female', ''), 'female-yujie': ('female', ''), 'female-chengshu': ('female', ''), 'female-tianmei': ('female', ''), 'presenter_female': ('female', ''), 'audiobook_female_1': ('female', ''), 'audiobook_female_2': ('female', ''), 'clever_boy': ('male', ''), 'cute_boy': ('male', ''), 'lovely_girl': ('female', ''), **{'cartoon_pig': ('', ''), 'bingjiao_didi': ('male', ''), 'Zhifeng_Monologue': ('male', ''), 'Santa_Claus': ('male', ''), 'Grinch': ('male', ''), 'Rudolph': ('male', ''), 'Arnold': ('male', '')}}

class MiniMaxTTSEngine:
    __doc__ = '\nTạo speech bằng MiniMax Speech API (online, cần API key).\nModel: speech-2.8-hd\nEndpoint: POST https://api.minimaxi.com/v1/t2a_v2\n'
    _BASE_URL = 'https://api.minimaxi.com/v1/t2a_v2'

    def __init__(self, api_key: str, voice: str='male-qn-qingse', speed: float=1.0, relay_url: str='', relay_secret: str='', **_kw):
        self._relay_url = relay_url.rstrip('/') if relay_url else ''
        self._relay_secret = relay_secret.strip() if relay_secret else ''
        if api_key and api_key.strip():
            self._key = api_key.strip()
            self.voice = voice
            self.speed = max(0.5, min(2.0, speed))
        elif self._relay_url:
            self._key = ''
        else:
            raise ValueError('MiniMax API Key không được để trống!\nLấy tại: platform.minimaxi.com → Tài khoản → API Keys')

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
                progress_cb('📡 Gửi yêu cầu MiniMax TTS...')
            headers = {'Authorization': f'Bearer {self._key}', 'Content-Type': 'application/json'}
            payload = {'model': 'speech-2.8-hd', 'text': text, 'stream': False, 'voice_setting': {'voice_id': self.voice, 'speed': self.speed, 'vol': 1, 'pitch': 0}, 'audio_setting': {'sample_rate': 32000, 'bitrate': 128000, 'format': 'mp3', 'channel': 1}, 'output_format': 'hex', 'language_boost': 'Vietnamese'}
            try:
                resp = requests.post(self._BASE_URL, headers=headers, json=payload, timeout=60)
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f'❌ Lỗi kết nối MiniMax: {e}') from e
            if resp.status_code != 200:
                raise RuntimeError(f'❌ MiniMax HTTP {resp.status_code}: {resp.text[:200]}')
            data = resp.json()
            base_resp = data.get('base_resp', {})
            status_code = base_resp.get('status_code', -1)
            if status_code != 0:
                status_msg = base_resp.get('status_msg', 'Lỗi không xác định')
                raise RuntimeError('❌ MiniMax API Key không hợp lệ!\nLấy tại: platform.minimaxi.com → Tài khoản → API Keys' if status_code == 2049 else f'❌ MiniMax lỗi: {status_msg} (code {status_code})')
            audio_data = data.get('data', {})
            if audio_data:
                audio_hex = audio_data.get('audio', '')
                if audio_hex:
                    if progress_cb:
                        progress_cb('⬇️ Đang lưu audio...')
                    try:
                        audio_bytes = bytes.fromhex(audio_hex)
                    except ValueError:
                        raise RuntimeError('MiniMax API: dữ liệu audio hex không hợp lệ!')
                    with open(output_path, 'wb') as f:
                        f.write(audio_bytes)
                    if os.path.getsize(output_path) == 0:
                        raise RuntimeError('MiniMax API: file audio tải về rỗng!')
                    return output_path
                raise RuntimeError('MiniMax API: audio rỗng!')
            raise RuntimeError('MiniMax API: không nhận được dữ liệu audio!')

    def _generate_via_relay(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        url = f'{self._relay_url}/mm/tts'
        payload = {'text': text, 'voice': self.voice, 'speed': self.speed}
        headers = {'Content-Type': 'application/json'}
        try:
            from ._relay_auth import relay_auth_headers
            headers.update(relay_auth_headers(self._relay_secret))
        except Exception:
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
        if progress_cb:
            progress_cb('📡 Gửi qua Relay → MiniMax...')
        resp = requests.post(url, json=payload, headers=headers, timeout=60)
        if resp.status_code == 401:
            raise RuntimeError('❌ Relay: sai secret!')
        if resp.status_code == 503:
            raise RuntimeError('❌ Relay: hết MiniMax key!')
        ct = resp.headers.get('content-type', '')
        if 'audio' in ct or 'octet' in ct:
            if len(resp.content) < 100:
                raise RuntimeError('MiniMax relay: audio quá nhỏ!')
            with open(output_path, 'wb') as f:
                f.write(resp.content)
                return output_path
            return output_path
        try:
            data = resp.json()
            msg = data.get('error', data.get('detail', resp.text[:200]))
        except Exception:
            msg = resp.text[:200]
        raise RuntimeError(f'❌ Relay MiniMax lỗi {resp.status_code}: {msg}')