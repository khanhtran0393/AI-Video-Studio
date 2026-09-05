'FX gắn lúc tách cảnh: phản chiếu, cắt/dãn, kéo méo trong khung crop.\n\nMặc định tắt. Random khóa seed lúc tách — không đổi khi scrub/xuất lại.\nÂm thanh / TTS / SRT không đụng: chỉ chỉnh cửa sổ video (trim head/tail)\nrồi setpts cho khớp duration cảnh gốc. Kéo méo chỉ trong khung con sau crop.\n'
from __future__ import annotations
import random
from typing import Any
from dataclasses import replace
from core.timeline_clips import TimelineClip
SCENE_MIRROR_MODES = ('off', 'all', 'random', 'alternate')
SCENE_WARP_MODES = ('off', 'random')
SCENE_TRIM_SIDES = ('off', 'head', 'tail', 'both', 'random_one')
SCENE_TRIM_SIDE_LABELS = {'off': 'Tắt', 'head': 'Cắt đầu rồi dãn', 'tail': 'Cắt đuôi rồi dãn', 'both': 'Cắt hai đầu rồi dãn', 'random_one': 'Ngẫu nhiên một phía rồi dãn'}
SCENE_MIRROR_LABELS = {'off': 'Tắt', 'all': 'Mọi cảnh · lật ngang (một chiều)', 'random': 'Ngẫu nhiên mỗi cảnh', 'alternate': 'Luân phiên 1 giữ · 2 lật'}
SCENE_WARP_LABELS = {'off': 'Tắt', 'random': 'Ngẫu nhiên mỗi cảnh'}
SCENE_TRIM_MS_CHOICES = (100, 200, 300, 500, 800, 1000, 1500)
MIN_STRETCH_REMAIN_MS = 400
MAX_SCENE_TRIM_MS = 1500
MIN_SCENE_WARP_PERCENT = 100
MAX_SCENE_WARP_PERCENT = 200

def adjust_advanced_enabled(values: dict[str, Any] | None) -> bool:
    return True if not values or 'adjust_advanced_enabled' not in values else bool(values.get('adjust_advanced_enabled'))

def adjust_frame_enabled(values: dict[str, Any] | None) -> bool:
    return True if not values or 'adjust_frame_enabled' not in values else bool(values.get('adjust_frame_enabled'))

def adjust_scene_group_enabled(values: dict[str, Any] | None) -> bool:
    return (True if not values or 'adjust_scene_group_enabled' not in values else bool(values.get('adjust_scene_group_enabled'))) if adjust_advanced_enabled(values) else False
_FRAME_IDENTITY = {'offset_x': 0, 'offset_y': 0, 'scale_percent': 100, 'scale_x_percent': 100, 'scale_y_percent': 100, 'crop_enabled': False, 'mirror_enabled': False, 'rotation_degrees': 0}

def apply_frame_adjust_gate(values: dict[str, Any] | None) -> dict[str, Any]:
    data = values or {}
    if adjust_frame_enabled(data):
        return data
    out = dict(data)
    out.update(_FRAME_IDENTITY)
    return out

def _strip_frame_transform_from_clip(clip: TimelineClip) -> TimelineClip:
    return replace(clip, scale_percent=100, scale_x_percent=100, scale_y_percent=100, offset_x=0, offset_y=0)

def _strip_scene_fx_from_clip(clip: TimelineClip) -> TimelineClip:
    return replace(clip, mirror_hflip=False, video_trim_head_ms=0, video_trim_tail_ms=0, warp_x_percent=100, warp_y_percent=100)

def _merge_track0_clips(clips: list[TimelineClip]) -> TimelineClip:
    ordered = sorted(clips, key=lambda c: int(c.timeline_start_ms))
    first = ordered[0]
    path = str(first.source_path or '').strip()
    return replace(first, source_in_ms=min((int(c.source_in_ms) for c in ordered)), source_out_ms=max((int(c.source_out_ms) for c in ordered)), timeline_start_ms=0, source_path=path, track_index=0, mirror_hflip=False, video_trim_head_ms=0, video_trim_tail_ms=0, warp_x_percent=100, warp_y_percent=100)
