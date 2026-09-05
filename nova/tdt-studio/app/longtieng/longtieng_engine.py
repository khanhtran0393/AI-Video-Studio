'\nlongtieng_engine.py — TTS engines: Edge-TTS (Microsoft) và Vienew TTS (tiếng Việt).\nSinh file audio MP3 cho từng segment phụ đề.\n'
from __future__ import annotations
import asyncio
import gc
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable
import config as _cfg
import re as _re
from .longtieng_voices import EDGE_VOICES, LANG_LABELS, VIENEW_VOICES, VIENEW_MODELS, DEFAULT_VIENEW_MODEL, _PYTORCH_TO_GGUF_FALLBACK, _PYTORCH_VRAM_REQ, VBEE_VOICES, FPT_VOICES, VOICE_META, ENGINE_LABELS, _FPT_FREE_KEYS
from .longtieng_audio_utils import _clean_text_for_tts, get_audio_duration, _probe_audio_duration_with_retry, speed_to_rate, pitch_to_str, _trim_audio, _apply_pitch_shift, _atempo_adjust, _remove_silence, _auto_fix_edge_voice, _coerce_capcut_voice_id, _coerce_edge_voice_id
from .engines_edge import EdgeTTSEngine
try:
    from .engines_vienew import VienewTTSEngine, _TEMP_DIR
except ImportError:
    VienewTTSEngine = None
    _TEMP_DIR = tempfile.gettempdir()
from .engines_fpt import FptTTSEngine
from .engines_vbee import VbeeTTSEngine
from .engines_minimax import MiniMaxTTSEngine, MINIMAX_VOICES
from .engines_zalo import ZaloTTSEngine, ZALO_VOICES
from .engines_siliconflow import SiliconFlowTTSEngine, SILICONFLOW_VOICES, SILICONFLOW_MODELS
from .engines_deepgram import DeepgramTTSEngine
from .engines_capcut import CapCutTTSEngine, CAPCUT_VOICES
from .engines_ngochuyen import NgocHuyenTTSEngine, scan_ngochuyen_voices, NGOCHUYEN_VOICES_DEFAULT as NGOCHUYEN_VOICES
from .engines_supertonic import SupertonicTTSEngine, SUPERTONIC_VOICES
from .engines_kokoro import KokoroTTSEngine, KOKORO_VOICES
from .engines_tiktok import TikTokTTSEngine, TIKTOK_VOICES
from .longtieng_text_trim import trim_text_if_needed

def _hide_file_win(path):
    if os.name != 'nt':
        pass
    else:
        try:
            import ctypes
            ctypes.windll.kernel32.SetFileAttributesW(str(path), 2)
        except Exception:
            pass

