from __future__ import annotations
import os
import sys
from pathlib import Path
from core.paths import PATHS
_DLL_HANDLES: 'list[object]' = []

def configure_runtime() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, 'reconfigure', None)
        if callable(reconfigure):
            try:
                reconfigure(encoding='utf-8', errors='replace')
            except (OSError, ValueError):
                pass
    os.environ['PATH'] = os.pathsep.join(_runtime_path_entries())

def _runtime_path_entries() -> list[str]:
    current_python = Path(sys.prefix).resolve()
    current_scripts = current_python / 'Scripts'
    entries = [str(current_python), str(current_scripts), str(PATHS.tools)]
    for entry in os.environ.get('PATH', '').split(os.pathsep):
        if entry and (not _is_conflicting_python_path(entry, current_python)) and (not _is_project_runtime_path(entry)) and (entry not in entries):
            entries.append(entry)
    return entries

def _is_conflicting_python_path(entry: str, current_python: Path) -> bool:
    try:
        path = Path(entry).resolve()
    except OSError:
        path = Path(entry)
    lower = str(path).lower()
    current = str(current_python).lower()
    return False if lower == current or lower.startswith(current + os.sep.lower()) else '\\python3' in lower or '\\programs\\python\\python' in lower or lower.endswith('\\python') or lower.endswith('\\python\\scripts')

def _is_project_runtime_path(entry: str) -> bool:
    try:
        path = Path(entry).resolve()
    except OSError:
        path = Path(entry)
    return path in {PATHS.runtime.resolve(), PATHS.vendor.resolve()}