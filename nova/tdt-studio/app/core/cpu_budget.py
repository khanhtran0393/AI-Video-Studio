'Giới hạn CPU thật trên Windows (Job Object hard-cap), không chỉ cắt số thread.\n\n``torch.set_num_threads(80% cores)`` vẫn có thể đẩy Task Manager ~100% vì mỗi\nluồng chạy full. Hard-cap Job Object ép tổng CPU của ffmpeg/Demucs ≤ % cài đặt.\n'
from __future__ import annotations
import ctypes
import os
import threading
from typing import Any
_LOCK = threading.Lock()
_JOB = None
_JOB_PERCENT = -1

def _percent_from_settings() -> int:
    try:
        from core.demucs_config import get_demucs_cpu_thread_percent
    except Exception:
        return 80

def cpu_thread_budget(cores: int | None=None, percent: int | None=None) -> int:
    n = max(1, int(cores if cores is not None else os.cpu_count() or 4))
    pct = int(percent if percent is not None else _percent_from_settings())
    pct = max(25, min(100, pct))
    return max(1, int(n * pct / 100))

def _affinity_mask(percent: int) -> int:
    cores = max(1, int(os.cpu_count() or 4))
    keep = max(1, min(cores, int(cores * max(25, min(100, percent)) / 100)))
    return ((1 << cores) - 1 if cores < 64 else 18446744073709551615) if keep >= cores else (1 << keep) - 1

def _apply_affinity(pid: int, percent: int) -> bool:
    if os.name != 'nt' or pid <= 0:
        pass
    else:
        try:
            kernel32 = ctypes.windll.kernel32
            PROCESS_SET_INFORMATION = 512
            PROCESS_QUERY_INFORMATION = 1024
            access = PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION
            handle = kernel32.OpenProcess(access, False, int(pid))
            if handle:
                try:
                    mask = ctypes.c_size_t(_affinity_mask(percent))
                    ok = bool(kernel32.SetProcessAffinityMask(handle, mask))
                finally:
                    kernel32.CloseHandle(handle)
        except Exception:
            return False
    return False

def _ensure_job(percent: int):
    if os.name != 'nt':
        return None
    pct = max(25, min(100, int(percent)))
    with _LOCK:
        if _JOB is not None and _JOB_PERCENT == pct:
            return
        try:
            kernel32 = ctypes.windll.kernel32

            class JOBOBJECT_CPU_RATE_CONTROL_INFORMATION(ctypes.Structure):
                _fields_ = [('ControlFlags', ctypes.c_uint32), ('CpuRate', ctypes.c_uint32)]
            JOB_OBJECT_CPU_RATE_CONTROL_ENABLE = 1
            JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP = 4
            JobObjectCpuRateControlInformation = 15
            handle = kernel32.CreateJobObjectW(None, None)
            if handle:
                info = JOBOBJECT_CPU_RATE_CONTROL_INFORMATION()
                info.ControlFlags = JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP
                info.CpuRate = max(1, min(10000, pct * 100))
                ok = kernel32.SetInformationJobObject(handle, JobObjectCpuRateControlInformation, ctypes.byref(info), ctypes.sizeof(info))
                if ok:
                    if _JOB is not None:
                        try:
                            kernel32.CloseHandle(_JOB)
                        except Exception:
                            pass
                    _JOB = handle
                    _JOB_PERCENT = pct
                    return
                kernel32.CloseHandle(handle)
                return None
        except Exception:
            return None
        return None

def _assign_pid_to_job(pid: int, job) -> bool:
    if os.name != 'nt' or not job or pid <= 0:
        pass
    else:
        try:
            kernel32 = ctypes.windll.kernel32
            PROCESS_SET_QUOTA = 256
            PROCESS_TERMINATE = 1
            PROCESS_QUERY_INFORMATION = 1024
            access = PROCESS_SET_QUOTA | PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION
            handle = kernel32.OpenProcess(access, False, int(pid))
            if handle:
                try:
                    pass
                finally:
                    kernel32.CloseHandle(handle)
        except Exception:
            return False
    return False

def limit_process_cpu(proc: Any, percent: int | None=None, *, shared: bool) -> str:
    if proc is None:
        return 'skip'
    pid = int(getattr(proc, 'pid', 0) or 0)
    if pid <= 0:
        return 'skip'
    pct = int(percent if percent is not None else _percent_from_settings())
    pct = max(25, min(100, pct))
    if pct >= 100:
        return 'full'
    job = _ensure_job(pct)
    return f'job:{pct}%' if shared and job is not None and _assign_pid_to_job(pid, job) else f'affinity:{pct}%' if _apply_affinity(pid, pct) else 'none'

def limit_current_process_cpu(percent: int | None=None) -> str:

    class _Self:
        pid = os.getpid()
    return limit_process_cpu(_Self(), percent=percent)