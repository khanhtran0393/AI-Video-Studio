'\nengines_ngochuyen.py — NgocHuyen TTS engine (Piper ONNX, offline).\n\nDựa trên NGHI-TTS (github.com/nghimestudio/nghitts) — Piper TTS fine-tuned\ncho giọng nói tiếng Việt nổi tiếng (Ngọc Ngạn, Việt Thảo, Mỹ Tâm, ...).\n\nModel source : Local directory: models/ngochuyen/\nModel format : Piper ONNX (.onnx + .onnx.json)\nYêu cầu      : pip install piper-tts  (bundled espeak-ng, onnxruntime)\nLưu models   : <exe>/models/ngochuyen/\n\nLưu ý: voice_id == display_name == tên file trong R2\n  e.g. voice_id = "Mỹ Tâm"  →  file = "Mỹ Tâm.onnx"\n'
from __future__ import annotations
import io
import os
import subprocess
import sys
import tempfile
import threading
import wave
from pathlib import Path
from typing import Callable
import config as _cfg
from .engines_capcut import _normalize_vn_for_capcut

def _get_ngochuyen_model_dir() -> Path:
    base = Path(os.path.dirname(os.path.abspath(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))))
    d = base / 'models' / 'ngochuyen'
    try:
        d.mkdir(parents=True, exist_ok=True)
        _t = d / '.write_test'
        _t.write_bytes(b'x')
        _t.unlink(missing_ok=True)
    except (PermissionError, OSError):
        pass
    appdata = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    d2 = Path(appdata) / 'VideoToolsPro' / 'models' / 'ngochuyen'
    d2.mkdir(parents=True, exist_ok=True)
    return d2
_GENDER: 'dict[str, bool | None]' = {'Ban Mai': True, 'Chiếu Thành': False, 'Duy Onyx': False, 'Duy Oryx': False, 'TV Hay': None, 'Mai Phương': True, 'Mạnh Dũng': False, 'Minh Khang': False, 'Minh Quang': False, 'Mỹ Tâm': True, 'Mỹ Tâm Real': True, 'Ngọc Huyền': None, 'Ngọc Ngạn': False, 'Phương Trang': True, 'Tài An': False, 'Thanh Phương Viettel': True, 'Thiện Tâm': False, **{'Trấn Thành': False, 'Việt Thảo': False, 'John': False, 'Mattheo': False, 'Mattheo v2': False, 'Indo Goreng': False, 'Calm Woman': True, 'Deep Man': False, 'Yan': True}}
_VOICE_LANG: 'dict[str, str]' = {'Deep Man': 'en', 'John': 'en', 'Mattheo': 'en', 'Mattheo v2': 'en', 'Indo Goreng': 'id'}
_LANG_TAG = {'en': 'EN', 'id': 'Indo'}
NGOCHUYEN_VOICE_META = {_n: ('female' if _g is True else 'male' if _g is False else '', '') for _n, _g in _GENDER.items()}
NGOCHUYEN_VOICE_META: 'dict[str, tuple[str, str]]'

def _ngochuyen_display_label(voice_id: str, base_label: str) -> str:
    tag = _LANG_TAG.get(_VOICE_LANG.get(voice_id, 'vi'))
    return f'{base_label} ({tag})' if tag and f'({tag})' not in base_label else base_label
NGOCHUYEN_VOICES_DEFAULT: 'list[tuple[str, str]]' = [('Ngọc Huyền', 'Ngọc Huyền'), ('TV Hay', 'TV Hay'), ('Ban Mai', 'Ban Mai'), ('Mỹ Tâm', 'Mỹ Tâm'), ('Mỹ Tâm Real', 'Mỹ Tâm Real'), ('Mai Phương', 'Mai Phương'), ('Ngọc Ngạn', 'Ngọc Ngạn'), ('Phương Trang', 'Phương Trang'), ('Thanh Phương Viettel', 'Thanh Phương Viettel'), ('Duy Oryx', 'Duy Oryx'), ('Duy Onyx', 'Duy Onyx'), ('Mạnh Dũng', 'Mạnh Dũng'), ('Minh Khang', 'Minh Khang'), ('Minh Quang', 'Minh Quang'), ('Tài An', 'Tài An'), ('Trấn Thành', 'Trấn Thành'), ('Việt Thảo', 'Việt Thảo'), ('Chiếu Thành', 'Chiếu Thành'), ('Thiện Tâm', 'Thiện Tâm'), ('John', 'John'), ('Mattheo', 'Mattheo'), ('Mattheo v2', 'Mattheo v2'), ('Indo Goreng', 'Indo Goreng'), ('Calm Woman', 'Calm Woman'), ('Deep Man', 'Deep Man'), ('Yan', 'Yan')]
_api_cache: 'list[tuple[str, str]] | None' = None
_api_fetch_done: 'bool' = False
_download_lock = threading.Lock()
_download_failed: 'set[str]' = set()
_ENC_MAGIC = b'VTPENC\x01'

