from __future__ import annotations
from pathlib import Path
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.scene_detect import DEFAULT_MIN_SCENE_MS, DEFAULT_SCENE_THRESHOLD, detect_scene_cut_ms

class SceneDetectSignals(QObject):
    progressChanged = Signal(str)
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

class SceneDetectTask(QRunnable):

    def __init__(self, video_path: str, *, start_ms: int, end_ms: int, threshold: float, min_scene_ms: int):
        super().__init__()
        self.video_path = str(video_path)
        self.start_ms = max(0, int(start_ms))
        self.end_ms = max(0, int(end_ms))
        self.threshold = float(threshold)
        self.min_scene_ms = max(100, int(min_scene_ms))
        self.signals = SceneDetectSignals()
        self._cancelled = False

    def cancel(self) -> None:
        self._cancelled = True

    @Slot()
    def run(self) -> None:
        try:
            if self._cancelled:
                raise RuntimeError('Đã dừng tách cảnh')
            path = Path(self.video_path)
            if path.is_file():
                end_ms = int(self.end_ms)
                if end_ms < 2000:
                    try:
                        from services_media import resolve_export_source_duration_ms
                        self.signals.progressChanged.emit('Đang đo độ dài video…')
                        end_ms = int(resolve_export_source_duration_ms(path, self.end_ms) or 0)
                    except Exception:
                        end_ms = int(self.end_ms)
                if self._cancelled:
                    raise RuntimeError('Đã dừng tách cảnh')
                self.signals.progressChanged.emit('Đang tách cảnh tự động…')
                cuts = detect_scene_cut_ms(path, start_ms=self.start_ms, end_ms=end_ms, threshold=self.threshold, min_scene_ms=self.min_scene_ms)
                if self._cancelled:
                    raise RuntimeError('Đã dừng tách cảnh')
                self.signals.completed.emit(cuts)
            else:
                raise FileNotFoundError(f'Không tìm thấy video: {path}')
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()