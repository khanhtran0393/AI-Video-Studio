from __future__ import annotations
import threading
from collections.abc import Callable
from pathlib import Path
from core.subtitle_translation import SubtitleJobCancelled
from core.subtitles import SubtitleDocument, load_srt

def extract_hard_subtitles(video_path: str, output_srt: str, *, crop: tuple[float, float, float, float], sample_interval: float, confidence: float, progress: Callable[[int], None] | None, stop_event: threading.Event | None, extractor) -> SubtitleDocument:
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        _validate_crop(crop)
        if not 0.05 <= float(sample_interval) <= 10.0:
            raise ValueError('Khoảng đọc OCR phải nằm trong 0.05–10 giây')
        if 0.0 <= float(confidence) <= 1.0:
            destination = Path(output_srt).expanduser().resolve()
            destination.parent.mkdir(parents=True, exist_ok=True)
            stop = stop_event or threading.Event()
            _raise_if_cancelled(stop)
            last_progress = [-1]

            def emit(value: int) -> None:
                percent = max(0, min(100, int(value)))
                if percent == last_progress[0]:
                    return None
                last_progress[0] = percent
                if progress is not None:
                    progress(percent)
                    return None

            def on_progress(done: int, total: int, _message: str) -> None:
                if total > 0:
                    emit(round(done * 100 / total))
                    return None
            emit(0)
            if extractor is None:
                from exporter.ocr_extractor import extract_srt
                extractor = extract_srt
            result_path = extractor(str(source), crop, str(destination), sample_interval=float(sample_interval), min_confidence=float(confidence), progress_cb=on_progress, cancel_event=stop)
            _raise_if_cancelled(stop)
            result = load_srt(result_path or destination)
            if result.segments:
                emit(100)
                return result
            raise RuntimeError('OCR không đọc được câu phụ đề nào')
        raise ValueError('Độ tin cậy OCR phải nằm trong khoảng 0–1')
    raise ValueError('Video dùng để đọc chữ không tồn tại')

def _validate_crop(crop: tuple[float, float, float, float]) -> None:
    if len(crop) != 4:
        raise ValueError('Vùng chữ OCR không hợp lệ')
    left, top, right, bottom = [float(value) for value in crop]
    if not all((0.0 <= value <= 1.0 for value in (left, top, right, bottom))):
        raise ValueError('Vùng chữ OCR phải nằm trong khung video')
    if right - left < 0.01 or bottom - top < 0.01:
        raise ValueError('Vùng chữ OCR quá nhỏ hoặc bị đảo chiều')

def _raise_if_cancelled(stop_event: threading.Event) -> None:
    if stop_event.is_set():
        raise SubtitleJobCancelled('Đã dừng xử lý phụ đề')