from __future__ import annotations
import re
from dataclasses import dataclass
from pathlib import Path
_TIMING_RE = re.compile('^\\s*(?P<start>\\d{1,}:\\d{2}:\\d{2}[,.]\\d{1,3})\\s*-->\\s*(?P<end>\\d{1,}:\\d{2}:\\d{2}[,.]\\d{1,3})(?:\\s+.*)?$')
_TIMESTAMP_RE = re.compile('^(?P<hours>\\d{1,}):(?P<minutes>\\d{2}):(?P<seconds>\\d{2})[,.](?P<milliseconds>\\d{1,3})$')

@dataclass(frozen=True, slots=True)
class SubtitleWord:
    __doc__ = 'Một từ với mốc ms — dùng karaoke \\k chính xác từ STT.'
    text: 'str'
    start_ms: 'int'
    end_ms: 'int'

    def validated(self) -> SubtitleWord:
        cleaned = str(self.text or '').strip()
        if cleaned:
            start = max(0, int(self.start_ms))
            end = max(start + 1, int(self.end_ms))
            return self if cleaned == self.text and start == self.start_ms and (end == self.end_ms) else SubtitleWord(cleaned, start, end)
        raise ValueError('Từ phụ đề rỗng')

@dataclass(frozen=True, slots=True)
class SubtitleSegment:
    start_ms: 'int'
    end_ms: 'int'
    text: 'str'
    words: 'tuple[SubtitleWord, ...]' = ()

    def validated(self) -> SubtitleSegment:
        if self.start_ms < 0 or self.end_ms < 0:
            raise ValueError('Thời gian phụ đề không được là số âm')
        if self.end_ms <= self.start_ms:
            raise ValueError('Thời gian kết thúc phải sau thời gian bắt đầu')
        cleaned = self.text.strip()
        if cleaned:
            words = ()
            if self.words:
                validated_words = []
                for item in self.words:
                    if isinstance(item, SubtitleWord):
                        validated_words.append(item.validated())
                    elif isinstance(item, (tuple, list)) and len(item) >= 3:
                        validated_words.append(SubtitleWord(str(item[0]), int(item[1]), int(item[2])).validated())
                words = tuple(validated_words)
            return self if cleaned == self.text and words == self.words else SubtitleSegment(self.start_ms, self.end_ms, cleaned, words)
        raise ValueError('Phụ đề phải có nội dung')

@dataclass(frozen=True, slots=True)
class SubtitleDocument:
    segments: 'tuple[SubtitleSegment, ...]' = ()
    source_path: 'str' = ''

    def __post_init__(self) -> None:
        validated = tuple((segment.validated() for segment in self.segments))
        if validated != self.segments:
            object.__setattr__(self, 'segments', validated)
            return None

    @property
    def duration_ms(self) -> int:
        return max((segment.end_ms for segment in self.segments), default=0)

    def active_at(self, position_ms: int) -> SubtitleSegment | None:
        position = max(0, int(position_ms))
        return next((segment for segment in self.segments if segment.start_ms <= position <= segment.end_ms), None)

    def active_at_source_position(self, position_ms: int, *, trim_start_ms: int, trim_end_ms: int) -> SubtitleSegment | None:
        position = max(0, int(position_ms))
        start_trim = max(0, int(trim_start_ms))
        end_trim = max(0, int(trim_end_ms))
        return None if start_trim and position < start_trim else None if end_trim and position >= end_trim else self.active_at(position)

    def with_segment(self, index: int, segment: SubtitleSegment) -> SubtitleDocument:
        updated = list(self.segments)
        updated[index] = segment.validated()
        return SubtitleDocument(tuple(updated), self.source_path)

    def without_segment(self, index: int) -> SubtitleDocument:
        updated = list(self.segments)
        del updated[index]
        return SubtitleDocument(tuple(updated), self.source_path)

