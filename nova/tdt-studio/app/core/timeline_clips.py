'Timeline video clips — CapCut-lite: tách / xóa / kéo cạnh / reorder / transform.\n\nPhase A–D: nhiều clip cùng file nguồn + transform theo clip.\n'
from __future__ import annotations
import uuid
from dataclasses import dataclass, replace
from typing import Any
MIN_CLIP_DURATION_MS = 200
MAX_SAFE_TIMELINE_CLIPS = 48
TIMELINE_CLIPS_KEY = 'timeline_clips'
SELECTED_CLIP_KEY = 'selected_timeline_clip_id'
SELECTED_CLIP_IDS_KEY = 'selected_timeline_clip_ids'
MAX_VIDEO_TRACKS = 3
_TRANSFORM_KEYS = ('scale_percent', 'scale_x_percent', 'scale_y_percent', 'offset_x', 'offset_y')

@dataclass(frozen=True)
class TimelineClip:
    id: 'str'
    source_in_ms: 'int'
    source_out_ms: 'int'
    timeline_start_ms: 'int' = 0
    source_path: 'str' = ''
    track_index: 'int' = 0
    volume_percent: 'int' = 100
    scale_percent: 'int' = 100
    scale_x_percent: 'int' = 100
    scale_y_percent: 'int' = 100
    offset_x: 'int' = 0
    offset_y: 'int' = 0
    mirror_hflip: 'bool' = False
    video_trim_head_ms: 'int' = 0
    video_trim_tail_ms: 'int' = 0
    warp_x_percent: 'int' = 100
    warp_y_percent: 'int' = 100

    @property
    def duration_ms(self) -> int:
        return max(1, int(self.source_out_ms) - int(self.source_in_ms))

    def video_play_window_ms(self) -> tuple[int, int]:
        inn = int(self.source_in_ms) + max(0, int(self.video_trim_head_ms))
        out = int(self.source_out_ms) - max(0, int(self.video_trim_tail_ms))
        return (int(self.source_in_ms), int(self.source_out_ms)) if out <= inn else (inn, out)

    def source_ms_at_local(self, local_ms: int) -> int:
        inn, out = self.video_play_window_ms()
        src_dur = max(1, out - inn)
        tl_dur = max(1, self.duration_ms)
        local = min(tl_dur - 1, max(0, int(local_ms)))
        return inn + int(round(local * src_dur / float(tl_dur)))

    def video_stretch_rate(self) -> float:
        play_in, play_out = self.video_play_window_ms()
        src = max(1, play_out - play_in)
        tl = max(1, self.duration_ms)
        return 1.0 if abs(src - tl) <= 8 else max(0.25, min(4.0, src / float(tl)))

    def to_dict(self) -> dict[str, object]:
        return {'id': self.id, 'source_in_ms': int(self.source_in_ms), 'source_out_ms': int(self.source_out_ms), 'timeline_start_ms': int(self.timeline_start_ms), 'source_path': str(self.source_path or ''), 'track_index': int(self.track_index), 'volume_percent': int(self.volume_percent), 'scale_percent': int(self.scale_percent), 'scale_x_percent': int(self.scale_x_percent), 'scale_y_percent': int(self.scale_y_percent), 'offset_x': int(self.offset_x), 'offset_y': int(self.offset_y), 'mirror_hflip': bool(self.mirror_hflip), 'video_trim_head_ms': int(self.video_trim_head_ms), 'video_trim_tail_ms': int(self.video_trim_tail_ms), 'warp_x_percent': int(self.warp_x_percent), 'warp_y_percent': int(self.warp_y_percent)}

    def with_transform_from_values(self, values: dict[str, Any]) -> TimelineClip:
        scale = max(10, min(500, int(values.get('scale_percent', self.scale_percent) or 100)))
        sx = max(10, min(500, int(values.get('scale_x_percent', values.get('scale_percent', scale)) or scale)))
        sy = max(10, min(500, int(values.get('scale_y_percent', values.get('scale_percent', scale)) or scale)))
        return replace(self, scale_percent=scale, scale_x_percent=sx, scale_y_percent=sy, offset_x=int(values.get('offset_x', self.offset_x) or 0), offset_y=int(values.get('offset_y', self.offset_y) or 0))

def new_clip_id() -> str:
    return f'tclip-{uuid.uuid4().hex[:10]}'

def _clamp_int(value: object, lo: int, hi: int, default: int) -> int:
    try:
        pass
    except (TypeError, ValueError):
        return default

def clip_from_dict(raw: object) -> TimelineClip | None:
    if isinstance(raw, dict):
        try:
            source_in = max(0, int(raw.get('source_in_ms', 0) or 0))
            source_out = max(source_in + 1, int(raw.get('source_out_ms', source_in + 1) or 0))
        except (TypeError, ValueError):
            pass
        clip_id = str(raw.get('id') or '').strip() or new_clip_id()
        timeline_start = _clamp_int(raw.get('timeline_start_ms', 0), 0, 86400000, 0)
        track_index = _clamp_int(raw.get('track_index', 0), 0, MAX_VIDEO_TRACKS - 1, 0)
        volume_percent = _clamp_int(raw.get('volume_percent', 100), 0, 100, 100)
        scale = _clamp_int(raw.get('scale_percent', 100), 10, 500, 100)
        sx = _clamp_int(raw.get('scale_x_percent', scale), 10, 500, scale)
        sy = _clamp_int(raw.get('scale_y_percent', scale), 10, 500, scale)
        return TimelineClip(id=clip_id, source_in_ms=source_in, source_out_ms=source_out, timeline_start_ms=timeline_start, source_path=str(raw.get('source_path') or ''), track_index=track_index, volume_percent=volume_percent, scale_percent=scale, scale_x_percent=sx, scale_y_percent=sy, offset_x=_clamp_int(raw.get('offset_x', 0), -5000, 5000, 0), offset_y=_clamp_int(raw.get('offset_y', 0), -5000, 5000, 0), mirror_hflip=bool(raw.get('mirror_hflip', False)), video_trim_head_ms=_clamp_int(raw.get('video_trim_head_ms', 0), 0, 1500, 0), video_trim_tail_ms=_clamp_int(raw.get('video_trim_tail_ms', 0), 0, 1500, 0), warp_x_percent=_clamp_int(raw.get('warp_x_percent', 100), 100, 200, 100), warp_y_percent=_clamp_int(raw.get('warp_y_percent', 100), 100, 200, 100))

def _copy_clip(clip: TimelineClip, **changes: Any) -> TimelineClip:
    return replace(clip, **changes)

def clamp_track_index(track_index: int | object) -> int:
    return _clamp_int(track_index, 0, MAX_VIDEO_TRACKS - 1, 0)

