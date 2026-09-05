'Theo dõi / diệt ffplay preview — tránh nhạc nền chạy ngầm sau khi tắt tool.'
from __future__ import annotations
import atexit
import os
import subprocess
import sys
from pathlib import Path
_CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
_tracked_pids: 'set[int]' = set()
_atexit_registered = False
_job_handle = None

def _our_ffplay_path() -> Path | None:
    try:
        from config import PATHS
        path = Path(PATHS.ffplay)
        if path.is_file():
            return path
    except Exception:
        pass

def _ensure_kill_on_close_job() -> None:
    if sys.platform != 'win32' or _job_handle is not None:
        pass
    else:
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.CreateJobObjectW(None, None)
            if handle:

                class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
                    _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64), ('LimitFlags', ctypes.c_uint32), ('MinimumWorkingSetSize', ctypes.c_size_t), ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', ctypes.c_uint32), ('Affinity', ctypes.c_size_t), ('PriorityClass', ctypes.c_uint32), ('SchedulingClass', ctypes.c_uint32)]

                class IO_COUNTERS(ctypes.Structure):
                    _fields_ = [('ReadOperationCount', ctypes.c_uint64), ('WriteOperationCount', ctypes.c_uint64), ('OtherOperationCount', ctypes.c_uint64), ('ReadTransferCount', ctypes.c_uint64), ('WriteTransferCount', ctypes.c_uint64), ('OtherTransferCount', ctypes.c_uint64)]

                class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
                    _fields_ = [('BasicLimitInformation', JOBOBJECT_BASIC_LIMIT_INFORMATION), ('IoInfo', IO_COUNTERS), ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t), ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]
                info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 8192
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                if kernel32.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
                    _job_handle = handle
                else:
                    kernel32.CloseHandle(handle)
                    return None
            else:
                return None
        except Exception:
            _job_handle = None

def _assign_pid_to_job(pid: int) -> None:
    if sys.platform != 'win32' or pid <= 0:
        pass
    else:
        _ensure_kill_on_close_job()
        if _job_handle:
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                PROCESS_ALL_ACCESS = 2035711
                handle = kernel32.OpenProcess(PROCESS_ALL_ACCESS, False, int(pid))
                if handle:
                    try:
                        kernel32.AssignProcessToJobObject(_job_handle, handle)
                    finally:
                        kernel32.CloseHandle(handle)
                    return None
            except Exception:
                pass

def register_ffplay_pid(pid: int | None) -> None:
    try:
        value = int(pid or 0)
    except (TypeError, ValueError):
        pass
    if value > 0:
        _tracked_pids.add(value)
        _assign_pid_to_job(value)

def unregister_ffplay_pid(pid: int | None) -> None:
    try:
        value = int(pid or 0)
    except (TypeError, ValueError):
        pass
    _tracked_pids.discard(value)

def _kill_pid(pid: int) -> None:
    if pid <= 0:
        pass
    elif sys.platform == 'win32':
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=_CREATE_NO_WINDOW, check=False)
        except Exception:
            pass
    else:
        try:
            os.kill(pid, 9)
        except OSError:
            pass

def kill_tracked_ffplay() -> int:
    killed = 0
    for pid in list(_tracked_pids):
        _kill_pid(pid)
        _tracked_pids.discard(pid)
        killed += 1
    return killed

def kill_orphan_ffplay(*, force_all_named: bool) -> int:
    killed = 0
    our = _our_ffplay_path()
    try:
        import psutil
    except Exception:
        psutil = None
    if psutil is not None:
        our_norm = str(our.resolve()).lower() if our is not None else ''
        for proc in psutil.process_iter(['pid', 'name', 'exe']):
            try:
                name = str(proc.info.get('name') or '').lower()
                exe = str(proc.info.get('exe') or '').strip()
                exe_norm = exe.lower().replace('/', '\\')
                if 'ffplay' not in name or (our_norm and exe_norm and (exe_norm != our_norm)):
                    pass
                elif not our_norm and (not force_all_named) and ('ffplay' not in name):
                    pass
                else:
                    proc.kill()
                    killed += 1
                    _tracked_pids.discard(int(proc.info.get('pid') or 0))
            except Exception:
                continue
    else:
        if sys.platform == 'win32' and (force_all_named or our is not None):
            try:
                result = subprocess.run(['taskkill', '/F', '/IM', 'ffplay.exe', '/T'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=_CREATE_NO_WINDOW, check=False)
                if int(getattr(result, 'returncode', 1) or 1) == 0:
                    killed = max(killed, 1)
            except Exception:
                pass
            _tracked_pids.clear()
        return killed
    return killed

def stop_all_preview_ffplay() -> int:
    n = kill_tracked_ffplay()
    n += kill_orphan_ffplay(force_all_named=False)
    return n

def ensure_ffplay_atexit() -> None:
    if _atexit_registered:
        return None
    _ensure_kill_on_close_job()
    atexit.register(stop_all_preview_ffplay)
    _atexit_registered = True