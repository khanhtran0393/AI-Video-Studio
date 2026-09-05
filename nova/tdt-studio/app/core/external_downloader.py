from __future__ import annotations
import json
from pathlib import Path
DEFAULT_DOWNLOADER_ROOT = Path('C:\\ALLINONE\\Video_Downloader')
DEFAULT_DOWNLOADER_BAT = DEFAULT_DOWNLOADER_ROOT / 'CHAY_DOWNLOADER.bat'
DEFAULT_DOWNLOAD_DIR = Path('C:\\Users\\Admin\\Desktop\\Video_Downloads')

def resolve_downloader_bat(root: Path | None=None) -> Path:
    base = Path(root) if root is not None else DEFAULT_DOWNLOADER_ROOT
    return base / 'CHAY_DOWNLOADER.bat'

def resolve_downloader_bat_if_present(root: Path | None=None) -> Path | None:
    path = resolve_downloader_bat(root)
    if path.is_file():
        return path

def downloader_working_dir(bat: Path | None=None) -> Path:
    return Path(bat or resolve_downloader_bat()).parent

def launch_spec(bat: Path | None=None) -> tuple[str, list[str], str]:
    path = Path(bat or resolve_downloader_bat())
    return ('cmd.exe', ['/c', 'call', str(path)], str(path.parent))

def read_download_dir(root: Path | None=None) -> Path:
    base = Path(root) if root is not None else DEFAULT_DOWNLOADER_ROOT
    config = base / 'data' / 'user_config.json'
    if config.is_file():
        try:
            data = json.loads(config.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            data = {}
        raw = str((data or {}).get('download_dir') or '').strip()
        if raw:
            return Path(raw)
    else:
        return DEFAULT_DOWNLOAD_DIR

def missing_bat_message(bat: Path | None=None) -> str:
    path = Path(bat or resolve_downloader_bat())
    return f'Không thấy bộ tải video: {path}'