def clips_on_track(clips: list[TimelineClip], track_index: int) -> list[TimelineClip]:
    ti = clamp_track_index(track_index)
    return [c for c in clips if clamp_track_index(c.track_index) == ti]

def _layout_single_track(clips: list[TimelineClip], *, track_index: int, ripple: bool) -> list[TimelineClip]:
    ti = clamp_track_index(track_index)
    out = []
    if ripple:
        cursor = 0
        for clip in clips:
            out.append(_copy_clip(clip, track_index=ti, timeline_start_ms=cursor))
            cursor += clip.duration_ms
    else:
        ordered = sorted(clips, key=lambda c: (int(c.timeline_start_ms), str(c.id)))
        last_end = 0
        for clip in ordered:
            start = max(0, int(clip.timeline_start_ms))
            if start < last_end:
                start = last_end
            out.append(_copy_clip(clip, track_index=ti, timeline_start_ms=start))
            last_end = start + clip.duration_ms
    return out

def layout_clips(clips: list[TimelineClip]) -> list[TimelineClip]:
    buckets = {i: [] for i in range(MAX_VIDEO_TRACKS)}
    for clip in clips:
        ti = clamp_track_index(getattr(clip, 'track_index', 0))
        buckets[ti].append(clip)
    laid = []
    for ti in range(MAX_VIDEO_TRACKS):
        if buckets[ti]:
            laid.extend(_layout_single_track(buckets[ti], track_index=ti, ripple=ti == 0))
    return laid

def timeline_duration_ms(clips: list[TimelineClip]) -> int:
    return max(0, max((c.timeline_start_ms + c.duration_ms for c in clips))) if clips else 0

def clips_from_values(values: dict[str, Any]) -> list[TimelineClip]:
    raw = values.get(TIMELINE_CLIPS_KEY)
    if isinstance(raw, list):
        clips = []
        for item in raw:
            clip = clip_from_dict(item)
            if clip is None:
                pass
            else:
                clips.append(clip)
        return layout_clips(clips)
    return []

def write_clips(values: dict[str, Any], clips: list[TimelineClip], *, source_duration_ms: int | None) -> list[TimelineClip]:
    laid = layout_clips(list(clips))
    values[TIMELINE_CLIPS_KEY] = [clip.to_dict() for clip in laid]
    ids = {clip.id for clip in laid}
    selected = str(values.get(SELECTED_CLIP_KEY) or '')
    multi = [cid for cid in selected_clip_ids(values) if cid in ids]
    if selected and selected not in ids:
        selected = multi[0] if multi else laid[0].id if laid else ''
        values[SELECTED_CLIP_KEY] = selected
    elif not selected and laid:
        selected = laid[0].id
        values[SELECTED_CLIP_KEY] = selected
    if selected and selected not in multi and (selected in ids):
        multi = [selected] + [cid for cid in multi if cid != selected]
    if not multi and selected:
        multi = [selected]
    values[SELECTED_CLIP_IDS_KEY] = multi
    if len(laid) == 1:
        inn = int(laid[0].source_in_ms)
        out = int(laid[0].source_out_ms)
        values['trim_start_ms'] = inn
        known = max(1, int(source_duration_ms or 0), out)
        if inn <= 0 and out >= known:
            values['trim_end_ms'] = 0
        else:
            values['trim_end_ms'] = out
    else:
        if len(laid) == 0:
            values['trim_start_ms'] = 0
            values['trim_end_ms'] = 0
            return laid
        values['trim_start_ms'] = 0
        values['trim_end_ms'] = 0
    return laid

def reset_timeline_to_single_source(values: dict[str, Any], *, source_path: str, source_duration_ms: int) -> list[TimelineClip]:
    path = str(source_path or '').strip()
    dur = max(1, int(source_duration_ms or 1))
    xform = transform_from_values(values)
    existing = clips_from_values(values)
    seed = next((c for c in existing if clamp_track_index(c.track_index) == 0), existing[0] if existing else None)
    if seed is not None:
        xform = {'volume_percent': int(seed.volume_percent), 'scale_percent': int(seed.scale_percent), 'scale_x_percent': int(seed.scale_x_percent), 'scale_y_percent': int(seed.scale_y_percent), 'offset_x': int(seed.offset_x), 'offset_y': int(seed.offset_y)}
    clip = TimelineClip(id=new_clip_id(), source_in_ms=0, source_out_ms=dur, timeline_start_ms=0, source_path=path, track_index=0, **xform)
    return write_clips(values, [clip], source_duration_ms=dur)

def has_custom_scene_timeline(values_or_clips: dict[str, Any] | list[Any], *, source_duration_ms: int) -> bool:
    if isinstance(values_or_clips, dict):
        clips = clips_from_values(values_or_clips)
    else:
        clips = [c for c in values_or_clips if isinstance(c, TimelineClip)]
        if not clips and values_or_clips:
            clips = [clip for item in values_or_clips if not (not isinstance(item, dict) or clip is None)]
    track0 = [c for c in clips if clamp_track_index(c.track_index) == 0]
    if len(track0) >= 2:
        return True
    if track0:
        clip = track0[0]
        if int(clip.source_in_ms) > 80:
            return True
        dur = max(0, int(source_duration_ms or 0))
        if dur >= 1000 and int(clip.source_out_ms) + 200 < dur:
            return True
        other = [c for c in clips if clamp_track_index(c.track_index) != 0]
        return bool(other)
    return False

def sanitize_excessive_timeline_clips(values: dict[str, Any], *, source_duration_ms: int, source_path: str, max_clips: int) -> int:
    clips = clips_from_values(values)
    track0 = [c for c in clips if clamp_track_index(c.track_index) == 0]
    limit = max(8, int(max_clips))
    if len(track0) <= limit:
        return 0
    path = str(source_path or '').strip()
    if not path and track0:
        path = str(track0[0].source_path or '')
    dur = max(1, int(source_duration_ms or 0))
    if dur <= 1 and track0:
        dur = max(1, max((int(c.source_out_ms) for c in track0)))
    template = track0[0]
    single = _copy_clip(template, id=template.id or new_clip_id(), source_in_ms=0, source_out_ms=dur, timeline_start_ms=0, track_index=0, source_path=path or template.source_path)
    others = [c for c in clips if clamp_track_index(c.track_index) != 0]
    write_clips(values, [single, *others])
    values['trim_start_ms'] = 0
    values['trim_end_ms'] = 0
    return len(track0) - 1