FACE_PLATE_STASH_KEY = '_face_plate_transform_stash'

def stash_face_plate_transform(values: dict[str, Any] | None) -> dict[str, Any]:
    from core.timeline_clips import clamp_track_index, clips_from_values
    out = dict(values or {})
    clips = clips_from_values(out)
    out[FACE_PLATE_STASH_KEY] = {'scale_percent': int(out.get('scale_percent', 100) or 100), 'scale_x_percent': int(out.get('scale_x_percent', out.get('scale_percent', 100)) or 100), 'scale_y_percent': int(out.get('scale_y_percent', out.get('scale_percent', 100)) or 100), 'offset_x': int(out.get('offset_x', 0) or 0), 'offset_y': int(out.get('offset_y', 0) or 0), 'clips': [{'id': str(c.id), 'scale_percent': int(c.scale_percent), 'scale_x_percent': int(c.scale_x_percent), 'scale_y_percent': int(c.scale_y_percent), 'offset_x': int(c.offset_x), 'offset_y': int(c.offset_y)} for c in clips if clamp_track_index(c.track_index) == 0]}
    return out

def restore_face_plate_transform(values: dict[str, Any] | None) -> dict[str, Any]:
    from dataclasses import replace
    from core.timeline_clips import clamp_track_index, clips_from_values, write_clips
    out = dict(values or {})
    stash = out.get(FACE_PLATE_STASH_KEY)
    if isinstance(stash, dict):
        out['scale_percent'] = int(stash.get('scale_percent', 100) or 100)
        out['scale_x_percent'] = int(stash.get('scale_x_percent', stash.get('scale_percent', 100)) or 100)
        out['scale_y_percent'] = int(stash.get('scale_y_percent', stash.get('scale_percent', 100)) or 100)
        out['offset_x'] = int(stash.get('offset_x', 0) or 0)
        out['offset_y'] = int(stash.get('offset_y', 0) or 0)
        by_id = {str(item.get('id') or ''): item for item in stash.get('clips') or [] if isinstance(item, dict) and str(item.get('id') or '').strip()}
        clips = clips_from_values(out)
        if clips and by_id:
            restored = []
            for clip in clips:
                if clamp_track_index(clip.track_index) != 0:
                    restored.append(clip)
                else:
                    item = by_id.get(str(clip.id))
                    if item is None:
                        restored.append(clip)
                    else:
                        restored.append(replace(clip, scale_percent=int(item.get('scale_percent', 100) or 100), scale_x_percent=int(item.get('scale_x_percent', 100) or 100), scale_y_percent=int(item.get('scale_y_percent', 100) or 100), offset_x=int(item.get('offset_x', 0) or 0), offset_y=int(item.get('offset_y', 0) or 0)))
            write_clips(out, restored)
    return out

def clear_face_plate_transform(values: dict[str, Any] | None) -> dict[str, Any]:
    from core.timeline_clips import clamp_track_index, clips_from_values, write_clips
    data = dict(values or {})
    if effective_auto_face_reframe(data):
        return data
    out = dict(data)
    out['scale_percent'] = 100
    out['scale_x_percent'] = 100
    out['scale_y_percent'] = 100
    out['offset_x'] = 0
    out['offset_y'] = 0
    clips = clips_from_values(out)
    if clips:
        stripped = [_strip_frame_transform_from_clip(c) for c in clips]
        write_clips(out, stripped)
    return out

def sanitize_timeline_clips_for_export(values: dict[str, Any] | None, clips: list[TimelineClip]) -> list[TimelineClip]:
    if clips:
        from core.timeline_clips import clamp_track_index, clips_on_track, layout_clips
        scene_on = adjust_scene_group_enabled(values)
        frame_on = adjust_frame_enabled(values)
        out = list(clips)
        if not frame_on:
            out = [_strip_frame_transform_from_clip(c) for c in out]
        if not scene_on:
            out = [_strip_scene_fx_from_clip(c) for c in out]
            track0 = clips_on_track(out, 0)
            if len(track0) > 1:
                paths = {str(c.source_path or '').strip() for c in track0}
                if len(paths) == 1:
                    merged = _merge_track0_clips(track0)
                    other = [c for c in out if clamp_track_index(c.track_index) != 0]
                    out = layout_clips([merged] + other)
        return out
    return clips

