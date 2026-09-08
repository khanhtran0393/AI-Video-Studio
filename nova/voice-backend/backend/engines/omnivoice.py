"""Engine TTS dùng OmniVoice (k2-fsa, Apache-2.0).

600+ ngôn ngữ, tiếng Việt native, clone giọng + thiết kế giọng theo thuộc tính.
Cài ở venv riêng (.venv-omni) vì cần transformers>=5.3 (xung đột với coqui-tts).

Ba chế độ đều qua model.generate():
  - Clone:  ref_audio (+ ref_text tuỳ chọn, không có thì auto Whisper)
  - Design: instruct="female, low pitch, british accent"
  - Auto:   không prompt gì
"""
from __future__ import annotations

import os
from pathlib import Path

from .base import TTSEngine, TTSRequest


class OmniVoiceEngine(TTSEngine):
    name = "omnivoice"

    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"

    def load(self) -> None:
        if self._model is not None:
            return
        import torch
        from omnivoice import OmniVoice

        if torch.backends.mps.is_available():
            self._device = "mps"
        elif torch.cuda.is_available():
            self._device = "cuda"
        else:
            self._device = "cpu"
        dtype = torch.float32 if self._device == "cpu" else torch.float16
        repo = os.environ.get("VOICE_OMNI_MODEL", "k2-fsa/OmniVoice")
        self._model = OmniVoice.from_pretrained(repo, device_map=self._device, dtype=dtype)

    def unload(self) -> None:
        self._model = None
        try:
            import torch

            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        self.load()
        import soundfile as sf

        kwargs = {"text": req.text, "speed": float(req.speed)}

        # Tham số nâng cao (nếu được cung cấp)
        if req.top_p is not None:
            kwargs["top_p"] = req.top_p
        if req.top_k is not None:
            kwargs["top_k"] = req.top_k
        if req.repetition_penalty is not None:
            kwargs["repetition_penalty"] = req.repetition_penalty
        if req.generation_speed is not None:
            kwargs["generation_speed"] = req.generation_speed
        if req.diffusion_steps is not None:
            kwargs["nfe_step"] = req.diffusion_steps  # OmniVoice dùng nfe_step cho diffusion steps

        # Chuẩn hoá số (tiếng Việt dùng num2words) nếu bật.
        if req.attributes.get("normalize_text"):
            kwargs["normalize_text"] = True

        instruct = req.attributes.get("instruct")
        if req.ref_audio:
            kwargs["ref_audio"] = req.ref_audio
            if req.ref_text:
                kwargs["ref_text"] = req.ref_text
            # không có ref_text -> OmniVoice tự transcribe bằng Whisper
        elif instruct:
            kwargs["instruct"] = instruct
        # else: auto voice (không prompt)

        audio = self._model.generate(**kwargs)
        # audio: list các np.ndarray (T,) @ 24kHz. Ghi PCM 16-bit để khớp pipeline.
        sf.write(str(out_path), audio[0], 24000, subtype="PCM_16")
        return out_path
