'Nhiều lớp chữ phụ họa (không chỉ 1 slot text_overlay_* flat).'
from __future__ import annotations
import uuid
from copy import deepcopy

def new_text_id() -> str:
    return f'tx-{uuid.uuid4().hex[:10]}'
DEFAULT_TEXT_OVERLAY_ITEM = {'id': '', 'enabled': True, 'content': '', 'style': 'static', 'position': 'custom', 'x_norm': 0.5, 'y_norm': 0.88, 'scale_percent': 100, 'box_width_percent': 90, 'layout_scale_percent': 100, 'rotation_degrees': 0.0, 'start_ms': 0, 'end_ms': 0, 'font': 'Arial', 'text_color': '#FFFFFF', 'outline_color': '#000000', 'outline_width': 3, **{'shadow_enabled': True, 'shadow_depth': 1, 'bg_enabled': False, 'bg_color': '#000000', 'bg_opacity': 55, 'bold': True, 'italic': False}}

def _normalize_item(item: dict) -> dict:
    content = str(item.get('content') or item.get('text_overlay_content') or '').strip()
    style = str(item.get('style') or item.get('text_overlay_style') or 'static')
    if style not in frozenset({'around', 'static', 'diagonal', 'marquee'}):
        style = 'static'
    position = str(item.get('position') or item.get('text_overlay_position') or 'custom')
    if position not in frozenset({'top', 'custom', 'center', 'bottom'}):
        position = 'custom'
    return {'id': str(item.get('id') or '').strip() or new_text_id(), 'enabled': bool(item.get('enabled', True)), 'content': content, 'style': style, 'position': position, 'x_norm': float(item.get('x_norm', item.get('text_overlay_x_norm', 0.5)) or 0.5), 'y_norm': float(item.get('y_norm', item.get('text_overlay_y_norm', 0.88)) or 0.88), 'scale_percent': max(20, min(300, int(item.get('scale_percent', item.get('text_overlay_scale_percent', 100)) or 100))), 'box_width_percent': max(15, min(100, int(item.get('box_width_percent', item.get('text_overlay_box_width_percent', 90)) or 90))), 'layout_scale_percent': max(20, min(300, int(item.get('layout_scale_percent', item.get('text_overlay_layout_scale_percent', 100)) or 100))), 'rotation_degrees': float(item.get('rotation_degrees', item.get('text_overlay_rotation_degrees', 0)) or 0) % 360.0, 'start_ms': max(0, int(item.get('start_ms', item.get('text_overlay_start_ms', 0)) or 0)), 'end_ms': max(0, int(item.get('end_ms', item.get('text_overlay_end_ms', 0)) or 0)), 'font': str(item.get('font', item.get('text_overlay_font', 'Arial')) or 'Arial'), 'text_color': str(item.get('text_color', item.get('text_overlay_text_color', '#FFFFFF')) or '#FFFFFF'), 'outline_color': str(item.get('outline_color', item.get('text_overlay_outline_color', '#000000')) or '#000000'), 'outline_width': max(0, min(12, int(item.get('outline_width', item.get('text_overlay_outline_width', 3)) or 3))), **{'shadow_enabled': bool(item.get('shadow_enabled', item.get('text_overlay_shadow_enabled', True))), 'shadow_depth': max(0, min(8, int(item.get('shadow_depth', item.get('text_overlay_shadow_depth', 1)) or 0))), 'bg_enabled': bool(item.get('bg_enabled', item.get('text_overlay_bg_enabled', False))), 'bg_color': str(item.get('bg_color', item.get('text_overlay_bg_color', '#000000')) or '#000000'), 'bg_opacity': max(0, min(100, int(item.get('bg_opacity', item.get('text_overlay_bg_opacity', 55)) or 55))), 'bold': bool(item.get('bold', item.get('text_overlay_bold', True))), 'italic': bool(item.get('italic', item.get('text_overlay_italic', False)))}}

