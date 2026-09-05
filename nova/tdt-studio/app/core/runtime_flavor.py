'Cờ bản chạy — source vs gói đóng (exe / sys.frozen). Không Qt.'
from __future__ import annotations
import sys

def is_frozen_packaged() -> bool:
    return bool(getattr(sys, 'frozen', False))