def _apply_panel_transform_to_single_track0(values: dict[str, Any], clips: list[TimelineClip]) -> list[TimelineClip]:
    from core.timeline_clips import clamp_track_index, transform_from_values
    track0 = [c for c in clips if clamp_track_index(c.track_index) == 0]
    if len(track0) != 1:
        return clips
    xform = transform_from_values(values)
    only = track0[0]
    patched = replace(only, scale_percent=int(xform['scale_percent']), scale_x_percent=int(xform['scale_x_percent']), scale_y_percent=int(xform['scale_y_percent']), offset_x=int(xform['offset_x']), offset_y=int(xform['offset_y']))
    return [patched if c is only else c for c in clips]

def prepare_values_for_export(values: dict[str, Any] | None) -> dict[str, Any]:
    from core.timeline_clips import clips_from_values, write_clips
    out = apply_frame_adjust_gate(dict(values or {}))
    clips = sanitize_timeline_clips_for_export(out, clips_from_values(out))
    if clips and adjust_frame_enabled(out):
        clips = _apply_panel_transform_to_single_track0(out, clips)
    if clips:
        write_clips(out, clips)
    return out

def scene_feature_enabled(values: dict[str, Any] | None, enabled_key: str, mode_key: str) -> bool:
    if adjust_scene_group_enabled(values):
        data = values or {}
        return bool(data.get(enabled_key)) if enabled_key in data else str(data.get(mode_key) or 'off').strip().lower() not in frozenset({'', 'off'})
    return False

def effective_auto_scene_split(values: dict[str, Any] | None) -> bool:
    return adjust_scene_group_enabled(values) and bool((values or {}).get('batch_auto_scene_split'))

def effective_auto_face_reframe(values: dict[str, Any] | None) -> bool:
    return adjust_advanced_enabled(values) and bool((values or {}).get('batch_auto_face_reframe'))

def effective_scene_mirror_mode(values: dict[str, Any] | None) -> str:
    if scene_feature_enabled(values, 'scene_mirror_enabled', 'scene_mirror_mode'):
        mode = normalize_scene_mirror_mode((values or {}).get('scene_mirror_mode'))
        return 'all' if mode == 'off' else mode
    return 'off'

def effective_scene_trim_side(values: dict[str, Any] | None) -> str:
    if scene_feature_enabled(values, 'scene_trim_enabled', 'scene_trim_side'):
        side = normalize_scene_trim_side((values or {}).get('scene_trim_side'))
        return 'both' if side == 'off' else side
    return 'off'

def effective_scene_warp_mode(values: dict[str, Any] | None) -> str:
    if scene_feature_enabled(values, 'scene_warp_enabled', 'scene_warp_mode'):
        mode = normalize_scene_warp_mode((values or {}).get('scene_warp_mode'))
        return 'random' if mode == 'off' else mode
    return 'off'

def normalize_scene_mirror_mode(value: object) -> str:
    text = str(value or 'off').strip().lower()
    return text if text in SCENE_MIRROR_MODES else 'off'

def normalize_scene_warp_mode(value: object) -> str:
    text = str(value or 'off').strip().lower()
    return text if text in SCENE_WARP_MODES else 'off'

def normalize_scene_warp_percent(value: object, default: int=100) -> int:
    try:
        raw = int(value if value is not None else default)
    except (TypeError, ValueError):
        raw = default
    return max(MIN_SCENE_WARP_PERCENT, min(MAX_SCENE_WARP_PERCENT, raw))

def normalize_scene_warp_range(lo: object, hi: object) -> tuple[int, int]:
    a = normalize_scene_warp_percent(lo, 100)
    b = normalize_scene_warp_percent(hi, 120)
    if a > b:
        b, a = (a, b)
    return (a, b)

