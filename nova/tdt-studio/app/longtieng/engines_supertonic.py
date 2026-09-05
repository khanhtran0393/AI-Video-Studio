'\nengines_supertonic.py — TDT TTS engine (MIT, offline, CPU-only).\nhttps://github.com/supertone-inc/supertonic\n\nModel: ONNX, ~66M params, ~305 MB auto-download từ HuggingFace\n       lần đầu dùng, cache tại ~/.cache/huggingface/.\nTốc độ: ~1,263 char/s CPU M4 Pro, 31 ngôn ngữ.\nKhông cần GPU, không cần mạng sau lần tải đầu.\n'
from __future__ import annotations
import os
import re
import threading
import wave
from typing import Callable
import numpy as np
SAMPLE_RATE = 44100
SUPERTONIC_VOICES: 'list[tuple[str, str]]' = [('M1', 'Giọng đọc 1'), ('M2', 'Giọng đọc 2'), ('M3', 'Giọng đọc 3'), ('M4', 'Giọng đọc 4'), ('M5', 'Giọng đọc 5'), ('F1', 'Giọng đọc 6'), ('F2', 'Giọng đọc 7'), ('F3', 'Giọng đọc 8'), ('F4', 'Giọng đọc 9'), ('F5', 'Giọng đọc 10')]
SUPERTONIC_VOICE_META: 'dict[str, tuple[str, str]]' = {'M1': ('male', ''), 'M2': ('male', ''), 'M3': ('male', ''), 'M4': ('male', ''), 'M5': ('male', ''), 'F1': ('female', ''), 'F2': ('female', ''), 'F3': ('female', ''), 'F4': ('female', ''), 'F5': ('female', '')}
_SUPERTONIC_LANGS = {'sk', 'tr', 'sl', 'es', 'hu', 'el', 'sv', 'en', 'ru', 'lt', 'pl', 'pt', 'ro', 'et', 'fi', 'lv', 'id', 'ar', 'ko', 'uk', 'bg', 'cs', 'vi', 'da', 'hi', 'it', 'ja', 'fr', 'hr', 'nl', 'de'}
_VI_DIACRITICS = set('áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ')

def _detect_text_lang(text: str) -> str:
    if text:
        for c in text:
            if '一' <= c <= '鿿':
                return 'zh'
            if '\u3040' <= c <= 'ヿ':
                return 'ja'
            if '가' <= c <= '\ud7af':
                return 'ko'
            if c.lower() in _VI_DIACRITICS:
                return 'vi'
        _ascii_letters = sum((1 for c in text if c.isascii() and c.isalpha()))
        return 'en' if _ascii_letters >= 3 else 'vi'
    return 'vi'
_CLAUSE_SPLIT = re.compile('([.!?…。！？]+|[,;:、，；：]+)')
_END_PUNCT = re.compile('[.!?…。！？]')

def _tighten_silence(w: np.ndarray, sr: int, thr: float=0.01, max_gap: float=0.09, edge: float=0.03) -> np.ndarray:
    w = np.asarray(w, dtype=np.float32).reshape(-1)
    n = w.size
    if n == 0:
        return w
    fl = max(1, int(0.01 * sr))
    nf = (n + fl - 1) // fl
    pad = nf * fl - n
    wp = np.concatenate([np.abs(w), np.zeros(pad, np.float32)]) if pad else np.abs(w)
    voiced = wp.reshape(nf, fl).max(axis=1) >= thr
    if voiced.any():
        first = int(np.argmax(voiced))
        last = nf - 1 - int(np.argmax(voiced[::-1]))
        ef = int(edge * sr / fl)
        lo = max(0, first - ef)
        hi = min(nf, last + 1 + ef)
        mgf = max(1, int(max_gap * sr / fl))
        gap, keep = (0, [])
        for f in range(lo, hi):
            if voiced[f]:
                gap = 0
                keep.append(f)
            else:
                gap += 1
                if gap <= mgf:
                    keep.append(f)
        return np.concatenate([w[f * fl:min(n, f * fl + fl)] for f in keep])
    return w[:int(0.03 * sr)]

def _split_clauses(text: str) -> list[tuple[str, float]]:
    parts = _CLAUSE_SPLIT.split(text)
    segs = []
    buf = ''
    for p in parts:
        if p and _CLAUSE_SPLIT.fullmatch(p):
            pause = 0.3 if _END_PUNCT.search(p) else 0.16
            segs.append((buf.strip(), pause))
            buf = ''
        else:
            buf += p
    if buf.strip():
        segs.append((buf.strip(), 0.0))
    segs = [(c, p) for c, p in segs if c]
    return segs or [(text.strip(), 0.0)]
_MAX_WORDS_PER_SYNTH = 12
_SOFT_GAP = 0.03

def _soft_split_words(clause: str, n: int=_MAX_WORDS_PER_SYNTH) -> list[str]:
    ws = clause.split()
    return [clause] if len(ws) <= n else [' '.join(ws[i:i + n]) for i in range(0, len(ws), n)]

