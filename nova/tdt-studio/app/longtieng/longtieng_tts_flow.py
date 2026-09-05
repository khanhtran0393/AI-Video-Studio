'\nlongtieng_tts_flow.py — TTS test & generation flow mixin for LongTiengPanel.\nTách từ longtieng_ui.py để giảm kích thước file.\n'
from __future__ import annotations
import importlib.util
import os
import re
import subprocess
import threading

def _make_voice_key(engine: str, voice: str, lang: str='') -> str:
    raw = f'{engine}_{voice}'[:40]
    base = re.sub('[^a-zA-Z0-9_-]', '_', raw).strip('_') or 'default'
    _lang = re.sub('[^a-zA-Z0-9_-]', '_', (lang or '').strip().lower()).strip('_')
    return f'{_lang}_{base}' if _lang else base
import tkinter as tk
from tkinter import messagebox
import config as _cfg
from .longtieng_engine import run_tts_async
try:
    from ui_widgets import RoundedButton, ToggleSwitch
    _HAS_WIDGETS = True
except ImportError:
    _HAS_WIDGETS = False
_SAMPLE_TEXTS = {'vi': 'Xin chào! Đây là bản thử giọng đọc tự động.', 'en': 'Hello! This is an automatic voice test.', 'zh': '你好！这是自动语音测试。', 'ja': 'こんにちは！これは自動音声テストです。', 'ko': '안녕하세요! 자동 음성 테스트입니다.', 'th': 'สวัสดีครับ นี่คือการทดสอบเสียงอัตโนมัติ', 'id': 'Halo! Ini adalah tes suara otomatis.', 'fr': 'Bonjour! Ceci est un test vocal automatique.', 'de': 'Hallo! Dies ist ein automatischer Stimmtest.', 'es': '¡Hola! Esta es una prueba de voz automática.', 'pt': 'Olá! Este é um teste de voz automático.', 'ru': 'Привет! Это автоматическая проверка голоса.', 'ms': 'Helo! Ini ialah ujian suara automatik.', 'hi': 'नमस्ते! यह एक स्वचालित आवाज़ परीक्षण है।', 'ar': 'مرحبا! هذا اختبار صوتي تلقائي.', 'it': 'Ciao! Questo è un test vocale automatico.', 'tr': 'Merhaba! Bu otomatik bir ses testidir.', **{'pl': 'Cześć! To jest automatyczny test głosu.', 'fil': 'Kumusta! Ito ay isang awtomatikong pagsubok ng boses.', 'uk': 'Привіт! Це автоматична перевірка голосу.', 'nl': 'Hallo! Dit is een automatische stemtest.', 'sv': 'Hej! Detta är ett automatiskt rösttest.', 'ro': 'Bună! Acesta este un test vocal automat.', 'el': 'Γεια σας! Αυτή είναι μια αυτόματη δοκιμή φωνής.', 'cs': 'Ahoj! Toto je automatický test hlasu.', 'da': 'Hej! Dette er en automatisk stemmetest.', 'fi': 'Hei! Tämä on automaattinen äänitesti.', 'hu': 'Helló! Ez egy automatikus hangteszt.', 'sk': 'Ahoj! Toto je automatický hlasový test.', 'bg': 'Здравейте! Това е автоматичен гласов тест.', 'hr': 'Bok! Ovo je automatski glasovni test.', 'sl': 'Pozdravljeni! To je samodejni glasovni test.', 'lt': 'Sveiki! Tai automatinis balso testas.', 'lv': 'Sveiki! Šis ir automātisks balss tests.'}, **{'et': 'Tere! See on automaatne hääletest.'}}
_SAMPLE_TEXT_DEFAULT = _SAMPLE_TEXTS['vi']
_CC_TAG_LANG = {'Vi': 'vi', 'En': 'en', 'Zh': 'zh', 'Id': 'id', 'Es': 'es', 'Pt': 'pt', 'Jp': 'ja', 'Th': 'th'}
_CC_LANG_BY_ID: 'dict[str, str]' = {}

def _detect_capcut_lang(voice: str) -> str:
    if not _CC_LANG_BY_ID:
        try:
            from .engines_capcut import CAPCUT_VOICES
            import re as _re
            for _vid, _lbl in CAPCUT_VOICES:
                _m = _re.search('\\((\\w+)\\)$', _lbl)
                _CC_LANG_BY_ID[_vid] = _CC_TAG_LANG.get(_m.group(1), '') if _m else ''
        except Exception:
            pass
    lg = _CC_LANG_BY_ID.get(voice)
    if lg:
        return lg
    v = (voice or '').lower()
    if v.startswith('vn:') or '_vivn_' in v or v.startswith('bv:vi_'):
        pass
    else:
        for code in ('en', 'jp', 'id', 'es', 'pt', 'zh', 'ko', 'th', 'fr', 'de'):
            if f'_{code}_' in v:
                return {'jp': 'ja'}.get(code, code)
    return 'vi'