def _model_crypt_key() -> bytes:
    import hashlib
    from config import MODEL_ENCRYPT_SECRET as _s
    return hashlib.sha256(_s.encode()).digest()

def _xor_crypt(data: bytes, key: bytes) -> bytes:
    import hashlib, random, struct
    seed = int.from_bytes(hashlib.sha256(b'VTPMDL' + key).digest(), 'big')
    rng = random.Random(seed)
    n_words = (len(data) + 7) // 8
    ks = struct.pack(f'>{n_words}Q', *[rng.getrandbits(64) for _ in range(n_words)])
    return bytes((a ^ b for a, b in zip))

def encrypt_model_file(path: Path) -> None:
    raw = path.read_bytes()
    if raw.startswith(_ENC_MAGIC):
        return None
    path.write_bytes(_ENC_MAGIC + _xor_crypt(raw, _model_crypt_key()))

def _decrypt_model_bytes(path: Path) -> bytes:
    raw = path.read_bytes()
    return _xor_crypt(raw[len(_ENC_MAGIC):], _model_crypt_key()) if raw.startswith(_ENC_MAGIC) else raw
import re as _re
import unicodedata as _unicodedata
_vietnormalizer = None

def _get_normalizer():
    if _vietnormalizer is None:
        try:
            from vietnormalizer import VietnameseNormalizer
            _vietnormalizer = VietnameseNormalizer(enable_transliteration=True)
        except ImportError:
            _vietnormalizer = False
    return _vietnormalizer if _vietnormalizer is not False else None

def _normalize_vietnamese_text(text: str) -> str:
    norm = _get_normalizer()
    if norm is None:
        return text
    try:
        pass
    except Exception:
        return text

def _short_path_or_same(s: str) -> str:
    import sys
    if sys.platform != 'win32':
        return s
    try:
        import ctypes
        k32 = ctypes.windll.kernel32
        n = k32.GetShortPathNameW(s, None, 0)
        if n > 0:
            buf = ctypes.create_unicode_buffer(n)
            k32.GetShortPathNameW(s, buf, n)
            short = buf.value
            try:
                short.encode('ascii')
            except UnicodeEncodeError:
                return s
        else:
            return s
    except Exception:
        return s

def _ascii_safe_dir(path) -> str:
    import sys, tempfile, shutil
    from pathlib import Path as _Path
    s = str(path)
    try:
        s.encode('ascii')
    except UnicodeEncodeError:
        pass
    short = _short_path_or_same(s)
    if short != s:
        try:
            short.encode('ascii')
        except UnicodeEncodeError:
            pass
        try:
            src = _Path(s)
            dest = _Path(tempfile.gettempdir()) / 'vtp_espeak_data'
            try:
                need = not dest.exists() or not any(dest.iterdir()) or sum((1 for _ in dest.rglob)) < sum((1 for _ in src.rglob))
            except OSError:
                need = True
            if need:
                if dest.exists():
                    shutil.rmtree(dest, ignore_errors=True)
                shutil.copytree(str(src), str(dest))
        except Exception:
            return short

def _fetch_voices_from_api() -> list[tuple[str, str]] | None:
    _api_cache = None
    _api_fetch_done = True

def scan_ngochuyen_voices() -> list[tuple[str, str]]:
    model_dir = _get_ngochuyen_model_dir()
    seen = set()
    voices = []
    for f in sorted(model_dir.glob('*.onnx')):
        name = f.stem
        if name not in seen:
            voices.append((name, _ngochuyen_display_label(name, name)))
            seen.add(name)
    return voices if voices else [(vid, _ngochuyen_display_label(vid, lbl)) for vid, lbl in NGOCHUYEN_VOICES_DEFAULT]

def download_ngochuyen_model(name: str, progress_cb: Callable[[str], None] | None=None) -> bool:
    model_dir = _get_ngochuyen_model_dir()
    onnx_path = model_dir / f'{name}.onnx'
    json_path = model_dir / f'{name}.onnx.json'
    if onnx_path.is_file() and json_path.is_file():
        return True
    if progress_cb:
        progress_cb(f"Thiếu model NgocHuyen '{name}'. Đặt .onnx và .onnx.json vào {model_dir}.")
    return False

