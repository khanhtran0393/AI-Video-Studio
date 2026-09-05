'Pre-bake từng cảnh timeline ra file tạm — tránh đứng hình; song song + cache.'
from __future__ import annotations
import hashlib
import math
import os
import shutil
import subprocess
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
_DEFAULT_PREBAKE_WORKERS = 4

@dataclass(frozen=True)
class TimelinePrebakeSeg:
    source_path: 'str'
    start_sec: 'float'
    duration_sec: 'float'
    target_width: 'int'
    target_height: 'int'
    scale_x_percent: 'int' = 100
    scale_y_percent: 'int' = 100
    offset_x: 'int' = 0
    offset_y: 'int' = 0
    fps: 'int' = 30
    bg_path: 'str' = ''
    bg_start_sec: 'float' = 0.0
    source_duration_sec: 'float' = 0.0
    mirror_hflip: 'bool' = False
    warp_x_percent: 'int' = 100
    warp_y_percent: 'int' = 100
    crop_enabled: 'bool' = False
    crop_left: 'float' = 0.0
    crop_top: 'float' = 0.0
    crop_right: 'float' = 1.0
    crop_bottom: 'float' = 1.0
    letterbox_mode: 'str' = 'black'
    blur_strength: 'int' = 40
    face_reframe_plate: 'str' = ''
    source_width: 'int' = 0
    source_height: 'int' = 0

def _file_fingerprint(path: str) -> str:
    try:
        stat = Path(path).stat()
    except OSError:
        return 'missing'

def segment_cache_key(seg: TimelinePrebakeSeg, *, encoder_tag: str) -> str:
    payload = str(int(seg.target_height))([str(int(seg.scale_x_percent)), str(int(seg.scale_y_percent)), str(int(seg.offset_x)), str(int(seg.offset_y)), str(int(seg.fps or 30)), str(seg.bg_path or ''), _file_fingerprint(str(seg.bg_path or '')) if seg.bg_path else '', float(seg.bg_start_sec), '.3f', float(seg.source_duration_sec or 0), '.3f', '1' if seg.mirror_hflip else '0', str(int(seg.warp_x_percent or 100)), str(int(seg.warp_y_percent or 100)), '1' if seg.crop_enabled else '0', float(seg.crop_left), '.4f', float(seg.crop_top), '.4f', float(seg.crop_right), '.4f', float(seg.crop_bottom), '.4f', str(encoder_tag or 'x264'), str(seg.letterbox_mode or 'black'), str(int(seg.blur_strength or 0)), str(seg.face_reframe_plate or ''), str(int(seg.source_width or 0)), str(int(seg.source_height or 0)), 'v10-cfr'])
    return hashlib.md5(payload.encode('utf-8', errors='replace')).hexdigest()[:16]

