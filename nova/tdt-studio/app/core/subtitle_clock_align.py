'Cặp giờ phụ đề gốc theo hàng đích — thuần, không Qt.'
from __future__ import annotations
from core.subtitles import SubtitleDocument, SubtitleSegment

def align_source_clock_to_working(source: SubtitleDocument | None, working: SubtitleDocument | None) -> SubtitleDocument:
    if source is None:
        return SubtitleDocument()
    work_segs = ()
    if working is not None:
        work_segs = tuple(working.segments or ())
    if work_segs:
        mapped = []
        for index, src in enumerate(source.segments):
            if index < len(work_segs):
                dest = work_segs[index]
                mapped.append(SubtitleSegment(int(dest.start_ms), int(dest.end_ms), src.text))
            else:
                mapped.append(src)
        return SubtitleDocument(tuple(mapped), source.source_path)
    return source