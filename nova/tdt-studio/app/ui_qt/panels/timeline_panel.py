from __future__ import annotations
import subprocess
import time
from pathlib import Path
from PySide6.QtCore import QPoint, QRect, QRectF, QTimer, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import QButtonGroup, QCheckBox, QFileDialog, QFrame, QHBoxLayout, QInputDialog, QLabel, QMenu, QMessageBox, QProgressBar, QPushButton, QScrollArea, QScrollBar, QSlider, QSizePolicy, QVBoxLayout, QWidget
from core.sfx import normalize_sfx_events, save_sfx_events, scan_sfx_presets
from ui_qt.background_layers import ensure_background_layers
from ui_qt.blend_layers import ensure_blend_layers
from ui_qt.media_overlays import ensure_media_overlays
from ui_qt.timeline_layer_tracks import MAX_BACKGROUND_TRACKS, MAX_BLEND_TRACKS, MAX_OVERLAY_TRACKS, background_track_kind, blend_track_kind, count_filled_layer_tracks, layer_track_slots, migrate_upper_video_tracks_to_layers, overlay_track_kind, parse_layer_row_ref
from core.timeline_clips import MIN_CLIP_DURATION_MS, apply_clip_transform_to_values, build_clips_from_source_cuts, clipboard_payload, clip_boundary_ms_list, clips_from_values, clips_on_track, clamp_track_index, delete_clips_ripple, duplicate_clip_after, ensure_timeline_clips, apply_scene_cuts_to_values, find_clip, insert_source_clip, move_clip_to_track, neighbor_clip, paste_clip_after, persist_values_transform_to_selected_clip, reorder_clip_by_timeline_ms, selected_clip_id, selected_clip_ids, set_selected_clip_id, set_selected_clip_ids, snap_timeline_ms, split_clip_at_timeline, timeline_duration_ms, trim_clip_edge, write_clips
from ui_qt.timeline_context_menu import CLIP_CONTEXT_ACTIONS, STEM_SEP_ACTIONS, clip_action_enabled, ensure_stems_requestable, normalize_stem_mode
from ui_qt.timeline_track_state import set_track_edit_locked, set_track_preview_hidden, track_edit_locked, track_preview_hidden
from ui_qt.widgets.timeline_mix_strip import TimelineMixStrip
from ui_qt.state import Asset, ProjectState
from ui_qt.summary_snapshot import build_workflow_nodes
from ui_qt.user_prefs import get_last_dir, load_prefs, remember_path, save_prefs
from ui_qt.widgets.timeline_summary_flow_bar import TimelineSummaryFlowBar
from ui_qt.widgets.timeline_tool_icons import icon_crop, icon_redo, icon_reset_trim, icon_scene_split, icon_skip_backward, icon_skip_forward, icon_split, icon_undo, icon_zoom_in, icon_zoom_out, make_timeline_tool_button
TRACKS = (('Video', ('video',), '#397DF0', 0), ('Phụ đề gốc', ('subtitle_source',), '#7B5BA8', None), ('Phụ đề sau dịch', ('subtitle',), '#9D62E8', None), ('Chữ phụ họa', ('text_overlay',), '#E8A84A', None), ('Tiêu đề', ('video_title',), '#E8C84A', None), ('Logo', ('text_logo',), '#C46BB8', None), ('Vùng mờ', ('blur',), '#6B7C93', None), ('Giọng đọc', ('voice',), '#E67E4D', None), ('Video gốc', ('source_audio',), '#3A9BCB', None), ('Nhạc file', ('audio', 'music'), '#27A87B', None), ('SFX', ('sfx',), '#D39A32', None))
ASSET_DRAG_MIME = 'application/x-vtp-asset-id'
LIBRARY_ACTION_MIME = 'application/x-vtp-library-action'
LIBRARY_ASSET_MIME = 'application/x-vtp-library-asset'
LAYER_VOICE = 'layer-voice'
LAYER_SOURCE_AUDIO = 'layer-source-audio'
LAYER_BGM = 'layer-bgm'
LAYER_TEXT_LOGO = 'layer-text-logo'
LAYER_VIDEO_TITLE = 'layer-video-title'
LAYER_TEXT_OVERLAY = 'layer-text-overlay'
LAYER_LOGO = 'layer-logo'
LAYER_BLUR = 'layer-blur'
MIN_LAYER_DURATION_MS = 200
TIMELINE_ZOOM_MIN = 0.25
TIMELINE_ZOOM_MAX = 10.0
_EMPTY_HINTS = {'video': '＋ Video trong Media = đổi mẫu · Shift = nối · file ngoài = nạp Media', 'media_overlay': '＋ Chọn lớp phủ từ thư viện Lớp', 'blend_layer': '＋ Chọn hòa trộn từ thư viện Lớp', 'background_layer': '＋ Chọn nền video/ảnh (nằm dưới video chính)', 'subtitle': '＋ Thêm phụ đề', 'subtitle_source': '＋ Phụ đề gốc (STT trước dịch)', 'text_overlay': '＋ Thêm chữ phụ họa (gõ chữ)', 'video_title': '＋ Thêm tiêu đề video', 'text_logo': '＋ Chọn logo từ thư viện Lớp', 'blur': '＋ Thêm vùng mờ (đen / mờ / màu)', 'voice': '＋ Thêm giọng đọc', 'source_audio': 'Video không có track audio', 'audio': '＋ Chọn nhạc nền từ thư viện Âm thanh', 'music': '＋ Chọn nhạc nền từ thư viện Âm thanh', 'sfx': '＋ Chọn SFX từ thư viện Âm thanh (kéo tile cũng được)', 'dyn_audio': '＋ Track âm thanh tách'}
_PLUS_MINUS_KINDS = frozenset({'video_title', 'sfx', 'blur', 'text_overlay', 'background_layer', 'media_overlay', 'blend_layer', 'voice', 'text_logo', 'subtitle_source', 'audio', 'source_audio', 'subtitle', 'video', 'music'})

