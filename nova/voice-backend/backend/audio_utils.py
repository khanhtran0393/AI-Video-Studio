"""Tiện ích âm thanh: tách câu, ghép WAV, xuất SRT. Chỉ dùng stdlib + ffmpeg."""
from __future__ import annotations

import re
import subprocess
import wave
from pathlib import Path


# Tách câu đơn giản, hỗ trợ dấu câu đa ngôn ngữ (Latin, CJK, Ả Rập...).
_SENT_SPLIT = re.compile(r"(?<=[\.\!\?…。！？؟।])\s+|\n+")


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    parts = _SENT_SPLIT.split(text)
    return [p.strip() for p in parts if p and p.strip()]


def wav_duration(path: str | Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def concat_wavs(paths: list[str | Path], out_path: str | Path, gap_ms: int = 100) -> Path:
    """Ghép nhiều WAV (cùng SR/mono 16-bit) thành 1 file, chèn khoảng lặng giữa câu."""
    out_path = Path(out_path)
    if not paths:
        raise ValueError("Không có file để ghép")

    with wave.open(str(paths[0]), "rb") as w0:
        params = w0.getparams()
    sr = params.framerate
    silence = b"\x00\x00" * int(sr * gap_ms / 1000) * params.nchannels

    with wave.open(str(out_path), "wb") as out:
        out.setparams(params)
        for i, p in enumerate(paths):
            with wave.open(str(p), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))
            if i < len(paths) - 1:
                out.writeframes(silence)
    return out_path


def _fmt_ts(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec - int(sec)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(items: list[dict], out_path: str | Path, gap_ms: int = 100) -> Path:
    """items: [{"text": str, "duration": float}] theo đúng thứ tự đã ghép."""
    out_path = Path(out_path)
    lines = []
    t = 0.0
    for i, it in enumerate(items, 1):
        start = t
        end = t + it["duration"]
        lines.append(str(i))
        lines.append(f"{_fmt_ts(start)} --> {_fmt_ts(end)}")
        lines.append(it["text"])
        lines.append("")
        t = end + gap_ms / 1000.0
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def to_mp3(wav_path: str | Path, mp3_path: str | Path) -> Path:
    """Chuyển WAV -> MP3 bằng ffmpeg (đã có sẵn trên máy)."""
    mp3_path = Path(mp3_path)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav_path), "-b:a", "192k", str(mp3_path)],
        check=True, capture_output=True,
    )
    return mp3_path