def parse_srt(content: str, *, source_path: str) -> SubtitleDocument:
    normalized = content.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
    if normalized.strip():
        blocks = re.split('\\n[ \\t]*\\n+', normalized.strip('\n'))
        segments = []
        for item_number, raw_block in enumerate(blocks, start=1):
            lines = raw_block.split('\n')
            while lines and (not lines[0].strip()):
                lines.pop(0)
            if lines and lines[0].strip().isdigit():
                lines.pop(0)
            if lines:
                timing = _TIMING_RE.match(lines[0])
                if timing is None:
                    raise ValueError(f'Dòng thời gian phụ đề không hợp lệ ở mục {item_number}')
                text = '\n'.join(lines[1:]).strip()
                if text:
                    segment = SubtitleSegment(_timestamp_to_ms(timing.group('start')), _timestamp_to_ms(timing.group('end')), text).validated()
                    segments.append(segment)
                continue
            raise ValueError(f'Mục phụ đề {item_number} thiếu dòng thời gian')
        return SubtitleDocument(tuple(segments), source_path)
    return SubtitleDocument(source_path=source_path)

def serialize_srt(document: SubtitleDocument) -> str:
    blocks = []
    for index, segment in enumerate(document.segments, start=1):
        cue = segment.validated()
        blocks.append(f'{index}\n{_ms_to_timestamp(cue.start_ms)} --> {_ms_to_timestamp(cue.end_ms)}\n{cue.text}')
    return '\n\n'.join(blocks) + '\n' if blocks else '\n\n'.join(blocks) + ''

def load_srt(path: str | Path) -> SubtitleDocument:
    source = Path(path).expanduser().resolve()
    if source.is_file():
        return parse_srt(source.read_text(encoding='utf-8-sig'), source_path=str(source))
    raise ValueError('Tệp phụ đề không tồn tại')

def bridge_subtitle_gaps(document: SubtitleDocument, *, max_gap_ms: int) -> SubtitleDocument:
    gap = max(0, int(max_gap_ms))
    if gap <= 0 or len(document.segments) < 2:
        return document
    bridged = []
    for index, segment in enumerate(document.segments):
        cue = segment.validated()
        if index + 1 < len(document.segments):
            next_start = document.segments[index + 1].start_ms
            if 0 < next_start - cue.end_ms <= gap:
                cue = SubtitleSegment(cue.start_ms, next_start, cue.text)
        bridged.append(cue)
    return SubtitleDocument(tuple(bridged), document.source_path)

def retim_document_for_export(document: SubtitleDocument, *, trim_start_ms: int, trim_end_ms: int, pts_divisor: float) -> SubtitleDocument:
    start_trim = max(0, int(trim_start_ms))
    end_trim = max(0, int(trim_end_ms))
    divisor = float(pts_divisor)
    if divisor <= 0:
        raise ValueError('pts_divisor phải > 0')
    mapped = []
    for segment in document.segments:
        cue = segment.validated()
        rel_start = cue.start_ms - start_trim
        rel_end = cue.end_ms - start_trim
        if end_trim:
            rel_end = min(rel_end, end_trim - start_trim)
        rel_start = max(0, rel_start)
        out_start = int(round(rel_start / divisor))
        out_end = int(round(rel_end / divisor))
        if end_trim and cue.start_ms >= end_trim or rel_end <= 0 or out_end <= out_start:
            pass
        else:
            mapped.append(SubtitleSegment(out_start, out_end, cue.text))
    return SubtitleDocument(tuple(mapped), document.source_path)

def save_srt(document: SubtitleDocument, path: str | Path) -> str:
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(serialize_srt(document), encoding='utf-8')
    return str(destination)