def remap_timeline_clips_to_source(values: dict[str, Any], *, source_path: str, source_duration_ms: int) -> list[TimelineClip]:
    path = str(source_path or '').strip()
    dur = max(0, int(source_duration_ms or 0))
    clips = clips_from_values(values)
    if clips:
        remapped = []
        for clip in clips:
            next_clip = clip
            if clamp_track_index(clip.track_index) == 0 and path:
                next_clip = replace(clip, source_path=path)
            if dur >= 200 and clamp_track_index(next_clip.track_index) == 0:
                out_ms = min(int(next_clip.source_out_ms), dur)
                in_ms = min(int(next_clip.source_in_ms), max(0, out_ms - 1))
                if out_ms <= in_ms:
                    out_ms = min(dur, in_ms + MIN_CLIP_DURATION_MS)
                next_clip = replace(next_clip, source_in_ms=max(0, in_ms), source_out_ms=max(in_ms + 1, out_ms))
            remapped.append(next_clip)
        return write_clips(values, remapped)
    return clips

def ensure_timeline_for_video_source(values: dict[str, Any], *, source_path: str, source_duration_ms: int, preserve_custom_scenes: bool) -> list[TimelineClip]:
    dur = max(1, int(source_duration_ms or 1))
    path = str(source_path or '').strip()
    return remap_timeline_clips_to_source(values, source_path=path, source_duration_ms=dur) if preserve_custom_scenes and has_custom_scene_timeline(values, source_duration_ms=dur) else reset_timeline_to_single_source(values, source_path=path, source_duration_ms=dur)

def transform_from_values(values: dict[str, Any]) -> dict[str, int]:
    scale = _clamp_int(values.get('scale_percent', 100), 10, 500, 100)
    return {'scale_percent': scale, 'scale_x_percent': _clamp_int(values.get('scale_x_percent', scale), 10, 500, scale), 'scale_y_percent': _clamp_int(values.get('scale_y_percent', scale), 10, 500, scale), 'offset_x': _clamp_int(values.get('offset_x', 0), -5000, 5000, 0), 'offset_y': _clamp_int(values.get('offset_y', 0), -5000, 5000, 0)}

def apply_clip_transform_to_values(values: dict[str, Any], clip: TimelineClip) -> None:
    values['scale_percent'] = int(clip.scale_percent)
    values['scale_x_percent'] = int(clip.scale_x_percent)
    values['scale_y_percent'] = int(clip.scale_y_percent)
    values['offset_x'] = int(clip.offset_x)
    values['offset_y'] = int(clip.offset_y)
    values['clip_volume_percent'] = int(clip.volume_percent)

def persist_values_transform_to_selected_clip(values: dict[str, Any]) -> list[TimelineClip]:
    raw = values.get(TIMELINE_CLIPS_KEY)
    if isinstance(raw, list) and raw:
        sel = str(values.get(SELECTED_CLIP_KEY) or '').strip()
        xform = transform_from_values(values)
        try:
            vol = max(0, min(100, int(values.get('clip_volume_percent', 100) or 100)))
        except (TypeError, ValueError):
            vol = 100
        for item in raw:
            item_id = str(item.get('id') or '').strip()
            if not isinstance(item, dict) or (sel and item_id != sel):
                continue
            if not sel:
                sel = item_id
                values[SELECTED_CLIP_KEY] = sel
            item['scale_percent'] = int(xform['scale_percent'])
            item['scale_x_percent'] = int(xform['scale_x_percent'])
            item['scale_y_percent'] = int(xform['scale_y_percent'])
            item['offset_x'] = int(xform['offset_x'])
            item['offset_y'] = int(xform['offset_y'])
            item['volume_percent'] = vol
            return []
    return []

def ensure_timeline_clips(values: dict[str, Any], *, source_duration_ms: int, source_path: str, duration_by_path: dict[str, int] | None) -> list[TimelineClip]:
    source_dur = max(1, int(source_duration_ms or 1))
    existing = clips_from_values(values)
    xform = transform_from_values(values)
    primary = str(source_path or '').strip()
    dur_map = {str(k): max(1, int(v)) for k, v in (duration_by_path or {}).items()}

    def _dur_for(path: str) -> int:
        p = str(path or '').strip()
        return dur_map[p] if p and p in dur_map else 86400000 if p and primary and (p != primary) and (p not in dur_map) else source_dur
    if existing:
        only = existing[0]
        path = only.source_path or primary
        dur = _dur_for(path)
        if len(existing) == 1 and dur >= 5000 and (int(only.source_in_ms) <= 0) and (int(only.duration_ms) <= max(2500, int(dur * 0.15))):
            healed = _copy_clip(only, source_in_ms=0, source_out_ms=dur, timeline_start_ms=0, source_path=path)
            return write_clips(values, [healed], source_duration_ms=source_dur)
        needs_fix = False
        expected_start = 0
        for clip in existing:
            path = clip.source_path or primary
            dur = _dur_for(path)
            inn = max(0, min(clip.source_in_ms, dur - 1))
            out = max(inn + 1, min(clip.source_out_ms, dur))
            if inn != clip.source_in_ms or out != clip.source_out_ms or clip.timeline_start_ms != expected_start:
                needs_fix = True
                break
            if not primary or clip.source_path:
                expected_start += clip.duration_ms
        if needs_fix:
            fixed = []
            for clip in existing:
                path = clip.source_path or primary
                dur = _dur_for(path)
                inn = max(0, min(clip.source_in_ms, dur - 1))
                out = max(inn + 1, min(clip.source_out_ms, dur))
                fixed.append(_copy_clip(clip, source_in_ms=inn, source_out_ms=out, timeline_start_ms=0, source_path=path))
            return write_clips(values, fixed, source_duration_ms=source_dur)
        return existing
    trim_start = max(0, int(values.get('trim_start_ms', 0) or 0))
    trim_end = int(values.get('trim_end_ms', 0) or 0)
    if trim_end <= 0:
        trim_end = source_dur
    elif source_dur >= 5000 and trim_end <= max(2500, int(source_dur * 0.15)):
        trim_start = 0
        trim_end = source_dur
    trim_start = min(trim_start, source_dur - 1)
    trim_end = max(trim_start + 1, min(trim_end, source_dur))
    clip = TimelineClip(id=new_clip_id(), source_in_ms=trim_start, source_out_ms=trim_end, timeline_start_ms=0, source_path=str(source_path or ''), **xform)
    return write_clips(values, [clip], source_duration_ms=source_dur)

def selected_clip_id(values: dict[str, Any]) -> str:
    return str(values.get(SELECTED_CLIP_KEY) or '')

def selected_clip_ids(values: dict[str, Any]) -> list[str]:
    raw = values.get(SELECTED_CLIP_IDS_KEY)
    out = []
    seen = set()
    if isinstance(raw, list):
        for item in raw:
            cid = str(item or '').strip()
            if cid and cid not in seen:
                seen.add(cid)
                out.append(cid)
    primary = selected_clip_id(values)
    if not out and primary:
        out = [primary]
    return out

