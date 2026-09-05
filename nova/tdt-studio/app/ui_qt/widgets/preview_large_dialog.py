from __future__ import annotations
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QKeySequence, QShortcut, QShowEvent
from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QSizePolicy, QVBoxLayout, QWidget

class LargePreviewDialog(QDialog):
    __doc__ = 'Xem khung xuất phóng lớn kiểu CapCut — cùng canvas + thanh Phát/kéo thời lượng.'

    def __init__(self, host_panel: QWidget, canvas: QWidget, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('largePreviewDialog')
        self.setWindowTitle('Xem khung lớn — như video đã xuất')
        self.setModal(False)
        self.setWindowFlag(Qt.WindowType.Window, True)
        self.resize(720, 1100)
        self.setStyleSheet('#largePreviewDialog { background: #080B10; }#largePreviewDialog QLabel#sectionTitle { color: #EAF0FA; }#largePreviewDialog QLabel#mutedLabel { color: #9EB0C7; }#largePreviewDialog QWidget#previewTransportBar { background: #101722; border: 1px solid #243044; border-radius: 8px; }')
        self._host_panel = host_panel
        self._canvas = canvas
        self._preview_host = getattr(host_panel, 'preview_host', None)
        self._transport = getattr(host_panel, 'transport_bar', None)
        self._transport_home_layout = None
        self._transport_home_index = -1
        self._transport_home_height = 30
        root = QVBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(8)
        bar = QHBoxLayout()
        title = QLabel('Khung xuất phóng lớn · kéo chữ/phụ đề · Phát / kéo thanh thời lượng bên dưới')
        title.setObjectName('sectionTitle')
        bar.addWidget(title, 1)
        close_btn = QPushButton('Đóng (Esc)')
        close_btn.setObjectName('primaryButton')
        close_btn.clicked.connect(self.close)
        bar.addWidget(close_btn)
        root.addLayout(bar)
        canvas.setParent(None)
        canvas.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        canvas.setMinimumSize(320, 480)
        canvas.show()
        root.addWidget(canvas, 1)
        if self._transport is not None:
            home = self._transport.parentWidget()
            layout = home.layout()
            if home is not None and layout is not None:
                self._transport_home_layout = layout
                self._transport_home_index = layout.indexOf(self._transport)
            self._transport_home_height = int(self._transport.height() or 30)
            self._transport.setParent(None)
            self._transport.setFixedHeight(36)
            self._transport.show()
            root.addWidget(self._transport, 0)
        tip = QLabel('Space = Phát/Dừng · Home = về đầu · End = tới cuối · kéo thanh thời lượng để tua · Esc = đóng.')
        tip.setObjectName('mutedLabel')
        tip.setWordWrap(True)
        root.addWidget(tip)
        QShortcut(QKeySequence(Qt.Key.Key_Escape), self, activated=self.close)
        QShortcut(QKeySequence(Qt.Key.Key_Space), self, activated=self._toggle_play)
        QShortcut(QKeySequence(Qt.Key.Key_Home), self, activated=self._seek_start)
        QShortcut(QKeySequence(Qt.Key.Key_End), self, activated=self._seek_end)
        QShortcut(QKeySequence(Qt.Key.Key_Left), self, activated=lambda: self._nudge(-1000))
        QShortcut(QKeySequence(Qt.Key.Key_Right), self, activated=lambda: self._nudge(1000))

    def _toggle_play(self) -> None:
        toggle = getattr(self._host_panel, '_toggle_playback', None)
        if callable(toggle):
            toggle()
            return None

    def _seek_start(self) -> None:
        seek = getattr(self._host_panel, '_seek_to', None)
        if callable(seek):
            seek(0)
            return None

    def _seek_end(self) -> None:
        seek = getattr(self._host_panel, '_seek_to', None)
        duration = int(getattr(self._host_panel, '_duration_ms', 0) or 0)
        position = getattr(self._host_panel, 'position', None)
        if duration <= 0 and position is not None:
            duration = int(position.maximum())
        if callable(seek):
            seek(max(0, duration))
            return None

    def _nudge(self, delta_ms: int) -> None:
        seek = getattr(self._host_panel, '_seek_to', None)
        position = getattr(self._host_panel, 'position', None)
        if not callable(seek) or position is None:
            return None
        target = max(0, min(int(position.maximum()), int(position.value()) + int(delta_ms)))
        seek(target)

    def showEvent(self, event: QShowEvent) -> None:
        super().showEvent(event)
        self._ensure_canvas_visible()

    def _ensure_canvas_visible(self) -> None:
        canvas = self._canvas
        if canvas is None:
            return None
        canvas.setVisible(True)
        canvas.show()
        canvas.raise_()
        if self._transport is not None:
            self._transport.setVisible(True)
            self._transport.show()
        self.layout().activate()
        canvas.updateGeometry()
        reset_zoom = getattr(canvas, 'reset_preview_view_zoom', None)
        if callable(reset_zoom):
            reset_zoom()
        clear_anchors = getattr(canvas, '_clear_interact_anchors', None)
        if callable(clear_anchors):
            clear_anchors(keep_subtitle_live=True)
        clear = getattr(canvas, '_clear_text_layout_caches', None)
        if callable(clear):
            clear(keep_subtitle_live=True)
        canvas.update()
        QTimer.singleShot(0, self._refresh_canvas_after_layout)

    def _refresh_canvas_after_layout(self) -> None:
        canvas = self._canvas
        if canvas is None:
            return None
        clear_anchors = getattr(canvas, '_clear_interact_anchors', None)
        if callable(clear_anchors):
            clear_anchors(keep_subtitle_live=True)
        clear = getattr(canvas, '_clear_text_layout_caches', None)
        if callable(clear):
            clear(keep_subtitle_live=True)
        canvas.updateGeometry()
        canvas.update()

    def closeEvent(self, event) -> None:
        self._restore_canvas()
        super().closeEvent(event)

    def _restore_transport(self) -> None:
        transport = self._transport
        layout = self._transport_home_layout
        if transport is None or layout is None:
            return None
        transport.setFixedHeight(self._transport_home_height or 30)
        idx = self._transport_home_index
        if idx >= 0:
            layout.insertWidget(idx, transport)
        else:
            layout.addWidget(transport)
        transport.show()

    def _restore_canvas(self) -> None:
        self._restore_transport()
        if self._canvas is None or self._preview_host is None:
            return None
        stack = getattr(self._host_panel, 'preview_stack', None)
        if stack is not None:
            if stack.indexOf(self._canvas) < 0:
                stack.addWidget(self._canvas)
            stack.setCurrentWidget(self._canvas)
        else:
            layout = self._preview_host.layout()
            if self._canvas.parentWidget() is not self._preview_host and layout is not None:
                layout.addWidget(self._canvas, 1)
        self._canvas.setMinimumSize(360, 245)
        self._canvas.show()
        show_canvas = getattr(self._host_panel, '_show_frame_canvas', None)
        if callable(show_canvas):
            show_canvas()
            return None
        reset_zoom = getattr(self._canvas, 'reset_preview_view_zoom', None)
        if callable(reset_zoom):
            reset_zoom()
        clear_anchors = getattr(self._canvas, '_clear_interact_anchors', None)
        if callable(clear_anchors):
            clear_anchors(keep_subtitle_live=True)
        self._canvas._clear_text_layout_caches(keep_subtitle_live=True)
        self._canvas.update()