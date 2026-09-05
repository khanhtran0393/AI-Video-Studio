'Thanh dây tóm tắt trên thước: cuộn ngang + nút Ẩn.'
from __future__ import annotations
from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QPushButton, QScrollArea, QSizePolicy, QWidget
from ui_qt.summary_snapshot import SummaryRow
from ui_qt.widgets.summary_flow_strip import N8nFlowStrip, _force_dark
_SCROLL_STEP_PX = 180
_BAR_MIN_WIDTH = 160

class TimelineSummaryFlowBar(QWidget):
    hideRequested = Signal()
    rowActivated = Signal(object)

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('timelineSummaryFlowBar')
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 4, 0)
        layout.setSpacing(4)
        self.strip = N8nFlowStrip(self)
        self.strip.nodeClicked.connect(self._on_node_clicked)
        self.scroll_left = QPushButton('◀')
        self.scroll_left.setObjectName('timelineSummaryFlowScrollLeft')
        self.scroll_left.setFixedSize(22, 24)
        self.scroll_left.setToolTip('Cuộn dây tóm tắt sang trái')
        self.scroll_left.clicked.connect(lambda: self._nudge_strip_scroll(-_SCROLL_STEP_PX))
        self.strip_scroll = QScrollArea(self)
        self.strip_scroll.setObjectName('timelineSummaryFlowScroll')
        self.strip_scroll.setWidget(self.strip)
        self.strip_scroll.setWidgetResizable(False)
        self.strip_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.strip_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.strip_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.strip_scroll.setFixedHeight(36)
        self.strip_scroll.setMinimumWidth(40)
        self.strip_scroll.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Fixed)
        self.strip_scroll.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        _force_dark(self.strip_scroll)
        _force_dark(self.strip_scroll.viewport())
        self.scroll_right = QPushButton('▶')
        self.scroll_right.setObjectName('timelineSummaryFlowScrollRight')
        self.scroll_right.setFixedSize(22, 24)
        self.scroll_right.setToolTip('Cuộn dây tóm tắt sang phải')
        self.scroll_right.clicked.connect(lambda: self._nudge_strip_scroll(_SCROLL_STEP_PX))
        layout.addWidget(self.scroll_left, 0)
        layout.addWidget(self.strip_scroll, 1)
        layout.addWidget(self.scroll_right, 0)
        self.hide_button = QPushButton('Ẩn')
        self.hide_button.setObjectName('timelineHideSummaryFlowButton')
        self.hide_button.setToolTip('Ẩn dây tóm tắt trên thước')
        self.hide_button.setFixedWidth(44)
        self.hide_button.clicked.connect(self.hideRequested.emit)
        layout.addWidget(self.hide_button, 0)
        self.setFixedHeight(38)
        self.setMinimumWidth(_BAR_MIN_WIDTH)
        self.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Fixed)
        self._sync_scroll_arrows()

    def sizeHint(self) -> QSize:
        return QSize(_BAR_MIN_WIDTH, 38)

    def minimumSizeHint(self) -> QSize:
        return QSize(_BAR_MIN_WIDTH, 38)

    def set_nodes(self, nodes: list) -> None:
        self.strip.set_nodes(nodes)
        self.strip.resize(self.strip.sizeHint())
        self.strip_scroll.setWidgetResizable(False)
        self._sync_scroll_arrows()

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._sync_scroll_arrows()

    def _nudge_strip_scroll(self, delta: int) -> None:
        bar = self.strip_scroll.horizontalScrollBar()
        bar.setValue(int(bar.value()) + int(delta))
        self._sync_scroll_arrows()

    def _sync_scroll_arrows(self) -> None:
        self.strip.resize(self.strip.sizeHint())
        self.strip_scroll.setWidgetResizable(False)
        bar = self.strip_scroll.horizontalScrollBar()
        viewport = self.strip_scroll.viewport()
        need = self.strip.width() > viewport.width() + 2
        if not need:
            need = bar.maximum() > 0
        self.scroll_left.setEnabled(need and bar.value() > bar.minimum())
        self.scroll_right.setEnabled(need and bar.value() < bar.maximum())
        self.scroll_left.setVisible(True)
        self.scroll_right.setVisible(True)

    def _on_node_clicked(self, node) -> None:
        self.rowActivated.emit(SummaryRow(label=str(getattr(node, 'label', '') or ''), value='Bật' if getattr(node, 'enabled', False) else 'Tắt', module_id=str(getattr(node, 'module_id', 'media') or 'media'), focus_node=getattr(node, 'focus_node', None), focus_control=getattr(node, 'focus_control', None), overlay_part=getattr(node, 'overlay_part', None), subtitle_part=getattr(node, 'subtitle_part', None)))