def _detect_gpu_type() -> str:
    try:
        import subprocess
        _flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        r = subprocess.run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], capture_output=True, text=True, timeout=5, creationflags=_flags)
        if r.returncode != 0 or not r.stdout.strip():
            try:
                import subprocess
                r = subprocess.run(['powershell', '-NoProfile', '-Command', 'Get-WmiObject Win32_VideoController | Select-Object -ExpandProperty Name'], capture_output=True, text=True, timeout=6, creationflags=_flags)
                if r.returncode == 0:
                    for line in r.stdout.splitlines():
                        low = line.strip().lower()
                        if not low:
                            continue
                        if 'amd' in low or 'radeon' in low:
                            return line.strip()[:80]
                        if 'intel' in low or 'arc' in low or 'iris' in low:
                            return line.strip()[:80]
                        if 'uhd' not in low:
                            pass
            except Exception:
                return 'CPU (không GPU rời)'
            return 'CPU (không GPU rời)'
    except Exception:
        pass

def _force_onnx_cpu_aggressive():
    import os as _os
    _os.environ.setdefault('CUDA_VISIBLE_DEVICES', '')
    _os.environ.setdefault('HIP_VISIBLE_DEVICES', '')
    _os.environ.setdefault('ORT_DML_VISIBLE_DEVICES', '')
    try:
        import onnxruntime as _ort
        _ort.get_available_providers()
        for _attr in [name for name in dir(_ort) if any((tok in name.lower() for tok in ('cuda', 'dml', 'rocm', 'tensorrt', 'migraphx')))]:
            try:
                delattr(_ort, _attr)
            except Exception:
                continue
    except Exception:
        pass

