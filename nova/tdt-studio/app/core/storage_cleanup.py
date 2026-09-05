'''storage_cleanup.py — Quản lý file tạm / cache / log của app.

Hai nhóm API:
1. run_startup_housekeeping() — việc app TỰ dọn lúc khởi động (an toàn 100%,
   không cần hỏi user): log quá lớn thì giữ đuôi, TTS temp cũ > 7 ngày,
   cache xuất mồ côi ở thư mục xuất gần nhất (không còn part active).
2. scan_cleanup_targets() / run_cleanup() — cho dialog "Dọn dẹp & giải phóng
   dung lượng": xóa cache tái tạo được (stem cache, prebake/plate cache,
   .part mồ côi) và các nhóm do USER quyết (log, _working.srt mồ côi).

Nguyên tắc an toàn: mọi thao tác fail-safe (OSError bị nuốt, không raise),
không bao giờ đụng tới file nguồn video / dự án / file xuất .mp4.
'''
from __future__ import annotations
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

_TTS_TEMP_MAX_AGE_SEC = 7 * 86400
_LOG_MAX_BYTES = 2 * 1024 * 1024
_LOG_KEEP_TAIL_BYTES = 256 * 1024
_EXPORT_CACHE_ACTIVE_SEC = 6 * 3600
_ORPHAN_SUBTITLE_GRACE_SEC = 7 * 86400
_EXPORT_CACHE_DIR_NAMES = ('.vtp_export_cache', 'vtp_export_cache', '.vtp_prebake_cache', '.vtp_plate_cache')


def stem_cache_dir() -> Path:
    base = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or ''
    if base:
        return Path(base) / 'VideoToolsPro' / 'stem_cache'
    return Path(tempfile.gettempdir()) / 'vtp_vocal_sep'


def tts_temp_dirs() -> list[Path]:
    temp = Path(tempfile.gettempdir())
    return [temp / 'VideoToolsPro' / 'tts', temp / 'tdt_tts']


def app_log_files() -> list[Path]:
    from core.paths import PATHS
    roots = []
    for candidate in (PATHS.root, Path.cwd()):
        try:
            resolved = candidate.resolve()
        except OSError:
            resolved = candidate
        if resolved not in roots:
            roots.append(resolved)
    names = ('log.txt', 'log_crash.txt', 'startup_selfcheck.log', 'startup_with_check.log')
    found = []
    seen = set()
    for root in roots:
        for name in names:
            path = root / name
            if path.is_file():
                key = str(path).casefold()
                if key not in seen:
                    seen.add(key)
                    found.append(path)
    return found


def format_bytes(size: int) -> str:
    value = float(max(0, int(size)))
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if value < 1024 or unit == 'TB':
            return f'{value:.0f} {unit}' if unit == 'B' else f'{value:.1f} {unit}'
        value = value / 1024
    return f'{value:.1f} TB'


def _dir_size(path: Path) -> int:
    total = 0
    try:
        for child in path.rglob('*'):
            if child.is_file():
                try:
                    total += child.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass
    return total


def _file_age_sec(path: Path, now: float | None=None) -> float:
    try:
        return (now or time.time()) - path.stat().st_mtime
    except OSError:
        return 0.0


def _dir_has_recent_write(path: Path, within_sec: float) -> bool:
    try:
        for child in path.rglob('*'):
            try:
                if not child.is_file():
                    continue
                if (time.time() - child.stat().st_mtime) < within_sec:
                    return True
            except OSError:
                return True
    except OSError:
        return True
    return False


def _rmtree_quiet(path: Path) -> bool:
    try:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            return not path.exists()
        return False
    except OSError:
        return False


def _unlink_quiet(path: Path) -> bool:
    try:
        if path.is_file():
            path.unlink()
            return True
        return False
    except OSError:
        return False


