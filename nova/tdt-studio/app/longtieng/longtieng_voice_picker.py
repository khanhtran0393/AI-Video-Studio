'\nlongtieng_voice_picker.py — Voice picker popup mixin for LongTiengPanel.\nTách từ longtieng_ui.py để giảm kích thước file.\n'
from __future__ import annotations
import os
import subprocess
import sys
import threading
import tkinter as tk
from typing import Callable
import config as _cfg

def _get_ffplay_path() -> str:
    ffmpeg_path = _cfg.FFMPEG_PATH
    ffmpeg_dir = os.path.dirname(ffmpeg_path) if ffmpeg_path != 'ffmpeg' else ''
    name = 'ffplay.exe' if sys.platform == 'win32' else 'ffplay'
    candidate = os.path.join(ffmpeg_dir, name)
    return candidate if ffmpeg_dir and os.path.exists(candidate) else 'ffplay'
from .longtieng_engine import EDGE_VOICES, LANG_LABELS, VBEE_VOICES, FPT_VOICES, VOICE_META, MINIMAX_VOICES, ZALO_VOICES, SILICONFLOW_VOICES, CAPCUT_VOICES, SUPERTONIC_VOICES, KOKORO_VOICES, TIKTOK_VOICES, scan_ngochuyen_voices
from .longtieng_engine import NgocHuyenTTSEngine as _NHEng
from .elevenlabs_engine import ELEVENLABS_VOICES
from .longtieng_voices import NGOCHUYEN_VOICES, SUPERTONIC_LANG_LABELS

