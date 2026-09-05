from __future__ import annotations
import uuid
from copy import deepcopy
from pathlib import Path
from core.overlay_mask import DEFAULT_MASK, normalize_overlay_mask_fields
IMAGE_SUFFIXES = {'.webp', '.tiff', '.tif', '.bmp', '.jpeg', '.jpg', '.gif', '.png'}
VIDEO_SUFFIXES = {'.mkv', '.ts', '.m2ts', '.m4v', '.mov', '.webm', '.wmv', '.mp4', '.avi', '.flv'}
MEDIA_SUFFIXES = IMAGE_SUFFIXES | VIDEO_SUFFIXES
DEFAULT_MEDIA_OVERLAY = {'id': '', 'path': '', 'enabled': True, 'x_norm': 0.5, 'y_norm': 0.5, 'scale_percent': 100, 'opacity': 50, 'rotation_degrees': 0, 'blend_enabled': False, 'blend_mode': 'normal', 'start_ms': 0, 'end_ms': 0, **DEFAULT_MASK}

def new_overlay_id() -> str:
    return f'ov-{uuid.uuid4().hex[:10]}'

def is_media_overlay_path(path: str | Path) -> bool:
    return Path(path).suffix.lower() in MEDIA_SUFFIXES

def is_image_overlay_path(path: str | Path) -> bool:
    return Path(path).suffix.lower() in IMAGE_SUFFIXES

def is_video_overlay_path(path: str | Path) -> bool:
    return Path(path).suffix.lower() in VIDEO_SUFFIXES

def _normalize_overlay(item: dict) -> dict:
    scale = max(5, min(200, int(item.get('scale_percent', 100) or 100)))
    opacity = max(0, min(100, int(item.get('opacity', 50) or 50)))
    x_norm = float(item.get('x_norm', 0.5) or 0.5)
    y_norm = float(item.get('y_norm', 0.5) or 0.5)
    rotation_degrees = float(item.get('rotation_degrees', 0) or 0) % 360.0
    scale_aspect = float(item.get('scale_aspect', 0) or 0)
    if scale_aspect < 0.05:
        scale_aspect = 0.0
    overlay_id = str(item.get('id') or '').strip() or new_overlay_id()
    start_ms = max(0, int(item.get('start_ms', 0) or 0))
    end_ms = max(0, int(item.get('end_ms', 0) or 0))
    blend_mode = 'normal'
    blend_enabled = False
    mask = normalize_overlay_mask_fields(item)
    return {'id': overlay_id, 'path': str(item.get('path', '') or ''), 'enabled': bool(item.get('enabled', True)), 'x_norm': x_norm, 'y_norm': y_norm, 'scale_percent': scale, 'scale_aspect': scale_aspect, 'opacity': opacity, 'rotation_degrees': rotation_degrees, 'blend_enabled': blend_enabled, 'blend_mode': blend_mode, 'start_ms': start_ms, 'end_ms': end_ms, 'preview_hidden': bool(item.get('preview_hidden', False)), 'edit_locked': bool(item.get('edit_locked', False)), **mask}

def _legacy_overlay_from_flat(values: dict[str, object]) -> dict | None:
    path = str(values.get('effect_overlay_path', '') or '')
    enabled = bool(values.get('effect_overlay_enabled', str(values.get('video_effect', 'none')) == 'custom'))
    return _normalize_overlay({'id': 'ov-legacy', 'path': path, 'enabled': enabled, 'x_norm': values.get('effect_overlay_x_norm', 0.5), 'y_norm': values.get('effect_overlay_y_norm', 0.5), 'scale_percent': values.get('effect_overlay_scale_percent', 100), 'opacity': values.get('effect_overlay_opacity', 50)}) if path or enabled else None

def ensure_media_overlays(values: dict[str, object]) -> list[dict]:
    raw = values.get('media_overlays')
    overlays = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, dict):
                overlays.append(_normalize_overlay(item))
    if not overlays:
        legacy = _legacy_overlay_from_flat(values)
        overlays = [legacy] if legacy is not None else []
    values['media_overlays'] = overlays
    index = int(values.get('media_overlay_index', 0) or 0)
    values['media_overlay_index'] = max(0, min(index, len(overlays) - 1)) if overlays else 0
    return overlays

def selected_media_overlay(values: dict[str, object]) -> dict | None:
    overlays = ensure_media_overlays(values)
    return overlays[int(values.get('media_overlay_index', 0))] if overlays else None

