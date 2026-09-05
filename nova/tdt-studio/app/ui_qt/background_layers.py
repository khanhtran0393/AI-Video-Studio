'Lớp nền media (video/ảnh) — dưới video chính, cùng họ overlay/hòa trộn.\n\n`fit_mode=cover`: phủ kín khung (project cũ / mới thêm). Kéo-giãn → `free`.\nĐen / mờ / xám là màu plate (tab Video), không phải lớp file.\n'
from __future__ import annotations
import uuid
from copy import deepcopy
from pathlib import Path
from ui_qt.media_overlays import is_media_overlay_path, is_video_overlay_path
BACKGROUND_MODE_IDS = frozenset({'blur', 'black', 'custom', 'gray'})
DEFAULT_BACKGROUND_LAYER = {'id': '', 'path': '', 'enabled': True, 'start_ms': 0, 'end_ms': 0, 'fit_mode': 'cover', 'x_norm': 0.5, 'y_norm': 0.5, 'scale_percent': 100, 'scale_aspect': 0.0, 'rotation_degrees': 0.0, 'opacity': 100}

def new_background_layer_id() -> str:
    return f'bg-{uuid.uuid4().hex[:10]}'

def normalize_background_mode(value: object) -> str:
    text = str(value or 'black').strip().lower()
    return text if text in BACKGROUND_MODE_IDS else 'black'

def is_custom_background_mode(values: dict[str, object] | object) -> bool:
    mode = values.get('background', 'black') if isinstance(values, dict) else getattr(values, 'background', 'black')
    return normalize_background_mode(mode) == 'custom'

def migrate_background_mode(values: dict[str, object]) -> None:
    if values.get('_bg_mode_v2'):
        return None
    layers = ensure_background_layers(values)
    has_file = any((str(item.get('path', '') or '').strip() and Path(str(item.get('path'))).is_file() for item in layers))
    if background_layers_master_enabled(values) and has_file and (normalize_background_mode(values.get('background', 'black')) != 'custom'):
        values['background'] = 'custom'
    values['_bg_mode_v2'] = True

def background_layer_uses_cover(item: dict | None) -> bool:
    if isinstance(item, dict):
        fit = str(item.get('fit_mode') or 'cover').strip().lower()
        return fit != 'free'
    return True

def _normalize_background_layer(item: dict) -> dict:
    layer_id = str(item.get('id') or '').strip() or new_background_layer_id()
    start_ms = max(0, int(item.get('start_ms', 0) or 0))
    end_ms = max(0, int(item.get('end_ms', 0) or 0))
    has_fit = 'fit_mode' in item
    fit_mode = str(item.get('fit_mode') or 'cover').strip().lower()
    if fit_mode not in frozenset({'free', 'cover'}):
        fit_mode = 'cover'
    if not has_fit and 'x_norm' not in item and ('scale_percent' not in item):
        fit_mode = 'cover'
    opacity = max(0, min(100, int(item.get('opacity', 100) or 100)))
    scale = max(5, min(200, int(item.get('scale_percent', 100) or 100)))
    x_norm = float(item.get('x_norm', 0.5) or 0.5)
    y_norm = float(item.get('y_norm', 0.5) or 0.5)
    rotation_degrees = float(item.get('rotation_degrees', 0) or 0) % 360.0
    scale_aspect = float(item.get('scale_aspect', 0) or 0)
    if scale_aspect < 0.05:
        scale_aspect = 0.0
    return {'id': layer_id, 'path': str(item.get('path', '') or ''), 'enabled': bool(item.get('enabled', True)), 'start_ms': start_ms, 'end_ms': end_ms, 'fit_mode': fit_mode, 'x_norm': x_norm, 'y_norm': y_norm, 'scale_percent': scale, 'scale_aspect': scale_aspect, 'rotation_degrees': rotation_degrees, 'opacity': opacity, 'preview_hidden': bool(item.get('preview_hidden', False)), 'edit_locked': bool(item.get('edit_locked', False))}

def ensure_background_layers(values: dict[str, object]) -> list[dict]:
    raw = values.get('background_layers')
    layers = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, dict):
                layers.append(_normalize_background_layer(item))
    values['background_layers'] = layers
    index = int(values.get('background_layer_index', 0) or 0)
    values['background_layer_index'] = max(0, min(index, len(layers) - 1)) if layers else 0
    return layers

def selected_background_layer(values: dict[str, object]) -> dict | None:
    layers = ensure_background_layers(values)
    return layers[int(values.get('background_layer_index', 0))] if layers else None

def sync_flat_keys_from_selected_background(values: dict[str, object]) -> None:
    layers = values.get('background_layers')
    if isinstance(layers, list) and layers:
        index = max(0, min(int(values.get('background_layer_index', 0) or 0), len(layers) - 1))
        item = layers[index]
        values['background_layer_enabled'] = bool(item.get('enabled', True))
        values['background_layer_path'] = str(item.get('path', ''))
        values['background_layer_start_ms'] = int(item.get('start_ms', 0) or 0)
        values['background_layer_end_ms'] = int(item.get('end_ms', 0) or 0)
        values['background_layer_x_norm'] = float(item.get('x_norm', 0.5) or 0.5)
        values['background_layer_y_norm'] = float(item.get('y_norm', 0.5) or 0.5)
        values['background_layer_scale_percent'] = int(item.get('scale_percent', 100) or 100)
        values['background_layer_rotation_degrees'] = float(item.get('rotation_degrees', 0) or 0)
        values['background_layer_opacity'] = int(item.get('opacity', 100) or 100)
        values['background_layer_fit_mode'] = str(item.get('fit_mode') or 'cover')
    else:
        values['background_layer_enabled'] = False
        values['background_layer_path'] = ''
        values['background_layer_start_ms'] = 0
        values['background_layer_end_ms'] = 0
        values['background_layer_x_norm'] = 0.5
        values['background_layer_y_norm'] = 0.5
        values['background_layer_scale_percent'] = 100
        values['background_layer_rotation_degrees'] = 0
        values['background_layer_opacity'] = 100
        values['background_layer_fit_mode'] = 'cover'
        return None

