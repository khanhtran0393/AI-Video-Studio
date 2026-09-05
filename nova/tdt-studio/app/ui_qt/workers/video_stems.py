from __future__ import annotations
import threading
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.video_stem_audio import ensure_video_stem_cache

def _lower_demucs_thread_priority() -> None:
    try:
        import sys
        if sys.platform == 'win32':
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetThreadPriority(kernel32.GetCurrentThread(), -1)
        else:
            return None
    except Exception:
        pass

class VideoStemSignals(QObject):
    progressChanged = Signal(str)
    completed = Signal(str, str)
    failed = Signal(str)
    finished = Signal()

class VideoStemTask(QRunnable):

    def __init__(self, video_path: str):
        super().__init__()
        self.video_path = video_path
        self.stop_event = threading.Event()
        self.signals = VideoStemSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            _lower_demucs_thread_priority()
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng tách audio')

            def _progress(msg: str, pct: int | None=None) -> None:
                if self.stop_event.is_set():
                    return None
                text = msg
                if pct is not None:
                    text = f'{msg} ({pct}%)'
                self.signals.progressChanged.emit(text)
            ok, err, vocal, inst = (ensure_video_stem_cache(self.video_path, progress=_progress, stop_event=self.stop_event)[0], ensure_video_stem_cache(self.video_path, progress=_progress, stop_event=self.stop_event)[1], ensure_video_stem_cache(self.video_path, progress=_progress, stop_event=self.stop_event)[2], ensure_video_stem_cache(self.video_path, progress=_progress, stop_event=self.stop_event)[3])
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng tách audio')
            if ok:
                self.signals.completed.emit(str(vocal or ''), str(inst or ''))
            else:
                raise RuntimeError(err or 'Tách audio thất bại')
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()