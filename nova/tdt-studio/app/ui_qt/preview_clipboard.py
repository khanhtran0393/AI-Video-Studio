'Sao chép / dán / nhân đôi phần tử preview (tiêu đề, chữ, logo, overlay).'
from __future__ import annotations
from copy import deepcopy
from typing import Any
from ui_qt.media_overlays import duplicate_media_overlay, ensure_media_overlays, new_overlay_id, selected_media_overlay, sync_flat_keys_from_selected, _normalize_overlay
PASTE_OFFSET = 0.03
SUPPORTED_KINDS = frozenset({'text', 'overlay', 'logo', 'title'})
_CLIPBOARD: 'dict[str, Any] | None' = None
TITLE_KEYS = ('video_title_content', 'video_title_position', 'video_title_x_norm', 'video_title_y_norm', 'video_title_scale_percent', 'video_title_scale_x_percent', 'video_title_scale_y_percent', 'video_title_box_width_percent')
TEXT_KEYS = ('text_overlay_content', 'text_overlay_style', 'text_overlay_position', 'text_overlay_x_norm', 'text_overlay_y_norm', 'text_overlay_scale_percent', 'text_overlay_box_width_percent')
LOGO_KEYS = ('logo_path', 'logo_position', 'logo_x_norm', 'logo_y_norm', 'logo_scale_percent', 'logo_opacity', 'logo_rmbg')
_KIND_LABELS = {'overlay': 'overlay', 'logo': 'logo', 'title': 'tiêu đề', 'text': 'chữ phụ họa'}

def has_clipboard() -> bool:
    return _CLIPBOARD is not None

def clipboard_kind() -> str:
    return str(_CLIPBOARD.get('kind', '')) if _CLIPBOARD else ''

def clipboard_label() -> str:
    kind = clipboard_kind()
    return _KIND_LABELS.get(kind, kind)

def _offset_norm(x: float, y: float, delta: float=PASTE_OFFSET) -> tuple[float, float]:
    return (min(1.0, max(0.0, x + delta)), min(1.0, max(0.0, y + delta)))

def _capture_dict(values: dict[str, object], keys: tuple[str, ...]) -> dict[str, Any]:
    return {key: values.get(key) for key in keys}

def _is_title_slot_free(values: dict[str, object]) -> bool:
    if bool(values.get('video_title_enabled', False)):
        content = str(values.get('video_title_content', '') or '').strip()
        return not content
    return True

def _is_text_slot_free(values: dict[str, object]) -> bool:
    if bool(values.get('text_overlay_enabled', False)):
        content = str(values.get('text_overlay_content', '') or '').strip()
        return not content
    return True

def _capture_overlay(values: dict[str, object]) -> dict[str, Any] | None:
    item = selected_media_overlay(values)
    if item:
        path = str(item.get('path', '') or '')
        return deepcopy(item) if path else None

def _capture_logo(values: dict[str, object]) -> dict[str, Any] | None:
    path = str(values.get('logo_path', '') or '')
    return _capture_dict(values, LOGO_KEYS) if path and bool(values.get('logo_enabled', False)) else None

def _capture_title(values: dict[str, object]) -> dict[str, Any] | None:
    return _capture_dict(values, TITLE_KEYS) if bool(values.get('video_title_enabled', False)) else None

def _capture_text(values: dict[str, object]) -> dict[str, Any] | None:
    return _capture_dict(values, TEXT_KEYS) if bool(values.get('text_overlay_enabled', False)) else None

def copy_preview_element(kind: str, values: dict[str, object]) -> bool:
    kind = str(kind or '')
    if kind not in SUPPORTED_KINDS:
        return False
    capture = {'overlay': _capture_overlay, 'logo': _capture_logo, 'title': _capture_title, 'text': _capture_text}[kind]
    data = capture(values)
    if data is None:
        return False
    _CLIPBOARD = {'kind': kind, 'data': data}
    return True

