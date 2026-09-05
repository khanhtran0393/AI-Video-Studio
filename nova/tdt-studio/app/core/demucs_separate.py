'Tách stem audio (Demucs htdemucs) — dùng cho Qt UI và exporter, không import tkinter.'
from __future__ import annotations
import os
import re
import subprocess
import sys
import threading
import time
import uuid
from config import _find_tool
try:
    from core.ml_runtime import demucs_busy_scope
except Exception:
    from contextlib import contextmanager

    @contextmanager
    def demucs_busy_scope():
        yield None
_DEMUCS_RUN_LOCK = threading.Lock()
_VOCALSEP_PCT = re.compile('\\[VocalSep\\]\\s+(\\d{1,3})%\\s+(.*)\\s*$')
_MODEL_CACHE: 'dict[str, object]' = {}
_MODEL_CACHE_LOCK = threading.Lock()

def _safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        try:
            enc = getattr(sys.stdout, 'encoding', None) or 'utf-8'
            raw = (text + '\n').encode(enc, errors='replace')
            buf = getattr(sys.stdout, 'buffer', None)
            if buf is not None:
                buf.write(raw)
                buf.flush()
                return None
            print(text.encode(enc, errors='replace').decode(enc, errors='replace'), flush=True)
        except Exception:
            pass
        return None

def _use_demucs_subprocess() -> bool:
    return False if os.environ.get('VTP_DEMUCS_CHILD', '').strip() == '1' else False if os.environ.get('VTP_DEMUCS_INLINE', '').strip() == '1' else True

def _get_htdemucs_model():
    from demucs.pretrained import get_model
    from core.demucs_local_repo import htdemucs_repo_dir, htdemucs_repo_ready
    with _MODEL_CACHE_LOCK:
        model = _MODEL_CACHE.get('htdemucs')
        if model is None:
            model = get_model('htdemucs', repo=htdemucs_repo_dir()) if htdemucs_repo_ready() else get_model('htdemucs')
            _MODEL_CACHE['htdemucs'] = model
        return model

def demucs_popen_cmd(cli_args, *, frozen) -> list[str]:
    if frozen is None:
        frozen = bool(getattr(sys, 'frozen', False))
    args = list(cli_args or [])
    return [sys.executable, '--run-demucs', *args] if frozen else [sys.executable, '-m', 'core.demucs_cli', *args]

def _spawn_demucs_cli(cli_args: list[str], *, status_cb, stop_event: threading.Event | None) -> tuple[bool, str]:
    with demucs_busy_scope(), _DEMUCS_RUN_LOCK:
        env = os.environ.copy()
        env['VTP_DEMUCS_CHILD'] = '1'
        env.setdefault('OMP_NUM_THREADS', '1')
        env.setdefault('MKL_NUM_THREADS', '1')
        env.setdefault('OPENBLAS_NUM_THREADS', '1')
        env.setdefault('NUMEXPR_NUM_THREADS', '1')
        safe_args = [str(a) for a in cli_args or ()]
    cmd = demucs_popen_cmd(safe_args)
    creation = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', env=env, creationflags=creation, bufsize=1)
    except OSError as exc:
        return (False, friendly_demucs_error(str(exc)))
    try:
        from core.cpu_budget import limit_process_cpu
        how = limit_process_cpu(proc)
        if status_cb is not None and how not in frozenset({'skip', 'full', 'none'}):
            status_cb(f'Giới hạn CPU Demucs ({how})', 8)
    except Exception:
        pass
    last_err = ''
    assert proc.stdout is not None
    try:
        while stop_event is None or not stop_event.is_set():
            line = proc.stdout.readline()
            if line:
                text = line.rstrip('\n\r')
                if text:
                    _safe_print(text)
                if 'ERROR:' in text:
                    last_err = text.split('ERROR:', 1)[-1].strip()
                match = _VOCALSEP_PCT.search(text)
                if match and status_cb is not None:
                    try:
                        pct = int(match.group(1))
                    except ValueError:
                        pct = None
                    msg = match.group(2).strip()
                    try:
                        status_cb(msg, pct)
                    except Exception:
                        pass
            else:
                if proc.poll() is not None:
                    break
                time.sleep(0.05)
        if stop_event is not None and stop_event.is_set():
            try:
                proc.kill()
            except OSError:
                pass
            return (False, 'Đã dừng tách audio')
    except Exception as exc:
        try:
            proc.kill()
        except OSError:
            pass
        return (False, friendly_demucs_error(str(exc)))
    code = proc.wait(timeout=30)
    if code == 0:
        return (True, '')
    return (False, friendly_demucs_error(last_err or f'Demucs exit {code}'))

def stems_to_remove(remove_vocal: bool, remove_bgm: bool) -> list[str]:
    stems = []
    if remove_vocal:
        stems.append('vocals')
    if remove_bgm:
        stems.extend(['drums', 'bass', 'other'])
    return stems

