"""Nhận dạng giọng nói. Ưu tiên mlx-whisper (GPU Apple Silicon),
tự lùi về faster-whisper (CPU/CUDA) trên nền tảng khác.
"""
from __future__ import annotations

import os
from typing import Optional

from .base import ASREngine


class WhisperEngine(ASREngine):
    name = "whisper"

    def __init__(self) -> None:
        self._backend = None      # "mlx" | "faster"
        self._model = None
        # large-v3-turbo: nhanh & chính xác; đổi qua env nếu máy yếu.
        self._model_name = os.environ.get("VOICE_WHISPER_MODEL", "large-v3-turbo")

    def load(self) -> None:
        if self._backend is not None:
            return
        # Thử MLX trước (Apple Silicon).
        try:
            import mlx_whisper  # noqa
            self._backend = "mlx"
            # mlx-whisper tải model theo repo HF khi transcribe, không cần giữ handle.
            self._mlx_repo = f"mlx-community/whisper-{self._model_name}"
            return
        except Exception:
            pass
        # Lùi về faster-whisper.
        from faster_whisper import WhisperModel

        self._backend = "faster"
        self._model = WhisperModel(self._model_name, device="auto", compute_type="int8")

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> dict:
        self.load()
        if self._backend == "mlx":
            import mlx_whisper

            r = mlx_whisper.transcribe(
                audio_path,
                path_or_hf_repo=self._mlx_repo,
                language=language,
                word_timestamps=True,
            )
            segs = [
                {"start": s["start"], "end": s["end"], "text": s["text"].strip(),
                 "words": [{"w": w.get("word", "").strip(), "s": w.get("start"), "e": w.get("end")}
                           for w in (s.get("words") or []) if w.get("start") is not None]}
                for s in r.get("segments", [])
            ]
            return {"text": r.get("text", "").strip(), "language": r.get("language", language), "segments": segs}

        # faster-whisper
        segments, info = self._model.transcribe(audio_path, language=language, word_timestamps=True)
        segs = []
        parts = []
        for s in segments:
            words = [{"w": (w.word or "").strip(), "s": w.start, "e": w.end}
                     for w in (getattr(s, "words", None) or []) if w.start is not None]
            segs.append({"start": s.start, "end": s.end, "text": s.text.strip(), "words": words})
            parts.append(s.text.strip())
        return {"text": " ".join(parts), "language": info.language, "segments": segs}
