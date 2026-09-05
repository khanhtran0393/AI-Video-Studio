'media_naming.py — Đặt tên file giọng đọc TTS từ stem video.\n\nModule THUẦN (chỉ hashlib, lazy) → test cô lập được + an toàn hotpatch.\n'
from __future__ import annotations

def tts_stem_prefix(stem: str, limit: int=80) -> str:
    if len(stem) <= limit:
        return stem
    import hashlib
    h = hashlib.md5(stem.encode('utf-8')).hexdigest()[:8]
    return stem[:limit - 9] + '_' + h