class NgocHuyenTTSEngine:
    __doc__ = '\nTTS engine dùng Piper ONNX (NGHI-TTS models).\n\nvoice = display_name = tên file (e.g. "Mỹ Tâm")\nCần cài piper-tts:  pip install piper-tts\nModels lưu tại: <exe>/models/ngochuyen/\n\nGPU strategy: LUÔN dùng CPU. Piper model ~60MB → CPU inference ~1-3s\ncho câu ngắn, đủ nhanh cho TTS. GPU (CUDA/DirectML/ROCm) không cần thiết\nvà gây crash trên AMD/Intel GPU do ONNX Runtime probe provider không tương thích.\n'
    _espeak_lock = threading.Lock()
    _load_lock = threading.Lock()
    _voice_cache: 'dict[str, object]' = {}
    _onnx_cpu_forced: 'bool' = False

    @classmethod
    def _ensure_onnx_cpu_only(cls):
        if cls._onnx_cpu_forced:
            return None
        cls._onnx_cpu_forced = True
        try:
            import onnxruntime as _ort
            _avail = _ort.get_available_providers()
            if len(_avail) > 1:
                _cpu_only = [p for p in _avail if p == 'CPUExecutionProvider']
            else:
                return None
        except Exception:
            return None
        if _cpu_only:
            _original = _ort.get_available_providers

            def _cpu_patched():
                return _cpu_only
            _ort.get_available_providers = _cpu_patched
        return None

    def __init__(self, voice: str='Mỹ Tâm', speed: float=1.0, progress_cb: Callable[[str], None] | None=None):
        self.voice = voice
        self.speed = speed
        self.progress_cb = progress_cb

    def _load_voice(self, name: str):
        if name in self._voice_cache:
            return self._voice_cache[name]
        with self._load_lock:
            if name in self._voice_cache:
                return self._voice_cache[name]
            model_dir = _get_ngochuyen_model_dir()
            onnx_path = model_dir / f'{name}.onnx'
            json_path = model_dir / f'{name}.onnx.json'
            if onnx_path.exists() and json_path.exists():
                try:
                    from piper import PiperVoice
                    from piper.phonemize_espeak import ESPEAK_DATA_DIR as _PIPER_ESPEAK_DIR
                except ImportError:
                    raise ImportError('Cần cài piper-tts trước:\n\npip install piper-tts\n\nSau đó khởi động lại ứng dụng.')
                _espeak_data = _PIPER_ESPEAK_DIR
                _candidates = [str(_PIPER_ESPEAK_DIR)] if _PIPER_ESPEAK_DIR else []
                import sys as _sys
                if getattr(_sys, 'frozen', False):
                    _mei = getattr(_sys, '_MEIPASS', os.path.dirname(_sys.executable))
                    _exe_dir = os.path.dirname(os.path.abspath(_sys.executable))
                    _candidates += [os.path.join(_mei, 'piper', 'espeak-ng-data'), os.path.join(_mei, 'espeak-ng-data'), os.path.join(_exe_dir, '_rt', 'piper', 'espeak-ng-data'), os.path.join(_exe_dir, '_rt', 'espeak-ng-data'), os.path.join(_exe_dir, 'piper', 'espeak-ng-data'), os.path.join(_exe_dir, 'espeak-ng-data')]
                _espeak_data = None
                for _c in _candidates:
                    if _c and os.path.isdir(_c):
                        try:
                            _dicts = [n for n in os.listdir(_c) if n.endswith('_dict')]
                            if len(_dicts) >= 5:
                                _espeak_data = _c
                        except OSError:
                            pass
                        except Exception:
                            pass
                if _espeak_data:
                    import shutil as _shutil
                    _temp_espeak = os.path.join(tempfile.gettempdir(), 'vtp_espeak_data')
                    _ESPEAK_CORE = ('phontab', 'phonindex', 'phondata', 'intonations')

                    def _espeak_complete(_d, _need_dicts):
                        try:
                            if all((os.path.exists(os.path.join(_d, f)) for f in _ESPEAK_CORE)):
                                return len([n for n in os.listdir(_d) if n.endswith('_dict')]) >= _need_dicts
                        except OSError:
                            return False
                        return False
                    _src_dicts = len([n for n in os.listdir(_espeak_data) if n.endswith('_dict')])
                    if not _espeak_complete(_temp_espeak, _src_dicts):
                        if os.path.exists(_temp_espeak):
                            _shutil.rmtree(_temp_espeak, ignore_errors=True)
                        _shutil.copytree(_espeak_data, _temp_espeak)
                    if _espeak_complete(_temp_espeak, _src_dicts):
                        _espeak_data = _temp_espeak
                    self._ensure_onnx_cpu_only()
                    if self.progress_cb:
                        self.progress_cb(f'🔄 Nạp model {name}...')
                    import json as _json
                    import onnxruntime as _ort
                    from piper.config import PiperConfig as _PiperConfig
                    _last_err = None
                    for _attempt in range(2):
                        try:
                            _onnx_bytes = _decrypt_model_bytes(onnx_path)
                            _cfg = _json.loads(_decrypt_model_bytes(json_path).decode('utf-8'))
                            _so = _ort.SessionOptions()
                            _so.intra_op_num_threads = max(1, min(6, int((os.cpu_count() or 4) * 0.6)))
                            _so.inter_op_num_threads = 1
                            try:
                                _so.add_session_config_entry('session.intra_op.allow_spinning', '0')
                            except Exception:
                                pass
                            pv = PiperVoice(config=_PiperConfig.from_dict(_cfg), session=_ort.InferenceSession(_onnx_bytes, sess_options=_so, providers=['CPUExecutionProvider']), espeak_data_dir=Path(_ascii_safe_dir(_espeak_data)))
                            del _onnx_bytes
                            self._voice_cache[name] = pv
                            return pv
                        except Exception as _e:
                            _last_err = _e
                            if _attempt == 0:
                                _force_onnx_cpu_aggressive()
                            continue
                    if _last_err is not None:
                        raise _last_err
                else:
                    raise RuntimeError(f"Thiếu dữ liệu espeak-ng trong runtime/piper/espeak-ng-data.\nĐã tìm trong: {', '.join((c for c in _candidates if c))[:300]}")
            else:
                if self.progress_cb:
                    self.progress_cb(f'⬇️ Tải model {name}...')
                ok = download_ngochuyen_model(name, self.progress_cb)
                if not ok or not onnx_path.exists():
                    raise FileNotFoundError(f"Thiếu model '{name}'. Đặt file .onnx và .onnx.json vào: {model_dir}")
        _err_str = str(_last_err).lower() if _last_err else ''
        _gpu_hint = _detect_gpu_type()
        if 'cuda' in _err_str or 'cudnn' in _err_str:
            _detail = f'GPU NVIDIA được phát hiện ({_gpu_hint}) nhưng CUDA không hoạt động.\n• Cập nhật driver NVIDIA mới nhất tại: nvidia.com/drivers\n• Hoặc cài đặt piper-tts với CUDA support: pip install piper-tts[cuda]'
        elif 'directml' in _err_str or 'dml' in _err_str:
            _detail = f'GPU {_gpu_hint} — DirectML không tương thích với model Piper.\n• Cập nhật driver GPU mới nhất\n• Hoặc tắt GPU trong cài đặt ứng dụng'
        elif 'rocm' in _err_str or 'migraphx' in _err_str:
            _detail = f'GPU AMD ({_gpu_hint}) — ROCm không được hỗ trợ.\n• Model Piper chạy trên CPU, không cần GPU\n• Cập nhật driver AMD Adrenalin mới nhất'
        elif 'memory' in _err_str or 'alloc' in _err_str:
            _detail = 'Không đủ RAM để tải model TTS.\n• Đóng bớt ứng dụng khác và thử lại\n• Model cần ~200MB RAM trống'
        elif 'espeak' in _err_str or 'phonemize' in _err_str or 'segfault' in _err_str:
            _detail = 'espeak-ng (bộ chuyển văn bản → phiên âm) bị lỗi.\n• Thiếu thư mục espeak-ng-data trong bản build\n• Thử cài lại: pip install piper-tts --force-reinstall'
        else:
            _detail = f'Không thể tải model TTS.\n• GPU: {_gpu_hint}\n• Thử tải lại model: xóa thư mục models/ngochuyen/ rồi thử lại\n• Nếu vẫn lỗi, dùng giọng CapCut thay thế'
        raise RuntimeError(f"Không thể tải model '{name}'.\n\n{_detail}\n\nLỗi gốc: {_last_err}") from _last_err

    def generate(self, text: str, output_path: str) -> str:
        pv = self._load_voice(self.voice)
        text = _normalize_vietnamese_text(text)
        voice_lang = _VOICE_LANG.get(self.voice, 'vi')
        if voice_lang == 'vi':
            text = _normalize_vn_for_capcut(text)
        raw_wav = os.path.join(tempfile.gettempdir(), f'piper_{os.urandom(8).hex()}.wav')
        with NgocHuyenTTSEngine._espeak_lock:
            _synth_err = None
            wf = wave.open(raw_wav, 'wb')
            try:
                try:
                    pv.synthesize_wav(text, wf)
                except Exception as _e:
                    _synth_err = _e
                try:
                    wf.close()
                except:
                    pass
                if _synth_err is not None:
                    raise _synth_err
            except:
                try:
                    wf.close()
                except Exception:
                    pass
        try:
            raw_size = os.path.getsize(raw_wav)
        except OSError:
            raw_size = 0
        if raw_size < 64:
            try:
                os.unlink(raw_wav)
            except Exception:
                pass
            raise RuntimeError(f"Piper không sinh được audio cho text (raw={raw_size}B). Khả năng cao thiếu piper/espeak-ng-data trong bản build, hoặc text không phải ngôn ngữ của giọng '{self.voice}'.")
        ffmpeg = _cfg.FFMPEG_PATH
        cmd = [ffmpeg, '-y', '-i', raw_wav]
        if abs(self.speed - 1.0) > 0.03:
            speed_f = max(0.5, min(2.0, self.speed))
            cmd += ['-af', f'atempo={speed_f:.3f}']
        cmd += ['-acodec', 'libmp3lame', '-b:a', '128k', output_path]
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        try:
            proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=flags)
            if proc.returncode != 0:
                tail = (proc.stderr or b'').decode('utf-8', errors='replace').strip().splitlines()[-5:]
                raise RuntimeError(f'ffmpeg atempo lỗi (code={proc.returncode}): ' + ' | '.join(tail))
        except:
            try:
                os.unlink(raw_wav)
            except Exception:
                pass
            raise
        try:
            os.unlink(raw_wav)
        except Exception:
            pass

    def generate_batch(self, tasks: list[tuple[str, str]], batch_size: int=4, progress_cb: Callable[[int, int], None] | None=None, stop_flag: threading.Event | None=None) -> None:
        total = len(tasks)
        done = 0
        try:
            self._load_voice(self.voice)
        except Exception as e:
            if progress_cb:
                progress_cb(0, total)
            raise RuntimeError(f"Không thể tải model NgocHuyen '{self.voice}': {e}") from e
        for text, path in tasks:
            if stop_flag and stop_flag.is_set():
                return None
            try:
                self.generate(text, path)
                done += 1
                if progress_cb:
                    progress_cb(done, total)
            except Exception as e:
                import traceback
                traceback.print_exc()
                if progress_cb:
                    progress_cb(done, total)