def pick_scene_warp_xy(rng: random.Random, *, x_min: int, x_max: int, y_min: int, y_max: int, uniform: bool) -> tuple[int, int]:
    xmin, xmax = normalize_scene_warp_range(x_min, x_max)
    ymin, ymax = normalize_scene_warp_range(y_min, y_max)
    if uniform:
        lo = max(xmin, ymin)
        hi = min(xmax, ymax)
        if lo <= hi:
            value = rng.randint(lo, hi)
            return (value, value)
        value = rng.randint(xmin, xmax)
        return (value, max(ymin, min(ymax, value)))
    return (rng.randint(xmin, xmax), rng.randint(ymin, ymax))

def warp_inside_box_filter(warp_x_percent: int, warp_y_percent: int) -> str:
    wx = normalize_scene_warp_percent(warp_x_percent, 100) / 100.0
    wy = normalize_scene_warp_percent(warp_y_percent, 100) / 100.0
    return '' if abs(wx - 1.0) < 0.005 and abs(wy - 1.0) < 0.005 else f"scale=iw*{wx:.4f}:ih*{wy:.4f}:flags=lanczos,crop='trunc(iw/{wx:.4f}/2)*2':'trunc(ih/{wy:.4f}/2)*2':(iw-ow)/2:(ih-oh)/2"

def normalize_scene_trim_side(value: object) -> str:
    text = str(value or 'off').strip().lower()
    return text if text in SCENE_TRIM_SIDES else 'off'

def normalize_scene_trim_ms(value: object) -> int:
    try:
        raw = int(value if value is not None else 200)
    except (TypeError, ValueError):
        raw = 200
    raw = max(100, min(MAX_SCENE_TRIM_MS, raw))
    return min(SCENE_TRIM_MS_CHOICES, key=lambda item: abs(item - raw))

def _scene_fx_seed(values: dict[str, Any]) -> int:
    try:
        seed = int(values.get('scene_fx_seed', 0) or 0)
    except (TypeError, ValueError):
        seed = 0
    if seed <= 0:
        seed = random.SystemRandom().randint(1, 2147483647)
        values['scene_fx_seed'] = seed
    return seed

def apply_scene_clip_fx(clips: list[TimelineClip], values: dict[str, Any]) -> list[TimelineClip]:
    mirror_mode = effective_scene_mirror_mode(values)
    trim_side = effective_scene_trim_side(values)
    trim_ms = normalize_scene_trim_ms(values.get('scene_trim_ms', 200))
    warp_mode = effective_scene_warp_mode(values)
    x_min, x_max = normalize_scene_warp_range(values.get('scene_warp_x_min', 100), values.get('scene_warp_x_max', 120))
    y_min, y_max = normalize_scene_warp_range(values.get('scene_warp_y_min', 100), values.get('scene_warp_y_max', 120))
    warp_uniform = bool(values.get('scene_warp_uniform', False))
    if mirror_mode == 'off' and trim_side == 'off' and (warp_mode == 'off'):
        return [replace(c, mirror_hflip=False, video_trim_head_ms=0, video_trim_tail_ms=0, warp_x_percent=100, warp_y_percent=100) for c in clips]
    rng = random.Random(_scene_fx_seed(values))
    out = []
    track0_index = 0
    for clip in clips:
        flip = False
        head = 0
        tail = 0
        wx = 100
        wy = 100
        is_main = int(clip.track_index) == 0
        if is_main:
            if mirror_mode == 'all':
                flip = True
            elif mirror_mode == 'alternate':
                flip = track0_index % 2 == 1
            elif mirror_mode == 'random':
                flip = rng.random() < 0.5
            if trim_side != 'off':
                head, tail = _trim_for_clip(clip, side=trim_side, trim_ms=trim_ms, rng=rng)
            if warp_mode == 'random':
                wx, wy = pick_scene_warp_xy(rng, x_min=x_min, x_max=x_max, y_min=y_min, y_max=y_max, uniform=warp_uniform)
            track0_index += 1
        out.append(replace(clip, mirror_hflip=bool(flip), video_trim_head_ms=int(head), video_trim_tail_ms=int(tail), warp_x_percent=int(wx), warp_y_percent=int(wy)))
    return out

