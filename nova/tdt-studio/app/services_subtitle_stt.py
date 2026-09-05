from __future__ import annotations
import subprocess
import tempfile
import threading
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from config import FFMPEG_PATH
from core.api_keys import api_blocked_user_hint, parse_api_key_pool
from core.subtitle_translation import SubtitleJobCancelled
from core.subtitles import SubtitleDocument, SubtitleSegment
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
_LOCAL_MODELS: 'dict[tuple[str, str, str], object]' = {}

@dataclass(frozen=True, slots=True)
class SpeechSettings:
    engine: 'str' = 'groq'
    language: 'str' = 'auto'
    model: 'str' = 'whisper-large-v3-turbo'

    def validated(self) -> SpeechSettings:
        if self.engine not in frozenset({'deepgram', 'groq', 'local'}):
            raise ValueError('Bộ nhận dạng giọng nói không hợp lệ')
        if self.model.strip():
            return self
        raise ValueError('Chưa chọn model nhận dạng')

def transcribe_video(video_path: str, settings: SpeechSettings, *, api_key: str, progress: Callable[[int], None] | None, stop_event: threading.Event | None, session, audio_runner, local_transcriber) -> SubtitleDocument:
    options = settings.validated()
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        key = api_key.strip()
        if options.engine == 'groq' and (not key):
            raise ValueError('Chưa nhập khóa API Groq cá nhân')
        if options.engine != 'deepgram' or key:
            groq_keys = parse_api_key_pool(key) if options.engine == 'groq' else []
            dg_keys = parse_api_key_pool(key) if options.engine == 'deepgram' else []
            if options.engine == 'groq' and (not groq_keys):
                raise ValueError('Chưa nhập khóa API Groq cá nhân')
            if options.engine != 'deepgram' or dg_keys:
                stop = stop_event or threading.Event()
                _raise_if_cancelled(stop)
                _emit(progress, 0)
                run_audio = audio_runner or _run_ffmpeg_audio
                with tempfile.TemporaryDirectory(prefix='videotools-stt-') as temp_name:
                    temp_dir = Path(temp_name)
                    audio_path = temp_dir / 'audio-16k-mono.wav'
                    command = [FFMPEG_PATH, '-y', '-nostdin', '-i', str(source), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(audio_path)]
                    run_audio(command, stop)
                    _raise_if_cancelled(stop)
                    if not audio_path.is_file() or audio_path.stat().st_size == 0:
                        raise RuntimeError('Không tách được âm thanh từ video')
                    _emit(progress, 15)
                    if options.engine == 'local':
                        runner = local_transcriber or _transcribe_local
                        raw_segments = runner(audio_path, options, progress, stop)
                        _raise_if_cancelled(stop)
                        segments = _subtitle_segments(raw_segments)
                    elif options.engine == 'deepgram':
                        import requests
                        from providers.speech.deepgram import transcribe_wav
                        client = session or requests.Session()
                        chunks = _split_wav(audio_path, temp_dir)
                        segments = []
                        last_error = None
                        for dg_key in dg_keys:
                            try:
                                segments = []
                                for index, (chunk_path, offset_ms) in enumerate(chunks):
                                    _raise_if_cancelled(stop)
                                    raw_segments = transcribe_wav(chunk_path, options, dg_key, client)
                                    segments.extend(_subtitle_segments(raw_segments, offset_ms=offset_ms))
                                    _raise_if_cancelled(stop)
                                    _emit(progress, 15 + round((index + 1) * 80 / len(chunks)))
                                last_error = None
                                break
                            except RuntimeError as exc:
                                last_error = exc
                                message = str(exc).lower()
                                if '429' in message or 'giới hạn' in message:
                                    continue
                                if 'không hợp lệ' in message or '403' in message:
                                    continue
                                raise
                    else:
                        import requests
                        client = session or requests.Session()
                        chunks = _split_wav(audio_path, temp_dir)
                        segments = []
                        last_error = None
                        for groq_key in groq_keys:
                            try:
                                segments = []
                                for index, (chunk_path, offset_ms) in enumerate(chunks):
                                    _raise_if_cancelled(stop)
                                    raw_segments = _transcribe_groq_chunk(chunk_path, options, groq_key, client)
                                    segments.extend(_subtitle_segments(raw_segments, offset_ms=offset_ms))
                                    _raise_if_cancelled(stop)
                                    _emit(progress, 15 + round((index + 1) * 80 / len(chunks)))
                                last_error = None
                                break
                            except RuntimeError as exc:
                                last_error = exc
                                message = str(exc).lower()
                                if '429' in message or 'giới hạn' in message:
                                    continue
                                if 'không hợp lệ' in message or '403' in message:
                                    continue
                                raise
            else:
                raise ValueError('Chưa nhập khóa API Deepgram cá nhân')
        else:
            raise ValueError('Chưa nhập khóa API Deepgram cá nhân')
    else:
        raise ValueError('Video dùng để nhận dạng không tồn tại')
    if last_error is not None:
        raise RuntimeError(api_blocked_user_hint('Groq' if options.engine == 'groq' else 'Deepgram', len(groq_keys or dg_keys))) from last_error
    if segments:
        _emit(progress, 100)
        return SubtitleDocument(tuple(segments))
    raise RuntimeError('Không nhận dạng được câu nói nào trong video')