def _stem_cache_key(input_file: str) -> str:
    import hashlib
    raw = str(input_file or '').strip()
    try:
        key = os.path.normcase(os.path.abspath(raw))
    except OSError:
        key = raw
    return hashlib.md5(key.encode('utf-8', 'ignore')).hexdigest()[:12]

def _stem_cache_dir() -> str:
    import tempfile
    base = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or ''
    d = os.path.join(base, 'VideoToolsPro', 'stem_cache') if base else os.path.join(tempfile.gettempdir(), 'vtp_vocal_sep')
    os.makedirs(d, exist_ok=True)
    return d

def _legacy_temp_stem_path(filename: str) -> str:
    import tempfile
    return os.path.join(tempfile.gettempdir(), 'vtp_vocal_sep', filename)

def _promote_legacy_stem_cache(dest_path: str) -> None:
    if os.path.isfile(dest_path):
        pass
    else:
        legacy = _legacy_temp_stem_path(os.path.basename(dest_path))
        if os.path.isfile(legacy):
            try:
                import shutil
                shutil.copy2(legacy, dest_path)
            except OSError:
                pass

def video_vocal_stem_cache_path(input_file: str) -> str:
    h = _stem_cache_key(input_file)
    path = os.path.join(_stem_cache_dir(), f'{h}_vocals.wav')
    _promote_legacy_stem_cache(path)
    return path

def video_instrumental_stem_cache_path(input_file: str) -> str:
    h = _stem_cache_key(input_file)
    path = os.path.join(_stem_cache_dir(), f'{h}_instrumental.wav')
    _promote_legacy_stem_cache(path)
    return path

def vocal_sep_combo_cache_path(input_file: str, stems: list[str]) -> str:
    h = _stem_cache_key(input_file)
    d = _stem_cache_dir()
    sorted_stems = sorted(stems)
    if sorted_stems == ['vocals']:
        return os.path.join(d, f'{h}_instrumental.wav')
    key = '_'.join(sorted_stems) if sorted_stems else 'none'
    return os.path.join(d, f'{h}_rm_{key}.wav')

def friendly_demucs_error(err: str, *, frozen: bool | None) -> str:
    if frozen is None:
        frozen = bool(getattr(sys, 'frozen', False))
    low = (err or '').lower()
    return ('Bản cài này chưa bật tách nhạc/giọng AI. Video xuất bằng tiếng gốc.' if frozen else 'Chưa cài PyTorch/Demucs. Chạy file install_demucs.ps1 trong thư mục tool hoặc: python -m pip install torch demucs soundfile') if "no module named 'torch" in low or "no module named 'demucs" in low else 'Đường dẫn / lệnh quá dài (WinError 206). Thường do tên video rất dài + nhiều clip chuyển cảnh. Tool đã rút gọn path cache; sync bản mới rồi xuất lại. Tạm thời: đổi tên file video ngắn hơn nếu vẫn lỗi.' if 'winerror 206' in low or 'filename or extension is too long' in low else err

def demucs_missing_box(*, frozen: bool | None) -> tuple[str, str]:
    if frozen is None:
        frozen = bool(getattr(sys, 'frozen', False))
    return ('Chưa bật tách nhạc/giọng AI', 'Chưa bật tách nhạc/giọng AI') if frozen else ('Chưa cài PyTorch/Demucs', 'Cần cài PyTorch + Demucs để tách tiếng clip')

def _looks_like_path_arg(value: str) -> bool:
    text = str(value or '')
    return False if not text or text.startswith('-') else False if text in frozenset({'dual', 'single'}) else True if os.path.sep in text or (os.altsep and os.altsep in text) else bool(os.path.splitext(text)[1])

def _short_cli_path(path: str) -> str:
    raw = str(path or '').strip()
    if not raw or not os.path.isfile(raw):
        return raw
    if len(os.path.abspath(raw)) < 200:
        return raw
    import hashlib
    import tempfile
    ext = os.path.splitext(raw)[1] or '.mp4'
    digest = hashlib.md5(os.path.abspath(raw).encode('utf-8', 'ignore')).hexdigest()[:16]
    dest = os.path.join(tempfile.gettempdir(), 'vtp_short', f'{digest}{ext}')
    try:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.isfile(dest) or os.path.getsize(dest) != os.path.getsize(raw):
            try:
                if os.path.exists(dest):
                    os.unlink(dest)
            except OSError:
                pass
            try:
                os.link(raw, dest)
            except OSError:
                import shutil
                shutil.copy2(raw, dest)
                return dest
            return dest
    except OSError:
        return raw

def check_demucs_deps(*, frozen: bool | None) -> tuple[bool, str]:
    if frozen is None:
        frozen = bool(getattr(sys, 'frozen', False))
    if frozen:
        from core.demucs_local_repo import htdemucs_repo_ready
        return (True, '') if htdemucs_repo_ready() else (False, friendly_demucs_error("No module named 'demucs'", frozen=True))
    try:
        import demucs
        import torch
    except ModuleNotFoundError as exc:
        return (False, friendly_demucs_error(str(exc), frozen=False))
    return (True, '')