def legacy_flat_as_item(values: dict[str, object]) -> dict | None:
    content = str(values.get('text_overlay_content') or '').strip()
    if not content and (not values.get('text_overlay_enabled')):
        return None
    return _normalize_item({'id': 'tx-legacy', 'enabled': bool(values.get('text_overlay_enabled', True)), 'content': content, 'style': values.get('text_overlay_style', 'static'), 'position': values.get('text_overlay_position', 'custom'), 'x_norm': values.get('text_overlay_x_norm', 0.5), 'y_norm': values.get('text_overlay_y_norm', 0.94), 'scale_percent': values.get('text_overlay_scale_percent', 100), 'box_width_percent': values.get('text_overlay_box_width_percent', 90), 'layout_scale_percent': values.get('text_overlay_layout_scale_percent', 100), 'rotation_degrees': values.get('text_overlay_rotation_degrees', 0), 'start_ms': values.get('text_overlay_start_ms', 0), 'end_ms': values.get('text_overlay_end_ms', 0), 'font': values.get('text_overlay_font', 'Arial'), 'text_color': values.get('text_overlay_text_color', '#FFFFFF'), 'outline_color': values.get('text_overlay_outline_color', '#000000'), 'outline_width': values.get('text_overlay_outline_width', 3), **{'shadow_enabled': values.get('text_overlay_shadow_enabled', True), 'shadow_depth': values.get('text_overlay_shadow_depth', 1), 'bg_enabled': values.get('text_overlay_bg_enabled', False), 'bg_color': values.get('text_overlay_bg_color', '#000000'), 'bg_opacity': values.get('text_overlay_bg_opacity', 55), 'bold': values.get('text_overlay_bold', True), 'italic': values.get('text_overlay_italic', False)}}) if content else None

def ensure_text_overlays(values: dict[str, object]) -> list[dict]:
    raw = values.get('text_overlays')
    items = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            if isinstance(item, dict):
                items.append(_normalize_item(item))
    legacy = legacy_flat_as_item(values)
    if not items and legacy is not None:
        items = [legacy]
    values['text_overlays'] = items
    index = int(values.get('text_overlay_index', 0) or 0)
    values['text_overlay_index'] = max(0, min(index, len(items) - 1)) if items else 0
    return items

def selected_text_overlay(values: dict[str, object]) -> dict | None:
    items = ensure_text_overlays(values)
    return items[int(values.get('text_overlay_index', 0) or 0)] if items else None

def sync_flat_from_selected_text(values: dict[str, object]) -> None:
    item = selected_text_overlay(values)
    if item is None:
        values['text_overlay_enabled'] = False
        values['text_overlay_content'] = ''
        values['text_overlay_style'] = 'static'
        return None
    values['text_overlay_enabled'] = bool(item.get('enabled', True))
    values['text_overlay_content'] = str(item.get('content') or '')
    style = str(item.get('style') or 'static')
    values['text_overlay_style'] = style
    if is_motion_style(style):
        values['text_overlay_motion_style'] = style
    values['text_overlay_position'] = str(item.get('position') or 'custom')
    values['text_overlay_x_norm'] = float(item.get('x_norm', 0.5))
    values['text_overlay_y_norm'] = float(item.get('y_norm', 0.88))
    values['text_overlay_scale_percent'] = int(item.get('scale_percent', 100))
    values['text_overlay_box_width_percent'] = int(item.get('box_width_percent', 90))
    values['text_overlay_layout_scale_percent'] = int(item.get('layout_scale_percent', 100))
    values['text_overlay_rotation_degrees'] = float(item.get('rotation_degrees', 0))
    values['text_overlay_start_ms'] = int(item.get('start_ms', 0))
    values['text_overlay_end_ms'] = int(item.get('end_ms', 0))
    values['text_overlay_font'] = str(item.get('font') or 'Arial')
    values['text_overlay_text_color'] = str(item.get('text_color') or '#FFFFFF')
    values['text_overlay_outline_color'] = str(item.get('outline_color') or '#000000')
    values['text_overlay_outline_width'] = int(item.get('outline_width', 3))
    values['text_overlay_shadow_enabled'] = bool(item.get('shadow_enabled', True))
    values['text_overlay_shadow_depth'] = int(item.get('shadow_depth', 1))
    values['text_overlay_bg_enabled'] = bool(item.get('bg_enabled', False))
    values['text_overlay_bg_color'] = str(item.get('bg_color') or '#000000')
    values['text_overlay_bg_opacity'] = int(item.get('bg_opacity', 55))
    values['text_overlay_bold'] = bool(item.get('bold', True))
    values['text_overlay_italic'] = bool(item.get('italic', False))

