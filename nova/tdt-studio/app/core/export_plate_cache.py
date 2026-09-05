'Cache file plate Pass A — bỏ encode Pass 1 khi timeline+encoder trùng.'
from __future__ import annotations
import hashlib
import os
import shutil
import threading
from pathlib import Path
from core.timeline_prebake import TimelinePrebakeSeg, segment_cache_key
_NVENC_SLOTS = threading.Semaphore(max(1, min(3, int(os.environ.get('VTP_NVENC_SLOTS', '3') or '3'))))

def nvenc_slot():
    return _NVENC_SLOTS

def plate_cache_dir(temporary: Path) -> Path:
    return Path(temporary).parent / '.vtp_plate_cache'

def compute_plate_cache_key(plan, *, encoder_tag: str) -> str:
    segs = tuple(getattr(plan, 'timeline_prebake', ()) or ())
    parts = ['plate_v1']
    if segs:
        for seg in segs:
            if isinstance(seg, TimelinePrebakeSeg):
                parts.append(segment_cache_key(seg, encoder_tag=encoder_tag or 'x264'))
            else:
                parts.append(repr(seg))
    else:
        cmd = [str(tok) for tok in getattr(plan, 'command', ()) or ()]
        temp = str(getattr(plan, 'temporary_output', '') or '')
        parts.append('|'.join((str(tok) for tok in cmd)))
    parts.append(str(getattr(plan, 'filter_complex', '') or ''))
    parts.append(str(int(getattr(plan, 'expected_duration_ms', 0) or 0)))
    cmd = [str(tok) for tok in getattr(plan, 'command', ()) or ()]
    for index, token in enumerate(cmd):
        if token in frozenset({'-preset', '-b:v', '-crf', '-cq', '-c:v', '-rc'}) and index + 1 < len(cmd):
            parts.append(f'{token}={cmd[index + 1]}')
    raw = '\n'.join(parts)
    return hashlib.md5(raw.encode('utf-8', errors='replace')).hexdigest()[:20]

def plate_cache_path(temporary: Path, key: str) -> Path:
    return plate_cache_dir(temporary) / f'{key}.mp4'

def try_load_plate_cache(temporary: Path, key: str) -> bool:
    if not key:
        return False
    if str(os.environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip().lower() in frozenset({'on', '1', 'true', 'yes'}):
        return False
    if str(os.environ.get('VTP_PLATE_CACHE', '1') or '1').strip().lower() in frozenset({'0', 'false', 'off', 'no'}):
        return False
    cached = plate_cache_path(temporary, key)
    if not cached.is_file() or cached.stat().st_size < 4096:
        return False
    temporary.parent.mkdir(parents=True, exist_ok=True)
    if temporary.exists():
        try:
            temporary.unlink()
        except OSError:
            pass
    try:
        os.link(cached, temporary)
    except OSError:
        shutil.copy2(cached, temporary)
    return temporary.is_file() and temporary.stat().st_size >= 4096

def save_plate_cache(temporary: Path, key: str) -> None:
    if not key or not temporary.is_file() or temporary.stat().st_size < 4096:
        pass
    elif str(os.environ.get('VTP_PLATE_CACHE', '1') or '1').strip().lower() in frozenset({'0', 'false', 'off', 'no'}):
        pass
    else:
        dest = plate_cache_path(temporary, key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        partial = dest.with_suffix('.part.mp4')
        try:
            if partial.exists():
                partial.unlink()
            shutil.copy2(temporary, partial)
            partial.replace(dest)
        except OSError:
            try:
                partial.unlink()
            except OSError:
                pass
            return None