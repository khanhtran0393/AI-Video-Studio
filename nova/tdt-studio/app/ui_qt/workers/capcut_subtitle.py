from __future__ import annotations
import threading
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from services_capcut_subtitle import generate_capcut_api_subtitle, generate_capcut_subtitle

class CapCutSubtitleSignals(QObject):
    progressChanged = Signal(int, str)
    completed = Signal(str)
    failed = Signal(str)
    finished = Signal()

class CapCutSubtitleTask(QRunnable):

    def __init__(self, video_path: str, output_dir: str, *, mode: str, runner: Callable[..., str] | None):
        super().__init__()
        self.video_path = video_path
        self.output_dir = output_dir
        self.mode = mode
        self.runner = runner or (generate_capcut_api_subtitle if mode == 'api' else generate_capcut_subtitle)
        self.stop_event = threading.Event()
        self.signals = CapCutSubtitleSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            result = self.runner(self.video_path, self.output_dir, progress=self.signals.progressChanged.emit, stop_event=self.stop_event)
            self.signals.completed.emit(result)
        except Exception as exc:
            if str(exc):
                self.signals.failed.emit(f'{exc.__class__.__name__}: {exc}')
        finally:
            self.signals.finished.emit()