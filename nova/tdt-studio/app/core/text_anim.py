from __future__ import annotations
import math
import re
from dataclasses import dataclass
SUBTITLE_ANIM_CHOICES: 'tuple[tuple[str, str], ...]' = (('Không (chữ tĩnh)', 'none'), ('Karaoke — bôi màu theo từ', 'karaoke'), ('Karaoke — bôi từng chữ', 'karaoke_char'), ('Hiện từng từ', 'word'), ('Hiện từng chữ', 'char'), ('Hiện từng từ + fade', 'word_fade'), ('Fade vào / ra', 'fade'), ('Pop phóng to', 'pop'), ('Zoom vào', 'zoom_in'), ('Zoom ra', 'zoom_out'), ('Bounce nảy', 'bounce'), ('Trượt lên', 'slide_up'), ('Trượt xuống', 'slide_down'), ('Trượt trái', 'slide_left'), ('Trượt phải', 'slide_right'), ('Xoay vào', 'rotate_in'), ('Flash nháy', 'flash'), ('Shake rung', 'shake'))
_REVEAL_MODES = frozenset({'word', 'word_fade', 'char'})
_KARAOKE_MODES = frozenset({'karaoke', 'karaoke_char'})
_SLIDE_MODES = frozenset({'slide_right', 'slide_up', 'slide_left', 'slide_down'})
_WORD_RE = re.compile('\\S+|\\s+')
TITLE_ANIM_CHOICES: 'tuple[tuple[str, str], ...]' = (('Không (chữ tĩnh)', 'none'), ('Flash nháy', 'flash'), ('Shake rung', 'shake'), ('Bounce nảy', 'bounce'), ('Fade vào / ra', 'fade'))
TITLE_ANIM_IDS = frozenset((item[1] for item in TITLE_ANIM_CHOICES))

def normalize_title_anim(value: object) -> str:
    text = str(value or 'none').strip().lower()
    return text if text in TITLE_ANIM_IDS else 'none'

@dataclass(frozen=True)
class AnimToken:
    text: 'str'
    is_space: 'bool'

@dataclass(frozen=True)
class AnimPreviewState:
    opacity: 'float' = 1.0
    scale: 'float' = 1.0
    offset_x: 'float' = 0.0
    offset_y: 'float' = 0.0
    rotation: 'float' = 0.0
    karaoke_fill: 'float | None' = None
    reveal_mode: 'str | None' = None

def normalize_subtitle_anim(value: object) -> str:
    text = str(value or 'none').strip().lower()
    allowed = {item[1] for item in SUBTITLE_ANIM_CHOICES}
    return text if text in allowed else 'none'

def segment_progress(position_ms: int, start_ms: int, end_ms: int) -> float:
    start = int(start_ms)
    end = max(start + 1, int(end_ms))
    pos = max(start, min(end, int(position_ms)))
    return (pos - start) / float(end - start)

def tokenize_words(text: str) -> list[AnimToken]:
    parts = _WORD_RE.findall(str(text or ''))
    return [AnimToken(part, part.isspace()) for part in parts if part]

def tokenize_chars(text: str) -> list[AnimToken]:
    return [AnimToken(ch, ch.isspace()) for ch in str(text or '')]

def _ease_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, float(t)))
    return 1.0 - (1.0 - t) ** 3

def _entrance_t(progress: float, settle: float=0.28) -> float:
    p = max(0.0, min(1.0, float(progress)))
    span = max(0.05, min(0.6, float(settle)))
    return 1.0 if p >= span else _ease_out_cubic(p / span)

