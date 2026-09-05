from __future__ import annotations
import threading
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from services_tts_voice import TTSVoiceSettings, preview_tts_sample

class TTSPreviewSignals(QObject):
    completed = Signal(str)
    failed = Signal(str)
    finished = Signal()

class TTSPreviewTask(QRunnable):

    def __init__(self, sample_text: str, output_dir: str, settings: TTSVoiceSettings | None=None, *, preview_token: int, runner: Callable[..., str]):
        super().__init__()
        self.sample_text = sample_text
        self.output_dir = output_dir
        self.settings = settings or TTSVoiceSettings()
        self.preview_token = preview_token
        self.runner = runner
        self.stop_event = threading.Event()
        self.signals = TTSPreviewSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng thử giọng')
            result = self.runner(self.sample_text, self.settings, self.output_dir)
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng thử giọng')
            self.signals.completed.emit(result)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()