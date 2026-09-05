'\nengines_tiktok.py — TikTok TTS engine (online, giọng ByteDance/TikTok).\n\nGiọng độc: nhân vật (Ghostface, C-3PO, Stitch, Rocket…) + hát + đa ngôn ngữ —\nmảng mà CapCut không có. voice_id = mã giọng TikTok (en_us_006, en_us_ghostface…).\n\nKiến trúc (giữ MOAT): client → worker relay `/tiktok/tts` (ép X-VTP-Key, license\nHWID-bound) → TikTok. Worker giữ session, lo chunk text (TikTok cap ~300 ký tự/call).\nĐặt env VTP_TIKTOK_DIRECT=<url proxy> để test thẳng (không qua worker) khi dev.\n'
from __future__ import annotations
import base64
import os
from typing import Callable
TIKTOK_VOICES: 'list[tuple[str, str]]' = [('en_us_002', 'Jessie (En)'), ('en_us_006', 'Nam Mỹ 1 (En)'), ('en_us_007', 'Nam Mỹ 2 (En)'), ('en_us_009', 'Nam Mỹ 3 (En)'), ('en_us_010', 'Nam trầm (En)'), ('en_us_001', 'Nữ Mỹ 1 (En)'), ('en_uk_001', 'Nam Anh 1 (En)'), ('en_uk_003', 'Nam Anh 3 (En)'), ('en_au_001', 'Nữ Úc (En)'), ('en_au_002', 'Nam Úc (En)'), ('en_female_emotional', 'Nữ cảm xúc (En)'), ('en_female_samc', 'Nữ Sam (En)'), ('en_male_narration', 'Nam kể chuyện (En)'), ('en_male_funny', 'Nam vui (En)'), ('en_male_cody', 'Cody (En)'), ('en_us_ghostface', 'Ghostface'), ('en_us_chewbacca', 'Chewbacca'), ('en_us_c3po', 'C-3PO'), ('en_us_stitch', 'Stitch'), ('en_us_stormtrooper', 'Stormtrooper'), ('en_us_rocket', 'Rocket'), ('en_female_madam_leota', 'Madam Leota'), ('en_male_ghosthost', 'Ghost Host'), ('en_male_pirate', 'Cướp biển'), ('en_female_f08_salut_damour', 'Hát nữ cổ điển'), ('en_male_m03_lobby', 'Hát nam trầm'), ('en_female_f08_warmy_breeze', 'Hát nữ ấm'), ('en_male_m03_sunshine_soon', 'Hát nam nắng'), ('en_female_ht_f08_glorious', 'Hát nữ vinh quang'), ('en_male_sing_funny_it_goes_up', 'Hát vui lên'), ('en_male_m2_xhxs_m03_silly', 'Hát ngớ ngẩn'), ('en_female_ht_f08_wonderful_world', 'Thế giới tuyệt vời'), ('fr_001', 'Pháp 1 (Fr)'), ('fr_002', 'Pháp 2 (Fr)'), ('de_001', 'Đức 1 (De)'), ('de_002', 'Đức 2 (De)'), ('es_002', 'Tây Ban Nha (Es)'), ('es_mx_002', 'TBN Mexico (Es)'), ('br_001', 'Bồ 1 (Pt)'), ('br_003', 'Bồ 3 (Pt)'), ('br_004', 'Bồ 4 (Pt)'), ('br_005', 'Bồ 5 (Pt)'), ('pt_female_lhays', 'Bồ Lhays (Pt)'), ('pt_male_bueno', 'Bồ Bueno (Pt)'), ('id_001', 'Indonesia (Id)'), ('jp_001', 'Nhật 1 (Jp)'), ('jp_003', 'Nhật 3 (Jp)'), ('jp_005', 'Nhật 5 (Jp)'), ('jp_006', 'Nhật 6 (Jp)'), ('kr_002', 'Hàn 2 (Ko)'), ('kr_003', 'Hàn 3 (Ko)'), ('kr_004', 'Hàn 4 (Ko)')]
_MALE_IDS = {'en_us_006', 'en_us_010', 'en_us_007', 'en_uk_001', 'en_au_002', 'en_uk_003', 'en_us_009'}
_FEMALE_IDS = {'en_au_001', 'en_us_001', 'en_us_002'}

def _gender_of(vid: str) -> str:
    return 'male' if vid in _MALE_IDS or '_male_' in vid or '_m03_' in vid or ('_m2_' in vid) else 'female' if vid in _FEMALE_IDS or '_female_' in vid or '_f08_' in vid else ''
TIKTOK_VOICE_META = {vid: (_gender_of(vid), '') for vid, _ in TIKTOK_VOICES}
TIKTOK_VOICE_META: 'dict[str, tuple[str, str]]'

class TikTokTTSEngine:
    __doc__ = "Tạo speech qua TikTok TTS. voice = mã giọng TikTok (vd 'en_us_006')."

    def __init__(self, voice: str='en_us_006', progress_cb: Callable[[str], None] | None=None, **_):
        self.voice = voice
        self._progress_cb = progress_cb

    def _relay_generate(self, text: str) -> bytes:
        import requests
        _direct = os.environ.get('VTP_TIKTOK_DIRECT', '').strip()
        if _direct:
            r = requests.post(_direct, json={'text': text, 'voice': self.voice}, headers={'User-Agent': 'Mozilla/5.0'}, timeout=60)
            d = r.json()
            b64 = d.get('data') or ''
            if b64:
                return base64.b64decode(b64)
            raise RuntimeError(f"TikTok TTS (direct) lỗi: {d.get('error') or d}")
        from config import API_RELAY_URL, API_RELAY_SECRET, APP_VERSION
        from utils_license import get_hwid, load_saved_license
        headers = {'X-Relay-Secret': API_RELAY_SECRET, 'X-VTP-Key': load_saved_license() or '', 'X-VTP-HWID': get_hwid() or '', 'X-VTP-Version': APP_VERSION, 'Content-Type': 'application/json'}
        r = requests.post(f"{API_RELAY_URL.rstrip('/')}/tiktok/tts", json={'text': text, 'voice': self.voice}, headers=headers, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f'TikTok TTS relay HTTP {r.status_code}: {r.text[:200]}')
        d = r.json()
        b64 = d.get('data') or ''
        if b64:
            return base64.b64decode(b64)
        raise RuntimeError(f"TikTok TTS relay lỗi: {d.get('error') or d}")

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        cb = progress_cb or self._progress_cb
        if text and text.strip():
            if cb:
                cb('📡 TikTok TTS: gửi yêu cầu...')
            audio = self._relay_generate(text.strip())
            if len(audio) < 500:
                raise RuntimeError('TikTok TTS: audio quá nhỏ (lỗi/giọng sai?)')
            with open(output_path, 'wb') as f:
                f.write(audio)
            if cb:
                cb(f'✅ TikTok TTS: {len(audio)} bytes')
            return output_path
        raise ValueError('TikTok TTS: text rỗng')