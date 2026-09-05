from __future__ import annotations
import threading
import time
import subprocess
import tempfile
from collections.abc import Callable
from pathlib import Path
from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from PySide6.QtGui import QImage
from config import FFMPEG_PATH
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)

class CompatibilityPreviewSignals(QObject):
    frameReady = Signal(object)
    failed = Signal(str)
    finished = Signal()

class CompatibilityPreviewTask(QRunnable):

    def __init__(self, path: str, *, start_ms: int, one_frame: bool, reader: Callable[[str], object] | None=None, max_width: int | None=None):
        super().__init__()
        self.path = path
        self.start_ms = max(0, int(start_ms))
        self.one_frame = bool(one_frame)
        self.reader = reader
        self.max_width = max_width
        self.stop_event = threading.Event()
        self.signals = CompatibilityPreviewSignals()

    def cancel(self) -> None:
        self.stop_event.set()

    def _emit_safe(self, signal_name: str, *args) -> None:
        if self.stop_event.is_set():
            pass
        else:
            try:
                getattr(self.signals, signal_name).emit(*args)
            except RuntimeError:
                pass

    @Slot()
    def run(self) -> None:
        if self.one_frame and self.reader is None:
            self._run_ffmpeg_thumbnail()
        else:
            capture = None
            try:
                import cv2
                if self.reader is None:
                    from core.video_reader import open_video_robust
                    reader = open_video_robust
                else:
                    reader = self.reader
                capture = reader(self.path)
                if capture.isOpened():
                    capture.set(cv2.CAP_PROP_POS_MSEC, self.start_ms)
                    fps = float(capture.get(cv2.CAP_PROP_FPS) or 25.0)
                    fps = max(1.0, min(60.0, fps))
                    frame_interval = 1.0 / fps
                    deadline = time.monotonic()
                    while not self.stop_event.is_set():
                        ok, frame = capture.read()
                        if ok and frame is not None:
                            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                            height, width, _channels = rgb.shape
                            image = QImage(rgb.data, width, height, int(rgb.strides[0]), QImage.Format.Format_RGB888).copy()
                            from PySide6.QtCore import Qt as QtCore_Qt
                            from ui_qt.playback import PREVIEW_DECODE_MAX_WIDTH, clamp_preview_decode_width
                            cap = clamp_preview_decode_width(self.max_width or PREVIEW_DECODE_MAX_WIDTH)
                            if image.width() > cap:
                                image = image.scaledToWidth(cap, QtCore_Qt.TransformationMode.SmoothTransformation)
                            self._emit_safe('frameReady', image)
                            if self.one_frame:
                                break
                            deadline += frame_interval
                            self.stop_event.wait(max(0.0, deadline - time.monotonic()))
                        else:
                            break
                else:
                    self._emit_safe('failed', 'Không thể mở video để xem trước')
            except Exception as exc:
                self._emit_safe('failed', str(exc) or 'Không thể đọc khung hình video')
            finally:
                if capture is not None:
                    capture.release()
                self._emit_safe('finished')
        return None

    def _run_ffmpeg_thumbnail(self) -> None:
        try:
            with tempfile.TemporaryDirectory(prefix='videotools-preview-') as temp_name:
                image_path = Path(temp_name) / 'frame.jpg'
                from ui_qt.playback import PREVIEW_DECODE_MAX_WIDTH, clamp_preview_decode_width
                cap = clamp_preview_decode_width(self.max_width or PREVIEW_DECODE_MAX_WIDTH)
                completed = subprocess.run([FFMPEG_PATH, '-y', '-nostdin', '-ss', f'{self.start_ms / 1000:.3f}', '-i', self.path, '-frames:v', '1', '-vf', f'scale={cap}:-2', '-q:v', '3', str(image_path)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
                if self.stop_event.is_set():
                    return None
                elif completed.returncode == 0 and image_path.exists():
                    image = QImage(str(image_path))
                    if image.isNull():
                        self._emit_safe('failed', 'Không thể đọc ảnh preview từ ffmpeg')
                        return None
                    self._emit_safe('frameReady', image.copy())
                else:
                    detail = (completed.stderr or completed.stdout or '').strip()
                    self._emit_safe('failed', 'Không thể lấy khung hình bằng ffmpeg' + (f': {detail}' if detail else ''))
                    return None
            return None
        except Exception as exc:
            self._emit_safe('failed', str(exc) or 'Không thể lấy khung hình video')
        finally:
            self._emit_safe('finished')