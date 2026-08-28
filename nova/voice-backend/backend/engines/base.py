"""Giao diện chung cho mọi engine TTS/ASR — cho phép thay model mà không sửa app."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class TTSRequest:
    text: str
    language: str = "vi"
    # Đường dẫn file âm thanh mẫu để clone giọng (zero-shot). None = giọng mặc định/thiết kế.
    ref_audio: Optional[str] = None
    # Văn bản của đoạn mẫu (một số engine cần, vd XTTS thì không).
    ref_text: Optional[str] = None
    speed: float = 1.0
    # Thuộc tính thiết kế giọng khi không có mẫu (gender, age, pitch...).
    attributes: dict = field(default_factory=dict)


class TTSEngine:
    """Lớp cha. Engine con override load() và synthesize()."""

    name: str = "base"

    def load(self) -> None:
        """Nạp model vào bộ nhớ (lazy). Gọi trước lần synth đầu tiên."""

    def unload(self) -> None:
        """Giải phóng model khỏi bộ nhớ khi nhàn rỗi."""

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        """Tổng hợp giọng cho req.text, ghi WAV ra out_path, trả về out_path."""
        raise NotImplementedError


class ASREngine:
    """Nhận dạng giọng nói -> văn bản (kèm mốc thời gian cho SRT)."""

    name: str = "base"

    def load(self) -> None: ...

    def unload(self) -> None: ...

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> dict:
        """Trả về {"text": str, "segments": [{"start","end","text"}], "language": str}."""
        raise NotImplementedError
