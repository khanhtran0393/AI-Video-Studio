'Thư viện tài nguyên dự án (CapCut): SFX / nhạc / overlay / logo / blend.\n\n＋ = nạp vào thư viện. Kéo / chọn = đưa lên timeline.\n'
from __future__ import annotations
import shutil
from pathlib import Path
from core.paths import PATHS
from core.sfx import scan_sfx_presets
LibraryKind = str
_AUDIO_EXT = {'.mp3', '.wma', '.ogg', '.wav', '.flac', '.m4a', '.aac'}
_IMAGE_EXT = {'.webp', '.jpeg', '.bmp', '.png', '.jpg', '.gif'}
_VIDEO_EXT = {'.avi', '.mkv', '.mov', '.webm', '.mp4', '.m4v'}
_OVERLAY_EXT = _IMAGE_EXT | _VIDEO_EXT
_KIND_EXTS: 'dict[str, set[str]]' = {'sfx': _AUDIO_EXT, 'bgm': _AUDIO_EXT, 'overlay': _OVERLAY_EXT, 'logo': _IMAGE_EXT | {'.mov', '.webm', '.mp4'}, 'blend': _OVERLAY_EXT}

def library_root(kind: LibraryKind) -> Path:
    key = 'blend' if str(kind) == 'background' else str(kind)
    path = PATHS.user_data / 'project_library' / key
    path.mkdir(parents=True, exist_ok=True)
    return path

def allowed_extensions(kind: LibraryKind) -> set[str]:
    key = 'blend' if str(kind) == 'background' else str(kind)
    return set(_KIND_EXTS.get(key, set()))

def list_library_items(kind: LibraryKind) -> list[tuple[str, str]]:
    key = 'blend' if str(kind) == 'background' else str(kind)
    items = {}
    if key == 'sfx':
        for name, path in scan_sfx_presets().items():
            items[name] = path
    folder = library_root(key)
    exts = allowed_extensions(key)
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.suffix.lower() not in exts:
            pass
        else:
            items[path.stem] = str(path.resolve())
    return sorted(items.items(), key=lambda pair: pair[0].casefold())

def import_into_library(kind: LibraryKind, source: str | Path) -> str:
    src = Path(source).expanduser().resolve()
    if src.is_file():
        key = 'blend' if str(kind) == 'background' else str(kind)
        if src.suffix.lower() not in allowed_extensions(key):
            raise ValueError(f'Định dạng không hỗ trợ cho {key}: {src.suffix}')
        dest_dir = library_root(key)
        dest = dest_dir / src.name
        stem = src.stem
        suffix = src.suffix
        index = 2
        while dest.exists() and dest.resolve() != src:
            dest = dest_dir / f'{stem}_{index}{suffix}'
            index += 1
        if dest.resolve() != src:
            shutil.copy2(src, dest)
        return str(dest.resolve())
    raise ValueError('File không tồn tại')

def _resolved_kind(kind: LibraryKind) -> str:
    return 'blend' if str(kind) == 'background' else str(kind)

def is_user_library_file(kind: LibraryKind, path: str | Path) -> bool:
    try:
        file = Path(path).expanduser().resolve()
        root = library_root(_resolved_kind(kind)).resolve()
    except OSError:
        return False
    if file.is_file():
        try:
            file.relative_to(root)
        except ValueError:
            return False
        return True
    return False

def remove_from_library(kind: LibraryKind, path: str | Path) -> None:
    if is_user_library_file(kind, path):
        Path(path).expanduser().resolve().unlink()
    else:
        raise ValueError('Chỉ xóa được file đã nạp vào thư viện')

def kind_label(kind: LibraryKind) -> str:
    key = str(kind)
    return 'Nền' if key == 'background' else {'sfx': 'SFX', 'bgm': 'Nhạc nền', 'overlay': 'Lớp phủ', 'logo': 'Logo', 'blend': 'Hòa trộn'}.get(key, key)