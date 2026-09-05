'Gắn chuyển cảnh CapCut-like: 1-cho-tất-cả / random + map FFmpeg xfade.'
from __future__ import annotations
import random
from typing import Sequence
from core.video_look import TRANSITION_DEFAULT_RANDOM_POOL, TRANSITION_LABEL_BY_STYLE, TRANSITION_MS_BY_STYLE, TRANSITION_STYLE_IDS, TRANSITION_XFADE_BY_STYLE

def normalize_transition_mode(mode: str | None) -> str:
    text = str(mode or 'one_for_all').strip().lower()
    return 'random' if text in frozenset({'rand', 'random', 'ngẫu nhiên'}) else 'one_for_all'

def normalize_transition_style(style: str | None) -> str:
    text = str(style or 'fade').strip().lower()
    return 'cut' if text in frozenset({'', 'none'}) else 'hblur' if text == 'blur_fade' else text if text in TRANSITION_STYLE_IDS else 'fade'

def normalize_random_pool(pool: object | None) -> list[str]:
    if pool is None:
        pass
    elif isinstance(pool, (list, tuple)):
        out = []
        seen = set()
        for item in pool:
            style = normalize_transition_style(str(item or ''))
            if style == 'cut' or style in seen or style not in TRANSITION_STYLE_IDS:
                pass
            else:
                seen.add(style)
                out.append(style)
        return out
    return list(TRANSITION_DEFAULT_RANDOM_POOL)

def style_duration_ms(style: str, fallback_ms: int=250) -> int:
    style = normalize_transition_style(style)
    if style == 'cut':
        return 0
    preset = int(TRANSITION_MS_BY_STYLE.get(style, 0) or 0)
    return max(0, min(2000, preset)) if preset > 0 else max(0, min(2000, int(fallback_ms or 0)))

def style_label(style: str) -> str:
    style = normalize_transition_style(style)
    return TRANSITION_LABEL_BY_STYLE.get(style, style)

def style_xfade_name(style: str) -> str:
    style = normalize_transition_style(style)
    return str(TRANSITION_XFADE_BY_STYLE.get(style, 'fade') or '')

def resolve_join_styles(join_count: int, *, mode: str, style: str, random_pool: Sequence[str] | None, seed: int | None) -> list[str]:
    n = max(0, int(join_count))
    if n <= 0:
        return []
    mode_id = normalize_transition_mode(mode)
    if mode_id != 'random':
        one = normalize_transition_style(style)
        return [one] * n
    pool = list(TRANSITION_DEFAULT_RANDOM_POOL) if random_pool is None else normalize_random_pool(random_pool)
    if pool:
        rng = random.Random(seed)
        return [pool[rng.randrange(len(pool))] for _ in range(n)]
    return ['cut'] * n

def uses_real_xfade(styles: Sequence[str], fade_ms: int) -> bool:
    return False if int(fade_ms or 0) <= 0 or len(styles) == 0 else any((style_xfade_name(s) for s in styles))

def effective_transition_ms(values: dict) -> int:
    ms = int(values.get('timeline_transition_ms', 0) or 0)
    style = normalize_transition_style(str(values.get('timeline_transition_style', 'fade') or 'fade'))
    return max(0, min(2000, ms)) if ms > 0 else style_duration_ms(style, 400) if style != 'cut' else 0

def resolve_random_apply_ms(ms: int) -> int:
    n = int(ms or 0)
    return 250 if n <= 0 else max(1, min(2000, n))

def resolve_library_apply_ms(user_ms: int, style: str) -> int:
    n = int(user_ms or 0)
    return max(1, min(2000, n)) if n > 0 else style_duration_ms(style, 250)

def resolve_preview_transition_hit(position_ms: int, clip_spans: Sequence[tuple[int, int]], *, fade_ms: int, mode: str, style: str, random_pool: Sequence[str] | None, seed: int | None) -> tuple[str, float] | None:
    spans = [(max(0, int(s)), max(1, int(d))) for s, d in clip_spans]
    if len(spans) < 2:
        return None
    joins = len(spans) - 1
    styles = resolve_join_styles(joins, mode=mode, style=style, random_pool=random_pool, seed=seed)
    base_ms = max(0, int(fade_ms or 0))
    pos = max(0, int(position_ms))
    best = None
    best_t = -1.0
    for index, (start, dur) in enumerate(spans):
        end = start + dur
        if start <= pos < end:
            join_style = normalize_transition_style(styles[index])
            next_dur = spans[index + 1][1]
            edge = int(round(join_edge_seconds(join_style, fade_ms=base_ms or style_duration_ms(join_style, 400), prev_dur_s=dur / 1000.0, next_dur_s=next_dur / 1000.0) * 1000.0))
            edge = max(40, edge)
            remain = end - pos
            t = 1.0 - remain / float(edge)
            if index < joins and join_style != 'cut' and style_xfade_name(join_style) and (remain < edge) and (t > best_t):
                best_t = t
                best = (join_style, max(0.0, min(1.0, t)))
            join_style = normalize_transition_style(styles[index - 1])
            prev_dur = spans[index - 1][1]
            edge = int(round(join_edge_seconds(join_style, fade_ms=base_ms or style_duration_ms(join_style, 400), prev_dur_s=prev_dur / 1000.0, next_dur_s=dur / 1000.0) * 1000.0))
            edge = max(40, edge)
            into = pos - start
            t = 1.0 - into / float(edge)
            if index > 0 and join_style != 'cut' and style_xfade_name(join_style) and (into < edge) and (t > best_t):
                best_t = t
                best = (join_style, max(0.0, min(1.0, t)))
            return best
    return best

