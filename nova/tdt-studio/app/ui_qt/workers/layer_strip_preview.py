'Strip frame nền/overlay/blend cho preview lúc Phát.\n\nMột lần ffmpeg → chuỗi frame (~12fps, rộng ≤1080) trong RAM.\nPaint chỉ index theo playhead — không seek từng frame (hết giật slideshow).\n'
from __future__ import annotations
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from PySide6.QtCore import QObject, QRunnable, Signal
from PySide6.QtGui import QImage
from config import FFMPEG_PATH
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
STRIP_FPS = 12.0
STRIP_WIDTH = 1080
STRIP_MAX_SECONDS = 12.0
STRIP_JPEG_Q = 3
STRIP_CACHE_MAX = 4
_cache_lock = threading.RLock()
_strip_cache: "dict[str, 'LayerStrip']" = {}
_building: 'set[str]' = set()

@dataclass
class LayerStrip:
    path: 'str'
    frames: 'list[QImage]'
    fps: 'float'
    duration_ms: 'int'

    def frame_at(self, sample_ms: int) -> QImage | None:
        if self.frames:
            ms = max(0, int(sample_ms))
            if self.duration_ms > 0:
                ms = ms % self.duration_ms
            idx = int(ms / 1000.0 * self.fps)
            idx = idx % len(self.frames)
            image = self.frames[idx]
            return None if image is None or image.isNull() else image

def strip_cache_key(path: str) -> str:
    try:
        stat = Path(path).stat()
    except OSError:
        return f'{path}|missing'

def get_cached_strip(path: str) -> LayerStrip | None:
    key = strip_cache_key(path)
    with _cache_lock:
        strip = _strip_cache.get(key)
        if strip is not None and strip.frames:
            return strip
        return None

def is_strip_building(path: str) -> bool:
    key = strip_cache_key(path)
    with _cache_lock:
        return key in _building

def _build_strip_sync(path: str) -> LayerStrip | None:
    file_path = str(path or '').strip()
    if file_path and Path(file_path).is_file():
        key = strip_cache_key(file_path)
        with _cache_lock:
            hit = _strip_cache.get(key)
            if hit is not None and hit.frames:
                return hit
            if key in _building:
                return None
            _building.add(key)
        try:
            try:
                with tempfile.TemporaryDirectory(prefix='vtp-layer-strip-') as temp_name:
                    out_dir = Path(temp_name)
                    pattern = str(out_dir / '%05d.jpg')
                    cmd = ['-loglevel', 'error', '-nostdin', '-y', '-i', file_path, '-t', f'{STRIP_MAX_SECONDS:.3f}', '-an', '-sn', '-vf', f"fps={STRIP_FPS:.3f},scale='min({STRIP_WIDTH},iw)':-2", '-q:v', str(STRIP_JPEG_Q), pattern]
                    completed = subprocess.run(cmd, capture_output=True, check=False, creationflags=CREATE_NO_WINDOW)
                    if completed.returncode != 0:
                        return None
                    else:
                        files = sorted(out_dir.glob('*.jpg'))
                        frames = []
                        for jpg in files:
                            image = QImage(str(jpg))
                            if image.isNull():
                                pass
                            else:
                                frames.append(image.copy())
                        if frames:
                            duration_ms = int(round(len(frames) * 1000.0 / STRIP_FPS))
                            strip = LayerStrip(path=file_path, frames=frames, fps=STRIP_FPS, duration_ms=max(1, duration_ms))
                            with _cache_lock:
                                _strip_cache[key] = strip
                                oldest = next(iter(_strip_cache))
                                if len(_strip_cache) > STRIP_CACHE_MAX and oldest != key:
                                    _strip_cache.pop(oldest, None)
                            with _cache_lock:
                                _building.discard(key)
                                return strip
                        else:
                            with _cache_lock:
                                _building.discard(key)
            except OSError:
                with _cache_lock:
                    _building.discard(key)
            with _cache_lock:
                _building.discard(key)
        except:
            with _cache_lock:
                _building.discard(key)
                raise
    else:
        return None

class LayerStripEmitter(QObject):
    ready = Signal(str, object)

class LayerStripBuildRunnable(QRunnable):

    def __init__(self, path: str, emitter: LayerStripEmitter):
        super().__init__()
        self._path = path
        self._emitter = emitter

    def run(self) -> None:
        strip = _build_strip_sync(self._path)
        self._emitter.ready.emit(self._path, strip)