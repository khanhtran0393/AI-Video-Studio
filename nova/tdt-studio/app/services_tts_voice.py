from __future__ import annotations
import hashlib
import importlib
import importlib.util
import shutil
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from core.subtitles import SubtitleDocument

@dataclass(frozen=True)
class TTSVoiceSettings:
    engine: 'str' = 'edge'
    voice: 'str' = 'vi-VN-HoaiMyNeural'
    speed: 'float' = 1.0
    pitch: 'int' = 0
    api_key: 'str' = ''
    model_repo: 'str' = ''
    ref_audio: 'str' = ''
    ref_text: 'str' = ''
    smart_voice: 'bool' = True
    proxy: 'str' = ''
    relay_url: 'str' = ''
    relay_secret: 'str' = ''
    max_workers: 'int' = 0
    tts_fit_mode: 'str' = 'stretch_video'
    tts_fit_max_speed: 'float' = 1.2
    lock_lang: 'str' = ''

def generate_tts_voice_track(document: SubtitleDocument, video_path: str, output_dir: str | Path, settings: TTSVoiceSettings, *, progress: Callable[[int], None] | None, stop_event: threading.Event | None, force_new: bool) -> str:
    if document.segments:
        stop = stop_event or threading.Event()
        destination_dir = Path(output_dir).expanduser().resolve()
        destination_dir.mkdir(parents=True, exist_ok=True)
        raw_stem = Path(video_path).stem if video_path else 'tts'
        try:
            from longtieng.media_naming import tts_stem_prefix
            source_name = tts_stem_prefix(raw_stem) if raw_stem else 'tts'
        except ImportError:
            source_name = raw_stem or 'tts'
        from core.tts_voice_key import make_tts_voice_key
        voice_key = make_tts_voice_key(settings.engine, settings.voice, settings.lock_lang)
        output_path = destination_dir / (f'{source_name}_tts_{voice_key}_full.mp3' if voice_key else f'{source_name}_tts_full.mp3')
        segments = [{'start_sec': segment.start_ms / 1000, 'end_sec': segment.end_ms / 1000, 'text': segment.text} for segment in document.segments]
        _validate_engine_runtime(settings)
        last_messages = []

        def _progress(index: int, total: int, message: str='') -> None:
            if stop.is_set():
                raise RuntimeError('Đã dừng tạo giọng đọc')
            if message:
                last_messages.append(str(message))
            if progress is not None:
                progress(round(max(0, index) * 80 / max(1, total)))
                return None
        from longtieng.longtieng_engine import generate_all_voices
        from longtieng.longtieng_merge import build_voice_preview_track
        voice_results = generate_all_voices(segments, engine=settings.engine, voice=settings.voice, speed=settings.speed, pitch=settings.pitch, smart_voice=settings.smart_voice, api_key=settings.api_key, model_repo=settings.model_repo, ref_audio=settings.ref_audio, ref_text=settings.ref_text, progress_cb=_progress, stop_flag=stop, output_dir=str(destination_dir), video_path=video_path, max_workers=settings.max_workers, proxy=settings.proxy, relay_url=settings.relay_url, relay_secret=settings.relay_secret, tts_fit_mode=settings.tts_fit_mode, tts_fit_max_speed=settings.tts_fit_max_speed, force_new=force_new, lang=str(settings.lock_lang or 'vi'), lock_voice_lang=bool(settings.lock_lang))
        if stop.is_set():
            raise RuntimeError('Đã dừng tạo giọng đọc')
        if voice_results:
            if progress is not None:
                progress(85)
            video_dur_sec = _probe_source_video_duration_sec(video_path)
            build_kwargs = {'output_path': str(output_path), 'tts_fit_mode': settings.tts_fit_mode, 'tts_fit_max_speed': settings.tts_fit_max_speed}
            try:
                import inspect
                if 'video_duration_sec' in inspect.signature(build_voice_preview_track).parameters:
                    build_kwargs['video_duration_sec'] = video_dur_sec
            except (TypeError, ValueError):
                pass
            result = build_voice_preview_track(voice_results, **build_kwargs)
            if result:
                result, voice_results = _maybe_retry_faster_edge(result=result, voice_results=voice_results, segments=segments, settings=settings, video_path=video_path, destination_dir=destination_dir, video_dur_sec=video_dur_sec, build_kwargs=build_kwargs, generate_all_voices=generate_all_voices, build_voice_preview_track=build_voice_preview_track, progress_cb=_progress, stop=stop)
                if progress is not None:
                    progress(100)
                try:
                    from core.av_sync import log_avsync_diagnostic, tts_cues_path_for_voice
                    cues_path = tts_cues_path_for_voice(result)
                    log_avsync_diagnostic(f"[AVSync] TTS xong: {result} — sidecar cues {('CÓ' if cues_path.is_file() else 'THIẾU')} ({cues_path.name}) — tts_fit_mode={settings.tts_fit_mode}")
                except Exception as _e_diag:
                    print(f'[AVSync] Không kiểm tra được sidecar cues: {_e_diag}', flush=True)
                _surface_voice_overflow(result)
                return result
            existing = sum((1 for item in voice_results if item.get('audio_path') and Path(str(item['audio_path'])).is_file()))
            from config import FFMPEG_PATH
            ff = Path(FFMPEG_PATH)
            ff_hint = f' Thiếu ffmpeg tại {ff} — máy anh em chạy lại CAI_DAT.bat.' if ff.is_file() else ' FFmpeg ghép preview thất bại (xem log [VoicePreview]).'
            raise RuntimeError(f'Không tạo được file giọng đọc (segment có file: {existing}/{len(voice_results)}).{ff_hint}')
        engine = str(settings.engine).lower()
        voice = str(settings.voice or '').strip()
        detail = ''
        for msg in reversed(last_messages):
            low = msg.casefold()
            if any((token in low for token in ('timeout', 'timed out', 'hết giờ', 'error', 'lỗi', 'thất bại', 'quota', '429', '401', '403', 'unauthorized', 'network', 'mạng', 'api'))):
                detail = f' Chi tiết: {msg}'
        sample_hint = ''
        sample = str(segments[0].get('text') or '')[:48]
        if segments and sample:
            sample_hint = f' Mẫu text: «{sample}».'
        hint = f" Voice hiện tại: '{voice}'.{sample_hint} Giọng phải khớp ngôn ngữ câu (VN≠Trung/Anh). Thử lại hoặc chọn giọng Edge Neural đúng ngôn ngữ (vd vi-VN-HoaiMyNeural / en-US-JennyNeural)." if engine == 'edge' else f" Voice hiện tại: '{voice}'.{sample_hint} CapCut cần giọng bv:/icl:/vn: (vd bv:BV075_streaming). Nếu vừa đổi từ Edge, hãy chọn lại giọng CapCut trong combo." if engine == 'capcut' else f" Voice hiện tại: '{voice}'.{sample_hint}"
        raise RuntimeError(f"Engine TTS '{settings.engine}' không tạo được segment audio nào.{hint}{detail}")
    raise ValueError('Chưa có phụ đề để tạo giọng đọc')

