"""
longtieng_ui.py — Panel lồng tiếng (TTS) nhúng vào tab Exporter.
Giao diện compact, nút bo tròn, nghe thử trực tiếp trong ứng dụng.
"""
from __future__ import annotations
import os
import importlib.util as importlib
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from typing import Callable
import config as _cfg
from .longtieng_engine import EDGE_VOICES, LANG_LABELS, VIENEW_VOICES, VBEE_VOICES, FPT_VOICES, ENGINE_LABELS, _FPT_FREE_KEYS, VIENEW_MODELS, DEFAULT_VIENEW_MODEL, VOICE_META, MINIMAX_VOICES, ZALO_VOICES, SiliconFlowTTSEngine, SILICONFLOW_VOICES, CAPCUT_VOICES, SUPERTONIC_VOICES, KOKORO_VOICES, TIKTOK_VOICES, scan_ngochuyen_voices, run_tts_async
from .longtieng_voices import NGOCHUYEN_VOICES, SUPERTONIC_LANG_LABELS
from .elevenlabs_engine import ELEVENLABS_VOICES
from .longtieng_merge import merge_voice_audio
try:
    from ui_widgets import RoundedButton
    RoundedButton = RoundedButton
    from ui_widgets import ToggleSwitch
    ToggleSwitch = ToggleSwitch
    _HAS_WIDGETS = True
except ImportError:
    _HAS_WIDGETS = False
from .longtieng_voice_picker import VoicePickerMixin
from .longtieng_tts_flow import TTSFlowMixin