class VoicePickerMixin:
    __doc__ = 'Voice picker popup methods — mixed into LongTiengPanel.'

    def _open_voice_picker(self, _event=None):
        self._pause_exporter_preview()
        engine = self._get_engine_key()
        if engine == 'edge':
            voices = []
            _edge_sections = []
            _edge_vid_to_lang = {}
            for lang_code, lang_label in LANG_LABELS.items():
                lang_voices = EDGE_VOICES.get(lang_code, [])
                if lang_voices:
                    _edge_sections.append((len(voices), lang_code, lang_label))
                    for vid, lbl in lang_voices:
                        voices.append((vid, lbl))
                        _edge_vid_to_lang[vid] = lang_code
        elif engine == 'vbee':
            voices = VBEE_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_vbee = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if _lbl.startswith('HN -') and _vid.startswith('hn_female') and ('hnf' not in _seen_vbee):
                    _edge_sections.append((_si, 'hnf', '🇻🇳 Nữ – Miền Bắc'))
                    _seen_vbee.add('hnf')
                elif _lbl.startswith('HN -') and _vid.startswith('hn_male') and ('hnm' not in _seen_vbee):
                    _edge_sections.append((_si, 'hnm', '🇻🇳 Nam – Miền Bắc'))
                    _seen_vbee.add('hnm')
                elif _lbl.startswith('SG -') and _vid.startswith('sg_female') and ('sgf' not in _seen_vbee):
                    _edge_sections.append((_si, 'sgf', '🇻🇳 Nữ – Miền Nam'))
                    _seen_vbee.add('sgf')
                elif _lbl.startswith('SG -') and _vid.startswith('sg_male') and ('sgm' not in _seen_vbee):
                    _edge_sections.append((_si, 'sgm', '🇻🇳 Nam – Miền Nam'))
                    _seen_vbee.add('sgm')
                elif _lbl.startswith('Huế -') and 'hue' not in _seen_vbee:
                    _edge_sections.append((_si, 'hue', '🇻🇳 Miền Trung (Huế)'))
                    _seen_vbee.add('hue')
        elif engine == 'elevenlabs':
            voices = ELEVENLABS_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_secs = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if _lbl.startswith('🆓') and '(Nữ' in _lbl and ('pf' not in _seen_secs):
                    _edge_sections.append((_si, 'pf', 'FREE ── Premade Nữ'))
                    _seen_secs.add('pf')
                elif _lbl.startswith('🆓') and '(Nam' in _lbl and ('pm' not in _seen_secs):
                    _edge_sections.append((_si, 'pm', 'FREE ── Premade Nam'))
                    _seen_secs.add('pm')
                elif _lbl.startswith('💎VIP') and 'VN)' in _lbl and ('vn' not in _seen_secs):
                    _edge_sections.append((_si, 'vn', 'VIP ── Tiếng Việt'))
                    _seen_secs.add('vn')
                elif _lbl.startswith('💎VIP') and 'Hàn)' in _lbl and ('ko' not in _seen_secs):
                    _edge_sections.append((_si, 'ko', 'VIP ── Tiếng Hàn'))
                    _seen_secs.add('ko')
                elif _lbl.startswith('💎VIP') and 'Nhật)' in _lbl and ('ja' not in _seen_secs):
                    _edge_sections.append((_si, 'ja', 'VIP ── Tiếng Nhật'))
                    _seen_secs.add('ja')
                elif _lbl.startswith('💎VIP') and 'Trung)' in _lbl and ('zh' not in _seen_secs):
                    _edge_sections.append((_si, 'zh', 'VIP ── Tiếng Trung'))
                    _seen_secs.add('zh')
        elif engine == 'fpt':
            voices = FPT_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_fpt = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if 'Nữ Bắc' in _lbl and 'fb' not in _seen_fpt:
                    _edge_sections.append((_si, 'fb', '🇻🇳 Nữ – Miền Bắc'))
                    _seen_fpt.add('fb')
                elif 'Nam Bắc' in _lbl and 'mb' not in _seen_fpt:
                    _edge_sections.append((_si, 'mb', '🇻🇳 Nam – Miền Bắc'))
                    _seen_fpt.add('mb')
                elif 'Nữ Trung' in _lbl and 'ft' not in _seen_fpt:
                    _edge_sections.append((_si, 'ft', '🇻🇳 Nữ – Miền Trung'))
                    _seen_fpt.add('ft')
                elif 'Nam Trung' in _lbl and 'mt' not in _seen_fpt:
                    _edge_sections.append((_si, 'mt', '🇻🇳 Nam – Miền Trung'))
                    _seen_fpt.add('mt')
                elif 'Nữ Nam' in _lbl and 'fn' not in _seen_fpt:
                    _edge_sections.append((_si, 'fn', '🇻🇳 Nữ – Miền Nam'))
                    _seen_fpt.add('fn')
                elif 'Nam Nam' in _lbl and 'mn' not in _seen_fpt:
                    _edge_sections.append((_si, 'mn', '🇻🇳 Nam – Miền Nam'))
                    _seen_fpt.add('mn')
        elif engine == 'minimax':
            voices = MINIMAX_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_mm = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if 'Nam' in _lbl and 'Nữ' not in _lbl and ('male' not in _seen_mm):
                    _edge_sections.append((_si, 'male', '🎙️ Giọng Nam'))
                    _seen_mm.add('male')
                elif ('Nữ' in _lbl or 'Thiếu' in _lbl or 'Điềm' in _lbl or ('Ngự' in _lbl)) and 'female' not in _seen_mm:
                    _edge_sections.append((_si, 'female', '🎙️ Giọng Nữ'))
                    _seen_mm.add('female')
                elif ('Bé' in _lbl or 'Heo' in _lbl) and 'special' not in _seen_mm:
                    _edge_sections.append((_si, 'special', '🎭 Đặc biệt'))
                    _seen_mm.add('special')
                elif ('Didi' in _lbl or 'Monologue' in _lbl or 'Santa' in _lbl or ('Grinch' in _lbl) or ('Rudolph' in _lbl) or ('Arnold' in _lbl)) and 'character' not in _seen_mm:
                    _edge_sections.append((_si, 'character', '🎄 Nhân vật'))
                    _seen_mm.add('character')
        elif engine == 'zalo':
            voices = ZALO_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_zl = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if 'Nữ' in _lbl and 'female' not in _seen_zl:
                    _edge_sections.append((_si, 'female', '🇻🇳 Giọng Nữ'))
                    _seen_zl.add('female')
                elif 'Nam' in _lbl and 'male' not in _seen_zl:
                    _edge_sections.append((_si, 'male', '🇻🇳 Giọng Nam'))
                    _seen_zl.add('male')
        elif engine == 'siliconflow':
            voices = SILICONFLOW_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_sf = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                if 'Fish' in _lbl and 'fish' not in _seen_sf:
                    _edge_sections.append((_si, 'fish', '🐟 Fish-Speech 1.5'))
                    _seen_sf.add('fish')
                elif 'Cosy' in _lbl and 'cosy' not in _seen_sf:
                    _edge_sections.append((_si, 'cosy', '🎙️ CosyVoice2-0.5B'))
                    _seen_sf.add('cosy')
        elif engine == 'capcut':
            voices = CAPCUT_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _CC_LANG = {'Vi': ('vi', '🇻🇳 Tiếng Việt'), 'En': ('en', '🇬🇧 Tiếng Anh'), 'Zh': ('zh', '🇨🇳 Tiếng Trung'), 'Id': ('id', '🇮🇩 Indonesia'), 'Es': ('es', '🇪🇸 Tây Ban Nha'), 'Pt': ('pt', '🇵🇹 Bồ Đào Nha'), 'Jp': ('jp', '🇯🇵 Tiếng Nhật'), 'Th': ('th', '🇹🇭 Tiếng Thái')}
            _cc_cur = None
            for _si, (_vid, _lbl) in enumerate(voices):
                _code, _name = (('other', '🎭 Nhân vật / Khác')[0], ('other', '🎭 Nhân vật / Khác')[1])
                if _lbl.endswith(')') and '(' in _lbl:
                    _code, _name = (_CC_LANG.get(_lbl.rsplit('(', 1)[1][:-1], ('other', '🎭 Nhân vật / Khác'))[0], _CC_LANG.get(_lbl.rsplit('(', 1)[1][:-1], ('other', '🎭 Nhân vật / Khác'))[1])
                if _code != _cc_cur:
                    _cc_cur = _code
                    _edge_sections.append((_si, _code, _name))
                _edge_vid_to_lang[_vid] = _code
        elif engine == 'ngochuyen':
            try:
                voices = scan_ngochuyen_voices()
            except Exception:
                voices = NGOCHUYEN_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            try:
                from .engines_ngochuyen import _GENDER as _NH_GENDER
            except ImportError:
                _NH_GENDER = {}
            _seen_nh = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                _g = _NH_GENDER.get(_vid)
                if _g is True and 'female' not in _seen_nh:
                    _edge_sections.append((_si, 'female', '🇻🇳 Giọng Nữ'))
                    _seen_nh.add('female')
                elif _g is False and 'male' not in _seen_nh:
                    _edge_sections.append((_si, 'male', '🇻🇳 Giọng Nam'))
                    _seen_nh.add('male')
                elif _g is None and 'other' not in _seen_nh:
                    _edge_sections.append((_si, 'other', '🎙️ Giọng Khác'))
                    _seen_nh.add('other')
        elif engine == 'supertonic':
            voices = SUPERTONIC_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_st = set()
            _cur_code = (getattr(self, '_lang_var', None).get() if getattr(self, '_lang_var', None) else 'vi') or 'vi'
            _cur_lang_lbl = SUPERTONIC_LANG_LABELS.get(_cur_code.lower(), 'Tiếng Việt')
            for _si, (_vid, _lbl) in enumerate(voices):
                if _vid.startswith('F') and 'female' not in _seen_st:
                    _edge_sections.append((_si, 'female', f'🎙️ Giọng Nữ — đọc: {_cur_lang_lbl} (chọn tiếng ở ô Ngôn ngữ)'))
                    _seen_st.add('female')
                elif _vid.startswith('M') and 'male' not in _seen_st:
                    _edge_sections.append((_si, 'male', f'🎙️ Giọng Nam — đọc: {_cur_lang_lbl} (chọn tiếng ở ô Ngôn ngữ)'))
                    _seen_st.add('male')
        elif engine == 'kokoro':
            voices = KOKORO_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _seen_kk = set()
            for _si, (_vid, _lbl) in enumerate(voices):
                _g = (VOICE_META.get(_vid, ('', ''))[0] or '').lower()
                if _g == 'female' not in _seen_kk:
                    _edge_sections.append((_si, 'female', '🎙️ Giọng Nữ (Kokoro • Free)'))
                    _seen_kk.add('female')
                elif _g == 'male' not in _seen_kk:
                    _edge_sections.append((_si, 'male', '🎙️ Giọng Nam (Kokoro • Free)'))
                    _seen_kk.add('male')
        elif engine == 'tiktok':
            voices = TIKTOK_VOICES
            _edge_sections = []
            _edge_vid_to_lang = {}
            _TT_LANG = {'En': ('en', '🇬🇧 Tiếng Anh'), 'Fr': ('fr', '🇫🇷 Tiếng Pháp'), 'De': ('de', '🇩🇪 Tiếng Đức'), 'Es': ('es', '🇪🇸 Tây Ban Nha'), 'Pt': ('pt', '🇵🇹 Bồ Đào Nha'), 'Id': ('id', '🇮🇩 Indonesia'), 'Jp': ('jp', '🇯🇵 Tiếng Nhật'), 'Ko': ('ko', '🇰🇷 Tiếng Hàn')}

            def _tt_group(_vid, _lbl):
                _c = _TT_LANG.get(_lbl.rsplit('(', 1)[1][:-1])
                return _c if _lbl.endswith(')') and '(' in _lbl and _c else ('sing', '🎵 Giọng Hát') if any((kw in _lbl.lower() for kw in ('hát', 'sing', 'ca sĩ'))) else ('char', '🎭 Nhân vật')
            _tt_cur = None
            for _si, (_vid, _lbl) in enumerate(voices):
                _code, _name = (_tt_group(_vid, _lbl)[0], _tt_group(_vid, _lbl)[1])
                if _code != _tt_cur:
                    _tt_cur = _code
                    _edge_sections.append((_si, _code, _name))
                _edge_vid_to_lang[_vid] = _code
        else:
            voices = []
            _edge_sections = []
            _edge_vid_to_lang = {}
        if voices:
            C = self._C
            bg = '#1a1a2e'
            fg = C.get('fg', '#e0e0e0')
            sel_bg = '#16213e'
            hover_bg = '#0f3460'
            accent = C.get('blue', '#3b82f6')
            grn = C.get('green', '#22c55e')
            dim = C.get('dim', '#888888')
            popup = tk.Toplevel(self)
            popup.title('Chọn giọng đọc')
            popup.configure(bg=bg)
            popup.resizable(False, False)
            popup.transient(self.winfo_toplevel())
            popup.update_idletasks()
            _cols = 2 if engine == 'elevenlabs' else 3
            pw = 820 if engine == 'elevenlabs' else 780
            ph = min(825, 135 + (len(voices) // _cols + len(_edge_sections)) * 63)
            px = self.winfo_toplevel().winfo_x() + (self.winfo_toplevel().winfo_width() - pw) // 2
            py = self.winfo_toplevel().winfo_y() + (self.winfo_toplevel().winfo_height() - ph) // 2
            popup.geometry(f'{pw}x{ph}+{px}+{py}')
            try:
                import ctypes
                hwnd = ctypes.windll.user32.GetParent(popup.winfo_id())
                ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(ctypes.c_int(2)), ctypes.sizeof(ctypes.c_int))
                ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 35, ctypes.byref(ctypes.c_int(3021338)), ctypes.sizeof(ctypes.c_int))
            except Exception:
                pass
            hdr = tk.Frame(popup, bg=bg)
            hdr.pack(fill='x', padx=12, pady=(10, 4))
            engine_names = {'edge': 'Edge-TTS', 'vbee': 'Vbee TTS', 'elevenlabs': 'ElevenLabs TTS', 'ngochuyen': 'NgocHuyen TTS', 'capcut': 'CapCut TTS', 'supertonic': 'All Voice TTS', 'kokoro': 'Kokoro TTS', 'tiktok': 'TikTok TTS', 'fpt': 'FPT.AI TTS', 'minimax': 'MiniMax TTS', 'zalo': 'Zalo AI TTS', 'siliconflow': 'SiliconFlow TTS'}
            tk.Label(hdr, text=f'🎙 {engine_names.get(engine, engine)}', bg=bg, fg=accent, font=('Arial', 14, 'bold')).pack(side='left')
            _lang_count = f' — {len(LANG_LABELS)} ngôn ngữ' if engine == 'edge' else ''
            tk.Label(hdr, text=f'{len(voices)} giọng{_lang_count}', bg=bg, fg=dim, font=('Arial', 11)).pack(side='right')
            container = tk.Frame(popup, bg=bg)
            container.pack(fill='both', expand=True, padx=8, pady=4)
            canvas = tk.Canvas(container, bg=bg, highlightthickness=0, bd=0)
            scrollbar = tk.Scrollbar(container, orient='vertical', command=canvas.yview)
            scroll_frame = tk.Frame(canvas, bg=bg)
            scroll_frame.bind('<Configure>', lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
            canvas.create_window((0, 0), window=scroll_frame, anchor='nw')
            canvas.configure(yscrollcommand=scrollbar.set)
            canvas.pack(side='left', fill='both', expand=True)
            scrollbar.pack(side='right', fill='y')

            def _on_mousewheel(e):
                canvas.yview_scroll(int(-1 * (e.delta / 120)) * 3, 'units')
                return 'break'
            popup.bind('<MouseWheel>', _on_mousewheel)
            current_label = self._voice_var.get()
            self._popup_play_proc = [None]
            _selected = [current_label]
            _rows = {}

            def _stop_popup_audio():
                if self._popup_play_proc[0]:
                    if self._popup_play_proc[0].poll() is None:
                        try:
                            self._popup_play_proc[0].terminate()
                            self._popup_play_proc[0].wait(timeout=1)
                        except Exception:
                            try:
                                self._popup_play_proc[0].kill()
                            except Exception:
                                pass
                        self._popup_play_proc[0] = None

            def _select_voice(label, voice_id=None):
                old = _selected[0]
                _selected[0] = label
                self._voice_var.set(label)
                if label != old:
                    self._clear_voice_results_on_setting_change()
                if engine == 'edge' and voice_id and (voice_id in _edge_vid_to_lang):
                    self._set_lang_code(_edge_vid_to_lang[voice_id])
                if old in _rows:
                    r, nlbl, chk, bdr = _rows[old]
                    r.config(bg=bg)
                    bdr.config(bg='#444466')
                    nlbl.config(bg=bg, fg=fg, font=('Arial', 12))
                    for w in _rows[old]:
                        try:
                            w.config(bg=bg)
                        except Exception:
                            pass
                if label in _rows:
                    r, nlbl, _, bdr = _rows[label]
                    r.config(bg=sel_bg)
                    bdr.config(bg=grn)
                    nlbl.config(bg=sel_bg, fg=grn, font=('Arial', 12, 'bold'))
                    for w in _rows[label]:
                        try:
                            w.config(bg=sel_bg)
                        except Exception:
                            pass
                else:
                    return None
                if chk:
                    chk.destroy()
                    _rows[old] = (r, nlbl, None, bdr)
                chk = tk.Label(r, text='✓', bg=sel_bg, fg=grn, font=('Arial', 14, 'bold'))
                chk.pack(side='right', padx=(0, 8), pady=5)
                chk.bind('<Button-1>', lambda e, lb=label: _select_and_preview(lb))
                _rows[label] = (r, nlbl, chk, bdr)
            _spinner_lbl = [None]
            _spinner_id = [None]
            _spinner_frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
            _spinner_idx = [0]

            def _start_spinner(label):
                _stop_spinner()
                if label not in _rows:
                    return None
                r, nlbl, _, _bdr = (_rows[label][0], _rows[label][1], _rows[label][2], _rows[label][3])
                row_bg = sel_bg
                sp = tk.Label(r, text='⠋', bg=row_bg, fg='#facc15', font=('Consolas', 10, 'bold'))
                sp.pack(side='right', padx=(0, 2))
                _spinner_lbl[0] = sp
                _spinner_idx[0] = 0

                def _animate():
                    if _spinner_lbl[0] is None:
                        pass
                    else:
                        try:
                            _spinner_idx[0] = (_spinner_idx[0] + 1) % len(_spinner_frames)
                            _spinner_lbl[0].config(text=_spinner_frames[_spinner_idx[0]])
                            _spinner_id[0] = popup.after(100, _animate)
                        except Exception:
                            pass
                _spinner_id[0] = popup.after(100, _animate)

            def _stop_spinner():
                if _spinner_id[0] is not None:
                    try:
                        popup.after_cancel(_spinner_id[0])
                    except Exception:
                        pass
                    _spinner_id[0] = None
                if _spinner_lbl[0] is not None:
                    try:
                        _spinner_lbl[0].destroy()
                    except Exception:
                        pass
                    _spinner_lbl[0] = None

            def _select_and_preview(label, voice_id=None):
                if self._testing_voice:
                    pass
                else:
                    _select_voice(label, voice_id)
                    _stop_popup_audio()
                    _stop_spinner()
                    meta = VOICE_META.get(voice_id, ('', '')) if voice_id else ('', '')
                    demo_url = meta[1] if len(meta) > 1 else ''
                    if demo_url:
                        ffplay = _get_ffplay_path()
                        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
                        try:
                            proc = subprocess.Popen([ffplay, '-nodisp', '-autoexit', '-loglevel', 'quiet', demo_url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
                            self._popup_play_proc[0] = proc
                            from exporter.exporter_preview_engine import _assign_to_job
                            _assign_to_job(proc)
                            _ref = [proc]

                            def _auto_kill_ffplay():
                                p = _ref[0]
                                if p:
                                    if p.poll() is None:
                                        try:
                                            p.kill()
                                        except Exception:
                                            pass
                            try:
                                popup.after(20000, _auto_kill_ffplay)
                            except Exception:
                                return None
                        except FileNotFoundError:
                            return None
                        except Exception:
                            pass
                    else:
                        _start_spinner(label)
                        _orig_play = self._play_audio_inapp
                        self._orig_play_audio_inapp = _orig_play

                        def _play_and_stop_spinner(path):
                            _stop_spinner()
                            _orig_play(path)
                            self._play_audio_inapp = _orig_play
                            if hasattr(self, '_orig_play_audio_inapp'):
                                del self._orig_play_audio_inapp
                                return None
                        self._play_audio_inapp = _play_and_stop_spinner
                        self._test_voice()
            COLS = _cols
            _col_w = (pw - 30) // COLS
            _section_indices = {s[0] for s in _edge_sections}
            _section_map = {s[0]: s for s in _edge_sections}
            _col = 0
            _grid_row = None
            for _vi, (voice_id, label) in enumerate(voices):
                if _vi in _section_indices:
                    _, _sc, _sl = (_section_map[_vi][0], _section_map[_vi][1], _section_map[_vi][2])
                    _flag = {'vi': '🇻🇳', 'vf': '🇻🇳', 'vm': '🇻🇳', 'en': '🇬🇧', 'zh': '🇨🇳', 'ja': '🇯🇵', 'ko': '🇰🇷', 'th': '🇹🇭', 'id': '🇮🇩', 'fr': '🇫🇷', 'mf': '🌐', 'mm': '🌐', 'pf': '', 'pm': '', 'vn': '', 'hnf': '🇻🇳', 'hnm': '🇻🇳', **{'sgf': '🇻🇳', 'sgm': '🇻🇳', 'hue': '🇻🇳', 'fb': '🇻🇳', 'mb': '🇻🇳', 'ft': '🇻🇳', 'mt': '🇻🇳', 'fn': '🇻🇳', 'mn': '🇻🇳'}}.get(_sc, '🌐')
                    sep = tk.Frame(scroll_frame, bg='#333355', height=1)
                    sep.pack(fill='x', padx=6, pady=(8 if _vi > 0 else 3, 3))
                    shdr = tk.Frame(scroll_frame, bg=bg)
                    shdr.pack(fill='x', padx=10)
                    if _sc in ('pf', 'pm'):
                        _badge = tk.Label(shdr, text=' FREE ', bg='#166534', fg='#4ade80', font=('Arial', 9, 'bold'), padx=4, pady=1)
                        _badge.pack(side='left', padx=(0, 6))
                        tk.Label(shdr, text=_sl.replace('FREE ── ', ''), bg=bg, fg=accent, font=('Arial', 12, 'bold'), anchor='w').pack(side='left')
                    elif _sc in ('vn', 'ko', 'ja', 'zh'):
                        _badge = tk.Label(shdr, text=' VIP ', bg='#713f12', fg='#facc15', font=('Arial', 9, 'bold'), padx=4, pady=1)
                        _badge.pack(side='left', padx=(0, 6))
                        tk.Label(shdr, text=_sl.replace('VIP ── ', ''), bg=bg, fg=accent, font=('Arial', 12, 'bold'), anchor='w').pack(side='left')
                    else:
                        tk.Label(shdr, text=f'{_flag} {_sl}', bg=bg, fg=accent, font=('Arial', 12, 'bold'), anchor='w').pack(side='left')
                    _col = 0
                    _grid_row = None
                if _col == 0 or _grid_row is None:
                    _grid_row = tk.Frame(scroll_frame, bg=bg)
                    _grid_row.pack(fill='x', padx=6, pady=2)
                    for c in range(COLS):
                        _grid_row.columnconfigure(c, weight=1, minsize=_col_w)
                meta = VOICE_META.get(voice_id, ('', ''))
                gender = meta[0] if meta else ''
                is_current = label == current_label
                row_bg = sel_bg if is_current else bg
                _cell_bd_color = grn if is_current else '#444466'
                cell_border = tk.Frame(_grid_row, bg=_cell_bd_color)
                cell_border.grid(row=0, column=_col, sticky='nsew', padx=3, pady=3)
                cell = tk.Frame(cell_border, bg=row_bg, cursor='hand2')
                cell.pack(fill='both', expand=True, padx=1, pady=1)
                if gender == 'female':
                    icon_text, icon_fg = (('♀', '#f472b6')[0], ('♀', '#f472b6')[1])
                elif gender == 'male':
                    icon_text, icon_fg = (('♂', '#60a5fa')[0], ('♂', '#60a5fa')[1])
                else:
                    icon_fg, icon_text = (dim, '●')
                icon_lbl = tk.Label(cell, text=icon_text, bg=row_bg, fg=icon_fg, font=('Arial', 14), width=2)
                icon_lbl.pack(side='left', padx=(8, 0), pady=5)
                _display_label = label
                _badge_lbl = None
                if label.startswith('🆓 '):
                    _display_label = label[2:].lstrip()
                    _badge_lbl = tk.Label(cell, text='FREE', bg='#166534', fg='#4ade80', font=('Arial', 8, 'bold'), padx=3, pady=0)
                    _badge_lbl.pack(side='left', padx=(3, 2), pady=5)
                elif label.startswith('💎VIP '):
                    _display_label = label[5:].lstrip()
                    _badge_lbl = tk.Label(cell, text='VIP', bg='#713f12', fg='#facc15', font=('Arial', 8, 'bold'), padx=3, pady=0)
                    _badge_lbl.pack(side='left', padx=(3, 2), pady=5)
                name_fg = grn if is_current else fg
                name_font = ('Arial', 12, 'bold') if is_current else ('Arial', 12)
                lbl = tk.Label(cell, text=_display_label, bg=row_bg, fg=name_fg, font=name_font, anchor='w')
                lbl.pack(side='left', fill='x', expand=True, padx=(3, 0), pady=5)
                chk_ref = None
                if is_current:
                    chk_ref = tk.Label(cell, text='✓', bg=row_bg, fg=grn, font=('Arial', 14, 'bold'))
                    chk_ref.pack(side='right', padx=(0, 8), pady=5)
                _rows[label] = (cell, lbl, chk_ref, cell_border)
                _click_cb = lambda e, lb=label, vid=voice_id: _select_and_preview(lb, vid)
                _bind_widgets = [cell_border, cell, lbl, icon_lbl]
                if _badge_lbl:
                    _bind_widgets.append(_badge_lbl)
                for widget in _bind_widgets:
                    widget.bind('<Button-1>', _click_cb)
                if chk_ref:
                    chk_ref.bind('<Button-1>', _click_cb)
                _hover_color = '#3a3a5e'

                def _enter(e, r=cell, bdr=cell_border, lb=label):
                    h_bg = _hover_color
                    for w in (r, bdr, lb):
                        try:
                            w.config(bg=h_bg)
                        except Exception:
                            pass
                    bdr.config(bg='#6677aa')

                def _leave(e, r=cell, bdr=cell_border, lb=label):
                    actual_bg = sel_bg if lb == _selected[0] else bg
                    for w in (r, bdr, lb):
                        try:
                            w.config(bg=actual_bg)
                        except Exception:
                            pass
                    bdr.config(bg=grn if lb == _selected[0] else '#444466')
                cell.bind('<Enter>', _enter)
                cell.bind('<Leave>', _leave)
                _col += 1
                if _col >= COLS:
                    _col = 0
                    _grid_row = None

            def _on_popup_close():
                _stop_popup_audio()
                _stop_spinner()
                if hasattr(self, '_orig_play_audio_inapp'):
                    self._play_audio_inapp = self._orig_play_audio_inapp
                    del self._orig_play_audio_inapp
                self._testing_voice = False
                try:
                    popup.grab_release()
                except Exception:
                    pass
                popup.destroy()
            popup.protocol('WM_DELETE_WINDOW', _on_popup_close)
            popup.grab_set()
            popup.update_idletasks()
            for i, (_, label) in enumerate(voices):
                if label == current_label:
                    _row_idx = i // COLS
                    _sections_before = sum((1 for j in _section_indices if j < i))
                    _approx_y = _row_idx * 36 + _sections_before * 30 - 60
                    canvas.yview_moveto(max(0, _approx_y) / max(1, scroll_frame.winfo_height()))
                    return None

    def _play_audio_inapp(self, path: str):
        if self._play_proc and self._play_proc.poll() is None:
            try:
                self._play_proc.kill()
                self._play_proc.wait(timeout=0.5)
            except Exception:
                pass
            self._play_proc = None
        ffplay = _get_ffplay_path()
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        try:
            self._play_proc = subprocess.Popen([ffplay, '-nodisp', '-autoexit', '-loglevel', 'quiet', path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
            from exporter.exporter_preview_engine import _assign_to_job
            _assign_to_job(self._play_proc)
        except FileNotFoundError:
            if sys.platform == 'win32':
                try:
                    import winsound
                    winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_ASYNC)
                except Exception:
                    return None
                return None