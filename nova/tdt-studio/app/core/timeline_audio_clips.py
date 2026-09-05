'Timeline audio clips động — CapCut: tách âm → tạo track mới, không cố định cứng.\n\nMỗi lần tách giọng/nhạc tạo (hoặc cập nhật) clip âm trên timeline.\n'
from __future__ import annotations
import uuid
from dataclasses import dataclass
from typing import Any
TIMELINE_AUDIO_CLIPS_KEY = 'timeline_audio_clips'

@dataclass(frozen=True)
class TimelineAudioClip:
    id: 'str'
    path: 'str'
    kind: 'str'
    label: 'str'
    timeline_start_ms: 'int' = 0
    duration_ms: 'int' = 0
    volume_percent: 'int' = 100
    source_clip_id: 'str' = ''
    enabled: 'bool' = True

    def to_dict(self) -> dict[str, object]:
        return {'id': self.id, 'path': str(self.path or ''), 'kind': str(self.kind or 'detached'), 'label': str(self.label or 'Âm thanh'), 'timeline_start_ms': int(self.timeline_start_ms), 'duration_ms': int(self.duration_ms), 'volume_percent': int(self.volume_percent), 'source_clip_id': str(self.source_clip_id or ''), 'enabled': bool(self.enabled)}

def new_audio_clip_id() -> str:
    return f'aclip-{uuid.uuid4().hex[:10]}'

def audio_clip_from_dict(raw: object) -> TimelineAudioClip | None:
    if isinstance(raw, dict):
        path = str(raw.get('path') or '').strip()
        if path:
            kind = str(raw.get('kind') or 'detached').strip().lower()
            if kind not in frozenset({'vocal', 'detached', 'instrumental'}):
                kind = 'detached'
            try:
                vol = max(0, min(100, int(raw.get('volume_percent', 100) or 100)))
            except (TypeError, ValueError):
                vol = 100
            try:
                start = max(0, int(raw.get('timeline_start_ms', 0) or 0))
                dur = max(0, int(raw.get('duration_ms', 0) or 0))
            except (TypeError, ValueError):
                start, dur = ((0, 0)[0], (0, 0)[1])
            return TimelineAudioClip(id=str(raw.get('id') or '').strip() or new_audio_clip_id(), path=path, kind=kind, label=str(raw.get('label') or 'Âm thanh').strip() or 'Âm thanh', timeline_start_ms=start, duration_ms=dur, volume_percent=vol, source_clip_id=str(raw.get('source_clip_id') or ''), enabled=bool(raw.get('enabled', True)))

def audio_clips_from_values(values: dict[str, Any]) -> list[TimelineAudioClip]:
    raw = values.get(TIMELINE_AUDIO_CLIPS_KEY)
    if isinstance(raw, list):
        out = []
        for item in raw:
            clip = audio_clip_from_dict(item)
            if clip is None:
                pass
            else:
                out.append(clip)
        return out
    return []

def write_audio_clips(values: dict[str, Any], clips: list[TimelineAudioClip]) -> list[TimelineAudioClip]:
    values[TIMELINE_AUDIO_CLIPS_KEY] = [c.to_dict() for c in clips]
    return list(clips)

def heal_stem_spans_to_duration(values: dict[str, Any], duration_ms: int) -> list[TimelineAudioClip]:
    total = max(1, int(duration_ms or 0))
    clips = audio_clips_from_values(values)
    changed = False
    out = []
    for clip in clips:
        if clip.kind in frozenset({'vocal', 'instrumental'}) and (clip.timeline_start_ms != 0 or clip.duration_ms != total):
            out.append(TimelineAudioClip(id=clip.id, path=clip.path, kind=clip.kind, label=clip.label, timeline_start_ms=0, duration_ms=total, volume_percent=clip.volume_percent, source_clip_id=clip.source_clip_id, enabled=clip.enabled))
            changed = True
        else:
            out.append(clip)
    if changed:
        write_audio_clips(values, out)
    return out

def upsert_stem_audio_tracks(values: dict[str, Any], *, mode: str, vocal_path: str, instrumental_path: str, timeline_start_ms: int, duration_ms: int, source_clip_id: str) -> list[TimelineAudioClip]:
    mode_key = str(mode or 'both').strip().lower()
    kept = [c for c in audio_clips_from_values(values) if c.kind == 'detached']
    start = max(0, int(timeline_start_ms))
    dur = max(0, int(duration_ms))
    src = str(source_clip_id or '')
    out = list(kept)
    vocal_vol = 100 if mode_key in frozenset({'vocal', 'both'}) else 0
    inst_vol = 100 if mode_key in frozenset({'instrumental', 'both', 'music'}) else 0
    if str(vocal_path or '').strip() and mode_key in frozenset({'vocal', 'both'}):
        out.append(TimelineAudioClip(id=new_audio_clip_id(), path=str(vocal_path), kind='vocal', label='Giọng tách', timeline_start_ms=start, duration_ms=dur, volume_percent=vocal_vol, source_clip_id=src, enabled=vocal_vol > 0))
    if str(instrumental_path or '').strip() and mode_key in frozenset({'instrumental', 'both', 'music'}):
        out.append(TimelineAudioClip(id=new_audio_clip_id(), path=str(instrumental_path), kind='instrumental', label='Nhạc tách', timeline_start_ms=start, duration_ms=dur, volume_percent=inst_vol, source_clip_id=src, enabled=inst_vol > 0))
    written = write_audio_clips(values, out)
    sync_mix_volumes_from_audio_clips(values)
    return written

def sync_mix_volumes_from_audio_clips(values: dict[str, Any]) -> None:
    from core.audio_mix_state import sync_legacy_audio_keys
    vocal = None
    inst = None
    for clip in audio_clips_from_values(values):
        if clip.kind == 'vocal':
            vocal = clip
        elif clip.enabled and clip.kind == 'instrumental':
            inst = clip
    if vocal is not None:
        values['video_vocal_enabled'] = int(vocal.volume_percent) > 0
        values['video_vocal_volume'] = int(vocal.volume_percent)
    if inst is not None:
        values['video_bgm_enabled'] = int(inst.volume_percent) > 0
        values['video_bgm_volume'] = int(inst.volume_percent)
    if vocal is not None or inst is not None:
        sync_legacy_audio_keys(values)
        return None

def find_audio_clip(clips: list[TimelineAudioClip], clip_id: str) -> TimelineAudioClip | None:
    cid = str(clip_id or '').strip()
    return next((clip for clip in clips if clip.id == cid), None) if cid else None

def set_audio_clip_volume(values: dict[str, Any], clip_id: str, volume_percent: int) -> list[TimelineAudioClip]:
    from dataclasses import replace
    vol = max(0, min(100, int(volume_percent)))
    out = []
    for clip in audio_clips_from_values(values):
        if clip.id == str(clip_id):
            out.append(replace(clip, volume_percent=vol, enabled=vol > 0))
        else:
            out.append(clip)
    write_audio_clips(values, out)
    sync_mix_volumes_from_audio_clips(values)
    return out