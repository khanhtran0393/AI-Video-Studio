'Phát hiện điểm cắt cảnh (scene change) bằng FFmpeg — kiểu CapCut auto-split.'
from __future__ import annotations
import os
import re
import subprocess
import tempfile
from pathlib import Path
from config import FFMPEG_PATH
DEFAULT_SCENE_THRESHOLD = 0.42
DEFAULT_MIN_SCENE_MS = 1800
MAX_AUTO_SCENE_CUTS = 36
_SHOWINFO_PTS = re.compile('pts_time:([0-9]+(?:\\.[0-9]+)?)')

def _creation_flags() -> int:
    return int(getattr(subprocess, 'CREATE_NO_WINDOW', 0))

def _scene_detect_timeout_sec(*, end_ms: int, start_ms: int) -> int:
    span_ms = max(0, int(end_ms) - int(start_ms)) if int(end_ms) > 0 else 120000
    return max(15, min(90, int(span_ms / 1000.0 * 0.5) + 20))

def _kill_process_tree(pid: int) -> None:
    if pid <= 0:
        pass
    elif os.name == 'nt':
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=_creation_flags(), check=False, timeout=8)
        except Exception:
            pass
    else:
        try:
            os.kill(pid, 9)
        except OSError:
            pass

def _run_ffmpeg_scene_cmd(cmd: list[str], *, timeout_sec: int) -> str:
    limit = max(10, int(timeout_sec))
    err_path = None
    proc = None
    try:
        with tempfile.NamedTemporaryFile(mode='w+b', suffix='.ffmpeg_scene.txt', delete=False) as tmp:
            err_path = tmp.name
        with open(err_path, 'wb') as err_file:
            proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=err_file, creationflags=_creation_flags())
            try:
                proc.wait(timeout=limit)
            except subprocess.TimeoutExpired:
                pid = int(getattr(proc, 'pid', 0) or 0)
                _kill_process_tree(pid)
                try:
                    proc.wait(timeout=5)
                except Exception:
                    pass
                raise TimeoutError(f'Tách cảnh quá lâu (>{limit}s) — bỏ qua file này')
        blob = ''
        try:
            blob = Path(err_path).read_text(encoding='utf-8', errors='replace')
        except Exception:
            blob = ''
        if err_path:
            try:
                os.unlink(err_path)
            except:
                pass
        return blob
    except:
        if err_path:
            try:
                os.unlink(err_path)
            except OSError:
                pass
        raise

def detect_scene_cut_ms(video_path: str | Path, *, start_ms: int, end_ms: int, threshold: float, min_scene_ms: int, ffmpeg_path: str | None, analyze_width: int, timeout_sec: int | None) -> list[int]:
    path = Path(video_path)
    if path.is_file():
        thr = max(0.05, min(0.95, float(threshold)))
        min_gap = max(100, int(min_scene_ms))
        start_s = max(0.0, int(start_ms) / 1000.0)
        end_s = max(0.0, int(end_ms) / 1000.0) if int(end_ms) > 0 else 0.0
        if end_s > 0 and end_s <= start_s + 0.05:
            return []
        width = max(160, min(640, int(analyze_width)))
        vf = f"scale={width}:-2:flags=fast_bilinear,select='gt(scene\\,{thr:.3f})',showinfo"
        ffmpeg = str(ffmpeg_path or FFMPEG_PATH or 'ffmpeg')
        cmd = [ffmpeg, '-hide_banner', '-nostdin']
        if start_s > 0:
            cmd.extend(['-ss', f'{start_s:.3f}'])
        if end_s > 0:
            cmd.extend(['-to', f'{end_s:.3f}'])
        cmd.extend(['-i', str(path), '-an', '-vf', vf, '-f', 'null', '-'])
        limit = int(timeout_sec) if timeout_sec is not None else _scene_detect_timeout_sec(end_ms=int(end_ms), start_ms=int(start_ms))
        blob = _run_ffmpeg_scene_cmd(cmd, timeout_sec=limit)
        relative_ms = []
        for match in _SHOWINFO_PTS.finditer(blob):
            try:
                sec = float(match.group(1))
                relative_ms.append(int(round(sec * 1000.0)))
            except ValueError:
                continue
    else:
        raise FileNotFoundError(f'Không tìm thấy video: {path}')
    absolute = []
    for rel in relative_ms:
        abs_ms = int(start_ms) + max(0, rel)
        if end_ms > 0 and abs_ms >= end_ms or abs_ms <= int(start_ms):
            pass
        else:
            absolute.append(abs_ms)
    return thin_scene_cuts(merge_nearby_cuts(absolute, start_ms=int(start_ms), end_ms=int(end_ms) if end_ms > 0 else absolute[-1] + min_gap if absolute else 0, min_gap_ms=min_gap), max_cuts=MAX_AUTO_SCENE_CUTS)

def thin_scene_cuts(cut_ms: list[int], *, max_cuts: int) -> list[int]:
    cleaned = sorted({int(x) for x in cut_ms or []})
    limit = max(1, int(max_cuts))
    if len(cleaned) <= limit:
        return cleaned
    if limit == 1:
        return [cleaned[len(cleaned) // 2]]
    step = (len(cleaned) - 1) / float(limit - 1)
    picked = []
    for index in range(limit):
        pos = int(round(index * step))
        pos = max(0, min(len(cleaned) - 1, pos))
        value = cleaned[pos]
        if not picked or value != picked[-1]:
            picked.append(value)
    return picked

def merge_nearby_cuts(cut_ms: list[int], *, start_ms: int, end_ms: int, min_gap_ms: int) -> list[int]:
    if end_ms <= start_ms:
        return []
    gap = max(100, int(min_gap_ms))
    lo = int(start_ms) + gap
    hi = int(end_ms) - gap
    if hi <= lo:
        return []
    while True:
        pass