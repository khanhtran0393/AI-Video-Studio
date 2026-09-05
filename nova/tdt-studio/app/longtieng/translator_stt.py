'\ntranslator_stt.py — STT (Speech-to-Text) & video chunking functions.\nTách từ longtieng_translator.py để giảm kích thước file.\n'
from __future__ import annotations
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable
import config as _cfg
import re
from .translator_utils import _WORK_DIR, _WHISPER_VOCAB_PROMPTS, _log, _run_ffmpeg, _probe_duration, _seconds_to_srt_time, _srt_time_to_seconds, _safe_remove, _parse_srt
from .translator_render import _extract_keyframes, _make_grid_image, _calc_midpoints

def step1_chunk_video(video_path: str, min_chunk_sec: float=120.0, max_chunk_sec: float=180.0, silence_thresh_db: int=-40, min_silence_ms: int=700, log_cb: Callable[[str], None] | None=None) -> list[dict]:
    from pydub import AudioSegment
    from pydub.silence import detect_silence
    _log(log_cb, '🔪 Bước 1: Đang phân tích khoảng lặng âm thanh...')
    audio_tmp = str(_WORK_DIR / 'full_audio.wav')
    _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', audio_tmp])
    audio = AudioSegment.from_wav(audio_tmp)
    total_ms = len(audio)
    total_sec = total_ms / 1000.0
    _log(log_cb, f'   Tổng thời lượng: {total_sec:.1f}s')
    silences = detect_silence(audio, min_silence_len=min_silence_ms, silence_thresh=silence_thresh_db)
    silence_midpoints_ms = [(s + e) // 2 for s, e in silences]
    cut_points_ms = [0]
    cursor_ms = 0
    while cursor_ms + max_chunk_sec * 1000 < total_ms:
        ideal_min = cursor_ms + int(min_chunk_sec * 1000)
        ideal_max = cursor_ms + int(max_chunk_sec * 1000)
        best = None
        for mid in silence_midpoints_ms:
            if ideal_min <= mid <= ideal_max:
                best = mid
                break
        if best is not None:
            cut_points_ms.append(best)
            cursor_ms = best
        else:
            cut_points_ms.append(ideal_max)
            cursor_ms = ideal_max
    cut_points_ms.append(total_ms)
    chunks = []
    chunk_dir = _WORK_DIR / 'chunks'
    chunk_dir.mkdir(parents=True, exist_ok=True)
    for i in range(len(cut_points_ms) - 1):
        start_sec = cut_points_ms[i] / 1000.0
        end_sec = cut_points_ms[i + 1] / 1000.0
        duration = end_sec - start_sec
        if duration < 1.0:
            pass
        else:
            chunk_path = chunk_dir / f'chunk_{i:03d}.mp4'
            _run_ffmpeg([_cfg.FFMPEG_PATH, '-y', '-ss', f'{start_sec:.3f}', '-i', video_path, '-t', f'{duration:.3f}', '-c', 'copy', '-avoid_negative_ts', 'make_zero', chunk_path])
            chunks.append({'index': i, 'start_sec': start_sec, 'end_sec': end_sec, 'chunk_video_path': chunk_path})
            _log(log_cb, f'   📦 Chunk {i}: {start_sec:.1f}s → {end_sec:.1f}s  ({duration:.1f}s)')
    _log(log_cb, f'✅ Tổng {len(chunks)} chunk.')
    _safe_remove(audio_tmp)
    return chunks
_LANG_TO_ISO: 'dict[str, str]' = {'trung quốc': 'zh', 'trung': 'zh', 'tiếng trung': 'zh', 'hàn quốc': 'ko', 'hàn': 'ko', 'tiếng hàn': 'ko', 'nhật bản': 'ja', 'nhật': 'ja', 'tiếng nhật': 'ja', 'anh': 'en', 'mỹ': 'en', 'tiếng anh': 'en', 'thái lan': 'th', 'thái': 'th', 'tây ban nha': 'es', 'pháp': 'fr', 'đức': 'de', **{'ả rập': 'ar', 'nga': 'ru', 'bồ đào nha': 'pt', 'indonesia': 'id', 'mã lai': 'ms', 'philippines': 'tl'}}

def _resolve_lang_code(ngon_ngu: str) -> str | None:
    if ngon_ngu:
        key = ngon_ngu.strip().lower()
        if key in _LANG_TO_ISO:
            return _LANG_TO_ISO[key]
        for k, v in _LANG_TO_ISO.items():
            if k in key or key in k:
                return v
    else:
        return None

def step2_process_chunk(chunk: dict, grid_cols: int=3, ngon_ngu: str='', log_cb: Callable[[str], None] | None=None) -> dict:
    idx = chunk['index']
    video = chunk['chunk_video_path']
    _log(log_cb, f'🎙️  Bước 2 — Chunk {idx}: STT + Keyframes...')
    srt_path = _WORK_DIR / f'chunk_{idx:03d}_original.srt'
    _stt_cloud(video, srt_path, ngon_ngu=ngon_ngu, log_cb=log_cb)
    chunk['srt_path'] = srt_path
    srt_entries = _parse_srt(srt_path)
    if srt_entries:
        midpoints = _calc_midpoints(srt_entries)
        _log(log_cb, f'   Midpoints ({len(midpoints)}): ' + ', '.join((f'{m:.2f}s' for m in midpoints[:9])))
        selected = midpoints[:9]
        frame_paths = _extract_keyframes(video, selected, idx, log_cb=log_cb)
        if frame_paths:
            grid_path = _WORK_DIR / f'chunk_{idx:03d}_grid.jpg'
            _make_grid_image(frame_paths, grid_path, cols=grid_cols)
            chunk['grid_image_path'] = grid_path
            _log(log_cb, f'   ✅ Grid image: {len(frame_paths)} frames → {grid_path}')
        else:
            chunk['grid_image_path'] = None
    else:
        _log(log_cb, f'   ⚠️ Chunk {idx}: Không phát hiện lời thoại.')
        chunk['grid_image_path'] = None
    return chunk

def _stt_cloud(video_path: str, srt_out: str, ngon_ngu: str='', log_cb: Callable[[str], None] | None=None):
    import json as _json
    import requests
    _log(log_cb, '   Cloud STT: Đang nhận dạng giọng nói...')
    groq_keys = []
    for _cfg_dir in (os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exporter', 'prompts'),):
        _cfg_path = os.path.join(_cfg_dir, 'user_config.json')
        if os.path.isfile(_cfg_path):
            try:
                with open(_cfg_path, 'r', encoding='utf-8') as f:
                    _ucfg = _json.load(f)
                for _prefix in ('groq',):
                    _pk = _ucfg.get(f'{_prefix}_api_key', '')
                    if isinstance(_pk, str) and _pk.strip() and (len(_pk.strip()) >= 10):
                        groq_keys.append(_pk.strip())
                    for _k in _ucfg.get(f'{_prefix}_backup_keys', _ucfg.get(f'{_prefix}_keys', [])):
                        _k = _k.strip() if isinstance(_k, str) else ''
                        if not _k:
                            pass
                        elif len(_k) < 10:
                            pass
                        elif _k not in groq_keys:
                            groq_keys.append(_k)
            except Exception:
                pass
    if not groq_keys:
        try:
            from config import API_RELAY_URL, API_RELAY_SECRET
            if API_RELAY_URL:
                from auth_session import get_relay_auth_headers
                _relay_h = {'Content-Type': 'application/json'}
                _relay_h.update(get_relay_auth_headers())
                if API_RELAY_SECRET:
                    _relay_h['X-Relay-Secret'] = API_RELAY_SECRET
                _rr = requests.post(f"{API_RELAY_URL.rstrip('/')}/groq/key", json={}, headers=_relay_h, timeout=5)
                _rk = _rr.json().get('key', '')
                if _rr.status_code == 200 and _rk:
                    groq_keys.append(_rk)
        except Exception:
            pass
    if not groq_keys:
        try:
            from config import BUNDLED_GROQ_KEYS
            groq_keys.extend(BUNDLED_GROQ_KEYS)
        except Exception:
            pass
    if groq_keys:
        _tmp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        _tmp_wav.close()
        _cmd = [getattr(_cfg, 'FFMPEG_PATH', 'ffmpeg'), '-y', '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-af', 'highpass=f=80,lowpass=f=8000', _tmp_wav.name]
        try:
            subprocess.run(_cmd, capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception:
            pass
        _audio_path = _tmp_wav.name
        _WHISPER_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3']
        segments = []
        _success = False
        _lang_code = _resolve_lang_code(ngon_ngu)
        for w_model in _WHISPER_MODELS:
            if _success:
                break
            for ki in range(len(groq_keys)): 
                try:
                    with open(_audio_path, 'rb') as af:
                        files = {'file': (os.path.basename(_audio_path), af)}
                        data = {'model': w_model, 'response_format': 'verbose_json', 'timestamp_granularities[]': 'word', 'temperature': '0'}
                        if _lang_code:
                            data['language'] = _lang_code
                        _prompt = _WHISPER_VOCAB_PROMPTS.get(_lang_code, '')
                        if _prompt:
                            data['prompt'] = _prompt
                        resp = requests.post('https://api.groq.com/openai/v1/audio/transcriptions', headers={'Authorization': f'Bearer {groq_keys[ki]}'}, files=files, data=data, timeout=120)
                    if resp.status_code == 200:
                        rj = resp.json()
                        for seg in rj.get('segments', []):
                            txt = seg.get('text', '').strip()
                            if txt:
                                words = seg.get('words', [])
                                if words:
                                    s_t = float(words[0].get('start', seg.get('start', 0)))
                                    e_t = float(words[-1].get('end', seg.get('end', 0)))
                                else:
                                    s_t = float(seg.get('start', 0))
                                    e_t = float(seg.get('end', 0))
                                segments.append({'start': s_t, 'end': e_t, 'text': txt})
                        _success = True
                    elif resp.status_code == 429:
                        import time as _t_delay
                        _t_delay.sleep(2)
                except Exception:
                    pass
        try:
            os.remove(_tmp_wav.name)
        except OSError:
            pass
        with open(srt_out, 'w', encoding='utf-8') as f:
            _idx = 0
            for seg in segments:
                start = _seconds_to_srt_time(seg['start'])
                end = _seconds_to_srt_time(seg['end'])
                text = seg['text'].strip()
                if text:
                    from exporter.sub_transcription import _is_cta_line
                    if _is_cta_line(text):
                        _log(log_cb, f'   🚫 Bỏ CTA: "{text}"')
                    else:
                        _idx += 1
                        f.write(f'{_idx}\n{start} --> {end}\n{text}\n\n')
        _log(log_cb, f'   SRT: {len(segments)} dòng → {srt_out}')
        _merge_micro_segments(srt_out, log_cb=log_cb)
        return None
    _log(log_cb, '   ⚠️ Không có API key — bỏ qua STT.')
    with open(srt_out, 'w', encoding='utf-8') as f:
        f.write('')
    while True:
        pass

def _merge_micro_segments(srt_path: str, max_dur_merge: float=0.8, max_chars_merge: int=4, max_gap: float=0.3, log_cb: Callable[[str], None] | None=None):
    entries = _parse_srt(srt_path)
    if len(entries) < 2:
        pass
    else:
        merged = []
        merge_count = 0
        i = 0
        while i < len(entries):
            cur = entries[i]
            dur = cur['end_sec'] - cur['start_sec']
            text = cur['text'].strip()
            is_micro = dur < max_dur_merge and len(text) <= max_chars_merge
            prev = merged[-1]
            gap = cur['start_sec'] - prev['end_sec']
            nxt = entries[i + 1]
            gap = nxt['start_sec'] - cur['end_sec']
            if is_micro and i + 1 < len(entries) and (gap <= max_gap):
                nxt['start_sec'] = cur['start_sec']
                nxt['text'] = text + nxt['text'].strip()
                merge_count += 1
                i += 1
                continue
            merged.append(dict(cur))
            i += 1
        if merge_count == 0:
            pass
        else:
            for idx, e in enumerate(merged, start=1):
                e['index'] = idx
            with open(srt_path, 'w', encoding='utf-8') as f:
                for e in merged:
                    start = _seconds_to_srt_time(e['start_sec'])
                    end = _seconds_to_srt_time(e['end_sec'])
                    f.write(f"{e['index']}\n{start} --> {end}\n{e['text']}\n\n")
            _log(log_cb, f'   🔗 Đã gộp {merge_count} đoạn sub siêu ngắn → {len(merged)} dòng')
    return None
    while True:
        prev['end_sec'] = cur['end_sec']
        prev['text'] = prev['text'].strip() + text
        merge_count += 1
        i += 1

def _split_long_srt_segments(srt_path: str, min_dur_to_split: float=3.0, min_chars_to_split: int=20, log_cb: Callable[[str], None] | None=None):
    entries = _parse_srt(srt_path)
    if entries:
        new_entries = []
        split_count = 0
        for entry in entries:
            dur = entry['end_sec'] - entry['start_sec']
            text = entry['text'].strip()
            if dur < min_dur_to_split or len(text) < min_chars_to_split:
                new_entries.append(entry)
            else:
                parts = re.split('(?<=[,;，；。！？!?])\\s*', text)
                parts = [p.strip() for p in parts if p.strip()]
                if len(parts) <= 1:
                    new_entries.append(entry)
                else:
                    total_chars = sum((len(p) for p in parts))
                    if total_chars == 0:
                        new_entries.append(entry)
                    else:
                        cursor = entry['start_sec']
                        for p in parts:
                            ratio = len(p) / total_chars
                            part_dur = dur * ratio
                            new_entries.append({'index': 0, 'start_sec': cursor, 'end_sec': cursor + part_dur, 'text': p})
                            cursor += part_dur
                        split_count += 1
        if split_count == 0:
            pass
        else:
            for i, e in enumerate(new_entries, start=1):
                e['index'] = i
            with open(srt_path, 'w', encoding='utf-8') as f:
                for e in new_entries:
                    start = _seconds_to_srt_time(e['start_sec'])
                    end = _seconds_to_srt_time(e['end_sec'])
                    f.write(f"{e['index']}\n{start} --> {end}\n{e['text']}\n\n")
            _log(log_cb, f'   ✂️ Đã tách {split_count} dòng sub dài → {len(new_entries)} dòng')