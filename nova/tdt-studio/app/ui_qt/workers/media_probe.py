from __future__ import annotations
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from services_media import MediaInfo, probe_media_info

class MediaProbeSignals(QObject):
    completed = Signal(object)
    failed = Signal(str, str)
    finished = Signal(str)

class MediaProbeTask(QRunnable):

    def __init__(self, path: str, probe: Callable[[str], MediaInfo]=probe_media_info):
        super().__init__()
        self.path = path
        self.probe = probe
        self.signals = MediaProbeSignals()

    @Slot()
    def run(self) -> None:
        try:
            self.signals.completed.emit(self.probe(self.path))
        except Exception as exc:
            self.signals.failed.emit(self.path, str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit(self.path)