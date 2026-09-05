'\nlongtieng_voices.py — Voice constants, metadata, engine labels.\nTách từ longtieng_engine.py để giảm kích thước file.\n'
from __future__ import annotations
EDGE_VOICES: 'dict[str, list[tuple[str, str]]]' = {'vi': [('vi-VN-NamMinhNeural', 'Nam Minh'), ('vi-VN-HoaiMyNeural', 'Hoài My')], 'en': [('en-US-AriaNeural', 'Aria'), ('en-US-GuyNeural', 'Guy'), ('en-US-JennyNeural', 'Jenny'), ('en-GB-SoniaNeural', 'Sonia UK'), ('en-GB-RyanNeural', 'Ryan UK')], 'zh': [('zh-CN-XiaoxiaoNeural', 'Tiểu Tiểu'), ('zh-CN-YunxiNeural', 'Vân Hy'), ('zh-TW-HsiaoChenNeural', 'Hiểu Trần TW')], 'ja': [('ja-JP-NanamiNeural', 'Nanami'), ('ja-JP-KeitaNeural', 'Keita')], 'ko': [('ko-KR-SunHiNeural', 'SunHi'), ('ko-KR-InJoonNeural', 'InJoon')], 'th': [('th-TH-PremwadeeNeural', 'Premwadee'), ('th-TH-NiwatNeural', 'Niwat')], 'id': [('id-ID-GadisNeural', 'Gadis'), ('id-ID-ArdiNeural', 'Ardi')], 'fr': [('fr-FR-DeniseNeural', 'Denise'), ('fr-FR-HenriNeural', 'Henri')], 'de': [('de-DE-KatjaNeural', 'Katja'), ('de-DE-ConradNeural', 'Conrad'), ('de-AT-IngridNeural', 'Ingrid AT')], 'es': [('es-ES-ElviraNeural', 'Elvira'), ('es-ES-AlvaroNeural', 'Alvaro'), ('es-MX-DaliaNeural', 'Dalia MX'), ('es-MX-JorgeNeural', 'Jorge MX')], 'pt': [('pt-BR-FranciscaNeural', 'Francisca BR'), ('pt-BR-AntonioNeural', 'Antonio BR'), ('pt-PT-RaquelNeural', 'Raquel PT'), ('pt-PT-DuarteNeural', 'Duarte PT')], 'ru': [('ru-RU-SvetlanaNeural', 'Светлана'), ('ru-RU-DmitryNeural', 'Дмитрий')], 'ms': [('ms-MY-YasminNeural', 'Yasmin'), ('ms-MY-OsmanNeural', 'Osman')], 'hi': [('hi-IN-SwaraNeural', 'Swara'), ('hi-IN-MadhurNeural', 'Madhur')], 'ar': [('ar-SA-ZariyahNeural', 'Zariyah'), ('ar-SA-HamedNeural', 'Hamed'), ('ar-EG-SalmaNeural', 'Salma EG')], 'it': [('it-IT-ElsaNeural', 'Elsa'), ('it-IT-DiegoNeural', 'Diego')], 'tr': [('tr-TR-EmelNeural', 'Emel'), ('tr-TR-AhmetNeural', 'Ahmet')], **{'pl': [('pl-PL-ZofiaNeural', 'Zofia'), ('pl-PL-MarekNeural', 'Marek')], 'fil': [('fil-PH-BlessicaNeural', 'Blessica'), ('fil-PH-AngeloNeural', 'Angelo')], 'tl': [('fil-PH-BlessicaNeural', 'Blessica'), ('fil-PH-AngeloNeural', 'Angelo')], 'uk': [('uk-UA-PolinaNeural', 'Polina'), ('uk-UA-OstapNeural', 'Ostap')], 'nl': [('nl-NL-ColetteNeural', 'Colette'), ('nl-NL-MaartenNeural', 'Maarten')], 'sv': [('sv-SE-SofieNeural', 'Sofie'), ('sv-SE-MattiasNeural', 'Mattias')]}}
LANG_LABELS: 'dict[str, str]' = {'vi': 'Tiếng Việt', 'en': 'Tiếng Anh', 'zh': 'Tiếng Trung', 'ja': 'Tiếng Nhật', 'ko': 'Tiếng Hàn', 'th': 'Tiếng Thái', 'id': 'Tiếng Indonesia', 'fr': 'Tiếng Pháp', 'de': 'Tiếng Đức', 'es': 'Tiếng Tây Ban Nha', 'pt': 'Tiếng Bồ Đào Nha', 'ru': 'Tiếng Nga', 'ms': 'Tiếng Mã Lai', 'hi': 'Tiếng Hindi', 'ar': 'Tiếng Ả Rập', 'it': 'Tiếng Ý', 'tr': 'Tiếng Thổ Nhĩ Kỳ', **{'pl': 'Tiếng Ba Lan', 'tl': 'Tiếng Philippines', 'uk': 'Tiếng Ukraina', 'nl': 'Tiếng Hà Lan', 'sv': 'Tiếng Thụy Điển'}}
SUPERTONIC_LANG_LABELS: 'dict[str, str]' = {'en': 'Tiếng Anh', 'vi': 'Tiếng Việt', 'ja': 'Tiếng Nhật', 'ko': 'Tiếng Hàn', 'fr': 'Tiếng Pháp', 'de': 'Tiếng Đức', 'es': 'Tiếng Tây Ban Nha', 'pt': 'Tiếng Bồ Đào Nha', 'it': 'Tiếng Ý', 'ru': 'Tiếng Nga', 'ar': 'Tiếng Ả Rập', 'hi': 'Tiếng Hindi', 'id': 'Tiếng Indonesia', 'tr': 'Tiếng Thổ Nhĩ Kỳ', 'pl': 'Tiếng Ba Lan', 'uk': 'Tiếng Ukraina', 'nl': 'Tiếng Hà Lan', **{'sv': 'Tiếng Thụy Điển', 'ro': 'Tiếng Romania', 'el': 'Tiếng Hy Lạp', 'cs': 'Tiếng Séc', 'da': 'Tiếng Đan Mạch', 'fi': 'Tiếng Phần Lan', 'hu': 'Tiếng Hungary', 'sk': 'Tiếng Slovakia', 'bg': 'Tiếng Bulgaria', 'hr': 'Tiếng Croatia', 'sl': 'Tiếng Slovenia', 'lt': 'Tiếng Litva', 'lv': 'Tiếng Latvia', 'et': 'Tiếng Estonia'}}
VIENEW_VOICES: 'list[tuple[str, str]]' = [('Vinh', 'Vĩnh'), ('Binh', 'Bình'), ('Tuyen', 'Tuyên'), ('Doan', 'Đoan'), ('Ly', 'Ly'), ('Ngoc', 'Ngọc')]
VIENEW_MODELS: 'list[tuple[str, str]]' = [('pnnbao-ump/VieNeu-TTS-0.3B-q4-gguf', '0.3B GGUF-Q4 (Khuyên dùng)'), ('pnnbao-ump/VieNeu-TTS-0.3B-q8-gguf', '0.3B GGUF-Q8 (Cân bằng)'), ('pnnbao-ump/VieNeu-TTS-q4-gguf', '0.5B GGUF-Q4 (Chất lượng cao)'), ('pnnbao-ump/VieNeu-TTS-q8-gguf', '0.5B GGUF-Q8 (Chất lượng cao+)')]
DEFAULT_VIENEW_MODEL = VIENEW_MODELS[0][0]