def _trim_for_clip(clip: TimelineClip, *, side: str, trim_ms: int, rng: random.Random) -> tuple[int, int]:
    dur = max(1, int(clip.source_out_ms) - int(clip.source_in_ms))
    cut = max(100, min(MAX_SCENE_TRIM_MS, int(trim_ms)))
    chosen = side
    if chosen == 'random_one':
        chosen = 'head' if rng.random() < 0.5 else 'tail'
    head = cut if chosen in frozenset({'head', 'both'}) else 0
    tail = cut if chosen in frozenset({'both', 'tail'}) else 0
    remain = dur - head - tail
    return (0, 0) if remain < MIN_STRETCH_REMAIN_MS else (head, tail)

def clip_scene_fx_status_lines(clip: TimelineClip, values: dict[str, Any] | None=None) -> list[str]:
    values = values or {}
    side = effective_scene_trim_side(values)
    want = normalize_scene_trim_ms(values.get('scene_trim_ms', 200)) if side != 'off' else 0
    mode = SCENE_TRIM_SIDE_LABELS.get(side, side)
    head = int(getattr(clip, 'video_trim_head_ms', 0) or 0)
    tail = int(getattr(clip, 'video_trim_tail_ms', 0) or 0)
    flip = bool(getattr(clip, 'mirror_hflip', False))
    mirror_mode = effective_scene_mirror_mode(values)
    warp_mode = effective_scene_warp_mode(values)
    wx = int(getattr(clip, 'warp_x_percent', 100) or 100)
    wy = int(getattr(clip, 'warp_y_percent', 100) or 100)
    lines = []
    if side == 'off' and (not head) and (not tail):
        lines.append('Cắt/dãn: tắt')
    elif head or tail:
        lines.append(f'Chế độ: {mode}')
        actual = f'đầu {head / 1000.0:.1f}s · đuôi {tail / 1000.0:.1f}s'
        if want:
            lines.append(f'Cài {want / 1000.0:.1f}s/phía · {actual}')
        else:
            lines.append(f'ĐÃ GẮN · {actual}')
    else:
        lines.append(f'Chế độ: {mode}')
        if want:
            lines.append(f'Cài {want / 1000.0:.1f}s/phía · chưa gắn cảnh này (cảnh ngắn)')
        else:
            lines.append('Cắt/dãn: chưa gắn cảnh này')
    if flip or mirror_mode != 'off':
        mirror_name = SCENE_MIRROR_LABELS.get(mirror_mode, mirror_mode)
        if flip:
            lines.append(f'Lật xen kẽ: {mirror_name} · cảnh này ĐÃ LẬT')
        else:
            lines.append(f'Lật xen kẽ: {mirror_name} · cảnh này GIỮ NGUYÊN')
    if warp_mode != 'off' or wx != 100 or wy != 100:
        warp_name = SCENE_WARP_LABELS.get(warp_mode, warp_mode)
        if wx == 100 and wy == 100:
            lines.append(f'Kéo méo: {warp_name} · cảnh này GIỮ NGUYÊN')
            return lines
        lines.append(f'Kéo méo: {warp_name} · cảnh này Ngang {wx}% · Dọc {wy}%')
    else:
        return lines

def clip_scene_fx_status(clip: TimelineClip, values: dict[str, Any] | None=None) -> str:
    return '\n'.join(clip_scene_fx_status_lines(clip, values))

def summarize_scene_trim(clips: list[TimelineClip]) -> tuple[int, int, int]:
    applied = 0
    skipped = 0
    max_cut = 0
    for clip in clips:
        if int(clip.track_index) != 0:
            pass
        else:
            head = int(clip.video_trim_head_ms or 0)
            tail = int(clip.video_trim_tail_ms or 0)
            if head or tail:
                applied += 1
                max_cut = max(max_cut, head, tail)
            else:
                skipped += 1
    return (applied, skipped, max_cut)