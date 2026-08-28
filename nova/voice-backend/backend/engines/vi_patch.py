"""Vá tokenizer XTTS để hỗ trợ tiếng Việt.

coqui-tts 0.27.5 chưa có nhánh "vi" trong preprocess_text (dù viXTTS checkpoint
liệt kê 'vi'). Ta thêm cleaner nhẹ: hạ chữ thường, đọc số bằng num2words(vi),
đọc vài ký hiệu thường gặp (%, °C, m²...), gộp khoảng trắng.

Không dùng vinorm vì binary của nó không chạy trên Apple Silicon (arm64).
"""
from __future__ import annotations

import re

_applied = False

# Ký hiệu -> cách đọc tiếng Việt
_VI_SYMBOLS = [
    (r"°\s*C", " độ xê"),
    (r"°\s*F", " độ ép"),
    (r"°", " độ"),
    (r"%", " phần trăm"),
    (r"m²", " mét vuông"),
    (r"m³", " mét khối"),
    (r"km/h", " ki lô mét trên giờ"),
    (r"&", " và "),
    (r"\+", " cộng "),
    (r"=", " bằng "),
]

_num_re = re.compile(r"\d[\d.,]*")


def _read_number(m: str) -> str:
    from num2words import num2words

    raw = m.group(0)
    # bỏ dấu phân tách hàng nghìn kiểu 1.000 / 1,000
    cleaned = raw.replace(".", "").replace(",", "")
    if not cleaned.isdigit():
        return raw
    try:
        return num2words(int(cleaned), lang="vi")
    except Exception:
        return raw


def _vi_cleaner(txt: str) -> str:
    txt = txt.replace('"', "")
    for pat, repl in _VI_SYMBOLS:
        txt = re.sub(pat, repl, txt)
    txt = _num_re.sub(_read_number, txt)
    txt = txt.lower()
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def apply_patch() -> None:
    """Gắn nhánh 'vi' vào VoiceBpeTokenizer.preprocess_text (idempotent)."""
    global _applied
    if _applied:
        return
    import TTS.tts.layers.xtts.tokenizer as tk

    orig = tk.VoiceBpeTokenizer.preprocess_text

    def patched(self, txt, lang):
        if lang == "vi":
            return _vi_cleaner(txt)
        return orig(self, txt, lang)

    tk.VoiceBpeTokenizer.preprocess_text = patched
    _applied = True
