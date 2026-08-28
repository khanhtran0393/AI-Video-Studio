"""Engine giả — không cần model, chỉ dùng stdlib.

Sinh ra file WAV có độ dài tỉ lệ với số ký tự (một chuỗi âm giống "beep"
theo cao độ khác nhau) để test toàn bộ luồng app: hàng chờ, xuất SRT,
Voice Bank, UI... trước khi cắm model AI thật.
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

from .base import ASREngine, TTSEngine, TTSRequest

SR = 24000


class MockTTS(TTSEngine):
    name = "mock"

    def synthesize(self, req: TTSRequest, out_path: Path) -> Path:
        # Thời lượng ~ số ký tự / tốc độ đọc (khoảng 14 ký tự/giây).
        n_chars = max(1, len(req.text.strip()))
        seconds = max(0.6, n_chars / 14.0)
        seconds = seconds / max(0.1, req.speed)

        # Cao độ cơ bản đổi theo hash của ref/attributes để mỗi "giọng" khác nhau.
        seed = abs(hash((req.ref_audio or "") + str(req.attributes))) % 120
        base_freq = 130 + seed  # ~130-250 Hz giống giọng người

        n = int(SR * seconds)
        frames = bytearray()
        for i in range(n):
            t = i / SR
            # Nhấp nhô âm lượng theo "âm tiết" ~4 âm tiết/giây cho giống lời nói.
            syllable = 0.5 + 0.5 * math.sin(2 * math.pi * 4 * t)
            wave_val = math.sin(2 * math.pi * base_freq * t)
            # Thêm hài bậc 2 cho đỡ chói.
            wave_val += 0.3 * math.sin(2 * math.pi * base_freq * 2 * t)
            # Fade in/out tránh click.
            env = min(1.0, t / 0.03, (seconds - t) / 0.03)
            sample = int(0.25 * 32767 * wave_val * syllable * max(0.0, env))
            frames += struct.pack("<h", max(-32768, min(32767, sample)))

        with wave.open(str(out_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(bytes(frames))
        return out_path


class MockASR(ASREngine):
    name = "mock"

    def transcribe(self, audio_path: str, language: str | None = None) -> dict:
        # Đọc độ dài file để tạo segment giả.
        try:
            with wave.open(audio_path, "rb") as w:
                dur = w.getnframes() / float(w.getframerate())
        except Exception:
            dur = 3.0
        text = "[Đây là bản nhận dạng giả — cài mlx-whisper để có kết quả thật]"
        return {
            "text": text,
            "language": language or "vi",
            "mock": True,   # app đọc cờ này để KHÔNG dùng làm mốc thời gian thật
            "segments": [{"start": 0.0, "end": round(dur, 2), "text": text}],
        }
