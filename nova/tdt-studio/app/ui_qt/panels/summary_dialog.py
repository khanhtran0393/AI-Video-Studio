'Bảng tóm tắt nhanh — 2 cột gọn tối + dây n8n.'
from __future__ import annotations
from typing import Callable
from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFontMetrics, QPalette
from PySide6.QtWidgets import QCheckBox, QDialog, QFrame, QHBoxLayout, QLabel, QPushButton, QScrollArea, QSizePolicy, QToolButton, QVBoxLayout, QWidget
from ui_qt.state import ProjectState
from ui_qt.summary_snapshot import BoardRow, SummaryRow, build_summary_board, build_workflow_nodes
from ui_qt.widgets.summary_flow_strip import N8nFlowStrip
_AUTO_REFRESH_MS = 1600
_BG = QColor('#0B0F17')
_CARD = QColor('#0F1520')

def _force_dark(widget: QWidget, color: QColor=_BG) -> None:
    widget.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    widget.setAutoFillBackground(True)
    pal = widget.palette()
    pal.setColor(QPalette.ColorRole.Window, color)
    pal.setColor(QPalette.ColorRole.Base, color)
    pal.setColor(QPalette.ColorRole.Button, color)
    widget.setPalette(pal)

class _BoardLine(QFrame):
    __doc__ = '1 dòng bảng dày đặc: [switch] nhãn · giá trị [›].'
    toggleRequested = Signal(object)
    navigateRequested = Signal(object)

    def __init__(self, row: BoardRow, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self._row = row
        self.setObjectName('summaryBoardLine')
        self.setProperty('lineOn', bool(row.enabled))
        self.setProperty('lineAlways', bool(row.always_on))
        self.setFixedHeight(26)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(5, 0, 3, 0)
        lay.setSpacing(5)
        self._toggle = QCheckBox()
        self._toggle.setObjectName('summaryBoardToggle')
        self._toggle.setChecked(bool(row.enabled))
        can_toggle = bool(row.togglable)
        self._toggle.setEnabled(can_toggle)
        self._toggle.setVisible(can_toggle or row.always_on)
        self._toggle.setToolTip('Luôn Bật' if row.always_on else 'Bật / Tắt')
        self._toggle.clicked.connect(self._on_toggle)
        lay.addWidget(self._toggle, 0)
        self._label = QLabel(row.label)
        self._label.setObjectName('summaryBoardLabel')
        self._label.setMinimumWidth(84)
        self._label.setMaximumWidth(112)
        lay.addWidget(self._label, 0)
        self._value = QLabel(row.value)
        self._value.setObjectName('summaryBoardValue')
        self._value.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        lay.addWidget(self._value, 1)
        self._nav = QToolButton()
        self._nav.setObjectName('summaryBoardNav')
        self._nav.setText('›')
        self._nav.setFixedSize(20, 20)
        self._nav.setCursor(Qt.CursorShape.PointingHandCursor)
        self._nav.setToolTip('Mở tab chỉnh chi tiết')
        self._nav.clicked.connect(lambda: self.navigateRequested.emit(self._row))
        lay.addWidget(self._nav, 0)
        self.setCursor(Qt.CursorShape.PointingHandCursor if can_toggle else Qt.CursorShape.ArrowCursor)
        self.setToolTip('Bấm = Bật/Tắt · › = chi tiết' if can_toggle else '› = mở chỗ chỉnh')
        self._elide_value()

    def _elide_value(self) -> None:
        metrics = QFontMetrics(self._value.font())
        text = self._row.value or ''
        self._value.setToolTip(text)
        avail = max(48, self.width() - 190)
        self._value.setText(metrics.elidedText(text, Qt.TextElideMode.ElideMiddle, avail))

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._elide_value()

    def update_row(self, row: BoardRow) -> None:
        prev_on = bool(self._row.enabled)
        prev_always = bool(self._row.always_on)
        self._row = row
        if self._label.text() != row.label:
            self._label.setText(row.label)
        self._elide_value()
        can_toggle = bool(row.togglable)
        self._toggle.blockSignals(True)
        self._toggle.setChecked(bool(row.enabled))
        self._toggle.setEnabled(can_toggle)
        self._toggle.setVisible(can_toggle or row.always_on)
        self._toggle.blockSignals(False)
        if prev_on != bool(row.enabled) or prev_always != bool(row.always_on):
            self.setProperty('lineOn', bool(row.enabled))
            self.setProperty('lineAlways', bool(row.always_on))
            style = self.style()
            if style is not None:
                style.unpolish(self)
                style.polish(self)
            return None

    def apply_optimistic(self, enabled: bool) -> None:
        self._toggle.blockSignals(True)
        self._toggle.setChecked(bool(enabled))
        self._toggle.blockSignals(False)
        self.setProperty('lineOn', bool(enabled))
        style = self.style()
        if style is not None:
            style.unpolish(self)
            style.polish(self)
            return None

    def _on_toggle(self, _checked: bool=False) -> None:
        if self._row.togglable:
            self.toggleRequested.emit(self._row)
        else:
            self._toggle.blockSignals(True)
            self._toggle.setChecked(bool(self._row.enabled))
            self._toggle.blockSignals(False)
            return None

    def mousePressEvent(self, event) -> None:
        if event.button() != Qt.MouseButton.LeftButton:
            super().mousePressEvent(event)
            return None
        child = self.childAt(event.position().toPoint())
        if child is self._nav or child is self._toggle:
            super().mousePressEvent(event)
            return None
        if self._row.togglable:
            self.toggleRequested.emit(self._row)
        else:
            self.navigateRequested.emit(self._row)
        event.accept()

class SummaryDialog(QDialog):
    __doc__ = 'Một bảng quản lý toàn cục: quy trình (trái) + cấu hình (phải).'
    rowActivated = Signal(object)
    nodeToggleRequested = Signal(str, bool)
    detailToggleRequested = Signal(str, bool)

    def __init__(self, state: ProjectState, parent: QWidget | None=None, *, live_overrides_provider: Callable[[], dict[str, object]] | None, project_name: str) -> None:
        super().__init__(parent)
        self.state = state
        self._live_overrides_provider = live_overrides_provider
        self._project_name = project_name or 'Dự án'
        self._pipe_widgets = []
        self._extra_widgets = []
        self._fingerprint = None
        self._busy = False
        self.setObjectName('summaryDialog')
        self.setWindowTitle('Tóm tắt nhanh')
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.WindowTitleHint | Qt.WindowType.WindowSystemMenuHint | Qt.WindowType.WindowMinimizeButtonHint | Qt.WindowType.WindowMaximizeButtonHint | Qt.WindowType.WindowCloseButtonHint)
        self.setModal(False)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, False)
        self.setSizeGripEnabled(True)
        self.setMinimumSize(760, 480)
        self.resize(880, 540)
        _force_dark(self, _BG)
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(5)
        head = QHBoxLayout()
        head.setSpacing(8)
        title_col = QVBoxLayout()
        title_col.setSpacing(0)
        title = QLabel('Tóm tắt nhanh')
        title.setObjectName('sectionTitle')
        title_col.addWidget(title)
        self._project_badge = QLabel(self._project_name)
        self._project_badge.setObjectName('summaryProjectBadge')
        title_col.addWidget(self._project_badge)
        head.addLayout(title_col, 1)
        self._count = QLabel('')
        self._count.setObjectName('summaryCountBadge')
        head.addWidget(self._count, 0)
        hint = QLabel('Bấm dòng = Bật/Tắt  ·  › = chi tiết')
        hint.setObjectName('mutedLabel')
        head.addWidget(hint, 0)
        root.addLayout(head)
        self._status = QLabel('')
        self._status.setObjectName('summaryStatusLabel')
        self._status.hide()
        root.addWidget(self._status)
        columns = QHBoxLayout()
        columns.setSpacing(6)
        pipe_card = QFrame()
        pipe_card.setObjectName('summarySectionCard')
        _force_dark(pipe_card, _CARD)
        pipe_lay = QVBoxLayout(pipe_card)
        pipe_lay.setContentsMargins(6, 5, 6, 5)
        pipe_lay.setSpacing(2)
        pipe_title = QLabel('QUY TRÌNH (thứ tự xuất)')
        pipe_title.setObjectName('projectEyebrow')
        pipe_lay.addWidget(pipe_title)
        self._pipe_host = QWidget()
        self._pipe_host.setObjectName('summaryBoardHost')
        _force_dark(self._pipe_host, _CARD)
        self._pipe_layout = QVBoxLayout(self._pipe_host)
        self._pipe_layout.setContentsMargins(0, 0, 0, 0)
        self._pipe_layout.setSpacing(1)
        self._pipe_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        pipe_scroll = QScrollArea()
        pipe_scroll.setObjectName('summaryScroll')
        pipe_scroll.setWidgetResizable(True)
        pipe_scroll.setFrameShape(QFrame.Shape.NoFrame)
        pipe_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _force_dark(pipe_scroll, _CARD)
        _force_dark(pipe_scroll.viewport(), _CARD)
        pipe_scroll.setWidget(self._pipe_host)
        pipe_lay.addWidget(pipe_scroll, 1)
        columns.addWidget(pipe_card, 3)
        extra_card = QFrame()
        extra_card.setObjectName('summarySectionCard')
        _force_dark(extra_card, _CARD)
        extra_lay = QVBoxLayout(extra_card)
        extra_lay.setContentsMargins(6, 5, 6, 5)
        extra_lay.setSpacing(2)
        extra_title = QLabel('CẤU HÌNH NHANH')
        extra_title.setObjectName('projectEyebrow')
        extra_lay.addWidget(extra_title)
        self._extra_host = QWidget()
        self._extra_host.setObjectName('summaryBoardHost')
        _force_dark(self._extra_host, _CARD)
        self._extra_layout = QVBoxLayout(self._extra_host)
        self._extra_layout.setContentsMargins(0, 0, 0, 0)
        self._extra_layout.setSpacing(1)
        self._extra_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        extra_scroll = QScrollArea()
        extra_scroll.setObjectName('summaryScroll')
        extra_scroll.setWidgetResizable(True)
        extra_scroll.setFrameShape(QFrame.Shape.NoFrame)
        extra_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _force_dark(extra_scroll, _CARD)
        _force_dark(extra_scroll.viewport(), _CARD)
        extra_scroll.setWidget(self._extra_host)
        extra_lay.addWidget(extra_scroll, 1)
        columns.addWidget(extra_card, 2)
        root.addLayout(columns, 1)
        flow_card = QFrame()
        flow_card.setObjectName('summarySectionCard')
        _force_dark(flow_card, _CARD)
        flow_lay = QVBoxLayout(flow_card)
        flow_lay.setContentsMargins(4, 2, 4, 2)
        flow_lay.setSpacing(2)
        flow_head = QHBoxLayout()
        flow_title = QLabel('DÂY CHẠY (n8n)')
        flow_title.setObjectName('projectEyebrow')
        flow_head.addWidget(flow_title, 0)
        flow_hint = QLabel('node nối dây · bấm node để mở chi tiết')
        flow_hint.setObjectName('mutedLabel')
        flow_head.addStretch(1)
        flow_head.addWidget(flow_hint, 0)
        flow_lay.addLayout(flow_head)
        flow_scroll = QScrollArea()
        flow_scroll.setObjectName('workflowFlowScroll')
        flow_scroll.setWidgetResizable(True)
        flow_scroll.setFrameShape(QFrame.Shape.NoFrame)
        flow_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        flow_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        flow_scroll.setFixedHeight(44)
        _force_dark(flow_scroll, _CARD)
        _force_dark(flow_scroll.viewport(), _CARD)
        self._flow = N8nFlowStrip()
        self._flow.nodeClicked.connect(self._on_flow_node)
        flow_scroll.setWidget(self._flow)
        flow_lay.addWidget(flow_scroll)
        root.addWidget(flow_card, 0)
        footer = QHBoxLayout()
        footer.addStretch(1)
        refresh_btn = QPushButton('Làm mới')
        refresh_btn.clicked.connect(lambda: self.refresh(force=True))
        footer.addWidget(refresh_btn)
        close_btn = QPushButton('Đóng')
        close_btn.setObjectName('primaryButton')
        close_btn.clicked.connect(self.close)
        footer.addWidget(close_btn)
        root.addLayout(footer)
        self._auto_refresh_timer = QTimer(self)
        self._auto_refresh_timer.setInterval(_AUTO_REFRESH_MS)
        self._auto_refresh_timer.timeout.connect(self.refresh)
        self._status_clear_timer = QTimer(self)
        self._status_clear_timer.setSingleShot(True)
        self._status_clear_timer.timeout.connect(self._status.hide)
        self._busy_clear_timer = QTimer(self)
        self._busy_clear_timer.setSingleShot(True)
        self._busy_clear_timer.timeout.connect(self._clear_busy)

    def set_state(self, state: ProjectState, *, project_name: str | None) -> None:
        self.state = state
        self._fingerprint = None
        if project_name is not None:
            self._project_name = project_name or 'Dự án'
            self._project_badge.setText(self._project_name)
        self.setWindowTitle(f'Tóm tắt nhanh — {self._project_name}')

    def show_status(self, message: str, *, error: bool) -> None:
        text = str(message or '').strip()
        if text:
            self._status.setText(text)
            self._status.setProperty('error', bool(error))
            style = self._status.style()
            if style is not None:
                style.unpolish(self._status)
                style.polish(self._status)
            self._status.show()
            self._status_clear_timer.start(2200)
        else:
            self._status.hide()
            return None

    def _clear_busy(self) -> None:
        self._busy = False

    def _mark_busy(self) -> None:
        self._busy = True
        self._busy_clear_timer.start(250)

    def _live_overrides(self) -> dict[str, object] | None:
        if self._live_overrides_provider is None:
            return None
        try:
            pass
        except Exception:
            pass

    def _board_to_summary_row(self, row: BoardRow) -> SummaryRow:
        return SummaryRow(label=row.label, value=row.value, module_id=row.module_id, focus_node=row.focus_node, focus_control=row.focus_control, overlay_part=row.overlay_part, subtitle_part=row.subtitle_part, toggle_key=row.toggle_key)

    def _emit_navigate(self, row: BoardRow) -> None:
        self.rowActivated.emit(self._board_to_summary_row(row))

    def _on_flow_node(self, node) -> None:
        self.rowActivated.emit(SummaryRow(label=node.label, value='Bật' if node.enabled else 'Tắt', module_id=node.module_id, focus_node=node.focus_node, focus_control=node.focus_control, overlay_part=node.overlay_part, subtitle_part=node.subtitle_part))

    def _on_line_toggle(self, row: BoardRow) -> None:
        if row.togglable:
            self._mark_busy()
            want = not bool(row.enabled)
            for widget in (*self._pipe_widgets, *self._extra_widgets):
                if widget._row.id == row.id:
                    widget.apply_optimistic(want)
            if row.node_id:
                self.nodeToggleRequested.emit(row.node_id, want)
                return None
            if row.toggle_key:
                self.detailToggleRequested.emit(row.toggle_key, want)
                return None
        else:
            return None

    def _fill_column(self, layout: QVBoxLayout, host: QWidget, widgets: list[_BoardLine], rows: list[BoardRow]) -> list[_BoardLine]:
        if len(rows) == len(widgets):
            for widget, row in zip(widgets, rows):
                widget.update_row(row)
            return widgets
        while True:
            item = layout.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        new_widgets = []
        for row in rows:
            line = _BoardLine(row, host)
            line.toggleRequested.connect(self._on_line_toggle)
            line.navigateRequested.connect(self._emit_navigate)
            layout.addWidget(line)
            new_widgets.append(line)
        layout.addStretch(1)
        return new_widgets

    def refresh(self, force: bool=False) -> None:
        if self.state is None:
            return None
        if not self._busy or force:
            overrides = self._live_overrides()
            pipe, extra = (build_summary_board(self.state, live_overrides=overrides)[0], build_summary_board(self.state, live_overrides=overrides)[1])
            nodes = build_workflow_nodes(self.state)
            active = [n for n in nodes if n.enabled]
            fp = (tuple(((r.id, r.enabled, r.value) for r in pipe)), tuple(((r.id, r.enabled, r.value) for r in extra)), tuple(((n.id, n.enabled) for n in active)), self._project_name)
            if not force and fp == self._fingerprint:
                return None
            self._fingerprint = fp
            on_count = sum((1 for r in pipe if r.enabled))
            self._count.setText(f'{on_count}/{len(pipe)} bước Bật')
            self._pipe_widgets = self._fill_column(self._pipe_layout, self._pipe_host, self._pipe_widgets, pipe)
            self._extra_widgets = self._fill_column(self._extra_layout, self._extra_host, self._extra_widgets, extra)
            self._flow.set_nodes(active)
        else:
            return None

    def showEvent(self, event) -> None:
        self.refresh(force=self._fingerprint is None)
        self._auto_refresh_timer.start()
        super().showEvent(event)
        if self.isMinimized():
            self.showNormal()
            return None

    def hideEvent(self, event) -> None:
        self._auto_refresh_timer.stop()
        super().hideEvent(event)