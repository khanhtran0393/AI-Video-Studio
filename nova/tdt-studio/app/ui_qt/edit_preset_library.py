'Thư viện cấu hình dựng video — lưu full layout 1 video (style + lớp phủ /\nhòa trộn/logo/vùng mờ + ngôn ngữ dịch/giọng đọc…) thành bản đặt tên, dùng lại\ncho video khác: chỉ đổi nguồn → Áp / ghim cấu hình.\n\nPath media style (overlay, blend, logo, BGM, nền timeline…) được copy vào kho\npreset để không gãy khi file gốc dời. Path riêng từng clip (giọng TTS đã render,\nSRT clip…) cố ý không mang theo — mỗi video chạy lại pipeline.\n'
from __future__ import annotations
import json
import shutil
import time
import uuid
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from core.paths import PATHS
from ui_qt.asset_export import template_settings_from_snapshot, template_settings_from_values
from ui_qt.state import DEFAULT_EXPORT_VALUES, ProjectState
PRESET_FORMAT_VERSION = 2
_ACTIVE_FILE_NAME = '_active.json'
_STYLE_PATH_KEYS = ('logo_path', 'effect_overlay_path', 'background_audio_path', 'sfx_path')

@dataclass(frozen=True, slots=True)
class PresetMeta:
    id: 'str'
    name: 'str'
    thumbnail_path: 'str'
    created_at: 'float'

def presets_dir(*, root: Path | None=None) -> Path:
    base = Path(root) if root is not None else PATHS.user_data / 'edit_presets'
    base.mkdir(parents=True, exist_ok=True)
    return base

def _preset_path(preset_id: str, *, root: Path | None) -> Path:
    return presets_dir(root=root) / f'{preset_id}.json'

def _thumbnail_path(preset_id: str, *, root: Path | None) -> Path:
    return presets_dir(root=root) / f'{preset_id}.png'

def _preset_media_dir(preset_id: str, *, root: Path | None) -> Path:
    path = presets_dir(root=root) / 'media' / preset_id
    path.mkdir(parents=True, exist_ok=True)
    return path

def _copy_style_file(source: str, *, preset_id: str, tag: str, root: Path | None) -> str:
    raw = str(source or '').strip()
    if raw:
        src = Path(raw)
        if src.is_file():
            dest_dir = _preset_media_dir(preset_id, root=root)
            dest = dest_dir / f'{tag}_{src.name}'
            if dest.resolve() == src.resolve():
                return str(src.resolve())
            try:
                shutil.copy2(src, dest)
            except OSError:
                return raw
        else:
            return raw
    else:
        return ''

def _relocate_style_media(values: dict[str, object], *, preset_id: str, root: Path | None) -> dict[str, object]:
    bag = deepcopy(values)
    for key in _STYLE_PATH_KEYS:
        if key in bag:
            bag[key] = _copy_style_file(str(bag.get(key) or ''), preset_id=preset_id, tag=key.replace('_path', ''), root=root)
    overlays = bag.get('media_overlays')
    if isinstance(overlays, list):
        new_list = []
        for index, item in enumerate(overlays):
            if isinstance(item, dict):
                clone = dict(item)
                clone['path'] = _copy_style_file(str(clone.get('path') or ''), preset_id=preset_id, tag=f'ov{index}', root=root)
                new_list.append(clone)
            else:
                new_list.append(item)
        bag['media_overlays'] = new_list
    blends = bag.get('blend_layers')
    if isinstance(blends, list):
        new_blends = []
        for index, item in enumerate(blends):
            if isinstance(item, dict):
                clone = dict(item)
                clone['path'] = _copy_style_file(str(clone.get('path') or ''), preset_id=preset_id, tag=f'bl{index}', root=root)
                new_blends.append(clone)
            else:
                new_blends.append(item)
        bag['blend_layers'] = new_blends
    backgrounds = bag.get('background_layers')
    if isinstance(backgrounds, list):
        new_bgs = []
        for index, item in enumerate(backgrounds):
            if isinstance(item, dict):
                clone = dict(item)
                clone['path'] = _copy_style_file(str(clone.get('path') or ''), preset_id=preset_id, tag=f'bg{index}', root=root)
                new_bgs.append(clone)
            else:
                new_bgs.append(item)
        bag['background_layers'] = new_bgs
        try:
            from ui_qt.background_layers import sync_flat_keys_from_selected_background
            sync_flat_keys_from_selected_background(bag)
        except Exception:
            idx = int(bag.get('background_layer_index', 0) or 0)
            pick = new_bgs[max(0, min(idx, len(new_bgs) - 1))]
            if new_bgs and isinstance(new_bgs[0], dict) and isinstance(pick, dict):
                bag['background_layer_path'] = str(pick.get('path') or '')
            return bag
    return bag

