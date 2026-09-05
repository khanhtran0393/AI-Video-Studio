'Thời lượng hiển thị / phát cho lớp overlay, tiêu đề, logo, BGM.'
from __future__ import annotations

def resolve_end_ms(end_ms: int, clip_duration_ms: int) -> int:
    end = int(end_ms or 0)
    duration = max(1, int(clip_duration_ms or 1))
    return duration if end <= 0 else min(max(1, end), duration)

def normalize_layer_range(start_ms: int, end_ms: int, clip_duration_ms: int) -> tuple[int, int]:
    duration = max(1, int(clip_duration_ms or 1))
    start = max(0, min(int(start_ms or 0), duration - 1))
    end = resolve_end_ms(end_ms, duration)
    end = max(start + 1, min(end, duration))
    return (start, end)

def layer_active_at(position_ms: int, start_ms: int, end_ms: int, clip_duration_ms: int) -> bool:
    start, end = (normalize_layer_range(start_ms, end_ms, clip_duration_ms)[0], normalize_layer_range(start_ms, end_ms, clip_duration_ms)[1])
    pos = int(position_ms)
    return start <= pos < end

def layer_overlaps_trim(start_ms: int, end_ms: int, trim_start_ms: int, trim_end_ms: int, source_duration_ms: int) -> bool:
    duration = max(1, int(source_duration_ms or 1))
    layer_start, layer_end = (normalize_layer_range(start_ms, end_ms, duration)[0], normalize_layer_range(start_ms, end_ms, duration)[1])
    trim_start = max(0, min(int(trim_start_ms or 0), duration - 1))
    trim_end = resolve_end_ms(trim_end_ms, duration)
    return layer_start < trim_end and layer_end > trim_start

def layer_output_seconds(start_ms: int, end_ms: int, trim_start_ms: int, trim_end_ms: int, source_duration_ms: int, pts_divisor: float) -> tuple[float, float] | None:
    duration = max(1, int(source_duration_ms or 1))
    layer_start, layer_end = (normalize_layer_range(start_ms, end_ms, duration)[0], normalize_layer_range(start_ms, end_ms, duration)[1])
    trim_start = max(0, min(int(trim_start_ms or 0), duration - 1))
    trim_end = resolve_end_ms(trim_end_ms, duration)
    visible_start = max(layer_start, trim_start)
    visible_end = min(layer_end, trim_end)
    if visible_end <= visible_start:
        return None
    div = max(0.01, float(pts_divisor or 1.0))
    out_start = (visible_start - trim_start) / 1000.0 / div
    out_end = (visible_end - trim_start) / 1000.0 / div
    return (max(0.0, out_start), max(out_start + 0.001, out_end))

def ffmpeg_enable_between(start_sec: float, end_sec: float) -> str:
    return f".3f,{end_sec}.3f)'"

def output_window_ms(start_ms: int, end_ms: int, trim_start_ms: int, trim_end_ms: int, source_duration_ms: int, pts_divisor: float) -> tuple[int, int] | None:
    window = layer_output_seconds(start_ms, end_ms, trim_start_ms, trim_end_ms, source_duration_ms, pts_divisor)
    if window is None:
        return None
    start_sec, end_sec = (window[0], window[1])
    return (int(round(start_sec * 1000)), int(round(end_sec * 1000)))