def sync_selected_from_flat_text(values: dict[str, object]) -> None:
    items = ensure_text_overlays(values)
    if items:
        index = int(values.get('text_overlay_index', 0) or 0)
        index = max(0, min(index, len(items) - 1))
        style = str(values.get('text_overlay_style') or 'static')
        if is_motion_style(style):
            values['text_overlay_motion_style'] = style
        items[index] = _normalize_item({**items[index], **{'enabled': bool(values.get('text_overlay_enabled', True)), 'content': values.get('text_overlay_content', ''), 'style': style, 'position': values.get('text_overlay_position', 'custom'), 'x_norm': values.get('text_overlay_x_norm', 0.5), 'y_norm': values.get('text_overlay_y_norm', 0.88), 'scale_percent': values.get('text_overlay_scale_percent', 100), 'box_width_percent': values.get('text_overlay_box_width_percent', 90), 'layout_scale_percent': values.get('text_overlay_layout_scale_percent', 100), 'rotation_degrees': values.get('text_overlay_rotation_degrees', 0), 'start_ms': values.get('text_overlay_start_ms', 0), 'end_ms': values.get('text_overlay_end_ms', 0), 'font': values.get('text_overlay_font', 'Arial'), 'text_color': values.get('text_overlay_text_color', '#FFFFFF'), 'outline_color': values.get('text_overlay_outline_color', '#000000'), 'outline_width': values.get('text_overlay_outline_width', 3), 'shadow_enabled': values.get('text_overlay_shadow_enabled', True)}, **{'shadow_depth': values.get('text_overlay_shadow_depth', 1), 'bg_enabled': values.get('text_overlay_bg_enabled', False), 'bg_color': values.get('text_overlay_bg_color', '#000000'), 'bg_opacity': values.get('text_overlay_bg_opacity', 55), 'bold': values.get('text_overlay_bold', True), 'italic': values.get('text_overlay_italic', False)}})
        values['text_overlays'] = items
    else:
        content = str(values.get('text_overlay_content') or '').strip()
        if content or values.get('text_overlay_enabled'):
            base = legacy_flat_as_item(values) or {'enabled': bool(values.get('text_overlay_enabled', True)), 'content': values.get('text_overlay_content', ''), 'style': values.get('text_overlay_style', 'static')}
            items = [_normalize_item(base)]
            values['text_overlays'] = items
            values['text_overlay_index'] = 0
        else:
            return None
MOTION_STYLE_CHOICES = ('marquee', 'around', 'diagonal')

def is_motion_style(style: object) -> bool:
    return str(style or 'static') in MOTION_STYLE_CHOICES

def text_overlay_list_label(item: dict) -> str:
    content = str(item.get('content') or '').strip() or '(trống)'
    if len(content) > 36:
        content = content[:35] + '…'
    style = str(item.get('style') or 'static')
    tag = ' · chạy ngang' if style == 'marquee' else ' · chạy vòng' if style == 'around' else ' · chạy chéo' if style == 'diagonal' else ''
    return f'{content}{tag}'

def set_text_overlay_item_enabled(values: dict[str, object], index: int, enabled: bool) -> None:
    items = ensure_text_overlays(values)
    if index < 0 or index >= len(items):
        return None
    items[index]['enabled'] = bool(enabled)
    values['text_overlays'] = items
    if index == int(values.get('text_overlay_index', 0) or 0):
        values['text_overlay_enabled'] = bool(enabled)
        sync_flat_from_selected_text(values)
        return None

def remove_selected_text_overlay(values: dict[str, object]) -> bool:
    items = ensure_text_overlays(values)
    if items:
        index = int(values.get('text_overlay_index', 0) or 0)
        index = max(0, min(index, len(items) - 1))
        items.pop(index)
        values['text_overlays'] = items
        if items:
            values['text_overlay_index'] = min(index, len(items) - 1)
            sync_flat_from_selected_text(values)
        else:
            values['text_overlay_index'] = 0
            values['text_overlay_enabled'] = False
            values['text_overlay_content'] = ''
            values['text_overlay_style'] = 'static'
        return True
    return False

