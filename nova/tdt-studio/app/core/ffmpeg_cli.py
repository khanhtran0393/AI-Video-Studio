'FFmpeg CLI compatibility (gyan 6.x vs 9.x option renames).'
from __future__ import annotations
import re
import subprocess
import threading
from functools import lru_cache
from pathlib import Path
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
_lock = threading.Lock()
_fc_file_mode: 'str | None' = None
_has_fifo: 'bool | None' = None

def _ffmpeg_bin() -> str:
    from config import FFMPEG_PATH
    return str(FFMPEG_PATH)

@lru_cache(maxsize=1)
def ffmpeg_version_major() -> int:
    try:
        completed = subprocess.run([_ffmpeg_bin(), '-hide_banner', '-version'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20, creationflags=CREATE_NO_WINDOW)
    except (OSError, subprocess.TimeoutExpired):
        return 0
    text = (completed.stdout or '') + '\n' + (completed.stderr or '')
    match = re.search('ffmpeg version\\s+(\\d+)', text, re.IGNORECASE)
    if match:
        try:
            pass
        except ValueError:
            return 0
    else:
        return 0

def _probe_help_text() -> str:
    try:
        completed = subprocess.run([_ffmpeg_bin(), '-hide_banner', '-h', 'full'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=45, creationflags=CREATE_NO_WINDOW)
    except (OSError, subprocess.TimeoutExpired):
        return ''
    return (completed.stdout or '') + '\n' + (completed.stderr or '')

def _probe_supports_filter_complex_script() -> bool:
    return 'filter_complex_script' in _probe_help_text()

def ffmpeg_has_fifo_filters() -> bool:
    with _lock:
        if _has_fifo is not None:
            pass
        else:
            major = ffmpeg_version_major()
            if major >= 9:
                _has_fifo = False
            else:
                try:
                    completed = subprocess.run([_ffmpeg_bin(), '-hide_banner', '-filters'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30, creationflags=CREATE_NO_WINDOW)
                    listing = (completed.stdout or '') + '\n' + (completed.stderr or '')
                except (OSError, subprocess.TimeoutExpired):
                    listing = ''
                _has_fifo = bool(re.search('(?m)^[TSC.\\s]*fifo\\s', listing)) and bool(re.search('(?m)^[TSC.\\s]*afifo\\s', listing)) if listing.strip() else major > 0 and major < 9
        return

def video_pad_buffer_filter(raw_label: str, out_label: str) -> str:
    return f'[{raw_label}]fifo[{out_label}]' if ffmpeg_has_fifo_filters() else f'[{raw_label}]null[{out_label}]'

def audio_pad_buffer_filter(raw_label: str, out_label: str) -> str:
    return f'[{raw_label}]afifo[{out_label}]' if ffmpeg_has_fifo_filters() else f'[{raw_label}]anull[{out_label}]'

def filter_complex_file_mode() -> str:
    with _lock:
        if _fc_file_mode is not None:
            pass
        else:
            major = ffmpeg_version_major()
            if major >= 7:
                if major < 9 and _probe_supports_filter_complex_script():
                    _fc_file_mode = 'script'
                else:
                    _fc_file_mode = 'slash'
            else:
                _fc_file_mode = 'script' if _probe_supports_filter_complex_script() else 'slash' if major >= 7 else 'inline'
        return

def filter_complex_from_file_args(script_path: str | Path, *, graph_text: str) -> list[str]:
    path = str(script_path)
    mode = filter_complex_file_mode()
    if mode == 'slash':
        return ['-/filter_complex', path]
    if mode == 'script':
        return ['-filter_complex_script', path]
    text = graph_text.strip()
    if not text and Path(path).is_file():
        try:
            text = Path(path).read_text(encoding='utf-8')
        except OSError:
            text = ''
    if text:
        return ['-filter_complex', text]
    raise RuntimeError('FFmpeg không hỗ trợ đọc filter từ file và graph trống')

def reset_ffmpeg_cli_cache() -> None:
    with _lock:
        _fc_file_mode = None
        _has_fifo = None
    ffmpeg_version_major.cache_clear()