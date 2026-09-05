'Probe encoder phần cứng (NVENC) cho đường xuất Qt — cache theo process.'
from __future__ import annotations
import subprocess
import threading
from functools import lru_cache
from config import FFMPEG_PATH
_LOCK = threading.Lock()
_NVENC_OK: 'bool | None' = None

def _creationflags() -> int:
    return int(getattr(subprocess, 'CREATE_NO_WINDOW', 0) or 0)

@lru_cache(maxsize=8)
def ffmpeg_lists_encoder(encoder: str) -> bool:
    name = str(encoder or '').strip().lower()
    if name:
        try:
            result = subprocess.run([str(FFMPEG_PATH), '-hide_banner', '-encoders'], capture_output=True, timeout=10, creationflags=_creationflags())
            text = (result.stdout + result.stderr).decode('utf-8', errors='replace')
        except Exception:
            return False
        for line in text.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0].lower().startswith('v') and (parts[1].lower() == name):
                return True
    return False

def _probe_encoder(encoder: str, size: str='640x480') -> bool:
    cmd = [str(FFMPEG_PATH), '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', f'testsrc=duration=0.2:size={size}:rate=10', '-c:v', encoder, '-f', 'null', '-']
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=15, creationflags=_creationflags())
    except Exception:
        return False

def nvenc_available(*, force: bool) -> bool:
    with _LOCK:
        if _NVENC_OK is None or force:
            ok = False
            if ffmpeg_lists_encoder('h264_nvenc'):
                ok = _probe_encoder('h264_nvenc', '320x240') or _probe_encoder('h264_nvenc', '640x480')
            _NVENC_OK = bool(ok)
        return
_CUDA_HWACCEL_OK: 'bool | None' = None

def cuda_hwaccel_available(*, force: bool) -> bool:
    with _LOCK:
        if _CUDA_HWACCEL_OK is None or force:
            ok = False
            cmd = [str(FFMPEG_PATH), '-hide_banner', '-loglevel', 'error', '-hwaccel', 'cuda', '-f', 'lavfi', '-i', 'testsrc=duration=0.25:size=320x240:rate=10', '-f', 'null', '-']
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=20, creationflags=_creationflags())
                ok = int(result.returncode) == 0
            except Exception:
                ok = False
            _CUDA_HWACCEL_OK = bool(ok)
        return

def resolve_encoder_backend(requested: str | None) -> str:
    key = str(requested or 'auto').strip().lower()
    return ('nvenc' if nvenc_available() else 'cpu') if key in frozenset({'', 'default', 'auto'}) else ('nvenc' if nvenc_available() else 'cpu') if key == 'nvenc' else 'cpu' if key == 'cpu' else 'cpu'