from __future__ import annotations
import json
from pathlib import Path
from ui_qt.state import DEFAULT_EXPORT_VALUES, ProjectState
PRESET_FORMAT_VERSION = 1
_EXCLUDED_SUFFIXES = ('_path', '_api_key', '_relay_secret')
_EXCLUDED_KEYS = {'tts_proxy', 'subtitle_path', 'subtitle_prompt'}

def preset_values(state: ProjectState) -> dict[str, object]:
    return {key: state.values.get(key, default) for key, default in DEFAULT_EXPORT_VALUES.items() if not (key in _EXCLUDED_KEYS or any((key.endswith(suffix) for suffix in _EXCLUDED_SUFFIXES)))}

def save_export_preset(state: ProjectState, path: str | Path) -> str:
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {'version': PRESET_FORMAT_VERSION, 'type': 'edit_export', 'values': preset_values(state)}
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(destination)

def load_export_preset(path: str | Path) -> dict[str, object]:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        payload = json.loads(source.read_text(encoding='utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('Preset không đúng định dạng')
        if int(payload.get('version', 0)) != PRESET_FORMAT_VERSION:
            raise ValueError('Phiên bản preset chưa được hỗ trợ')
        if payload.get('type') != 'edit_export':
            raise ValueError('Preset không phải loại edit/export')
        values = payload.get('values', {})
        if isinstance(values, dict):
            allowed = set(DEFAULT_EXPORT_VALUES)
            return {key: value for key, value in values.items() if key in allowed}
        raise ValueError('Preset không hợp lệ')
    raise ValueError('Preset không tồn tại')