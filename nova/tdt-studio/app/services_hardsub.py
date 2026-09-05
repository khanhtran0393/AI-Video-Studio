from __future__ import annotations
import threading
from pathlib import Path
from typing import Callable

def remove_hardsub_from_video(video_path: str, output_path: str | Path | None=None, *, method: str, roi: tuple[float, float, float, float] | None, progress: Callable[[int], None] | None, stop_event: threading.Event | None) -> str:
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        destination = Path(output_path).expanduser().resolve() if output_path else source.with_name(f'{source.stem}_clean{source.suffix}')
        stop = stop_event or threading.Event()
        roi_fixed = _sanitize_hardsub_roi(roi)

        def _progress(done: int, total: int, _message: str) -> None:
            if stop.is_set():
                raise RuntimeError('Đã dừng xóa hardsub')
            if progress is not None:
                if total > 0:
                    progress(max(0, min(100, round(done * 100 / total))))
                return None
        from exporter.hardsub_remover import remove_hardsub
        result = remove_hardsub(str(source), str(destination), method=method, roi_fixed=roi_fixed, progress_cb=_progress, stop_flag=stop)
        if stop.is_set():
            raise RuntimeError('Đã dừng xóa hardsub')
        if result and Path(result).is_file():
            resolved = Path(result).resolve()
            if resolved == source:
                raise RuntimeError('Đã dừng xóa hardsub')
            if progress is not None:
                progress(100)
            return str(resolved)
        raise RuntimeError('Không tạo được video đã xóa hardsub')
    raise ValueError('Video nguồn không tồn tại')

def _sanitize_hardsub_roi(roi: tuple[float, float, float, float] | None) -> tuple[float, float, float, float]:
    if roi is None:
        return (0.0, 0.82, 1.0, 1.0)
    x1, y1, x2, y2 = ([max(0.0, min(1.0, float(value))) for value in roi][0], [max(0.0, min(1.0, float(value))) for value in roi][1], [max(0.0, min(1.0, float(value))) for value in roi][2], [max(0.0, min(1.0, float(value))) for value in roi][3])
    if x2 < x1:
        x2, x1 = (x1, x2)
    if y2 < y1:
        y2, y1 = (y1, y2)
    width = x2 - x1
    height = y2 - y1
    return (0.0, 0.82, 1.0, 1.0) if width < 0.2 or height < 0.08 else (x1, y1, x2, y2)