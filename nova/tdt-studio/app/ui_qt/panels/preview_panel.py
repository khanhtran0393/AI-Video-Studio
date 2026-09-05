from __future__ import annotations
import os
import time
from pathlib import Path
from PySide6.QtCore import QRectF, QSize, Qt, QTimer, Signal
from PySide6.QtGui import QAction, QColor, QLinearGradient, QPainter, QPen, QResizeEvent
from PySide6.QtWidgets import QComboBox, QFrame, QHBoxLayout, QLabel, QMenu, QPushButton, QSlider, QSizePolicy, QStackedWidget, QToolButton, QVBoxLayout, QWidget
from ui_qt.playback import QtPlaybackController
from ui_qt.state import Asset, ProjectState
from ui_qt.widgets.preview_frame import PreviewFrameWidget
from ui_qt.widgets.preview_large_dialog import LargePreviewDialog
from ui_qt.widgets.timeline_tool_icons import icon_skip_backward, icon_skip_forward, make_timeline_tool_button
KIND_TEXT = {'video': 'Video', 'audio': 'Âm thanh', 'subtitle': 'Phụ đề', 'image': 'Hình ảnh'}

class PreviewCanvas(QWidget):

    def __init__(self, asset: Asset | None, parent: QWidget | None=None):
        super().__init__(parent)
        self.asset = asset
        self.setMinimumSize(120, 48)

    def set_asset(self, asset: Asset | None) -> None:
        self.asset = asset
        self.update()

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.fillRect(self.rect(), QColor('#080B10'))
        available = self.rect().adjusted(20, 14, -20, -14)
        width = min(available.width(), int(available.height() * 16 / 9))
        height = int(width * 9 / 16)
        if height > available.height():
            height = available.height()
            width = int(height * 16 / 9)
        frame = QRectF(available.center().x() - width / 2, available.center().y() - height / 2, width, height)
        gradient = QLinearGradient(frame.topLeft(), frame.bottomRight())
        gradient.setColorAt(0, QColor('#17243A'))
        gradient.setColorAt(0.55, QColor('#101824'))
        gradient.setColorAt(1, QColor('#251A35'))
        painter.setBrush(gradient)
        painter.setPen(QPen(QColor('#33435C'), 1))
        painter.drawRoundedRect(frame, 8, 8)
        painter.setPen(QColor('#5D78A0'))
        painter.drawLine(frame.left() + 24, frame.center().y(), frame.right() - 24, frame.center().y())
        painter.drawLine(frame.center().x(), frame.top() + 20, frame.center().x(), frame.bottom() - 20)
        painter.setPen(QColor('#EAF0FA'))
        font = painter.font()
        font.setPointSize(16)
        font.setBold(True)
        painter.setFont(font)
        name = self.asset.name if self.asset is not None else 'Chưa chọn video'
        painter.drawText(frame, Qt.AlignmentFlag.AlignCenter, name)
        painter.setPen(QColor('#91A1B8'))
        font.setPointSize(10)
        font.setBold(False)
        painter.setFont(font)
        detail_rect = frame.adjusted(0, 42, 0, 0)
        hint = 'Bấm Thêm tệp để bắt đầu' if self.asset is None else 'Đang chọn phụ đề · preview vẫn theo video chính' if self.asset.kind == 'subtitle' else f'Đang chọn {self.asset.kind} · chọn video để xem phát' if self.asset.kind != 'video' else 'Video chưa có đường dẫn hợp lệ'
        painter.drawText(detail_rect, Qt.AlignmentFlag.AlignCenter, hint)