def join_edge_seconds(style: str, *, fade_ms: int, prev_dur_s: float, next_dur_s: float) -> float:
    fade_s = max(0.0, min(2.0, float(fade_ms or 0) / 1000.0))
    if fade_s <= 0.001:
        pass
    else:
        style_id = normalize_transition_style(style)
        if style_id != 'cut' and style_xfade_name(style_id):
            edge = min(fade_s, max(0.05, float(prev_dur_s)) / 3.0, max(0.05, float(next_dur_s)) / 3.0)
            return max(0.05, edge) if fade_s > 0.001 else 0.0
    return 0.0

def timeline_output_duration_seconds(segment_dur_s: Sequence[float], join_styles: Sequence[str] | None, *, fade_ms: int, overlap: bool) -> float:
    durs = [max(0.05, float(d)) for d in segment_dur_s]
    if not durs:
        return 0.0
    if len(durs) == 1:
        return durs[0]
    styles = list(join_styles or [])
    while len(styles) < len(durs) - 1:
        styles.append('fade')
    styles = styles[:len(durs) - 1]
    if overlap and uses_real_xfade(styles, fade_ms):
        accum = durs[0]
        for index in range(1, len(durs)):
            edge = join_edge_seconds(styles[index - 1], fade_ms=fade_ms, prev_dur_s=durs[index - 1], next_dur_s=durs[index])
            if edge <= 0.001:
                accum += durs[index]
            else:
                accum = accum + durs[index] - edge
        return float(accum)
    return float(sum(durs))

def timeline_output_duration_ms(clips: Sequence[object], *, fade_ms: int, join_styles: Sequence[str] | None, overlap: bool) -> int:
    durs = [max(0.05, float(getattr(c, 'duration_ms', 0) or 0) / 1000.0) for c in clips]
    if durs:
        sec = timeline_output_duration_seconds(durs, join_styles, fade_ms=int(fade_ms or 0), overlap=bool(overlap))
        return max(1, int(round(sec * 1000.0)))
    return 0

def build_xfade_video_chain(segment_labels: Sequence[str], segment_dur_s: Sequence[float], join_styles: Sequence[str], *, fade_ms: int, video_out: str) -> list[str]:
    labels = [str(x) for x in segment_labels]
    durs = [max(0.05, float(d)) for d in segment_dur_s]
    if not labels:
        raise ValueError('Không có segment video')
    if len(labels) == 1:
        return [f'[{labels[0]}]null[{video_out}]']
    styles = list(join_styles)
    while len(styles) < len(labels) - 1:
        styles.append('fade')
    styles = styles[:len(labels) - 1]
    filters = []
    tb_labels = [f'{lab}tb' for lab in labels]
    for lab, tb in zip(labels, tb_labels):
        filters.append(f'[{lab}]settb=AVTB,setpts=PTS-STARTPTS[{tb}]')
    current = tb_labels[0]
    accum = durs[0]
    for index in range(1, len(labels)):
        nxt = tb_labels[index]
        style = normalize_transition_style(styles[index - 1])
        xfade = style_xfade_name(style)
        edge = join_edge_seconds(style, fade_ms=fade_ms, prev_dur_s=durs[index - 1], next_dur_s=durs[index])
        out_lab = video_out if index == len(labels) - 1 else f'vx{index}'
        if style == 'cut' or not xfade or edge <= 0.001:
            filters.append(f'[{current}][{nxt}]concat=n=2:v=1:a=0[{out_lab}]')
            accum += durs[index]
        else:
            offset = max(0.0, accum - edge)
            filters.append(f'[{current}][{nxt}]xfade=transition={xfade}:duration={edge:.3f}:offset={offset:.3f}[{out_lab}]')
            accum = accum + durs[index] - edge
        if out_lab != video_out:
            tb_out = f'{out_lab}tb'
            filters.append(f'[{out_lab}]settb=AVTB,setpts=PTS-STARTPTS[{tb_out}]')
            current = tb_out
        else:
            current = out_lab
    return filters

def build_acrossfade_audio_chain(segment_labels: Sequence[str], join_styles: Sequence[str], *, fade_ms: int, audio_out: str, segment_dur_s: Sequence[float] | None, preserve_duration: bool) -> list[str]:
    labels = [str(x) for x in segment_labels]
    if not labels:
        return []
    if len(labels) == 1:
        return [f'[{labels[0]}]anull[{audio_out}]']
    fade_s = max(0.0, min(2.0, float(fade_ms) / 1000.0))
    styles = list(join_styles)
    while len(styles) < len(labels) - 1:
        styles.append('fade')
    styles = styles[:len(labels) - 1]
    durs = None
    if segment_dur_s is not None and len(segment_dur_s) >= len(labels):
        durs = [max(0.05, float(d)) for d in segment_dur_s[:len(labels)]]
    filters = []
    current = labels[0]
    for index in range(1, len(labels)):
        nxt = labels[index]
        style = normalize_transition_style(styles[index - 1])
        out_lab = audio_out if index == len(labels) - 1 else f'{audio_out}_x{index}'
        if preserve_duration:
            filters.append(f'[{current}][{nxt}]concat=n=2:v=0:a=1[{out_lab}]')
        else:
            edge = join_edge_seconds(style, fade_ms=fade_ms, prev_dur_s=durs[index - 1], next_dur_s=durs[index]) if durs is not None else fade_s if style != 'cut' and fade_s > 0.001 else 0.0
            if style == 'cut' or edge <= 0.001:
                filters.append(f'[{current}][{nxt}]concat=n=2:v=0:a=1[{out_lab}]')
            else:
                filters.append(f'[{current}][{nxt}]acrossfade=d={edge:.3f}:c1=tri:c2=tri[{out_lab}]')
        current = out_lab
    return filters