'\nengines_kokoro.py — Kokoro-Vietnamese TTS (Apache-2.0, offline, CPU, ONNX).\n\nKokoro-82M fine-tune tiếng Việt (StyleTTS2 + ISTFTNet). Runtime TORCH-FREE:\n- Model ONNX (kokoro_vi.onnx ~311MB) chạy onnxruntime (đã bundle).\n- Voicepack = vector giọng `.npy` (nhẹ, np.load) — KHÔNG cần torch.\n- G2P = vig2p vendored (chỉ dùng sea_g2p đã bundle sẵn cho Piper).\n- Model + voicepack tải R2 on-demand lần đầu (như NgocHuyen), Apache → KHÔNG mã hóa.\nTốc độ CPU: RTF ~0.2 (8 core) → ~0.4 (máy yếu 2 luồng), vẫn nhanh hơn realtime.\n14 giọng (nam/nữ), 24 kHz.\n'
from __future__ import annotations
import os
import re
import sys
import threading
import wave
from pathlib import Path
from typing import Callable
import numpy as np
SAMPLE_RATE = 24000
_CROSSFADE_SAMPLES = round(SAMPLE_RATE * 50 / 1000)
KOKORO_VOICES: 'list[tuple[str, str]]' = [('diem_trinh', 'Diễm Trinh (Nữ)'), ('mai_linh', 'Mai Linh (Nữ)'), ('mai_loan', 'Mai Loan (Nữ)'), ('my_yen', 'Mỹ Yến (Nữ)'), ('ngoc_huyen', 'Ngọc Huyền (Nữ)'), ('thuc_trinh', 'Thục Trinh (Nữ)'), ('hung_thinh', 'Hưng Thịnh (Nam)'), ('manh_dung', 'Mạnh Dũng (Nam)'), ('phat_tai', 'Phát Tài (Nam)'), ('thanh_dat', 'Thành Đạt (Nam)'), ('tuan_ngoc', 'Tuấn Ngọc (Nam)'), ('duc_an', 'Đức An (Nam)'), ('duc_duy', 'Đức Duy (Nam)'), ('storyvert', 'StoryVert (Kể chuyện)')]
KOKORO_VOICE_META: 'dict[str, tuple[str, str]]' = {'diem_trinh': ('female', ''), 'mai_linh': ('female', ''), 'mai_loan': ('female', ''), 'my_yen': ('female', ''), 'ngoc_huyen': ('female', ''), 'thuc_trinh': ('female', ''), 'hung_thinh': ('male', ''), 'manh_dung': ('male', ''), 'phat_tai': ('male', ''), 'thanh_dat': ('male', ''), 'tuan_ngoc': ('male', ''), 'duc_an': ('male', ''), 'duc_duy': ('male', ''), 'storyvert': ('male', '')}
_VOICE_IDS = {v for v, _ in KOKORO_VOICES}
_DEFAULT_VOICE = 'diem_trinh'

def scan_kokoro_voices() -> list[tuple[str, str]]:
    return KOKORO_VOICES

def _get_kokoro_model_dir() -> Path:
    _ov = os.environ.get('VTP_KOKORO_MODEL_DIR')
    if _ov:
        return Path(_ov)
    base = Path(os.path.dirname(os.path.abspath(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))))
    d = base / 'models' / 'kokoro'
    try:
        d.mkdir(parents=True, exist_ok=True)
        _t = d / '.write_test'
        _t.write_bytes(b'x')
        _t.unlink(missing_ok=True)
    except (PermissionError, OSError):
        pass
    appdata = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    d2 = Path(appdata) / 'VideoToolsPro' / 'models' / 'kokoro'
    d2.mkdir(parents=True, exist_ok=True)
    return d2

def _download_file(remote_name: str, dst: Path, progress_cb=None) -> bool:
    if progress_cb:
        progress_cb(f'Thiếu model Kokoro: {remote_name}. Đặt file model vào {dst.parent} trước khi dùng.')
    return False

def _split_text(text: str) -> list[str]:
    normalized = re.sub('\\s+', ' ', text.strip())
    if normalized:
        chunks = []
        start = 0
        for match in re.finditer('[.!?…]+(?:["”’)]*)', normalized):
            end = match.end()
            if end >= len(normalized) or normalized[end].isspace():
                chunk = normalized[start:end].strip()
                if chunk:
                    chunks.append(chunk)
                start = end
        remainder = normalized[start:].strip()
        if remainder:
            chunks.append(remainder)
        return chunks or [normalized]
    return []

def _merge_audio_chunks(chunks: list, crossfade: int) -> np.ndarray:
    valid = [np.asarray(c, dtype=np.float32) for c in chunks if len(c) > 0]
    if valid:
        merged = valid[0]
        for chunk in valid[1:]:
            overlap = min(int(crossfade), len(merged), len(chunk))
            if overlap <= 0:
                merged = np.concatenate([merged, chunk])
            else:
                fo = np.linspace(1.0, 0.0, overlap + 2, dtype=np.float32)[1:-1]
                cf = merged[-overlap:] * fo + chunk[:overlap] * (1.0 - fo)
                merged = np.concatenate([merged[:-overlap], cf, chunk[overlap:]])
        return merged.astype(np.float32, copy=False)
    return np.array([], dtype=np.float32)

def _phonemes_to_input_ids(phonemes: str, vocab: dict, context_length: int) -> np.ndarray:
    ids = [vocab[p] for p in phonemes if p in vocab]
    ids = ids[:max(0, context_length - 2)]
    return np.asarray([[0, *ids, 0]], dtype=np.int64)