def set_selected_clip_ids(values: dict[str, Any], clip_ids: list[str] | tuple[str, ...] | set[str], *, primary: str | None) -> None:
    cleaned = []
    seen = set()
    for item in clip_ids:
        cid = str(item or '').strip()
        if cid and cid not in seen:
            seen.add(cid)
            cleaned.append(cid)
    values[SELECTED_CLIP_IDS_KEY] = cleaned
    if primary is not None:
        prim = str(primary or '').strip()
        if prim and prim in seen:
            values[SELECTED_CLIP_KEY] = prim
        else:
            values[SELECTED_CLIP_KEY] = cleaned[0] if cleaned else ''
        return None
    cur = selected_clip_id(values)
    if cur in seen:
        return None
    values[SELECTED_CLIP_KEY] = cleaned[0] if cleaned else ''

def set_selected_clip_id(values: dict[str, Any], clip_id: str) -> None:
    cid = str(clip_id or '').strip()
    values[SELECTED_CLIP_KEY] = cid
    values[SELECTED_CLIP_IDS_KEY] = [cid] if cid else []

def find_clip(clips: list[TimelineClip], clip_id: str) -> TimelineClip | None:
    cid = str(clip_id or '').strip()
    return next((clip for clip in clips if clip.id == cid), None) if cid else None

def neighbor_clip(clips: list[TimelineClip], clip_id: str, *, step: int) -> TimelineClip | None:
    if clips and clip_id:
        src = find_clip(clips, clip_id)
        if src is None:
            return None
        track = sorted(clips_on_track(clips, src.track_index), key=lambda c: (c.timeline_start_ms, c.id))
        index = next((i for i, clip in enumerate(track) if clip.id == src.id), -1)
        if index < 0:
            return None
        dest = index + int(step)
        return None if dest < 0 or dest >= len(track) else track[dest]

def clip_boundary_ms_list(clips: list[TimelineClip]) -> list[int]:
    if clips:
        points = {0}
        for clip in clips:
            points.add(int(clip.timeline_start_ms))
            points.add(int(clip.timeline_start_ms + clip.duration_ms))
        return sorted(points)
    return [0]

def snap_timeline_ms(value_ms: int, snap_points: list[int], *, threshold_ms: int) -> int:
    if snap_points:
        value = int(value_ms)
        thr = max(1, int(threshold_ms))
        best = value
        best_dist = thr + 1
        for point in snap_points:
            dist = abs(int(point) - value)
            if dist < best_dist:
                best_dist = dist
                best = int(point)
        return best if best_dist <= thr else value
    return int(value_ms)

def clip_at_timeline(clips: list[TimelineClip], timeline_ms: int, *, track_index: int | None) -> tuple[TimelineClip, int] | None:
    if clips:
        pos = max(0, int(timeline_ms))
        if track_index is None:
            for ti in range(MAX_VIDEO_TRACKS - 1, -1, -1):
                hit = clip_at_timeline(clips, pos, track_index=ti)
                if hit is None:
                    continue
                return hit
        else:
            track = sorted(clips_on_track(clips, track_index), key=lambda c: c.timeline_start_ms)
            if track:
                hi, lo = (len(track) - 1, 0)
                idx = 0
                while lo <= hi:
                    mid = (lo + hi) // 2
                    start = track[mid].timeline_start_ms
                    if pos < start:
                        hi = mid - 1
                    else:
                        idx = mid
                        lo = mid + 1
                clip = track[idx]
                end = clip.timeline_start_ms + clip.duration_ms
                if clip.timeline_start_ms <= pos < end or (pos == end and clip is track[-1]):
                    local = min(clip.duration_ms - 1, max(0, pos - clip.timeline_start_ms))
                    return (clip, clip.source_ms_at_local(local))
                track_end = timeline_duration_ms(track)
                if pos >= track_end and track_index == 0:
                    last = track[-1]
                    play_in, play_out = last.video_play_window_ms()
                    return (last, max(play_in, play_out - 1))
    return None

def timeline_ms_from_source_playthrough(clips: list[TimelineClip], source_ms: int) -> int | None:
    src = max(0, int(source_ms))
    if clips:
        ordered = sorted(clips, key=lambda c: int(c.source_in_ms))
        for clip in ordered:
            inn = int(clip.source_in_ms)
            out = int(clip.source_out_ms)
            if inn <= src < out:
                return int(clip.timeline_start_ms + (src - inn))
            if src == out and clip is ordered[-1]:
                return int(clip.timeline_start_ms + clip.duration_ms)
    else:
        return None

def timeline_ms_from_source(clips: list[TimelineClip], source_ms: int) -> int | None:
    src = max(0, int(source_ms))
    for clip in clips:
        play_in, play_out = clip.video_play_window_ms()
        if play_in <= src < play_out:
            src_dur = max(1, play_out - play_in)
            local = int(round((src - play_in) * clip.duration_ms / float(src_dur)))
            local = min(clip.duration_ms, max(0, local))
            return clip.timeline_start_ms + local
        if src == play_out and clip is clips[-1]:
            return clip.timeline_start_ms + clip.duration_ms

def clips_are_single_source_contiguous(clips: list[TimelineClip]) -> bool:
    if len(clips) <= 1:
        return True
    else:
        paths = {str(c.source_path or '').strip().replace('\\', '/') for c in clips if str(c.source_path or '').strip()}
        if len(paths) > 1:
            return False
        ordered = sorted(clips, key=lambda c: int(c.source_in_ms))
        cursor = int(ordered[0].source_in_ms)
        for clip in ordered:
            inn = int(clip.source_in_ms)
            out = int(clip.source_out_ms)
            if inn > cursor + 1:
                return False
            cursor = max(cursor, out)
    return True

def timeline_ms_from_source_smooth(clips: list[TimelineClip], source_ms: int) -> int:
    mapped = timeline_ms_from_source(clips, source_ms)
    if mapped is not None:
        return int(mapped)
    src = max(0, int(source_ms))
    if clips:
        first = min(clips, key=lambda c: int(c.source_in_ms))
        if src < first.source_in_ms:
            return int(first.timeline_start_ms)
        best_after = None
        best_before = None
        for clip in clips:
            if clip.source_in_ms >= src:
                if best_after is None or clip.source_in_ms < best_after.source_in_ms:
                    best_after = clip
            if clip.source_out_ms > src:
                pass
            elif best_before is None or clip.source_out_ms > best_before.source_out_ms:
                best_before = clip
        if best_before is not None:
            if best_after is None or src - best_before.source_out_ms <= best_after.source_in_ms - src:
                return int(best_before.timeline_start_ms + max(0, best_before.duration_ms - 1))
        else:
            if best_after is not None:
                return int(best_after.timeline_start_ms)
            last = max(clips, key=lambda c: int(c.timeline_start_ms + c.duration_ms))
            return int(last.timeline_start_ms + max(0, last.duration_ms - 1))
    else:
        return src

