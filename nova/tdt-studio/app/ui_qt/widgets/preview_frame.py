from __future__ import annotations
import math
import subprocess
import time
from pathlib import Path
from PySide6.QtCore import QObject, QPointF, QRect, QRectF, QRunnable, QThreadPool, QTimer, Qt, Signal
from PySide6.QtGui import QResizeEvent
from PySide6.QtGui import QColor, QFont, QFontMetrics, QImage, QKeyEvent, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap, QTransform
from PySide6.QtWidgets import QApplication, QMenu, QWidget
from config import FFMPEG_PATH
from ui_qt.preview_clipboard import has_clipboard
from ui_qt.subtitle_preview_burn import apply_burn_drag_margin, hit_burn_drag_kind
from core.subtitles import SubtitleSegment
from core.lut_stack import apply_lut_stack_qimage, lut_stack_fingerprint
from core.video_look import PAN_MOTIONS, apply_color_filter_qimage, apply_overlay_blend_qimage, layer_uses_blend, pan_offsets_px, qt_composition_mode
from core.motion import auto_zoom_boost_at, gradual_zoom_boost, motion_intensity_factor, shake_offsets_px
from core.text_layout import ass_glyph_style, cap_play_res_block_height_px, estimate_max_chars_for_box, estimate_overlay_box_height_norm, estimate_text_block_height_px, subtitle_block_center_y, subtitle_lines_at_cue_position, estimate_subtitle_max_chars, estimate_subtitle_max_words, wrap_subtitle_lines, wrap_text_for_box, wrap_text_lines
from core.video_export import resolve_crop_norm, resolve_foreground_pixel_size, resolve_scale_xy, resolve_target_size
from ui_qt.blur_zones import ensure_blur_zones, sync_controls_from_selected_blur
from ui_qt.layer_timing import layer_active_at
from ui_qt.blend_layers import blend_layers_master_enabled, ensure_blend_layers, exportable_blend_layers, selected_blend_layer, sync_flat_keys_from_selected_blend, update_selected_blend_layer
from ui_qt.background_layers import background_layer_uses_cover, background_layers_master_enabled, ensure_background_layers, exportable_background_layers, selected_background_layer, sync_flat_keys_from_selected_background, update_selected_background_layer
from ui_qt.media_overlays import ensure_media_overlays, is_image_overlay_path, is_video_overlay_path, media_overlays_master_enabled, selected_media_overlay, sync_flat_keys_from_selected, sync_selected_from_flat_keys, update_selected_media_overlay
from ui_qt.state import ProjectState
from ui_qt.timeline_track_state import track_edit_locked, track_preview_hidden
from ui_qt.video_title import clamp_box_center_norms, resolve_text_position_norms, resolve_video_title
from ui_qt.workers.layer_strip_preview import LayerStrip, LayerStripBuildRunnable, LayerStripEmitter, get_cached_strip, is_strip_building
CREATE_NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
ASPECT_RATIOS = {'9:16': 0.5625, '16:9': 1.7777777777777777, '1:1': 1.0, '4:5': 0.8, '3:4': 0.75, '2:3': 0.6666666666666666, '21:9': 2.3333333333333335}
_OVERLAY_PREVIEW_BUCKET_PLAY_MS = 560
_OVERLAY_PREVIEW_BUCKET_PLAY_BG_MS = 900
_OVERLAY_PREVIEW_BUCKET_PAUSE_MS = 1000
_PLAYBACK_PROXY_MAX_EDGE = 1080
_OVERLAY_DECODE_EDGE = 1440
_BACKGROUND_DECODE_EDGE = 1440
_overlay_video_duration_cache: 'dict[str, int]' = {}

def _overlay_video_duration_ms(path: str) -> int:
    cached = _overlay_video_duration_cache.get(path)
    if cached is not None:
        return cached
    duration_ms = 0
    try:
        from config import FFPROBE_PATH
        completed = subprocess.run([FFPROBE_PATH, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], capture_output=True, text=True, encoding='utf-8', errors='replace', check=False, creationflags=CREATE_NO_WINDOW)
        if completed.returncode == 0 and completed.stdout.strip():
            duration_ms = max(0, int(float(completed.stdout.strip()) * 1000))
    except (OSError, ValueError):
        duration_ms = 0
    _overlay_video_duration_cache[path] = duration_ms
    return duration_ms

def _extract_overlay_video_frame(path: str, position_ms: int=0, *, max_edge: int) -> QImage:
    sample_ms = max(0, int(position_ms))
    duration_ms = _overlay_video_duration_ms(path)
    if duration_ms > 0:
        sample_ms = sample_ms % duration_ms
    try:
        ss_sec = max(0.0, sample_ms / 1000.0)
        from ui_qt.playback import clamp_preview_decode_width
        edge = clamp_preview_decode_width(int(max_edge or _OVERLAY_DECODE_EDGE))
        completed = FFMPEG_PATH(['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', ss_sec, '.3f', '-i', path, '-an', '-sn', '-frames:v', '1', '-vf', f"scale='min({edge},iw)':-2", '-f', 'mjpeg', '-q:v', '3', 'pipe:1'], capture_output=True, check=False, creationflags=CREATE_NO_WINDOW)
        image = QImage.fromData(completed.stdout, 'JPG')
        if completed.returncode != 0 or not completed.stdout or image.isNull():
            return QImage()
    except OSError:
        return QImage()

class OverlayFrameLoadEmitter(QObject):
    loaded = Signal(str, str, object)

class OverlayFrameLoadRunnable(QRunnable):

    def __init__(self, path: str, position_ms: int, cache_key: str, cache_name: str, emitter: OverlayFrameLoadEmitter, *, max_edge: int):
        super().__init__()
        self._path = path
        self._position_ms = position_ms
        self._cache_key = cache_key
        self._cache_name = cache_name
        self._emitter = emitter
        self._max_edge = max_edge

    def run(self) -> None:
        image = _extract_overlay_video_frame(self._path, self._position_ms, max_edge=self._max_edge)
        self._emitter.loaded.emit(self._cache_key, self._cache_name, image)

