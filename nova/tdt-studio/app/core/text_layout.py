from __future__ import annotations
import re

def _hard_chunks(text: str, limit: int) -> list[str]:
    token = str(text or '')
    cap = max(4, int(limit))
    return ([token] if token else []) if len(token) <= cap else [token[index:index + cap] for index in range(0, len(token), cap)]

def _hyphen_segments(word: str) -> list[str]:
    token = str(word or '').replace('_', '-')
    parts = [part for part in re.split('(?<=-)', token) if part]
    return parts or [token]

def wrap_text_lines(text: str, max_chars: int) -> list[str]:
    raw = str(text or '').replace('\r', '')
    cleaned = ' '.join(raw.replace('_', ' ').split())
    if cleaned:
        limit = max(4, int(max_chars))
        if len(cleaned) <= limit:
            return [cleaned]
        stream = []
        for word in cleaned.split(' '):
            if len(word) <= limit:
                joiner = ' ' if stream else ''
                stream.append((word, joiner))
            elif re.search('[-]', word):
                segments = _hyphen_segments(word)
                for index, segment in enumerate(segments):
                    joiner = '' if index > 0 else ' ' if stream else ''
                    stream.append((segment, joiner))
            else:
                for index, chunk in enumerate(_hard_chunks(word, limit)):
                    joiner = ' ' if index == 0 and stream else ''
                    stream.append((chunk, joiner))
        lines = []
        current = ''
        for fragment, joiner in stream:
            candidate = f'{current}{joiner}{fragment}' if current else fragment
            if len(candidate) <= limit:
                current = candidate
            else:
                if current:
                    lines.append(current)
                if len(fragment) <= limit:
                    current = fragment
                else:
                    chunks = _hard_chunks(fragment, limit)
                    lines.extend(chunks[:-1])
                    current = chunks[-1]
        if current:
            lines.append(current)
        return lines or [cleaned[:limit]]
    return []

def estimate_max_chars_for_box(*, box_width_norm: float, scale_percent: int, font_div: float, aspect_wh: float, wrap_width_px: float | None, font_size_px: float | None, scale_x_percent: int) -> int:
    if wrap_width_px is not None and font_size_px is not None:
        return estimate_max_chars_for_pixel_width(wrap_width_px, font_size_px, scale_x_percent=scale_x_percent)
    box_w = max(0.05, float(box_width_norm))
    chars = box_w * max(0.2, float(aspect_wh)) * max(8.0, float(font_div)) / 0.5
    return max(6, int(round(chars)))

def estimate_max_chars_for_pixel_width(wrap_width_px: float, font_size_px: float, *, scale_x_percent: int) -> int:
    char_w = max(4.0, float(font_size_px) * (max(10, int(scale_x_percent)) / 100.0) * 0.55)
    return max(4, int(float(wrap_width_px) / char_w))

def clamp_box_center_norms(x_norm: float, y_norm: float, *, box_width_norm: float, box_height_norm: float) -> tuple[float, float]:
    half_w = max(0.02, min(0.5, float(box_width_norm) / 2.0))
    half_h = max(0.02, min(0.5, float(box_height_norm) / 2.0))
    return (max(half_w, min(1.0 - half_w, float(x_norm))), max(half_h, min(1.0 - half_h, float(y_norm))))

def estimate_text_block_height_px(font_size: float, scale_y_percent: int, line_count: int, *, line_height_factor: float) -> float:
    scale_y = max(10, min(500, int(scale_y_percent))) / 100.0
    lines = max(1, int(line_count))
    return max(16.0, float(font_size) * scale_y * float(line_height_factor) * lines)

def estimate_overlay_box_height_norm(scale_percent: int, font_div: float, line_count: int, *, line_height_factor: float) -> float:
    live_s = max(20, min(300, int(scale_percent))) / 100.0
    lines = max(1, int(line_count))
    return min(0.95, max(0.04, live_s / max(8.0, float(font_div)) * line_height_factor * lines))

