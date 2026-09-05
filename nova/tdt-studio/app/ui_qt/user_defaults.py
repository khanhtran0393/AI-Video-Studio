'Mặc định edit theo hướng video: dọc (portrait) / ngang (landscape).'
from __future__ import annotations
import json
from pathlib import Path
from typing import Literal
from core.paths import PATHS
from ui_qt.export_presets import preset_values
from ui_qt.state import DEFAULT_EXPORT_VALUES, ProjectState
Orientation = Literal['portrait', 'landscape']
USER_DEFAULTS_VERSION = 1
_FILE_NAME = 'orientation_defaults.json'

def user_defaults_path() -> Path:
    return PATHS.user_data / _FILE_NAME

def orientation_label(kind: Orientation) -> str:
    return 'Video dọc' if kind == 'portrait' else 'Video ngang'

def save_orientation_default(state: ProjectState, kind: Orientation, *, path: Path | None) -> str:
    destination = Path(path) if path is not None else user_defaults_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = _read_payload(destination)
    payload['version'] = USER_DEFAULTS_VERSION
    payload['defaults'][kind] = preset_values(state)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(destination)

def load_orientation_default(kind: Orientation, *, path: Path | None) -> dict[str, object] | None:
    source = Path(path) if path is not None else user_defaults_path()
    payload = _read_payload(source)
    raw = payload.get('defaults', {}).get(kind)
    if isinstance(raw, dict) and raw:
        allowed = set(DEFAULT_EXPORT_VALUES)
        return {key: value for key, value in raw.items() if key in allowed}

def has_orientation_default(kind: Orientation, *, path: Path | None=None) -> bool:
    return load_orientation_default(kind, path=path) is not None

def apply_orientation_default_to_state(state: ProjectState, kind: Orientation, *, path: Path | None) -> bool:
    values = load_orientation_default(kind, path=path)
    if values is None:
        return False
    keep_keys = ('timeline_clips', 'selected_timeline_clip_id', 'selected_timeline_clip_ids', 'timeline_audio_clips', 'voice_audio_path', 'subtitle_path', 'video_vocal_stem_path', 'video_instrumental_stem_path', 'vocal_sep_cache_path', 'logo_path', 'effect_overlay_path', 'blend_layer_path', 'background_audio_path', 'trim_start_ms', 'trim_end_ms', 'video_title_content')
    preserved = {key: state.values.get(key) for key in keep_keys if key in state.values}
    merged = dict(DEFAULT_EXPORT_VALUES)
    merged.update(values)
    merged.update({k: v for k, v in preserved.items() if v is not None})
    state.values.clear()
    state.values.update(merged)
    return True

def _read_payload(path: Path) -> dict:
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError, json.JSONDecodeError):
            return {'version': USER_DEFAULTS_VERSION, 'defaults': {}}
        if isinstance(payload, dict):
            defaults = payload.get('defaults')
            if not isinstance(defaults, dict):
                defaults = {}
            return {'version': int(payload.get('version', USER_DEFAULTS_VERSION) or 1), 'defaults': defaults}
    return {'version': USER_DEFAULTS_VERSION, 'defaults': {}}