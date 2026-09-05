'Đồng bộ VideoExportSettings với thời lượng file nguồn thật trước khi xuất.'
from __future__ import annotations
from dataclasses import replace
from typing import Any

def clamp_export_settings_to_source_duration(settings: Any, *, source_path: str, source_duration_ms: int) -> Any:
    dur = max(1, int(source_duration_ms or 1))
    path = str(source_path or '').strip()
    values = {'timeline_clips': list(getattr(settings, 'timeline_clips', ()) or ()), 'trim_start_ms': int(getattr(settings, 'trim_start_ms', 0) or 0), 'trim_end_ms': int(getattr(settings, 'trim_end_ms', 0) or 0)}
    try:
        from core.timeline_clips import ensure_timeline_clips
        ensure_timeline_clips(values, source_duration_ms=dur, source_path=path)
    except Exception:
        pass
    trim_start = max(0, int(values.get('trim_start_ms', 0) or 0))
    if trim_start >= dur:
        trim_start = 0
    trim_end = int(values.get('trim_end_ms', 0) or 0)
    if trim_end > dur:
        trim_end = dur
    if 0 < trim_end <= trim_start:
        trim_end = 0
    clips = values.get('timeline_clips') or ()
    try:
        clips_tuple = tuple(clips)
    except TypeError:
        clips_tuple = tuple(getattr(settings, 'timeline_clips', ()) or ())
    return replace(settings, timeline_clips=clips_tuple, trim_start_ms=trim_start, trim_end_ms=trim_end)