def visible_prefix_text(text: str, progress: float, *, mode: str) -> str:
    mode = normalize_subtitle_anim(mode)
    if mode == 'word_fade':
        mode = 'word'
    progress = max(0.0, min(1.0, float(progress)))
    if mode == 'word':
        tokens = tokenize_words(text)
        content = [t for t in tokens if not t.is_space]
        if content:
            count = max(1, int(round(len(content) * progress))) if progress > 0 else 0
            if count <= 0:
                return ''
            seen = 0
            out = []
            for token in tokens:
                if token.is_space:
                    if seen < count and out:
                        out.append(token.text)
                else:
                    seen += 1
                    if seen > count:
                        break
                    out.append(token.text)
            return ''.join(out)
    elif mode == 'char':
        raw = str(text or '')
        if progress <= 0:
            return ''
        count = max(1, int(round(len(raw) * progress)))
        return raw[:count]
    return str(text or '')

def karaoke_fill_ratio(progress: float) -> float:
    return max(0.0, min(1.0, float(progress)))

def fade_alpha_factor(progress: float, *, fade_in: float, fade_out: float) -> float:
    p = max(0.0, min(1.0, float(progress)))
    fi = max(0.02, min(0.45, float(fade_in)))
    fo = max(0.02, min(0.45, float(fade_out)))
    return p / fi if p < fi else max(0.0, (1.0 - p) / fo) if p > 1.0 - fo else 1.0

def pop_scale_factor(progress: float, *, settle: float) -> float:
    t = _entrance_t(progress, settle)
    return 0.8 + 0.2 * t

def zoom_in_scale_factor(progress: float) -> float:
    t = _entrance_t(progress, 0.32)
    return 0.35 + 0.65 * t

def zoom_out_scale_factor(progress: float) -> float:
    t = _entrance_t(progress, 0.32)
    return 1.45 - 0.45 * t

def bounce_scale_factor(progress: float) -> float:
    p = max(0.0, min(1.0, float(progress)))
    if p >= 0.42:
        return 1.0
    t = p / 0.42
    return 0.35 + 0.95 * (t / 0.55) if t < 0.55 else 1.3 - 0.35 * ((t - 0.55) / 0.25) if t < 0.8 else 0.95 + 0.05 * ((t - 0.8) / 0.2)

def flash_alpha_factor(progress: float) -> float:
    p = max(0.0, min(1.0, float(progress)))
    if p >= 0.28:
        return 1.0
    phase = int(p / 0.28 * 6.0)
    return 1.0 if phase % 2 == 0 else 0.15

def shake_offset(progress: float, *, amplitude: float) -> tuple[float, float]:
    p = max(0.0, min(1.0, float(progress)))
    if p >= 0.35:
        return (0.0, 0.0)
    damp = 1.0 - p / 0.35
    wave = math.sin(p * math.pi * 14.0) * amplitude * damp
    return (wave, -wave * 0.35)

def slide_offset(progress: float, *, mode: str, distance: float) -> tuple[float, float]:
    t = _entrance_t(progress, 0.3)
    remain = 1.0 - t
    dist = float(distance)
    mode = normalize_subtitle_anim(mode)
    return (0.0, dist * remain) if mode == 'slide_up' else (0.0, -dist * remain) if mode == 'slide_down' else (dist * remain, 0.0) if mode == 'slide_left' else (-dist * remain, 0.0) if mode == 'slide_right' else (0.0, 0.0)

def rotate_in_degrees(progress: float) -> float:
    t = _entrance_t(progress, 0.3)
    return -18.0 * (1.0 - t)

