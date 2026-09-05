from __future__ import annotations
import os
import re
import shutil
import subprocess
import threading
import time
from collections import deque
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable
from core.video_export import ExportPlan, export_workspace_dir, FFMPEG_PATH
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
_TIME_RE = re.compile('(?:out_time|time)=(\\d{2}):(\\d{2}):(\\d{2}(?:\\.\\d+)?)')
_HEARTBEAT_INTERVAL_SEC = 12.0
_VTP_SEG_RE = re.compile('^__VTP_SEG_(\\d+)__$')
_WINERROR_SHARING = 32

def _safe_activity(activity: Callable[[str], None] | None, message: str) -> None:
    if activity is None:
        pass
    else:
        try:
            activity(message)
        except RuntimeError as exc:
            if 'source has been deleted' not in str(exc).lower():
                raise

def _rm_dir_quiet(path: Path) -> None:
    try:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        else:
            return None
    except OSError:
        pass

def _dir_has_active_export_parts(cache: Path) -> bool:
    try:
        for path in cache.rglob('*'):
            if path.is_file():
                name = path.name.casefold()
                if name.startswith('part_') or '.part.' in name:
                    try:
                        age = time.time() - path.stat().st_mtime
                    except OSError:
                        return True
                    if age < 7200:
                        return True
        return False
    except OSError:
        return True

def cleanup_export_output_artifacts(final_path: str | Path, *, force: bool) -> None:
    final = Path(final_path).expanduser()
    try:
        parent = final.resolve().parent
    except OSError:
        parent = final.parent
    if parent.is_dir():
        stem = final.stem
        try:
            for orphan in parent.glob(f'{stem}.part*'):
                if orphan.is_file():
                    _safe_unlink(orphan, retries=2, delay=0.05)
            for orphan in parent.glob(f'{stem}.faststart.part*'):
                if orphan.is_file():
                    _safe_unlink(orphan, retries=2, delay=0.05)
        except OSError:
            pass
        err_log = parent / 'last_export_ffmpeg_error.txt'
        if err_log.is_file() and force:
            _safe_unlink(err_log, retries=2, delay=0.05)
        for folder in (parent / '.vtp_export_cache', parent / 'vtp_export_cache'):
            if folder.is_dir():
                ffmpeg_tmp = folder / '_ffmpeg_tmp'
                if ffmpeg_tmp.is_dir():
                    try:
                        for child in list(ffmpeg_tmp.iterdir()):
                            if child.name.startswith(f'p{os.getpid()}_'):
                                _rm_dir_quiet(child)
                        if ffmpeg_tmp.is_dir() and (not any(ffmpeg_tmp.iterdir())):
                            _rm_dir_quiet(ffmpeg_tmp)
                    except OSError:
                        pass
                if force:
                    _rm_dir_quiet(folder)
                elif _dir_has_active_export_parts(folder):
                    pass
                else:
                    try:
                        has_peer_sidecar = any(folder.glob('*.ass')) or any(folder.glob('*.fc.txt'))
                    except OSError:
                        has_peer_sidecar = True
                    if has_peer_sidecar:
                        pass
                    else:
                        _rm_dir_quiet(folder)

def _materialize_timeline_prebake(plan: ExportPlan, *, activity: Callable[[str], None] | None, stop_event: threading.Event | None) -> tuple[ExportPlan, Path | None]:
    segs = tuple(getattr(plan, 'timeline_prebake', ()) or ())
    if segs:
        from core.timeline_prebake import cleanup_prebake_dir, prebake_timeline_segments
        temporary = Path(plan.temporary_output)
        prebake_dir = temporary.parent / f'{temporary.stem}_segs'
        cache_dir = temporary.parent / '.vtp_prebake_cache'
        if activity is not None:
            activity(f'Cắt {len(segs)} cảnh tạm trước khi nối chuyển cảnh…')
        baked = prebake_timeline_segments(segs, prebake_dir, ffmpeg_path=str(FFMPEG_PATH), activity=activity, stop_event=stop_event, cache_dir=cache_dir)
        if len(baked) != len(segs):
            cleanup_prebake_dir(prebake_dir)
            raise RuntimeError('Pre-bake cảnh thiếu file — dừng xuất')
        cmd = list(plan.command)
        replaced = 0
        for index, token in enumerate(cmd):
            match = _VTP_SEG_RE.match(str(token))
            if match:
                seg_i = int(match.group(1))
                if seg_i < 0 or seg_i >= len(baked):
                    cleanup_prebake_dir(prebake_dir)
                    raise RuntimeError(f'Placeholder cảnh không hợp lệ: {token}')
                cmd[index] = str(baked[seg_i])
                replaced += 1
        if replaced != len(baked):
            cleanup_prebake_dir(prebake_dir)
            raise RuntimeError(f'Pre-bake: thay {replaced}/{len(baked)} input — lệnh xuất lệch')
        return (replace(plan, command=tuple(cmd)), prebake_dir)
    return (plan, None)

def _is_file_locked_error(exc: BaseException) -> bool:
    if isinstance(exc, PermissionError):
        return True
    if isinstance(exc, OSError):
        winerror = getattr(exc, 'winerror', None)
        if winerror == _WINERROR_SHARING:
            return True
        errno = getattr(exc, 'errno', None)
        if errno in frozenset({16, 11, 13}):
            return True
        text = str(exc).lower()
        return 'being used by another process' in text or 'access is denied' in text or 'resource busy' in text or ('device or resource busy' in text)
    return False

def _safe_unlink(path: Path, *, retries: int, delay: float) -> bool:
    target = Path(path)
    for attempt in range(max(1, int(retries))):
        try:
            if target.exists():
                target.unlink()
            return True
        except OSError as exc:
            if _is_file_locked_error(exc):
                time.sleep(delay * (1.0 + 0.35 * attempt))
                continue
            if target.exists():
                raise
            return True
    try:
        if target.exists():
            orphan = target.with_name(f'{target.stem}.locked_{os.getpid()}_{int(time.time())}{target.suffix}')
            target.rename(orphan)
    except OSError:
        pass
    return not target.exists()

