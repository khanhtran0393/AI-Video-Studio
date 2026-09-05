'Lớp hòa trộn CapCut — riêng với overlay lớp phủ (media_overlays).'
from __future__ import annotations
import uuid
from copy import deepcopy
from pathlib import Path
from core.video_look import BLEND_MODE_IDS
from ui_qt.media_overlays import is_media_overlay_path, is_video_overlay_path, MEDIA_SUFFIXES
DEFAULT_BLEND_LAYER = {'id': '', 'path': '', 'enabled': True, 'blend_mode': 'screen', 'opacity': 15, 'x_norm': 0.5, 'y_norm': 0.5, 'scale_percent': 100, 'rotation_degrees': 0, 'start_ms': 0, 'end_ms': 0}

def new_blend_layer_id() -> str:
    return f'bl-{uuid.uuid4().hex[:10]}'

def _normalize_blend_layer(item: dict) -> dict:
    layer_id = str(item.get('id') or '').strip() or new_blend_layer_id()
    opacity = max(0, min(100, int(item.get('opacity', 15) or 15)))
    mode = str(item.get('blend_mode', 'screen') or 'screen').strip().lower()
    if mode not in BLEND_MODE_IDS or mode == 'normal':
        mode = 'screen'
    scale = max(5, min(200, int(item.get('scale_percent', 100) or 100)))
    x_norm = float(item.get('x_norm', 0.5) or 0.5)
    y_norm = float(item.get('y_norm', 0.5) or 0.5)
    rotation_degrees = float(item.get('rotation_degrees', 0) or 0) % 360.0
    scale_aspect = float(item.get('scale_aspect', 0) or 0)
    if scale_aspect < 0.05:
        scale_aspect = 0.0
    start_ms = max(0, int(item.get('start_ms', 0) or 0))
    end_ms = max(0, int(item.get('end_ms', 0) or 0))
    return {'id': layer_id, 'path': str(item.get('path', '') or ''), 'enabled': bool(item.get('enabled', True)), 'blend_mode': mode, 'opacity': opacity, 'x_norm': x_norm, 'y_norm': y_norm, 'scale_percent': scale, 'scale_aspect': scale_aspect, 'rotation_degrees': rotation_degrees, 'start_ms': start_ms, 'end_ms': end_ms, 'preview_hidden': bool(item.get('preview_hidden', False)), 'edit_locked': bool(item.get('edit_locked', False))}

def _migrate_overlay_blend_items(values: dict[str, object]) -> None:
    raw = values.get('media_overlays')
    if isinstance(raw, list):
        blend_raw = values.get('blend_layers')
        existing_blend = isinstance(blend_raw, list) and len(blend_raw) > 0
        if existing_blend:
            return None
        kept = []
        migrated = []
        for item in raw:
            if isinstance(item, dict):
                mode = str(item.get('blend_mode', 'normal') or 'normal').strip().lower()
                if mode != 'normal' and item.get('path'):
                    migrated.append(_normalize_blend_layer({'path': item.get('path'), 'enabled': item.get('enabled', True), 'blend_mode': mode, 'opacity': item.get('opacity', 20), 'start_ms': item.get('start_ms', 0), 'end_ms': item.get('end_ms', 0)}))
                    kept.append({**item, **{'blend_mode': 'normal', 'blend_enabled': False}})
                else:
                    kept.append(item)
        if migrated:
            values['blend_layers'] = migrated
            values['blend_layers_master_enabled'] = True
            values['media_overlays'] = kept
            return None
    else:
        return None

def ensure_blend_layers(values: dict[str, object]) -> list[dict]:
    _migrate_overlay_blend_items(values)
    raw = values.get('blend_layers')
    layers = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, dict):
                layers.append(_normalize_blend_layer(item))
    values['blend_layers'] = layers
    index = int(values.get('blend_layer_index', 0) or 0)
    values['blend_layer_index'] = max(0, min(index, len(layers) - 1)) if layers else 0
    return layers

def selected_blend_layer(values: dict[str, object]) -> dict | None:
    layers = ensure_blend_layers(values)
    return layers[int(values.get('blend_layer_index', 0))] if layers else None

def sync_flat_keys_from_selected_blend(values: dict[str, object]) -> None:
    layers = values.get('blend_layers')
    if isinstance(layers, list) and layers:
        index = max(0, min(int(values.get('blend_layer_index', 0) or 0), len(layers) - 1))
        item = layers[index]
        values['blend_layer_enabled'] = bool(item.get('enabled', True))
        values['blend_layer_path'] = str(item.get('path', ''))
        values['blend_layer_opacity'] = int(item.get('opacity', 15))
        values['blend_layer_mode'] = str(item.get('blend_mode', 'screen'))
        values['blend_layer_x_norm'] = float(item.get('x_norm', 0.5))
        values['blend_layer_y_norm'] = float(item.get('y_norm', 0.5))
        values['blend_layer_scale_percent'] = int(item.get('scale_percent', 100))
        values['blend_layer_scale_aspect'] = float(item.get('scale_aspect', 0) or 0)
        values['blend_layer_rotation_degrees'] = int(item.get('rotation_degrees', 0) or 0)
        values['blend_layer_start_ms'] = int(item.get('start_ms', 0) or 0)
        values['blend_layer_end_ms'] = int(item.get('end_ms', 0) or 0)
    else:
        values['blend_layer_enabled'] = False
        values['blend_layer_path'] = ''
        return None