def export_dir_cache_items(folder: Path) -> list[Path]:
    'Liệt kê toàn bộ cache/prebake/part mồ côi trong một thư mục xuất.'
    items: list[Path] = []
    if not folder.is_dir():
        return items
    for name in _EXPORT_CACHE_DIR_NAMES:
        path = folder / name
        if path.is_dir():
            items.append(path)
    try:
        for path in folder.glob('*_segs'):
            if path.is_dir():
                items.append(path)
        for pattern in ('*.part*', '*.faststart.part*'):
            for path in folder.glob(pattern):
                if path.is_file():
                    items.append(path)
        err_log = folder / 'last_export_ffmpeg_error.txt'
        if err_log.is_file():
            items.append(err_log)
    except OSError:
        pass
    return items


def orphan_subtitle_files(subtitle_workspace: Path, live_project_dirs: set[str], *, grace_sec: float=_ORPHAN_SUBTITLE_GRACE_SEC) -> list[Path]:
    'File .srt nằm dưới các thư mục dự án đã bị xóa (không còn file .vtp.json tương ứng).'
    workspace_text = str(subtitle_workspace or '').strip()
    if not workspace_text:
        return []
    workspace = Path(workspace_text).expanduser()
    if not workspace.is_dir():
        return []
    orphans: list[Path] = []
    try:
        live = {str(key).casefold() for key in live_project_dirs}
        for project_dir in workspace.iterdir():
            if not project_dir.is_dir():
                continue
            if project_dir.name.casefold() in live:
                continue
            for child in project_dir.rglob('*.srt'):
                if child.is_file() and _file_age_sec(child) > grace_sec:
                    orphans.append(child)
    except OSError:
        pass
    return orphans


@dataclass
class CleanupGroup:
    key: str
    title: str
    description: str
    default_checked: bool
    paths: list[Path] = field(default_factory=list)

    @property
    def size_bytes(self) -> int:
        total = 0
        for path in self.paths:
            try:
                if path.is_dir():
                    total += _dir_size(path)
                elif path.is_file():
                    total += path.stat().st_size
            except OSError:
                pass
        return total


def scan_cleanup_targets(*, export_folders: 'list[Path] | tuple[Path, ...]', subtitle_workspace: 'Path | str', live_project_dirs: 'set[str] | frozenset[str]') -> list[CleanupGroup]:
    groups: list[CleanupGroup] = []
    stem = stem_cache_dir()
    groups.append(CleanupGroup('stem_cache', 'Cache tách giọng (Demucs)', f'{stem}\nXóa xong, lần tách giọng sau phải chạy lại 1–10 phút/video.', True, [stem] if stem.is_dir() else []))
    export_paths: list[Path] = []
    for folder in export_folders:
        export_paths.extend(export_dir_cache_items(Path(folder).expanduser()))
    groups.append(CleanupGroup('export_cache', 'Cache xuất video (prebake, plate, .part mồ côi)', 'Tăng tốc xuất lô lần sau — xóa an toàn, app tạo lại khi cần.', True, export_paths))
    tts_paths: list[Path] = []
    for folder in tts_temp_dirs():
        if folder.is_dir():
            tts_paths.append(folder)
    temp_root = Path(tempfile.gettempdir())
    try:
        tts_paths.extend(path for path in temp_root.glob('tts_test_*.mp3') if path.is_file())
    except OSError:
        pass
    groups.append(CleanupGroup('tts_temp', 'File TTS tạm trong %TEMP%', 'Audio giọng đọc tạm — bản chính đã lưu nơi khác, giữ lại chỉ tốn chỗ.', True, tts_paths))
    groups.append(CleanupGroup('app_logs', 'Log hoạt động của app (log.txt, log_crash.txt…)', 'Hữu ích khi cần hỗ trợ kỹ thuật — chỉ dọn khi chắc chắn không cần gửi log.', False, app_log_files()))
    orphan_paths = orphan_subtitle_files(Path(subtitle_workspace).expanduser(), set(live_project_dirs))
    groups.append(CleanupGroup('orphan_subtitles', 'Phụ đề làm việc mồ côi (.srt của dự án đã xóa)', 'Có thể chứa phụ đề bạn dịch/sửa tay — kiểm tra kỹ trước khi dọn.', False, orphan_paths))
    return [group for group in groups if group.paths]