def clear_all_text_overlays(values: dict[str, object]) -> None:
    values['text_overlays'] = []
    values['text_overlay_index'] = 0
    values['text_overlay_enabled'] = False
    values['text_overlay_content'] = ''
    values['text_overlay_style'] = 'static'

def apply_motion_enabled(values: dict[str, object], enabled: bool) -> None:
    items = ensure_text_overlays(values)
    if items:
        index = int(values.get('text_overlay_index', 0) or 0)
        index = max(0, min(index, len(items) - 1))
        current = str(items[index].get('style') or 'static')
        if enabled:
            if not is_motion_style(current):
                preferred = str(values.get('text_overlay_motion_style') or 'marquee')
                if not is_motion_style(preferred):
                    preferred = 'marquee'
                items[index]['style'] = preferred
        else:
            if is_motion_style(current):
                values['text_overlay_motion_style'] = current
            items[index]['style'] = 'static'
        values['text_overlays'] = items
        sync_flat_from_selected_text(values)
    else:
        sync_selected_from_flat_text(values)
        items = ensure_text_overlays(values)
        if not items:
            return None

def add_text_overlay_item(values: dict[str, object], item: dict[str, object], *, stack_offset: float) -> dict:
    items = ensure_text_overlays(values)
    payload = _normalize_item({**DEFAULT_TEXT_OVERLAY_ITEM, **item, **{'id': new_text_id()}})
    if 'style' not in item:
        payload['style'] = 'static'
    if items:
        payload['y_norm'] = max(0.05, min(0.95, float(payload.get('y_norm', 0.88)) - stack_offset * len(items)))
        payload['position'] = 'custom'
    items.append(payload)
    values['text_overlays'] = items
    values['text_overlay_index'] = len(items) - 1
    values['text_overlay_enabled'] = True
    if is_motion_style(payload.get('style')):
        values['text_overlay_motion_style'] = str(payload.get('style'))
    sync_flat_from_selected_text(values)
    return payload

def exportable_text_overlays(values: dict[str, object]) -> list[dict]:
    items = ensure_text_overlays(values)
    result = []
    for item in items:
        if item.get('enabled', True) and str(item.get('content') or '').strip():
            result.append(deepcopy(item))
    return result

def item_to_legacy_settings_fields(item: dict) -> dict[str, object]:
    return {'text_overlay_enabled': bool(item.get('enabled', True)), 'text_overlay_content': str(item.get('content') or ''), 'text_overlay_style': str(item.get('style') or 'static'), 'text_overlay_position': str(item.get('position') or 'custom'), 'text_overlay_x_norm': float(item.get('x_norm', 0.5)), 'text_overlay_y_norm': float(item.get('y_norm', 0.88)), 'text_overlay_scale_percent': int(item.get('scale_percent', 100)), 'text_overlay_box_width_percent': int(item.get('box_width_percent', 90)), 'text_overlay_layout_scale_percent': int(item.get('layout_scale_percent', 100)), 'text_overlay_rotation_degrees': float(item.get('rotation_degrees', 0)), 'text_overlay_start_ms': int(item.get('start_ms', 0)), 'text_overlay_end_ms': int(item.get('end_ms', 0)), 'text_overlay_font': str(item.get('font') or 'Arial'), 'text_overlay_text_color': str(item.get('text_color') or '#FFFFFF'), 'text_overlay_outline_color': str(item.get('outline_color') or '#000000'), 'text_overlay_outline_width': int(item.get('outline_width', 3)), 'text_overlay_shadow_enabled': bool(item.get('shadow_enabled', True)), **{'text_overlay_shadow_depth': int(item.get('shadow_depth', 1)), 'text_overlay_bg_enabled': bool(item.get('bg_enabled', False)), 'text_overlay_bg_color': str(item.get('bg_color') or '#000000'), 'text_overlay_bg_opacity': int(item.get('bg_opacity', 55)), 'text_overlay_bold': bool(item.get('bold', True)), 'text_overlay_italic': bool(item.get('italic', False))}}