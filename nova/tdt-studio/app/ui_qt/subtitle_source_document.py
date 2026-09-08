'Hai bản phụ đề timeline: gốc (STT) vs working (sau dịch) — không alias.'
from __future__ import annotations
from pathlib import Path
from typing import Any, Callable
from core.subtitles import SubtitleDocument, SubtitleSegment, SubtitleWord
SOURCE_DOC_KEY = 'timeline_source_subtitles'
SOURCE_VISIBLE_KEY = 'timeline_subtitle_source_visible'
WORKING_VISIBLE_KEY = 'timeline_subtitle_working_visible'
_KIND_TO_VISIBLE_KEY = {'subtitle_source': SOURCE_VISIBLE_KEY, 'subtitle': WORKING_VISIBLE_KEY}

def copy_subtitle_document(document: SubtitleDocument | None) -> SubtitleDocument:
    if document is not None and getattr(document, 'segments', ()):
        segments = []
        for seg in document.segments:
            words = tuple((SubtitleWord(word.text, word.start_ms, word.end_ms) for word in seg.words or ()))
            segments.append(SubtitleSegment(seg.start_ms, seg.end_ms, seg.text, words))
        return SubtitleDocument(tuple(segments), str(document.source_path or ''))
    return SubtitleDocument()

def _plain_rows(document: SubtitleDocument) -> list[dict[str, object]]:
    return [{'start_ms': int(seg.start_ms), 'end_ms': int(seg.end_ms), 'text': str(seg.text)} for seg in document.segments]

def _plain_payload(document: SubtitleDocument) -> list | dict:
    rows = _plain_rows(document)
    return {'segments': rows, 'source_path': str(document.source_path)} if document.source_path else rows

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
            return SubtitleDocument(tuple(segs), source_path=str(source_path or ''))
        except ValueError:
            return None
    else:
        return None

def document_from_values(values: dict[str, object] | None) -> SubtitleDocument | None:
    if values:
        raw = values.get(SOURCE_DOC_KEY)
        if isinstance(raw, SubtitleDocument):
            return copy_subtitle_document(raw)
        if isinstance(raw, dict):
            return _document_from_plain_rows(raw.get('segments'), str(raw.get('source_path') or ''))
        if isinstance(raw, list):
            return _document_from_plain_rows(raw, '')
    else:
        return None

def persistable_source_subtitles_copy(values: dict[str, object] | None) -> object | None:
    import copy
    source = document_from_values(values)
    if source is not None and source.segments:
        raw = None if values is None else values.get(SOURCE_DOC_KEY)
        return copy.deepcopy(raw) if isinstance(raw, (list, dict)) else _plain_payload(source)

def get_source_subtitles(state: Any) -> SubtitleDocument:
    values = getattr(state, 'values', None)
    document = document_from_values(values if isinstance(values, dict) else None)
    return document if document is not None else SubtitleDocument()

def set_source_subtitles(state: Any, document: SubtitleDocument | None) -> None:
    values = getattr(state, 'values', None)
    if isinstance(values, dict):
        copied = copy_subtitle_document(document)
        if copied.segments:
            values[SOURCE_DOC_KEY] = _plain_payload(copied)
            set_subtitle_row_visible(values, 'subtitle_source', True)
        else:
            values.pop(SOURCE_DOC_KEY, None)
            return None
    else:
        return None

def capture_source_if_empty(state: Any, incoming: SubtitleDocument | None) -> SubtitleDocument:
    current = get_source_subtitles(state)
    if current.segments:
        return current
    live = getattr(state, 'subtitles', None)
    seed = live if live is not None and getattr(live, 'segments', ()) else incoming
    copied = copy_subtitle_document(seed)
    if copied.segments:
        set_source_subtitles(state, copied)
    return get_source_subtitles(state)

def persist_source_subtitle_if_new(state: Any, incoming: SubtitleDocument, destination: str | Path, persist_fn: Callable[[SubtitleDocument, Path], SubtitleDocument]) -> SubtitleDocument:
    current = get_source_subtitles(state)
    if current.segments:
        return current
    captured = capture_source_if_empty(state, incoming)
    if captured.segments:
        dest = Path(destination)
        saved = persist_fn(captured, dest)
        if isinstance(saved, SubtitleDocument) and saved.segments:
            set_source_subtitles(state, saved)
            return saved
        return get_source_subtitles(state)
    return captured

def subtitle_row_visible(values: dict[str, Any] | None, kind: str) -> bool:
    key = _KIND_TO_VISIBLE_KEY.get(str(kind or ''))
    if key is None:
        pass
    elif values:
        raw = values.get(key, True)
        return bool(raw) if raw is not None else True
    return True

def set_subtitle_row_visible(values: dict[str, Any], kind: str, visible: bool) -> None:
    key = _KIND_TO_VISIBLE_KEY.get(str(kind or ''))
    if key is None:
        return None
    values[key] = bool(visible)