from __future__ import annotations
import copy
from dataclasses import dataclass, field
from core.subtitles import SubtitleDocument, SubtitleSegment
from ui_qt.state import ProjectState

@dataclass(frozen=True)
class ProjectSnapshot:
    values: 'dict[str, object]'
    sfx_events: 'tuple[dict, ...]'
    selected_id: 'str | None'
    assets: 'tuple' = ()
    subtitle_segments: 'tuple[tuple[int, int, str], ...]' = ()
    subtitle_source_path: 'str' = ''
    asset_settings: 'dict[str, dict[str, object]]' = field(default_factory=dict)

def _serialize_subtitles(document: SubtitleDocument) -> tuple[tuple[int, int, str], ...]:
    return tuple(((segment.start_ms, segment.end_ms, segment.text) for segment in document.segments))

def _deserialize_subtitles(segments: tuple[tuple[int, int, str], ...], source_path: str) -> SubtitleDocument:
    return SubtitleDocument(tuple((SubtitleSegment(start_ms, end_ms, text) for start_ms, end_ms, text in segments)), source_path or '')

def capture_snapshot(state: ProjectState) -> ProjectSnapshot:
    return ProjectSnapshot(values=copy.deepcopy(dict(state.values)), sfx_events=tuple((copy.deepcopy(event) for event in state.sfx_events)), selected_id=state.selected_id, assets=tuple(state.assets), subtitle_segments=_serialize_subtitles(state.subtitles), subtitle_source_path=str(state.subtitles.source_path or ''), asset_settings=copy.deepcopy(dict(state.asset_settings)))

def restore_snapshot(state: ProjectState, snapshot: ProjectSnapshot) -> None:
    state.assets = tuple(snapshot.assets)
    state.values.clear()
    state.values.update(copy.deepcopy(snapshot.values))
    state.sfx_events = [copy.deepcopy(event) for event in snapshot.sfx_events]
    state.subtitles = _deserialize_subtitles(snapshot.subtitle_segments, snapshot.subtitle_source_path)
    state.asset_settings.clear()
    state.asset_settings.update(copy.deepcopy(snapshot.asset_settings))
    if snapshot.selected_id and any((a.id == snapshot.selected_id for a in state.assets)):
        state.selected_id = snapshot.selected_id
        return None
    if state.assets:
        state.selected_id = next((a.id for a in state.assets if a.kind == 'video'), state.assets[0].id)
        return None
    state.selected_id = None

class ProjectHistory:

    def __init__(self, *, limit: int=50) -> None:
        self._stack = []
        self._redo_stack = []
        self._limit = max(1, int(limit))
        self.restoring = False

    def __len__(self) -> int:
        return len(self._stack)

    def redo_len(self) -> int:
        return len(self._redo_stack)

    def clear(self) -> None:
        self._stack.clear()
        self._redo_stack.clear()

    def push(self, snapshot: ProjectSnapshot) -> None:
        if self.restoring:
            return None
        if self._stack and self._stack[-1] == snapshot:
            return None
        self._stack.append(snapshot)
        self._redo_stack.clear()
        if len(self._stack) > self._limit:
            self._stack.pop(0)
            return None

    def undo(self, state: ProjectState) -> ProjectSnapshot | None:
        if self._stack:
            self._redo_stack.append(capture_snapshot(state))
            snapshot = self._stack.pop()
            self.restoring = True
            try:
                restore_snapshot(state, snapshot)
            finally:
                self.restoring = False
            return snapshot

    def redo(self, state: ProjectState) -> ProjectSnapshot | None:
        if self._redo_stack:
            self._stack.append(capture_snapshot(state))
            snapshot = self._redo_stack.pop()
            self.restoring = True
            try:
                restore_snapshot(state, snapshot)
            finally:
                self.restoring = False
            return snapshot