def save_burn_ass(document: SubtitleDocument, path: str | Path, *, play_res_x: int, play_res_y: int, font: str, font_size: int, text_color: str, outline_color: str, outline_width: int, position: str, margin_v: int, margin_refs_center: bool, box_width_percent: int, layout_font_size: int | None, scale_x_percent: int, scale_y_percent: int, aspect_ratio: str, rotation_degrees: float, shadow_enabled: bool, shadow_depth: int, bg_enabled: bool, bg_color: str, bg_opacity: int, bold: bool, italic: bool, anim_mode: str, karaoke_color: str) -> str:
    from core.text_anim import ass_event_override, build_ass_karaoke_text, normalize_subtitle_anim, progressive_reveal_slices
    from core.text_layout import ass_glyph_style, ass_libass_font_scale, cap_play_res_block_height_px, estimate_text_block_height_px, plan_subtitle_cue_events, subtitle_block_center_y
    from core.text_style import ass_colour
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    width = max(2, int(play_res_x))
    height = max(2, int(play_res_y))
    anim = normalize_subtitle_anim(anim_mode)
    if anim in frozenset({'karaoke', 'karaoke_char'}):
        primary = ass_colour(karaoke_color)
        secondary = ass_colour(text_color)
    else:
        primary = ass_colour(text_color)
        secondary = '&H000000FF'
    outline = ass_colour(outline_color)
    back = ass_colour(bg_color, alpha_percent=max(0, min(100, 100 - int(bg_opacity))))
    margin = max(0, min(height - 10, int(margin_v)))
    scale_x = max(10, min(500, int(scale_x_percent)))
    scale_y = max(10, min(500, int(scale_y_percent)))
    preview_font, _ = ass_glyph_style(float(font_size), scale_x, scale_y)
    export_font_size = float(font_size) * ass_libass_font_scale(font)
    ass_font, ass_scale_x, ass_scale_y = (ass_glyph_style(export_font_size, scale_x, scale_y)[0], ass_glyph_style(export_font_size, scale_x, scale_y)[1], ass_glyph_style(export_font_size, scale_x, scale_y)[2])
    box_w = max(0.15, min(1.0, int(box_width_percent) / 100.0))
    layout_font = float(layout_font_size if layout_font_size is not None else 48)
    layout_font = max(1.0, layout_font)
    wrap_box = max(0.05, box_w * (float(font_size) / layout_font))
    margin_lr = max(0, round(width * max(0.0, 1.0 - min(1.0, wrap_box)) / 2.0))
    pos_x = width / 2.0
    border_style = 3 if bg_enabled else 1
    shadow = max(0, min(8, int(shadow_depth))) if shadow_enabled else 0
    bold_flag = -1 if bold else 0
    italic_flag = -1 if italic else 0
    outline_px = max(0, min(12, int(outline_width)))
    events = []
    for segment in document.segments:
        cue = segment.validated()
        cue_dur = max(1, cue.end_ms - cue.start_ms)
        cue_events = plan_subtitle_cue_events(cue.text, cue_dur, play_res_x=width, box_width_norm=wrap_box, aspect_ratio=aspect_ratio, scale_x_percent=scale_x, font_size_px=float(preview_font))
        for offset_start, offset_end, chunk_lines in cue_events:
            chunk_start = cue.start_ms + int(offset_start)
            chunk_end = cue.start_ms + int(offset_end)
            if chunk_end <= chunk_start:
                chunk_end = chunk_start + 1
            if chunk_end > cue.end_ms:
                chunk_end = cue.end_ms
            wrapped_parts = [line for line in chunk_lines if line is not None]
            wrapped_text = '\n'.join(wrapped_parts) if wrapped_parts else ''
            line_count = max(1, len([line for line in wrapped_parts if line.strip()] or wrapped_parts))
            block_h = cap_play_res_block_height_px(estimate_text_block_height_px(ass_font, ass_scale_y, line_count), height)
            pos_y = subtitle_block_center_y(position, margin, block_h, height, margin_refs_center=margin_refs_center)
            rot = float(rotation_degrees or 0) % 360.0
            chunk_dur = max(1, chunk_end - chunk_start)
            override_body = ass_event_override(chunk_dur, mode=anim, pos_x=pos_x, pos_y=pos_y, rotation_degrees=rot)
            if anim in frozenset({'char', 'word', 'word_fade'}):
                for slice_start, slice_end, visible in progressive_reveal_slices(wrapped_text, chunk_start, chunk_end, mode=anim):
                    slice_dur = max(1, slice_end - slice_start)
                    slice_override = ass_event_override(slice_dur, mode=anim, pos_x=pos_x, pos_y=pos_y, rotation_degrees=rot)
                    override = f'{{{slice_override}}}'
                    events.append(f'Dialogue: 0,{_ms_to_ass_timestamp(slice_start)},{_ms_to_ass_timestamp(slice_end)},Default,,0,0,0,,{override}{_escape_ass_text(visible)}')
            elif anim in frozenset({'karaoke', 'karaoke_char'}):
                word_timings = None
                if anim == 'karaoke' and getattr(cue, 'words', None) and (len(cue_events) == 1):
                    word_timings = [(w.text, max(30, int(w.end_ms) - int(w.start_ms))) for w in cue.words if str(getattr(w, 'text', '') or '').strip()] or None
                body = build_ass_karaoke_text(wrapped_text, chunk_dur, by_char=anim == 'karaoke_char', word_timings=word_timings)
                rot_tag = f'{rot}g' if abs(rot) > 0.01 else ''
                override = f'.1f,{pos_y}.1f){rot_tag}}}'
                events.append(f'Dialogue: 0,{_ms_to_ass_timestamp(chunk_start)},{_ms_to_ass_timestamp(chunk_end)},Default,,0,0,0,,{override}{body}')
            else:
                override = f'{{{override_body}}}'
                events.append(f'Dialogue: 0,{_ms_to_ass_timestamp(chunk_start)},{_ms_to_ass_timestamp(chunk_end)},Default,,0,0,0,,{override}{_escape_ass_text(wrapped_text)}')
    content = '\n'.join(('[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {width}', f'PlayResY: {height}', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '', '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding', ''.join(['Style: Default,', f'{font}', ',', f'{ass_font}', ',', f'{primary}', ',', f'{secondary}', ',', f'{outline}', ',', f'{back}', ',', f'{bold_flag}', ',', f'{italic_flag}', ',0,0,', f'{ass_scale_x}', ',', f'{ass_scale_y}', ',0,0,', f'{border_style}', ',', f'{outline_px}', ',', f'{shadow}', ',5,', f'{margin_lr}', ',', f'{margin_lr}', ',0,1']), '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', *events, ''))
    destination.write_text(content, encoding='utf-8-sig')
    return str(destination)

