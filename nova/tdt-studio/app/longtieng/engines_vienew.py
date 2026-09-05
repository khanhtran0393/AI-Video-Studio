'Editable adapter for the public, on-device VieNeu-TTS package.'
from __future__ import annotations
import tempfile
import threading
import os
import subprocess
import gc
import sys
import wave
from pathlib import Path
from typing import Callable
from .longtieng_voices import DEFAULT_VIENEW_MODEL, _detect_best_device
_TEMP_DIR = Path(tempfile.gettempdir()) / 'VideoToolsPro' / 'tts'

class VienewTTSEngine:
    __doc__ = 'Keep the legacy application API while using the public VieNeu SDK.'
    _instance = None
    _instance_repo: 'str | None' = None
    _instance_actual_repo: 'str | None' = None
    _load_lock = threading.Lock()

    def __init__(self, voice: str='Vinh', speed: float=1.0, model_repo: str='', ref_audio: str='', ref_text: str='') -> None:
        self.voice = voice or 'Vinh'
        self.speed = float(speed or 1.0)
        self.model_repo = model_repo or DEFAULT_VIENEW_MODEL
        self.ref_audio = ref_audio or ''
        self.ref_text = ref_text or ''

    @staticmethod
    def _create_tts(repo: str, device: str):
        from vieneu_tts import VieNeuTTS
        codec_device = 'cuda' if device == 'cuda' else 'cpu'
        return VieNeuTTS(backbone_repo=repo, backbone_device=device, codec_device=codec_device)

    @classmethod
    def _get_tts(cls, model_repo: str='', progress_cb: Callable[[str], None] | None=None):
        requested_repo = model_repo or DEFAULT_VIENEW_MODEL
        with cls._load_lock:
            if cls._instance is not None and cls._instance_repo == requested_repo:
                pass
            else:
                previous = cls._instance
                cls._instance = None
                cls._instance_repo = None
                cls._instance_actual_repo = None
                close = getattr(previous, 'close', None)
                if previous is not None and callable(close):
                    close()
                device, actual_repo = (_detect_best_device(requested_repo)[0], _detect_best_device(requested_repo)[1])
                if progress_cb:
                    progress_cb(f"Đang tải VieNeu {actual_repo.split('/')[-1]} trên {device.upper()}...")
                cls._instance = cls._create_tts(actual_repo, device)
                cls._instance_repo = requested_repo
                cls._instance_actual_repo = actual_repo
            return

    def _get_reference(self, tts):
        if self.ref_audio:
            if self.ref_text.strip():
                reference = tts.clone_voice(self.ref_audio, self.ref_text.strip())
            else:
                raise ValueError('Voice cloning cần nội dung chính xác của audio tham chiếu.')
        else:
            reference = tts.get_preset_voice(self.voice)
            return (reference['codes'], reference['text'])

    @staticmethod
    def _write_wav(path: str, waveform, sample_rate: int) -> None:
        import numpy as np
        audio = np.asarray(waveform, dtype=np.float32).reshape(-1)
        if audio.size == 0:
            raise RuntimeError('VieNeu không sinh được dữ liệu audio.')
        pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
        with wave.open(path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm.tobytes())

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        clean_text = (text or '').strip()
        if clean_text:
            tts = self._get_tts(model_repo=self.model_repo, progress_cb=progress_cb)
            ref_codes, ref_text = (self._get_reference(tts)[0], self._get_reference(tts)[1])
            if progress_cb:
                progress_cb('VieNeu đang tạo giọng đọc...')
            waveform = tts.infer(clean_text, ref_codes=ref_codes, ref_text=ref_text)
            sample_rate = int(getattr(tts, 'sample_rate', 24000))
            return self._save_waveform(waveform, sample_rate, output_path)
        raise ValueError('Nội dung cần đọc không được để trống.')

    def _save_waveform(self, waveform, sample_rate: int, output_path: str) -> str:
        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.suffix.lower() == '.wav' and abs(self.speed - 1.0) <= 0.01:
            self._write_wav(str(target), waveform, sample_rate)
        else:
            handle, wav_tmp = tempfile.mkstemp(prefix='vienew_', suffix='.wav')
            os.close(handle)
            try:
                self._write_wav(wav_tmp, waveform, sample_rate)
                import config as _cfg
                command = [_cfg.FFMPEG_PATH, '-y', '-i', wav_tmp]
                if abs(self.speed - 1.0) > 0.01:
                    speed = max(0.5, min(2.0, self.speed))
                    command += ['-filter:a', f'atempo={speed:.3f}']
                if target.suffix.lower() == '.mp3':
                    command += ['-c:a', 'libmp3lame', '-b:a', '192k']
                command.append(str(target))
                completed = subprocess.run(command, capture_output=True, timeout=120, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                if completed.returncode != 0 or not target.is_file() or target.stat().st_size == 0:
                    error = completed.stderr.decode('utf-8', errors='replace').strip()
                    raise RuntimeError(f"Không thể ghi audio VieNeu: {error or 'FFmpeg thất bại'}")
            except:
                try:
                    os.remove(wav_tmp)
                except OSError:
                    pass
            try:
                os.remove(wav_tmp)
            except OSError:
                pass
        return str(target)
        raise
        raise

    def generate_batch(self, tasks: list[tuple[str, str]], batch_size: int=8, progress_cb: Callable[[str], None] | None=None, stop_flag: threading.Event | None=None) -> None:
        pending = [((text or '').strip(), path) for text, path in tasks if (text or '').strip()]
        if not pending or (stop_flag and stop_flag.is_set()):
            return None
        tts = self._get_tts(model_repo=self.model_repo, progress_cb=progress_cb)
        ref_codes, ref_text = (self._get_reference(tts)[0], self._get_reference(tts)[1])
        texts = [text for text, _ in pending]
        waveforms = tts.infer_batch(texts, ref_codes=ref_codes, ref_text=ref_text, max_batch_size=max(1, int(batch_size))) if hasattr(tts, 'infer_batch') else [tts.infer(text, ref_codes=ref_codes, ref_text=ref_text) for text in texts]
        if len(waveforms) != len(pending):
            raise RuntimeError('VieNeu trả về số lượng audio không khớp batch đầu vào.')
        sample_rate = int(getattr(tts, 'sample_rate', 24000))
        total = len(pending)
        for index, (waveform, (_, output_path)) in enumerate(zip(waveforms, pending), start=1):
            if stop_flag and stop_flag.is_set():
                return None
            self._save_waveform(waveform, sample_rate, output_path)
            if progress_cb:
                progress_cb(f'{index}/{total}')

    @classmethod
    def cleanup(cls) -> None:
        with cls._load_lock:
            instance = cls._instance
            cls._instance = None
            cls._instance_repo = None
            cls._instance_actual_repo = None
            close = getattr(instance, 'close', None)
            if instance is not None and callable(close):
                close()
        gc.collect()
        torch = sys.modules.get('torch')
        cuda = getattr(torch, 'cuda', None) if torch is not None else None
        if cuda is not None:
            if cuda.is_available():
                cuda.empty_cache()