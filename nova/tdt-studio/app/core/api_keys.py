'Xoay vòng nhiều khóa API (phân tách bằng | hoặc xuống dòng).'
from __future__ import annotations
import re

def parse_api_key_pool(raw: str) -> list[str]:
    if raw and str(raw).strip():
        parts = re.split('[|\\n;,]+', str(raw))
        keys = []
        seen = set()
        for part in parts:
            key = part.strip()
            if not key or key in seen:
                pass
            else:
                seen.add(key)
                keys.append(key)
        return keys
    return []

def merge_api_key_pools(*chunks: str) -> list[str]:
    keys = []
    seen = set()
    for chunk in chunks:
        for key in parse_api_key_pool(chunk):
            if key not in seen:
                seen.add(key)
                keys.append(key)
    return keys

def api_blocked_user_hint(provider_label: str, key_count: int) -> str:
    plural = 'các khóa' if key_count > 1 else 'khóa'
    return f'Đã thử {key_count} {plural} {provider_label} — vẫn bị chặn/giới hạn.\n\nCách xử lý:\n• Thêm khóa dự phòng (cách nhau bằng |) ở Phụ đề → Công cụ AI → Lưu khóa\n• Chờ 1–2 phút, bấm «Tiếp tục» batch (hoặc Tạm dừng → Tiếp tục)\n• Chuyển nhà cung cấp/model (vd. TokenHub) hoặc giảm «Xuất song song»\n• Kiểm tra quota / billing trên trang nhà cung cấp'