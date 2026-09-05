'Khớp chuẩn ba trục: **âm thanh · hình · phụ đề**.\n\nInvariant xuất (TTS dub):\n1. Timeline giọng (sau soft-fit + cascade) là **nguồn sự thật** cho khi nói gì.\n2. Phụ đề burn theo timeline giọng (sidecar cues), rồi chia cùng atempo giọng.\n3. Hình chỉ giãn/nén (setpts) để **cùng độ dài** với giọng — không override mốc chữ.\n\nKhông được remape phụ đề chỉ theo setpts nguồn khi track TTS đã cascade\n(dời câu) — sẽ lệch chữ–giọng dù độ dài video đã khớp.\n'
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from core.subtitles import SubtitleDocument, SubtitleSegment
TTS_CUES_SUFFIX = '.tts_cues.json'

def log_avsync_diagnostic(message: str) -> None:
    entry = f"[{datetime.now().strftime('%H:%M:%S')}] {message}"
    try:
        with (Path.cwd() / 'log.txt').open('a', encoding='utf-8') as handle:
            handle.write(entry + '\n\n')
    except OSError:
        pass
    print(entry, flush=True)

def tts_cues_path_for_voice(voice_path: str | Path) -> Path:
    path = Path(voice_path).expanduser()
    return path.with_name(path.name + TTS_CUES_SUFFIX)

def save_tts_cues_sidecar(voice_path: str | Path, segments: Iterable[dict], *, fit_mode: str) -> str | None:
    path = Path(voice_path).expanduser()
    if path.is_file():
        cues = []
        for item in segments:
            try:
                start = float(item.get('start', 0) or 0)
                dur = float(item.get('duration', 0) or 0)
                end_raw = item.get('end')
                end = float(end_raw) if end_raw is not None else start + dur
                if end <= start:
                    end = start + max(dur, 0.05)
                text = str(item.get('text') or item.get('translated') or '').strip()
                cues.append({'start': round(start, 4), 'end': round(end, 4), 'text': text})
            except (TypeError, ValueError):
                continue
    else:
        return None
    if cues:
        dest = tts_cues_path_for_voice(path)
        payload = {'version': 1, 'fit_mode': str(fit_mode or ''), 'voice_file': path.name, 'cues': cues, 'lock': 'audio_image_subtitle'}
        dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        return str(dest)

def load_tts_cues_sidecar(voice_path: str | Path) -> list[dict[str, Any]] | None:
    dest = tts_cues_path_for_voice(voice_path)
    if dest.is_file():
        try:
            data = json.loads(dest.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            return None
        cues = data.get('cues') if isinstance(data, dict) else None
        if isinstance(cues, list) and cues:
            cleaned = []
            for item in cues:
                if isinstance(item, dict):
                    try:
                        start = float(item.get('start', 0) or 0)
                        end = float(item.get('end', 0) or 0)
                        if end <= start:
                            pass
                        else:
                            cleaned.append({'start': start, 'end': end, 'text': str(item.get('text') or '').strip()})
                    except (TypeError, ValueError):
                        pass
            return cleaned or None

def document_locked_to_voice_cues(document: SubtitleDocument | None, cues: list[dict[str, Any]], *, time_divisor: float) -> SubtitleDocument:
    divisor = float(time_divisor)
    if divisor <= 0:
        raise ValueError('time_divisor phải > 0')
    src_texts = []
    if document is not None:
        for seg in document.segments:
            try:
                src_texts.append(seg.validated().text)
            except ValueError:
                src_texts.append(str(seg.text or '').strip())
    mapped = []
    for index, cue in enumerate(cues):
        if src_texts and index >= len(src_texts):
            break
        start_sec = float(cue.get('start', 0) or 0)
        end_sec = float(cue.get('end', 0) or 0)
        out_start = max(0, int(round(start_sec * 1000 / divisor)))
        out_end = max(out_start + 1, int(round(end_sec * 1000 / divisor)))
        text = ''
        if index < len(src_texts):
            text = src_texts[index]
        if not text:
            text = str(cue.get('text') or '').strip()
        if end_sec > start_sec and text:
            mapped.append(SubtitleSegment(out_start, out_end, text))
    return SubtitleDocument(tuple(mapped), getattr(document, 'source_path', None))

def prefer_voice_locked_subtitles(*, tts_fit_mode: str, voice_enabled: bool, voice_path: str) -> bool:
    if voice_enabled and str(voice_path or '').strip():
        mode = str(tts_fit_mode or '').strip().lower()
        return mode in frozenset({'stretch_video', 'none'})
    return False

def resolve_voice_locked_document(document: SubtitleDocument | None, values: dict[str, object] | None, *, time_divisor: float) -> SubtitleDocument | None:
    bag = values or {}
    voice_path = str(bag.get('voice_audio_path') or '').strip()
    voice_on = bool(bag.get('voice_audio_enabled', True)) and bool(voice_path)
    if prefer_voice_locked_subtitles(tts_fit_mode=str(bag.get('tts_fit_mode', 'stretch_video') or ''), voice_enabled=voice_on, voice_path=voice_path):
        cues = load_tts_cues_sidecar(voice_path)
        if cues:
            locked = document_locked_to_voice_cues(document, cues, time_divisor=float(time_divisor or 1.0))
            if locked.segments:
                return locked
        else:
            return None
    else:
        return None

def apply_voice_locked_subtitles_to_values(document: SubtitleDocument | None, values: dict[str, object]) -> SubtitleDocument | None:
    locked = resolve_voice_locked_document(document, values, time_divisor=1.0)
    if locked is None:
        return None
    values['subtitle_voice_locked'] = True
    return locked

def preview_stretch_active(*, source_duration_ms: int, voice_duration_ms: int, tts_fit_mode: str) -> bool:
    mode = str(tts_fit_mode or '').strip().lower()
    if mode not in frozenset({'stretch_video', 'none'}):
        return False
    src_dur = max(0, int(source_duration_ms))
    voice_dur = max(0, int(voice_duration_ms))
    return src_dur > 0 and voice_dur > src_dur + 250

def preview_voice_tempo_rate(*, source_duration_ms: int, voice_duration_ms: int, tts_fit_mode: str) -> float:
    if preview_stretch_active(source_duration_ms=source_duration_ms, voice_duration_ms=voice_duration_ms, tts_fit_mode=tts_fit_mode):
        src_dur = float(max(1, int(source_duration_ms)))
        voice_dur = float(max(1, int(voice_duration_ms)))
        return max(1.0, min(4.0, voice_dur / src_dur))
    return 1.0

def preview_voice_seek_ms(source_position_ms: int, *, source_duration_ms: int, voice_duration_ms: int, tts_fit_mode: str) -> int:
    src_pos = max(0, int(source_position_ms))
    src_dur = max(0, int(source_duration_ms))
    voice_dur = max(0, int(voice_duration_ms))
    if preview_stretch_active(source_duration_ms=src_dur, voice_duration_ms=voice_dur, tts_fit_mode=tts_fit_mode):
        mapped = int(round(src_pos * (voice_dur / float(src_dur))))
        return max(0, min(voice_dur, mapped))
    return src_pos