from __future__ import annotations
import threading
from collections.abc import Callable
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.subtitle_translation import TranslationSettings, translate_document
from core.subtitles import SubtitleDocument
from providers.ai.probe import ProviderProbeResult, probe_translation_provider
from services_subtitle_ocr import extract_hard_subtitles
from services_subtitle_stt import SpeechSettings, transcribe_video

class SubtitleJobSignals(QObject):
    progressChanged = Signal(int, str)
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

class ProviderProbeSignals(QObject):
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

class _SubtitleJobTask(QRunnable):

    def __init__(self, status_text: str, *, secrets):
        super().__init__()
        self.status_text = status_text
        self.stop_event = threading.Event()
        self.signals = SubtitleJobSignals()
        self._secrets = tuple((str(secret) for secret in secrets if secret))

    def cancel(self) -> None:
        self.stop_event.set()

    def _progress(self, value: int, message: str='') -> None:
        if message:
            self.status_text = str(message)
        self.signals.progressChanged.emit(int(value), self.status_text)

    def _execute(self) -> SubtitleDocument:
        raise NotImplementedError

    @Slot()
    def run(self) -> None:
        try:
            result = self._execute()
            self.signals.completed.emit(result)
        except Exception as exc:
            message = str(exc) or exc.__class__.__name__
            for secret in self._secrets:
                message = message.replace(secret, '••••')
            self.signals.failed.emit(message)
        finally:
            self.signals.finished.emit()

class ProviderProbeTask(QRunnable):

    def __init__(self, provider_id: str, model: str, api_key: str, *, runner: Callable[..., ProviderProbeResult]):
        super().__init__()
        self.provider_id = provider_id
        self.model = model
        self.api_key = api_key
        self.runner = runner
        self.signals = ProviderProbeSignals()
        self._secrets = tuple((str(s) for s in (api_key or '').split if str(s).strip()))

    @Slot()
    def run(self) -> None:
        try:
            result = self.runner(self.provider_id, self.model, self.api_key)
            self.signals.completed.emit(result)
        except Exception as exc:
            message = str(exc) or exc.__class__.__name__
            for secret in self._secrets:
                message = message.replace(secret, '••••')
            self.signals.failed.emit(message)
        finally:
            self.signals.finished.emit()

class TranslationTask(_SubtitleJobTask):

    def __init__(self, document: SubtitleDocument, settings: TranslationSettings, key: str, *, runner: Callable[..., SubtitleDocument]):
        super().__init__('Đang dịch phụ đề', secrets=(key,))
        self.document = document
        self.settings = settings
        self.key = key
        self.runner = runner

    def _execute(self) -> SubtitleDocument:
        return self.runner(self.document, self.settings, key=self.key, progress=self._progress, stop_event=self.stop_event)

class SpeechRecognitionTask(_SubtitleJobTask):

    def __init__(self, video_path: str, settings: SpeechSettings, api_key: str='', *, runner: Callable[..., SubtitleDocument]):
        super().__init__('Đang nhận dạng giọng nói', secrets=(api_key,))
        self.video_path = video_path
        self.settings = settings
        self.api_key = api_key
        self.runner = runner

    def _execute(self) -> SubtitleDocument:
        return self.runner(self.video_path, self.settings, api_key=self.api_key, progress=self._progress, stop_event=self.stop_event)

class OCRSubtitleTask(_SubtitleJobTask):

    def __init__(self, video_path: str, output_srt: str, *, crop: tuple[float, float, float, float], sample_interval: float, confidence: float, runner: Callable[..., SubtitleDocument]):
        super().__init__('Đang đọc chữ trên video')
        self.video_path = video_path
        self.output_srt = output_srt
        self.crop = crop
        self.sample_interval = sample_interval
        self.confidence = confidence
        self.runner = runner

    def _execute(self) -> SubtitleDocument:
        return self.runner(self.video_path, self.output_srt, crop=self.crop, sample_interval=self.sample_interval, confidence=self.confidence, progress=self._progress, stop_event=self.stop_event)