class PreviewPanel(QFrame):
    previewPositionScrubbed = Signal(int)
    previewScrubFinished = Signal(int)
    presetApplyRequested = Signal(str)
    openPresetLibraryRequested = Signal()

    def __init__(self, state: ProjectState, parent: QWidget | None=None, playback=None):
        super().__init__(parent)
        self.setObjectName('previewPanel')
        self.state = state
        self.selection_kind = state.selected_kind
        self.playback = playback or QtPlaybackController(self)
        self._duration_ms = 0
        self._playback_mode = 'qt'
        self._large_preview = None
        self._preset_items = []
        self._applied_preset_id = ''
        self._pinned_preset_id = ''
        self.setMinimumWidth(240)
        self.setMinimumHeight(72)
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 8, 8, 4)
        root.setSpacing(4)
        heading = QHBoxLayout()
        heading.setSpacing(6)
        heading.setContentsMargins(0, 0, 0, 0)
        selected = state.selected_asset
        selected_name = selected.name if selected is not None else 'Chưa có media'
        self.selection_label = QLabel(selected_name)
        self.selection_label.setObjectName('mutedLabel')
        self.selection_label.setMinimumWidth(60)
        self.selection_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        heading.addWidget(self.selection_label, 1)
        preset_label = QLabel('Cấu hình')
        preset_label.setObjectName('previewPresetEyebrow')
        heading.addWidget(preset_label, 0)
        self.preset_name_button = QToolButton()
        self.preset_name_button.setObjectName('previewPresetNameButton')
        self.preset_name_button.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextOnly)
        self.preset_name_button.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        self.preset_name_button.setMaximumWidth(200)
        self.preset_name_button.setToolTip('Cấu hình đang áp cho video này — bấm để đổi nhanh')
        self._preset_menu = QMenu(self.preset_name_button)
        self.preset_name_button.setMenu(self._preset_menu)
        heading.addWidget(self.preset_name_button, 0)
        self.preset_pin_badge = QLabel('Ghim')
        self.preset_pin_badge.setObjectName('previewPresetPinBadge')
        self.preset_pin_badge.setVisible(False)
        heading.addWidget(self.preset_pin_badge, 0)
        self.large_preview_btn = QPushButton('⛶')
        self.large_preview_btn.setObjectName('compactButton')
        self.large_preview_btn.setFixedSize(28, 24)
        self.large_preview_btn.setToolTip('Khung lớn — xem/phát như đã xuất (có thanh thời lượng, đầu/cuối)')
        self.large_preview_btn.clicked.connect(self.open_large_preview)
        heading.addWidget(self.large_preview_btn)
        self.kind_label = QLabel(KIND_TEXT.get(state.selected_kind, ''))
        self.kind_label.setObjectName('mutedLabel')
        heading.addWidget(self.kind_label)
        root.addLayout(heading)
        self.set_applied_preset('', '')
        self.canvas = PreviewCanvas(state.selected_asset)
        self.frame_canvas = PreviewFrameWidget(state)
        self.frame_canvas.setMinimumSize(120, 40)
        self.frame_canvas.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.canvas.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.playback.attach(self.frame_canvas)
        self.preview_host = QWidget()
        self.preview_host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Ignored)
        self.preview_host.setMinimumHeight(40)
        host_layout = QVBoxLayout(self.preview_host)
        host_layout.setContentsMargins(0, 0, 0, 0)
        host_layout.setSpacing(0)
        self.preview_stack = QStackedWidget()
        self.preview_stack.setMinimumHeight(40)
        self.preview_stack.addWidget(self.canvas)
        self.preview_stack.addWidget(self.frame_canvas)
        host_layout.addWidget(self.preview_stack, 1)
        self._show_placeholder()
        root.addWidget(self.preview_host, 1)
        self.position = QSlider(Qt.Orientation.Horizontal)
        self.position.setObjectName('previewTransportSlider')
        self.position.setRange(0, 0)
        self.position.setValue(0)
        self.position.setEnabled(False)
        self.position.setFixedHeight(22)
        self.position.valueChanged.connect(self._on_position_value_while_scrub)
        self.position.sliderReleased.connect(self._seek_from_slider)
        self.transport_bar = QWidget()
        self.transport_bar.setObjectName('previewTransportBar')
        self.transport_bar.setFixedHeight(30)
        transport = QHBoxLayout(self.transport_bar)
        transport.setContentsMargins(2, 0, 2, 0)
        transport.setSpacing(4)
        self.skip_start_button = make_timeline_tool_button(icon_skip_backward(), 'Về đầu clip', parent=self.transport_bar)
        self.skip_start_button.clicked.connect(lambda: self._seek_to(0))
        transport.addWidget(self.skip_start_button)
        self.play_button = QPushButton('Phát')
        self.play_button.setObjectName('previewPlayButton')
        self.play_button.setEnabled(False)
        self.play_button.setFixedSize(52, 26)
        self.play_button.clicked.connect(self._toggle_playback)
        transport.addWidget(self.play_button)
        self.skip_end_button = make_timeline_tool_button(icon_skip_forward(), 'Tới cuối clip', parent=self.transport_bar)
        self.skip_end_button.clicked.connect(lambda: self._seek_to(self.position.maximum()))
        transport.addWidget(self.skip_end_button)
        transport.addWidget(self.position, 1)
        self.time_label = QLabel('00:00.000 / 00:00.000')
        self.time_label.setObjectName('previewTimeLabel')
        self.time_label.setMinimumWidth(148)
        self.time_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        transport.addWidget(self.time_label)
        self.aspect_combo = QComboBox()
        self.aspect_combo.setObjectName('previewAspectCombo')
        self.aspect_combo.setToolTip('Tỷ lệ khung xem trước / xuất (như CapCut)')
        self.aspect_combo.setFixedWidth(88)
        for label, value in (('9:16', '9:16'), ('16:9', '16:9'), ('1:1', '1:1'), ('4:5', '4:5'), ('3:4', '3:4'), ('2:3', '2:3'), ('21:9', '21:9')):
            self.aspect_combo.addItem(label, value)
        current_aspect = str(state.values.get('aspect_ratio', '9:16') or '9:16')
        idx = self.aspect_combo.findData(current_aspect)
        self.aspect_combo.setCurrentIndex(max(0, idx))
        self.aspect_combo.currentIndexChanged.connect(self._on_preview_aspect_changed)
        transport.addWidget(self.aspect_combo)
        self.playback_status = QLabel('')
        self.playback_status.setObjectName('mutedLabel')
        self.playback_status.setVisible(False)
        root.addWidget(self.transport_bar)
        self.playback.positionChanged.connect(self._on_position_changed)
        self.playback.durationChanged.connect(self._on_duration_changed)
        self.playback.playingChanged.connect(self._toggle_playback_text)
        self.playback.playingChanged.connect(self._on_playback_active_changed)
        self.playback.errorOccurred.connect(self._show_playback_error)
        self._timeline_scrub_active = False
        self._scrub_pending_ms = 0
        self._scrub_commit_timer = QTimer(self)
        self._scrub_commit_timer.setSingleShot(True)
        self._scrub_commit_timer.setInterval(120)
        self._scrub_commit_timer.timeout.connect(self._commit_scrub_seek)
        frame_ready = getattr(self.playback, 'frameReady', None)
        if frame_ready is not None:
            frame_ready.connect(self._show_frame)
        display_size = getattr(self.frame_canvas, 'displaySizeChanged', None)
        if display_size is not None:
            display_size.connect(self._sync_playback_decode_size)
        mode_changed = getattr(self.playback, 'modeChanged', None)
        if mode_changed is not None:
            mode_changed.connect(self._on_mode_changed)
        self.playback.set_volume(int(state.values.get('audio_volume', 100)))

    def minimumSizeHint(self) -> QSize:
        return QSize(240, 72)

    def sizeHint(self) -> QSize:
        return QSize(640, 360)

    def set_preset_choices(self, items: list[tuple[str, str]], *, pinned_id: str) -> None:
        self._preset_items = [(str(pid), str(name)) for pid, name in items]
        self._pinned_preset_id = str(pinned_id or '').strip()
        self._rebuild_preset_menu()
        self._refresh_preset_bar_chrome()

    def set_applied_preset(self, preset_id: str, preset_name: str='') -> None:
        self._applied_preset_id = str(preset_id or '').strip()
        name = str(preset_name or '').strip()
        if self._applied_preset_id and (not name):
            for pid, pname in self._preset_items:
                if pid == self._applied_preset_id:
                    name = pname
        if self._applied_preset_id:
            self.preset_name_button.setText(f'{name or self._applied_preset_id}  ▾')
        else:
            self.preset_name_button.setText('Chưa áp cấu hình  ▾')
        self._refresh_preset_bar_chrome()
        self._rebuild_preset_menu()

    def _refresh_preset_bar_chrome(self) -> None:
        pinned = bool(self._applied_preset_id and self._pinned_preset_id and (self._applied_preset_id == self._pinned_preset_id))
        self.preset_pin_badge.setVisible(pinned)

    def _rebuild_preset_menu(self) -> None:
        menu = self._preset_menu
        menu.clear()
        if self._preset_items:
            for preset_id, name in self._preset_items:
                label = name
                if preset_id == self._pinned_preset_id:
                    label = f'{name}  · Ghim'
                action = QAction(label, menu)
                action.setCheckable(True)
                action.setChecked(preset_id == self._applied_preset_id)
                action.triggered.connect(lambda _checked, pid: self.presetApplyRequested.emit(pid))
                menu.addAction(action)
        else:
            empty = QAction('Chưa có cấu hình — mở trang Cấu hình để lưu', menu)
            empty.setEnabled(False)
            menu.addAction(empty)
        menu.addSeparator()
        open_lib = QAction('Mở trang Cấu hình…', menu)
        open_lib.triggered.connect(self.openPresetLibraryRequested.emit)
        menu.addAction(open_lib)

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        if self.preview_stack.currentWidget() is not self.frame_canvas:
            return None
        timer = getattr(self, '_resize_sync_timer', None)
        if timer is None:
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.setInterval(90)
            timer.timeout.connect(self._flush_resize_sync)
            self._resize_sync_timer = timer
        timer.start()

    def _flush_resize_sync(self) -> None:
        if self.preview_stack.currentWidget() is self.frame_canvas:
            self.sync_canvas_geometry()
            self._sync_playback_decode_size()
            return None

    def _show_placeholder(self) -> None:
        self.preview_stack.setCurrentWidget(self.canvas)

    def _show_frame_canvas(self) -> None:
        self.preview_stack.setCurrentWidget(self.frame_canvas)
        self.frame_canvas.setVisible(True)
        self.frame_canvas.updateGeometry()
        self.preview_host.updateGeometry()
        self.frame_canvas.reset_preview_view_zoom()
        self.frame_canvas._clear_interact_anchors(keep_subtitle_live=True)
        self.frame_canvas._clear_text_layout_caches(keep_subtitle_live=True)
        self.frame_canvas.update()

    def reload_project(self, state: ProjectState) -> None:
        self.state = state
        self.canvas.set_asset(state.selected_asset)
        self.frame_canvas.state = state
        self.frame_canvas.refresh_settings()
        self.set_selected_asset(state.selected_asset)

    def set_selected_asset(self, asset: Asset | None) -> None:
        if asset is None:
            self.playback.stop()
            self.selection_kind = None
            self.selection_label.setText('Chưa có media')
            self.kind_label.setText('')
            self.canvas.set_asset(None)
            self._show_placeholder()
            self.frame_canvas.clear_frame()
            self.playback_status.clear()
            self._on_duration_changed(0)
            self.play_button.setEnabled(False)
            return None
        self.selection_kind = asset.kind
        self.selection_label.setText(asset.name)
        self.kind_label.setText(KIND_TEXT.get(asset.kind, ''))
        self.canvas.set_asset(asset)
        is_real_video = asset.kind == 'video' and bool(asset.path)
        preview_video = asset if is_real_video else self._primary_video()
        if preview_video is not None and preview_video.path:
            self._on_duration_changed(preview_video.duration_ms)
            self.play_button.setEnabled(True)
            self.position.setEnabled(True)
            self._show_frame_canvas()
            current = str(getattr(self.playback, '_source_path', '') or '').replace('\\', '/')
            target = str(preview_video.path or '').replace('\\', '/')
            if current.casefold() != target.casefold():
                self.frame_canvas.clear_frame()
                self.playback_status.setText('Đang nạp video…')
                self.play_button.setToolTip('Đang nạp video…')
                self.playback.load(preview_video.path, preview_video.video_codec)
            elif asset.kind != 'video':
                self.playback_status.setText('Preview theo video chính')
                self.play_button.setToolTip('Preview theo video chính')
            return None
        self.playback.stop()
        self._on_duration_changed(asset.duration_ms)
        self.play_button.setEnabled(False)
        self.position.setEnabled(False)
        self._show_placeholder()
        self.playback_status.clear()

    def _primary_video(self) -> Asset | None:
        videos = [asset for asset in self.state.assets if asset.kind == 'video' and asset.path]
        if videos:
            selected = self.state.selected_asset
            if selected is not None and selected.kind == 'video' and selected.path:
                return selected
            current_id = self.state.selected_id
            matched = next((asset for asset in videos if asset.id == current_id), None)
            return matched or videos[0]

    def _toggle_playback(self) -> None:
        if bool(getattr(self.playback, 'is_playing', False)):
            self.playback.pause()
        else:
            try:
                self.frame_canvas.clear_selected_subtitle()
                target = max(0, int(self.position.value()))
                duration = max(0, int(getattr(self, '_duration_ms', 0) or 0))
                if duration > 0 and target >= max(0, duration - 150):
                    target = 0
                self.frame_canvas.set_position(target)
                self.playback.seek(target)
                self._apply_mix_audio_to_playback()
                self._sync_playback_decode_size()
                self.playback.play()
            except Exception as exc:
                from core.av_sync import log_avsync_diagnostic
                log_avsync_diagnostic(f"[PreviewAudio] LỖI _toggle_playback: {f'{exc!r}'}")
                self._show_playback_error(f'Không phát được: {exc}')

    def _on_playback_active_changed(self, playing: bool) -> None:
        self.frame_canvas.set_playback_active(bool(playing))

    def _toggle_playback_text(self, playing: bool) -> None:
        self.play_button.setText('Dừng' if playing else 'Phát')
        if playing:
            text = 'Đang phát'
            if self._playback_mode == 'compatibility':
                text += ' · AV1'
            if self._voice_mix_active():
                text += ' · TTS'
            self.play_button.setToolTip(text)
            return None
        if self.frame_canvas.has_frame:
            self.play_button.setToolTip('Tạm dừng')
            return None
        self.play_button.setToolTip('Phát')

    def _on_position_changed(self, position_ms: int) -> None:
        if self._timeline_scrub_active or self.position.isSliderDown():
            return None
        playing = bool(getattr(self.playback, 'is_playing', False))
        if playing:
            self.frame_canvas.set_position(position_ms, repaint=False)
            if self.position.isSliderDown():
                self.time_label.setText(f'{_format_ms(position_ms)} / {_format_ms(self._duration_ms)}')
                return None
            now = time.monotonic()
            last = float(getattr(self, '_ui_pos_flush_at', 0.0) or 0.0)
            gap = 0.2
            if now - last < gap:
                self._ui_pos_pending = int(position_ms)
                if not getattr(self, '_ui_pos_pending_armed', False):
                    self._ui_pos_pending_armed = True
                    QTimer.singleShot(int(gap * 1000), self._flush_ui_position)
                return None
            self._ui_pos_flush_at = now
            self.position.blockSignals(True)
            try:
                self.position.setValue(max(0, int(position_ms)))
            finally:
                self.position.blockSignals(False)
        else:
            return None

    def _flush_ui_position(self) -> None:
        self._ui_pos_pending_armed = False
        pending = int(getattr(self, '_ui_pos_pending', self.position.value()) or 0)
        self._ui_pos_flush_at = time.monotonic()
        if not self.position.isSliderDown():
            self.position.blockSignals(True)
            try:
                self.position.setValue(max(0, pending))
            finally:
                self.position.blockSignals(False)
        self.time_label.setText(f'{_format_ms(pending)} / {_format_ms(self._duration_ms)}')

    def _on_duration_changed(self, duration_ms: int) -> None:
        reported = max(0, int(duration_ms))
        if self._timeline_scrub_active and self._duration_ms > 0 and (reported > 0) and (abs(reported - self._duration_ms) > 1500):
            return None
        self._duration_ms = max(0, int(duration_ms))
        self.position.setRange(0, self._duration_ms)
        self.time_label.setText(f'{_format_ms(self.position.value())} / {_format_ms(self._duration_ms)}')

    def _seek_while_sliding(self, value: int) -> None:
        if self.position.isSliderDown():
            target = max(0, int(value))
            self._timeline_scrub_active = True
            set_scrubbing = getattr(self.frame_canvas, 'set_scrubbing', None)
            if callable(set_scrubbing):
                set_scrubbing(True)
            self._scrub_pending_ms = target
            self.frame_canvas.set_position(target, repaint=False)
            self.time_label.setText(f'{_format_ms(target)} / {_format_ms(self._duration_ms)}')
            now = time.monotonic()
            last = float(getattr(self, '_slider_scrub_emit_at', 0.0) or 0.0)
            if now - last >= 0.12:
                self._slider_scrub_emit_at = now
                self.previewPositionScrubbed.emit(target)
                seek_scrub = getattr(self.playback, 'seek_scrub', None)
                if callable(seek_scrub):
                    seek_scrub(target)
                else:
                    try:
                        self.playback.seek(target, sync_mix=False)
                    except TypeError:
                        self.playback.seek(target)
            else:
                self._scrub_commit_timer.start()

    def _on_position_value_while_scrub(self, value: int) -> None:
        if self.position.isSliderDown():
            self._seek_while_sliding(value)
            return None

    def _seek_from_slider(self) -> None:
        target = max(0, int(self.position.value()))
        self._timeline_scrub_active = True
        self._scrub_pending_ms = target
        self.frame_canvas.set_position(target)
        self.time_label.setText(f'{_format_ms(target)} / {_format_ms(self._duration_ms)}')
        seek = getattr(self.playback, 'seek', None)
        if callable(seek):
            try:
                seek(target, sync_mix=False)
            except TypeError:
                seek(target)
        set_scrubbing = getattr(self.frame_canvas, 'set_scrubbing', None)
        if callable(set_scrubbing):
            set_scrubbing(False)
        self.previewScrubFinished.emit(target)
        QTimer.singleShot(500, self._end_timeline_scrub_lock)

    def seek_to(self, position_ms: int, *, sync_mix: bool) -> None:
        playing = bool(getattr(self.playback, 'is_playing', False))
        if playing:
            self._timeline_scrub_active = False
            self._scrub_commit_timer.stop()
            self._scrub_pending_ms = max(0, int(position_ms))
            self._seek_to(position_ms, sync_mix=sync_mix)
        else:
            self._timeline_scrub_active = True
            self._scrub_pending_ms = max(0, int(position_ms))
            self._seek_to(position_ms, sync_mix=sync_mix)
            QTimer.singleShot(600, self._end_timeline_scrub_lock)
            return None

    def scrub_to(self, position_ms: int) -> None:
        self._timeline_scrub_active = True
        set_scrubbing = getattr(self.frame_canvas, 'set_scrubbing', None)
        if callable(set_scrubbing):
            set_scrubbing(True)
        target = max(0, int(position_ms))
        self._scrub_pending_ms = target
        if self.position.value() != target:
            self.position.blockSignals(True)
            self.position.setValue(target)
            self.position.blockSignals(False)
        self.frame_canvas.set_position(target, repaint=False)
        self.time_label.setText(f'{_format_ms(target)} / {_format_ms(self._duration_ms)}')
        now = time.monotonic()
        last = float(getattr(self, '_slider_scrub_emit_at', 0.0) or 0.0)
        if now - last >= 0.12:
            self._slider_scrub_emit_at = now
            seek_scrub = getattr(self.playback, 'seek_scrub', None)
            if callable(seek_scrub):
                seek_scrub(target)
            else:
                try:
                    self.playback.seek(target, sync_mix=False)
                except TypeError:
                    self.playback.seek(target)
        else:
            self._scrub_commit_timer.start()

    def finish_scrub(self, position_ms: int | None=None) -> None:
        target = max(0, int(position_ms if position_ms is not None else self._scrub_pending_ms))
        self._scrub_pending_ms = target
        self._scrub_commit_timer.stop()
        self._timeline_scrub_active = True
        if self.position.value() != target:
            self.position.blockSignals(True)
            self.position.setValue(target)
            self.position.blockSignals(False)
        self.frame_canvas.set_position(target)
        self.time_label.setText(f'{_format_ms(target)} / {_format_ms(self._duration_ms)}')
        seek = getattr(self.playback, 'seek', None)
        if callable(seek):
            try:
                seek(target, sync_mix=False)
            except TypeError:
                seek(target)
        set_scrubbing = getattr(self.frame_canvas, 'set_scrubbing', None)
        if callable(set_scrubbing):
            set_scrubbing(False)
        QTimer.singleShot(600, self._end_timeline_scrub_lock)

    def _end_timeline_scrub_lock(self) -> None:
        self._timeline_scrub_active = False

    def _commit_scrub_seek(self) -> None:
        target = int(self._scrub_pending_ms)
        seek_scrub = getattr(self.playback, 'seek_scrub', None)
        if callable(seek_scrub):
            seek_scrub(target)
        else:
            try:
                self.playback.seek(target, sync_mix=False)
            except TypeError:
                self.playback.seek(target)
        if self.position.isSliderDown():
            self.previewPositionScrubbed.emit(target)

    def _seek_to(self, position_ms: int, *, sync_mix: bool) -> None:
        target = max(0, int(position_ms))
        self._scrub_pending_ms = target
        self.position.setValue(target)
        self.frame_canvas.set_position(target)
        self.time_label.setText(f'{_format_ms(target)} / {_format_ms(self._duration_ms)}')
        seek = getattr(self.playback, 'seek', None)
        if callable(seek):
            try:
                seek(target, sync_mix=sync_mix)
            except TypeError:
                seek(target)

    def preview_subtitle_at(self, position_ms: int, text: str='', end_ms: int=0) -> None:
        target = max(0, int(position_ms))
        self.position.setValue(target)
        if text:
            self.frame_canvas.set_selected_subtitle(text, target, max(target + 1, int(end_ms)))
        self.frame_canvas.set_position(target)
        seek = getattr(self.playback, 'seek', None)
        if callable(seek):
            seek(target)
        self.playback_status.setText('Đang xem câu phụ đề đã chọn')

    def _show_playback_error(self, message: str) -> None:
        detail = message or 'định dạng chưa được hỗ trợ'
        self.selection_label.setText('Lỗi phát video')
        self.playback_status.setText(f'Không thể phát video: {detail}')
        self.play_button.setText('Phát')
        self.play_button.setToolTip(self.playback_status.text())

    def _sync_playback_decode_size(self, _width: int=0) -> None:
        setter = getattr(self.playback, 'set_preview_decode_width', None)
        if callable(setter):
            canvas = self.frame_canvas
            getter = getattr(canvas, 'display_video_pixel_width', None)
            width = int(getter()) if callable(getter) else 0
            if width <= 1:
                return None
            setter(width)
        else:
            return None

    def _show_frame(self, image) -> None:
        first_or_hidden = self.preview_stack.currentWidget() is not self.frame_canvas or not self.frame_canvas.has_frame
        self.frame_canvas.set_frame(image)
        if first_or_hidden:
            self._show_frame_canvas()
        if self._playback_mode == 'compatibility':
            self.playback_status.setText('Chế độ tương thích AV1')
            self.play_button.setToolTip('Chế độ tương thích AV1')
            return None
        if self.playback_status.text() in frozenset({'', 'Đang nạp video…'}):
            self.playback_status.setText('Đã nạp video')
            self.play_button.setToolTip('Phát')
            return None

    def _on_mode_changed(self, mode: str) -> None:
        self._playback_mode = mode
        if mode == 'compatibility':
            self.playback_status.setText('Chế độ tương thích AV1')
            self.play_button.setToolTip('Chế độ tương thích AV1')
            return None

    def sync_canvas_geometry(self) -> None:
        self.preview_host.updateGeometry()
        self.preview_stack.updateGeometry()
        self.frame_canvas.updateGeometry()
        if self.preview_stack.currentWidget() is self.frame_canvas:
            self.frame_canvas._clear_interact_anchors()
            self.frame_canvas._clear_text_layout_caches()
            self.frame_canvas.update()
            return None

    def refresh_settings(self) -> None:
        self.frame_canvas.refresh_settings()
        set_speed = getattr(self.playback, 'set_speed', None)
        if callable(set_speed):
            set_speed(float(self.state.values.get('speed', 1.0)))
        self._apply_mix_audio_to_playback()
        if hasattr(self, 'aspect_combo'):
            current = str(self.state.values.get('aspect_ratio', '9:16') or '9:16')
            idx = self.aspect_combo.findData(current)
            if idx >= 0:
                if self.aspect_combo.currentIndex() != idx:
                    self.aspect_combo.blockSignals(True)
                    self.aspect_combo.setCurrentIndex(idx)
                    self.aspect_combo.blockSignals(False)
            return None

    def _on_preview_aspect_changed(self, _index: int=0) -> None:
        value = str(self.aspect_combo.currentData() or '9:16')
        self.state.values['aspect_ratio'] = value
        self.frame_canvas.refresh_settings()

    def refresh_clip_transform_only(self) -> None:
        canvas = self.frame_canvas
        refresh = getattr(canvas, 'refresh_transform_only', None)
        if callable(refresh):
            refresh()
            return None
        canvas.update()

    def open_large_preview(self) -> None:
        if self._large_preview is not None and self._large_preview.isVisible():
            self._large_preview.raise_()
            self._large_preview.activateWindow()
            ensure = getattr(self._large_preview, '_ensure_canvas_visible', None)
            if callable(ensure):
                ensure()
            return None
        if self.frame_canvas.has_frame:
            if not self.frame_canvas.isVisible():
                self._show_frame_canvas()
            dialog = LargePreviewDialog(self, self.frame_canvas, parent=self.window())
            self._large_preview = dialog
            self.large_preview_btn.setText('Đang xem…')
            self.large_preview_btn.setEnabled(False)
            dialog.finished.connect(self._on_large_preview_closed)
            dialog.showMaximized()
            dialog._ensure_canvas_visible()
            dialog.raise_()
            dialog.activateWindow()
        else:
            self.playback_status.setText('Hãy chọn/nạp video trước khi xem khung lớn')
            return None

    def _on_large_preview_closed(self, *_args) -> None:
        self._large_preview = None
        self.large_preview_btn.setText('⛶')
        self.large_preview_btn.setEnabled(True)
        if self.frame_canvas.parentWidget() is not self.preview_stack and self.preview_stack.indexOf(self.frame_canvas) < 0:
            self.preview_stack.addWidget(self.frame_canvas)
        self.preview_stack.setCurrentWidget(self.frame_canvas)
        self.frame_canvas.setMinimumSize(120, 40)
        self.frame_canvas.reset_preview_view_zoom()
        self.frame_canvas._clear_interact_anchors(keep_subtitle_live=True)
        self._show_frame_canvas()

    def _voice_mix_active(self) -> bool:
        values = self.state.values
        path = str(values.get('voice_audio_path', '') or '').strip()
        return bool(values.get('voice_audio_enabled')) and bool(path)

    def _mix_audio_fingerprint(self, values: dict) -> tuple:
        return (bool(values.get('mute_original_audio', False)), int(values.get('audio_volume', 100) or 0), str(values.get('vocal_sep_cache_path', '') or ''), bool(values.get('video_vocal_enabled')), str(values.get('video_vocal_stem_path', '') or ''), int(values.get('video_vocal_volume', 0) or 0), bool(values.get('video_bgm_enabled')), str(values.get('video_instrumental_stem_path', '') or ''), int(values.get('video_bgm_volume', 0) or 0), bool(values.get('voice_audio_enabled', False)), str(values.get('voice_audio_path', '') or ''), int(values.get('voice_audio_volume', 100) or 0), bool(values.get('background_audio_enabled', False)), str(values.get('background_audio_path', '') or ''), int(values.get('background_audio_volume', 35) or 0), str(values.get('tts_fit_mode', 'stretch_video') or ''), int(values.get('voice_audio_duration_ms', 0) or 0), len(getattr(self.state, 'sfx_events', ()) or ()))

    def _apply_mix_audio_to_playback(self) -> None:
        values = self.state.values
        fp = self._mix_audio_fingerprint(values)
        if fp == getattr(self, '_mix_audio_fp', None):
            return None
        self._mix_audio_fp = fp
        configure = getattr(self.playback, 'configure_mix_audio', None)
        if callable(configure):
            voice_path = str(values.get('voice_audio_path', '') or '').strip()
            voice_duration_ms = int(values.get('voice_audio_duration_ms', 0) or 0)
            if voice_path and voice_duration_ms <= 0:
                try:
                    from services_media import probe_audio_duration_ms
                    voice_duration_ms = int(probe_audio_duration_ms(voice_path) or 0)
                except Exception:
                    voice_duration_ms = 0
            if voice_duration_ms > 0:
                values['voice_audio_duration_ms'] = voice_duration_ms
            source_duration_ms = max(0, int(getattr(self, '_duration_ms', 0) or 0))
            selected = getattr(self.state, 'selected_asset', None)
            if source_duration_ms <= 0 and selected is not None:
                source_duration_ms = max(0, int(getattr(selected, 'duration_ms', 0) or 0))
            if source_duration_ms <= 0:
                source_duration_ms = max(0, int(values.get('source_duration_ms', 0) or 0))
            configure(mute_original=bool(values.get('mute_original_audio', False)), original_volume=int(values.get('audio_volume', 100)), original_sep_path=str(values.get('vocal_sep_cache_path', '') or ''), video_vocal_enabled=bool(values.get('video_vocal_enabled')), video_vocal_path=str(values.get('video_vocal_stem_path', '') or ''), video_vocal_volume=int(values.get('video_vocal_volume', 0) or 0), video_bgm_enabled=bool(values.get('video_bgm_enabled')), video_instrumental_path=str(values.get('video_instrumental_stem_path', '') or ''), video_bgm_volume=int(values.get('video_bgm_volume', 0) or 0), voice_enabled=bool(values.get('voice_audio_enabled', False)), voice_path=voice_path, voice_volume=int(values.get('voice_audio_volume', 100)), background_enabled=bool(values.get('background_audio_enabled', False)), background_path=str(values.get('background_audio_path', '') or ''), background_volume=int(values.get('background_audio_volume', 35)), sfx_events=list(self.state.sfx_events), tts_fit_mode=str(values.get('tts_fit_mode', 'stretch_video') or 'stretch_video'), voice_duration_ms=voice_duration_ms, source_duration_ms=source_duration_ms)
            stretch_key = (source_duration_ms, voice_duration_ms, str(values.get('tts_fit_mode', 'stretch_video') or ''))
            if voice_duration_ms > source_duration_ms + 250 and source_duration_ms > 0 and (stretch_key[2].strip().lower() in frozenset({'none', 'stretch_video'})) and (stretch_key != getattr(self, '_avsync_stretch_log_key', None)):
                self._avsync_stretch_log_key = stretch_key
                from core.av_sync import log_avsync_diagnostic
                log_avsync_diagnostic(f'[AVSync] Preview lock stretch: video={source_duration_ms}ms voice={voice_duration_ms}ms mode={stretch_key[2]} — map playhead → giọng/phụ đề (ratio={voice_duration_ms / float(source_duration_ms):.4f})')
            self._log_preview_audio_diagnostic(values)
            return None
        set_volume = getattr(self.playback, 'set_volume', None)
        if callable(set_volume):
            if values.get('mute_original_audio'):
                set_volume(0)
                return None
            set_volume(int(values.get('audio_volume', 100)))
        else:
            return None

    def _log_preview_audio_diagnostic(self, values: dict) -> None:
        from pathlib import Path as _Path
        from core.av_sync import log_avsync_diagnostic

        def _track(label: str, enabled_key: str, path_key: str) -> str:
            enabled = bool(values.get(enabled_key))
            path = str(values.get(path_key, '') or '').strip()
            exists = bool(path) and _Path(path).is_file()
            return f"{label}: bật={enabled} file={('CÓ' if exists else 'THIẾU' if path else 'CHƯA CHỌN')} ({path or '—'})"
        log_avsync_diagnostic('[PreviewAudio] Đồng bộ mix — ' + ' | '.join([_track('Giọng đọc', 'voice_audio_enabled', 'voice_audio_path'), _track('Nhạc gốc(instrumental)', 'video_bgm_enabled', 'video_instrumental_stem_path'), _track('Giọng gốc(vocal)', 'video_vocal_enabled', 'video_vocal_stem_path'), _track('Nhạc thêm', 'background_audio_enabled', 'background_audio_path')]))

def _format_ms(value: int) -> str:
    total = max(0, int(value))
    millis = total % 1000
    total_seconds = total // 1000
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}' if hours else f'{minutes:02d}:{seconds:02d}.{millis:03d}'