def scan_vienew_voices() -> list[tuple[str, str]]:
    return list(VIENEW_VOICES)
_PYTORCH_TO_GGUF_FALLBACK: 'dict[str, str]' = {'pnnbao-ump/VieNeu-TTS-0.3B': 'pnnbao-ump/VieNeu-TTS-0.3B-q8-gguf', 'pnnbao-ump/VieNeu-TTS': 'pnnbao-ump/VieNeu-TTS-q8-gguf'}
_PYTORCH_VRAM_REQ: 'dict[str, float]' = {'pnnbao-ump/VieNeu-TTS-0.3B': 1.5, 'pnnbao-ump/VieNeu-TTS': 3.0}

def _detect_best_device(repo: str) -> tuple[str, str]:
    if 'gguf' in repo.lower():
        return ('cpu', repo)
    try:
        import torch
        if torch.cuda.is_available():
            vram_gb = torch.cuda.get_device_properties(0).total_memory / 1073741824
            required = _PYTORCH_VRAM_REQ.get(repo, 2.0)
            if vram_gb >= required:
                print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)} ({vram_gb:.1f} GB VRAM) — dùng CUDA cho {repo.split('/')[-1]}", flush=True)
                return ('cuda', repo)
            fallback = _PYTORCH_TO_GGUF_FALLBACK.get(repo, repo)
            print(f"⚠️ GPU VRAM không đủ ({vram_gb:.1f} GB < {required} GB) — auto fallback → {fallback.split('/')[-1]}", flush=True)
            return ('cpu', fallback)
        fallback = _PYTORCH_TO_GGUF_FALLBACK.get(repo, repo)
        print(f"⚠️ Không có GPU CUDA — auto fallback → {fallback.split('/')[-1]}", flush=True)
    except ImportError:
        fallback = _PYTORCH_TO_GGUF_FALLBACK.get(repo, repo)
        print(f"⚠️ PyTorch không khả dụng — auto fallback → {fallback.split('/')[-1]}", flush=True)
        return ('cpu', fallback)