def generate_all_voices(segments: list[dict], engine: str='edge', voice: str='vi-VN-HoaiMyNeural', speed: float=1.0, pitch: int=0, smart_voice: bool=False, api_key: str='', model_repo: str='', ref_audio: str='', ref_text: str='', pitch_semitones: float=0.0, progress_cb: Callable[[int, int, str], None] | None=None, stop_flag: threading.Event | None=None, output_dir: str='', video_path: str='', max_workers: int=0, force_new: bool=False, proxy: str='', relay_url: str='', relay_secret: str='', lang: str='vi', tts_fit_mode: str='stretch_video', tts_fit_max_speed: float=1.2, lock_voice_lang: bool=False) -> list[dict]:
    os.environ['OMP_NUM_THREADS'] = '4'
    os.environ['OPENBLAS_NUM_THREADS'] = '4'
    os.environ['MKL_NUM_THREADS'] = '4'
    try:
        try:
            try:
                try:
                    try:
                        try:
                            try:
                                try:
                                    try:
                                        try:
                                            try:
                                                try:
                                                    try:
                                                        try:
                                                            try:
                                                                try:
                                                                    import torch
                                                                    torch.set_num_threads(4)
                                                                except Exception:
                                                                    pass
                                                                try:
                                                                    import psutil
                                                                    psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
                                                                except Exception:
                                                                    pass
                                                                _auto_workers = max(2, min(8, (os.cpu_count() or 4) * 3 // 5))
                                                                _tts_workers = min(max_workers, 16) if max_workers > 0 else _auto_workers
                                                                try:
                                                                    import psutil as _ps
                                                                    _mem = _ps.virtual_memory()
                                                                    _tts_workers = max(1, _tts_workers // 2)
                                                                    if _mem.percent > 85 and max_workers == 0 and progress_cb:
                                                                        progress_cb(0, len(segments), f'⚠️ RAM cao ({_mem.percent:.0f}%), giảm xuống {_tts_workers} luồng')
                                                                    _cpu = _ps.cpu_percent(interval=0.3)
                                                                    _tts_workers = max(2, _tts_workers - 1)
                                                                    if _cpu > 90 and _tts_workers > 2 and (max_workers == 0) and progress_cb:
                                                                        progress_cb(0, len(segments), f'⚠️ CPU cao ({_cpu:.0f}%), giảm xuống {_tts_workers} luồng')
                                                                except Exception:
                                                                    pass
                                                                from .media_naming import tts_stem_prefix
                                                                _vid_stem = tts_stem_prefix(Path(video_path).stem) if video_path else ''
                                                                if output_dir:
                                                                    _out_dir = Path(output_dir)
                                                                elif video_path and os.path.isfile(video_path):
                                                                    _out_dir = Path(video_path).parent / 'Giọng Đọc TTS'
                                                                else:
                                                                    _out_dir = _TEMP_DIR
                                                                _out_dir.mkdir(parents=True, exist_ok=True)
                                                                _prefix = f'{_vid_stem}_tts_' if _vid_stem else 'tts_'
                                                                if engine == 'edge':
                                                                    lock = (lang or '').strip().lower()[:2] if lock_voice_lang else ''
                                                                    if lock:
                                                                        from .longtieng_voices import EDGE_VOICES
                                                                        voice = _coerce_edge_voice_id(voice, prefer_lang=lock)
                                                                        cur = voice.split('-')[0].lower() if voice else ''
                                                                        voices = EDGE_VOICES.get(lock) or EDGE_VOICES.get('vi') or []
                                                                        if cur != lock and voices:
                                                                            voice = voices[0][0]
                                                                    else:
                                                                        voice = _auto_fix_edge_voice(voice, segments)
                                                                elif engine == 'capcut':
                                                                    voice = _coerce_capcut_voice_id(voice)
                                                                _meta_path = _out_dir / f'{_prefix}meta.json'
                                                                _text_sig = hashlib.sha1('\n'.join((f"|{float(seg.get('end_sec', seg.get('end', 0))):.3f}|{seg.get('translated') or seg.get('text', '')}" for seg in segments)).encode('utf-8')).hexdigest()[:16]
                                                                _meta_payload = {'engine': engine, 'voice': voice, 'speed': speed, 'pitch': pitch, 'text_sig': _text_sig, 'lang': str(lang or '')}
                                                                _existing_count = 0
                                                                for i, seg in enumerate(segments):
                                                                    _p = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                                    if _p.exists() and _p.stat().st_size > 256:
                                                                        _existing_count += 1
                                                                if _meta_path.is_file():
                                                                    try:
                                                                        stored = json.loads(_meta_path.read_text(encoding='utf-8'))
                                                                        force_new = True
                                                                        if not force_new and _existing_count >= len(segments) and (stored != _meta_payload) and progress_cb:
                                                                            progress_cb(0, len(segments), '🔄 Giọng/TTS đổi — tạo lại...')
                                                                    except Exception:
                                                                        force_new = True
                                                                else:
                                                                    force_new = True
                                                                    if progress_cb:
                                                                        progress_cb(0, len(segments), '🔄 Không có meta giọng — tạo lại TTS...')
                                                                if force_new:
                                                                    for old in _out_dir.glob(f'{_prefix}*.mp3'):
                                                                        if '_tts_full' in old.name:
                                                                            continue
                                                                        for _attempt in range(3):
                                                                            try:
                                                                                old.unlink()
                                                                                break
                                                                            except PermissionError:
                                                                                time.sleep(0.2)
                                                                            except Exception:
                                                                                break
                                                                elif _existing_count >= len(segments):
                                                                    if progress_cb:
                                                                        progress_cb(0, len(segments), f'♻️ Dùng lại {_existing_count} file TTS đã có.')
                                                                elif _existing_count > 0:
                                                                    for old in _out_dir.glob(f'{_prefix}*.mp3'):
                                                                        if '_tts_full' in old.name:
                                                                            continue
                                                                        try:
                                                                            old.unlink()
                                                                        except Exception:
                                                                            pass
                                                                    if progress_cb:
                                                                        progress_cb(0, len(segments), f'🗑️ Đã dọn {_existing_count} file TTS dở dang, đang tạo mới...')
                                                                if engine == 'edge':
                                                                    eng = EdgeTTSEngine(voice=voice, speed=speed, pitch=pitch)
                                                                    results = []
                                                                    total = len(segments)
                                                                    _disk_pregened = set()
                                                                    for i in range(total):
                                                                        _p = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                                        if _p.exists() and _p.stat().st_size > 256:
                                                                            _disk_pregened.add(i)
                                                                    _edge_pregened = set()
                                                                    if engine == 'edge':
                                                                        _tasks = []
                                                                        for i, seg in enumerate(segments):
                                                                            if stop_flag and stop_flag.is_set():
                                                                                break
                                                                            text = (seg.get('translated') or seg.get('text') or '').strip()
                                                                            text = _clean_text_for_tts(text)
                                                                            if i not in _disk_pregened and text:
                                                                                out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                                                _tasks.append((text, out, i))
                                                                        if _tasks and (not stop_flag or not stop_flag.is_set()):
                                                                            if progress_cb:
                                                                                progress_cb(0, total, f'🚀 Edge-TTS: tạo {len(_tasks)} audio song song...')

                                                                            def _edge_batch_progress(done, total_tasks):
                                                                                if progress_cb:
                                                                                    progress_cb(done, total, f'🎵 Edge-TTS: {done}/{total_tasks}...')
                                                                                    return None
                                                                            _edge_concurrency = 10
                                                                            eng.generate_batch([(t, p) for t, p, _ in _tasks], batch_size=_edge_concurrency, progress_cb=_edge_batch_progress, stop_flag=stop_flag)
                                                                            for _, p, idx in _tasks:
                                                                                if os.path.exists(p) and os.path.getsize(p) > 100:
                                                                                    _edge_pregened.add(idx)
                                                                    _vbee_pregened = set()
                                                                    if engine == 'vbee':
                                                                        _tasks_vbee = []
                                                                        for i, seg in enumerate(segments):
                                                                            if stop_flag and stop_flag.is_set():
                                                                                break
                                                                            text = (seg.get('translated') or seg.get('text') or '').strip()
                                                                            text = _clean_text_for_tts(text)
                                                                            if i not in _disk_pregened and text:
                                                                                out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                                                _tasks_vbee.append((text, out, i))
                                                                        if _tasks_vbee and (not stop_flag or not stop_flag.is_set()):
                                                                            if progress_cb:
                                                                                progress_cb(0, total, f'🚀 Vbee: tạo {len(_tasks_vbee)} audio song song ({_tts_workers} luồng)...')
                                                                            from concurrent.futures import ThreadPoolExecutor, as_completed

                                                                            def _gen_vbee_worker(task):
                                                                                t, p, idx = task
                                                                                eng.generate(t, p)
                                                                                return idx
                                                                            _done_cnt = 0
                                                                            with ThreadPoolExecutor(max_workers=_tts_workers) as pool:
                                                                                futs = {pool.submit(_gen_vbee_worker, t): t for t in _tasks_vbee}
                                                                                for fut in as_completed(futs):
                                                                                    if stop_flag and stop_flag.is_set():
                                                                                        for f in futs:
                                                                                            f.cancel()
                                                                                        break
                                                                                    try:
                                                                                        idx = fut.result()
                                                                                        t_info = futs[fut]
                                                                                        if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                                                            _vbee_pregened.add(idx)
                                                                                        _done_cnt += 1
                                                                                        if progress_cb:
                                                                                            _pct = _done_cnt * 100 // len(_tasks_vbee)
                                                                                            if _pct % 10 == 0 or _done_cnt == len(_tasks_vbee):
                                                                                                progress_cb(_done_cnt, total, f'🎤 Vbee: {_pct}%')
                                                                                    except Exception:
                                                                                        _done_cnt += 1
                                                                elif engine == 'vienew':
                                                                    eng = VienewTTSEngine(voice=voice, speed=speed, model_repo=model_repo, ref_audio=ref_audio, ref_text=ref_text)
                                                                elif engine == 'vbee':
                                                                    eng = VbeeTTSEngine(api_key=api_key, voice=voice, speed=speed)
                                                                elif engine == 'fpt':
                                                                    eng = FptTTSEngine(api_key=api_key, voice=voice, speed=speed, relay_url=relay_url, relay_secret=relay_secret)
                                                                elif engine == 'elevenlabs':
                                                                    from longtieng.elevenlabs_engine import ElevenLabsTTSEngine
                                                                    eng = ElevenLabsTTSEngine(api_key=api_key, voice=voice, speed=speed, proxy=proxy, relay_url=relay_url, relay_secret=relay_secret)
                                                                elif engine == 'minimax':
                                                                    eng = MiniMaxTTSEngine(api_key=api_key, voice=voice, speed=speed, relay_url=relay_url, relay_secret=relay_secret)
                                                                elif engine == 'zalo':
                                                                    eng = ZaloTTSEngine(api_key=api_key, voice=voice, speed=speed, relay_url=relay_url, relay_secret=relay_secret)
                                                                elif engine == 'siliconflow':
                                                                    eng = SiliconFlowTTSEngine(api_key=api_key, voice=voice, speed=speed, relay_url=relay_url, relay_secret=relay_secret)
                                                                elif engine == 'deepgram':
                                                                    eng = DeepgramTTSEngine(api_key=api_key, voice=voice, speed=speed)
                                                                elif engine == 'capcut':
                                                                    eng = CapCutTTSEngine(voice=voice, speed=speed, volume=1.0)
                                                                elif engine == 'ngochuyen':

                                                                    def _nh_prog(msg):
                                                                        if progress_cb:
                                                                            progress_cb(0, len(segments), msg)
                                                                            return None
                                                                    eng = NgocHuyenTTSEngine(voice=voice, speed=speed, progress_cb=_nh_prog)
                                                                elif engine == 'supertonic':
                                                                    eng = SupertonicTTSEngine(voice=voice, speed=speed, lang=lang)
                                                                elif engine == 'kokoro':

                                                                    def _kk_prog(msg):
                                                                        if progress_cb:
                                                                            progress_cb(0, len(segments), msg)
                                                                            return None
                                                                    eng = KokoroTTSEngine(voice=voice, speed=speed, progress_cb=_kk_prog)
                                                                elif engine == 'tiktok':
                                                                    eng = TikTokTTSEngine(voice=voice)
                                                                else:
                                                                    raise ValueError(f'Engine không hỗ trợ: {engine}')
                                                            except Exception as e:
                                                                if progress_cb:
                                                                    progress_cb(0, total, f'⚠️ Batch Edge-TTS lỗi, fallback tuần tự: {e}')
                                                                    _edge_pregened = set()
                                                            except:
                                                                pass
                                                        except Exception as e:
                                                            if progress_cb:
                                                                progress_cb(0, total, f'⚠️ Batch Vbee lỗi, fallback tuần tự: {e}')
                                                                _vbee_pregened = set()
                                                        _fpt_pregened = set()
                                                        if engine == 'fpt':
                                                            _tasks_fpt = []
                                                            for i, seg in enumerate(segments):
                                                                if stop_flag and stop_flag.is_set():
                                                                    break
                                                                text = (seg.get('translated') or seg.get('text') or '').strip()
                                                                text = _clean_text_for_tts(text)
                                                                if i not in _disk_pregened and text:
                                                                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                                    _tasks_fpt.append((text, out, i))
                                                            if _tasks_fpt and (not stop_flag or not stop_flag.is_set()):
                                                                if progress_cb:
                                                                    progress_cb(0, total, f'🚀 FPT: tạo {len(_tasks_fpt)} audio song song ({_tts_workers} luồng)...')
                                                                from concurrent.futures import ThreadPoolExecutor, as_completed

                                                                def _gen_fpt_worker(task):
                                                                    t, p, idx = task
                                                                    eng.generate(t, p)
                                                                    return idx
                                                                _done_cnt = 0
                                                                with ThreadPoolExecutor(max_workers=_tts_workers) as pool:
                                                                    futs = {pool.submit(_gen_fpt_worker, t): t for t in _tasks_fpt}
                                                                    for fut in as_completed(futs):
                                                                        if stop_flag and stop_flag.is_set():
                                                                            for f in futs:
                                                                                f.cancel()
                                                                            break
                                                                        try:
                                                                            idx = fut.result()
                                                                            t_info = futs[fut]
                                                                            if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                                                _fpt_pregened.add(idx)
                                                                            _done_cnt += 1
                                                                            if progress_cb:
                                                                                _pct = _done_cnt * 100 // len(_tasks_fpt)
                                                                                if _pct % 10 == 0 or _done_cnt == len(_tasks_fpt):
                                                                                    progress_cb(_done_cnt, total, f'🎤 FPT: {_pct}%')
                                                                        except Exception:
                                                                            _done_cnt += 1
                                                    except:
                                                        pass
                                                except Exception as e:
                                                    if progress_cb:
                                                        progress_cb(0, total, f'⚠️ Batch FPT lỗi, fallback tuần tự: {e}')
                                                        _fpt_pregened = set()
                                                _elevenlabs_pregened = set()
                                                if engine == 'elevenlabs':
                                                    _tasks_el = []
                                                    for i, seg in enumerate(segments):
                                                        if stop_flag and stop_flag.is_set():
                                                            break
                                                        text = (seg.get('translated') or seg.get('text') or '').strip()
                                                        text = _clean_text_for_tts(text)
                                                        if i not in _disk_pregened and text:
                                                            out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                            _tasks_el.append((text, out, i))
                                                    if _tasks_el and (not stop_flag or not stop_flag.is_set()):
                                                        _el_workers = min(_tts_workers, 2) if relay_url else _tts_workers
                                                        if progress_cb:
                                                            progress_cb(0, total, f'🚀 ElevenLabs: tạo {len(_tasks_el)} audio song song ({_el_workers} luồng)...')
                                                        from concurrent.futures import ThreadPoolExecutor, as_completed

                                                        def _gen_el_worker(task):
                                                            t, p, idx = task
                                                            eng.generate(t, p)
                                                            return idx
                                                        _done_cnt = 0
                                                        with ThreadPoolExecutor(max_workers=_el_workers) as pool:
                                                            futs = {pool.submit(_gen_el_worker, t): t for t in _tasks_el}
                                                            for fut in as_completed(futs):
                                                                if stop_flag and stop_flag.is_set():
                                                                    for f in futs:
                                                                        f.cancel()
                                                                    break
                                                                try:
                                                                    idx = fut.result()
                                                                    t_info = futs[fut]
                                                                    if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                                        _elevenlabs_pregened.add(idx)
                                                                    _done_cnt += 1
                                                                    if progress_cb:
                                                                        _pct = _done_cnt * 100 // len(_tasks_el)
                                                                        if _pct % 10 == 0 or _done_cnt == len(_tasks_el):
                                                                            progress_cb(_done_cnt, total, f'🎤 ElevenLabs: {_pct}%')
                                                                except Exception as _el_err:
                                                                    _done_cnt += 1
                                                                    if progress_cb:
                                                                        progress_cb(_done_cnt, total, f'⚠️ ElevenLabs lỗi: {_el_err}')
                                            except:
                                                pass
                                        except Exception as e:
                                            if progress_cb:
                                                progress_cb(0, total, f'⚠️ Batch ElevenLabs lỗi, fallback tuần tự: {e}')
                                                _elevenlabs_pregened = set()
                                        _minimax_pregened = set()
                                        if engine == 'minimax':
                                            _tasks_mm = []
                                            for i, seg in enumerate(segments):
                                                if stop_flag and stop_flag.is_set():
                                                    break
                                                text = (seg.get('translated') or seg.get('text') or '').strip()
                                                text = _clean_text_for_tts(text)
                                                if i not in _disk_pregened and text:
                                                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                                    _tasks_mm.append((text, out, i))
                                            if _tasks_mm and (not stop_flag or not stop_flag.is_set()):
                                                if progress_cb:
                                                    progress_cb(0, total, f'🚀 MiniMax: tạo {len(_tasks_mm)} audio song song ({_tts_workers} luồng)...')
                                                from concurrent.futures import ThreadPoolExecutor, as_completed

                                                def _gen_mm_worker(task):
                                                    t, p, idx = task
                                                    eng.generate(t, p)
                                                    return idx
                                                _done_cnt = 0
                                                with ThreadPoolExecutor(max_workers=_tts_workers) as pool:
                                                    futs = {pool.submit(_gen_mm_worker, t): t for t in _tasks_mm}
                                                    for fut in as_completed(futs):
                                                        if stop_flag and stop_flag.is_set():
                                                            for f in futs:
                                                                f.cancel()
                                                            break
                                                        try:
                                                            idx = fut.result()
                                                            t_info = futs[fut]
                                                            if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                                _minimax_pregened.add(idx)
                                                            _done_cnt += 1
                                                            if progress_cb:
                                                                _pct = _done_cnt * 100 // len(_tasks_mm)
                                                                if _pct % 10 == 0 or _done_cnt == len(_tasks_mm):
                                                                    progress_cb(_done_cnt, total, f'🎤 MiniMax: {_pct}%')
                                                        except Exception as _mm_err:
                                                            _done_cnt += 1
                                                            if progress_cb:
                                                                progress_cb(_done_cnt, total, f'⚠️ MiniMax lỗi: {_mm_err}')
                                    except:
                                        pass
                                except Exception as e:
                                    if progress_cb:
                                        progress_cb(0, total, f'⚠️ Batch MiniMax lỗi, fallback tuần tự: {e}')
                                        _minimax_pregened = set()
                                _zalo_pregened = set()
                                if engine == 'zalo':
                                    _tasks_zl = []
                                    for i, seg in enumerate(segments):
                                        if stop_flag and stop_flag.is_set():
                                            break
                                        text = (seg.get('translated') or seg.get('text') or '').strip()
                                        text = _clean_text_for_tts(text)
                                        if i not in _disk_pregened and text:
                                            out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                            _tasks_zl.append((text, out, i))
                                    if _tasks_zl and (not stop_flag or not stop_flag.is_set()):
                                        if progress_cb:
                                            progress_cb(0, total, f'🚀 Zalo: tạo {len(_tasks_zl)} audio song song ({_tts_workers} luồng)...')
                                        from concurrent.futures import ThreadPoolExecutor, as_completed

                                        def _gen_zl_worker(task):
                                            t, p, idx = task
                                            eng.generate(t, p)
                                            return idx
                                        _done_cnt = 0
                                        with ThreadPoolExecutor(max_workers=_tts_workers) as pool:
                                            futs = {pool.submit(_gen_zl_worker, t): t for t in _tasks_zl}
                                            for fut in as_completed(futs):
                                                if stop_flag and stop_flag.is_set():
                                                    for f in futs:
                                                        f.cancel()
                                                    break
                                                try:
                                                    idx = fut.result()
                                                    t_info = futs[fut]
                                                    if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                        _zalo_pregened.add(idx)
                                                    _done_cnt += 1
                                                    if progress_cb:
                                                        _pct = _done_cnt * 100 // len(_tasks_zl)
                                                        if _pct % 10 == 0 or _done_cnt == len(_tasks_zl):
                                                            progress_cb(_done_cnt, total, f'🎤 Zalo: {_pct}%')
                                                except Exception as _zl_err:
                                                    _done_cnt += 1
                                                    if progress_cb:
                                                        progress_cb(_done_cnt, total, f'⚠️ Zalo lỗi: {_zl_err}')
                            except:
                                pass
                        except Exception as e:
                            if progress_cb:
                                progress_cb(0, total, f'⚠️ Batch Zalo lỗi, fallback tuần tự: {e}')
                                _zalo_pregened = set()
                        _siliconflow_pregened = set()
                        if engine == 'siliconflow':
                            _tasks_sf = []
                            for i, seg in enumerate(segments):
                                if stop_flag and stop_flag.is_set():
                                    break
                                text = (seg.get('translated') or seg.get('text') or '').strip()
                                text = _clean_text_for_tts(text)
                                if i not in _disk_pregened and text:
                                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                                    _tasks_sf.append((text, out, i))
                            if _tasks_sf and (not stop_flag or not stop_flag.is_set()):
                                if progress_cb:
                                    progress_cb(0, total, f'🚀 SiliconFlow: tạo {len(_tasks_sf)} audio song song ({_tts_workers} luồng)...')
                                from concurrent.futures import ThreadPoolExecutor, as_completed

                                def _gen_sf_worker(task):
                                    t, p, idx = task
                                    eng.generate(t, p)
                                    return idx
                                _done_cnt = 0
                                with ThreadPoolExecutor(max_workers=_tts_workers) as pool:
                                    futs = {pool.submit(_gen_sf_worker, t): t for t in _tasks_sf}
                                    for fut in as_completed(futs):
                                        if stop_flag and stop_flag.is_set():
                                            for f in futs:
                                                f.cancel()
                                            break
                                        try:
                                            idx = fut.result()
                                            t_info = futs[fut]
                                            if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                                _siliconflow_pregened.add(idx)
                                            _done_cnt += 1
                                            if progress_cb:
                                                _pct = _done_cnt * 100 // len(_tasks_sf)
                                                if _pct % 10 == 0 or _done_cnt == len(_tasks_sf):
                                                    progress_cb(_done_cnt, total, f'🎤 SiliconFlow: {_pct}%')
                                        except Exception as _sf_err:
                                            _done_cnt += 1
                                            if progress_cb:
                                                progress_cb(_done_cnt, total, f'⚠️ SiliconFlow lỗi: {_sf_err}')
                    except:
                        pass
                except Exception as e:
                    if progress_cb:
                        progress_cb(0, total, f'⚠️ Batch SiliconFlow lỗi, fallback tuần tự: {e}')
                        _siliconflow_pregened = set()
                _capcut_pregened = set()
                if engine == 'capcut':
                    _tasks_cc = []
                    for i, seg in enumerate(segments):
                        if stop_flag and stop_flag.is_set():
                            break
                        text = (seg.get('translated') or seg.get('text') or '').strip()
                        text = _clean_text_for_tts(text)
                        if i not in _disk_pregened and text:
                            out = _out_dir / f'{_prefix}{i:04d}.mp3'
                            _tasks_cc.append((text, out, i))
                    if _tasks_cc and (not stop_flag or not stop_flag.is_set()):
                        if progress_cb:
                            progress_cb(0, total, f'🚀 CapCut TTS: tạo {len(_tasks_cc)} audio song song (5 luồng)...')
                        from concurrent.futures import ThreadPoolExecutor, as_completed

                        def _gen_cc_worker(task):
                            t, p, idx = task
                            eng.generate(t, p)
                            return idx
                        _done_cnt = 0
                        with ThreadPoolExecutor(max_workers=5) as pool:
                            futs = {pool.submit(_gen_cc_worker, t): t for t in _tasks_cc}
                            for fut in as_completed(futs):
                                if stop_flag and stop_flag.is_set():
                                    for f in futs:
                                        f.cancel()
                                    break
                                try:
                                    idx = fut.result()
                                    t_info = futs[fut]
                                    if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                        _capcut_pregened.add(idx)
                                    _done_cnt += 1
                                    if progress_cb:
                                        _pct = _done_cnt * 100 // len(_tasks_cc)
                                        if _pct % 10 == 0 or _done_cnt == len(_tasks_cc):
                                            progress_cb(_done_cnt, total, f'🎤 CapCut: {_pct}%')
                                except Exception as _cc_err:
                                    _done_cnt += 1
                                    if progress_cb:
                                        progress_cb(_done_cnt, total, f'⚠️ CapCut lỗi: {_cc_err}')
            except:
                pass
        except Exception as e:
            if progress_cb:
                progress_cb(0, total, f'⚠️ Batch CapCut lỗi, fallback tuần tự: {e}')
                _capcut_pregened = set()
        _vienew_pregened = set()
        if engine == 'vienew':
            _batch_tasks = []
            for i, seg in enumerate(segments):
                if stop_flag and stop_flag.is_set():
                    break
                if i in _disk_pregened:
                    _vienew_pregened.add(i)
                else:
                    text = (seg.get('translated') or seg.get('text') or '').strip()
                    text = _clean_text_for_tts(text)
                    if text:
                        out = _out_dir / f'{_prefix}{i:04d}.mp3'
                        _batch_tasks.append((text, out, i))
            if _batch_tasks and (not stop_flag or not stop_flag.is_set()):
                _tts = eng._get_tts(model_repo=eng.model_repo, progress_cb=(lambda m: progress_cb(0, total, m)) if progress_cb else None)
                if hasattr(_tts, 'infer_batch'):
                    if progress_cb:
                        progress_cb(0, total, f'🚀 VieNeu GPU: tạo {len(_batch_tasks)} audio batch...')

                    def _vn_batch_progress(msg: str):
                        if progress_cb:
                            progress_cb(0, total, f'🎤 VieNeu: {msg}')
                            return None
                    eng.generate_batch([(t, p) for t, p, _ in _batch_tasks], batch_size=8, progress_cb=_vn_batch_progress)
                    os.path.getsize
                    _vienew_pregened, _, idx = (os.path.exists, _batch_tasks, {idx for _, _, idx in _batch_tasks if str(_out_dir(f'{_prefix}' / f'{idx}04d.mp3')) and str(_out_dir(f'{_prefix}' / f'{idx}04d.mp3')) > 100})
                else:
                    _batch_total = len(_batch_tasks)
                    for _bi, (_text, _out, _idx) in enumerate(_batch_tasks):
                        if stop_flag and stop_flag.is_set():
                            break
                        try:
                            if progress_cb:
                                progress_cb(_bi, total, f'🎤 VieNeu: {_idx + 1}/{total}...')
                            eng.generate(_text, _out)
                            if os.path.exists(_out) and os.path.getsize(_out) > 100:
                                _vienew_pregened.add(_idx)
                        except Exception as e:
                            if progress_cb:
                                progress_cb(_bi, total, f'⚠️ VieNeu segment {_idx + 1} lỗi: {e}')
                    if progress_cb:
                        progress_cb(_batch_total, total, f'✅ VieNeu: xong {len(_vienew_pregened)}/{_batch_total}')
            try:
                VienewTTSEngine.cleanup()
            except Exception:
                pass
        _ngochuyen_pregened = set()
        if engine == 'ngochuyen':
            _tasks_nh = []
            for i, seg in enumerate(segments):
                if stop_flag and stop_flag.is_set():
                    break
                text = (seg.get('translated') or seg.get('text') or '').strip()
                text = _clean_text_for_tts(text)
                if i not in _disk_pregened and text:
                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                    _tasks_nh.append((text, out, i))
            if _tasks_nh and (not stop_flag or not stop_flag.is_set()):
                if progress_cb:
                    progress_cb(0, total, f'🎙️ NgocHuyen TTS: tạo {len(_tasks_nh)} audio...')

                def _nh_batch_progress(done_nh, total_nh):
                    if progress_cb:
                        _pct = done_nh * 100 // total_nh if total_nh else 0
                        if _pct % 10 == 0 or done_nh == total_nh:
                            progress_cb(done_nh, total, f'🎙️ NgocHuyen TTS: {_pct}%')
                        return None
                eng.generate_batch([(t, p) for t, p, _ in _tasks_nh], batch_size=1, progress_cb=_nh_batch_progress, stop_flag=stop_flag)
                for _, p, idx in _tasks_nh:
                    if os.path.exists(p) and os.path.getsize(p) > 100:
                        _ngochuyen_pregened.add(idx)
        _supertonic_pregened = set()
        if engine == 'supertonic':
            _tasks_st = []
            for i, seg in enumerate(segments):
                if stop_flag and stop_flag.is_set():
                    break
                text = (seg.get('translated') or seg.get('text') or '').strip()
                text = _clean_text_for_tts(text)
                if i not in _disk_pregened and text:
                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                    _tasks_st.append((text, out, i))
            if _tasks_st and (not stop_flag or not stop_flag.is_set()):
                _st_workers = max(1, min(3, (os.cpu_count() or 4) // 2, _tts_workers))
                if progress_cb:
                    progress_cb(0, total, f'🚀 All Voice TTS: tạo {len(_tasks_st)} audio ({_st_workers} luồng)...')
                from concurrent.futures import ThreadPoolExecutor, as_completed

                def _gen_st_worker(task):
                    t, p, idx = task
                    eng.generate(t, p)
                    return idx
                _done_st = 0
                with ThreadPoolExecutor(max_workers=_st_workers) as pool:
                    futs = {pool.submit(_gen_st_worker, t): t for t in _tasks_st}
                    for fut in as_completed(futs):
                        if stop_flag and stop_flag.is_set():
                            for f in futs:
                                f.cancel()
                            break
                        try:
                            fut.result()
                            t_info = futs[fut]
                            if os.path.exists(t_info[1]) and os.path.getsize(t_info[1]) > 100:
                                _supertonic_pregened.add(t_info[2])
                        except Exception:
                            pass
                        else:
                            _done_st += 1
        _kokoro_pregened = set()
        if engine == 'kokoro':
            _tasks_kk = []
            for i, seg in enumerate(segments):
                if stop_flag and stop_flag.is_set():
                    break
                text = (seg.get('translated') or seg.get('text') or '').strip()
                text = _clean_text_for_tts(text)
                if i not in _disk_pregened and text:
                    out = _out_dir / f'{_prefix}{i:04d}.mp3'
                    _tasks_kk.append((text, out, i))
            if _tasks_kk and (not stop_flag or not stop_flag.is_set()):
                if progress_cb:
                    progress_cb(0, total, f'🚀 Kokoro: tạo {len(_tasks_kk)} audio...')

                def _kk_batch_progress(done_kk, total_kk):
                    if progress_cb:
                        _pct = done_kk * 100 // total_kk if total_kk else 0
                        if _pct % 10 == 0 or done_kk == total_kk:
                            progress_cb(done_kk, total, f'🎤 Kokoro: {_pct}%')
                        return None
                eng.generate_batch([(t, p) for t, p, _ in _tasks_kk], batch_size=1, progress_cb=_kk_batch_progress, stop_flag=stop_flag)
                for _, p, idx in _tasks_kk:
                    if os.path.exists(p) and os.path.getsize(p) > 100:
                        _kokoro_pregened.add(idx)
        _all_pregened = _disk_pregened | _edge_pregened | _vbee_pregened | _fpt_pregened | _vienew_pregened | _elevenlabs_pregened | _minimax_pregened | _zalo_pregened | _siliconflow_pregened | _ngochuyen_pregened | _capcut_pregened | _supertonic_pregened | _kokoro_pregened

        def _process_segment(i_seg_tuple):
            i, seg = i_seg_tuple
            if stop_flag and stop_flag.is_set():
                return None
            text = (seg.get('translated') or seg.get('text') or '').strip()
            text = _clean_text_for_tts(text)
            if text:
                out = _out_dir / f'{_prefix}{i:04d}.mp3'
                _ss = seg.get('start_sec')
                _se = seg.get('end_sec')
                seg_start = float(_ss) if _ss is not None else float(seg.get('start', 0) if isinstance(seg.get('start', 0), (int, float)) else 0)
                seg_end = float(_se) if _se is not None else float(seg.get('end', 0) if isinstance(seg.get('end', 0), (int, float)) else 0)
                seg_dur = seg_end - seg_start
                if i not in _all_pregened:
                    if not os.path.exists(out) or os.path.getsize(out) < 100 if engine == 'vienew' else range(2):
                        pass
                else:
                    if engine == 'edge':
                        if not os.path.exists(out) or os.path.getsize(out) < 100:
                            try:
                                time.sleep(1.0)
                                eng.generate(text, out, max_retries=1)
                            except Exception:
                                return None
                    elif engine == 'ngochuyen':
                        if not os.path.exists(out) or os.path.getsize(out) < 100:
                            try:
                                time.sleep(0.5)
                                eng.generate(text, out)
                            except Exception:
                                return None
                    elif engine == 'capcut':
                        if not os.path.exists(out) or os.path.getsize(out) < 100:
                            try:
                                time.sleep(0.5)
                                eng.generate(text, out)
                            except Exception:
                                return None
                    elif engine == 'supertonic':
                        if not os.path.exists(out) or os.path.getsize(out) < 100:
                            try:
                                time.sleep(0.5)
                                eng.generate(text, out)
                            except Exception:
                                return None
                    if stop_flag and stop_flag.is_set():
                        return None
                    if smart_voice and seg_dur > 0.3:
                        _remove_silence(out)
                        audio_dur = get_audio_duration(out)
                        _eff_slot = seg_dur
                        _nx = segments[i + 1]
                        _ns = _nx.get('start_sec')
                        _next_st = float(_ns) if _ns is not None else float(_nx.get('start', 0) if isinstance(_nx.get('start', 0), (int, float)) else 0)
                        if i + 1 < len(segments) and _next_st > seg_start:
                            _eff_slot = max(seg_dur, _next_st - seg_start - 0.05)
                        _cap = max(1.0, min(2.5, float(tts_fit_max_speed or 1.25)))
                        need = audio_dur / max(_eff_slot, 0.05)
                        applied = min(need, _cap)
                        target = audio_dur / applied
                        if audio_dur > 0 and audio_dur > _eff_slot and (tts_fit_mode == 'speed_up_tts') and (target < audio_dur - 0.01):
                            _atempo_adjust(out, audio_dur, target)
                    if abs(pitch_semitones) >= 0.1:
                        _apply_pitch_shift(out, pitch_semitones)
                    size = 0
                    try:
                        size = os.path.getsize(out) if os.path.exists(out) else 0
                    except Exception:
                        size = 0
                    dur = _probe_audio_duration_with_retry(out)
                    if dur <= 0 and size > 256:
                        dur = max(seg_dur, 0.05)
                    if not os.path.exists(out) or size == 0:
                        return None
                    if dur <= 0:
                        dur = max(seg_dur, 0.5)
                    return {'index': i, 'start': seg_start, 'end': seg_end, 'audio_path': out, 'duration': dur, 'text': text}
            else:
                return None
        from concurrent.futures import ThreadPoolExecutor as _TPE_pp, as_completed as _as_completed_pp
        _pp_workers = max(1, _tts_workers)
        _seg_items = list(enumerate(segments))
        if progress_cb:
            progress_cb(0, total, f'⚡ Xử lý {total} segment song song ({_pp_workers} luồng)...')
        _done_count = 0
        with _TPE_pp(max_workers=_pp_workers) as _pp_pool:
            _futs = {_pp_pool.submit(_process_segment, item): item for item in _seg_items}
            for fut in _as_completed_pp(_futs):
                if stop_flag and stop_flag.is_set():
                    break
                _done_count += 1
                try:
                    result = fut.result()
                    if result is not None:
                        results.append(result)
                except Exception as e:
                    i_err = _futs[fut][0]
                    if progress_cb:
                        progress_cb(_done_count, total, f'⚠️ Lỗi segment {i_err + 1}: {e}')
        _voiced_idx = {r.get('index') for r in results}
        _dropped = [(i, s) for i, s in enumerate(segments) if i not in _voiced_idx]
        if _dropped and progress_cb:
            _preview = '; '.join((f"{i + 1}@{float(s.get('start_sec') or s.get('start') or 0):.1f}s '{(s.get('translated') or s.get('text') or '').strip()[:25]}'" for i, s in _dropped[:5]))
            progress_cb(total, total, f'⚠️ Bỏ {len(_dropped)} câu không sinh được giọng: {_preview}')
        if len(results) > 1 and tts_fit_mode == 'speed_up_tts':
            results.sort(key=lambda r: r['start'])
            from .longtieng_audio_utils import enforce_non_overlapping_voice_segments
            results = enforce_non_overlapping_voice_segments(results, max_speed=max(1.0, min(2.5, float(tts_fit_max_speed or 1.25))), smooth=True, hard_enforce=True)
        if progress_cb:
            progress_cb(total, total, f'✅ Tạo xong {len(results)}/{total} giọng đọc!')
        _full_path = str(_out_dir / f'{_vid_stem}_tts_full.mp3')
        if tts_fit_mode == 'stretch_video':
            for r in results:
                _ap = r.get('audio_path', '')
                _bn = os.path.basename(_ap)
                if not _ap or not os.path.isfile(_ap) or _bn.endswith('_full.mp3'):
                    pass
                else:
                    _hide_file_win(_ap)
            if progress_cb:
                progress_cb(total, total, f'📐 Mode stretch_video: giữ {len(results)} file giọng riêng (không gộp).')
        elif results and len(results) >= 1 and (_out_dir != _TEMP_DIR):
            if os.path.isfile(_full_path):
                for _del_attempt in range(3):
                    try:
                        os.remove(_full_path)
                        break
                    except PermissionError:
                        time.sleep(0.3)
                    except Exception:
                        break
            try:
                _merge_tts_to_single_file(results, _out_dir, _vid_stem, progress_cb, total)
            except Exception as _e_merge:
                if progress_cb:
                    progress_cb(total, total, f'⚠️ Gộp file liền mạch lỗi: {_e_merge}')
            if os.path.isfile(_full_path) and os.path.getsize(_full_path) > 0:
                _cleaned = 0
                for r in results:
                    p = r.get('audio_path', '')
                    _bn1010 = os.path.basename(p)
                    if not p or not os.path.isfile(p) or ('_tts_' in _bn1010 and _bn1010.endswith('_full.mp3')):
                        continue
                    try:
                        os.remove(p)
                        _cleaned += 1
                    except OSError:
                        pass
                if _cleaned and progress_cb:
                    progress_cb(total, total, f'🧹 Đã dọn {_cleaned} file TTS tạm.')
                _full_dur = get_audio_duration(_full_path)
                results = [{'index': 0, 'start': 0.0, 'end': _full_dur if _full_dur > 0 else 9999.0, 'audio_path': _full_path, 'duration': _full_dur if _full_dur > 0 else 9999.0}]
        try:
            _meta_path.write_text(json.dumps(_meta_payload, ensure_ascii=False), encoding='utf-8')
        except Exception:
            pass
        gc.collect()
        return results
    except Exception as e:
        if progress_cb:
            progress_cb(0, total, f'⚠️ TTS batch lỗi: {e}')
        try:
            _meta_path.unlink(missing_ok=True)
        except Exception:
            pass
    return []

def _run_adelay_amix(voice_files: list[dict], output_path: str, timeout: int=600) -> bool:
    import uuid
    n = len(voice_files)
    if n == 0:
        return False
    _uid = uuid.uuid4().hex[:8]
    script_path = os.path.join(tempfile.gettempdir(), f'tdt_adm_{_uid}.txt')
    cmd = [_cfg.FFMPEG_PATH, '-nostdin', '-y']
    for vf in voice_files:
        cmd += ['-i', vf['audio_path']]
    filter_parts = []
    labels = []
    for idx, vf in enumerate(voice_files):
        delay_ms = int(float(vf.get('start', 0)) * 1000)
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
    graph = ';'.join(filter_parts)
    cmd += [*filter_complex_from_file_args(script_path, graph_text=graph), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', output_path]
    try:
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        _pr = subprocess.run(cmd, capture_output=True, timeout=timeout, creationflags=flags)
        if _pr.returncode != 0:
            return False
    except Exception:
        try:
            os.remove(script_path)
        except OSError:
            pass
        return False
    try:
        os.remove(script_path)
    except OSError:
        pass
    return True
_MAX_INPUTS_PER_CMD = 150

def _merge_tts_to_single_file(results: list[dict], out_dir: Path, vid_stem: str, progress_cb: Callable[[int, int, str], None] | None, total: int, out_filename: str | None=None):
    import uuid
    if progress_cb:
        progress_cb(total, total, '🔗 Đang gộp thành file liền mạch...')
    from longtieng.longtieng_audio_utils import enforce_non_overlapping_voice_segments
    results = enforce_non_overlapping_voice_segments(list(results))
    merged_path = str(out_dir / (out_filename or f'{vid_stem}_tts_full.mp3'))
    n = len(results)
    if n <= _MAX_INPUTS_PER_CMD:
        ok = _run_adelay_amix(results, merged_path)
        if ok and progress_cb:
            progress_cb(total, total, f'✅ File liền mạch: {os.path.basename(merged_path)}')
        elif not ok and progress_cb:
            progress_cb(total, total, '⚠️ Gộp file liền mạch lỗi')
        return None
    _uid = uuid.uuid4().hex[:8]
    intermediate_files = []
    try:
        for bi in range(0, n, _MAX_INPUTS_PER_CMD):
            batch = results[bi:bi + _MAX_INPUTS_PER_CMD]
            tmp_path = os.path.join(tempfile.gettempdir(), f'tdt_batch_{_uid}_{bi}.mp3')
            if progress_cb:
                progress_cb(total, total, f'🔗 Gộp batch {bi // _MAX_INPUTS_PER_CMD + 1}/{(n - 1) // _MAX_INPUTS_PER_CMD + 1}...')
            ok = _run_adelay_amix(batch, tmp_path, timeout=600)
            if ok:
                intermediate_files.append(tmp_path)
        if not intermediate_files:
            if progress_cb:
                progress_cb(total, total, '⚠️ Gộp file liền mạch lỗi (tất cả batch thất bại)')
            return None
        elif len(intermediate_files) == 1:
            import shutil
            shutil.move(intermediate_files[0], merged_path)
            intermediate_files.clear()
        else:
            inter_as_dicts = [{'audio_path': p, 'start': 0} for p in intermediate_files]
            ok = _run_adelay_amix(inter_as_dicts, merged_path, timeout=600)
            if not ok and progress_cb:
                progress_cb(total, total, '⚠️ Gộp file liền mạch lỗi (merge cuối)')
                for tmp in intermediate_files:
                    try:
                        os.remove(tmp)
                    except:
                        pass
    except:
        for tmp in intermediate_files:
            try:
                os.remove(tmp)
            except OSError:
                pass
    if os.path.isfile(merged_path) and os.path.getsize(merged_path) > 0:
        if progress_cb:
            progress_cb(total, total, f'✅ File liền mạch: {os.path.basename(merged_path)}')
    elif progress_cb:
        progress_cb(total, total, '⚠️ Gộp file liền mạch lỗi')
    return None

def run_tts_async(segments: list[dict], engine: str='edge', voice: str='vi-VN-HoaiMyNeural', speed: float=1.0, pitch: int=0, smart_voice: bool=False, api_key: str='', model_repo: str='', ref_audio: str='', ref_text: str='', pitch_semitones: float=0.0, on_progress: Callable[[int, int, str], None] | None=None, on_done: Callable[[list[dict]], None] | None=None, on_error: Callable[[str], None] | None=None, stop_flag: threading.Event | None=None, output_dir: str='', video_path: str='', max_workers: int=0, force_new: bool=False, proxy: str='', relay_url: str='', relay_secret: str='', lang: str='vi', tts_fit_mode: str='stretch_video', tts_fit_max_speed: float=1.2) -> threading.Thread:

    def _worker():
        try:
            results = generate_all_voices(segments, engine=engine, voice=voice, speed=speed, pitch=pitch, smart_voice=smart_voice, api_key=api_key, model_repo=model_repo, ref_audio=ref_audio, ref_text=ref_text, pitch_semitones=pitch_semitones, progress_cb=on_progress, stop_flag=stop_flag, output_dir=output_dir, video_path=video_path, max_workers=max_workers, force_new=force_new, proxy=proxy, relay_url=relay_url, relay_secret=relay_secret, lang=lang, tts_fit_mode=tts_fit_mode, tts_fit_max_speed=tts_fit_max_speed)
            if on_done:
                on_done(results)
            else:
                return None
        except Exception as e:
            if on_error:
                on_error(str(e))
                return None
    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return t