def _transcribe_groq_chunk(audio_path: Path, settings: SpeechSettings, api_key: str, session) -> list[dict]:
    data = {'model': settings.model, 'response_format': 'verbose_json', 'temperature': '0', 'timestamp_granularities[]': 'word'}
    language = settings.language.strip()
    if language and language != 'auto':
        data['language'] = language
    try:
        with audio_path.open('rb') as audio:
            response = session.post(GROQ_TRANSCRIPTION_URL, headers={'Authorization': f'Bearer {api_key}'}, data=data, files={'file': (audio_path.name, audio, 'audio/wav')}, timeout=240)
    except Exception as exc:
        raise RuntimeError('Không kết nối được dịch vụ nhận dạng Groq') from exc
    status = int(getattr(response, 'status_code', 0) or 0)
    if status in frozenset({401, 403}):
        raise RuntimeError('Khóa API Groq không hợp lệ hoặc chưa có quyền')
    if status == 429:
        raise RuntimeError('Groq đang giới hạn lượt gọi (429)')
    if status >= 500:
        raise RuntimeError('Dịch vụ nhận dạng Groq đang tạm lỗi')
    if 200 <= status < 300:
        try:
            payload = response.json()
            segments = payload.get('segments', [])
            root_words = payload.get('words')
        except Exception as exc:
            raise RuntimeError('Groq trả về dữ liệu không đọc được') from exc
        if isinstance(segments, list):
            if isinstance(root_words, list) and root_words:
                for seg in segments:
                    if not isinstance(seg, dict) or (isinstance(seg.get('words'), list) and seg['words']):
                        continue
                    try:
                        s0 = float(seg.get('start', 0))
                        s1 = float(seg.get('end', 0))
                        bucket = []
                        for w in root_words:
                            if isinstance(w, dict):
                                try:
                                    ws = float(w.get('start', -1))
                                    we = float(w.get('end', -1))
                                    if we < s0 - 0.02 or ws > s1 + 0.02:
                                        pass
                                    else:
                                        bucket.append(w)
                                except (TypeError, ValueError):
                                    pass
                        if bucket:
                            seg['words'] = bucket
                    except (TypeError, ValueError):
                        pass
            return segments
        raise RuntimeError('Groq trả về dữ liệu nhận dạng không hợp lệ')
    raise RuntimeError('Groq từ chối tệp âm thanh')

def _transcribe_local(audio_path: Path, settings: SpeechSettings, progress: Callable[[int], None] | None, stop_event: threading.Event) -> list[dict]:
    try:
        import torch
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError('Model nhận dạng cục bộ chưa được cài trong runtime') from exc
    device, compute_type = ('cuda', 'float16') if torch.cuda.is_available() else ('cpu', 'int8')
    model_name = settings.model.strip()
    cache_key = (model_name, device, compute_type)
    model = _LOCAL_MODELS.get(cache_key)
    if model is None:
        _raise_if_cancelled(stop_event)
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        _LOCAL_MODELS[cache_key] = model
    _emit(progress, 35)
    language = settings.language.strip()
    generated, _info = model.transcribe(str(audio_path), language=None if not language or language == 'auto' else language, beam_size=5, word_timestamps=True, vad_filter=True)
    result = []
    for segment in generated:
        _raise_if_cancelled(stop_event)
        words = []
        for w in getattr(segment, 'words', None) or ():
            try:
                words.append({'word': str(getattr(w, 'word', '') or '').strip(), 'start': float(getattr(w, 'start', 0) or 0), 'end': float(getattr(w, 'end', 0) or 0)})
            except (TypeError, ValueError):
                continue
        result.append({'start': float(segment.start), 'end': float(segment.end), 'text': str(segment.text), 'words': words})
    _emit(progress, 95)
    return result