class LongTiengPanel(VoicePickerMixin, TTSFlowMixin, tk.Frame):
    __doc__ = '\nPanel lồng tiếng tích hợp vào ExporterTab.\n\nAPI công khai:\n    set_segments(segments)     — cập nhật danh sách phụ đề\n    set_input_file(path)       — đặt video đầu vào (dùng khi xuất)\n    get_settings() -> dict     — lấy cài đặt TTS hiện tại\n'

    def __init__(self, parent, colors, log_cb=None, on_voice_ready=None, **kwargs):
        C = colors
        var().__init__(*(parent,), **{'bg': C.get('bg_card', '#1e1e1e'), **kwargs})
        self._C = C
        self._bg = C.get('bg_card', '#1e1e1e')
        self._inp = C.get('bg_input', '#2a2a2a')
        self._segments = []
        self._voice_results = []
        self._voice_results_gen_pct = None
        self._last_fit_pct = 25
        self._last_tts_fit_mode = 'Kéo dài video theo TTS'
        self._input_file = ''
        self._stop_flag = threading.Event()
        self._is_running = False
        self._log_cb = log_cb
        self._on_voice_ready = on_voice_ready
        self._play_proc = None
        self._testing_voice = False
        self._bgm_full_path = ''
        self._lang_engine_map = self._load_lang_engine_pref()
        import atexit
        atexit.register(self._kill_play_proc)
        self._build_ui()
        return None

    def _build_ui(self):
        C = self._C
        bg = self._bg
        inp = self._inp
        fg = C.get('fg', '#e0e0e0')
        dim = C.get('dim', '#888888')
        org = C.get('orange', '#f59e0b')
        grn = C.get('green', '#22c55e')
        red = C.get('red', '#ef4444')
        blu = C.get('blue', '#3b82f6')
        fnt = ('Arial', 8)
        fnt_b = ('Arial', 8, 'bold')
        hdr = tk.Frame(self, bg=bg)
        hdr.pack(fill='x', pady=(2, 3))
        tk.Label(hdr, text='🎤 Lồng Tiếng (TTS)', bg=bg, fg=org, font=('Arial', 9, 'bold')).pack(side='left')
        self._lt_enabled_var = tk.BooleanVar(value=False)
        if _HAS_WIDGETS:
            ToggleSwitch(hdr, variable=self._lt_enabled_var, bg=bg, bg_on=grn).pack(side='right', padx=4)
        else:
            tk.Checkbutton(hdr, text='Bật', variable=self._lt_enabled_var, bg=bg, fg=fg, selectcolor=inp, activebackground=bg, font=fnt).pack(side='right')
        self._lt_enabled_var.trace_add('write', lambda *_: self._on_lt_toggle())
        self._content_frame = tk.Frame(self, bg=bg)
        cf = self._content_frame
        voice_frame = tk.LabelFrame(cf, text='⚙ Cài đặt giọng', font=('Arial', 8, 'bold'), padx=5, pady=3, bg=bg, fg=fg)
        voice_frame.pack(fill='x', pady=(2, 4))
        self._r_engine = tk.Frame(voice_frame, bg=bg)
        self._r_engine.pack(fill='x', pady=(2, 2))
        tk.Label(self._r_engine, text='Engine:', bg=bg, fg=fg, font=fnt, width=7, anchor='w').pack(side='left')
        self._engine_var = tk.StringVar(value='NgocHuyen TTS (Free • Offline)')
        tk.Label(self._r_engine, text='x', bg=bg, fg=dim, font=fnt).pack(side='right', padx=(0, 2))
        self._speed_var = tk.DoubleVar(value=1.1)
        vcmd = (self.register(self._validate_speed), '%P')
        self._speed_entry = tk.Entry(self._r_engine, textvariable=self._speed_var, width=4, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat', validate='key', validatecommand=vcmd)
        self._speed_entry.pack(side='right', padx=(0, 1))
        tk.Label(self._r_engine, text='Tốc:', bg=bg, fg=fg, font=fnt).pack(side='right', padx=(4, 1))
        label = label
        _ = _
        self._engine_cb = ttk.Combobox(self._r_engine, textvariable=self._engine_var, values=[label for item in ENGINE_LABELS], width=15, state='readonly', font=fnt)
        self._engine_cb.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._engine_cb.bind('<<ComboboxSelected>>', self._on_engine_change)
        self._engine_cb.bind('<MouseWheel>', lambda e: 'break')
        self._r_apikey = tk.Frame(voice_frame, bg=bg)
        self._apikey_label = tk.Label(self._r_apikey, text='API Key:', bg=bg, fg=fg, font=fnt, width=11, anchor='w')
        self._apikey_label.pack(side='left')
        self._apikey_var = tk.StringVar(value='')
        self._apikey_entry = tk.Entry(self._r_apikey, textvariable=self._apikey_var, width=20, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat', show='•')
        self._apikey_entry.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._btn_show_key = tk.Button(self._r_apikey, text='👁', bg=inp, fg=fg, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._toggle_apikey_show)
        self._btn_show_key.pack(side='left')
        self._btn_test_key = tk.Button(self._r_apikey, text='✓', bg=inp, fg='#22c55e', font=('Arial', 11, 'bold'), relief='flat', cursor='hand2', padx=3, command=self._test_apikey)
        self._btn_test_key.pack(side='left', padx=(2, 0))
        self._btn_clear_key = tk.Button(self._r_apikey, text='✕', bg=inp, fg='#ef4444', font=('Arial', 11, 'bold'), relief='flat', cursor='hand2', padx=3, command=self._clear_user_apikey)
        self._btn_clear_key.pack(side='left', padx=(2, 0))
        self._apikey_visible = False
        self._apikey_ph_active = False
        self._apikey_entry.bind('<FocusIn>', self._on_apikey_focus_in)
        self._apikey_entry.bind('<FocusOut>', self._on_apikey_focus_out)
        self._r_apikey_status = tk.Frame(voice_frame, bg=bg)
        self._apikey_status_label = tk.Label(self._r_apikey_status, text='', bg=bg, fg='#888888', font=('Arial', 9), anchor='w')
        self._apikey_status_label.pack(side='left', padx=(90, 0))
        self._r_proxy = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_proxy, text='Proxy:', bg=bg, fg=fg, font=fnt, width=11, anchor='w').pack(side='left')
        self._proxy_var = tk.StringVar(value='')
        self._proxy_entry = tk.Entry(self._r_proxy, textvariable=self._proxy_var, width=20, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat')
        self._proxy_entry.pack(side='left', fill='x', expand=True, padx=(0, 2))
        _proxy_hint = tk.Label(self._r_proxy, text='vd: ip:port:user:pass', bg=bg, fg='#666666', font=('Arial', 8), anchor='w')
        _proxy_hint.pack(side='left')
        self._r_relay = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_relay, text='Relay URL:', bg=bg, fg=fg, font=fnt, width=11, anchor='w').pack(side='left')
        self._relay_var = tk.StringVar(value='')
        self._relay_entry = tk.Entry(self._r_relay, textvariable=self._relay_var, width=20, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat')
        self._relay_entry.pack(side='left', fill='x', expand=True, padx=(0, 2))
        _relay_hint = tk.Label(self._r_relay, text='bypass IP block', bg=bg, fg='#666666', font=('Arial', 8), anchor='w')
        _relay_hint.pack(side='left')
        self._r_relay_secret = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_relay_secret, text='Relay Secret:', bg=bg, fg=fg, font=fnt, width=11, anchor='w').pack(side='left')
        self._relay_secret_var = tk.StringVar(value='')
        self._relay_secret_entry = tk.Entry(self._r_relay_secret, textvariable=self._relay_secret_var, width=20, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat', show='•')
        self._relay_secret_entry.pack(side='left', fill='x', expand=True, padx=(0, 2))
        _rsec_hint = tk.Label(self._r_relay_secret, text='(tuỳ chọn)', bg=bg, fg='#666666', font=('Arial', 8), anchor='w')
        _rsec_hint.pack(side='left')
        self._r_vbee_key = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_vbee_key, text='APP ID:', bg=bg, fg=fg, font=fnt, anchor='w').pack(side='left')
        self._vbee_appid_var = tk.StringVar(value='')
        self._vbee_appid_entry = tk.Entry(self._r_vbee_key, textvariable=self._vbee_appid_var, width=10, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat', show='•')
        self._vbee_appid_entry.pack(side='left', fill='x', expand=True, padx=(2, 4))
        tk.Label(self._r_vbee_key, text='Token:', bg=bg, fg=fg, font=fnt, anchor='w').pack(side='left')
        self._vbee_token_var = tk.StringVar(value='')
        self._vbee_token_entry = tk.Entry(self._r_vbee_key, textvariable=self._vbee_token_var, width=10, font=fnt, bg=inp, fg=org, insertbackground=fg, relief='flat', show='•')
        self._vbee_token_entry.pack(side='left', fill='x', expand=True, padx=(2, 2))
        self._btn_vbee_show = tk.Button(self._r_vbee_key, text='👁', bg=inp, fg=fg, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._toggle_vbee_show)
        self._btn_vbee_show.pack(side='left')
        self._btn_vbee_test = tk.Button(self._r_vbee_key, text='✓', bg=inp, fg='#22c55e', font=('Arial', 11, 'bold'), relief='flat', cursor='hand2', padx=3, command=self._test_apikey)
        self._btn_vbee_test.pack(side='left', padx=(2, 0))
        self._btn_vbee_clear = tk.Button(self._r_vbee_key, text='✕', bg=inp, fg='#ef4444', font=('Arial', 11, 'bold'), relief='flat', cursor='hand2', padx=3, command=self._clear_user_apikey)
        self._btn_vbee_clear.pack(side='left', padx=(2, 0))
        self._vbee_visible = False
        self._r_lang = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_lang, text='Ngôn ngữ:', bg=bg, fg=fg, font=fnt, width=7, anchor='w').pack(side='left')
        self._lang_var = tk.StringVar(value='vi')
        self._lang_display_var = tk.StringVar(value=LANG_LABELS.get('vi', 'Tiếng Việt'))
        self._lang_cb = ttk.Combobox(self._r_lang, textvariable=self._lang_display_var, values=list(LANG_LABELS.values()), width=16, state='readonly', font=fnt)
        self._lang_cb.pack(side='left', fill='x', expand=True)
        self._lang_cb.bind('<<ComboboxSelected>>', self._on_lang_change)
        self._lang_cb.bind('<MouseWheel>', lambda e: [1, 'break'][-1])
        self._r_model = tk.Frame(voice_frame, bg=bg)
        self._r_model.pack(fill='x', pady=(2, 2))
        tk.Label(self._r_model, text='Model:', bg=bg, fg=fg, font=fnt, width=7, anchor='w').pack(side='left')
        self._model_var = tk.StringVar(value=VIENEW_MODELS[0][1])
        [label for item in ENGINE_LABELS]
        self._model_cb = ttk.Combobox(self._r_model, textvariable=self._model_var, values=[label for item in VIENEW_MODELS], width=22, state='readonly', font=fnt)
        self._model_cb.pack(side='left', fill='x', expand=True)
        self._model_cb.bind('<MouseWheel>', lambda e: [2, 'break'][-1])
        self._model_cb.bind('<<ComboboxSelected>>', self._on_model_change)
        self._r_voice = tk.Frame(voice_frame, bg=bg)
        self._r_voice.pack(fill='x', pady=(2, 2))
        tk.Label(self._r_voice, text='Giọng:', bg=bg, fg=fg, font=fnt, width=7, anchor='w').pack(side='left')
        self._voice_var = tk.StringVar(value='Ngọc Huyền')
        self._voice_cb = ttk.Combobox(self._r_voice, textvariable=self._voice_var, width=15, state='readonly', font=fnt)
        self._voice_cb.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._voice_cb.bind('<MouseWheel>', lambda e: [3, 'break'][-1])
        self._voice_cb.config(state='disabled')

        def _intercept_click(e):
            self._open_voice_picker()
            return 'break'
        self._voice_cb.bind('<Button-1>', _intercept_click)
        [label for item in VIENEW_MODELS]
        self._btn_test = RoundedButton(self._r_voice, text='Thử', command=self._test_voice, bg_color=blu, width=36, height=22, font_size=7, bg=bg)
        self._btn_test.pack(side='left', padx=(0, 37))
        self._btn_test = tk.Button(self._r_voice, text='>>', bg=blu, fg='white', font=fnt_b, relief='flat', padx=4, pady=1, cursor='hand2', command=self._test_voice)
        self._btn_test.pack(side='left', padx=(0, 37))
        self._ref_audio_var = tk.StringVar(value='')
        self._ref_audio_full_path = ''
        self._ref_text_var = tk.StringVar(value='')
        self._r_speed = tk.Frame(voice_frame, bg=bg)
        self._r_fit = tk.Frame(voice_frame, bg=bg)
        self._r_fit.pack(fill='x', pady=(2, 2))
        tk.Label(self._r_fit, text='Khớp TTS:', bg=bg, fg=fg, font=fnt, width=10, anchor='w').pack(side='left')
        self._tts_fit_pct = tk.IntVar(value=25)
        self._tts_fit_var = tk.StringVar(value='Kéo dài video theo TTS')
        self._tts_fit_hint = tk.Label(self._r_fit, text='', bg=bg, fg=fg, font=fnt, width=16, anchor='e')
        self._tts_fit_hint.pack(side='right', padx=(4, 0))
        self._tts_fit_scale = tk.Scale(self._r_fit, from_=0, to=100, orient='horizontal', variable=self._tts_fit_pct, showvalue=False, bg=bg, fg=fg, troughcolor='#0f3460', highlightthickness=0, command=self._on_tts_fit_changed, length=130)
        self._tts_fit_scale.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._tts_fit_scale.bind('<MouseWheel>', lambda e: [4, 'break'][-1])
        self._tts_fit_scale.bind('<ButtonRelease-1>', self._on_tts_fit_release)
        self._on_tts_fit_changed()
        self._r_pitch = tk.Frame(voice_frame, bg=bg)
        tk.Label(self._r_pitch, text='Độ Giọng:', bg=bg, fg=fg, font=fnt, width=7, anchor='w').pack(side='left')
        self._pitch_var = tk.DoubleVar(value=0.0)
        self._pitch_scale = tk.Scale(self._r_pitch, from_=-12, to=12, resolution=0.5, orient='horizontal', variable=self._pitch_var, bg=bg, fg=fg, troughcolor=inp, highlightthickness=0, sliderrelief='flat', font=('Segoe UI', 7), length=120, showvalue=False)
        self._pitch_scale.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._pitch_label = tk.Label(self._r_pitch, text='0', bg=bg, fg=org, font=fnt, width=4, anchor='center')
        self._pitch_label.pack(side='left')
        tk.Label(self._r_pitch, text='st', bg=bg, fg=dim, font=fnt).pack(side='left')

        def _on_pitch_change(*_):
            v = self._pitch_var.get()
            self._pitch_label.config(text=f'{v:+.1f}' if v != 0 else '0')
            return None
        self._pitch_var.trace_add('write', _on_pitch_change)
        audio_frame = tk.LabelFrame(cf, text='🎵 Âm thanh', font=('Arial', 8, 'bold'), padx=5, pady=3, bg=bg, fg=fg)
        audio_frame.pack(fill='x', pady=(2, 4))
        self._r_bgm = tk.Frame(audio_frame, bg=bg)
        self._r_bgm.pack(fill='x', pady=1)
        _bgm_left = tk.Frame(self._r_bgm, bg=bg)
        _bgm_left.pack(side='left', fill='x', expand=True, padx=(0, 2))
        tk.Label(_bgm_left, text='Nhạc nền:', bg=bg, fg=fg, font=fnt, anchor='w').pack(side='left')
        self._bgm_var = tk.StringVar(value='')
        self._bgm_presets = self._scan_bgm_presets()
        bgm_values = list(self._bgm_presets.keys())
        if bgm_values:
            bgm_values.insert(0, '📂 Chọn file khác...')
        self._bgm_combo = ttk.Combobox(_bgm_left, textvariable=self._bgm_var, values=bgm_values, state='readonly', font=fnt, width=14)
        self._bgm_combo.pack(side='left', fill='x', expand=True, padx=(0, 2))
        self._bgm_combo.bind('<<ComboboxSelected>>', self._on_bgm_selected)
        self._bgm_combo.bind('<MouseWheel>', lambda e: [5, 'break'][-1])
        if not bgm_values:
            tk.Button(_bgm_left, text='📂', bg=inp, fg=fg, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._browse_bgm).pack(side='left', padx=(0, 1))
        tk.Button(_bgm_left, text='✕', bg=inp, fg=red, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._clear_bgm).pack(side='left')
        self._r_ext_voice = tk.Frame(self._r_bgm, bg=bg)
        self._r_ext_voice.pack(side='left', fill='x', expand=True, padx=(2, 0))
        tk.Label(self._r_ext_voice, text='File giọng:', bg=bg, fg=fg, font=fnt, anchor='w').pack(side='left')
        self._ext_voice_var = tk.StringVar(value='')
        self._ext_voice_full_path = ''
        self._ext_voice_entry = tk.Entry(self._r_ext_voice, textvariable=self._ext_voice_var, width=12, font=fnt, bg=inp, fg=fg, readonlybackground=inp, disabledbackground=inp, insertbackground=fg, relief='flat', state='readonly')
        self._ext_voice_entry.pack(side='left', fill='x', expand=True, padx=(0, 2))
        tk.Button(self._r_ext_voice, text='📂', bg=inp, fg=fg, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._browse_ext_voice).pack(side='left', padx=(0, 1))
        tk.Button(self._r_ext_voice, text='✕', bg=inp, fg=red, font=fnt, relief='flat', cursor='hand2', padx=3, command=self._clear_ext_voice).pack(side='left')
        self._btn_row = tk.Frame(cf, bg=bg)
        self._btn_row.pack(fill='x', pady=(5, 2))
        self._tts_workers_var = tk.StringVar(value='Tự động')
        i = i
        _thread_opts = ['Tự động'] + [str(i) for i in range(1, 17)]
        [str(i) for i in range(1, 17)]
        self._btn_gen = RoundedButton(self._btn_row, text='Tạo Giọng Đọc', command=self._start_tts, bg_color='#0ea5e9', width=150, height=26, font_size=8, bg=bg)
        self._btn_gen.pack(side='left', padx=(0, 3))
        self._btn_stop = RoundedButton(self._btn_row, text='Dừng', command=self._stop_tts, bg_color=red, width=60, height=26, font_size=8, bg=bg)
        self._btn_stop.pack(side='left')
        self._btn_gen = tk.Button(self._btn_row, text='Tạo Giọng Đọc', bg='#0ea5e9', fg='white', font=fnt_b, relief='flat', padx=5, pady=3, cursor='hand2', command=self._start_tts)
        self._btn_gen.pack(side='left', padx=(0, 3))
        self._btn_stop = tk.Button(self._btn_row, text='Dừng', bg=red, fg='white', font=fnt_b, relief='flat', padx=5, pady=3, cursor='hand2', command=self._stop_tts, state='disabled')
        self._btn_stop.pack(side='left')
        self._tts_workers_cb = ttk.Combobox(self._btn_row, textvariable=self._tts_workers_var, values=_thread_opts, width=8, state='readonly', font=fnt)
        self._tts_workers_cb.pack(side='left', padx=(3, 0))
        self._progress_var = tk.DoubleVar(value=0)
        style = ttk.Style()
        try:
            style.theme_use('clam')
        except Exception:
            pass
        style.configure('LT.Horizontal.TProgressbar', foreground=grn, background=grn, troughcolor=inp)
        self._pbar = ttk.Progressbar(cf, variable=self._progress_var, maximum=100, style='LT.Horizontal.TProgressbar')
        self._pbar.pack(fill='x', pady=(3, 1))
        self._status_var = tk.StringVar(value='Bật toggle để sử dụng Lồng Tiếng.')
        self._status_lbl = tk.Label(cf, textvariable=self._status_var, bg=bg, fg=dim, font=fnt, anchor='w', wraplength=340)
        self._status_lbl.pack(fill='x', pady=(0, 2))
        self._populate_voices()
        engine = self._get_engine_key()
        if engine != 'edge':
            self._r_lang.pack_forget()
        if engine in ('fpt', 'elevenlabs'):
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_voice.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine not in ('vbee',):
            self._r_apikey.pack_forget()
        if engine != 'vienew':
            self._r_model.pack_forget()
        self._btn_gen_enabled = True
        self._btn_stop_enabled = False
        self._sync_btn_colors()
        return None

    def _on_lt_toggle(self):
        if self._lt_enabled_var.get():
            self._content_frame.pack(fill='both', expand=True)
            self._set_status('Sẵn sàng.' if not self._segments else f'Sẵn sàng — {len(self._segments)} đoạn phụ đề.', self._C.get('fg', '#e0e0e0'))
            return None
        else:
            if self._is_running:
                self._stop_flag.set()
                self._set_buttons(running=False)
            self._content_frame.pack_forget()
            self._invalidate_exporter_voice_track()
            return None

    def _populate_voices(self):
        engine = self._get_engine_key()
        if engine == 'edge':
            voices = []
            for _lc in LANG_LABELS:
                voices.extend(EDGE_VOICES.get(_lc, []))
        elif engine == 'vbee':
            voices = VBEE_VOICES
        elif engine == 'fpt':
            voices = FPT_VOICES
        elif engine == 'elevenlabs':
            voices = ELEVENLABS_VOICES
        elif engine == 'minimax':
            voices = MINIMAX_VOICES
        elif engine == 'zalo':
            voices = ZALO_VOICES
        elif engine == 'siliconflow':
            voices = SILICONFLOW_VOICES
        elif engine == 'capcut':
            voices = CAPCUT_VOICES
        elif engine == 'ngochuyen':
            from .engines_ngochuyen import _api_fetch_done
            _nh_done = _api_fetch_done
            from .engines_ngochuyen import _get_ngochuyen_model_dir
            _get_ngochuyen_model_dir = _get_ngochuyen_model_dir
            if _nh_done:
                voices = scan_ngochuyen_voices()
            else:
                _local = [(f.stem, f.stem) for f in sorted(_get_ngochuyen_model_dir().glob('*.onnx'))]
                f = f
                voices = NGOCHUYEN_VOICES

                def _bg_nh():
                    try:
                        result = scan_ngochuyen_voices()
                    except Exception:
                        pass
                    else:

                        def _upd(r=result):
                            try:
                                if not self.winfo_exists():
                                    pass
                            except Exception:
                                pass
                            try:
                                return None
                            except:
                                lbl = var
                                _ = var
                        self.after(0, _upd)
                    return None
                threading.Thread(target=_bg_nh, daemon=True).start()
        elif engine == 'supertonic':
            voices = SUPERTONIC_VOICES
        elif engine == 'kokoro':
            voices = KOKORO_VOICES
        elif engine == 'tiktok':
            voices = TIKTOK_VOICES
        else:
            from .longtieng_voices import scan_vienew_voices
            scan_vienew_voices = scan_vienew_voices
            voices = scan_vienew_voices()
        labels = [label for item in voices]
        _ = _
        label = label
        self._voice_cb['values'] = labels
        _cur = self._voice_var.get()
        _picked = None
        _lv = EDGE_VOICES.get(self._lang_var.get(), [])
        _picked = _lv[0][1]
        if not _picked is not None and engine == 'capcut':
            if 'Chí Mai (Vi)' in labels:
                _picked = 'Chí Mai (Vi)'
        if _picked is None:
            for pref in ('Ngọc Huyền', 'TV Hay', 'Vĩnh', 'Nam Minh', 'Hoài My'):
                if not pref in labels:
                    continue
                else:
                    _picked = pref
                    break
        if _picked is None:
            _picked = labels[0]
        self._voice_var.set(_picked)
        return None
        return None
        try:
            return None
        except:
            try:
                if Exception:
                    voices = NGOCHUYEN_VOICES
            except:
                pass
            try:
                if Exception:
                    voices = NGOCHUYEN_VOICES
            except:
                pass
            try:
                if Exception:
                    voices = VIENEW_VOICES
            except:
                pass

    def _get_engine_key(self):
        label = self._engine_var.get()
        for key, lbl in ENGINE_LABELS:
            if not lbl == label:
                continue
            return var
        return 'edge'

    def _get_voice_id(self):
        engine = self._get_engine_key()
        label = self._voice_var.get()
        if engine == 'edge':
            lang = self._lang_var.get()
            for vid, vlabel in EDGE_VOICES.get(lang, []):
                if not vlabel == label:
                    continue
                return var
            for _lc, _voices in EDGE_VOICES.items():
                for vid, vlabel in _voices:
                    if not vlabel == label:
                        continue
                    self._set_lang_code(_lc)
                    return var
            return 'vi-VN-HoaiMyNeural'
        elif engine == 'vbee':
            for vid, vlabel in VBEE_VOICES:
                if not vlabel == label:
                    continue
                return var
            if VBEE_VOICES:
                return VBEE_VOICES[0][0]
            else:
                return ''
        elif engine == 'fpt':
            for vid, vlabel in FPT_VOICES:
                if not vlabel == label:
                    continue
                return var
            if FPT_VOICES:
                return FPT_VOICES[0][0]
            else:
                return ''
        elif engine == 'elevenlabs':
            for vid, vlabel in ELEVENLABS_VOICES:
                if not vlabel == label:
                    continue
                return var
            if ELEVENLABS_VOICES:
                return ELEVENLABS_VOICES[0][0]
            else:
                return ''
        elif engine == 'minimax':
            for vid, vlabel in MINIMAX_VOICES:
                if not vlabel == label:
                    continue
                return var
            if MINIMAX_VOICES:
                return MINIMAX_VOICES[0][0]
            else:
                return ''
        elif engine == 'zalo':
            for vid, vlabel in ZALO_VOICES:
                if not vlabel == label:
                    continue
                return var
            if ZALO_VOICES:
                return ZALO_VOICES[0][0]
            else:
                return ''
        elif engine == 'siliconflow':
            for vid, vlabel in SILICONFLOW_VOICES:
                if not vlabel == label:
                    continue
                return var
            if SILICONFLOW_VOICES:
                return SILICONFLOW_VOICES[0][0]
            else:
                return ''
        elif engine == 'capcut':
            for vid, vlabel in CAPCUT_VOICES:
                if not vlabel == label:
                    continue
                return var
            if CAPCUT_VOICES:
                return CAPCUT_VOICES[0][0]
            else:
                return ''
        elif engine == 'ngochuyen':
            _nh_voices = scan_ngochuyen_voices()
            for vid, vlabel in _nh_voices:
                if not vlabel == label:
                    continue
                return var
            if _nh_voices:
                return _nh_voices[0][0]
            else:
                return 'calmwoman3688'
        elif engine == 'supertonic':
            for vid, vlabel in SUPERTONIC_VOICES:
                if not vlabel == label:
                    continue
                return var
            if SUPERTONIC_VOICES:
                return SUPERTONIC_VOICES[0][0]
            else:
                return ''
        elif engine == 'kokoro':
            for vid, vlabel in KOKORO_VOICES:
                if not vlabel == label:
                    continue
                return var
            if KOKORO_VOICES:
                return KOKORO_VOICES[0][0]
            else:
                return ''
        elif engine == 'tiktok':
            for vid, vlabel in TIKTOK_VOICES:
                if not vlabel == label:
                    continue
                return var
            if TIKTOK_VOICES:
                return TIKTOK_VOICES[0][0]
            else:
                return ''
        else:
            for vid, vlabel in VIENEW_VOICES:
                if not vlabel == label:
                    continue
                return var
            if VIENEW_VOICES:
                return VIENEW_VOICES[0][0]
            else:
                try:
                    return ''
                except:
                    try:
                        if Exception:
                            _nh_voices = NGOCHUYEN_VOICES
                    except:
                        pass
    _APIKEY_PH = 'Có sẵn Key Admin - Nếu lỗi nhập key của bạn'

    def _show_apikey_placeholder(self):
        self._apikey_ph_active = True
        self._apikey_var.set(self._APIKEY_PH)
        self._apikey_entry.config(show='', fg='#6b7280')
        return None

    def _hide_apikey_placeholder(self):
        if self._apikey_ph_active:
            self._apikey_ph_active = False
            self._apikey_var.set('')
            org = self._C.get('orange', '#f97316')
            self._apikey_entry.config(show='•', fg=org)
            return None
        else:
            return None

    def _on_apikey_focus_in(self, _event=None):
        if self._apikey_ph_active:
            self._hide_apikey_placeholder()
            return None
        else:
            return None

    def _on_apikey_focus_out(self, _event=None):
        if not self._apikey_var.get().strip():
            engine = self._get_engine_key()
            if engine in ('elevenlabs', 'fpt', 'zalo', 'siliconflow'):
                self._show_apikey_placeholder()
                return None
            else:
                return None
        else:
            return None

    def _toggle_apikey_show(self):
        if self._apikey_ph_active:
            return None
        else:
            self._apikey_visible = not self._apikey_visible
            self._apikey_entry.config(show='' if self._apikey_visible else '•')
            self._btn_show_key.config(text='🔒' if self._apikey_visible else '👁')
            return None

    def _toggle_vbee_show(self):
        self._vbee_visible = not self._vbee_visible
        s = '' if self._vbee_visible else '•'
        self._vbee_appid_entry.config(show=s)
        self._vbee_token_entry.config(show=s)
        self._btn_vbee_show.config(text='🔒' if self._vbee_visible else '👁')
        return None

    def _clear_user_apikey(self):
        engine = self._get_engine_key()
        if engine == 'vbee':
            self._vbee_appid_var.set('')
            self._vbee_token_var.set('')
            self._save_vbee_apikey()
            return None
        else:
            self._apikey_var.set('')
            if engine == 'elevenlabs':
                self._save_elevenlabs_apikey()
                self._save_proxy()
                self._show_apikey_placeholder()
                return None
            elif engine == 'fpt':
                self._save_fpt_apikey()
                self._show_apikey_placeholder()
                return None
            elif engine == 'minimax':
                self._save_minimax_apikey()
                self._show_apikey_placeholder()
                return None
            elif engine == 'zalo':
                self._save_zalo_apikey()
                self._show_apikey_placeholder()
                return None
            elif engine == 'siliconflow':
                self._save_siliconflow_apikey()
                self._show_apikey_placeholder()
                return None
            else:
                return None

    def _update_key_placeholder(self):
        return None

    def _get_vbee_combined_key(self):
        a = self._vbee_appid_var.get().strip()
        t = self._vbee_token_var.get().strip()
        if a and t:
            return f'{a}|{t}'
        return a or ''

    def _test_apikey(self):
        import threading
        engine = self._get_engine_key()
        if engine == 'vbee':
            key = self._get_vbee_combined_key()
            test_btn = self._btn_vbee_test
        else:
            _raw = self._apikey_var.get().strip()
            key = '' if getattr(self, '_apikey_ph_active', False) or _raw == self._APIKEY_PH else _raw
            test_btn = self._btn_test_key
        if not key:
            self._show_key_result(False, 'Chưa nhập API Key')
            return None
        else:
            if engine == 'vbee':
                self._apikey_var.set(key)
                self._save_vbee_apikey()
            elif engine == 'elevenlabs':
                self._save_elevenlabs_apikey()
                self._save_proxy()
            elif engine == 'fpt':
                self._save_fpt_apikey()
            elif engine == 'minimax':
                self._save_minimax_apikey()
            elif engine == 'zalo':
                self._save_zalo_apikey()
            elif engine == 'siliconflow':
                self._save_siliconflow_apikey()
            test_btn.config(text='⏳', fg='#eab308')
            self._apikey_status_label.config(text='Đang kiểm tra...', fg='#eab308')
            after_row = self._r_vbee_key if engine == 'vbee' else self._r_apikey
            self._r_apikey_status.pack(fill='x', pady=0, after=after_row)
            threading.Thread(target=self._validate_key_bg, args=(engine, key), daemon=True).start()
            return None

    def _validate_key_bg(self, engine, key):
        import urllib_request as urllib
        import urllib_error as urllib
        import urllib_parse as urllib
        import json
        ok = False
        msg = ''
        try:
            if engine == 'fpt':
                req = urllib.request.Request('https://api.fpt.ai/hmi/tts/v5', data='test'.encode('utf-8'), headers={'api-key': key, 'Content-Type': 'application/x-www-form-urlencoded'})
                resp = urllib.request.urlopen(req, timeout=10)
                ok = resp.status == 200
            elif engine == 'elevenlabs':
                req = urllib.request.Request('https://api.elevenlabs.io/v1/user', headers={'xi-api-key': key})
                resp = urllib.request.urlopen(req, timeout=10)
                ok = resp.status == 200
            elif engine == 'vbee':
                parts = key.split('|', 1)
                if len(parts) != 2:
                    msg = '✗ Sai định dạng — cần APP_ID và Token'
                else:
                    resp = var
                    rdata = json.loads(resp.read().decode())
                    if rdata.get('error_code'):
                        ok = False
                        msg = f'✗ {rdata.get('error_message', 'Key không hợp lệ')}'
                    else:
                        ok = True
            else:
                body = json.dumps({'model': 'speech-2.8-hd', 'text': 'xin chào', 'stream': False, 'voice_setting': {'voice_id': 'Vietnamese_Female_Sweetie', 'speed': 1.0}, 'audio_setting': {'format': 'hex', 'sample_rate': 32000}}).encode('utf-8')
                req = urllib.request.Request('https://api.minimaxi.com/v1/t2a_v2', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
                resp = urllib.request.urlopen(req, timeout=15)
                rdata = json.loads(resp.read().decode())
                if rdata.get('base_resp', {}).get('status_code', 0) != 0:
                    ok = False
                    msg = f'✗ {rdata.get('base_resp', {}).get('status_msg', 'Key không hợp lệ')}'
                else:
                    ok = True
                post_data = urllib.parse.urlencode({'input': 'xin chào', 'speaker_id': '1', 'speed': '1', 'encode_type': '1', 'quality': '0'}).encode('utf-8')
                req = urllib.request.Request('https://api.zalo.ai/v1/tts/synthesize', data=post_data, headers={'apikey': key})
                resp = urllib.request.urlopen(req, timeout=15)
                rdata = json.loads(resp.read().decode())
                if rdata.get('error_code', -1) != 0:
                    ok = False
                    msg = f'✗ {rdata.get('error_message', 'Key không hợp lệ')}'
                else:
                    ok = True
                body = json.dumps({'model': 'fishaudio/fish-speech-1.5', 'input': 'hello', 'voice': 'fishaudio/fish-speech-1.5:alex', 'response_format': 'mp3', 'stream': False}).encode('utf-8')
                req = urllib.request.Request('https://api.siliconflow.com/v1/audio/speech', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
                resp = urllib.request.urlopen(req, timeout=15)
                ct = resp.headers.get('Content-Type', '')
                if 'audio' in ct or 'octet' in ct:
                    ok = True
                else:
                    ok = False
                    msg = '✗ Key không hợp lệ'
        except urllib.error.HTTPError as e:
            ok = False
            try:
                err_body = json.loads(e.read().decode())
                msg = f'✗ {err_body.get('message', err_body.get('error_message', 'Key không hợp lệ'))}'
            except Exception:
                msg = f'✗ Lỗi {e.code} — Key không hợp lệ'
                e = None
                del e
            e = None
            del e
        except Exception:
            ok = False
        self.after(0, lambda: self._show_key_result(ok, msg))
        return None

    def _show_key_result(self, ok, msg=''):
        engine = self._get_engine_key()
        is_vbee = engine == 'vbee'
        test_btn = self._btn_vbee_test if is_vbee else self._btn_test_key
        after_row = self._r_vbee_key if is_vbee else self._r_apikey
        org = self._C.get('orange', '#f97316')
        if ok:
            test_btn.config(text='✓', fg='#22c55e')
            if is_vbee:
                self._vbee_appid_entry.config(fg='#22c55e')
                self._vbee_token_entry.config(fg='#22c55e')
            else:
                self._apikey_entry.config(fg='#22c55e')
            self._apikey_status_label.config(text=msg or '✓ Key hợp lệ — sẵn sàng sử dụng', fg='#22c55e')
        else:
            test_btn.config(text='✗', fg='#ef4444')
            if is_vbee:
                self._vbee_appid_entry.config(fg='#ef4444')
                self._vbee_token_entry.config(fg='#ef4444')
            else:
                self._apikey_entry.config(fg='#ef4444')
            self._apikey_status_label.config(text=msg or '✗ Key không hợp lệ — kiểm tra lại', fg='#ef4444')
        self._r_apikey_status.pack(fill='x', pady=0, after=after_row)
        self.after(5000, lambda: (test_btn.config(text='✓', fg='#22c55e'), self._vbee_appid_entry.config(fg=org) if is_vbee else None, self._vbee_token_entry.config(fg=org) if is_vbee else None, self._apikey_entry.config(fg=org) if not is_vbee else None, self._r_apikey_status.pack_forget()))
        return None
    _VBEE_XOR_KEY = b'VinhKaTools2026!'

    @staticmethod
    def _xor_bytes(data, key):
        return bytes((b ^ key[i % len(key)] for i, b in enumerate(data)))

    @staticmethod
    def _dpapi_encrypt(data):
        import ctypes
        import ctypes_wintypes as ctypes

        class _BLOB(ctypes.Structure):
            _fields_ = ['pbData', (var(), ctypes.POINTER(var(), ctypes.c_char))]
        bi = _BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data, len(data)), ctypes.POINTER(ctypes.c_char)))
        bo = _BLOB()
        if ctypes.windll.crypt32.CryptProtectData(ctypes.byref(bi), None, None, None, None, 0, ctypes.byref(bo)):
            result = ctypes.string_at(bo.pbData, bo.cbData)
            ctypes.windll.kernel32.LocalFree(bo.pbData)
            return result
        else:
            raise OSError('DPAPI encrypt failed')

    @staticmethod
    def _dpapi_decrypt(data):
        import ctypes
        import ctypes_wintypes as ctypes

        class _BLOB(ctypes.Structure):
            _fields_ = ['pbData', (var(), ctypes.POINTER(var(), ctypes.c_char))]
        bi = _BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data, len(data)), ctypes.POINTER(ctypes.c_char)))
        bo = _BLOB()
        if ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(bi), None, None, None, None, 0, ctypes.byref(bo)):
            result = ctypes.string_at(bo.pbData, bo.cbData)
            ctypes.windll.kernel32.LocalFree(bo.pbData)
            return result
        else:
            raise OSError('DPAPI decrypt failed')

    def _save_key_dpapi(self, key, path):
        import base64
        try:
            if key:
                encrypted = self._dpapi_encrypt(key.encode('utf-8'))
                f = open(path, 'w', encoding='utf-8')
                f.write('DPAPI:' + base64.b64encode(encrypted).decode('ascii'))
        except Exception:
            import base64
            _b64 = base64
            encoded = _b64.b64encode(self._xor_bytes(key.encode('utf-8'), self._VBEE_XOR_KEY)).decode('ascii')
            with open(path, 'w', encoding='utf-8'):
                f = var
                f.write(encoded)
        return None

    def _load_key_dpapi(self, path, legacy_xor_key):
        import base64
        if not os.path.exists(path):
            return ''
        else:
            with open(path, 'r', encoding='utf-8'):
                f = var
                raw = f.read().strip()
            while True:
                if not raw:
                    return ''
                encrypted = base64.b64decode(raw[6:])
                try:
                    return self._dpapi_decrypt(encrypted).decode('utf-8')
                except:
                    decoded = base64.b64decode(raw)
                    key = self._xor_bytes(decoded, legacy_xor_key).decode('utf-8')
                    if key:
                        self._save_key_dpapi(key, path)
                return key
            try:
                if Exception:
                    pass
            except:
                pass

    def _get_vbee_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.vbee_key')

    def _load_key_from_disk(self, engine):
        if engine == 'vbee':
            path = self._get_vbee_key_path()
            xor_key = self._VBEE_XOR_KEY
        elif engine == 'elevenlabs':
            path = self._get_elevenlabs_key_path()
            xor_key = self._EL_XOR_KEY
        elif engine == 'fpt':
            path = self._get_fpt_key_path()
            xor_key = self._FPT_XOR_KEY
        else:
            return ''
        return self._load_key_dpapi(path, xor_key)

    def _load_vbee_apikey(self):
        key = self._load_key_dpapi(self._get_vbee_key_path(), self._VBEE_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_vbee_apikey(self):
        key = self._get_vbee_combined_key()
        self._save_key_dpapi(key, self._get_vbee_key_path())
        return None

    @staticmethod
    def _get_el_builtin_keys():
        try:
            from config import BUNDLED_EL_KEYS
            BUNDLED_EL_KEYS = BUNDLED_EL_KEYS
        except ImportError:
            return ''
        return '|'.join(BUNDLED_EL_KEYS)

    @staticmethod
    def _get_minimax_builtin_key():
        try:
            from config import BUNDLED_MINIMAX_KEY
            BUNDLED_MINIMAX_KEY = BUNDLED_MINIMAX_KEY
        except ImportError:
            return ''
        return BUNDLED_MINIMAX_KEY

    @staticmethod
    def _get_zalo_builtin_key():
        try:
            from config import BUNDLED_ZALO_KEY
            BUNDLED_ZALO_KEY = BUNDLED_ZALO_KEY
        except ImportError:
            return ''
        return BUNDLED_ZALO_KEY

    @staticmethod
    def _get_siliconflow_builtin_key():
        try:
            from config import BUNDLED_SILICONFLOW_KEY
            BUNDLED_SILICONFLOW_KEY = BUNDLED_SILICONFLOW_KEY
        except ImportError:
            return ''
        return BUNDLED_SILICONFLOW_KEY
    _EL_XOR_KEY = b'ElevenLabsVK2026'
    _FPT_XOR_KEY = b'FptAiVK2026!Key'

    def _get_elevenlabs_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.elevenlabs_key')

    def _load_elevenlabs_apikey(self):
        key = self._load_key_dpapi(self._get_elevenlabs_key_path(), self._EL_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_elevenlabs_apikey(self):
        key = self._apikey_var.get().strip()
        self._save_key_dpapi(key, self._get_elevenlabs_key_path())
        return None

    def _get_proxy_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.elevenlabs_proxy')

    def _load_proxy(self):
        p = self._get_proxy_path()
        if os.path.isfile(p):
            return open(p, 'r', encoding='utf-8').read().strip()
        else:
            try:
                return ''
            except:
                try:
                    if Exception:
                        pass
                except:
                    pass

    def _save_proxy(self):
        proxy = self._proxy_var.get().strip()
        p = self._get_proxy_path()
        try:
            if proxy:
                f = open(p, 'w', encoding='utf-8')
                f.write(proxy)
        except Exception:
            pass
        return None

    def _get_relay_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.elevenlabs_relay')

    def _load_relay(self):
        p = self._get_relay_path()
        if os.path.isfile(p):
            lines = open(p, 'r', encoding='utf-8').read().strip().splitlines()
            url = lines[0].strip() if lines else ''
            secret = lines[1].strip() if len(lines) > 1 else ''
            if url:
                return (url, secret)
        try:
            from config import EL_RELAY_URL
            EL_RELAY_URL = EL_RELAY_URL
            from config import EL_RELAY_SECRET
            EL_RELAY_SECRET = EL_RELAY_SECRET
        except (ImportError, AttributeError):
            return ('', '')
        return (EL_RELAY_URL, EL_RELAY_SECRET)

    def _save_relay(self):
        url = self._relay_var.get().strip()
        secret = self._relay_secret_var.get().strip()
        p = self._get_relay_path()
        try:
            if url:
                f = open(p, 'w', encoding='utf-8')
                f.write(url + '\n' + secret)
        except Exception:
            pass
        return None

    def _on_relay_url_change(self, *_args):
        url = self._relay_var.get().strip()
        if url:
            self._r_relay_secret.pack(fill='x', pady=(2, 2), after=self._r_relay)
            return None
        else:
            self._r_relay_secret.pack_forget()
            try:
                return None
            except:
                try:
                    if Exception:
                        pass
                except:
                    pass

    def _get_fpt_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.fpt_key')

    def _load_fpt_apikey(self):
        key = self._load_key_dpapi(self._get_fpt_key_path(), self._FPT_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_fpt_apikey(self):
        key = self._apikey_var.get().strip()
        self._save_key_dpapi(key, self._get_fpt_key_path())
        return None

    def _get_minimax_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.minimax_key')

    def _load_minimax_apikey(self):
        key = self._load_key_dpapi(self._get_minimax_key_path(), self._FPT_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_minimax_apikey(self):
        key = self._apikey_var.get().strip()
        self._save_key_dpapi(key, self._get_minimax_key_path())
        return None

    def _get_zalo_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.zalo_key')

    def _load_zalo_apikey(self):
        key = self._load_key_dpapi(self._get_zalo_key_path(), self._FPT_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_zalo_apikey(self):
        key = self._apikey_var.get().strip()
        self._save_key_dpapi(key, self._get_zalo_key_path())
        return None

    def _get_siliconflow_key_path(self):
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base, '.siliconflow_key')

    def _load_siliconflow_apikey(self):
        key = self._load_key_dpapi(self._get_siliconflow_key_path(), self._FPT_XOR_KEY)
        if key:
            self._apikey_var.set(key)
            return None
        else:
            return None

    def _save_siliconflow_apikey(self):
        key = self._apikey_var.get().strip()
        self._save_key_dpapi(key, self._get_siliconflow_key_path())
        return None

    def _on_engine_change(self, _event=None):
        engine = self._get_engine_key()
        self._r_apikey_status.pack_forget()
        org = self._C.get('orange', '#f97316')
        self._apikey_entry.config(fg=org)
        self._vbee_appid_entry.config(fg=org)
        self._vbee_token_entry.config(fg=org)
        self._btn_test_key.config(text='✓', fg='#22c55e')
        self._btn_vbee_test.config(text='✓', fg='#22c55e')
        self._r_vbee_key.pack_forget()
        self._r_proxy.pack_forget()
        self._r_relay.pack_forget()
        self._r_relay_secret.pack_forget()
        if engine == 'edge':
            self._lang_cb['values'] = list(LANG_LABELS.values())
            if (self._lang_var.get() or 'vi').lower() not in LANG_LABELS:
                self._set_lang_code('vi')
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_engine)
        elif engine == 'vbee':
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._vbee_appid_var.set('')
            self._vbee_token_var.set('')
            self._r_vbee_key.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_vbee_key)
        elif engine == 'elevenlabs':
            self._r_lang.pack_forget()
            self._apikey_label.config(text='API Key:')
            self._apikey_var.set('')
            self._apikey_ph_active = False
            self._load_elevenlabs_apikey()
            if not self._apikey_var.get().strip():
                self._show_apikey_placeholder()
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine == 'fpt':
            self._r_lang.pack_forget()
            self._apikey_label.config(text='API Key:')
            self._apikey_var.set('')
            self._apikey_ph_active = False
            self._load_fpt_apikey()
            if not self._apikey_var.get().strip():
                self._show_apikey_placeholder()
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine == 'minimax':
            self._r_lang.pack_forget()
            self._apikey_label.config(text='API Key:')
            self._apikey_var.set('')
            self._apikey_ph_active = False
            self._load_minimax_apikey()
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine == 'zalo':
            self._r_lang.pack_forget()
            self._apikey_label.config(text='API Key:')
            self._apikey_var.set('')
            self._apikey_ph_active = False
            self._load_zalo_apikey()
            if not self._apikey_var.get().strip():
                self._show_apikey_placeholder()
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine == 'siliconflow':
            self._r_lang.pack_forget()
            self._apikey_label.config(text='API Key:')
            self._apikey_var.set('')
            self._apikey_ph_active = False
            self._load_siliconflow_apikey()
            if not self._apikey_var.get().strip():
                self._show_apikey_placeholder()
            self._r_apikey.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_apikey)
        elif engine == 'capcut':
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_engine)
        elif engine == 'ngochuyen':
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_engine)
        elif engine == 'supertonic':
            self._lang_cb['values'] = list(SUPERTONIC_LANG_LABELS.values())
            _cur_lang = 'en'
            _ref = getattr(self, '_exporter_ref', None)
            if _ref is not None:
                _has_sub = bool((getattr(_ref, '_sub_srt_path', '') or '').strip())
                if _has_sub:
                    _tgt = (_ref.sub_target_lang.get() or '').lower()
                    if _tgt in SUPERTONIC_LANG_LABELS:
                        _cur_lang = _tgt
            self._set_lang_code(_cur_lang)
            self._r_apikey.pack_forget()
            self._r_model.pack_forget()
            self._r_lang.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_lang)
        elif engine in ('kokoro', 'tiktok'):
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._r_model.pack_forget()
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_engine)
        else:
            self._r_lang.pack_forget()
            self._r_apikey.pack_forget()
            self._r_model.pack(fill='x', pady=(2, 2), after=self._r_engine)
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_model)
        self._populate_voices()
        self._on_model_change()
        self._clear_voice_results_on_setting_change()
        try:
            return None
        except:
            try:
                if Exception:
                    pass
            except:
                pass

    def _on_model_change(self, _event=None):
        label = self._model_var.get()
        if 'ngọc huyền' in label.lower():
            self._r_voice.pack_forget()
            return None
        elif not self._r_voice.winfo_ismapped():
            self._r_voice.pack(fill='x', pady=(2, 2), after=self._r_model)
            return None
        else:
            return None

    @staticmethod
    def _lang_pref_path():
        _appdir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Local')), 'TDT')
        os.makedirs(_appdir, exist_ok=True)
        return os.path.join(_appdir, 'lang_engine_pref.json')

    def _load_lang_engine_pref(self):
        import json as _json
        with open(self._lang_pref_path(), 'r', encoding='utf-8'):
            f = var
        return _json.load(f)

    def _save_lang_engine_pref(self):
        import json as _json
        with open(self._lang_pref_path(), 'w', encoding='utf-8'):
            f = var
            _json.dump(self._lang_engine_map, f, ensure_ascii=False, indent=2)
        return None

    def save_lang_engine(self, lang, engine_label, voice_label):
        if not lang:
            return None
        else:
            self._lang_engine_map[lang.lower()] = {'engine_label': engine_label, 'voice_label': voice_label}
            self._save_lang_engine_pref()
            return None

    def _restore_engine_for_lang(self, lang):
        _map = self._lang_engine_map
        saved = _map.get((lang or '').lower())
        if not saved:
            return None
        else:
            _elabel = saved.get('engine_label', '')
            _vlabel = saved.get('voice_label', '')
            if not _elabel:
                return None
            else:
                try:
                    if self._engine_var.get() != _elabel:
                        self._engine_var.set(_elabel)
                        self._on_engine_change()
                    if _vlabel:
                        if self._voice_var.get() != _vlabel:
                            self._voice_var.set(_vlabel)
                except Exception:
                    pass
                return None

    def _set_lang_code(self, code):
        code = code or 'vi'
        self._lang_var.set(code)
        try:
            _lbl = SUPERTONIC_LANG_LABELS.get(code) or LANG_LABELS.get(code, code)
            self._lang_display_var.set(_lbl)
        except Exception:
            pass
        return None

    def _on_lang_change(self, _event=None):
        _label = self._lang_display_var.get()
        new_lang = next((c for c, l in {**LANG_LABELS, **SUPERTONIC_LANG_LABELS}.items() if not not l == _label), 'vi').lower()
        self._lang_var.set(new_lang)
        if self._get_engine_key() != 'supertonic':
            self._restore_engine_for_lang(new_lang)
        self._populate_voices()
        try:
            if self._get_engine_key() == 'edge':
                _voices_lang = EDGE_VOICES.get(new_lang, [])
                if _voices_lang:
                    _cur = self._voice_var.get()
                    if not any((lbl == _cur for _, lbl in _voices_lang)):
                        self._voice_var.set(_voices_lang[0][1])
        except Exception:
            pass
        self._clear_voice_results_on_setting_change()
        return None

    def _sync_btn_colors(self):
        if not _HAS_WIDGETS:
            return None
        else:
            dim_color = '#555555'
            red = self._C.get('red', '#ef4444')
            self._btn_gen._bg = '#0ea5e9' if self._btn_gen_enabled else dim_color
            self._btn_gen._hover = self._btn_gen._darken(self._btn_gen._bg)
            self._btn_gen.draw()
            self._btn_gen.config(cursor='hand2' if self._btn_gen_enabled else '')
            self._btn_stop._bg = red
            self._btn_stop._hover = self._btn_stop._darken(red)
            self._btn_stop.draw()
            self._btn_stop.config(cursor='hand2' if self._btn_stop_enabled else '')
            return None

    @staticmethod
    def _validate_speed(value):
        if value in ('', '.'):
            return True
        else:
            try:
                if 0.0 <= float(value):
                    pass
            except ValueError:
                return False
            return var

    def _log(self, msg, color=''):
        if self._log_cb:
            self._log_cb(msg)
        self._set_status(msg, color)
        return None

    def _set_status(self, msg, color=''):
        self._status_var.set(msg)
        self._status_lbl.config(fg=color or self._C.get('dim', '#888888'))
        return None

    def _set_buttons(self, running):
        self._is_running = running
        self._btn_gen_enabled = not running
        self._btn_stop_enabled = running
        if _HAS_WIDGETS:
            self._sync_btn_colors()
            gen_cmd = self._start_tts if not running else lambda: None
            stop_cmd = self._stop_tts if running else lambda: [1, None][-1]
            self._btn_gen.command = gen_cmd
            self._btn_stop.command = stop_cmd
            self._btn_test.config(cursor='' if running else 'hand2')
            return None
        else:
            s = 'disabled' if running else 'normal'
            self._btn_gen.config(state=s)
            self._btn_stop.config(state='normal' if running else 'disabled')
            self._btn_test.config(state='disabled' if running else 'normal')
            return None

    def load_srt_segments_for_video(self, video_path):
        import glob as _glob
        from pathlib import Path
        try:
            _pref = (self._lang_var.get() or 'vi').lower()
        except Exception:
            _pref = 'vi'
        _vid_stem = os.path.splitext(video_path)[0]
        _srt_folder = Path(video_path).parent / 'Phụ Đề SRT'
        _v_stem = Path(video_path).stem
        _pref_sub_name = f'_sub_{_pref}.srt'
        _pref_suffix = f'_{_pref}.srt'
        _esc_v_stem = _glob.escape(_v_stem)
        _esc_vid_stem = _glob.escape(_vid_stem)
        _tier_preferred = []
        _tier_other_trans = []
        _tier_origin = []
        if _srt_folder.is_dir():
            _tier_preferred += [str(_srt_folder / f'{_v_stem}_sub_{_pref}.srt'), str(_srt_folder / f'{_v_stem}_{_pref}.srt')]
            _tier_other_trans += sorted((str(p) for p in _srt_folder.glob(f'{_esc_v_stem}_sub_*.srt') if not p.name.endswith(_pref_sub_name)))
            _tier_other_trans += sorted((str(p) for p in _srt_folder.glob(f'{_esc_v_stem}_??.srt') if not p.name.endswith(_pref_suffix)))
            _tier_origin += [str(_srt_folder / f'{_v_stem}_capcut.srt'), str(_srt_folder / f'{_v_stem}_sub.srt'), str(_srt_folder / f'{_v_stem}.srt')]
        _tier_preferred += [_vid_stem + f'_sub_{_pref}.srt', _vid_stem + f'_{_pref}.srt']
        _tier_other_trans += sorted((p for p in _glob.glob(_esc_vid_stem + '_sub_*.srt') if not p.endswith(_pref_sub_name)))
        _tier_other_trans += sorted((p for p in _glob.glob(_esc_vid_stem + '_??.srt') if not p.endswith(_pref_suffix)))
        _tier_origin += [_vid_stem + '_capcut.srt', _vid_stem + '_sub.srt', _vid_stem + '.srt']
        _candidates = _tier_preferred + _tier_other_trans + _tier_origin
        _found = next((p for p in _candidates if not not os.path.getsize(p) > 10), None)
        try:
            if not _found:
                return []
            else:
                _found_stem = Path(_found).stem
                if _found_stem != _v_stem and (not _found_stem.startswith(_v_stem + '_')):
                    return []
                f = open(_found, 'r', encoding='utf-8')
                srt_text = f.read()
                return self._parse_srt(srt_text)
        except:
            try:
                if not var:
                    pass
            except:
                pass
            try:
                if Exception:
                    pass
            except:
                pass

    @staticmethod
    def _parse_srt(srt_text):
        import re
        segments = []
        blocks = srt_text.strip().split('\n\n')
        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue
            m = re.match('(\\d{1,2}:\\d{2}:\\d{2}[.,]\\d{1,3})\\s*-->\\s*(\\d{1,2}:\\d{2}:\\d{2}[.,]\\d{1,3})', lines[1])
            if not m:
                continue
            else:
                end_str = m.group(2)
                start_str = m.group(1)

                def _to_sec(s):
                    s = s.replace(',', '.')
                    h, m, sec = s.split(':')
                    return int(h) * 3600 + int(m) * 60 + float(sec)
                text = '\n'.join(lines[2:]).strip()
                segments.append({'start_sec': _to_sec(start_str), 'end_sec': _to_sec(end_str), 'start': start_str.replace(',', '.'), 'end': end_str.replace(',', '.'), 'text': text})
        return segments

    def set_segments(self, segments):
        self._segments = segments or []
        n = len(self._segments)
        self._progress_var.set(0)
        if n:
            self._set_status(f'Sẵn sàng — {n} đoạn phụ đề.', self._C.get('fg', '#e0e0e0'))
            return None
        else:
            self._set_status('Chưa có phụ đề — hãy tạo Sub trước.')
            return None

    def is_enabled(self):
        return bool(self._lt_enabled_var.get())

    def get_voice_results(self):
        return list(self._voice_results)

    def set_voice_results(self, results):
        self._voice_results = results
        return None

    def _on_tts_fit_changed(self, _val=None):
        try:
            pct = int(self._tts_fit_pct.get())
        except Exception:
            pct = 50
        _label = 'Tăng tốc audio TTS' if pct >= 100 else 'Kéo dài video theo TTS'
        if pct <= 0:
            _h = '0% · giữ giọng'
        elif pct >= 100:
            _h = '100% · nén khít'
        elif pct < 40:
            _h = f'{pct}% · giãn video'
        elif pct < 75:
            _h = f'{pct}% · cân bằng'
        else:
            _h = f'{pct}% · tăng tốc'
        self._tts_fit_var.set(_label)
        self._tts_fit_hint.config(text=_h)
        try:
            if _label != self._last_tts_fit_mode:
                self._last_tts_fit_mode = _label
                self._invalidate_exporter_voice_track()
                if getattr(self, '_log_cb', None):
                    _mn = 'Kéo dài video' if pct < 100 else 'Tăng tốc audio (nén khít)'
                    self._log_cb(f'🔄 Khớp TTS: {_mn} ({pct}%).')
                    return None
                else:
                    return None
            else:
                return None
        except:
            try:
                if Exception:
                    pass
            except:
                pass
            try:
                if Exception:
                    pass
            except:
                pass

    def _on_tts_fit_release(self, _e=None):
        try:
            pct = int(self._tts_fit_pct.get())
        except Exception:
            pass
        else:
            _gp = getattr(self, '_voice_results_gen_pct', None)
            if not _gp is None and pct != _gp:
                if getattr(self, '_voice_results', None):
                    self._voice_results = []
                    if getattr(self, '_log_cb', None):
                        self._log_cb(f'🔄 Đổi mức Khớp TTS ({_gp}%→{pct}%) — sẽ tạo lại giọng khi xuất.')
            self._invalidate_exporter_voice_track()
        try:
            return None
        except:
            try:
                if Exception:
                    pass
            except:
                pass

    def _get_tts_workers(self):
        val = self._tts_workers_var.get()
        if val == 'Tự động':
            return 0
        else:
            try:
                pass
            except (ValueError, tk.TclError):
                pass
            return max(1, int(val))

    def get_settings(self):
        try:
            speed = float(self._speed_var.get())
        except (ValueError, tk.TclError):
            speed = 1.0
        voice_id = self._get_voice_id()
        model_repo = self._get_model_repo()
        _engine = self._get_engine_key()
        if _engine == 'vbee':
            _user_key = self._get_vbee_combined_key()
        else:
            _raw = self._apikey_var.get().strip()
            _is_ph = getattr(self, '_apikey_ph_active', False) or _raw == self._APIKEY_PH
            _user_key = '' if _is_ph else _raw
        if _engine == 'elevenlabs':
            if _user_key:
                _final_key = _user_key + '|' + self._get_el_builtin_keys()
            else:
                _final_key = self._get_el_builtin_keys()
        elif _engine == 'fpt':
            _builtin_fpt = '|'.join(_FPT_FREE_KEYS)
            if _user_key:
                _final_key = _user_key + '|' + _builtin_fpt
            else:
                _final_key = _builtin_fpt
        elif _engine == 'minimax':
            _final_key = _user_key
        elif _engine == 'zalo':
            _builtin_zl = self._get_zalo_builtin_key()
            if _user_key:
                _final_key = _user_key
            else:
                _final_key = _builtin_zl
        elif _engine == 'siliconflow':
            _builtin_sf = self._get_siliconflow_builtin_key()
            if _user_key:
                _final_key = _user_key
            else:
                _final_key = _builtin_sf
        else:
            _final_key = _user_key
        from .longtieng_merge import stretch_pct_to_max_speed
        _fit_pct = int(self._tts_fit_pct.get())
        _fit_ms = round(stretch_pct_to_max_speed(_fit_pct), 3)
        settings = {'engine': _engine, 'voice': voice_id, 'lang': self._lang_var.get(), 'speed': round(max(0.1, min(3.0, speed)), 2), 'smart_voice': True, 'tts_fit_mode': 'stretch_video' if _fit_pct < 100 else 'speed_up_tts', 'tts_fit_pct': _fit_pct, 'tts_fit_max_speed': _fit_ms, 'bgm_file': self.get_bgm_file(), 'api_key': _final_key, 'model_repo': model_repo, 'ref_audio': getattr(self, '_ref_audio_full_path', ''), 'ref_text': self._ref_text_var.get().strip(), 'pitch_semitones': round(self._pitch_var.get(), 1), 'tts_workers': self._get_tts_workers()}
        from config import API_RELAY_URL, API_RELAY_SECRET
        if API_RELAY_URL:
            settings['relay_url'] = API_RELAY_URL
            settings['relay_secret'] = API_RELAY_SECRET
        try:
            return settings
        except:
            try:
                if Exception:
                    _fit_pct, _fit_ms = (25, 1.25)
            except:
                pass
            try:
                if (ImportError, AttributeError):
                    pass
            except:
                pass

    @staticmethod
    def _scan_bgm_presets():
        if getattr(sys, 'frozen', False):
            base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(sys.executable)))
        else:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        bgm_dir = os.path.join(base, 'assets', 'bgm')
        result = {}
        if os.path.isdir(bgm_dir):
            for f in sorted(os.listdir(bgm_dir)):
                if not f.lower().endswith(('.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac')):
                    continue
                else:
                    name = os.path.splitext(f)[0]
                    result[name] = os.path.join(bgm_dir, f)
        return result

    def _on_bgm_selected(self, _event=None):
        sel = self._bgm_var.get()
        if sel == '📂 Chọn file khác...':
            self._bgm_var.set('')
            self._browse_bgm()
            return None
        else:
            path = self._bgm_presets.get(sel, '')
            self._bgm_full_path = path
            self._sync_bgm_to_exporter(path)
            return None

    def _browse_bgm(self):
        path = filedialog.askopenfilename(title='Chọn nhạc nền', filetypes=[('Audio', '*.mp3 *.wav *.aac *.m4a *.ogg *.flac'), ('All', '*.*')])
        if path:
            self._bgm_var.set(os.path.basename(path))
            self._bgm_full_path = path
            self._sync_bgm_to_exporter(path)
            return None
        else:
            return None

    def _clear_bgm(self):
        self._bgm_var.set('')
        self._bgm_full_path = ''
        self._sync_bgm_to_exporter('')
        return None

    def _browse_ext_voice(self):
        path = filedialog.askopenfilename(title='Chọn file giọng đọc (bỏ qua TTS)', filetypes=[('Audio', '*.mp3 *.wav *.aac *.m4a *.ogg *.flac'), ('All', '*.*')])
        if path:
            self._ext_voice_var.set(os.path.basename(path))
            self._ext_voice_full_path = path
            self._invalidate_exporter_voice_track()
            return None
        else:
            return None

    def _clear_ext_voice(self):
        self._ext_voice_var.set('')
        self._ext_voice_full_path = ''
        self._invalidate_exporter_voice_track()
        return None

    def _clear_voice_results_on_setting_change(self):
        self._voice_results = []
        self._invalidate_exporter_voice_track()
        return None

    def _invalidate_exporter_voice_track(self):
        ref = getattr(self, '_exporter_ref', None)
        parent = self.master
        if not ref is not None and parent:
            while True:
                ref = parent
                parent = getattr(parent, 'master', None)
        if ref is not None:
            if hasattr(ref, 'invalidate_voice_track'):
                ref.invalidate_voice_track()
                if getattr(ref, '_is_playing', False):
                    import cv2
                    cv2 = cv2
                    pos = 0.0
                    cap = getattr(ref, 'preview_cap', None)
                    if cap:
                        pos = cap.get(cv2.CAP_PROP_POS_MSEC)
                    ref._start_voice_audio(pos)
                    return None
                else:
                    return None
            else:
                return None
        else:
            try:
                return None
            except:
                try:
                    if Exception:
                        pass
                except:
                    pass

    def _pause_exporter_preview(self):
        ref = getattr(self, '_exporter_ref', None)
        parent = self.master
        if not ref is not None and parent:
            while True:
                ref = parent
                parent = getattr(parent, 'master', None)
        if ref is not None:
            if getattr(ref, '_is_playing', False):
                ref._pause_playback()
                return None
            else:
                return None
        else:
            try:
                return None
            except:
                try:
                    if Exception:
                        pass
                except:
                    pass

    def get_ext_voice_file(self):
        return getattr(self, '_ext_voice_full_path', '') or ''

    def _get_model_repo(self):
        label = self._model_var.get()
        for repo, lbl in VIENEW_MODELS:
            if not lbl == label:
                continue
            return var
        return DEFAULT_VIENEW_MODEL

    def _sync_bgm_to_exporter(self, path):

        def _push_bgm_active(exporter, p):
            if hasattr(exporter, 'timeline_set_bgm_active'):
                exporter.timeline_set_bgm_active(bool(p))
                return None
            else:
                try:
                    return None
                except:
                    try:
                        if Exception:
                            pass
                    except:
                        pass
        ref = getattr(self, '_exporter_ref', None)
        if not ref is None and hasattr(ref, 'bgm_file'):
            ref.bgm_file = path
            _push_bgm_active(ref, path)
            return None
        parent = self.master
        while parent:
            if hasattr(parent, 'bgm_file'):
                parent.bgm_file = path
                _push_bgm_active(parent, path)
                return None
            parent = getattr(parent, 'master', None)
        return None
        return None

    def get_bgm_file(self):
        return getattr(self, '_bgm_full_path', '') or self._bgm_var.get()

    def _kill_play_proc(self):
        if self._play_proc:
            if self._play_proc.poll() is None:
                self._play_proc.kill()
                self._play_proc.wait(timeout=0.5)
                self._play_proc = None
                return None
            else:
                return None
        else:
            try:
                return None
            except:
                try:
                    if Exception:
                        pass
                except:
                    pass