def preview_anim_state(progress: float, mode: str) -> AnimPreviewState:
    mode = normalize_subtitle_anim(mode)
    p = max(0.0, min(1.0, float(progress)))
    if mode == 'none':
        pass
    else:
        if mode in _KARAOKE_MODES:
            return AnimPreviewState(karaoke_fill=karaoke_fill_ratio(p))
        if mode in _REVEAL_MODES:
            reveal = 'word' if mode == 'word_fade' else mode
            opacity = fade_alpha_factor(p, fade_in=0.08, fade_out=0.1) if mode == 'word_fade' else 1.0
            return AnimPreviewState(opacity=opacity, reveal_mode=reveal)
        if mode == 'fade':
            return AnimPreviewState(opacity=fade_alpha_factor(p))
        if mode == 'pop':
            return AnimPreviewState(scale=pop_scale_factor(p), opacity=fade_alpha_factor(p, fade_in=0.08, fade_out=0.12))
        if mode == 'zoom_in':
            return AnimPreviewState(scale=zoom_in_scale_factor(p), opacity=fade_alpha_factor(p, fade_in=0.1, fade_out=0.12))
        if mode == 'zoom_out':
            return AnimPreviewState(scale=zoom_out_scale_factor(p), opacity=fade_alpha_factor(p, fade_in=0.1, fade_out=0.12))
        if mode == 'bounce':
            return AnimPreviewState(scale=bounce_scale_factor(p), opacity=fade_alpha_factor(p, fade_in=0.06, fade_out=0.1))
        if mode in _SLIDE_MODES:
            dx, dy = (slide_offset(p, mode=mode)[0], slide_offset(p, mode=mode)[1])
            return AnimPreviewState(offset_x=dx, offset_y=dy, opacity=fade_alpha_factor(p, fade_in=0.12, fade_out=0.12))
        if mode == 'rotate_in':
            return AnimPreviewState(rotation=rotate_in_degrees(p), scale=0.88 + 0.12 * _entrance_t(p, 0.3), opacity=fade_alpha_factor(p, fade_in=0.12, fade_out=0.12))
        if mode == 'flash':
            return AnimPreviewState(opacity=flash_alpha_factor(p))
        if mode == 'shake':
            dx, dy = (shake_offset(p)[0], shake_offset(p)[1])
            return AnimPreviewState(offset_x=dx, offset_y=dy)
    return AnimPreviewState()

def progressive_reveal_slices(text: str, start_ms: int, end_ms: int, *, mode: str) -> list[tuple[int, int, str]]:
    mode = normalize_subtitle_anim(mode)
    if mode == 'word_fade':
        mode = 'word'
    raw = str(text or '')
    start = int(start_ms)
    end = max(start + 1, int(end_ms))
    if mode in frozenset({'word', 'char'}) and raw:
        if mode == 'char':
            units = list(raw)
            steps = len(units)
        else:
            tokens = tokenize_words(raw)
            content_idx = [i for i, t in enumerate(tokens) if not t.is_space]
            steps = len(content_idx)
            units = tokens
        if steps <= 0:
            return [(start, end, raw)]
        dur = end - start
        slices = []
        for step in range(1, steps + 1):
            slice_start = start + int(round(dur * (step - 1) / steps))
            slice_end = start + int(round(dur * step / steps))
            if slice_end <= slice_start:
                slice_end = slice_start + 1
            if step == steps:
                slice_end = end
            if mode == 'char':
                visible = ''.join(units[:step])
            else:
                seen = 0
                out = []
                for token in units:
                    if token.is_space:
                        if seen < step and out:
                            out.append(token.text)
                    else:
                        seen += 1
                        if seen > step:
                            break
                        out.append(token.text)
                visible = ''.join(out)
            slices.append((slice_start, min(end, slice_end), visible))
        return slices
    return [(start, end, raw)]

