from __future__ import annotations
import json
import os
from pathlib import Path
_DEFAULT_PERCENT = 80
_MIN_PERCENT = 25
_MAX_PERCENT = 100
_DEFAULT_BATCH_AUTO_MAX = 4
_DEFAULT_BATCH_UNDER_JOB = 2
_DEFAULT_FFMPEG_THREADS_CAP = 0

def _settings_path() -> Path:
    base = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or ''
    if not base:
        base = str(Path.home())
    return Path(base) / 'VideoToolsPro' / 'demucs_settings.json'

def _read_settings() -> dict:
    path = _settings_path()
    try:
        if not path.is_file():
            return {}
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError):
        return {}

def _write_settings(data: dict) -> None:
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')

def get_demucs_cpu_thread_percent() -> int:
    data = _read_settings()
    try:
        pct = int(data.get('cpu_thread_percent', _DEFAULT_PERCENT))
        return max(_MIN_PERCENT, min(_MAX_PERCENT, pct))
    except (TypeError, ValueError):
        return _DEFAULT_PERCENT

def set_demucs_cpu_thread_percent(percent: int) -> int:
    pct = max(_MIN_PERCENT, min(_MAX_PERCENT, int(percent)))
    data = _read_settings()
    data['cpu_thread_percent'] = pct
    _write_settings(data)
    return pct

def set_batch_parallel_auto_max(value: int) -> int:
    v = max(1, min(16, int(value)))
    data = _read_settings()
    data['batch_parallel_auto_max'] = v
    _write_settings(data)
    return v

def set_batch_parallel_under_job(value: int) -> int:
    v = max(1, min(16, int(value)))
    data = _read_settings()
    data['batch_parallel_under_job'] = v
    _write_settings(data)
    return v

def settings_file_path() -> str:
    return str(_settings_path())

def get_batch_parallel_auto_max() -> int:
    data = _read_settings()
    try:
        value = int(data.get('batch_parallel_auto_max', _DEFAULT_BATCH_AUTO_MAX))
        return max(1, min(16, value))
    except (TypeError, ValueError):
        return _DEFAULT_BATCH_AUTO_MAX

def get_batch_parallel_under_job() -> int:
    data = _read_settings()
    try:
        value = int(data.get('batch_parallel_under_job', _DEFAULT_BATCH_UNDER_JOB))
        return max(1, min(16, value))
    except (TypeError, ValueError):
        return _DEFAULT_BATCH_UNDER_JOB

def ffmpeg_threads_for_export() -> int:
    data = _read_settings()
    cores = max(1, int(os.cpu_count() or 4))
    pct = get_demucs_cpu_thread_percent()
    from_budget = max(1, int(cores * pct / 100))
    parallel = max(1, get_batch_parallel_under_job())
    per_job = max(1, from_budget // parallel) if parallel >= 2 else from_budget
    soft_cap = 8
    try:
        cap = int(data.get('ffmpeg_threads_cap', _DEFAULT_FFMPEG_THREADS_CAP))
    except (TypeError, ValueError):
        cap = _DEFAULT_FFMPEG_THREADS_CAP
    if cap > 0:
        soft_cap = max(1, min(16, cap))
    return max(1, min(soft_cap, per_job, from_budget))

def demucs_torch_thread_count() -> int:
    cores = int(os.cpu_count() or 4)
    pct = get_demucs_cpu_thread_percent()
    return max(2, int(cores * pct / 100))

def ensure_default_settings_file() -> None:
    path = _settings_path()
    data = _read_settings() if path.is_file() else {}
    data.setdefault('cpu_thread_percent', _DEFAULT_PERCENT)
    data.setdefault('batch_parallel_auto_max', _DEFAULT_BATCH_AUTO_MAX)
    data.setdefault('batch_parallel_under_job', _DEFAULT_BATCH_UNDER_JOB)
    data.setdefault('ffmpeg_threads_cap', _DEFAULT_FFMPEG_THREADS_CAP)
    _write_settings(data)