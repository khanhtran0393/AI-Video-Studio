'Chọn lớp phụ đề preview theo cờ burn — không vòng core.video_export.'
from __future__ import annotations
from dataclasses import dataclass
from core.subtitle_clock_align import align_source_clock_to_working
from core.subtitles import SubtitleDocument, SubtitleSegment

@dataclass(frozen=True, slots=True)
class PreviewBurnLayer:
    kind: 'str'
    text: 'str'
    margin_v: 'int'
    start_ms: 'int' = 0
    end_ms: 'int' = 1

    @property
    def segment(self) -> SubtitleSegment:
        end = max(self.start_ms + 1, int(self.end_ms))
        return SubtitleSegment(self.start_ms, end, self.text)

def preview_burn_layers_at_clock(values: dict[str, object], *, clock_ms: int, working_document: SubtitleDocument | None, source_document: SubtitleDocument | None, trim_start_ms: int, trim_end_ms: int, working_use_trim: bool) -> tuple[PreviewBurnLayer, ...]:
    if bool(values.get('subtitle_enabled')):
        burn_source = bool(values.get('subtitle_burn_source', True))
        burn_working = bool(values.get('subtitle_burn_working', True))
        margin_source = int(values.get('subtitle_margin_bottom_source', 140) or 140)
        margin_working = int(values.get('subtitle_margin_bottom', 70) or 70)
        layers = []
        aligned = align_source_clock_to_working(source_document, working_document)
        segment = aligned.active_at(clock_ms)
        if burn_source and source_document is not None and source_document.segments and (segment is not None):
            layers.append(PreviewBurnLayer(kind='source', text=segment.text, margin_v=margin_source, start_ms=int(segment.start_ms), end_ms=int(segment.end_ms)))
        segment = working_document.active_at_source_position(clock_ms, trim_start_ms=trim_start_ms if working_use_trim else 0, trim_end_ms=trim_end_ms if working_use_trim else 0)
        if burn_working and working_document is not None and working_document.segments and (segment is not None):
            layers.append(PreviewBurnLayer(kind='working', text=segment.text, margin_v=margin_working, start_ms=int(segment.start_ms), end_ms=int(segment.end_ms)))
        return tuple(layers)
    return ()

def hit_burn_drag_kind(point, source_rect, working_rect) -> str | None:

    def _contains(rect) -> bool:
        if rect is None:
            return False
        is_null = getattr(rect, 'isNull', None)
        if callable(is_null) and is_null():
            return False
        contains = getattr(rect, 'contains', None)
        return bool(contains(point)) if callable(contains) else False
    if _contains(source_rect):
        return 'source'
    if _contains(working_rect):
        return 'working'

def apply_burn_drag_margin(values: dict[str, object], kind: str, margin: int) -> None:
    cleaned = max(0, int(margin))
    if kind == 'source':
        values['subtitle_margin_bottom_source'] = cleaned
        return None
    if kind == 'working':
        values['subtitle_margin_bottom'] = cleaned
        return None