def ass_fade_tag(duration_ms: int, *, fade_ms: int) -> str:
    dur = max(1, int(duration_ms))
    fade = max(40, min(fade_ms, dur // 3))
    return f'\\fad({fade},{fade})'

def ass_pop_tag(duration_ms: int) -> str:
    dur = max(1, int(duration_ms))
    span = max(80, min(400, dur // 4))
    return f'\\fscx80\\fscy80\\t(0,{span},\\fscx100\\fscy100)'

def ass_zoom_in_tag(duration_ms: int) -> str:
    dur = max(1, int(duration_ms))
    span = max(100, min(500, dur // 3))
    return f'\\fscx35\\fscy35\\t(0,{span},\\fscx100\\fscy100)'

def ass_zoom_out_tag(duration_ms: int) -> str:
    dur = max(1, int(duration_ms))
    span = max(100, min(500, dur // 3))
    return f'\\fscx145\\fscy145\\t(0,{span},\\fscx100\\fscy100)'

def ass_bounce_tag(duration_ms: int) -> str:
    dur = max(1, int(duration_ms))
    a = max(60, min(180, dur // 8))
    b = max(a + 40, min(280, dur // 5))
    c = max(b + 40, min(400, dur // 3))
    return f'\\fscx35\\fscy35\\t(0,{a},\\fscx130\\fscy130)\\t({a},{b},\\fscx95\\fscy95)\\t({b},{c},\\fscx100\\fscy100)'

def ass_rotate_in_tag(duration_ms: int, *, base_rotation: float) -> str:
    dur = max(1, int(duration_ms))
    span = max(100, min(450, dur // 3))
    end = float(base_rotation or 0.0) % 360.0
    start = (end - 18.0) % 360.0
    return f'g\\fscx88\\fscy88\\t(0,{span},\\frz{end}g\\fscx100\\fscy100)'

def ass_flash_tag(duration_ms: int) -> str:
    dur = max(1, int(duration_ms))
    step = max(40, min(90, dur // 12))
    tags = ['\\alpha&HFF&']
    visible = False
    t = 0
    for _ in range(6):
        nxt = min(dur // 3, t + step)
        alpha = '&H00&' if visible else '&HFF&'
        tags.append(f'\\t({t},{nxt},\\alpha{alpha})')
        visible = not visible
        t = nxt
    tags.append(f'\\t({t},{t + 1},\\alpha&H00&)')
    return ''.join(tags)

def ass_shake_tag(duration_ms: int, *, pos_x: float, pos_y: float) -> str:
    dur = max(1, int(duration_ms))
    span = max(120, min(360, dur // 3))
    amp = 8.0
    return f',\\pos({pos_x - amp}.1f,{pos_y + amp * 0.3}.1f))\\t({span // 3},{2 * span // 3},\\pos({pos_x + amp * 0.6}.1f,{pos_y}.1f))\\t({2 * span // 3},{span},\\pos({pos_x}.1f,{pos_y}.1f))'

def ass_slide_move_tag(duration_ms: int, *, mode: str, pos_x: float, pos_y: float, distance: float) -> str:
    dur = max(1, int(duration_ms))
    move_ms = max(80, min(500, dur // 3))
    dist = float(distance)
    mode = normalize_subtitle_anim(mode)
    y1, x1 = (pos_y, pos_x)
    if mode == 'slide_up':
        y1 = pos_y + dist
    elif mode == 'slide_down':
        y1 = pos_y - dist
    elif mode == 'slide_left':
        x1 = pos_x + dist
    elif mode == 'slide_right':
        x1 = pos_x - dist
    return f'{y1}.1f,{pos_x}.1f,{pos_y}.1f,0,{move_ms})'

def build_ass_karaoke_text(text: str, duration_ms: int, *, by_char: bool, word_timings: list[tuple[str, int]] | tuple[tuple[str, int], ...] | None) -> str:
    raw = str(text or '')
    if not raw:
        return ''
    if word_timings and (not by_char):
        parts = []
        for i, item in enumerate(word_timings):
            word = str(item[0] or '')
            dur_ms = max(30, int(item[1] or 0))
            if item and word.strip():
                cs = max(1, int(round(dur_ms / 10.0)))
                if i > 0:
                    parts.append(' ')
                parts.append(f'{{\\k{cs}}}{_escape_ass_fragment(word.strip())}')
        if parts:
            return ''.join(parts)
    else:
        if by_char:
            units = [ch for ch in raw if ch != '\n']
            if units:
                total_cs = max(len(units), int(round(duration_ms / 10.0)))
                base = total_cs // len(units)
                rem = total_cs - base * len(units)
                out = []
                idx = 0
                for ch in raw:
                    if ch == '\n':
                        out.append('\\N')
                    else:
                        cs = base + (1 if idx < rem else 0)
                        out.append(f'{{\\k{max(1, cs)}}}{_escape_ass_fragment(ch)}')
                        idx += 1
                return ''.join(out)
        else:
            tokens = tokenize_words(raw)
            content = [t for t in tokens if not t.is_space]
            if content:
                total_cs = max(len(content), int(round(duration_ms / 10.0)))
                base = total_cs // len(content)
                rem = total_cs - base * len(content)
                out = []
                idx = 0
                for token in tokens:
                    if '\n' in token.text:
                        out.append(token.text.replace('\n', '\\N'))
                    elif token.is_space:
                        out.append(token.text)
                    else:
                        cs = base + (1 if idx < rem else 0)
                        out.append(f'{{\\k{max(1, cs)}}}{_escape_ass_fragment(token.text)}')
                        idx += 1
                return ''.join(out)
        return raw.replace('\n', '\\N')

def build_ass_timed_text(text: str, duration_ms: int, *, mode: str) -> str:
    mode = normalize_subtitle_anim(mode)
    return build_ass_karaoke_text(text, duration_ms, by_char=False) if mode == 'karaoke' else build_ass_karaoke_text(text, duration_ms, by_char=True) if mode == 'karaoke_char' else build_ass_karaoke_text(text, duration_ms, by_char=True) if mode == 'char' else build_ass_karaoke_text(text, duration_ms, by_char=False) if mode in frozenset({'word', 'word_fade'}) else str(text or '').replace('\n', '\\N')

def _escape_ass_fragment(value: str) -> str:
    return str(value).replace('\\', '\\\\').replace('{', '\\{').replace('}', '\\}')

def ass_event_override(duration_ms: int, *, mode: str, pos_x: float, pos_y: float, rotation_degrees: float) -> str:
    mode = normalize_subtitle_anim(mode)
    rot = float(rotation_degrees or 0) % 360.0
    rot_tag = f'{rot}g' if abs(rot) > 0.01 and mode != 'rotate_in' else ''
    anim = ass_anim_override(duration_ms, mode=mode, pos_x=pos_x, pos_y=pos_y, rotation_degrees=rot)
    return f'\\an5{anim}{rot_tag}' if mode in _SLIDE_MODES else f'\\an5{anim}{rot_tag}' if mode == 'shake' else f'.1f,{pos_y}.1f){anim}' if mode == 'rotate_in' else f'.1f,{pos_y}.1f){rot_tag}{anim}'

def ass_anim_override(duration_ms: int, *, mode: str, pos_x: float, pos_y: float, rotation_degrees: float) -> str:
    mode = normalize_subtitle_anim(mode)
    return ass_fade_tag(duration_ms) if mode == 'fade' else ass_pop_tag(duration_ms) + ass_fade_tag(duration_ms, fade_ms=120) if mode == 'pop' else ass_zoom_in_tag(duration_ms) + ass_fade_tag(duration_ms, fade_ms=140) if mode == 'zoom_in' else ass_zoom_out_tag(duration_ms) + ass_fade_tag(duration_ms, fade_ms=140) if mode == 'zoom_out' else ass_bounce_tag(duration_ms) + ass_fade_tag(duration_ms, fade_ms=100) if mode == 'bounce' else ass_slide_move_tag(duration_ms, mode=mode, pos_x=pos_x, pos_y=pos_y) + ass_fade_tag(duration_ms, fade_ms=140) if mode in _SLIDE_MODES else ass_rotate_in_tag(duration_ms, base_rotation=rotation_degrees) + ass_fade_tag(duration_ms, fade_ms=140) if mode == 'rotate_in' else ass_flash_tag(duration_ms) if mode == 'flash' else ass_shake_tag(duration_ms, pos_x=pos_x, pos_y=pos_y) if mode == 'shake' else ass_fade_tag(duration_ms, fade_ms=100) if mode == 'word_fade' else ''