def build_clips_from_source_cuts(cut_source_ms: list[int], *, source_in_ms: int, source_out_ms: int, source_path: str, template: TimelineClip | None, min_duration_ms: int) -> list[TimelineClip]:
    start = max(0, int(source_in_ms))
    end = max(start + 1, int(source_out_ms))
    min_dur = max(1, int(min_duration_ms))
    bounds = [start]
    for raw in sorted((int(x) for x in cut_source_ms)):
        if raw <= bounds[-1] + min_dur // 2 or raw >= end - min_dur // 2:
            pass
        else:
            bounds.append(raw)
    bounds.append(end)
    compact = [bounds[0]]
    for point in bounds[1:]:
        if point - compact[-1] < min_dur and len(compact) > 1:
            compact[-1] = point
        elif point - compact[-1] < min_dur:
            pass
        else:
            compact.append(point)
    if compact[-1] != end:
        if end - compact[-1] < min_dur and len(compact) > 1:
            compact[-1] = end
        else:
            compact.append(end)
    if len(compact) < 2:
        compact = [start, end]
    clips = []
    for index in range(len(compact) - 1):
        inn = compact[index]
        out = compact[index + 1]
        if out - inn < 1:
            pass
        elif template is not None:
            clips.append(_copy_clip(template, id=new_clip_id() if index <= 0 and template.id else template.id, source_in_ms=inn, source_out_ms=out, timeline_start_ms=0, source_path=source_path or template.source_path))
        else:
            clips.append(TimelineClip(id=new_clip_id(), source_in_ms=inn, source_out_ms=out, timeline_start_ms=0, source_path=source_path))
    return layout_clips(clips) if clips else []

def apply_scene_cuts_to_values(values: dict[str, Any], cut_source_ms: list[int], *, source_path: str, source_duration_ms: int, min_duration_ms: int) -> int:
    from core.scene_detect import MAX_AUTO_SCENE_CUTS, thin_scene_cuts
    source_dur = max(1, int(source_duration_ms or 1))
    path = str(source_path or '')
    clips = ensure_timeline_clips(values, source_duration_ms=source_dur, source_path=path)
    template = clips[0] if clips else None
    cut_list = thin_scene_cuts(list(cut_source_ms or []), max_cuts=min(MAX_AUTO_SCENE_CUTS, MAX_SAFE_TIMELINE_CLIPS - 1))
    built = build_clips_from_source_cuts(cut_list, source_in_ms=0, source_out_ms=source_dur, source_path=path, template=template, min_duration_ms=max(MIN_CLIP_DURATION_MS, int(min_duration_ms)))
    if not built:
        return 0
    if len(built) > 1 or cut_list:
        from core.scene_clip_fx import apply_scene_clip_fx
        built = apply_scene_clip_fx(built, values)
        values['trim_start_ms'] = 0
        values['trim_end_ms'] = 0
        laid = write_clips(values, built)
        if laid:
            set_selected_clip_id(values, laid[0].id)
            apply_clip_transform_to_values(values, laid[0])
        return len(laid)
    return len(built)

def split_clip_at_timeline(clips: list[TimelineClip], timeline_ms: int, *, min_duration_ms: int, track_index: int | None) -> list[TimelineClip] | None:
    hit = clip_at_timeline(clips, timeline_ms, track_index=None if track_index is None else track_index)
    if hit is None:
        hit = clip_at_timeline(clips, timeline_ms, track_index=0)
    if hit is None:
        return None
    clip, source_at = hit
    left_dur = source_at - clip.source_in_ms
    right_dur = clip.source_out_ms - source_at
    if left_dur < min_duration_ms or right_dur < min_duration_ms:
        return None
    left = _copy_clip(clip, source_out_ms=source_at, timeline_start_ms=clip.timeline_start_ms)
    right = _copy_clip(clip, id=new_clip_id(), source_in_ms=source_at, timeline_start_ms=clip.timeline_start_ms + left_dur)
    out = []
    for item in clips:
        if item.id != clip.id:
            out.append(item)
        else:
            out.append(left)
            out.append(right)
    return layout_clips(out)

def delete_clip_ripple(clips: list[TimelineClip], clip_id: str) -> list[TimelineClip]:
    return delete_clips_ripple(clips, [clip_id])

def delete_clips_ripple(clips: list[TimelineClip], clip_ids: list[str] | tuple[str, ...] | set[str]) -> list[TimelineClip]:
    drop = {str(cid) for cid in clip_ids if str(cid or '').strip()}
    return layout_clips([c for c in clips if c.id not in drop] if drop else list(clips))

def trim_clip_edge(clips: list[TimelineClip], clip_id: str, *, edge: str, source_ms: int, source_duration_ms: int, min_duration_ms: int) -> list[TimelineClip] | None:
    source_dur = max(1, int(source_duration_ms))
    out = []
    found = False
    for clip in clips:
        if clip.id != clip_id:
            out.append(clip)
        else:
            found = True
            if edge == 'in':
                new_in = max(0, min(int(source_ms), clip.source_out_ms - min_duration_ms))
                new_out = clip.source_out_ms
            else:
                new_in = clip.source_in_ms
                new_out = max(clip.source_in_ms + min_duration_ms, min(source_dur, int(source_ms)))
            if new_out - new_in < min_duration_ms:
                return None
            out.append(_copy_clip(clip, source_in_ms=new_in, source_out_ms=new_out))
    return layout_clips(out) if found else None

def reorder_clip(clips: list[TimelineClip], clip_id: str, new_index: int) -> list[TimelineClip] | None:
    if clips:
        ordered = list(clips)
        index = next((i for i, clip in enumerate(ordered) if clip.id == clip_id), -1)
        if index < 0:
            return None
        clip = ordered.pop(index)
        dest = max(0, min(len(ordered), int(new_index)))
        ordered.insert(dest, clip)
        return layout_clips(ordered)

def reorder_clip_by_timeline_ms(clips: list[TimelineClip], clip_id: str, target_timeline_ms: int) -> list[TimelineClip] | None:
    if clips:
        moving = find_clip(clips, clip_id)
        if moving is None:
            return None
        ti = clamp_track_index(moving.track_index)
        target = max(0, int(target_timeline_ms))
        if ti > 0:
            return move_clip_to_track(clips, clip_id, ti, timeline_start_ms=target)
        others_same = [c for c in clips_on_track(clips, 0) if c.id != clip_id]
        cross = [c for c in clips if clamp_track_index(c.track_index) != 0]
        if others_same:
            insert_at = len(others_same)
            cursor = 0
            for i, clip in enumerate(others_same):
                mid = cursor + clip.duration_ms / 2
                if target < mid:
                    insert_at = i
                    break
                cursor += clip.duration_ms
            others_same.insert(insert_at, moving)
            return layout_clips([*cross, *others_same])
        return layout_clips([*cross, moving])

