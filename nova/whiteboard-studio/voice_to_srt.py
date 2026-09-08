#!/usr/bin/env python3
"""WHITEBOARD STUDIO — Tạo SRT tiếng Việt từ file voice (nhận diện local).

File của Nova (KHÔNG thuộc repo vendored srt-whiteboard-animation) — cùng
pattern như render-progress-bridge.py. Luôn chạy bằng python của .venv:

    <venv-python> voice_to_srt.py <voice> <output.srt> [--model base|small|medium]

- faster-whisper chạy hoàn toàn local (CPU, int8): model được tải & cache
  1 lần bởi thư viện, sau đó không cần mạng.
- transcribe với language="vi", VAD filter, beam_size=5 — cùng cấu hình
  với engine Whiteboard Studio bản độc lập đã đối chiếu.
- Dòng cuối in OUTPUT=<đường dẫn> để tầng Node capture (pattern chung module).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def srt_time(seconds: float) -> str:
    millis = max(0, round(seconds * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    seconds, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Tạo SRT tiếng Việt từ voice (local)")
    parser.add_argument("voice", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--model", default="small", choices=["base", "small", "medium"])
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SystemExit(
            "Thiếu faster-whisper trong venv — bấm nút \"Cài Whisper\" trong panel "
            "(hoặc: <venv-python> -m pip install faster-whisper)."
        ) from exc

    print("[1/2] Đang nạp mô hình nhận diện tiếng Việt (" + args.model + ", lần đầu có thể tải model)…")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print("[2/2] Đang nghe voice và căn mốc thời gian…")
    segments, _ = model.transcribe(str(args.voice), language="vi", vad_filter=True, beam_size=5)
    rows = list(segments)
    if not rows:
        raise SystemExit("Không nhận diện được lời thoại trong tệp voice.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for index, segment in enumerate(rows, 1):
            handle.write(f"{index}\n{srt_time(segment.start)} --> {srt_time(segment.end)}\n{segment.text.strip()}\n\n")
    print(f"OUTPUT={args.output}")


if __name__ == "__main__":
    main()
