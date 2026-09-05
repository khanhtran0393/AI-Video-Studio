from __future__ import annotations
import os
import sys
from dataclasses import dataclass
from pathlib import Path

def resolve_app_root() -> Path:
    return Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parents[1]

def _prefer_existing(*candidates: Path) -> Path:
    for path in candidates:
        if path.exists():
            return path
    return candidates[0]

@dataclass(frozen=True)
class ProjectPaths:
    root: 'Path'

    def __post_init__(self):
        object.__setattr__(self, 'root', self.root.resolve())

    def _bundled(self, name: str) -> Path:
        return _prefer_existing(self.root / name, self.root / '_internal' / name)

    @property
    def runtime(self) -> Path:
        return self.root / 'runtime'

    @property
    def vendor(self) -> Path:
        return self.root / 'vendor'

    @property
    def tools(self) -> Path:
        return self._bundled('tools')

    @property
    def ffmpeg(self) -> Path:
        return self.tools / 'ffmpeg.exe'

    @property
    def ffprobe(self) -> Path:
        return self.tools / 'ffprobe.exe'

    @property
    def ffplay(self) -> Path:
        return self.tools / 'ffplay.exe'

    @property
    def assets(self) -> Path:
        return self._bundled('assets')

    @property
    def fonts(self) -> Path:
        return self._bundled('fonts')

    @property
    def models(self) -> Path:
        return self.root / 'models'

    @property
    def prompts(self) -> Path:
        return self.root / 'prompts'

    @property
    def presets(self) -> Path:
        return self.root / 'presets'

    @property
    def user_data(self) -> Path:
        from core.brand import USER_DATA_DIR_NAME
        base = Path(os.environ.get('APPDATA', Path.home() / 'AppData' / 'Roaming'))
        return base / USER_DATA_DIR_NAME
PATHS = ProjectPaths(resolve_app_root())