def _cues_for_rate_fit(voice_path: str, voice_results: list[dict]) -> list[dict]:
    try:
        from core.av_sync import load_tts_cues_sidecar
        loaded = load_tts_cues_sidecar(voice_path)
    except Exception:
        loaded = None
    if loaded:
        rows = []
        for item in loaded:
            start = float(item.get('start', 0) or 0)
            end = float(item.get('end', 0) or 0)
            rows.append({'start': start, 'end': end, 'duration': max(0.0, end - start)})
        return rows
    return [dict(item) for item in voice_results or []]

def _ratefit_temp_output_path(canonical: str) -> str:
    dest_dir = Path(canonical).parent
    return str(dest_dir / '.ratefit' / '_merge.mp3')

def _voice_sidecar_trio(voice_path: str) -> tuple[Path, Path, Path]:
    from core.av_sync import tts_cues_path_for_voice
    from longtieng.longtieng_audio_utils import tts_overflow_sidecar_path
    voice = Path(voice_path)
    return (voice, Path(tts_overflow_sidecar_path(str(voice))), Path(tts_cues_path_for_voice(voice)))

def _unlink_ratefit_temp(temp_path: str) -> None:
    for item in _voice_sidecar_trio(temp_path):
        try:
            if item.is_file():
                item.unlink()
        except OSError:
            continue

def _promote_ratefit_temp_to_canonical(temp_path: str, canonical: str) -> str | None:
    temp_mp3, temp_ov, temp_cues = (_voice_sidecar_trio(temp_path)[0], _voice_sidecar_trio(temp_path)[1], _voice_sidecar_trio(temp_path)[2])
    dest_mp3, dest_ov, dest_cues = (_voice_sidecar_trio(canonical)[0], _voice_sidecar_trio(canonical)[1], _voice_sidecar_trio(canonical)[2])
    if not temp_mp3.is_file() or temp_mp3.stat().st_size <= 0:
        return None
    elif temp_ov.is_file() and temp_cues.is_file():
        try:
            temp_mp3.replace(dest_mp3)
            temp_ov.replace(dest_ov)
            temp_cues.replace(dest_cues)
            return str(dest_mp3)
        except OSError:
            _unlink_ratefit_temp(temp_path)
    _unlink_ratefit_temp(temp_path)
