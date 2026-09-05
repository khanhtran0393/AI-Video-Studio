from __future__ import annotations
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFormLayout, QFrame, QHBoxLayout, QLabel, QPushButton, QSizePolicy, QVBoxLayout, QWidget

class ControlNode(QFrame):
    __doc__ = 'Nhóm thuộc tính CapCut-style: header bấm để thu/gọn.'

    def __init__(self, node_id: str, title: str, hint: str, parent: QWidget | None=None):
        super().__init__(parent)
        self.node_id = node_id
        self.title = title
        self._expanded = True
        self.setObjectName('controlNode')
        self.setProperty('contextActive', False)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 4, 8, 6)
        root.setSpacing(2)
        header = QFrame()
        header.setObjectName('controlNodeHeader')
        header_row = QHBoxLayout(header)
        header_row.setContentsMargins(0, 0, 0, 0)
        header_row.setSpacing(4)
        self._chevron = QLabel('▾')
        self._chevron.setObjectName('nodeChevron')
        self._chevron.setFixedWidth(14)
        header_row.addWidget(self._chevron)
        self._title_label = QLabel(title)
        self._title_label.setObjectName('nodeTitle')
        if hint:
            self._title_label.setToolTip(hint)
            header.setToolTip(hint)
        header_row.addWidget(self._title_label, 1)
        self._toggle_btn = QPushButton()
        self._toggle_btn.setObjectName('nodeCollapseButton')
        self._toggle_btn.setFlat(True)
        self._toggle_btn.setFixedSize(1, 1)
        self._toggle_btn.hide()
        header_row.addWidget(self._toggle_btn)
        header.mousePressEvent = self._on_header_press
        root.addWidget(header)
        self.body = QWidget(self)
        self.body.setObjectName(f'{node_id}Body')
        self.form = QFormLayout(self.body)
        self.form.setContentsMargins(0, 2, 0, 0)
        self.form.setHorizontalSpacing(8)
        self.form.setVerticalSpacing(4)
        self.form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        self.form.setRowWrapPolicy(QFormLayout.RowWrapPolicy.WrapLongRows)
        self.form.setLabelAlignment(self.form.labelAlignment())
        self.body.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        root.addWidget(self.body)

    def _on_header_press(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.set_expanded(not self._expanded)
        event.accept()

    def set_expanded(self, expanded: bool) -> None:
        self._expanded = bool(expanded)
        self.body.setVisible(self._expanded)
        if self._expanded:
            self._chevron.setText('▾')
            return None
        self._chevron.setText('▸')

    def set_title(self, title: str) -> None:
        self.title = str(title or self.title)
        self._title_label.setText(self.title)

    def add_control(self, label: str, control: QWidget) -> QWidget:
        if label:
            name = QLabel(label)
            name.setWordWrap(True)
            self.form.addRow(name, control)
        else:
            self.form.addRow(control)
        return control

    def hide_chrome_header(self) -> None:
        header = self.findChild(QFrame, 'controlNodeHeader')
        if header is not None:
            header.hide()
            return None

    def set_context_active(self, active: bool, *, hide_inactive: bool) -> None:
        self.setProperty('contextActive', active)
        self.style().unpolish(self)
        self.style().polish(self)
        if hide_inactive:
            self.setVisible(bool(active))
        if active:
            self.set_expanded(True)
        self.update()