def _extract_words(raw: dict, *, offset_ms: int) -> tuple:
    from core.subtitles import SubtitleWord
    words_raw = raw.get('words')
    if isinstance(words_raw, list) and words_raw:
        result = []
        for item in words_raw:
            text = str(item.get('word') or item.get('text') or '').strip()
            if isinstance(item, dict) and text:
                try:
                    start_ms = offset_ms + round(float(item.get('start', 0)) * 1000)
                    end_ms = offset_ms + round(float(item.get('end', 0)) * 1000)
                    if end_ms <= start_ms:
                        end_ms = start_ms + 80
                    try:
                        result.append(SubtitleWord(text, start_ms, end_ms).validated())
                    except ValueError:
                        pass
                except (TypeError, ValueError):
                    pass
        return tuple(result)
    return ()

def _subtitle_segments(raw_segments, *, offset_ms: int) -> list[SubtitleSegment]:
    result = []
    for raw in raw_segments or ():
        if isinstance(raw, dict):
            text = str(raw.get('text', '')).strip()
            try:
                start_ms = offset_ms + round(float(raw.get('start', 0)) * 1000)
                end_ms = offset_ms + round(float(raw.get('end', 0)) * 1000)
                if not text or end_ms <= start_ms:
                    pass
                else:
                    words = _extract_words(raw, offset_ms=offset_ms)
                    result.append(SubtitleSegment(start_ms, end_ms, text, words))
            except (TypeError, ValueError):
                pass
    return result

def _split_wav(source: Path, temp_dir: Path, *, max_seconds: int) -> list[tuple[Path, int]]:
    with wave.open(str(source), 'rb') as input_wave:
        frame_rate = input_wave.getframerate()
        total_frames = input_wave.getnframes()
        frames_per_chunk = max(1, frame_rate * max_seconds)
        if total_frames <= frames_per_chunk:
            return [(source, 0)]
        params = input_wave.getparams()
        chunks = []
        offset_frames = 0
        chunk_number = 1
        while offset_frames < total_frames:
            data = input_wave.readframes(frames_per_chunk)
            if not data:
                break
            chunk_path = temp_dir / f'audio-part-{chunk_number:03d}.wav'
            with wave.open(str(chunk_path), 'wb') as output_wave:
                output_wave.setparams(params)
                output_wave.writeframes(data)
            chunks.append((chunk_path, round(offset_frames * 1000 / frame_rate)))
            offset_frames += frames_per_chunk
            chunk_number += 1
        return chunks

def _run_ffmpeg_audio(command: list[str], stop_event: threading.Event) -> None:
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors='replace', creationflags=CREATE_NO_WINDOW)
    stderr = ''
    while not stop_event.is_set():
        try:
            _stdout, stderr = process.communicate(timeout=0.2)
            if process.returncode != 0:
                detail = '\n'.join(stderr.strip().splitlines()[-8:])
                raise RuntimeError(detail or 'FFmpeg không tách được âm thanh')
            return None
        except subprocess.TimeoutExpired:
            continue
    _terminate(process)
    raise SubtitleJobCancelled('Đã dừng xử lý phụ đề')

def _terminate(process) -> None:
    try:
        process.terminate()
        process.wait(timeout=2)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass
        return None

def _raise_if_cancelled(stop_event: threading.Event) -> None:
    if stop_event.is_set():
        raise SubtitleJobCancelled('Đã dừng xử lý phụ đề')

def _emit(progress: Callable[[int], None] | None, value: int) -> None:
    if progress is not None:
        progress(max(0, min(100, int(value))))
        return None