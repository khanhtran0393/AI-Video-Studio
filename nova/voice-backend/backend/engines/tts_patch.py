"""Patch tương thích coqui-tts (XTTS) trên venv .venv-omni (Windows, transformers 5.x).

Hai vấn đề thực tế đã gặp khi chạy cả OmniVoice + coqui-tts chung một venv:

1. coqui-tts 0.27.5 import ``isin_mps_friendly`` từ ``transformers.pytorch_utils``
   — hàm này đã bị xoá ở transformers 5.x (mà OmniVoice bắt buộc >=5.3).
   → shim về ``torch.isin`` (đúng ngữ nghĩa trên CPU/CUDA).

2. ``TTS.tts.models.xtts.load_audio`` dùng ``torchaudio.load``; torchaudio >=2.9
   delegate sang torchcodec, torchcodec cần DLL FFmpeg "full-shared" trên Windows
   (máy thường không có) → "Failed to create AudioDecoder".
   → thay bằng soundfile (libsndfile đi kèm wheel, đọc WAV ổn định) + giữ
   ``torchaudio.functional.resample`` để đổi tần số.

Gọi ``apply_patch()`` TRƯỚC khi import/synth TTS — idempotent.
"""
from __future__ import annotations

_applied = False


def _patch_isin_mps_friendly() -> None:
    import torch
    import transformers.pytorch_utils as _pu

    if not hasattr(_pu, "isin_mps_friendly"):
        _pu.isin_mps_friendly = torch.isin


def _patch_xtts_load_audio() -> None:
    import torch
    import torchaudio

    import TTS.tts.models.xtts as _xtts_mod

    def _load_audio(audiopath, sampling_rate):
        import soundfile as sf

        data, sr = sf.read(audiopath, dtype="float32", always_2d=True)
        audio = torch.from_numpy(data.T)  # (channels, samples)
        if audio.size(0) != 1:  # stereo → mono
            audio = torch.mean(audio, dim=0, keepdim=True)
        if sr != sampling_rate:
            audio = torchaudio.functional.resample(audio, sr, sampling_rate)
        audio.clip_(-1, 1)
        return audio

    _xtts_mod.load_audio = _load_audio


def apply_patch() -> None:
    global _applied
    if _applied:
        return
    _applied = True
    _patch_isin_mps_friendly()
    _patch_xtts_load_audio()
