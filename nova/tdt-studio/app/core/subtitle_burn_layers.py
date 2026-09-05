'0–2 lớp đốt phụ đề (gốc / working) — thuần, không Qt.'
from __future__ import annotations
from dataclasses import dataclass
from core.subtitle_clock_align import align_source_clock_to_working
from core.subtitles import SubtitleDocument

@dataclass(frozen=True, slots=True)
class BurnLayerJob:
    kind: 'str'
    document: 'SubtitleDocument | None'
    margin_v: 'int'
    voice_lock: 'bool'
    sidecar_suffix: 'str'

def _has_segments(document: SubtitleDocument | None) -> bool:
    return document is not None and bool(getattr(document, 'segments', ()))

def resolve_burn_layer_jobs(*, subtitle_enabled: bool, burn_source: bool, burn_working: bool, source_document: SubtitleDocument | None, working_document: SubtitleDocument | None, working_path: str, margin_working: int, margin_source: int) -> tuple[BurnLayerJob, ...]:
    if subtitle_enabled:
        jobs = []
        if burn_source and _has_segments(source_document):
            jobs.append(BurnLayerJob(kind='source', document=align_source_clock_to_working(source_document, working_document), margin_v=int(margin_source), voice_lock=False, sidecar_suffix='.source.ass'))
        working_ok = _has_segments(working_document) or bool(str(working_path or '').strip())
        if burn_working and working_ok:
            jobs.append(BurnLayerJob(kind='working', document=working_document, margin_v=int(margin_working), voice_lock=True, sidecar_suffix='.ass'))
        return tuple(jobs)
    return ()