def sync_flat_keys_from_selected(values: dict[str, object]) -> None:
    overlays = values.get('media_overlays')
    if isinstance(overlays, list) and overlays:
        index = max(0, min(int(values.get('media_overlay_index', 0) or 0), len(overlays) - 1))
        item = overlays[index]
        values['effect_overlay_enabled'] = bool(item.get('enabled', True))
        values['effect_overlay_path'] = str(item.get('path', ''))
        values['effect_overlay_opacity'] = int(item.get('opacity', 50))
        values['effect_overlay_scale_percent'] = int(item.get('scale_percent', 100))
        values['effect_overlay_x_norm'] = float(item.get('x_norm', 0.5))
        values['effect_overlay_y_norm'] = float(item.get('y_norm', 0.5))
        values['effect_overlay_rotation_degrees'] = int(item.get('rotation_degrees', 0) or 0)
        values['effect_overlay_mask_enabled'] = bool(item.get('mask_enabled', False))
        values['effect_overlay_mask_shape'] = str(item.get('mask_shape', 'circle') or 'circle')
        values['effect_overlay_mask_width_percent'] = int(item.get('mask_width_percent', 100) or 100)
        values['effect_overlay_mask_height_percent'] = int(item.get('mask_height_percent', 100) or 100)
        values['effect_overlay_mask_feather_percent'] = int(item.get('mask_feather_percent', 20) or 20)
        values['effect_overlay_mask_feather_bias'] = int(item.get('mask_feather_bias', 0) or 0)
        values['effect_overlay_mask_feather_axis'] = str(item.get('mask_feather_axis', 'y') or 'y')
        values['effect_overlay_mask_corner_radius_percent'] = int(item.get('mask_corner_radius_percent', 18) or 18)
    else:
        values['effect_overlay_enabled'] = False
        values['effect_overlay_path'] = ''
        return None

def sync_selected_from_flat_keys(values: dict[str, object]) -> None:
    overlays = ensure_media_overlays(values)
    if overlays:
        index = int(values.get('media_overlay_index', 0) or 0)
        overlays[index] = _normalize_overlay({**overlays[index], **{'enabled': bool(values.get('effect_overlay_enabled', True)), 'path': str(values.get('effect_overlay_path', '')), 'opacity': values.get('effect_overlay_opacity', 50), 'scale_percent': values.get('effect_overlay_scale_percent', 100), 'x_norm': values.get('effect_overlay_x_norm', 0.5), 'y_norm': values.get('effect_overlay_y_norm', 0.5), 'rotation_degrees': values.get('effect_overlay_rotation_degrees', 0), 'blend_enabled': False, 'blend_mode': 'normal', 'mask_enabled': bool(values.get('effect_overlay_mask_enabled', False)), 'mask_shape': values.get('effect_overlay_mask_shape', 'circle'), 'mask_width_percent': values.get('effect_overlay_mask_width_percent', 100), 'mask_height_percent': values.get('effect_overlay_mask_height_percent', 100), 'mask_feather_percent': values.get('effect_overlay_mask_feather_percent', 20), 'mask_feather_bias': values.get('effect_overlay_mask_feather_bias', 0), 'mask_feather_axis': values.get('effect_overlay_mask_feather_axis', 'y'), 'mask_corner_radius_percent': values.get('effect_overlay_mask_corner_radius_percent', 18)}})
        values['media_overlays'] = overlays
    else:
        return None

def add_media_overlay(values: dict[str, object], path: str) -> dict:
    from ui_qt.timeline_layer_tracks import MAX_OVERLAY_TRACKS
    overlays = ensure_media_overlays(values)
    filled = sum((1 for o in overlays if str(o.get('path', '') or '').strip()))
    if filled >= MAX_OVERLAY_TRACKS:
        values['media_overlay_index'] = max(0, len(overlays) - 1)
        update_selected_media_overlay(values, path=path, enabled=True)
        item = selected_media_overlay(values) or overlays[-1]
    else:
        item = _normalize_overlay({**DEFAULT_MEDIA_OVERLAY, **{'id': new_overlay_id(), 'path': path, 'enabled': True}})
        overlays.append(item)
        values['media_overlays'] = overlays
        values['media_overlay_index'] = len(overlays) - 1
        values['media_overlays_master_enabled'] = True
        sync_flat_keys_from_selected(values)
    return item