def _select_voice_style(voicepack: np.ndarray, phoneme_count: int) -> np.ndarray:
    vp = np.asarray(voicepack, dtype=np.float32)
    index = min(max(phoneme_count, 1), vp.shape[0]) - 1
    return np.asarray(vp[index], dtype=np.float32)

class KokoroTTSEngine:
    __doc__ = 'Kokoro-Vietnamese — ONNX offline CPU, torch-free.'
    _session = None
    _config = None
    _lock = threading.Lock()
    _vp_cache: 'dict' = {}

    def __init__(self, voice: str, speed: float, lang: str, progress_cb: Callable[[str], None] | None=_DEFAULT_VOICE):
        self.voice = voice if voice in _VOICE_IDS else _DEFAULT_VOICE
        self.speed = speed
        self.progress_cb = progress_cb

    @classmethod
    def _get_session(cls, progress_cb=None):
        if cls._session is not None:
            pass
        else:
            with cls._lock:
                if cls._session is not None:
                    return
                import json
                import onnxruntime as ort
                d = _get_kokoro_model_dir()
                onnx_p = d / 'kokoro_vi.onnx'
                cfg_p = d / 'config.json'
                if not cfg_p.exists() and (not _download_file('kokoro_config.json', cfg_p, progress_cb)):
                    raise RuntimeError('Không tải được cấu hình Kokoro (config).')
                if not onnx_p.exists() or onnx_p.stat().st_size < 100000000:
                    if progress_cb:
                        progress_cb('⬇️ Lần đầu: tải giọng Kokoro (~310MB, chờ chút)...')
                    import shutil
                    onnx_tmp = onnx_p.with_suffix('.building')
                    _ok = True
                    with open(onnx_tmp, 'wb') as _out:
                        for _part in ('kokoro_vi.onnx.part0', 'kokoro_vi.onnx.part1'):
                            _pp = d / _part
                            if _download_file(_part, _pp, progress_cb):
                                with open(_pp, 'rb') as _pf:
                                    shutil.copyfileobj(_pf, _out)
                                _pp.unlink(missing_ok=True)
                                continue
                            _ok = False
                            break
                    if _ok:
                        os.replace(onnx_tmp, onnx_p)
                    else:
                        onnx_tmp.unlink(missing_ok=True)
                        raise RuntimeError('Không tải được model Kokoro. Kiểm tra mạng rồi thử lại.')
                else:
                    with open(cfg_p, encoding='utf-8') as f:
                        cls._config = json.load(f)
                    so = ort.SessionOptions()
                    so.intra_op_num_threads = max(1, min(6, int((os.cpu_count() or 4) * 0.75)))
                    so.inter_op_num_threads = 1
                    cls._session = ort.InferenceSession(str(onnx_p), so, providers=['CPUExecutionProvider'])
        return (cls._session, cls._config)

    def _get_voicepack(self) -> np.ndarray:
        vp = KokoroTTSEngine._vp_cache.get(self.voice)
        if vp is not None:
            return vp
        d = _get_kokoro_model_dir()
        vp_p = d / 'voicepacks' / f'{self.voice}.npy'
        if vp_p.exists() or _download_file(f'kokoro_vp_{self.voice}.npy', vp_p, self.progress_cb):
            vp = np.load(vp_p)
            KokoroTTSEngine._vp_cache[self.voice] = vp
            return vp
        raise RuntimeError(f"Không tải được giọng '{self.voice}'.")

    def generate(self, text: str, output_path: str) -> str:
        import tempfile
        from .vig2p import phonemize_text
        sess, cfg = (self._get_session(self.progress_cb)[0], self._get_session(self.progress_cb)[1])
        vp = self._get_voicepack()
        vocab = cfg['vocab']
        ctx = cfg['plbert']['max_position_embeddings']
        if self.speed and self.speed > 0:
            pass
        speed_v = np.asarray(___NULL___, dtype=np.float32)
        chunks = []
        for tc in _split_text(text):
            ps = phonemize_text(tc)
            if ps:
                ids = _phonemes_to_input_ids(ps, vocab, ctx)
                ref = _select_voice_style(vp, len(ps))
                try:
                    wav, _dur = (sess.run(None, {'input_ids': ids, 'ref_s': ref, 'speed': speed_v})[0], sess.run(None, {'input_ids': ids, 'ref_s': ref, 'speed': speed_v})[1])
                    chunks.append(np.asarray(wav, dtype=np.float32).reshape(-1))
                except Exception:
                    pass
        audio = _merge_audio_chunks(chunks, _CROSSFADE_SAMPLES)
        if audio.size == 0:
            raise RuntimeError('Kokoro không sinh được audio (text rỗng?).')
        pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
        wav_tmp = tempfile.mktemp(suffix='.wav')
        try:
            with wave.open(wav_tmp, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(pcm.tobytes())
            if output_path.endswith('.mp3'):
                import config as _cfg
                import subprocess as _sp
                _sp.run([_cfg.FFMPEG_PATH, '-y', '-i', wav_tmp, '-c:a', 'libmp3lame', '-b:a', '192k', output_path], capture_output=True, timeout=60, creationflags=getattr(_sp, 'CREATE_NO_WINDOW', 0))
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

    def generate_batch(self, tasks: list[tuple[str, str]], batch_size: int=1, progress_cb: Callable[[int, int], None] | None=None, stop_flag: threading.Event | None=None):
        total = len(tasks)
        for i, (text, out_path) in enumerate(tasks):
            if stop_flag and stop_flag.is_set():
                return None
            try:
                self.generate(text, out_path)
            except Exception:
                pass
            if progress_cb:
                progress_cb(i + 1, total)