def cap_play_res_block_height_px(block_h: float, play_res_y: int) -> float:
    height = max(2, int(play_res_y))
    return min(max(16.0, float(block_h)), max(16.0, float(height) - 4.0))

def drawtext_fontsize_expr(scale_percent: int, font_div: float=22.0) -> str:
    live_s = max(20, min(300, int(scale_percent))) / 100.0
    return f'{live_s / max(8.0, float(font_div))}g'

def drawtext_line_spacing_px(target_height: int, scale_percent: int, font_div: float=22.0, *, gap_factor: float) -> int:
    live_s = max(20, min(300, int(scale_percent))) / 100.0
    height = max(2, int(target_height))
    spacing = height * live_s / max(8.0, float(font_div)) * float(gap_factor)
    return max(0, int(round(spacing)))

def ass_libass_font_scale(font_name: str | None) -> float:
    name = str(font_name or '').strip()
    return float(_ASS_LIBASS_FONT_SCALE.get(name, 1.55)) if name else 1.55

def ass_glyph_style(font_size: float, scale_x_percent: int, scale_y_percent: int) -> tuple[int, int, int]:
    sx = max(10, min(500, int(scale_x_percent)))
    sy = max(10, min(500, int(scale_y_percent)))
    base = max(8.0, float(font_size))
    eff_font = max(8, int(round(base * sy / 100.0)))
    eff_scale_x = max(10, min(500, int(round(sx * 100.0 / max(1, sy)))))
    return (eff_font, eff_scale_x, 100)

def subtitle_block_center_y(position: str, margin_v: int, block_h: float, play_res_y: int, *, margin_refs_center: bool) -> float:
    height = max(2, int(play_res_y))
    margin = max(0, min(height - 10, int(margin_v)))
    max_block = max(16.0, float(height) - 4.0)
    block = min(max(16.0, float(block_h)), max_block)
    half_h = block / 2.0
    key = str(position or 'bottom').strip().lower()
    if key == 'top':
        pos_y = margin if margin_refs_center else margin + half_h
    elif key == 'center':
        pos_y = height / 2.0
    elif margin_refs_center:
        pos_y = height - margin
    else:
        cue_margin = min(margin, max(0, height - int(round(block)) - 2))
        pos_y = height - cue_margin - half_h
    return max(half_h, min(float(height) - half_h, pos_y))
SUBTITLE_WIDTH_BOOST: 'dict[str, float]' = {'16:9': 1.7, '9:16': 2.4, '3:4': 2.0, '4:3': 1.7, '1:1': 2.0, '4:5': 2.0, '2:3': 2.2, '21:9': 1.5}
_ASS_LIBASS_FONT_SCALE: 'dict[str, float]' = {'Be Vietnam Pro': 1.55, 'Roboto': 1.34, 'Montserrat': 1.16, 'Open Sans': 1.44, 'Oswald': 1.72, 'Lobster': 1.48, 'Pacifico': 1.84, 'Bangers': 1.73, 'Dancing Script': 1.4, 'Merriweather': 1.55, 'Source Code Pro': 1.3, 'Arial': 1.13}

def subtitle_width_boost(aspect_ratio: str='9:16') -> float:
    return SUBTITLE_WIDTH_BOOST.get(str(aspect_ratio or '9:16').strip(), 2.4)

