from __future__ import annotations
import threading
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from services_hardsub import remove_hardsub_from_video

class HardsubSignals(QObject):
    progressChanged = Signal(str)
    completed = Signal(str)
    failed = Signal(str)
    finished = Signal()

class HardsubTask(QRunnable):

    def __init__(self, video_path: str, output_path: str, *, roi: tuple[float, float, float, float] | None, runner: Callable[..., str]):
        super().__init__()
        self.video_path = video_path
        self.output_path = output_path
        self.roi = roi
        self.runner = runner
        self.stop_event = threading.Event()
        self.signals = HardsubSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:

            def on_progress(value: int) -> None:
                self.signals.progressChanged.emit(f'Đang xóa hardsub… {value}%')
            result = self.runner(self.video_path, self.output_path, roi=self.roi, progress=on_progress, stop_event=self.stop_event)
            self.signals.completed.emit(result)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()