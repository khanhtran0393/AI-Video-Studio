'\nlongtieng_merge.py — Ghép audio TTS vào video qua FFmpeg.\nDùng adelay + amix để đặt từng đoạn audio đúng thời điểm.\n'
from __future__ import annotations
import os
import subprocess
import threading
from pathlib import Path
from typing import Callable
import config as _cfg
_FFMPEG_STALL_SEC = 180.0

def _spawn_stall_killer(proc, get_last_activity, stop_event, stall_sec: float, poll: float=_FFMPEG_STALL_SEC):
    import time as _tt
    killed = [False]

    def _run():
        while True:
            if stop_event.wait(poll):
                return None
            if proc.poll() is not None:
                return None
            if _tt.time() - get_last_activity() > stall_sec:
                killed[0] = True
                try:
                    proc.kill()
                except Exception:
                    pass
                return None
    th = threading.Thread(target=_run, daemon=True)
    th.start()
    return (th, killed)

def _build_atempo_chain(speed: float) -> str:
    if speed <= 0 or abs(speed - 1.0) < 1e-06:
        return ''
    filters = []
    r = speed
    while r > 2.0:
        filters.append('atempo=2.0')
        r /= 2.0
    while r < 0.5:
        filters.append('atempo=0.5')
        r *= 2.0
    filters.append(f'atempo={r:.6f}')
    return ','.join(filters)

def split_batches(pieces: list, max_pieces: int, max_span: float, fps: float=0.0) -> list[list]:

    def _snap(t: float) -> float:
        return round(t * fps) / fps if fps > 0 else t
    sliced = []
    for st, en, ratio in pieces:
        if en - st > max_span and ratio <= 1.0001:
            _frame = 1.0 / fps if fps > 0 else 0.0
            t = st
            while t < en:
                nxt = _snap(min(t + max_span, en))
                if nxt <= t or en - nxt < _frame:
                    nxt = en
                sliced.append((t, nxt, ratio))
                t = nxt
        else:
            sliced.append((st, en, ratio))
    batches = []
    cur = []
    for p in sliced:
        if cur and (len(cur) >= max_pieces or p[1] - cur[0][0] > max_span):
            batches.append(cur)
            cur = []
        cur.append(p)
    if cur:
        batches.append(cur)
    return batches