def _add_overlay_from_blob(values: dict[str, object], blob: dict[str, Any], offset: float=PASTE_OFFSET) -> str:
    overlays = ensure_media_overlays(values)
    x_norm, y_norm = (_offset_norm(float(blob.get('x_norm', 0.5) or 0.5), float(blob.get('y_norm', 0.5) or 0.5), offset)[0], _offset_norm(float(blob.get('x_norm', 0.5) or 0.5), float(blob.get('y_norm', 0.5) or 0.5), offset)[1])
    item = _normalize_overlay({**blob, **{'id': new_overlay_id(), 'enabled': True, 'x_norm': x_norm, 'y_norm': y_norm}})
    overlays.append(item)
    values['media_overlays'] = overlays
    values['media_overlay_index'] = len(overlays) - 1
    sync_flat_keys_from_selected(values)
    return 'overlay'

def _apply_title_blob(values: dict[str, object], blob: dict[str, Any], offset: float=PASTE_OFFSET) -> None:
    x_norm, y_norm = (_offset_norm(float(blob.get('video_title_x_norm', 0.5) or 0.5), float(blob.get('video_title_y_norm', 0.06) or 0.06), offset)[0], _offset_norm(float(blob.get('video_title_x_norm', 0.5) or 0.5), float(blob.get('video_title_y_norm', 0.06) or 0.06), offset)[1])
    values['video_title_enabled'] = True
    values['video_title_from_filename'] = False
    for key in TITLE_KEYS:
        if key in blob:
            values[key] = blob[key]
    values['video_title_x_norm'] = x_norm
    values['video_title_y_norm'] = y_norm
    values['video_title_position'] = 'custom'

def _apply_text_blob(values: dict[str, object], blob: dict[str, Any], offset: float=PASTE_OFFSET) -> None:
    x_norm, y_norm = (_offset_norm(float(blob.get('text_overlay_x_norm', 0.5) or 0.5), float(blob.get('text_overlay_y_norm', 0.94) or 0.94), offset)[0], _offset_norm(float(blob.get('text_overlay_x_norm', 0.5) or 0.5), float(blob.get('text_overlay_y_norm', 0.94) or 0.94), offset)[1])
    values['text_overlay_enabled'] = True
    for key in TEXT_KEYS:
        if key in blob:
            values[key] = blob[key]
    values['text_overlay_x_norm'] = x_norm
    values['text_overlay_y_norm'] = y_norm
    values['text_overlay_position'] = 'custom'

def _logo_overlay_blob(blob: dict[str, Any]) -> dict[str, Any]:
    return {'path': str(blob.get('logo_path', '') or blob.get('path', '') or ''), 'x_norm': float(blob.get('logo_x_norm', blob.get('x_norm', 0.5)) or 0.5), 'y_norm': float(blob.get('logo_y_norm', blob.get('y_norm', 0.5)) or 0.5), 'scale_percent': int(blob.get('logo_scale_percent', blob.get('scale_percent', 100)) or 100), 'opacity': int(blob.get('logo_opacity', blob.get('opacity', 82)) or 82)}

def _paste_title(values: dict[str, object], blob: dict[str, Any]) -> tuple[str, str]:
    if _is_text_slot_free(values):
        text_blob = {'text_overlay_content': str(blob.get('video_title_content', '') or ''), 'text_overlay_style': 'static', 'text_overlay_position': str(blob.get('video_title_position', 'bottom')), 'text_overlay_x_norm': float(blob.get('video_title_x_norm', 0.5) or 0.5), 'text_overlay_y_norm': float(blob.get('video_title_y_norm', 0.94) or 0.94), 'text_overlay_scale_percent': int(blob.get('video_title_scale_percent', 100) or 100), 'text_overlay_box_width_percent': int(blob.get('video_title_box_width_percent', 90) or 90)}
        _apply_text_blob(values, text_blob)
        return ('text', 'Đã dán tiêu đề vào chữ phụ họa')
    if _is_title_slot_free(values):
        _apply_title_blob(values, blob)
        return ('title', 'Đã dán tiêu đề')
    _apply_text_blob(values, {'text_overlay_content': str(blob.get('video_title_content', '') or ''), 'text_overlay_style': 'static', 'text_overlay_position': str(blob.get('video_title_position', 'bottom')), 'text_overlay_x_norm': float(blob.get('video_title_x_norm', 0.5) or 0.5), 'text_overlay_y_norm': float(blob.get('video_title_y_norm', 0.94) or 0.94), 'text_overlay_scale_percent': int(blob.get('video_title_scale_percent', 100) or 100), 'text_overlay_box_width_percent': int(blob.get('video_title_box_width_percent', 90) or 90)})
    return ('text', 'Đã dán tiêu đề (thay chữ phụ họa hiện có)')

