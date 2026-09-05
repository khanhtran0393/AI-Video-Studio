from __future__ import annotations
import ctypes
import os
import cv2

def open_video_robust(path: str, backend: int=cv2.CAP_FFMPEG):
    capture = cv2.VideoCapture(path, backend)
    if capture.isOpened():
        return capture
    is_non_ascii = bool(path) and any((ord(char) > 127 for char in path))
    short_path = None
    try:
        buffer = ctypes.create_unicode_buffer(260)
        result = ctypes.windll.kernel32.GetShortPathNameW(path, buffer, 260)
        if os.name == 'nt' and is_non_ascii and (result > 0) and buffer.value:
            short_path = buffer.value
    except Exception:
        short_path = None
    if short_path:
        capture.release()
        capture = cv2.VideoCapture(short_path, backend)
        if capture.isOpened():
            return capture
    else:
        for backend_name in ('CAP_MSMF', 'CAP_ANY'):
            fallback_backend = getattr(cv2, backend_name, None)
            if fallback_backend is None or fallback_backend == backend:
                pass
            else:
                capture.release()
                capture = cv2.VideoCapture(path, fallback_backend)
                if capture.isOpened():
                    return capture
                if short_path:
                    capture.release()
                    capture = cv2.VideoCapture(short_path, fallback_backend)
                    if capture.isOpened():
                        return capture
        return capture