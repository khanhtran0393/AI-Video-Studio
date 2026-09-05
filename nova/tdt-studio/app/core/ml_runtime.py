'Cờ runtime cho job AI nặng (Demucs) — tránh va chạm thread Qt/PyAV/torch.'
from __future__ import annotations
import threading
from contextlib import contextmanager
from typing import Iterator
_lock = threading.RLock()
_demucs_depth = 0

def is_demucs_busy() -> bool:
    with _lock:
        return _demucs_depth > 0

@contextmanager
def demucs_busy_scope() -> Iterator[None]:
    with _lock:
        _demucs_depth += 1
    try:
        yield None
    except:
        with _lock:
            _demucs_depth = max(0, _demucs_depth - 1)
            raise
    with _lock:
        _demucs_depth = max(0, _demucs_depth - 1)