def demucs_combo_separate(input_file: str, output_path: str, remove_stems: list[str], status_cb=None) -> tuple[bool, str]:
    return run_demucs(input_file, output_path, status_cb=status_cb, remove_stems=list(remove_stems))

def _overlap_add_separate(total_frames: int, separate_fn, write_fn, seg_n: int, overlap: float=0.25) -> None:
    import numpy as _np
    stride_n = max(1, int((1.0 - overlap) * seg_n))
    w = _np.concatenate([_np.arange(1, seg_n // 2 + 1, dtype=_np.float32), _np.arange(seg_n - seg_n // 2, 0, -1, dtype=_np.float32)])
    w /= w.max()
    acc = _np.zeros((2, 0), dtype=_np.float32)
    accw = _np.zeros((0,), dtype=_np.float32)
    win_start = 0
    flush_pos = 0
    for offset in range(0, total_frames, stride_n):
        blk = min(seg_n, total_frames - offset)
        if blk <= 0:
            break
        mixed = separate_fn(offset, blk)
        n = mixed.shape[1]
        wn = w[:n]
        mixed = mixed * wn
        need = offset + n - win_start
        if need > acc.shape[1]:
            pad = need - acc.shape[1]
            acc = _np.pad(acc, ((0, 0), (0, pad)))
            accw = _np.pad(accw, (0, pad))
        a = offset - win_start
        acc[:, a:a + n] += mixed
        accw[a:a + n] += wn
        if offset > flush_pos:
            f1, f0 = (offset - win_start, flush_pos - win_start)
            write_fn((acc[:, f0:f1] / _np.maximum(accw[f0:f1], 1e-08)).T)
            flush_pos = offset
        cut = flush_pos - win_start
        if cut > 0:
            acc = acc[:, cut:]
            accw = accw[cut:]
            win_start = flush_pos
    if total_frames > flush_pos:
        f1, f0 = (total_frames - win_start, flush_pos - win_start)
        write_fn((acc[:, f0:f1] / _np.maximum(accw[f0:f1], 1e-08)).T)
        return None

def _overlap_add_dual(total_frames: int, separate_fn, write_vocal, write_inst, seg_n: int, overlap: float=0.25) -> None:
    import numpy as _np
    stride_n = max(1, int((1.0 - overlap) * seg_n))
    w = _np.concatenate([_np.arange(1, seg_n // 2 + 1, dtype=_np.float32), _np.arange(seg_n - seg_n // 2, 0, -1, dtype=_np.float32)])
    w /= w.max()
    acc_v = _np.zeros((2, 0), dtype=_np.float32)
    acc_i = _np.zeros((2, 0), dtype=_np.float32)
    accw = _np.zeros((0,), dtype=_np.float32)
    win_start = 0
    flush_pos = 0
    for offset in range(0, total_frames, stride_n):
        blk = min(seg_n, total_frames - offset)
        if blk <= 0:
            break
        mixed_v, mixed_i = separate_fn(offset, blk)
        n = mixed_v.shape[1]
        wn = w[:n]
        mixed_v = mixed_v * wn
        mixed_i = mixed_i * wn
        need = offset + n - win_start
        if need > acc_v.shape[1]:
            pad = need - acc_v.shape[1]
            acc_v = _np.pad(acc_v, ((0, 0), (0, pad)))
            acc_i = _np.pad(acc_i, ((0, 0), (0, pad)))
            accw = _np.pad(accw, (0, pad))
        a = offset - win_start
        acc_v[:, a:a + n] += mixed_v
        acc_i[:, a:a + n] += mixed_i
        accw[a:a + n] += wn
        if offset > flush_pos:
            f1, f0 = (offset - win_start, flush_pos - win_start)
            div = _np.maximum(accw[f0:f1], 1e-08)
            write_vocal((acc_v[:, f0:f1] / div).T)
            write_inst((acc_i[:, f0:f1] / div).T)
            flush_pos = offset
        cut = flush_pos - win_start
        if cut > 0:
            acc_v = acc_v[:, cut:]
            acc_i = acc_i[:, cut:]
            accw = accw[cut:]
            win_start = flush_pos
    if total_frames > flush_pos:
        f1, f0 = (total_frames - win_start, flush_pos - win_start)
        div = _np.maximum(accw[f0:f1], 1e-08)
        write_vocal((acc_v[:, f0:f1] / div).T)
        write_inst((acc_i[:, f0:f1] / div).T)
        return None

def run_demucs_dual_stems(input_file: str, vocal_output_path: str, instrumental_output_path: str, status_cb=None, stop_event: threading.Event | None=None) -> tuple[bool, str]:
    if _use_demucs_subprocess():
        return _spawn_demucs_cli(['dual', str(input_file), str(vocal_output_path), str(instrumental_output_path)], status_cb=status_cb, stop_event=stop_event)
    with demucs_busy_scope(), _DEMUCS_RUN_LOCK:
        return _run_demucs_dual_stems_inline(input_file, vocal_output_path, instrumental_output_path, status_cb=status_cb, stop_event=stop_event)

def _run_demucs_dual_stems_inline(input_file: str, vocal_output_path: str, instrumental_output_path: str, status_cb=None, stop_event: threading.Event | None=None) -> tuple[bool, str]:

    def _stopped() -> bool:
        return stop_event is not None and stop_event.is_set()

    def _log(msg: str, pct: int | None=None) -> None:
        tag = f'3d%' if pct is not None else '   '
        _safe_print(f'[VocalSep] {tag} {msg}')
        if status_cb:
            status_cb(msg, pct)
            return None
    tmp_audio = vocal_output_path + '.raw.wav'
    _part_v = vocal_output_path + f'.part.{uuid.uuid4().hex[:8]}.wav'
    _part_i = instrumental_output_path + f'.part.{uuid.uuid4().hex[:8]}.wav'
    try:
        if not _stopped():
            _log('Đang tải thư viện...', 0)
            try:
                import torch
                from demucs.apply import apply_model
            except ModuleNotFoundError as imp_err:
                imp_err = None
                try:
                    if os.path.exists(tmp_audio):
                        os.unlink(tmp_audio)
                except Exception:
                    pass
                try:
                    if os.path.exists(_part_v):
                        os.unlink(_part_v)
                except Exception:
                    pass
                try:
                    if os.path.exists(_part_i):
                        os.unlink(_part_i)
                except Exception:
                    pass
                try:
                    import gc as _gc
                    import torch as _t
                    _gc.collect()
                    if _t.cuda.is_available():
                        _t.cuda.empty_cache()
                    else:
                        return (False, friendly_demucs_error(str(imp_err)))
                except Exception:
                    return (False, friendly_demucs_error(str(imp_err)))
                return (False, friendly_demucs_error(str(imp_err)))
            from core.demucs_config import demucs_torch_thread_count, get_demucs_cpu_thread_percent
            _log('Trích xuất audio từ video...', 5)
            ffmpeg = _find_tool('ffmpeg') or 'ffmpeg'
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
            media_in = _short_cli_path(input_file)
            ret = subprocess.run([ffmpeg, '-y', '-i', media_in, '-vn', '-ar', '44100', '-ac', '2', '-f', 'wav', tmp_audio], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ret.returncode == 0 and os.path.exists(tmp_audio):
                device = 'cpu'
                import torch
                if torch.cuda.is_available():
                    try:
                        _vram_mb = torch.cuda.get_device_properties(0).total_memory // 1048576
                        _cc_major = torch.cuda.get_device_properties(0).major
                        _gpu_name = torch.cuda.get_device_name(0)
                        if _vram_mb >= 6000 or (_vram_mb >= 3000 and _cc_major >= 7):
                            try:
                                _test_in = torch.zeros(1, 2, 1000, device='cuda')
                                _ = torch.fft.rfft(_test_in)
                                del _test_in
                                device = 'cuda'
                                _log('✅ GPU OK — dùng CUDA', 12)
                            except Exception as _test_err:
                                _log(f'⚠️ GPU test fail ({_test_err}), dùng CPU', 12)
                                torch.cuda.empty_cache()
                        else:
                            _log(f'GPU {_gpu_name}: VRAM/CC hạn chế → CPU', 12)
                    except Exception:
                        pass
                _log(f'Tải model htdemucs ({device.upper()})...', 15)
                model = _get_htdemucs_model()
                model.eval()
                model.to(device)
                import numpy as _np
                import soundfile as sf
                _info = sf.info(tmp_audio)
                _total_frames = int(_info.frames)
                _audio_sec = _total_frames / float(_info.samplerate) if _info.samplerate else 0.0
                SEG_SEC = 60.0
                seg_n = int(SEG_SEC * model.samplerate)
                if status_cb:
                    status_cb(f'Audio {_audio_sec:.0f}s — tách giọng + nhạc (1 lượt AI)...', 30)
                vocal_idx = model.sources.index('vocals')
                inst_indices = [i for i in range(len(model.sources)) if i != vocal_idx]
                _old_threads = torch.get_num_threads()
                _limit_threads = demucs_torch_thread_count()
                _pct = get_demucs_cpu_thread_percent()
                try:
                    from core.cpu_budget import limit_current_process_cpu
                    _how = limit_current_process_cpu(_pct)
                except Exception:
                    _how = 'none'
                if device == 'cpu':
                    torch.set_num_threads(_limit_threads)
                    _log(f'Giới hạn CPU mặc định: {_pct}% máy → {_limit_threads} luồng PyTorch' + (f' · hard-cap {_how}' if _how not in frozenset({'skip', 'none'}) else ''), 35)
                _apply_start = time.time()
                _apply_done = threading.Event()
                _frames_done = [0]

                def _progress_ticker() -> None:
                    if not _apply_done.wait(timeout=3.0):
                        while True:
                            elapsed = int(time.time() - _apply_start)
                            frac = min(1.0, _frames_done[0] / max(1, _total_frames))
                            pct = min(35 + int(frac * 62), 97)
                            mins = elapsed // 60
                            secs = elapsed % 60
                            t_str = f':{secs}02d' if mins else f'{secs}s'
                            _log(f'AI đang tách... {int(frac * 100)}% ({t_str}) - vui lòng chờ', pct)
                            if _apply_done.wait(timeout=3.0):
                                return None
                _ticker = threading.Thread(target=_progress_ticker, daemon=True)
                _ticker.start()
                try:
                    with sf.SoundFile(tmp_audio) as _fin, sf.SoundFile(_part_v, mode='w', samplerate=model.samplerate, channels=2) as _fv, sf.SoundFile(_part_i, mode='w', samplerate=model.samplerate, channels=2) as _fi:

                        def _separate_block(offset, blk):
                            if _stopped():
                                raise RuntimeError('Đã dừng tách audio')
                            _fin.seek(offset)
                            _b = _fin.read(blk, dtype='float32', always_2d=True)
                            _frames_done[0] = min(_total_frames, offset + _b.shape[0])
                            wav_c = torch.from_numpy(_np.ascontiguousarray(_b.T))
                            if wav_c.shape[0] == 1:
                                wav_c = wav_c.repeat(2, 1)
                            elif wav_c.shape[0] > 2:
                                wav_c = wav_c[:2]
                            wav_c = wav_c.to(device)
                            with torch.no_grad():
                                src = apply_model(model, wav_c.unsqueeze(0), device=device, progress=False, shifts=0)[0]
                            vocal = src[vocal_idx].detach().cpu().numpy().astype(_np.float32, copy=False)
                            inst = src[inst_indices[0]].detach().cpu().numpy().astype(_np.float32, copy=False)
                            for idx in inst_indices[1:]:
                                inst = inst + src[idx].detach().cpu().numpy().astype(_np.float32, copy=False)
                            return (vocal, inst)

                        def _write_v(chunk):
                            _fv.write(chunk)

                        def _write_i(chunk):
                            _fi.write(chunk)
                        _overlap_add_dual(_total_frames, _separate_block, _write_v, _write_i, seg_n)
                    os.replace(_part_v, vocal_output_path)
                    os.replace(_part_i, instrumental_output_path)
                except:
                    _apply_done.set()
                    if device == 'cpu':
                        torch.set_num_threads(_old_threads)
                    raise
                _apply_done.set()
                if device == 'cpu':
                    torch.set_num_threads(_old_threads)
                try:
                    os.unlink(tmp_audio)
                except Exception:
                    pass
                _log('Tách giọng + nhạc hoàn tất (1 lượt)!', 100)
                try:
                    if os.path.exists(tmp_audio):
                        os.unlink(tmp_audio)
                except:
                    pass
                try:
                    if os.path.exists(_part_v):
                        os.unlink(_part_v)
                except Exception:
                    pass
                try:
                    if os.path.exists(_part_i):
                        os.unlink(_part_i)
                except Exception:
                    pass
                try:
                    import gc as _gc
                    import torch as _t
                    _gc.collect()
                    if _t.cuda.is_available():
                        _t.cuda.empty_cache()
                    else:
                        return (True, '')
                except Exception:
                    return (True, '')
                return (True, '')
            try:
                if os.path.exists(tmp_audio):
                    os.unlink(tmp_audio)
            except Exception:
                pass
            try:
                if os.path.exists(_part_v):
                    os.unlink(_part_v)
            except Exception:
                pass
            try:
                if os.path.exists(_part_i):
                    os.unlink(_part_i)
            except Exception:
                pass
            try:
                import gc as _gc
                import torch as _t
                _gc.collect()
                if _t.cuda.is_available():
                    _t.cuda.empty_cache()
                else:
                    return (False, 'Không trích xuất được audio từ video')
            except Exception:
                return (False, 'Không trích xuất được audio từ video')
            return (False, 'Không trích xuất được audio từ video')
    except Exception as e:
        err = str(e)
        _safe_print(f'[VocalSep] ERROR: {err}')
        e = None
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
        try:
            if os.path.exists(_part_v):
                os.unlink(_part_v)
        except Exception:
            pass
        try:
            if os.path.exists(_part_i):
                os.unlink(_part_i)
        except Exception:
            pass
        try:
            import gc as _gc
            import torch as _t
            _gc.collect()
            if _t.cuda.is_available():
                _t.cuda.empty_cache()
            else:
                return (False, friendly_demucs_error(err))
        except Exception:
            return (False, friendly_demucs_error(err))
        return (False, friendly_demucs_error(err))
    except:
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
    else:
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
        try:
            if os.path.exists(_part_v):
                os.unlink(_part_v)
        except Exception:
            pass
        try:
            if os.path.exists(_part_i):
                os.unlink(_part_i)
        except Exception:
            pass
        try:
            import gc as _gc
            import torch as _t
            _gc.collect()
            if _t.cuda.is_available():
                _t.cuda.empty_cache()
            else:
                return (False, 'Đã dừng tách audio')
        except Exception:
            return (False, 'Đã dừng tách audio')
        return (False, 'Đã dừng tách audio')
    try:
        if os.path.exists(_part_v):
            os.unlink(_part_v)
    except Exception:
        pass
    try:
        if os.path.exists(_part_i):
            os.unlink(_part_i)
    except Exception:
        pass
    try:
        import gc as _gc
        import torch as _t
        _gc.collect()
        if _t.cuda.is_available():
            _t.cuda.empty_cache()
        else:
            raise
    except Exception:
        pass
    raise
    raise
    raise

def run_demucs(input_file: str, output_path: str, status_cb=None, extract_vocals: bool=False, remove_stems: list[str] | None=None, stop_event: threading.Event | None=None) -> tuple[bool, str]:
    if _use_demucs_subprocess():
        args = ['single', str(input_file), str(output_path)]
        if extract_vocals:
            args.append('--vocals')
        if remove_stems:
            args.append('--remove=' + ','.join(remove_stems))
        return _spawn_demucs_cli(args, status_cb=status_cb, stop_event=stop_event)
    with demucs_busy_scope(), _DEMUCS_RUN_LOCK:
        return _run_demucs_inline(input_file, output_path, status_cb=status_cb, extract_vocals=extract_vocals, remove_stems=remove_stems, stop_event=stop_event)

def _run_demucs_inline(input_file: str, output_path: str, status_cb=None, extract_vocals: bool=False, remove_stems: list[str] | None=None, stop_event: threading.Event | None=None) -> tuple[bool, str]:

    def _stopped() -> bool:
        return stop_event is not None and stop_event.is_set()

    def _log(msg: str, pct: int | None=None) -> None:
        tag = f'3d%' if pct is not None else '   '
        _safe_print(f'[VocalSep] {tag} {msg}')
        if status_cb:
            status_cb(msg, pct)
            return None
    tmp_audio = output_path + '.raw.wav'
    _part_out = output_path + f'.part.{uuid.uuid4().hex[:8]}.wav'
    try:
        if not _stopped():
            _log('Đang tải thư viện...', 0)
            try:
                import torch
                from demucs.apply import apply_model
            except ModuleNotFoundError as imp_err:
                imp_err = None
                try:
                    if os.path.exists(tmp_audio):
                        os.unlink(tmp_audio)
                except Exception:
                    pass
                try:
                    if os.path.exists(_part_out):
                        os.unlink(_part_out)
                except Exception:
                    pass
                try:
                    import gc as _gc
                    import torch as _t
                    _gc.collect()
                    if _t.cuda.is_available():
                        _t.cuda.empty_cache()
                    else:
                        return (False, friendly_demucs_error(str(imp_err)))
                except Exception:
                    return (False, friendly_demucs_error(str(imp_err)))
                return (False, friendly_demucs_error(str(imp_err)))
            _log('Trích xuất audio từ video...', 5)
            ffmpeg = _find_tool('ffmpeg') or 'ffmpeg'
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
            media_in = _short_cli_path(input_file)
            ret = subprocess.run([ffmpeg, '-y', '-i', media_in, '-vn', '-ar', '44100', '-ac', '2', '-f', 'wav', tmp_audio], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ret.returncode == 0 and os.path.exists(tmp_audio):
                device = 'cpu'
                if torch.cuda.is_available():
                    try:
                        _vram_mb = torch.cuda.get_device_properties(0).total_memory // 1048576
                        _cc_major = torch.cuda.get_device_properties(0).major
                        _gpu_name = torch.cuda.get_device_name(0)
                        if _vram_mb >= 6000 or (_vram_mb >= 3000 and _cc_major >= 7):
                            _log(f'GPU: {_gpu_name} ({_vram_mb}MB, CC {_cc_major}.x), kiểm tra...', 12)
                            try:
                                _test_in = torch.zeros(1, 2, 1000, device='cuda')
                                _ = torch.fft.rfft(_test_in)
                                del _test_in
                                device = 'cuda'
                                _log('✅ GPU OK — dùng CUDA', 12)
                            except Exception as _test_err:
                                _log(f'⚠️ GPU test fail ({_test_err}), dùng CPU', 12)
                                torch.cuda.empty_cache()
                        else:
                            _reason = f'VRAM {_vram_mb}MB' if _vram_mb < 3000 else f'CC {_cc_major}.x quá cũ'
                            _log(f'GPU {_gpu_name} ({_vram_mb}MB, CC {_cc_major}.x): {_reason} → dùng CPU', 12)
                    except Exception:
                        pass
                try:
                    import gc as _gc0
                    _gc0.collect()
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass
                _log(f'Tải model htdemucs ({device.upper()})...', 15)
                try:
                    model = _get_htdemucs_model()
                except Exception as dl_err:
                    _err_type = type(dl_err).__name__
                    _err_msg = str(dl_err)[:200]
                    _hint = ''
                    if 'SSL' in _err_msg or 'certificate' in _err_msg.lower():
                        _hint = ' | Lỗi SSL — kiểm tra ngày giờ máy + tường lửa'
                    elif 'Connection' in _err_msg or 'timeout' in _err_msg.lower() or 'timed out' in _err_msg.lower():
                        _hint = ' | Mất kết nối tới dl.fbaipublicfiles.com — thử VPN'
                    elif 'Permission' in _err_msg or 'Errno 13' in _err_msg:
                        _hint = ' | Không có quyền ghi cache — chạy as Administrator'
                    dl_err = None
                    try:
                        if os.path.exists(tmp_audio):
                            os.unlink(tmp_audio)
                    except Exception:
                        pass
                    try:
                        if os.path.exists(_part_out):
                            os.unlink(_part_out)
                    except Exception:
                        pass
                    try:
                        import gc as _gc
                        import torch as _t
                        _gc.collect()
                        if _t.cuda.is_available():
                            _t.cuda.empty_cache()
                        else:
                            return (False, f'Tải model thất bại ({_err_type}): {_err_msg}{_hint}')
                    except Exception:
                        return (False, f'Tải model thất bại ({_err_type}): {_err_msg}{_hint}')
                    return (False, f'Tải model thất bại ({_err_type}): {_err_msg}{_hint}')
                model.eval()
                model.to(device)
                _log('Đọc thông tin audio...', 25)
                import numpy as _np
                import soundfile as sf
                _info = sf.info(tmp_audio)
                _in_sr = _info.samplerate
                _total_frames = int(_info.frames)
                _audio_sec = _total_frames / float(_in_sr) if _in_sr else 0.0
                if _in_sr != model.samplerate:
                    _log(f'⚠️ SR nguồn {_in_sr} != model {model.samplerate}', 30)
                SEG_SEC = 60.0
                seg_n = int(SEG_SEC * model.samplerate)
                _est_vram_mb = 500 + int(min(_audio_sec, SEG_SEC) * model.samplerate * 2 * 4 * 3 / 1048576)
                if status_cb:
                    status_cb(f'Audio {_audio_sec:.0f}s, chia khúc {SEG_SEC:.0f}s, VRAM/khúc ~{_est_vram_mb}MB', 30)
                if device == 'cuda':
                    try:
                        _free_bytes, _total_bytes = torch.cuda.mem_get_info(0)
                        _free_mb = _free_bytes // 1048576
                    except Exception:
                        _free_mb = torch.cuda.get_device_properties(0).total_memory // 1048576
                    if _est_vram_mb > _free_mb * 0.8:
                        _log(f'⚠️ VRAM cần ~{_est_vram_mb}MB > 80% free {_free_mb}MB → CPU', 35)
                        model.to('cpu')
                        torch.cuda.empty_cache()
                        device = 'cpu'
                vocal_idx = model.sources.index('vocals')
                if remove_stems is not None:
                    _rm = set(remove_stems)
                    _keep_idx = [i for i, s in enumerate(model.sources) if s not in _rm]
                    _log(f"Tách (bỏ {'+'.join(remove_stems) or 'không'}), chia khúc...", 35)
                elif extract_vocals:
                    _keep_idx = [vocal_idx]
                    _log('Tách vocals (chia khúc)...', 35)
                else:
                    _keep_idx = [i for i in range(len(model.sources)) if i != vocal_idx]
                    _log('Tách instrumental (chia khúc)...', 35)
                _log(f'Đang tách giọng AI ({device.upper()}, mất vài phút)...', 35)
                _old_threads = torch.get_num_threads()
                from core.demucs_config import demucs_torch_thread_count, get_demucs_cpu_thread_percent
                _limit_threads = demucs_torch_thread_count()
                _pct = get_demucs_cpu_thread_percent()
                try:
                    from core.cpu_budget import limit_current_process_cpu
                    _how = limit_current_process_cpu(_pct)
                except Exception:
                    _how = 'none'
                if device == 'cpu':
                    torch.set_num_threads(_limit_threads)
                    _log(f'Giới hạn CPU mặc định: {_pct}% máy → {_limit_threads} luồng PyTorch' + (f' · hard-cap {_how}' if _how not in frozenset({'skip', 'none'}) else ''), 35)
                _apply_start = time.time()
                _apply_done = threading.Event()
                _frames_done = [0]

                def _progress_ticker() -> None:
                    if not _apply_done.wait(timeout=3.0):
                        while True:
                            elapsed = int(time.time() - _apply_start)
                            frac = min(1.0, _frames_done[0] / max(1, _total_frames))
                            pct = min(35 + int(frac * 62), 97)
                            mins = elapsed // 60
                            secs = elapsed % 60
                            t_str = f':{secs}02d' if mins else f'{secs}s'
                            _log(f'AI đang tách... {int(frac * 100)}% ({t_str}) - vui lòng chờ', pct)
                            if _apply_done.wait(timeout=3.0):
                                return None
                _ticker = threading.Thread(target=_progress_ticker, daemon=True)
                _ticker.start()
                try:
                    with sf.SoundFile(tmp_audio) as _fin, sf.SoundFile(_part_out, mode='w', samplerate=model.samplerate, channels=2) as _fout:

                        def _separate_block(offset, blk):
                            if _stopped():
                                raise RuntimeError('Đã dừng tách audio')
                            _fin.seek(offset)
                            _b = _fin.read(blk, dtype='float32', always_2d=True)
                            _frames_done[0] = min(_total_frames, offset + _b.shape[0])
                            wav_c = torch.from_numpy(_np.ascontiguousarray(_b.T))
                            if wav_c.shape[0] == 1:
                                wav_c = wav_c.repeat(2, 1)
                            elif wav_c.shape[0] > 2:
                                wav_c = wav_c[:2]
                            wav_c = wav_c.to(device)
                            try:
                                with torch.no_grad():
                                    src = apply_model(model, wav_c.unsqueeze(0), device=device, progress=False, shifts=0)[0]
                            except Exception as _gpu_err:
                                if device == 'cuda':
                                    _log(f'GPU lỗi, chuyển CPU... ({str(_gpu_err)[:120]})')
                                    model.to('cpu')
                                    torch.cuda.empty_cache()
                                    device = 'cpu'
                                    torch.set_num_threads(_limit_threads)
                                    wav_c = wav_c.to('cpu')
                                    with torch.no_grad():
                                        src = apply_model(model, wav_c.unsqueeze(0), device=device, progress=False, shifts=0)[0]
                                else:
                                    raise
                            if _keep_idx:
                                _o = src[_keep_idx[0]]
                                for _i in _keep_idx[1:]:
                                    _o = _o + src[_i]
                            else:
                                _o = src[vocal_idx] * 0.0
                            return _o.detach().cpu().numpy().astype(_np.float32, copy=False)
                        _overlap_add_separate(_total_frames, _separate_block, _fout.write, seg_n)
                    os.replace(_part_out, output_path)
                except:
                    _apply_done.set()
                    if device == 'cpu':
                        torch.set_num_threads(_old_threads)
                    raise
                _apply_done.set()
                if device == 'cpu':
                    torch.set_num_threads(_old_threads)
                try:
                    os.unlink(tmp_audio)
                except Exception:
                    pass
                _log('Tách giọng hoàn tất!', 100)
                try:
                    if os.path.exists(tmp_audio):
                        os.unlink(tmp_audio)
                except:
                    pass
                try:
                    if os.path.exists(_part_out):
                        os.unlink(_part_out)
                except Exception:
                    pass
                try:
                    import gc as _gc
                    import torch as _t
                    _gc.collect()
                    if _t.cuda.is_available():
                        _t.cuda.empty_cache()
                    else:
                        return (True, '')
                except Exception:
                    return (True, '')
                return (True, '')
            try:
                if os.path.exists(tmp_audio):
                    os.unlink(tmp_audio)
            except Exception:
                pass
            try:
                if os.path.exists(_part_out):
                    os.unlink(_part_out)
            except Exception:
                pass
            try:
                import gc as _gc
                import torch as _t
                _gc.collect()
                if _t.cuda.is_available():
                    _t.cuda.empty_cache()
                else:
                    return (False, 'Không trích xuất được audio từ video')
            except Exception:
                return (False, 'Không trích xuất được audio từ video')
            return (False, 'Không trích xuất được audio từ video')
    except Exception as e:
        err = str(e)
        _safe_print(f'[VocalSep] ERROR: {err}')
        e = None
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
        try:
            if os.path.exists(_part_out):
                os.unlink(_part_out)
        except Exception:
            pass
        try:
            import gc as _gc
            import torch as _t
            _gc.collect()
            if _t.cuda.is_available():
                _t.cuda.empty_cache()
            else:
                return (False, friendly_demucs_error(err))
        except Exception:
            return (False, friendly_demucs_error(err))
        return (False, friendly_demucs_error(err))
    except:
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
    else:
        try:
            if os.path.exists(tmp_audio):
                os.unlink(tmp_audio)
        except Exception:
            pass
        try:
            if os.path.exists(_part_out):
                os.unlink(_part_out)
        except Exception:
            pass
        try:
            import gc as _gc
            import torch as _t
            _gc.collect()
            if _t.cuda.is_available():
                _t.cuda.empty_cache()
            else:
                return (False, 'Đã dừng tách audio')
        except Exception:
            return (False, 'Đã dừng tách audio')
        return (False, 'Đã dừng tách audio')
    try:
        if os.path.exists(_part_out):
            os.unlink(_part_out)
    except Exception:
        pass
    try:
        import gc as _gc
        import torch as _t
        _gc.collect()
        if _t.cuda.is_available():
            _t.cuda.empty_cache()
        else:
            raise
    except Exception:
        pass
    raise
    raise
    raise