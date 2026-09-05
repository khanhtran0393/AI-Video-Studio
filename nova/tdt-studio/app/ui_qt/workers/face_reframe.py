from __future__ import annotations
import threading
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from core.face_reframe import DEFAULT_PAN_AXIS, DEFAULT_SUBJECT_MODE, reframe_timeline_clips
from core.timeline_clips import TimelineClip

class FaceReframeSignals(QObject):
    progressChanged = Signal(str)
    completed = Signal(object, object)
    failed = Signal(str)
    finished = Signal()

class FaceReframeTask(QRunnable):

    def __init__(self, clips: list[TimelineClip], *, aspect_ratio: str, quality: str, fallback_path: str, subject_padding: float, plate_aspect: str, pan_axis: str, subject_mode: str, crop_norm: tuple[float, float, float, float] | None):
        super().__init__()
        self.clips = list(clips)
        self.aspect_ratio = str(aspect_ratio or '9:16')
        self.quality = str(quality or '1080p')
        self.fallback_path = str(fallback_path or '')
        self.subject_padding = float(subject_padding)
        self.plate_aspect = str(plate_aspect or '1:1')
        self.pan_axis = str(pan_axis or DEFAULT_PAN_AXIS)
        self.subject_mode = str(subject_mode or DEFAULT_SUBJECT_MODE)
        self.crop_norm = crop_norm
        self.stop_event = threading.Event()
        self.signals = FaceReframeSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    @Slot()
    def run(self) -> None:
        try:
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng auto căn mặt')
            try:
                import cv2
            except ImportError as exc:
                raise RuntimeError('Thiếu OpenCV (cv2) — không chạy được tự căn mặt/chủ thể.\nTrên máy anh em chạy:\n  python -m pip install opencv-python-headless\nhoặc bấm CAI_DAT_OPENCV.bat trong thư mục tool, rồi mở lại app.') from exc
            updated, results = (reframe_timeline_clips(self.clips, aspect_ratio=self.aspect_ratio, quality=self.quality, fallback_path=self.fallback_path, subject_padding=self.subject_padding, plate_aspect=self.plate_aspect, pan_axis=self.pan_axis, subject_mode=self.subject_mode, crop_norm=self.crop_norm, only_track0=True, stop_flag=self.stop_event.is_set, log=lambda m: self.signals.progressChanged.emit(m))[0], reframe_timeline_clips(self.clips, aspect_ratio=self.aspect_ratio, quality=self.quality, fallback_path=self.fallback_path, subject_padding=self.subject_padding, plate_aspect=self.plate_aspect, pan_axis=self.pan_axis, subject_mode=self.subject_mode, crop_norm=self.crop_norm, only_track0=True, stop_flag=self.stop_event.is_set, log=lambda m: self.signals.progressChanged.emit(m))[1])
            if self.stop_event.is_set():
                raise RuntimeError('Đã dừng auto căn mặt')
            self.signals.completed.emit(updated, results)
        except Exception as exc:
            self.signals.failed.emit(str(exc) or exc.__class__.__name__)
        finally:
            self.signals.finished.emit()