def save_preset(name: str, state: ProjectState, source_asset_id: str, *, thumbnail_png_bytes: bytes | None, root: Path | None) -> PresetMeta:
    clean_name = str(name or '').strip() or 'Cấu hình chưa đặt tên'
    if str(state.selected_id or '') == str(source_asset_id):
        values = template_settings_from_values(state.values)
    else:
        saved = state.asset_settings.get(source_asset_id)
        values = template_settings_from_snapshot(saved) if saved else template_settings_from_values(state.values)
    preset_id = uuid.uuid4().hex[:12]
    created_at = time.time()
    values = _relocate_style_media(values, preset_id=preset_id, root=root)
    payload = {'version': PRESET_FORMAT_VERSION, 'type': 'edit_preset', 'id': preset_id, 'name': clean_name, 'created_at': created_at, 'values': values}
    _preset_path(preset_id, root=root).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    thumb_path = ''
    if thumbnail_png_bytes:
        thumb_file = _thumbnail_path(preset_id, root=root)
        thumb_file.write_bytes(thumbnail_png_bytes)
        thumb_path = str(thumb_file)
    return PresetMeta(preset_id, clean_name, thumb_path, created_at)

def list_presets(*, root: Path | None=None) -> list[PresetMeta]:
    base = presets_dir(root=root)
    items = []
    for path in sorted(base.glob('*.json')):
        payload = _read_json(path)
        if path.stem == '_active' or not payload or payload.get('type') != 'edit_preset':
            pass
        else:
            preset_id = str(payload.get('id') or path.stem)
            thumb = _thumbnail_path(preset_id, root=root)
            items.append(PresetMeta(preset_id, str(payload.get('name') or preset_id), str(thumb) if thumb.is_file() else '', float(payload.get('created_at') or 0)))
    items.sort(key=lambda meta: meta.created_at, reverse=True)
    return items

def get_preset_meta(preset_id: str, *, root: Path | None) -> PresetMeta | None:
    clean = str(preset_id or '').strip()
    if clean:
        path = _preset_path(clean, root=root)
        payload = _read_json(path)
        if not payload or payload.get('type') != 'edit_preset':
            return None
        pid = str(payload.get('id') or clean)
        thumb = _thumbnail_path(pid, root=root)
        return PresetMeta(pid, str(payload.get('name') or pid), str(thumb) if thumb.is_file() else '', float(payload.get('created_at') or 0))

def load_preset_values(preset_id: str, *, root: Path | None) -> dict[str, object]:
    payload = _read_json(_preset_path(preset_id, root=root))
    if not payload or payload.get('type') != 'edit_preset':
        raise ValueError('Cấu hình không tồn tại hoặc không hợp lệ')
    values = payload.get('values')
    if isinstance(values, dict):
        allowed = set(DEFAULT_EXPORT_VALUES)
        return {key: value for key, value in values.items() if key in allowed}
    raise ValueError('Cấu hình không hợp lệ')

def rename_preset(preset_id: str, new_name: str, *, root: Path | None) -> None:
    path = _preset_path(preset_id, root=root)
    payload = _read_json(path)
    if payload:
        clean_name = str(new_name or '').strip()
        payload['name'] = clean_name or str(payload.get('name') or preset_id)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    else:
        raise ValueError('Cấu hình không tồn tại')

def delete_preset(preset_id: str, *, root: Path | None) -> None:
    _preset_path(preset_id, root=root).unlink(missing_ok=True)
    _thumbnail_path(preset_id, root=root).unlink(missing_ok=True)
    media_dir = presets_dir(root=root) / 'media' / preset_id
    if media_dir.is_dir():
        shutil.rmtree(media_dir, ignore_errors=True)
    if active_preset_id(root=root) == preset_id:
        set_active_preset(None, root=root)
        return None

def active_preset_id(*, root: Path | None=None) -> str | None:
    payload = _read_json(presets_dir(root=root) / _ACTIVE_FILE_NAME)
    preset_id = str((payload or {}).get('active_id') or '').strip()
    return preset_id or None

def set_active_preset(preset_id: str | None, *, root: Path | None) -> None:
    path = presets_dir(root=root) / _ACTIVE_FILE_NAME
    path.write_text(json.dumps({'active_id': preset_id or ''}, ensure_ascii=False, indent=2), encoding='utf-8')

def _read_json(path: Path) -> dict | None:
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError, json.JSONDecodeError):
            pass
        return payload if isinstance(payload, dict) else None