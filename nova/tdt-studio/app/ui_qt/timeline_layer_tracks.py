'Hàng timeline Lớp phủ / Hòa trộn — thay Video 2/3, gắn media_overlays + blend_layers.'
from __future__ import annotations
from typing import Any
from core.timeline_clips import clamp_track_index, clips_from_values, write_clips
MAX_OVERLAY_TRACKS = 24
MAX_BLEND_TRACKS = 16
MAX_BACKGROUND_TRACKS = 16
_LAYER_KIND_BASE_LABEL = {'overlay': 'Lớp phủ', 'blend': 'Hòa trộn', 'background': 'Nền'}

def overlay_track_kind(index: int | str) -> str:
    return f'media_overlay:{index}'

def blend_track_kind(index: int | str) -> str:
    return f'blend_layer:{index}'

def background_track_kind(index: int | str) -> str:
    return f'background_layer:{index}'

def parse_layer_row_ref(ref: str) -> tuple[str, str] | None:
    text = str(ref or '').strip()
    if text.startswith('overlay:'):
        return ('overlay', text.split(':', 1)[1])
    if text.startswith('blend:'):
        return ('blend', text.split(':', 1)[1])
    if text.startswith('background:'):
        return ('background', text.split(':', 1)[1])

def layer_track_slots(items: list[dict], *, max_tracks: int, kind: str) -> list[tuple[str, str]]:
    _ = max_tracks
    with_path = [(i, item) for i, item in enumerate(items) if str(item.get('path', '') or '').strip()]
    base = _LAYER_KIND_BASE_LABEL.get(kind, kind)
    prefix = kind
    if with_path:
        rows = []
        for display_i, (index, _item) in enumerate(with_path, start=1):
            label = f'{base} {display_i}' if len(with_path) > 1 else base
            rows.append((label, f'{prefix}:{index}'))
        return rows
    return [(base, f'{prefix}:new')]

def count_filled_layer_tracks(items: list[dict]) -> int:
    return sum((1 for item in items if str(item.get('path', '') or '').strip()))

def migrate_upper_video_tracks_to_layers(values: dict[str, Any]) -> bool:
    from ui_qt.blend_layers import add_blend_layer, ensure_blend_layers, update_selected_blend_layer
    from ui_qt.media_overlays import add_media_overlay, ensure_media_overlays, update_selected_media_overlay
    clips = clips_from_values(values)
    upper = [c for c in clips if clamp_track_index(c.track_index) > 0]
    if upper:
        main = [c for c in clips if clamp_track_index(c.track_index) <= 0]
        overlays = ensure_media_overlays(values)
        blends = ensure_blend_layers(values)
        existing_overlay_paths = {str(i.get('path', '') or '').strip() for i in overlays if i.get('path')}
        existing_blend_paths = {str(i.get('path', '') or '').strip() for i in blends if i.get('path')}
        for clip in sorted(upper, key=lambda c: (c.track_index, c.timeline_start_ms)):
            path = str(clip.source_path or '').strip()
            start_ms = max(0, int(clip.timeline_start_ms))
            end_ms = max(start_ms + 1, start_ms + int(clip.duration_ms))
            ti = clamp_track_index(clip.track_index)
            scale = max(5, min(200, int(clip.scale_percent or 100)))
            if ti == 1:
                if not path or path in existing_overlay_paths:
                    pass
                elif len([o for o in ensure_media_overlays(values) if o.get('path')]) >= MAX_OVERLAY_TRACKS:
                    pass
                else:
                    add_media_overlay(values, path)
                    update_selected_media_overlay(values, scale_percent=scale, start_ms=start_ms, end_ms=end_ms, enabled=True)
                    existing_overlay_paths.add(path)
            elif path in existing_blend_paths:
                pass
            elif len([b for b in ensure_blend_layers(values) if b.get('path')]) >= MAX_BLEND_TRACKS:
                pass
            else:
                add_blend_layer(values, path)
                update_selected_blend_layer(values, scale_percent=scale, start_ms=start_ms, end_ms=end_ms, enabled=True)
                existing_blend_paths.add(path)
        write_clips(values, main)
        values['media_overlays_master_enabled'] = True
        values['blend_layers_master_enabled'] = True
        return True
    return False