def _paste_text(values: dict[str, object], blob: dict[str, Any]) -> tuple[str, str]:
    if _is_title_slot_free(values):
        title_blob = {'video_title_content': str(blob.get('text_overlay_content', '') or ''), 'video_title_position': str(blob.get('text_overlay_position', 'top')), 'video_title_x_norm': float(blob.get('text_overlay_x_norm', 0.5) or 0.5), 'video_title_y_norm': float(blob.get('text_overlay_y_norm', 0.06) or 0.06), 'video_title_scale_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_scale_x_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_scale_y_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_box_width_percent': int(blob.get('text_overlay_box_width_percent', 92) or 92)}
        _apply_title_blob(values, title_blob)
        return ('title', 'Đã dán chữ phụ họa vào tiêu đề')
    if _is_text_slot_free(values):
        _apply_text_blob(values, blob)
        return ('text', 'Đã dán chữ phụ họa')
    _apply_title_blob(values, {'video_title_content': str(blob.get('text_overlay_content', '') or ''), 'video_title_position': str(blob.get('text_overlay_position', 'top')), 'video_title_x_norm': float(blob.get('text_overlay_x_norm', 0.5) or 0.5), 'video_title_y_norm': float(blob.get('text_overlay_y_norm', 0.06) or 0.06), 'video_title_scale_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_scale_x_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_scale_y_percent': int(blob.get('text_overlay_scale_percent', 100) or 100), 'video_title_box_width_percent': int(blob.get('text_overlay_box_width_percent', 92) or 92)})
    return ('title', 'Đã dán chữ phụ họa (thay tiêu đề hiện có)')

def paste_preview_element(values: dict[str, object]) -> tuple[str | None, str]:
    if _CLIPBOARD:
        kind = str(_CLIPBOARD.get('kind', ''))
        blob = _CLIPBOARD.get('data')
        if not isinstance(blob, dict):
            return (None, 'Clipboard không hợp lệ')
        if kind == 'overlay':
            sel = _add_overlay_from_blob(values, blob)
            return (sel, 'Đã dán overlay')
        if kind == 'logo':
            overlay_blob = _logo_overlay_blob(blob)
            if overlay_blob.get('path'):
                sel = _add_overlay_from_blob(values, overlay_blob)
                return (sel, 'Đã dán logo (lớp overlay)')
            return (None, 'Logo clipboard không có file')
        return _paste_title(values, blob) if kind == 'title' else _paste_text(values, blob) if kind == 'text' else (None, 'Không thể dán loại này')
    return (None, 'Chưa có gì trong clipboard — hãy sao chép trước')

def duplicate_preview_element(kind: str, values: dict[str, object]) -> tuple[str | None, str]:
    kind = str(kind or '')
    if kind not in SUPPORTED_KINDS:
        return (None, 'Không thể nhân đôi phần tử này')
    if kind == 'overlay':
        item = duplicate_media_overlay(values)
        return (None, 'Không có overlay để nhân đôi') if item is None else ('overlay', 'Đã nhân đôi overlay')
    if kind == 'logo':
        blob = _capture_logo(values)
        if blob is None:
            return (None, 'Không có logo để nhân đôi')
        sel = _add_overlay_from_blob(values, _logo_overlay_blob(blob))
        return (sel, 'Đã nhân đôi logo (lớp overlay)')
    if kind == 'title':
        blob = _capture_title(values)
        if blob is None:
            return (None, 'Không có tiêu đề để nhân đôi')
        sel, msg = (_paste_title(values, blob)[0], _paste_title(values, blob)[1])
        return (sel, 'Đã nhân đôi tiêu đề → ' + msg.replace('Đã dán ', ''))
    if kind == 'text':
        blob = _capture_text(values)
        if blob is None:
            return (None, 'Không có chữ phụ họa để nhân đôi')
        sel, msg = (_paste_text(values, blob)[0], _paste_text(values, blob)[1])
        return (sel, 'Đã nhân đôi chữ phụ họa → ' + msg.replace('Đã dán ', ''))
    return (None, 'Không thể nhân đôi')