def unique_clip_source_paths(clips: list[TimelineClip], *, fallback: str) -> list[str]:
    paths = []
    fb = str(fallback or '').strip()
    for clip in clips:
        path = str(clip.source_path or '').strip() or fb
        if path and path not in paths:
            paths.append(path)
    if not paths and fb:
        paths.append(fb)
    return paths

def clip_source_paths_per_clip(clips: list[TimelineClip], *, fallback: str) -> list[str]:
    fb = str(fallback or '').strip()
    paths = []
    for clip in clips:
        path = str(clip.source_path or '').strip() or fb
        if path:
            paths.append(path)
    if not paths and fb:
        paths.append(fb)
    return paths

def insert_source_clip(clips: list[TimelineClip], *, source_path: str, source_duration_ms: int, at_timeline_ms: int | None, after_clip_id: str | None, template: TimelineClip | None, track_index: int) -> list[TimelineClip]:
    path = str(source_path or '').strip()
    if path:
        dur = max(MIN_CLIP_DURATION_MS, int(source_duration_ms or 1))
        ti = clamp_track_index(track_index)
        start_ms = max(0, int(at_timeline_ms or 0))
        new_clip = _copy_clip(template, id=new_clip_id(), source_in_ms=0, source_out_ms=dur, timeline_start_ms=start_ms, source_path=path, track_index=ti) if template is not None else TimelineClip(id=new_clip_id(), source_in_ms=0, source_out_ms=dur, timeline_start_ms=start_ms, source_path=path, track_index=ti)
        if ti > 0:
            return layout_clips([*clips, new_clip])
        base_track = clips_on_track(clips, 0)
        others = [c for c in clips if clamp_track_index(c.track_index) != 0]
        base = list(base_track)
        split = split_clip_at_timeline(base, int(at_timeline_ms), min_duration_ms=MIN_CLIP_DURATION_MS, track_index=0)
        if split is not None:
            base = split
        hit = clip_at_timeline(base, int(at_timeline_ms), track_index=0)
        if at_timeline_ms is not None and base and (hit is not None):
            after_clip_id = hit[0].id
        if base:
            out = []
            inserted = False
            target = after_clip_id or base[-1].id
            for item in base:
                out.append(item)
                if item.id != target or inserted:
                    pass
                else:
                    out.append(new_clip)
                    inserted = True
            if not inserted:
                out.append(new_clip)
            return layout_clips([*others, *out])
        return layout_clips([*others, new_clip])
    raise ValueError('Thiếu đường dẫn video để chèn')

def move_clip_to_track(clips: list[TimelineClip], clip_id: str, track_index: int, *, timeline_start_ms: int | None) -> list[TimelineClip] | None:
    src = find_clip(clips, clip_id)
    if src is None:
        return None
    ti = clamp_track_index(track_index)
    start = int(src.timeline_start_ms) if timeline_start_ms is None else max(0, int(timeline_start_ms))
    moved = _copy_clip(src, track_index=ti, timeline_start_ms=start)
    rest = [c for c in clips if c.id != clip_id]
    return layout_clips([*rest, moved])

def duplicate_clip_after(clips: list[TimelineClip], clip_id: str) -> list[TimelineClip] | None:
    src = find_clip(clips, clip_id)
    if src is None:
        return None
    out = []
    for item in clips:
        out.append(item)
        if item.id == clip_id:
            start = src.timeline_start_ms + src.duration_ms if src.track_index > 0 else 0
            out.append(_copy_clip(src, id=new_clip_id(), timeline_start_ms=start, track_index=src.track_index))
    return layout_clips(out)

def build_media_overlays_from_video_tracks(clips: list[TimelineClip]) -> list[dict[str, object]]:
    items = []
    ordered = sorted(clips, key=lambda c: (clamp_track_index(c.track_index), c.timeline_start_ms))
    for clip in ordered:
        ti = clamp_track_index(clip.track_index)
        path = str(clip.source_path or '').strip()
        if ti > 0 and path:
            x_norm = max(0.0, min(1.0, 0.5 + float(clip.offset_x) / 2000.0))
            y_norm = max(0.0, min(1.0, 0.5 + float(clip.offset_y) / 2000.0))
            items.append({'id': f'ttrack-{clip.id}', 'path': path, 'enabled': True, 'x_norm': x_norm, 'y_norm': y_norm, 'scale_percent': max(5, min(200, int(clip.scale_percent or 100))), 'opacity': 100, 'rotation_degrees': 0, 'blend_enabled': False, 'blend_mode': 'normal', 'start_ms': int(clip.timeline_start_ms), 'end_ms': int(clip.timeline_start_ms + clip.duration_ms)})
    return items

def clipboard_payload(clips: list[TimelineClip], clip_id: str) -> dict[str, object] | None:
    clip = find_clip(clips, clip_id)
    return None if clip is None else {'clip': clip.to_dict()}

def paste_clip_after(clips: list[TimelineClip], payload: dict[str, object], *, after_clip_id: str | None) -> list[TimelineClip] | None:
    raw = payload.get('clip') if isinstance(payload, dict) else None
    clip = clip_from_dict(raw)
    if clip is None:
        return None
    pasted = _copy_clip(clip, id=new_clip_id(), timeline_start_ms=0)
    if clips:
        out = []
        inserted = False
        target = after_clip_id or (clips[-1].id if clips else '')
        for item in clips:
            out.append(item)
            if item.id == target:
                out.append(pasted)
                inserted = True
        if not inserted:
            out.append(pasted)
        return layout_clips(out)
    return [pasted]

def sync_single_clip_from_trim(values: dict[str, Any], *, source_duration_ms: int, source_path: str) -> list[TimelineClip]:
    clips = ensure_timeline_clips(values, source_duration_ms=source_duration_ms, source_path=source_path)
    if len(clips) != 1:
        return clips
    source_dur = max(1, int(source_duration_ms or 1))
    trim_start = max(0, int(values.get('trim_start_ms', 0) or 0))
    trim_end = int(values.get('trim_end_ms', 0) or 0)
    if trim_end <= 0:
        trim_end = source_dur
    trim_start = min(trim_start, source_dur - 1)
    trim_end = max(trim_start + 1, min(trim_end, source_dur))
    updated = _copy_clip(clips[0], source_in_ms=trim_start, source_out_ms=trim_end, source_path=clips[0].source_path or source_path)
    return write_clips(values, [updated])