def _unique_temporary_path(final: Path) -> Path:
    stamp = int(time.time() * 1000) % 1000000000
    return final.with_name(f"{final.stem}.part.{os.getpid()}.{stamp}{final.suffix or '.mp4'}")

def _retarget_plan_temporary(plan: ExportPlan, new_temporary: Path) -> ExportPlan:
    from dataclasses import replace
    old = str(Path(plan.temporary_output))
    new = str(Path(new_temporary))
    old_norm = os.path.normcase(os.path.normpath(old))
    rewritten = []
    for token in plan.command:
        try:
            if os.path.normcase(os.path.normpath(str(token))) == old_norm:
                rewritten.append(new)
            else:
                rewritten.append(token)
        except (TypeError, ValueError, OSError):
            rewritten.append(token)
    if old in plan.command and new not in rewritten:
        rewritten.append(new)
    return replace(plan, command=tuple(rewritten), temporary_output=new)

def _prepare_export_outputs(plan: ExportPlan) -> ExportPlan:
    temporary = Path(plan.temporary_output)
    final = Path(plan.final_output)
    final.parent.mkdir(parents=True, exist_ok=True)
    if _safe_unlink(temporary):
        return plan
    alt = _unique_temporary_path(final)
    _safe_unlink(alt)
    return _retarget_plan_temporary(plan, alt)

@dataclass
class _FfmpegProgressStats:
    frame: 'int' = 0
    fps: 'float' = 0.0
    speed: 'str' = ''
    out_time_ms: 'int' = 0
    total_size: 'int' = 0
    bitrate: 'str' = ''

    def summary(self) -> str:
        parts = []
        if self.out_time_ms:
            parts.append(f'out={self.out_time_ms / 1000:.1f}s')
        if self.frame:
            parts.append(f'frame={self.frame}')
        if self.fps:
            parts.append(f'fps={self.fps:g}')
        if self.speed:
            parts.append(f'speed={self.speed}')
        if self.total_size:
            parts.append(f'size={self.total_size / 1048576:.2f}MB')
        if self.bitrate:
            parts.append(f'br={self.bitrate}')
        return ' | '.join(parts) if parts else 'chờ tiến độ FFmpeg…'

def _parse_progress_stats(line: str, stats: _FfmpegProgressStats) -> None:
    text = (line or '').strip()
    if not text or '=' not in text:
        pass
    else:
        key, _, raw = (text.partition('=')[0], text.partition('=')[1], text.partition('=')[2])
        key = key.strip()
        raw = raw.strip()
        if raw in frozenset({'', 'N/A'}):
            pass
        else:
            try:
                if key == 'frame':
                    stats.frame = int(raw)
                    return None
                if key == 'fps':
                    stats.fps = float(raw)
                    return None
                if key in frozenset({'speed', 'stream_0_0_q'}):
                    if key == 'speed':
                        stats.speed = raw
                    return None
                if key == 'bitrate':
                    stats.bitrate = raw
                    return None
                if key == 'total_size':
                    stats.total_size = int(raw)
                    return None
                if key in frozenset({'out_time_ms', 'out_time_us'}):
                    stats.out_time_ms = int(int(raw) / 1000)
                else:
                    return None
            except ValueError:
                pass

class ExportCancelled(RuntimeError):
    pass

@dataclass(frozen=True)
class ExportResult:
    output_path: 'str'

def parse_progress(line: str, expected_duration_ms: int) -> int | None:
    text = (line or '').strip()
    if text:
        expected_ms = max(1, int(expected_duration_ms))
        if text.startswith('out_time_ms=') or text.startswith('out_time_us='):
            raw = text.partition('=')[2].strip()
            if raw in frozenset({'', 'N/A'}):
                return None
            try:
                elapsed_us = int(raw)
            except ValueError:
                pass
            return max(0, min(100, round(elapsed_us * 100 / (expected_ms * 1000))))
        match = _TIME_RE.search(text)
        if match is None:
            return None
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = float(match.group(3))
        elapsed_ms = int(round(((hours * 60 + minutes) * 60 + seconds) * 1000))
        return max(0, min(100, round(elapsed_ms * 100 / expected_ms)))