def _get_sample_text(engine: str, voice: str, lang: str='') -> str:
    if engine in ('zalo', 'fpt', 'vbee', 'vienew'):
        return _SAMPLE_TEXTS['vi']
    if engine == 'ngochuyen':
        try:
            from .engines_ngochuyen import _VOICE_LANG as _NH_LANG
        except Exception:
            return _SAMPLE_TEXTS['vi']
    else:
        if engine == 'minimax':
            return _SAMPLE_TEXTS['vi']
        if engine == 'siliconflow':
            return _SAMPLE_TEXTS['en']
        if engine == 'elevenlabs':
            return _SAMPLE_TEXTS['en']
        if engine == 'capcut':
            return _SAMPLE_TEXTS.get(_detect_capcut_lang(voice), _SAMPLE_TEXTS['vi'])
        if engine == 'edge':
            for lang_code in _SAMPLE_TEXTS:
                if voice.startswith(f'{lang_code}-'):
                    return _SAMPLE_TEXTS[lang_code]
            return _SAMPLE_TEXT_DEFAULT
        if engine == 'kokoro':
            return 'Chào mừng bạn đến với phần mềm dịch và lồng tiếng, đây là giọng Kokoro tiếng Việt.'
        if engine == 'tiktok':
            _tt = {'fr_': 'fr', 'de_': 'de', 'es_': 'es', 'id_': 'id', 'jp_': 'ja', 'kr_': 'ko', 'br_': 'pt', 'pt_': 'pt'}
            for _pfx, _lg in _tt.items():
                if voice.startswith(_pfx):
                    return _SAMPLE_TEXTS.get(_lg, _SAMPLE_TEXTS['en'])
            return _SAMPLE_TEXTS['en']
        return _SAMPLE_TEXTS.get((lang or 'en').lower(), _SAMPLE_TEXTS['en']) if engine == 'supertonic' else _SAMPLE_TEXT_DEFAULT

