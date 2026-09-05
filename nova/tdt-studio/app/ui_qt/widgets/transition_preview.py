'Xem nhanh chuyển cảnh CapCut-style (mô phỏng QPainter).'
from __future__ import annotations
from PySide6.QtCore import QRectF, Qt, QTimer
from PySide6.QtGui import QColor, QPainter, QPainterPath, QLinearGradient
from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget
from core.timeline_transitions import style_label, style_xfade_name

class _TransitionPreviewCanvas(QWidget):

    def __init__(self, style_id: str, parent: QWidget | None=None):
        super().__init__(parent)
        self.style_id = style_id
        self._t = 0.0
        self.setMinimumSize(280, 400)
        self.setObjectName('transitionPreviewCanvas')
        self._timer = QTimer(self)
        self._timer.setInterval(33)
        self._timer.timeout.connect(self._tick)
        self._timer.start()

    def _tick(self) -> None:
        self._t = (self._t + 0.025) % 1.0
        self.update()

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        rect = self.rect().adjusted(8, 8, -8, -8)
        a = QColor('#1B6BFF')
        b = QColor('#E23D4F')
        t = self._t
        xfade = style_xfade_name(self.style_id) or 'fade'
        painter.fillRect(rect, QColor('#0B1018'))

        def _draw_panel(color: QColor, clip_rect: QRectF) -> None:
            painter.save()
            painter.setClipRect(clip_rect)
            painter.fillRect(rect, color)
            painter.setPen(QColor('#FFFFFF'))
            painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, 'A' if color == a else 'B')
            painter.restore()
        if xfade in frozenset({'', 'cut'}):
            _draw_panel(a if t < 0.5 else b, QRectF(rect))
        elif xfade in frozenset({'dissolve', 'fade', 'fadegrays', 'hblur'}):
            _draw_panel(a, QRectF(rect))
            painter.setOpacity(t)
            _draw_panel(b, QRectF(rect))
            painter.setOpacity(1.0)
        elif xfade in frozenset({'fadeblack', 'fadewhite'}):
            mid = QColor('#000000' if xfade == 'fadeblack' else '#FFFFFF')
            if t < 0.5:
                _draw_panel(a, QRectF(rect))
                painter.setOpacity(t * 2)
                painter.fillRect(rect, mid)
            else:
                painter.fillRect(rect, mid)
                painter.setOpacity((t - 0.5) * 2)
                _draw_panel(b, QRectF(rect))
            painter.setOpacity(1.0)
        elif 'left' in xfade or xfade.endswith('left'):
            w = rect.width() * t
            _draw_panel(a, QRectF(rect))
            _draw_panel(b, QRectF(rect.x(), rect.y(), w, rect.height()))
        elif 'right' in xfade:
            w = rect.width() * t
            _draw_panel(a, QRectF(rect))
            _draw_panel(b, QRectF(rect.right() - w, rect.y(), w, rect.height()))
        elif 'up' in xfade:
            h = rect.height() * t
            _draw_panel(a, QRectF(rect))
            _draw_panel(b, QRectF(rect.x(), rect.y(), rect.width(), h))
        elif 'down' in xfade:
            h = rect.height() * t
            _draw_panel(a, QRectF(rect))
            _draw_panel(b, QRectF(rect.x(), rect.bottom() - h, rect.width(), h))
        elif 'circle' in xfade:
            _draw_panel(a, QRectF(rect))
            path = QPainterPath()
            path.addEllipse(rect.center(), rect.width() * 0.6 * t, rect.height() * 0.6 * t)
            painter.setClipPath(path)
            _draw_panel(b, QRectF(rect))
        elif 'zoom' in xfade:
            _draw_panel(a, QRectF(rect))
            painter.setOpacity(min(1.0, t * 1.2))
            scale = 0.55 + 0.45 * t
            cy, cx = (rect.center().y(), rect.center().x())
            zh, zw = (rect.height() * scale, rect.width() * scale)
            _draw_panel(b, QRectF(cx - zw / 2, cy - zh / 2, zw, zh))
            painter.setOpacity(1.0)
        elif 'diag' in xfade:
            _draw_panel(a, QRectF(rect))
            path = QPainterPath()
            path.moveTo(rect.topLeft())
            path.lineTo(rect.topLeft() + (rect.bottomRight() - rect.topLeft()) * t * 1.2)
            path.lineTo(rect.bottomLeft())
            path.closeSubpath()
            painter.setClipPath(path)
            _draw_panel(b, QRectF(rect))
        else:
            _draw_panel(a, QRectF(rect))
            grad = QLinearGradient(rect.topLeft(), rect.topRight())
            grad.setColorAt(max(0.0, t - 0.15), QColor(0, 0, 0, 0))
            grad.setColorAt(t, QColor(0, 0, 0, 255))
            painter.setOpacity(0.85)
            _draw_panel(b, QRectF(rect.x(), rect.y(), rect.width() * t, rect.height()))
            painter.setOpacity(1.0)
        painter.setPen(QColor('#8FA3BC'))
        painter.drawRoundedRect(rect, 8, 8)

class TransitionPreviewDialog(QDialog):

    def __init__(self, style_id: str, parent: QWidget | None=None):
        super().__init__(parent)
        self.setWindowTitle(f'Xem nhanh · {style_label(style_id)}')
        self.setModal(True)
        self.resize(320, 520)
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(8)
        title = QLabel(style_label(style_id))
        title.setObjectName('projectEyebrow')
        root.addWidget(title)
        tip = QLabel('Mô phỏng nhanh kiểu CapCut — A → B. Xuất video dùng FFmpeg xfade thật.')
        tip.setWordWrap(True)
        tip.setObjectName('mutedLabel')
        root.addWidget(tip)
        root.addWidget(_TransitionPreviewCanvas(style_id), 1)
        row = QHBoxLayout()
        row.addStretch(1)
        close_btn = QPushButton('Đóng')
        close_btn.clicked.connect(self.accept)
        row.addWidget(close_btn)
        root.addLayout(row)