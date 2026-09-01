"""Factory chọn engine theo tên. Import model nặng được hoãn tới khi thực sự dùng."""
from __future__ import annotations

from .base import ASREngine, TTSEngine, TTSRequest

__all__ = ["TTSEngine", "ASREngine", "TTSRequest", "get_tts_engine", "get_asr_engine"]

_tts_cache: dict[str, TTSEngine] = {}
_asr_cache: dict[str, ASREngine] = {}


def get_tts_engine(name: str) -> TTSEngine:
    if name in _tts_cache:
        return _tts_cache[name]

    if name == "mock":
        from .mock import MockTTS

        eng: TTSEngine = MockTTS()
    elif name == "xtts":
        from .xtts import XTTSEngine  # import nặng, chỉ khi cần

        eng = XTTSEngine()
    elif name == "omnivoice":
        from .omnivoice import OmniVoiceEngine  # cần venv .venv-omni

        eng = OmniVoiceEngine()
    elif name == "vieneu":
        from .vieneu import VieNeuEngine  # tiếng Việt native + voice cloning

        eng = VieNeuEngine()
    else:
        raise ValueError(f"Unknown TTS engine: {name!r}")

    _tts_cache[name] = eng
    return eng


def get_asr_engine(name: str) -> ASREngine:
    if name in _asr_cache:
        return _asr_cache[name]

    if name == "mock":
        from .mock import MockASR

        eng: ASREngine = MockASR()
    elif name in ("mlx-whisper", "whisper"):
        from .asr_whisper import WhisperEngine

        eng = WhisperEngine()
    else:
        raise ValueError(f"Unknown ASR engine: {name!r}")

    _asr_cache[name] = eng
    return eng
