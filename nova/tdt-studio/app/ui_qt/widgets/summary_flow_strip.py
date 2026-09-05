'Dây quy trình kiểu n8n: node bo góc + đường nối + chấm giữa.'
from __future__ import annotations
from PySide6.QtCore import QPointF, QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QFont, QFontMetrics, QPainter, QPainterPath, QPalette, QPen
from PySide6.QtWidgets import QWidget
_CARD = QColor('#0F1520')

def _force_dark(widget: QWidget, color: QColor=_CARD) -> None:
    widget.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    widget.setAutoFillBackground(True)
    pal = widget.palette()
    pal.setColor(QPalette.ColorRole.Window, color)
    pal.setColor(QPalette.ColorRole.Base, color)
    pal.setColor(QPalette.ColorRole.Button, color)
    widget.setPalette(pal)

class N8nFlowStrip(QWidget):
    __doc__ = 'Dây quy trình kiểu n8n: node bo góc + đường nối + chấm giữa.'
    nodeClicked = Signal(object)

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('summaryN8nFlow')
        self._nodes = []
        self._hit = []
        self.setFixedHeight(36)
        self.setMinimumWidth(200)
        self.setCursor(Qt.CursorShape.ArrowCursor)
        _force_dark(self, _CARD)

    def _content_width(self) -> int:
        n = max(1, len(self._nodes))
        return max(220, 28 + n * 108)

    def sizeHint(self) -> QSize:
        return QSize(self._content_width(), 36)

    def minimumSizeHint(self) -> QSize:
        return QSize(self._content_width(), 36)

    def set_nodes(self, nodes: list) -> None:
        self._nodes = list(nodes)
        self._hit.clear()
        width = self._content_width()
        self.setMinimumWidth(width)
        self.resize(width, 36)
        self.updateGeometry()
        self.update()

    def paintEvent(self, event) -> None:
        del event
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.fillRect(self.rect(), _CARD)
        nodes = self._nodes
        self._hit = []
        if nodes:
            pad_x = 8.0
            node_h = 20.0
            y = (self.height() - node_h) / 2.0
            gap = 12.0
            avail = max(80.0, self.width() - pad_x * 2)
            n = len(nodes)
            unit = avail / n
            node_w = min(96.0, max(64.0, unit - gap))
            font = QFont(self.font().family(), 8)
            font.setBold(True)
            painter.setFont(font)
            metrics = QFontMetrics(font)
            centers = []
            for i, node in enumerate(nodes):
                x = pad_x + i * unit + (unit - node_w) / 2.0
                rect = QRectF(x, y, node_w, node_h)
                centers.append((rect.center().x(), rect.center().y(), rect, node))
            for i in range(len(centers) - 1):
                x1, y1 = (centers[i][0], centers[i][1])
                x2, y2, r2, _ = (centers[i + 1][0], centers[i + 1][1], centers[i + 1][2], centers[i + 1][3])
                left = centers[i][2].right() + 2
                right = r2.left() - 2
                mid = (left + right) / 2.0
                pen = QPen(QColor('#3DCF7A'), 2.0)
                painter.setPen(pen)
                path = QPainterPath()
                path.moveTo(left, y1)
                path.cubicTo(QPointF(mid - 4, y1), QPointF(mid + 4, y2), QPointF(right, y2))
                painter.drawPath(path)
                painter.setBrush(QColor('#5B9AFF'))
                painter.setPen(Qt.PenStyle.NoPen)
                painter.drawEllipse(QPointF(mid, y1), 3.2, 3.2)
            for x, y_c, rect, node in centers:
                del x, y_c
                always = bool(getattr(node, 'always_on', False))
                if always:
                    fill = QColor('#193154')
                    border = QColor('#5B9AFF')
                    text_c = QColor('#E8F1FF')
                else:
                    fill = QColor('#1A3A28')
                    border = QColor('#3DCF7A')
                    text_c = QColor('#FFFFFF')
                painter.setBrush(fill)
                painter.setPen(QPen(border, 1.4))
                painter.drawRoundedRect(rect, 8, 8)
                painter.setBrush(border)
                painter.setPen(Qt.PenStyle.NoPen)
                painter.drawEllipse(QPointF(rect.left() + 8, rect.center().y()), 3.0, 3.0)
                label = str(getattr(node, 'label', '') or '')
                text_rect = QRectF(rect.left() + 14, rect.top(), rect.width() - 18, rect.height())
                elided = metrics.elidedText(label, Qt.TextElideMode.ElideRight, int(text_rect.width()))
                painter.setPen(text_c)
                painter.drawText(text_rect, int(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft), elided)
                self._hit.append((rect, node))
        else:
            painter.setPen(QColor('#6A7688'))
            painter.setFont(QFont(self.font().family(), 10))
            painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, 'Chưa có bước Bật')
            return None

    def mousePressEvent(self, event) -> None:
        if event.button() != Qt.MouseButton.LeftButton:
            super().mousePressEvent(event)
            return None
        pos = event.position()
        for rect, node in self._hit:
            if rect.contains(pos):
                self.nodeClicked.emit(node)
                event.accept()
                return None
        super().mousePressEvent(event)