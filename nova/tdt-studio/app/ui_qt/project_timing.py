'Kẹp timing lớp / trim theo độ dài video thật — tránh timeline phình dài dư.\n\n``end_ms <= 0`` = ăn hết clip (mọi độ dài). Khi kẹp, nếu end ≥ duration\n→ ghi lại ``0`` (không materialize thành ms tuyệt đối của video mẫu).\n'
from __future__ import annotations
from typing import Any
from ui_qt.blend_layers import ensure_blend_layers
from ui_qt.background_layers import ensure_background_layers
from ui_qt.media_overlays import ensure_media_overlays
_LAYER_END_KEYS = ('trim_end_ms', 'text_overlay_end_ms', 'video_title_end_ms', 'logo_end_ms', 'background_audio_end_ms', 'blend_layer_end_ms', 'background_layer_end_ms')

def _semantic_full_end(raw: int, duration: int) -> int:
    value = int(raw or 0)
    return 0 if value <= 0 else 0 if value >= duration else value

def normalize_template_full_span_ends(values: dict[str, Any], reference_duration_ms: int) -> None:
    duration = max(1, int(reference_duration_ms or 1))
    for key in _LAYER_END_KEYS:
        values[key] = _semantic_full_end(int(values.get(key, 0) or 0), duration)
    for list_key in ('media_overlays', 'blend_layers', 'background_layers'):
        items = values.get(list_key)
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    item['end_ms'] = _semantic_full_end(int(item.get('end_ms', 0) or 0), duration)

def clamp_project_timing_to_duration(values: dict[str, Any], duration_ms: int) -> bool:
    duration = max(1, int(duration_ms or 1))
    changed = False
    trim_start = max(0, int(values.get('trim_start_ms', 0) or 0))
    if trim_start >= duration:
        values['trim_start_ms'] = 0
        changed = True
        trim_start = 0
    for key in _LAYER_END_KEYS:
        raw = int(values.get(key, 0) or 0)
        capped = _semantic_full_end(raw, duration)
        capped = max(trim_start + 1, capped)
        if key == 'trim_end_ms' and capped > 0 and (capped >= duration):
            capped = 0
        if raw > 0 and capped != raw:
            values[key] = capped
            changed = True
    for start_key, end_key in (('text_overlay_start_ms', 'text_overlay_end_ms'), ('video_title_start_ms', 'video_title_end_ms'), ('logo_start_ms', 'logo_end_ms'), ('background_audio_start_ms', 'background_audio_end_ms'), ('blend_layer_start_ms', 'blend_layer_end_ms'), ('background_layer_start_ms', 'background_layer_end_ms')):
        start = max(0, int(values.get(start_key, 0) or 0))
        end = int(values.get(end_key, 0) or 0)
        if start >= duration:
            values[start_key] = 0
            changed = True
            start = 0
        new_end = _semantic_full_end(end, duration) if end > 0 else 0
        if end > 0 and new_end != end:
            values[end_key] = new_end
            changed = True
    overlays = ensure_media_overlays(values)
    ov_changed = False
    for item in overlays:
        start = max(0, int(item.get('start_ms', 0) or 0))
        end = max(0, int(item.get('end_ms', 0) or 0))
        new_start = min(start, max(0, duration - 1))
        new_end = _semantic_full_end(end, duration) if end > 0 else 0
        if new_start != start or new_end != end:
            item['start_ms'] = new_start
            item['end_ms'] = new_end
            ov_changed = True
    if ov_changed:
        values['media_overlays'] = overlays
        changed = True
    blends = ensure_blend_layers(values)
    bl_changed = False
    for item in blends:
        start = max(0, int(item.get('start_ms', 0) or 0))
        end = max(0, int(item.get('end_ms', 0) or 0))
        new_start = min(start, max(0, duration - 1))
        new_end = _semantic_full_end(end, duration) if end > 0 else 0
        if new_start != start or new_end != end:
            item['start_ms'] = new_start
            item['end_ms'] = new_end
            bl_changed = True
    if bl_changed:
        values['blend_layers'] = blends
        changed = True
    try:
        backgrounds = ensure_background_layers(values)
    except Exception:
        backgrounds = []
    bg_changed = False
    for item in backgrounds:
        start = max(0, int(item.get('start_ms', 0) or 0))
        end = max(0, int(item.get('end_ms', 0) or 0))
        new_start = min(start, max(0, duration - 1))
        new_end = _semantic_full_end(end, duration) if end > 0 else 0
        if isinstance(item, dict) and (new_start != start or new_end != end):
            item['start_ms'] = new_start
            item['end_ms'] = new_end
            bg_changed = True
    if bg_changed:
        values['background_layers'] = backgrounds
        changed = True
    return changed