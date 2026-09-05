'Cache stem giọng / nhạc trong video (Demucs).'
from __future__ import annotations
import os
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable
from core.demucs_separate import demucs_combo_separate, friendly_demucs_error, run_demucs_dual_stems, video_instrumental_stem_cache_path, video_vocal_stem_cache_path
ProgressCallback = Callable[[str, int | None], None]

def is_qt_gui_thread() -> bool:
    try:
        from PySide6.QtCore import QThread
        from PySide6.QtWidgets import QApplication
        app = QApplication.instance()
        if app is None:
            return False
    except Exception:
        return False

def ensure_video_stem_cache(video_path: str, progress: ProgressCallback | None=None, stop_event: threading.Event | None=None) -> tuple[bool, str, str, str]:

    def _stopped() -> bool:
        return stop_event is not None and stop_event.is_set()
    path = str(video_path or '').strip()
    if path and Path(path).is_file():
        vocal_path = video_vocal_stem_cache_path(path)
        inst_path = video_instrumental_stem_cache_path(path)

        def _cb(msg: str, pct: int | None=None) -> None:
            if progress is not None:
                progress(msg, pct)
                return None
        need_v = not os.path.isfile(vocal_path)
        need_i = not os.path.isfile(inst_path)
        if not need_v and (not need_i):
            _cb('Đã có file tách sẵn (cache) — không chạy AI lại cho clip này', 100)
            return (True, '', vocal_path, inst_path)
        if _stopped():
            return (False, 'Đã dừng tách audio', '', '')
        if is_qt_gui_thread():
            return (False, 'Tách stem không chạy trên UI thread (chạy nền khi xuất)', '', '')
        ok, err = (run_demucs_dual_stems(path, vocal_path, inst_path, status_cb=_cb, stop_event=stop_event)[0], run_demucs_dual_stems(path, vocal_path, inst_path, status_cb=_cb, stop_event=stop_event)[1])
        return (False, 'Đã dừng tách audio', '', '') if _stopped() else ((True, '', vocal_path, inst_path) if os.path.isfile(vocal_path) and os.path.isfile(inst_path) else (False, 'Không tạo đủ file stem', '', '')) if ok else (False, friendly_demucs_error(err or 'Tách audio clip thất bại'), '', '')
    return (False, 'Không có file video', '', '')

def attach_stems_to_export_settings(settings: Any, video_path: str, *, allow_separate: bool, progress: ProgressCallback | None, stop_event: threading.Event | None, raise_on_failure: bool) -> Any:
    from core.audio_mix_state import video_mix_needs_stems
    mix = {'video_vocal_enabled': bool(getattr(settings, 'video_vocal_enabled', False)), 'video_bgm_enabled': bool(getattr(settings, 'video_bgm_enabled', False)), 'video_vocal_volume': int(getattr(settings, 'video_vocal_volume', 0) or 0), 'video_bgm_volume': int(getattr(settings, 'video_bgm_volume', 0) or 0)}
    needs = video_mix_needs_stems(mix)
    if needs:
        path = str(video_path or '').strip()
        vocal_cache = video_vocal_stem_cache_path(path) if path else ''
        inst_cache = video_instrumental_stem_cache_path(path) if path else ''
        if path and Path(vocal_cache).is_file() and Path(inst_cache).is_file():
            return replace(settings, video_vocal_stem_path=vocal_cache, video_instrumental_stem_path=inst_cache)
        if allow_separate and path:

            def _cb(msg: str, pct: int | None=None) -> None:
                if progress is not None:
                    progress(msg, pct)
                    return None
            ok, err, v_path, i_path = (ensure_video_stem_cache(path, progress=_cb, stop_event=stop_event)[0], ensure_video_stem_cache(path, progress=_cb, stop_event=stop_event)[1], ensure_video_stem_cache(path, progress=_cb, stop_event=stop_event)[2], ensure_video_stem_cache(path, progress=_cb, stop_event=stop_event)[3])
            if ok and v_path and i_path:
                return replace(settings, video_vocal_stem_path=v_path, video_instrumental_stem_path=i_path)
            if raise_on_failure:
                detail = (err or '').strip() or 'Tách stem thất bại'
                raise RuntimeError(f'Không tách được nhạc gốc/giọng từ video — {detail}. Xuất sẽ thiếu nhạc gốc nếu bỏ qua. Kiểm tra Demucs/PyTorch hoặc thử lại.')
        elif raise_on_failure:
            raise RuntimeError('Thiếu file stem (nhạc gốc / giọng video). Bật tách stem khi xuất hoặc chạy lại Demucs.')
    return replace(settings, video_vocal_stem_path='', video_instrumental_stem_path='')

def resolve_original_audio_wav(video_path: str, *, remove_vocal: bool, remove_bgm: bool, progress: ProgressCallback | None) -> tuple[bool, str, str]:
    from core.demucs_separate import stems_to_remove, vocal_sep_combo_cache_path
    path = str(video_path or '').strip()
    if path and Path(path).is_file():
        stems = stems_to_remove(remove_vocal, remove_bgm)
        if stems:
            cache = vocal_sep_combo_cache_path(path, stems)
            if os.path.isfile(cache):
                return (True, '', cache)

            def _cb(msg: str, pct: int | None=None) -> None:
                if progress is not None:
                    progress(msg, pct)
                    return None
            if is_qt_gui_thread():
                return (False, 'Tách audio không chạy trên UI thread', '')
            ok, err = (demucs_combo_separate(path, cache, stems, status_cb=_cb)[0], demucs_combo_separate(path, cache, stems, status_cb=_cb)[1])
            return ((True, '', cache) if os.path.isfile(cache) else (False, 'Không tạo được file audio sau tách', '')) if ok else (False, friendly_demucs_error(err or 'Tách audio thất bại'), '')
        return (True, '', '')
    return (False, 'Không có file video', '')