def _synth_tightened(tts, style, text: str, lang: str, sr: int) -> np.ndarray:
    segs = _split_clauses(text)
    au = []
    for i, (clause, pause) in enumerate(segs):
        if clause:
            groups = _soft_split_words(clause)
            for j, g in enumerate(groups):
                try:
                    wav, _ = tts.synthesize(g.lower(), voice_style=style, lang=lang)
                    au.append(_tighten_silence(np.asarray(wav, dtype=np.float32).reshape(-1), sr))
                    if j < len(groups) - 1:
                        au.append(np.zeros(int(_SOFT_GAP * sr), dtype=np.float32))
                except Exception:
                    pass
        if pause > 0 and i < len(segs) - 1:
            au.append(np.zeros(int(pause * sr), dtype=np.float32))
    return np.concatenate(au) if au else np.zeros(int(0.03 * sr), dtype=np.float32)

def _resolve_synth_lang(target_lang: str, text: str) -> str:
    target = (target_lang or '').lower()
    _det = _detect_text_lang(text)
    return _det if _det in ('ja', 'ko') and _det in _SUPERTONIC_LANGS else target if target in _SUPERTONIC_LANGS else _det if _det in _SUPERTONIC_LANGS else 'vi'

class SupertonicTTSEngine:
    __doc__ = 'TDT TTS — offline ONNX, CPU inference, 30 languages.'
    _tts = None
    _tts_lock = threading.Lock()
    _style_cache: 'dict' = {}

    @classmethod
    def _get_style(cls, tts, voice: str):
        _s = cls._style_cache.get(voice)
        if _s is None:
            with cls._tts_lock:
                _s = cls._style_cache.get(voice)
                if _s is None:
                    _s = tts.get_voice_style(voice_name=voice)
                    cls._style_cache[voice] = _s
                return _s
        return _s

    def __init__(self, voice: str='M1', speed: float=1.0, volume: float=1.0, lang: str='vi'):
        self.voice = voice
        self.speed = speed
        self.volume = volume
        if lang in _SUPERTONIC_LANGS:
            self.lang = lang
            return None
        self.lang = 'vi'

    @classmethod
    def _get_tts(cls):
        if cls._tts is not None:
            pass
        else:
            with cls._tts_lock:
                if cls._tts is not None:
                    return
                import sys
                try:
                    os.environ.setdefault('SUPERTONIC_INTRA_OP_THREADS', str(max(1, min(6, int((os.cpu_count() or 4) * 0.6)))))
                    from supertonic import TTS
                    cls._tts = TTS(auto_download=True)
                except ImportError:
                    msg = 'All Voice TTS sẽ có trong bản cập nhật tiếp theo.\nVui lòng chờ phiên bản V8.3.8+ hoặc dùng\nNgocHuyen TTS / CapCut TTS trong lúc chờ.' if getattr(sys, 'frozen', False) else 'Thiếu thư viện supertonic.\nGõ: pip install supertonic'
                    raise RuntimeError(msg)
                except Exception as e:
                    raise RuntimeError(f'Không thể tải TDT model: {e}\nKiểm tra kết nối mạng và thử lại.')
                return cls._tts
        return cls._tts

    def generate(self, text: str, output_path: str) -> str:
        import config as _cfg
        import subprocess as _sp
        import tempfile
        tts = self._get_tts()
        style = self._get_style(tts, self.voice)
        _lang = _resolve_synth_lang(self.lang, text.lower())
        sr = int(getattr(tts, 'sample_rate', SAMPLE_RATE))
        wav = _synth_tightened(tts, style, text, _lang, sr)
        pcm = (np.clip(wav, -1.0, 1.0) * 32767.0).astype(np.int16)
        wav_tmp = tempfile.mktemp(suffix='.wav')
        try:
            with wave.open(wav_tmp, 'wb') as _wf:
                _wf.setnchannels(1)
                _wf.setsampwidth(2)
                _wf.setframerate(sr)
                _wf.writeframes(pcm.tobytes())
            if output_path.endswith('.mp3'):
                _sp.run([_cfg.FFMPEG_PATH, '-y', '-i', wav_tmp, '-c:a', 'libmp3lame', '-b:a', '192k', output_path], capture_output=True, timeout=30, creationflags=getattr(_sp, 'CREATE_NO_WINDOW', 0))
            else:
                import shutil
                shutil.move(wav_tmp, output_path)
            try:
                os.remove(wav_tmp)
            except:
                pass
            return output_path
        except:
            try:
                os.remove(wav_tmp)
            except OSError:
                pass
        return output_path
        raise
        raise
        raise

    def generate_batch(self, tasks: list[tuple[str, str]], batch_size: int=4, progress_cb: Callable[[int, int], None] | None=None, stop_flag: threading.Event | None=None):
        total = len(tasks)
        for i, (text, out_path) in enumerate(tasks):
            if stop_flag and stop_flag.is_set():
                return None
            try:
                self.generate(text, out_path)
            except Exception as e:
                pass
            if progress_cb:
                progress_cb(i + 1, total)