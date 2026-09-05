from __future__ import annotations
import copy
from core.subtitles import SubtitleDocument, SubtitleSegment
TTS_LOCKED_NO_SOURCE_MSG = 'Phụ đề đang khóa theo giọng cũ — xóa hết phụ đề rồi lấy phụ đề mới, sau đó tạo giọng.'
TTS_SOURCE_VALUE_KEY = 'tts_source_document'
_LOCK_GAP_MIN_SEC = 0.025
_LOCK_GAP_MAX_SEC = 0.035
_LOCK_GAP_RATIO = 0.8

def document_has_lock_gaps(document: SubtitleDocument | None) -> bool:
    segments = tuple(getattr(document, 'segments', ()) or ())
    if len(segments) < 2:
        return False
    gaps = [(next_seg.start_ms - prev_seg.end_ms) / 1000.0 for prev_seg, next_seg in zip(segments, segments[1:])]
    locked = sum((1 for gap in gaps if _LOCK_GAP_MIN_SEC <= gap <= _LOCK_GAP_MAX_SEC))
    return locked / len(gaps) >= _LOCK_GAP_RATIO

def snapshot_tts_source_if_unlocked(document: SubtitleDocument | None, values: dict[str, object]) -> None:
    if document is None or not getattr(document, 'segments', ()):
        return None
    if document_has_lock_gaps(document):
        return None
    values[TTS_SOURCE_VALUE_KEY] = _plain_source_payload(document)

def tts_document_for_task(document: SubtitleDocument | None, values: dict[str, object] | None) -> SubtitleDocument | None:
    if document is None or not getattr(document, 'segments', ()):
        pass
    elif document_has_lock_gaps(document):
        source = _source_document(values)
        if source is None or not source.segments:
            return None
        if len(source.segments) != len(document.segments):
            return None
        merged = tuple((SubtitleSegment(src.start_ms, src.end_ms, cur.text) for src, cur in zip))
        return SubtitleDocument(merged, document.source_path)
    return document

def persistable_tts_source_copy(values: dict[str, object] | None) -> object | None:
    source = _source_document(values)
    if source is not None and source.segments:
        raw = None if values is None else values.get(TTS_SOURCE_VALUE_KEY)
        return copy.deepcopy(raw) if isinstance(raw, (list, dict)) else _plain_source_payload(source)

def _plain_source_rows(document: SubtitleDocument) -> list[dict[str, object]]:
    return [{'start_ms': int(seg.start_ms), 'end_ms': int(seg.end_ms), 'text': str(seg.text)} for seg in document.segments]

def _plain_source_payload(document: SubtitleDocument) -> list | dict:
    rows = _plain_source_rows(document)
    return {'segments': rows, 'source_path': str(document.source_path)} if document.source_path else rows

def _source_document(values: dict[str, object] | None) -> SubtitleDocument | None:
    if values:
        source = values.get(TTS_SOURCE_VALUE_KEY)
        if isinstance(source, SubtitleDocument):
            return source
        if isinstance(source, dict):
            return _document_from_plain_rows(source.get('segments'), str(source.get('source_path') or ''))
        if isinstance(source, list):
            return _document_from_plain_rows(source, '')
    else:
        return None

def _document_from_plain_rows(rows: object, source_path: str='') -> SubtitleDocument | None:
    if isinstance(rows, list) and rows:
        segs = []
        for item in rows:
            if isinstance(item, dict):
                try:
                    segs.append(SubtitleSegment(int(item['start_ms']), int(item['end_ms']), str(item.get('text') or '')))
                except (KeyError, TypeError, ValueError):
                    return None
            else:
                return None
        try:
            pass
        except ValueError:
            pass
    else:
        return None