def pick_render_parallelism(n_batches: int, avail_ram_gb: float, ram_percent: float, hard_cap: int=3, chunk_dur_min: float=0.0, heavy_filter: bool=False) -> int:
    workers = max(1, min(hard_cap, n_batches))
    if workers <= 1:
        return 1
    try:
        import shutil
        _c_usage = shutil.disk_usage('C:\\')
        _c_free_gb = _c_usage.free / 1073741824
        if _c_free_gb < 10:
            return 1
        if _c_free_gb < 20:
            workers = min(workers, 2)
    except Exception:
        pass
    if ram_percent >= 85:
        return 1
    if ram_percent >= 70:
        workers = min(workers, 2)
    _ram_per_worker = (6.0 if chunk_dur_min > 5 else 4.0 if chunk_dur_min > 3 else 3.0) if heavy_filter else 3.0 if chunk_dur_min > 5 else 2.0
    _affordable = max(1, int(avail_ram_gb // _ram_per_worker))
    workers = min(workers, _affordable)
    return max(1, workers)
_VRAM_GB_CACHE: 'list[float | None]' = [None]

def _detect_vram_gb() -> float:
    if _VRAM_GB_CACHE[0] is not None:
        return _VRAM_GB_CACHE[0]
    v = 0.0
    try:
        r = subprocess.run(['nvidia-smi', '--query-gpu=memory.total', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=5, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if r.returncode == 0 and r.stdout.strip():
            v = int(r.stdout.strip().splitlines()[0].strip()) / 1024.0
    except Exception:
        v = 0.0
    _VRAM_GB_CACHE[0] = v
    return v

def _gpu_par_for_vram(vram_gb: float) -> int:
    _env = os.environ.get('VTP_STRETCH_GPU_PAR', '')
    return int(_env) if _env.isdigit() and int(_env) > 0 else 3 if vram_gb >= 12 else 2 if vram_gb >= 6 else 1

def _stretch_parallelism(mode: str, cpu_par: int, vram_gb: float=0.0) -> int:
    return max(1, min(_gpu_par_for_vram(vram_gb), cpu_par)) if mode in ('nvenc_hw', 'nvenc') else max(1, cpu_par)

def _run_adelay_amix_merge(voice_files: list[dict], output_path: str, uid: str) -> None:
    import tempfile as _tf
    n = len(voice_files)
    script_path = os.path.join(_tf.gettempdir(), f'tdt_filter_{uid}.txt')
    cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y']
    for vf in voice_files:
        cmd += ['-i', vf['audio_path']]
    filter_parts = []
    labels = []
    for idx, vf in enumerate(voice_files):
        delay_ms = round(float(vf.get('start', 0)) * 1000)
        lbl = f'v{idx}'
        filter_parts.append(f'[{idx}:a]adelay={delay_ms}|{delay_ms}[{lbl}]')
        labels.append(f'[{lbl}]')
    _BATCH = 20
    if n <= _BATCH:
        filter_parts.append(f"{''.join(labels)}amix=inputs={n}:duration=longest:dropout_transition=0:normalize=0[out]")
    else:
        batch_labels = []
        for bi in range(0, n, _BATCH):
            chunk = labels[bi:bi + _BATCH]
            cn = len(chunk)
            blbl = f'vb{bi}'
            filter_parts.append(f"{''.join(chunk)}amix=inputs={cn}:duration=longest:dropout_transition=0:normalize=0[{blbl}]")
            batch_labels.append(f'[{blbl}]')
        if len(batch_labels) == 1:
            filter_parts.append(f'{batch_labels[0]}acopy[out]')
        else:
            filter_parts.append(f"{''.join(batch_labels)}amix=inputs={len(batch_labels)}:duration=longest:dropout_transition=0:normalize=0[out]")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(';'.join(filter_parts))
    from core.ffmpeg_cli import filter_complex_from_file_args
    cmd += [*filter_complex_from_file_args(script_path, graph_text=';'.join(filter_parts)), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', output_path]
    try:
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        r = subprocess.run(cmd, capture_output=True, timeout=600, creationflags=flags)
        if r.returncode != 0:
            err = r.stderr.decode(errors='replace')[-300:] if r.stderr else 'unknown'
            raise RuntimeError(f'FFmpeg adelay+amix lỗi:\n{err}')
    except:
        try:
            os.remove(script_path)
        except OSError:
            pass
    try:
        os.remove(script_path)
    except OSError:
        return None
    return None
    raise
    raise

def compute_stretch_plan(voice_results: list[dict], vid_dur: float) -> tuple[list[tuple[float, float, float]], list[dict], float, bool]:
    if not voice_results or vid_dur <= 0:
        return ([], [dict(r) for r in voice_results or []], float(vid_dur or 0.0), False)
    _sorted = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
    pieces = []
    new_results = []
    prev_src = 0.0
    out_t = 0.0
    any_stretch = False
    _n = len(_sorted)
    for _i, r in enumerate(_sorted):
        s_start = float(r.get('start', 0))
        s_end_raw = r.get('end', 0)
        s_end = float(s_end_raw) if s_end_raw else 0.0
        if s_end <= s_start:
            s_end = s_start + max(0.5, float(r.get('duration', 0)))
        s_end = min(s_end, vid_dur)
        if s_start >= vid_dur:
            break
        audio_dur = max(0.05, float(r.get('duration', 0) or s_end - s_start))
        if s_start > prev_src + 0.02:
            pieces.append((prev_src, s_start, 1.0))
            out_t += s_start - prev_src
        next_start = min(float(_sorted[_i + 1].get('start', 0)), vid_dur) if _i + 1 < _n else vid_dur
        zone_end = max(s_end, next_start)
        slot = max(0.1, zone_end - s_start)
        ratio = max(1.0, audio_dur / slot)
        if ratio > 1.01:
            any_stretch = True
        new_r = dict(r)
        new_r['start'] = out_t
        new_r['end'] = out_t + audio_dur
        new_r['duration'] = audio_dur
        new_results.append(new_r)
        pieces.append((s_start, zone_end, ratio))
        out_t += slot * ratio
        prev_src = zone_end
    if prev_src < vid_dur - 0.02:
        pieces.append((prev_src, vid_dur, 1.0))
        out_t += vid_dur - prev_src
    optimized = []
    for p in pieces:
        if optimized and abs(optimized[-1][2] - 1.0) < 0.0001 and (abs(p[2] - 1.0) < 0.0001):
            optimized[-1] = (optimized[-1][0], p[1], 1.0)
        else:
            optimized.append(p)
    pieces = [p for p in optimized if p[1] - p[0] > 0.01]
    return (pieces, new_results, out_t, any_stretch)

def stretch_pct_to_max_speed(pct: float) -> float:
    p = max(0.0, min(100.0, float(pct)))
    return 999.0 if p >= 99.5 else 1.0 + p / 100.0 if p <= 50.0 else 1.5 + (p - 50.0) / 30.0 * 0.5 if p <= 80.0 else 2.0 + (p - 80.0) / 19.5 * 2.0

def _cap_stretch_voice_speed(voice_results: list[dict], max_speed: float=1.2, _atempo=None) -> list[dict]:
    if _atempo is None:
        from .longtieng_audio_utils import _atempo_adjust as _atempo
    cap = max(1.0, min(2.5, float(max_speed if max_speed is not None else 1.2)))
    _rs = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
    for i, r in enumerate(_rs):
        start = float(r.get('start', 0))
        slot = float(_rs[i + 1].get('start', 0) if i + 1 < len(_rs) else r.get('end', 0)) - start
        cur = float(r.get('duration', 0))
        need = cur / slot
        voice_speed = min(cap, max(1.0, need ** 0.5))
        target = cur / voice_speed
        target = max(target, cur / cap)
        ap = r.get('audio_path')
        if slot > 0.05 and cur > slot * 1.01 and (target < cur - 0.01) and ap and os.path.isfile(ap):
            _atempo(ap, cur, target)
            r['duration'] = target
    return voice_results

def _stretch_too_long(vid_dur: float, max_min: float=45.0) -> bool:
    return max_min > 0 and vid_dur > max_min * 60.0

def _stretch_delta_negligible(out_t: float, vid_dur: float, floor_sec: float=5.0, pct: float=0.01) -> bool:
    return False if vid_dur <= 0 else out_t - vid_dur <= max(floor_sec, vid_dur * pct)

def _should_skip_stretch(out_t: float, vid_dur: float, max_ratio: float, max_speed: float) -> bool:
    return _stretch_delta_negligible(out_t, vid_dur) and max_ratio <= max_speed

def _fit_voices_to_slots(voice_results: list[dict], _atempo=None, max_speed: float=1.25) -> list[dict]:
    from .longtieng_audio_utils import enforce_non_overlapping_voice_segments
    _ = _atempo
    return enforce_non_overlapping_voice_segments(voice_results, max_speed=max_speed, smooth=True, hard_enforce=True)

def stretch_video_for_tts(input_video: str, voice_results: list[dict], output_path: str, stop_flag: threading.Event | None=None, progress_cb: Callable[[str], None] | None=None, gpu_backend: str='cpu', enc_features: dict | None=None, max_speed: float=1.2) -> list[dict]:
    import json as _json
    import tempfile
    if voice_results:
        _vid_dur = 0.0
        try:
            _ffprobe = _cfg.FFPROBE_PATH
            _pr = subprocess.run([_ffprobe, '-v', 'quiet', '-print_format', 'json', '-show_format', '-i', input_video], capture_output=True, text=True, timeout=30, encoding='utf-8', errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _vid_dur = float(_json.loads(_pr.stdout)['format']['duration'])
        except Exception:
            _vid_dur = 0.0
        if _vid_dur <= 0:
            if progress_cb:
                progress_cb('⚠️ Không probe được video duration — bỏ qua stretch.')
            return voice_results
        _vid_fps = 0.0
        try:
            _pf = subprocess.run([_cfg.FFPROBE_PATH, '-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', '-i', input_video], capture_output=True, text=True, timeout=30, encoding='utf-8', errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _fr = _pf.stdout.strip().split('/')
            _vid_fps = float(_fr[0]) / float(_fr[1]) if len(_fr) == 2 and float(_fr[1]) else float(_fr[0])
        except Exception:
            _vid_fps = 0.0
        if not 0 < _vid_fps < 121:
            _vid_fps = 30.0
        try:
            _max_min = float(os.environ.get('VTP_STRETCH_MAX_MIN', '45'))
        except ValueError:
            _max_min = 45.0
        if _stretch_too_long(_vid_dur, _max_min):
            if progress_cb:
                progress_cb(f"⚠️ Video dài ({_vid_dur / 60:.0f}' (>{_max_min:.0f}') — nén TTS cho khít thay vì kéo dài video (tránh treo/đầy đĩa khi xuất batch).")
            return _fit_voices_to_slots(voice_results, max_speed=max_speed)
        _cap_stretch_voice_speed(voice_results, max_speed=max_speed)
        _sorted = sorted(voice_results, key=lambda r: float(r.get('start', 0)))
        pieces, new_results, out_t, any_stretch = compute_stretch_plan(voice_results, _vid_dur)
        _n_over = sum((1 for p in pieces if p[2] > 1.01))
        _max_ratio = max((p[2] for p in pieces), default=1.0)
        _sum_audio = sum((float(r.get('duration', 0)) for r in _sorted))
        if progress_cb:
            progress_cb(f'📊 {len(_sorted)} subs, sum_audio={_sum_audio:.1f}s, vid={_vid_dur:.1f}s, zones_over_slot={_n_over}, max_ratio={_max_ratio:.2f}')
        if not any_stretch:
            if progress_cb:
                progress_cb('ℹ️ TTS không zone nào dài hơn slot SRT — không cần slow.')
            return voice_results
        if _should_skip_stretch(out_t, _vid_dur, _max_ratio, max_speed):
            if progress_cb:
                progress_cb(f'⚖️ Tổng TTS ngắn ({out_t:.1f}s / {_vid_dur:.0f}s), câu dài nhất {_max_ratio:.2f}x ≤ {max_speed:.2f}x — nén nhẹ, BỎ re-encode.')
            return _fit_voices_to_slots(voice_results, max_speed=max_speed)
        if progress_cb:
            progress_cb(f'🎬 {len(pieces)} pieces, video {_vid_dur:.1f}s → ~{out_t:.1f}s')
        _has_orig_audio = False
        try:
            from services_media import _has_audio
            _has_orig_audio = bool(_has_audio(input_video))
        except Exception:
            try:
                _pr_a = subprocess.run([_ffprobe, '-v', 'quiet', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', '-i', input_video], capture_output=True, text=True, timeout=15, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                _has_orig_audio = bool(_pr_a.stdout.strip())
            except Exception:
                _has_orig_audio = False
        _src_br = 1500
        try:
            _pr_br = subprocess.run([_ffprobe, '-v', 'quiet', '-print_format', 'json', '-show_format', '-i', input_video], capture_output=True, text=True, timeout=15, encoding='utf-8', errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _br_str = _json.loads(_pr_br.stdout).get('format', {}).get('bit_rate', '')
            if _br_str:
                _src_br = max(800, int(int(_br_str) / 1000))
        except Exception:
            pass
        _max_br = int(_src_br * 1.3)
        _buf_br = _max_br * 2
        import shutil as _shutil
        import time as _t, re as _re
        _stretch_avail_gb = 999.0
        try:
            import psutil as _ps2
            _stretch_avail_gb = _ps2.virtual_memory().available / 1073741824
        except Exception:
            pass
        _px_bytes = 3110400.0
        try:
            _pd = subprocess.run([_ffprobe, '-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', '-i', input_video], capture_output=True, text=True, timeout=15, encoding='utf-8', errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _w, _h = ((int(x) for x in _pd.stdout.strip).split(',')[:2]()[0], (int(x) for x in _pd.stdout.strip).split(',')[:2]()[1])
            if _w > 0 and _h > 0:
                _px_bytes = _w * _h * 1.5
        except Exception:
            pass
        _mb_per_sec = max(1.0, _px_bytes * _vid_fps / 1048576)
        _BATCH, _budget_mb = (25, 1536) if _stretch_avail_gb >= 16 else (12, 1024) if _stretch_avail_gb >= 8 else (6, 640) if _stretch_avail_gb >= 4 else (3, 384)
        _SPAN = max(5.0, _budget_mb / _mb_per_sec)
        _batches = split_batches(pieces, _BATCH, _SPAN, fps=_vid_fps)
        if progress_cb:
            progress_cb(f'🧠 Chunk ≤{_SPAN:.0f}s (~{_budget_mb}MB RAM/luồng) — {len(_batches)} chunk.')
        _tmp_dir = tempfile.mkdtemp(prefix='tdt_stretch_')
        _BELOW_NORMAL = 16384
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | _BELOW_NORMAL
        _cpu_threads = max(1, int((os.cpu_count() or 4) * 0.8))
        _re_progress = _re.compile(b'time=([\\d:.]+)')
        _feats = enc_features or {}
        _use_nvenc = gpu_backend == 'nvenc'
        _MODE_LABEL = {'nvenc_hw': 'GPU đầy đủ (NVDEC + NVENC)', 'nvenc': 'NVENC (CPU decode)', 'cpu': 'CPU (libx264)'}

        def _vid_enc(mode: str) -> list[str]:
            if mode in ('nvenc_hw', 'nvenc'):
                args = ['-c:v', 'h264_nvenc', '-preset', 'p5']
                if _feats.get('multipass'):
                    args += ['-multipass', 'fullres']
                args += ['-rc', 'vbr', '-cq', '25', '-b:v', f'{_src_br}k', '-maxrate', f'{_max_br}k', '-bufsize', f'{_buf_br}k', '-pix_fmt', 'yuv420p']
                return args
            return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-threads', str(_cpu_threads), '-maxrate', f'{_max_br}k', '-bufsize', f'{_buf_br}k', '-pix_fmt', 'yuv420p']

        def _run_batch(idx, batch, chunk_path, script_path, mode) -> tuple[int, str]:
            b_start = batch[0][0]
            b_end = batch[-1][1]
            b_span = max(0.05, b_end - b_start)
            _fl = []
            _ci = []
            for _i, (st, en, ratio) in enumerate(batch):
                _rs = max(0.0, st - b_start)
                _ren = en - b_start
                _fl.append(f'trim=start={_rs:.4f}:end={_ren:.4f},setpts={ratio:.6f}*(PTS-STARTPTS)[v{_i}]')
                if _has_orig_audio:
                    _af = f'atrim=start={_rs:.4f}:end={_ren:.4f},asetpts=PTS-STARTPTS'
                    _atempo = _build_atempo_chain(1.0 / ratio) if ratio > 1.0001 else ''
                    if _atempo:
                        _af += f',{_atempo}'
                    _af += f'[a{_i}]'
                    _fl.append(_af)
                    _ci.append(f'[v{_i}][a{_i}]')
                else:
                    _ci.append(f'[v{_i}]')
            if _has_orig_audio:
                _fl.append(f"{''.join(_ci)}concat=n={len(batch)}:v=1:a=1[outv][outa]")
                _amap = ['-map', '[outa]', '-c:a', 'pcm_s16le']
            else:
                _fl.append(f"{''.join(_ci)}concat=n={len(batch)}:v=1:a=0[outv]")
                _amap = ['-an']
            with open(script_path, 'w', encoding='utf-8') as _f:
                _f.write(';\n'.join(_fl))
            from core.ffmpeg_cli import filter_complex_from_file_args
            _hw = ['-hwaccel', 'auto'] if mode == 'nvenc_hw' else []
            cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y', *_hw, '-i', input_video, *filter_complex_from_file_args(script_path), '-map', '[outv]', *_vid_enc(mode), *_amap, '-movflags', '+faststart', chunk_path]
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, creationflags=flags)
            try:
                from exporter.exporter_preview_engine import _assign_to_job
                _assign_to_job(proc)
            except Exception:
                pass
            tail = []
            last_log = 0.0
            _last_act = [_t.time()]
            _wd_stop = threading.Event()
            _wd_th, _stalled = _spawn_stall_killer(proc, lambda: _last_act[0], _wd_stop)
            try:
                while not (stop_flag and stop_flag.is_set()):
                    line = proc.stderr.readline() if proc.stderr else b''
                    if line:
                        _last_act[0] = _t.time()
                        tail.append(line.decode(errors='replace'))
                        if len(tail) > 60:
                            tail.pop(0)
                        now = _t.time()
                        m = _re_progress.search(line)
                        if now - last_log > 3.0 and m and progress_cb:
                            progress_cb(f'⏳ Render batch {idx + 1}/{len(_batches)} (đoạn {m.group(1).decode()})')
                            last_log = now
                    elif proc.poll() is not None:
                        break
                    continue
                proc.terminate()
            finally:
                _wd_stop.set()
            try:
                proc.wait(timeout=60)
            except subprocess.TimeoutExpired:
                proc.kill()
            if _stalled[0]:
                tail.append(f'\n[STALL] FFmpeg đứng hình > {int(_FFMPEG_STALL_SEC)}s — đã kill (nghi GPU/driver treo, sẽ thử encoder khác).')
            return (proc.returncode, ''.join(tail)[-1000:])
        from concurrent.futures import ThreadPoolExecutor as _TPE2, as_completed as _ascomp
        _avail_gb, _ram_pct = (999.0, 0.0)
        try:
            import psutil as _ps
            _vm = _ps.virtual_memory()
            _avail_gb = _vm.available / 1073741824
            _ram_pct = _vm.percent
        except Exception:
            pass
        _cpu_par = pick_render_parallelism(len(_batches), _avail_gb, _ram_pct, chunk_dur_min=_vid_dur / max(1, len(_batches)) / 60.0, heavy_filter=True)
        _vram_gb = _detect_vram_gb() if _use_nvenc else 0.0

        def _render_all(mode):
            chunks = {}
            real_err = ''
            done = 0
            par = _stretch_parallelism(mode, _cpu_par, _vram_gb)
            if progress_cb and par < min(3, len(_batches)):
                progress_cb(f'⚙️ Render {par} luồng cho nhẹ máy (RAM còn {_avail_gb:.1f}GB).')
            with _TPE2(max_workers=par) as pool:
                futs = {}
                for _idx, _b in enumerate(_batches):
                    _ck = os.path.join(_tmp_dir, f'chunk_{_idx:04d}.mkv')
                    _sc = os.path.join(_tmp_dir, f'f_{_idx}.txt')
                    futs[pool.submit(_run_batch, _idx, _b, _ck, _sc, mode)] = (_idx, _ck)
                for fut in _ascomp(futs):
                    _idx, _ck = futs[fut]
                    try:
                        rc, err = fut.result()
                    except Exception as _fe:
                        err, rc = (str(_fe), 1)
                    if rc == 0 and os.path.exists(_ck) and (os.path.getsize(_ck) > 0):
                        chunks[_idx] = _ck
                        done += 1
                        if progress_cb:
                            progress_cb(f'✅ Render xong {done}/{len(_batches)} đoạn (song song x{par})')
                    elif not real_err:
                        real_err = err
                return (chunks, real_err)
            return (chunks, real_err)
        _modes = (['nvenc_hw', 'nvenc'] if _use_nvenc else []) + ['cpu']
        _chunks = {}
        _real_err = ''
    else:
        return voice_results
    for _mi, _mode in enumerate(_modes):
        for _c in list(_chunks):
            try:
                os.remove(_c)
            except Exception:
                pass
        _chunks = {}
        if _mi > 0 and progress_cb:
            progress_cb(f'↩️ Chuyển encoder: {_MODE_LABEL[_mode]}')
        elif progress_cb:
            progress_cb(f'🎞 Encoder: {_MODE_LABEL[_mode]}')
        _chunks, _real_err = _render_all(_mode)
        if stop_flag and stop_flag.is_set():
            raise InterruptedError('Stretch bị dừng bởi người dùng.')
        if len(_chunks) == len(_batches):
            break
        if _mi == len(_modes) - 1:
            raise RuntimeError(f'FFmpeg stretch lỗi ({len(_chunks)}/{len(_batches)} batch ok):\n{_real_err}')
    _chunk_files = [_chunks[_i] for _i in sorted(_chunks)]
    if _chunk_files:
        _list = os.path.join(_tmp_dir, 'concat_list.txt')
        with open(_list, 'w', encoding='utf-8') as _lf:
            for _c in _chunk_files:
                _lf.write(f"file '{_c.replace(os.sep, '/')}'\n")
        _concat_cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', _list, '-c:v', 'copy']
        _concat_cmd += ['-c:a', 'aac', '-b:a', '192k'] if _has_orig_audio else ['-an']
        _concat_cmd += ['-movflags', '+faststart', output_path]
        if progress_cb:
            progress_cb(f'🔗 Ghép {len(_chunk_files)} đoạn → video hoàn chỉnh...')
        _cc = subprocess.run(_concat_cmd, capture_output=True, timeout=1800, creationflags=flags)
        if _cc.returncode != 0:
            _ce = _cc.stderr.decode(errors='replace')[-800:] if _cc.stderr else 'unknown'
            raise RuntimeError(f'FFmpeg concat chunks lỗi:\n{_ce}')
        try:
            _shutil.rmtree(_tmp_dir, ignore_errors=True)
        except:
            pass
        try:
            _pr2 = subprocess.run([_ffprobe, '-v', 'quiet', '-print_format', 'json', '-show_format', '-i', output_path], capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            _actual_total = float(_json.loads(_pr2.stdout)['format']['duration'])
            if out_t > 0 and _actual_total > 0:
                _scale = _actual_total / out_t
                if 0.9 < _scale < 1.1:
                    for _r in new_results:
                        _r['start'] = float(_r.get('start', 0)) * _scale
                        _r['end'] = _r['start'] + float(_r.get('duration', 0))
                    if progress_cb and abs(_scale - 1.0) > 0.0001:
                        progress_cb(f'⏱️ Điều chỉnh timing: {_scale:.4f} (thực {_actual_total:.1f}s / dự {out_t:.1f}s)')
        except Exception:
            return new_results
        return new_results
    raise RuntimeError('Stretch không tạo được chunk nào.')

def merge_voice_audio(video_path: str, voice_files: list[dict], keep_original: bool=False, original_volume: float=0.1, voice_volume: float=1.0, bgm_path: str='', bgm_volume: float=0.5, output_path: str | None=None, progress_cb: Callable[[str], None] | None=None, stop_flag: threading.Event | None=None, voice_speed: float=1.0, save_voice_track: str | None=None) -> str:
    if voice_files:
        if output_path is None:
            p = Path(video_path)
            output_path = str(p.parent / (p.stem + '_dubbed' + p.suffix))
        has_bgm = bgm_path and os.path.exists(bgm_path) and (bgm_volume > 0)
        if voice_volume > 0 or has_bgm:
            import tempfile, uuid
            _uid = uuid.uuid4().hex[:8]
            merged_voice_path = os.path.join(tempfile.gettempdir(), f'tdt_merged_{_uid}.mp3')
            _skip_merge_step1 = False
            _full = voice_files[0]['audio_path']
            merged_voice_path = _full
            _skip_merge_step1 = True
            if len(voice_files) == 1 and '_tts_full' in voice_files[0].get('audio_path', '') and os.path.isfile(_full) and (os.path.getsize(_full) > 0) and progress_cb:
                progress_cb('⚡ Dùng file giọng đọc đã gộp sẵn.')
            n = len(voice_files)
            _MAX_INPUTS = 150
            if not _skip_merge_step1 and progress_cb:
                progress_cb(f'🎬 Bước 1/2: Đang gộp {n} đoạn giọng đọc...')
            if _skip_merge_step1:
                try:
                    if save_voice_track and os.path.isfile(merged_voice_path) and (os.path.abspath(merged_voice_path) != os.path.abspath(save_voice_track)):
                        import shutil as _sh
                        _sh.copy2(merged_voice_path, save_voice_track)
                except Exception:
                    pass
                stderr_file2 = os.path.join(tempfile.gettempdir(), f'tdt_stderr2_{_uid}.log')
                try:
                    try:
                        import time as _time
                        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
                        if progress_cb:
                            progress_cb('🎬 Bước 2/2: Đang ghép giọng vào video...')
                        has_bgm = bgm_path and os.path.exists(bgm_path)
                        try:
                            from exporter.exporter_ffmpeg_logic import _probe_source_bitrate
                            _, src_abr = (_probe_source_bitrate(video_path)[1], _probe_source_bitrate(video_path)[2])
                            abr = min(192, max(64, int(src_abr * 1.2))) if src_abr > 0 else 128
                        except Exception:
                            abr = 128
                        mix_cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y', '-i', video_path, '-i', merged_voice_path]
                        mix_filter = []
                        mix_labels = []
                        mix_count = 0
                        if keep_original:
                            from services_media import _has_audio
                            _video_has_audio = _has_audio(video_path)
                            if _video_has_audio:
                                mix_filter.append(f'[0:a]volume={original_volume:.4f}[orig]')
                                mix_labels.append('[orig]')
                                mix_count += 1
                        _voice_af = f'volume={voice_volume:.4f}'
                        _atempo_str = _build_atempo_chain(voice_speed)
                        if _atempo_str:
                            _voice_af += f',{_atempo_str}'
                        _voice_af += '[voices]'
                        mix_filter.append(_voice_af)
                        mix_labels.append('[voices]')
                        mix_count += 1
                        if has_bgm:
                            mix_cmd += ['-i', bgm_path]
                            bgm_idx = 2
                            mix_filter.append(f'[{bgm_idx}:a]volume={bgm_volume:.4f},aloop=loop=-1:size=2e+09[bgm]')
                            mix_labels.append('[bgm]')
                            mix_count += 1
                        if mix_count >= 2:
                            mix_in = ''.join(mix_labels)
                            mix_filter.append(f'{mix_in}amix=inputs={mix_count}:duration=first:dropout_transition=0:normalize=0[aout]')
                            audio_map = '[aout]'
                        else:
                            audio_map = '[voices]'
                        _safe_clip = 'alimiter=limit=0.99:level=false'
                        if audio_map == '[aout]':
                            mix_filter.append(f'[aout]{_safe_clip}[aclean]')
                        else:
                            mix_filter.append(f'[voices]{_safe_clip}[aclean]')
                        audio_map = '[aclean]'
                        mix_cmd += ['-filter_complex', ';'.join(mix_filter), '-map', '0:v', '-map', audio_map, '-map_metadata', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', f'{abr}k', '-shortest', output_path]
                        _sf2 = open(stderr_file2, 'w', encoding='utf-8', errors='replace')
                        proc2 = subprocess.Popen(mix_cmd, stdout=subprocess.DEVNULL, stderr=_sf2, creationflags=flags)
                        try:
                            from exporter.exporter_preview_engine import _assign_to_job
                            _assign_to_job(proc2)
                        except Exception:
                            pass
                        _tick2 = 0
                        _last_sz = -1
                        _last_grow = _time.time()
                        if proc2.poll() is None:
                            if not stop_flag or not stop_flag.is_set():
                                _time.sleep(0.5)
                                _tick2 += 1
                                try:
                                    _cur_sz = os.path.getsize(output_path) if os.path.isfile(output_path) else 0
                                except OSError:
                                    _cur_sz = 0
                                if _cur_sz != _last_sz:
                                    _last_sz = _cur_sz
                                    _last_grow = _time.time()
                                elif _time.time() - _last_grow > _FFMPEG_STALL_SEC:
                                    try:
                                        proc2.kill()
                                        proc2.wait(timeout=3)
                                    except Exception:
                                        pass
                                    _sf2.close()
                                    raise RuntimeError(f'FFmpeg ghép giọng treo (output không tiến triển {int(_FFMPEG_STALL_SEC)}s) — đã dừng.')
                            proc2.terminate()
                            try:
                                proc2.wait(timeout=3)
                            except subprocess.TimeoutExpired:
                                proc2.kill()
                                proc2.wait()
                            _sf2.close()
                            raise InterruptedError('Merge bị dừng bởi người dùng.')
                        _sf2.close()
                        _rc2 = proc2.returncode
                        _stderr_content2 = ''
                        try:
                            with open(stderr_file2, 'r', encoding='utf-8', errors='replace') as _ef2:
                                _stderr_content2 = _ef2.read()
                        except Exception:
                            pass
                        _out_exists = os.path.isfile(output_path)
                        _out_size = os.path.getsize(output_path) if _out_exists else 0
                        if _rc2 != 0:
                            err = ''
                            try:
                                with open(stderr_file2, 'r', encoding='utf-8', errors='replace') as _ef:
                                    err = _ef.read()[-500:]
                            except Exception:
                                pass
                            raise RuntimeError(f'FFmpeg lỗi:\n{err}')
                    except InterruptedError:
                        raise
                    else:
                        if not _skip_merge_step1:
                            try:
                                os.remove(merged_voice_path)
                            except:
                                pass
                        try:
                            os.remove(stderr_file2)
                        except OSError:
                            pass
                        if progress_cb:
                            progress_cb('✅ Đã ghép giọng vào video.')
                        return output_path
                except:
                    if not _skip_merge_step1:
                        try:
                            os.remove(merged_voice_path)
                        except OSError:
                            pass
                try:
                    os.remove(stderr_file2)
                except OSError:
                    pass
            else:
                from longtieng.longtieng_audio_utils import enforce_non_overlapping_voice_segments
                voice_files = enforce_non_overlapping_voice_segments(list(voice_files))
                n = len(voice_files)
                if n <= _MAX_INPUTS:
                    _run_adelay_amix_merge(voice_files, merged_voice_path, _uid)
                else:
                    intermediate_files = []
                    try:
                        for bi in range(0, n, _MAX_INPUTS):
                            batch = voice_files[bi:bi + _MAX_INPUTS]
                            tmp_path = os.path.join(tempfile.gettempdir(), f'tdt_mbatch_{_uid}_{bi}.mp3')
                            if progress_cb:
                                progress_cb(f'🎬 Gộp batch {bi // _MAX_INPUTS + 1}/{(n - 1) // _MAX_INPUTS + 1}...')
                            _run_adelay_amix_merge(batch, tmp_path, f'{_uid}_{bi}')
                            if not os.path.isfile(tmp_path):
                                pass
                            elif os.path.getsize(tmp_path) > 0:
                                intermediate_files.append(tmp_path)
                        if intermediate_files:
                            if len(intermediate_files) == 1:
                                import shutil
                                shutil.move(intermediate_files[0], merged_voice_path)
                                intermediate_files.clear()
                            else:
                                inter_dicts = [{'audio_path': p, 'start': 0} for p in intermediate_files]
                                _run_adelay_amix_merge(inter_dicts, merged_voice_path, f'{_uid}_final')
                            for tmp in intermediate_files:
                                try:
                                    os.remove(tmp)
                                except:
                                    pass
                        else:
                            raise RuntimeError('Tất cả batch gộp voice thất bại')
                    except:
                        for tmp in intermediate_files:
                            try:
                                os.remove(tmp)
                            except OSError:
                                pass
        else:
            if progress_cb:
                progress_cb('ℹ️ Âm lượng giọng đọc = 0, giữ nguyên audio gốc.')
            if output_path and output_path != video_path:
                import shutil
                shutil.copy2(video_path, output_path)
                return output_path
            return video_path
    else:
        return video_path


def build_voice_preview_track(voice_results: list[dict], output_path: str | None=None, *, tts_fit_mode: str, tts_fit_max_speed: float, video_duration_sec: float) -> str | None:
    if voice_results:
        import subprocess, uuid
        valid = [dict(vf) for vf in voice_results if vf.get('audio_path') and os.path.isfile(vf['audio_path'])]
        if valid:
            fit_mode = str(tts_fit_mode or 'stretch_video').strip().lower()
            if fit_mode not in frozenset({'stretch_video', 'speed_up_tts', 'none'}):
                fit_mode = 'stretch_video'
            try:
                try:
                    try:
                        fit_cap = float(tts_fit_max_speed or 1.2)
                    except (TypeError, ValueError):
                        fit_cap = 1.2
                    fit_cap = max(1.0, min(2.5, fit_cap))
                    try:
                        video_dur = float(video_duration_sec or 0)
                    except (TypeError, ValueError):
                        video_dur = 0.0
                    if video_dur < 0:
                        video_dur = 0.0
                    limit_end = video_dur if video_dur > 0 else None
                    preview_copies = []
                    try:
                        from longtieng.longtieng_audio_utils import cascade_voice_segment_starts, enforce_non_overlapping_voice_segments, fit_last_voice_segment_to_limit
                        import shutil
                        import tempfile as _tempfile
                        for vf in valid:
                            src = str(vf['audio_path'])
                            fd, tmp = _tempfile.mkstemp(suffix=os.path.splitext(src)[1] or '.mp3', prefix='vtp_pvfit_')
                            os.close(fd)
                            shutil.copy2(src, tmp)
                            vf['audio_path'] = tmp
                            preview_copies.append(tmp)
                        if fit_mode == 'speed_up_tts':
                            valid = enforce_non_overlapping_voice_segments(valid, max_speed=fit_cap, smooth=True, hard_enforce=True)
                        elif fit_mode == 'stretch_video':
                            valid = enforce_non_overlapping_voice_segments(valid, max_speed=fit_cap, smooth=True, hard_enforce=False)
                            valid = cascade_voice_segment_starts(valid, limit_end_sec=limit_end)
                            if video_dur > 0:
                                valid = fit_last_voice_segment_to_limit(valid, limit_end_sec=video_dur, max_speed=fit_cap)
                            print(f'[VoicePreview] stretch_video: cân 2 phía soft≤√need≤{fit_cap:.2f}x + cascade ({len(valid)} câu) — lock A/V/sub', flush=True)
                        else:
                            valid = cascade_voice_segment_starts(valid, limit_end_sec=limit_end)
                    except Exception as _e_fit:
                        print(f'[VoicePreview] Non-overlap fit skip: {_e_fit}', flush=True)
                        for fp in preview_copies:
                            try:
                                os.remove(fp)
                            except OSError:
                                pass
                    ok = False
                    unique_id = uuid.uuid4().hex[:8]
                    _appdata = os.path.join(os.environ.get('LOCALAPPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Local')), 'TDT', 'tts_preview')
                    os.makedirs(_appdata, exist_ok=True)
                    if output_path is None:
                        output_path = os.path.join(_appdata, f'tdt_preview_{unique_id}.mp3')
                    n = len(valid)
                    _tmpfiles = []

                    def _convert_single_segment(src: str, out: str, timeout: int=60) -> bool:
                        if src and os.path.isfile(src):
                            try:
                                if not src.lower().endswith('.mp3') or os.path.getsize(src) <= 200 or os.path.abspath(src) != os.path.abspath(out):
                                    cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y', '-i', src, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '1', out]
                                    try:
                                        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
                                        proc = subprocess.run(cmd, capture_output=True, timeout=timeout, creationflags=flags)
                                        if os.path.isfile(out) and os.path.getsize(out) > 0:
                                            return True
                                        err = (proc.stderr or b'').decode('utf-8', errors='replace')[-300:]
                                        print(f'[VoicePreview] convert-single rc={proc.returncode}: {err}', flush=True)
                                    except FileNotFoundError:
                                        print(f'[VoicePreview] Không thấy ffmpeg: {_cfg.FFMPEG_PATH} (máy anh em chạy lại CAI_DAT.bat)', flush=True)
                                        return False
                                    except Exception as exc:
                                        print(f'[VoicePreview] convert-single exception: {exc}', flush=True)
                                        return False
                                    return False
                            except OSError:
                                pass
                            return True
                        return False
                    last_merge_error = ''
                    if os.path.isfile(str(_cfg.FFMPEG_PATH)):
                        normalized = []
                        for idx, vf in enumerate(valid):
                            src = str(vf.get('audio_path') or '')
                            norm = os.path.join(_appdata, f'tdt_norm_{unique_id}_{idx:04d}.mp3')
                            _tmpfiles.append(norm)
                            if _convert_single_segment(src, norm):
                                item = dict(vf)
                                item['audio_path'] = norm
                                item['start'] = max(0.0, float(vf.get('start', 0) or 0))
                                normalized.append(item)
                            else:
                                print(f'[VoicePreview] Bỏ segment #{idx} (convert fail): {src}', flush=True)
                        if not normalized:
                            print('[VoicePreview] Không convert được segment nào', flush=True)
                            for fp in _tmpfiles:
                                try:
                                    os.remove(fp)
                                except OSError:
                                    pass
                            return None
                        elif len(normalized) == 1:
                            import shutil
                            shutil.copy2(normalized[0]['audio_path'], output_path)
                            ok = os.path.isfile(output_path) and os.path.getsize(output_path) > 0
                        else:
                            ok = False
                            _MAX_IN = 80
                            if len(normalized) <= _MAX_IN:
                                _run_adelay_amix_merge(normalized, output_path, unique_id)
                                ok = os.path.isfile(output_path) and os.path.getsize(output_path) > 0
                            else:
                                intermediates = []
                                for bi in range(0, len(normalized), _MAX_IN):
                                    chunk = normalized[bi:bi + _MAX_IN]
                                    tmp_out = os.path.join(_appdata, f'tdt_pvbatch_{unique_id}_{bi}.mp3')
                                    _tmpfiles.append(tmp_out)
                                    _run_adelay_amix_merge(chunk, tmp_out, f'{unique_id}_{bi}')
                                    if not os.path.isfile(tmp_out):
                                        pass
                                    elif os.path.getsize(tmp_out) > 0:
                                        intermediates.append(tmp_out)
                                if not intermediates:
                                    raise RuntimeError('Tất cả batch gộp voice thất bại')
                                if len(intermediates) == 1:
                                    import shutil
                                    shutil.copy2(intermediates[0], output_path)
                                    ok = True
                                else:
                                    inter_dicts = [{'audio_path': p, 'start': 0.0} for p in intermediates]
                                    _run_adelay_amix_merge(inter_dicts, output_path, f'{unique_id}_final')
                                    ok = os.path.isfile(output_path) and os.path.getsize(output_path) > 0
                    else:
                        print(f'[VoicePreview] Thiếu ffmpeg.exe tại {_cfg.FFMPEG_PATH}. Chạy CAI_DAT.bat trên máy này.', flush=True)
                except Exception as merge_exc:
                    last_merge_error = str(merge_exc)
                    print(f'[VoicePreview] adelay-amix fail: {merge_exc}', flush=True)
                    ok = False
                    if not ok and len(normalized) > 1:
                        try:
                            small = []
                            for bi in range(0, len(normalized), 20):
                                chunk = normalized[bi:bi + 20]
                                tmp_out = os.path.join(_appdata, f'tdt_pv20_{unique_id}_{bi}.mp3')
                                _tmpfiles.append(tmp_out)
                                _run_adelay_amix_merge(chunk, tmp_out, f'{unique_id}_s{bi}')
                                if not os.path.isfile(tmp_out):
                                    pass
                                elif os.path.getsize(tmp_out) > 0:
                                    small.append(tmp_out)
                            if small:
                                if len(small) == 1:
                                    import shutil
                                    shutil.copy2(small[0], output_path)
                        except Exception as exc2:
                            last_merge_error = str(exc2)
                            print(f'[VoicePreview] fallback-20 fail: {exc2}', flush=True)
                            exc2 = None
                except Exception as e:
                    try:
                        print(f'[VoicePreview] Error: {e}', flush=True)
                    except Exception:
                        pass
            finally:
                for fp in _tmpfiles:
                    try:
                        os.remove(fp)
                    except OSError:
                        pass
                for fp in preview_copies:
                    try:
                        os.remove(fp)
                    except OSError:
                        pass
        else:
            print('[VoicePreview] Không có audio file nào tồn tại!', flush=True)
            return None
    else:
        return None

    if ok and os.path.isfile(output_path) and (os.path.getsize(output_path) > 0):
        try:
            from core.av_sync import save_tts_cues_sidecar
            save_tts_cues_sidecar(output_path, normalized if normalized else valid, fit_mode=fit_mode)
        except Exception as _e_side:
            print(f'[VoicePreview] Sidecar cues skip: {_e_side}', flush=True)
        if video_dur > 0:
            try:
                from longtieng.longtieng_audio_utils import VOICE_OVERFLOW_WARN_SEC, format_voice_overflow_warning, save_tts_overflow_sidecar, voice_track_overflow_sec
                overflow_rows = normalized if normalized else valid
                overflow_sec = voice_track_overflow_sec(overflow_rows, limit_end_sec=video_dur)
                save_tts_overflow_sidecar(output_path, overflow_sec, video_dur)
                if overflow_sec > VOICE_OVERFLOW_WARN_SEC:
                    print(format_voice_overflow_warning(overflow_sec), flush=True)
                else:
                    print(f'[VoicePreview] Overflow nhẹ: {overflow_sec:.3f}s (video={video_dur:.3f}s)', flush=True)
            except Exception as _e_ov:
                print(f'[VoicePreview] Overflow sidecar skip: {_e_ov}', flush=True)
        try:
            print(f'[VoicePreview] Done Audio Preview ({len(normalized)} segments)!', flush=True)
        except Exception:
            pass
        return output_path
    else:
        try:
            print(f'[VoicePreview] FFmpeg failed — {n} segments' + (f' | {last_merge_error}' if last_merge_error else ''), flush=True)
        except Exception:
            pass
    return None