def format_export_error(detail: str, *, output_path: str | Path | None, heavy_filters: bool) -> str:
    text = (detail or '').strip()
    if text:
        lower = text.lower()
        if 'no space left on device' in lower or 'not enough space on the disk' in lower:
            disk_hint = _disk_status_hint()
            output_free_gb = None
            parent = Path(output_path).expanduser().parent
            free = _free_bytes(parent)
            if output_path and free is not None:
                output_free_gb = free / 1073741824
            body = 'FFmpeg báo «No space left on device» khi xuất.\nFile video nguồn nhỏ vẫn có thể lỗi vì:\n• Hiệu ứng nặng (TV CRT, blur, anti-duplicate) làm spike RAM → pagefile ổ C:\n• Windows ghi swap tạm trên C: dù file xuất chỉ vài chục MB\n• Thử: tắt hiệu ứng «TV» (Edit), xuất sang ổ D:, hoặc đóng app nặng'
            if output_free_gb is not None and output_free_gb >= 5:
                body += f'\n\nỔ chứa file xuất vẫn còn ~{output_free_gb:.0f} GB — thường không phải do output quá lớn mà do pagefile/temp trên C:.'
            if heavy_filters:
                body += '\n• Project đang bật filter nặng — đây là nguyên nhân hay gặp nhất.'
            body += '\n• Xóa *.part.mp4 và folder vtp_export_cache / .vtp_export_cache cạnh output'
            if disk_hint:
                body += f'\n\n{disk_hint}'
            return body
        if 'being used by another process' in lower or 'winerror 32' in lower or '[winerror 32]' in lower:
            return 'File xuất / file tạm (*.part.mp4) đang bị process khác giữ.\nThường do FFmpeg lần xuất trước còn chạy sau khi cửa sổ «Not Responding», hoặc đang mở file đó bằng trình phát / Explorer preview.\n\nCách xử lý:\n• Task Manager → kết thúc process ffmpeg.exe còn sót (nếu có)\n• Đóng app đang mở file .mp4 / .part.mp4 trong thư mục xuất\n• Xóa các file «…_xuat.part.mp4» rồi xuất lại\n• Hoặc chọn tên file xuất khác'
        if 'winerror 206' in lower or 'filename or extension is too long' in lower:
            return 'Lệnh xuất quá dài (WinError 206) — Windows chặn argv > ~32 KB.\nThường gặp khi video nhiều clip chuyển cảnh + stem/TTS/overlay.\n\nBản tool mới ghi filtergraph ra file (không nhét full vào lệnh).\nSync/reload UI rồi xuất lại. Nếu vẫn lỗi: đặt video/output ở path ngắn hơn.'
        if 'invalid too big' in lower and 'crop' in lower:
            return 'Lớp overlay/hòa trộn lớn hơn khung xuất (crop FFmpeg lỗi).\n\nCách xử lý:\n• Giảm «Kích thước» overlay/hòa trộn trong Inspector\n• Hoặc đổi tỷ lệ khung / chất lượng xuất'
        if 'do not match the corresponding' in lower and 'blend' in lower or ('failed to configure output pad' in lower and 'blend' in lower):
            return 'Lỗi hòa trộn (blend): sau khi xoay lớp, kích thước không khớp crop.\nTool mới đã sửa scale lại đúng hộp — reload app rồi xuất lại.\n\nTạm thời: đặt góc xoay hòa trộn về 0° hoặc tắt lớp Hòa trộn.'
        apply_line = ''
        key_line = ''
        for line in text.splitlines():
            stripped = line.strip()
            ll = stripped.lower()
            if 'error applying option' in ll:
                apply_line = stripped
            key_line = stripped
            if not stripped or ('error' not in ll and 'failed' not in ll) or 'no space' not in ll:
                pass
        if apply_line:
            key_line = apply_line
        return f'{key_line}\n\n(Chi tiết FFmpeg rút gọn — xem log.txt nếu cần)' if key_line and len(text) > 400 else text
    return 'FFmpeg kết thúc lỗi (không có log chi tiết).'

def format_pre_export_validation_error(exc: BaseException) -> tuple[str, str]:
    msg = str(exc).strip() or exc.__class__.__name__
    lower = msg.lower()
    return ('Không xuất được — nhạc nền (BGM)', f'{msg}\n\nCách xử lý:\n• Tab Âm thanh → «Chọn nhạc nền» hoặc tắt «Nhạc nền»\n• Timeline: track «Nhạc nền» trống → tắt BGM trong Inspector\n• Xuất batch: mẫu edit có thể bật BGM nhưng chưa chọn file') if 'nhạc nền' in lower and 'không tồn tại' in lower else ('Không xuất được — giọng đọc / TTS', f'{msg}\n\nChạy lại TTS cho clip hoặc tắt «Giọng đọc» trước khi xuất.') if 'lồng tiếng' in lower and 'không tồn tại' in lower else ('Không xuất được — file overlay', f'{msg}\n\nKiểm tra lại đường dẫn file ảnh/video overlay trong tab Chữ/Logo.') if 'overlay' in lower and 'không tồn tại' in lower else ('Chưa thể xuất video', msg)

