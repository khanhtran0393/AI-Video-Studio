from __future__ import annotations
import threading
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from services_auto_blur import recenter_blur_zones_for_video

class AutoBlurSignals(QObject):
    progressChanged = Signal(str)
    completed = Signal(object, object)
    failed = Signal(str)
    finished = Signal()

class AutoBlurTask(QRunnable):

    def __init__(self, video_path: str, zones: list[dict], *, target_width: int, target_height: int):
        super().__init__()
        self.video_path = video_path
        self.zones = list(zones)
        self.target_width = target_width
        self.target_height = target_height
        self.stop_event = threading.Event()
        self.signals = AutoBlurSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng Auto che')
            moved, hint = (recenter_blur_zones_for_video(self.video_path, self.zones, target_width=self.target_width, target_height=self.target_height, log=lambda message: self.signals.progressChanged.emit(message))[0], recenter_blur_zones_for_video(self.video_path, self.zones, target_width=self.target_width, target_height=self.target_height, log=lambda message: self.signals.progressChanged.emit(message))[1])
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng Auto che')
            if moved is self.zones or moved == self.zones:
                pass
            self.signals.completed.emit(moved, hint)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()