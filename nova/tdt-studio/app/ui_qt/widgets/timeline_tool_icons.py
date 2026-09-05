'Icon-only timeline tools — gọn như CapCut (không chiếm chỗ bằng nút chữ).'
from __future__ import annotations
from collections.abc import Callable
from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QColor, QIcon, QPainter, QPen, QPixmap
from PySide6.QtWidgets import QToolButton, QWidget
_ICON_SIZE = 20
_BTN_SIZE = 28

def _make_icon(draw: Callable[[QPainter, int], None], size: int=_ICON_SIZE) -> QIcon:
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    draw(painter, size)
    painter.end()
    return QIcon(pixmap)

def _pen(painter: QPainter, color: str='#C8D4E6', width: float=1.6) -> QPen:
    pen = QPen(QColor(color), width)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    painter.setPen(pen)
    painter.setBrush(Qt.BrushStyle.NoBrush)
    return pen

def _draw_split(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.7)
    cx = size // 2
    painter.drawLine(cx, 3, cx, size - 3)
    painter.drawLine(cx - 5, 6, cx + 5, 6)
    painter.drawLine(cx - 5, size - 6, cx + 5, size - 6)

def _draw_scene_split(painter: QPainter, size: int) -> None:
    _pen(painter, '#7DD3FC', 1.6)
    for cx in (6, size // 2, size - 6):
        painter.drawLine(cx, 4, cx, size - 4)
    _pen(painter, '#7DD3FC', 1.4)
    painter.drawLine(3, 7, size - 3, 7)
    painter.drawLine(3, size - 7, size - 3, size - 7)

def _draw_crop(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    m = 4
    inner = size - m - 1
    painter.drawRect(m, m, inner - m, inner - m)
    arm = 5
    for x0, y0, dx, dy in ((m, m, arm, 0), (m, m, 0, arm), (inner, m, -arm, 0), (inner, m, 0, arm), (m, inner, arm, 0), (m, inner, 0, -arm), (inner, inner, -arm, 0), (inner, inner, 0, -arm)):
        painter.drawLine(x0, y0, x0 + dx, y0 + dy)

def _draw_reset_trim(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    painter.drawArc(5, 4, 12, 12, 720, 4320)
    painter.drawLine(14, 5, 17, 2)
    painter.drawLine(14, 5, 11, 2)

def _draw_zoom_out(painter: QPainter, size: int) -> None:
    _pen(painter, '#AEBBD0', 1.6)
    painter.drawEllipse(4, 4, 11, 11)
    painter.drawLine(13, 13, 17, 17)
    painter.drawLine(7, 9, 12, 9)

def _draw_zoom_in(painter: QPainter, size: int) -> None:
    _pen(painter, '#AEBBD0', 1.6)
    painter.drawEllipse(4, 4, 11, 11)
    painter.drawLine(13, 13, 17, 17)
    painter.drawLine(7, 9, 12, 9)
    painter.drawLine(9, 7, 9, 12)

def _draw_skip_backward(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    painter.drawLine(6, 6, 6, size - 6)
    painter.drawLine(6, size // 2, 14, 6)
    painter.drawLine(6, size // 2, 14, size - 6)

def _draw_skip_forward(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    painter.drawLine(size - 6, 6, size - 6, size - 6)
    painter.drawLine(size - 6, size // 2, size - 14, 6)
    painter.drawLine(size - 6, size // 2, size - 14, size - 6)

def _draw_undo(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    painter.drawArc(4, 5, 12, 12, 1440, 4320)
    painter.drawLine(6, 7, 3, 4)
    painter.drawLine(6, 7, 9, 4)

def _draw_redo(painter: QPainter, size: int) -> None:
    _pen(painter, '#D8E2F2', 1.6)
    painter.drawArc(size - 16, 5, 12, 12, -1440, -4320)
    painter.drawLine(size - 6, 7, size - 3, 4)
    painter.drawLine(size - 6, 7, size - 9, 4)

def icon_undo() -> QIcon:
    return _make_icon(_draw_undo)

def icon_redo() -> QIcon:
    return _make_icon(_draw_redo)

def icon_skip_backward() -> QIcon:
    return _make_icon(_draw_skip_backward)

def icon_skip_forward() -> QIcon:
    return _make_icon(_draw_skip_forward)

def icon_split() -> QIcon:
    return _make_icon(_draw_split)

def icon_scene_split() -> QIcon:
    return _make_icon(_draw_scene_split)

def icon_crop() -> QIcon:
    return _make_icon(_draw_crop)

def icon_reset_trim() -> QIcon:
    return _make_icon(_draw_reset_trim)

def icon_zoom_out() -> QIcon:
    return _make_icon(_draw_zoom_out)

def icon_zoom_in() -> QIcon:
    return _make_icon(_draw_zoom_in)

def make_timeline_tool_button(icon: QIcon, tooltip: str, *, checkable: bool=False, parent: QWidget | None=None) -> QToolButton:
    button = QToolButton(parent)
    button.setObjectName('timelineToolButton')
    button.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonIconOnly)
    button.setAutoRaise(True)
    button.setFixedSize(_BTN_SIZE, _BTN_SIZE)
    button.setIcon(icon)
    button.setIconSize(QSize(_ICON_SIZE, _ICON_SIZE))
    button.setToolTip(tooltip)
    button.setCheckable(checkable)
    return button