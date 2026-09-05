'Kho thư viện dựng kiểu thời sự: Ảnh · Khung · Video · Mẫu Text · Sticker.\n\nNạp file vào từng loại → kéo / click lên timeline → căn size preview + thời gian.\nMedia visual (không phải text) gắn thành media_overlays; mặc định ~8s đầu.\n'
from __future__ import annotations
import json
import shutil
import uuid
from pathlib import Path
from core.paths import PATHS
KHO_DEFAULT_DURATION_MS = 8000
KhoKind = str
_IMAGE_EXT = {'.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.png'}
_VIDEO_EXT = {'.avi', '.webm', '.mp4', '.mkv', '.m4v', '.mov'}
_MEDIA_EXT = _IMAGE_EXT | _VIDEO_EXT
_TEXT_EXT = {'.json'}
_KIND_EXTS: 'dict[str, set[str]]' = {'image': _IMAGE_EXT, 'frame': _IMAGE_EXT, 'video': _VIDEO_EXT, 'sticker': _MEDIA_EXT, 'text': _TEXT_EXT}
KHO_NAV: 'tuple[tuple[str, str], ...]' = (('Ảnh', 'image'), ('Khung', 'frame'), ('Video', 'video'), ('Mẫu Text', 'text'), ('Sticker', 'sticker'))
KHO_KINDS: 'frozenset[str]' = frozenset(_KIND_EXTS)
KHO_OVERLAY_KINDS: 'frozenset[str]' = frozenset({'video', 'sticker', 'frame', 'image'})

def kho_root(kind: KhoKind | None=None) -> Path:
    base = PATHS.user_data / 'kho_library'
    base.mkdir(parents=True, exist_ok=True)
    if kind is None:
        return base
    path = base / str(kind)
    path.mkdir(parents=True, exist_ok=True)
    return path

def allowed_extensions(kind: KhoKind) -> set[str]:
    return set(_KIND_EXTS.get(str(kind), set()))

def kind_label(kind: KhoKind) -> str:
    return {'image': 'Ảnh', 'frame': 'Khung', 'video': 'Video', 'sticker': 'Sticker', 'text': 'Mẫu Text'}.get(str(kind), str(kind))

def is_kho_kind(kind: str) -> bool:
    return str(kind or '') in KHO_KINDS

def list_kho_items(kind: KhoKind) -> list[tuple[str, str]]:
    key = str(kind)
    if key == 'text':
        ensure_builtin_text_templates()
    folder = kho_root(key)
    exts = allowed_extensions(key)
    items = []
    if folder.is_dir():
        for path in sorted(folder.iterdir()):
            if not path.is_file() or path.suffix.lower() not in exts:
                pass
            else:
                items.append((path.stem, str(path.resolve())))
    return items

def import_into_kho(kind: KhoKind, source: str | Path) -> str:
    src = Path(source).expanduser().resolve()
    if src.is_file():
        key = str(kind)
        if src.suffix.lower() not in allowed_extensions(key):
            raise ValueError(f'Định dạng không hỗ trợ cho {kind_label(key)}: {src.suffix}')
        dest_dir = kho_root(key)
        dest = dest_dir / src.name
        stem = src.stem
        suffix = src.suffix
        index = 2
        while True:
            dest = dest_dir / f'{stem}_{index}{suffix}'
            index += 1
        if dest.resolve() != src:
            shutil.copy2(src, dest)
        return str(dest.resolve())
    raise ValueError('File không tồn tại')

def overlay_time_range(*, at_ms: int | None, duration_ms: int) -> tuple[int, int]:
    start = max(0, int(at_ms or 0))
    duration = max(500, int(duration_ms or KHO_DEFAULT_DURATION_MS))
    return (start, start + duration)

def default_text_template_payload() -> dict[str, object]:
    return {'type': 'text_style', 'version': 1, 'content': 'BREAKING NEWS', 'text_overlay_enabled': True, 'text_overlay_style': 'static', 'text_overlay_position': 'bottom', 'text_overlay_x_norm': 0.5, 'text_overlay_y_norm': 0.88, 'text_overlay_scale_percent': 110, 'text_overlay_text_color': '#FFFFFF', 'text_overlay_outline_color': '#000000', 'text_overlay_outline_width': 3, 'text_overlay_bold': True, 'text_overlay_font': 'Arial', 'text_overlay_start_ms': 0, 'text_overlay_end_ms': KHO_DEFAULT_DURATION_MS}
_BUILTIN_TEXT_TEMPLATES: 'tuple[tuple[str, dict[str, object]], ...]' = (('breaking_news.json', {**default_text_template_payload(), **{'content': 'BREAKING NEWS', 'text_overlay_style': 'static', 'text_overlay_y_norm': 0.82, 'text_overlay_scale_percent': 120, 'text_overlay_text_color': '#FFFFFF'}}), ('chu_chay_new_release.json', {**default_text_template_payload(), **{'content': '! NEW RELEASE ! NEW RELEASE ! NEW RELEASE !', 'text_overlay_style': 'marquee', 'text_overlay_y_norm': 0.74, 'text_overlay_scale_percent': 90, 'text_overlay_text_color': '#FFFFFF', 'text_overlay_bg_enabled': True, 'text_overlay_bg_color': '#C41212', 'text_overlay_bg_opacity': 90}}), ('mo_ta_ngan.json', {**default_text_template_payload(), **{'content': 'Here are some descriptions about videos', 'text_overlay_style': 'static', 'text_overlay_y_norm': 0.92, 'text_overlay_scale_percent': 85, 'text_overlay_bold': False}}))
_BUILTIN_TEXT_NAMES = frozenset((name for name, _payload in _BUILTIN_TEXT_TEMPLATES))