def clips_have_custom_transform(clips: list[TimelineClip]) -> bool:
    for clip in clips:
        if clip.scale_percent != 100 or clip.scale_x_percent != 100 or clip.scale_y_percent != 100 or (clip.offset_x != 0) or (clip.offset_y != 0):
            return True
    return False

def build_concat_trim_filters(clips: list[TimelineClip], *, has_audio: bool, video_out: str, audio_out: str, target_width: int, target_height: int, bake_transform: bool, input_index_by_path: dict[str, int] | None, input_index_by_clip: list[int] | None, input_preseeked: bool, segments_prebaked: bool, fallback_path: str, fade_ms: int, audio_paths: set[str] | None, transition_styles: list[str] | None, background_labels: list[str | None] | None, crop_norm: tuple[float, float, float, float] | None) -> tuple[list[str], str, str | None, bool]:
    if clips:
        tw = max(0, int(target_width))
        th = max(0, int(target_height))
        bake = bool(bake_transform) and tw >= 2 and (th >= 2) and (len(clips) > 1)
        fade_s = max(0.0, min(2.0, int(fade_ms) / 1000.0))
        path_map = dict(input_index_by_path or {})
        clip_inputs = list(input_index_by_clip) if input_index_by_clip is not None else None
        preseeked = bool(input_preseeked) and clip_inputs is not None
        already_baked = bool(segments_prebaked) and clip_inputs is not None
        fb = str(fallback_path or '').strip()
        audio_ok = audio_paths
        from core.timeline_transitions import build_acrossfade_audio_chain, build_xfade_video_chain, normalize_transition_style, uses_real_xfade
        join_styles = [normalize_transition_style(s) for s in transition_styles or []]
        while len(join_styles) < max(0, len(clips) - 1):
            join_styles.append('fade' if fade_s > 0.001 else 'cut')
        join_styles = join_styles[:max(0, len(clips) - 1)]
        use_xfade = bool(bake and fade_s > 0.001 and uses_real_xfade(join_styles, int(fade_ms or 0)) and (not already_baked))
        use_edge_fades = bool(bake and fade_s > 0.001 and (not use_xfade) and uses_real_xfade(join_styles, int(fade_ms or 0)))

        def _input_idx(clip: TimelineClip, clip_index: int=0) -> int:
            if clip_inputs is not None:
                if 0 <= clip_index < len(clip_inputs):
                    return int(clip_inputs[clip_index])
            else:
                path = str(clip.source_path or '').strip() or fb
                return int(path_map[path]) if path in path_map else 0

        def _clip_path(clip: TimelineClip) -> str:
            return str(clip.source_path or '').strip() or fb

        def _fade_suffix(clip: TimelineClip) -> str:
            if use_xfade or not use_edge_fades or len(clips) <= 1:
                return ''
            dur_s = max(0.05, clip.duration_ms / 1000.0)
            edge = min(fade_s, max(0.02, dur_s / 3.0))
            out_st = max(0.0, dur_s - edge)
            return f',fade=t=out:st={out_st:.3f}:d={edge:.3f}'

        def _seg_trim_bounds(clip: TimelineClip) -> tuple[float, float]:
            dur_s = max(0.05, (clip.source_out_ms - clip.source_in_ms) / 1000.0)
            if already_baked or preseeked:
                return (0.0, dur_s)
            start = max(0.0, clip.source_in_ms / 1000.0)
            end = max(start + 0.05, clip.source_out_ms / 1000.0)
            return (start, end)

        def _video_trim_bounds(clip: TimelineClip) -> tuple[float, float]:
            play_in, play_out = clip.video_play_window_ms()
            src_s = max(0.05, (play_out - play_in) / 1000.0)
            if already_baked:
                return (0.0, max(0.05, clip.duration_ms / 1000.0))
            if preseeked:
                head_s = max(0.0, (play_in - int(clip.source_in_ms)) / 1000.0)
                return (head_s, head_s + src_s)
            start = max(0.0, play_in / 1000.0)
            end = max(start + 0.05, play_out / 1000.0)
            return (start, end)
        crop_expr = ''
        if crop_norm is not None and (not already_baked):
            from core.video_export import crop_filter_expression
            crop_expr = crop_filter_expression(*crop_norm)

        def _video_fx_suffix(clip: TimelineClip, start: float, end: float) -> str:
            tl_s = max(0.05, clip.duration_ms / 1000.0)
            src_s = max(0.05, end - start)
            bits = []
            ratio = tl_s / src_s
            if abs(ratio - 1.0) > 0.008:
                bits.append(f'setpts={ratio:.6f}*(PTS-STARTPTS)')
            else:
                bits.append('setpts=PTS-STARTPTS')
            if clip.mirror_hflip:
                bits.append('hflip')
            if crop_expr:
                bits.append(crop_expr)
            from core.scene_clip_fx import warp_inside_box_filter
            warp = warp_inside_box_filter(int(clip.warp_x_percent or 100), int(clip.warp_y_percent or 100))
            if warp:
                bits.append(warp)
            return ',' + ','.join(bits)

        def _video_seg_filter(clip: TimelineClip, label: str, src_pad: str, bg_override: str | None=None) -> str:
            if already_baked:
                from core.ffmpeg_cli import video_pad_buffer_filter
                dur_s = max(0.05, clip.duration_ms / 1000.0)
                raw = f'{label}_raw'
                pad = f'[{src_pad}]trim=duration={dur_s:.3f},setpts=PTS-STARTPTS,setsar=1,format=yuv420p{_fade_suffix(clip)}[{raw}]'
                return f'{pad};{video_pad_buffer_filter(raw, label)}'
            start, end = _video_trim_bounds(clip)
            fx = _video_fx_suffix(clip, start, end)
            base = f'[{src_pad}]trim=start={start:.3f}:end={end:.3f}{fx}{_fade_suffix(clip)}'
            if bake:
                sx = max(10, min(500, int(clip.scale_x_percent))) / 100.0
                sy = max(10, min(500, int(clip.scale_y_percent))) / 100.0
                ox = int(clip.offset_x)
                oy = int(clip.offset_y)
                mid = f'{label}_fg'
                dur_s = max(0.05, clip.duration_ms / 1000.0)
                if bg_override:
                    bg_setup = ''
                    bg_ref = f'[{bg_override}]'
                else:
                    bg = f'{label}_bg'
                    bg_setup = f'color=c=black:s={tw}x{th}:r=30:d={dur_s:.3f}[{bg}];'
                    bg_ref = f'[{bg}]'
                return f"[{src_pad}]scale={tw}:{th}:force_original_aspect_ratio=decrease:flags=lanczos,scale=iw*{sx:g}:ih*{sy:g}:flags=lanczos,setsar=1,format=yuv420p[{mid}];{bg_setup}{bg_ref}[{mid}]overlay=x='(W-w)/2+{ox}':y='(H-h)/2+{oy}':shortest=1,setsar=1,format=yuv420p[{label}]"
            return f'{base}[{label}]'

        def _audio_seg_filter(clip: TimelineClip, label: str, src_pad: str | None) -> str:
            start, end = _seg_trim_bounds(clip)
            dur_s = max(0.05, end - start)
            path = _clip_path(clip)
            use_stream = bool(has_audio) and src_pad and (audio_ok is None or path in audio_ok or (not path))
            return f'[{src_pad}]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[{label}]' if use_stream else f'anullsrc=channel_layout=stereo:sample_rate=44100:d={dur_s:.3f},asetpts=PTS-STARTPTS[{label}]'
        c0_fx = clips[0]
        skip_simple = bool(c0_fx.mirror_hflip or int(c0_fx.video_trim_head_ms) or int(c0_fx.video_trim_tail_ms) or (int(c0_fx.warp_x_percent or 100) != 100) or (int(c0_fx.warp_y_percent or 100) != 100) or crop_norm)
        if len(clips) == 1 and (not bake) and (not skip_simple) and (fade_s <= 0.001) and (_input_idx(clips[0], 0) == 0):
            c0 = clips[0]
            start = c0.source_in_ms / 1000.0
            end = c0.source_out_ms / 1000.0
            filters = [f'[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[{video_out}]']
            audio_label = None
            if has_audio:
                filters.append(_audio_seg_filter(c0, audio_out))
                audio_label = audio_out
            return (filters, video_out, audio_label, False)
        filters = []
        v_labels = []
        a_labels = []
        from collections import defaultdict
        v_need = defaultdict(int)
        a_need = defaultdict(int)
        for index, clip in enumerate(clips):
            idx = _input_idx(clip, index)
            v_need[idx] += 1
            if has_audio:
                path = _clip_path(clip)
                if audio_ok is not None and path not in audio_ok and path:
                    pass
                else:
                    a_need[idx] += 1
        v_pads = {}
        a_pads = {}
        for idx, count in sorted(v_need.items()):
            if count <= 1:
                v_pads[idx] = [f'{idx}:v']
            else:
                from core.ffmpeg_cli import video_pad_buffer_filter
                raw = [f'vraw{idx}_{i}' for i in range(count)]
                labs = [f'vsrc{idx}_{i}' for i in range(count)]
                filters.append(f'[{idx}:v]split={count}' + ''.join((f'[{lab}]' for lab in raw)))
                for raw_lab, lab in zip(raw, labs):
                    filters.append(video_pad_buffer_filter(raw_lab, lab))
                v_pads[idx] = labs
        for idx, count in sorted(a_need.items()):
            if count <= 1:
                a_pads[idx] = [f'{idx}:a']
            else:
                from core.ffmpeg_cli import audio_pad_buffer_filter
                raw = [f'araw{idx}_{i}' for i in range(count)]
                labs = [f'asrc{idx}_{i}' for i in range(count)]
                filters.append(f'[{idx}:a]asplit={count}' + ''.join((f'[{lab}]' for lab in raw)))
                for raw_lab, lab in zip(raw, labs):
                    filters.append(audio_pad_buffer_filter(raw_lab, lab))
                a_pads[idx] = labs
        v_cursor = defaultdict(int)
        a_cursor = defaultdict(int)
        for index, clip in enumerate(clips):
            v_lab = f'vseg{index}'
            bg_override = background_labels[index] if background_labels and index < len(background_labels) else None
            idx = _input_idx(clip, index)
            v_src = v_pads[idx][v_cursor[idx]]
            v_cursor[idx] += 1
            filters.append(_video_seg_filter(clip, v_lab, v_src, bg_override))
            v_labels.append(v_lab)
            if has_audio:
                a_lab = f'aseg{index}'
                path = _clip_path(clip)
                a_src = None
                pads = a_pads.get(idx) or []
                if (audio_ok is None or path in audio_ok or (not path)) and pads:
                    a_src = pads[a_cursor[idx]]
                    a_cursor[idx] += 1
                filters.append(_audio_seg_filter(clip, a_lab, a_src))
                a_labels.append(a_lab)
        n = len(clips)
        if n == 1:
            filters.append(f'[{v_labels[0]}]null[{video_out}]')
        elif use_xfade:
            dur_s = [max(0.05, c.duration_ms / 1000.0) for c in clips]
            filters.extend(build_xfade_video_chain(v_labels, dur_s, join_styles, fade_ms=int(fade_ms or 0), video_out=video_out))
        else:
            filters.append(''.join((f'[{lab}]' for lab in v_labels)) + f'concat=n={n}:v=1:a=0[{video_out}]')
        audio_label = None
        if has_audio and a_labels:
            if len(a_labels) == 1:
                filters.append(f'[{a_labels[0]}]anull[{audio_out}]')
            elif use_xfade:
                filters.extend(build_acrossfade_audio_chain(a_labels, join_styles, fade_ms=int(fade_ms or 0), audio_out=audio_out, segment_dur_s=[max(0.05, c.duration_ms / 1000.0) for c in clips], preserve_duration=False))
            else:
                filters.append(''.join((f'[{lab}]' for lab in a_labels)) + f'concat=n={n}:v=0:a=1[{audio_out}]')
            audio_label = audio_out
        return (filters, video_out, audio_label, bake)
    raise ValueError('Không có clip timeline')

def deep_copy_clips(clips: list[TimelineClip]) -> list[TimelineClip]:
    return layout_clips([_copy_clip(clip) for clip in clips])

def remap_subtitle_document_through_clips(document: object, clips: list[TimelineClip]):
    from core.subtitles import SubtitleDocument, SubtitleSegment
    if document is not None and clips:
        segments = getattr(document, 'segments', ()) or ()
        mapped = []
        for seg in segments:
            start = int(getattr(seg, 'start_ms', 0) or 0)
            end = int(getattr(seg, 'end_ms', 0) or 0)
            text = str(getattr(seg, 'text', '') or '')
            if end <= start:
                pass
            else:
                for clip in clips:
                    overlap_start = max(start, clip.source_in_ms)
                    overlap_end = min(end, clip.source_out_ms)
                    if overlap_end <= overlap_start:
                        pass
                    else:
                        tl_start = clip.timeline_start_ms + (overlap_start - clip.source_in_ms)
                        tl_end = clip.timeline_start_ms + (overlap_end - clip.source_in_ms)
                        mapped.append(SubtitleSegment(tl_start, max(tl_start + 1, tl_end), text))
        return SubtitleDocument(tuple(mapped), getattr(document, 'source_path', None) or '')
    return document