from __future__ import annotations
import re
from PySide6.QtCore import Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QColorDialog, QHBoxLayout, QLineEdit, QPushButton, QWidget
_HEX_RE = re.compile('^#?[0-9A-Fa-f]{6}$')

def normalize_hex_color(value: str, *, default: str) -> str:
    text = str(value or '').strip()
    if text:
        if not text.startswith('#'):
            text = f'#{text}'
        return f'#{text[1:].upper()}' if _HEX_RE.match(text) else default.upper()
    return default.upper()

class ColorField(QWidget):
    __doc__ = 'Mã #RRGGBB + nút mở bảng màu.'
    valueChanged = Signal(str)

    def __init__(self, default: str='#FFFFFF', parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self._default = normalize_hex_color(default, default=default)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        self.edit = QLineEdit()
        self.edit.setPlaceholderText('#FFFFFF')
        self.edit.setMaxLength(7)
        self.edit.setToolTip('Nhập mã màu #RRGGBB hoặc bấm «Chọn màu»')
        self.pick_button = QPushButton('Chọn màu')
        self.pick_button.setToolTip('Mở bảng màu hệ thống')
        self.pick_button.clicked.connect(self._open_picker)
        self.edit.textChanged.connect(self._on_text_changed)
        layout.addWidget(self.edit, 1)
        layout.addWidget(self.pick_button, 0)
        self.set_hex(self._default, emit=False)

    def hex_value(self) -> str:
        return normalize_hex_color(self.edit.text(), default=self._default)

    def set_hex(self, value: str, *, emit: bool) -> None:
        normalized = normalize_hex_color(value, default=self._default)
        self.edit.blockSignals(True)
        try:
            self.edit.setText(normalized)
        finally:
            self.edit.blockSignals(False)
        self._sync_button_color(normalized)
        if emit:
            self.valueChanged.emit(normalized)

    def _on_text_changed(self, text: str) -> None:
        raw = str(text or '').strip()
        normalized = normalize_hex_color(raw, default=self._default)
        if raw and (not raw.startswith('#')) and _HEX_RE.match(f'#{raw}') and (normalized != raw):
            self.edit.blockSignals(True)
            try:
                self.edit.setText(normalized)
            finally:
                self.edit.blockSignals(False)
        normalized = normalize_hex_color(self.edit.text(), default=self._default)
        self._sync_button_color(normalized)
        self.valueChanged.emit(normalized)

    def _sync_button_color(self, hex_color: str) -> None:
        color = QColor(hex_color)
        if not color.isValid():
            color = QColor(self._default)
        self.pick_button.setStyleSheet(f"background-color: {color.name()}; color: {('#111' if color.lightness() > 160 else '#FFF')};")

    def _open_picker(self) -> None:
        initial = QColor(self.hex_value())
        chosen = QColorDialog.getColor(initial, self, 'Chọn màu chữ', QColorDialog.ColorDialogOption.ShowAlphaChannel)
        if chosen.isValid():
            self.set_hex(chosen.name(QColor.NameFormat.HexRgb))
        else:
            return None