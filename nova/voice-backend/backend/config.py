"""Cấu hình toàn cục cho Voice Studio backend."""
from __future__ import annotations

import os
from pathlib import Path

# Thư mục gốc dự án (voice-studio/)
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
VOICEBANK_DIR = DATA_DIR / "voicebank"
OUTPUT_DIR = DATA_DIR / "output"
UI_DIR = ROOT / "ui"

for _d in (DATA_DIR, VOICEBANK_DIR, OUTPUT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Engine mặc định. "mock" chạy được ngay không cần model.
# Sau khi cài model thật, đổi qua "xtts" (hoặc set env VOICE_TTS_ENGINE).
TTS_ENGINE = os.environ.get("VOICE_TTS_ENGINE", "mock")
ASR_ENGINE = os.environ.get("VOICE_ASR_ENGINE", "mock")

# Máy chủ
HOST = os.environ.get("VOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("VOICE_PORT", "8770"))

# Tần số lấy mẫu chuẩn cho toàn hệ thống
SAMPLE_RATE = 24000