def save_title_burn_ass(text: str, path: str | Path, *, play_res_x: int, play_res_y: int, duration_ms: int, start_ms: int, end_ms: int | None, x_norm: float, y_norm: float, font: str, scale_x_percent: int, scale_y_percent: int, box_width_percent: int, layout_scale_percent: int | None, text_color: str, outline_color: str, outline_width: int, rotation_degrees: float, shadow_enabled: bool, shadow_depth: int, bg_enabled: bool, bg_color: str, bg_opacity: int, bold: bool, italic: bool, anim_mode: str) -> str:
    from core.text_anim import ass_event_override, normalize_title_anim
    from core.text_layout import ass_glyph_style, clamp_box_center_norms, estimate_text_block_height_px, wrap_text_for_box
    from core.text_style import ass_colour
    destination = Path(path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    width = max(2, int(play_res_x))
    height = max(2, int(play_res_y))
    primary = ass_colour(text_color)
    outline = ass_colour(outline_color)
    back = ass_colour(bg_color, alpha_percent=max(0, min(100, 100 - int(bg_opacity))))
    base_size = max(10.0, float(height) / 22.0)
    preview_font, ass_scale_x, ass_scale_y = (ass_glyph_style(base_size, scale_x_percent, scale_y_percent)[0], ass_glyph_style(base_size, scale_x_percent, scale_y_percent)[1], ass_glyph_style(base_size, scale_x_percent, scale_y_percent)[2])
    ass_font = max(8, int(preview_font))
    box_w = max(0.15, min(1.0, int(box_width_percent) / 100.0))
    layout_scale = float(layout_scale_percent if layout_scale_percent is not None else 100)
    layout_scale = max(20.0, layout_scale)
    live_s = max(20.0, float(max(10, int(scale_x_percent))))
    wrap_box = max(0.05, box_w * (live_s / layout_scale))
    margin_lr = max(0, round(width * max(0.0, 1.0 - min(1.0, wrap_box)) / 2.0))
    aspect = max(0.2, float(width) / max(1.0, float(height)))
    layout_w = float(width) * wrap_box
    pad_x = max(4.0, layout_w * 0.02)
    text_wrap_w = max(32.0, layout_w - pad_x * 2)
    wrapped_parts = wrap_text_for_box(str(text or ''), box_width_norm=wrap_box, font_div=22.0, aspect_wh=aspect, scale_percent=100, wrap_width_px=text_wrap_w, font_size_px=float(preview_font), scale_x_percent=ass_scale_x)
    wrapped_text = '\n'.join(wrapped_parts) if wrapped_parts else ''
    line_count = max(1, len([part for part in wrapped_parts if str(part).strip()] or wrapped_parts or ['']))
    block_h = estimate_text_block_height_px(float(preview_font), ass_scale_y, line_count)
    pad_y = max(4.0, float(preview_font) * 0.2)
    actual_h_norm = (block_h + pad_y * 2) / max(1.0, float(height))
    actual_w_norm = layout_w / max(1.0, float(width))
    clamped_y, clamped_x = (float(y_norm), float(x_norm))
    if actual_w_norm <= 0.98 and actual_h_norm <= 0.98:
        clamped_x, clamped_y = (clamp_box_center_norms(float(x_norm), float(y_norm), box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[0], clamp_box_center_norms(float(x_norm), float(y_norm), box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[1])
    pos_x = max(0.0, min(float(width), clamped_x * width))
    pos_y = max(0.0, min(float(height), clamped_y * float(height)))
    rot = float(rotation_degrees or 0) % 360.0
    ass_start = max(0, int(start_ms or 0))
    ass_end = max(ass_start + 1, int(end_ms if end_ms is not None else duration_ms))
    cue_dur = max(1, ass_end - ass_start)
    anim = normalize_title_anim(anim_mode)
    override = '{' + ass_event_override(cue_dur, mode=anim, pos_x=pos_x, pos_y=pos_y, rotation_degrees=rot) + '}'
    border_style = 3 if bg_enabled else 1
    shadow = max(0, min(8, int(shadow_depth))) if shadow_enabled else 0
    bold_flag = -1 if bold else 0
    italic_flag = -1 if italic else 0
    outline_px = max(0, min(12, int(outline_width)))
    content = '\n'.join(('[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {width}', f'PlayResY: {height}', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '', '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding', f'Style: Title,{font},{ass_font},{primary},&H000000FF,{outline},{back},{bold_flag},{italic_flag},0,0,{ass_scale_x},{ass_scale_y},0,0,{border_style},{outline_px},{shadow},5,{margin_lr},{margin_lr},0,1', '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', f'Dialogue: 0,{_ms_to_ass_timestamp(ass_start)},{_ms_to_ass_timestamp(ass_end)},Title,,0,0,0,,{override}{_escape_ass_text(wrapped_text)}', ''))
    destination.write_text(content, encoding='utf-8-sig')
    return str(destination)

def _ass_colour(value: str) -> str:
    red = value[1:3]
    green = value[3:5]
    blue = value[5:7]
    return f'&H00{blue}{green}{red}'.upper()

def _escape_ass_text(value: str) -> str:
    escaped = value.replace('\\', '\\\\')
    escaped = escaped.replace('{', '\\{').replace('}', '\\}')
    return escaped.replace('\n', '\\N')

def _ms_to_ass_timestamp(value: int) -> str:
    total = max(0, int(value))
    hours, remainder = (divmod(total, 3600000)[0], divmod(total, 3600000)[1])
    minutes, remainder = (divmod(remainder, 60000)[0], divmod(remainder, 60000)[1])
    seconds, milliseconds = (divmod(remainder, 1000)[0], divmod(remainder, 1000)[1])
    centiseconds = milliseconds // 10
    return f'02d:{seconds}02d.{centiseconds}02d'

def _timestamp_to_ms(value: str) -> int:
    match = _TIMESTAMP_RE.match(value.strip())
    if match is None:
        raise ValueError('Mốc thời gian phụ đề không hợp lệ')
    hours = int(match.group('hours'))
    minutes = int(match.group('minutes'))
    seconds = int(match.group('seconds'))
    milliseconds_text = match.group('milliseconds')
    if minutes > 59 or seconds > 59:
        raise ValueError('Mốc thời gian phụ đề không hợp lệ')
    milliseconds = int(milliseconds_text.ljust(3, '0'))
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds

def _ms_to_timestamp(value: int) -> str:
    total = max(0, int(value))
    hours, remainder = (divmod(total, 3600000)[0], divmod(total, 3600000)[1])
    minutes, remainder = (divmod(remainder, 60000)[0], divmod(remainder, 60000)[1])
    seconds, milliseconds = (divmod(remainder, 1000)[0], divmod(remainder, 1000)[1])
    return f'02d:{seconds}02d,{milliseconds}03d'