def duplicate_overlay_item(item: dict, offset: float=0.03) -> dict:
    clone = deepcopy(item)
    clone['id'] = new_overlay_id()
    x_norm = max(0.0, min(1.0, float(clone.get('x_norm', 0.5) or 0.5) + offset))
    y_norm = max(0.0, min(1.0, float(clone.get('y_norm', 0.5) or 0.5) + offset))
    clone['x_norm'] = x_norm
    clone['y_norm'] = y_norm
    return _normalize_overlay(clone)

def duplicate_media_overlay(values: dict[str, object], offset: float=0.03) -> dict | None:
    overlays = ensure_media_overlays(values)
    item = selected_media_overlay(values)
    if item:
        clone = duplicate_overlay_item(item, offset)
        overlays.append(clone)
        values['media_overlays'] = overlays
        values['media_overlay_index'] = len(overlays) - 1
        sync_flat_keys_from_selected(values)
        return clone

def remove_media_overlay_at(values: dict[str, object], index: int) -> bool:
    overlays = ensure_media_overlays(values)
    idx = int(index)
    if idx < 0 or idx >= len(overlays):
        return False
    overlays.pop(idx)
    values['media_overlays'] = overlays
    values['media_overlay_index'] = max(0, min(idx, len(overlays) - 1)) if overlays else 0
    if not overlays:
        values['media_overlays_master_enabled'] = False
    sync_flat_keys_from_selected(values)
    return True

def remove_selected_media_overlay(values: dict[str, object]) -> bool:
    overlays = ensure_media_overlays(values)
    if overlays:
        index = int(values.get('media_overlay_index', 0) or 0)
        return remove_media_overlay_at(values, index)
    return False

def update_selected_media_overlay(values: dict[str, object], **fields) -> None:
    overlays = ensure_media_overlays(values)
    if overlays:
        index = int(values.get('media_overlay_index', 0) or 0)
        merged = dict(overlays[index])
        merged.update(fields)
        overlays[index] = _normalize_overlay(merged)
        values['media_overlays'] = overlays
        sync_flat_keys_from_selected(values)
    else:
        return None

def exportable_media_overlays(values: dict[str, object]) -> list[dict]:
    if media_overlays_master_enabled(values):
        overlays = ensure_media_overlays(values)
        result = []
        for item in overlays:
            path = str(item.get('path', ''))
            if item.get('enabled', True) and path and Path(path).is_file() and is_media_overlay_path(path):
                result.append(deepcopy(item))
        return result
    return []

def overlay_label(item: dict) -> str:
    path = str(item.get('path', '') or '')
    name = Path(path).name if path else '(chưa chọn file)'
    kind = 'video' if is_video_overlay_path(path) else 'ảnh'
    mark = '' if item.get('enabled', True) else ' [tắt]'
    return f'{kind}: {name}{mark}'

def overlay_list_label(item: dict) -> str:
    path = str(item.get('path', '') or '')
    name = Path(path).name if path else '(chưa chọn)'
    if len(name) > 28:
        name = name[:25] + '…'
    kind = 'Video' if is_video_overlay_path(path) else 'Ảnh'
    opacity = int(item.get('opacity', 50) or 50)
    scale = int(item.get('scale_percent', 100) or 100)
    mark = '' if item.get('enabled', True) else ' · tắt'
    mask = ' · mask' if item.get('mask_enabled') else ''
    return f'{kind} · {name} · mờ {opacity}% · {scale}%{mask}{mark}'

def _migrate_master_enabled(values: dict[str, object]) -> None:
    if 'media_overlays_master_enabled' in values:
        return None
    overlays = values.get('media_overlays')
    legacy_on = bool(values.get('effect_overlay_enabled', False))
    if isinstance(overlays, list) and overlays:
        values['media_overlays_master_enabled'] = legacy_on or any((isinstance(item, dict) and item.get('enabled', True) for item in overlays))
        return None
    values['media_overlays_master_enabled'] = legacy_on

def media_overlays_master_enabled(values: dict[str, object]) -> bool:
    _migrate_master_enabled(values)
    return bool(values.get('media_overlays_master_enabled', False))

def set_media_overlay_item_enabled(values: dict[str, object], index: int, enabled: bool) -> None:
    overlays = ensure_media_overlays(values)
    if 0 <= index < len(overlays):
        overlays[index] = _normalize_overlay({**overlays[index], **{'enabled': bool(enabled)}})
        values['media_overlays'] = overlays
        if index == int(values.get('media_overlay_index', 0) or 0):
            sync_flat_keys_from_selected(values)
            return None
    else:
        return None