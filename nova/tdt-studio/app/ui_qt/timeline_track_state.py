'Ẩn / khóa track timeline (kiểu CapCut) — ẩn/khóa chỉnh preview, vẫn xuất.'
from __future__ import annotations
from typing import Any
TRACK_KINDS = ('video', 'media_overlay', 'blend_layer', 'subtitle', 'text_overlay', 'video_title', 'text_logo', 'blur', 'voice', 'source_audio', 'audio', 'sfx')

def _bag(values: dict[str, Any], key: str) -> dict[str, bool]:
    raw = values.get(key)
    return {str(k): bool(v) for k, v in raw.items()} if isinstance(raw, dict) else {}

def track_preview_hidden(values: dict[str, Any], kind: str) -> bool:
    kind = str(kind)
    bag = _bag(values, 'timeline_track_hidden')
    if bag.get(kind):
        return True
    base = kind.split(':', 1)[0]
    return True if base != kind and bag.get(base) else True if kind.startswith('media_overlay') and bag.get('video_2') else True if kind.startswith('blend_layer') and bag.get('video_3') else False

def track_edit_locked(values: dict[str, Any], kind: str) -> bool:
    kind = str(kind)
    bag = _bag(values, 'timeline_track_locked')
    if bag.get(kind):
        return True
    base = kind.split(':', 1)[0]
    return True if base != kind and bag.get(base) else True if kind.startswith('media_overlay') and bag.get('video_2') else True if kind.startswith('blend_layer') and bag.get('video_3') else False

def set_track_preview_hidden(values: dict[str, Any], kind: str, hidden: bool) -> None:
    bag = _bag(values, 'timeline_track_hidden')
    if hidden:
        bag[str(kind)] = True
    else:
        bag.pop(str(kind), None)
    values['timeline_track_hidden'] = bag

def set_track_edit_locked(values: dict[str, Any], kind: str, locked: bool) -> None:
    bag = _bag(values, 'timeline_track_locked')
    if locked:
        bag[str(kind)] = True
    else:
        bag.pop(str(kind), None)
    values['timeline_track_locked'] = bag

def layer_kind_for_id(layer_id: str) -> str | None:
    lid = str(layer_id or '')
    if lid in frozenset({'layer-source-audio', 'layer-bgm', 'layer-voice'}):
        return {'layer-voice': 'voice', 'layer-source-audio': 'source_audio', 'layer-bgm': 'audio'}[lid]
    if lid == 'layer-text-overlay' or lid.startswith('layer-text-overlay-'):
        return 'text_overlay'
    if lid == 'layer-video-title':
        return 'video_title'
    if lid in frozenset({'layer-text-logo', 'layer-logo'}):
        return 'text_logo'
    if lid == 'layer-blur':
        return 'blur'
    if lid.startswith('layer-overlay-'):
        try:
            pass
        except ValueError:
            return 'media_overlay'
    elif lid.startswith('layer-blend-'):
        try:
            pass
        except ValueError:
            return 'blend_layer'
    else:
        return None