_RATEFIT_LOST_MSG = 'Mất file giọng gộp sau khi tạo lại nhanh hơn — chưa xuất được. Bấm Tạo giọng lại.'

def _canonical_voice_present(voice_path: str) -> bool:
    path = Path(voice_path)
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False

def _keep_canonical_or_raise(result: str, voice_results: list[dict]) -> tuple[str, list[dict]]:
    if _canonical_voice_present(result):
        return (result, voice_results)
    raise RuntimeError(_RATEFIT_LOST_MSG)

def _cue_speak_sec(row: dict) -> float:
    dur = float(row.get('duration', 0) or 0)
    if dur > 0:
        return dur
    start = float(row.get('start', 0) or 0)
    end = float(row.get('end', 0) or 0)
    return max(0.0, end - start)

def _thô_speak_sec(rows: list[dict] | None) -> float | None:
    if rows:
        from longtieng.tts_rate_fit import last_voice_chain
        chain = last_voice_chain(list(rows))
        return sum((_cue_speak_sec(row) for row in chain)) if chain else None

def _rate_can_from_cues(cues: list[dict], video_dur_sec: float) -> float | None:
    from longtieng.tts_rate_fit import chain_gap_sec, compute_rate_can, last_voice_chain
    chain = last_voice_chain(cues)
    return compute_rate_can(speak_sec=sum((_cue_speak_sec(row) for row in chain)), video_sec=float(video_dur_sec or 0), neo_sec=float(chain[0].get('start', 0) or 0), gap_sec=chain_gap_sec(chain)) if chain else None

def _format_ratefit_num(value: float | None) -> str:
    if value is None:
        return '—'
    text = f'{value:.6f}'.rstrip('0').rstrip('.')
    return text if text else '0'

def _print_ratefit_line(*, overflow_sec: float | None, rate_can: float | None, speed: float | None, sigma1: float | None, sigma2: float | None, promote: str) -> None:
    print(f'[RateFit] overflow={_format_ratefit_num(overflow_sec)} → rate_can={_format_ratefit_num(rate_can)} → speed={_format_ratefit_num(speed)} · Σ thô lượt1={_format_ratefit_num(sigma1)} → lượt2={_format_ratefit_num(sigma2)} · promote={promote}', flush=True)

def _maybe_retry_faster_edge(*, result: str, voice_results: list[dict], segments: list[dict], settings: TTSVoiceSettings, video_path: str, destination_dir: Path, video_dur_sec: float, build_kwargs: dict, generate_all_voices, build_voice_preview_track, progress_cb, stop: threading.Event) -> tuple[str, list[dict]]:
    try:
        from longtieng.longtieng_audio_utils import read_tts_overflow_sidecar
        from longtieng.tts_rate_fit import retry_edge_speed, should_retry_edge_rate
    except Exception:
        return (result, voice_results)
    overflow_sec = read_tts_overflow_sidecar(result)
    cues = _cues_for_rate_fit(result, voice_results)
    retry_speed = retry_edge_speed(cues, video_dur_sec=video_dur_sec, max_speed=settings.tts_fit_max_speed)
    if should_retry_edge_rate(overflow_sec=overflow_sec, engine=settings.engine, fit_mode=settings.tts_fit_mode, retry_speed=retry_speed, max_speed=settings.tts_fit_max_speed):
        ratefit_dir = Path(destination_dir) / '.ratefit'
        ratefit_promote = 'FAIL'
        rate_can = _rate_can_from_cues(cues, video_dur_sec)
        sigma1 = _thô_speak_sec(voice_results)
        second = None
        try:
            if stop.is_set():
                raise RuntimeError('Đã dừng tạo giọng đọc')
            ratefit_dir.mkdir(parents=True, exist_ok=True)
            second = generate_all_voices(segments, engine=settings.engine, voice=settings.voice, speed=float(retry_speed), pitch=settings.pitch, smart_voice=settings.smart_voice, api_key=settings.api_key, model_repo=settings.model_repo, ref_audio=settings.ref_audio, ref_text=settings.ref_text, progress_cb=progress_cb, stop_flag=stop, output_dir=str(ratefit_dir), video_path=video_path, max_workers=settings.max_workers, proxy=settings.proxy, relay_url=settings.relay_url, relay_secret=settings.relay_secret, tts_fit_mode=settings.tts_fit_mode, tts_fit_max_speed=settings.tts_fit_max_speed, force_new=True, lang=str(settings.lock_lang or 'vi'), lock_voice_lang=bool(settings.lock_lang))
            if stop.is_set():
                raise RuntimeError('Đã dừng tạo giọng đọc')
            if second:
                second_out = _ratefit_temp_output_path(result)
                second_kwargs = dict(build_kwargs, output_path=second_out)
                second_path = build_voice_preview_track(second, **second_kwargs)
                if second_path:
                    promoted = _promote_ratefit_temp_to_canonical(second_path, result)
                    if promoted:
                        ratefit_promote = 'OK'
                    else:
                        return _keep_canonical_or_raise(result, voice_results)
                else:
                    _unlink_ratefit_temp(second_out)
                    return _keep_canonical_or_raise(result, voice_results)
            else:
                return _keep_canonical_or_raise(result, voice_results)
        finally:
            _print_ratefit_line(overflow_sec=overflow_sec, rate_can=rate_can, speed=retry_speed, sigma1=sigma1, sigma2=_thô_speak_sec(second), promote=ratefit_promote)
            shutil.rmtree(ratefit_dir, ignore_errors=True)
    else:
        return (result, voice_results)