class TimelineCanvas(QWidget):
    clipSelected = Signal(str)
    timelineClipSelected = Signal(str)
    clipsChanged = Signal()
    layerSelected = Signal(str)
    trackFocusRequested = Signal(str)
    trackAddRequested = Signal(str)
    trackSlotRemoveRequested = Signal(str)
    trimChanged = Signal(int, int)
    trimDragStarted = Signal()
    layerTimingDragStarted = Signal()
    layerTimingChanged = Signal()
    positionScrubbed = Signal(int)
    subtitleCueSelectRequested = Signal(int)
    subtitleCueDeleteRequested = Signal(str, int)
    scrubFinished = Signal(int)
    zoomChanged = Signal(float)
    scrollOffsetChanged = Signal()
    sfxChanged = Signal()
    sfxEditStarted = Signal()
    trackControlsChanged = Signal()
    filmstripPathsNeeded = Signal(object)
    libraryActionDropped = Signal(str, int)
    libraryAssetDropped = Signal(str, str, int)
    transitionSelected = Signal(int)
    ruler_height = 26
    track_height = 34
    header_width = 210
    CONTENT_PAD_LEFT = 8
    CONTENT_PAD_RIGHT = 8
    handle_width = 8
    marker_hit_px = 10

    def __init__(self, state: ProjectState, parent: QWidget | None=None):
        super().__init__(parent)
        self.state = state
        self.selected_id = state.selected_id
        self.position_ms = 0
        self.zoom_factor = 1.0
        self.scroll_offset_px = 0.0
        self._clip_rects = {}
        self._subtitle_cue_rects = []
        self._subtitle_cue_labels = []
        self._subtitle_source_cue_rects = []
        self._subtitle_source_cue_labels = []
        self._selected_subtitle_cue = None
        self._timeline_clip_rects = {}
        self._layer_rects = {}
        self._layer_timing_meta = {}
        self._add_rects = []
        self._transition_hit_rects = []
        self._header_action_rects = []
        self._sfx_marker_rects = []
        self._drag_trim = None
        self._drag_tclip_id = None
        self._drag_tclip_mode = None
        self._drag_tclip_origin_ms = 0
        self._drag_tclip_last_ms = None
        self._drag_tclip_last_track = None
        self._tclip_history_pushed = False
        self._drag_lite = False
        self._scrub_need_cache = False
        self._drag_sfx_index = None
        self._selected_sfx_index = None
        self._sfx_clipboard = None
        self._clipboard_kind = ''
        self._sfx_preview_proc = None
        self._trim_history_pushed = False
        self._drag_layer_id = None
        self._drag_layer_mode = None
        self._layer_drag_origin_start = 0
        self._layer_drag_origin_end = 0
        self._layer_drag_anchor_ms = 0
        self._layer_timing_history_pushed = False
        self._scrubbing = False
        self._scrub_emit_at = 0.0
        self._scrub_emit_armed = False
        self._scrub_scroll_dirty = False
        self._pending_tclip_id = None
        self._pending_tclip_press_x = 0.0
        self._pending_tclip_press_y = 0.0
        self._selection_anchor_id = ''
        self._playhead_x = 0
        self._trim_in_rect = QRect()
        self._trim_out_rect = QRect()
        self._clip_clipboard = None
        self._filmstrip_cache = {}
        self._filmstrip_pending = set()
        self._filmstrip_requested = set()
        self._cached_clips = None
        self._cached_duration_ms = None
        self._layout_cache_token = None
        self._playback_lite = False
        self._playback_body_cache = None
        self._playback_body_dirty = True
        self._body_cache_scroll_px = 0.0
        self._body_cache_zoom = 1.0
        self._body_cache_row_count = 0
        self._scroll_paint_armed = False
        self._scroll_paint_at = 0.0
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setAcceptDrops(True)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._show_context_menu)
        self._refresh_canvas_height()

    def track_rows(self) -> list[tuple[str, tuple[str, ...], str, int | None, str]]:
        from core.timeline_audio_clips import audio_clips_from_values
        rows = []
        for name, kinds, color, vti in TRACKS:
            rows.append((name, kinds, color, vti, ''))
            if 'video' in kinds:
                overlays = ensure_media_overlays(self.state.values)
                for label, ref in layer_track_slots(overlays, max_tracks=MAX_OVERLAY_TRACKS, kind='overlay'):
                    rows.append((label, ('media_overlay',), '#5B8DEF', None, ref))
                blends = ensure_blend_layers(self.state.values)
                for label, ref in layer_track_slots(blends, max_tracks=MAX_BLEND_TRACKS, kind='blend'):
                    rows.append((label, ('blend_layer',), '#E67E22', None, ref))
                backgrounds = ensure_background_layers(self.state.values)
                for label, ref in layer_track_slots(backgrounds, max_tracks=MAX_BACKGROUND_TRACKS, kind='background'):
                    rows.append((label, ('background_layer',), '#6B4FA0', None, ref))
            if 'source_audio' in kinds:
                for clip in audio_clips_from_values(self.state.values):
                    c = '#4DB6AC' if clip.kind == 'vocal' else '#66BB6A' if clip.kind == 'instrumental' else '#78909C'
                    rows.append((clip.label, ('dyn_audio',), c, None, clip.id))
        return rows

    def _header_kind_for_row(self, kinds: tuple[str, ...], row_ref: str) -> str:
        if 'dyn_audio' in kinds and row_ref:
            return f'dyn_audio:{row_ref}'
        if 'media_overlay' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            idx = parsed[1] if parsed else 'new'
            return overlay_track_kind(idx)
        if 'blend_layer' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            idx = parsed[1] if parsed else 'new'
            return blend_track_kind(idx)
        if 'background_layer' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            idx = parsed[1] if parsed else 'new'
            return background_track_kind(idx)
        return kinds[0]

    def _focus_id_for_row(self, kinds: tuple[str, ...], row_ref: str) -> str:
        if 'media_overlay' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            return f'layer-overlay-{parsed[1]}' if parsed and parsed[1] != 'new' else 'track-media_overlay'
        if 'blend_layer' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            return f'layer-blend-{parsed[1]}' if parsed and parsed[1] != 'new' else 'track-blend_layer'
        if 'background_layer' in kinds:
            parsed = parse_layer_row_ref(row_ref)
            return f'layer-background-{parsed[1]}' if parsed and parsed[1] != 'new' else 'track-background_layer'
        return (f'dyn_audio:{row_ref}' if row_ref else 'track-source_audio') if 'dyn_audio' in kinds else 'track-sfx' if 'sfx' in kinds else 'track-video' if 'video' in kinds else 'track-subtitle' if 'subtitle' in kinds else 'track-subtitle_source' if 'subtitle_source' in kinds else LAYER_TEXT_OVERLAY if 'text_overlay' in kinds else LAYER_VIDEO_TITLE if 'video_title' in kinds else LAYER_LOGO if 'text_logo' in kinds else LAYER_BLUR if 'blur' in kinds else LAYER_VOICE if 'voice' in kinds else LAYER_SOURCE_AUDIO if 'source_audio' in kinds else LAYER_BGM if 'audio' in kinds or 'music' in kinds else f'track-{kinds[0]}'

    def content_pixel_height(self) -> int:
        n = max(1, len(self.track_rows()))
        return self.ruler_height + self.track_height * n

    def _refresh_canvas_height(self) -> None:
        h = self.content_pixel_height()
        w = max(self.width(), 200)
        parent = self.parent()
        if parent is not None and hasattr(parent, 'viewport'):
            try:
                w = max(int(parent.viewport().width()), 200)
            except Exception:
                pass
        self.setFixedSize(w, h)

    def invalidate_layout_cache(self) -> None:
        self._cached_clips = None
        self._cached_duration_ms = None
        self._layout_cache_token = None

    def set_playback_lite(self, active: bool) -> None:
        active = bool(active)
        if active == self._playback_lite:
            return None
        if active:
            if not self._body_cache_usable():
                self._capture_body_cache_snapshot()
            self._playback_lite = True
            if self._body_cache_usable():
                self._playback_body_dirty = False
                self._scrub_need_cache = False
            else:
                self._playback_body_cache = None
                self._playback_body_dirty = True
                self._scrub_need_cache = True
        else:
            self._playback_lite = False
            self._playback_body_cache = None
            self._playback_body_dirty = True
            self._scrub_need_cache = False
        self.update()

    def _invalidate_playback_body_cache(self) -> None:
        self._playback_body_dirty = True
        self._playback_body_cache = None

    def _want_body_cache_mode(self) -> bool:
        return bool(self._playback_lite or self._scrubbing or self._drag_lite)

    def _body_cache_usable(self) -> bool:
        cache = self._playback_body_cache
        if self._playback_body_dirty or cache is None or cache.isNull():
            return False
        dpr = max(0.01, float(cache.devicePixelRatioF() or 1.0))
        return False if int(cache.width() / dpr) != int(self.width()) else False if int(cache.height() / dpr) != int(self.height()) else False if abs(float(self._body_cache_scroll_px) - float(self.scroll_offset_px)) > 0.5 else False if abs(float(self._body_cache_zoom) - float(self.zoom_factor)) > 0.0001 else True

    def _layout_token(self) -> object:
        raw = self.state.values.get('timeline_clips')
        video = self._selected_video_asset()
        return (id(raw) if isinstance(raw, list) else None, self.selected_id, int(self.state.values.get('trim_end_ms', 0) or 0), int(self.state.values.get('trim_start_ms', 0) or 0), int(getattr(video, 'duration_ms', 0) or 0)) if video is not None else (id(raw) if isinstance(raw, list) else None, self.selected_id, int(self.state.values.get('trim_end_ms', 0) or 0), int(self.state.values.get('trim_start_ms', 0) or 0), 0)

    def _ensure_layout_cache(self) -> None:
        token = self._layout_token()
        if self._cached_duration_ms is not None and self._cached_clips is not None and (token == self._layout_cache_token):
            pass
        else:
            video = self._selected_video_asset()
            if video is not None:
                source_dur = max(1, int(video.duration_ms or 1))
                clips = ensure_timeline_clips(self.state.values, source_duration_ms=source_dur, source_path=str(video.path or ''))
                clip_dur = timeline_duration_ms(clips)
                duration = max(1, int(clip_dur if clips else source_dur))
                self._cached_clips = clips
                self._cached_duration_ms = max(1, int(duration))
                try:
                    from core.timeline_audio_clips import heal_stem_spans_to_duration
                    heal_stem_spans_to_duration(self.state.values, int(self._cached_duration_ms))
                except Exception:
                    pass
            else:
                durations = [asset.duration_ms for asset in self._timeline_assets()]
                self._cached_clips = []
                self._cached_duration_ms = max(durations, default=0)
            self._layout_cache_token = token

    @property
    def project_duration_ms(self) -> int:
        self._ensure_layout_cache()
        return int(self._cached_duration_ms or 0)
    EMPTY_TIMELINE_SPAN_MS = 60000

    def timeline_span_ms(self) -> int:
        project = max(0, int(self.project_duration_ms or 0))
        span = project if project > 1 else self.EMPTY_TIMELINE_SPAN_MS
        for event in self.state.sfx_events:
            try:
                t_ms = int(float(event.get('time_sec', 0) or 0) * 1000)
                span = max(span, t_ms + 1000)
            except (TypeError, ValueError):
                continue
        return max(1, int(span))

    def _selected_video_asset(self) -> Asset | None:
        videos = [asset for asset in self.state.assets if asset.kind == 'video']
        selected_id = self.state.selected_id
        return next((asset for asset in videos if asset.id == selected_id), videos[0]) if videos else next((asset for asset in self.state.assets if asset.id == selected_id), None)

    def video_clips(self):
        self._ensure_layout_cache()
        return list(self._cached_clips or [])

    def clip_asset_ids(self) -> list[str]:
        supported_kinds = {kind for _name, kinds, _color, _vti, *_ in self.track_rows() for kind in kinds}
        return [asset.id for asset in self._timeline_assets() if asset.kind in supported_kinds]

    def reload_project(self, state: ProjectState | None=None) -> None:
        if state is not None:
            self.state = state
        self.selected_id = self.state.selected_id
        self.invalidate_layout_cache()
        self.position_ms = min(self.position_ms, self.project_duration_ms)
        self._sync_track_overlays()
        self._refresh_canvas_height()
        self._invalidate_playback_body_cache()
        self.update()

    def set_selected_asset(self, asset_id: str | None) -> None:
        self.selected_id = asset_id
        self.reload_project()

    def set_position(self, position_ms: int, *, repaint: bool, follow_playhead: bool) -> None:
        self.position_ms = max(0, min(int(position_ms), self.project_duration_ms))
        scrolled = False
        before = float(self.scroll_offset_px)
        scrolled = self.ensure_playhead_visible(margin_px=96)
        if follow_playhead and scrolled:
            dx = float(self.scroll_offset_px) - before
            if self._want_body_cache_mode() and self._body_cache_usable():
                self._shift_playback_body_cache(dx)
            else:
                self._invalidate_playback_body_cache()
        if repaint or scrolled:
            self.update()
            return None

    def _shift_playback_body_cache(self, dx_px: float) -> None:
        cache = self._playback_body_cache
        if cache is None or cache.isNull() or abs(dx_px) < 0.5:
            if abs(dx_px) >= 0.5:
                self._invalidate_playback_body_cache()
            return None
        dpr = max(0.01, float(cache.devicePixelRatioF() or 1.0))
        pm = QPixmap(cache.size())
        pm.setDevicePixelRatio(dpr)
        pm.fill(QColor('#0C121C'))
        painter = QPainter(pm)
        painter.drawPixmap(int(round(-dx_px)), 0, cache)
        painter.end()
        self._playback_body_cache = pm
        self._playback_body_dirty = False
        self._body_cache_scroll_px = float(self.scroll_offset_px)

    def ensure_playhead_visible(self, *, margin_px: int) -> bool:
        if self.max_scroll_px() <= 0:
            return False
        x = self.time_to_x(self.position_ms)
        left = self.content_track_left()
        right = left + self.visible_content_width()
        margin = max(24, int(margin_px))
        before = self.scroll_offset_px
        if x < left + margin:
            self.scroll_offset_px -= float(left + margin - x)
        elif x > right - margin:
            self.scroll_offset_px += float(x - (right - margin))
        self._clamp_scroll()
        moved = abs(self.scroll_offset_px - before) > 0.5
        if moved:
            if self._playback_lite:
                if not getattr(self, '_scroll_sync_armed', False):
                    self._scroll_sync_armed = True
                    QTimer.singleShot(120, self._flush_scroll_sync_emit)
                return moved
            self.scrollOffsetChanged.emit()
        else:
            return moved

    def _flush_scroll_sync_emit(self) -> None:
        self._scroll_sync_armed = False
        self.scrollOffsetChanged.emit()

    def snap_threshold_ms(self) -> int:
        duration = max(1, self.timeline_span_ms())
        virtual = max(1, self.virtual_content_width())
        px_ms = duration / virtual
        return max(40, min(250, int(round(px_ms * 10))))

    def _snap_ms(self, ms: int, *, exclude_clip_id: str) -> int:
        clips = self.video_clips()
        points = clip_boundary_ms_list(clips)
        clip = find_clip(clips, exclude_clip_id)
        if exclude_clip_id and clip is not None:
            drop = {int(clip.timeline_start_ms), int(clip.timeline_start_ms + clip.duration_ms)}
            points = [p for p in points if p not in drop]
        points.append(int(self.position_ms))
        return snap_timeline_ms(ms, points, threshold_ms=self.snap_threshold_ms())

    def zoom_to_clip(self, clip_id: str) -> None:
        clip = find_clip(self.video_clips(), clip_id)
        if clip is None:
            return None
        duration = max(1, self.project_duration_ms)
        target_ratio = max(0.08, min(0.7, clip.duration_ms / duration))
        factor = 0.55 / max(0.02, target_ratio)
        mid_ms = clip.timeline_start_ms + clip.duration_ms // 2
        focal_x = float(self.content_track_left() + self.visible_content_width() // 2)
        self.set_zoom_factor(factor, focal_x=focal_x)
        virtual = self.virtual_content_width()
        center_x = self.content_track_left() + self.visible_content_width() / 2
        self.scroll_offset_px = mid_ms / duration * virtual - (center_x - self.content_track_left())
        self._clamp_scroll()
        self.zoomChanged.emit(self.zoom_factor)
        self.update()

    def visible_content_width(self) -> int:
        return max(120, self.width() - self.header_width - self.CONTENT_PAD_LEFT - self.CONTENT_PAD_RIGHT)

    def virtual_content_width(self) -> int:
        base = max(1, self.visible_content_width())
        z = max(TIMELINE_ZOOM_MIN, min(TIMELINE_ZOOM_MAX, float(self.zoom_factor)))
        return max(60, int(round(base * z)))

    def max_scroll_px(self) -> int:
        return max(0, self.virtual_content_width() - self.visible_content_width())

    def _clamp_scroll(self) -> None:
        self.scroll_offset_px = max(0.0, min(float(self.max_scroll_px()), float(self.scroll_offset_px)))

    def time_to_x(self, ms: int) -> int:
        duration = max(1, self.timeline_span_ms())
        track_left = self.content_track_left()
        virtual = self.virtual_content_width()
        return track_left + int(virtual * int(ms) / duration) - int(self.scroll_offset_px)

    def content_x_to_ms(self, x: float) -> int:
        duration = max(1, self.timeline_span_ms())
        virtual = max(1, self.virtual_content_width())
        track_left = self.content_track_left()
        relative = (float(x) - track_left + self.scroll_offset_px) / virtual
        return max(0, min(duration, int(relative * duration)))

    def content_track_left(self) -> int:
        return self.header_width + self.CONTENT_PAD_LEFT

    def _bar_rect(self, start_ms: int, end_ms: int, top: int, duration_ms: int, *, min_width: int) -> QRect:
        duration = max(1, int(duration_ms or 1))
        start, end = (self._resolve_layer_range_ms(start_ms, end_ms, duration)[0], self._resolve_layer_range_ms(start_ms, end_ms, duration)[1])
        left = self.time_to_x(start)
        right = self.time_to_x(end)
        track_left = self.content_track_left()
        left = max(track_left, left)
        right = max(left + 1, right)
        width = max(max(1, int(min_width)), right - left)
        return QRect(left, top + 5, width, self.track_height - 10)

    def _elided_clip_text(self, painter: QPainter, rect: QRect, text: str) -> str:
        return painter.fontMetrics().elidedText(text, Qt.TextElideMode.ElideRight, max(8, rect.width() - 4))

    def _paint_track_header(self, painter: QPainter, top: int, track_name: str, track_kind: str, *, row_kinds: tuple[str, ...] | None=None, row_ref: str='') -> None:
        painter.fillRect(0, top, self.header_width, self.track_height, QColor('#121A26'))
        accent = self._track_header_accent(track_kind, row_kinds)
        painter.fillRect(0, top + 2, 3, self.track_height - 4, accent)
        hidden = track_preview_hidden(self.state.values, track_kind)
        locked = track_edit_locked(self.state.values, track_kind)
        icon_y = top + (self.track_height - 16) // 2
        painter.setPen(QColor('#A8B8CC' if hidden else '#5C6B80'))
        painter.drawText(8, icon_y, 18, 16, Qt.AlignmentFlag.AlignCenter, '◎' if hidden else '○')
        painter.setPen(QColor('#A8B8CC' if locked else '#E8A84A'))
        painter.drawText(28, icon_y, 18, 16, Qt.AlignmentFlag.AlignCenter, '■' if locked else '□')
        kind0 = row_kinds[0] if row_kinds else track_kind.split(':', 1)[0]
        layer_controls = kind0 in _PLUS_MINUS_KINDS or (row_kinds is not None and ('media_overlay' in row_kinds or 'blend_layer' in row_kinds or 'background_layer' in row_kinds))
        plus_minus_w = 40 if layer_controls else 0
        name_left = 50
        name_width = max(0, self.header_width - name_left - plus_minus_w - 4)
        label = str(track_name or '').strip() or '—'
        if name_width >= 24:
            painter.save()
            font = painter.font()
            font.setBold(True)
            point = font.pointSize()
            if point > 0:
                font.setPointSize(max(point, 10))
            else:
                font.setPixelSize(max(font.pixelSize(), 12))
            painter.setFont(font)
            painter.setPen(QColor('#F2F6FC') if hidden else '#7A8799')
            name_rect = QRect(name_left, top, name_width, self.track_height)
            painter.drawText(name_rect, Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, self._elided_clip_text(painter, name_rect, label))
            painter.restore()
        if layer_controls:
            self._paint_layer_header_slots(painter, top, icon_y, row_kinds or (kind0,), row_ref)
        painter.setPen(QPen(QColor('#2A3548'), 1))
        painter.drawLine(self.header_width, top, self.header_width, top + self.track_height)

    @staticmethod
    def _track_header_accent(track_kind: str, row_kinds: tuple[str, ...] | None=None) -> QColor:
        key = str(track_kind or '').split(':', 1)[0]
        if 'media_overlay' in row_kinds:
            key = 'media_overlay'
        elif 'blend_layer' in row_kinds:
            key = 'blend_layer'
        elif 'background_layer' in row_kinds:
            key = 'background_layer'
        elif row_kinds and row_kinds:
            key = str(row_kinds[0]).split(':', 1)[0]
        accents = {'video': '#3DDC97', 'media_overlay': '#4C8DFF', 'blend_layer': '#E89A3C', 'background_layer': '#9B6BFF', 'subtitle': '#B794F6', 'subtitle_source': '#9B7EC8', 'text_overlay': '#E8C45A', 'video_title': '#FFD56A', 'text_logo': '#E05A9A', 'blur': '#6FA4FF', 'voice': '#57D39A', 'source_audio': '#6B8A9E', 'audio': '#5B9AFF', 'music': '#5B9AFF', 'sfx': '#F0A06A', 'dyn_audio': '#7DCEA0'}
        return QColor(accents.get(key, '#6B7C93'))

    def _paint_layer_header_slots(self, painter: QPainter, top: int, icon_y: int, row_kinds: tuple[str, ...], row_ref: str) -> None:
        _ = top
        is_overlay = 'media_overlay' in row_kinds
        is_blend = 'blend_layer' in row_kinds
        is_background = 'background_layer' in row_kinds
        minus_rect = QRect(self.header_width - 42, icon_y, 18, 16)
        plus_rect = QRect(self.header_width - 22, icon_y, 18, 16)
        if is_overlay or is_blend or is_background:
            if is_overlay:
                items = ensure_media_overlays(self.state.values)
                max_n = MAX_OVERLAY_TRACKS
                add_kind = 'media_overlay'
            elif is_blend:
                items = ensure_blend_layers(self.state.values)
                max_n = MAX_BLEND_TRACKS
                add_kind = 'blend_layer'
            else:
                items = ensure_background_layers(self.state.values)
                max_n = MAX_BACKGROUND_TRACKS
                add_kind = 'background_layer'
            filled = count_filled_layer_tracks(items)
            can_add = filled < max_n
            parsed = parse_layer_row_ref(row_ref)
            can_remove = bool(parsed and parsed[1] != 'new')
            focus_id = self._focus_id_for_row(row_kinds, row_ref)
        else:
            kind0 = row_kinds[0]
            can_add, can_remove = (self._track_plus_minus_state(kind0)[0], self._track_plus_minus_state(kind0)[1])
            focus_id = f'track-remove:{kind0}'
            add_kind = kind0
        painter.setPen(QColor('#E07A7A' if can_remove else '#4A5568'))
        painter.drawText(minus_rect, Qt.AlignmentFlag.AlignCenter, '－')
        painter.setPen(QColor('#7DCEA0' if can_add else '#4A5568'))
        painter.drawText(plus_rect, Qt.AlignmentFlag.AlignCenter, '＋')
        if can_remove:
            self._header_action_rects.append(('minus', focus_id, QRect(minus_rect)))
        if can_add:
            self._header_action_rects.append(('plus', add_kind, QRect(plus_rect)))
            return None

    def _track_plus_minus_state(self, kind: str) -> tuple[bool, bool]:
        values = self.state.values
        if kind == 'video':
            clips = self.video_clips()
            return (True, bool(clips))
        if kind in frozenset({'subtitle', 'subtitle_source'}):
            from ui_qt.subtitle_source_document import subtitle_row_visible
            shown = subtitle_row_visible(values, kind)
            return (not shown, shown)
        if kind == 'text_overlay':
            from ui_qt.text_overlays import ensure_text_overlays
            items = ensure_text_overlays(values)
            return (True, bool(items))
        if kind == 'video_title':
            return (True, bool(values.get('video_title_enabled')))
        if kind == 'text_logo':
            return (True, bool(values.get('logo_enabled')))
        if kind == 'blur':
            on = bool(values.get('blur_zone_enabled'))
            return (True, on)
        if kind == 'voice':
            on = bool(values.get('voice_audio_enabled')) and bool(str(values.get('voice_audio_path', '') or '').strip())
            return (True, on)
        if kind == 'source_audio':
            return (False, False)
        if kind in frozenset({'audio', 'music'}):
            on = bool(values.get('background_audio_enabled')) and bool(str(values.get('background_audio_path', '') or '').strip())
            return (True, on)
        return (True, bool(self.state.sfx_events)) if kind == 'sfx' else (True, False)

    def _subtitle_row_kind_from_header(self, kind: str, payload: str) -> str | None:
        blob = f'{kind}:{payload}'
        if 'subtitle_source' in blob:
            return 'subtitle_source'
        if kind == 'subtitle' or str(payload).endswith(':subtitle') or payload == 'subtitle':
            return 'subtitle'

    def _handle_subtitle_row_minus(self, kind: str, payload: str) -> bool:
        from ui_qt.subtitle_source_document import set_subtitle_row_visible
        target = self._subtitle_row_kind_from_header(kind, payload)
        if target is None:
            return False
        set_subtitle_row_visible(self.state.values, target, False)
        self._refresh_canvas_height()
        self.trackControlsChanged.emit()
        self.update()
        return True

    def _handle_subtitle_row_plus(self, kind: str, payload: str) -> bool:
        from ui_qt.subtitle_source_document import set_subtitle_row_visible, subtitle_row_visible
        target = self._subtitle_row_kind_from_header(kind, payload)
        if target is None:
            return False
        if subtitle_row_visible(self.state.values, target):
            return False
        set_subtitle_row_visible(self.state.values, target, True)
        self._refresh_canvas_height()
        self.trackControlsChanged.emit()
        self.update()
        return True

    def _track_header_hit(self, point, top: int, track_kind: str) -> str | None:
        if top <= point.y() < top + self.track_height:
            for action, _payload, rect in self._header_action_rects:
                if rect.contains(point):
                    return action
            icon_y = top + (self.track_height - 16) // 2
            eye_rect = QRect(4, icon_y, 22, 16)
            lock_rect = QRect(24, icon_y, 22, 16)
            if eye_rect.contains(point):
                return 'eye'
            if lock_rect.contains(point):
                return 'lock'
        else:
            return None

    def _header_action_payload_at(self, point) -> tuple[str, str] | None:
        for action, payload, rect in self._header_action_rects:
            if rect.contains(point):
                return (action, payload)

    def _paint_track_row_overlay(self, painter: QPainter, top: int, track_kind: str) -> None:
        hidden = track_preview_hidden(self.state.values, track_kind)
        locked = track_edit_locked(self.state.values, track_kind)
        if hidden or locked:
            row = QRect(0, top, self.width(), self.track_height)
            if hidden:
                painter.fillRect(row, QColor(0, 0, 0, 115))
                content_left = self.content_track_left()
                content = QRect(content_left, top + 5, max(12, self.width() - content_left - 4), self.track_height - 10)
                painter.setPen(QColor(220, 220, 220, 140))
                painter.drawText(content, Qt.AlignmentFlag.AlignCenter, 'Ẩn preview')
            if locked:
                painter.setPen(QPen(QColor('#E8A84A'), 1, Qt.PenStyle.DashLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawRoundedRect(row.adjusted(2, 3, -3, -4), 4, 4)
                lock_rect = QRect(self.header_width + 52, top + 4, 52, 14)
                painter.fillRect(lock_rect, QColor('#E8A84A'))
                painter.setPen(QColor('#101824'))
                painter.drawText(lock_rect, Qt.AlignmentFlag.AlignCenter, 'Khóa')
                return None
        else:
            return None

    def set_zoom_factor(self, factor: float, focal_x: float | None=None) -> None:
        factor = max(TIMELINE_ZOOM_MIN, min(TIMELINE_ZOOM_MAX, float(factor)))
        if abs(factor - self.zoom_factor) < 0.0001:
            return None
        track_left = self.content_track_left()
        focal_ms = None
        if focal_x is not None:
            focal_ms = self.content_x_to_ms(float(focal_x))
        self.zoom_factor = factor
        if focal_ms is not None:
            virtual = self.virtual_content_width()
            duration = max(1, self.project_duration_ms)
            target_x = float(focal_x)
            self.scroll_offset_px = focal_ms / duration * virtual - (target_x - track_left)
        self._clamp_scroll()
        self.zoomChanged.emit(self.zoom_factor)
        self.scrollOffsetChanged.emit()
        self._invalidate_playback_body_cache()
        self.update()

    def set_scroll_offset_px(self, offset_px: float) -> None:
        before = self.scroll_offset_px
        self.scroll_offset_px = float(offset_px)
        self._clamp_scroll()
        if abs(self.scroll_offset_px - before) > 0.01:
            self.scrollOffsetChanged.emit()
            self._invalidate_playback_body_cache()
        self.update()

    def zoom_in(self, focal_x: float | None=None) -> None:
        fx = focal_x if focal_x is not None else self.width() / 2
        self.set_zoom_factor(self.zoom_factor * 1.25, focal_x=fx)

    def zoom_out(self, focal_x: float | None=None) -> None:
        fx = focal_x if focal_x is not None else self.width() / 2
        self.set_zoom_factor(self.zoom_factor / 1.25, focal_x=fx)

    def wheelEvent(self, event) -> None:
        delta = event.angleDelta().y()
        if event.modifiers() & Qt.KeyboardModifier.ControlModifier and delta != 0:
            steps = delta / 120.0
            factor = self.zoom_factor * (1.0 + steps * 0.12)
            self.set_zoom_factor(factor, focal_x=event.position().x())
            event.accept()
            return None
        event.ignore()

    def paintEvent(self, _event) -> None:
        if self._scrubbing and (not self._body_cache_usable()):
            self._scrub_need_cache = True
        if self._want_body_cache_mode() and self._body_cache_usable():
            painter = QPainter(self)
            painter.drawPixmap(0, 0, self._playback_body_cache)
            self._paint_playhead_chrome(painter, row_count=int(self._body_cache_row_count or 0) or None)
            return None
        scrub_build = bool(self._want_body_cache_mode() and getattr(self, '_scrub_need_cache', False))
        rebuild_cache = scrub_build or (bool(self._playback_lite) and (not self._body_cache_usable()))
        if rebuild_cache:
            dpr = float(self.devicePixelRatioF() or 1.0)
            pm = QPixmap(max(1, int(self.width() * dpr)), max(1, int(self.height() * dpr)))
            pm.setDevicePixelRatio(dpr)
            pm.fill(QColor('#0C121C'))
            painter = QPainter(pm)
        else:
            pm = None
            painter = QPainter(self)
        lite_paint = self._want_body_cache_mode()
        if not lite_paint:
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        if not rebuild_cache:
            painter.fillRect(self.rect(), QColor('#0C121C'))
        self._clip_rects.clear()
        self._subtitle_cue_rects.clear()
        self._subtitle_cue_labels.clear()
        self._subtitle_source_cue_rects.clear()
        self._subtitle_source_cue_labels.clear()
        self._timeline_clip_rects.clear()
        self._layer_rects.clear()
        self._layer_timing_meta.clear()
        self._add_rects.clear()
        self._transition_hit_rects.clear()
        self._header_action_rects.clear()
        self._sfx_marker_rects.clear()
        visible = self.visible_content_width()
        duration_ms = max(1, self.project_duration_ms)
        clips = self.video_clips()
        timeline_assets = self._timeline_assets()
        rows = self.track_rows()
        view_y0 = 0
        view_y1 = self.height()
        scroll_area = self.parentWidget()
        while scroll_area is not None and not isinstance(scroll_area, QScrollArea):
            scroll_area = scroll_area.parentWidget()
        vp = scroll_area.viewport() if scroll_area is not None else None
        if isinstance(scroll_area, QScrollArea) and vp is not None:
            top_left = self.mapFrom(vp, vp.rect().topLeft())
            bottom_right = self.mapFrom(vp, vp.rect().bottomRight())
            view_y0 = int(top_left.y()) - self.track_height
            view_y1 = int(bottom_right.y()) + self.track_height
        for row, (track_name, kinds, color_name, video_track, audio_clip_id) in enumerate(rows):
            top = self.ruler_height + row * self.track_height
            if lite_paint and (not rebuild_cache) and (top + self.track_height < view_y0 or top > view_y1):
                pass
            else:
                painter.setPen(QPen(QColor('#222D3E'), 1))
                painter.drawLine(0, top + self.track_height - 1, self.width(), top + self.track_height - 1)
                painter.save()
                painter.setClipRect(self.header_width, top, max(1, self.width() - self.header_width), self.track_height)
                if 'sfx' in kinds:
                    self._paint_sfx_track(painter, top, visible, duration_ms, color_name)
                    painter.restore()
                    self._paint_track_row_overlay(painter, top, 'sfx')
                    self._paint_track_header(painter, top, track_name, kinds[0], row_kinds=kinds)
                elif video_track is not None:
                    kind_key = kinds[0]
                    self._paint_video_clips_track(painter, top, visible, duration_ms, color_name, clips=clips, track_index=int(video_track), empty_kind=kind_key)
                    painter.restore()
                    self._paint_track_row_overlay(painter, top, kind_key)
                    self._paint_track_header(painter, top, track_name, kind_key, row_kinds=kinds)
                elif 'media_overlay' in kinds or 'blend_layer' in kinds or 'background_layer' in kinds:
                    kind_key = self._header_kind_for_row(kinds, audio_clip_id)
                    self._paint_layer_slot_track(painter, top, visible, duration_ms, color_name, kinds[0], audio_clip_id)
                    painter.restore()
                    self._paint_track_row_overlay(painter, top, kind_key)
                    self._paint_track_header(painter, top, track_name, kind_key, row_kinds=kinds, row_ref=audio_clip_id)
                elif 'dyn_audio' in kinds and audio_clip_id:
                    self._paint_dyn_audio_track(painter, top, visible, duration_ms, color_name, audio_clip_id)
                    painter.restore()
                    header_kind = f'dyn_audio:{audio_clip_id}'
                    self._paint_track_row_overlay(painter, top, header_kind)
                    self._paint_track_header(painter, top, track_name, header_kind)
                elif 'subtitle_source' in kinds:
                    from core.subtitle_clock_align import align_source_clock_to_working
                    from ui_qt.subtitle_source_document import get_source_subtitles, subtitle_row_visible
                    source_segments = ()
                    if subtitle_row_visible(self.state.values, 'subtitle_source'):
                        source_segments = align_source_clock_to_working(get_source_subtitles(self.state), getattr(self.state, 'subtitles', None)).segments
                    self._paint_subtitle_cue_row(painter, top, visible, duration_ms, color_name, track_name, kinds, source_segments, self._subtitle_source_cue_rects, self._subtitle_source_cue_labels, header_kind='subtitle_source', empty_kind='subtitle_source', selected=False)
                elif 'subtitle' in kinds:
                    from ui_qt.subtitle_source_document import subtitle_row_visible
                    row_assets = [asset for asset in timeline_assets if asset.kind == 'subtitle']
                    paint_asset = row_assets[0] if row_assets else None
                    working_segments = tuple(getattr(getattr(self.state, 'subtitles', None), 'segments', None) or ()) if subtitle_row_visible(self.state.values, 'subtitle') else ()
                    self._paint_subtitle_cue_row(painter, top, visible, duration_ms, color_name, track_name, kinds, working_segments, self._subtitle_cue_rects, self._subtitle_cue_labels, header_kind='subtitle', empty_kind='subtitle', selected=bool(paint_asset is not None and paint_asset.id == self.selected_id))
                else:
                    kind = kinds[0]
                    self._paint_value_layer_track(painter, top, visible, duration_ms, kind, color_name)
                    painter.restore()
                    self._paint_track_row_overlay(painter, top, kind)
                    self._paint_track_header(painter, top, track_name, kind, row_kinds=kinds)
        if len(clips) <= 1:
            self._paint_trim_region(painter, duration_ms)
        else:
            self._trim_in_rect = QRect()
            self._trim_out_rect = QRect()
        sticky_top = self._sticky_ruler_top()
        painter.fillRect(0, sticky_top, self.width(), self.ruler_height, QColor('#101824'))
        painter.save()
        painter.translate(0, sticky_top)
        self._paint_ruler(painter)
        painter.fillRect(0, 0, self.header_width, self.ruler_height, QColor('#101824'))
        painter.setPen(QPen(QColor('#2A3548'), 1))
        painter.drawLine(self.header_width, 0, self.header_width, self.ruler_height)
        painter.restore()
        if rebuild_cache and pm is not None:
            painter.end()
            self._playback_body_cache = pm
            self._playback_body_dirty = False
            self._scrub_need_cache = False
            self._body_cache_scroll_px = float(self.scroll_offset_px)
            self._body_cache_zoom = float(self.zoom_factor)
            self._body_cache_row_count = len(rows)
            painter = QPainter(self)
            painter.drawPixmap(0, 0, pm)
        self._paint_playhead_chrome(painter, row_count=len(rows))

    def _paint_playhead_chrome(self, painter: QPainter, *, row_count: int | None) -> None:
        if row_count is None:
            cached = int(getattr(self, '_body_cache_row_count', 0) or 0)
            row_count = cached if cached > 0 else max(1, len(self.track_rows()))
        playhead_x = self.time_to_x(self.position_ms)
        self._playhead_x = playhead_x
        track_bottom = self.ruler_height + self.track_height * int(row_count)
        painter.setPen(QPen(QColor('#FFCC57'), 2))
        painter.drawLine(playhead_x, 0, playhead_x, track_bottom)
        sticky_top = self._sticky_ruler_top()
        painter.save()
        painter.translate(0, sticky_top)
        handle = QRect(playhead_x - self.handle_width // 2, 2, self.handle_width, self.ruler_height - 4)
        painter.setBrush(QColor('#FFCC57'))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(handle, 2, 2)
        painter.setPen(QPen(QColor('#FFCC57'), 2))
        painter.drawLine(playhead_x, 0, playhead_x, self.ruler_height)
        painter.restore()

    def _paint_video_clips_track(self, painter: QPainter, top: int, visible: int, duration_ms: int, color_name: str, clips: list | None=None, *, track_index: int, empty_kind: str) -> None:
        from ui_qt.media_thumbnails import FILMSTRIP_THUMB_H, FILMSTRIP_THUMB_W, media_thumbnail_pixmap_if_ready
        video = self._selected_video_asset()
        hint = _EMPTY_HINTS.get(empty_kind, '＋ Thả video từ dự án')
        if video is None and track_index == 0:
            self._paint_empty_track(painter, top, visible, empty_kind, hint)
            return None
        if clips is None:
            clips = self.video_clips()
        track_clips = clips_on_track(clips, track_index)
        if track_clips:
            selected_tclip = selected_clip_id(self.state.values)
            selected_set = set(selected_clip_ids(self.state.values))
            if selected_tclip:
                selected_set.add(selected_tclip)
            color = QColor(color_name)
            view_left = self.header_width
            view_right = self.header_width + visible
            many = len(track_clips) > 24
            min_w = 2 if many else 12
            skip_strip = bool(many)
            if many or self._want_body_cache_mode():
                painter.setRenderHint(QPainter.RenderHint.Antialiasing, False)
            need_paths = []
            for index, tclip in enumerate(track_clips):
                start = tclip.timeline_start_ms
                end = start + tclip.duration_ms
                rect = self._bar_rect(start, end, top, duration_ms, min_width=min_w)
                if rect.right() < view_left - 2 or rect.left() > view_right + 2:
                    pass
                else:
                    self._timeline_clip_rects[tclip.id] = rect
                    if index == 0 and track_index == 0 and (video is not None):
                        self._clip_rects[video.id] = rect
                    is_sel = tclip.id in selected_set
                    path = str(tclip.source_path or (getattr(video, 'path', None) if video is not None else '') or '').strip()
                    is_primary = tclip.id == selected_tclip
                    painter.setPen(QPen(color.lighter(145) if is_sel else QColor('#1A2436'), 1))
                    use_strip = bool(path) and rect.width() >= 8 and (not many) and (not skip_strip)
                    pix = None
                    thumb_h = max(12, rect.height())
                    cache_key = f'{path}|{FILMSTRIP_THUMB_W}x{FILMSTRIP_THUMB_H}'
                    pix = self._filmstrip_cache.get(cache_key)
                    pix = media_thumbnail_pixmap_if_ready(path, 'video', width=FILMSTRIP_THUMB_W, height=FILMSTRIP_THUMB_H)
                    if pix is None or pix.isNull():
                        pix = None
                        if use_strip and pix is None and (path not in self._filmstrip_requested):
                            need_paths.append(path)
                            self._filmstrip_requested.add(path)
                    else:
                        self._filmstrip_cache[cache_key] = pix
                    if use_strip and pix is not None and (not pix.isNull()) and (pix.width() > 0):
                        painter.save()
                        painter.setClipRect(rect)
                        scaled_key = f'{cache_key}|h{thumb_h}'
                        scaled = self._filmstrip_cache.get(scaled_key)
                        if scaled is None or scaled.isNull():
                            scaled = pix.scaledToHeight(thumb_h, Qt.TransformationMode.FastTransformation)
                            self._filmstrip_cache[scaled_key] = scaled
                        x = rect.left()
                        step = max(1, scaled.width())
                        while x < rect.right():
                            painter.drawPixmap(x, rect.top(), scaled)
                            x += step
                        painter.fillRect(rect, QColor(8, 14, 24, 40 if is_sel else 75))
                        if is_sel:
                            painter.fillRect(rect, QColor(255, 200, 70, 55))
                        painter.restore()
                    else:
                        painter.setBrush(color.lighter(120) if is_sel else color.darker(140))
                        painter.drawRect(rect)
                    if is_sel:
                        self._paint_selection_glow(painter, rect, primary=is_primary, rounded=False)
                    head_ms = int(getattr(tclip, 'video_trim_head_ms', 0) or 0)
                    tail_ms = int(getattr(tclip, 'video_trim_tail_ms', 0) or 0)
                    if (head_ms or tail_ms) and rect.width() >= 4:
                        painter.setPen(Qt.PenStyle.NoPen)
                        painter.setBrush(QColor(255, 140, 40, 220))
                        mark = max(3, min(12, int(rect.width() * 0.18)))
                        if head_ms:
                            painter.fillRect(int(rect.left()), int(rect.top()), mark, int(rect.height()), QColor(255, 140, 40, 220))
                        if tail_ms:
                            painter.fillRect(int(rect.right()) - mark, int(rect.top()), mark, int(rect.height()), QColor(255, 140, 40, 220))
                    if index > 0 and rect.width() >= 2 and (track_index != 0):
                        painter.setPen(QPen(QColor('#FFCC57'), 1 if many else 2))
                        painter.drawLine(rect.left(), top + 2, rect.left(), top + self.track_height - 3)
                    if rect.width() < 28 or many or skip_strip:
                        pass
                    else:
                        painter.setPen(QColor('#FFFFFF'))
                        painter.save()
                        painter.setClipRect(rect)
                        src_name = Path(path).name if path else video.name if video is not None else 'Video'
                        label = src_name if len(track_clips) == 1 else f'{src_name} · {index + 1}'
                        if track_index > 0:
                            label = f'V{track_index + 1} · {label}'
                        vol = int(getattr(tclip, 'volume_percent', 100) or 100)
                        if vol != 100:
                            label = f'{label} · {vol}%'
                        painter.drawText(rect.adjusted(6, 0, -4, 0), Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, self._elided_clip_text(painter, rect, label))
                        painter.restore()
            if track_index == 0 and len(track_clips) >= 2 and (not skip_strip):
                self._paint_transition_joins(painter, track_clips=track_clips, top=top, duration_ms=duration_ms, view_left=view_left, view_right=view_right, compact=many)
            if many and (not skip_strip):
                painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
            if need_paths:
                self.filmstripPathsNeeded.emit(need_paths)
                return None
        else:
            self._paint_empty_track(painter, top, visible, empty_kind, hint)
            return None

    def _resolved_join_styles(self, join_count: int) -> list[str]:
        from core.timeline_transitions import normalize_random_pool, resolve_join_styles
        values = self.state.values
        mode = str(values.get('timeline_transition_mode', 'one_for_all') or 'one_for_all')
        style = str(values.get('timeline_transition_style', 'fade') or 'fade')
        raw_pool = values.get('timeline_transition_random_pool')
        pool = None if raw_pool is None else normalize_random_pool(raw_pool)
        try:
            seed = int(values.get('timeline_transition_seed', 0) or 0)
        except (TypeError, ValueError):
            seed = 0
        return resolve_join_styles(join_count, mode=mode, style=style, random_pool=pool, seed=seed)

    def _paint_transition_joins(self, painter: QPainter, *, track_clips: list, top: int, duration_ms: int, view_left: int, view_right: int, compact: bool) -> None:
        from core.timeline_transitions import style_duration_ms, style_label, style_xfade_name
        fade_ms = max(0, int(self.state.values.get('timeline_transition_ms', 0) or 0))
        joins = max(0, len(track_clips) - 1)
        styles = self._resolved_join_styles(joins)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        mid_y = top + self.track_height // 2
        label_font = QFont(painter.font())
        label_font.setPointSize(max(7, label_font.pointSize() - 1))
        label_font.setBold(True)
        for index, tclip in enumerate(track_clips):
            style = styles[index - 1] if index - 1 < len(styles) else 'cut'
            style = str(style or 'cut').strip().lower()
            join_ms = fade_ms
            if join_ms <= 0 and style != 'cut':
                join_ms = style_duration_ms(style, 250)
            active = join_ms > 0 and style != 'cut' and bool(style_xfade_name(style))
            boundary = int(tclip.timeline_start_ms)
            prev_dur = max(40, int(track_clips[index - 1].duration_ms) // 3)
            cur_dur = max(40, int(tclip.duration_ms) // 3)
            edge = min(max(join_ms if active else 80, 48), prev_dur, cur_dur)
            zone = self._bar_rect(max(0, boundary - edge), boundary + edge, top, duration_ms, min_width=10 if compact else 14)
            if index == 0 or zone.right() < view_left - 2 or zone.left() > view_right + 2:
                pass
            else:
                self._transition_hit_rects.append((boundary, QRect(zone), style, join_ms if active else 0))
                mid_x = self._bar_rect(boundary, boundary + 1, top, duration_ms, min_width=2).left()
                if active:
                    painter.fillRect(zone, QColor(255, 196, 64, 42 if compact else 70))
                    painter.setPen(QPen(QColor('#FFCC57'), 2 if compact else 2.5))
                    painter.drawLine(mid_x, top + 2, mid_x, top + self.track_height - 3)
                    half = 5 if compact else 7
                    diamond = QPainterPath()
                    diamond.moveTo(mid_x, mid_y - half)
                    diamond.lineTo(mid_x + half, mid_y)
                    diamond.lineTo(mid_x, mid_y + half)
                    diamond.lineTo(mid_x - half, mid_y)
                    diamond.closeSubpath()
                    painter.setPen(QPen(QColor('#1A2436'), 1))
                    painter.setBrush(QColor('#FFCC57'))
                    painter.drawPath(diamond)
                    if not compact and zone.width() >= 44:
                        name = style_label(style)
                        short = name if len(name) <= 12 else name[:11] + '…'
                        text = f'{short} · {join_ms}ms'
                        painter.setFont(label_font)
                        metrics = painter.fontMetrics()
                        tw = metrics.horizontalAdvance(text) + 8
                        th = metrics.height() + 2
                        tx = mid_x - tw // 2
                        ty = top + 2
                        if tx < zone.left() + 1:
                            tx = zone.left() + 1
                        if tx + tw > zone.right() - 1:
                            tx = max(zone.left() + 1, zone.right() - tw - 1)
                        label_rect = QRect(tx, ty, tw, th)
                        painter.setPen(Qt.PenStyle.NoPen)
                        painter.setBrush(QColor(18, 24, 36, 200))
                        painter.drawRoundedRect(label_rect, 3, 3)
                        painter.setPen(QColor('#FFE08A'))
                        painter.drawText(label_rect, Qt.AlignmentFlag.AlignCenter, text)
                else:
                    painter.setPen(QPen(QColor('#6B7C93'), 1, Qt.PenStyle.DashLine))
                    painter.drawLine(mid_x, top + 4, mid_x, top + self.track_height - 5)
                    half = 4 if compact else 5
                    painter.setPen(QPen(QColor('#6B7C93'), 1))
                    painter.setBrush(QColor('#2A3548'))
                    painter.drawEllipse(QPoint(mid_x, mid_y), half, half)

    def _paint_empty_track(self, painter: QPainter, top: int, visible: int, kind: str, hint: str) -> None:
        left = self.content_track_left()
        rect = QRect(left, top + 5, visible, self.track_height - 10)
        self._add_rects.append((kind, rect))
        painter.setPen(QPen(QColor('#3A465A'), 1, Qt.PenStyle.DashLine))
        painter.setBrush(QColor(255, 255, 255, 8))
        painter.drawRoundedRect(rect, 5, 5)
        painter.setPen(QColor('#8A97AB'))
        hint_rect = rect.adjusted(10, 0, -8, 0)
        painter.drawText(hint_rect, Qt.AlignmentFlag.AlignVCenter, self._elided_clip_text(painter, hint_rect, hint))

    def _paint_selection_glow(self, painter: QPainter, rect: QRect, *, primary: bool, rounded: bool) -> None:
        if rect.width() < 2 or rect.height() < 2:
            return None
        base = QColor('#FFD56A' if primary else '#E8C45A')
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        rings = ((7, 28), (5, 55), (3.5, 110), (2.2, 200))
        for width, alpha in rings:
            c = QColor(base)
            c.setAlpha(alpha)
            pen = QPen(c, width)
            pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
            pen.setCapStyle(Qt.PenCapStyle.RoundCap)
            painter.setPen(pen)
            if rounded:
                painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 5, 5)
            else:
                painter.drawRect(rect.adjusted(1, 1, -1, -1))
        inner = QColor('#FFF6D0')
        pen = QPen(inner, 2 if primary else 1.5)
        pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
        painter.setPen(pen)
        if rounded:
            painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 5, 5)
        else:
            painter.drawRect(rect.adjusted(1, 1, -1, -1))
        hi_h = max(2, min(4, rect.height() // 5))
        painter.fillRect(QRect(rect.left() + 3, rect.top() + 1, max(0, rect.width() - 6), hi_h), QColor(255, 255, 255, 105 if primary else 70))
        painter.restore()

    def _paint_virtual_layer(self, painter: QPainter, top: int, duration_ms: int, layer_id: str, label: str, color_name: str, *, muted: bool) -> None:
        clip = self._bar_rect(0, duration_ms, top, duration_ms)
        self._layer_rects[layer_id] = clip
        color = QColor(color_name)
        if muted:
            color = color.darker(160)
        selected = self.selected_id == layer_id
        painter.setBrush(color.lighter(115) if selected else color.darker(140))
        painter.setPen(QPen(color.lighter(160) if selected else color, 1))
        painter.drawRoundedRect(clip, 5, 5)
        painter.setPen(QColor('#FFFFFF'))
        painter.save()
        painter.setClipRect(clip)
        painter.drawText(clip.adjusted(9, 0, -7, 0), Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, self._elided_clip_text(painter, clip, label))
        painter.restore()
        if selected:
            self._paint_selection_glow(painter, clip, primary=True)
            return None

    def _resolve_layer_range_ms(self, start_ms: int, end_ms: int, clip_duration_ms: int) -> tuple[int, int]:
        duration = max(1, int(clip_duration_ms or 1))
        start = max(0, min(int(start_ms or 0), duration - 1))
        end = int(end_ms or 0)
        if end <= 0:
            end = duration
        end = max(start + 1, min(end, duration))
        return (start, end)

    def _format_ms_clock(self, ms: int) -> str:
        total_sec = max(0, int(ms)) // 1000
        minutes, seconds = (divmod(total_sec, 60)[0], divmod(total_sec, 60)[1])
        return f':{seconds}02d'

    def _paint_timed_virtual_layer(self, painter: QPainter, top: int, visible: int, clip_duration_ms: int, layer_id: str, label: str, color_name: str, start_ms: int, end_ms: int, *, muted: bool, start_key: str | None, end_key: str | None, overlay_index: int | None, blend_index: int | None, background_index: int | None, text_index: int | None, media_path: str) -> None:
        clip = self._bar_rect(start_ms, end_ms, top, clip_duration_ms)
        self._layer_rects[layer_id] = clip
        self._layer_timing_meta[layer_id] = {'start_key': start_key, 'end_key': end_key, 'overlay_index': overlay_index, 'blend_index': blend_index, 'background_index': background_index, 'text_index': text_index, 'label': label, 'start_ms': start_ms, 'end_ms': end_ms}
        color = QColor(color_name)
        if muted:
            color = color.darker(160)
        selected = self.selected_id == layer_id
        lite = self._want_body_cache_mode()
        painter.setBrush(color.lighter(118) if selected else color.darker(140))
        painter.setPen(QPen(color.lighter(160) if selected else color, 1))
        if lite:
            painter.drawRect(clip)
        else:
            painter.drawRoundedRect(clip, 5, 5)
        text_left = 9
        path = str(media_path or '').strip()
        if path and clip.width() >= 36 and (clip.height() >= 14):
            from ui_qt.media_thumbnails import FILMSTRIP_THUMB_H, FILMSTRIP_THUMB_W, media_thumbnail_pixmap_if_ready
            thumb_h = max(12, clip.height() - 4)
            thumb_w = max(16, int(round(thumb_h * 16 / 9)))
            ext = Path(path).suffix.lower()
            kind = 'image' if ext in frozenset({'.webp', '.jpg', '.png', '.jpeg', '.gif', '.bmp'}) else 'video'
            cache_key = f'{path}|{FILMSTRIP_THUMB_W}x{FILMSTRIP_THUMB_H}|layer'
            pix = self._filmstrip_cache.get(cache_key)
            pix = media_thumbnail_pixmap_if_ready(path, kind, width=FILMSTRIP_THUMB_W, height=FILMSTRIP_THUMB_H)
            if pix is None or pix.isNull():
                pix = None
                if pix is None and kind == 'video' and (path not in self._filmstrip_requested):
                    self._filmstrip_requested.add(path)
                    self.filmstripPathsNeeded.emit([path])
            else:
                self._filmstrip_cache[cache_key] = pix
            tx = clip.left() + 3
            ty = clip.top() + max(1, (clip.height() - thumb_h) // 2)
            painter.fillRect(tx, ty, thumb_w, thumb_h, QColor(8, 12, 20, 160))
            if pix is not None and (not pix.isNull()):
                painter.drawPixmap(tx, ty, thumb_w, thumb_h, pix)
            text_left = 3 + thumb_w + 6
        if selected and clip.width() > self.handle_width * 2:
            painter.fillRect(QRect(clip.left(), clip.top(), self.handle_width, clip.height()), QColor(255, 214, 102, 150))
            painter.fillRect(QRect(clip.right() - self.handle_width + 1, clip.top(), self.handle_width, clip.height()), QColor(255, 214, 102, 150))
        if lite:
            return None
        painter.setPen(QColor('#FFFFFF'))
        painter.save()
        painter.setClipRect(clip)
        start_disp, end_disp = (self._resolve_layer_range_ms(start_ms, end_ms, clip_duration_ms)[0], self._resolve_layer_range_ms(start_ms, end_ms, clip_duration_ms)[1])
        time_suffix = f' {self._format_ms_clock(start_disp)}–{self._format_ms_clock(end_disp)}'
        display = label + time_suffix if clip.width() > 72 else label
        painter.drawText(clip.adjusted(text_left, 0, -7, 0), Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, self._elided_clip_text(painter, clip, display))
        painter.restore()
        if selected:
            self._paint_selection_glow(painter, clip, primary=True)
            return None

    def _paint_value_layer_track(self, painter: QPainter, top: int, visible: int, duration_ms: int, kind: str, color_name: str) -> None:
        values = self.state.values
        clip_duration = max(1, int(duration_ms or 1))
        video = next((asset for asset in self._timeline_assets() if asset.kind == 'video'), None)
        if kind == 'voice':
            path = str(values.get('voice_audio_path', '') or '')
            enabled = bool(values.get('voice_audio_enabled')) and bool(path)
            if enabled:
                name = Path(path).name
                muted = int(values.get('voice_audio_volume', 100) or 0) <= 0
                self._paint_virtual_layer(painter, top, clip_duration, LAYER_VOICE, f'Giọng: {name}', color_name, muted=muted)
            else:
                self._paint_empty_track(painter, top, visible, 'voice', _EMPTY_HINTS['voice'])
            return None
        if kind == 'source_audio':
            from core.timeline_audio_clips import audio_clips_from_values
            dyn = audio_clips_from_values(values)
            if video is not None and video.has_audio:
                v_on = bool(values.get('video_vocal_enabled'))
                b_on = bool(values.get('video_bgm_enabled'))
                v_vol = int(values.get('video_vocal_volume', 0) or 0)
                b_vol = int(values.get('video_bgm_volume', 0) or 0)
                if dyn:
                    label = 'Video gốc · đã tách → track bên dưới'
                    muted = True
                elif v_on or b_on:
                    parts = []
                    if v_on and v_vol > 0:
                        parts.append(f'giọng {v_vol}%')
                    if b_on and b_vol > 0:
                        parts.append(f'nhạc {b_vol}%')
                    label = 'Video gốc · ' + ' + '.join(parts) if parts else 'Video gốc · tắt'
                    muted = not v_on and (not b_on)
                else:
                    label = 'Video gốc · tắt'
                    muted = True
                self._paint_virtual_layer(painter, top, clip_duration, LAYER_SOURCE_AUDIO, label, color_name, muted=muted)
            else:
                self._paint_empty_track(painter, top, visible, 'source_audio', _EMPTY_HINTS['source_audio'])
            return None
        if kind in frozenset({'audio', 'music'}):
            path = str(values.get('background_audio_path', '') or '')
            enabled = bool(values.get('background_audio_enabled')) and bool(path)
            if enabled:
                name = Path(path).name
                muted = int(values.get('background_audio_volume', 35) or 0) <= 0
                self._paint_timed_virtual_layer(painter, top, visible, clip_duration, LAYER_BGM, f'Nhạc file: {name}', color_name, int(values.get('background_audio_start_ms', 0) or 0), int(values.get('background_audio_end_ms', 0) or 0), muted=muted, start_key='background_audio_start_ms', end_key='background_audio_end_ms')
            else:
                self._paint_empty_track(painter, top, visible, 'audio', _EMPTY_HINTS['audio'])
            return None
        if kind == 'text_overlay':
            from ui_qt.text_overlays import ensure_text_overlays
            items = ensure_text_overlays(values)
            if items:
                count = len(items)
                for index, item in enumerate(items):
                    content = str(item.get('content') or '').strip() or '(trống)'
                    if len(content) > 22:
                        content = content[:21] + '…'
                    layer_id = LAYER_TEXT_OVERLAY if count == 1 else f'{LAYER_TEXT_OVERLAY}-{index}'
                    self._paint_timed_virtual_layer(painter, top, visible, clip_duration, layer_id, f'Chữ: {content}' if count == 1 else f'Chữ {index + 1}/{count}: {content}', color_name, int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), muted=not item.get('enabled', True), text_index=index)
            else:
                self._paint_empty_track(painter, top, visible, 'text_overlay', _EMPTY_HINTS['text_overlay'])
            return None
        if kind == 'blur':
            from ui_qt.blur_zones import ensure_blur_zones
            if values.get('blur_zone_enabled'):
                style = str(values.get('blur_zone_style', 'blur') or 'blur')
                style_label = 'tô đen' if style == 'black' else f"tô {values.get('blur_zone_color', '#000000')}" if style == 'color' else 'làm mờ'
                n = len(ensure_blur_zones(values))
                count = f' ×{n}' if n > 1 else ''
                self._paint_timed_virtual_layer(painter, top, visible, clip_duration, LAYER_BLUR, f'Vùng mờ{count} · {style_label}', color_name, 0, 0)
            else:
                self._paint_empty_track(painter, top, visible, 'blur', _EMPTY_HINTS['blur'])
            return None
        if kind == 'video_title':
            if values.get('video_title_enabled'):
                self._paint_timed_virtual_layer(painter, top, visible, clip_duration, LAYER_VIDEO_TITLE, 'Tiêu đề', color_name, int(values.get('video_title_start_ms', 0) or 0), int(values.get('video_title_end_ms', 0) or 0), start_key='video_title_start_ms', end_key='video_title_end_ms')
            else:
                self._paint_empty_track(painter, top, visible, 'video_title', _EMPTY_HINTS['video_title'])
            return None
        if kind == 'text_logo':
            if values.get('logo_enabled'):
                logo_path = str(values.get('logo_path', '') or '')
                logo_label = f'Logo: {Path(logo_path).name}' if logo_path else 'Logo'
                self._paint_timed_virtual_layer(painter, top, visible, clip_duration, LAYER_LOGO, logo_label, color_name, int(values.get('logo_start_ms', 0) or 0), int(values.get('logo_end_ms', 0) or 0), start_key='logo_start_ms', end_key='logo_end_ms', media_path=logo_path)
            else:
                self._paint_empty_track(painter, top, visible, 'text_logo', _EMPTY_HINTS['text_logo'])
            return None
        self._paint_empty_track(painter, top, visible, kind, _EMPTY_HINTS.get(kind, '＋ Thêm'))

    def _paint_layer_slot_track(self, painter: QPainter, top: int, visible: int, duration_ms: int, color_name: str, kind: str, row_ref: str) -> None:
        parsed = parse_layer_row_ref(row_ref)
        empty_kind = kind
        if parsed is None or parsed[1] == 'new':
            self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
        else:
            try:
                index = int(parsed[1])
            except ValueError:
                self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
            clip_duration = max(1, int(duration_ms or 1))
            if parsed[0] == 'overlay':
                items = ensure_media_overlays(self.state.values)
                if index < 0 or index >= len(items):
                    self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
                else:
                    item = items[index]
                    path = str(item.get('path', '') or '')
                    if path:
                        self._paint_timed_virtual_layer(painter, top, visible, clip_duration, f'layer-overlay-{index}', f'Lớp phủ: {Path(path).name}', color_name, int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), overlay_index=index, media_path=path)
                    else:
                        self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
            elif parsed[0] == 'background':
                items = ensure_background_layers(self.state.values)
                if index < 0 or index >= len(items):
                    self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
                else:
                    item = items[index]
                    path = str(item.get('path', '') or '')
                    if path:
                        self._paint_timed_virtual_layer(painter, top, visible, clip_duration, f'layer-background-{index}', f'Nền: {Path(path).name}', color_name, int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), background_index=index, media_path=path)
                    else:
                        self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
            else:
                items = ensure_blend_layers(self.state.values)
                if index < 0 or index >= len(items):
                    self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])
                else:
                    item = items[index]
                    path = str(item.get('path', '') or '')
                    if path:
                        self._paint_timed_virtual_layer(painter, top, visible, clip_duration, f'layer-blend-{index}', f'Hòa trộn: {Path(path).name}', color_name, int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0), blend_index=index, media_path=path)
                    else:
                        self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS[empty_kind])

    def _paint_dyn_audio_track(self, painter: QPainter, top: int, visible: int, duration_ms: int, color_name: str, audio_clip_id: str) -> None:
        from core.timeline_audio_clips import audio_clips_from_values, find_audio_clip
        clip = find_audio_clip(audio_clips_from_values(self.state.values), audio_clip_id)
        if clip is None:
            self._paint_empty_track(painter, top, visible, 'dyn_audio', _EMPTY_HINTS['dyn_audio'])
            return None
        if clip.kind in frozenset({'instrumental', 'vocal'}):
            start = 0
            end = max(1, int(duration_ms))
        else:
            start = max(0, int(clip.timeline_start_ms))
            dur = int(clip.duration_ms)
            if dur <= 0:
                dur = max(1, int(duration_ms) - start)
            end = min(int(duration_ms), start + max(1, dur))
        vol = int(clip.volume_percent)
        muted = not clip.enabled or vol <= 0
        name = Path(clip.path).name
        label = f'{clip.label} · {vol}% · {name}'
        layer_id = f'dyn-audio-{clip.id}'
        bar = self._bar_rect(start, end, top, max(1, int(duration_ms)))
        self._layer_rects[layer_id] = bar
        color = QColor(color_name)
        if muted:
            color = color.darker(160)
        painter.setBrush(color.darker(140))
        painter.setPen(QPen(color, 1))
        painter.drawRoundedRect(bar, 5, 5)
        painter.setPen(QColor('#FFFFFF'))
        painter.save()
        painter.setClipRect(bar)
        painter.drawText(bar.adjusted(9, 0, -7, 0), Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, self._elided_clip_text(painter, bar, label))
        painter.restore()

    def _paint_sfx_track(self, painter: QPainter, top: int, visible: int, duration_ms: int, color_name: str) -> None:
        events = normalize_sfx_events(self.state.sfx_events)
        if events:
            color = QColor(color_name)
            for index, event in enumerate(events):
                x = max(self.content_track_left(), self.time_to_x(int(float(event['time_sec']) * 1000)))
                marker = QRect(x - 5, top + 8, 10, self.track_height - 16)
                self._sfx_marker_rects.append((index, marker))
                selected = self._selected_sfx_index == index
                brush = color.lighter(145) if selected else color
                painter.setBrush(brush)
                painter.setPen(QPen(QColor('#FFD56A') if selected else color.lighter(140), 1))
                painter.drawRoundedRect(marker, 3, 3)
                if selected:
                    self._paint_selection_glow(painter, marker, primary=True)
                painter.setPen(QColor('#FFF6D8'))
                label = str(event.get('label', 'SFX'))[:18]
                painter.drawText(QRectF(x + 8, top + 2, 120, self.track_height - 4), Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextSingleLine, label)
        else:
            self._paint_empty_track(painter, top, visible, 'sfx', _EMPTY_HINTS['sfx'])
            return None

    def _paint_trim_region(self, painter: QPainter, duration: int) -> None:
        trim_start = 0
        trim_end = max(1, int(duration))
        left = self.time_to_x(trim_start)
        right = self.time_to_x(trim_end)
        track_bottom = self.ruler_height + self.track_height * len(self.track_rows())
        painter.setPen(QPen(QColor('#57D39A'), 2))
        painter.drawLine(left, 0, left, track_bottom)
        painter.drawLine(right, 0, right, track_bottom)
        self._trim_in_rect = QRect(left - self.handle_width // 2, 2, self.handle_width, self.ruler_height - 4)
        self._trim_out_rect = QRect(right - self.handle_width // 2, 2, self.handle_width, self.ruler_height - 4)
        painter.setBrush(QColor('#57D39A'))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(self._trim_in_rect, 2, 2)
        painter.drawRoundedRect(self._trim_out_rect, 2, 2)

    def _ruler_step_ms(self) -> int:
        duration = max(1, self.project_duration_ms)
        visible = max(1, self.visible_content_width())
        virtual = max(1, self.virtual_content_width())
        visible_ms = max(1.0, duration * (visible / virtual))
        target = max(4, int(visible // 90))
        raw = visible_ms / target
        nice = (100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000)
        for step in nice:
            if step >= raw:
                return int(step)
        return int(nice[-1])

    def _format_ruler_label(self, ms: int, step_ms: int) -> str:
        total = max(0, int(ms))
        if step_ms < 1000:
            sec, rem = (divmod(total, 1000)[0], divmod(total, 1000)[1])
            tenths = rem // 100
            minutes, seconds = (divmod(sec, 60)[0], divmod(sec, 60)[1])
            return f':{seconds}02d.{tenths}' if minutes else f'{seconds}02d.{tenths}'
        return _format_seconds(total // 1000)

    def _paint_ruler(self, painter: QPainter) -> None:
        painter.save()
        painter.setClipRect(self.header_width, 0, max(1, self.width() - self.header_width), self.ruler_height)
        duration_ms = max(1, self.project_duration_ms)
        track_left = self.content_track_left()
        view_right = self.width()
        step_ms = self._ruler_step_ms()
        minor = max(1, step_ms // 5)
        t0 = self.content_x_to_ms(track_left)
        t1 = self.content_x_to_ms(view_right)
        start_ms = max(0, int(t0) // minor * minor)
        end_ms = min(duration_ms, int(t1) + step_ms)
        ms = start_ms
        last_label = ''
        while ms <= end_ms:
            x = self.time_to_x(ms)
            is_major = ms % step_ms == 0
            if is_major:
                painter.setPen(QColor('#9AA8BC'))
                painter.drawLine(x, 12, x, self.ruler_height)
                label = self._format_ruler_label(ms, step_ms)
                if label != last_label:
                    painter.setPen(QColor('#E8EEF8'))
                    painter.drawText(x + 3, 11, label)
                    last_label = label
            else:
                painter.setPen(QColor('#3A465A'))
                painter.drawLine(x, 20, x, self.ruler_height)
            ms += minor
        painter.restore()

    def _paint_clip(self, painter: QPainter, clip: QRect, asset: Asset, color_name: str) -> None:
        color = QColor(color_name)
        selected = asset.id == self.selected_id
        painter.setBrush(color.lighter(118) if selected else color.darker(140))
        painter.setPen(QPen(color.lighter(160) if selected else color, 1))
        painter.drawRoundedRect(clip, 5, 5)
        painter.setPen(QColor('#FFFFFF'))
        painter.save()
        painter.setClipRect(clip)
        text_rect = clip.adjusted(9, 0, -7, 0)
        painter.drawText(text_rect, Qt.AlignmentFlag.AlignVCenter, self._elided_clip_text(painter, text_rect, asset.name))
        painter.restore()
        if selected:
            self._paint_selection_glow(painter, clip, primary=True)
            return None

    def _paint_subtitle_cue_row(self, painter: QPainter, top: int, visible: int, duration_ms: int, color_name: str, track_name: str, kinds: tuple[str, ...], segments, rects: list, labels: list, *, header_kind: str, empty_kind: str, selected: bool) -> None:
        if segments:
            for segment in segments:
                clip = self._bar_rect(int(segment.start_ms), int(segment.end_ms), top, duration_ms)
                label = str(getattr(segment, 'text', None) or '').strip()
                rects.append(clip)
                labels.append(label)
                self._paint_subtitle_cue(painter, clip, color_name, label, selected=selected)
        else:
            self._paint_empty_track(painter, top, visible, empty_kind, _EMPTY_HINTS.get(empty_kind, _EMPTY_HINTS['subtitle']))
        painter.restore()
        self._paint_track_row_overlay(painter, top, header_kind)
        self._paint_track_header(painter, top, track_name, header_kind, row_kinds=kinds)

    def _paint_subtitle_cue(self, painter: QPainter, clip: QRect, color_name: str, label: str, *, selected: bool) -> None:
        color = QColor(color_name)
        painter.setBrush(color.lighter(118) if selected else color.darker(140))
        painter.setPen(QPen(color.lighter(160) if selected else color, 1))
        painter.drawRoundedRect(clip, 5, 5)
        text = str(label or '').strip()
        if text:
            painter.setPen(QColor('#FFFFFF'))
            painter.save()
            painter.setClipRect(clip)
            text_rect = clip.adjusted(9, 0, -7, 0)
            painter.drawText(text_rect, Qt.AlignmentFlag.AlignVCenter, self._elided_clip_text(painter, text_rect, text))
            painter.restore()
            if selected:
                self._paint_selection_glow(painter, clip, primary=True)
                return None
        else:
            if selected:
                self._paint_selection_glow(painter, clip, primary=True)
            return None

    def _timeline_assets(self) -> list[Asset]:
        videos = [asset for asset in self.state.assets if asset.kind == 'video']
        non_videos = [asset for asset in self.state.assets if asset.kind != 'video']
        selected_video = next((asset for asset in videos if asset.id == self.state.selected_id), videos[0] if videos else None)
        return [selected_video] + non_videos if selected_video is not None else [] + non_videos

    def _sfx_track_top(self) -> int:
        for row, (_name, kinds, _color, _vti, *_rest) in enumerate(self.track_rows()):
            if 'sfx' in kinds:
                return self.ruler_height + row * self.track_height
        return -1

    def _find_sfx_marker_at(self, point) -> int | None:
        for index, rect in self._sfx_marker_rects:
            if rect.adjusted(-self.marker_hit_px, -4, self.marker_hit_px, 4).contains(point):
                return index

    def _x_to_ms(self, x: float) -> int:
        return self.content_x_to_ms(x)

    def _layer_drag_mode_for_point(self, rect: QRect, point) -> str:
        edge = max(self.handle_width, min(12, rect.width() // 3))
        return 'start' if point.x() <= rect.left() + edge else 'end' if point.x() >= rect.right() - edge else 'move'

    def _read_layer_timing(self, meta: dict[str, object]) -> tuple[int, int]:
        blend_index = meta.get('blend_index')
        if blend_index is not None:
            layers = ensure_blend_layers(self.state.values)
            idx = int(blend_index)
            if 0 <= idx < len(layers):
                item = layers[idx]
                return (int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))
            return (0, 0)
        background_index = meta.get('background_index')
        if background_index is not None:
            layers = ensure_background_layers(self.state.values)
            idx = int(background_index)
            if 0 <= idx < len(layers):
                item = layers[idx]
                return (int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))
            return (0, 0)
        overlay_index = meta.get('overlay_index')
        if overlay_index is not None:
            overlays = ensure_media_overlays(self.state.values)
            idx = int(overlay_index)
            if 0 <= idx < len(overlays):
                item = overlays[idx]
                return (int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))
            return (0, 0)
        text_index = meta.get('text_index')
        if text_index is not None:
            from ui_qt.text_overlays import ensure_text_overlays
            items = ensure_text_overlays(self.state.values)
            idx = int(text_index)
            if 0 <= idx < len(items):
                item = items[idx]
                return (int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))
            return (0, 0)
        start_key = str(meta.get('start_key', ''))
        end_key = str(meta.get('end_key', ''))
        return (int(self.state.values.get(start_key, 0) or 0), int(self.state.values.get(end_key, 0) or 0))

    def _write_layer_timing(self, meta: dict[str, object], start_ms: int, end_ms: int) -> None:
        blend_index = meta.get('blend_index')
        if blend_index is not None:
            layers = ensure_blend_layers(self.state.values)
            idx = int(blend_index)
            if 0 <= idx < len(layers):
                layers[idx]['start_ms'] = int(start_ms)
                layers[idx]['end_ms'] = int(end_ms)
                self.state.values['blend_layer_index'] = idx
            return None
        background_index = meta.get('background_index')
        if background_index is not None:
            layers = ensure_background_layers(self.state.values)
            idx = int(background_index)
            if 0 <= idx < len(layers):
                layers[idx]['start_ms'] = int(start_ms)
                layers[idx]['end_ms'] = int(end_ms)
                self.state.values['background_layer_index'] = idx
            return None
        overlay_index = meta.get('overlay_index')
        if overlay_index is not None:
            overlays = ensure_media_overlays(self.state.values)
            idx = int(overlay_index)
            if 0 <= idx < len(overlays):
                overlays[idx]['start_ms'] = int(start_ms)
                overlays[idx]['end_ms'] = int(end_ms)
                self.state.values['media_overlay_index'] = idx
            return None
        text_index = meta.get('text_index')
        if text_index is not None:
            from ui_qt.text_overlays import ensure_text_overlays, sync_flat_from_selected_text
            items = ensure_text_overlays(self.state.values)
            idx = int(text_index)
            if 0 <= idx < len(items):
                items[idx]['start_ms'] = int(start_ms)
                items[idx]['end_ms'] = int(end_ms)
                self.state.values['text_overlays'] = items
                self.state.values['text_overlay_index'] = idx
                sync_flat_from_selected_text(self.state.values)
            return None
        start_key = str(meta.get('start_key', ''))
        end_key = str(meta.get('end_key', ''))
        if start_key:
            self.state.values[start_key] = int(start_ms)
        if end_key:
            self.state.values[end_key] = int(end_ms)
            return None

    def _find_timed_layer_at(self, point) -> tuple[str, str] | None:
        for layer_id in reversed(list(self._layer_rects.keys())):
            rect = self._layer_rects.get(layer_id)
            if rect is not None and layer_id in self._layer_timing_meta and rect.contains(point):
                return (layer_id, self._layer_drag_mode_for_point(rect, point))

    def _video_track_index_at_y(self, y: float) -> int | None:
        if y < self.ruler_height:
            return None
        rows = self.track_rows()
        row = int((y - self.ruler_height) // self.track_height)
        return None if row < 0 or row >= len(rows) else rows[row][3]

    def _row_at_y(self, y: float) -> tuple[str, tuple[str, ...], str, int | None, str] | None:
        if y < self.ruler_height:
            return None
        rows = self.track_rows()
        row = int((y - self.ruler_height) // self.track_height)
        return None if row < 0 or row >= len(rows) else rows[row]

    def _sync_track_overlays(self) -> None:
        migrate_upper_video_tracks_to_layers(self.state.values)
        existing = ensure_media_overlays(self.state.values)
        kept = [item for item in existing if not str(item.get('id', '') or '').startswith('ttrack-')]
        if len(kept) != len(existing):
            self.state.values['media_overlays'] = kept
        self._refresh_canvas_height()

    def dragEnterEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and (mime.hasFormat(ASSET_DRAG_MIME) or mime.hasFormat(LIBRARY_ACTION_MIME) or mime.hasFormat(LIBRARY_ASSET_MIME) or mime.hasUrls()):
            event.acceptProposedAction()
            return None
        super().dragEnterEvent(event)

    def dragMoveEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and (mime.hasFormat(ASSET_DRAG_MIME) or mime.hasFormat(LIBRARY_ACTION_MIME) or mime.hasFormat(LIBRARY_ASSET_MIME) or mime.hasUrls()):
            event.acceptProposedAction()
            return None
        super().dragMoveEvent(event)

    def dropEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is None:
            super().dropEvent(event)
            return None
        point = event.position()
        row = self._row_at_y(point.y())
        at_ms = self._snap_ms(self._x_to_ms(point.x()))
        raw = bytes(mime.data(LIBRARY_ASSET_MIME)).decode('utf-8', errors='ignore').strip()
        kind, _, path = (raw.partition('\n')[0], raw.partition('\n')[1], raw.partition('\n')[2])
        if mime.hasFormat(LIBRARY_ASSET_MIME) and kind and path:
            self.libraryAssetDropped.emit(kind.strip(), path.strip(), max(0, int(at_ms)))
            event.acceptProposedAction()
            return None
        action = bytes(mime.data(LIBRARY_ACTION_MIME)).decode('utf-8', errors='ignore').strip()
        if mime.hasFormat(LIBRARY_ACTION_MIME) and action:
            self.libraryActionDropped.emit(action, max(0, int(at_ms)))
            event.acceptProposedAction()
            return None
        asset_id = ''
        if mime.hasFormat(ASSET_DRAG_MIME):
            asset_id = bytes(mime.data(ASSET_DRAG_MIME)).decode('utf-8', errors='ignore')
        host = self._drop_host()
        kinds = row[1] if row is not None else ('video',)
        row_ref = row[4] if row is not None else ''
        paths = self._drop_paths(mime, asset_id)
        if 'media_overlay' in kinds and host is not None and paths and hasattr(host, 'insert_media_as_overlay'):
            host.insert_media_as_overlay(paths, at_timeline_ms=at_ms, row_ref=row_ref)
            event.acceptProposedAction()
            return None
        paths = self._drop_paths(mime, asset_id)
        if 'blend_layer' in kinds and host is not None and paths and hasattr(host, 'insert_media_as_blend'):
            host.insert_media_as_blend(paths, at_timeline_ms=at_ms, row_ref=row_ref)
            event.acceptProposedAction()
            return None
        paths = self._drop_paths(mime, asset_id)
        if 'background_layer' in kinds and host is not None and paths and hasattr(host, 'insert_media_as_background'):
            host.insert_media_as_background(paths, at_timeline_ms=at_ms, row_ref=row_ref)
            event.acceptProposedAction()
            return None
        if row is not None and row[3] is not None:
            track_index = int(row[3])
            append_sequence = bool(event.modifiers() & Qt.KeyboardModifier.ShiftModifier)
            if asset_id and host is not None:
                host.insert_project_asset_on_track(asset_id, track_index=track_index, at_timeline_ms=at_ms, append_sequence=append_sequence)
                event.acceptProposedAction()
                return None
            if mime.hasUrls() and host is not None:
                paths = [url.toLocalFile() for url in mime.urls() if url.isLocalFile()]
                if paths:
                    host.insert_media_paths_on_track(paths, track_index=track_index, at_timeline_ms=at_ms, append_sequence=append_sequence)
                    event.acceptProposedAction()
                    return None
            else:
                super().dropEvent(event)
        elif 'video' in kinds:
            track_index = 0
        else:
            event.ignore()
            return None

    def _drop_paths(self, mime, asset_id: str) -> list[str]:
        paths = []
        asset = next((item for item in self.state.assets if item.id == asset_id), None)
        if asset_id and asset is not None and asset.path:
            paths.append(str(asset.path))
        if mime is not None and mime.hasUrls():
            for url in mime.urls():
                if url.isLocalFile():
                    paths.append(url.toLocalFile())
        return paths

    def _vertical_scroll_value(self) -> int:
        viewport = self.parent()
        if viewport is None:
            return 0
        area = viewport.parent()
        bar = getattr(area, 'verticalScrollBar', None)
        if callable(bar):
            try:
                return int(bar().value())
            except Exception:
                return 0
        return 0

    def _sticky_ruler_top(self) -> int:
        return self._vertical_scroll_value()

    def _is_sticky_ruler_zone(self, point) -> bool:
        if float(point.x()) < self.content_track_left():
            return False
        top = self._sticky_ruler_top()
        y = float(point.y())
        return top <= y < top + self.ruler_height

    def _is_scrub_zone(self, point) -> bool:
        return False if point.x() < self.content_track_left() else True if self._is_sticky_ruler_zone(point) else True if point.y() < self.ruler_height and self._sticky_ruler_top() == 0 else True if abs(point.x() - self._playhead_x) <= self.marker_hit_px else False

    def _apply_scrub(self, x: float) -> None:
        content_right = self.content_track_left() + self.virtual_content_width() - float(self.scroll_offset_px)
        x = min(float(x), content_right)
        scrolled = False
        if self.max_scroll_px() > 0 and (not self._scrubbing):
            left = float(self.content_track_left())
            right = left + float(self.visible_content_width())
            edge = 40.0
            before = self.scroll_offset_px
            if x < left + edge:
                self.scroll_offset_px -= max(4.0, (left + edge - x) * 0.55)
            elif x > right - edge:
                self.scroll_offset_px += max(4.0, (x - (right - edge)) * 0.55)
            self._clamp_scroll()
            if abs(self.scroll_offset_px - before) > 0.5:
                scrolled = True
                self._scrub_scroll_dirty = True
        ms = max(0, min(int(self._x_to_ms(x)), self.project_duration_ms))
        if ms != self.position_ms or scrolled:
            self.position_ms = ms
            self.update()
            if not self._scrub_emit_armed:
                self._scrub_emit_armed = True
                QTimer.singleShot(120, self._flush_scrub_preview_emit)
                return None
        else:
            return None

    def _flush_scrub_preview_emit(self) -> None:
        self._scrub_emit_armed = False
        if self._scrubbing:
            self._scrub_emit_at = time.monotonic()
            self.positionScrubbed.emit(int(self.position_ms))
        else:
            return None

    def _capture_body_cache_snapshot(self) -> bool:
        w = max(1, int(self.width()))
        h = max(1, int(self.height()))
        if w < 8 or h < 8:
            return False
        try:
            pm = self.grab(self.rect())
        except Exception:
            return False
        if pm is None or pm.isNull():
            return False
        self._playback_body_cache = pm
        self._playback_body_dirty = False
        self._scrub_need_cache = False
        self._body_cache_scroll_px = float(self.scroll_offset_px)
        self._body_cache_zoom = float(self.zoom_factor)
        try:
            self._body_cache_row_count = len(self.track_rows())
        except Exception:
            self._body_cache_row_count = int(getattr(self, '_body_cache_row_count', 0) or 0)
            return True
        return True

    def _begin_scrub(self) -> None:
        self._scrubbing = True
        self._drag_lite = True
        self._scrub_emit_at = 0.0
        self._scrub_emit_armed = False
        self._scrub_scroll_dirty = False
        if self._body_cache_usable():
            self._scrub_need_cache = False
            self._playback_body_dirty = False
            return None
        if self._capture_body_cache_snapshot():
            return None
        self._playback_body_cache = None
        self._playback_body_dirty = True
        self._scrub_need_cache = True
        self.update()

    def _arm_scrub_body_cache(self, *, rebuild_now: bool) -> None:
        if self._body_cache_usable():
            return None
        if getattr(self, '_scrub_need_cache', False):
            self.update()
            return None
        self._playback_body_cache = None
        self._playback_body_dirty = True
        self._scrub_need_cache = True
        self.update()

    def _end_scrub(self) -> None:
        self._scrubbing = False
        self._drag_lite = False
        self._scrub_need_cache = False
        self._scrub_emit_armed = False
        if self._scrub_scroll_dirty:
            self._scrub_scroll_dirty = False
            self.scrollOffsetChanged.emit()
        self._invalidate_playback_body_cache()
        self.update()

    def _ensure_layer_timing_history(self) -> None:
        if not self._layer_timing_history_pushed:
            self._layer_timing_history_pushed = True
            self.layerTimingDragStarted.emit()
            return None

    def _ensure_trim_history(self) -> None:
        if not self._trim_history_pushed:
            self._trim_history_pushed = True
            self.trimDragStarted.emit()
            return None

    def _ensure_tclip_history(self) -> None:
        if not self._tclip_history_pushed:
            self._tclip_history_pushed = True
            self.trimDragStarted.emit()
            return None

    def _apply_tclip_drag(self, x: float, y: float | None=None) -> None:
        video = self._selected_video_asset()
        clip_id = self._drag_tclip_id
        mode = self._drag_tclip_mode or 'move'
        if clip_id:
            clips = self.video_clips()
            clip = next((item for item in clips if item.id == clip_id), None)
            if clip is None:
                return None
            timeline_ms = self._snap_ms(max(0, self.content_x_to_ms(x)), exclude_clip_id=clip_id if mode == 'move' else '')
            target_track = clamp_track_index(clip.track_index)
            hit_track = self._video_track_index_at_y(y)
            if y is not None and mode == 'move' and (hit_track is not None):
                target_track = int(hit_track)
            if mode == 'move' and self._drag_tclip_last_ms == timeline_ms and (self._drag_tclip_last_track == target_track):
                return None
            source_dur = max(1, int((video.duration_ms if video is not None else 0) or clip.source_out_ms or 1))
            updated = None
            if mode == 'start':
                delta = timeline_ms - clip.timeline_start_ms
                new_in = clip.source_in_ms + delta
                updated = trim_clip_edge(clips, clip_id, edge='in', source_ms=new_in, source_duration_ms=source_dur)
            elif mode == 'end':
                delta = timeline_ms - clip.timeline_start_ms
                new_out = clip.source_in_ms + max(MIN_CLIP_DURATION_MS, delta)
                updated = trim_clip_edge(clips, clip_id, edge='out', source_ms=new_out, source_duration_ms=source_dur)
            else:
                updated = move_clip_to_track(clips, clip_id, target_track, timeline_start_ms=timeline_ms) if target_track != clamp_track_index(clip.track_index) else reorder_clip_by_timeline_ms(clips, clip_id, timeline_ms)
            if updated is None:
                return None
            laid = write_clips(self.state.values, updated)
            self._cached_clips = list(laid)
            self._cached_duration_ms = max(1, max((c.timeline_start_ms + c.duration_ms for c in laid), default=1))
            self._layout_cache_token = self._layout_token()
            self._drag_tclip_last_ms = timeline_ms
            self._drag_tclip_last_track = target_track
            self.update()
        else:
            return None

    def _timed_layer_cursor_at(self, point) -> Qt.CursorShape | None:
        found = self._find_timed_layer_at(point)
        if found is None:
            return None
        _, mode = (found[0], found[1])
        return Qt.CursorShape.OpenHandCursor if mode == 'move' else Qt.CursorShape.SizeHorCursor

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            point = event.position().toPoint()
            if self._is_sticky_ruler_zone(point):
                self._begin_scrub()
                self._pending_tclip_id = None
                self._apply_scrub(event.position().x())
                self.setCursor(Qt.CursorShape.SizeHorCursor)
                event.accept()
                return None
            if point.x() < self.header_width:
                for row, (_name, kinds, _color, _vti, audio_clip_id) in enumerate(self.track_rows()):
                    top = self.ruler_height + row * self.track_height
                    if top <= point.y() < top + self.track_height:
                        kind = self._header_kind_for_row(kinds, audio_clip_id)
                        action_hit = self._header_action_payload_at(point)
                        action, payload = (action_hit[0], action_hit[1])
                        if action == 'plus':
                            if self._handle_subtitle_row_plus(kind, payload):
                                pass
                            else:
                                self.trackAddRequested.emit(payload)
                        elif action_hit is not None and action == 'minus':
                            if self._handle_subtitle_row_minus(kind, payload):
                                pass
                            else:
                                self.trackSlotRemoveRequested.emit(payload)
                        else:
                            hit = self._track_header_hit(point, top, kind)
                            if hit == 'eye':
                                set_track_preview_hidden(self.state.values, kind, not track_preview_hidden(self.state.values, kind))
                                self.trackControlsChanged.emit()
                                self.update()
                            elif hit == 'lock':
                                set_track_edit_locked(self.state.values, kind, not track_edit_locked(self.state.values, kind))
                                self.trackControlsChanged.emit()
                                self.update()
                            else:
                                focus_id = self._focus_id_for_row(kinds, audio_clip_id)
                                self.trackFocusRequested.emit(focus_id)
                        event.accept()
                        return None
                if point.y() >= self.ruler_height:
                    event.accept()
                    return None
            else:
                if self._trim_in_rect.adjusted(-4, -2, 4, 2).contains(point):
                    self._trim_history_pushed = False
                    self._drag_trim = 'in'
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                    event.accept()
                    return None
                if self._trim_out_rect.adjusted(-4, -2, 4, 2).contains(point):
                    self._trim_history_pushed = False
                    self._drag_trim = 'out'
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                    event.accept()
                    return None
                sfx_index = self._find_sfx_marker_at(point)
                if sfx_index is not None:
                    self._selected_sfx_index = sfx_index
                    self.sfxEditStarted.emit()
                    self._drag_sfx_index = sfx_index
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                    self.update()
                    event.accept()
                    return None
                for item in self._transition_hit_rects:
                    zone, boundary_ms = (item[1], item[0])
                    if zone.adjusted(-4, -2, 4, 2).contains(point):
                        self.transitionSelected.emit(int(boundary_ms))
                        event.accept()
                        return None
                for clip_id, rect in self._timeline_clip_rects.items():
                    if rect.contains(point):
                        self._selected_sfx_index = None
                        self._selected_subtitle_cue = None
                        video = self._selected_video_asset()
                        persist_values_transform_to_selected_clip(self.state.values)
                        self._apply_timeline_clip_selection(clip_id, event.modifiers())
                        clips = self.video_clips()
                        chosen = next((clip for clip in clips if clip.id == clip_id), None)
                        if chosen is not None:
                            apply_clip_transform_to_values(self.state.values, chosen)
                        self.timelineClipSelected.emit(clip_id)
                        mode = self._layer_drag_mode_for_point(rect, point)
                        multi = selected_clip_ids(self.state.values)
                        if mode in frozenset({'start', 'end'}) and len(multi) <= 1:
                            self._drag_tclip_id = clip_id
                            self._drag_tclip_mode = mode
                            self._drag_tclip_origin_ms = self._x_to_ms(point.x())
                            self._drag_tclip_last_ms = None
                            self._drag_tclip_last_track = None
                            self._drag_lite = True
                            self._tclip_history_pushed = False
                        else:
                            self._begin_scrub()
                            self._pending_tclip_id = clip_id
                            self._pending_tclip_press_x = float(event.position().x())
                            self._pending_tclip_press_y = float(event.position().y())
                            self._apply_scrub(event.position().x())
                        self.setCursor(Qt.CursorShape.SizeHorCursor)
                        self.update()
                        event.accept()
                        return None
                for index, rect in enumerate(self._subtitle_source_cue_rects):
                    if rect.contains(point):
                        self._selected_subtitle_cue = ('subtitle_source', index)
                        self.subtitleCueSelectRequested.emit(index)
                        self.trackFocusRequested.emit('track-subtitle')
                        self._begin_scrub()
                        self._apply_scrub(event.position().x())
                        self.setCursor(Qt.CursorShape.SizeHorCursor)
                        event.accept()
                        return None
                for index, rect in enumerate(self._subtitle_cue_rects):
                    if rect.contains(point):
                        self._selected_subtitle_cue = ('subtitle', index)
                        self.subtitleCueSelectRequested.emit(index)
                        self.trackFocusRequested.emit('track-subtitle')
                        self._begin_scrub()
                        self._apply_scrub(event.position().x())
                        self.setCursor(Qt.CursorShape.SizeHorCursor)
                        event.accept()
                        return None
                for asset_id, rect in self._clip_rects.items():
                    if rect.contains(point):
                        self._selected_subtitle_cue = None
                        self.set_selected_asset(asset_id)
                        self.clipSelected.emit(asset_id)
                        event.accept()
                        return None
                timed = self._find_timed_layer_at(point)
                if timed is not None:
                    layer_id, mode = (timed[0], timed[1])
                    meta = self._layer_timing_meta.get(layer_id, {})
                    start_ms, end_ms = (self._read_layer_timing(meta)[0], self._read_layer_timing(meta)[1])
                    self.selected_id = layer_id
                    self.layerSelected.emit(layer_id)
                    self._drag_layer_id = layer_id
                    self._drag_layer_mode = mode
                    self._layer_drag_origin_start = start_ms
                    self._layer_drag_origin_end = end_ms
                    self._layer_drag_anchor_ms = self._x_to_ms(point.x())
                    self._layer_timing_history_pushed = False
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                    self.update()
                    event.accept()
                    return None
                for layer_id, rect in self._layer_rects.items():
                    if rect.contains(point):
                        self.selected_id = layer_id
                        self.layerSelected.emit(layer_id)
                        self.update()
                        event.accept()
                        return None
                for kind, rect in self._add_rects:
                    if rect.contains(point):
                        if kind == 'sfx':
                            at = max(0.0, float(self.position_ms) / 1000.0)
                            self._popup_sfx_preset_menu(at, self.mapToGlobal(point))
                        else:
                            self.trackAddRequested.emit(kind)
                        event.accept()
                        return None
                if point.x() >= self.content_track_left():
                    self._begin_scrub()
                    self._apply_scrub(event.position().x())
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                    event.accept()
                    return None
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:
        if self._scrubbing:
            dx = abs(float(event.position().x()) - float(self._pending_tclip_press_x))
            dy = abs(float(event.position().y()) - float(self._pending_tclip_press_y))
            if self._pending_tclip_id is not None and (dx >= 28.0 or dy >= 16.0):
                move_id = self._pending_tclip_id
                finished_ms = int(self.position_ms)
                self._pending_tclip_id = None
                self._end_scrub()
                self.scrubFinished.emit(finished_ms)
                self._drag_tclip_id = move_id
                self._drag_tclip_mode = 'move'
                self._drag_tclip_last_ms = None
                self._drag_tclip_last_track = None
                self._drag_lite = True
                self._tclip_history_pushed = False
                self._ensure_tclip_history()
                self._apply_tclip_drag(event.position().x(), event.position().y())
                self.setCursor(Qt.CursorShape.SizeAllCursor)
            else:
                self._apply_scrub(event.position().x())
            event.accept()
            return None
        if self._drag_trim is not None:
            self._ensure_trim_history()
            self._apply_trim_drag(event.position().x())
            event.accept()
            return None
        if self._drag_tclip_id is not None:
            self._drag_lite = True
            self._ensure_tclip_history()
            self._apply_tclip_drag(event.position().x(), event.position().y())
            event.accept()
            return None
        if self._drag_layer_id is not None:
            self._ensure_layer_timing_history()
            self._apply_layer_timing_drag(event.position().x())
            event.accept()
            return None
        if self._drag_sfx_index is not None:
            self._apply_sfx_drag(event.position().x())
            event.accept()
            return None
        point = event.position().toPoint()
        self._update_transition_hover_tooltip(point)
        layer_cursor = self._timed_layer_cursor_at(point)
        if layer_cursor is not None:
            self.setCursor(layer_cursor)
        else:
            tclip_cursor = None
            for _cid, rect in self._timeline_clip_rects.items():
                if rect.contains(point):
                    mode = self._layer_drag_mode_for_point(rect, point)
                    tclip_cursor = Qt.CursorShape.SizeHorCursor if mode in frozenset({'start', 'end'}) else Qt.CursorShape.OpenHandCursor
            if tclip_cursor is not None:
                self.setCursor(tclip_cursor)
            elif any((zone.adjusted(-4, -2, 4, 2).contains(point) for _boundary, zone, _style, _fade in self._transition_hit_rects)):
                self.setCursor(Qt.CursorShape.PointingHandCursor)
            elif any((rect.contains(point) for rect in self._subtitle_cue_rects)) or any((rect.contains(point) for rect in self._subtitle_source_cue_rects)):
                self.setCursor(Qt.CursorShape.PointingHandCursor)
            elif self._trim_in_rect.adjusted(-4, -2, 4, 2).contains(point) or self._trim_out_rect.adjusted(-4, -2, 4, 2).contains(point) or self._find_sfx_marker_at(point) is not None or self._is_scrub_zone(point):
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            else:
                self.unsetCursor()
        super().mouseMoveEvent(event)

    def _update_transition_hover_tooltip(self, point) -> None:
        from core.timeline_transitions import style_label
        tip = ''
        for item in self._transition_hit_rects:
            boundary_ms, zone, style, fade_ms = ((item[0], item[1], item[2], item[3])[0], (item[0], item[1], item[2], item[3])[1], (item[0], item[1], item[2], item[3])[2], (item[0], item[1], item[2], item[3])[3])
            if zone.adjusted(-6, -4, 6, 4).contains(point):
                name = style_label(style)
                if fade_ms > 0 and style != 'cut':
                    tip = f'{name} ({fade_ms} ms)\nChỗ cắt @ {boundary_ms / 1000.0}.2fs · bấm để mở panel'
                else:
                    tip = f'{boundary_ms / 1000.0}.2fs · bấm để mở panel'
        if tip:
            clip_id = self._hit_timeline_clip_at(point)
            if tip and clip_id:
                from core.scene_clip_fx import clip_scene_fx_status
                from core.timeline_clips import find_clip
                hit_clip = find_clip(self.video_clips(), clip_id)
                if hit_clip is not None:
                    tip = f'{tip}\n{clip_scene_fx_status(hit_clip, self.state.values)}'
        else:
            clip_id = self._hit_timeline_clip_at(point)
            if clip_id:
                from core.scene_clip_fx import clip_scene_fx_status
                from core.timeline_clips import find_clip
                hit_clip = find_clip(self.video_clips(), clip_id)
                if hit_clip is not None:
                    tip = clip_scene_fx_status(hit_clip, self.state.values)
        if tip != self.toolTip():
            self.setToolTip(tip)
            return None

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton and self._scrubbing:
            finished_ms = int(self.position_ms)
            self._pending_tclip_id = None
            self.positionScrubbed.emit(finished_ms)
            self._end_scrub()
            self.scrubFinished.emit(finished_ms)
            self.unsetCursor()
            event.accept()
            return None
        if event.button() == Qt.MouseButton.LeftButton and self._drag_trim is not None:
            self._drag_trim = None
            self._trim_history_pushed = False
            self.unsetCursor()
            event.accept()
            return None
        if event.button() == Qt.MouseButton.LeftButton and self._drag_tclip_id is not None:
            self._drag_tclip_id = None
            self._drag_tclip_mode = None
            self._drag_tclip_last_ms = None
            self._drag_tclip_last_track = None
            self._pending_tclip_id = None
            self._tclip_history_pushed = False
            self._drag_lite = False
            self._sync_track_overlays()
            self.clipsChanged.emit()
            self.unsetCursor()
            event.accept()
            return None
        if event.button() == Qt.MouseButton.LeftButton and self._drag_layer_id is not None:
            self._drag_layer_id = None
            self._drag_layer_mode = None
            self._layer_timing_history_pushed = False
            self.unsetCursor()
            event.accept()
            return None
        if event.button() == Qt.MouseButton.LeftButton and self._drag_sfx_index is not None:
            self._drag_sfx_index = None
            self.state.sfx_events = normalize_sfx_events(self.state.sfx_events)
            self._persist_sfx()
            self.sfxChanged.emit()
            self.unsetCursor()
            event.accept()
            return None
        super().mouseReleaseEvent(event)

    def _apply_trim_drag(self, x: float) -> None:
        video = self._selected_video_asset()
        clips = self.video_clips()
        if video is None or len(clips) != 1:
            return None
        clip = clips[0]
        source_dur = max(1, int(video.duration_ms or 1))
        position_ms = max(0, self.content_x_to_ms(x))
        min_len = MIN_CLIP_DURATION_MS
        if self._drag_trim == 'in':
            cut = max(0, min(position_ms, clip.duration_ms - min_len))
            new_in = min(clip.source_out_ms - min_len, clip.source_in_ms + cut)
            new_out = clip.source_out_ms
        else:
            desired = max(min_len, position_ms)
            new_in = clip.source_in_ms
            new_out = min(source_dur, new_in + desired)
            if new_out - new_in < min_len:
                new_out = min(source_dur, new_in + min_len)
        from dataclasses import replace
        write_clips(self.state.values, [replace(clip, source_in_ms=new_in, source_out_ms=new_out, source_path=clip.source_path or str(video.path or ''))])
        trim_start = int(self.state.values.get('trim_start_ms', 0) or 0)
        trim_end = int(self.state.values.get('trim_end_ms', 0) or 0)
        self.trimChanged.emit(trim_start, trim_end)
        self.update()

    def _apply_layer_timing_drag(self, x: float) -> None:
        layer_id = self._drag_layer_id
        if layer_id is None:
            return None
        meta = self._layer_timing_meta.get(layer_id)
        if meta:
            duration = max(1, self.project_duration_ms)
            position_ms = self._x_to_ms(x)
            min_len = MIN_LAYER_DURATION_MS
            start = self._layer_drag_origin_start
            end_raw = self._layer_drag_origin_end
            end_resolved = self._resolve_layer_range_ms(start, end_raw, duration)[1]
            mode = self._drag_layer_mode or 'move'
            new_start = start
            new_end_raw = end_raw
            if mode == 'start':
                new_start = max(0, min(position_ms, end_resolved - min_len))
            elif mode == 'end':
                new_end = max(start + min_len, min(duration, position_ms))
                new_end_raw = 0 if new_end >= duration else new_end
            else:
                delta = position_ms - self._layer_drag_anchor_ms
                length = max(min_len, end_resolved - start)
                new_start = max(0, min(duration - length, start + delta))
                new_end_resolved = new_start + length
                new_end_raw = 0 if new_end_resolved >= duration else new_end_resolved
            if new_start == start and new_end_raw == end_raw:
                return None
            self._write_layer_timing(meta, new_start, new_end_raw)
            self.layerTimingChanged.emit()
            self.update()
        else:
            return None

    def _apply_sfx_drag(self, x: float) -> None:
        index = self._drag_sfx_index
        if 0 <= index < len(self.state.sfx_events):
            time_sec = self._x_to_ms(x) / 1000.0
            self.state.sfx_events[index]['time_sec'] = time_sec
            self.update()
        else:
            return None

    def keyPressEvent(self, event) -> None:
        key = event.key()
        mods = event.modifiers()
        if self._selected_sfx_index is not None:
            self._delete_sfx(self._selected_sfx_index)
            self._selected_sfx_index = None
            event.accept()
            return None
        sel = str(self.selected_id or '')
        if sel.startswith(('layer-overlay-', 'layer-blend-')):
            self.trackSlotRemoveRequested.emit(sel)
            event.accept()
            return None
        selected_cue = getattr(self, '_selected_subtitle_cue', None)
        if selected_cue is not None:
            kind, index = (selected_cue[0], selected_cue[1])
            self.subtitleCueDeleteRequested.emit(str(kind), int(index))
            self._selected_subtitle_cue = None
            self.update()
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None and hasattr(panel, 'delete_selected_clip'):
            panel.delete_selected_clip()
            event.accept()
            return None
        if key == Qt.Key.Key_Space and self._selected_sfx_index is not None:
            self._preview_sfx(self._selected_sfx_index)
            event.accept()
            return None
        if key in (Qt.Key.Key_Left, Qt.Key.Key_Right) and (not mods & Qt.KeyboardModifier.ControlModifier):
            self._nudge_playhead_by_frames(-1 if key == Qt.Key.Key_Left else 1, coarse=bool(mods & Qt.KeyboardModifier.ShiftModifier))
            event.accept()
            return None
        if self._selected_sfx_index is not None:
            self.copy_selected_sfx()
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None:
            self._clipboard_kind = 'clip'
            panel.copy_selected_clip()
            event.accept()
            return None
        if self._clipboard_kind == 'sfx' and self._sfx_clipboard:
            self.paste_sfx_at_playhead()
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None:
            panel.paste_clip()
            event.accept()
            return None
        if key == Qt.Key.Key_D and self._selected_sfx_index is not None:
            self.copy_selected_sfx()
            self.paste_sfx_at_playhead()
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None:
            panel.split_at_playhead()
            event.accept()
            return None
        if key == Qt.Key.Key_A:
            self._select_all_timeline_clips()
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None:
            panel.select_adjacent_clip(-1)
            event.accept()
            return None
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        if panel is not None:
            panel.select_adjacent_clip(1)
            event.accept()
            return None
        super().keyPressEvent(event)

    def _frame_step_ms(self, *, coarse: bool) -> int:
        fps = max(1.0, float(self.state.values.get('fps', 30) or 30))
        frame_ms = max(1, int(round(1000.0 / fps)))
        return frame_ms * 5 if coarse else frame_ms * 1

    def _nudge_playhead_by_frames(self, direction: int, *, coarse: bool) -> None:
        step = self._frame_step_ms(coarse=coarse) * (1 if int(direction) >= 0 else -1)
        new_pos = max(0, min(self.project_duration_ms, int(self.position_ms) + step))
        if new_pos == int(self.position_ms):
            return None
        self.position_ms = new_pos
        self.positionScrubbed.emit(new_pos)
        self.ensure_playhead_visible()
        self.update()

    def _select_all_timeline_clips(self) -> None:
        clips = self.video_clips()
        if clips:
            ids = [c.id for c in clips]
            set_selected_clip_ids(self.state.values, ids, primary=ids[-1])
            self._selection_anchor_id = ids[0]
            chosen = clips[-1]
            apply_clip_transform_to_values(self.state.values, chosen)
            self.timelineClipSelected.emit(chosen.id)
            self.update()
        else:
            return None

    def _apply_timeline_clip_selection(self, clip_id: str, modifiers) -> None:
        clips = self.video_clips()
        ordered = [c.id for c in clips]
        if clip_id not in ordered:
            set_selected_clip_ids(self.state.values, [clip_id], primary=clip_id)
            self._selection_anchor_id = clip_id
            return None
        ctrl = bool(modifiers & Qt.KeyboardModifier.ControlModifier)
        shift = bool(modifiers & Qt.KeyboardModifier.ShiftModifier)
        if ctrl and (not shift):
            current = set(selected_clip_ids(self.state.values))
            if clip_id in current and len(current) > 1:
                current.discard(clip_id)
                primary = selected_clip_id(self.state.values)
                if primary == clip_id or primary not in current:
                    primary = next(iter(current))
                set_selected_clip_ids(self.state.values, list(current), primary=primary)
            else:
                current.add(clip_id)
                set_selected_clip_ids(self.state.values, list(current), primary=clip_id)
            if not self._selection_anchor_id:
                self._selection_anchor_id = clip_id
            return None
        if shift:
            anchor = self._selection_anchor_id or selected_clip_id(self.state.values)
            if not anchor or anchor not in ordered:
                anchor = clip_id
            i0 = ordered.index(anchor)
            i1 = ordered.index(clip_id)
            lo, hi = (((i0, i1) if i0 <= i1 else (i1, i0))[0], ((i0, i1) if i0 <= i1 else (i1, i0))[1])
            set_selected_clip_ids(self.state.values, ordered[lo:hi + 1], primary=clip_id)
            return None
        set_selected_clip_ids(self.state.values, [clip_id], primary=clip_id)
        self._selection_anchor_id = clip_id

    def mouseDoubleClickEvent(self, event) -> None:
        if event.button() != Qt.MouseButton.LeftButton:
            super().mouseDoubleClickEvent(event)
            return None
        point = event.position().toPoint()
        sfx_index = self._find_sfx_marker_at(point)
        if sfx_index is not None:
            self._selected_sfx_index = sfx_index
            self._preview_sfx(sfx_index)
            self.update()
            event.accept()
            return None
        for clip_id, rect in self._timeline_clip_rects.items():
            if rect.contains(point):
                self.zoom_to_clip(clip_id)
                event.accept()
                return None
        super().mouseDoubleClickEvent(event)

    def _hit_timeline_clip_at(self, point) -> str | None:
        for clip_id, rect in self._timeline_clip_rects.items():
            if rect.contains(point):
                return clip_id

    def _select_timeline_clip_at(self, clip_id: str) -> None:
        persist_values_transform_to_selected_clip(self.state.values)
        current = selected_clip_ids(self.state.values)
        if clip_id in current and len(current) > 1:
            set_selected_clip_ids(self.state.values, current, primary=clip_id)
        else:
            set_selected_clip_ids(self.state.values, [clip_id], primary=clip_id)
            self._selection_anchor_id = clip_id
        clips = self.video_clips()
        chosen = next((clip for clip in clips if clip.id == clip_id), None)
        if chosen is not None:
            apply_clip_transform_to_values(self.state.values, chosen)
        self.timelineClipSelected.emit(clip_id)
        self.update()

    def _timeline_host(self):
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        return panel

    def _drop_host(self):
        win = self.window()
        if win is not None and hasattr(win, 'insert_project_asset_on_track'):
            return win
        panel = self.parent()
        while panel is not None and not isinstance(panel, TimelinePanel):
            panel = panel.parent()
        return panel

    def _show_context_menu(self, pos) -> None:
        point = pos if hasattr(pos, 'x') else self.mapFromGlobal(pos)
        clip_id = self._hit_timeline_clip_at(point)
        if clip_id is not None:
            self._select_timeline_clip_at(clip_id)
            self._show_clip_context_menu(point)
            return None
        timed = self._find_timed_layer_at(point)
        layer_id, _mode = (timed[0], timed[1])
        if timed is not None and (str(layer_id).startswith(('layer-overlay-', 'layer-blend-', 'layer-background-', 'layer-text-', 'layer-blur')) or str(layer_id) in {LAYER_TEXT_OVERLAY, LAYER_BLUR, LAYER_VIDEO_TITLE, LAYER_LOGO}):
            self.selected_id = layer_id
            self.layerSelected.emit(layer_id)
            self._show_layer_track_context_menu(point, layer_id)
            return None
        for layer_id, rect in self._layer_rects.items():
            if rect.contains(point) and (str(layer_id).startswith(('layer-overlay-', 'layer-blend-', 'layer-background-', 'layer-text-', 'layer-blur')) or str(layer_id) in {LAYER_TEXT_OVERLAY, LAYER_BLUR, LAYER_VIDEO_TITLE, LAYER_LOGO}):
                self.selected_id = layer_id
                self.layerSelected.emit(layer_id)
                self._show_layer_track_context_menu(point, layer_id)
                return None
        row = self._row_at_y(point.y())
        if row is not None and 'sfx' in row[1]:
            self.selected_id = 'track-sfx'
            self.layerSelected.emit('track-sfx')
            self._show_sfx_context_menu(point)
            return None
        if row is not None and ('media_overlay' in row[1] or 'blend_layer' in row[1] or 'background_layer' in row[1] or ('text_overlay' in row[1]) or ('blur' in row[1]) or ('video_title' in row[1]) or ('text_logo' in row[1]) or ('subtitle' in row[1]) or ('subtitle_source' in row[1]) or ('voice' in row[1]) or ('audio' in row[1]) or ('video' in row[1])):
            focus_id = self._focus_id_for_row(row[1], row[4])
            self.selected_id = focus_id
            self.layerSelected.emit(focus_id)
            self._show_layer_track_context_menu(point, focus_id)
            return None
        self._show_sfx_context_menu(point)

    def _show_layer_track_context_menu(self, point, layer_id: str) -> None:
        lid = str(layer_id or '')
        is_blend = lid.startswith('layer-blend-') or lid == 'track-blend_layer'
        is_background = lid.startswith('layer-background-') or lid == 'track-background_layer'
        is_overlay = lid.startswith('layer-overlay-') or lid == 'track-media_overlay'
        is_text = lid == LAYER_TEXT_OVERLAY or lid.startswith(f'{LAYER_TEXT_OVERLAY}-') or lid == 'track-remove:text_overlay'
        is_blur = lid in {LAYER_BLUR, 'track-remove:blur'}
        if lid == LAYER_TEXT_OVERLAY:
            is_text = True
        if lid == LAYER_BLUR:
            is_blur = True
        row = self._row_at_y(point.y())
        kind0 = row[1][0] if row is not None else ''
        if kind0 == 'text_overlay':
            is_text = True
        if kind0 == 'blur':
            is_blur = True
        if kind0 == 'background_layer':
            is_background = True
        if kind0 == 'blend_layer':
            is_blend = True
        if kind0 and kind0 in _PLUS_MINUS_KINDS and (not is_blend) and (not is_background) and (not is_overlay) and (not is_text) and (not is_blur):
            label = {'video': 'video', 'subtitle': 'phụ đề sau dịch', 'subtitle_source': 'phụ đề gốc', 'video_title': 'tiêu đề', 'text_logo': 'logo', 'voice': 'giọng đọc', 'audio': 'nhạc file', 'music': 'nhạc file', 'sfx': 'SFX'}.get(kind0, kind0)
            menu = QMenu(self)
            title = menu.addAction(f'Hàng {label}')
            title.setEnabled(False)
            menu.addSeparator()
            add_act = menu.addAction(f'Thêm {label}')
            del_act = menu.addAction(f'Xóa / tắt {label}')
            cfg_act = menu.addAction('Mở cấu hình…')
            chosen = menu.exec(self.mapToGlobal(point))
            if chosen == add_act:
                if self._handle_subtitle_row_plus(kind0, kind0):
                    pass
                else:
                    self.trackAddRequested.emit(kind0)
            elif chosen == del_act:
                if self._handle_subtitle_row_minus(kind0, f'track-remove:{kind0}'):
                    pass
                else:
                    self.trackSlotRemoveRequested.emit(f'track-remove:{kind0}')
            elif chosen == cfg_act:
                self.trackFocusRequested.emit(self._focus_id_for_row(row[1], row[4]))
            return None
        if is_blur:
            self._show_blur_track_context_menu(point)
            return None
        if is_text:
            menu = QMenu(self)
            title = menu.addAction('Hàng chữ phụ họa')
            title.setEnabled(False)
            menu.addSeparator()
            edit_act = menu.addAction('Gõ / sửa chữ…')
            del_act = menu.addAction('Xóa chữ phụ họa')
            cfg_act = menu.addAction('Mở cấu hình…')
            chosen = menu.exec(self.mapToGlobal(point))
            if chosen == edit_act:
                self.trackAddRequested.emit('text_overlay')
            elif chosen == del_act:
                self.trackSlotRemoveRequested.emit('track-remove:text_overlay')
            elif chosen == cfg_act:
                self.trackFocusRequested.emit(LAYER_TEXT_OVERLAY)
            return None
        if is_blend or is_overlay or is_background:
            label = 'nền' if is_background else 'hòa trộn' if is_blend else 'lớp phủ'
            menu = QMenu(self)
            menu.setObjectName('layerTrackContextMenu')
            title = menu.addAction(f'Hàng {label}')
            title.setEnabled(False)
            menu.addSeparator()
            delete_act = menu.addAction(f'Xóa {label} này')
            delete_act.setEnabled(lid.startswith('layer-overlay-') or lid.startswith('layer-blend-') or lid.startswith('layer-background-'))
            add_act = menu.addAction(f'Thêm {label} mới')
            if is_background:
                items = ensure_background_layers(self.state.values)
                max_n = MAX_BACKGROUND_TRACKS
                add_kind = 'background_layer'
            elif is_blend:
                items = ensure_blend_layers(self.state.values)
                max_n = MAX_BLEND_TRACKS
                add_kind = 'blend_layer'
            else:
                items = ensure_media_overlays(self.state.values)
                max_n = MAX_OVERLAY_TRACKS
                add_kind = 'media_overlay'
            add_act.setEnabled(count_filled_layer_tracks(items) < max_n)
            menu.addSeparator()
            config_act = menu.addAction('Mở cấu hình…')
            chosen = menu.exec(self.mapToGlobal(point))
            if chosen is None:
                return None
            if chosen == delete_act:
                self.trackSlotRemoveRequested.emit(lid)
                return None
            if chosen == add_act:
                self.trackAddRequested.emit(add_kind)
                return None
            if chosen == config_act:
                self.trackFocusRequested.emit(lid)
                return None
        else:
            return None

    def _show_blur_track_context_menu(self, point) -> None:
        from PySide6.QtWidgets import QColorDialog
        menu = QMenu(self)
        menu.setObjectName('blurTrackContextMenu')
        title = menu.addAction('Hàng vùng mờ')
        title.setEnabled(False)
        menu.addSeparator()
        add_act = menu.addAction('Thêm vùng mờ')
        black_act = menu.addAction('Kiểu: tô đen')
        blur_act = menu.addAction('Kiểu: làm mờ ảnh')
        color_act = menu.addAction('Kiểu: chọn màu…')
        menu.addSeparator()
        del_act = menu.addAction('Tắt / xóa vùng mờ')
        cfg_act = menu.addAction('Mở cấu hình…')
        chosen = menu.exec(self.mapToGlobal(point))
        host = self.window()
        if chosen is None:
            return None
        if chosen == add_act:
            self.trackAddRequested.emit('blur')
            return None
        if chosen == del_act:
            self.trackSlotRemoveRequested.emit('track-remove:blur')
            return None
        if chosen == cfg_act:
            self.trackFocusRequested.emit(LAYER_BLUR)
            return None
        if host is None or not hasattr(host, 'apply_blur_zone_style_from_timeline'):
            return None
        if chosen == black_act:
            host.apply_blur_zone_style_from_timeline('black')
            return None
        if chosen == blur_act:
            host.apply_blur_zone_style_from_timeline('blur')
            return None
        if chosen == color_act:
            current = QColor(str(self.state.values.get('blur_zone_color', '#000000') or '#000000'))
            picked = QColorDialog.getColor(current if current.isValid() else QColor('#000000'), self, 'Chọn màu vùng mờ')
            if picked.isValid():
                host.apply_blur_zone_style_from_timeline('color', color=picked.name(QColor.NameFormat.HexRgb))
            return None

    def _show_clip_context_menu(self, point) -> None:
        host = self._timeline_host()
        if host is None:
            return None
        video = self._selected_video_asset()
        from ui_qt.timeline_context_menu import SCENE_SPLIT_ACTIONS
        enabled = {item.id: clip_action_enabled(item.id, has_selection=bool(selected_clip_id(self.state.values)), can_paste=isinstance(self._clip_clipboard, dict), has_video=bool(video is not None and video.path)) for item in (*CLIP_CONTEXT_ACTIONS, *SCENE_SPLIT_ACTIONS, *STEM_SEP_ACTIONS) if item.kind in frozenset({'action', 'submenu'})}
        menu = QMenu(self)
        menu.setObjectName('clipContextMenu')
        from core.scene_clip_fx import clip_scene_fx_status_lines
        from core.timeline_clips import find_clip
        hit_clip = find_clip(self.video_clips(), str(selected_clip_id(self.state.values) or ''))
        if hit_clip is not None:
            for line in clip_scene_fx_status_lines(hit_clip, self.state.values):
                info = menu.addAction(line)
                info.setEnabled(False)
            menu.addSeparator()
        for item in CLIP_CONTEXT_ACTIONS:
            if item.kind == 'separator':
                menu.addSeparator()
            elif item.kind == 'submenu' and item.id == 'scene_split':
                sub = menu.addMenu(item.label)
                sub.setEnabled(bool(enabled.get('scene_split', False)))
                for child in SCENE_SPLIT_ACTIONS:
                    action = sub.addAction(child.label)
                    action.setData(child.id)
                    action.setEnabled(bool(enabled.get(child.id, False)))
            elif item.kind == 'submenu' and item.id == 'stem_sep':
                sub = menu.addMenu(item.label)
                sub.setEnabled(bool(enabled.get('stem_sep', False)))
                for child in STEM_SEP_ACTIONS:
                    action = sub.addAction(child.label)
                    action.setEnabled(bool(enabled.get(child.id, False)))
                    action.setData(child.id)
            else:
                action = menu.addAction(item.label)
                if item.shortcut:
                    action.setShortcut(item.shortcut)
                    action.setShortcutVisibleInContextMenu(True)
                action.setEnabled(bool(enabled.get(item.id, False)))
                action.setData(item.id)
        chosen = menu.exec(self.mapToGlobal(point))
        if chosen is None:
            return None
        action_id = str(chosen.data() or '')
        self._dispatch_clip_context_action(action_id, host)

    def _dispatch_clip_context_action(self, action_id: str, host) -> None:
        if action_id == 'duplicate':
            host.duplicate_selected_clip()
            return None
        if action_id == 'copy':
            host.copy_selected_clip()
            return None
        if action_id == 'paste':
            host.paste_clip()
            return None
        if action_id == 'split':
            host.split_at_playhead()
            return None
        if action_id == 'delete':
            host.delete_selected_clip()
            return None
        if action_id in frozenset({'scene_split', 'scene_split_one'}):
            host.autoSceneSplitRequested.emit('one')
            return None
        if action_id == 'scene_split_all':
            host.autoSceneSplitRequested.emit('all')
            return None
        if action_id == 'speech':
            host.speechRecognitionRequested.emit()
            return None
        if action_id in frozenset({'stem_both', 'stem_vocal', 'vocal_sep', 'stem_music'}):
            host.request_stem_separation(normalize_stem_mode(action_id))
            return None

    def _show_sfx_context_menu(self, point) -> None:
        sfx_top = self._sfx_track_top()
        if sfx_top < 0:
            return None
        if sfx_top <= point.y() < sfx_top + self.track_height:
            marker_index = self._find_sfx_marker_at(point)
            menu = QMenu(self)
            menu.setObjectName('sfxContextMenu')
            time_sec = max(0.0, (float(self.position_ms) if float(point.x()) < float(self.header_width) else self._x_to_ms(point.x())) / 1000.0)
            if marker_index is not None:
                self._selected_sfx_index = marker_index
                event = self.state.sfx_events[marker_index]
                menu.addAction(f"SFX: {event.get('label', '?')}").setEnabled(False)
                menu.addSeparator()
                preview = menu.addAction('▶ Nghe thử (Space)')
                copy_act = menu.addAction('Sao chép (Ctrl+C)')
                dup_act = menu.addAction('Nhân bản tại playhead (Ctrl+D)')
                edit_vol = menu.addAction('Chỉnh volume…')
                delete = menu.addAction('Xóa SFX này (Del)')
                chosen = menu.exec(self.mapToGlobal(point))
                if chosen == preview:
                    self._preview_sfx(marker_index)
                elif chosen == copy_act:
                    self.copy_selected_sfx()
                elif chosen == dup_act:
                    self.copy_selected_sfx()
                    self.paste_sfx_at_playhead()
                elif chosen == edit_vol:
                    self._edit_sfx_volume(marker_index)
                elif chosen == delete:
                    self._delete_sfx(marker_index)
                    self._selected_sfx_index = None
                self.update()
                return None
            self._popup_sfx_preset_menu(time_sec, self.mapToGlobal(point))
        else:
            row = self._row_at_y(point.y())
            if row is None or 'sfx' not in row[1]:
                return None

    def _popup_sfx_preset_menu(self, time_sec: float, global_pos) -> bool:
        menu = QMenu(self)
        menu.setObjectName('sfxContextMenu')
        menu.addAction(f'Thêm SFX tại {_format_seconds(int(time_sec))}').setEnabled(False)
        menu.addSeparator()
        paste_act = None
        if self._sfx_clipboard:
            paste_act = menu.addAction('Dán SFX tại đây (Ctrl+V)')
            menu.addSeparator()
        presets = scan_sfx_presets()
        if presets:
            for name, path in presets.items():
                action = menu.addAction(f'🔊  {name}')
                action.setData(('preset', path, name, float(time_sec)))
        else:
            menu.addAction('(Chưa có preset trong assets/sfx)').setEnabled(False)
        menu.addSeparator()
        pick = menu.addAction('📂  Chọn file khác…')
        pick.setData(('pick', '', '', float(time_sec)))
        chosen = menu.exec(global_pos)
        if chosen is None:
            return False
        if paste_act is not None and chosen == paste_act:
            self.paste_sfx_at_time(time_sec)
            return True
        data = chosen.data()
        if data:
            kind, path, name, at = (data[0], data[1], data[2], data[3])
            if kind == 'pick':
                path, _filter = (QFileDialog.getOpenFileName(self, 'Chọn file SFX', get_last_dir('sfx', get_last_dir('audio')), 'Audio (*.mp3 *.wav *.aac *.m4a *.ogg *.flac);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file SFX', get_last_dir('sfx', get_last_dir('audio')), 'Audio (*.mp3 *.wav *.aac *.m4a *.ogg *.flac);;Tất cả tệp (*.*)')[1])
                if path:
                    remember_path('sfx', path)
                    name = Path(path).stem
                else:
                    return False
            else:
                self.add_sfx_event(float(at), path, name)
                return True
        else:
            return False

    def prompt_add_sfx_at_playhead(self) -> bool:
        at = max(0.0, float(self.position_ms) / 1000.0)
        anchor = self.mapToGlobal(self.rect().bottomLeft())
        return self._popup_sfx_preset_menu(at, anchor)

    def add_sfx_event(self, time_sec: float, file_path: str, label: str, *, volume: float) -> None:
        if Path(file_path).is_file():
            self.sfxEditStarted.emit()
            self.state.sfx_events.append({'time_sec': float(time_sec), 'file': file_path, 'label': label, 'volume': float(volume)})
            self.state.sfx_events = normalize_sfx_events(self.state.sfx_events)
            self._selected_sfx_index = next((i for i, event in enumerate(self.state.sfx_events) if event.get('file') == file_path and float(event.get('time_sec', -1.0)) == float(time_sec)), None)
            self._persist_sfx()
            self.sfxChanged.emit()
            self.update()
        else:
            QMessageBox.warning(self, 'SFX', 'Tệp âm thanh không tồn tại.')
            return None

    def copy_selected_sfx(self) -> bool:
        idx = self._selected_sfx_index
        if 0 <= idx < len(self.state.sfx_events):
            src = self.state.sfx_events[idx]
            self._sfx_clipboard = {'file': str(src.get('file', '')), 'label': str(src.get('label', 'SFX')), 'volume': float(src.get('volume', 0.7) or 0.7)}
            self._clipboard_kind = 'sfx'
            return True
        return False
        return False

    def paste_sfx_at_playhead(self) -> bool:
        return self.paste_sfx_at_time(self.position_ms / 1000.0)

    def paste_sfx_at_time(self, time_sec: float) -> bool:
        clip = self._sfx_clipboard
        if isinstance(clip, dict):
            path = str(clip.get('file', '') or '')
            if path:
                self.add_sfx_event(float(time_sec), path, str(clip.get('label', 'SFX')), volume=float(clip.get('volume', 0.7) or 0.7))
                return True
        return False

    def _preview_sfx(self, index: int) -> None:
        if 0 <= index < len(self.state.sfx_events):
            path = str(self.state.sfx_events[index].get('file', '') or '')
            if path and Path(path).is_file():
                if self._sfx_preview_proc is not None:
                    try:
                        self._sfx_preview_proc.terminate()
                    except Exception:
                        pass
                    self._sfx_preview_proc = None
                from core.paths import PATHS
                ffplay = PATHS.ffplay
                player = str(ffplay) if ffplay.is_file() else 'ffplay'
                vol = float(self.state.sfx_events[index].get('volume', 0.7) or 0.7)
                ff_vol = max(0, min(100, int(round(vol * 50))))
                try:
                    self._sfx_preview_proc = subprocess.Popen([player, '-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', str(ff_vol), path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                except OSError as exc:
                    QMessageBox.warning(self, 'SFX', f'Không phát được: {exc}')
            else:
                QMessageBox.warning(self, 'SFX', 'Không tìm thấy file để nghe thử.')

    def _edit_sfx_volume(self, index: int) -> None:
        if 0 <= index < len(self.state.sfx_events):
            current = float(self.state.sfx_events[index].get('volume', 0.7))
            value, ok = (QInputDialog.getDouble(self, 'Volume SFX', 'Âm lượng (0.0 – 2.0):', current, 0.0, 2.0, 2)[0], QInputDialog.getDouble(self, 'Volume SFX', 'Âm lượng (0.0 – 2.0):', current, 0.0, 2.0, 2)[1])
            if ok:
                self.sfxEditStarted.emit()
                self.state.sfx_events[index]['volume'] = float(value)
                self._persist_sfx()
                self.sfxChanged.emit()
                self.update()
            else:
                return None
        else:
            return None

    def _delete_sfx(self, index: int) -> None:
        if 0 <= index < len(self.state.sfx_events):
            self.sfxEditStarted.emit()
            del self.state.sfx_events[index]
            self._persist_sfx()
            self.sfxChanged.emit()
            self.update()
        else:
            return None

    def _persist_sfx(self) -> None:
        video = None
        if video is not None and video.path:
            try:
                save_sfx_events(video.path, self.state.sfx_events)
            except (OSError, ValueError):
                pass

class TimelinePanel(QFrame):
    clipSelected = Signal(str)
    timelineClipSelected = Signal(str)
    layerSelected = Signal(str)
    trackFocusRequested = Signal(str)
    trackAddRequested = Signal(str)
    trackSlotRemoveRequested = Signal(str)
    trimChanged = Signal(int, int)
    trimDragStarted = Signal()
    layerTimingDragStarted = Signal()
    layerTimingChanged = Signal()
    positionScrubbed = Signal(int)
    subtitleCueSelectRequested = Signal(int)
    subtitleCueDeleteRequested = Signal(str, int)
    scrubFinished = Signal(int)
    undoRequested = Signal()
    redoRequested = Signal()
    zoomChanged = Signal(float)
    sfxChanged = Signal()
    sfxEditStarted = Signal()
    cropToolToggled = Signal(bool)
    audioMixChanged = Signal()
    audioMixPreview = Signal()
    bodyVisibleChanged = Signal(bool)
    layoutModeRequested = Signal(str)
    splitAtPlayheadRequested = Signal()
    autoSceneSplitRequested = Signal(str)
    speechRecognitionRequested = Signal()
    insertVideoAtPlayheadRequested = Signal()
    trackControlsChanged = Signal()
    clipsChanged = Signal()
    filmstripPathsNeeded = Signal(object)
    libraryActionDropped = Signal(str, int)
    libraryAssetDropped = Signal(str, str, int)
    transitionSelected = Signal(int)
    summaryFlowRowActivated = Signal(object)
    _TIMELINE_HEADER_HEIGHT = 36
    _TIMELINE_TOOLBAR_HEIGHT = 32
    _TIMELINE_CHROME_HEIGHT = 0
    _SUMMARY_FLOW_REFRESH_MS = 1600

    def __init__(self, state: ProjectState, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('timelinePanel')
        self.state = state
        self._body_visible = True
        self.setMinimumHeight(self._TIMELINE_TOOLBAR_HEIGHT + 26 + 68 + 16)
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 4, 8, 6)
        root.setSpacing(2)
        self.chrome_bar = QWidget()
        self.chrome_bar.setObjectName('timelineChromeBar')
        self.chrome_bar.setVisible(False)
        self.chrome_bar.setFixedHeight(0)
        self.chrome_title = QLabel('Timeline')
        self.chrome_hint = QLabel('')
        self.body_widget = QWidget()
        body_layout = QVBoxLayout(self.body_widget)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(2)
        self.tool_bar = QWidget()
        self.tool_bar.setObjectName('timelineToolBar')
        self.tool_bar.setFixedHeight(self._TIMELINE_TOOLBAR_HEIGHT)
        tools_row = QHBoxLayout(self.tool_bar)
        tools_row.setContentsMargins(0, 0, 0, 0)
        tools_row.setSpacing(2)
        self.mix_strip = TimelineMixStrip(state, parent=self.tool_bar)
        self.mix_strip.audioMixChanged.connect(self.audioMixChanged.emit)
        self.mix_strip.audioMixPreview.connect(self.audioMixPreview.emit)
        self.collapse_button = QPushButton('Ẩn')
        self.collapse_button.setObjectName('timelineCompactButton')
        self.collapse_button.setToolTip('Ẩn timeline — tăng diện preview')
        self.collapse_button.setFixedWidth(44)
        self.collapse_button.clicked.connect(self._toggle_body_visible)
        self.show_summary_flow_button = QPushButton('Hiện dây')
        self.show_summary_flow_button.setObjectName('timelineShowSummaryFlowButton')
        self.show_summary_flow_button.setToolTip('Hiện dây tóm tắt trên thước')
        self.show_summary_flow_button.clicked.connect(self._show_summary_flow_strip)
        self.show_summary_flow_button.hide()
        self.undo_button = make_timeline_tool_button(icon_undo(), 'Hoàn tác bước vừa làm (Ctrl+Z)', parent=self.tool_bar)
        self.undo_button.clicked.connect(self.undoRequested.emit)
        self.undo_button.hide()
        self.redo_button = make_timeline_tool_button(icon_redo(), 'Làm lại bước đã hoàn tác (Ctrl+Shift+Z)', parent=self.tool_bar)
        self.redo_button.clicked.connect(self.redoRequested.emit)
        self.redo_button.hide()
        self.split_button = make_timeline_tool_button(icon_split(), 'Tách clip tại vạch vàng thành 2 đoạn (Ctrl+S)', parent=self.tool_bar)
        self.split_button.clicked.connect(self.split_at_playhead)
        tools_row.addWidget(self.split_button)
        self.prev_clip_button = make_timeline_tool_button(icon_skip_backward(), 'Cảnh trước (Ctrl+←)', parent=self.tool_bar)
        self.prev_clip_button.clicked.connect(lambda: self.select_adjacent_clip(-1))
        tools_row.addWidget(self.prev_clip_button)
        self.next_clip_button = make_timeline_tool_button(icon_skip_forward(), 'Cảnh sau (Ctrl+→)', parent=self.tool_bar)
        self.next_clip_button.clicked.connect(lambda: self.select_adjacent_clip(1))
        tools_row.addWidget(self.next_clip_button)
        self.scene_split_button = make_timeline_tool_button(icon_scene_split(), 'Tách cảnh — video đang chọn hoặc tất cả video trong dự án', parent=self.tool_bar)
        self.scene_split_button.setObjectName('timelineSceneSplitButton')
        self.scene_split_button.clicked.connect(self._open_scene_split_menu)
        tools_row.addWidget(self.scene_split_button)
        self.scene_split_progress = QProgressBar()
        self.scene_split_progress.setObjectName('exportProgressBar')
        self.scene_split_progress.setFixedWidth(96)
        self.scene_split_progress.setFixedHeight(18)
        self.scene_split_progress.setTextVisible(True)
        self.scene_split_progress.setRange(0, 1)
        self.scene_split_progress.setValue(0)
        self.scene_split_progress.setFormat('%v/%m')
        self.scene_split_progress.hide()
        tools_row.addWidget(self.scene_split_progress)
        self.insert_video_button = QPushButton('+V')
        self.insert_video_button.setObjectName('timelineToolButton')
        self.insert_video_button.setFixedSize(28, 28)
        self.insert_video_button.setToolTip('Chèn video khác vào timeline tại playhead (multi-file như CapCut)')
        self.insert_video_button.clicked.connect(self.insertVideoAtPlayheadRequested.emit)
        tools_row.addWidget(self.insert_video_button)
        self.crop_button = make_timeline_tool_button(icon_crop(), 'Crop — hiện khung cắt trên preview (như CapCut)', checkable=True, parent=self.tool_bar)
        self.crop_button.setObjectName('timelineCropButton')
        self.crop_button.toggled.connect(self.cropToolToggled.emit)
        tools_row.addWidget(self.crop_button)
        self.reset_trim_button = make_timeline_tool_button(icon_reset_trim(), 'Xóa điểm cắt — dùng lại toàn bộ video', parent=self.tool_bar)
        self.reset_trim_button.clicked.connect(self.clear_trim)
        tools_row.addWidget(self.reset_trim_button)
        set_c = getattr(self.mix_strip, 'set_compact_mode', None)
        if callable(set_c):
            set_c(False)
        lock = getattr(self.mix_strip, 'lock_content_size', None)
        if callable(lock):
            lock()
        self.mix_strip.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        self.mix_scroll_left = QPushButton('◀', self.tool_bar)
        self.mix_scroll_left.setObjectName('timelineCompactButton')
        self.mix_scroll_left.setFixedSize(22, 20)
        self.mix_scroll_left.setToolTip('Cuộn thanh âm thanh sang trái')
        self.mix_scroll_left.clicked.connect(lambda: self._nudge_mix_scroll(-180))
        self.mix_scroll = QScrollArea(self.tool_bar)
        self.mix_scroll.setObjectName('timelineMixScroll')
        self.mix_scroll.setWidget(self.mix_strip)
        self.mix_scroll.setWidgetResizable(False)
        self.mix_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.mix_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.mix_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.mix_scroll.setFixedHeight(30)
        self.mix_scroll.setMinimumWidth(160)
        self.mix_scroll.setMaximumHeight(30)
        self.mix_scroll.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.mix_scroll.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        self.mix_scroll_right = QPushButton('▶', self.tool_bar)
        self.mix_scroll_right.setObjectName('timelineCompactButton')
        self.mix_scroll_right.setFixedSize(22, 20)
        self.mix_scroll_right.setToolTip('Cuộn thanh âm thanh sang phải')
        self.mix_scroll_right.clicked.connect(lambda: self._nudge_mix_scroll(180))
        tools_row.addWidget(self.mix_scroll_left, 0)
        tools_row.addWidget(self.mix_scroll, 1)
        tools_row.addWidget(self.mix_scroll_right, 0)
        zoom_box = QWidget(self.tool_bar)
        zoom_box.setObjectName('timelineZoomBox')
        zoom_box.setFixedWidth(200)
        zoom_box.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        zoom_row = QHBoxLayout(zoom_box)
        zoom_row.setContentsMargins(4, 0, 0, 0)
        zoom_row.setSpacing(2)
        self.zoom_out_button = make_timeline_tool_button(icon_zoom_out(), 'Thu nhỏ timeline', parent=zoom_box)
        self.zoom_out_button.clicked.connect(self.zoom_out)
        zoom_row.addWidget(self.zoom_out_button)
        self.fit_zoom_button = QPushButton('50%')
        self.fit_zoom_button.setObjectName('timelineToolButton')
        self.fit_zoom_button.setFixedSize(36, 26)
        self.fit_zoom_button.setToolTip('Thu nhỏ 50% — xem overview rộng hơn (kéo slider xuống 25% nếu cần)')
        self.fit_zoom_button.clicked.connect(lambda: self.set_zoom_percent(50))
        zoom_row.addWidget(self.fit_zoom_button)
        self.zoom_slider = QSlider(Qt.Orientation.Horizontal)
        self.zoom_slider.setObjectName('timelineZoomSlider')
        self.zoom_slider.setRange(25, 1000)
        self.zoom_slider.setValue(100)
        self.zoom_slider.setFixedWidth(84)
        self.zoom_slider.setMinimumWidth(84)
        self.zoom_slider.setToolTip('Thu phóng timeline: 25% (overview) → 100% (vừa khung) → 1000% · Ctrl+lăn')
        self.zoom_slider.valueChanged.connect(self._on_zoom_slider_changed)
        zoom_row.addWidget(self.zoom_slider)
        self.zoom_label = QLabel('100%')
        self.zoom_label.setObjectName('mutedLabel')
        self.zoom_label.setFixedWidth(40)
        self.zoom_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        zoom_row.addWidget(self.zoom_label)
        self.zoom_in_button = make_timeline_tool_button(icon_zoom_in(), 'Phóng to timeline', parent=zoom_box)
        self.zoom_in_button.clicked.connect(self.zoom_in)
        zoom_row.addWidget(self.zoom_in_button)
        tools_row.addWidget(zoom_box, 0)
        layout_box = QWidget(self.tool_bar)
        layout_box.setObjectName('timelineLayoutModeBox')
        layout_row = QHBoxLayout(layout_box)
        layout_row.setContentsMargins(4, 0, 0, 0)
        layout_row.setSpacing(2)
        self.layout_mode_group = QButtonGroup(self)
        self.layout_mode_group.setExclusive(True)
        self._layout_mode_buttons = {}
        for mode, label, tip, width in (('normal', 'CB', 'Cân bằng — timeline full ngang dưới, thuộc tính trên phải', 32), ('timeline', 'TL', 'Timeline full ngang như hiện tại (thuộc tính giữ cột trên) — ưu tiên cao timeline', 32), ('inspector', 'TT', 'Thuộc tính bung thẳng xuống hết màn hình — timeline chỉ từ trái tới mép cột TT', 32)):
            btn = QPushButton(label, layout_box)
            btn.setObjectName('timelineCompactButton')
            btn.setCheckable(True)
            btn.setFixedWidth(width)
            btn.setFixedHeight(26)
            btn.setToolTip(tip)
            btn.setProperty('layoutMode', mode)
            self.layout_mode_group.addButton(btn)
            self._layout_mode_buttons[mode] = btn
            layout_row.addWidget(btn)
            btn.clicked.connect(lambda _checked, m: self.layoutModeRequested.emit(m))
        self._layout_mode_buttons['normal'].setChecked(True)
        tools_row.addWidget(layout_box, 0)
        tools_row.addWidget(self.show_summary_flow_button, 0)
        tools_row.addWidget(self.collapse_button, 0)
        root.addWidget(self.tool_bar, 0)
        self.mix_bar = None
        QTimer.singleShot(0, self._sync_mix_scroll_arrows)
        self.canvas = TimelineCanvas(state)
        self.track_scroll = QScrollArea()
        self.track_scroll.setObjectName('timelineTrackScroll')
        self.track_scroll.setWidgetResizable(False)
        self.track_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.track_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.track_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.track_scroll.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
        self.track_scroll.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.track_scroll.setWidget(self.canvas)
        self.track_scroll.verticalScrollBar().valueChanged.connect(self._on_track_vertical_scroll)
        self.track_scroll.verticalScrollBar().sliderPressed.connect(lambda: setattr(self.canvas, '_drag_lite', True))
        self.track_scroll.verticalScrollBar().sliderReleased.connect(self._on_track_vertical_scroll_released)
        self.canvas.clipSelected.connect(self.clipSelected)
        self.canvas.timelineClipSelected.connect(self.timelineClipSelected)
        self.canvas.layerSelected.connect(self.layerSelected)
        self.canvas.trackFocusRequested.connect(self.trackFocusRequested)
        self.canvas.trackAddRequested.connect(self.trackAddRequested)
        self.canvas.trackSlotRemoveRequested.connect(self.trackSlotRemoveRequested)
        self.canvas.trimChanged.connect(self.trimChanged)
        self.canvas.trimDragStarted.connect(self.trimDragStarted)
        self.canvas.layerTimingDragStarted.connect(self.layerTimingDragStarted)
        self.canvas.layerTimingChanged.connect(self.layerTimingChanged)
        self.canvas.positionScrubbed.connect(self.positionScrubbed)
        self.canvas.subtitleCueSelectRequested.connect(self.subtitleCueSelectRequested)
        self.canvas.subtitleCueDeleteRequested.connect(self.subtitleCueDeleteRequested)
        self.canvas.scrubFinished.connect(self.scrubFinished)
        self.canvas.zoomChanged.connect(self._on_canvas_zoom_changed)
        self.canvas.scrollOffsetChanged.connect(self._sync_content_scrollbar)
        self.canvas.libraryActionDropped.connect(self.libraryActionDropped.emit)
        self.canvas.libraryAssetDropped.connect(self.libraryAssetDropped.emit)
        self.canvas.transitionSelected.connect(self.transitionSelected.emit)
        self.canvas.sfxChanged.connect(self.sfxChanged)
        self.canvas.sfxEditStarted.connect(self.sfxEditStarted)
        self.canvas.trackControlsChanged.connect(self.trackControlsChanged)
        self.canvas.clipsChanged.connect(self.clipsChanged)
        self.canvas.filmstripPathsNeeded.connect(self.filmstripPathsNeeded)
        self.summary_flow_bar = TimelineSummaryFlowBar(self)
        self.summary_flow_bar.rowActivated.connect(self.summaryFlowRowActivated.emit)
        self.summary_flow_bar.hideRequested.connect(self._hide_summary_flow_strip)
        body_layout.addWidget(self.summary_flow_bar, 0)
        body_layout.addWidget(self.track_scroll, 1)
        scroll_row = QHBoxLayout()
        scroll_row.setSpacing(4)
        self._scroll_spacer = QWidget()
        self._scroll_spacer.setFixedWidth(self.canvas.header_width)
        self.content_scroll = QScrollBar(Qt.Orientation.Horizontal)
        self.content_scroll.setObjectName('timelineContentScroll')
        self.content_scroll.setToolTip('Cuộn ngang khi phóng to · thu nhỏ 25–50% để xem overview rộng hơn')
        self.content_scroll.valueChanged.connect(self._on_content_scroll)
        self.content_scroll.sliderPressed.connect(self._on_content_scroll_pressed)
        self.content_scroll.sliderReleased.connect(self._on_content_scroll_released)
        scroll_row.addWidget(self._scroll_spacer)
        scroll_row.addWidget(self.content_scroll, 1)
        body_layout.addLayout(scroll_row)
        root.addWidget(self.body_widget, 1)
        self.sync_audio_mix_from_state()
        self._sync_canvas_scroll_size()
        self._summary_flow_fingerprint = None
        self._summary_flow_refresh_timer = QTimer(self)
        self._summary_flow_refresh_timer.setInterval(self._SUMMARY_FLOW_REFRESH_MS)
        self._summary_flow_refresh_timer.timeout.connect(self._on_summary_flow_auto_refresh)
        self._refresh_summary_flow_nodes()
        self._apply_summary_flow_strip_visible(bool(load_prefs().get('summary_flow_strip_visible', True)), persist=False)

    def _refresh_summary_flow_nodes(self) -> None:
        nodes = [n for n in build_workflow_nodes(self.state) if n.enabled]
        fingerprint = tuple(((n.id, n.enabled) for n in nodes))
        if fingerprint == self._summary_flow_fingerprint:
            return None
        self._summary_flow_fingerprint = fingerprint
        self.summary_flow_bar.set_nodes(nodes)

    def _on_summary_flow_auto_refresh(self) -> None:
        if self.summary_flow_bar.isVisible():
            self._refresh_summary_flow_nodes()
        else:
            return None

    def _apply_summary_flow_strip_visible(self, visible: bool, *, persist: bool) -> None:
        self.summary_flow_bar.setVisible(visible)
        self.show_summary_flow_button.setVisible(not visible)
        if visible:
            self._summary_flow_refresh_timer.start()
        else:
            self._summary_flow_refresh_timer.stop()
        if persist:
            save_prefs({'summary_flow_strip_visible': bool(visible)})
            return None

    def _hide_summary_flow_strip(self) -> None:
        self._apply_summary_flow_strip_visible(False, persist=True)

    def _show_summary_flow_strip(self) -> None:
        self._apply_summary_flow_strip_visible(True, persist=True)

    def is_body_visible(self) -> bool:
        return self._body_visible

    def set_body_visible(self, visible: bool) -> None:
        visible = bool(visible)
        if visible == self._body_visible:
            return None
        self._body_visible = visible
        self.body_widget.setVisible(visible)
        self.collapse_button.setText('Ẩn' if visible else 'Hiện')
        self.collapse_button.setToolTip('Ẩn timeline — tăng diện preview' if visible else 'Hiện lại timeline')
        self.chrome_hint.setText('' if visible else 'Timeline đang ẩn — bấm Hiện hoặc kéo thanh ngang lên')
        if visible:
            self.setMinimumHeight(self._TIMELINE_TOOLBAR_HEIGHT + 26 + 68 + 16)
            self.setMaximumHeight(16777215)
        else:
            self.setMinimumHeight(self._TIMELINE_TOOLBAR_HEIGHT + 8)
            self.setMaximumHeight(self._TIMELINE_TOOLBAR_HEIGHT + 12)
        self.bodyVisibleChanged.emit(visible)

    def set_layout_mode_ui(self, mode: str) -> None:
        mode = str(mode or 'normal').strip().lower()
        btn = getattr(self, '_layout_mode_buttons', {}).get(mode)
        if btn is not None and (not btn.isChecked()):
            btn.setChecked(True)
        QTimer.singleShot(0, self._sync_mix_scroll_arrows)

    def _nudge_mix_scroll(self, delta: int) -> None:
        scroll = getattr(self, 'mix_scroll', None)
        if scroll is None:
            return None
        bar = scroll.horizontalScrollBar()
        bar.setValue(int(bar.value()) + int(delta))
        self._sync_mix_scroll_arrows()

    def _sync_mix_scroll_arrows(self) -> None:
        scroll = getattr(self, 'mix_scroll', None)
        left = getattr(self, 'mix_scroll_left', None)
        right = getattr(self, 'mix_scroll_right', None)
        mix = getattr(self, 'mix_strip', None)
        if scroll is None or left is None or right is None:
            return None
        if mix is not None:
            set_c = getattr(mix, 'set_compact_mode', None)
            if callable(set_c):
                set_c(False)
            lock = getattr(mix, 'lock_content_size', None)
            if callable(lock):
                lock()
            else:
                mix.resize(mix.sizeHint())
        bar = scroll.horizontalScrollBar()
        need = False
        if mix is not None and scroll.viewport() is not None:
            need = mix.width() > scroll.viewport().width() + 2
        if not need:
            need = bar.maximum() > 0
        left.setEnabled(need and bar.value() > bar.minimum())
        right.setEnabled(need and bar.value() < bar.maximum())
        left.setVisible(True)
        right.setVisible(True)
        scroll.setWidgetResizable(False)

    def _toggle_body_visible(self) -> None:
        self.set_body_visible(not self._body_visible)

    def set_zoom_percent(self, percent: int) -> None:
        pct = max(25, min(1000, int(percent)))
        self.zoom_slider.setValue(pct)

    def _on_zoom_slider_changed(self, percent: int) -> None:
        self.canvas.set_zoom_factor(max(25, min(1000, int(percent))) / 100.0)
        self.zoom_label.setText(f'{int(percent)}%')
        self._sync_content_scrollbar()

    def _on_canvas_zoom_changed(self, factor: float) -> None:
        percent = int(round(float(factor) * 100))
        percent = max(25, min(1000, percent))
        self.zoom_slider.blockSignals(True)
        try:
            self.zoom_slider.setValue(percent)
            self.zoom_label.setText(f'{percent}%')
        finally:
            self.zoom_slider.blockSignals(False)
        self._sync_content_scrollbar()

    def _sync_canvas_scroll_size(self) -> None:
        if hasattr(self, 'track_scroll'):
            viewport = self.track_scroll.viewport()
            w = max(int(viewport.width()), 200)
            h = self.canvas.content_pixel_height()
            self.canvas.setFixedSize(w, h)
            self.track_scroll.updateGeometry()
        else:
            return None

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._sync_canvas_scroll_size()
        self._sync_mix_scroll_arrows()

    def _sync_content_scrollbar(self) -> None:
        if hasattr(self, '_scroll_spacer'):
            self._scroll_spacer.setFixedWidth(self.canvas.header_width)
        max_px = self.canvas.max_scroll_px()
        self.content_scroll.setEnabled(max_px > 0)
        visible = max(48, self.canvas.visible_content_width())
        page = max(48, min(visible, max(visible // 4, 64)))
        self.content_scroll.setRange(0, max_px)
        self.content_scroll.setPageStep(page)
        self.content_scroll.setSingleStep(max(16, page // 8))
        target = int(round(self.canvas.scroll_offset_px))
        if int(self.content_scroll.value()) != target:
            self.content_scroll.blockSignals(True)
            try:
                self.content_scroll.setValue(target)
            finally:
                self.content_scroll.blockSignals(False)

    def _on_content_scroll_pressed(self) -> None:
        self.canvas._drag_lite = True
        if not self.canvas._body_cache_usable():
            self.canvas._playback_body_dirty = True
            self.canvas.update()
            return None

    def _on_content_scroll_released(self) -> None:
        self.canvas._drag_lite = False
        self.canvas._scroll_paint_armed = False
        self.canvas._invalidate_playback_body_cache()
        self.canvas.update()

    def _on_track_vertical_scroll(self, _value: int) -> None:
        self._schedule_lite_scroll_paint()

    def _on_track_vertical_scroll_released(self) -> None:
        self.canvas._drag_lite = False
        self.canvas._scroll_paint_armed = False
        self.canvas._invalidate_playback_body_cache()
        self.canvas.update()

    def _schedule_lite_scroll_paint(self) -> None:
        canvas = self.canvas
        now = time.monotonic()
        if now - float(canvas._scroll_paint_at or 0.0) >= 0.032:
            canvas._scroll_paint_at = now
            canvas._scroll_paint_armed = False
            canvas.update()
            return None
        if canvas._scroll_paint_armed:
            return None
        canvas._scroll_paint_armed = True
        delay_ms = max(1, int((0.032 - (now - float(canvas._scroll_paint_at or 0.0))) * 1000))
        QTimer.singleShot(delay_ms, self._flush_lite_scroll_paint)

    def _flush_lite_scroll_paint(self) -> None:
        self.canvas._scroll_paint_armed = False
        if self.canvas._drag_lite:
            self.canvas._scroll_paint_at = time.monotonic()
            self.canvas.update()
        else:
            return None

    def _on_content_scroll(self, value: int) -> None:
        self.canvas.scroll_offset_px = float(value)
        self.canvas._clamp_scroll()
        clamped = int(round(self.canvas.scroll_offset_px))
        if clamped != int(value):
            self.content_scroll.blockSignals(True)
            try:
                self.content_scroll.setValue(clamped)
            finally:
                self.content_scroll.blockSignals(False)
        self._schedule_lite_scroll_paint()

    def sync_audio_mix_from_state(self) -> None:
        self.mix_strip.state = self.state
        self.mix_strip.sync_from_state()

    @property
    def duration_ms(self) -> int:
        return self.canvas.project_duration_ms

    def visible_track_names(self) -> list[str]:
        return [track[0] for track in self.canvas.track_rows()]

    def insert_project_asset_on_track(self, asset_id: str, *, track_index: int, at_timeline_ms: int | None) -> None:
        win = self.window()
        if win is not None:
            if win is not self:
                if hasattr(win, 'insert_project_asset_on_track'):
                    win.insert_project_asset_on_track(asset_id, track_index=track_index, at_timeline_ms=at_timeline_ms)
            return None

    def insert_media_paths_on_track(self, paths: list[str], *, track_index: int, at_timeline_ms: int | None) -> None:
        win = self.window()
        if win is not None:
            if win is not self:
                if hasattr(win, 'insert_media_paths_on_track'):
                    win.insert_media_paths_on_track(paths, track_index=track_index, at_timeline_ms=at_timeline_ms)
            return None

    def reload_project(self, state: ProjectState | None=None) -> None:
        if state is not None:
            self.state = state
        self.canvas.reload_project(state)
        self.sync_audio_mix_from_state()
        self._sync_canvas_scroll_size()
        self._sync_content_scrollbar()
        self._refresh_summary_flow_nodes()

    def set_selected_asset(self, asset_id: str | None) -> None:
        self.canvas.set_selected_asset(asset_id)

    def set_position(self, position_ms: int, *, repaint: bool, follow_playhead: bool) -> None:
        self.canvas.set_position(position_ms, repaint=repaint, follow_playhead=follow_playhead)
        if follow_playhead:
            self._sync_content_scrollbar()
            return None

    def select_adjacent_clip(self, step: int) -> None:
        clips = self.canvas.video_clips()
        if clips:
            current = selected_clip_id(self.state.values)
            if current:
                target = neighbor_clip(clips, current, step=int(step))
                if target is None:
                    return None
            else:
                target = clips[0] if int(step) >= 0 else clips[-1]
                persist_values_transform_to_selected_clip(self.state.values)
                set_selected_clip_id(self.state.values, target.id)
                self.canvas._selection_anchor_id = target.id
                apply_clip_transform_to_values(self.state.values, target)
                self.canvas.position_ms = int(target.timeline_start_ms)
                self.canvas.ensure_playhead_visible()
                self.canvas.update()
                self._sync_content_scrollbar()
                self.timelineClipSelected.emit(target.id)
                self.positionScrubbed.emit(int(target.timeline_start_ms))
                self.scrubFinished.emit(int(target.timeline_start_ms))
        else:
            return None

    def insert_video_clip_at_playhead(self, *, source_path: str, source_duration_ms: int, track_index: int, at_timeline_ms: int | None, keep_edit_focus: bool) -> bool:
        path = str(source_path or '').strip()
        if path:
            video = self.canvas._selected_video_asset()
            clips = self.canvas.video_clips()
            previous_clip_id = selected_clip_id(self.state.values)
            template = next((c for c in clips if clamp_track_index(c.track_index) == 0), None)
            if video is not None and (not clips_on_track(clips, 0)):
                clips = ensure_timeline_clips(self.state.values, source_duration_ms=max(1, int(video.duration_ms or 1)), source_path=str(video.path or ''))
                template = clips[0] if clips else None
            self.trimDragStarted.emit()
            pos = int(self.canvas.position_ms if at_timeline_ms is None else at_timeline_ms)
            built = insert_source_clip(clips, source_path=path, source_duration_ms=max(1, int(source_duration_ms or 1)), at_timeline_ms=pos, template=template, track_index=int(track_index))
            laid = write_clips(self.state.values, built)
            self.canvas._sync_track_overlays()
            chosen = None
            for clip in laid:
                if str(clip.source_path or '') == path and clamp_track_index(clip.track_index) == clamp_track_index(track_index) and (abs(clip.timeline_start_ms - pos) <= max(5, clip.duration_ms)):
                    chosen = clip
            if chosen is None and laid:
                chosen = laid[-1]
            steal_focus = not keep_edit_focus or not previous_clip_id
            if chosen is not None and steal_focus:
                set_selected_clip_id(self.state.values, chosen.id)
                apply_clip_transform_to_values(self.state.values, chosen)
                self.timelineClipSelected.emit(chosen.id)
            elif previous_clip_id:
                set_selected_clip_id(self.state.values, previous_clip_id)
                prev = next((clip for clip in laid if clip.id == previous_clip_id), None)
                if prev is not None:
                    apply_clip_transform_to_values(self.state.values, prev)
            self.trimChanged.emit(0, 0)
            self.canvas.clipsChanged.emit()
            self.canvas.update()
            return True
        return False

    def set_history_availability(self, can_undo: bool, can_redo: bool) -> None:
        self.undo_button.setEnabled(can_undo)
        self.redo_button.setEnabled(can_redo)

    def zoom_in(self) -> None:
        self.canvas.zoom_in()

    def zoom_out(self) -> None:
        self.canvas.zoom_out()

    def split_at_playhead(self) -> None:
        video = self.canvas._selected_video_asset()
        if video is None:
            return None
        clips = self.canvas.video_clips()
        if clips:
            position = int(self.canvas.position_ms)
            split = split_clip_at_timeline(clips, position, min_duration_ms=MIN_CLIP_DURATION_MS, track_index=None)
            if split is None:
                return None
            self.trimDragStarted.emit()
            laid = write_clips(self.state.values, split)
            hit_id = ''
            for clip in laid:
                if clip.timeline_start_ms <= position < clip.timeline_start_ms + clip.duration_ms:
                    hit_id = clip.id
                    break
            if hit_id:
                set_selected_clip_id(self.state.values, hit_id)
            self.trimChanged.emit(int(self.state.values.get('trim_start_ms', 0) or 0), int(self.state.values.get('trim_end_ms', 0) or 0))
            self.canvas.clipsChanged.emit()
            self.canvas.update()
            self.splitAtPlayheadRequested.emit()
        else:
            return None

    def set_scene_split_busy(self, busy: bool) -> None:
        self.scene_split_button.setEnabled(True)
        self.scene_split_button.setToolTip('Đang tách cảnh nền — vẫn soạn video mẫu được' if busy else 'Tách cảnh — video đang chọn hoặc tất cả video trong dự án')
        if not busy:
            self.scene_split_progress.hide()
            self.scene_split_progress.setValue(0)
            return None

    def set_scene_split_progress(self, done: int, total: int, label: str='') -> None:
        total_n = max(1, int(total or 1))
        done_n = max(0, min(int(done or 0), total_n))
        self.scene_split_progress.setRange(0, total_n)
        self.scene_split_progress.setValue(done_n)
        tip = label.strip() or f'Tách cảnh {done_n}/{total_n}'
        self.scene_split_progress.setToolTip(tip)
        self.scene_split_progress.setFormat('%v/%m')
        self.scene_split_progress.show()

    def _open_scene_split_menu(self) -> None:
        from PySide6.QtWidgets import QMenu
        menu = QMenu(self)
        one = menu.addAction('Tách cảnh — video đang chọn')
        one.setToolTip('Quét shot và cắt timeline của video mẫu đang mở')
        one.triggered.connect(lambda _checked=False: self.autoSceneSplitRequested.emit('one'))
        all_videos = menu.addAction('Tách cảnh — tất cả video trong dự án')
        all_videos.setToolTip('Chạy nền: giữ nguyên video mẫu đang soạn — chỉ hiện thanh tiến trình')
        all_videos.triggered.connect(lambda _checked=False: self.autoSceneSplitRequested.emit('all'))
        menu.exec(self.scene_split_button.mapToGlobal(self.scene_split_button.rect().bottomLeft()))

    def apply_auto_scene_cuts(self, cut_source_ms: list[int]) -> int:
        video = self.canvas._selected_video_asset()
        if video is not None and video.path:
            source_dur = max(1, int(video.duration_ms or 1))
            count = apply_scene_cuts_to_values(self.state.values, list(cut_source_ms or []), source_path=str(video.path or ''), source_duration_ms=source_dur)
            if count <= 0:
                return 0
            cut_list = list(cut_source_ms or [])
            if count > 1 or cut_list:
                self.trimDragStarted.emit()
                self.trimChanged.emit(0, 0)
                self.canvas.clipsChanged.emit()
                self.canvas.update()
            return count
        return 0

    def clear_trim(self) -> None:
        video = self.canvas._selected_video_asset()
        self.trimDragStarted.emit()
        self.state.values['trim_start_ms'] = 0
        self.state.values['trim_end_ms'] = 0
        self.state.values['timeline_clips'] = []
        if video is not None:
            ensure_timeline_clips(self.state.values, source_duration_ms=max(1, int(video.duration_ms or 1)), source_path=str(video.path or ''))
        self.trimChanged.emit(0, 0)
        self.canvas.clipsChanged.emit()
        self.canvas.update()

    def delete_selected_clip(self) -> None:
        clips = self.canvas.video_clips()
        if len(clips) <= 1:
            return None
        ids = selected_clip_ids(self.state.values)
        if ids:
            drop = {cid for cid in ids if find_clip(clips, cid) is not None}
            if not drop:
                return None
            if len(drop) >= len(clips):
                return None
            self.trimDragStarted.emit()
            remaining = delete_clips_ripple(clips, drop)
            if remaining:
                write_clips(self.state.values, remaining)
                primary = remaining[0].id
                set_selected_clip_ids(self.state.values, [primary], primary=primary)
                apply_clip_transform_to_values(self.state.values, remaining[0])
                self.trimChanged.emit(int(self.state.values.get('trim_start_ms', 0) or 0), int(self.state.values.get('trim_end_ms', 0) or 0))
                self.canvas.clipsChanged.emit()
                self.canvas.timelineClipSelected.emit(primary)
                self.canvas._sync_track_overlays()
                self.canvas.update()
            else:
                return None
        else:
            return None

    def copy_selected_clip(self) -> None:
        clips = self.canvas.video_clips()
        payload = clipboard_payload(clips, selected_clip_id(self.state.values))
        if payload is None:
            return None
        self.canvas._clip_clipboard = payload
        self.canvas._clipboard_kind = 'clip'

    def duplicate_selected_clip(self) -> None:
        clips = self.canvas.video_clips()
        ids = selected_clip_ids(self.state.values)
        if ids:
            working = list(clips)
            new_ids = []
            for clip_id in ids:
                duplicated = duplicate_clip_after(working, clip_id)
                if find_clip(working, clip_id) is None or duplicated is None:
                    pass
                else:
                    for index, clip in enumerate(duplicated):
                        if clip.id == clip_id and index + 1 < len(duplicated):
                            new_ids.append(duplicated[index + 1].id)
                    working = duplicated
            if new_ids:
                self.trimDragStarted.emit()
                laid = write_clips(self.state.values, working)
                primary = new_ids[-1]
                set_selected_clip_ids(self.state.values, new_ids, primary=primary)
                chosen = find_clip(laid, primary)
                if chosen is not None:
                    apply_clip_transform_to_values(self.state.values, chosen)
                    self.canvas.position_ms = int(chosen.timeline_start_ms)
                self.trimChanged.emit(int(self.state.values.get('trim_start_ms', 0) or 0), int(self.state.values.get('trim_end_ms', 0) or 0))
                self.canvas.clipsChanged.emit()
                self.canvas.timelineClipSelected.emit(primary)
                self.canvas._sync_track_overlays()
                self.canvas.update()
            else:
                return None
        else:
            return None

    def paste_clip(self) -> None:
        payload = self.canvas._clip_clipboard
        if isinstance(payload, dict):
            clips = self.canvas.video_clips()
            pasted = paste_clip_after(clips, payload, after_clip_id=selected_clip_id(self.state.values) or None)
            if pasted is None:
                return None
            self.trimDragStarted.emit()
            write_clips(self.state.values, pasted)
            self.trimChanged.emit(int(self.state.values.get('trim_start_ms', 0) or 0), int(self.state.values.get('trim_end_ms', 0) or 0))
            self.canvas.clipsChanged.emit()
            self.canvas.update()
        else:
            return None

    def request_stem_separation(self, mode: str='vocal') -> None:
        resolved = normalize_stem_mode(mode)
        changed = ensure_stems_requestable(self.state.values, resolved)
        if changed:
            self.mix_strip.sync_from_state()
            self.audioMixChanged.emit()
        self.mix_strip.stemsRequested.emit(resolved)

    def request_vocal_separation(self) -> None:
        self.request_stem_separation('vocal')

    def prompt_add_sfx_at_playhead(self) -> bool:
        return bool(self.canvas.prompt_add_sfx_at_playhead())

    def set_crop_tool_active(self, active: bool) -> None:
        self.crop_button.blockSignals(True)
        try:
            self.crop_button.setChecked(bool(active))
        finally:
            self.crop_button.blockSignals(False)

def _format_seconds(total_seconds: int) -> str:
    hours, remainder = (divmod(max(0, int(total_seconds)), 3600)[0], divmod(max(0, int(total_seconds)), 3600)[1])
    minutes, seconds = (divmod(remainder, 60)[0], divmod(remainder, 60)[1])
    return f'{minutes}02d:{seconds}02d' if hours else f':{seconds}02d'