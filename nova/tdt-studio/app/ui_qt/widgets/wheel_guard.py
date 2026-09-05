'Chặn lăn chuột đổi giá trị spin/combo khi chưa focus — để cuộn panel thuộc tính.'
from __future__ import annotations
from PySide6.QtCore import QEvent, QObject, Qt
from PySide6.QtWidgets import QAbstractSpinBox, QApplication, QComboBox, QDoubleSpinBox, QScrollArea, QSlider, QSpinBox, QWidget

class _WheelGuardFilter(QObject):

    def eventFilter(self, watched: QObject, event: QEvent) -> bool:
        if event.type() != QEvent.Type.Wheel:
            return False
        if not isinstance(watched, QWidget):
            return False
        if watched.hasFocus():
            return False
        scroll = watched.parentWidget()
        while scroll is not None and not isinstance(scroll, QScrollArea):
            scroll = scroll.parentWidget()
        if scroll is not None:
            QApplication.sendEvent(scroll.viewport(), event)
            return True
        event.ignore()
        return False
_FILTER: '_WheelGuardFilter | None' = None

def _shared_filter() -> _WheelGuardFilter:
    global _FILTER
    if _FILTER is None:
        _FILTER = _WheelGuardFilter()
    return _FILTER

def guard_wheel_unless_focused(widget: QWidget) -> QWidget:
    widget.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
    widget.installEventFilter(_shared_filter())
    return widget

class GuardedSpinBox(QSpinBox):

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        guard_wheel_unless_focused(self)

    def wheelEvent(self, event) -> None:
        if self.hasFocus():
            super().wheelEvent(event)
            return None
        event.ignore()

class GuardedDoubleSpinBox(QDoubleSpinBox):

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        guard_wheel_unless_focused(self)

    def wheelEvent(self, event) -> None:
        if self.hasFocus():
            super().wheelEvent(event)
            return None
        event.ignore()

class GuardedSlider(QSlider):

    def __init__(self, orientation, parent: QWidget | None=None) -> None:
        super().__init__(orientation, parent)
        guard_wheel_unless_focused(self)

    def wheelEvent(self, event) -> None:
        if self.hasFocus():
            super().wheelEvent(event)
            return None
        event.ignore()

def guard_existing_spin_and_combo(root: QWidget) -> None:
    for spin in root.findChildren(QAbstractSpinBox):
        guard_wheel_unless_focused(spin)
    for combo in root.findChildren(QComboBox):
        guard_wheel_unless_focused(combo)
    for slider in root.findChildren(QSlider):
        guard_wheel_unless_focused(slider)