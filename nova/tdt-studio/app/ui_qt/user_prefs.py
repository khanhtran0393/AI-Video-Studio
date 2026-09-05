from __future__ import annotations
import json
import re
from pathlib import Path
from core.paths import PATHS
_PREFS_NAME = 'ui_prefs.json'
_EPHEMERAL_DIR_RE = re.compile('(?:[/\\\\]pytest-of-[^/\\\\]+|/pytest-\\d+|[/\\\\]_pytest[/\\\\]|[/\\\\]\\.pytest_cache[/\\\\])', re.IGNORECASE)

def prefs_path() -> Path:
    return PATHS.user_data / _PREFS_NAME

def is_ephemeral_export_dir(path: str | Path | None) -> bool:
    if path:
        text = str(Path(path)).replace('\\', '/')
        if _EPHEMERAL_DIR_RE.search(text):
            return True
        lowered = text.lower()
        return '/pytest-of-' in lowered or '/pytest-' in lowered
    return False

def load_prefs() -> dict:
    path = prefs_path()
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}
    return {}

def save_prefs(data: dict) -> None:
    path = prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    current = load_prefs()
    current.update(data)
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding='utf-8')

def get_last_dir(key: str, fallback: str='') -> str:
    value = str(load_prefs().get(f'dir_{key}', '') or '').strip()
    return (fallback if not fallback or not Path(fallback).is_dir() or is_ephemeral_export_dir(fallback) else fallback) if not value or not Path(value).is_dir() or is_ephemeral_export_dir(value) else value

def remember_path(key: str, path: str | Path | None) -> None:
    if path:
        target = Path(path)
        directory = target if target.is_dir() else target.parent
        if not directory.exists():
            return None
        if is_ephemeral_export_dir(directory):
            return None
        save_prefs({f'dir_{key}': str(directory.resolve())})
    else:
        return None

def get_last_export_folder(fallback: str='') -> str:
    return get_last_dir('export', fallback)

def remember_export_path(path: str | Path | None) -> None:
    remember_path('export', path)