def _volume_root(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if resolved.drive:
        return Path(f'{resolved.drive}\\')
    anchor = resolved.anchor
    return Path(anchor) if anchor else resolved

def _free_bytes(path: Path) -> int | None:
    try:
        pass
    except OSError:
        pass

def _format_free_gb(path: Path) -> str:
    free = _free_bytes(path)
    return 'không đọc được' if free is None else f'~{max(0, free // 1073741824)} GB'

def _disk_status_hint() -> str:
    parts = []
    for label, root in (('C:', Path('C:\\')), ('D:', Path('D:\\'))):
        if root.exists():
            parts.append(f'{label} còn {_format_free_gb(root)}')
    return 'Dung lượng hiện tại: ' + ', '.join(parts) if parts else ''

def export_disk_warning(path: str | Path, *, source_size_bytes: int) -> str | None:
    target = Path(path).expanduser()
    parent = target if target.suffix == '' else target.parent
    free = _free_bytes(parent)
    if free is None:
        return None
    free_gb = free / 1073741824
    source_gb = max(0, int(source_size_bytes)) / 1073741824
    needed_gb = max(0.5, source_gb * 3 + 0.3)
    drive = parent.drive.upper()
    if drive == 'C:' and free_gb < 15:
        return f'{free_gb:.1f} GB trống. Xuất trong project trên ổ C: dễ lỗi «No space left on device» khi FFmpeg chạy filter — nên chọn thư mục trên ổ D: (hoặc dọn thêm dung lượng ổ C:).'
    if free_gb < needed_gb:
        return f'Ổ {drive} chỉ còn ~{free_gb:.1f} GB — có thể không đủ cho clip này (ước tính cần ~{needed_gb:.1f} GB trống).'

def _estimate_export_bytes_needed(plan: ExportPlan) -> int:
    source_bytes = max(0, int(getattr(plan, 'source_size_bytes', 0) or 0))
    return max(536870912, source_bytes * 4 + 209715200)

def _ensure_export_disk_space(plan: ExportPlan, *, min_free_mb: int) -> None:
    final = Path(plan.final_output)
    output_dir = final.parent
    needed = max(_estimate_export_bytes_needed(plan), int(min_free_mb) * 1024 * 1024)
    issues = []

    def check(path: Path, min_bytes: int, label: str) -> None:
        free = _free_bytes(path)
        if free is None:
            return None
        if free < min_bytes:
            free_mb = free // 1048576
            need_mb = min_bytes // 1048576
            vol = path.drive or str(path)
            issues.append(f'{label} ({vol}: còn ~{free_mb} MB, cần ~{need_mb} MB trống)')
            return None
    check(output_dir, needed, 'Thư mục xuất')
    workspace = export_workspace_dir(final)
    if workspace.resolve() != output_dir.resolve():
        check(workspace, min(needed, 268435456), 'Cache xuất')
    temp_env = Path(os.environ.get('TEMP') or os.environ.get('TMP') or 'C:\\Windows\\Temp')
    out_root = _volume_root(output_dir)
    temp_root = _volume_root(temp_env)
    if temp_root != out_root and temp_env.is_dir():
        check(temp_env, 1073741824, 'TEMP Windows')
    c_root = Path('C:\\')
    if out_root != c_root and c_root.is_dir():
        check(c_root, 1073741824, 'ổ C:')
    if issues:
        hint = ''
        if out_root == c_root:
            hint = '\nGợi ý: xuất sang ổ D: (vd. D:\\VideoExport) thay vì folder trong project trên C:.'
        detail = 'Error: No space left on device — ' + '; '.join(issues) + hint
        if _disk_status_hint():
            detail += '\n' + _disk_status_hint()
        raise RuntimeError(format_export_error(detail))

def _ffmpeg_subprocess_env(plan: ExportPlan) -> dict[str, str]:
    env = dict(os.environ)
    workspace = export_workspace_dir(Path(plan.final_output)).resolve()
    tmp_dir = workspace / '_ffmpeg_tmp' / f'p{os.getpid()}_{int(time.time() * 1000)}'
    try:
        tmp_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        tmp_dir = workspace
    tmp_str = str(tmp_dir)
    env['TEMP'] = tmp_str
    env['TMP'] = tmp_str
    env['TMPDIR'] = tmp_str
    return env

def _write_export_debug_log(final: Path, detail: str, command: tuple[str, ...]) -> str:
    try:
        log_path = final.parent / 'last_export_ffmpeg_error.txt'
        log_path.write_text('COMMAND:\n' + ' '.join(command) + '\n\nOUTPUT:\n' + str(final) + '\n\nFFMPEG LOG (tail):\n' + (detail or '(empty)'), encoding='utf-8')
    except OSError:
        return ''

def _mp4_playable(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    from config import FFPROBE_PATH
    try:
        completed = subprocess.run([FFPROBE_PATH, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW, timeout=45)
    except (OSError, subprocess.TimeoutExpired):
        return False
    if completed.returncode != 0:
        return False
    text = (completed.stdout or '').strip()
    if not text or text.upper() == 'N/A':
        return False
    try:
        pass
    except ValueError:
        return False

def _probe_video_stream_duration_sec(path: Path) -> float:
    if path.is_file():
        from config import FFPROBE_PATH
        try:
            completed = subprocess.run([FFPROBE_PATH, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW, timeout=45)
        except (OSError, subprocess.TimeoutExpired):
            return 0.0
        text = (completed.stdout or '').strip().splitlines()
        if text:
            try:
                value = float(text[0])
            except ValueError:
                return 0.0
            return value if value > 0.0 else 0.0
    return 0.0

def _assert_video_not_frozen(path: Path, expected_duration_ms: int, *, debug_final: Path | None, debug_detail: str, debug_command: tuple[str, ...]) -> None:
    expected_s = max(0.0, float(expected_duration_ms) / 1000.0)
    if expected_s < 12.0:
        return None
    video_s = _probe_video_stream_duration_sec(path)
    if video_s <= 0.0:
        return None
    if video_s < expected_s * 0.45:
        message = f'.1fs nhưng dự kiến {expected_s}.1fs. Hãy xuất lại. File tạm: {path}'
        debug_path = ''
        if debug_final is not None:
            debug_path = _write_export_debug_log(debug_final, debug_detail, debug_command)
        if debug_path:
            message += f'\n\nChi tiết FFmpeg: {debug_path}'
        raise RuntimeError(message)

def _mux_export_audio(temporary: Path, plan: ExportPlan, *, popen, stop: threading.Event | None, activity: Callable[[str], None] | None) -> Path:
    from core.ffmpeg_cli import filter_complex_from_file_args
    filt = str(getattr(plan, 'audio_mux_filter', '') or '').strip()
    inputs = tuple(getattr(plan, 'audio_mux_inputs', ()) or ())
    if filt and temporary.is_file():
        out = temporary.with_name(f'{temporary.stem}.amux{temporary.suffix}')
        _safe_unlink(out)
        fc_script = temporary.with_name(f'{temporary.stem}.amux.fc.txt')
        try:
            fc_script.write_text(filt, encoding='utf-8')
        except OSError as exc:
            raise RuntimeError(f'Không ghi được filter mux audio: {exc}') from exc
        expected_ms = max(1, int(getattr(plan, 'expected_duration_ms', 0) or 1))
        expected_s = max(0.05, float(expected_ms) / 1000.0)
        try:
            from core.demucs_config import ffmpeg_threads_for_export
            thr = max(2, min(8, int(ffmpeg_threads_for_export())))
        except Exception:
            thr = 4
        cmd = [str(FFMPEG_PATH), '-y', '-nostdin', '-threads', str(thr), '-i', str(temporary)]
        for raw in inputs:
            path = str(raw or '').strip()
            if path:
                cmd.extend(['-i', path])
        cmd.extend(filter_complex_from_file_args(fc_script, graph_text=filt))
        cmd.extend(['-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', f'{expected_s:.3f}', str(out)])
        if activity is not None:
            activity(f'Mux audio sau plate ({len(inputs)} file stem/TTS) — {out.name}')
        process = popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors='replace', creationflags=CREATE_NO_WINDOW)
        if stop is not None and stop.is_set():
            _terminate_process(process)
            raise ExportCancelled('Đã dừng xuất video')
        stderr = ''
        stream = getattr(process, 'stderr', None)
        if stream is not None:
            try:
                stderr = stream.read() or ''
            except (ValueError, OSError):
                stderr = ''
        return_code = process.wait()
        if stop is not None and stop.is_set():
            _terminate_process(process)
            raise ExportCancelled('Đã dừng xuất video')
        if return_code != 0 or not out.is_file() or out.stat().st_size == 0:
            _safe_unlink(out)
            tail = '\n'.join((stderr or '').splitlines()[-20:])
            raise RuntimeError('Mux audio sau plate thất bại.' + (f'\n{tail}' if tail else ''))
        _safe_unlink(temporary)
        try:
            os.replace(out, temporary)
        except OSError:
            return cmd.extend
    return temporary

def _pass2_video_encoder_args(plan: ExportPlan) -> tuple[list[str], str]:
    import os
    cmd = [str(tok) for tok in getattr(plan, 'command', ()) or ()]
    encoder = ''
    preset = ''
    cq = ''
    fps = ''
    for index, token in enumerate(cmd):
        if token == '-c:v' and index + 1 < len(cmd):
            encoder = cmd[index + 1]
        elif token == '-preset' and index + 1 < len(cmd):
            preset = cmd[index + 1]
        elif token == '-cq' and index + 1 < len(cmd):
            cq = cmd[index + 1]
        elif token != '-r' or index + 1 >= len(cmd) or fps:
            pass
        else:
            fps = cmd[index + 1]
    legacy = str(os.environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip().lower() in frozenset({'true', 'yes', 'on', '1'})
    if encoder in frozenset({'h264_nvenc', 'hevc_nvenc'}):
        if legacy:
            args = ['-c:v', encoder, '-preset', preset or 'p4', '-rc', 'vbr', '-cq', cq or '20', '-pix_fmt', 'yuv420p']
            label = 'NVENC/legacy'
        else:
            args = ['-c:v', encoder, '-preset', 'p1', '-rc', 'vbr', '-cq', '21', '-b:v', '0', '-pix_fmt', 'yuv420p']
            label = 'NVENC/p1'
        if fps:
            args.extend(['-r', fps])
        return (args, label)
    args = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p']
    if fps:
        args.extend(['-r', fps])
    return (args, 'CPU')

def _apply_deferred_lightsweep_pass(temporary: Path, plan: ExportPlan, *, popen, stop: threading.Event | None, activity: Callable[[str], None] | None, progress: Callable[[int], None] | None, _force_no_hwaccel: bool, _force_aac_audio: bool) -> Path:
    from config import FFMPEG_PATH
    from core.video_export import sanitize_ffmpeg_noise_alls
    filt = sanitize_ffmpeg_noise_alls(str(getattr(plan, 'deferred_video_filter', '') or '')).strip()
    if filt and temporary.is_file():
        out = temporary.with_name(f'{temporary.stem}.pass2{temporary.suffix}')
        _safe_unlink(out)
        extra_inputs = tuple(getattr(plan, 'deferred_extra_inputs', ()) or ())
        fc_script = temporary.with_name(f'{temporary.stem}.pass2.fc.txt')
        try:
            fc_script.write_text(filt, encoding='utf-8')
        except OSError:
            fc_script = None
        enc_args, enc_label = _pass2_video_encoder_args(plan)
        try:
            from core.demucs_config import ffmpeg_threads_for_export
            thr = max(2, min(8, int(ffmpeg_threads_for_export())))
        except Exception:
            thr = 4
        filter_thr = max(1, min(4, thr // 2))
        has_xfade = 'xfade=' in filt
        has_geq = 'all_expr=' in filt or 'geq=' in filt
        fc_threads = '1' if has_xfade else str(max(2, min(3 if has_geq else 4, filter_thr)))
        if activity is not None:
            activity(f'Pass 2 threads={thr} filter_threads={filter_thr} fc_threads={fc_threads}' + (' · geq' if has_geq else '') + (' · xfade' if has_xfade else ''))
        cmd = [str(FFMPEG_PATH), '-y', '-nostdin', '-threads', str(thr), '-filter_threads', str(filter_thr), '-filter_complex_threads', str(fc_threads)]
        use_hwaccel = False
        flag = str(__import__('os').environ.get('VTP_PASS2_HWACCEL', '') or '').strip().lower()
        if not _force_no_hwaccel and flag in frozenset({'true', 'yes', 'on', '1'}):
            try:
                from core.encoder_probe import cuda_hwaccel_available
                use_hwaccel = bool(cuda_hwaccel_available())
            except Exception:
                use_hwaccel = False
        if use_hwaccel:
            cmd.extend(['-hwaccel', 'cuda'])
        cmd.extend(['-i', str(temporary)])
        for group in extra_inputs:
            parts = [str(part) for part in group if str(part).strip() != '']
            if parts:
                cmd.extend(parts)
        if fc_script is not None:
            from core.ffmpeg_cli import filter_complex_from_file_args
            cmd.extend(filter_complex_from_file_args(fc_script, graph_text=filt))
        else:
            cmd.extend(['-filter_complex', filt])
        expected_ms = max(1, int(getattr(plan, 'expected_duration_ms', 0) or 1))
        expected_s = max(0.05, float(expected_ms) / 1000.0)
        legacy = str(__import__('os').environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip().lower() in frozenset({'true', 'yes', 'on', '1'})
        if _force_aac_audio or legacy:
            audio_args = ['-c:a', 'aac', '-b:a', '192k']
            audio_label = 'a=aac'
        else:
            audio_args = ['-c:a', 'copy']
            audio_label = 'a=copy'
        cmd.extend(['-map', '[vout]', '-map', '0:a?', *audio_args, *enc_args, '-t', f'{expected_s:.3f}', '-progress', 'pipe:1', '-stats_period', '0.5', str(out)])
        if activity is not None:
            activity('FFmpeg pass 2 hiệu ứng' + (f' (+{len(extra_inputs)} lớp)' if extra_inputs else '') + f' · {enc_label}' + f' · {audio_label}' + (' · hwaccel=cuda' if use_hwaccel else '') + f' — {out.name}')
        if progress is not None:
            progress(90)
        process = popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors='replace', bufsize=1, creationflags=CREATE_NO_WINDOW)
        try:
            from core.cpu_budget import limit_process_cpu
            how = limit_process_cpu(process, shared=False)
            if activity is not None and how.startswith('affinity'):
                activity(f'Pass 2 — CPU {how}')
        except Exception:
            pass
        err_tail = deque(maxlen=40)
        last_hb = 0.0
        last_pct = -1
        started_at = time.time()
        last_progress_at = started_at
        hang_reason = []

        def _drain_pass2_stderr() -> None:
            stream = getattr(process, 'stderr', None)
            if stream is None:
                pass
            else:
                try:
                    for raw in stream:
                        line = raw.strip() if isinstance(raw, str) else str(raw).strip()
                        if line:
                            err_tail.append(line)
                except (ValueError, OSError):
                    pass

        def _pass2_out_size() -> int:
            try:
                if out.is_file():
                    return int(out.stat().st_size)
            except OSError:
                return 0

        def _pass2_watchdog() -> None:
            while process.poll() is None:
                if stop is not None and stop.is_set():
                    return None
                time.sleep(5.0)
                now = time.time()
                size_now = _pass2_out_size()
                if activity is not None:
                    activity(f'♥ Pass 2 đang chạy | UI ~{(last_pct if last_pct >= 0 else 90)}% | out={size_now / 1048576:.2f}MB | chờ {int(now - started_at)}s')
                if size_now < 1024 and now - started_at > 90:
                    hang_reason.append('Pass 2 treo >90s (chưa ghi frame). Thường do loop overlay buffer quá lớn hoặc lightsweep/geq/GPU bận. Đã giới hạn loop — xuất lại; nếu vẫn lỗi thử tắt lightsweep tạm.')
                    _terminate_process(process)
                    return None
                elif now - last_progress_at > 180:
                    hang_reason.append('Pass 2 treo >3 phút (không có tiến độ). Thường do nhiều ffmpeg tranh GPU — đã dừng process.')
                    _terminate_process(process)
                    return None
        stderr_thread = threading.Thread(target=_drain_pass2_stderr, daemon=True)
        stderr_thread.start()
        watch_thread = threading.Thread(target=_pass2_watchdog, daemon=True)
        watch_thread.start()
        try:
            try:
                assert process.stdout is not None
                for raw in process.stdout:
                    if stop is not None and stop.is_set():
                        _terminate_process(process)
                        raise ExportCancelled('Đã dừng xuất video')
                    line = raw.strip() if isinstance(raw, str) else str(raw).strip()
                    pct = parse_progress(line, expected_ms)
                    mapped = 90 + min(9, max(0, int(pct) * 9 // 100))
                    if pct is not None and progress is not None and (mapped != last_pct):
                        last_pct = mapped
                        last_progress_at = time.time()
                        progress(mapped)
                    if line.startswith('out_time_ms='):
                        last_progress_at = time.time()
                        if activity is None:
                            pass
                        elif time.time() - last_hb >= 3.0:
                            last_hb = time.time()
                            _safe_activity(activity, f'Pass 2 hiệu ứng — {line} (UI ~{(last_pct if last_pct >= 0 else 90)}%)')
                code = process.wait()
                stderr_thread.join(timeout=2.0)
                watch_thread.join(timeout=1.0)
                if hang_reason:
                    raise RuntimeError(hang_reason[0])
            except Exception:
                _terminate_process(process)
                _safe_unlink(out)
                raise
            if fc_script is not None:
                _safe_unlink(fc_script)
            if code != 0 or not out.is_file() or out.stat().st_size < 1024:
                if hang_reason:
                    raise RuntimeError(hang_reason[0])
                detail = '\n'.join(err_tail) or f'pass2 rc={code}'
                _safe_unlink(out)
                if use_hwaccel:
                    if activity is not None:
                        activity('Pass 2 hwaccel lỗi — thử lại decode CPU…')
                    return _apply_deferred_lightsweep_pass(temporary, plan, popen=popen, stop=stop, activity=activity, progress=progress, _force_no_hwaccel=True, _force_aac_audio=_force_aac_audio)
                if _force_aac_audio:
                    raise RuntimeError(f'Pass 2 hiệu ứng lỗi:\n{detail}')
                if activity is not None:
                    activity('Pass 2 audio copy lỗi — thử lại AAC…')
                return _apply_deferred_lightsweep_pass(temporary, plan, popen=popen, stop=stop, activity=activity, progress=progress, _force_no_hwaccel=True, _force_aac_audio=True)
            _safe_unlink(temporary)
            try:
                out.replace(temporary)
            except OSError:
                os.replace(out, temporary)
            if progress is not None:
                progress(99)
            return temporary
        except:
            if fc_script is not None:
                _safe_unlink(fc_script)
            raise
    else:
        return temporary

def _finalize_export_output(temporary: Path, final: Path) -> None:
    if _mp4_playable(temporary):
        try:
            if final.exists():
                _safe_unlink(final)
            os.replace(temporary, final)
        except OSError as exc:
            if _is_file_locked_error(exc):
                raise RuntimeError(f'[WinError 32] The process cannot access the file because it is being used by another process: {final}') from exc
            raise
        return None
    raise RuntimeError('FFmpeg chưa ghi xong file video (thiếu moov — file .part hỏng). Xuất lại và đợi đến «Hoàn tất xuất»; không mở file khi còn đang xuất.')

def _compose_failure_detail(tail: deque[str], error_lines: list[str]) -> str:
    parts = []
    if error_lines:
        parts.append('\n'.join(error_lines[-30:]))
    if tail:
        parts.append('\n'.join(list(tail)[-40:]))
    return '\n'.join(parts).strip()

def export_video(plan: ExportPlan, *, progress: Callable[[int], None] | None, activity: Callable[[str], None] | None, stop_event: threading.Event | None, popen) -> ExportResult:
    stop = stop_event or threading.Event()
    plan = _prepare_export_outputs(plan)
    temporary = Path(plan.temporary_output)
    final = Path(plan.final_output)
    sidecars = [Path(path) for path in getattr(plan, 'sidecar_paths', ()) or ()]
    prebake_dir = None
    timing = {}
    t0 = time.perf_counter()
    plan, prebake_dir = _materialize_timeline_prebake(plan, activity=activity, stop_event=stop)
    timing['prebake_s'] = round(time.perf_counter() - t0, 3)
    _ensure_export_disk_space(plan)
    ffmpeg_env = _ffmpeg_subprocess_env(plan)
    tail = deque(maxlen=80)
    error_lines = []
    last_progress = -1
    progress_lock = threading.Lock()
    progress_stats = _FfmpegProgressStats()
    process = None
    heartbeat_stop = threading.Event()

    def emit_activity(message: str) -> None:
        _safe_activity(activity, message)

    def part_size_mb() -> float:
        try:
            if not temporary.is_file():
                return 0.0
            return temporary.stat().st_size / 1048576
        except OSError:
            return 0.0

    def emit_progress(percent: int, *, finalize: bool, encoding_tail: bool) -> None:
        display = 100 if finalize else 99 if encoding_tail else min(max(0, percent), 97)
        with progress_lock:
            if display == last_progress:
                pass
            else:
                last_progress = display
                if progress is not None:
                    progress(display)
                if display >= 90:
                    expected_ms = max(1, int(plan.expected_duration_ms))
                    overrun = progress_stats.out_time_ms > expected_ms * 1.08
                    suffix = ' — CẢNH BÁO: out_time vượt clip (bug timeline?)' if overrun else ''
                    emit_activity(f'Tiến độ UI {display}% — {progress_stats.summary()} | part {part_size_mb():.2f}MB{suffix}')
            return None

    def remember_log_line(line: str) -> None:
        ll = line.lower()
        if 'error' in ll or 'failed' in ll or 'no space' in ll or ('invalid' in ll) or ('not found' in ll):
            error_lines.append(line)
            return None

    def ingest_progress_line(line: str) -> None:
        _parse_progress_stats(line, progress_stats)
        percent = parse_progress(line, plan.expected_duration_ms)
        if percent is not None:
            emit_progress(percent)
            return None

    def heartbeat_loop() -> None:
        while not heartbeat_stop.wait(_HEARTBEAT_INTERVAL_SEC):
            if stop.is_set():
                return None
            proc = process
            alive = _is_running(proc)
            pid = getattr(proc, 'pid', '?')
            with progress_lock:
                ui_pct = last_progress
            emit_activity(f"♥ FFmpeg PID {pid} {('đang chạy' if alive else 'đã dừng')} | UI {ui_pct}% | {progress_stats.summary()} | part {part_size_mb():.2f}MB")

    def drain_stderr() -> None:
        stream = getattr(process, 'stderr', None)
        if stream is None:
            pass
        else:
            try:
                for raw_line in stream:
                    if stop.is_set():
                        return None
                    line = raw_line.strip() if isinstance(raw_line, str) else str(raw_line).strip()
                    if line:
                        ingest_progress_line(line)
                        if line.startswith('progress='):
                            pass
                        else:
                            tail.append(line)
                            remember_log_line(line)
            except (ValueError, OSError):
                pass
    try:
        try:
            emit_activity('Chuẩn bị xuất — kiểm tra ổ đĩa, xóa file .part cũ, khởi chạy FFmpeg subprocess')
            if timing.get('prebake_s', 0) > 0.05:
                emit_activity(f"[Xuất timing] prebake={timing['prebake_s']:.1f}s")
            from core.export_plate_cache import compute_plate_cache_key, save_plate_cache, try_load_plate_cache
            cmd_tokens = [str(tok) for tok in plan.command or ()]
            enc_tag = 'nvenc' if any((tok in frozenset({'h264_nvenc', 'hevc_nvenc'}) for tok in cmd_tokens)) else 'x264'
            plate_key = compute_plate_cache_key(plan, encoder_tag=enc_tag)
            plate_hit = try_load_plate_cache(temporary, plate_key)
            t_pass1 = time.perf_counter()
            if plate_hit:
                emit_activity('Pass 1 plate — dùng cache (bỏ encode)…')
                emit_progress(90)
                timing['pass1_s'] = round(time.perf_counter() - t_pass1, 3)
                timing['pass1_cache'] = 1
                emit_activity(f"[Xuất timing] pass1={timing['pass1_s']:.1f}s (cache)")
            else:
                process = popen(plan.command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors='replace', bufsize=1, creationflags=CREATE_NO_WINDOW, env=ffmpeg_env)
                try:
                    from core.cpu_budget import limit_process_cpu
                    how = limit_process_cpu(process)
                except Exception:
                    how = 'none'
                emit_activity(f"FFmpeg đã khởi chạy PID {getattr(process, 'pid', '?')}" + (f' · CPU {how}' if how not in frozenset({'none', 'skip', 'full'}) else '') + ' — đọc tiến độ qua pipe')
                heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
                heartbeat_thread.start()
                if stop.is_set():
                    _terminate_process(process)
                    raise ExportCancelled('Đã dừng xuất video')
                if process.stdout is None:
                    raise RuntimeError('Không đọc được tiến độ FFmpeg')
                stderr_thread = threading.Thread(target=drain_stderr, daemon=True)
                stderr_thread.start()
                for raw_line in process.stdout:
                    if stop.is_set():
                        _terminate_process(process)
                        raise ExportCancelled('Đã dừng xuất video')
                    line = raw_line.strip()
                    ingest_progress_line(line)
                    if line.startswith('progress='):
                        pass
                    else:
                        tail.append(line)
                        remember_log_line(line)
        except Exception:
            heartbeat_stop.set()
            if process is not None and _is_running(process):
                _terminate_process(process)
            _safe_unlink(temporary)
            raise
        else:
            try:
                pass
            except OSError:
                pass
    except:
        if prebake_dir is not None:
            try:
                from core.timeline_prebake import cleanup_prebake_dir
                cleanup_prebake_dir(prebake_dir)
            except OSError:
                pass
    emit_activity('Pipe tiến độ FFmpeg đóng — đang đợi process kết thúc + ghi moov (có thể vài phút)')
    emit_progress(0, encoding_tail=True)
    return_code = process.wait()
    stderr_thread.join(timeout=2.0)
    heartbeat_stop.set()
    if stop.is_set():
        raise ExportCancelled('Đã dừng xuất video')
    if return_code != 0:
        detail = _compose_failure_detail(tail, error_lines)
        part_ok = temporary.is_file() and temporary.stat().st_size >= 524288
        enospc = 'no space left on device' in detail.lower()
        if part_ok and enospc and _mp4_playable(temporary):
            detail += '\n(FFmpeg báo ENOSPC nhưng file part hợp lệ — tiếp tục finalize)'
        else:
            debug_path = _write_export_debug_log(final, detail, plan.command)
            formatted = format_export_error(detail, output_path=final, heavy_filters=bool(getattr(plan, 'heavy_filters', False)))
            if debug_path:
                formatted += f'\n\nChi tiết FFmpeg: {debug_path}'
            raise RuntimeError(formatted or f'FFmpeg kết thúc với mã {return_code}')
    else:
        if not temporary.is_file() or temporary.stat().st_size == 0:
            raise RuntimeError('FFmpeg không tạo được file video đầu ra')
        timing['pass1_s'] = round(time.perf_counter() - t_pass1, 3)
        emit_activity(f"[Xuất timing] pass1={timing['pass1_s']:.1f}s")
    _assert_video_not_frozen(temporary, int(plan.expected_duration_ms or 0), debug_final=final, debug_detail=_compose_failure_detail(tail, error_lines), debug_command=tuple((str(tok) for tok in plan.command or ())))
    if not plate_hit:
        try:
            save_plate_cache(temporary, plate_key)
        except Exception:
            pass
    if str(getattr(plan, 'audio_mux_filter', '') or '').strip():
        emit_activity('Mux audio (stem/TTS) lên plate — tách khỏi xfade')
        t_mux = time.perf_counter()
        temporary = _mux_export_audio(temporary, plan, popen=popen, stop=stop, activity=emit_activity)
        timing['amux_s'] = round(time.perf_counter() - t_mux, 3)
        emit_activity(f"[Xuất timing] amux={timing['amux_s']:.1f}s")
    if getattr(plan, 'deferred_lightsweep', False):
        if str(getattr(plan, 'deferred_video_filter', '') or '').strip():
            emit_activity('Pass 2/2 — phủ hiệu ứng/overlay/phụ đề lên plate (tách khỏi timeline xfade)')

            def _pass2_ui_progress(display: int) -> None:
                value = max(90, min(99, int(display)))
                with progress_lock:
                    if value == last_progress:
                        pass
                    else:
                        last_progress = value
                        if progress is not None:
                            progress(value)
                    return None
            t_pass2 = time.perf_counter()
            temporary = _apply_deferred_lightsweep_pass(temporary, plan, popen=popen, stop=stop, activity=emit_activity, progress=_pass2_ui_progress)
            timing['pass2_s'] = round(time.perf_counter() - t_pass2, 3)
            emit_activity(f"[Xuất timing] pass2={timing['pass2_s']:.1f}s")
            _assert_video_not_frozen(temporary, int(plan.expected_duration_ms or 0), debug_final=final, debug_detail=_compose_failure_detail(tail, error_lines), debug_command=tuple((str(tok) for tok in plan.command or ())))
    emit_activity(f'Finalize — kiểm tra moov, rename part→final ({part_size_mb():.2f}MB)')
    _finalize_export_output(temporary, final)
    emit_progress(100, finalize=True)
    timing['total_s'] = round(time.perf_counter() - t0, 3)
    emit_activity('[Xuất timing] total={total:.1f}s (prebake={prebake:.1f}s pass1={pass1:.1f}s pass2={pass2:.1f}s)'.format(total=timing.get('total_s', 0), prebake=timing.get('prebake_s', 0), pass1=timing.get('pass1_s', 0), pass2=timing.get('pass2_s', 0)))
    emit_activity(f'Hoàn tất xuất — {final}')
    if prebake_dir is not None:
        try:
            from core.timeline_prebake import cleanup_prebake_dir
            cleanup_prebake_dir(prebake_dir)
        except:
            pass
    for sidecar in sidecars:
        try:
            _safe_unlink(sidecar, retries=3, delay=0.1)
        except OSError:
            continue
    try:
        cleanup_export_output_artifacts(final, force=False)
    except OSError:
        pass
    return ExportResult(str(final))

def _apply_faststart_inplace(final: Path, *, popen) -> None:
    from core.video_export import FFMPEG_PATH
    temp = final.with_name(f'{final.stem}.faststart.part{final.suffix}')
    _safe_unlink(temp)
    try:
        process = popen((str(FFMPEG_PATH), '-y', '-nostdin', '-i', str(final), '-c', 'copy', '-movflags', '+faststart', str(temp)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW)
        if process.wait() == 0 and temp.is_file() and (temp.stat().st_size > 0):
            os.replace(temp, final)
    except (OSError, ValueError):
        pass
    finally:
        _safe_unlink(temp, retries=3, delay=0.1)

def _is_running(process) -> bool:
    poll = getattr(process, 'poll', None)
    return callable(poll) and poll() is None

def _terminate_process(process) -> None:
    try:
        process.terminate()
        process.wait(timeout=3)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass
        return None