VBEE_VOICES: 'list[tuple[str, str]]' = [('hn_female_ngochuyen_full_48k-fhg', 'HN - Ngọc Huyền'), ('hn_female_ngochuyen_full_24k-st', 'HN - Ngọc Huyền 2.0'), ('hn_female_hachi_book_22k-vc', 'HN - Hà Chi'), ('hn_female_hermer_stor_48k-fhg', 'HN - Ngọc Lan'), ('hn_female_lenka_stor_48k-phg', 'HN - Nguyệt Dương'), ('hn_female_maiphuong_vdts_48k-fhg', 'HN - Mai Phương'), ('hn_female_nganha_child_22k-vc', 'HN - Ngân Hà'), ('hn_male_manhdung_news_48k-fhg', 'HN - Mạnh Dũng'), ('hn_male_manhdung_full_24k-st', 'HN - Mạnh Dũng 2.0'), ('hn_male_minhquan_yt-stable', 'HN - Minh Quân'), ('hn_male_phuthang_news65dt_44k-fhg', 'HN - Anh Khôi'), ('hn_male_phuthang_stor80dt_48k-fhg', 'HN - Anh Khôi v2'), ('hn_male_thanhlong_talk_48k-fhg', 'HN - Thanh Long'), ('hn_male_vietbach_child_22k-vc', 'HN - Việt Bách'), ('sg_female_thaotrinh_full_48k-fhg', 'SG - Thảo Trinh'), ('sg_female_thaotrinh_full_44k-phg', 'SG - Thảo Trinh v2'), ('sg_female_lantrinh_vdts_48k-fhg', 'SG - Lan Trinh'), ('sg_female_tuongvy_call_44k-fhg', 'SG - Tường Vy'), ('sg_male_minhhoang_full_48k-fhg', 'SG - Minh Hoàng'), ('sg_male_chidat_ebook_48k-phg', 'SG - Chí Đạt'), ('sg_male_trungkien_vdts_48k-fhg', 'SG - Trung Kiên'), ('hue_female_huonggiang_full_48k-fhg', 'Huế - Hương Giang'), ('hue_male_duyphuong_full_48k-fhg', 'Huế - Duy Phương')]
FPT_VOICES: 'list[tuple[str, str]]' = [('banmai', 'Ban Mai (Nữ Bắc)'), ('thuminh', 'Thu Minh (Nữ Bắc)'), ('leminh', 'Lê Minh (Nam Bắc)'), ('myan', 'Mỹ An (Nữ Trung)'), ('ngoclam', 'Ngọc Lam (Nữ Trung)'), ('giahuy', 'Gia Huy (Nam Trung)'), ('linhsan', 'Linh San (Nữ Nam)'), ('lannhi', 'Lan Nhi (Nữ Nam)'), ('minhquang', 'Minh Quang (Nam Nam)')]
VOICE_META: 'dict[str, tuple[str, str]]' = {'vi-VN-NamMinhNeural': ('male', ''), 'vi-VN-HoaiMyNeural': ('female', ''), 'en-US-AriaNeural': ('female', ''), 'en-US-GuyNeural': ('male', ''), 'en-US-JennyNeural': ('female', ''), 'en-GB-SoniaNeural': ('female', ''), 'en-GB-RyanNeural': ('male', ''), 'zh-CN-XiaoxiaoNeural': ('female', ''), 'zh-CN-YunxiNeural': ('male', ''), 'zh-TW-HsiaoChenNeural': ('female', ''), 'ja-JP-NanamiNeural': ('female', ''), 'ja-JP-KeitaNeural': ('male', ''), 'ko-KR-SunHiNeural': ('female', ''), 'ko-KR-InJoonNeural': ('male', ''), 'th-TH-PremwadeeNeural': ('female', ''), 'th-TH-NiwatNeural': ('male', ''), 'id-ID-GadisNeural': ('female', ''), **{'id-ID-ArdiNeural': ('male', ''), 'fr-FR-DeniseNeural': ('female', ''), 'fr-FR-HenriNeural': ('male', ''), 'de-DE-KatjaNeural': ('female', ''), 'de-DE-ConradNeural': ('male', ''), 'de-AT-IngridNeural': ('female', ''), 'es-ES-ElviraNeural': ('female', ''), 'es-ES-AlvaroNeural': ('male', ''), 'es-MX-DaliaNeural': ('female', ''), 'es-MX-JorgeNeural': ('male', ''), 'pt-BR-FranciscaNeural': ('female', ''), 'pt-BR-AntonioNeural': ('male', ''), 'pt-PT-RaquelNeural': ('female', ''), 'pt-PT-DuarteNeural': ('male', ''), 'ru-RU-SvetlanaNeural': ('female', ''), 'ru-RU-DmitryNeural': ('male', ''), 'ms-MY-YasminNeural': ('female', '')}, **{'ms-MY-OsmanNeural': ('male', ''), 'hi-IN-SwaraNeural': ('female', ''), 'hi-IN-MadhurNeural': ('male', ''), 'ar-SA-ZariyahNeural': ('female', ''), 'ar-SA-HamedNeural': ('male', ''), 'ar-EG-SalmaNeural': ('female', ''), 'it-IT-ElsaNeural': ('female', ''), 'it-IT-DiegoNeural': ('male', ''), 'tr-TR-EmelNeural': ('female', ''), 'tr-TR-AhmetNeural': ('male', ''), 'pl-PL-ZofiaNeural': ('female', ''), 'pl-PL-MarekNeural': ('male', ''), 'fil-PH-BlessicaNeural': ('female', ''), 'fil-PH-AngeloNeural': ('male', ''), 'uk-UA-PolinaNeural': ('female', ''), 'uk-UA-OstapNeural': ('male', ''), 'nl-NL-ColetteNeural': ('female', '')}, **{'nl-NL-MaartenNeural': ('male', ''), 'sv-SE-SofieNeural': ('female', ''), 'sv-SE-MattiasNeural': ('male', ''), 'Vinh': ('male', ''), 'Binh': ('male', ''), 'Tuyen': ('male', ''), 'Doan': ('female', ''), 'Ly': ('female', ''), 'Ngoc': ('female', ''), 'hn_female_ngochuyen_full_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_ngochuyen_fast_news_48k-thg.mp3'), 'hn_female_ngochuyen_full_24k-st': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_ngochuyen_full_24k-st.mp3'), 'hn_female_hachi_book_22k-vc': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_hachi_book_22k-vc.mp3'), 'hn_female_hermer_stor_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_hermer_stor_48k-fhg.mp3'), 'hn_female_lenka_stor_48k-phg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_lenka_stor_48k-phg.wav'), 'hn_female_maiphuong_vdts_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_maiphuong_vdts_48k_cs-thg.mp3'), 'hn_female_nganha_child_22k-vc': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_female_nganha_child_22k-vc.mp3'), 'hn_male_manhdung_news_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_manhdung_news_48k_cs-thg.mp3')}, **{'hn_male_manhdung_full_24k-st': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_manhdung_full_24k-st.mp3'), 'hn_male_minhquan_yt-stable': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_minhquan_yt-stable.mp3'), 'hn_male_phuthang_news65dt_44k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_phuthang_news65dt_44k-fhg.mp3'), 'hn_male_phuthang_stor80dt_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_phuthang_stor80dt_48k-fhg.mp3'), 'hn_male_thanhlong_talk_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_thanhlong_talk_48k-fhg.mp3'), 'hn_male_vietbach_child_22k-vc': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hn_male_vietbach_child_22k-vc.mp3'), 'sg_female_thaotrinh_full_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_female_thaotrinh_fast_news_48k_cs-thg.mp3'), 'sg_female_thaotrinh_full_44k-phg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_female_thaotrinh_full_44k-phg.mp3'), 'sg_female_lantrinh_vdts_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_female_lantrinh_fast_vdts_48k_cs-thg.mp3'), 'sg_female_tuongvy_call_44k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_female_tuongvy_call_44k-fhg.mp3'), 'sg_male_minhhoang_full_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_male_minhhoang_fast_news_48k_cs-thg.mp3'), 'sg_male_chidat_ebook_48k-phg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_male_chidat_ebook_48k-phg.wav'), 'sg_male_trungkien_vdts_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_male_trungkien_vdts_48k-fhg.mp3'), 'hue_female_huonggiang_full_48k-fhg': ('female', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/hue_female_huonggiang_news_48k_cs-thg.mp3'), 'hue_male_duyphuong_full_48k-fhg': ('male', 'https://vbee.s3.ap-southeast-1.amazonaws.com/audios/demo/vbee/sg_female_duyphuong_fast_news_48k_cs-thg.mp3'), 'banmai': ('female', ''), 'thuminh': ('female', '')}, **{'leminh': ('male', ''), 'myan': ('female', ''), 'ngoclam': ('female', ''), 'giahuy': ('male', ''), 'linhsan': ('female', ''), 'lannhi': ('female', ''), 'minhquang': ('male', '')}}
try:
    from longtieng.engines_ngochuyen import NGOCHUYEN_VOICE_META
    VOICE_META.update(NGOCHUYEN_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.elevenlabs_engine import ELEVENLABS_VOICE_META
    VOICE_META.update(ELEVENLABS_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_minimax import MINIMAX_VOICE_META
    VOICE_META.update(MINIMAX_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_zalo import ZALO_VOICE_META
    VOICE_META.update(ZALO_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_siliconflow import SILICONFLOW_VOICE_META
    VOICE_META.update(SILICONFLOW_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_capcut import CAPCUT_VOICE_META
    VOICE_META.update(CAPCUT_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_supertonic import SUPERTONIC_VOICE_META
    VOICE_META.update(SUPERTONIC_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_kokoro import KOKORO_VOICE_META
    VOICE_META.update(KOKORO_VOICE_META)
except ImportError:
    pass
try:
    from longtieng.engines_tiktok import TIKTOK_VOICE_META
    VOICE_META.update(TIKTOK_VOICE_META)
except ImportError:
    pass
NGOCHUYEN_VOICES: 'list[tuple[str, str]]' = [('Ngọc Huyền', 'Ngọc Huyền'), ('TV Hay', 'TV Hay'), ('Ban Mai', 'Ban Mai'), ('Mỹ Tâm', 'Mỹ Tâm'), ('Mỹ Tâm Real', 'Mỹ Tâm Real'), ('Mai Phương', 'Mai Phương'), ('Ngọc Huyền (mới)', 'Ngọc Huyền (mới)'), ('Ngọc Ngạn', 'Ngọc Ngạn'), ('Phương Trang', 'Phương Trang'), ('Thanh Phương Viettel', 'Thanh Phương Viettel'), ('Duy Oryx', 'Duy Oryx'), ('Duy Onyx (mới)', 'Duy Onyx (mới)'), ('Mạnh Dũng', 'Mạnh Dũng'), ('Minh Khang', 'Minh Khang'), ('Minh Quang', 'Minh Quang'), ('Tài An', 'Tài An'), ('Trấn Thành', 'Trấn Thành'), ('Việt Thảo', 'Việt Thảo'), ('Chiếu Thành', 'Chiếu Thành'), ('Lạc Phi', 'Lạc Phi'), ('Thiện Tâm', 'Thiện Tâm')]
ENGINE_LABELS = [('ngochuyen', 'NgocHuyen TTS (Free • Offline)'), ('kokoro', 'Kokoro TTS (Free • Offline • 14 giọng)'), ('supertonic', 'All Voice TTS (đa ngôn ngữ)'), ('capcut', 'CapCut TTS (Free • Online)'), ('tiktok', 'TikTok TTS (Free • Nhân vật + Hát)'), ('edge', 'Edge TTS (Free)'), ('fpt', 'FPT.AI TTS (Free + Trả phí)'), ('vbee', 'Vbee TTS (trả phí)'), ('elevenlabs', 'ElevenLabs TTS (Free + Trả phí)'), ('minimax', 'MiniMax TTS (Trả phí)'), ('zalo', 'Zalo AI TTS (Trả phí)'), ('siliconflow', 'SiliconFlow TTS (Trả phí)')]
_FPT_FREE_KEYS: 'list[str]' = ['i02mjWJcdbyYEmyOqUDnrRti5tNdz1BT', 'F3sb8gidYXkMFavJ5F57aUZK3riPsXgU', '9dAebh6GkJJqnSRydBVAwK8oIDOVrX9K', 'Um2qtS0m64lb8iMZyOqnRNMZ5apUJAKI', '4M34DpUkH3tWLqHINRP3C8AeZ1SASlvK', 'Pi3hbZn99aFn4cMtwbZJACUSln1DgWXS', 'efC4Ei6aiGpmz1U8FbsGMSoNm4mSTvWC', '3ypEzqSSnyh1NRjWjbyrj7Tl7Ilk2DoE', 'bcpy9dyDIb4F3lOcjAi6C63cF7ALslzL', 'h6l6jaZyjmLGdminPEqGJ6vGmeldtmmo', 'uMXcDRLrINeqza24yF8Br6gqdKrEr0kv', 'MTSbs6G21Qn4ojwtbx8YKlQP6EnWatDQ']