class PreviewFrameWidget(QWidget):
    subtitlePlacementChanged = Signal(str, int)
    subtitleFontSizeChanged = Signal(int)
    subtitleScaleChanged = Signal(int, int)
    subtitleBoxWidthChanged = Signal(int)
    blurZonesChanged = Signal()
    logoPlacementChanged = Signal(float, float)
    logoScaleChanged = Signal(int)
    effectOverlayChanged = Signal(float, float, int)
    overlayMaskChanged = Signal(int, int, str)
    blendLayerChanged = Signal(float, float, int)
    backgroundLayerChanged = Signal(float, float, int)
    videoTitlePlacementChanged = Signal(float, float)
    videoTitleLayoutChanged = Signal(float, float, int, int)
    videoTitleBoxWidthChanged = Signal(int)
    textOverlayPlacementChanged = Signal(float, float)
    textOverlayLayoutChanged = Signal(float, float, int, float)
    videoTransformChanged = Signal(int, int, int, int)
    videoCropChanged = Signal(int, int, int, int)
    previewDeleteRequested = Signal(str)
    previewCopyRequested = Signal(str)
    displaySizeChanged = Signal(int)
    previewPasteRequested = Signal()
    previewDuplicateRequested = Signal(str)
    previewSelectionChanged = Signal(str)
    previewLayerRotationChanged = Signal(str, float)
    editGestureStarted = Signal()
    _CORNER_OPPOSITE = {'tl': 'br', 'tr': 'bl', 'bl': 'tr', 'br': 'tl'}
    _SNAP_CENTER_NORM = 0.018
    _SNAP_EDGE_NORM = 0.022
    _SNAP_ROTATION_DEG = 2.0
    _VIEW_ZOOM_MIN = 0.15
    _VIEW_ZOOM_MAX = 4.0
    _VIEW_ZOOM_FIT_SNAP = 0.045

    def __init__(self, state: ProjectState, parent: QWidget | None=None):
        super().__init__(parent)
        self.state = state
        self._frame = QImage()
        self.logo_image = QImage()
        self.effect_overlay_image = QImage()
        self.overlay_preview_images = {}
        self.blend_preview_images = {}
        self.background_preview_images = {}
        self._blend_underlay = None
        self._overlay_load_emitter = OverlayFrameLoadEmitter(self)
        self._overlay_load_emitter.loaded.connect(self._on_overlay_frame_loaded)
        self._overlay_load_in_flight = set()
        self._overlay_load_targets = {}
        self._overlay_thread_pool = QThreadPool(self)
        self._overlay_thread_pool.setObjectName('vtpOverlayPreviewPool')
        self._overlay_thread_pool.setMaxThreadCount(2)
        self._overlay_repaint_armed = False
        self._layer_strip_by_path = {}
        self._layer_strip_emitter = LayerStripEmitter(self)
        self._layer_strip_emitter.ready.connect(self._on_layer_strip_ready)
        self._layer_strip_queued = set()
        self.position_ms = 0
        self.last_subtitle_rect = QRectF()
        self.last_subtitle_source_rect = QRectF()
        self.last_blur_rects = []
        self.last_blur_layout_rects = []
        self.last_logo_rect = QRectF()
        self.last_logo_layout_rect = QRectF()
        self.last_effect_overlay_rect = QRectF()
        self.last_overlay_rects = []
        self.last_blend_rect = QRectF()
        self.last_blend_rects = []
        self.last_background_rect = QRectF()
        self.last_background_rects = []
        self.blend_layer_image = QImage()
        self.last_video_title_rect = QRectF()
        self.last_text_overlay_rect = QRectF()
        self.last_video_rect = QRectF()
        self.last_crop_rect = QRectF()
        self._still_frame_size = None
        self.selected_subtitle_text = ''
        self.selected_subtitle_start_ms = 0
        self.selected_subtitle_end_ms = 0
        self._export_busy = False
        self._hover_kind = ''
        self._hover_mode = ''
        self._selection = ''
        self._dragging_subtitle = False
        self._subtitle_drag_mode = 'move'
        self._subtitle_drag_layer = 'working'
        self._subtitle_drag_offset_y = 0.0
        self._live_subtitle_top_norm = None
        self._subtitle_resize_start_dist = 0.0
        self._subtitle_resize_start_font = 48
        self._subtitle_scale_start_x = 100
        self._subtitle_scale_start_y = 100
        self._subtitle_scale_start_half_w = 40.0
        self._subtitle_scale_start_half_h = 40.0
        self._subtitle_scale_center_x = 0.0
        self._subtitle_scale_center_y = 0.0
        self._pending_subtitle_placement = None
        self._pending_subtitle_font_size = None
        self._pending_subtitle_scale = None
        self._pending_subtitle_box_width = None
        self._subtitle_box_start_percent = 90
        self._subtitle_anchor_y_norm = None
        self._live_subtitle_box_w_norm = None
        self._live_subtitle_font_size = None
        self._subtitle_show_longest = False
        self._dragging_blur = False
        self._blur_drag_mode = ''
        self._blur_drag_index = 0
        self._blur_drag_offset_y = 0.0
        self._blur_drag_offset_x = 0.0
        self._dragging_logo = False
        self._logo_drag_mode = 'move'
        self._logo_drag_offset_x = 0.0
        self._logo_drag_offset_y = 0.0
        self._pending_logo_placement = None
        self._pending_logo_scale = None
        self._dragging_overlay = False
        self._overlay_drag_mode = 'move'
        self._overlay_drag_offset_x = 0.0
        self._overlay_drag_offset_y = 0.0
        self._pending_effect_overlay = None
        self._pending_overlay_mask = None
        self._dragging_blend = False
        self._blend_drag_mode = 'move'
        self._blend_drag_offset_x = 0.0
        self._blend_drag_offset_y = 0.0
        self._pending_blend_layer = None
        self._dragging_background = False
        self._background_drag_mode = 'move'
        self._pending_background_layer = None
        self.background_layer_image = QImage()
        self._layer_drag_start_x_norm = 0.5
        self._layer_drag_start_y_norm = 0.5
        self._layer_drag_start_px = 0.0
        self._layer_drag_start_py = 0.0
        self._layer_drag_lock_aspect = 0.0
        self._layer_drag_half_w_norm = 0.0
        self._layer_drag_half_h_norm = 0.0
        self._dragging_rotation = False
        self._rotation_kind = ''
        self._rotation_start_pointer_angle = 0.0
        self._rotation_start_degrees = 0.0
        self._rotation_pivot_x = 0.0
        self._rotation_pivot_y = 0.0
        self._pending_layer_rotation = None
        self._dragging_title = False
        self._title_drag_mode = 'move'
        self._title_drag_offset_x = 0.0
        self._title_drag_offset_y = 0.0
        self._title_scale_start_x = 100
        self._title_scale_start_y = 100
        self._title_scale_start_half_w = 40.0
        self._title_scale_start_half_h = 40.0
        self._title_scale_center_x = 0.0
        self._title_scale_center_y = 0.0
        self._pending_title_placement = None
        self._pending_title_layout = None
        self._pending_title_box_width = None
        self._title_box_start_percent = 92
        self._title_scale_start_percent = 100
        self._title_anchor_y_norm = None
        self._live_title_box_w_norm = None
        self._live_title_scale_percent = None
        self._title_resize_start_dist = 0.0
        self._title_measure_cache = None
        self._dragging_text_overlay = False
        self._text_overlay_drag_mode = 'move'
        self._text_overlay_drag_offset_x = 0.0
        self._text_overlay_drag_offset_y = 0.0
        self._text_scale_start = 100
        self._text_box_start = 0.9
        self._text_scale_start_half = 40.0
        self._text_box_start_half_w = 40.0
        self._text_scale_center_x = 0.0
        self._text_scale_center_y = 0.0
        self._text_anchor_y_norm = None
        self._live_text_box_w_norm = None
        self._live_text_scale_percent = None
        self._text_resize_start_dist = 0.0
        self._pending_text_overlay_placement = None
        self._pending_text_overlay_layout = None
        self._text_measure_cache = None
        self._layer_drag_base = None
        self._capturing_drag_base = False
        self._suppress_text_overlay_paint = False
        self._text_move_layout_cache = None
        self._text_selected_rect = QRectF()
        self._subtitle_measure_cache = None
        self._cached_blur_bg = None
        self._cached_blur_key = None
        self._cached_blur_pixmap = None
        self._processed_frame_cache = None
        self._processed_frame_key = None
        self._frame_settings_fp = None
        self._mirrored_frame = None
        self._mirrored_frame_key = None
        self._playback_active = False
        self._scrubbing_preview = False
        self._last_frame_paint_at = 0.0
        self._playback_video_pixmap = None
        self._playback_video_pixmap_key = None
        self._xfade_hold_pixmap = None
        self._corner_scale_anchor_x = 0.0
        self._corner_scale_anchor_y = 0.0
        self._corner_scale_start_dist = 8.0
        self._corner_scale_start_percent = 100
        self._corner_scale_name = 'br'
        self._corner_scale_rotation_deg = 0.0
        self._corner_scale_center_x = 0.0
        self._corner_scale_center_y = 0.0
        self._corner_scale_start_aspect = 1.0
        self._dragging_video = False
        self._edit_gesture_history_pushed = False
        self._video_drag_mode = 'move'
        self._video_drag_last_x = 0.0
        self._video_drag_last_y = 0.0
        self._video_scale_start_dist = 0.0
        self._video_scale_start_x = 100
        self._video_scale_start_y = 100
        self._video_scale_start_half_w = 40.0
        self._video_scale_start_half_h = 40.0
        self._pending_video_transform = None
        self._dragging_crop = False
        self._crop_tool_active = False
        self._crop_drag_mode = 'move'
        self._crop_drag_origin = (0.0, 0.0, 1.0, 1.0)
        self._pending_video_crop = None
        self._view_zoom = 1.0
        self._view_pan_x = 0.0
        self._view_pan_y = 0.0
        self._dragging_view_pan = False
        self._dragging_navigator = False
        self._view_pan_drag_last = (0.0, 0.0)
        self._navigator_drag_last = (0.0, 0.0)
        self._guide_snap_v = False
        self._guide_snap_h = False
        self._guide_snap_video = False
        self._guide_show_center = False
        self._guide_snap_rotation = False
        self.setMinimumSize(160, 80)
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.FocusPolicy.ClickFocus)
        self.refresh_settings()

    @property
    def has_frame(self) -> bool:
        return not self._frame.isNull()

    @property
    def output_ratio(self) -> float:
        value = str(self.state.values.get('aspect_ratio', '9:16')).strip()
        if value in ASPECT_RATIOS:
            return ASPECT_RATIOS[value]
        if ':' in value:
            left, right = (value.split(':', 1)[0], value.split(':', 1)[1])
            try:
                width = float(left)
                height = float(right)
                if width <= 0 or height <= 0:
                    return 0.5625
            except ValueError:
                return 0.5625
        else:
            return 0.5625

    def set_playback_active(self, active: bool) -> None:
        self._playback_active = bool(active)
        self._playback_video_pixmap = None
        self._playback_video_pixmap_key = None
        if self._playback_active:
            self._ensure_playback_layer_strips()
            if not self._playback_layer_strips_ready():
                self._refresh_video_overlay_preview_frames()
                self._refresh_blend_layer_preview_frames()
                self._refresh_background_layer_preview_frames()
                return None
        else:
            self._cached_blur_bg = None
            self._cached_blur_key = None
            self._cached_blur_pixmap = None
            self._last_frame_paint_at = 0.0
            return None

    def _iter_active_video_layer_paths(self) -> list[tuple[str, str]]:
        values = self.state.values
        out = []
        if background_layers_master_enabled(values):
            for item in ensure_background_layers(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and path and Path(path).is_file() and is_video_overlay_path(path):
                    out.append(('background', path))
        if blend_layers_master_enabled(values):
            for item in ensure_blend_layers(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and path and Path(path).is_file() and is_video_overlay_path(path):
                    out.append(('blend', path))
        if media_overlays_master_enabled(values):
            for item in ensure_media_overlays(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and path and Path(path).is_file() and is_video_overlay_path(path):
                    out.append(('overlay', path))
        return out

    def _playback_layer_strips_ready(self) -> bool:
        paths = self._iter_active_video_layer_paths()
        if paths:
            for _cache, path in paths:
                strip = self._layer_strip_by_path.get(path) or get_cached_strip(path)
                if strip is not None and strip.frames:
                    continue
                return False
        return True

    def _ensure_playback_layer_strips(self) -> None:
        for _cache, path in self._iter_active_video_layer_paths():
            cached = get_cached_strip(path)
            if cached is not None:
                self._layer_strip_by_path[path] = cached
            elif path in self._layer_strip_by_path or path in self._layer_strip_queued or is_strip_building(path):
                pass
            else:
                self._layer_strip_queued.add(path)
                self._overlay_thread_pool.start(LayerStripBuildRunnable(path, self._layer_strip_emitter))

    def _on_layer_strip_ready(self, path: str, strip: object) -> None:
        self._layer_strip_queued.discard(str(path))
        if isinstance(strip, LayerStrip):
            if strip.frames:
                self._layer_strip_by_path[str(path)] = strip
                if self._playback_active:
                    self.update()
            return None

    def _strip_frame_for_path(self, path: str, layer: dict | None=None) -> QImage | None:
        strip = self._layer_strip_by_path.get(path) or get_cached_strip(path)
        if strip is not None and strip.frames:
            if path not in self._layer_strip_by_path:
                self._layer_strip_by_path[path] = strip
            sample = self._overlay_video_sample_ms(layer, path=path)
            return strip.frame_at(sample)

    def set_scrubbing(self, active: bool) -> None:
        active = bool(active)
        if self._scrubbing_preview == active:
            return None
        self._scrubbing_preview = active
        if not active:
            self._playback_video_pixmap = None
            self._playback_video_pixmap_key = None
            if media_overlays_master_enabled(self.state.values):
                self._refresh_video_overlay_preview_frames()
            if blend_layers_master_enabled(self.state.values):
                self._refresh_blend_layer_preview_frames()
            if not self._playback_active and background_layers_master_enabled(self.state.values):
                self._refresh_background_layer_preview_frames()
            self.update()
            return None

    def _refresh_layer_frames_for_playhead(self) -> None:
        if self._dragging_overlay or self._dragging_blend or self._dragging_background:
            return None
        if media_overlays_master_enabled(self.state.values):
            self._refresh_video_overlay_preview_frames()
        if blend_layers_master_enabled(self.state.values):
            self._refresh_blend_layer_preview_frames()
        if background_layers_master_enabled(self.state.values):
            self._refresh_background_layer_preview_frames()
            return None

    def _align_incoming_frame(self, image: QImage) -> QImage:
        if image is None or image.isNull():
            pass
        else:
            width = int(image.width() or 0)
            height = int(image.height() or 0)
            if width < 2 or height < 2:
                pass
            else:
                playing = bool(self._playback_active or getattr(self, '_scrubbing_preview', False))
                if playing:
                    ref = self._still_frame_size
                    if ref is None:
                        return image
                    ref_h, ref_w = (int(ref[1]), int(ref[0]))
                    return image if ref_w < 2 or ref_h < 2 else image if (width > height) == (ref_w > ref_h) else image.transformed(QTransform().rotate(90))
                self._still_frame_size = (width, height)
        return image

    def set_frame(self, image: QImage) -> None:
        if image is None or image.isNull():
            return None
        image = self._align_incoming_frame(image)
        self._frame = image
        self._mirrored_frame = None
        self._mirrored_frame_key = None
        self._playback_video_pixmap = None
        self._playback_video_pixmap_key = None
        if self._playback_active or self._scrubbing_preview:
            now = time.monotonic()
            min_gap = 0.16 if self._scrubbing_preview else 0.055 if self._playback_layer_pressure() >= 3 else 0.04
            last = float(self._last_frame_paint_at or 0.0)
            if now - last < min_gap:
                pending = getattr(self, '_scrub_paint_armed', False)
                if not pending:
                    self._scrub_paint_armed = True
                    delay_ms = max(1, int((min_gap - (now - last)) * 1000))
                    QTimer.singleShot(delay_ms, self._flush_scrub_frame_paint)
                return None
            self._last_frame_paint_at = now
            self._scrub_paint_armed = False
        else:
            self.update()

    def _flush_scrub_frame_paint(self) -> None:
        self._scrub_paint_armed = False
        self._last_frame_paint_at = time.monotonic()
        self.update()

    def clear_frame(self) -> None:
        self._frame = QImage()
        self._still_frame_size = None
        self._invalidate_preview_frame_caches()
        self.update()

    def _invalidate_preview_frame_caches(self) -> None:
        self._cached_blur_bg = None
        self._cached_blur_key = None
        self._cached_blur_pixmap = None
        self._processed_frame_cache = None
        self._processed_frame_key = None
        self._frame_settings_fp = None

    def _frame_processing_fingerprint(self, values: dict) -> tuple:
        return (bool(values.get('crop_enabled')), self._crop_norm_values(), str(values.get('color_filter', 'none')), int(values.get('color_filter_strength', 70) or 0), lut_stack_fingerprint(values.get('color_lut_stack'), master=bool(values.get('color_lut_stack_master_enabled', True))), str(values.get('background', 'black')), round(float(values.get('background_blur_strength', 40) or 40), 3), bool(values.get('mirror_enabled')), self._clip_warp_xy(values), str(values.get('preview_workspace_theme', 'dark')), str(values.get('preview_workspace_color', '')), str(values.get('preview_canvas_color', '')), bool(values.get('preview_pasteboard_enabled', True)))

    def _sync_frame_settings_fingerprint(self, values: dict) -> None:
        fp = self._frame_processing_fingerprint(values)
        if fp != self._frame_settings_fp:
            self._frame_settings_fp = fp
            self._invalidate_preview_frame_caches()
            return None

    def _preview_subtitle_document(self):
        try:
            from core.av_sync import resolve_voice_locked_document
            locked = resolve_voice_locked_document(self.state.subtitles, self.state.values, time_divisor=1.0)
            if locked is None or not locked.segments:
                return self.state.subtitles
        except Exception:
            return self.state.subtitles

    def _preview_uses_voice_subtitle_clock(self) -> bool:
        values = self.state.values
        if bool(values.get('voice_audio_enabled')):
            voice_path = str(values.get('voice_audio_path') or '').strip()
            if voice_path:
                try:
                    from core.av_sync import load_tts_cues_sidecar, prefer_voice_locked_subtitles
                    if not prefer_voice_locked_subtitles(tts_fit_mode=str(values.get('tts_fit_mode', 'stretch_video') or ''), voice_enabled=True, voice_path=voice_path):
                        return False
                    if bool(values.get('subtitle_voice_locked')):
                        return True
                except Exception:
                    return False
            else:
                return False
        else:
            return False

    def _preview_subtitle_clock_ms(self) -> int:
        pos = int(self.position_ms)
        if self._preview_uses_voice_subtitle_clock():
            values = self.state.values
            voice_dur = int(values.get('voice_audio_duration_ms', 0) or 0)
            voice_path = str(values.get('voice_audio_path') or '').strip()
            if voice_dur <= 0 and voice_path:
                try:
                    from services_media import probe_audio_duration_ms
                    voice_dur = int(probe_audio_duration_ms(voice_path) or 0)
                    if voice_dur > 0:
                        values['voice_audio_duration_ms'] = voice_dur
                except Exception:
                    voice_dur = 0
            source_dur = self._source_clip_duration_ms()
            try:
                from core.av_sync import preview_voice_seek_ms
            except Exception:
                return pos
        else:
            return pos

    @property
    def active_subtitle_text(self) -> str:
        if self.selected_subtitle_text:
            return self.selected_subtitle_text
        if self.state.values.get('subtitle_enabled'):
            trim_start = int(self.state.values.get('trim_start_ms', 0) or 0)
            trim_end = int(self.state.values.get('trim_end_ms', 0) or 0)
            doc = self._preview_subtitle_document()
            use_trim = doc is self.state.subtitles and (not self._preview_uses_voice_subtitle_clock())
            segment = doc.active_at_source_position(self._preview_subtitle_clock_ms(), trim_start_ms=trim_start if use_trim else 0, trim_end_ms=trim_end if use_trim else 0)
            return segment.text if segment is not None else ''
        return ''

    def _source_clip_duration_ms(self) -> int:
        selected = getattr(self.state, 'selected_id', None)
        for asset in self.state.assets:
            if asset.id == selected and asset.duration_ms:
                return max(1, int(asset.duration_ms))
        for asset in self.state.assets:
            if asset.kind == 'video' and asset.duration_ms:
                return max(1, int(asset.duration_ms))
        trim_end = int(self.state.values.get('trim_end_ms', 0) or 0)
        return trim_end if trim_end > 0 else max(self.position_ms + 1, 1)

    def _layer_visible_at(self, start_ms: int, end_ms: int) -> bool:
        return layer_active_at(self.position_ms, int(start_ms or 0), int(end_ms or 0), self._source_clip_duration_ms())

    def _longest_subtitle_text(self) -> str:
        longest = ''
        for segment in self.state.subtitles.segments:
            if len(segment.text) > len(longest):
                longest = segment.text
        return longest if longest else 'Đây là phụ đề mẫu để bạn căn chỉnh chiều rộng vị trí và kích thước phụ đề trên video trước khi tạo nội dung chính'

    def _subtitle_aspect_ratio(self) -> str:
        return str(self.state.values.get('aspect_ratio', '9:16') or '9:16')

    def _wrap_subtitle_layout_lines(self, text: str, play_w: int, box_w_norm: float, *, scale_x_percent: int, font_size_px: float | None) -> list[str]:
        aspect = self._subtitle_aspect_ratio()
        max_chars = estimate_subtitle_max_chars(play_w, box_w_norm, aspect_ratio=aspect, scale_x_percent=scale_x_percent, font_size_px=font_size_px, text=text)
        max_words = estimate_subtitle_max_words(box_w_norm, aspect_ratio=aspect, scale_x_percent=scale_x_percent)
        lines = wrap_subtitle_lines(text, max_chars, max_lines=None, max_words=max_words)
        return lines or [str(text or '')]

    def _corner_scale_cursor(self, corner: str) -> Qt.CursorShape:
        return Qt.CursorShape.SizeFDiagCursor if str(corner or '').lower() in frozenset({'tl', 'br'}) else Qt.CursorShape.SizeBDiagCursor

    def _subtitle_box_width_norm(self, values: dict) -> float:
        return max(0.15, min(1.0, float(self._live_subtitle_box_w_norm))) if self._live_subtitle_box_w_norm is not None else max(0.15, min(1.0, int(values.get('subtitle_box_width_percent', 90) or 90) / 100.0))

    def _subtitle_wrap_box_norm(self, values: dict, font_px: float) -> float:
        box = self._subtitle_box_width_norm(values)
        layout_font = float(values.get('subtitle_layout_font_size') or 48)
        layout_font = max(1.0, layout_font)
        return max(0.05, box * (max(1.0, float(font_px)) / layout_font))

    def _title_box_width_norm(self, values: dict) -> float:
        return max(0.15, min(1.0, float(self._live_title_box_w_norm))) if self._live_title_box_w_norm is not None else max(0.15, min(1.0, int(values.get('video_title_box_width_percent', 92) or 92) / 100.0))

    def _title_wrap_box_norm(self, values: dict, scale_pct: float) -> float:
        box = self._title_box_width_norm(values)
        layout_s = float(values.get('video_title_layout_scale_percent') or 100)
        layout_s = max(20.0, layout_s)
        return max(0.05, box * (max(20.0, float(scale_pct)) / layout_s))

    def _text_box_width_norm(self, values: dict) -> float:
        return max(0.15, min(1.0, float(self._live_text_box_w_norm))) if self._live_text_box_w_norm is not None else max(0.15, min(1.0, int(values.get('text_overlay_box_width_percent', 90) or 90) / 100.0))

    def _text_wrap_box_norm(self, values: dict, scale_pct: float) -> float:
        box = self._text_box_width_norm(values)
        layout_s = float(values.get('text_overlay_layout_scale_percent') or 100)
        layout_s = max(20.0, layout_s)
        return max(0.05, box * (max(20.0, float(scale_pct)) / layout_s))

    def _title_display_scale_percent(self, values: dict) -> float:
        return float(self._live_title_scale_percent) if self._live_title_scale_percent is not None else float(int(values.get('video_title_scale_percent', values.get('video_title_scale_x_percent', 100)) or 100))

    def _text_display_scale_percent(self, values: dict) -> float:
        return float(self._live_text_scale_percent) if self._live_text_scale_percent is not None else float(int(values.get('text_overlay_scale_percent', 100) or 100))

    def _measure_text_block_rect(self, font: QFont, display: str, max_width: float, flags: Qt.AlignmentFlag) -> QRectF:
        metrics = QFontMetrics(font)
        bound = metrics.boundingRect(QRect(0, 0, max(8, int(max_width)), 10000), int(flags), display)
        lines = [line for line in str(display or '').split('\n') if line]
        if not lines:
            lines = [str(display or '')]
        line_w = max((metrics.horizontalAdvance(line) for line in lines))
        outline_pad = max(2.0, float(font.pixelSize()) * 0.08)
        return QRectF(float(bound.x()), float(bound.y()), float(max(bound.width(), line_w) + outline_pad * 2), float(max(1, bound.height())))

    def _subtitle_display_font_size(self, values: dict) -> float:
        return float(self._live_subtitle_font_size) if self._live_subtitle_font_size is not None else float(int(values.get('subtitle_font_size', 48) or 48))

    def preview_motion_active(self) -> bool:
        values = self.state.values
        if self._animated_overlay_layers_active(values):
            pass
        else:
            motion = str(values.get('motion', 'still'))
            if motion not in frozenset({'', 'none', 'still'}) and motion_intensity_factor(int(values.get('motion_intensity_percent', 50) or 50)) > 0:
                pass
            elif values.get('auto_zoom_enabled'):
                pass
            else:
                effect = str(values.get('video_effect', 'none'))
                if effect not in frozenset({'', 'none', 'custom'}):
                    pass
                else:
                    try:
                        from core.timeline_transitions import effective_transition_ms
                        if effective_transition_ms(values) > 0:
                            from core.timeline_clips import clips_from_values, clips_on_track
                            if len(clips_on_track(clips_from_values(values), 0)) >= 2:
                                pass
                        else:
                            return False
                    except Exception:
                        return False
        return True

    def set_export_busy(self, busy: bool) -> None:
        self._export_busy = bool(busy)

    def _animated_overlay_layers_active(self, values: dict) -> bool:
        if blend_layers_master_enabled(values):
            for item in ensure_blend_layers(values):
                path = str(item.get('path', '') or '')
                if item.get('enabled', True) and path and Path(path).is_file() and is_video_overlay_path(path) and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    return True
            if media_overlays_master_enabled(values):
                for item in ensure_media_overlays(values):
                    path = str(item.get('path', '') or '')
                    if item.get('enabled', True) and path and Path(path).is_file() and is_video_overlay_path(path) and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                        return True
                return False

    def _media_overlays_visible_at_playhead(self, values: dict) -> bool:
        if media_overlays_master_enabled(values):
            for item in ensure_media_overlays(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and path and Path(path).is_file() and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    return True
        return False

    def _playback_decorations_active(self, values: dict) -> bool:
        if self._selection:
            return True
        if int(values.get('border_pixels', 0) or 0) > 0:
            return True
        effect = str(values.get('video_effect', 'none') or 'none')
        return True if effect not in frozenset({'', 'none', 'custom'}) else True if values.get('logo_enabled') and (not self.logo_image.isNull()) and self._layer_visible_at(int(values.get('logo_start_ms', 0) or 0), int(values.get('logo_end_ms', 0) or 0)) else True if values.get('video_title_enabled') else True if str(values.get('text_overlay_content', '') or '').strip() else True if self.selected_subtitle_text else True if self.active_subtitle_text else False

    def _playback_layer_pressure(self) -> int:
        values = self.state.values
        n = 0
        if str(values.get('background', 'black')) == 'blur':
            n += 1
        if self._background_layers_active(values):
            n += 1
        if blend_layers_master_enabled(values):
            n += sum((1 for item in ensure_blend_layers(values)))
        if media_overlays_master_enabled(values):
            n += sum((1 for item in ensure_media_overlays(values) if item.get('enabled', True) and (not item.get('preview_hidden')) and Path(str(item.get('path', ''))).is_file()))
        if values.get('logo_enabled') and (not self.logo_image.isNull()):
            n += 1
        if values.get('blur_zone_enabled'):
            n += 1
        if values.get('subtitle_enabled'):
            n += 1
        if values.get('video_title_enabled'):
            n += 1
        if str(values.get('text_overlay_content', '') or '').strip():
            n += 1
        return n

    def _playback_full_paint_required(self, values: dict) -> bool:
        return False

    def _playback_fast_paint_eligible(self, values: dict) -> bool:
        scrubbing = bool(getattr(self, '_scrubbing_preview', False))
        return False if not self._playback_active and (not scrubbing) or self._is_crop_editing() else False if abs(float(self._view_zoom) - 1.0) > 0.02 else False if self._dragging_subtitle or self._dragging_title or self._dragging_text_overlay or self._dragging_logo or self._dragging_overlay or self._dragging_blend or self._dragging_blur or self._dragging_crop or self._dragging_video else True

    def _ensure_playback_blur_cache(self, target: QRectF, values: dict) -> None:
        if str(values.get('background', 'black')) != 'blur':
            return None
        strength = max(0.0, min(1.0, float(values.get('background_blur_strength', 40)) / 100))
        freeze = self._playback_active or self._scrubbing_preview
        bucket = 'play' if freeze else id(self._frame)
        if freeze and (not self._scrubbing_preview):
            bucket = ('play', int(self.position_ms // 500))
        blur_key = (bucket, int(target.width()), int(target.height()), round(strength, 3), bool(values.get('mirror_enabled')))
        if self._cached_blur_bg is not None and self._cached_blur_key == blur_key and (self._cached_blur_pixmap is not None):
            return None
        bg = self._blurred_background_frame(target, strength)
        self._cached_blur_bg = bg
        self._cached_blur_key = blur_key
        self._cached_blur_pixmap = QPixmap.fromImage(bg)

    def _compute_still_video_rect(self, target: QRectF, values: dict, frame: QImage) -> QRectF:
        active = self._cropped_frame(frame)
        sx, sy = (self._current_scale_xy()[0], self._current_scale_xy()[1])
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        fg_w, fg_h = (resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[0], resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[1])
        preview_scale_x = target.width() / max(1, ref_w)
        preview_scale_y = target.height() / max(1, ref_h)
        fit_w = fg_w * preview_scale_x
        fit_h = fg_h * preview_scale_y
        offset_x = float(values.get('offset_x', 0)) * preview_scale_x
        offset_y = float(values.get('offset_y', 0)) * preview_scale_y
        video_center_x = target.center().x() + offset_x
        video_center_y = target.center().y() + offset_y
        return QRectF(video_center_x - fit_w / 2, video_center_y - fit_h / 2, fit_w, fit_h)

    def _face_plate_preview_clip(self, target: QRectF, values: dict, *, source_width: int, source_height: int) -> QRectF | None:
        from core.face_reframe import plate_rect_on_canvas, should_clip_video_to_plate
        from core.scene_clip_fx import effective_auto_face_reframe
        if effective_auto_face_reframe(values):
            plate = str(values.get('face_reframe_plate', '1:1') or '1:1')
            ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
            if should_clip_video_to_plate(target_width=ref_w, target_height=ref_h, plate_aspect=plate, source_width=int(source_width or 0), source_height=int(source_height or 0)):
                x, y, pw, ph = (plate_rect_on_canvas(ref_w, ref_h, plate)[0], plate_rect_on_canvas(ref_w, ref_h, plate)[1], plate_rect_on_canvas(ref_w, ref_h, plate)[2], plate_rect_on_canvas(ref_w, ref_h, plate)[3])
                sx = target.width() / max(1, ref_w)
                sy = target.height() / max(1, ref_h)
                return QRectF(target.x() + x * sx, target.y() + y * sy, pw * sx, ph * sy)

    def _face_plate_cover_layout(self, target: QRectF, values: dict, frame: QImage) -> tuple[QRectF, float, float, float, float] | None:
        plate_clip = self._face_plate_preview_clip(target, values, source_width=int(frame.width() or 0), source_height=int(frame.height() or 0))
        if plate_clip is None:
            return None
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        preview_scale_x = target.width() / max(1, ref_w)
        preview_scale_y = target.height() / max(1, ref_h)
        offset_x = float(values.get('offset_x', 0)) * preview_scale_x
        offset_y = float(values.get('offset_y', 0)) * preview_scale_y
        cover = max(plate_clip.width() / max(1.0, float(frame.width())), plate_clip.height() / max(1.0, float(frame.height())))
        fit_w = float(frame.width()) * cover
        fit_h = float(frame.height()) * cover
        return (QRectF(plate_clip), plate_clip.center().x() + offset_x, plate_clip.center().y() + offset_y, fit_w, fit_h)

    def _compute_motion_aware_video_rect(self, target: QRectF, values: dict, frame: QImage) -> QRectF:
        active = frame
        sx, sy = (self._current_scale_xy()[0], self._current_scale_xy()[1])
        motion = str(values.get('motion', 'still'))
        seconds = self.position_ms / 1000.0
        motion_i = motion_intensity_factor(int(values.get('motion_intensity_percent', 50) or 50))
        auto_boost = 1.0
        if values.get('auto_zoom_enabled') and motion_i > 0.0:
            auto_boost = auto_zoom_boost_at(seconds, az_val=float(values.get('auto_zoom_val', 1.3)), az_sec=float(values.get('auto_zoom_sec', 3.0)), az_hold=float(values.get('auto_zoom_hold', 0.5)), az_rand=bool(values.get('auto_zoom_rand')), intensity=motion_i)
        elif motion in frozenset({'zoom_out', 'zoom_in'}):
            auto_boost = gradual_zoom_boost(seconds, motion, motion_i)
        elif motion == 'ken_burns':
            auto_boost = gradual_zoom_boost(seconds, 'zoom_in', motion_i)
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        plate_local = ref_h > ref_w
        content_boost = auto_boost if plate_local else 1.0
        frame_boost = 1.0 if plate_local else auto_boost
        fg_w, fg_h = (resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[0], resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[1])
        preview_scale_x = target.width() / max(1, ref_w)
        preview_scale_y = target.height() / max(1, ref_h)
        fit_w = fg_w * preview_scale_x * frame_boost
        fit_h = fg_h * preview_scale_y * frame_boost
        offset_x = float(values.get('offset_x', 0)) * preview_scale_x
        offset_y = float(values.get('offset_y', 0)) * preview_scale_y
        shake_x = 0.0
        shake_y = 0.0
        if motion == 'shake' and motion_i > 0.0:
            shake_x, shake_y = (shake_offsets_px(seconds, intensity=motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[0], shake_offsets_px(seconds, intensity=motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[1])
            if not plate_local:
                offset_x += shake_x
                offset_y += shake_y
        elif motion in PAN_MOTIONS and motion_i > 0.0:
            pan_x, pan_y = (pan_offsets_px(seconds, motion, motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[0], pan_offsets_px(seconds, motion, motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[1])
            if plate_local:
                shake_y, shake_x = (pan_y, pan_x)
            else:
                offset_x += pan_x
                offset_y += pan_y
        video_center_x = target.center().x() + offset_x
        video_center_y = target.center().y() + offset_y
        if plate_local and (content_boost != 1.0 or shake_x or shake_y):
            fit_w *= content_boost
            fit_h *= content_boost
            video_center_x += shake_x
            video_center_y += shake_y
        return QRectF(video_center_x - fit_w / 2, video_center_y - fit_h / 2, fit_w, fit_h)

    def _fitted_video_rect(self, dest: QRectF, frame: QImage) -> QRectF:
        if dest is None or dest.width() < 1 or dest.height() < 1:
            return dest
        if frame is None or frame.isNull():
            return dest
        fw = float(frame.width() or 0)
        fh = float(frame.height() or 0)
        if fw < 1 or fh < 1:
            return dest
        frame_aspect = fw / fh
        dest_aspect = dest.width() / dest.height()
        if abs(dest_aspect - frame_aspect) <= 0.02:
            return dest
        if frame_aspect > dest_aspect:
            new_h = dest.width() / frame_aspect
            return QRectF(dest.x(), dest.center().y() - new_h / 2.0, dest.width(), new_h)
        new_w = dest.height() * frame_aspect
        return QRectF(dest.center().x() - new_w / 2.0, dest.y(), new_w, dest.height())

    def _playback_video_pixmap_for(self, frame: QImage, video_rect: QRectF) -> QPixmap | None:
        dpr = max(1.0, float(self.devicePixelRatioF() or 1.0))
        w = max(2, int(round(float(video_rect.width()) * dpr)))
        h = max(2, int(round(float(video_rect.height()) * dpr)))
        key = (id(frame), w, h, round(dpr, 2))
        if self._playback_video_pixmap_key == key and self._playback_video_pixmap is not None:
            return self._playback_video_pixmap
        pixmap = QPixmap.fromImage(frame).scaled(w, h, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
        pixmap.setDevicePixelRatio(dpr)
        self._playback_video_pixmap_key = key
        self._playback_video_pixmap = pixmap
        return pixmap

    def _paint_playback_fast(self, painter: QPainter, values: dict, frame: QImage) -> None:
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)
        painter.fillRect(self.rect(), self._workspace_fill_color())
        target = self._target_rect()
        use_proxy = self._playback_active and self._playback_layer_pressure() >= 4 and (max(target.width(), target.height()) > _PLAYBACK_PROXY_MAX_EDGE + 20)
        if use_proxy:
            scale = _PLAYBACK_PROXY_MAX_EDGE / max(target.width(), target.height())
            pw = max(2, int(target.width() * scale))
            ph = max(2, int(target.height() * scale))
            local = QRectF(0, 0, pw, ph)
            self._ensure_playback_blur_cache(local, values)
            proxy = QPixmap(pw, ph)
            proxy.fill(Qt.GlobalColor.transparent)
            pp = QPainter(proxy)
            pp.setRenderHint(QPainter.RenderHint.Antialiasing, True)
            pp.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
            pp.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)
            self._paint_playback_scene(pp, values, frame, local, widget_target=target)
            pp.end()
            painter.drawPixmap(target.toRect(), proxy)
            self._remap_playback_rects_from_proxy(local, target)
        else:
            self._ensure_playback_blur_cache(target, values)
            self._paint_playback_scene(painter, values, frame, target, widget_target=target)
        if self._selection:
            self._draw_selection_chrome(painter)
            return None

    def _remap_playback_rects_from_proxy(self, local: QRectF, target: QRectF) -> None:
        sx = target.width() / max(1.0, local.width())
        sy = target.height() / max(1.0, local.height())
        dx = target.left() - local.left() * sx
        dy = target.top() - local.top() * sy

        def _map_rect(r: QRectF) -> QRectF:
            return QRectF() if r is None or r.isNull() else QRectF(r.left() * sx + dx, r.top() * sy + dy, r.width() * sx, r.height() * sy)
        self.last_video_rect = _map_rect(self.last_video_rect)
        self.last_subtitle_rect = _map_rect(self.last_subtitle_rect)
        self.last_subtitle_source_rect = _map_rect(getattr(self, 'last_subtitle_source_rect', QRectF()))
        self.last_logo_rect = _map_rect(getattr(self, 'last_logo_rect', QRectF()))
        self.last_logo_layout_rect = _map_rect(getattr(self, 'last_logo_layout_rect', QRectF()))
        self.last_video_title_rect = _map_rect(getattr(self, 'last_video_title_rect', QRectF()))
        self.last_text_overlay_rect = _map_rect(getattr(self, 'last_text_overlay_rect', QRectF()))
        self.last_effect_overlay_rect = _map_rect(getattr(self, 'last_effect_overlay_rect', QRectF()))
        self.last_blend_rect = _map_rect(self.last_blend_rect)
        self.last_background_rect = _map_rect(getattr(self, 'last_background_rect', QRectF()))
        if self.last_blur_rects:
            self.last_blur_rects = [_map_rect(r) for r in self.last_blur_rects]
        if self.last_blur_layout_rects:
            self.last_blur_layout_rects = [_map_rect(r) for r in self.last_blur_layout_rects]
            return None

    def _paint_playback_scene(self, painter: QPainter, values: dict, frame: QImage, target: QRectF, *, widget_target: QRectF) -> None:
        scrubbing = bool(getattr(self, '_scrubbing_preview', False))
        if str(values.get('background', 'black')) == 'blur':
            painter.fillRect(target, self._preview_canvas_fill_color())
            if self._cached_blur_pixmap is not None:
                painter.drawPixmap(target.toRect(), self._cached_blur_pixmap)
                strength = max(0.0, min(1.0, float(values.get('background_blur_strength', 40)) / 100))
                if strength > 0.02:
                    painter.fillRect(target, QColor(8, 11, 16, int(20 + 70 * strength)))
        else:
            painter.fillRect(target, self._preview_canvas_fill_color())
            if not scrubbing:
                self._draw_background_layer_fill(painter, target, values)
        draw_frame = self._processed_video_frame(frame, values)
        plate_layout = self._face_plate_cover_layout(target, values, draw_frame)
        if plate_layout is not None:
            plate_clip, cx, cy, fit_w, fit_h = (plate_layout[0], plate_layout[1], plate_layout[2], plate_layout[3], plate_layout[4])
            video_rect = QRectF(cx - fit_w / 2, cy - fit_h / 2, fit_w, fit_h)
            self.last_video_rect = QRectF(plate_clip)
            clip_rect = plate_clip.intersected(target)
        else:
            video_rect = self._compute_motion_aware_video_rect(target, values, draw_frame)
            self.last_video_rect = video_rect
            clip_rect = target
        self.last_crop_rect = QRectF()
        video_rect = self._fitted_video_rect(video_rect, draw_frame)
        if plate_layout is None:
            self.last_video_rect = video_rect
        pixmap = self._playback_video_pixmap_for(draw_frame, video_rect)
        painter.save()
        painter.setClipRect(clip_rect)
        if pixmap is not None:
            painter.drawPixmap(video_rect.toRect(), pixmap)
            self._capture_xfade_hold(pixmap, values)
        else:
            painter.drawImage(video_rect, draw_frame)
        if not scrubbing:
            self._draw_clip_transition_preview(painter, video_rect, values)
        painter.restore()
        if scrubbing:
            if not self._suppress_text_overlay_paint:
                self._draw_subtitle(painter, target)
            self._draw_export_frame_border(painter, target)
            return None
        self._draw_blur_zones(painter, target)
        self._draw_blend_layers(painter, target, values, draw_frame)
        self._draw_video_track_overlays(painter, target)
        self._draw_media_overlays(painter, target)
        if not self.logo_image.isNull():
            self._draw_logo(painter, target)
        self._draw_canvas_video_effect(painter, target)
        self._draw_video_title(painter, target)
        self._draw_text_overlay(painter, target)
        self._draw_subtitle(painter, target)
        border = int(values.get('border_pixels', 0) or 0)
        if border > 0:
            painter.setPen(QPen(QColor('#05070A'), max(1, int(border * (target.width() / max(1.0, widget_target.width()))))))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(target.adjusted(border / 2, border / 2, -border / 2, -border / 2))
        self._draw_export_frame_border(painter, target)

    def set_position(self, position_ms: int, *, repaint: bool) -> None:
        previous_ms = self.position_ms
        self.position_ms = max(0, int(position_ms))
        if self.selected_subtitle_text and (not self.selected_subtitle_start_ms <= self.position_ms < self.selected_subtitle_end_ms):
            self.clear_selected_subtitle()
        if bool(getattr(self, '_scrubbing_preview', False)):
            if repaint:
                self.update()
            return None
        old_bucket = int(previous_ms // self._overlay_preview_bucket_ms())
        new_bucket = int(self.position_ms // self._overlay_preview_bucket_ms())
        bucket_changed = old_bucket != new_bucket
        if self._playback_active:
            if bucket_changed and (not self._playback_layer_strips_ready()):
                self._refresh_layer_frames_for_playhead()
            if repaint:
                self.update()
            return None
        if bucket_changed:
            self._refresh_layer_frames_for_playhead()
            self.update()
            return None
        if repaint:
            self.update()
            return None

    def set_selected_subtitle(self, text: str, start_ms: int=0, end_ms: int=0) -> None:
        self.selected_subtitle_text = text
        self.selected_subtitle_start_ms = max(0, int(start_ms))
        self.selected_subtitle_end_ms = max(0, int(end_ms))
        self.update()

    def clear_selected_subtitle(self) -> None:
        self.selected_subtitle_text = ''
        self.selected_subtitle_start_ms = 0
        self.selected_subtitle_end_ms = 0
        self.update()

    def refresh_transform_only(self) -> None:
        self.update()

    def refresh_settings(self) -> None:
        values = self.state.values
        fp_before = self._frame_settings_fp
        self._sync_frame_settings_fingerprint(values)
        fp_changed = self._frame_settings_fp != fp_before
        playing = self._playback_active
        path = str(values.get('logo_path', ''))
        rmbg = bool(values.get('logo_rmbg', False))
        if values.get('logo_enabled') and Path(path).is_file():
            try:
                from core.logo_rmbg import logo_cache_key, resolve_logo_display_path
                key = (path, rmbg, logo_cache_key(path, rmbg=rmbg))
            except Exception:
                key = (path, rmbg, '')
            prev = getattr(self, '_logo_loaded_key', None)
            if prev != key or self.logo_image.isNull():
                try:
                    display = resolve_logo_display_path(path, rmbg=rmbg)
                except Exception:
                    display = path
                self.logo_image = QImage(display)
                self._logo_loaded_key = key
        else:
            self.logo_image = QImage()
            self._logo_loaded_key = None
        if media_overlays_master_enabled(values):
            overlays = ensure_media_overlays(values)
            if overlays:
                sync_flat_keys_from_selected(values)
                overlays = ensure_media_overlays(values)
            keep_paths = set()
            for item in overlays:
                overlay_path = str(item.get('path', ''))
                if item.get('enabled', True) and Path(overlay_path).is_file():
                    keep_paths.add(overlay_path)
                    self._ensure_overlay_preview_cached(overlay_path, cache='overlay')
            for stale in list(self.overlay_preview_images):
                path_part = stale.split('|', 1)[0]
                if path_part not in keep_paths:
                    del self.overlay_preview_images[stale]
            selected_item = selected_media_overlay(values)
            if selected_item and selected_item.get('enabled', True):
                sel_path = str(selected_item.get('path', ''))
                cache_key = self._overlay_preview_key(sel_path)
                self.effect_overlay_image = self.overlay_preview_images[cache_key] if cache_key in self.overlay_preview_images else self.overlay_preview_images[sel_path] if sel_path in self.overlay_preview_images else QImage()
            else:
                self.effect_overlay_image = QImage()
        else:
            self.effect_overlay_image = QImage()
        if blend_layers_master_enabled(values):
            blend_layers = ensure_blend_layers(values)
            blend_keep_paths = set()
            for item in blend_layers:
                blend_path = str(item.get('path', ''))
                if item.get('enabled', True) and Path(blend_path).is_file():
                    blend_keep_paths.add(blend_path)
                    self._ensure_overlay_preview_cached(blend_path, cache='blend')
            for stale in list(self.blend_preview_images):
                path_part = stale.split('|', 1)[0]
                if path_part not in blend_keep_paths:
                    del self.blend_preview_images[stale]
        if (not playing or fp_changed) and background_layers_master_enabled(values):
            background_layers = ensure_background_layers(values)
            background_keep_paths = set()
            for item in background_layers:
                background_path = str(item.get('path', ''))
                if item.get('enabled', True) and Path(background_path).is_file():
                    background_keep_paths.add(background_path)
                    self._ensure_overlay_preview_cached(background_path, cache='background')
            for stale in list(self.background_preview_images):
                path_part = stale.split('|', 1)[0]
                if path_part not in background_keep_paths:
                    del self.background_preview_images[stale]
        if not playing or fp_changed:
            self._clear_text_layout_caches()
            if self._iter_active_video_layer_paths():
                self._ensure_playback_layer_strips()
        self.update()

    def _clear_text_layout_caches(self, *, keep_subtitle_live: bool=False) -> None:
        self._title_measure_cache = None
        self._subtitle_measure_cache = None
        self._text_measure_cache = None
        if not keep_subtitle_live:
            self._live_subtitle_top_norm = None
            return None

    def _clear_interact_anchors(self, *, keep_subtitle_live: bool=False) -> None:
        self._text_anchor_y_norm = None
        self._title_anchor_y_norm = None
        self._subtitle_anchor_y_norm = None
        self._live_text_box_w_norm = None
        self._live_text_scale_percent = None
        self._live_title_box_w_norm = None
        self._live_title_scale_percent = None
        self._live_subtitle_font_size = None
        self._live_subtitle_box_w_norm = None
        if not keep_subtitle_live:
            self._live_subtitle_top_norm = None
            return None

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        timer = getattr(self, '_resize_flush_timer', None)
        if timer is None:
            from PySide6.QtCore import QTimer
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.setInterval(90)
            timer.timeout.connect(self._flush_resize_caches)
            self._resize_flush_timer = timer
        timer.start()
        self.update()

    def _flush_resize_caches(self) -> None:
        self._playback_video_pixmap = None
        self._playback_video_pixmap_key = None
        self._clear_interact_anchors()
        self._clear_text_layout_caches()
        self.displaySizeChanged.emit(self.display_video_pixel_width())
        self.update()

    def display_video_pixel_width(self) -> int:
        rect = getattr(self, 'last_video_rect', None)
        if rect is None or rect.width() < 8:
            rect = self._target_rect()
        dpr = float(self.devicePixelRatioF() or 1.0)
        return max(1, int(round(float(rect.width()) * max(1.0, dpr))))

    def _overlay_preview_bucket_ms(self, cache: str='overlay') -> int:
        return (_OVERLAY_PREVIEW_BUCKET_PLAY_BG_MS if cache == 'background' else _OVERLAY_PREVIEW_BUCKET_PLAY_MS) if self._playback_active else _OVERLAY_PREVIEW_BUCKET_PAUSE_MS

    def _overlay_decode_edge(self, cache: str) -> int:
        from ui_qt.playback import PREVIEW_DECODE_MAX_WIDTH, clamp_preview_decode_width
        return clamp_preview_decode_width(PREVIEW_DECODE_MAX_WIDTH)

    def _overlay_video_sample_ms(self, layer: dict | None=None, path: str='', position_ms: int | None=None) -> int:
        pos = max(0, int(position_ms if position_ms is not None else self.position_ms))
        if layer is not None:
            pos = max(0, pos - int(layer.get('start_ms', 0) or 0))
        overlay_path = path or (str(layer.get('path', '')) if layer is not None else '')
        duration_ms = _overlay_video_duration_ms(overlay_path)
        if overlay_path and is_video_overlay_path(overlay_path) and (duration_ms > 0):
            pos = pos % duration_ms
        return pos

    def _overlay_preview_key(self, path: str, position_ms: int | None=None, layer: dict | None=None, *, cache: str) -> str:
        if is_video_overlay_path(path):
            sample = self._overlay_video_sample_ms(layer, path=path, position_ms=position_ms)
            bucket = int(sample // self._overlay_preview_bucket_ms(cache))
            return f'{path}|{bucket}'
        return path

    def _overlay_preview_store(self, cache_name: str) -> dict[str, QImage]:
        return self.blend_preview_images if cache_name == 'blend' else self.background_preview_images if cache_name == 'background' else self.overlay_preview_images

    def _flush_overlay_repaint(self) -> None:
        self._overlay_repaint_armed = False
        self.update()

    def _on_overlay_frame_loaded(self, cache_key: str, cache_name: str, image: QImage) -> None:
        self._overlay_load_in_flight.discard(cache_key)
        self._overlay_load_targets.pop(cache_key, None)
        if image.isNull():
            return None
        self._overlay_preview_store(cache_name)[cache_key] = image
        self._prune_overlay_preview_cache(cache_name, path_part=cache_key.split('|', 1)[0])
        if self._playback_active or self._scrubbing_preview:
            if self._overlay_repaint_armed:
                pass
            else:
                self._overlay_repaint_armed = True
                QTimer.singleShot(48, self._flush_overlay_repaint)
            return None
        self.update()

    def _prune_overlay_preview_cache(self, cache_name: str, path_part: str) -> None:
        store = self._overlay_preview_store(cache_name)
        prefix = f'{path_part}|'
        keys = sorted((key for key in store if key.startswith(prefix)))
        if len(keys) <= 12:
            return None
        for stale in keys[:-12]:
            del store[stale]

    def _queue_overlay_preview_load(self, path: str, position_ms: int, *, cache: str, layer: dict | None) -> None:
        strip = self._layer_strip_by_path.get(path) or get_cached_strip(path)
        if self._playback_active and strip is not None and strip.frames:
            return None
        cache_key = self._overlay_preview_key(path, position_ms, layer=layer, cache=cache)
        store = self._overlay_preview_store(cache)
        if cache_key in store or cache_key in self._overlay_load_in_flight:
            return None
        self._overlay_load_in_flight.add(cache_key)
        self._overlay_load_targets[cache_key] = cache
        self._overlay_thread_pool.start(OverlayFrameLoadRunnable(path, position_ms, cache_key, cache, self._overlay_load_emitter, max_edge=self._overlay_decode_edge(cache)))

    def _queue_overlay_preview_preload(self, path: str, layer: dict | None, *, cache: str, buckets_ahead: int | None) -> None:
        if is_video_overlay_path(path):
            strip = self._layer_strip_by_path.get(path) or get_cached_strip(path)
            if self._playback_active and strip is not None and strip.frames:
                return None
            if buckets_ahead is None:
                buckets_ahead = (2 if cache == 'background' else 1) if self._scrubbing_preview else 5 if cache == 'background' else 3
            bucket_ms = self._overlay_preview_bucket_ms(cache)
            file_dur = max(1, _overlay_video_duration_ms(path))
            sample_now = self._overlay_video_sample_ms(layer, path=path)
            base_ms = int(sample_now // bucket_ms) * bucket_ms
            for step in range(buckets_ahead + 1):
                sample_ms = (base_ms + step * bucket_ms) % file_dur
                self._queue_overlay_preview_load(path, sample_ms, cache=cache, layer=layer)
        else:
            return None

    def _ensure_overlay_preview_cached(self, path: str, *, cache: str) -> None:
        if not path or not Path(path).is_file():
            return None
        if not is_image_overlay_path(path) and is_video_overlay_path(path):
            sample = self._overlay_video_sample_ms(path=path)
            self._queue_overlay_preview_load(path, sample, cache=cache)
        else:
            image = QImage(path)
            if image.isNull():
                image = self._load_overlay_preview_image(path, self.position_ms)
            if not image.isNull():
                store = self._overlay_preview_store(cache)
                store[self._overlay_preview_key(path, self.position_ms, cache=cache)] = image
            return None

    def _preload_playback_overlay_frames(self) -> None:
        values = self.state.values
        if blend_layers_master_enabled(values):
            for item in ensure_blend_layers(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and Path(path).is_file() and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    self._queue_overlay_preview_preload(path, item, cache='blend')
        if background_layers_master_enabled(values):
            for item in ensure_background_layers(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and Path(path).is_file() and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    self._queue_overlay_preview_preload(path, item, cache='background')
        if media_overlays_master_enabled(values):
            for item in ensure_media_overlays(values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and Path(path).is_file() and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    self._queue_overlay_preview_preload(path, item, cache='overlay')
            return None

    def _cached_overlay_image_for_path(self, path: str, store: dict[str, QImage], layer: dict | None=None, *, cache: str) -> QImage | None:
        strip_frame = self._strip_frame_for_path(path, layer=layer)
        if strip_frame is not None and (not strip_frame.isNull()):
            return strip_frame
        if self._playback_active and is_video_overlay_path(path) and (path not in self._layer_strip_queued) and (not is_strip_building(path)):
            self._ensure_playback_layer_strips()
        sample = self._overlay_video_sample_ms(layer, path=path)
        cache_key = self._overlay_preview_key(path, sample, layer=layer, cache=cache)
        image = store.get(cache_key)
        if image is not None and (not image.isNull()):
            return image
        if is_video_overlay_path(path):
            prefix = f'{path}|'
            current_bucket = int(sample // self._overlay_preview_bucket_ms(cache))
            file_dur = max(1, _overlay_video_duration_ms(path))
            bucket_ms = max(1, self._overlay_preview_bucket_ms(cache))
            max_bucket = max(0, (file_dur - 1) // bucket_ms)
            span = max_bucket + 1
            best_key = None
            best_dist = 10000
            for key, candidate in store.items():
                if key.startswith(prefix):
                    try:
                        bucket = int(key.split('|', 1)[1])
                        dist = min(abs(bucket - current_bucket), span - abs(bucket - current_bucket))
                        if not candidate.isNull() and dist < best_dist:
                            best_dist = dist
                            best_key = key
                    except (IndexError, ValueError):
                        pass
            return store[best_key] if best_key is not None else None
        prefix = f'{path}|'
        for key, candidate in store.items():
            if key != path and (not key.startswith(prefix)) or candidate.isNull():
                continue
            return candidate

    def _refresh_video_overlay_preview_frames(self) -> None:
        if media_overlays_master_enabled(self.state.values):
            overlays = ensure_media_overlays(self.state.values)
            for item in overlays:
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and Path(path).is_file():
                    self._queue_overlay_preview_preload(path, item, cache='overlay')
        else:
            return None

    def _refresh_blend_layer_preview_frames(self) -> None:
        if blend_layers_master_enabled(self.state.values):
            for item in ensure_blend_layers(self.state.values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)) and Path(path).is_file():
                    self._queue_overlay_preview_preload(path, item, cache='blend')
        else:
            return None

    def _refresh_background_layer_preview_frames(self) -> None:
        if background_layers_master_enabled(self.state.values):
            for item in ensure_background_layers(self.state.values):
                path = str(item.get('path', ''))
                if item.get('enabled', True) and is_video_overlay_path(path) and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)) and Path(path).is_file():
                    self._queue_overlay_preview_preload(path, item, cache='background')
        else:
            return None

    def _active_background_layer(self, values: dict) -> dict | None:
        from ui_qt.background_layers import is_custom_background_mode
        if not is_custom_background_mode(values):
            pass
        elif background_layers_master_enabled(values):
            active = None
            for item in exportable_background_layers(values):
                if not item.get('preview_hidden') and self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    active = item
            return active

    def _background_layers_active(self, values: dict) -> bool:
        return self._active_background_layer(values) is not None

    def _background_preview_image(self, path: str, layer: dict | None=None) -> QImage | None:
        return self._cached_overlay_image_for_path(path, self.background_preview_images, layer=layer, cache='background')

    def _draw_background_layer_fill(self, painter: QPainter, target: QRectF, values: dict) -> bool:
        self.last_background_rect = QRectF()
        self.last_background_rects = []
        self.background_layer_image = QImage()
        if self._background_layers_active(values):
            selected = int(values.get('background_layer_index', 0) or 0)
            drew = False
            for index, item in enumerate(ensure_background_layers(values)):
                path = str(item.get('path', ''))
                image = self._background_preview_image(path, layer=item)
                if not item.get('enabled', True) or item.get('preview_hidden') or (not path) or (not Path(path).is_file()) or (not self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))) or (image is None) or image.isNull():
                    pass
                else:
                    opacity = max(0.0, min(1.0, float(item.get('opacity', 100) or 100) / 100))
                    painter.save()
                    painter.setClipRect(target)
                    painter.setOpacity(opacity)
                    if background_layer_uses_cover(item):
                        layout = self._cover_fill_rect(target, image)
                        painter.drawImage(layout, image)
                        bounds = QRectF(layout)
                    else:
                        width = max(8.0, target.width() * float(item.get('scale_percent', 100)) / 100)
                        aspect = image.height() / max(1, image.width())
                        stretch = float(item.get('scale_aspect', 0) or 0)
                        if stretch >= 0.05:
                            aspect = stretch
                        if self._dragging_background and index == selected and (float(self._layer_drag_lock_aspect) > 1e-06):
                            aspect = float(self._layer_drag_lock_aspect)
                        height = width * aspect
                        cx = target.left() + target.width() * float(item.get('x_norm', 0.5))
                        cy = target.top() + target.height() * float(item.get('y_norm', 0.5))
                        rot = float(item.get('rotation_degrees', 0) or 0)
                        layout, bounds = (self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[0], self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[1])
                    painter.restore()
                    self.last_background_rects.append((index, QRectF(layout), QRectF(bounds)))
                    if index == selected:
                        self.last_background_rect = QRectF(layout)
                        self.background_layer_image = image
                    drew = True
            if self.last_background_rect.isNull() and self.last_background_rects:
                _idx, layout, _bounds = (self.last_background_rects[-1][0], self.last_background_rects[-1][1], self.last_background_rects[-1][2])
                self.last_background_rect = QRectF(layout)
            return drew
        return False

    @staticmethod
    def _cover_fill_rect(target: QRectF, image: QImage) -> QRectF:
        iw = max(1, image.width())
        ih = max(1, image.height())
        scale = max(target.width() / iw, target.height() / ih)
        w = iw * scale
        h = ih * scale
        return QRectF(target.left() + (target.width() - w) / 2, target.top() + (target.height() - h) / 2, w, h)

    def _unlock_background_cover_for_edit(self) -> None:
        values = self.state.values
        item = selected_background_layer(values)
        if item is not None and background_layer_uses_cover(item):
            target = self._target_rect()
            layout = self.last_background_rect
            image = self.background_layer_image
            if layout.isNull() and (not target.isNull()) and (image is not None) and (not image.isNull()):
                layout = self._cover_fill_rect(target, image)
            if layout.isNull() or target.isNull() or target.width() < 1:
                update_selected_background_layer(values, fit_mode='free')
                sync_flat_keys_from_selected_background(values)
                return None
            scale = max(5, min(200, int(round(layout.width() / target.width() * 100))))
            x_norm = (layout.center().x() - target.left()) / max(1.0, target.width())
            y_norm = (layout.center().y() - target.top()) / max(1.0, target.height())
            update_selected_background_layer(values, fit_mode='free', scale_percent=scale, x_norm=x_norm, y_norm=y_norm)
            sync_flat_keys_from_selected_background(values)
        else:
            return None

    def _blend_layers_active(self, values: dict) -> bool:
        if blend_layers_master_enabled(values):
            for item in exportable_blend_layers(values):
                if self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)):
                    return True
        return False

    def _blend_preview_image(self, path: str, layer: dict | None=None) -> QImage | None:
        image = self._cached_overlay_image_for_path(path, self.blend_preview_images, layer=layer, cache='blend')
        if image is None:
            image = self._cached_overlay_image_for_path(path, self.overlay_preview_images, layer=layer, cache='overlay')
        return image

    def _overlay_blend_layers_active(self, values: dict) -> bool:
        return self._blend_layers_active(values)

    def _overlay_preview_image(self, path: str, layer: dict | None=None) -> QImage | None:
        return self._cached_overlay_image_for_path(path, self.overlay_preview_images, layer=layer, cache='overlay')

    def _load_overlay_preview_image(self, path: str, position_ms: int=0) -> QImage:
        if is_image_overlay_path(path):
            return QImage(path)
        image = QImage(path)
        return _extract_overlay_video_frame(path, position_ms) if is_video_overlay_path(path) or image.isNull() else image

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.MiddleButton and self._preview_view_zoomed():
            self._dragging_view_pan = True
            self._view_pan_drag_last = (event.position().x(), event.position().y())
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return None
        if event.button() != Qt.MouseButton.LeftButton:
            super().mousePressEvent(event)
            return None
        point = event.position()
        self._edit_gesture_history_pushed = False
        map_rect = self._navigator_map_rect()
        if map_rect is not None and map_rect.contains(point):
            self._dragging_navigator = True
            self._navigator_drag_last = (point.x(), point.y())
            self._set_view_pan_from_navigator_point(point.x(), point.y())
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return None
        hit = self._hit_test_interactive(point)
        if hit is None:
            if self._preview_view_zoomed() and (not self._target_rect().contains(point)):
                self._dragging_view_pan = True
                self._view_pan_drag_last = (point.x(), point.y())
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
                event.accept()
            elif self._pasteboard_enabled() and self._selection in frozenset({'background', 'blend', 'logo', 'overlay', 'video'}):
                super().mousePressEvent(event)
            elif self._preview_view_zoomed():
                self._dragging_view_pan = True
                self._view_pan_drag_last = (point.x(), point.y())
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
                event.accept()
            else:
                if self._selection:
                    self._selection = ''
                    self.previewSelectionChanged.emit('')
                self.update()
                super().mousePressEvent(event)
            return None
        kind, mode = (hit[0], hit[1])
        if kind != self._selection:
            self._selection = kind
            self.previewSelectionChanged.emit(kind)
        else:
            self._selection = kind
        if str(mode) == 'rotate' and kind in frozenset({'background', 'blend', 'logo', 'text', 'overlay', 'video', 'subtitle', 'title', 'blur'}):
            self._dragging_rotation = True
            self._rotation_kind = kind
            chrome = self._selection_chrome_rect(kind)
            self._rotation_pivot_x = chrome.center().x()
            self._rotation_pivot_y = chrome.center().y()
            self._rotation_start_pointer_angle = math.atan2(point.y() - self._rotation_pivot_y, point.x() - self._rotation_pivot_x)
            self._rotation_start_degrees = float(self._layer_rotation_degrees(kind))
            self._guide_show_center = True
            self._guide_snap_rotation = False
            self.setCursor(Qt.CursorShape.CrossCursor)
            self.update()
            event.accept()
            return None
        if kind == 'title':
            self._dragging_title = True
            self._title_drag_mode = mode
            self.state.values['video_title_enabled'] = True
            self.state.values['video_title_position'] = 'custom'
            center = self.last_video_title_rect.center()
            self._title_scale_center_x = center.x()
            self._title_scale_center_y = center.y()
            self._title_scale_start_x = int(self.state.values.get('video_title_scale_x_percent', self.state.values.get('video_title_scale_percent', 100)) or 100)
            self._title_scale_start_y = int(self.state.values.get('video_title_scale_y_percent', self.state.values.get('video_title_scale_percent', 100)) or 100)
            self._title_scale_start_half_w = max(8.0, self.last_video_title_rect.width() / 2)
            self._title_scale_start_half_h = max(8.0, self.last_video_title_rect.height() / 2)
            self._title_box_start_percent = int(self.state.values.get('video_title_box_width_percent', 92) or 92)
            self._title_scale_start_percent = int(self.state.values.get('video_title_scale_percent', self.state.values.get('video_title_scale_x_percent', 100)) or 100)
            if str(mode).startswith('scale'):
                corner = str(mode).split(':', 1)[1] if ':' in str(mode) else 'br'
                target = self._target_rect()
                self._title_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self._title_resize_start_dist = max(8.0, math.hypot(point.x() - center.x(), point.y() - center.y()))
                self.setCursor(self._corner_scale_cursor(corner))
            elif mode == 'box_w':
                target = self._target_rect()
                self._title_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            else:
                self._title_drag_offset_x = point.x() - center.x()
                self._title_drag_offset_y = point.y() - center.y()
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'text':
            self._dragging_text_overlay = True
            self._text_overlay_drag_mode = mode
            self.state.values['text_overlay_enabled'] = True
            self.state.values['text_overlay_style'] = 'static'
            self.state.values['text_overlay_position'] = 'custom'
            focus_rect = self._text_selected_rect if self._text_selected_rect.isNull() else self.last_text_overlay_rect
            center = focus_rect.center()
            self._text_scale_center_x = center.x()
            self._text_scale_center_y = center.y()
            self._text_scale_start = int(self.state.values.get('text_overlay_scale_percent', 100) or 100)
            self._text_box_start = float(int(self.state.values.get('text_overlay_box_width_percent', 90) or 90) / 100.0)
            self._text_scale_start_half = max(8.0, math.hypot(focus_rect.width() / 2, focus_rect.height() / 2))
            self._text_box_start_half_w = max(8.0, focus_rect.width() / 2)
            if str(mode).startswith('scale'):
                corner = str(mode).split(':', 1)[1] if ':' in str(mode) else 'br'
                target = self._target_rect()
                self._text_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self._text_resize_start_dist = max(8.0, math.hypot(point.x() - center.x(), point.y() - center.y()))
                self.setCursor(self._corner_scale_cursor(corner))
                self._text_move_layout_cache = None
            elif mode == 'box_w':
                target = self._target_rect()
                self._text_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self.setCursor(Qt.CursorShape.SizeHorCursor)
                self._text_move_layout_cache = None
            else:
                self._text_overlay_drag_offset_x = point.x() - center.x()
                self._text_overlay_drag_offset_y = point.y() - center.y()
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
            self._capture_text_drag_base()
            self.update()
        elif kind == 'logo':
            self._dragging_logo = True
            self._logo_drag_mode = mode
            self.state.values['logo_enabled'] = True
            self.state.values['logo_position'] = 'custom'
            if str(self.state.values.get('logo_motion', 'static')) == 'bounce':
                pass
            if str(mode).startswith('scale:'):
                corner = str(mode).split(':', 1)[1]
                self._corner_scale_start_percent = int(self.state.values.get('logo_scale_percent', 18) or 18)
                self._begin_corner_scale(self.last_logo_layout_rect, corner, rotation_degrees=self._layer_rotation_degrees('logo'))
                self.setCursor(Qt.CursorShape.SizeFDiagCursor)
            else:
                self._logo_drag_offset_x = point.x() - self.last_logo_layout_rect.center().x()
                self._logo_drag_offset_y = point.y() - self.last_logo_layout_rect.center().y()
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'overlay':
            self._dragging_overlay = True
            self._overlay_drag_mode = mode
            self.state.values['media_overlays_master_enabled'] = True
            self.state.values['effect_overlay_enabled'] = True
            update_selected_media_overlay(self.state.values, enabled=True)
            if str(mode).startswith('scale:'):
                corner = str(mode).split(':', 1)[1]
                self._corner_scale_start_percent = int(self.state.values.get('effect_overlay_scale_percent', 100) or 100)
                self._begin_corner_scale(self.last_effect_overlay_rect, corner, rotation_degrees=self._layer_rotation_degrees('overlay'))
                self.setCursor(Qt.CursorShape.SizeFDiagCursor)
            elif str(mode).startswith('mask_feather'):
                axis = str(mode).split(':', 1)[1] if ':' in str(mode) else 'y'
                self.setCursor(Qt.CursorShape.SizeHorCursor if axis == 'x' else Qt.CursorShape.SizeVerCursor)
            else:
                self._begin_layer_norm_drag('overlay', point, self.last_effect_overlay_rect, float(self.state.values.get('effect_overlay_x_norm', 0.5) or 0.5), float(self.state.values.get('effect_overlay_y_norm', 0.5) or 0.5))
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'blend':
            self._dragging_blend = True
            self._blend_drag_mode = mode
            self.state.values['blend_layers_master_enabled'] = True
            update_selected_blend_layer(self.state.values, enabled=True)
            if str(mode).startswith('scale:'):
                corner = str(mode).split(':', 1)[1]
                self._corner_scale_start_percent = int(self.state.values.get('blend_layer_scale_percent', 100) or 100)
                self._begin_corner_scale(self.last_blend_rect, corner, rotation_degrees=self._layer_rotation_degrees('blend'))
                self.setCursor(Qt.CursorShape.SizeFDiagCursor)
            else:
                self._begin_layer_norm_drag('blend', point, self.last_blend_rect, float(self.state.values.get('blend_layer_x_norm', 0.5) or 0.5), float(self.state.values.get('blend_layer_y_norm', 0.5) or 0.5))
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'background':
            self._dragging_background = True
            self._background_drag_mode = mode
            self.state.values['background_layers_master_enabled'] = True
            self.state.values['background'] = 'custom'
            update_selected_background_layer(self.state.values, enabled=True)
            self._unlock_background_cover_for_edit()
            if str(mode).startswith('scale:'):
                corner = str(mode).split(':', 1)[1]
                self._corner_scale_start_percent = int(self.state.values.get('background_layer_scale_percent', 100) or 100)
                self._begin_corner_scale(self.last_background_rect, corner, rotation_degrees=self._layer_rotation_degrees('background'))
                self.setCursor(Qt.CursorShape.SizeFDiagCursor)
            elif mode != 'select':
                self._begin_layer_norm_drag('background', point, self.last_background_rect, float(self.state.values.get('background_layer_x_norm', 0.5) or 0.5), float(self.state.values.get('background_layer_y_norm', 0.5) or 0.5))
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'subtitle_source':
            self._dragging_subtitle = True
            self._subtitle_drag_layer = 'source'
            self._subtitle_drag_mode = 'move'
            self._subtitle_drag_offset_y = point.y() - self.last_subtitle_source_rect.top()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'subtitle':
            self._dragging_subtitle = True
            self._subtitle_drag_layer = 'working'
            self._subtitle_drag_mode = mode
            self._subtitle_drag_offset_y = point.y() - self.last_subtitle_rect.top()
            center = self.last_subtitle_rect.center()
            self._subtitle_scale_center_x = center.x()
            self._subtitle_scale_center_y = center.y()
            self._subtitle_resize_start_dist = max(8.0, math.hypot(point.x() - center.x(), point.y() - center.y()))
            self._subtitle_resize_start_font = int(self.state.values.get('subtitle_font_size', 48))
            self._subtitle_scale_start_x = int(self.state.values.get('subtitle_scale_x_percent', 100))
            self._subtitle_scale_start_y = int(self.state.values.get('subtitle_scale_y_percent', 100))
            self._subtitle_scale_start_half_w = max(8.0, self.last_subtitle_rect.width() / 2)
            self._subtitle_scale_start_half_h = max(8.0, self.last_subtitle_rect.height() / 2)
            self._subtitle_box_start_percent = int(self.state.values.get('subtitle_box_width_percent', 90) or 90)
            if str(mode).startswith('scale'):
                corner = str(mode).split(':', 1)[1] if ':' in str(mode) else 'br'
                target = self._target_rect()
                self._subtitle_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self._subtitle_resize_start_dist = max(8.0, math.hypot(point.x() - center.x(), point.y() - center.y()))
                self.setCursor(self._corner_scale_cursor(corner))
            elif mode == 'box_w':
                self._subtitle_show_longest = True
                target = self._target_rect()
                self._subtitle_anchor_y_norm = (center.y() - target.top()) / max(1.0, target.height())
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            else:
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
        elif kind == 'blur':
            index = int(mode.split(':', 1)[0])
            blur_mode = mode.split(':', 1)[1]
            self._dragging_blur = True
            self._blur_drag_index = index
            self._blur_drag_mode = blur_mode
            self.state.values['blur_zone_index'] = index
            self.state.values['blur_zone_enabled'] = True
            zone_rect = self.last_blur_rects[index]
            self._blur_drag_offset_y = point.y() - zone_rect.top()
            self._blur_drag_offset_x = point.x() - zone_rect.left()
            self.setCursor(self._blur_cursor(blur_mode))
        elif kind == 'video':
            mode_text = str(mode)
            if mode_text.startswith('crop'):
                self._dragging_crop = True
                self._crop_drag_mode = mode_text
                self._video_drag_last_x = point.x()
                self._video_drag_last_y = point.y()
                self._crop_drag_origin = self._crop_norm_values()
                self.setCursor(self._crop_cursor(mode_text))
            else:
                self._dragging_video = True
                self._video_drag_mode = mode_text
                self._video_drag_last_x = point.x()
                self._video_drag_last_y = point.y()
                center = self.last_video_rect.center()
                self._video_scale_start_dist = max(8.0, math.hypot(point.x() - center.x(), point.y() - center.y()))
                sx, sy = (self._current_scale_xy()[0], self._current_scale_xy()[1])
                self._video_scale_start_x = sx
                self._video_scale_start_y = sy
                self._video_scale_start_half_w = max(8.0, self.last_video_rect.width() / 2)
                self._video_scale_start_half_h = max(8.0, self.last_video_rect.height() / 2)
                if mode_text == 'scale':
                    self.setCursor(Qt.CursorShape.SizeFDiagCursor)
                elif mode_text == 'scale_x':
                    self.setCursor(Qt.CursorShape.SizeHorCursor)
                elif mode_text == 'scale_y':
                    self.setCursor(Qt.CursorShape.SizeVerCursor)
                else:
                    self.setCursor(Qt.CursorShape.ClosedHandCursor)
        self.update()
        event.accept()

    def contextMenuEvent(self, event) -> None:
        if self._any_drag_active():
            event.accept()
            return None
        kind = self._interactive_kind_at(event.pos())
        if kind == 'video':
            kind = ''
        menu = QMenu(self)
        copy_action = None
        duplicate_action = None
        paste_action = None
        delete_action = None
        if kind and kind in frozenset({'background', 'blend', 'logo', 'text', 'overlay', 'subtitle', 'title', 'blur'}):
            if kind != 'background':
                copy_action = menu.addAction('Sao chép')
                duplicate_action = menu.addAction('Nhân đôi')
            delete_action = menu.addAction(self._delete_menu_label(kind))
        if has_clipboard():
            paste_action = menu.addAction('Dán')
        if copy_action or paste_action:
            chosen = menu.exec(event.globalPos())
            if chosen is copy_action:
                self.previewCopyRequested.emit(kind)
            elif chosen is duplicate_action:
                self.previewDuplicateRequested.emit(kind)
            elif chosen is paste_action:
                self.previewPasteRequested.emit()
            elif chosen is delete_action:
                self._request_delete_kind(kind)
            event.accept()
        else:
            super().contextMenuEvent(event)
            return None

    def keyPressEvent(self, event: QKeyEvent) -> None:
        if self._any_drag_active() or self._is_crop_editing():
            super().keyPressEvent(event)
            return None
        mods = event.modifiers()
        ctrl = mods & Qt.KeyboardModifier.ControlModifier
        kind = self._clipboard_kind()
        if ctrl and event.key() == Qt.Key.Key_C and kind:
            self.previewCopyRequested.emit(kind)
            event.accept()
            return None
        if ctrl and event.key() == Qt.Key.Key_V and has_clipboard():
            self.previewPasteRequested.emit()
            event.accept()
            return None
        kind = self._clipboard_kind()
        if ctrl and event.key() == Qt.Key.Key_D and kind:
            self.previewDuplicateRequested.emit(kind)
            event.accept()
            return None
        kind = self._selection or self._hover_kind
        if event.key() in (Qt.Key.Key_Delete, Qt.Key.Key_Backspace) and kind and (kind not in frozenset({'', 'video'})):
            self._request_delete_kind(kind)
            event.accept()
            return None
        super().keyPressEvent(event)

    def set_preview_selection(self, kind: str) -> None:
        kind = str(kind or '')
        if kind == self._selection:
            self.update()
            return None
        self._selection = kind
        self.previewSelectionChanged.emit(kind)
        self.update()

    def _clipboard_kind(self) -> str:
        kind = str(self._selection or self._hover_kind or '')
        return kind if kind in frozenset({'blend', 'logo', 'text', 'overlay', 'title'}) else ''

    def _any_drag_active(self) -> bool:
        return self._dragging_subtitle or self._dragging_title or self._dragging_text_overlay or self._dragging_logo or self._dragging_overlay or self._dragging_blend or self._dragging_background or self._dragging_blur or self._dragging_crop or self._dragging_video or self._dragging_rotation

    def _ensure_edit_gesture_history(self) -> None:
        if not self._edit_gesture_history_pushed:
            self._edit_gesture_history_pushed = True
            self.editGestureStarted.emit()
            return None

    def _interactive_kind_at(self, point) -> str:
        hit = self._hit_test_interactive(point)
        return str(hit[0]) if hit is not None else str(self._hover_kind) if self._hover_kind and self._hover_kind != 'video' else ''

    def _delete_menu_label(self, kind: str) -> str:
        labels = {'subtitle': 'Xóa phụ đề', 'title': 'Xóa tiêu đề', 'text': 'Xóa chữ phụ họa', 'logo': 'Xóa logo', 'overlay': 'Xóa lớp overlay', 'blend': 'Xóa hòa trộn', 'background': 'Xóa nền', 'blur': 'Xóa vùng mờ'}
        return labels.get(str(kind), 'Xóa')

    def _request_delete_kind(self, kind: str) -> None:
        kind = str(kind or '')
        if not kind or kind == 'video':
            return None
        self._selection = ''
        self._hover_kind = ''
        self._hover_mode = ''
        self.previewDeleteRequested.emit(kind)
        self.update()

    def mouseMoveEvent(self, event) -> None:
        point = event.position()
        if self._dragging_navigator:
            self._set_view_pan_from_navigator_point(point.x(), point.y())
            event.accept()
            return None
        if self._dragging_view_pan:
            lx, ly = (self._view_pan_drag_last[0], self._view_pan_drag_last[1])
            self._view_pan_x += point.x() - lx
            self._view_pan_y += point.y() - ly
            self._view_pan_drag_last = (point.x(), point.y())
            self._clamp_view_pan()
            self.update()
            event.accept()
            return None
        map_rect = self._navigator_map_rect()
        if map_rect is not None and map_rect.contains(point):
            self.setCursor(Qt.CursorShape.OpenHandCursor)
        if self._any_drag_active():
            self._ensure_edit_gesture_history()
        if self._dragging_rotation:
            angle = math.atan2(point.y() - self._rotation_pivot_y, point.x() - self._rotation_pivot_x)
            delta = math.atan2(math.sin(angle - self._rotation_start_pointer_angle), math.cos(angle - self._rotation_start_pointer_angle))
            new_deg = self._rotation_start_degrees + math.degrees(delta)
            new_deg, snapped = (self._snap_rotation_degrees(new_deg)[0], self._snap_rotation_degrees(new_deg)[1])
            self._guide_show_center = True
            self._guide_snap_rotation = snapped
            if snapped:
                self._set_alignment_guides(vertical=True, horizontal=True)
            else:
                self._set_alignment_guides(vertical=False, horizontal=False)
            self._set_layer_rotation_degrees(self._rotation_kind, new_deg)
            event.accept()
            return None
        if self._dragging_title:
            mode = self._title_drag_mode
            if str(mode).startswith('scale'):
                self._apply_title_uniform_scale(point.x(), point.y())
            elif mode == 'box_w':
                self._apply_title_box_width(point.x())
            else:
                self._apply_title_drag(point.x() - self._title_drag_offset_x, point.y() - self._title_drag_offset_y)
            event.accept()
            return None
        if self._dragging_text_overlay:
            mode = self._text_overlay_drag_mode
            if str(mode).startswith('scale'):
                self._apply_text_overlay_uniform_scale(point.x(), point.y())
            elif mode == 'box_w':
                self._apply_text_overlay_box_width(point.x())
            else:
                self._apply_text_overlay_drag(point.x() - self._text_overlay_drag_offset_x, point.y() - self._text_overlay_drag_offset_y)
            event.accept()
            return None
        if self._dragging_logo:
            if str(self._logo_drag_mode).startswith('scale:'):
                self._apply_logo_corner_scale(point.x(), point.y())
            else:
                self._apply_logo_drag(point.x() - self._logo_drag_offset_x, point.y() - self._logo_drag_offset_y)
            event.accept()
            return None
        if self._dragging_overlay:
            if str(self._overlay_drag_mode).startswith('scale:'):
                self._apply_effect_overlay_corner_scale(point.x(), point.y())
            elif str(self._overlay_drag_mode).startswith('mask_feather'):
                axis = str(self._overlay_drag_mode).split(':', 1)[1] if ':' in str(self._overlay_drag_mode) else 'y'
                self._apply_film_mask_feather_drag(point, axis)
            else:
                self._apply_effect_overlay_drag()
            event.accept()
            return None
        if self._dragging_blend:
            if str(self._blend_drag_mode).startswith('scale:'):
                self._apply_blend_layer_corner_scale(point.x(), point.y())
            else:
                self._apply_blend_layer_drag()
            event.accept()
            return None
        if self._dragging_background:
            if str(self._background_drag_mode).startswith('scale:'):
                self._apply_background_layer_corner_scale(point.x(), point.y())
            elif self._background_drag_mode != 'select':
                self._apply_background_layer_drag()
            event.accept()
            return None
        if self._dragging_subtitle:
            mode = self._subtitle_drag_mode
            if str(mode).startswith('scale'):
                self._apply_subtitle_font_scale_uniform(point.x(), point.y())
            elif mode == 'box_w':
                self._apply_subtitle_box_width(point.x())
            elif mode == 'scale_y':
                self._apply_subtitle_font_scale_uniform(point.x(), point.y(), axis='y')
            else:
                self._apply_subtitle_drag(point.y() - self._subtitle_drag_offset_y)
            event.accept()
            return None
        if self._dragging_blur:
            self._apply_blur_drag(point.x(), point.y())
            event.accept()
            return None
        if self._dragging_crop:
            self._apply_crop_drag(point.x(), point.y())
            event.accept()
            return None
        if self._dragging_video:
            if self._video_drag_mode == 'scale':
                if self._uniform_scale_active():
                    self._apply_video_scale_uniform(point.x(), point.y())
                else:
                    self._apply_video_scale_freeform(point.x(), point.y())
            elif self._video_drag_mode == 'scale_x':
                self._apply_video_scale_axis(point.x(), point.y(), axis='x')
            elif self._video_drag_mode == 'scale_y':
                self._apply_video_scale_axis(point.x(), point.y(), axis='y')
            else:
                self._apply_video_pan(point.x() - self._video_drag_last_x, point.y() - self._video_drag_last_y)
                self._video_drag_last_x = point.x()
                self._video_drag_last_y = point.y()
            event.accept()
            return None
        hit = self._hit_test_interactive(point)
        if hit is None:
            self.unsetCursor()
            if self._hover_kind:
                self._hover_kind = ''
                self._hover_mode = ''
                self.update()
        else:
            _kind, mode = (hit[0], hit[1])
            self._hover_kind = _kind
            self._hover_mode = str(mode)
            mode_text = str(mode)
            if mode_text.startswith('crop'):
                self.setCursor(self._crop_cursor(mode_text))
            elif mode_text.startswith('scale:'):
                corner = mode_text.split(':', 1)[1]
                self.setCursor(self._corner_scale_cursor(corner))
            elif mode_text == 'scale':
                self.setCursor(Qt.CursorShape.SizeFDiagCursor)
            elif mode_text.startswith('mask_feather'):
                axis = mode_text.split(':', 1)[1] if ':' in mode_text else 'y'
                self.setCursor(Qt.CursorShape.SizeHorCursor if axis == 'x' else Qt.CursorShape.SizeVerCursor)
            elif mode_text == 'box_w':
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            elif mode_text == 'scale_x':
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            elif mode_text in frozenset({'resize_top', 'scale_y', 'resize_bottom'}) or mode_text.endswith(('resize_top', 'resize_bottom')):
                self.setCursor(Qt.CursorShape.SizeVerCursor)
            elif 'resize_left' in mode_text or 'resize_right' in mode_text:
                self.setCursor(Qt.CursorShape.SizeHorCursor)
            else:
                self.setCursor(Qt.CursorShape.OpenHandCursor)
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:
        if self._dragging_navigator or self._dragging_view_pan:
            self._dragging_navigator = False
            self._dragging_view_pan = False
            self.unsetCursor()
            self.update()
            event.accept()
            return None
        if event.button() != Qt.MouseButton.LeftButton:
            super().mouseReleaseEvent(event)
            return None
        if self._dragging_title:
            self._dragging_title = False
            self._title_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._title_anchor_y_norm is not None:
                self.state.values['video_title_y_norm'] = max(0.0, min(1.0, float(self._title_anchor_y_norm)))
                self._pending_title_placement = (float(self.state.values.get('video_title_x_norm', 0.5)), float(self.state.values['video_title_y_norm']))
            self._title_anchor_y_norm = None
            self._live_title_box_w_norm = None
            self._live_title_scale_percent = None
            if self._pending_title_box_width is not None:
                self.videoTitleBoxWidthChanged.emit(self._pending_title_box_width)
                self._pending_title_box_width = None
            if self._pending_title_layout is not None:
                self.videoTitleLayoutChanged.emit()
                self._pending_title_layout = None
            elif self._pending_title_placement is not None:
                self.videoTitlePlacementChanged.emit()
                self._pending_title_placement = None
            event.accept()
            return None
        if self._dragging_text_overlay:
            self._dragging_text_overlay = False
            self._text_overlay_drag_mode = 'move'
            self._layer_drag_base = None
            self._text_move_layout_cache = None
            self._clear_alignment_guides()
            if self._text_anchor_y_norm is not None:
                self.state.values['text_overlay_y_norm'] = max(0.0, min(1.0, float(self._text_anchor_y_norm)))
                self._pending_text_overlay_placement = (float(self.state.values.get('text_overlay_x_norm', 0.5)), float(self.state.values['text_overlay_y_norm']))
            self._text_anchor_y_norm = None
            self._live_text_box_w_norm = None
            self._live_text_scale_percent = None
            if self._pending_text_overlay_layout is not None:
                self.textOverlayLayoutChanged.emit()
                self._pending_text_overlay_layout = None
            elif self._pending_text_overlay_placement is not None:
                self.textOverlayPlacementChanged.emit()
                self._pending_text_overlay_placement = None
            event.accept()
            return None
        if self._dragging_logo:
            self._dragging_logo = False
            self._logo_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._pending_logo_placement is not None:
                x_norm, y_norm = (self._pending_logo_placement[0], self._pending_logo_placement[1])
                self.logoPlacementChanged.emit(x_norm, y_norm)
                self._pending_logo_placement = None
            if self._pending_logo_scale is not None:
                self.logoScaleChanged.emit(self._pending_logo_scale)
                self._pending_logo_scale = None
            event.accept()
            return None
        if self._dragging_overlay:
            self._dragging_overlay = False
            self._overlay_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._pending_overlay_mask is not None:
                self.overlayMaskChanged.emit()
                self._pending_overlay_mask = None
            if self._pending_effect_overlay is not None:
                self.effectOverlayChanged.emit()
                self._pending_effect_overlay = None
            event.accept()
            return None
        if self._dragging_blend:
            self._dragging_blend = False
            self._blend_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._pending_blend_layer is not None:
                self.blendLayerChanged.emit()
                self._pending_blend_layer = None
            event.accept()
            return None
        if self._dragging_background:
            self._dragging_background = False
            self._background_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._pending_background_layer is not None:
                self.backgroundLayerChanged.emit()
                self._pending_background_layer = None
            event.accept()
            return None
        if self._dragging_subtitle:
            self._dragging_subtitle = False
            self._clear_alignment_guides()
            self._finalize_subtitle_placement()
            self._live_subtitle_top_norm = None
            if self._subtitle_anchor_y_norm is not None and (not self.last_subtitle_rect.isNull()):
                target = self._target_rect()
                self._commit_subtitle_placement_from_center(target.top() + target.height() * self._subtitle_anchor_y_norm)
            self._subtitle_anchor_y_norm = None
            self._live_subtitle_box_w_norm = None
            self._live_subtitle_font_size = None
            if self._pending_subtitle_placement is not None:
                if self._subtitle_drag_layer != 'source':
                    position, margin = (self._pending_subtitle_placement[0], self._pending_subtitle_placement[1])
                    self.subtitlePlacementChanged.emit(position, margin)
                self._pending_subtitle_placement = None
            if self._pending_subtitle_font_size is not None:
                self.subtitleFontSizeChanged.emit(self._pending_subtitle_font_size)
                self._pending_subtitle_font_size = None
            if self._pending_subtitle_scale is not None:
                self.subtitleScaleChanged.emit()
                self._pending_subtitle_scale = None
            if self._pending_subtitle_box_width is not None:
                self.subtitleBoxWidthChanged.emit(self._pending_subtitle_box_width)
                self._pending_subtitle_box_width = None
            self._subtitle_show_longest = False
            self._subtitle_drag_mode = 'move'
            self._subtitle_drag_layer = 'working'
            event.accept()
            return None
        if self._dragging_blur:
            self._dragging_blur = False
            self._clear_alignment_guides()
            sync_controls_from_selected_blur(self.state.values)
            self.blurZonesChanged.emit()
            event.accept()
            return None
        if self._dragging_crop:
            self._dragging_crop = False
            self._crop_drag_mode = 'move'
            if self._pending_video_crop is not None:
                self.videoCropChanged.emit()
                self._pending_video_crop = None
            event.accept()
            return None
        if self._dragging_video:
            self._dragging_video = False
            self._video_drag_mode = 'move'
            self._clear_alignment_guides()
            if self._pending_video_transform is not None:
                offset_x, offset_y, scale_x, scale_y = (self._pending_video_transform[0], self._pending_video_transform[1], self._pending_video_transform[2], self._pending_video_transform[3])
                self.videoTransformChanged.emit(offset_x, offset_y, scale_x, scale_y)
                self._pending_video_transform = None
            event.accept()
            return None
        if self._dragging_rotation:
            self._dragging_rotation = False
            self._rotation_kind = ''
            self._guide_show_center = False
            self._guide_snap_rotation = False
            self._clear_alignment_guides()
            if self._pending_layer_rotation is not None:
                kind, deg = (self._pending_layer_rotation[0], self._pending_layer_rotation[1])
                self.previewLayerRotationChanged.emit(kind, deg)
                self._pending_layer_rotation = None
            event.accept()
            return None
        super().mouseReleaseEvent(event)

    def wheelEvent(self, event) -> None:
        modifiers = event.modifiers()
        ctrl_down = bool(modifiers & Qt.KeyboardModifier.ControlModifier)
        steps = self._wheel_zoom_steps(event)
        if ctrl_down and self.has_frame and (steps != 0):
            self._apply_preview_view_zoom(steps, event.position().x(), event.position().y())
            event.accept()
            return None
        if not self.has_frame or not self._target_rect().contains(event.position()):
            super().wheelEvent(event)
            return None
        if self._selection and self._selection != 'video':
            event.accept()
            return None
        self._selection = 'video'
        steps = event.angleDelta().y() / 120.0
        if steps == 0:
            super().wheelEvent(event)
            return None
        if self._is_crop_editing():
            self._apply_crop_zoom(steps)
            event.accept()
            return None
        sx, sy = (self._current_scale_xy()[0], self._current_scale_xy()[1])
        scale_x = max(10, min(500, int(round(sx + steps * 4))))
        scale_y = max(10, min(500, int(round(sy + steps * 4))))
        if scale_x == sx and scale_y == sy:
            event.accept()
            return None
        self._set_scale_xy(scale_x, scale_y)
        offset_x = int(self.state.values.get('offset_x', 0))
        offset_y = int(self.state.values.get('offset_y', 0))
        self.videoTransformChanged.emit(offset_x, offset_y, scale_x, scale_y)
        self.update()
        event.accept()

    def paintEvent(self, _event) -> None:
        from core.scene_clip_fx import apply_frame_adjust_gate
        values = apply_frame_adjust_gate(self.state.values)
        if self._dragging_text_overlay and self._layer_drag_base is not None and (not self._capturing_drag_base) and (not self._layer_drag_base.isNull()):
            painter = QPainter(self)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing, False)
            painter.drawPixmap(0, 0, self._layer_drag_base)
            target = self._target_rect()
            self._draw_text_overlay(painter, target)
            self._draw_alignment_guides(painter, target)
            self._draw_selection_chrome(painter)
            return None
        if self.has_frame:
            frame = self._display_frame(values)
            if self._playback_fast_paint_eligible(values):
                painter = QPainter(self)
                self._paint_playback_fast(painter, values, frame)
                return None
            painter = QPainter(self)
            drag_fast = self._any_drag_active()
            fast_playback = self._playback_active or drag_fast
            if not fast_playback:
                painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, not drag_fast)
            painter.fillRect(self.rect(), self._workspace_fill_color())
            target = self._target_rect()
            painter.fillRect(target, self._preview_canvas_fill_color())
            self._paint_target_content(painter, target, values, frame, fast=fast_playback)
            self._draw_canvas_video_effect(painter, target)
            self._draw_blend_layers(painter, target, values, frame)
            self._draw_video_track_overlays(painter, target)
            self._draw_media_overlays(painter, target)
            border = int(values.get('border_pixels', 0))
            if border > 0:
                painter.setPen(QPen(QColor('#05070A'), border))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawRect(target.adjusted(border / 2, border / 2, -border / 2, -border / 2))
            if not self.logo_image.isNull():
                self._draw_logo(painter, target)
            self._draw_video_title(painter, target)
            if not self._suppress_text_overlay_paint:
                self._draw_text_overlay(painter, target)
            self._draw_subtitle(painter, target)
            self._draw_export_frame_border(painter, target)
            if not self._capturing_drag_base:
                self._draw_alignment_guides(painter, target)
                self._draw_selection_chrome(painter)
            if abs(self._view_zoom - 1.0) > 0.02:
                painter.save()
                painter.setPen(QColor('#9EB0C7'))
                painter.drawText(self.rect().adjusted(10, 0, -10, -8), Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignBottom, f'Preview {int(round(self._view_zoom * 100))}% · Ctrl+wheel · double-click reset · kéo map để nhích')
                painter.restore()
                self._draw_preview_navigator(painter)
                return None
        else:
            painter = QPainter(self)
            painter.fillRect(self.rect(), self._workspace_fill_color())
            target = self._target_rect()
            painter.fillRect(target, self._preview_canvas_fill_color())
            painter.setPen(QColor('#91A1B8'))
            painter.drawText(target, Qt.AlignmentFlag.AlignCenter, 'Đang nạp video…')
            return None

    def _capture_text_drag_base(self) -> None:
        self._layer_drag_base = None
        if not self.has_frame or self.width() < 2 or self.height() < 2:
            pass
        else:
            self._capturing_drag_base = True
            self._suppress_text_overlay_paint = True
            try:
                dpr = float(self.devicePixelRatioF() or 1.0)
                pix = QPixmap(int(self.width() * dpr), int(self.height() * dpr))
                if not pix.isNull():
                    pix.setDevicePixelRatio(dpr)
                    self.render(pix)
                    self._layer_drag_base = pix
                return None
            except Exception:
                self._layer_drag_base = None
            finally:
                self._capturing_drag_base = False
                self._suppress_text_overlay_paint = False

    def _paint_target_content(self, painter: QPainter, target: QRectF, values: dict, frame: QImage, *, fast: bool) -> None:
        if values.get('background') == 'blur':
            strength = max(0.0, min(1.0, float(values.get('background_blur_strength', 40)) / 100))
            painter.fillRect(target, self._preview_canvas_fill_color())
            freeze_blur = bool(getattr(self, '_scrubbing_preview', False) or getattr(self, '_playback_active', False))
            if freeze_blur and self._playback_active:
                blur_token = ('play', int(self.position_ms // 500))
            else:
                blur_token = 'scrub' if freeze_blur else id(self._frame)
            blur_key = (blur_token, int(target.width()), int(target.height()), round(strength, 3), bool(values.get('mirror_enabled')))
            if self._cached_blur_bg is not None and self._cached_blur_key == blur_key and (self._cached_blur_pixmap is not None):
                pass
            elif fast and self._cached_blur_bg is not None and (self._cached_blur_pixmap is not None):
                pass
            else:
                bg = self._blurred_background_frame(target, strength)
                self._cached_blur_bg = bg
                self._cached_blur_key = blur_key
                self._cached_blur_pixmap = QPixmap.fromImage(bg)
            painter.drawPixmap(int(target.left()), int(target.top()), self._cached_blur_pixmap)
            if strength > 0.02:
                painter.fillRect(target, QColor(8, 11, 16, int(20 + 70 * strength)))
        self._draw_background_layer_fill(painter, target, values)
        crop_editing = self._is_crop_editing()
        if crop_editing:
            fit = self._fit_frame(target, frame)
            fit.moveCenter(target.center())
            self.last_video_rect = QRectF(fit)
            left, top, right, bottom = (self._crop_norm_values()[0], self._crop_norm_values()[1], self._crop_norm_values()[2], self._crop_norm_values()[3])
            self.last_crop_rect = self._map_crop_rect(fit, left, top, right, bottom)
            painter.save()
            painter.setClipRect(target)
            painter.drawImage(fit, frame)
            self._draw_crop_dimmer(painter, fit, self.last_crop_rect)
        else:
            active = self._cropped_frame(frame)
            sx, sy = (self._current_scale_xy()[0], self._current_scale_xy()[1])
            motion = str(values.get('motion', 'still'))
            seconds = self.position_ms / 1000.0
            motion_i = motion_intensity_factor(int(values.get('motion_intensity_percent', 50) or 50))
            auto_boost = 1.0
            if values.get('auto_zoom_enabled') and motion_i > 0.0:
                auto_boost = auto_zoom_boost_at(seconds, az_val=float(values.get('auto_zoom_val', 1.3)), az_sec=float(values.get('auto_zoom_sec', 3.0)), az_hold=float(values.get('auto_zoom_hold', 0.5)), az_rand=bool(values.get('auto_zoom_rand')), intensity=motion_i)
            elif motion in frozenset({'zoom_out', 'zoom_in'}):
                auto_boost = gradual_zoom_boost(seconds, motion, motion_i)
            elif motion == 'ken_burns':
                auto_boost = gradual_zoom_boost(seconds, 'zoom_in', motion_i)
            ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
            plate_local = ref_h > ref_w
            content_boost = auto_boost if plate_local else 1.0
            frame_boost = 1.0 if plate_local else auto_boost
            fg_w, fg_h = (resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[0], resolve_foreground_pixel_size(source_width=active.width(), source_height=active.height(), target_width=ref_w, target_height=ref_h, scale_x_percent=sx, scale_y_percent=sy)[1])
            preview_scale_x = target.width() / max(1, ref_w)
            preview_scale_y = target.height() / max(1, ref_h)
            fit_w = fg_w * preview_scale_x * frame_boost
            fit_h = fg_h * preview_scale_y * frame_boost
            draw_active = self._processed_video_frame(frame, values)
            offset_x = float(values.get('offset_x', 0)) * preview_scale_x
            offset_y = float(values.get('offset_y', 0)) * preview_scale_y
            shake_x = 0.0
            shake_y = 0.0
            if motion == 'shake' and motion_i > 0.0:
                shake_x, shake_y = (shake_offsets_px(seconds, intensity=motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[0], shake_offsets_px(seconds, intensity=motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[1])
                if not plate_local:
                    offset_x += shake_x
                    offset_y += shake_y
            elif motion in PAN_MOTIONS and motion_i > 0.0:
                pan_x, pan_y = (pan_offsets_px(seconds, motion, motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[0], pan_offsets_px(seconds, motion, motion_i, unit_x=preview_scale_x, unit_y=preview_scale_y)[1])
                if plate_local:
                    shake_y, shake_x = (pan_y, pan_x)
                else:
                    offset_x += pan_x
                    offset_y += pan_y
            video_center_x = target.center().x() + offset_x
            video_center_y = target.center().y() + offset_y
            self.last_video_rect = QRectF(video_center_x - fit_w / 2, video_center_y - fit_h / 2, fit_w, fit_h)
            self.last_crop_rect = QRectF()
            painter.save()
            plate_layout = self._face_plate_cover_layout(target, values, draw_active)
            if plate_layout is not None:
                plate_clip, video_center_x, video_center_y, fit_w, fit_h = (plate_layout[0], plate_layout[1], plate_layout[2], plate_layout[3], plate_layout[4])
                self.last_video_rect = QRectF(plate_clip)
                painter.setClipRect(plate_clip)
            elif plate_local:
                painter.setClipRect(self.last_video_rect.intersected(target))
            else:
                painter.setClipRect(target)
            painter.translate(video_center_x, video_center_y)
            painter.rotate(float(values.get('rotation_degrees', 0)))
            if plate_local and (content_boost != 1.0 or shake_x or shake_y):
                painter.translate(shake_x, shake_y)
                painter.scale(content_boost, content_boost)
            draw_rect = QRectF(-fit_w / 2, -fit_h / 2, fit_w, fit_h)
            painter.drawImage(draw_rect, draw_active)
            self._draw_clip_transition_preview(painter, draw_rect, values)
        painter.restore()
        self._draw_blur_zones(painter, target)

    def _target_rect(self) -> QRectF:
        base_w, base_h, available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
        zoom = max(self._VIEW_ZOOM_MIN, min(self._VIEW_ZOOM_MAX, float(self._view_zoom)))
        zw = base_w * zoom
        zh = base_h * zoom
        cx = available.center().x() + float(self._view_pan_x)
        cy = available.center().y() + float(self._view_pan_y)
        return QRectF(cx - zw / 2, cy - zh / 2, zw, zh)

    def _base_canvas_fit_size(self) -> tuple[float, float, QRectF]:
        pad_x, pad_y = ((12, 12)[0], (12, 12)[1])
        available = QRectF(self.rect()).adjusted(pad_x, pad_y, -pad_x, -pad_y)
        ratio = self.output_ratio
        width = available.width()
        height = width / ratio
        if height > available.height():
            height = available.height()
            width = height * ratio
        return (width, height, available)

    def _wheel_zoom_steps(self, event) -> float:
        pixel = event.pixelDelta()
        if not pixel.isNull() and abs(pixel.y()) > 0:
            return max(-2.5, min(2.5, float(pixel.y()) / 40.0))
        angle = float(event.angleDelta().y())
        return 0.0 if angle == 0 else max(-3.0, min(3.0, angle / 120.0))

    def _apply_preview_view_zoom(self, steps: float, focal_x: float, focal_y: float) -> None:
        if steps == 0:
            return None
        base_w, base_h, available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
        old_target = self._target_rect()
        nx = (focal_x - old_target.left()) / max(1.0, old_target.width())
        ny = (focal_y - old_target.top()) / max(1.0, old_target.height())
        factor = math.pow(1.08, float(steps))
        new_zoom = max(self._VIEW_ZOOM_MIN, min(self._VIEW_ZOOM_MAX, float(self._view_zoom) * factor))
        if abs(new_zoom - 1.0) <= self._VIEW_ZOOM_FIT_SNAP:
            new_zoom = 1.0
        if abs(new_zoom - self._view_zoom) < 0.0001:
            return None
        self._view_zoom = new_zoom
        if new_zoom <= 1.000001:
            self._view_pan_x = 0.0
            self._view_pan_y = 0.0
        else:
            zw = base_w * new_zoom
            zh = base_h * new_zoom
            center_x = focal_x + zw * (0.5 - nx)
            center_y = focal_y + zh * (0.5 - ny)
            self._view_pan_x = center_x - available.center().x()
            self._view_pan_y = center_y - available.center().y()
            self._clamp_view_pan()
        self.update()

    def reset_preview_view_zoom(self) -> None:
        self._view_zoom = 1.0
        self._view_pan_x = 0.0
        self._view_pan_y = 0.0
        self._dragging_view_pan = False
        self._dragging_navigator = False
        self.update()

    def _preview_view_zoomed(self) -> bool:
        return abs(float(self._view_zoom) - 1.0) > 0.02

    def _navigator_map_rect(self) -> QRectF | None:
        if self._preview_view_zoomed():
            base_w, base_h, _available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
            if base_w < 8 or base_h < 8:
                return None
            side = min(96.0, max(64.0, min(self.width(), self.height()) * 0.16))
            if base_w >= base_h:
                nw = side
                nh = side * (base_h / base_w)
            else:
                nh = side
                nw = side * (base_w / base_h)
            margin = 10.0
            x = self.width() - nw - margin
            y = max(margin, (self.height() - nh) * 0.42)
            return QRectF(x, y, nw, nh)

    def _navigator_viewport_rect(self, map_rect: QRectF) -> QRectF:
        base_w, base_h, available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
        zoom = max(self._VIEW_ZOOM_MIN, min(self._VIEW_ZOOM_MAX, float(self._view_zoom)))
        view_w = available.width() / zoom
        view_h = available.height() / zoom
        target = self._target_rect()
        left = (available.left() - target.left()) / zoom
        top = (available.top() - target.top()) / zoom
        left = max(0.0, min(base_w, left))
        top = max(0.0, min(base_h, top))
        vw = min(base_w, max(1.0, available.width() / zoom))
        vh = min(base_h, max(1.0, available.height() / zoom))
        if left + vw > base_w:
            left = max(0.0, base_w - vw)
        if top + vh > base_h:
            top = max(0.0, base_h - vh)
        sx = map_rect.width() / base_w
        sy = map_rect.height() / base_h
        return QRectF(map_rect.left() + left * sx, map_rect.top() + top * sy, vw * sx, vh * sy)

    def _clamp_view_pan(self) -> None:
        if self._preview_view_zoomed():
            base_w, base_h, available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
            zoom = float(self._view_zoom)
            zw = base_w * zoom
            zh = base_h * zoom
            max_x = max(0.0, (zw - available.width()) / 2 + 24.0)
            max_y = max(0.0, (zh - available.height()) / 2 + 24.0)
            self._view_pan_x = max(-max_x, min(max_x, float(self._view_pan_x)))
            self._view_pan_y = max(-max_y, min(max_y, float(self._view_pan_y)))
        else:
            self._view_pan_x = 0.0
            self._view_pan_y = 0.0
            return None

    def _set_view_pan_from_navigator_point(self, nx: float, ny: float) -> None:
        map_rect = self._navigator_map_rect()
        if map_rect is None:
            return None
        base_w, base_h, available = (self._base_canvas_fit_size()[0], self._base_canvas_fit_size()[1], self._base_canvas_fit_size()[2])
        zoom = float(self._view_zoom)
        rel_x = (nx - map_rect.left()) / max(1.0, map_rect.width())
        rel_y = (ny - map_rect.top()) / max(1.0, map_rect.height())
        rel_x = max(0.0, min(1.0, rel_x))
        rel_y = max(0.0, min(1.0, rel_y))
        cx = rel_x * base_w
        cy = rel_y * base_h
        self._view_pan_x = zoom * (base_w / 2.0 - cx)
        self._view_pan_y = zoom * (base_h / 2.0 - cy)
        self._clamp_view_pan()
        self.update()

    def _draw_preview_navigator(self, painter) -> None:
        map_rect = self._navigator_map_rect()
        if map_rect is None:
            return None
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setPen(QPen(QColor(80, 100, 130, 200), 1.0))
        painter.setBrush(QColor(28, 36, 48, 210))
        painter.drawRoundedRect(map_rect, 4, 4)
        inner = map_rect.adjusted(3, 3, -3, -3)
        painter.setPen(QPen(QColor(90, 110, 140, 160), 1.0))
        painter.setBrush(QColor(40, 52, 68, 180))
        painter.drawRect(inner)
        view = self._navigator_viewport_rect(inner)
        painter.setPen(QPen(QColor(110, 180, 255, 230), 1.5))
        painter.setBrush(QColor(100, 170, 255, 70))
        painter.drawRect(view)
        painter.restore()

    def mouseDoubleClickEvent(self, event) -> None:
        if event.button() != Qt.MouseButton.LeftButton:
            super().mouseDoubleClickEvent(event)
            return None
        hit = self._hit_test_interactive(event.position())
        if hit is None and abs(float(self._view_zoom) - 1.0) > 0.01:
            self.reset_preview_view_zoom()
            event.accept()
            return None
        super().mouseDoubleClickEvent(event)

    def _fit_frame(self, target: QRectF, frame: QImage | None=None) -> QRectF:
        image = frame if frame is None or frame.isNull() else self._frame
        source_ratio = image.width() / max(1, image.height())
        width = target.width()
        height = width / source_ratio
        if height > target.height():
            height = target.height()
            width = height * source_ratio
        return QRectF(0, 0, width, height)

    def _blurred_background_frame(self, target: QRectF, strength: float) -> QImage:
        tw = max(2, int(target.width()))
        th = max(2, int(target.height()))
        source = self._cropped_frame(self._frame) if self.state.values.get('crop_enabled') else self._frame
        preview_cap = 540
        work_scale = min(1.0, preview_cap / max(tw, th, 1))
        work_w = max(2, int(tw * work_scale))
        work_h = max(2, int(th * work_scale))
        covered = source.scaled(work_w, work_h, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.FastTransformation)
        x = max(0, (covered.width() - work_w) // 2)
        y = max(0, (covered.height() - work_h) // 2)
        cropped = covered.copy(x, y, work_w, work_h)
        if strength <= 0.01:
            return cropped.scaled(tw, th, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
        factor = max(0.04, 1.0 - 0.92 * strength)
        small_w = max(2, int(work_w * factor))
        small_h = max(2, int(work_h * factor))
        soft = cropped.scaled(small_w, small_h, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.FastTransformation)
        return soft.scaled(tw, th, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)

    def _processed_video_frame(self, source_frame: QImage, values: dict) -> QImage:
        color_filt = str(values.get('color_filter', 'none'))
        color_strength = int(values.get('color_filter_strength', 70) or 0)
        lut_fp = lut_stack_fingerprint(values.get('color_lut_stack'), master=bool(values.get('color_lut_stack_master_enabled', True)))
        crop_key = self._crop_norm_values()
        wx, wy = (self._clip_warp_xy(values)[0], self._clip_warp_xy(values)[1])
        key = (id(source_frame), crop_key, color_filt, color_strength, lut_fp, bool(values.get('crop_enabled')), wx, wy)
        if self._processed_frame_key != key or self._processed_frame_cache is None or self._processed_frame_cache.isNull():
            active = self._cropped_frame(source_frame)
            active = self._warp_frame_inside_box(active, wx, wy)
            filtered = apply_color_filter_qimage(active, color_filt, color_strength)
            if bool(values.get('color_lut_stack_master_enabled', True)):
                filtered = apply_lut_stack_qimage(filtered, values.get('color_lut_stack'))
            self._processed_frame_key = key
            self._processed_frame_cache = filtered
            return filtered
        return self._processed_frame_cache

    def _clip_transition_hit(self, values: dict | None=None) -> tuple[str, float] | None:
        vals = values if values is not None else self.state.values
        try:
            from core.timeline_clips import clips_from_values, clips_on_track
            from core.timeline_transitions import effective_transition_ms, resolve_preview_transition_hit
            fade_ms = effective_transition_ms(vals)
            if fade_ms > 0:
                clips = clips_on_track(clips_from_values(vals), 0)
                spans = [(int(c.timeline_start_ms), max(1, int(c.duration_ms))) for c in clips]
                seed_raw = vals.get('timeline_transition_seed', 0)
                try:
                    seed = int(seed_raw) if seed_raw is not None else None
                except (TypeError, ValueError):
                    seed = None
                return resolve_preview_transition_hit(int(self.position_ms), spans, fade_ms=fade_ms, mode=str(vals.get('timeline_transition_mode', 'one_for_all') or 'one_for_all'), style=str(vals.get('timeline_transition_style', 'fade') or 'fade'), random_pool=vals.get('timeline_transition_random_pool'), seed=seed)
        except Exception:
            pass

    def _clip_transition_blend_state(self, values: dict | None=None) -> tuple[str, float, bool] | None:
        vals = values if values is not None else self.state.values
        hit = self._clip_transition_hit(vals)
        if hit is None:
            return None
        style, t = (hit[0], hit[1])
        incoming = False
        try:
            from core.timeline_clips import clips_from_values, clips_on_track
            pos = int(self.position_ms)
            for clip in clips_on_track(clips_from_values(vals), 0):
                start = int(clip.timeline_start_ms)
                end = start + max(1, int(clip.duration_ms))
                if start <= pos < end:
                    break
            incoming = pos - start < end - pos
        except Exception:
            incoming = False
        return (style, float(t), incoming)

    def _capture_xfade_hold(self, pixmap: QPixmap, values: dict | None=None) -> None:
        del pixmap, values

    def _clip_transition_fade_alpha(self, values: dict | None=None) -> int:
        hit = self._clip_transition_hit(values)
        if hit is None:
            return 0
        _style, t = (hit[0], hit[1])
        return max(0, min(255, int(round(230 * float(t)))))

    def _draw_clip_transition_preview(self, painter: QPainter, rect: QRectF, values: dict | None=None) -> None:
        hit = self._clip_transition_hit(values)
        if hit is None:
            return None
        style, t = (hit[0], hit[1])
        if t <= 0.01:
            return None
        from core.timeline_transitions import style_label, style_xfade_name
        xfade = style_xfade_name(style) or 'fade'
        painter.save()
        painter.setClipRect(rect)
        if xfade in frozenset({'hblur', 'fadegrays', 'dissolve', 'fade'}):
            painter.fillRect(rect, QColor(0, 0, 0, int(230 * t)))
        elif xfade == 'fadeblack':
            painter.fillRect(rect, QColor(0, 0, 0, int(255 * min(1.0, t * 1.15))))
        elif xfade == 'fadewhite':
            painter.fillRect(rect, QColor(255, 255, 255, int(230 * t)))
        elif 'left' in xfade:
            w = rect.width() * t
            painter.fillRect(QRectF(rect.right() - w, rect.y(), w, rect.height()), QColor(0, 0, 0, 210))
        elif 'right' in xfade:
            w = rect.width() * t
            painter.fillRect(QRectF(rect.x(), rect.y(), w, rect.height()), QColor(0, 0, 0, 210))
        elif 'up' in xfade:
            h = rect.height() * t
            painter.fillRect(QRectF(rect.x(), rect.bottom() - h, rect.width(), h), QColor(0, 0, 0, 210))
        elif 'down' in xfade:
            h = rect.height() * t
            painter.fillRect(QRectF(rect.x(), rect.y(), rect.width(), h), QColor(0, 0, 0, 210))
        elif 'circle' in xfade:
            from PySide6.QtGui import QPainterPath
            path = QPainterPath()
            path.addRect(rect)
            hole = QPainterPath()
            hole.addEllipse(rect.center(), rect.width() * 0.55 * (1.0 - t), rect.height() * 0.55 * (1.0 - t))
            painter.fillPath(path.subtracted(hole), QColor(0, 0, 0, 200))
        else:
            painter.fillRect(rect, QColor(0, 0, 0, int(220 * t)))
        if t > 0.35:
            painter.setPen(QColor(255, 255, 255, min(220, int(180 + 60 * t))))
            painter.drawText(rect.adjusted(8, 8, -8, -8), int(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft), style_label(style))
        painter.restore()

    def _background_color(self) -> QColor:
        background = str(self.state.values.get('background', 'black'))
        return QColor('#30343B') if background == 'gray' else QColor('#000000')

    def _workspace_fill_color(self) -> QColor:
        from ui_qt.preview_workspace_colors import resolve_workspace_color
        return QColor(resolve_workspace_color(self.state.values))

    def _export_canvas_base_color(self) -> QColor:
        from ui_qt.preview_workspace_colors import resolve_canvas_color
        return QColor(resolve_canvas_color(self.state.values))

    def _preview_canvas_fill_color(self) -> QColor:
        background = str(self.state.values.get('background', 'black'))
        return QColor('#30343B') if background == 'gray' else self._export_canvas_base_color()

    def _pasteboard_enabled(self) -> bool:
        return bool(self.state.values.get('preview_pasteboard_enabled', True))

    def _track_hidden(self, kind: str) -> bool:
        return track_preview_hidden(self.state.values, kind)

    def _track_locked(self, kind: str) -> bool:
        return track_edit_locked(self.state.values, kind)

    def _point_to_norm(self, center_x: float, center_y: float, *, clamp: bool | None) -> tuple[float, float]:
        target = self._target_rect()
        x_norm = (center_x - target.left()) / max(1.0, target.width())
        y_norm = (center_y - target.top()) / max(1.0, target.height())
        if clamp is None:
            clamp = not self._pasteboard_enabled()
        if clamp:
            x_norm = max(0.0, min(1.0, x_norm))
            y_norm = max(0.0, min(1.0, y_norm))
        return (x_norm, y_norm)

    def _bounds_for_rotated_rect(self, rect: QRectF, degrees: float) -> QRectF:
        if abs(degrees) < 0.01 or rect.isNull():
            return QRectF(rect)
        rad = math.radians(degrees)
        cx = rect.center().x()
        cy = rect.center().y()
        w = rect.width()
        h = rect.height()
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        xs = []
        ys = []
        for dx, dy in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
            rx = dx * cos_a - dy * sin_a
            ry = dx * sin_a + dy * cos_a
            xs.append(cx + rx)
            ys.append(cy + ry)
        return QRectF(min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

    def _paint_image_centered_rotated(self, painter: QPainter, cx: float, cy: float, width: float, height: float, image: QImage, degrees: float) -> tuple[QRectF, QRectF]:
        local = QRectF(-width / 2, -height / 2, width, height)
        layout = QRectF(cx - width / 2, cy - height / 2, width, height)
        painter.save()
        painter.translate(cx, cy)
        painter.rotate(degrees)
        painter.drawImage(local, image)
        painter.restore()
        bounds = self._bounds_for_rotated_rect(layout, degrees)
        return (layout, bounds)

    def _rotation_handle_rect(self, rect: QRectF, rotation_degrees: float=0.0) -> QRectF:
        h = max(8.0, rect.height())
        offset = max(28.0, h * 0.16)
        rad = math.radians(float(rotation_degrees or 0))
        cx = rect.center().x()
        cy = rect.center().y()
        local_y = h / 2 + offset
        hx = cx - local_y * math.sin(rad)
        hy = cy + local_y * math.cos(rad)
        size = 18.0
        return QRectF(hx - size / 2, hy - size / 2, size, size)

    def _pointer_to_layer_local(self, px: float, py: float, center_x: float, center_y: float, rotation_degrees: float) -> tuple[float, float]:
        rad = math.radians(-float(rotation_degrees or 0))
        dx = px - center_x
        dy = py - center_y
        return (dx * math.cos(rad) - dy * math.sin(rad), dx * math.sin(rad) + dy * math.cos(rad))

    def _layer_local_distance(self, x1: float, y1: float, x2: float, y2: float, center_x: float, center_y: float, rotation_degrees: float) -> float:
        lx1, ly1 = (self._pointer_to_layer_local(x1, y1, center_x, center_y, rotation_degrees)[0], self._pointer_to_layer_local(x1, y1, center_x, center_y, rotation_degrees)[1])
        lx2, ly2 = (self._pointer_to_layer_local(x2, y2, center_x, center_y, rotation_degrees)[0], self._pointer_to_layer_local(x2, y2, center_x, center_y, rotation_degrees)[1])
        return math.hypot(lx1 - lx2, ly1 - ly2)

    def _normalize_rotation_degrees(self, degrees: float) -> float:
        return float(degrees) % 360.0

    def _layer_rotation_degrees(self, kind: str) -> float:
        values = self.state.values
        if kind == 'video':
            return float(values.get('rotation_degrees', 0) or 0)
        if kind == 'logo':
            return float(values.get('logo_rotation_degrees', 0) or 0)
        if kind == 'subtitle':
            return float(values.get('subtitle_rotation_degrees', 0) or 0)
        if kind == 'title':
            return float(values.get('video_title_rotation_degrees', 0) or 0)
        if kind == 'text':
            return float(values.get('text_overlay_rotation_degrees', 0) or 0)
        if kind == 'blur':
            return float(values.get('blur_zone_rotation_degrees', 0) or 0)
        item = selected_media_overlay(values)
        if kind == 'overlay' and item:
            return float(item.get('rotation_degrees', 0) or 0)
        item = selected_blend_layer(values)
        if kind == 'blend' and item:
            return float(item.get('rotation_degrees', 0) or 0)
        item = selected_background_layer(values)
        return float(item.get('rotation_degrees', 0) or 0) if kind == 'background' and item else 0.0

    def _set_layer_rotation_degrees(self, kind: str, degrees: float) -> None:
        deg = self._normalize_rotation_degrees(degrees)
        stored = int(round(deg)) if abs(deg - round(deg)) < 0.01 else round(deg, 2)
        values = self.state.values
        if kind == 'video':
            values['rotation_degrees'] = stored
        elif kind == 'logo':
            values['logo_rotation_degrees'] = stored
        elif kind == 'subtitle':
            values['subtitle_rotation_degrees'] = stored
        elif kind == 'title':
            values['video_title_rotation_degrees'] = stored
        elif kind == 'text':
            values['text_overlay_rotation_degrees'] = stored
        elif kind == 'blur':
            from ui_qt.blur_zones import ensure_blur_zones, sync_controls_from_selected_blur
            values['blur_zone_rotation_degrees'] = stored
            zones = ensure_blur_zones(values)
            idx = int(values.get('blur_zone_index', 0) or 0)
            if 0 <= idx < len(zones):
                zones[idx] = {**zones[idx], **{'rotation_degrees': stored}}
                values['blur_zones'] = zones
            sync_controls_from_selected_blur(values)
        elif kind == 'overlay':
            update_selected_media_overlay(values, rotation_degrees=stored)
            sync_flat_keys_from_selected(values)
        elif kind == 'blend':
            update_selected_blend_layer(values, rotation_degrees=stored)
            sync_flat_keys_from_selected_blend(values)
        elif kind == 'background':
            update_selected_background_layer(values, rotation_degrees=stored, fit_mode='free')
            sync_flat_keys_from_selected_background(values)
        self._pending_layer_rotation = (kind, float(deg))
        self.update()

    def _selection_chrome_rect(self, kind: str) -> QRectF:
        if kind == 'blur':
            idx = int(self.state.values.get('blur_zone_index', 0) or 0)
            layouts = getattr(self, 'last_blur_layout_rects', None) or []
            return (QRectF(self.last_blur_rects[idx]) if 0 <= idx < len(self.last_blur_rects) else QRectF()) if not 0 <= idx < len(layouts) or layouts[idx].isNull() else QRectF(layouts[idx])
        mapping = {'video': self.last_video_rect, 'subtitle': self.last_subtitle_rect, 'subtitle_source': getattr(self, 'last_subtitle_source_rect', QRectF()), 'title': self.last_video_title_rect, 'text': self.last_text_overlay_rect, 'logo': self.last_logo_layout_rect if self.last_logo_layout_rect.isNull() else self.last_logo_rect, 'overlay': self.last_effect_overlay_rect, 'blend': self.last_blend_rect, 'background': self.last_background_rect if self.last_background_rect.isNull() else self._target_rect()}
        rect = QRectF(mapping.get(kind, QRectF()))
        target = self._target_rect()
        clipped = rect.intersected(target)
        return clipped if kind == 'video' and (not rect.isNull()) and (not target.isNull()) and clipped.isValid() and (clipped.width() >= 2.0) and (clipped.height() >= 2.0) else rect

    def _layer_rotation_for_chrome(self, kind: str) -> float:
        return float(self._layer_rotation_degrees(kind))

    def _draw_pasteboard_guide(self, painter: QPainter, target: QRectF) -> None:
        if self._pasteboard_enabled():
            margin_w = target.width() * 0.45
            margin_h = target.height() * 0.45
            zone = QRectF(self.rect()).intersected(target.adjusted(-margin_w, -margin_h, margin_w, margin_h))
            painter.save()
            painter.setPen(QPen(QColor('#6E8098'), 1.0, Qt.PenStyle.DashLine))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(zone)
            label = 'Vùng kéo thêm (pasteboard) — ngoài viền xanh = không xuất'
            font = painter.font()
            font.setPointSize(8)
            painter.setFont(font)
            painter.setPen(QColor('#A8B8CC'))
            painter.drawText(zone.adjusted(6, 4, -6, 0), Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft, label)
            painter.restore()
        else:
            return None

    def _rect_off_export_frame(self, rect: QRectF, target: QRectF) -> bool:
        if rect.isNull() or rect.width() < 1 or rect.height() < 1:
            return False
        inner = target.adjusted(2, 2, -2, -2)
        return not inner.contains(rect)

    def _draw_off_export_hints(self, painter: QPainter, target: QRectF) -> None:
        if self._pasteboard_enabled():
            rects = []
            if not self.last_logo_rect.isNull():
                rects.append((QRectF(self.last_logo_rect), 'Logo'))
            if not self.last_effect_overlay_rect.isNull():
                rects.append((QRectF(self.last_effect_overlay_rect), 'Overlay'))
            for _idx, _layout, bounds in self.last_overlay_rects:
                rects.append((QRectF(bounds), 'Overlay'))
            blend_rects = getattr(self, 'last_blend_rects', None) or []
            for _idx, _layout, bounds in blend_rects:
                rects.append((QRectF(bounds), 'Hòa trộn'))
            painter.save()
            for rect, label in rects:
                if self._rect_off_export_frame(rect, target):
                    painter.setPen(QPen(QColor('#FF9F5A'), 2.0, Qt.PenStyle.DashLine))
                    painter.setBrush(QColor(255, 159, 90, 35))
                    painter.drawRect(rect)
                    painter.setPen(QColor('#FFD4A8'))
                    font = painter.font()
                    font.setPointSize(8)
                    font.setBold(True)
                    painter.setFont(font)
                    painter.drawText(rect.adjusted(2, 2, -2, -2), Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft, f'{label} (ngoài khung)')
                    center = rect.center()
                    edge = target.center()
                    painter.setPen(QPen(QColor('#FF9F5A'), 1.0, Qt.PenStyle.DotLine))
                    painter.drawLine(edge, center)
            painter.restore()
        else:
            return None

    def _draw_export_frame_border(self, painter: QPainter, target: QRectF) -> None:
        painter.save()
        glow = QColor('#3D9AE8')
        glow.setAlpha(70)
        painter.setPen(QPen(glow, 4.0))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawRect(target)
        painter.setPen(QPen(QColor('#7DD3FC'), 2.0, Qt.PenStyle.SolidLine))
        painter.drawRect(target)
        painter.restore()

    def _draw_blur_zones(self, painter: QPainter, target: QRectF) -> None:
        values = self.state.values
        self.last_blur_rects = []
        self.last_blur_layout_rects = []
        if values.get('blur_zone_enabled'):
            zones = ensure_blur_zones(values)
            selected = int(values.get('blur_zone_index', 0))
            strength = max(0.15, min(0.95, float(values.get('blur_strength', 20)) / 100))
            style = str(values.get('blur_zone_style', 'blur'))
            dynamic = bool(values.get('blur_zone_dynamic', True))
            for index, zone in enumerate(zones):
                if zone.get('enabled', True):
                    rect = QRectF(target.left() + target.width() * float(zone['x']), target.top() + target.height() * float(zone['y']), target.width() * float(zone['width']), target.height() * float(zone['height']))
                    rot = float(zone.get('rotation_degrees', 0) or 0)
                    cy, cx = (rect.center().y(), rect.center().x())
                    painter.save()
                    painter.translate(cx, cy)
                    painter.rotate(rot)
                    local = QRectF(-rect.width() / 2, -rect.height() / 2, rect.width(), rect.height())
                    if style == 'black':
                        painter.fillRect(local, QColor(0, 0, 0, int(230 * strength)))
                    elif style == 'color':
                        fill = QColor(str(values.get('blur_zone_color', '#000000') or '#000000'))
                        if not fill.isValid():
                            fill = QColor('#000000')
                        fill.setAlpha(int(230 * strength))
                        painter.fillRect(local, fill)
                    elif dynamic:
                        painter.fillRect(local, QColor(18, 22, 28, int(175 + 60 * strength)))
                        painter.fillRect(local.adjusted(0, local.height() * 0.15, 0, -local.height() * 0.15), QColor(30, 34, 40, int(80 * strength)))
                    else:
                        painter.fillRect(local, QColor(8, 11, 16, int(145 * strength)))
                    painter.restore()
                    hit_rect = self._bounds_for_rotated_rect(rect, rot)
                    self.last_blur_layout_rects.append(QRectF(rect))
                    self.last_blur_rects.append(hit_rect)
                    if (index != selected or self._selection != 'blur') and index == selected:
                        painter.setPen(QPen(QColor('#5CC8FF'), 1.5, Qt.PenStyle.DashLine))
                        painter.setBrush(Qt.BrushStyle.NoBrush)
                        painter.drawRect(hit_rect)
                else:
                    self.last_blur_rects.append(QRectF())
                    self.last_blur_layout_rects.append(QRectF())
        else:
            return None

    def _effect_overlay_is_on(self) -> bool:
        if media_overlays_master_enabled(self.state.values):
            overlays = ensure_media_overlays(self.state.values)
            return any((item.get('enabled', True) and Path(str(item.get('path', ''))).is_file() for item in overlays))
        return False

    def _track0_clip_at_playhead(self, values: dict) -> dict | None:
        raw = values.get('timeline_clips') or []
        if isinstance(raw, list) and raw:
            pos = max(0, int(self.position_ms))
            for item in raw:
                if isinstance(item, dict):
                    try:
                        start = int(item.get('timeline_start_ms', 0) or 0)
                        inn = int(item.get('source_in_ms', 0) or 0)
                        out = max(inn + 1, int(item.get('source_out_ms', inn + 1) or 0))
                        if int(item.get('track_index', 0) or 0) != 0:
                            pass
                        else:
                            dur = max(1, out - inn)
                            if start <= pos < start + dur:
                                return item
                    except (TypeError, ValueError):
                        pass

    def _clip_mirror_hflip(self, values: dict) -> bool:
        item = self._track0_clip_at_playhead(values)
        return bool(item.get('mirror_hflip', False)) if item else False

    def _clip_warp_xy(self, values: dict) -> tuple[int, int]:
        item = self._track0_clip_at_playhead(values)
        if item:
            try:
                wx = max(100, min(200, int(item.get('warp_x_percent', 100) or 100)))
                wy = max(100, min(200, int(item.get('warp_y_percent', 100) or 100)))
            except (TypeError, ValueError):
                return (100, 100)
            return (wx, wy)
        return (100, 100)

    def _warp_frame_inside_box(self, frame: QImage, wx: int, wy: int) -> QImage:
        if frame.isNull() or (wx == 100 and wy == 100):
            return frame
        width = max(1, int(frame.width()))
        height = max(1, int(frame.height()))
        nw = max(width, int(round(width * wx / 100.0)))
        nh = max(height, int(round(height * wy / 100.0)))
        if nw == width and nh == height:
            return frame
        scaled = frame.scaled(nw, nh, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
        x = max(0, (scaled.width() - width) // 2)
        y = max(0, (scaled.height() - height) // 2)
        return scaled.copy(x, y, width, height)

    def _display_frame(self, values: dict) -> QImage:
        if self._frame.isNull():
            pass
        else:
            want_flip = bool(values.get('mirror_enabled')) != bool(self._clip_mirror_hflip(values))
            if want_flip:
                frame_id = id(self._frame)
                key = (frame_id, True)
                if self._mirrored_frame_key != key or self._mirrored_frame is None:
                    self._mirrored_frame = self._frame.mirrored(True, False)
                    self._mirrored_frame_key = key
                return self._mirrored_frame
        return self._frame

    def _draw_blend_layers(self, painter: QPainter, target: QRectF, values: dict, frame: QImage) -> None:
        if not blend_layers_master_enabled(values):
            self.last_blend_rect = QRectF()
            self.last_blend_rects = []
            self.blend_layer_image = QImage()
            return None
        if self._track_hidden('text_logo'):
            self.last_blend_rect = QRectF()
            self.last_blend_rects = []
            self.blend_layer_image = QImage()
            return None
        layers = []
        selected = int(values.get('blend_layer_index', 0) or 0)
        for index, item in enumerate(ensure_blend_layers(values)):
            path = str(item.get('path', ''))
            image = self._blend_preview_image(path, layer=item)
            if not item.get('enabled', True) or item.get('preview_hidden') or (not path) or (not Path(path).is_file()) or (not self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))) or (image is None):
                pass
            else:
                layers.append((index, item, image))
        if layers:
            self.last_blend_rects = []
            self.last_blend_rect = QRectF()
            self.blend_layer_image = QImage()
            for index, item, image in layers:
                blend_mode = str(item.get('blend_mode', 'screen') or 'screen')
                opacity_pct = int(item.get('opacity', 15) or 15)
                x_norm = float(item.get('x_norm', 0.5) or 0.5)
                y_norm = float(item.get('y_norm', 0.5) or 0.5)
                scale_percent = int(item.get('scale_percent', 100) or 100)
                width = max(8.0, target.width() * float(scale_percent) / 100)
                aspect = image.height() / max(1, image.width())
                stretch = float(item.get('scale_aspect', 0) or 0)
                if stretch >= 0.05:
                    aspect = stretch
                if self._dragging_blend and index == selected and (float(self._layer_drag_lock_aspect) > 1e-06):
                    aspect = float(self._layer_drag_lock_aspect)
                height = width * aspect
                cx = target.left() + target.width() * x_norm
                cy = target.top() + target.height() * y_norm
                rot = float(item.get('rotation_degrees', 0) or 0)
                painter.save()
                if not self._playback_active:
                    painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
                if layer_uses_blend(blend_mode):
                    comp_name = qt_composition_mode(blend_mode)
                    comp = getattr(QPainter.CompositionMode, f'CompositionMode_{comp_name}', QPainter.CompositionMode.CompositionMode_SourceOver)
                    painter.setCompositionMode(comp)
                painter.setOpacity(max(0.0, min(1.0, float(opacity_pct) / 100)))
                layout, bounds = (self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[0], self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[1])
                painter.restore()
                self.last_blend_rects.append((index, layout, bounds))
                if index == selected:
                    self.last_blend_rect = QRectF(layout)
                    self.blend_layer_image = image
            if self.last_blend_rect.isNull():
                if self.last_blend_rects:
                    self.last_blend_rect = QRectF(self.last_blend_rects[-1][1])
                    idx = self.last_blend_rects[-1][0]
                    for layer_index, item, image in layers:
                        if layer_index == idx:
                            self.blend_layer_image = image
                            return None
                return None
        else:
            self.last_blend_rect = QRectF()
            self.last_blend_rects = []
            self.blend_layer_image = QImage()
            return None

    def _draw_canvas_video_effect(self, painter: QPainter, target: QRectF) -> None:
        values = self.state.values
        if bool(values.get('video_effect_master_enabled', True)):
            from core.video_effect_stack import active_effect_layers, ensure_effect_stack
            ensure_effect_stack(values)
            layers = active_effect_layers(values.get('video_effect_stack'), master=True)
            if layers:
                seconds = self.position_ms / 1000.0
                for layer in layers:
                    self._draw_one_canvas_video_effect(painter, target, str(layer.get('id') or 'none'), max(0.0, min(1.0, float(layer.get('strength', 50)) / 100.0)), seconds)
            else:
                effect = str(values.get('video_effect', 'none'))
                if effect in frozenset({'', 'none', 'custom'}):
                    return None
                layers = [{'id': effect, 'strength': max(0, min(100, int(values.get('video_effect_strength', 50) or 50)))}]
        else:
            return None

    def _draw_one_canvas_video_effect(self, painter: QPainter, target: QRectF, effect: str, strength: float, seconds: float) -> None:
        values = self.state.values
        if effect in frozenset({'', 'none', 'custom'}):
            return None
        if effect == 'vignette':
            painter.fillRect(target, QColor(0, 0, 0, int(40 + 70 * strength)))
            return None
        if effect == 'vintage':
            painter.fillRect(target, QColor(190, 120, 50, int(28 + 30 * strength)))
            return None
        if effect == 'lightleak':
            painter.fillRect(QRectF(target.left(), target.top(), target.width() * 0.35, target.height()), QColor(255, 120, 40, int(50 * strength)))
            return None
        if effect == 'glow':
            painter.fillRect(target, QColor(255, 255, 255, int(18 + 35 * strength)))
            return None
        if effect == 'lightsweep':
            from core.lightsweep import lightsweep_peak_u8, lightsweep_preview_geometry, lightsweep_progress, normalize_lightsweep_apply_mode, resolve_lightsweep_params
            params = resolve_lightsweep_params(values)
            progress = lightsweep_progress(seconds, float(params['cycle_sec']), float(params['duration_sec']))
            if progress is not None:
                apply_mode = normalize_lightsweep_apply_mode(params['apply_mode'])
                clip = target
                video_rect = getattr(self, 'last_video_rect', None)
                if apply_mode == 'video' and isinstance(video_rect, QRectF) and video_rect.isValid() and (video_rect.width() > 2) and (video_rect.height() > 2):
                    clip = QRectF(video_rect)
                soft = int(params['soft_percent'])
                glow = int(params['glow_percent']) / 100.0
                opacity = int(params.get('opacity_percent', 70) or 70) / 100.0
                x_c, y_c, band_half, rot = (lightsweep_preview_geometry(width=clip.width(), height=clip.height(), progress=progress, direction=str(params['direction']), width_percent=int(params['width_percent']), soft_percent=soft)[0], lightsweep_preview_geometry(width=clip.width(), height=clip.height(), progress=progress, direction=str(params['direction']), width_percent=int(params['width_percent']), soft_percent=soft)[1], lightsweep_preview_geometry(width=clip.width(), height=clip.height(), progress=progress, direction=str(params['direction']), width_percent=int(params['width_percent']), soft_percent=soft)[2], lightsweep_preview_geometry(width=clip.width(), height=clip.height(), progress=progress, direction=str(params['direction']), width_percent=int(params['width_percent']), soft_percent=soft)[3])
                peak_alpha = lightsweep_peak_u8(strength, int(params['glow_percent']), int(params.get('opacity_percent', 70) or 70))
                soft_n = soft / 100.0
                diag = math.hypot(clip.width(), clip.height())
                painter.save()
                painter.setClipRect(clip)
                painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_Plus)
                painter.translate(clip.center())
                painter.rotate(rot)
                gradient = QLinearGradient(x_c - band_half, y_c, x_c + band_half, y_c)
                mid = 0.5
                core_half = max(0.02, 0.03 + soft_n * 0.06)
                edge = max(0.01, 0.022 + soft_n * 0.28)
                edge = min(edge, mid - core_half - 0.04)
                gradient.setColorAt(0.0, QColor(255, 255, 255, 0))
                gradient.setColorAt(edge, QColor(255, 250, 245, int(peak_alpha * (0.1 + soft_n * 0.12))))
                gradient.setColorAt(mid - core_half, QColor(255, 252, 248, int(peak_alpha * (0.5 + glow * 0.2))))
                gradient.setColorAt(mid, QColor(255, 255, 255, peak_alpha))
                gradient.setColorAt(mid + core_half, QColor(255, 252, 248, int(peak_alpha * (0.5 + glow * 0.2))))
                gradient.setColorAt(1.0 - edge, QColor(255, 250, 245, int(peak_alpha * (0.1 + soft_n * 0.12))))
                gradient.setColorAt(1.0, QColor(255, 255, 255, 0))
                painter.fillRect(QRectF(x_c - band_half, y_c - diag, band_half * 2, diag * 2), gradient)
                if glow > 0.05 and opacity > 0.05:
                    halo = band_half * (1.35 + glow * 0.8)
                    halo_grad = QLinearGradient(x_c - halo, y_c, x_c + halo, y_c)
                    halo_a = int((28 + 55 * glow * strength) * opacity)
                    halo_grad.setColorAt(0.0, QColor(255, 248, 240, 0))
                    halo_grad.setColorAt(0.5, QColor(255, 250, 240, halo_a))
                    halo_grad.setColorAt(1.0, QColor(255, 248, 240, 0))
                    painter.fillRect(QRectF(x_c - halo, y_c - diag, halo * 2, diag * 2), halo_grad)
                painter.restore()
            return None
        if effect == 'grain':
            painter.fillRect(target, QColor(255, 255, 255, int(8 + 18 * strength)))
            return None
        if effect == 'tv':
            painter.fillRect(target, QColor(20, 10, 0, int(35 + 40 * strength)))
            painter.setPen(QPen(QColor(255, 255, 255, int(30 + 40 * strength)), 1))
            step = max(3, int(9 - 5 * strength))
            y = target.top()
            while y < target.bottom():
                painter.drawLine(int(target.left()), int(y), int(target.right()), int(y))
                y += step
            return None
        if effect == 'stripe':
            band = max(2.0, target.height() * (0.025 + 0.065 * strength))
            mode = int(seconds % 15 // 5)
            phase = seconds % 5 / 5
            if mode == 0:
                y = target.top() + phase * target.height()
                painter.fillRect(QRectF(target.left(), y - band / 2, target.width(), band), QColor(255, 255, 255, 55))
            elif mode == 1:
                x = target.left() + phase * target.width()
                painter.fillRect(QRectF(x - band / 2, target.top(), band, target.height()), QColor(255, 255, 255, 55))
            else:
                painter.fillRect(QRectF(target.left() + phase * target.width() - band, target.top() + phase * target.height() - band, band * 2, band * 2), QColor(255, 255, 255, 45))
            return None
        if effect in frozenset({'camera', 'camera_rec'}):
            margin = min(target.width(), target.height()) * 0.03
            arm = min(target.width(), target.height()) * (0.05 + 0.03 * strength)
            thick = max(2.0, min(target.width(), target.height()) * 0.006)
            painter.setPen(QPen(QColor(255, 255, 255, int(160 + 70 * strength)), thick))
            painter.drawLine(int(target.left() + margin), int(target.top() + margin), int(target.left() + margin + arm), int(target.top() + margin))
            painter.drawLine(int(target.left() + margin), int(target.top() + margin), int(target.left() + margin), int(target.top() + margin + arm))
            painter.drawLine(int(target.right() - margin), int(target.top() + margin), int(target.right() - margin - arm), int(target.top() + margin))
            painter.drawLine(int(target.right() - margin), int(target.top() + margin), int(target.right() - margin), int(target.top() + margin + arm))
            painter.drawLine(int(target.left() + margin), int(target.bottom() - margin), int(target.left() + margin + arm), int(target.bottom() - margin))
            painter.drawLine(int(target.left() + margin), int(target.bottom() - margin), int(target.left() + margin), int(target.bottom() - margin - arm))
            painter.drawLine(int(target.right() - margin), int(target.bottom() - margin), int(target.right() - margin - arm), int(target.bottom() - margin))
            painter.drawLine(int(target.right() - margin), int(target.bottom() - margin), int(target.right() - margin), int(target.bottom() - margin - arm))
            painter.setBrush(QColor(255, 40, 40, 230))
            painter.setPen(Qt.PenStyle.NoPen)
            dot = max(4.0, min(target.width(), target.height()) * 0.02)
            painter.drawEllipse(QRectF(target.left() + margin * 1.8, target.top() + margin * 1.8, dot, dot))
            return None

    def _draw_video_track_overlays(self, painter: QPainter, target: QRectF) -> None:
        from core.timeline_clips import build_media_overlays_from_video_tracks, clips_from_values
        from ui_qt.timeline_track_state import track_preview_hidden
        values = self.state.values
        if track_preview_hidden(values, 'video_2') and track_preview_hidden(values, 'video_3'):
            return None
        clips = clips_from_values(values)
        items = build_media_overlays_from_video_tracks(clips)
        if items:
            by_id = {c.id: c for c in clips}
            for item in items:
                clip_id = str(item.get('id', '') or '').removeprefix('ttrack-')
                clip = by_id.get(clip_id)
                ti = int(getattr(clip, 'track_index', 1) or 1) if clip is not None else 1
                track_kind = 'video_2' if ti == 1 else 'video_3'
                path = str(item.get('path', ''))
                image = self._overlay_preview_image(path, layer=item)
                if track_preview_hidden(values, track_kind) or not self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0)) or image is None:
                    pass
                else:
                    width = max(8.0, target.width() * float(item.get('scale_percent', 100)) / 100)
                    aspect = image.height() / max(1, image.width())
                    height = width * aspect
                    cx = target.left() + target.width() * float(item.get('x_norm', 0.5))
                    cy = target.top() + target.height() * float(item.get('y_norm', 0.5))
                    layout = QRectF(cx - width / 2, cy - height / 2, width, height)
                    opacity = max(0.0, min(1.0, float(item.get('opacity', 100)) / 100.0))
                    painter.save()
                    painter.setOpacity(opacity)
                    painter.drawImage(layout, image)
                    painter.restore()
        else:
            return None

    def _draw_media_overlays(self, painter: QPainter, target: QRectF) -> None:
        values = self.state.values
        self.last_effect_overlay_rect = QRectF()
        self.last_overlay_rects = []
        self.effect_overlay_image = QImage()
        overlays = ensure_media_overlays(values)
        selected = int(values.get('media_overlay_index', 0) or 0)
        if not media_overlays_master_enabled(values) or self._track_hidden('text_logo'):
            return None
        for index, item in enumerate(overlays):
            path = str(item.get('path', ''))
            image = self._overlay_preview_image(path, layer=item)
            if str(item.get('id', '') or '').startswith('ttrack-') or not item.get('enabled', True) or item.get('preview_hidden') or (not self._layer_visible_at(int(item.get('start_ms', 0) or 0), int(item.get('end_ms', 0) or 0))) or (image is None):
                pass
            else:
                if item.get('mask_enabled'):
                    from core.overlay_mask import apply_overlay_mask_qimage
                    image = apply_overlay_mask_qimage(image, item)
                width = max(8.0, target.width() * float(item.get('scale_percent', 100)) / 100)
                aspect = image.height() / max(1, image.width())
                stretch = float(item.get('scale_aspect', 0) or 0)
                if stretch >= 0.05:
                    aspect = stretch
                if self._dragging_overlay and index == selected and (float(self._layer_drag_lock_aspect) > 1e-06):
                    aspect = float(self._layer_drag_lock_aspect)
                height = width * aspect
                cx = target.left() + target.width() * float(item.get('x_norm', 0.5))
                cy = target.top() + target.height() * float(item.get('y_norm', 0.5))
                rot = float(item.get('rotation_degrees', 0) or 0)
                opacity_pct = int(item.get('opacity', 50) or 50)
                painter.save()
                painter.setOpacity(max(0.0, min(1.0, float(opacity_pct) / 100)))
                layout, bounds = (self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[0], self._paint_image_centered_rotated(painter, cx, cy, width, height, image, rot)[1])
                painter.restore()
                if opacity_pct < 22 and index == selected:
                    painter.save()
                    painter.setPen(QPen(QColor('#FFD166'), 1.5, Qt.PenStyle.DashLine))
                    painter.setBrush(Qt.BrushStyle.NoBrush)
                    painter.drawRect(bounds)
                    painter.setPen(QColor('#FFE8A3'))
                    hint_font = painter.font()
                    hint_font.setPointSize(8)
                    painter.setFont(hint_font)
                    painter.drawText(bounds.adjusted(2, 2, -2, -2), Qt.AlignmentFlag.AlignBottom | Qt.AlignmentFlag.AlignRight, f'{opacity_pct}% mờ')
                    painter.restore()
                self.last_overlay_rects.append((index, layout, bounds))
                if index == selected:
                    self.last_effect_overlay_rect = QRectF(layout)
                    self.effect_overlay_image = image
        if self.last_effect_overlay_rect.isNull():
            if self.last_overlay_rects:
                self.last_effect_overlay_rect = QRectF(self.last_overlay_rects[-1][1])
            return None

    def _draw_effect_overlay(self, painter: QPainter, target: QRectF) -> None:
        self._draw_media_overlays(painter, target)

    def _draw_logo(self, painter: QPainter, target: QRectF) -> None:
        values = self.state.values
        self.last_logo_rect = QRectF()
        if self.logo_image.isNull() or not values.get('logo_enabled'):
            pass
        elif self._track_hidden('text_logo'):
            pass
        elif self._layer_visible_at(values.get('logo_start_ms', 0), values.get('logo_end_ms', 0)):
            width = max(8.0, target.width() * float(values.get('logo_scale_percent', 18)) / 100)
            natural = self.logo_image.height() / max(1, self.logo_image.width())
            stretch = float(values.get('logo_scale_aspect', 0) or 0)
            aspect = stretch if stretch >= 0.05 else natural
            height = width * aspect
            margin = 10.0
            motion = str(values.get('logo_motion', 'static') or 'static')
            position = str(values.get('logo_position', 'top_right'))
            animated = motion not in frozenset({'', 'static'}) and (not self._dragging_logo)
            if animated:
                try:
                    from core.logo_rmbg import logo_motion_position_px
                    seed = int(values.get('anti_duplicate_seed', 0) or 0)
                    try:
                        seed ^= abs(hash(str(values.get('logo_path', '')))) % 10000
                    except Exception:
                        pass
                    else:
                        y_norm = float(values.get('logo_y_norm', 0.5) or 0.5)
                        x_norm = float(values.get('logo_x_norm', 0.5) or 0.5)
                        if position in frozenset({'top_right', 'top_left'}):
                            y_norm = 0.08
                        elif position in frozenset({'bottom_right', 'bottom_left'}):
                            y_norm = 0.92
                        elif position != 'custom' and motion in frozenset({'marquee', 'around'}) and (position == 'center'):
                            y_norm = 0.5
                        lx, ly = (logo_motion_position_px(self.position_ms / 1000.0, motion, logo_w=width, logo_h=height, frame_w=target.width(), frame_h=target.height(), speed=float(values.get('logo_motion_speed', 120) or 120), y_norm=y_norm, x_norm=x_norm, seed=seed)[0], logo_motion_position_px(self.position_ms / 1000.0, motion, logo_w=width, logo_h=height, frame_w=target.width(), frame_h=target.height(), speed=float(values.get('logo_motion_speed', 120) or 120), y_norm=y_norm, x_norm=x_norm, seed=seed)[1])
                        x = target.left() + lx
                        y = target.top() + ly
                except Exception:
                    animated = False
            if animated:
                pass
            elif position == 'custom':
                cx = target.left() + target.width() * float(values.get('logo_x_norm', 0.5))
                cy = target.top() + target.height() * float(values.get('logo_y_norm', 0.5))
                x = cx - width / 2
                y = cy - height / 2
            elif position == 'top_left':
                y, x = (target.top() + margin, target.left() + margin)
            elif position == 'bottom_left':
                y, x = (target.bottom() - height - margin, target.left() + margin)
            elif position == 'bottom_right':
                y, x = (target.bottom() - height - margin, target.right() - width - margin)
            elif position == 'center':
                x = target.center().x() - width / 2
                y = target.center().y() - height / 2
            else:
                y, x = (target.top() + margin, target.right() - width - margin)
            cx = x + width / 2
            cy = y + height / 2
            rot = float(values.get('logo_rotation_degrees', 0) or 0)
            opacity_pct = int(values.get('logo_opacity', 82) or 82)
            blend_on = layer_uses_blend(str(values.get('logo_blend_mode', 'normal') or 'normal'))
            painter.save()
            if blend_on:
                comp_name = qt_composition_mode(str(values.get('logo_blend_mode', 'normal')))
                comp = getattr(QPainter.CompositionMode, f'CompositionMode_{comp_name}', QPainter.CompositionMode.CompositionMode_SourceOver)
                painter.setCompositionMode(comp)
            painter.setOpacity(max(0.0, min(1.0, float(opacity_pct) / 100)))
            layout, bounds = (self._paint_image_centered_rotated(painter, cx, cy, width, height, self.logo_image, rot)[0], self._paint_image_centered_rotated(painter, cx, cy, width, height, self.logo_image, rot)[1])
            painter.restore()
            self.last_logo_layout_rect = QRectF(layout)
            self.last_logo_rect = QRectF(bounds)
            if position == 'custom' or self._dragging_logo or animated:
                painter.setPen(QPen(QColor('#FFD166'), 1.2, Qt.PenStyle.DashLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawRect(bounds)

    def _clear_alignment_guides(self) -> None:
        changed = self._guide_snap_v or self._guide_snap_h or self._guide_snap_video or self._guide_show_center or self._guide_snap_rotation
        self._guide_snap_v = False
        self._guide_snap_h = False
        self._guide_snap_video = False
        self._guide_show_center = False
        self._guide_snap_rotation = False
        if changed:
            self.update()
            return None

    def _set_alignment_guides(self, *, vertical: bool, horizontal: bool, video: bool, show_center: bool | None) -> None:
        self._guide_snap_v = bool(vertical)
        self._guide_snap_h = bool(horizontal)
        self._guide_snap_video = bool(video)
        if show_center is not None:
            self._guide_show_center = bool(show_center)
            return None
        self._guide_show_center = True

    def _preview_snap_enabled(self) -> bool:
        return bool(self.state.values.get('preview_snap_enabled', True))

    def _snap_rotation_degrees(self, degrees: float) -> tuple[float, bool]:
        deg = self._normalize_rotation_degrees(degrees)
        if self._preview_snap_enabled():
            limit = float(self._SNAP_ROTATION_DEG)
            targets = (0.0, 90.0, 180.0, 270.0, 360.0)
            best = deg
            best_dist = limit + 1.0
            snapped = False
            for target in targets:
                dist = abs(deg - target)
                if dist <= limit and dist < best_dist:
                    best = 0.0 if abs(target - 360.0) < 1e-09 else float(target)
                    best_dist = dist
                    snapped = True
            return (best, snapped)
        return (deg, False)

    def _snap_center_if_enabled(self, value: float, *, center: float, threshold: float | None) -> tuple[float, bool]:
        return self._snap_norm_center(value, center=center, threshold=threshold) if self._preview_snap_enabled() else (float(value), False)

    @classmethod
    def _snap_norm_center(cls, value: float, *, center: float, threshold: float | None) -> tuple[float, bool]:
        limit = cls._SNAP_CENTER_NORM if threshold is None else float(threshold)
        return (center, True) if abs(float(value) - center) <= limit else (float(value), False)

    def _begin_layer_norm_drag(self, kind: str, point, layout: QRectF, x_norm: float, y_norm: float) -> None:
        target = self._target_rect()
        self._layer_drag_start_x_norm = float(x_norm)
        self._layer_drag_start_y_norm = float(y_norm)
        self._layer_drag_start_px = float(point.x())
        self._layer_drag_start_py = float(point.y())
        aspect = 0.0
        if not layout.isNull() and layout.width() > 1:
            aspect = float(layout.height()) / max(1.0, float(layout.width()))
        self._layer_drag_lock_aspect = aspect
        half_w = float(layout.width()) / 2.0 if layout.isNull() else 0.0
        half_h = float(layout.height()) / 2.0 if layout.isNull() else 0.0
        self._layer_drag_half_w_norm = half_w / max(1.0, target.width())
        self._layer_drag_half_h_norm = half_h / max(1.0, target.height())
        if kind == 'overlay':
            self._overlay_drag_offset_x = 0.0
            self._overlay_drag_offset_y = 0.0
            return None
        self._blend_drag_offset_x = 0.0
        self._blend_drag_offset_y = 0.0

    def _layer_norm_from_pointer(self, point) -> tuple[float, float]:
        target = self._target_rect()
        dx = float(point.x()) - float(self._layer_drag_start_px)
        dy = float(point.y()) - float(self._layer_drag_start_py)
        x_norm = float(self._layer_drag_start_x_norm) + dx / max(1.0, target.width())
        y_norm = float(self._layer_drag_start_y_norm) + dy / max(1.0, target.height())
        if not self._pasteboard_enabled():
            x_norm = max(0.0, min(1.0, x_norm))
            y_norm = max(0.0, min(1.0, y_norm))
        return (x_norm, y_norm)

    def _snap_layer_norm_placement(self, x_norm: float, y_norm: float, *, half_w_norm: float | None, half_h_norm: float | None) -> tuple[float, float, bool, bool, bool]:
        if self._preview_snap_enabled():
            hw = float(self._layer_drag_half_w_norm if half_w_norm is None else half_w_norm)
            hh = float(self._layer_drag_half_h_norm if half_h_norm is None else half_h_norm)
            thresh = self._SNAP_EDGE_NORM
            x_targets = [(0.5, 'center')]
            y_targets = [(0.5, 'center')]
            if hw > 1e-06:
                x_targets.extend([(hw, 'edge'), (1.0 - hw, 'edge')])
            if hh > 1e-06:
                y_targets.extend([(hh, 'edge'), (1.0 - hh, 'edge')])
            target = self._target_rect()
            video = self.last_video_rect
            if not video.isNull() and target.width() > 1 and (target.height() > 1):
                left = (video.left() - target.left()) / target.width()
                right = (video.right() - target.left()) / target.width()
                top = (video.top() - target.top()) / target.height()
                bottom = (video.bottom() - target.top()) / target.height()
                mid_x = (left + right) * 0.5
                mid_y = (top + bottom) * 0.5
                x_targets.extend([(mid_x, 'video'), (left + hw, 'video'), (right - hw, 'video')])
                y_targets.extend([(mid_y, 'video'), (top + hh, 'video'), (bottom - hh, 'video')])

            def _nearest(value: float, targets: list[tuple[float, str]]) -> tuple[float, bool, bool]:
                best = float(value)
                snapped = False
                used_video = False
                best_dist = thresh + 1.0
                for cand, kind in targets:
                    dist = abs(float(value) - float(cand))
                    if dist <= thresh and dist < best_dist:
                        best = float(cand)
                        best_dist = dist
                        snapped = True
                        used_video = kind == 'video'
                return (best, snapped, used_video)
            nx, snap_v, vid_v = (_nearest(float(x_norm), x_targets)[0], _nearest(float(x_norm), x_targets)[1], _nearest(float(x_norm), x_targets)[2])
            ny, snap_h, vid_h = (_nearest(float(y_norm), y_targets)[0], _nearest(float(y_norm), y_targets)[1], _nearest(float(y_norm), y_targets)[2])
            return (nx, ny, snap_v, snap_h, bool(vid_v or vid_h))
        return (float(x_norm), float(y_norm), False, False, False)

    def _draw_alignment_guides(self, painter: QPainter, target: QRectF) -> None:
        show_center = bool(self._guide_show_center or self._guide_snap_v or self._guide_snap_h or self._guide_snap_rotation)
        if show_center or self._guide_snap_video:
            painter.save()
            cx = target.center().x()
            cy = target.center().y()
            active = bool(self._guide_snap_v or self._guide_snap_h or self._guide_snap_rotation)
            if show_center:
                if active:
                    color = QColor('#5CC8FF') if self._guide_snap_video else QColor('#FF9900')
                    pen = QPen(color, 1.35, Qt.PenStyle.SolidLine)
                else:
                    color = QColor(158, 176, 199, 150)
                    pen = QPen(color, 1.0, Qt.PenStyle.DashLine)
                painter.setPen(pen)
                painter.drawLine(int(cx), int(target.top()), int(cx), int(target.bottom()))
                painter.drawLine(int(target.left()), int(cy), int(target.right()), int(cy))
                tick = max(10.0, min(target.width(), target.height()) * 0.04)
                painter.setPen(QPen(QColor('#FFD166') if active else QColor('#C5D0DE'), 1.6))
                painter.drawLine(int(cx - tick), int(cy), int(cx + tick), int(cy))
                painter.drawLine(int(cx), int(cy - tick), int(cx), int(cy + tick))
                if active and self._guide_snap_v and self._guide_snap_h:
                    painter.setPen(QPen(QColor('#FFD166'), 1.5))
                    painter.setBrush(QColor('#FFD166'))
                    painter.drawEllipse(QRectF(cx - 3, cy - 3, 6, 6))
            if self._guide_snap_video and (not self.last_video_rect.isNull()):
                painter.setPen(QPen(QColor('#5CC8FF'), 1.0, Qt.PenStyle.DotLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawRect(self.last_video_rect)
            painter.restore()
        else:
            return None

    def _apply_logo_drag(self, center_x: float, center_y: float) -> None:
        x_norm, y_norm = (self._point_to_norm(center_x, center_y)[0], self._point_to_norm(center_x, center_y)[1])
        x_norm, snap_v = (self._snap_center_if_enabled(x_norm)[0], self._snap_center_if_enabled(x_norm)[1])
        y_norm, snap_h = (self._snap_center_if_enabled(y_norm)[0], self._snap_center_if_enabled(y_norm)[1])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h)
        self.state.values['logo_position'] = 'custom'
        self.state.values['logo_x_norm'] = x_norm
        self.state.values['logo_y_norm'] = y_norm
        self._pending_logo_placement = (x_norm, y_norm)
        self.update()

    def _apply_effect_overlay_drag(self, x_norm: float, y_norm: float) -> None:
        x_norm, y_norm, snap_v, snap_h, snap_vid = (self._snap_layer_norm_placement(float(x_norm), float(y_norm))[0], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[1], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[2], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[3], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[4])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h, video=snap_vid)
        scale = int(self.state.values.get('effect_overlay_scale_percent', 100) or 100)
        update_selected_media_overlay(self.state.values, enabled=True, x_norm=x_norm, y_norm=y_norm, scale_percent=scale)
        self._pending_effect_overlay = (x_norm, y_norm, scale)
        self.update()

    def _apply_film_mask_feather_drag(self, point, axis: str='y') -> None:
        layout = QRectF(self.last_effect_overlay_rect)
        if layout.isNull():
            return None
        from core.overlay_mask import normalize_overlay_mask_fields
        fields = normalize_overlay_mask_fields(selected_media_overlay(self.state.values) or {})
        axis = 'x' if str(axis).lower() == 'x' else 'y'
        rot = self._layer_rotation_degrees('overlay')
        cy, cx = (layout.center().y(), layout.center().x())
        lx, ly = (self._pointer_to_layer_local(point.x(), point.y(), cx, cy, rot)[0], self._pointer_to_layer_local(point.x(), point.y(), cx, cy, rot)[1])
        half_w = max(8.0, layout.width() * fields['mask_width_percent'] / 200.0)
        half_h = max(8.0, layout.height() * fields['mask_height_percent'] / 200.0)
        along = lx if axis == 'x' else ly
        span = half_w if axis == 'x' else half_h
        ratio = max(-1.0, min(1.0, along / span))
        feather = max(0, min(100, int(round(abs(ratio) * 100))))
        bias = 0 if feather < 4 else max(-100, min(100, int(round(ratio * 100))))
        self.state.values['effect_overlay_mask_enabled'] = True
        self.state.values['effect_overlay_mask_shape'] = 'film'
        self.state.values['effect_overlay_mask_feather_percent'] = feather
        self.state.values['effect_overlay_mask_feather_bias'] = bias
        self.state.values['effect_overlay_mask_feather_axis'] = axis
        update_selected_media_overlay(self.state.values, mask_enabled=True, mask_shape='film', mask_feather_percent=feather, mask_feather_bias=bias, mask_feather_axis=axis)
        self._pending_overlay_mask = (feather, bias, axis)
        self.update()

    def _apply_blend_layer_drag(self, x_norm: float, y_norm: float) -> None:
        x_norm, y_norm, snap_v, snap_h, snap_vid = (self._snap_layer_norm_placement(float(x_norm), float(y_norm))[0], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[1], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[2], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[3], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[4])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h, video=snap_vid)
        scale = int(self.state.values.get('blend_layer_scale_percent', 100) or 100)
        update_selected_blend_layer(self.state.values, enabled=True, x_norm=x_norm, y_norm=y_norm, scale_percent=scale)
        self._pending_blend_layer = (x_norm, y_norm, scale)
        self.update()

    def _apply_blend_layer_corner_scale(self, pointer_x: float, pointer_y: float) -> None:
        if self.blend_layer_image.isNull():
            return None
        natural = self.blend_layer_image.height() / max(1, self.blend_layer_image.width())
        aspect = float(self._corner_scale_start_aspect or natural or 1.0)
        if aspect < 0.05:
            aspect = natural
        scale_w, scale_h, x_norm, y_norm = (self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[0], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[1], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[2], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[3])
        uniform = self._uniform_scale_active()
        stretch = self._resolved_scale_aspect_for_drag(uniform=uniform, locked_aspect=aspect, natural_aspect=natural, scale_w=scale_w, scale_h=scale_h)
        if not uniform:
            self.state.values['uniform_scale_enabled'] = False
        self._layer_drag_lock_aspect = aspect if uniform else max(0.05, float(stretch))
        update_selected_blend_layer(self.state.values, enabled=True, scale_percent=scale_w, x_norm=x_norm, y_norm=y_norm, scale_aspect=stretch)
        self._pending_blend_layer = (x_norm, y_norm, scale_w)
        self.update()

    def _apply_background_layer_drag(self, x_norm: float, y_norm: float) -> None:
        x_norm, y_norm, snap_v, snap_h, snap_vid = (self._snap_layer_norm_placement(float(x_norm), float(y_norm))[0], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[1], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[2], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[3], self._snap_layer_norm_placement(float(x_norm), float(y_norm))[4])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h, video=snap_vid)
        scale = int(self.state.values.get('background_layer_scale_percent', 100) or 100)
        update_selected_background_layer(self.state.values, enabled=True, fit_mode='free', x_norm=x_norm, y_norm=y_norm, scale_percent=scale)
        sync_flat_keys_from_selected_background(self.state.values)
        self._pending_background_layer = (x_norm, y_norm, scale)
        self.update()

    def _apply_background_layer_corner_scale(self, pointer_x: float, pointer_y: float) -> None:
        if self.background_layer_image.isNull():
            return None
        natural = self.background_layer_image.height() / max(1, self.background_layer_image.width())
        aspect = float(self._corner_scale_start_aspect or natural or 1.0)
        if aspect < 0.05:
            aspect = natural
        scale_w, scale_h, x_norm, y_norm = (self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[0], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[1], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[2], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[3])
        uniform = self._uniform_scale_active()
        stretch = self._resolved_scale_aspect_for_drag(uniform=uniform, locked_aspect=aspect, natural_aspect=natural, scale_w=scale_w, scale_h=scale_h)
        if not uniform:
            self.state.values['uniform_scale_enabled'] = False
        self._layer_drag_lock_aspect = aspect if uniform else max(0.05, float(stretch))
        update_selected_background_layer(self.state.values, enabled=True, fit_mode='free', scale_percent=scale_w, x_norm=x_norm, y_norm=y_norm, scale_aspect=stretch)
        sync_flat_keys_from_selected_background(self.state.values)
        self._pending_background_layer = (x_norm, y_norm, scale_w)
        self.update()

    def _rect_corner_point(self, rect: QRectF, corner: str):
        mapping = {'tl': rect.topLeft(), 'tr': rect.topRight(), 'bl': rect.bottomLeft(), 'br': rect.bottomRight()}
        return mapping[corner]

    def _layout_corner_screen_point(self, rect: QRectF, corner: str, rotation_degrees: float) -> tuple[float, float]:
        cx = float(rect.center().x())
        cy = float(rect.center().y())
        w = float(rect.width())
        h = float(rect.height())
        local = {'tl': (-w / 2, -h / 2), 'tr': (w / 2, -h / 2), 'bl': (-w / 2, h / 2), 'br': (w / 2, h / 2)}.get(str(corner), (w / 2, h / 2))
        return self._map_layer_local_to_screen(cx, cy, local[0], local[1], rotation_degrees)

    def _begin_corner_scale(self, rect: QRectF, corner: str, *, rotation_degrees: float) -> None:
        opposite = self._CORNER_OPPOSITE.get(corner, 'tl')
        rot = float(rotation_degrees or 0)
        ax, ay = (self._layout_corner_screen_point(rect, opposite, rot)[0], self._layout_corner_screen_point(rect, opposite, rot)[1])
        dx, dy = (self._layout_corner_screen_point(rect, corner, rot)[0], self._layout_corner_screen_point(rect, corner, rot)[1])
        self._corner_scale_name = corner
        self._corner_scale_anchor_x = float(ax)
        self._corner_scale_anchor_y = float(ay)
        self._corner_scale_rotation_deg = rot
        self._corner_scale_center_x = float(rect.center().x())
        self._corner_scale_center_y = float(rect.center().y())
        self._corner_scale_start_aspect = max(0.05, float(rect.height()) / max(1.0, float(rect.width())))
        self._corner_scale_start_dist = max(8.0, math.hypot(float(dx) - float(ax), float(dy) - float(ay)))
        self._layer_drag_lock_aspect = float(self._corner_scale_start_aspect)

    def _resolved_scale_aspect_for_drag(self, *, uniform: bool, locked_aspect: float, natural_aspect: float, scale_w: int, scale_h: int) -> float:
        locked = max(0.05, float(locked_aspect or 1.0))
        natural = max(0.05, float(natural_aspect or 1.0))
        return (0.0 if abs(locked - natural) < 0.02 else locked) if uniform else max(0.05, float(scale_h) / max(1.0, float(scale_w)))

    def _center_from_fixed_anchor(self, *, width: float, height: float) -> tuple[float, float]:
        opp = {'br': (-0.5, -0.5), 'bl': (0.5, -0.5), 'tr': (-0.5, 0.5), 'tl': (0.5, 0.5)}.get(self._corner_scale_name, (-0.5, -0.5))
        lx = float(opp[0]) * width
        ly = float(opp[1]) * height
        rad = math.radians(self._corner_scale_rotation_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        rx = lx * cos_a - ly * sin_a
        ry = lx * sin_a + ly * cos_a
        ax = self._corner_scale_anchor_x
        ay = self._corner_scale_anchor_y
        return (ax - rx, ay - ry)

    def _apply_corner_scale_geometry(self, pointer_x: float, pointer_y: float, *, start_scale: int, aspect: float, scale_min: int, scale_max: int, start_scale_y: int | None) -> tuple[int, int, float, float]:
        target = self._target_rect()
        ax = self._corner_scale_anchor_x
        ay = self._corner_scale_anchor_y
        rot = self._corner_scale_rotation_deg
        use_aspect = max(0.05, float(self._layer_drag_lock_aspect) if float(self._layer_drag_lock_aspect) > 1e-06 else float(aspect or self._corner_scale_start_aspect or 1.0))
        uniform = self._uniform_scale_active()
        _ = start_scale_y
        if uniform:
            dist = max(8.0, math.hypot(pointer_x - ax, pointer_y - ay))
            ratio = dist / max(8.0, self._corner_scale_start_dist)
            scale_w = max(scale_min, min(scale_max, int(round(start_scale * ratio))))
            scale_h = scale_w
            width = max(8.0, target.width() * scale_w / 100.0)
            height = max(8.0, width * use_aspect)
        else:
            rad = math.radians(-float(rot or 0))
            dx = pointer_x - ax
            dy = pointer_y - ay
            local_x = dx * math.cos(rad) - dy * math.sin(rad)
            local_y = dx * math.sin(rad) + dy * math.cos(rad)
            width = max(8.0, abs(local_x))
            height = max(8.0, abs(local_y))
            scale_w = max(scale_min, min(scale_max, int(round(width / max(1.0, target.width()) * 100))))
            scale_h = max(scale_min, min(scale_max, int(round(height / max(1.0, target.width()) * 100))))
            width = max(8.0, target.width() * scale_w / 100.0)
            height = max(8.0, target.width() * scale_h / 100.0)
        center_x, center_y = (self._center_from_fixed_anchor(width=width, height=height)[0], self._center_from_fixed_anchor(width=width, height=height)[1])
        x_norm, y_norm = (self._point_to_norm(center_x, center_y, clamp=False)[0], self._point_to_norm(center_x, center_y, clamp=False)[1])
        return (scale_w, scale_h, x_norm, y_norm)

    def _apply_logo_corner_scale(self, pointer_x: float, pointer_y: float) -> None:
        if self.logo_image.isNull():
            return None
        aspect = float(self._corner_scale_start_aspect or 1.0)
        if aspect < 0.05:
            aspect = self.logo_image.height() / max(1, self.logo_image.width())
        scale_w, scale_h, x_norm, y_norm = (self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=100)[0], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=100)[1], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=100)[2], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=100)[3])
        self.state.values['logo_position'] = 'custom'
        self.state.values['logo_scale_percent'] = scale_w
        self.state.values['logo_x_norm'] = x_norm
        self.state.values['logo_y_norm'] = y_norm
        if self._uniform_scale_active():
            self.state.values['logo_scale_aspect'] = 0.0
        else:
            self.state.values['logo_scale_aspect'] = float(scale_h) / max(1.0, float(scale_w))
            self.state.values['uniform_scale_enabled'] = False
        self._pending_logo_placement = (x_norm, y_norm)
        self._pending_logo_scale = scale_w
        self.update()

    def _apply_effect_overlay_corner_scale(self, pointer_x: float, pointer_y: float) -> None:
        if self.effect_overlay_image.isNull():
            return None
        natural = self.effect_overlay_image.height() / max(1, self.effect_overlay_image.width())
        aspect = float(self._corner_scale_start_aspect or natural or 1.0)
        if aspect < 0.05:
            aspect = natural
        scale_w, scale_h, x_norm, y_norm = (self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[0], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[1], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[2], self._apply_corner_scale_geometry(pointer_x, pointer_y, start_scale=self._corner_scale_start_percent, aspect=aspect, scale_min=5, scale_max=200)[3])
        uniform = self._uniform_scale_active()
        stretch = self._resolved_scale_aspect_for_drag(uniform=uniform, locked_aspect=aspect, natural_aspect=natural, scale_w=scale_w, scale_h=scale_h)
        if not uniform:
            self.state.values['uniform_scale_enabled'] = False
        self._layer_drag_lock_aspect = aspect if uniform else max(0.05, float(stretch))
        update_selected_media_overlay(self.state.values, enabled=True, scale_percent=scale_w, x_norm=x_norm, y_norm=y_norm, scale_aspect=stretch)
        self._pending_effect_overlay = (x_norm, y_norm, scale_w)
        self.update()

    def _title_font(self, target: QRectF, scale_percent: int) -> QFont:
        live_s = max(20, min(300, int(scale_percent))) / 100.0
        font = QFont('Arial')
        font.setPixelSize(max(10, int(target.height() / 22.0 * live_s)))
        font.setWeight(QFont.Weight.Bold)
        return font

    def _measure_wrapped_block(self, *, font: QFont, display: str, text_w: float, line_count: int, target: QRectF | None, ref_h: float | None) -> float:
        metrics = QFontMetrics(font)
        height_ref = float(ref_h if ref_h is not None else target.height() if target else 1080.0)
        pad = max(2.0, 4.0 * height_ref / 1080.0)
        return max(float(metrics.height()), float(metrics.lineSpacing()) * max(1, int(line_count))) + pad

    def _export_canvas_transform(self, target: QRectF) -> tuple[int, int, float, float]:
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        sx = target.width() / max(1.0, float(ref_w))
        sy = target.height() / max(1.0, float(ref_h))
        return (ref_w, ref_h, sx, sy)

    def _export_aspect_wh(self, ref_w: int, ref_h: int) -> float:
        return max(0.2, float(ref_w) / max(1.0, float(ref_h)))

    def _map_export_rect_to_target(self, rect: QRectF, target: QRectF, sx: float, sy: float) -> QRectF:
        return QRectF(target.left() + rect.left() * sx, target.top() + rect.top() * sy, rect.width() * sx, rect.height() * sy)

    def _draw_video_title(self, painter: QPainter, target: QRectF) -> None:
        self.last_video_title_rect = QRectF()
        values = self.state.values
        source = ''
        selected = getattr(self.state, 'selected_id', None)
        for asset in self.state.assets:
            if asset.id == selected and asset.path:
                source = asset.path
        if not source:
            for asset in self.state.assets:
                if asset.kind == 'video' and asset.path:
                    source = asset.path
        text = resolve_video_title(source_path=source, enabled=bool(values.get('video_title_enabled', False)), from_filename=bool(values.get('video_title_from_filename', True)), content=str(values.get('video_title_content', '')), language_mode=str(values.get('video_title_language_mode', 'auto_target')))
        if not text:
            pass
        elif self._track_hidden('video_title'):
            pass
        elif self._layer_visible_at(values.get('video_title_start_ms', 0), values.get('video_title_end_ms', 0)):
            ref_w, ref_h, sx, sy = (self._export_canvas_transform(target)[0], self._export_canvas_transform(target)[1], self._export_canvas_transform(target)[2], self._export_canvas_transform(target)[3])
            scale_pct = int(round(self._title_display_scale_percent(values)))
            base_size = ref_h / 22.0
            live_s = max(0.2, min(3.0, scale_pct / 100.0))
            wrap_box_norm = self._title_wrap_box_norm(values, float(scale_pct))
            layout_w = float(ref_w) * wrap_box_norm
            ass_font, _, _ass_scale_y = (ass_glyph_style(base_size * live_s, 100, 100)[0], ass_glyph_style(base_size * live_s, 100, 100)[1], ass_glyph_style(base_size * live_s, 100, 100)[2])
            title_font_name = str(values.get('video_title_font', 'Arial') or 'Arial')
            font = QFont(title_font_name)
            font.setPixelSize(max(10, round(ass_font)))
            if bool(values.get('video_title_bold', True)):
                font.setWeight(QFont.Weight.Bold)
            if bool(values.get('video_title_italic', False)):
                font.setItalic(True)
            aspect = self._export_aspect_wh(ref_w, ref_h)
            pad_x = max(4.0, layout_w * 0.02)
            pad_y = max(4.0, font.pixelSize() * 0.2)
            text_wrap_w = max(32.0, layout_w - pad_x * 2)
            lines = wrap_text_for_box(text, box_width_norm=wrap_box_norm, font_div=22.0, aspect_wh=aspect, wrap_width_px=text_wrap_w, font_size_px=ass_font)
            display = '\n'.join(lines) or text
            line_count = max(1, len(lines))
            flags = Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextDontClip
            text_rect = self._measure_text_block_rect(font, display, text_wrap_w, flags)
            draw_w = layout_w
            draw_h = max(text_rect.height() + pad_y * 2, self._measure_wrapped_block(font=font, display=display, text_w=max(8.0, draw_w - pad_x * 2), line_count=line_count, ref_h=float(ref_h)))
            x_norm, y_norm = (resolve_text_position_norms(str(values.get('video_title_position', 'top')), float(values.get('video_title_x_norm', 0.5)), float(values.get('video_title_y_norm', 0.06)))[0], resolve_text_position_norms(str(values.get('video_title_position', 'top')), float(values.get('video_title_x_norm', 0.5)), float(values.get('video_title_y_norm', 0.06)))[1])
            actual_w_norm = max(0.04, draw_w / max(1.0, float(ref_w)))
            actual_h_norm = max(0.04, draw_h / max(1.0, float(ref_h)))
            if actual_w_norm <= 0.98 and actual_h_norm <= 0.98:
                x_norm, y_norm = (clamp_box_center_norms(x_norm, y_norm, box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[0], clamp_box_center_norms(x_norm, y_norm, box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[1])
            cx = float(ref_w) * x_norm
            cy = float(ref_h) * (self._title_anchor_y_norm if self._title_anchor_y_norm is not None else y_norm)
            export_rect = QRectF(cx - draw_w / 2, cy - draw_h / 2, draw_w, draw_h)
            self.last_video_title_rect = self._map_export_rect_to_target(export_rect, target, sx, sy)
            outline = max(1, round(max(0, int(values.get('video_title_outline_width', 3) or 3))))
            outline_color = QColor(str(values.get('video_title_outline_color', '#000000') or '#000000'))
            text_color = QColor(str(values.get('video_title_text_color', '#FFFFFF') or '#FFFFFF'))
            painter.save()
            painter.translate(target.left(), target.top())
            painter.scale(sx, sy)
            painter.setFont(font)
            painter.translate(cx, cy)
            try:
                from core.text_anim import normalize_title_anim, preview_anim_state, segment_progress
                anim_mode = normalize_title_anim(values.get('video_title_anim', 'none'))
                if anim_mode != 'none':
                    title_start = int(values.get('video_title_start_ms', 0) or 0)
                    title_end = int(values.get('video_title_end_ms', 0) or 0)
                    if title_end <= title_start:
                        title_end = title_start + max(1, self._source_clip_duration_ms())
                    anim = preview_anim_state(segment_progress(self.position_ms, title_start, title_end), anim_mode)
                    painter.setOpacity(max(0.0, min(1.0, float(anim.opacity))))
                    painter.translate(float(anim.offset_x), float(anim.offset_y))
                    sc = max(0.2, float(anim.scale))
                    if abs(sc - 1.0) > 0.01:
                        painter.scale(sc, sc)
                    painter.rotate(float(values.get('video_title_rotation_degrees', 0) or 0) + float(anim.rotation))
                else:
                    painter.rotate(float(values.get('video_title_rotation_degrees', 0) or 0))
            except Exception:
                painter.rotate(float(values.get('video_title_rotation_degrees', 0) or 0))
            local = QRectF(-draw_w / 2 + pad_x, -draw_h / 2 + pad_y, max(8.0, draw_w - pad_x * 2), max(8.0, draw_h - pad_y * 2))
            self._paint_styled_text(painter, local, display, flags, text_color=text_color, outline_color=outline_color, outline=outline, shadow_enabled=bool(values.get('video_title_shadow_enabled', True)), shadow_depth=int(values.get('video_title_shadow_depth', 1) or 0), bg_enabled=bool(values.get('video_title_bg_enabled', False)), bg_color=QColor(str(values.get('video_title_bg_color', '#000000') or '#000000')), bg_opacity=int(values.get('video_title_bg_opacity', 55) or 55), box_rect=QRectF(-draw_w / 2, -draw_h / 2, draw_w, draw_h))
            painter.restore()

    def _draw_text_overlay(self, painter: QPainter, target: QRectF) -> None:
        from ui_qt.text_overlays import exportable_text_overlays, item_to_legacy_settings_fields
        self.last_text_overlay_rect = QRectF()
        self._text_selected_rect = QRectF()
        values = self.state.values
        if self._track_hidden('text_overlay'):
            return None
        items = exportable_text_overlays(values)
        if items:
            selected_idx = int(values.get('text_overlay_index', 0) or 0)
            selected_idx = max(0, min(selected_idx, len(items) - 1))
            union = QRectF()
            for index, item in enumerate(items):
                fields = item_to_legacy_settings_fields(item)
                if index == selected_idx:
                    fields['text_overlay_x_norm'] = float(values.get('text_overlay_x_norm', fields.get('text_overlay_x_norm', 0.5)))
                    fields['text_overlay_y_norm'] = float(values.get('text_overlay_y_norm', fields.get('text_overlay_y_norm', 0.88)))
                    fields['text_overlay_position'] = str(values.get('text_overlay_position') or fields.get('text_overlay_position') or 'custom')
                    fields['text_overlay_scale_percent'] = int(values.get('text_overlay_scale_percent', fields.get('text_overlay_scale_percent', 100)) or 100)
                    fields['text_overlay_box_width_percent'] = int(values.get('text_overlay_box_width_percent', fields.get('text_overlay_box_width_percent', 90)) or 90)
                    fields['text_overlay_rotation_degrees'] = float(values.get('text_overlay_rotation_degrees', fields.get('text_overlay_rotation_degrees', 0)) or 0)
                    fields['text_overlay_style'] = 'static' if self._dragging_text_overlay else fields.get('text_overlay_style', 'static')
                rect = self._draw_one_text_overlay_fields(painter, target, fields, is_selected=index == selected_idx)
                union = rect if union.isNull() else union.united(rect)
                if rect is not None and (not rect.isNull()) and (index == selected_idx):
                    self._text_selected_rect = QRectF(rect)
            if self._text_selected_rect.isNull():
                self.last_text_overlay_rect = union
            else:
                self.last_text_overlay_rect = QRectF(self._text_selected_rect)
                return None
        else:
            rect = self._draw_one_text_overlay_fields(painter, target, dict(values), is_selected=True)
            if bool(values.get('text_overlay_enabled')) and str(values.get('text_overlay_content') or '').strip() and (rect is not None) and (not rect.isNull()):
                self.last_text_overlay_rect = rect
                self._text_selected_rect = QRectF(rect)
            return None

    def _draw_one_text_overlay_fields(self, painter: QPainter, target: QRectF, fields: dict, *, is_selected: bool) -> QRectF | None:
        if not fields.get('text_overlay_enabled'):
            pass
        elif self._layer_visible_at(fields.get('text_overlay_start_ms', 0), fields.get('text_overlay_end_ms', 0)):
            text = str(fields.get('text_overlay_content', '')).strip()
            if text:
                style = str(fields.get('text_overlay_style', 'static'))
                values = dict(self.state.values)
                values.update(fields)
                if style != 'static':
                    saved = dict(self.state.values)
                    try:
                        self.state.values.update(fields)
                        self._draw_text_overlay_animated(painter, target, text, style)
                    finally:
                        self.state.values.clear()
                        self.state.values.update(saved)
                    return QRectF(self.last_text_overlay_rect)
                ref_w, ref_h, sx, sy = (self._export_canvas_transform(target)[0], self._export_canvas_transform(target)[1], self._export_canvas_transform(target)[2], self._export_canvas_transform(target)[3])
                scale_pct = int(round(self._text_display_scale_percent(values)))
                box_w_norm = self._text_box_width_norm(values)
                wrap_box_norm = self._text_wrap_box_norm(values, float(scale_pct))
                live_s = max(0.2, min(3.0, scale_pct / 100.0))
                overlay_font_name = str(fields.get('text_overlay_font', 'Arial') or 'Arial')
                font = QFont(overlay_font_name)
                font.setPixelSize(max(10, int(ref_h / 28.0 * live_s)))
                if bool(fields.get('text_overlay_bold', True)):
                    font.setWeight(QFont.Weight.DemiBold)
                if bool(fields.get('text_overlay_italic', False)):
                    font.setItalic(True)
                x_norm, y_norm = (resolve_text_position_norms(str(fields.get('text_overlay_position', 'bottom')), float(fields.get('text_overlay_x_norm', 0.5)), float(fields.get('text_overlay_y_norm', 0.94)))[0], resolve_text_position_norms(str(fields.get('text_overlay_position', 'bottom')), float(fields.get('text_overlay_x_norm', 0.5)), float(fields.get('text_overlay_y_norm', 0.94)))[1])
                use_move_cache = is_selected and self._dragging_text_overlay and (self._text_overlay_drag_mode == 'move') and isinstance(self._text_move_layout_cache, dict) and (self._text_move_layout_cache.get('text') == text) and (abs(float(self._text_move_layout_cache.get('scale', 0)) - scale_pct) < 0.5) and (abs(float(self._text_move_layout_cache.get('box_w', 0)) - box_w_norm) < 0.001) and (abs(float(self._text_move_layout_cache.get('wrap_w', 0)) - wrap_box_norm) < 0.001)
                if use_move_cache:
                    cache = self._text_move_layout_cache
                    draw_w = float(cache['draw_w'])
                    draw_h = float(cache['draw_h'])
                    pad_x = float(cache['pad_x'])
                    pad_y = float(cache['pad_y'])
                    display = str(cache['display'])
                    flags = cache['flags']
                    font = cache['font']
                    outline_px = int(cache['outline_px'])
                    outline_color = cache['outline_color']
                    text_color = cache['text_color']
                    shadow_enabled = bool(cache['shadow_enabled'])
                    shadow_depth = int(cache['shadow_depth'])
                    bg_enabled = bool(cache['bg_enabled'])
                    bg_color = cache['bg_color']
                    bg_opacity = int(cache['bg_opacity'])
                else:
                    aspect = self._export_aspect_wh(ref_w, ref_h)
                    layout_w = float(ref_w) * wrap_box_norm
                    font_px = max(10.0, float(ref_h) / 28.0 * live_s)
                    text_wrap_w = max(32.0, layout_w - max(8.0, layout_w * 0.05) * 2)
                    wrapped_lines = wrap_text_for_box(text, box_width_norm=wrap_box_norm, font_div=28.0, aspect_wh=aspect, wrap_width_px=text_wrap_w, font_size_px=font_px)
                    display = '\n'.join(wrapped_lines) or text
                    line_count = max(1, len(wrapped_lines))
                    flags = Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextDontClip
                    pad_x = max(8.0, layout_w * 0.05)
                    pad_y = max(6.0, font.pixelSize() * 0.25)
                    text_rect = self._measure_text_block_rect(font, display, layout_w, flags)
                    draw_w = layout_w
                    draw_h = max(text_rect.height() + pad_y * 2, self._measure_wrapped_block(font=font, display=display, text_w=max(8.0, draw_w - pad_x * 2), line_count=line_count, ref_h=float(ref_h)))
                    outline_px = max(0, round(max(0, int(fields.get('text_overlay_outline_width', 3) or 3))))
                    outline_color = QColor(str(fields.get('text_overlay_outline_color', '#000000') or '#000000'))
                    text_color = QColor(str(fields.get('text_overlay_text_color', '#FFFFFF') or '#FFFFFF'))
                    shadow_enabled = bool(fields.get('text_overlay_shadow_enabled', True))
                    shadow_depth = int(fields.get('text_overlay_shadow_depth', 1) or 0)
                    bg_enabled = bool(fields.get('text_overlay_bg_enabled', False))
                    bg_color = QColor(str(fields.get('text_overlay_bg_color', '#000000') or '#000000'))
                    bg_opacity = int(fields.get('text_overlay_bg_opacity', 55) or 55)
                    if is_selected and self._dragging_text_overlay:
                        self._text_move_layout_cache = {'text': text, 'scale': scale_pct, 'box_w': box_w_norm, 'wrap_w': wrap_box_norm, 'draw_w': draw_w, 'draw_h': draw_h, 'pad_x': pad_x, 'pad_y': pad_y, 'display': display, 'flags': flags, 'font': QFont(font), 'outline_px': outline_px, 'outline_color': outline_color, 'text_color': text_color, 'shadow_enabled': shadow_enabled, 'shadow_depth': shadow_depth, 'bg_enabled': bg_enabled, **{'bg_color': bg_color, 'bg_opacity': bg_opacity}}
                actual_w_norm = draw_w / max(1.0, float(ref_w))
                actual_h_norm = draw_h / max(1.0, float(ref_h))
                if actual_w_norm <= 0.98 and actual_h_norm <= 0.98:
                    x_norm, y_norm = (clamp_box_center_norms(x_norm, y_norm, box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[0], clamp_box_center_norms(x_norm, y_norm, box_width_norm=actual_w_norm, box_height_norm=actual_h_norm)[1])
                cx = float(ref_w) * x_norm
                cy = float(ref_h) * y_norm
                export_rect = QRectF(cx - draw_w / 2, cy - draw_h / 2, draw_w, draw_h)
                mapped = self._map_export_rect_to_target(export_rect, target, sx, sy)
                painter.save()
                painter.translate(target.left(), target.top())
                painter.scale(sx, sy)
                painter.setFont(font)
                painter.translate(cx, cy)
                painter.rotate(float(fields.get('text_overlay_rotation_degrees', 0) or 0))
                local = QRectF(-draw_w / 2 + pad_x, -draw_h / 2 + pad_y, max(8.0, draw_w - pad_x * 2), max(8.0, draw_h - pad_y * 2))
                self._paint_styled_text(painter, local, display, flags, text_color=text_color, outline_color=outline_color, outline=outline_px, shadow_enabled=shadow_enabled, shadow_depth=shadow_depth, bg_enabled=bg_enabled, bg_color=bg_color, bg_opacity=bg_opacity, box_rect=QRectF(-draw_w / 2, -draw_h / 2, draw_w, draw_h))
                painter.restore()
                return mapped

    def _draw_text_overlay_animated(self, painter: QPainter, target: QRectF, text: str, style: str) -> None:
        values = self.state.values
        scale_pct = max(20, min(300, int(values.get('text_overlay_scale_percent', 100) or 100)))
        box_w_norm = max(0.15, min(1.0, int(values.get('text_overlay_box_width_percent', 90) or 90) / 100.0))
        live_s = scale_pct / 100.0
        font = QFont('Arial')
        font.setPixelSize(max(10, int(target.height() / 28.0 * live_s)))
        font.setWeight(QFont.Weight.DemiBold)
        aspect = max(0.2, target.width() / max(1.0, target.height()))
        wrapped_lines = wrap_text_for_box(text, box_width_norm=box_w_norm, font_div=28.0, aspect_wh=aspect)
        display = '\n'.join(wrapped_lines) or text
        line_count = max(1, len(wrapped_lines))
        painter.save()
        painter.setFont(font)
        flags = Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter
        text_w = target.width() * box_w_norm
        rect_height = self._measure_wrapped_block(font=font, display=display, text_w=text_w, line_count=line_count, target=target)
        draw_w = text_w
        draw_h = rect_height
        x_norm, y_norm = (resolve_text_position_norms(str(values.get('text_overlay_position', 'bottom')), float(values.get('text_overlay_x_norm', 0.5)), float(values.get('text_overlay_y_norm', 0.94)))[0], resolve_text_position_norms(str(values.get('text_overlay_position', 'bottom')), float(values.get('text_overlay_x_norm', 0.5)), float(values.get('text_overlay_y_norm', 0.94)))[1])
        x_norm, y_norm = (clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w_norm, box_height_norm=draw_h / max(1.0, target.height()))[0], clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w_norm, box_height_norm=draw_h / max(1.0, target.height()))[1])
        cx = target.left() + target.width() * x_norm
        cy = target.top() + target.height() * y_norm
        seconds = self.position_ms / 1000.0
        if style == 'marquee':
            shift = seconds * 180 % max(1.0, target.width() + draw_w)
            cx = target.right() - shift + draw_w / 2
            cy = target.top() + target.height() * y_norm
        elif style == 'around':
            shift = seconds * 160 % max(1.0, target.width() + draw_w)
            cx = target.left() + shift - draw_w / 2
        elif style == 'diagonal':
            shift_x = seconds * 160 % max(1.0, target.width() + draw_w)
            shift_y = seconds * 100 % max(1.0, target.height() + draw_h)
            cx = target.left() + shift_x - draw_w / 2
            cy = target.top() + shift_y - draw_h / 2
        self.last_text_overlay_rect = QRectF(cx - draw_w / 2, cy - draw_h / 2, draw_w, draw_h)
        painter.translate(cx, cy)
        local = QRectF(-draw_w / 2, -draw_h / 2, draw_w, draw_h)
        outline_px = max(1, round(2 * target.width() / 1080.0))
        painter.setPen(QColor('#000000'))
        for dx, dy in ((-outline_px, 0), (outline_px, 0), (0, -outline_px), (0, outline_px)):
            painter.drawText(local.translated(dx, dy), flags, display)
        painter.setPen(QColor('#FFFFFF'))
        painter.drawText(local, flags, display)
        painter.restore()

    def _set_title_scale_xy(self, scale_x: int, scale_y: int) -> None:
        sx = max(20, min(300, int(scale_x)))
        sy = max(20, min(300, int(scale_y)))
        target = self._target_rect()
        start_w = max(8.0, self._title_scale_start_half_w * 2)
        start_h = max(8.0, self._title_scale_start_half_h * 2)
        max_w = target.width() * 0.98
        max_h = target.height() * 0.95
        base_w = start_w / max(0.1, self._title_scale_start_x / 100.0)
        base_h = start_h / max(0.1, self._title_scale_start_y / 100.0)
        sx = max(20, min(sx, int(max_w / max(1.0, base_w) * 100)))
        sy = max(20, min(sy, int(max_h / max(1.0, base_h) * 100)))
        self.state.values['video_title_scale_x_percent'] = sx
        self.state.values['video_title_scale_y_percent'] = sy
        self.state.values['video_title_scale_percent'] = int(round((sx + sy) / 2))
        self.state.values['video_title_position'] = 'custom'
        self._queue_title_layout()

    def _apply_title_uniform_scale(self, pointer_x: float, pointer_y: float) -> None:
        cx = self._title_scale_center_x
        cy = self._title_scale_center_y
        dist = math.hypot(pointer_x - cx, pointer_y - cy)
        ratio = dist / max(8.0, self._title_resize_start_dist)
        live = max(20.0, min(300.0, float(self._title_scale_start_percent) * ratio))
        self._live_title_scale_percent = live
        scale = max(20, min(300, int(round(live))))
        self.state.values['video_title_scale_percent'] = scale
        self.state.values['video_title_scale_x_percent'] = scale
        self.state.values['video_title_scale_y_percent'] = scale
        self.state.values['video_title_position'] = 'custom'
        self._title_measure_cache = None
        if self._title_anchor_y_norm is None and (not self.last_video_title_rect.isNull()):
            target = self._target_rect()
            self._title_anchor_y_norm = (self.last_video_title_rect.center().y() - target.top()) / max(1.0, target.height())
        self._queue_title_layout()
        self.update()

    def _apply_title_box_width(self, pointer_x: float) -> None:
        target = self._target_rect()
        half = abs(pointer_x - self._title_scale_center_x)
        box_w = half * 2.0 / max(1.0, target.width())
        box_w = max(0.15, min(1.0, box_w))
        self._live_title_box_w_norm = box_w
        percent = int(round(box_w * 100))
        self.state.values['video_title_box_width_percent'] = percent
        self.state.values['video_title_layout_scale_percent'] = int(round(self._title_display_scale_percent(self.state.values)))
        self.state.values['video_title_position'] = 'custom'
        self._pending_title_box_width = percent
        self._title_measure_cache = None
        if self._title_anchor_y_norm is None and (not self.last_video_title_rect.isNull()):
            target = self._target_rect()
            self._title_anchor_y_norm = (self.last_video_title_rect.center().y() - target.top()) / max(1.0, target.height())
        self.update()

    def _apply_title_scale(self, pointer_x: float, pointer_y: float) -> None:
        self._apply_title_uniform_scale(pointer_x, pointer_y)

    def _apply_title_scale_axis(self, pointer_x: float, pointer_y: float, *, axis: str) -> None:
        self._apply_title_uniform_scale(pointer_x, pointer_y)

    def _apply_title_drag(self, center_x: float, center_y: float) -> None:
        target = self._target_rect()
        box_w = max(0.15, min(1.0, int(self.state.values.get('video_title_box_width_percent', 92) or 92) / 100.0))
        box_h = max(0.04, min(0.95, self.last_video_title_rect.height() / max(1.0, target.height())))
        x_norm = (center_x - target.left()) / max(1.0, target.width())
        y_norm = (center_y - target.top()) / max(1.0, target.height())
        x_norm, snap_v = (self._snap_center_if_enabled(x_norm)[0], self._snap_center_if_enabled(x_norm)[1])
        y_norm, snap_h = (self._snap_center_if_enabled(y_norm)[0], self._snap_center_if_enabled(y_norm)[1])
        x_norm, y_norm = (clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w, box_height_norm=box_h)[0], clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w, box_height_norm=box_h)[1])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h)
        self.state.values['video_title_position'] = 'custom'
        self.state.values['video_title_x_norm'] = x_norm
        self.state.values['video_title_y_norm'] = y_norm
        self._pending_title_placement = (x_norm, y_norm)
        self.update()

    def _queue_title_layout(self) -> None:
        x_norm = float(self.state.values.get('video_title_x_norm', 0.5))
        y_norm = float(self._title_anchor_y_norm if self._title_anchor_y_norm is not None else self.state.values.get('video_title_y_norm', 0.06))
        scale = int(self.state.values.get('video_title_scale_percent', self.state.values.get('video_title_scale_x_percent', 100)) or 100)
        self._pending_title_layout = (x_norm, y_norm, scale, scale)
        self._pending_title_placement = (x_norm, y_norm)

    def _apply_text_overlay_drag(self, center_x: float, center_y: float) -> None:
        target = self._target_rect()
        box_w = max(0.2, min(1.0, self.last_text_overlay_rect.width() / max(1.0, target.width())))
        box_h = max(0.04, min(0.95, self.last_text_overlay_rect.height() / max(1.0, target.height())))
        x_norm = (center_x - target.left()) / max(1.0, target.width())
        y_norm = (center_y - target.top()) / max(1.0, target.height())
        x_norm, snap_v = (self._snap_center_if_enabled(x_norm)[0], self._snap_center_if_enabled(x_norm)[1])
        y_norm, snap_h = (self._snap_center_if_enabled(y_norm)[0], self._snap_center_if_enabled(y_norm)[1])
        x_norm, y_norm = (clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w, box_height_norm=box_h)[0], clamp_box_center_norms(x_norm, y_norm, box_width_norm=box_w, box_height_norm=box_h)[1])
        self._set_alignment_guides(vertical=snap_v, horizontal=snap_h)
        self.state.values['text_overlay_style'] = 'static'
        self.state.values['text_overlay_position'] = 'custom'
        self.state.values['text_overlay_x_norm'] = x_norm
        self.state.values['text_overlay_y_norm'] = y_norm
        self._pending_text_overlay_placement = (x_norm, y_norm)
        self._patch_selected_text_item_live(x_norm=x_norm, y_norm=y_norm, style='static', position='custom')
        self.update()

    def _patch_selected_text_item_live(self, **fields) -> None:
        from ui_qt.text_overlays import ensure_text_overlays
        items = ensure_text_overlays(self.state.values)
        if items:
            index = int(self.state.values.get('text_overlay_index', 0) or 0)
            index = max(0, min(index, len(items) - 1))
            item = items[index]
            if 'x_norm' in fields:
                item['x_norm'] = float(fields['x_norm'])
            if 'y_norm' in fields:
                item['y_norm'] = float(fields['y_norm'])
            if 'scale_percent' in fields:
                item['scale_percent'] = int(fields['scale_percent'])
            if 'box_width_percent' in fields:
                item['box_width_percent'] = int(fields['box_width_percent'])
            if 'layout_scale_percent' in fields:
                item['layout_scale_percent'] = int(fields['layout_scale_percent'])
            if 'style' in fields:
                item['style'] = str(fields['style'])
            if 'position' in fields:
                item['position'] = str(fields['position'])
            self.state.values['text_overlays'] = items
        else:
            return None

    def _apply_text_overlay_uniform_scale(self, pointer_x: float, pointer_y: float) -> None:
        cx = self._text_scale_center_x
        cy = self._text_scale_center_y
        dist = math.hypot(pointer_x - cx, pointer_y - cy)
        ratio = dist / max(8.0, self._text_resize_start_dist)
        live = max(20.0, min(300.0, float(self._text_scale_start) * ratio))
        self._live_text_scale_percent = live
        scale = max(20, min(300, int(round(live))))
        self.state.values['text_overlay_scale_percent'] = scale
        self.state.values['text_overlay_style'] = 'static'
        self.state.values['text_overlay_position'] = 'custom'
        self._text_measure_cache = None
        self._text_move_layout_cache = None
        if self._text_anchor_y_norm is None and (not self.last_text_overlay_rect.isNull()):
            target = self._target_rect()
            self._text_anchor_y_norm = (self.last_text_overlay_rect.center().y() - target.top()) / max(1.0, target.height())
        self._patch_selected_text_item_live(scale_percent=scale, style='static', position='custom')
        self._queue_text_overlay_layout()
        self.update()

    def _apply_text_overlay_scale(self, pointer_x: float, pointer_y: float) -> None:
        self._apply_text_overlay_uniform_scale(pointer_x, pointer_y)

    def _apply_text_overlay_box_width(self, pointer_x: float) -> None:
        target = self._target_rect()
        half = abs(pointer_x - self._text_scale_center_x)
        box_w = half * 2.0 / max(1.0, target.width())
        box_w = max(0.15, min(1.0, box_w))
        self._live_text_box_w_norm = box_w
        percent = int(round(box_w * 100))
        self.state.values['text_overlay_box_width_percent'] = percent
        self.state.values['text_overlay_layout_scale_percent'] = int(round(self._text_display_scale_percent(self.state.values)))
        self.state.values['text_overlay_style'] = 'static'
        self.state.values['text_overlay_position'] = 'custom'
        self._text_measure_cache = None
        self._text_move_layout_cache = None
        if self._text_anchor_y_norm is None and (not self.last_text_overlay_rect.isNull()):
            target = self._target_rect()
            self._text_anchor_y_norm = (self.last_text_overlay_rect.center().y() - target.top()) / max(1.0, target.height())
        self._patch_selected_text_item_live(box_width_percent=percent, layout_scale_percent=int(self.state.values['text_overlay_layout_scale_percent']), style='static', position='custom')
        self._queue_text_overlay_layout()
        self.update()

    def _queue_text_overlay_layout(self) -> None:
        x_norm = float(self.state.values.get('text_overlay_x_norm', 0.5))
        y_norm = float(self.state.values.get('text_overlay_y_norm', 0.94))
        scale = int(self.state.values.get('text_overlay_scale_percent', 100) or 100)
        box_w = float(int(self.state.values.get('text_overlay_box_width_percent', 90) or 90) / 100.0)
        self._pending_text_overlay_layout = (x_norm, y_norm, scale, box_w)
        self._pending_text_overlay_placement = (x_norm, y_norm)

    def _output_reference_size(self) -> tuple[int, int]:
        values = self.state.values
        try:
            aw_str, ah_str = str(values.get('aspect_ratio', '9:16') or '9:16').split(':', 1)
            aw = int(aw_str)
            ah = int(ah_str)
        except (KeyError, ValueError):
            aw, ah = 9, 16
        if aw <= 0 or ah <= 0:
            aw, ah = 9, 16
        if aw >= ah:
            return (1920, max(2, round(1920 * ah / aw)))
        return (1080, max(2, round(1080 * ah / aw)))

    def _subtitle_layout_context(self, target: QRectF) -> tuple[QRectF, int, int, float]:
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        scale_x = target.width() / max(1.0, float(ref_w))
        scale_y = target.height() / max(1.0, float(ref_h))
        view_scale = (scale_x + scale_y) / 2.0
        return (target, ref_w, ref_h, view_scale)

    def _draw_subtitle(self, painter: QPainter, target: QRectF) -> None:
        if not self.state.values.get('subtitle_enabled') and (not self.selected_subtitle_text):
            self.last_subtitle_rect = QRectF()
            self.last_subtitle_source_rect = QRectF()
            return None
        if not self._track_hidden('subtitle') or self._dragging_subtitle:
            from ui_qt.subtitle_preview_burn import PreviewBurnLayer, preview_burn_layers_at_clock
            from ui_qt.subtitle_source_document import get_source_subtitles
            trim_start = int(self.state.values.get('trim_start_ms', 0) or 0)
            trim_end = int(self.state.values.get('trim_end_ms', 0) or 0)
            subtitle_clock_ms = self._preview_subtitle_clock_ms()
            layers = ()
            if self.selected_subtitle_text:
                text = self.selected_subtitle_text
                layers = (PreviewBurnLayer(kind='working', text=text, margin_v=int(self.state.values.get('subtitle_margin_bottom', 70) or 70), start_ms=int(self.selected_subtitle_start_ms), end_ms=max(int(self.selected_subtitle_start_ms) + 1, int(self.selected_subtitle_end_ms))),)
            elif self.state.values.get('subtitle_enabled'):
                preview_doc = self._preview_subtitle_document()
                use_trim = preview_doc is self.state.subtitles and (not self._preview_uses_voice_subtitle_clock())
                layers = preview_burn_layers_at_clock(self.state.values, clock_ms=subtitle_clock_ms, working_document=preview_doc, source_document=get_source_subtitles(self.state), trim_start_ms=trim_start, trim_end_ms=trim_end, working_use_trim=use_trim)
            self.last_subtitle_rect = QRectF()
            self.last_subtitle_source_rect = QRectF()
            is_placeholder = False
            burn_any = bool(self.state.values.get('subtitle_burn_source', True)) or bool(self.state.values.get('subtitle_burn_working', True))
            if layers:
                if self._subtitle_show_longest or (self._dragging_subtitle and self._subtitle_drag_mode == 'box_w'):
                    longest = self._longest_subtitle_text()
                    is_placeholder = not bool(self.state.subtitles.segments)
                    layers = (PreviewBurnLayer(kind='working', text=longest, margin_v=int(self.state.values.get('subtitle_margin_bottom', 70) or 70)),)
                working_rect = QRectF()
                source_rect = QRectF()
                dragging_source = self._dragging_subtitle and getattr(self, '_subtitle_drag_layer', 'working') == 'source'
                for layer in layers:
                    active_segment = None if is_placeholder else layer.segment
                    if (self._subtitle_show_longest or (self._dragging_subtitle and self._subtitle_drag_mode == 'box_w')) and layer.kind == 'working':
                        active_segment = None
                    self._paint_one_subtitle_layer(painter, target, text=layer.text, active_segment=active_segment, margin_bottom=int(layer.margin_v), is_placeholder=is_placeholder and layer.kind == 'working', subtitle_clock_ms=subtitle_clock_ms, use_live_anchor=layer.kind == 'source' and dragging_source or (layer.kind == 'working' and (not dragging_source)))
                    if layer.kind == 'working':
                        working_rect = QRectF(self.last_subtitle_rect)
                    elif layer.kind == 'source':
                        source_rect = QRectF(self.last_subtitle_rect)
                self.last_subtitle_source_rect = source_rect
                if working_rect.isNull():
                    self.last_subtitle_rect = QRectF()
                else:
                    self.last_subtitle_rect = working_rect
                    return None
            else:
                if self._playback_active:
                    return None
                if self.state.values.get('subtitle_enabled') and burn_any:
                    is_placeholder = True
                    layers = (PreviewBurnLayer(kind='working', text='Phụ đề mẫu - kéo cạnh để chỉnh số hàng', margin_v=int(self.state.values.get('subtitle_margin_bottom', 70) or 70)),)
                else:
                    return None
        else:
            self.last_subtitle_rect = QRectF()
            self.last_subtitle_source_rect = QRectF()
            return None

    def _paint_one_subtitle_layer(self, painter: QPainter, target: QRectF, *, text: str, active_segment, margin_bottom: int, is_placeholder: bool, subtitle_clock_ms: int, use_live_anchor: bool) -> None:
        values = self.state.values
        ref_w, ref_h, sx, sy = (self._export_canvas_transform(target)[0], self._export_canvas_transform(target)[1], self._export_canvas_transform(target)[2], self._export_canvas_transform(target)[3])
        play_h, play_w = (ref_h, ref_w)
        box_w_norm = self._subtitle_box_width_norm(values)
        font = QFont(str(values.get('subtitle_font', 'Arial')))
        font_size_play = self._subtitle_display_font_size(values)
        scale_x_pct = max(10, min(500, int(values.get('subtitle_scale_x_percent', 100) or 100)))
        scale_y_pct = max(10, min(500, int(values.get('subtitle_scale_y_percent', 100) or 100)))
        ass_font, ass_scale_x, ass_scale_y = (ass_glyph_style(font_size_play, scale_x_pct, scale_y_pct)[0], ass_glyph_style(font_size_play, scale_x_pct, scale_y_pct)[1], ass_glyph_style(font_size_play, scale_x_pct, scale_y_pct)[2])
        glyph_sx = max(0.1, float(ass_scale_x) / 100.0)
        font.setPixelSize(max(10, round(ass_font)))
        if bool(values.get('subtitle_bold', True)):
            font.setWeight(QFont.Weight.Bold)
        if bool(values.get('subtitle_italic', False)):
            font.setItalic(True)
        wrap_box_norm = self._subtitle_wrap_box_norm(values, float(font_size_play))
        wrapped_lines = []
        if active_segment is not None and (not is_placeholder) and (not self._dragging_subtitle) and (self._subtitle_drag_mode != 'box_w'):
            wrapped_lines = subtitle_lines_at_cue_position(active_segment.text, active_segment.start_ms, active_segment.end_ms, subtitle_clock_ms, play_res_x=play_w, box_width_norm=wrap_box_norm, aspect_ratio=self._subtitle_aspect_ratio(), scale_x_percent=scale_x_pct, font_size_px=float(ass_font))
        if not wrapped_lines:
            wrapped_lines = self._wrap_subtitle_layout_lines(text, play_w, wrap_box_norm, scale_x_percent=scale_x_pct, font_size_px=float(ass_font))
        display = '\n'.join(wrapped_lines) if wrapped_lines else text
        layout_display = display
        anim_mode = 'none'
        karaoke_fill = None
        paint_opacity = 1.0
        paint_scale = 1.0
        paint_dx = 0.0
        paint_dy = 0.0
        paint_rot = 0.0
        if active_segment is not None and (not is_placeholder) and (not self._dragging_subtitle):
            from core.text_anim import normalize_subtitle_anim, preview_anim_state, segment_progress, visible_prefix_text
            from core.text_layout import plan_subtitle_cue_events
            anim_mode = normalize_subtitle_anim(values.get('subtitle_anim', 'none'))
            chunk_start = int(active_segment.start_ms)
            chunk_end = max(chunk_start + 1, int(active_segment.end_ms))
            elapsed = int(subtitle_clock_ms) - int(active_segment.start_ms)
            cue_ms = max(1, int(active_segment.end_ms) - int(active_segment.start_ms))
            cue_events = plan_subtitle_cue_events(active_segment.text, cue_ms, play_res_x=play_w, box_width_norm=wrap_box_norm, aspect_ratio=self._subtitle_aspect_ratio(), scale_x_percent=scale_x_pct, font_size_px=float(ass_font))
            for evt_start, evt_end, _evt_lines in cue_events:
                if evt_start <= elapsed < evt_end or (evt_end >= cue_ms and elapsed >= evt_start):
                    chunk_start = int(active_segment.start_ms) + int(evt_start)
                    chunk_end = int(active_segment.start_ms) + int(evt_end)
            anim_progress = segment_progress(subtitle_clock_ms, chunk_start, chunk_end)
            anim_state = preview_anim_state(anim_progress, anim_mode)
            paint_opacity = float(anim_state.opacity)
            paint_scale = float(anim_state.scale)
            paint_dx = float(anim_state.offset_x)
            paint_dy = float(anim_state.offset_y)
            paint_rot = float(anim_state.rotation)
            karaoke_fill = anim_state.karaoke_fill
            if anim_state.reveal_mode:
                display = visible_prefix_text(layout_display, anim_progress, mode=anim_state.reveal_mode)
        if anim_mode not in frozenset({'word', 'word_fade', 'char'}) or str(display or '').strip():
            line_count = max(1, len([line for line in wrapped_lines if line.strip()] or wrapped_lines))
            block_h_play = estimate_text_block_height_px(ass_font, ass_scale_y, line_count)
            layout_w = float(ref_w) * wrap_box_norm
            pad_x = max(8.0, layout_w * 0.05)
            pad_y = max(6.0, font.pixelSize() * 0.25)
            metrics = QFontMetrics(font)
            line_spacing = max(metrics.height(), metrics.lineSpacing())
            base_h = line_spacing * line_count + pad_y * 2
            flags = Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter | Qt.TextFlag.TextDontClip
            text_rect = self._measure_text_block_rect(font, layout_display, layout_w, flags)
            content_h = text_rect.height()
            draw_w = layout_w
            draw_h = max(content_h + pad_y * 2, base_h, block_h_play)
            center_x = float(ref_w) / 2.0
            margin_refs_center = bool(values.get('subtitle_margin_refs_center', False))
            position = str(values.get('subtitle_position', 'bottom'))
            if use_live_anchor and self._subtitle_anchor_y_norm is not None:
                center_y = float(ref_h) * self._subtitle_anchor_y_norm
                top = center_y - draw_h / 2
            elif use_live_anchor and self._live_subtitle_top_norm is not None:
                top = float(ref_h) * self._live_subtitle_top_norm
                center_y = top + draw_h / 2
            else:
                center_y = subtitle_block_center_y(position, margin_bottom, block_h_play, play_h, margin_refs_center=margin_refs_center)
                top = center_y - draw_h / 2
            left = center_x - draw_w / 2
            export_rect = QRectF(left, top, draw_w, draw_h)
            self.last_subtitle_rect = self._map_export_rect_to_target(export_rect, target, sx, sy)
            outline = max(0, round(max(0, int(values.get('subtitle_outline_width', 3)))))
            outline_color = QColor(str(values.get('subtitle_outline_color', '#000000')))
            text_color = QColor(str(values.get('subtitle_text_color', '#FFFFFF')))
            if is_placeholder:
                text_color.setAlpha(170)
                outline_color.setAlpha(120)
            painter.save()
            painter.translate(target.left(), target.top())
            painter.scale(sx, sy)
            painter.setFont(font)
            painter.translate(center_x, center_y)
            painter.rotate(float(values.get('subtitle_rotation_degrees', 0) or 0) + paint_rot)
            if abs(glyph_sx - 1.0) > 0.001:
                painter.scale(glyph_sx, 1.0)
            inv_sx = 1.0 / glyph_sx
            local = QRectF((-draw_w / 2 + pad_x) * inv_sx, -draw_h / 2 + pad_y, max(8.0, draw_w - pad_x * 2) * inv_sx, max(8.0, draw_h - pad_y * 2))
            self._paint_styled_text(painter, local, display, flags, text_color=text_color, outline_color=outline_color, outline=outline, shadow_enabled=bool(values.get('subtitle_shadow_enabled', True)), shadow_depth=int(values.get('subtitle_shadow_depth', 1) or 0), bg_enabled=bool(values.get('subtitle_bg_enabled', False)), bg_color=QColor(str(values.get('subtitle_bg_color', '#000000') or '#000000')), bg_opacity=int(values.get('subtitle_bg_opacity', 55) or 55), box_rect=QRectF(-draw_w / 2 * inv_sx, -draw_h / 2, draw_w * inv_sx, draw_h), placeholder=is_placeholder, karaoke_fill=karaoke_fill, karaoke_color=QColor(str(values.get('subtitle_karaoke_color', '#00E5FF') or '#00E5FF')), opacity=paint_opacity, scale=paint_scale, offset_x=paint_dx, offset_y=paint_dy)
            painter.restore()
        else:
            self.last_subtitle_rect = QRectF()
            return None

    def _paint_styled_text(self, painter: QPainter, local: QRectF, display: str, flags, *, text_color: QColor, outline_color: QColor, outline: int, shadow_enabled: bool, shadow_depth: int, bg_enabled: bool, bg_color: QColor | None, bg_opacity: int, box_rect: QRectF | None, placeholder: bool, karaoke_fill: float | None, karaoke_color: QColor | None, opacity: float, scale: float, offset_x: float, offset_y: float) -> None:
        alpha_mul = max(0.0, min(1.0, float(opacity)))
        if alpha_mul <= 0.001:
            return None
        painter.save()
        if abs(float(offset_x)) > 0.01 or abs(float(offset_y)) > 0.01:
            painter.translate(float(offset_x), float(offset_y))
        if abs(float(scale) - 1.0) > 0.001:
            painter.scale(float(scale), float(scale))
        if bg_enabled and box_rect is not None and (bg_color is not None):
            fill = QColor(bg_color)
            alpha = int(round(max(0, min(100, bg_opacity)) * 2.55 * alpha_mul))
            if placeholder:
                alpha = min(alpha, 120)
            fill.setAlpha(alpha)
            painter.fillRect(box_rect, fill)

        def _with_alpha(color: QColor, base_alpha: int | None=None) -> QColor:
            out = QColor(color)
            src = base_alpha if base_alpha is not None else out.alpha()
            out.setAlpha(max(0, min(255, int(round(src * alpha_mul)))))
            return out

        def _draw_pass(color: QColor, text: str) -> None:
            depth = max(0, min(8, int(shadow_depth))) if shadow_enabled else 0
            if depth > 0:
                shadow = QColor(0, 0, 0, int(round((100 if placeholder else 150) * alpha_mul)))
                painter.setPen(shadow)
                painter.drawText(local.translated(depth, depth), flags, text)
            if outline > 0:
                painter.setPen(_with_alpha(outline_color))
                for dx, dy in ((-outline, 0), (outline, 0), (0, -outline), (0, outline), (-outline, -outline), (outline, -outline), (-outline, outline), (outline, outline)):
                    painter.drawText(local.translated(dx, dy), flags, text)
            painter.setPen(_with_alpha(color))
            painter.drawText(local, flags, text)
        base_text = _with_alpha(text_color, 170 if placeholder else text_color.alpha())
        _draw_pass(base_text, display)
        fill = karaoke_fill
        if fill is not None and karaoke_color is not None and (float(fill) > 0.001) and str(display or '').strip():
            wipe = max(0.0, min(1.0, float(fill)))
            clip = QRectF(local.left(), local.top() - 4.0, max(1.0, local.width() * wipe), local.height() + 8.0)
            painter.setClipRect(clip)
            _draw_pass(_with_alpha(karaoke_color), display)
            painter.setClipping(False)
        painter.restore()

    def _corner_handles(self, rect: QRectF, size: float=10.0) -> dict[str, QRectF]:
        half = size / 2
        return {'tl': QRectF(rect.left() - half, rect.top() - half, size, size), 'tr': QRectF(rect.right() - half, rect.top() - half, size, size), 'bl': QRectF(rect.left() - half, rect.bottom() - half, size, size), 'br': QRectF(rect.right() - half, rect.bottom() - half, size, size)}

    def _map_layer_local_to_screen(self, center_x: float, center_y: float, local_x: float, local_y: float, rotation_degrees: float) -> tuple[float, float]:
        rad = math.radians(float(rotation_degrees or 0))
        return (center_x + local_x * math.cos(rad) - local_y * math.sin(rad), center_y + local_x * math.sin(rad) + local_y * math.cos(rad))

    def _corner_handles_rotated(self, layout: QRectF, rotation_degrees: float, size: float=10.0) -> dict[str, QRectF]:
        cx = layout.center().x()
        cy = layout.center().y()
        h, w = (layout.height(), layout.width())
        corners = {'tl': (-w / 2, -h / 2), 'tr': (w / 2, -h / 2), 'bl': (-w / 2, h / 2), 'br': (w / 2, h / 2)}
        half = size / 2
        result = {}
        for name, (lx, ly) in corners.items():
            sx, sy = (self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[0], self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[1])
            result[name] = QRectF(sx - half, sy - half, size, size)
        return result

    def _chrome_corner_handles(self, layout: QRectF, rotation_degrees: float, size: float=10.0) -> dict[str, QRectF]:
        return self._corner_handles_rotated(layout, rotation_degrees, size) if abs(float(rotation_degrees or 0)) >= 0.01 else self._corner_handles(layout, size)

    def _film_mask_chrome_active(self) -> bool:
        from core.overlay_mask import overlay_mask_is_film
        return overlay_mask_is_film(selected_media_overlay(self.state.values))

    def _film_mask_band_half(self, layout: QRectF) -> tuple[float, float]:
        from core.overlay_mask import normalize_overlay_mask_fields
        fields = normalize_overlay_mask_fields(selected_media_overlay(self.state.values) or {})
        half_w = max(4.0, layout.width() * fields['mask_width_percent'] / 200.0)
        half_h = max(4.0, layout.height() * fields['mask_height_percent'] / 200.0)
        return (half_w, half_h)

    def _film_mask_feather_handle_rect(self, layout: QRectF, rotation_degrees: float) -> QRectF | None:
        if not layout.isNull() and self._film_mask_chrome_active():
            cy, cx = (layout.center().y(), layout.center().x())
            sx, sy = (self._map_layer_local_to_screen(cx, cy, 0.0, 0.0, rotation_degrees)[0], self._map_layer_local_to_screen(cx, cy, 0.0, 0.0, rotation_degrees)[1])
            size = 40.0
            return QRectF(sx - size / 2, sy - size / 2, size, size)

    def _film_mask_feather_axis_at(self, point, layout: QRectF, rotation_degrees: float) -> str | None:
        handle = self._film_mask_feather_handle_rect(layout, rotation_degrees)
        if handle is not None and handle.adjusted(-4, -4, 4, 4).contains(point):
            cy, cx = (layout.center().y(), layout.center().x())
            lx, ly = (self._pointer_to_layer_local(point.x(), point.y(), cx, cy, rotation_degrees)[0], self._pointer_to_layer_local(point.x(), point.y(), cx, cy, rotation_degrees)[1])
            return 'x' if abs(lx) > abs(ly) else 'y'

    def _draw_film_mask_chrome(self, painter: QPainter, layout: QRectF, rotation_degrees: float) -> None:
        if not layout.isNull() and self._film_mask_chrome_active():
            from core.overlay_mask import normalize_overlay_mask_fields
            fields = normalize_overlay_mask_fields(selected_media_overlay(self.state.values) or {})
            axis = str(fields.get('mask_feather_axis', 'y') or 'y')
            hw, hh = (self._film_mask_band_half(layout)[0], self._film_mask_band_half(layout)[1])
            cy, cx = (layout.center().y(), layout.center().x())
            painter.save()
            painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
            painter.translate(cx, cy)
            painter.rotate(float(rotation_degrees or 0))
            painter.setPen(QPen(QColor('#FFD36A'), 1.5, Qt.PenStyle.DashLine))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(QRectF(-hw, -hh, hw * 2.0, hh * 2.0))
            painter.restore()
            handle = self._film_mask_feather_handle_rect(layout, rotation_degrees)
            if handle is None:
                return None
            gold = QColor('#FFD36A')
            dim = QColor(255, 211, 106, 95)
            painter.save()
            painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
            painter.translate(handle.center())
            painter.rotate(float(rotation_degrees or 0))
            painter.setPen(QPen(QColor('#1A1A1A'), 1.0))

            def _tri(points, active: bool) -> None:
                path = QPainterPath()
                path.moveTo()
                path.lineTo()
                path.lineTo()
                path.closeSubpath()
                painter.setBrush(gold if active else dim)
                painter.drawPath(path)
            _tri([(0, -14), (-6.5, -4), (6.5, -4)], axis == 'y')
            _tri([(0, 14), (-6.5, 4), (6.5, 4)], axis == 'y')
            _tri([(-14, 0), (-4, -6.5), (-4, 6.5)], axis == 'x')
            _tri([(14, 0), (4, -6.5), (4, 6.5)], axis == 'x')
            painter.setPen(QPen(gold if axis == 'y' else dim, 2.0))
            painter.drawLine(QPointF(0, -4), QPointF(0, 4))
            painter.setPen(QPen(gold if axis == 'x' else dim, 2.0))
            painter.drawLine(QPointF(-4, 0), QPointF(4, 0))
            painter.restore()
        else:
            return None

    def _draw_background_cover_hint(self, painter: QPainter, rect: QRectF) -> None:
        item = selected_background_layer(self.state.values)
        if item is not None and background_layer_uses_cover(item):
            text = 'Nền phủ kín · kéo góc = phóng tự do (không phải video)'
            font = QFont(painter.font())
            font.setPointSize(8)
            font.setBold(True)
            painter.save()
            painter.setFont(font)
            metrics = QFontMetrics(font)
            pad = 5
            tw = metrics.horizontalAdvance(text) + pad * 2
            th = metrics.height() + pad
            box = QRectF(rect.left() + 6, rect.top() + 6, tw, th)
            if box.right() > rect.right() - 4:
                box.setWidth(max(40, rect.width() - 12))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor(40, 24, 64, 200))
            painter.drawRoundedRect(box, 4, 4)
            painter.setPen(QColor('#E8D7FF'))
            painter.drawText(box.adjusted(pad, 0, -pad, 0), Qt.AlignmentFlag.AlignVCenter, text)
            painter.restore()
        else:
            return None

    def _draw_rotated_rect_chrome(self, painter: QPainter, layout: QRectF, rotation_degrees: float, color: QColor, corner_size: float=10.0, *, show_edges: bool, edges_lr_only: bool, edge_size: float, edge_color: QColor | None) -> None:
        h, w = (layout.height(), layout.width())
        cy, cx = (layout.center().y(), layout.center().x())
        edge_brush = edge_color or QColor('#9AD4FF')
        painter.save()
        painter.setPen(QPen(color, 1.6, Qt.PenStyle.SolidLine))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        if abs(float(rotation_degrees or 0)) < 0.01:
            painter.drawRect(layout)
            painter.setBrush(color)
            for handle in self._corner_handles(layout, corner_size).values():
                painter.drawEllipse(handle)
            if show_edges:
                painter.setBrush(edge_brush)
                if edges_lr_only:
                    for handle in self._text_lr_edge_handles(layout, 0.0, thickness=edge_size).values():
                        painter.drawRoundedRect(handle, 4.0, 4.0)
                else:
                    for name, handle in self._edge_handles(layout, edge_size).items():
                        painter.drawRect(handle)
        else:
            painter.translate(cx, cy)
            painter.rotate(rotation_degrees)
            local = QRectF(-w / 2, -h / 2, w, h)
            painter.drawRect(local)
            painter.setBrush(color)
            for handle in self._corner_handles(local, corner_size).values():
                painter.drawEllipse(handle)
            if show_edges:
                painter.setBrush(edge_brush)
                if edges_lr_only:
                    t = max(10.0, float(edge_size))
                    clear = max(10.0, corner_size + 4.0)
                    pill_h = max(14.0, h - clear * 2.0)
                    if h < clear * 2 + 14:
                        pill_h = max(12.0, h * 0.55)
                    for lx in (-w / 2.0, w / 2.0):
                        painter.drawRoundedRect(QRectF(lx - t / 2.0, -pill_h / 2.0, t, pill_h), 4.0, 4.0)
                else:
                    for name, handle in self._edge_handles(local, edge_size).items():
                        painter.drawRect(handle)
        painter.restore()
        self._draw_rotation_handle_ui(painter, layout, color, rotation_degrees)
        self._draw_rotation_degree_badge(painter, layout, rotation_degrees)

    def _edge_handles(self, rect: QRectF, size: float=10.0) -> dict[str, QRectF]:
        half = size / 2
        cx = rect.center().x()
        cy = rect.center().y()
        return {'l': QRectF(rect.left() - half, cy - half, size, size), 'r': QRectF(rect.right() - half, cy - half, size, size), 't': QRectF(cx - half, rect.top() - half, size, size), 'b': QRectF(cx - half, rect.bottom() - half, size, size)}

    def _text_lr_edge_handles(self, layout: QRectF, rotation_degrees: float=0.0, *, thickness: float, corner_clearance: float) -> dict[str, QRectF]:
        if layout.isNull():
            return {}
        t = max(10.0, float(thickness))
        half_t = t / 2.0
        clear = max(10.0, float(corner_clearance))
        h = max(14.0, float(layout.height()) - clear * 2.0)
        if float(layout.height()) < clear * 2 + 14:
            h = max(12.0, float(layout.height()) * 0.55)
        cx = layout.center().x()
        cy = layout.center().y()
        w = layout.width()
        local = {'l': (-w / 2.0, 0.0), 'r': (w / 2.0, 0.0)}
        result = {}
        for name, (lx, ly) in local.items():
            sx, sy = (self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[0], self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[1])
            result[name] = QRectF(sx - half_t, sy - h / 2.0, t, h)
        return result

    def _hit_text_chrome_mode(self, point, layout: QRectF, rotation_degrees: float, *, corner_size: float = 14.0) -> str | None:
        if layout.isNull():
            return None
        for name, handle in self._chrome_corner_handles(layout, rotation_degrees, corner_size).items():
            if handle.contains(point):
                return f'scale:{name}'
        pill_t = max(22.0, float(corner_size) + 8.0)
        for name, handle in self._text_lr_edge_handles(layout, rotation_degrees, thickness=pill_t, corner_clearance=max(12.0, float(corner_size) * 0.75)).items():
            if handle.adjusted(-8, -8, 8, 8).contains(point) and name in frozenset({'l', 'r'}):
                return 'box_w'
        lx, ly = (self._pointer_to_layer_local(float(point.x()), float(point.y()), layout.center().x(), layout.center().y(), rotation_degrees)[0], self._pointer_to_layer_local(float(point.x()), float(point.y()), layout.center().x(), layout.center().y(), rotation_degrees)[1])
        hw = max(1.0, layout.width() / 2.0)
        hh = max(1.0, layout.height() / 2.0)
        band = max(18.0, pill_t)
        corner_z = max(18.0, float(corner_size) + 2.0)
        on_left = -hw - band <= lx <= -hw + band
        on_right = hw - band <= lx <= hw + band
        in_y = abs(ly) <= hh + band
        away_corner = abs(ly) <= max(0.0, hh - corner_z * 0.35)
        if (on_left or on_right) and in_y and away_corner:
            return 'box_w'

    def _edge_handles_rotated(self, layout: QRectF, rotation_degrees: float, size: float=10.0) -> dict[str, QRectF]:
        if abs(float(rotation_degrees or 0)) < 0.01:
            return self._edge_handles(layout, size)
        cx = layout.center().x()
        cy = layout.center().y()
        h, w = (layout.height(), layout.width())
        edges = {'l': (-w / 2, 0.0), 'r': (w / 2, 0.0), 't': (0.0, -h / 2), 'b': (0.0, h / 2)}
        half = size / 2
        result = {}
        for name, (lx, ly) in edges.items():
            sx, sy = (self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[0], self._map_layer_local_to_screen(cx, cy, lx, ly, rotation_degrees)[1])
            result[name] = QRectF(sx - half, sy - half, size, size)
        return result

    def _point_hits_rotated_layout(self, point, layout: QRectF, rotation_degrees: float, *, pad: float) -> bool:
        if layout.isNull():
            return False
        lx, ly = (self._pointer_to_layer_local(float(point.x()), float(point.y()), layout.center().x(), layout.center().y(), rotation_degrees)[0], self._pointer_to_layer_local(float(point.x()), float(point.y()), layout.center().x(), layout.center().y(), rotation_degrees)[1])
        hw = layout.width() / 2 + pad
        hh = layout.height() / 2 + pad
        return abs(lx) <= hw and abs(ly) <= hh

    def _draw_rotation_degree_badge(self, painter: QPainter, layout: QRectF, rotation_degrees: float) -> None:
        if layout.isNull():
            return None
        deg = float(rotation_degrees or 0)
        show = bool(getattr(self, '_dragging_rotation', False)) or abs(deg) >= 0.05
        if show:
            sx, sy = (self._map_layer_local_to_screen(layout.center().x(), layout.center().y(), 0.0, -(layout.height() / 2) - 26.0, deg)[0], self._map_layer_local_to_screen(layout.center().x(), layout.center().y(), 0.0, -(layout.height() / 2) - 26.0, deg)[1])
            label = f'.2f°'
            font = painter.font()
            font.setPointSize(10)
            font.setBold(True)
            painter.setFont(font)
            metrics = painter.fontMetrics()
            tw = metrics.horizontalAdvance(label) + 16
            th = metrics.height() + 8
            badge = QRectF(sx - tw / 2, sy - th / 2, tw, th)
            painter.save()
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor(255, 255, 255, 235))
            painter.drawRoundedRect(badge, 8, 8)
            painter.setPen(QColor('#1A1F27'))
            painter.drawText(badge, Qt.AlignmentFlag.AlignCenter, label)
            painter.restore()
        else:
            return None

    def _draw_selection_chrome(self, painter: QPainter) -> None:
        if self._selection == 'video' and self._is_crop_editing():
            rect = self.last_crop_rect
            if rect.isNull():
                pass
            else:
                painter.save()
                painter.setPen(QPen(QColor('#FFD166'), 2.0, Qt.PenStyle.SolidLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawRect(rect)
                painter.setBrush(QColor('#FFD166'))
                for handle in self._corner_handles(rect).values():
                    painter.drawEllipse(handle)
                painter.setBrush(QColor('#FFE8A3'))
                for handle in self._edge_handles(rect, 9).values():
                    painter.drawRect(handle)
                painter.restore()
            return None
        rect = QRectF()
        show_edges = False
        edges_lr_only = False
        edge_size = 9.0
        chrome_kind = self._selection
        if not chrome_kind and self._hover_kind in frozenset({'background', 'blend', 'logo', 'text', 'subtitle_source', 'overlay', 'video', 'subtitle', 'title'}):
            chrome_kind = self._hover_kind
        if chrome_kind == 'video':
            rect = self.last_video_rect
            show_edges = True
        elif chrome_kind == 'subtitle':
            rect = self.last_subtitle_rect
            show_edges = True
            edges_lr_only = True
            edge_size = 14.0
        elif chrome_kind == 'subtitle_source':
            rect = getattr(self, 'last_subtitle_source_rect', QRectF())
            show_edges = False
        elif chrome_kind == 'title':
            rect = self.last_video_title_rect
            show_edges = True
            edges_lr_only = True
            edge_size = 14.0
        elif chrome_kind == 'text':
            rect = self.last_text_overlay_rect
            show_edges = str(self.state.values.get('text_overlay_style', 'static')) == 'static'
            edges_lr_only = show_edges
            edge_size = 14.0 if show_edges else 9.0
        elif chrome_kind == 'logo':
            rect = self.last_logo_layout_rect if self.last_logo_layout_rect.isNull() else self.last_logo_rect
        elif chrome_kind == 'overlay':
            rect = self.last_effect_overlay_rect
        elif chrome_kind == 'blend':
            rect = self.last_blend_rect
        elif chrome_kind == 'background':
            rect = self.last_background_rect if self.last_background_rect.isNull() else self._target_rect()
        elif chrome_kind == 'blur':
            idx = int(self.state.values.get('blur_zone_index', 0) or 0)
            layouts = getattr(self, 'last_blur_layout_rects', None) or []
            if 0 <= idx < len(layouts) and (not layouts[idx].isNull()):
                rect = layouts[idx]
            elif 0 <= idx < len(self.last_blur_rects):
                rect = self.last_blur_rects[idx]
            show_edges = True
            edges_lr_only = False
            edge_size = 12.0
        if rect.isNull():
            return None
        if chrome_kind == 'subtitle_source':
            painter.save()
            painter.setPen(QPen(QColor('#5CC8FF'), 1.6, Qt.PenStyle.SolidLine))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(rect)
            painter.restore()
            return None
        if chrome_kind in frozenset({'background', 'blend', 'logo', 'text', 'overlay', 'video', 'subtitle', 'title', 'blur'}):
            color = QColor('#9B7BFF' if chrome_kind == 'blend' else '#B08AE6' if chrome_kind == 'background' else '#5CC8FF')
            rot = self._layer_rotation_for_chrome(chrome_kind)
            self._draw_rotated_rect_chrome(painter, rect, rot, color, show_edges=show_edges, edges_lr_only=edges_lr_only, edge_size=edge_size)
            if chrome_kind == 'overlay':
                self._draw_film_mask_chrome(painter, rect, rot)
            if chrome_kind == 'background':
                self._draw_background_cover_hint(painter, rect)
            return None
        painter.save()
        painter.setPen(QPen(QColor('#5CC8FF'), 1.6, Qt.PenStyle.SolidLine))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawRect(rect)
        painter.setBrush(QColor('#5CC8FF'))
        for handle in self._corner_handles(rect).values():
            painter.drawEllipse(handle)
        painter.restore()

    def _draw_rotation_handle_ui(self, painter: QPainter, rect: QRectF, color: QColor, rotation_degrees: float=0.0) -> None:
        handle = self._rotation_handle_rect(rect, rotation_degrees)
        rad = math.radians(float(rotation_degrees or 0))
        cy, cx = (rect.center().y(), rect.center().x())
        local_bottom = QPointF(0, rect.height() / 2)
        bottom_mid = QPointF(cx - local_bottom.y() * math.sin(rad), cy + local_bottom.y() * math.cos(rad))
        center = handle.center()
        painter.setPen(QPen(color, 1.4))
        painter.drawLine(bottom_mid, center)
        painter.setBrush(QColor('#1A2330'))
        painter.setPen(QPen(color, 1.6))
        painter.drawEllipse(handle)
        arc_pen = QPen(color, 1.2)
        painter.setPen(arc_pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        inset = handle.adjusted(3, 3, -3, -3)
        painter.drawArc(inset, 480, 4800)

    def _blend_covers_canvas(self, bounds: QRectF, *, index: int | None) -> bool:
        items = ensure_blend_layers(self.state.values)
        idx = int(index) if index is not None else int(self.state.values.get('blend_layer_index', 0) or 0)
        if 0 <= idx < len(items):
            try:
                scale = int(items[idx].get('scale_percent', 100) or 100)
            except (TypeError, ValueError):
                scale = 100
            if scale >= 90:
                return True
        else:
            target = self._target_rect()
            if bounds.isNull() or target.isNull():
                return False
            tw = max(1.0, float(target.width()))
            th = max(1.0, float(target.height()))
            return True if float(bounds.width()) >= tw * 0.88 else float(bounds.width()) * float(bounds.height()) >= tw * th * 0.72

    def _hit_test_selection_priority(self, point) -> tuple[str, str] | None:
        kind = str(self._selection or '')
        if not kind or self._is_crop_editing():
            return None
        text_locked = self._track_locked('text_logo')
        video_locked = self._track_locked('video')
        blur_locked = self._track_locked('blur') or video_locked
        if kind == 'blend' and (not text_locked):
            blend_items = ensure_blend_layers(self.state.values)
            sel = int(self.state.values.get('blend_layer_index', 0) or 0)
            item = blend_items[sel]
            if 0 <= sel < len(blend_items) and (item.get('preview_hidden') or item.get('edit_locked')):
                pass
            else:
                layout = QRectF(self.last_blend_rect)
                bounds = QRectF()
                for index, item_layout, item_bounds in self.last_blend_rects:
                    if index == sel:
                        layout = QRectF(item_layout)
                        bounds = QRectF(item_bounds)
                hit_rect = layout if layout.isNull() else bounds
                if hit_rect.isNull():
                    pass
                else:
                    bl_rot = self._layer_rotation_for_chrome('blend')
                    for name, handle in self._chrome_corner_handles(layout if layout.isNull() else hit_rect, bl_rot, 16).items():
                        if handle.contains(point):
                            if not layout.isNull():
                                self.last_blend_rect = QRectF(layout)
                            return ('blend', f'scale:{name}')
                    pad_rect = bounds if bounds.isNull() else hit_rect
                    if pad_rect.adjusted(-6, -6, 6, 6).contains(point) or self._point_hits_rotated_layout(point, layout if layout.isNull() else hit_rect, bl_rot, pad=6):
                        if not layout.isNull():
                            self.last_blend_rect = QRectF(layout)
                        return ('blend', 'move')
            return None
        if kind == 'blur' and (not blur_locked):
            blur = self._hit_test_blur(point)
            if blur is not None:
                index, mode = (blur[0], blur[1])
                return ('blur', f'{index}:{mode}')
            return None
        if kind == 'overlay' and (not text_locked):
            overlay_items = ensure_media_overlays(self.state.values)
            sel = int(self.state.values.get('media_overlay_index', 0) or 0)
            item = overlay_items[sel]
            if 0 <= sel < len(overlay_items) and (item.get('preview_hidden') or item.get('edit_locked')):
                pass
            else:
                layout = QRectF(self.last_effect_overlay_rect)
                bounds = QRectF()
                for index, item_layout, item_bounds in self.last_overlay_rects:
                    if index == sel:
                        layout = QRectF(item_layout)
                        bounds = QRectF(item_bounds)
                hit_rect = layout if layout.isNull() else bounds
                if hit_rect.isNull():
                    pass
                else:
                    ov_rot = self._layer_rotation_for_chrome('overlay')
                    hit_layout = layout if layout.isNull() else hit_rect
                    feather_axis = self._film_mask_feather_axis_at(point, hit_layout, ov_rot)
                    if feather_axis is not None:
                        if not layout.isNull():
                            self.last_effect_overlay_rect = QRectF(layout)
                        return ('overlay', f'mask_feather:{feather_axis}')
                    for name, handle in self._chrome_corner_handles(hit_layout, ov_rot, 16).items():
                        if handle.contains(point):
                            if not layout.isNull():
                                self.last_effect_overlay_rect = QRectF(layout)
                            return ('overlay', f'scale:{name}')
                    pad_rect = bounds if bounds.isNull() else hit_rect
                    if pad_rect.adjusted(-6, -6, 6, 6).contains(point) or self._point_hits_rotated_layout(point, layout if layout.isNull() else hit_rect, ov_rot, pad=6):
                        if not layout.isNull():
                            self.last_effect_overlay_rect = QRectF(layout)
                        return ('overlay', 'move')
            return None
        if kind != 'video' or video_locked:
            if kind == 'background':
                layout = QRectF(self.last_background_rect)
                bounds = QRectF()
                sel = int(self.state.values.get('background_layer_index', 0) or 0)
                for index, item_layout, item_bounds in self.last_background_rects:
                    if index == sel:
                        layout = QRectF(item_layout)
                        bounds = QRectF(item_bounds)
                hit_rect = layout if layout.isNull() else bounds
                if hit_rect.isNull():
                    target = self._target_rect()
                    return ('background', 'move') if not target.isNull() and target.contains(point) else None
                bg_rot = self._layer_rotation_for_chrome('background')
                for name, handle in self._chrome_corner_handles(layout if layout.isNull() else hit_rect, bg_rot, 16).items():
                    if handle.contains(point):
                        if not layout.isNull():
                            self.last_background_rect = QRectF(layout)
                        return ('background', f'scale:{name}')
                pad_rect = bounds if bounds.isNull() else hit_rect
                if pad_rect.adjusted(-6, -6, 6, 6).contains(point) or self._point_hits_rotated_layout(point, layout if layout.isNull() else hit_rect, bg_rot, pad=6):
                    if not layout.isNull():
                        self.last_background_rect = QRectF(layout)
                    return ('background', 'move')
                return None
        else:
            if self.last_video_rect.isNull():
                return None
            video_rot = self._layer_rotation_for_chrome('video')
            for handle in self._chrome_corner_handles(self.last_video_rect, video_rot, 14).values():
                if handle.contains(point):
                    return ('video', 'scale')
            for name, handle in self._edge_handles_rotated(self.last_video_rect, video_rot, 14).items():
                if handle.contains(point):
                    return ('video', 'scale_x') if name in frozenset({'l', 'r'}) else ('video', 'scale_y')
            return ('video', 'move') if self._point_hits_rotated_layout(point, self.last_video_rect, video_rot, pad=4) else None

    def _hit_test_interactive(self, point) -> tuple[str, str] | None:
        subtitle_locked = self._track_locked('subtitle')
        text_locked = self._track_locked('text_logo')
        title_locked = self._track_locked('video_title')
        text_ov_locked = self._track_locked('text_overlay')
        video_locked = self._track_locked('video')
        overlay_items = ensure_media_overlays(self.state.values)
        blend_items = ensure_blend_layers(self.state.values)

        def overlay_item_ok(index: int) -> bool:
            if text_locked:
                return False
            if index < 0 or index >= len(overlay_items):
                return True
            item = overlay_items[index]
            return not item.get('preview_hidden') and (not item.get('edit_locked'))

        def blend_item_ok(index: int) -> bool:
            if text_locked:
                return False
            if index < 0 or index >= len(blend_items):
                return True
            item = blend_items[index]
            return not item.get('preview_hidden') and (not item.get('edit_locked'))
        chrome = self._selection_chrome_rect(self._selection)
        rot_deg = self._layer_rotation_for_chrome(self._selection)
        feather_axis = self._film_mask_feather_axis_at(point, chrome, rot_deg)
        if self._selection == 'overlay' and feather_axis is not None:
            return ('overlay', f'mask_feather:{feather_axis}')
        rot_handle = self._rotation_handle_rect(chrome, rot_deg)
        if not self._is_crop_editing() and self._selection in frozenset({'background', 'blend', 'logo', 'text', 'overlay', 'video', 'subtitle', 'title', 'blur'}) and (not chrome.isNull()) and rot_handle.contains(point):
            return (self._selection, 'rotate')
        focused = self._hit_test_selection_priority(point)
        if focused is not None:
            return focused
        if not subtitle_locked and hit_burn_drag_kind(point, getattr(self, 'last_subtitle_source_rect', QRectF()), self.last_subtitle_rect) == 'source':
            return ('subtitle_source', 'move')
        mode = self._hit_text_chrome_mode(point, self.last_subtitle_rect, self._layer_rotation_for_chrome('subtitle'))
        if self._selection == 'subtitle' and (not subtitle_locked) and (not self.last_subtitle_rect.isNull()) and (mode is not None):
            return ('subtitle', mode)
        mode = self._hit_text_chrome_mode(point, self.last_video_title_rect, self._layer_rotation_for_chrome('title'))
        if self._selection == 'title' and (not title_locked) and (not self.last_video_title_rect.isNull()) and (mode is not None):
            return ('title', mode)
        if not subtitle_locked and hit_burn_drag_kind(point, getattr(self, 'last_subtitle_source_rect', QRectF()), self.last_subtitle_rect) == 'source':
            return ('subtitle_source', 'move')
        mode = self._hit_text_chrome_mode(point, self.last_subtitle_rect, self._layer_rotation_for_chrome('subtitle'))
        if not subtitle_locked and (not self.last_subtitle_rect.isNull()) and (mode is not None):
            return ('subtitle', mode)
        mode = self._hit_text_chrome_mode(point, self.last_video_title_rect, self._layer_rotation_for_chrome('title'))
        if not title_locked and (not self.last_video_title_rect.isNull()) and (mode is not None):
            return ('title', mode)
        mode = self._hit_text_chrome_mode(point, self.last_text_overlay_rect, self._layer_rotation_for_chrome('text'))
        if not text_ov_locked and str(self.state.values.get('text_overlay_style', 'static')) == 'static' and (not self.last_text_overlay_rect.isNull()) and (mode is not None):
            return ('text', mode)
        if not video_locked and self._is_crop_editing() and (not self.last_crop_rect.isNull()):
            for name, handle in self._corner_handles(self.last_crop_rect, 14).items():
                if handle.contains(point):
                    return ('video', f'crop_{name}')
            for name, handle in self._edge_handles(self.last_crop_rect, 14).items():
                if handle.contains(point):
                    return ('video', f'crop_{name}')
            if self.last_crop_rect.adjusted(-4, -4, 4, 4).contains(point):
                return ('video', 'crop_move')
            if not self.last_video_rect.isNull() and self.last_video_rect.contains(point):
                return ('video', 'crop_move')
        elif self._selection == 'blur' or video_locked or self._is_crop_editing() or self.last_video_rect.isNull():
            burn_kind = hit_burn_drag_kind(point, getattr(self, 'last_subtitle_source_rect', QRectF()), self.last_subtitle_rect)
            if burn_kind == 'source':
                return ('subtitle_source', 'move')
            if not subtitle_locked and burn_kind == 'working':
                return ('subtitle', 'move')
            if not text_ov_locked and str(self.state.values.get('text_overlay_style', 'static')) == 'static' and (not self.last_text_overlay_rect.isNull()) and self._point_hits_rotated_layout(point, self.last_text_overlay_rect, self._layer_rotation_for_chrome('text'), pad=6):
                return ('text', 'move')
            if not title_locked and (not self.last_video_title_rect.isNull()) and self._point_hits_rotated_layout(point, self.last_video_title_rect, self._layer_rotation_for_chrome('title'), pad=6):
                return ('title', 'move')
            logo_layout = self.last_logo_layout_rect if self.last_logo_layout_rect.isNull() else self.last_logo_rect
            if not text_locked and (not logo_layout.isNull()):
                logo_rot = float(self.state.values.get('logo_rotation_degrees', 0) or 0)
                for name, handle in self._chrome_corner_handles(logo_layout, logo_rot, 16).items():
                    if handle.contains(point):
                        return ('logo', f'scale:{name}')
                if not self.last_logo_rect.isNull() and self.last_logo_rect.adjusted(-6, -6, 6, 6).contains(point):
                    return ('logo', 'move')
            elif text_locked or not overlay_item_ok(int(self.state.values.get('media_overlay_index', 0) or 0)) or self._selection != 'overlay' or self.last_effect_overlay_rect.isNull():
                for index, layout, bounds in reversed(self.last_overlay_rects):
                    rot = 0.0
                    if 0 <= index < len(overlay_items):
                        rot = float(overlay_items[index].get('rotation_degrees', 0) or 0)
                    if overlay_item_ok(index) and self._point_hits_rotated_layout(point, layout, rot, pad=6):
                        self.state.values['media_overlay_index'] = index
                        sync_flat_keys_from_selected(self.state.values)
                        self.last_effect_overlay_rect = QRectF(layout)
                        return ('overlay', 'move')
                if text_locked or not blend_item_ok(int(self.state.values.get('blend_layer_index', 0) or 0)) or self._selection != 'blend' or self.last_blend_rect.isNull():
                    for index, layout, bounds in reversed(self.last_blend_rects):
                        rot = 0.0
                        if 0 <= index < len(blend_items):
                            rot = float(blend_items[index].get('rotation_degrees', 0) or 0)
                        if blend_item_ok(index) and (self._selection == 'blend' or not self._blend_covers_canvas(bounds, index=index)) and self._point_hits_rotated_layout(point, layout, rot, pad=6):
                            self.state.values['blend_layer_index'] = index
                            sync_flat_keys_from_selected_blend(self.state.values)
                            self.last_blend_rect = QRectF(layout)
                            return ('blend', 'move')
                    bg_items = ensure_background_layers(self.state.values)
                    if self._selection != 'background' or self.last_background_rect.isNull():
                        for index, layout, bounds in reversed(self.last_background_rects):
                            item = bg_items[index]
                            covers = background_layer_uses_cover(item) or int(item.get('scale_percent', 100) or 100) >= 90
                            rot = float(item.get('rotation_degrees', 0) or 0)
                            if index >= 0 and index < len(bg_items) and (not item.get('preview_hidden')) and (not item.get('edit_locked')) and (self._selection == 'background' or not covers) and self._point_hits_rotated_layout(point, layout, rot, pad=6):
                                self.state.values['background_layer_index'] = index
                                sync_flat_keys_from_selected_background(self.state.values)
                                self.last_background_rect = QRectF(layout)
                                return ('background', 'move')
                        blur = self._hit_test_blur(point) if video_locked else None
                        if blur is not None:
                            index, mode = (blur[0], blur[1])
                            return ('blur', f'{index}:{mode}')
                        if not video_locked and (not self.last_video_rect.isNull()) and self._point_hits_rotated_layout(point, self.last_video_rect, self._layer_rotation_for_chrome('video')):
                            return ('video', 'move')
                        target = self._target_rect()
                        if self.has_frame and (not target.isNull()) and target.contains(point) and self._background_layers_active(self.state.values):
                            video = self.last_video_rect
                            if video.isNull() or not video.adjusted(-2, -2, 2, 2).contains(point):
                                return ('background', 'select')
                        elif not video_locked and self.has_frame and target.contains(point):
                            return ('video', 'move')
                    else:
                        bg_rot = self._layer_rotation_for_chrome('background')
                        for name, handle in self._chrome_corner_handles(self.last_background_rect, bg_rot, 16).items():
                            if handle.contains(point):
                                return ('background', f'scale:{name}')
                else:
                    bl_rot = self._layer_rotation_for_chrome('blend')
                    for name, handle in self._chrome_corner_handles(self.last_blend_rect, bl_rot, 16).items():
                        if handle.contains(point):
                            return ('blend', f'scale:{name}')
            else:
                ov_rot = self._layer_rotation_for_chrome('overlay')
                for name, handle in self._chrome_corner_handles(self.last_effect_overlay_rect, ov_rot, 16).items():
                    if handle.contains(point):
                        return ('overlay', f'scale:{name}')
        else:
            video_rot = self._layer_rotation_for_chrome('video')
            for handle in self._chrome_corner_handles(self.last_video_rect, video_rot, 14).values():
                if handle.contains(point):
                    return ('video', 'scale')
            for name, handle in self._edge_handles_rotated(self.last_video_rect, video_rot, 14).items():
                if handle.contains(point):
                    return ('video', 'scale_x') if name in frozenset({'l', 'r'}) else ('video', 'scale_y')

    def _current_scale_xy(self) -> tuple[int, int]:
        from core.scene_clip_fx import apply_frame_adjust_gate
        values = apply_frame_adjust_gate(self.state.values)
        return resolve_scale_xy(int(values.get('scale_percent', 100)), int(values.get('scale_x_percent', values.get('scale_percent', 100))), int(values.get('scale_y_percent', values.get('scale_percent', 100))))

    def _set_scale_xy(self, scale_x: int, scale_y: int) -> None:
        sx = max(10, min(500, int(scale_x)))
        sy = max(10, min(500, int(scale_y)))
        self.state.values['scale_x_percent'] = sx
        self.state.values['scale_y_percent'] = sy
        self.state.values['scale_percent'] = max(10, min(500, round((sx + sy) / 2)))

    def _active_subtitle_drag_rect(self) -> QRectF:
        rect = QRectF(getattr(self, 'last_subtitle_source_rect', QRectF()))
        return QRectF(self.last_subtitle_rect) if getattr(self, '_subtitle_drag_layer', 'working') != 'source' or rect.isNull() else rect

    def _apply_subtitle_drag(self, top_y: float) -> None:
        target = self._target_rect()
        plate, _ = self._subtitle_layout_context(target)
        height = max(1.0, self._active_subtitle_drag_rect().height())
        top = max(plate.top(), min(float(top_y), plate.bottom() - height))
        center_y = top + height / 2
        if self._preview_snap_enabled():
            threshold = plate.height() * self._SNAP_CENTER_NORM
            if abs(center_y - plate.center().y()) <= threshold:
                top = plate.center().y() - height / 2
                top = max(plate.top(), min(top, plate.bottom() - height))
                self._set_alignment_guides(vertical=True, horizontal=True)
            else:
                self._set_alignment_guides(vertical=True, horizontal=False)
        else:
            self._set_alignment_guides(vertical=False, horizontal=False)
        self._live_subtitle_top_norm = (top - plate.top()) / max(1.0, plate.height())
        self.update()

    def _finalize_subtitle_placement(self) -> None:
        if self._live_subtitle_top_norm is None:
            return None
        target = self._target_rect()
        plate, _ = self._subtitle_layout_context(target)
        top = plate.top() + self._live_subtitle_top_norm * plate.height()
        height = max(1.0, self._active_subtitle_drag_rect().height())
        center_y = top + height / 2
        self._commit_subtitle_placement_from_center(center_y)

    def _commit_subtitle_placement_from_center(self, center_y: float, height: float=0) -> None:
        target = self._target_rect()
        plate, _, play_h, pos_scale = (self._subtitle_layout_context(target)[0], self._subtitle_layout_context(target)[1], self._subtitle_layout_context(target)[2], self._subtitle_layout_context(target)[3])
        gap_bottom = plate.bottom() - center_y
        margin = max(0, min(play_h, round(gap_bottom / max(1e-06, pos_scale))))
        layer = getattr(self, '_subtitle_drag_layer', 'working')
        if layer == 'source':
            apply_burn_drag_margin(self.state.values, 'source', margin)
            return None
        self.state.values['subtitle_position'] = 'bottom'
        apply_burn_drag_margin(self.state.values, 'working', margin)
        self.state.values['subtitle_margin_refs_center'] = True
        self._pending_subtitle_placement = ('bottom', margin)

    def _commit_subtitle_placement_from_top(self, top: float, height: float) -> None:
        center_y = top + height / 2
        self._commit_subtitle_placement_from_center(center_y, height)

    def _set_subtitle_scale_xy(self, scale_x: int, scale_y: int) -> None:
        sx = max(10, min(500, int(scale_x)))
        sy = max(10, min(500, int(scale_y)))
        target = self._target_rect()
        plate, play_w, play_h, view_scale = (self._subtitle_layout_context(target)[0], self._subtitle_layout_context(target)[1], self._subtitle_layout_context(target)[2], self._subtitle_layout_context(target)[3])
        start_w = max(8.0, self._subtitle_scale_start_half_w * 2)
        start_h = max(8.0, self._subtitle_scale_start_half_h * 2)
        max_w = plate.width() * 0.98
        max_h = (float(play_h) - 4.0) * view_scale
        base_w = start_w / max(0.1, self._subtitle_scale_start_x / 100.0)
        base_h = start_h / max(0.1, self._subtitle_scale_start_y / 100.0)
        max_sx = int(max_w / max(1.0, base_w) * 100)
        max_sy = int(max_h / max(1.0, base_h) * 100)
        sx = max(10, min(sx, max(10, max_sx)))
        sy = max(10, min(sy, max(10, max_sy)))
        self.state.values['subtitle_scale_x_percent'] = sx
        self.state.values['subtitle_scale_y_percent'] = sy
        self._pending_subtitle_scale = (sx, sy)

    def _apply_subtitle_font_scale_uniform(self, pointer_x: float, pointer_y: float, *, axis: str) -> None:
        cx = self._subtitle_scale_center_x
        cy = self._subtitle_scale_center_y
        if axis == 'both':
            dist = math.hypot(pointer_x - cx, pointer_y - cy)
            ratio = dist / max(8.0, self._subtitle_resize_start_dist)
        elif axis == 'y':
            half = abs(pointer_y - cy)
            ratio = half / max(8.0, self._subtitle_scale_start_half_h)
        else:
            half = abs(pointer_x - cx)
            ratio = half / max(8.0, self._subtitle_scale_start_half_w)
        live = max(15.0, min(240.0, float(self._subtitle_resize_start_font) * ratio))
        self._live_subtitle_font_size = live
        rounded = max(15, min(240, int(round(live))))
        self.state.values['subtitle_font_size'] = rounded
        self._pending_subtitle_font_size = rounded
        self.state.values['subtitle_scale_percent'] = 100
        self.state.values['subtitle_scale_x_percent'] = 100
        self.state.values['subtitle_scale_y_percent'] = 100
        self._subtitle_measure_cache = None
        if self._subtitle_anchor_y_norm is None and (not self.last_subtitle_rect.isNull()):
            target = self._target_rect()
            self._subtitle_anchor_y_norm = (self.last_subtitle_rect.center().y() - target.top()) / max(1.0, target.height())
        self.update()

    def _apply_subtitle_scale_corner(self, pointer_x: float, pointer_y: float) -> None:
        self._apply_subtitle_font_scale_uniform(pointer_x, pointer_y)

    def _apply_subtitle_scale_axis(self, pointer_x: float, pointer_y: float, *, axis: str) -> None:
        self._apply_subtitle_font_scale_uniform(pointer_x, pointer_y, axis=axis)

    def _apply_subtitle_box_width(self, pointer_x: float) -> None:
        target = self._target_rect()
        half = abs(pointer_x - self._subtitle_scale_center_x)
        box_w = half * 2.0 / max(1.0, target.width())
        box_w = max(0.15, min(1.0, box_w))
        self._live_subtitle_box_w_norm = box_w
        percent = int(round(box_w * 100))
        self.state.values['subtitle_box_width_percent'] = percent
        self.state.values['subtitle_layout_font_size'] = int(round(self._subtitle_display_font_size(self.state.values)))
        self._pending_subtitle_box_width = percent
        self._subtitle_measure_cache = None
        if self._subtitle_anchor_y_norm is None and (not self.last_subtitle_rect.isNull()):
            target = self._target_rect()
            self._subtitle_anchor_y_norm = (self.last_subtitle_rect.center().y() - target.top()) / max(1.0, target.height())
        self.update()

    def _apply_subtitle_scale(self, pointer_x: float, pointer_y: float) -> None:
        self._apply_subtitle_scale_corner(pointer_x, pointer_y)

    def _apply_subtitle_resize(self, pointer_y: float) -> None:
        self._apply_subtitle_scale_axis(self._subtitle_scale_center_x, pointer_y, axis='y')

    def _apply_video_pan(self, dx: float, dy: float) -> None:
        target = self._target_rect()
        ref_w, ref_h = (self._output_reference_size()[0], self._output_reference_size()[1])
        unit_x = ref_w / max(1.0, target.width())
        unit_y = ref_h / max(1.0, target.height())
        offset_x = float(self.state.values.get('offset_x', 0)) + dx * unit_x
        offset_y = float(self.state.values.get('offset_y', 0)) + dy * unit_y
        if self._preview_snap_enabled():
            thresh_x = ref_w * self._SNAP_CENTER_NORM
            thresh_y = ref_h * self._SNAP_CENTER_NORM
            snap_v = abs(offset_x) <= thresh_x
            snap_h = abs(offset_y) <= thresh_y
            if snap_v:
                offset_x = 0.0
            if snap_h:
                offset_y = 0.0
            self._set_alignment_guides(vertical=snap_v, horizontal=snap_h)
        else:
            self._set_alignment_guides(vertical=False, horizontal=False)
        offset_x = int(round(max(-2000, min(2000, offset_x))))
        offset_y = int(round(max(-2000, min(2000, offset_y))))
        scale_x, scale_y = (self._current_scale_xy()[0], self._current_scale_xy()[1])
        self.state.values['offset_x'] = offset_x
        self.state.values['offset_y'] = offset_y
        self._pending_video_transform = (offset_x, offset_y, scale_x, scale_y)
        self.update()

    def _apply_video_scale_uniform(self, pointer_x: float, pointer_y: float) -> None:
        center = self.last_video_rect.center()
        dist = math.hypot(pointer_x - center.x(), pointer_y - center.y())
        ratio = dist / max(8.0, self._video_scale_start_dist)
        scale_x = max(10, min(500, int(round(self._video_scale_start_x * ratio))))
        scale_y = max(10, min(500, int(round(self._video_scale_start_y * ratio))))
        if self._video_scale_start_x == self._video_scale_start_y:
            scale_y = scale_x
        self._set_scale_xy(scale_x, scale_y)
        offset_x = int(self.state.values.get('offset_x', 0))
        offset_y = int(self.state.values.get('offset_y', 0))
        self._pending_video_transform = (offset_x, offset_y, scale_x, scale_y)
        self.update()

    def _apply_video_scale_freeform(self, pointer_x: float, pointer_y: float) -> None:
        center = self.last_video_rect.center()
        half_w = abs(pointer_x - center.x())
        half_h = abs(pointer_y - center.y())
        ratio_x = half_w / max(8.0, self._video_scale_start_half_w)
        ratio_y = half_h / max(8.0, self._video_scale_start_half_h)
        scale_x = max(10, min(500, int(round(self._video_scale_start_x * ratio_x))))
        scale_y = max(10, min(500, int(round(self._video_scale_start_y * ratio_y))))
        self.state.values['uniform_scale_enabled'] = False
        self._set_scale_xy(scale_x, scale_y)
        offset_x = int(self.state.values.get('offset_x', 0))
        offset_y = int(self.state.values.get('offset_y', 0))
        self._pending_video_transform = (offset_x, offset_y, scale_x, scale_y)
        self.update()

    def _uniform_scale_active(self) -> bool:
        base = bool(self.state.values.get('uniform_scale_enabled', True))
        mods = QApplication.keyboardModifiers()
        shift = bool(mods & Qt.KeyboardModifier.ShiftModifier)
        return not base if shift else base

    def _apply_video_scale_axis(self, pointer_x: float, pointer_y: float, *, axis: str) -> None:
        center = self.last_video_rect.center()
        if axis == 'x':
            half = abs(pointer_x - center.x())
            ratio = half / max(8.0, self._video_scale_start_half_w)
            scale_x = max(10, min(500, int(round(self._video_scale_start_x * ratio))))
            scale_y = self._video_scale_start_y
        else:
            half = abs(pointer_y - center.y())
            ratio = half / max(8.0, self._video_scale_start_half_h)
            scale_x = self._video_scale_start_x
            scale_y = max(10, min(500, int(round(self._video_scale_start_y * ratio))))
        self._set_scale_xy(scale_x, scale_y)
        offset_x = int(self.state.values.get('offset_x', 0))
        offset_y = int(self.state.values.get('offset_y', 0))
        self._pending_video_transform = (offset_x, offset_y, scale_x, scale_y)
        self.update()

    def _apply_video_scale(self, pointer_x: float, pointer_y: float) -> None:
        self._apply_video_scale_uniform(pointer_x, pointer_y)

    def enter_crop_mode(self) -> None:
        if self.state.values.get('crop_enabled'):
            self._crop_tool_active = True
            self._selection = 'video'
            self.update()
        else:
            return None

    def exit_crop_mode(self) -> None:
        self._crop_tool_active = False
        self._dragging_crop = False
        if self._selection == 'video':
            self._selection = ''
        self.update()

    def _is_crop_editing(self) -> bool:
        from core.scene_clip_fx import adjust_frame_enabled
        return (self._crop_tool_active or self._dragging_crop if self.state.values.get('crop_enabled') else False) if adjust_frame_enabled(self.state.values) else False

    def _crop_norm_values(self) -> tuple[float, float, float, float]:
        values = self.state.values
        left = float(values.get('crop_left_percent', 0)) / 100.0
        top = float(values.get('crop_top_percent', 0)) / 100.0
        right = float(values.get('crop_right_percent', 100)) / 100.0
        bottom = float(values.get('crop_bottom_percent', 100)) / 100.0
        resolved = resolve_crop_norm(True, left, top, right, bottom)
        return (0.0, 0.0, 1.0, 1.0) if resolved is None else resolved

    def _cropped_frame(self, frame: QImage) -> QImage:
        if frame.isNull():
            return frame
        from core.scene_clip_fx import apply_frame_adjust_gate
        gated = apply_frame_adjust_gate(self.state.values)
        crop = resolve_crop_norm(bool(gated.get('crop_enabled')), *self._crop_norm_values())
        if crop is None:
            return frame
        left, top, right, bottom = (crop[0], crop[1], crop[2], crop[3])
        x = int(round(frame.width() * left))
        y = int(round(frame.height() * top))
        width = max(1, int(round(frame.width() * (right - left))))
        height = max(1, int(round(frame.height() * (bottom - top))))
        x = max(0, min(frame.width() - 1, x))
        y = max(0, min(frame.height() - 1, y))
        width = max(1, min(frame.width() - x, width))
        height = max(1, min(frame.height() - y, height))
        return frame.copy(x, y, width, height)

    def _map_crop_rect(self, source_rect: QRectF, left: float, top: float, right: float, bottom: float) -> QRectF:
        return QRectF(source_rect.left() + source_rect.width() * left, source_rect.top() + source_rect.height() * top, source_rect.width() * max(0.01, right - left), source_rect.height() * max(0.01, bottom - top))

    def _draw_crop_dimmer(self, painter: QPainter, source_rect: QRectF, crop_rect: QRectF) -> None:
        dim = QColor(8, 11, 16, 140)
        top = QRectF(source_rect.left(), source_rect.top(), source_rect.width(), max(0.0, crop_rect.top() - source_rect.top()))
        bottom = QRectF(source_rect.left(), crop_rect.bottom(), source_rect.width(), max(0.0, source_rect.bottom() - crop_rect.bottom()))
        left = QRectF(source_rect.left(), crop_rect.top(), max(0.0, crop_rect.left() - source_rect.left()), crop_rect.height())
        right = QRectF(crop_rect.right(), crop_rect.top(), max(0.0, source_rect.right() - crop_rect.right()), crop_rect.height())
        for band in (top, bottom, left, right):
            if band.width() > 0.5 and band.height() > 0.5:
                painter.fillRect(band, dim)

    def _crop_cursor(self, mode: str) -> Qt.CursorShape:
        return Qt.CursorShape.SizeHorCursor if mode in frozenset({'crop_l', 'crop_r'}) else Qt.CursorShape.SizeVerCursor if mode in frozenset({'crop_b', 'crop_t'}) else Qt.CursorShape.SizeFDiagCursor if mode in frozenset({'crop_tl', 'crop_br'}) else Qt.CursorShape.SizeBDiagCursor if mode in frozenset({'crop_bl', 'crop_tr'}) else Qt.CursorShape.ClosedHandCursor

    def _commit_crop_norm(self, left: float, top: float, right: float, bottom: float) -> None:
        resolved = resolve_crop_norm(True, left, top, right, bottom)
        if resolved is None:
            left_i, top_i, right_i, bottom_i = ((0, 0, 100, 100)[0], (0, 0, 100, 100)[1], (0, 0, 100, 100)[2], (0, 0, 100, 100)[3])
        else:
            left_i = int(round(resolved[0] * 100))
            top_i = int(round(resolved[1] * 100))
            right_i = int(round(resolved[2] * 100))
            bottom_i = int(round(resolved[3] * 100))
        self.state.values['crop_left_percent'] = left_i
        self.state.values['crop_top_percent'] = top_i
        self.state.values['crop_right_percent'] = right_i
        self.state.values['crop_bottom_percent'] = bottom_i
        self._pending_video_crop = (left_i, top_i, right_i, bottom_i)
        self.update()

    def _clamp_crop_rect(self, left: float, top: float, right: float, bottom: float) -> tuple[float, float, float, float]:
        min_s = 0.05
        left = max(0.0, min(left, 1.0 - min_s))
        top = max(0.0, min(top, 1.0 - min_s))
        right = max(left + min_s, min(right, 1.0))
        bottom = max(top + min_s, min(bottom, 1.0))
        if right - left < min_s:
            right = min(1.0, left + min_s)
            left = max(0.0, right - min_s)
        if bottom - top < min_s:
            bottom = min(1.0, top + min_s)
            top = max(0.0, bottom - min_s)
        return (left, top, right, bottom)

    def _crop_aspect_ratio_norm(self) -> float:
        if self._frame.isNull():
            return 0.5625
        source_ratio = self._frame.width() / max(1, self._frame.height())
        return max(0.05, self.output_ratio / source_ratio)

    def _apply_crop_lock_aspect(self, left: float, top: float, right: float, bottom: float, *, fixed_edges: str) -> tuple[float, float, float, float]:
        if not self.state.values.get('crop_lock_aspect'):
            pass
        elif self._frame.isNull():
            pass
        else:
            ratio = self._crop_aspect_ratio_norm()
            min_s = 0.05
            key = str(fixed_edges).replace('crop_', '')
            if key == 't':
                height = max(min_s, bottom - top)
                width = max(min_s, height * ratio)
                cx = (left + right) / 2.0
                left = cx - width / 2.0
                right = cx + width / 2.0
            elif key == 'b':
                height = max(min_s, bottom - top)
                width = max(min_s, height * ratio)
                cx = (left + right) / 2.0
                left = cx - width / 2.0
                right = cx + width / 2.0
            elif key == 'l':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                cy = (top + bottom) / 2.0
                top = cy - height / 2.0
                bottom = cy + height / 2.0
            elif key == 'r':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                cy = (top + bottom) / 2.0
                top = cy - height / 2.0
                bottom = cy + height / 2.0
            elif key == 'tl':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                top = bottom - height
                left = right - width
            elif key == 'tr':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                top = bottom - height
            elif key == 'bl':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                bottom = top + height
                left = right - width
            elif key == 'br':
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                bottom = top + height
            else:
                width = max(min_s, right - left)
                height = max(min_s, width / ratio)
                cx = (left + right) / 2.0
                cy = (top + bottom) / 2.0
                left = cx - width / 2.0
                right = cx + width / 2.0
                top = cy - height / 2.0
                bottom = cy + height / 2.0
        return self._clamp_crop_rect(left, top, right, bottom)

    def _apply_crop_drag(self, pointer_x: float, pointer_y: float) -> None:
        if self.last_video_rect.width() < 1 or self.last_video_rect.height() < 1:
            return None
        origin_l, origin_t, origin_r, origin_b = (self._crop_drag_origin[0], self._crop_drag_origin[1], self._crop_drag_origin[2], self._crop_drag_origin[3])
        dx = (pointer_x - self._video_drag_last_x) / self.last_video_rect.width()
        dy = (pointer_y - self._video_drag_last_y) / self.last_video_rect.height()
        mode = self._crop_drag_mode
        left, top, right, bottom = ((origin_l, origin_t, origin_r, origin_b)[0], (origin_l, origin_t, origin_r, origin_b)[1], (origin_l, origin_t, origin_r, origin_b)[2], (origin_l, origin_t, origin_r, origin_b)[3])
        if mode == 'crop_move':
            width = right - left
            height = bottom - top
            left = origin_l + dx
            top = origin_t + dy
            right = left + width
            bottom = top + height
            if left < 0:
                right -= left
                left = 0.0
            if top < 0:
                bottom -= top
                top = 0.0
            if right > 1.0:
                left -= right - 1.0
                right = 1.0
            if bottom > 1.0:
                top -= bottom - 1.0
                bottom = 1.0
        else:
            if 'l' in mode.replace('crop_', ''):
                left = origin_l + dx
            if 'r' in mode.replace('crop_', ''):
                right = origin_r + dx
            if 't' in mode.replace('crop_', ''):
                top = origin_t + dy
            if 'b' in mode.replace('crop_', ''):
                bottom = origin_b + dy
            edge_key = mode.replace('crop_', '')
            left, top, right, bottom = (self._apply_crop_lock_aspect(left, top, right, bottom, fixed_edges=edge_key if edge_key in frozenset({'l', 'r', 't', 'b'}) else 'x')[0], self._apply_crop_lock_aspect(left, top, right, bottom, fixed_edges=edge_key if edge_key in frozenset({'l', 'r', 't', 'b'}) else 'x')[1], self._apply_crop_lock_aspect(left, top, right, bottom, fixed_edges=edge_key if edge_key in frozenset({'l', 'r', 't', 'b'}) else 'x')[2], self._apply_crop_lock_aspect(left, top, right, bottom, fixed_edges=edge_key if edge_key in frozenset({'l', 'r', 't', 'b'}) else 'x')[3])
        self._commit_crop_norm(left, top, right, bottom)

    def _apply_crop_zoom(self, steps: float) -> None:
        left, top, right, bottom = (self._crop_norm_values()[0], self._crop_norm_values()[1], self._crop_norm_values()[2], self._crop_norm_values()[3])
        width = right - left
        height = bottom - top
        factor = max(0.85, min(1.15, 1.0 - steps * 0.04))
        new_w = max(0.05, min(1.0, width * factor))
        new_h = max(0.05, min(1.0, height * factor))
        ratio = self._crop_aspect_ratio_norm()
        new_h = new_w / ratio
        if self.state.values.get('crop_lock_aspect') and (not self._frame.isNull()) and (new_h > 1.0):
            new_h = 1.0
            new_w = new_h * ratio
        cx = (left + right) / 2
        cy = (top + bottom) / 2
        left = cx - new_w / 2
        right = cx + new_w / 2
        top = cy - new_h / 2
        bottom = cy + new_h / 2
        if left < 0:
            right -= left
            left = 0.0
        if top < 0:
            bottom -= top
            top = 0.0
        if right > 1.0:
            left -= right - 1.0
            right = 1.0
        if bottom > 1.0:
            top -= bottom - 1.0
            bottom = 1.0
        self._commit_crop_norm(left, top, right, bottom)
        if self._pending_video_crop is not None:
            self.videoCropChanged.emit()
            self._pending_video_crop = None
            return None

    def _hit_test_blur(self, point) -> tuple[int, str] | None:
        if not self.state.values.get('blur_zone_enabled'):
            return None
        if self.last_blur_rects:
            selected = int(self.state.values.get('blur_zone_index', 0))
            order = [selected] + [index for index in range(len(self.last_blur_rects)) if index != selected]
            for index in order:
                rect = self.last_blur_rects[index]
                if abs(point.y() - rect.top()) <= 8 and rect.adjusted(-4, -8, 4, 8).contains(point):
                    return (index, 'resize_top')
                if abs(point.y() - rect.bottom()) <= 8 and rect.adjusted(-4, -8, 4, 8).contains(point):
                    return (index, 'resize_bottom')
                if abs(point.x() - rect.left()) <= 8 and rect.adjusted(-8, -4, 8, 4).contains(point):
                    return (index, 'resize_left')
                if abs(point.x() - rect.right()) <= 8 and rect.adjusted(-8, -4, 8, 4).contains(point):
                    return (index, 'resize_right')
                if not rect.isNull() and rect.contains(point):
                    return (index, 'move')
        else:
            return None

    @staticmethod
    def _blur_cursor(mode: str):
        return Qt.CursorShape.SizeVerCursor if mode in frozenset({'resize_top', 'resize_bottom'}) else Qt.CursorShape.SizeHorCursor if mode in frozenset({'resize_left', 'resize_right'}) else Qt.CursorShape.SizeAllCursor

    def _apply_blur_drag(self, pointer_x: float, pointer_y: float) -> None:
        target = self._target_rect()
        zones = ensure_blur_zones(self.state.values)
        index = max(0, min(self._blur_drag_index, len(zones) - 1))
        zone = dict(zones[index])
        height = float(zone['height'])
        width = float(zone.get('width', 1.0))
        x = float(zone.get('x', 0.0))
        y = float(zone['y'])
        if self._blur_drag_mode == 'move':
            left = pointer_x - self._blur_drag_offset_x
            top = pointer_y - self._blur_drag_offset_y
            x = max(0.0, min(1.0 - width, (left - target.left()) / max(1.0, target.width())))
            y = max(0.0, min(1.0 - height, (top - target.top()) / max(1.0, target.height())))
            cx = x + width / 2
            cy = y + height / 2
            cx, snap_v = (self._snap_center_if_enabled(cx)[0], self._snap_center_if_enabled(cx)[1])
            cy, snap_h = (self._snap_center_if_enabled(cy)[0], self._snap_center_if_enabled(cy)[1])
            if snap_v:
                x = max(0.0, min(1.0 - width, cx - width / 2))
            if snap_h:
                y = max(0.0, min(1.0 - height, cy - height / 2))
            self._set_alignment_guides(vertical=snap_v, horizontal=snap_h)
        elif self._blur_drag_mode == 'resize_top':
            self._guide_snap_v = False
            self._guide_snap_h = False
            bottom = y + height
            new_y = max(0.0, min(bottom - 0.05, (pointer_y - target.top()) / max(1.0, target.height())))
            height = max(0.05, min(0.9, bottom - new_y))
            y = bottom - height
        elif self._blur_drag_mode == 'resize_bottom':
            self._guide_snap_v = False
            self._guide_snap_h = False
            new_bottom = max(y + 0.05, min(1.0, (pointer_y - target.top()) / max(1.0, target.height())))
            height = max(0.05, min(0.9, new_bottom - y))
        elif self._blur_drag_mode == 'resize_left':
            self._guide_snap_v = False
            self._guide_snap_h = False
            right = x + width
            new_x = max(0.0, min(right - 0.05, (pointer_x - target.left()) / max(1.0, target.width())))
            width = max(0.05, min(1.0, right - new_x))
            x = right - width
        elif self._blur_drag_mode == 'resize_right':
            self._guide_snap_v = False
            self._guide_snap_h = False
            new_right = max(x + 0.05, min(1.0, (pointer_x - target.left()) / max(1.0, target.width())))
            width = max(0.05, min(1.0, new_right - x))
        zone['x'] = x
        zone['y'] = y
        zone['width'] = width
        zone['height'] = height
        zones[index] = zone
        self.state.values['blur_zones'] = zones
        self.state.values['blur_zone_index'] = index
        sync_controls_from_selected_blur(self.state.values)
        self.update()