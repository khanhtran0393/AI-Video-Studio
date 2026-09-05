from __future__ import annotations
from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtWidgets import QButtonGroup, QFrame, QHBoxLayout, QLabel, QPushButton, QSizePolicy, QVBoxLayout
from ui_qt.modules import APP_MODULES, AppModule, is_edit_rail_module, is_tool_module
_MODULE_ICONS: 'dict[str, str]' = {'media': '▣', 'tts': '♪', 'subtitle': 'Aa', 'effects': '⧉', 'look': '✦', 'kho': '🗂', 'filters': '◐', 'transitions': '⇄', 'preset': '☰', 'summary': '🔎', 'batch': '↑', 'downloader': '↓', 'settings': '⚙'}
_RAIL_HEIGHT = 56
_BTN_WIDTH = 48
_BTN_HEIGHT = 48

class ModuleRail(QFrame):
    moduleChanged = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName('moduleRail')
        self.setFixedHeight(_RAIL_HEIGHT)
        self.setMinimumWidth(_BTN_WIDTH + 8)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.buttons = {}
        self._module_order = []
        self._active_module_id = APP_MODULES[0].id
        self.group = QButtonGroup(self)
        self.group.setExclusive(True)
        self._outer = QHBoxLayout(self)
        self._outer.setContentsMargins(4, 4, 4, 4)
        self._outer.setSpacing(2)
        for module in APP_MODULES:
            if is_edit_rail_module(module.id):
                button = self._make_button(module)
                self._outer.addWidget(button, 0)
                self.buttons[module.id] = button
                self._module_order.append(module.id)
                self.group.addButton(button)
        self._outer.addStretch(1)
        self.set_active_module(self._active_module_id)
        self._apply_overflow_visibility()

    def minimumSizeHint(self) -> QSize:
        return QSize(_BTN_WIDTH + 8, _RAIL_HEIGHT)

    def sizeHint(self) -> QSize:
        n = max(1, len(self._module_order))
        m = self._outer.contentsMargins()
        w = m.left() + m.right() + n * _BTN_WIDTH + max(0, n - 1) * self._outer.spacing()
        return QSize(w, _RAIL_HEIGHT)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._apply_overflow_visibility()

    def set_active_module(self, module_id: str) -> None:
        button = self.buttons.get(module_id)
        if button is None:
            return None
        self._active_module_id = module_id
        button.setChecked(True)
        for mid, btn in self.buttons.items():
            active = mid == module_id
            btn.setProperty('railActive', active)
            style = btn.style()
            if style is not None:
                style.unpolish(btn)
                style.polish(btn)
            btn.update()
        self._apply_overflow_visibility()

    def visible_module_ids(self) -> list[str]:
        return [mid for mid in self._module_order if self.buttons[mid].isVisible()]

    def _slots_that_fit(self) -> int:
        margins = self._outer.contentsMargins()
        avail = max(0, self.width() - margins.left() - margins.right())
        spacing = self._outer.spacing()
        step = _BTN_WIDTH + spacing
        return 1 if step <= 0 else max(1, min(len(self._module_order), (avail + spacing) // step))

    def _apply_overflow_visibility(self) -> None:
        order = self._module_order
        if order:
            fit = self._slots_that_fit()
            active = self._active_module_id
            show = list(order[:fit])
            if active in self.buttons and active not in show:
                show[-1] = active
            visible = set(show)
            for mid, btn in self.buttons.items():
                btn.setVisible(mid in visible)
        else:
            return None

    def _make_button(self, module: AppModule) -> QPushButton:
        button = QPushButton()
        button.setObjectName('railButton')
        button.setCheckable(True)
        button.setFixedSize(_BTN_WIDTH, _BTN_HEIGHT)
        button.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        button.setCursor(Qt.CursorShape.PointingHandCursor)
        button.setToolTip(f'{module.title}\n{module.description}')
        layout = QVBoxLayout(button)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(1)
        icon = QLabel(_MODULE_ICONS.get(module.id, '·'))
        icon.setObjectName('railButtonIcon')
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        text = QLabel(module.short_title)
        text.setObjectName('railButtonText')
        text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        text.setWordWrap(True)
        text.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        layout.addWidget(icon, 0, Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(text, 0, Qt.AlignmentFlag.AlignCenter)
        if not module.ready:
            button.setProperty('modulePending', True)
        if is_tool_module(module.id):
            button.setProperty('railSecondary', True)
        button.clicked.connect(lambda _checked, module_id=module.id: self.moduleChanged.emit(module_id))
        return button