def is_user_kho_file(kind: KhoKind, path: str | Path) -> bool:
    key = str(kind)
    try:
        file = Path(path).expanduser().resolve()
        root = kho_root(key).resolve()
    except OSError:
        return False
    if file.is_file():
        try:
            file.relative_to(root)
        except ValueError:
            return False
        return False if key == 'text' and file.name in _BUILTIN_TEXT_NAMES else True
    return False

def remove_from_kho(kind: KhoKind, path: str | Path) -> None:
    if is_user_kho_file(kind, path):
        Path(path).expanduser().resolve().unlink()
    else:
        raise ValueError('Chỉ xóa được file đã nạp vào Kho')

def ensure_builtin_text_templates() -> None:
    folder = kho_root('text')
    for name, payload in _BUILTIN_TEXT_TEMPLATES:
        path = folder / name
        if path.is_file():
            pass
        else:
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

def load_text_template(path: str | Path) -> dict[str, object]:
    file_path = Path(path)
    if file_path.is_file():
        try:
            raw = json.loads(file_path.read_text(encoding='utf-8'))
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise ValueError(f'Mẫu text không hợp lệ: {exc}') from exc
        if isinstance(raw, dict):
            base = default_text_template_payload()
            base.update(raw)
            content = str(base.get('content') or base.get('text_overlay_content') or '').strip()
            if not content:
                content = file_path.stem
            base['content'] = content
            base['text_overlay_content'] = content
            base['text_overlay_enabled'] = True
            return base
        raise ValueError('Mẫu text phải là object JSON')
    raise ValueError('Mẫu text không tồn tại')

def save_text_template(name: str, values: dict[str, object], *, root: Path | None) -> str:
    clean = str(name or '').strip() or f'text_{uuid.uuid4().hex[:8]}'
    payload = default_text_template_payload()
    for key in list(payload.keys()):
        if key in values:
            payload[key] = values[key]
    if 'text_overlay_content' in values:
        payload['content'] = str(values.get('text_overlay_content') or '')
        payload['text_overlay_content'] = payload['content']
    folder = Path(root) / 'text' if root is not None else kho_root('text')
    folder.mkdir(parents=True, exist_ok=True)
    safe = ''.join((ch if ch.isalnum() or ch in '-_ ' else '_' for ch in clean)).strip()
    dest = folder / f"{safe or 'mau_chu'}.json"
    if dest.exists():
        dest = folder / f'{safe}_{uuid.uuid4().hex[:6]}.json'
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(dest.resolve())

def apply_text_template_to_values(values: dict[str, object], template: dict[str, object], *, at_ms: int | None, replace: bool) -> None:
    from ui_qt.text_overlays import add_text_overlay_item, ensure_text_overlays
    start, end = (overlay_time_range(at_ms=at_ms)[0], overlay_time_range(at_ms=at_ms)[1])
    content = str(template.get('content') or template.get('text_overlay_content') or '').strip()
    item = {'enabled': True, 'content': content, 'style': template.get('text_overlay_style', template.get('style', 'static')), 'position': template.get('text_overlay_position', template.get('position', 'custom')), 'x_norm': template.get('text_overlay_x_norm', template.get('x_norm', 0.5)), 'y_norm': template.get('text_overlay_y_norm', template.get('y_norm', 0.88)), 'scale_percent': template.get('text_overlay_scale_percent', template.get('scale_percent', 100)), 'box_width_percent': template.get('text_overlay_box_width_percent', template.get('box_width_percent', 90)), 'start_ms': start if at_ms is not None else int(template.get('text_overlay_start_ms', start) or start), 'end_ms': end if at_ms is not None else int(template.get('text_overlay_end_ms', end) or 0) or end, 'font': template.get('text_overlay_font', template.get('font', 'Arial')), 'text_color': template.get('text_overlay_text_color', template.get('text_color', '#FFFFFF')), 'outline_color': template.get('text_overlay_outline_color', template.get('outline_color', '#000000')), 'outline_width': template.get('text_overlay_outline_width', template.get('outline_width', 3)), 'shadow_enabled': template.get('text_overlay_shadow_enabled', template.get('shadow_enabled', True)), 'shadow_depth': template.get('text_overlay_shadow_depth', template.get('shadow_depth', 1)), 'bg_enabled': template.get('text_overlay_bg_enabled', template.get('bg_enabled', False)), **{'bg_color': template.get('text_overlay_bg_color', template.get('bg_color', '#000000')), 'bg_opacity': template.get('text_overlay_bg_opacity', template.get('bg_opacity', 55)), 'bold': template.get('text_overlay_bold', template.get('bold', True)), 'italic': template.get('text_overlay_italic', template.get('italic', False))}}
    if replace:
        ensure_text_overlays(values)
        values['text_overlays'] = []
    add_text_overlay_item(values, item)