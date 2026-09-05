'Gallery chọn mẫu chữ đẹp — hiện hình preview (không chỉ tên dropdown).'
from __future__ import annotations
from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtGui import QIcon, QPixmap, QResizeEvent, QShowEvent
from PySide6.QtWidgets import QDialog, QDialogButtonBox, QGridLayout, QLabel, QScrollArea, QSizePolicy, QToolButton, QVBoxLayout, QWidget
from core.text_style import BEAUTIFUL_TEXT_STYLE_PRESETS, beautiful_text_style_labels, render_beautiful_text_preview_png
_CARD_MIN_W = 168
_CARD_H = 92
_PREVIEW_W = 160
_PREVIEW_H = 52
_DIALOG_STYLE = '\nQDialog#beautifulTextStylePicker {\n    background: #0F151F;\n    color: #E8EEF8;\n}\nQDialog#beautifulTextStylePicker QLabel#mutedLabel {\n    color: #9AA8BC;\n    font-size: 12px;\n}\nQScrollArea#beautifulTextStyleScroll {\n    background: #0F151F;\n    border: none;\n}\nQWidget#beautifulTextStyleHost {\n    background: #0F151F;\n}\nQToolButton#beautifulTextStyleCard {\n    background: #171E2A;\n    color: #D7E0EE;\n    border: 1px solid #2A3444;\n    border-radius: 8px;\n    padding: 6px 4px 8px 4px;\n    font-size: 11px;\n}\nQToolButton#beautifulTextStyleCard:hover {\n    border-color: #4D7CFF;\n    background: #1C2533;\n}\nQToolButton#beautifulTextStyleCard:checked {\n    border: 2px solid #4D7CFF;\n    background: #1A2740;\n    color: #FFFFFF;\n}\nQDialogButtonBox QPushButton {\n    min-width: 96px;\n    min-height: 30px;\n    padding: 4px 14px;\n    border-radius: 6px;\n    background: #1C2533;\n    color: #E8EEF8;\n    border: 1px solid #2A3444;\n}\nQDialogButtonBox QPushButton:default,\nQDialogButtonBox QPushButton#primaryButton {\n    background: #2F6BFF;\n    border-color: #2F6BFF;\n    color: #FFFFFF;\n    font-weight: 600;\n}\n'

class BeautifulTextStylePickerDialog(QDialog):
    __doc__ = 'Lưới thẻ preview — nhìn mẫu rồi chọn (giống picker tool gốc).'
    styleChosen = Signal(str)

    def __init__(self, parent: QWidget | None=None, *, current: str) -> None:
        super().__init__(parent)
        self.setWindowTitle('Mẫu chữ đẹp')
        self.setModal(True)
        self.setObjectName('beautifulTextStylePicker')
        self.setStyleSheet(_DIALOG_STYLE)
        self._selected = str(current or '').strip()
        self._buttons = {}
        self._grid = None
        self._host = None
        self._scroll = None
        self._columns = 0
        root = QVBoxLayout(self)
        root.setContentsMargins(14, 14, 14, 14)
        root.setSpacing(10)
        hint = QLabel('Nhìn hình → bấm thẻ để chọn → Áp dụng. Cửa sổ lớn: kéo góc để xem nhiều mẫu hơn trên một hàng.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        root.addWidget(hint)
        scroll = QScrollArea()
        scroll.setObjectName('beautifulTextStyleScroll')
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        self._scroll = scroll
        host = QWidget()
        host.setObjectName('beautifulTextStyleHost')
        self._host = host
        grid = QGridLayout(host)
        grid.setContentsMargins(4, 4, 4, 4)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)
        self._grid = grid
        for label, _payload in BEAUTIFUL_TEXT_STYLE_PRESETS:
            btn = QToolButton()
            btn.setObjectName('beautifulTextStyleCard')
            btn.setCheckable(True)
            btn.setAutoExclusive(True)
            btn.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextUnderIcon)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            btn.setMinimumSize(_CARD_MIN_W, _CARD_H)
            png = render_beautiful_text_preview_png(label, width=_PREVIEW_W, height=_PREVIEW_H)
            if png:
                pix = QPixmap()
                pix.loadFromData(png)
                btn.setIcon(QIcon(pix))
                btn.setIconSize(QSize(_PREVIEW_W, _PREVIEW_H))
            btn.setText(label)
            btn.setToolTip(label)
            btn.clicked.connect(lambda _checked, name: self._pick(name))
            self._buttons[label] = btn
            if label == self._selected:
                btn.setChecked(True)
        scroll.setWidget(host)
        root.addWidget(scroll, 1)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        ok = buttons.button(QDialogButtonBox.StandardButton.Ok)
        cancel = buttons.button(QDialogButtonBox.StandardButton.Cancel)
        if ok is not None:
            ok.setText('Áp dụng')
            ok.setObjectName('primaryButton')
            ok.setDefault(True)
        if cancel is not None:
            cancel.setText('Hủy')
        buttons.accepted.connect(self._accept_choice)
        buttons.rejected.connect(self.reject)
        root.addWidget(buttons)
        self._apply_startup_size(parent)

    def _apply_startup_size(self, parent: QWidget | None) -> None:
        screen = self.screen()
        avail = screen.availableGeometry() if screen is not None else None
        if parent is not None and parent.window() is not None:
            geo = parent.window().geometry()
            w = max(980, int(geo.width() * 0.82))
            h = max(640, int(geo.height() * 0.78))
        elif avail is not None:
            w = max(980, int(avail.width() * 0.72))
            h = max(640, int(avail.height() * 0.75))
        else:
            w, h = ((1100, 720)[0], (1100, 720)[1])
        if avail is not None:
            w = min(w, avail.width() - 40)
            h = min(h, avail.height() - 60)
        self.resize(w, h)
        if avail is not None:
            self.move(avail.x() + (avail.width() - w) // 2, avail.y() + (avail.height() - h) // 2)
            return None

    def showEvent(self, event: QShowEvent) -> None:
        super().showEvent(event)
        self._reflow_grid(force=True)

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        self._reflow_grid()

    def _column_count(self) -> int:
        scroll = self._scroll
        if scroll is None:
            return 5
        viewport = scroll.viewport()
        width = viewport.width() if viewport is not None else self.width()
        cols = max(4, (max(420, width) + 8) // (_CARD_MIN_W + 8))
        return min(8, cols)

    def _reflow_grid(self, *, force: bool) -> None:
        grid = self._grid
        if grid is None:
            return None
        cols = self._column_count()
        if not force and cols == self._columns:
            return None
        self._columns = cols
        for btn in self._buttons.values():
            grid.removeWidget(btn)
        for index, label in enumerate(self._buttons):
            btn = self._buttons[label]
            grid.addWidget(btn, index // cols, index % cols)
            btn.setVisible(True)

    def _pick(self, label: str) -> None:
        self._selected = label
        btn = self._buttons.get(label)
        if btn is not None:
            btn.setChecked(True)
            return None

    def _accept_choice(self) -> None:
        if self._selected and self._selected in set(beautiful_text_style_labels()):
            self.styleChosen.emit(self._selected)
            self.accept()
            return None
        self.reject()

    def selected_label(self) -> str:
        return self._selected

def pick_beautiful_text_style(parent: QWidget | None=None, *, current: str) -> str:
    dialog = BeautifulTextStylePickerDialog(parent, current=current)
    return '' if dialog.exec() != QDialog.DialogCode.Accepted else dialog.selected_label()