def run_cleanup(groups: 'list[CleanupGroup]', selected_keys: 'set[str] | frozenset[str]') -> tuple[int, int, int]:
    'Trả về (byte đã giải phóng, số mục đã xóa, số lỗi).'
    freed = 0
    removed = 0
    errors = 0
    for group in groups:
        if group.key not in selected_keys:
            continue
        for path in group.paths:
            try:
                if path.is_dir():
                    size = _dir_size(path)
                    if _rmtree_quiet(path):
                        freed += size
                        removed += 1
                    else:
                        errors += 1
                elif path.is_file():
                    try:
                        size = path.stat().st_size
                    except OSError:
                        size = 0
                    if _unlink_quiet(path):
                        freed += size
                        removed += 1
                    else:
                        errors += 1
            except OSError:
                errors += 1
    return freed, removed, errors


def _rotate_log_if_huge(path: Path) -> bool:
    try:
        size = path.stat().st_size
    except OSError:
        return False
    if size <= _LOG_MAX_BYTES:
        return False
    try:
        with path.open('rb') as handle:
            handle.seek(max(0, size - _LOG_KEEP_TAIL_BYTES))
            tail = handle.read()
        marker = f'\n\n===== [Log đã tự cắt bớt lúc {time.strftime("%d/%m/%Y %H:%M")}: file vượt {_LOG_MAX_BYTES // (1024 * 1024)}MB, giữ {len(tail) // 1024}KB gần nhất] =====\n\n'.encode('utf-8')
        path.write_bytes(marker + tail)
        return True
    except OSError:
        return False


def _clean_tts_temp(max_age_sec: float=_TTS_TEMP_MAX_AGE_SEC) -> int:
    removed = 0
    for folder in tts_temp_dirs():
        if not folder.is_dir():
            continue
        try:
            for child in list(folder.iterdir()):
                if child.is_file() and _file_age_sec(child) > max_age_sec:
                    if _unlink_quiet(child):
                        removed += 1
            try:
                if folder.is_dir() and not any(folder.iterdir()):
                    folder.rmdir()
            except OSError:
                pass
        except OSError:
            pass
    temp_root = Path(tempfile.gettempdir())
    try:
        for path in temp_root.glob('tts_test_*.mp3'):
            if path.is_file() and _file_age_sec(path) > max_age_sec:
                if _unlink_quiet(path):
                    removed += 1
    except OSError:
        pass
    return removed


def _clean_orphan_export_caches(export_folders: 'list[Path]') -> int:
    removed = 0
    for folder in export_folders:
        folder = Path(folder).expanduser()
        if not folder.is_dir():
            continue
        for path in export_dir_cache_items(folder):
            if not path.is_dir():
                continue
            if _dir_has_recent_write(path, _EXPORT_CACHE_ACTIVE_SEC):
                continue
            if _rmtree_quiet(path):
                removed += 1
    return removed


def run_startup_housekeeping(*, export_folders: 'list[Path] | None'=None) -> dict[str, int]:
    'Dọn tự động lúc khởi động — mọi lỗi bị nuốt, không bao giờ làm văng app.'
    summary = {'logs_rotated': 0, 'tts_temp_removed': 0, 'export_cache_removed': 0}
    try:
        for path in app_log_files():
            if _rotate_log_if_huge(path):
                summary['logs_rotated'] += 1
    except Exception:
        pass
    try:
        summary['tts_temp_removed'] = _clean_tts_temp()
    except Exception:
        pass
    try:
        if export_folders is None:
            export_folders = []
            try:
                from ui_qt.user_prefs import get_last_export_folder
                last = get_last_export_folder()
                if last:
                    export_folders = [Path(last)]
            except Exception:
                export_folders = []
        summary['export_cache_removed'] = _clean_orphan_export_caches(list(export_folders))
    except Exception:
        pass
    return summary


