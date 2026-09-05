'Thumbnail cho media library — cache ffmpeg, placeholder khi chưa có.'
from __future__ import annotations
import hashlib
import subprocess
import tempfile
from pathlib import Path
from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QColor, QFont, QIcon, QImage, QPainter, QPixmap
from config import FFMPEG_PATH
try:
    from core.ml_runtime import is_demucs_busy
except Exception:

    def is_demucs_busy() -> bool:
        return False
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
_THUMB_DIR = Path(tempfile.gettempdir()) / 'VideoToolsPro' / 'thumbs'
_ICON_CACHE: 'dict[tuple[str, int, int], QIcon]' = {}
_KIND_COLORS = {'video': '#2F6FE8', 'audio': '#27A87B', 'subtitle': '#9D62E8', 'image': '#E67E4D'}
_KIND_LABELS = {'video': 'VIDEO', 'audio': 'NHẠC', 'subtitle': 'CC', 'image': 'ẢNH'}

def _cache_path(source: Path) -> Path:
    try:
        stat = source.stat()
        digest = hashlib.sha1(f'{source.resolve()}:{stat.st_mtime_ns}'.encode('utf-8')).hexdigest()[:18]
    except OSError:
        digest = hashlib.sha1(str(source).encode('utf-8')).hexdigest()[:18]
    return _THUMB_DIR / f'{digest}.jpg'

def _extract_video_frame(source: Path, dest: Path) -> bool:
    completed = subprocess.run([FFMPEG_PATH, '-y', '-nostdin', '-ss', '0.35', '-i', str(source), '-frames:v', '1', '-q:v', '4', str(dest)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
    return completed.returncode == 0 and dest.is_file() and (dest.stat().st_size > 0)

def _load_image(path: Path) -> QImage | None:
    image = QImage(str(path))
    return None if image.isNull() else image

def _placeholder_pixmap(kind: str, width: int, height: int) -> QPixmap:
    pixmap = QPixmap(width, height)
    pixmap.fill(QColor('#1A2436'))
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setPen(QColor(_KIND_COLORS.get(kind, '#4C5D78')))
    painter.setBrush(QColor(_KIND_COLORS.get(kind, '#4C5D78')).darker(160))
    painter.drawRoundedRect(2, 2, width - 4, height - 4, 6, 6)
    painter.setPen(QColor('#E8EEF8'))
    font = QFont()
    font.setPointSize(9)
    font.setBold(True)
    painter.setFont(font)
    painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, _KIND_LABELS.get(kind, 'TỆP'))
    painter.end()
    return pixmap

def _scaled_pixmap(image: QImage, width: int, height: int) -> QPixmap:
    return QPixmap.fromImage(image).scaled(width, height, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)

def media_thumbnail_icon_cached_only(path: str, kind: str, *, width: int, height: int) -> QIcon:
    key = (f'{kind}:{path}', width, height)
    cached = _ICON_CACHE.get(key)
    if cached is not None:
        return cached
    if is_demucs_busy():
        return QIcon(_placeholder_pixmap(kind, width, height))
    pixmap = None
    source = Path(path or '').expanduser()
    if kind == 'image':
        image = _load_image(source)
        if source.is_file() and image is not None:
            pixmap = _scaled_pixmap(image, width, height)
    else:
        cache_file = _cache_path(source)
        image = _load_image(cache_file)
        if kind == 'video' and cache_file.is_file() and (image is not None):
            pixmap = _scaled_pixmap(image, width, height)
    if pixmap is None:
        return QIcon(_placeholder_pixmap(kind, width, height))
    icon = QIcon(pixmap)
    _ICON_CACHE[key] = icon
    return icon

def invalidate_thumbnail_cache(path: str, kind: str='') -> None:
    needle = f':{path}'
    doomed = [key for key in list(_ICON_CACHE) if needle in str(key[0]) if not kind or str(key[0]).startswith(f'{kind}:')]
    for key in doomed:
        _ICON_CACHE.pop(key, None)

def media_thumbnail_icon(path: str, kind: str, *, width: int, height: int) -> QIcon:
    key = (f'{kind}:{path}', width, height)
    cached = _ICON_CACHE.get(key)
    if cached is not None:
        return cached
    pixmap = None
    source = Path(path or '').expanduser()
    if kind == 'image':
        image = _load_image(source)
        if source.is_file() and image is not None:
            pixmap = _scaled_pixmap(image, width, height)
    elif kind == 'video':
        cache_file = _cache_path(source)
        if not cache_file.is_file():
            _THUMB_DIR.mkdir(parents=True, exist_ok=True)
            completed = subprocess.run([FFMPEG_PATH, '-y', '-nostdin', '-i', str(source), '-frames:v', '1', '-q:v', '4', str(cache_file)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
            if not _extract_video_frame(source, cache_file) and (completed.returncode != 0 or not cache_file.is_file() or cache_file.stat().st_size <= 0):
                cache_file.unlink(missing_ok=True)
        image = _load_image(cache_file)
        if cache_file.is_file() and image is not None:
            pixmap = _scaled_pixmap(image, width, height)
    if pixmap is None:
        return QIcon(_placeholder_pixmap(kind, width, height))
    icon = QIcon(pixmap)
    _ICON_CACHE[key] = icon
    return icon

def media_thumbnail_pixmap_cached_only(path: str, kind: str='video', *, width: int, height: int) -> QPixmap:
    icon = media_thumbnail_icon_cached_only(path, kind, width=width, height=height)
    return icon.pixmap(QSize(width, height))
FILMSTRIP_THUMB_W = 112
FILMSTRIP_THUMB_H = 63

def media_thumbnail_pixmap_if_ready(path: str, kind: str='video', *, width: int, height: int) -> QPixmap | None:
    key = (f'{kind}:{path}', int(width), int(height))
    cached = _ICON_CACHE.get(key)
    if cached is not None:
        pix = cached.pixmap(QSize(width, height))
        return None if pix.isNull() else pix
    if is_demucs_busy():
        return None
    pixmap = None
    source = Path(path or '').expanduser()
    if kind == 'image':
        image = _load_image(source)
        if source.is_file() and image is not None:
            pixmap = _scaled_pixmap(image, width, height)
    else:
        cache_file = _cache_path(source)
        image = _load_image(cache_file)
        if kind == 'video' and cache_file.is_file() and (image is not None):
            pixmap = _scaled_pixmap(image, width, height)
    if pixmap is None or pixmap.isNull():
        return None
    _ICON_CACHE[key] = QIcon(pixmap)
    return pixmap