class TTSFlowMixin:
    __doc__ = 'TTS test & generation flow methods — mixed into LongTiengPanel.'

    def _test_voice(self):
        if self._is_running or self._testing_voice:
            return None
        self._pause_exporter_preview()
        self._testing_voice = True
        settings = self.get_settings()
        engine = settings['engine']
        voice = settings['voice']
        speed = settings['speed']
        if engine == 'edge':
            if not importlib.util.find_spec('edge_tts'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài edge-tts trước:\n\npip install edge-tts')
                return None
        elif engine == 'vienew':
            if importlib.util.find_spec('vieneu_tts'):
                ref_txt = settings.get('ref_text', '')
                if settings.get('ref_audio'):
                    if not ref_txt or ref_txt == '⏳ Đang nhận dạng...':
                        messagebox.showwarning('Chờ nhận dạng Ref Text', 'AI đang nhận dạng nội dung file clone.\nVui lòng đợi hoặc tự gõ nội dung vào ô Ref text.')
                        return None
            else:
                messagebox.showerror('Thiếu thư viện', 'Cần cài vieneu trước:\n\npip install vieneu')
                return None
        elif engine == 'vbee':
            api_key = settings.get('api_key', '')
            if not api_key:
                messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập APP_ID|TOKEN của Vbee!\n\nLấy tại: studio.vbee.vn → Tích hợp API → Ứng dụng\nFormat: APP_ID|TOKEN (ngăn bằng dấu |)')
                return None
            if not importlib.util.find_spec('requests'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                return None
        elif engine == 'elevenlabs':
            api_key = settings.get('api_key', '')
            _has_relay = bool(settings.get('relay_url', '').strip())
            if not api_key and (not _has_relay):
                messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của ElevenLabs!\n\nLấy tại: elevenlabs.io → Profile → API Keys')
                return None
            if not importlib.util.find_spec('requests'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                return None
        elif engine == 'fpt':
            api_key = settings.get('api_key', '')
            _has_relay = bool(settings.get('relay_url', '').strip())
            if not api_key and (not _has_relay):
                messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của FPT.AI!\n\nLấy tại: console.fpt.ai → API Keys')
                return None
            if not importlib.util.find_spec('requests'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                return None
        elif engine == 'capcut':
            if not importlib.util.find_spec('requests'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                return None
            if not importlib.util.find_spec('websocket'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài websocket-client trước:\n\npip install websocket-client')
                return None
        elif engine == 'ngochuyen':
            if not importlib.util.find_spec('piper'):
                messagebox.showerror('Thiếu thư viện', 'Cần cài piper-tts trước:\n\npip install piper-tts\n\nSau đó khởi động lại ứng dụng.')
                return None
        elif engine in ('supertonic', 'kokoro', 'tiktok'):
            pass
        import tempfile, uuid as _uuid
        tmp = os.path.join(tempfile.gettempdir(), f'tts_test_{_uuid.uuid4().hex[:6]}.mp3')
        _active_btn = self._btn_test
        if _HAS_WIDGETS:
            old_text = _active_btn.text
            _active_btn.text = '...'
            _active_btn.draw()
        else:
            _active_btn.config(state='disabled', text='...')
        self._set_status('Đang tạo giọng thử...', self._C.get('fg', '#e0e0e0'))

        def _progress(msg: str):
            self.after(0, lambda m=msg: self._log(m))

        def _worker():
            try:
                _sample = _get_sample_text(engine, voice, settings.get('lang', ''))
                if engine == 'edge':
                    from .longtieng_engine import EdgeTTSEngine
                    _progress('🎤 Edge-TTS: đang tạo audio...')
                    EdgeTTSEngine(voice=voice, speed=speed, pitch=0).generate(_sample, tmp)
                elif engine == 'vbee':
                    from .longtieng_engine import VbeeTTSEngine
                    _progress('📡 Vbee TTS: đang gọi API...')
                    VbeeTTSEngine(api_key=settings['api_key'], voice=voice, speed=speed).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_vbee_apikey)
                elif engine == 'elevenlabs':
                    from .elevenlabs_engine import ElevenLabsTTSEngine
                    _progress('📡 ElevenLabs TTS: đang gọi API...')
                    ElevenLabsTTSEngine(api_key=settings.get('api_key', ''), voice=voice, speed=speed, relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', '')).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_elevenlabs_apikey)
                elif engine == 'fpt':
                    from .longtieng_engine import FptTTSEngine
                    _progress('📡 FPT.AI TTS: đang gọi API...')
                    FptTTSEngine(api_key=settings['api_key'], voice=voice, speed=speed, relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', '')).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_fpt_apikey)
                elif engine == 'minimax':
                    from .longtieng_engine import MiniMaxTTSEngine
                    _progress('📡 MiniMax TTS: đang gọi API...')
                    MiniMaxTTSEngine(api_key=settings['api_key'], voice=voice, speed=speed, relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', '')).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_minimax_apikey)
                elif engine == 'zalo':
                    from .longtieng_engine import ZaloTTSEngine
                    _progress('📡 Zalo AI TTS: đang gọi API...')
                    ZaloTTSEngine(api_key=settings['api_key'], voice=voice, speed=speed, relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', '')).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_zalo_apikey)
                elif engine == 'siliconflow':
                    from .longtieng_engine import SiliconFlowTTSEngine
                    _progress('📡 SiliconFlow TTS: đang gọi API...')
                    SiliconFlowTTSEngine(api_key=settings['api_key'], voice=voice, speed=speed, relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', '')).generate(_sample, tmp, progress_cb=_progress)
                    self.after(0, self._save_siliconflow_apikey)
                elif engine == 'capcut':
                    from .engines_capcut import CapCutTTSEngine
                    from .longtieng_audio_utils import _coerce_capcut_voice_id
                    voice = _coerce_capcut_voice_id(voice)
                    _progress('🎙️ CapCut TTS: đang gọi API...')
                    CapCutTTSEngine(voice=voice, speed=speed).generate(_sample, tmp, progress_cb=_progress)
                elif engine == 'ngochuyen':
                    from .longtieng_engine import NgocHuyenTTSEngine
                    _progress('🎙️ NgocHuyen TTS: đang tải/tạo audio...')
                    NgocHuyenTTSEngine(voice=voice, speed=speed, progress_cb=_progress).generate(_sample, tmp)
                elif engine == 'supertonic':
                    try:
                        from .engines_supertonic import SupertonicTTSEngine
                    except ImportError:
                        self.after(0, lambda: messagebox.showerror('Thiếu thư viện', 'Cần cài supertonic trước:\n\npip install supertonic'))
                        self._testing_voice = False
                        if _HAS_WIDGETS:
                            self.after(0, lambda: (setattr(_active_btn, 'text', old_text), _active_btn.draw()))
                        else:
                            self.after(0, lambda: _active_btn.config(state='normal', text='>>'))
                        return None
                    _progress('🎤 All Voice TTS: đang tạo audio...')
                    _lang = settings.get('lang', 'vi')
                    SupertonicTTSEngine(voice=voice, speed=speed, lang=_lang).generate(_sample, tmp)
                elif engine == 'kokoro':
                    from .engines_kokoro import KokoroTTSEngine
                    _progress('🎤 Kokoro TTS: đang tạo audio...')
                    KokoroTTSEngine(voice=voice, speed=speed, progress_cb=_progress).generate(_sample, tmp)
                elif engine == 'tiktok':
                    from .engines_tiktok import TikTokTTSEngine
                    _progress('🎤 TikTok TTS: đang tạo audio...')
                    TikTokTTSEngine(voice=voice, progress_cb=_progress).generate(_sample, tmp)
                else:
                    from .longtieng_engine import VienewTTSEngine
                    VienewTTSEngine(voice=voice, speed=speed, model_repo=settings.get('model_repo', ''), ref_audio=settings.get('ref_audio', ''), ref_text=settings.get('ref_text', '')).generate(_sample, tmp, progress_cb=_progress)
                _ps = settings.get('pitch_semitones', 0.0)
                if abs(_ps) >= 0.1:
                    from .longtieng_engine import _apply_pitch_shift
                    _progress(f'🔄 Độ Giọng: {_ps:+.1f} semitones...')
                    _apply_pitch_shift(tmp, _ps)
                _progress('🔊 Đang phát thử giọng...')
                self.after(0, lambda: self._play_audio_inapp(tmp))
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                self.after(0, lambda _e=str(e): self._log(f'❌ Lỗi test giọng: {_e}', self._C.get('red', '#ef4444')))
                print(f'[LongTieng _test_voice] {tb}', flush=True)
            except:
                self._testing_voice = False
                if _HAS_WIDGETS:
                    self.after(0, lambda: (setattr(_active_btn, 'text', old_text), _active_btn.draw()))
                else:
                    self.after(0, lambda: _active_btn.config(state='normal', text='>>'))
                raise
            self._testing_voice = False
            if _HAS_WIDGETS:
                self.after(0, lambda: (setattr(_active_btn, 'text', old_text), _active_btn.draw()))
            else:
                self.after(0, lambda: _active_btn.config(state='normal', text='>>'))
        threading.Thread(target=_worker, daemon=True).start()

    def _start_tts(self):
        if self._btn_gen_enabled:
            _old_thread = getattr(self, '_tts_thread', None)
            if _old_thread is not None and _old_thread.is_alive():
                messagebox.showinfo('Đang dừng', 'Tạo giọng đọc cũ chưa dừng hẳn, vui lòng đợi vài giây rồi thử lại.')
                return None
            _exp = getattr(self, '_exporter_ref', None)
            if _exp and getattr(_exp, '_is_exporting', False):
                messagebox.showwarning('Cảnh báo', 'Đang xuất video, vui lòng chờ xuất xong rồi mới tạo giọng đọc!')
                return None
            if _exp and getattr(_exp, '_sub_running', False):
                messagebox.showwarning('Cảnh báo', 'Đang tạo phụ đề, vui lòng chờ xong rồi mới tạo giọng đọc!')
                return None
            if _exp and getattr(_exp, '_merging', False):
                messagebox.showwarning('Cảnh báo', 'Đang ghép video, vui lòng chờ xong rồi mới tạo giọng đọc!')
                return None
            _batch_tts_videos = []
            _folder = getattr(_exp, 'input_folder', '')
            _total = _exp._batch_lb.size()
            _ans = messagebox.askyesno('Tạo giọng đọc hàng loạt', f'📋 Có {_total} video trong danh sách.\n\nBạn có muốn tạo giọng đọc TOÀN BỘ không?\n\n✔  Yes  →  Tạo giọng đọc tất cả {_total} video\n✖  No   →  Chỉ tạo giọng đọc video hiện tại')
            if _exp and hasattr(_exp, '_batch_lb') and (_exp._batch_lb.size() > 1) and _folder and os.path.isdir(_folder) and _ans:
                if hasattr(_exp, '_batch_apply_all'):
                    _exp._batch_apply_all(_silent=True)
                for i in range(_exp._batch_lb.size()):
                    _name = _exp._batch_lb.get(i)
                    _vp = os.path.join(_folder, _name)
                    if os.path.isfile(_vp):
                        _batch_tts_videos.append(_vp)
            if _batch_tts_videos or self._segments:
                settings = self.get_settings()
                engine = settings['engine']
                if engine == 'edge':
                    try:
                        import edge_tts
                    except ImportError:
                        messagebox.showerror('Thiếu thư viện', 'Cần cài edge-tts trước:\n\npip install edge-tts')
                        return None
                    _exporter = getattr(self, '_exporter_ref', None)
                    _vid_path = getattr(_exporter, 'input_file', '') if _exporter else ''
                    _force_new = True
                    try:
                        if _exporter is not None and getattr(_exporter, '_is_playing', False) and hasattr(_exporter, '_pause_playback'):
                            _exporter._pause_playback()
                    except Exception:
                        pass
                    if _batch_tts_videos:
                        self._voice_results.clear()
                        self._progress_var.set(0)
                        self._stop_flag = threading.Event()
                        self._set_buttons(running=True)
                        self._log(f'🎤 Bắt đầu tạo giọng đọc {len(_batch_tts_videos)} video...', self._C.get('fg', '#e0e0e0'))
                        _engine = engine
                        _settings = settings
                        self._tts_thread = threading.Thread(target=self._run_batch_tts, args=(_batch_tts_videos, _settings, _engine), daemon=True)
                        self._tts_thread.start()
                    else:
                        self._voice_results.clear()
                        self._progress_var.set(0)
                        self._stop_flag = threading.Event()
                        self._set_buttons(running=True)
                        _exp = getattr(self, '_exporter_ref', None)
                        _stop_va = getattr(_exp, '_stop_voice_audio', None)
                        if _stop_va:
                            try:
                                _stop_va()
                            except Exception:
                                pass
                        if hasattr(_exp, '_voice_track_path'):
                            _exp._voice_track_path = None
                        if _exp and hasattr(_exp, '_prebuilt_stretch_plan'):
                            _exp._prebuilt_stretch_plan = None
                        self._log('Bắt đầu tạo giọng đọc...', self._C.get('fg', '#e0e0e0'))
                        if _vid_path and os.path.isfile(_vid_path):
                            from pathlib import Path as _P
                            self._tts_out_dir = str(_P(_vid_path).parent / 'Giọng Đọc TTS')
                            from .media_naming import tts_stem_prefix
                            _stem = tts_stem_prefix(_P(_vid_path).stem)
                            self._tts_prefix = f'{_stem}_tts_'
                        else:
                            import tempfile
                            self._tts_out_dir = os.path.join(tempfile.gettempdir(), 'tdt_tts')
                            self._tts_prefix = 'tts_'
                        total = len(self._segments)
                        _last_log_pct = [-1]

                        def _on_progress(i: int, t: int, msg: str):
                            pct = i / t * 100 if t else 0
                            milestone = int(pct) // 25 * 25

                            def _upd(p=pct, m=msg, _i=i, _t=t, _ms=milestone):
                                self._progress_var.set(p)
                                self._set_status(m, self._C.get('fg', '#e0e0e0'))
                                if _ms > _last_log_pct[0] and _ms > 0:
                                    _last_log_pct[0] = _ms
                                    self._log(f'🎤 TTS {_ms}% ({_i}/{_t} đoạn)', self._C.get('fg', '#e0e0e0'))
                                if 'VieNeu-TTS đã sẵn sàng' in m:
                                    if self._get_engine_key() == 'vienew':
                                        self._populate_voices()
                                    return None
                            self.after(0, _upd)

                        def _on_done(results: list[dict]):
                            if self._stop_flag.is_set():
                                _removed = self._cleanup_tts_segments()
                                self._voice_results = []

                                def _ui_stopped():
                                    self._set_buttons(running=False)
                                    self._progress_var.set(0)
                                    _msg = f'⛔ Đã dừng. Đã dọn {_removed} file TTS tạm.'
                                    self._log(_msg, self._C.get('orange', '#f59e0b'))
                                self.after(0, _ui_stopped)
                            else:
                                self._voice_results = results
                                try:
                                    from pathlib import Path as _P2
                                    from .longtieng_engine import _merge_tts_to_single_file
                                    _engine_s = self._get_engine_key()
                                    _voice_s = self._get_voice_id()
                                    _vkey_s = _make_voice_key(_engine_s, _voice_s, self._lang_var.get())
                                    _exp_ref = getattr(self, '_exporter_ref', None)
                                    _vid_s = getattr(_exp_ref, 'input_file', '') if _exp_ref else ''
                                    if _vid_s and results:
                                        from .media_naming import tts_stem_prefix
                                        _stem_s = tts_stem_prefix(_P2(_vid_s).stem)
                                        _out_dir_s = _P2(_vid_s).parent / 'Giọng Đọc TTS'
                                        _out_dir_s.mkdir(parents=True, exist_ok=True)
                                        _vkey_fname_s = f'{_stem_s}_tts_{_vkey_s}_full.mp3'
                                        _merge_tts_to_single_file(results, _out_dir_s, _stem_s, None, len(results), out_filename=_vkey_fname_s)
                                        try:
                                            _is_stretch_s = 'Kéo dài' in self._tts_fit_var.get()
                                        except Exception:
                                            _is_stretch_s = False
                                        else:
                                            _full_s = _out_dir_s / _vkey_fname_s
                                            if not _is_stretch_s and _full_s.is_file() and (_full_s.stat().st_size > 100):
                                                for _r in results:
                                                    _rp = _r.get('audio_path', '')
                                                    if not os.path.isfile(_rp):
                                                        continue
                                                    if '_tts_' in os.path.basename(_rp):
                                                        if '_full.mp3' in os.path.basename(_rp):
                                                            pass
                                                    else:
                                                        try:
                                                            os.remove(_rp)
                                                        except OSError:
                                                            pass
                                except Exception:
                                    pass

                                def _ui():
                                    self._set_buttons(running=False)
                                    self._progress_var.set(100)
                                    done_msg = f'✅ Tạo xong {total}/{total} giọng đọc!'
                                    self._log(done_msg, self._C.get('green', '#22c55e'))
                                    try:
                                        try:
                                            self.save_lang_engine(self._lang_var.get(), self._engine_var.get(), self._voice_var.get())
                                        except Exception:
                                            pass
                                        _exp = getattr(self, '_exporter_ref', None)
                                        if _exp and hasattr(_exp, '_voice_track_path'):
                                            _exp._voice_track_path = None
                                        if _exp and hasattr(_exp, 'timeline_set_voice_segments'):
                                            _segs = [(s.get('start_sec', 0.0), s.get('end_sec', 0.0)) for s in getattr(_exp, '_sub_segments', None) or []]
                                            _exp.timeline_set_voice_segments(_segs)
                                    except Exception:
                                        pass
                                    if self._on_voice_ready:
                                        self._on_voice_ready()
                                self.after(0, _ui)
                            return None

                        def _on_error(err: str):
                            _removed = self._cleanup_tts_segments()

                            def _ui():
                                self._set_buttons(running=False)
                                self._log(f'❌ Lỗi: {err}', self._C.get('red', '#ef4444'))
                                if _removed:
                                    self._log(f'🗑️ Đã dọn {_removed} file TTS tạm.', self._C.get('orange', '#f59e0b'))
                                    return None
                            self.after(0, _ui)
                        _exporter = getattr(self, '_exporter_ref', None)
                        _vid_path = getattr(_exporter, 'input_file', '') if _exporter else ''
                        self._tts_thread = run_tts_async(self._segments, engine=engine, voice=settings['voice'], speed=settings['speed'], pitch=0, smart_voice=settings['smart_voice'], api_key=settings.get('api_key', ''), model_repo=settings.get('model_repo', ''), ref_audio=settings.get('ref_audio', ''), ref_text=settings.get('ref_text', ''), pitch_semitones=settings.get('pitch_semitones', 0.0), on_progress=_on_progress, on_done=_on_done, on_error=_on_error, stop_flag=self._stop_flag, video_path=_vid_path, max_workers=self._get_tts_workers(), force_new=_force_new, proxy=settings.get('proxy', ''), relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', ''), lang=settings.get('lang', 'vi'), tts_fit_mode=settings.get('tts_fit_mode', 'stretch_video'), tts_fit_max_speed=settings.get('tts_fit_max_speed', 1.2))
                    return None
                if engine == 'vienew':
                    if importlib.util.find_spec('vieneu_tts'):
                        ref_txt = settings.get('ref_text', '')
                        if settings.get('ref_audio'):
                            if not ref_txt or ref_txt == '⏳ Đang nhận dạng...':
                                messagebox.showwarning('Chờ nhận dạng Ref Text', 'AI đang nhận dạng nội dung file clone.\nVui lòng đợi hoặc tự gõ nội dung vào ô Ref text.')
                                return None
                        else:
                            from .longtieng_engine import VienewTTSEngine as _VTE
                            if _VTE._instance is None or _VTE._instance_repo != settings.get('model_repo', ''):
                                _model_label = self._model_var.get()
                                self._log(f'⏳ [LẦN ĐẦU TIÊN]: Đang tải Model {_model_label}...', self._C.get('orange', '#f59e0b'))
                                self._log('⚠️ Vui lòng ĐỢI QUÁ TRÌNH TẢI HOÀN TẤT, không tắt phần mềm!', self._C.get('red', '#ef4444'))
                    else:
                        messagebox.showerror('Thiếu thư viện', 'Cần cài vieneu trước:\n\npip install vieneu')
                        return None
                elif engine == 'vbee':
                    api_key = settings.get('api_key', '')
                    if not api_key:
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập APP_ID|TOKEN của Vbee!\n\nLấy tại: studio.vbee.vn → Tích hợp API → Ứng dụng\nFormat: APP_ID|TOKEN (ngăn bằng dấu |)')
                        return None
                    if importlib.util.find_spec('requests'):
                        self._save_vbee_apikey()
                    else:
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                elif engine == 'elevenlabs':
                    api_key = settings.get('api_key', '')
                    _has_relay = bool(settings.get('relay_url', '').strip())
                    if not api_key and (not _has_relay):
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của ElevenLabs!\n\nLấy tại: elevenlabs.io → Profile → API Keys')
                        return None
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if api_key:
                        self._save_elevenlabs_apikey()
                elif engine == 'fpt':
                    api_key = settings.get('api_key', '')
                    _has_relay = bool(settings.get('relay_url', '').strip())
                    if not api_key and (not _has_relay):
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của FPT.AI!\n\nLấy tại: console.fpt.ai → API Keys')
                        return None
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if api_key:
                        self._save_fpt_apikey()
                elif engine == 'minimax':
                    api_key = settings.get('api_key', '')
                    _has_relay = bool(settings.get('relay_url', '').strip())
                    if not api_key and (not _has_relay):
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của MiniMax!\n\nLấy tại: platform.minimaxi.com → API Keys')
                        return None
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if api_key:
                        self._save_minimax_apikey()
                elif engine == 'zalo':
                    api_key = settings.get('api_key', '')
                    _has_relay = bool(settings.get('relay_url', '').strip())
                    if not api_key and (not _has_relay):
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của Zalo AI!\n\nLấy tại: zalo.ai → Getting Started')
                        return None
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if api_key:
                        self._save_zalo_apikey()
                elif engine == 'siliconflow':
                    api_key = settings.get('api_key', '')
                    _has_relay = bool(settings.get('relay_url', '').strip())
                    if not api_key and (not _has_relay):
                        messagebox.showwarning('Thiếu API Key', 'Vui lòng nhập API Key của SiliconFlow!\n\nLấy tại: cloud.siliconflow.com → API Keys')
                        return None
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if api_key:
                        self._save_siliconflow_apikey()
                elif engine == 'capcut':
                    if not importlib.util.find_spec('requests'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài requests trước:\n\npip install requests')
                        return None
                    if not importlib.util.find_spec('websocket'):
                        messagebox.showerror('Thiếu thư viện', 'Cần cài websocket-client trước:\n\npip install websocket-client')
                        return None
                elif engine == 'ngochuyen' and (not importlib.util.find_spec('piper')):
                    messagebox.showerror('Thiếu thư viện', 'Cần cài piper-tts trước:\n\npip install piper-tts\n\nSau đó khởi động lại ứng dụng.')
                    return None
            else:
                messagebox.showwarning('Thiếu phụ đề', 'Hãy tạo hoặc nạp phụ đề (SRT) trước khi tạo giọng đọc!')
                return None
        else:
            return None

    def _stop_tts(self):
        if self._btn_stop_enabled:
            self._stop_flag.set()
            self._log('⏳ Đang dừng worker, vui lòng đợi...', self._C.get('orange', '#f59e0b'))
            self._btn_gen_enabled = False
            self._btn_stop_enabled = False
            if _HAS_WIDGETS:
                try:
                    self._sync_btn_colors()
                    self._btn_gen.command = lambda: None
                    self._btn_stop.command = lambda: None
                except Exception:
                    return None
            else:
                try:
                    self._btn_gen.config(state='disabled')
                    self._btn_stop.config(state='disabled')
                except Exception:
                    pass

    def _run_batch_tts(self, videos: list[str], settings: dict, engine: str):
        from .longtieng_engine import generate_all_voices
        _stop_flag = self._stop_flag
        total = len(videos)
        for idx, vid_path in enumerate(videos):
            if _stop_flag.is_set():
                break
            vid_name = os.path.basename(vid_path)
            try:
                from exporter.sub_transcription import _short_display as _sd
                _vid_disp = _sd(vid_name)
            except Exception:
                if len(vid_name) > 48:
                    _vid_disp = vid_name[:45] + '...'
            self.after(0, lambda i=idx, t=total, v=_vid_disp: self._log(f'🎤 [{i + 1}/{t}] {v}', self._C.get('fg', '#e0e0e0')))
            segments = []
            try:
                segments = self.load_srt_segments_for_video(vid_path)
            except Exception as _load_err:
                self.after(0, lambda v, e: self._log(f'⚠️ {v}: Lỗi load SRT: {e}', self._C.get('red', '#ef4444')))
                segments = []
            if segments:
                from pathlib import Path as _P
                self._tts_out_dir = str(_P(vid_path).parent / 'Giọng Đọc TTS')
                from .media_naming import tts_stem_prefix
                _stem = tts_stem_prefix(_P(vid_path).stem)
                self._tts_prefix = f'{_stem}_tts_'
                self._voice_results.clear()
                _total_segs = len(segments)
                _last_log_pct_b = [-1]

                def _on_progress(i: int, t: int, msg: str):
                    pct = i / t * 100 if t else 0
                    milestone = int(pct) // 25 * 25

                    def _upd(p=pct, m=msg, _i=i, _t=t, _ms=milestone):
                        self._progress_var.set(p)
                        self._set_status(f'🎤 [{idx + 1}/{total}] {vid_name} — {m}', self._C.get('fg', '#e0e0e0'))
                        if _ms > _last_log_pct_b[0]:
                            if _ms > 0:
                                _last_log_pct_b[0] = _ms
                                self._log(f'🎤 [{idx + 1}/{total}] {vid_name}: {_ms}% ({_i}/{_t} đoạn)', self._C.get('fg', '#e0e0e0'))
                            return None
                    self.after(0, _upd)
                try:
                    results = generate_all_voices(segments, engine=engine, voice=settings['voice'], speed=settings.get('speed', 1.0), pitch=0, smart_voice=settings.get('smart_voice', False), api_key=settings.get('api_key', ''), model_repo=settings.get('model_repo', ''), ref_audio=settings.get('ref_audio', ''), ref_text=settings.get('ref_text', ''), pitch_semitones=settings.get('pitch_semitones', 0.0), progress_cb=_on_progress, stop_flag=_stop_flag, video_path=vid_path, max_workers=self._get_tts_workers(), force_new=True, proxy=settings.get('proxy', ''), relay_url=settings.get('relay_url', ''), relay_secret=settings.get('relay_secret', ''), lang=settings.get('lang', 'vi'), tts_fit_mode=settings.get('tts_fit_mode', 'stretch_video'), tts_fit_max_speed=settings.get('tts_fit_max_speed', 1.2))
                    if _stop_flag.is_set():
                        self._cleanup_tts_segments()
                        break
                    self._voice_results = results
                    try:
                        self._voice_results_gen_pct = int(self._tts_fit_pct.get())
                    except Exception:
                        self._voice_results_gen_pct = None
                    _exp = getattr(self, '_exporter_ref', None)
                    if _exp and hasattr(_exp, 'batch_settings'):
                        _bs = _exp.batch_settings.get(vid_path)
                        if _bs is None:
                            _bs = {}
                            _exp.batch_settings[vid_path] = _bs
                        _bs['voice_results'] = list(results)
                        _bs['lt_enabled'] = True
                    _vkey = _make_voice_key(engine, settings.get('voice', ''), settings.get('lang', ''))
                    _vkey_fname = f'{_stem}_tts_{_vkey}_full.mp3'
                    _full_p = _P(self._tts_out_dir) / _vkey_fname
                    try:
                        from .longtieng_engine import _merge_tts_to_single_file
                        _merge_tts_to_single_file(results, _P(self._tts_out_dir), _stem, None, len(results), out_filename=_vkey_fname)
                    except Exception:
                        pass
                    _is_stretch_b = settings.get('tts_fit_mode', 'stretch_video') == 'stretch_video'
                    if not _is_stretch_b and _full_p.is_file() and (_full_p.stat().st_size > 100):
                        for _r in results:
                            _rp = _r.get('audio_path', '')
                            _bn894 = os.path.basename(_rp)
                            if not _rp:
                                continue
                            if not os.path.isfile(_rp):
                                continue
                            if '_tts_' in _bn894:
                                if _bn894.endswith('_full.mp3'):
                                    pass
                            else:
                                try:
                                    os.remove(_rp)
                                except OSError:
                                    pass
                    _full_p = _P(self._tts_out_dir) / _vkey_fname
                    _has_full = _full_p.is_file() and _full_p.stat().st_size > 256
                    _seg_count = sum((1 for r in results if r.get('audio_path') and os.path.isfile(r.get('audio_path')) and (os.path.getsize(r.get('audio_path')) > 100)))
                    if results:
                        if _has_full or _seg_count != 0:
                            _ok_msg = '(_tts_full.mp3)' if _has_full else f'({_seg_count} segment files)'
                            self.after(0, lambda v=vid_name, n=len(results), ok=_ok_msg: self._log(f'✅ [{idx + 1}/{total}] {v}: Xong {n} giọng {ok}', self._C.get('green', '#22c55e')))
                            continue
                    else:
                        self.after(0, lambda v=vid_name, ns=len(segments): self._log(f'⚠️ [{idx + 1}/{total}] {v}: Engine không tạo được giọng (0/{ns} segment có file). Check key/relay/network.', self._C.get('orange', '#f59e0b')))
                        continue
                except Exception as e:
                    self._cleanup_tts_segments()
                    self.after(0, lambda v, err: self._log(f'❌ [{idx + 1}/{total}] {v}: {err}', self._C.get('red', '#ef4444')))
                    continue
            else:
                self.after(0, lambda v=vid_name: self._log(f'⚠️ {v}: Không có SRT, bỏ qua', self._C.get('orange', '#f59e0b')))
                continue

        def _batch_done(t=total):
            self._set_buttons(running=False)
            self._progress_var.set(100)
            self._log(f'✅ Xong {t} video!', self._C.get('green', '#22c55e'))
            try:
                self.save_lang_engine(self._lang_var.get(), self._engine_var.get(), self._voice_var.get())
            except Exception:
                pass
            _exp2 = getattr(self, '_exporter_ref', None)
            _lmap = getattr(self, '_lang_engine_map', {})
            if _exp2 and hasattr(_exp2, 'batch_settings') and _lmap:
                for _bs in _exp2.batch_settings.values():
                    if isinstance(_bs, dict):
                        _bs['lang_engine_map'] = dict(_lmap)
            _exp = getattr(self, '_exporter_ref', None)
            _cur = getattr(_exp, 'input_file', '') if _exp else ''
            if _cur:
                if _exp:
                    if hasattr(_exp, 'batch_settings'):
                        _bs_cur = _exp.batch_settings.get(_cur, {})
                        _cur_results = _bs_cur.get('voice_results', [])
                        if _cur_results:
                            self._voice_results = list(_cur_results)
                            if self._on_voice_ready:
                                self._on_voice_ready()
        self.after(0, _batch_done)

    def _cleanup_tts_segments(self) -> int:
        _removed = 0
        _dir = getattr(self, '_tts_out_dir', '')
        _prefix = getattr(self, '_tts_prefix', '')
        if _dir and os.path.isdir(_dir):
            for f in os.listdir(_dir):
                fp = os.path.join(_dir, f)
                if not os.path.isfile(fp) or not f.endswith('.mp3') or ('_tts_' in f and '_full.mp3' in f):
                    continue
                if not _prefix or f.startswith(_prefix):
                    try:
                        os.remove(fp)
                        _removed += 1
                    except OSError:
                        pass
            return _removed
        return 0