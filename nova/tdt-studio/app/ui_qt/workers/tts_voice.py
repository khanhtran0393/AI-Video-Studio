from __future__ import annotations
import threading
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.subtitles import SubtitleDocument
from services_tts_voice import TTSVoiceSettings, generate_tts_voice_track

class TTSVoiceSignals(QObject):
    progressChanged = Signal(int, str)
    completed = Signal(str)
    failed = Signal(str)
    finished = Signal()

class TTSVoiceTask(QRunnable):

    def __init__(self, document: SubtitleDocument, video_path: str, output_dir: str, settings: TTSVoiceSettings | None=None, *, runner: Callable[..., str]):
        super().__init__()
        self.document = document
        self.video_path = video_path
        self.output_dir = output_dir
        self.settings = settings or TTSVoiceSettings()
        self.runner = runner
        self.stop_event = threading.Event()
        self.signals = TTSVoiceSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            result = self.runner(self.document, self.video_path, self.output_dir, self.settings, progress=lambda value: self.signals.progressChanged.emit(int(value), 'Đang tạo giọng đọc'), stop_event=self.stop_event)
            self.signals.completed.emit(result)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()