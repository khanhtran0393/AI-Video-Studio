from __future__ import annotations
from pathlib import Path
from core.paths import PATHS
from ui_qt.project_io import load_project, save_project
from ui_qt.state import ProjectState, empty_project_state
from ui_qt.project_registry import remember_project_path as register_project_path
from ui_qt.user_prefs import load_prefs
SESSION_DIRNAME = 'sessions'
LAST_SESSION_NAME = 'last_session.vtp.json'

def session_dir() -> Path:
    path = PATHS.user_data / SESSION_DIRNAME
    path.mkdir(parents=True, exist_ok=True)
    return path

def last_session_path() -> Path:
    return session_dir() / LAST_SESSION_NAME

def get_last_project_path() -> str:
    value = str(load_prefs().get('last_project_path', '') or '').strip()
    return value if value and Path(value).is_file() else ''

def remember_project_path(path: str | Path | None) -> None:
    register_project_path(path)

def session_has_work(state: ProjectState) -> bool:
    return True if any((asset.kind == 'video' and asset.path for asset in state.assets)) else True if state.subtitles.segments else True if state.asset_settings else True if state.sfx_events else False

def save_session(state: ProjectState, path: str | Path | None=None) -> str:
    destination = Path(path) if path else last_session_path()
    return save_project(state, destination)

def load_session(path: str | Path | None=None) -> ProjectState | None:
    source = Path(path) if path else last_session_path()
    if source.is_file():
        state: ProjectState | None = None
        try:
            state = load_project(source)
        except (OSError, ValueError, TypeError, KeyError):
            return None
        return state if state is not None and session_has_work(state) else None
    return None

def restore_startup_state() -> ProjectState:
    session = load_session()
    if session is not None:
        return session
    project = get_last_project_path()
    if project:
        try:
            loaded = load_project(project)
        except (OSError, ValueError, TypeError, KeyError):
            return empty_project_state()
        return loaded if session_has_work(loaded) else empty_project_state()
    return empty_project_state()