def _prebake_worker_count(segment_count: int, *, using_nvenc: bool) -> int:
    if segment_count <= 1:
        return 1
    env_workers = str(os.environ.get('VTP_PREBAKE_WORKERS', '') or '').strip()
    if env_workers.isdigit():
        return max(1, min(int(env_workers), segment_count))
    legacy = str(os.environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip() in frozenset({'true', '1', 'yes', 'on'})
    if legacy:
        return 1
    if using_nvenc:
        return max(1, min(3, segment_count))
    cores = max(1, int(os.cpu_count() or 4))
    return max(1, min(_DEFAULT_PREBAKE_WORKERS, cores // 2, segment_count))

def _prebake_encoder_args(*, prefer_nvenc: bool) -> tuple[str, list[str]]:
    if prefer_nvenc:
        try:
            from core.encoder_probe import nvenc_available
            if nvenc_available():
                pass
        except Exception:
            pass
    else:
        return ('x264', ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p'])

def _prebake_output_frame_count(duration_sec: float, fps: int) -> int:
    rate = max(1, int(fps or 30))
    dur = max(0.05, float(duration_sec))
    return max(1, math.ceil(dur * rate - 1e-09))

def _build_prebake_command(seg: TimelinePrebakeSeg, dest: Path, *, ffmpeg_path: str, encoder_args: list[str]) -> list[str]:
    tw = max(2, int(seg.target_width))
    th = max(2, int(seg.target_height))
    sx = max(10, min(500, int(seg.scale_x_percent))) / 100.0
    sy = max(10, min(500, int(seg.scale_y_percent))) / 100.0
    ox = int(seg.offset_x)
    oy = int(seg.offset_y)
    from core.face_reframe import inner_plate_size, should_clip_video_to_plate
    plate_tail = ''
    if should_clip_video_to_plate(target_width=tw, target_height=th, plate_aspect=str(seg.face_reframe_plate or ''), source_width=int(seg.source_width or 0), source_height=int(seg.source_height or 0)):
        pw, ph = inner_plate_size(tw, th, str(seg.face_reframe_plate or ''))
        plate_tail = f",crop={pw}:{ph}:'max(0\\,min(iw-{pw}\\,(iw-{pw})/2-{ox}))':'max(0\\,min(ih-{ph}\\,(ih-{ph})/2-{oy}))'"
        ox = 0
        oy = 0
    fps = max(1, int(seg.fps or 30))
    dur = max(0.05, float(seg.duration_sec))
    out_frames = _prebake_output_frame_count(dur, fps)
    encode_dur = out_frames / float(fps)
    start = max(0.0, float(seg.start_sec))
    src_dur = max(0.05, float(seg.source_duration_sec or 0) or dur)
    ratio = dur / src_dur
    pre_bits = []
    if abs(ratio - 1.0) > 0.008:
        pre_bits.append(f'setpts={ratio:.6f}*(PTS-STARTPTS)')
    if seg.mirror_hflip:
        pre_bits.append('hflip')
    if seg.crop_enabled:
        from core.video_export import crop_filter_expression
        pre_bits.append(crop_filter_expression(float(seg.crop_left), float(seg.crop_top), float(seg.crop_right), float(seg.crop_bottom)))
    from core.scene_clip_fx import warp_inside_box_filter
    warp = warp_inside_box_filter(int(seg.warp_x_percent or 100), int(seg.warp_y_percent or 100))
    if warp:
        pre_bits.append(warp)
    pre = ','.join(pre_bits) + ',' if pre_bits else ''
    bg = str(seg.bg_path or '').strip()
    bg_ok = bool(bg) and Path(bg).is_file()
    if bg_ok:
        from core.video_export import _overlay_loop_frame_count
        bg_frames = _overlay_loop_frame_count(bg, fps)
        rate = float(max(1, fps))
        bg_cycle_sec = max(0.05, max(1, bg_frames - 2) / rate)
        bg_trim_start = max(0.0, float(seg.bg_start_sec)) % bg_cycle_sec
        fc = sx(sy)
        return ['-nostdin', '-i', bg, '-ss', f'{start:.3f}', '-t', f'{src_dur:.3f}', '-i', str(seg.source_path), '-filter_complex', fc, '-map', '[vout]', '-map', '1:a?', '-c:a', 'aac', *encoder_args, '-r', str(fps), '-frames:v', str(out_frames), str(dest)]
    mode = str(seg.letterbox_mode or 'black').strip().lower()
    fg_chain = f'setpts=PTS-STARTPTS,scale={tw}:{th}:force_original_aspect_ratio=decrease:flags=lanczos,scale=iw*{sx:g}:ih*{sy:g}:flags=lanczos{plate_tail},setsar=1,format=yuv420p[fg]'
    if mode == 'blur':
        from core.video_export import background_blur_radius_from_strength
        radius = background_blur_radius_from_strength(int(seg.blur_strength or 40))
        bg_parts = [f'[bgsrc]scale={tw}:{th}:force_original_aspect_ratio=increase:flags=lanczos', f'crop={tw}:{th}']
        if radius > 0:
            sigma_small = max(1.0, float(radius) / 3.2)
            bg_parts.extend(['scale=iw/4:ih/4:flags=bilinear', f'gblur=sigma={sigma_small:.2f}:steps=1', f'scale={tw}:{th}:flags=bilinear', 'eq=brightness=-0.04:saturation=1.05'])
        bg_parts.append(f'setsar=1,fps={fps},format=yuv420p[bg]')
        fc = f"setpts=PTS-STARTPTS,split=2[bgsrc][fgsrc];{','.join(bg_parts)};[fgsrc]scale={tw}:{th}:force_original_aspect_ratio=decrease:flags=lanczos,scale=iw*{sx:g}:ih*{sy:g}:flags=lanczos{plate_tail},setsar=1,format=yuv420p[fg];[bg][fg]overlay=x='(W-w)/2+{ox}':y='(H-h)/2+{oy}':eof_action=repeat,setsar=1,fps={fps},format=yuv420p[vout]"
    else:
        color = '0x30343b' if mode == 'gray' else 'black'
        fc = f";color=c={color}:s={tw}x{th}:r={fps}:d={encode_dur}.3f[bg];[bg][fg]overlay=x='(W-w)/2+{ox}':y='(H-h)/2+{oy}':eof_action=repeat,setsar=1,fps={fps},format=yuv420p[vout]"
    return ['-nostdin', '-ss', f'{start:.3f}', '-t', f'{src_dur:.3f}', '-i', str(seg.source_path), '-filter_complex', fc, '-map', '[vout]', '-map', '0:a?', '-c:a', 'aac', *encoder_args, '-r', str(fps), '-frames:v', str(out_frames), str(dest)]

def _materialize_cached_segment(cache_file: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        try:
            dest.unlink()
        except OSError:
            pass
    try:
        os.link(cache_file, dest)
    except OSError:
        shutil.copy2(cache_file, dest)
_PREBAKE_DURATION_EPS = 1e-09

def _prebake_frame_tolerance_sec(fps: int) -> float:
    return 1.0 / max(1, int(fps or 30))

def _probe_prebake_duration_sec(path: Path) -> float:
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

def _unlink_prebake_files(*paths: Path | None) -> None:
    seen = set()
    for path in paths:
        target = Path(path)
        if path is None or target in seen:
            continue
        seen.add(target)
        if target.is_file():
            try:
                target.unlink()
            except OSError:
                pass

def _assert_prebake_duration(path: Path, *, expected_sec: float, fps: int, also_unlink: Path | None) -> None:
    expected = float(expected_sec)
    actual = _probe_prebake_duration_sec(path)
    tolerance = _prebake_frame_tolerance_sec(fps)
    if actual + tolerance + _PREBAKE_DURATION_EPS >= expected:
        return None
    _unlink_prebake_files(path, also_unlink)
    raise RuntimeError(f'Pre-bake ngắn hơn dự kiến: {actual:.3f}s nhưng cần {expected:.3f}s (dung sai 1 frame={tolerance:.4f}s). File: {path}')

def prebake_timeline_segments(segments: list[TimelinePrebakeSeg] | tuple[TimelinePrebakeSeg, ...], output_dir: Path, *, ffmpeg_path: str, activity: Callable[[str], None] | None, stop_event: threading.Event | None, max_workers: int | None, cache_dir: Path | None, prefer_nvenc: bool) -> list[Path]:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_root = Path(cache_dir) if cache_dir is not None else out_dir.parent / '.vtp_prebake_cache'
    cache_root.mkdir(parents=True, exist_ok=True)
    total = len(segments)
    if total == 0:
        return []
    legacy = str(os.environ.get('VTP_EXPORT_LEGACY_SPEED', '') or '').strip() in frozenset({'true', '1', 'yes', 'on'})
    if legacy:
        prefer_nvenc = False
    encoder_tag, encoder_args = _prebake_encoder_args(prefer_nvenc=prefer_nvenc)
    using_nvenc = encoder_tag == 'nvenc'
    workers = max(1, int(max_workers)) if max_workers is not None else _prebake_worker_count(total, using_nvenc=using_nvenc)
    progress_lock = threading.Lock()
    done_count = 0
    cpu_fallback_lock = threading.Lock()
    cpu_encoder_tag, cpu_encoder_args = _prebake_encoder_args(prefer_nvenc=False)

    def _emit(message: str) -> None:
        if activity is not None:
            activity(message)
            return None

    def _run_encode(cmd: list[str], partial: Path) -> subprocess.CompletedProcess[str]:
        use_slot = any((tok in frozenset({'hevc_nvenc', 'h264_nvenc'}) for tok in cmd))
        if use_slot:
            from core.export_plate_cache import nvenc_slot
            with nvenc_slot():
                return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
        return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)

    def _bake_one(index: int, seg: TimelinePrebakeSeg) -> tuple[int, Path]:
        if stop_event is not None and stop_event.is_set():
            raise RuntimeError('Đã dừng xuất video')
        with cpu_fallback_lock:
            active_tag = encoder_tag
            active_args = list(encoder_args)
        key = segment_cache_key(seg, encoder_tag=active_tag)
        dest = 'seg_' / f'{index}03d.mp4'
        cached = cache_root / f'{key}.mp4'
        if cached.is_file() and cached.stat().st_size >= 512:
            _assert_prebake_duration(cached, expected_sec=float(seg.duration_sec), fps=int(seg.fps or 30), also_unlink=dest)
            _materialize_cached_segment(cached, dest)
            with progress_lock:
                done_count += 1
                _emit(f'Cắt cảnh tạm {done_count}/{total} (cache)…')
                return (index, dest)
            out_dir
            return (index, dest)
        partial = cache_root / f'{key}.part.mp4'
        if partial.exists():
            try:
                partial.unlink()
            except OSError:
                pass
        cmd = _build_prebake_command(seg, partial, ffmpeg_path=ffmpeg_path, encoder_args=active_args)
        completed = _run_encode(cmd, partial)
        if (completed.returncode != 0 or not partial.is_file() or partial.stat().st_size < 512) and active_tag == 'nvenc':
            with cpu_fallback_lock:
                encoder_tag = cpu_encoder_tag
                encoder_args = list(cpu_encoder_args)
                using_nvenc = False
            try:
                partial.unlink()
            except OSError:
                pass
            key = segment_cache_key(seg, encoder_tag=cpu_encoder_tag)
            cached = cache_root / f'{key}.mp4'
            if cached.is_file() and cached.stat().st_size >= 512:
                _assert_prebake_duration(cached, expected_sec=float(seg.duration_sec), fps=int(seg.fps or 30), also_unlink=dest)
                _materialize_cached_segment(cached, dest)
                with progress_lock:
                    done_count += 1
                    _emit(f'Cắt cảnh tạm {done_count}/{total} (cache)…')
                    return (index, dest)
            partial = cache_root / f'{key}.part.mp4'
            cmd = _build_prebake_command(seg, partial, ffmpeg_path=ffmpeg_path, encoder_args=list(cpu_encoder_args))
            completed = _run_encode(cmd, partial)
        else:
            if completed.returncode != 0 or not partial.is_file() or partial.stat().st_size < 512:
                detail = (completed.stderr or completed.stdout or '')[-800:]
                try:
                    partial.unlink()
                except OSError:
                    pass
                raise RuntimeError(f'Cắt cảnh tạm {index + 1}/{total} lỗi (rc={completed.returncode}):\n{detail}')
            _assert_prebake_duration(partial, expected_sec=float(seg.duration_sec), fps=int(seg.fps or 30), also_unlink=dest)
            try:
                partial.replace(cached)
            except OSError:
                shutil.copy2(partial, cached)
                try:
                    partial.unlink()
                except OSError:
                    pass
            _materialize_cached_segment(cached, dest)
            with progress_lock:
                done_count += 1
                _emit(f'Cắt cảnh tạm {done_count}/{total}…')
                return (index, dest)
    _emit(f'Cắt {total} cảnh tạm ({workers} luồng, {encoder_tag}, có cache)…')
    results = {}
    if workers == 1:
        for index, seg in enumerate(segments):
            idx, path = _bake_one(index, seg)
            results[idx] = path
        return [results[index] for index in range(total)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_bake_one, index, seg) for index, seg in enumerate(segments)]
        for fut in as_completed(futures):
            if stop_event is not None and stop_event.is_set():
                for pending in futures:
                    pending.cancel()
                raise RuntimeError('Đã dừng xuất video')
            idx, path = fut.result()
            results[idx] = path

def cleanup_prebake_dir(path: Path) -> None:
    folder = Path(path)
    if folder.is_dir():
        for child in folder.iterdir():
            try:
                child.unlink()
            except OSError:
                continue
    else:
        return None
    try:
        folder.rmdir()
    except OSError:
        pass