def _is_ideographic_heavy(text: str) -> bool:
    sample = str(text or '').strip()
    if sample:
        ideo = 0
        for ch in sample:
            code = ord(ch)
            if 12352 <= code <= 12543 or 13312 <= code <= 40959 or 44032 <= code <= 55215 or (65280 <= code <= 65519) or (12288 <= code <= 12351):
                break
                ideo += 1
        else:
            return ideo >= max(1, len(sample) // 3)
    else:
        return False

def estimate_subtitle_max_chars(play_res_x: int, box_width_norm: float, *, aspect_ratio: str, scale_x_percent: int, font_size_px: float | None, text: str) -> int:
    box_w = max(0.05, float(box_width_norm))
    wrap_w = float(max(2, int(play_res_x))) * box_w
    sx = max(10, min(500, int(scale_x_percent))) / 100.0
    if font_size_px is not None and float(font_size_px) > 0:
        factor = 1.0 if _is_ideographic_heavy(text) else 0.55
        char_w = max(4.0, float(font_size_px) * sx * factor)
        return max(4, int(wrap_w / char_w))
    boost = subtitle_width_boost(aspect_ratio)
    legacy = max(15, int(int(play_res_x) // 35 * boost * box_w))
    return max(4, int(round(legacy * 0.45))) if _is_ideographic_heavy(text) else legacy

def estimate_subtitle_max_words(box_width_norm: float, *, aspect_ratio: str, scale_x_percent: int) -> int:
    boost = subtitle_width_boost(aspect_ratio)
    box_w = max(0.05, float(box_width_norm))
    return max(4, int(15 * boost * box_w))

def _flush_subtitle_line(result: list[str], current: list[str], *, join_with_space: bool, line_cap: int | None) -> list[str] | None:
    if current:
        line = ' '.join(current) if join_with_space else ''.join(current)
        result.append(line)
        if line_cap is not None and len(result) >= line_cap:
            return result[:line_cap]
    else:
        return None

def wrap_subtitle_lines(text: str, max_chars: int, *, max_lines: int | None, max_words: int) -> list[str]:
    limit = max(4, int(max_chars))
    word_cap = max(2, int(max_words))
    line_cap = None if max_lines is None else max(1, int(max_lines))
    raw = str(text or '').replace('\r', '')
    if raw.strip():
        result = []
        for paragraph in raw.split('\n'):
            cleaned = ' '.join(paragraph.split())
            if cleaned:
                words = cleaned.split()
                join_with_space = len(words) > 1
                current = []
                for word in words:
                    pieces = _hard_chunks(word, limit) if len(word) > limit else [word]
                    for piece in pieces:
                        if current:
                            joined = f"{' '.join(current)} {piece}" if join_with_space else f"{''.join(current)}{piece}"
                            if len(current) < word_cap and len(joined) <= limit:
                                current.append(piece)
                            else:
                                capped = _flush_subtitle_line(result, current, join_with_space=join_with_space, line_cap=line_cap)
                                if capped is not None:
                                    return capped
                                current = [piece]
                        else:
                            current = [piece]
                capped = _flush_subtitle_line(result, current, join_with_space=join_with_space, line_cap=line_cap)
                if capped is None:
                    continue
                capped
            elif result:
                result.append('')
        return (result[:line_cap] if result else [raw.split('\n', 1)[0][:limit]]) if line_cap is not None else result or [raw[:limit]]
    return ['']

def wrap_subtitle_for_display(text: str, *, play_res_x: int, box_width_norm: float, aspect_ratio: str, scale_x_percent: int, max_lines: int, font_size_px: float | None) -> list[str]:
    max_chars = estimate_subtitle_max_chars(play_res_x, box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent, font_size_px=font_size_px, text=text)
    max_words = estimate_subtitle_max_words(box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent)
    return wrap_subtitle_lines(text, max_chars, max_lines=max_lines, max_words=max_words)
SUBTITLE_MIN_CHUNK_MS = 900
SUBTITLE_MAX_LINES_PER_EVENT = 4

def plan_subtitle_cue_events(text: str, cue_duration_ms: int, *, play_res_x: int, box_width_norm: float, aspect_ratio: str, scale_x_percent: int, font_size_px: float | None, min_chunk_ms: int, max_lines_per_event: int) -> list[tuple[int, int, list[str]]]:
    cue_ms = max(1, int(cue_duration_ms))
    min_ms = max(200, int(min_chunk_ms))
    cap = max(2, int(max_lines_per_event))
    max_chars = estimate_subtitle_max_chars(play_res_x, box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent, font_size_px=font_size_px, text=text)
    max_words = estimate_subtitle_max_words(box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent)
    lines = wrap_subtitle_lines(text, max_chars, max_lines=None, max_words=max_words)
    if not lines:
        return [(0, cue_ms, [''])]
    if len(lines) <= cap:
        pass
    else:
        for lines_per in range(2, cap + 1):
            chunk_count = (len(lines) + lines_per - 1) // lines_per
            if cue_ms / chunk_count >= min_ms:
                events = []
                for index in range(chunk_count):
                    start = int(round(index * cue_ms / chunk_count))
                    end = cue_ms if index + 1 >= chunk_count else int(round((index + 1) * cue_ms / chunk_count))
                    if end <= start:
                        end = start + 1
                    chunk_lines = lines[index * lines_per:(index + 1) * lines_per]
                    events.append((start, end, chunk_lines))
                events
    return [(0, cue_ms, lines)]

def subtitle_lines_at_cue_position(text: str, cue_start_ms: int, cue_end_ms: int, position_ms: int, *, play_res_x: int, box_width_norm: float, aspect_ratio: str, scale_x_percent: int, font_size_px: float | None) -> list[str]:
    start = int(cue_start_ms)
    end = max(start + 1, int(cue_end_ms))
    pos = int(position_ms)
    if pos < start or pos > end:
        return []
    elapsed = pos - start
    events = plan_subtitle_cue_events(text, end - start, play_res_x=play_res_x, box_width_norm=box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent, font_size_px=font_size_px)
    for evt_start, evt_end, evt_lines in events:
        if evt_start <= elapsed < evt_end or (evt_end >= end - start and elapsed >= evt_start):
            return evt_lines
    return events[-1][2] if events else []

def wrap_subtitle_export_chunks(text: str, *, play_res_x: int, box_width_norm: float, aspect_ratio: str, scale_x_percent: int, lines_per_event: int, font_size_px: float | None) -> list[list[str]]:
    max_chars = estimate_subtitle_max_chars(play_res_x, box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent, font_size_px=font_size_px, text=text)
    max_words = estimate_subtitle_max_words(box_width_norm, aspect_ratio=aspect_ratio, scale_x_percent=scale_x_percent)
    lines = wrap_subtitle_lines(text, max_chars, max_lines=None, max_words=max_words)
    if lines:
        step = max(1, int(lines_per_event))
        return [lines[index:index + step] for index in range(0, len(lines), step)]
    return [['']]

def wrap_text_for_box(text: str, *, box_width_norm: float, font_div: float, aspect_wh: float, scale_percent: int, wrap_width_px: float | None, font_size_px: float | None, scale_x_percent: int) -> list[str]:
    max_chars = estimate_max_chars_for_box(box_width_norm=box_width_norm, scale_percent=scale_percent, font_div=font_div, aspect_wh=aspect_wh, wrap_width_px=wrap_width_px, font_size_px=font_size_px, scale_x_percent=scale_x_percent)
    lines = []
    for paragraph in str(text or '').replace('\r', '').split('\n'):
        if paragraph.strip():
            lines.extend(wrap_text_lines(paragraph, max_chars))
        else:
            lines.append('')
    return lines or ['']

def estimate_wrapped_line_count(text: str, *, wrap_width_px: float, font_size: float, scale_x_percent: int) -> int:
    raw = str(text or '').replace('\r', '')
    if raw.strip():
        char_w = max(4.0, float(font_size) * (max(10, int(scale_x_percent)) / 100.0) * 0.55)
        max_chars = max(4, int(float(wrap_width_px) / char_w))
        total = 0
        for paragraph in raw.split('\n'):
            lines = wrap_text_lines(paragraph, max_chars) if paragraph.strip() else ['']
            total += max(1, len(lines))
        return max(1, total)
    return 1