def sync_selected_from_flat_background_keys(values: dict[str, object]) -> None:
    layers = ensure_background_layers(values)
    if layers:
        index = int(values.get('background_layer_index', 0) or 0)
        layers[index] = _normalize_background_layer({**layers[index], **{'enabled': bool(values.get('background_layer_enabled', True)), 'path': str(values.get('background_layer_path', '')), 'start_ms': values.get('background_layer_start_ms', 0), 'end_ms': values.get('background_layer_end_ms', 0), 'fit_mode': str(values.get('background_layer_fit_mode') or 'cover'), 'x_norm': values.get('background_layer_x_norm', 0.5), 'y_norm': values.get('background_layer_y_norm', 0.5), 'scale_percent': values.get('background_layer_scale_percent', 100), 'rotation_degrees': values.get('background_layer_rotation_degrees', 0), 'opacity': values.get('background_layer_opacity', 100)}})
        values['background_layers'] = layers
    else:
        return None

def add_background_layer(values: dict[str, object], path: str) -> dict:
    from ui_qt.timeline_layer_tracks import MAX_BACKGROUND_TRACKS
    layers = ensure_background_layers(values)
    filled = sum((1 for o in layers if str(o.get('path', '') or '').strip()))
    if filled >= MAX_BACKGROUND_TRACKS:
        values['background_layer_index'] = max(0, len(layers) - 1)
        update_selected_background_layer(values, path=path, enabled=True)
        item = selected_background_layer(values) or layers[-1]
        values['background'] = 'custom'
        values['background_layers_master_enabled'] = True
        values['_bg_mode_v2'] = True
    else:
        item = _normalize_background_layer({**DEFAULT_BACKGROUND_LAYER, **{'id': new_background_layer_id(), 'path': path, 'enabled': True}})
        layers.append(item)
        values['background_layers'] = layers
        values['background_layer_index'] = len(layers) - 1
        values['background_layers_master_enabled'] = True
        values['background'] = 'custom'
        values['_bg_mode_v2'] = True
        sync_flat_keys_from_selected_background(values)
    return item

def remove_background_layer_at(values: dict[str, object], index: int) -> bool:
    layers = ensure_background_layers(values)
    idx = int(index)
    if idx < 0 or idx >= len(layers):
        return False
    layers.pop(idx)
    values['background_layers'] = layers
    values['background_layer_index'] = max(0, min(idx, len(layers) - 1)) if layers else 0
    values['background_layers_master_enabled'] = False
    if not layers and normalize_background_mode(values.get('background')) == 'custom':
        values['background'] = 'black'
    sync_flat_keys_from_selected_background(values)
    return True

def remove_selected_background_layer(values: dict[str, object]) -> bool:
    layers = ensure_background_layers(values)
    if layers:
        index = int(values.get('background_layer_index', 0) or 0)
        return remove_background_layer_at(values, index)
    return False

def update_selected_background_layer(values: dict[str, object], **fields) -> None:
    layers = ensure_background_layers(values)
    if layers:
        index = int(values.get('background_layer_index', 0) or 0)
        merged = dict(layers[index])
        merged.update(fields)
        layers[index] = _normalize_background_layer(merged)
        values['background_layers'] = layers
        sync_flat_keys_from_selected_background(values)
    else:
        return None

def set_background_layer_item_enabled(values: dict[str, object], index: int, enabled: bool) -> None:
    layers = ensure_background_layers(values)
    if 0 <= index < len(layers):
        layers[index] = _normalize_background_layer({**layers[index], **{'enabled': bool(enabled)}})
        values['background_layers'] = layers
        if index == int(values.get('background_layer_index', 0) or 0):
            sync_flat_keys_from_selected_background(values)
            return None
    else:
        return None

def background_layers_master_enabled(values: dict[str, object]) -> bool:
    return bool(values.get('background_layers_master_enabled', False))

def exportable_background_layers(values: dict[str, object]) -> list[dict]:
    migrate_background_mode(values)
    if not is_custom_background_mode(values):
        pass
    elif background_layers_master_enabled(values):
        layers = ensure_background_layers(values)
        result = []
        for item in layers:
            path = str(item.get('path', ''))
            if item.get('enabled', True) and path and Path(path).is_file() and is_media_overlay_path(path):
                result.append(deepcopy(item))
        return result
    return []

def background_layer_list_label(item: dict) -> str:
    path = str(item.get('path', '') or '')
    name = Path(path).name if path else '(chưa chọn)'
    if len(name) > 22:
        name = name[:19] + '…'
    kind = 'Video' if is_video_overlay_path(path) else 'Ảnh'
    start_ms = int(item.get('start_ms', 0) or 0)
    end_ms = int(item.get('end_ms', 0) or 0)
    span = 'toàn video' if end_ms <= 0 and start_ms <= 0 else f'{start_ms}–{end_ms}ms'
    mark = '' if item.get('enabled', True) else ' · tắt'
    return f'{kind} · {name} · {span}{mark}'