def sync_selected_from_flat_blend_keys(values: dict[str, object]) -> None:
    layers = ensure_blend_layers(values)
    if layers:
        index = int(values.get('blend_layer_index', 0) or 0)
        layers[index] = _normalize_blend_layer({**layers[index], **{'enabled': bool(values.get('blend_layer_enabled', True)), 'path': str(values.get('blend_layer_path', '')), 'opacity': values.get('blend_layer_opacity', 20), 'blend_mode': values.get('blend_layer_mode', 'screen'), 'x_norm': values.get('blend_layer_x_norm', 0.5), 'y_norm': values.get('blend_layer_y_norm', 0.5), 'scale_percent': values.get('blend_layer_scale_percent', 100), 'scale_aspect': values.get('blend_layer_scale_aspect', layers[index].get('scale_aspect', 0)), 'rotation_degrees': values.get('blend_layer_rotation_degrees', 0), 'start_ms': values.get('blend_layer_start_ms', 0), 'end_ms': values.get('blend_layer_end_ms', 0)}})
        values['blend_layers'] = layers
    else:
        return None

def add_blend_layer(values: dict[str, object], path: str) -> dict:
    from ui_qt.timeline_layer_tracks import MAX_BLEND_TRACKS
    layers = ensure_blend_layers(values)
    filled = sum((1 for o in layers if str(o.get('path', '') or '').strip()))
    if filled >= MAX_BLEND_TRACKS:
        values['blend_layer_index'] = max(0, len(layers) - 1)
        update_selected_blend_layer(values, path=path, enabled=True)
        item = selected_blend_layer(values) or layers[-1]
        _disable_overlay_with_same_path(values, path)
    else:
        item = _normalize_blend_layer({**DEFAULT_BLEND_LAYER, **{'id': new_blend_layer_id(), 'path': path, 'enabled': True}})
        layers.append(item)
        values['blend_layers'] = layers
        values['blend_layer_index'] = len(layers) - 1
        values['blend_layers_master_enabled'] = True
        _disable_overlay_with_same_path(values, path)
        sync_flat_keys_from_selected_blend(values)
    return item

def _disable_overlay_with_same_path(values: dict[str, object], path: str) -> None:
    from ui_qt.media_overlays import ensure_media_overlays
    target = str(path or '').strip()
    if target:
        overlays = ensure_media_overlays(values)
        for item in overlays:
            if str(item.get('path', '') or '').strip() == target:
                item['enabled'] = False
        values['media_overlays'] = overlays
    else:
        return None

def remove_blend_layer_at(values: dict[str, object], index: int) -> bool:
    layers = ensure_blend_layers(values)
    idx = int(index)
    if idx < 0 or idx >= len(layers):
        return False
    layers.pop(idx)
    values['blend_layers'] = layers
    values['blend_layer_index'] = max(0, min(idx, len(layers) - 1)) if layers else 0
    if not layers:
        values['blend_layers_master_enabled'] = False
    sync_flat_keys_from_selected_blend(values)
    return True

def remove_selected_blend_layer(values: dict[str, object]) -> bool:
    layers = ensure_blend_layers(values)
    if layers:
        index = int(values.get('blend_layer_index', 0) or 0)
        return remove_blend_layer_at(values, index)
    return False

def update_selected_blend_layer(values: dict[str, object], **fields) -> None:
    layers = ensure_blend_layers(values)
    if layers:
        index = int(values.get('blend_layer_index', 0) or 0)
        merged = dict(layers[index])
        merged.update(fields)
        layers[index] = _normalize_blend_layer(merged)
        values['blend_layers'] = layers
        sync_flat_keys_from_selected_blend(values)
    else:
        return None

def set_blend_layer_item_enabled(values: dict[str, object], index: int, enabled: bool) -> None:
    layers = ensure_blend_layers(values)
    if 0 <= index < len(layers):
        layers[index] = _normalize_blend_layer({**layers[index], **{'enabled': bool(enabled)}})
        values['blend_layers'] = layers
        if index == int(values.get('blend_layer_index', 0) or 0):
            sync_flat_keys_from_selected_blend(values)
            return None
    else:
        return None

def blend_layers_master_enabled(values: dict[str, object]) -> bool:
    return bool(values.get('blend_layers_master_enabled', False))

def exportable_blend_layers(values: dict[str, object]) -> list[dict]:
    if blend_layers_master_enabled(values):
        layers = ensure_blend_layers(values)
        result = []
        for item in layers:
            path = str(item.get('path', ''))
            if item.get('enabled', True) and path and Path(path).is_file() and is_media_overlay_path(path):
                result.append(deepcopy(item))
        return result
    return []

def blend_layer_list_label(item: dict) -> str:
    path = str(item.get('path', '') or '')
    name = Path(path).name if path else '(chưa chọn)'
    if len(name) > 22:
        name = name[:19] + '…'
    kind = 'Video' if is_video_overlay_path(path) else 'Ảnh'
    mode = str(item.get('blend_mode', 'screen') or 'screen')
    opacity = int(item.get('opacity', 15) or 15)
    scale = int(item.get('scale_percent', 100) or 100)
    mark = '' if item.get('enabled', True) else ' · tắt'
    return f'{kind} · {name} · {mode} · {opacity}% · {scale}%{mark}'