def _probe_source_video_duration_sec(video_path: str) -> float:
    text = str(video_path or '').strip()
    if text:
        path = Path(text)
        if path.is_file():
            duration = 0.0
            try:
                from services_media import probe_media_info
                info = probe_media_info(str(path))
                duration = max(0.0, float(info.duration_ms or 0) / 1000.0)
            except Exception:
                duration = 0.0
            if duration == 0.0:
                print('Không đo được độ dài video nguồn — không cảnh báo tràn.', flush=True)
            return duration
    return 0.0

def _surface_voice_overflow(voice_path: str) -> None:
    try:
        from longtieng.longtieng_audio_utils import VOICE_OVERFLOW_WARN_SEC, format_voice_overflow_warning, read_tts_overflow_sidecar
        overflow_sec = read_tts_overflow_sidecar(voice_path)
        if overflow_sec > VOICE_OVERFLOW_WARN_SEC:
            print(format_voice_overflow_warning(overflow_sec), flush=True)
        else:
            return None
    except Exception:
        pass

def _preview_output_dir(base: Path, settings: TTSVoiceSettings) -> Path:
    key = f'{settings.engine}|{settings.voice}|{settings.speed}|{settings.pitch}'
    tag = hashlib.sha1(key.encode('utf-8')).hexdigest()[:10]
    dest = base / tag
    dest.mkdir(parents=True, exist_ok=True)
    return dest

def preview_tts_sample(text: str, settings: TTSVoiceSettings, output_dir: str | Path) -> str:
    from core.subtitles import SubtitleSegment
    from longtieng.longtieng_audio_utils import _clean_text_for_tts
    sample = (text or '').strip() or 'Xin chào, đây là giọng thử.'
    cleaned = _clean_text_for_tts(sample)
    if cleaned:
        document = SubtitleDocument((SubtitleSegment(0, 2500, cleaned),))
        dest = _preview_output_dir(Path(output_dir).expanduser(), settings)
        return generate_tts_voice_track(document, video_path='preview', output_dir=str(dest), settings=settings, force_new=True)
    raise RuntimeError('Nội dung thử giọng rỗng sau khi làm sạch (tránh ký tự chỉ là ký hiệu / dấu chấm).')

def _module_available(name: str) -> bool:
    if importlib.util.find_spec(name) is not None:
        pass
    else:
        try:
            importlib.import_module(name)
        except Exception:
            return False
    return True

def _validate_engine_runtime(settings: TTSVoiceSettings) -> None:
    required_modules = {'edge': 'edge_tts', 'vbee': 'requests', 'fpt': 'requests', 'elevenlabs': 'requests', 'zalo': 'requests', 'minimax': 'requests', 'siliconflow': 'requests', 'deepgram': 'requests'}
    module_name = required_modules.get(settings.engine)
    if module_name:
        if _module_available(module_name):
            return None
        package = 'edge-tts' if module_name == 'edge_tts' else module_name
        raise RuntimeError(f"Thiếu thư viện cho engine '{settings.engine}'. Hãy cài bằng: python -m pip install {package}")