from __future__ import annotations
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from ui_qt.media_thumbnails import media_thumbnail_icon, invalidate_thumbnail_cache
try:
    from core.ml_runtime import is_demucs_busy
except Exception:

    def is_demucs_busy() -> bool:
        return False

class ThumbnailSignals(QObject):
    loaded = Signal(str, object)

class ThumbnailLoadTask(QRunnable):

    def __init__(self, asset_id: str, path: str, kind: str, width: int, height: int):
        super().__init__()
        self.asset_id = asset_id
        self.path = path
        self.kind = kind
        self.width = width
        self.height = height
        self.signals = ThumbnailSignals()

    @Slot()
    def run(self) -> None:
        try:
            if is_demucs_busy():
                icon = media_thumbnail_icon('', self.kind, width=self.width, height=self.height)
                self.signals.loaded.emit(self.asset_id, icon)
                return None
            invalidate_thumbnail_cache(self.path, self.kind)
            icon = media_thumbnail_icon(self.path, self.kind, width=self.width, height=self.height)
        except Exception:
            icon = media_thumbnail_icon('', self.kind, width=self.width, height=self.height)
        self.signals.loaded.emit(self.asset_id, icon)